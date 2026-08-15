import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import { mountVideoWorkbenchRoutes } from '../server/videoWorkbenchRoutes.mjs';
import { authenticateContentRequest, createSessionTokenService } from '../server/billing/contentBilling.mjs';

const SESSION_SECRET = 'video-workbench-route-test-secret-video-workbench-route-test-secret';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    patch(path, handler) { routes.set(`PATCH ${path}`, handler); },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(app, method, path, request = {}) {
  const handler = app.routes.get(`${method} ${path}`);
  assert.ok(handler, `mounted ${method} ${path}`);
  const res = createResponse();
  await handler({
    headers: request.headers || {},
    body: request.body || {},
    params: request.params || {},
    query: request.query || {},
  }, res);
  return res;
}

function harness({ enabled = true } = {}) {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `route-${++sequence}`,
    now: () => new Date('2026-08-15T08:00:00.000Z'),
  });
  const ownerEmail = 'owner@example.com';
  const project = projectStore.createProject({ ownerEmail, kind: 'video', title: '品牌短片' });
  const store = createVideoWorkbenchStore({
    db,
    projectStore,
    randomUUID: () => `workbench-${++sequence}`,
    now: () => new Date('2026-08-15T08:00:00.000Z'),
  });
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  const app = createFakeApp();
  mountVideoWorkbenchRoutes(app, {
    enabled,
    store,
    authenticateOwner(req) {
      return authenticateContentRequest(req, {
        sessionTokens,
        authorizeEmail: email => ({ ok: true, email }),
      });
    },
  });
  return { app, db, project, store, sessionTokens, ownerEmail };
}

function signedHeaders(sessionTokens, email) {
  return { authorization: `Bearer ${sessionTokens.issue(email).token}` };
}

test('P1 workbench routes are absent while the feature flag is disabled', () => {
  const { app, db } = harness({ enabled: false });
  try {
    assert.equal(app.routes.size, 0);
  } finally {
    db.close();
  }
});

test('workbench routes derive owner from the signed session and ignore body owner fields', async t => {
  const { app, db, project, sessionTokens } = harness();
  t.after(() => db.close());
  const headers = signedHeaders(sessionTokens, 'owner@example.com');
  const created = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets', {
    headers,
    params: { projectId: project.id },
    body: { ownerEmail: 'attacker@example.com', kind: 'product', name: '耳机' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.asset.ownerEmail, 'owner@example.com');

  const read = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench', {
    headers: signedHeaders(sessionTokens, 'other@example.com'),
    params: { projectId: project.id },
  });
  assert.equal(read.statusCode, 404);
  assert.equal(read.body.code, 'PROJECT_NOT_FOUND');
});

test('workbench routes expose revisions and map conflicts without overwriting state', async t => {
  const { app, db, project, sessionTokens } = harness();
  t.after(() => db.close());
  const headers = signedHeaders(sessionTokens, 'owner@example.com');
  const asset = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets', {
    headers, params: { projectId: project.id }, body: { kind: 'product', name: '耳机' },
  });
  const version = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets/:assetId/versions', {
    headers, params: { projectId: project.id, assetId: asset.body.asset.id },
    body: { stableUrl: '/media/a.png', contentHash: 'hash-a', mimeType: 'image/png' },
  });
  const approved = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets/:assetId/approve', {
    headers, params: { projectId: project.id, assetId: asset.body.asset.id },
    body: { versionId: version.body.version.id, expectedRevision: 1 },
  });
  assert.equal(approved.statusCode, 200);
  const conflict = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets/:assetId/approve', {
    headers, params: { projectId: project.id, assetId: asset.body.asset.id },
    body: { versionId: version.body.version.id, expectedRevision: 1 },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.code, 'VERSION_CONFLICT');
});

test('workbench routes validate shot duration at the HTTP boundary', async t => {
  const { app, db, project, sessionTokens } = harness();
  t.after(() => db.close());
  const response = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/shots', {
    headers: signedHeaders(sessionTokens, 'owner@example.com'),
    params: { projectId: project.id },
    body: { position: 0, purpose: '开场', durationMs: 499 },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.code, 'INVALID_DURATION');
});

test('workbench route mounting requires dependencies only when enabled', () => {
  const app = createFakeApp();
  assert.doesNotThrow(() => mountVideoWorkbenchRoutes(app, { enabled: false }));
  assert.throws(() => mountVideoWorkbenchRoutes(app, { enabled: true }), /store is required/);
});
