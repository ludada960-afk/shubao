import { compileTypographySystem } from './typographyPolicy.mjs';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasOwn(record, key) {
  return Boolean(record) && typeof record === 'object' && !Array.isArray(record) && Object.hasOwn(record, key);
}

function ownValue(record, ...keys) {
  for (const key of keys) {
    if (hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStrings(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const result = [];
  const seen = new Set();

  for (const item of values) {
    const normalized = normalizeString(item);
    if (!normalized || UNSAFE_KEYS.has(normalized.toLowerCase()) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.min(20, Math.trunc(count))) : 0;
}

function normalizeShotSpecification(candidate) {
  const source = ownValue(candidate, 'shotSpecification', 'generationSpecification', 'generation_specification');
  const nested = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const fields = {
    designGoal: firstNonEmpty(
      ownValue(nested, 'designGoal', 'design_goal', 'objective'),
      ownValue(candidate, 'designGoal', 'design_goal', 'objective'),
    ),
    visualStyle: firstNonEmpty(
      ownValue(nested, 'visualStyle', 'visual_style'),
      ownValue(candidate, 'visualStyle', 'visual_style'),
    ),
    scene: firstNonEmpty(
      ownValue(nested, 'scene', 'scenario', 'scenePlan', 'scene_plan'),
      ownValue(candidate, 'scene', 'scenario', 'scenePlan', 'scene_plan'),
    ),
    productFocus: firstNonEmpty(
      ownValue(nested, 'productFocus', 'product_focus', 'productFidelity', 'product_fidelity'),
      ownValue(candidate, 'productFocus', 'product_focus', 'productFidelity', 'product_fidelity'),
    ),
    composition: firstNonEmpty(
      ownValue(nested, 'composition', 'layout', 'camera'),
      ownValue(candidate, 'composition', 'layout', 'camera'),
    ),
    contentElements: firstNonEmpty(
      ownValue(nested, 'contentElements', 'content_elements', 'content', 'elements'),
      ownValue(candidate, 'contentElements', 'content_elements', 'content', 'elements'),
    ),
    copy: firstNonEmpty(
      ownValue(nested, 'copy', 'copywriting', 'text', 'copy_content'),
      ownValue(candidate, 'copy', 'copywriting', 'text', 'copy_content'),
    ),
    negativeConstraints: firstNonEmpty(
      ownValue(nested, 'negativeConstraints', 'negative_constraints', 'constraints', 'prohibited'),
      ownValue(candidate, 'negativeConstraints', 'negative_constraints', 'constraints', 'prohibited'),
    ),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value));
}

function normalizeIndex(value, fallback) {
  const index = Number(value);
  return Number.isFinite(index) && index >= 0 ? Math.trunc(index) : fallback;
}

function normalizeShotManifest(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const label = firstNonEmpty(ownValue(candidate, 'label', 'title', 'name'));
    if (!label) return [];
    const shotSpecification = normalizeShotSpecification(candidate);
    return [{
      index: normalizeIndex(ownValue(candidate, 'index'), index),
      label,
      purpose: firstNonEmpty(ownValue(candidate, 'purpose', 'objective', 'communication_goal')),
      visualExecution: firstNonEmpty(
        ownValue(candidate, 'visualExecution', 'visual_execution', 'execution', 'description'),
      ),
      variationKey: firstNonEmpty(ownValue(candidate, 'variationKey', 'variation_key', 'variation')),
      dependsOn: normalizeStrings(ownValue(candidate, 'dependsOn', 'depends_on')),
      ...(Object.keys(shotSpecification).length ? { shotSpecification } : {}),
    }];
  }).slice(0, 20);
}

function normalizeDeliverables(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const role = firstNonEmpty(ownValue(candidate, 'role', 'key', 'id')).toLowerCase();
    const count = normalizeCount(ownValue(candidate, 'count'));
    if (!role || UNSAFE_KEYS.has(role) || count <= 0 || seen.has(role)) continue;
    seen.add(role);
    result.push({
      role,
      label: firstNonEmpty(ownValue(candidate, 'label', 'name')),
      count,
      ratio: firstNonEmpty(ownValue(candidate, 'ratio')),
      groupStrategy: firstNonEmpty(
        ownValue(candidate, 'groupStrategy', 'group_strategy', 'strategy'),
      ),
      shots: normalizeShotManifest(ownValue(candidate, 'shots', 'items')).slice(0, count),
    });
  }
  return result;
}

function isPaletteOrColorLock(lock) {
  const normalizedLock = lock.toLowerCase();
  return /\bpalette\b|\bcolors?\b/.test(normalizedLock);
}

/**
 * Compiles a selected visual direction into the shared campaign rules used by
 * every asset role. The direction title deliberately comes only from the
 * selected direction, while the second-step brief remains user-editable.
 */
