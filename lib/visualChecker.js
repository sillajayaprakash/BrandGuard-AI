/**
 * BrandGuard AI - Visual Brand & Accessibility Checker
 * Performs deterministic analysis on HTML/markup for brand visual compliance and accessibility.
 * Does not execute uploaded HTML/JS. Does not fetch external URLs.
 */

const { GoogleGenAI } = require('@google/genai');
const {
  sanitizeErrorMessage,
  isGeminiConfigured,
  DEFAULT_MODEL
} = require('./geminiChecker.js');

const MAX_HTML_CHARS = 50000;
const DEFAULT_TIMEOUT_MS = 25000;

const VISUAL_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        overallAssessment: { type: 'string' },
        visualCriticalCount: { type: 'integer' },
        visualWarningCount: { type: 'integer' },
        visualAdvisoryCount: { type: 'integer' },
        a11yCriticalCount: { type: 'integer' },
        a11yWarningCount: { type: 'integer' },
        a11yAdvisoryCount: { type: 'integer' },
        needsHumanReviewCount: { type: 'integer' }
      },
      required: ['overallAssessment', 'visualCriticalCount', 'visualWarningCount', 'visualAdvisoryCount', 'a11yCriticalCount', 'a11yWarningCount', 'a11yAdvisoryCount', 'needsHumanReviewCount']
    },
    score: { type: 'integer', description: 'Visual compliance score 0-100' },
    visualFindings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', description: 'color, typography, logo, spacing' },
          categoryLabel: { type: 'string' },
          severity: { type: 'string', description: 'critical, warning, advisory' },
          matchedText: { type: 'string' },
          explanation: { type: 'string' },
          suggestedCorrection: { type: 'string' },
          confidence: { type: 'number' },
          needsHumanReview: { type: 'boolean' },
          detectedValue: { type: 'string' },
          expectedValue: { type: 'string' }
        },
        required: ['id', 'category', 'categoryLabel', 'severity', 'matchedText', 'explanation', 'suggestedCorrection', 'confidence', 'needsHumanReview']
      }
    },
    a11yFindings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          category: { type: 'string', description: 'alt-text, contrast, forms, semantics, aria' },
          categoryLabel: { type: 'string' },
          severity: { type: 'string', description: 'critical, warning, advisory' },
          matchedText: { type: 'string' },
          explanation: { type: 'string' },
          suggestedCorrection: { type: 'string' },
          confidence: { type: 'number' },
          needsHumanReview: { type: 'boolean' },
          wcagCriterion: { type: 'string' },
          automated: { type: 'boolean', description: 'true if fully automatable, false if requires human judgment' }
        },
        required: ['id', 'category', 'categoryLabel', 'severity', 'matchedText', 'explanation', 'suggestedCorrection', 'confidence', 'needsHumanReview', 'wcagCriterion', 'automated']
      }
    }
  },
  required: ['summary', 'score', 'visualFindings', 'a11yFindings']
};

function parseColorValue(str) {
  const hexMatch = str.match(/#[0-9a-fA-F]{3,8}/g);
  const rgbMatch = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/gi);
  const rgbaMatch = str.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/gi);
  const hslMatch = str.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/gi);
  return [...(hexMatch || []), ...(rgbMatch || []), ...(rgbaMatch || []), ...(hslMatch || [])];
}

function normalizeColor(color) {
  const c = color.trim().toLowerCase();
  if (c.startsWith('#')) {
    if (c.length === 4) {
      return '#' + c[1].repeat(2) + c[2].repeat(2) + c[3].repeat(2);
    }
    if (c.length === 7) return c;
    if (c.length === 9) return c.slice(0, 7);
  }
  return c;
}

function hexToRgb(hex) {
  const clean = normalizeColor(hex);
  if (!clean.startsWith('#') || clean.length !== 7) return null;
  const hexPart = clean.slice(1);
  if (!/^[0-9a-f]{6}$/i.test(hexPart)) return null;
  const r = parseInt(hexPart.slice(0, 2), 16);
  const g = parseInt(hexPart.slice(2, 4), 16);
  const b = parseInt(hexPart.slice(4, 6), 16);
  return { r, g, b };
}

