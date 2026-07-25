import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaymentService } from '../server/billing/paymentService.mjs';
import {
  createContentEntitlements,
  isCompleteContentDelivery,
} from '../server/billing/contentEntitlements.mjs';

const OWNER = 'buyer@example.com';
const DAY_MS = 24 * 60 * 60 * 1000;

function createHarness({ unlimitedOwners = [] } = {}) {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const unlimited = new Set(unlimitedOwners.map(email => email.toLowerCase()));
  const walletService = createWalletService(db, {
    isUnlimited: email => unlimited.has(email.toLowerCase()),
  });
  const paymentService = createPaymentService(db, walletService, {
    stripe: {
      enabled: true,
      createOrder(order) {
        return { providerOrderId: `stripe_${order.id}` };
      },
      verifyEvent(event) {
        return event;
      },
    },
  });
  const service = createContentEntitlements(db, walletService);
  return { db, walletService, paymentService, service };
}

function purchaseEntryPlan(paymentService, ownerEmail = OWNER, suffix = 'default') {
  const order = paymentService.createOrder({
    ownerEmail,
    productSku: 'xhs_entry_19',
    provider: 'stripe',
    idempotencyKey: `order-${suffix}`,
  });
  paymentService.applyProviderEvent('stripe', {
    eventId: `event-${suffix}`,
    providerOrderId: order.providerOrderId,
    status: 'paid',
  });
  return order;
}

function assetId(index, extension = 'png') {
  return `${index.toString(16).padStart(64, '0')}.${extension}`;
}

function assetUrl(index, extension = 'png') {
  return `/api/generated-assets/${assetId(index, extension)}`;
}

function delivery(totalImages = 9, text = { title: 'A durable content set' }) {
  return {
    ...text,
    cover_url: assetUrl(0),
    image_urls: Array.from(
      { length: Math.max(0, totalImages - 1) },
      (_, index) => assetUrl(index + 1),
    ),
  };
}

function holdPaidSet(harness, {
  ownerEmail = OWNER,
  generationId = 'generation-1',
  workId = 'work-1',
  mode = 'xhs',
  metadata,
} = {}) {
  purchaseEntryPlan(harness.paymentService, ownerEmail, generationId);
  return harness.service.holdSet({
    ownerEmail,
    generationId,
    workId,
    mode,
    metadata,
  });
}

function completePaidWork(harness, options = {}) {
  const ownerEmail = options.ownerEmail ?? OWNER;
  const generationId = options.generationId ?? 'generation-1';
  const workId = options.workId ?? 'work-1';
  holdPaidSet(harness, { ...options, ownerEmail, generationId, workId });
  return harness.service.completeSet({
    ownerEmail,
    generationId,
    workId,
    result: options.result ?? delivery(),
    regenPerWork: options.regenPerWork,
  });
}

function readEntitlement(db, workId = 'work-1') {
  const row = db.prepare(`
    SELECT work_id, owner_email, included_count, used_count, held_count,
           expires_at, plan_snapshot
    FROM work_regeneration_entitlements
    WHERE work_id = ?
  `).get(workId);
  if (!row) return null;
  return { ...row, plan_snapshot: JSON.parse(row.plan_snapshot) };
}

function readSetMutationState(harness, holdId, workId) {
  return {
    hold: harness.db.prepare(`
      SELECT status, settled_units, released_units
      FROM billing_holds WHERE id = ?
    `).get(holdId),
    item: harness.db.prepare(`
      SELECT status, reference_id
      FROM billing_hold_items WHERE hold_id = ? AND item_key = 'content-set'
    `).get(holdId),
    ledger: harness.db.prepare(`
      SELECT event_type, delta_available, delta_held, reference_type,
             reference_id, idempotency_key
      FROM wallet_ledger
      ORDER BY rowid
    `).all(),
    usage: harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count,
    entitlement: readEntitlement(harness.db, workId),
    balance: harness.walletService.getBalance(OWNER, 'content_sets'),
  };
}

