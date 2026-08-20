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

function createHarness({ importVideoAsset = null, importImageAsset = null, registerGeneratedAsset = null } = {}) {
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
    importVideoAsset,
    importImageAsset,
    registerGeneratedAsset,
    resolveAssetPlaybackUrl({ asset, ownerEmail }) {
      return asset.mediaKind === 'video'
        ? `/api/video/media/${asset.assetId}?owner=${encodeURIComponent(ownerEmail)}&cap=test-capability`
        : '';
    },
    authenticateOwner(req) {
      return authenticateContentRequest(req, { sessionTokens, authorizeEmail: email => ({ ok: true, email }) });
    },
  });
  return { app, db, projectStore, sessionTokens };
}

test('registers a verified generated image through the signed project asset route', async t => {
  const calls = [];
  const { app, db, projectStore, sessionTokens } = createHarness({
    registerGeneratedAsset: async input => {
      calls.push(input);
      return {
        projectAssetId: 'project-asset-generated',
        projectId: input.projectId,
        assetId: input.assetId,
        stableUrl: input.stableUrl,
        mediaKind: 'image',
      };
    },
  });
  t.after(() => db.close());
  const owner = 'generated-route-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '生成资产归档' });
  const version = projectStore.createVersion({ ownerEmail: owner, projectId: project.id, reason: 'manual_save' });
  const assetId = `${'a'.repeat(64)}.png`;
  const response = await invoke(app, 'POST', '/api/projects/:projectId/assets/register-generated', {
    headers: signedHeaders(sessionTokens, owner),
    params: { projectId: project.id },
    body: {
      versionId: version.id,
      assetId,
      stableUrl: `/api/generated-assets/${assetId}`,
      role: 'canvas-output',
      metadata: { source: 'canvas' },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.asset.projectAssetId, 'project-asset-generated');
  assert.deepEqual(calls, [{
    ownerEmail: owner,
    projectId: project.id,
    versionId: version.id,
    assetId,
    stableUrl: `/api/generated-assets/${assetId}`,
    role: 'canvas-output',
    metadata: { source: 'canvas' },
  }]);
});

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

test('version creation replays an idempotent request without creating a second version', async t => {
  const { app, db, sessionTokens } = createHarness();
  t.after(() => db.close());
  const projectResponse = await invoke(app, 'POST', '/api/projects', {
    headers: signedHeaders(sessionTokens, 'version-owner@example.com', 'version-project'),
    body: { kind: 'video', title: 'Canvas 媒体项目' },
  });
  const projectId = projectResponse.body.project.id;
  const request = {
    headers: signedHeaders(sessionTokens, 'version-owner@example.com', 'canvas-media-version:one'),
    params: { projectId },
    body: { reason: 'manual_save', inputSnapshot: { surface: 'canvas' } },
  };
  const first = await invoke(app, 'POST', '/api/projects/:projectId/versions', request);
  const replay = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    ...request,
    body: { reason: 'manual_save', inputSnapshot: { surface: 'canvas' } },
  });

  assert.equal(first.statusCode, 201);
  assert.equal(replay.statusCode, 201);
  assert.equal(replay.body.version.id, first.body.version.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_versions WHERE project_id = ?').get(projectId).count, 1);
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
  const lineage = await invoke(app, 'GET', '/api/projects/:projectId/assets/:assetId/lineage', { headers: signedHeaders(sessionTokens, owner), params: { projectId: project.id, assetId: video.projectAssetId } });
  const denied = await invoke(app, 'GET', '/api/projects/:projectId/assets/:assetId', { headers: signedHeaders(sessionTokens, 'other@example.com'), params: { projectId: project.id, assetId: video.projectAssetId } });
  const deniedLineage = await invoke(app, 'GET', '/api/projects/:projectId/assets/:assetId/lineage', { headers: signedHeaders(sessionTokens, 'other@example.com'), params: { projectId: project.id, assetId: video.projectAssetId } });

  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.assets.length, 1);
  assert.equal(listed.body.assets[0].mediaKind, 'video');
  assert.equal(read.body.asset.projectAssetId, video.projectAssetId);
  assert.equal(read.body.asset.stableUrl, '/api/video/assets/video-1');
  assert.match(read.body.asset.playbackUrl, /^\/api\/video\/media\/video-1\?/);
  assert.equal(lineage.statusCode, 200);
  assert.equal(lineage.body.lineage.asset.projectAssetId, video.projectAssetId);
  assert.deepEqual(lineage.body.lineage.parents, []);
  assert.equal(denied.statusCode, 404);
  assert.equal(denied.body.code, 'PROJECT_NOT_FOUND');
  assert.equal(deniedLineage.statusCode, 404);
  assert.equal(deniedLineage.body.code, 'PROJECT_NOT_FOUND');
});