function getLuminance(r, g, b) {
  const srgb = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg, bg) {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  if (!fgRgb || !bgRgb) return null;
  const L1 = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const L2 = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractColorsFromHtml(html) {
  const colors = new Set();
  const styleRegex = /(?:color|background|border|fill|stroke)\s*:\s*([^;}]+)/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    const found = parseColorValue(match[1]);
    found.forEach(c => colors.add(normalizeColor(c)));
  }
  const inlineStyleRegex = /style\s*=\s*["'][^"']*["']/gi;
  while ((match = inlineStyleRegex.exec(html)) !== null) {
    const found = parseColorValue(match[0]);
    found.forEach(c => colors.add(normalizeColor(c)));
  }
  return Array.from(colors);
}

function extractFontsFromHtml(html) {
  const fonts = new Set();
  const fontRegex = /font-family\s*:\s*([^;}]+)/gi;
  let match;
  while ((match = fontRegex.exec(html)) !== null) {
    const families = match[1].split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''));
    families.forEach(f => fonts.add(f));
  }
  return Array.from(fonts);
}

function extractImagesFromHtml(html) {
  const images = [];
  const imgRegex = /<img[^>]+>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);
    const hasAlt = altMatch !== null;
    const altText = hasAlt ? altMatch[1] : '';
    images.push({
      src: srcMatch ? srcMatch[1] : '',
      alt: altText,
      hasAlt,
      emptyAlt: hasAlt && altText.trim() === '',
      tag
    });
  }
  return images;
}

function extractFormElementsFromHtml(html) {
  const elements = [];
  const inputRegex = /<(input|select|textarea|button)[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0];
    const typeMatch = tag.match(/type\s*=\s*["']([^"']+)["']/i);
    const idMatch = tag.match(/id\s*=\s*["']([^"']+)["']/i);
    const nameMatch = tag.match(/name\s*=\s*["']([^"']+)["']/i);
    const ariaLabelMatch = tag.match(/aria-label\s*=\s*["']([^"']+)["']/i);
    const ariaLabelledByMatch = tag.match(/aria-labelledby\s*=\s*["']([^"']+)["']/i);
    const labelMatch = html.match(new RegExp(`<label[^>]*for\\s*=\\s*["']${idMatch ? idMatch[1] : ''}["'][^>]*>[^<]*</label>`, 'i'));

    // For buttons, also check text content between opening and closing tags
    let buttonText = '';
    if (match[1] === 'button') {
      const buttonRegex = new RegExp(`<button[^>]*>([\\s\\S]*?)</button>`, 'i');
      const buttonMatch = html.match(buttonRegex);
      if (buttonMatch && buttonMatch[1]) {
        buttonText = buttonMatch[1].trim();
      }
    }

    elements.push({
      tag: match[1],
      type: typeMatch ? typeMatch[1] : '',
      id: idMatch ? idMatch[1] : '',
      name: nameMatch ? nameMatch[1] : '',
      hasLabel: !!labelMatch,
      hasAriaLabel: !!ariaLabelMatch,
      hasAriaLabelledBy: !!ariaLabelledByMatch,
      hasButtonText: buttonText.length > 0,
      buttonText: buttonText,
      tagHtml: tag
    });
  }
  return elements;
}

function extractSemanticIssues(html) {
  const issues = [];
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ level: parseInt(match[1]), tag: match[0] });
  }
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      issues.push({
        category: 'semantics',
        categoryLabel: 'Heading Hierarchy',
        severity: 'warning',
        matchedText: headings[i].tag,
        explanation: `Heading level jumps from h${headings[i - 1].level} to h${headings[i].level}. Use sequential heading levels.`,
        suggestedCorrection: `Use h${headings[i - 1].level + 1} or restructure heading hierarchy.`,
        wcagCriterion: '1.3.1 Info and Relationships',
        automated: true
      });
    }
  }
  if (html.includes('<main') === false && html.includes('<article') === false) {
    issues.push({
      category: 'semantics',
      categoryLabel: 'Landmark Regions',
      severity: 'advisory',
      matchedText: 'document',
      explanation: 'Page lacks a <main> or <article> landmark. Add semantic landmarks for screen reader navigation.',
      suggestedCorrection: 'Wrap primary content in <main> element.',
      wcagCriterion: '1.3.1 Info and Relationships',
      automated: true
    });
  }
  return issues;
}

