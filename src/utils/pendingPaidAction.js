const STORAGE_KEY = 'shubao.pendingPaidAction.v1';
const VERSION = 1;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BASE64_IMAGE_PATTERN = /^[A-Za-z0-9+/\s]+={0,2}$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function plainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function imagePayload(value) {
  const compact = value.replace(/\s/g, '');
  return /^data:/i.test(value)
    || /^blob:/i.test(value)
    || (compact.length >= 128 && compact.length % 4 === 0 && BASE64_IMAGE_PATTERN.test(compact));
}

function unsafeObject(value) {
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return typeof value?.nodeType === 'number' || typeof value?.ownerDocument === 'object';
}

function sanitizeJson(value, ancestors = new WeakSet()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return Number.isFinite(value) || typeof value !== 'number' ? value : undefined;
  }
  if (typeof value === 'string') return imagePayload(value) ? undefined : value;
  if (typeof value !== 'object' || unsafeObject(value)) return undefined;
  if (ancestors.has(value)) return undefined;

  ancestors.add(value);
  const sanitized = Array.isArray(value) ? [] : plainObject(value) ? {} : undefined;
  if (sanitized !== undefined) {
    for (const [key, child] of Object.entries(value)) {
      const result = sanitizeJson(child, ancestors);
      if (result !== undefined) {
        if (Array.isArray(sanitized)) sanitized.push(result);
        else sanitized[key] = result;
      }
    }
  }
  ancestors.delete(value);
  return sanitized;
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
  const value = typeof now === 'function' ? now() : Date.now();
  return Number.isFinite(value) ? value : Date.now();
}

function clear(storage) {
  try { storage?.removeItem(STORAGE_KEY); } catch {}
}

function validRecord(record, ownerEmail, now, maxAgeMs) {
  if (!plainObject(record) || record.version !== VERSION) return false;
  if (!ownerEmail || record.ownerEmail !== ownerEmail) return false;
  if (!Number.isFinite(record.createdAt) || record.createdAt > now || now - record.createdAt > maxAgeMs) return false;
  if (typeof record.source !== 'string' || typeof record.route !== 'string' || typeof record.draftId !== 'string') return false;
  if (!plainObject(record.action) && !Array.isArray(record.action)) return false;
  return JSON.stringify(record) === JSON.stringify(sanitizeJson(record));
}

export function createPendingPaidAction(input = {}, options = {}) {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const action = sanitizeJson(input.action);
  if (!ownerEmail || typeof input.source !== 'string' || typeof input.route !== 'string' || typeof input.draftId !== 'string') return null;
  if (!plainObject(action) && !Array.isArray(action)) return null;

  const record = {
    version: VERSION,
    ownerEmail,
    source: input.source,
    route: input.route,
    draftId: input.draftId,
    action,
    createdAt: nowFor(options.now),
  };
  if (typeof input.quoteId === 'string' && input.quoteId) record.quoteId = input.quoteId;
  return record;
}

export function savePendingPaidAction(action, options = {}) {
  const storage = storageFor(options.storage);
  if (!storage || !validRecord(action, normalizeEmail(action?.ownerEmail), action?.createdAt, Infinity)) return null;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(action));
    return action;
  } catch {
    return null;
  }
}

export function loadPendingPaidAction(ownerEmail, options = {}) {
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

export function clearPendingPaidAction(options = {}) {
  clear(storageFor(options.storage));
}
