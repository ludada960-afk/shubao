import assert from 'node:assert/strict';
import test from 'node:test';

import { createBillingQuoteService } from '../server/billing/quoteService.mjs';
import { createEcommerceBilling } from '../server/ecommerceEngine/ecommerceBilling.mjs';
import { quoteFeature } from '../server/billing/catalog.mjs';

const SECRET = 'ecommerce-billing-contract-secret-ecommerce-billing-contract-secret';

function item(id, generationSize = '2048x2048') {
  return { id, role: 'main', generationSize };
}

test('catalog exposes server-owned Nano Banana model and resolution SKUs', () => {
  const cases = [
    ['ec_nano_flash_1k', 8000], ['ec_nano_flash_2k', 12000], ['ec_nano_flash_4k', 18000],
    ['ec_nano_pro_1k', 16000], ['ec_nano_pro_2k', 16000], ['ec_nano_pro_4k', 28000],
  ];
  for (const [sku, units] of cases) assert.equal(quoteFeature(sku, 1).units, units);
});

function harness({ ownerEmail = 'owner@example.com', assetPlan = [item('main-1'), item('main-2')] } = {}) {
  const quoteService = createBillingQuoteService({
    secret: SECRET,
    now: () => Date.parse('2026-07-26T00:00:00.000Z'),
  });
  const createHoldCalls = [];
  const walletService = {
    createHold(input) {
      createHoldCalls.push(input);
      return { id: 'hold-one', ...input };
    },
    getBalance() {
      return { availableUnits: 50_000, heldUnits: 0, unlimited: false };
    },
    settleItem() {},
    releaseItem() {},
    releaseRemainder() {},
  };
  const billing = createEcommerceBilling({ walletService, quoteService });
  const sku = assetPlan[0].generationSize === '2880x2880' ? 'ec_image_4k' : 'ec_image_2k';
  const acceptedQuote = quoteFeature(sku, assetPlan.length);
  const issued = quoteService.issue({ ownerEmail, quote: acceptedQuote });
  return { acceptedQuote, assetPlan, billing, createHoldCalls, issued, ownerEmail };
}

test('binds the hold to the owner quote and exact recomputed asset plan', async () => {
  const { assetPlan, billing, createHoldCalls, issued, ownerEmail } = harness();

  const hold = await billing.hold({
    job: {
      id: 'job-one',
      ownerEmail,
      payload: { billing_quote_id: issued.quoteId },
    },
    assetPlan,
  });

  assert.equal(hold.id, 'hold-one');
  assert.equal(createHoldCalls.length, 1);
  assert.deepEqual(createHoldCalls[0], {
    ownerEmail,
    currency: 'ec_points',
    quoteId: issued.quoteId,
    idempotencyKey: 'ec-hold:job-one',
    expiresAt: issued.expiresAt,
    items: [
      { key: 'main-1', sku: 'ec_image_2k', units: 1000 },
      { key: 'main-2', sku: 'ec_image_2k', units: 1000 },
    ],
    metadata: {
      taskId: 'job-one',
      source: 'ecommerce_generate',
      quoteExpiresAt: issued.expiresAt,
    },
  });
});

test('rejects missing, cross-owner, count, resolution, and mixed-plan quote mismatches before creating a hold', async () => {
  const base = harness();
  const cases = [
    {
      label: 'missing',
      job: { id: 'job-missing', ownerEmail: base.ownerEmail, payload: {} },
      assetPlan: base.assetPlan,
      status: 400,
      code: 'BILLING_QUOTE_REQUIRED',
    },
    {
      label: 'cross-owner',
      job: {
        id: 'job-owner',
        ownerEmail: 'other@example.com',
        payload: { billing_quote_id: base.issued.quoteId },
      },
      assetPlan: base.assetPlan,
      status: 409,
      code: 'BILLING_QUOTE_MISMATCH',
    },
    {
      label: 'count',
      job: {
        id: 'job-count',
        ownerEmail: base.ownerEmail,
        payload: { billing_quote_id: base.issued.quoteId },
      },
      assetPlan: [...base.assetPlan, item('main-3')],
      status: 409,
      code: 'BILLING_QUOTE_MISMATCH',
    },
    {
      label: 'resolution',
      job: {
        id: 'job-resolution',
        ownerEmail: base.ownerEmail,
        payload: { billing_quote_id: base.issued.quoteId },
      },
      assetPlan: [item('main-1', '2880x2880'), item('main-2', '2880x2880')],
      status: 409,
      code: 'BILLING_QUOTE_MISMATCH',
    },
    {
      label: 'mixed',
      job: {
        id: 'job-mixed',
        ownerEmail: base.ownerEmail,
        payload: { billing_quote_id: base.issued.quoteId },
      },
      assetPlan: [item('main-1'), item('main-2', '2880x2880')],
      status: 409,
      code: 'BILLING_QUOTE_PLAN_MIXED',
    },
  ];

  for (const entry of cases) {
    await assert.rejects(
      base.billing.hold({ job: entry.job, assetPlan: entry.assetPlan }),
      error => {
        assert.equal(error?.status, entry.status, entry.label);
        assert.equal(error?.code, entry.code, entry.label);
        assert.equal(error?.reQuoteRequired, true, entry.label);
        return true;
      },
    );
  }
  assert.equal(base.createHoldCalls.length, 0);
});
