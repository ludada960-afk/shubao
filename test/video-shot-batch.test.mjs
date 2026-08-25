import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

const OWNER = 'batch-owner@example.com';

function harness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `id-${++sequence}`;
  const now = () => new Date('2026-08-20T08:00:00.000Z');
  const projectStore = createProjectStore(db, { now, randomUUID });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
  const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '批次进度' });
  return { db, projectStore, store, project };
}

function shot(store, project, position) {
  return store.createShot({ ownerEmail: OWNER, projectId: project.id, position,
    purpose: `镜头${position + 1}`, durationMs: 4000, prompt: '保持主体一致' });
}

test('VID-R6: creating a batch records intent and reports not_started without billing', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const a = shot(store, project, 0);
  const b = shot(store, project, 1);
  const batch = store.createShotBatch({ ownerEmail: OWNER, projectId: project.id, shotIds: [a.id, b.id] });
  assert.equal(batch.shotIds.length, 2);
  assert.deepEqual(batch.summary, { not_started: 2 });
  for (const item of batch.items) {
    assert.equal(item.state, 'not_started');
    assert.equal(item.candidateCount, 0);
  }
});

test('VID-R6: duplicate ids collapse and foreign shots are rejected', t => {
  const { store, project } = harness();
  const a = shot(store, project, 0);
  const deduped = store.createShotBatch({ ownerEmail: OWNER, projectId: project.id, shotIds: [a.id, a.id] });
  assert.equal(deduped.shotIds.length, 1);
  assert.throws(
    () => store.createShotBatch({ ownerEmail: OWNER, projectId: project.id, shotIds: ['foreign-shot'] }),
    error => error?.code === 'VIDEO_SHOT_NOT_FOUND',
  );
  assert.throws(
    () => store.createShotBatch({ ownerEmail: OWNER, projectId: project.id, shotIds: [] }),
    error => error?.code === 'VIDEO_BATCH_EMPTY',
  );
});

test('VID-R6: registered candidates surface in progress even before video_jobs exists', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  const source = projectStore.createProjectAsset({
    ownerEmail: OWNER, projectId: project.id, assetId: 'batch-source', role: 'generated-video',
    stableUrl: '/api/video/assets/batch-source', contentHash: 'batch-hash', mimeType: 'video/mp4',
  });
  const a = shot(store, project, 0);
  store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: a.id,
    outputAssetId: source.assetId, stableUrl: source.stableUrl, contentHash: source.contentHash,
    mimeType: source.mimeType });
  const batch = store.createShotBatch({ ownerEmail: OWNER, projectId: project.id, shotIds: [a.id] });
  // No video_jobs table in this harness: guard keeps aggregation alive.
  assert.equal(batch.items[0].state, 'not_started');
  assert.equal(batch.items[0].candidateCount, 1);
});
