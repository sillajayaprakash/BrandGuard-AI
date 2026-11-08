/**
 * BrandGuard AI - Google Gemini API Integration Module
 * Uses the official @google/genai SDK Interactions API (client.interactions.create)
 * with gemini-3.5-flash for deep semantic brand governance analysis.
 * Fully isolated from the deterministic engine.
 */

const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MODEL = 'gemini-3.5-flash';

/**
 * Redacts any accidental API key patterns from error messages
 * to ensure secrets are never leaked in logs, responses, or stack traces.
 */
function sanitizeErrorMessage(error, keyOverride = null) {
  if (!error) return 'Unknown error occurred';
  let message = typeof error === 'string' ? error : (error.message || String(error));
  const apiKey = keyOverride || process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.length > 5) {
    message = message.split(apiKey).join('[REDACTED_API_KEY]');
  }
  return message.replace(/AIza[0-9A-Za-z\-_]{15,}/g, '[REDACTED_API_KEY]');
}

/**
 * Checks if a valid Gemini API key is present in environment variables.
 * Never exposes the key value.
 */
function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && typeof key === 'string' && key.trim() !== '' && key.trim() !== 'your_key_here');
}

/**
 * Calculates character offsets (startIndex, endIndex, lineNumber, columnNumber)
 * for matched text in source text.
 */
function findTextOffsets(sourceText, targetSnippet) {
  if (!sourceText || !targetSnippet) {
    return { startIndex: 0, endIndex: 0, lineNumber: 1, columnNumber: 1 };
  }
  const startIndex = sourceText.toLowerCase().indexOf(targetSnippet.toLowerCase());
  if (startIndex === -1) {
    return { startIndex: 0, endIndex: targetSnippet.length, lineNumber: 1, columnNumber: 1 };
  }
  const endIndex = startIndex + targetSnippet.length;
  const lines = sourceText.slice(0, startIndex).split('\n');
  const lineNumber = lines.length;
  const columnNumber = lines[lines.length - 1].length + 1;
  return { startIndex, endIndex, lineNumber, columnNumber };
}

/**
 * JSON Schema for structured Gemini Output conforming to OpenAPI / JSON Schema
 * used in the Interactions API response_format.
 */
const GEMINI_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        overallAssessment: {
          type: 'string',
          description: 'High-level synthesis of brand compliance and risk posture.'
        },
        criticalCount: { type: 'integer' },
        warningCount: { type: 'integer' },
        advisoryCount: { type: 'integer' },
        needsHumanReviewCount: { type: 'integer' }
      },
      required: ['overallAssessment', 'criticalCount', 'warningCount', 'advisoryCount', 'needsHumanReviewCount']
    },
    score: {
      type: 'integer',
      description: 'Calculated compliance score from 0 (severely non-compliant) to 100 (fully compliant).'
    },
    findings: {
      type: 'array',
      description: 'List of specific brand governance issues, claims, or tone slips found in the text.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: {
            type: 'string',
            description: 'One of: unsupported_claim, tone_mismatch, prohibited_phrasing, unverified_metric, brand_alignment'
          },
          categoryLabel: { type: 'string' },
          severity: {
            type: 'string',
            description: 'One of: critical, warning, advisory'
          },
          matchedText: {
            type: 'string',
            description: 'Exact verbatim substring from the marketing content being flagged.'
          },
          explanation: {
            type: 'string',
            description: 'Detailed rationale citing why this violates brand voice, truth-in-advertising, or guidelines.'
          },
          suggestedCorrection: {
            type: 'string',
            description: 'Suggested replacement or safe phrasing alternative.'
          },
          confidence: {
            type: 'number',
            description: 'Confidence score between 0.0 and 1.0.'
          },
          needsHumanReview: {
            type: 'boolean',
            description: 'True if claim contains uncertain facts, unverified metrics, or requires human legal review.'
          }
        },
        required: [
          'id',
          'category',
          'categoryLabel',
          'severity',
          'matchedText',
          'explanation',
          'suggestedCorrection',
          'confidence',
          'needsHumanReview'
        ]
      }
    }
  },
  required: ['summary', 'score', 'findings']
};

/**
 * Generates the prompt given the marketing copy and brand rules.
 */
