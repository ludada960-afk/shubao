// server/billing/priceExperiment.mjs
// 2026-08-26 周一切片 · §6 #2 标准档 ¥11.9 A/B 实验
// -----------------------------------------------------------------------------
// 风险：标准档 ¥11.9 毛利 54.4% 破 60% 主力门禁（全场唯一），上游 IP233 Seedance
// 720p ¥5.07 涨 1 毛即变 53.6%。¥12.9 毛利 57.7% 仍差 2.3pt，需绑定降本路径。
// 默认建议：先 A/B 转化率验证 2 周（50/50 split，价格随机），统计显著后再定；
// 这期间暂维持 ¥11.9。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) experimentFlag 单独存在表示实验开启，关闭时 assignPriceVariant 返回基线
//      (control, 沿用 catalog 价)，业务方不需要到处判断 null。
//   2) byUserId 稳定分流：用 userId 末 4 字符末位奇偶 50/50；不存数据库，调用时
//      决定派量，便于跨重启稳定。
//   3) splitKey 防污染：未识别 sku 抛错而不是返回 control，避免误把全量推上
//      实验组。
//   4) admin 看板 byVariant 转化指标在 adminOperations summary 处消费本模块导出
//      的 PRICING_EXPERIMENT 元数据，零耦合。

const SAFE_SKU = /^[a-z][a-z0-9_]{1,63}$/;

export const PRICING_EXPERIMENT = Object.freeze({
  // 2026-08-26 终案：实验已默认开启，flag 由环境变量收敛，开关关闭时回到 ¥11.9 基线。
  flag: 'std_ab_2026_08_26',
  sku: 'video_seedance_standard_short',
  // 实验候选价：基线=control（沿用 catalog 价 ¥11.9），treatment=¥12.9。
  variants: Object.freeze([
    Object.freeze({ key: 'control', label: 'A · ¥11.9', priceFen: 1190 }),
    Object.freeze({ key: 'treatment', label: 'B · ¥12.9', priceFen: 1290 }),
  ]),
  // 末 4 字符末位奇偶：奇→B，偶→A。无 userId 视为 anonymous，奇偶打散仍能落入两端。
  split: Object.freeze({ type: 'userIdTail4Parity', minLength: 1 }),
});

function safeSku(sku) {
  const value = typeof sku === 'string' ? sku.trim() : '';
  if (!SAFE_SKU.test(value)) throw new TypeError(`priceExperiment: unknown sku ${value}`);
  return value;
}

function envFlagEnabled(env = process.env) {
  if (!env || typeof env !== 'object') return true;
  const raw = env.PRICING_EXPERIMENT_STD_AB;
  if (raw === undefined || raw === null || raw === '') return true; // 默认开启
  return String(raw).trim() === '1';
}

export function isPriceExperimentEnabled({ env = process.env } = {}) {
  return envFlagEnabled(env);
}

export function listExperimentVariants() {
  return PRICING_EXPERIMENT.variants.map(variant => ({ ...variant }));
}

// 末 4 字符末位奇偶：找不到 4 字符时退到末位（兼容短 id 场景）。
function lastCharCode(value) {
  if (typeof value !== 'string' || value.length === 0) return 0;
  return value.charCodeAt(value.length - 1);
}

export function assignPriceVariant({ sku, userId, env = process.env } = {}) {
  const safeSkuValue = safeSku(sku);
  if (safeSkuValue !== PRICING_EXPERIMENT.sku) {
    throw new Error(`priceExperiment: sku ${safeSkuValue} is not in experiment`);
  }
  if (!isPriceExperimentEnabled({ env })) {
    return { ...PRICING_EXPERIMENT.variants[0], experimentEnabled: false };
  }
  const id = typeof userId === 'string' ? userId : '';
  const tail4 = id.slice(-4);
  const source = tail4.length === 4 ? tail4 : id.length > 0 ? id : 'anon';
  const code = lastCharCode(source);
  const isOdd = (code % 2) === 1;
  const variant = isOdd ? PRICING_EXPERIMENT.variants[1] : PRICING_EXPERIMENT.variants[0];
  return { ...variant, experimentEnabled: true };
}

// 给 adminOperations 用的纯计算：把 bySku 行按 sku+variantKey 二次分组，
// 输出每行 actions/cash_revenue/theoretical_revenue/points_consumed/provider_cost_cny。
// 输入行必须带 metadata.variantKey（从 usage_events.metadata 落库），没有则归 'unknown'。
export function breakdownByVariant(bySku) {
  const groups = new Map();
  for (const row of bySku) {
    const variantKey = (row && row.variantKey) || 'unknown';
    const sku = (row && row.sku) || 'unclassified';
    const key = `${sku}::${variantKey}`;
    const current = groups.get(key) || {
      sku,
      variantKey,
      actions: 0,
      points_consumed: 0,
      cash_revenue: 0,
      theoretical_revenue: 0,
      provider_cost_cny: 0,
    };
    current.actions += Number(row.actions || 0);
    current.points_consumed += Number(row.points_consumed || 0);
    current.cash_revenue += Number(row.cash_revenue || 0);
    current.theoretical_revenue += Number(row.theoretical_revenue || 0);
    current.provider_cost_cny += Number(row.provider_cost_cny || 0);
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((left, right) => right.actions - left.actions || left.sku.localeCompare(right.sku))
    .map(item => ({
      ...item,
      cash_revenue: Number(item.cash_revenue.toFixed(6)),
      theoretical_revenue: Number(item.theoretical_revenue.toFixed(6)),
      provider_cost_cny: Number(item.provider_cost_cny.toFixed(6)),
      theoretical_margin: item.theoretical_revenue > 0
        ? Number(((item.theoretical_revenue - item.provider_cost_cny) / item.theoretical_revenue).toFixed(4))
        : null,
    }));
}
