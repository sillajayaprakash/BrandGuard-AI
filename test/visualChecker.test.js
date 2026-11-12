/**
 * BrandGuard AI - Visual Checker Tests
 * Automated tests for deterministic visual brand & accessibility checks.
 */

const {
  validateInput,
  runDeterministicChecks,
  extractColorsFromHtml,
  extractFontsFromHtml,
  extractImagesFromHtml,
  extractFormElementsFromHtml,
  extractSemanticIssues,
  contrastRatio,
  hexToRgb,
  getLuminance,
  analyzeVisual,
  MAX_HTML_CHARS
} = require('../lib/visualChecker.js');

const { PRESETS } = require('../lib/presets.js');

const APEX_PRESET = PRESETS.apexTech;
const NOVA_PRESET = PRESETS.novaPay;
const VITA_PRESET = PRESETS.vitaLife;

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`Assertion failed: ${message}\nExpected truthy, got: ${value}`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`Assertion failed: ${message}\nExpected falsy, got: ${value}`);
  }
}

function assertContains(array, item, message = '') {
  if (!array.includes(item)) {
    throw new Error(`Assertion failed: ${message}\nExpected array to contain: ${item}\nArray: ${JSON.stringify(array)}`);
  }
}

function assertArrayLength(array, length, message = '') {
  if (array.length !== length) {
    throw new Error(`Assertion failed: ${message}\nExpected length: ${length}\nActual length: ${array.length}`);
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name}`);
      console.error(`   ${err.message}`);
      failed++;
      failures.push({ name, error: err.message });
    }
  }

  // ===== VALIDATION TESTS =====
  await test('validateInput rejects empty HTML', () => {
    const result = validateInput({ html: '', preset: APEX_PRESET });
    assertEqual(result.ok, false);
    assertEqual(result.code, 'INVALID_INPUT');
  });

  await test('validateInput rejects missing HTML', () => {
    const result = validateInput({ html: null, preset: APEX_PRESET });
    assertEqual(result.ok, false);
  });

  await test('validateInput rejects oversized HTML', () => {
    const largeHtml = 'x'.repeat(MAX_HTML_CHARS + 1);
    const result = validateInput({ html: largeHtml, preset: APEX_PRESET });
    assertEqual(result.ok, false);
    assertEqual(result.code, 'INVALID_INPUT');
  });

  await test('validateInput rejects missing preset', () => {
    const result = validateInput({ html: '<html></html>', preset: null });
    assertEqual(result.ok, false);
  });

  await test('validateInput accepts valid input', () => {
    const result = validateInput({ html: '<html lang="en"><body>Test</body></html>', preset: APEX_PRESET });
    assertEqual(result.ok, true);
  });

  // ===== COLOR EXTRACTION TESTS =====
  await test('extractColorsFromHtml finds hex colors', () => {
    const html = '<div style="color: #2563eb; background: #ffffff;">Test</div>';
    const colors = extractColorsFromHtml(html);
    assertContains(colors, '#2563eb');
    assertContains(colors, '#ffffff');
  });

  await test('extractColorsFromHtml finds rgb colors', () => {
    const html = '<div style="color: rgb(37, 99, 235);">Test</div>';
    const colors = extractColorsFromHtml(html);
    assertContains(colors, 'rgb(37, 99, 235)');
  });

  await test('extractColorsFromHtml finds rgba colors', () => {
    const html = '<div style="background: rgba(37, 99, 235, 0.5);">Test</div>';
    const colors = extractColorsFromHtml(html);
    assertContains(colors, 'rgba(37, 99, 235, 0.5)');
  });

  await test('extractColorsFromHtml finds hsl colors', () => {
    const html = '<div style="color: hsl(220, 100%, 50%);">Test</div>';
    const colors = extractColorsFromHtml(html);
    assertContains(colors, 'hsl(220, 100%, 50%)');
  });

  await test('extractColorsFromHtml finds inline styles', () => {
    const html = '<div style="color: #ff0000; border: 1px solid #00ff00;">Test</div>';
    const colors = extractColorsFromHtml(html);
    assertContains(colors, '#ff0000');
    assertContains(colors, '#00ff00');
  });

  await test('extractColorsFromHtml returns unique colors', () => {
    const html = '<div style="color: #2563eb;"><span style="color: #2563eb;">Test</span></div>';
    const colors = extractColorsFromHtml(html);
    assertEqual(colors.length, 1);
  });

  // ===== FONT EXTRACTION TESTS =====
  await test('extractFontsFromHtml finds font families', () => {
    const html = '<div style="font-family: Inter, system-ui, sans-serif;">Test</div>';
    const fonts = extractFontsFromHtml(html);
    assertContains(fonts, 'Inter');
    assertContains(fonts, 'system-ui');
    assertContains(fonts, 'sans-serif');
  });

  await test('extractFontsFromHtml handles quoted font names', () => {
    const html = '<div style="font-family: \'Times New Roman\', Georgia, serif;">Test</div>';
    const fonts = extractFontsFromHtml(html);
    assertContains(fonts, 'Times New Roman');
    assertContains(fonts, 'Georgia');
    assertContains(fonts, 'serif');
  });

  // ===== IMAGE EXTRACTION TESTS =====
  await test('extractImagesFromHtml finds images with alt', () => {
    const html = '<img src="/logo.svg" alt="Company logo">';
    const images = extractImagesFromHtml(html);
    assertEqual(images.length, 1);
    assertEqual(images[0].src, '/logo.svg');
    assertEqual(images[0].alt, 'Company logo');
    assertEqual(images[0].hasAlt, true);
    assertEqual(images[0].emptyAlt, false);
  });

  await test('extractImagesFromHtml finds images with empty alt', () => {
    const html = '<img src="/icon.png" alt="">';
    const images = extractImagesFromHtml(html);
    assertEqual(images[0].hasAlt, true);
    assertEqual(images[0].emptyAlt, true);
  });

  await test('extractImagesFromHtml finds images without alt', () => {
    const html = '<img src="/photo.jpg">';
    const images = extractImagesFromHtml(html);
    assertEqual(images[0].hasAlt, false);
    assertEqual(images[0].emptyAlt, false);
  });

  await test('extractImagesFromHtml finds multiple images', () => {
    const html = '<img src="/a.png" alt="A"><img src="/b.png" alt="B"><img src="/c.png">';
    const images = extractImagesFromHtml(html);
    assertEqual(images.length, 3);
  });

  // ===== FORM ELEMENT EXTRACTION TESTS =====
  await test('extractFormElementsFromHtml finds inputs with labels', () => {
    const html = '<label for="email">Email</label><input type="email" id="email" name="email">';
    const elements = extractFormElementsFromHtml(html);
    assertEqual(elements.length, 1);
    assertEqual(elements[0].tag, 'input');
    assertEqual(elements[0].type, 'email');
    assertEqual(elements[0].hasLabel, true);
    assertEqual(elements[0].hasAriaLabel, false);
  });

  await test('extractFormElementsFromHtml finds inputs with aria-label', () => {
    const html = '<input type="text" aria-label="Search">';
    const elements = extractFormElementsFromHtml(html);
    assertEqual(elements[0].hasAriaLabel, true);
    assertEqual(elements[0].hasLabel, false);
  });

  await test('extractFormElementsFromHtml finds buttons', () => {
    const html = '<button type="submit">Submit</button>';
    const elements = extractFormElementsFromHtml(html);
    assertEqual(elements.length, 1);
    assertEqual(elements[0].tag, 'button');
  });

  await test('extractFormElementsFromHtml finds select and textarea', () => {
    const html = '<select name="country"><option>US</option></select><textarea name="bio"></textarea>';
    const elements = extractFormElementsFromHtml(html);
    assertEqual(elements.length, 2);
    assertEqual(elements[0].tag, 'select');
    assertEqual(elements[1].tag, 'textarea');
  });

  // ===== SEMANTIC ISSUES TESTS =====
  await test('extractSemanticIssues detects heading hierarchy skip', () => {
    const html = '<h1>Main</h1><h3>Sub</h3>';
    const issues = extractSemanticIssues(html);
    assertEqual(issues.length, 2); // heading hierarchy skip + missing main landmark
    const headingIssue = issues.find(f => f.category === 'semantics' && f.explanation.includes('h1 to h3'));
    assertTrue(headingIssue);
    assertEqual(headingIssue.severity, 'warning');
  });

  await test('extractSemanticIssues detects sequential headings', () => {
    const html = '<h1>Main</h1><h2>Sub</h2><h3>Detail</h3>';
    const issues = extractSemanticIssues(html);
    assertEqual(issues.length, 1); // missing main landmark
    assertEqual(issues[0].category, 'semantics');
    assertContains(issues[0].explanation, '<main>');
  });

  await test('extractSemanticIssues detects missing main landmark', () => {
    const html = '<html><body><div>Content</div></body></html>';
    const issues = extractSemanticIssues(html);
    assertEqual(issues.length, 1);
    assertEqual(issues[0].category, 'semantics');
    assertEqual(issues[0].severity, 'advisory');
    assertContains(issues[0].explanation, '<main>');
  });

  await test('extractSemanticIssues passes with main landmark', () => {
    const html = '<html><body><main>Content</main></body></html>';
    const issues = extractSemanticIssues(html);
    assertEqual(issues.length, 0);
  });

  // ===== COLOR UTILITIES TESTS =====
  await test('hexToRgb converts 6-digit hex', () => {
    const rgb = hexToRgb('#2563eb');
    assertEqual(rgb.r, 37);
    assertEqual(rgb.g, 99);
    assertEqual(rgb.b, 235);
  });

  await test('hexToRgb converts 3-digit hex', () => {
    const rgb = hexToRgb('#f00');
    assertEqual(rgb.r, 255);
    assertEqual(rgb.g, 0);
    assertEqual(rgb.b, 0);
  });

  await test('hexToRgb returns null for invalid', () => {
    assertEqual(hexToRgb('invalid'), null);
    assertEqual(hexToRgb('#ggg'), null);
  });

  await test('getLuminance calculates correctly', () => {
    const white = getLuminance(255, 255, 255);
    const black = getLuminance(0, 0, 0);
    assertEqual(white, 1);
    assertEqual(black, 0);
  });

  await test('contrastRatio calculates correctly', () => {
    // Black on white = 21:1
    const ratio = contrastRatio('#000000', '#ffffff');
    assertTrue(ratio >= 20.5 && ratio <= 21.5);

    // White on black = 21:1
    const ratio2 = contrastRatio('#ffffff', '#000000');
    assertTrue(ratio2 >= 20.5 && ratio2 <= 21.5);

    // Same color = 1:1
    const ratio3 = contrastRatio('#2563eb', '#2563eb');
    assertEqual(ratio3, 1);
  });

  await test('contrastRatio returns null for invalid hex', () => {
    assertEqual(contrastRatio('invalid', '#fff'), null);
    assertEqual(contrastRatio('#fff', 'invalid'), null);
  });

  // ===== DETERMINISTIC CHECKS TESTS =====
  await test('runDeterministicChecks flags unapproved colors', () => {
    const html = '<div style="color: #ff0000; background: #ffff00;">Test</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const colorFindings = findings.filter(f => f.category === 'color');
    assertTrue(colorFindings.length >= 2);
    colorFindings.forEach(f => {
      assertEqual(f.severity, 'warning');
      assertEqual(f.engine, 'deterministic');
      assertTrue(f.detectedValue);
      assertTrue(f.expectedValue);
    });
  });

  await test('runDeterministicChecks passes approved colors', () => {
    const html = '<div style="color: #2563eb; background: #ffffff;">Test</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const colorFindings = findings.filter(f => f.category === 'color');
    assertEqual(colorFindings.length, 0);
  });

  await test('runDeterministicChecks flags unapproved fonts', () => {
    const html = '<div style="font-family: \'Comic Sans MS\', cursive;">Test</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const fontFindings = findings.filter(f => f.category === 'typography');
    assertTrue(fontFindings.length >= 1);
    assertEqual(fontFindings[0].severity, 'warning');
    assertEqual(fontFindings[0].engine, 'deterministic');
  });

  await test('runDeterministicChecks passes approved fonts', () => {
    const html = '<div style="font-family: Inter, system-ui, sans-serif;">Test</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const fontFindings = findings.filter(f => f.category === 'typography');
    assertEqual(fontFindings.length, 0);
  });

  await test('runDeterministicChecks passes system fonts', () => {
    const html = '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Test</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const fontFindings = findings.filter(f => f.category === 'typography');
    assertEqual(fontFindings.length, 0);
  });

  await test('runDeterministicChecks flags missing alt text', () => {
    const html = '<img src="/photo.jpg">';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const altFindings = findings.filter(f => f.category === 'alt-text');
    assertEqual(altFindings.length, 1);
    assertEqual(altFindings[0].severity, 'critical');
    assertEqual(altFindings[0].wcagCriterion, '1.1.1 Non-text Content');
    assertEqual(altFindings[0].automated, true);
    assertEqual(altFindings[0].engine, 'deterministic');
  });

  await test('runDeterministicChecks flags empty alt for non-decorative images', () => {
    const html = '<img src="/chart.png" alt="">';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const altFindings = findings.filter(f => f.category === 'alt-text');
    assertEqual(altFindings.length, 1);
    assertEqual(altFindings[0].severity, 'warning');
    assertEqual(altFindings[0].needsHumanReview, true);
    assertEqual(altFindings[0].automated, false);
  });

  await test('runDeterministicChecks passes images with alt', () => {
    const html = '<img src="/logo.svg" alt="Company logo">';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const altFindings = findings.filter(f => f.category === 'alt-text');
    assertEqual(altFindings.length, 0);
  });

  await test('runDeterministicChecks flags missing form labels', () => {
    const html = '<input type="email" name="email" placeholder="Email">';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const formFindings = findings.filter(f => f.category === 'forms');
    assertEqual(formFindings.length, 1);
    assertEqual(formFindings[0].severity, 'critical');
    assertEqual(formFindings[0].wcagCriterion, '1.3.1 Info and Relationships, 3.3.2 Labels or Instructions');
    assertEqual(formFindings[0].automated, true);
  });

  await test('runDeterministicChecks passes form with label', () => {
    const html = '<label for="email">Email</label><input type="email" id="email" name="email">';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const formFindings = findings.filter(f => f.category === 'forms');
    assertEqual(formFindings.length, 0);
  });

  await test('runDeterministicChecks flags missing button accessible name', () => {
    const html = '<button type="submit"></button>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const formFindings = findings.filter(f => f.category === 'forms');
    assertEqual(formFindings.length, 1);
    assertEqual(formFindings[0].severity, 'critical');
    assertEqual(formFindings[0].wcagCriterion, '4.1.2 Name, Role, Value');
  });

  await test('runDeterministicChecks passes button with text', () => {
    const html = '<button type="submit">Submit</button>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const formFindings = findings.filter(f => f.category === 'forms');
    assertEqual(formFindings.length, 0);
  });

  await test('runDeterministicChecks flags missing lang attribute', () => {
    const html = '<html><body>Test</body></html>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const langFindings = findings.filter(f => f.matchedText === '<html>');
    assertEqual(langFindings.length, 1);
    assertEqual(langFindings[0].severity, 'warning');
    assertEqual(langFindings[0].wcagCriterion, '3.1.1 Language of Page');
  });

  await test('runDeterministicChecks passes with lang attribute', () => {
    const html = '<html lang="en"><body>Test</body></html>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const langFindings = findings.filter(f => f.matchedText === '<html>');
    assertEqual(langFindings.length, 0);
  });

  await test('runDeterministicChecks works with different presets', () => {
    const html = '<div style="color: #059669;">Test</div>';
    const findings = runDeterministicChecks(html, NOVA_PRESET);
    const colorFindings = findings.filter(f => f.category === 'color');
    assertEqual(colorFindings.length, 0);
  });

  // ===== INTEGRATION TESTS =====
  await test('analyzeVisual rejects invalid input', async () => {
    const result = await analyzeVisual({ html: '', preset: APEX_PRESET });
    assertEqual(result.success, false);
    assertEqual(result.code, 'INVALID_INPUT');
  });

  await test('analyzeVisual rejects oversized HTML', async () => {
    const largeHtml = 'x'.repeat(MAX_HTML_CHARS + 1);
    const result = await analyzeVisual({ html: largeHtml, preset: APEX_PRESET });
    assertEqual(result.success, false);
    assertEqual(result.code, 'INVALID_INPUT');
  });

  await test('analyzeVisual returns structure for compliant HTML', async () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title><style>:root { --color-primary: #2563eb; } body { font-family: Inter, system-ui, sans-serif; }</style></head>
<body><h1>Test</h1><img src="/logo.svg" alt="Logo"><form><label for="e">Email</label><input id="e" type="email"></form></body></html>`;
    const result = await analyzeVisual({ html, preset: APEX_PRESET });

    if (result.success) {
      assertTrue(typeof result.score === 'number');
      assertTrue(result.score >= 0 && result.score <= 100);
      assertTrue(['compliant', 'needs_revision', 'non_compliant'].includes(result.status));
      assertTrue(Array.isArray(result.visualFindings));
      assertTrue(Array.isArray(result.a11yFindings));
      assertTrue(typeof result.summary === 'object');
      assertTrue(result.summary.visualCriticalCount >= 0);
      assertTrue(result.summary.a11yCriticalCount >= 0);
      assertTrue(result.reviewStatus === 'pending_human_review');
      assertTrue(result.requiresHumanReview === true);
      assertTrue(typeof result.disclaimer === 'string');
      assertTrue(typeof result.auditTimestamp === 'string');
    } else {
      // API key not configured is acceptable in test environment
      assertTrue(['MISSING_API_KEY', 'TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(result.code));
    }
  });

  await test('analyzeVisual detects color violations', async () => {
    const html = '<div style="color: #ff0000;">Red text</div>';
    const result = await analyzeVisual({ html, preset: APEX_PRESET });

    if (result.success) {
      const colorFindings = result.visualFindings.filter(f => f.category === 'color');
      assertTrue(colorFindings.length >= 1);
      assertEqual(colorFindings[0].severity, 'warning');
    }
  });

  await test('analyzeVisual detects accessibility issues', async () => {
    const html = '<img src="/photo.jpg"><input type="text">';
    const result = await analyzeVisual({ html, preset: APEX_PRESET });

    if (result.success) {
      const altFindings = result.a11yFindings.filter(f => f.category === 'alt-text');
      const formFindings = result.a11yFindings.filter(f => f.category === 'forms');
      assertTrue(altFindings.length >= 1);
      assertTrue(formFindings.length >= 1);
      assertEqual(altFindings[0].severity, 'critical');
      assertEqual(formFindings[0].severity, 'critical');
    }
  });

  // ===== PRESETS VALIDATION =====
  await test('all presets have brandColors', () => {
    Object.values(PRESETS).forEach(preset => {
      assertTrue(preset.brandColors);
      assertTrue(typeof preset.brandColors === 'object');
      assertTrue(Object.keys(preset.brandColors).length > 0);
    });
  });

  await test('all presets have brandTypography', () => {
    Object.values(PRESETS).forEach(preset => {
      assertTrue(preset.brandTypography);
      assertTrue(preset.brandTypography.headingFont);
      assertTrue(preset.brandTypography.bodyFont);
      assertTrue(preset.brandTypography.monoFont);
    });
  });

  await test('all presets have brandLogo', () => {
    Object.values(PRESETS).forEach(preset => {
      assertTrue(preset.brandLogo);
      assertTrue(typeof preset.brandLogo.required === 'boolean');
      assertTrue(Array.isArray(preset.brandLogo.allowedVariants));
    });
  });

  await test('brand colors are valid hex format', () => {
    Object.values(PRESETS).forEach(preset => {
      Object.values(preset.brandColors).forEach(color => {
        assertTrue(color.startsWith('#'));
        assertTrue([7, 9].includes(color.length)); // #RRGGBB or #RRGGBBAA
      });
    });
  });

  // ===== CONSTANTS =====
  await test('MAX_HTML_CHARS is defined', () => {
    assertEqual(MAX_HTML_CHARS, 50000);
  });

  // ===== WCAG CONTRAST TESTS ====
  await test('runDeterministicChecks detects failing contrast (normal text below 4.5:1)', () => {
    const html = '<div style="color: #ff0000; background: #ffff00;">Bad contrast</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const contrastFindings = findings.filter(f => f.category === 'contrast' && f.automated === true);
    assertTrue(contrastFindings.length >= 1, 'Expected at least one automated contrast finding');
    const failing = contrastFindings.find(f => f.severity === 'warning' && f.detectedValue && parseFloat(f.detectedValue) < 4.5);
    assertTrue(!!failing, 'Expected a warning-level contrast finding below 4.5:1');
  });

  await test('runDeterministicChecks detects critical contrast (large text below 3:1)', () => {
    const html = '<div style="color: #cccccc; background: #ffffff;">Very low contrast</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const contrastFindings = findings.filter(f => f.category === 'contrast' && f.automated === true);
    assertTrue(contrastFindings.length >= 1, 'Expected at least one automated contrast finding');
    const critical = contrastFindings.find(f => f.severity === 'critical');
    assertTrue(!!critical, 'Expected a critical contrast finding below 3:1');
  });

  await test('runDeterministicChecks passes acceptable contrast (black on white 21:1)', () => {
    const html = '<div style="color: #000000; background: #ffffff;">Good contrast</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const contrastFindings = findings.filter(f => f.category === 'contrast');
    assertEqual(contrastFindings.length, 0, 'Expected no contrast findings for 21:1 ratio');
  });

  await test('runDeterministicChecks does not guess contrast when background undetermined', () => {
    const html = '<div style="color: #2563eb;">Text without background</div>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const contrastFindings = findings.filter(f => f.category === 'contrast');
    assertEqual(contrastFindings.length, 0, 'Expected no contrast findings when background cannot be determined');
  });

  // ===== BRAND LOGO TESTS ====
  await test('runDeterministicChecks flags missing logo reference when required', () => {
    const html = '<html lang="en"><body><h1>No logo here</h1></body></html>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const logoFindings = findings.filter(f => f.category === 'logo');
    assertTrue(logoFindings.length >= 1, 'Expected at least one logo finding');
    const missing = logoFindings.find(f => f.categoryLabel === 'Missing Logo Reference');
    assertTrue(!!missing, 'Expected a Missing Logo Reference finding');
    assertEqual(missing.severity, 'critical');
    assertEqual(missing.needsHumanReview, false);
  });

  await test('runDeterministicChecks flags logo missing alt text', () => {
    const html = '<html lang="en"><body><img src="/logo-primary.svg"></body></html>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const logoFindings = findings.filter(f => f.category === 'logo');
    const missingAlt = logoFindings.find(f => f.categoryLabel === 'Logo Missing Alt Text');
    assertTrue(!!missingAlt, 'Expected a Logo Missing Alt Text finding');
    assertEqual(missingAlt.severity, 'critical');
  });

  await test('runDeterministicChecks does not claim logo visual authenticity', () => {
    const html = '<html lang="en"><body><img src="/logo-primary.svg" alt="Company primary logo"></body></html>';
    const findings = runDeterministicChecks(html, APEX_PRESET);
    const logoFindings = findings.filter(f => f.category === 'logo');
    const authenticClaim = logoFindings.find(f =>
      f.explanation.toLowerCase().includes('authentic') ||
      f.explanation.toLowerCase().includes('matches the official') ||
      f.explanation.toLowerCase().includes('verified logo')
    );
    assertFalse(!!authenticClaim, 'Should not claim logo visual authenticity');
    const reviewFinding = logoFindings.find(f => f.needsHumanReview === true);
    assertTrue(!!reviewFinding, 'Expected a human review finding for logo visual verification');
    assertEqual(reviewFinding.severity, 'advisory');
  });

  await test('runDeterministicChecks skips logo check when not required by preset', () => {
    const html = '<html lang="en"><body><h1>No logo</h1></body></html>';
    const presetNoLogo = { ...APEX_PRESET, brandLogo: { required: false, allowedVariants: [] } };
    const findings = runDeterministicChecks(html, presetNoLogo);
    const logoFindings = findings.filter(f => f.category === 'logo');
    assertEqual(logoFindings.length, 0, 'Expected no logo findings when logo not required');
  });

  // ===== GEMINI FALLBACK TESTS ====
  await test('analyzeVisual returns deterministic findings when Gemini is not configured', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const html = '<html lang="en"><body><div style="color: #ff0000;">Red text</div></body></html>';
      const result = await analyzeVisual({ html, preset: APEX_PRESET });

      assertEqual(result.success, true, 'Expected success=true even without Gemini');
      assertEqual(result.aiReviewUnavailable, true, 'Expected aiReviewUnavailable=true');
      assertTrue(result.aiUnavailableReason.includes('not configured'), 'Expected reason about missing config');
      assertEqual(result.source, 'deterministic', 'Expected source to be deterministic');
      assertEqual(result.model, null, 'Expected model to be null when AI unavailable');
      const colorFindings = result.visualFindings.filter(f => f.category === 'color');
      assertTrue(colorFindings.length >= 1, 'Expected deterministic color findings');
      assertFalse(/completed AI review/i.test(result.disclaimer || ''), 'Should not label as completed AI review');
    } finally {
      if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  await test('analyzeVisual never labels Gemini failure as completed AI review', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await analyzeVisual({
        html: '<html lang="en"><body>Test</body></html>',
        preset: APEX_PRESET
      });

      assertEqual(result.success, true);
      assertEqual(result.aiReviewUnavailable, true);
      assertFalse(/completed AI review/i.test(result.disclaimer || ''), 'Disclaimer must not claim completed AI review');
      assertTrue(/deterministic checks only/i.test(result.disclaimer || ''), 'Disclaimer must indicate deterministic checks only');
    } finally {
      if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  await test('analyzeVisual with mocked Gemini timeout returns deterministic findings', async () => {
    const mockClient = {
      models: {
        generateContent: async () => {
          throw new Error('Request timed out');
        }
      }
    };

    const html = '<html lang="en"><body><div style="color: #ff0000;">Red text</div></body></html>';
    const result = await analyzeVisual({
      html,
      preset: APEX_PRESET,
      clientOverride: mockClient
    });

    assertEqual(result.success, true);
    assertEqual(result.aiReviewUnavailable, true, 'Expected aiReviewUnavailable when Gemini times out');
    assertTrue(result.aiUnavailableReason.includes('timed out'), 'Expected timeout reason');
    const colorFindings = result.visualFindings.filter(f => f.category === 'color');
    assertTrue(colorFindings.length >= 1, 'Expected deterministic color findings');
    assertEqual(result.aiFindingsCount, 0, 'Expected no AI findings when Gemini failed');
  });

  await test('analyzeVisual with mocked Gemini success includes AI findings', async () => {
    const mockClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            summary: {
              overallAssessment: 'AI mock assessment',
              visualCriticalCount: 0,
              visualWarningCount: 0,
              visualAdvisoryCount: 0,
              a11yCriticalCount: 0,
              a11yWarningCount: 0,
              a11yAdvisoryCount: 0,
              needsHumanReviewCount: 0
            },
            score: 95,
            visualFindings: [],
            a11yFindings: []
          })
        })
      }
    };

    const html = '<html lang="en"><body>Test</body></html>';
    const result = await analyzeVisual({
      html,
      preset: APEX_PRESET,
      clientOverride: mockClient
    });

    assertEqual(result.success, true);
    assertEqual(result.aiReviewUnavailable, false, 'Expected aiReviewUnavailable=false when Gemini succeeds');
    assertEqual(result.aiFindingsCount, 0, 'Expected 0 AI findings from empty mock response');
  });

  // ===== SAMPLE HTML TESTS =====
  const SAMPLE_HTML = {
    compliant: `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title><style>:root { --color-primary: #2563eb; } body { font-family: Inter, system-ui, sans-serif; }</style></head>
<body><h1>Test</h1><img src="/logo.svg" alt="Logo"><form><label for="e">Email</label><input id="e" type="email"></form></body></html>`,

    colorViolations: `<div style="color: #ff0000; background: #ffff00;">Bad</div>`,

    fontViolations: `<div style="font-family: 'Comic Sans MS', cursive;">Bad</div>`,

    a11yCritical: `<img src="/x.jpg"><input type="text">`,

    mixed: `<div style="color: #2563eb;">Good</div><div style="color: #ff0000;">Bad color</div><div style="font-family: Arial Black;">Bad font</div><img src="/logo.svg" alt="Logo"><img src="/chart.jpg"><form><label for="n">Name</label><input id="n"></form>`
  };

  await test('compliant sample has minimal issues', async () => {
    const compliantHtml = `<!DOCTYPE html>
<html lang="en">
<head><title>Test</title><style>:root { --color-primary: #2563eb; } body { font-family: Inter, system-ui, sans-serif; }</style></head>
<body><h1>Test</h1><img src="/logo.svg" alt="Logo"><form><label for="e">Email</label><input id="e" type="email"></form></body></html>`;
    const result = await analyzeVisual({ html: compliantHtml, preset: APEX_PRESET });
    if (result.success) {
      assertEqual(result.summary.visualCriticalCount, 0);
      assertEqual(result.summary.a11yCriticalCount, 0);
    }
  });

  await test('colorViolations sample has color warnings', async () => {
    const result = await analyzeVisual({ html: SAMPLE_HTML.colorViolations, preset: APEX_PRESET });
    if (result.success) {
      const colorWarnings = result.visualFindings.filter(f => f.category === 'color' && f.severity === 'warning');
      assertTrue(colorWarnings.length >= 1);
    }
  });

  await test('fontViolations sample has typography warnings', async () => {
    const result = await analyzeVisual({ html: SAMPLE_HTML.fontViolations, preset: APEX_PRESET });
    if (result.success) {
      const fontWarnings = result.visualFindings.filter(f => f.category === 'typography' && f.severity === 'warning');
      assertTrue(fontWarnings.length >= 1);
    }
  });

  await test('a11yCritical sample has critical accessibility issues', async () => {
    const result = await analyzeVisual({ html: SAMPLE_HTML.a11yCritical, preset: APEX_PRESET });
    if (result.success) {
      const a11yCritical = result.a11yFindings.filter(f => f.severity === 'critical');
      assertTrue(a11yCritical.length >= 2); // missing alt + missing label
    }
  });

  await test('mixed sample has multiple issue types', async () => {
    const result = await analyzeVisual({ html: SAMPLE_HTML.mixed, preset: APEX_PRESET });
    if (result.success) {
      assertTrue(result.visualFindings.length >= 2); // color + font
      assertTrue(result.a11yFindings.length >= 2); // alt + form
    }
  });

  // ===== SUMMARY =====
  console.log('\n==========================');
  console.log(`Tests: ${passed} passed, ${failed} failed`);
  console.log('==========================\n');

  if (failed > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});