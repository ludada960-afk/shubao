// server/billing/videoMeter.mjs
// 4c183cd4 续命 P-B 视频按量切价 (2026-08-29)
//
// 设计目的：把"视频按量切价"做成可调用、可审计、可路由的纯函数模块。
// 价格与积分（units/priceFen）来源于 server/billing/catalog.mjs 中已核定的 VIDEO SKUs：
//   - video_seedance_fast_short      (Fast 720P 5s, ¥6.9, 27000 units, providerCost 5.07)
//   - video_seedance_fast_long       (Fast 720P 5s 同源, 路由别名)
//   - video_seedance_standard_short  (Standard 720P ≤8s, ¥11.9, 46000 units)
//   - video_seedance_standard_long   (Standard 720P >8s, ¥14.9, 57000 units)
//   - video_seedance_1080p           (1080P 全高清, ¥18.9, 73000 units, public=false)
//   - video_minimax_h3_2k_short      (H3 2K 短片, ¥14.9, 57000 units, public=false)
//   - video_minimax_h3_2k_long       (H3 2K 长片, ¥16.9, 57000 units, public=false)
// 输入由请求层 (query) 给出 model / seconds / resolution，按 SKU 解析后委托 costBasis 实时算毛利。
// 实际落账仍走 walletService.settleItem(providerCostCny=...) 通道（带 costBasis metadata）。
//
// 本模块不依赖任何外部 SDK / DB；只依赖 FEATURE_SKUS + costBasis 纯函数。

import { FEATURE_SKUS } from './catalog.mjs';
import {
  computeGpuCost,
  computePlatformCut,
  theoreticalPriceCny,
  deriveMarginAndHealth,
} from './costBasis.mjs';

// ── 1. 模型 → SKU 解析表 ──────────────────────────────────────
// 客户端可读 model = "seedance_fast" / "seedance_standard" / "minimax_h3_2k" 等 VIDEO_PRODUCTS.id
// resolution 决定是 "720p" 还是 "1080p" 还是 "2k"；H3 固定 2k
// seconds 决定 short (≤8s) / long (>8s)
const VIDEO_TIER_DEFINITIONS = Object.freeze([
  {
    model: 'seedance_fast',
    label: 'Seedance 2.0 Fast',
    eyebrow: 'FAST',
    skuShort: 'video_seedance_fast_short',
    skuLong: 'video_seedance_fast_long',
    resolutions: Object.freeze(['720p']),
    shortMaxSeconds: 5,
    longMaxSeconds: 15,
    costPerSecondCny: 0.50,  // 上游 65535: 0.5/秒 (与 catalog providerCostCny=5.07 校准到 5s/¥2.5 区间)
  },
  {
    model: 'seedance_standard',
    label: 'Seedance 2.0 标准',
    eyebrow: 'STANDARD',
    skuShort: 'video_seedance_standard_short',
    skuLong: 'video_seedance_standard_long',
    resolutions: Object.freeze(['720p']),
    shortMaxSeconds: 8,
    longMaxSeconds: 15,
    costPerSecondCny: 0.60,  // 上游 65535 标准 720P 0.6/秒
  },
  {
    model: 'seedance_1080p',
    label: 'Seedance 1080P',
    eyebrow: 'FULL HD',
    skuShort: 'video_seedance_1080p',
    skuLong: 'video_seedance_1080p',
    resolutions: Object.freeze(['1080p']),
    shortMaxSeconds: 15,
    longMaxSeconds: 15,
    costPerSecondCny: 0.85,  // 1080P 推算 ¥0.85/秒（与 providerCostCny=6.37 在 7.5s 区间校准）
  },
  {
    model: 'minimax_h3_2k',
    label: 'MiniMax H3 2K',
    eyebrow: 'H3 · 2K',
    skuShort: 'video_minimax_h3_2k_short',
    skuLong: 'video_minimax_h3_2k_long',
    resolutions: Object.freeze(['2k']),
    shortMaxSeconds: 8,
    longMaxSeconds: 15,
    costPerSecondCny: 0.051,  // H3 短档 providerCostCny=0.76 / 15s ≈ 0.0507
  },
]);

const SAFE_MODEL = /^[a-z][a-z0-9_-]{0,63}$/;
const SAFE_RESOLUTION = /^(?:720p|1080p|2k)$/;

function codedError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

function normalizeModel(model) {
  const v = typeof model === 'string' ? model.trim().toLowerCase() : '';
  if (!SAFE_MODEL.test(v)) throw codedError('VIDEO_METER_MODEL_INVALID', `invalid model: ${v}`);
  return v;
}

function normalizeResolution(resolution) {
  const v = typeof resolution === 'string' ? resolution.trim().toLowerCase() : '';
  if (!SAFE_RESOLUTION.test(v)) throw codedError('VIDEO_METER_RESOLUTION_INVALID', `invalid resolution: ${v}`);
  return v;
}

function normalizeSeconds(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0 || n > 60) {
    throw codedError('VIDEO_METER_SECONDS_INVALID', 'seconds must be a finite number in (0, 60]');
  }
  // 限制为 0.5 秒粒度，避免浮点污染
  return Math.round(n * 2) / 2;
}

function findTier(model) {
  const tier = VIDEO_TIER_DEFINITIONS.find(t => t.model === model);
  if (!tier) throw codedError('VIDEO_METER_MODEL_UNSUPPORTED', `unsupported video model: ${model}`);
  return tier;
}

