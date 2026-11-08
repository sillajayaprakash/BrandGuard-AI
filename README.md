# BrandGuard AI 🛡️

> **Deterministic Brand Governance & Content Compliance Web Application**  
> *Version 1.0 — Rule-Based Analysis Engine (No Live AI / Zero API Keys Required)*

BrandGuard AI is a beginner-friendly, responsive web application built to govern marketing copy, sales drafts, and press releases against brand voice rules, legal claim regulations, and terminology guidelines.

---

## ⚡ Key Highlights & Architecture

- **Dual-Engine Governance:**
  1. **Deterministic Rule Engine (Local):** 100% offline-safe regex heuristics and brand dictionary matching. Zero API keys required.
  2. **Google Gemini 2.5 Flash Copilot (Optional AI):** Deep semantic evaluation against brand guidelines using the official `@google/genai` SDK.
- **Strict Security & Privacy:**
  - API keys are read solely from `process.env.GEMINI_API_KEY`.
  - Keys are **never** exposed in frontend code, browser responses, logs, or Git.
  - Automatically sanitizes error messages and redacts key patterns.
- **Fact-Checking & Human Review:**
  - Gemini copilot is instructed not to invent facts.
  - Uncertain statistics or unverified performance claims are flagged for human review.
- **Dynamic Scoring & Human Approval:**
  - Real-time compliance scoring (0–100%) computed dynamically from detected violations and severity weights—never hard-coded.
  - Human sign-off workflow (`Approve Content` and `Request Changes`) with immutable revision snapshots.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended; tested on v24)
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### 1. (Optional) Configure Gemini API Key
To enable the optional Gemini 2.5 Flash copilot:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and set your key:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```
*(Note: BrandGuard AI works 100% locally with the deterministic engine without this key!)*

### 2. Start the Server
Open your terminal inside the project directory:
```bash
npm start
```
*(Or alternatively: `node server.js`)*

### 3. Open in Your Browser
Once started, open your web browser and navigate to:
```
http://localhost:3000
```

### 4. Run Automated Unit & Integration Tests
To verify all deterministic detection rules and Gemini integration handling:
```bash
npm test
```
*(Runs 14 automated unit test suites covering deterministic rules, forbidden phrases, unsupported claims, tone analysis, dynamic score calculation, Gemini error sanitization, timeout handling, structured output parsing, and fact-check flagging)*

---

## 🎯 Features Walkthrough

### 1. Marketing Content Editor
- Large, responsive text area to paste or write email drafts, landing page headlines, or ad copy.
- Live counters for **Word Count**, **Character Count**, and **Estimated Reading Time**.
- 1-click **Sample Content Loader** to test:
  - ⚠️ *High-Risk Marketing Draft* (contains multiple critical violations like "world's best", "100% guaranteed", "cheap", "never fails", urgency shouting).
  - ⚖️ *Moderate Compliance Draft* (contains minor tone slips and preferred phrasing mismatches).
  - ✅ *Fully Compliant Press Release* (passes all brand governance checks).

### 2. Editable Brand Rules Engine
Navigate to the **⚙️ Editable Brand Rules** tab to inspect and customize rules across 4 categories:
- **🚫 Forbidden Phrases:** Ban words like "cheap", "foolproof", "secret sauce", or "miracle".
- **⚖️ Unsupported Claims:** Flag legally risky claims using regex patterns (e.g. `100% guaranteed`, `zero risk`, `world's best`).
- **💡 Preferred Terminology:** Automatically suggest brand-approved terms (e.g., replace "users" with "team members", or "cheap" with "cost-effective").
- **🎭 Tone & Style Heuristics:** Toggle checks for aggressive urgency ("ACT NOW"), multiple exclamation marks ("!!!"), informal slang ("wanna", "gonna"), and uppercase shouting.
- **Add / Toggle / Delete:** Add custom rules with specific severities and explanations, or reset back to default preset guidelines with one click.

