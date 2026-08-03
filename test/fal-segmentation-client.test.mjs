import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFalSegmentationClient,
  FalSegmentationError,
} from '../server/falSegmentationClient.mjs';

function jsonResponse(payload, { status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('submits bounded SAM 3 box prompts and normalizes owned mask metadata', async () => {
  let request;
  const client = createFalSegmentationClient({
    apiKey: 'fal-test-secret',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return jsonResponse({
        request_id: 'sam-request-1',
        masks: [
          { url: 'https://fal.media/mask-1.png', width: 320, height: 240 },
          { url: 'https://fal.media/mask-2.png', width: 320, height: 240 },
        ],
        metadata: [
          { index: 0, score: 0.97, box: [0.25, 0.4, 0.2, 0.3] },
          { index: 1, score: 0.91, box: [0.7, 0.45, 0.24, 0.35] },
        ],
      });
    },
  });

  const result = await client.segment({
    imageUrl: 'data:image/png;base64,AA==',
    prompts: [
      { id: 'gray-box', box: [12.2, 18.8, 102.9, 121.1] },
      { id: 'orange-box', box: [160, 40, 280, 190] },
    ],
    maxMasks: 4,
  });

  assert.equal(request.url, 'https://fal.run/fal-ai/sam-3/image');
  assert.equal(request.options.headers.Authorization, 'Key fal-test-secret');
  assert.equal(request.body.image_url, 'data:image/png;base64,AA==');
  assert.equal(request.body.return_multiple_masks, true);
  assert.equal(request.body.include_scores, true);
  assert.equal(request.body.include_boxes, true);
  assert.equal(request.body.max_masks, 4);
  assert.deepEqual(request.body.box_prompts, [
    { x_min: 12, y_min: 19, x_max: 103, y_max: 121, object_id: 1 },
    { x_min: 160, y_min: 40, x_max: 280, y_max: 190, object_id: 2 },
  ]);
  assert.deepEqual(result, {
    requestId: 'sam-request-1',
    masks: [
      { url: 'https://fal.media/mask-1.png', width: 320, height: 240, score: 0.97, box: [0.25, 0.4, 0.2, 0.3], promptId: 'gray-box' },
      { url: 'https://fal.media/mask-2.png', width: 320, height: 240, score: 0.91, box: [0.7, 0.45, 0.24, 0.35], promptId: 'orange-box' },
    ],
  });
});

test('requires a server-side key and rejects unsafe or excessive input', async () => {
  const client = createFalSegmentationClient({ apiKey: '', fetchImpl: async () => jsonResponse({}) });

  await assert.rejects(
    () => client.segment({ imageUrl: 'https://example.com/source.png' }),
    error => error instanceof FalSegmentationError && error.code === 'SEGMENTATION_NOT_CONFIGURED',
  );

  const configured = createFalSegmentationClient({ apiKey: 'secret', fetchImpl: async () => jsonResponse({ masks: [] }) });
  await assert.rejects(
    () => configured.segment({ imageUrl: 'file:///private/source.png' }),
    error => error.code === 'SEGMENTATION_INPUT_INVALID',
  );
  await assert.rejects(
    () => configured.segment({
      imageUrl: 'https://example.com/source.png',
      prompts: Array.from({ length: 9 }, (_, index) => ({ id: `item-${index}`, box: [0, 0, 10, 10] })),
    }),
    error => error.code === 'SEGMENTATION_INPUT_INVALID',
  );
});

test('redacts provider response details and credentials from public errors', async () => {
  const client = createFalSegmentationClient({
    apiKey: 'do-not-leak',
    fetchImpl: async () => jsonResponse({ detail: 'upstream says do-not-leak' }, { status: 429 }),
  });

  await assert.rejects(
    () => client.segment({ imageUrl: 'https://example.com/source.png' }),
    error => {
      assert.equal(error.code, 'SEGMENTATION_PROVIDER_FAILED');
      assert.equal(error.status, 502);
      assert.doesNotMatch(error.message, /do-not-leak|upstream says/i);
      return true;
    },
  );
});

test('aborts a stalled provider request at the configured timeout', async () => {
  const client = createFalSegmentationClient({
    apiKey: 'secret',
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });

  await assert.rejects(
    () => client.segment({ imageUrl: 'https://example.com/source.png' }),
    error => error.code === 'SEGMENTATION_TIMEOUT' && error.status === 504,
  );
});

test('rejects empty and malformed SAM responses instead of claiming success', async () => {
  for (const payload of [{}, { masks: [] }, { masks: [{ url: 'javascript:alert(1)' }] }]) {
    const client = createFalSegmentationClient({ apiKey: 'secret', fetchImpl: async () => jsonResponse(payload) });
    await assert.rejects(
      () => client.segment({ imageUrl: 'https://example.com/source.png' }),
      error => error.code === 'SEGMENTATION_RESPONSE_INVALID',
    );
  }
});
