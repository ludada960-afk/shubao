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

test('replays an idempotent version without advancing project history', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'version-idempotency@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '恢复项目' });
  const first = store.createVersion({
    ownerEmail,
    projectId: project.id,
    reason: 'manual_save',
    inputSnapshot: { surface: 'canvas' },
    idempotencyKey: 'canvas-media-version:one',
  });
  const replay = store.createVersion({
    ownerEmail,
    projectId: project.id,
    reason: 'manual_save',
    inputSnapshot: { surface: 'canvas' },
    idempotencyKey: 'canvas-media-version:one',
  });

  assert.equal(replay.id, first.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_versions WHERE project_id = ?').get(project.id).count, 1);
  assert.equal(store.getProject({ ownerEmail, projectId: project.id }).headVersionId, first.id);
});

test('rejects an idempotency replay whose version payload changed', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'version-idempotency-payload@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '请求指纹' });
  store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save', inputSnapshot: { surface: 'canvas' }, idempotencyKey: 'version-fingerprint' });

  assert.throws(
    () => store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save', inputSnapshot: { surface: 'other' }, idempotencyKey: 'version-fingerprint' }),
    error => error?.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('rejects reusing a version idempotency key for another project', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'version-idempotency-conflict@example.com';
  const firstProject = store.createProject({ ownerEmail, kind: 'video', title: '第一个项目' });
  const secondProject = store.createProject({ ownerEmail, kind: 'video', title: '第二个项目' });
  store.createVersion({ ownerEmail, projectId: firstProject.id, reason: 'manual_save', idempotencyKey: 'same-version-key' });

  assert.throws(
    () => store.createVersion({ ownerEmail, projectId: secondProject.id, reason: 'manual_save', idempotencyKey: 'same-version-key' }),
    error => error?.code === 'IDEMPOTENCY_CONFLICT',
  );
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
  assert.throws(() => store.createProjectAsset({ ...input, assetId: 'external', stableUrl: '//cdn.example.com/video.mp4' }), /stableUrl must be an owned application asset URL/);
});

test('pins a canonical project asset for long-term reuse and restores its prior retention class', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'retention-owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '长期素材' });
  const asset = store.createProjectAsset({
    ownerEmail,
    projectId: project.id,
    assetId: 'generated-product',
    stableUrl: '/api/generated-assets/generated-product.webp',
    contentHash: 'generated-product-hash',
    mimeType: 'image/webp',
    retentionClass: 'generated',
  });
  db.prepare("UPDATE project_assets SET expires_at = '2026-08-15T00:00:00.000Z' WHERE id = ?").run(asset.projectAssetId);

  const pinned = store.setProjectAssetRetention({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId, pinned: true });
  const replayed = store.setProjectAssetRetention({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId, pinned: true });

  assert.equal(pinned.retentionPinned, true);
  assert.equal(pinned.retentionClass, 'permanent');
  assert.equal(pinned.retentionState, 'active');
  assert.equal(replayed.retentionClass, 'permanent');
  assert.equal(db.prepare('SELECT retention_class_before_pin FROM project_assets WHERE id = ?').get(asset.projectAssetId).retention_class_before_pin, 'generated');

  const unpinned = store.setProjectAssetRetention({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId, pinned: false });

  assert.equal(unpinned.retentionPinned, false);
  assert.equal(unpinned.retentionClass, 'generated');
  assert.equal(unpinned.retentionState, 'active');
  assert.equal(unpinned.expiresAt, '2026-08-15T00:00:00.000Z');
  assert.equal(db.prepare('SELECT retention_class_before_pin FROM project_assets WHERE id = ?').get(asset.projectAssetId).retention_class_before_pin, null);
  assert.throws(
    () => store.setProjectAssetRetention({ ownerEmail: 'other@example.com', projectId: project.id, projectAssetId: asset.projectAssetId, pinned: true }),
    error => error?.code === 'PROJECT_NOT_FOUND',
  );
});

test('keeps historical reads available while reuse reads fail closed for expired assets', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'reuse-boundary@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '复用边界' });
  const asset = store.createProjectAsset({
    ownerEmail,
    projectId: project.id,
    assetId: 'expired-source',
    stableUrl: '/api/video/assets/expired-source',
    contentHash: 'expired-source-hash',
    mimeType: 'video/mp4',
    retentionClass: 'completed',
  });
  db.prepare(`UPDATE project_assets
    SET retention_state = 'marked', expires_at = ?
    WHERE id = ?`).run('2026-08-19T00:00:00.000Z', asset.projectAssetId);

  assert.equal(store.getProjectAsset({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId }).retentionState, 'marked');
  assert.throws(
    () => store.getProjectAsset({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId, purpose: 'reuse' }),
    error => error?.code === 'PROJECT_ASSET_NOT_REUSABLE',
  );

  db.prepare(`UPDATE project_assets
    SET retention_state = 'active', retention_pinned = 1, retention_class = 'permanent'
    WHERE id = ?`).run(asset.projectAssetId);
  assert.equal(store.getProjectAsset({ ownerEmail, projectId: project.id, projectAssetId: asset.projectAssetId, purpose: 'reuse' }).projectAssetId, asset.projectAssetId);
});

