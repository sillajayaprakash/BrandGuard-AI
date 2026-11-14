'use strict';

const PROJECT_NAME = 'BrandGuard-AI-Test';
const FIXTURES = Object.freeze(['ADMIN_A', 'ADMIN_B', 'USER_C', 'USER_D', 'USER_E', 'USER_F']);
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidProjectRef(value) {
  return typeof value === 'string' && PROJECT_REF_PATTERN.test(value);
}

function parseApprovalFile(contents) {
  const parsed = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-approval');
  }
  const keys = Object.keys(parsed).sort();
  if (keys.length !== 2 || keys[0] !== 'projectName' || keys[1] !== 'projectRef') {
    throw new Error('invalid-approval');
  }
  if (parsed.projectName !== PROJECT_NAME || !isValidProjectRef(parsed.projectRef)) {
    throw new Error('invalid-approval');
  }
  return Object.freeze({ projectName: parsed.projectName, projectRef: parsed.projectRef });
}

function projectRefFromUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('invalid-project-url');
  }
  const match = url.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  if (!match) throw new Error('invalid-project-url');
  return match[1];
}

function parseFixtureRegistry(contents) {
  const parsed = JSON.parse(contents);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1 ||
      !isValidProjectRef(parsed.projectRef) || !parsed.fixtures ||
      typeof parsed.fixtures !== 'object' || Array.isArray(parsed.fixtures)) {
    throw new Error('invalid-registry');
  }
  if (Object.keys(parsed).length !== 3 || Object.keys(parsed).some(key => !['version', 'projectRef', 'fixtures'].includes(key)) ||
      Object.keys(parsed.fixtures).some(label => !FIXTURES.includes(label))) {
    throw new Error('invalid-registry');
  }
  const fixtures = {};
  for (const [label, id] of Object.entries(parsed.fixtures)) {
    if (!UUID_PATTERN.test(id)) throw new Error('invalid-registry');
    fixtures[label] = id;
  }
  return { version: 1, projectRef: parsed.projectRef, fixtures };
}

function registryWithFixture(registry, label, id) {
  if (!FIXTURES.includes(label) || typeof id !== 'string' || !UUID_PATTERN.test(id)) {
    throw new Error('invalid-fixture-record');
  }
  const fixtures = { ...registry.fixtures, [label]: id };
  if (new Set(Object.values(fixtures)).size !== Object.values(fixtures).length) {
    throw new Error('duplicate-fixture-id');
  }
  return { version: 1, projectRef: registry.projectRef, fixtures };
}

module.exports = {
  FIXTURES,
  PROJECT_NAME,
  isValidProjectRef,
  parseApprovalFile,
  parseFixtureRegistry,
  projectRefFromUrl,
  registryWithFixture
};