test('imports an owner-scoped uploaded media asset into the project asset library', async t => {
  const imported = [];
  const { app, db, projectStore, sessionTokens } = createHarness({
    importVideoAsset: async input => {
      imported.push(input);
      return projectStore.createProjectAsset({
        ownerEmail: input.ownerEmail,
        projectId: input.projectId,
        assetId: input.videoAssetId,
        role: input.role,
        stableUrl: `/api/video/assets/${input.videoAssetId}`,
        contentHash: 'b'.repeat(64),
        mimeType: 'audio/mpeg',
        metadata: input.metadata,
      });
    },
  });
  t.after(() => db.close());
  const owner = 'owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: '上传媒体' });
  const response = await invoke(app, 'POST', '/api/projects/:projectId/assets/import-media', {
    headers: signedHeaders(sessionTokens, owner),
    params: { projectId: project.id },
    body: {
      ownerEmail: 'attacker@example.com',
      videoAssetId: 'voice-1.mp3',
      role: 'voice',
      metadata: { displayName: '旁白' },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.asset.projectId, project.id);
  assert.equal(response.body.asset.mediaKind, 'audio');
  assert.equal(imported.length, 1);
  assert.equal(imported[0].ownerEmail, owner);
  assert.equal(imported[0].projectId, project.id);
  assert.equal(imported[0].videoAssetId, 'voice-1.mp3');
  assert.equal(imported[0].metadata.displayName, '旁白');
});

test('media import is unavailable instead of accepting a raw client asset id', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const project = projectStore.createProject({ ownerEmail: 'owner@example.com', kind: 'video', title: '未启用上传导入' });
  const response = await invoke(app, 'POST', '/api/projects/:projectId/assets/import-media', {
    headers: signedHeaders(sessionTokens, 'owner@example.com'),
    params: { projectId: project.id },
    body: { videoAssetId: 'forged', role: 'reference' },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'PROJECT_MEDIA_IMPORT_UNAVAILABLE');
});

test('imports an owner-scoped ecommerce image into the project asset library', async t => {
  const imported = [];
  const { app, db, projectStore, sessionTokens } = createHarness({
    importImageAsset: async input => {
      imported.push(input);
      return projectStore.createProjectAsset({
        ownerEmail: input.ownerEmail,
        projectId: input.projectId,
        assetId: input.imageAssetId,
        role: input.role,
        stableUrl: `/api/generated-assets/${input.imageAssetId}`,
        contentHash: 'c'.repeat(64),
        mimeType: 'image/png',
        metadata: input.metadata,
      });
    },
  });
  t.after(() => db.close());
  const owner = 'owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '上传图片' });
  const response = await invoke(app, 'POST', '/api/projects/:projectId/assets/import-media', {
    headers: signedHeaders(sessionTokens, owner),
    params: { projectId: project.id },
    body: {
      sourceKind: 'image',
      imageAssetId: `${'d'.repeat(64)}.png`,
      role: 'product',
      metadata: { displayName: '主商品图' },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.asset.mediaKind, 'image');
  assert.equal(imported.length, 1);
  assert.equal(imported[0].ownerEmail, owner);
  assert.equal(imported[0].imageAssetId, `${'d'.repeat(64)}.png`);
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

test('project asset retention changes are signed, owner-scoped, and idempotent', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'retention-route-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'ecommerce', title: '素材保留' });
  const asset = projectStore.createProjectAsset({
    ownerEmail: owner,
    projectId: project.id,
    assetId: 'retention-route-image',
    stableUrl: '/api/generated-assets/retention-route-image.webp',
    contentHash: 'retention-route-hash',
    mimeType: 'image/webp',
    retentionClass: 'generated',
  });

  const pinned = await invoke(app, 'PATCH', '/api/projects/:projectId/assets/:assetId/retention', {
    headers: signedHeaders(sessionTokens, owner),
    params: { projectId: project.id, assetId: asset.projectAssetId },
    body: { pinned: true },
  });
  const denied = await invoke(app, 'PATCH', '/api/projects/:projectId/assets/:assetId/retention', {
    headers: signedHeaders(sessionTokens, 'other@example.com'),
    params: { projectId: project.id, assetId: asset.projectAssetId },
    body: { pinned: true },
  });
  const invalid = await invoke(app, 'PATCH', '/api/projects/:projectId/assets/:assetId/retention', {
    headers: signedHeaders(sessionTokens, owner),
    params: { projectId: project.id, assetId: asset.projectAssetId },
    body: { pinned: 'true' },
  });

  assert.equal(pinned.statusCode, 200);
  assert.equal(pinned.body.asset.retentionPinned, true);
  assert.equal(pinned.body.asset.retentionClass, 'permanent');
  assert.equal(denied.statusCode, 404);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.body.code, 'PROJECT_ASSET_RETENTION_INVALID');
});

test('project asset playback URLs are transient and never replace the canonical stable URL', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'playback-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: '播放地址' });
  projectStore.createProjectAsset({
    ownerEmail: owner,
    projectId: project.id,
    assetId: 'preview-video',
    stableUrl: '/api/video/assets/preview-video',
    contentHash: 'preview-hash',
    mimeType: 'video/mp4',
  });

  const response = await invoke(app, 'GET', '/api/project-assets', {
    headers: signedHeaders(sessionTokens, owner),
    query: { mediaKind: 'video' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.assets[0].stableUrl, '/api/video/assets/preview-video');
  assert.match(response.body.assets[0].playbackUrl, /^\/api\/video\/media\/preview-video\?/);
});

test('Canvas session recovery remints transient media playback without changing the persisted identity', async t => {
  const { app, db, projectStore, sessionTokens } = createHarness();
  t.after(() => db.close());
  const owner = 'canvas-playback-owner@example.com';
  const project = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: 'Canvas 播放恢复' });
  const version = projectStore.createVersion({ ownerEmail: owner, projectId: project.id, reason: 'generation' });
  const asset = projectStore.createProjectAsset({
    ownerEmail: owner,
    projectId: project.id,
    versionId: version.id,
    assetId: 'canvas-video',
    stableUrl: '/api/video/assets/canvas-video',
    contentHash: 'canvas-video-hash',
    mimeType: 'video/mp4',
  });
  const playbackUrl = `/api/video/media/canvas-video?owner=${encodeURIComponent(owner)}&cap=test-capability`;
  const snapshot = {
    nodes: [{
      id: 'video-node',
      kind: 'video',
      url: playbackUrl,
      playbackUrl,
      assetRef: {
        projectId: project.id,
        projectAssetId: asset.projectAssetId,
        contentHash: asset.contentHash,
        stableUrl: asset.stableUrl,
        mediaKind: 'video',
        role: asset.role,
      },
    }],
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 },
  };

  const created = await invoke(app, 'POST', '/api/canvas-sessions', {
    headers: signedHeaders(sessionTokens, owner),
    body: { projectId: project.id, baseVersionId: version.id, snapshot },
  });
  const restored = await invoke(app, 'GET', '/api/canvas-sessions/:sessionId', {
    headers: signedHeaders(sessionTokens, owner),
    params: { sessionId: created.body.session.id },
  });
  const saved = await invoke(app, 'POST', '/api/canvas-sessions/:sessionId/save', {
    headers: signedHeaders(sessionTokens, owner),
    params: { sessionId: created.body.session.id },
    body: { expectedRevision: restored.body.session.revision, snapshot },
  });

  assert.equal(created.statusCode, 201);
  assert.match(created.body.session.snapshot.nodes[0].playbackUrl, /^\/api\/video\/media\/canvas-video\?/);
  assert.equal(created.body.session.snapshot.nodes[0].url, created.body.session.snapshot.nodes[0].playbackUrl);
  assert.equal(created.body.session.snapshot.nodes[0].assetRef.stableUrl, asset.stableUrl);
  assert.match(restored.body.session.snapshot.nodes[0].playbackUrl, /^\/api\/video\/media\/canvas-video\?/);
  assert.match(saved.body.session.snapshot.nodes[0].playbackUrl, /^\/api\/video\/media\/canvas-video\?/);
  assert.equal(saved.body.session.revision, restored.body.session.revision + 1);
  const persisted = projectStore.getCanvasSession({ ownerEmail: owner, sessionId: created.body.session.id }).snapshot;
  assert.equal(persisted.nodes[0].url, asset.stableUrl);
  assert.equal(persisted.nodes[0].playbackUrl, undefined);
  assert.equal(persisted.nodes[0].assetRef.stableUrl, asset.stableUrl);

  db.prepare('UPDATE canvas_sessions SET snapshot = ? WHERE id = ?').run(JSON.stringify(snapshot), created.body.session.id);
  const legacyRead = projectStore.getCanvasSession({ ownerEmail: owner, sessionId: created.body.session.id }).snapshot;
  assert.equal(legacyRead.nodes[0].url, asset.stableUrl);
  assert.equal(legacyRead.nodes[0].playbackUrl, undefined);
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
    headers: signedHeaders(sessionTokens, 'owner@example.com', 'project-lifecycle:source'),
    params: { projectId: projectResponse.body.project.id },
    body: { reason: 'generation', inputSnapshot: { description: '水杯' } },
  });
  const checkpoint = await invoke(app, 'POST', '/api/projects/:projectId/checkpoints', {
    headers: signedHeaders(sessionTokens, 'owner@example.com', 'project-lifecycle:checkpoint'),
    params: { projectId: projectResponse.body.project.id },
    body: { versionId: versionResponse.body.version.id, reason: 'payment_required' },
  });

  assert.equal(checkpoint.statusCode, 201);
  assert.equal(checkpoint.body.checkpoint.project.id, projectResponse.body.project.id);
  assert.deepEqual(checkpoint.body.checkpoint.version.inputSnapshot, { description: '水杯' });

  const resultVersion = await invoke(app, 'POST', '/api/projects/:projectId/versions', {
    headers: signedHeaders(sessionTokens, 'owner@example.com', 'project-lifecycle:result'),
    params: { projectId: projectResponse.body.project.id },
    body: { reason: 'accepted_result', inputSnapshot: { description: '水杯' } },
  });
  const completed = await invoke(app, 'POST', '/api/projects/:projectId/complete', {
    headers: signedHeaders(sessionTokens, 'owner@example.com', 'project-lifecycle:complete'),
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
