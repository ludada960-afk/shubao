import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as generatedAssets from '../server/generatedAssets.mjs';

const { createGeneratedAssetStore } = generatedAssets;

test('persists a generated image and returns a stable in-app URL', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createGeneratedAssetStore({
    directory: dir,
    fetchImpl: async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'content-type': 'image/png' },
    }),
  });

  const asset = await store.persist({
    sourceUrl: 'https://provider.example/generated.png',
    taskId: 'ec_test_1',
    label: 'main_1',
  });

  assert.match(asset.url, /^\/api\/generated-assets\/[a-f0-9]{64}\.png$/);
  assert.equal(await readFile(join(dir, asset.fileName)).then(buffer => buffer.length), 4);
});

test('notifies a post-persist derivative warmer without risking the stable asset', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const warmed = [];
  const store = createGeneratedAssetStore({
    directory: dir,
    onPersist: async asset => { warmed.push(asset.id); },
  });
  const asset = await store.persistBuffer({
    buffer: Buffer.from([137, 80, 78, 71]),
    contentType: 'image/png',
  });
  assert.deepEqual(warmed, [asset.id]);

  const resilient = createGeneratedAssetStore({
    directory: dir,
    onPersist: async () => { throw new Error('derivative cache unavailable'); },
  });
  await assert.doesNotReject(() => resilient.persistBuffer({
    buffer: Buffer.from([137, 80, 78, 71, 1]),
    contentType: 'image/png',
  }));
});

test('rejects a non-http generated image source without creating an asset', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = createGeneratedAssetStore({ directory: dir, fetchImpl: async () => { throw new Error('must not fetch'); } });

  await assert.rejects(() => store.persist({ sourceUrl: 'file:///tmp/secret.png', taskId: 'ec_test_2', label: 'main_1' }), /http/i);
  assert.deepEqual(await readdir(dir), []);
});

test('persists and reads the exact stable bytes in one quality-gate operation', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const expected = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4]);
  const store = createGeneratedAssetStore({
    directory: dir,
    fetchImpl: async () => new Response(expected, {
      headers: { 'content-type': 'image/png' },
    }),
  });

  const stable = await store.persistAndRead({
    sourceUrl: 'https://provider.example/generated-quality.png',
    taskId: 'ec_test_quality',
    label: 'main_quality',
  });

  assert.match(stable.asset.url, /^\/api\/generated-assets\/[a-f0-9]{64}\.png$/);
  assert.deepEqual(stable.buffer, expected);
  assert.equal(stable.contentType, 'image/png');
});

test('preserves a non-PNG stable image MIME when building the quality-analysis data URL', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const expected = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);
  const store = createGeneratedAssetStore({
    directory: dir,
    fetchImpl: async () => new Response(expected, {
      headers: { 'content-type': 'image/jpeg' },
    }),
  });
  const stable = await store.persistAndRead({
    sourceUrl: 'https://provider.example/generated-quality.jpg',
    taskId: 'ec_test_quality_jpeg',
    label: 'main_quality_jpeg',
  });

  assert.equal(typeof generatedAssets.stableAssetDataUrl, 'function');
  assert.match(generatedAssets.stableAssetDataUrl(stable), /^data:image\/jpeg;base64,/);
});

test('concurrent same-byte persistBuffer calls converge on one complete stable asset', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-race-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const expected = Buffer.alloc(1024 * 1024, 37);
  const store = createGeneratedAssetStore({ directory: dir });

  const assets = await Promise.all(Array.from({ length: 8 }, (_, index) => store.persistBuffer({
    buffer: expected,
    contentType: 'image/png',
    taskId: `race-${index}`,
    label: `race-${index}`,
  })));

  assert.equal(new Set(assets.map(asset => asset.id)).size, 1);
  assert.deepEqual(await readdir(dir), [assets[0].id]);
  assert.deepEqual(await readFile(join(dir, assets[0].id)), expected);
});

test('persistBuffer rejects a corrupt pre-existing content-addressed file without overwriting it', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-corrupt-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const expected = Buffer.from('expected stable bytes');
  const corrupt = Buffer.from('different existing bytes');
  const fileName = `${createHash('sha256').update(expected).digest('hex')}.png`;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), corrupt, { flag: 'wx' });
  const store = createGeneratedAssetStore({ directory: dir });

  await assert.rejects(
    () => store.persistBuffer({ buffer: expected, contentType: 'image/png' }),
    error => error?.code === 'GENERATED_ASSET_INTEGRITY_ERROR',
  );

  assert.deepEqual(await readFile(join(dir, fileName)), corrupt);
});

test('read returns null only for ENOENT and rethrows every non-missing I/O error', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-assets-read-errors-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const assetId = `${'a'.repeat(64)}.png`;
  const missingStore = createGeneratedAssetStore({
    directory: dir,
    readFileImpl: async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); },
  });

  assert.equal(await missingStore.read(assetId), null);

  for (const code of ['EIO', 'EMFILE', 'ENFILE', 'EBUSY', 'EACCES', 'EPERM', 'EUNKNOWN']) {
    const ioError = Object.assign(new Error(`read failed: ${code}`), { code });
    const store = createGeneratedAssetStore({
      directory: dir,
      readFileImpl: async () => { throw ioError; },
    });
    await assert.rejects(() => store.read(assetId), error => error === ioError);
  }
});
