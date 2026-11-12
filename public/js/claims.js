/**
 * Factual Claim Verification UI
 * Isolated from compliance scoring in app.js.
 */
(function () {
  const SAMPLE_PACKS = {
    mixed: {
      content: 'ApexCloud reduced average incident response time by 40% in 2025 and is the world\'s most reliable platform. Twelve million paying customers already depend on it.',
      sources: [
        {
          title: 'ApexCloud Q4 Reliability Report',
          url: 'https://internal.example/reports/q4-reliability',
          text: 'Average incident response time decreased from 50 minutes to 30 minutes in 2025, a 40% reduction. The published availability SLA is 99.9% uptime. Independent ranking as the world\'s most reliable platform is not claimed.'
        },
        {
          title: 'Customer Success Brief (draft notes)',
          url: '',
          text: 'This brief discusses onboarding satisfaction scores. It does not include a global customer headcount.'
        }
      ]
    },
    none: {
      content: 'Our launch campaign is clinically proven to double revenue in 14 days with zero risk.',
      sources: []
    }
  };

  const state = {
    sources: [],
    lastResult: null,
    reviewRecorded: false
  };

  const toastContainer = document.getElementById('toastContainer');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'info', duration = 4000) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span></span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function addSource(prefill) {
    state.sources.push({
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: prefill?.title || '',
      url: prefill?.url || '',
      text: prefill?.text || ''
    });
    renderSources();
  }

  function renderSources() {
    const list = document.getElementById('evidenceSourcesList');
    if (!list) return;
    if (state.sources.length === 0) {
      list.innerHTML = '<p class="empty-subtitle">No evidence sources yet. Add a source and paste the supporting text.</p>';
      return;
    }
    list.innerHTML = state.sources.map((source, index) => `
      <article class="evidence-source-card" data-source-id="${escapeHtml(source.id)}">
        <div class="evidence-source-top">
          <strong>Source ${index + 1}</strong>
          <button type="button" class="btn btn-outline btn-sm" data-remove-source="${escapeHtml(source.id)}">Remove</button>
        </div>
        <div class="form-group">
          <label>Source title</label>
          <input type="text" class="form-control" data-field="title" value="${escapeHtml(source.title)}" placeholder="e.g. Q4 reliability report">
        </div>
        <div class="form-group">
          <label>Reference URL (optional, not fetched)</label>
          <input type="url" class="form-control" data-field="url" value="${escapeHtml(source.url)}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>Pasted source text</label>
          <textarea class="form-control" rows="4" data-field="text" placeholder="Paste the evidence passage here...">${escapeHtml(source.text)}</textarea>
        </div>
      </article>
    `).join('');
  }

  function syncSourcesFromDom() {
    const cards = document.querySelectorAll('.evidence-source-card');
    cards.forEach(card => {
      const id = card.getAttribute('data-source-id');
      const source = state.sources.find(s => s.id === id);
      if (!source) return;
      source.title = card.querySelector('[data-field="title"]')?.value || '';
      source.url = card.querySelector('[data-field="url"]')?.value || '';
      source.text = card.querySelector('[data-field="text"]')?.value || '';
    });
  }

  function resetReview() {
    state.reviewRecorded = false;
    const status = document.getElementById('claimsReviewStatus');
    const confirm = document.getElementById('claimsReviewConfirm');
    const btn = document.getElementById('recordClaimsReviewBtn');
    if (status) status.textContent = 'Review status: pending human review';
    if (confirm) confirm.checked = false;
    if (btn) btn.disabled = true;
  }

  function renderResults(result) {
    const list = document.getElementById('claimsResultsList');
    const timeEl = document.getElementById('claimsAuditTime');
    document.getElementById('claimsTotalCount').textContent = result.summary?.totalClaims ?? 0;
    document.getElementById('claimsSupportedCount').textContent = result.summary?.supportedCount ?? 0;
    document.getElementById('claimsContradictedCount').textContent = result.summary?.contradictedCount ?? 0;
    document.getElementById('claimsUnverifiedCount').textContent = result.summary?.unverifiedCount ?? 0;
    if (timeEl) {
      timeEl.textContent = result.auditTimestamp
        ? `Checked ${new Date(result.auditTimestamp).toLocaleString()}`
        : 'Checked just now';
    }

    const claims = result.claims || [];
    if (!claims.length) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">ℹ️</span>
          <p class="empty-title">No factual claims identified</p>
          <p class="empty-subtitle">Gemini did not extract verifiable factual claims from the submitted copy.</p>
        </div>`;
      return;
    }

    list.innerHTML = claims.map(claim => {
      const cls = claim.classification || 'unverified';
      const excerpt = claim.evidenceExcerpt
        ? `<div class="issue-match-box"><em>Evidence excerpt:</em> ${escapeHtml(claim.evidenceExcerpt)}</div>`
        : '<div class="issue-match-box">No grounded evidence excerpt.</div>';
      const sourceLine = claim.sourceTitle
        ? `<p class="issue-explanation"><strong>Source:</strong> ${escapeHtml(claim.sourceTitle)}${claim.sourceUrl ? ` <span class="claims-url-ref">(ref: ${escapeHtml(claim.sourceUrl)})</span>` : ''}</p>`
        : '<p class="issue-explanation"><strong>Source:</strong> None grounded</p>';
      return `
        <article class="issue-card claim-card claim-${escapeHtml(cls)}">
          <div class="issue-card-header">
            <span class="issue-category-badge badge-${escapeHtml(cls)}">${escapeHtml(claim.classificationLabel || cls)}</span>
            <span class="issue-pos">Human review required</span>
          </div>
          <div class="issue-match-box"><strong>Claim:</strong> ${escapeHtml(claim.claim)}</div>
          <p class="issue-explanation">${escapeHtml(claim.explanation)}</p>
          ${excerpt}
          ${sourceLine}
        </article>`;
    }).join('');
  }

  async function runVerification() {
    const btn = document.getElementById('verifyClaimsBtn');
    const content = document.getElementById('claimsContentInput')?.value || '';
    syncSourcesFromDom();

    if (!content.trim()) {
      showToast('Paste marketing content before verifying claims.', 'warning');
      return;
    }

    const evidenceSources = state.sources.map(s => ({
      title: s.title,
      url: s.url,
      text: s.text
    }));

    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Verifying claims...';
    }

    try {
      const response = await fetch('/api/verify-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, evidenceSources })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        if (data.code === 'MISSING_API_KEY') {
          showToast('GEMINI_API_KEY is not set on the server. Add it to .env to enable claim verification.', 'warning', 6000);
        } else if (data.code === 'TIMEOUT') {
          showToast('Claim verification timed out. Try a shorter passage.', 'error');
        } else {
          showToast(data.error || 'Claim verification failed.', 'error');
        }
        return;
      }
      state.lastResult = data;
      resetReview();
      renderResults(data);
      showToast(`Identified ${data.summary.totalClaims} claim(s). Human review is required.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Network error connecting to claim verification.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✨ Verify Claims with Gemini';
      }
    }
  }

  function loadSample(key) {
    if (key === 'clear') {
      document.getElementById('claimsContentInput').value = '';
      state.sources = [];
      renderSources();
      return;
    }
    const pack = SAMPLE_PACKS[key];
    if (!pack) return;
    document.getElementById('claimsContentInput').value = pack.content;
    state.sources = [];
    pack.sources.forEach(src => addSource(src));
    if (pack.sources.length === 0) renderSources();
  }

  function recordReview() {
    const confirmed = document.getElementById('claimsReviewConfirm')?.checked;
    const name = (document.getElementById('claimsReviewerName')?.value || '').trim();
    const notes = (document.getElementById('claimsReviewNotes')?.value || '').trim();
    if (!state.lastResult) {
      showToast('Run claim verification before recording a review.', 'warning');
      return;
    }
    if (!confirmed || !name) {
      showToast('Enter a reviewer name and confirm you reviewed the AI output.', 'warning');
      return;
    }
    state.reviewRecorded = true;
    const status = document.getElementById('claimsReviewStatus');
    if (status) {
      status.textContent = `Reviewed by ${name} at ${new Date().toLocaleString()}. Notes: ${notes || '(none)'}. This is not a publication approval.`;
    }
    showToast('Human review recorded. Marketing content is still not approved for publication.', 'info', 5000);
  }

  function bindEvents() {
    const list = document.getElementById('evidenceSourcesList');
    document.getElementById('addEvidenceBtn')?.addEventListener('click', () => {
      syncSourcesFromDom();
      if (state.sources.length >= 8) {
        showToast('A maximum of 8 evidence sources is allowed.', 'warning');
        return;
      }
      addSource();
    });
    document.getElementById('verifyClaimsBtn')?.addEventListener('click', runVerification);
    document.getElementById('clearClaimsBtn')?.addEventListener('click', () => {
      document.getElementById('claimsContentInput').value = '';
      document.getElementById('claimsSampleSelect').selectedIndex = 0;
      state.sources = [];
      state.lastResult = null;
      renderSources();
      resetReview();
      document.getElementById('claimsResultsList').innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔎</span>
          <p class="empty-title">No claims verified yet</p>
          <p class="empty-subtitle">Paste marketing content and evidence, then run verification.</p>
        </div>`;
    });
    document.getElementById('claimsSampleSelect')?.addEventListener('change', (e) => {
      loadSample(e.target.value);
    });
    document.getElementById('claimsReviewConfirm')?.addEventListener('change', (e) => {
      const btn = document.getElementById('recordClaimsReviewBtn');
      if (btn) btn.disabled = !e.target.checked;
    });
    document.getElementById('recordClaimsReviewBtn')?.addEventListener('click', recordReview);
    list?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-source]');
      if (!btn) return;
      syncSourcesFromDom();
      const id = btn.getAttribute('data-remove-source');
      state.sources = state.sources.filter(s => s.id !== id);
      renderSources();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('tab-claims')) return;
    addSource();
    bindEvents();
  });
})();
