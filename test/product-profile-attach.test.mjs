import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { mountProjectRoutes } from '../server/projects/projectRoutes.mjs';

// 契约：生成结果(owned project asset)可以按 assetId 追加挂到商品档案的弱关联表，
// 重复挂载自动去重；他人资产/缺失资产被拒绝。
function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `attach-profile-${++sequence}`,
    now: () => new Date('2026-08-25T10:00:00.000Z'),
  });
  const routes = new Map();
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
  };
  mountProjectRoutes(app, { projectStore, authenticateOwner: req => req.authEmail });
  return { db, projectStore, routes };
}

async function invoke(routes, method, path, body, authEmail, profileId) {
  const handler = routes.get(`${method} ${path}`);
  assert.ok(handler, `${method} ${path} is mounted`);
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ headers: {}, body, params: { profileId }, query: {}, authEmail }, res);
  return res;
}

test('attach merges owned generated assets into the profile weak association', async t => {
  const { db, projectStore, routes } = createHarness();
  t.after(() => db.close());
  const owner = 'attach-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '生成项目' });
  const generated = projectStore.createProjectAsset({
    ownerEmail: owner,
    projectId: project.id,
    assetId: 'a'.repeat(64) + '.jpg',
    role: 'generated',
    stableUrl: '/api/generated-assets/' + 'a'.repeat(64) + '.jpg',
    contentHash: 'a'.repeat(64),
    mimeType: 'image/jpeg',
    retentionClass: 'completed',
  });

  const created = projectStore.createProductProfile({
    ownerEmail: owner,
    idempotencyKey: 'attach-create-1',
    name: '珍珠白耳机',
    category: '数码',
  });

  const first = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ assetId: generated.assetId, role: 'main_image' }] }, owner, created.profileId);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.added, 1);
  assert.equal(first.body.profile.profileId, created.profileId);
  assert.equal(first.body.profile.assets.length, 1);
  assert.equal(first.body.profile.assets[0].role, 'generated');
  assert.equal(first.body.profile.assets[0].expectedContentHash, 'a'.repeat(64));

  // 重复挂载去重
  const replay = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ assetId: generated.assetId }] }, owner, created.profileId);
  assert.equal(replay.body.added, 0);
  assert.equal(replay.body.profile.assets.length, 1);

  // 显式引用形式同样可挂载
  const explicit = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ projectId: project.id, projectAssetId: generated.projectAssetId, role: 'product', expectedContentHash: generated.contentHash }] }, owner, created.profileId);
  assert.equal(explicit.body.added, 1);
  assert.equal(explicit.body.profile.assets.length, 2);

  const stored = db.prepare('SELECT COUNT(*) AS n FROM product_profile_assets WHERE profile_id = ?').get(created.profileId);
  assert.equal(stored.n, 2);
});

test('attach rejects foreign or unknown assets and missing profiles', async t => {
  const { db, projectStore, routes } = createHarness();
  t.after(() => db.close());
  const owner = 'attach-guard@example.com';
  const intruder = 'intruder@example.com';
  const project = projectStore.createProject({ ownerEmail: intruder, kind: 'ecommerce', title: '他人项目' });
  const foreign = projectStore.createProjectAsset({
    ownerEmail: intruder,
    projectId: project.id,
    assetId: 'b'.repeat(64) + '.png',
    role: 'generated',
    stableUrl: '/api/generated-assets/' + 'b'.repeat(64) + '.png',
    contentHash: 'b'.repeat(64),
    mimeType: 'image/png',
    retentionClass: 'completed',
  });
  const created = projectStore.createProductProfile({
    ownerEmail: owner,
    idempotencyKey: 'attach-create-2',
    name: '陶瓷杯',
  });

  // 他人的生成资产：按 assetId 解析时被 owner 过滤直接拒绝
  const stolen = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ assetId: foreign.assetId }] }, owner, created.profileId);
  assert.equal(stolen.statusCode, 404);
  assert.equal(stolen.body.code, 'PRODUCT_PROFILE_ASSET_NOT_FOUND');

  // 不存在的资产同样拒绝
  const missing = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ assetId: 'c'.repeat(64) + '.jpg' }] }, owner, created.profileId);
  assert.equal(missing.statusCode, 404);

  // 档案不存在（含越权 profileId）拒绝
  const noProfile = await invoke(routes, 'POST', '/api/product-profiles/:profileId/assets/attach',
    { assets: [{ assetId: foreign.assetId }] }, intruder, created.profileId);
  assert.equal(noProfile.statusCode, 404);
  assert.equal(noProfile.body.code, 'PRODUCT_PROFILE_NOT_FOUND');
});
