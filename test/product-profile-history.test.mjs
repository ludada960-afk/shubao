import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { mountProjectRoutes } from '../server/projects/projectRoutes.mjs';
import { authenticateContentRequest, createSessionTokenService } from '../server/billing/contentBilling.mjs';

const SESSION_SECRET = 'product-profile-history-test-secret-product-profile-history-test';

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `history-${++sequence}`,
    now: () => new Date('2026-08-30T10:00:00.000Z'),
  });
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  return { db, projectStore, sessionTokens };
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

test('product profile history: PATCH 保留前态，不覆盖；archive 写 archive 记录', t => {
  const { db, projectStore } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'history-owner@example.com';
  const project = projectStore.createProject({ ownerEmail, kind: 'ecommerce', title: 'history demo' });
  const asset = sourceAsset(projectStore, ownerEmail, project.id);

  const created = projectStore.createProductProfile({
    ownerEmail,
    idempotencyKey: 'history-create-1',
    name: '初版商品',
    category: '家居',
    facts: { material: '陶瓷' },
    variants: [{ color: '白色', spec: '标准', count: 1 }],
    assets: [{
      projectId: project.id, projectAssetId: asset.projectAssetId,
      role: 'product', expectedContentHash: asset.contentHash,
    }],
  });

  // 第一次 PATCH: 改名 + 改 facts + 改 variants + 改 assets
  const firstPatch = projectStore.updateProductProfile({
    ownerEmail,
    profileId: created.profileId,
    idempotencyKey: 'history-patch-1',
    patch: {
      name: '改后商品',
      facts: { material: '玻璃' },
      variants: [{ color: '透明', count: 2 }],
    },
    actorEmail: ownerEmail,
  });
  assert.equal(firstPatch.name, '改后商品');
  assert.equal(firstPatch.facts.material, '玻璃');
  assert.equal(firstPatch.variants[0].color, '透明');

  // 第二次 PATCH: 只改 status
  projectStore.updateProductProfile({
    ownerEmail,
    profileId: created.profileId,
    idempotencyKey: 'history-patch-2',
    patch: { status: 'archived' },
    actorEmail: ownerEmail,
  });

  // 直接 archive 接口
  projectStore.archiveProductProfile({
    ownerEmail,
    profileId: created.profileId,
    actorEmail: ownerEmail,
  });

  // 检查 history: 应该有 1 条 update(第一次 patch 的前态 = 初版) + 1 条 update(第二次的前态 = 改后)
  // + 1 条 archive(archive 前的前态 = archived)
  const history = projectStore.listProductProfileHistory({
    ownerEmail, profileId: created.profileId, limit: 50,
  });
  assert.equal(history.length, 3);
  // 按 created_at DESC 排: 最新在前
  assert.equal(history[0].changeKind, 'archive');
  assert.equal(history[0].actorEmail, ownerEmail);
  assert.equal(history[0].payload.previous.name, '改后商品');
  assert.equal(history[0].payload.previous.status, 'archived');
  assert.equal(history[1].changeKind, 'update');
  assert.equal(history[1].payload.previous.name, '改后商品');
  assert.equal(history[1].payload.patch.name, undefined);
  assert.deepEqual(history[1].payload.patch.status, 'archived');
  assert.equal(history[2].changeKind, 'update');
  assert.equal(history[2].payload.previous.name, '初版商品');
  assert.equal(history[2].payload.previous.facts.material, '陶瓷');
  // variants 在 hydrateProductProfile 序列化后带默认空字符串字段; 用对象形状比较
  assert.equal(history[2].payload.patch.variants.length, 1);
  assert.equal(history[2].payload.patch.variants[0].color, '透明');
  assert.equal(history[2].payload.patch.variants[0].count, 2);
  assert.equal(history[2].actorEmail, ownerEmail);

  // 当前 profile 已经是 archived
  const current = projectStore.getProductProfile({ ownerEmail, profileId: created.profileId });
  assert.equal(current.status, 'archived');
  assert.equal(current.name, '改后商品');
  // 但 history 表里仍然保留 "初版商品" 的完整快照
  assert.equal(history[2].payload.previous.variants[0].color, '白色');
  assert.equal(history[2].payload.previous.assets.length, 1);
  assert.equal(history[2].payload.previous.assets[0].projectAssetId, asset.projectAssetId);
});

test('product profile history: 越权读取 history 抛 PRODUCT_PROFILE_NOT_FOUND', t => {
  const { db, projectStore } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'history-owner-2@example.com';
  const project = projectStore.createProject({ ownerEmail, kind: 'ecommerce', title: 'cross owner' });
  const asset = sourceAsset(projectStore, ownerEmail, project.id, 'cross-asset');
  const created = projectStore.createProductProfile({
    ownerEmail,
    idempotencyKey: 'history-cross-1',
    name: '私有商品',
    assets: [{
      projectId: project.id, projectAssetId: asset.projectAssetId,
      role: 'product', expectedContentHash: asset.contentHash,
    }],
  });
  assert.throws(
    () => projectStore.listProductProfileHistory({
      ownerEmail: 'attacker@example.com', profileId: created.profileId,
    }),
    error => error?.code === 'PRODUCT_PROFILE_NOT_FOUND',
  );
});

