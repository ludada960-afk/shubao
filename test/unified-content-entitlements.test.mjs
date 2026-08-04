import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';
import { createWalletService } from '../server/billing/walletService.mjs';
import { createPaymentService } from '../server/billing/paymentService.mjs';
import { createContentEntitlements } from '../server/billing/contentEntitlements.mjs';

const OWNER = 'buyer@example.com';

function assetUrl(index) {
  return `/api/generated-assets/${index.toString(16).padStart(64, '0')}.png`;
}

function delivery() {
  return {
    title: '完整内容',
    cover_url: assetUrl(0),
    image_urls: Array.from({ length: 8 }, (_, index) => assetUrl(index + 1)),
  };
}

test('unified content entitlement settles one nine-image set from the ec_points wallet', () => {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  const walletService = createWalletService(db);
  const paymentService = createPaymentService(db, walletService, {
    testpay: {
      enabled: true,
      createOrder(order) {
        return { providerOrderId: `test_${order.id}` };
      },
      verifyEvent(event) {
        return event;
      },
    },
  });
  const entitlements = createContentEntitlements(db, walletService, {
    currency: 'ec_points',
    itemUnits: 9000,
  });

  const order = paymentService.createOrder({
    ownerEmail: OWNER,
    productSku: 'ec_starter_29',
    provider: 'testpay',
    idempotencyKey: 'unified-content-order',
  });
  paymentService.applyProviderEvent('testpay', {
    eventId: 'unified-content-paid',
    providerOrderId: order.providerOrderId,
    status: 'paid',
  });

  const hold = entitlements.holdSet({
    ownerEmail: OWNER,
    generationId: 'unified-entitlement-1',
    workId: 'content-unified-entitlement-1',
    mode: 'xhs',
  });
  assert.equal(hold.currency, 'ec_points');
  assert.equal(hold.totalUnits, 9000);

  const settled = entitlements.completeSet({
    ownerEmail: OWNER,
    generationId: 'unified-entitlement-1',
    workId: 'content-unified-entitlement-1',
    result: delivery(),
  });
  assert.equal(settled.status, 'settled');
  assert.equal(settled.settlement.units, 9000);
  assert.equal(settled.entitlement.includedCount, 0);
  assert.equal(settled.entitlement.planSnapshot.currency, 'ec_points');
  assert.equal(settled.entitlement.planSnapshot.itemUnits, 9000);
  assert.deepEqual(walletService.getBalance(OWNER, 'ec_points'), {
    availableUnits: 96000,
    heldUnits: 0,
    unlimited: false,
  });
  db.close();
});
