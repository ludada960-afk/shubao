import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

const OWNER = 'owner@example.com';

function harness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `id-${++sequence}`;
  const now = () => new Date('2026-08-15T08:00:00.000Z');
  const projectStore = createProjectStore(db, { now, randomUUID });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID });
  const project = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '广告短片' });
  return { db, projectStore, store, project };
}

function assetWithVersions(store, projectId) {
  const asset = store.createAsset({ ownerEmail: OWNER, projectId, kind: 'product', name: '耳机' });
  const first = store.addAssetVersion({ ownerEmail: OWNER, projectId, assetId: asset.id,
    stableUrl: '/api/video/assets/a', contentHash: 'hash-a', mimeType: 'image/png', metadata: { angle: 'front' } });
  const second = store.addAssetVersion({ ownerEmail: OWNER, projectId, assetId: asset.id,
    stableUrl: '/api/video/assets/b', contentHash: 'hash-b', mimeType: 'image/png', metadata: { angle: 'side' } });
  return { asset, first, second };
}

test('workbench assets require an owned video project and immutable versions', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  assert.throws(() => store.createAsset({
    ownerEmail: 'other@example.com', projectId: project.id, kind: 'product', name: '耳机',
  }), error => error.code === 'PROJECT_NOT_FOUND');
  const imageProject = projectStore.createProject({ ownerEmail: OWNER, kind: 'ecommerce', title: '图片' });
  assert.throws(() => store.createAsset({
    ownerEmail: OWNER, projectId: imageProject.id, kind: 'product', name: '耳机',
  }), error => error.code === 'PROJECT_NOT_FOUND');

  const { asset, first, second } = assetWithVersions(store, project.id);
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.deepEqual(first.metadata, { angle: 'front' });
  const approved = store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  assert.equal(approved.revision, 2);
  assert.equal(approved.approvedVersionId, first.id);
  assert.throws(() => store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: second.id, expectedRevision: 1 }), error => error.code === 'VERSION_CONFLICT');
});

test('asset approval changes mark pinned shots and active clips stale without rewriting bindings', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first, second } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000, cameraLanguage: '推镜', prompt: '耳机特写' });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    outputAssetId: 'output-a', stableUrl: '/api/video/media/output-a', contentHash: 'out-a', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: 1 });
  store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, position: 0, trimStartMs: 0, trimEndMs: 2500, muted: false });

  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: second.id, expectedRevision: 2 });
  const projection = store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
  assert.equal(projection.shots[0].status, 'stale');
  assert.equal(projection.shots[0].bindings[0].assetVersionId, first.id);
  assert.equal(projection.timelineClips[0].status, 'stale');
});

test('shot edits validate ordering, duration, patch allow-list and revisions', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000 });
  assert.throws(() => store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '重复', durationMs: 3000 }), error => error.code === 'INVALID_POSITION');
  assert.throws(() => store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 1,
    purpose: '太短', durationMs: 499 }), error => error.code === 'INVALID_DURATION');
  assert.throws(() => store.updateShot({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    expectedRevision: 1, patch: { status: 'approved' } }), error => error.code === 'INVALID_BINDING');
  const updated = store.updateShot({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    expectedRevision: 1, patch: { purpose: '产品亮相', durationMs: 4000 } });
  assert.equal(updated.revision, 2);
  assert.throws(() => store.updateShot({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    expectedRevision: 1, patch: { purpose: '旧写入' } }), error => error.code === 'VERSION_CONFLICT');
});

test('candidate registration is idempotent and selection never silently rewrites timeline clips', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });
  const input = { ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    outputAssetId: 'output-a', stableUrl: '/api/video/media/output-a', contentHash: 'out-a', mimeType: 'video/mp4' };
  const first = store.registerCandidate(input);
  assert.equal(store.registerCandidate(input).id, first.id);
  const second = store.registerCandidate({ ...input, outputAssetId: 'output-b',
    stableUrl: '/api/video/media/output-b', contentHash: 'out-b' });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: first.id, expectedRevision: 1 });
  const clip = store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: first.id, position: 0, trimStartMs: 0, trimEndMs: 3000, muted: false });
  assert.throws(() => store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: second.id, position: 1, trimStartMs: 0, trimEndMs: 3000, muted: false }),
  error => error.code === 'INVALID_TIMELINE_CANDIDATE');

  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: second.id, expectedRevision: 2 });
  const projection = store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
  assert.equal(projection.shots[0].selectedCandidateId, second.id);
  assert.equal(projection.timelineClips.find(item => item.id === clip.id).candidateId, first.id);
  assert.equal(projection.timelineClips.find(item => item.id === clip.id).status, 'stale');
});

test('stale shots reject active timeline clips and preserve stale state on candidate selection', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first, second } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000 });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: second.id, expectedRevision: 2 });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    outputAssetId: 'output-a', stableUrl: '/api/video/media/output-a', contentHash: 'out-a', mimeType: 'video/mp4' });
  const selected = store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: 2 });
  assert.equal(selected.shot.status, 'stale');
  assert.throws(() => store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, position: 0, trimStartMs: 0, trimEndMs: 2000, muted: false }),
  error => error.code === 'INVALID_TIMELINE_CANDIDATE');
});
