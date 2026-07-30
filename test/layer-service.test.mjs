import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';

import {
  analyzeScene,
  createPixelLayers,
  layerCapabilities,
} from '../server/composition/layerService.mjs';

function createMemoryAssetStore(seed = {}) {
  const assets = new Map(Object.entries(seed));
  const persisted = [];
  return {
    persisted,
    async persistBuffer({ buffer, contentType, taskId, label }) {
      assert.ok(Buffer.isBuffer(buffer));
      const ext = contentType === 'image/png' ? '.png' : '';
      const id = `${crypto.createHash('sha256').update(buffer).digest('hex')}${ext}`;
      assets.set(id, { buffer: Buffer.from(buffer), contentType });
      persisted.push({ id, buffer: Buffer.from(buffer), contentType, taskId, label });
      return { id, url: `/api/generated-assets/${id}`, contentType, taskId, label };
    },
    async read(assetId) {
      const asset = assets.get(assetId);
      return asset ? { buffer: Buffer.from(asset.buffer), contentType: asset.contentType } : null;
    },
  };
}

test('semantic scene analysis cannot claim editable pixel layers', async () => {
  const result = await analyzeScene({
    width: 800,
    height: 600,
    layers: [
      { name: '商品主体', description: '瓶身区域' },
      { name: '背景', description: '浅色台面' },
    ],
  });

  assert.deepEqual(result.capabilities, {
    semanticAnalysis: true,
    pixelLayers: false,
    psdExport: false,
  });
  assert.deepEqual(result.layers.map(layer => layer.name), ['商品主体', '背景']);
  assert.equal(result.layers.some(layer => layer.assetId || layer.maskAssetId), false);
  assert.deepEqual(layerCapabilities(result), {
    semanticAnalysis: true,
    pixelLayers: false,
    psdExport: false,
  });
});

test('pixel layer creation persists transparent bitmaps and masks before enabling PSD export', async () => {
  const product = await sharp({
    create: { width: 40, height: 30, channels: 4, background: '#cc3344' },
  }).png().toBuffer();
  const generatedAssetStore = createMemoryAssetStore({
    'product.png': { buffer: product, contentType: 'image/png' },
  });
  const document = {
    id: 'document-1',
    revision: 2,
    width: 100,
    height: 80,
    layers: [
      {
        id: 'product',
        name: '商品',
        kind: 'image',
        assetId: 'product.png',
        x: 10,
        y: 20,
        width: 40,
        height: 30,
      },
      {
        id: 'title',
        name: '标题',
        kind: 'text',
        text: '轻盈保湿',
        fontId: 'fallback-sans',
        fontSize: 18,
        color: '#111111',
        width: 80,
        x: 10,
        y: 8,
      },
    ],
  };

  const layered = await createPixelLayers({ document, generatedAssetStore });
  const productLayer = layered.layers.find(layer => layer.id === 'product');

  assert.deepEqual(layered.capabilities, {
    semanticAnalysis: true,
    pixelLayers: true,
    psdExport: true,
  });
  assert.notEqual(productLayer.assetId, 'product.png');
  assert.equal(productLayer.sourceAssetId, 'product.png');
  assert.match(productLayer.maskAssetId, /\.png$/);
  assert.deepEqual(generatedAssetStore.persisted.map(asset => asset.label), [
    'composition_pixel_layer_product',
    'composition_pixel_mask_product',
  ]);
  const layerAsset = await generatedAssetStore.read(productLayer.assetId);
  const maskAsset = await generatedAssetStore.read(productLayer.maskAssetId);
  assert.equal((await sharp(layerAsset.buffer).metadata()).width, 100);
  assert.equal((await sharp(layerAsset.buffer).metadata()).height, 80);
  assert.equal((await sharp(maskAsset.buffer).metadata()).width, 100);
  assert.equal((await sharp(maskAsset.buffer).metadata()).height, 80);
});
