import { createHash } from 'node:crypto';

const STRUCTURAL_FIELDS = new Set([
  'category', 'productName', 'silhouette', 'primaryColors', 'materials', 'components',
  'packageText', 'logos', 'skuFacts', 'confirmedFacts', 'uncertainFacts',
  'forbiddenMutations', 'sourceAssetIds', 'fingerprint', 'facts',
]);

const HIGH_RISK_FACT_PATTERNS = [
  /certif/, /test\s*report|report/, /ingredient/, /efficacy|effect|claim/,
  /quantity|count|pack/, /dimension|size|measurement|length|width|height/,
  /sku|specification|spec/, /price|promotion|discount/, /comparison|compare/,
];

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ownEntries(value) {
  if (!isRecord(value)) return [];
  return Object.entries(value).filter(([key]) => !DANGEROUS_KEYS.has(key));
}

function cleanString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function cleanStringList(value) {
  const items = Array.isArray(value) ? value : value == null ? [] : [value];
  return unique(items.map(cleanString).filter(Boolean));
}

function cleanConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function unique(values) {
  return [...new Set(values)];
}

function pickFirstString(sources, key) {
  for (const source of sources) {
    const value = cleanString(source[key]);
    if (value) return value;
  }
  return '';
}

function mergeStringLists(sources, key) {
  return unique(sources.flatMap((source) => cleanStringList(source[key])));
}

function normalizeTextEntries(value) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const seen = new Set();

  return entries.flatMap((entry) => {
    const source = isRecord(entry) ? entry : { text: entry };
    const text = cleanString(source.text ?? source.value);
    if (!text) return [];

    const sourceAssetId = cleanString(source.sourceAssetId ?? source.source_asset_id);
    const layout = cleanString(source.layout);
    const confidence = cleanConfidence(source.confidence);
    const key = `${text}\u0000${sourceAssetId}\u0000${layout}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      text,
      ...(confidence === undefined ? {} : { confidence }),
      ...(sourceAssetId ? { sourceAssetId } : {}),
      ...(layout ? { layout } : {}),
    }];
  });
}

function normalizeLogos(value) {
  const entries = Array.isArray(value) ? value : value == null ? [] : [value];
  const seen = new Set();

  return entries.flatMap((entry) => {
    const source = isRecord(entry) ? entry : { description: entry };
    const description = cleanString(source.description ?? source.text ?? source.value);
    if (!description) return [];

    const sourceAssetId = cleanString(source.sourceAssetId ?? source.source_asset_id);
    const confidence = cleanConfidence(source.confidence);
    const bbox = isRecord(source.bbox) ? cloneSafeValue(source.bbox) : undefined;
    const key = `${description}\u0000${sourceAssetId}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      description,
      ...(sourceAssetId ? { sourceAssetId } : {}),
      ...(bbox === undefined ? {} : { bbox }),
      ...(confidence === undefined ? {} : { confidence }),
    }];
  });
}

