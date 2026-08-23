import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import { runVideoRendererWorkerBatch } from '../server/videoRendererWorker.mjs';

const OWNER = 'renderer-batch@example.com';
const OTHER_OWNER = 'other-renderer-batch@example.com';
const NOW = '2026-08-18T08:00:00.000Z';

function makeHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    now: () => new Date(NOW),
    randomUUID: () => `renderer-batch-${++sequence}`,
  });
  const store = createVideoWorkbenchStore({
    db,
    projectStore,
    now: () => new Date(NOW),
    randomUUID: () => `renderer-batch-${++sequence}`,
  });
  const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '批处理测试' });
  return { db, store, project, projectStore };
}

function seedWorkbench(store, projectId, suffix) {
  const asset = store.createAsset({ ownerEmail: OWNER, projectId, kind: 'product', name: `产品视频-${suffix}` });
  const version = store.addAssetVersion({
    ownerEmail: OWNER,
    projectId,
    assetId: asset.id,
    stableUrl: `/api/video/assets/product-${suffix}`,
    contentHash: `product-hash-${suffix}`,
    mimeType: 'video/mp4',
  });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId, assetId: asset.id,
    versionId: version.id, expectedRevision: asset.revision });
  const shot = store.createShot({ ownerEmail: OWNER, projectId, position: suffix, purpose: `产品亮相-${suffix}`,
    durationMs: 4000, prompt: '镜头稳定，产品清晰' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    outputAssetId: asset.id, stableUrl: `/api/video/assets/product-${suffix}`,
    contentHash: `product-hash-${suffix}`, mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: shot.revision });
  store.addTimelineClip({ ownerEmail: OWNER, projectId, shotId: shot.id, candidateId: candidate.id,
    position: suffix, trimStartMs: 0, trimEndMs: 4000 });
}

function createJob(store, projectId, suffix) {
  seedWorkbench(store, projectId, suffix);
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false, title: `批处理-${suffix}` } });
  return store.createExportJob({ ownerEmail: OWNER, projectId, manifestId: manifest.id });
}

function createJobForCurrentWorkbench(store, projectId, suffix) {
  const manifest = store.createExportManifest({ ownerEmail: OWNER, projectId,
    options: { format: 'mp4', resolution: '720p', fps: 30, includeAudio: false, title: `批处理-${suffix}` } });
  return store.createExportJob({ ownerEmail: OWNER, projectId, manifestId: manifest.id });
}

function response(request, externalJobId, status, extra = {}) {
  return { externalJobId, status, requestId: request.requestId, requestHash: request.requestHash, ...extra };
}

test('processes a bounded batch sequentially and reports zero billing mutation', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  seedWorkbench(store, project.id, 0);
  seedWorkbench(store, project.id, 1);
  const first = createJobForCurrentWorkbench(store, project.id, 0);
  const second = createJobForCurrentWorkbench(store, project.id, 1);
  const calls = [];
  const tokens = [];
  const adapter = {
    submit: async request => {
      calls.push(request.requestId);
      return response(request, `provider-${calls.length}`, 'completed', {
        outputAssetId: `output-${calls.length}`,
        outputUrl: `/video/output-${calls.length}.mp4`,
      });
    },
  };

  const result = await runVideoRendererWorkerBatch({
    store,
    ownerEmail: OWNER,
    projectId: project.id,
    adapter,
    workerId: 'batch-worker',
    limit: 1,
    now: NOW,
    leaseTokenFactory: ({ job }) => {
      const token = `lease-${job.id}`;
      tokens.push(token);
      return token;
    },
  });

  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.providerCalls, 1);
  assert.equal(result.billingMutated, false);
  assert.equal(result.providerSubmission, false);
  assert.deepEqual(tokens, [`lease-${second.id}`]);
  assert.deepEqual(calls, [`${second.id}:attempt:1`]);
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: second.id }).state, 'completed');
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: first.id }).state, 'waiting_renderer');
});

test('fails closed before claiming when no renderer adapter is supplied', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id, 0);
  await assert.rejects(
    runVideoRendererWorkerBatch({ store, ownerEmail: OWNER, projectId: project.id, workerId: 'batch-worker', now: NOW }),
    error => error.code === 'RENDER_RECONCILIATION_INVALID',
  );
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id }).state, 'waiting_renderer');
});

