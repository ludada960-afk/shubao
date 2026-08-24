import {
  VIDEO_CATALOG_VERSION,
  DEFAULT_VIDEO_PRODUCT_ID,
  getVideoProduct,
  validateVideoProductInput,
  videoFeatureSku,
} from './videoCatalog.mjs';
import { quoteFeature } from './billing/catalog.mjs';
import crypto from 'node:crypto';
import { normalizeShotDirection, reviewShotContinuity } from './videoShotDirection.mjs';
import { buildVideoRendererPreflight } from './videoRendererPreflight.mjs';
import { recommendVideoRoute } from './videoModelRouter.mjs';

const MAX_SHOTS = 30;
const MAX_TOTAL_DURATION_MS = 30 * 60 * 1000;

function text(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalizeBudgetCap(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (!['number', 'string'].includes(typeof value)) {
    throw coded('VIDEO_PREFLIGHT_INPUT_INVALID', '预算上限必须是非负整数积分');
  }
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw coded('VIDEO_PREFLIGHT_INPUT_INVALID', '预算上限必须是非负整数积分');
  }
  return normalized;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

export function videoWorkbenchPlanFingerprint(plan = {}) {
  const { generatedAt: _generatedAt, planHash: _planHash, ...payload } = plan || {};
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

function blocker(code, detail, shotId = '') {
  return { code, detail, ...(shotId ? { shotId } : {}) };
}

function approvedAssetMap(workbench) {
  return new Map((Array.isArray(workbench?.assets) ? workbench.assets : []).map(asset => [asset.id, asset]));
}

function normalizeOptions(options = {}) {
  const productId = text(options.productId, 80) || DEFAULT_VIDEO_PRODUCT_ID;
  const mode = text(options.mode, 40).toLowerCase() || 'smart';
  const resolution = text(options.resolution, 20).toLowerCase() || '720p';
  const generateAudio = options.generateAudio !== false;
  const routingObjective = text(options.routingObjective, 20).toLowerCase() || 'balanced';
  return {
    productId,
    mode,
    resolution,
    generateAudio,
    routingObjective,
    budgetCapPoints: normalizeBudgetCap(options.budgetCapPoints),
    // VID-P3-05: bounded recent attempt rows handed to the router untouched;
    // the router owns normalization and drops invalid entries.
    routeHistory: Array.isArray(options.routeHistory) ? options.routeHistory.slice(0, 500) : null,
  };
}

function referenceCounts(workbench, shots) {
  const assets = new Map((Array.isArray(workbench?.assets) ? workbench.assets : []).map(asset => [asset.id, asset]));
  const referencedIds = new Set(shots.flatMap(shot => (Array.isArray(shot?.bindings) ? shot.bindings : []).map(binding => binding.assetId)).filter(Boolean));
  const counts = { images: 0, videos: 0, audios: 0 };
  for (const assetId of referencedIds) {
    const asset = assets.get(assetId);
    const mediaKind = String(asset?.mediaKind || '').toLowerCase();
    const assetKind = String(asset?.kind || '').toLowerCase();
    if (mediaKind === 'audio' || ['music', 'voice', 'audio'].includes(assetKind)) counts.audios += 1;
    else if (mediaKind === 'video' || ['video', 'motion'].includes(assetKind)) counts.videos += 1;
    else counts.images += 1;
  }
  return counts;
}

function quoteForShot(productId, durationMs) {
  const duration = Math.max(4, Math.min(15, Math.ceil(Number(durationMs || 0) / 1000)));
  const sku = videoFeatureSku({ productId, duration });
  const quote = quoteFeature(sku, 1);
  return {
    duration,
    sku,
    productId,
    units: quote.totalUnits,
    points: Math.ceil(quote.totalUnits / 1000),
  };
}

export function buildVideoWorkbenchPlan(workbench = {}, options = {}) {
  const normalized = normalizeOptions(options);
  let product;
  const shots = Array.isArray(workbench.shots) ? workbench.shots.slice(0, MAX_SHOTS) : [];
  const assets = approvedAssetMap(workbench);
  const blockers = [];
  const warnings = [];
  const totalDurationMs = shots.reduce((sum, shot) => sum + Math.max(0, Number(shot?.durationMs) || 0), 0);

  try {
    product = getVideoProduct(normalized.productId);
    if (product.public === false) throw new Error(`${product.label} 暂不向普通账号开放`);
    validateVideoProductInput({
      productId: normalized.productId,
      duration: Math.max(product.durations.min, Math.min(product.durations.max, 8)),
      mode: normalized.mode === 'smart' ? 'script' : normalized.mode,
      resolution: normalized.resolution,
      generateAudio: normalized.generateAudio,
    });
  } catch (error) {
    blockers.push(blocker('PRODUCT_OPTIONS_INVALID', error.message));
  }
  if (!shots.length) blockers.push(blocker('NO_SHOTS', '先添加至少一个分镜，再生成视频。'));
  if (shots.length >= MAX_SHOTS) warnings.push(`当前计划已达到 ${MAX_SHOTS} 个分镜的预检上限。`);
  if (totalDurationMs > MAX_TOTAL_DURATION_MS) blockers.push(blocker('PLAN_TOO_LONG', '单个项目的预检总时长不能超过 30 分钟。'));

  const lineItems = [];
  const normalizedShots = shots.map((shot, index) => {
    const shotId = text(shot?.id, 200) || `shot-${index + 1}`;
    const durationMs = Number(shot?.durationMs) || 0;
    const bindings = Array.isArray(shot?.bindings) ? shot.bindings : [];
    if (shot?.status === 'stale') blockers.push(blocker('SHOT_STALE', '该分镜引用的素材版本已变化，请重新确认。', shotId));
    if (!text(shot?.purpose, 500)) blockers.push(blocker('SHOT_PURPOSE_MISSING', '请补充分镜目的。', shotId));
    if (!text(shot?.prompt, 8000)) blockers.push(blocker('SHOT_PROMPT_MISSING', '请补充分镜提示词。', shotId));
    if (!Number.isSafeInteger(durationMs) || durationMs < 500 || durationMs > 120_000) {
      blockers.push(blocker('SHOT_DURATION_INVALID', '分镜时长必须在 0.5 到 120 秒之间。', shotId));
    }
    if (!bindings.length) blockers.push(blocker('SHOT_BINDING_MISSING', '至少绑定一个已确认素材版本。', shotId));
    bindings.forEach(binding => {
      const asset = assets.get(binding.assetId);
      if (!asset || asset.status !== 'approved' || asset.approvedVersionId !== binding.assetVersionId) {
        blockers.push(blocker('ASSET_NOT_APPROVED', '分镜引用的素材版本不是当前已确认版本。', shotId));
      }
    });
    const quote = product ? quoteForShot(normalized.productId, durationMs) : null;
    if (quote) lineItems.push({ shotId, ...quote });
    const direction = normalizeShotDirection(shot?.direction, shot?.cameraLanguage);
    return {
      id: shotId,
      position: Number.isSafeInteger(shot?.position) ? shot.position : index,
      purpose: text(shot?.purpose, 500),
      durationMs,
      cameraLanguage: direction.cameraLanguage,
      prompt: text(shot?.prompt, 8000),
      direction,
      bindingCount: bindings.length,
      status: shot?.status || 'draft',
      cost: quote ? { units: quote.units, points: quote.points } : null,
    };
  });
  const continuityReview = reviewShotContinuity(normalizedShots);
  const longestShotDurationMs = normalizedShots.reduce((max, shot) => Math.max(max, shot.durationMs), 0);
  const routeRecommendation = recommendVideoRoute({
    request: {
      preferredProductId: normalized.productId,
      mode: normalized.mode,
      resolution: normalized.resolution,
      durationSec: Math.max(4, Math.min(15, Math.ceil((longestShotDurationMs || 8000) / 1000))),
      generateAudio: normalized.generateAudio,
      referenceCounts: referenceCounts(workbench, shots),
      objective: normalized.routingObjective,
    },
    history: normalized.routeHistory ?? undefined,
  });

  if (normalized.generateAudio && !Array.isArray(workbench.audioTracks)) {
    warnings.push('当前项目没有音轨记录，将按视频产品默认声音设置报价。');
  }
  const units = blockers.length ? 0 : lineItems.reduce((sum, item) => sum + item.units, 0);
  const points = blockers.length ? 0 : lineItems.reduce((sum, item) => sum + item.points, 0);
  const budgetPolicy = {
    currency: 'ai_points',
    estimatedPoints: points,
    maximumPoints: points,
    requestedCapPoints: normalized.budgetCapPoints,
    withinCap: normalized.budgetCapPoints === null || points <= normalized.budgetCapPoints,
  };
  const plan = {
    status: blockers.length ? 'blocked' : 'ready',
    catalogVersion: VIDEO_CATALOG_VERSION,
    product: product ? { id: product.id, label: product.label, tierLabel: product.tierLabel } : { id: normalized.productId, label: '未知视频产品', tierLabel: '' },
    options: normalized,
    shots: normalizedShots,
    continuityReview,
    totalDurationMs,
    routeRecommendation,
    budgetPolicy,
    blockers,
    warnings,
    quote: {
      catalogVersion: VIDEO_CATALOG_VERSION,
      units,
      points,
      maximumUnits: units,
      maximumPoints: points,
      lineItems: blockers.length ? [] : lineItems,
    },
    generatedAt: new Date().toISOString(),
  };
  return {
    ...plan,
    preflight: buildVideoRendererPreflight({
      plan,
      workbench,
      capabilities: options.capabilities,
      rightsConfirmations: options.rightsConfirmations,
      moderation: options.moderation,
      storage: options.storage,
      enforce: options.enforcePreflight === true,
      budgetCapPoints: normalized.budgetCapPoints,
      requireRights: options.requireRights,
      requireModeration: options.requireModeration,
      requireStorage: options.requireStorage,
    }),
  };
}

export function assertVideoWorkbenchBudget(plan = {}) {
  if (plan?.budgetPolicy?.withinCap === false) {
    throw coded(
      'VIDEO_PLAN_BUDGET_EXCEEDED',
      `预估 ${plan.budgetPolicy.estimatedPoints} 积分超过本次预算上限 ${plan.budgetPolicy.requestedCapPoints} 积分`,
    );
  }
  return true;
}
