/**
 * BrandGuard AI - Deterministic Brand Governance Engine
 * Performs rule-based analysis on marketing content without external AI/API dependencies.
 * Fully deterministic, inspectable, and reproducible.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BrandGuardChecker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const KNOWN_ACRONYMS = new Set([
    'B2B', 'B2C', 'SaaS', 'API', 'SLA', 'ROI', 'CEO', 'CTO', 'CFO', 'VP',
    'CRM', 'ERP', 'AWS', 'GCP', 'SQL', 'HTTP', 'HTTPS', 'URL', 'HTML', 'CSS',
    'JSON', 'REST', 'FTC', 'SEC', 'FDA', 'GDPR', 'HIPAA', 'SOC2', 'ISO', 'USA',
    'SAN', 'FRANCISCO', 'YORK', 'LONDON', 'PARIS', 'BERLIN', 'TOKYO', 'BOSTON'
  ]);

  const INFORMAL_SLANG_MAP = {
    'wanna': 'want to',
    'gonna': 'going to',
    'gotta': 'have to',
    'ain\'t': 'is not',
    'aint': 'is not',
    'legit': 'legitimate',
    'crap': 'substandard'
  };

  const URGENCY_PATTERNS = [
    {
      pattern: '\\b(?:act\\s+now\\s+or\\s+miss\\s+out|act\\s+now|act\\s+immediately)\\b',
      severity: 'warning',
      explanation: 'High-pressure urgency language creates a transactional, low-trust impression.',
      suggested: 'explore our offerings today'
    },
    {
      pattern: '\\b(?:before\\s+it\'?s\\s+gone|before\\s+it\'?s\\s+too\\s+late)\\b',
      severity: 'warning',
      explanation: 'Scarcity pressure conflicts with professional brand reputation guidelines.',
      suggested: 'at your earliest convenience'
    },
    {
      pattern: '\\b(?:don\'?t\\s+wait\\s+another\\s+second|buy\\s+now\\s+or\\s+regret)\\b',
      severity: 'warning',
      explanation: 'Manipulative sales urgency can violate fair advertising standards.',
      suggested: 'get started whenever you are ready'
    }
  ];

  /**
   * Escape string for use in RegExp
   */
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate line number and column number from index
   */
  function getPosition(text, index) {
    const textBefore = text.slice(0, index);
    const lines = textBefore.split('\n');
    const lineNumber = lines.length;
    const columnNumber = lines[lines.length - 1].length + 1;
    return { lineNumber, columnNumber };
  }

  /**
   * Main audit function
   * @param {string} text - Marketing copy
   * @param {object} rules - Brand rules configuration
   * @returns {object} Audit report with compliance score and detected issues
   */
  function analyzeContent(text, rules) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return {
        score: 100,
        status: 'compliant',
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          warningCount: 0,
          advisoryCount: 0,
          wordCount: 0,
          charCount: 0,
          readingTimeMinutes: 0
        },
        issues: [],
        auditTimestamp: new Date().toISOString(),
        engineVersion: '1.0.0-rule-based'
      };
    }

    const issues = [];
    let issueCounter = 0;

    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const charCount = text.length;
    const readingTimeMinutes = Math.max(0.1, +(wordCount / 200).toFixed(1));

    const forbiddenList = rules?.forbiddenPhrases || [];
    const claimsList = rules?.unsupportedClaims || [];
    const preferredList = rules?.preferredPhrases || [];
    const toneSettings = rules?.toneRules || {
      checkAggressiveUrgency: true,
      checkInformalSlang: true,
      checkExcessivePunctuation: true,
      checkAllCaps: true
    };

    // 1. Check Forbidden Phrases
    for (const item of forbiddenList) {
      if (!item.phrase || item.disabled) continue;
      const phraseRegex = new RegExp(`\\b${escapeRegExp(item.phrase)}\\b`, 'gi');
      let match;
      while ((match = phraseRegex.exec(text)) !== null) {
        if (match[0].length === 0) {
          phraseRegex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = start + match[0].length;
        const pos = getPosition(text, start);

        issues.push({
          id: `fp_${++issueCounter}`,
          ruleId: item.id || `fp_custom_${issueCounter}`,
          category: 'forbidden_phrase',
          categoryLabel: 'Forbidden Phrase',
          severity: item.severity || 'warning',
          matchedText: match[0],
          startIndex: start,
          endIndex: end,
          lineNumber: pos.lineNumber,
          columnNumber: pos.columnNumber,
          explanation: item.explanation || `The phrase "${match[0]}" is prohibited in company marketing guidelines.`,
          suggestedCorrection: item.suggested || null,
          canAutoFix: Boolean(item.suggested)
        });
      }
    }

    // 2. Check Unsupported / Exaggerated Claims
    for (const claim of claimsList) {
      if (!claim.pattern || claim.disabled) continue;
      let regex;
      try {
        regex = new RegExp(claim.pattern, 'gi');
      } catch {
        // Fallback to literal if regex was invalid
        regex = new RegExp(`\\b${escapeRegExp(claim.pattern)}\\b`, 'gi');
      }

      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = start + match[0].length;
        const pos = getPosition(text, start);

        issues.push({
          id: `uc_${++issueCounter}`,
          ruleId: claim.id || `uc_custom_${issueCounter}`,
          category: 'unsupported_claim',
          categoryLabel: 'Unsupported / Exaggerated Claim',
          severity: claim.severity || 'critical',
          matchedText: match[0],
          startIndex: start,
          endIndex: end,
          lineNumber: pos.lineNumber,
          columnNumber: pos.columnNumber,
          explanation: claim.explanation || `Claims matching "${match[0]}" require empirical substantiation or disclaimers.`,
          suggestedCorrection: claim.suggested || null,
          canAutoFix: Boolean(claim.suggested)
        });
      }
    }

    // 3. Check Preferred Phrases
    for (const pref of preferredList) {
      if (!pref.phrase || !pref.preferred || pref.disabled) continue;
      const prefRegex = new RegExp(`\\b${escapeRegExp(pref.phrase)}\\b`, 'gi');
      let match;
      while ((match = prefRegex.exec(text)) !== null) {
        if (match[0].length === 0) {
          prefRegex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = start + match[0].length;

        // Skip if this range was already flagged by forbidden phrase
        const alreadyFlagged = issues.some(
          i => i.category === 'forbidden_phrase' &&
               Math.max(start, i.startIndex) < Math.min(end, i.endIndex)
        );
        if (alreadyFlagged) continue;

        const pos = getPosition(text, start);
        issues.push({
          id: `pp_${++issueCounter}`,
          ruleId: pref.id || `pp_custom_${issueCounter}`,
          category: 'preferred_phrase',
          categoryLabel: 'Preferred Phrase',
          severity: 'advisory',
          matchedText: match[0],
          startIndex: start,
          endIndex: end,
          lineNumber: pos.lineNumber,
          columnNumber: pos.columnNumber,
          explanation: `Brand style recommends using "${pref.preferred}" instead of "${match[0]}".`,
          suggestedCorrection: pref.preferred,
          canAutoFix: true
        });
      }
    }

    // 4. Tone & Style Checks
    if (toneSettings.checkAggressiveUrgency) {
      for (const urgency of URGENCY_PATTERNS) {
        const urgencyRegex = new RegExp(urgency.pattern, 'gi');
        let match;
        while ((match = urgencyRegex.exec(text)) !== null) {
          if (match[0].length === 0) {
            urgencyRegex.lastIndex++;
            continue;
          }
          const start = match.index;
          const end = start + match[0].length;
          const pos = getPosition(text, start);

          issues.push({
            id: `tone_urg_${++issueCounter}`,
            category: 'tone',
            categoryLabel: 'Aggressive Urgency Tone',
            severity: urgency.severity,
            matchedText: match[0],
            startIndex: start,
            endIndex: end,
            lineNumber: pos.lineNumber,
            columnNumber: pos.columnNumber,
            explanation: urgency.explanation,
            suggestedCorrection: urgency.suggested,
            canAutoFix: Boolean(urgency.suggested)
          });
        }
      }
    }

    if (toneSettings.checkExcessivePunctuation) {
      const punctRegex = /([!?]{2,})/g;
      let match;
      while ((match = punctRegex.exec(text)) !== null) {
        if (match[0].length === 0) {
          punctRegex.lastIndex++;
          continue;
        }
        const start = match.index;
        const end = start + match[0].length;
        const pos = getPosition(text, start);

        issues.push({
          id: `tone_punct_${++issueCounter}`,
          category: 'tone',
          categoryLabel: 'Excessive Punctuation',
          severity: 'warning',
          matchedText: match[0],
          startIndex: start,
          endIndex: end,
          lineNumber: pos.lineNumber,
          columnNumber: pos.columnNumber,
          explanation: 'Multiple exclamation or question marks reduce corporate credibility.',
          suggestedCorrection: match[0].startsWith('?') ? '?' : '.',
          canAutoFix: true
        });
      }
    }

    if (toneSettings.checkInformalSlang) {
      for (const [slang, replacement] of Object.entries(INFORMAL_SLANG_MAP)) {
        const slangRegex = new RegExp(`\\b${escapeRegExp(slang)}\\b`, 'gi');
        let match;
        while ((match = slangRegex.exec(text)) !== null) {
          if (match[0].length === 0) {
            slangRegex.lastIndex++;
            continue;
          }
          const start = match.index;
          const end = start + match[0].length;
          const pos = getPosition(text, start);

          issues.push({
            id: `tone_slang_${++issueCounter}`,
            category: 'tone',
            categoryLabel: 'Informal Slang',
            severity: 'advisory',
            matchedText: match[0],
            startIndex: start,
            endIndex: end,
            lineNumber: pos.lineNumber,
            columnNumber: pos.columnNumber,
            explanation: `Informal colloquialism "${match[0]}" does not match brand style guidelines.`,
            suggestedCorrection: replacement,
            canAutoFix: true
          });
        }
      }
    }

    if (toneSettings.checkAllCaps) {
      // Find sequences of words in ALL CAPS (longer than 3 chars, not in acronym whitelist)
      const allCapsRegex = /\b[A-Z]{4,}(?:\s+[A-Z]{4,})*\b/g;
      let match;
      while ((match = allCapsRegex.exec(text)) !== null) {
        if (match[0].length === 0) {
          allCapsRegex.lastIndex++;
          continue;
        }
        const matched = match[0];
        // If it's a known acronym or dateline term, ignore
        if (KNOWN_ACRONYMS.has(matched)) continue;

        // Skip if matched text is inside a previously detected urgency issue
        const start = match.index;
        const end = start + matched.length;
        const alreadyCovered = issues.some(
          i => i.category === 'tone' && i.startIndex <= start && i.endIndex >= end
        );
        if (alreadyCovered) continue;

        const pos = getPosition(text, start);
        // Normalize capitalized text to Title Case or lower case
        const normalized = matched.charAt(0) + matched.slice(1).toLowerCase();

        issues.push({
          id: `tone_caps_${++issueCounter}`,
          category: 'tone',
          categoryLabel: 'Overuse of Capitalization',
          severity: 'warning',
          matchedText: matched,
          startIndex: start,
          endIndex: end,
          lineNumber: pos.lineNumber,
          columnNumber: pos.columnNumber,
          explanation: 'Consecutive uppercase words resemble shouting and harm readability.',
          suggestedCorrection: normalized,
          canAutoFix: true
        });
      }
    }

    // Sort issues by appearance order in text
    issues.sort((a, b) => a.startIndex - b.startIndex);

    // Calculate Summary Counts
    let criticalCount = 0;
    let warningCount = 0;
    let advisoryCount = 0;

    for (const iss of issues) {
      if (iss.severity === 'critical') criticalCount++;
      else if (iss.severity === 'warning') warningCount++;
      else advisoryCount++;
    }

    // Calculate Compliance Score (0 to 100)
    // Formula:
    // Deductions: Critical (-22), Warning (-11), Advisory (-5)
    // Score reflects exact detected problems rather than hard-coded values.
    let score = 100;
    if (issues.length > 0) {
      const totalDeduction = (criticalCount * 22) + (warningCount * 11) + (advisoryCount * 5);
      score = Math.max(0, Math.min(98, 100 - totalDeduction));
    }

    let status = 'compliant';
    if (score < 70 || criticalCount >= 2) {
      status = 'non_compliant';
    } else if (score < 90 || warningCount > 0 || criticalCount === 1) {
      status = 'needs_revision';
    }

    return {
      score,
      status,
      summary: {
        totalIssues: issues.length,
        criticalCount,
        warningCount,
        advisoryCount,
        wordCount,
        charCount,
        readingTimeMinutes
      },
      issues,
      auditTimestamp: new Date().toISOString(),
      engineVersion: '1.0.0-rule-based'
    };
  }

  /**
   * Applies all safe suggested corrections in reverse order to preserve string character offsets.
   * @param {string} originalText - The original marketing content
   * @param {Array} issuesList - Array of issue objects from analyzeContent
   * @returns {string} Text with corrections applied
   */
  function applyAllCorrections(originalText, issuesList) {
    if (!originalText || !issuesList || issuesList.length === 0) return originalText;

    // Filter to issues with valid suggested corrections
    const fixable = issuesList
      .filter(i => i.canAutoFix && typeof i.suggestedCorrection === 'string')
      .sort((a, b) => b.startIndex - a.startIndex); // Reverse order

    let result = originalText;
    for (const fix of fixable) {
      // Validate that text at target index matches matchedText
      const currentSlice = result.slice(fix.startIndex, fix.endIndex);
      if (currentSlice.toLowerCase() === fix.matchedText.toLowerCase()) {
        result = result.slice(0, fix.startIndex) + fix.suggestedCorrection + result.slice(fix.endIndex);
      }
    }
    return result;
  }

  /**
   * Replaces a single issue by its ID
   * @param {string} originalText 
   * @param {object} issue 
   * @returns {string} Updated text
   */
  function applySingleCorrection(originalText, issue) {
    if (!originalText || !issue || !issue.canAutoFix || !issue.suggestedCorrection) {
      return originalText;
    }
    const { startIndex, endIndex, matchedText, suggestedCorrection } = issue;
    const currentSlice = originalText.slice(startIndex, endIndex);
    if (currentSlice.toLowerCase() === matchedText.toLowerCase()) {
      return originalText.slice(0, startIndex) + suggestedCorrection + originalText.slice(endIndex);
    }
    // Fallback if offsets drifted: replace first matching occurrence
    return originalText.replace(new RegExp(escapeRegExp(matchedText), 'i'), suggestedCorrection);
  }

  return {
    analyzeContent,
    applyAllCorrections,
    applySingleCorrection
  };
});
