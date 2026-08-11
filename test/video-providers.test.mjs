import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProviderPayload,
  createVideoProviderRegistry,
  normalizeProviderStatus,
} from '../server/videoProviders.mjs';
import { getVideoProduct } from '../server/videoCatalog.mjs';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('Seedance adapter keeps the intermediary contract and maps every material lane', async () => {
  const requests = [];
  const registry = createVideoProviderRegistry({
    baseUrl: 'https://gateway.example/v1',
    credentials: { seedance: 'seedance-test-key-that-is-long-enough' },
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body || '{}') });
      return jsonResponse({ id: 'sd-task-1', status: 'queued', progress: 0 });
    },
  });
  const provider = registry.get('seedance_standard');
  assert.equal(provider.enabled, true);
  assert.equal(provider.routeId, 'sd5-seedance-2.0');

  const payload = buildProviderPayload({
    product: getVideoProduct('seedance_standard'),
    job: {
      prompt: '一只纸船穿过雨夜街道',
      duration: 8,
      aspect_ratio: '9:16',
      resolution: '720p',
      generate_audio: 1,
      seed: 7,
      mode: 'reference',
      refs_json: JSON.stringify({
        urls: {
          image1: 'https://assets.example/image.png',
          video1: 'https://assets.example/video.mp4',
          audio1: 'https://assets.example/audio.mp3',
        },
        images: ['image1'],
        videos: ['video1'],
        audios: ['audio1'],
      }),
    },
  });
  assert.equal(payload.protocol, 'seedance');
  assert.equal(payload.path, '/videos');
  assert.deepEqual(payload.body, {
    model: 'sd5-seedance-2.0',
    prompt: '一只纸船穿过雨夜街道',
    duration: 8,
    ratio: '9:16',
    resolution: '720p',
    generate_audio: true,
    seed: 7,
    reference_image_urls: ['https://assets.example/image.png'],
    reference_video_urls: ['https://assets.example/video.mp4'],
    reference_audio_urls: ['https://assets.example/audio.mp3'],
    audio_url: 'https://assets.example/audio.mp3',
  });

  const submitted = await provider.submit(payload.body, 'video-job-1');
  assert.deepEqual(submitted, { id: 'sd-task-1', progress: 0 });
  assert.equal(requests[0].url, 'https://gateway.example/v1/videos');
  assert.equal(requests[0].options.headers['Idempotency-Key'], 'video-job-1');
});

test('MiniMax H3 adapter uses multimodal content and its own task endpoints', async () => {
  const requests = [];
  const registry = createVideoProviderRegistry({
    baseUrl: 'https://gateway.example/v1',
    credentials: { minimax: 'minimax-test-key-that-is-long-enough' },
    fetchImpl: async (url, options) => {
      requests.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
      if (options.method === 'POST') return jsonResponse({ task_id: 'h3-task-1' });
      return jsonResponse({ task: { status: 'succeeded', progress: 100, content: { url: 'https://cdn.example/h3.mp4' } } });
    },
  });
  const provider = registry.get('minimax_h3_2k');
  assert.equal(provider.enabled, true);
  const payload = buildProviderPayload({
    product: getVideoProduct('minimax_h3_2k'),
    job: {
      prompt: '产品从桌面滑入光束中',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '2k',
      generate_audio: 1,
      mode: 'frame',
      refs_json: JSON.stringify({
        urls: {
          first: 'https://assets.example/first.png',
          last: 'https://assets.example/last.png',
        },
        firstImage: 'first',
        lastImage: 'last',
      }),
    },
  });
  assert.equal(payload.protocol, 'minimax-h3');
  assert.equal(payload.path, '/videos');
  assert.equal(payload.body.model, 'minimax-h3-2k');
  assert.deepEqual(payload.body.content, [
    { type: 'text', text: '产品从桌面滑入光束中' },
    { type: 'image_url', image_url: { url: 'https://assets.example/first.png' }, role: 'first_frame' },
    { type: 'image_url', image_url: { url: 'https://assets.example/last.png' }, role: 'last_frame' },
  ]);

  assert.deepEqual(await provider.submit(payload.body, 'h3-job-1'), { id: 'h3-task-1', progress: 0 });
  assert.equal(requests[0].url, 'https://gateway.example/v1/videos');
  const status = await provider.get('h3-task-1');
  assert.deepEqual(status, {
    status: 'completed',
    progress: 100,
    downloadUrl: 'https://cdn.example/h3.mp4',
  });
  assert.equal(requests[1].url, 'https://gateway.example/v1/videos/h3-task-1');
});

test('provider status normalization handles gateway and native MiniMax envelopes', () => {
  assert.deepEqual(normalizeProviderStatus({ status: 'in_progress', progress: 42 }), {
    status: 'processing', progress: 42, downloadUrl: '',
  });
  assert.deepEqual(normalizeProviderStatus({ task: { status: 'succeeded', content: { url: 'https://cdn/x.mp4' } } }), {
    status: 'completed', progress: 100, downloadUrl: 'https://cdn/x.mp4',
  });
  assert.deepEqual(normalizeProviderStatus({ status: 'cancelled' }), {
    status: 'failed', progress: 0, downloadUrl: '',
  });
});

test('provider registry does not expose credentials and disables missing routes', () => {
  const registry = createVideoProviderRegistry({
    baseUrl: 'https://gateway.example/v1',
    credentials: { seedance: 'seedance-test-key-that-is-long-enough' },
  });
  assert.equal(registry.get('minimax_h3_2k').enabled, false);
  assert.equal('apiKey' in registry.get('seedance_standard'), false);
  assert.equal(JSON.stringify(registry.publicProducts()).includes('seedance-test-key'), false);
});
