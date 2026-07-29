import { suiteSemanticKey } from './suiteDiversity.mjs';

const SAFE_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const COMMERCIAL_DUTY_ID_RE = /^[a-z0-9]+(?::[a-z0-9][a-z0-9-]*)+$/;
const SAFE_EVIDENCE_TIERS = new Set(['safe', 'conditional', 'confirmed_only']);
const COLLAGE_INTENT_RE = /\b(?:collage|contact\s*sheet|montage|candidate\s*grid)\b|拼贴|联系表|联络表|蒙太奇|候选(?:图)?网格|多候选|[五九]宫格/i;
const MULTI_PANEL_LAYOUT_RE = /\bmulti[ -]?panel\s+(?:layout|output|composition|sheet|grid)\b|多面板(?:布局|输出|拼图|网格)/i;
const CHINESE_PRESENTATION_NUMBER = '[〇零一二两三四五六七八九十百千万廿卅卌\\d]+';
const EXPLICIT_PRESENTATION_SUFFIX_RE = new RegExp(`(?:#\\s*\\d+|\\(\\s*\\d+\\s*\\)|第${CHINESE_PRESENTATION_NUMBER}张)$`, 'iu');
const CONTROLLED_CHINESE_PRESENTATION_SUFFIX_RE = new RegExp(`(?:方案|图)${CHINESE_PRESENTATION_NUMBER}$`, 'iu');
const CONTROLLED_ENGLISH_PRESENTATION_RE = /(?:^|\s)(?:recognition\s+variant|duty|treatment|image|photo|picture|shot|asset|frame)\s*(?:(?:number|no)\.?\s*)?([a-z0-9]+(?:[ -][a-z0-9]+)*)$/iu;
const BARE_RECOGNITION_ORDINAL_RE = /^(.*\bproduct\s+recognition)\s+([a-z]+(?:[ -][a-z]+)*)$/iu;
const ENGLISH_CARDINAL_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion',
]);
const IRREGULAR_ENGLISH_ORDINALS = new Map([
  ['first', 'one'],
  ['second', 'two'],
  ['third', 'three'],
  ['fifth', 'five'],
  ['eighth', 'eight'],
  ['ninth', 'nine'],
  ['twelfth', 'twelve'],
]);
const DUTY_SYNONYMS = new Map([
  ['display', 'show'],
  ['present', 'show'],
  ['depict', 'show'],
  ['full', 'complete'],
  ['entire', 'complete'],
  ['item', 'product'],
  ['customer', 'buyer'],
  ['shopper', 'buyer'],
  ['identification', 'recognition'],
  ['identify', 'recognition'],
  ['recognize', 'recognition'],
]);
const DUTY_STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'of', 'to']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalized(value) {
  return cleanString(value).toLowerCase();
}

function ordinalCardinal(word) {
  if (IRREGULAR_ENGLISH_ORDINALS.has(word)) return IRREGULAR_ENGLISH_ORDINALS.get(word);
  if (word.endsWith('ieth')) {
    const cardinal = `${word.slice(0, -4)}y`;
    return ENGLISH_CARDINAL_WORDS.has(cardinal) ? cardinal : '';
  }
  if (word.endsWith('th')) {
    const cardinal = word.slice(0, -2);
    return ENGLISH_CARDINAL_WORDS.has(cardinal) ? cardinal : '';
  }
  return '';
}

function isEnglishPresentationNumber(value, { allowCardinal = false } = {}) {
  const normalizedValue = cleanString(value).toLowerCase();
  if (/^\d+$/.test(normalizedValue)) return allowCardinal;
  if (/^\d+(?:st|nd|rd|th)$/.test(normalizedValue)) return true;
  const words = normalizedValue.split(/[ -]+/).filter(Boolean);
  if (!words.length) return false;
  const prefix = words.slice(0, -1);
  const finalCardinal = ordinalCardinal(words.at(-1));
  if (finalCardinal) {
    return prefix.every(word => word === 'and' || ENGLISH_CARDINAL_WORDS.has(word));
  }
  return allowCardinal && words.every(word => word === 'and' || ENGLISH_CARDINAL_WORDS.has(word));
}

