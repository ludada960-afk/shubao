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

const PARENT_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const ASSET_FINAL_STATES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
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
  if (!RETRYABLE_GENERATED_ASSET_STORAGE_CODES.has(cleanString(error?.code).toUpperCase())) {
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
  if (state === 'needs_review') return '图片未通过质量检查，本张未计费';
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
    role: cleanString(own(plan, 'role')),
    label: cleanString(own(plan, 'label') ?? own(plan, 'purpose')),
    error: publicAssetError(asset),
  };
  if (state === 'completed' && cleanString(own(asset, 'stableUrl'))) {
    result.stableUrl = cleanString(own(asset, 'stableUrl'));
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
  };
  for (const asset of assets) {
    if (asset.state === 'completed') summary.completed += 1;
    else if (asset.state === 'needs_review') summary.needsReview += 1;
    else if (asset.state === 'failed' || asset.state === 'cancelled') summary.failed += 1;
    else summary.active += 1;
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

function campaignOverrides(payload, direction, assets) {
  return {
    editableBrief: own(direction, 'editableBrief')
      ?? own(direction, 'execution_guide')
      ?? own(direction, 'description')
      ?? own(direction, 'brief')
      ?? '',
    customColors: Array.isArray(own(payload, 'custom_colors')) ? own(payload, 'custom_colors') : [],
    referenceAssetIds: Array.isArray(own(payload, 'reference_asset_ids'))
      ? own(payload, 'reference_asset_ids')
      : assets.reference.map(asset => asset.assetId),
    category: cleanString(own(payload, 'category')),
    priceBand: cleanString(own(payload, 'price_band')),
    language: cleanString(own(payload, 'language')) || 'zh-CN',
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
    throw Object.assign(new Error(cleanString(own(result, 'error')) || 'provider generation failed'), {
      code: 'PROVIDER_GENERATION_FAILED',
      retryable: false,
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
  } catch (error) {
    throw Object.assign(invalidOrchestrationSnapshot(), { cause: error });
  }
  return sanitizeSnapshot({
    schemaVersion: VISUAL_INPUT_SNAPSHOT_VERSION,
    assets: normalized,
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
    const communicationGoal = variantIdentity
      ? legacySkuGoal(variantIdentity)
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

export function createEcommerceOrchestrator(deps = {}) {
  const jobs = own(deps, 'jobs');
  if (!jobs || typeof jobs.create !== 'function' || typeof jobs.get !== 'function'
    || typeof jobs.transition !== 'function' || typeof jobs.checkpoint !== 'function'
    || typeof jobs.claim !== 'function' || typeof jobs.renewLease !== 'function'
    || typeof jobs.releaseLease !== 'function' || !jobs.assets) {
    throw new TypeError('durable generation jobs with an asset store are required');
  }
  const store = jobs.assets;
  const migrateLegacyVisualAsset = requireFunction(
    own(deps, 'migrateLegacyVisualAsset'),
    'migrateLegacyVisualAsset',
  );
  const analyzeVisualInputs = requireFunction(own(deps, 'analyzeVisualInputs'), 'analyzeVisualInputs');
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
  const canRetry = requireFunction(own(deps, 'canRetry'), 'canRetry');
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
  const compileRepairRequest = typeof own(deps, 'compileRepairRequest') === 'function'
    ? own(deps, 'compileRepairRequest')
    : ({ request, repairAction, attempt }) => ({
      ...request,
      prompt: `${request.prompt}\n\nTARGETED SYSTEM REPAIR ${attempt}: ${repairAction.type}; issues: ${(repairAction.focusIssueCodes || []).join(', ')}`,
    });
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
  const parentLeaseMs = Number.isSafeInteger(own(deps, 'parentLeaseMs')) && own(deps, 'parentLeaseMs') > 0
    ? own(deps, 'parentLeaseMs')
    : 30_000;
  const parentLeaseHeartbeatMs = Number.isSafeInteger(own(deps, 'parentLeaseHeartbeatMs'))
    && own(deps, 'parentLeaseHeartbeatMs') > 0
    && own(deps, 'parentLeaseHeartbeatMs') < parentLeaseMs
    ? own(deps, 'parentLeaseHeartbeatMs')
    : Math.max(10, Math.floor(parentLeaseMs / 3));

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
    const assetPlan = Array.isArray(own(snapshot, 'assetPlan')) ? own(snapshot, 'assetPlan') : [];
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
    const payload = sanitizeSnapshot(rawPayload);
    if (!cleanString(own(payload, 'product_name'))) {
      throw httpError('缺少商品名称', 400, 'PRODUCT_NAME_REQUIRED');
    }
    const requestedId = cleanString(own(input, 'id'));
    const id = requestedId ? validateId(requestedId, 'job id') : `ec_${randomUUID()}`;
    const job = jobs.create({ id, ownerEmail, payload });
    return getJob(job.id, { ownerEmail });
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
      && ['settling', 'completed'].includes(asset.state)
      && cleanString(asset.stableUrl)
    ));
    return Promise.all(candidates.map(async asset => {
      const stored = await stableBytes(asset.stableUrl);
      const canonicalPlan = canonicalPlanById instanceof Map
        ? canonicalPlanById.get(asset.assetId)
        : null;
      const plan = isRecord(canonicalPlan)
        ? canonicalPlan
        : isRecord(own(asset.requestSnapshot, 'assetPlanItem'))
          ? own(asset.requestSnapshot, 'assetPlanItem')
          : {};
      return {
        assetId: asset.assetId,
        role: cleanString(own(plan, 'role')),
        assetPlanItem: plan,
        buffer: stored.buffer,
      };
    }));
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
    if (ASSET_FINAL_STATES.has(current.state)) return current;
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

    const requestForItem = async () => {
      if (!compiledRequest) {
        compiledRequest = compileAssetRequest({
          assetPlanItem: item,
          productTruth,
          campaignBible,
          assets: own(job.payload, 'assets') ?? {},
        });
      }
      return compiledRequest;
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
      while (!ASSET_FINAL_STATES.has(current.state)) {
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
          let quality = await evaluateAsset({
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
          if (quality.passed) {
            const diversity = await withSuiteDiversityLock(job.id, async () => {
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
              current = store.transitionAsset(job.id, item.id, 'settling', {
                requestSnapshot: {
                  ...current.requestSnapshot,
                  quality,
                  suiteDiversity: verdict,
                  settlement: {
                    stableAsset: stable.asset,
                  },
                },
                leaseToken,
              });
              return { passed: true, verdict };
            });
            if (diversity.passed) continue;
            quality = withSuiteDiversityFailure(quality, diversity.verdict);
          }
          const repairAction = planRepair(quality);
          const usesDeterministicRepair = Boolean(repairAsset && repairAction.type === 'sharp_repair');
          const providerRepairAvailable = usesDeterministicRepair || providerSubmissionCount(current) < 2;
          if (!canRetry(current.attemptCount, repairAction) || !providerRepairAvailable) {
            const reason = `quality_review:${(repairAction.focusIssueCodes || []).join(',') || repairAction.type}`;
            current = store.transitionAsset(job.id, item.id, 'releasing', {
              requestSnapshot: {
                ...current.requestSnapshot,
                quality,
                repairAction,
                release: {
                  targetState: 'needs_review',
                  reason,
                  error: `quality gate failed: ${repairAction.type}`,
                },
              },
              error: `quality gate failed: ${repairAction.type}`,
              leaseToken,
            });
            continue;
          }
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
            await persistCurrentWork(job.id, 'generating');
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
              leaseToken,
            });
            continue;
          }
          const request = await requestForItem();
          const repairRequest = compileRepairRequest({
            request,
            repairAction,
            attempt: nextAttempt,
            item,
            job,
            productTruth,
            campaignBible,
          });
          const logicalKey = idempotencyKey(job.id, item.id, 1);
          const { intent, intents } = submissionIntent(current, {
            assetId: item.id,
            ordinal: 1,
            kind: 'repair',
            key: logicalKey,
          });
          const requestSnapshot = withProviderSubmissionCount(current, {
            ...current.requestSnapshot,
            request: {
              prompt: repairRequest.prompt,
              modelRoute: repairRequest.modelRoute,
              inputAssets: repairRequest.inputAssets,
            },
            repairAction,
            submissionIntents: intents,
          });
          if (providerSubmissionCount({ ...current, requestSnapshot }) > 2) {
            throw new Error(`more than one provider repair for asset: ${item.id}`);
          }
          try {
            current = store.checkpointAsset(job.id, item.id, {
              requestSnapshot,
              leaseToken,
            });
          } catch (error) {
            if (error && typeof error === 'object') error.retryable = true;
            throw error;
          }
          const providerRequest = await prepareProviderRequest({
            ...repairRequest,
            idempotencyKey: intent.idempotencyKey,
          }, { job, item, attempt: nextAttempt, repairAction });
          const submitted = await providerAdapter.submitEdit(providerRequest);
          stable = null;
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

  async function runJob(idInput, { leaseToken: suppliedLeaseToken = '' } = {}) {
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
        const payload = { ...job.payload, assets: inputAssets };
        const visualAnalysis = await analyzeVisualInputs(payload);
        const productTruth = own(visualAnalysis, 'productTruth');
        const styleReferenceProfile = own(visualAnalysis, 'styleReferenceProfile');
        const visualAnalysisCache = own(visualAnalysis, 'cache');
        if (!isRecord(productTruth) || !isRecord(styleReferenceProfile) || !isRecord(visualAnalysisCache)) {
          throw httpError('图片分析结果无效', 502, 'VISUAL_ANALYSIS_INVALID_RESPONSE');
        }
        const direction = directionFromPayload(payload);
        const campaignBible = compileCampaignBible(
          direction,
          campaignOverrides(payload, direction, inputAssets),
          styleReferenceProfile,
        );
        const assetPlan = validatePlanContract(buildAssetPlan({
          productTruth,
          campaignBible,
          platform: own(payload, 'platform') || '淘宝',
          sizing: own(payload, 'sizing') || {},
          skus: own(payload, 'skus') || [],
          uploadedProofs: inputAssets.proof,
        }));
        snapshot = sanitizeSnapshot({
          schemaVersion: CURRENT_ORCHESTRATION_SNAPSHOT_VERSION,
          productTruth,
          styleReferenceProfile,
          visualAnalysisCache,
          campaignBible,
          assetPlan,
          deterministicInputs: {
            assets: inputAssets,
            platform: own(payload, 'platform') || '淘宝',
            sizing: own(payload, 'sizing') || {},
            skus: own(payload, 'skus') || [],
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
      const assetPlan = validatePlanContract(snapshot.assetPlan);
      setupAssetPlan = assetPlan;
      const deterministicInputs = snapshot.deterministicInputs;
      const payload = {
        ...job.payload,
        assets: deterministicInputs.assets,
      };
      let holdId = cleanString(own(snapshot, 'holdId')) || cleanString(own(job.progress, 'holdId'));
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
            await runAsset({
              job: { ...job, payload },
              item,
              productTruth,
              campaignBible,
              holdId,
              canonicalPlanById,
            });
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
        const deliverableCount = Object.keys(output.images).length;
        const shouldVersionResult = status === 'completed'
          || (status === 'needs_review' && deliverableCount > 0);
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
        await persistCurrentWork(id, status);
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
    getJob,
    resumeJobs,
    runJob,
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
  onBackgroundError = error => console.error('[ecommerce] background job failed:', errorMessage(error)),
} = {}) {
  if (!orchestrator || typeof orchestrator.createJob !== 'function'
    || typeof orchestrator.getJob !== 'function') {
    throw new TypeError('orchestrator createJob and getJob are required');
  }
  return {
    async generate(req, res) {
      try {
        const job = orchestrator.createJob({
          ownerEmail: req?._userEmail,
          payload: req?.body ?? {},
        });
        Promise.resolve()
          .then(() => orchestrator.runJob(job.id))
          .catch(onBackgroundError);
        return res.status(202).json({ taskId: job.id, status: 'queued' });
      } catch (error) {
        return responseError(res, error);
      }
    },
    getJob(req, res) {
      try {
        return res.json({
          ok: true,
          task: orchestrator.getJob(req?.params?.id, { ownerEmail: req?._userEmail }),
        });
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
