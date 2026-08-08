import { createHash } from 'node:crypto';

import { validateGenerationSize } from './modelCatalog.mjs';
import { isKnownPlatform, normalizePlatformId } from './internationalCommerceRegistry.mjs';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);
const VERIFIED_AT = '2026-07-25';
export const PLATFORM_POLICY_REGISTRY_VERSION = VERIFIED_AT.replaceAll('-', '.');
export const EXPORT_TARGET_VERSION = 'asset-plan-target-v1';
const UNKNOWN_SOURCE_URL = 'https://www.gov.cn/';

const PLATFORM_SOURCES = Object.freeze({
  taobao: 'https://rulechannel.taobao.com/',
  tmall: 'https://rulechannel.tmall.com/',
  pinduoduo: 'https://mms.pinduoduo.com/',
  jd: 'https://rule.jd.com/',
  douyin: 'https://rulechannel.douyinec.com/',
  '1688': 'https://rulechannel.1688.com/',
  xiaohongshu: 'https://www.xiaohongshu.com/',
  kuaishou: 'https://www.kwaixiaodian.com/',
  'alibaba-international': 'https://seller.alibaba.com/',
  amazon: 'https://sellercentral.amazon.com/help/hub/reference/G200210150',
  'amazon-aplus-wide': 'https://developer-docs.amazon.com/sp-api/lang-en_US/docs/create-edit-publish-aplus-content',
  temu: 'https://seller.temu.com/',
  ebay: 'https://www.ebay.com/help/selling/listings/listing-best-practices?id=4148',
  shein: 'https://open.sheincorp.com/',
  shopee: 'https://seller.shopee.com/',
  lazada: 'https://sellercenter.lazada.com/',
  'tiktok-shop': 'https://seller-us.tiktok.com/university/',
  ozon: 'https://seller-edu.ozon.ru/',
});

const ROLE_POLICIES = Object.freeze({
  main: Object.freeze({
    recommendedCount: 1,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['jpg', 'png'],
    backgroundPolicy: 'Use a clean product-first background; confirm the active category rule before publishing.',
    textPolicy: 'Keep promotional copy and watermarks out unless the current category rule explicitly permits them.',
    requiredFacts: ['product identity'],
  }),
  white_background: Object.freeze({
    recommendedCount: 1,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['jpg', 'png'],
    backgroundPolicy: 'Use uniform pure white #FFFFFF with the complete product fully visible, clean antialiased edges, and no cast shadow, contact shadow, reflection, floor, horizon, gradient, props, or backdrop seam.',
    textPolicy: 'Do not add generated labels, claims, or watermarks.',
    requiredFacts: ['product identity'],
  }),
  transparent: Object.freeze({
    recommendedCount: 1,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['png'],
    backgroundPolicy: 'Use real transparent alpha with the complete product only, clean antialiased edges, and no cast shadow, contact shadow, reflection, matte, halo, scene, surface, backdrop, or opaque fill.',
    textPolicy: 'Do not add generated text, promotional copy, labels, watermarks, borders, props, or campaign graphics.',
    requiredFacts: ['product identity'],
  }),
  detail: Object.freeze({
    recommendedCount: 5,
    allowedRatios: ['9:16', '3:4', '1:1'],
    exportSizes: [{ width: 720, height: 1280 }, { width: 750, height: 1000 }, { width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['jpg', 'png'],
    backgroundPolicy: 'Use a background that supports the buying question for the detail section.',
    textPolicy: 'Apply user-confirmed facts through deterministic layout rather than generated image text.',
    requiredFacts: ['product identity'],
  }),
  sku: Object.freeze({
    recommendedCount: 3,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['jpg', 'png'],
    backgroundPolicy: 'Keep the SKU variant visually distinct with a product-first background.',
    textPolicy: 'Only render user-confirmed SKU values in deterministic overlays.',
    requiredFacts: ['product identity', 'sku values'],
  }),
  all: Object.freeze({
    recommendedCount: 1,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 800, height: 800 }],
    maxFileBytes: 5_000_000,
    formats: ['jpg'],
    backgroundPolicy: 'Use a conservative product-first background and verify current platform guidance before publishing.',
    textPolicy: 'Avoid unverified generated text, promotions, watermarks, and claims.',
    requiredFacts: ['product identity'],
  }),
});

const PLATFORM_POLICY_REGISTRY = Object.freeze(Object.fromEntries(
  Object.entries(PLATFORM_SOURCES).map(([platform, sourceUrl]) => [platform, Object.freeze({
    sourceUrl,
    roles: ROLE_POLICIES,
    categories: Object.freeze({
      beauty: Object.freeze({
        main: Object.freeze({
          recommendedCount: 1,
          requiredFacts: ['product identity', 'user-confirmed shade or variant'],
          backgroundPolicy: 'Use a clean product-first background; beauty-category presentation requirements must be checked at publication time.',
        }),
      }),
    }),
  })]),
));

function normalizeKey(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized && !UNSAFE_KEYS.has(normalized) ? normalized : '';
}

