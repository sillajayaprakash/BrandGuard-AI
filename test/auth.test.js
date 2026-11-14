const assert = require('node:assert/strict');
const http = require('node:http');
const { createSupabaseAuth } = require('../lib/auth.js');
const browserAuthApi = require('../public/js/auth.js');

function run(name, test) {
  return Promise.resolve().then(test).then(() => {
    console.log(`  ✔ [PASS] ${name}`);
  }, error => {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`     ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}

class MockResponse {
  constructor(status, value) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.value = value;
  }

  async json() {
    return this.value;
  }
}

async function requestJson(url, options = {}) {
  const body = options.body;
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, response => {
      let result = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { result += chunk; });
      response.on('end', () => {
        let data = null;
        try { data = result ? JSON.parse(result) : null; } catch {}
        resolve({ status: response.statusCode, headers: response.headers, data });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function runBrowserAuthTests() {
  const calls = [];
  const authStateCallbacks = [];
  const currentSession = { access_token: 'test-access-token', user: { email: 'browser@example.test' } };
  const authClient = {
    auth: {
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      getUser: async () => ({ data: { user: currentSession.user }, error: null }),
      signUp: async credentials => {
        calls.push(['signUp', credentials]);
        return { data: { user: { email: credentials.email }, session: null }, error: null };
      },
      signInWithPassword: async credentials => {
        calls.push(['signInWithPassword', credentials]);
        return { data: { user: currentSession.user, session: currentSession }, error: null };
      },
      signOut: async options => {
        calls.push(['signOut', options]);
        return { error: null };
      },
      onAuthStateChange: callback => {
        authStateCallbacks.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    }
  };
  const sessionStorage = {};
  let clientOptions;
  const sdk = { createClient: (url, key, options) => {
    calls.push(['createClient', url, key]);
    clientOptions = options;
    return authClient;
  } };
  const fetchCalls = [];
  const root = {
    location: { origin: 'http://localhost:3000' },
    sessionStorage,
    Headers,
    fetch: async (path, options = {}) => {
      fetchCalls.push({ path, options });
      if (path === '/api/auth/config') {
        return new MockResponse(200, { supabaseUrl: 'https://project.example.test', publishableKey: 'sb_publishable_test' });
      }
      if (path === '/api/auth/me') {
        return new MockResponse(200, { user: { id: 'verified-browser-user', email: 'browser@example.test' } });
      }
      return new MockResponse(200, { success: true });
    }
  };
  const controller = browserAuthApi.createController({ root, sdk, fetchImpl: root.fetch });
  const restored = await controller.initialize();
  assert.equal(restored.user.id, 'verified-browser-user');
  assert.equal(clientOptions.auth.autoRefreshToken, true);
  assert.equal(clientOptions.auth.flowType, 'pkce');
  assert.equal(clientOptions.auth.storage, sessionStorage);

  const registration = await controller.signUp('new@example.test', 'not-a-real-password');
  assert.equal(registration.session, null);
  const signupCall = calls.find(call => call[0] === 'signUp')[1];
  assert.equal(signupCall.email, 'new@example.test');
  assert.equal(signupCall.options.emailRedirectTo, root.location.origin);
  assert.equal(Object.hasOwn(signupCall, 'role'), false);
  assert.equal(Object.hasOwn(signupCall, 'user_metadata'), false);

  await controller.signIn('browser@example.test', 'not-a-real-password');
  const response = await controller.apiFetch('/api/private');
  assert.equal(response.ok, true);
  assert.equal(fetchCalls.at(-1).options.headers.get('Authorization'), 'Bearer test-access-token');
  await controller.signOut();
  assert.deepEqual(calls.find(call => call[0] === 'signOut')[1], { scope: 'local' });
  controller.onAuthStateChange(() => {});
  assert.equal(authStateCallbacks.length, 1);
}

async function runServerRouteTests() {
  const savedEnv = {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    APP_ORIGIN: process.env.APP_ORIGIN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const originalFetch = global.fetch;
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.APP_ORIGIN = '';
  process.env.SUPABASE_URL = 'https://auth-project.example.test';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test_only';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-credential';
  const roleRows = new Map([
    ['verified-user-1', 'user'],
    ['verified-user-2', 'reviewer'],
    ['verified-admin-1', 'admin'],
    ['88888888-8888-4888-8888-888888888888', 'reviewer']
  ]);
  const revisionRows = [];
  let failRevisionQueries = false;
  let ignoreRevisionDeletes = false;
  let failRoleLookup = false;

  global.fetch = async (input, init = {}) => {
    const requestUrl = String(input);
    if (requestUrl.startsWith(`${process.env.SUPABASE_URL}/rest/v1/brandguard_revisions`)) {
      if (failRevisionQueries) return new Response(JSON.stringify({ message: 'mock revision database failure' }), { status: 500 });
      const request = new URL(requestUrl);
      const method = init.method || 'GET';
      const ownerFilter = request.searchParams.get('owner_id');
      const idFilter = request.searchParams.get('id');
      let matching = revisionRows.filter(row => (!ownerFilter || ownerFilter === `eq.${row.owner_id}`) && (!idFilter || idFilter === `eq.${row.id}`));
      if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'Content-Range': `0-${matching.length - 1}/${matching.length}` } });
      if (method === 'GET') return new Response(JSON.stringify(matching), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method === 'POST') {
        const now = new Date().toISOString();
        const row = { id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(revisionRows.length + 1).padStart(12, '0')}`, created_at: now, reviewed_by: null, reviewed_at: null, ...JSON.parse(init.body) };
        revisionRows.unshift(row);
        return new Response(JSON.stringify(row), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PATCH') {
        const row = matching.find(item => !request.searchParams.get('status') || item.status === 'draft');
        if (!row) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
        Object.assign(row, JSON.parse(init.body));
        return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'DELETE') {
        const deletedRows = [];
        if (!ignoreRevisionDeletes) {
          for (let i = revisionRows.length - 1; i >= 0; i--) {
            if (revisionRows[i].owner_id === ownerFilter.replace(/^eq\./, '')) deletedRows.push(...revisionRows.splice(i, 1));
          }
        }
        return new Response(JSON.stringify(deletedRows.map(row => ({ id: row.id }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    if (requestUrl.startsWith(`${process.env.SUPABASE_URL}/auth/v1/user`)) {
      const headers = new Headers(init.headers || {});
      const token = (headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (token === 'verified-user-token') {
        return new Response(JSON.stringify({ id: 'verified-user-1', email: 'verified@example.test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (token === 'other-user-token') {
        return new Response(JSON.stringify({ id: 'verified-user-2', email: 'other@example.test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (token === 'reviewer-token') {
        return new Response(JSON.stringify({ id: 'verified-user-2', email: 'reviewer@example.test' }), { status: 200 });
      }
      if (token === 'admin-token') {
        return new Response(JSON.stringify({ id: 'verified-admin-1', email: 'admin@example.test' }), { status: 200 });
      }
      if (token === 'second-reviewer-token') {
        return new Response(JSON.stringify({ id: '88888888-8888-4888-8888-888888888888', email: 'reviewer2@example.test' }), { status: 200 });
      }
      if (token === 'missing-role-token') {
        return new Response(JSON.stringify({ id: 'verified-no-role', email: 'new-user@example.test' }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (requestUrl.startsWith(`${process.env.SUPABASE_URL}/rest/v1/brandguard_user_roles`)) {
      const request = new URL(requestUrl);
      const method = init.method || 'GET';
      if (failRoleLookup) return new Response(JSON.stringify({ message: 'mock role lookup failure' }), { status: 500 });
      if (method === 'GET' && request.searchParams.get('select') === 'user_id,role') {
        return new Response(JSON.stringify([...roleRows].map(([user_id, role]) => ({ user_id, role }))), { status: 200 });
      }
      if (method === 'GET' && request.searchParams.get('select') === 'user_id') {
        return new Response(JSON.stringify([...roleRows].filter(([, role]) => role === 'admin').map(([user_id]) => ({ user_id }))), { status: 200 });
      }
      if (method === 'GET') {
        const userId = (request.searchParams.get('user_id') || '').replace(/^eq\./, '');
        const role = roleRows.get(userId);
        if (!role) return new Response(JSON.stringify([]), { status: 200 });
        return new Response(JSON.stringify({ role }), { status: 200 });
      }
      if (method === 'POST') {
        const row = JSON.parse(init.body);
        roleRows.set(row.user_id, row.role);
        return new Response(JSON.stringify({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }), { status: 201 });
      }
    }
    if (requestUrl.startsWith(`${process.env.SUPABASE_URL}/rest/v1/rpc/brandguard_assign_user_role`)) {
      const args = JSON.parse(init.body);
      const currentRole = roleRows.get(args.p_user_id);
      const admins = [...roleRows].filter(([, role]) => role === 'admin');
      if (currentRole === 'admin' && args.p_role !== 'admin' && admins.length <= 1) {
        return new Response(JSON.stringify({ code: 'P0001', message: 'LAST_ADMIN' }), { status: 400 });
      }
      roleRows.set(args.p_user_id, args.p_role);
      return new Response(JSON.stringify({
        user_id: args.p_user_id,
        role: args.p_role,
        assigned_by: args.p_assigned_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }), { status: 200 });
    }
    if (requestUrl.startsWith(`${process.env.SUPABASE_URL}/auth/v1/admin/users`)) {
      const request = new URL(requestUrl);
      if (request.searchParams.has('page')) {
        return new Response(JSON.stringify({ users: [
          { id: 'verified-user-1', email: 'verified@example.test' },
          { id: 'verified-user-2', email: 'reviewer@example.test' },
          { id: 'verified-admin-1', email: 'admin@example.test' },
          { id: '88888888-8888-4888-8888-888888888888', email: 'reviewer2@example.test' }
        ] }), { status: 200 });
      }
      const targetId = request.pathname.split('/').at(-1);
      return new Response(JSON.stringify({ user: { id: targetId, email: `${targetId}@example.test` } }), { status: 200 });
    }
    return originalFetch(input, init);
  };

  let server;
  try {
    server = require('../server.js');
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    process.env.APP_ORIGIN = baseUrl;

    const health = await requestJson(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const config = await requestJson(`${baseUrl}/api/auth/config`);
    assert.equal(config.status, 200);
    assert.deepEqual(Object.keys(config.data).sort(), ['publishableKey', 'supabaseUrl']);

    const sdkBundle = await requestJson(`${baseUrl}/vendor/supabase-2.110.0.js`);
    assert.equal(sdkBundle.status, 200);

    const missingCheck = await requestJson(`${baseUrl}/api/check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(missingCheck.status, 401);
    const missingRevisions = await requestJson(`${baseUrl}/api/revisions`);
    assert.equal(missingRevisions.status, 401);
    const missingAdmin = await requestJson(`${baseUrl}/api/admin/users`);
    assert.equal(missingAdmin.status, 401);

    const invalidUser = await requestJson(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    assert.equal(invalidUser.status, 401);

    const me = await requestJson(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer verified-user-token' }
    });
    assert.equal(me.status, 200);
    assert.deepEqual(me.data.user, { id: 'verified-user-1', email: 'verified@example.test' });
    assert.equal(me.data.role, 'user');

    const noRole = await requestJson(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer missing-role-token' }
    });
    assert.equal(noRole.status, 200);
    assert.equal(noRole.data.role, 'user');

    const userAudit = await requestJson(`${baseUrl}/api/check`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'A normal draft for audit.' })
    });
    assert.equal(userAudit.status, 200);

    const userApproval = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'attacker-user',
        author: 'Impersonator',
        role: 'admin',
        title: 'Approved by Impersonator',
        status: 'approved',
        content: 'Reviewed text',
        notes: 'Looks good'
      })
    });
    assert.equal(userApproval.status, 403);

    const draftRevision = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: 'Impersonator', email: 'attacker@example.test', ownerId: 'attacker-id', role: 'admin',
        status: 'draft', content: 'Draft text'
      })
    });
    assert.equal(draftRevision.status, 201);
    assert.equal(draftRevision.data.revision.author, 'verified@example.test');
    assert.equal(draftRevision.data.revision.ownerId, 'verified-user-1');
    assert.equal(Object.hasOwn(draftRevision.data.revision, 'role'), false);

    const ownDrafts = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer verified-user-token' } });
    assert.equal(ownDrafts.data.revisions.some(item => item.id === draftRevision.data.revision.id), true);
    failRevisionQueries = true;
    const revisionStorageFailure = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer verified-user-token' } });
    failRevisionQueries = false;
    assert.equal(revisionStorageFailure.status, 503);
    const deniedReview = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST', headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId: draftRevision.data.revision.id, status: 'approved' })
    });
    assert.equal(deniedReview.status, 403);
    const deniedDraftWrite = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST', headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId: draftRevision.data.revision.id, status: 'draft', content: 'Attacker edit' })
    });
    assert.equal(deniedDraftWrite.status, 403);
    const otherOwnerDraft = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST', headers: { Authorization: 'Bearer missing-role-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Private other user draft' })
    });
    assert.equal(otherOwnerDraft.status, 201);

    const invalidStatus = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'super-admin-approved' })
    });
    assert.equal(invalidStatus.status, 403);

    const reviewerMe = await requestJson(`${baseUrl}/api/auth/me`, { headers: { Authorization: 'Bearer reviewer-token' } });
    assert.equal(reviewerMe.data.role, 'reviewer');
    const reviewerApproval = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer reviewer-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', author: 'Spoofed Name', email: 'spoofed@example.test', role: 'admin' })
    });
    assert.equal(reviewerApproval.status, 400, 'review decisions must target an existing revision');

    const reviewerDrafts = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer reviewer-token' } });
    assert.equal(reviewerDrafts.data.revisions.some(item => item.id === draftRevision.data.revision.id), true);
    const reviewedDraft = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST', headers: { Authorization: 'Bearer reviewer-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId: draftRevision.data.revision.id, status: 'changes_requested', notes: 'Please revise.' })
    });
    assert.equal(reviewedDraft.status, 200);
    assert.equal(reviewedDraft.data.revision.ownerId, 'verified-user-1');
    assert.equal(reviewedDraft.data.revision.reviewedBy, 'verified-user-2');
    assert.equal(reviewedDraft.data.revision.status, 'changes_requested');
    const adminSharedDrafts = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer admin-token' } });
    assert.equal(adminSharedDrafts.data.revisions.some(item => item.id === reviewedDraft.data.revision.id), true);
    const ownHistoryDelete = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'DELETE', headers: { Authorization: 'Bearer verified-user-token' }
    });
    assert.equal(ownHistoryDelete.status, 200);
    assert.equal(revisionRows.some(item => item.owner_id === 'verified-user-1'), false);
    assert.equal(revisionRows.some(item => item.id === otherOwnerDraft.data.revision.id), true);
    const ownerHistoryAfterDelete = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer verified-user-token' } });
    const otherHistoryAfterDelete = await requestJson(`${baseUrl}/api/revisions`, { headers: { Authorization: 'Bearer missing-role-token' } });
    assert.equal(ownerHistoryAfterDelete.data.revisions.length, 0);
    assert.equal(otherHistoryAfterDelete.data.revisions.some(item => item.id === otherOwnerDraft.data.revision.id), true);
    ignoreRevisionDeletes = true;
    const unconfirmedDelete = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'DELETE', headers: { Authorization: 'Bearer missing-role-token' }
    });
    ignoreRevisionDeletes = false;
    assert.equal(unconfirmedDelete.status, 503);
    assert.equal(revisionRows.some(item => item.id === otherOwnerDraft.data.revision.id), true);

    const reviewerAdminList = await requestJson(`${baseUrl}/api/admin/users`, { headers: { Authorization: 'Bearer reviewer-token' } });
    assert.equal(reviewerAdminList.status, 403);
    const userRoleEscalation = await requestJson(`${baseUrl}/api/admin/users/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '88888888-8888-4888-8888-888888888888', role: 'admin' })
    });
    assert.equal(userRoleEscalation.status, 403);
    const adminList = await requestJson(`${baseUrl}/api/admin/users`, { headers: { Authorization: 'Bearer admin-token' } });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.data.users.find(user => user.id === 'verified-user-1').role, 'user');
    const adminApproval = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', identity: 'Forged Admin Name' })
    });
    assert.equal(adminApproval.status, 400, 'admin review decisions must target an existing revision');

    const roleAssignment = await requestJson(`${baseUrl}/api/admin/users/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '88888888-8888-4888-8888-888888888888', role: 'reviewer' })
    });
    assert.equal(roleAssignment.status, 200);
    assert.equal(roleAssignment.data.role, 'reviewer');

    const adminDemotion = await requestJson(`${baseUrl}/api/admin/users/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '88888888-8888-4888-8888-888888888888', role: 'user', roleClaim: 'admin' })
    });
    assert.equal(adminDemotion.status, 200);
    const demotedApproval = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer second-reviewer-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'changes_requested' })
    });
    assert.equal(demotedApproval.status, 403);

    const invalidRole = await requestJson(`${baseUrl}/api/admin/users/role`, {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'verified-user-1', role: 'superadmin' })
    });
    assert.equal(invalidRole.status, 400);

    failRoleLookup = true;
    const roleLookupFailure = await requestJson(`${baseUrl}/api/check`, {
      method: 'POST', headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' }, body: '{}'
    });
    failRoleLookup = false;
    assert.equal(roleLookupFailure.status, 503);

    roleRows.set('verified-user-1', 'superadmin');
    const malformedRole = await requestJson(`${baseUrl}/api/revisions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer verified-user-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'draft' })
    });
    roleRows.set('verified-user-1', 'user');
    assert.equal(malformedRole.status, 503);

    const otherUsersRevisions = await requestJson(`${baseUrl}/api/revisions`, {
      headers: { Authorization: 'Bearer missing-role-token' }
    });
    assert.equal(otherUsersRevisions.status, 200);
    assert.equal(otherUsersRevisions.data.revisions.some(item => item.id === draftRevision.data.revision.id), false);

    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    delete require.cache[require.resolve('../server.js')];
    server = require('../server.js');
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
    const restartedUrl = `http://127.0.0.1:${server.address().port}`;
    process.env.APP_ORIGIN = restartedUrl;
    const afterRestart = await requestJson(`${restartedUrl}/api/revisions`, { headers: { Authorization: 'Bearer reviewer-token' } });
    assert.equal(afterRestart.status, 200);
    assert.equal(afterRestart.data.revisions.some(item => item.id === otherOwnerDraft.data.revision.id), true);

    const forbiddenOrigin = await requestJson(`${restartedUrl}/api/check`, {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(forbiddenOrigin.status, 403);
    const allowedOrigin = await requestJson(`${restartedUrl}/api/check`, {
      method: 'OPTIONS',
      headers: { Origin: restartedUrl, 'Access-Control-Request-Headers': 'authorization,content-type' }
    });
    assert.equal(allowedOrigin.status, 204);
    assert.equal(allowedOrigin.headers['access-control-allow-origin'], restartedUrl);
  } finally {
    global.fetch = originalFetch;
    if (server && server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    Object.entries(savedEnv).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

async function runAuthTests() {
  console.log('Running BrandGuard AI Supabase Authentication Tests...\n');
  await run('Rejects missing bearer tokens without calling Supabase', async () => {
    let calls = 0;
    const auth = createSupabaseAuth({
      supabaseUrl: 'https://project.example.test', anonKey: 'publishable-test',
      clientFactory: () => { calls++; throw new Error('should not be called'); }
    });
    assert.equal(await auth.authenticateRequest({ headers: {} }), null);
    assert.equal(calls, 0);
  });

  await run('Rejects invalid access tokens', async () => {
    const auth = createSupabaseAuth({
      supabaseUrl: 'https://project.example.test', anonKey: 'publishable-test',
      clientFactory: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 401 } }) } })
    });
    assert.equal(await auth.verifyAccessToken('invalid-token'), null);
  });

  await run('Uses only the verified Supabase user identity, not body-supplied identity', async () => {
    const auth = createSupabaseAuth({
      supabaseUrl: 'https://project.example.test', anonKey: 'publishable-test',
      clientFactory: () => ({ auth: { getUser: async token => ({
        data: { user: { id: token === 'valid-token' ? 'verified-id' : 'different-id', email: 'verified@example.test' } },
        error: null
      }) } })
    });
    const request = {
      headers: { authorization: 'Bearer valid-token' },
      body: { userId: 'attacker-id', email: 'attacker@example.test', role: 'admin' }
    };
    assert.deepEqual(await auth.authenticateRequest(request), { id: 'verified-id', email: 'verified@example.test' });
  });

  await run('Reports only the Supabase URL and publishable key as public configuration', async () => {
    const auth = createSupabaseAuth({
      supabaseUrl: 'https://project.example.test', anonKey: 'sb_publishable_public_test',
      clientFactory: () => null
    });
    assert.deepEqual(auth.getPublicConfig(), {
      supabaseUrl: 'https://project.example.test', publishableKey: 'sb_publishable_public_test'
    });
  });

  await run('Browser controller handles registration, login, bearer requests, refresh options, and local logout', runBrowserAuthTests);
  await run('HTTP routes protect private APIs, allow public routes, and reject identity impersonation', runServerRouteTests);

  if (process.exitCode) process.exit(1);
  console.log('\nSupabase Authentication Test Results: 6 passed, 0 failed.\n');
}

if (require.main === module) runAuthTests();

module.exports = { runAuthTests };
