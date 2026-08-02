import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createImageInputReader,
  imageBufferToDataUrl,
  imageBufferToVisionDataUrl,
} from '../server/imageInput.mjs';

const png = Buffer.from('89504e470d0a1a0a', 'hex');
const validPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('reads data URLs and preserves their media type', async () => {
  const reader = createImageInputReader({
    generatedAssetStore: { read: async () => null },
    tempUploadDir: 'C:/does-not-exist',
  });
  const result = await reader.read(`data:image/png;base64,${png.toString('base64')}`);
  assert.equal(result.contentType, 'image/png');
  assert.deepEqual(result.buffer, png);
  assert.equal(imageBufferToDataUrl(result), `data:image/png;base64,${png.toString('base64')}`);
});

test('reads a generated asset URL through the stable asset store', async () => {
  const assetId = `${'a'.repeat(64)}.png`;
  const reader = createImageInputReader({
    generatedAssetStore: { read: async id => id === assetId ? { buffer: png, contentType: 'image/png' } : null },
    tempUploadDir: 'C:/does-not-exist',
  });
  const result = await reader.read(`/api/generated-assets/${assetId}`);
  assert.deepEqual(result.buffer, png);
  assert.equal(result.contentType, 'image/png');
});

test('rejects traversal attempts for temporary uploads', async () => {
  const reader = createImageInputReader({
    generatedAssetStore: { read: async () => null },
    tempUploadDir: 'C:/tmp/shubao-uploads',
  });
  await assert.rejects(
    reader.read('/api/ec-temp-img/..%2Fsecret.png'),
    /图片地址无效|临时图片不存在|不支持的图片地址/
  );
});

test('creates a bounded, provider-compatible vision copy without changing the source helper', async () => {
  const result = await imageBufferToVisionDataUrl({ buffer: validPng, contentType: 'image/png' });
  assert.match(result, /^data:image\/jpeg;base64,/);
  assert.notEqual(result, imageBufferToDataUrl({ buffer: validPng, contentType: 'image/png' }));
});
