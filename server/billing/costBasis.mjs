// server/billing/costBasis.mjs
// 4c183cd4 续命 P2 成本核算精确化（2026-08-26 后续）
//
// 设计目的：把"模型单次调用实际成本"拆成三条可加项，
// 任何 settle 调用都可以把"实际花出去的模型 token + 服务器 GPU + 平台分成"按公式合成一个 actualCostCny，
// 与"用户扣分对应的理论面值 theoreticalPriceCny"对比，得出 margin / 异常告警。
//
// 三条成本分项：
//   1) tokenCostCny   — 模型 token 单价 × 实际 token 数（in/out/cache 分价；缺值回退到 catalog 单位成本）
//   2) gpuCostCny     — 视频/长上下文类生成占用 GPU 时长（秒）× 单价
//   3) platformCutCny — 平台分成（按售价百分比或固定金额），可关闭
//
// 所有金额单位为人民币元（CNY），精度保留 6 位小数，与 catalog / walletService 一致。
//
// 不依赖任何外部 SDK / DB，纯函数模块；walletService 在 settle 时把 token 用量塞进 metadata.cost，
// 然后调用 computeActualCost({...}) 即可拿到 actualCostCny + theoreticalPriceCny + margin 三个字段。

const DEFAULT_PLATFORM_CUT_RATE = 0.03;          // 3% 平台分成，与 unitEconomicsCatalog 的 0.03 保持一致
const DEFAULT_GPU_PRICE_CNY_PER_SECOND = 0.002;  // GPU 兜底单价（视频/长任务用）
const DEFAULT_TOKEN_PRICE_CNY_PER_1K = 0.0008;   // 文本模型兜底 token 单价（按 1K 计）

