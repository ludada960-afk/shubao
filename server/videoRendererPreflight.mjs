import crypto from 'node:crypto';

import { getVideoProduct } from './videoCatalog.mjs';

const DEFAULT_MAX_TOTAL_DURATION_MS = 30 * 60 * 1000;
const SUPPORTED_MODERATION_STATES = new Set(['passed', 'approved', 'not_required']);
const SUPPORTED_STORAGE_TARGETS = new Set(['durable', 'object-storage', 'server']);

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function text(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function stablePlan(plan = {}) {
  const { generatedAt: _generatedAt, planHash: _planHash, preflight: _preflight, ...payload } = plan || {};
  return payload;
}

function normalizeStatus(value) {
  return text(value, 40).toLowerCase();
}

function normalizeRequirements({ enforce = false, budgetCapPoints, requireRights, requireModeration, requireStorage } = {}) {
  const normalizedBudget = budgetCapPoints === undefined || budgetCapPoints === null || budgetCapPoints === ''
    ? null
    : Number(budgetCapPoints);
  if (normalizedBudget !== null && (!Number.isSafeInteger(normalizedBudget) || normalizedBudget < 0)) {
    throw coded('VIDEO_PREFLIGHT_INPUT_INVALID', '预算上限必须是非负整数积分');
  }
  const strict = enforce === true;
  return {
    enforce: strict,
    requireRights: requireRights === undefined ? strict : requireRights === true,
    requireModeration: requireModeration === undefined ? strict : requireModeration === true,
    requireStorage: requireStorage === undefined ? strict : requireStorage === true,
    budgetCapPoints: normalizedBudget,
  };
}

function normalizeCapabilities(plan, capabilities = {}) {
  const productId = text(plan?.options?.productId || plan?.product?.id, 80);
  let product = null;
  try {
    product = getVideoProduct(productId);
  } catch {
    // The plan already carries a product blocker; retain a deterministic snapshot.
  }
  const productLimits = product?.limits || {};
  const inputLimits = capabilities?.limits && typeof capabilities.limits === 'object'
    ? capabilities.limits
    : {};
  const durations = capabilities?.durations && typeof capabilities.durations === 'object'
    ? capabilities.durations
    : product?.durations || {};
  const modes = Array.isArray(capabilities?.modes) ? capabilities.modes : product?.modes || [];
  const resolutions = Array.isArray(capabilities?.resolutions)
    ? capabilities.resolutions
    : product?.resolutions || [];
  return {
    schemaVersion: 1,
    productId,
    modes: [...new Set(modes.map(value => text(value, 40).toLowerCase()).filter(Boolean))].sort(),
    resolutions: [...new Set(resolutions.map(value => text(value, 20).toLowerCase()).filter(Boolean))].sort(),
    durations: {
      min: Number.isFinite(Number(durations.min)) ? Number(durations.min) : 0,
      max: Number.isFinite(Number(durations.max)) ? Number(durations.max) : 0,
    },
    generatedAudio: capabilities?.generatedAudio === undefined
      ? product?.generatedAudio === true
      : capabilities.generatedAudio === true,
    limits: {
      images: Number.isSafeInteger(Number(inputLimits.images)) ? Number(inputLimits.images) : Number(productLimits.images || 0),
      videos: Number.isSafeInteger(Number(inputLimits.videos)) ? Number(inputLimits.videos) : Number(productLimits.videos || 0),
      audios: Number.isSafeInteger(Number(inputLimits.audios)) ? Number(inputLimits.audios) : Number(productLimits.audios || 0),
      total: Number.isSafeInteger(Number(inputLimits.total)) ? Number(inputLimits.total) : Number(productLimits.total || 0),
    },
    maxTotalDurationMs: Number.isSafeInteger(Number(capabilities?.maxTotalDurationMs))
      ? Number(capabilities.maxTotalDurationMs)
      : DEFAULT_MAX_TOTAL_DURATION_MS,
    output: {
      contentTypes: Array.isArray(capabilities?.output?.contentTypes)
        ? [...new Set(capabilities.output.contentTypes.map(value => text(value, 120)).filter(Boolean))].sort()
        : ['video/mp4'],
      target: text(capabilities?.output?.target, 80) || 'durable',
    },
  };
}

function uniqueReferences(workbench = {}, plan = {}) {
  const assets = new Map((Array.isArray(workbench?.assets) ? workbench.assets : [])
    .map(asset => [asset.id, asset]));
  const perShot = (Array.isArray(workbench?.shots) ? workbench.shots : [])
    .map(shot => {
      const planShot = (Array.isArray(plan?.shots) ? plan.shots : []).find(item => item.id === shot.id);
      if (!planShot) return null;
      const refs = new Map();
      for (const binding of Array.isArray(shot.bindings) ? shot.bindings : []) {
        const key = `${binding.assetId}:${binding.assetVersionId}`;
        if (!refs.has(key)) refs.set(key, { assetId: binding.assetId, assetVersionId: binding.assetVersionId, kind: assets.get(binding.assetId)?.kind || 'image' });
      }
      return { shotId: planShot.id, refs: [...refs.values()] };
    })
    .filter(Boolean);
  const stats = { images: 0, videos: 0, audios: 0, total: 0 };
  const required = [];
  for (const shot of perShot) {
    const shotStats = { images: 0, videos: 0, audios: 0, total: shot.refs.length };
    for (const ref of shot.refs) {
      const kind = text(ref.kind, 80).toLowerCase();
      const bucket = kind.includes('audio') || kind.includes('music') || kind.includes('voice')
        ? 'audios'
        : kind.includes('video') ? 'videos' : 'images';
      shotStats[bucket] += 1;
      required.push({ ...ref, shotId: shot.shotId });
    }
    stats.images = Math.max(stats.images, shotStats.images);
    stats.videos = Math.max(stats.videos, shotStats.videos);
    stats.audios = Math.max(stats.audios, shotStats.audios);
    stats.total = Math.max(stats.total, shotStats.total);
  }
  return { stats, required };
}

function normalizeRights(rightsConfirmations = []) {
  const list = Array.isArray(rightsConfirmations) ? rightsConfirmations : [];
  return new Map(list.map(item => {
    const assetId = text(item?.assetId, 200);
    const assetVersionId = text(item?.assetVersionId, 200);
    return [`${assetId}:${assetVersionId}`, {
      assetId,
      assetVersionId,
      confirmed: item?.confirmed !== false,
    }];
  }).filter(([key, item]) => key !== ':' && item.confirmed));
}

function safeModeration(moderation = {}) {
  return {
    status: normalizeStatus(moderation?.status || 'not_checked'),
    policyVersion: text(moderation?.policyVersion, 100),
    checkedAt: text(moderation?.checkedAt, 80),
  };
}

function safeStorage(storage = {}) {
  return {
    durable: storage?.durable === true,
    target: text(storage?.target, 80),
    contentType: text(storage?.contentType, 120),
    maxBytes: Number.isSafeInteger(Number(storage?.maxBytes)) ? Number(storage.maxBytes) : 0,
    uploadStrategy: text(storage?.uploadStrategy, 80),
  };
}

function blocker(code, detail, extra = {}) {
  return { code, detail, ...extra };
}

export const VIDEO_PREFLIGHT_SCHEMA_VERSION = 1;

export function videoRendererPreflightFingerprint(value = {}) {
  const { preflightHash: _preflightHash, checkedAt: _checkedAt, ...payload } = value || {};
  if (payload.plan) payload.plan = stablePlan(payload.plan);
  return fingerprint(payload);
}

/**
 * Fingerprint the immutable part of a workbench plan.  Renderer handoff
 * stores this shape inside the preflight attestation so a later worker can
 * rebuild the plan from the current project and fail closed if anything has
 * changed since the user confirmed it.
 */
export function videoRendererPreflightPlanFingerprint(plan = {}) {
  return fingerprint(stablePlan(plan));
}

export function assertVideoRendererPreflightIntegrity(preflight) {
  if (!preflight || typeof preflight !== 'object' || Array.isArray(preflight)) {
    throw coded('RENDER_PREFLIGHT_INVALID', '渲染预检结果无效');
  }
  const hash = text(preflight.preflightHash, 80).toLowerCase();
  const attestation = preflight.attestation;
  if (preflight.schemaVersion !== VIDEO_PREFLIGHT_SCHEMA_VERSION
    || preflight.status !== 'ready'
    || !Array.isArray(preflight.blockers) || preflight.blockers.length
    || !Array.isArray(preflight.warnings)
    || !preflight.requirements || preflight.requirements.enforce !== true
    || preflight.providerSubmission !== false
    || preflight.billingMutation !== false
    || !/^[a-f0-9]{64}$/.test(hash)
    || !attestation || typeof attestation !== 'object' || Array.isArray(attestation)
    || attestation.schemaVersion !== VIDEO_PREFLIGHT_SCHEMA_VERSION
    || !Array.isArray(attestation.blockers) || attestation.blockers.length
    || !attestation.requirements || attestation.requirements.enforce !== true
    || attestation.providerSubmission !== false
    || attestation.billingMutation !== false
    || videoRendererPreflightFingerprint(attestation) !== hash) {
    throw coded('RENDER_PREFLIGHT_INVALID', '渲染预检证明完整性校验失败');
  }
  return true;
}

export function buildVideoRendererPreflight({
  plan = {},
  workbench = {},
  capabilities = {},
  rightsConfirmations = [],
  moderation = {},
  storage = {},
  enforce = false,
  budgetCapPoints,
  requireRights,
  requireModeration,
  requireStorage,
} = {}) {
  const requirements = normalizeRequirements({
    enforce,
    budgetCapPoints,
    requireRights,
    requireModeration,
    requireStorage,
  });
  const capabilitySnapshot = normalizeCapabilities(plan, capabilities);
  const governance = {
    moderation: safeModeration(moderation),
    storage: safeStorage(storage),
    rights: [...normalizeRights(rightsConfirmations).values()]
      .sort((left, right) => `${left.assetId}:${left.assetVersionId}`.localeCompare(`${right.assetId}:${right.assetVersionId}`)),
  };
  const { stats: referenceStats, required: requiredReferences } = uniqueReferences(workbench, plan);
  const blockers = [];
  const warnings = [];
  const mode = text(plan?.options?.mode, 40).toLowerCase() === 'smart'
    ? 'script'
    : text(plan?.options?.mode, 40).toLowerCase();
  const resolution = text(plan?.options?.resolution, 20).toLowerCase();
  const generateAudio = plan?.options?.generateAudio !== false;

  if (plan?.status !== 'ready') blockers.push(blocker('PLAN_NOT_READY', '生成计划尚未通过基础分镜和素材校验。'));
  if (!capabilitySnapshot.modes.includes(mode)) {
    blockers.push(blocker('CAPABILITY_MODE_UNSUPPORTED', `当前模型不支持“${mode || '未选择'}”模式。`));
  }
  if (!capabilitySnapshot.resolutions.includes(resolution)) {
    blockers.push(blocker('CAPABILITY_RESOLUTION_UNSUPPORTED', `当前模型不支持“${resolution || '未选择'}”清晰度。`));
  }
  const durations = Array.isArray(plan?.shots) ? plan.shots : [];
  for (const shot of durations) {
    const seconds = Number(shot?.durationMs) / 1000;
    if (!Number.isFinite(seconds) || seconds < capabilitySnapshot.durations.min || seconds > capabilitySnapshot.durations.max) {
      blockers.push(blocker('CAPABILITY_DURATION_UNSUPPORTED', `镜头时长超出当前模型 ${capabilitySnapshot.durations.min}-${capabilitySnapshot.durations.max} 秒范围。`, { shotId: shot?.id }));
    }
  }
  if (Number(plan?.totalDurationMs || 0) > capabilitySnapshot.maxTotalDurationMs) {
    blockers.push(blocker('CAPABILITY_TOTAL_DURATION_UNSUPPORTED', '项目总时长超出当前渲染能力上限。'));
  }
  if (generateAudio && !capabilitySnapshot.generatedAudio) {
    blockers.push(blocker('CAPABILITY_AUDIO_UNSUPPORTED', '当前模型不支持生成声音，请关闭声音或更换模型。'));
  }
  for (const bucket of ['images', 'videos', 'audios', 'total']) {
    if (referenceStats[bucket] > capabilitySnapshot.limits[bucket]) {
      blockers.push(blocker('CAPABILITY_REFERENCE_LIMIT_EXCEEDED', `单镜头${bucket}参考素材数量超出当前模型上限。`, { bucket }));
    }
  }

  const rights = normalizeRights(rightsConfirmations);
  const missingRights = requiredReferences.filter(ref => !rights.has(`${ref.assetId}:${ref.assetVersionId}`));
  if (missingRights.length && requirements.requireRights) {
    blockers.push(blocker('RIGHTS_CONFIRMATION_MISSING', '所有送入模型的素材版本都需要明确版权/使用权确认。', {
      references: missingRights.map(ref => ({ assetId: ref.assetId, assetVersionId: ref.assetVersionId })),
    }));
  } else if (missingRights.length) {
    warnings.push(`仍有 ${missingRights.length} 个素材版本未记录版权确认。`);
  }

  if (!SUPPORTED_MODERATION_STATES.has(governance.moderation.status)) {
    if (requirements.requireModeration) blockers.push(blocker('MODERATION_NOT_PASSED', '生成前必须完成内容安全审核。'));
    else warnings.push('内容安全审核尚未完成，正式提交前会再次拦截。');
  }

  const quotePoints = Number(plan?.quote?.points || 0);
  if (requirements.budgetCapPoints !== null && quotePoints > requirements.budgetCapPoints) {
    blockers.push(blocker('BUDGET_CAP_EXCEEDED', `预估 ${quotePoints} 积分超过本次预算上限 ${requirements.budgetCapPoints} 积分。`));
  }

  const output = capabilitySnapshot.output;
  const storageReady = governance.storage.durable
    && SUPPORTED_STORAGE_TARGETS.has(governance.storage.target || output.target)
    && output.contentTypes.includes(governance.storage.contentType || 'video/mp4')
    && governance.storage.maxBytes > 0
    && Boolean(governance.storage.uploadStrategy);
  if (!storageReady) {
    if (requirements.requireStorage) blockers.push(blocker('OUTPUT_STORAGE_UNAVAILABLE', '没有可验证的持久化视频输出存储契约。'));
    else warnings.push('尚未提供持久化输出存储契约，正式提交前必须补齐。');
  }

  const payload = {
    schemaVersion: VIDEO_PREFLIGHT_SCHEMA_VERSION,
    plan: stablePlan(plan),
    requirements,
    capabilitySnapshot,
    referenceStats,
    requiredReferences: requiredReferences.map(ref => ({
      assetId: ref.assetId,
      assetVersionId: ref.assetVersionId,
      shotId: ref.shotId,
      kind: ref.kind,
    })),
    governance,
    blockers,
    warnings,
    providerSubmission: false,
    billingMutation: false,
  };
  const preflightHash = videoRendererPreflightFingerprint(payload);
  return {
    schemaVersion: VIDEO_PREFLIGHT_SCHEMA_VERSION,
    status: blockers.length ? 'blocked' : 'ready',
    blockers,
    warnings,
    requirements,
    capabilitySnapshot,
    referenceStats,
    preflightHash,
    attestation: payload,
    providerSubmission: false,
    billingMutation: false,
  };
}
