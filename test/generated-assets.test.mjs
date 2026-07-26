import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