function extractColorPairsFromHtml(html) {
  const pairs = [];
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleBlockRegex.exec(html)) !== null) {
    const css = styleMatch[1];
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let ruleMatch;
    while ((ruleMatch = ruleRegex.exec(css)) !== null) {
      const selector = ruleMatch[1].trim();
      const declarations = ruleMatch[2];
      const colorMatch = declarations.match(/color\s*:\s*([^;}]+)/i);
      const bgMatch = declarations.match(/background(?:-color)?\s*:\s*([^;}]+)/i);
      if (colorMatch && bgMatch) {
        const fgColors = parseColorValue(colorMatch[1]);
        const bgColors = parseColorValue(bgMatch[1]);
        fgColors.forEach(fg => {
          bgColors.forEach(bg => {
            const normFg = normalizeColor(fg);
            const normBg = normalizeColor(bg);
            if (normFg !== 'transparent' && normFg !== 'inherit' && normFg !== 'currentcolor' &&
                normBg !== 'transparent' && normBg !== 'inherit' && normBg !== 'currentcolor') {
              pairs.push({ fg: normFg, bg: normBg, selector, source: 'stylesheet' });
            }
          });
        });
      }
    }
  }

  const inlineStyleRegex = /style\s*=\s*["']([^"']*)["']/gi;
  while ((styleMatch = inlineStyleRegex.exec(html)) !== null) {
    const declarations = styleMatch[1];
    const colorMatch = declarations.match(/color\s*:\s*([^;}]+)/i);
    const bgMatch = declarations.match(/background(?:-color)?\s*:\s*([^;}]+)/i);
    if (colorMatch && bgMatch) {
      const fgColors = parseColorValue(colorMatch[1]);
      const bgColors = parseColorValue(bgMatch[1]);
      fgColors.forEach(fg => {
        bgColors.forEach(bg => {
          const normFg = normalizeColor(fg);
          const normBg = normalizeColor(bg);
          if (normFg !== 'transparent' && normFg !== 'inherit' && normFg !== 'currentcolor' &&
              normBg !== 'transparent' && normBg !== 'inherit' && normBg !== 'currentcolor') {
            pairs.push({ fg: normFg, bg: normBg, selector: 'inline', source: 'inline' });
          }
        });
      });
    }
  }

  return pairs;
}

