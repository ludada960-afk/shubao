import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVideoGeneration, videoFeatureSku } from '../server/videoGeneration.mjs';

test('video pricing tier is derived server-side from delivery resolution and duration', () => {
  assert.equal(videoFeatureSku({ resolution: '480p', duration: 4 }), 'video_seedance_480p_short');
  assert.equal(videoFeatureSku({ resolution: '480p', duration: 15 }), 'video_seedance_480p_long');
  assert.equal(videoFeatureSku({ resolution: '720p', duration: 8 }), 'video_seedance_720p_short');
  assert.equal(videoFeatureSku({ resolution: '720p', duration: 9 }), 'video_seedance_720p_long');
});

function createVideoGenerationHarness(t) {
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

test('reference mode accepts an audio-only reference job', async t => {
  const service = createVideoGenerationHarness(t);
  const ownerEmail = 'owner@example.com';
  const audio = await uploadReferenceAsset(service, ownerEmail, 'audio');

  const result = await service.createJob({
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
  });

  assert.equal(result.replay, false);
  assert.equal(result.job.mode, 'reference');
  assert.deepEqual(result.job.references.audios, [audio.id]);
  assert.deepEqual(result.job.references.images, []);
  assert.deepEqual(result.job.references.videos, []);
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
    error => error?.code === 'VIDEO_REFERENCE_REQUIRED',
  );
});
