import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createVideoExportManifest,
  getVideoExportManifest,
  listVideoExportManifests,
} from '../src/services/videoWorkbench.js';

test('video export manifest client uses signed owner-scoped routes', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => JSON.stringify({ token: 'export-session' }) };
  const requests = [];
  globalThis.fetch = async (path, options = {}) => {
    requests.push({ path, options });
    const payload = path.includes('?') ? { manifests: [{ id: 'manifest-1' }] } : { manifest: { id: 'manifest-1' } };
    return new Response(JSON.stringify(payload), { status: options.method === 'POST' ? 201 : 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });
  await createVideoExportManifest('project / 1', { format: 'mp4' });
  await listVideoExportManifests('project / 1', { limit: 7 });
  await getVideoExportManifest('project / 1', 'manifest / 1');
  assert.deepEqual(requests.map(({ path, options }) => ({
    path, method: options.method || 'GET', authorization: options.headers.Authorization,
  })), [
    { path: '/api/video/projects/project%20%2F%201/workbench/export-manifests', method: 'POST', authorization: 'Bearer export-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/export-manifests?limit=7', method: 'GET', authorization: 'Bearer export-session' },
    { path: '/api/video/projects/project%20%2F%201/workbench/export-manifests/manifest%20%2F%201', method: 'GET', authorization: 'Bearer export-session' },
  ]);
  assert.deepEqual(JSON.parse(requests[0].options.body), { options: { format: 'mp4' } });
});
