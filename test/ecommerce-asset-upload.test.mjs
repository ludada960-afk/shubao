import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';
import sharp from 'sharp';

import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import {
  createEcommerceAssetRouteHandlers,
  createEcommerceAssetUploadService,
} from '../server/ecommerceEngine/assetUpload.mjs';

async function fixture(format = 'png', { width = 96, height = 64, alpha = false } = {}) {
  const image = sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: alpha
        ? { r: 210, g: 40, b: 30, alpha: 0.5 }
        : { r: 210, g: 40, b: 30 },
    },
  });
  if (format === 'jpeg') return image.jpeg({ quality: 91, chromaSubsampling: '4:4:4' }).toBuffer();
  if (format === 'webp') return image.webp({ quality: 91 }).toBuffer();
  if (format === 'avif') return image.avif({ quality: 91 }).toBuffer();
  return image.png({ compressionLevel: 9 }).toBuffer();
}

async function harness(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-ecommerce-upload-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const db = new Database(':memory:');
  t.after(() => db.close());
  const generatedAssetStore = createGeneratedAssetStore({ directory });
  const service = createEcommerceAssetUploadService({
    db,
    generatedAssetStore,
    ...options,
  });
  return { db, directory, generatedAssetStore, service };
}

function responseHarness() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function assertPublicAsset(asset) {
  assert.match(asset.assetId, /^[a-f0-9]{64}\.(?:jpg|png|webp)$/);
  assert.equal(asset.url, `/api/generated-assets/${asset.assetId}`);
  assert.equal(Object.hasOwn(asset, 'fileName'), false);
  assert.equal(Object.hasOwn(asset, 'filePath'), false);
  assert.equal(Object.hasOwn(asset, 'path'), false);
}

test('preserves actual JPEG bytes, creates a separate preview, and replays idempotently', async (t) => {
  const { generatedAssetStore, service } = await harness(t);
  const originalBytes = await fixture('jpeg', { width: 1200, height: 800 });
  const input = {
    ownerEmail: 'Owner@Example.com',
    body: {
      role: 'product',
      data: `data:image/png;base64,${originalBytes.toString('base64')}`,
    },
  };

  const first = await service.upload(input);
  const second = await service.upload(input);

  assert.equal(first.original.mimeType, 'image/jpeg');
  assert.equal(first.original.format, 'jpeg');
  assert.equal(first.original.width, 1200);
  assert.equal(first.original.height, 800);
  assert.equal(first.original.byteSize, originalBytes.length);
  assert.equal(first.original.role, 'product');
  assertPublicAsset(first.original);
  assertPublicAsset(first.preview);
  assert.notEqual(first.preview.assetId, first.original.assetId);
  assert.equal(first.preview.kind, 'preview');
  assert.equal(first.preview.sourceAssetId, first.original.assetId);
  assert.equal(first.preview.mimeType, 'image/webp');
  assert.ok(first.preview.width <= 512);
  assert.ok(first.preview.height <= 512);
  assert.deepEqual(second, first);

  const storedOriginal = await generatedAssetStore.read(first.original.assetId);
  assert.deepEqual(storedOriginal.buffer, originalBytes);
  const storedPreview = await generatedAssetStore.read(first.preview.assetId);
  assert.notDeepEqual(storedPreview.buffer, originalBytes);
  assert.equal((await sharp(storedPreview.buffer).metadata()).format, 'webp');
});

test('detects actual PNG MIME for raw base64 and ignores a false client declaration', async (t) => {
  const { generatedAssetStore, service } = await harness(t);
  const png = await fixture('png');

  const result = await service.upload({
    ownerEmail: 'owner@example.com',
    body: {
      role: 'reference',
      data: png.toString('base64'),
      declaredMimeType: 'image/jpeg',
    },
  });

  assert.equal(result.original.mimeType, 'image/png');
  assert.equal(result.original.format, 'png');
  assert.match(result.original.assetId, /\.png$/);
  assert.deepEqual((await generatedAssetStore.read(result.original.assetId)).buffer, png);
});

