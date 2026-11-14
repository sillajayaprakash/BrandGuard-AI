const assert = require('node:assert/strict');
const { createSupabaseRoleStore } = require('../lib/roles.js');

function makeRoleStore(initialRoles, rpcFailure = null) {
  const roles = new Map(initialRoles);
  const accounts = new Set([...roles.keys(), 'new-user']);
  let transactionQueue = Promise.resolve();

  // Mock-only serialization model of the SQL RPC contract. This does not execute PostgreSQL.
  async function runSerializedRoleFunction(args) {
    const operation = transactionQueue.then(async () => {
      if (rpcFailure) return { data: null, error: rpcFailure };
      if (!['user', 'reviewer', 'admin'].includes(args.p_role)) {
        return { data: null, error: { code: '22023', message: 'INVALID_ROLE' } };
      }
      if (!accounts.has(args.p_user_id)) {
        return { data: null, error: { code: 'P0002', message: 'USER_NOT_FOUND' } };
      }
      const admins = [...roles.values()].filter(role => role === 'admin').length;
      if (roles.get(args.p_user_id) === 'admin' && args.p_role !== 'admin' && admins <= 1) {
        return { data: null, error: { code: 'P0001', message: 'LAST_ADMIN' } };
      }
      roles.set(args.p_user_id, args.p_role);
      return {
        data: {
          user_id: args.p_user_id,
          role: args.p_role,
          assigned_by: args.p_assigned_by,
          created_at: 'test-created-at',
          updated_at: 'test-updated-at'
        },
        error: null
      };
    });
    transactionQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  const client = {
    auth: {
      admin: {
        getUserById: async id => accounts.has(id)
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: null }
      }
    },
    rpc: (name, args) => ({
      single: () => name === 'brandguard_assign_user_role'
        ? runSerializedRoleFunction(args)
        : Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Function not found' } })
    })
  };

  return {
    roles,
    store: createSupabaseRoleStore({
      supabaseUrl: 'https://project.example.test',
      serviceRoleKey: 'server-only-test-credential',
      clientFactory: () => client
    })
  };
}

async function runRoleStoreTests() {
  console.log('Running BrandGuard AI Atomic Role Assignment Tests...\n');

  {
    const { store, roles } = makeRoleStore([['user-a', 'user']]);
    const assigned = await store.assignRole({ userId: 'user-a', role: 'reviewer', assignedBy: 'verified-admin' });
    assert.equal(assigned.role, 'reviewer');
    assert.equal(assigned.assigned_by, 'verified-admin');
    assert.equal(roles.get('user-a'), 'reviewer');
    console.log('  ✔ [PASS] Role assignment calls the database function and preserves verified assigned_by');
  }

  {
    const { store, roles } = makeRoleStore([['only-admin', 'admin']]);
    await assert.rejects(
      store.assignRole({ userId: 'only-admin', role: 'user', assignedBy: 'verified-admin' }),
      error => error.code === 'LAST_ADMIN'
    );
    assert.equal(roles.get('only-admin'), 'admin');
    console.log('  ✔ [PASS] Final administrator demotion is rejected by the RPC result');
  }

  {
    const { store, roles } = makeRoleStore([['admin-a', 'admin'], ['admin-b', 'admin']]);
    const outcomes = await Promise.allSettled([
      store.assignRole({ userId: 'admin-a', role: 'user', assignedBy: 'admin-b' }),
      store.assignRole({ userId: 'admin-b', role: 'user', assignedBy: 'admin-a' })
    ]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'LAST_ADMIN').length, 1);
    assert.equal([...roles.values()].filter(role => role === 'admin').length, 1);
    console.log('  ✔ [PASS] Mock serialized concurrent demotions preserve at least one admin');
  }

  {
    const { store } = makeRoleStore([['user-a', 'user']], { code: 'XX000', message: 'database unavailable' });
    await assert.rejects(
      store.assignRole({ userId: 'user-a', role: 'reviewer', assignedBy: 'verified-admin' }),
      error => error.code === 'ROLE_STORE_UNAVAILABLE' && !error.message.includes('database unavailable')
    );
    console.log('  ✔ [PASS] Database function errors fail safely without exposing database details');
  }

  {
    const { store } = makeRoleStore([['user-a', 'user']]);
    await assert.rejects(
      store.assignRole({ userId: 'missing-user', role: 'reviewer', assignedBy: 'verified-admin' }),
      error => error.code === 'USER_NOT_FOUND'
    );
    await assert.rejects(
      store.assignRole({ userId: 'user-a', role: 'root', assignedBy: 'verified-admin' }),
      error => error.code === 'INVALID_ROLE'
    );
    console.log('  ✔ [PASS] Missing users and invalid role values are rejected');
  }

  console.log('\nAtomic Role Assignment Test Results: 5 passed, 0 failed. PostgreSQL concurrency is not exercised by this mock.\n');
}

if (require.main === module) runRoleStoreTests().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = { runRoleStoreTests };
