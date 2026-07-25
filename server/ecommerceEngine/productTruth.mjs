import { createHash } from 'node:crypto';

const FIELD_ALIASES = Object.freeze({
  category: ['category'],
  productName: ['productName', 'product_name'],
  silhouette: ['silhouette'],
  primaryColors: ['primaryColors', 'primary_colors'],
  materials: ['materials'],
  components: ['components'],
  packageText: ['packageText', 'package_text'],
  logos: ['logos'],
  skuFacts: ['skuFacts', 'sku_facts'],
  confirmedFacts: ['confirmedFacts', 'confirmed_facts'],
  uncertainFacts: ['uncertainFacts', 'uncertain_facts'],
  forbiddenMutations: ['forbiddenMutations', 'forbidden_mutations'],
  sourceAssetIds: ['sourceAssetIds', 'source_asset_ids'],
  fingerprint: ['fingerprint'],
  facts: ['facts'],
});

const STRUCTURAL_FIELDS = new Set(Object.values(FIELD_ALIASES).flat());

const VISUAL_SAFE_FACT_NAMES = new Set([
  'material', 'materials', 'color', 'colors', 'colour', 'colours',
  'shape', 'silhouette', 'texture', 'component', 'components', 'logo', 'packagetext',
]);

const DETERMINISTIC_FACT_NAMES = new Set([
  'dimension', 'dimensions', 'size', 'measurement', 'length', 'width', 'height',
  'volume', 'capacity', 'netweight', 'weight', 'certification', 'testreport', 'report',
  'ingredient', 'ingredients', 'efficacy', 'effect', 'claim', 'claims', 'quantity',
  'count', 'pack', 'sku', 'specification', 'specifications', 'spec', 'model', 'price',
  'promotion', 'discount', 'comparison', 'comparisonclaim', 'compare',
  '容量', '净含量', '重量', '尺寸', '规格', '型号', '认证', '成分', '功效', '数量', '对比', '检测报告',
]);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ownEntries(value) {
  if (!isRecord(value)) return [];
  return Object.keys(value).flatMap((rawKey) => {
    const key = cleanKey(rawKey);
    if (!key || DANGEROUS_KEYS.has(key.toLowerCase())) return [];
    return [[key, value[rawKey]]];
  });
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

function getField(source, key) {
  for (const alias of FIELD_ALIASES[key] || [key]) {
    if (Object.hasOwn(source, alias)) return source[alias];
  }
  return undefined;
}

function pickFirstString(sources, key) {
  for (const source of sources) {
    const value = cleanString(getField(source, key));
    if (value) return value;
  }
  return '';
}

function mergeStringLists(sources, key) {
  return unique(sources.flatMap((source) => cleanStringList(getField(source, key))));
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

  const clone = Object.create(null);
  for (const [key, item] of ownEntries(value)) clone[key] = cloneSafeValue(item);
  return clone;
}

function normalizeFactValue(value, source) {
  const record = isRecord(value) ? value : {};
  const isDirectValue = !isRecord(value);
  const normalizedValue = cleanString(record.value ?? value);
  if (!normalizedValue) return null;

  const confidence = cleanConfidence(record.confidence);
  const sourceAssetId = cleanString(record.sourceAssetId ?? record.source_asset_id);
  const visible = record.visible === true || record.is_visible === true || record.field_visible === true;
  return {
    value: normalizedValue,
    source,
    ...(confidence === undefined ? {} : { confidence }),
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(visible || isDirectValue ? { visible: true } : {}),
  };
}

function normalizeFacts(value, defaultSource = '') {
  const facts = Object.create(null);
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
  const facts = Object.create(null);
  const skuNames = new Set();
  for (const [name, value] of ownEntries(source)) {
    if (!STRUCTURAL_FIELDS.has(name)) {
      const fact = normalizeFactValue(value, sourceName);
      if (fact) facts[cleanString(name)] = fact;
    }
  }

  for (const factGroup of [getField(source, 'facts'), getField(source, 'confirmedFacts')]) {
    for (const [name, value] of ownEntries(factGroup)) {
      const fact = normalizeFactValue(value, sourceName);
      if (fact) facts[cleanString(name)] = fact;
    }
  }
  for (const [name, value] of ownEntries(getField(source, 'skuFacts'))) {
    const factName = cleanString(name);
    const fact = normalizeFactValue(value, sourceName);
    if (factName && fact) {
      facts[factName] = fact;
      skuNames.add(factName);
    }
  }
  return { facts, skuNames };
}

function isExplicitOcrFact(fact) {
  return fact.visible === true && (fact.confidence === undefined || fact.confidence >= 0.8);
}

function canConfirmFact(name, fact, forceDeterministic = false) {
  if (!forceDeterministic && classifyFactRisk(name) === 'visual_ok') return true;
  return fact.source === 'user' || (fact.source === 'ocr' && isExplicitOcrFact(fact));
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${ownEntries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
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
  const normalizedName = cleanString(name).toLowerCase().replace(/[\s_-]+/g, '');
  if (DETERMINISTIC_FACT_NAMES.has(normalizedName)) return 'deterministic_only';
  return VISUAL_SAFE_FACT_NAMES.has(normalizedName) ? 'visual_ok' : 'deterministic_only';
}

/**
 * Normalize a Product Truth payload into a fresh, safe, deterministic shape.
 * @param {Object} input
 * @returns {Object}
 */
export function normalizeProductTruth(input = {}) {
  const source = isRecord(input) ? cloneSafeValue(input) : {};
  const packageText = normalizeTextEntries(getField(source, 'packageText'));
  const logos = normalizeLogos(getField(source, 'logos'));
  const confirmedFacts = Object.create(null);
  const skuFacts = Object.create(null);
  const rawUncertainFacts = getField(source, 'uncertainFacts');
  const uncertainFacts = (Array.isArray(rawUncertainFacts) ? rawUncertainFacts : [])
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const name = cleanKey(item.name);
      if (!name || DANGEROUS_KEYS.has(name.toLowerCase())) return [];
      const fact = normalizeFactValue(item, cleanString(item.source));
      return name && fact ? [normalizedUncertainFact(name, fact)] : [];
    });
  for (const [name, fact] of ownEntries(normalizeFacts(getField(source, 'confirmedFacts')))) {
    if (canConfirmFact(name, fact)) {
      confirmedFacts[name] = normalizedFactOutput(fact);
    } else {
      uncertainFacts.push(normalizedUncertainFact(name, fact));
    }
  }
  for (const [name, fact] of ownEntries(normalizeFacts(getField(source, 'skuFacts')))) {
    if (canConfirmFact(name, fact, true)) {
      const output = normalizedFactOutput(fact);
      skuFacts[name] = output;
      confirmedFacts[name] = output;
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
    ...cleanStringList(getField(source, 'sourceAssetIds')),
    ...packageText.map((entry) => entry.sourceAssetId).filter(Boolean),
    ...logos.map((entry) => entry.sourceAssetId).filter(Boolean),
    ...ownEntries(confirmedFacts).map(([, fact]) => fact.sourceAssetId).filter(Boolean),
    ...ownEntries(skuFacts).map(([, fact]) => fact.sourceAssetId).filter(Boolean),
    ...deduplicatedUncertainFacts.map((fact) => fact.sourceAssetId).filter(Boolean),
  ]);

  const truth = {
    category: cleanString(getField(source, 'category')),
    productName: cleanString(getField(source, 'productName')),
    silhouette: cleanString(getField(source, 'silhouette')),
    primaryColors: cleanStringList(getField(source, 'primaryColors')),
    materials: cleanStringList(getField(source, 'materials')),
    components: cleanStringList(getField(source, 'components')),
    packageText,
    logos,
    skuFacts: { ...skuFacts },
    confirmedFacts: { ...confirmedFacts },
    uncertainFacts: deduplicatedUncertainFacts,
    forbiddenMutations: [],
    sourceAssetIds,
    fingerprint: '',
  };
  truth.forbiddenMutations = deriveForbiddenMutations({
    ...truth,
    forbiddenMutations: getField(source, 'forbiddenMutations'),
  });
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
  const sourceFacts = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => [name, collectSourceFacts(source, name)]),
  );
  const factNames = unique(Object.values(sourceFacts).flatMap(({ facts }) => Object.keys(facts)));
  const confirmedFacts = Object.create(null);
  const skuFacts = Object.create(null);
  const uncertainFacts = [];

  for (const name of factNames) {
    const isSkuFact = Object.values(sourceFacts).some(({ skuNames }) => skuNames.has(name));
    const risk = isSkuFact ? 'deterministic_only' : classifyFactRisk(name);
    const userFact = sourceFacts.user.facts[name];
    const ocrFact = sourceFacts.ocr.facts[name];
    const visionFact = sourceFacts.vision.facts[name];

    if (risk === 'deterministic_only') {
      let selected;
      if (userFact) {
        selected = userFact;
      } else if (ocrFact && isExplicitOcrFact(ocrFact)) {
        selected = ocrFact;
      }
      if (selected) {
        confirmedFacts[name] = selected;
        if (isSkuFact) skuFacts[name] = selected;
      }
      if (ocrFact && !isExplicitOcrFact(ocrFact)) {
        uncertainFacts.push(normalizedUncertainFact(name, ocrFact));
      }
      if (visionFact) {
        uncertainFacts.push(normalizedUncertainFact(name, visionFact));
      }
      continue;
    }

    const selected = userFact || ocrFact || visionFact;
    if (selected) confirmedFacts[name] = selected;
  }

  const propagatedSourceAssetIds = unique([
    ...prioritySources.flatMap((source) => cleanStringList(getField(source, 'sourceAssetIds'))),
    ...['user', 'ocr', 'vision'].flatMap((sourceName) =>
      ownEntries(sourceFacts[sourceName].facts).map(([, fact]) => fact.sourceAssetId).filter(Boolean)),
  ]);

  return normalizeProductTruth({
    category: pickFirstString(prioritySources, 'category'),
    productName: pickFirstString(prioritySources, 'productName'),
    silhouette: pickFirstString(prioritySources, 'silhouette'),
    primaryColors: mergeStringLists(prioritySources, 'primaryColors'),
    materials: mergeStringLists(prioritySources, 'materials'),
    components: mergeStringLists(prioritySources, 'components'),
    packageText: prioritySources.flatMap((source) => {
      const value = getField(source, 'packageText');
      return Array.isArray(value) ? value : value == null ? [] : [value];
    }),
    logos: prioritySources.flatMap((source) => {
      const value = getField(source, 'logos');
      return Array.isArray(value) ? value : value == null ? [] : [value];
    }),
    skuFacts,
    confirmedFacts,
    uncertainFacts,
    forbiddenMutations: prioritySources.flatMap((source) => cleanStringList(getField(source, 'forbiddenMutations'))),
    sourceAssetIds: propagatedSourceAssetIds,
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
