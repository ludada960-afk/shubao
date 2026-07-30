import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { createImageDelivery, imageVariantUrl } from '../server/imageDelivery.mjs';

test('imageVariantUrl requests a derivative without corrupting existing query parameters', () => {
  assert.equal(imageVariantUrl('/api/generated-assets/a.png', 'thumb'), '/api/generated-assets/a.png?variant=thumb');
  assert.equal(imageVariantUrl('/api/generated-assets/a.png?download=1', 'canvas'), '/api/generated-assets/a.png?download=1&variant=canvas');
  assert.equal(imageVariantUrl('/api/generated-assets/a.png', 'full'), '/api/generated-assets/a.png');
});

test('delivery creates a cached webp derivative for a generated asset', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  try {
    const id = 'a'.repeat(64) + '.png';
    await writeFile(join(root, id), await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#cc3344' },
    }).png().toBuffer());
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: join(root, 'proxy') });
    const first = await delivery.readGeneratedVariant(id, 'thumb');
    const second = await delivery.readGeneratedVariant(id, 'thumb');
    const metadata = await sharp(first.buffer).metadata();
    assert.equal(first.contentType, 'image/webp');
    assert.equal(metadata.format, 'webp');
    assert.ok(metadata.width <= 360);
    assert.deepEqual(second.buffer, first.buffer);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('delivery coalesces concurrent remote source fetches', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  let fetches = 0;
  try {
    const source = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: '#2255aa' },
    }).jpeg().toBuffer();
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      fetchImpl: async () => {
        fetches += 1;
        await new Promise(resolve => setTimeout(resolve, 8));
        return new Response(source, { headers: { 'content-type': 'image/jpeg' } });
      },
    });
    const [left, right] = await Promise.all([
      delivery.readProxyVariant('https://cdn.example.com/product.jpg', 'canvas'),
      delivery.readProxyVariant('https://cdn.example.com/product.jpg', 'canvas'),
    ]);
    assert.equal(fetches, 1);
    assert.equal(left.contentType, 'image/webp');
    assert.deepEqual(left.buffer, right.buffer);
    assert.equal((await sharp(left.buffer).metadata()).format, 'webp');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
