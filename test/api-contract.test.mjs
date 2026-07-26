import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

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
  let requestBody;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalStorage;
  });
  globalThis.localStorage = { getItem: () => JSON.stringify({ email: '867550189@qq.com' }) };
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
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
  assert.deepEqual(requestBody.reference_images, ['/api/ec-temp-img/reference.png']);
  assert.equal(requestBody.ratio, '3:4');
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
  await api.analyzeCanvasLayers('/api/generated-assets/source.png');

  assert.deepEqual(requests.map(request => request.url), [
    '/api/canvas/regenerate',
    '/api/canvas/transform',
    '/api/canvas/analyze-layers',
  ]);
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

  assert.equal(requests.length, 9);
  for (const request of requests) {
    assert.equal(request.body.email, '867550189@qq.com', `${request.url} must carry session email`);
  }
});

test('direct generation screens cannot bypass the authenticated API payload helpers', async () => {
  const canvas = await fs.readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const plog = await fs.readFile(new URL('../src/pages/Plog/index.jsx', import.meta.url), 'utf8');
  const xhs = await fs.readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
  const remake = await fs.readFile(new URL('../src/pages/Remake/index.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(canvas, /fetch\([^\n]*\/api\/remove-bg/);
  assert.match(canvas, /removeBg\(\{ image_url:/);
  assert.match(plog, /JSON\.stringify\(withSessionEmail\(body\)\)/);
  assert.match(xhs, /JSON\.stringify\(withSessionEmail\(body\)\)/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{ taskId \}\)\)/);
  assert.match(remake, /JSON\.stringify\(withSessionEmail\(\{[\s\S]{0,300}productName:/);
  assert.match(plog, /if \(!res\.ok\) throw await createApiError\(res,/);
  assert.match(plog, /handleGenerationAccessError\(e, dispatch,/);
  assert.match(xhs, /if \(!res\.ok\) throw await createApiError\(res,/);
  assert.match(remake, /if \(!res\.ok\) throw await createApiError\(res,/);
});

test('pricing page exposes no legacy or clickable payment-provider path while providers are unavailable', async () => {
  const pricing = await fs.readFile(new URL('../src/pages/Pricing/index.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(pricing, /\/api\/create-payment/);
  assert.doesNotMatch(pricing, /createOrder\s*=/);
  assert.doesNotMatch(pricing, /支付宝支付|微信支付/);
  assert.doesNotMatch(pricing, /Stripe[\s\S]{0,80}(支付宝|微信)/);
  assert.match(pricing, /支付通道接入中/);
});
