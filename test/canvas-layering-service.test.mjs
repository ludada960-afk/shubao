import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { createCanvasLayeringService } from '../server/canvasLayeringService.mjs';
import {
  maskIntersectionOverUnion,
  normalizeSegmentationMask,
  unionSegmentationMasks,
} from '../server/canvasSegmentation.mjs';

const WIDTH = 120;
const HEIGHT = 90;
const RECTS = [
  { id: 'gray-box', name: '灰色盒', x: 10, y: 14, width: 24, height: 28, color: [120, 130, 140] },
  { id: 'blue-box', name: '蓝色盒', x: 43, y: 35, width: 28, height: 30, color: [60, 170, 220] },
  { id: 'orange-box', name: '橙色盒', x: 81, y: 26, width: 29, height: 32, color: [240, 135, 30] },
];

async function sourceFixture() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4, 255);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = 246;
      pixels[offset + 1] = 240;
      pixels[offset + 2] = 228;
    }
  }
  for (const rect of RECTS) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const offset = (y * WIDTH + x) * 4;
        pixels[offset] = rect.color[0];
        pixels[offset + 1] = rect.color[1];
        pixels[offset + 2] = rect.color[2];
      }
    }
  }
  return sharp(pixels, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).png().toBuffer();
}

async function maskFixture(rect) {
  const pixels = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      pixels[y * WIDTH + x] = 255;
    }
  }
  return sharp(pixels, { raw: { width: WIDTH, height: HEIGHT, channels: 1 } }).png().toBuffer();
}

function semanticPlan() {
  return {
    productGroup: { name: '三色盒', box: [0.05, 0.1, 0.9, 0.7], confidence: 0.99 },
    instances: RECTS.map(rect => ({
      id: rect.id,
      name: rect.name,
      kind: 'product',
      box: [rect.x / WIDTH, rect.y / HEIGHT, rect.width / WIDTH, rect.height / HEIGHT],
      confidence: 0.95,
    })),
    textBlocks: [{
      id: 'caption', text: '三色盖子可选择', box: [0.2, 0.82, 0.6, 0.09], confidence: 0.92,
      color: '#ffffff', background: '#efb64e',
    }],
  };
}

async function createHarness({ cleanPlate = true, omittedPromptIds = [] } = {}) {
  const source = await sourceFixture();
  const maskEntries = await Promise.all(RECTS.map(async rect => [
    `https://masks.test/${rect.id}.png`,
    await maskFixture(rect),
  ]));
  const masks = new Map(maskEntries);
  const persisted = [];
  const generatedAssetStore = {
    async persistBuffer({ buffer, contentType, label }) {
      const id = `asset-${persisted.length + 1}.png`;
      persisted.push({ id, buffer: Buffer.from(buffer), contentType, label });
      return { id, url: `/api/generated-assets/${id}`, contentType };
    },
  };
  const imageInputReader = {
    async read(url) {
      if (url === '/source.png') return { buffer: source, contentType: 'image/png' };
      if (masks.has(url)) return { buffer: masks.get(url), contentType: 'image/png' };
      throw new Error(`unknown fixture ${url}`);
    },
  };
  const visionClient = { async analyzeJson() { return semanticPlan(); } };
  const segmentationClient = {
    async segment({ prompts }) {
      return {
        requestId: 'sam-1',
        masks: prompts.filter(prompt => !omittedPromptIds.includes(prompt.id)).map(prompt => ({
          url: `https://masks.test/${prompt.id}.png`,
          promptId: prompt.id,
          score: 0.95,
        })),
      };
    },
  };
  const createBackgroundCleanPlate = cleanPlate === false
    ? async () => { throw new Error('edit provider unavailable'); }
    : async () => sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 246, g: 240, b: 228, alpha: 1 } },
    }).png().toBuffer();
  const service = createCanvasLayeringService({
    visionClient,
    segmentationClient,
    generatedAssetStore,
    imageInputReader,
    createBackgroundCleanPlate,
  });
  return { service, persisted };
}

test('normalizes binary masks, computes overlap and unions all product instances', async () => {
  const first = await normalizeSegmentationMask(await maskFixture(RECTS[0]), { width: WIDTH, height: HEIGHT });
  const second = await normalizeSegmentationMask(await maskFixture(RECTS[1]), { width: WIDTH, height: HEIGHT });
  assert.deepEqual(first.bounds, { x: 10, y: 14, width: 24, height: 28 });
  assert.equal(maskIntersectionOverUnion(first, first), 1);
  assert.equal(maskIntersectionOverUnion(first, second), 0);

  const union = unionSegmentationMasks([first, second]);
  assert.deepEqual(union.bounds, { x: 10, y: 14, width: 61, height: 51 });
  assert.equal(union.coverage, (24 * 28 + 28 * 30) / (WIDTH * HEIGHT));
});

