import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';

function ids(...values) {
  let index = 0;
  return () => values[index++] || `id-${index}`;
}

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  const store = createProjectStore(db, {
    randomUUID: ids('project-1', 'version-1', 'checkpoint-1', 'canvas-1', 'run-link-1', 'version-2'),
    now: () => new Date('2026-07-27T10:00:00.000Z'),
  });
  return { db, store };
}

test('creates immutable owner-scoped project versions', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());

  const project = store.createProject({ ownerEmail: 'Owner@Example.com', kind: 'ecommerce', title: '夏季水杯' });
  const version = store.createVersion({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    reason: 'generation',
    inputSnapshot: { prompt: '清爽夏季水杯' },
    planSnapshot: { platform: 'taobao' },
  });

  assert.equal(project.ownerEmail, 'owner@example.com');
  assert.equal(version.sequence, 1);
  assert.equal(store.getProject({ ownerEmail: 'owner@example.com', projectId: project.id }).headVersionId, version.id);
  assert.equal(store.getProject({ ownerEmail: 'other@example.com', projectId: project.id }), null);
  assert.throws(
    () => store.createVersion({ ownerEmail: 'other@example.com', projectId: project.id, reason: 'manual_save' }),
    error => error.code === 'PROJECT_NOT_FOUND',
  );
  assert.deepEqual(version.inputSnapshot, { prompt: '清爽夏季水杯' });
});

test('creates and lists canonical project assets with owner isolation and idempotent replay', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '素材契约' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save' });
  const input = {
    ownerEmail, projectId: project.id, versionId: version.id, assetId: 'upload-1', role: 'reference',
    stableUrl: '/api/video/assets/upload-1', contentHash: 'hash-1', mimeType: 'video/mp4', retentionClass: 'source',
  };
  const first = store.createProjectAsset(input);
  const replay = store.createProjectAsset(input);
  assert.equal(replay.projectAssetId, first.projectAssetId);
  assert.equal(first.mediaKind, 'video');
  assert.equal(store.listProjectAssets({ ownerEmail, projectId: project.id, mediaKind: 'video' }).length, 1);
  assert.throws(() => store.listProjectAssets({ ownerEmail: 'other@example.com', projectId: project.id }), error => error?.code === 'PROJECT_NOT_FOUND');
  assert.throws(() => store.getProjectAsset({ ownerEmail: 'other@example.com', projectId: project.id, projectAssetId: first.projectAssetId }), error => error?.code === 'PROJECT_NOT_FOUND');
});

test('persists structured media metadata without weakening canonical asset identity', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '媒体元数据' });
  const metadata = {
    durationMs: 8200,
    aspectRatio: '9:16',
    thumbnailProjectAssetId: 'thumbnail-asset-1',
    sourceProjectAssetIds: ['source-asset-1'],
    generationRunId: 'generation-run-1',
  };
  const asset = store.createProjectAsset({
    ownerEmail,
    projectId: project.id,
    assetId: 'video-output-1',
    role: 'output',
    stableUrl: '/api/video/assets/video-output-1',
    contentHash: 'video-output-hash',
    mimeType: 'video/mp4',
    metadata,
  });

  assert.deepEqual(asset.metadata, metadata);
  assert.deepEqual(store.getProjectAsset({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId }).metadata, metadata);
  assert.deepEqual(store.listProjectAssets({ ownerEmail, projectId: project.id })[0].metadata, metadata);
});

test('rejects invalid or oversized project asset metadata', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video' });
  const base = {
    ownerEmail,
    projectId: project.id,
    assetId: 'metadata-invalid',
    stableUrl: '/api/video/assets/metadata-invalid',
    contentHash: 'metadata-invalid-hash',
    mimeType: 'video/mp4',
  };
  assert.throws(() => store.createProjectAsset({ ...base, metadata: [] }), /metadata must be an object/);
  const nonSerializable = { toJSON: () => undefined };
  assert.throws(() => store.createProjectAsset({ ...base, metadata: nonSerializable }), /metadata must be JSON serializable/);
  assert.throws(() => store.createProjectAsset({ ...base, metadata: { note: 'x'.repeat(16_001) } }), /metadata is too large/);
});

