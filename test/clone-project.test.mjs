// test/clone-project.test.mjs
// 4c183cd4 续命 P-C 1-click 派生升级: 项目级 Clone Service + Route 契约/真行为测试

import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createProjectCloneService } from '../server/projects/cloneService.js';
import { mountProjectRoutes } from '../server/projects/projectRoutes.mjs';
import { authenticateContentRequest, createSessionTokenService } from '../server/billing/contentBilling.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SESSION_SECRET = 'clone-project-test-secret-clone-project-test-secret';

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set('GET ' + path, handler); },
    post(path, handler) { routes.set('POST ' + path, handler); },
    patch(path, handler) { routes.set('PATCH ' + path, handler); },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(s) { this.statusCode = s; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function invoke(app, method, path, request) {
  const handler = app.routes.get(method + ' ' + path);
  assert.ok(handler, 'mounted ' + method + ' ' + path);
  const res = createResponse();
  await handler({ headers: (request && request.headers) || {}, body: (request && request.body) || {}, params: (request && request.params) || {} }, res);
  return res;
}

function signedHeaders(sessionTokens, email) {
  const issued = sessionTokens.issue(email);
  return { authorization: 'Bearer ' + issued.token };
}

function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let sequence = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => 'clone-uuid-' + (++sequence),
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });
  const cloneService = createProjectCloneService({ db, projectStore });
  const sessionTokens = createSessionTokenService({ secret: SESSION_SECRET });
  const app = createFakeApp();
  mountProjectRoutes(app, {
    projectStore,
    cloneService,
    authenticateOwner(req) {
      return authenticateContentRequest(req, { sessionTokens, authorizeEmail: () => ({ ok: true, email: 'clone-owner@example.com' }) });
    },
  });
  return { db, projectStore, cloneService, app, sessionTokens };
}

function seedSourceProject(db, projectStore, owner) {
  const source = projectStore.createProject({ ownerEmail: owner, kind: 'video', title: '源视频项目' });
  const version = projectStore.createVersion({ ownerEmail: owner, projectId: source.id, reason: 'manual_save' });
  const now = new Date('2026-08-29T12:00:00.000Z').toISOString();
  const insertAsset = db.prepare(
    'INSERT INTO project_assets ' +
    '(id, asset_id, owner_email, project_id, version_id, generation_run_id, role, ' +
    ' content_hash, stable_url, mime_type, metadata_json, retention_class, production_state, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insertAsset.run(
    source.id + ':asset-A', 'asset-A', owner, source.id, version.id,
    'generated_video', 'sha256-aaaa', '/api/generated-assets/asset-A.png',
    'image/png', JSON.stringify({ source: 'manual' }),
    'completed', 'delivered', now,
  );
  insertAsset.run(
    source.id + ':asset-B', 'asset-B', owner, source.id, version.id,
    'generated_video', 'sha256-bbbb', '/api/generated-assets/asset-B.png',
    'image/png', JSON.stringify({ source: 'manual', kind: 'video' }),
    'completed', 'delivered', now,
  );
  return { source, version };
}

// ---- A) 契约测试 ----

test('P-C contract: cloneService.js exports createProjectCloneService + 3 modes', () => {
  const src = readFileSync(resolve(root, 'server/projects/cloneService.js'), 'utf-8');
  assert.ok(src.indexOf('export function createProjectCloneService') >= 0, 'must export createProjectCloneService');
  assert.ok(src.indexOf("'same-style'") >= 0, 'must declare same-style');
  assert.ok(src.indexOf("'change-style'") >= 0, 'must declare change-style');
  assert.ok(src.indexOf("'change-angle'") >= 0, 'must declare change-angle');
  assert.ok(src.indexOf('ALLOWED_CLONE_MODES') >= 0, 'must declare ALLOWED_CLONE_MODES');
});

test('P-C contract: projectRoutes.mjs registers POST /api/projects/:projectId/clone', () => {
  const src = readFileSync(resolve(root, 'server/projects/projectRoutes.mjs'), 'utf-8');
  assert.ok(src.indexOf('/api/projects/:projectId/clone') >= 0, 'must register clone route');
  assert.ok(src.indexOf('cloneService = null') >= 0, 'mountProjectRoutes must accept cloneService param');
  assert.ok(src.indexOf('CLONE_MODE_INVALID') >= 0, 'routeError must handle CLONE_MODE_INVALID');
});

test('P-C contract: VERSION_REASONS includes clone', () => {
  const src = readFileSync(resolve(root, 'server/projects/projectStore.mjs'), 'utf-8');
  // 用更宽松的字符串包含: 'clone' 出现在 VERSION_REASONS 行内
  const lines = src.split(String.fromCharCode(10));
  const found = lines.find(l => l.indexOf('VERSION_REASONS') >= 0 && l.indexOf('new Set') >= 0);
  assert.ok(found, 'VERSION_REASONS line found');
  assert.ok(found.indexOf("'clone'") >= 0, "VERSION_REASONS must include 'clone'");
});

test('P-C contract: src/services/api.js exports cloneProject', () => {
  const src = readFileSync(resolve(root, 'src/services/api.js'), 'utf-8');
  assert.ok(src.indexOf('export async function cloneProject') >= 0, 'api.js must export cloneProject');
  assert.ok(src.indexOf('/api/projects/') >= 0 && src.indexOf('/clone') >= 0, 'api.js must POST to /api/projects/:id/clone');
});

