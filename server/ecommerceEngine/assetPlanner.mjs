import { createHash } from 'node:crypto';

import { getAssetPlanStrategy, normalizeEcommerceCategory } from './categoryKnowledge.mjs';
import {
  commercialDutyIdFor,
  HERO_DUTIES,
  TRANSPARENT_DUTIES,
  WHITE_BACKGROUND_DUTIES,
} from './commercialDutyCatalog.mjs';
import { layoutContractFor, textLayerPlanFor } from './layoutContracts.mjs';
import { LEGAL_IMAGE_SIZES } from './modelCatalog.mjs';
import { getPlatformPolicy, planExportTargets } from './platformPolicies.mjs';
import { directShot } from './shotDirector.mjs';
import { compileTypographySystem } from './typographyPolicy.mjs';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const FACT_FIELDS = ['color', 'size', 'capacity', 'dimLabel', 'count'];
const COUNTED_SIZING_KEYS = new Set(['white_bg', 'white_background', 'main_text', 'main_3x4', 'transparent', 'detail']);
const DEFAULT_DETAIL_DUTY_COUNT = 5;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record, key) {
  return isRecord(record) && Object.hasOwn(record, key);
}

function ownValue(record, key) {
  return hasOwn(record, key) ? record[key] : undefined;
}

function cleanString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function safeKey(value) {
  const key = cleanString(value);
  return key && !UNSAFE_KEYS.has(key.toLowerCase()) ? key : '';
}

