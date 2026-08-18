import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

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
  const failed = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'failed', errorCode: 'RENDER_TIMEOUT', errorMessage: '超时' });
  assert.equal(failed.errorCode, 'RENDER_TIMEOUT');
  const retry = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'waiting_renderer' });
  assert.equal(retry.errorCode, '');
  const renderingAgain = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'rendering' });
  const completed = store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id,
    jobId: created.id, nextState: 'completed', outputAssetId: 'video-output-1', outputUrl: '/video/output-1.mp4' });
  assert.equal(renderingAgain.attempt, 2);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.outputAssetId, 'video-output-1');
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
