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
const OTHER_OWNER = 'other@example.com';
const PNG_BYTES = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

function preUpgradeJob({ id, ownerEmail = OWNER, source, type = 'product' }) {
  const alias = type === 'product' ? 'real_shots' : 'reference_images';
  return {
    id,
    ownerEmail,
    visualInputSchemaVersion: null,
    payload: { [alias]: [source] },
  };
}

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
  const source = '/api/ec-temp-img/legacy-product.png';
  await writeFile(join(harness.tempDirectory, 'legacy-product.png'), PNG_BYTES);
  const job = preUpgradeJob({ id: 'job-legacy-local', source });
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: harness.imageInputReader,
    generatedAssetStore: harness.generatedAssetStore,
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async () => { throw new Error('temp migration must not use generated asset lookup'); },
  });
  const request = {
    source,
    type: 'product',
    index: 0,
    jobId: job.id,
  };

  const [first, replay] = await Promise.all([migrate(request), migrate(request)]);

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
      const job = preUpgradeJob({
        id: `job-legacy-invalid-${current.label.replace(/\s+/g, '-')}`,
        source: current.source,
        type: 'reference',
      });
      const migrate = createLegacyVisualAssetMigration({
        imageInputReader: harness.imageInputReader,
        generatedAssetStore: harness.generatedAssetStore,
        getJob: id => id === job.id ? job : null,
        getOwnedAsset: async () => { throw new Error('invalid source must not use owner lookup'); },
      });

      await assert.rejects(
        () => migrate({
          source: current.source,
          type: 'reference',
          index: 0,
          jobId: job.id,
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

test('binds a frozen generated source to the stored owner and rejects caller substitution', async t => {
  const harness = await createHarness(t);
  const assetId = `${'a'.repeat(64)}.png`;
  const source = `/api/generated-assets/${assetId}`;
  const job = preUpgradeJob({ id: 'job-owner-bound-legacy', source });
  const ownedLookups = [];
  let reads = 0;
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: {
      async read() {
        reads += 1;
        return { buffer: PNG_BYTES, contentType: 'image/png' };
      },
    },
    generatedAssetStore: harness.generatedAssetStore,
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async input => {
      ownedLookups.push(input);
      throw Object.assign(new Error('owner mismatch'), {
        code: 'ASSET_OWNER_MISMATCH',
        status: 403,
      });
    },
  });

  await assert.rejects(
    () => migrate({
      source,
      type: 'product',
      index: 0,
      jobId: job.id,
      ownerEmail: OTHER_OWNER,
    }),
    error => error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT'
      && error?.retryable === false,
  );

  assert.deepEqual(ownedLookups, [{ ownerEmail: OWNER, assetId }]);
  assert.equal(reads, 0);
  assert.deepEqual(await readdir(harness.generatedDirectory).catch(() => []), []);
});

test('rejects a legacy source that is not the frozen job payload capability', async t => {
  const harness = await createHarness(t);
  const frozenSource = '/api/ec-temp-img/frozen-product.png';
  const job = preUpgradeJob({ id: 'job-frozen-source', source: frozenSource });
  let reads = 0;
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: { async read() { reads += 1; return { buffer: PNG_BYTES, contentType: 'image/png' }; } },
    generatedAssetStore: harness.generatedAssetStore,
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async () => { throw new Error('temp migration must not use owner lookup'); },
  });

  await assert.rejects(
    () => migrate({
      source: '/api/ec-temp-img/substituted-product.png',
      type: 'product',
      index: 0,
      jobId: job.id,
    }),
    error => error?.code === 'VISUAL_ANALYSIS_INVALID_INPUT'
      && error?.retryable === false,
  );

  assert.equal(reads, 0);
});

test('maps stable persistence failures to retryable visual analysis unavailability', async t => {
  const harness = await createHarness(t);
  const source = '/api/ec-temp-img/storage-failure.png';
  await writeFile(join(harness.tempDirectory, 'storage-failure.png'), PNG_BYTES);
  const job = preUpgradeJob({ id: 'job-legacy-storage-failure', source });
  const storageError = Object.assign(new Error('disk temporarily unavailable'), { code: 'EIO' });
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: harness.imageInputReader,
    generatedAssetStore: { async persistBuffer() { throw storageError; } },
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async () => { throw new Error('temp migration must not use owner lookup'); },
  });

  await assert.rejects(
    () => migrate({ source, type: 'product', index: 0, jobId: job.id }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && error?.cause === storageError,
  );
});

test('maps a temp source EIO read to retryable visual analysis unavailability', async t => {
  const harness = await createHarness(t);
  const source = '/api/ec-temp-img/read-eio.png';
  const job = preUpgradeJob({ id: 'job-temp-read-eio', source });
  const readError = Object.assign(new Error('temp storage read failed'), { code: 'EIO' });
  let persistCalls = 0;
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader: { async read() { throw readError; } },
    generatedAssetStore: {
      async persistBuffer() {
        persistCalls += 1;
        throw new Error('must not persist after read failure');
      },
    },
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async () => { throw new Error('temp migration must not use owner lookup'); },
  });

  await assert.rejects(
    () => migrate({ source, type: 'product', index: 0, jobId: job.id }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && error?.cause === readError,
  );
  assert.equal(persistCalls, 0);
});

test('maps an owner-validated generated source EIO read to retryable unavailability', async t => {
  const harness = await createHarness(t);
  const assetId = `${'b'.repeat(64)}.png`;
  const source = `/api/generated-assets/${assetId}`;
  const job = preUpgradeJob({ id: 'job-generated-read-eio', source });
  const readError = Object.assign(new Error('generated storage read failed'), { code: 'EIO' });
  const generatedAssetStore = createGeneratedAssetStore({
    directory: harness.generatedDirectory,
    readFileImpl: async () => { throw readError; },
  });
  const imageInputReader = createImageInputReader({
    generatedAssetStore,
    tempUploadDir: harness.tempDirectory,
    fetchImpl: async () => { throw new Error('network must not be used'); },
  });
  const migrate = createLegacyVisualAssetMigration({
    imageInputReader,
    generatedAssetStore,
    getJob: id => id === job.id ? job : null,
    getOwnedAsset: async input => ({ ...input, url: source }),
  });

  await assert.rejects(
    () => migrate({ source, type: 'product', index: 0, jobId: job.id }),
    error => error?.code === 'VISUAL_ANALYSIS_UNAVAILABLE'
      && error?.status === 503
      && error?.retryable === true
      && error?.cause === readError,
  );
  assert.deepEqual(await readdir(harness.generatedDirectory).catch(() => []), []);
});
