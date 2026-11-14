/**
 * BrandGuard AI - Web Server & Governance API
 * Lightweight Node.js server using built-in standard modules (node:http, node:fs, node:path).
 * Zero external dependencies required.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

// Load .env without overriding values supplied by the host environment.
(function loadEnvFile() {
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
const claimVerifier = require('./lib/claimVerifier.js');
const visualChecker = require('./lib/visualChecker.js');
const { PRESETS, SAMPLE_CONTENTS } = require('./lib/presets.js');
const { createSupabaseAuth } = require('./lib/auth.js');
const { createSupabaseRoleStore } = require('./lib/roles.js');
const { createSupabaseRevisionStore } = require('./lib/revisions.js');
const { requireMinimumRole, ROLE_NAMES } = require('./lib/authorization.js');

const configuredPort = Number.parseInt(process.env.PORT, 10);
const PORT = Number.isNaN(configuredPort) ? 3000 : configuredPort;
const PUBLIC_DIR = path.join(__dirname, 'public');
const supabaseAuth = createSupabaseAuth();
const roleStore = createSupabaseRoleStore();
const revisionStore = createSupabaseRevisionStore();

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
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function getAllowedOrigins() {
  const origins = new Set();
  const configured = (process.env.APP_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
  configured.forEach(value => {
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore invalid origin configuration; requests will fail the origin check.
    }
  });
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    origins.add(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
  }
  return origins;
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!getAllowedOrigins().has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  return true;
}

const PUBLIC_API_ROUTES = new Set([
  'GET /api/health',
  'GET /api/auth/config',
  'GET /api/presets'
]);

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

  if (!applyCorsHeaders(req, res)) {
    if (pathname.startsWith('/api/')) return sendJson(res, 403, { error: 'Origin is not allowed.' });
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Origin is not allowed.');
  }

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    });
    return res.end();
  }

  // --- REST API ROUTES ---
  if (pathname.startsWith('/api/')) {
    try {
      if (!PUBLIC_API_ROUTES.has(`${method} ${pathname}`)) {
        req.authUser = await supabaseAuth.authenticateRequest(req);
        if (!req.authUser) {
          return sendJson(res, 401, { error: 'A valid bearer access token is required.' });
        }
        req.authRole = await roleStore.getRoleForUser(req.authUser.id);
      }

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

      if (pathname === '/api/auth/config' && method === 'GET') {
        const config = supabaseAuth.getPublicConfig();
        if (!config) {
          return sendJson(res, 503, { error: 'Authentication is not configured.' });
        }
        return sendJson(res, 200, config);
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        return sendJson(res, 200, { user: req.authUser, role: req.authRole });
      }

      if (pathname === '/api/admin/users' && method === 'GET') {
        requireMinimumRole(req.authRole, 'admin');
        return sendJson(res, 200, { users: await roleStore.listUsers() });
      }

      if (pathname === '/api/admin/users/role' && method === 'POST') {
        requireMinimumRole(req.authRole, 'admin');
        const body = await parseBody(req);
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
          return sendJson(res, 400, { error: 'A valid target account ID is required.' });
        }
        if (!ROLE_NAMES.includes(body.role)) {
          return sendJson(res, 400, { error: 'Role must be user, reviewer, or admin.' });
        }
        const roleRecord = await roleStore.assignRole({
          userId,
          role: body.role,
          assignedBy: req.authUser.id
        });
        return sendJson(res, 200, { success: true, role: roleRecord.role });
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

      // 3c. Factual Claim Verification (separate from compliance scoring)
      if (pathname === '/api/verify-claims' && method === 'POST') {
        const body = await parseBody(req);
        const result = await claimVerifier.verifyClaims({
          content: body.content || body.text || '',
          evidenceSources: body.evidenceSources || body.sources || []
        });

        const statusCode = result.success
          ? 200
          : (result.code === 'MISSING_API_KEY' || result.code === 'INVALID_INPUT' ? 400 : (result.code === 'TIMEOUT' ? 504 : 502));

        return sendJson(res, statusCode, result);
      }

      // 3d. Visual Brand & Accessibility Check
      if (pathname === '/api/visual-check' && method === 'POST') {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
          return sendJson(res, 400, { success: false, code: 'INVALID_CONTENT_TYPE', error: 'Expected multipart/form-data' });
        }

        const boundary = contentType.match(/boundary=([^;]+)/);
        if (!boundary) {
          return sendJson(res, 400, { success: false, code: 'MISSING_BOUNDARY', error: 'Missing multipart boundary' });
        }

        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const body = buffer.toString('binary');
        const boundaryStr = `--${boundary[1]}`;
        const parts = body.split(boundaryStr);

        let htmlContent = '';
        let presetId = 'apexTech';

        for (const part of parts) {
          if (!part.includes('Content-Disposition')) continue;
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const headers = part.slice(0, headerEnd);
          const content = part.slice(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');

          if (headers.includes('name="html"')) {
            htmlContent = content;
          } else if (headers.includes('name="preset"')) {
            presetId = content;
          }
        }

        if (!htmlContent.trim()) {
          return sendJson(res, 400, { success: false, code: 'MISSING_HTML', error: 'HTML content is required' });
        }

        if (htmlContent.length > visualChecker.MAX_HTML_CHARS) {
          return sendJson(res, 400, { success: false, code: 'HTML_TOO_LARGE', error: `HTML exceeds ${visualChecker.MAX_HTML_CHARS} character limit` });
        }

        const preset = PRESETS[presetId] || PRESETS.apexTech;

        const result = await visualChecker.analyzeVisual({
          html: htmlContent,
          preset
        });

        if (!result.success) {
          const statusMap = {
            'MISSING_API_KEY': 503,
            'TIMEOUT': 504,
            'RATE_LIMIT': 429,
            'SERVICE_UNAVAILABLE': 503,
            'AUTH_ERROR': 401,
            'MODEL_NOT_FOUND': 500,
            'PARSE_ERROR': 500,
            'EMPTY_RESPONSE': 500
          };
          return sendJson(res, statusMap[result.code] || 500, result);
        }

        return sendJson(res, 200, {
          success: true,
          ...result
        });
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
        return sendJson(res, 200, { revisions: await revisionStore.list(req.authUser.id, req.authRole) });
      }

      if (pathname === '/api/revisions' && method === 'DELETE') {
        const deleted = await revisionStore.clearOwn(req.authUser.id);
        return sendJson(res, 200, { success: true, revisions: deleted });
      }

      // 7. Save a user's draft or apply a reviewer decision to an existing draft.
      if (pathname === '/api/revisions' && method === 'POST') {
        const rev = await parseBody(req);
        if (rev.status !== undefined && rev.status !== 'draft') requireMinimumRole(req.authRole, 'reviewer');
        if (rev.revisionId !== undefined) {
          requireMinimumRole(req.authRole, 'reviewer');
          if (!['approved', 'changes_requested'].includes(rev.status)) {
            return sendJson(res, 400, { error: 'Review status must be approved or changes_requested.' });
          }
          if (typeof rev.revisionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rev.revisionId)) {
            return sendJson(res, 400, { error: 'A valid revision ID is required.' });
          }
          const reviewed = await revisionStore.review(rev.revisionId, rev.status, rev.notes, req.authUser);
          return sendJson(res, 200, { success: true, revision: reviewed });
        }
        if (rev.status !== undefined && rev.status !== 'draft') {
          return sendJson(res, 400, { error: 'New revisions must be saved as drafts.' });
        }
        if (typeof rev.content !== 'string' || !rev.content.trim()) {
          return sendJson(res, 400, { error: 'Revision content is required.' });
        }
        if (rev.content.length > 1000000) {
          return sendJson(res, 400, { error: 'Revision content exceeds the 1,000,000 character limit.' });
        }
        const snapshot = {
          presetId: typeof rev.presetId === 'string' ? rev.presetId : 'apexTech',
          content: rev.content,
          score: Number.isFinite(rev.score) ? Math.max(0, Math.min(100, rev.score)) : 100,
          issuesCount: Number.isInteger(rev.issuesCount) && rev.issuesCount >= 0 ? rev.issuesCount : 0,
          criticalCount: Number.isInteger(rev.criticalCount) && rev.criticalCount >= 0 ? rev.criticalCount : 0,
          warningCount: Number.isInteger(rev.warningCount) && rev.warningCount >= 0 ? rev.warningCount : 0,
          advisoryCount: Number.isInteger(rev.advisoryCount) && rev.advisoryCount >= 0 ? rev.advisoryCount : 0,
          notes: typeof rev.notes === 'string' ? rev.notes : ''
        };
        const created = await revisionStore.create(snapshot, req.authUser);
        return sendJson(res, 201, { success: true, revision: created });
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (err) {
      if (err && err.code === 'AUTH_SERVICE_UNAVAILABLE') {
        return sendJson(res, 503, { error: 'Authentication service is temporarily unavailable.' });
      }
      if (err && err.code === 'AUTH_NOT_CONFIGURED') {
        return sendJson(res, 503, { error: 'Authentication is not configured.' });
      }
      if (err && ['ROLE_STORE_NOT_CONFIGURED', 'ROLE_STORE_UNAVAILABLE'].includes(err.code)) {
        return sendJson(res, 503, { error: 'Role authorization is temporarily unavailable.' });
      }
      if (err && err.code === 'REVISION_STORE_NOT_CONFIGURED') {
        return sendJson(res, 503, { error: 'Revision storage is not configured. Apply the revision migration and set the server-only service-role key.' });
      }
      if (err && err.code === 'REVISION_STORE_UNAVAILABLE') {
        return sendJson(res, 503, { error: 'Revision storage is temporarily unavailable.' });
      }
      if (err && err.code === 'REVISION_DELETE_NOT_CONFIRMED') {
        return sendJson(res, 503, { error: 'Revision deletion could not be confirmed. Reload history and try again.' });
      }
      if (err && err.code === 'FORBIDDEN') {
        return sendJson(res, 403, { error: err.message });
      }
      if (err && err.code === 'LAST_ADMIN') {
        return sendJson(res, 409, { error: err.message });
      }
      if (err && err.code === 'USER_NOT_FOUND') {
        return sendJson(res, 404, { error: err.message });
      }
      if (err && err.code === 'REVISION_NOT_FOUND') return sendJson(res, 404, { error: err.message });
      if (err && err.code === 'REVISION_NOT_DRAFT') return sendJson(res, 409, { error: err.message });
      if (err && err.code === 'REVISION_CONFLICT') return sendJson(res, 409, { error: err.message });
      console.error('API Error: request processing failed.');
      return sendJson(res, 500, { error: 'Internal server error.' });
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
  } else if (pathname === '/vendor/supabase-2.110.0.js') {
    filePath = path.join(__dirname, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
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
