import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { bootstrapDefaultAccountAccess, requireAdminAccess, requireAccountAccess, upsertAccountAccess } from '../server/accessControl.mjs';
import { createAdminOperations } from '../server/adminOperations.mjs';
import { mountAdminRoutes } from '../server/adminRoutes.mjs';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    put(path, ...handlers) { routes.set(`PUT ${path}`, handlers); },
    delete(path, ...handlers) { routes.set(`DELETE ${path}`, handlers); },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

async function invoke(app, method, path, request = {}) {
  const handlers = app.routes.get(`${method} ${path}`);
  if (!handlers) throw new Error(`missing route ${method} ${path}`);
  const req = {
    body: request.body ?? {},
    headers: request.headers ?? {},
    query: request.query ?? {},
    params: request.params ?? {},
  };
  const res = createResponse();
  let index = 0;
  const next = async () => {
    const handler = handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return res;
}

const ownerHeaders = { 'x-test-user': '867550189@qq.com' };
const adminHeaders = { 'x-test-user': 'admin@shubao.cn' };
const testerHeaders = { 'x-test-user': '240485042@qq.com' };

function harness({ withUsage = true } = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  bootstrapDefaultAccountAccess(db);
  // 注入一个 admin 账号 (续命 P2)
  upsertAccountAccess(db, {
    email: 'admin@shubao.cn',
    role: 'admin',
    status: 'active',
    notes: '运营 admin',
    actorEmail: '867550189@qq.com',
    reason: '续命 P2 注入 admin 角色',
    idempotencyKey: 'seed-admin-role',
  });
  const walletService = createWalletService(db);
  walletService.grant({
    ownerEmail: '867550189@qq.com', currency: 'ec_points', units: 300000,
    idempotencyKey: 'owner-seed', sourceType: 'admin_grant', sourceId: 'migration',
  });
  walletService.grant({
    ownerEmail: '240485042@qq.com', currency: 'ec_points', units: 100000,
    idempotencyKey: 'tester-seed', sourceType: 'admin_grant', sourceId: 'migration',
  });
  if (withUsage) {
    // usage_events: tester 30 天前/内 都有记录
    const now = new Date();
    const dayAgo = (n) => new Date(now.getTime() - n * 86400_000).toISOString().replace('T', ' ').slice(0, 19);
    db.prepare(`INSERT INTO usage_events
      (id, owner_email, currency, sku, charged_units, shadow_units, provider_cost_cny,
       credit_face_value_cny, cash_revenue_cny, promo_subsidy_cny, cost_source, cost_confidence,
       feature, provider, model, catalog_version, reference_type, reference_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('u-1', '240485042@qq.com', 'ec_points', 'ec_image_2k', 30, 0, 1.14,
           30, 30, 0, 'catalog_fixed', 'medium',
           'ecommerce_image', '65535', '', 1, 'work', 'w-1', '{}', dayAgo(2));
    db.prepare(`INSERT INTO usage_events
      (id, owner_email, currency, sku, charged_units, shadow_units, provider_cost_cny,
       credit_face_value_cny, cash_revenue_cny, promo_subsidy_cny, cost_source, cost_confidence,
       feature, provider, model, catalog_version, reference_type, reference_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('u-2', '240485042@qq.com', 'ec_points', 'ec_image_4k', 60, 0, 2.28,
           60, 60, 0, 'catalog_fixed', 'medium',
           'ecommerce_image', '65535', '', 1, 'work', 'w-2', '{}', dayAgo(40));
    db.prepare(`INSERT INTO usage_events
      (id, owner_email, currency, sku, charged_units, shadow_units, provider_cost_cny,
       credit_face_value_cny, cash_revenue_cny, promo_subsidy_cny, cost_source, cost_confidence,
       feature, provider, model, catalog_version, reference_type, reference_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('u-3', '867550189@qq.com', 'ec_points', 'ec_image_2k', 10, 0, 0.38,
           10, 10, 0, 'catalog_fixed', 'medium',
           'ecommerce_image', '65535', '', 1, 'work', 'w-3', '{}', dayAgo(1));
    // 模拟一个"路人"邮箱: 没在 account_access, 只在 usage_events
    db.prepare(`INSERT INTO usage_events
      (id, owner_email, currency, sku, charged_units, shadow_units, provider_cost_cny,
       credit_face_value_cny, cash_revenue_cny, promo_subsidy_cny, cost_source, cost_confidence,
       feature, provider, model, catalog_version, reference_type, reference_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('u-4', 'stranger@example.com', 'ec_points', 'ec_image_2k', 5, 0, 0.19,
           5, 5, 0, 'catalog_fixed', 'medium',
           'ecommerce_image', '65535', '', 1, 'work', 'w-4', '{}', dayAgo(5));
  }
  const operations = createAdminOperations({ db, walletService });
  const app = createFakeApp();
  mountAdminRoutes(app, {
    operations,
    authenticateOwner(req) {
      const email = String(req.headers['x-test-user'] || '').trim().toLowerCase();
      if (!email) throw Object.assign(new Error('session required'), { code: 'AUTH_SESSION_REQUIRED' });
      return email;
    },
    authorizeAdmin(email) { return requireAdminAccess(db, email); },
    // 续命 P2: authorizeAccount 用 requireAccountAccess (active 即可) 让 admin 角色通过 requireAdminRole
    authorizeAccount(email) { return requireAccountAccess(db, email); },
  });
  return { app, db, walletService, operations };
}

test('admin/users rejects anonymous and non-admin/non-owner callers', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // 匿名 → 401
  const anon = await invoke(app, 'GET', '/api/admin/users');
  assert.equal(anon.statusCode, 401);
  assert.equal(anon.body.code, 'AUTH_SESSION_REQUIRED');

  // tester (member) → 403
  const tester = await invoke(app, 'GET', '/api/admin/users', { headers: testerHeaders });
  assert.equal(tester.statusCode, 403);
  assert.equal(tester.body.code, 'ACCOUNT_ADMIN_FORBIDDEN');
});

test('admin/users lists owner + admin + tester + stranger with balances and monthpack', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  const ownerView = await invoke(app, 'GET', '/api/admin/users', { headers: ownerHeaders });
  assert.equal(ownerView.statusCode, 200);
  assert.equal(ownerView.body.total, 4, 'owner + admin + tester + stranger');
  // owner 排第一
  assert.equal(ownerView.body.users[0].email, '867550189@qq.com');
  assert.equal(ownerView.body.users[0].role, 'owner');
  // admin 第二
  assert.equal(ownerView.body.users[1].email, 'admin@shubao.cn');
  assert.equal(ownerView.body.users[1].role, 'admin');
  // balances 字段存在
  for (const u of ownerView.body.users) {
    assert.ok(u.balances && u.balances.ec_points, 'balance present');
    assert.ok(typeof u.balances.ec_points.availableUnits === 'number');
    assert.ok('monthpack' in u);
  }
  // tester 总 actionCount = 全部 usage_events (u-1 2d + u-2 40d = 2),
  // 30 天过滤只在 getUserCostReport 里做, listUsers 不按 days 过滤
  const tester = ownerView.body.users.find(u => u.email === '240485042@qq.com');
  assert.equal(tester.role, 'tester');
  assert.equal(tester.actionCount, 2, 'tester total usage events: u-1 (2d) + u-2 (40d)');
  assert.ok(tester.lastActivityAt);
  assert.ok(tester.lastActivityAt);

  const adminView = await invoke(app, 'GET', '/api/admin/users', { headers: adminHeaders });
  assert.equal(adminView.statusCode, 200);
  assert.equal(adminView.body.total, 4);
});

test('admin/users supports search + limit + offset', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // search by email substring
  const found = await invoke(app, 'GET', '/api/admin/users', {
    headers: ownerHeaders, query: { search: 'qq.com' },
  });
  assert.equal(found.statusCode, 200);
  assert.equal(found.body.total, 2);  // owner + tester
  assert.deepEqual(found.body.users.map(u => u.email).sort(), ['240485042@qq.com', '867550189@qq.com']);

  // limit/offset
  const page1 = await invoke(app, 'GET', '/api/admin/users', {
    headers: ownerHeaders, query: { limit: 2, offset: 0 },
  });
  assert.equal(page1.body.users.length, 2);
  assert.equal(page1.body.total, 4);
  const page2 = await invoke(app, 'GET', '/api/admin/users', {
    headers: ownerHeaders, query: { limit: 2, offset: 2 },
  });
  assert.equal(page2.body.users.length, 2);
});

test('admin/users/:email/cost-report aggregates 30-day usage by sku and feature', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // tester: 30 天内只有 u-1 (2 天前, 30 charged, 1.14 cost), u-2 (40 天前, 不算)
  const report = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: ownerHeaders, params: { email: '240485042@qq.com' },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.email, '240485042@qq.com');
  assert.equal(report.body.days, 30);
  assert.equal(report.body.totals.actionCount, 1, 'only u-1 in last 30 days');
  assert.equal(report.body.totals.pointsConsumed, 30);
  assert.equal(report.body.totals.providerCostCny, 1.14);
  assert.equal(report.body.totals.theoreticalRevenueCny, 30);
  assert.equal(report.body.totals.theoreticalContributionCny, 28.86);
  // bySku: 只有 ec_image_2k
  assert.equal(report.body.bySku.length, 1);
  assert.equal(report.body.bySku[0].sku, 'ec_image_2k');
  assert.equal(report.body.bySku[0].actions, 1);
  // byFeature: ecommerce_image
  assert.equal(report.body.byFeature.length, 1);
  assert.equal(report.body.byFeature[0].feature, 'ecommerce_image');
});

