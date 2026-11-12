/**
 * BrandGuard AI - Factual Claim Verification
 * Uses Gemini (server-side only) to extract marketing claims and compare them
 * against user-pasted evidence. Does not fetch user-provided URLs.
 * Results never auto-approve content; human review is always required.
 */

const { GoogleGenAI } = require('@google/genai');
const {
  sanitizeErrorMessage,
  isGeminiConfigured,
  DEFAULT_MODEL
} = require('./geminiChecker.js');

const CLASSIFICATIONS = ['supported', 'contradicted', 'unverified'];
const MAX_CONTENT_CHARS = 20000;
const MAX_SOURCES = 8;
const MAX_SOURCE_TEXT_CHARS = 8000;
const MAX_TITLE_CHARS = 200;
const MAX_URL_CHARS = 500;
const DEFAULT_TIMEOUT_MS = 25000;

const CLAIM_JSON_SCHEMA = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          claim: { type: 'string' },
          classification: { type: 'string' },
          explanation: { type: 'string' },
          evidenceExcerpt: { type: 'string' },
          sourceTitle: { type: 'string' }
        },
        required: ['claim', 'classification', 'explanation']
      }
    }
  },
  required: ['claims']
};

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeClassification(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'supported') return 'supported';
  if (raw === 'contradicted' || raw === 'contradicts' || raw === 'contradiction') return 'contradicted';
  return 'unverified';
}

function looksLikeUrl(value) {
  if (!value || typeof value !== 'string') return false;
  return /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Normalize evidence payloads. URLs are stored as reference labels only.
 * This function never fetches remote content.
 */
function normalizeEvidenceSources(rawSources) {
  if (!Array.isArray(rawSources)) return [];
  const sources = [];
  for (let i = 0; i < rawSources.length && sources.length < MAX_SOURCES; i++) {
    const item = rawSources[i] || {};
    const title = normalizeWhitespace(item.title || item.sourceTitle || '').slice(0, MAX_TITLE_CHARS);
    const text = String(item.text || item.sourceText || '').slice(0, MAX_SOURCE_TEXT_CHARS);
    const urlRaw = normalizeWhitespace(item.url || item.referenceUrl || '').slice(0, MAX_URL_CHARS);
    const url = looksLikeUrl(urlRaw) ? urlRaw : (urlRaw ? urlRaw : '');
    if (!title && !text.trim()) continue;
    sources.push({
      id: `src_${i + 1}`,
      title: title || `Source ${i + 1}`,
      url,
      text
    });
  }
  return sources;
}

function validateVerifyInput({ content, evidenceSources } = {}) {
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Marketing content is required for factual claim verification.'
    };
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `Marketing content exceeds the ${MAX_CONTENT_CHARS} character limit.`
    };
  }
  if (evidenceSources != null && !Array.isArray(evidenceSources)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Evidence sources must be an array of objects with a title and pasted source text.'
    };
  }
  if (Array.isArray(evidenceSources) && evidenceSources.length > MAX_SOURCES) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: `A maximum of ${MAX_SOURCES} evidence sources is allowed.`
    };
  }
  return { ok: true };
}

function excerptFoundInSources(sources, excerpt) {
  const needle = normalizeWhitespace(excerpt).toLowerCase();
  if (!needle || needle.length < 8) return null;
  for (const source of sources) {
    const haystack = normalizeWhitespace(source.text).toLowerCase();
    if (haystack.includes(needle)) return source;
  }
  return null;
}

function findSourceByTitle(sources, title) {
  const needle = normalizeWhitespace(title).toLowerCase();
  if (!needle) return null;
  return sources.find(s => s.title.toLowerCase() === needle)
    || sources.find(s => s.title.toLowerCase().includes(needle) || needle.includes(s.title.toLowerCase()))
    || null;
}

/**
 * Ground model output in pasted evidence only.
 * Invented citations, missing excerpts, and empty evidence become Unverified.
 */
