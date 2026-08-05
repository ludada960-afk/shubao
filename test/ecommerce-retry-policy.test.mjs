import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEcommerceAutoRepairDecision,
  shouldAutoRepairEcommerceTask,
} from '../src/services/ecommerceRetryPolicy.js';

test('automatic suite repair is allowed only for a small partial failure', () => {
  const decision = getEcommerceAutoRepairDecision({
    assets: [
      { assetId: 'main-1', status: 'completed', stableUrl: '/main.png' },
      { assetId: 'detail-1', status: 'needs_review', previewUrl: '/detail.png' },
    ],
  });

  assert.deepEqual(decision, {
    allowed: true,
    reason: 'partial_failure',
    deliveredCount: 1,
    failedCount: 1,
  });
  assert.equal(shouldAutoRepairEcommerceTask(decision), true);
});

test('automatic suite repair stops when every asset failed', () => {
  const decision = getEcommerceAutoRepairDecision({
    assets: [
      { assetId: 'main-1', status: 'needs_review', previewUrl: '/main.png' },
      { assetId: 'detail-1', status: 'failed', error: 'provider failed' },
    ],
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'full_batch_failed');
  assert.equal(decision.deliveredCount, 0);
  assert.equal(decision.failedCount, 2);
  assert.equal(shouldAutoRepairEcommerceTask(decision), false);
});

test('automatic suite repair stops when more than two assets failed', () => {
  const decision = getEcommerceAutoRepairDecision({
    assets: [
      { assetId: 'main-1', status: 'completed', stableUrl: '/main.png' },
      { assetId: 'detail-1', status: 'failed' },
      { assetId: 'detail-2', status: 'needs_review' },
      { assetId: 'detail-3', status: 'failed' },
    ],
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'too_many_failed_assets');
  assert.equal(decision.deliveredCount, 1);
  assert.equal(decision.failedCount, 3);
});

test('output images count as delivered only when their asset is not failed', () => {
  const partial = getEcommerceAutoRepairDecision({
    output: { images: { 'main-1': '/main.png' } },
    assets: [{ assetId: 'detail-1', status: 'needs_review' }],
  });
  assert.equal(partial.allowed, true);
  assert.equal(partial.deliveredCount, 1);

  const failed = getEcommerceAutoRepairDecision({
    output: { images: { 'main-1': '/main.png' } },
    assets: [{ assetId: 'main-1', status: 'needs_review' }],
  });
  assert.equal(failed.allowed, false);
  assert.equal(failed.reason, 'full_batch_failed');
});
