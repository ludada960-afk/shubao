import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('an alternate idempotency key cannot alias an existing terminal transition', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'terminal-alias@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'terminal-alias-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'terminal-alias@example.com',
    currency: 'ec_points',
    quoteId: 'terminal-alias-quote',
    idempotencyKey: 'terminal-alias-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });
  service.settleItem(hold.id, 'one', {
    referenceId: 'asset-terminal-alias',
    providerCostCny: 0.038,
    idempotencyKey: 'terminal-original-key',
  });

  assert.throws(() => service.settleItem(hold.id, 'one', {
    referenceId: 'asset-terminal-alias',
    providerCostCny: 0.038,
    idempotencyKey: 'terminal-alternate-key',
  }), error => {
    assert.equal(error.code, 'BILLING_IDEMPOTENCY_CONFLICT');
    return true;
  });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger WHERE idempotency_key = ?')
      .get('terminal-alternate-key').count,
    0,
  );

  assert.doesNotThrow(() => service.grant({
    ownerEmail: 'terminal-alias@example.com',
    currency: 'ec_points',
    units: 1,
    idempotencyKey: 'terminal-alternate-key',
  }));
  assert.equal(
    db.prepare('SELECT event_type FROM wallet_ledger WHERE idempotency_key = ?')
      .get('terminal-alternate-key').event_type,
    'grant',
  );
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
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
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

test('hold rollback restores reserved lots and wallet balances when ledger persistence fails', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'hold-rollback@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'hold-rollback-grant',
  });
  db.exec(`
    CREATE TRIGGER reject_hold_ledger
    BEFORE INSERT ON wallet_ledger
    WHEN NEW.event_type = 'hold'
    BEGIN
      SELECT RAISE(ABORT, 'hold ledger persistence failed');
    END;
  `);

  assert.throws(() => service.createHold({
    ownerEmail: 'hold-rollback@example.com',
    currency: 'ec_points',
    quoteId: 'hold-rollback-quote',
    idempotencyKey: 'hold-rollback-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  }), /hold ledger persistence failed/i);

  assert.deepEqual(service.getBalance('hold-rollback@example.com', 'ec_points'), {
    availableUnits: 1000,
    heldUnits: 0,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 1000);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_hold_items').get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'hold'").get().count, 0);
});

test('grant rejects an already-expired credit lot without mutating billing state', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  assert.throws(() => service.grant({
    ownerEmail: 'expired-grant@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'expired-grant',
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  }), /expiresAt.*future/i);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallets').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM credit_lots').get().count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger').get().count, 0);
});

test('expired unreserved lots are hidden from balance and reconciled before a paid hold', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'expired-unreserved@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'expiring-unreserved-grant',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  db.prepare('UPDATE credit_lots SET expires_at = ?').run(
    new Date(Date.now() - 60_000).toISOString(),
  );

  assert.deepEqual(service.getBalance('expired-unreserved@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: false,
  });
  assert.throws(() => service.createHold({
    ownerEmail: 'expired-unreserved@example.com',
    currency: 'ec_points',
    quoteId: 'expired-unreserved-quote',
    idempotencyKey: 'expired-unreserved-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  }), /insufficient/i);

  assert.deepEqual(
    db.prepare('SELECT available_units, held_units FROM wallets').get(),
    { available_units: 0, held_units: 0 },
  );
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 0);
  assert.deepEqual(
    db.prepare(`
      SELECT event_type, delta_available, delta_held, balance_available, balance_held
      FROM wallet_ledger
      WHERE event_type = 'expire'
    `).get(),
    {
      event_type: 'expire',
      delta_available: -1000,
      delta_held: 0,
      balance_available: 0,
      balance_held: 0,
    },
  );
});

test('SQLite-style future expiry timestamps remain spendable and reservable', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'sqlite-expiry@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'sqlite-expiry-grant',
  });
  const futureSqlTimestamp = new Date(Date.now() + 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  db.prepare('UPDATE credit_lots SET expires_at = ?').run(futureSqlTimestamp);

  assert.deepEqual(service.getBalance('sqlite-expiry@example.com', 'ec_points'), {
    availableUnits: 1000,
    heldUnits: 0,
    unlimited: false,
  });
  const hold = service.createHold({
    ownerEmail: 'sqlite-expiry@example.com',
    currency: 'ec_points',
    quoteId: 'sqlite-expiry-quote',
    idempotencyKey: 'sqlite-expiry-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });
  assert.ok(hold.id);
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
});

test('a paid hold reserves FEFO lots and can settle after its allocation expires', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'settle-after-expiry@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'settle-after-expiry-grant',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const hold = service.createHold({
    ownerEmail: 'settle-after-expiry@example.com',
    currency: 'ec_points',
    quoteId: 'settle-after-expiry-quote',
    idempotencyKey: 'settle-after-expiry-hold',
    metadata: { request: 'settle-later' },
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });

  assert.deepEqual(hold.metadata, { request: 'settle-later' });
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
  const storedHoldMetadata = JSON.parse(
    db.prepare('SELECT metadata FROM billing_holds WHERE id = ?').get(hold.id).metadata,
  );
  assert.equal(storedHoldMetadata._walletService.accountingMode, 'paid');
  assert.deepEqual(storedHoldMetadata._walletService.allocations.map(item => ({
    itemKey: item.itemKey,
    units: item.lots.reduce((sum, lot) => sum + lot.units, 0),
  })), [{ itemKey: 'one', units: 1000 }]);

  db.prepare('UPDATE credit_lots SET expires_at = ?').run(
    new Date(Date.now() - 60_000).toISOString(),
  );
  service.settleItem(hold.id, 'one', {
    referenceId: 'asset-settle-after-expiry',
    providerCostCny: 0.038,
  });

  assert.deepEqual(service.getBalance('settle-after-expiry@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
  assert.deepEqual(
    db.prepare('SELECT charged_units, shadow_units FROM usage_events').get(),
    { charged_units: 1000, shadow_units: 0 },
  );
});

