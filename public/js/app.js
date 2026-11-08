/**
 * BrandGuard AI - Main Application Controller
 * Handles UI interactions, live/on-demand auditing, corrections, workflows, and modals.
 */

(function () {
  // Application State
  const state = {
    activeTab: 'audit',
    activePresetKey: 'apexTech',
    currentText: '',
    analysisReport: null,
    issueFilter: 'all',
    workflowStatus: 'draft', // 'draft', 'approved', 'changes_requested'
    isChecking: false,
    debounceTimer: null
  };

  // DOM Elements Cache
  const dom = {
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    presetSelect: document.getElementById('presetSelect'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    exportReportBtn: document.getElementById('exportReportBtn'),
    ruleCountBadge: document.getElementById('ruleCountBadge'),
    revCountBadge: document.getElementById('revCountBadge'),

    // Editor Area
    contentInput: document.getElementById('contentInput'),
    sampleContentSelect: document.getElementById('sampleContentSelect'),
    wordCountDisplay: document.getElementById('wordCountDisplay'),
    charCountDisplay: document.getElementById('charCountDisplay'),
    readingTimeDisplay: document.getElementById('readingTimeDisplay'),
    syncStatusIndicator: document.getElementById('syncStatusIndicator'),
    contentStatusBadge: document.getElementById('contentStatusBadge'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    geminiCheckBtn: document.getElementById('geminiCheckBtn'),
    applyAllFixesBtn: document.getElementById('applyAllFixesBtn'),
    clearContentBtn: document.getElementById('clearContentBtn'),
    copyContentBtn: document.getElementById('copyContentBtn'),
    approveContentBtn: document.getElementById('approveContentBtn'),
    requestChangesBtn: document.getElementById('requestChangesBtn'),

    // Audit Report Area
    scoreRing: document.getElementById('scoreRing'),
    scoreValue: document.getElementById('scoreValue'),
    scoreVerdict: document.getElementById('scoreVerdict'),
    scoreExplanation: document.getElementById('scoreExplanation'),
    auditTimeDisplay: document.getElementById('auditTimeDisplay'),
    countCritical: document.getElementById('countCritical'),
    countWarning: document.getElementById('countWarning'),
    countAdvisory: document.getElementById('countAdvisory'),
    filterChips: document.querySelectorAll('.filter-chip'),
    filterAllCount: document.getElementById('filterAllCount'),
    filterFpCount: document.getElementById('filterFpCount'),
    filterUcCount: document.getElementById('filterUcCount'),
    filterToneCount: document.getElementById('filterToneCount'),
    filterPpCount: document.getElementById('filterPpCount'),
    issuesList: document.getElementById('issuesList'),

    // Rules Tab
    rulesSubtabs: document.querySelectorAll('.rules-subtab'),
    rulesTableViews: document.querySelectorAll('.rules-table-view'),
    forbiddenRulesTableBody: document.getElementById('forbiddenRulesTableBody'),
    claimsRulesTableBody: document.getElementById('claimsRulesTableBody'),
    preferredRulesTableBody: document.getElementById('preferredRulesTableBody'),
    countForbiddenRules: document.getElementById('countForbiddenRules'),
    countClaimsRules: document.getElementById('countClaimsRules'),
    countPreferredRules: document.getElementById('countPreferredRules'),
    toneUrgencyToggle: document.getElementById('toneUrgencyToggle'),
    tonePunctuationToggle: document.getElementById('tonePunctuationToggle'),
    toneSlangToggle: document.getElementById('toneSlangToggle'),
    toneAllCapsToggle: document.getElementById('toneAllCapsToggle'),
    addRuleBtn: document.getElementById('addRuleBtn'),
    resetRulesBtn: document.getElementById('resetRulesBtn'),

    // History Tab
    revisionsList: document.getElementById('revisionsList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    // Guidelines Tab
    guidelinePresetTitle: document.getElementById('guidelinePresetTitle'),
    guidelinePresetDesc: document.getElementById('guidelinePresetDesc'),
    guidelineTargetTone: document.getElementById('guidelineTargetTone'),
    guidelineDoList: document.getElementById('guidelineDoList'),
    guidelineDontList: document.getElementById('guidelineDontList'),

    // Modals
    ruleModal: document.getElementById('ruleModal'),
    ruleForm: document.getElementById('ruleForm'),
    closeRuleModalBtn: document.getElementById('closeRuleModalBtn'),
    cancelRuleModalBtn: document.getElementById('cancelRuleModalBtn'),
    ruleCategoryInput: document.getElementById('ruleCategoryInput'),
    ruleTargetInput: document.getElementById('ruleTargetInput'),
    ruleSeverityInput: document.getElementById('ruleSeverityInput'),
    ruleExplanationInput: document.getElementById('ruleExplanationInput'),
    ruleReplacementInput: document.getElementById('ruleReplacementInput'),

    approveModal: document.getElementById('approveModal'),
    approveForm: document.getElementById('approveForm'),
    closeApproveModalBtn: document.getElementById('closeApproveModalBtn'),
    cancelApproveModalBtn: document.getElementById('cancelApproveModalBtn'),
    approverNameInput: document.getElementById('approverNameInput'),
    approverNotesInput: document.getElementById('approverNotesInput'),

    requestChangesModal: document.getElementById('requestChangesModal'),
    requestChangesForm: document.getElementById('requestChangesForm'),
    closeChangesModalBtn: document.getElementById('closeChangesModalBtn'),
    cancelChangesModalBtn: document.getElementById('cancelChangesModalBtn'),
    reviewerNameInput: document.getElementById('reviewerNameInput'),
    reviewerFeedbackInput: document.getElementById('reviewerFeedbackInput'),

    diffModal: document.getElementById('diffModal'),
    diffModalTitle: document.getElementById('diffModalTitle'),
    diffMetadata: document.getElementById('diffMetadata'),
    diffContentDisplay: document.getElementById('diffContentDisplay'),
    diffCompareDisplay: document.getElementById('diffCompareDisplay'),
    snapshotBox: document.getElementById('snapshotBox'),
    compareBox: document.getElementById('compareBox'),
    diffViewSnapshotBtn: document.getElementById('diffViewSnapshotBtn'),
    diffViewCompareBtn: document.getElementById('diffViewCompareBtn'),
    closeDiffModalBtn: document.getElementById('closeDiffModalBtn'),
    closeDiffBtn: document.getElementById('closeDiffBtn'),
    restoreFromDiffBtn: document.getElementById('restoreFromDiffBtn'),

    // KPI Overview Elements
    kpiScoreValue: document.getElementById('kpiScoreValue'),
    kpiScoreVerdict: document.getElementById('kpiScoreVerdict'),
    kpiProgressBarFill: document.getElementById('kpiProgressBarFill'),
    kpiCriticalCount: document.getElementById('kpiCriticalCount'),
    kpiWarningCount: document.getElementById('kpiWarningCount'),
    kpiAdvisoryCount: document.getElementById('kpiAdvisoryCount'),

    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * Helper: Show Toast Notification
   */
  function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Helper: Escape HTML strings to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Helper: Generate simple word-level visual diff between two strings
   */
  function generateWordDiff(snapshotText, currentEditorText) {
    if (snapshotText === currentEditorText) {
      return '<div style="color: var(--text-tertiary); font-style: italic; margin-bottom: 0.75rem;">This snapshot is identical to the current editor text.</div><div>' + escapeHtml(snapshotText) + '</div>';
    }

    const snapTokens = (snapshotText || '').split(/(\s+)/);
    const currTokens = (currentEditorText || '').split(/(\s+)/);

    const snapWordsSet = new Set(snapTokens.filter(t => t.trim()));
    const currWordsSet = new Set(currTokens.filter(t => t.trim()));

    let html = '<div style="margin-bottom: 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--text-tertiary);">SNAPSHOT CONTENT (Red = Missing in current editor):</div><div>';
    for (const token of snapTokens) {
      if (!token.trim()) {
        html += token;
      } else if (!currWordsSet.has(token)) {
        html += `<del>${escapeHtml(token)}</del>`;
      } else {
        html += escapeHtml(token);
      }
    }
    html += '</div>';

    html += '<hr style="margin: 1rem 0; border: none; border-top: 1px dashed var(--border-subtle);">';
    html += '<div style="margin-bottom: 0.5rem; font-size: 0.8rem; font-weight: 700; color: var(--text-tertiary);">CURRENT EDITOR COPY (Green = New additions):</div><div>';
    for (const token of currTokens) {
      if (!token.trim()) {
        html += token;
      } else if (!snapWordsSet.has(token)) {
        html += `<ins>${escapeHtml(token)}</ins>`;
      } else {
        html += escapeHtml(token);
      }
    }
    html += '</div>';

    return html;
  }

  /**
   * Update Text Statistics (Words, Chars, Read Time)
   */
  function updateTextStats(text) {
    const trimmed = (text || '').trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const charCount = (text || '').length;
    const readingTime = Math.max(1, Math.round(wordCount / 200));

    dom.wordCountDisplay.textContent = wordCount.toLocaleString();
    dom.charCountDisplay.textContent = charCount.toLocaleString();
    dom.readingTimeDisplay.textContent = wordCount === 0 ? '0' : readingTime;
  }

  /**
   * Perform Content Analysis (Dual Mode: API or Client-Side Fallback)
   */
  async function runAnalysis(forceImmediate = false) {
    const text = dom.contentInput.value;
    state.currentText = text;
    updateTextStats(text);

    if (state.isChecking && !forceImmediate) return;
    state.isChecking = true;
    dom.syncStatusIndicator.textContent = 'Checking...';
    dom.syncStatusIndicator.style.color = 'var(--primary)';

    const rules = window.BrandRulesManager.getActiveRules();

    try {
      let report = null;

      // Try backend API first; fallback to client-side engine seamlessly
      try {
        const response = await fetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, rules })
        });
        if (response.ok) {
          report = await response.json();
        }
      } catch {
        // Network or offline fallback
      }

      if (!report && window.BrandGuardChecker) {
        report = window.BrandGuardChecker.analyzeContent(text, rules);
      }

      state.analysisReport = report;
      renderReport(report);

      dom.syncStatusIndicator.textContent = 'Rule Audited';
      dom.syncStatusIndicator.style.color = 'var(--success)';
    } catch (err) {
      console.error('Audit failure:', err);
      dom.syncStatusIndicator.textContent = 'Error';
      dom.syncStatusIndicator.style.color = 'var(--critical)';
    } finally {
      state.isChecking = false;
    }
  }

  /**
   * Perform Gemini 3.5 Flash AI Brand Governance Analysis
   */
  async function runGeminiAnalysis() {
    const text = dom.contentInput.value;
    state.currentText = text;
    updateTextStats(text);

    if (!text || text.trim() === '') {
      showToast('Please enter or paste marketing content first.', 'warning');
      return;
    }

    if (state.isChecking) return;
    state.isChecking = true;

    const originalBtnText = dom.geminiCheckBtn ? dom.geminiCheckBtn.innerHTML : '';
    if (dom.geminiCheckBtn) {
      dom.geminiCheckBtn.disabled = true;
      dom.geminiCheckBtn.innerHTML = '⏳ Consulting Gemini...';
    }

    dom.syncStatusIndicator.textContent = 'Calling Gemini 3.5 Flash...';
    dom.syncStatusIndicator.style.color = 'var(--brand-violet)';

    const rules = window.BrandRulesManager.getActiveRules();

    try {
      const response = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          rules,
          presetId: state.activePresetKey
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === 'MISSING_API_KEY') {
          showToast('GEMINI_API_KEY is not set on the server. Add your key to .env file to enable Gemini analysis.', 'warning', 6000);
        } else if (data.code === 'TIMEOUT') {
          showToast('Gemini request timed out. Please try again.', 'error');
        } else {
          showToast(data.error || 'Gemini API analysis failed.', 'error');
        }
        dom.syncStatusIndicator.textContent = 'AI Error';
        dom.syncStatusIndicator.style.color = 'var(--critical)';
        return;
      }

      state.analysisReport = data;
      renderReport(data);

      dom.syncStatusIndicator.textContent = 'AI Audited';
      dom.syncStatusIndicator.style.color = 'var(--brand-violet)';

      const findingsCount = data.findings ? data.findings.length : 0;
      showToast(`Gemini 3.5 Flash audit complete: ${findingsCount} finding(s) identified.`, 'success');
    } catch (err) {
      console.error('Gemini check error:', err);
      showToast('Network error connecting to Gemini API endpoint.', 'error');
      dom.syncStatusIndicator.textContent = 'Network Error';
      dom.syncStatusIndicator.style.color = 'var(--critical)';
    } finally {
      state.isChecking = false;
      if (dom.geminiCheckBtn) {
        dom.geminiCheckBtn.disabled = false;
        dom.geminiCheckBtn.innerHTML = originalBtnText;
      }
    }
  }

  /**
   * Render Audit Report UI (Score Ring, Breakdown, Issue Cards)
   */
  function renderReport(report) {
    if (!report) return;

    const score = report.score;
    const summary = report.summary;

    // 1. Update Score Ring & Number
    dom.scoreValue.textContent = score;
    dom.scoreRing.style.setProperty('--score-pct', score);

    let ringColor = 'var(--success)';
    let verdictText = 'COMPLIANT';
    let explanationText = 'Content complies with brand voice and regulatory policies.';

    if (score < 70 || summary.criticalCount >= 2) {
      ringColor = 'var(--critical)';
      verdictText = 'NON-COMPLIANT';
      explanationText = 'Critical policy violations detected. Content cannot be published without revision.';
    } else if (score < 90 || summary.warningCount > 0 || summary.criticalCount === 1) {
      ringColor = 'var(--warning)';
      verdictText = 'REVISION RECOMMENDED';
      explanationText = 'Moderate guideline breaches or tone inconsistencies identified.';
    }

    dom.scoreRing.style.setProperty('--ring-color', ringColor);
    dom.scoreVerdict.textContent = verdictText;
    dom.scoreVerdict.style.color = ringColor;
    dom.scoreExplanation.textContent = explanationText;

    // 2. Counts
    dom.countCritical.textContent = summary.criticalCount;
    dom.countWarning.textContent = summary.warningCount;
    dom.countAdvisory.textContent = summary.advisoryCount;

    // 2b. Synchronize Executive Overview KPI Bar
    if (dom.kpiScoreValue) dom.kpiScoreValue.textContent = score;
    if (dom.kpiCriticalCount) dom.kpiCriticalCount.textContent = summary.criticalCount;
    if (dom.kpiWarningCount) dom.kpiWarningCount.textContent = summary.warningCount;
    if (dom.kpiAdvisoryCount) dom.kpiAdvisoryCount.textContent = summary.advisoryCount;

    if (dom.kpiScoreVerdict) {
      dom.kpiScoreVerdict.textContent = verdictText;
      dom.kpiScoreVerdict.className = 'kpi-status-tag';
      if (score < 70 || summary.criticalCount >= 2) {
        dom.kpiScoreVerdict.classList.add('status-tag-noncompliant');
      } else if (score < 90 || summary.warningCount > 0 || summary.criticalCount === 1) {
        dom.kpiScoreVerdict.classList.add('status-tag-revision');
      } else {
        dom.kpiScoreVerdict.classList.add('status-tag-compliant');
      }
    }

    if (dom.kpiProgressBarFill) {
      dom.kpiProgressBarFill.style.width = `${Math.max(5, score)}%`;
      if (score < 70 || summary.criticalCount >= 2) {
        dom.kpiProgressBarFill.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
      } else if (score < 90 || summary.warningCount > 0 || summary.criticalCount === 1) {
        dom.kpiProgressBarFill.style.background = 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
      } else {
        dom.kpiProgressBarFill.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
      }
    }

    // 3. Filter Counts
    const fpCount = report.issues.filter(i => i.category === 'forbidden_phrase').length;
    const ucCount = report.issues.filter(i => i.category === 'unsupported_claim').length;
    const toneCount = report.issues.filter(i => i.category === 'tone').length;
    const ppCount = report.issues.filter(i => i.category === 'preferred_phrase').length;

    dom.filterAllCount.textContent = report.issues.length;
    dom.filterFpCount.textContent = fpCount;
    dom.filterUcCount.textContent = ucCount;
    dom.filterToneCount.textContent = toneCount;
    dom.filterPpCount.textContent = ppCount;

    // Timestamp
    const now = new Date();
    dom.auditTimeDisplay.textContent = `Checked at ${now.toLocaleTimeString()}`;

    // Enable/Disable "Apply All Safe Fixes"
    const fixableCount = report.issues.filter(i => i.canAutoFix).length;
    dom.applyAllFixesBtn.disabled = fixableCount === 0;
    dom.applyAllFixesBtn.title = fixableCount > 0
      ? `Auto-fix ${fixableCount} suggested issue${fixableCount > 1 ? 's' : ''}`
      : 'No automatic fixes available';

    // 4. Render Issues List
    renderIssuesList(report.issues);
  }

  /**
   * Render Filtered Issues List
   */
  function renderIssuesList(allIssues) {
    dom.issuesList.innerHTML = '';

    const filtered = state.issueFilter === 'all'
      ? allIssues
      : allIssues.filter(i => i.category === state.issueFilter);

    if (filtered.length === 0) {
      const isFilteredEmpty = allIssues.length > 0;
      dom.issuesList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${isFilteredEmpty ? '🔍' : '🎉'}</span>
          <p class="empty-title">${isFilteredEmpty ? 'No matching issues in this category' : 'No brand guideline violations detected'}</p>
          <p class="empty-subtitle">${isFilteredEmpty ? 'Try selecting "All" to inspect other detected issues.' : 'Your content satisfies all configured brand rules.'}</p>
        </div>
      `;
      return;
    }

    filtered.forEach(issue => {
      const card = document.createElement('div');
      card.className = `issue-card severity-${issue.severity}`;

      const severityBadgeClass = `badge-${issue.severity}`;
      const severityLabel = issue.severity.toUpperCase();

      card.innerHTML = `
        <div class="issue-card-header">
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span class="issue-category-badge ${severityBadgeClass}">
              ${severityLabel} • ${escapeHtml(issue.categoryLabel || issue.category)}
            </span>
            ${issue.needsHumanReview ? '<span class="badge-human-review">⚠️ Needs Human Review</span>' : ''}
            ${typeof issue.confidence === 'number' ? `<span class="badge-confidence">🎯 ${(issue.confidence * 100).toFixed(0)}% Conf</span>` : ''}
            ${issue.engine && issue.engine.includes('gemini') ? '<span class="badge-confidence" style="color: var(--brand-violet); border-color: var(--brand-violet-border);">✨ Gemini AI</span>' : ''}
          </div>
          <span class="issue-pos">Line ${issue.lineNumber}, Col ${issue.columnNumber}</span>
        </div>

        <div class="issue-match-box">
          Flagged text: <span class="matched-snippet">"${escapeHtml(issue.matchedText)}"</span>
        </div>

        <p class="issue-explanation">${escapeHtml(issue.explanation)}</p>

        <div class="issue-correction-row">
          <div class="suggested-box">
            ${issue.suggestedCorrection ? `Suggested: <strong>"${escapeHtml(issue.suggestedCorrection)}"</strong>` : '<em>Manual review advised</em>'}
          </div>
          ${issue.canAutoFix ? `
            <button class="btn-fix" data-issue-id="${issue.id}">
              ✨ Apply Fix
            </button>
          ` : ''}
        </div>
      `;

      // Attach single-fix event listener
      const fixBtn = card.querySelector('.btn-fix');
      if (fixBtn) {
        fixBtn.addEventListener('click', () => applySingleFix(issue));
      }

      dom.issuesList.appendChild(card);
    });
  }

  /**
   * Apply Single Issue Fix
   */
  function applySingleFix(issue) {
    if (!issue || !issue.canAutoFix) return;

    const currentText = dom.contentInput.value;
    let fixedText = currentText;

    if (window.BrandGuardChecker) {
      fixedText = window.BrandGuardChecker.applySingleCorrection(currentText, issue);
    } else {
      // Direct replacement fallback
      fixedText = currentText.slice(0, issue.startIndex) + issue.suggestedCorrection + currentText.slice(issue.endIndex);
    }

    dom.contentInput.value = fixedText;
    setWorkflowStatus('draft');
    showToast(`Applied correction: "${issue.matchedText}" ➔ "${issue.suggestedCorrection}"`, 'success');
    runAnalysis(true);
  }

  /**
   * Apply All Safe Fixes
   */
  function applyAllFixes() {
    if (!state.analysisReport || !state.analysisReport.issues) return;

    const issues = state.analysisReport.issues.filter(i => i.canAutoFix);
    if (issues.length === 0) {
      showToast('No auto-fixable issues detected.', 'warning');
      return;
    }

    const currentText = dom.contentInput.value;
    let fixedText = currentText;

    if (window.BrandGuardChecker) {
      fixedText = window.BrandGuardChecker.applyAllCorrections(currentText, state.analysisReport.issues);
    } else {
      // Reverse order manual replacement
      const sorted = [...issues].sort((a, b) => b.startIndex - a.startIndex);
      for (const item of sorted) {
        fixedText = fixedText.slice(0, item.startIndex) + item.suggestedCorrection + fixedText.slice(item.endIndex);
      }
    }

    dom.contentInput.value = fixedText;
    setWorkflowStatus('draft');
    showToast(`Batch applied ${issues.length} suggested corrections!`, 'success');
    runAnalysis(true);
  }

  /**
   * Workflow Status Badge Management
   */
  function setWorkflowStatus(status, label) {
    state.workflowStatus = status;
    dom.contentStatusBadge.className = 'status-pill';

    if (status === 'approved') {
      dom.contentStatusBadge.classList.add('status-approved');
      dom.contentStatusBadge.textContent = 'Approved';
    } else if (status === 'changes_requested') {
      dom.contentStatusBadge.classList.add('status-changes');
      dom.contentStatusBadge.textContent = 'Changes Requested';
    } else {
      dom.contentStatusBadge.classList.add('status-draft');
      dom.contentStatusBadge.textContent = 'Draft';
    }
  }

  /**
   * Tab Navigation Handler
   */
  function switchTab(tabId) {
    state.activeTab = tabId;

    dom.navTabs.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget);
    });

    dom.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tabId}`);
    });

    if (tabId === 'rules') {
      renderRulesTables();
    } else if (tabId === 'history') {
      renderHistoryList();
    } else if (tabId === 'guidelines') {
      renderGuidelines();
    }
  }

  /**
   * Preset Switcher
   */
  function switchPreset(presetKey) {
    state.activePresetKey = presetKey;
    dom.presetSelect.value = presetKey;
    window.BrandRulesManager.setPreset(presetKey);
    updateBadges();
    renderGuidelines();
    if (state.activeTab === 'rules') {
      renderRulesTables();
    }
    showToast(`Active brand guidelines switched to ${dom.presetSelect.options[dom.presetSelect.selectedIndex].text}`, 'info');
    runAnalysis(true);
  }

  /**
   * Sample Content Loader
   */
  function loadSample(sampleKey) {
    if (sampleKey === 'clear') {
      dom.contentInput.value = '';
      dom.sampleContentSelect.selectedIndex = 0;
      setWorkflowStatus('draft');
      runAnalysis(true);
      showToast('Editor cleared.', 'info');
      return;
    }

    const sample = window.SAMPLE_CONTENTS && window.SAMPLE_CONTENTS[sampleKey];
    if (sample) {
      dom.contentInput.value = sample.content;
      dom.sampleContentSelect.selectedIndex = 0;
      setWorkflowStatus('draft');
      runAnalysis(true);
      showToast(`Loaded sample: "${sample.title}"`, 'info');
    }
  }

  /**
   * Render Brand Rules Configuration Tables
   */
  function renderRulesTables() {
    const rules = window.BrandRulesManager.getActiveRules();
    updateBadges();

    // 1. Forbidden Phrases Table
    dom.forbiddenRulesTableBody.innerHTML = '';
    const forbidden = rules.forbiddenPhrases || [];
    dom.countForbiddenRules.textContent = forbidden.length;

    forbidden.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <label class="switch">
            <input type="checkbox" ${rule.disabled ? '' : 'checked'} data-action="toggle-rule" data-type="forbidden" data-id="${rule.id}">
            <span class="slider round"></span>
          </label>
        </td>
        <td><strong>${escapeHtml(rule.phrase)}</strong></td>
        <td><span class="issue-category-badge badge-${rule.severity}">${rule.severity.toUpperCase()}</span></td>
        <td>${escapeHtml(rule.explanation || '—')}</td>
        <td><code>${escapeHtml(rule.suggested || 'Manual review')}</code></td>
        <td>
          <button class="btn btn-outline btn-sm" data-action="delete-rule" data-type="forbidden" data-id="${rule.id}" title="Delete rule">
            🗑️
          </button>
        </td>
      `;
      dom.forbiddenRulesTableBody.appendChild(tr);
    });

    // 2. Unsupported Claims Table
    dom.claimsRulesTableBody.innerHTML = '';
    const claims = rules.unsupportedClaims || [];
    dom.countClaimsRules.textContent = claims.length;

    claims.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <label class="switch">
            <input type="checkbox" ${rule.disabled ? '' : 'checked'} data-action="toggle-rule" data-type="claims" data-id="${rule.id}">
            <span class="slider round"></span>
          </label>
        </td>
        <td><code>${escapeHtml(rule.pattern)}</code></td>
        <td><span class="issue-category-badge badge-${rule.severity}">${rule.severity.toUpperCase()}</span></td>
        <td>${escapeHtml(rule.explanation || '—')}</td>
        <td><code>${escapeHtml(rule.suggested || 'Substantiate claim')}</code></td>
        <td>
          <button class="btn btn-outline btn-sm" data-action="delete-rule" data-type="claims" data-id="${rule.id}" title="Delete rule">
            🗑️
          </button>
        </td>
      `;
      dom.claimsRulesTableBody.appendChild(tr);
    });

    // 3. Preferred Phrases Table
    dom.preferredRulesTableBody.innerHTML = '';
    const preferred = rules.preferredPhrases || [];
    dom.countPreferredRules.textContent = preferred.length;

    preferred.forEach(rule => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <label class="switch">
            <input type="checkbox" ${rule.disabled ? '' : 'checked'} data-action="toggle-rule" data-type="preferred" data-id="${rule.id}">
            <span class="slider round"></span>
          </label>
        </td>
        <td><s>${escapeHtml(rule.phrase)}</s></td>
        <td><strong style="color: var(--success);">${escapeHtml(rule.preferred)}</strong></td>
        <td>
          <button class="btn btn-outline btn-sm" data-action="delete-rule" data-type="preferred" data-id="${rule.id}" title="Delete rule">
            🗑️
          </button>
        </td>
      `;
      dom.preferredRulesTableBody.appendChild(tr);
    });

    // 4. Tone Settings Toggles
    const tone = rules.toneRules || {};
    dom.toneUrgencyToggle.checked = Boolean(tone.checkAggressiveUrgency);
    dom.tonePunctuationToggle.checked = Boolean(tone.checkExcessivePunctuation);
    dom.toneSlangToggle.checked = Boolean(tone.checkInformalSlang);
    dom.toneAllCapsToggle.checked = Boolean(tone.checkAllCaps);
  }

  /**
   * Render Revision History List
   */
  function renderHistoryList() {
    const revisions = window.BrandHistoryManager.getRevisions();
    updateBadges();

    dom.revisionsList.innerHTML = '';
    if (revisions.length === 0) {
      dom.revisionsList.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📜</span>
          <p class="empty-title">No revisions saved yet</p>
          <p class="empty-subtitle">Approved versions or change requests will automatically create verified snapshots here.</p>
        </div>
      `;
      return;
    }

    revisions.forEach(rev => {
      const card = document.createElement('div');
      card.className = 'revision-card';

      const dateStr = new Date(rev.timestamp).toLocaleString();
      let statusClass = 'status-draft';
      if (rev.status === 'approved') statusClass = 'status-approved';
      else if (rev.status === 'changes_requested') statusClass = 'status-changes';

      card.innerHTML = `
        <div class="rev-info-left">
          <span class="rev-version">v${rev.versionNumber}</span>
          <div class="rev-meta">
            <h4>${escapeHtml(rev.title)} <span class="status-pill ${statusClass}">${escapeHtml(rev.statusLabel || rev.status)}</span></h4>
            <div class="rev-meta-sub">
              <span>By ${escapeHtml(rev.author)}</span> • <span>${dateStr}</span> • 
              <strong>Score: ${rev.score}/100</strong> • <span>${rev.issuesCount} issue${rev.issuesCount === 1 ? '' : 's'}</span>
            </div>
            ${rev.notes ? `<div class="rev-notes">💬 ${escapeHtml(rev.notes)}</div>` : ''}
          </div>
        </div>

        <div class="rev-actions">
          <button class="btn btn-outline btn-sm" data-action="view-diff" data-id="${rev.id}">
            👁️ View Snapshot
          </button>
          <button class="btn btn-primary btn-sm" data-action="restore-rev" data-id="${rev.id}">
            ↩️ Restore
          </button>
        </div>
      `;

      dom.revisionsList.appendChild(card);
    });
  }

  /**
   * Render Guideline Reference Tab
   */
  function renderGuidelines() {
    const preset = window.PRESETS && window.PRESETS[state.activePresetKey];
    if (!preset) return;

    dom.guidelinePresetTitle.textContent = `${preset.name} Guidelines`;
    dom.guidelinePresetDesc.textContent = preset.description;
    dom.guidelineTargetTone.textContent = preset.targetTone;

    // Populate DO and DON'T lists dynamically from preset rules
    dom.guidelineDoList.innerHTML = '';
    dom.guidelineDontList.innerHTML = '';

    const doItems = [
      'Maintain consultative, professional, and respectful brand vocabulary.',
      'Provide empirical evidence or SLA citations for technical reliability.',
      'Use approved preferred terminology across all marketing materials.'
    ];

    if (preset.preferredPhrases) {
      preset.preferredPhrases.slice(0, 3).forEach(pp => {
        doItems.push(`Replace "${pp.phrase}" with preferred term "${pp.preferred}".`);
      });
    }

    doItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      dom.guidelineDoList.appendChild(li);
    });

    const dontItems = [
      'Avoid unsubstantiated superlatives (e.g. "world\'s best", "#1 software").',
      'Never claim 100% guarantees or absolute risk-free operations.',
      'Refrain from aggressive high-pressure urgency or artificial scarcity.'
    ];

    if (preset.forbiddenPhrases) {
      const prohibitedWords = preset.forbiddenPhrases.slice(0, 5).map(f => `"${f.phrase}"`).join(', ');
      dontItems.push(`Do not use prohibited brand words: ${prohibitedWords}.`);
    }

    dontItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      dom.guidelineDontList.appendChild(li);
    });
  }

  /**
   * Update count badges
   */
  function updateBadges() {
    dom.ruleCountBadge.textContent = window.BrandRulesManager.getRuleCount();
    dom.revCountBadge.textContent = window.BrandHistoryManager.getRevisions().length;
  }

  /**
   * Export Audit Report as Markdown
   */
  function exportAuditReport() {
    const report = state.analysisReport;
    if (!report) {
      showToast('Please analyze content before exporting report.', 'warning');
      return;
    }

    const preset = window.PRESETS && window.PRESETS[state.activePresetKey];
    const timestamp = new Date().toLocaleString();

    let md = `# BrandGuard AI - Content Governance Audit Certificate\n\n`;
    md += `**Date:** ${timestamp}\n`;
    md += `**Brand Guideline Preset:** ${preset ? preset.name : state.activePresetKey}\n`;
    md += `**Compliance Score:** ${report.score}/100 (${report.status.toUpperCase()})\n`;
    md += `**Engine:** Rule-Based Governance Engine v1.0 (Deterministic Analysis)\n\n`;
    md += `## Executive Summary\n`;
    md += `- **Total Issues Flagged:** ${report.summary.totalIssues}\n`;
    md += `- **Critical Violations:** ${report.summary.criticalCount}\n`;
    md += `- **Warnings:** ${report.summary.warningCount}\n`;
    md += `- **Style / Advisory Suggestions:** ${report.summary.advisoryCount}\n`;
    md += `- **Word Count:** ${report.summary.wordCount} words\n\n`;

    md += `## Detailed Findings & Remediations\n`;
    if (report.issues.length === 0) {
      md += `*No violations detected. Content is fully compliant with brand guidelines.*\n\n`;
    } else {
      report.issues.forEach((iss, index) => {
        md += `### ${index + 1}. [${iss.severity.toUpperCase()}] ${iss.categoryLabel}\n`;
        md += `- **Flagged Text:** \`${iss.matchedText}\` (Line ${iss.lineNumber}, Col ${iss.columnNumber})\n`;
        md += `- **Policy Rationale:** ${iss.explanation}\n`;
        if (iss.suggestedCorrection) {
          md += `- **Recommended Alternative:** \`${iss.suggestedCorrection}\`\n`;
        }
        md += `\n`;
      });
    }

    md += `## Original Content Snapshot\n\`\`\`\n${dom.contentInput.value}\n\`\`\`\n`;

    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BrandGuard-Audit-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Audit report downloaded successfully!', 'success');
  }

  /**
   * Event Listeners Registration
   */
  function registerEventListeners() {
    // 1. Tab Switching
    dom.navTabs.forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        const targetTab = tabBtn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // 2. Preset Selector
    dom.presetSelect.addEventListener('change', (e) => {
      switchPreset(e.target.value);
    });

    // 3. Sample Content Loader
    dom.sampleContentSelect.addEventListener('change', (e) => {
      loadSample(e.target.value);
    });

    // 4. Content Input Typing & Debounced Checking
    dom.contentInput.addEventListener('input', () => {
      updateTextStats(dom.contentInput.value);
      dom.syncStatusIndicator.textContent = 'Typing...';
      dom.syncStatusIndicator.style.color = 'var(--text-muted)';
      setWorkflowStatus('draft');

      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        runAnalysis(false);
      }, 350);
    });

    // 5. Analyze Button (Deterministic Rule-Based)
    dom.analyzeBtn.addEventListener('click', () => {
      runAnalysis(true);
      showToast('Completed deterministic rule-based audit.', 'info');
    });

    // 5b. Gemini AI Audit Button
    if (dom.geminiCheckBtn) {
      dom.geminiCheckBtn.addEventListener('click', runGeminiAnalysis);
    }

    // 6. Apply All Fixes Button
    dom.applyAllFixesBtn.addEventListener('click', applyAllFixes);

    // 7. Clear Content Button
    dom.clearContentBtn.addEventListener('click', () => {
      if (dom.contentInput.value && confirm('Are you sure you want to clear the editor?')) {
        dom.contentInput.value = '';
        setWorkflowStatus('draft');
        runAnalysis(true);
        showToast('Editor cleared.', 'info');
      }
    });

    // 7b. Copy Content Button
    if (dom.copyContentBtn) {
      dom.copyContentBtn.addEventListener('click', () => {
        const text = dom.contentInput.value;
        if (!text) {
          showToast('Editor is empty, nothing to copy.', 'warning');
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Marketing content copied to clipboard!', 'success');
          }).catch(() => {
            showToast('Content selected for copying.', 'info');
          });
        } else {
          dom.contentInput.select();
          document.execCommand('copy');
          showToast('Marketing content copied to clipboard!', 'success');
        }
      });
    }

    // 8. Filter Chips
    dom.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        dom.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.issueFilter = chip.getAttribute('data-filter');
        if (state.analysisReport) {
          renderIssuesList(state.analysisReport.issues);
        }
      });
    });

    // 9. Export Audit
    dom.exportReportBtn.addEventListener('click', exportAuditReport);

    // 10. Theme Toggle
    dom.themeToggleBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('theme-dark');
      dom.themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem('brandguard_theme', isDark ? 'dark' : 'light');
    });

    // Restore saved theme
    if (localStorage.getItem('brandguard_theme') === 'dark') {
      document.body.classList.add('theme-dark');
      dom.themeToggleBtn.textContent = '☀️';
    }

    // 11. Workflow: Approve Content Modal
    dom.approveContentBtn.addEventListener('click', () => {
      const report = state.analysisReport;
      if (report && report.summary.criticalCount > 0) {
        if (!confirm(`Warning: This content has ${report.summary.criticalCount} critical violation(s). Are you sure you wish to approve?`)) {
          return;
        }
      }
      dom.approveModal.classList.add('active');
    });

    dom.closeApproveModalBtn.addEventListener('click', () => dom.approveModal.classList.remove('active'));
    dom.cancelApproveModalBtn.addEventListener('click', () => dom.approveModal.classList.remove('active'));

    dom.approveForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const approverName = dom.approverNameInput.value.trim() || 'Reviewer';
      const notes = dom.approverNotesInput.value.trim();
      const report = state.analysisReport || {};

      window.BrandHistoryManager.addRevision({
        title: `Approved by ${approverName}`,
        presetId: state.activePresetKey,
        content: dom.contentInput.value,
        score: report.score || 100,
        status: 'approved',
        statusLabel: 'Approved',
        issuesCount: report.summary ? report.summary.totalIssues : 0,
        criticalCount: report.summary ? report.summary.criticalCount : 0,
        warningCount: report.summary ? report.summary.warningCount : 0,
        advisoryCount: report.summary ? report.summary.advisoryCount : 0,
        author: approverName,
        notes: notes || 'Content approved for publication.'
      });

      setWorkflowStatus('approved');
      dom.approveModal.classList.remove('active');
      updateBadges();
      showToast('Content approved & logged to Revision History!', 'success');
    });

    // 12. Workflow: Request Changes Modal
    dom.requestChangesBtn.addEventListener('click', () => {
      dom.requestChangesModal.classList.add('active');
    });

    dom.closeChangesModalBtn.addEventListener('click', () => dom.requestChangesModal.classList.remove('active'));
    dom.cancelChangesModalBtn.addEventListener('click', () => dom.requestChangesModal.classList.remove('active'));

    dom.requestChangesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const reviewerName = dom.reviewerNameInput.value.trim() || 'Auditor';
      const feedback = dom.reviewerFeedbackInput.value.trim();
      const report = state.analysisReport || {};

      window.BrandHistoryManager.addRevision({
        title: `Changes Requested by ${reviewerName}`,
        presetId: state.activePresetKey,
        content: dom.contentInput.value,
        score: report.score || 100,
        status: 'changes_requested',
        statusLabel: 'Changes Requested',
        issuesCount: report.summary ? report.summary.totalIssues : 0,
        criticalCount: report.summary ? report.summary.criticalCount : 0,
        warningCount: report.summary ? report.summary.warningCount : 0,
        advisoryCount: report.summary ? report.summary.advisoryCount : 0,
        author: reviewerName,
        notes: feedback
      });

      setWorkflowStatus('changes_requested');
      dom.requestChangesModal.classList.remove('active');
      updateBadges();
      showToast('Changes requested & logged to Revision History.', 'warning');
    });

    // 13. Rules Tab Sub-Tabs
    dom.rulesSubtabs.forEach(subtab => {
      subtab.addEventListener('click', () => {
        dom.rulesSubtabs.forEach(s => s.classList.remove('active'));
        subtab.classList.add('active');
        const targetView = subtab.getAttribute('data-ruletype');

        dom.rulesTableViews.forEach(view => {
          view.classList.toggle('active', view.id === `rules-view-${targetView}`);
        });
      });
    });

    // 14. Rules Table Event Delegation (Toggle & Delete)
    document.addEventListener('change', (e) => {
      if (e.target && e.target.getAttribute('data-action') === 'toggle-rule') {
        const type = e.target.getAttribute('data-type');
        const id = e.target.getAttribute('data-id');
        window.BrandRulesManager.toggleRule(type, id, !e.target.checked);
        showToast('Rule status updated.', 'info');
        runAnalysis(true);
      }
    });

    document.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-action="delete-rule"]');
      if (deleteBtn) {
        const type = deleteBtn.getAttribute('data-type');
        const id = deleteBtn.getAttribute('data-id');
        if (confirm('Delete this rule?')) {
          window.BrandRulesManager.deleteRule(type, id);
          renderRulesTables();
          showToast('Rule deleted.', 'info');
          runAnalysis(true);
        }
      }
    });

    // 15. Tone Toggles
    const handleToneChange = () => {
      window.BrandRulesManager.updateToneSettings({
        checkAggressiveUrgency: dom.toneUrgencyToggle.checked,
        checkExcessivePunctuation: dom.tonePunctuationToggle.checked,
        checkInformalSlang: dom.toneSlangToggle.checked,
        checkAllCaps: dom.toneAllCapsToggle.checked
      });
      showToast('Tone heuristics updated.', 'info');
      runAnalysis(true);
    };

    dom.toneUrgencyToggle.addEventListener('change', handleToneChange);
    dom.tonePunctuationToggle.addEventListener('change', handleToneChange);
    dom.toneSlangToggle.addEventListener('change', handleToneChange);
    dom.toneAllCapsToggle.addEventListener('change', handleToneChange);

    // 16. Add Rule Modal
    dom.addRuleBtn.addEventListener('click', () => {
      dom.ruleForm.reset();
      dom.ruleModal.classList.add('active');
    });

    dom.closeRuleModalBtn.addEventListener('click', () => dom.ruleModal.classList.remove('active'));
    dom.cancelRuleModalBtn.addEventListener('click', () => dom.ruleModal.classList.remove('active'));

    dom.ruleCategoryInput.addEventListener('change', () => {
      const cat = dom.ruleCategoryInput.value;
      const isPreferred = cat === 'preferred';
      const isClaims = cat === 'claims';

      document.getElementById('ruleSeverityGroup').style.display = isPreferred ? 'none' : 'block';
      document.getElementById('ruleExplanationGroup').style.display = isPreferred ? 'none' : 'block';

      if (isClaims) {
        document.getElementById('ruleTargetLabel').textContent = 'Regex Pattern or Keyword Phrase:';
        document.getElementById('ruleTargetHint').textContent = 'e.g. \\b100%\\s+guaranteed\\b or world\'s best';
      } else {
        document.getElementById('ruleTargetLabel').textContent = isPreferred ? 'Deprecated Term to Avoid:' : 'Forbidden Phrase:';
        document.getElementById('ruleTargetHint').textContent = 'Case-insensitive word match.';
      }
    });

    dom.ruleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const category = dom.ruleCategoryInput.value;
      const target = dom.ruleTargetInput.value.trim();
      const severity = dom.ruleSeverityInput.value;
      const explanation = dom.ruleExplanationInput.value.trim();
      const replacement = dom.ruleReplacementInput.value.trim();

      if (!target) return;

      if (category === 'forbidden') {
        window.BrandRulesManager.addForbiddenPhrase(target, severity, explanation, replacement);
      } else if (category === 'claims') {
        window.BrandRulesManager.addUnsupportedClaim(target, severity, explanation, replacement);
      } else if (category === 'preferred') {
        window.BrandRulesManager.addPreferredPhrase(target, replacement);
      }

      dom.ruleModal.classList.remove('active');
      renderRulesTables();
      updateBadges();
      showToast(`Added new rule for "${target}"`, 'success');
      runAnalysis(true);
    });

    // 17. Reset Rules
    dom.resetRulesBtn.addEventListener('click', () => {
      if (confirm('Reset all brand rules to the default preset guidelines? Custom modifications will be lost.')) {
        window.BrandRulesManager.resetToPresetDefaults();
        renderRulesTables();
        updateBadges();
        showToast('Brand rules restored to preset defaults.', 'info');
        runAnalysis(true);
      }
    });

    // 18. Revisions List Event Delegation (View & Restore)
    document.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-action="view-diff"]');
      if (viewBtn) {
        const revId = viewBtn.getAttribute('data-id');
        const rev = window.BrandHistoryManager.getRevisionById(revId);
        if (rev) {
          dom.diffModalTitle.textContent = `Revision v${rev.versionNumber} — ${rev.title}`;
          dom.diffMetadata.innerHTML = `
            <strong>Status:</strong> ${escapeHtml(rev.statusLabel || rev.status)} • 
            <strong>Author:</strong> ${escapeHtml(rev.author)} • 
            <strong>Score:</strong> ${rev.score}/100 • 
            <strong>Timestamp:</strong> ${new Date(rev.timestamp).toLocaleString()}
            ${rev.notes ? `<br><strong>Notes:</strong> ${escapeHtml(rev.notes)}` : ''}
          `;
          dom.diffContentDisplay.textContent = rev.content;
          if (dom.diffCompareDisplay) {
            dom.diffCompareDisplay.innerHTML = generateWordDiff(rev.content, dom.contentInput.value);
          }
          if (dom.snapshotBox) dom.snapshotBox.style.display = 'block';
          if (dom.compareBox) dom.compareBox.style.display = 'none';
          if (dom.diffViewSnapshotBtn) dom.diffViewSnapshotBtn.className = 'btn btn-sm btn-primary';
          if (dom.diffViewCompareBtn) dom.diffViewCompareBtn.className = 'btn btn-sm btn-outline';

          dom.restoreFromDiffBtn.setAttribute('data-target-id', rev.id);
          dom.diffModal.classList.add('active');
        }
      }

      const restoreBtn = e.target.closest('[data-action="restore-rev"]');
      if (restoreBtn) {
        const revId = restoreBtn.getAttribute('data-id');
        restoreRevision(revId);
      }
    });

    if (dom.diffViewSnapshotBtn) {
      dom.diffViewSnapshotBtn.addEventListener('click', () => {
        dom.diffViewSnapshotBtn.className = 'btn btn-sm btn-primary';
        dom.diffViewCompareBtn.className = 'btn btn-sm btn-outline';
        if (dom.snapshotBox) dom.snapshotBox.style.display = 'block';
        if (dom.compareBox) dom.compareBox.style.display = 'none';
      });
    }

    if (dom.diffViewCompareBtn) {
      dom.diffViewCompareBtn.addEventListener('click', () => {
        dom.diffViewCompareBtn.className = 'btn btn-sm btn-primary';
        dom.diffViewSnapshotBtn.className = 'btn btn-sm btn-outline';
        if (dom.snapshotBox) dom.snapshotBox.style.display = 'none';
        if (dom.compareBox) dom.compareBox.style.display = 'block';
      });
    }

    dom.closeDiffModalBtn.addEventListener('click', () => dom.diffModal.classList.remove('active'));
    dom.closeDiffBtn.addEventListener('click', () => dom.diffModal.classList.remove('active'));

    dom.restoreFromDiffBtn.addEventListener('click', () => {
      const revId = dom.restoreFromDiffBtn.getAttribute('data-target-id');
      if (revId) {
        restoreRevision(revId);
        dom.diffModal.classList.remove('active');
      }
    });

    function restoreRevision(revId) {
      const rev = window.BrandHistoryManager.getRevisionById(revId);
      if (rev) {
        dom.contentInput.value = rev.content;
        setWorkflowStatus(rev.status, rev.statusLabel);
        switchTab('audit');
        runAnalysis(true);
        showToast(`Restored Revision v${rev.versionNumber} into editor.`, 'success');
      }
    }

    // 19. Clear History
    dom.clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all revision history?')) {
        window.BrandHistoryManager.clearHistory();
        renderHistoryList();
        updateBadges();
        showToast('Revision history cleared.', 'info');
      }
    });
  }

  /**
   * Application Bootstrapper
   */
  function initApp() {
    // 1. Initialize rules & history
    window.BrandRulesManager.init(state.activePresetKey);
    window.BrandHistoryManager.init();

    // 2. Set default initial content (High-Risk sample so the user immediately sees the governance checker in action)
    if (window.SAMPLE_CONTENTS && window.SAMPLE_CONTENTS.highRisk) {
      dom.contentInput.value = window.SAMPLE_CONTENTS.highRisk.content;
    }

    // 3. Register listeners
    registerEventListeners();

    // 4. Initial renders
    updateBadges();
    renderGuidelines();
    runAnalysis(true);

    // 5. Query health check to check Gemini status
    if (window.fetch) {
      fetch('/api/health')
        .then(res => res.json())
        .then(data => {
          if (data && data.geminiConfigured) {
            const badge = document.querySelector('.engine-badge');
            if (badge) {
              const modelLabel = data.geminiModel || 'Gemini 3.5 Flash';
              badge.title = `Rule-Based Engine Active • ${modelLabel} Copilot Connected`;
            }
          }
        })
        .catch(() => {});
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

