import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';

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
