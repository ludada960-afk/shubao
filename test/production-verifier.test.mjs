import test from 'node:test';
import assert from 'node:assert/strict';

import { requestJson, verifyProduction } from '../scripts/verify-production-billing.mjs';

test('public verifier retries transient transport failures before returning JSON', async () => {
  let attempts = 0;
  const delays = [];
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) throw new TypeError('TLS handshake failed');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await requestJson('https://shuimg.cn/health', {
    fetchImpl,
    maxAttempts: 3,
    retryDelayMs: 10,
    sleep: async (delay) => delays.push(delay),
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);
});

test('public verifier fails after the bounded retry limit', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    throw new TypeError('TLS handshake failed');
  };

  await assert.rejects(
    requestJson('https://shuimg.cn/health', {
      fetchImpl,
      maxAttempts: 3,
      retryDelayMs: 0,
      sleep: async () => {},
    }),
    /TLS handshake failed/,
  );
  assert.equal(attempts, 3);
});

test('production verifier fails closed without the signed canary token', async () => {
  await assert.rejects(verifyProduction({ baseUrl: 'https://shuimg.cn' }), /SHUBAO_CANARY_SESSION_TOKEN is required/);
});
