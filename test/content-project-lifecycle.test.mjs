import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createContentProjectLifecycle } from '../server/projects/contentProjectLifecycle.mjs';

function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  const store = createProjectStore(db, {
    randomUUID: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    now: () => new Date('2026-08-20T10:00:00.000Z'),
  });
  const bytes = new Map();
  const readGeneratedAsset = async assetId => {
    const entry = bytes.get(assetId);
    return entry ? { buffer: entry.buffer, contentType: entry.contentType } : null;
  };
  return { db, store, bytes, lifecycle: createContentProjectLifecycle({ projectStore: store, readGeneratedAsset }) };
}

const coverBytes = Buffer.from('cover-bytes');
const pageBytes = Buffer.from('page-bytes');
const assetUrl = (bytes, extension) => `/api/generated-assets/${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
const cover = assetUrl(coverBytes, 'png');
const page = assetUrl(pageBytes, 'webp');

test('content generation gets an owner-scoped project and canonical output refs', async t => {
  const { db, store, bytes, lifecycle } = createHarness();
  t.after(() => db.close());
  bytes.set(cover.slice(cover.lastIndexOf('/') + 1), { buffer: coverBytes, contentType: 'image/png' });
  bytes.set(page.slice(page.lastIndexOf('/') + 1), { buffer: pageBytes, contentType: 'image/webp' });
  const context = await lifecycle.begin({ ownerEmail: 'Owner@example.com', generationId: 'content-1', mode: 'xhs' });
  const prepared = await lifecycle.prepareResult({
    ownerEmail: 'owner@example.com',
    context,
    delivery: { title: '夏日记录', cover_url: cover, image_urls: [page, cover] },
  });
  assert.equal(prepared.projectKind, 'xiaohongshu');
  assert.equal(prepared.projectAssetRefs.length, 2);
  assert.equal(prepared.projectAssetRefs[0].mediaKind, 'image');
  assert.equal(store.listProjectAssetLibrary({ ownerEmail: 'owner@example.com', projectKind: 'xiaohongshu' }).length, 2);
  await lifecycle.complete({ ownerEmail: 'owner@example.com', context: prepared });
  assert.equal(store.getProject({ ownerEmail: 'owner@example.com', projectId: context.projectId }).status, 'completed');
  assert.equal(store.getGenerationRun({ ownerEmail: 'owner@example.com', generationRunId: 'content-1' }).status, 'completed');
  assert.equal(store.listProjectAssets({ ownerEmail: 'owner@example.com', projectId: context.projectId })
    .every(asset => asset.retentionClass === 'completed'), true);
  assert.equal(store.listProjectAssets({ ownerEmail: 'owner@example.com', projectId: context.projectId })
    .every(asset => asset.productionState === 'delivered'), true);
});

test('content lifecycle is idempotent and isolates owners', async t => {
  const { db, store, lifecycle } = createHarness();
  t.after(() => db.close());
  const first = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'same-id', mode: 'plog' });
  const replay = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'same-id', mode: 'plog' });
  assert.deepEqual(replay, first);
  await assert.rejects(
    () => lifecycle.begin({ ownerEmail: 'other@example.com', generationId: 'same-id', mode: 'plog' }),
    error => error?.code === 'CONTENT_PROJECT_CONFLICT' || error?.code === 'CONTENT_PROJECT_OWNER_MISMATCH',
  );
  assert.equal(store.listProjects({ ownerEmail: 'other@example.com' }).length, 0);
});

test('a reused generation id cannot create an orphan project under another content mode', async t => {
  const { db, store, lifecycle } = createHarness();
  t.after(() => db.close());
  const first = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'mode-conflict', mode: 'xhs' });
  await assert.rejects(
    () => lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'mode-conflict', mode: 'plog' }),
    error => error?.code === 'CONTENT_PROJECT_CONFLICT',
  );
  assert.equal(store.listProjects({ ownerEmail: 'owner@example.com' }).length, 1);
  assert.equal(store.getGenerationRun({ ownerEmail: 'owner@example.com', generationRunId: 'mode-conflict' }).projectId, first.projectId);
});

test('content results reject a stable URL whose stored bytes do not match its hash', async t => {
  const { db, lifecycle } = createHarness();
  t.after(() => db.close());
  const context = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'asset-integrity-1', mode: 'xhs' });
  await assert.rejects(
    () => lifecycle.prepareResult({
      ownerEmail: 'owner@example.com',
      context,
      delivery: { title: '不可信图片', cover_url: cover, image_urls: [] },
    }),
    error => error?.code === 'CONTENT_PROJECT_ASSET_NOT_READY',
  );
});

test('needs-review keeps the result version and recovery completes a settled project', async t => {
  const { db, store, bytes, lifecycle } = createHarness();
  t.after(() => db.close());
  bytes.set(cover.slice(cover.lastIndexOf('/') + 1), { buffer: coverBytes, contentType: 'image/png' });
  bytes.set(page.slice(page.lastIndexOf('/') + 1), { buffer: pageBytes, contentType: 'image/webp' });
  const reviewContext = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'review-1', mode: 'plog' });
  const reviewed = await lifecycle.prepareResult({
    ownerEmail: 'owner@example.com',
    context: reviewContext,
    delivery: { caption: '待审核', cover_url: cover, image_urls: [] },
  });
  await lifecycle.review({ ownerEmail: 'owner@example.com', context: reviewed });
  assert.equal(store.getProject({ ownerEmail: 'owner@example.com', projectId: reviewed.projectId }).status, 'needs_review');
  const reviewRun = store.getGenerationRun({ ownerEmail: 'owner@example.com', generationRunId: reviewed.generationRunId });
  assert.equal(reviewRun.status, 'needs_review');
  assert.equal(reviewRun.resultVersionId, reviewed.resultVersionId);
  assert.equal(store.listProjectAssets({ ownerEmail: 'owner@example.com', projectId: reviewed.projectId })[0].retentionClass, 'unfinished');
  assert.equal(store.listProjectAssets({ ownerEmail: 'owner@example.com', projectId: reviewed.projectId })[0].productionState, 'candidate');

  const recoveryContext = await lifecycle.begin({ ownerEmail: 'owner@example.com', generationId: 'recovery-1', mode: 'xhs' });
  const recoveryPrepared = await lifecycle.prepareResult({
    ownerEmail: 'owner@example.com',
    context: recoveryContext,
    delivery: { title: '恢复', cover_url: cover, image_urls: [page] },
  });
  await lifecycle.reconcile({
    ownerEmail: 'owner@example.com',
    generationId: 'recovery-1',
    billing: { status: 'settled' },
    delivery: recoveryPrepared,
  });
  assert.equal(store.getProject({ ownerEmail: 'owner@example.com', projectId: recoveryPrepared.projectId }).status, 'completed');
  assert.equal(store.getGenerationRun({ ownerEmail: 'owner@example.com', generationRunId: 'recovery-1' }).status, 'completed');
});

test('content references are imported into the source version and linked to generated results', async t => {
  const { db, store, bytes } = createHarness();
  t.after(() => db.close());
  const sourceBytes = Buffer.from('reference-bytes');
  const sourceAssetId = assetUrl(sourceBytes, 'png').slice(assetUrl(sourceBytes, 'png').lastIndexOf('/') + 1);
  bytes.set(sourceAssetId, { buffer: sourceBytes, contentType: 'image/png' });
  bytes.set(cover.slice(cover.lastIndexOf('/') + 1), { buffer: coverBytes, contentType: 'image/png' });
  bytes.set(page.slice(page.lastIndexOf('/') + 1), { buffer: pageBytes, contentType: 'image/webp' });
  const importedRoles = [];
  const lifecycle = createContentProjectLifecycle({
    projectStore: store,
    readGeneratedAsset: async assetId => bytes.get(assetId) || null,
    importImageAsset: async ({ ownerEmail, projectId, versionId, imageAssetId, role, metadata }) => {
      importedRoles.push({ ownerEmail, projectId, versionId, imageAssetId, role, metadata });
      return store.createProjectAsset({
        ownerEmail,
        projectId,
        versionId,
        assetId: imageAssetId,
        role,
        stableUrl: `/api/generated-assets/${imageAssetId}`,
        contentHash: imageAssetId.slice(0, 64),
        mimeType: 'image/png',
        metadata,
        retentionClass: 'source',
      });
    },
  });
  const context = await lifecycle.begin({
    ownerEmail: 'owner@example.com',
    generationId: 'content-lineage-1',
    mode: 'xhs',
    referenceGroups: { style: [sourceAssetId], source: [sourceAssetId] },
  });
  assert.equal(importedRoles.length, 1);
  assert.equal(importedRoles[0].role, 'style-reference');
  assert.equal(importedRoles[0].versionId, context.sourceVersionId);
  assert.equal(context.sourceProjectAssetIds.length, 1);

  const prepared = await lifecycle.prepareResult({
    ownerEmail: 'owner@example.com',
    context,
    delivery: { title: '带参考的内容', cover_url: cover, image_urls: [page] },
  });
  const lineage = store.getProjectAssetLineage({
    ownerEmail: 'owner@example.com',
    projectId: context.projectId,
    projectAssetId: prepared.projectAssetRefs[0].projectAssetId,
  });
  assert.equal(lineage.parents.length, 1);
  assert.equal(lineage.parents[0].projectAssetId, context.sourceProjectAssetIds[0]);
  assert.deepEqual(lineage.asset.metadata.provenance.sourceAssetIds, context.sourceProjectAssetIds);
});
