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
    put(path, handler) { routes.set(`PUT ${path}`, handler); },
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); },
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

test('exposes sanitized proven Skill template metadata through the gated workbench route', async () => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  try {
    const response = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench/skill-templates', {
      params: { projectId: project.id },
      headers: signedHeaders(sessionTokens, ownerEmail),
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.templates.map(template => template.templateId), [
      'product-ad-v1',
      'reference-video-reconstruction-v1',
    ]);
    assert.equal(response.body.templates[0].modelPolicy.provider, undefined);
  } finally {
    db.close();
  }
});

test('exposes an owner-scoped generation preflight without creating a paid job', async t => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const response = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench/plan', {
    params: { projectId: project.id },
    query: { productId: 'seedance_fast', mode: 'smart', resolution: '720p', generateAudio: 'false' },
    headers: signedHeaders(sessionTokens, ownerEmail),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.plan.status, 'blocked');
  assert.equal(response.body.plan.blockers[0].code, 'NO_SHOTS');
  assert.equal(response.body.plan.quote.points, 0);
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

test('project memory routes preserve owner scope and optimistic revisions', async t => {
  const { app, db, project, sessionTokens, store, ownerEmail } = harness();
  t.after(() => db.close());
  const headers = signedHeaders(sessionTokens, ownerEmail);
  const readPath = '/api/video/projects/:projectId/workbench/memory';
  const factPath = '/api/video/projects/:projectId/workbench/memory/:factKey';
  const read = await invoke(app, 'GET', readPath, { headers, params: { projectId: project.id } });
  assert.equal(read.statusCode, 200);
  assert.deepEqual(read.body.memory, []);
  const created = await invoke(app, 'PUT', factPath, { headers,
    params: { projectId: project.id, factKey: 'hero/mood' },
    body: { value: { tone: 'warm' }, source: 'user' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.fact.key, 'hero/mood');
  const stale = await invoke(app, 'PUT', factPath, { headers,
    params: { projectId: project.id, factKey: 'hero/mood' },
    body: { value: { tone: 'stale' }, expectedRevision: 0 },
  });
  assert.equal(stale.statusCode, 409);
  const removed = await invoke(app, 'DELETE', factPath, { headers,
    params: { projectId: project.id, factKey: 'hero/mood' },
    body: { expectedRevision: 1 },
  });
  assert.equal(removed.statusCode, 200);
  const denied = await invoke(app, 'GET', readPath, {
    headers: signedHeaders(sessionTokens, 'other@example.com'), params: { projectId: project.id },
  });
  assert.equal(denied.statusCode, 404);
  assert.equal(store.listProjectMemory({ ownerEmail, projectId: project.id }).length, 0);
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
  const skillRun = store.previewSkillRun({ ownerEmail, projectId: project.id,
    idempotencyKey: 'route-manifest-skill-1', spec: {
      skillId: 'studio-trailer', skillVersion: 2,
      input: { concept: 'studio' },
      steps: [{ id: 'plan', kind: 'plan', label: '拆解镜头' }],
    } });
  const path = '/api/video/projects/:projectId/workbench/replay-manifests';
  const created = await invoke(app, 'POST', path, {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id },
    body: { skillId: 'studio-trailer', skillVersion: 2, modelCatalogSnapshot: { image: 'gpt-image-2' },
      skillRunId: skillRun.id, rightsConfirmations: [asset.id] },
  });
  assert.equal(created.statusCode, 201);
  const id = created.body.manifest.id;
  assert.equal(created.body.manifest.skillRun.plan.steps[0].id, 'plan');
  assert.equal(created.body.manifest.assets[0].versions[0].playbackUrl, undefined);
  const read = await invoke(app, 'GET', `${path}/:manifestId`, {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id, manifestId: id },
  });
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.manifest.id, id);
  const listed = await invoke(app, 'GET', path, {
    headers: signedHeaders(sessionTokens, ownerEmail), params: { projectId: project.id }, query: { limit: 10 },
  });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.body.manifests.map(manifest => manifest.id), [id]);
  assert.equal(listed.body.manifests[0].assets[0].versions[0].playbackUrl, undefined);
  const forbiddenWriteTables = db.prepare(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN ('video_jobs', 'usage_ledger', 'wallet_transactions') ORDER BY name`).all();
  assert.deepEqual(forbiddenWriteTables, []);
  const denied = await invoke(app, 'GET', `${path}/:manifestId`, {
    headers: signedHeaders(sessionTokens, 'tester@example.com'), params: { projectId: project.id, manifestId: id },
  });
  assert.equal(denied.statusCode, 404);
  const deniedList = await invoke(app, 'GET', path, {
    headers: signedHeaders(sessionTokens, 'tester@example.com'), params: { projectId: project.id },
  });
  assert.equal(deniedList.statusCode, 404);
});

test('owner can clone a replay manifest with an idempotency key and no billing/provider mutation', async t => {
  const { app, db, project, sessionTokens, store, ownerEmail } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail, projectId: project.id, kind: 'scene', name: 'studio' });
  const version = store.addAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/studio', contentHash: 'studio-hash', mimeType: 'image/png' });
  store.approveAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    versionId: version.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail, projectId: project.id, position: 0,
    purpose: '开场', durationMs: 3000, prompt: '镜头推进' });
  store.bindShotAssetVersion({ ownerEmail, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: version.id, role: 'scene' });
  const path = '/api/video/projects/:projectId/workbench/replay-manifests/:manifestId/clone';
  const manifest = store.createReplayManifest({ ownerEmail, projectId: project.id,
    skillId: 'studio-trailer', skillVersion: 2, rightsConfirmations: [asset.id] });
  const headers = { ...signedHeaders(sessionTokens, ownerEmail), 'idempotency-key': 'route-clone-1' };
  const cloned = await invoke(app, 'POST', path, {
    headers, params: { projectId: project.id, manifestId: manifest.id }, body: { title: '工作流复用' },
  });
  assert.equal(cloned.statusCode, 201);
  assert.equal(cloned.body.project.kind, 'video');
  assert.equal(cloned.body.project.title, '工作流复用');
  assert.equal(cloned.body.workbench.shots[0].prompt, '镜头推进');
  assert.equal(cloned.body.billing, undefined);
  const replayed = await invoke(app, 'POST', path, {
    headers, params: { projectId: project.id, manifestId: manifest.id }, body: { title: 'ignored' },
  });
  assert.equal(replayed.statusCode, 200);
  assert.equal(replayed.body.project.id, cloned.body.project.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
  const missingKey = await invoke(app, 'POST', path, {
    headers: signedHeaders(sessionTokens, ownerEmail),
    params: { projectId: project.id, manifestId: manifest.id }, body: {},
  });
  assert.equal(missingKey.statusCode, 400);
  assert.equal(missingKey.body.code, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('owner can preview and confirm a SkillRun without creating a provider or billing record', async t => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const headers = { ...signedHeaders(sessionTokens, ownerEmail), 'idempotency-key': 'route-skill-1' };
  const base = '/api/video/projects/:projectId/workbench/skill-runs';
  const spec = {
    skillId: 'studio-trailer', skillVersion: 1,
    input: { concept: '城市夜骑' },
    steps: [{ id: 'plan', kind: 'plan', label: '拆解镜头' }],
    checkpoints: [{ id: 'approve', label: '确认镜头' }],
  };
  const created = await invoke(app, 'POST', `${base}/preview`, {
    headers, params: { projectId: project.id }, body: { spec },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.run.status, 'preview');
  const read = await invoke(app, 'GET', `${base}/:runId`, {
    headers, params: { projectId: project.id, runId: created.body.run.id },
  });
  assert.equal(read.statusCode, 200);
  const confirmed = await invoke(app, 'POST', `${base}/:runId/checkpoints/:checkpointId/confirm`, {
    headers, params: { projectId: project.id, runId: created.body.run.id, checkpointId: 'approve' },
    body: { expectedRevision: 1 },
  });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(confirmed.body.run.status, 'confirmed');
  assert.equal(confirmed.body.run.events.at(-1).type, 'checkpoint.confirmed');
  const replayed = await invoke(app, 'POST', `${base}/preview`, {
    headers, params: { projectId: project.id }, body: { spec: { ...spec, input: { concept: 'ignored' } } },
  });
  assert.equal(replayed.statusCode, 200);
  assert.equal(replayed.body.run.id, created.body.run.id);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
});

test('owner can preview a registered Skill template without provider or billing side effects', async t => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const response = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/skill-runs/preview', {
    params: { projectId: project.id },
    headers: { ...signedHeaders(sessionTokens, ownerEmail), 'Idempotency-Key': 'template-preview-1' },
    body: {
      templateId: 'product-ad-v1',
      input: { prompt: '制作一支蓝牙耳机商品短片' },
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.run.plan.templateId, 'product-ad-v1');
  assert.equal(response.body.run.plan.skillId, 'product-advertisement');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM sqlite_master
    WHERE type = 'table' AND name IN ('usage_ledger', 'wallet_transactions')`).get().count, 0);
});