test('product profile history: PATCH 幂等键命中不写新 history 行', t => {
  const { db, projectStore } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'history-owner-3@example.com';
  const project = projectStore.createProject({ ownerEmail, kind: 'ecommerce', title: 'idem' });
  const asset = sourceAsset(projectStore, ownerEmail, project.id, 'idem-asset');
  const created = projectStore.createProductProfile({
    ownerEmail,
    idempotencyKey: 'history-idem-create',
    name: 'id 商品',
    assets: [{
      projectId: project.id, projectAssetId: asset.projectAssetId,
      role: 'product', expectedContentHash: asset.contentHash,
    }],
  });
  const first = projectStore.updateProductProfile({
    ownerEmail, profileId: created.profileId,
    idempotencyKey: 'history-idem-1', patch: { name: '改名' }, actorEmail: ownerEmail,
  });
  const replay = projectStore.updateProductProfile({
    ownerEmail, profileId: created.profileId,
    idempotencyKey: 'history-idem-1', patch: { name: '改名' }, actorEmail: ownerEmail,
  });
  assert.equal(first.profileId, replay.profileId);
  const history = projectStore.listProductProfileHistory({
    ownerEmail, profileId: created.profileId, limit: 50,
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].payload.previous.name, 'id 商品');
});

test('product profile history: GET /api/product-profiles/:id/history 仅 owner 可见', async t => {
  const { db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'history-route-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: 'route history' });
  const asset = sourceAsset(projectStore, owner, project.id, 'route-asset');
  const created = projectStore.createProductProfile({
    ownerEmail: owner, idempotencyKey: 'history-route-create',
    name: 'route 起始名',
    assets: [{
      projectId: project.id, projectAssetId: asset.projectAssetId,
      role: 'product', expectedContentHash: asset.contentHash,
    }],
  });
  projectStore.updateProductProfile({
    ownerEmail: owner, profileId: created.profileId,
    idempotencyKey: 'history-route-patch',
    patch: { name: 'route 改后' }, actorEmail: owner,
  });

  const routes = new Map();
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
  };
  mountProjectRoutes(app, {
    projectStore,
    authenticateOwner(req) {
      return authenticateContentRequest(req, {
        sessionTokens,
        authorizeEmail: email => ({ ok: true, email }),
      });
    },
  });
  const handler = routes.get('GET /api/product-profiles/:profileId/history');
  assert.ok(handler, 'GET /api/product-profiles/:profileId/history 路由已挂载');

  function response() {
    return {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
  }

  const ownHeaders = { authorization: `Bearer ${sessionTokens.issue(owner).token}` };
  const ownRes = response();
  await handler({ headers: ownHeaders, params: { profileId: created.profileId } }, ownRes);
  assert.equal(ownRes.statusCode, 200);
  assert.ok(Array.isArray(ownRes.body.entries));
  assert.equal(ownRes.body.entries.length, 1);
  assert.equal(ownRes.body.entries[0].changeKind, 'update');
  assert.equal(ownRes.body.entries[0].actorEmail, owner);
  assert.equal(ownRes.body.entries[0].payload.previous.name, 'route 起始名');

  const otherHeaders = { authorization: `Bearer ${sessionTokens.issue('other@example.com').token}` };
  const otherRes = response();
  await handler({ headers: otherHeaders, params: { profileId: created.profileId } }, otherRes);
  assert.equal(otherRes.statusCode, 404);
  assert.equal(otherRes.body.code, 'PRODUCT_PROFILE_NOT_FOUND');
});

test('product profile history: schema 表与索引已就绪', t => {
  const { db, projectStore } = createHarness();
  t.after(() => db.close());
  const columns = db.prepare("PRAGMA table_info(product_profile_history)").all().map(c => c.name);
  for (const col of ['id', 'profile_id', 'owner_email', 'change_kind', 'payload_json', 'actor_email', 'created_at']) {
    assert.ok(columns.includes(col), `product_profile_history 缺少列 ${col}`);
  }
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'product_profile_history'").all()
    .map(row => row.name);
  assert.ok(indexes.includes('idx_product_profile_history_profile'));
  // 不存在的 profileId 在 owner 维度抛 PRODUCT_PROFILE_NOT_FOUND
  assert.throws(
    () => projectStore.listProductProfileHistory({
      ownerEmail: 'history-owner-4@example.com',
      profileId: 'non-existent',
    }),
    error => error?.code === 'PRODUCT_PROFILE_NOT_FOUND',
  );
});
