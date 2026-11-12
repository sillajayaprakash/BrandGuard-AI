/**
 * Automated tests for Factual Claim Verification.
 * Covers supported, contradicted, unverified, and insufficient-evidence cases.
 * Gemini is mocked; these tests do not call live APIs or fetch URLs.
 */

const assert = require('node:assert');
const claimVerifier = require('../lib/claimVerifier.js');

async function runClaimVerifierTests() {
  console.log('Running BrandGuard AI Factual Claim Verification Tests...\n');
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

  const slaSource = {
    title: 'ApexCloud Q4 Reliability Report',
    url: 'https://internal.example/reports/q4-reliability',
    text: 'Average incident response time decreased from 50 minutes to 30 minutes in 2025, a 40% reduction. The published availability SLA is 99.9% uptime. Independent ranking as the world\'s most reliable platform is not claimed.'
  };

  function mockClient(payload) {
    return {
      interactions: {
        create: async () => ({ output_text: JSON.stringify(payload) })
      }
    };
  }

  await run('Rejects empty marketing content', async () => {
    const res = await claimVerifier.verifyClaims({ content: '   ', evidenceSources: [slaSource] });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'INVALID_INPUT');
  });

  await run('Rejects non-array evidence sources', async () => {
    const res = await claimVerifier.verifyClaims({
      content: 'We reduced response time by 40%.',
      evidenceSources: 'not-an-array'
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'INVALID_INPUT');
  });

  await run('Handles missing GEMINI_API_KEY', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      const res = await claimVerifier.verifyClaims({
        content: 'We reduced response time by 40%.',
        evidenceSources: [slaSource]
      });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.code, 'MISSING_API_KEY');
    } finally {
      if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  await run('Handles Gemini timeout', async () => {
    const slowClient = {
      interactions: {
        create: () => new Promise(resolve => setTimeout(resolve, 400))
      }
    };
    const res = await claimVerifier.verifyClaims({
      content: 'We reduced response time by 40%.',
      evidenceSources: [slaSource],
      timeoutMs: 40,
      clientOverride: slowClient
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'TIMEOUT');
  });

  await run('Classifies a supported claim when evidence contains the cited excerpt', async () => {
    const excerpt = 'Average incident response time decreased from 50 minutes to 30 minutes in 2025, a 40% reduction.';
    const res = await claimVerifier.verifyClaims({
      content: 'ApexCloud reduced average incident response time by 40% in 2025.',
      evidenceSources: [slaSource],
      clientOverride: mockClient({
        claims: [{
          id: 'c1',
          claim: 'ApexCloud reduced average incident response time by 40% in 2025.',
          classification: 'supported',
          explanation: 'The Q4 report states a 40% reduction in incident response time.',
          evidenceExcerpt: excerpt,
          sourceTitle: slaSource.title
        }]
      })
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.autoApproved, false);
    assert.strictEqual(res.requiresHumanReview, true);
    assert.strictEqual(res.reviewStatus, 'pending_human_review');
    assert.strictEqual(res.urlsFetched, false);
    assert.strictEqual(res.claims.length, 1);
    assert.strictEqual(res.claims[0].classification, 'supported');
    assert.strictEqual(res.claims[0].sourceTitle, slaSource.title);
    assert.strictEqual(res.claims[0].sourceUrl, slaSource.url);
    assert.strictEqual(res.claims[0].needsHumanReview, true);
    assert.strictEqual(res.summary.supportedCount, 1);
  });

  await run('Classifies a contradicted claim when evidence conflicts', async () => {
    const excerpt = 'Independent ranking as the world\'s most reliable platform is not claimed.';
    const res = await claimVerifier.verifyClaims({
      content: 'ApexCloud is the world\'s most reliable platform.',
      evidenceSources: [slaSource],
      clientOverride: mockClient({
        claims: [{
          claim: 'ApexCloud is the world\'s most reliable platform.',
          classification: 'contradicted',
          explanation: 'The report explicitly says this ranking is not claimed.',
          evidenceExcerpt: excerpt,
          sourceTitle: slaSource.title
        }]
      })
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.claims[0].classification, 'contradicted');
    assert.strictEqual(res.summary.contradictedCount, 1);
    assert.strictEqual(res.autoApproved, false);
  });

  await run('Classifies a claim as unverified when evidence does not address it', async () => {
    const res = await claimVerifier.verifyClaims({
      content: 'ApexCloud has 12 million paying customers worldwide.',
      evidenceSources: [slaSource],
      clientOverride: mockClient({
        claims: [{
          claim: 'ApexCloud has 12 million paying customers worldwide.',
          classification: 'unverified',
          explanation: 'Customer count is not mentioned in the supplied report.',
          evidenceExcerpt: '',
          sourceTitle: slaSource.title
        }]
      })
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.claims[0].classification, 'unverified');
    assert.strictEqual(res.summary.unverifiedCount, 1);
  });

  await run('Insufficient evidence: empty pasted sources force Unverified', async () => {
    const res = await claimVerifier.verifyClaims({
      content: 'Our product is 100% effective at preventing outages.',
      evidenceSources: [],
      clientOverride: mockClient({
        claims: [{
          claim: 'Our product is 100% effective at preventing outages.',
          classification: 'supported',
          explanation: 'Invented support from an unseen study.',
          evidenceExcerpt: 'A famous industry study proves 100% effectiveness.',
          sourceTitle: 'Hallucinated Industry Study 2024'
        }]
      })
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.claims[0].classification, 'unverified');
    assert.strictEqual(res.claims[0].sourceTitle, '');
    assert.strictEqual(res.claims[0].evidenceExcerpt, '');
    assert.ok(res.claims[0].explanation.includes('Insufficient evidence'));
    assert.strictEqual(res.summary.insufficientEvidence, true);
  });

  await run('Does not accept invented citations or ungrounded excerpts as Supported', async () => {
    const grounded = claimVerifier.groundClaimsAgainstEvidence(
      [{
        claim: 'Revenue grew 300% last quarter.',
        classification: 'supported',
        explanation: 'Wikipedia says so.',
        evidenceExcerpt: 'Revenue grew 300% according to an unnamed analyst.',
        sourceTitle: 'Wikipedia'
      }],
      [slaSource],
      'Revenue grew 300% last quarter.'
    );

    assert.strictEqual(grounded[0].classification, 'unverified');
    assert.strictEqual(grounded[0].sourceTitle, '');
    assert.ok(grounded[0].groundingNote.includes('not found'));
  });

  await run('Never auto-approves marketing content', async () => {
    const res = await claimVerifier.verifyClaims({
      content: 'ApexCloud reduced average incident response time by 40% in 2025.',
      evidenceSources: [slaSource],
      clientOverride: mockClient({
        claims: [{
          claim: 'ApexCloud reduced average incident response time by 40% in 2025.',
          classification: 'supported',
          explanation: 'Matches the report.',
          evidenceExcerpt: 'a 40% reduction',
          sourceTitle: slaSource.title
        }]
      })
    });
    assert.strictEqual(res.publicationApproved, false);
    assert.strictEqual(res.autoApproved, false);
    assert.ok(res.disclaimer.toLowerCase().includes('not guaranteed'));
  });

  await run('Stores URLs as reference labels only and never treats them as fetched evidence', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const sources = claimVerifier.normalizeEvidenceSources([
      { title: 'Press kit', url: 'https://evil.example/secret', text: 'Uptime is 99.9%.' }
    ]);
    assert.strictEqual(sources[0].url, 'https://evil.example/secret');
    assert.ok(claimVerifier.looksLikeUrl(sources[0].url));
    const moduleSource = fs.readFileSync(path.join(__dirname, '../lib/claimVerifier.js'), 'utf8');
    assert.doesNotMatch(moduleSource, /https\.get|http\.get|fetch\(/);
  });

  console.log(`\nClaim Verifier Test Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runClaimVerifierTests();
}

module.exports = { runClaimVerifierTests };
