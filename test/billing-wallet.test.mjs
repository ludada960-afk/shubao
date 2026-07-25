import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';

function createTestService(isUnlimited = () => false) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  return {
    db,
    service: createWalletService(db, { isUnlimited }),
  };
}

test('a hold prevents overspending and partial failure releases units atomically', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'a@b.com',
    currency: 'ec_points',
    units: 2000,
    idempotencyKey: 'grant-1',
  });
  const hold = service.createHold({
    ownerEmail: 'a@b.com',
    currency: 'ec_points',
    quoteId: 'q1',
    idempotencyKey: 'hold-1',
    items: [
      { key: 'one', sku: 'ec_image_2k', units: 1000 },
      { key: 'two', sku: 'ec_image_2k', units: 1000 },
    ],
  });

  assert.deepEqual(service.getBalance('a@b.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 2000,
    unlimited: false,
  });
  assert.throws(() => service.createHold({
    ownerEmail: 'a@b.com',
    currency: 'ec_points',
    quoteId: 'q2',
    idempotencyKey: 'hold-2',
    items: [{ key: 'x', sku: 'ec_image_2k', units: 1000 }],
  }), /insufficient/i);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 1);

  service.settleItem(hold.id, 'one', {
    referenceId: 'asset-1',
    providerCostCny: 0.038,
  });
  service.releaseItem(hold.id, 'two', { reason: 'provider_failed' });

  assert.deepEqual(service.getBalance('a@b.com', 'ec_points'), {
    availableUnits: 1000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.deepEqual(
    db.prepare('SELECT status, settled_units, released_units FROM billing_holds WHERE id = ?').get(hold.id),
    { status: 'closed', settled_units: 1000, released_units: 1000 },
  );
  assert.deepEqual(
    db.prepare(`
      SELECT event_type, delta_available, delta_held, balance_available,
             balance_held, reference_type, reference_id, idempotency_key
      FROM wallet_ledger
      ORDER BY rowid ASC
    `).all(),
    [
      {
        event_type: 'grant',
        delta_available: 2000,
        delta_held: 0,
        balance_available: 2000,
        balance_held: 0,
        reference_type: 'grant',
        reference_id: 'grant-1',
        idempotency_key: 'grant-1',
      },
      {
        event_type: 'hold',
        delta_available: -2000,
        delta_held: 2000,
        balance_available: 0,
        balance_held: 2000,
        reference_type: 'quote',
        reference_id: 'q1',
        idempotency_key: 'hold-1',
      },
      {
        event_type: 'settle',
        delta_available: 0,
        delta_held: -1000,
        balance_available: 0,
        balance_held: 1000,
        reference_type: 'asset',
        reference_id: 'asset-1',
        idempotency_key: `settle:${hold.id}:one`,
      },
      {
        event_type: 'release',
        delta_available: 1000,
        delta_held: -1000,
        balance_available: 1000,
        balance_held: 0,
        reference_type: 'billing_hold_item',
        reference_id: hold.items.find(item => item.key === 'two').id,
        idempotency_key: `release:${hold.id}:two`,
      },
    ],
  );
  assert.deepEqual(
    db.prepare('SELECT charged_units, shadow_units, provider_cost_cny FROM usage_events').get(),
    { charged_units: 1000, shadow_units: 0, provider_cost_cny: 0.038 },
  );
});

