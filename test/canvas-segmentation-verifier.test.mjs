import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

import {
  assertInstancePixelCoverage,
  assertOwnedGeneratedAssetUrl,
  createVerifierSegmentationMasks,
  verifyRestoredImageAssets,
  verifyCanvasSegmentation,
} from '../scripts/verify-canvas-segmentation.mjs';

async function transparentProductFixture({ color = [220, 110, 35], width = 48, height = 36 } = {}) {
  const pixels = Buffer.alloc(width * height * 4, 0);
  for (let y = 4; y < height - 4; y += 1) {
    for (let x = 5; x < width - 5; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function opaqueBackgroundFixture() {
  return sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 245, g: 242, b: 235, alpha: 1 } },
  }).png().toBuffer();
}

async function threeProductSceneFixture() {
  const width = 80;
  const height = 80;
  const backgroundColor = [243, 238, 228, 255];
  const sourcePixels = Buffer.alloc(width * height * 4, 0);
  for (let offset = 0; offset < sourcePixels.length; offset += 4) {
    sourcePixels.set(backgroundColor, offset);
  }
  const products = [
    { id: 'gray', x: 16, y: 12, width: 16, height: 16, color: [145, 150, 155, 255] },
    { id: 'blue', x: 10, y: 32, width: 20, height: 20, color: [55, 165, 220, 255] },
    { id: 'orange', x: 48, y: 32, width: 20, height: 20, color: [240, 135, 30, 255] },
  ];
  const instanceBuffers = new Map();
  const groupBounds = { x: 8, y: 8, width: 64, height: 48 };
  const groupPixels = Buffer.alloc(groupBounds.width * groupBounds.height * 4, 0);
  for (const product of products) {
    const instancePixels = Buffer.alloc(product.width * product.height * 4, 0);
    for (let y = 2; y < product.height - 2; y += 1) {
      for (let x = 2; x < product.width - 2; x += 1) {
        const sourceOffset = ((product.y + y) * width + product.x + x) * 4;
        const instanceOffset = (y * product.width + x) * 4;
        const groupOffset = (((product.y - groupBounds.y) + y) * groupBounds.width
          + (product.x - groupBounds.x) + x) * 4;
        sourcePixels.set(product.color, sourceOffset);
        instancePixels.set(product.color, instanceOffset);
        groupPixels.set(product.color, groupOffset);
      }
    }
    instanceBuffers.set(product.id, await sharp(instancePixels, {
      raw: { width: product.width, height: product.height, channels: 4 },
    }).png().toBuffer());
  }
  return {
    source: await sharp(sourcePixels, { raw: { width, height, channels: 4 } }).png().toBuffer(),
    group: await sharp(groupPixels, {
      raw: { width: groupBounds.width, height: groupBounds.height, channels: 4 },
    }).png().toBuffer(),
    instances: instanceBuffers,
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function segmentationPlanFixture({ width = 80, height = 80 } = {}) {
  return {
    source: { width, height },
    prompts: [
      { id: 'gray', name: '灰色盒子', box: [12, 8, 36, 36] },
      { id: 'blue', name: '蓝色盒子', box: [6, 28, 36, 60] },
      { id: 'orange', name: '橙色盒子', box: [44, 28, 74, 60] },
    ],
    plan_token: 'signed-segmentation-plan',
    expires_at: '2099-01-01T00:00:00.000Z',
  };
}

test('verifier masks retain transparent contour pixels after tight cropping', async () => {
  const [mask] = await createVerifierSegmentationMasks([
    { id: 'product-1', box: [10, 20, 110, 140] },
  ]);
  const encoded = String(mask.data).replace(/^data:image\/png;base64,/, '');
  const { data, info } = await sharp(Buffer.from(encoded, 'base64'))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const active = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] >= 16) active.push({ x, y });
    }
  }
  assert.ok(active.length > 0);
  const left = Math.min(...active.map(pixel => pixel.x));
  const right = Math.max(...active.map(pixel => pixel.x));
  const top = Math.min(...active.map(pixel => pixel.y));
  const bottom = Math.max(...active.map(pixel => pixel.y));
  let transparentPixels = 0;
  const croppedPixels = (right - left + 1) * (bottom - top + 1);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (data[y * info.width + x] < 250) transparentPixels += 1;
    }
  }
  assert.ok(transparentPixels / croppedPixels >= 0.01);
});

test('rejects external provider URLs instead of treating them as stable owned assets', () => {
  assert.throws(
    () => assertOwnedGeneratedAssetUrl('https://fal.media/temporary-mask.png', 'https://shuimg.cn'),
    /owned generated asset/i,
  );
  assert.equal(
    assertOwnedGeneratedAssetUrl('/api/generated-assets/asset-1', 'https://shuimg.cn').href,
    'https://shuimg.cn/api/generated-assets/asset-1',
  );
});