function checkLogoReferences(html, preset) {
  const findings = [];
  let issueCounter = 0;
  const logoConfig = preset.brandLogo;
  if (!logoConfig || !logoConfig.required) return findings;

  const images = extractImagesFromHtml(html);
  let hasLogoReference = false;
  let hasPotentialLogo = false;

  for (const img of images) {
    const src = img.src.toLowerCase();
    const alt = img.alt.toLowerCase();

    const isLogoFilename = logoConfig.allowedVariants.some(v =>
      src.includes(v.toLowerCase()) || src.includes('logo')
    );
    const isLogoAlt = alt.includes('logo') || alt.includes('brand');

    if (isLogoFilename || isLogoAlt) {
      hasPotentialLogo = true;
      if (img.hasAlt && !img.emptyAlt) {
        hasLogoReference = true;
      }
    }
  }

  if (!hasPotentialLogo) {
    findings.push({
      id: `vis_logo_${++issueCounter}`,
      category: 'logo',
      categoryLabel: 'Missing Logo Reference',
      severity: 'critical',
      matchedText: 'document',
      explanation: 'No logo reference found in HTML. Brand guidelines require a logo to be present.',
      suggestedCorrection: `Add an <img> tag with your brand logo (e.g., ${logoConfig.allowedVariants.join(', ')} variant).`,
      confidence: 0.8,
      needsHumanReview: false,
      detectedValue: 'none',
      expectedValue: 'logo reference',
      engine: 'deterministic'
    });
  } else if (!hasLogoReference) {
    findings.push({
      id: `vis_logo_${++issueCounter}`,
      category: 'logo',
      categoryLabel: 'Logo Missing Alt Text',
      severity: 'critical',
      matchedText: 'logo image',
      explanation: 'Logo image found but missing descriptive alt text. Logo images must have alt text identifying the brand.',
      suggestedCorrection: 'Add alt attribute describing the logo (e.g., "CompanyName primary logo").',
      confidence: 0.9,
      needsHumanReview: false,
      detectedValue: 'empty or missing alt',
      expectedValue: 'descriptive alt text',
      engine: 'deterministic'
    });
  }

  findings.push({
    id: `vis_logo_review_${++issueCounter}`,
    category: 'logo',
    categoryLabel: 'Logo Visual Verification Required',
    severity: 'advisory',
    matchedText: 'logo reference',
    explanation: 'Automated checks cannot verify pixel-perfect logo compliance (correct proportions, colors, clear space, forbidden backgrounds). Visual identity matching requires human design review.',
    suggestedCorrection: 'Have a designer verify logo usage matches brand guidelines exactly.',
    confidence: 0.5,
    needsHumanReview: true,
    detectedValue: 'automated check only',
    expectedValue: 'human design review',
    engine: 'deterministic'
  });

  return findings;
}

function validateInput({ html, preset }) {
  if (!html || typeof html !== 'string' || html.trim() === '') {
    return { ok: false, code: 'INVALID_INPUT', error: 'HTML content is required for visual audit.' };
  }
  if (html.length > MAX_HTML_CHARS) {
    return { ok: false, code: 'INVALID_INPUT', error: `HTML content exceeds the ${MAX_HTML_CHARS} character limit.` };
  }
  if (!preset || typeof preset !== 'object') {
    return { ok: false, code: 'INVALID_INPUT', error: 'Valid brand preset is required.' };
  }
  return { ok: true };
}

