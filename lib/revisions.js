'use strict';

const { createClient } = require('@supabase/supabase-js');
const { hasMinimumRole } = require('./authorization.js');

function createSupabaseRevisionStore(options = {}) {
  const url = options.supabaseUrl || process.env.SUPABASE_URL || '';
  const key = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const clientFactory = options.clientFactory || createClient;
  let client;

  function getClient() {
    if (!url || !key) {
      const error = new Error('Revision storage is not configured.');
      error.code = 'REVISION_STORE_NOT_CONFIGURED';
      throw error;
    }
    if (!client) client = clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return client;
  }

  function unavailable(error) {
    const wrapped = new Error('Revision storage is temporarily unavailable.');
    wrapped.code = 'REVISION_STORE_UNAVAILABLE';
    wrapped.cause = error;
    return wrapped;
  }

  function mapRow(row) {
    return {
      id: row.id,
      versionNumber: row.version_number,
      timestamp: row.created_at,
      title: row.title,
      presetId: row.preset_id,
      content: row.content,
      score: row.score,
      status: row.status,
      statusLabel: row.status === 'changes_requested' ? 'Changes Requested' : row.status[0].toUpperCase() + row.status.slice(1),
      issuesCount: row.issues_count,
      criticalCount: row.critical_count,
      warningCount: row.warning_count,
      advisoryCount: row.advisory_count,
      author: row.author,
      ownerId: row.owner_id,
      notes: row.notes,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at
    };
  }

  async function list(userId, role) {
    try {
      let query = getClient().from('brandguard_revisions').select('*').order('created_at', { ascending: false }).limit(500);
      if (!hasMinimumRole(role, 'reviewer')) query = query.eq('owner_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (error) {
      if (error.code === 'REVISION_STORE_NOT_CONFIGURED') throw error;
      throw unavailable(error);
    }
  }

  async function create(snapshot, owner) {
    try {
      const db = getClient();
      const { count, error: countError } = await db.from('brandguard_revisions').select('id', { count: 'exact', head: true }).eq('owner_id', owner.id);
      if (countError) throw countError;
      const row = {
        owner_id: owner.id,
        version_number: (count || 0) + 1,
        title: `Revision #${(count || 0) + 1}`,
        preset_id: snapshot.presetId || 'apexTech',
        content: snapshot.content,
        score: snapshot.score,
        status: 'draft',
        issues_count: snapshot.issuesCount,
        critical_count: snapshot.criticalCount,
        warning_count: snapshot.warningCount,
        advisory_count: snapshot.advisoryCount,
        author: owner.email || owner.id,
        notes: snapshot.notes || ''
      };
      const { data, error } = await db.from('brandguard_revisions').insert(row).select('*').single();
      if (error) throw error;
      return mapRow(data);
    } catch (error) {
      if (error.code === 'REVISION_STORE_NOT_CONFIGURED') throw error;
      throw unavailable(error);
    }
  }

  async function review(id, status, notes, actor) {
    try {
      const db = getClient();
      const { data: existing, error: readError } = await db.from('brandguard_revisions').select('id,owner_id,status').eq('id', id).maybeSingle();
      if (readError) throw readError;
      if (!existing) {
        const error = new Error('Revision not found.');
        error.code = 'REVISION_NOT_FOUND';
        throw error;
      }
      if (existing.status !== 'draft') {
        const error = new Error('Only draft revisions can be reviewed.');
        error.code = 'REVISION_NOT_DRAFT';
        throw error;
      }
      const { data, error } = await db.from('brandguard_revisions').update({
        status,
        notes: notes || '',
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString()
      }).eq('id', id).eq('owner_id', existing.owner_id).eq('status', 'draft').select('*').maybeSingle();
      if (error) throw error;
      if (!data) {
        const conflict = new Error('Revision changed while it was being reviewed. Reload the history and try again.');
        conflict.code = 'REVISION_CONFLICT';
        throw conflict;
      }
      return mapRow(data);
    } catch (error) {
      if (error.code === 'REVISION_STORE_NOT_CONFIGURED' || error.code === 'REVISION_NOT_FOUND' || error.code === 'REVISION_NOT_DRAFT' || error.code === 'REVISION_CONFLICT') throw error;
      throw unavailable(error);
    }
  }

  async function clearOwn(userId) {
    try {
      const db = getClient();
      const { data: deletedRows, error: deleteError } = await db.from('brandguard_revisions')
        .delete({ count: 'exact' })
        .eq('owner_id', userId)
        .select('id');
      if (deleteError) {
        console.error('[BrandGuard] Revision delete failed.', { stage: 'delete', code: safeDatabaseCode(deleteError) });
        throw deleteError;
      }

      // PostgREST DELETE normally returns no rows. Confirm using the same verified owner scope.
      const { data, error: verifyError } = await db.from('brandguard_revisions')
        .select('id')
        .eq('owner_id', userId);
      if (verifyError) {
        console.error('[BrandGuard] Revision delete verification failed.', { stage: 'verify', code: safeDatabaseCode(verifyError) });
        throw verifyError;
      }
      console.info('[BrandGuard] Revision delete verification completed.', {
        deletedCount: Number.isInteger(deletedRows && deletedRows.length) ? deletedRows.length : null,
        remainingOwnedCount: (data || []).length
      });
      if ((data || []).length > 0) {
        const error = new Error('Revision deletion could not be confirmed.');
        error.code = 'REVISION_DELETE_NOT_CONFIRMED';
        throw error;
      }
      return [];
    } catch (error) {
      if (error.code === 'REVISION_STORE_NOT_CONFIGURED' || error.code === 'REVISION_DELETE_NOT_CONFIRMED') throw error;
      throw unavailable(error);
    }
  }

  function safeDatabaseCode(error) {
    return error && typeof error.code === 'string' && /^[A-Z0-9]{5}$/.test(error.code)
      ? error.code
      : 'UNKNOWN';
  }

  return { list, create, review, clearOwn };
}

module.exports = { createSupabaseRevisionStore };