test('rejects unknown project asset purposes instead of silently granting a read', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const project = store.createProject({ ownerEmail: 'purpose-owner@example.com', kind: 'ecommerce', title: '访问意图' });
  const asset = store.createProjectAsset({
    ownerEmail: 'purpose-owner@example.com', projectId: project.id, assetId: 'purpose-asset',
    stableUrl: '/api/generated-assets/purpose-asset.webp', contentHash: 'purpose-hash', mimeType: 'image/webp',
  });
  assert.throws(
    () => store.getProjectAsset({ ownerEmail: 'purpose-owner@example.com', projectId: project.id, projectAssetId: asset.projectAssetId, purpose: 'preview' }),
    error => error?.code === 'PROJECT_ASSET_PURPOSE_INVALID',
  );
});

test('lists a display-safe owner project asset library across projects with server filters', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const ecommerce = store.createProject({ ownerEmail, kind: 'ecommerce', title: '商品项目' });
  const video = store.createProject({ ownerEmail, kind: 'video', title: '视频项目' });
  const other = store.createProject({ ownerEmail: 'other@example.com', kind: 'ecommerce', title: '不应出现' });
  store.createProjectAsset({ ownerEmail, projectId: ecommerce.id, assetId: 'product-image', role: 'hero', stableUrl: '/api/generated-assets/product-image.webp', contentHash: 'product-hash', mimeType: 'image/webp', metadata: { displayName: '春季主图' } });
  store.createProjectAsset({ ownerEmail, projectId: video.id, assetId: 'video-clip', stableUrl: '/api/video/assets/video-clip', contentHash: 'video-hash', mimeType: 'video/mp4' });
  store.createProjectAsset({ ownerEmail: 'other@example.com', projectId: other.id, assetId: 'foreign-image', stableUrl: '/api/generated-assets/foreign.webp', contentHash: 'foreign-hash', mimeType: 'image/webp' });

  const all = store.listProjectAssetLibrary({ ownerEmail, limit: 20 });
  const videos = store.listProjectAssetLibrary({ ownerEmail, mediaKind: 'video', limit: 20 });
  const commerce = store.listProjectAssetLibrary({ ownerEmail, projectKind: 'ecommerce', limit: 20 });
  const byAssetId = store.listProjectAssetLibrary({ ownerEmail, query: 'PRODUCT-IMAGE', limit: 20 });
  const byMetadata = store.listProjectAssetLibrary({ ownerEmail, query: '春季主图', limit: 20 });
  const byRole = store.listProjectAssetLibrary({ ownerEmail, query: 'HERO', limit: 20 });

  assert.equal(all.length, 2);
  assert.equal(all.some(asset => 'ownerEmail' in asset), false);
  assert.deepEqual(all.map(asset => asset.project.title).sort(), ['商品项目', '视频项目']);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].project.kind, 'video');
  assert.equal(commerce.length, 1);
  assert.equal(commerce[0].mediaKind, 'image');
  assert.equal(byAssetId.length, 1);
  assert.equal(byAssetId[0].assetId, 'product-image');
  assert.equal(byMetadata.length, 1);
  assert.equal(byRole.length, 1);
  assert.throws(() => store.listProjectAssetLibrary({ ownerEmail, mediaKind: 'document' }), /unknown mediaKind/);
  assert.throws(() => store.listProjectAssetLibrary({ ownerEmail, query: 'x'.repeat(121) }), /query is invalid/);
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