test('accepts a bounded binary image without Base64 expansion and preserves idempotency', async (t) => {
  const { generatedAssetStore, service } = await harness(t);
  const png = await fixture('png', { width: 96, height: 64 });

  const first = await service.uploadBuffer({
    ownerEmail: 'owner@example.com',
    role: 'product',
    buffer: png,
  });
  const second = await service.uploadBuffer({
    ownerEmail: 'owner@example.com',
    role: 'product',
    buffer: Buffer.from(png),
  });

  assert.deepEqual(second, first);
  assert.equal(first.original.width, 96);
  assert.equal(first.original.height, 64);
  assert.equal(first.original.byteSize, png.length);
  assert.deepEqual((await generatedAssetStore.read(first.original.assetId)).buffer, png);
});

test('accepts semantic person and scene roles without changing the durable asset contract', async (t) => {
  const { service } = await harness(t);
  const png = await fixture('png');
  for (const role of ['person', 'scene']) {
    const result = await service.upload({
      ownerEmail: 'owner@example.com',
      body: { role, data: png.toString('base64') },
    });
    assert.equal(result.original.role, role);
    assert.equal(result.preview.role, role);
  }
});

test('normalizes decoded WebP and AVIF uploads to lossless PNG originals', async (t) => {
  const { generatedAssetStore, service } = await harness(t);
  for (const format of ['webp', 'avif']) {
    const source = await fixture(format, { width: 80, height: 60, alpha: true });
    const result = await service.upload({
      ownerEmail: 'owner@example.com',
      body: { role: 'reference', data: `data:image/jpeg;base64,${source.toString('base64')}` },
    });
    assert.equal(result.original.mimeType, 'image/png');
    assert.equal(result.original.format, 'png');
    assert.equal(result.original.sourceFormat, format);
    assert.equal(result.original.normalized, true);
    const stored = await generatedAssetStore.read(result.original.assetId);
    assert.equal((await sharp(stored.buffer).metadata()).format, 'png');
  }
});

test('rejects traversal, encoded traversal, inherited request data, and unknown request fields', async (t) => {
  const { service } = await harness(t);
  const png = await fixture('png');
  const data = `data:image/png;base64,${png.toString('base64')}`;

  for (const body of [
    { data, assetId: '../secret.png' },
    { data, assetId: '%2e%2e%2fsecret.png' },
    { data, path: 'C:\\private\\secret.png' },
    { data, internalStorageName: 'generated-assets/secret.png' },
  ]) {
    await assert.rejects(
      service.upload({ ownerEmail: 'owner@example.com', body }),
      error => error?.status === 400 && error?.code === 'ASSET_REQUEST_INVALID',
    );
  }

  const inherited = Object.create({ data });
  inherited.role = 'product';
  await assert.rejects(
    service.upload({ ownerEmail: 'owner@example.com', body: inherited }),
    error => error?.status === 400 && error?.code === 'ASSET_REQUEST_INVALID',
  );
});

test('rejects empty, malformed, unsupported, oversized, and unsafe decoded images', async (t) => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  const normal = await fixture('png', { width: 40, height: 40 });
  const { service } = await harness(t, {
    maxOriginalBytes: normal.length - 1,
    maxInputPixels: 1_000,
    maxDimension: 32,
  });

  for (const body of [
    { data: '' },
    { data: 'not-base64***' },
    { data: `data:image/jpeg;base64,${svg.toString('base64')}` },
    { data: `data:image/png;base64,${normal.toString('base64')}` },
  ]) {
    await assert.rejects(
      service.upload({ ownerEmail: 'owner@example.com', body }),
      error => [400, 413, 415, 422].includes(error?.status),
    );
  }
});

