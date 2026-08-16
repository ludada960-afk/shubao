import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVideoGeneration, videoFeatureSku } from '../server/videoGeneration.mjs';
import { VIDEO_CATALOG_VERSION } from '../server/videoCatalog.mjs';

test('video pricing tier is derived server-side from delivery resolution and duration', () => {
  assert.equal(videoFeatureSku({ productId: 'seedance_standard', duration: 4 }), 'video_seedance_standard_short');
  assert.equal(videoFeatureSku({ productId: 'seedance_standard', duration: 15 }), 'video_seedance_standard_long');
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 8 }), 'video_seedance_fast_short');
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 9 }), 'video_seedance_fast_long');
});

function createVideoGenerationHarness(t, overrides = {}) {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-test-'));
  t.after(() => {
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });
  return createVideoGeneration({
    db,
    walletService: {
      createHold(input) {
        return { id: `hold-${input.metadata?.taskId || 'test'}`, status: 'held' };
      },
      getBalance() {
        return { unlimited: false, availableUnits: 9999 };
      },
      settleItem() {
        return { status: 'settled' };
      },
      releaseItem() {
        return { status: 'released' };
      },
    },
    quoteService: {
      verify({ quoteId, ownerEmail, expectedQuote }) {
        return { quoteId, ownerEmail, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' };
      },
    },
    upsertWork() {},
    assetRoot,
    apiKey: 'test-key',
    fetchImpl: async () => {
      throw new Error('fetch should not be called in validation tests');
    },
    maxConcurrent: 0,
    assetSigningSecret: 'test-video-asset-signing-secret',
    ...overrides,
  });
}

async function uploadReferenceAsset(service, ownerEmail, kind) {
  const content = {
    image: { contentType: 'image/png', buffer: Buffer.from('image-data') },
    video: { contentType: 'video/mp4', buffer: Buffer.from('video-data') },
    audio: { contentType: 'audio/mpeg', buffer: Buffer.from('audio-data') },
  }[kind];
  return service.uploadAsset({ ownerEmail, kind, publicBaseUrl: 'https://example.com', ...content });
}

test('direct video asset uploads return the persisted checksum used by project assets', async t => {
  const service = createVideoGenerationHarness(t);
  const asset = await uploadReferenceAsset(service, 'owner@example.com', 'image');
  const stored = await service.readAsset(asset.id, 'owner@example.com');

  assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  assert.equal(asset.sha256, stored.row.sha256);
});

test('reference mode accepts a video-only reference job', async t => {
  const service = createVideoGenerationHarness(t);
  const ownerEmail = 'owner@example.com';
  const video = await uploadReferenceAsset(service, ownerEmail, 'video');

  const result = await service.createJob({
    ownerEmail,
    idempotencyKey: 'video-only-reference',
    billingQuoteId: 'quote-video-only',
    publicBaseUrl: 'https://example.com',
    input: {
      mode: 'reference',
      prompt: '保留节奏，参考这段视频',
      duration: 8,
      aspectRatio: '9:16',
      resolution: '720p',
      references: { videos: [video.id] },
    },
  });

  assert.equal(result.replay, false);
  assert.equal(result.job.mode, 'reference');
  assert.deepEqual(result.job.references.videos, [video.id]);
  assert.deepEqual(result.job.references.images, []);
  assert.deepEqual(result.job.references.audios, []);
});

test('reference mode rejects an audio-only reference job before billing', async t => {
  const service = createVideoGenerationHarness(t);
  const ownerEmail = 'owner@example.com';
  const audio = await uploadReferenceAsset(service, ownerEmail, 'audio');

  await assert.rejects(
    service.createJob({
      ownerEmail,
      idempotencyKey: 'audio-only-reference',
      billingQuoteId: 'quote-audio-only',
      publicBaseUrl: 'https://example.com',
      input: {
        mode: 'reference',
        prompt: '根据这段音频生成广告视频',
        duration: 8,
        aspectRatio: '9:16',
        resolution: '720p',
        references: { audios: [audio.id] },
      },
    }),
    error => error?.code === 'VIDEO_VISUAL_REFERENCE_REQUIRED',
  );
});

test('reference mode rejects an empty reference job', async t => {
  const service = createVideoGenerationHarness(t);

  await assert.rejects(
    service.createJob({
      ownerEmail: 'owner@example.com',
      idempotencyKey: 'empty-reference',
      billingQuoteId: 'quote-empty-reference',
      publicBaseUrl: 'https://example.com',
      input: {
        mode: 'reference',
        prompt: '没有参考素材',
        duration: 8,
        aspectRatio: '9:16',
        resolution: '720p',
        references: {},
      },
    }),
    error => error?.code === 'VIDEO_VISUAL_REFERENCE_REQUIRED',
  );
});

test('new jobs persist the product, route, catalog version, and provider-cost snapshot', async t => {
  const service = createVideoGenerationHarness(t);
  const result = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'snapshot-job',
    billingQuoteId: 'quote-snapshot',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '固定价格快照测试',
      duration: 8,
      aspectRatio: '9:16',
      resolution: '720p',
    },
  });
  assert.equal(result.job.productId, 'seedance_standard');
  assert.equal(result.job.providerRoute, 'sd5-seedance-2.0');
  assert.equal(result.job.catalogVersion, VIDEO_CATALOG_VERSION);
  assert.equal(result.job.providerCostCny, 3.64);
});

