import { quoteFeature } from './billing/catalog.mjs';
import { VIDEO_PRODUCTS, videoFeatureSku } from './videoCatalog.mjs';

export const VIDEO_ROUTE_POLICY_VERSION = 'video-route-policy-2026-08-21-v1';

const OBJECTIVES = new Set(['balanced', 'quality', 'speed', 'cost']);
const MODES = new Set(['smart', 'script', 'reference', 'frame', 'remake']);

// VID-P3-05 data-driven routing: bounded, deterministic blending of recent
// delivery history into the static catalog scores. Products without enough
// signal keep their static score untouched.
export const ROUTE_HISTORY_LIMIT = 500;
export const ROUTE_HISTORY_MIN_ATTEMPTS = 3;
export const ROUTE_HISTORY_WEIGHT = 0.3;
const ROUTE_HISTORY_STATES = new Set([
  'submitting', 'accepted', 'processing', 'delivered', 'failed', 'uncertain', 'confirmed_not_submitted',
]);

function text(value, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

function integer(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) return fallback;
  return normalized;
}

function normalizeReferenceCounts(value = {}) {
  return {
    images: integer(value?.images, 0, { min: 0, max: 50 }),
    videos: integer(value?.videos, 0, { min: 0, max: 20 }),
    audios: integer(value?.audios, 0, { min: 0, max: 20 }),
  };
}

export function normalizeVideoRouteRequest(input = {}) {
  const modeInput = text(input.mode, 30).toLowerCase() || 'smart';
  const mode = modeInput === 'smart' ? 'script' : modeInput;
  const resolution = text(input.resolution, 20).toLowerCase() || '720p';
  const objectiveInput = text(input.objective, 20).toLowerCase() || 'balanced';
  return {
    preferredProductId: text(input.preferredProductId, 80) || null,
    mode,
    resolution,
    durationSec: integer(input.durationSec, 8, { min: 1, max: 120 }),
    generateAudio: input.generateAudio !== false,
    referenceCounts: normalizeReferenceCounts(input.referenceCounts),
    objective: OBJECTIVES.has(objectiveInput) ? objectiveInput : 'balanced',
    invalidMode: !MODES.has(modeInput),
    invalidObjective: Boolean(objectiveInput) && !OBJECTIVES.has(objectiveInput),
  };
}

function epochMs(value) {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Keep only bounded, known-state attempt rows for routing statistics.
 * Invalid entries are dropped instead of failing the recommendation.
 */
export function normalizeRouteHistory(input = []) {
  const rows = Array.isArray(input) ? input.slice(0, ROUTE_HISTORY_LIMIT) : [];
  const normalized = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const provider = text(row.provider, 120);
    if (!provider) continue;
    const state = text(row.state, 60).toLowerCase();
    if (!ROUTE_HISTORY_STATES.has(state)) continue;
    normalized.push({
      provider,
      model: text(row.model, 120),
      state,
      productId: text(row.productId, 80),
      createdAtMs: epochMs(row.createdAt),
      updatedAtMs: epochMs(row.updatedAt),
    });
  }
  return normalized;
}