test('rejects a group image whose pixels do not contain the product instance', () => {
  const instancePixels = Buffer.from([
    220, 80, 40, 255,
    220, 80, 40, 255,
    220, 80, 40, 255,
    220, 80, 40, 255,
  ]);
  const emptyGroup = Buffer.alloc(4 * 4 * 4, 0);

  assert.throws(
    () => assertInstancePixelCoverage({
      target: { rgba: emptyGroup, width: 4, height: 4, channels: 4 },
      targetBounds: { x: 0, y: 0, width: 1, height: 1 },
      instance: { rgba: instancePixels, width: 2, height: 2, channels: 4 },
      instanceBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      label: 'product group',
    }),
    /does not cover/i,
  );
});

test('rejects an image asset that changes after Canvas save and reload', async () => {
  const changed = await transparentProductFixture({ color: [20, 30, 40] });
  await assert.rejects(
    () => verifyRestoredImageAssets({
      snapshot: {
        nodes: [{
          id: 'layer-1',
          kind: 'image',
          semanticType: 'product-instance',
          url: '/api/generated-assets/layer-1',
        }],
      },
      expectedAssetsByUrl: new Map([
        ['https://shuimg.cn/api/generated-assets/layer-1', { pixelHash: 'expected-before-save' }],
      ]),
      baseUrl: 'https://shuimg.cn',
      fetchImpl: async () => new Response(changed, { headers: { 'content-type': 'image/png' } }),
      timeoutMs: 10_000,
    }),
    /changed after canvas save and reload/i,
  );
});

test('verifies three product instances, transparency, stable assets and Canvas save/reload', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canvas-segmentation-verifier-'));
  const imagePath = path.join(directory, 'three-products.png');
  const scene = await threeProductSceneFixture();
  await writeFile(imagePath, scene.source);

  const productAssets = new Map([
    ['/api/generated-assets/remove-result', scene.group],
    ['/api/generated-assets/group', scene.group],
    ['/api/generated-assets/gray', scene.instances.get('gray')],
    ['/api/generated-assets/blue', scene.instances.get('blue')],
    ['/api/generated-assets/orange', scene.instances.get('orange')],
  ]);
  const background = await opaqueBackgroundFixture();
  const assetReads = new Map();
  const requestBodies = [];
  let quote = 0;
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = String(options.method || 'GET').toUpperCase();
    if (options.body) requestBodies.push({ path: url.pathname, body: JSON.parse(options.body) });
    if (url.pathname === '/api/session') return json({ ok: true, email: 'owner@example.com' });
    if (url.pathname === '/api/canvas/segmentation-plan') return json(segmentationPlanFixture());
    if (url.pathname === '/api/billing/quote') {
      quote += 1;
      return json({ quote: { quoteId: `quote-${quote}`, totalUnits: quote === 1 ? 1000 : 3000 } });
    }
    if (url.pathname === '/api/remove-bg') {
      return json({
        url: '/api/generated-assets/remove-result',
        result_url: '/api/generated-assets/remove-result',
        method: 'u2netp-browser',
        subjectCount: 3,
        bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
        pixelWidth: 64,
        pixelHeight: 48,
      });
    }
    if (url.pathname === '/api/canvas/analyze-layers') {
      return json({
        status: 'complete',
        capabilities: { productGroup: true, productInstances: 3, backgroundCleanPlate: true, editableText: 1 },
        warnings: [],
        layers: [
          { id: 'group', kind: 'image', semanticType: 'product-group', url: '/api/generated-assets/group', bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 }, pixelWidth: 64, pixelHeight: 48 },
          { id: 'gray', kind: 'image', semanticType: 'product-instance', url: '/api/generated-assets/gray', bounds: { x: 0.2, y: 0.15, width: 0.2, height: 0.2 }, pixelWidth: 16, pixelHeight: 16 },
          { id: 'blue', kind: 'image', semanticType: 'product-instance', url: '/api/generated-assets/blue', bounds: { x: 0.125, y: 0.4, width: 0.25, height: 0.25 }, pixelWidth: 20, pixelHeight: 20 },
          { id: 'orange', kind: 'image', semanticType: 'product-instance', url: '/api/generated-assets/orange', bounds: { x: 0.6, y: 0.4, width: 0.25, height: 0.25 }, pixelWidth: 20, pixelHeight: 20 },
          { id: 'background', kind: 'image', semanticType: 'background', url: '/api/generated-assets/background', pixelWidth: 64, pixelHeight: 64 },
          { id: 'caption', kind: 'text', semanticType: 'text', text: '三色盖子可选择', editable: true },
        ],
      });
    }
    if (url.pathname.startsWith('/api/generated-assets/')) {
      const count = (assetReads.get(url.pathname) || 0) + 1;
      assetReads.set(url.pathname, count);
      const body = url.pathname.endsWith('/background') ? background : productAssets.get(url.pathname);
      return new Response(body, { status: 200, headers: { 'content-type': 'image/png', 'cache-control': 'public, immutable' } });
    }
    if (url.pathname === '/api/projects') return json({ project: { id: 'project-1' } }, 201);
    if (url.pathname === '/api/projects/project-1/versions') return json({ version: { id: 'version-1' } }, 201);
    if (url.pathname === '/api/canvas-sessions' && method === 'POST') {
      return json({ session: { id: 'session-1', revision: 1 } }, 201);
    }
    if (url.pathname === '/api/canvas-sessions/session-1/save') {
      return json({ session: { id: 'session-1', revision: 2 } });
    }
    if (url.pathname === '/api/canvas-sessions/session-1' && method === 'GET') {
      const snapshot = requestBodies.find(item => item.path === '/api/canvas-sessions/session-1/save')?.body?.snapshot;
      return json({ session: { id: 'session-1', revision: 2, snapshot } });
    }
    return json({ error: `unexpected ${method} ${url.pathname}` }, 404);
  };

  const result = await verifyCanvasSegmentation({
    baseUrl: 'https://shuimg.cn',
    sessionToken: 'signed-session-token',
    imagePath,
    expectedInstances: 3,
    fetchImpl,
  });

  assert.equal(result.removeBackground.subjectCount, 3);
  assert.equal(result.smartLayers.productInstances, 3);
  assert.equal(result.canvasSessionId, 'session-1');
  assert.ok([...assetReads.values()].every(count => count >= 2));
  assert.deepEqual(
    requestBodies.filter(item => item.path === '/api/billing/quote').map(item => item.body.sku),
    ['ec_remove_bg', 'ec_smart_layer'],
  );
  assert.match(requestBodies.find(item => item.path === '/api/remove-bg').body.image_url, /^data:image\/png;base64,/);
  const removeBody = requestBodies.find(item => item.path === '/api/remove-bg').body;
  const layersBody = requestBodies.find(item => item.path === '/api/canvas/analyze-layers').body;
  assert.equal(removeBody.segmentation_plan_token, 'signed-segmentation-plan');
  assert.equal(layersBody.segmentation_plan_token, 'signed-segmentation-plan');
  assert.equal(removeBody.segmentation_masks.length, 3);
  assert.ok(removeBody.segmentation_masks.every(mask => /^data:image\/png;base64,/.test(mask.data)));
  assert.deepEqual(removeBody.segmentation_masks, layersBody.segmentation_masks);
  assert.doesNotMatch(JSON.stringify(result), /signed-session-token/);
  const createdSnapshot = requestBodies.find(item => item.path === '/api/canvas-sessions')?.body?.snapshot;
  assert.ok(createdSnapshot.nodes.some(node => node.id === 'verified-source'));
  assert.ok(createdSnapshot.nodes.some(node => node.semanticType === 'remove-background'));
  assert.ok(createdSnapshot.connections.every(edge => createdSnapshot.nodes.some(node => node.id === edge.fromNodeId)));
});

