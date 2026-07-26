import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEntitlement } from '../src/store/entitlementState.js';

test('normalizes milli-point balance records into separate human-readable entitlements', () => {
  assert.deepEqual(normalizeEntitlement({
    balances: {
      ec_points: { availableUnits: 105000, heldUnits: 0, unlimited: false },
      content_sets: { availableUnits: 10, heldUnits: 0, unlimited: false },
    },
    unlimited: false,
  }), { ecPoints: 105, contentSets: 10, unlimited: false });
});

test('normalizes compact balance payloads and keeps unlimited distinct from numeric balances', () => {
  assert.deepEqual(normalizeEntitlement({
    balances: { ec_points: 105000, content_sets: 10 },
    unlimited: false,
  }), { ecPoints: 105, contentSets: 10, unlimited: false });
  assert.deepEqual(normalizeEntitlement({ unlimited: true }), { ecPoints: null, contentSets: null, unlimited: true });
  assert.deepEqual(normalizeEntitlement({}), { ecPoints: 0, contentSets: 0, unlimited: false });
});
