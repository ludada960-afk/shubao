import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeProject,
  createCanvasSession,
  createProject,
  createProjectVersion,
  createRecoveryCheckpoint,
  consumeRecoveryCheckpoint,
  dismissRecoveryCheckpoint,
  loadCanvasSession,
  getProject,
  getProjectAssetLineage,
  importImageAssetToProject,
  importVideoAssetToProject,
  registerGeneratedAssetToProject,
  listProjectAssetLibrary,
  listProjects,
  listRecoveryCheckpoints,
  saveCanvasSession,
} from '../src/services/projects.js';
import { onSessionInvalid } from '../src/services/auth.js';

function installSession(token = 'signed-project-session') {
  const values = new Map([['sb-auth', JSON.stringify({ token })]]);
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  return values;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('lists recovery checkpoints with the signed session and returns an array', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, '/api/recovery-checkpoints');
    assert.equal(options.method, undefined);
    assert.equal(options.headers.Authorization, 'Bearer signed-project-session');
    return jsonResponse({ checkpoints: [{ id: 'checkpoint-1', reason: 'generation_interrupted' }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const checkpoints = await listRecoveryCheckpoints();

  assert.deepEqual(checkpoints, [{ id: 'checkpoint-1', reason: 'generation_interrupted' }]);
});

test('consumes and dismisses URL-encoded recovery checkpoints', async t => {
  installSession();
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return jsonResponse({ checkpoint: { id: 'checkpoint / 1', status: options.method === 'POST' ? 'consumed' : '' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const consumed = await consumeRecoveryCheckpoint('checkpoint / 1');
  const dismissed = await dismissRecoveryCheckpoint('checkpoint / 1');

  assert.equal(consumed.status, 'consumed');
  assert.equal(dismissed.status, 'consumed');
  assert.deepEqual(requests.map(({ url, options }) => ({
    url,
    method: options.method,
    authorization: options.headers.Authorization,
  })), [
    {
      url: '/api/recovery-checkpoints/checkpoint%20%2F%201/consume',
      method: 'POST',
      authorization: 'Bearer signed-project-session',
    },
    {
      url: '/api/recovery-checkpoints/checkpoint%20%2F%201/dismiss',
      method: 'POST',
      authorization: 'Bearer signed-project-session',
    },
  ]);
});

test('rejects empty or invalid checkpoint IDs before sending a request', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(consumeRecoveryCheckpoint('  '), /请选择有效的未完成任务/);
  await assert.rejects(dismissRecoveryCheckpoint('\u0000checkpoint'), /请选择有效的未完成任务/);

  assert.equal(called, false);
});

test('a recovery client 401 uses the shared session invalidation path', async t => {
  const storage = installSession('expired-project-session');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ code: 'SESSION_INVALID', error: '登录已失效，请重新登录' }, 401);
  const unsubscribe = onSessionInvalid(() => { invalidations += 1; });
  let invalidations = 0;
  t.after(() => {
    unsubscribe();
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(listRecoveryCheckpoints(), error => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'SESSION_INVALID');
    return true;
  });

  assert.equal(storage.get('sb-auth'), undefined);
  assert.equal(invalidations, 1);
});

test('project lifecycle client creates versions, checkpoints, and completion through signed routes', async t => {
  installSession('signed-token');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (path === '/api/projects') return jsonResponse({ project: { id: 'project-1' } });
    if (path.includes('/versions')) return jsonResponse({ version: { id: 'version-1' } });
    if (path.includes('/checkpoints')) return jsonResponse({ checkpoint: { id: 'checkpoint-1' } });
    return jsonResponse({ project: { id: 'project-1', status: 'completed' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.equal((await createProject({ kind: 'ecommerce', title: '水杯', idempotencyKey: 'draft-1' })).id, 'project-1');
  assert.equal((await createProjectVersion('project-1', { reason: 'generation', inputSnapshot: { description: '水杯' }, idempotencyKey: 'draft-1:version' })).id, 'version-1');
  assert.equal((await createRecoveryCheckpoint('project-1', { versionId: 'version-1', reason: 'payment_required' })).id, 'checkpoint-1');
  assert.equal((await completeProject('project-1', { acceptedVersionId: 'version-1' })).status, 'completed');
  assert.equal(requests.every(request => request.options.headers.Authorization === 'Bearer signed-token'), true);
  assert.equal(requests[1].options.headers['Idempotency-Key'], 'draft-1:version');
  assert.equal(JSON.parse(requests[1].options.body).idempotencyKey, undefined);
});

test('project discovery client lists and reads signed owner projects', async t => {
  installSession('signed-project-discovery');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    if (path === '/api/projects') {
      return jsonResponse({ projects: [{ id: 'video-project-1', kind: 'video', title: '品牌短片' }] });
    }
    return jsonResponse({ project: { id: 'video-project-1', kind: 'video', title: '品牌短片' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const projects = await listProjects();
  const project = await getProject('video-project-1');

  assert.equal(projects[0].kind, 'video');
  assert.equal(project.id, 'video-project-1');
  assert.deepEqual(requests.map(request => ({
    path: request.path,
    authorization: request.options.headers.Authorization,
  })), [
    { path: '/api/projects', authorization: 'Bearer signed-project-discovery' },
    { path: '/api/projects/video-project-1', authorization: 'Bearer signed-project-discovery' },
  ]);
});

test('project discovery rejects an invalid project ID before fetching', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(getProject('\u0000project'), /请选择有效的项目/);
  assert.equal(called, false);
});

test('project asset library client sends signed URL-encoded filters', async t => {
  installSession('signed-asset-library');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options = {}) => {
    assert.equal(path, '/api/project-assets?projectKind=ecommerce&mediaKind=image&limit=20');
    assert.equal(options.headers.Authorization, 'Bearer signed-asset-library');
    return jsonResponse({ assets: [{ projectAssetId: 'asset-1', mediaKind: 'image', project: { id: 'project-1' } }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const assets = await listProjectAssetLibrary({ projectKind: 'ecommerce', mediaKind: 'image', limit: 20 });
  assert.equal(assets[0].projectAssetId, 'asset-1');
});

test('project asset lineage client encodes both IDs and uses the signed session', async t => {
  installSession('signed-lineage-token');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options = {}) => {
    assert.equal(path, '/api/projects/project%20one/assets/asset%2Fone/lineage');
    assert.equal(options.headers.Authorization, 'Bearer signed-lineage-token');
    return jsonResponse({ lineage: { asset: { projectAssetId: 'asset/one' }, parents: [], children: [], sourceReferences: [] } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const lineage = await getProjectAssetLineage('project one', 'asset/one');
  assert.equal(lineage.asset.projectAssetId, 'asset/one');
});

test('project media import client uses signed owner context and never sends owner authority', async t => {
  installSession('signed-media-import-token');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options = {}) => {
    assert.equal(path, '/api/projects/project%20one/assets/import-media');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer signed-media-import-token');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, {
      videoAssetId: 'upload/one.mp4',
      role: 'reference-video',
      metadata: { displayName: '产品视频' },
    });
    assert.equal('ownerEmail' in body, false);
    return jsonResponse({ asset: { projectAssetId: 'canonical-1', mediaKind: 'video' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const asset = await importVideoAssetToProject('project one', {
    videoAssetId: 'upload/one.mp4',
    role: 'reference-video',
    metadata: { displayName: '产品视频' },
  });
  assert.equal(asset.projectAssetId, 'canonical-1');
});

test('project image import client uses a typed source and signed owner context', async t => {
  installSession('signed-image-import-token');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options = {}) => {
    assert.equal(path, '/api/projects/project%20one/assets/import-media');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer signed-image-import-token');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, {
      sourceKind: 'image',
      imageAssetId: `${'a'.repeat(64)}.png`,
      role: 'product',
      metadata: { displayName: '主商品图' },
    });
    assert.equal('ownerEmail' in body, false);
    return jsonResponse({ asset: { projectAssetId: 'canonical-image-1', mediaKind: 'image' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const asset = await importImageAssetToProject('project one', {
    imageAssetId: `${'a'.repeat(64)}.png`,
    role: 'product',
    metadata: { displayName: '主商品图' },
  });
  assert.equal(asset.projectAssetId, 'canonical-image-1');
});

test('generated project asset registration uses stable asset identity and signed owner context', async t => {
  installSession('signed-generated-asset-token');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, options = {}) => {
    assert.equal(path, '/api/projects/project%20one/assets/register-generated');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer signed-generated-asset-token');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, {
      versionId: 'version-1',
      assetId: `${'a'.repeat(64)}.png`,
      stableUrl: `/api/generated-assets/${'a'.repeat(64)}.png`,
      role: 'canvas-output',
      metadata: { source: 'canvas' },
    });
    assert.equal('ownerEmail' in body, false);
    return jsonResponse({ asset: { projectAssetId: 'canonical-generated-1', mediaKind: 'image' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const asset = await registerGeneratedAssetToProject('project one', {
    versionId: 'version-1',
    assetId: `${'a'.repeat(64)}.png`,
    stableUrl: `/api/generated-assets/${'a'.repeat(64)}.png`,
    role: 'canvas-output',
    metadata: { source: 'canvas' },
  });
  assert.equal(asset.projectAssetId, 'canonical-generated-1');
});

test('Canvas session client creates, saves, and restores an encoded owner session', async t => {
  installSession('signed-canvas-project-token');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    const revision = String(path).endsWith('/save') ? 2 : 1;
    return jsonResponse({ session: { id: 'canvas / 1', revision, snapshot: { nodes: [] } } }, String(path).startsWith('/api/canvas-sessions/') ? 200 : 201);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await createCanvasSession({ projectId: 'project-1', baseVersionId: 'version-1', snapshot: { nodes: [] } });
  await saveCanvasSession('canvas / 1', { expectedRevision: 1, snapshot: { nodes: [{ id: 'source-1' }] } });
  await loadCanvasSession('canvas / 1');

  assert.deepEqual(requests.map(request => ({
    path: request.path,
    method: request.options.method,
    authorization: request.options.headers.Authorization,
  })), [
    { path: '/api/canvas-sessions', method: 'POST', authorization: 'Bearer signed-canvas-project-token' },
    { path: '/api/canvas-sessions/canvas%20%2F%201/save', method: 'POST', authorization: 'Bearer signed-canvas-project-token' },
    { path: '/api/canvas-sessions/canvas%20%2F%201', method: undefined, authorization: 'Bearer signed-canvas-project-token' },
  ]);
});
