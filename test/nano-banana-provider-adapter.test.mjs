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