test('an owned editable workbench project is validated before billing and receives the new job', async t => {
  const calls = [];
  let holds = 0;
  const projectBridge = {
    validateTarget(input) {
      calls.push(['validate', input]);
      return { id: input.projectId, kind: 'video', status: 'draft' };
    },
    ensureDraft(job, options) {
      calls.push(['draft', { jobId: job.id, ...options }]);
      return { project: { id: options.projectId }, sourceVersion: { id: 'source-version' } };
    },
  };
  const service = createVideoGenerationHarness(t, {
    projectBridge,
    walletService: {
      createHold(input) { holds += 1; return { id: `hold-${input.metadata.taskId}`, status: 'held' }; },
      getBalance() { return { unlimited: false, availableUnits: 9999 }; },
      settleItem() { return { status: 'settled' }; },
      releaseItem() { return { status: 'released' }; },
    },
  });

  const result = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'target-project-job',
    billingQuoteId: 'quote-target-project',
    publicBaseUrl: 'https://example.com',
    input: {
      projectId: 'video-project-1', productId: 'seedance_standard', mode: 'script',
      prompt: '加入既有项目的开场镜头', duration: 8, aspectRatio: '16:9', resolution: '720p',
    },
  });

  assert.equal(holds, 1);
  assert.equal(result.job.projectId, 'video-project-1');
  assert.deepEqual(calls.map(call => call[0]), ['validate', 'draft']);
  assert.equal(calls[0][1].projectId, 'video-project-1');
  assert.equal(calls[1][1].projectId, 'video-project-1');
});

test('an invalid workbench target is rejected before wallet hold creation', async t => {
  let holds = 0;
  const service = createVideoGenerationHarness(t, {
    projectBridge: {
      validateTarget() { throw Object.assign(new Error('missing'), { code: 'PROJECT_NOT_FOUND' }); },
      ensureDraft() { throw new Error('draft must not be created'); },
    },
    walletService: {
      createHold() { holds += 1; return { id: 'unexpected-hold' }; },
      getBalance() { return { unlimited: false, availableUnits: 9999 }; },
      settleItem() { return { status: 'settled' }; },
      releaseItem() { return { status: 'released' }; },
    },
  });

  await assert.rejects(service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'invalid-target-project-job',
    billingQuoteId: 'quote-invalid-target-project',
    publicBaseUrl: 'https://example.com',
    input: {
      projectId: 'missing-project', productId: 'seedance_standard', mode: 'script',
      prompt: '不会产生扣费', duration: 8, aspectRatio: '16:9', resolution: '720p',
    },
  }), error => error?.status === 404 && error?.code === 'PROJECT_NOT_FOUND');
  assert.equal(holds, 0);
});

