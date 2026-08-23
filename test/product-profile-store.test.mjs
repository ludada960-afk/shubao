import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const store = createProjectStore(db, {
    randomUUID: () => `generated-${++sequence}`,
    now: () => new Date('2026-08-21T10:00:00.000Z'),
  });
  return { db, store };
}

function sourceAsset(store, ownerEmail, projectId, assetId = 'source-1') {
  return store.createProjectAsset({
    ownerEmail,
    projectId,
    assetId,
    role: 'product',
    stableUrl: `/api/uploads/${assetId}.png`,
    contentHash: `${assetId}-hash`,
    mimeType: 'image/png',
    retentionClass: 'source',
  });
}

test('creates and idempotently replays an owner-scoped reusable product profile', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '商品素材项目' });
  const asset = sourceAsset(store, ownerEmail, project.id);

  const input = {
    ownerEmail,
    idempotencyKey: 'profile-create-1',
    name: '夏季水杯',
    category: '家居',
    facts: { material: '陶瓷', capacity: '350ml' },
    variants: [{ color: '白色', spec: '标准', count: 1 }],
    assets: [{ projectId: project.id, projectAssetId: asset.projectAssetId, role: 'product', expectedContentHash: asset.contentHash }],
  };
  const first = store.createProductProfile(input);
  const replay = store.createProductProfile(input);

  assert.equal(first.profileId, replay.profileId);
  assert.equal(first.name, '夏季水杯');
  assert.equal(first.variants.length, 1);
  assert.equal(first.assets[0].projectAssetId, asset.projectAssetId);
  assert.equal(Object.hasOwn(first, 'ownerEmail'), false);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM product_profiles').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM product_profile_variants').get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM product_profile_assets').get().count, 1);
});

test('rejects foreign, mismatched, or non-reusable profile asset references', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const otherEmail = 'other@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '商品项目' });
  const otherProject = store.createProject({ ownerEmail: otherEmail, kind: 'ecommerce', title: '他人项目' });
  const asset = sourceAsset(store, ownerEmail, project.id);
  const foreignAsset = sourceAsset(store, otherEmail, otherProject.id, 'foreign-1');

  assert.throws(
    () => store.createProductProfile({
      ownerEmail,
      idempotencyKey: 'foreign-profile',
      name: '错误商品',
      assets: [{ projectId: otherProject.id, projectAssetId: foreignAsset.projectAssetId, role: 'product', expectedContentHash: foreignAsset.contentHash }],
    }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_NOT_REUSABLE',
  );
  assert.throws(
    () => store.createProductProfile({
      ownerEmail,
      idempotencyKey: 'hash-profile',
      name: '哈希错误',
      assets: [{ projectId: project.id, projectAssetId: asset.projectAssetId, role: 'product', expectedContentHash: 'wrong-hash' }],
    }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_NOT_FOUND',
  );
  db.prepare("UPDATE project_assets SET retention_state = 'marked', marked_at = '2026-08-21T09:00:00.000Z' WHERE id = ?").run(asset.projectAssetId);
  assert.throws(
    () => store.createProductProfile({
      ownerEmail,
      idempotencyKey: 'expired-profile',
      name: '过期商品',
      assets: [{ projectId: project.id, projectAssetId: asset.projectAssetId, role: 'product', expectedContentHash: asset.contentHash }],
    }),
    error => error?.code === 'PRODUCT_PROFILE_ASSET_NOT_REUSABLE',
  );
});

test('updates and archives a profile without deleting its canonical assets', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce', title: '更新项目' });
  const asset = sourceAsset(store, ownerEmail, project.id);
  const profile = store.createProductProfile({
    ownerEmail,
    idempotencyKey: 'update-profile-create',
    name: '旧名称',
    assets: [{ projectId: project.id, projectAssetId: asset.projectAssetId, role: 'product', expectedContentHash: asset.contentHash }],
  });

  const updated = store.updateProductProfile({
    ownerEmail,
    profileId: profile.profileId,
    idempotencyKey: 'update-profile-1',
    patch: { name: '新名称', facts: { material: '玻璃' }, variants: [{ color: '透明', count: 2 }] },
  });
  assert.equal(updated.name, '新名称');
  assert.equal(updated.facts.material, '玻璃');
  assert.equal(updated.variants[0].color, '透明');
  const archived = store.archiveProductProfile({ ownerEmail, profileId: profile.profileId });
  assert.equal(archived.status, 'archived');
  assert.equal(store.getProductProfile({ ownerEmail, profileId: profile.profileId }).status, 'archived');
  assert.equal(db.prepare('SELECT deleted_at FROM project_assets WHERE id = ?').get(asset.projectAssetId).deleted_at, null);
});

test('profile reads and updates remain isolated by owner', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const profile = store.createProductProfile({ ownerEmail, idempotencyKey: 'owner-profile', name: '私有商品' });
  assert.equal(store.getProductProfile({ ownerEmail: 'other@example.com', profileId: profile.profileId }), null);
  assert.throws(
    () => store.updateProductProfile({ ownerEmail: 'other@example.com', profileId: profile.profileId, idempotencyKey: 'other-update', patch: { name: '越权' } }),
    error => error?.code === 'PRODUCT_PROFILE_NOT_FOUND',
  );
});
