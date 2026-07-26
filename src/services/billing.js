import { getSessionToken } from './auth.js';
import { createApiError } from './apiError.js';

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function withoutEmail(input = {}) {
  const { email: _email, ...payload } = input;
  return payload;
}

async function requestJson(path, options = {}, fallbackMessage = '账务请求失败') {
  const response = await fetch(path, {
    ...options,
    headers: signedHeaders(options.headers),
  });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
  return response.json();
}

export function fetchBillingCatalog() {
  return requestJson('/api/billing/catalog');
}

export function fetchBillingBalance() {
  return requestJson('/api/billing/balance');
}

export function quoteBillingAction(input) {
  return requestJson('/api/billing/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withoutEmail(input)),
  });
}

export function createBillingOrder(input) {
  const payload = {
    productSku: input?.productSku,
    provider: input?.provider,
    idempotencyKey: input?.idempotencyKey,
  };
  return requestJson('/api/billing/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchBillingLedger(input = {}) {
  const query = new URLSearchParams();
  for (const key of ['currency', 'limit', 'offset']) {
    if (input[key] !== undefined && input[key] !== null) query.set(key, String(input[key]));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestJson(`/api/billing/ledger${suffix}`);
}
