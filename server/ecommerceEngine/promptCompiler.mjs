import { assembleStructuredPrompt } from './promptAssembler.mjs';
import { LEGAL_IMAGE_SIZES, buildModelRoute } from './modelCatalog.mjs';
import { getPlatformPolicy } from './platformPolicies.mjs';
import { classifyFactRisk } from './productTruth.mjs';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_INPUT_ASSETS = 10;
const GROUP_LIMITS = Object.freeze({
  product: 5,
  style: 3,
  proof: 2,
  protection: 2,
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record, key) {
  return isRecord(record) && Object.hasOwn(record, key);
}

function ownValue(record, ...keys) {
  for (const key of keys) {
    if (hasOwn(record, key)) return record[key];
  }
  return undefined;
}

function cleanString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function safeIdentifier(value) {
  const identifier = cleanString(value);
  const normalized = identifier.toLowerCase();
  if (!identifier || identifier.length > 256 || UNSAFE_KEYS.has(normalized) || /[\u0000-\u001f\u007f]/.test(identifier)) {
    return '';
  }
  return identifier;
}

function uniqueIdentifiers(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];
  const seen = new Set();

  for (const item of values) {
    const identifier = safeIdentifier(isRecord(item)
      ? ownValue(item, 'assetId', 'id', 'sourceAssetId')
      : item);
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    result.push(identifier);
  }
  return result;
}

function ownArray(record, ...keys) {
  const value = ownValue(record, ...keys);
  return Array.isArray(value) ? value : [];
}

function numericRank(asset, key) {
  const value = Number(ownValue(asset, key));
  return Number.isFinite(value) ? value : 0;
}

function assetQuality(asset) {
  const direct = numericRank(asset, 'qualityScore') || numericRank(asset, 'score');
  if (direct) return direct;
  const quality = ownValue(asset, 'quality');
  return isRecord(quality) ? numericRank(quality, 'suitability') : 0;
}

function shallowSafeAsset(asset) {
  const output = Object.create(null);
  for (const key of Object.keys(asset)) {
    if (UNSAFE_KEYS.has(key.trim().toLowerCase())) continue;
    output[key] = asset[key];
  }
  return output;
}

function normalizeAssetCandidates(values, requestedIds) {
  const requestedRanks = new Map(requestedIds.map((assetId, index) => [assetId, index]));
  const candidates = [];

  for (const asset of Array.isArray(values) ? values : []) {
    if (!isRecord(asset)) continue;
    const assetId = safeIdentifier(ownValue(asset, 'assetId', 'id', 'sourceAssetId'));
    if (!assetId || (requestedRanks.size > 0 && !requestedRanks.has(assetId))) continue;
    candidates.push({
      assetId,
      asset: shallowSafeAsset(asset),
      requestedRank: requestedRanks.has(assetId) ? requestedRanks.get(assetId) : Number.MAX_SAFE_INTEGER,
      priority: numericRank(asset, 'priority'),
      quality: assetQuality(asset),
    });
  }

  candidates.sort((left, right) => (
    left.requestedRank - right.requestedRank
    || right.priority - left.priority
    || right.quality - left.quality
    || compareStrings(left.assetId, right.assetId)
    || compareStrings(cleanString(ownValue(left.asset, 'url', 'path')), cleanString(ownValue(right.asset, 'url', 'path')))
  ));

  const result = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate.assetId)) continue;
    seen.add(candidate.assetId);
    result.push(candidate);
  }
  return result;
}

function needsProtectionAssets(assetPlanItem, productTruth) {
  const explicitIds = uniqueIdentifiers(ownValue(assetPlanItem, 'protectionAssetIds'));
  const forbiddenMutations = ownArray(productTruth, 'forbiddenMutations');
  const qualityChecks = ownArray(assetPlanItem, 'qualityChecks').map(cleanString);
  return explicitIds.length > 0
    || forbiddenMutations.length > 0
    || ['medium', 'high'].includes(cleanString(ownValue(assetPlanItem, 'riskLevel')).toLowerCase())
    || qualityChecks.includes('product_fidelity');
}

function responsibilityFor(kind, position) {
  if (kind === 'product') {
    return position === 0
      ? 'Authoritative product identity view for subject shape and appearance only.'
      : 'Authoritative secondary product view for one additional structural angle only.';
  }
  if (kind === 'style') {
    return 'Style-only visual-language reference; never copy, depict, or substitute its product.';
  }
  if (kind === 'proof') {
    return 'Evidence source for deterministic post-processing only; it is not a product view.';
  }
  return 'Protect one exact product identity element from mutation only.';
}

