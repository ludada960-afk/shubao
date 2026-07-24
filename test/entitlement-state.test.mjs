import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEntitlement } from '../src/store/entitlementState.js';

test('normalizes unlimited owner entitlements without fake numeric credits', () => {
  assert.deepEqual(normalizeEntitlement({ credits: null, unlimited: true }), { credits: null, unlimited: true });
});

test('normalizes ordinary balances safely', () => {
  assert.deepEqual(normalizeEntitlement({ credits: 3, unlimited: false }), { credits: 3, unlimited: false });
  assert.deepEqual(normalizeEntitlement({}), { credits: 0, unlimited: false });
});
