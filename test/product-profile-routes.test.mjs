import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { mountProjectRoutes } from '../server/projects/projectRoutes.mjs';
import { authenticateContentRequest, createSessionTokenService } from '../server/billing/contentBilling.mjs';

const SESSION_SECRET = 'product-profile-route-test-secret-product-profile-route-test-secret';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
    routes,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(app, method, path, { headers = {}, body = {}, params = {}, query = {} } = {}) {
  const handler = app.routes.get(`${method} ${path}`);
  assert.ok(handler, `${method} ${path} is mounted`);
  const res = response();
  await handler({ headers, body, params, query }, res);
  return res;
}

function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `route-profile-${++sequence}`,
    now: () => new Date('2026-08-21T10:00:00.000Z'),
  });
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  const app = createFakeApp();
  mountProjectRoutes(app, {
    projectStore,
    authenticateOwner(req) {
      return authenticateContentRequest(req, { sessionTokens, authorizeEmail: email => ({ ok: true, email }) });
    },
  });
  return { db, app, projectStore, sessionTokens };
}

function headers(sessionTokens, email, key = '') {
  return {
    authorization: `Bearer ${sessionTokens.issue(email).token}`,
    ...(key ? { 'idempotency-key': key } : {}),
  };
}

test('product profile routes use the signed owner and support idempotent create/read/update/archive', async t => {
  const { db, app, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'profile-route-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '档案来源' });
  const asset = projectStore.createProjectAsset({
    ownerEmail: owner,
    projectId: project.id,
    assetId: 'profile-route-image',
    role: 'product',
    stableUrl: '/api/uploads/profile-route-image.png',
    contentHash: 'profile-route-hash',
    mimeType: 'image/png',
    retentionClass: 'source',
  });
  const input = {
    ownerEmail: 'attacker@example.com',
    name: '路由商品',
    category: '家居',
    facts: { material: '玻璃' },
    assets: [{ projectId: project.id, projectAssetId: asset.projectAssetId, role: 'product', expectedContentHash: asset.contentHash }],
  };
  const created = await invoke(app, 'POST', '/api/product-profiles', {
    headers: headers(sessionTokens, owner, 'profile-route-create'), body: input,
  });
  const replay = await invoke(app, 'POST', '/api/product-profiles', {
    headers: headers(sessionTokens, owner, 'profile-route-create'), body: input,
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.profile.name, '路由商品');
  assert.equal(created.body.profile.ownerEmail, undefined);
  assert.equal(replay.body.profile.profileId, created.body.profile.profileId);

  const listed = await invoke(app, 'GET', '/api/product-profiles', {
    headers: headers(sessionTokens, owner), query: { status: 'active' },
  });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.profiles.length, 1);

  const updated = await invoke(app, 'PATCH', '/api/product-profiles/:profileId', {
    headers: headers(sessionTokens, owner, 'profile-route-update'),
    params: { profileId: created.body.profile.profileId },
    body: { name: '更新商品' },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.profile.name, '更新商品');

  const archived = await invoke(app, 'POST', '/api/product-profiles/:profileId/archive', {
    headers: headers(sessionTokens, owner),
    params: { profileId: created.body.profile.profileId },
  });
  assert.equal(archived.statusCode, 200);
  assert.equal(archived.body.profile.status, 'archived');

  const denied = await invoke(app, 'GET', '/api/product-profiles/:profileId', {
    headers: headers(sessionTokens, 'other@example.com'),
    params: { profileId: created.body.profile.profileId },
  });
  assert.equal(denied.statusCode, 404);
});
