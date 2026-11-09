BrandGuard AI 🛡️

AI-assisted brand compliance and content governance**

BrandGuard AI helps marketing teams review content against brand guidelines before publication. It combines deterministic rule-based checks with Google Gemini AI analysis to identify potential brand violations, unsupported claims, terminology inconsistencies, and tone issues.

🚀 Live Demo

- Live application:** https://brandguard-ai-22g4.onrender.com
- Source repository:** https://github.com/sillajayaprakash/BrandGuard-AI
- Health check:** https://brandguard-ai-22g4.onrender.com/api/health

 ✨ Features

 1. Brand Profiles
- ApexTech — B2B SaaS
- NovaPay — FinTech
- VitaLife — Health

 2. Rule-Based Brand Compliance
Checks content against configured brand guidelines, including:
- Forbidden phrases
- Unsupported promotional claims
- Preferred terminology
- Tone and writing-style rules

 3. Gemini AI Audit
Uses Google's Gemini AI (`gemini-3.5-flash`) for contextual content analysis.

The AI audit provides:
- Compliance assessment
- Issue severity
- Explanations of detected problems
- Suggested corrections
- Human-review indicators

 4. Compliance Scoring
Displays a compliance score out of 100 based on detected issues and their severity.

 5. Suggested Fixes
- Apply individual suggested corrections.
- Apply all available safe fixes.
- Review the updated content.

6. Human Approval Workflow
- Approve Content
- Request Changes
- Maintain revision history
- Restore previous revisions

 7. Audit History
Keeps review snapshots and supports exporting an audit report in Markdown format.

 🧰 Technology Stack

| Component | Technology |
|---|---|
| Backend | Node.js |
| Frontend | HTML, CSS, JavaScript |
| Rule engine | Custom deterministic checker |
| AI integration | Google Gemini API |
| Gemini SDK | `@google/genai` |
| Hosting | Render |
| Version control | Git and GitHub |

🏗️ Project Structure

```text
BrandGuard-AI/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
├── lib/
│   ├── checker.js
│   ├── geminiChecker.js
│   └── presets.js
├── server.js
├── package.json
├── .gitignore
└── .env.example
```

 ⚙️ Run Locally

Prerequisites
- Node.js 24 or compatible version
- npm
- Google Gemini API key for AI audit functionality

 1. Clone the repository

```bash
git clone https://github.com/sillajayaprakash/BrandGuard-AI.git
cd BrandGuard-AI
```

2. Install dependencies

```bash
npm install
```

 3. Configure environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Keep your actual API key private. Never commit `.env` to GitHub.

4. Start the application

```bash
npm start
```

Open:

```text
http://localhost:3000
```

🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check server status and AI configuration |
| POST | `/api/check` | Submit content for compliance analysis |

🧪 Testing

The project was tested using rule-checking tests, server endpoint checks, and live Gemini API verification.

Reported development test results:
- Automated test suite: 14/14 passing.
- Gemini live API verification: successful.
- Clean sample content: Rule Check 100/100.
- Clean sample content: Gemini AI Audit 95/100.
- High-risk sample content: Gemini AI Audit 0/100.

These are observed test results for sample inputs, not guarantees for every possible content submission.

 🔐 Security

- Gemini API credentials are stored in environment variables.
- `.env` is excluded from Git using `.gitignore`.
- The deployed Render service uses private environment configuration.
- AI-generated suggestions should be reviewed by a human before publication.

🛣️ Future Improvements — Round 3

1. Visual and accessibility compliance: Logo checks, brand colour validation, image alt-text review, and accessibility guidance.
2. Factual claim verification: Evidence-backed checks against approved sources and references.
3. Team collaboration: Multi-user workspaces, reviewer roles, comments, advanced revision comparisons, and downloadable PDF audit reports.

👨‍💻 Project Information

- Project: BrandGuard AI
- **Hackathon:** CodeTitans India 2026
- **Team:** DEBUGGER
- **Developer:** Silla Jayaprakash

---

**BrandGuard AI — Check your content. Protect your brand.**