test('complete delivery requires unique stable cover plus images and non-blank copy', () => {
  assert.equal(isCompleteContentDelivery(delivery()), true);
  assert.equal(isCompleteContentDelivery(delivery(8)), false);
  assert.equal(isCompleteContentDelivery(delivery(10)), false);

  const duplicate = delivery();
  duplicate.image_urls[0] = duplicate.cover_url;
  assert.equal(isCompleteContentDelivery(duplicate), false);

  const blankCopy = delivery(9, {
    title: '   ',
    caption: '',
    body_text: '\n',
    copyLines: [' ', '\t'],
  });
  assert.equal(isCompleteContentDelivery(blankCopy), false);

  const copyLinesOnly = delivery(9, { copyLines: ['  usable copy  '] });
  assert.equal(isCompleteContentDelivery(copyLinesOnly), true);

  const temporaryUrl = delivery();
  temporaryUrl.image_urls[3] = 'http://temporary.example/image.png';
  assert.equal(isCompleteContentDelivery(temporaryUrl), false);

  const blankUrl = delivery();
  blankUrl.image_urls[2] = '   ';
  assert.equal(isCompleteContentDelivery(blankUrl), false);

  const queryAlias = delivery();
  queryAlias.image_urls[0] = `${queryAlias.cover_url}?cache=other`;
  assert.equal(isCompleteContentDelivery(queryAlias), false);

  const hashFragment = delivery();
  hashFragment.image_urls[0] = `${assetUrl(1)}#fragment`;
  assert.equal(isCompleteContentDelivery(hashFragment), false);

  const uppercaseHash = delivery();
  uppercaseHash.image_urls[0] = `/api/generated-assets/${'A'.repeat(64)}.png`;
  assert.equal(isCompleteContentDelivery(uppercaseHash), false);

  const encodedHash = delivery();
  encodedHash.image_urls[0] = `/api/generated-assets/%61${'a'.repeat(63)}.png`;
  assert.equal(isCompleteContentDelivery(encodedHash), false);

  const fakePath = delivery();
  fakePath.image_urls[0] = `${assetUrl(1)}/extra.png`;
  assert.equal(isCompleteContentDelivery(fakePath), false);
});

test('invalid or duplicate generated asset ids never auto-settle a complete result', t => {
  const cases = [
    ['same hash with query', result => {
      result.image_urls[0] = `${result.cover_url}?version=2`;
    }],
    ['uppercase hash', result => {
      result.image_urls[0] = `/api/generated-assets/${'A'.repeat(64)}.png`;
    }],
    ['encoded hash', result => {
      result.image_urls[0] = `/api/generated-assets/%61${'a'.repeat(63)}.png`;
    }],
    ['extra path', result => {
      result.image_urls[0] = `${assetUrl(1)}/preview`;
    }],
    ['duplicate asset id', result => {
      result.image_urls[0] = result.cover_url;
    }],
  ];

  for (const [index, [label, mutate]] of cases.entries()) {
    const harness = createHarness();
    t.after(() => harness.db.close());
    const generationId = `generation-invalid-asset-${index}`;
    const workId = `work-invalid-asset-${index}`;
    const hold = holdPaidSet(harness, { generationId, workId });
    const result = delivery();
    mutate(result);

    assert.equal(harness.service.completeSet({
      ownerEmail: OWNER,
      generationId,
      workId,
      result,
    }).status, 'needs_review', label);
    assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
      .get(hold.id).status, 'pending', label);
    assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 0, label);
    assert.equal(readEntitlement(harness.db, workId), null, label);
  }
});

test('holdSet reserves one content set idempotently and stores only server context', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  purchaseEntryPlan(harness.paymentService, OWNER, 'hold-contract');

  const request = {
    ownerEmail: ' Buyer@Example.COM ',
    generationId: ' generation-hold ',
    workId: ' work-hold ',
    mode: ' xhs ',
    metadata: { regenPerWork: 999, clientSecret: 'ignore-me' },
  };
  const first = harness.service.holdSet(request);
  const repeated = harness.service.holdSet(request);

  assert.deepEqual(repeated, first);
  assert.equal(first.currency, 'content_sets');
  assert.equal(first.quoteId, 'generation-hold');
  assert.deepEqual(first.items.map(item => ({ key: item.key, sku: item.sku, units: item.units })), [
    { key: 'content-set', sku: 'content_full_set', units: 1 },
  ]);
  const raw = JSON.parse(harness.db.prepare(
    'SELECT metadata FROM billing_holds WHERE id = ?',
  ).get(first.id).metadata);
  assert.deepEqual(raw.userMetadata, {
    generationId: 'generation-hold',
    workId: 'work-hold',
    mode: 'xhs',
  });
  assert.equal(raw.userMetadata.regenPerWork, undefined);
  assert.equal(raw.userMetadata.clientSecret, undefined);

  assert.throws(() => harness.service.holdSet({
    ...request,
    workId: 'conflicting-work',
  }), error => error.code === 'BILLING_IDEMPOTENCY_CONFLICT');
});

