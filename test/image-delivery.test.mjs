import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { createImageDelivery, imageVariantUrl, isSafeRemoteImageUrl } from '../server/imageDelivery.mjs';

test('imageVariantUrl requests a derivative without corrupting existing query parameters', () => {
  assert.equal(imageVariantUrl('/api/generated-assets/a.png', 'thumb'), '/api/generated-assets/a.png?variant=thumb&v=3');
  assert.equal(imageVariantUrl('/api/generated-assets/a.png?download=1', 'canvas'), '/api/generated-assets/a.png?download=1&variant=canvas&v=3');
  assert.equal(imageVariantUrl('/api/gallery-image?id=xm&file=cover.png', 'thumb'), '/api/gallery-image?id=xm&file=cover.png&variant=thumb&v=3');
  assert.equal(imageVariantUrl('/api/generated-assets/a.png', 'w960', 'avif'), '/api/generated-assets/a.png?variant=w960&format=avif&v=3');
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
    assert.ok(metadata.width <= 640);
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

test('delivery creates cached variants for a trusted local gallery image', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  try {
    const filePath = join(root, 'gallery-cover.png');
    await writeFile(filePath, await sharp({
      create: { width: 1600, height: 2200, channels: 3, background: '#f4a261' },
    }).png().toBuffer());
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: join(root, 'cache') });
    const first = await delivery.readLocalVariant(filePath, 'thumb');
    const second = await delivery.readLocalVariant(filePath, 'thumb');
    const metadata = await sharp(first.buffer).metadata();
    assert.equal(first.contentType, 'image/webp');
    assert.ok(metadata.width <= 640);
    assert.deepEqual(second.buffer, first.buffer);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('delivery can prewarm generated thumbnails before the first UI request', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  try {
    const id = 'b'.repeat(64) + '.png';
    await writeFile(join(root, id), await sharp({
      create: { width: 1400, height: 1000, channels: 3, background: '#264653' },
    }).png().toBuffer());
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: join(root, 'proxy') });
    await delivery.prewarmGeneratedVariants(id);
    await access(join(root, '.derivatives', `${id}.v3.w640.webp`));
    await access(join(root, '.derivatives', `${id}.v3.w640.avif`));
    await access(join(root, '.derivatives', `${id}.v3.w960.webp`));
    await access(join(root, '.derivatives', `${id}.v3.w960.avif`));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('delivery exposes sharp display candidates without replacing the original', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  try {
    const id = 'c'.repeat(64) + '.png';
    const original = await sharp({
      create: { width: 2200, height: 1600, channels: 3, background: '#f6f4ef' },
    }).png().toBuffer();
    await writeFile(join(root, id), original);
    const delivery = createImageDelivery({ assetRoot: root, proxyCacheRoot: join(root, 'proxy') });
    const avif = await delivery.readGeneratedVariant(id, 'w1600', 'avif');
    const full = await delivery.readGeneratedVariant(id, 'full');
    const metadata = await sharp(avif.buffer).metadata();
    assert.equal(avif.contentType, 'image/avif');
    assert.equal(metadata.width, 1600);
    assert.deepEqual(full.buffer, original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('delivery rejects a remote redirect into a private network', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shubao-image-delivery-'));
  try {
    const delivery = createImageDelivery({
      assetRoot: root,
      proxyCacheRoot: join(root, 'proxy'),
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/internal.png' } }),
    });
    await assert.rejects(
      () => delivery.readProxyVariant('https://cdn.example.com/product.jpg', 'thumb'),
      /invalid remote image URL/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('remote image URL guard blocks intranet targets and encoded-IP bypasses', () => {
  // 公网 CDN 正常放行
  assert.equal(isSafeRemoteImageUrl('https://cdn.example.com/product.png'), true);
  assert.equal(isSafeRemoteImageUrl('http://img.host.example/a.jpg'), true);
  // 回环 / 内网段 / 链路本地元数据
  assert.equal(isSafeRemoteImageUrl('http://localhost/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://127.0.0.1/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://10.1.2.3/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://192.168.1.10/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://172.16.0.9/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSafeRemoteImageUrl('http://100.64.0.1/a.png'), false);   // CGNAT
  assert.equal(isSafeRemoteImageUrl('http://0.0.0.0/a.png'), false);
  // IPv6：回环/未指定/唯一本地/链路本地 + IPv4-mapped 复检
  assert.equal(isSafeRemoteImageUrl('http://[::1]/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://[::]/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://[fd00::1]/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://[fe80::1]/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://[::ffff:127.0.0.1]/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://[::ffff:8.8.8.8]/a.png'), true);
  // 编码绕过：十六进制 / 整数 / 前导零八进制 / 非 4 段数字主机
  assert.equal(isSafeRemoteImageUrl('http://0x7f000001/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://2130706433/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://0177.0.0.1/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('http://127.1/a.png'), false);
  // 凭据与畸形 host
  assert.equal(isSafeRemoteImageUrl('https://user:pass@cdn.example.com/a.png'), false);
  assert.equal(isSafeRemoteImageUrl('file:///etc/passwd'), false);
  assert.equal(isSafeRemoteImageUrl('not a url'), false);
});
