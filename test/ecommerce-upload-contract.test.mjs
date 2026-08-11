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

test('direction inputs upload each Base64 image as a durable role-scoped asset', async (t) => {
  installSignedSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    if (String(url).endsWith('/design-directions')) return jsonResponse({ directions: [] });
    const index = requests.length;
    return jsonResponse({
      original: { assetId: `${String(index).repeat(64)}.jpg`, url: `/api/generated-assets/${String(index).repeat(64)}.jpg`, role: index === 1 ? 'product' : 'reference' },
      preview: { assetId: `${String(index + 4).repeat(64)}.webp`, url: `/api/generated-assets/${String(index + 4).repeat(64)}.webp`, role: index === 1 ? 'product' : 'reference' },
    }, 201);
  };
  t.after(() => { globalThis.fetch = originalFetch; delete globalThis.localStorage; });

  const api = await import(`../src/services/api.js?direction-assets=${Date.now()}`);
  await api.getDesignDirections({
    real_shots: ['data:image/jpeg;base64,PRODUCT'],
    ref_shots: ['data:image/jpeg;base64,REFERENCE'],
    smartBrief: '保留产品真实结构',
  });

  assert.deepEqual(requests.map(request => request.url), [
    '/api/ecommerce/assets',
    '/api/ecommerce/assets',
    '/api/ecommerce/design-directions',
  ]);
  assert.equal(requests[0].body.role, 'product');
  assert.equal(requests[1].body.role, 'reference');
});

test('direction analysis keeps try-on item, person, and scene lanes without duplicate uploads', async (t) => {
  installSignedSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = JSON.parse(options.body);
    requests.push({ url: String(url), body });
    if (String(url).endsWith('/design-directions')) return jsonResponse({ directions: [] });
    const index = requests.filter(request => request.url.endsWith('/assets')).length;
    return jsonResponse({
      original: { assetId: `${String(index).repeat(64)}.jpg`, url: `/api/generated-assets/${String(index).repeat(64)}.jpg`, role: body.role },
      preview: { assetId: `${String(index + 4).repeat(64)}.webp`, url: `/api/generated-assets/${String(index + 4).repeat(64)}.webp`, role: body.role },
    }, 201);
  };
  t.after(() => { globalThis.fetch = originalFetch; delete globalThis.localStorage; });

  const api = await import(`../src/services/api.js?tryon-directions=${Date.now()}`);
  await api.getDesignDirections({
    product_name: '春季穿搭',
    abilityRecipe: { id: 'anything_tryon', version: 1 },
    personMode: 'reference',
    roleImages: {
      items: ['data:image/jpeg;base64,ITEM'],
      person: ['data:image/jpeg;base64,PERSON'],
      scene: ['data:image/jpeg;base64,SCENE'],
    },
  });

  const uploads = requests.filter(request => request.url.endsWith('/assets'));
  assert.equal(uploads.length, 3);
  assert.deepEqual(uploads.map(request => request.body.role).sort(), ['person', 'product', 'scene']);
  const direction = requests.find(request => request.url.endsWith('/design-directions'))?.body;
  assert.deepEqual(direction.ability_recipe, { id: 'anything_tryon', version: 1 });
  assert.equal(direction.person_mode, 'reference');
  assert.equal(direction.items.length, 1);
  assert.equal(direction.person.length, 1);
  assert.equal(direction.scene.length, 1);
  assert.equal(Object.hasOwn(direction, 'roleImages'), false);
  assert.equal(Object.hasOwn(direction, 'abilityRecipe'), false);
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
    contentType: 'detail',
    targetLanguage: 'en',
    commerceContext: {
      platform: 'Amazon',
      contentType: 'detail',
      targetLanguage: 'en',
    },
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
    imageModel: 'image2',
    images: [{ key: 'main_text', count: 2, ratio: '1:1' }],
  });
  assert.equal(requests[0].body.billing_quote_id, 'bq1.accepted.quote');
  assert.deepEqual(requests[0].body.commerce_context, {
    platform: 'amazon',
    contentType: 'detail',
    targetLanguage: 'en',
    locale: 'en-US',
    policyVersion: 'global-commerce-v1',
  });
  assert.equal(requests[0].body.platform, 'amazon');
  assert.equal(requests[0].body.content_type, 'detail');
  assert.equal(requests[0].body.target_language, 'en');
  assert.equal(Object.hasOwn(requests[0].body, 'real_shots'), false);
  assert.equal(Object.hasOwn(requests[0].body, 'reference_images'), false);
});

test('formal generation carries try-on roles and an ordered ability manifest', async (t) => {
  installSignedSession();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(
      'data: {"type":"complete","images":{"main":"/api/generated-assets/result.png"},"errors":[]}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.localStorage;
  });

  const api = await import(`../src/services/api.js?tryon-generation=${Date.now()}`);
  const owned = (id, role) => ({
    assetId: `${id.repeat(64)}.png`,
    url: `/api/generated-assets/${id.repeat(64)}.png`,
    previewUrl: `/api/generated-assets/${id.repeat(64)}.webp`,
    role,
  });
  const items = [owned('a', 'product'), owned('b', 'product')];
  const person = [owned('c', 'person')];
  const scene = [owned('d', 'scene')];

  await api.generateEcommerce({
    productName: '春季穿搭',
    category: '服饰穿搭',
    platform: '淘宝',
    abilityRecipe: { id: 'anything_tryon', version: 1 },
    roleAssets: { items, person, scene },
    personMode: 'reference',
    assetRoles: [
      { assetId: items[0].assetId, role: 'items', ordinal: 0 },
      { assetId: items[1].assetId, role: 'items', ordinal: 1 },
      { assetId: person[0].assetId, role: 'person', ordinal: 0 },
      { assetId: scene[0].assetId, role: 'scene', ordinal: 0 },
    ],
  });

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].body.ability_recipe, { id: 'anything_tryon', version: 1 });
  assert.equal(requests[0].body.person_mode, 'reference');
  assert.deepEqual(requests[0].body.assets, {
    items: items.map(({ assetId, url }) => ({ assetId, url })),
    person: person.map(({ assetId, url }) => ({ assetId, url })),
    scene: scene.map(({ assetId, url }) => ({ assetId, url })),
  });
  assert.deepEqual(requests[0].body.asset_roles, [
    { assetId: items[0].assetId, role: 'items', ordinal: 0 },
    { assetId: items[1].assetId, role: 'items', ordinal: 1 },
    { assetId: person[0].assetId, role: 'person', ordinal: 0 },
    { assetId: scene[0].assetId, role: 'scene', ordinal: 0 },
  ]);
});