test('a complete nine-image set settles once and creates five credits from the paid catalog snapshot', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const order = purchaseEntryPlan(harness.paymentService, OWNER, 'complete');
  const hold = harness.service.holdSet({
    ownerEmail: OWNER,
    generationId: 'generation-complete',
    workId: 'work-complete',
    mode: 'xhs',
    metadata: { regenPerWork: 999 },
  });

  const completed = harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-complete',
    workId: 'work-complete',
    result: delivery(),
    regenPerWork: 999,
  });
  const repeated = harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-complete',
    workId: 'work-complete',
    result: delivery(),
    regenPerWork: 1,
  });

  assert.equal(completed.status, 'settled');
  assert.equal(repeated.status, 'settled');
  assert.deepEqual(harness.db.prepare(`
    SELECT status, settled_units, released_units
    FROM billing_holds WHERE id = ?
  `).get(hold.id), { status: 'settled', settled_units: 1, released_units: 0 });
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'settled');
  assert.equal(harness.db.prepare(`
    SELECT COUNT(*) AS count FROM usage_events
    WHERE reference_type = 'content_work' AND reference_id = ?
  `).get('work-complete').count, 1);

  const entitlement = readEntitlement(harness.db, 'work-complete');
  assert.equal(entitlement.included_count, 5);
  assert.equal(entitlement.used_count, 0);
  assert.equal(entitlement.held_count, 0);
  assert.equal(entitlement.plan_snapshot.paymentOrderId, order.id);
  assert.equal(entitlement.plan_snapshot.productSku, 'xhs_entry_19');
  assert.equal(entitlement.plan_snapshot.catalogVersion, order.catalogVersion);
  assert.equal(entitlement.plan_snapshot.regenPerWork, 5);
  assert.equal(entitlement.plan_snapshot.validityDays, 30);
  assert.equal(entitlement.plan_snapshot.mode, 'xhs');
  assert.equal(entitlement.plan_snapshot.generationId, 'generation-complete');
  assert.equal(entitlement.plan_snapshot.unlimited, false);
  assert.deepEqual(entitlement.plan_snapshot.attempts, []);
  assert.equal(
    Date.parse(entitlement.expires_at) - Date.parse(entitlement.plan_snapshot.completedAt),
    30 * DAY_MS,
  );
});

test('eight images remain pending until acceptPartial explicitly settles the set', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const hold = holdPaidSet(harness, {
    generationId: 'generation-partial',
    workId: 'work-partial',
  });

  const review = harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-partial',
    workId: 'work-partial',
    result: delivery(8),
  });
  assert.equal(review.status, 'needs_review');
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'pending');
  assert.equal(readEntitlement(harness.db, 'work-partial'), null);
  assert.deepEqual(harness.walletService.getBalance(OWNER, 'content_sets'), {
    availableUnits: 2,
    heldUnits: 1,
    unlimited: false,
  });

  const accepted = harness.service.acceptPartial({
    ownerEmail: OWNER,
    generationId: 'generation-partial',
    workId: 'work-partial',
    result: delivery(8),
  });
  assert.equal(accepted.status, 'settled');
  assert.equal(readEntitlement(harness.db, 'work-partial').included_count, 5);
  assert.deepEqual(harness.walletService.getBalance(OWNER, 'content_sets'), {
    availableUnits: 2,
    heldUnits: 0,
    unlimited: false,
  });
});

test('acceptPartial settles one valid stable asset with copy and creates normal regeneration rights', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const hold = holdPaidSet(harness, {
    generationId: 'generation-one-image-partial',
    workId: 'work-one-image-partial',
  });

  const accepted = harness.service.acceptPartial({
    ownerEmail: OWNER,
    generationId: 'generation-one-image-partial',
    workId: 'work-one-image-partial',
    result: delivery(1),
  });

  assert.equal(accepted.status, 'settled');
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'settled');
  assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 1);
  const entitlement = readEntitlement(harness.db, 'work-one-image-partial');
  assert.equal(entitlement.included_count, 5);
  assert.equal(entitlement.plan_snapshot.acceptedPartial, true);
});