test('fails closed when removal returns an opaque copied image or too few products', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canvas-segmentation-verifier-invalid-'));
  const imagePath = path.join(directory, 'source.png');
  await writeFile(imagePath, await opaqueBackgroundFixture());
  let quote = 0;
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/session') return json({ ok: true });
    if (url.pathname === '/api/canvas/segmentation-plan') return json(segmentationPlanFixture({ width: 64, height: 64 }));
    if (url.pathname === '/api/billing/quote') return json({ quote: { quoteId: `quote-${++quote}`, totalUnits: 1000 } });
    if (url.pathname === '/api/remove-bg') {
      return json({ url: '/api/generated-assets/opaque-copy', method: 'u2netp-browser', subjectCount: 1 });
    }
    if (url.pathname.startsWith('/api/generated-assets/')) {
      return new Response(await opaqueBackgroundFixture(), { headers: { 'content-type': 'image/png' } });
    }
    return json({}, 404);
  };

  await assert.rejects(
    () => verifyCanvasSegmentation({
      baseUrl: 'https://shuimg.cn',
      sessionToken: 'signed-session-token',
      imagePath,
      expectedInstances: 3,
      fetchImpl,
    }),
    /three product instances|transparent/i,
  );
});

test('rejects a near-opaque result with only one transparent pixel', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'canvas-segmentation-verifier-near-opaque-'));
  const imagePath = path.join(directory, 'source.png');
  await writeFile(imagePath, await opaqueBackgroundFixture());
  const rgba = await sharp(await opaqueBackgroundFixture()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  rgba.data[3] = 0;
  const nearOpaque = await sharp(rgba.data, { raw: rgba.info }).png().toBuffer();
  let quote = 0;
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/session') return json({ ok: true });
    if (url.pathname === '/api/canvas/segmentation-plan') return json(segmentationPlanFixture({ width: 64, height: 64 }));
    if (url.pathname === '/api/billing/quote') return json({ quote: { quoteId: `quote-${++quote}`, totalUnits: 1000 } });
    if (url.pathname === '/api/remove-bg') {
      return json({ url: '/api/generated-assets/near-opaque', method: 'u2netp-browser', subjectCount: 3 });
    }
    if (url.pathname.startsWith('/api/generated-assets/')) {
      return new Response(nearOpaque, { headers: { 'content-type': 'image/png' } });
    }
    return json({}, 404);
  };

  await assert.rejects(
    () => verifyCanvasSegmentation({
      baseUrl: 'https://shuimg.cn',
      sessionToken: 'signed-session-token',
      imagePath,
      expectedInstances: 3,
      fetchImpl,
    }),
    /meaningful transparent coverage/i,
  );
});
