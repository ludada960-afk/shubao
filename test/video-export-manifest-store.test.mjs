import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import { assertVideoRendererOutboxIntegrity } from '../server/videoRendererOutbox.mjs';

const OWNER = 'export-owner@example.com';

function harness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const now = () => new Date('2026-08-18T08:00:00.000Z');
  const randomUUID = () => `export-${++sequence}`;
  const projectStore = createProjectStore(db, { now, randomUUID });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
  const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '导出测试' });
  return { db, store, project };
}

function seedWorkbench(store, projectId) {
  const videoAsset = store.createAsset({ ownerEmail: OWNER, projectId, kind: 'product', name: '视频' });
  const videoVersion = store.addAssetVersion({ ownerEmail: OWNER, projectId, assetId: videoAsset.id,
    stableUrl: '/api/video/assets/video', contentHash: 'video-hash', mimeType: 'video/mp4' });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId, assetId: videoAsset.id,
    versionId: videoVersion.id, expectedRevision: videoAsset.revision });
  const shot = store.createShot({ ownerEmail: OWNER, projectId, position: 0,
    purpose: '产品亮相', durationMs: 4000, prompt: '稳定镜头' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    outputAssetId: videoAsset.id, stableUrl: '/api/video/assets/video', contentHash: 'video-hash', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: shot.revision });
  store.addTimelineClip({ ownerEmail: OWNER, projectId, shotId: shot.id, candidateId: candidate.id,
    position: 0, trimStartMs: 0, trimEndMs: 4000 });
  return { videoAsset, videoVersion, shot, candidate };
}

test('persists owner-scoped export manifests idempotently without billing tables', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedWorkbench(store, project.id);
  const first = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false } });
  assert.equal(first.replayed, false);
  assert.equal(first.manifest.delivery.providerSubmission, false);
  assert.equal(first.manifest.delivery.billingMutation, false);
  assert.equal(first.ownerEmail, undefined);
  assert.equal(first.manifest.ownerEmail, undefined);
  const replayed = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false } });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.id, first.id);
  assert.deepEqual(store.listExportManifests({ ownerEmail: OWNER, projectId: project.id }).map(item => item.id), [first.id]);
  assert.equal(store.getExportManifest({ ownerEmail: OWNER, projectId: project.id, manifestId: first.id }).id, first.id);
  assert.throws(() => store.getExportManifest({ ownerEmail: 'other@example.com', projectId: project.id, manifestId: first.id }),
    error => error.code === 'PROJECT_NOT_FOUND');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('video_jobs', 'wallet_transactions')").get().count, 0);
});

test('export manifest cannot be created from an empty timeline', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  assert.throws(() => store.createExportManifest({ ownerEmail: OWNER, projectId: project.id }),
    error => error.code === 'INVALID_VIDEO_EXPORT');
});

test('rejects a tampered persisted export manifest instead of returning it', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedWorkbench(store, project.id);
  const created = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { includeAudio: false } });
  db.prepare('UPDATE video_export_manifests SET manifest_json = ? WHERE id = ?').run(
    JSON.stringify({ ...created.manifest, options: { ...created.manifest.options, fps: 60 } }), created.id,
  );
  assert.throws(
    () => store.getExportManifest({ ownerEmail: OWNER, projectId: project.id, manifestId: created.id }),
    error => error.code === 'EXPORT_MANIFEST_INTEGRITY_INVALID',
  );
  assert.throws(
    () => store.listExportManifests({ ownerEmail: OWNER, projectId: project.id }),
    error => error.code === 'EXPORT_MANIFEST_INTEGRITY_INVALID',
  );
});

