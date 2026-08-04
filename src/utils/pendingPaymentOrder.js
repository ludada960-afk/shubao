const STORAGE_KEY = 'shubao.pendingPaymentOrder.v1';
const VERSION = 1;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set(['credited', 'failed', 'cancelled', 'refunded']);

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function storageFor(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function nowFor(now) {
  const value = typeof now === 'function' ? now() : now;
  return Number.isFinite(value) ? value : Date.now();
}

function nonEmpty(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : '';
}

function safeCheckout(checkout) {
  if (!checkout || typeof checkout !== 'object') return undefined;
  const url = typeof checkout.url === 'string' && /^https:\/\//i.test(checkout.url.trim())
    ? checkout.url.trim()
    : '';
  const mode = nonEmpty(checkout.mode, 40);
  if (!url && !mode) return undefined;
  return {
    ...(mode ? { mode } : {}),
    ...(url ? { url } : {}),
  };
}

function normalizedRecord(input = {}, options = {}) {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const orderId = nonEmpty(input.orderId, 160);
  const productSku = nonEmpty(input.productSku, 160);
  const provider = nonEmpty(input.provider, 80);
  const idempotencyKey = nonEmpty(input.idempotencyKey, 240);
  if (!ownerEmail || !orderId || !productSku || !provider || !idempotencyKey) return null;

  const createdAt = nowFor(options.now ?? input.createdAt);
  if (!Number.isFinite(createdAt)) return null;
  const status = nonEmpty(input.status, 40) || 'pending';
  const checkout = safeCheckout(input.checkout);
  return {
    version: VERSION,
    ownerEmail,
    orderId,
    productSku,
    provider,
    idempotencyKey,
    status,
    createdAt,
    ...(checkout ? { checkout } : {}),
  };
}

function clear(storage) {
  try { storage?.removeItem(STORAGE_KEY); } catch {}
}

function validRecord(record, ownerEmail, now, maxAgeMs) {
  if (!record || typeof record !== 'object' || record.version !== VERSION) return false;
  if (!ownerEmail || record.ownerEmail !== ownerEmail) return false;
  if (!Number.isFinite(record.createdAt) || record.createdAt > now || now - record.createdAt > maxAgeMs) return false;
  if (!nonEmpty(record.orderId, 160) || !nonEmpty(record.productSku, 160)) return false;
  if (!nonEmpty(record.provider, 80) || !nonEmpty(record.idempotencyKey, 240)) return false;
  if (!nonEmpty(record.status, 40)) return false;
  if (record.checkout !== undefined && JSON.stringify(record.checkout) !== JSON.stringify(safeCheckout(record.checkout))) return false;
  return true;
}

export function isTerminalPaymentOrderStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function createPendingPaymentOrder(input = {}, options = {}) {
  return normalizedRecord(input, options);
}

export function savePendingPaymentOrder(record, options = {}) {
  const storage = storageFor(options.storage);
  const normalized = normalizedRecord(record, { now: () => record?.createdAt });
  if (!storage || !normalized || !validRecord(normalized, normalized.ownerEmail, normalized.createdAt, Infinity)) return null;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function loadPendingPaymentOrder(ownerEmail, options = {}) {
  const storage = storageFor(options.storage);
  const owner = normalizeEmail(ownerEmail);
  if (!storage || !owner) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!validRecord(record, owner, nowFor(options.now), options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) {
      clear(storage);
      return null;
    }
    return record;
  } catch {
    clear(storage);
    return null;
  }
}

export function clearPendingPaymentOrder(options = {}) {
  clear(storageFor(options.storage));
}
