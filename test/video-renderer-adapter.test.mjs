import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertVideoRendererRequestIntegrity,
  buildVideoRendererRequest,
  createVideoRendererAdapter,
} from '../server/videoRendererAdapter.mjs';
import {
  claimVideoExportJob,
  createVideoExportJob,
} from '../server/videoExportJob.mjs';
import { videoExportManifestHash } from '../server/videoExportManifest.mjs';
import { buildVideoRendererPreflight } from '../server/videoRendererPreflight.mjs';

const manifestPayload = {
  schemaVersion: 1,
  kind: 'video-export-manifest',
  options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false, title: '测试短片' },
  timeline: {
    durationMs: 4000,
    clips: [{
      id: 'clip-1', position: 0, shotId: 'shot-1', purpose: '产品亮相', candidateId: 'candidate-1',
      trimStartMs: 0, trimEndMs: 4000, durationMs: 4000, muted: false,
      candidate: { outputAssetId: 'asset-1', contentHash: 'video-hash', mimeType: 'video/mp4' },
    }],
  },
  audio: { includeAudio: false, tracks: [] },
  delivery: { status: 'manifest_ready', renderer: 'external-worker', providerSubmission: false, billingMutation: false },
};
const manifest = { ...manifestPayload, manifestHash: videoExportManifestHash(manifestPayload) };

const preflight = buildVideoRendererPreflight({
  plan: {
    status: 'ready',
    options: { productId: 'seedance_standard', mode: 'smart', resolution: '720p', generateAudio: false },
    shots: [{ id: 'shot-1', durationMs: 4000 }], totalDurationMs: 4000, quote: { points: 62 },
  },
  workbench: {
    assets: [{ id: 'scene-1', kind: 'scene' }],
    shots: [{ id: 'shot-1', bindings: [{ assetId: 'scene-1', assetVersionId: 'scene-v1' }] }],
  },
  rightsConfirmations: [{ assetId: 'scene-1', assetVersionId: 'scene-v1', confirmed: true }],
  moderation: { status: 'passed', policyVersion: 'video-safe-v1', checkedAt: '2026-08-18T08:00:00.000Z' },
  storage: { durable: true, target: 'durable', contentType: 'video/mp4', maxBytes: 50_000_000, uploadStrategy: 'multipart' },
  budgetCapPoints: 100,
  enforce: true,
});

function job() {
  return createVideoExportJob({
    id: 'export-job-1', ownerEmail: 'owner@example.com', projectId: 'project-1', manifestId: 'manifest-1',
    manifest, createdAt: '2026-08-18T08:00:00.000Z',
  });
}

function preflightJob() {
  return createVideoExportJob({
    id: 'export-job-preflight', ownerEmail: 'owner@example.com', projectId: 'project-1', manifestId: 'manifest-1',
    manifest, preflight, createdAt: '2026-08-18T08:00:00.000Z',
  });
}

test('builds a provider-neutral request from a leased export job with stable idempotency', () => {
  const claimed = claimVideoExportJob(job(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest, now: claimed.updatedAt });
  assert.equal(request.kind, 'video-render-request');
  assert.equal(request.requestId, 'export-job-1:attempt:1');
  assert.equal(request.idempotencyKey, request.requestId);
  assert.equal(request.jobHash, claimed.jobHash);
  assert.equal(request.manifestHash, manifest.manifestHash);
  assert.equal(request.providerSubmission, false);
  assert.equal(request.billingMutation, false);
  assert.equal(request.ownerEmail, undefined);
  assert.equal(request.timeline.clips[0].candidate.outputAssetId, 'asset-1');
  assert.equal(assertVideoRendererRequestIntegrity(request), true);
});

test('carries the strict preflight hash into the provider-neutral renderer request', () => {
  const claimed = claimVideoExportJob(preflightJob(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest, now: claimed.updatedAt });
  assert.equal(request.preflightHash, preflight.preflightHash);
  assert.equal(request.preflightStatus, 'ready');
  assert.deepEqual(request.budgetPolicy, {
    currency: 'ai_points',
    estimatedPoints: 62,
    maximumPoints: 62,
    requestedCapPoints: 100,
    withinCap: true,
  });
  assert.equal(assertVideoRendererRequestIntegrity(request), true);
});

