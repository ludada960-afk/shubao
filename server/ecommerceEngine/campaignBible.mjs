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
  const customColors = normalizeStrings(ownValue(overrides, 'customColors', 'custom_colors'));
  const directionPalette = normalizeStrings(ownValue(direction, 'palette', 'colors', 'preview_colors'));
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
    directionId: firstNonEmpty(ownValue(direction, 'id', 'directionId', 'direction_id')),
    title: normalizeString(ownValue(direction, 'title')),
    editableBrief: hasEditableBriefOverride
      ? normalizeString(ownValue(overrides, 'editableBrief', 'editable_brief'))
      : firstNonEmpty(ownValue(direction, 'editableBrief', 'editable_brief', 'brief', 'description')),
    commercialObjective: firstNonEmpty(
      ownValue(direction, 'commercialObjective', 'commercial_objective', 'objective'),
      'conversion',
    ),
    audience: normalizeString(ownValue(direction, 'audience')),
    visualKeywords: normalizeStrings(ownValue(direction, 'visualKeywords', 'visual_keywords', 'keywords')),
    palette,
    lighting: firstNonEmpty(
      ownValue(direction, 'lighting'),
      ownValue(styleReferenceProfile, 'lighting'),
    ),
    composition: firstNonEmpty(
      ownValue(direction, 'composition'),
      ownValue(styleReferenceProfile, 'composition'),
    ),
    cameraLanguage: firstNonEmpty(
      ownValue(direction, 'cameraLanguage', 'camera_language'),
      ownValue(styleReferenceProfile, 'cameraLanguage', 'camera_language'),
    ),
    backgroundLanguage: firstNonEmpty(
      ownValue(direction, 'backgroundLanguage', 'background_language'),
      ownValue(styleReferenceProfile, 'backgroundLanguage', 'background_language'),
    ),
    typographyIntent: firstNonEmpty(
      ownValue(direction, 'typographyIntent', 'typography_intent'),
      ownValue(styleReferenceProfile, 'typographyIntent', 'typography_intent'),
    ),
    informationDensity: firstNonEmpty(
      ownValue(direction, 'informationDensity', 'information_density'),
      ownValue(styleReferenceProfile, 'informationDensity', 'information_density'),
    ),
    mood: firstNonEmpty(
      ownValue(direction, 'mood'),
      ownValue(styleReferenceProfile, 'mood'),
    ),
    typographySystem,
    copyTone: normalizeString(ownValue(direction, 'copyTone', 'copy_tone')),
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