function groundClaimsAgainstEvidence(rawClaims, sources, content) {
  const list = Array.isArray(rawClaims) ? rawClaims : [];
  const hasAnyEvidenceText = sources.some(s => normalizeWhitespace(s.text).length > 0);

  return list.map((raw, idx) => {
    const claimText = normalizeWhitespace(raw.claim || raw.originalClaim || '');
    let classification = normalizeClassification(raw.classification);
    let explanation = normalizeWhitespace(raw.explanation) || 'No explanation provided.';
    let evidenceExcerpt = normalizeWhitespace(raw.evidenceExcerpt || raw.evidence || '');
    let sourceTitle = normalizeWhitespace(raw.sourceTitle || '');
    let sourceUrl = '';
    let groundingNote = '';

    const titleMatch = findSourceByTitle(sources, sourceTitle);
    const excerptMatch = excerptFoundInSources(sources, evidenceExcerpt);

    if (!hasAnyEvidenceText) {
      classification = 'unverified';
      evidenceExcerpt = '';
      sourceTitle = '';
      sourceUrl = '';
      groundingNote = 'No pasted evidence text was supplied, so the claim cannot be verified.';
      explanation = `${explanation} Insufficient evidence was provided; classified as Unverified.`;
    } else if (classification === 'supported' || classification === 'contradicted') {
      if (!excerptMatch) {
        classification = 'unverified';
        groundingNote = 'The cited excerpt was not found in any pasted evidence source.';
        evidenceExcerpt = '';
        sourceTitle = '';
        sourceUrl = '';
        explanation = `${explanation} The model citation could not be grounded in supplied evidence, so this claim is Unverified.`;
      } else {
        sourceTitle = excerptMatch.title;
        sourceUrl = excerptMatch.url;
        if (titleMatch && titleMatch.id !== excerptMatch.id) {
          groundingNote = 'Source title was aligned to the evidence text that actually contains the excerpt.';
        }
      }
    } else {
      classification = 'unverified';
      if (excerptMatch) {
        sourceTitle = excerptMatch.title;
        sourceUrl = excerptMatch.url;
      } else {
        evidenceExcerpt = '';
        sourceTitle = titleMatch ? titleMatch.title : '';
        sourceUrl = titleMatch ? titleMatch.url : '';
      }
    }

    return {
      id: raw.id || `claim_${idx + 1}`,
      claim: claimText || 'Unspecified claim',
      classification,
      classificationLabel: classification.charAt(0).toUpperCase() + classification.slice(1),
      explanation,
      evidenceExcerpt,
      sourceTitle,
      sourceUrl,
      groundingNote,
      needsHumanReview: true,
      engine: DEFAULT_MODEL
    };
  }).filter(c => c.claim);
}

function summarizeClaims(claims) {
  let supported = 0;
  let contradicted = 0;
  let unverified = 0;
  for (const claim of claims) {
    if (claim.classification === 'supported') supported++;
    else if (claim.classification === 'contradicted') contradicted++;
    else unverified++;
  }
  return {
    totalClaims: claims.length,
    supportedCount: supported,
    contradictedCount: contradicted,
    unverifiedCount: unverified,
    insufficientEvidence: claims.length > 0 && supported === 0 && contradicted === 0
  };
}

function buildVerificationPrompt(content, sources) {
  const evidenceBlock = sources.length === 0
    ? '(No evidence sources were provided. Identify factual claims and classify every claim as unverified. Do not invent sources.)'
    : sources.map((s, i) => {
      return `SOURCE ${i + 1}
Title: ${s.title}
Reference URL (do not fetch; label only): ${s.url || '(none)'}
Pasted evidence text:
"""
${s.text || '(empty — treat as no evidence)'}
"""`;
    }).join('\n\n');

  return `You are BrandGuard AI's Factual Claim Verifier.
Extract factual claims from marketing content and compare each claim ONLY against the pasted evidence sources below.

STRICT RULES:
1. Use only the pasted evidence text. Never browse the web. Never fetch URLs.
2. Treat reference URLs as labels only. A URL does not prove a claim.
3. Never invent citations, studies, statistics, or source titles that were not provided.
4. Classify each claim as exactly one of: supported, contradicted, unverified.
5. supported: the pasted evidence explicitly states the same fact.
6. contradicted: the pasted evidence explicitly conflicts with the claim.
7. unverified: evidence is missing, incomplete, off-topic, or only loosely related. When in doubt, use unverified.
8. evidenceExcerpt must be a verbatim substring copied from pasted evidence text. If you cannot copy a real substring, leave evidenceExcerpt empty and classify unverified.
9. sourceTitle must match a provided source title exactly when an excerpt is used.
10. Do not approve marketing content. This is evidence-assistance only.

MARKETING CONTENT:
"""
${content}
"""

EVIDENCE SOURCES:
${evidenceBlock}`;
}