test('does not implicitly retry failed jobs', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id, 0);
  const rendering = store.claimExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id,
    workerId: 'seed-worker', leaseToken: 'seed-lease', leaseMs: 30_000 });
  store.transitionExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id,
    nextState: 'failed', errorCode: 'RENDER_TIMEOUT', errorMessage: '超时',
    workerId: rendering.workerId, leaseToken: rendering.leaseToken });
  let providerCalls = 0;
  const result = await runVideoRendererWorkerBatch({
    store, ownerEmail: OWNER, projectId: project.id,
    workerId: 'batch-worker', adapter: { submit: async () => { providerCalls += 1; return {}; } }, now: NOW,
  });
  assert.equal(result.processed, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.skippedJobs[0].state, 'failed');
  assert.equal(providerCalls, 0);
  assert.equal(store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id }).state, 'failed');
});

test('keeps owner and project scope fail-closed before provider access', async t => {
  const { db, store, project, projectStore } = makeHarness();
  t.after(() => db.close());
  createJob(store, project.id, 0);
  const otherProject = projectStore.createProject({ ownerEmail: OTHER_OWNER, kind: 'video', title: '隔离项目' });
  let providerCalls = 0;
  await assert.rejects(
    runVideoRendererWorkerBatch({
      store, ownerEmail: OTHER_OWNER, projectId: project.id, workerId: 'batch-worker',
      adapter: { submit: async () => { providerCalls += 1; return {}; } }, now: NOW,
    }),
    error => error.code === 'PROJECT_NOT_FOUND',
  );
  assert.equal(providerCalls, 0);
  const isolated = await runVideoRendererWorkerBatch({
    store, ownerEmail: OTHER_OWNER, projectId: otherProject.id, workerId: 'batch-worker',
    adapter: { submit: async () => { providerCalls += 1; return {}; } }, now: NOW,
  });
  assert.equal(isolated.processed, 0);
  assert.equal(providerCalls, 0);
});

test('records adapter failure as a retryable job without billing mutation', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  const job = createJob(store, project.id, 0);
  let adapterCalls = 0;
  const result = await runVideoRendererWorkerBatch({
    store, ownerEmail: OWNER, projectId: project.id, workerId: 'batch-worker', now: NOW,
    adapter: { submit: async () => { adapterCalls += 1; throw new Error('upstream unavailable'); } },
  });
  assert.equal(result.processed, 1);
  assert.equal(result.providerCalls, 0);
  assert.equal(adapterCalls, 1);
  assert.equal(result.billingMutated, false);
  const failed = store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: job.id });
  assert.equal(failed.state, 'failed');
  assert.equal(failed.errorCode, 'RENDERER_SUBMIT_UNKNOWN');
  assert.equal(failed.providerSubmission, false);
  assert.equal(failed.billingMutation, false);
});

test('contains a lease token factory failure to one selected job', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  seedWorkbench(store, project.id, 0);
  seedWorkbench(store, project.id, 1);
  const first = createJobForCurrentWorkbench(store, project.id, 0);
  const second = createJobForCurrentWorkbench(store, project.id, 1);
  const result = await runVideoRendererWorkerBatch({
    store,
    ownerEmail: OWNER,
    projectId: project.id,
    workerId: 'batch-worker',
    limit: 2,
    now: NOW,
    leaseTokenFactory: ({ index }) => {
      if (index === 0) throw Object.assign(new Error('token source unavailable'), { code: 'TOKEN_SOURCE_DOWN' });
      return 'lease-second';
    },
    adapter: {
      submit: async request => response(request, 'provider-second', 'completed', {
        outputAssetId: 'output-second',
        outputUrl: '/video/output-second.mp4',
      }),
    },
  });
  assert.equal(result.processed, 2);
  assert.equal(result.results[0].errorCode, 'TOKEN_SOURCE_DOWN');
  assert.equal(result.results[0].providerSubmission, false);
  assert.equal(result.results[0].billingMutation, false);
  assert.equal(result.results[1].state, 'completed');
  const firstJob = store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: first.id });
  const secondJob = store.getExportJob({ ownerEmail: OWNER, projectId: project.id, jobId: second.id });
  assert.deepEqual(new Set([firstJob.state, secondJob.state]), new Set(['waiting_renderer', 'completed']));
  assert.equal(JSON.stringify(result).includes('lease-second'), false);
  assert.equal(JSON.stringify(result).includes('workerId'), false);
});

test('rejects a malformed job list before any provider or billing access', async t => {
  const { db, store, project } = makeHarness();
  t.after(() => db.close());
  let providerCalls = 0;
  const malformedStore = {
    ...store,
    listExportJobs: () => null,
  };
  await assert.rejects(
    runVideoRendererWorkerBatch({
      store: malformedStore,
      ownerEmail: OWNER,
      projectId: project.id,
      workerId: 'batch-worker',
      adapter: { submit: async () => { providerCalls += 1; return {}; } },
      now: NOW,
    }),
    error => error.code === 'RENDER_RECONCILIATION_INVALID',
  );
  assert.equal(providerCalls, 0);
});
