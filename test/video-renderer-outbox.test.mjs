import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertVideoRendererOutboxIntegrity,
  cancelVideoRendererOutboxEvent,
  claimVideoRendererOutboxEvent,
  completeVideoRendererOutboxEvent,
  createVideoRendererOutboxEvent,
  failVideoRendererOutboxEvent,
  recoverExpiredVideoRendererOutboxEvent,
  renewVideoRendererOutboxLease,
} from '../server/videoRendererOutbox.mjs';
import {
  buildVideoRendererRequest,
} from '../server/videoRendererAdapter.mjs';
import { claimVideoExportJob, createVideoExportJob } from '../server/videoExportJob.mjs';
import { videoExportManifestHash } from '../server/videoExportManifest.mjs';

const manifestPayload = {
  schemaVersion: 1,
  kind: 'video-export-manifest',
  options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false, title: '测试短片' },
  timeline: { durationMs: 4000, clips: [{ id: 'clip-1', durationMs: 4000 }] },
  audio: { includeAudio: false, tracks: [] },
  delivery: { status: 'manifest_ready', renderer: 'external-worker', providerSubmission: false, billingMutation: false },
};
const manifest = { ...manifestPayload, manifestHash: videoExportManifestHash(manifestPayload) };

function request() {
  const created = createVideoExportJob({
    id: 'export-job-1', ownerEmail: 'owner@example.com', projectId: 'project-1', manifestId: 'manifest-1',
    manifest, createdAt: '2026-08-18T08:00:00.000Z',
  });
  const claimed = claimVideoExportJob(created, {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  return buildVideoRendererRequest({ job: claimed, manifest, now: claimed.updatedAt });
}

test('creates a hashed, provider-neutral renderer outbox event', () => {
  const event = createVideoRendererOutboxEvent({
    id: 'export-job-1:attempt:1', request: request(), createdAt: '2026-08-18T08:01:00.000Z',
  });
  assert.equal(event.state, 'pending');
  assert.equal(event.eventType, 'renderer.submit.requested');
  assert.equal(event.attempts, 0);
  assert.equal(event.requestHash, event.payload.requestHash);
  assert.equal(event.providerSubmission, false);
  assert.equal(event.billingMutation, false);
  assert.equal(assertVideoRendererOutboxIntegrity(event), true);
});

test('guards outbox ownership, lease expiry, retry and terminal transitions', () => {
  const initial = createVideoRendererOutboxEvent({
    id: 'export-job-1:attempt:1', request: request(), createdAt: '2026-08-18T08:01:00.000Z',
  });
  const claimed = claimVideoRendererOutboxEvent(initial, {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  assert.equal(claimed.state, 'processing');
  assert.equal(claimed.attempts, 1);
  assert.throws(() => renewVideoRendererOutboxLease(claimed, {
    workerId: 'worker-b', leaseToken: 'lease-a', now: '2026-08-18T08:01:02.000Z',
  }), error => error.code === 'RENDER_OUTBOX_LEASE_LOST');
  const renewed = renewVideoRendererOutboxLease(claimed, {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 30_000,
    now: '2026-08-18T08:01:05.000Z',
  });
  const failed = failVideoRendererOutboxEvent(renewed, {
    workerId: 'worker-a', leaseToken: 'lease-a', now: '2026-08-18T08:01:10.000Z',
    errorCode: 'RENDERER_TIMEOUT', errorMessage: 'renderer timeout', retryAt: '2026-08-18T08:02:00.000Z',
  });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.lastErrorCode, 'RENDERER_TIMEOUT');
  assert.equal(failed.leaseToken, '');
  const retry = claimVideoRendererOutboxEvent(failed, {
    workerId: 'worker-a', leaseToken: 'lease-b', leaseMs: 30_000,
    now: '2026-08-18T08:02:01.000Z',
  });
  const completed = completeVideoRendererOutboxEvent(retry, {
    workerId: 'worker-a', leaseToken: 'lease-b', now: '2026-08-18T08:02:05.000Z',
  });
  assert.equal(completed.state, 'completed');
  assert.throws(() => claimVideoRendererOutboxEvent(completed, {
    workerId: 'worker-c', leaseToken: 'lease-c', now: '2026-08-18T08:02:06.000Z',
  }), error => error.code === 'RENDER_OUTBOX_INVALID_TRANSITION');
});

test('can cancel a pending event without provider or billing mutation', () => {
  const initial = createVideoRendererOutboxEvent({
    id: 'export-job-1:attempt:1', request: request(), createdAt: '2026-08-18T08:01:00.000Z',
  });
  const canceled = cancelVideoRendererOutboxEvent(initial, {
    now: '2026-08-18T08:01:10.000Z', errorCode: 'EXPORT_CANCELED', errorMessage: '用户取消',
  });
  assert.equal(canceled.state, 'canceled');
  assert.equal(canceled.providerSubmission, false);
  assert.equal(canceled.billingMutation, false);
  assert.equal(assertVideoRendererOutboxIntegrity(canceled), true);
});

test('recovers an expired processing outbox lease without the dead worker credentials', () => {
  const initial = createVideoRendererOutboxEvent({
    id: 'export-job-1:attempt:1', request: request(), createdAt: '2026-08-18T08:01:00.000Z',
  });
  const processing = claimVideoRendererOutboxEvent(initial, {
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 1_000,
    now: '2026-08-18T08:01:00.000Z',
  });
  const recovered = recoverExpiredVideoRendererOutboxEvent(processing, {
    now: '2026-08-18T08:01:02.000Z',
  });
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.lastErrorCode, 'RENDER_OUTBOX_LEASE_EXPIRED');
  assert.equal(recovered.workerId, '');
  assert.equal(recovered.leaseToken, '');
  assert.equal(recovered.leaseExpiresAt, '');
  assert.doesNotThrow(() => assertVideoRendererOutboxIntegrity(recovered));
});
