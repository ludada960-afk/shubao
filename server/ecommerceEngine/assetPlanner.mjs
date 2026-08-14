import { getAssetPlanStrategy, normalizeEcommerceCategory } from './categoryKnowledge.mjs';
import { isCatalogIsolationRole } from './catalogIsolation.mjs';
import {
  commercialDutyIdFor,
  HERO_DUTIES,
  TRANSPARENT_DUTIES,
  WHITE_BACKGROUND_DUTIES,
} from './commercialDutyCatalog.mjs';
import { isFactGatedDetailRole, resolveDetailDuties } from './detailDutyPolicy.mjs';
import { layoutContractFor, textLayerPlanFor } from './layoutContracts.mjs';
import { LEGAL_IMAGE_SIZES, normalizeImageModel, resolveGenerationSize } from './modelCatalog.mjs';
import { getPlatformPolicy, planExportTargets } from './platformPolicies.mjs';
import { directShot } from './shotDirector.mjs';
import { compileTypographySystem } from './typographyPolicy.mjs';
import { normalizeCommerceContext } from './internationalCommerceRegistry.mjs';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SKU_FACT_FIELDS = [
  'color',
  'size',
  'capacity',
  'dimLabel',
  'material',
  'dimensions',
  'finish',
  'weight',
  'compatibility',
  'count',
];
const SKU_LABEL_FIELDS = ['label', 'variantName', 'skuLabel'];
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

function normalizeCategory(value) {
  return normalizeEcommerceCategory(cleanString(value));
}

function normalizeProofIds(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return uniqueStrings(values.map((proof) => isRecord(proof)
    ? ownValue(proof, 'assetId') ?? ownValue(proof, 'id')
    : proof));
}

function productIdentity(productTruth) {
  const productName = cleanString(ownValue(productTruth, 'productName'));
  return productName ? [{ name: 'productName', value: productName }] : [];
}

function normalizeSkus(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((sku) => {
    if (!isRecord(sku)) return [];
    const facts = SKU_FACT_FIELDS.flatMap((field) => {
      const value = cleanString(ownValue(sku, field));
      return value ? [{ name: field, value }] : [];
    });
    const explicitLabel = SKU_LABEL_FIELDS.map(field => cleanString(ownValue(sku, field))).find(Boolean) || '';
    if (!facts.some(fact => fact.name !== 'count')) return [];
    const fallbackLabel = facts.find(fact => ['color', 'size', 'capacity', 'dimLabel'].includes(fact.name))?.value;
    return [{ label: explicitLabel || fallbackLabel || `规格 ${facts.length + 1}`, facts }];
  });
}

