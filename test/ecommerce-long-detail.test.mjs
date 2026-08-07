import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { composeLongDetail } from '../server/ecommerceEngine/longDetailComposer.mjs';

async function solid(width, height, background) {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}

test('long detail composition preserves order, common width, and exact seam-free height', async () => {
  const red = await solid(20, 10, { r: 255, g: 0, b: 0 });
  const blue = await solid(20, 10, { r: 0, g: 0, b: 255 });
  const result = await composeLongDetail([red, blue], { width: 40, format: 'png' });

  assert.equal(result.width, 40);
  assert.equal(result.height, 40);
  assert.equal(result.count, 2);
  assert.equal(result.format, 'png');

  const raw = await sharp(result.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [...raw.data.subarray((y * raw.info.width + x) * raw.info.channels, (y * raw.info.width + x) * raw.info.channels + 3)];
  assert.deepEqual(pixel(20, 19), [255, 0, 0]);
  assert.deepEqual(pixel(20, 20), [0, 0, 255]);
});
test('long detail composition supports real JPEG output and rejects unsafe height', async () => {
  const image = await solid(20, 20, { r: 255, g: 255, b: 255 });
  const jpeg = await composeLongDetail([image, image], { width: 20, format: 'jpg' });
  assert.equal((await sharp(jpeg.buffer).metadata()).format, 'jpeg');
  await assert.rejects(() => composeLongDetail([image, image], { width: 100, maxHeight: 100 }), /过高/);
});
