import assert from 'node:assert/strict';
import test from 'node:test';

import { planRepair } from '../server/ecommerceEngine/repairPlanner.mjs';

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
