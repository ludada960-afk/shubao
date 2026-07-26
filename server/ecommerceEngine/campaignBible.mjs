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

function isEquivalentPaletteLock(lock, colors) {
  const normalizedLock = lock.toLowerCase();
  if (!/\bpalette\b|\bcolors?\b/.test(normalizedLock)) return false;
  return colors.every((color) => normalizedLock.includes(color.toLowerCase()));
}

/**
 * Compiles a selected visual direction into the shared campaign rules used by
 * every asset role. The direction title deliberately comes only from the
 * selected direction, while the second-step brief remains user-editable.
 */
export function compileCampaignBible(direction = {}, overrides = {}) {
  const customColors = normalizeStrings(ownValue(overrides, 'customColors', 'custom_colors'));
  const palette = customColors.length > 0
    ? customColors
    : normalizeStrings(ownValue(direction, 'palette', 'colors', 'preview_colors'));
  const consistencyLocks = normalizeStrings(ownValue(direction, 'consistencyLocks', 'consistency_locks'));

  if (customColors.length > 0) {
    const canonicalPaletteLock = `palette: ${customColors.join(', ')}`;
    const nonPaletteLocks = consistencyLocks.filter((lock) => !isEquivalentPaletteLock(lock, customColors));
    consistencyLocks.splice(0, consistencyLocks.length, ...nonPaletteLocks, canonicalPaletteLock);
  }

  return {
    directionId: firstNonEmpty(ownValue(direction, 'id', 'directionId', 'direction_id')),
    title: normalizeString(ownValue(direction, 'title')),
    editableBrief: firstNonEmpty(
      ownValue(overrides, 'editableBrief', 'editable_brief'),
      ownValue(direction, 'editableBrief', 'editable_brief', 'brief', 'description'),
    ),
    commercialObjective: firstNonEmpty(
      ownValue(direction, 'commercialObjective', 'commercial_objective', 'objective'),
      'conversion',
    ),
    audience: normalizeString(ownValue(direction, 'audience')),
    visualKeywords: normalizeStrings(ownValue(direction, 'visualKeywords', 'visual_keywords', 'keywords')),
    palette,
    lighting: normalizeString(ownValue(direction, 'lighting')),
    composition: normalizeString(ownValue(direction, 'composition')),
    backgroundLanguage: normalizeString(ownValue(direction, 'backgroundLanguage', 'background_language')),
    typographyIntent: normalizeString(ownValue(direction, 'typographyIntent', 'typography_intent')),
    copyTone: normalizeString(ownValue(direction, 'copyTone', 'copy_tone')),
    consistencyLocks,
    prohibitedStyles: normalizeStrings(ownValue(direction, 'prohibitedStyles', 'prohibited_styles')),
    referenceAssetIds: normalizeStrings(
      ownValue(overrides, 'referenceAssetIds', 'reference_asset_ids')
        ?? ownValue(direction, 'referenceAssetIds', 'reference_asset_ids'),
    ),
  };
}
