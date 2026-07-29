import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import { createImageInputReader } from '../server/imageInput.mjs';
import { createLegacyVisualAssetMigration } from '../server/ecommerceEngine/legacyVisualAssetMigration.mjs';

const OWNER = '867550189@qq.com';
const PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

async function createHarness(t) {
  const directory = await mkdtemp(join(tmpdir(), 'legacy-visual-migration-'));
  const generatedDirectory = join(directory, 'generated');
  const tempDirectory = join(directory, 'temp');
  await mkdir(tempDirectory, { recursive: true });
  let remoteFetches = 0;
  const generatedAssetStore = createGeneratedAssetStore({ directory: generatedDirectory });
  const imageInputReader = createImageInputReader({
    generatedAssetStore,
    tempUploadDir: tempDirectory,
    fetchImpl: async () => {
      remoteFetches += 1;
      throw new Error('network must not be used');
    },
  });
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    generatedDirectory,
    tempDirectory,
    generatedAssetStore,
    imageInputReader,
    remoteFetchCount: () => remoteFetches,
  };
}

test('migrates trusted local legacy bytes to one stable content-addressed asset', async t => {
  const harness = await createHarness(t);
  await writeFile(join(harness.tempDirectory, 'legacy-product.png'), PNG_BYTES);
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: harness.imageInputReader,
    generatedAssetStore: harness.generatedAssetStore,
  });
  const request = {
    source: '/api/ec-temp-img/legacy-product.png',
    type: 'product',
    index: 0,
    job: { id: 'job-legacy-local', ownerEmail: OWNER },
  };

  const first = await migrate(request);
  const replay = await migrate(request);

  const hash = createHash('sha256').update(PNG_BYTES).digest('hex');
  assert.deepEqual(first, {
    assetId: `${hash}.png`,
    url: `/api/generated-assets/${hash}.png`,
  });
  assert.deepEqual(replay, first);
  assert.deepEqual(await readdir(harness.generatedDirectory), [`${hash}.png`]);
  assert.deepEqual((await harness.generatedAssetStore.read(first.assetId)).buffer, PNG_BYTES);
  assert.equal(harness.remoteFetchCount(), 0);
});

test('rejects missing, unreadable, remote, and untrusted legacy sources without persistence', async t => {
  const invalidSources = [
    { label: 'missing source', source: '' },
    { label: 'unreadable local source', source: '/api/ec-temp-img/missing.png' },
    { label: 'arbitrary remote source', source: 'https://untrusted.example/product.png' },
    { label: 'unsupported local source', source: '/api/private/product.png' },
  ];

  for (const current of invalidSources) {
    await t.test(current.label, async t => {
      const harness = await createHarness(t);
      const migrate = createLegacyVisualAssetMigration({
        imageInputReader: harness.imageInputReader,
        generatedAssetStore: harness.generatedAssetStore,
      });

      await assert.rejects(
        () => migrate({
          source: current.source,
          type: 'reference',
          index: 0,
          job: { id: 'job-legacy-invalid', ownerEmail: OWNER },
        }),
        error => error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT'
          && error?.status === 400
          && error?.retryable === false,
      );

      assert.deepEqual(await readdir(harness.generatedDirectory).catch(() => []), []);
      assert.equal(harness.remoteFetchCount(), 0);
    });
  }
});