function uniqueStrings(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const item of values) {
    const normalized = safeKey(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function ownEntries(value) {
  if (!isRecord(value)) return [];
  return Object.keys(value).flatMap((key) => {
    const normalized = safeKey(key);
    return normalized ? [[normalized, value[key]]] : [];
  });
}

function normalizeCategory(value) {
  return normalizeEcommerceCategory(cleanString(value));
}

function normalizeProofIds(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return uniqueStrings(values.map((proof) => isRecord(proof)
    ? ownValue(proof, 'assetId') ?? ownValue(proof, 'id')
    : proof));
}

function normalizeFact(name, value) {
  const normalizedName = safeKey(name);
  const source = isRecord(value) ? cleanString(ownValue(value, 'source')) : '';
  const factValue = cleanString(isRecord(value) ? ownValue(value, 'value') : value);
  return normalizedName && factValue && source === 'user'
    ? { name: normalizedName, value: factValue }
    : null;
}

function confirmedUserFacts(productTruth) {
  return ownEntries(ownValue(productTruth, 'confirmedFacts'))
    .map(([name, value]) => normalizeFact(name, value))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function productIdentity(productTruth) {
  const productName = cleanString(ownValue(productTruth, 'productName'));
  return productName ? [{ name: 'productName', value: productName }] : [];
}

function normalizeSkus(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sku) => {
    if (!isRecord(sku)) return [];
    const descriptiveFacts = FACT_FIELDS.slice(0, -1).flatMap((field) => {
      const value = cleanString(ownValue(sku, field));
      return value ? [{ name: field, value }] : [];
    });
    if (!descriptiveFacts.length) return [];
    const count = cleanString(ownValue(sku, 'count'));
    return [[...descriptiveFacts, ...(count ? [{ name: 'count', value: count }] : [])]];
  });
}

function normalizeSizing(value) {
  const sizing = isRecord(value) ? value : {};
  const resolution = safeKey(ownValue(sizing, 'resolution'));
  const images = Array.isArray(ownValue(sizing, 'images')) ? ownValue(sizing, 'images') : [];
  const normalizedImages = images.flatMap((image) => {
    if (!isRecord(image)) return [];
    const key = safeKey(ownValue(image, 'id') ?? ownValue(image, 'role') ?? ownValue(image, 'key'));
    if (!key || key === 'poster') return [];
    const ratio = cleanString(ownValue(image, 'ratio'));
    const hasCount = hasOwn(image, 'count');
    const rawCount = Number(ownValue(image, 'count'));
    const count = hasCount && Number.isFinite(rawCount)
      ? Math.max(0, Math.min(20, Math.trunc(rawCount)))
      : null;
    return [{ key, ratio, count, hasCount }];
  });
  const hasExplicitCounts = normalizedImages.some(image => image.hasCount);
  const seen = new Set();
  return {
    resolution: Object.hasOwn(LEGAL_IMAGE_SIZES, resolution) ? resolution : '2K',
    hasExplicitCounts,
    images: normalizedImages.flatMap((image) => {
      if (seen.has(image.key)) return [];
      if (hasExplicitCounts && (!image.hasCount || !COUNTED_SIZING_KEYS.has(image.key))) return [];
      seen.add(image.key);
      return [{ key: image.key, ratio: image.ratio, count: image.count }];
    }),
  };
}

function selectionKeys(item) {
  if (item.role === 'main') return ['main'];
  if (item.role === 'main_text') return ['main_text', 'main'];
  if (item.role === 'main_3x4') return ['main_3x4', 'main'];
  if (item.role === 'white_background') return ['white_background', 'white_bg'];
  if (item.role === 'sku') return ['sku'];
  if (item.role.startsWith('detail_slice_')) return ['detail', item.role];
  return [item.role];
}

function explicitMainRoles(sizing) {
  return ['main_text', 'main_3x4'].filter((role) => sizing.images.some((entry) => entry.key === role));
}

function configuredCount(sizing, ...keys) {
  const selection = sizing.images.find(entry => keys.includes(entry.key));
  return Number.isSafeInteger(selection?.count) && selection.count > 0 ? selection.count : 0;
}

function resolveRatio(item, sizing, defaultRatio) {
  const exactSelection = sizing.images.find((entry) => entry.key === item.role);
  const aliasKeys = new Set(selectionKeys(item).filter((key) => key !== item.role));
  const selection = exactSelection || sizing.images.find((entry) => aliasKeys.has(entry.key));
  const candidate = selection?.ratio || defaultRatio;
  return Object.hasOwn(LEGAL_IMAGE_SIZES[sizing.resolution], candidate) ? candidate : defaultRatio;
}

function policyRole(role) {
  if (role === 'main' || role === 'main_text' || role === 'main_3x4') return 'main';
  if (role === 'transparent') return 'transparent';
  if (role === 'white_background') return 'white_background';
  if (role === 'sku') return 'sku';
  return 'detail';
}

function qualityChecks(role, generationMode) {
  const checks = ['technical_dimensions', 'product_fidelity', 'platform_compliance'];
  if (generationMode === 'deterministic_overlay') checks.push('deterministic_fact_overlay');
  if (role === 'detail_slice_qc') checks.push('proof_asset_traceability');
  if (role === 'sku') checks.push('sku_value_match');
  return checks;
}

function riskLevel(role) {
  if (role === 'detail_slice_parameters' || role === 'detail_slice_qc' || role === 'sku') return 'high';
  if (role === 'white_background') return 'medium';
  return 'low';
}

function skuDutyKey(skuFacts) {
  const factFingerprint = createHash('sha256')
    .update(skuFacts.map(fact => `${fact.name}\u0000${fact.value}`).join('\u0001'))
    .digest('hex')
    .slice(0, 16);
  return `variant${factFingerprint}`;
}

function buildItem({ id: requestedId, role, purpose, commercialDutyKey, communicationGoal, defaultRatio = '3:4', requiredFacts, generationMode = 'edit', productAssetIds, styleReferenceIds, proofAssetIds = [], category, platform, sizing }) {
  const ratio = resolveRatio({ role }, sizing, defaultRatio);
  const generationSize = LEGAL_IMAGE_SIZES[sizing.resolution][ratio];
  const policy = getPlatformPolicy(platform, policyRole(role), category);
  const id = requestedId || role.replaceAll('_', '-');
  const exportTargets = planExportTargets(policy, {
    generationSize,
    ratio,
    assetPlanItemId: id,
  });
  return {
    id,
    role,
    purpose,
    commercialDutyId: commercialDutyIdFor(role, commercialDutyKey),
    communicationGoal,
    ratio,
    generationSize,
    exportTargets: role === 'transparent'
      ? exportTargets.filter(target => target.format === 'png')
      : exportTargets,
    generationMode,
    productAssetIds: [...productAssetIds],
    styleReferenceIds: role === 'transparent' ? [] : [...styleReferenceIds],
    proofAssetIds: [...proofAssetIds],
    requiredFacts: requiredFacts.map((fact) => ({ ...fact })),
    riskLevel: riskLevel(role),
    qualityChecks: qualityChecks(role, generationMode),
  };
}

function indexedItemId(role, index, count) {
  const base = role.replaceAll('_', '-');
  return count === 1 ? base : `${base}-${index + 1}`;
}

function appendRepeatedItems(items, count, createItem) {
  for (let index = 0; index < count; index += 1) {
    items.push(createItem(index, count));
  }
}

function heroDuty(role, index) {
  const placement = role === 'main_3x4'
    ? 'Vertical marketplace placement.'
    : role === 'main_text' ? 'Text-ready square marketplace placement.' : 'Primary marketplace placement.';
  const duty = HERO_DUTIES[index % HERO_DUTIES.length];
  return {
    key: duty.key,
    communicationGoal: `${placement} ${duty.goal}`,
    purpose: `${placement} ${duty.purpose}`,
  };
}

const VIEW_DIRECTIONS = [
  'front three-quarter view',
  'opposing three-quarter view',
  'straight-on front view',
  'evidence-supported side profile',
  'slightly elevated exterior view',
  'low eye-level exterior view',
  'rear three-quarter exterior view',
  'wide product-dominant view',
  'close product-dominant view',
  'balanced centered exterior view',
  'front profile with generous edge clearance',
  'opposing profile with generous edge clearance',
  'high three-quarter exterior view',
  'low three-quarter exterior view',
  'centered long-lens exterior view',
  'centered natural-lens exterior view',
  'diagonal exterior view with complete silhouette',
  'reverse diagonal exterior view with complete silhouette',
  'elevated centered view with complete geometry',
  'eye-level centered view with complete geometry',
];

function viewDirection(index) {
  return VIEW_DIRECTIONS[index % VIEW_DIRECTIONS.length];
}

function repeatedDuty(catalog, index) {
  return catalog[index % catalog.length];
}

function detailPurpose(basePurpose, occurrence) {
  if (occurrence === 0) return basePurpose;
  return `${basePurpose} Use a ${viewDirection(occurrence)} as a separate evidence-safe buyer answer.`;
}

function skuPurpose(skuFacts) {
  const variant = skuFacts.map(fact => `${fact.name}: ${fact.value}`).join(', ');
  return `SKU variant decision asset for ${variant}, using only the user-provided values.`;
}

function explicitDetailSpecs(strategy, proofAssetIds) {
  const specs = strategy.detailRoles.map((roleName, index) => ({
    roleName,
    commercialDutyKey: roleName,
    purpose: strategy.buyingQuestions[index] || 'Answer one category-specific buying question.',
    proofAssetIds: [],
  }));
  if (strategy.proofRole && proofAssetIds.length && !specs.some(spec => spec.roleName === strategy.proofRole)) {
    specs.push({
      roleName: strategy.proofRole,
      commercialDutyKey: 'proofanswer',
      purpose: 'Quality or certification information backed only by uploaded proof assets.',
      proofAssetIds,
    });
  }
  return specs.length ? specs : [{
    roleName: 'feature',
    commercialDutyKey: 'buyeranswer',
    purpose: 'Answer one category-specific buying question.',
    proofAssetIds: [],
  }];
}

/**
 * Create a deterministic, category-aware asset plan. Generation dimensions are
 * selected only from the legal model catalog; platform dimensions remain export
 * targets for deterministic post-processing.
 */
export function buildAssetPlan({ productTruth = {}, campaignBible = {}, platform = 'taobao', sizing = {}, skus = [], uploadedProofs = [] } = {}) {
  const truth = isRecord(productTruth) ? productTruth : {};
  const bible = isRecord(campaignBible) ? campaignBible : {};
  const category = normalizeCategory(ownValue(truth, 'category'));
  const strategy = getAssetPlanStrategy(category);
  const normalizedSizing = normalizeSizing(sizing);
  const productAssetIds = uniqueStrings(ownValue(truth, 'sourceAssetIds'));
  const styleReferenceIds = uniqueStrings(ownValue(bible, 'referenceAssetIds'));
  const proofAssetIds = normalizeProofIds(uploadedProofs);
  const identity = productIdentity(truth);
  const userFacts = confirmedUserFacts(truth);
  const normalizedPlatform = cleanString(platform) || 'taobao';
  const mainRoles = explicitMainRoles(normalizedSizing);
  const items = [];

  if (normalizedSizing.hasExplicitCounts) {
    for (const role of ['main_text', 'main_3x4']) {
      const count = configuredCount(normalizedSizing, role);
      appendRepeatedItems(items, count, (index, total) => {
        const duty = heroDuty(role, index);
        return buildItem({
          id: indexedItemId(role, index, total),
          role,
          purpose: duty.purpose,
          commercialDutyKey: duty.key,
          communicationGoal: duty.communicationGoal,
          defaultRatio: role === 'main_3x4' ? '3:4' : '1:1',
          requiredFacts: identity,
          productAssetIds,
          styleReferenceIds,
          category,
          platform: normalizedPlatform,
          sizing: normalizedSizing,
        });
      });
    }

    const whiteCount = configuredCount(normalizedSizing, 'white_background', 'white_bg');
    appendRepeatedItems(items, whiteCount, (index, total) => {
      const duty = repeatedDuty(WHITE_BACKGROUND_DUTIES, index);
      return buildItem({
        id: indexedItemId('white_background', index, total),
        role: 'white_background',
        purpose: duty.purpose,
        commercialDutyKey: duty.key,
        communicationGoal: duty.goal,
        defaultRatio: '1:1',
        requiredFacts: identity,
        productAssetIds,
        styleReferenceIds,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      });
    });

    const transparentCount = configuredCount(normalizedSizing, 'transparent');
    appendRepeatedItems(items, transparentCount, (index, total) => {
      const duty = repeatedDuty(TRANSPARENT_DUTIES, index);
      return buildItem({
        id: indexedItemId('transparent', index, total),
        role: 'transparent',
        purpose: duty.purpose,
        commercialDutyKey: duty.key,
        communicationGoal: duty.goal,
        defaultRatio: '1:1',
        requiredFacts: identity,
        productAssetIds,
        styleReferenceIds,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      });
    });

    const detailCount = configuredCount(normalizedSizing, 'detail');
    const detailSpecs = explicitDetailSpecs(strategy, proofAssetIds);
    for (let index = 0; index < detailCount; index += 1) {
      const spec = detailSpecs[index % detailSpecs.length];
      const occurrence = Math.floor(index / detailSpecs.length) + 1;
      const role = `detail_slice_${spec.roleName}`;
      const isParameterSlice = spec.roleName === 'parameters';
      const isProofSlice = spec.proofAssetIds.length > 0;
      items.push(buildItem({
        id: occurrence === 1 ? role.replaceAll('_', '-') : `${role.replaceAll('_', '-')}-${occurrence}`,
        role,
        purpose: detailPurpose(spec.purpose, occurrence - 1),
        commercialDutyKey: spec.commercialDutyKey,
        communicationGoal: spec.purpose,
        requiredFacts: isProofSlice
          ? spec.proofAssetIds.map(assetId => ({ name: 'proofAssetId', value: assetId }))
          : isParameterSlice ? userFacts : identity,
        generationMode: isParameterSlice || isProofSlice ? 'deterministic_overlay' : 'edit',
        productAssetIds,
        styleReferenceIds,
        proofAssetIds: spec.proofAssetIds,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      }));
    }
  } else {
    items.push(
      ...(mainRoles.length ? mainRoles : ['main']).map((role) => {
        const duty = heroDuty(role, 0);
        return buildItem({
          role,
          purpose: duty.purpose,
          commercialDutyKey: duty.key,
          communicationGoal: duty.goal,
          defaultRatio: role === 'main_3x4' ? '3:4' : '1:1',
          requiredFacts: identity,
          productAssetIds,
          styleReferenceIds,
          category,
          platform: normalizedPlatform,
          sizing: normalizedSizing,
        });
      }),
      (() => {
        const duty = WHITE_BACKGROUND_DUTIES[0];
        return buildItem({
          role: 'white_background',
          purpose: duty.purpose,
          commercialDutyKey: duty.key,
          communicationGoal: duty.goal,
          defaultRatio: '1:1',
          requiredFacts: identity,
          productAssetIds,
          styleReferenceIds,
          category,
          platform: normalizedPlatform,
          sizing: normalizedSizing,
        });
      })(),
    );

    for (const roleName of strategy.detailRoles.slice(0, DEFAULT_DETAIL_DUTY_COUNT)) {
      const role = `detail_slice_${roleName}`;
      const isParameterSlice = roleName === 'parameters';
      items.push(buildItem({
        role,
        purpose: strategy.buyingQuestions[strategy.detailRoles.indexOf(roleName)] || 'Answer one category-specific buying question.',
        commercialDutyKey: roleName,
        communicationGoal: strategy.buyingQuestions[strategy.detailRoles.indexOf(roleName)] || 'Answer one category-specific buying question.',
        requiredFacts: isParameterSlice ? userFacts : identity,
        generationMode: isParameterSlice ? 'deterministic_overlay' : 'edit',
        productAssetIds,
        styleReferenceIds,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      }));
    }

    if (strategy.proofRole && proofAssetIds.length) {
      items.push(buildItem({
        role: `detail_slice_${strategy.proofRole}`,
        purpose: 'Quality or certification information backed only by uploaded proof assets.',
        commercialDutyKey: 'proofanswer',
        communicationGoal: 'Quality or certification information backed only by uploaded proof assets.',
        requiredFacts: proofAssetIds.map((assetId) => ({ name: 'proofAssetId', value: assetId })),
        generationMode: 'deterministic_overlay',
        productAssetIds,
        styleReferenceIds,
        proofAssetIds,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      }));
    }
  }

  normalizeSkus(skus).forEach((skuFacts, index) => {
    items.push(buildItem({
      id: `sku-${index + 1}`,
      role: 'sku',
      purpose: skuPurpose(skuFacts),
      commercialDutyKey: skuDutyKey(skuFacts),
      communicationGoal: skuPurpose(skuFacts),
      defaultRatio: '1:1',
      requiredFacts: skuFacts,
      generationMode: 'deterministic_overlay',
      productAssetIds,
      styleReferenceIds,
      category,
      platform: normalizedPlatform,
      sizing: normalizedSizing,
    }));
  });

  const roleOccurrences = new Map();
  const typographySystem = isRecord(ownValue(bible, 'typographySystem'))
    ? ownValue(bible, 'typographySystem')
    : compileTypographySystem({ category, language: 'zh-CN' });
  const directedItems = items.map((item, itemIndex) => {
    const roleIndex = roleOccurrences.get(item.role) || 0;
    roleOccurrences.set(item.role, roleIndex + 1);
    const planningItem = { ...item };
    const shotIntent = directShot(planningItem, {
      productTruth: truth,
      campaignBible: bible,
      category,
      platform: normalizedPlatform,
      itemIndex,
      roleIndex,
    });
    const directedItem = { ...planningItem, label: shotIntent.label, shotIntent };
    const layoutContract = layoutContractFor(directedItem, {
      category,
      platform: normalizedPlatform,
    });
    return {
      ...directedItem,
      layoutContract,
      textLayerPlan: textLayerPlanFor(directedItem, { layoutContract, typographySystem }),
    };
  });

  return directedItems.sort((left, right) => left.id.localeCompare(right.id));
}
