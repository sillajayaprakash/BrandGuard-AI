const assert = require('node:assert/strict');
const fs = require('node:fs');
const commentsApi = require('../public/js/comments.js');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

function run(name, test) {
  try {
    test();
    console.log(`  ✔ [PASS] ${name}`);
  } catch (error) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`     ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

console.log('Running BrandGuard AI Finding Comment Tests...\n');

run('Uses the dedicated finding comments storage key', () => {
  assert.equal(commentsApi.STORAGE_KEY, 'brandguard_finding_comments_v1');
});

run('Adds comments with unique IDs, text, and creation timestamps', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  const first = manager.addComment('apexTech', 'fp_1', 'audited content', 'Review this claim');
  const second = manager.addComment('apexTech', 'fp_1', 'audited content', 'Check the source');
  assert.notEqual(first.id, second.id);
  assert.equal(first.text, 'Review this claim');
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.equal(manager.getComments('apexTech', 'fp_1', 'audited content').length, 2);
});

run('Deletes only the selected comment', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  const first = manager.addComment('apexTech', 'fp_1', 'copy', 'First');
  manager.addComment('apexTech', 'fp_1', 'copy', 'Second');
  assert.equal(manager.deleteComment('apexTech', 'fp_1', 'copy', first.id), true);
  assert.deepEqual(manager.getComments('apexTech', 'fp_1', 'copy').map(item => item.text), ['Second']);
  assert.equal(manager.deleteComment('apexTech', 'fp_1', 'copy', 'missing'), false);
});

run('Comments persist when the storage manager is recreated', () => {
  const storage = new MemoryStorage();
  commentsApi.createManager(storage).addComment('apexTech', 'uc_2', 'content', 'Persistent note');
  const restartedManager = commentsApi.createManager(storage);
  assert.equal(restartedManager.getComments('apexTech', 'uc_2', 'content')[0].text, 'Persistent note');
});

run('Malformed localStorage data is ignored safely and can be replaced', () => {
  const storage = new MemoryStorage({ [commentsApi.STORAGE_KEY]: '{invalid json' });
  const manager = commentsApi.createManager(storage);
  assert.deepEqual(manager.getComments('apexTech', 'fp_1', 'copy'), []);
  manager.addComment('apexTech', 'fp_1', 'copy', 'Recovered');
  assert.equal(manager.getComments('apexTech', 'fp_1', 'copy')[0].text, 'Recovered');
});

run('Scopes comments by preset, finding ID, and audited-content fingerprint', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  manager.addComment('apexTech', 'fp_1', 'Original content', 'Scoped note');
  assert.equal(manager.getComments('novaPay', 'fp_1', 'Original content').length, 0);
  assert.equal(manager.getComments('apexTech', 'fp_2', 'Original content').length, 0);
  assert.equal(manager.getComments('apexTech', 'fp_1', 'Changed content').length, 0);
  assert.equal(manager.getComments('apexTech', 'fp_1', 'Original content').length, 1);
});

run('Rejects empty or whitespace-only comments', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  assert.throws(() => manager.addComment('apexTech', 'fp_1', 'copy', ''), /cannot be empty/i);
  assert.throws(() => manager.addComment('apexTech', 'fp_1', 'copy', '  \n  '), /cannot be empty/i);
});

run('Keeps HTML-like input as literal text and the UI renders it via textContent', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const manager = commentsApi.createManager(new MemoryStorage());
  assert.equal(manager.addComment('apexTech', 'fp_1', 'copy', payload).text, payload);
  const appSource = fs.readFileSync(require.resolve('../public/js/app.js'), 'utf8');
  const section = appSource.slice(appSource.indexOf('  function appendFindingComments('), appSource.indexOf('  /**\n   * Apply Single Issue Fix'));
  assert.match(section, /body\.textContent\s*=\s*comment\.text/);
  assert.doesNotMatch(section, /innerHTML/);
});

run('Keeps comments isolated across multiple findings', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  manager.addComment('apexTech', 'fp_1', 'copy', 'First finding note');
  manager.addComment('apexTech', 'uc_1', 'copy', 'Second finding note');
  assert.deepEqual(manager.getComments('apexTech', 'fp_1', 'copy').map(item => item.text), ['First finding note']);
  assert.deepEqual(manager.getComments('apexTech', 'uc_1', 'copy').map(item => item.text), ['Second finding note']);
});

run('Scopes persisted finding comments to the authenticated browser account', () => {
  const manager = commentsApi.createManager(new MemoryStorage());
  manager.addComment('apexTech', 'fp_1', 'copy', 'Private account note', 'user-one');
  assert.equal(manager.getComments('apexTech', 'fp_1', 'copy', 'user-two').length, 0);
  assert.equal(manager.getComments('apexTech', 'fp_1', 'copy', 'user-one')[0].text, 'Private account note');
});

run('Formats comments safely for Markdown and as plain text for PDF', () => {
  const comment = { id: 'c1', text: '<script>alert(1)</script> `quoted`', createdAt: '2026-11-12T10:00:00.000Z' };
  const markdown = commentsApi.formatMarkdownComments([comment]);
  const plainText = commentsApi.formatPlainTextComments([comment]);
  assert.match(markdown, /&lt;script&gt;/);
  assert.doesNotMatch(markdown, /<script>/);
  assert.match(plainText, /<script>alert\(1\)<\/script>/);
  assert.equal(commentsApi.formatMarkdownComments([]), '');
  assert.equal(commentsApi.formatPlainTextComments([]), '');
});

run('Both audit exporters retrieve and format comments per finding', () => {
  const appSource = fs.readFileSync(require.resolve('../public/js/app.js'), 'utf8');
  const markdownExport = appSource.slice(
    appSource.indexOf('  function exportAuditReport() {'),
    appSource.indexOf('  /**\n   * Export the current audit snapshot', appSource.indexOf('  function exportAuditReport() {'))
  );
  const pdfExport = appSource.slice(
    appSource.indexOf('  function exportAuditPdf() {'),
    appSource.indexOf('  function registerEventListeners()', appSource.indexOf('  function exportAuditPdf() {'))
  );
  assert.match(markdownExport, /getComments\([\s\S]*?formatMarkdownComments/);
  assert.match(pdfExport, /getComments\([\s\S]*?formatPlainTextComments/);
});
