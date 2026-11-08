/**
 * Standalone live connection verification script for Gemini 3.8 Flash.
 *
 * NOTE: This script does NOT mock the API. It attempts a real connection to Google
 * using process.env.GEMINI_API_KEY and the official client.interactions.create API.
 */

const fs = require('node:fs');
const path = require('node:path');

// Safely load .env file if process.env.GEMINI_API_KEY is not already defined in environment
(function loadEnvFile() {
  if (process.env.GEMINI_API_KEY) return;
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }
})();
const geminiChecker = require('./lib/geminiChecker.js');
const { PRESETS } = require('./lib/presets.js');

async function testLiveGemini() {
  console.log('=== BrandGuard AI - Live Gemini Connection Test ===\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ FAIL: GEMINI_API_KEY environment variable is not set.');
    console.error('Please configure your key in a local .env file or environment:');
    console.error('  GEMINI_API_KEY=AIzaSy...\n');
    process.exit(1);
  }

  const { DEFAULT_MODEL } = geminiChecker;
  console.log(`Target Model: ${DEFAULT_MODEL}`);
  console.log(`Method: client.interactions.create`);
  console.log(`API Key: [CONFIGURED - NEVER DISPLAYED]\n`);
  console.log('Sending real test request to Google Gemini API (up to 90s timeout)...');

  const sampleCopy = 'Our cloud solution guarantees 100% bug-free uptime with zero latency! It is literally impossible to fail.';

  const startTime = Date.now();
  const result = await geminiChecker.analyzeWithGemini({
    text: sampleCopy,
    rules: PRESETS.apexTech,
    timeoutMs: 90000
  });
  const elapsed = Date.now() - startTime;

  if (result.success) {
    console.log(`\n✅ LIVE API SUCCESS in ${elapsed}ms!`);
    console.log(`Model Used: ${result.model}`);
    console.log(`Compliance Score: ${result.score}/100`);
    console.log(`Status: ${result.status}`);
    console.log(`Executive Summary: ${result.summary?.overallAssessment}`);
    console.log(`Total Findings: ${result.findings?.length || 0}`);
    if (result.findings && result.findings.length > 0) {
      console.log('\nSample Finding Detected:');
      console.log(`  - Category: ${result.findings[0].categoryLabel}`);
      console.log(`  - Matched Text: "${result.findings[0].matchedText}"`);
      console.log(`  - Suggestion: "${result.findings[0].suggestedCorrection}"`);
      console.log(`  - Confidence: ${result.findings[0].confidence}`);
      console.log(`  - Needs Human Review: ${result.findings[0].needsHumanReview}`);
    }
    console.log(`\n🎉 Live ${result.model} connection is fully operational!\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ LIVE API CALL FAILED in ${elapsed}ms:`);
    console.error(`Error Code: ${result.code}`);
    console.error(`Error Message: ${result.error}`);
    if (result.httpStatus) {
      console.error(`HTTP Status: ${result.httpStatus}`);
    }
    console.error('\nDiagnostic Analysis:');
    if (result.code === 'SERVICE_UNAVAILABLE') {
      console.error('• Google servers returned HTTP 503 (High Demand). Google recommends retrying after a brief moment.');
    } else if (result.code === 'TIMEOUT') {
      console.error('• The request timed out. This often occurs when Google servers are overloaded and retry backoffs delay responses.');
    } else if (result.code === 'AUTH_ERROR') {
      console.error('• Authentication failed. Please verify that GEMINI_API_KEY is active in Google Cloud Console.');
    }
    console.error('1. Verify your network/firewall allows HTTPS requests to generativelanguage.googleapis.com');
    console.error('2. Confirm that your API key is active and has billing/quota enabled in Google Cloud Console.');
    process.exit(1);
  }
}

testLiveGemini().catch(err => {
  console.error('Unexpected error during live test:', err);
  process.exit(1);
});
