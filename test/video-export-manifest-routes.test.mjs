import assert from 'node:assert/strict';
import test from 'node:test';

import { mountVideoWorkbenchRoutes } from '../server/videoWorkbenchRoutes.mjs';

function app() {
  const routes = new Map();
  const register = method => (path, handler) => routes.set(`${method} ${path}`, handler);
  return { routes, get: register('GET'), post: register('POST'), patch: register('PATCH'), put: register('PUT'), delete: register('DELETE') };
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('mounts owner-scoped export manifest routes and preserves idempotent status', async () => {
  const fakeApp = app();
  let sequence = 0;
  const store = {
    listWorkbench: () => ({ project: { id: 'project-1', kind: 'video' }, assets: [], shots: [], timelineClips: [] }),
    createExportManifest: ({ ownerEmail, projectId, options }) => ({
      id: 'manifest-1', ownerEmail, projectId, options, replayed: Boolean(options?.replayed),
    }),
    listExportManifests: () => [{ id: 'manifest-1' }],
    getExportManifest: () => ({ id: 'manifest-1' }),
    recordOperation: () => {},
  };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const headers = {};
  const request = (body = {}, query = {}, params = { projectId: 'project-1' }) => ({ headers, body, query, params });
  const invoke = async (method, path, req, res) => {
    const handler = fakeApp.routes.get(`${method} ${path}`);
    assert.equal(typeof handler, 'function', `mounted ${method} ${path}`);
    await handler(req, res);
  };
  const createdResponse = response();
  await invoke('POST', '/api/video/projects/:projectId/workbench/export-manifests', request({ options: { format: 'mp4' } }), createdResponse);
  assert.equal(createdResponse.statusCode, 201);
  assert.equal(createdResponse.body.manifest.id, 'manifest-1');
  const replayedResponse = response();
  await invoke('POST', '/api/video/projects/:projectId/workbench/export-manifests', request({ options: { replayed: true } }), replayedResponse);
  assert.equal(replayedResponse.statusCode, 200);
  const listResponse = response();
  await invoke('GET', '/api/video/projects/:projectId/workbench/export-manifests', request({}, { limit: '5' }), listResponse);
  assert.deepEqual(listResponse.body.manifests, [{ id: 'manifest-1' }]);
  const getResponse = response();
  await invoke('GET', '/api/video/projects/:projectId/workbench/export-manifests/:manifestId', request({}, {}, { projectId: 'project-1', manifestId: 'manifest-1' }), getResponse);
  assert.equal(getResponse.body.manifest.id, 'manifest-1');
  assert.equal(sequence, 0);
});

test('maps persisted export integrity failures to a controlled server error', async () => {
  const fakeApp = app();
  const store = {
    listWorkbench: () => ({ project: { id: 'project-1', kind: 'video' }, assets: [], shots: [], timelineClips: [] }),
    listExportManifests: () => { throw Object.assign(new Error('tampered'), { code: 'EXPORT_MANIFEST_INTEGRITY_INVALID' }); },
    recordOperation: () => {},
  };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const res = response();
  await fakeApp.routes.get('GET /api/video/projects/:projectId/workbench/export-manifests')(
    { headers: {}, body: {}, query: {}, params: { projectId: 'project-1' } }, res,
  );
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'EXPORT_MANIFEST_INTEGRITY_INVALID');
});

test('mounts renderer handoff routes without exposing provider execution', async () => {
  const fakeApp = app();
  const store = {
    listWorkbench: () => ({ project: { id: 'project-1', kind: 'video' }, assets: [], shots: [], timelineClips: [] }),
    createExportJob: ({ manifestId }) => ({
      id: 'job-1', manifestId, state: 'waiting_renderer', replayed: manifestId === 'manifest-replay',
      providerSubmission: false, billingMutation: false,
      ownerEmail: 'owner@example.com', preflightJson: '{"secret":true}',
      workerId: 'worker-secret', leaseToken: 'lease-secret', leaseExpiresAt: 'future', jobHash: 'hash-secret',
    }),
    listExportJobs: () => [{ id: 'job-1', state: 'waiting_renderer', leaseToken: 'lease-secret' }],
    getExportJob: () => ({ id: 'job-1', state: 'waiting_renderer', preflightJson: '{"secret":true}' }),
    recordOperation: () => {},
  };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const request = (body = {}, query = {}, params = { projectId: 'project-1' }) => ({
    headers: {}, body, query, params,
  });
  const invoke = async (method, path, req, res) => {
    const handler = fakeApp.routes.get(`${method} ${path}`);
    assert.equal(typeof handler, 'function', `mounted ${method} ${path}`);
    await handler(req, res);
  };
  const created = response();
  await invoke('POST', '/api/video/projects/:projectId/workbench/export-jobs', request({ manifestId: 'manifest-1' }), created);
  assert.equal(created.statusCode, 202);
  assert.equal(created.body.job.providerSubmission, false);
  assert.equal(created.body.job.ownerEmail, undefined);
  assert.equal(created.body.job.preflightJson, undefined);
  assert.equal(created.body.job.leaseToken, undefined);
  assert.equal(created.body.job.jobHash, undefined);
  const replayed = response();
  await invoke('POST', '/api/video/projects/:projectId/workbench/export-jobs', request({ manifestId: 'manifest-replay' }), replayed);
  assert.equal(replayed.statusCode, 200);
  const listed = response();
  await invoke('GET', '/api/video/projects/:projectId/workbench/export-jobs', request({}, { limit: '10' }), listed);
  assert.deepEqual(listed.body.jobs, [{ id: 'job-1', state: 'waiting_renderer' }]);
  const read = response();
  await invoke('GET', '/api/video/projects/:projectId/workbench/export-jobs/:jobId', request({}, {}, { projectId: 'project-1', jobId: 'job-1' }), read);
  assert.equal(read.body.job.id, 'job-1');
  assert.equal(read.body.job.preflightJson, undefined);
  assert.equal(read.body.job.leaseToken, undefined);
});

