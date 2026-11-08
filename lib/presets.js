/**
 * BrandGuard AI - Default Presets & Sample Guidelines
 * Contains pre-configured brand profiles and sample test marketing copies.
 */

const PRESETS = {
  apexTech: {
    id: 'apexTech',
    name: 'ApexTech B2B SaaS',
    description: 'Enterprise B2B software guideline focused on credibility, professional tone, and verifiable technical claims.',
    targetTone: 'Professional, consultative, authoritative, and respectful.',
    forbiddenPhrases: [
      {
        id: 'fp_1',
        phrase: 'cheap',
        severity: 'warning',
        explanation: "Brand guidelines avoid 'cheap' as it devalues our premium enterprise positioning.",
        suggested: 'cost-effective'
      },
      {
        id: 'fp_2',
        phrase: 'foolproof',
        severity: 'warning',
        explanation: 'Over-promising technical perfection creates unrealistic customer expectations and contract risks.',
        suggested: 'robust'
      },
      {
        id: 'fp_3',
        phrase: 'secret sauce',
        severity: 'advisory',
        explanation: 'Colloquialism; preferred enterprise tone is professional and architectural.',
        suggested: 'proprietary methodology'
      },
      {
        id: 'fp_4',
        phrase: 'hack',
        severity: 'advisory',
        explanation: 'Informal jargon that undermines our rigorous engineering image.',
        suggested: 'strategic optimization'
      },
      {
        id: 'fp_5',
        phrase: 'revolutionary',
        severity: 'warning',
        explanation: 'Overused buzzword that causes buyer skepticism without technical evidence.',
        suggested: 'innovative'
      },
      {
        id: 'fp_6',
        phrase: 'miracle',
        severity: 'critical',
        explanation: 'Hyperbolic term prohibited in all corporate marketing communications.',
        suggested: 'breakthrough solution'
      },
      {
        id: 'fp_7',
        phrase: 'insane',
        severity: 'warning',
        explanation: 'Informal hyperbole; unsuited for enterprise procurement audiences.',
        suggested: 'exceptional'
      },
      {
        id: 'fp_8',
        phrase: 'no-brainer',
        severity: 'advisory',
        explanation: 'Casual slang; patronizes prospective decision-makers.',
        suggested: 'clear choice'
      }
    ],
    unsupportedClaims: [
      {
        id: 'uc_1',
        pattern: '\\b100%\\s*(?:guaranteed|safe|secure|uptime|success)\\b',
        severity: 'critical',
        explanation: 'Absolute guarantee claim exposes company to legal breach of warranty liability.',
        suggested: 'designed for high reliability (99.9% SLA)'
      },
      {
        id: 'uc_2',
        pattern: '\\b(?:world\'?s\\s+best|the\\s+best\\s+in\\s+the\\s+world|#1\\s+software)\\b',
        severity: 'critical',
        explanation: 'Unsubstantiated superlative claim; requires documented independent third-party market ranking.',
        suggested: 'industry-recognized platform'
      },
      {
        id: 'uc_3',
        pattern: '\\b(?:zero\\s+risk|no\\s+risk|100%\\s+risk-free|risk-free)\\b',
        severity: 'critical',
        explanation: 'Absolute risk elimination claims violate enterprise contracting standards.',
        suggested: 'backed by enterprise SLA and trial period'
      },
      {
        id: 'uc_4',
        pattern: '\\b(?:never\\s+fails|fail-proof|cannot\\s+fail)\\b',
        severity: 'critical',
        explanation: 'All distributed cloud architectures have failure modes; claims must reflect realistic resilience.',
        suggested: 'fault-tolerant and highly resilient'
      },
      {
        id: 'uc_5',
        pattern: '\\b(?:double\\s+your\\s+revenue|triple\\s+your\\s+sales|guaranteed\\s+roi)\\b',
        severity: 'critical',
        explanation: 'Financial ROI promises require verified case-study disclosures and disclaimers.',
        suggested: 'help accelerate your revenue pipeline'
      },
      {
        id: 'uc_6',
        pattern: '\\b(?:instant\\s+results|overnight\\s+success)\\b',
        severity: 'warning',
        explanation: 'Promises instantaneous ROI without acknowledging enterprise onboarding requirements.',
        suggested: 'rapid time-to-value'
      }
    ],
    preferredPhrases: [
      { id: 'pp_1', phrase: 'buy our software', preferred: 'subscribe to our enterprise platform' },
      { id: 'pp_2', phrase: 'users', preferred: 'team members and administrators' },
      { id: 'pp_3', phrase: 'problem', preferred: 'operational challenge' },
      { id: 'pp_4', phrase: 'vendors', preferred: 'strategic technology partners' },
      { id: 'pp_5', phrase: 'contract', preferred: 'service level agreement' }
    ],
    toneRules: {
      checkAggressiveUrgency: true,
      checkInformalSlang: true,
      checkExcessivePunctuation: true,
      checkAllCaps: true
    }
  },

  novaPay: {
    id: 'novaPay',
    name: 'NovaPay FinTech & Payments',
    description: 'Financial services guideline compliant with truth-in-lending and consumer financial protection standards.',
    targetTone: 'Trustworthy, transparent, compliant, and customer-first.',
    forbiddenPhrases: [
      {
        id: 'np_1',
        phrase: 'guaranteed returns',
        severity: 'critical',
        explanation: 'Regulatory violation: financial products cannot promise guaranteed returns without statutory deposit insurance context.',
        suggested: 'competitive interest yield'
      },
      {
        id: 'np_2',
        phrase: 'free money',
        severity: 'critical',
        explanation: 'Misleading marketing term strictly prohibited by financial consumer protection regulators.',
        suggested: 'introductory cash bonus'
      },
      {
        id: 'np_3',
        phrase: 'loophole',
        severity: 'critical',
        explanation: 'Suggests regulatory evasion or tax dodging, heavily damaging institutional compliance.',
        suggested: 'eligible regulatory provision'
      },
      {
        id: 'np_4',
        phrase: 'no strings attached',
        severity: 'warning',
        explanation: 'Financial contracts always contain terms and conditions; this phrase triggers compliance audits.',
        suggested: 'transparent terms with no hidden platform fees'
      },
      {
        id: 'np_5',
        phrase: 'get rich',
        severity: 'critical',
        explanation: 'Predatory financial language prohibited by regulatory standards.',
        suggested: 'build long-term financial health'
      }
    ],
    unsupportedClaims: [
      {
        id: 'np_uc1',
        pattern: '\\b(?:100%\\s+secure|unhackable|impossible\\s+to\\s+breach)\\b',
        severity: 'critical',
        explanation: 'Cybersecurity claims of 100% invulnerability violate FTC and FinCEN marketing guidelines.',
        suggested: 'protected by bank-grade 256-bit AES encryption'
      },
      {
        id: 'np_uc2',
        pattern: '\\b(?:zero\\s+fees\\s+ever|totally\\s+free\\s+forever)\\b',
        severity: 'warning',
        explanation: 'Broad fee exemption claims must footnote interchange and wire charges.',
        suggested: 'no monthly account maintenance fees'
      },
      {
        id: 'np_uc3',
        pattern: '\\b(?:instant\\s+approval|guaranteed\\s+approval)\\b',
        severity: 'critical',
        explanation: 'Lending decisions require KYC and underwriting; guaranteed approval violates credit regulations.',
        suggested: 'fast pre-qualification in as little as 2 minutes'
      }
    ],
    preferredPhrases: [
      { id: 'np_pp1', phrase: 'debt', preferred: 'credit facility' },
      { id: 'np_pp2', phrase: 'cheap loan', preferred: 'competitive rate financing' },
      { id: 'np_pp3', phrase: 'fine print', preferred: 'disclosure terms' }
    ],
    toneRules: {
      checkAggressiveUrgency: true,
      checkInformalSlang: true,
      checkExcessivePunctuation: true,
      checkAllCaps: true
    }
  },

  vitaLife: {
    id: 'vitaLife',
    name: 'VitaLife Health & Wellness',
    description: 'Wellness brand guidelines observing dietary supplement and health claim regulations (no medical cure claims).',
    targetTone: 'Empathetic, scientific, transparent, and encouraging.',
    forbiddenPhrases: [
      {
        id: 'vl_1',
        phrase: 'cure',
        severity: 'critical',
        explanation: 'Dietary supplements cannot claim to cure any disease or condition under FDA/FTC regulations.',
        suggested: 'support overall vitality'
      },
      {
        id: 'vl_2',
        phrase: 'miracle drug',
        severity: 'critical',
        explanation: 'Strictly prohibited health claim; supplements are not pharmaceutical drugs.',
        suggested: 'scientifically formulated botanical blend'
      },
      {
        id: 'vl_3',
        phrase: 'melt fat',
        severity: 'warning',
        explanation: 'Misleading weight loss terminology not supported by certified clinical trials.',
        suggested: 'supports healthy metabolism'
      },
      {
        id: 'vl_4',
        phrase: 'toxins',
        severity: 'warning',
        explanation: 'Vague detox claims without specific biochemical definitions trigger consumer protection flags.',
        suggested: 'natural cellular waste'
      }
    ],
    unsupportedClaims: [
      {
        id: 'vl_uc1',
        pattern: '\\b(?:100%\\s+effective|guaranteed\\s+weight\\s+loss)\\b',
        severity: 'critical',
        explanation: 'Nutritional efficacy varies individually; universal outcome guarantees violate health advertising standards.',
        suggested: 'clinically studied ingredients shown to support'
      },
      {
        id: 'vl_uc2',
        pattern: '\\b(?:treats\\s+anxiety|prevents\\s+cancer|reverses\\s+aging)\\b',
        severity: 'critical',
        explanation: 'Disease treatment/prevention claims classify products as unapproved new drugs.',
        suggested: 'promotes relaxation and cellular vitality'
      }
    ],
    preferredPhrases: [
      { id: 'vl_pp1', phrase: 'diet pill', preferred: 'daily wellness supplement' },
      { id: 'vl_pp2', phrase: 'fixes your body', preferred: 'complements a balanced routine' }
    ],
    toneRules: {
      checkAggressiveUrgency: true,
      checkInformalSlang: true,
      checkExcessivePunctuation: true,
      checkAllCaps: true
    }
  }
};

