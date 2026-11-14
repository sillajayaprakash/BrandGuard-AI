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
    analysisContentSnapshot: '',
    authenticatedUser: null,
    authRole: 'user',
    activeRevisionId: null,
    lastAuthenticatedUserId: null,
    appInitialized: false,
    issueFilter: 'all',
    workflowStatus: 'draft', // 'draft', 'approved', 'changes_requested'
    isChecking: false,
    debounceTimer: null
  };

  // DOM Elements Cache
  const dom = {
    authGate: document.getElementById('authGate'),
    appContainer: document.getElementById('app'),
    authMessage: document.getElementById('authMessage'),
    authGateTitle: document.getElementById('authGateTitle'),
    showLoginBtn: document.getElementById('showLoginBtn'),
    showRegisterBtn: document.getElementById('showRegisterBtn'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    authUserControls: document.getElementById('authUserControls'),
    authUserEmail: document.getElementById('authUserEmail'),
    authUserRole: document.getElementById('authUserRole'),
    manageRolesBtn: document.getElementById('manageRolesBtn'),
    roleManagementModal: document.getElementById('roleManagementModal'),
    roleManagementList: document.getElementById('roleManagementList'),
    roleManagementMessage: document.getElementById('roleManagementMessage'),
    refreshRoleUsersBtn: document.getElementById('refreshRoleUsersBtn'),
    closeRoleManagementBtn: document.getElementById('closeRoleManagementBtn'),
    roleManagementDoneBtn: document.getElementById('roleManagementDoneBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    presetSelect: document.getElementById('presetSelect'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    exportReportBtn: document.getElementById('exportReportBtn'),
    exportPdfBtn: document.getElementById('exportPdfBtn'),
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
    saveDraftBtn: document.getElementById('saveDraftBtn'),

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
    approverIdentity: document.getElementById('approverIdentity'),
    approverNotesInput: document.getElementById('approverNotesInput'),

    requestChangesModal: document.getElementById('requestChangesModal'),
    requestChangesForm: document.getElementById('requestChangesForm'),
    closeChangesModalBtn: document.getElementById('closeChangesModalBtn'),
    cancelChangesModalBtn: document.getElementById('cancelChangesModalBtn'),
    reviewerIdentity: document.getElementById('reviewerIdentity'),
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

    // Side-by-Side Revision Comparison
    compareRevA: document.getElementById('compareRevA'),
    compareRevB: document.getElementById('compareRevB'),
    comparisonView: document.getElementById('comparisonView'),

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

  function setAuthMessage(message, type = '') {
    if (!dom.authMessage) return;
    dom.authMessage.textContent = message || '';
    dom.authMessage.className = `auth-message${type ? ` auth-message-${type}` : ''}`;
  }

  async function loadRoleManagementUsers() {
    if (state.authRole !== 'admin') return;
    dom.roleManagementMessage.textContent = 'Loading accounts…';
    dom.roleManagementList.replaceChildren();
    try {
      const response = await window.BrandGuardAuth.apiFetch('/api/admin/users');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load accounts.');
      dom.roleManagementMessage.textContent = `${result.users.length} account(s) shown.`;
      result.users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'role-management-row';
        const identity = document.createElement('span');
        identity.textContent = user.email || user.id;
        const roleSelect = document.createElement('select');
        roleSelect.className = 'form-control role-management-select';
        roleSelect.setAttribute('aria-label', `Role for ${user.email || user.id}`);
        ['user', 'reviewer', 'admin'].forEach(role => {
          const option = document.createElement('option');
          option.value = role;
          option.textContent = role[0].toUpperCase() + role.slice(1);
          option.selected = user.role === role;
          roleSelect.appendChild(option);
        });
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'btn btn-outline btn-sm';
        saveButton.textContent = 'Save Role';
        saveButton.addEventListener('click', async () => {
          saveButton.disabled = true;
          try {
            const updateResponse = await window.BrandGuardAuth.apiFetch('/api/admin/users/role', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, role: roleSelect.value })
            });
            const updateResult = await updateResponse.json();
            if (!updateResponse.ok) throw new Error(updateResult.error || 'Could not update role.');
            dom.roleManagementMessage.textContent = 'Role updated.';
            await loadRoleManagementUsers();
            if (user.id === state.authenticatedUser.id) {
              setAuthenticatedUser(await window.BrandGuardAuth.getVerifiedUser());
            }
          } catch (error) {
            dom.roleManagementMessage.textContent = error.message || 'Could not update role.';
          } finally {
            saveButton.disabled = false;
          }
        });
        row.append(identity, roleSelect, saveButton);
        dom.roleManagementList.appendChild(row);
      });
    } catch (error) {
      dom.roleManagementMessage.textContent = error.message || 'Could not load accounts.';
    }
  }

  function showAuthMode(mode) {
    const registering = mode === 'register';
    dom.loginForm.hidden = registering;
    dom.registerForm.hidden = !registering;
    dom.showLoginBtn.classList.toggle('active', !registering);
    dom.showRegisterBtn.classList.toggle('active', registering);
    dom.showLoginBtn.setAttribute('aria-selected', String(!registering));
    dom.showRegisterBtn.setAttribute('aria-selected', String(registering));
    dom.authGateTitle.textContent = registering ? 'Create your account' : 'Sign in to continue';
    setAuthMessage('');
  }

  function setAuthenticatedUser(user) {
    const previousUser = state.authenticatedUser;
    state.authenticatedUser = user || null;
    const authenticated = Boolean(user && user.id);
    state.authRole = authenticated && ['user', 'reviewer', 'admin'].includes(user.role) ? user.role : 'user';
    if (authenticated) state.lastAuthenticatedUserId = user.id;
    else if (previousUser) state.lastAuthenticatedUserId = previousUser.id;
    dom.authGate.hidden = authenticated;
    dom.appContainer.inert = !authenticated;
    if (authenticated && state.authRole === 'admin') {
      dom.appContainer.dataset.authRole = 'admin';
    } else {
      delete dom.appContainer.dataset.authRole;
    }
    dom.authUserControls.hidden = !authenticated;
    const identity = authenticated ? (user.email || user.id) : 'Sign in required';
    dom.authUserEmail.textContent = authenticated ? identity : '';
    if (dom.authUserRole) dom.authUserRole.textContent = authenticated ? state.authRole : '';
    if (dom.manageRolesBtn) dom.manageRolesBtn.hidden = !authenticated || state.authRole !== 'admin';
    if (dom.approveContentBtn) dom.approveContentBtn.hidden = !authenticated || !['reviewer', 'admin'].includes(state.authRole);
    if (dom.requestChangesBtn) dom.requestChangesBtn.hidden = !authenticated || !['reviewer', 'admin'].includes(state.authRole);
    if (dom.approverIdentity) dom.approverIdentity.textContent = identity;
    if (dom.reviewerIdentity) dom.reviewerIdentity.textContent = identity;
    if (!authenticated && previousUser) {
      dom.contentInput.value = '';
      state.currentText = '';
      state.analysisReport = null;
      state.analysisContentSnapshot = '';
      dom.issuesList.replaceChildren();
    }
  }

  async function establishAuthenticatedUser() {
    const user = await window.BrandGuardAuth.getVerifiedUser();
    const wasAuthenticated = Boolean(state.authenticatedUser);
    const previousUserId = state.lastAuthenticatedUserId;
    setAuthenticatedUser(user);
    if (state.appInitialized && !wasAuthenticated) {
      if (previousUserId && previousUserId !== user.id) {
        await window.BrandHistoryManager.init(user.id);
      }
      if (window.SAMPLE_CONTENTS && window.SAMPLE_CONTENTS.highRisk) {
        dom.contentInput.value = window.SAMPLE_CONTENTS.highRisk.content;
      }
      state.analysisReport = null;
      state.analysisContentSnapshot = '';
      setWorkflowStatus('draft');
      updateTextStats(dom.contentInput.value);
      updateBadges();
      if (state.activeTab === 'history') renderHistoryList();
      runAnalysis(true);
    }
    startAuthenticatedApp();
  }

  function registerAuthListeners() {
    dom.showLoginBtn.addEventListener('click', () => showAuthMode('login'));
    dom.showRegisterBtn.addEventListener('click', () => showAuthMode('register'));

    dom.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = dom.loginForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setAuthMessage('Signing in…');
      try {
        const result = await window.BrandGuardAuth.signIn(dom.loginEmail.value, dom.loginPassword.value);
        dom.loginPassword.value = '';
        if (!result.session) {
          setAuthMessage('Sign-in did not return an active session. Confirm your email, then try again.', 'error');
          return;
        }
        await establishAuthenticatedUser();
      } catch (error) {
        setAuthMessage(error.message || 'Sign in failed. Check your email and password.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    dom.registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = dom.registerForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setAuthMessage('Creating your account…');
      try {
        const result = await window.BrandGuardAuth.signUp(dom.registerEmail.value, dom.registerPassword.value);
        dom.registerPassword.value = '';
        if (!result.session) {
          setAuthMessage('Account created. Check your email for the confirmation link, then sign in here.', 'success');
          showAuthMode('login');
          setAuthMessage('Account created. Check your email for the confirmation link, then sign in here.', 'success');
          dom.loginEmail.value = dom.registerEmail.value;
          return;
        }
        await establishAuthenticatedUser();
      } catch (error) {
        setAuthMessage(error.message || 'Registration failed. Check the email and password requirements.', 'error');
      } finally {
        button.disabled = false;
      }
    });

    dom.logoutBtn.addEventListener('click', async () => {
      dom.logoutBtn.disabled = true;
      try {
        await window.BrandGuardAuth.signOut();
        setAuthenticatedUser(null);
        showAuthMode('login');
      } catch {
        showToast('Could not sign out cleanly. Please try again.', 'error');
      } finally {
        dom.logoutBtn.disabled = false;
      }
    });
  }

  function watchAuthStateChanges() {
    window.BrandGuardAuth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setAuthenticatedUser(null);
        return;
      }
      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
        // Keep the Supabase callback synchronous; verify identity after it returns.
        setTimeout(() => {
          establishAuthenticatedUser().catch(() => setAuthenticatedUser(null));
        }, 0);
      }
    });
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
   * Render side-by-side revision comparison using LCS-based diff segments.
   * All revision content is rendered as escaped text nodes — never raw HTML.
   */
  function renderComparison(rev1, rev2, diff1, diff2, identical) {
    if (!dom.comparisonView) return;

    if (identical) {
      dom.comparisonView.innerHTML = `
        <div class="comparison-identical">
          <p>These revisions are identical. No differences detected.</p>
        </div>
      `;
      dom.comparisonView.style.display = 'block';
      return;
    }

    const formatMeta = (rev) => `
      <div class="comparison-meta">
        <div class="comparison-version">v${rev.versionNumber}</div>
        <div class="comparison-title">${escapeHtml(rev.title || 'Untitled')}</div>
        <div class="comparison-meta-sub">
          <span><strong>By:</strong> ${escapeHtml(rev.author || 'Unknown')}</span>
          <span><strong>Date:</strong> ${new Date(rev.timestamp).toLocaleString()}</span>
          <span><strong>Status:</strong> <span class="status-pill status-${rev.status || 'draft'}">${escapeHtml(rev.statusLabel || rev.status || 'Draft')}</span></span>
          <span><strong>Score:</strong> ${rev.score}/100</span>
        </div>
      </div>
    `;

    const buildPanelContent = (segments) => {
      return segments.map(seg => {
        const escaped = escapeHtml(seg.text);
        if (seg.type === 'added') {
          return '<span class="diff-added" title="Added">' + escaped + '</span>';
        }
        if (seg.type === 'removed') {
          return '<span class="diff-removed" title="Removed">' + escaped + '</span>';
        }
        return escaped;
      }).join('');
    };

    const meta1 = formatMeta(rev1);
    const meta2 = formatMeta(rev2);
    const content1 = buildPanelContent(diff1);
    const content2 = buildPanelContent(diff2);

    dom.comparisonView.innerHTML = `
      <div class="comparison-container">
        <div class="comparison-panel panel-a">
          ${meta1}
          <div class="comparison-content"><pre>${content1}</pre></div>
        </div>
        <div class="comparison-panel panel-b">
          ${meta2}
          <div class="comparison-content"><pre>${content2}</pre></div>
        </div>
      </div>
    `;
    dom.comparisonView.style.display = 'block';
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
        const response = await window.BrandGuardAuth.apiFetch('/api/check', {
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
      state.analysisContentSnapshot = text;
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
      const response = await window.BrandGuardAuth.apiFetch('/api/ai-check', {
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
      state.analysisContentSnapshot = text;
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

      appendFindingComments(card, issue);

      dom.issuesList.appendChild(card);
    });
  }

  function getFindingCommentId(issue) {
    return JSON.stringify([
      String(issue.id || 'finding'),
      String(issue.category || ''),
      String(issue.startIndex == null ? '' : issue.startIndex),
      String(issue.endIndex == null ? '' : issue.endIndex),
      String(issue.matchedText || '')
    ]);
  }

  function appendFindingComments(card, issue) {
    const section = document.createElement('section');
    section.className = 'finding-comments';
    const heading = document.createElement('h4');
    heading.className = 'finding-comments-title';
    heading.textContent = 'Comments';
    const list = document.createElement('ul');
    list.className = 'finding-comments-list';
    list.setAttribute('aria-live', 'polite');
    const form = document.createElement('form');
    form.className = 'finding-comment-form';
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Add a comment';
    const input = document.createElement('textarea');
    input.className = 'finding-comment-input';
    input.rows = 2;
    input.maxLength = 2000;
    input.placeholder = 'Write a note about this finding…';
    inputLabel.appendChild(input);
    const addButton = document.createElement('button');
    addButton.type = 'submit';
    addButton.className = 'btn btn-sm btn-secondary';
    addButton.textContent = 'Add Comment';
    form.append(inputLabel, addButton);
    section.append(heading, list, form);

    const findingId = getFindingCommentId(issue);
    const content = state.analysisContentSnapshot;
    const presetId = state.activePresetKey;
    const userId = state.authenticatedUser.id;

    function renderComments() {
      list.replaceChildren();
      const comments = window.BrandFindingComments.getComments(presetId, findingId, content, userId);
      if (comments.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'finding-comments-empty';
        empty.textContent = 'No comments yet.';
        list.appendChild(empty);
        return;
      }

      comments.forEach(comment => {
        const item = document.createElement('li');
        item.className = 'finding-comment-item';
        const body = document.createElement('p');
        body.className = 'finding-comment-text';
        body.textContent = comment.text;
        const timestamp = document.createElement('time');
        timestamp.className = 'finding-comment-time';
        timestamp.dateTime = comment.createdAt;
        timestamp.textContent = new Date(comment.createdAt).toLocaleString();
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'finding-comment-delete';
        removeButton.textContent = 'Delete';
        removeButton.setAttribute('aria-label', 'Delete comment');
        removeButton.addEventListener('click', () => {
          try {
            window.BrandFindingComments.deleteComment(presetId, findingId, content, comment.id, userId);
            renderComments();
          } catch (error) {
            showToast(error.message || 'Could not delete this comment.', 'error');
          }
        });
        const meta = document.createElement('div');
        meta.className = 'finding-comment-meta';
        meta.append(timestamp, removeButton);
        item.append(body, meta);
        list.appendChild(item);
      });
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!input.value.trim()) {
        showToast('Enter a comment before adding it.', 'warning');
        input.focus();
        return;
      }
      try {
        window.BrandFindingComments.addComment(presetId, findingId, content, input.value, userId);
        input.value = '';
        renderComments();
      } catch (error) {
        showToast(error.message || 'Could not save this comment.', 'error');
      }
    });

    renderComments();
    card.appendChild(section);
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
      window.BrandHistoryManager.init(state.authenticatedUser.id)
        .then(renderHistoryList)
        .catch(error => showToast(error.message || 'Could not refresh revision history.', 'error'));
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
    state.activeRevisionId = null;
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

    // Populate comparison dropdowns with all revisions
    if (typeof populateComparisonDropdowns === 'function') {
      populateComparisonDropdowns();
    }
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
        const comments = window.BrandFindingComments.getComments(
          state.activePresetKey,
          getFindingCommentId(iss),
          state.analysisContentSnapshot,
          state.authenticatedUser.id
        );
        const markdownComments = window.BrandFindingComments.formatMarkdownComments(comments);
        if (markdownComments) md += `${markdownComments}\n`;
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
   * Export the current audit snapshot as a paginated, plain-text PDF report.
   */
  function exportAuditPdf() {
    const report = state.analysisReport;
    if (!report) {
      showToast('Please analyze content before exporting report.', 'warning');
      return;
    }

    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) {
      showToast('PDF export is unavailable because the PDF library did not load. Check your connection and reload the page.', 'error', 6000);
      return;
    }

    try {
      const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 17;
      const contentWidth = pageWidth - margin * 2;
      const bottomLimit = pageHeight - 19;
      let y = margin;

      const cleanText = (value) => String(value == null ? '' : value)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/\r\n?/g, '\n');
      const safeLines = (value, width) => doc.splitTextToSize(cleanText(value), width);
      const addPageIfNeeded = (height) => {
        if (y + height > bottomLimit) {
          doc.addPage();
          y = margin;
          return true;
        }
        return false;
      };
      const drawSectionTitle = (title) => {
        addPageIfNeeded(15);
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(24, 39, 67);
        doc.text(title, margin, y);
        y += 3;
        doc.setDrawColor(218, 226, 238);
        doc.setLineWidth(0.35);
        doc.line(margin, y, pageWidth - margin, y);
        y += 7;
      };
      const drawLabelValue = (label, value) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(86, 100, 122);
        const labelLines = safeLines(label, contentWidth);
        addPageIfNeeded(labelLines.length * 4 + 5);
        doc.text(labelLines, margin, y);
        y += labelLines.length * 4 + 1;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(37, 48, 66);
        const valueLines = safeLines(value || 'Not provided', contentWidth - 2);
        valueLines.forEach((line) => {
          addPageIfNeeded(5);
          doc.text(line, margin + 1, y);
          y += 4.7;
        });
        y += 2;
      };

      const preset = window.PRESETS && window.PRESETS[state.activePresetKey];
      const findings = Array.isArray(report.issues) ? report.issues
        : (Array.isArray(report.findings) ? report.findings : []);
      const summary = report.summary || {};
      const countFor = (severity) => findings.filter(item => item.severity === severity).length;
      const criticalCount = Number.isFinite(summary.criticalCount) ? summary.criticalCount : countFor('critical');
      const warningCount = Number.isFinite(summary.warningCount) ? summary.warningCount : countFor('warning');
      const advisoryCount = Number.isFinite(summary.advisoryCount) ? summary.advisoryCount : countFor('advisory');
      const statusLabels = {
        compliant: 'Compliant',
        needs_revision: 'Revision Recommended',
        non_compliant: 'Non-Compliant'
      };
      const status = statusLabels[report.status] || cleanText(report.status || 'Completed');
      const generatedAt = new Date().toLocaleString();
      const overallSummary = summary.overallAssessment ||
        (report.score < 70 || criticalCount >= 2
          ? 'Critical compliance risks were identified. Revise the content before publication.'
          : (warningCount > 0 || criticalCount > 0 || report.score < 90
            ? 'Review the findings and recommended corrections before publication.'
            : 'No material compliance issues were identified in this audit.'));

      // Report masthead
      doc.setFillColor(24, 39, 67);
      doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(255, 255, 255);
      doc.text('BrandGuard AI', margin + 7, y + 9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(208, 219, 236);
      doc.text('CONTENT GOVERNANCE AUDIT REPORT', margin + 7, y + 15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`${Number(report.score) || 0}/100  |  ${status.toUpperCase()}`, margin + 7, y + 25);
      y += 41;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(37, 48, 66);
      const headerRows = [
        ['Brand / Preset', preset ? preset.name : state.activePresetKey],
        ['Generated', generatedAt]
      ];
      headerRows.forEach(([label, value]) => {
        addPageIfNeeded(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(86, 100, 122);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(37, 48, 66);
        doc.text(safeLines(value, contentWidth - 35), margin + 35, y);
        y += 6;
      });

      drawSectionTitle('Executive Summary');
      const totalFindings = Number.isFinite(summary.totalIssues) ? summary.totalIssues
        : (Number.isFinite(summary.totalFindings) ? summary.totalFindings : findings.length);
      drawLabelValue('Total findings', totalFindings);
      drawLabelValue('Critical violations', criticalCount);
      drawLabelValue('Warnings', warningCount);
      drawLabelValue('Advisory suggestions', advisoryCount);
      drawLabelValue('Overall audit summary', overallSummary);

      drawSectionTitle('Detailed Findings');
      if (findings.length === 0) {
        drawLabelValue('Audit result', 'No findings. Content is compliant with the active brand guidelines.');
      } else {
        findings.forEach((finding, index) => {
          const severity = cleanText(finding.severity || 'advisory').toLowerCase();
          const treatment = severity === 'critical'
            ? { fill: [254, 237, 238], accent: [190, 42, 55], label: 'CRITICAL' }
            : (severity === 'warning'
              ? { fill: [255, 247, 229], accent: [176, 106, 8], label: 'WARNING' }
              : { fill: [235, 244, 255], accent: [42, 103, 168], label: 'ADVISORY' });
          addPageIfNeeded(16);
          doc.setFillColor(...treatment.fill);
          doc.roundedRect(margin, y - 4, contentWidth, 11, 1.5, 1.5, 'F');
          doc.setFillColor(...treatment.accent);
          doc.rect(margin, y - 4, 2, 11, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...treatment.accent);
          doc.text(`${index + 1}. ${treatment.label}`, margin + 5, y + 1);
          doc.setTextColor(37, 48, 66);
          doc.text(safeLines(finding.categoryLabel || finding.category || 'Finding', contentWidth - 45), margin + 31, y + 1);
          y += 12;
          drawLabelValue('Flagged text', finding.matchedText || 'Not provided');
          drawLabelValue('Explanation', finding.explanation || 'No explanation provided.');
          drawLabelValue('Suggested correction', finding.suggestedCorrection || 'No correction suggested.');
          const comments = window.BrandFindingComments.getComments(
            state.activePresetKey,
            getFindingCommentId(finding),
            state.analysisContentSnapshot,
            state.authenticatedUser.id
          );
          const pdfComments = window.BrandFindingComments.formatPlainTextComments(comments);
          if (pdfComments) drawLabelValue('Comments', pdfComments);
          y += 2;
        });
      }

      drawSectionTitle('Original Content Snapshot');
      const originalContent = state.analysisContentSnapshot;
      if (!originalContent) {
        drawLabelValue('Content', '(The audited content was empty.)');
      } else {
        doc.setFont('courier', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(37, 48, 66);
        const lines = safeLines(originalContent, contentWidth - 4);
        lines.forEach((line) => {
          addPageIfNeeded(4.2);
          doc.text(line, margin + 2, y);
          y += 3.8;
        });
      }

      // Apply page totals after content pagination is complete.
      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setDrawColor(218, 226, 238);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(105, 116, 133);
        doc.text('BrandGuard AI  |  Audit Report', margin, pageHeight - 8);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      doc.save(`BrandGuard-Audit-${Date.now()}.pdf`);
      showToast('PDF audit report downloaded successfully!', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('Could not generate the PDF report. Please try again.', 'error');
    }
  }

  /**
   * Event Listeners Registration
   */
  function registerEventListeners() {
    dom.manageRolesBtn.addEventListener('click', async () => {
      if (state.authRole !== 'admin') return;
      dom.roleManagementModal.classList.add('active');
      await loadRoleManagementUsers();
    });
    dom.refreshRoleUsersBtn.addEventListener('click', loadRoleManagementUsers);
    dom.closeRoleManagementBtn.addEventListener('click', () => dom.roleManagementModal.classList.remove('active'));
    dom.roleManagementDoneBtn.addEventListener('click', () => dom.roleManagementModal.classList.remove('active'));

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
      state.activeRevisionId = null;
      updateTextStats(dom.contentInput.value);
      dom.syncStatusIndicator.textContent = 'Typing...';
      dom.syncStatusIndicator.style.color = 'var(--text-muted)';
      setWorkflowStatus('draft');

      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        runAnalysis(false);
      }, 350);
    });

    dom.saveDraftBtn.addEventListener('click', async () => {
      const report = state.analysisReport || {};
      if (!dom.contentInput.value.trim()) {
        showToast('Add content before saving a draft.', 'warning');
        return;
      }
      dom.saveDraftBtn.disabled = true;
      try {
        const revision = await window.BrandHistoryManager.saveDraft({
          presetId: state.activePresetKey,
          content: dom.contentInput.value,
          score: report.score || 100,
          issuesCount: report.summary ? report.summary.totalIssues : 0,
          criticalCount: report.summary ? report.summary.criticalCount : 0,
          warningCount: report.summary ? report.summary.warningCount : 0,
          advisoryCount: report.summary ? report.summary.advisoryCount : 0
        });
        state.activeRevisionId = revision.id;
        renderHistoryList();
        showToast('Draft saved to shared revision history.', 'success');
      } catch (error) {
        showToast(error.message || 'Could not save the draft.', 'error');
      } finally {
        dom.saveDraftBtn.disabled = false;
      }
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
    if (dom.exportPdfBtn) dom.exportPdfBtn.addEventListener('click', exportAuditPdf);

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

    dom.approveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = dom.approveForm.querySelector('button[type="submit"]');
      const notes = dom.approverNotesInput.value.trim();
      const report = state.analysisReport || {};
      submitButton.disabled = true;
      try {
        await window.BrandHistoryManager.addRevisionConfirmed({
          revisionId: state.activeRevisionId,
          presetId: state.activePresetKey,
          content: dom.contentInput.value,
          score: report.score || 100,
          status: 'approved',
          statusLabel: 'Approved',
          issuesCount: report.summary ? report.summary.totalIssues : 0,
          criticalCount: report.summary ? report.summary.criticalCount : 0,
          warningCount: report.summary ? report.summary.warningCount : 0,
          advisoryCount: report.summary ? report.summary.advisoryCount : 0,
          notes: notes || 'Content approved for publication.'
        });
        setWorkflowStatus('approved');
        renderHistoryList();
        dom.approveModal.classList.remove('active');
        updateBadges();
        showToast('Content approved & logged to Revision History!', 'success');
      } catch (error) {
        showToast(error.message || 'Approval was not confirmed by the server.', 'error');
      } finally {
        submitButton.disabled = false;
      }
    });

    // 12. Workflow: Request Changes Modal
    dom.requestChangesBtn.addEventListener('click', () => {
      dom.requestChangesModal.classList.add('active');
    });

    dom.closeChangesModalBtn.addEventListener('click', () => dom.requestChangesModal.classList.remove('active'));
    dom.cancelChangesModalBtn.addEventListener('click', () => dom.requestChangesModal.classList.remove('active'));

    dom.requestChangesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = dom.requestChangesForm.querySelector('button[type="submit"]');
      const feedback = dom.reviewerFeedbackInput.value.trim();
      const report = state.analysisReport || {};
      submitButton.disabled = true;
      try {
        await window.BrandHistoryManager.addRevisionConfirmed({
          revisionId: state.activeRevisionId,
          presetId: state.activePresetKey,
          content: dom.contentInput.value,
          score: report.score || 100,
          status: 'changes_requested',
          statusLabel: 'Changes Requested',
          issuesCount: report.summary ? report.summary.totalIssues : 0,
          criticalCount: report.summary ? report.summary.criticalCount : 0,
          warningCount: report.summary ? report.summary.warningCount : 0,
          advisoryCount: report.summary ? report.summary.advisoryCount : 0,
          notes: feedback
        });
        setWorkflowStatus('changes_requested');
        renderHistoryList();
        dom.requestChangesModal.classList.remove('active');
        updateBadges();
        showToast('Changes requested & logged to Revision History.', 'warning');
      } catch (error) {
        showToast(error.message || 'The change request was not confirmed by the server.', 'error');
      } finally {
        submitButton.disabled = false;
      }
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

    // 19. Side-by-Side Revision Comparison Dropdowns
    function populateComparisonDropdowns() {
      if (!dom.compareRevA || !dom.compareRevB) return;
      const revisions = window.BrandHistoryManager.getRevisions();
      const options = revisions.map(rev =>
        '<option value="' + rev.id + '">v' + rev.versionNumber + ' â€” ' + escapeHtml(rev.title || 'Untitled') + ' (' + new Date(rev.timestamp).toLocaleDateString() + ')</option>'
      ).join('');
      const aHtml = '<option value="">-- Select Revision A --</option>' + options;
      const bHtml = '<option value="">-- Select Revision B --</option>' + options;
      if (dom.compareRevA.innerHTML !== aHtml) dom.compareRevA.innerHTML = aHtml;
      if (dom.compareRevB.innerHTML !== bHtml) dom.compareRevB.innerHTML = bHtml;
    }

    function handleComparisonChange() {
      const idA = dom.compareRevA ? dom.compareRevA.value : '';
      const idB = dom.compareRevB ? dom.compareRevB.value : '';
      if (!idA || !idB || idA === idB) {
        if (dom.comparisonView) {
          dom.comparisonView.style.display = 'none';
          dom.comparisonView.innerHTML = '';
        }
        return;
      }
      const comparison = window.BrandHistoryManager.compareRevisions(idA, idB);
      if (!comparison) {
        if (dom.comparisonView) {
          dom.comparisonView.innerHTML = '<div class="comparison-error"><p>One or both revisions could not be found.</p></div>';
          dom.comparisonView.style.display = 'block';
        }
        return;
      }
      renderComparison(comparison.rev1, comparison.rev2, comparison.diff1, comparison.diff2, comparison.identical);
    }

    if (dom.compareRevA) {
      dom.compareRevA.addEventListener('change', handleComparisonChange);
    }
    if (dom.compareRevB) {
      dom.compareRevB.addEventListener('change', handleComparisonChange);
    }

    function restoreRevision(revId) {
      const rev = window.BrandHistoryManager.getRevisionById(revId);
      if (rev) {
        state.activeRevisionId = rev.id;
        dom.contentInput.value = rev.content;
        setWorkflowStatus(rev.status, rev.statusLabel);
        switchTab('audit');
        runAnalysis(true);
        showToast(`Restored Revision v${rev.versionNumber} into editor.`, 'success');
      }
    }

    // 19. Clear History
    dom.clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('Clear your revision history? Shared drafts owned by other users will remain available to their owners and reviewers.')) {
        try {
          await window.BrandHistoryManager.clearHistory();
          state.activeRevisionId = null;
          renderHistoryList();
          updateBadges();
          showToast('Your revision history was cleared.', 'info');
        } catch (error) {
          showToast(error.message || 'Could not clear revision history.', 'error');
        }
      }
    });
  }

  /**
   * Application Bootstrapper
   */
  async function startAuthenticatedApp() {
    if (state.appInitialized) return;
    state.appInitialized = true;

    // 1. Initialize rules & history
    window.BrandRulesManager.init(state.activePresetKey);
    try {
      await window.BrandHistoryManager.init(state.authenticatedUser.id);
    } catch (error) {
      showToast(error.message || 'Could not load server revision history.', 'error');
    }

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

  async function initApp() {
    registerAuthListeners();
    try {
      const authState = await window.BrandGuardAuth.initialize();
      watchAuthStateChanges();
      if (authState.user) {
        setAuthenticatedUser(authState.user);
        startAuthenticatedApp();
      } else {
        setAuthenticatedUser(null);
        showAuthMode('login');
      }
    } catch (error) {
      setAuthenticatedUser(null);
      setAuthMessage(error.message || 'Authentication is unavailable. Try again later.', 'error');
      dom.loginForm.querySelector('button[type="submit"]').disabled = true;
      dom.registerForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();