function variantComparisonFor(skuRows) {
  if (skuRows.length < 2) return null;
  const valuesByName = new Map();
  for (const row of skuRows) {
    for (const fact of row.facts) {
      if (!valuesByName.has(fact.name)) valuesByName.set(fact.name, new Set());
      valuesByName.get(fact.name).add(fact.value);
    }
  }
  const differentiatingNames = new Set([...valuesByName]
    .filter(([, values]) => values.size > 1)
    .map(([name]) => name));
  if (!differentiatingNames.size) return null;
  return {
    variants: skuRows.map(row => ({
      label: row.label,
      facts: row.facts
        .filter(fact => differentiatingNames.has(fact.name))
        .map(fact => ({ ...fact })),
    })),
  };
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
    const targetRatio = cleanString(ownValue(image, 'targetRatio') ?? ownValue(image, 'target_ratio'));
    const cropPolicy = cleanString(ownValue(image, 'cropPolicy') ?? ownValue(image, 'crop_policy'));
    const hasCount = hasOwn(image, 'count');
    const rawCount = Number(ownValue(image, 'count'));
    const count = hasCount && Number.isFinite(rawCount)
      ? Math.max(0, Math.min(20, Math.trunc(rawCount)))
      : null;
    return [{ key, ratio, targetRatio, cropPolicy, count, hasCount }];
  });
  const hasExplicitCounts = normalizedImages.some(image => image.hasCount);
  const seen = new Set();
  return {
    resolution: Object.hasOwn(LEGAL_IMAGE_SIZES, resolution) ? resolution : '2K',
    imageModel: normalizeImageModel(ownValue(sizing, 'imageModel') ?? ownValue(sizing, 'image_model')),
    hasExplicitCounts,
    images: normalizedImages.flatMap((image) => {
      if (seen.has(image.key)) return [];
      if (hasExplicitCounts && (!image.hasCount || !COUNTED_SIZING_KEYS.has(image.key))) return [];
      seen.add(image.key);
      return [{
        key: image.key,
        ratio: image.ratio,
        targetRatio: image.targetRatio,
        cropPolicy: image.cropPolicy,
        count: image.count,
      }];
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

function directionRoleKeys(itemRole) {
  const role = cleanString(itemRole).toLowerCase();
  if (role.startsWith('detail_slice_')) return ['detail', role];
  if (role === 'white_background') return ['white_background', 'white_bg'];
  if (['main', 'main_text', 'main_3x4'].includes(role)) return [role, 'main'];
  return [role];
}

function directionDeliverableFor(campaignBible, itemRole) {
  const groups = Array.isArray(ownValue(campaignBible, 'deliverables'))
    ? ownValue(campaignBible, 'deliverables')
    : [];
  for (const key of directionRoleKeys(itemRole)) {
    const group = groups.find(candidate => isRecord(candidate) && safeKey(ownValue(candidate, 'role')).toLowerCase() === key);
    if (group) return group;
  }
  return null;
}

function shotSpecificationFor(shot) {
  const nested = isRecord(ownValue(shot, 'shotSpecification'))
    ? ownValue(shot, 'shotSpecification')
    : isRecord(ownValue(shot, 'generationSpecification') || ownValue(shot, 'generation_specification'))
      ? (ownValue(shot, 'generationSpecification') || ownValue(shot, 'generation_specification'))
      : shot;
  const read = (...keys) => keys.map(key => cleanString(ownValue(nested, key))).find(Boolean) || '';
  return {
    designGoal: read('designGoal', 'design_goal', 'objective', 'purpose'),
    visualStyle: read('visualStyle', 'visual_style', 'style'),
    scene: read('scene', 'scenario', 'scenePlan', 'scene_plan'),
    productFocus: read('productFocus', 'product_focus', 'productFidelity', 'product_fidelity'),
    composition: read('composition', 'layout', 'camera'),
    contentElements: read('contentElements', 'content_elements', 'content', 'elements'),
    copy: read('copy', 'copywriting', 'text', 'copy_content'),
    negativeConstraints: read('negativeConstraints', 'negative_constraints', 'constraints', 'prohibited'),
  };
}

function directionShotFor(campaignBible, itemRole, roleIndex) {
  const group = directionDeliverableFor(campaignBible, itemRole);
  const shots = Array.isArray(ownValue(group, 'shots')) ? ownValue(group, 'shots') : [];
  const shot = shots[roleIndex];
  if (!isRecord(shot)) return null;
  const label = cleanString(ownValue(shot, 'label'));
  if (!label) return null;
  return {
    label,
    purpose: cleanString(ownValue(shot, 'purpose')),
    visualExecution: cleanString(ownValue(shot, 'visualExecution')),
    variationKey: safeKey(ownValue(shot, 'variationKey')),
    dependsOn: uniqueStrings(ownValue(shot, 'dependsOn')),
    groupStrategy: cleanString(ownValue(group, 'groupStrategy')),
    shotSpecification: shotSpecificationFor(shot),
  };
}

function explicitMainRoles(sizing) {
  return ['main_text', 'main_3x4'].filter((role) => sizing.images.some((entry) => entry.key === role));
}

function configuredCount(sizing, ...keys) {
  const selection = sizing.images.find(entry => keys.includes(entry.key));
  return Number.isSafeInteger(selection?.count) && selection.count > 0 ? selection.count : 0;
}

function resolveRatioSelection(item, sizing, defaultRatio) {
  const exactSelection = sizing.images.find((entry) => entry.key === item.role);
  const aliasKeys = new Set(selectionKeys(item).filter((key) => key !== item.role));
  const selection = exactSelection || sizing.images.find((entry) => aliasKeys.has(entry.key));
  const candidate = selection?.ratio || defaultRatio;
  const ratio = Object.hasOwn(LEGAL_IMAGE_SIZES[sizing.resolution], candidate) ? candidate : defaultRatio;
  return {
    ratio,
    targetRatio: selection?.targetRatio || ratio,
    cropPolicy: selection?.cropPolicy || 'none',
  };
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
  if (isCatalogIsolationRole(role)) checks.push('shadow_free_catalog', 'clean_product_edges', 'complete_product');
  if (generationMode === 'deterministic_overlay') checks.push('deterministic_fact_overlay');
  if (role === 'detail_slice_qc') checks.push('proof_asset_traceability');
  if (role === 'sku') checks.push('sku_value_match');
  return checks;
}

function riskLevel(role) {
  if (isFactGatedDetailRole(role) || role === 'detail_slice_qc' || role === 'sku') return 'high';
  if (role === 'white_background') return 'medium';
  return 'low';
}

function skuVariantIdentity(skuFacts) {
  return {
    facts: skuFacts.map(({ name, value }) => ({ name, value }))
      .sort((left, right) => `${left.name}\u0000${left.value}`.localeCompare(`${right.name}\u0000${right.value}`)),
  };
}

function buildItem({ id: requestedId, role, purpose, commercialDutyKey, communicationGoal, defaultRatio = '3:4', requiredFacts, generationMode = 'edit', productAssetIds, styleReferenceIds, proofAssetIds = [], variantIdentity = null, variantComparison = null, category, platform, sizing }) {
  const roleDefaultRatio = role.startsWith('detail_slice_') ? '9:16' : defaultRatio;
  const ratioSelection = resolveRatioSelection({ role }, sizing, roleDefaultRatio);
  const resolvedGeneration = resolveGenerationSize({ imageModel: sizing.imageModel, resolution: sizing.resolution, ratio: ratioSelection.ratio });
  const ratio = resolvedGeneration.ratio;
  const targetRatio = ratioSelection.targetRatio || ratio;
  const cropPolicy = targetRatio === ratio ? 'none' : ratioSelection.cropPolicy;
  const generationSize = resolvedGeneration.size;
  const policy = getPlatformPolicy(platform, policyRole(role), category);
  const id = requestedId || role.replaceAll('_', '-');
  const exportTargets = planExportTargets(policy, {
    generationSize,
    ratio,
    assetPlanItemId: id,
  }).map(target => ({ ...target, targetRatio, cropPolicy }));
  return {
    id,
    role,
    purpose,
    commercialDutyId: commercialDutyIdFor(role, commercialDutyKey),
    ...(variantIdentity ? { variantIdentity } : {}),
    ...(variantComparison ? { variantComparison } : {}),
    communicationGoal,
    ratio,
    targetRatio,
    cropPolicy,
    platform,
    imageModel: sizing.imageModel,
    generationSize,
    exportTargets: role === 'transparent'
      ? exportTargets.filter(target => target.format === 'png')
      : exportTargets,
    generationMode,
    productAssetIds: [...productAssetIds],
    styleReferenceIds: isCatalogIsolationRole(role) ? [] : [...styleReferenceIds],
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

function explicitDetailSpecs(strategy, productTruth, count, proofAssetIds) {
  const specs = resolveDetailDuties({ strategy, productTruth, count }).map(duty => ({
    roleName: duty.roleName,
    commercialDutyKey: duty.dutyKey,
    purpose: duty.purpose,
    requiredFacts: duty.requiredFacts,
    evidenceType: duty.evidenceType,
    proofAssetIds: [],
  }));
  if (strategy.proofRole && proofAssetIds.length && !specs.some(spec => spec.roleName === strategy.proofRole)) {
    specs.push({
      roleName: strategy.proofRole,
      commercialDutyKey: 'proofanswer',
      purpose: 'Quality or certification information backed only by uploaded proof assets.',
      requiredFacts: [],
      evidenceType: '',
      proofAssetIds,
    });
  }
  return specs.length ? specs : [{
    roleName: 'feature',
    commercialDutyKey: 'buyeranswer',
    purpose: 'Answer one category-specific buying question.',
    requiredFacts: [],
    evidenceType: '',
    proofAssetIds: [],
  }];
}

/**
 * Create a deterministic, category-aware asset plan. Generation dimensions are
 * selected only from the legal model catalog; platform dimensions remain export
 * targets for deterministic post-processing.
 */
export function buildAssetPlan({ productTruth = {}, campaignBible = {}, platform = 'taobao', commerceContext, sizing = {}, skus = [], uploadedProofs = [], abilityRecipe = null, personMode = '' } = {}) {
  const truth = isRecord(productTruth) ? productTruth : {};
  const bible = isRecord(campaignBible) ? campaignBible : {};
  const category = normalizeCategory(ownValue(truth, 'category'));
  const strategy = getAssetPlanStrategy(category);
  const normalizedSizing = normalizeSizing(sizing);
  const productAssetIds = uniqueStrings(ownValue(truth, 'sourceAssetIds'));
  if (!productAssetIds.length) throw new TypeError('trusted product source asset is required for formal asset planning');
  const styleReferenceIds = uniqueStrings(ownValue(bible, 'referenceAssetIds'));
  const proofAssetIds = normalizeProofIds(uploadedProofs);
  const identity = productIdentity(truth);
  const hasCommerceContext = isRecord(commerceContext);
  const normalizedCommerceContext = normalizeCommerceContext(hasCommerceContext
    ? { ...commerceContext, platform: ownValue(commerceContext, 'platform') || platform }
    : { platform, targetLanguage: 'zh-CN' });
  const normalizedPlatform = normalizedCommerceContext.platform;
  const mainRoles = explicitMainRoles(normalizedSizing);
  const normalizedSkus = normalizeSkus(skus);
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
    const detailSpecs = explicitDetailSpecs(strategy, truth, detailCount, proofAssetIds);
    for (let index = 0; index < detailCount; index += 1) {
      const spec = detailSpecs[index % detailSpecs.length];
      const occurrence = Math.floor(index / detailSpecs.length) + 1;
      const role = `detail_slice_${spec.roleName}`;
      const isFactSlice = Boolean(spec.evidenceType);
      const isProofSlice = spec.proofAssetIds.length > 0;
      items.push(buildItem({
        id: occurrence === 1 ? role.replaceAll('_', '-') : `${role.replaceAll('_', '-')}-${occurrence}`,
        role,
        purpose: detailPurpose(spec.purpose, occurrence - 1),
        commercialDutyKey: spec.commercialDutyKey,
        communicationGoal: spec.purpose,
        requiredFacts: isProofSlice
          ? spec.proofAssetIds.map(assetId => ({ name: 'proofAssetId', value: assetId }))
          : isFactSlice ? spec.requiredFacts : identity,
        generationMode: isFactSlice || isProofSlice ? 'deterministic_overlay' : 'edit',
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
          communicationGoal: duty.communicationGoal,
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

    for (const duty of resolveDetailDuties({
      strategy,
      productTruth: truth,
      count: DEFAULT_DETAIL_DUTY_COUNT,
    })) {
      const role = `detail_slice_${duty.roleName}`;
      const isFactSlice = Boolean(duty.evidenceType);
      items.push(buildItem({
        role,
        purpose: duty.purpose,
        commercialDutyKey: duty.dutyKey,
        communicationGoal: duty.goal,
        requiredFacts: isFactSlice ? duty.requiredFacts : identity,
        generationMode: isFactSlice ? 'deterministic_overlay' : 'edit',
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

  const variantComparison = variantComparisonFor(normalizedSkus);
  if (variantComparison) {
    const replaceIndex = items.findLastIndex(item => item.role.startsWith('detail_slice_'));
    if (replaceIndex >= 0) {
      items[replaceIndex] = buildItem({
        id: 'detail-slice-variant-comparison',
        role: 'detail_slice_variant_comparison',
        purpose: 'Compare the confirmed differences between available variants so the buyer can choose the correct specification.',
        commercialDutyKey: 'variantcomparison',
        communicationGoal: 'Help the buyer compare confirmed variant dimensions, capacity, material, finish, weight, compatibility, color, or size without invented claims.',
        requiredFacts: [],
        generationMode: 'deterministic_overlay',
        productAssetIds,
        styleReferenceIds,
        variantComparison,
        category,
        platform: normalizedPlatform,
        sizing: normalizedSizing,
      });
    }
  }

  normalizedSkus.forEach((sku, index) => {
    const skuFacts = sku.facts;
    items.push(buildItem({
      id: `sku-${index + 1}`,
      role: 'sku',
      purpose: skuPurpose(skuFacts),
      commercialDutyKey: 'variant',
      communicationGoal: 'Help the buyer choose the confirmed SKU variant.',
      defaultRatio: '1:1',
      requiredFacts: skuFacts,
      generationMode: 'deterministic_overlay',
      productAssetIds,
      styleReferenceIds,
      variantIdentity: skuVariantIdentity(skuFacts),
      category,
      platform: normalizedPlatform,
      sizing: normalizedSizing,
    }));
  });

  const roleOccurrences = new Map();
  const directionRoleOccurrences = new Map();
  const typographySystem = hasCommerceContext && normalizedCommerceContext.targetLanguage !== 'visual'
    ? compileTypographySystem({ category, language: normalizedCommerceContext.locale })
    : isRecord(ownValue(bible, 'typographySystem'))
      ? ownValue(bible, 'typographySystem')
      : compileTypographySystem({ category, language: 'zh-CN' });
  const directedItems = items.map((item, itemIndex) => {
    const roleIndex = roleOccurrences.get(item.role) || 0;
    roleOccurrences.set(item.role, roleIndex + 1);
    const planRole = directionRoleKeys(item.role)[0];
    const planRoleIndex = directionRoleOccurrences.get(planRole) || 0;
    directionRoleOccurrences.set(planRole, planRoleIndex + 1);
    const plannedShot = directionShotFor(bible, item.role, planRoleIndex);
    const planningItem = {
      ...item,
      ...(plannedShot?.purpose ? {
        purpose: plannedShot.purpose,
        communicationGoal: plannedShot.purpose,
      } : {}),
      ...(plannedShot?.visualExecution ? { creativeExecution: plannedShot.visualExecution } : {}),
      ...(plannedShot?.variationKey ? { variationKey: plannedShot.variationKey } : {}),
      ...(plannedShot?.dependsOn?.length ? { dependsOn: [...plannedShot.dependsOn] } : {}),
      ...(plannedShot?.groupStrategy ? { groupStrategy: plannedShot.groupStrategy } : {}),
      ...(Object.keys(plannedShot?.shotSpecification || {}).length
        ? { shotSpecification: { ...plannedShot.shotSpecification } }
        : {}),
    };
    const shotIntent = directShot(planningItem, {
      productTruth: truth,
      campaignBible: bible,
      category,
      platform: normalizedPlatform,
      itemIndex,
      roleIndex,
    });
    const label = plannedShot?.label || shotIntent.label;
    const directedItem = {
      ...planningItem,
      label,
      shotIntent: {
        ...shotIntent,
        planLabel: label,
        plannedPurpose: plannedShot?.purpose || '',
        creativeExecution: plannedShot?.visualExecution || '',
        variationKey: plannedShot?.variationKey || '',
        dependsOn: plannedShot?.dependsOn ? [...plannedShot.dependsOn] : [],
        groupStrategy: plannedShot?.groupStrategy || '',
        productStrategy: isRecord(ownValue(bible, 'productStrategy'))
          ? { ...ownValue(bible, 'productStrategy') }
          : {},
        riskGuards: uniqueStrings(ownValue(bible, 'riskGuards')),
      },
    };
    const layoutContract = layoutContractFor(directedItem, {
      category,
      platform: normalizedPlatform,
    });
    const textLayerPlan = normalizedCommerceContext.targetLanguage === 'visual'
      ? {
          mode: 'no_text',
          editableLayersAvailable: false,
          requiresComposition: false,
          exactTextOnly: true,
          renderMarketingTextInImageModel: false,
          regions: [],
          typographySystem: { ...typographySystem, language: 'visual' },
        }
      : textLayerPlanFor(directedItem, { layoutContract, typographySystem });
    return {
      ...directedItem,
      commerceContext: { ...normalizedCommerceContext },
      layoutContract,
      textLayerPlan,
    };
  });

  const isTryOn = cleanString(ownValue(abilityRecipe, 'id')) === 'anything_tryon';
  const finalItems = isTryOn
    ? directedItems.map((item) => {
        const smartPerson = cleanString(personMode).toLowerCase() !== 'reference';
        const label = smartPerson ? '智能模特上身成片' : '参考模特上身成片';
        const creativeExecution = smartPerson
          ? '创建一位全新的虚构成年模特，以具有时尚感的完整全身构图自然穿着全部商品；保留每件服饰与配件的数量、颜色、材质、版型和搭配关系，使用具有电商表现力的姿态与场景，不添加任何文字。'
          : '以成年参考模特控制人物、姿态、镜头和场景连续性，把全部商品自然准确地穿到模特身上；保留每件服饰与配件的数量、颜色、材质、版型和搭配关系，完整展示从头到脚，不添加任何文字。';
        return {
          ...item,
          label,
          purpose: '把完整商品自然穿到成年模特身上，形成可直接用于电商展示的完整上身成片。',
          communicationGoal: '让买家一眼看清商品真实上身效果、完整搭配关系与场景表现力。',
          creativeExecution,
          variationKey: 'tryon-editorial-full-body',
          groupStrategy: '一张图只承担一个完整上身展示目的，不做规格表、拼贴、网格或文字信息层。',
          commerceContext: {
            ...item.commerceContext,
            contentType: 'tryon',
            targetLanguage: 'visual',
            locale: 'und',
          },
          shotSpecification: {
            visualStyle: 'High-fashion ecommerce editorial photography with natural commercial realism.',
            scene: 'Follow the approved user scene and preserve a coherent single environment.',
            composition: 'One adult model in a complete head-to-toe full-body frame; every garment and accessory remains fully visible with no crop, collage, grid, inset, or duplicated person.',
            copy: 'No text, labels, badges, captions, logos, pseudo-text, or decorative typography.',
          },
          layoutContract: {
            ...item.layoutContract,
            maxMarketingTextBlocks: 0,
            textRegions: [],
          },
          textLayerPlan: {
            ...item.textLayerPlan,
            mode: 'no_text',
            editableLayersAvailable: false,
            requiresComposition: false,
            exactTextOnly: true,
            renderMarketingTextInImageModel: false,
            regions: [],
          },
          shotIntent: {
            ...item.shotIntent,
            planLabel: label,
            plannedPurpose: '完整全身电商上身展示',
            creativeExecution,
            variationKey: 'tryon-editorial-full-body',
            groupStrategy: '单张完整成片',
          },
        };
      })
    : directedItems;

  return finalItems.sort((left, right) => left.id.localeCompare(right.id));
}