function buildGovernancePrompt(text, rules) {
  const brandName = rules?.name || 'Enterprise Brand Guidelines';
  const targetTone = rules?.targetTone || 'Authoritative, professional, trustworthy, and consultative';
  
  const forbidden = (rules?.forbiddenPhrases || [])
    .map(f => `- "${f.phrase}": ${f.explanation || 'Prohibited'} (Severity: ${f.severity || 'warning'})`)
    .join('\n');

  const claims = (rules?.unsupportedClaims || [])
    .map(c => `- Pattern/Theme: "${c.pattern}": ${c.explanation || 'Unsubstantiated'} (Severity: ${c.severity || 'critical'})`)
    .join('\n');

  const preferred = (rules?.preferredPhrases || [])
    .map(p => `- Replace "${p.phrase}" with preferred term "${p.preferred}"`)
    .join('\n');

  return `You are BrandGuard AI's Enterprise Brand Governance Copilot.
Your job is to objectively analyze submitted marketing and sales content against active brand guidelines and compliance requirements.

BRAND PROFILE & GOVERNANCE RULES:
Brand Name: ${brandName}
Target Voice & Tone: ${targetTone}

Forbidden Phrases:
${forbidden || 'None explicitly listed'}

Unsupported Claims & Legal Restrictions:
${claims || 'Strict prohibition on absolute guarantees, unverified superlatives, and 100% promises.'}

Preferred Phrasing Guidelines:
${preferred || 'Use customer-centric, value-driven vocabulary.'}

CRITICAL OPERATIONAL PRINCIPLES:
1. Ground your audit strictly in the provided text and brand guidelines.
2. DO NOT invent, hallucinate, or assume unstated business facts, product features, or metrics.
3. If the copy contains statistics, ROI claims, clinical claims, or performance metrics that are not substantiated within the text, DO NOT assume they are true. Flag them with needsHumanReview: true and category: "unsupported_claim" or "unverified_metric".
4. Accurately categorize severities:
   - "critical": Absolute warranties ("100% guaranteed", "zero risk", "never fails"), unverified superlatives ("world's best", "#1 in the world"), or strict regulatory liability.
   - "warning": Policy violations, high-pressure urgency ("ACT NOW OR REGRET"), informal slang, hyperbolic promises.
   - "advisory": Phrasing improvements, preferred terminology suggestions, passive voice refinements.
5. In matchedText, extract the EXACT verbatim substring from the input content so the user can locate and replace it.
6. Provide a constructive, brand-aligned suggestedCorrection for each finding.
7. Compute an objective compliance score from 0 to 100 (100 = flawless, <70 = policy violations present).

MARKETING CONTENT TO AUDIT:
"""
${text}
"""`;
}

/**
 * Analyzes marketing content using Google's Gemini API via official @google/genai SDK Interactions API.
 * Uses gemini-3.5-flash model.
 *
 * @param {object} params
 * @param {string} params.text - Marketing text to evaluate
 * @param {object} params.rules - Active brand rules
 * @param {string} [params.presetId] - Brand preset identifier
 * @param {number} [params.timeoutMs=25000] - Request timeout in milliseconds
 * @param {object} [params.clientOverride=null] - Optional GoogleGenAI instance for testing
 * @returns {Promise<object>} Structured compliance findings or error payload
 */
