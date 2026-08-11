import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import { initDB, closeDB, migrateLegacyUserCredits } from '../server/db.mjs';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaymentService } from '../server/billing/paymentService.mjs';
import { createSessionTokenService, authenticateContentRequest } from '../server/billing/contentBilling.mjs';
import { mountBillingRoutes } from '../server/billing/routes.mjs';
import { createBillingQuoteService } from '../server/billing/quoteService.mjs';
import { isUnlimitedBetaEmail } from '../server/accessPolicy.mjs';

const SESSION_SECRET = 'billing-route-test-secret-billing-route-test-secret';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
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
    rawBody: request.rawBody,
  };
  const res = createResponse();
  let index = 0;
  const next = async () => {
    const handler = handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return { req, res };
}

function createHarness({ isUnlimited = () => false, providers = {}, walletOverride } = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = walletOverride ?? createWalletService(db, { isUnlimited });
  const paymentService = createPaymentService(db, walletService, providers);
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  const quoteService = createBillingQuoteService({ secret: SESSION_SECRET });
  const app = createFakeApp();
  mountBillingRoutes(app, {
    walletService,
    paymentService,
    quoteService,
    authenticateOwner(req) {
      return authenticateContentRequest(req, {
        sessionTokens,
        authorizeEmail: email => ({ ok: true, email }),
      });
    },
  });
  return { app, db, walletService, paymentService, quoteService, sessionTokens };
}

function signedHeaders(sessionTokens, email) {
  return { authorization: `Bearer ${sessionTokens.issue(email).token}` };
}

test('unauthenticated balance, order, and ledger access is rejected', async t => {
  const { app, db } = createHarness();
  t.after(() => db.close());

  for (const [method, path, request] of [
    ['GET', '/api/billing/balance', {}],
    ['POST', '/api/billing/orders', { body: {} }],
    ['GET', '/api/billing/ledger', {}],
  ]) {
    const { res } = await invoke(app, method, path, request);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_SESSION_REQUIRED');
  }
});

test('a signed session owner overrides a spoofed client email', async t => {
  const { app, db, walletService, sessionTokens } = createHarness();
  t.after(() => db.close());
  walletService.grant({
    ownerEmail: 'trusted@example.com', currency: 'content_sets', units: 4,
    idempotencyKey: 'trusted-grant',
  });

  const { res } = await invoke(app, 'GET', '/api/billing/balance', {
    headers: signedHeaders(sessionTokens, 'trusted@example.com'),
    query: { email: 'attacker@example.com' },
    body: { email: 'attacker@example.com' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.balances.content_sets.availableUnits, 4);
});

test('catalog exposes enabled pixel-layer pricing without provider costs', async t => {
  const { app, db } = createHarness();
  t.after(() => db.close());

  const { res } = await invoke(app, 'GET', '/api/billing/catalog');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.features.find(item => item.sku === 'ec_layer_psd'), { sku: 'ec_layer_psd', units: 3000, currency: 'ec_points' });
  assert.equal(JSON.stringify(res.body).includes('providerCostCny'), false);
});

test('public catalog advertises only the shared point wallet', async t => {
  const { app, db } = createHarness();
  t.after(() => db.close());

  const { res } = await invoke(app, 'GET', '/api/billing/catalog');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.billing, {
    primaryCurrency: 'ec_points',
    displayUnit: 'AI 积分',
    unitsPerPoint: 1000,
  });
  assert.equal(res.body.products.some(product => product.currency === 'content_sets'), false);
  assert.equal(res.body.features.some(feature => feature.currency === 'content_sets'), false);
  assert.ok(res.body.products.some(product => product.sku === 'ec_starter_29'));
  assert.ok(res.body.features.some(feature => feature.sku === 'xhs_image_set_2k'));
  assert.ok(res.body.features.some(feature => feature.sku === 'video_seedance_fast_short'));
  assert.ok(res.body.features.some(feature => feature.sku === 'video_seedance_standard_long'));
  assert.equal(res.body.features.some(feature => feature.sku.startsWith('video_minimax_h3_2k_')), false);
});

