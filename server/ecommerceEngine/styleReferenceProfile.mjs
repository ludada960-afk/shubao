const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const REQUIRED_PROHIBITED_TRANSFERS = Object.freeze([
  'reference products',
  'people identities',
  'brands',
  'logos',
  'prices',
  'claims',
  'parameters',
  'certifications',
  'source copy',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function ownValue(record, ...keys) {
  if (!isRecord(record)) return undefined;
  for (const key of keys) {
    if (!UNSAFE_KEYS.has(key.toLowerCase()) && Object.hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStrings(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const seen = new Set();
  const result = [];
  for (const item of values) {
    const normalized = cleanString(item);
    if (!normalized || UNSAFE_KEYS.has(normalized.toLowerCase()) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

export function normalizeStyleReferenceProfile(input = {}) {
  const source = isRecord(input) ? input : {};
  const prohibitedTransfers = cleanStrings(ownValue(source, 'prohibitedTransfers', 'prohibited_transfers'));

  return {
    palette: cleanStrings(ownValue(source, 'palette', 'colors', 'color_palette')),
    lighting: cleanString(ownValue(source, 'lighting')),
    composition: cleanString(ownValue(source, 'composition')),
    cameraLanguage: cleanString(ownValue(source, 'cameraLanguage', 'camera_language')),
    typographyIntent: cleanString(ownValue(source, 'typographyIntent', 'typography_intent')),
    informationDensity: cleanString(ownValue(source, 'informationDensity', 'information_density')),
    backgroundLanguage: cleanString(ownValue(source, 'backgroundLanguage', 'background_language')),
    mood: cleanString(ownValue(source, 'mood')),
    prohibitedTransfers: [
      ...REQUIRED_PROHIBITED_TRANSFERS,
      ...prohibitedTransfers.filter(value => !REQUIRED_PROHIBITED_TRANSFERS.includes(value)),
    ],
    sourceAssetIds: cleanStrings(ownValue(source, 'sourceAssetIds', 'source_asset_ids')),
    confidence: normalizeConfidence(ownValue(source, 'confidence')),
  };
}

export function buildStyleReferencePrompt({ sourceAssetIds = [] } = {}) {
  const assets = cleanStrings(sourceAssetIds);
  return {
    systemPrompt: `Return JSON only. Extract transferable palette, lighting, composition, camera language, typography intent, information density, background language and mood. Always include top-level sourceAssetIds and confidence; confidence must be a JSON number from 0 to 1, never a string. Never transfer products, people identities, brands, logos, prices, claims, parameters, certifications or source copy.`,
    userPrompt: `Analyze style references ${assets.join(', ')}. Return JSON only.`,
  };
}