test('links canonical project assets idempotently and rejects cross-project links', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce' });
  const source = store.createProjectAsset({ ownerEmail, projectId: project.id, assetId: 'source', stableUrl: '/api/generated-assets/source.webp', contentHash: 'source-hash', mimeType: 'image/webp' });
  const target = store.createProjectAsset({ ownerEmail, projectId: project.id, assetId: 'target', stableUrl: '/api/generated-assets/target.webp', contentHash: 'target-hash', mimeType: 'image/webp' });
  const first = store.linkProjectAsset({ ownerEmail, projectId: project.id, sourceProjectAssetId: source.projectAssetId, targetProjectAssetId: target.projectAssetId, relation: 'generated_from', generationRunId: 'run-1' });
  const replay = store.linkProjectAsset({ ownerEmail, projectId: project.id, sourceProjectAssetId: source.projectAssetId, targetProjectAssetId: target.projectAssetId, relation: 'generated_from', generationRunId: 'run-1' });
  assert.deepEqual(replay, first);
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_asset_lineage').get().value, 1);
  const other = store.createProject({ ownerEmail: 'other@example.com', kind: 'video' });
  const foreign = store.createProjectAsset({ ownerEmail: 'other@example.com', projectId: other.id, assetId: 'foreign', stableUrl: '/api/video/assets/foreign', contentHash: 'foreign-hash', mimeType: 'video/mp4' });
  assert.throws(() => store.linkProjectAsset({ ownerEmail, projectId: project.id, sourceProjectAssetId: source.projectAssetId, targetProjectAssetId: foreign.projectAssetId, relation: 'generated_from' }), error => error?.code === 'PROJECT_ASSET_NOT_FOUND');
});

test('lists recovery checkpoints with their immutable source version and without another owner records', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const project = store.createProject({ ownerEmail: 'owner@example.com', kind: 'ecommerce' });
  const version = store.createVersion({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    reason: 'generation',
    inputSnapshot: { description: '待恢复的水杯套图' },
  });
  const checkpoint = store.createCheckpoint({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    versionId: version.id,
    reason: 'payment_required',
  });

  const listed = store.listCheckpoints({ ownerEmail: 'owner@example.com' })[0];
  assert.equal(listed.id, checkpoint.id);
  assert.equal(listed.project.kind, 'ecommerce');
  assert.deepEqual(listed.version.inputSnapshot, { description: '待恢复的水杯套图' });
  assert.deepEqual(store.listCheckpoints({ ownerEmail: 'other@example.com' }), []);
  assert.equal(store.consumeCheckpoint({ ownerEmail: 'other@example.com', checkpointId: checkpoint.id }), null);
  assert.equal(store.consumeCheckpoint({ ownerEmail: 'owner@example.com', checkpointId: checkpoint.id }).status, 'consumed');
  assert.deepEqual(store.listCheckpoints({ ownerEmail: 'owner@example.com' }), []);
});

test('saves canvas sessions with optimistic revisions and supports explicit discard', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const project = store.createProject({ ownerEmail: 'owner@example.com', kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail: 'owner@example.com', projectId: project.id, reason: 'canvas_save' });
  const session = store.createCanvasSession({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    baseVersionId: version.id,
    snapshot: { nodes: [{ id: 'source-1' }], connections: [] },
  });

  const saved = store.saveCanvasSession({
    ownerEmail: 'owner@example.com',
    sessionId: session.id,
    expectedRevision: 1,
    snapshot: { nodes: [{ id: 'source-1' }, { id: 'result-1' }], connections: [{ from: 'source-1', to: 'result-1' }] },
  });
  assert.equal(saved.revision, 2);
  assert.throws(
    () => store.saveCanvasSession({ ownerEmail: 'owner@example.com', sessionId: session.id, expectedRevision: 1, snapshot: {} }),
    error => error.code === 'VERSION_CONFLICT',
  );
  assert.equal(store.discardCanvasSession({ ownerEmail: 'owner@example.com', sessionId: session.id }).status, 'discarded');
});