test('new order routes reject legacy content-set products even when a provider is enabled', async t => {
  const providers = {
    testpay: {
      enabled: true,
      createOrder: () => ({ providerOrderId: 'must-not-be-created' }),
    },
  };
  const { app, db, sessionTokens } = createHarness({ providers });
  t.after(() => db.close());

  const { res } = await invoke(app, 'POST', '/api/billing/orders', {
    headers: signedHeaders(sessionTokens, 'buyer@example.com'),
    body: { productSku: 'xhs_entry_19', provider: 'testpay', idempotencyKey: 'legacy-order-blocked' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'BILLING_REQUEST_INVALID');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 0);
});

test('quotes ignore client supplied units and price', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());

  const { res } = await invoke(app, 'POST', '/api/billing/quote', {
    headers: signedHeaders(sessionTokens, 'quoted@example.com'),
    body: { sku: 'ec_image_2k', quantity: 2, units: 1, price: 0, amount: 0, credits: 999999 },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    Object.fromEntries(Object.entries(res.body.quote).filter(([key]) => !['quoteId', 'expiresAt'].includes(key))),
    { sku: 'ec_image_2k', quantity: 2, units: 1000, totalUnits: 2000, currency: 'ec_points' },
  );
  assert.match(res.body.quote.quoteId, /^bq1\./);
  assert.ok(Date.parse(res.body.quote.expiresAt) > Date.now());
  assert.equal(JSON.stringify(res.body.quote).includes('providerCostCny'), false);
});

test('owner account reports a real numeric balance', async t => {
  const owner = '867550189@qq.com';
  const { app, db, walletService, sessionTokens } = createHarness();
  t.after(() => db.close());
  walletService.grant({ ownerEmail: owner, currency: 'ec_points', units: 300000, idempotencyKey: 'owner-real-balance' });

  const { res } = await invoke(app, 'GET', '/api/billing/balance', {
    headers: signedHeaders(sessionTokens, owner),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.unlimited, false);
  assert.deepEqual(res.body.balances.ec_points, { availableUnits: 300000, heldUnits: 0, unlimited: false });
});

test('full beta tester account receives a real numeric balance', async t => {
  const tester = '240485042@qq.com';
  const { app, db, walletService, sessionTokens } = createHarness();
  t.after(() => db.close());
  walletService.grant({ ownerEmail: tester, currency: 'ec_points', units: 100000, idempotencyKey: 'tester-real-balance' });

  const { res } = await invoke(app, 'GET', '/api/billing/balance', {
    headers: signedHeaders(sessionTokens, tester),
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.unlimited, false);
  assert.deepEqual(res.body.balances.ec_points, { availableUnits: 100000, heldUnits: 0, unlimited: false });
});

test('orders and ledger entries are scoped to the signed owner', async t => {
  const providers = {
    testpay: {
      enabled: true,
      createOrder: () => ({ providerOrderId: 'remote-order-1' }),
      verifyEvent: event => event,
    },
  };
  const { app, db, walletService, paymentService, sessionTokens } = createHarness({ providers });
  t.after(() => db.close());
  const order = paymentService.createOrder({
    ownerEmail: 'first@example.com', productSku: 'xhs_entry_19', provider: 'testpay', idempotencyKey: 'order-first',
  });
  walletService.grant({
    ownerEmail: 'first@example.com', currency: 'content_sets', units: 3, idempotencyKey: 'first-ledger',
  });
  const headers = signedHeaders(sessionTokens, 'second@example.com');

  const orderResponse = await invoke(app, 'GET', '/api/billing/orders/:id', {
    headers, params: { id: order.id },
  });
  assert.equal(orderResponse.res.statusCode, 404);
  assert.equal(orderResponse.res.body.code, 'BILLING_ORDER_NOT_FOUND');

  const ledgerResponse = await invoke(app, 'GET', '/api/billing/ledger', {
    headers, query: { currency: 'content_sets' },
  });
  assert.equal(ledgerResponse.res.statusCode, 200);
  assert.deepEqual(ledgerResponse.res.body.entries, []);

  const invalidPage = await invoke(app, 'GET', '/api/billing/ledger', {
    headers, query: { currency: 'content_sets', limit: '0' },
  });
  assert.equal(invalidPage.res.statusCode, 400);
  assert.equal(invalidPage.res.body.code, 'BILLING_REQUEST_INVALID');
});

test('legacy users credits migrate once across repeated initialization', t => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-billing-routes-'));
  const dbPath = join(directory, 'works.db');
  t.after(() => { closeDB(); rmSync(directory, { recursive: true, force: true }); });

  const initial = initDB(dbPath);
  initial.prepare('INSERT INTO users (email, credits) VALUES (?, ?)').run('867550189@qq.com', 2);
  closeDB();

  const migrated = initDB(dbPath);
  assert.deepEqual(
    migrated.prepare('SELECT available_units, held_units FROM wallets WHERE owner_email = ? AND currency = ?')
      .get('867550189@qq.com', 'content_sets'),
    { available_units: 2, held_units: 0 },
  );
  assert.equal(
    migrated.prepare('SELECT COUNT(*) AS count FROM wallet_ledger WHERE idempotency_key = ?')
      .get('legacy-content-credit:867550189@qq.com').count,
    1,
  );
  assert.equal(migrated.prepare('SELECT credits FROM users WHERE email = ?').get('867550189@qq.com').credits, 2);
  migrated.prepare('UPDATE users SET credits = ? WHERE email = ?').run(9, '867550189@qq.com');
  closeDB();

  const restarted = initDB(dbPath);
  assert.equal(
    restarted.prepare('SELECT COUNT(*) AS count FROM wallet_ledger WHERE idempotency_key = ?')
      .get('legacy-content-credit:867550189@qq.com').count,
    1,
  );
  assert.deepEqual(
    restarted.prepare('SELECT available_units, held_units FROM wallets WHERE owner_email = ? AND currency = ?')
      .get('867550189@qq.com', 'content_sets'),
    { available_units: 2, held_units: 0 },
  );
});

test('newly imported legacy users can migrate in the same startup', t => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-billing-import-'));
  const dbPath = join(directory, 'works.db');
  t.after(() => { closeDB(); rmSync(directory, { recursive: true, force: true }); });

  const database = initDB(dbPath);
  database.prepare('INSERT INTO users (email, credits) VALUES (?, ?)').run('imported@example.com', 5);
  migrateLegacyUserCredits(database);

  assert.deepEqual(
    database.prepare('SELECT available_units, held_units FROM wallets WHERE owner_email = ? AND currency = ?')
      .get('imported@example.com', 'content_sets'),
    { available_units: 5, held_units: 0 },
  );
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM wallet_ledger WHERE idempotency_key = ?')
      .get('legacy-content-credit:imported@example.com').count,
    1,
  );
});