test('owner can complete dependency-ordered SkillRun steps through the protected route', async t => {
  const { app, db, project, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const headers = { ...signedHeaders(sessionTokens, ownerEmail), 'idempotency-key': 'route-step-1' };
  const base = '/api/video/projects/:projectId/workbench/skill-runs';
  const created = await invoke(app, 'POST', `${base}/preview`, {
    headers, params: { projectId: project.id }, body: { spec: {
      skillId: 'trailer', skillVersion: 1,
      steps: [
        { id: 'plan', kind: 'plan', label: '拆解镜头' },
        { id: 'assets', kind: 'assets', label: '准备素材', requires: ['plan'] },
      ],
    } },
  });
  assert.equal(created.statusCode, 201);
  const blocked = await invoke(app, 'POST', `${base}/:runId/steps/:stepId/complete`, {
    headers, params: { projectId: project.id, runId: created.body.run.id, stepId: 'assets' },
    body: { expectedRevision: 1 },
  });
  assert.equal(blocked.statusCode, 400);
  assert.equal(blocked.body.code, 'INVALID_SKILL_RUN');
  const first = await invoke(app, 'POST', `${base}/:runId/steps/:stepId/complete`, {
    headers, params: { projectId: project.id, runId: created.body.run.id, stepId: 'plan' },
    body: { expectedRevision: 1 },
  });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body.run.executionPlan.readyStepIds, ['assets']);
  const complete = await invoke(app, 'POST', `${base}/:runId/steps/:stepId/complete`, {
    headers, params: { projectId: project.id, runId: created.body.run.id, stepId: 'assets' },
    body: { expectedRevision: 2 },
  });
  assert.equal(complete.statusCode, 200);
  assert.equal(complete.body.run.status, 'complete');
  assert.equal(complete.body.run.executionPlan.status, 'complete');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM project_generation_runs').get().count, 0);
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

test('audio continuity routes create and update owner-scoped tracks', async t => {
  const { app, db, project, store, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const voice = store.createAsset({ ownerEmail, projectId: project.id, kind: 'voice', name: '旁白' });
  const version = store.addAssetVersion({ ownerEmail, projectId: project.id, assetId: voice.id,
    stableUrl: '/api/video/assets/route-voice', contentHash: 'route-voice-hash', mimeType: 'audio/mpeg' });
  store.approveAssetVersion({ ownerEmail, projectId: project.id, assetId: voice.id,
    versionId: version.id, expectedRevision: 1 });
  const headers = signedHeaders(sessionTokens, ownerEmail);
  const created = await invoke(app, 'POST', '/api/video/projects/:projectId/workbench/audio-tracks', {
    headers, params: { projectId: project.id }, body: {
      kind: 'voice', assetId: voice.id, assetVersionId: version.id, startMs: 100,
      durationMs: 3200, language: 'zh-CN', beatMarkers: [0, 800],
      subtitleCues: [{ startMs: 120, endMs: 700, text: '先讲重点' }],
    },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.track.kind, 'voice');
  const updated = await invoke(app, 'PATCH', '/api/video/projects/:projectId/workbench/audio-tracks/:trackId', {
    headers, params: { projectId: project.id, trackId: created.body.track.id },
    body: { expectedRevision: 1, patch: { volume: 0.7, muted: true } },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.track.revision, 2);
  assert.equal(updated.body.track.volume, 0.7);
  assert.equal(updated.body.track.muted, true);
  const denied = await invoke(app, 'GET', '/api/video/projects/:projectId/workbench', {
    headers: signedHeaders(sessionTokens, 'other@example.com'), params: { projectId: project.id },
  });
  assert.equal(denied.statusCode, 404);
});

test('timeline clip route persists trim, reorder, and mute changes with revision checks', async t => {
  const { app, db, project, store, sessionTokens, ownerEmail } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail, projectId: project.id, kind: 'product', name: '商品' });
  const version = store.addAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/route-product', contentHash: 'route-product-hash', mimeType: 'image/webp' });
  store.approveAssetVersion({ ownerEmail, projectId: project.id, assetId: asset.id,
    versionId: version.id, expectedRevision: 1 });
  const shot = store.createShot({ ownerEmail, projectId: project.id, position: 0,
    purpose: '商品亮相', durationMs: 4000 });
  store.bindShotAssetVersion({ ownerEmail, projectId: project.id, shotId: shot.id,
    assetId: asset.id, assetVersionId: version.id, role: 'product' });
  const candidate = store.registerCandidate({ ownerEmail, projectId: project.id, shotId: shot.id,
    outputAssetId: 'route-candidate', stableUrl: '/api/video/assets/route-candidate',
    contentHash: 'route-candidate-hash', mimeType: 'video/mp4' });
  store.selectCandidate({ ownerEmail, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, expectedRevision: shot.revision });
  const clip = store.addTimelineClip({ ownerEmail, projectId: project.id, shotId: shot.id,
    candidateId: candidate.id, position: 0, trimStartMs: 0, trimEndMs: 4000 });

  const updated = await invoke(app, 'PATCH', '/api/video/projects/:projectId/workbench/timeline/clips/:clipId', {
    headers: signedHeaders(sessionTokens, ownerEmail),
    params: { projectId: project.id, clipId: clip.id },
    body: { expectedRevision: 1, patch: { position: 1, trimStartMs: 300, trimEndMs: 2800, muted: true } },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.clip.position, 1);
  assert.equal(updated.body.clip.trimStartMs, 300);
  assert.equal(updated.body.clip.trimEndMs, 2800);
  assert.equal(updated.body.clip.muted, true);
  assert.equal(updated.body.clip.revision, 2);

  const conflict = await invoke(app, 'PATCH', '/api/video/projects/:projectId/workbench/timeline/clips/:clipId', {
    headers: signedHeaders(sessionTokens, ownerEmail),
    params: { projectId: project.id, clipId: clip.id },
    body: { expectedRevision: 1, patch: { muted: false } },
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