test('repeated idempotency returns original results without duplicate mutations', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  const grantInput = {
    ownerEmail: 'repeat@example.com',
    currency: 'ec_points',
    units: 2000,
    idempotencyKey: 'grant-repeat',
    metadata: { channel: 'admin' },
  };
  const firstGrant = service.grant(grantInput);
  assert.deepEqual(service.grant(grantInput), firstGrant);
  assert.throws(
    () => service.grant({ ...grantInput, units: 3000 }),
    /idempotency.*conflict/i,
  );

  const holdInput = {
    ownerEmail: 'repeat@example.com',
    currency: 'ec_points',
    quoteId: 'quote-repeat',
    idempotencyKey: 'hold-repeat',
    items: [
      { key: 'one', sku: 'ec_image_2k', units: 1000 },
      { key: 'two', sku: 'ec_image_2k', units: 1000 },
    ],
  };
  const firstHold = service.createHold(holdInput);
  assert.deepEqual(service.createHold(holdInput), firstHold);
  assert.throws(
    () => service.createHold({ ...holdInput, quoteId: 'different-quote' }),
    /idempotency.*conflict/i,
  );

  const firstSettlement = service.settleItem(firstHold.id, 'one', {
    referenceId: 'asset-repeat',
    providerCostCny: 0.038,
  });
  assert.deepEqual(service.settleItem(firstHold.id, 'one', {
    referenceId: 'asset-repeat',
    providerCostCny: 0.038,
  }), firstSettlement);
  assert.throws(() => service.settleItem(firstHold.id, 'one', {
    referenceId: 'asset-repeat',
    providerCostCny: 0.04,
  }), /idempotency.*conflict/i);

  const firstRelease = service.releaseItem(firstHold.id, 'two', {
    reason: 'provider_failed',
  });
  assert.deepEqual(service.releaseItem(firstHold.id, 'two', {
    reason: 'provider_failed',
  }), firstRelease);
  assert.throws(() => service.releaseItem(firstHold.id, 'two', {
    reason: 'user_cancelled',
  }), /idempotency.*conflict/i);

  assert.deepEqual(service.getBalance('repeat@example.com', 'ec_points'), {
    availableUnits: 1000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM credit_lots').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_hold_items').get().count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 4);
});

test('opposite terminal transitions fail without altering balances or usage', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'terminal@example.com',
    currency: 'ec_points',
    units: 2000,
    idempotencyKey: 'terminal-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'terminal@example.com',
    currency: 'ec_points',
    quoteId: 'terminal-quote',
    idempotencyKey: 'terminal-hold',
    items: [
      { key: 'settled', sku: 'ec_image_2k', units: 1000 },
      { key: 'released', sku: 'ec_image_2k', units: 1000 },
    ],
  });

  service.settleItem(hold.id, 'settled', {
    referenceId: 'asset-terminal',
    providerCostCny: 0.038,
  });
  const afterSettlement = service.getBalance('terminal@example.com', 'ec_points');
  assert.throws(
    () => service.releaseItem(hold.id, 'settled', { reason: 'late_release' }),
    /already settled|cannot release/i,
  );
  assert.deepEqual(service.getBalance('terminal@example.com', 'ec_points'), afterSettlement);

  service.releaseItem(hold.id, 'released', { reason: 'provider_failed' });
  const afterRelease = service.getBalance('terminal@example.com', 'ec_points');
  assert.throws(() => service.settleItem(hold.id, 'released', {
    referenceId: 'asset-too-late',
    providerCostCny: 0.038,
  }), /already released|cannot settle/i);
  assert.deepEqual(service.getBalance('terminal@example.com', 'ec_points'), afterRelease);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 1);
  assert.equal(db.prepare('SELECT SUM(remaining_units) AS units FROM credit_lots').get().units, 1000);
});