async function callGeminiJson({ prompt, timeoutMs, clientOverride, apiKey }) {
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

  let apiCallPromise;
  if (ai.interactions && typeof ai.interactions.create === 'function') {
    apiCallPromise = ai.interactions.create({
      model: DEFAULT_MODEL,
      input: prompt,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema: CLAIM_JSON_SCHEMA
      }
    });
  } else if (ai.models && typeof ai.models.generateContent === 'function') {
    apiCallPromise = ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt
    });
  } else {
    return {
      success: false,
      code: 'SDK_INIT_ERROR',
      error: 'GoogleGenAI client does not support interactions.create'
    };
  }

  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutErr.code = 'TIMEOUT';
      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    const interaction = await Promise.race([apiCallPromise, timeoutPromise]);
    clearTimeout(timeoutHandle);
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
    return { success: true, parsed };
  } catch (err) {
    clearTimeout(timeoutHandle);
    const httpStatus = err.status || err.statusCode || null;
    if (err.code === 'TIMEOUT') {
      return {
        success: false,
        code: 'TIMEOUT',
        httpStatus,
        error: sanitizeErrorMessage(err)
      };
    }
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

/**
 * Identify factual claims and compare them to pasted evidence using Gemini.
 *
 * @param {object} params
 * @param {string} params.content
 * @param {Array} params.evidenceSources
 * @param {number} [params.timeoutMs]
 * @param {object} [params.clientOverride]
 */
async function verifyClaims({
  content,
  evidenceSources,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  clientOverride = null
} = {}) {
  const validation = validateVerifyInput({ content, evidenceSources });
  if (!validation.ok) {
    return {
      success: false,
      code: validation.code,
      error: validation.error
    };
  }

  const sources = normalizeEvidenceSources(evidenceSources || []);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!clientOverride && (!apiKey || apiKey === 'your_key_here')) {
    return {
      success: false,
      code: 'MISSING_API_KEY',
      error: 'Gemini API key is not configured. Set GEMINI_API_KEY in your environment or .env file.'
    };
  }

  const prompt = buildVerificationPrompt(content, sources);
  const geminiResult = await callGeminiJson({
    prompt,
    timeoutMs,
    clientOverride,
    apiKey
  });

  if (!geminiResult.success) {
    return geminiResult;
  }

  const grounded = groundClaimsAgainstEvidence(geminiResult.parsed.claims, sources, content);
  const summary = summarizeClaims(grounded);

  return {
    success: true,
    source: DEFAULT_MODEL,
    model: DEFAULT_MODEL,
    autoApproved: false,
    publicationApproved: false,
    reviewStatus: 'pending_human_review',
    requiresHumanReview: true,
    disclaimer: 'Evidence-based assistance only. This is not guaranteed legal or factual verification, and it does not approve marketing content for publication.',
    summary,
    claims: grounded,
    evidenceSourceCount: sources.length,
    urlsFetched: false,
    auditTimestamp: new Date().toISOString()
  };
}

module.exports = {
  verifyClaims,
  validateVerifyInput,
  normalizeEvidenceSources,
  groundClaimsAgainstEvidence,
  summarizeClaims,
  normalizeClassification,
  looksLikeUrl,
  buildVerificationPrompt,
  CLAIM_JSON_SCHEMA,
  CLASSIFICATIONS,
  MAX_CONTENT_CHARS,
  MAX_SOURCES
};