test('links a generation run and completes a project with an accepted result version', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce' });
  const source = store.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const run = store.linkGenerationRun({
    ownerEmail,
    projectId: project.id,
    sourceVersionId: source.id,
    generationRunId: 'generation-1',
    kind: 'ecommerce',
    quoteId: 'quote-1',
    holdId: 'hold-1',
  });
  const result = store.createVersion({ ownerEmail, projectId: project.id, parentVersionId: source.id, reason: 'accepted_result' });
  const completed = store.completeProject({ ownerEmail, projectId: project.id, acceptedVersionId: result.id, generationRunId: run.id });

  assert.equal(run.status, 'queued');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.acceptedVersionId, result.id);
  assert.equal(store.listProjects({ ownerEmail })[0].id, project.id);
  assert.deepEqual(store.listProjects({ ownerEmail: 'other@example.com' }), []);
});

test('atomically ensures and completes an ecommerce generation lifecycle idempotently', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = {
    ownerEmail: 'owner@example.com',
    generationRunId: 'ecommerce-task-1',
    title: '水杯套图',
    inputSnapshot: { description: '保温杯' },
    planSnapshot: { fingerprint: 'plan-fingerprint', items: [{ id: 'main-1' }] },
    quoteId: 'quote-1',
    holdId: 'hold-1',
  };

  const first = store.ensureEcommerceGeneration(input);
  const replay = store.ensureEcommerceGeneration(input);
  const completed = store.completeEcommerceGeneration({
    ownerEmail: input.ownerEmail,
    generationRunId: input.generationRunId,
    resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/main.png' } },
    resultPlanSnapshot: { fingerprint: 'plan-fingerprint' },
  });
  const completedReplay = store.completeEcommerceGeneration({
    ownerEmail: input.ownerEmail,
    generationRunId: input.generationRunId,
    resultInputSnapshot: { ignored: true },
  });

  assert.equal(replay.project.id, first.project.id);
  assert.equal(replay.sourceVersion.id, first.sourceVersion.id);
  assert.equal(replay.run.id, first.run.id);
  assert.equal(first.run.quoteId, 'quote-1');
  assert.equal(first.run.holdId, 'hold-1');
  assert.equal(completed.project.status, 'completed');
  assert.equal(completed.resultVersion.parentVersionId, first.sourceVersion.id);
  assert.equal(completed.resultVersion.planSnapshot.fingerprint, 'plan-fingerprint');
  assert.equal(completedReplay.resultVersion.id, completed.resultVersion.id);
});

test('records a partial ecommerce result version without claiming the project is completed', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = {
    ownerEmail: 'owner@example.com',
    generationRunId: 'ecommerce-task-partial',
    title: '部分可交付套图',
    inputSnapshot: { description: '保温杯' },
    planSnapshot: { fingerprint: 'partial-plan', items: [{ id: 'main-1' }, { id: 'detail-1' }] },
    quoteId: 'quote-partial',
    holdId: 'hold-partial',
  };
  const linked = store.ensureEcommerceGeneration(input);

  const reviewed = store.completeEcommerceGeneration({
    ownerEmail: input.ownerEmail,
    generationRunId: input.generationRunId,
    terminalStatus: 'needs_review',
    resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/main.png' } },
    resultPlanSnapshot: { fingerprint: 'partial-plan' },
  });

  assert.equal(reviewed.project.status, 'needs_review');
  assert.equal(reviewed.project.acceptedVersionId, null);
  assert.equal(reviewed.project.headVersionId, reviewed.resultVersion.id);
  assert.equal(reviewed.resultVersion.reason, 'manual_save');
  assert.equal(reviewed.resultVersion.parentVersionId, linked.sourceVersion.id);
  assert.equal(reviewed.run.status, 'needs_review');
});