test('paid settlement consumes credit lots in FEFO order without negative lots', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'fefo@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'permanent-grant',
    sourceId: 'permanent',
  });
  service.grant({
    ownerEmail: 'fefo@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'later-expiry-grant',
    sourceId: 'later-expiry',
    expiresAt: '2026-09-01T00:00:00.000Z',
  });
  service.grant({
    ownerEmail: 'fefo@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'earlier-expiry-grant',
    sourceId: 'earlier-expiry',
    expiresAt: '2026-08-01T00:00:00.000Z',
  });
  const hold = service.createHold({
    ownerEmail: 'fefo@example.com',
    currency: 'ec_points',
    quoteId: 'fefo-quote',
    idempotencyKey: 'fefo-hold',
    items: [{ key: 'image', sku: 'ec_image_2k', units: 1500 }],
  });

  service.settleItem(hold.id, 'image', {
    referenceId: 'asset-fefo',
    providerCostCny: 0.038,
  });

  const lots = Object.fromEntries(db.prepare(
    'SELECT source_id, remaining_units FROM credit_lots ORDER BY source_id',
  ).all().map(row => [row.source_id, row.remaining_units]));
  assert.deepEqual(lots, {
    'earlier-expiry': 0,
    'later-expiry': 500,
    permanent: 1000,
  });
  assert.equal(db.prepare('SELECT MIN(remaining_units) AS units FROM credit_lots').get().units, 0);
});

