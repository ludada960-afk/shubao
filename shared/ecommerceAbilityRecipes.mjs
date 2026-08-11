const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,255}$/i;
const RECIPE_ID_RE = /^[a-z][a-z0-9_-]{1,63}$/;
const PERSON_MODES = new Set(['smart', 'reference']);

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

function freezeDeep(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}

const RAW_RECIPES = [
  {
    id: 'product_suite',
    version: 1,
    label: '商品套图',
    summary: '保留商品事实，生成一整套可交付的电商视觉',
    preserves: ['商品结构、材质、颜色和包装信息'],
    outcome: '主图、详情图、白底图与场景化商品视觉',
    bestFor: ['商品上新', '平台套图', '详情页素材'],
    inputSlots: [
      { id: 'product', label: '商品素材', min: 0, max: 6, required: false, accept: 'image/*' },
      { id: 'reference', label: '参考图', min: 0, max: 50, required: false, accept: 'image/*' },
    ],
    outputProfile: {
      kind: 'commerce_suite',
      allowedRatios: ['1:1', '3:4', '4:3', '9:16'],
    },
    routePolicy: { provider: 'ecommerce-image-edit', specializedProvider: null },
    promptPolicyId: 'product_suite_v1',
    examples: [
      {
        id: 'product-suite-studio',
        inputAssetUrls: ['/images/home/entry-ecommerce.png'],
        outputAssetUrls: ['/images/home/entry-ecommerce.png'],
        caption: '商品素材 -> 整套电商视觉',
      },
    ],
  },
  {
    id: 'anything_tryon',
    version: 1,
    label: '万物上身',
    summary: '把商品组合到模特身上，生成可用于电商展示的穿搭画面',
    preserves: ['商品颜色、材质、结构、图案和数量'],
    outcome: '自然穿搭、真实接触阴影与场景化商品视觉',
    bestFor: ['上新主图', '穿搭展示', '场景化商品图'],
    inputSlots: [
      { id: 'items', label: '商品与穿搭', min: 1, max: 5, required: true, accept: 'image/*' },
      { id: 'person', label: '模特参考', min: 0, max: 1, required: false, accept: 'image/*' },
      { id: 'scene', label: '场景参考', min: 0, max: 1, required: false, accept: 'image/*' },
    ],
    outputProfile: {
      kind: 'commerce_suite',
      allowedRatios: ['1:1', '3:4', '4:5', '9:16'],
    },
    routePolicy: { provider: 'ecommerce-image-edit', specializedProvider: null },
    promptPolicyId: 'anything_tryon_v1',
    examples: [
      {
        id: 'tryon-input-output',
        inputAssetUrls: ['/images/home/tryon-showcase-angles.png'],
        outputAssetUrls: ['/images/home/tryon-showcase-reference.png'],
        caption: '商品组合与模特参考 -> 多角度自然上身',
      },
    ],
  },
];

export const ECOMMERCE_ABILITY_RECIPES = Object.freeze(RAW_RECIPES.map(recipe => freezeDeep(recipe)));

const RECIPE_INDEX = new Map(ECOMMERCE_ABILITY_RECIPES.map(recipe => [recipe.id, recipe]));

function normalizeRecipeId(value) {
  const id = cleanString(value) || 'product_suite';
  if (!RECIPE_ID_RE.test(id)) throw new TypeError('ecommerce ability recipe id is invalid');
  return id;
}

export function getEcommerceAbilityRecipe(id = 'product_suite', version = null) {
  const normalizedId = normalizeRecipeId(id);
  const recipe = RECIPE_INDEX.get(normalizedId);
  if (!recipe) throw new TypeError(`unknown ecommerce ability recipe: ${normalizedId}`);
  if (version !== null && version !== undefined && Number(version) !== recipe.version) {
    throw new TypeError(`unsupported ecommerce ability recipe version: ${normalizedId}@${version}`);
  }
  return recipe;
}

function normalizeAssetId(value) {
  const assetId = cleanString(value);
  if (!assetId || !SAFE_ID_RE.test(assetId) || UNSAFE_KEYS.has(assetId.toLowerCase())) {
    throw new TypeError('ecommerce asset id is invalid');
  }
  return assetId;
}

function normalizeAsset(value, group, index) {
  if (!isRecord(value)) throw new TypeError(`${group} asset ${index + 1} is invalid`);
  const assetId = normalizeAssetId(own(value, 'assetId', 'id', 'sourceAssetId'));
  const result = {};
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key.toLowerCase())) continue;
    const candidate = value[key];
    if (typeof candidate === 'function' || typeof candidate === 'symbol') continue;
    result[key] = candidate;
  }
  return { ...result, assetId };
}

