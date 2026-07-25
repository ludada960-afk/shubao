import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaymentService } from '../server/billing/paymentService.mjs';
import { getProduct } from '../server/billing/catalog.mjs';

function createHarness(overrides = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = overrides.walletService ?? createWalletService(db);
  const calls = { createOrder: [], verifyEvent: [] };
  const providers = {
    stripe: {
      enabled: true,
      createOrder(orderSnapshot) {
        calls.createOrder.push(orderSnapshot);
        return { providerOrderId: `stripe_${orderSnapshot.id}` };
      },
      verifyEvent(event) {
        calls.verifyEvent.push(event);
        return event;
      },
    },
    alipay: { enabled: false },
    wechat: { enabled: false },
    other: {
      enabled: true,
      createOrder(orderSnapshot) {
        return { providerOrderId: `other_${orderSnapshot.id}` };
      },
      verifyEvent(event) {
        return event;
      },
    },
    ...overrides.providers,
  };
  return {
    db,
    calls,
    service: createPaymentService(db, walletService, providers),
  };
}

function createStripeOrder(service, extra = {}) {
  return service.createOrder({
    ownerEmail: 'buyer@example.com',
    productSku: 'ec_starter_29',
    provider: 'stripe',
    idempotencyKey: 'stripe-order',
    ...extra,
  });
}

test('creates only server-owned normalized product snapshots and returns defensive order copies', t => {
  const { db, calls, service } = createHarness();
  t.after(() => db.close());

  const order = service.createOrder({
    ownerEmail: ' Buyer@Example.COM ',
    productSku: 'ec_starter_29',
    provider: ' STRIPE ',
    idempotencyKey: ' order-key ',
    clientAmount: 1,
    clientGrantUnits: 999999,
  });

  assert.deepEqual(Object.keys(service).sort(), ['applyProviderEvent', 'createOrder', 'getOrder']);
  assert.equal(order.ownerEmail, 'buyer@example.com');
  assert.equal(order.provider, 'stripe');
  assert.equal(order.idempotencyKey, 'order-key');
  assert.equal(order.catalogVersion, 1);
  assert.equal(order.amountCny, 2900);
  assert.equal(order.grantUnits, 105000);
  assert.equal(order.providerOrderId, `stripe_${order.id}`);
  assert.equal(calls.createOrder.length, 1);
  assert.equal(calls.createOrder[0].status, 'pending');
  assert.equal(calls.createOrder[0].merchantOrderId, order.id);
  assert.equal(calls.createOrder[0].localOrderId, order.id);
  assert.equal(calls.createOrder[0].clientAmount, undefined);
  assert.equal(calls.createOrder[0].clientGrantUnits, undefined);

  order.status = 'tampered';
  assert.equal(service.getOrder(order.id).status, 'pending');
  assert.equal(service.getOrder('missing-order'), null);

  const repeated = service.createOrder({
    ownerEmail: 'buyer@example.com',
    productSku: 'ec_starter_29',
    provider: 'stripe',
    idempotencyKey: 'order-key',
  });
  assert.equal(repeated.id, order.id);
  assert.equal(calls.createOrder.length, 1);
  assert.throws(() => service.createOrder({
    ownerEmail: 'buyer@example.com',
    productSku: 'ec_growth_79',
    provider: 'stripe',
    idempotencyKey: 'order-key',
  }), error => error.code === 'PAYMENT_IDEMPOTENCY_CONFLICT');
});

test('rejects disabled payment adapters without writing orders', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());

  for (const provider of ['alipay', 'wechat']) {
    assert.throws(() => service.createOrder({
      ownerEmail: 'buyer@example.com',
      productSku: 'ec_starter_29',
      provider,
      idempotencyKey: `${provider}-key`,
    }), error => error.code === 'PAYMENT_PROVIDER_DISABLED');
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 0);
});