test('settlement rollback restores the wallet, lot, hold, and item when usage persistence fails', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'rollback@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'rollback-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'rollback@example.com',
    currency: 'ec_points',
    quoteId: 'rollback-quote',
    idempotencyKey: 'rollback-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });
  db.exec(`
    CREATE TRIGGER reject_usage_event
    BEFORE INSERT ON usage_events
    BEGIN
      SELECT RAISE(ABORT, 'usage persistence failed');
    END;
  `);

  assert.throws(() => service.settleItem(hold.id, 'one', {
    referenceId: 'asset-rollback',
    providerCostCny: 0.038,
  }), /usage persistence failed/i);

  assert.deepEqual(service.getBalance('rollback@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 1000,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 1000);
  assert.equal(
    db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ? AND item_key = ?').get(hold.id, 'one').status,
    'pending',
  );
  assert.deepEqual(
    db.prepare('SELECT status, settled_units, released_units FROM billing_holds WHERE id = ?').get(hold.id),
    { status: 'pending', settled_units: 0, released_units: 0 },
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'settle'").get().count, 0);
});

test('releaseRemainder releases every pending item once and closes the hold', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'remainder@example.com',
    currency: 'ec_points',
    units: 3000,
    idempotencyKey: 'remainder-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'remainder@example.com',
    currency: 'ec_points',
    quoteId: 'remainder-quote',
    idempotencyKey: 'remainder-hold',
    items: [
      { key: 'done', sku: 'ec_image_2k', units: 1000 },
      { key: 'failed', sku: 'ec_image_2k', units: 1000 },
      { key: 'cancelled', sku: 'ec_image_2k', units: 1000 },
    ],
  });
  service.settleItem(hold.id, 'done', {
    referenceId: 'asset-done',
    providerCostCny: 0.038,
  });

  const input = {
    reason: 'job_finished',
    idempotencyKey: 'release-remainder',
  };
  const result = service.releaseRemainder(hold.id, input);
  assert.deepEqual(service.releaseRemainder(hold.id, input), result);
  assert.throws(
    () => service.releaseRemainder(hold.id, { ...input, reason: 'different_reason' }),
    /idempotency.*conflict/i,
  );

  assert.deepEqual(result.releasedItemKeys, ['failed', 'cancelled']);
  assert.equal(result.releasedUnits, 2000);
  assert.deepEqual(service.getBalance('remainder@example.com', 'ec_points'), {
    availableUnits: 2000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.deepEqual(
    db.prepare('SELECT status, settled_units, released_units FROM billing_holds WHERE id = ?').get(hold.id),
    { status: 'closed', settled_units: 1000, released_units: 2000 },
  );
  assert.deepEqual(
    db.prepare('SELECT item_key, status FROM billing_hold_items WHERE hold_id = ? ORDER BY rowid').all(hold.id),
    [
      { item_key: 'done', status: 'settled' },
      { item_key: 'failed', status: 'released' },
      { item_key: 'cancelled', status: 'released' },
    ],
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'release_remainder'").get().count,
    1,
  );
});

test('unlimited accounts keep zero balances and record shadow usage with real cost', t => {
  const unlimitedEmail = '867550189@qq.com';
  const { db, service } = createTestService(ownerEmail => ownerEmail === unlimitedEmail);
  t.after(() => db.close());

  const hold = service.createHold({
    ownerEmail: unlimitedEmail,
    currency: 'ec_points',
    quoteId: 'unlimited-quote',
    idempotencyKey: 'unlimited-hold',
    items: [
      { key: 'one', sku: 'ec_image_2k', units: 1000 },
      { key: 'two', sku: 'ec_image_2k', units: 1000 },
    ],
  });
  assert.deepEqual(service.getBalance(unlimitedEmail, 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: true,
  });

  service.settleItem(hold.id, 'one', {
    referenceId: 'asset-shadow',
    providerCostCny: 0.038,
    metadata: { model: 'gpt-image-2' },
  });
  service.releaseRemainder(hold.id, {
    reason: 'partial_failure',
    idempotencyKey: 'unlimited-release-remainder',
  });

  assert.deepEqual(service.getBalance(unlimitedEmail, 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: true,
  });
  assert.deepEqual(
    db.prepare('SELECT charged_units, shadow_units, provider_cost_cny, reference_id FROM usage_events').get(),
    {
      charged_units: 0,
      shadow_units: 1000,
      provider_cost_cny: 0.038,
      reference_id: 'asset-shadow',
    },
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM credit_lots').get().count, 0);
  for (const row of db.prepare(
    'SELECT delta_available, delta_held, balance_available, balance_held FROM wallet_ledger',
  ).all()) {
    assert.deepEqual(row, {
      delta_available: 0,
      delta_held: 0,
      balance_available: 0,
      balance_held: 0,
    });
  }
});

test('mutations reject empty identifiers and unsafe unit values before writing', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  for (const units of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => service.grant({
      ownerEmail: 'validation@example.com',
      currency: 'ec_points',
      units,
      idempotencyKey: `bad-units-${String(units)}`,
    }), /units.*positive safe integer/i);
  }
  assert.throws(() => service.grant({
    ownerEmail: ' ',
    currency: 'ec_points',
    units: 1,
    idempotencyKey: 'bad-owner',
  }), /ownerEmail.*non-empty/i);
  assert.throws(() => service.grant({
    ownerEmail: 'validation@example.com',
    currency: '',
    units: 1,
    idempotencyKey: 'bad-currency',
  }), /currency.*non-empty/i);
  assert.throws(() => service.grant({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    units: 1,
    idempotencyKey: ' ',
  }), /idempotencyKey.*non-empty/i);

  service.grant({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    units: 10,
    idempotencyKey: 'valid-grant',
  });
  assert.throws(() => service.createHold({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    quoteId: '',
    idempotencyKey: 'bad-quote-hold',
    items: [{ key: 'one', sku: 'sku', units: 1 }],
  }), /quoteId.*non-empty/i);
  assert.throws(() => service.createHold({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    quoteId: 'quote',
    idempotencyKey: 'bad-item-hold',
    items: [{ key: '', sku: 'sku', units: 1 }],
  }), /item key.*non-empty/i);
  assert.throws(() => service.createHold({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    quoteId: 'quote',
    idempotencyKey: 'bad-sku-hold',
    items: [{ key: 'one', sku: ' ', units: 1 }],
  }), /sku.*non-empty/i);
  assert.throws(() => service.createHold({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    quoteId: 'quote',
    idempotencyKey: 'duplicate-item-hold',
    items: [
      { key: 'one', sku: 'sku', units: 1 },
      { key: 'one', sku: 'sku', units: 1 },
    ],
  }), /duplicate.*item key/i);
  assert.throws(() => service.createHold({
    ownerEmail: 'validation@example.com',
    currency: 'ec_points',
    quoteId: 'quote',
    idempotencyKey: 'overflow-hold',
    items: [
      { key: 'one', sku: 'sku', units: Number.MAX_SAFE_INTEGER },
      { key: 'two', sku: 'sku', units: 1 },
    ],
  }), /total units.*safe integer/i);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 1);
});

