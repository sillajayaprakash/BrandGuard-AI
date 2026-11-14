'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  FIXTURES,
  parseApprovalFile,
  parseFixtureRegistry,
  projectRefFromUrl,
  registryWithFixture
} = require('../scripts/fixture-safety.js');

const REF = 'abcdefghijklmnopqrst';
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

test('approval parser accepts only the exact disposable project schema', () => {
  assert.deepEqual(parseApprovalFile(JSON.stringify({
    projectName: 'BrandGuard-AI-Test', projectRef: REF
  })), { projectName: 'BrandGuard-AI-Test', projectRef: REF });
  assert.throws(() => parseApprovalFile(JSON.stringify({ projectName: 'production', projectRef: REF })));
  assert.throws(() => parseApprovalFile(JSON.stringify({
    projectName: 'BrandGuard-AI-Test', projectRef: REF, extra: true
  })));
  assert.throws(() => parseApprovalFile('{'));
});

test('URL reference parser accepts only a Supabase project URL with a valid host reference', () => {
  assert.equal(projectRefFromUrl(`https://${REF}.supabase.co`), REF);
  assert.throws(() => projectRefFromUrl('https://example.com'));
  assert.throws(() => projectRefFromUrl(`http://${REF}.supabase.co`));
  assert.throws(() => projectRefFromUrl(`https://${REF}.supabase.co.evil.example`));
});

test('registry accepts only known labels and valid unique UUIDs', () => {
  const valid = parseFixtureRegistry(JSON.stringify({
    version: 1, projectRef: REF, fixtures: { ADMIN_A: UUID_A }
  }));
  assert.deepEqual(valid.fixtures, { ADMIN_A: UUID_A });
  assert.throws(() => parseFixtureRegistry(JSON.stringify({
    version: 1, projectRef: REF, fixtures: { OTHER: UUID_A }
  })));
  assert.throws(() => registryWithFixture(valid, 'ADMIN_B', UUID_A));
  assert.deepEqual(FIXTURES, ['ADMIN_A', 'ADMIN_B', 'USER_C', 'USER_D', 'USER_E', 'USER_F']);
});

test('creator validates approval and registry before loading Supabase client or calling Auth Admin', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'create_disposable_auth_fixtures.js'), 'utf8');
  const approvalCheck = source.indexOf('approval = readApproval(');
  const registryCheck = source.indexOf('registry = readRegistry(');
  const clientLoad = source.indexOf("require('@supabase/supabase-js')");
  const adminCall = source.indexOf('supabase.auth.admin.');
  assert.ok(approvalCheck >= 0 && registryCheck > approvalCheck);
  assert.ok(clientLoad > registryCheck);
  assert.ok(adminCall > clientLoad);
  assert.doesNotMatch(source, /user_metadata|admin\.listUsers|\.eq\(['"]email['"]|console\.(log|error)\([^\n]*(password|serviceRoleKey|token)/i);
  assert.match(source, /status: 'CREATED'/);
  assert.match(source, /status: 'ALREADY_EXISTS'/);
  assert.match(source, /status: 'FAILED'/);
});
