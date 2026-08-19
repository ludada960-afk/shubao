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

test('carries structured director controls into each shot plan without provider work', () => {
  const plan = buildVideoWorkbenchPlan(workbench({
    assets: [asset('product-1')],
    shots: [shot('shot-1', 1, {
      cameraLanguage: '镜头从肩部滑向商品',
      direction: {
        shotScale: 'close',
        cameraAngle: 'low_angle',
        cameraMove: 'dolly_in',
        lighting: 'rim',
        primaryAction: '模特抬手展示材质',
        continuity: { axis: 'screen_left_to_right', gaze: 'toward_camera', transition: 'match_cut' },
        negativePrompt: '不要多余手指，不要漂浮物',
      },
    })],
  }));
  assert.equal(plan.status, 'ready');
  assert.deepEqual(plan.shots[0].direction, {
    shotScale: 'close',
    cameraAngle: 'low_angle',
    cameraMove: 'dolly_in',
    lighting: 'rim',
    primaryAction: '模特抬手展示材质',
    cameraLanguage: '镜头从肩部滑向商品',
    continuity: {
      axis: 'screen_left_to_right',
      gaze: 'toward_camera',
      screenDirection: 'stationary',
      transition: 'match_cut',
    },
    negativePrompt: '不要多余手指，不要漂浮物',
  });
});

test('surfaces non-blocking continuity review findings before generation', () => {
  const plan = buildVideoWorkbenchPlan(workbench({
    assets: [asset('product-1')],
    shots: [
      shot('shot-2', 2, {
        direction: {
          primaryAction: '',
          continuity: { axis: 'screen_right_to_left', screenDirection: 'right_to_left', transition: 'cut' },
        },
      }),
      shot('shot-1', 1, {
        direction: {
          primaryAction: '人物举起商品',
          continuity: { axis: 'screen_left_to_right', screenDirection: 'left_to_right', transition: 'cut' },
        },
      }),
    ],
  }));

  assert.equal(plan.status, 'ready');
  assert.equal(plan.continuityReview.status, 'review');
  assert.deepEqual(plan.continuityReview.issues.map(issue => issue.code).sort(), [
    'AXIS_REVERSAL_REVIEW',
    'SCREEN_DIRECTION_REVERSAL_REVIEW',
    'SHOT_PRIMARY_ACTION_MISSING',
  ].sort());
  assert.deepEqual(plan.continuityReview.issues.find(issue => issue.code === 'SHOT_PRIMARY_ACTION_MISSING').shotIds, ['shot-2']);
  assert.equal(plan.quote.points > 0, true);
});

test('keeps a clean continuity review when directions are neutral and actions are explicit', () => {
  const plan = buildVideoWorkbenchPlan(workbench({
    assets: [asset('product-1')],
    shots: [
      shot('shot-1', 1, { direction: { primaryAction: '商品停在画面中心' } }),
      shot('shot-2', 2, { direction: { primaryAction: '手部打开包装' } }),
    ],
  }));
  assert.equal(plan.continuityReview.status, 'clear');
  assert.deepEqual(plan.continuityReview.issues, []);
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

test('returns a structured blocker for an unknown product instead of throwing', () => {
  const plan = buildVideoWorkbenchPlan({ shots: [] }, { productId: 'missing-product' });
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.blockers[0].code, 'PRODUCT_OPTIONS_INVALID');
  assert.equal(plan.product.id, 'missing-product');
  assert.equal(plan.quote.points, 0);
});
