const { createClient } = require('@supabase/supabase-js');
const { ROLE_NAMES } = require('./authorization.js');

function createSupabaseRoleStore(options = {}) {
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL || '';
  const serviceRoleKey = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const clientFactory = options.clientFactory || createClient;
  let client = null;

  function getClient() {
    if (!supabaseUrl || !serviceRoleKey) {
      const error = new Error('Role authorization is not configured.');
      error.code = 'ROLE_STORE_NOT_CONFIGURED';
      throw error;
    }
    if (!client) {
      client = clientFactory(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
    }
    return client;
  }

  function fail(error) {
    const wrapped = new Error('Role authorization is temporarily unavailable.');
    wrapped.code = 'ROLE_STORE_UNAVAILABLE';
    wrapped.cause = error;
    return wrapped;
  }

  async function getRoleForUser(userId) {
    try {
      const { data, error } = await getClient()
        .from('brandguard_user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw fail(error);
      if (!data) return 'user';
      if (!ROLE_NAMES.includes(data.role)) throw fail(new Error('Invalid role record.'));
      return data.role;
    } catch (error) {
      if (error && error.code === 'ROLE_STORE_NOT_CONFIGURED') throw error;
      if (error && error.code === 'ROLE_STORE_UNAVAILABLE') throw error;
      throw fail(error);
    }
  }

  async function listUsers() {
    try {
      const supabase = getClient();
      const [{ data: authResult, error: authError }, { data: roleRows, error: roleError }] = await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
        supabase.from('brandguard_user_roles').select('user_id,role')
      ]);
      if (authError) throw fail(authError);
      if (roleError) throw fail(roleError);
      if ((roleRows || []).some(row => !ROLE_NAMES.includes(row.role))) {
        throw fail(new Error('Invalid role record in role table.'));
      }
      const rolesById = new Map((roleRows || []).map(row => [row.user_id, row.role]));
      return (authResult.users || []).map(user => ({
        id: user.id,
        email: typeof user.email === 'string' ? user.email : null,
        role: rolesById.get(user.id) || 'user',
        createdAt: user.created_at || null
      }));
    } catch (error) {
      if (error && ['ROLE_STORE_NOT_CONFIGURED', 'ROLE_STORE_UNAVAILABLE'].includes(error.code)) throw error;
      throw fail(error);
    }
  }

  async function assignRole({ userId, role, assignedBy }) {
    if (!ROLE_NAMES.includes(role)) {
      const error = new Error('Role must be user, reviewer, or admin.');
      error.code = 'INVALID_ROLE';
      throw error;
    }
    try {
      const supabase = getClient();
      const { data: targetResult, error: targetError } = await supabase.auth.admin.getUserById(userId);
      if (targetError) throw fail(targetError);
      if (!targetResult || !targetResult.user) {
        const error = new Error('The selected account was not found.');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const { data, error } = await supabase.rpc('brandguard_assign_user_role', {
        p_user_id: userId,
        p_role: role,
        p_assigned_by: assignedBy
      }).single();
      if (error) {
        if (error.message === 'LAST_ADMIN' || error.code === 'LAST_ADMIN') {
          const lastAdmin = new Error('The last administrator cannot be demoted or removed.');
          lastAdmin.code = 'LAST_ADMIN';
          throw lastAdmin;
        }
        if (error.message === 'USER_NOT_FOUND' || error.code === 'P0002' || error.code === '23503') {
          const missingUser = new Error('The selected account was not found.');
          missingUser.code = 'USER_NOT_FOUND';
          throw missingUser;
        }
        if (error.message === 'INVALID_ROLE' || error.code === '22023') {
          const invalidRole = new Error('Role must be user, reviewer, or admin.');
          invalidRole.code = 'INVALID_ROLE';
          throw invalidRole;
        }
        throw fail(error);
      }
      return data;
    } catch (error) {
      if (error && ['INVALID_ROLE', 'USER_NOT_FOUND', 'LAST_ADMIN', 'ROLE_STORE_NOT_CONFIGURED', 'ROLE_STORE_UNAVAILABLE'].includes(error.code)) throw error;
      throw fail(error);
    }
  }

  return { getRoleForUser, listUsers, assignRole };
}

module.exports = { createSupabaseRoleStore };