export function compileCampaignBible(direction = {}, overrides = {}, styleReferenceProfile = {}) {
  const visualSystemCandidate = ownValue(direction, 'visualSystem', 'visual_system');
  const visualSystem = visualSystemCandidate && typeof visualSystemCandidate === 'object' && !Array.isArray(visualSystemCandidate)
    ? visualSystemCandidate
    : {};
  const productStrategyCandidate = ownValue(direction, 'productStrategy', 'product_strategy');
  const productStrategySource = productStrategyCandidate && typeof productStrategyCandidate === 'object' && !Array.isArray(productStrategyCandidate)
    ? productStrategyCandidate
    : {};
  const customColors = normalizeStrings(ownValue(overrides, 'customColors', 'custom_colors'));
  const directionPalette = normalizeStrings(
    ownValue(visualSystem, 'palette', 'colors')
      ?? ownValue(direction, 'palette', 'colors', 'preview_colors'),
  );
  const palette = customColors.length > 0
    ? customColors
    : directionPalette.length > 0
      ? directionPalette
      : normalizeStrings(ownValue(styleReferenceProfile, 'palette'));
  const consistencyLocks = normalizeStrings(ownValue(direction, 'consistencyLocks', 'consistency_locks'));
  const hasEditableBriefOverride = hasOwn(overrides, 'editableBrief') || hasOwn(overrides, 'editable_brief');
  const typographySystem = compileTypographySystem({
    category: normalizeString(ownValue(overrides, 'category')) || '其他',
    priceBand: normalizeString(ownValue(overrides, 'priceBand', 'price_band')),
    language: normalizeString(ownValue(overrides, 'language')) || 'zh-CN',
  });

  if (customColors.length > 0) {
    const canonicalPaletteLock = `palette: ${customColors.join(', ')}`;
    const nonPaletteLocks = consistencyLocks.filter((lock) => !isPaletteOrColorLock(lock));
    consistencyLocks.splice(0, consistencyLocks.length, ...nonPaletteLocks, canonicalPaletteLock);
  }

  return {
    schemaVersion: 2,
    directionId: firstNonEmpty(ownValue(direction, 'id', 'directionId', 'direction_id')),
    title: normalizeString(ownValue(direction, 'title')),
    editableBrief: hasEditableBriefOverride
      ? normalizeString(ownValue(overrides, 'editableBrief', 'editable_brief'))
      : firstNonEmpty(
          ownValue(direction, 'editableBrief', 'editable_brief', 'executionGuide', 'execution_guide', 'brief', 'description'),
        ),
    commercialObjective: firstNonEmpty(
      ownValue(direction, 'commercialObjective', 'commercial_objective', 'objective'),
      'conversion',
    ),
    audience: normalizeString(ownValue(direction, 'audience')),
    visualKeywords: normalizeStrings(ownValue(direction, 'visualKeywords', 'visual_keywords', 'keywords')),
    palette,
    lighting: firstNonEmpty(
      ownValue(visualSystem, 'lighting'),
      ownValue(direction, 'lighting'),
      ownValue(styleReferenceProfile, 'lighting'),
    ),
    composition: firstNonEmpty(
      ownValue(visualSystem, 'composition'),
      ownValue(direction, 'composition'),
      ownValue(styleReferenceProfile, 'composition'),
    ),
    cameraLanguage: firstNonEmpty(
      ownValue(visualSystem, 'cameraLanguage', 'camera_language'),
      ownValue(direction, 'cameraLanguage', 'camera_language'),
      ownValue(styleReferenceProfile, 'cameraLanguage', 'camera_language'),
    ),
    backgroundLanguage: firstNonEmpty(
      ownValue(visualSystem, 'backgroundLanguage', 'background_language'),
      ownValue(direction, 'backgroundLanguage', 'background_language'),
      ownValue(styleReferenceProfile, 'backgroundLanguage', 'background_language'),
    ),
    typographyIntent: firstNonEmpty(
      ownValue(visualSystem, 'typographyIntent', 'typography_intent'),
      ownValue(direction, 'typographyIntent', 'typography_intent'),
      ownValue(styleReferenceProfile, 'typographyIntent', 'typography_intent'),
    ),
    informationDensity: firstNonEmpty(
      ownValue(visualSystem, 'informationDensity', 'information_density'),
      ownValue(direction, 'informationDensity', 'information_density'),
      ownValue(styleReferenceProfile, 'informationDensity', 'information_density'),
    ),
    mood: firstNonEmpty(
      ownValue(visualSystem, 'mood'),
      ownValue(direction, 'mood'),
      ownValue(styleReferenceProfile, 'mood'),
    ),
    typographySystem,
    copyTone: firstNonEmpty(
      ownValue(visualSystem, 'copyTone', 'copy_tone'),
      ownValue(direction, 'copyTone', 'copy_tone'),
    ),
    productStrategy: {
      heroFocus: firstNonEmpty(ownValue(productStrategySource, 'heroFocus', 'hero_focus')),
      anglePlan: firstNonEmpty(ownValue(productStrategySource, 'anglePlan', 'angle_plan')),
      interactionPlan: firstNonEmpty(ownValue(productStrategySource, 'interactionPlan', 'interaction_plan')),
      scenarioPlan: firstNonEmpty(ownValue(productStrategySource, 'scenarioPlan', 'scenario_plan')),
    },
    deliverables: normalizeDeliverables(ownValue(direction, 'deliverables', 'imagePlan', 'image_plan')),
    riskGuards: normalizeStrings(ownValue(direction, 'riskGuards', 'risk_guards')),
    consistencyLocks,
    prohibitedStyles: normalizeStrings(ownValue(direction, 'prohibitedStyles', 'prohibited_styles')),
    prohibitedTransfers: normalizeStrings(
      ownValue(styleReferenceProfile, 'prohibitedTransfers', 'prohibited_transfers'),
    ),
    referenceAssetIds: normalizeStrings(
      ownValue(overrides, 'referenceAssetIds', 'reference_asset_ids')
        ?? ownValue(styleReferenceProfile, 'sourceAssetIds', 'source_asset_ids')
        ?? ownValue(direction, 'referenceAssetIds', 'reference_asset_ids'),
    ),
  };
}