function medianOf(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

/**
 * Aggregate normalized attempts per product: attempts, delivered, successRate
 * and the median delivery seconds across delivered attempts with valid dates.
 */
export function buildRouteHistoryStats(input = []) {
  const rows = Array.isArray(input) ? input : [];
  const groups = new Map();
  for (const row of rows) {
    const productId = String(row?.productId || '').trim();
    if (!productId) continue;
    const group = groups.get(productId) || { attempts: 0, delivered: 0, latencies: [] };
    group.attempts += 1;
    if (row.state === 'delivered') {
      group.delivered += 1;
      if (Number.isSafeInteger(row.updatedAtMs) && Number.isSafeInteger(row.createdAtMs)
        && row.updatedAtMs >= row.createdAtMs) {
        group.latencies.push(Math.round((row.updatedAtMs - row.createdAtMs) / 1000));
      }
    }
    groups.set(productId, group);
  }
  const products = {};
  for (const [productId, group] of [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    products[productId] = {
      attempts: group.attempts,
      delivered: group.delivered,
      successRate: Math.round((group.delivered / group.attempts) * 10000) / 10000,
      medianDeliverySeconds: medianOf(group.latencies),
    };
  }
  return { attemptsConsidered: rows.length, products };
}

function estimatedPoints(product, durationSec) {
  const duration = Math.max(product.durations.min, Math.min(product.durations.max, durationSec));
  const sku = videoFeatureSku({ productId: product.id, duration });
  return Math.ceil(quoteFeature(sku, 1).totalUnits / 1000);
}

function evaluateProduct(product, request, historyStats = null) {
  const reasons = [];
  const blockers = [];
  const refs = request.referenceCounts;
  const totalRefs = refs.images + refs.videos + refs.audios;
  if (request.durationSec < product.durations.min || request.durationSec > product.durations.max) {
    blockers.push({ code: 'DURATION_UNSUPPORTED', detail: `${product.label} 支持 ${product.durations.min}-${product.durations.max} 秒。` });
  }
  if (!product.modes.includes(request.mode)) {
    blockers.push({ code: 'MODE_UNSUPPORTED', detail: `${product.label} 不支持「${request.mode}」模式。` });
  }
  if (!product.resolutions.includes(request.resolution)) {
    blockers.push({ code: 'RESOLUTION_UNSUPPORTED', detail: `${product.label} 不支持 ${request.resolution}。` });
  }
  if (request.generateAudio && product.generatedAudio !== true) {
    blockers.push({ code: 'AUDIO_UNSUPPORTED', detail: `${product.label} 不支持生成声音。` });
  }
  if (request.mode === 'frame' && request.generateAudio && product.frameAudio === false) {
    blockers.push({ code: 'FRAME_AUDIO_UNSUPPORTED', detail: `${product.label} 的首尾帧模式不支持声音。` });
  }
  if (refs.images > product.limits.images || refs.videos > product.limits.videos || refs.audios > product.limits.audios || totalRefs > product.limits.total) {
    blockers.push({ code: 'REFERENCE_LIMIT_EXCEEDED', detail: `${product.label} 的参考素材上限为图片 ${product.limits.images}、视频 ${product.limits.videos}、音频 ${product.limits.audios}、总计 ${product.limits.total}。` });
  }
  const points = estimatedPoints(product, request.durationSec);
  const qualityScore = (request.resolution === '2k' && product.resolutions.includes('2k') ? 100 : 55)
    + (product.id.includes('standard') ? 20 : 0);
  const speedScore = (product.concurrency || 1) * 20 + (product.id.includes('fast') ? 30 : 0);
  const costScore = Math.max(0, 140 - points);
  let score;
  if (request.objective === 'quality') score = qualityScore * 2 + speedScore * 0.1;
  else if (request.objective === 'speed') score = speedScore * 2 + qualityScore * 0.1;
  else if (request.objective === 'cost') score = costScore * 2 + speedScore * 0.1;
  else score = qualityScore + speedScore + costScore;
  let historyApplied = false;
  const productHistory = historyStats?.products?.[product.id];
  if (productHistory && productHistory.attempts >= ROUTE_HISTORY_MIN_ATTEMPTS) {
    // Bounded additive adjustment: a 100%% success rate earns up to +ROUTE_HISTORY_WEIGHT*100/2,
    // a 0%% rate costs the same; slow medians add a small extra penalty.
    const successAdjustment = ROUTE_HISTORY_WEIGHT * 100 * (productHistory.successRate - 0.5);
    const latencyPenalty = productHistory.medianDeliverySeconds === null
      ? 0
      : Math.min(productHistory.medianDeliverySeconds, 120) / 120 * 10;
    score = score + successAdjustment - latencyPenalty;
    historyApplied = true;
  }
  if (request.objective === 'speed' && product.id.includes('fast')) reasons.push('速度优先，适合快速试稿和批量迭代。');
  if (request.objective === 'quality' && product.id.includes('standard')) reasons.push('标准交付路线，优先稳定性和素材一致性。');
  if (request.objective === 'cost') reasons.push('按当前目录估算积分更低。');
  if (!blockers.length) reasons.push('满足当前时长、模式、清晰度和参考素材约束。');
  return {
    productId: product.id,
    label: product.label,
    tierLabel: product.tierLabel,
    providerLabel: product.providerLabel,
    eligible: blockers.length === 0,
    score: Math.round(score * 100) / 100,
    historyApplied,
    estimatedPoints: points,
    reasons,
    blockers,
  };
}

export function recommendVideoRoute({ request: input = {}, products = null, history = null } = {}) {
  const request = normalizeVideoRouteRequest(input);
  const routeHistory = normalizeRouteHistory(history);
  const historyStats = routeHistory.length ? buildRouteHistoryStats(routeHistory) : null;
  const blockers = [];
  const warnings = [];
  if (request.invalidMode) blockers.push({ code: 'MODE_INVALID', detail: '创作模式无效，已拒绝自动路由。' });
  if (request.invalidObjective) warnings.push('未识别的路由偏好已回退为均衡。');
  const publicProducts = (products ? Object.values(products) : Object.values(VIDEO_PRODUCTS))
    .filter(product => product?.public === true);
  const candidates = publicProducts
    .map(product => evaluateProduct(product, request, historyStats))
    .sort((left, right) => right.score - left.score || left.productId.localeCompare(right.productId));
  const eligible = candidates.filter(candidate => candidate.eligible);
  const preferred = request.preferredProductId
    ? candidates.find(candidate => candidate.productId === request.preferredProductId)
    : null;
  if (request.preferredProductId && (!preferred || !preferred.eligible)) {
    blockers.push({ code: 'PREFERRED_PRODUCT_UNAVAILABLE', detail: '指定视频产品当前不可用，已改为公开路线推荐。' });
    warnings.push('公开路线不会暴露隐藏产品，也不会在未确认时自动切换生成产品。');
  }
  const selected = preferred?.eligible ? preferred : (eligible[0] || null);
  if (!selected) {
    const uniqueCodes = new Set(blockers.map(item => item.code));
    for (const candidate of candidates) {
      for (const item of candidate.blockers) {
        if (uniqueCodes.has(item.code)) continue;
        uniqueCodes.add(item.code);
        blockers.push(item);
      }
    }
  }
  if (!selected && !blockers.some(blocker => blocker.code === 'REFERENCE_LIMIT_EXCEEDED')) {
    blockers.push({ code: 'NO_ELIGIBLE_ROUTE', detail: '当前请求没有满足能力约束的公开视频路线。' });
  }
  if (selected) warnings.push('这是生成前的能力建议；确认前不会提交供应商任务或扣除积分。');
  return {
    policyVersion: VIDEO_ROUTE_POLICY_VERSION,
    status: selected ? 'ready' : 'blocked',
    request: {
      mode: request.mode,
      resolution: request.resolution,
      durationSec: request.durationSec,
      generateAudio: request.generateAudio,
      referenceCounts: request.referenceCounts,
      objective: request.objective,
      preferredProductId: request.preferredProductId,
    },
    selected,
    selectionReason: selected ? (preferred?.eligible ? 'preferred_product' : 'best_fit') : null,
    candidates,
    blockers,
    warnings,
    ...(historyStats ? {
      historySummary: {
        attemptsConsidered: historyStats.attemptsConsidered,
        minAttempts: ROUTE_HISTORY_MIN_ATTEMPTS,
        weight: ROUTE_HISTORY_WEIGHT,
        products: historyStats.products,
      },
    } : {}),
    providerSubmission: false,
    billingMutation: false,
  };
}