test('invalid provider costs and empty settlement identifiers leave the item pending', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'cost@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'cost-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'cost@example.com',
    currency: 'ec_points',
    quoteId: 'cost-quote',
    idempotencyKey: 'cost-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });

  for (const providerCostCny of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => service.settleItem(hold.id, 'one', {
      referenceId: 'asset-cost',
      providerCostCny,
    }), /providerCostCny.*finite.*non-negative/i);
  }
  assert.throws(() => service.settleItem('', 'one', {
    referenceId: 'asset-cost',
    providerCostCny: 0,
  }), /holdId.*non-empty/i);
  assert.throws(() => service.settleItem(hold.id, '', {
    referenceId: 'asset-cost',
    providerCostCny: 0,
  }), /itemKey.*non-empty/i);
  assert.throws(() => service.settleItem(hold.id, 'one', {
    referenceId: '',
    providerCostCny: 0,
  }), /referenceId.*non-empty/i);
  assert.throws(() => service.settleItem(hold.id, 'one', {
    referenceId: 'asset-cost',
    providerCostCny: 0,
    idempotencyKey: '',
  }), /idempotencyKey.*non-empty/i);

  assert.equal(
    db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ? AND item_key = ?').get(hold.id, 'one').status,
    'pending',
  );
  assert.deepEqual(service.getBalance('cost@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 1000,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 0);
});

test('getBalance has an exact shape and listLedger is deterministic with safe metadata parsing', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  assert.deepEqual(service.getBalance('ledger@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: false,
  });
  service.grant({
    ownerEmail: 'ledger@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'ledger-grant-one',
    metadata: { campaign: 'summer' },
  });
  service.grant({
    ownerEmail: 'ledger@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'ledger-grant-two',
    metadata: { campaign: 'winter' },
  });
  db.prepare(`
    INSERT INTO wallet_ledger (
      id, owner_email, currency, event_type, delta_available, delta_held,
      balance_available, balance_held, reference_type, reference_id,
      idempotency_key, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'malformed-ledger',
    'ledger@example.com',
    'ec_points',
    'manual',
    0,
    0,
    2000,
    0,
    'manual',
    'malformed-reference',
    'malformed-idempotency',
    '{not-json',
    '9999-12-31 23:59:59',
  );
  db.prepare(`
    INSERT INTO wallet_ledger (
      id, owner_email, currency, event_type, delta_available, delta_held,
      balance_available, balance_held, reference_type, reference_id,
      idempotency_key, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'legacy-metadata-ledger',
    'ledger@example.com',
    'ec_points',
    'manual',
    0,
    0,
    2000,
    0,
    'manual',
    'legacy-reference',
    'legacy-idempotency',
    JSON.stringify({ userMetadata: { nested: true }, business: 'legacy' }),
    '9998-12-31 23:59:59',
  );

  const ledger = service.listLedger('ledger@example.com', 'ec_points');
  const expectedIds = db.prepare(`
    SELECT id FROM wallet_ledger
    WHERE owner_email = ? AND currency = ?
    ORDER BY created_at DESC, id DESC
  `).all('ledger@example.com', 'ec_points').map(row => row.id);

  assert.deepEqual(ledger.map(row => row.id), expectedIds);
  assert.deepEqual(ledger[0].metadata, {});
  assert.deepEqual(
    ledger.find(row => row.id === 'legacy-metadata-ledger').metadata,
    { userMetadata: { nested: true }, business: 'legacy' },
  );
  assert.deepEqual(
    ledger.find(row => row.idempotencyKey === 'ledger-grant-one').metadata,
    { campaign: 'summer' },
  );
  assert.deepEqual(Object.keys(service.getBalance('ledger@example.com', 'ec_points')).sort(), [
    'availableUnits',
    'heldUnits',
    'unlimited',
  ]);
});
