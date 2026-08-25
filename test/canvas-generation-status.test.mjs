import assert from 'node:assert/strict';
import test from 'node:test';

import { toGenerationStatus } from '../src/pages/EcCanvas/generationStatusModel.js';

test('an older review state offers completion without exposing internal quality language', () => {
  const status = toGenerationStatus({ status: 'needs_review' });
  assert.equal(status.action, 'retry');
  assert.match(status.detail, /已.*保留|补全/);
  assert.doesNotMatch(`${status.title}${status.detail}`, /质量|修订|检查/);
});

test('provider credential details never reach the user-facing status', () => {
  const status = toGenerationStatus({ status: 'failed', error: 'Vision API error 401: Authentication Fails, api key invalid' });
  assert.doesNotMatch(status.detail, /api|key|authentication|401/i);
  assert.equal(status.retryable, true);
});


test('billing shortfalls are reported with amounts instead of a generic service error', () => {
  const status = toGenerationStatus({
    status: 'failed',
    output: { errors: [{ code: 'BILLING_INSUFFICIENT_CREDITS', status: 402, required: 12, available: 3, error: 'AI 积分不足，请购买套餐后继续' }] },
  });
  assert.equal(status.title, 'AI 积分不足');
  assert.match(status.detail, /12 积分/);
  assert.match(status.detail, /可用 3/);
  assert.doesNotMatch(status.detail, /视觉服务/);
});

test('provider busy and timeout codes explain retries and per-image billing', () => {
  const status = toGenerationStatus({
    status: 'failed',
    output: { errors: [{ code: 'PROVIDER_POLL_TIMEOUT', retryable: true, error: 'provider job is still running' }] },
  });
  assert.equal(status.title, '生成服务繁忙');
  assert.match(status.detail, /未完成图片未计费/);
  assert.doesNotMatch(status.detail, /api|key|token/i);
});

test('partial failures state that delivered images stay charged and preserved', () => {
  const status = toGenerationStatus({
    status: 'failed',
    progress: { completed: 2, total: 3 },
    output: { images: { main_1: '/api/generated-assets/a.png' }, errors: [{ code: 'NANO_BANANA_TIMEOUT', retryable: true }] },
  });
  assert.match(status.detail, /已完成的图片正常计费并保留/);
});

test('quote expiry asks the user to reconfirm pricing', () => {
  const status = toGenerationStatus({
    status: 'failed',
    output: { errors: [{ reQuoteRequired: true, error: '费用报价已过期' }] },
  });
  assert.equal(status.title, '费用确认已过期');
  assert.equal(status.retryable, true);
});