function withoutPresentationOrdinal(value) {
  let result = cleanString(value).normalize('NFKC').toLowerCase();
  result = result.replace(/[.!?。！？]+$/u, '').trimEnd();
  result = result.replace(EXPLICIT_PRESENTATION_SUFFIX_RE, ' ');
  result = result.replace(CONTROLLED_CHINESE_PRESENTATION_SUFFIX_RE, ' ');
  const controlledEnglish = CONTROLLED_ENGLISH_PRESENTATION_RE.exec(result);
  if (controlledEnglish && isEnglishPresentationNumber(controlledEnglish[1], { allowCardinal: true })) {
    result = result.slice(0, controlledEnglish.index).trimEnd();
  }
  const bareRecognition = BARE_RECOGNITION_ORDINAL_RE.exec(result);
  if (bareRecognition && isEnglishPresentationNumber(bareRecognition[2])) {
    result = bareRecognition[1];
  }
  return result;
}

function normalizedCommercialDuty(value) {
  const words = withoutPresentationOrdinal(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word && !DUTY_STOP_WORDS.has(word))
    .map(word => DUTY_SYNONYMS.get(word) || word);
  return words.join(' ');
}

function planId(item) {
  return cleanString(isRecord(item) ? item.id : '');
}

function variantIdentityKey(value) {
  if (!isRecord(value) || !Array.isArray(value.facts) || value.facts.length === 0) return '';
  const facts = value.facts.map(fact => ({
    name: cleanString(isRecord(fact) ? fact.name : ''),
    value: cleanString(isRecord(fact) ? fact.value : ''),
  }));
  if (facts.some(fact => !fact.name || !fact.value)) return '';
  return facts
    .map(fact => `${fact.name.normalize('NFKC').toLowerCase()}\u0000${fact.value.normalize('NFKC').toLowerCase()}`)
    .sort()
    .join('\u0001');
}

function submissionEntry(value) {
  if (typeof value === 'string') return { assetId: cleanString(value), count: 1 };
  if (!isRecord(value)) return { assetId: '', count: 0 };
  const assetId = cleanString(value.assetId ?? value.id);
  const count = value.count === undefined ? 1 : value.count;
  return { assetId, count };
}

function plannedCollage(item) {
  const shot = isRecord(item.shotIntent) ? item.shotIntent : {};
  return [
    item.role,
    item.purpose,
    item.communicationGoal,
    item.label,
    shot.type,
    shot.label,
    shot.sceneFamily,
    shot.composition,
  ].some(value => {
    const intent = cleanString(value);
    return COLLAGE_INTENT_RE.test(intent) || MULTI_PANEL_LAYOUT_RE.test(intent);
  });
}

export function validatePlanContract(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new TypeError('asset plan must contain at least one item');
  }

  const ids = new Set();
  const duties = new Map();
  const commercialDutyIds = new Map();
  const skuVariantIdentities = new Set();
  const intents = new Map();
  for (const item of items) {
    if (!isRecord(item)) throw new TypeError('asset plan item must be an object');
    const id = planId(item);
    if (!SAFE_ID_RE.test(id)) throw new TypeError('asset plan item id is invalid');
    if (ids.has(id)) throw new TypeError(`duplicate asset plan item id: ${id}`);
    ids.add(id);

    const role = normalized(item.role);
    if (!role) throw new TypeError(`asset plan item role is required: ${id}`);
    const duty = normalized(item.communicationGoal);
    if (!duty) throw new TypeError(`asset plan communication goal is required: ${id}`);
    const commercialDutyId = cleanString(item.commercialDutyId);
    if (commercialDutyId && !COMMERCIAL_DUTY_ID_RE.test(commercialDutyId)) {
      throw new TypeError(`commercial duty id is invalid: ${id}`);
    }
    const isSkuVariant = role === 'sku' && commercialDutyId === 'sku:variant';
    const variantKey = isSkuVariant ? variantIdentityKey(item.variantIdentity) : '';
    if (isSkuVariant && !variantKey) throw new TypeError(`SKU variant identity is required: ${id}`);
    if (isSkuVariant && skuVariantIdentities.has(variantKey)) {
      throw new TypeError(`duplicate SKU variant identity: ${id}`);
    }
    if (commercialDutyId && commercialDutyIds.has(commercialDutyId) && !isSkuVariant) {
      throw new TypeError(`duplicate commercial duty id: ${commercialDutyIds.get(commercialDutyId)} and ${id}`);
    }
    if (commercialDutyId) commercialDutyIds.set(commercialDutyId, id);
    if (isSkuVariant) skuVariantIdentities.add(variantKey);
    if (plannedCollage(item)) throw new TypeError(`collage or contact sheet intent is forbidden: ${id}`);

    const shot = isRecord(item.shotIntent) ? item.shotIntent : {};
    const evidenceTier = normalized(shot.evidenceTier);
    if (!SAFE_EVIDENCE_TIERS.has(evidenceTier)) {
      throw new TypeError(`unsafe evidence tier for asset plan item: ${id}`);
    }
    const semanticKey = suiteSemanticKey(item);
    if (semanticKey.split('|').some(part => !part)) {
      throw new TypeError(`complete semantic shot intent is required: ${id}`);
    }
    if (intents.has(semanticKey)) {
      throw new TypeError(`duplicate suite intent: ${intents.get(semanticKey)} and ${id}`);
    }
    intents.set(semanticKey, id);

    const dutyKey = normalizedCommercialDuty(duty);
    if (duties.has(dutyKey) && !isSkuVariant) {
      throw new TypeError(`duplicate commercial duty: ${duties.get(dutyKey)} and ${id}`);
    }
    duties.set(dutyKey, id);
  }
  return items;
}