function hasOwn(record, key) {
  return Boolean(record) && typeof record === 'object' && !Array.isArray(record) && Object.hasOwn(record, key);
}

function ownValue(record, key) {
  return hasOwn(record, key) ? record[key] : undefined;
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeRatio(value) {
  if (typeof value !== 'string') return '';
  const match = /^(\d+)\s*:\s*(\d+)$/.exec(value.trim());
  if (!match) return '';
  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? `${width}:${height}` : '';
}

function uniqueStrings(values, normalize = (value) => normalizeString(value)) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeExportSizes(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const width = Number(value?.width);
    const height = Number(value?.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) continue;
    const key = `${width}x${height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ width, height });
  }
  return result;
}

function normalizeRequiredFacts(values) {
  return uniqueStrings(values);
}

function policyFrom(entry, { platform, role, categoryScope, sourceUrl, confidence = 'medium', enforcement = 'recommendation' }, fallback = ROLE_POLICIES.all) {
  const allowedRatios = uniqueStrings(ownValue(entry, 'allowedRatios') ?? fallback.allowedRatios, normalizeRatio);
  const exportSizes = normalizeExportSizes(ownValue(entry, 'exportSizes') ?? fallback.exportSizes);
  const formats = uniqueStrings(ownValue(entry, 'formats') ?? fallback.formats, (value) => {
    const normalized = normalizeKey(value).replace(/^_+/, '');
    return ['jpg', 'jpeg', 'png', 'webp'].includes(normalized) ? normalized : '';
  });
  const maxFileBytes = Number(ownValue(entry, 'maxFileBytes') ?? fallback.maxFileBytes);
  const recommendedCount = ownValue(entry, 'recommendedCount');

  return {
    platform,
    categoryScope,
    role,
    recommendedCount: Number.isInteger(recommendedCount) && recommendedCount > 0
      ? recommendedCount
      : fallback.recommendedCount,
    allowedRatios: allowedRatios.length ? allowedRatios : [...fallback.allowedRatios],
    exportSizes: exportSizes.length ? exportSizes : normalizeExportSizes(fallback.exportSizes),
    maxFileBytes: Number.isInteger(maxFileBytes) && maxFileBytes > 0 ? maxFileBytes : fallback.maxFileBytes,
    formats: formats.length ? formats : [...fallback.formats],
    backgroundPolicy: normalizeString(ownValue(entry, 'backgroundPolicy'), fallback.backgroundPolicy),
    textPolicy: normalizeString(ownValue(entry, 'textPolicy'), fallback.textPolicy),
    requiredFacts: normalizeRequiredFacts(ownValue(entry, 'requiredFacts') ?? fallback.requiredFacts),
    sourceUrl: normalizeString(sourceUrl, UNKNOWN_SOURCE_URL),
    verifiedAt: VERIFIED_AT,
    confidence: CONFIDENCE_LEVELS.has(confidence) ? confidence : 'low',
    enforcement: enforcement === 'hard' && confidence === 'high' ? 'hard' : 'recommendation',
  };
}

/**
 * Returns a fresh policy. Platform documentation changes by category and login
 * state, so this registry deliberately exposes those entries as recommendations
 * until a stable, explicitly verified requirement is recorded.
 */
export function getPlatformPolicy(platform, role = 'main', category = 'all') {
  const platformKey = isKnownPlatform(platform) ? normalizePlatformId(platform) : normalizeKey(platform);
  const roleKey = normalizeKey(role) || 'all';
  const categoryKey = normalizeKey(category) || 'all';
  const platformRegistry = Object.hasOwn(PLATFORM_POLICY_REGISTRY, platformKey)
    ? PLATFORM_POLICY_REGISTRY[platformKey]
    : undefined;

  if (!platformRegistry) {
    return policyFrom(ROLE_POLICIES.all, {
      platform: platformKey || 'unknown',
      role: roleKey,
      categoryScope: 'all',
      sourceUrl: UNKNOWN_SOURCE_URL,
      confidence: 'low',
      enforcement: 'recommendation',
    });
  }

  const categoryPolicies = Object.hasOwn(platformRegistry.categories, categoryKey)
    ? platformRegistry.categories[categoryKey]
    : undefined;
  const categoryEntry = categoryPolicies && Object.hasOwn(categoryPolicies, roleKey)
    ? categoryPolicies[roleKey]
    : undefined;
  const roleEntry = Object.hasOwn(platformRegistry.roles, roleKey)
    ? platformRegistry.roles[roleKey]
    : undefined;

  return policyFrom(categoryEntry ?? roleEntry ?? platformRegistry.roles.all, {
    platform: platformKey,
    role: categoryEntry ? roleKey : roleEntry ? roleKey : 'all',
    categoryScope: categoryEntry ? categoryKey : 'all',
    sourceUrl: platformRegistry.sourceUrl,
    confidence: 'medium',
    enforcement: 'recommendation',
  }, categoryEntry ? roleEntry ?? platformRegistry.roles.all : ROLE_POLICIES.all);
}

function parseGenerationSize(value) {
  if (typeof value !== 'string') throw new TypeError('generationSize must be a legal WIDTHxHEIGHT string');
  validateGenerationSize(value);
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  return { width: Number(match[1]), height: Number(match[2]) };
}

function ratioForDimensions(width, height) {
  const greatestCommonDivisor = (left, right) => (right === 0 ? left : greatestCommonDivisor(right, left % right));
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function exportPolicyVersion(value) {
  const verifiedAt = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(verifiedAt)
    ? verifiedAt.replaceAll('-', '.')
    : /^\d{4}\.\d{2}(?:\.\d{2})?$/.test(verifiedAt)
      ? verifiedAt
      : PLATFORM_POLICY_REGISTRY_VERSION;
}

function canonicalExportTarget(target, policyVersion) {
  const assetPlanItemId = normalizeString(target.assetPlanItemId);
  return {
    platform: target.platform,
    categoryScope: target.categoryScope,
    role: target.role,
    ratio: target.ratio,
    width: target.width,
    height: target.height,
    format: target.format,
    maxFileBytes: target.maxFileBytes,
    fit: target.fit,
    policyVersion,
    targetVersion: EXPORT_TARGET_VERSION,
    ...(assetPlanItemId ? { assetPlanItemId } : {}),
  };
}

export function versionExportTarget(target, { policyVersion } = {}) {
  const canonical = canonicalExportTarget(
    target,
    exportPolicyVersion(policyVersion ?? target?.policyVersion),
  );
  const fingerprint = createHash('sha256')
    .update(`${EXPORT_TARGET_VERSION}\0${JSON.stringify(canonical)}`)
    .digest('hex');
  const targetId = `et_${createHash('sha256')
    .update(`target-id\0${fingerprint}`)
    .digest('hex')}`;
  return {
    ...canonical,
    fingerprint,
    targetId,
  };
}

export function verifyVersionedExportTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return false;
  const expected = versionExportTarget(target, { policyVersion: target.policyVersion });
  return target.targetVersion === expected.targetVersion
    && target.fingerprint === expected.fingerprint
    && target.targetId === expected.targetId;
}

function resolveExportInputs(policyOrOptions, generation = {}) {
  if (policyOrOptions && typeof policyOrOptions === 'object' && Object.hasOwn(policyOrOptions, 'policy')) {
    return { policy: policyOrOptions.policy, generation: policyOrOptions };
  }
  if (typeof policyOrOptions === 'string') {
    return {
      policy: getPlatformPolicy(policyOrOptions, ownValue(generation, 'role'), ownValue(generation, 'category')),
      generation,
    };
  }
  return { policy: policyOrOptions, generation };
}

/**
 * Converts one already-legal generation source into output-only resize/crop
 * targets. The returned objects contain no model size, so platform pixels are
 * consumed solely by deterministic post-processing.
 */
export function planExportTargets(policyOrOptions, generation = {}) {
  const resolved = resolveExportInputs(policyOrOptions, generation);
  const source = resolved.generation && typeof resolved.generation === 'object' ? resolved.generation : {};
  const sourceDimensions = parseGenerationSize(ownValue(source, 'generationSize') ?? ownValue(source, 'size'));
  const sourceRatio = ratioForDimensions(sourceDimensions.width, sourceDimensions.height);
  const requestedRatio = normalizeRatio(ownValue(source, 'ratio'));

  if (requestedRatio && requestedRatio !== sourceRatio) {
    throw new RangeError('generation ratio must match generationSize');
  }

  const policy = policyFrom(resolved.policy, {
    platform: normalizeKey(ownValue(resolved.policy, 'platform')) || 'unknown',
    role: normalizeKey(ownValue(resolved.policy, 'role')) || 'all',
    categoryScope: normalizeKey(ownValue(resolved.policy, 'categoryScope')) || 'all',
    sourceUrl: ownValue(resolved.policy, 'sourceUrl'),
    confidence: ownValue(resolved.policy, 'confidence'),
    enforcement: ownValue(resolved.policy, 'enforcement'),
  });
  const targetRatio = policy.allowedRatios.includes(sourceRatio) ? sourceRatio : policy.allowedRatios[0];
  const matchingSizes = policy.exportSizes.filter(({ width, height }) => ratioForDimensions(width, height) === targetRatio);
  const sizes = matchingSizes.length ? matchingSizes : policy.exportSizes;

  return sizes.flatMap(({ width, height }) => policy.formats.map((format) => versionExportTarget({
    platform: policy.platform,
    categoryScope: policy.categoryScope,
    role: policy.role,
    ratio: targetRatio,
    width,
    height,
    format,
    maxFileBytes: policy.maxFileBytes,
    fit: sourceRatio === targetRatio ? 'inside' : 'cover',
    assetPlanItemId: ownValue(source, 'assetPlanItemId'),
  }, { policyVersion: policy.verifiedAt })));
}