test('normalizes provider-sized masks back to source pixels with nearest-neighbor edges', async () => {
  const providerWidth = WIDTH / 2;
  const providerHeight = HEIGHT / 2;
  const pixels = Buffer.alloc(providerWidth * providerHeight, 0);
  for (let y = 7; y < 21; y += 1) {
    for (let x = 5; x < 17; x += 1) pixels[y * providerWidth + x] = 255;
  }
  const providerMask = await sharp(pixels, {
    raw: { width: providerWidth, height: providerHeight, channels: 1 },
  }).png().toBuffer();

  const normalized = await normalizeSegmentationMask(providerMask, { width: WIDTH, height: HEIGHT });

  assert.deepEqual(normalized.bounds, { x: 10, y: 14, width: 24, height: 28 });
  assert.ok(normalized.data.every(value => value === 0 || value === 255));
});

test('removes tiny disconnected mask islands before calculating tight product bounds', async () => {
  const pixels = Buffer.alloc(WIDTH * HEIGHT, 0);
  for (let y = 20; y < 60; y += 1) {
    for (let x = 30; x < 70; x += 1) pixels[y * WIDTH + x] = 255;
  }
  pixels[2 * WIDTH + 115] = 255;
  const noisyMask = await sharp(pixels, {
    raw: { width: WIDTH, height: HEIGHT, channels: 1 },
  }).png().toBuffer();

  const normalized = await normalizeSegmentationMask(noisyMask, { width: WIDTH, height: HEIGHT });

  assert.deepEqual(normalized.bounds, { x: 30, y: 20, width: 40, height: 40 });
  assert.equal(normalized.data[2 * WIDTH + 115], 0);
});

