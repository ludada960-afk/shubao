import test from 'node:test';
import assert from 'node:assert/strict';

import { createCanvasRegenerateHandler } from '../server/canvasGenerationService.mjs';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function passthroughBilling() {
  return {
    async execute({ work }) {
      return {
        result: await work(),
        billing: { currency: 'ec_points', status: 'settled', balance: null, unlimited: true },
      };
    },
  };
}

test('Canvas handler preserves structured retryable and validation provider errors', async () => {
  const cases = [
    {
      error: Object.assign(new Error('rate limited'), {
        status: 429,
        code: 'PROVIDER_RATE_LIMITED',
        retryable: true,
        retryAfter: 7,
        taskId: 'canvas_rate_limited',
      }),
      expectedStatus: 429,
      retryAfter: '7',
    },
    {
      error: Object.assign(new Error('provider unavailable'), {
        status: 503,
        code: 'PROVIDER_UNAVAILABLE',
        retryable: true,
        taskId: 'canvas_unavailable',
      }),
      expectedStatus: 503,
    },
    {
      error: Object.assign(new Error('provider still processing'), {
        status: 504,
        code: 'PROVIDER_POLL_TIMEOUT',
        retryable: true,
        taskId: 'canvas_timeout',
        jobId: 'provider-timeout',
      }),
      expectedStatus: 504,
    },
    {
      error: Object.assign(new Error('invalid provider request'), {
        status: 422,
        code: 'PROVIDER_VALIDATION_FAILED',
        retryable: false,
        taskId: 'canvas_invalid',
      }),
      expectedStatus: 422,
    },
  ];

  for (const item of cases) {
    const handler = createCanvasRegenerateHandler({
      service: {
        async regenerate() {
          throw item.error;
        },
      },
      billing: passthroughBilling(),
    });
    const res = createResponse();
    await handler({
      _userEmail: 'signed-owner@example.com',
      body: { prompt: 'test', image_url: 'primary.png' },
    }, res);

    assert.equal(res.statusCode, item.expectedStatus);
    assert.equal(res.body.error, item.error.message);
    assert.equal(res.body.code, item.error.code);
    assert.equal(res.body.retryable, item.error.retryable);
    assert.equal(res.body.resumeable, item.error.retryable);
    assert.equal(res.body.taskId, item.error.taskId);
    if (item.retryAfter) {
      assert.equal(res.headers['retry-after'], item.retryAfter);
      assert.equal(res.body.retryAfter, Number(item.retryAfter));
    }
  }
});

test('Canvas handler keeps the successful url response contract and may include the durable task id', async () => {
  const handler = createCanvasRegenerateHandler({
    service: {
      async regenerate(input) {
        assert.equal(input.ownerEmail, 'signed-owner@example.com');
        return {
          url: '/api/generated-assets/canvas.png',
          taskId: 'canvas_success',
          replay: false,
        };
      },
    },
    billing: passthroughBilling(),
  });
  const res = createResponse();

  await handler({
    _userEmail: 'signed-owner@example.com',
    body: { prompt: 'test', image_url: 'primary.png' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    url: '/api/generated-assets/canvas.png',
    taskId: 'canvas_success',
    billing: { currency: 'ec_points', status: 'settled', balance: null, unlimited: true },
  });
});

test('Canvas handler bills with the SKU selected by the requested resolution', async () => {
  const billedSkus = [];
  const handler = createCanvasRegenerateHandler({
    service: {
      async regenerate() {
        return { url: '/api/generated-assets/canvas.png' };
      },
    },
    billing: {
      async execute({ sku, work }) {
        billedSkus.push(sku);
        return { result: await work(), billing: { status: 'settled' } };
      },
    },
  });

  await handler({
    _userEmail: 'signed-owner@example.com',
    body: { prompt: 'test', image_url: 'primary.png', resolution: '4K', ratio: '3:4' },
  }, createResponse());
  await handler({
    _userEmail: 'signed-owner@example.com',
    body: { prompt: 'test', image_url: 'primary.png', resolution: '2K', ratio: '1:1' },
  }, createResponse());

  assert.deepEqual(billedSkus, ['ec_image_4k', 'ec_image_2k']);
});

test('Canvas handler accepts only the signed owner and never a body email fallback', async () => {
  let calls = 0;
  const handler = createCanvasRegenerateHandler({
    service: {
      async regenerate(input) {
        calls += 1;
        assert.equal(input.ownerEmail, 'signed-owner@example.com');
        return { url: '/api/generated-assets/canvas.png' };
      },
    },
    billing: passthroughBilling(),
  });

  const signedResponse = createResponse();
  await handler({
    _userEmail: 'signed-owner@example.com',
    body: {
      email: 'forged-owner@example.com',
      prompt: 'test',
      image_url: 'primary.png',
    },
  }, signedResponse);

  assert.equal(signedResponse.statusCode, 200);
  assert.equal(calls, 1);

  const unsignedResponse = createResponse();
  await handler({
    body: {
      email: 'forged-owner@example.com',
      prompt: 'test',
      image_url: 'primary.png',
    },
  }, unsignedResponse);

  assert.equal(unsignedResponse.statusCode, 401);
  assert.equal(unsignedResponse.body.code, 'AUTH_SESSION_REQUIRED');
  assert.equal(calls, 1);
});

test('Canvas handler preserves authoritative billing fields for a resumable paywall', async () => {
  const handler = createCanvasRegenerateHandler({
    service: { async regenerate() { throw new Error('should not run'); } },
    billing: {
      async execute() {
        throw Object.assign(new Error('AI 积分不足，请购买套餐后继续'), {
          status: 402,
          code: 'BILLING_INSUFFICIENT_CREDITS',
          resumeable: true,
          required: 1000,
          available: 200,
          billing: { currency: 'ec_points', status: 'insufficient' },
          reQuoteRequired: true,
        });
      },
    },
  });
  const res = createResponse();

  await handler({ _userEmail: 'signed-owner@example.com', body: {} }, res);

  assert.equal(res.statusCode, 402);
  assert.equal(res.body.required, 1000);
  assert.equal(res.body.available, 200);
  assert.deepEqual(res.body.billing, { currency: 'ec_points', status: 'insufficient' });
  assert.equal(res.body.reQuoteRequired, true);
  assert.equal(res.body.resumeable, true);
});