test('terminalizes zero-delivery ecommerce runs without creating an empty result version', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());

  for (const [suffix, terminalStatus, projectStatus] of [
    ['review', 'needs_review', 'needs_review'],
    ['failed', 'failed', 'abandoned'],
  ]) {
    const ownerEmail = `${suffix}@example.com`;
    const generationRunId = `ecommerce-task-${suffix}`;
    const linked = store.ensureEcommerceGeneration({
      ownerEmail,
      generationRunId,
      title: '无可交付图片',
      inputSnapshot: { description: '测试商品' },
      planSnapshot: { fingerprint: `plan-${suffix}`, items: [{ id: 'main-1' }] },
    });

    const terminated = store.terminateEcommerceGeneration({
      ownerEmail,
      generationRunId,
      terminalStatus,
    });
    const replay = store.terminateEcommerceGeneration({
      ownerEmail,
      generationRunId,
      terminalStatus,
    });

    assert.equal(terminated.project.status, projectStatus);
    assert.equal(terminated.project.acceptedVersionId, null);
    assert.equal(terminated.project.headVersionId, linked.sourceVersion.id);
    assert.equal(terminated.run.status, terminalStatus);
    assert.equal(terminated.run.resultVersionId, null);
    assert.equal(replay.run.status, terminalStatus);
    assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_versions WHERE project_id = ?').get(linked.project.id).value, 1);
  }
});

test('keeps ecommerce generation terminal states immutable across conflicting replays', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'terminal-conflict@example.com';
  const generationRunId = 'ecommerce-task-terminal-conflict';
  const linked = store.ensureEcommerceGeneration({
    ownerEmail,
    generationRunId,
    title: '终态冲突',
    inputSnapshot: { description: '测试商品' },
    planSnapshot: { fingerprint: 'terminal-plan', items: [{ id: 'main-1' }] },
  });

  const failed = store.terminateEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'failed',
  });

  assert.throws(() => store.completeEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'completed',
    resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/late.png' } },
  }), error => error?.code === 'GENERATION_RUN_TERMINAL_CONFLICT');
  assert.throws(() => store.terminateEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'cancelled',
  }), error => error?.code === 'GENERATION_RUN_TERMINAL_CONFLICT');

  const replay = store.terminateEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'failed',
  });
  assert.equal(replay.run.status, 'failed');
  assert.equal(replay.run.completedAt, failed.run.completedAt);
  assert.equal(replay.resultVersion, null);
  assert.equal(store.getProject({ ownerEmail, projectId: linked.project.id }).status, 'abandoned');
  assert.equal(db.prepare('SELECT COUNT(*) AS value FROM project_versions WHERE project_id = ?').get(linked.project.id).value, 1);
});

test('rejects a conflicting terminal replay even when the first result has a version', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'versioned-terminal@example.com';
  const generationRunId = 'ecommerce-task-versioned-terminal';
  store.ensureEcommerceGeneration({
    ownerEmail,
    generationRunId,
    title: '已交付终态',
    inputSnapshot: { description: '测试商品' },
    planSnapshot: { fingerprint: 'versioned-terminal-plan', items: [{ id: 'main-1' }] },
  });
  const completed = store.completeEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'completed',
    resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/final.png' } },
  });

  assert.throws(() => store.completeEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'needs_review',
  }), error => error?.code === 'GENERATION_RUN_TERMINAL_CONFLICT');
  assert.throws(() => store.terminateEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'failed',
  }), error => error?.code === 'GENERATION_RUN_TERMINAL_CONFLICT');

  const replay = store.completeEcommerceGeneration({ ownerEmail, generationRunId });
  assert.equal(replay.run.status, 'completed');
  assert.equal(replay.resultVersion.id, completed.resultVersion.id);
});

test('dismisses an available checkpoint and excludes expired checkpoints', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const checkpoint = store.createCheckpoint({ ownerEmail, projectId: project.id, versionId: version.id, reason: 'session_interrupted' });

  assert.equal(store.dismissCheckpoint({ ownerEmail, checkpointId: checkpoint.id }).status, 'dismissed');
  assert.deepEqual(store.listCheckpoints({ ownerEmail }), []);
});
