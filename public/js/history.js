/**
 * BrandGuard AI - Revision History & Audit Trail Manager
 * Tracks snapshots, status transitions (Draft, Approved, Changes Requested), and reviewer notes.
 */

window.BrandHistoryManager = (function () {
  const STORAGE_KEY = 'brandguard_revisions_v1';
  let revisions = [];

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        revisions = JSON.parse(saved);
      } catch {
        revisions = [];
      }
    }

    // If empty, initialize with default baseline snapshot
    if (revisions.length === 0) {
      const baselineText = (window.SAMPLE_CONTENTS && window.SAMPLE_CONTENTS.compliant && window.SAMPLE_CONTENTS.compliant.content) || 
        "ApexTech Announces Next-Generation Enterprise Cloud Governance Suite.\nDesigned for high reliability with a 99.9% availability SLA...";

      revisions = [
        {
          id: 'rev_init',
          versionNumber: 1,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          title: 'Initial Approved Baseline',
          presetId: 'apexTech',
          content: baselineText,
          score: 98,
          status: 'approved',
          statusLabel: 'Approved',
          issuesCount: 0,
          criticalCount: 0,
          warningCount: 0,
          advisoryCount: 0,
          author: 'Compliance Lead (Baseline)',
          notes: 'Standard approved enterprise template.'
        }
      ];
      save();
    }
    return revisions;
  }

  function getRevisions() {
    if (revisions.length === 0) {
      init();
    }
    return revisions;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(revisions));
  }

  /**
   * Records a new revision snapshot
   */
  function addRevision(snapshot) {
    const nextVer = revisions.length > 0 ? (revisions[0].versionNumber || revisions.length) + 1 : 1;
    const newRev = {
      id: `rev_${Date.now()}`,
      versionNumber: nextVer,
      timestamp: new Date().toISOString(),
      title: snapshot.title || `Revision #${nextVer}`,
      presetId: snapshot.presetId || 'apexTech',
      content: snapshot.content || '',
      score: typeof snapshot.score === 'number' ? snapshot.score : 100,
      status: snapshot.status || 'draft',
      statusLabel: snapshot.statusLabel || 'Draft',
      issuesCount: snapshot.issuesCount || 0,
      criticalCount: snapshot.criticalCount || 0,
      warningCount: snapshot.warningCount || 0,
      advisoryCount: snapshot.advisoryCount || 0,
      author: snapshot.author || 'Content Editor',
      notes: snapshot.notes || ''
    };

    revisions.unshift(newRev);
    // Keep max 50 entries
    if (revisions.length > 50) {
      revisions.pop();
    }
    save();

    // Optionally notify backend if server is accessible
    if (window.fetch) {
      fetch('/api/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRev)
      }).catch(() => {
        // Silent fallback to local storage
      });
    }

    return newRev;
  }

  function getRevisionById(id) {
    return revisions.find(r => r.id === id) || null;
  }

  function clearHistory() {
    revisions = [];
    localStorage.removeItem(STORAGE_KEY);
    init();
    return revisions;
  }

  return {
    init,
    getRevisions,
    addRevision,
    getRevisionById,
    clearHistory
  };
})();