test('maps stale renderer handoffs to a conflict response', async () => {
  const fakeApp = app();
  const store = {
    listWorkbench: () => ({ project: { id: 'project-1', kind: 'video' }, assets: [], shots: [], timelineClips: [] }),
    createExportJob: () => { throw Object.assign(new Error('stale'), { code: 'EXPORT_JOB_STALE' }); },
    recordOperation: () => {},
  };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const res = response();
  await fakeApp.routes.get('POST /api/video/projects/:projectId/workbench/export-jobs')(
    { headers: {}, body: { manifestId: 'manifest-1' }, query: {}, params: { projectId: 'project-1' } }, res,
  );
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'EXPORT_JOB_STALE');
});

test('mounts owner-scoped renderer recovery and retry without provider or billing mutation', async () => {
  const fakeApp = app();
  const calls = [];
  const store = {
    listWorkbench: () => ({ project: { id: 'project-1', kind: 'video' }, assets: [], shots: [], timelineClips: [] }),
    recoverExportJob: request => {
      calls.push(['recover', request]);
      return { id: request.jobId, projectId: request.projectId, state: 'failed', providerSubmission: false, billingMutation: false };
    },
    transitionExportJob: request => {
      calls.push(['retry', request]);
      return { id: request.jobId, projectId: request.projectId, state: request.nextState, providerSubmission: false, billingMutation: false };
    },
    recordOperation: () => {},
  };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const request = (body, params = { projectId: 'project-1', jobId: 'job-1' }) => ({ headers: {}, body, query: {}, params });
  const recovered = response();
  await fakeApp.routes.get('POST /api/video/projects/:projectId/workbench/export-jobs/:jobId/recover')(
    request({ now: '2026-08-20T00:00:00.000Z' }), recovered,
  );
  const retried = response();
  await fakeApp.routes.get('POST /api/video/projects/:projectId/workbench/export-jobs/:jobId/retry')(
    request({}), retried,
  );
  assert.equal(recovered.body.job.state, 'failed');
  assert.equal(retried.body.job.state, 'waiting_renderer');
  assert.deepEqual(calls, [
    ['recover', { ownerEmail: 'owner@example.com', projectId: 'project-1', jobId: 'job-1' }],
    ['retry', { ownerEmail: 'owner@example.com', projectId: 'project-1', jobId: 'job-1', nextState: 'waiting_renderer' }],
  ]);
  assert.equal(retried.body.job.providerSubmission, false);
  assert.equal(retried.body.job.billingMutation, false);
});

test('planning-only workbench rejects renderer recovery and retry', async () => {
  const fakeApp = app();
  const store = { listWorkbench: () => ({ project: { id: 'project-1' }, assets: [], shots: [], timelineClips: [] }), recordOperation: () => {} };
  mountVideoWorkbenchRoutes(fakeApp, {
    enabled: true,
    planningOnly: true,
    store,
    authenticateOwner: () => 'owner@example.com',
    authorizeCohort: { requireEligible: () => ({ ok: true }) },
    playbackUrlForAsset: () => '/media/test',
  });
  const request = { headers: {}, body: {}, query: {}, params: { projectId: 'project-1', jobId: 'job-1' } };
  for (const path of [
    'POST /api/video/projects/:projectId/workbench/export-jobs/:jobId/recover',
    'POST /api/video/projects/:projectId/workbench/export-jobs/:jobId/retry',
  ]) {
    const res = response();
    await fakeApp.routes.get(path)(request, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'VIDEO_WORKBENCH_PLANNING_ONLY');
  }
});
