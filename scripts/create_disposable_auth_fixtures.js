'use strict';

// Creates only the synthetic Auth fixtures in supabase/disposable_role_tests.md.
// It never discovers/adopts fixtures by email or user metadata.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  FIXTURES,
  parseApprovalFile,
  parseFixtureRegistry,
  projectRefFromUrl,
  registryWithFixture
} = require('./fixture-safety.js');

const LOCAL_DIR = path.join(__dirname, '..', '.local');
const APPROVAL_PATH = path.join(LOCAL_DIR, 'disposable-project-approval.json');
const REGISTRY_PATH = path.join(LOCAL_DIR, 'disposable-auth-fixtures.json');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emit(results) {
  for (const label of FIXTURES) {
    const result = results.get(label) || { id: '-', status: 'FAILED' };
    console.log(`${label} ${result.id || '-'} ${result.status}`);
  }
}

function readApproval(expectedConfirmation, projectUrl) {
  const stat = fs.lstatSync(APPROVAL_PATH);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('approval-not-regular-file');
  // The operator ACL must deny write access to the account running this script.
  try {
    fs.accessSync(APPROVAL_PATH, fs.constants.W_OK);
    throw new Error('approval-is-writable');
  } catch (error) {
    if (error.message === 'approval-is-writable') throw error;
    if (error.code !== 'EACCES' && error.code !== 'EPERM') throw error;
  }
  const approval = parseApprovalFile(fs.readFileSync(APPROVAL_PATH, 'utf8'));
  const urlRef = projectRefFromUrl(projectUrl);
  if (!expectedConfirmation || expectedConfirmation !== approval.projectRef || urlRef !== approval.projectRef) {
    throw new Error('project-reference-not-approved');
  }
  return approval;
}

function readRegistry(projectRef) {
  let contents;
  try {
    contents = fs.readFileSync(REGISTRY_PATH, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, projectRef, fixtures: {} };
    throw error;
  }
  const registry = parseFixtureRegistry(contents);
  if (registry.projectRef !== projectRef) throw new Error('registry-project-mismatch');
  return registry;
}

function writeRegistry(registry) {
  const temporaryPath = `${REGISTRY_PATH}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporaryPath, REGISTRY_PATH);
  } finally {
    try { fs.unlinkSync(temporaryPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

async function main() {
  const results = new Map();
  let approval;
  let registry;
  try {
    const projectUrl = process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const expectedConfirmation = process.argv[2] === '--confirm-project-ref' ? process.argv[3] : '';
    if (!projectUrl || !serviceRoleKey) throw new Error('missing-server-configuration');
    // All local approval, confirmation, URL, and registry checks precede Auth calls.
    approval = readApproval(expectedConfirmation, projectUrl);
    registry = readRegistry(approval.projectRef);
    if (Object.values(registry.fixtures).some(id => !UUID_PATTERN.test(id)) ||
        new Set(Object.values(registry.fixtures)).size !== Object.values(registry.fixtures).length) {
      throw new Error('invalid-registry-state');
    }
  } catch {
    for (const label of FIXTURES) results.set(label, { id: '-', status: 'FAILED' });
    emit(results);
    process.exitCode = 1;
    return;
  }

  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch {
    for (const label of FIXTURES) results.set(label, { id: '-', status: 'FAILED' });
    emit(results);
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  // Verify every recorded identity by UUID before creating any missing fixture.
  // A missing/unverifiable registry entry never causes an account to be adopted.
  for (const label of FIXTURES) {
    const id = registry.fixtures[label];
    if (!id) continue;
    try {
      const { data, error } = await supabase.auth.admin.getUserById(id);
      if (error || data?.user?.id !== id) throw new Error('fixture-identity-unverified');
      results.set(label, { id, status: 'ALREADY_EXISTS' });
    } catch {
      results.set(label, { id, status: 'FAILED' });
    }
  }
  if ([...results.values()].some(result => result.status === 'FAILED')) {
    for (const label of FIXTURES) if (!results.has(label)) results.set(label, { id: '-', status: 'FAILED' });
    emit(results);
    process.exitCode = 1;
    return;
  }

  for (const label of FIXTURES) {
    if (results.has(label)) continue;
    const email = `brandguard-ai-${approval.projectRef}-${label.toLowerCase()}@example.com`;
    const password = crypto.randomBytes(32).toString('base64url');
    try {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      const id = data?.user?.id;
      if (error || typeof id !== 'string' || !UUID_PATTERN.test(id) || Object.values(registry.fixtures).includes(id)) {
        results.set(label, { id: '-', status: 'FAILED' });
        continue;
      }
      const updated = registryWithFixture(registry, label, id);
      updated.projectRef = approval.projectRef;
      try {
        writeRegistry(updated);
      } catch {
        // The account may exist, but without a durable ID record it cannot safely
        // be recognized on a later run. Do not try to discover it by email.
        results.set(label, { id: '-', status: 'FAILED' });
        continue;
      }
      registry = updated;
      results.set(label, { id, status: 'CREATED' });
    } catch {
      results.set(label, { id: '-', status: 'FAILED' });
    }
  }

  emit(results);
  if ([...results.values()].some(result => result.status === 'FAILED')) process.exitCode = 1;
}

main().catch(() => {
  const results = new Map(FIXTURES.map(label => [label, { id: '-', status: 'FAILED' }]));
  emit(results);
  process.exitCode = 1;
});
