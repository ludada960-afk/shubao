import test from 'node:test';
import assert from 'node:assert/strict';

import * as billingVerifier from '../scripts/verify-production-billing.mjs';

const { requestJson, verifyProduction } = billingVerifier;

test('production verifier reads its canary session from the process environment without a CLI secret', () => {
  assert.equal(typeof billingVerifier.parseArguments, 'function');
  assert.deepEqual(billingVerifier.parseArguments([], { SHUBAO_CANARY_SESSION_TOKEN: 'owner-session' }), {
    baseUrl: 'https://shuimg.cn',
    sessionToken: 'owner-session',
  });
});

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

test('production billing verifier never uses a beta tester for automated deployment probes', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async url => {
    const path = new URL(url).pathname;
    requests.push(path);
    if (path === '/health') return new Response(JSON.stringify({ ok: true, imageQueue: {} }));
    if (path === '/') return new Response(JSON.stringify({ ok: true }));
    if (path === '/api/billing/catalog') return new Response(JSON.stringify({ products: [], providers: [] }));
    if (path === '/api/session') return new Response(JSON.stringify({ ok: true, email: '240485042@qq.com' }));
    throw new Error(`unexpected billing probe ${path}`);
  };

  await assert.rejects(
    verifyProduction({ baseUrl: 'https://shuimg.cn', sessionToken: 'collaborator-token' }),
    /main owner account/i,
  );
  assert.deepEqual(requests, ['/health', '/', '/api/billing/catalog', '/api/session']);
});

test('production billing verifier accepts the owner real point wallet without mutating it', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  const balance = {
    unlimited: false,
    balances: {
      ec_points: { availableUnits: 300000, heldUnits: 0, unlimited: false },
    },
  };
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    requests.push({ path, method: options.method || 'GET' });
    if (path === '/health') return new Response(JSON.stringify({ ok: true, imageQueue: {} }));
    if (path === '/') return new Response(JSON.stringify({ ok: true }));
    if (path === '/api/billing/catalog') return new Response(JSON.stringify({ products: [], providers: [] }));
    if (path === '/api/session') return new Response(JSON.stringify({ ok: true, email: '867550189@qq.com' }));
    if (path === '/api/billing/balance') return new Response(JSON.stringify(balance));
    if (path === '/api/billing/quote') return new Response(JSON.stringify({ quote: { quoteId: 'quote-1', totalUnits: 200 } }));
    throw new Error(`unexpected billing probe ${path}`);
  };

  await verifyProduction({ baseUrl: 'https://shuimg.cn', sessionToken: 'owner-token' });
  assert.deepEqual(requests.map(request => request.path), [
    '/health', '/', '/api/billing/catalog', '/api/session',
    '/api/billing/balance', '/api/billing/quote', '/api/billing/balance',
  ]);
  assert.equal(requests.find(request => request.path === '/api/billing/quote').method, 'POST');
});
