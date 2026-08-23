import { quoteFeature } from './billing/catalog.mjs';
import { VIDEO_PRODUCTS, videoFeatureSku } from './videoCatalog.mjs';

export const VIDEO_ROUTE_POLICY_VERSION = 'video-route-policy-2026-08-21-v1';

const OBJECTIVES = new Set(['balanced', 'quality', 'speed', 'cost']);
const MODES = new Set(['smart', 'script', 'reference', 'frame', 'remake']);

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

function estimatedPoints(product, durationSec) {
  const duration = Math.max(product.durations.min, Math.min(product.durations.max, durationSec));
  const sku = videoFeatureSku({ productId: product.id, duration });
  return Math.ceil(quoteFeature(sku, 1).totalUnits / 1000);
}

function evaluateProduct(product, request) {
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
    estimatedPoints: points,
    reasons,
    blockers,
  };
}

export function recommendVideoRoute({ request: input = {}, products = null } = {}) {
  const request = normalizeVideoRouteRequest(input);
  const blockers = [];
  const warnings = [];
  if (request.invalidMode) blockers.push({ code: 'MODE_INVALID', detail: '创作模式无效，已拒绝自动路由。' });
  if (request.invalidObjective) warnings.push('未识别的路由偏好已回退为均衡。');
  const publicProducts = (products ? Object.values(products) : Object.values(VIDEO_PRODUCTS))
    .filter(product => product?.public === true);
  const candidates = publicProducts
    .map(product => evaluateProduct(product, request))
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
    providerSubmission: false,
    billingMutation: false,
  };
}