test('creates three tight product assets, one grouped asset, clean background and editable text', async () => {
  const { service, persisted } = await createHarness();
  const result = await service.createLayers({ imageUrl: '/source.png' });

  assert.equal(result.status, 'complete');
  assert.equal(result.capabilities.productInstances, 3);
  assert.equal(result.capabilities.productGroup, true);
  assert.equal(result.capabilities.backgroundCleanPlate, true);
  assert.equal(result.capabilities.editableText, 1);
  assert.deepEqual(result.warnings, []);

  const instances = result.layers.filter(layer => layer.semanticType === 'product-instance');
  assert.deepEqual(instances.map(layer => layer.name), ['灰色盒', '蓝色盒', '橙色盒']);
  assert.deepEqual(instances.map(layer => layer.bounds), RECTS.map(rect => ({
    x: rect.x / WIDTH,
    y: rect.y / HEIGHT,
    width: rect.width / WIDTH,
    height: rect.height / HEIGHT,
  })));
  const group = result.layers.find(layer => layer.semanticType === 'product-group');
  assert.ok(group?.url.startsWith('/api/generated-assets/'));
  assert.ok(result.layers.some(layer => layer.semanticType === 'background'));
  assert.deepEqual(result.layers.find(layer => layer.semanticType === 'text'), {
    id: 'caption',
    kind: 'text',
    semanticType: 'text',
    name: '三色盖子可选择',
    text: '三色盖子可选择',
    bounds: { x: 0.2, y: 0.82, width: 0.6, height: 0.09 },
    confidence: 0.92,
    color: '#ffffff',
    background: '#efb64e',
    editable: true,
  });

  const productBuffers = persisted.filter(asset => /canvas_layer_product/.test(asset.label));
  assert.equal(productBuffers.length, 4);
  for (const asset of productBuffers) {
    const { data, info } = await sharp(asset.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.ok(info.width < WIDTH || info.height < HEIGHT);
    assert.ok(data.some((value, index) => index % 4 === 3 && value > 0));
  }
});

test('returns a truthful partial result when only background reconstruction fails', async () => {
  const { service } = await createHarness({ cleanPlate: false });
  const result = await service.createLayers({ imageUrl: '/source.png' });

  assert.equal(result.status, 'partial');
  assert.equal(result.capabilities.productInstances, 3);
  assert.equal(result.capabilities.backgroundCleanPlate, false);
  assert.ok(result.warnings.includes('背景净版生成失败'));
  assert.equal(result.layers.some(layer => layer.semanticType === 'background'), false);
});

test('reports partial capabilities when an expected product instance has no reliable mask', async () => {
  const { service } = await createHarness({ omittedPromptIds: ['orange-box'] });
  const result = await service.createLayers({ imageUrl: '/source.png' });

  assert.equal(result.status, 'partial');
  assert.equal(result.capabilities.productInstances, 2);
  assert.equal(result.capabilities.omittedProductInstances, 1);
  assert.equal(result.capabilities.productGroup, false);
  assert.equal(result.capabilities.backgroundCleanPlate, false);
  assert.equal(result.layers.some(layer => layer.semanticType === 'product-group'), false);
  assert.equal(result.layers.some(layer => layer.semanticType === 'background'), false);
  assert.ok(result.warnings.some(warning => /1 个商品实例/.test(warning)));
});

test('remove background fails instead of delivering an incomplete product union', async () => {
  const { service } = await createHarness({ omittedPromptIds: ['orange-box'] });

  await assert.rejects(
    () => service.removeBackground({ imageUrl: '/source.png' }),
    error => error.code === 'CANVAS_LAYER_INSTANCE_COVERAGE_INCOMPLETE',
  );
});

test('remove background unions every accepted product instead of returning one instance', async () => {
  const { service, persisted } = await createHarness();
  const result = await service.removeBackground({ imageUrl: '/source.png' });

  assert.equal(result.method, 'sam3');
  assert.equal(result.subjectCount, 3);
  assert.ok(result.url.startsWith('/api/generated-assets/'));
  assert.equal(persisted.length, 1);
  const asset = persisted.find(item => item.label === 'canvas_remove_bg_sam3');
  const metadata = await sharp(asset.buffer).metadata();
  assert.equal(metadata.width, 100);
  assert.equal(metadata.height, 51);
});

test('creates a signed-plan-ready analysis and consumes browser crop masks without a provider client', async () => {
  const source = await sourceFixture();
  const persisted = [];
  const generatedAssetStore = {
    async persistBuffer({ buffer, contentType, label }) {
      const id = `browser-asset-${persisted.length + 1}.png`;
      persisted.push({ id, buffer: Buffer.from(buffer), contentType, label });
      return { id, url: `/api/generated-assets/${id}`, contentType };
    },
  };
  const service = createCanvasLayeringService({
    visionClient: { async analyzeJson() { return semanticPlan(); } },
    generatedAssetStore,
    imageInputReader: {
      async read(url) {
        if (url === '/source.png') return { buffer: source, contentType: 'image/png' };
        throw new Error(`unknown fixture ${url}`);
      },
    },
    createBackgroundCleanPlate: async () => sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 4, background: { r: 246, g: 240, b: 228, alpha: 1 } },
    }).png().toBuffer(),
  });

  const analysis = await service.createSegmentationPlan({ imageUrl: '/source.png' });
  assert.deepEqual(analysis.source, { width: WIDTH, height: HEIGHT });
  assert.equal(analysis.prompts.length, 3);

  const segmentationMasks = await Promise.all(analysis.prompts.map(async prompt => {
    const rect = RECTS.find(item => item.id === prompt.id);
    const fullMask = await maskFixture(rect);
    const [left, top, right, bottom] = prompt.box;
    const buffer = await sharp(fullMask).extract({
      left,
      top,
      width: right - left,
      height: bottom - top,
    }).png().toBuffer();
    return { promptId: prompt.id, box: prompt.box, buffer };
  }));
  const result = await service.createLayers({
    imageUrl: '/source.png',
    segmentationPlan: analysis,
    segmentationMasks,
  });

  assert.equal(result.status, 'complete');
  assert.equal(result.capabilities.productInstances, 3);
  assert.equal(result.segmentation.method, 'u2netp-browser');
  assert.equal(result.layers.filter(layer => layer.semanticType === 'product-instance').length, 3);
  assert.equal(persisted.filter(asset => /canvas_layer_product/.test(asset.label)).length, 4);
});

test('rejects masks that are empty, nearly full-frame or duplicate an accepted instance', async () => {
  const empty = await sharp(Buffer.alloc(WIDTH * HEIGHT), { raw: { width: WIDTH, height: HEIGHT, channels: 1 } }).png().toBuffer();
  await assert.rejects(
    () => normalizeSegmentationMask(empty, { width: WIDTH, height: HEIGHT }),
    error => error.code === 'SEGMENTATION_MASK_EMPTY',
  );

  const full = await sharp(Buffer.alloc(WIDTH * HEIGHT, 255), { raw: { width: WIDTH, height: HEIGHT, channels: 1 } }).png().toBuffer();
  await assert.rejects(
    () => normalizeSegmentationMask(full, { width: WIDTH, height: HEIGHT }),
    error => error.code === 'SEGMENTATION_MASK_IMPLAUSIBLE',
  );
});
