/**
 * BrandGuard AI - Revision History & Audit Trail Manager
 * Tracks snapshots, status transitions (Draft, Approved, Changes Requested), and reviewer notes.
 */

window.BrandHistoryManager = (function () {
  let currentUserId = null;
  let revisions = [];

  async function init(userId = currentUserId) {
    currentUserId = userId || null;
    if (!currentUserId || !window.BrandGuardAuth) throw new Error('Sign in to load revision history.');
    const response = await window.BrandGuardAuth.apiFetch('/api/revisions');
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.revisions)) throw new Error(result.error || 'Could not load revision history.');
    revisions = result.revisions;
    return revisions;
  }

  function getRevisions() {
    return revisions;
  }

  async function addRevision(snapshot) {
    const newRev = await saveDraft(snapshot);
    return newRev;
  }

  function getRevisionById(id) {
    return revisions.find(r => r.id === id) || null;
  }

  // Review decisions are recorded on the server before local state is updated.
  async function saveDraft(snapshot) {
    if (!window.BrandGuardAuth) throw new Error('Authentication is unavailable. Please sign in again.');
    const response = await window.BrandGuardAuth.apiFetch('/api/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: snapshot.presetId,
        content: snapshot.content,
        score: snapshot.score,
        status: 'draft',
        issuesCount: snapshot.issuesCount,
        criticalCount: snapshot.criticalCount,
        warningCount: snapshot.warningCount,
        advisoryCount: snapshot.advisoryCount,
        notes: snapshot.notes
      })
    });
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok || !result.revision) {
      throw new Error(result.error || 'The server could not confirm this review action.');
    }
    revisions.unshift(result.revision);
    return result.revision;
  }

  async function addRevisionConfirmed(snapshot) {
    if (!snapshot.revisionId) throw new Error('Select a submitted draft from Revision History before recording a review decision.');
    const response = await window.BrandGuardAuth.apiFetch('/api/revisions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId: snapshot.revisionId, status: snapshot.status, notes: snapshot.notes || '' })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.revision) throw new Error(result.error || 'The server could not confirm this review action.');
    revisions = revisions.map(revision => revision.id === result.revision.id ? result.revision : revision);
    return result.revision;
  }

  async function clearHistory() {
    if (!window.BrandGuardAuth) throw new Error('Authentication is unavailable. Please sign in again.');
    const response = await window.BrandGuardAuth.apiFetch('/api/revisions', { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not clear your revisions.');
    await init(currentUserId);
    const remainingOwned = revisions.filter(revision => revision.ownerId === currentUserId).length;
    console.info('[BrandGuard] Revision history reload completed.', {
      visibleRevisionCount: revisions.length,
      remainingOwnedCount: remainingOwned
    });
    if (remainingOwned > 0) throw new Error('Revision deletion could not be confirmed. Your history was reloaded from the server.');
    return revisions;
  }

  /**
   * Splits text into word tokens, preserving whitespace and punctuation as separate tokens
   * so that diffs are accurate and reconstructable.
   */
  function tokenize(text) {
    if (!text) return [];
    // Match: runs of non-whitespace OR individual whitespace characters
    return text.match(/\S+|\s/g) || [];
  }

  /**
   * Computes the Longest Common Subsequence (LCS) of two token arrays using dynamic programming.
   * Returns a 2D matrix of LCS lengths.
   */
  function lcsMatrix(tokens1, tokens2) {
    const m = tokens1.length;
    const n = tokens2.length;
    const dp = [];
    for (let i = 0; i <= m; i++) {
      dp[i] = [];
      for (let j = 0; j <= n; j++) {
        dp[i][j] = 0;
      }
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (tokens1[i - 1] === tokens2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return dp;
  }

  /**
   * Backtracks through the LCS matrix to produce a word-level diff.
   * Returns an array of segments: { type: 'added' | 'removed' | 'unchanged', text: string }
   */
  function wordDiff(text1, text2) {
    const t1 = tokenize(text1);
    const t2 = tokenize(text2);
    const dp = lcsMatrix(t1, t2);

    const segments = [];
    let i = t1.length;
    let j = t2.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && t1[i - 1] === t2[j - 1]) {
        // Unchanged token (part of LCS)
        segments.unshift({ type: 'unchanged', text: t1[i - 1] });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        // Token removed from text1
        segments.unshift({ type: 'removed', text: t1[i - 1] });
        i--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] > dp[i - 1][j])) {
        // Token added in text2
        segments.unshift({ type: 'added', text: t2[j - 1] });
        j--;
      } else {
        // Safety fallback
        break;
      }
    }

    return segments;
  }

  /**
   * Compares two revisions by ID and returns an LCS-based word-level diff.
   * Returns null if either revision is missing.
   * Result includes metadata and segment arrays for both directions.
   */
  function compareRevisions(id1, id2) {
    const rev1 = getRevisionById(id1);
    const rev2 = getRevisionById(id2);
    if (!rev1 || !rev2) return null;

    const diff1 = wordDiff(rev1.content || '', rev2.content || ''); // rev1 relative to rev2
    const diff2 = wordDiff(rev2.content || '', rev1.content || ''); // rev2 relative to rev1

    const identical = diff1.every(s => s.type === 'unchanged');

    return {
      rev1,
      rev2,
      diff1,
      diff2,
      identical
    };
  }

  return {
    init,
    getRevisions,
    addRevision,
    saveDraft,
    addRevisionConfirmed,
    getRevisionById,
    compareRevisions,
    clearHistory
  };
})();

