import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildReferenceContactSheet } from '../server/referenceContactSheet.mjs';

async function swatch(color) {
  const data = await sharp({ create: { width: 24, height: 24, channels: 3, background: color } }).png().toBuffer();
  return `data:image/png;base64,${data.toString('base64')}`;
}

test('builds one bounded visual anchor from several product and style references', async () => {
  const sheet = await buildReferenceContactSheet([
    await swatch('#ff0000'), await swatch('#00ff00'), await swatch('#0000ff'),
  ], { maxImages: 3, cellSize: 80 });

  assert.match(sheet, /^data:image\/jpeg;base64,/);
  const meta = await sharp(Buffer.from(sheet.split(',')[1], 'base64')).metadata();
  assert.equal(meta.width, 160);
  assert.equal(meta.height, 160);
});

test('returns null when no usable image is supplied', async () => {
  assert.equal(await buildReferenceContactSheet([null, 'not-an-image']), null);
});
