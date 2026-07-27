import test from 'node:test';
import assert from 'node:assert/strict';

import { createOneShotBilling } from '../server/billing/oneShotBilling.mjs';

function makeDeps({ insufficient = false, workFails = false } = {}) {
  const calls = [];
  const actions = new Map();
  return {
    calls,
    actionStore: {
      get(ownerEmail, actionId) { return actions.get(`${ownerEmail}:${actionId}`) || null; },
      save(ownerEmail, actionId, value) {
        actions.set(`${ownerEmail}:${actionId}`, structuredClone(value));
        return value;
      },
    },
    walletService: {
      getBalance: () => ({ availableUnits: 3000, unlimited: false }),
      createHold(input) {
        calls.push(['hold', input]);
        if (insufficient) throw Object.assign(new Error('余额不足'), { code: 'BILLING_INSUFFICIENT_CREDITS' });
        return { id: 'hold-1', status: 'held', items: [{ key: 'canvas_action', status: 'held' }] };
      },
      settleItem(...input) {
        calls.push(['settle', input]);
        return { status: 'settled', balance: { availableUnits: 2000, unlimited: false } };
      },
      releaseItem(...input) { calls.push(['release', input]); return { status: 'released' }; },
    },
    quoteService: {
      verify: input => ({ ...input.expectedQuote, quoteId: input.quoteId, expiresAt: '2099-01-01T00:00:00.000Z' }),
    },
    work: async () => {
      if (workFails) throw Object.assign(new Error('上游失败'), { status: 503, code: 'UPSTREAM_FAILED' });
      return { url: '/api/generated-assets/canvas-result.png' };
    },
  };
}

test('one-shot canvas billing holds then settles only after a stable result', async () => {
  const deps = makeDeps();
  const billing = createOneShotBilling(deps);
  const output = await billing.execute({
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-1',
    sku: 'ec_image_2k', referenceType: 'canvas_image', work: deps.work,
  });
  assert.equal(output.result.url, '/api/generated-assets/canvas-result.png');
  assert.deepEqual(output.billing, { currency: 'ec_points', status: 'settled', balance: 2000, unlimited: false });
  assert.equal(deps.calls[0][0], 'hold');
  assert.equal(deps.calls[1][0], 'settle');
  assert.equal(deps.calls.some(([type]) => type === 'release'), false);
});

test('one-shot canvas billing replays a settled stable result without rerunning work', async () => {
  const deps = makeDeps();
  const billing = createOneShotBilling(deps);
  let workCalls = 0;
  const request = {
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-replay',
    sku: 'ec_image_2k', referenceType: 'canvas_image',
    work: async () => {
      workCalls += 1;
      return { url: '/api/generated-assets/replayed-canvas.png' };
    },
  };

  const first = await billing.execute(request);
  const replay = await billing.execute(request);

  assert.equal(first.result.url, '/api/generated-assets/replayed-canvas.png');
  assert.deepEqual(replay, { ...first, replay: true });
  assert.equal(workCalls, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'hold').length, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'settle').length, 1);
});

test('one-shot canvas billing returns an actionable 402 and releases failed work', async () => {
  const insufficient = makeDeps({ insufficient: true });
  const billing = createOneShotBilling(insufficient);
  await assert.rejects(() => billing.execute({ ownerEmail: 'creator@example.com', quoteId: 'quote', actionId: 'action', sku: 'ec_image_2k', work: insufficient.work }), error => (
    error.status === 402 && error.code === 'BILLING_INSUFFICIENT_CREDITS' && error.required === 1000
  ));

  const failed = makeDeps({ workFails: true });
  const failedBilling = createOneShotBilling(failed);
  await assert.rejects(() => failedBilling.execute({ ownerEmail: 'creator@example.com', quoteId: 'quote', actionId: 'action', sku: 'ec_image_2k', work: failed.work }), /上游失败/);
  assert.equal(failed.calls.some(([type]) => type === 'release'), true);
  assert.equal(failed.calls.some(([type]) => type === 'settle'), false);
});