// ── 模型 token 单价表 (¥ / 1K token) ──
// 实际数字由销售/产品根据实时中转站报价维护；此处给"基线价"以保证即使上游未回报 token 也能记账。
// 真实场景下，调用方通常已经在 metadata.cost.token 里塞入精确数字，本表作为兜底。
const MODEL_TOKEN_PRICING = Object.freeze({
  // MiniMax H3 (视频/图片生成) — 实际多按次费/秒费结算，token 单价仅作文本回退
  'MiniMax-H3': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: 'H3 多按次费/秒费结算，token 单价留 0' }),
  'minimax-h3': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: 'H3 alias' }),
  'minimax/H3': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: 'H3 alias' }),
  // Claude Sonnet 4.6 — 文本基线
  'claude-sonnet-4.6': Object.freeze({ inputPer1k: 0.021, outputPer1k: 0.105 }),
  'claude-3-5-sonnet': Object.freeze({ inputPer1k: 0.021, outputPer1k: 0.105 }),
  'claude-3-5-sonnet-20241022': Object.freeze({ inputPer1k: 0.021, outputPer1k: 0.105 }),
  // GPT-Image-2 — 按张计费，无 token 维度
  'gpt-image-2': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按张计费' }),
  'gpt_image_2': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按张计费' }),
  // Change2Pro Nano Banana — 按张
  'gemini-3.1-flash-image': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按张计费' }),
  // Seedance 2.0 fast / standard — 按秒
  'sd5-seedance-2.0-fast': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按秒计费' }),
  'sd5-seedance-2.0': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按秒计费' }),
  'sd5-seedance-2.0-mini': Object.freeze({ inputPer1k: 0.0, outputPer1k: 0.0, note: '按秒计费' }),
});

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function ensureFiniteNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number`);
  }
  return value;
}

function ensureString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

// 把任意供应商的 model 字符串归一化到我们表里的 key（去前缀/小写）
function normalizeModelKey(model) {
  if (typeof model !== 'string') return '';
  return model.trim().toLowerCase();
}

function lookupModelPricing(model) {
  const key = normalizeModelKey(model);
  if (!key) return null;
  if (Object.hasOwn(MODEL_TOKEN_PRICING, key)) return MODEL_TOKEN_PRICING[key];
  // 大小写宽容：MODEL_TOKEN_PRICING 的 key 已经是小写，但允许大写匹配
  for (const [known, value] of Object.entries(MODEL_TOKEN_PRICING)) {
    if (known.toLowerCase() === key) return value;
  }
  return null;
}

/**
 * 计算 token 成本。
 * 输入:
 *   - tokens: { input?: number, output?: number, cached?: number }
 *   - model:   模型名（用于查 MODEL_TOKEN_PRICING 兜底单价）
 *   - unitPricePer1kOverride: 强制单价，覆盖模型表
 * 返回: { tokenCostCny, breakdown: {...} }
 */
export function computeTokenCost(tokens = {}, model = '', unitPricePer1kOverride = null) {
  const inputTokens = Number(tokens?.input) || 0;
  const outputTokens = Number(tokens?.output) || 0;
  const cachedTokens = Number(tokens?.cached) || 0;
  const fallback = lookupModelPricing(model);
  const fallbackPer1k = fallback || {
    inputPer1k: DEFAULT_TOKEN_PRICE_CNY_PER_1K,
    outputPer1k: DEFAULT_TOKEN_PRICE_CNY_PER_1K,
  };
  const inputPer1k = unitPricePer1kOverride?.input ?? fallbackPer1k.inputPer1k ?? 0;
  const outputPer1k = unitPricePer1kOverride?.output ?? fallbackPer1k.outputPer1k ?? 0;
  // cached 走 input 单价但按 10% 计（业内常见做法）
  const cachedPer1k = (inputPer1k || 0) * 0.1;
  const cost = (inputTokens / 1000) * inputPer1k
    + (outputTokens / 1000) * outputPer1k
    + (cachedTokens / 1000) * cachedPer1k;
  return {
    tokenCostCny: roundMoney(cost),
    breakdown: {
      inputTokens,
      outputTokens,
      cachedTokens,
      inputPer1k: roundMoney(inputPer1k),
      outputPer1k: roundMoney(outputPer1k),
      cachedPer1k: roundMoney(cachedPer1k),
    },
  };
}

/**
 * 计算 GPU 成本（视频/长任务）。
 * 输入:
 *   - gpuSeconds: 实际使用秒数
 *   - pricePerSecond: 强制单价（CNY/秒）；缺省走 DEFAULT_GPU_PRICE_CNY_PER_SECOND
 */
export function computeGpuCost(gpuSeconds = 0, pricePerSecond = null) {
  const seconds = ensureFiniteNonNegative(Number(gpuSeconds) || 0, 'gpuSeconds');
  const price = pricePerSecond === null || pricePerSecond === undefined
    ? DEFAULT_GPU_PRICE_CNY_PER_SECOND
    : ensureFiniteNonNegative(Number(pricePerSecond) || 0, 'pricePerSecond');
  return {
    gpuCostCny: roundMoney(seconds * price),
    breakdown: { seconds, pricePerSecond: roundMoney(price) },
  };
}

/**
 * 计算平台分成。
 * 输入:
 *   - baseCny: 售价基准（CNY）
 *   - rate:    分成比例 0~1（缺省 3%）
 *   - flat:    固定金额（CNY），与 rate 同时给定时，flat 优先
 */
export function computePlatformCut(baseCny = 0, { rate = DEFAULT_PLATFORM_CUT_RATE, flat = null } = {}) {
  const base = ensureFiniteNonNegative(Number(baseCny) || 0, 'baseCny');
  const safeRate = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : DEFAULT_PLATFORM_CUT_RATE;
  const amount = flat !== null && flat !== undefined
    ? ensureFiniteNonNegative(Number(flat) || 0, 'flat')
    : base * safeRate;
  return {
    platformCutCny: roundMoney(amount),
    breakdown: { baseCny: roundMoney(base), rate: safeRate, flat: flat === null ? null : roundMoney(flat) },
  };
}

/**
 * 把 credit_face_value (单位: 元) 换算为"理论价格"——即用户扣分按面值锚折算后薯包实际收到的人民币。
 * 沿用 walletService 现有口径: ec_points 用 ¥199/760000 ≈ ¥0.00026184/unit。
 */
const POINTS_FACE_ANCHOR_CNY = 199 / 760000;
const CONTENT_SETS_FACE_ANCHOR_CNY = 199 / 60;     // 旧 content_sets 锚，与 buildUsageAccounting 一致

export function theoreticalPriceCny({ itemUnits = 0, currency = 'ec_points' } = {}) {
  const units = ensureFiniteNonNegative(Number(itemUnits) || 0, 'itemUnits');
  const anchor = currency === 'ec_points'
    ? POINTS_FACE_ANCHOR_CNY
    : (currency === 'content_sets' ? CONTENT_SETS_FACE_ANCHOR_CNY : 0);
  return roundMoney(units * anchor);
}

/**
 * 计算毛利与告警。
 * 输入:
 *   - actualCostCny: 实际成本（token + GPU + platformCut）
 *   - theoreticalPriceCny: 理论售价（按扣分面值）
 * 返回: { actualCostCny, theoreticalPriceCny, grossProfitCny, margin, health }
 *   health: 'healthy' | 'warning' | 'breach'
 *     - healthy: margin >= 0.40
 *     - warning: 0 < margin < 0.40
 *     - breach:  margin <= 0（实际成本>=售价，亏本）或 theoreticalPrice=0 但 cost>0
 */
export function deriveMarginAndHealth({ actualCostCny = 0, theoreticalPriceCny = 0 } = {}) {
  const cost = ensureFiniteNonNegative(Number(actualCostCny) || 0, 'actualCostCny');
  const price = ensureFiniteNonNegative(Number(theoreticalPriceCny) || 0, 'theoreticalPriceCny');
  const gross = price - cost;
  const margin = price > 0 ? Number((gross / price).toFixed(4)) : (cost > 0 ? null : 1);
  let health = 'healthy';
  if (margin === null || margin <= 0) health = 'breach';
  else if (margin < 0.40) health = 'warning';
  return {
    actualCostCny: roundMoney(cost),
    theoreticalPriceCny: roundMoney(price),
    grossProfitCny: roundMoney(gross),
    margin,
    health,
  };
}

/**
 * 一站式：根据 metadata.cost.* + sku + currency + itemUnits 计算完整 cost snapshot。
 * walletService.settleItem 应该调用此函数拿到 actualCostCny/theoreticalPriceCny/margin/health 后写入 usage_events。
 *
 * 输入字段（metadata.cost 子对象）:
 *   - tokens:        { input, output, cached }
 *   - gpuSeconds:    数字（视频/长任务）
 *   - model:         模型名（用于查表）
 *   - unitPricePer1k: 强制覆盖 token 单价 { input, output }
 *   - platformCut:   { rate, flat } 平台分成
 *   - providerCostCnyOverride: 当上游已直接给出 providerCostCny 时优先使用，跳过 token+gpu+platformCut 累加
 *   - fallbackProviderCostCny: token+gpu+platformCut 算不出来时的兜底（通常 = catalog 的 providerCostCny）
 */
export function computeCostSnapshot({
  sku = '',
  currency = 'ec_points',
  itemUnits = 0,
  cost: costMeta = {},
  catalogProviderCostCny = 0,
} = {}) {
  const providerCostOverride = Number(costMeta?.providerCostCnyOverride);
  const hasOverride = Number.isFinite(providerCostOverride) && providerCostOverride >= 0;
  const token = computeTokenCost(costMeta?.tokens || {}, costMeta?.model || '', costMeta?.unitPricePer1k || null);
  const gpu = computeGpuCost(costMeta?.gpuSeconds || 0, costMeta?.gpuPricePerSecond);
  const theoretical = theoreticalPriceCny({ itemUnits, currency });
  // 平台分成的 baseCny 取 theoreticalPriceCny——即按售价分账
  const platform = computePlatformCut(theoretical, costMeta?.platformCut || {});
  const computed = roundMoney(token.tokenCostCny + gpu.gpuCostCny + platform.platformCutCny);
  const fallback = Number(catalogProviderCostCny) || 0;
  const actual = hasOverride
    ? providerCostOverride
    : (computed > 0 ? computed : fallback);
  const margin = deriveMarginAndHealth({ actualCostCny: actual, theoreticalPriceCny: theoretical });
  return {
    sku: ensureString(sku || costMeta?.sku || 'unknown', 'sku'),
    currency,
    itemUnits,
    tokenCostCny: token.tokenCostCny,
    gpuCostCny: gpu.gpuCostCny,
    platformCutCny: platform.platformCutCny,
    computedProviderCostCny: computed,
    fallbackCatalogProviderCostCny: roundMoney(fallback),
    usedOverride: hasOverride,
    actualCostCny: margin.actualCostCny,
    theoreticalPriceCny: margin.theoreticalPriceCny,
    grossProfitCny: margin.grossProfitCny,
    margin: margin.margin,
    health: margin.health,
    tokenBreakdown: token.breakdown,
    gpuBreakdown: gpu.breakdown,
    platformBreakdown: platform.breakdown,
    source: hasOverride
      ? 'upstream_override'
      : (computed > 0 ? 'live_compute' : 'catalog_fallback'),
  };
}

export const COST_BASIS_CONSTANTS = Object.freeze({
  DEFAULT_PLATFORM_CUT_RATE,
  DEFAULT_GPU_PRICE_CNY_PER_SECOND,
  DEFAULT_TOKEN_PRICE_CNY_PER_1K,
  POINTS_FACE_ANCHOR_CNY,
  CONTENT_SETS_FACE_ANCHOR_CNY,
  MODEL_TOKEN_PRICING,
});
