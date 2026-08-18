const MAX_FACTS = 64;
const MAX_KEY_LENGTH = 128;
const MAX_VALUE_BYTES = 8_192;
const MAX_ASSET_REFS = 16;
const MAX_JSON_DEPTH = 6;
const SOURCES = new Set(['user', 'approved_asset', 'skill']);
const STATUSES = new Set(['active', 'deleted']);

function invalid(message) {
  return Object.assign(new Error(message), { code: 'MEMORY_INVALID' });
}

function text(value, field, max) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw invalid(`${field} is invalid`);
  }
  return normalized;
}

function optionalText(value, field, max) {
  if (value == null || String(value).trim() === '') return '';
  return text(value, field, max);
}

function safeJson(value, depth = 0) {
  if (depth > MAX_JSON_DEPTH) throw invalid('memory value is too deeply nested');
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 8_192);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    if (value.length > 128) throw invalid('memory value array is too large');
    return value.map(item => safeJson(item, depth + 1));
  }
  if (typeof value !== 'object') throw invalid('memory value is invalid');
  const entries = Object.entries(value);
  if (entries.length > 128) throw invalid('memory value object is too large');
  return entries.reduce((result, [key, item]) => {
    result[text(key, 'memory value key', 128)] = safeJson(item, depth + 1);
    return result;
  }, {});
}

function assetRef(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('memory asset reference is invalid');
  return {
    assetId: text(value.assetId, 'memory assetId', 200),
    assetVersionId: text(value.assetVersionId, 'memory assetVersionId', 200),
  };
}

export function normalizeProjectMemoryFact(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('memory fact is invalid');
  const key = text(value.key, 'memory key', MAX_KEY_LENGTH);
  const normalizedValue = safeJson(value.value ?? null);
  if (Buffer.byteLength(JSON.stringify(normalizedValue), 'utf8') > MAX_VALUE_BYTES) {
    throw invalid('memory value is too large');
  }
  const source = String(value.source || 'user').trim();
  if (!SOURCES.has(source)) throw invalid('memory source is invalid');
  const status = String(value.status || 'active').trim();
  if (!STATUSES.has(status)) throw invalid('memory status is invalid');
  const refs = Array.isArray(value.assetRefs) ? value.assetRefs.map(assetRef) : [];
  if (refs.length > MAX_ASSET_REFS) throw invalid('memory asset references are too many');
  const uniqueRefs = new Set(refs.map(ref => `${ref.assetId}:${ref.assetVersionId}`));
  if (uniqueRefs.size !== refs.length) throw invalid('memory asset references are duplicated');
  const revision = Number(value.revision ?? 1);
  if (!Number.isSafeInteger(revision) || revision < 1) throw invalid('memory revision is invalid');
  return {
    id: optionalText(value.id, 'memory id', 200),
    key,
    value: normalizedValue,
    source,
    assetRefs: refs,
    status,
    revision,
    createdAt: optionalText(value.createdAt, 'memory createdAt', 80),
    updatedAt: optionalText(value.updatedAt, 'memory updatedAt', 80),
    deletedAt: value.deletedAt == null || String(value.deletedAt).trim() === ''
      ? null : text(value.deletedAt, 'memory deletedAt', 80),
  };
}

export function normalizeProjectMemoryList(values = []) {
  if (!Array.isArray(values) || values.length > MAX_FACTS) throw invalid('memory facts are too many');
  const facts = values.map(normalizeProjectMemoryFact);
  const keys = new Set();
  for (const fact of facts) {
    if (keys.has(fact.key)) throw invalid('memory facts contain a duplicate key');
    keys.add(fact.key);
  }
  return facts.sort((left, right) => left.key.localeCompare(right.key));
}

export function memoryFactSnapshot(value) {
  const fact = normalizeProjectMemoryFact(value);
  if (fact.status !== 'active') return null;
  return {
    key: fact.key,
    value: fact.value,
    source: fact.source,
    assetRefs: fact.assetRefs,
    revision: fact.revision,
  };
}

export function memoryFactsSnapshot(values = []) {
  return normalizeProjectMemoryList(values).map(memoryFactSnapshot).filter(Boolean);
}

export const PROJECT_MEMORY_LIMITS = Object.freeze({
  maxFacts: MAX_FACTS,
  maxKeyLength: MAX_KEY_LENGTH,
  maxValueBytes: MAX_VALUE_BYTES,
  maxAssetRefs: MAX_ASSET_REFS,
});