test('reads owner-scoped lineage and validated cross-project source references without leaking owner data', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '血缘读取' });
  const sourceProject = store.createProject({ ownerEmail, kind: 'ecommerce', title: '源项目' });
  const externalSource = store.createProjectAsset({ ownerEmail, projectId: sourceProject.id, assetId: 'external-source', stableUrl: '/api/generated-assets/external-source.webp', contentHash: 'external-hash', mimeType: 'image/webp' });
  const source = store.createProjectAsset({ ownerEmail, projectId: project.id, assetId: 'source', stableUrl: '/api/generated-assets/source.webp', contentHash: 'source-hash', mimeType: 'image/webp' });
  const target = store.createProjectAsset({ ownerEmail, projectId: project.id, assetId: 'target', stableUrl: '/api/generated-assets/target.webp', contentHash: 'target-hash', mimeType: 'image/webp', metadata: {
    sourceProjectAssetRef: { projectId: sourceProject.id, projectAssetId: externalSource.projectAssetId, role: 'reference', expectedContentHash: externalSource.contentHash },
  } });
  store.linkProjectAsset({ ownerEmail, projectId: project.id, sourceProjectAssetId: source.projectAssetId, targetProjectAssetId: target.projectAssetId, relation: 'generated_from', generationRunId: 'run-1' });

  const lineage = store.getProjectAssetLineage({ ownerEmail, projectId: project.id, projectAssetId: target.projectAssetId });
  assert.equal(lineage.asset.project.title, '血缘读取');
  assert.equal(lineage.parents[0].projectAssetId, source.projectAssetId);
  assert.equal(lineage.parents[0].relation, 'generated_from');
  assert.equal(lineage.parents[0].relationGenerationRunId, 'run-1');
  assert.equal(lineage.sourceReferences[0].project.title, '源项目');
  assert.equal(lineage.sourceReferences[0].verified, true);
  assert.equal(lineage.sourceReferences[0].sourceAsset.projectAssetId, externalSource.projectAssetId);
  assert.equal('ownerEmail' in lineage.asset, false);
  assert.equal('ownerEmail' in lineage.parents[0], false);
  assert.throws(
    () => store.getProjectAssetLineage({ ownerEmail: 'other@example.com', projectId: project.id, projectAssetId: target.projectAssetId }),
    error => error?.code === 'PROJECT_NOT_FOUND',
  );
});

test('does not expose a cross-project source when its asset or hash is not authoritative', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'video', title: '目标视频' });
  const sourceProject = store.createProject({ ownerEmail, kind: 'ecommerce', title: '源商品' });
  const source = store.createProjectAsset({ ownerEmail, projectId: sourceProject.id, assetId: 'real-source', stableUrl: '/api/generated-assets/real-source.webp', contentHash: 'real-hash', mimeType: 'image/webp' });
  const target = store.createProjectAsset({ ownerEmail, projectId: project.id, assetId: 'target', stableUrl: '/api/video/assets/target', contentHash: 'target-hash', mimeType: 'video/mp4', metadata: {
    sourceProjectAssetRef: { projectId: sourceProject.id, projectAssetId: source.projectAssetId, role: 'reference', expectedContentHash: 'tampered-hash' },
    importedFromProjectAsset: { projectId: sourceProject.id, projectAssetId: 'missing-asset', role: 'reference', expectedContentHash: 'missing-hash' },
  } });

  const lineage = store.getProjectAssetLineage({ ownerEmail, projectId: project.id, projectAssetId: target.projectAssetId });
  assert.deepEqual(lineage.sourceReferences, []);
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

test('rejects a Canvas snapshot that references another owner project asset', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'canvas-owner@example.com';
  const otherOwner = 'other-owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '画布项目' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save' });
  const foreignProject = store.createProject({ ownerEmail: otherOwner, kind: 'video', title: '其他项目' });
  const foreignAsset = store.createProjectAsset({
    ownerEmail: otherOwner,
    projectId: foreignProject.id,
    assetId: 'foreign-asset',
    stableUrl: '/api/video/assets/foreign-asset',
    contentHash: 'foreign-hash',
    mimeType: 'video/mp4',
  });

  assert.throws(() => store.createCanvasSession({
    ownerEmail,
    projectId: project.id,
    baseVersionId: version.id,
    snapshot: {
      nodes: [{
        id: 'foreign-node',
        assetRef: {
          projectId: foreignProject.id,
          projectAssetId: foreignAsset.projectAssetId,
          contentHash: foreignAsset.contentHash,
          stableUrl: foreignAsset.stableUrl,
          mimeType: foreignAsset.mimeType,
        },
      }],
    },
  }), error => error?.code === 'CANVAS_ASSET_NOT_FOUND');

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM canvas_sessions').get().count, 0);
});

