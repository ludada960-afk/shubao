import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createContentBilling } from '../server/billing/contentBilling.mjs';

const OWNER = 'buyer@example.com';

function assetUrl(index) {
  return `/api/generated-assets/${index.toString(16).padStart(64, '0')}.png`;
}

function delivery() {
  return {
    title: '完整的小红书文案',
    cover_url: assetUrl(0),
    image_urls: Array.from({ length: 8 }, (_, index) => assetUrl(index + 1)),
  };
}

test('unified content billing holds and settles nine 2K images as ec_points', () => {
  let balance = { availableUnits: 105000, heldUnits: 0, unlimited: false };
  const calls = [];
  const holds = new Map();
  const contentEntitlements = {
    holdSet(input) {
      calls.push({ type: 'hold', input });
      assert.equal(input.ownerEmail, OWNER);
      const result = {
        id: `hold-${input.generationId}`,
        status: 'pending',
        currency: 'ec_points',
        balance: { availableUnits: 96000, heldUnits: 9000, unlimited: false },
      };
      balance = result.balance;
      holds.set(input.generationId, result);
      return result;
    },
    completeSet(input) {
      calls.push({ type: 'complete', input });
      const hold = holds.get(input.generationId);
      return {
        status: 'settled',
        holdId: hold.id,
        workId: input.workId,
        settlement: {
          status: 'settled',
          units: 9000,
          balance: { availableUnits: 96000, heldUnits: 0, unlimited: false },
        },
        entitlement: null,
      };
    },
    failSet() {
      throw new Error('not expected');
    },
  };
  const walletService = {
    getBalance(ownerEmail, currency) {
      assert.equal(ownerEmail, OWNER);
      assert.equal(currency, 'ec_points');
      return balance;
    },
  };
  const service = createContentBilling({
    db: new Database(':memory:'),
    contentEntitlements,
    walletService,
    currency: 'ec_points',
    itemUnits: 9000,
  });

  const begun = service.beginContentGeneration({
    ownerEmail: OWNER,
    generationId: 'xhs-unified-1',
    mode: 'xhs',
  });
  assert.equal(begun.billing.currency, 'ec_points');
  assert.equal(begun.billing.settledUnits, 0);
  assert.equal(begun.billing.balance, 96000);
  assert.equal(begun.billing.heldUnits, 9000);

  const completed = service.completeContentGeneration({
    ownerEmail: OWNER,
    generationId: 'xhs-unified-1',
    leaseToken: begun.leaseToken,
    result: delivery(),
  });
  assert.equal(completed.jobStatus, 'completed');
  assert.equal(completed.billing.currency, 'ec_points');
  assert.equal(completed.billing.settledUnits, 9000);
  assert.equal(completed.billing.balance, 96000);
  assert.equal(calls.filter(call => call.type === 'hold').length, 1);
  assert.equal(calls.filter(call => call.type === 'complete').length, 1);
});
