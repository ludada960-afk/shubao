import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { bootstrapBetaCreditGrants } from '../server/db.mjs';

import {
  ACCOUNT_FEATURES,
  bootstrapDefaultAccountAccess,
  ensureAccessSchema,
  getAccountAccess,
  requireAdminAccess,
  requireFeatureAccess,
  replaceAccountFeatures,
  upsertAccountAccess,
} from '../server/accessControl.mjs';

function harness() {
  const db = new Database(':memory:');
  ensureAccessSchema(db);
  return db;
}

test('bootstraps the owner and tester once with explicit four-feature access', t => {
  const db = harness();
  t.after(() => db.close());

  const first = bootstrapDefaultAccountAccess(db);
  const second = bootstrapDefaultAccountAccess(db);

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.deepEqual(getAccountAccess(db, ' 867550189@QQ.COM '), {
    email: '867550189@qq.com',
    role: 'owner',
    status: 'active',
    notes: '系统迁移的主管理员账号',
    expiresAt: null,
    permissions: [...ACCOUNT_FEATURES],
    allFeatures: true,
  });
  assert.deepEqual(getAccountAccess(db, '240485042@qq.com').permissions, [...ACCOUNT_FEATURES]);
  assert.equal(getAccountAccess(db, '240485042@qq.com').role, 'tester');
});

test('does not restore a permission that an administrator removed after migration', t => {
  const db = harness();
  t.after(() => db.close());
  bootstrapDefaultAccountAccess(db);

  replaceAccountFeatures(db, {
    email: '240485042@qq.com',
    features: ['ecommerce_image'],
    actorEmail: '867550189@qq.com',
    reason: '缩小测试范围',
    idempotencyKey: 'permission-change-1',
  });
  bootstrapDefaultAccountAccess(db);

  assert.deepEqual(getAccountAccess(db, '240485042@qq.com').permissions, ['ecommerce_image']);
});

test('authorizes only active accounts with the requested explicit feature', t => {
  const db = harness();
  t.after(() => db.close());
  ensureAccessSchema(db);
  upsertAccountAccess(db, {
    email: 'limited@example.com',
    role: 'tester',
    status: 'active',
    actorEmail: 'admin@example.com',
    reason: '邀请内测',
    idempotencyKey: 'invite-limited',
  });
  replaceAccountFeatures(db, {
    email: 'limited@example.com',
    features: ['visual_creation'],
    actorEmail: 'admin@example.com',
    reason: '只测试自由创作',
    idempotencyKey: 'features-limited',
  });

  assert.equal(requireFeatureAccess(db, 'limited@example.com', 'visual_creation').ok, true);
  assert.deepEqual(requireFeatureAccess(db, 'limited@example.com', 'video_generation'), {
    ok: false,
    status: 403,
    code: 'ACCOUNT_FEATURE_FORBIDDEN',
    error: '当前账号未开通该功能',
  });

  upsertAccountAccess(db, {
    email: 'limited@example.com',
    role: 'tester',
    status: 'suspended',
    actorEmail: 'admin@example.com',
    reason: '暂停测试',
    idempotencyKey: 'suspend-limited',
  });
  assert.equal(requireFeatureAccess(db, 'limited@example.com', 'visual_creation').code, 'ACCOUNT_SUSPENDED');
});

test('keeps admin authorization separate from product permissions', t => {
  const db = harness();
  t.after(() => db.close());
  bootstrapDefaultAccountAccess(db);

  assert.equal(requireAdminAccess(db, '867550189@qq.com').ok, true);
  assert.deepEqual(requireAdminAccess(db, '240485042@qq.com'), {
    ok: false,
    status: 403,
    code: 'ACCOUNT_ADMIN_FORBIDDEN',
    error: '当前账号没有管理权限',
  });

  upsertAccountAccess(db, {
    email: 'delegated-admin@example.com',
    role: 'admin',
    status: 'active',
    actorEmail: '867550189@qq.com',
    reason: '验证后台仅限主管理员',
    idempotencyKey: 'delegated-admin-owner-only-check',
  });
  assert.deepEqual(requireAdminAccess(db, 'delegated-admin@example.com'), {
    ok: false,
    status: 403,
    code: 'ACCOUNT_ADMIN_FORBIDDEN',
    error: '当前账号没有管理权限',
  });
});

test('rejects unknown feature identifiers and invalid account input', t => {
  const db = harness();
  t.after(() => db.close());

  assert.throws(() => replaceAccountFeatures(db, {
    email: 'bad@example.com',
    features: ['made_up_feature'],
    actorEmail: 'admin@example.com',
    reason: 'invalid',
    idempotencyKey: 'invalid-feature',
  }), /Unknown account feature/);
  assert.throws(() => upsertAccountAccess(db, {
    email: 'not-an-email',
    role: 'tester',
    status: 'active',
    actorEmail: 'admin@example.com',
    reason: 'invalid',
    idempotencyKey: 'invalid-email',
  }), /valid email/);
});

test('grants the two migrated accounts real point balances exactly once', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  ensureBillingSchema(db);

  bootstrapBetaCreditGrants(db);
  bootstrapBetaCreditGrants(db);

  const wallet = createWalletService(db);
  assert.deepEqual(wallet.getBalance('867550189@qq.com', 'ec_points'), {
    availableUnits: 300000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.deepEqual(wallet.getBalance('240485042@qq.com', 'ec_points'), {
    availableUnits: 100000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count FROM wallet_ledger
    WHERE idempotency_key LIKE 'beta-credit-bootstrap-2026-08-11:%'
  `).get().count, 2);
});
