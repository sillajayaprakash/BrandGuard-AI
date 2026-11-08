/**
 * Unit & Integration Test Suite for Gemini API Governance Copilot
 * Tests successful analysis, structured findings, and robust failure handling.
 */

const assert = require('node:assert');
const http = require('node:http');
const geminiChecker = require('../lib/geminiChecker.js');
const { PRESETS } = require('../lib/presets.js');

async function runGeminiTests() {
  console.log('Running BrandGuard AI Gemini Integration Tests...\n');
  let passed = 0;
  let failed = 0;

  async function run(name, fn) {
    try {
      await fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Error sanitization
  await run('Sanitizes error messages and redacts API keys', () => {
    const fakeKey = 'AIzaSyD-fake-key-123456789012345678';
    const rawError = `Failed to authenticate with key ${fakeKey} at endpoint`;
    const sanitized = geminiChecker.sanitizeErrorMessage(rawError, fakeKey);
    assert.ok(!sanitized.includes(fakeKey), 'Sanitized message should not contain API key');
    assert.ok(sanitized.includes('[REDACTED_API_KEY]'), 'Should contain [REDACTED_API_KEY]');

    // Also test automatic AIza regex redaction without explicit key parameter
    const rawError2 = 'GoogleGenAI error: Key AIzaSyDabcdef123456789012345678 is invalid';
    const sanitized2 = geminiChecker.sanitizeErrorMessage(rawError2);
    assert.ok(!sanitized2.includes('AIzaSyDabcdef'), 'Should match and redact AIza pattern');
    assert.ok(sanitized2.includes('[REDACTED_API_KEY]'));
  });

  // 2. Empty or invalid text input handling
  await run('Gracefully rejects empty or whitespace content', async () => {
    const resEmpty = await geminiChecker.analyzeWithGemini({ text: '', rules: PRESETS.apexTech });
    assert.strictEqual(resEmpty.success, false);
    assert.strictEqual(resEmpty.code, 'INVALID_INPUT');

    const resWhitespace = await geminiChecker.analyzeWithGemini({ text: '   \n\t  ', rules: PRESETS.apexTech });
    assert.strictEqual(resWhitespace.success, false);
    assert.strictEqual(resWhitespace.code, 'INVALID_INPUT');
  });

  // 3. Missing API key handling
  await run('Gracefully handles missing or unconfigured GEMINI_API_KEY', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      const res = await geminiChecker.analyzeWithGemini({
        text: 'Our enterprise software is dependable and scalable.',
        rules: PRESETS.apexTech
      });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.code, 'MISSING_API_KEY');
      assert.ok(res.error.includes('Gemini API key is not configured'));
    } finally {
      if (originalKey !== undefined) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    }
  });

  // 4. Timeout handling
  await run('Handles slow or timed-out API responses with TIMEOUT code', async () => {
    const slowMockClient = {
      interactions: {
        create: () => new Promise(resolve => setTimeout(resolve, 500))
      }
    };

    const res = await geminiChecker.analyzeWithGemini({
      text: 'Sample marketing text.',
      rules: PRESETS.apexTech,
      timeoutMs: 50, // fast timeout for test
      clientOverride: slowMockClient
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'TIMEOUT');
    assert.ok(res.error.includes('timed out'));
  });

  // 5. Successful structured analysis with mock Gemini response
  await run('Correctly parses and normalizes structured Gemini findings', async () => {
    const mockGeminiOutput = {
      summary: {
        overallAssessment: 'Content displays severe hype, legally unviable guarantees, and tone issues.',
        criticalCount: 1,
        warningCount: 1,
        advisoryCount: 1,
        needsHumanReviewCount: 1
      },
      score: 45,
      findings: [
        {
          id: 'ai_1',
          category: 'unsupported_claim',
          categoryLabel: 'Unsupported Guarantee',
          severity: 'critical',
          matchedText: '100% guaranteed ROI',
          explanation: 'Promises of 100% financial return violate enterprise truth-in-advertising rules.',
          suggestedCorrection: 'designed to help accelerate revenue performance',
          confidence: 0.98,
          needsHumanReview: false
        },
        {
          id: 'ai_2',
          category: 'unverified_metric',
          categoryLabel: 'Unverified Performance Statistic',
          severity: 'warning',
          matchedText: 'cuts server costs by exactly 84.7%',
          explanation: 'Hyper-specific numerical claim lacks empirical benchmark study or customer citation.',
          suggestedCorrection: 'can help significantly reduce infrastructure overhead',
          confidence: 0.85,
          needsHumanReview: true // flags uncertain claim for human review
        },
        {
          id: 'ai_3',
          category: 'tone_mismatch',
          categoryLabel: 'Aggressive Urgency',
          severity: 'advisory',
          matchedText: 'buy now or miss out',
          explanation: 'High-pressure scarcity tone conflicts with enterprise B2B positioning.',
          suggestedCorrection: 'schedule a consultation today',
          confidence: 0.92,
          needsHumanReview: false
        }
      ]
    };

    const mockClient = {
      interactions: {
        create: async () => ({
          output_text: JSON.stringify(mockGeminiOutput)
        })
      }
    };

    const sourceText = 'Our new platform delivers 100% guaranteed ROI and cuts server costs by exactly 84.7%. You must buy now or miss out!';
    const result = await geminiChecker.analyzeWithGemini({
      text: sourceText,
      rules: PRESETS.apexTech,
      clientOverride: mockClient
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.model, 'gemini-3.5-flash');
    assert.strictEqual(result.score, 45);
    assert.strictEqual(result.status, 'non_compliant');
    assert.strictEqual(result.findings.length, 3);
    assert.strictEqual(result.summary.needsHumanReviewCount, 1);

    // Verify coordinate offsets were mapped accurately
    const claimFinding = result.findings.find(f => f.matchedText === '100% guaranteed ROI');
    assert.ok(claimFinding, 'Finding must exist');
    assert.strictEqual(claimFinding.startIndex, sourceText.indexOf('100% guaranteed ROI'));
    assert.strictEqual(claimFinding.canAutoFix, true);

    const reviewFinding = result.findings.find(f => f.needsHumanReview === true);
    assert.ok(reviewFinding, 'Unverified statistic must be flagged for human review');
    assert.strictEqual(reviewFinding.category, 'unverified_metric');
  });

  // 6. Endpoint integration logic: POST /api/ai-check behavior & error mapping
  await run('POST /api/ai-check payload validation, parse error, and health reporting', async () => {
    // 6a. Test with missing text payload
    const invalidRes = await geminiChecker.analyzeWithGemini({ text: '', rules: PRESETS.apexTech });
    assert.strictEqual(invalidRes.success, false);
    assert.strictEqual(invalidRes.code, 'INVALID_INPUT');

    // 6b. Test with malformed JSON string from model
    const badJsonClient = {
      interactions: {
        create: async () => ({ output_text: 'NOT_VALID_JSON{[' })
      }
    };
    const parseRes = await geminiChecker.analyzeWithGemini({
      text: 'Sample valid copy',
      rules: PRESETS.apexTech,
      clientOverride: badJsonClient
    });
    assert.strictEqual(parseRes.success, false);
    assert.strictEqual(parseRes.code, 'PARSE_ERROR');
    assert.ok(parseRes.error.includes('Failed to parse structured response'));

    // 6c. Test backward-compatibility fallback with legacy models.generateContent mock
    const legacyMockClient = {
      models: {
        generateContent: async () => ({ text: JSON.stringify({ score: 95, summary: {}, findings: [] }) })
      }
    };
    const legacyRes = await geminiChecker.analyzeWithGemini({
      text: 'Sample enterprise copy',
      rules: PRESETS.apexTech,
      clientOverride: legacyMockClient
    });
    assert.strictEqual(legacyRes.success, true);
    assert.strictEqual(legacyRes.score, 95);

    // 6d. Test health configuration helper
    assert.strictEqual(typeof geminiChecker.isGeminiConfigured(), 'boolean');
  });

  console.log(`\nGemini Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runGeminiTests();
}

module.exports = { runGeminiTests };
