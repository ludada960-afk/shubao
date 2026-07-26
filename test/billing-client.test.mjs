import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBillingOrder,
  fetchBillingBalance,
  fetchBillingCatalog,
  fetchBillingLedger,
  quoteBillingAction,
} from '../src/services/billing.js';
import { ApiError } from '../src/services/apiError.js';

function installSession(token = 'signed-billing-session') {
  globalThis.localStorage = {
    getItem(key) {
      return key === 'sb-auth' ? JSON.stringify({ token }) : null;
    },
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('billing client sends each private request with a bearer token and server-owned payload', async (t) => {
  installSession();
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return jsonResponse({ ok: true });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await fetchBillingCatalog();
  await fetchBillingBalance();
  await quoteBillingAction({ sku: 'ec_100', quantity: 2, email: 'untrusted@example.com' });
  await createBillingOrder({ productSku: 'ec_100', provider: 'manual', idempotencyKey: 'order-1', email: 'untrusted@example.com' });
  await fetchBillingLedger({ currency: 'ec_points', limit: 20, offset: 10 });

  assert.deepEqual(requests.map(({ url, options }) => ({
    url,
    method: options.method || 'GET',
    body: options.body ? JSON.parse(options.body) : null,
  })), [
    { url: '/api/billing/catalog', method: 'GET', body: null },
    { url: '/api/billing/balance', method: 'GET', body: null },
    { url: '/api/billing/quote', method: 'POST', body: { sku: 'ec_100', quantity: 2 } },
    { url: '/api/billing/orders', method: 'POST', body: { productSku: 'ec_100', provider: 'manual', idempotencyKey: 'order-1' } },
    { url: '/api/billing/ledger?currency=ec_points&limit=20&offset=10', method: 'GET', body: null },
  ]);
  for (const { options } of requests) {
    assert.equal(options.headers.Authorization, 'Bearer signed-billing-session');
  }
});

test('billing client converts non-success responses to ApiError', async (t) => {
  installSession();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ error: '账务服务不可用', code: 'BILLING_DOWN' }, 503);
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(fetchBillingBalance(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 503);
    assert.equal(error.code, 'BILLING_DOWN');
    return true;
  });
});