test('invalid partial delivery is rejected atomically without changing billing state', t => {
  const cases = [
    ['missing result', undefined],
    ['empty object', {}],
    ['blank copy', { title: '  ', cover_url: assetUrl(1) }],
    ['zero images', { title: 'usable copy', image_urls: [] }],
    ['malformed image list', { title: 'usable copy', image_urls: assetUrl(1) }],
    ['invalid provided url', {
      title: 'usable copy',
      cover_url: assetUrl(1),
      image_urls: ['http://temporary.example/image.png'],
    }],
    ['duplicate asset id', {
      title: 'usable copy',
      cover_url: assetUrl(1),
      image_urls: [assetUrl(1)],
    }],
    ['query alias', {
      title: 'usable copy',
      cover_url: assetUrl(1),
      image_urls: [`${assetUrl(2)}?version=2`],
    }],
  ];

  for (const [index, [label, result]] of cases.entries()) {
    const harness = createHarness();
    t.after(() => harness.db.close());
    const generationId = `generation-invalid-partial-${index}`;
    const workId = `work-invalid-partial-${index}`;
    const hold = holdPaidSet(harness, { generationId, workId });
    const before = readSetMutationState(harness, hold.id, workId);

    assert.throws(() => harness.service.acceptPartial({
      ownerEmail: OWNER,
      generationId,
      workId,
      result,
    }), error => error.code === 'CONTENT_PARTIAL_DELIVERY_INVALID', label);
    assert.deepEqual(readSetMutationState(harness, hold.id, workId), before, label);
  }
});

test('failSet releases a pending set idempotently and rejects settlement afterward', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const hold = holdPaidSet(harness, {
    generationId: 'generation-failed',
    workId: 'work-failed',
  });

  const first = harness.service.failSet({
    ownerEmail: OWNER,
    generationId: 'generation-failed',
    workId: 'work-failed',
    reason: 'provider_failed',
  });
  const repeated = harness.service.failSet({
    ownerEmail: OWNER,
    generationId: 'generation-failed',
    workId: 'work-failed',
    reason: 'provider_failed',
  });
  assert.equal(first.status, 'released');
  assert.equal(repeated.status, 'released');
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'released');
  assert.deepEqual(harness.walletService.getBalance(OWNER, 'content_sets'), {
    availableUnits: 3,
    heldUnits: 0,
    unlimited: false,
  });
  assert.throws(() => harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-failed',
    workId: 'work-failed',
    result: delivery(),
  }), error => error.code === 'CONTENT_SET_STATE_INVALID');
});

test('paid completion rejects an unprovable allocation without settling', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const hold = holdPaidSet(harness, {
    generationId: 'generation-unprovable',
    workId: 'work-unprovable',
  });
  const raw = JSON.parse(harness.db.prepare(
    'SELECT metadata FROM billing_holds WHERE id = ?',
  ).get(hold.id).metadata);
  const lotId = raw._walletService.allocations[0].lots[0].lotId;
  harness.db.prepare("UPDATE credit_lots SET source_type = 'admin' WHERE id = ?").run(lotId);

  assert.throws(() => harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-unprovable',
    workId: 'work-unprovable',
    result: delivery(),
  }), error => error.code === 'CONTENT_ENTITLEMENT_SOURCE_INVALID');
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'pending');
  assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 0);
  assert.equal(readEntitlement(harness.db, 'work-unprovable'), null);
});

test('entitlement persistence failure rolls back wallet settlement atomically', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  const hold = holdPaidSet(harness, {
    generationId: 'generation-rollback',
    workId: 'work-rollback',
  });
  harness.db.exec(`
    CREATE TRIGGER reject_work_entitlement
    BEFORE INSERT ON work_regeneration_entitlements
    BEGIN
      SELECT RAISE(ABORT, 'entitlement rejected');
    END;
  `);

  assert.throws(() => harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-rollback',
    workId: 'work-rollback',
    result: delivery(),
  }), /entitlement rejected/);
  assert.deepEqual(harness.db.prepare(`
    SELECT status, settled_units, released_units FROM billing_holds WHERE id = ?
  `).get(hold.id), { status: 'pending', settled_units: 0, released_units: 0 });
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'pending');
  assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 0);
  assert.equal(harness.db.prepare(
    "SELECT COUNT(*) AS count FROM wallet_ledger WHERE event_type = 'settle'",
  ).get().count, 0);
  assert.deepEqual(harness.walletService.getBalance(OWNER, 'content_sets'), {
    availableUnits: 2,
    heldUnits: 1,
    unlimited: false,
  });
});

