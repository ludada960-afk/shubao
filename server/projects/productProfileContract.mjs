const MAX_NAME_LENGTH = 160;
const MAX_CATEGORY_LENGTH = 80;
const MAX_FACT_LENGTH = 500;
const MAX_FACT_COUNT = 32;
const MAX_VARIANTS = 100;
const MAX_VARIANT_TEXT_LENGTH = 120;
const MAX_ASSET_REFS = 128;

export const PRODUCT_PROFILE_STATUSES = Object.freeze(['active', 'archived']);

const FACT_ALIASES = Object.freeze({
  product_name: 'productName',
  productName: 'productName',
  category: 'category',
  material: 'material',
  dimensions: 'dimensions',
  size: 'dimensions',
  base_color: 'baseColor',
  baseColor: 'baseColor',
  accent_color: 'accentColor',
  accentColor: 'accentColor',
  craft: 'craft',
  selling_points: 'sellingPoints',
  sellingPoints: 'sellingPoints',
  restrictions: 'restrictions',
  usage: 'usage',
  target_audience: 'targetAudience',
  targetAudience: 'targetAudience',
});

const ASSET_ROLES = new Set(['product', 'reference', 'person', 'scene', 'generated']);
const VARIANT_FIELDS = Object.freeze(['label', 'color', 'spec', 'size', 'capacity', 'dimLabel']);

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

function text(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '';
  return normalized.slice(0, maxLength);
}

function own(value, key) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.hasOwn(value, key)
    ? value[key]
    : undefined;
}

function requireText(value, field, maxLength) {
  const normalized = text(value, maxLength);
  if (!normalized) throw coded('PRODUCT_PROFILE_INVALID', `${field} is required`);
  return normalized;
}

function normalizeFacts(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw coded('PRODUCT_PROFILE_INVALID', 'facts must be an object');
  }
  const facts = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = FACT_ALIASES[rawKey];
    if (!key || Object.hasOwn(facts, key)) continue;
    const normalized = text(rawValue, MAX_FACT_LENGTH);
    if (normalized) facts[key] = normalized;
    if (Object.keys(facts).length >= MAX_FACT_COUNT) break;
  }
  return facts;
}

function normalizeVariant(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const variant = Object.fromEntries(VARIANT_FIELDS.map(field => [field, text(value[field], MAX_VARIANT_TEXT_LENGTH)]));
  const count = Number(value.count);
  variant.count = Number.isSafeInteger(count) && count > 0 ? Math.min(count, 999) : 1;
  if (!VARIANT_FIELDS.some(field => variant[field])) return null;
  return variant;
}

function variantKey(value) {
  return VARIANT_FIELDS.map(field => value[field]).join('\u0000');
}

function normalizeVariants(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw coded('PRODUCT_PROFILE_INVALID', 'variants must be an array');
  const variants = [];
  const seen = new Set();
  for (const item of value.slice(0, MAX_VARIANTS)) {
    const variant = normalizeVariant(item);
    if (!variant) continue;
    const key = variantKey(variant);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }
  return variants;
}

export function normalizeProductProfileAssetRef(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw coded('PRODUCT_PROFILE_ASSET_REF_INVALID', 'asset reference must be an object');
  }
  const projectId = text(value.projectId, 256);
  const projectAssetId = text(value.projectAssetId, 256);
  const role = text(value.role, 80);
  const expectedContentHash = text(value.expectedContentHash, 256);
  if (!projectId) throw coded('PRODUCT_PROFILE_ASSET_REF_INVALID', 'projectId is required');
  if (!projectAssetId) throw coded('PRODUCT_PROFILE_ASSET_REF_INVALID', 'projectAssetId is required');
  if (!ASSET_ROLES.has(role)) throw coded('PRODUCT_PROFILE_ASSET_REF_INVALID', 'role is invalid');
  if (!expectedContentHash) throw coded('PRODUCT_PROFILE_ASSET_REF_INVALID', 'expectedContentHash is required');
  return { projectId, projectAssetId, role, expectedContentHash };
}

function assetRefKey(value) {
  return `${value.projectId}\u0000${value.projectAssetId}\u0000${value.role}\u0000${value.expectedContentHash}`;
}

function normalizeAssetRefs(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw coded('PRODUCT_PROFILE_INVALID', 'assets must be an array');
  const assets = [];
  const seen = new Set();
  for (const item of value.slice(0, MAX_ASSET_REFS)) {
    const reference = normalizeProductProfileAssetRef(item);
    const key = assetRefKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    assets.push(reference);
  }
  return assets;
}

function directFacts(value) {
  return normalizeFacts({
    ...(value?.productParams && typeof value.productParams === 'object' ? value.productParams : {}),
    ...(value?.facts && typeof value.facts === 'object' ? value.facts : {}),
    ...(Object.hasOwn(value || {}, 'productName') ? { productName: value.productName } : {}),
    ...(Object.hasOwn(value || {}, 'product_name') ? { product_name: value.product_name } : {}),
    ...(Object.hasOwn(value || {}, 'category') ? { category: value.category } : {}),
  });
}

function profileName(value, facts) {
  return requireText(
    value?.name ?? value?.productName ?? value?.product_name ?? facts.productName,
    'name',
    MAX_NAME_LENGTH,
  );
}

export function normalizeProductProfileInput(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw coded('PRODUCT_PROFILE_INVALID', 'profile must be an object');
  }
  const facts = directFacts(value);
  return {
    name: profileName(value, facts),
    category: text(value.category ?? facts.category, MAX_CATEGORY_LENGTH),
    facts,
    variants: normalizeVariants(value.variants ?? value.skus),
    assets: normalizeAssetRefs(value.assets),
    status: 'active',
  };
}

export function normalizeProductProfilePatch(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw coded('PRODUCT_PROFILE_INVALID', 'profile patch must be an object');
  }
  const patch = {};
  if (Object.hasOwn(value, 'name')) patch.name = requireText(value.name, 'name', MAX_NAME_LENGTH);
  if (Object.hasOwn(value, 'category')) patch.category = text(value.category, MAX_CATEGORY_LENGTH);
  if (Object.hasOwn(value, 'facts')) patch.facts = normalizeFacts(value.facts);
  if (Object.hasOwn(value, 'variants') || Object.hasOwn(value, 'skus')) {
    patch.variants = normalizeVariants(value.variants ?? value.skus);
  }
  if (Object.hasOwn(value, 'assets')) patch.assets = normalizeAssetRefs(value.assets);
  if (Object.hasOwn(value, 'status')) {
    const status = text(value.status, 20);
    if (!PRODUCT_PROFILE_STATUSES.includes(status)) throw coded('PRODUCT_PROFILE_INVALID', 'status is invalid');
    patch.status = status;
  }
  return patch;
}
