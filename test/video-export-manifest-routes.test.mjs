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