test('SQLite busy errors map to a retryable structured HTTP response', async t => {
  const busyError = new Error('database is locked');
  busyError.code = 'SQLITE_BUSY';
  const walletOverride = {
    grant() {},
    getBalance() { throw busyError; },
    listLedger() { throw busyError; },
  };
  const { app, db, sessionTokens } = createHarness({ walletOverride });
  t.after(() => db.close());

  const { res } = await invoke(app, 'GET', '/api/billing/balance', {
    headers: signedHeaders(sessionTokens, 'busy@example.com'),
  });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    error: '账务服务繁忙，请稍后重试',
    code: 'BILLING_DATABASE_BUSY',
    retryable: true,
    retryAfterSeconds: 1,
  });
});

test('legacy products are rejected before disabled payment providers are consulted', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());

  const { res } = await invoke(app, 'POST', '/api/billing/orders', {
    headers: signedHeaders(sessionTokens, 'buyer@example.com'),
    body: {
      productSku: 'xhs_entry_19', provider: 'unconfigured', idempotencyKey: 'disabled-provider-order',
      amount: 1, sets: 99, email: 'attacker@example.com',
    },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'BILLING_REQUEST_INVALID');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 0);
});

test('public catalog exposes only safe payment provider availability', async t => {
  const providers = {
    testpay: {
      enabled: true,
      secret: 'must-not-leak',
      url: 'https://private.invalid',
      createOrder: () => ({ providerOrderId: 'remote-order-1' }),
      verifyEvent: event => event,
    },
    disabled: {
      enabled: false,
      secret: 'also-private',
    },
  };
  const { app, db } = createHarness({ providers });
  t.after(() => db.close());

  const { res } = await invoke(app, 'GET', '/api/billing/catalog');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.paymentProviders, [
    { id: 'testpay', enabled: true },
    { id: 'disabled', enabled: false },
  ]);
  assert.doesNotMatch(JSON.stringify(res.body), /must-not-leak|private\.invalid|also-private/);
});

