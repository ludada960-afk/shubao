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
  return { app, db, projectStore, sessionTokens };
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

test('project asset read routes are owner-scoped and support media filtering', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: '素材读取' });
  const video = projectStore.createProjectAsset({ ownerEmail: owner, projectId: project.id, assetId: 'video-1', stableUrl: '/api/video/assets/video-1', contentHash: 'video-hash', mimeType: 'video/mp4' });
  projectStore.createProjectAsset({ ownerEmail: owner, projectId: project.id, assetId: 'image-1', stableUrl: '/api/generated-assets/image-1.webp', contentHash: 'image-hash', mimeType: 'image/webp' });

  const listed = await invoke(app, 'GET', '/api/projects/:projectId/assets', { headers: signedHeaders(sessionTokens, owner), params: { projectId: project.id }, query: { mediaKind: 'video' } });
  const read = await invoke(app, 'GET', '/api/projects/:projectId/assets/:assetId', { headers: signedHeaders(sessionTokens, owner), params: { projectId: project.id, assetId: video.projectAssetId } });
  const denied = await invoke(app, 'GET', '/api/projects/:projectId/assets/:assetId', { headers: signedHeaders(sessionTokens, 'other@example.com'), params: { projectId: project.id, assetId: video.projectAssetId } });

  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.assets.length, 1);
  assert.equal(listed.body.assets[0].mediaKind, 'video');
  assert.equal(read.body.asset.projectAssetId, video.projectAssetId);
  assert.equal(denied.statusCode, 404);
  assert.equal(denied.body.code, 'PROJECT_NOT_FOUND');
});

test('unified project asset library is signed, filtered, and display-safe', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'library-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '统一素材库' });
  projectStore.createProjectAsset({ ownerEmail: owner, projectId: project.id, assetId: 'library-image', stableUrl: '/api/generated-assets/library-image.webp', contentHash: 'library-image-hash', mimeType: 'image/webp' });
  const listed = await invoke(app, 'GET', '/api/project-assets', {
    headers: signedHeaders(sessionTokens, owner),
    query: { mediaKind: 'image', projectKind: 'ecommerce', limit: '20' },
  });
  const denied = await invoke(app, 'GET', '/api/project-assets', {
    headers: signedHeaders(sessionTokens, 'other@example.com'),
    query: { mediaKind: 'image' },
  });

  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.assets.length, 1);
  assert.equal(listed.body.assets[0].project.title, '统一素材库');
  assert.equal('ownerEmail' in listed.body.assets[0], false);
  assert.equal(denied.statusCode, 200);
  assert.deepEqual(denied.body.assets, []);
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

test('Canvas sessions are created, explicitly saved, and restored only by their signed owner', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());
  const ownerHeaders = signedHeaders(sessionTokens, 'canvas-owner@example.com', 'canvas-project');
  const project = await invoke(app, 'POST', '/api/projects', {
    headers: ownerHeaders,
    body: { kind: 'ecommerce', title: '水杯画布' },
  });
  const version = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    headers: ownerHeaders,
    params: { projectId: project.body.project.id },
    body: { reason: 'accepted_result' },
  });
  const created = await invoke(app, 'POST', '/api/canvas-sessions', {
    headers: ownerHeaders,
    body: {
      projectId: project.body.project.id,
      baseVersionId: version.body.version.id,
      snapshot: { nodes: [{ id: 'source-1' }], connections: [], viewport: { x: 80, y: 40, scale: 1 } },
    },
  });

  const denied = await invoke(app, 'GET', '/api/canvas-sessions/:sessionId', {
    headers: signedHeaders(sessionTokens, 'other@example.com'),
    params: { sessionId: created.body.session.id },
  });
  const saved = await invoke(app, 'POST', '/api/canvas-sessions/:sessionId/save', {
    headers: ownerHeaders,
    params: { sessionId: created.body.session.id },
    body: {
      expectedRevision: 1,
      snapshot: { nodes: [{ id: 'source-1' }, { id: 'output-1' }], connections: [{ from: 'source-1', to: 'output-1' }], viewport: { x: 12, y: 24, scale: 0.8 } },
    },
  });
  const restored = await invoke(app, 'GET', '/api/canvas-sessions/:sessionId', {
    headers: ownerHeaders,
    params: { sessionId: created.body.session.id },
  });

  assert.equal(denied.statusCode, 404);
  assert.equal(saved.body.session.revision, 2);
  assert.equal(restored.body.session.id, created.body.session.id);
  assert.deepEqual(restored.body.session.snapshot.viewport, { x: 12, y: 24, scale: 0.8 });
  assert.deepEqual(restored.body.session.snapshot.connections, [{ from: 'source-1', to: 'output-1' }]);
});