function cloneSafeValue(value) {
  if (Array.isArray(value)) return value.map(cloneSafeValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(ownEntries(value).map(([key, item]) => [key, cloneSafeValue(item)]));
}

function normalizeFactValue(value, source) {
  const record = isRecord(value) ? value : {};
  const isDirectValue = !isRecord(value);
  const normalizedValue = cleanString(record.value ?? value);
  if (!normalizedValue) return null;

  const confidence = cleanConfidence(record.confidence);
  const sourceAssetId = cleanString(record.sourceAssetId ?? record.source_asset_id);
  return {
    value: normalizedValue,
    source,
    ...(confidence === undefined ? {} : { confidence }),
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(record.visible === true || isDirectValue ? { visible: true } : {}),
  };
}

function normalizeFacts(value, defaultSource = '') {
  const facts = {};
  for (const [name, rawFact] of ownEntries(value)) {
    const factName = cleanString(name);
    const source = cleanString(isRecord(rawFact) ? rawFact.source : '') || defaultSource;
    const fact = normalizeFactValue(rawFact, source);
    if (factName && fact) facts[factName] = fact;
  }
  return facts;
}

function normalizedFactOutput(fact) {
  return {
    value: fact.value,
    source: fact.source,
    ...(fact.confidence === undefined ? {} : { confidence: fact.confidence }),
    ...(fact.sourceAssetId ? { sourceAssetId: fact.sourceAssetId } : {}),
  };
}

function normalizedUncertainFact(name, fact) {
  return {
    name,
    value: fact.value,
    source: fact.source,
    ...(fact.confidence === undefined ? {} : { confidence: fact.confidence }),
    ...(fact.sourceAssetId ? { sourceAssetId: fact.sourceAssetId } : {}),
  };
}

function collectSourceFacts(source, sourceName) {
  const facts = {};
  for (const [name, value] of ownEntries(source)) {
    if (!STRUCTURAL_FIELDS.has(name)) {
      const fact = normalizeFactValue(value, sourceName);
      if (fact) facts[cleanString(name)] = fact;
    }
  }

  for (const factGroup of [source.facts, source.skuFacts, source.confirmedFacts]) {
    for (const [name, value] of ownEntries(factGroup)) {
      const fact = normalizeFactValue(value, sourceName);
      if (fact) facts[cleanString(name)] = fact;
    }
  }
  return facts;
}

function isExplicitOcrFact(fact) {
  return fact.visible === true && (fact.confidence === undefined || fact.confidence >= 0.8);
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${ownEntries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(',')}}`;
}

function buildFingerprint(truth) {
  const fingerprintInput = { ...truth, fingerprint: '' };
  return createHash('sha256').update(stableSerialize(fingerprintInput)).digest('hex');
}

function deriveForbiddenMutations(truth) {
  const derived = [
    ...cleanStringList(truth.forbiddenMutations),
    ...(truth.silhouette ? [`silhouette: ${truth.silhouette}`] : []),
    ...truth.components.map((component) => `component: ${component}`),
    ...truth.packageText.flatMap((entry) => [
      `package text: ${entry.text}`,
      ...(entry.layout ? [`package layout: ${entry.layout}`] : []),
    ]),
    ...truth.logos.map((logo) => `logo: ${logo.description}`),
    ...ownEntries(truth.confirmedFacts)
      .filter(([name, fact]) => /label|variant|model|shade/i.test(name) && ['user', 'ocr'].includes(fact.source))
      .map(([, fact]) => `label: ${fact.value}`),
  ];
  return unique(derived);
}

/**
 * Return whether a fact can be safely rendered from visual analysis.
 * @param {string} name
 * @returns {'deterministic_only'|'visual_ok'}
 */
export function classifyFactRisk(name) {
  const normalizedName = cleanString(name).toLowerCase();
  return HIGH_RISK_FACT_PATTERNS.some((pattern) => pattern.test(normalizedName))
    ? 'deterministic_only'
    : 'visual_ok';
}

/**
 * Normalize a Product Truth payload into a fresh, safe, deterministic shape.
 * @param {Object} input
 * @returns {Object}
 */
export function normalizeProductTruth(input = {}) {
  const source = isRecord(input) ? cloneSafeValue(input) : {};
  const packageText = normalizeTextEntries(source.packageText);
  const logos = normalizeLogos(source.logos);
  const confirmedFacts = {};
  const uncertainFacts = (Array.isArray(source.uncertainFacts) ? source.uncertainFacts : [])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const name = cleanString(item.name);
      const fact = normalizeFactValue(item, cleanString(item.source));
      return name && fact ? [normalizedUncertainFact(name, fact)] : [];
    });
  for (const [name, fact] of ownEntries(normalizeFacts(source.confirmedFacts))) {
    const highRiskFact = classifyFactRisk(name) === 'deterministic_only';
    const allowed = !highRiskFact
      || fact.source === 'user'
      || (fact.source === 'ocr' && isExplicitOcrFact(fact));
    if (allowed) {
      confirmedFacts[name] = normalizedFactOutput(fact);
    } else {
      uncertainFacts.push(normalizedUncertainFact(name, fact));
    }
  }
  const deduplicatedUncertainFacts = [];
  const uncertainFactKeys = new Set();
  for (const fact of uncertainFacts) {
    const key = `${fact.name}\u0000${fact.value}\u0000${fact.source}\u0000${fact.sourceAssetId || ''}`;
    if (!uncertainFactKeys.has(key)) {
      uncertainFactKeys.add(key);
      deduplicatedUncertainFacts.push(fact);
    }
  }
  const sourceAssetIds = unique([
    ...cleanStringList(source.sourceAssetIds),
    ...packageText.map((entry) => entry.sourceAssetId).filter(Boolean),
    ...logos.map((entry) => entry.sourceAssetId).filter(Boolean),
    ...ownEntries(confirmedFacts).map(([, fact]) => fact.sourceAssetId).filter(Boolean),
    ...deduplicatedUncertainFacts.map((fact) => fact.sourceAssetId).filter(Boolean),
  ]);

  const truth = {
    category: cleanString(source.category),
    productName: cleanString(source.productName ?? source.product_name),
    silhouette: cleanString(source.silhouette),
    primaryColors: cleanStringList(source.primaryColors ?? source.primary_colors),
    materials: cleanStringList(source.materials),
    components: cleanStringList(source.components),
    packageText,
    logos,
    skuFacts: normalizeFacts(source.skuFacts),
    confirmedFacts,
    uncertainFacts: deduplicatedUncertainFacts,
    forbiddenMutations: [],
    sourceAssetIds,
    fingerprint: '',
  };
  truth.forbiddenMutations = deriveForbiddenMutations({ ...truth, forbiddenMutations: source.forbiddenMutations });
  truth.fingerprint = buildFingerprint(truth);
  return truth;
}

/**
 * Merge Product Truth facts with user > OCR > vision precedence.
 * @param {{vision?: Object, ocr?: Object, user?: Object}} input
 * @returns {Object}
 */
export function mergeProductFacts({ vision = {}, ocr = {}, user = {} } = {}) {
  const sources = {
    vision: isRecord(vision) ? cloneSafeValue(vision) : {},
    ocr: isRecord(ocr) ? cloneSafeValue(ocr) : {},
    user: isRecord(user) ? cloneSafeValue(user) : {},
  };
  const prioritySources = [sources.user, sources.ocr, sources.vision];
  const candidates = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [name, collectSourceFacts(source, name)]),
  );
  const factNames = unique(Object.values(candidates).flatMap((facts) => Object.keys(facts)));
  const confirmedFacts = {};
  const uncertainFacts = [];

  for (const name of factNames) {
    const risk = classifyFactRisk(name);
    const userFact = candidates.user[name];
    const ocrFact = candidates.ocr[name];
    const visionFact = candidates.vision[name];

    if (risk === 'deterministic_only') {
      if (userFact) {
        confirmedFacts[name] = userFact;
      } else if (ocrFact && isExplicitOcrFact(ocrFact)) {
        confirmedFacts[name] = ocrFact;
      }
      if (!userFact && ocrFact && !isExplicitOcrFact(ocrFact)) {
        uncertainFacts.push(normalizedUncertainFact(name, ocrFact));
      }
      if (!userFact && !ocrFact && visionFact) {
        uncertainFacts.push(normalizedUncertainFact(name, visionFact));
      }
      continue;
    }

    const selected = userFact || ocrFact || visionFact;
    if (selected) confirmedFacts[name] = selected;
  }

  return normalizeProductTruth({
    category: pickFirstString(prioritySources, 'category'),
    productName: pickFirstString(prioritySources, 'productName'),
    silhouette: pickFirstString(prioritySources, 'silhouette'),
    primaryColors: mergeStringLists(prioritySources, 'primaryColors'),
    materials: mergeStringLists(prioritySources, 'materials'),
    components: mergeStringLists(prioritySources, 'components'),
    packageText: prioritySources.flatMap((source) => Array.isArray(source.packageText) ? source.packageText : []),
    logos: prioritySources.flatMap((source) => Array.isArray(source.logos) ? source.logos : []),
    skuFacts: sources.user.skuFacts || sources.ocr.skuFacts || sources.vision.skuFacts || {},
    confirmedFacts,
    uncertainFacts,
    forbiddenMutations: prioritySources.flatMap((source) => cleanStringList(source.forbiddenMutations)),
    sourceAssetIds: prioritySources.flatMap((source) => cleanStringList(source.sourceAssetIds)),
  });
}

/**
 * Build the dedicated VLM contract for product facts, isolated from visual style analysis.
 * @param {{sourceAssetIds?: string[]}} input
 * @returns {{systemPrompt: string, userPrompt: string}}
 */
export function buildProductTruthPrompt({ sourceAssetIds = [] } = {}) {
  const assets = cleanStringList(sourceAssetIds);
  return {
    systemPrompt: `You are an e-commerce Product Truth extraction system. Return JSON only: no markdown, prose, or comments. Extract only directly visible product identity details and preserve uncertainty.

Return this JSON object:
{
  "category": "",
  "productName": "",
  "silhouette": "",
  "primaryColors": [],
  "materials": [],
  "components": [],
  "packageText": [{ "text": "", "confidence": 0, "sourceAssetId": "" }],
  "logos": [{ "description": "", "confidence": 0, "sourceAssetId": "" }],
  "skuFacts": {},
  "confirmedFacts": {},
  "uncertainFacts": [],
  "forbiddenMutations": [],
  "sourceAssetIds": []
}

Never infer or invent dimensions, certification, efficacy, quantity, ingredients, SKU values, test reports, price/promotion, or comparison claims. Put anything not explicitly visible into uncertainFacts and never state it as confirmed. Do not analyze lighting, palette, composition, mood, background, or any other style information.`,
    userPrompt: `Extract Product Truth from ${assets.length} product asset${assets.length === 1 ? '' : 's'}${assets.length ? ` (${assets.join(', ')})` : ''}. Return JSON only.`,
  };
}