test('allows a Canvas snapshot to reuse an authoritative asset from another project of the same owner', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'canvas-owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '目标项目' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save' });
  const sourceProject = store.createProject({ ownerEmail, kind: 'video', title: '来源项目' });
  const sourceAsset = store.createProjectAsset({
    ownerEmail,
    projectId: sourceProject.id,
    assetId: 'reusable-asset',
    stableUrl: '/api/video/assets/reusable-asset',
    contentHash: 'reusable-hash',
    mimeType: 'video/mp4',
  });

  const session = store.createCanvasSession({
    ownerEmail,
    projectId: project.id,
    baseVersionId: version.id,
    snapshot: { nodes: [{ assetRef: {
      projectId: sourceProject.id,
      projectAssetId: sourceAsset.projectAssetId,
      contentHash: sourceAsset.contentHash,
      stableUrl: sourceAsset.stableUrl,
      mimeType: sourceAsset.mimeType,
    } }] },
  });

  assert.equal(session.projectId, project.id);
});

test('rejects saving a Canvas snapshot that introduces another owner project asset', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'canvas-owner@example.com';
  const otherOwner = 'other-owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '画布保存项目' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'manual_save' });
  const session = store.createCanvasSession({
    ownerEmail,
    projectId: project.id,
    baseVersionId: version.id,
    snapshot: { nodes: [{ id: 'safe-node', type: 'text' }] },
  });
  const foreignProject = store.createProject({ ownerEmail: otherOwner, kind: 'video', title: '外部项目' });
  const foreignAsset = store.createProjectAsset({
    ownerEmail: otherOwner,
    projectId: foreignProject.id,
    assetId: 'foreign-save-asset',
    stableUrl: '/api/video/assets/foreign-save-asset',
    contentHash: 'foreign-save-hash',
    mimeType: 'video/mp4',
  });

  assert.throws(() => store.saveCanvasSession({
    ownerEmail,
    sessionId: session.id,
    expectedRevision: session.revision,
    snapshot: { nodes: [{ assetRef: {
      projectId: foreignProject.id,
      projectAssetId: foreignAsset.projectAssetId,
      contentHash: foreignAsset.contentHash,
      stableUrl: foreignAsset.stableUrl,
      mimeType: foreignAsset.mimeType,
    } }] },
  }), error => error?.code === 'CANVAS_ASSET_NOT_FOUND');

  const restored = store.getCanvasSession({ ownerEmail, sessionId: session.id });
  assert.equal(restored.revision, 1);
  assert.deepEqual(restored.snapshot, { nodes: [{ id: 'safe-node', type: 'text' }] });
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

test('stores the authoritative hash and MIME for each ecommerce result asset', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = store.ensureEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-authoritative-asset',
    title: '真实资产元数据',
    inputSnapshot: {},
    planSnapshot: { fingerprint: 'authoritative-plan', items: [{ id: 'hero' }] },
  });
  const contentHash = 'a'.repeat(64);
  const stableUrl = `/api/generated-assets/${contentHash}.webp`;

  store.completeEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-authoritative-asset',
    resultInputSnapshot: {
      assets: [{ assetId: 'hero', state: 'completed', stableUrl, contentHash, mimeType: 'image/webp' }],
    },
    resultPlanSnapshot: { fingerprint: 'authoritative-plan' },
  });

  const row = db.prepare('SELECT content_hash, mime_type, stable_url FROM project_assets WHERE project_id = ?').get(input.project.id);
  assert.deepEqual(row, { content_hash: contentHash, mime_type: 'image/webp', stable_url: stableUrl });
});

test('derives ecommerce asset identity from the stable URL before accepting snapshot metadata', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = store.ensureEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-authoritative-url',
    title: '稳定 URL 身份',
    inputSnapshot: {},
    planSnapshot: { fingerprint: 'url-plan', items: [{ id: 'hero' }] },
  });
  const contentHash = 'c'.repeat(64);
  const stableUrl = `/api/generated-assets/${contentHash}.webp`;

  store.completeEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-authoritative-url',
    resultInputSnapshot: { assets: [{ assetId: 'hero', state: 'completed', stableUrl, contentHash: 'forged-hash', mimeType: 'image/png' }] },
    resultPlanSnapshot: { fingerprint: 'url-plan' },
  });

  const row = db.prepare('SELECT content_hash, mime_type FROM project_assets WHERE project_id = ?').get(input.project.id);
  assert.deepEqual(row, { content_hash: contentHash, mime_type: 'image/webp' });
});