test('keeps a failed server snapshot for provider creation failures', t => {
  const { db, service } = createHarness({
    providers: {
      stripe: {
        enabled: true,
        createOrder() {
          const error = new Error('provider rejected order');
          error.code = 'PAYMENT_PROVIDER_ORDER_REJECTED';
          throw error;
        },
        verifyEvent(event) {
          return event;
        },
      },
    },
  });
  t.after(() => db.close());

  assert.throws(() => createStripeOrder(service), /provider rejected order/);
  assert.deepEqual(db.prepare(`
    SELECT status, amount_cny, grant_units, provider_order_id
    FROM payment_orders
  `).get(), {
    status: 'failed',
    amount_cny: 2900,
    grant_units: 105000,
    provider_order_id: '',
  });
});

test('retries a recoverable provider creation with the same merchant order id', t => {
  let attempts = 0;
  const snapshots = [];
  const { db, service } = createHarness({
    providers: {
      stripe: {
        enabled: true,
        createOrder(snapshot) {
          snapshots.push(snapshot);
          attempts += 1;
          if (attempts === 1) {
            const error = new Error('response lost after remote create');
            error.code = 'ECONNRESET';
            throw error;
          }
          return { providerOrderId: 'remote-recovered-order' };
        },
        verifyEvent(event) {
          return event;
        },
      },
    },
  });
  t.after(() => db.close());

  assert.throws(() => createStripeOrder(service, { idempotencyKey: 'recoverable-order' }), /response lost/);
  const pending = db.prepare(`
    SELECT id, status, provider_order_id FROM payment_orders WHERE idempotency_key = ?
  `).get('recoverable-order');
  assert.deepEqual({ status: pending.status, provider_order_id: pending.provider_order_id }, {
    status: 'pending',
    provider_order_id: '',
  });

  const recovered = createStripeOrder(service, { idempotencyKey: 'recoverable-order' });
  assert.equal(recovered.id, pending.id);
  assert.equal(recovered.providerOrderId, 'remote-recovered-order');
  assert.equal(snapshots.length, 2);
  assert.deepEqual(snapshots.map(snapshot => ({
    merchantOrderId: snapshot.merchantOrderId,
    localOrderId: snapshot.localOrderId,
  })), [
    { merchantOrderId: pending.id, localOrderId: pending.id },
    { merchantOrderId: pending.id, localOrderId: pending.id },
  ]);
});

test('settles a response-lost order from a verified webhook merchant order id', t => {
  const { db, service } = createHarness({
    providers: {
      stripe: {
        enabled: true,
        createOrder() {
          const error = new Error('provider response lost forever');
          error.code = 'ETIMEDOUT';
          throw error;
        },
        verifyEvent(event) {
          return event;
        },
      },
    },
  });
  t.after(() => db.close());

  assert.throws(() => createStripeOrder(service, { idempotencyKey: 'webhook-recovery' }), /response lost/);
  const pending = db.prepare(`
    SELECT id FROM payment_orders WHERE idempotency_key = ?
  `).get('webhook-recovery');
  const credited = service.applyProviderEvent('stripe', {
    eventId: 'evt-webhook-recovery',
    providerOrderId: 'remote-created-but-response-lost',
    merchantOrderId: pending.id,
    status: 'paid',
  });

  assert.equal(credited.id, pending.id);
  assert.equal(credited.providerOrderId, 'remote-created-but-response-lost');
  assert.equal(credited.status, 'credited');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'grant'").get().count, 1);
});

test('rejects invalid signatures before persisting provider events or granting', t => {
  const { db, service } = createHarness({
    providers: {
      stripe: {
        enabled: true,
        createOrder(orderSnapshot) {
          return { providerOrderId: `stripe_${orderSnapshot.id}` };
        },
        verifyEvent() {
          throw new Error('invalid signature');
        },
      },
    },
  });
  t.after(() => db.close());
  const order = createStripeOrder(service);

  assert.throws(() => service.applyProviderEvent('stripe', {
    eventId: 'invalid-signature',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  }), /invalid signature/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_provider_events').get().count, 0);
  assert.equal(service.getOrder(order.id).status, 'pending');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 0);
});

