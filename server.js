/**
 * BrandGuard AI - Web Server & Governance API
 * Lightweight Node.js server using built-in standard modules (node:http, node:fs, node:path).
 * Zero external dependencies required.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

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

const checker = require('./lib/checker.js');
const geminiChecker = require('./lib/geminiChecker.js');
const { PRESETS, SAMPLE_CONTENTS } = require('./lib/presets.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// In-memory revisions store initialized with a baseline snapshot
let revisionsStore = [
  {
    id: 'rev_init',
    versionNumber: 1,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    title: 'Initial Sample Policy Draft',
    presetId: 'apexTech',
    content: SAMPLE_CONTENTS.compliant.content,
    score: 98,
    status: 'approved',
    statusLabel: 'Approved',
    issuesCount: 0,
    criticalCount: 0,
    warningCount: 0,
    advisoryCount: 0,
    author: 'Compliance Lead (Auto-Initialized)',
    notes: 'Initial approved press release guideline baseline.'
  }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB cap
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    return res.end();
  }

  // --- REST API ROUTES ---
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health check
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'BrandGuard AI',
          engine: 'Rule-Based Deterministic Checker v1.0',
          geminiConfigured: geminiChecker.isGeminiConfigured(),
          geminiModel: geminiChecker.DEFAULT_MODEL || 'gemini-3.5-flash',
          requiresApiKey: false,
          serverTime: new Date().toISOString()
        });
      }

      // 2. Presets & Sample Content
      if (pathname === '/api/presets' && method === 'GET') {
        return sendJson(res, 200, {
          presets: PRESETS,
          sampleContents: SAMPLE_CONTENTS
        });
      }

      // 3. Rule-Based Deterministic Content Check
      if (pathname === '/api/check' && method === 'POST') {
        const { text, rules } = await parseBody(req);
        const activeRules = rules || PRESETS.apexTech;
        const report = checker.analyzeContent(text || '', activeRules);
        return sendJson(res, 200, report);
      }

      // 3b. Gemini AI Content Check
      if (pathname === '/api/ai-check' && method === 'POST') {
        const { text, rules, presetId } = await parseBody(req);
        const activeRules = rules || (presetId && PRESETS[presetId]) || PRESETS.apexTech;

        const result = await geminiChecker.analyzeWithGemini({
          text: text || '',
          rules: activeRules,
          presetId: presetId || 'apexTech'
        });

        const statusCode = result.success
          ? 200
          : (result.code === 'MISSING_API_KEY' ? 400 : (result.code === 'TIMEOUT' ? 504 : 502));

        return sendJson(res, statusCode, result);
      }

      // 4. Batch Auto-fix
      if (pathname === '/api/fix-all' && method === 'POST') {
        const { text, issues } = await parseBody(req);
        const fixedText = checker.applyAllCorrections(text || '', issues || []);
        return sendJson(res, 200, { fixedText });
      }

      // 5. Single Auto-fix
      if (pathname === '/api/fix-single' && method === 'POST') {
        const { text, issue } = await parseBody(req);
        const fixedText = checker.applySingleCorrection(text || '', issue);
        return sendJson(res, 200, { fixedText });
      }

      // 6. Get Revisions
      if (pathname === '/api/revisions' && method === 'GET') {
        return sendJson(res, 200, { revisions: revisionsStore });
      }

      // 7. Save Revision
      if (pathname === '/api/revisions' && method === 'POST') {
        const rev = await parseBody(req);
        const newRev = {
          id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          versionNumber: revisionsStore.length + 1,
          timestamp: new Date().toISOString(),
          title: rev.title || `Revision #${revisionsStore.length + 1}`,
          presetId: rev.presetId || 'apexTech',
          content: rev.content || '',
          score: typeof rev.score === 'number' ? rev.score : 100,
          status: rev.status || 'draft',
          statusLabel: rev.statusLabel || 'Draft',
          issuesCount: rev.issuesCount || 0,
          criticalCount: rev.criticalCount || 0,
          warningCount: rev.warningCount || 0,
          advisoryCount: rev.advisoryCount || 0,
          author: rev.author || 'Content Creator',
          notes: rev.notes || ''
        };
        // Keep up to 50 revisions in memory
        revisionsStore.unshift(newRev);
        if (revisionsStore.length > 50) revisionsStore.pop();
        return sendJson(res, 201, { success: true, revision: newRev });
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
  }

  // --- STATIC FILE SERVING ---
  let safePath = pathname === '/' ? '/index.html' : pathname;
  // Prevent directory traversal
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, normalizedPath);

  // If serving library file directly to browser (e.g. checker.js or presets.js)
  if (pathname === '/lib/checker.js') {
    filePath = path.join(__dirname, 'lib', 'checker.js');
  } else if (pathname === '/lib/presets.js') {
    filePath = path.join(__dirname, 'lib', 'presets.js');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: If not found, try index.html (SPA fallback) or 404
      const indexFallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFallback, (fallbackErr, data) => {
        if (fallbackErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  const isGeminiReady = geminiChecker.isGeminiConfigured();
  console.log(`======================================================`);
  console.log(`🛡️  BrandGuard AI Server Running`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Rule Engine: Active (Deterministic, zero API keys required)`);
  console.log(`   Gemini Copilot: ${isGeminiReady ? 'Active (API Key detected)' : 'Inactive (Set GEMINI_API_KEY in .env)'}`);
  console.log(`======================================================`);
});

module.exports = server;