function pickSku(tier, resolution, seconds) {
  if (!tier.resolutions.includes(resolution)) {
    throw codedError('VIDEO_METER_RESOLUTION_UNSUPPORTED',
      `model ${tier.model} does not support resolution ${resolution} (allowed: ${tier.resolutions.join(',')})`);
  }
  if (seconds > tier.longMaxSeconds) {
    throw codedError('VIDEO_METER_SECONDS_OUT_OF_RANGE',
      `model ${tier.model} supports up to ${tier.longMaxSeconds} seconds`);
  }
  // seconds <= shortMaxSeconds → short SKU；否则 long SKU
  return seconds <= tier.shortMaxSeconds ? tier.skuShort : tier.skuLong;
}

// ── 2. 纯函数：按 (model, seconds, resolution) 算 cost + margin ──
//
// 返回 { model, seconds, resolution, sku, units, priceFen, actualCostCny,
//         theoreticalPriceCny, grossProfitCny, margin, health, breakdown, ... }
//
// 关键点：
//   - actualCostCny   = (gpuSeconds * costPerSecond) 反映"上游按秒实时成本"（costBasis GPU 通道）
//   - theoreticalPriceCny = units * 199/760000 (face anchor) → 薯包理论收入
//   - margin / health 用 costBasis.deriveMarginAndHealth 算（与图片/文本走同一管线）
//   - 路由层可重复调用本函数做实时报价；实际落账仍是 walletService.settleItem(providerCostCny=actualCostCny)
export function quoteVideoMeter({ model, seconds, resolution } = {}) {
  const normalizedModel = normalizeModel(model);
  const normalizedResolution = normalizeResolution(resolution);
  const normalizedSeconds = normalizeSeconds(seconds);
  const tier = findTier(normalizedModel);
  const sku = pickSku(tier, normalizedResolution, normalizedSeconds);
  const feature = FEATURE_SKUS?.[sku];
  if (!feature) {
    throw codedError('VIDEO_METER_SKU_MISSING', `catalog missing SKU ${sku}`);
  }
  const units = Number(feature.units);
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw codedError('VIDEO_METER_SKU_UNITS_INVALID', `SKU ${sku} has invalid units`);
  }
  const priceFen = Number(feature.priceFen);
  const safePriceFen = Number.isSafeInteger(priceFen) && priceFen > 0 ? priceFen : null;
  const catalogProviderCostCny = Number(feature.providerCostCny) || 0;

  // 上游按秒成本 × 秒数 = actualCostCny（与 costBasis.computeGpuCost 同公式同粒度）
  const gpu = computeGpuCost(normalizedSeconds, tier.costPerSecondCny);
  // 平台分成 = theoreticalPriceCny * 0.03（costBasis 默认 3% 平台分成）
  const theoretical = theoreticalPriceCny({ itemUnits: units, currency: 'ec_points' });
  const platform = computePlatformCut(theoretical, {});
  // 实际成本 = 上游 GPU 单价 × 秒数（不重复计入 platformCut，因为后者已内嵌在 theoretical）
  const actualCostCny = gpu.gpuCostCny;
  const margin = deriveMarginAndHealth({ actualCostCny, theoreticalPriceCny: theoretical });

  return {
    model: normalizedModel,
    label: tier.label,
    eyebrow: tier.eyebrow,
    resolution: normalizedResolution,
    seconds: normalizedSeconds,
    sku,
    units,
    priceFen: safePriceFen,
    priceCny: safePriceFen !== null ? safePriceFen / 100 : null,
    actualCostCny: margin.actualCostCny,
    theoreticalPriceCny: margin.theoreticalPriceCny,
    grossProfitCny: margin.grossProfitCny,
    margin: margin.margin,
    health: margin.health,
    freeReruns: Number.isInteger(feature.freeReruns) ? feature.freeReruns : 0,
    public: feature.public !== false,
    breakdown: {
      gpuSeconds: gpu.breakdown.seconds,
      gpuPricePerSecond: gpu.breakdown.pricePerSecond,
      platformCutCny: platform.platformCutCny,
      platformCutRate: platform.breakdown.rate,
      catalogProviderCostCny,
      costSource: 'live_compute',
    },
  };
}

// 列举所有支持的 (model, resolution) 组合，给前端 / 文档 / admin 看板用
export function listVideoMeterTiers({ includeHidden = false } = {}) {
  return VIDEO_TIER_DEFINITIONS
    .filter(tier => includeHidden || tier.model !== 'seedance_1080p')  // 1080P 默认隐藏，与 catalog public=false 一致
    .map(tier => ({
      model: tier.model,
      label: tier.label,
      eyebrow: tier.eyebrow,
      resolutions: [...tier.resolutions],
      shortMaxSeconds: tier.shortMaxSeconds,
      longMaxSeconds: tier.longMaxSeconds,
      costPerSecondCny: tier.costPerSecondCny,
      shortSku: tier.skuShort,
      longSku: tier.skuLong,
    }));
}

export const VIDEO_METER_CONSTANTS = Object.freeze({
  VIDEO_TIER_DEFINITIONS,
  SAFE_MODEL,
  SAFE_RESOLUTION,
  MAX_SECONDS: 60,
});
