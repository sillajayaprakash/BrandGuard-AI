/**
 * BrandGuard AI - Brand Rules Manager
 * Handles editable brand governance rules, presets, and rule persistence.
 */

window.BrandRulesManager = (function () {
  const STORAGE_KEY = 'brandguard_custom_rules_v1';
  let activePresetKey = 'apexTech';
  let activeRules = null;

  /**
   * Clone a preset from PRESETS deep copy
   */
  function clonePreset(presetKey) {
    const source = (window.PRESETS && window.PRESETS[presetKey]) || {};
    return JSON.parse(JSON.stringify(source));
  }

  /**
   * Initialize rules from localStorage or fallback to default preset
   */
  function init(presetKey = 'apexTech') {
    activePresetKey = presetKey;
    const saved = localStorage.getItem(`${STORAGE_KEY}_${presetKey}`);
    if (saved) {
      try {
        activeRules = JSON.parse(saved);
      } catch {
        activeRules = clonePreset(presetKey);
      }
    } else {
      activeRules = clonePreset(presetKey);
    }
    save();
    return activeRules;
  }

  function getActiveRules() {
    if (!activeRules) {
      init(activePresetKey);
    }
    return activeRules;
  }

  function getActivePresetKey() {
    return activePresetKey;
  }

  function setPreset(presetKey) {
    activePresetKey = presetKey;
    init(presetKey);
  }

  function save() {
    if (activeRules) {
      localStorage.setItem(`${STORAGE_KEY}_${activePresetKey}`, JSON.stringify(activeRules));
    }
  }

  function resetToPresetDefaults() {
    activeRules = clonePreset(activePresetKey);
    save();
    return activeRules;
  }

  // --- CRUD Operations ---

  function addForbiddenPhrase(phrase, severity, explanation, suggested) {
    if (!activeRules.forbiddenPhrases) activeRules.forbiddenPhrases = [];
    const newRule = {
      id: `fp_${Date.now()}`,
      phrase: phrase.trim(),
      severity: severity || 'warning',
      explanation: explanation || `Prohibited in ${activeRules.name || 'brand'} guidelines.`,
      suggested: suggested ? suggested.trim() : null,
      disabled: false
    };
    activeRules.forbiddenPhrases.unshift(newRule);
    save();
    return newRule;
  }

  function addUnsupportedClaim(pattern, severity, explanation, suggested) {
    if (!activeRules.unsupportedClaims) activeRules.unsupportedClaims = [];
    const newRule = {
      id: `uc_${Date.now()}`,
      pattern: pattern.trim(),
      severity: severity || 'critical',
      explanation: explanation || 'Unsubstantiated claim requires documented verification.',
      suggested: suggested ? suggested.trim() : null,
      disabled: false
    };
    activeRules.unsupportedClaims.unshift(newRule);
    save();
    return newRule;
  }

  function addPreferredPhrase(phrase, preferred) {
    if (!activeRules.preferredPhrases) activeRules.preferredPhrases = [];
    const newRule = {
      id: `pp_${Date.now()}`,
      phrase: phrase.trim(),
      preferred: preferred.trim(),
      disabled: false
    };
    activeRules.preferredPhrases.unshift(newRule);
    save();
    return newRule;
  }

  function toggleRule(type, ruleId, disabledState) {
    let list = [];
    if (type === 'forbidden') list = activeRules.forbiddenPhrases;
    else if (type === 'claims') list = activeRules.unsupportedClaims;
    else if (type === 'preferred') list = activeRules.preferredPhrases;

    const rule = list.find(r => r.id === ruleId);
    if (rule) {
      rule.disabled = disabledState !== undefined ? disabledState : !rule.disabled;
      save();
    }
  }

  function deleteRule(type, ruleId) {
    if (type === 'forbidden' && activeRules.forbiddenPhrases) {
      activeRules.forbiddenPhrases = activeRules.forbiddenPhrases.filter(r => r.id !== ruleId);
    } else if (type === 'claims' && activeRules.unsupportedClaims) {
      activeRules.unsupportedClaims = activeRules.unsupportedClaims.filter(r => r.id !== ruleId);
    } else if (type === 'preferred' && activeRules.preferredPhrases) {
      activeRules.preferredPhrases = activeRules.preferredPhrases.filter(r => r.id !== ruleId);
    }
    save();
  }

  function updateToneSettings(settings) {
    if (!activeRules.toneRules) activeRules.toneRules = {};
    Object.assign(activeRules.toneRules, settings);
    save();
  }

  function getRuleCount() {
    const rules = getActiveRules();
    const fpCount = (rules.forbiddenPhrases || []).length;
    const ucCount = (rules.unsupportedClaims || []).length;
    const ppCount = (rules.preferredPhrases || []).length;
    return fpCount + ucCount + ppCount;
  }

  return {
    init,
    getActiveRules,
    getActivePresetKey,
    setPreset,
    resetToPresetDefaults,
    addForbiddenPhrase,
    addUnsupportedClaim,
    addPreferredPhrase,
    toggleRule,
    deleteRule,
    updateToneSettings,
    getRuleCount
  };
})();

