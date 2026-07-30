import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';

import {
  exportPsd,
  validatePsdStructure,
} from '../server/composition/psdExporter.mjs';

function createMemoryAssetStore(seed = {}) {
  const assets = new Map(Object.entries(seed));
  return {
    async persistBuffer({ buffer, contentType, label }) {
      const id = `${crypto.createHash('sha256').update(buffer).digest('hex')}.png`;
      assets.set(id, { buffer: Buffer.from(buffer), contentType, label });
      return { id, url: `/api/generated-assets/${id}`, contentType, label };
    },
    async read(assetId) {
      const asset = assets.get(assetId);
      return asset ? { buffer: Buffer.from(asset.buffer), contentType: asset.contentType } : null;
    },
  };
}

test('PSD export contains separate bitmap and text layers', async () => {
  const background = await sharp({
    create: { width: 120, height: 90, channels: 4, background: '#f4f1ea' },
  }).png().toBuffer();
  const product = await sharp({
    create: { width: 120, height: 90, channels: 4, background: '#00000000' },
  }).composite([{
    input: await sharp({
      create: { width: 44, height: 36, channels: 4, background: '#cc3344' },
    }).png().toBuffer(),
    left: 38,
    top: 38,
  }]).png().toBuffer();
  const mask = await sharp({
    create: { width: 120, height: 90, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const generatedAssetStore = createMemoryAssetStore({
    'background-layer.png': { buffer: background, contentType: 'image/png' },
    'background-mask.png': { buffer: mask, contentType: 'image/png' },
    'product-layer.png': { buffer: product, contentType: 'image/png' },
    'product-mask.png': { buffer: mask, contentType: 'image/png' },
  });
  const document = {
    id: 'document-1',
    width: 120,
    height: 90,
    layers: [
      { id: 'background', name: '背景', kind: 'image', assetId: 'background-layer.png', maskAssetId: 'background-mask.png' },
      { id: 'product', name: '商品', kind: 'image', assetId: 'product-layer.png', maskAssetId: 'product-mask.png' },
      {
        id: 'title',
        name: '标题',
        kind: 'text',
        text: '轻盈保湿',
        fontId: 'fallback-sans',
        fontSize: 16,
        color: '#111111',
        width: 100,
        x: 10,
        y: 10,
      },
    ],
  };

  const buffer = await exportPsd({ document, generatedAssetStore });
  const structure = validatePsdStructure(buffer);

  assert.ok(Buffer.isBuffer(buffer));
  assert.deepEqual(structure.layerNames, ['背景', '商品', '标题']);
  assert.equal(structure.layerCount, 3);
  assert.equal(structure.flattened, false);
  assert.equal(structure.pixelLayers, true);
});

test('PSD validation rejects flattened or single-layer output', async () => {
  const background = await sharp({
    create: { width: 32, height: 32, channels: 4, background: '#ffffff' },
  }).png().toBuffer();
  const generatedAssetStore = createMemoryAssetStore({
    'background-layer.png': { buffer: background, contentType: 'image/png' },
    'background-mask.png': { buffer: background, contentType: 'image/png' },
  });

  await assert.rejects(
    () => exportPsd({
      document: {
        id: 'flat-document',
        width: 32,
        height: 32,
        layers: [
          { id: 'background', name: '背景', kind: 'image', assetId: 'background-layer.png', maskAssetId: 'background-mask.png' },
        ],
      },
      generatedAssetStore,
    }),
    /PSD export requires verified pixel layers/,
  );
});
