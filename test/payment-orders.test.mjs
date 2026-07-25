import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaymentService } from '../server/billing/paymentService.mjs';

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
          throw new Error('provider offline');
        },
        verifyEvent(event) {
          return event;
        },
      },
    },
  });
  t.after(() => db.close());

  assert.throws(() => createStripeOrder(service), /provider offline/);
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
