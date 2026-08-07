import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { composeAndPersistLongDetail, composeLongDetail } from '../server/ecommerceEngine/longDetailComposer.mjs';

async function solid(width, height, color) {
  return sharp({ create: { width, height, channels: 4, background: color } }).png().toBuffer();
}

test('long detail composition produces a decodable non-empty image', async () => {
  const output = await composeLongDetail([
    await solid(200, 300, '#ff0000'),
    await solid(400, 200, '#00ff00'),
  ], { width: 400, format: 'png' });
  const metadata = await sharp(output.buffer).metadata();
  assert.equal(output.width, 400);
  assert.equal(output.height, 800);
  assert.equal(output.byteSize, output.buffer.length);
  assert.equal(output.contentType, 'image/png');
  assert.equal(metadata.width, output.width);
  assert.equal(metadata.height, output.height);
});

test('long detail output is persisted through durable generated asset storage with ordered provenance', async () => {
  const sourceBuffers = new Map([
    ['/a.png', await solid(100, 100, '#111111')],
    ['/b.png', await solid(100, 200, '#222222')],
  ]);
  const reads = [];
  let durableReads = 0;
  let persisted;
  const result = await composeAndPersistLongDetail({
    imageUrls: ['/a.png', '/b.png'],
    sourceIds: ['a', 'b'],
    format: 'jpg',
    width: 200,
  }, {
    imageInputReader: {
      async read(url) {
        reads.push(url);
        return { buffer: sourceBuffers.get(url), contentType: 'image/png' };
      },
    },
    generatedAssetStore: {
      async persistBuffer(input) {
        persisted = input;
        return { id: 'stable.jpg', url: '/api/generated-assets/stable.jpg', contentType: input.contentType };
      },
      async read(id) {
        durableReads += 1;
        assert.equal(id, 'stable.jpg');
        return { buffer: persisted.buffer, contentType: persisted.contentType };
      },
    },
  });

  assert.deepEqual(reads, ['/a.png', '/b.png']);
  assert.deepEqual(result.sourceIds, ['a', 'b']);
  assert.equal(result.url, '/api/generated-assets/stable.jpg');
  assert.equal(result.contentType, 'image/jpeg');
  assert.equal(result.byteSize, persisted.buffer.length);
  assert.equal(result.width, 200);
  assert.equal(result.height, 600);
  assert.equal(persisted.label, 'ecommerce_long_detail');
  assert.equal(durableReads, 1);
});

test('long detail defaults to the first source width without enlarging smaller sources', async () => {
  const result = await composeLongDetail([
    await solid(1152, 2048, '#ffffff'),
    await solid(900, 1200, '#eeeeee'),
  ], { format: 'jpg' });
  assert.equal(result.width, 1152);
  assert.equal(result.height, 3248);
});

test('long detail persistence rejects invalid sources before creating an asset', async () => {
  let persisted = false;
  await assert.rejects(composeAndPersistLongDetail({
    imageUrls: ['/valid.png', '/empty.png'],
    sourceIds: ['valid', 'empty'],
  }, {
    imageInputReader: {
      async read(url) {
        return { buffer: url.includes('empty') ? Buffer.alloc(0) : await solid(10, 10, '#fff') };
      },
    },
    generatedAssetStore: {
      async persistBuffer() { persisted = true; },
      async read() { throw new Error('must not read'); },
    },
  }), /第 2 张详情图为空/);
  assert.equal(persisted, false);
});
