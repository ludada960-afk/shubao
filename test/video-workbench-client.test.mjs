import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addTimelineClip,
  approveWorkbenchAssetVersion,
  bindShotAssetVersion,
  createStoryboardShot,
  cloneVideoReplayManifest,
  createVideoReplayManifest,
  createWorkbenchAsset,
  getVideoReplayManifest,
  getVideoSkillRun,
  getVideoWorkbench,
  getVideoProjectMemory,
  getVideoSkillTemplates,
  upsertVideoProjectMemoryFact,
  removeVideoProjectMemoryFact,
  importJobCandidate,
  importWorkbenchAssetVersion,
  selectShotCandidate,
  previewVideoSkillRun,
  previewVideoSkillTemplate,
  confirmVideoSkillCheckpoint,
  completeVideoSkillRunStep,
  updateStoryboardShot,
} from '../src/services/videoWorkbench.js';
import { onSessionInvalid } from '../src/services/auth.js';

function installSession(token = 'signed-workbench-session') {
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

test('video workbench client signs and maps every P1 mutation route', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  const responses = [
    { project: { id: 'project / 1' }, assets: [], shots: [], timelineClips: [] },
    { asset: { id: 'asset / 1' } },
    { version: { id: 'version / 1' } },
    { asset: { id: 'asset / 1', status: 'approved' } },
    { shot: { id: 'shot / 1', revision: 1 } },
    { shot: { id: 'shot / 1', revision: 2 } },
    { binding: { assetId: 'asset / 1', role: 'product' } },
    { candidate: { id: 'candidate / 1' } },
    { shot: { id: 'shot / 1', selectedCandidateId: 'candidate / 1' }, candidate: { id: 'candidate / 1' } },
    { clip: { id: 'clip-1' } },
    { manifest: { id: 'manifest-1', manifestHash: 'hash-1' } },
    { manifest: { id: 'manifest-1', manifestHash: 'hash-1' } },
    { project: { id: 'clone-1', kind: 'video' }, workbench: { assets: [], shots: [], timelineClips: [] } },
  ];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse(responses.shift(), options.method === 'POST' ? 201 : 200);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await getVideoWorkbench('project / 1');
  await createWorkbenchAsset('project / 1', { kind: 'product', name: '耳机' });
  await importWorkbenchAssetVersion('project / 1', 'asset / 1', { videoAssetId: 'upload-1', metadata: { angle: 'front' } });
  await approveWorkbenchAssetVersion('project / 1', 'asset / 1', { versionId: 'version / 1', expectedRevision: 1 });
  await createStoryboardShot('project / 1', { position: 0, purpose: '开场', durationMs: 3000 });
  await updateStoryboardShot('project / 1', 'shot / 1', { expectedRevision: 1, patch: { purpose: '亮相' } });
  await bindShotAssetVersion('project / 1', 'shot / 1', { assetId: 'asset / 1', assetVersionId: 'version / 1', role: 'product' });
  await importJobCandidate('project / 1', 'shot / 1', { generationJobId: 'job-1' });
  await selectShotCandidate('project / 1', 'shot / 1', { candidateId: 'candidate / 1', expectedRevision: 2 });
  await addTimelineClip('project / 1', { shotId: 'shot / 1', candidateId: 'candidate / 1', position: 0, trimEndMs: 3000 });
  await createVideoReplayManifest('project / 1', { skillId: 'trailer', skillVersion: 1,
    skillRunId: 'run-1', rightsConfirmations: ['asset-1'] });
  await getVideoReplayManifest('project / 1', 'manifest / 1');
  await cloneVideoReplayManifest('project / 1', 'manifest / 1', { title: '复用', idempotencyKey: 'client-clone-1' });

  assert.deepEqual(requests.map(request => ({
    path: request.path,
    method: request.options.method || 'GET',
    authorization: request.options.headers.Authorization,
  })), [
    { path: '/api/video/projects/project%20%2F%201/workbench', method: 'GET', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/assets', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/assets/asset%20%2F%201/versions', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/assets/asset%20%2F%201/approve', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/shots', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/shots/shot%20%2F%201', method: 'PATCH', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/shots/shot%20%2F%201/bindings', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/shots/shot%20%2F%201/candidates', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/shots/shot%20%2F%201/select', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/timeline/clips', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/replay-manifests', method: 'POST', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/replay-manifests/manifest%20%2F%201', method: 'GET', authorization: 'Bearer signed-workbench-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/replay-manifests/manifest%20%2F%201/clone', method: 'POST', authorization: 'Bearer signed-workbench-session' },
  ]);
  assert.deepEqual(JSON.parse(requests[2].options.body), { videoAssetId: 'upload-1', metadata: { angle: 'front' } });
  assert.deepEqual(JSON.parse(requests[10].options.body), {
    skillId: 'trailer', skillVersion: 1, skillRunId: 'run-1', rightsConfirmations: ['asset-1'],
  });
  assert.equal(requests.at(-1).options.headers['Idempotency-Key'], 'client-clone-1');
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), { title: '复用' });
});

test('video workbench client rejects invalid path IDs before fetching', async t => {
  installSession();
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({});
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(getVideoWorkbench('\u0000project'), /请选择有效的视频项目/);
  await assert.rejects(updateStoryboardShot('project-1', '', {}), /请选择有效的分镜/);
  await assert.rejects(getVideoSkillRun('project-1', ''), /请选择有效的 SkillRun/);
  assert.equal(called, false);
});