function buildVisualPrompt(html, preset) {
  const colors = preset.brandColors || {};
  const typography = preset.brandTypography || {};
  const logo = preset.brandLogo || {};

  const colorList = Object.entries(colors)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const fontList = [
    `Heading font: ${typography.headingFont || 'Not specified'}`,
    `Body font: ${typography.bodyFont || 'Not specified'}`,
    `Monospace font: ${typography.monoFont || 'Not specified'}`,
    `Base size: ${typography.baseSize || 'Not specified'}`,
    `Line height: ${typography.lineHeight || 'Not specified'}`
  ].join('\n');

  return `You are BrandGuard AI's Visual Brand & Accessibility Auditor.
Analyze the provided HTML markup against the brand's visual guidelines and WCAG 2.2 AA accessibility standards.

BRAND VISUAL GUIDELINES:
Brand Colors:
${colorList}

Brand Typography:
${fontList}

Logo Requirements:
- Required: ${logo.required ? 'Yes' : 'No'}
- Allowed variants: ${(logo.allowedVariants || []).join(', ') || 'None specified'}
- Min clear space: ${logo.minClearSpace || 'Not specified'}
- Min width: ${logo.minWidth || 'Not specified'}
- Forbidden backgrounds: ${(logo.forbiddenBackgrounds || []).join(', ') || 'None specified'}

WCAG 2.2 AA REQUIREMENTS:
- Contrast: Normal text 4.5:1, Large text (18pt+/14pt+ bold) 3:1
- Non-text contrast (UI components, graphics): 3:1
- Alt text for informative images
- Form labels and accessible names
- Semantic HTML structure
- Focus indicators
- Language declaration

STRICT RULES:
1. Analyze ONLY the provided HTML. Do not fetch external resources.
2. For colors: Compare detected colors in styles/attributes against approved palette. Flag unapproved colors.
3. For typography: Compare font-family declarations against approved fonts. Flag unapproved fonts.
4. For logo: Check for logo references (img with brand logo, SVG with brand marks). Note: Cannot verify pixel-perfect logo match without reference image.
5. For accessibility: Check alt attributes, contrast (calculate from color values), form labels, semantic structure.
6. Classify findings as: critical (WCAG failure / brand violation), warning (likely issue), advisory (improvement).
7. Mark automated=true for fully checkable rules, false for issues requiring human judgment.
8. Provide detectedValue and expectedValue for color/typography issues.
9. Reference WCAG criterion for accessibility findings.
10. Do not approve content. Human review always required.

HTML TO AUDIT:
"""
${html}
"""`;
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
        schema: VISUAL_JSON_SCHEMA
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

function runDeterministicChecks(html, preset) {
  const findings = [];
  let issueCounter = 0;

  const approvedColors = preset.brandColors ? Object.values(preset.brandColors).map(normalizeColor) : [];
  const detectedColors = extractColorsFromHtml(html);

  for (const color of detectedColors) {
    const isApproved = approvedColors.some(ac => ac === color);
    if (!isApproved && color !== 'transparent' && color !== 'inherit' && color !== 'currentcolor') {
      const closest = approvedColors.length > 0
        ? approvedColors.reduce((prev, curr) => {
            const prevDist = colorDistance(color, prev);
            const currDist = colorDistance(color, curr);
            return currDist < prevDist ? curr : prev;
          })
        : null;
      findings.push({
        id: `vis_color_${++issueCounter}`,
        category: 'color',
        categoryLabel: 'Unapproved Color',
        severity: 'warning',
        matchedText: color,
        explanation: `Color ${color} is not in the approved brand palette.`,
        suggestedCorrection: closest ? `Use approved color ${closest} instead.` : 'Add this color to brand palette or use an approved alternative.',
        confidence: 0.9,
        needsHumanReview: false,
        detectedValue: color,
        expectedValue: closest || 'approved palette color',
        engine: 'deterministic'
      });
    }
  }

  const approvedFonts = new Set([
    preset.brandTypography?.headingFont,
    preset.brandTypography?.bodyFont,
    preset.brandTypography?.monoFont
  ].filter(Boolean).map(f => f.toLowerCase()));

  const systemFonts = new Set([
    'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'arial',
    'ui-monospace', 'sfmono-regular', 'menlo', 'monaco', 'consolas', 'liberation mono', 'courier new',
    'inter', 'dm sans', 'jetbrains mono'
  ]);

  const detectedFonts = extractFontsFromHtml(html);
  for (const font of detectedFonts) {
    const fontLower = font.toLowerCase();
    const isApproved = approvedFonts.has(fontLower) || systemFonts.has(fontLower);
    if (!isApproved) {
      const suggested = preset.brandTypography?.bodyFont || 'system-ui, sans-serif';
      findings.push({
        id: `vis_font_${++issueCounter}`,
        category: 'typography',
        categoryLabel: 'Unapproved Font',
        severity: 'warning',
        matchedText: font,
        explanation: `Font family "${font}" is not in the approved brand typography.`,
        suggestedCorrection: `Use approved font: ${suggested}.`,
        confidence: 0.85,
        needsHumanReview: false,
        detectedValue: font,
        expectedValue: suggested,
        engine: 'deterministic'
      });
    }
  }

  // WCAG 2.2 AA contrast checking using actual contrast ratio computation
  const colorPairs = extractColorPairsFromHtml(html);
  for (const pair of colorPairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    if (ratio === null) {
      // Cannot determine a reliable foreground/background pair — mark for human review
      findings.push({
        id: `vis_a11y_contrast_unknown_${++issueCounter}`,
        category: 'contrast',
        categoryLabel: 'Contrast Cannot Be Determined',
        severity: 'advisory',
        matchedText: pair.selector,
        explanation: `Unable to reliably determine contrast for ${pair.selector}. Foreground or background color may be dynamic, inherited, or use non-hex values. Manual review required.`,
        suggestedCorrection: 'Ensure text meets WCAG 2.2 AA contrast: normal text 4.5:1, large text 3:1.',
        confidence: 0.3,
        needsHumanReview: true,
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        automated: false,
        engine: 'deterministic'
      });
      continue;
    }
    const failsNormal = ratio < 4.5;
    const failsLarge = ratio < 3;
    if (failsNormal) {
      findings.push({
        id: `vis_a11y_contrast_${++issueCounter}`,
        category: 'contrast',
        categoryLabel: 'Insufficient Contrast',
        severity: failsLarge ? 'critical' : 'warning',
        matchedText: pair.selector,
        explanation: `Contrast ratio ${ratio.toFixed(2)}:1 for ${pair.fg} on ${pair.bg} fails WCAG 2.2 AA. Normal text requires 4.5:1; large text requires 3:1.`,
        suggestedCorrection: `Increase contrast to at least 4.5:1 for normal text or 3:1 for large text. Current: ${ratio.toFixed(2)}:1.`,
        confidence: 0.95,
        needsHumanReview: false,
        wcagCriterion: '1.4.3 Contrast (Minimum)',
        automated: true,
        engine: 'deterministic',
        detectedValue: `${ratio.toFixed(2)}:1`,
        expectedValue: '4.5:1 (normal text) / 3:1 (large text)'
      });
    }
  }

  // Brand logo checking using the selected preset's brandLogo settings
  const logoFindings = checkLogoReferences(html, preset);
  findings.push(...logoFindings);

  const images = extractImagesFromHtml(html);
  for (const img of images) {
    if (!img.hasAlt) {
      findings.push({
        id: `vis_a11y_alt_${++issueCounter}`,
        category: 'alt-text',
        categoryLabel: 'Missing Alt Text',
        severity: 'critical',
        matchedText: img.tag,
        explanation: 'Image is missing an alt attribute. All images must have alt text for screen readers.',
        suggestedCorrection: 'Add alt="descriptive text" for informative images, or alt="" for decorative images.',
        confidence: 1.0,
        needsHumanReview: false,
        wcagCriterion: '1.1.1 Non-text Content',
        automated: true,
        engine: 'deterministic'
      });
    } else if (img.emptyAlt && !img.src.endsWith('.svg') && !img.tag.includes('aria-hidden')) {
      findings.push({
        id: `vis_a11y_empty_alt_${++issueCounter}`,
        category: 'alt-text',
        categoryLabel: 'Empty Alt Text (Review Needed)',
        severity: 'warning',
        matchedText: img.tag,
        explanation: 'Image has empty alt text. Verify this image is truly decorative. If informative, add descriptive alt text.',
        suggestedCorrection: 'If decorative: keep alt="". If informative: add descriptive alt text.',
        confidence: 0.7,
        needsHumanReview: true,
        wcagCriterion: '1.1.1 Non-text Content',
        automated: false,
        engine: 'deterministic'
      });
    }
  }

  const formElements = extractFormElementsFromHtml(html);
  for (const el of formElements) {
    if (['input', 'select', 'textarea'].includes(el.tag) && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button') {
      const hasAccessibleName = el.hasLabel || el.hasAriaLabel || el.hasAriaLabelledBy;
      if (!hasAccessibleName) {
        findings.push({
          id: `vis_a11y_form_${++issueCounter}`,
          category: 'forms',
          categoryLabel: 'Missing Form Label',
          severity: 'critical',
          matchedText: el.tagHtml,
          explanation: `<${el.tag}> element (${el.type || 'text'}) lacks an accessible name. Use <label for="...">, aria-label, or aria-labelledby.`,
          suggestedCorrection: 'Add associated <label>, aria-label, or aria-labelledby attribute.',
          confidence: 1.0,
          needsHumanReview: false,
          wcagCriterion: '1.3.1 Info and Relationships, 3.3.2 Labels or Instructions',
          automated: true,
          engine: 'deterministic'
        });
      }
    }
    if (el.tag === 'button' || el.type === 'submit' || el.type === 'button') {
      const hasName = el.hasLabel || el.hasAriaLabel || el.hasAriaLabelledBy || el.name || el.hasButtonText;
      if (!hasName) {
        findings.push({
          id: `vis_a11y_btn_${++issueCounter}`,
          category: 'forms',
          categoryLabel: 'Missing Button Accessible Name',
          severity: 'critical',
          matchedText: el.tagHtml,
          explanation: 'Button lacks an accessible name. Add text content, aria-label, or aria-labelledby.',
          suggestedCorrection: 'Ensure button has visible text or aria-label.',
          confidence: 1.0,
          needsHumanReview: false,
          wcagCriterion: '4.1.2 Name, Role, Value',
          automated: true,
          engine: 'deterministic'
        });
      }
    }
  }

  const semanticIssues = extractSemanticIssues(html);
  for (const issue of semanticIssues) {
    findings.push({
      id: `vis_a11y_sem_${++issueCounter}`,
      ...issue,
      engine: 'deterministic'
    });
  }

  const hasLang = /<html[^>]*lang\s*=\s*["'][^"']+["']/i.test(html);
  if (!hasLang) {
    findings.push({
      id: `vis_a11y_lang_${++issueCounter}`,
      category: 'semantics',
      categoryLabel: 'Missing Language Declaration',
      severity: 'warning',
      matchedText: '<html>',
      explanation: 'HTML element lacks lang attribute. Screen readers need this for correct pronunciation.',
      suggestedCorrection: 'Add lang="en" (or appropriate language code) to <html> element.',
      confidence: 1.0,
      needsHumanReview: false,
      wcagCriterion: '3.1.1 Language of Page',
      automated: true,
      engine: 'deterministic'
    });
  }

  return findings;
}

function colorDistance(c1, c2) {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  if (!rgb1 || !rgb2) return Infinity;
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

function categorizeFindings(findings) {
  const visual = findings.filter(f => f.category === 'color' || f.category === 'typography' || f.category === 'logo' || f.category === 'spacing');
  const a11y = findings.filter(f => f.category !== 'color' && f.category !== 'typography' && f.category !== 'logo' && f.category !== 'spacing');
  return { visual, a11y };
}

function calculateScore(findings) {
  let deduction = 0;
  for (const f of findings) {
    if (f.severity === 'critical') deduction += 22;
    else if (f.severity === 'warning') deduction += 11;
    else deduction += 5;
  }
  return Math.max(0, Math.min(98, 100 - deduction));
}

function calculateSummary(visual, a11y) {
  const countBySeverity = (arr, prefix) => ({
    [`${prefix}CriticalCount`]: arr.filter(f => f.severity === 'critical').length,
    [`${prefix}WarningCount`]: arr.filter(f => f.severity === 'warning').length,
    [`${prefix}AdvisoryCount`]: arr.filter(f => f.severity === 'advisory').length,
    [`${prefix}NeedsHumanReviewCount`]: arr.filter(f => f.needsHumanReview).length
  });
  return {
    overallAssessment: 'Visual brand and accessibility audit completed.',
    ...countBySeverity(visual, 'visual'),
    ...countBySeverity(a11y, 'a11y')
  };
}

async function analyzeVisual({
  html,
  preset,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  clientOverride = null
} = {}) {
  const validation = validateInput({ html, preset });
  if (!validation.ok) {
    return { success: false, code: validation.code, error: validation.error };
  }

  const deterministicFindings = runDeterministicChecks(html, preset);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!clientOverride && (!apiKey || apiKey === 'your_key_here')) {
    // Gemini not configured — return deterministic findings instead of discarding them
    return buildDeterministicResult(deterministicFindings, 'Gemini API key is not configured. Set GEMINI_API_KEY in your environment or .env file.');
  }

  const prompt = buildVisualPrompt(html, preset);
  const geminiResult = await callGeminiJson({
    prompt,
    timeoutMs,
    clientOverride,
    apiKey
  });

  let allFindings = [...deterministicFindings];
  let aiReviewUnavailable = false;
  let aiUnavailableReason = null;
  if (!geminiResult.success) {
    // Gemini failed (timeout, unavailable, error) — return deterministic findings
    aiReviewUnavailable = true;
    aiUnavailableReason = geminiResult.error;
  } else {
    const aiVisual = geminiResult.parsed.visualFindings || [];
    const aiA11y = geminiResult.parsed.a11yFindings || [];
    allFindings = [...allFindings, ...aiVisual, ...aiA11y];
  }

  const { visual, a11y } = categorizeFindings(allFindings);
  const summary = calculateSummary(visual, a11y);
  const score = calculateScore(allFindings);

  let status = 'compliant';
  if (score < 70 || summary.visualCriticalCount >= 2 || summary.a11yCriticalCount >= 1) {
    status = 'non_compliant';
  } else if (score < 90 || summary.visualWarningCount > 0 || summary.a11yWarningCount > 0) {
    status = 'needs_revision';
  }

  return {
    success: true,
    source: aiReviewUnavailable ? 'deterministic' : DEFAULT_MODEL,
    model: aiReviewUnavailable ? null : DEFAULT_MODEL,
    aiReviewUnavailable,
    aiUnavailableReason,
    score,
    status,
    summary,
    visualFindings: visual,
    a11yFindings: a11y,
    deterministicFindingsCount: deterministicFindings.length,
    aiFindingsCount: aiReviewUnavailable ? 0 : allFindings.length - deterministicFindings.length,
    autoApproved: false,
    publicationApproved: false,
    reviewStatus: 'pending_human_review',
    requiresHumanReview: true,
    disclaimer: aiReviewUnavailable
      ? `Deterministic checks only. AI review was unavailable: ${aiUnavailableReason}. This is not a substitute for human accessibility audit or design review. Cannot verify pixel-perfect logo compliance without reference image. Does not execute HTML/JS.`
      : 'Automated visual and accessibility checks only. This is not a substitute for human accessibility audit or design review. Cannot verify pixel-perfect logo compliance without reference image. Does not execute HTML/JS.',
    auditTimestamp: new Date().toISOString()
  };
}

/**
 * Build a result object from deterministic findings only (used when Gemini is unavailable).
 * Never labels the result as a completed AI review.
 */
function buildDeterministicResult(deterministicFindings, aiUnavailableReason) {
  const { visual, a11y } = categorizeFindings(deterministicFindings);
  const summary = calculateSummary(visual, a11y);
  const score = calculateScore(deterministicFindings);

  let status = 'compliant';
  if (score < 70 || summary.visualCriticalCount >= 2 || summary.a11yCriticalCount >= 1) {
    status = 'non_compliant';
  } else if (score < 90 || summary.visualWarningCount > 0 || summary.a11yWarningCount > 0) {
    status = 'needs_revision';
  }

  return {
    success: true,
    source: 'deterministic',
    model: null,
    aiReviewUnavailable: true,
    aiUnavailableReason,
    score,
    status,
    summary,
    visualFindings: visual,
    a11yFindings: a11y,
    deterministicFindingsCount: deterministicFindings.length,
    aiFindingsCount: 0,
    autoApproved: false,
    publicationApproved: false,
    reviewStatus: 'pending_human_review',
    requiresHumanReview: true,
    disclaimer: `Deterministic checks only. AI review was unavailable: ${aiUnavailableReason}. This is not a substitute for human accessibility audit or design review. Cannot verify pixel-perfect logo compliance without reference image. Does not execute HTML/JS.`,
    auditTimestamp: new Date().toISOString()
  };
}

module.exports = {
  analyzeVisual,
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
  VISUAL_JSON_SCHEMA,
  MAX_HTML_CHARS
};