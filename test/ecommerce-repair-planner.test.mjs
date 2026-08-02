import assert from 'node:assert/strict';
import test from 'node:test';

import { canRetry, planRepair } from '../server/ecommerceEngine/repairPlanner.mjs';

test('maps a missing transparent background to deterministic alpha normalization', () => {
  const repair = planRepair({
    checks: {
      technical: { status: 'pass', issueCodes: [] },
      platformCompliance: {
        status: 'fail',
        issueCodes: ['transparent_background_missing'],
      },
      productFidelity: { status: 'pass', issueCodes: [] },
      copyAndLogo: { status: 'skipped', issueCodes: [] },
      visualQuality: { status: 'pass', issueCodes: [] },
    },
  });

  assert.deepEqual(repair, {
    type: 'sharp_repair',
    operations: ['normalize_transparent_background'],
    focusIssueCodes: ['transparent_background_missing'],
    userCharge: false,
  });
});

test('formal deliverables receive two bounded internal quality repairs', () => {
  const action = { type: 'regenerate_from_product_truth' };
  assert.equal(canRetry(0, action), true);
  assert.equal(canRetry(1, action), true);
  assert.equal(canRetry(2, action), false);
});

test('regenerates a shot that clearly misses its confirmed commercial responsibility', () => {
  const repair = planRepair({
    checks: {
      technical: { status: 'pass', issueCodes: [] },
      platformCompliance: { status: 'pass', issueCodes: [] },
      productFidelity: { status: 'pass', issueCodes: [] },
      copyAndLogo: { status: 'skipped', issueCodes: [] },
      visualQuality: {
        status: 'fail',
        issueCodes: ['planned_shot_not_fulfilled'],
      },
    },
  });

  assert.deepEqual(repair, {
    type: 'regenerate_from_product_truth',
    focusIssueCodes: ['planned_shot_not_fulfilled'],
    preserveUserFacts: true,
    userCharge: false,
  });
});

test('regenerates a shot when the product-fidelity review finds invented text', () => {
  const repair = planRepair({
    checks: {
      technical: { status: 'pass', issueCodes: [] },
      platformCompliance: { status: 'pass', issueCodes: [] },
      productFidelity: {
        status: 'fail',
        issueCodes: ['forbidden_text_added'],
      },
      copyAndLogo: { status: 'skipped', issueCodes: [] },
      visualQuality: { status: 'pass', issueCodes: [] },
    },
  });

  assert.deepEqual(repair, {
    type: 'regenerate_from_product_truth',
    focusIssueCodes: ['forbidden_text_added'],
    preserveUserFacts: true,
    userCharge: false,
  });
});
