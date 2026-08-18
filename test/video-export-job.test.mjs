import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertVideoExportJobCurrent,
  assertVideoExportJobIntegrity,
  createVideoExportJob,
  transitionVideoExportJob,
} from '../server/videoExportJob.mjs';
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

function job() {
  return createVideoExportJob({
    id: 'export-job-1',
    ownerEmail: 'owner@example.com',
    projectId: 'project-1',
    manifestId: 'manifest-1',
    manifest,
    createdAt: '2026-08-18T08:00:00.000Z',
  });
}

test('creates a durable renderer handoff without provider or billing side effects', () => {
  const created = job();
  assert.equal(created.state, 'waiting_renderer');
  assert.equal(created.attempt, 0);
  assert.equal(created.renderer, 'external-worker');
  assert.equal(created.providerSubmission, false);
  assert.equal(created.billingMutation, false);
  assert.equal(created.outputAssetId, '');
  assert.equal(created.outputUrl, '');
  assert.equal(assertVideoExportJobIntegrity(created), true);
});

test('supports claim, failure, retry and completion with guarded transitions', () => {
  const claimed = transitionVideoExportJob(job(), 'rendering', { now: '2026-08-18T08:01:00.000Z' });
  assert.equal(claimed.attempt, 1);
  assert.equal(claimed.startedAt, '2026-08-18T08:01:00.000Z');

  const failed = transitionVideoExportJob(claimed, 'failed', {
    now: '2026-08-18T08:02:00.000Z', errorCode: 'RENDER_TIMEOUT', errorMessage: 'renderer timed out',
  });
  assert.equal(failed.errorCode, 'RENDER_TIMEOUT');
  const retry = transitionVideoExportJob(failed, 'waiting_renderer', { now: '2026-08-18T08:03:00.000Z' });
  assert.equal(retry.errorCode, '');
  const completed = transitionVideoExportJob(
    transitionVideoExportJob(retry, 'rendering', { now: '2026-08-18T08:04:00.000Z' }),
    'completed', { now: '2026-08-18T08:05:00.000Z', outputAssetId: 'asset-1', outputUrl: '/api/video/assets/asset-1' },
  );
  assert.equal(completed.attempt, 2);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.outputAssetId, 'asset-1');
  assert.equal(completed.completedAt, '2026-08-18T08:05:00.000Z');
  assert.throws(() => transitionVideoExportJob(completed, 'rendering'), error => error.code === 'EXPORT_JOB_INVALID_TRANSITION');
});

test('rejects malformed completion, forged job hashes and stale manifest handoffs', () => {
  const created = job();
  const claimed = transitionVideoExportJob(created, 'rendering', { now: '2026-08-18T08:01:00.000Z' });
  assert.throws(() => transitionVideoExportJob(claimed, 'completed'), error => error.code === 'EXPORT_JOB_OUTPUT_REQUIRED');
  assert.throws(() => assertVideoExportJobIntegrity({ ...created, state: 'rendering' }), error => error.code === 'EXPORT_JOB_INTEGRITY_INVALID');
  assert.throws(() => assertVideoExportJobCurrent(created, { manifestId: 'manifest-2', manifest }), error => error.code === 'EXPORT_JOB_STALE');
  const changedManifestPayload = { ...manifestPayload, timeline: { durationMs: 5000, clips: [{ id: 'clip-1', durationMs: 5000 }] } };
  const changedManifest = {
    ...changedManifestPayload,
    manifestHash: videoExportManifestHash(changedManifestPayload),
  };
  assert.throws(() => assertVideoExportJobCurrent(created, { manifestId: 'manifest-1', manifest: changedManifest }), error => error.code === 'EXPORT_JOB_STALE');
});