function selectInputAssets(assetPlanItem, productTruth, assets) {
  const source = isRecord(assets) ? assets : {};
  const productIds = uniqueIdentifiers(ownValue(assetPlanItem, 'productAssetIds'));
  const styleIds = uniqueIdentifiers(ownValue(assetPlanItem, 'styleReferenceIds'));
  const proofIds = uniqueIdentifiers(ownValue(assetPlanItem, 'proofAssetIds'));
  const protectionIds = uniqueIdentifiers(ownValue(assetPlanItem, 'protectionAssetIds'));
  const proofSources = [
    ...ownArray(source, 'proof', 'proofs'),
    ...ownArray(source, 'protection').filter((asset) => proofIds.includes(safeIdentifier(ownValue(asset, 'assetId', 'id', 'sourceAssetId')))),
  ];
  const groups = [
    ['product', productIds.length
      ? normalizeAssetCandidates(ownArray(source, 'product', 'products'), productIds)
      : []],
    ['style', styleIds.length
      ? normalizeAssetCandidates(ownArray(source, 'reference', 'references', 'style'), styleIds)
      : []],
    ['proof', proofIds.length ? normalizeAssetCandidates(proofSources, proofIds) : []],
    ['protection', needsProtectionAssets(assetPlanItem, productTruth)
      ? normalizeAssetCandidates(ownArray(source, 'protection'), protectionIds)
      : []],
  ];
  const selected = [];
  const globallyUsedIds = new Set();

  for (const [kind, candidates] of groups) {
    let groupPosition = 0;
    for (const candidate of candidates) {
      if (selected.length >= MAX_INPUT_ASSETS || groupPosition >= GROUP_LIMITS[kind]) break;
      if (globallyUsedIds.has(candidate.assetId)) continue;
      globallyUsedIds.add(candidate.assetId);
      selected.push({
        ...candidate.asset,
        assetId: candidate.assetId,
        kind,
        responsibility: responsibilityFor(kind, groupPosition),
      });
      groupPosition += 1;
    }
  }

  return selected.map((asset, index) => ({ ...asset, index }));
}

