import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { mountProjectRoutes } from '../server/projects/projectRoutes.mjs';
import { authenticateContentRequest, createSessionTokenService } from '../server/billing/contentBilling.mjs';

const SESSION_SECRET = 'project-route-test-secret-project-route-test-secret';

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
  await handler({ headers: request.headers || {}, body: request.body || {}, params: request.params || {}, query: request.query || {} }, res);
  return res;
}

function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `project-route-${++sequence}`,
    now: () => new Date('2026-07-27T10:00:00.000Z'),
  });
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  const app = createFakeApp();
  mountProjectRoutes(app, {
    projectStore,
    authenticateOwner(req) {
      return authenticateContentRequest(req, { sessionTokens, authorizeEmail: email => ({ ok: true, email }) });
    },
  });
  return { app, db, sessionTokens };
}

function signedHeaders(sessionTokens, email, idempotencyKey = '') {
  return {
    authorization: `Bearer ${sessionTokens.issue(email).token}`,
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
}

test('GET /api/session rejects an unsigned request and returns the signed owner', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());

  const unsigned = await invoke(app, 'GET', '/api/session');
  const signed = await invoke(app, 'GET', '/api/session', { headers: signedHeaders(sessionTokens, 'owner@example.com') });

  assert.equal(unsigned.statusCode, 401);
  assert.equal(unsigned.body.code, 'AUTH_SESSION_REQUIRED');
  assert.deepEqual(signed.body, { ok: true, email: 'owner@example.com' });
});
test('project creation trusts the signed owner and replays an idempotent request', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());
  const headers = signedHeaders(sessionTokens, 'trusted@example.com', 'create-product-1');
  const request = { headers, body: { owner_email: 'attacker@example.com', kind: 'ecommerce', title: '夏季水杯' } };

  const first = await invoke(app, 'POST', '/api/projects', request);
  const replay = await invoke(app, 'POST', '/api/projects', request);

  assert.equal(first.statusCode, 201);
  assert.equal(first.body.project.ownerEmail, 'trusted@example.com');
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.body.project.id, first.body.project.id);
});

test('project and version routes return 404 for a different signed owner', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());
  const created = await invoke(app, 'POST', '/api/projects', {
    headers: signedHeaders(sessionTokens, 'owner@example.com', 'owner-project'),
    body: { kind: 'ecommerce' },
  });

  const read = await invoke(app, 'GET', '/api/projects/:projectId', {
    headers: signedHeaders(sessionTokens, 'other@example.com'),
    params: { projectId: created.body.project.id },
  });
  const version = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    headers: signedHeaders(sessionTokens, 'other@example.com', 'other-version'),
    params: { projectId: created.body.project.id },
    body: { reason: 'manual_save' },
  });

  assert.equal(read.statusCode, 404);
  assert.equal(read.body.code, 'PROJECT_NOT_FOUND');
  assert.equal(version.statusCode, 404);
  assert.equal(version.body.code, 'PROJECT_NOT_FOUND');
});

test('signed owners can create an explicit recovery checkpoint and complete their project', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());
  const headers = signedHeaders(sessionTokens, 'owner@example.com', 'project-lifecycle');
  const projectResponse = await invoke(app, 'POST', '/api/projects', {
    headers,
    body: { kind: 'ecommerce', title: '待恢复的水杯套图' },
  });
  const versionResponse = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    headers,
    params: { projectId: projectResponse.body.project.id },
    body: { reason: 'generation', inputSnapshot: { description: '水杯' } },
  });
  const checkpoint = await invoke(app, 'POST', '/api/projects/:projectId/checkpoints', {
    headers,
    params: { projectId: projectResponse.body.project.id },
    body: { versionId: versionResponse.body.version.id, reason: 'payment_required' },
  });

  assert.equal(checkpoint.statusCode, 201);
  assert.equal(checkpoint.body.checkpoint.project.id, projectResponse.body.project.id);
  assert.deepEqual(checkpoint.body.checkpoint.version.inputSnapshot, { description: '水杯' });

  const resultVersion = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    headers,
    params: { projectId: projectResponse.body.project.id },
    body: { reason: 'accepted_result', inputSnapshot: { description: '水杯' } },
  });
  const completed = await invoke(app, 'POST', '/api/projects/:projectId/complete', {
    headers,
    params: { projectId: projectResponse.body.project.id },
    body: { acceptedVersionId: resultVersion.body.version.id },
  });

  assert.equal(completed.statusCode, 200);
  assert.equal(completed.body.project.status, 'completed');
});