test('project completion route cannot rewrite any ecommerce generation terminal state', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());

  for (const [status, expectedProjectStatus] of [
    ['completed', 'completed'],
    ['needs_review', 'needs_review'],
    ['failed', 'abandoned'],
    ['cancelled', 'abandoned'],
  ]) {
    const ownerEmail = `${status}@example.com`;
    const generationRunId = `route-terminal-${status}`;
    const linked = projectStore.ensureEcommerceGeneration({
      ownerEmail,
      generationRunId,
      title: `terminal ${status}`,
      inputSnapshot: { description: '测试商品' },
      planSnapshot: { fingerprint: `terminal-${status}`, items: [{ id: 'main-1' }] },
    });
    if (status === 'completed') {
      projectStore.completeEcommerceGeneration({
        ownerEmail,
        generationRunId,
        resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/final.png' } },
      });
    } else {
      projectStore.terminateEcommerceGeneration({ ownerEmail, generationRunId, terminalStatus: status });
    }

    const response = await invoke(app, 'POST', '/api/projects/:projectId/complete', {
      headers: signedHeaders(sessionTokens, ownerEmail),
      params: { projectId: linked.project.id },
      body: { acceptedVersionId: linked.sourceVersion.id, generationRunId },
    });

    assert.equal(response.statusCode, 409, status);
    assert.equal(response.body.code, 'GENERATION_RUN_TERMINAL_CONFLICT', status);

    const omittedRunId = await invoke(app, 'POST', '/api/projects/:projectId/complete', {
      headers: signedHeaders(sessionTokens, ownerEmail),
      params: { projectId: linked.project.id },
      body: { acceptedVersionId: linked.sourceVersion.id },
    });
    assert.equal(omittedRunId.statusCode, 409, `${status} without generationRunId`);
    assert.equal(omittedRunId.body.code, 'GENERATION_RUN_TERMINAL_CONFLICT', `${status} without generationRunId`);

    assert.equal(projectStore.getProject({ ownerEmail, projectId: linked.project.id }).status, expectedProjectStatus, status);
    assert.equal(db.prepare('SELECT status FROM project_generation_runs WHERE id = ?').get(generationRunId).status, status);
  }
});

test('accepting a partial result completes the project without rewriting its reviewed run', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'partial-accept@example.com';
  const generationRunId = 'route-partial-accept';
  projectStore.ensureEcommerceGeneration({
    ownerEmail,
    generationRunId,
    title: '可接受的部分结果',
    inputSnapshot: { description: '测试商品' },
    planSnapshot: { fingerprint: 'partial-accept', items: [{ id: 'main-1' }, { id: 'detail-1' }] },
  });
  const reviewed = projectStore.completeEcommerceGeneration({
    ownerEmail,
    generationRunId,
    terminalStatus: 'needs_review',
    resultInputSnapshot: { images: { 'main-1': '/api/generated-assets/partial.png' } },
  });

  const response = await invoke(app, 'POST', '/api/projects/:projectId/complete', {
    headers: signedHeaders(sessionTokens, ownerEmail),
    params: { projectId: reviewed.project.id },
    body: { acceptedVersionId: reviewed.resultVersion.id },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.project.status, 'completed');
  assert.equal(response.body.project.acceptedVersionId, reviewed.resultVersion.id);
  assert.equal(db.prepare('SELECT status FROM project_generation_runs WHERE id = ?').get(generationRunId).status, 'needs_review');
});
