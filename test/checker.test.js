/**
 * Unit Test Suite for BrandGuard AI Deterministic Content Checker
 * Runs directly with Node.js
 */

const assert = require('node:assert');
const checker = require('../lib/checker.js');
const { PRESETS, SAMPLE_CONTENTS } = require('../lib/presets.js');

function runAllTests() {
  console.log('Running BrandGuard AI Tests...\n');
  let passed = 0;
  let failed = 0;

  function run(name, fn) {
    try {
      fn();
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Empty Text
  run('Empty or whitespace text returns 100 score and 0 issues', () => {
    const reportEmpty = checker.analyzeContent('', PRESETS.apexTech);
    assert.strictEqual(reportEmpty.score, 100);
    assert.strictEqual(reportEmpty.status, 'compliant');
    assert.strictEqual(reportEmpty.summary.totalIssues, 0);

    const reportSpaces = checker.analyzeContent('    \n\t   ', PRESETS.apexTech);
    assert.strictEqual(reportSpaces.score, 100);
    assert.strictEqual(reportSpaces.summary.totalIssues, 0);
  });

  // 2. Fully Compliant Text
  run('Fully compliant text receives high compliance score', () => {
    const compliantText = SAMPLE_CONTENTS.compliant.content;
    const report = checker.analyzeContent(compliantText, PRESETS.apexTech);

    assert.ok(report.score >= 90, `Score was ${report.score}, expected >= 90`);
    assert.strictEqual(report.status, 'compliant');
    assert.strictEqual(report.summary.criticalCount, 0);
  });

  // 3. Forbidden Phrases
  run('Detects forbidden phrases accurately with line and column numbers', () => {
    const text = 'Our software is very cheap and foolproof for your team.';
    const report = checker.analyzeContent(text, PRESETS.apexTech);

    const cheapIssue = report.issues.find(i => i.matchedText.toLowerCase() === 'cheap');
    assert.ok(cheapIssue, 'Failed to detect "cheap"');
    assert.strictEqual(cheapIssue.category, 'forbidden_phrase');
    assert.strictEqual(cheapIssue.suggestedCorrection, 'cost-effective');
    assert.strictEqual(cheapIssue.lineNumber, 1);
    assert.strictEqual(cheapIssue.columnNumber, 22);

    const foolproofIssue = report.issues.find(i => i.matchedText.toLowerCase() === 'foolproof');
    assert.ok(foolproofIssue, 'Failed to detect "foolproof"');
    assert.strictEqual(foolproofIssue.suggestedCorrection, 'robust');
  });

  // 4. Unsupported Claims
  run('Detects unsupported and exaggerated claims with Critical severity', () => {
    const text = "ApexCloud is the world's best platform offering 100% guaranteed uptime with zero risk!";
    const report = checker.analyzeContent(text, PRESETS.apexTech);

    assert.ok(report.summary.criticalCount >= 3, `Expected at least 3 critical issues, got ${report.summary.criticalCount}`);
    
    const worldsBest = report.issues.find(i => /world'?s best/i.test(i.matchedText));
    assert.ok(worldsBest, 'Should catch "world\'s best"');
    assert.strictEqual(worldsBest.severity, 'critical');

    const guaranteed = report.issues.find(i => /100%\s*guaranteed/i.test(i.matchedText));
    assert.ok(guaranteed, 'Should catch "100% guaranteed"');
    assert.strictEqual(guaranteed.severity, 'critical');

    const zeroRisk = report.issues.find(i => /zero risk/i.test(i.matchedText));
    assert.ok(zeroRisk, 'Should catch "zero risk"');
    assert.strictEqual(zeroRisk.severity, 'critical');
  });

  // 5. Tone Violations
  run('Detects tone violations: urgency, slang, all-caps, excessive punctuation', () => {
    const text = "ACT NOW BEFORE IT'S GONE!!! Users wanna buy this immediately!";
    const report = checker.analyzeContent(text, PRESETS.apexTech);

    const punctIssue = report.issues.find(i => i.id.startsWith('tone_punct'));
    assert.ok(punctIssue, 'Should detect multiple exclamation marks "!!!"');

    const slangIssue = report.issues.find(i => i.matchedText.toLowerCase() === 'wanna');
    assert.ok(slangIssue, 'Should detect slang "wanna"');
    assert.strictEqual(slangIssue.suggestedCorrection, 'want to');

    const urgencyIssue = report.issues.find(i => i.id.startsWith('tone_urg'));
    assert.ok(urgencyIssue, 'Should detect urgency phrase');
  });

  // 6. Dynamic Score
  run('Score is dynamic, calculated from issues, not hard-coded', () => {
    const highRiskText = SAMPLE_CONTENTS.highRisk.content;
    const report = checker.analyzeContent(highRiskText, PRESETS.apexTech);

    assert.notStrictEqual(report.score, 100, 'Score must not be hard-coded 100');
    assert.ok(report.score < 50, `High risk text score should be < 50, got ${report.score}`);
    assert.strictEqual(report.status, 'non_compliant');
    assert.ok(report.summary.totalIssues >= 8, `Expected >= 8 issues, got ${report.summary.totalIssues}`);
  });

  // 7. Auto-fixing
  run('Auto-fixing corrects all detected issues cleanly and raises score', () => {
    const dirtyText = 'Our cheap tool has zero risk and is a miracle for your business problem.';
    const initialReport = checker.analyzeContent(dirtyText, PRESETS.apexTech);
    assert.ok(initialReport.score < 70, `Initial score should be low, got ${initialReport.score}`);
    assert.ok(initialReport.issues.length >= 3);

    const fixedText = checker.applyAllCorrections(dirtyText, initialReport.issues);
    assert.ok(!fixedText.includes('cheap'), '"cheap" should be replaced');
    assert.ok(!fixedText.includes('zero risk'), '"zero risk" should be replaced');
    assert.ok(!fixedText.includes('miracle'), '"miracle" should be replaced');
    assert.ok(fixedText.includes('cost-effective'), 'Should contain "cost-effective"');

    const reReport = checker.analyzeContent(fixedText, PRESETS.apexTech);
    assert.ok(reReport.score > initialReport.score, `New score (${reReport.score}) should exceed initial (${initialReport.score})`);
  });

  // 8. FinTech Preset
  run('Multi-preset compliance check: FinTech preset catches financial violations', () => {
    const fintechCopy = 'Invest now with guaranteed returns and free money through our legal loophole!';
    const report = checker.analyzeContent(fintechCopy, PRESETS.novaPay);

    assert.ok(report.issues.some(i => i.matchedText.toLowerCase().includes('guaranteed returns')));
    assert.ok(report.issues.some(i => i.matchedText.toLowerCase().includes('free money')));
    assert.ok(report.issues.some(i => i.matchedText.toLowerCase().includes('loophole')));
    assert.strictEqual(report.status, 'non_compliant');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
