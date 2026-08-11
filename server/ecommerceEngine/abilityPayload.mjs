import { normalizeEcommerceAbilityRequest } from '../../shared/ecommerceAbilityRecipes.mjs';

const TRY_ON_ID = 'anything_tryon';
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(record, ...keys) {
  if (!isRecord(record)) return undefined;
  for (const key of keys) {
    if (Object.hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function abilityError(message, cause) {
  return Object.assign(new Error(message || '电商能力配置无效'), {
    status: 400,
    code: 'ECOMMERCE_ABILITY_INVALID',
    retryable: false,
    ...(cause ? { cause } : {}),
  });
}

function hasMeaningfulGroup(assets, key) {
  return Array.isArray(assets?.[key]) && assets[key].length > 0;
}

function assertNoAmbiguousGroups(payload, recipeId) {
  const assets = isRecord(payload.assets) ? payload.assets : {};
  if (recipeId === TRY_ON_ID) {
    if (hasMeaningfulGroup(assets, 'reference') || hasMeaningfulGroup(assets, 'references') || hasMeaningfulGroup(assets, 'style')) {
      throw abilityError('万物上身的参考素材请放入“场景参考”槽位');
    }
    return;
  }
  if (hasMeaningfulGroup(assets, 'items') || hasMeaningfulGroup(assets, 'person') || hasMeaningfulGroup(assets, 'scene')) {
    throw abilityError('商品套图不能混入万物上身角色素材');
  }
}

function safeAssetGroups(assets, recipeId, normalized) {
  const source = isRecord(assets) ? assets : {};
  const next = {};
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key.toLowerCase())) continue;
    if (['product', 'products', 'reference', 'references', 'style', 'items', 'person', 'scene', 'proof', 'proofs', 'protection'].includes(key)) {
      continue;
    }
    next[key] = source[key];
  }
  if (recipeId === TRY_ON_ID) {
    next.items = normalized.items;
    next.person = normalized.person;
    next.scene = normalized.scene;
    // Existing product-truth and visual-analysis code still reads product.
    next.product = normalized.items;
    next.reference = [];
  } else {
    next.product = normalized.product;
    next.reference = normalized.reference;
  }
  if (Array.isArray(source.proof)) next.proof = source.proof;
  if (Array.isArray(source.proofs)) next.proofs = source.proofs;
  if (Array.isArray(source.protection)) next.protection = source.protection;
  return next;
}

function hasAbilityContract(payload) {
  if (!isRecord(payload)) return false;
  return [
    'ability_recipe',
    'abilityRecipe',
    'asset_roles',
    'assetRoles',
    'person_mode',
    'personMode',
  ].some(key => Object.hasOwn(payload, key))
    || ['items', 'person', 'scene'].some(key => hasMeaningfulGroup(payload.assets, key));
}

/**
 * Canonicalize the extensible ability contract at the request boundary.
 * Legacy payloads without any ability fields are intentionally returned untouched.
 */
export function normalizeEcommerceAbilityPayload(payload = {}) {
  if (!isRecord(payload)) throw abilityError('电商生成请求无效');
  if (!hasAbilityContract(payload)) return payload;

  let normalized;
  try {
    const descriptor = own(payload, 'ability_recipe', 'abilityRecipe');
    const recipeId = cleanString(descriptor?.id) || 'product_suite';
    assertNoAmbiguousGroups(payload, recipeId);
    normalized = normalizeEcommerceAbilityRequest(payload);
  } catch (error) {
    if (error?.code === 'ECOMMERCE_ABILITY_INVALID') throw error;
    throw abilityError(error?.message, error);
  }

  const recipeId = normalized.recipe.id;
  const personMode = normalized.personMode;
  const next = {
    ...payload,
    ability_recipe: { id: recipeId, version: normalized.recipe.version },
    asset_roles: normalized.assetRoles,
    assets: safeAssetGroups(payload.assets, recipeId, normalized.slotAssets),
  };
  delete next.abilityRecipe;
  delete next.assetRoles;
  delete next.personMode;
  if (recipeId === TRY_ON_ID) next.person_mode = personMode;
  else delete next.person_mode;
  return next;
}

export { TRY_ON_ID };