test('public catalog reports no enabled payment route in production-equivalent configuration', async t => {
  const { app, db } = createHarness();
  t.after(() => db.close());

  const { res } = await invoke(app, 'GET', '/api/billing/catalog');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.paymentProviders, []);
});

test('provider webhooks verify and credit one order idempotently without a browser session', async t => {
  const providers = {
    testpay: {
      enabled: true,
      createOrder: () => ({
        providerOrderId: 'remote-webhook-order',
        checkout: { mode: 'redirect', url: 'https://pay.example.test/checkout/order-1' },
      }),
      verifyEvent: event => event,
    },
  };
  const { app, db, walletService, paymentService, sessionTokens } = createHarness({ providers });
  t.after(() => db.close());
  const order = paymentService.createOrder({
    ownerEmail: 'buyer@example.com', productSku: 'ec_starter_29', provider: 'testpay', idempotencyKey: 'webhook-order-1',
  });
  assert.deepEqual(order.checkout, { mode: 'redirect', url: 'https://pay.example.test/checkout/order-1' });

  const event = { eventId: 'event-1', providerOrderId: 'remote-webhook-order', merchantOrderId: order.id, status: 'paid' };
  const first = await invoke(app, 'POST', '/api/billing/webhooks/:provider', {
    params: { provider: 'testpay' }, body: event,
  });
  assert.equal(first.res.statusCode, 200);
  assert.equal(first.res.body.order.status, 'credited');
  const fetched = await invoke(app, 'GET', '/api/billing/orders/:id', {
    params: { id: order.id },
    headers: signedHeaders(sessionTokens, 'buyer@example.com'),
  });
  assert.deepEqual(fetched.res.body.order.checkout, {
    mode: 'redirect',
    url: 'https://pay.example.test/checkout/order-1',
  });
  assert.equal(walletService.getBalance('buyer@example.com', 'ec_points').availableUnits, 105000);

  const replay = await invoke(app, 'POST', '/api/billing/webhooks/:provider', {
    params: { provider: 'testpay' }, body: event,
  });
  assert.equal(replay.res.statusCode, 200);
  assert.equal(replay.res.body.order.status, 'credited');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger WHERE owner_email = ?').get('buyer@example.com').count, 1);
});

