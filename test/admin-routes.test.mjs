import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { bootstrapDefaultAccountAccess, requireAdminAccess } from '../server/accessControl.mjs';
import { createAdminOperations } from '../server/adminOperations.mjs';
import { mountAdminRoutes } from '../server/adminRoutes.mjs';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    put(path, ...handlers) { routes.set(`PUT ${path}`, handlers); },
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
  assert.ok(handlers, `mounted ${method} ${path}`);
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

function harness({ videoOperations = null } = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  bootstrapDefaultAccountAccess(db);
  const walletService = createWalletService(db);
  walletService.grant({
    ownerEmail: '867550189@qq.com', currency: 'ec_points', units: 300000,
    idempotencyKey: 'owner-seed', sourceType: 'admin_grant', sourceId: 'migration',
  });
  walletService.grant({
    ownerEmail: '240485042@qq.com', currency: 'ec_points', units: 100000,
    idempotencyKey: 'tester-seed', sourceType: 'admin_grant', sourceId: 'migration',
  });
  const operations = createAdminOperations({ db, walletService, videoOperations });
  const app = createFakeApp();
  mountAdminRoutes(app, {
    operations,
    authenticateOwner(req) {
      const email = String(req.headers['x-test-user'] || '').trim().toLowerCase();
      if (!email) throw Object.assign(new Error('session required'), { code: 'AUTH_SESSION_REQUIRED' });
      return email;
    },
    authorizeAdmin(email) { return requireAdminAccess(db, email); },
  });
  return { app, db, walletService };
}

test('admin video operations are protected and audited without destructive bulk actions', async t => {
  const calls = [];
  const videoOperations = {
    metrics: () => ({ backlog: { reviewPending: 1 }, attention: [{ id: 'video-1' }] }),
    run: async input => ({ limit: input.limit, reconciliation: { checked: 1 } }),
    operate: async (jobId, input) => {
      calls.push([jobId, input.action]);
      return {
        action: input.action,
        before: { id: jobId, ownerEmail: '240485042@qq.com', status: 'needs_review' },
        after: { id: jobId, ownerEmail: '240485042@qq.com', status: 'queued' },
      };
    },
  };
  const { app, db } = harness({ videoOperations });
  t.after(() => db.close());

  assert.equal((await invoke(app, 'GET', '/api/admin/video-operations')).statusCode, 401);
  const dashboard = await invoke(app, 'GET', '/api/admin/video-operations', { headers: ownerHeaders });
  assert.equal(dashboard.statusCode, 200);
  assert.equal(dashboard.body.backlog.reviewPending, 1);

  const action = await invoke(app, 'POST', '/api/admin/video-jobs/:id/actions', {
    headers: ownerHeaders,
    params: { id: 'video-1' },
    body: {
      action: 'retry_confirmed_not_submitted', reason: '已在供应商后台确认未受理',
      idempotencyKey: 'video-retry-1',
    },
  });
  assert.equal(action.statusCode, 200);
  assert.deepEqual(calls, [['video-1', 'retry_confirmed_not_submitted']]);
  const audit = await invoke(app, 'GET', '/api/admin/audit', { headers: ownerHeaders });
  assert.equal(audit.body.entries[0].action, 'video.retry_confirmed_not_submitted');
  assert.equal(audit.body.entries[0].targetEmail, '240485042@qq.com');
});

