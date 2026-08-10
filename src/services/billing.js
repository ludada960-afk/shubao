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

export function quoteBillingAction(input, { signal } = {}) {
  return requestJson('/api/billing/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withoutEmail(input)),
    signal,
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

export function fetchBillingOrder(orderId, options = {}) {
  const normalized = typeof orderId === 'string' ? orderId.trim() : '';
  if (!normalized) throw new TypeError('orderId is required');
  return requestJson(`/api/billing/orders/${encodeURIComponent(normalized)}`, {
    signal: options.signal,
  });
}

const TERMINAL_ORDER_STATUSES = new Set(['credited', 'failed', 'cancelled', 'refunded']);

function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(createAbortError());
    }, { once: true });
  });
}

function isRetryableOrderPollError(error) {
  if (error?.name === 'AbortError') return false;
  if (Number.isInteger(error?.status)) {
    return [408, 425, 429, 500, 502, 503, 504].includes(error.status);
  }
  return true;
}

export async function waitForBillingOrder(orderId, {
  signal,
  intervalMs = 1500,
  maxAttempts = 40,
  onUpdate,
} = {}) {
  const delay = Math.max(250, Number(intervalMs) || 1500);
  const attempts = Math.max(1, Math.min(120, Number(maxAttempts) || 40));
  let latest;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let pollError = null;
    for (let retry = 0; retry < 3; retry += 1) {
      try {
        latest = await fetchBillingOrder(orderId, { signal });
        pollError = null;
        break;
      } catch (error) {
        if (!isRetryableOrderPollError(error) || retry === 2) {
          pollError = error;
          break;
        }
        await sleep(Math.min(1000, 250 * (retry + 1)), signal);
      }
    }
    if (pollError) {
      if (attempt < attempts - 1) {
        await sleep(delay, signal);
        continue;
      }
      throw pollError;
    }
    const order = latest?.order || latest;
    onUpdate?.(order);
    if (TERMINAL_ORDER_STATUSES.has(order?.status)) return order;
    if (attempt < attempts - 1) await sleep(delay, signal);
  }
  const error = new Error('订单状态确认超时，请稍后刷新订单');
  error.code = 'PAYMENT_ORDER_POLL_TIMEOUT';
  error.order = latest?.order || latest;
  throw error;
}

export function fetchBillingLedger(input = {}) {
  const query = new URLSearchParams();
  for (const key of ['currency', 'limit', 'offset']) {
    if (input[key] !== undefined && input[key] !== null) query.set(key, String(input[key]));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestJson(`/api/billing/ledger${suffix}`);
}
