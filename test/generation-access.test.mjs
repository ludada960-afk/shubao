import test from 'node:test';
import assert from 'node:assert/strict';

import { handleGenerationAccessError } from '../src/utils/generationAccess.js';

test('maps insufficient credits to a resumable ecommerce paywall', () => {
  const actions = [];
  const result = handleGenerationAccessError(
    { status: 402, code: 'INSUFFICIENT_CREDITS' },
    action => actions.push(action),
    { source: 'test-flow', message: '保留当前配置' },
  );

  assert.equal(result, 'credits');
  assert.deepEqual(actions, [{
    type: 'OPEN_PAYWALL',
    tab: 'ecommerce',
    reason: 'INSUFFICIENT_CREDITS',
    pendingAction: { source: 'test-flow', message: '保留当前配置' },
  }]);
});

test('maps beta access failures to the login modal without changing form state', () => {
  const actions = [];
  const result = handleGenerationAccessError({ status: 403 }, action => actions.push(action));

  assert.equal(result, 'login');
  assert.deepEqual(actions, [{ type: 'SHOW_LOGIN', show: true }]);
});