test('hands a current export manifest to a durable renderer job idempotently', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedWorkbench(store, project.id);
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false } });
  const created = store.createExportJob({ ownerEmail: OWNER, projectId: project.id, manifestId: manifest.id });
  assert.equal(created.replayed, false);
  assert.equal(created.state, 'waiting_renderer');
  assert.equal(created.providerSubmission, false);
  assert.equal(created.billingMutation, false);
  const replayed = store.createExportJob({ ownerEmail: OWNER, projectId: project.id, manifestId: manifest.id });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.id, created.id);
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id }).id, created.id);
  assert.deepEqual(store.listExportJobs({ ownerEmail: OWNER, projectId: project.id }).map(item => item.id), [created.id]);
  const rendering = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'rendering' });
  assert.equal(rendering.attempt, 1);
  const firstOutbox = db.prepare(`SELECT * FROM video_renderer_outbox
    WHERE job_id = ? AND request_id = ?`).get(created.id, `${created.id}:attempt:1`);
  assert.ok(firstOutbox);
  assert.equal(firstOutbox.state, 'pending');
  assert.equal(firstOutbox.provider_submission, 0);
  assert.equal(firstOutbox.billing_mutation, 0);
  const firstPayload = JSON.parse(firstOutbox.payload_json);
  assert.equal(firstPayload.jobHash, rendering.jobHash);
  assert.equal(firstPayload.ownerEmail, undefined);
  assert.equal(assertVideoRendererOutboxIntegrity({
    id: firstOutbox.id,
    eventType: firstOutbox.event_type,
    jobId: firstOutbox.job_id,
    projectId: firstOutbox.project_id,
    requestId: firstOutbox.request_id,
    requestHash: firstOutbox.request_hash,
    payload: firstPayload,
    state: firstOutbox.state,
    attempts: firstOutbox.attempts,
    nextAttemptAt: firstOutbox.next_attempt_at,
    workerId: firstOutbox.worker_id,
    leaseToken: firstOutbox.lease_token,
    leaseExpiresAt: firstOutbox.lease_expires_at,
    lastErrorCode: firstOutbox.last_error_code,
    lastError: firstOutbox.last_error,
    providerSubmission: Boolean(firstOutbox.provider_submission),
    billingMutation: Boolean(firstOutbox.billing_mutation),
    createdAt: firstOutbox.created_at,
    updatedAt: firstOutbox.updated_at,
    eventHash: firstOutbox.event_hash,
  }), true);
  const failed = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'failed', errorCode: 'RENDER_TIMEOUT', errorMessage: '超时' });
  assert.equal(failed.errorCode, 'RENDER_TIMEOUT');
  assert.equal(db.prepare('SELECT state FROM video_renderer_outbox WHERE id = ?').get(firstOutbox.id).state, 'failed');
  const retry = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'waiting_renderer' });
  assert.equal(retry.errorCode, '');
  const renderingAgain = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'rendering' });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_renderer_outbox WHERE job_id = ?').get(created.id).count, 2);
  const completed = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'completed', outputAssetId: 'video-output-1', outputUrl: '/video/output-1.mp4' });
  assert.equal(renderingAgain.attempt, 2);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.outputAssetId, 'video-output-1');
  assert.equal(db.prepare('SELECT state FROM video_renderer_outbox WHERE request_id = ?').get(`${created.id}:attempt:2`).state, 'completed');
  assert.throws(() => store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'rendering' }), error => error.code === 'EXPORT_JOB_INVALID_TRANSITION');
});

test('does not hand off a manifest after the timeline changes and rejects tampered jobs', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedWorkbench(store, project.id);
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { includeAudio: false } });
  const created = store.createExportJob({ ownerEmail: OWNER, projectId: project.id, manifestId: manifest.id });
  const clip = store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).timelineClips[0];
  store.updateTimelineClip({ ownerEmail: OWNER, projectId: project.id, clipId: clip.id,
    expectedRevision: clip.revision, patch: { trimEndMs: 3500 } });
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id }).state, 'waiting_renderer');
  assert.throws(() => store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'rendering' }), error => error.code === 'EXPORT_JOB_STALE');
  db.prepare('UPDATE video_export_jobs SET state = ? WHERE id = ?').run('rendering', created.id);
  assert.throws(() => store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id }),
    error => error.code === 'EXPORT_JOB_INTEGRITY_INVALID');
});