test('release after allocation expiry reduces held units without resurrecting spendable units', t => {
  const { db, service } = createTestService();
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'release-after-expiry@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'release-after-expiry-grant',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const hold = service.createHold({
    ownerEmail: 'release-after-expiry@example.com',
    currency: 'ec_points',
    quoteId: 'release-after-expiry-quote',
    idempotencyKey: 'release-after-expiry-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });
  db.prepare('UPDATE credit_lots SET expires_at = ?').run(
    new Date(Date.now() - 60_000).toISOString(),
  );

  const result = service.releaseItem(hold.id, 'one', { reason: 'provider_failed' });

  assert.equal(result.restoredUnits, 0);
  assert.equal(result.expiredUnits, 1000);
  assert.deepEqual(service.getBalance('release-after-expiry@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: false,
  });
  assert.equal(db.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
  assert.deepEqual(
    db.prepare("SELECT delta_available, delta_held FROM wallet_ledger WHERE event_type = 'release'").get(),
    { delta_available: 0, delta_held: -1000 },
  );
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

test('paid hold transitions keep paid accounting after entitlement toggles to unlimited', t => {
  let unlimited = false;
  const { db, service } = createTestService(() => unlimited);
  t.after(() => db.close());

  service.grant({
    ownerEmail: 'paid-drift@example.com',
    currency: 'ec_points',
    units: 3000,
    idempotencyKey: 'paid-drift-grant',
  });
  const hold = service.createHold({
    ownerEmail: 'paid-drift@example.com',
    currency: 'ec_points',
    quoteId: 'paid-drift-quote',
    idempotencyKey: 'paid-drift-hold',
    metadata: { visible: 'paid' },
    items: [
      { key: 'settled', sku: 'ec_image_2k', units: 1000 },
      { key: 'released', sku: 'ec_image_2k', units: 1000 },
      { key: 'remainder', sku: 'ec_image_2k', units: 1000 },
    ],
  });
  assert.deepEqual(hold.metadata, { visible: 'paid' });

  unlimited = true;
  service.settleItem(hold.id, 'settled', {
    referenceId: 'asset-paid-drift',
    providerCostCny: 0.038,
  });
  service.releaseItem(hold.id, 'released', { reason: 'provider_failed' });
  service.releaseRemainder(hold.id, {
    reason: 'job_finished',
    idempotencyKey: 'paid-drift-remainder',
  });

  assert.deepEqual(
    db.prepare('SELECT available_units, held_units FROM wallets').get(),
    { available_units: 2000, held_units: 0 },
  );
  assert.deepEqual(
    db.prepare('SELECT charged_units, shadow_units FROM usage_events').get(),
    { charged_units: 1000, shadow_units: 0 },
  );
  unlimited = false;
  assert.deepEqual(service.getBalance('paid-drift@example.com', 'ec_points'), {
    availableUnits: 2000,
    heldUnits: 0,
    unlimited: false,
  });
});

test('unlimited hold transitions keep shadow accounting after entitlement toggles to paid', t => {
  let unlimited = true;
  const { db, service } = createTestService(() => unlimited);
  t.after(() => db.close());

  const hold = service.createHold({
    ownerEmail: 'unlimited-drift@example.com',
    currency: 'ec_points',
    quoteId: 'unlimited-drift-quote',
    idempotencyKey: 'unlimited-drift-hold',
    metadata: { visible: 'unlimited' },
    items: [
      { key: 'settled', sku: 'ec_image_2k', units: 1000 },
      { key: 'released', sku: 'ec_image_2k', units: 1000 },
      { key: 'remainder', sku: 'ec_image_2k', units: 1000 },
    ],
  });
  assert.deepEqual(hold.metadata, { visible: 'unlimited' });
  const storedHoldMetadata = JSON.parse(
    db.prepare('SELECT metadata FROM billing_holds WHERE id = ?').get(hold.id).metadata,
  );
  assert.equal(storedHoldMetadata._walletService.accountingMode, 'unlimited');

  unlimited = false;
  service.settleItem(hold.id, 'settled', {
    referenceId: 'asset-unlimited-drift',
    providerCostCny: 0.038,
  });
  service.releaseItem(hold.id, 'released', { reason: 'provider_failed' });
  service.releaseRemainder(hold.id, {
    reason: 'job_finished',
    idempotencyKey: 'unlimited-drift-remainder',
  });

  assert.deepEqual(
    db.prepare('SELECT available_units, held_units FROM wallets').get(),
    { available_units: 0, held_units: 0 },
  );
  assert.deepEqual(
    db.prepare('SELECT charged_units, shadow_units FROM usage_events').get(),
    { charged_units: 0, shadow_units: 1000 },
  );
  assert.deepEqual(service.getBalance('unlimited-drift@example.com', 'ec_points'), {
    availableUnits: 0,
    heldUnits: 0,
    unlimited: false,
  });
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
  const invalidEnvelopes = [
    {
      id: 'invalid-envelope-version',
      metadata: {
        _walletService: {
          version: 2,
          operation: 'grant',
          fingerprint: 'fingerprint',
          result: { id: 'lot', creditLotId: 'lot', ledgerId: 'ledger' },
        },
        userMetadata: { hidden: 'version' },
      },
    },
    {
      id: 'invalid-envelope-operation',
      metadata: {
        _walletService: {
          version: 1,
          operation: 'business_operation',
          fingerprint: 'fingerprint',
          result: { id: 'result' },
        },
        userMetadata: { hidden: 'operation' },
      },
    },
    {
      id: 'invalid-envelope-fingerprint',
      metadata: {
        _walletService: {
          version: 1,
          operation: 'grant',
          fingerprint: '',
          result: { id: 'lot', creditLotId: 'lot', ledgerId: 'ledger' },
        },
        userMetadata: { hidden: 'fingerprint' },
      },
    },
    {
      id: 'invalid-envelope-result',
      metadata: {
        _walletService: {
          version: 1,
          operation: 'grant',
          fingerprint: 'fingerprint',
          result: { unrelated: true },
        },
        userMetadata: { hidden: 'result' },
      },
    },
  ];
  const insertInvalidEnvelope = db.prepare(`
    INSERT INTO wallet_ledger (
      id, owner_email, currency, event_type, delta_available, delta_held,
      balance_available, balance_held, reference_type, reference_id,
      idempotency_key, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  invalidEnvelopes.forEach((entry, index) => insertInvalidEnvelope.run(
    entry.id,
    'ledger@example.com',
    'ec_points',
    'manual',
    0,
    0,
    2000,
    0,
    'manual',
    `${entry.id}-reference`,
    `${entry.id}-idempotency`,
    JSON.stringify(entry.metadata),
    `999${7 - index}-12-31 23:59:59`,
  ));

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
  for (const entry of invalidEnvelopes) {
    assert.deepEqual(
      ledger.find(row => row.id === entry.id).metadata,
      entry.metadata,
    );
  }
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

test('separate SQLite connections cannot reserve the same wallet units', t => {
  const directory = mkdtempSync(join(tmpdir(), 'billing-wallet-contention-'));
  const databasePath = join(directory, 'billing.db');
  const dbOne = new Database(databasePath, { timeout: 25 });
  ensureBillingSchema(dbOne);
  const dbTwo = new Database(databasePath, { timeout: 25 });
  ensureBillingSchema(dbTwo);
  const serviceOne = createWalletService(dbOne, { isUnlimited: () => false });
  const serviceTwo = createWalletService(dbTwo, { isUnlimited: () => false });
  t.after(() => {
    dbOne.close();
    dbTwo.close();
    rmSync(directory, { recursive: true, force: true });
  });

  serviceOne.grant({
    ownerEmail: 'contention@example.com',
    currency: 'ec_points',
    units: 1000,
    idempotencyKey: 'contention-grant',
  });

  dbOne.exec('BEGIN IMMEDIATE');
  try {
    assert.throws(() => serviceTwo.createHold({
      ownerEmail: 'contention@example.com',
      currency: 'ec_points',
      quoteId: 'contention-locked-quote',
      idempotencyKey: 'contention-locked-hold',
      items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
    }), error => {
      assert.equal(error.code, 'SQLITE_BUSY');
      return true;
    });
  } finally {
    dbOne.exec('COMMIT');
  }

  const winningHold = serviceOne.createHold({
    ownerEmail: 'contention@example.com',
    currency: 'ec_points',
    quoteId: 'contention-winning-quote',
    idempotencyKey: 'contention-winning-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  });
  assert.ok(winningHold.id);
  assert.throws(() => serviceTwo.createHold({
    ownerEmail: 'contention@example.com',
    currency: 'ec_points',
    quoteId: 'contention-losing-quote',
    idempotencyKey: 'contention-losing-hold',
    items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }],
  }), /insufficient/i);

  assert.deepEqual(
    dbTwo.prepare('SELECT available_units, held_units FROM wallets').get(),
    { available_units: 0, held_units: 1000 },
  );
  assert.equal(dbTwo.prepare('SELECT remaining_units FROM credit_lots').get().remaining_units, 0);
  assert.equal(dbTwo.prepare('SELECT COUNT(*) AS count FROM billing_holds').get().count, 1);
  assert.equal(dbTwo.prepare('SELECT COUNT(*) AS count FROM billing_hold_items').get().count, 1);
});
