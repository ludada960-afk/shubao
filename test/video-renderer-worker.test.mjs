import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import { runVideoRendererWorkerOnce } from '../server/videoRendererWorker.mjs';

const OWNER = 'renderer-worker@example.com';
const NOW = '2026-08-18T08:00:00.000Z';

function makeHarness(dbPath = ':memory:') {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const now = () => new Date(NOW);
  const randomUUID = () => `renderer-worker-${++sequence}`;
  const projectStore = createProjectStore(db, { now, randomUUID });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
  const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '渲染 worker 测试' });
  return { db, store, project, projectStore, now, randomUUID };
}

function seedWorkbench(store, projectId) {
  const asset = store.createAsset({ ownerEmail: OWNER, projectId, kind: 'product', name: '产品视频' });
  const version = store.addAssetVersion({ ownerEmail: OWNER, projectId, assetId: asset.id,
    stableUrl: '/api/video/assets/product', contentHash: 'product-hash', mimeType: 'video/mp4' });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId, assetId: asset.id,
    versionId: version.id, expectedRevision: asset.revision });
  const shot = store.createShot({ ownerEmail: OWNER, projectId, position: 0,
    purpose: '产品亮相', durationMs: 4000, prompt: '镜头稳定，产品清晰' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    outputAssetId: asset.id, stableUrl: '/api/video/assets/product', contentHash: 'product-hash', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: shot.revision });
  store.addTimelineClip({ ownerEmail: OWNER, projectId, shotId: shot.id, candidateId: candidate.id,
    position: 0, trimStartMs: 0, trimEndMs: 4000 });
}

function createJob(store, projectId) {
  seedWorkbench(store, projectId);
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false } });
  return store.createExportJob({ ownerEmail: OWNER, projectId, manifestId: manifest.id });
}

function response(request, externalJobId, status, extra = {}) {
  return { externalJobId, status, requestId: request.requestId, requestHash: request.requestHash, ...extra };
}

test('persists a renderer attempt and completes it after a database restart', async t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shubao-video-renderer-'));
  const dbPath = path.join(tempDir, 'worker.sqlite');
  let firstDb;
  let secondDb;
  let projectId;
  let requestIds = [];
  try {
    const first = makeHarness(dbPath);
    firstDb = first.db;
    projectId = first.project.id;
    const job = createJob(first.store, projectId);
    const firstAdapter = {
      submit: async request => {
        requestIds.push(request.requestId);
        return response(request, 'provider-job-1', 'queued');
      },
    };
    const running = await runVideoRendererWorkerOnce({
      store: first.store, ownerEmail: OWNER, projectId, jobId: job.id,
      adapter: firstAdapter, workerId: 'worker-a', leaseToken: 'lease-a',
      now: NOW,
    });
    assert.equal(running.job.state, 'rendering');
    assert.equal(running.event.state, 'processing');
    assert.equal(running.event.attempts, 1);
    assert.equal(running.job.billingMutation, false);
    assert.equal(running.providerCalls, 1);
    firstDb.close();
    firstDb = null;

    secondDb = new Database(dbPath);
    secondDb.pragma('foreign_keys = ON');
    ensureProjectSchema(secondDb);
    const secondProjectStore = createProjectStore(secondDb, { now: () => new Date(NOW), randomUUID: () => 'restart-id' });
    const secondStore = createVideoWorkbenchStore({ db: secondDb, projectStore: secondProjectStore,
      now: () => new Date(NOW), randomUUID: () => 'restart-id' });
    const secondAdapter = {
      submit: async request => {
        requestIds.push(request.requestId);
        return response(request, 'provider-job-1', 'completed', {
          outputAssetId: 'rendered-1', outputUrl: '/video/rendered-1.mp4',
        });
      },
    };
    const completed = await runVideoRendererWorkerOnce({
      store: secondStore, ownerEmail: OWNER, projectId, jobId: job.id,
      adapter: secondAdapter, workerId: 'worker-a', leaseToken: 'lease-a',
      now: '2026-08-18T08:00:01.000Z',
    });
    assert.equal(completed.job.state, 'completed');
    assert.equal(completed.job.outputAssetId, 'rendered-1');
    assert.equal(completed.job.outputUrl, '/video/rendered-1.mp4');
    assert.equal(completed.event.state, 'completed');
    assert.equal(completed.event.attempts, 1);
    assert.deepEqual(requestIds, [`${job.id}:attempt:1`, `${job.id}:attempt:1`]);
    assert.equal(completed.job.providerSubmission, false);
    assert.equal(completed.job.billingMutation, false);
    assert.equal(secondDb.prepare('SELECT COUNT(*) AS count FROM video_renderer_outbox WHERE job_id = ?').get(job.id).count, 1);
  } finally {
    if (firstDb) firstDb.close();
    if (secondDb) secondDb.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('fails closed and records a controlled failure for a forged renderer callback', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id);
  await assert.rejects(
    runVideoRendererWorkerOnce({
      store, ownerEmail: OWNER, projectId: project.id, jobId: job.id,
      adapter: { submit: async request => ({ ...response(request, 'provider-job-forged', 'queued'), requestId: 'wrong' }) },
      workerId: 'worker-a', leaseToken: 'lease-a', now: NOW,
    }),
    error => error.code === 'RENDER_RECONCILIATION_INVALID',
  );
  const failed = store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.errorCode, 'RENDER_RECONCILIATION_INVALID');
  const outbox = db.prepare('SELECT state, last_error_code, provider_submission, billing_mutation FROM video_renderer_outbox WHERE job_id = ?').get(job.id);
  assert.equal(outbox.state, 'failed');
  assert.equal(outbox.last_error_code, 'RENDER_RECONCILIATION_INVALID');
  assert.equal(outbox.provider_submission, 0);
  assert.equal(outbox.billing_mutation, 0);
});

test('rejects a completed callback without output and marks the job as missing output', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id);
  await assert.rejects(
    runVideoRendererWorkerOnce({
      store, ownerEmail: OWNER, projectId: project.id, jobId: job.id,
      adapter: { submit: async request => response(request, 'provider-job-empty', 'completed') },
      workerId: 'worker-a', leaseToken: 'lease-a', now: NOW,
    }),
    error => error.code === 'EXPORT_JOB_OUTPUT_REQUIRED',
  );
  const failed = store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.errorCode, 'RENDERER_OUTPUT_MISSING');
  assert.equal(db.prepare('SELECT state FROM video_renderer_outbox WHERE job_id = ?').get(job.id).state, 'failed');
});