test('persists worker leases, rejects takeover, and recovers an expired job', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedWorkbench(store, project.id);
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId: project.id,
    options: { includeAudio: false, title: '租约测试' } });
  const created = store.createExportJob({ ownerEmail: OWNER, projectId: project.id, manifestId: manifest.id });
  const claimed = store.claimExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    workerId: 'worker-a', leaseToken: 'lease-a', leaseMs: 1_000 });
  assert.equal(claimed.state, 'rendering');
  assert.equal(claimed.workerId, 'worker-a');
  assert.equal(claimed.leaseToken, 'lease-a');
  const claimedOutbox = db.prepare('SELECT * FROM video_renderer_outbox WHERE request_id = ?').get(`${created.id}:attempt:1`);
  assert.ok(claimedOutbox);
  assert.equal(claimedOutbox.state, 'processing');
  assert.equal(claimedOutbox.worker_id, 'worker-a');
  assert.equal(claimedOutbox.lease_token, 'lease-a');
  assert.equal(claimedOutbox.attempts, 1);
  assert.equal(JSON.parse(claimedOutbox.payload_json).jobHash, claimed.jobHash);
  assert.throws(() => store.claimExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    workerId: 'worker-b', leaseToken: 'lease-b' }), error => error.code === 'EXPORT_JOB_LEASE_BUSY');
  assert.throws(() => store.renewExportJobLease({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    workerId: 'worker-b', leaseToken: 'lease-a' }), error => error.code === 'EXPORT_JOB_LEASE_LOST');
  const recovered = store.recoverExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    now: '2026-08-18T08:00:01.000Z' });
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.errorCode, 'EXPORT_JOB_LEASE_EXPIRED');
  assert.equal(recovered.leaseToken, '');
  const retry = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    nextState: 'waiting_renderer' });
  assert.equal(retry.state, 'waiting_renderer');
  const reclaimed = store.claimExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    workerId: 'worker-b', leaseToken: 'lease-b', leaseMs: 30_000 });
  assert.equal(reclaimed.attempt, 2);
  const renewed = store.renewExportJobLease({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    workerId: 'worker-b', leaseToken: 'lease-b', leaseMs: 30_000 });
  assert.equal(renewed.leaseToken, 'lease-b');
  const renewedOutbox = db.prepare('SELECT * FROM video_renderer_outbox WHERE request_id = ?').get(`${created.id}:attempt:2`);
  assert.equal(renewedOutbox.state, 'processing');
  assert.equal(renewedOutbox.worker_id, 'worker-b');
  assert.equal(renewedOutbox.lease_token, 'lease-b');
  const completed = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: created.id,
    nextState: 'completed', workerId: 'worker-b', leaseToken: 'lease-b',
    outputAssetId: 'asset-output', outputUrl: '/video/output.mp4' });
  assert.equal(completed.state, 'completed');
  assert.equal(completed.workerId, '');
  assert.equal(completed.providerSubmission, false);
  assert.equal(completed.billingMutation, false);
  assert.equal(db.prepare('SELECT state FROM video_renderer_outbox WHERE request_id = ?').get(`${created.id}:attempt:1`).state, 'failed');
  assert.equal(db.prepare('SELECT state FROM video_renderer_outbox WHERE request_id = ?').get(`${created.id}:attempt:2`).state, 'completed');
  const columns = db.prepare('PRAGMA table_info(video_export_jobs)').all().map(column => column.name);
  assert.deepEqual(columns.filter(column => ['worker_id', 'lease_token', 'lease_expires_at'].includes(column)),
    ['worker_id', 'lease_token', 'lease_expires_at']);
});

test('adds renderer lease columns when opening a legacy export-job table', t => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  db.exec(`CREATE TABLE video_export_jobs (
    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
    manifest_id TEXT NOT NULL, manifest_hash TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'waiting_renderer', attempt INTEGER NOT NULL DEFAULT 0,
    renderer TEXT NOT NULL DEFAULT 'external-worker',
    provider_submission INTEGER NOT NULL DEFAULT 0, billing_mutation INTEGER NOT NULL DEFAULT 0,
    output_asset_id TEXT NOT NULL DEFAULT '', output_url TEXT NOT NULL DEFAULT '',
    error_code TEXT NOT NULL DEFAULT '', error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT '', completed_at TEXT NOT NULL DEFAULT '',
    canceled_at TEXT NOT NULL DEFAULT '', job_hash TEXT NOT NULL
  )`);
  const now = () => new Date('2026-08-18T08:00:00.000Z');
  const projectStore = createProjectStore(db, { now, randomUUID: () => 'legacy-project' });
  createVideoWorkbenchStore({ db, projectStore, now, randomUUID: () => 'legacy-id' });
  t.after(() => db.close());
  const columns = db.prepare('PRAGMA table_info(video_export_jobs)').all().map(column => column.name);
  assert.ok(columns.includes('worker_id'));
  assert.ok(columns.includes('lease_token'));
  assert.ok(columns.includes('lease_expires_at'));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'video_renderer_outbox'").get().count, 1);
});
