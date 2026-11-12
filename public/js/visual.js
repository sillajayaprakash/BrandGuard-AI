/**
 * BrandGuard AI - Visual Brand & Accessibility Checker Frontend Module
 * Handles HTML input, API calls, and rendering of visual/accessibility audit results.
 */

const VisualChecker = (function() {
  let currentPreset = 'apexTech';
  let currentResults = null;
  let activeFilter = 'all';

  const SAMPLE_HTML = {
    compliant: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ApexTech - Enterprise Solutions</title>
  <style>
    :root {
      --color-primary: #2563eb;
      --color-secondary: #7c3aed;
      --color-text: #0f172a;
      --color-background: #ffffff;
      --color-surface: #f8fafc;
      --color-border: #e2e8f0;
      --font-heading: 'Inter', system-ui, sans-serif;
      --font-body: 'Inter', system-ui, sans-serif;
    }
    body { font-family: var(--font-body); color: var(--color-text); background: var(--color-background); line-height: 1.55; }
    h1, h2, h3 { font-family: var(--font-heading); font-weight: 700; }
    .btn-primary { background: var(--color-primary); color: white; padding: 0.75rem 1.5rem; border-radius: 0.375rem; }
    .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 1.5rem; }
  </style>
</head>
<body>
  <header class="card">
    <h1>Welcome to ApexTech</h1>
    <p>Enterprise B2B software solutions built for scale and reliability.</p>
  </header>
  <main>
    <section class="card" aria-labelledby="features-heading">
      <h2 id="features-heading">Key Features</h2>
      <ul>
        <li>99.99% uptime SLA</li>
        <li>SOC 2 Type II certified</li>
        <li>End-to-end encryption</li>
      </ul>
    </section>
    <section class="card" aria-labelledby="cta-heading">
      <h2 id="cta-heading">Get Started</h2>
      <button class="btn-primary" type="button">Start Free Trial</button>
      <img src="/logo-primary.svg" alt="ApexTech primary logo - blue shield with checkmark" width="120" height="40">
    </section>
  </main>
  <form action="/contact" method="POST">
    <label for="email">Email Address</label>
    <input type="email" id="email" name="email" required>
    <button type="submit">Subscribe</button>
  </form>
</body>
</html>`,

    colorViolations: `<!DOCTYPE html>
<html>
<head>
  <style>
    .bad-color { color: #ff0000; background: #ffff00; }
    .unapproved-blue { color: #0066cc; }
    .random-green { background-color: #00ff00; }
    .brand-button { background: #ff6b35; color: white; }
  </style>
</head>
<body>
  <h1 style="color: #ff0000;">Non-compliant colors everywhere</h1>
  <p class="bad-color">Red text on yellow background - fails contrast and not in palette</p>
  <button class="brand-button">Wrong orange button</button>
</body>
</html>`,

    fontViolations: `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: 'Comic Sans MS', cursive; }
    h1 { font-family: 'Papyrus', fantasy; }
    .heading { font-family: 'Impact', sans-serif; }
    code { font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <h1 class="heading">Wrong fonts everywhere</h1>
  <p>This uses Comic Sans and Papyrus - not in brand typography</p>
</body>
</html>`,

    a11yCritical: `<!DOCTYPE html>
<html>
<head>
  <style>
    .low-contrast { color: #999; background: #fff; }
    .missing-label input { border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h1>Main heading</h1>
  <h3>Skipped h2 - heading hierarchy broken</h3>
  <img src="/hero.jpg" alt="">
  <img src="/chart.png">
  <form>
    <div class="missing-label">
      <input type="text" name="email" placeholder="Email">
    </div>
    <button type="submit"></button>
  </form>
</body>
</html>`,

    mixed: `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    :root { --brand-primary: #2563eb; }
    .good { color: var(--brand-primary); font-family: Inter, system-ui, sans-serif; }
    .bad-color { color: #ff0000; }
    .bad-font { font-family: 'Arial Black', sans-serif; }
  </style>
</head>
<body>
  <h1 class="good">Good heading</h1>
  <p class="bad-color">Unapproved red color</p>
  <p class="bad-font">Wrong font family</p>
  <img src="/logo.svg" alt="Company logo">
  <img src="/chart.jpg">
  <form>
    <label for="name">Name</label>
    <input type="text" id="name" name="name">
    <button type="submit">Submit</button>
  </form>
</body>
</html>`
  };

  function init() {
    bindEvents();
    loadPresetPalette();
  }

  function bindEvents() {
    const presetSelect = document.getElementById('presetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        currentPreset = e.target.value;
        loadPresetPalette();
      });
    }

    const sampleSelect = document.getElementById('visualSampleSelect');
    if (sampleSelect) {
      sampleSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value && SAMPLE_HTML[value]) {
          setHtmlInput(SAMPLE_HTML[value]);
          updateStats();
        }
        sampleSelect.value = '';
      });
    }

    const htmlInput = document.getElementById('visualHtmlInput');
    if (htmlInput) {
      htmlInput.addEventListener('input', updateStats);
    }

    const analyzeBtn = document.getElementById('visualAnalyzeBtn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', runVisualAudit);
    }

    const clearBtn = document.getElementById('visualClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        setHtmlInput('');
        updateStats();
        clearResults();
      });
    }

    document.querySelectorAll('.visual-filters .filter-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.visual-filters .filter-chip').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeFilter = e.target.dataset.filter;
        renderResults(currentResults);
      });
    });
  }

  function setHtmlInput(html) {
    const input = document.getElementById('visualHtmlInput');
    if (input) {
      input.value = html;
    }
  }

  function updateStats() {
    const html = document.getElementById('visualHtmlInput').value;
    const charCount = html.length;
    const lineCount = html.split('\n').length;
    const elementCount = (html.match(/</g) || []).length;

    const charEl = document.getElementById('visualCharCount');
    const lineEl = document.getElementById('visualLineCount');
    const elemEl = document.getElementById('visualElementCount');

    if (charEl) charEl.textContent = charCount.toLocaleString();
    if (lineEl) lineEl.textContent = lineCount.toLocaleString();
    if (elemEl) elemEl.textContent = elementCount.toLocaleString();
  }

  function loadPresetPalette() {
    const preset = window.PRESETS?.[currentPreset];
    const container = document.getElementById('paletteSwatches');
    if (!container || !preset?.brandColors) {
      if (container) container.innerHTML = '<p class="palette-empty">No palette defined for this preset.</p>';
      return;
    }

    const colors = preset.brandColors;
    const categories = [
      { key: 'primary', label: 'Primary' },
      { key: 'secondary', label: 'Secondary' },
      { key: 'accent', label: 'Accent' },
      { key: 'background', label: 'Background' },
      { key: 'surface', label: 'Surface' },
      { key: 'text', label: 'Text' },
      { key: 'textMuted', label: 'Text Muted' },
      { key: 'border', label: 'Border' },
      { key: 'error', label: 'Error' },
      { key: 'warning', label: 'Warning' },
      { key: 'success', label: 'Success' },
      { key: 'info', label: 'Info' }
    ];

    container.innerHTML = categories.map(({ key, label }) => {
      const color = colors[key];
      if (!color) return '';
      const textColor = getContrastTextColor(color);
      return `
        <div class="palette-swatch" style="background: ${color};" title="${label}: ${color}">
          <span class="swatch-label" style="color: ${textColor};">${label}</span>
          <span class="swatch-value" style="color: ${textColor};">${color}</span>
        </div>
      `;
    }).join('');
  }

  function getContrastTextColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';
    const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0].repeat(2), 16),
        g: parseInt(clean[1].repeat(2), 16),
        b: parseInt(clean[2].repeat(2), 16)
      };
    }
    if (clean.length === 6) {
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
      };
    }
    return null;
  }

  async function runVisualAudit() {
    const html = document.getElementById('visualHtmlInput').value.trim();
    const analyzeBtn = document.getElementById('visualAnalyzeBtn');

    if (!html) {
      showToast('Please enter HTML markup to audit.', 'warning');
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '🔍 Auditing...';

    try {
      const formData = new FormData();
      formData.append('html', html);
      formData.append('preset', currentPreset);

      const response = await fetch('/api/visual-check', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Visual audit failed');
      }

      currentResults = result;
      renderResults(result);
      updateScoreDisplay(result);
      updateTimestamp();

    } catch (err) {
      console.error('[VisualChecker] Audit error:', err);
      showToast(`Visual audit failed: ${err.message}`, 'error');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = '🔍 Run Visual Audit';
    }
  }

  function renderResults(result) {
    const container = document.getElementById('visualIssuesList');
    if (!container) return;

    const visualFindings = result.visualFindings || [];
    const a11yFindings = result.a11yFindings || [];
    const allFindings = [
      ...visualFindings.map(f => ({ ...f, type: 'visual' })),
      ...a11yFindings.map(f => ({ ...f, type: 'a11y' }))
    ];

    const filtered = activeFilter === 'all'
      ? allFindings
      : allFindings.filter(f => {
          const cat = f.category?.toLowerCase();
          if (activeFilter === 'alt-text') return cat === 'alt-text';
          if (activeFilter === 'contrast') return cat === 'contrast';
          if (activeFilter === 'forms') return cat === 'forms';
          if (activeFilter === 'semantics') return cat === 'semantics';
          return cat === activeFilter;
        });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${activeFilter === 'all' ? '✅' : '🔍'}</span>
          <p class="empty-title">${activeFilter === 'all' ? 'No issues detected' : 'No issues in this category'}</p>
          <p class="empty-subtitle">${activeFilter === 'all'
            ? 'HTML passes all brand visual and accessibility checks.'
            : `No ${activeFilter} issues found.`}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(finding => renderFinding(finding)).join('');
  }

  function renderFinding(finding) {
    const severityClass = `severity-${finding.severity}`;
    const typeIcon = finding.type === 'visual' ? '🎨' : '♿';
    const categoryLabel = finding.categoryLabel || finding.category;
    const engine = finding.engine || (finding.automated === false ? 'ai' : 'deterministic');
    const engineBadge = engine === 'deterministic'
      ? '<span class="engine-badge det">Deterministic</span>'
      : '<span class="engine-badge ai">AI</span>';
    const reviewBadge = finding.needsHumanReview
      ? '<span class="review-badge">⚠️ Human Review</span>'
      : '';

    const detectedHtml = finding.detectedValue ? `
      <div class="finding-detail">
        <span class="detail-label">Detected:</span>
        <code class="detail-value detected">${escapeHtml(finding.detectedValue)}</code>
      </div>
    ` : '';

    const expectedHtml = finding.expectedValue ? `
      <div class="finding-detail">
        <span class="detail-label">Expected:</span>
        <code class="detail-value expected">${escapeHtml(finding.expectedValue)}</code>
      </div>
    ` : '';

    const wcagHtml = finding.wcagCriterion ? `
      <div class="finding-detail wcag-ref">
        <span class="detail-label">WCAG:</span>
        <span class="detail-value">${escapeHtml(finding.wcagCriterion)}</span>
      </div>
    ` : '';

    return `
      <div class="issue-card ${severityClass}" data-category="${finding.category}" data-severity="${finding.severity}">
        <div class="issue-header">
          <div class="issue-main">
            <span class="issue-type-icon">${typeIcon}</span>
            <span class="issue-category">${escapeHtml(categoryLabel)}</span>
            ${engineBadge}
            ${reviewBadge}
            <span class="issue-severity ${severityClass}">${finding.severity.toUpperCase()}</span>
          </div>
          <div class="issue-confidence">Confidence: ${Math.round((finding.confidence || 0.8) * 100)}%</div>
        </div>
        <div class="issue-body">
          <div class="issue-explanation">${escapeHtml(finding.explanation)}</div>
          <div class="issue-suggestion">${escapeHtml(finding.suggestedCorrection)}</div>
          <div class="issue-meta">
            ${detectedHtml}
            ${expectedHtml}
            ${wcagHtml}
            <div class="finding-detail">
              <span class="detail-label">Matched:</span>
              <code class="detail-value">${escapeHtml(finding.matchedText || 'N/A').slice(0, 200)}</code>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function updateScoreDisplay(result) {
    const score = result.score || 0;
    const status = result.status || 'compliant';

    const scoreValue = document.getElementById('visualScoreValue');
    const scoreRing = document.getElementById('visualScoreRing');
    const scoreVerdict = document.getElementById('visualScoreVerdict');
    const scoreExplanation = document.getElementById('visualScoreExplanation');

    if (scoreValue) scoreValue.textContent = score;
    if (scoreRing) scoreRing.style.setProperty('--score-pct', score);
    if (scoreVerdict) {
      scoreVerdict.textContent = status.toUpperCase().replace('_', ' ');
      scoreVerdict.className = `score-verdict status-${status}`;
    }
    if (scoreExplanation) {
      const explanations = {
        compliant: 'HTML satisfies brand visual guidelines and WCAG 2.2 AA criteria.',
        needs_revision: 'Minor visual or accessibility issues detected. Review recommended.',
        non_compliant: 'Significant brand or accessibility violations found. Requires remediation.'
      };
      scoreExplanation.textContent = explanations[status] || explanations.compliant;
    }

    const summary = result.summary || {};
    updateCount('visualCriticalCount', summary.visualCriticalCount || 0);
    updateCount('visualWarningCount', summary.visualWarningCount || 0);
    updateCount('visualAdvisoryCount', summary.visualAdvisoryCount || 0);
    updateCount('a11yCriticalCount', summary.a11yCriticalCount || 0);
    updateCount('a11yWarningCount', summary.a11yWarningCount || 0);
    updateCount('a11yAdvisoryCount', summary.a11yAdvisoryCount || 0);
    updateCount('needsHumanReviewCount', summary.needsHumanReviewCount || 0);
  }

  function updateCount(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateTimestamp() {
    const el = document.getElementById('visualAuditTime');
    if (el) {
      el.textContent = `Last checked: ${new Date().toLocaleString()}`;
    }
  }

  function clearResults() {
    currentResults = null;
    const container = document.getElementById('visualIssuesList');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎨</span>
          <p class="empty-title">No visual audit run yet</p>
          <p class="empty-subtitle">Paste HTML markup on the left and click "Run Visual Audit" to check brand colors, typography, logo usage, and WCAG 2.2 AA accessibility.</p>
        </div>
      `;
    }
    const scoreValue = document.getElementById('visualScoreValue');
    const scoreRing = document.getElementById('visualScoreRing');
    const scoreVerdict = document.getElementById('visualScoreVerdict');
    const scoreExplanation = document.getElementById('visualScoreExplanation');
    const auditTime = document.getElementById('visualAuditTime');

    if (scoreValue) scoreValue.textContent = '100';
    if (scoreRing) scoreRing.style.setProperty('--score-pct', 100);
    if (scoreVerdict) {
      scoreVerdict.textContent = 'COMPLIANT';
      scoreVerdict.className = 'score-verdict status-compliant';
    }
    if (scoreExplanation) scoreExplanation.textContent = 'HTML satisfies brand visual guidelines and WCAG 2.2 AA criteria.';
    if (auditTime) auditTime.textContent = 'Not checked yet';

    ['visualCriticalCount', 'visualWarningCount', 'visualAdvisoryCount', 'a11yCriticalCount', 'a11yWarningCount', 'a11yAdvisoryCount', 'needsHumanReviewCount'].forEach(id => {
      updateCount(id, 0);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  VisualChecker.init();
});

// Export for potential module usage
window.VisualChecker = VisualChecker;