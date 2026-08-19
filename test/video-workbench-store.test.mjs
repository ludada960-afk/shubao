import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { normalizeVideoProvenance } from '../server/videoProvenance.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

const OWNER = 'owner@example.com';

test('verified video provenance requires the request hash binding', () => {
  const base = {
    status: 'verified',
    provider: 'provider-a',
    model: 'model-a',
    requestId: 'request-a',
    catalogVersion: 'catalog-a',
    generatedAt: '2026-08-15T08:00:00.000Z',
    source: 'provider-attempt',
  };
  assert.deepEqual(normalizeVideoProvenance(base, 'unverified-legacy'), {
    status: 'unverified-legacy',
  });
  assert.equal(normalizeVideoProvenance({ ...base, requestHash: 'hash-a' }).status, 'verified');
});

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
  providerRoute = '', catalogVersion = '', providerCostCny = 0, currentAttemptId = '',
} = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, status TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT '', provider_route TEXT NOT NULL DEFAULT '',
      catalog_version TEXT NOT NULL DEFAULT '', provider_cost_cny REAL NOT NULL DEFAULT 0,
      current_attempt_id TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
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
  db.prepare(`INSERT INTO video_jobs
    (id, owner_email, project_id, status, result_asset_id, provider_route, catalog_version,
     provider_cost_cny, current_attempt_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(jobId, ownerEmail, projectId, status, outputAssetId, providerRoute, catalogVersion,
      providerCostCny, currentAttemptId, '2026-08-15T08:00:00.000Z');
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

test('imports an owner-scoped project asset into video without trusting browser media facts', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  const sourceProject = projectStore.createProject({ ownerEmail: OWNER, kind: 'ecommerce', title: '商品素材库' });
  const sourceAsset = projectStore.createProjectAsset({
    ownerEmail: OWNER,
    projectId: sourceProject.id,
    assetId: 'product-original-1',
    role: 'product',
    stableUrl: '/api/generated-assets/product-original-1',
    contentHash: 'source-content-hash',
    mimeType: 'image/webp',
    width: 1200,
    height: 1200,
    metadata: { displayName: '珍珠白耳机' },
  });
  const workbenchAsset = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'product', name: '耳机主体' });
  const version = store.addAssetVersionFromProjectAsset({
    ownerEmail: OWNER,
    projectId: project.id,
    assetId: workbenchAsset.id,
    sourceProjectId: sourceProject.id,
    sourceProjectAssetId: sourceAsset.projectAssetId,
    expectedContentHash: sourceAsset.contentHash,
    role: 'product',
  });

  assert.equal(version.mimeType, 'image/webp');
  assert.equal(version.contentHash, sourceAsset.contentHash);
  assert.equal(version.metadata.sourceProjectAssetRef.projectId, sourceProject.id);
  assert.equal(version.metadata.sourceProjectAssetRef.projectAssetId, sourceAsset.projectAssetId);
  assert.notEqual(version.sourceProjectAssetId, sourceAsset.projectAssetId);
  assert.equal(projectStore.listProjectAssets({ ownerEmail: OWNER, projectId: project.id }).length, 1);
  assert.throws(() => store.addAssetVersionFromProjectAsset({
    ownerEmail: 'other@example.com',
    projectId: project.id,
    assetId: workbenchAsset.id,
    sourceProjectId: sourceProject.id,
    sourceProjectAssetId: sourceAsset.projectAssetId,
    expectedContentHash: sourceAsset.contentHash,
  }), error => error.code === 'PROJECT_NOT_FOUND');
  assert.throws(() => store.addAssetVersionFromProjectAsset({
    ownerEmail: OWNER,
    projectId: project.id,
    assetId: workbenchAsset.id,
    sourceProjectId: sourceProject.id,
    sourceProjectAssetId: sourceAsset.projectAssetId,
    expectedContentHash: 'tampered-hash',
  }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'wallet_transactions'").get().count, 0);
});

test('skill runs preview declarative plans, append confirmation events, and stay non-billing', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const spec = {
    skillId: 'product-trailer', skillVersion: 2,
    input: { concept: '耳机广告' },
    steps: [{ id: 'world', kind: 'plan', label: '建立世界观' }],
    checkpoints: [
      { id: 'approve-assets', label: '确认素材' },
      { id: 'approve-candidates', label: '确认候选' },
    ],
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
  assert.deepEqual(confirmed.confirmedCheckpointIds, ['approve-assets']);
  const confirmedCandidates = store.confirmSkillCheckpoint({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, checkpointId: 'approve-candidates', expectedRevision: 2 });
  assert.equal(confirmedCandidates.status, 'confirmed');
  assert.equal(confirmedCandidates.revision, 3);
  assert.deepEqual(confirmedCandidates.confirmedCheckpointIds, ['approve-assets', 'approve-candidates']);
  const idempotent = store.confirmSkillCheckpoint({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, checkpointId: 'approve-candidates', expectedRevision: 3 });
  assert.equal(idempotent.revision, 3);
  assert.equal(idempotent.events.length, confirmedCandidates.events.length);
  assert.throws(() => store.confirmSkillCheckpoint({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, checkpointId: 'approve-assets', expectedRevision: 1 }),
    error => error.code === 'VERSION_CONFLICT');
  assert.throws(() => store.getSkillRun({ ownerEmail: 'other@example.com', projectId: project.id, runId: preview.id }),
    error => error.code === 'PROJECT_NOT_FOUND');
  const graph = store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
  assert.equal(graph.skillRuns[0].id, preview.id);
  assert.equal(graph.skillRuns[0].status, 'confirmed');
  assert.equal(graph.skillRuns[0].events.at(-1).type, 'checkpoint.confirmed');
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

test('skill run execution preview derives durable guards and budget without mutating state', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const preview = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'skill-execution-preview-1', spec: {
      skillId: 'trailer', skillVersion: 1,
      guards: [{ id: 'rights', kind: 'rights-confirmed', label: '素材已授权' }],
      budgetPolicy: { currency: 'ai_points', maxPoints: 12, reserveMode: 'approved_cap' },
      steps: [
        { id: 'plan', kind: 'plan', label: '拆解镜头', guards: ['rights'] },
        { id: 'assets', kind: 'assets', label: '准备素材', requires: ['plan'] },
      ],
    } });
  const blocked = store.previewSkillRunExecution({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepCosts: { plan: 4, assets: 5 } });
  assert.equal(blocked.revision, 1);
  assert.deepEqual(blocked.guardBlockedStepIds, ['plan']);
  assert.deepEqual(blocked.readyStepIds, []);
  assert.equal(blocked.estimatedPoints, 9);
  assert.equal(blocked.budget.remainingPoints, 3);
  assert.equal(blocked.status, 'blocked');
  const eventCount = db.prepare('SELECT COUNT(*) AS count FROM video_skill_run_events').get().count;
  const confirmed = store.confirmSkillRunGuard({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, guardId: 'rights', expectedRevision: 1 });
  const ready = store.previewSkillRunExecution({ ownerEmail: OWNER, projectId: project.id,
    runId: preview.id, stepCosts: { plan: 4, assets: 5 } });
  assert.equal(confirmed.revision, 2);
  assert.equal(ready.revision, 2);
  assert.deepEqual(ready.readyStepIds, ['plan']);
  assert.deepEqual(ready.guardBlockedStepIds, []);
  assert.equal(ready.status, 'ready');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_skill_run_events').get().count, eventCount + 1);
});

test('project memory is owner-scoped, revisioned, soft-deletable, and accepts only approved asset versions', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first, second } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });

  assert.deepEqual(store.listProjectMemory({ ownerEmail: OWNER, projectId: project.id }), []);
  const created = store.setProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'heroMood', value: { tone: 'warm' }, source: 'approved_asset',
    assetRefs: [{ assetId: asset.id, assetVersionId: first.id }] });
  assert.equal(created.revision, 1);
  assert.deepEqual(created.assetRefs, [{ assetId: asset.id, assetVersionId: first.id }]);
  assert.deepEqual(store.listProjectMemory({ ownerEmail: OWNER, projectId: project.id }).map(item => item.key), ['heroMood']);

  const updated = store.setProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'heroMood', value: { tone: 'cool' }, expectedRevision: 1 });
  assert.equal(updated.revision, 2);
  assert.throws(() => store.setProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'heroMood', value: { tone: 'stale' }, expectedRevision: 1 }), error => error.code === 'VERSION_CONFLICT');
  assert.throws(() => store.setProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'badRef', value: true, assetRefs: [{ assetId: asset.id, assetVersionId: second.id }] }),
  error => error.code === 'MEMORY_ASSET_VERSION_NOT_APPROVED');
  assert.throws(() => store.listProjectMemory({ ownerEmail: 'other@example.com', projectId: project.id }),
    error => error.code === 'PROJECT_NOT_FOUND');

  const removed = store.removeProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'heroMood', expectedRevision: 2 });
  assert.equal(removed.status, 'deleted');
  assert.deepEqual(store.listProjectMemory({ ownerEmail: OWNER, projectId: project.id }), []);
  assert.equal(db.prepare('SELECT status, revision FROM video_project_memory_facts WHERE fact_key = ?').get('heroMood').revision, 3);
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
  const secondProject = projectStore.createProject({ ownerEmail: OWNER, kind: 'video', title: '另一个项目' });
  const secondManifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: secondProject.id,
    skillId: 'commerce-trailer', skillVersion: 2, modelCatalogSnapshot: { seedance: '2.5' },
    rightsConfirmations: [] });
  assert.deepEqual(store.listReplayManifests({ ownerEmail: OWNER, projectId: project.id }), [firstManifest]);
  assert.deepEqual(store.listReplayManifests({ ownerEmail: OWNER, projectId: secondProject.id }), [secondManifest]);
  assert.throws(() => store.listReplayManifests({ ownerEmail: 'other@example.com', projectId: project.id }),
    error => error.code === 'PROJECT_NOT_FOUND');
  assert.throws(() => store.getReplayManifest({ ownerEmail: 'other@example.com', projectId: project.id,
    manifestId: firstManifest.id }), error => error.code === 'PROJECT_NOT_FOUND');
  const row = db.prepare('SELECT COUNT(*) AS count FROM video_replay_manifests WHERE project_id = ?').get(project.id);
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

test('template SkillRun replay preserves the template id through clone', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const run = store.previewSkillRun({ ownerEmail: OWNER, projectId: project.id,
    idempotencyKey: 'template-recipe-run-1', spec: {
      templateId: 'product-ad-v1',
      skillId: 'product-advertisement', skillVersion: 1,
      input: { prompt: '制作商品广告' },
      steps: [{ id: 'brief', kind: 'brief', label: '整理目标' }],
      checkpoints: [],
      modelPolicy: { strategy: 'capability-fit' },
      outputContract: { maxDurationSeconds: 30 },
    } });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'product-advertisement', skillVersion: 1, skillRunId: run.id,
    rightsConfirmations: [asset.id] });
  assert.equal(manifest.skillRun.templateId, 'product-ad-v1');
  const cloned = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'template-recipe-clone-1' });
  const version = db.prepare(`SELECT plan_snapshot FROM project_versions
    WHERE project_id = ? ORDER BY sequence DESC LIMIT 1`).get(cloned.project.id);
  assert.equal(JSON.parse(version.plan_snapshot).skillRun.templateId, 'product-ad-v1');
});

test('replay manifest clone carries project memory with remapped approved asset references', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  store.setProjectMemoryFact({ ownerEmail: OWNER, projectId: project.id,
    key: 'heroMood', value: { tone: 'warm' }, source: 'approved_asset',
    assetRefs: [{ assetId: asset.id, assetVersionId: first.id }] });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'commerce-trailer', skillVersion: 1, rightsConfirmations: [asset.id] });
  assert.equal(manifest.memory[0].key, 'heroMood');
  const cloned = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'memory-clone-1' });
  const graph = store.listWorkbench({ ownerEmail: OWNER, projectId: cloned.project.id });
  assert.equal(graph.memory.length, 1);
  assert.equal(graph.memory[0].key, 'heroMood');
  assert.notEqual(graph.memory[0].assetRefs[0].assetId, asset.id);
  assert.equal(graph.memory[0].assetRefs[0].assetId, graph.assets[0].id);
  const version = db.prepare(`SELECT plan_snapshot FROM project_versions
    WHERE project_id = ? ORDER BY sequence DESC LIMIT 1`).get(cloned.project.id);
  assert.deepEqual(JSON.parse(version.plan_snapshot).memory, manifest.memory);
});

test('replay manifest clone remaps approved audio tracks and preserves continuity metadata', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const voice = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'voice', name: '旁白' });
  const version = store.addAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: voice.id,
    stableUrl: '/api/video/assets/voice', contentHash: 'voice-hash', mimeType: 'audio/mpeg' });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: voice.id,
    versionId: version.id, expectedRevision: 1 });
  const track = store.createAudioTrack({ ownerEmail: OWNER, projectId: project.id,
    kind: 'voice', assetId: voice.id, assetVersionId: version.id, startMs: 120,
    durationMs: 3600, volume: 0.8, language: 'zh-CN', voiceAnchor: '克制、清晰',
    beatMarkers: [0, 900, 1800], subtitleCues: [{ startMs: 200, endMs: 1100, text: '先讲重点' }] });
  const manifest = store.createReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    skillId: 'product-advertisement', skillVersion: 1, rightsConfirmations: [voice.id] });
  assert.equal(manifest.audioTracks[0].assetId, voice.id);
  const cloned = store.cloneReplayManifest({ ownerEmail: OWNER, projectId: project.id,
    manifestId: manifest.id, idempotencyKey: 'audio-clone-1' });
  const graph = store.listWorkbench({ ownerEmail: OWNER, projectId: cloned.project.id });
  assert.equal(graph.audioTracks.length, 1);
  assert.notEqual(graph.audioTracks[0].id, track.id);
  assert.notEqual(graph.audioTracks[0].assetId, voice.id);
  assert.equal(graph.audioTracks[0].assetId, graph.assets[0].id);
  assert.equal(graph.audioTracks[0].assetVersionId, graph.assets[0].versions[0].id);
  assert.deepEqual(graph.audioTracks[0].beatMarkers, [0, 900, 1800]);
  assert.deepEqual(graph.audioTracks[0].subtitleCues, [{ startMs: 200, endMs: 1100, text: '先讲重点' }]);
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
  const { db, projectStore, store, project } = harness();
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

  const canonical = projectStore.getProjectAsset({ ownerEmail: OWNER, projectId: project.id, projectAssetId: version.sourceProjectAssetId });
  assert.ok(canonical);
  assert.notEqual(version.sourceProjectAssetId, 'upload-1');
  assert.equal(canonical.assetId, 'upload-1');
  assert.equal(canonical.projectId, project.id);
  assert.equal(canonical.stableUrl, '/api/video/assets/upload-1');
  assert.equal(version.sourceProjectAssetId, canonical.projectAssetId);
  assert.equal(version.stableUrl, '/api/video/assets/upload-1');
  assert.equal(version.contentHash, 'verified-upload-hash');
  assert.equal(version.mimeType, 'image/png');
  assert.deepEqual(version.metadata, {
    role: 'product',
    sourceKind: 'image',
    fileName: 'product.png',
    bytes: 4096,
  });
  assert.deepEqual(canonical.metadata, {
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

test('ordinary workbench versions receive a canonical asset identity when no source id is supplied', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'voice', name: '旁白' });
  const version = store.addAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/voice-track', contentHash: 'voice-track-hash', mimeType: 'audio/mpeg' });
  const canonical = projectStore.getProjectAsset({ ownerEmail: OWNER, projectId: project.id,
    projectAssetId: version.sourceProjectAssetId });
  assert.ok(canonical);
  assert.equal(canonical.assetId, 'voice-track');
  assert.equal(canonical.mediaKind, 'audio');
  assert.equal(version.projectAssetRefStatus, 'verified');
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

test('persists and updates structured shot direction, including legacy camera text', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '产品亮相', durationMs: 3000, cameraLanguage: '缓慢推进', direction: {
      shotScale: 'close', cameraAngle: 'low_angle', cameraMove: 'dolly_in', lighting: 'rim',
      primaryAction: '展示边缘高光', continuity: { transition: 'match_cut' }, negativePrompt: '不要水印',
    } });
  assert.equal(shot.direction.shotScale, 'close');
  assert.equal(shot.direction.cameraLanguage, '缓慢推进');
  assert.equal(shot.direction.continuity.transition, 'match_cut');
  const updated = store.updateShot({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    expectedRevision: 1, patch: { cameraLanguage: '从左向右横移', direction: {
      shotScale: 'wide', cameraMove: 'tracking', primaryAction: '人物走入画面',
      continuity: { axis: 'screen_left_to_right' },
    } } });
  assert.equal(updated.revision, 2);
  assert.equal(updated.cameraLanguage, '从左向右横移');
  assert.equal(updated.direction.shotScale, 'wide');
  assert.equal(updated.direction.cameraMove, 'tracking');
  assert.equal(updated.direction.cameraLanguage, '从左向右横移');
  assert.equal(updated.direction.continuity.axis, 'screen_left_to_right');
  assert.equal(db.prepare('SELECT direction_json FROM video_storyboard_shots WHERE id = ?').get(shot.id).direction_json.includes('screen_left_to_right'), true);
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

test('stale timeline clips can be replaced by the newly selected candidate without rewriting other shots', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shots = [0, 1, 2].map(position => store.createShot({
    ownerEmail: OWNER, projectId: project.id, position, purpose: `镜头${position + 1}`, durationMs: 3000,
  }));
  const candidates = shots.map((shot, index) => ({
    first: store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
      outputAssetId: `replace-a-${index}`, stableUrl: `/api/video/assets/replace-a-${index}`,
      contentHash: `replace-a-hash-${index}`, mimeType: 'video/mp4' }),
    second: store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
      outputAssetId: `replace-b-${index}`, stableUrl: `/api/video/assets/replace-b-${index}`,
      contentHash: `replace-b-hash-${index}`, mimeType: 'video/mp4' }),
  }));
  const clips = shots.map((shot, index) => {
    store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
      candidateId: candidates[index].first.id, expectedRevision: shot.revision });
    return store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
      candidateId: candidates[index].first.id, position: index, trimStartMs: 0, trimEndMs: 3000 });
  });

  const selected = store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shots[1].id,
    candidateId: candidates[1].second.id, expectedRevision: 2 });
  assert.equal(selected.candidate.id, candidates[1].second.id);
  assert.equal(store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).timelineClips
    .find(clip => clip.id === clips[1].id).status, 'stale');

  const replaced = store.replaceTimelineClipCandidate({ ownerEmail: OWNER, projectId: project.id,
    clipId: clips[1].id, expectedRevision: 2, candidateId: candidates[1].second.id });
  assert.equal(replaced.status, 'active');
  assert.equal(replaced.candidateId, candidates[1].second.id);
  const projection = store.listWorkbench({ ownerEmail: OWNER, projectId: project.id });
  assert.deepEqual(projection.timelineClips.map(clip => [clip.position, clip.status, clip.candidateId]), [
    [0, 'active', candidates[0].first.id],
    [1, 'active', candidates[1].second.id],
    [2, 'active', candidates[2].first.id],
  ]);
  assert.throws(() => store.replaceTimelineClipCandidate({ ownerEmail: OWNER, projectId: project.id,
    clipId: clips[1].id, expectedRevision: replaced.revision, candidateId: candidates[1].first.id }),
  error => error.code === 'INVALID_TIMELINE_CANDIDATE');
});

test('timeline clips support owner-scoped trim, reorder, and mute updates with optimistic revisions', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const { asset, first } = assetWithVersions(store, project.id);
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: asset.id, versionId: first.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '产品亮相', durationMs: 4000 });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: first.id, role: 'product' });
  const candidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    outputAssetId: 'timeline-output', stableUrl: '/api/video/media/timeline-output',
    contentHash: 'timeline-hash', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: 1 });
  const clip = store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, position: 0, trimStartMs: 0, trimEndMs: 4000 });

  const updated = store.updateTimelineClip({ ownerEmail: OWNER, projectId: project.id,
    clipId: clip.id, expectedRevision: 1,
    patch: { position: 2, trimStartMs: 500, trimEndMs: 2600, muted: true } });
  assert.equal(updated.position, 2);
  assert.equal(updated.trimStartMs, 500);
  assert.equal(updated.trimEndMs, 2600);
  assert.equal(updated.muted, true);
  assert.equal(updated.revision, 2);

  assert.throws(() => store.updateTimelineClip({ ownerEmail: OWNER, projectId: project.id,
    clipId: clip.id, expectedRevision: 1, patch: { muted: false } }),
  error => error.code === 'VERSION_CONFLICT');
  assert.throws(() => store.updateTimelineClip({ ownerEmail: OWNER, projectId: project.id,
    clipId: clip.id, expectedRevision: 2, patch: { trimStartMs: 3000, trimEndMs: 3000 } }),
  error => error.code === 'INVALID_DURATION');
});

test('completed generation jobs are imported as candidates from authoritative delivery records', t => {
  const { db, projectStore, store, project } = harness();
  t.after(() => db.close());
  seedCompletedVideoJob(db, { projectId: project.id });
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });
  const sourceAsset = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'product', name: '耳机' });
  const sourceVersion = store.addAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: sourceAsset.id,
    sourceProjectAssetId: 'source-upload', stableUrl: '/api/video/assets/source-upload',
    contentHash: 'source-upload-hash', mimeType: 'image/png' });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: sourceAsset.id,
    versionId: sourceVersion.id, expectedRevision: sourceAsset.revision });
  store.bindShotAssetVersion({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    assetId: sourceAsset.id, assetVersionId: sourceVersion.id, role: 'product' });

  const candidate = store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'job-1',
  });
  assert.equal(candidate.generationJobId, 'job-1');
  assert.equal(candidate.outputAssetId, 'output-1');
  assert.equal(candidate.stableUrl, '/api/video/assets/output-1');
  assert.equal(candidate.contentHash, 'verified-output-hash');
  assert.equal(candidate.mimeType, 'video/mp4');
  const canonical = projectStore.getProjectAsset({ ownerEmail: OWNER, projectId: project.id,
    projectAssetId: store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).shots[0].candidates[0].projectAssetRef?.projectAssetId });
  assert.ok(canonical);
  assert.equal(canonical.assetId, 'output-1');
  assert.equal(canonical.mimeType, 'video/mp4');
  assert.equal(canonical.generationRunId, 'job-1');
  assert.deepEqual(canonical.metadata.sourceProjectAssetIds, [sourceVersion.sourceProjectAssetId]);
  assert.equal(store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).shots[0].candidates[0].projectAssetRefStatus, 'verified');
  assert.equal(store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'job-1',
  }).id, candidate.id);
});

test('candidate provenance distinguishes planning, legacy, and verified delivery sources', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });

  const planned = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    outputAssetId: 'planned-output', stableUrl: '/api/video/assets/planned-output',
    contentHash: 'planned-hash', mimeType: 'video/mp4' });
  assert.equal(planned.provenanceStatus, 'planned');
  assert.deepEqual(planned.provenance, { status: 'planned' });

  const legacy = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: shot.id,
    generationJobId: 'legacy-job', outputAssetId: 'legacy-output',
    stableUrl: '/api/video/assets/legacy-output', contentHash: 'legacy-hash', mimeType: 'video/mp4' });
  assert.equal(legacy.provenanceStatus, 'unverified-legacy');
  assert.equal(legacy.provenance.status, 'unverified-legacy');

  seedCompletedVideoJob(db, {
    jobId: 'verified-job', projectId: project.id, outputAssetId: 'verified-output',
    providerRoute: 'provider-route', catalogVersion: 'catalog-v2', providerCostCny: 2.5,
    currentAttemptId: 'verified-job:1',
  });
  db.exec(`CREATE TABLE video_job_attempts (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
    request_hash TEXT NOT NULL, provider_task_id TEXT NOT NULL, state TEXT NOT NULL
  )`);
  db.prepare(`INSERT INTO video_job_attempts
    (id, job_id, provider, model, request_hash, provider_task_id, state)
    VALUES (?, ?, ?, ?, ?, ?, 'delivered')`)
    .run('verified-job:1', 'verified-job', 'seedance', 'seedance-2.5', 'request-hash', 'provider-task-1');

  const verified = store.registerCandidateFromJob({ ownerEmail: OWNER, projectId: project.id,
    shotId: shot.id, generationJobId: 'verified-job' });
  assert.equal(verified.provenanceStatus, 'verified');
  assert.deepEqual(verified.provenance, {
    status: 'verified', provider: 'seedance', model: 'seedance-2.5',
    requestId: 'provider-task-1', requestHash: 'request-hash',
    catalogVersion: 'catalog-v2', costCny: 2.5,
    generatedAt: '2026-08-15T08:00:00.000Z', source: 'provider-attempt',
    projectAssetRef: {
      projectId: project.id,
      projectAssetId: store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).shots[0].candidates
        .find(item => item.generationJobId === 'verified-job').projectAssetRef.projectAssetId,
      role: 'generated-video',
      expectedContentHash: 'verified-output-hash',
    },
  });
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

test('candidate job import rejects non-video or empty delivery media', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const shot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 4000 });

  seedCompletedVideoJob(db, { jobId: 'image-output-job', projectId: project.id,
    outputAssetId: 'image-output' });
  db.prepare('UPDATE video_assets SET content_type = ?, bytes = ? WHERE id = ?')
    .run('image/png', 4096, 'image-output');
  assert.throws(() => store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'image-output-job',
  }), error => error.code === 'VIDEO_JOB_NOT_READY');

  seedCompletedVideoJob(db, { jobId: 'empty-output-job', projectId: project.id,
    outputAssetId: 'empty-output' });
  db.prepare('UPDATE video_assets SET bytes = ? WHERE id = ?').run(0, 'empty-output');
  assert.throws(() => store.registerCandidateFromJob({
    ownerEmail: OWNER, projectId: project.id, shotId: shot.id, generationJobId: 'empty-output-job',
  }), error => error.code === 'VIDEO_JOB_NOT_READY');
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

test('audio continuity tracks require approved voice or music versions and preserve beats and subtitles', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const voice = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'voice', name: '旁白' });
  const voiceVersion = store.addAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: voice.id,
    stableUrl: '/api/video/assets/voice', contentHash: 'voice-hash', mimeType: 'audio/mpeg' });
  const music = store.createAsset({ ownerEmail: OWNER, projectId: project.id, kind: 'music', name: '配乐' });
  const musicVersion = store.addAssetVersion({ ownerEmail: OWNER, projectId: project.id, assetId: music.id,
    stableUrl: '/api/video/assets/music', contentHash: 'music-hash', mimeType: 'audio/mpeg' });
  assert.throws(() => store.createAudioTrack({ ownerEmail: OWNER, projectId: project.id,
    kind: 'voice', assetId: voice.id, assetVersionId: voiceVersion.id, durationMs: 4000 }),
  error => error.code === 'AUDIO_ASSET_NOT_APPROVED');
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: voice.id, versionId: voiceVersion.id, expectedRevision: 1 });
  store.approveAssetVersion({ ownerEmail: OWNER, projectId: project.id,
    assetId: music.id, versionId: musicVersion.id, expectedRevision: 1 });
  const track = store.createAudioTrack({ ownerEmail: OWNER, projectId: project.id,
    kind: 'voice', assetId: voice.id, assetVersionId: voiceVersion.id, startMs: 250,
    durationMs: 4200, language: 'zh-CN', voiceAnchor: '温和、清晰、近讲',
    beatMarkers: [0, 1200, 2600], subtitleCues: [
      { startMs: 250, endMs: 1400, text: '把产品讲清楚' },
    ] });
  assert.equal(track.revision, 1);
  assert.deepEqual(track.beatMarkers, [0, 1200, 2600]);
  assert.equal(track.subtitleCues[0].text, '把产品讲清楚');
  assert.equal(store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).audioTracks.length, 1);
  const updated = store.updateAudioTrack({ ownerEmail: OWNER, projectId: project.id, trackId: track.id,
    expectedRevision: 1, patch: { assetId: music.id, assetVersionId: musicVersion.id, kind: 'music', volume: 0.75 } });
  assert.equal(updated.revision, 2);
  assert.equal(updated.kind, 'music');
  assert.equal(updated.volume, 0.75);
  assert.throws(() => store.updateAudioTrack({ ownerEmail: OWNER, projectId: project.id,
    trackId: track.id, expectedRevision: 1, patch: { volume: 0.5 } }),
  error => error.code === 'VERSION_CONFLICT');
  assert.throws(() => store.createAudioTrack({ ownerEmail: OWNER, projectId: project.id,
    kind: 'music', assetId: music.id, assetVersionId: musicVersion.id, durationMs: 4000,
    beatMarkers: [100, 90] }), error => error.code === 'INVALID_AUDIO_TRACK');
});

test('shot recovery plans persist idempotently and never create provider or billing records', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const firstShot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 0,
    purpose: '产品亮相', durationMs: 3000, prompt: '产品从暗处亮起' });
  const secondShot = store.createShot({ ownerEmail: OWNER, projectId: project.id, position: 1,
    purpose: '细节收束', durationMs: 3000, prompt: '镜头停在细节' });
  const firstCandidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id,
    shotId: firstShot.id, outputAssetId: 'recovery-output-a', stableUrl: '/api/video/assets/recovery-output-a',
    contentHash: 'recovery-hash-a', mimeType: 'video/mp4' });
  const secondCandidate = store.registerCandidate({ ownerEmail: OWNER, projectId: project.id,
    shotId: secondShot.id, outputAssetId: 'recovery-output-b', stableUrl: '/api/video/assets/recovery-output-b',
    contentHash: 'recovery-hash-b', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: firstShot.id,
    candidateId: firstCandidate.id, expectedRevision: firstShot.revision });
  store.selectCandidate({ ownerEmail: OWNER, projectId: project.id, shotId: secondShot.id,
    candidateId: secondCandidate.id, expectedRevision: secondShot.revision });
  store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: firstShot.id,
    candidateId: firstCandidate.id, position: 0, trimStartMs: 0, trimEndMs: 3000 });
  store.addTimelineClip({ ownerEmail: OWNER, projectId: project.id, shotId: secondShot.id,
    candidateId: secondCandidate.id, position: 1, trimStartMs: 0, trimEndMs: 3000 });

  const created = store.createShotRecoveryPlan({ ownerEmail: OWNER, projectId: project.id,
    shotId: firstShot.id, reason: '只重拍失败镜头', mode: 'replace_candidate' });
  assert.equal(created.replayed, false);
  assert.equal(created.providerSubmission, false);
  assert.equal(created.billingMutation, false);
  assert.deepEqual(created.replace.timelineClipIds.length, 1);
  assert.deepEqual(created.preserve.shotIds, [secondShot.id]);
  assert.deepEqual(created.preserve.timelineClipIds, [
    store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).timelineClips.find(clip => clip.shotId === secondShot.id).id,
  ]);

  const replayed = store.createShotRecoveryPlan({ ownerEmail: OWNER, projectId: project.id,
    shotId: firstShot.id, reason: '只重拍失败镜头', mode: 'replace_candidate' });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.id, created.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_shot_recovery_plans WHERE project_id = ?').get(project.id).count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('video_jobs', 'wallet_transactions')").get().count, 0);
  assert.deepEqual(store.listWorkbench({ ownerEmail: OWNER, projectId: project.id }).recoveryPlans.map(plan => plan.id), [created.id]);
});