test('provider webhook verification receives the raw request context', async t => {
  let verificationContext;
  const providers = {
    testpay: {
      enabled: true,
      createOrder: () => ({ providerOrderId: 'raw-context-order' }),
      verifyEvent: (event, context) => {
        verificationContext = context;
        return event;
      },
    },
  };
  const { app, db, paymentService } = createHarness({ providers });
  t.after(() => db.close());
  const order = paymentService.createOrder({
    ownerEmail: 'context@example.com', productSku: 'ec_trial_990', provider: 'testpay', idempotencyKey: 'raw-context-order',
  });
  const { res } = await invoke(app, 'POST', '/api/billing/webhooks/:provider', {
    params: { provider: 'testpay' },
    headers: { 'x-provider-signature': 'signature-value' },
    rawBody: Buffer.from('{"event":"paid"}'),
    body: { eventId: 'raw-event', providerOrderId: order.providerOrderId, merchantOrderId: order.id, status: 'paid' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(verificationContext.rawBody.toString('utf8'), '{"event":"paid"}');
  assert.equal(verificationContext.headers['x-provider-signature'], 'signature-value');
});

test('billing routes await asynchronous payment adapters and map rejected promises', async t => {
  const providers = {
    testpay: {
      enabled: true,
      async createOrder(snapshot) {
        if (snapshot.ownerEmail === 'rejected@example.com') {
          const error = new Error('provider rejected order');
          error.code = 'PAYMENT_PROVIDER_ORDER_REJECTED';
          throw error;
        }
        return { providerOrderId: `async-route-${snapshot.id}` };
      },
      async verifyEvent(event) {
        return event;
      },
    },
  };
  const { app, db, sessionTokens } = createHarness({ providers });
  t.after(() => db.close());

  const created = await invoke(app, 'POST', '/api/billing/orders', {
    headers: signedHeaders(sessionTokens, 'async-route@example.com'),
    body: {
      productSku: 'ec_starter_29', provider: 'testpay',
      idempotencyKey: 'async-route-order',
    },
  });
  assert.equal(created.res.statusCode, 201);
  assert.match(created.res.body.order.providerOrderId, /^async-route-/);

  const credited = await invoke(app, 'POST', '/api/billing/webhooks/:provider', {
    params: { provider: 'testpay' },
    body: {
      eventId: 'async-route-event',
      providerOrderId: created.res.body.order.providerOrderId,
      merchantOrderId: created.res.body.order.id,
      status: 'paid',
    },
  });
  assert.equal(credited.res.statusCode, 200);
  assert.equal(credited.res.body.order.status, 'credited');

  const rejected = await invoke(app, 'POST', '/api/billing/orders', {
    headers: signedHeaders(sessionTokens, 'rejected@example.com'),
    body: {
      productSku: 'ec_starter_29', provider: 'testpay',
      idempotencyKey: 'async-route-rejected',
    },
  });
  assert.equal(rejected.res.statusCode, 422);
  assert.equal(rejected.res.body.code, 'PAYMENT_PROVIDER_ORDER_REJECTED');
});

test('billing routes identify temporary payment gateway failures as retryable', async t => {
  const providers = {
    testpay: {
      enabled: true,
      async createOrder() {
        throw new Error('network timeout');
      },
    },
  };
  const { app, db, sessionTokens } = createHarness({ providers });
  t.after(() => db.close());

  const { res } = await invoke(app, 'POST', '/api/billing/orders', {
    headers: signedHeaders(sessionTokens, 'gateway@example.com'),
    body: {
      productSku: 'ec_starter_29', provider: 'testpay',
      idempotencyKey: 'gateway-unavailable-order',
    },
  });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'PAYMENT_PROVIDER_UNAVAILABLE');
  assert.equal(res.body.retryable, true);
  assert.equal(db.prepare('SELECT status FROM payment_orders WHERE idempotency_key = ?')
    .get('gateway-unavailable-order').status, 'pending');
});

test('legacy payment compatibility endpoints are disabled and grant nothing', async t => {
  const { app, db } = createHarness();
  t.after(() => db.close());

  const requests = [
    ['POST', '/api/create-payment', { body: { email: 'victim@example.com', sets: 999, amount: 0.01 } }],
    ['GET', '/api/payment/success', { query: { session_id: 'forged-session', email: 'victim@example.com', sets: 999 } }],
    ['POST', '/api/payment/webhook', { body: { type: 'checkout.session.completed', data: { object: { metadata: { email: 'victim@example.com', sets: '999' } } } } }],
  ];
  for (const [method, path, request] of requests) {
    const { res } = await invoke(app, method, path, request);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'PAYMENT_PROVIDER_DISABLED');
    assert.equal(res.body.legacyDisabled, true);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 0);
});

test('legacy credits require a signed owner and ignore spoofed email', async t => {
  const { app, db, walletService, sessionTokens } = createHarness();
  t.after(() => db.close());
  walletService.grant({
    ownerEmail: 'trusted@example.com', currency: 'content_sets', units: 4,
    idempotencyKey: 'trusted-legacy-balance',
  });
  walletService.grant({
    ownerEmail: 'attacker@example.com', currency: 'content_sets', units: 50,
    idempotencyKey: 'attacker-legacy-balance',
  });

  const anonymous = await invoke(app, 'GET', '/api/user/credits', {
    query: { email: 'attacker@example.com' },
  });
  assert.equal(anonymous.res.statusCode, 401);

  const signed = await invoke(app, 'GET', '/api/user/credits', {
    headers: signedHeaders(sessionTokens, 'trusted@example.com'),
    query: { email: 'attacker@example.com' },
    body: { email: 'attacker@example.com' },
  });
  assert.equal(signed.res.statusCode, 200);
  assert.deepEqual(signed.res.body, {
    credits: 4,
    availableUnits: 4,
    heldUnits: 0,
    unlimited: false,
  });
});
