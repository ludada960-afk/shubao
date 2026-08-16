import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';
import { mountVideoWorkbenchRoutes } from '../server/videoWorkbenchRoutes.mjs';
import { createVideoWorkbenchRollout } from '../server/videoWorkbenchRollout.mjs';
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
    authorizeCohort: createVideoWorkbenchRollout({
      enabled,
      authorizeOwner: email => email === ownerEmail
        ? { ok: true, email }
        : { ok: false, code: 'ACCOUNT_ADMIN_FORBIDDEN' },
    }),
    playbackUrlForAsset({ assetId, ownerEmail }) {
      return `/api/video/media/${assetId}?owner=${encodeURIComponent(ownerEmail)}&cap=test-capability`;
    },
    authenticateOwner(req) {
      return authenticateContentRequest(req, {
        sessionTokens,
        authorizeEmail: email => ({ ok: true, email }),
      });
    },
  });
  return { app, db, project, store, sessionTokens, ownerEmail };
}

function seedCompletedVideoJob(db, ownerEmail, projectId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, status TEXT NOT NULL,
      project_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS video_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      content_type TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name)
    VALUES ('route-output', ?, 'output', 'video/mp4', 2048, 'route-output-hash', 'route-output.mp4')`).run(ownerEmail);
  db.prepare(`INSERT INTO video_jobs (id, owner_email, project_id, status, result_asset_id)
    VALUES ('route-job', ?, ?, 'completed', 'route-output')`).run(ownerEmail, projectId);
}

function seedUploadedVideoAsset(db, ownerEmail) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      content_type TEXT NOT NULL, bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO video_assets
    (id, owner_email, kind, content_type, bytes, sha256, file_name)
    VALUES ('route-upload', ?, 'image', 'image/webp', 3072, 'route-upload-hash', 'route-upload.webp')`)
    .run(ownerEmail);
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

test('owner can create and read an immutable replay manifest while tester remains denied', async t => {
  const { app, db, project, sessionTokens, store, ownerEmail } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail, projectId: project.id, kind: 'scene', name: 'studio' });
  const version = store.addAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/studio', contentHash: 'studio-hash', mimeType: 'image/png' });
  store.approveAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    versionId: version.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000 });
  store.bindShotAssetVersion({ ownerEmail, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: version.id, role: 'scene' });
  const path = '/api/video/projects/:projectId/workbench/replay-manifests';
  const created = await invoke(app, 'POST', path, {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id },
    body: { skillId: 'studio-trailer', skillVersion: 2, modelCatalogSnapshot: { image: 'gpt-image-2' },
      rightsConfirmations: [asset.id] },
  });
  assert.equal(created.statusCode, 201);
  const id = created.body.manifest.id;
  assert.equal(created.body.manifest.assets[0].versions[0].playbackUrl, undefined);
  const read = await invoke(app, 'GET', `${path}/:manifestId`, {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id, manifestId: id },
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.manifest.id, id);
  const forbiddenWriteTables = db.prepare(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN ('video_jobs', 'usage_ledger', 'wallet_transactions') ORDER BY name`).all();
  assert.deepEqual(forbiddenWriteTables, []);
  const denied = await invoke(app, 'GET', `${path}/:manifestId`, {
    headers: signedHeaders(sessionTokens, 'tester@example.com'), params: { projectId: project.id, manifestId: id },
  });
  assert.equal(denied.statusCode, 404);
});

test('workbench routes hide the owner pilot from a signed tester account', async t => {
  const { app, db, project, sessionTokens } = harness();
  t.after(() => db.close());
  const response = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench', {
    headers: signedHeaders(sessionTokens, 'tester@example.com'),
    params: { projectId: project.id },
  });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, {
    code: 'PROJECT_NOT_FOUND',
    error: '未找到该视频项目或内容',
  });
});

test('workbench routes expose revisions and map conflicts without overwriting state', async t => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  seedUploadedVideoAsset(db, ownerEmail);
  const headers = signedHeaders(sessionTokens, 'owner@example.com');
  const asset = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets', {
    headers, params: { projectId: project.id }, body: { kind: 'product', name: '耳机' },
  });
  const version = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/assets/:assetId/versions', {
    headers, params: { projectId: project.id, assetId: asset.body.asset.id },
    body: {
      videoAssetId: 'route-upload',
      stableUrl: 'https://attacker.invalid/image',
      contentHash: 'forged',
      mimeType: 'text/html',
    },
  });
  assert.equal(version.statusCode, 201);
  assert.equal(version.body.version.stableUrl, '/api/video/assets/route-upload');
  assert.equal(version.body.version.contentHash, 'route-upload-hash');
  assert.equal(version.body.version.mimeType, 'image/webp');
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

test('candidate route accepts only a completed owned job and ignores forged delivery fields', async t => {
  const { app, db, project, store, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  seedCompletedVideoJob(db, ownerEmail, project.id);
  const shot = store.createShot({ ownerEmail, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000 });
  const response = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/shots/:shotId/candidates', {
    headers: signedHeaders(sessionTokens, ownerEmail),
    params: { projectId: project.id, shotId: shot.id },
    body: {
      generationJobId: 'route-job', outputAssetId: 'forged', stableUrl: 'https://attacker.invalid/video',
      contentHash: 'forged', mimeType: 'text/html',
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.candidate.outputAssetId, 'route-output');
  assert.equal(response.body.candidate.stableUrl, '/api/video/assets/route-output');
  assert.equal(response.body.candidate.contentHash, 'route-output-hash');
  assert.equal(response.body.candidate.mimeType, 'video/mp4');
});

test('workbench read projects ephemeral playback capabilities without persisting them', async t => {
  const { app, db, project, store, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  seedUploadedVideoAsset(db, ownerEmail);
  seedCompletedVideoJob(db, ownerEmail, project.id);
  const asset = store.createAsset({ ownerEmail, projectId: project.id, kind: 'product', name: '耳机' });
  store.addAssetVersionFromVideoAsset({ ownerEmail, projectId: project.id, assetId: asset.id, videoAssetId: 'route-upload' });
  const shot = store.createShot({ ownerEmail, projectId: project.id, position: 0, purpose: '开场', durationMs: 3000 });
  store.registerCandidateFromJob({ ownerEmail, projectId: project.id, shotId: shot.id, generationJobId: 'route-job' });

  const response = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench', {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id },
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body.assets[0].versions[0].playbackUrl, /\/api\/video\/media\/route-upload\?.*cap=test-capability/);
  assert.match(response.body.shots[0].candidates[0].playbackUrl, /\/api\/video\/media\/route-output\?.*cap=test-capability/);
  assert.equal(response.body.assets[0].versions[0].stableUrl, '/api/video/assets/route-upload');
  assert.equal(response.body.shots[0].candidates[0].stableUrl, '/api/video/assets/route-output');
  const persisted = db.prepare('SELECT stable_url FROM video_workbench_asset_versions LIMIT 1').get();
  assert.equal(persisted.stable_url, '/api/video/assets/route-upload');
  assert.doesNotMatch(persisted.stable_url, /cap=/);
});

test('workbench route mounting requires dependencies only when enabled', () => {
  const app = createFakeApp();
  assert.doesNotThrow(() => mountVideoWorkbenchRoutes(app, { enabled: false }));
  assert.throws(() => mountVideoWorkbenchRoutes(app, { enabled: true }), /store is required/);
});