function installMonitoringTables(db) {
  db.exec(`
    CREATE TABLE video_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT, status TEXT, provider_route TEXT,
      product_id TEXT, failure_class TEXT DEFAULT '', error TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE ecommerce_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT, status TEXT, error TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, owner_email TEXT, status TEXT, error TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT
    );
  `);
  db.prepare(`INSERT INTO video_jobs
    (id, owner_email, status, provider_route, product_id, failure_class, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('video-1', '240485042@qq.com', 'failed', 'sd5-seedance-2.0', 'seedance_standard', 'provider', 'upstream rejected request', '2026-08-11 10:00:00', '2026-08-11 10:01:00');
  db.prepare(`INSERT INTO video_jobs
    (id, owner_email, status, provider_route, product_id, failure_class, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('video-2', '240485042@qq.com', 'completed', 'sd5-seedance-2.0', 'seedance_standard', '', '', '2026-08-11 10:02:00', '2026-08-11 10:03:00');
  db.prepare(`INSERT INTO ecommerce_jobs
    (id, owner_email, status, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('ec-1', '240485042@qq.com', 'generating', '', '2026-08-11 10:04:00', '2026-08-11 10:05:00');
  db.prepare(`INSERT INTO tasks
    (id, owner_email, status, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('content-1', '240485042@qq.com', 'failed', 'analysis failed', '2026-08-11 10:06:00', '2026-08-11 10:07:00');
}

const ownerHeaders = { 'x-test-user': '867550189@qq.com' };
const testerHeaders = { 'x-test-user': '240485042@qq.com' };

test('admin endpoints reject anonymous and non-admin accounts', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  assert.equal((await invoke(app, 'GET', '/api/admin/summary')).statusCode, 401);
  const tester = await invoke(app, 'GET', '/api/admin/summary', { headers: testerHeaders });
  assert.equal(tester.statusCode, 403);
  assert.equal(tester.body.code, 'ACCOUNT_ADMIN_FORBIDDEN');
});

test('admin creates an account and assigns an arbitrary feature subset', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  const created = await invoke(app, 'POST', '/api/admin/accounts', {
    headers: ownerHeaders,
    body: {
      email: 'limited@example.com', role: 'tester', status: 'active', notes: '视觉内测',
      permissions: ['visual_creation', 'ecommerce_image'],
      reason: '邀请视觉内测', idempotencyKey: 'invite-limited-account',
    },
  });
  assert.equal(created.statusCode, 201);
  assert.deepEqual(created.body.account.permissions, ['ecommerce_image', 'visual_creation']);

  const detail = await invoke(app, 'GET', '/api/admin/accounts/:email', {
    headers: ownerHeaders,
    params: { email: 'limited@example.com' },
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.body.account.balances.ec_points.availableUnits, 0);
});

test('admin grant and revoke are real, idempotent, and audited', async t => {
  const { app, db, walletService } = harness();
  t.after(() => db.close());

  const grantBody = {
    operation: 'grant', currency: 'ec_points', units: 25000,
    reason: '追加第二轮测试额度', idempotencyKey: 'tester-credit-grant-2',
  };
  const first = await invoke(app, 'POST', '/api/admin/accounts/:email/credits', {
    headers: ownerHeaders, params: { email: '240485042@qq.com' }, body: grantBody,
  });
  const replay = await invoke(app, 'POST', '/api/admin/accounts/:email/credits', {
    headers: ownerHeaders, params: { email: '240485042@qq.com' }, body: grantBody,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(replay.statusCode, 200);
  assert.equal(walletService.getBalance('240485042@qq.com', 'ec_points').availableUnits, 125000);

  const revoke = await invoke(app, 'POST', '/api/admin/accounts/:email/credits', {
    headers: ownerHeaders,
    params: { email: '240485042@qq.com' },
    body: {
      operation: 'revoke', currency: 'ec_points', units: 5000,
      reason: '回收多发额度', idempotencyKey: 'tester-credit-revoke-1',
    },
  });
  assert.equal(revoke.statusCode, 200);
  assert.equal(walletService.getBalance('240485042@qq.com', 'ec_points').availableUnits, 120000);

  const audit = await invoke(app, 'GET', '/api/admin/audit', { headers: ownerHeaders });
  assert.equal(audit.statusCode, 200);
  assert.equal(audit.body.entries.filter(entry => entry.targetEmail === '240485042@qq.com').length, 2);
});

test('summary separates theoretical revenue, cash revenue, subsidy, cost, and contribution', async t => {
  const { app, db, walletService } = harness();
  t.after(() => db.close());
  const hold = walletService.createHold({
    ownerEmail: '240485042@qq.com', currency: 'ec_points', quoteId: 'summary-quote',
    idempotencyKey: 'summary-hold', items: [{ key: 'image', sku: 'ec_image_2k', units: 1000 }],
  });
  walletService.settleItem(hold.id, 'image', {
    referenceType: 'asset', referenceId: 'summary-asset', providerCostCny: 0.038,
    idempotencyKey: 'summary-settle',
    metadata: { feature: 'ecommerce_image', provider: 'image2', model: 'gpt-image-2' },
  });

  const response = await invoke(app, 'GET', '/api/admin/summary', { headers: ownerHeaders });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.metrics.pointsConsumed, 1000);
  assert.equal(response.body.metrics.cashRevenueCny, 0);
  assert.ok(response.body.metrics.theoreticalRevenueCny > 0);
  assert.ok(response.body.metrics.promoSubsidyCny > 0);
  assert.equal(response.body.metrics.providerCostCny, 0.038);
  assert.ok(response.body.metrics.theoreticalContributionCny > 0);
  assert.equal(response.body.byFeature[0].feature, 'ecommerce_image');
  assert.equal(response.body.bySku[0].sku, 'ec_image_2k');
  assert.equal(response.body.bySku[0].provider, 'image2');
  assert.equal(response.body.bySku[0].model, 'gpt-image-2');
  assert.equal(response.body.bySku[0].provider_cost_cny, 0.038);
  assert.ok(response.body.bySku[0].theoretical_contribution_cny > 0);
  assert.equal(response.body.unitEconomicsCatalog.unitsPerPoint, 1000);
  assert.equal(response.body.unitEconomicsCatalog.paymentFeeRate, 0.03);
  assert.equal(response.body.unitEconomicsCatalog.products.find(item => item.sku === 'ec_studio_199').priceFen, 19900);
  assert.equal(response.body.unitEconomicsCatalog.features.find(item => item.sku === 'ec_image_2k').providerCostCny, 0.038);
});

test('admin monitoring reports real task states, provider routes, and redacted failure reasons', async t => {
  const { app, db, walletService } = harness();
  t.after(() => db.close());
  installMonitoringTables(db);
  const operations = createAdminOperations({
    db,
    walletService,
    runtimeStatus: () => ({
      imageQueue: { active: 1, queued: 2, concurrency: 3 },
      ecommerce: { activeJobs: 1 },
      video: { running: 0, queued: 0, routes: [{ routeId: 'sd5-seedance-2.0', availability: 'ready', queue: { running: 0, queued: 0, capacity: 2 } }] },
    }),
  });
  const result = operations.monitoring({ limit: 20 });
  assert.equal(result.jobs.totals.active, 1);
  assert.equal(result.jobs.totals.completed, 1);
  assert.equal(result.jobs.totals.failed, 2);
  assert.equal(result.jobs.totals.failureRate, 0.6667);
  assert.equal(result.providerRoutes[0].routeId, 'sd5-seedance-2.0');
  assert.equal(result.providerRoutes[0].failed, 1);
  assert.equal(result.runtime.imageQueue.queued, 2);
  assert.equal(result.recentTasks.length, 4);
  assert.equal(result.recentFailures.length, 2);

  const monitoring = await invoke(app, 'GET', '/api/admin/monitoring', { headers: ownerHeaders });
  assert.equal(monitoring.statusCode, 200);
  assert.equal(monitoring.body.jobs.totals.failed, 2);
});

test('owner cannot lock the only management account by demoting or suspending itself', async t => {
  const { app, db } = harness();
  t.after(() => db.close());

  const demote = await invoke(app, 'PUT', '/api/admin/accounts/:email', {
    headers: ownerHeaders,
    params: { email: '867550189@qq.com' },
    body: {
      role: 'tester', status: 'active', reason: '误操作', idempotencyKey: 'owner-self-demote',
    },
  });
  const suspend = await invoke(app, 'PUT', '/api/admin/accounts/:email', {
    headers: ownerHeaders,
    params: { email: '867550189@qq.com' },
    body: {
      role: 'owner', status: 'suspended', reason: '误操作', idempotencyKey: 'owner-self-suspend',
    },
  });

  assert.equal(demote.statusCode, 403);
  assert.equal(suspend.statusCode, 403);
  assert.equal(requireAdminAccess(db, '867550189@qq.com').ok, true);
});
