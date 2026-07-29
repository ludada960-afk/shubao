import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  loadEcommerceTaskReference,
  saveEcommerceTaskReference,
} from '../src/pages/Home/ec/ecommerceTaskProgressModel.js';

function ecommerceStorage(owner = 'owner@example.com') {
  const values = new Map([['sb-auth', JSON.stringify({
    email: owner,
    token: 'signed-ecommerce-session',
    expiresAt: '2999-01-01T00:00:00.000Z',
  })]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

function ecommerceTaskResponse(task, status = 200) {
  return new Response(JSON.stringify({ task }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function completedContentStream() {
  return new Response(
    'data: {"type":"complete","cover_url":"/api/generated-assets/cover.png","image_urls":["/api/generated-assets/page.png"],"billing":{"currency":"content_sets","status":"settled","balance":2}}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

test('paid content APIs send owned reference asset IDs rather than raw resumable image data', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const bodies = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (_url, options = {}) => {
    bodies.push(JSON.parse(options.body));
    return completedContentStream();
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateContent, generatePlogContent } = await import(`../src/services/api.js?content-assets=${Date.now()}`);
  await generateContent('夏日通勤', [], { referenceAssetIds: ['a'.repeat(64) + '.jpg'] });
  await generatePlogContent({ text: '下班后的咖啡', referenceAssetIds: ['b'.repeat(64) + '.png'] });

  assert.deepEqual(bodies[0].images, []);
  assert.deepEqual(bodies[0].referenceAssetIds, ['a'.repeat(64) + '.jpg']);
  assert.equal(bodies[0].images.includes?.('data:image/png;base64,unsafe') || false, false);
  assert.equal(bodies[1].refImage, undefined);
  assert.deepEqual(bodies[1].referenceAssetIds, ['b'.repeat(64) + '.png']);
});

test('active owner and draft task resumes with GET polling, emits only a delivered stable image once, and never posts a duplicate', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  const emitted = [];
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-resume', taskId: 'task-resume', storage });
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (calls.length === 1) {
      return ecommerceTaskResponse({
        id: 'task-resume',
        status: 'quality_check',
        assets: [{ assetId: 'main-1', role: 'main_text', label: '主图文案', status: 'quality_check', stableUrl: '/api/generated-assets/main-1.png' }],
      });
    }
    return ecommerceTaskResponse({
      id: 'task-resume',
      status: 'completed',
      assets: [{ assetId: 'main-1', role: 'main_text', label: '主图文案', status: 'completed', stableUrl: '/api/generated-assets/main-1.png' }],
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?resume=${Date.now()}`);
  const result = await generateEcommerce({
    productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-resume',
    pollIntervalMs: 0, maxPollAttempts: 3, onImage: image => emitted.push(image),
  });

  assert.equal(result.taskId, 'task-resume');
  assert.deepEqual(calls, [
    { url: '/api/ecommerce/jobs/task-resume', method: 'GET' },
    { url: '/api/ecommerce/jobs/task-resume', method: 'GET' },
  ]);
  assert.deepEqual(emitted, [{
    id: 'main-1', url: '/api/generated-assets/main-1.png', stableUrl: '/api/generated-assets/main-1.png',
    role: 'main_text', label: '主图文案', state: 'completed', taskId: 'task-resume',
  }]);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-resume', storage }), null);
});

test('a timeout preserves the newly saved owner and draft task reference', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  globalThis.localStorage = storage;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') {
      return new Response(JSON.stringify({ taskId: 'task-timeout' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    return ecommerceTaskResponse({ id: 'task-timeout', status: 'polling', assets: [] });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?timeout=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-timeout', pollIntervalMs: 0, maxPollAttempts: 1 }),
    error => error.code === 'ECOMMERCE_POLL_TIMEOUT' && error.resumeable === true,
  );
  const reference = loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-timeout', storage });
  assert.equal(reference?.taskId, 'task-timeout');
  assert.equal(typeof reference?.createdAt, 'number');
});

test('a forbidden saved task is cleared as expired without posting or leaking another owner reference', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-expired', taskId: 'task-forbidden', storage });
  saveEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId: 'ec-draft-expired', taskId: 'task-other', storage });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return new Response(JSON.stringify({ error: '无权读取此任务' }), { status: 403, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?expired=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-expired' }),
    error => error.code === 'ECOMMERCE_TASK_EXPIRED' && error.status === 403,
  );
  assert.deepEqual(calls, [{ url: '/api/ecommerce/jobs/task-forbidden', method: 'GET' }]);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-expired', storage }), null);
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'other@example.com', draftId: 'ec-draft-expired', storage })?.taskId, 'task-other');
});

test('terminal failed and cancelled polls clear their task reference while a partial reviewed result closes the cycle', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  for (const status of ['failed', 'cancelled']) {
    const storage = ecommerceStorage();
    globalThis.localStorage = storage;
    globalThis.fetch = async (_url, options = {}) => options.method === 'POST'
      ? new Response(JSON.stringify({ taskId: `task-${status}` }), { status: 202, headers: { 'content-type': 'application/json' } })
      : ecommerceTaskResponse({ id: `task-${status}`, status, assets: [], error: '任务停止' });
    const { generateEcommerce } = await import(`../src/services/api.js?terminal-${status}=${Date.now()}`);
    await assert.rejects(
      generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: `ec-draft-${status}`, pollIntervalMs: 0, maxPollAttempts: 1 }),
      /任务停止/,
    );
    assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: `ec-draft-${status}`, storage }), null, status);
  }

  const storage = ecommerceStorage();
  globalThis.localStorage = storage;
  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-review', taskId: 'task-review', storage });
  globalThis.fetch = async () => ecommerceTaskResponse({
    id: 'task-review',
    status: 'needs_review',
    output: { images: { delivered: '/api/generated-assets/delivered.png' } },
    assets: [
      { assetId: 'delivered', status: 'completed', stableUrl: '/api/generated-assets/delivered.png' },
      { assetId: 'review-1', status: 'needs_review', stableUrl: '/api/generated-assets/review-1.png' },
    ],
  });
  const { generateEcommerce } = await import(`../src/services/api.js?needs-review=${Date.now()}`);
  const result = await generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-review', pollIntervalMs: 0, maxPollAttempts: 1 });
  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.images, { delivered: '/api/generated-assets/delivered.png' });
  assert.equal(loadEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-review', storage }), null);
});

test('a saved failed task requires an explicit retry before a replacement POST is allowed', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (options.method === 'POST') {
      return new Response('data: {"type":"complete","images":{"main":"/api/generated-assets/retry.png"},"errors":[]}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    return ecommerceTaskResponse({ id: 'task-failed-resume', status: 'failed', assets: [], error: '上次任务失败' });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-failed-resume', taskId: 'task-failed-resume', storage });
  const { generateEcommerce } = await import(`../src/services/api.js?retry-required=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝', draftId: 'ec-draft-failed-resume' }),
    error => error.code === 'ECOMMERCE_TASK_RETRY_REQUIRED',
  );
  assert.deepEqual(calls, [{ url: '/api/ecommerce/jobs/task-failed-resume', method: 'GET' }]);

  saveEcommerceTaskReference({ ownerEmail: 'owner@example.com', draftId: 'ec-draft-failed-resume', taskId: 'task-failed-resume', storage });
  const retryResult = await generateEcommerce({
    productName: '测试商品',
    category: '其他',
    platform: '淘宝',
    draftId: 'ec-draft-failed-resume',
    retry: true,
  });
  assert.equal(retryResult.status, 'completed');
  assert.deepEqual(calls.slice(1), [
    { url: '/api/ecommerce/jobs/task-failed-resume', method: 'GET' },
    { url: '/api/generate-ecommerce', method: 'POST' },
  ]);
});

test('SSE partial review closes its task reference and never exposes rejected assets on refresh', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const storage = ecommerceStorage();
  const calls = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (options.method === 'POST') {
      return new Response(
        'data: {"type":"job","taskId":"task-sse-review"}\n\n' +
        'data: {"type":"complete","status":"needs_review","images":{"main":"/api/generated-assets/sse-review.png"},"errors":[]}\n\n',
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }
    return ecommerceTaskResponse({
      id: 'task-sse-review',
      status: 'needs_review',
      assets: [{ assetId: 'main', status: 'needs_review', stableUrl: '/api/generated-assets/sse-review.png' }],
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?sse-needs-review=${Date.now()}`);
  const first = await generateEcommerce({
    productName: '测试商品',
    category: '其他',
    platform: '淘宝',
    draftId: 'ec-draft-sse-review',
  });
  assert.equal(first.status, 'needs_review');
  assert.equal(loadEcommerceTaskReference({
    ownerEmail: 'owner@example.com',
    draftId: 'ec-draft-sse-review',
    storage,
  }), null);
  assert.deepEqual(first.images, { main: '/api/generated-assets/sse-review.png' });
  assert.deepEqual(calls, [{ url: '/api/generate-ecommerce', method: 'POST' }]);
});

test('legacy ecommerce SSE never previews a quality-check intermediate as a delivered image', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const emitted = [];
  globalThis.localStorage = ecommerceStorage();
  globalThis.fetch = async () => new Response(
    'data: {"type":"job","taskId":"task-sse-delivery"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/intermediate.png","state":"quality_check"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/review.png","state":"needs_review"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/unknown.png"}\n\n'
      + 'data: {"type":"image","id":"main-1","url":"/api/generated-assets/final.png","state":"completed"}\n\n'
      + 'data: {"type":"complete","status":"completed","images":{"main-1":"/api/generated-assets/final.png"},"errors":[]}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });

  const { generateEcommerce } = await import(`../src/services/api.js?sse-delivery=${Date.now()}`);
  const result = await generateEcommerce({
    productName: '测试商品', category: '其他', platform: '淘宝', onImage: image => emitted.push(image),
  });

  assert.deepEqual(result.images, { 'main-1': '/api/generated-assets/final.png' });
  assert.deepEqual(emitted.map(image => [image.stableUrl, image.state]), [
    ['/api/generated-assets/final.png', 'completed'],
  ]);
});

test('frontend generation entrypoints only target implemented generation routes', async () => {
  const api = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(api, /\/api\/generate-ecommerce/);
  assert.doesNotMatch(api, /generate-ecommerce-v2|\/api\/auto-generate|\/api\/trial\//);
  assert.equal((server.match(/app\.get\('\/api\/ecommerce\/jobs\/:id'/g) || []).length, 1);
  assert.match(server, /app\.post\('\/api\/generate-ecommerce'/);
  assert.match(server, /app\.post\('\/api\/ecommerce\/design-directions'/);
  assert.match(server, /app\.post\('\/api\/canvas\/regenerate'/);
  assert.doesNotMatch(server, /quality:\s*['"]high['"]/);
});

test('stable ecommerce quality analysis uses the detected JPEG, PNG, or WebP MIME', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(server, /async function analyzeStableEcommerceAsset\(/);
  assert.match(server, /stableAssetDataUrl\(\{\s*buffer,\s*contentType:/);
  const start = server.indexOf('async function analyzeStableEcommerceAsset(');
  const end = server.indexOf('\nfunction qualityAdapter', start);
  assert.doesNotMatch(server.slice(start, end), /contentType:\s*['"]image\/png['"]/);
});

test('formal ecommerce visual quality schema requires an explicit semantic layout verdict', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const start = server.indexOf('async function analyzeStableEcommerceAsset(');
  const end = server.indexOf('\nconst ecommerceBilling', start);
  const qualitySource = server.slice(start, end);

  assert.match(qualitySource, /buildFormalEcommerceQualityPrompt\(\)/);
  assert.doesNotMatch(qualitySource, /single_product\|collage\|uncertain/);
  assert.match(qualitySource, /details:[\s\S]*layout/);
});

test('ecommerce asset upload forwards a caller AbortController signal', async t => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let requestSignal;
  globalThis.fetch = async (_url, options = {}) => {
    requestSignal = options.signal;
    return new Response(JSON.stringify({
      original: { assetId: 'asset-upload-signal', url: '/api/assets/original.png', role: 'product' },
      preview: { url: '/api/assets/preview.png' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const { uploadEcommerceAsset } = await import(`../src/services/api.js?asset-signal=${Date.now()}`);
  const asset = await uploadEcommerceAsset({
    data: 'data:image/png;base64,AA==',
    role: 'product',
    signal: controller.signal,
  });
  assert.equal(requestSignal, controller.signal);
  assert.equal(asset.assetId, 'asset-upload-signal');
});

test('generation rejects a stream that never reaches complete', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"progress","step":"generating"}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?contract=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /生成未完成/
  );
});

test('generation propagates an SSE error instead of swallowing it as parse noise', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"error","error":"上游生成失败","code":"UPSTREAM_ERROR"}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?error=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /上游生成失败/
  );
});

test('generation does not report success when the completed task contains no images', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async () => new Response(
    'data: {"type":"complete","images":{},"errors":[{"error":"上游没有返回图片"}]}\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
  const { generateEcommerce } = await import(`../src/services/api.js?empty=${Date.now()}`);
  await assert.rejects(
    generateEcommerce({ productName: '测试商品', category: '其他', platform: '淘宝' }),
    /上游没有返回图片/
  );
});

test('homepage ecommerce long-description mode uses the unified ecommerce route', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  assert.match(source, /generateEcommerce\(/);
  assert.doesNotMatch(source, /for \(let i = 0; i < 5; i\+\+\)[\s\S]{0,500}regenerateImage\(/);
});

test('canvas regeneration forwards supplementary visual references', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url: String(url), body });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: 'canvas-quote' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ url: '/api/generated-assets/test.png' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const { regenerateCanvasImage } = await import(`../src/services/api.js?canvas-refs=${Date.now()}`);
  await regenerateCanvasImage({
    prompt: '保留商品结构，换成夏日场景',
    imageUrl: '/api/generated-assets/source.png',
    referenceImages: ['/api/ec-temp-img/reference.png'],
    ratio: '3:4',
  });
  const requestBody = requests.find(request => request.url.endsWith('/api/canvas/regenerate')).body;
  assert.deepEqual(requestBody.reference_images, ['/api/ec-temp-img/reference.png']);
  assert.equal(requestBody.ratio, '3:4');
  assert.equal(requestBody.billing_quote_id, 'canvas-quote');
});

test('Canvas API helpers send the signed session token and omit body email authority', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      email: 'stale-owner@example.com',
      token: 'signed-canvas-session',
      expiresAt: '2999-01-01T00:00:00.000Z',
    }),
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      headers: options.headers || {},
      body: JSON.parse(options.body || '{}'),
    });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      url: '/api/generated-assets/canvas.png',
      layers: [],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const api = await import(`../src/services/api.js?canvas-auth=${Date.now()}`);
  await api.regenerateCanvasImage({
    prompt: '保留商品结构',
    imageUrl: '/api/generated-assets/source.png',
    ratio: '1:1',
  });
  await api.transformCanvasImage({
    action: 'upscale',
    imageUrl: '/api/generated-assets/source.png',
  });
  await api.transformCanvasImage({
    action: 'upscale',
    imageUrl: '/api/generated-assets/source.png',
    resolution: '4K',
  });
  await api.analyzeCanvasLayers('/api/generated-assets/source.png');

  assert.deepEqual(requests.map(request => request.url), [
    '/api/billing/quote',
    '/api/canvas/regenerate',
    '/api/billing/quote',
    '/api/canvas/transform',
    '/api/billing/quote',
    '/api/canvas/transform',
    '/api/canvas/analyze-layers',
  ]);
  assert.deepEqual(
    requests.filter(request => request.url.endsWith('/api/billing/quote')).map(request => request.body.sku),
    ['ec_image_2k', 'ec_image_2k', 'ec_image_4k'],
  );
  for (const request of requests) {
    assert.equal(request.headers.Authorization, 'Bearer signed-canvas-session', request.url);
    assert.equal(Object.hasOwn(request.body, 'email'), false, request.url);
  }
});

test('Canvas API helpers preserve structured non-2xx errors', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = {
    getItem: () => JSON.stringify({
      token: 'expired-canvas-session',
      expiresAt: '2999-01-01T00:00:00.000Z',
    }),
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: '登录状态无效或已过期',
    code: 'AUTH_SESSION_REQUIRED',
    resumeable: false,
    detail: 'signed Canvas request rejected',
  }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

  const api = await import(`../src/services/api.js?canvas-errors=${Date.now()}`);
  const calls = [
    () => api.regenerateCanvasImage({
      prompt: '保留商品结构',
      imageUrl: '/api/generated-assets/source.png',
      ratio: '1:1',
    }),
    () => api.transformCanvasImage({
      action: 'upscale',
      imageUrl: '/api/generated-assets/source.png',
    }),
    () => api.analyzeCanvasLayers('/api/generated-assets/source.png'),
  ];

  for (const call of calls) {
    await assert.rejects(
      call(),
      error => error.name === 'ApiError'
        && error.status === 401
        && error.code === 'AUTH_SESSION_REQUIRED'
        && error.payload?.detail === 'signed Canvas request rejected',
    );
  }
});

test('all service-layer expensive requests carry the authenticated session email', async t => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : {};
    requests.push({ url: String(url), body });
    if (String(url).endsWith('/api/billing/quote')) {
      return new Response(JSON.stringify({ quote: { quoteId: `quote-${requests.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (String(url).endsWith('/api/generate')) {
      return new Response('data: {"type":"complete","image_urls":[],"cover_url":""}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }
    if (String(url).endsWith('/api/regenerate-image')) {
      return new Response(JSON.stringify({ url: '/api/generated-assets/test.png' }), { status: 200 });
    }
    return new Response(JSON.stringify({ prompt: 'test', url: '/api/generated-assets/test.png', directions: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const api = await import(`../src/services/api.js?auth-contract=${Date.now()}`);
  await api.reversePrompt({ image_url: '/api/generated-assets/source.png', product_name: '商品' });
  await api.removeBg({ image_url: '/api/generated-assets/source.png' });
  await api.generateContent('测试内容', []);
  await api.autoRecognizeEcommerce({ smartBrief: '测试商品', refShots: [] });
  await api.getDesignDirections({ product_name: '测试商品', real_shots: [], ref_shots: [] });
  await api.polishECText({ text: '测试文案', product_name: '商品', category: '其他' });
  await api.extractProductLink('https://example.com/product');
  await api.regenerateImage('测试提示词', '其他');
  await api.regenerateText('测试文案', '其他');

  const generationRequests = requests.filter(request => !request.url.endsWith('/api/billing/quote'));
  assert.equal(generationRequests.length, 9);
  for (const request of generationRequests) {
    assert.equal(request.body.email, '867550189@qq.com', `${request.url} must carry session email`);
  }
});

test('direct generation screens cannot bypass the authenticated API payload helpers', async () => {
  const canvas = await fs.readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const plog = await fs.readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8');
  const xhs = await fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  const remake = await fs.readFile(new URL('../src/pages/Remake/index.jsx', import.meta.url), 'utf8');
  const api = await fs.readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');

  assert.doesNotMatch(canvas, /fetch\([^\n]*\/api\/remove-bg/);
  assert.match(canvas, /removeBg\(\{ image_url:/);
  assert.match(plog, /generatePlogContent\(/);
  assert.match(xhs, /generatePlogContent\(/);
  assert.match(api, /JSON\.stringify\(withSessionEmail\(payload\)\)/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{ taskId \}\)\)/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{[\s\S]{0,300}productName:/);
  assert.match(api, /if \(!res\.ok\) \{[\s\S]{0,100}throw await createApiError\(res,/);
  assert.match(plog, /handleGenerationAccessError\(e, dispatch,/);
  assert.match(api, /if \(!res\.ok\) \{[\s\S]{0,100}throw await createApiError\(res,/);
  assert.match(remake, /if \(!res\.ok\) throw await createApiError\(res,/);
});

test('pricing page exposes no legacy or clickable payment-provider path while providers are unavailable', async () => {
  const pricing = await fs.readFile(new URL('../src/pages/Pricing/index.jsx', import.meta.url), 'utf8');
  const pricingModal = await fs.readFile(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
  const insufficientModal = await fs.readFile(new URL('../src/components/billing/InsufficientBalanceModal.jsx', import.meta.url), 'utf8');
  const constants = await fs.readFile(new URL('../src/constants/data.js', import.meta.url), 'utf8');
  const pricingModalOnly = pricingModal.slice(pricingModal.indexOf('export function PricingModal()'));

  for (const source of [pricing, pricingModalOnly]) {
    assert.doesNotMatch(source, /\/api\/create-payment/);
    assert.doesNotMatch(source, /支付宝支付|微信支付/);
    assert.doesNotMatch(source, /Stripe[\s\S]{0,80}(支付宝|微信)/);
    assert.doesNotMatch(source, /paid=1/);
    assert.doesNotMatch(source, /\bpaidSuccess\b/);
    assert.match(source, /支付服务接入中/);
  }
  assert.match(pricing, /永久 AI 积分包/);
  assert.doesNotMatch(pricing, /每套套餐中的「套」是什么意思/);
  assert.doesNotMatch(pricing, /服务端|实时报价|幂等/);
  assert.doesNotMatch(pricingModalOnly, /套餐 SKU|支付通道|幂等|服务端|实时报价/);
  assert.doesNotMatch(insufficientModal, /支付通道|幂等|服务端|实时报价/);
  assert.match(insufficientModal, /查看可用套餐/);
  assert.doesNotMatch(pricingModalOnly, /CLEAR_PAYWALL/);
  assert.match(pricingModalOnly, /#0f766e|#14b8a6/i);
  assert.doesNotMatch(constants, /PRICING_EC[\s\S]{0,900}(?:price|sets|credits|grantUnits|validityDays)\s*:/);
});
