// server/billing/priceDefensePlan.mjs
// 2026-08-26 周一切片 · §6 #4 竞争降价预案
// -----------------------------------------------------------------------------
// 风险：国内最低 WeShop ¥29.8/月、绘蛙 ¥259/月；若小云雀/可灵祭出 ¥5/5s，
// 我方 ¥11.9 标准档无还手之力。
// 默认建议：预设不公布，触发即生效。规则：
//   触发线 = 转化率（注册→付费）连续 4 周 < 2%
//   命中 SKU = video_seedance_standard_short / _long
//   命中后促销口径（admin bySku 暴露，不自动改 catalog）：
//     - 720p 标准档限时 ¥9.9（毛利 48.8% 仍亏但拉新）
//     - 1080p 标准档限时 ¥15.9
//   关闭开关：env PRICE_DEFENSE_PLAN=0 强制关闭
// -----------------------------------------------------------------------------
// 设计要点：
//   1) 纯函数 evaluateDefensePlan({ weeklyRows, now, env })：
//      入参是 admin 看板按周汇总好的 (weekStart, signups, payingUsers)，
//      不直接读 SQLite，便于测试。adminOperations 负责从 usage_events /
//      account_access 拼 weeklyRows 后再调用本模块。
//   2) DEFENSE_PLAN.candidates 冻结暴露给 admin bySku 行：
//      { sku, currentPriceFen, promoPriceFen, promoMarginFloor, reason }，
//      改 catalog 时不会被静默改价，仅 admin 看板提示「可执行促销」。
//   3) threshold = 0.02（2%）和 streakWeeks = 4 是两个独立常量。

const SAFE_SKU = /^[a-z][a-z0-9_]{1,63}$/;

export const DEFENSE_PLAN = Object.freeze({
  flag: 'price_defense_2026_08_26',
  threshold: 0.02,
  streakWeeks: 4,
  candidates: Object.freeze([
    Object.freeze({
      sku: 'video_seedance_standard_short',
      currentPriceFen: 1190,
      promoPriceFen: 990,
      promoMarginFloor: 0.40,
      reason: '720p 标准档限时 ¥9.9',
    }),
    Object.freeze({
      sku: 'video_seedance_standard_long',
      currentPriceFen: 1490,
      promoPriceFen: 1590,
      promoMarginFloor: 0.45,
      reason: '1080p 标准档限时 ¥15.9',
    }),
  ]),
});

function envFlagEnabled(env = process.env) {
  if (!env || typeof env !== 'object') return true;
  const raw = env.PRICE_DEFENSE_PLAN;
  if (raw === undefined || raw === null || raw === '') return true;
  return String(raw).trim() !== '0';
}

export function isDefensePlanEnabled({ env = process.env } = {}) {
  return envFlagEnabled(env);
}

function sanitizeWeeklyRow(row) {
  if (!row || typeof row !== 'object') return null;
  const weekStart = String(row.weekStart || '').trim();
  const signups = Number(row.signups || 0);
  const payingUsers = Number(row.payingUsers || 0);
  if (!weekStart || !Number.isFinite(signups) || !Number.isFinite(payingUsers)) return null;
  const conversionRate = signups > 0
    ? Number((payingUsers / signups).toFixed(6))
    : null;
  return {
    weekStart,
    signups: Math.max(0, signups),
    payingUsers: Math.max(0, payingUsers),
    conversionRate,
  };
}

export function evaluateDefensePlan({ weeklyRows = [], env = process.env, now = new Date() } = {}) {
  const enabled = isDefensePlanEnabled({ env });
  const weeks = weeklyRows
    .map(sanitizeWeeklyRow)
    .filter(Boolean)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  if (weeks.length === 0) {
    return {
      enabled,
      triggered: false,
      threshold: DEFENSE_PLAN.threshold,
      streakWeeks: DEFENSE_PLAN.streakWeeks,
      weeksObserved: 0,
      currentStreak: 0,
      lastWeek: null,
      reason: 'insufficient_data',
      evaluatedAt: now instanceof Date ? now.toISOString() : new Date().toISOString(),
    };
  }
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    const week = weeks[i];
    if (week.conversionRate === null) break;
    if (week.conversionRate < DEFENSE_PLAN.threshold) {
      streak += 1;
      if (streak >= DEFENSE_PLAN.streakWeeks) break;
    } else {
      break;
    }
  }
  const lastWeek = weeks[weeks.length - 1];
  const triggered = enabled && streak >= DEFENSE_PLAN.streakWeeks;
  let reason = 'within_band';
  if (!enabled) reason = 'disabled_by_env';
  else if (streak < DEFENSE_PLAN.streakWeeks) reason = 'below_streak';
  return {
    enabled,
    triggered,
    threshold: DEFENSE_PLAN.threshold,
    streakWeeks: DEFENSE_PLAN.streakWeeks,
    weeksObserved: weeks.length,
    currentStreak: streak,
    lastWeek,
    reason,
    evaluatedAt: now instanceof Date ? now.toISOString() : new Date().toISOString(),
  };
}

export function annotateDefenseCandidates(bySku, evaluation) {
  if (!Array.isArray(bySku) || bySku.length === 0) return Array.isArray(bySku) ? bySku : [];
  const candidateMap = new Map(DEFENSE_PLAN.candidates.map(c => [c.sku, c]));
  return bySku.map(row => {
    const candidate = candidateMap.get(row.sku);
    if (!candidate) return row;
    return {
      ...row,
      planFlag: DEFENSE_PLAN.flag,
      promotionEligible: true,
      currentPriceFen: candidate.currentPriceFen,
      promoPriceFen: candidate.promoPriceFen,
      promoMarginFloor: candidate.promoMarginFloor,
      promoReason: candidate.reason,
      promotionTriggered: !!(evaluation && evaluation.triggered),
    };
  });
}

export function buildDefenseSummary(bySku, { weeklyRows, env, now } = {}) {
  const evaluation = evaluateDefensePlan({ weeklyRows, env, now });
  return {
    flag: DEFENSE_PLAN.flag,
    enabled: evaluation.enabled,
    triggered: evaluation.triggered,
    threshold: evaluation.threshold,
    streakWeeks: evaluation.streakWeeks,
    currentStreak: evaluation.currentStreak || 0,
    weeksObserved: evaluation.weeksObserved,
    lastWeek: evaluation.lastWeek,
    reason: evaluation.reason,
    candidates: DEFENSE_PLAN.candidates.map(candidate => ({ ...candidate })),
    bySku: annotateDefenseCandidates(bySku, evaluation),
    evaluatedAt: evaluation.evaluatedAt,
  };
}

export function isoWeekStartUtc(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsed = isoTimestamp instanceof Date ? isoTimestamp : new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = parsed.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

export function safeSku(sku) {
  const value = typeof sku === 'string' ? sku.trim() : '';
  if (!SAFE_SKU.test(value)) throw new TypeError(`priceDefensePlan: unknown sku ${value}`);
  return value;
}