test('owner and work source conflicts are rejected without consuming another hold', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  completePaidWork(harness, {
    generationId: 'generation-source-one',
    workId: 'work-source-conflict',
  });
  purchaseEntryPlan(harness.paymentService, OWNER, 'generation-source-two');
  const secondHold = harness.service.holdSet({
    ownerEmail: OWNER,
    generationId: 'generation-source-two',
    workId: 'work-source-conflict',
    mode: 'plog',
  });

  assert.throws(() => harness.service.completeSet({
    ownerEmail: 'other@example.com',
    generationId: 'generation-source-two',
    workId: 'work-source-conflict',
    result: delivery(),
  }), error => error.code === 'CONTENT_ENTITLEMENT_OWNER_MISMATCH');
  assert.throws(() => harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-source-two',
    workId: 'work-source-conflict',
    result: delivery(),
  }), error => error.code === 'CONTENT_ENTITLEMENT_CONFLICT');
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(secondHold.id).status, 'pending');
  assert.equal(harness.db.prepare('SELECT COUNT(*) AS count FROM usage_events').get().count, 1);
});

test('system regeneration attempts never change numeric counters', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  completePaidWork(harness, {
    generationId: 'generation-system',
    workId: 'work-system',
  });

  const held = harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-system',
    regenerationId: 'system-repair-complete',
    kind: 'system',
  });
  const completed = harness.service.completeRegeneration({
    ownerEmail: OWNER,
    workId: 'work-system',
    regenerationId: 'system-repair-complete',
  });
  harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-system',
    regenerationId: 'system-repair-release',
    kind: 'system',
  });
  const released = harness.service.releaseRegeneration({
    ownerEmail: OWNER,
    workId: 'work-system',
    regenerationId: 'system-repair-release',
  });

  assert.equal(held.kind, 'system');
  assert.equal(completed.status, 'completed');
  assert.equal(released.status, 'released');
  const entitlement = readEntitlement(harness.db, 'work-system');
  assert.deepEqual({
    included: entitlement.included_count,
    used: entitlement.used_count,
    held: entitlement.held_count,
  }, { included: 5, used: 0, held: 0 });
});

test('a user regeneration hold and completion consume exactly once', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  completePaidWork(harness, {
    generationId: 'generation-user-complete',
    workId: 'work-user-complete',
  });

  const held = harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-complete',
    regenerationId: 'regen-user-1',
    kind: 'user',
  });
  const repeatedHold = harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-complete',
    regenerationId: 'regen-user-1',
    kind: 'user',
  });
  assert.deepEqual(repeatedHold, held);
  assert.deepEqual({
    used: readEntitlement(harness.db, 'work-user-complete').used_count,
    held: readEntitlement(harness.db, 'work-user-complete').held_count,
  }, { used: 0, held: 1 });

  const completed = harness.service.completeRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-complete',
    regenerationId: 'regen-user-1',
  });
  const repeated = harness.service.completeRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-complete',
    regenerationId: 'regen-user-1',
  });
  assert.deepEqual(repeated, completed);
  assert.deepEqual({
    used: readEntitlement(harness.db, 'work-user-complete').used_count,
    held: readEntitlement(harness.db, 'work-user-complete').held_count,
  }, { used: 1, held: 0 });
  assert.throws(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-complete',
    regenerationId: 'regen-user-1',
    kind: 'user',
  }), error => error.code === 'CONTENT_REGEN_STATE_INVALID');
});

test('releasing a user regeneration restores availability without increasing used count', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  completePaidWork(harness, {
    generationId: 'generation-user-release',
    workId: 'work-user-release',
  });
  harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-release',
    regenerationId: 'regen-release-1',
    kind: 'user',
  });
  const released = harness.service.releaseRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-release',
    regenerationId: 'regen-release-1',
  });
  const repeated = harness.service.releaseRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-release',
    regenerationId: 'regen-release-1',
  });
  assert.deepEqual(repeated, released);
  assert.deepEqual({
    used: readEntitlement(harness.db, 'work-user-release').used_count,
    held: readEntitlement(harness.db, 'work-user-release').held_count,
  }, { used: 0, held: 0 });
  assert.doesNotThrow(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-user-release',
    regenerationId: 'regen-release-2',
    kind: 'user',
  }));
});