test('P-C contract: CloneProjectModal.jsx exists with 3 modes', () => {
  const path = resolve(root, 'src/components/business/CloneProjectModal.jsx');
  const src = readFileSync(path, 'utf-8');
  assert.ok(src.indexOf("id: 'same-style'") >= 0, 'must include same-style option');
  assert.ok(src.indexOf("id: 'change-style'") >= 0, 'must include change-style option');
  assert.ok(src.indexOf("id: 'change-angle'") >= 0, 'must include change-angle option');
  assert.ok(src.indexOf('export default function CloneProjectModal') >= 0, 'must default export');
});

// ---- B) 真行为测试 ----

test('P-C behavior: cloneProject same-style copies all assets without styleVariation/angleVariation', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const result = cloneService.cloneProject({ ownerEmail: owner, projectId: source.id, cloneMode: 'same-style' });
    assert.equal(result.cloneMode, 'same-style');
    assert.equal(result.assetCount, 2);
    assert.notEqual(result.project.id, source.id, 'new project must have different id');
    const cloned = projectStore.listProjectAssets({ ownerEmail: owner, projectId: result.project.id });
    assert.equal(cloned.length, 2, 'cloned project has 2 assets');
    for (const c of cloned) {
      const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : JSON.parse(c.metadataJson || '{}');
      assert.equal(meta.clonedFrom.projectId, source.id);
      assert.equal(meta.clonedFrom.mode, 'same-style');
      assert.ok(!meta.styleVariation, 'same-style must NOT set styleVariation');
      assert.ok(!meta.angleVariation, 'same-style must NOT set angleVariation');
      assert.ok(c.stableUrl.indexOf('/api/generated-assets/') === 0, 'stable_url preserved');
    }
    // 验证 target id 末段为 :clone
    const cloneRows = db.prepare("SELECT id FROM project_assets WHERE project_id = ? AND id LIKE '%:clone'").all(result.project.id);
    assert.equal(cloneRows.length, 2, 'all cloned assets end with :clone');
  } finally { db.close(); }
});

test('P-C behavior: cloneProject change-style sets styleVariation.enabled=true', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const result = cloneService.cloneProject({ ownerEmail: owner, projectId: source.id, cloneMode: 'change-style' });
    assert.equal(result.cloneMode, 'change-style');
    const cloned = projectStore.listProjectAssets({ ownerEmail: owner, projectId: result.project.id });
    assert.equal(cloned.length, 2);
    for (const c of cloned) {
      const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : JSON.parse(c.metadataJson || '{}');
      assert.equal(meta.styleVariation.enabled, true, 'change-style must enable styleVariation');
      assert.equal(meta.angleVariation, undefined, 'change-style must NOT set angleVariation');
    }
  } finally { db.close(); }
});

test('P-C behavior: cloneProject change-angle sets angleVariation.enabled=true', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const result = cloneService.cloneProject({ ownerEmail: owner, projectId: source.id, cloneMode: 'change-angle' });
    assert.equal(result.cloneMode, 'change-angle');
    const cloned = projectStore.listProjectAssets({ ownerEmail: owner, projectId: result.project.id });
    assert.equal(cloned.length, 2);
    for (const c of cloned) {
      const meta = c.metadata && typeof c.metadata === 'object' ? c.metadata : JSON.parse(c.metadataJson || '{}');
      assert.equal(meta.angleVariation.enabled, true, 'change-angle must enable angleVariation');
      assert.equal(meta.styleVariation, undefined, 'change-angle must NOT set styleVariation');
    }
  } finally { db.close(); }
});

test('P-C behavior: invalid cloneMode throws CLONE_MODE_INVALID', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    assert.throws(
      () => cloneService.cloneProject({ ownerEmail: owner, projectId: source.id, cloneMode: 'wtf' }),
      (err) => err && err.code === 'CLONE_MODE_INVALID',
    );
  } finally { db.close(); }
});

test('P-C behavior: missing source project throws PROJECT_NOT_FOUND', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    assert.throws(
      () => cloneService.cloneProject({ ownerEmail: owner, projectId: 'no-such-project', cloneMode: 'same-style' }),
      (err) => err && err.code === 'PROJECT_NOT_FOUND',
    );
  } finally { db.close(); }
});

test('P-C behavior: derived project creates version with reason=clone', () => {
  const { db, projectStore, cloneService } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const result = cloneService.cloneProject({ ownerEmail: owner, projectId: source.id, cloneMode: 'change-style' });
    assert.ok(result.version, 'must return version');
    assert.equal(result.version.reason, 'clone');
    assert.equal(result.version.projectId, result.project.id);
  } finally { db.close(); }
});

test('P-C behavior: POST /api/projects/:projectId/clone returns 201 with project + assetMap', async () => {
  const { db, projectStore, app, sessionTokens } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const response = await invoke(app, 'POST', '/api/projects/:projectId/clone', {
      headers: signedHeaders(sessionTokens, owner),
      params: { projectId: source.id },
      body: { cloneMode: 'change-angle' },
    });
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.cloneMode, 'change-angle');
    assert.equal(response.body.assetCount, 2);
    assert.notEqual(response.body.project.id, source.id);
    assert.ok(Array.isArray(response.body.assetMap));
    assert.equal(response.body.assetMap.length, 2);
  } finally { db.close(); }
});

test('P-C behavior: POST clone with invalid mode returns 400 CLONE_MODE_INVALID', async () => {
  const { db, projectStore, app, sessionTokens } = createHarness();
  try {
    const owner = 'clone-owner@example.com';
    const { source } = seedSourceProject(db, projectStore, owner);
    const response = await invoke(app, 'POST', '/api/projects/:projectId/clone', {
      headers: signedHeaders(sessionTokens, owner),
      params: { projectId: source.id },
      body: { cloneMode: 'invalid-mode' },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, 'CLONE_MODE_INVALID');
  } finally { db.close(); }
});