test('admin/users/:email/cost-report supports custom days window', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // days=60 把 u-2 (40d) 也算进去
  const report = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: ownerHeaders, params: { email: '240485042@qq.com' }, query: { days: 60 },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.days, 60);
  assert.equal(report.body.totals.actionCount, 2);
  assert.equal(report.body.totals.providerCostCny, 1.14 + 2.28);
  assert.equal(report.body.bySku.length, 2);
});

test('admin/users/:email/cost-report rejects bad email', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // 非法 email (空字符串) 触发 ADMIN_REQUEST_INVALID → 400
  const bad = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: ownerHeaders, params: { email: '   ' },
  });
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.body.code, 'ADMIN_REQUEST_INVALID');
});

test('admin/users/:email/cost-report works for admin role (not just owner)', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  const report = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: adminHeaders, params: { email: '240485042@qq.com' },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.totals.actionCount, 1);
});

test('admin/users/:email/cost-report handles email with no usage', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  // 注入一个零用量 admin
  upsertAccountAccess(db, {
    email: 'newadmin@shubao.cn',
    role: 'admin', status: 'active', notes: '',
    actorEmail: '867550189@qq.com', reason: 'seed', idempotencyKey: 'seed-newadmin',
  });
  const report = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: ownerHeaders, params: { email: 'newadmin@shubao.cn' },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.totals.actionCount, 0);
  assert.equal(report.body.totals.pointsConsumed, 0);
  assert.equal(report.body.bySku.length, 0);
});

test('admin/users/:email/cost-report empty when usage_events table missing', async t => {
  const { app, db } = harness({ withUsage: false });
  t.after(() => db.close());

  const report = await invoke(app, 'GET', '/api/admin/users/:email/cost-report', {
    headers: ownerHeaders, params: { email: '240485042@qq.com' },
  });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.totals.actionCount, 0);
});
