import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProductionVideo } from '../scripts/verify-production-video.mjs';

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(body?.headers || {}),
    json: async () => body,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
    arrayBuffer: async () => new Uint8Array([1]).buffer,
  };
}

test('production video verifier identifies the failing authenticated route when a gateway returns HTML', async () => {
  const catalog = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'fast-short', units: 27000 }, long: { sku: 'fast-long', units: 27000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'standard-short', units: 46000 }, long: { sku: 'standard-long', units: 57000 } } },
    ],
  };
  await assert.rejects(
    verifyProductionVideo({
      baseUrl: 'https://example.com',
      sessionToken: 'signed-canary',
      fetchImpl: async url => {
        const path = new URL(String(url)).pathname;
        if (path === '/api/video/capabilities') return response(catalog);
        if (path === '/api/video/jobs') return response({ jobs: [] });
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
          text: async () => '<!DOCTYPE html><html><body>fallback</body></html>',
        };
      },
    }),
    /Video operations response returned invalid JSON \(text\/html; charset=UTF-8\)/,
  );
});

test('production video verifier accepts a safe public catalog without making a generation request', async () => {
  let calls = 0;
  const body = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'video_seedance_fast_short', units: 27000 }, long: { sku: 'video_seedance_fast_long', units: 27000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'video_seedance_standard_short', units: 46000 }, long: { sku: 'video_seedance_standard_long', units: 57000 } } },
    ],
  };
  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl: async url => { calls += 1; assert.match(url, /\/api\/video\/capabilities$/); return response(body); } });
  assert.equal(calls, 1);
});
test('production video verifier rejects an internal route leak', async () => {
  await assert.rejects(
    verifyProductionVideo({ fetchImpl: async () => response({ generationEnabled: false, products: [{ id: 'seedance_fast', routeId: 'sd5-seedance-2.0-fast', quotes: { short: { units: 27000 }, long: { units: 27000 } } }] }) }),
    /leaked an internal route/,
  );
});

test('authenticated production verifier performs only non-billable canaries', async () => {
  const calls = [];
  const catalog = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'video_seedance_fast_short', units: 27000 }, long: { sku: 'video_seedance_fast_long', units: 27000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'video_seedance_standard_short', units: 46000 }, long: { sku: 'video_seedance_standard_long', units: 57000 } } },
    ],
  };
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    const method = options.method || 'GET';
    calls.push({
      path,
      method,
      authorization: options.headers?.Authorization || options.headers?.authorization || '',
      uploadMetadata: options.headers?.['Upload-Metadata'] || '',
    });
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
  const uploadCreate = calls.find(call => call.path === '/api/video/uploads' && call.method === 'POST');
  assert.match(uploadCreate.uploadMetadata, /filename Y2FuYXJ5Lm1wNA==/);
  assert.match(uploadCreate.uploadMetadata, /filetype dmlkZW8vbXA0/);
  assert.ok(calls.some(call => call.path === '/api/video/uploads/canary-upload' && call.method === 'DELETE'));
  assert.ok(calls.some(call => call.path === '/api/admin/video-operations'));
  assert.ok(calls.filter(call => call.path !== '/api/video/capabilities').every(call => call.authorization === 'Bearer signed-canary'));
  assert.equal(calls.some(call => call.path === '/api/video/jobs' && call.method === 'POST'), false);
  assert.equal(calls.some(call => call.method === 'PATCH'), false);
});

test('authenticated cleanup retries transient network failures without retrying upload creation', async () => {
  const calls = [];
  const catalog = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'fast-short', units: 27000 }, long: { sku: 'fast-long', units: 27000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'standard-short', units: 46000 }, long: { sku: 'standard-long', units: 57000 } } },
    ],
  };
  let deleteAttempts = 0;
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    const method = options.method || 'GET';
    calls.push(`${method} ${path}`);
    if (path === '/api/video/capabilities') return response(catalog);
    if (path === '/api/video/jobs') return response({ jobs: [] });
    if (path === '/api/admin/video-operations') return response({ metrics: {}, attentionQueue: [], lease: null });
    if (path === '/api/video/uploads' && method === 'POST') {
      const created = response({}, 201);
      created.headers = new Headers({ location: '/api/video/uploads/canary-upload' });
      return created;
    }
    if (path === '/api/video/uploads/canary-upload' && method === 'DELETE') {
      deleteAttempts += 1;
      if (deleteAttempts < 3) throw new Error('socket reset');
      return response({}, 204);
    }
    throw new Error(`unexpected request ${method} ${path}`);
  };

  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl, sessionToken: 'signed-canary', sleep: async () => {} });

  assert.equal(calls.filter(call => call === 'POST /api/video/uploads').length, 1);
  assert.equal(calls.filter(call => call === 'DELETE /api/video/uploads/canary-upload').length, 3);
});

test('authenticated cleanup treats an already-removed ephemeral upload as success', async () => {
  const catalog = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'fast-short', units: 27000 }, long: { sku: 'fast-long', units: 27000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'standard-short', units: 46000 }, long: { sku: 'standard-long', units: 57000 } } },
    ],
  };
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    const method = options.method || 'GET';
    if (path === '/api/video/capabilities') return response(catalog);
    if (path === '/api/video/jobs') return response({ jobs: [] });
    if (path === '/api/admin/video-operations') return response({ metrics: {}, attentionQueue: [], lease: null });
    if (path === '/api/video/uploads' && method === 'POST') {
      const created = response({}, 201);
      created.headers = new Headers({ location: '/api/video/uploads/already-gone' });
      return created;
    }
    if (path === '/api/video/uploads/already-gone' && method === 'DELETE') return response({}, 404);
    throw new Error(`unexpected request ${method} ${path}`);
  };

  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl, sessionToken: 'signed-canary', sleep: async () => {} });
});
