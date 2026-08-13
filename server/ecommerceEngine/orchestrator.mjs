import { createHash, randomUUID } from 'node:crypto';

import { getAssetPlanStrategy } from './categoryKnowledge.mjs';
import {
  commercialDutyIdFor,
  LEGACY_HERO_DUTIES,
  TRANSPARENT_DUTIES,
  WHITE_BACKGROUND_DUTIES,
} from './commercialDutyCatalog.mjs';
import { MAX_DETAIL_DUTY_COUNT, resolveLegacyDetailDuty } from './detailDutyPolicy.mjs';
import { sanitizeSnapshot } from './jobStore.mjs';
import { assertExecutionCount, validatePlanContract } from './planContract.mjs';
import { ecommerceFeatureForItem } from './ecommerceBilling.mjs';
import { ecommerceDeliveryMetadataForPlan } from './deliveryMetadata.mjs';
import { normalizeCommerceContext } from './internationalCommerceRegistry.mjs';
import { normalizeEcommerceAbilityPayload, TRY_ON_ID } from './abilityPayload.mjs';

const PARENT_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const ASSET_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const ASSET_WORKER_STOP_STATES = new Set([...ASSET_FINAL_STATES, 'verified']);
const SAFE_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const VISUAL_INPUT_SNAPSHOT_VERSION = 1;
const LEGACY_ORCHESTRATION_SNAPSHOT_VERSION = 1;
const TASK_1_ORCHESTRATION_SNAPSHOT_VERSION = 2;
const TASK_2_ORCHESTRATION_SNAPSHOT_VERSION = 3;
const CURRENT_ORCHESTRATION_SNAPSHOT_VERSION = 4;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function own(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function protectedCopyRequirements(item, productTruth) {
  const requiredText = [];
  const requiredLogos = [];
  const textSeen = new Set();
  const logoSeen = new Set();
  const add = (target, seen, value) => {
    const normalized = cleanString(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    target.push(normalized);
  };

  for (const entry of Array.isArray(own(productTruth, 'packageText')) ? own(productTruth, 'packageText') : []) {
    add(requiredText, textSeen, isRecord(entry) ? own(entry, 'text') ?? own(entry, 'value') : entry);
  }
  for (const logo of Array.isArray(own(productTruth, 'logos')) ? own(productTruth, 'logos') : []) {
    add(requiredLogos, logoSeen, isRecord(logo) ? own(logo, 'description') ?? own(logo, 'name') : logo);
  }
  for (const fact of Array.isArray(own(item, 'requiredFacts')) ? own(item, 'requiredFacts') : []) {
    if (!isRecord(fact)) continue;
    const name = cleanString(own(fact, 'name')).toLowerCase().replace(/[\s_-]+/g, '');
    if (!/label|packagetext|packagecopy|skulabel|variantname|modelname/.test(name)
      && !/包装文字|标签|品名|型号|色号|款号|货号/.test(name)) continue;
    add(requiredText, textSeen, own(fact, 'value'));
  }
  return { requiredLogos, requiredText };
}

function validateId(value, label) {
  const id = cleanString(value);
  if (!SAFE_ID_RE.test(id)) throw new TypeError(`${label} is invalid`);
  return id;
}

function httpError(message, status, code = '') {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function stableAssetId(url) {
  const match = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/i.exec(cleanString(url));
  if (!match) throw new Error('stable generated asset URL is invalid');
  return match[1];
}

function idempotencyKey(jobId, assetId, attempt) {
  const digest = createHash('sha256')
    .update(`${jobId}\u0000${assetId}\u0000${attempt}`)
    .digest('hex');
  return `ecommerce:${digest}`;
}

function durableSubmissionIntents(asset) {
  const intents = own(asset?.requestSnapshot, 'submissionIntents');
  if (!Array.isArray(intents)) return [];
  const result = [];
  const seen = new Set();
  for (const intent of intents) {
    if (!isRecord(intent)) continue;
    const assetId = cleanString(own(intent, 'assetId'));
    const ordinal = own(intent, 'ordinal');
    const kind = cleanString(own(intent, 'kind'));
    const key = cleanString(own(intent, 'idempotencyKey'));
    const status = cleanString(own(intent, 'status'));
    if (!assetId || !Number.isSafeInteger(ordinal) || ordinal < 0
      || !['initial', 'repair'].includes(kind) || !key
      || !['intent', 'acknowledged'].includes(status)) continue;
    const logicalKey = `${assetId}\u0000${ordinal}\u0000${kind}`;
    if (seen.has(logicalKey)) continue;
    seen.add(logicalKey);
    const normalized = { assetId, ordinal, kind, idempotencyKey: key, status };
    const providerJobId = cleanString(own(intent, 'providerJobId'));
    if (status === 'acknowledged' && providerJobId) normalized.providerJobId = providerJobId;
    result.push(normalized);
  }
  return result.sort((left, right) => left.ordinal - right.ordinal);
}

function submissionIntent(asset, { assetId, ordinal, kind, key }) {
  const intents = durableSubmissionIntents(asset);
  const existing = intents.find(intent => intent.ordinal === ordinal && intent.kind === kind);
  if (existing) {
    if (existing.assetId !== assetId || existing.idempotencyKey !== key) {
      throw new Error(`provider submission intent changed for asset: ${assetId}`);
    }
    return { intent: existing, intents };
  }
  const intent = { assetId, ordinal, kind, idempotencyKey: key, status: 'intent' };
  return { intent, intents: [...intents, intent].sort((left, right) => left.ordinal - right.ordinal) };
}

function acknowledgeSubmissionIntents(asset, intent, providerJobId) {
  return durableSubmissionIntents(asset).map(candidate => (
    candidate.ordinal === intent.ordinal && candidate.kind === intent.kind
      ? { ...candidate, status: 'acknowledged', providerJobId }
      : candidate
  ));
}

function hasProviderRepairRequest(asset) {
  const request = own(asset?.requestSnapshot, 'request');
  const requestKind = cleanString(own(request, 'kind') ?? own(request, 'submissionKind')).toLowerCase();
  const requestPrompt = cleanString(own(request, 'prompt'));
  return requestKind === 'repair'
    || /targeted\s+system\s+repair|(?:^|[;\n])\s*repair\s+[^;\n]+[;\n][\s\S]*?\battempt\s+\d+/i.test(requestPrompt);
}

function providerSubmissionCount(asset) {
  const evidence = new Map();
  const identities = new Map();
  const addEvidence = ({ ordinal, kind, idempotencyKey: key = '', providerJobId = '' }) => {
    const logicalKey = `${ordinal}\u0000${kind}`;
    const stableIdentities = [
      cleanString(key) && `key:${cleanString(key)}`,
      cleanString(providerJobId) && `job:${cleanString(providerJobId)}`,
    ].filter(Boolean);
    const existingKey = stableIdentities.map(identity => identities.get(identity)).find(Boolean);
    const targetKey = evidence.has(logicalKey) ? logicalKey : existingKey || logicalKey;
    if (!evidence.has(targetKey)) evidence.set(targetKey, { ordinal, kind });
    for (const identity of stableIdentities) identities.set(identity, targetKey);
  };

  for (const intent of durableSubmissionIntents(asset)) addEvidence(intent);

  const repairRequest = hasProviderRepairRequest(asset);
  const providerJobId = cleanString(own(asset, 'providerJobId'));
  if (providerJobId) {
    addEvidence({
      ordinal: repairRequest ? 1 : 0,
      kind: repairRequest ? 'repair' : 'initial',
      providerJobId,
    });
  }
  if (repairRequest) addEvidence({ ordinal: 1, kind: 'repair' });
  if ([...evidence.values()].some(entry => entry.kind === 'repair')) {
    addEvidence({ ordinal: 0, kind: 'initial' });
  }

  const durableCount = own(own(asset?.requestSnapshot, 'executionCount'), 'providerSubmissions');
  if (Number.isSafeInteger(durableCount) && durableCount >= 0) {
    for (let index = evidence.size; index < durableCount; index += 1) {
      evidence.set(`legacy-count\u0000${index}`, { ordinal: index, kind: 'legacy' });
    }
  }
  return evidence.size;
}

function withProviderSubmissionCount(asset, requestSnapshot, providerJobId = own(asset, 'providerJobId')) {
  const nextAsset = { ...asset, providerJobId, requestSnapshot };
  return {
    ...requestSnapshot,
    executionCount: {
      ...own(requestSnapshot, 'executionCount'),
      providerSubmissions: providerSubmissionCount(nextAsset),
    },
  };
}

function deterministicRepairCount(asset) {
  const count = own(own(own(asset, 'requestSnapshot'), 'executionCount'), 'deterministicRepairs');
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function withDeterministicRepairCount(asset) {
  const requestSnapshot = own(asset, 'requestSnapshot') || {};
  return {
    ...requestSnapshot,
    executionCount: {
      ...own(requestSnapshot, 'executionCount'),
      deterministicRepairs: deterministicRepairCount(asset) + 1,
    },
  };
}

function providerSubmissionEntries(assets) {
  return assets.flatMap(asset => {
    const count = providerSubmissionCount(asset);
    return count > 0 ? [{ assetId: asset.assetId, count }] : [];
  });
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : 'unknown ecommerce orchestration error';
}

const RETRYABLE_GENERATED_ASSET_STORAGE_CODES = new Set([
  'EIO',
  'ENOSPC',
  'EBUSY',
  'EAGAIN',
  'EMFILE',
  'ENFILE',
  'ETIMEDOUT',
]);

function mapGeneratedAssetStorageError(error) {
  const errorName = cleanString(error?.name);
  if (error?.retryable !== true
    && errorName !== 'TimeoutError'
    && errorName !== 'AbortError'
    && !RETRYABLE_GENERATED_ASSET_STORAGE_CODES.has(cleanString(error?.code).toUpperCase())) {
    return error;
  }
  const mapped = httpError(
    '生成图片暂时无法保存，请稍后重试',
    503,
    'GENERATED_ASSET_STORAGE_UNAVAILABLE',
  );
  mapped.retryable = true;
  mapped.cause = error;
  return mapped;
}

function resultImages(assets) {
  return Object.fromEntries(assets
    .filter(asset => asset.state === 'completed' && asset.stableUrl)
    .map(asset => [asset.assetId, asset.stableUrl]));
}

function publicAssetError(asset) {
  const state = cleanString(own(asset, 'state'));
  if (state === 'needs_review') return '这张图片暂未完成，可继续补全';
  if (state === 'failed' || state === 'cancelled') return '图片生成未完成，本张未计费';
  return '';
}

function publicAsset(asset) {
  const plan = isRecord(own(asset?.requestSnapshot, 'assetPlanItem'))
    ? own(asset.requestSnapshot, 'assetPlanItem')
    : {};
  const state = cleanString(own(asset, 'state'));
  const result = {
    assetId: cleanString(own(asset, 'assetId')),
    state,
    ...ecommerceDeliveryMetadataForPlan(plan),
    error: publicAssetError(asset),
  };
  if (state === 'completed' && cleanString(own(asset, 'stableUrl'))) {
    result.stableUrl = cleanString(own(asset, 'stableUrl'));
  }
  if (state === 'needs_review' && cleanString(own(asset, 'stableUrl'))) {
    result.previewUrl = cleanString(own(asset, 'stableUrl'));
  }
  return result;
}

function assetSource(value) {
  if (typeof value === 'string') return cleanString(value);
  return cleanString(
    own(value, 'url')
    ?? own(value, 'sourceUrl')
    ?? own(value, 'source_url'),
  );
}

function normalizeAuxiliaryAssetGroup(values, prefix) {
  const source = Array.isArray(values) ? values : [];
  return source.flatMap((value, index) => {
    const url = assetSource(value);
    if (!url) return [];
    const candidateId = cleanString(
      own(value, 'assetId')
      ?? own(value, 'asset_id')
      ?? own(value, 'id'),
    );
    const assetId = SAFE_ID_RE.test(candidateId) ? candidateId : `${prefix}-${index + 1}`;
    return [{ assetId, url }];
  });
}

function invalidVisualAssetInput(message) {
  return Object.assign(httpError(message, 400, 'VISUAL_ANALYSIS_INVALID_INPUT'), {
    retryable: false,
  });
}

function suppliedAssetGroups(explicit, payload, explicitKeys, legacyKey) {
  const groups = [];
  for (const key of explicitKeys) {
    if (Object.hasOwn(explicit, key)) groups.push({ values: explicit[key], legacy: false });
  }
  if (Object.hasOwn(payload, legacyKey)) groups.push({ values: payload[legacyKey], legacy: true });
  return groups;
}

function normalizeFormalAsset(value, label) {
  if (!isRecord(value)) {
    throw invalidVisualAssetInput(`${label} asset must include an ID and URL`);
  }
  const url = cleanString(own(value, 'url'));
  if (!url) throw invalidVisualAssetInput(`${label} asset URL is required`);
  const assetId = cleanString(own(value, 'assetId'));
  if (!SAFE_ID_RE.test(assetId)) {
    throw invalidVisualAssetInput(`${label} asset ID is invalid`);
  }
  return { assetId, url };
}

async function normalizeFormalAssetGroups(groups, label, { job, migrateLegacyVisualAsset }) {
  let selected = null;
  for (const { values, legacy } of groups) {
    if (!Array.isArray(values)) {
      throw invalidVisualAssetInput(`${label} assets must be an array`);
    }
    const normalized = [];
    for (const [index, value] of values.entries()) {
      if (typeof value === 'string' && legacy) {
        if (job.visualInputSchemaVersion !== null) {
          throw invalidVisualAssetInput(`${label} asset must include an ID and URL`);
        }
        const migrated = await migrateLegacyVisualAsset({
          source: value,
          type: label,
          index,
          jobId: job.id,
        });
        normalized.push(normalizeFormalAsset(migrated, label));
        continue;
      }
      normalized.push(normalizeFormalAsset(value, label));
    }
    if (selected === null) selected = normalized;
  }
  return selected ?? [];
}

async function assetsFromPayload(payload, { job, migrateLegacyVisualAsset }) {
  const explicitValue = own(payload, 'assets');
  if (explicitValue !== undefined && !isRecord(explicitValue)) {
    throw invalidVisualAssetInput('visual assets must be an object');
  }
  const explicit = isRecord(explicitValue) ? explicitValue : {};
  const abilityRecipe = own(payload, 'ability_recipe');
  const abilityId = cleanString(isRecord(abilityRecipe) ? own(abilityRecipe, 'id') : '');
  if (abilityId === TRY_ON_ID) {
    const items = await normalizeFormalAssetGroups(
      suppliedAssetGroups(explicit, payload, ['items', 'products', 'product'], 'real_shots'),
      'items',
      { job, migrateLegacyVisualAsset },
    );
    const person = await normalizeFormalAssetGroups(
      suppliedAssetGroups(explicit, payload, ['person', 'people'], 'person_images'),
      'person',
      { job, migrateLegacyVisualAsset },
    );
    const scene = await normalizeFormalAssetGroups(
      suppliedAssetGroups(explicit, payload, ['scene', 'scenes'], 'scene_images'),
      'scene',
      { job, migrateLegacyVisualAsset },
    );
    const proof = normalizeAuxiliaryAssetGroup(
      own(explicit, 'proof') ?? own(explicit, 'proofs') ?? own(payload, 'uploaded_proofs'),
      'proof',
    );
    const protection = normalizeAuxiliaryAssetGroup(own(explicit, 'protection'), 'protection');
    return {
      product: items,
      reference: [],
      items,
      person,
      scene,
      proof,
      protection,
    };
  }
  const product = await normalizeFormalAssetGroups(
    suppliedAssetGroups(explicit, payload, ['product', 'products'], 'real_shots'),
    'product',
    { job, migrateLegacyVisualAsset },
  );
  const reference = await normalizeFormalAssetGroups(
    suppliedAssetGroups(explicit, payload, ['reference', 'references'], 'reference_images'),
    'reference',
    { job, migrateLegacyVisualAsset },
  );
  const proof = normalizeAuxiliaryAssetGroup(
    own(explicit, 'proof') ?? own(explicit, 'proofs') ?? own(payload, 'uploaded_proofs'),
    'proof',
  );
  const protection = normalizeAuxiliaryAssetGroup(own(explicit, 'protection'), 'protection');
  return { product, reference, proof, protection };
}

function summarizeAssets(assets) {
  const summary = {
    total: assets.length,
    completed: 0,
    needsReview: 0,
    failed: 0,
    active: 0,
    delivered: 0,
    charged: 0,
    released: 0,
    retryable: 0,
  };
  for (const asset of assets) {
    if (asset.state === 'completed') {
      summary.completed += 1;
      summary.delivered += 1;
      summary.charged += 1;
    } else if (asset.state === 'needs_review') {
      summary.needsReview += 1;
      summary.released += 1;
      summary.retryable += 1;
    } else if (asset.state === 'failed' || asset.state === 'cancelled') {
      summary.failed += 1;
      summary.released += 1;
      if (asset.state === 'failed') summary.retryable += 1;
    } else {
      summary.active += 1;
    }
  }
  return summary;
}

function directionFromPayload(payload) {
  const direction = own(payload, 'direction');
  if (isRecord(direction)) return direction;
  return {
    id: 'smart',
    title: '智能电商方案',
    brief: cleanString(own(payload, 'selling_points')),
  };
}

function commerceContextFromPayload(payload) {
  const supplied = own(payload, 'commerce_context');
  const context = isRecord(supplied) ? supplied : {};
  return normalizeCommerceContext({
    ...context,
    platform: own(context, 'platform') || own(payload, 'platform'),
    contentType: own(context, 'contentType') || own(payload, 'content_type'),
    targetLanguage: own(context, 'targetLanguage')
      || own(payload, 'target_language')
      || own(payload, 'language')
      || 'zh-CN',
  });
}

function campaignOverrides(payload, direction, assets) {
  const commerceContext = commerceContextFromPayload(payload);
  const abilityId = cleanString(own(own(payload, 'ability_recipe'), 'id'));
  const referenceAssets = abilityId === TRY_ON_ID ? assets.scene : assets.reference;
  return {
    editableBrief: own(direction, 'editableBrief')
      ?? own(direction, 'execution_guide')
      ?? own(direction, 'description')
      ?? own(direction, 'brief')
      ?? '',
    customColors: Array.isArray(own(payload, 'custom_colors')) ? own(payload, 'custom_colors') : [],
    referenceAssetIds: Array.isArray(own(payload, 'reference_asset_ids'))
      ? own(payload, 'reference_asset_ids')
      : referenceAssets.map(asset => asset.assetId),
    category: cleanString(own(payload, 'category')),
    priceBand: cleanString(own(payload, 'price_band')),
    language: commerceContext.targetLanguage === 'visual' ? 'zh-CN' : commerceContext.locale,
  };
}

function terminalParentState(assets) {
  if (assets.some(asset => !ASSET_FINAL_STATES.has(asset.state))) return null;
  if (assets.length > 0 && assets.every(asset => asset.state === 'completed')) return 'completed';
  if (assets.some(asset => asset.state === 'completed' || asset.state === 'needs_review')) return 'needs_review';
  return 'failed';
}

function normalizedProviderResult(result, providerJobId) {
  if (!isRecord(result)) throw new Error('provider poll returned an invalid result');
  const status = cleanString(own(result, 'status')).toLowerCase();
  if (status === 'failed') {
    const statusCode = Number(own(result, 'statusCode') ?? own(result, 'httpStatus'));
    const errorCode = cleanString(own(result, 'code') ?? own(result, 'errorCode')).toUpperCase();
    const retryable = own(result, 'retryable') === true
      || statusCode === 408
      || statusCode === 425
      || statusCode === 429
      || statusCode >= 500
      || /(?:TIMEOUT|RATE_LIMIT|UNAVAILABLE|OVERLOAD|NETWORK)/.test(errorCode);
    throw Object.assign(new Error(cleanString(own(result, 'error')) || 'provider generation failed'), {
      code: retryable ? 'PROVIDER_GENERATION_TRANSIENT' : 'PROVIDER_GENERATION_FAILED',
      retryable,
    });
  }
  const outputUrl = cleanString(own(result, 'outputUrl'));
  if (status !== 'completed' || !outputUrl) {
    throw Object.assign(new Error('provider job did not complete with an output URL'), {
      code: 'PROVIDER_OUTPUT_MISSING',
      retryable: true,
      jobId: providerJobId,
    });
  }
  return { outputUrl };
}

function validateAssetPlan(assetPlan) {
  if (!Array.isArray(assetPlan) || assetPlan.length === 0) {
    throw new Error('asset plan is empty');
  }
  const ids = new Set();
  for (const item of assetPlan) {
    const id = validateId(own(item, 'id'), 'asset plan item id');
    if (ids.has(id)) throw new Error(`duplicate asset plan item id: ${id}`);
    ids.add(id);
  }
  return assetPlan;
}

function invalidOrchestrationSnapshot() {
  return Object.assign(
    httpError('任务恢复数据无效', 500, 'ORCHESTRATION_SNAPSHOT_INVALID'),
    { retryable: false },
  );
}

function visualInputSnapshotFromProgress(progress) {
  const snapshot = own(progress, 'visualInputSnapshot');
  if (snapshot === undefined) return null;
  if (!isRecord(snapshot)
    || own(snapshot, 'schemaVersion') !== VISUAL_INPUT_SNAPSHOT_VERSION
    || !isRecord(own(snapshot, 'assets'))) {
    throw invalidOrchestrationSnapshot();
  }
  const assets = snapshot.assets;
  const normalized = {};
  try {
    for (const label of ['product', 'reference', 'proof', 'protection']) {
      const group = own(assets, label);
      if (!Array.isArray(group)) throw new TypeError(`${label} assets must be an array`);
      normalized[label] = group.map(asset => normalizeFormalAsset(asset, label));
    }
    const abilityId = cleanString(own(own(snapshot, 'ability_recipe'), 'id'));
    const hasSemanticAssets = abilityId === TRY_ON_ID
      || ['items', 'person', 'scene'].some(label => Object.hasOwn(assets, label));
    if (hasSemanticAssets) {
      for (const label of ['items', 'person', 'scene']) {
        const group = own(assets, label);
        normalized[label] = Array.isArray(group)
          ? group.map(asset => normalizeFormalAsset(asset, label))
          : [];
      }
    }
  } catch (error) {
    throw Object.assign(invalidOrchestrationSnapshot(), { cause: error });
  }
  return sanitizeSnapshot({
    schemaVersion: VISUAL_INPUT_SNAPSHOT_VERSION,
    assets: normalized,
    ...(isRecord(own(snapshot, 'ability_recipe')) ? { ability_recipe: own(snapshot, 'ability_recipe') } : {}),
    ...(cleanString(own(snapshot, 'person_mode')) ? { person_mode: own(snapshot, 'person_mode') } : {}),
  });
}

function validateOrchestrationSnapshot(snapshot, { requireVisualAnalysis }) {
  if (!isRecord(snapshot)
    || !isRecord(own(snapshot, 'productTruth'))
    || !isRecord(own(snapshot, 'campaignBible'))
    || !Array.isArray(own(snapshot, 'assetPlan'))
    || !isRecord(own(snapshot, 'deterministicInputs'))
    || (requireVisualAnalysis && !isRecord(own(snapshot, 'styleReferenceProfile')))
    || (requireVisualAnalysis && !isRecord(own(snapshot, 'visualAnalysisCache')))) {
    throw invalidOrchestrationSnapshot();
  }
  try {
    validateAssetPlan(snapshot.assetPlan);
    if (own(snapshot, 'schemaVersion') === CURRENT_ORCHESTRATION_SNAPSHOT_VERSION) {
      validatePlanContract(snapshot.assetPlan);
    }
  } catch (error) {
    throw Object.assign(invalidOrchestrationSnapshot(), { cause: error });
  }
  return snapshot;
}

function legacySceneFamily(type) {
  return {
    identity: 'studio_identity',
    feature: 'feature_demonstration',
    usage_scale: 'lifestyle_context',
    alternate_angle: 'exterior_angle_study',
    open_state: 'confirmed_interaction_state',
    material_macro: 'material_evidence',
    component_relationship: 'component_evidence',
    exploded_view: 'confirmed_structure_evidence',
    packaging: 'packaging_context',
  }[cleanString(type).toLowerCase()] || 'evidence_safe_product_scene';
}

function roleCatalogDuty(role, occurrence) {
  if (['main', 'main_text', 'main_3x4'].includes(role)) {
    if (!LEGACY_HERO_DUTIES[occurrence]) {
      throw new TypeError(`legacy ${role} count exceeds the canonical commercial duty catalog`);
    }
    return LEGACY_HERO_DUTIES[occurrence];
  }
  if (role === 'white_background') {
    if (!WHITE_BACKGROUND_DUTIES[occurrence]) {
      throw new TypeError('legacy white-background count exceeds the canonical commercial duty catalog');
    }
    return WHITE_BACKGROUND_DUTIES[occurrence];
  }
  if (role === 'transparent') {
    if (!TRANSPARENT_DUTIES[occurrence]) {
      throw new TypeError('legacy transparent count exceeds the canonical commercial duty catalog');
    }
    return TRANSPARENT_DUTIES[occurrence];
  }
  return null;
}

function trustedProofAssetIds(deterministicInputs = {}) {
  const assets = own(deterministicInputs, 'assets');
  return new Set(['proof', 'protection'].flatMap(group => Array.isArray(own(assets, group)) ? own(assets, group) : [])
    .map(asset => cleanString(own(asset, 'assetId')))
    .filter(Boolean));
}

const LEGACY_SKU_FACT_NAMES = new Set(['color', 'size', 'capacity', 'dimlabel', 'count']);

function legacySkuVariantIdentity(item) {
  const seen = new Set();
  const facts = [];
  for (const fact of Array.isArray(own(item, 'requiredFacts')) ? own(item, 'requiredFacts') : []) {
    const name = cleanString(own(fact, 'name'));
    const value = cleanString(own(fact, 'value'));
    const normalizedName = name.toLowerCase();
    if (!LEGACY_SKU_FACT_NAMES.has(normalizedName) || !value || seen.has(normalizedName)) {
      throw new TypeError('legacy SKU variant facts are missing or duplicated');
    }
    seen.add(normalizedName);
    facts.push({ name, value });
  }
  if (!facts.length) throw new TypeError('legacy SKU variant facts are required');
  return {
    facts: facts.sort((left, right) => `${left.name}\u0000${left.value}`.localeCompare(`${right.name}\u0000${right.value}`)),
  };
}

function legacySkuGoal(variantIdentity) {
  const facts = variantIdentity.facts.map(fact => `${fact.name}: ${fact.value}`).join(', ');
  return `Help the buyer choose the confirmed SKU variant: ${facts}.`;
}

function detailMigrationDuty(item, sourceRole, productTruth, usedSemanticFamilies, trustedProofIds) {
  const strategy = getAssetPlanStrategy(cleanString(own(productTruth, 'category')));
  const proofRole = cleanString(strategy?.proofRole);
  const proofAssetIds = Array.isArray(own(item, 'proofAssetIds')) ? own(item, 'proofAssetIds') : [];
  const requiredFacts = Array.isArray(own(item, 'requiredFacts')) ? own(item, 'requiredFacts') : [];
  const declaredProofIds = [...proofAssetIds, ...requiredFacts
    .filter(fact => cleanString(own(fact, 'name')) === 'proofAssetId')
    .map(fact => cleanString(own(fact, 'value')))].filter(Boolean);
  const retainedProofIds = [...new Set(declaredProofIds)];
  const hasProofEvidence = retainedProofIds.length > 0 && retainedProofIds.every(id => trustedProofIds.has(id));
  if (proofRole && sourceRole === `detail_slice_${proofRole}` && hasProofEvidence) {
    return {
      role: sourceRole,
      key: 'proofanswer',
      goal: 'Communicate quality or certification information backed only by uploaded proof assets.',
      purpose: 'Quality or certification information backed only by uploaded proof assets.',
      requiredFacts: retainedProofIds.map(value => ({ name: 'proofAssetId', value })),
      generationMode: 'deterministic_overlay',
      proofAssetIds: retainedProofIds,
      proofDuty: true,
    };
  }
  const duty = resolveLegacyDetailDuty({
    strategy,
    productTruth,
    sourceRole,
    usedSemanticFamilies,
  });
  const productName = cleanString(own(productTruth, 'productName'));
  return {
    role: `detail_slice_${duty.roleName}`,
    key: duty.dutyKey,
    goal: duty.goal,
    purpose: duty.purpose,
    requiredFacts: duty.evidenceType
      ? duty.requiredFacts
      : productName ? [{ name: 'productName', value: productName }] : [],
    generationMode: duty.evidenceType ? 'deterministic_overlay' : 'edit',
    proofDuty: false,
  };
}

function upgradePlanItems(assetPlan, productTruth = {}, deterministicInputs = {}) {
  const roleOccurrences = new Map();
  const usedDetailFamilies = new Set();
  let ordinaryDetailCount = 0;
  return assetPlan.map(item => {
    const sourceRole = cleanString(own(item, 'role')).toLowerCase();
    const occurrence = roleOccurrences.get(sourceRole) || 0;
    roleOccurrences.set(sourceRole, occurrence + 1);
    const detailDuty = sourceRole.startsWith('detail_slice_')
      ? detailMigrationDuty(item, sourceRole, productTruth, usedDetailFamilies, trustedProofAssetIds(deterministicInputs))
      : null;
    const variantIdentity = sourceRole === 'sku' ? legacySkuVariantIdentity(item) : null;
    if (detailDuty && !detailDuty.proofDuty) {
      ordinaryDetailCount += 1;
      if (ordinaryDetailCount > MAX_DETAIL_DUTY_COUNT) {
        throw new TypeError('legacy detail count exceeds the evidence-safe commercial duty catalog');
      }
    }
    const catalogDuty = detailDuty || roleCatalogDuty(sourceRole, occurrence);
    const role = catalogDuty?.role || sourceRole;
    const heroPlacement = sourceRole === 'main_3x4'
      ? 'Vertical marketplace placement.'
      : sourceRole === 'main_text' ? 'Text-ready square marketplace placement.' : '';
    const communicationGoal = variantIdentity
      ? legacySkuGoal(variantIdentity)
      : (heroPlacement && catalogDuty?.goal)
        ? `${heroPlacement} ${catalogDuty.goal}`
        : catalogDuty?.goal
      || cleanString(own(item, 'communicationGoal'))
      || cleanString(own(item, 'purpose'))
      || `Commercial duty for ${role}`;
    const purpose = variantIdentity
      ? `SKU variant decision asset for ${variantIdentity.facts.map(fact => `${fact.name}: ${fact.value}`).join(', ')}, using only the user-provided values.`
      : catalogDuty?.purpose
      || cleanString(own(item, 'purpose'))
      || communicationGoal;
    const commercialDutyId = commercialDutyIdFor(
      role,
      variantIdentity ? 'variant' : catalogDuty?.key || 'legacybuyeranswer',
    );
    const shotIntent = isRecord(own(item, 'shotIntent')) ? own(item, 'shotIntent') : {};
    const type = cleanString(own(shotIntent, 'type'));
    const evidenceTier = cleanString(own(shotIntent, 'evidenceTier'))
      || (type === 'exploded_view' ? 'confirmed_only'
        : ['component_relationship', 'open_state'].includes(type) ? 'conditional' : 'safe');
    return {
      ...item,
      role,
      purpose,
      commercialDutyId,
      communicationGoal,
      ...(variantIdentity ? { variantIdentity } : {}),
      ...(detailDuty ? {
        requiredFacts: detailDuty.requiredFacts,
        generationMode: detailDuty.generationMode,
        proofAssetIds: detailDuty.proofAssetIds || [],
      } : {}),
      shotIntent: {
        ...shotIntent,
        sceneFamily: cleanString(own(shotIntent, 'sceneFamily')) || legacySceneFamily(type),
        evidenceTier,
      },
    };
  });
}

function upgradeTask1Snapshot(snapshot) {
  const migrated = sanitizeSnapshot({
    ...snapshot,
    schemaVersion: CURRENT_ORCHESTRATION_SNAPSHOT_VERSION,
    assetPlan: upgradePlanItems(snapshot.assetPlan, snapshot.productTruth, snapshot.deterministicInputs),
  });
  return validateOrchestrationSnapshot(migrated, { requireVisualAnalysis: true });
}

function upgradeTask2Snapshot(snapshot) {
  const migrated = sanitizeSnapshot({
    ...snapshot,
    schemaVersion: CURRENT_ORCHESTRATION_SNAPSHOT_VERSION,
    assetPlan: upgradePlanItems(snapshot.assetPlan, snapshot.productTruth, snapshot.deterministicInputs),
  });
  return validateOrchestrationSnapshot(migrated, { requireVisualAnalysis: true });
}

function upgradeLegacySnapshot(snapshot) {
  const migrated = sanitizeSnapshot({
    ...snapshot,
    schemaVersion: LEGACY_ORCHESTRATION_SNAPSHOT_VERSION,
    assetPlan: upgradePlanItems(snapshot.assetPlan, snapshot.productTruth, snapshot.deterministicInputs),
  });
  validateOrchestrationSnapshot(migrated, { requireVisualAnalysis: false });
  validatePlanContract(migrated.assetPlan);
  return migrated;
}

function orchestrationSnapshotFromProgress(progress) {
  const snapshot = own(progress, 'orchestrationSnapshot');
  if (snapshot === undefined) return { migrated: false, snapshot: null };
  if (!isRecord(snapshot)) throw invalidOrchestrationSnapshot();

  const version = own(snapshot, 'schemaVersion');
  if (version === undefined) {
    const hasStyleProfile = Object.hasOwn(snapshot, 'styleReferenceProfile');
    const hasVisualCache = Object.hasOwn(snapshot, 'visualAnalysisCache');
    if (hasStyleProfile !== hasVisualCache) throw invalidOrchestrationSnapshot();
    const migratedVersion = hasStyleProfile
      ? TASK_1_ORCHESTRATION_SNAPSHOT_VERSION
      : LEGACY_ORCHESTRATION_SNAPSHOT_VERSION;
    validateOrchestrationSnapshot(snapshot, {
      requireVisualAnalysis: migratedVersion === CURRENT_ORCHESTRATION_SNAPSHOT_VERSION,
    });
    const migratedSnapshot = sanitizeSnapshot({ ...snapshot, schemaVersion: migratedVersion });
    if (migratedVersion === TASK_1_ORCHESTRATION_SNAPSHOT_VERSION) {
      return { migrated: true, snapshot: upgradeTask1Snapshot(migratedSnapshot) };
    }
    return { migrated: true, snapshot: upgradeLegacySnapshot(migratedSnapshot) };
  }
  if (version === LEGACY_ORCHESTRATION_SNAPSHOT_VERSION) {
    return { migrated: true, snapshot: upgradeLegacySnapshot(snapshot) };
  }
  if (version === TASK_1_ORCHESTRATION_SNAPSHOT_VERSION) {
    validateOrchestrationSnapshot(snapshot, { requireVisualAnalysis: true });
    return { migrated: true, snapshot: upgradeTask1Snapshot(snapshot) };
  }
  if (version === TASK_2_ORCHESTRATION_SNAPSHOT_VERSION) {
    return { migrated: true, snapshot: upgradeTask2Snapshot(snapshot) };
  }
  if (version === CURRENT_ORCHESTRATION_SNAPSHOT_VERSION) {
    return {
      migrated: false,
      snapshot: validateOrchestrationSnapshot(snapshot, { requireVisualAnalysis: true }),
    };
  }
  throw invalidOrchestrationSnapshot();
}

function retryAssetPlanFromProgress(progress) {
  const retryAssetPlan = own(progress, 'retryAssetPlan');
  if (retryAssetPlan === undefined) return null;
  try {
    return validatePlanContract(retryAssetPlan);
  } catch (error) {
    throw Object.assign(invalidOrchestrationSnapshot(), { cause: error });
  }
}

export function createEcommerceOrchestrator(deps = {}) {
  const jobs = own(deps, 'jobs');
  if (!jobs || typeof jobs.create !== 'function' || typeof jobs.get !== 'function'
    || typeof jobs.transition !== 'function' || typeof jobs.checkpoint !== 'function'
    || typeof jobs.claim !== 'function' || typeof jobs.renewLease !== 'function'
    || typeof jobs.releaseLease !== 'function' || !jobs.assets) {
    throw new TypeError('durable generation jobs with an asset store are required');
  }
  const store = jobs.assets;
  const imageGenerationPool = own(deps, 'imageGenerationPool');
  if (!imageGenerationPool || typeof imageGenerationPool.run !== 'function') {
    throw new TypeError('imageGenerationPool with run() is required');
  }
  const migrateLegacyVisualAsset = requireFunction(
    own(deps, 'migrateLegacyVisualAsset'),
    'migrateLegacyVisualAsset',
  );
  const analyzeVisualInputs = requireFunction(own(deps, 'analyzeVisualInputs'), 'analyzeVisualInputs');
  const fallbackVisualInputs = typeof own(deps, 'fallbackVisualInputs') === 'function'
    ? own(deps, 'fallbackVisualInputs')
    : null;
  const compileCampaignBible = requireFunction(own(deps, 'compileCampaignBible'), 'compileCampaignBible');
  const buildAssetPlan = requireFunction(own(deps, 'buildAssetPlan'), 'buildAssetPlan');
  const compileAssetRequest = requireFunction(own(deps, 'compileAssetRequest'), 'compileAssetRequest');
  const providerAdapter = own(deps, 'providerAdapter');
  if (!providerAdapter || typeof providerAdapter.submitEdit !== 'function'
    || typeof providerAdapter.pollUntilReady !== 'function') {
    throw new TypeError('providerAdapter submitEdit and pollUntilReady are required');
  }
  const generatedAssetStore = own(deps, 'generatedAssetStore');
  if (!generatedAssetStore || typeof generatedAssetStore.persist !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persist and read are required');
  }
  const evaluateAsset = requireFunction(own(deps, 'evaluateAsset'), 'evaluateAsset');
  const planRepair = requireFunction(own(deps, 'planRepair'), 'planRepair');
  const billing = own(deps, 'billing');
  if (!billing || typeof billing.hold !== 'function'
    || typeof billing.settle !== 'function'
    || typeof billing.release !== 'function'
    || typeof billing.releaseRemainder !== 'function') {
    throw new TypeError('billing hold, settle, release, and releaseRemainder are required');
  }
  const prepareProviderRequest = typeof own(deps, 'prepareProviderRequest') === 'function'
    ? own(deps, 'prepareProviderRequest')
    : async request => request;
  const repairAsset = typeof own(deps, 'repairAsset') === 'function' ? own(deps, 'repairAsset') : null;
  const qualityAdapters = isRecord(own(deps, 'qualityAdapters')) ? own(deps, 'qualityAdapters') : {};
  const persistWorkSnapshot = typeof own(deps, 'persistWorkSnapshot') === 'function'
    ? own(deps, 'persistWorkSnapshot')
    : null;
  const evaluateSuiteDiversity = typeof own(deps, 'evaluateSuiteDiversity') === 'function'
    ? own(deps, 'evaluateSuiteDiversity')
    : async () => ({ passed: true, issueCodes: [], details: {} });
  const projectLifecycle = own(deps, 'projectLifecycle') ?? null;
  if (projectLifecycle && (typeof projectLifecycle.begin !== 'function'
    || typeof projectLifecycle.complete !== 'function'
    || typeof projectLifecycle.terminate !== 'function')) {
    throw new TypeError('projectLifecycle begin, complete, and terminate are required');
  }
  const suiteDiversityQueues = new Map();
  const assetLeaseMs = Number.isSafeInteger(own(deps, 'assetLeaseMs')) && own(deps, 'assetLeaseMs') > 0
    ? own(deps, 'assetLeaseMs')
    : 30_000;
  const leaseHeartbeatMs = Number.isSafeInteger(own(deps, 'leaseHeartbeatMs'))
    && own(deps, 'leaseHeartbeatMs') > 0
    && own(deps, 'leaseHeartbeatMs') < assetLeaseMs
    ? own(deps, 'leaseHeartbeatMs')
    : Math.max(10, Math.floor(assetLeaseMs / 3));
  const assetConcurrency = Number.isSafeInteger(own(deps, 'assetConcurrency'))
    ? Math.max(1, Math.min(4, own(deps, 'assetConcurrency')))
    : 3;
  const qualityConcurrency = Number.isSafeInteger(own(deps, 'qualityConcurrency'))
    ? Math.max(1, Math.min(2, own(deps, 'qualityConcurrency')))
    : 1;
  const qualityUnavailableRetryDelaysMs = own(deps, 'qualityUnavailableRetryDelaysMs') ?? [1_000, 3_000];
  if (!Array.isArray(qualityUnavailableRetryDelaysMs)
    || qualityUnavailableRetryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)) {
    throw new TypeError('qualityUnavailableRetryDelaysMs must contain non-negative safe integers');
  }
  const sleep = typeof own(deps, 'sleep') === 'function'
    ? own(deps, 'sleep')
    : delay => new Promise(resolve => setTimeout(resolve, delay));
  let activeQualityReviews = 0;
  const qualityWaiters = [];
  async function acquireQualitySlot() {
    if (activeQualityReviews >= qualityConcurrency) {
      await new Promise(resolve => qualityWaiters.push(resolve));
    }
    activeQualityReviews += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeQualityReviews -= 1;
      qualityWaiters.shift()?.();
    };
  }
  const parentLeaseMs = Number.isSafeInteger(own(deps, 'parentLeaseMs')) && own(deps, 'parentLeaseMs') > 0
    ? own(deps, 'parentLeaseMs')
    : 30_000;
  const parentLeaseHeartbeatMs = Number.isSafeInteger(own(deps, 'parentLeaseHeartbeatMs'))
    && own(deps, 'parentLeaseHeartbeatMs') > 0
    && own(deps, 'parentLeaseHeartbeatMs') < parentLeaseMs
    ? own(deps, 'parentLeaseHeartbeatMs')
    : Math.max(10, Math.floor(parentLeaseMs / 3));
  const activeRuns = new Set();
  const idleWaiters = new Set();

  function notifyRuntimeIdle() {
    if (activeRuns.size) return;
    for (const resolve of idleWaiters) resolve(true);
    idleWaiters.clear();
  }

  function runtimeStats() {
    return { activeJobs: activeRuns.size };
  }

  function waitForIdle({ timeoutMs = 0 } = {}) {
    if (!activeRuns.size) return Promise.resolve(true);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
      return Promise.reject(new TypeError('timeoutMs must be a non-negative safe integer'));
    }
    return new Promise(resolve => {
      let timer = null;
      const finish = idle => {
        if (timer) clearTimeout(timer);
        idleWaiters.delete(finish);
        resolve(idle);
      };
      idleWaiters.add(finish);
      if (timeoutMs > 0) {
        timer = setTimeout(() => finish(false), timeoutMs);
        timer.unref?.();
      }
    });
  }

  function getJob(idInput, { ownerEmail } = {}) {
    const id = validateId(idInput, 'job id');
    const job = jobs.get(id);
    if (!job) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    const normalizedOwner = cleanString(ownerEmail).toLowerCase();
    if (normalizedOwner && job.ownerEmail.toLowerCase() !== normalizedOwner) {
      throw httpError('无权查看该任务', 403, 'ECOMMERCE_JOB_FORBIDDEN');
    }
    const assets = store.listAssets(id);
    const snapshot = own(job.progress, 'orchestrationSnapshot');
    const retryAssetPlan = own(job.progress, 'retryAssetPlan');
    const assetPlan = Array.isArray(retryAssetPlan)
      ? retryAssetPlan
      : Array.isArray(own(snapshot, 'assetPlan')) ? own(snapshot, 'assetPlan') : [];
    const publicJob = { ...job };
    delete publicJob.visualInputSchemaVersion;
    return {
      ...publicJob,
      assetPlan,
      quote: { units: assetPlan.length },
      assets: assets.map(publicAsset),
      progress: {
        ...job.progress,
        ...summarizeAssets(assets),
      },
    };
  }

  function createJob(input = {}) {
    const ownerEmail = cleanString(own(input, 'ownerEmail')).toLowerCase();
    if (!ownerEmail || !ownerEmail.includes('@')) throw httpError('登录信息无效', 401, 'AUTH_REQUIRED');
    const rawPayload = own(input, 'payload');
    let payload;
    try {
      payload = normalizeEcommerceAbilityPayload(sanitizeSnapshot(rawPayload));
    } catch (error) {
      throw error?.status ? error : httpError(error?.message || '电商能力配置无效', 400, 'ECOMMERCE_ABILITY_INVALID');
    }
    if (!cleanString(own(payload, 'product_name'))) {
      throw httpError('缺少商品名称', 400, 'PRODUCT_NAME_REQUIRED');
    }
    if (typeof billing.preflight === 'function') {
      billing.preflight({ ownerEmail, payload });
    }
    const requestedId = cleanString(own(input, 'id'));
    const id = requestedId ? validateId(requestedId, 'job id') : `ec_${randomUUID()}`;
    if (requestedId) {
      const existing = jobs.get(id);
      if (existing) {
        if (cleanString(existing.ownerEmail).toLowerCase() !== ownerEmail) {
          throw httpError('生成请求编号已被占用', 409, 'ECOMMERCE_IDEMPOTENCY_CONFLICT');
        }
        if (JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
          throw httpError('生成请求内容与已提交任务不一致', 409, 'ECOMMERCE_IDEMPOTENCY_CONFLICT');
        }
        return getJob(existing.id, { ownerEmail });
      }
    }
    const job = jobs.create({ id, ownerEmail, payload });
    return getJob(job.id, { ownerEmail });
  }

  function listJobs({ ownerEmail, limit = 20 } = {}) {
    const normalizedOwner = cleanString(ownerEmail).toLowerCase();
    if (!normalizedOwner || !normalizedOwner.includes('@')) {
      throw httpError('登录信息无效', 401, 'AUTH_REQUIRED');
    }
    return jobs.listOwner(normalizedOwner, { limit });
  }

  function dismissJob({ id, ownerEmail } = {}) {
    if (typeof jobs.dismissOwned !== 'function') {
      throw httpError('任务记录服务暂不可用，请稍后重试', 503, 'ECOMMERCE_DISMISS_UNAVAILABLE');
    }
    return jobs.dismissOwned(validateId(id, 'job id'), cleanString(ownerEmail));
  }

  function failedRetryPlanForJob(source) {
    if (!['needs_review', 'failed'].includes(source.status)) {
      throw httpError('当前任务没有可重新生成的未交付套图', 409, 'ECOMMERCE_RETRY_UNAVAILABLE');
    }
    const restored = orchestrationSnapshotFromProgress(source.progress);
    if (!restored.snapshot) throw invalidOrchestrationSnapshot();
    const sourcePlan = validatePlanContract(restored.snapshot.assetPlan);
    const retryIds = new Set(store.listAssets(source.id)
      .filter(asset => ['failed', 'needs_review'].includes(asset.state))
      .map(asset => asset.assetId));
    const assetPlan = sourcePlan.filter(item => retryIds.has(item.id));
    if (!assetPlan.length || assetPlan.length !== retryIds.size) {
      throw httpError('没有可重新生成的未交付套图', 409, 'ECOMMERCE_RETRY_PLAN_EMPTY');
    }
    const validatedAssetPlan = validatePlanContract(assetPlan);
    const features = validatedAssetPlan.map(ecommerceFeatureForItem);
    const skus = new Set(features.map(feature => feature.sku));
    if (skus.size !== 1) {
      throw httpError('未交付套图包含不同清晰度，请分别重新获取费用', 409, 'ECOMMERCE_RETRY_PLAN_MIXED');
    }
    return {
      snapshot: restored.snapshot,
      assetPlan: validatedAssetPlan,
      itemIds: validatedAssetPlan.map(item => item.id),
      sku: features[0].sku,
      quantity: validatedAssetPlan.length,
    };
  }

  function getFailedRetryPlan({ id, ownerEmail } = {}) {
    const source = jobs.get(validateId(id, 'job id'));
    if (!source) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    const normalizedOwner = cleanString(ownerEmail).toLowerCase();
    if (!normalizedOwner || source.ownerEmail.toLowerCase() !== normalizedOwner) {
      throw httpError('无权查看该任务', 403, 'ECOMMERCE_JOB_FORBIDDEN');
    }
    const retryPlan = failedRetryPlanForJob(source);
    return {
      itemIds: retryPlan.itemIds,
      sku: retryPlan.sku,
      quantity: retryPlan.quantity,
    };
  }

  function createFailedRetryJob({ id, ownerEmail, billingQuoteId } = {}) {
    const source = jobs.get(validateId(id, 'job id'));
    if (!source) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    const normalizedOwner = cleanString(ownerEmail).toLowerCase();
    if (!normalizedOwner || source.ownerEmail.toLowerCase() !== normalizedOwner) {
      throw httpError('无权查看该任务', 403, 'ECOMMERCE_JOB_FORBIDDEN');
    }
    const quoteId = cleanString(billingQuoteId);
    if (!quoteId) throw httpError('缺少重新生成费用确认', 400, 'BILLING_QUOTE_REQUIRED');
    const retryPlan = failedRetryPlanForJob(source);
    const { holdId: _sourceHoldId, ...snapshotWithoutHold } = retryPlan.snapshot;
    const retryId = validateId(`ec_retry_${randomUUID()}`, 'job id');
    const retry = jobs.createRetry({
      sourceJobId: source.id,
      billingQuoteId: quoteId,
      id: retryId,
      ownerEmail: source.ownerEmail,
      payload: sanitizeSnapshot({
        ...source.payload,
        billing_quote_id: quoteId,
      }),
      progress: {
        retryOf: source.id,
        retryAssetPlan: retryPlan.assetPlan,
        orchestrationSnapshot: sanitizeSnapshot(snapshotWithoutHold),
      },
    });
    return getJob(retry.job.id, { ownerEmail: source.ownerEmail });
  }

  async function persistProviderOutput(job, item, outputUrl) {
    try {
      if (typeof generatedAssetStore.persistAndRead === 'function') {
        return await generatedAssetStore.persistAndRead({
          sourceUrl: outputUrl,
          taskId: job.id,
          label: item.id,
        });
      }
      const asset = await generatedAssetStore.persist({
        sourceUrl: outputUrl,
        taskId: job.id,
        label: item.id,
      });
      const stored = await generatedAssetStore.read(asset.id);
      if (!stored) throw new Error('stable generated asset could not be read');
      return { asset, ...stored };
    } catch (error) {
      throw mapGeneratedAssetStorageError(error);
    }
  }

  async function stableBytes(stableUrl) {
    const stored = await generatedAssetStore.read(stableAssetId(stableUrl));
    if (!stored) throw new Error('stable generated asset could not be read');
    return stored;
  }

  async function settleItem({ holdId, job, item, stableAsset, quality }) {
    return billing.settle({ holdId, job, item, stableAsset, quality });
  }

  async function releaseItem({ holdId, job, item, reason, quality = null }) {
    return billing.release({ holdId, job, item, reason, quality });
  }

  async function releaseHoldRemainder({ holdId, job, reason }) {
    return billing.releaseRemainder({ holdId, job, reason });
  }

  async function persistCurrentWork(jobId, status) {
    if (!persistWorkSnapshot) return null;
    const currentJob = jobs.get(jobId);
    if (!currentJob) return null;
    try {
      return await persistWorkSnapshot({
        job: currentJob,
        assets: store.listAssets(jobId),
        status,
      });
    } catch (error) {
      // A completed image must not be charged and then disappear because the
      // work snapshot write had a transient failure. Leave the task resumable.
      if (error && typeof error === 'object') error.retryable = true;
      throw error;
    }
  }

  async function withSuiteDiversityLock(jobId, operation) {
    const previous = suiteDiversityQueues.get(jobId) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    suiteDiversityQueues.set(jobId, next);
    try {
      return await next;
    } finally {
      if (suiteDiversityQueues.get(jobId) === next) suiteDiversityQueues.delete(jobId);
    }
  }

  async function suiteComparisonAssets(jobId, currentAssetId, canonicalPlanById) {
    const candidates = store.listAssets(jobId).filter(asset => (
      asset.assetId !== currentAssetId
      && ['verified', 'settling', 'completed'].includes(asset.state)
      && cleanString(asset.stableUrl)
    ));
    return candidates.map(asset => {
      const canonicalPlan = canonicalPlanById instanceof Map
        ? canonicalPlanById.get(asset.assetId)
        : null;
      const plan = isRecord(canonicalPlan)
        ? canonicalPlan
        : isRecord(own(asset.requestSnapshot, 'assetPlanItem'))
          ? own(asset.requestSnapshot, 'assetPlanItem')
          : {};
      const measurement = own(own(own(asset.requestSnapshot, 'suiteDiversity'), 'details'), 'measurement');
      return {
        assetId: asset.assetId,
        role: cleanString(own(plan, 'role')),
        assetPlanItem: plan,
        ...(isRecord(measurement) ? { measurement } : {}),
        loadBuffer: async () => (await stableBytes(asset.stableUrl)).buffer,
      };
    });
  }

  function withSuiteDiversityFailure(quality, verdict) {
    const issueCodes = Array.isArray(verdict?.issueCodes) && verdict.issueCodes.length
      ? [...new Set(verdict.issueCodes.map(cleanString).filter(Boolean))]
      : ['suite_near_duplicate'];
    const existingProductCheck = isRecord(own(quality?.checks, 'productFidelity'))
      ? own(quality.checks, 'productFidelity')
      : {};
    return {
      ...quality,
      passed: false,
      confidence: 'low',
      checks: {
        ...quality.checks,
        productFidelity: {
          ...existingProductCheck,
          status: 'fail',
          passed: false,
          issueCodes: [...new Set([...(existingProductCheck.issueCodes || []), ...issueCodes])],
        },
        suiteDiversity: {
          status: 'fail',
          passed: false,
          issueCodes,
          details: isRecord(verdict?.details) ? { ...verdict.details } : {},
        },
      },
      repairAction: {
        type: 'regenerate_from_product_truth',
        focusIssueCodes: issueCodes,
        preserveUserFacts: true,
        userCharge: false,
      },
    };
  }

  async function runAsset({ job, item, productTruth, campaignBible, holdId, canonicalPlanById }) {
    store.createAsset({
      jobId: job.id,
      assetId: item.id,
      requestSnapshot: { assetPlanItem: item },
    });
    let current = store.getAsset(job.id, item.id);
    if (ASSET_WORKER_STOP_STATES.has(current.state)) return current;
    const claimed = store.claimAsset(job.id, item.id, { leaseMs: assetLeaseMs });
    if (!claimed) return store.getAsset(job.id, item.id);
    current = claimed;
    let leaseToken = claimed.leaseToken;
    let leaseHeartbeatError = null;
    const heartbeat = setInterval(() => {
      if (ASSET_FINAL_STATES.has(current.state)) return;
      try {
        store.renewLease(job.id, item.id, leaseToken, { leaseMs: assetLeaseMs });
      } catch (error) {
        leaseHeartbeatError = error instanceof Error ? error : new Error('asset lease heartbeat failed');
        clearInterval(heartbeat);
      }
    }, leaseHeartbeatMs);
    heartbeat.unref?.();
    let compiledRequest = null;
    let stable = null;
    let qualityUnavailableAttempts = 0;

    const requestForItem = async () => {
      if (!compiledRequest) {
        compiledRequest = compileAssetRequest({
          assetPlanItem: item,
          productTruth,
          campaignBible,
          assets: own(job.payload, 'assets') ?? {},
          abilityRecipe: own(job.payload, 'ability_recipe'),
          personMode: own(job.payload, 'person_mode'),
        });
      }
      return compiledRequest;
    };

    const verifyStableAsAdvisory = ({ quality = null, repairAction = null, code }) => {
      current = store.transitionAsset(job.id, item.id, 'verified', {
        requestSnapshot: {
          ...current.requestSnapshot,
          ...(quality ? { quality } : {}),
          ...(repairAction ? { repairAction } : {}),
          qualityReview: {
            status: 'advisory',
            code,
          },
          settlement: { stableAsset: stable.asset },
        },
        error: '',
        leaseToken,
      });
      return current;
    };

    try {
      if (current.state === 'queued') {
        try {
          current = store.checkpointAsset(job.id, item.id, {
            requestSnapshot: {
              ...current.requestSnapshot,
              assetPlanItem: item,
            },
            leaseToken,
          });
        } catch (error) {
          if (error && typeof error === 'object') error.retryable = true;
          throw error;
        }
      }
      while (!ASSET_WORKER_STOP_STATES.has(current.state)) {
        if (leaseHeartbeatError) throw leaseHeartbeatError;
        if (current.state === 'queued') {
          const request = await requestForItem();
          const logicalKey = idempotencyKey(job.id, item.id, 0);
          const { intent, intents } = submissionIntent(current, {
            assetId: item.id,
            ordinal: 0,
            kind: 'initial',
            key: logicalKey,
          });
          try {
            const requestSnapshot = withProviderSubmissionCount(current, {
              ...current.requestSnapshot,
              assetPlanItem: item,
              request: {
                prompt: request.prompt,
                modelRoute: request.modelRoute,
                inputAssets: request.inputAssets,
              },
              submissionIntents: intents,
            });
            current = store.checkpointAsset(job.id, item.id, {
              requestSnapshot,
              leaseToken,
            });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          const providerRequest = await prepareProviderRequest({
            ...request,
            idempotencyKey: intent.idempotencyKey,
          }, { job, item, attempt: 0 });
          const submitted = await providerAdapter.submitEdit(providerRequest);
          try {
            const requestSnapshot = withProviderSubmissionCount(current, {
              ...current.requestSnapshot,
              submissionIntents: acknowledgeSubmissionIntents(current, intent, submitted.jobId),
            }, submitted.jobId);
            current = store.markSubmitted(job.id, item.id, {
              providerJobId: submitted.jobId,
              requestSnapshot,
              leaseToken,
            });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          continue;
        }

        if (current.state === 'submitted') {
          current = store.transitionAsset(job.id, item.id, 'polling', { leaseToken });
          continue;
        }

        if (current.state === 'polling') {
          const provider = normalizedProviderResult(
            await providerAdapter.pollUntilReady(current.providerJobId),
            current.providerJobId,
          );
          current = store.transitionAsset(job.id, item.id, 'downloading', {
            outputUrl: provider.outputUrl,
            leaseToken,
          });
          continue;
        }

        if (current.state === 'downloading') {
          stable = await persistProviderOutput(job, item, current.outputUrl);
          current = store.transitionAsset(job.id, item.id, 'quality_check', {
            stableUrl: stable.asset.url,
            leaseToken,
          });
          continue;
        }

        if (current.state === 'quality_check') {
          const releaseQualitySlot = await acquireQualitySlot();
          try {
            if (!stable || stable.asset.url !== current.stableUrl) {
              const stored = await stableBytes(current.stableUrl);
              stable = {
                asset: {
                  id: stableAssetId(current.stableUrl),
                  url: current.stableUrl,
                  contentType: stored.contentType,
                },
                ...stored,
              };
            }
            const copyRequirements = protectedCopyRequirements(item, productTruth);
            let quality;
            try {
              quality = await evaluateAsset({
                buffer: stable.buffer,
                expectedFormat: item.role === 'transparent'
                  ? 'png'
                  : stable.contentType?.split('/')[1],
                generationSize: item.generationSize,
                role: item.role,
                productTruth,
                assetPlanItem: item,
                stableUrl: current.stableUrl,
                ...copyRequirements,
              }, qualityAdapters);
            } catch {
              verifyStableAsAdvisory({ code: 'QUALITY_SERVICE_ERROR_NON_BLOCKING' });
              continue;
            }
            if (quality.passed) {
              let diversity;
              try {
                diversity = await withSuiteDiversityLock(job.id, async () => {
                  const existing = await suiteComparisonAssets(job.id, item.id, canonicalPlanById);
                  const verdict = await evaluateSuiteDiversity({
                    candidate: {
                      assetId: item.id,
                      role: item.role,
                      buffer: stable.buffer,
                      assetPlanItem: item,
                    },
                    existing,
                    productTruth,
                    assetPlanItem: item,
                    semanticLayout: quality?.checks?.visualQuality?.details?.layout,
                  });
                  if (!isRecord(verdict) || typeof verdict.passed !== 'boolean') {
                    throw new Error('suite diversity evaluator returned an invalid verdict');
                  }
                  if (!verdict.passed) return { passed: false, verdict };
                  current = store.transitionAsset(job.id, item.id, 'verified', {
                    requestSnapshot: {
                      ...current.requestSnapshot,
                      quality,
                      suiteDiversity: verdict,
                      settlement: {
                        stableAsset: stable.asset,
                      },
                    },
                    error: '',
                    leaseToken,
                  });
                  return { passed: true, verdict };
                });
              } catch {
                verifyStableAsAdvisory({
                  quality,
                  code: 'SUITE_DIVERSITY_SERVICE_ERROR_NON_BLOCKING',
                });
                continue;
              }
              if (diversity.passed) continue;
              quality = withSuiteDiversityFailure(quality, diversity.verdict);
            }
            if (quality.retryable === true) {
              releaseQualitySlot();
              qualityUnavailableAttempts += 1;
              const previousRetry = own(current.requestSnapshot, 'qualityRetry');
              const attempts = (Number.isSafeInteger(own(previousRetry, 'attempts'))
                ? own(previousRetry, 'attempts')
                : 0) + 1;
              const shouldRetryNow = qualityUnavailableAttempts <= qualityUnavailableRetryDelaysMs.length;
              const qualityRetry = {
                status: shouldRetryNow ? 'retrying' : 'waiting',
                attempts,
                code: 'QUALITY_SERVICE_UNAVAILABLE',
              };
              if (shouldRetryNow) {
                current = store.checkpointAsset(job.id, item.id, {
                  requestSnapshot: {
                    ...current.requestSnapshot,
                    quality,
                    qualityRetry,
                  },
                  leaseToken,
                });
                const delay = qualityUnavailableRetryDelaysMs[qualityUnavailableAttempts - 1];
                if (delay > 0) await sleep(delay);
                continue;
              }
              current = store.transitionAsset(job.id, item.id, 'verified', {
                requestSnapshot: {
                  ...current.requestSnapshot,
                  quality,
                  qualityRetry: { ...qualityRetry, status: 'deferred' },
                  qualityReview: {
                    status: 'advisory',
                    code: 'QUALITY_SERVICE_UNAVAILABLE',
                    attempts,
                  },
                  suiteDiversity: {
                    passed: true,
                    deferred: true,
                    issueCodes: [],
                    details: { reason: 'semantic_review_unavailable' },
                  },
                  settlement: { stableAsset: stable.asset },
                },
                error: '',
                leaseToken,
              });
              continue;
            }
            const repairAction = planRepair(quality);
            const usesDeterministicRepair = Boolean(repairAsset && repairAction.type === 'sharp_repair');
            if (usesDeterministicRepair && deterministicRepairCount(current) < 1) {
              current = store.transitionAsset(job.id, item.id, 'repairing', {
                requestSnapshot: {
                  ...current.requestSnapshot,
                  quality,
                  repairAction,
                },
                error: `quality repair required: ${repairAction.type}`,
                leaseToken,
              });
              continue;
            }
            verifyStableAsAdvisory({
              quality,
              repairAction,
              code: 'QUALITY_FEEDBACK_NON_BLOCKING',
            });
            continue;
          } finally {
            releaseQualitySlot();
          }
        }

        if (current.state === 'releasing') {
          const release = own(current.requestSnapshot, 'release');
          const targetState = cleanString(own(release, 'targetState'));
          if (!['failed', 'needs_review', 'cancelled'].includes(targetState)) {
            throw new Error('release target state is invalid');
          }
          const reason = cleanString(own(release, 'reason')) || `asset_release:${targetState}`;
          const quality = own(current.requestSnapshot, 'quality') ?? null;
          try {
            await releaseItem({ holdId, job, item, reason, quality });
            current = store.transitionAsset(job.id, item.id, targetState, {
              error: cleanString(own(release, 'error')) || current.error,
              leaseToken,
            });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          continue;
        }

        if (current.state === 'settling') {
          const quality = own(current.requestSnapshot, 'quality') ?? {};
          const storedAsset = own(own(current.requestSnapshot, 'settlement'), 'stableAsset');
          const stableAsset = isRecord(storedAsset)
            ? storedAsset
            : {
              id: stableAssetId(current.stableUrl),
              url: current.stableUrl,
              contentType: (await stableBytes(current.stableUrl)).contentType,
            };
          try {
            await settleItem({ holdId, job, item, stableAsset, quality });
            current = store.transitionAsset(job.id, item.id, 'completed', { leaseToken });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          continue;
        }

        if (current.state === 'repairing') {
          const repairAction = own(current.requestSnapshot, 'repairAction') ?? { type: 'manual_review' };
          const nextAttempt = current.attemptCount + 1;
          if (repairAsset && repairAction.type === 'sharp_repair') {
            const source = await stableBytes(current.stableUrl);
            const repaired = await repairAsset({
              buffer: source.buffer,
              contentType: source.contentType,
              action: repairAction,
              item,
              job,
              productTruth,
              attempt: nextAttempt,
            });
            if (!Buffer.isBuffer(repaired?.buffer) || !cleanString(repaired?.contentType)) {
              throw new Error('deterministic repair returned invalid image bytes');
            }
            let asset;
            try {
              asset = await generatedAssetStore.persistBuffer({
                buffer: repaired.buffer,
                contentType: repaired.contentType,
                taskId: job.id,
                label: item.id,
              });
            } catch (error) {
              throw mapGeneratedAssetStorageError(error);
            }
            stable = { asset, buffer: repaired.buffer, contentType: repaired.contentType };
            current = store.transitionAsset(job.id, item.id, 'quality_check', {
              stableUrl: asset.url,
              attemptCount: nextAttempt,
              requestSnapshot: withDeterministicRepairCount(current),
              leaseToken,
            });
            continue;
          }
          if (!cleanString(current.stableUrl)) {
            throw new Error('repairing asset is missing its persisted image');
          }
          if (providerSubmissionCount(current) > 3) {
            throw new Error(`more than two provider repairs for asset: ${item.id}`);
          }
          current = store.transitionAsset(job.id, item.id, 'quality_check', {
            requestSnapshot: {
              ...current.requestSnapshot,
              qualityRepair: {
                status: 'skipped',
                code: 'PROVIDER_QUALITY_REPAIR_DISABLED',
              },
            },
            error: '',
            leaseToken,
          });
          continue;
        }

        throw new Error(`unsupported asset state: ${current.state}`);
      }
      return current;
    } catch (error) {
      current = store.getAsset(job.id, item.id);
      if (error?.retryable === true) {
        try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
        throw error;
      }
      if (current?.state === 'settling') {
        if (error && typeof error === 'object') error.retryable = true;
        try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
        throw error;
      }
      if (current && !ASSET_FINAL_STATES.has(current.state)) {
        if (current.state !== 'releasing') {
          current = store.transitionAsset(job.id, item.id, 'releasing', {
            requestSnapshot: {
              ...current.requestSnapshot,
              release: {
                targetState: 'failed',
                reason: `generation_failed:${errorMessage(error)}`,
                error: errorMessage(error),
              },
            },
            error: errorMessage(error),
            leaseToken,
          });
        }
        const release = own(current.requestSnapshot, 'release');
        try {
          await releaseItem({
            holdId,
            job,
            item,
            reason: cleanString(own(release, 'reason')) || `generation_failed:${errorMessage(error)}`,
          });
          current = store.transitionAsset(job.id, item.id, 'failed', {
            error: cleanString(own(release, 'error')) || errorMessage(error),
            leaseToken,
          });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          try { store.releaseLease(job.id, item.id, leaseToken); } catch {}
          throw releaseError;
        }
      }
      return current ?? store.getAsset(job.id, item.id);
    } finally {
      clearInterval(heartbeat);
    }
  }

  async function releaseVerifiedSuiteAssets({ job, assetPlan, holdId, targetState }) {
    if (!['failed', 'needs_review', 'cancelled'].includes(targetState)) {
      throw new Error('suite release target state is invalid');
    }
    const planById = new Map(assetPlan.map(item => [item.id, item]));
    for (const asset of store.listAssets(job.id).filter(candidate => candidate.state === 'verified')) {
      const item = planById.get(asset.assetId);
      if (!item) throw new Error(`verified asset is missing from plan: ${asset.assetId}`);
      const claimed = store.claimAsset(job.id, asset.assetId, { leaseMs: assetLeaseMs });
      if (!claimed) return false;
      const quality = own(claimed.requestSnapshot, 'quality') ?? null;
      const reason = `suite_incomplete:${targetState}`;
      const error = targetState === 'failed'
        ? 'complete suite failed'
        : targetState === 'cancelled'
          ? 'complete suite cancelled'
          : 'complete suite required';
      let current = store.transitionAsset(job.id, asset.assetId, 'releasing', {
        requestSnapshot: {
          ...claimed.requestSnapshot,
          release: {
            targetState,
            reason,
            error,
          },
        },
        error,
        leaseToken: claimed.leaseToken,
      });
      try {
        await releaseItem({ holdId, job, item, reason, quality });
        store.transitionAsset(job.id, asset.assetId, targetState, {
          error,
          leaseToken: current.leaseToken,
        });
      } catch (error) {
        if (error && typeof error === 'object') error.retryable = true;
        try { store.releaseLease(job.id, asset.assetId, current.leaseToken); } catch {}
        throw error;
      }
    }
    return true;
  }

  async function settleVerifiedSuiteAssets({ job, assetPlan, holdId }) {
    const planById = new Map(assetPlan.map(item => [item.id, item]));
    for (const asset of store.listAssets(job.id).filter(candidate => candidate.state === 'verified')) {
      const item = planById.get(asset.assetId);
      if (!item) throw new Error(`verified asset is missing from plan: ${asset.assetId}`);
      const claimed = store.claimAsset(job.id, asset.assetId, { leaseMs: assetLeaseMs });
      if (!claimed) return false;
      const quality = own(claimed.requestSnapshot, 'quality') ?? {};
      const storedAsset = own(own(claimed.requestSnapshot, 'settlement'), 'stableAsset');
      const stableAsset = isRecord(storedAsset)
        ? storedAsset
        : {
          id: stableAssetId(claimed.stableUrl),
          url: claimed.stableUrl,
          contentType: (await stableBytes(claimed.stableUrl)).contentType,
        };
      let current = store.transitionAsset(job.id, asset.assetId, 'settling', {
        leaseToken: claimed.leaseToken,
      });
      try {
        await settleItem({ holdId, job, item, stableAsset, quality });
        store.transitionAsset(job.id, asset.assetId, 'completed', {
          leaseToken: current.leaseToken,
        });
      } catch (error) {
        if (error && typeof error === 'object') error.retryable = true;
        try { store.releaseLease(job.id, asset.assetId, current.leaseToken); } catch {}
        throw error;
      }
    }
    return true;
  }

  async function finalizeVerifiedSuite({ job, assetPlan, holdId }) {
    const assets = store.listAssets(job.id);
    const readyStates = new Set(['verified', ...ASSET_FINAL_STATES]);
    if (assets.length !== assetPlan.length || assets.some(asset => !readyStates.has(asset.state))) {
      return false;
    }
    const releaseTarget = assets.some(asset => asset.state === 'failed')
      ? 'failed'
      : assets.some(asset => asset.state === 'cancelled')
        ? 'cancelled'
        : assets.some(asset => asset.state === 'needs_review')
          ? 'needs_review'
          : '';
    // A quality rejection applies to that image only. Keep every verified image
    // available and bill it normally; only the rejected item remains uncharged
    // and eligible for a targeted retry. A user cancellation is the exception.
    return releaseTarget === 'cancelled'
      ? releaseVerifiedSuiteAssets({ job, assetPlan, holdId, targetState: releaseTarget })
      : settleVerifiedSuiteAssets({ job, assetPlan, holdId });
  }

  async function executeJob(idInput, { leaseToken: suppliedLeaseToken = '' } = {}) {
    const id = validateId(idInput, 'job id');
    let job = jobs.get(id);
    if (!job) throw httpError('任务不存在', 404, 'ECOMMERCE_JOB_NOT_FOUND');
    if (PARENT_FINAL_STATES.has(job.status)) return getJob(id, { ownerEmail: job.ownerEmail });
    let parentLeaseToken = cleanString(suppliedLeaseToken);
    if (parentLeaseToken) {
      if (job.leaseToken !== parentLeaseToken) {
        throw Object.assign(new Error('parent lease is no longer owned by this worker'), {
          code: 'PARENT_LEASE_LOST',
          retryable: true,
        });
      }
    } else {
      const claimed = jobs.claim(id, { leaseMs: parentLeaseMs });
      if (!claimed) return getJob(id, { ownerEmail: job.ownerEmail });
      job = claimed;
      parentLeaseToken = claimed.leaseToken;
    }

    let parentHeartbeatError = null;
    const parentHeartbeat = setInterval(() => {
      try {
        jobs.renewLease(id, parentLeaseToken, { leaseMs: parentLeaseMs });
      } catch (error) {
        parentHeartbeatError = error instanceof Error ? error : new Error('parent lease heartbeat failed');
        clearInterval(parentHeartbeat);
      }
    }, parentLeaseHeartbeatMs);
    parentHeartbeat.unref?.();
    let parentFinalized = false;
    let setupHoldId = '';
    let setupAssetPlan = [];
    let processingStarted = false;

    try {
      const restoredSnapshot = orchestrationSnapshotFromProgress(job.progress);
      let snapshot = restoredSnapshot.snapshot;
      if (restoredSnapshot.migrated) {
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            orchestrationSnapshot: snapshot,
          },
          leaseToken: parentLeaseToken,
        });
      }
      if (!snapshot) {
        let visualInputSnapshot = visualInputSnapshotFromProgress(job.progress);
        if (!visualInputSnapshot) {
          const inputAssets = await assetsFromPayload(job.payload, {
            job,
            migrateLegacyVisualAsset,
          });
          visualInputSnapshot = sanitizeSnapshot({
            schemaVersion: VISUAL_INPUT_SNAPSHOT_VERSION,
            assets: inputAssets,
            ...(isRecord(own(job.payload, 'ability_recipe'))
              ? { ability_recipe: own(job.payload, 'ability_recipe') }
              : {}),
            ...(cleanString(own(job.payload, 'person_mode'))
              ? { person_mode: own(job.payload, 'person_mode') }
              : {}),
          });
          job = jobs.checkpoint(id, {
            progress: {
              ...job.progress,
              visualInputSnapshot,
            },
            leaseToken: parentLeaseToken,
          });
        }
        const inputAssets = visualInputSnapshot.assets;
        const payload = {
          ...job.payload,
          assets: inputAssets,
          ...(isRecord(own(visualInputSnapshot, 'ability_recipe'))
            ? { ability_recipe: own(visualInputSnapshot, 'ability_recipe') }
            : {}),
          ...(cleanString(own(visualInputSnapshot, 'person_mode'))
            ? { person_mode: own(visualInputSnapshot, 'person_mode') }
            : {}),
        };
        let visualAnalysisMode = 'primary';
        let visualAnalysisErrorCode = '';
        let visualAnalysis;
        try {
          visualAnalysis = await analyzeVisualInputs(payload);
        } catch (error) {
          if (error?.retryable !== true || !fallbackVisualInputs) throw error;
          visualAnalysis = await fallbackVisualInputs(payload, { cause: error });
          visualAnalysisMode = 'fallback';
          visualAnalysisErrorCode = cleanString(error?.code) || 'VISUAL_ANALYSIS_UNAVAILABLE';
        }
        const productTruth = own(visualAnalysis, 'productTruth');
        const styleReferenceProfile = own(visualAnalysis, 'styleReferenceProfile');
        const visualAnalysisCache = own(visualAnalysis, 'cache');
        if (!isRecord(productTruth) || !isRecord(styleReferenceProfile) || !isRecord(visualAnalysisCache)) {
          throw httpError('图片分析结果无效', 502, 'VISUAL_ANALYSIS_INVALID_RESPONSE');
        }
        const direction = directionFromPayload(payload);
        const commerceContext = commerceContextFromPayload(payload);
        const campaignBible = compileCampaignBible(
          direction,
          campaignOverrides(payload, direction, inputAssets),
          styleReferenceProfile,
        );
        const assetPlan = validatePlanContract(buildAssetPlan({
          productTruth,
          campaignBible,
          platform: commerceContext.platform,
          commerceContext,
          sizing: own(payload, 'sizing') || {},
          skus: own(payload, 'skus') || [],
          uploadedProofs: inputAssets.proof,
        }));
        snapshot = sanitizeSnapshot({
          schemaVersion: CURRENT_ORCHESTRATION_SNAPSHOT_VERSION,
          productTruth,
          styleReferenceProfile,
          visualAnalysisCache,
          ...(visualAnalysisMode === 'fallback' ? { visualAnalysisMode } : {}),
          ...(visualAnalysisErrorCode ? { visualAnalysisErrorCode } : {}),
          campaignBible,
          assetPlan,
          deterministicInputs: {
            assets: inputAssets,
            platform: commerceContext.platform,
            commerceContext,
            sizing: own(payload, 'sizing') || {},
            skus: own(payload, 'skus') || [],
            ...(isRecord(own(payload, 'ability_recipe'))
              ? { ability_recipe: own(payload, 'ability_recipe') }
              : {}),
            ...(cleanString(own(payload, 'person_mode'))
              ? { person_mode: own(payload, 'person_mode') }
              : {}),
          },
        });
        validateOrchestrationSnapshot(snapshot, { requireVisualAnalysis: true });
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            orchestrationSnapshot: snapshot,
          },
          leaseToken: parentLeaseToken,
        });
      }

      const productTruth = snapshot.productTruth;
      const campaignBible = snapshot.campaignBible;
      const retryAssetPlan = retryAssetPlanFromProgress(job.progress);
      const assetPlan = validatePlanContract(retryAssetPlan || snapshot.assetPlan);
      setupAssetPlan = assetPlan;
      const deterministicInputs = snapshot.deterministicInputs;
      const payload = {
        ...job.payload,
        assets: deterministicInputs.assets,
        ...(isRecord(own(deterministicInputs, 'ability_recipe'))
          ? { ability_recipe: own(deterministicInputs, 'ability_recipe') }
          : {}),
        ...(cleanString(own(deterministicInputs, 'person_mode'))
          ? { person_mode: own(deterministicInputs, 'person_mode') }
          : {}),
      };
      let holdId = retryAssetPlan
        ? cleanString(own(job.progress, 'holdId'))
        : cleanString(own(snapshot, 'holdId')) || cleanString(own(job.progress, 'holdId'));
      if (!holdId) {
        const hold = await billing.hold({ job, assetPlan, productTruth, campaignBible });
        holdId = validateId(own(hold, 'id'), 'billing hold id');
        snapshot = sanitizeSnapshot({ ...snapshot, holdId });
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            orchestrationSnapshot: snapshot,
            holdId,
          },
          leaseToken: parentLeaseToken,
        });
      } else {
        holdId = validateId(holdId, 'billing hold id');
        if (cleanString(own(snapshot, 'holdId')) !== holdId) {
          snapshot = sanitizeSnapshot({ ...snapshot, holdId });
          job = jobs.checkpoint(id, {
            progress: {
              ...job.progress,
              orchestrationSnapshot: snapshot,
              holdId,
            },
            leaseToken: parentLeaseToken,
          });
        }
      }
      setupHoldId = holdId;

      if (projectLifecycle) {
        const hasProjectLink = ['projectId', 'sourceVersionId', 'generationRunId', 'assetPlanFingerprint']
          .every(key => cleanString(own(job.progress, key)));
        if (!hasProjectLink) {
          const linked = await projectLifecycle.begin({ job, assetPlan, holdId });
          const fingerprint = cleanString(own(linked, 'assetPlanFingerprint'));
          if (!fingerprint) throw new Error('asset plan fingerprint is required');
          job = jobs.checkpoint(id, {
            progress: {
              ...job.progress,
              projectId: validateId(own(linked, 'projectId'), 'project id'),
              sourceVersionId: validateId(own(linked, 'sourceVersionId'), 'source version id'),
              generationRunId: validateId(own(linked, 'generationRunId'), 'generation run id'),
              assetPlanFingerprint: fingerprint,
            },
            leaseToken: parentLeaseToken,
          });
        }
      }

      const pendingSetupRelease = own(job.progress, 'setupRelease');
      if (isRecord(pendingSetupRelease)) {
        const reason = cleanString(own(pendingSetupRelease, 'reason')) || 'parent_setup_failed';
        try {
          await releaseHoldRemainder({ holdId, job, reason });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          throw releaseError;
        }
        throw Object.assign(
          new Error(cleanString(own(pendingSetupRelease, 'error')) || 'parent setup failed'),
          { setupReleaseCompleted: true },
        );
      }

      for (const item of assetPlan) {
        store.createAsset({
          jobId: id,
          assetId: item.id,
          requestSnapshot: { assetPlanItem: item },
        });
      }
      job = jobs.get(id);
      if (job.status === 'analyzing') {
        job = jobs.transition(id, 'generating', {
          progress: { ...job.progress, holdId, current: 0, total: assetPlan.length },
          leaseToken: parentLeaseToken,
        });
      }
      processingStarted = true;

      let assetCursor = 0;
      let workerError = null;
      const canonicalPlanById = new Map(assetPlan.map(item => [item.id, item]));
      async function assetWorker() {
        while (!workerError && assetCursor < assetPlan.length) {
          if (parentHeartbeatError) {
            workerError = parentHeartbeatError;
            return;
          }
          const item = assetPlan[assetCursor];
          assetCursor += 1;
          try {
            await imageGenerationPool.run(() => runAsset({
              job: { ...job, payload },
              item,
              productTruth,
              campaignBible,
              holdId,
              canonicalPlanById,
            }), { key: job.ownerEmail });
          } catch (error) {
            if (!workerError) workerError = error;
          }
        }
      }
      await Promise.all(Array.from(
        { length: Math.min(assetConcurrency, assetPlan.length) },
        () => assetWorker(),
      ));
      if (workerError) throw workerError;

      await finalizeVerifiedSuite({ job: jobs.get(id), assetPlan, holdId });
      const assets = store.listAssets(id);
      const status = terminalParentState(assets);
      if (!status) return getJob(id, { ownerEmail: job.ownerEmail });
      const executionCount = assertExecutionCount({
        plan: assetPlan,
        assetRows: assets,
        providerSubmissions: providerSubmissionEntries(assets),
        quoteUnits: assetPlan.length,
      });
      job = jobs.checkpoint(id, {
        progress: { ...jobs.get(id).progress, executionCount },
        leaseToken: parentLeaseToken,
      });
      const output = {
        product_name: own(job.payload, 'product_name'),
        category: own(job.payload, 'category') || '',
        platform: own(job.payload, 'platform') || '淘宝',
        images: resultImages(assets),
        errors: assets
          .filter(asset => asset.state === 'failed' || asset.state === 'needs_review')
          .map(asset => ({ style: asset.assetId, error: publicAssetError(asset), state: asset.state })),
      };
      const summary = summarizeAssets(assets);
      job = jobs.get(id);
      if (status && !PARENT_FINAL_STATES.has(job.status)) {
        const shouldVersionResult = status === 'completed';
        if (projectLifecycle && !cleanString(own(job.progress, 'resultVersionId'))) {
          const lifecycleResult = shouldVersionResult
            ? await projectLifecycle.complete({ job, output, assets, status })
            : await projectLifecycle.terminate({ job, status });
          const nextProgress = {
            ...job.progress,
            projectId: cleanString(own(lifecycleResult, 'projectId')) || job.progress.projectId,
            sourceVersionId: cleanString(own(lifecycleResult, 'sourceVersionId')) || job.progress.sourceVersionId,
            generationRunId: cleanString(own(lifecycleResult, 'generationRunId')) || job.progress.generationRunId,
            assetPlanFingerprint: cleanString(own(lifecycleResult, 'assetPlanFingerprint')) || job.progress.assetPlanFingerprint,
          };
          if (shouldVersionResult) {
            nextProgress.resultVersionId = validateId(own(lifecycleResult, 'resultVersionId'), 'result version id');
          }
          job = jobs.checkpoint(id, {
            progress: nextProgress,
            leaseToken: parentLeaseToken,
          });
        }
        if (status === 'completed') await persistCurrentWork(id, status);
        jobs.transition(id, status, {
          output,
          error: status === 'failed' ? '未生成可交付图片' : '',
          progress: { ...job.progress, holdId, current: summary.completed, total: summary.total, ...summary },
          leaseToken: parentLeaseToken,
        });
        parentFinalized = true;
      }
      return getJob(id, { ownerEmail: job.ownerEmail });
    } catch (error) {
      if (error?.retryable === true) throw error;
      job = jobs.get(id);
      if (!job) throw error;
      if (!processingStarted
        && setupHoldId
        && setupAssetPlan.length > 0
        && error?.setupReleaseCompleted !== true
        && error?.code !== 'PARENT_LEASE_LOST') {
        const reason = `parent_setup_failed:${errorMessage(error)}`;
        job = jobs.checkpoint(id, {
          progress: {
            ...job.progress,
            setupRelease: {
              reason,
              error: errorMessage(error),
            },
          },
          leaseToken: parentLeaseToken,
        });
        try {
          await releaseHoldRemainder({
            holdId: setupHoldId,
            job,
            reason,
          });
        } catch (releaseError) {
          if (releaseError && typeof releaseError === 'object') releaseError.retryable = true;
          throw releaseError;
        }
      }
      if (!PARENT_FINAL_STATES.has(job.status)) {
        const assets = store.listAssets(id);
        const detail = { error: errorMessage(error) };
        if (cleanString(error?.code)) detail.code = cleanString(error.code);
        if (Number.isInteger(error?.status)) detail.status = error.status;
        if (typeof error?.retryable === 'boolean') detail.retryable = error.retryable;
        if (error?.reQuoteRequired === true) detail.reQuoteRequired = true;
        if (error?.resumeable === true) detail.resumeable = true;
        if (Number.isSafeInteger(error?.required) && error.required >= 0) detail.required = error.required;
        if (Number.isSafeInteger(error?.available) && error.available >= 0) detail.available = error.available;
        const summary = summarizeAssets(assets);
        if (projectLifecycle
          && cleanString(own(job.progress, 'generationRunId'))
          && !cleanString(own(job.progress, 'resultVersionId'))) {
          const terminated = await projectLifecycle.terminate({ job, status: 'failed' });
          job = jobs.checkpoint(id, {
            progress: {
              ...job.progress,
              projectId: cleanString(own(terminated, 'projectId')) || job.progress.projectId,
              sourceVersionId: cleanString(own(terminated, 'sourceVersionId')) || job.progress.sourceVersionId,
              generationRunId: cleanString(own(terminated, 'generationRunId')) || job.progress.generationRunId,
              assetPlanFingerprint: cleanString(own(terminated, 'assetPlanFingerprint')) || job.progress.assetPlanFingerprint,
            },
            leaseToken: parentLeaseToken,
          });
        }
        jobs.transition(id, 'failed', {
          output: {
            product_name: own(job.payload, 'product_name'),
            category: own(job.payload, 'category') || '',
            platform: own(job.payload, 'platform') || '淘宝',
            images: resultImages(assets),
            errors: [detail],
          },
          error: detail.error,
          progress: { ...job.progress, current: summary.completed, total: summary.total, ...summary },
          leaseToken: parentLeaseToken,
        });
        parentFinalized = true;
      }
      return getJob(id, { ownerEmail: job.ownerEmail });
    } finally {
      clearInterval(parentHeartbeat);
      if (!parentFinalized) {
        try { jobs.releaseLease(id, parentLeaseToken); } catch {}
      }
    }
  }

  function runJob(idInput, options = {}) {
    const execution = executeJob(idInput, options);
    activeRuns.add(execution);
    execution.finally(() => {
      activeRuns.delete(execution);
      notifyRuntimeIdle();
    }).catch(() => {});
    return execution;
  }

  async function resumeJobs() {
    const claims = [];
    const claimedIds = new Set();
    for (const id of new Set(store.recoverInterrupted().map(asset => asset.jobId))) {
      const claimed = jobs.claim(id, { leaseMs: parentLeaseMs });
      if (claimed) {
        claims.push(claimed);
        claimedIds.add(claimed.id);
      }
    }
    if (typeof jobs.claimNext === 'function') {
      for (let count = 0; count < 1_000; count += 1) {
        const claimed = jobs.claimNext({ leaseMs: parentLeaseMs });
        if (!claimed) break;
        if (!claimedIds.has(claimed.id)) {
          claims.push(claimed);
          claimedIds.add(claimed.id);
        }
      }
    }
    return Promise.allSettled(claims.map(claimed => runJob(claimed.id, {
      leaseToken: claimed.leaseToken,
    })));
  }

  return {
    createJob,
    createFailedRetryJob,
    dismissJob,
    getFailedRetryPlan,
    getJob,
    listJobs,
    resumeJobs,
    runJob,
    runtimeStats,
    waitForIdle,
  };
}

