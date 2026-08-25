import assert from 'node:assert/strict';
import test from 'node:test';

import { createNanoBananaProviderAdapter } from '../server/ecommerceEngine/nanoBananaProviderAdapter.mjs';

test('validates the model, sends Gemini image options, and persists before delivery', async () => {
  const calls = [];
  const persisted = [];
  const adapter = createNanoBananaProviderAdapter({
    apiKey: 'test-key-that-is-long-enough', baseUrl: 'https://provider.example', publicBaseUrl: 'http://127.0.0.1:3002',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash-image' }] }), { status: 200 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } }] } }] }), { status: 200 });
    },
    generatedAssetStore: {
      async persistBuffer(input) { persisted.push(input); return { id: 'asset.png', url: '/api/generated-assets/asset.png' }; },
      async read(id) { return id === 'asset.png' ? { buffer: Buffer.from('image'), contentType: 'image/png' } : null; },
    },
  });
  const submitted = await adapter.submitEdit({
    idempotencyKey: 'nano-one', prompt: 'Create a product image',
    modelRoute: { imageModel: 'nano-banana-2', model: 'gemini-2.5-flash-image', resolution: '2K', ratio: '3:4' },
    inputAssets: [{ buffer: Buffer.from('reference'), contentType: 'image/png' }],
  });
  const completed = await adapter.pollUntilReady(submitted.jobId);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.generationConfig.imageConfig.imageSize, '2K');
  assert.equal(body.generationConfig.imageConfig.aspectRatio, '3:4');
  assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/png');
  assert.equal(persisted.length, 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.outputUrl, 'http://127.0.0.1:3002/api/generated-assets/asset.png');
});


test('retries transient upstream failures with exponential backoff before succeeding', async () => {
  const calls = [];
  const sleeps = [];
  const persisted = [];
  const adapter = createNanoBananaProviderAdapter({
    apiKey: 'test-key-that-is-long-enough', baseUrl: 'https://provider.example', publicBaseUrl: 'http://127.0.0.1:3002',
    retryDelaysMs: [10, 20],
    sleepImpl: ms => { sleeps.push(ms); return new Promise(resolve => setTimeout(resolve, Math.min(ms, 25))); },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (String(url).endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash-image' }] }), { status: 200 });
      if (calls.filter(c => c.includes(':generateContent')).length < 3) {
        return new Response(JSON.stringify({ error: { message: 'upstream overloaded' } }), { status: 503, headers: { 'retry-after': '1' } });
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: Buffer.from('image').toString('base64') } }] } }] }), { status: 200 });
    },
    generatedAssetStore: {
      async persistBuffer(input) { persisted.push(input); return { id: 'asset.png', url: '/api/generated-assets/asset.png' }; },
      async read(id) { return id === 'asset.png' ? { buffer: Buffer.from('image'), contentType: 'image/png' } : null; },
    },
  });
  const submitted = await adapter.submitEdit({
    idempotencyKey: 'nano-retry', prompt: 'p',
    modelRoute: { imageModel: 'nano-banana-2', model: 'gemini-2.5-flash-image', resolution: '2K', ratio: '1:1' },
    inputAssets: [{ buffer: Buffer.from('reference'), contentType: 'image/png' }],
  });
  assert.equal(submitted.status, 'submitted');
  assert.equal(calls.filter(c => c.includes(':generateContent')).length, 3, 'two failed attempts plus one success');
  assert.ok(sleeps.length >= 2, 'backoff sleeps between attempts');
});

test('honours Retry-After over the default backoff and surfaces busy errors after exhaustion', async () => {
  const sleeps = [];
  let attempts = 0;
  const adapter = createNanoBananaProviderAdapter({
    apiKey: 'test-key-that-is-long-enough', baseUrl: 'https://provider.example',
    retryDelaysMs: [5, 5],
    sleepImpl: ms => { sleeps.push(ms); return Promise.resolve(); },
    fetchImpl: async (url) => {
      if (String(url).endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash-image' }] }), { status: 200 });
      attempts += 1;
      return new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429, headers: { 'retry-after': '7' } });
    },
    generatedAssetStore: {
      async persistBuffer() { throw new Error('should not persist'); },
      async read() { return null; },
    },
  });
  await assert.rejects(
    () => adapter.submitEdit({
      idempotencyKey: 'nano-429', prompt: 'p',
      modelRoute: { imageModel: 'nano-banana-2', model: 'gemini-2.5-flash-image' },
      inputAssets: [],
    }),
    error => {
      assert.equal(error.code, 'NANO_BANANA_PROVIDER_BUSY');
      assert.equal(error.retryable, true);
      return true;
    },
  );
  assert.equal(attempts, 3, 'initial attempt plus two retries');
  assert.deepEqual(sleeps, [7000, 7000], 'Retry-After seconds win over sub-second backoff');
});

test('does not retry non-retryable client errors and keeps timeout failures bounded', async () => {
  const generateCalls = [];
  let hungOnce = false;
  const adapter = createNanoBananaProviderAdapter({
    apiKey: 'test-key-that-is-long-enough', baseUrl: 'https://provider.example',
    retryDelaysMs: [5],
    sleepImpl: () => Promise.resolve(),
    timeoutMs: 40,
    fetchImpl: (url, options = {}) => {
      if (String(url).endsWith('/v1/models')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'gemini-2.5-flash-image' }] }), { status: 200 }));
      generateCalls.push(1);
      if (!hungOnce) {
        hungOnce = true;
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
        });
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 }));
    },
    generatedAssetStore: { async persistBuffer() { throw new Error('no'); }, async read() { return null; } },
  });
  await assert.rejects(
    () => adapter.submitEdit({
      idempotencyKey: 'nano-timeout', prompt: 'p',
      modelRoute: { imageModel: 'nano-banana-2', model: 'gemini-2.5-flash-image' },
      inputAssets: [],
    }),
    error => {
      assert.equal(error.code, 'NANO_BANANA_GENERATION_FAILED');
      assert.equal(error.retryable, false);
      return true;
    },
  );
  assert.equal(generateCalls.length, 2, 'timed-out first attempt retried once, then 400 stops retries');
});
