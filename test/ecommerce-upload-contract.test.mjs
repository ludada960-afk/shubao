import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installSignedSession() {
  globalThis.localStorage = {
    getItem(key) {
      return key === 'sb-auth'
        ? JSON.stringify({
            email: 'owner@example.com',
            token: 'signed-ecommerce-session',
            expiresAt: '2999-01-01T00:00:00.000Z',
          })
        : null;
    },
    setItem() {},
  };
}

test('first-step formal generation uploads originals and has no 800px JPEG compression path', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

  assert.match(source, /uploadEcommerceAssets/);
  assert.doesNotMatch(source, /compressImage\s*\(/);
  assert.doesNotMatch(source, /toDataURL\(\s*['"]image\/jpeg['"]/);
  assert.doesNotMatch(source, /maxDim\s*=\s*800|compressImage\([^)]*800/);
});

test('authenticated ecommerce asset upload returns original and preview records without changing source data', async (t) => {
  installSignedSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  const originalData = 'data:image/jpeg;base64,ORIGINAL_JPEG_BYTES';
  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      method: options.method,
      headers: options.headers,
      body: JSON.parse(options.body),
    });
    return jsonResponse({
      original: {
        assetId: `${'a'.repeat(64)}.jpg`,
        url: `/api/generated-assets/${'a'.repeat(64)}.jpg`,
        role: 'product',
      },
      preview: {
        assetId: `${'b'.repeat(64)}.webp`,
        url: `/api/generated-assets/${'b'.repeat(64)}.webp`,
        role: 'product',
      },
    }, 201);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  });

  const api = await import(`../src/services/api.js?asset-upload=${Date.now()}`);
  const uploaded = await api.uploadEcommerceAsset({ data: originalData, role: 'product' });

  assert.deepEqual(requests, [{
    url: '/api/ecommerce/assets',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer signed-ecommerce-session',
    },
    body: { data: originalData, role: 'product' },
  }]);
  assert.deepEqual(uploaded, {
    assetId: `${'a'.repeat(64)}.jpg`,
    url: `/api/generated-assets/${'a'.repeat(64)}.jpg`,
    previewUrl: `/api/generated-assets/${'b'.repeat(64)}.webp`,
    role: 'product',
  });
});

test('formal generation preserves owner-scoped asset IDs, quote reference, and merges 4K into planner sizing', async (t) => {
  installSignedSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url),
      body: JSON.parse(options.body),
      headers: options.headers,
    });
    return new Response(
      'data: {"type":"complete","images":{"main":"/api/generated-assets/result.png"},"errors":[]}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  });

  const api = await import(`../src/services/api.js?asset-generation=${Date.now()}`);
  await api.generateEcommerce({
    productName: '测试商品',
    category: '数码3C',
    platform: '淘宝',
    realShots: [{
      assetId: `${'c'.repeat(64)}.png`,
      url: `/api/generated-assets/${'c'.repeat(64)}.png`,
      previewUrl: `/api/generated-assets/${'d'.repeat(64)}.webp`,
      role: 'product',
    }],
    refImgs: [{
      assetId: `${'e'.repeat(64)}.jpg`,
      url: `/api/generated-assets/${'e'.repeat(64)}.jpg`,
      previewUrl: `/api/generated-assets/${'f'.repeat(64)}.webp`,
      role: 'reference',
    }],
    sizing: {
      smart: false,
      images: [{ key: 'main_text', count: 2, ratio: '1:1' }],
    },
    generationSettings: { resolution: '4K', negativePrompt: '错误品牌元素' },
    billingQuoteId: 'bq1.accepted.quote',
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/generate-ecommerce');
  assert.equal(requests[0].headers.Authorization, 'Bearer signed-ecommerce-session');
  assert.deepEqual(requests[0].body.assets, {
    product: [{
      assetId: `${'c'.repeat(64)}.png`,
      url: `/api/generated-assets/${'c'.repeat(64)}.png`,
    }],
    reference: [{
      assetId: `${'e'.repeat(64)}.jpg`,
      url: `/api/generated-assets/${'e'.repeat(64)}.jpg`,
    }],
  });
  assert.deepEqual(requests[0].body.sizing, {
    smart: false,
    resolution: '4K',
    images: [{ key: 'main_text', count: 2, ratio: '1:1' }],
  });
  assert.equal(requests[0].body.billing_quote_id, 'bq1.accepted.quote');
  assert.equal(Object.hasOwn(requests[0].body, 'real_shots'), false);
  assert.equal(Object.hasOwn(requests[0].body, 'reference_images'), false);
});
