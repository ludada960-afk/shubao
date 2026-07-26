import test from 'node:test';
import assert from 'node:assert/strict';

import { handleGenerationAccessError } from '../src/utils/generationAccess.js';
import { loadPendingPaidAction } from '../src/utils/pendingPaidAction.js';

test('maps insufficient credits to a resumable ecommerce paywall with authoritative quote values', () => {
  const actions = [];
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const result = handleGenerationAccessError(
    { status: 402, code: 'INSUFFICIENT_CREDITS', payload: { required: 3000, available: 1000 } },
    action => actions.push(action),
    {
      ownerEmail: 'creator@example.com',
      source: 'test-flow',
      route: '/ecommerce',
      draftId: 'draft-42',
      action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
      quoteId: 'quote-7',
      storage,
      now: () => 1000,
    },
  );

  assert.equal(result, 'credits');
  assert.deepEqual(actions, [{
    type: 'OPEN_PAYWALL',
    tab: 'ecommerce',
    reason: 'INSUFFICIENT_CREDITS',
    pendingAction: {
      version: 1,
      ownerEmail: 'creator@example.com',
      source: 'test-flow',
      route: '/ecommerce',
      draftId: 'draft-42',
      action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
      quoteId: 'quote-7',
      createdAt: 1000,
      billing: { required: 3000, available: 1000 },
    },
  }]);
  const { billing, ...persistedAction } = actions[0].pendingAction;
  assert.deepEqual(billing, { required: 3000, available: 1000 });
  assert.deepEqual(loadPendingPaidAction('creator@example.com', { storage, now: () => 1001 }), persistedAction);
});

test('maps beta access failures to the login modal without changing form state', () => {
  const actions = [];
  const result = handleGenerationAccessError({ status: 403 }, action => actions.push(action));

  assert.equal(result, 'login');
  assert.deepEqual(actions, [{ type: 'SHOW_LOGIN', show: true }]);
});
