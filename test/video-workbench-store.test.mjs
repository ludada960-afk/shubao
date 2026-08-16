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

function seedCompletedVideoJob(db, {
  jobId = 'job-1', ownerEmail = OWNER, projectId = '', outputAssetId = 'output-1', status = 'completed',
} = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, status TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS video_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      content_type TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name)
    VALUES (?, ?, 'output', 'video/mp4', 1024, 'verified-output-hash', 'output.mp4')`)
    .run(outputAssetId, ownerEmail);
  db.prepare('INSERT INTO video_jobs (id, owner_email, project_id, status, result_asset_id) VALUES (?, ?, ?, ?, ?)')
    .run(jobId, ownerEmail, projectId, status, outputAssetId);
}

function seedUploadedVideoAsset(db, {
  assetId = 'upload-1', ownerEmail = OWNER, kind = 'image', contentType = 'image/png',
  bytes = 4096, sha256 = 'verified-upload-hash', fileName = 'product.png',
} = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      content_type TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(assetId, ownerEmail, kind, contentType, bytes, sha256, fileName);
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

test('skill runs preview declarative plans, append confirmation events, and stay non-billing', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const spec = {
    skillId: 'product-trailer', skillVersion: 2,
    input: { concept: '耳机广告' },
    steps: [{ id: 'world', kind: 'plan', label: '建立世界观' }],
    checkpoints: [{ id: 'approve-assets', label: '确认素材' }],
    modelPolicy: { image: 'gpt-image-2' },
    outputContract: { kind: 'storyboard' },
  };
  const preview = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'skill-preview-1', spec });
  assert.equal(preview.status, 'preview');
  assert.equal(preview.revision, 1);
  assert.equal(preview.events.length, 1);
  assert.equal(preview.events[0].type, 'skill-run.preview');
  assert.equal(preview.plan.steps[0].id, 'world');

  const replayed = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'skill-preview-1', spec: { ...spec, input: { concept: 'ignored' } } });
  assert.equal(replayed.id, preview.id);
  assert.equal(replayed.replayed, true);

  const confirmed = store.confirmSkillCheckpoint({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, checkpointId: 'approve-assets', expectedRevision: 1 });
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.revision, 2);
  assert.equal(confirmed.events.at(-1).type, 'checkpoint.confirmed');
  assert.equal(confirmed.events.at(-1).payload.checkpointId, 'approve-assets');
  assert.throws(() => store.confirmSkillCheckpoint({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, checkpointId: 'approve-assets', expectedRevision: 1 }),
    error => error.code === 'VERSION_CONFLICT');
  assert.throws(() => store.getSkillRun({ ownerEmail: 'other@example.com', projectId: project.id, runId: preview.id }),
    error => error.code === 'PROJECT_NOT_FOUND');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('usage_ledger', 'wallet_transactions')").all().length, 0);
});

test('skill run step completion is dependency-gated and resumable', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const spec = {
    skillId: 'trailer', skillVersion: 1,
    steps: [
      { id: 'plan', kind: 'plan', label: '拆解镜头' },
      { id: 'assets', kind: 'assets', label: '准备素材', requires: ['plan'] },
    ],
  };
  const preview = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'skill-step-1', spec });
  assert.equal(preview.executionPlan.status, 'ready');
  assert.deepEqual(preview.executionPlan.readyStepIds, ['plan']);
  assert.throws(() => store.completeSkillRunStep({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepId: 'assets', expectedRevision: 1 }),
    error => error.code === 'INVALID_SKILL_RUN');
  const first = store.completeSkillRunStep({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepId: 'plan', expectedRevision: 1 });
  assert.equal(first.status, 'running');
  assert.equal(first.revision, 2);
  assert.deepEqual(first.executionPlan.readyStepIds, ['assets']);
  assert.equal(first.events.at(-1).type, 'step.completed');
  assert.throws(() => store.completeSkillRunStep({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepId: 'assets', expectedRevision: 1 }),
    error => error.code === 'VERSION_CONFLICT');
  const complete = store.completeSkillRunStep({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepId: 'assets', expectedRevision: 2 });
  assert.equal(complete.status, 'complete');
  assert.equal(complete.executionPlan.status, 'complete');
  assert.deepEqual(complete.executionPlan.completedStepIds, ['plan', 'assets']);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
});

test('replay manifests are immutable, deduplicated and owner scoped', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000, prompt: '灯光亮起' });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  const firstManifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'commerce-trailer', skillVersion: 1, modelCatalogSnapshot: { seedance: '2.5' },
    rightsConfirmations: [{ assetId: asset.id, confirmation: 'owned_or_licensed' }] });
  const duplicate = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'commerce-trailer', skillVersion: 1, modelCatalogSnapshot: { seedance: '2.5' },
    rightsConfirmations: [asset.id] });
  assert.equal(duplicate.id, firstManifest.id);
  assert.equal(store.getReplayManifest({ ownerEmail: OWNER, projectId: project.id, manifestId: firstManifest.id }).manifestHash,
    firstManifest.manifestHash);
  assert.throws(() => store.getReplayManifest({ ownerEmail: 'other@example.com', projectId: project.id,
    manifestId: firstManifest.id }), error => error.code === 'PROJECT_NOT_FOUND');
  const row = db.prepare('SELECT COUNT(*) AS count FROM video_replay_manifests').get();
  assert.equal(row.count, 1);
});

test('replay manifest clone creates an owner-scoped draft graph without provider or billing writes', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '产品亮相', durationMs: 3000, cameraLanguage: '推镜', prompt: '耳机在窗边亮相' });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id,
    shotId: shot.id, outputAssetId: 'output-a', stableUrl: '/api/video/assets/output-a',
    contentHash: 'output-hash', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: 1 });
  store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, position: 0, trimStartMs: 0, trimEndMs: 3000 });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'commerce-trailer', skillVersion: 2, modelCatalogSnapshot: { seedance: '2.5' },
    rightsConfirmations: [asset.id] });

  const cloned = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'clone-1', title: '耳机广告 · 复用' });
  assert.notEqual(cloned.project.id, project.id);
  assert.equal(cloned.project.kind, 'video');
  assert.equal(cloned.project.title, '耳机广告 · 复用');
  const graph = store.listWorkbench({ ownerEmail: OWNER, projectId: cloned.project.id });
  assert.equal(graph.assets.length, 1);
  assert.equal(graph.assets[0].versions[0].stableUrl, '/api/video/assets/a');
  assert.equal(graph.assets[0].approvedVersionId, graph.assets[0].versions[0].id);
  assert.equal(graph.shots[0].prompt, '耳机在窗边亮相');
  assert.equal(graph.shots[0].bindings[0].role, 'product');
  assert.equal(graph.shots[0].selectedCandidateId, graph.shots[0].candidates[0].id);
  assert.equal(graph.timelineClips[0].candidateId, graph.shots[0].candidates[0].id);
  assert.equal(graph.shots[0].candidates[0].generationJobId, null);

  const replayed = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'clone-1', title: '被忽略的重复标题' });
  assert.equal(replayed.project.id, cloned.project.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects WHERE owner_email = ?').get(OWNER).count, 2);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM project_generation_runs WHERE project_id = ?").get(cloned.project.id).count, 0);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('usage_ledger', 'wallet_transactions') ORDER BY name").all().length, 0);
});

test('replay manifest links a SkillRun recipe and clone preserves it in the project version', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const run = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'recipe-run-1', spec: {
      skillId: 'commerce-trailer', skillVersion: 4,
      input: { concept: '耳机广告' },
      steps: [{ id: 'plan', kind: 'plan', label: '拆解镜头' }],
      checkpoints: [{ id: 'approve', label: '确认素材' }],
      modelPolicy: { video: 'seedance-2.5' },
      outputContract: { kind: 'storyboard' },
    } });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'commerce-trailer', skillVersion: 4, skillRunId: run.id,
    rightsConfirmations: [asset.id] });
  assert.equal(manifest.skillRun.skillId, 'commerce-trailer');
  assert.equal(manifest.skillRun.plan.steps[0].id, 'plan');
  assert.equal('id' in manifest.skillRun, false);
  const cloned = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'recipe-clone-1' });
  const version = db.prepare(`SELECT plan_snapshot FROM project_versions
    WHERE project_id = ? ORDER BY sequence DESC LIMIT 1`).get(cloned.project.id);
  const plan = JSON.parse(version.plan_snapshot);
  assert.deepEqual(plan.skillRun, manifest.skillRun);
  assert.equal(JSON.stringify(plan).includes(run.id), false);
  assert.equal(JSON.stringify(plan).includes('ownerEmail'), false);
});

test('replay manifest clone rejects tampered manifests and foreign owners', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'skill', skillVersion: 1, rightsConfirmations: [asset.id] });
  db.prepare('UPDATE video_replay_manifests SET manifest_json = ? WHERE id = ?')
    .run(JSON.stringify({ ...manifest, modelCatalogSnapshot: { changed: true } }), manifest.id);
  assert.throws(() => store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'tampered' }), error => error.code === 'REPLAY_MANIFEST_INTEGRITY_INVALID');
  assert.throws(() => store.cloneReplayManifest({ ownerEmail: 'other@example.com', projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'foreign' }), error => error.code === 'PROJECT_NOT_FOUND');
});

test('uploaded media is imported as an immutable asset version from authoritative storage', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedUploadedVideoAsset(db);
  seedUploadedVideoAsset(db, { assetId: 'foreign-upload', ownerEmail: 'other@example.com' });
  seedUploadedVideoAsset(db, { assetId: 'output-upload', kind: 'output', contentType: 'video/mp4' });
  seedUploadedVideoAsset(db, { assetId: 'unverified-upload', sha256: '' });
  seedUploadedVideoAsset(db, { assetId: 'mismatched-upload', contentType: 'video/mp4' });
  const asset = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'product', name: '耳机' });

  const version = store.addAssetVersionFromVideoAsset({
    ownerEmail: OWNER,
    projectId: project.id,
    assetId: asset.id,
    videoAssetId: 'upload-1',
    metadata: { role: 'product' },
  });

  assert.equal(version.sourceProjectAssetId, 'upload-1');
  assert.equal(version.stableUrl, '/api/video/assets/upload-1');
  assert.equal(version.contentHash, 'verified-upload-hash');
  assert.equal(version.mimeType, 'image/png');
  assert.deepEqual(version.metadata, {
    role: 'product',
    sourceKind: 'image',
    fileName: 'product.png',
    bytes: 4096,
  });
  assert.throws(() => store.addAssetVersionFromVideoAsset({
    ownerEmail: OWNER, projectId: project.id, assetId: asset.id, videoAssetId: 'foreign-upload',
  }), error => error.code === 'VIDEO_ASSET_NOT_FOUND');
  assert.throws(() => store.addAssetVersionFromVideoAsset({
    ownerEmail: OWNER, projectId: project.id, assetId: asset.id, videoAssetId: 'output-upload',
  }), error => error.code === 'VIDEO_ASSET_NOT_FOUND');
  assert.throws(() => store.addAssetVersionFromVideoAsset({
    ownerEmail: OWNER, projectId: project.id, assetId: asset.id, videoAssetId: 'unverified-upload',
  }), error => error.code === 'VIDEO_ASSET_NOT_READY');
  assert.throws(() => store.addAssetVersionFromVideoAsset({
    ownerEmail: OWNER, projectId: project.id, assetId: asset.id, videoAssetId: 'mismatched-upload',
  }), error => error.code === 'VIDEO_ASSET_NOT_READY');
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

test('completed generation jobs are imported as candidates from authoritative delivery records', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedCompletedVideoJob(db, { projectId: project.id });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });

  const candidate = store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'job-1',
  });
  assert.equal(candidate.generationJobId, 'job-1');
  assert.equal(candidate.outputAssetId, 'output-1');
  assert.equal(candidate.stableUrl, '/api/video/assets/output-1');
  assert.equal(candidate.contentHash, 'verified-output-hash');
  assert.equal(candidate.mimeType, 'video/mp4');
  assert.equal(store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'job-1',
  }).id, candidate.id);
});

test('candidate job import rejects unfinished or foreign generation deliveries', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  seedCompletedVideoJob(db, { jobId: 'pending-job', projectId: project.id,
    outputAssetId: 'pending-output', status: 'processing' });
  seedCompletedVideoJob(db, { jobId: 'foreign-job', ownerEmail: 'other@example.com', outputAssetId: 'foreign-output' });
  seedCompletedVideoJob(db, { jobId: 'other-project-job', projectId: 'other-project',
    outputAssetId: 'other-project-output' });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });

  assert.throws(() => store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'pending-job',
  }), error => error.code === 'VIDEO_JOB_NOT_READY');
  assert.throws(() => store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'foreign-job',
  }), error => error.code === 'VIDEO_JOB_NOT_FOUND');
  assert.throws(() => store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'other-project-job',
  }), error => error.code === 'VIDEO_JOB_NOT_FOUND');
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

test('operational metrics expose the pilot funnel and recent operation SLO', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000 });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  store.recordOperation({ ownerEmail: OWNER, projectId: project.id, action: 'shot.bind', outcome: 'success', latencyMs: 20 });
  store.recordOperation({ ownerEmail: OWNER, projectId: project.id, action: 'shot.create', outcome: 'failure', latencyMs: 40, errorCode: 'INVALID_BINDING' });
  const metrics = store.operationalMetrics();
  assert.equal(metrics.funnel.projectsStarted, 1);
  assert.equal(metrics.funnel.approvedAssetProjects, 1);
  assert.equal(metrics.funnel.storyboardReadyProjects, 1);
  assert.equal(metrics.funnel.candidateReadyProjects, 0);
  assert.equal(metrics.operations24h.total, 2);
  assert.equal(metrics.operations24h.failed, 1);
  assert.equal(metrics.operations24h.successRate, 0.5);
  assert.equal(metrics.operations24h.p95LatencyMs, 40);
  assert.equal(metrics.health.staleShots, 0);
  assert.equal(metrics.gate.minimumProjects, 10);
});