test('settles each verified paid event once with deterministic expiry and audit metadata', t => {
  const { db, calls, service } = createHarness();
  t.after(() => db.close());
  const order = service.createOrder({
    ownerEmail: 'buyer@example.com',
    productSku: 'xhs_entry_19',
    provider: 'stripe',
    idempotencyKey: 'expiring-order',
  });
  const event = {
    eventId: 'evt-paid-once',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  };

  const credited = service.applyProviderEvent('stripe', event);
  const duplicate = service.applyProviderEvent('stripe', event);
  assert.equal(credited.status, 'credited');
  assert.deepEqual(duplicate, credited);
  assert.equal(calls.verifyEvent.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_provider_events').get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'grant'").get().count, 1);
  assert.deepEqual(db.prepare(`
    SELECT source_type, source_id, granted_units, expires_at
    FROM credit_lots
  `).get(), {
    source_type: 'payment_order',
    source_id: order.id,
    granted_units: 3,
    expires_at: new Date(Date.parse(order.createdAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const ledger = db.prepare(`
    SELECT reference_type, reference_id, metadata FROM wallet_ledger WHERE event_type = 'grant'
  `).get();
  assert.deepEqual({
    ...ledger,
    metadata: JSON.parse(ledger.metadata).userMetadata,
  }, {
    reference_type: 'payment_order',
    reference_id: order.id,
    metadata: {
      productSku: 'xhs_entry_19',
      provider: 'stripe',
      providerOrderId: order.providerOrderId,
      paymentOrderId: order.id,
    },
  });
});

test('grants permanent catalog products without an expiry', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());
  const order = createStripeOrder(service);

  service.applyProviderEvent('stripe', {
    eventId: 'evt-permanent',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  });
  assert.equal(
    db.prepare('SELECT expires_at FROM credit_lots WHERE source_id = ?').get(order.id).expires_at,
    null,
  );
});

test('settlement uses the persisted billing catalog snapshot rather than mutable order fields', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());
  const order = service.createOrder({
    ownerEmail: 'snapshot@example.com',
    productSku: 'xhs_entry_19',
    provider: 'stripe',
    idempotencyKey: 'catalog-snapshot',
  });
  const snapshot = JSON.parse(db.prepare(`
    SELECT payload FROM billing_catalog WHERE sku = ? AND version = 1
  `).get('xhs_entry_19').payload);
  assert.deepEqual(snapshot, {
    sku: 'xhs_entry_19',
    priceFen: 1900,
    currency: 'content_sets',
    grantUnits: 3,
    validityDays: 30,
    regenPerWork: 5,
  });
  db.prepare(`
    UPDATE billing_catalog SET sku = 'retired_xhs_entry_19' WHERE sku = ? AND version = 1
  `).run('xhs_entry_19');
  db.prepare(`
    UPDATE payment_orders
    SET product_sku = 'retired_xhs_entry_19', amount_cny = 1, grant_currency = 'tampered', grant_units = 999999
    WHERE id = ?
  `).run(order.id);
  assert.throws(() => getProduct('retired_xhs_entry_19'), /Unknown product SKU/);

  service.applyProviderEvent('stripe', {
    eventId: 'evt-catalog-snapshot',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  });
  assert.deepEqual(db.prepare(`
    SELECT currency, granted_units, expires_at FROM credit_lots WHERE source_id = ?
  `).get(order.id), {
    currency: 'content_sets',
    granted_units: 3,
    expires_at: new Date(Date.parse(order.createdAt) + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

test('prevents duplicate provider order ids during creation and webhook binding', t => {
  let sequence = 0;
  const { db, service } = createHarness({
    providers: {
      stripe: {
        enabled: true,
        createOrder() {
          sequence += 1;
          return { providerOrderId: sequence === 1 ? 'shared-remote-order' : `remote-${sequence}` };
        },
        verifyEvent(event) {
          return event;
        },
      },
    },
  });
  t.after(() => db.close());
  const first = createStripeOrder(service, {
    ownerEmail: 'first@example.com',
    idempotencyKey: 'first-remote-order',
  });
  sequence = 0;
  assert.throws(() => createStripeOrder(service, {
    ownerEmail: 'second@example.com',
    idempotencyKey: 'second-remote-order',
  }), error => error.code === 'PAYMENT_PROVIDER_ORDER_CONFLICT');
  const second = db.prepare(`
    SELECT id, status, provider_order_id FROM payment_orders WHERE idempotency_key = ?
  `).get('second-remote-order');
  assert.deepEqual({ status: second.status, provider_order_id: second.provider_order_id }, {
    status: 'pending', provider_order_id: '',
  });

  const third = createStripeOrder(service, {
    ownerEmail: 'third@example.com',
    idempotencyKey: 'third-remote-order',
  });
  assert.throws(() => service.applyProviderEvent('stripe', {
    eventId: 'evt-binding-conflict',
    providerOrderId: first.providerOrderId,
    merchantOrderId: third.id,
    status: 'paid',
  }), error => error.code === 'PAYMENT_PROVIDER_ORDER_CONFLICT');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_provider_events').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 0);
  assert.equal(service.getOrder(first.id).status, 'pending');
  assert.equal(service.getOrder(third.id).status, 'pending');
});

test('two connections return the matching order or a coded conflict for the same idempotency key', t => {
  const directory = mkdtempSync(join(tmpdir(), 'payment-order-idempotency-'));
  const filename = join(directory, 'billing.db');
  const dbOne = new Database(filename);
  const dbTwo = new Database(filename);
  ensureBillingSchema(dbOne);
  ensureBillingSchema(dbTwo);
  const providers = {
    stripe: {
      enabled: true,
      createOrder(snapshot) {
        return { providerOrderId: `cross-${snapshot.id}` };
      },
      verifyEvent(event) {
        return event;
      },
    },
  };
  const serviceOne = createPaymentService(dbOne, createWalletService(dbOne), providers);
  const serviceTwo = createPaymentService(dbTwo, createWalletService(dbTwo), providers);
  t.after(() => {
    dbOne.close();
    dbTwo.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const first = serviceOne.createOrder({
    ownerEmail: 'cross@example.com', productSku: 'ec_starter_29', provider: 'stripe', idempotencyKey: 'cross-key',
  });
  assert.equal(serviceTwo.createOrder({
    ownerEmail: 'cross@example.com', productSku: 'ec_starter_29', provider: 'stripe', idempotencyKey: 'cross-key',
  }).id, first.id);
  assert.throws(() => serviceTwo.createOrder({
    ownerEmail: 'other@example.com', productSku: 'ec_starter_29', provider: 'stripe', idempotencyKey: 'cross-key',
  }), error => error.code === 'PAYMENT_IDEMPOTENCY_CONFLICT');
});

test('rejects non-paid, unknown, provider-mismatched, and illegal-state events without recording them', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());
  const order = createStripeOrder(service);
  const failures = [
    ['not-paid', 'stripe', { eventId: 'evt-not-paid', providerOrderId: order.providerOrderId, status: 'pending' }],
    ['unknown', 'stripe', { eventId: 'evt-unknown', providerOrderId: 'unknown-provider-order', status: 'paid' }],
    ['mismatch', 'other', { eventId: 'evt-mismatch', providerOrderId: order.providerOrderId, status: 'paid' }],
  ];
  for (const [, provider, event] of failures) {
    assert.throws(() => service.applyProviderEvent(provider, event));
  }
  db.prepare("UPDATE payment_orders SET status = 'failed' WHERE id = ?").run(order.id);
  assert.throws(() => service.applyProviderEvent('stripe', {
    eventId: 'evt-illegal-state',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  }));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_provider_events').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 0);
});

test('rolls back the provider event and order status if wallet persistence fails', t => {
  const { db, service } = createHarness();
  t.after(() => db.close());
  const order = createStripeOrder(service);
  db.exec(`
    CREATE TRIGGER reject_payment_grant
    BEFORE INSERT ON wallet_ledger
    WHEN NEW.reference_type = 'payment_order'
    BEGIN
      SELECT RAISE(ABORT, 'wallet grant rejected');
    END;
  `);

  assert.throws(() => service.applyProviderEvent('stripe', {
    eventId: 'evt-wallet-failure',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  }), /wallet grant rejected/);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM processed_provider_events').get().count, 0);
  assert.equal(service.getOrder(order.id).status, 'pending');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM credit_lots').get().count, 0);
});