### 3. Deterministic Content Checker
- Scans text character-by-character, identifying exact line numbers and column positions.
- Flags each issue with one of three severity levels:
  - 🔴 **CRITICAL (-22 pts):** Severe legal liability, unsubstantiated guarantees, or strict regulatory violations.
  - 🟡 **WARNING (-11 pts):** Brand guideline breaches, high-pressure urgency, or negative brand perception.
  - 🔵 **ADVISORY (-5 pts):** Stylistic improvements and preferred terminology recommendations.

### 4. Dynamic Compliance Score & Status
- Computes an exact compliance score out of 100 based on detected issue density.
- Dynamic Status:
  - `90–100`: **COMPLIANT** (Emerald) — Ready for publication.
  - `70–89`: **REVISION RECOMMENDED** (Amber) — Minor/moderate issues to address.
  - `< 70`: **NON-COMPLIANT** (Crimson) — Prohibited terms or critical unsupported claims present.

### 5. Detailed Audit Findings & Remediations
- Filter issues by category: **All**, **Forbidden Phrases**, **Unsupported Claims**, **Tone**, or **Preferred Style**.
- Each issue card shows:
  - Exact snippet in context.
  - Line and column location.
  - Explanation of why it violates brand policy.
  - Recommended replacement text.
- One-click **✨ Apply Fix** button on each card to replace the flagged text in-place.
- Global **✨ Apply All Safe Fixes** button to resolve all actionable issues in one batch.

### 6. Approval & Change Request Governance Workflow
- **✅ Approve Content:** When content meets standards, sign off with reviewer name and approval notes. Creates an immutable snapshot in the audit trail.
- **⚠️ Request Changes:** If content fails compliance, submit specific reviewer feedback. Marks the version as `Changes Requested` in the audit log.

### 7. Revision History & Audit Trail
- Inspect previous versions, scores, status badges, timestamps, and reviewer notes in the **📜 Revision History** tab.
- Click **👁️ View Snapshot** to inspect full revision text.
- Click **↩️ Restore** to revert the editor to any past version.
- Download a timestamped **📥 Export Audit Certificate** in Markdown format.

---

## 🏢 Included Brand Guideline Presets

Switch guidelines at any time using the header dropdown:
1. **🏢 ApexTech B2B SaaS:** Enterprise software voice emphasizing reliability, consultation, and technical precision.
2. **💳 NovaPay FinTech & Payments:** Strict financial regulations, FTC/FinCEN compliance, zero tolerance for "free money" or "guaranteed returns".
3. **🌿 VitaLife Health & Wellness:** Dietary supplement compliance, FDA/FTC claim restrictions (strictly bans disease "cure" or "miracle" promises).

---

## 🛡️ Security & Privacy Note

- **No Secrets or API Keys:** Does not require, store, or expose any API keys or secrets.
- **Local Data Processing:** Input marketing content is processed locally and never transmitted to external third-party servers.

---

## 🧪 Project Structure

```
BrandGuard-AI/
├── .env.example           # Example environment template (no real keys)
├── .gitignore             # Strict ignore rules for .env and node_modules
├── package.json           # Scripts and dependencies (@google/genai)
├── server.js              # Native Node.js HTTP server & REST APIs (/api/check, /api/ai-check)
├── README.md              # Documentation and guide
├── lib/
│   ├── checker.js         # Deterministic Brand Governance Engine (Unchanged, 100% offline)
│   ├── geminiChecker.js   # Google Gemini 2.5 Flash Governance Module (@google/genai SDK)
│   └── presets.js         # Brand guidelines & sample test marketing copies
├── test/
│   ├── checker.test.js    # 8 automated deterministic unit tests
│   └── gemini.test.js     # 6 automated Gemini failure & mock integration tests
└── public/
    ├── index.html         # Responsive semantic UI layout with KPI overview & AI audit trigger
    ├── css/
    │   └── styles.css     # Clean enterprise SaaS design system (Light/Dark mode)
    └── js/
        ├── app.js         # UI controller, live rule analysis & Gemini AI workflow
        ├── rulesManager.js# Interactive brand rules manager & CRUD
        └── history.js     # Revision history tracking & snapshots
```

