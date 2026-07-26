const STORAGE_KEY = 'shubao.pendingPaidAction.v1';
const VERSION = 1;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function plainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function binaryField(key) {
  const normalized = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (!normalized) return false;
  if (/(?:base64|blob|bytes|buffer|objecturl|dataurl)/.test(normalized)) return true;
  if (/(?:id|ids|key|keys|ref|refs|url|urls|name|names|label|labels|sku|skus)$/.test(normalized)) return false;
  return normalized === 'file'
    || normalized === 'files'
    || normalized === 'raw'
    || normalized === 'binary'
    || /^(?:arraybuffer|binarydata|filedata|imagedata|encodedimage|rawdata|rawimage)$/.test(normalized)
    || ((normalized.includes('image') || normalized.includes('file'))
      && /(?:raw|data|encoded|payload|content|upload)/.test(normalized));
}

function imagePayload(value) {
  const normalized = value.trim();
  if (/^data:/i.test(normalized) || /^blob:/i.test(normalized)) return true;
  const compact = normalized.replace(/\s+/g, '');
  if (compact.length < 64) return false;
  return /^[a-z0-9+/]+={0,2}$/i.test(compact)
    || /^[a-z0-9_-]+={0,2}$/i.test(compact);
}

function unsafeObject(value) {
  if (typeof File !== 'undefined' && value instanceof File) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  return typeof value?.nodeType === 'number' || typeof value?.ownerDocument === 'object';
}

function sanitizeJson(value, key = '', ancestors = new WeakSet()) {
  if (binaryField(key)) return undefined;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return Number.isFinite(value) || typeof value !== 'number' ? value : undefined;
  }
  if (typeof value === 'string') return imagePayload(value) ? undefined : value;
  if (typeof value !== 'object' || unsafeObject(value)) return undefined;
  if (ancestors.has(value)) return undefined;

  ancestors.add(value);
  const sanitized = Array.isArray(value) ? [] : plainObject(value) ? {} : undefined;
  if (sanitized !== undefined) {
    for (const [childKey, child] of Object.entries(value)) {
      const result = sanitizeJson(child, childKey, ancestors);
      if (result !== undefined) {
        if (Array.isArray(sanitized)) sanitized.push(result);
        else sanitized[childKey] = result;
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
