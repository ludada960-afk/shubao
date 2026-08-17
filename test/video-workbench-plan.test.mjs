import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVideoWorkbenchPlan } from '../server/videoWorkbenchPlan.mjs';

function workbench(overrides = {}) {
  return {
    project: { id: 'project-1', kind: 'video' },
    assets: [],
    shots: [],
    timelineClips: [],
    audioTracks: [],
    ...overrides,
  };
}

function asset(id, kind = 'product', approvedVersionId = `${id}-v1`) {
  return { id, kind, status: approvedVersionId ? 'approved' : 'draft', approvedVersionId };
}

function shot(id, position, overrides = {}) {
  return {
    id,
    position,
    status: 'draft',
    durationMs: 6000,
    purpose: `镜头 ${position}`,
    prompt: `展示镜头 ${position}`,
    bindings: [{ assetId: 'product-1', assetVersionId: 'product-1-v1', role: 'product' }],
    candidates: [],
    ...overrides,
  };
}

test('returns actionable blockers and zero quote for an empty workbench', () => {
  const plan = buildVideoWorkbenchPlan(workbench());
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.quote.points, 0);
  assert.deepEqual(plan.blockers.map(item => item.code), ['NO_SHOTS']);
});

test('marks missing prompt, stale shot and unapproved binding without charging', () => {
  const plan = buildVideoWorkbenchPlan(workbench({
    assets: [asset('product-1', 'product', null)],
    shots: [
      shot('shot-1', 1, { prompt: '' }),
      shot('shot-2', 2, { status: 'stale', bindings: [] }),
    ],
  }));
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.quote.points, 0);
  assert.deepEqual(plan.blockers.map(item => item.code).sort(), [
    'ASSET_NOT_APPROVED', 'SHOT_PROMPT_MISSING', 'SHOT_STALE', 'SHOT_BINDING_MISSING',
  ].sort());
});

test('builds a bounded per-shot quote for a valid three-shot plan', () => {
  const plan = buildVideoWorkbenchPlan(workbench({
    assets: [asset('product-1')],
    shots: [shot('shot-1', 1), shot('shot-2', 2, { durationMs: 9000 }), shot('shot-3', 3, { durationMs: 15000 })],
  }));
  assert.equal(plan.status, 'ready');
  assert.equal(plan.shots.length, 3);
  assert.equal(plan.totalDurationMs, 30000);
  assert.equal(plan.quote.catalogVersion, 'video-products-2026-08-12-v3');
  assert.equal(plan.quote.points, 206);
  assert.equal(plan.quote.maximumPoints, 206);
  assert.ok(plan.quote.lineItems.every(item => item.points > 0));
});

test('uses requested public product and rejects invalid planning options', () => {
  const valid = buildVideoWorkbenchPlan(workbench({ assets: [asset('product-1')], shots: [shot('shot-1', 1)] }), {
    productId: 'seedance_fast',
    mode: 'frame',
    resolution: '720p',
    generateAudio: false,
  });
  assert.equal(valid.status, 'ready');
  assert.equal(valid.quote.lineItems[0].productId, 'seedance_fast');
  const hidden = buildVideoWorkbenchPlan(workbench({ assets: [asset('product-1')], shots: [shot('shot-1', 1)] }), {
    productId: 'minimax_h3_2k', resolution: '2k', mode: 'frame', generateAudio: true,
  });
  assert.equal(hidden.status, 'blocked');
  assert.equal(hidden.blockers[0].code, 'PRODUCT_OPTIONS_INVALID');
});
