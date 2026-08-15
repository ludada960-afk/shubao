import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProductionVideo } from '../scripts/verify-production-video.mjs';

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(body?.headers || {}),
    json: async () => body,
    arrayBuffer: async () => new Uint8Array([1]).buffer,
  };
}

test('production video verifier accepts a safe public catalog without making a generation request', async () => {
  let calls = 0;
  const body = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'video_seedance_fast_short', units: 40000 }, long: { sku: 'video_seedance_fast_long', units: 46000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'video_seedance_standard_short', units: 62000 }, long: { sku: 'video_seedance_standard_long', units: 72000 } } },
    ],
  };
  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl: async url => { calls += 1; assert.match(url, /\/api\/video\/capabilities$/); return response(body); } });
  assert.equal(calls, 1);
});
test('production video verifier rejects an internal route leak', async () => {
  await assert.rejects(
    verifyProductionVideo({ fetchImpl: async () => response({ generationEnabled: false, products: [{ id: 'seedance_fast', routeId: 'sd5-seedance-2.0-fast', quotes: { short: { units: 40000 }, long: { units: 46000 } } }] }) }),
    /leaked an internal route/,
  );
});

test('authenticated production verifier performs only non-billable canaries', async () => {
  const calls = [];
  const catalog = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'video_seedance_fast_short', units: 40000 }, long: { sku: 'video_seedance_fast_long', units: 46000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'video_seedance_standard_short', units: 62000 }, long: { sku: 'video_seedance_standard_long', units: 72000 } } },
    ],
  };
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    const method = options.method || 'GET';
    calls.push({ path, method, authorization: options.headers?.Authorization || options.headers?.authorization || '' });
    if (path === '/api/video/capabilities') return response(catalog);
    if (path === '/api/video/jobs') return response({ jobs: [] });
    if (path === '/api/admin/video-operations') return response({ metrics: {}, attentionQueue: [], lease: null });
    if (path === '/api/video/uploads' && method === 'POST') {
      const created = response({}, 201);
      created.headers = new Headers({ location: '/api/video/uploads/canary-upload' });
      return created;
    }
    if (path === '/api/video/uploads/canary-upload' && method === 'DELETE') return response({}, 204);
    throw new Error(`unexpected request ${method} ${path}`);
  };

  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl, sessionToken: 'signed-canary' });

  assert.ok(calls.some(call => call.path === '/api/video/uploads' && call.method === 'POST'));
  assert.ok(calls.some(call => call.path === '/api/video/uploads/canary-upload' && call.method === 'DELETE'));
  assert.ok(calls.some(call => call.path === '/api/admin/video-operations'));
  assert.ok(calls.filter(call => call.path !== '/api/video/capabilities').every(call => call.authorization === 'Bearer signed-canary'));
  assert.equal(calls.some(call => call.path === '/api/video/jobs' && call.method === 'POST'), false);
  assert.equal(calls.some(call => call.method === 'PATCH'), false);
});