async function analyzeWithGemini({
  text,
  rules,
  presetId = 'apexTech',
  timeoutMs = 25000,
  clientOverride = null
}) {
  // 1. Input Validation
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      success: false,
      code: 'INVALID_INPUT',
      error: 'Marketing content text is required for analysis.'
    };
  }

  // 2. API Key Validation (kept exclusively in process.env.GEMINI_API_KEY)
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!clientOverride && (!apiKey || apiKey === 'your_key_here')) {
    return {
      success: false,
      code: 'MISSING_API_KEY',
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY in your environment or .env file.'
    };
  }

  // 3. Initialize Official SDK
  let ai;
  try {
    ai = clientOverride || new GoogleGenAI({ apiKey });
  } catch (initErr) {
    return {
      success: false,
      code: 'SDK_INIT_ERROR',
      error: `Failed to initialize Gemini SDK: ${sanitizeErrorMessage(initErr)}`
    };
  }

  const prompt = buildGovernancePrompt(text, rules);

  // 4. Execute API Call using Interactions API (client.interactions.create) with Timeout
  try {
    let apiCallPromise;
    if (ai.interactions && typeof ai.interactions.create === 'function') {
      apiCallPromise = ai.interactions.create({
        model: DEFAULT_MODEL,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: GEMINI_JSON_SCHEMA
        }
      });
    } else if (ai.models && typeof ai.models.generateContent === 'function') {
      // Compatibility fallback for mock clients in unit tests
      apiCallPromise = ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt
      });
    } else {
      throw new Error('GoogleGenAI client does not support interactions.create');
    }

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs / 1000} seconds.`);
        timeoutErr.code = 'TIMEOUT';
        reject(timeoutErr);
      }, timeoutMs);
    });

    const interaction = await Promise.race([apiCallPromise, timeoutPromise]);
    clearTimeout(timeoutHandle);

    // 5. Parse and Validate Response from interaction.output_text
    const responseText = interaction.output_text || interaction.text || (Array.isArray(interaction.outputs) && interaction.outputs[0]?.text) || '';
    if (!responseText) {
      return {
        success: false,
        code: 'EMPTY_RESPONSE',
        error: 'Gemini returned an empty interaction output.'
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      return {
        success: false,
        code: 'PARSE_ERROR',
        error: `Failed to parse structured response from Gemini: ${sanitizeErrorMessage(parseErr)}`
      };
    }

    // 6. Post-process Findings with Coordinates and Auto-Fix metadata
    const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
    const normalizedFindings = rawFindings.map((finding, idx) => {
      const offsets = findTextOffsets(text, finding.matchedText);
      const severity = ['critical', 'warning', 'advisory'].includes(finding.severity?.toLowerCase())
        ? finding.severity.toLowerCase()
        : 'warning';

      return {
        id: finding.id || `gemini_${idx + 1}`,
        category: finding.category || 'brand_alignment',
        categoryLabel: finding.categoryLabel || 'AI Governance Finding',
        severity: severity,
        matchedText: finding.matchedText || '',
        startIndex: offsets.startIndex,
        endIndex: offsets.endIndex,
        lineNumber: offsets.lineNumber,
        columnNumber: offsets.columnNumber,
        explanation: finding.explanation || 'Identified by Gemini as a brand voice deviation.',
        suggestedCorrection: finding.suggestedCorrection || null,
        canAutoFix: Boolean(finding.suggestedCorrection && finding.matchedText),
        confidence: typeof finding.confidence === 'number' ? Math.max(0, Math.min(1, +finding.confidence.toFixed(2))) : 0.85,
        needsHumanReview: Boolean(finding.needsHumanReview),
        engine: DEFAULT_MODEL
      };
    });

    // Calculate Summary Counts
    let criticalCount = 0;
    let warningCount = 0;
    let advisoryCount = 0;
    let humanReviewCount = 0;

    for (const f of normalizedFindings) {
      if (f.severity === 'critical') criticalCount++;
      else if (f.severity === 'warning') warningCount++;
      else advisoryCount++;

      if (f.needsHumanReview) humanReviewCount++;
    }

    // Use Gemini's score if within bounds, otherwise compute from severities
    let score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : null;
    if (score === null) {
      const deduction = (criticalCount * 22) + (warningCount * 11) + (advisoryCount * 5);
      score = normalizedFindings.length > 0 ? Math.max(0, Math.min(98, 100 - deduction)) : 100;
    }

    let status = 'compliant';
    if (score < 70 || criticalCount >= 2) {
      status = 'non_compliant';
    } else if (score < 90 || warningCount > 0 || criticalCount === 1 || humanReviewCount > 0) {
      status = 'needs_revision';
    }

    return {
      success: true,
      source: DEFAULT_MODEL,
      model: DEFAULT_MODEL,
      score,
      status,
      summary: {
        totalFindings: normalizedFindings.length,
        totalIssues: normalizedFindings.length,
        criticalCount,
        warningCount,
        advisoryCount,
        needsHumanReviewCount: humanReviewCount,
        overallAssessment: parsed.summary?.overallAssessment || 'Audit completed by Gemini 3.5 Flash copilot.',
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
        charCount: text.length
      },
      findings: normalizedFindings,
      issues: normalizedFindings, // Map to issues for unified UI compatibility
      auditTimestamp: new Date().toISOString()
    };

  } catch (err) {
    const httpStatus = err.status || err.statusCode || (err.data$ && err.data$.error && err.data$.error.code) || null;

    if (err.code === 'TIMEOUT') {
      return {
        success: false,
        code: 'TIMEOUT',
        httpStatus,
        error: sanitizeErrorMessage(err)
      };
    }

    // Detect rate limit, quota, 404 model not found, 503 high demand, or permission errors
    const sanitizedMsg = sanitizeErrorMessage(err);
    let code = 'GEMINI_API_ERROR';
    if (/503|service_unavailable|high demand/i.test(sanitizedMsg) || httpStatus === 503) {
      code = 'SERVICE_UNAVAILABLE';
    } else if (/429|quota|rate limit/i.test(sanitizedMsg) || httpStatus === 429) {
      code = 'RATE_LIMIT';
    } else if (/404|not found/i.test(sanitizedMsg) || httpStatus === 404) {
      code = 'MODEL_NOT_FOUND';
    } else if (/403|401|API_KEY_INVALID/i.test(sanitizedMsg) || httpStatus === 401 || httpStatus === 403) {
      code = 'AUTH_ERROR';
    }

    return {
      success: false,
      code,
      httpStatus,
      error: `Gemini API error: ${sanitizedMsg}`
    };
  }
}

module.exports = {
  analyzeWithGemini,
  isGeminiConfigured,
  sanitizeErrorMessage,
  buildGovernancePrompt,
  GEMINI_JSON_SCHEMA,
  DEFAULT_MODEL
};