const SAMPLE_CONTENTS = {
  highRisk: {
    title: 'High-Risk Marketing Draft (Contains Major Violations)',
    targetPreset: 'apexTech',
    content: `ACT NOW BEFORE IT'S GONE!!! 

Our new ApexCloud platform is the world's best enterprise solution, offering 100% guaranteed uptime and zero risk for every company! 

Traditional vendors sell cheap tools with a complicated contract, but our secret sauce is a revolutionary hack that will double your revenue overnight. Our system never fails and it is an absolute no-brainer for users who wanna win big. 

This insane software is a miracle for your business problem. Buy our software immediately or regret missing out forever!!!`
  },

  moderateRisk: {
    title: 'Moderate Compliance Draft (Tone Slips & Preferred Phrases)',
    targetPreset: 'apexTech',
    content: `Welcome to the new ApexCloud release. 

We have engineered an innovative update to solve your everyday operational challenges. Unlike other cheap solutions on the market, our robust infrastructure delivers exceptional performance. 

Our team believes this platform is a revolutionary step forward. We invite all users to buy our software and see how our proprietary methodology transforms data processing. 

Schedule your consultation today to explore how we can optimize your workflow.`
  },

  compliant: {
    title: 'Fully Compliant Press Release (Approved)',
    targetPreset: 'apexTech',
    content: `ApexTech Announces Next-Generation Enterprise Cloud Governance Suite

SAN FRANCISCO — ApexTech, a provider of enterprise infrastructure solutions, today announced the general availability of its next-generation Cloud Governance Platform.

Designed for high reliability with a 99.9% availability service level agreement, the platform helps IT organizations address complex operational challenges across multi-cloud environments. 

"Our mission is to equip strategic technology partners with robust, cost-effective automation tools," said the VP of Product. "By streamlining compliance tracking, we empower team members and administrators to focus on high-impact strategic initiatives."

Organizations can explore the platform through a structured 30-day trial backed by enterprise technical onboarding and dedicated engineering support.`
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESETS, SAMPLE_CONTENTS };
}