function responseError(res, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;
  const body = { error: status === 500 ? '服务器内部错误，请稍后重试' : errorMessage(error) };
  if (cleanString(error?.code)) body.code = cleanString(error.code);
  if (error?.resumeable === true) body.resumeable = true;
  if (Number.isSafeInteger(error?.required) && error.required >= 0) body.required = error.required;
  if (Number.isSafeInteger(error?.available) && error.available >= 0) body.available = error.available;
  return res.status(status).json(body);
}

export function createEcommerceRouteHandlers({
  orchestrator,
  backgroundRetryDelaysMs = [2_000, 8_000, 30_000],
  backgroundRetryCooldownMs = 60_000,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay)),
  now = Date.now,
  onBackgroundError = error => console.error('[ecommerce] background job failed:', errorMessage(error)),
} = {}) {
  if (!orchestrator || typeof orchestrator.createJob !== 'function'
    || typeof orchestrator.getJob !== 'function') {
    throw new TypeError('orchestrator generation methods are required');
  }
  if (!Array.isArray(backgroundRetryDelaysMs)
    || backgroundRetryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)) {
    throw new TypeError('backgroundRetryDelaysMs must contain non-negative safe integers');
  }
  if (!Number.isSafeInteger(backgroundRetryCooldownMs) || backgroundRetryCooldownMs < 0) {
    throw new TypeError('backgroundRetryCooldownMs must be a non-negative safe integer');
  }
  if (typeof sleep !== 'function' || typeof now !== 'function' || typeof onBackgroundError !== 'function') {
    throw new TypeError('sleep, now, and onBackgroundError must be functions');
  }
  const backgroundRuns = new Map();
  const retryAfterByJob = new Map();
  function startBackgroundRun(idInput) {
    if (typeof orchestrator.runJob !== 'function') return null;
    const id = validateId(idInput, 'job id');
    if (backgroundRuns.has(id)) return backgroundRuns.get(id);
    const retryAfter = retryAfterByJob.get(id) ?? 0;
    if (retryAfter > now()) return null;
    retryAfterByJob.delete(id);
    const run = (async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await orchestrator.runJob(id);
        } catch (error) {
          if (error?.retryable !== true || attempt >= backgroundRetryDelaysMs.length) throw error;
          const delay = backgroundRetryDelaysMs[attempt];
          if (delay > 0) await sleep(delay);
        }
      }
    })()
      .then((result) => {
        retryAfterByJob.delete(id);
        return result;
      })
      .catch((error) => {
        if (error?.retryable === true && backgroundRetryCooldownMs > 0) {
          retryAfterByJob.set(id, now() + backgroundRetryCooldownMs);
        }
        return onBackgroundError(error);
      })
      .finally(() => backgroundRuns.delete(id));
    backgroundRuns.set(id, run);
    return run;
  }
  function requireRetryMethod(name) {
    if (typeof orchestrator[name] !== 'function') {
      throw httpError('整套重试服务暂不可用，请稍后重试', 503, 'ECOMMERCE_RETRY_UNAVAILABLE');
    }
  }
  return {
    async generate(req, res) {
      try {
        const job = orchestrator.createJob({
          id: req?.headers?.['idempotency-key'],
          ownerEmail: req?._userEmail,
          payload: req?.body ?? {},
        });
        startBackgroundRun(job.id);
        return res.status(202).json({ taskId: job.id, status: 'queued' });
      } catch (error) {
        return responseError(res, error);
      }
    },
    getJob(req, res) {
      try {
        const task = orchestrator.getJob(req?.params?.id, { ownerEmail: req?._userEmail });
        if (['queued', 'analyzing', 'generating'].includes(task.status)) {
          startBackgroundRun(task.id);
        }
        return res.json({
          ok: true,
          task,
        });
      } catch (error) {
        return responseError(res, error);
      }
    },
    listJobs(req, res) {
      try {
        return res.json({
          ok: true,
          tasks: orchestrator.listJobs({ ownerEmail: req?._userEmail }),
        });
      } catch (error) {
        return responseError(res, error);
      }
    },
    dismissJob(req, res) {
      try {
        if (typeof orchestrator.dismissJob !== 'function') {
          throw httpError('任务记录服务暂不可用，请稍后重试', 503, 'ECOMMERCE_DISMISS_UNAVAILABLE');
        }
        return res.json({
          ok: true,
          task: orchestrator.dismissJob({
            id: req?.params?.id,
            ownerEmail: req?._userEmail,
          }),
        });
      } catch (error) {
        return responseError(res, error);
      }
    },
    retryPlan(req, res) {
      try {
        requireRetryMethod('getFailedRetryPlan');
        return res.json({
          ok: true,
          plan: orchestrator.getFailedRetryPlan({
            id: req?.params?.id,
            ownerEmail: req?._userEmail,
          }),
        });
      } catch (error) {
        return responseError(res, error);
      }
    },
    async retryFailed(req, res) {
      try {
        requireRetryMethod('createFailedRetryJob');
        const job = orchestrator.createFailedRetryJob({
          id: req?.params?.id,
          ownerEmail: req?._userEmail,
          billingQuoteId: req?.body?.billingQuoteId,
        });
        startBackgroundRun(job.id);
        return res.status(202).json({ taskId: job.id, status: 'queued' });
      } catch (error) {
        return responseError(res, error);
      }
    },
  };
}