test('video assets can only be read by their normalized owner', async t => {
  const service = createVideoGenerationHarness(t);
  const asset = await uploadReferenceAsset(service, 'Owner@Example.com', 'image');

  const owned = await service.readAsset(asset.id, ' owner@example.com ');
  assert.equal(owned?.row.id, asset.id);
  assert.equal(owned?.row.owner_email, 'owner@example.com');
  assert.equal(await service.readAsset(asset.id, 'other@example.com'), null);
  assert.equal(await service.readAsset(asset.id, ''), null);
});

test('video asset URLs are purpose-bound expiring capabilities', async t => {
  const service = createVideoGenerationHarness(t);
  const asset = await uploadReferenceAsset(service, 'owner@example.com', 'video');
  const accessUrl = new URL(asset.url);

  assert.equal(accessUrl.pathname, `/api/video/media/${asset.id}`);
  const accessed = await service.readSignedAsset({
    id: asset.id,
    purpose: accessUrl.searchParams.get('purpose'),
    expires: accessUrl.searchParams.get('expires'),
    signature: accessUrl.searchParams.get('signature'),
  });
  assert.equal(accessed?.row.id, asset.id);
  assert.equal(await service.readSignedAsset({
    id: asset.id,
    purpose: 'provider',
    expires: accessUrl.searchParams.get('expires'),
    signature: accessUrl.searchParams.get('signature'),
  }), null);
  assert.equal(await service.readSignedAsset({
    id: asset.id,
    purpose: accessUrl.searchParams.get('purpose'),
    expires: '1',
    signature: accessUrl.searchParams.get('signature'),
  }), null);
  assert.equal(await service.readSignedAsset({
    id: asset.id,
    purpose: accessUrl.searchParams.get('purpose'),
    expires: accessUrl.searchParams.get('expires'),
    signature: `${accessUrl.searchParams.get('signature')}tampered`,
  }), null);
});

test('stored video result URLs can be reminted for owned work playback', async t => {
  const service = createVideoGenerationHarness(t);
  const asset = await uploadReferenceAsset(service, 'owner@example.com', 'video');

  const playbackUrl = new URL(service.playbackUrlForAsset(asset.id, 'owner@example.com', 'https://example.com'));
  assert.equal(playbackUrl.pathname, `/api/video/media/${asset.id}`);
  assert.equal(playbackUrl.searchParams.get('purpose'), 'playback');
  assert.equal(service.playbackUrlForAsset(asset.id, 'other@example.com'), '');
});

test('an accepted upstream task is never submitted again after retryable polling failures', async t => {
  const db = new (await import('better-sqlite3')).default(':memory:');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-retry-'));
  let submitCalls = 0;
  let pollCalls = 0;
  const provider = {
    enabled: true,
    routeId: 'sd5-seedance-2.0',
    model: 'sd5-seedance-2.0',
    submit: async () => { submitCalls += 1; return { id: 'accepted-task', progress: 0 }; },
    get: async () => {
      pollCalls += 1;
      const error = new Error('temporary upstream read failure');
      error.retryable = true;
      throw error;
    },
    download: async () => { throw new Error('download must not run'); },
  };
  const service = createVideoGeneration({
    db,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => ({ status: 'settled' }),
      releaseItem: () => ({ status: 'released' }),
    },
    quoteService: { verify: ({ quoteId, expectedQuote }) => ({ quoteId, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' }) },
    upsertWork() {},
    assetRoot,
    providerRegistry: { get: () => provider, publicProducts: () => [] },
    pollIntervalMs: 1,
    maxConcurrent: 1,
  });
  t.after(() => {
    service.close?.();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });
  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'accepted-once',
    billingQuoteId: 'quote-accepted-once',
    publicBaseUrl: 'https://example.com',
    input: { productId: 'seedance_standard', mode: 'script', prompt: '只提交一次', duration: 5, aspectRatio: '16:9', resolution: '720p' },
  });
  await new Promise(resolve => {
    const check = () => (pollCalls > 0 ? resolve() : setTimeout(check, 2));
    check();
  });
  assert.equal(submitCalls, 1);
  assert.equal(service.getJob('owner@example.com', created.job.id).providerTaskId, undefined);
});
