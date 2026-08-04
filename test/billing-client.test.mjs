import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBillingOrder,
  fetchBillingBalance,
  fetchBillingCatalog,
  fetchBillingOrder,
  fetchBillingLedger,
  quoteBillingAction,
  waitForBillingOrder,
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
  await createBillingOrder({
    productSku: 'ec_100',
    provider: 'manual',
    idempotencyKey: 'order-1',
    email: 'untrusted@example.com',
    amount: 0.01,
    price: 0.01,
    sets: 999,
    credits: 999,
  });
  await fetchBillingOrder('order-1');
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
    { url: '/api/billing/orders/order-1', method: 'GET', body: null },
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

test('billing order polling tolerates a transient upstream response and stops at a terminal order', async (t) => {
  installSession();
  const originalFetch = globalThis.fetch;
  const responses = [
    jsonResponse({ error: 'temporarily unavailable', code: 'BILLING_UPSTREAM' }, 503),
    jsonResponse({ order: { id: 'order-2', status: 'pending' } }),
    jsonResponse({ order: { id: 'order-2', status: 'credited', grantUnits: 105000 } }),
  ];
  globalThis.fetch = async () => responses.shift();
  t.after(() => { globalThis.fetch = originalFetch; });

  const updates = [];
  const result = await waitForBillingOrder('order-2', {
    intervalMs: 250,
    maxAttempts: 3,
    onUpdate: order => updates.push(order.status),
  });

  assert.equal(result.status, 'credited');
  assert.deepEqual(updates, ['pending', 'credited']);
  assert.equal(responses.length, 0);
});
