import assert from 'node:assert/strict';
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
  return { db, store, lifecycle: createContentProjectLifecycle({ projectStore: store }) };
}

const cover = `/api/generated-assets/${'a'.repeat(64)}.png`;
const page = `/api/generated-assets/${'b'.repeat(64)}.webp`;

test('content generation gets an owner-scoped project and canonical output refs', async t => {
  const { db, store, lifecycle } = createHarness();
  t.after(() => db.close());
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