test('rejects dangerous dimensions through Sharp decode limits even when compressed bytes are small', async (t) => {
  const bomb = await fixture('png', { width: 64, height: 64 });
  const { service } = await harness(t, {
    maxOriginalBytes: 1024 * 1024,
    maxInputPixels: 1_000,
    maxDimension: 10_000,
  });

  await assert.rejects(
    service.upload({
      ownerEmail: 'owner@example.com',
      body: { data: bomb.toString('base64') },
    }),
    error => error?.status === 413 && error?.code === 'ASSET_DIMENSIONS_UNSAFE',
  );
});

test('keeps metadata reads owner-scoped and validates stable asset IDs', async (t) => {
  const { service } = await harness(t);
  const png = await fixture('png');
  const uploaded = await service.upload({
    ownerEmail: 'first@example.com',
    body: { data: png.toString('base64') },
  });

  const owned = await service.getOwnedAsset({
    ownerEmail: 'first@example.com',
    assetId: uploaded.original.assetId,
  });
  assert.equal(owned.assetId, uploaded.original.assetId);

  await assert.rejects(
    service.getOwnedAsset({
      ownerEmail: 'second@example.com',
      assetId: uploaded.original.assetId,
    }),
    error => error?.status === 403 && error?.code === 'ASSET_OWNER_MISMATCH',
  );
  for (const assetId of ['../secret.png', '%2e%2e%2fsecret.png', `${'A'.repeat(64)}.png`]) {
    await assert.rejects(
      service.getOwnedAsset({ ownerEmail: 'first@example.com', assetId }),
      error => error?.status === 400 && error?.code === 'ASSET_ID_INVALID',
    );
  }
});

test('thin upload handler passes only signed owner identity and maps structured errors', async (t) => {
  const calls = [];
  const handlers = createEcommerceAssetRouteHandlers({
    assetUploadService: {
      async upload(input) {
        calls.push(input);
        if (input.body?.data === 'bad') {
          throw Object.assign(new Error('invalid upload'), {
            status: 415,
            code: 'ASSET_FORMAT_UNSUPPORTED',
          });
        }
        return { original: { assetId: `${'a'.repeat(64)}.png` } };
      },
    },
  });
  const ok = responseHarness();

  await handlers.upload({ _userEmail: 'signed@example.com', body: { data: 'ok' } }, ok);

  assert.equal(ok.statusCode, 201);
  assert.deepEqual(calls[0], {
    ownerEmail: 'signed@example.com',
    body: { data: 'ok' },
  });
  const bad = responseHarness();
  await handlers.upload({ _userEmail: 'signed@example.com', body: { data: 'bad' } }, bad);
  assert.equal(bad.statusCode, 415);
  assert.deepEqual(bad.body, { error: 'invalid upload', code: 'ASSET_FORMAT_UNSUPPORTED' });
});

test('thin upload handler routes raw image bytes with a role header to the binary service', async () => {
  const calls = [];
  const handlers = createEcommerceAssetRouteHandlers({
    assetUploadService: {
      async upload() {
        throw new Error('JSON upload should not be used for a binary request');
      },
      async uploadBuffer(input) {
        calls.push(input);
        return { original: { assetId: `${'b'.repeat(64)}.png` } };
      },
    },
  });
  const response = responseHarness();
  const buffer = Buffer.from([137, 80, 78, 71]);

  await handlers.upload({
    _userEmail: 'signed@example.com',
    body: buffer,
    headers: { 'x-ecommerce-asset-role': 'reference' },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls, [{
    ownerEmail: 'signed@example.com',
    role: 'reference',
    buffer,
  }]);
});

test('production registers the upload endpoint behind the existing ecommerce authentication boundary', async () => {
  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(
    server,
    /app\.post\('\/api\/ecommerce\/assets',\s*authenticateEcommerceRequest,\s*ecommerceAssetBinaryBody,\s*ecommerceAssetRouteHandlers\.upload\)/,
  );
});