test('regeneration rejects conflicts, unknown attempts, owner mismatch, expiry, and exhaustion', t => {
  const harness = createHarness();
  t.after(() => harness.db.close());
  completePaidWork(harness, {
    generationId: 'generation-guards',
    workId: 'work-guards',
  });

  harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-conflict',
    kind: 'user',
  });
  assert.throws(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-conflict',
    kind: 'system',
  }), error => error.code === 'CONTENT_REGEN_ATTEMPT_CONFLICT');
  assert.throws(() => harness.service.completeRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'unknown-attempt',
  }), error => error.code === 'CONTENT_REGEN_ATTEMPT_NOT_FOUND');
  assert.throws(() => harness.service.releaseRegeneration({
    ownerEmail: 'other@example.com',
    workId: 'work-guards',
    regenerationId: 'regen-conflict',
  }), error => error.code === 'CONTENT_ENTITLEMENT_OWNER_MISMATCH');
  harness.service.completeRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-conflict',
  });
  assert.throws(() => harness.service.releaseRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-conflict',
  }), error => error.code === 'CONTENT_REGEN_STATE_INVALID');

  for (let index = 2; index <= 5; index += 1) {
    const regenerationId = `regen-${index}`;
    harness.service.holdRegeneration({
      ownerEmail: OWNER,
      workId: 'work-guards',
      regenerationId,
      kind: 'user',
    });
    harness.service.completeRegeneration({
      ownerEmail: OWNER,
      workId: 'work-guards',
      regenerationId,
    });
  }
  assert.throws(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-exhausted',
    kind: 'user',
  }), error => error.code === 'CONTENT_REGEN_INSUFFICIENT');

  harness.db.prepare('UPDATE work_regeneration_entitlements SET expires_at = ? WHERE work_id = ?')
    .run('2000-01-01T00:00:00.000Z', 'work-guards');
  assert.throws(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'regen-expired',
    kind: 'user',
  }), error => error.code === 'CONTENT_REGEN_EXPIRED');
  assert.doesNotThrow(() => harness.service.holdRegeneration({
    ownerEmail: OWNER,
    workId: 'work-guards',
    regenerationId: 'system-after-expiry',
    kind: 'system',
  }));
});

test('unlimited accounts settle shadow sets and regenerate without numeric limits', t => {
  const harness = createHarness({ unlimitedOwners: [OWNER] });
  t.after(() => harness.db.close());
  const hold = harness.service.holdSet({
    ownerEmail: OWNER,
    generationId: 'generation-unlimited',
    workId: 'work-unlimited',
    mode: 'xhs',
    metadata: { regenPerWork: 999 },
  });
  const completed = harness.service.completeSet({
    ownerEmail: OWNER,
    generationId: 'generation-unlimited',
    workId: 'work-unlimited',
    result: delivery(),
    regenPerWork: 999,
  });
  assert.equal(completed.status, 'settled');
  assert.deepEqual(harness.db.prepare(`
    SELECT charged_units, shadow_units FROM usage_events WHERE reference_id = ?
  `).get('work-unlimited'), { charged_units: 0, shadow_units: 1 });

  const entitlement = readEntitlement(harness.db, 'work-unlimited');
  assert.equal(entitlement.included_count, 0);
  assert.equal(entitlement.used_count, 0);
  assert.equal(entitlement.held_count, 0);
  assert.equal(entitlement.plan_snapshot.unlimited, true);
  assert.equal(entitlement.plan_snapshot.paymentOrderId, null);
  assert.equal(entitlement.plan_snapshot.regenPerWork, null);
  assert.equal(entitlement.expires_at, '9999-12-31T23:59:59.999Z');

  for (let index = 0; index < 12; index += 1) {
    const regenerationId = `unlimited-user-${index}`;
    harness.service.holdRegeneration({
      ownerEmail: OWNER,
      workId: 'work-unlimited',
      regenerationId,
      kind: 'user',
    });
    harness.service.completeRegeneration({
      ownerEmail: OWNER,
      workId: 'work-unlimited',
      regenerationId,
    });
  }
  assert.deepEqual({
    used: readEntitlement(harness.db, 'work-unlimited').used_count,
    held: readEntitlement(harness.db, 'work-unlimited').held_count,
  }, { used: 0, held: 0 });
  assert.equal(harness.db.prepare('SELECT status FROM billing_hold_items WHERE hold_id = ?')
    .get(hold.id).status, 'settled');
});