function normalizeAssetGroup(value, group) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${group} assets must be an array`);
  return value.map((asset, index) => normalizeAsset(asset, group, index));
}

function firstDefinedArray(record, keys, label) {
  for (const key of keys) {
    if (isRecord(record) && Object.hasOwn(record, key)) return normalizeAssetGroup(record[key], label);
  }
  return [];
}

function recipeInput(input) {
  const descriptor = own(input, 'ability_recipe', 'abilityRecipe');
  if (descriptor === undefined || descriptor === null) return { id: 'product_suite', version: null };
  if (!isRecord(descriptor)) throw new TypeError('ability recipe must be an object');
  return {
    id: own(descriptor, 'id') ?? 'product_suite',
    version: own(descriptor, 'version') ?? null,
  };
}

function roleManifest(input) {
  const value = own(input, 'asset_roles', 'assetRoles');
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new TypeError('asset roles must be an array');
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new TypeError(`asset role ${index + 1} is invalid`);
    const assetId = normalizeAssetId(own(entry, 'assetId', 'asset_id', 'id'));
    const role = cleanString(own(entry, 'role'));
    const ordinal = own(entry, 'ordinal');
    if (!role) throw new TypeError(`asset role ${index + 1} is invalid`);
    if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
      throw new TypeError(`asset role ordinal is invalid for ${assetId}`);
    }
    return { assetId, role, ordinal };
  });
}

function groupKeys(recipeId, slotId) {
  if (recipeId === 'anything_tryon' && slotId === 'items') return ['items', 'product', 'products'];
  if (slotId === 'product') return ['product', 'products'];
  if (slotId === 'reference') return ['reference', 'references', 'style'];
  return [slotId, `${slotId}s`];
}

function normalizeGroups(input, recipe) {
  const assets = isRecord(own(input, 'assets')) ? own(input, 'assets') : {};
  const result = {};
  for (const slot of recipe.inputSlots) {
    result[slot.id] = firstDefinedArray(assets, groupKeys(recipe.id, slot.id), slot.id);
  }
  return result;
}

function validateUniqueAssets(slotAssets) {
  const seen = new Set();
  for (const [slotId, assets] of Object.entries(slotAssets)) {
    for (const asset of assets) {
      if (seen.has(asset.assetId)) throw new TypeError(`duplicate asset id: ${asset.assetId}`);
      seen.add(asset.assetId);
    }
  }
}

function validateSlotCounts(recipe, slotAssets, personMode) {
  for (const slot of recipe.inputSlots) {
    const assets = slotAssets[slot.id] || [];
    const minimum = recipe.id === 'anything_tryon' && slot.id === 'person' && personMode === 'smart'
      ? 0
      : slot.min;
    if (assets.length < minimum) throw new TypeError(`${recipe.id} requires at least ${minimum} asset in ${slot.id}`);
    if (assets.length > slot.max) throw new TypeError(`${recipe.id} allows at most ${slot.max} asset in ${slot.id}`);
  }
}

function manifestForGroups(recipe, slotAssets, suppliedManifest) {
  const allowedRoles = new Set(recipe.inputSlots.map(slot => slot.id));
  const allAssets = new Map();
  for (const [slotId, assets] of Object.entries(slotAssets)) {
    for (const [index, asset] of assets.entries()) {
      allAssets.set(asset.assetId, { asset, role: slotId, ordinal: index });
    }
  }

  if (suppliedManifest) {
    const seenIds = new Set();
    const seenSlots = new Set();
    const ordered = Object.fromEntries(recipe.inputSlots.map(slot => [slot.id, []]));
    for (const entry of suppliedManifest) {
      if (!allowedRoles.has(entry.role)) throw new TypeError(`asset role is not allowed: ${entry.role}`);
      const slotKey = `${entry.role}:${entry.ordinal}`;
      if (seenSlots.has(slotKey)) throw new TypeError(`duplicate asset role ordinal: ${slotKey}`);
      if (seenIds.has(entry.assetId)) throw new TypeError(`duplicate asset id: ${entry.assetId}`);
      const found = allAssets.get(entry.assetId);
      if (!found) throw new TypeError(`asset role asset is missing from assets: ${entry.assetId}`);
      if (found.role !== entry.role || entry.ordinal >= slotAssets[entry.role].length) {
        throw new TypeError(`asset role does not match asset group: ${entry.assetId}`);
      }
      ordered[entry.role][entry.ordinal] = found.asset;
      seenSlots.add(slotKey);
      seenIds.add(entry.assetId);
    }
    if (seenIds.size !== allAssets.size) throw new TypeError('asset roles must describe every supplied asset');
    for (const slot of recipe.inputSlots) {
      if (ordered[slot.id].some(asset => !asset)) {
        throw new TypeError(`asset roles must use continuous ordinals in ${slot.id}`);
      }
    }
    slotAssets = ordered;
  }

  return {
    slotAssets,
    assetRoles: recipe.inputSlots.flatMap(slot => (slotAssets[slot.id] || []).map((asset, ordinal) => ({
      assetId: asset.assetId,
      role: slot.id,
      ordinal,
    }))),
  };
}

export function normalizeEcommerceAbilityRequest(input = {}) {
  if (!isRecord(input)) throw new TypeError('ecommerce ability request must be an object');
  const descriptor = recipeInput(input);
  const recipe = getEcommerceAbilityRecipe(descriptor.id, descriptor.version);
  const slotAssets = normalizeGroups(input, recipe);
  validateUniqueAssets(slotAssets);
  const requestedPersonMode = cleanString(own(input, 'person_mode', 'personMode')).toLowerCase();
  if (requestedPersonMode && !PERSON_MODES.has(requestedPersonMode)) {
    throw new TypeError(`person mode is invalid: ${requestedPersonMode}`);
  }
  const personMode = recipe.id === 'anything_tryon'
    ? requestedPersonMode || (slotAssets.person.length ? 'reference' : 'smart')
    : null;
  if (personMode === 'smart' && slotAssets.person.length) {
    throw new TypeError('smart person mode cannot include a person asset');
  }
  validateSlotCounts(recipe, slotAssets, personMode);
  const suppliedManifest = roleManifest(input);
  const normalizedManifest = manifestForGroups(recipe, slotAssets, suppliedManifest);
  return {
    recipe,
    personMode,
    assetRoles: normalizedManifest.assetRoles,
    slotAssets: normalizedManifest.slotAssets,
  };
}