export function assertExecutionCount({
  plan,
  assetRows,
  providerSubmissions,
  quoteUnits = Array.isArray(plan) ? plan.length : 0,
} = {}) {
  validatePlanContract(plan);
  if (!Number.isSafeInteger(quoteUnits) || quoteUnits !== plan.length) {
    throw new Error(`quote unit count mismatch: expected ${plan.length}, received ${quoteUnits}`);
  }
  if (!Array.isArray(assetRows) || assetRows.length !== plan.length) {
    throw new Error(`visible asset row count mismatch: expected ${plan.length}, received ${Array.isArray(assetRows) ? assetRows.length : 0}`);
  }
  if (!Array.isArray(providerSubmissions)) {
    throw new TypeError('provider submissions must be an array');
  }

  const planIds = new Set(plan.map(planId));
  const rowIds = new Set();
  for (const row of assetRows) {
    const assetId = cleanString(isRecord(row) ? row.assetId ?? row.id : row);
    if (!planIds.has(assetId)) throw new Error(`visible asset row is not in plan: ${assetId || 'unknown'}`);
    if (rowIds.has(assetId)) throw new Error(`duplicate visible asset row: ${assetId}`);
    rowIds.add(assetId);
  }
  if (rowIds.size !== planIds.size) throw new Error('visible asset rows do not match plan IDs');

  const submissionCounts = new Map([...planIds].map(id => [id, 0]));
  for (const rawSubmission of providerSubmissions) {
    const { assetId, count } = submissionEntry(rawSubmission);
    if (!planIds.has(assetId)) throw new Error(`provider submission is not in plan: ${assetId || 'unknown'}`);
    if (!Number.isSafeInteger(count) || count <= 0) {
      throw new TypeError(`provider submission count is invalid: ${assetId}`);
    }
    submissionCounts.set(assetId, submissionCounts.get(assetId) + count);
  }

  for (const [assetId, count] of submissionCounts) {
    if (count === 0) throw new Error(`provider submission count mismatch for asset: ${assetId}`);
    if (count > 2) throw new Error(`more than one provider repair for asset: ${assetId}`);
  }
  const submissionsByAsset = Object.fromEntries([...submissionCounts].sort(([left], [right]) => left.localeCompare(right)));
  const totalSubmissions = Object.values(submissionsByAsset).reduce((sum, count) => sum + count, 0);
  return {
    planItems: plan.length,
    quoteUnits,
    visibleAssetRows: assetRows.length,
    initialProviderSubmissions: submissionCounts.size,
    providerSubmissions: totalSubmissions,
    providerRepairs: totalSubmissions - plan.length,
    submissionsByAsset,
  };
}
