import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError, createApiError, isInsufficientCreditsError } from '../src/services/apiError.js';

test('parses structured insufficient-credit responses without losing status or resume metadata', async () => {
  const response = {
    status: 402,
    statusText: 'Payment Required',
    async text() { return JSON.stringify({ error: '额度不足，请购买套餐', code: 'INSUFFICIENT_CREDITS', resumeable: true }); },
  };
  const error = await createApiError(response, '生成失败');
  assert.ok(error instanceof ApiError);
  assert.equal(error.status, 402);
  assert.equal(error.code, 'INSUFFICIENT_CREDITS');
  assert.equal(error.resumeable, true);
  assert.equal(error.message, '额度不足，请购买套餐');
  assert.equal(isInsufficientCreditsError(error), true);
});

test('falls back to readable text for ordinary API failures', async () => {
  const response = { status: 400, statusText: 'Bad Request', async text() { return 'upstream failed'; } };
  const error = await createApiError(response, '生成失败');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'API_ERROR');
  assert.equal(error.message, 'upstream failed');
  assert.equal(isInsufficientCreditsError(error), false);
});

test('maps non-JSON 5xx proxy failures to the friendly fallback message', async () => {
  // dev 场景：vite 代理指向未启动的 3001 后端 → 纯文本/空 body 的 500，
  // statusText 恰为 "Internal Server Error"，不得透传给弹窗。
  const response = { status: 500, statusText: 'Internal Server Error', async text() { return ''; } };
  const error = await createApiError(response, '暂时无法读取项目素材库');
  assert.equal(error.status, 500);
  assert.equal(error.code, 'API_ERROR');
  assert.equal(error.message, '暂时无法读取项目素材库');
});

test('keeps non-JSON 5xx raw body for diagnosis without leaking it into the message', async () => {
  const response = { status: 502, statusText: 'Bad Gateway', async text() { return 'Bad Gateway'; } };
  const error = await createApiError(response, '生成失败');
  assert.equal(error.message, '生成失败');
  assert.equal(error.payload?.rawBody, 'Bad Gateway');
});

test('preserves retry and durable Canvas task metadata from structured failures', async () => {
  const response = {
    status: 503,
    statusText: 'Service Unavailable',
    async text() {
      return JSON.stringify({
        error: '仍在生成中',
        code: 'CANVAS_REQUEST_IN_PROGRESS',
        retryable: true,
        resumeable: true,
        retryAfter: 2,
        taskId: 'canvas-task-1',
        providerJobId: 'provider-task-1',
        reQuoteRequired: false,
      });
    },
  };
  const error = await createApiError(response, '生成失败');
  assert.equal(error.retryable, true);
  assert.equal(error.resumeable, true);
  assert.equal(error.retryAfter, 2);
  assert.equal(error.taskId, 'canvas-task-1');
  assert.equal(error.providerJobId, 'provider-task-1');
  assert.equal(error.reQuoteRequired, false);
});


test('recognises the wallet BILLING_INSUFFICIENT_CREDITS code even without a 402 status', () => {
  assert.equal(isInsufficientCreditsError({ code: 'BILLING_INSUFFICIENT_CREDITS' }), true);
  assert.equal(isInsufficientCreditsError({ code: 'INSUFFICIENT_CREDITS' }), true);
  assert.equal(isInsufficientCreditsError({ code: 'API_ERROR', status: 500 }), false);
});
