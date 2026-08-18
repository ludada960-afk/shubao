import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertVideoRendererPreflightIntegrity,
  buildVideoRendererPreflight,
  videoRendererPreflightPlanFingerprint,
} from '../server/videoRendererPreflight.mjs';

function fixture({ generateAudio = false, durationMs = 6000 } = {}) {
  const plan = {
    status: 'ready',
    options: {
      productId: 'seedance_standard',
      mode: 'smart',
      resolution: '720p',
      generateAudio,
    },
    shots: [{ id: 'shot-1', durationMs }],
    totalDurationMs: durationMs,
    quote: { points: 62 },
  };
  const workbench = {
    assets: [{ id: 'scene-1', kind: 'scene' }],
    shots: [{ id: 'shot-1', bindings: [{ assetId: 'scene-1', assetVersionId: 'scene-1-v1' }] }],
  };
  return { plan, workbench };
}

const strictControls = {
  rightsConfirmations: [{ assetId: 'scene-1', assetVersionId: 'scene-1-v1', confirmed: true }],
  moderation: { status: 'passed', policyVersion: 'video-safe-v1', checkedAt: '2026-08-18T08:00:00.000Z' },
  storage: { durable: true, target: 'durable', contentType: 'video/mp4', maxBytes: 50_000_000, uploadStrategy: 'multipart' },
  enforce: true,
};

test('strict preflight passes with approved governance and is deterministic', () => {
  const input = fixture();
  const first = buildVideoRendererPreflight({ ...input, ...strictControls });
  const second = buildVideoRendererPreflight({ ...input, ...strictControls });
  assert.equal(first.status, 'ready');
  assert.equal(first.blockers.length, 0);
  assert.equal(first.preflightHash, second.preflightHash);
  assert.equal(assertVideoRendererPreflightIntegrity(first), true);
  assert.equal(videoRendererPreflightPlanFingerprint(input.plan), videoRendererPreflightPlanFingerprint({ ...input.plan, generatedAt: 'later' }));
  assert.deepEqual(first.referenceStats, { images: 1, videos: 0, audios: 0, total: 1 });
  assert.equal(first.providerSubmission, false);
  assert.equal(first.billingMutation, false);
});

test('rejects a tampered strict preflight attestation before persistence', () => {
  const input = fixture();
  const result = buildVideoRendererPreflight({ ...input, ...strictControls });
  assert.throws(
    () => assertVideoRendererPreflightIntegrity({
      ...result,
      attestation: { ...result.attestation, governance: { ...result.attestation.governance, rights: [] } },
    }),
    error => error.code === 'RENDER_PREFLIGHT_INVALID',
  );
});

test('preflight blocks a resolution outside the provider capability snapshot', () => {
  const input = fixture();
  const result = buildVideoRendererPreflight({
    ...input,
    ...strictControls,
    capabilities: { resolutions: ['1080p'] },
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.some(item => item.code === 'CAPABILITY_RESOLUTION_UNSUPPORTED'));
});

test('strict preflight blocks missing rights confirmation without contacting a provider', () => {
  const input = fixture();
  const result = buildVideoRendererPreflight({
    ...input,
    enforce: true,
    requireModeration: false,
    requireStorage: false,
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.some(item => item.code === 'RIGHTS_CONFIRMATION_MISSING'));
  assert.equal(result.providerSubmission, false);
  assert.equal(result.billingMutation, false);
});

test('preflight blocks unsupported generated audio and budget overflow', () => {
  const input = fixture({ generateAudio: true });
  const result = buildVideoRendererPreflight({
    ...input,
    ...strictControls,
    capabilities: { generatedAudio: false },
    budgetCapPoints: 10,
  });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blockers.some(item => item.code === 'CAPABILITY_AUDIO_UNSUPPORTED'));
  assert.ok(result.blockers.some(item => item.code === 'BUDGET_CAP_EXCEEDED'));
});

test('advisory preflight reports missing governance without blocking a valid local plan', () => {
  const input = fixture();
  const result = buildVideoRendererPreflight(input);
  assert.equal(result.status, 'ready');
  assert.ok(result.warnings.some(message => message.includes('版权')));
  assert.ok(result.warnings.some(message => message.includes('审核')));
  assert.ok(result.warnings.some(message => message.includes('存储')));
});
