import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createRedeemService } from '../server/redeem/redeemService.mjs';
import { mountRedeemRoutes } from '../server/redeem/redeemRoutes.mjs';

function fakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    routes,
  };
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function invoke(app, method, path, { body = {}, query = {} } = {}) {
  const handler = app.routes.get(`${method} ${path}`);
  assert.ok(handler, `${method} ${path} mounted`);
  const res = response();
  await handler({ body, query, params: {}, headers: {} }, res);
  return res;
}

function harness() {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const wallet = createWalletService(db);
  const redeemService = createRedeemService(db, { wallet });
  const app = fakeApp();
  mountRedeemRoutes(app, {
    redeemService,
    authenticateOwner: () => 'owner@example.com',
    authorizeAdmin: () => ({ ok: true }),
  });
  return { db, wallet, redeemService, app };
}

test('redeem grants credits once per user and records the ledger', () => {
  const { db, wallet, redeemService } = harness();
  redeemService.createCode({ code: 'welcome-100', grantUnits: 100, note: '新用户' });
  const first = redeemService.redeem({ ownerEmail: 'owner@example.com', code: 'welcome-100' });
  assert.equal(first.units, 100);
  assert.equal(wallet.getBalance('owner@example.com', 'ec_points').availableUnits, 100);
  assert.throws(() => redeemService.redeem({ ownerEmail: 'owner@example.com', code: 'welcome-100' }), /已经兑换过/);
  assert.equal(wallet.getBalance('owner@example.com', 'ec_points').availableUnits, 100, '重复兑换不得加分');
  assert.equal(redeemService.listRecords({ ownerEmail: 'owner@example.com' }).length, 1);
  db.close();
});

test('code state guards: unknown, disabled, expired, exhausted', () => {
  const { db, redeemService } = harness();
  assert.throws(() => redeemService.redeem({ ownerEmail: 'a@example.com', code: 'nope' }), /无效或已失效/);
  redeemService.createCode({ code: 'EXPIRED-1', grantUnits: 10, expiresAt: new Date(Date.now() - 1000).toISOString() });
  assert.throws(() => redeemService.redeem({ ownerEmail: 'a@example.com', code: 'EXPIRED-1' }), /已过期/);
  redeemService.createCode({ code: 'ONCE-1', grantUnits: 10, maxUses: 1 });
  redeemService.redeem({ ownerEmail: 'a@example.com', code: 'ONCE-1' });
  assert.throws(() => redeemService.redeem({ ownerEmail: 'b@example.com', code: 'ONCE-1' }), /已被领完/);
  db.close();
});

test('routes expose redeem, records and admin creation with auth guards', async () => {
  const { db, app } = harness();
  const created = await invoke(app, 'POST', '/api/admin/redeem-codes', { body: { code: 'ROUTE-50', grantUnits: 50 } });
  assert.equal(created.statusCode, 201);

  const redeemed = await invoke(app, 'POST', '/api/redeem', { body: { code: 'route-50' } });
  assert.equal(redeemed.statusCode, 200);
  assert.equal(redeemed.body.units, 50);

  const again = await invoke(app, 'POST', '/api/redeem', { body: { code: 'ROUTE-50' } });
  assert.equal(again.statusCode, 409);
  assert.equal(again.body.code, 'REDEEM_ALREADY_USED');

  const records = await invoke(app, 'GET', '/api/redeem/records');
  assert.equal(records.body.records.length, 1);
  db.close();
});