test('rejects an external ecommerce result URL before accepting the project result', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = store.ensureEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-external-result',
    title: '外链结果',
    inputSnapshot: {},
    planSnapshot: {},
  });

  assert.throws(() => store.completeEcommerceGeneration({
    ownerEmail: 'asset-owner@example.com',
    generationRunId: 'ecommerce-external-result',
    resultInputSnapshot: {
      assets: [{
        assetId: 'hero',
        state: 'completed',
        stableUrl: 'https://provider.example.com/result.png',
        contentHash: 'provider-hash',
        mimeType: 'image/png',
      }],
    },
    resultPlanSnapshot: {},
  }), error => error?.code === 'ECOMMERCE_ASSET_NOT_READY');

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_versions WHERE project_id = ?').get(input.project.id).count, 1);
  assert.equal(store.getProject({ ownerEmail: 'asset-owner@example.com', projectId: input.project.id }).status, 'running');
});

test('does not fabricate a video source asset hash when the source is not verified', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  assert.throws(() => store.ensureVideoGeneration({
    ownerEmail: 'video-owner@example.com',
    generationRunId: 'video-unverified-source',
    title: '未校验视频源',
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{
      assetId: 'upload-1',
      stableUrl: '/api/video/assets/upload-1',
      mimeType: 'video/mp4',
      contentHash: '',
    }],
  }), error => error?.code === 'VIDEO_ASSET_NOT_READY');
});

test('does not fabricate a video output asset hash or MIME type', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const input = {
    ownerEmail: 'video-owner@example.com',
    generationRunId: 'video-unverified-output',
    title: '未校验视频输出',
    inputSnapshot: {},
    planSnapshot: {},
  };
  const created = store.ensureVideoGeneration(input);

  assert.throws(() => store.completeVideoGeneration({
    ownerEmail: input.ownerEmail,
    generationRunId: input.generationRunId,
    outputAsset: {
      assetId: 'output-1',
      stableUrl: '/api/video/assets/output-1',
      contentHash: '',
      mimeType: '',
    },
  }), error => error?.code === 'VIDEO_ASSET_NOT_READY');

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_assets WHERE project_id = ?').get(created.project.id).count, 0);
  assert.equal(store.getProject({ ownerEmail: input.ownerEmail, projectId: created.project.id }).status, 'running');
});

test('rejects unverified video source MIME types before creating project state', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  assert.throws(() => store.ensureVideoGeneration({
    ownerEmail: 'video-owner@example.com',
    generationRunId: 'video-invalid-source-type',
    title: '错误视频源类型',
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{
      assetId: 'upload-1',
      stableUrl: '/api/video/assets/upload-1',
      mimeType: 'application/octet-stream',
      contentHash: 'verified-source-hash',
    }],
  }), error => error?.code === 'VIDEO_ASSET_NOT_READY');

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
});

test('rejects malformed video source entries instead of silently dropping them', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  assert.throws(() => store.ensureVideoGeneration({
    ownerEmail: 'video-owner@example.com',
    generationRunId: 'video-malformed-source',
    title: '缺少稳定素材标识',
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{
      assetId: '',
      stableUrl: '',
      mimeType: 'video/mp4',
      contentHash: 'verified-source-hash',
    }],
  }), error => error?.code === 'VIDEO_ASSET_NOT_READY');

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
});

test('rejects external video asset URLs at the canonical project boundary', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  assert.throws(() => store.ensureVideoGeneration({
    ownerEmail: 'video-owner@example.com',
    generationRunId: 'video-external-source',
    title: '外部视频源',
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{
      assetId: 'upload-1',
      stableUrl: 'https://cdn.example.com/upload-1.mp4',
      mimeType: 'video/mp4',
      contentHash: 'verified-source-hash',
    }],
  }), error => error?.code === 'VIDEO_ASSET_NOT_READY');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0);
});

test('creates a fresh source lineage row when a later video run reuses an asset id', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'video-owner@example.com';
  const first = store.ensureVideoGeneration({
    ownerEmail,
    generationRunId: 'video-reuse-first',
    title: '复用素材项目',
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{ assetId: 'source-1', stableUrl: '/api/video/assets/source-1', mimeType: 'image/png', contentHash: 'source-hash-1' }],
  });
  const second = store.ensureVideoGeneration({
    ownerEmail,
    generationRunId: 'video-reuse-second',
    projectId: first.project.id,
    inputSnapshot: {},
    planSnapshot: {},
    assets: [{ assetId: 'source-1', stableUrl: '/api/video/assets/source-1', mimeType: 'image/png', contentHash: 'source-hash-1' }],
  });
  const sourceRows = db.prepare(`SELECT version_id FROM project_assets
    WHERE project_id = ? AND asset_id = ? ORDER BY created_at ASC`).all(first.project.id, 'source-1');
  assert.equal(sourceRows.length, 2);
  assert.equal(sourceRows[0].version_id, first.sourceVersion.id);
  assert.equal(sourceRows[1].version_id, second.sourceVersion.id);
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
