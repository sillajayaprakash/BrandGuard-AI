'use strict';

const assert = require('node:assert/strict');

async function runWorkflowTests() {
  console.log('Running BrandGuard AI Shared Review Workflow Tests...\n');
  const savedWindow = global.window;
  const savedStorage = global.localStorage;
  const savedDocument = global.document;
  const rows = [];
  let denyReview = false;
  let ignoreDelete = false;
  let apiUserId = 'owner-id';
  const calls = [];
  global.localStorage = new Proxy({}, { get() { throw new Error('revision history must not use localStorage'); } });
  global.document = {};
  global.window = {
    BrandGuardAuth: {
      apiFetch: async (path, init = {}) => {
        calls.push({ path, init });
        const method = init.method || 'GET';
        if (method === 'GET') return { ok: true, json: async () => ({ revisions: [...rows] }) };
        if (method === 'POST') {
          const body = JSON.parse(init.body);
          if (body.revisionId && denyReview) return { ok: false, json: async () => ({ error: 'Reviewer role required.' }) };
          if (body.revisionId) {
            const row = rows.find(item => item.id === body.revisionId);
            Object.assign(row, { status: body.status, statusLabel: body.status === 'approved' ? 'Approved' : 'Changes Requested', notes: body.notes, reviewedBy: 'reviewer-id' });
            return { ok: true, json: async () => ({ revision: { ...row } }) };
          }
          const row = {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', versionNumber: 1, timestamp: new Date().toISOString(),
            title: 'Revision #1', presetId: body.presetId, content: body.content, score: body.score,
            status: 'draft', statusLabel: 'Draft', issuesCount: 0, criticalCount: 0, warningCount: 0,
            advisoryCount: 0, author: 'owner@example.test', ownerId: 'owner-id', notes: ''
          };
          rows.unshift(row);
          return { ok: true, json: async () => ({ revision: { ...row } }) };
        }
        if (method === 'DELETE') {
          if (!ignoreDelete) {
            for (let index = rows.length - 1; index >= 0; index--) {
              if (rows[index].ownerId === apiUserId) rows.splice(index, 1);
            }
          }
          return { ok: true, json: async () => ({ revisions: [] }) };
        }
        throw new Error(`Unexpected method: ${method}`);
      }
    }
  };

  try {
    delete require.cache[require.resolve('../public/js/history.js')];
    require('../public/js/history.js');
    const history = global.window.BrandHistoryManager;
    assert.deepEqual(await history.init('owner-id'), []);
    const saved = await history.saveDraft({ presetId: 'apexTech', content: 'Draft content', score: 91 });
    assert.equal(saved.ownerId, 'owner-id');
    assert.equal(calls.at(-1).path, '/api/revisions');
    assert.equal(JSON.parse(calls.at(-1).init.body).ownerId, undefined);
    console.log('  ✔ [PASS] Drafts are created on the server without trusting client ownership fields');

    assert.equal((await history.init('reviewer-id')).length, 1);
    assert.equal(history.getRevisionById(saved.id).content, 'Draft content');
    console.log('  ✔ [PASS] History is reloaded from the API, including shared revisions');

    denyReview = true;
    await assert.rejects(history.addRevisionConfirmed({ revisionId: saved.id, status: 'approved' }), /Reviewer role required/);
    assert.equal(history.getRevisionById(saved.id).status, 'draft');
    denyReview = false;
    const reviewed = await history.addRevisionConfirmed({ revisionId: saved.id, status: 'changes_requested', notes: 'Revise this.' });
    assert.equal(reviewed.ownerId, 'owner-id');
    assert.equal(reviewed.reviewedBy, 'reviewer-id');
    assert.equal(reviewed.status, 'changes_requested');
    apiUserId = 'reviewer-id';
    rows.push({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', ownerId: 'reviewer-id', status: 'draft', content: 'Reviewers own draft' });
    await history.init('reviewer-id');
    assert.equal(history.getRevisions().length, 2, 'reviewers should see their own and shared revisions');
    ignoreDelete = true;
    await assert.rejects(history.clearHistory(), /could not be confirmed/i);
    assert.equal(history.getRevisions().filter(item => item.ownerId === 'reviewer-id').length, 1, 'a no-op delete must be detected by reloading from the API');
    ignoreDelete = false;
    await history.clearHistory();
    assert.equal(calls.at(-1).path, '/api/revisions');
    assert.equal(history.getRevisions().length, 1, 'shared history remains visible after clearing the reviewer-owned history');
    assert.equal(history.getRevisions()[0].ownerId, 'owner-id');
    console.log('  ✔ [PASS] Clear History reloads server state and retains other users\' shared revisions');
    console.log("  ✔ [PASS] Review decisions update the owner's draft only after server confirmation");
  } finally {
    global.window = savedWindow;
    global.localStorage = savedStorage;
    global.document = savedDocument;
    delete require.cache[require.resolve('../public/js/history.js')];
  }

  console.log('\nShared Review Workflow Test Results: 4 passed, 0 failed.\n');
}

if (require.main === module) runWorkflowTests().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = { runWorkflowTests };