test('video project memory client encodes fact keys and preserves revisions', async t => {
  installSession('signed-memory-session');
  const originalFetch = globalThis.fetch;
  const requests = [];
  const responses = [
    { memory: [] },
    { fact: { key: 'hero/mood', value: { tone: 'warm' }, revision: 1 } },
    { fact: { key: 'hero/mood', value: { tone: 'cool' }, revision: 2 } },
  ];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse(responses.shift(), options.method === 'POST' ? 201 : 200);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await getVideoProjectMemory('project-1');
  await upsertVideoProjectMemoryFact('project-1', 'hero/mood', {
    value: { tone: 'warm' }, source: 'user', expectedRevision: null,
  });
  await removeVideoProjectMemoryFact('project-1', 'hero/mood', 1);
  assert.equal(requests[0].path, '/api/video/projects/project-1/workbench/memory');
  assert.equal(requests[1].path, '/api/video/projects/project-1/workbench/memory/hero%2Fmood');
  assert.equal(requests[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    value: { tone: 'warm' }, source: 'user', expectedRevision: null,
  });
  assert.equal(requests[2].options.method, 'DELETE');
  assert.deepEqual(JSON.parse(requests[2].options.body), { expectedRevision: 1 });
  assert.equal(requests[2].options.headers.Authorization, 'Bearer signed-memory-session');
});

test('video Skill template client validates and signs metadata response', async t => {
  installSession('signed-template-session');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse({ templates: [{ templateId: 'product-ad-v1' }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const templates = await getVideoSkillTemplates('project-1');
  assert.deepEqual(templates, [{ templateId: 'product-ad-v1' }]);
  assert.equal(requests[0].path, '/api/video/projects/project-1/workbench/skill-templates');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer signed-template-session');
});

test('video SkillRun client signs preview, read, and checkpoint confirmation requests', async t => {
  installSession('signed-skill-session');
  const originalFetch = globalThis.fetch;
  const requests = [];
  const responses = [
    { run: { id: 'run-1', status: 'preview', revision: 1, events: [] } },
    { run: { id: 'run-1', status: 'preview', revision: 1, events: [] } },
    { run: { id: 'run-1', status: 'confirmed', revision: 2, events: [] } },
  ];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse(responses.shift(), options.method === 'POST' ? 201 : 200);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await previewVideoSkillRun('project-1', { skillId: 'trailer', skillVersion: 1 }, { idempotencyKey: 'skill-key-1' });
  await getVideoSkillRun('project-1', 'run-1');
  await confirmVideoSkillCheckpoint('project-1', 'run-1', 'approve-assets', 1);
  assert.equal(requests[0].options.headers['Idempotency-Key'], 'skill-key-1');
  assert.deepEqual(JSON.parse(requests[0].options.body), { spec: { skillId: 'trailer', skillVersion: 1 } });
  assert.equal(requests[1].path, '/api/video/projects/project-1/workbench/skill-runs/run-1');
  assert.equal(requests[2].path, '/api/video/projects/project-1/workbench/skill-runs/run-1/checkpoints/approve-assets/confirm');
  assert.deepEqual(JSON.parse(requests[2].options.body), { expectedRevision: 1 });
  assert.equal(requests[2].options.headers.Authorization, 'Bearer signed-skill-session');
});

test('video Skill template client previews a template with an idempotency key', async t => {
  installSession('signed-template-preview-session');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse({ run: { id: 'run-template-1', status: 'preview', revision: 1 } }, 201);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await previewVideoSkillTemplate('project-1', 'product-ad-v1', {
    prompt: '制作商品短片',
  }, { idempotencyKey: 'template-preview-client-1' });
  assert.equal(requests[0].path, '/api/video/projects/project-1/workbench/skill-runs/preview');
  assert.equal(requests[0].options.headers['Idempotency-Key'], 'template-preview-client-1');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    templateId: 'product-ad-v1', input: { prompt: '制作商品短片' },
  });
});

test('video SkillRun client completes a step with its expected revision', async t => {
  installSession('signed-step-session');
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    return jsonResponse({ run: { id: 'run-1', status: 'running', revision: 2, events: [] } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  await completeVideoSkillRunStep('project-1', 'run-1', 'plan', 1);
  assert.equal(requests[0].path, '/api/video/projects/project-1/workbench/skill-runs/run-1/steps/plan/complete');
  assert.deepEqual(JSON.parse(requests[0].options.body), { expectedRevision: 1 });
  assert.equal(requests[0].options.headers.Authorization, 'Bearer signed-step-session');
});

test('video workbench client uses shared session invalidation on 401', async t => {
  const storage = installSession('expired-workbench-session');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ code: 'SESSION_INVALID', error: '登录已失效，请重新登录' }, 401);
  let invalidations = 0;
  const unsubscribe = onSessionInvalid(() => { invalidations += 1; });
  t.after(() => {
    unsubscribe();
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(getVideoWorkbench('project-1'), error => error.status === 401 && error.code === 'SESSION_INVALID');
  assert.equal(storage.get('sb-auth'), undefined);
  assert.equal(invalidations, 1);
});
