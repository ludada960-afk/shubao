import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBoundedRequestLifecycle,
  requestFailureMessage,
} from '../src/services/requestLifecycle.js';

test('bounded request lifecycle aborts at its deadline and reports an actionable timeout', () => {
  const timerToken = { id: 'request-deadline' };
  let scheduledMs = 0;
  let deadlineCallback;
  let clearedToken;
  const lifecycle = createBoundedRequestLifecycle({
    timeoutMs: 75_000,
    timeoutMessage: '图片分析超时，请重试',
    setTimeoutImpl(callback, milliseconds) {
      deadlineCallback = callback;
      scheduledMs = milliseconds;
      return timerToken;
    },
    clearTimeoutImpl(token) {
      clearedToken = token;
    },
  });

  assert.equal(lifecycle.signal.aborted, false);
  assert.equal(scheduledMs, 75_000);
  deadlineCallback();

  assert.equal(lifecycle.signal.aborted, true);
  assert.equal(lifecycle.didTimeout(), true);
  assert.equal(requestFailureMessage(new Error('network failed'), lifecycle), '图片分析超时，请重试');
  lifecycle.cleanup();
  assert.equal(clearedToken, timerToken);
});

test('manual bounded request cancellation is silent and distinct from a timeout', () => {
  const lifecycle = createBoundedRequestLifecycle({
    timeoutMs: 75_000,
    setTimeoutImpl() { return { id: 'manual-cancel' }; },
    clearTimeoutImpl() {},
  });

  lifecycle.cancel();

  assert.equal(lifecycle.signal.aborted, true);
  assert.equal(lifecycle.didTimeout(), false);
  assert.equal(requestFailureMessage(lifecycle.signal.reason, lifecycle), '');
});