export function createEcommerceStartupRecovery({
  orchestrator,
  maxAttempts = 3,
  retryDelayMs = 250,
  maxFollowUpScans = 3,
  followUpDelayMs = 30_000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  onAttemptError = () => {},
} = {}) {
  if (!orchestrator || typeof orchestrator.resumeJobs !== 'function') {
    throw new TypeError('orchestrator resumeJobs is required');
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts <= 0) {
    throw new TypeError('maxAttempts must be a positive safe integer');
  }
  if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new TypeError('retryDelayMs must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(maxFollowUpScans) || maxFollowUpScans < 0) {
    throw new TypeError('maxFollowUpScans must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(followUpDelayMs) || followUpDelayMs < 0) {
    throw new TypeError('followUpDelayMs must be a non-negative safe integer');
  }
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
    throw new TypeError('setTimeoutFn and clearTimeoutFn must be functions');
  }
  if (typeof onAttemptError !== 'function') {
    throw new TypeError('onAttemptError must be a function');
  }
  let recoveryPromise = null;
  let activeScanPromise = null;
  let followUpTimer = null;
  let followUpScans = 0;
  let stopped = false;

  function scan() {
    if (activeScanPromise) return activeScanPromise;
    activeScanPromise = (async () => {
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await orchestrator.resumeJobs();
        } catch (error) {
          lastError = error;
          onAttemptError(error, attempt);
          if (attempt < maxAttempts && retryDelayMs > 0) {
            await new Promise(resolve => setTimeoutFn(resolve, retryDelayMs));
          }
        }
      }
      throw lastError;
    })().finally(() => {
      activeScanPromise = null;
    });
    return activeScanPromise;
  }

  function scheduleFollowUp() {
    if (stopped || followUpTimer || followUpScans >= maxFollowUpScans) return;
    followUpTimer = setTimeoutFn(async () => {
      followUpTimer = null;
      if (stopped) return;
      followUpScans += 1;
      try {
        await scan();
      } catch {}
      scheduleFollowUp();
    }, followUpDelayMs);
    followUpTimer?.unref?.();
  }

  function recoverEcommerceStartup() {
    if (recoveryPromise) return recoveryPromise;
    recoveryPromise = scan()
      .catch(() => [])
      .then(results => {
        scheduleFollowUp();
        return results;
      });
    return recoveryPromise;
  }

  recoverEcommerceStartup.stop = () => {
    stopped = true;
    if (followUpTimer) {
      clearTimeoutFn(followUpTimer);
      followUpTimer = null;
    }
  };
  return recoverEcommerceStartup;
}