function normalizeStrings(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const result = [];
  const seen = new Set();
  for (const item of values) {
    const normalized = cleanString(item);
    if (!normalized || UNSAFE_KEYS.has(normalized.toLowerCase()) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeFactEntries(value) {
  if (!Array.isArray(value)) return [];
  const facts = [];
  const seen = new Set();

  for (const fact of value) {
    if (!isRecord(fact)) continue;
    const name = safeIdentifier(ownValue(fact, 'name', 'key'));
    const factValue = cleanString(ownValue(fact, 'value'));
    const source = cleanString(ownValue(fact, 'source'));
    const key = `${name}\u0000${factValue}`;
    if (!name || !factValue || seen.has(key)) continue;
    seen.add(key);
    facts.push({ name, value: factValue, ...(source ? { source } : {}) });
  }
  return facts;
}

function confirmedFactMap(productTruth) {
  const facts = ownValue(productTruth, 'confirmedFacts');
  const result = new Map();
  if (!isRecord(facts)) return result;

  for (const rawName of Object.keys(facts).sort(compareStrings)) {
    const name = safeIdentifier(rawName);
    const fact = facts[rawName];
    const value = cleanString(isRecord(fact) ? ownValue(fact, 'value') : fact);
    const source = cleanString(isRecord(fact) ? ownValue(fact, 'source') : '');
    if (name && value) result.set(name, { name, value, ...(source ? { source } : {}) });
  }
  return result;
}

function uncertainFactNames(productTruth) {
  return new Set(ownArray(productTruth, 'uncertainFacts')
    .map((fact) => safeIdentifier(ownValue(fact, 'name')))
    .filter(Boolean));
}

function requiredConfirmedFacts(assetPlanItem, productTruth) {
  const confirmed = confirmedFactMap(productTruth);
  const uncertainNames = uncertainFactNames(productTruth);
  const productName = cleanString(ownValue(productTruth, 'productName'));
  const proofIds = new Set(uniqueIdentifiers(ownValue(assetPlanItem, 'proofAssetIds')));
  const role = cleanString(ownValue(assetPlanItem, 'role'));
  const facts = [];

  for (const required of normalizeFactEntries(ownValue(assetPlanItem, 'requiredFacts'))) {
    const confirmedFact = confirmed.get(required.name);
    if (required.name === 'productName') {
      if (productName && required.value === productName) facts.push({ ...required, source: 'product_truth' });
      continue;
    }
    if (required.name === 'proofAssetId') {
      if (proofIds.has(required.value)) facts.push({ ...required, source: 'proof_asset' });
      continue;
    }
    if (confirmedFact) {
      if (confirmedFact.value === required.value) facts.push({ ...required, source: confirmedFact.source || 'product_truth' });
      continue;
    }
    if (!uncertainNames.has(required.name) && (
      ['user', 'ocr'].includes(required.source)
      || role === 'sku'
    )) {
      facts.push({ ...required, source: required.source || 'asset_plan_confirmed' });
    }
  }
  return facts;
}

function exactTextFromForbiddenMutation(mutation) {
  const match = /^\s*(package text|label)\s*:\s*(.+)$/i.exec(cleanString(mutation));
  return match ? { name: match[1].toLowerCase().replace(' ', ''), value: match[2].trim(), source: 'product_truth' } : null;
}

function splitFactsForRendering(assetPlanItem, productTruth) {
  const visualFacts = [];
  const overlays = [];
  const overlayKeys = new Set();
  const addOverlay = (fact) => {
    const key = `${fact.name}\u0000${fact.value}`;
    if (!fact.name || !fact.value || overlayKeys.has(key)) return;
    overlayKeys.add(key);
    overlays.push(fact);
  };

  for (const fact of requiredConfirmedFacts(assetPlanItem, productTruth)) {
    if (fact.name === 'productName') continue;
    if (classifyFactRisk(fact.name) === 'visual_ok') {
      visualFacts.push(fact);
    } else {
      addOverlay(fact);
    }
  }

  for (const entry of ownArray(productTruth, 'packageText')) {
    const value = cleanString(ownValue(entry, 'text', 'value'));
    if (value) addOverlay({ name: 'packageText', value, source: 'product_truth' });
  }
  for (const mutation of ownArray(productTruth, 'forbiddenMutations')) {
    const exactText = exactTextFromForbiddenMutation(mutation);
    if (exactText) addOverlay(exactText);
  }

  return { visualFacts, overlays };
}

function safeForbiddenMutations(productTruth) {
  return ownArray(productTruth, 'forbiddenMutations')
    .map(cleanString)
    .filter((mutation) => mutation && !exactTextFromForbiddenMutation(mutation));
}

function campaignSection(campaignBible) {
  return {
    directionId: cleanString(ownValue(campaignBible, 'directionId')),
    title: cleanString(ownValue(campaignBible, 'title')),
    brief: cleanString(ownValue(campaignBible, 'editableBrief')),
    commercialObjective: cleanString(ownValue(campaignBible, 'commercialObjective')),
    audience: cleanString(ownValue(campaignBible, 'audience')),
    visualKeywords: normalizeStrings(ownValue(campaignBible, 'visualKeywords')),
    palette: normalizeStrings(ownValue(campaignBible, 'palette')),
    lighting: cleanString(ownValue(campaignBible, 'lighting')),
    composition: cleanString(ownValue(campaignBible, 'composition')),
    backgroundLanguage: cleanString(ownValue(campaignBible, 'backgroundLanguage')),
    typographyIntent: cleanString(ownValue(campaignBible, 'typographyIntent')),
    copyTone: cleanString(ownValue(campaignBible, 'copyTone')),
    consistencyLocks: normalizeStrings(ownValue(campaignBible, 'consistencyLocks')),
    prohibitedStyles: normalizeStrings(ownValue(campaignBible, 'prohibitedStyles')),
  };
}

function rolePolicyName(role) {
  if (['main', 'main_text', 'main_3x4'].includes(role)) return 'main';
  if (role === 'white_background') return 'white_background';
  if (role === 'sku') return 'sku';
  return 'detail';
}

function platformSection(assetPlanItem, productTruth) {
  const exportTarget = ownArray(assetPlanItem, 'exportTargets').find(isRecord) || {};
  const platform = cleanString(ownValue(exportTarget, 'platform')) || 'unknown';
  const category = cleanString(ownValue(productTruth, 'category')) || 'all';
  const policy = getPlatformPolicy(platform, rolePolicyName(cleanString(ownValue(assetPlanItem, 'role'))), category);

  return {
    platform: policy.platform,
    role: policy.role,
    categoryScope: policy.categoryScope,
    enforcement: policy.enforcement,
    confidence: policy.confidence,
    verifiedAt: policy.verifiedAt,
    recommendedCount: policy.recommendedCount,
    allowedRatios: [...policy.allowedRatios],
    backgroundPolicy: policy.backgroundPolicy,
    textPolicy: policy.textPolicy,
    requiredFacts: [...policy.requiredFacts],
  };
}

function deriveResolution(generationSize, ratio) {
  for (const [resolution, ratios] of Object.entries(LEGAL_IMAGE_SIZES)) {
    if (Object.hasOwn(ratios, ratio) && ratios[ratio] === generationSize) return resolution;
  }
  const knownSize = Object.values(LEGAL_IMAGE_SIZES)
    .some((ratios) => Object.values(ratios).includes(generationSize));
  if (knownSize) throw new RangeError('assetPlanItem generationSize must match its ratio');
  throw new RangeError('assetPlanItem generationSize must be a catalog-owned legal size');
}

function compileModelRoute(assetPlanItem) {
  const ratio = cleanString(ownValue(assetPlanItem, 'ratio'));
  const generationSize = cleanString(ownValue(assetPlanItem, 'generationSize'));
  const resolution = deriveResolution(generationSize, ratio);
  const route = buildModelRoute({
    resolution,
    ratio,
    assetCount: 1,
    batchEligible: false,
    sameStyle: false,
    highRiskFacts: cleanString(ownValue(assetPlanItem, 'riskLevel')).toLowerCase() !== 'low',
  });

  if (route.size !== generationSize) {
    throw new RangeError('model route size must exactly match assetPlanItem generationSize');
  }
  return route;
}

/**
 * Compile one Asset Plan item into an indexed multipart edit request.
 */
export function compileAssetRequest({
  assetPlanItem = {},
  productTruth = {},
  campaignBible = {},
  assets = {},
} = {}) {
  const item = isRecord(assetPlanItem) ? assetPlanItem : {};
  const truth = isRecord(productTruth) ? productTruth : {};
  const bible = isRecord(campaignBible) ? campaignBible : {};
  const inputAssets = selectInputAssets(item, truth, assets);
  const ratio = cleanString(ownValue(item, 'ratio'));
  const { visualFacts, overlays } = splitFactsForRendering(item, truth);
  const campaign = campaignSection(bible);
  const modelRoute = compileModelRoute(item);
  const productName = cleanString(ownValue(truth, 'productName'));
  const category = cleanString(ownValue(truth, 'category'));
  const materials = normalizeStrings(ownValue(truth, 'materials'));
  const sections = {
    roleObjective: {
      role: cleanString(ownValue(item, 'role')),
      purpose: cleanString(ownValue(item, 'purpose')),
      generationMode: cleanString(ownValue(item, 'generationMode')) || 'edit',
    },
    productTruth: {
      identity: {
        productName,
        category,
        silhouette: cleanString(ownValue(truth, 'silhouette')),
        primaryColors: normalizeStrings(ownValue(truth, 'primaryColors')),
        materials,
        components: normalizeStrings(ownValue(truth, 'components')),
      },
      requiredVisualFacts: visualFacts,
      authority: 'The indexed product views are the only authority for the real product identity.',
    },
    campaignBible: campaign,
    imageIndexDuties: inputAssets.map(({ index, assetId, kind, responsibility }) => ({
      index, assetId, kind, responsibility,
    })),
    generationInstructions: {
      subject: 'Preserve the user product from indexed product views; create only the requested role composition.',
      materials: materials.join(', '),
      lighting: campaign.lighting,
      composition: campaign.composition,
      background: campaign.backgroundLanguage,
      palette: campaign.palette,
      copyPolicy: 'Keep copy space restrained. Do not synthesize exact labels or factual text.',
    },
    platformRecommendation: platformSection(item, truth),
    deterministicOverlays: {
      instruction: 'Exact Chinese, prices, promotions, parameter tables, SKU labels, dimensions, certificates or reports, and comparison claims are post-processing only; the image model must not render them.',
      items: overlays,
    },
    forbiddenMutations: {
      instruction: 'Do not alter protected product geometry, components, colors, logos, or packaging layout.',
      items: safeForbiddenMutations(truth),
    },
    qualityAndRisk: {
      riskLevel: cleanString(ownValue(item, 'riskLevel')) || 'low',
      qualityChecks: normalizeStrings(ownValue(item, 'qualityChecks')),
    },
    referenceSafety: 'Style references may contribute style only. They must never replace, copy, or substitute for the user\'s real product. Proof assets are evidence only and are never product views.',
  };

  return {
    prompt: assembleStructuredPrompt({ ratio, sections }),
    inputAssets,
    modelRoute,
  };
}