test('rejects a forged budget attestation without a matching request hash', () => {
  const claimed = claimVideoExportJob(preflightJob(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest, now: claimed.updatedAt });
  assert.throws(() => assertVideoRendererRequestIntegrity({
    ...request,
    budgetPolicy: { ...request.budgetPolicy, requestedCapPoints: 1 },
  }), error => error.code === 'RENDER_REQUEST_INTEGRITY_INVALID');
});

test('fails closed for stale manifests and forged renderer requests', () => {
  const claimed = claimVideoExportJob(job(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest });
  assert.throws(() => buildVideoRendererRequest({
    job: claimed,
    manifest: { ...manifest, manifestHash: '0'.repeat(64) },
  }), error => error.code === 'RENDER_REQUEST_STALE');
  assert.throws(() => assertVideoRendererRequestIntegrity({ ...request, idempotencyKey: 'forged' }),
    error => error.code === 'RENDER_REQUEST_INTEGRITY_INVALID');
  assert.throws(() => assertVideoRendererRequestIntegrity({ ...request, billingMutation: true }),
    error => error.code === 'RENDER_REQUEST_INTEGRITY_INVALID');
});

test('adapter remains provider-neutral until an explicit submit implementation is supplied', async () => {
  const claimed = claimVideoExportJob(job(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest });
  const adapter = createVideoRendererAdapter({ name: 'test-renderer' });
  assert.equal(adapter.name, 'test-renderer');
  await assert.rejects(() => adapter.submit(request), error => error.code === 'RENDERER_NOT_CONFIGURED');
  const accepted = createVideoRendererAdapter({
    name: 'fake-renderer',
    submit: async input => ({ externalJobId: `external-${input.requestId}`, status: 'accepted' }),
  });
  const response = await accepted.submit(request);
  assert.deepEqual(response, {
    externalJobId: 'external-export-job-1:attempt:1',
    status: 'accepted',
    requestId: request.requestId,
    requestHash: request.requestHash,
  });
});

test('adapter rejects a provider submit callback that carries a mismatched request identity', async () => {
  const claimed = claimVideoExportJob(job(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest });
  const adapter = createVideoRendererAdapter({
    name: 'forged-renderer',
    submit: async () => ({
      externalJobId: 'remote-forged',
      status: 'queued',
      requestId: 'other-job:attempt:1',
      requestHash: 'f'.repeat(64),
    }),
  });
  await assert.rejects(
    adapter.submit(request),
    error => error.code === 'RENDERER_RESPONSE_INVALID',
  );
});

function preflightRequest() {
  const claimed = claimVideoExportJob(preflightJob(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  return buildVideoRendererRequest({ job: claimed, manifest, now: claimed.updatedAt });
}

test('settlement usage within the attested budget passes through the adapter', async () => {
  const request = preflightRequest();
  const adapter = createVideoRendererAdapter({
    name: 'settling-renderer',
    submit: async () => ({ externalJobId: 'remote-ok', status: 'completed', usage: { points: 62 } }),
  });
  const settled = await adapter.submit(request);
  assert.deepEqual(settled.usage, { currency: 'ai_points', points: 62 });
});

test('settlement usage above the attested maximum fails closed', async () => {
  const request = preflightRequest();
  const adapter = createVideoRendererAdapter({
    name: 'over-budget-renderer',
    submit: async () => ({ externalJobId: 'remote-over', status: 'completed', usage: { points: 63 } }),
  });
  await assert.rejects(adapter.submit(request), error => error.code === 'RENDER_SETTLEMENT_BUDGET_EXCEEDED');
});

test('settlement usage must be a safe non-negative integer', async () => {
  const request = preflightRequest();
  for (const bad of [-1, 1.5, 'abc']) {
    const adapter = createVideoRendererAdapter({
      name: 'bad-usage-renderer',
      submit: async () => ({ externalJobId: 'remote-bad', status: 'completed', usage: { points: bad } }),
    });
    await assert.rejects(adapter.submit(request), error => error.code === 'RENDERER_RESPONSE_INVALID');
  }
});

test('a legal usage declaration is accepted even without a budget contract', async () => {
  const claimed = claimVideoExportJob(job(), {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const request = buildVideoRendererRequest({ job: claimed, manifest });
  const adapter = createVideoRendererAdapter({
    name: 'free-renderer',
    submit: async () => ({ externalJobId: 'remote-free', status: 'completed', usage: { points: 10 } }),
  });
  const settled = await adapter.submit(request);
  assert.deepEqual(settled.usage, { currency: 'ai_points', points: 10 });
});
