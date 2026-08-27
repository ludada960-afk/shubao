// server/billing/fastDailyLimit.mjs
// 2026-08-26 周一切片 · §6 #6 Fast 每日限次 N=2 运行时开关
// -----------------------------------------------------------------------------
// 风险：N=3 时人均日补贴 ≤¥9.6；N=2 更保守但转化弱；N=4 补贴失控。
// 默认建议：上线 N=2（锁 5s + 仅 fast 模型 + 频控），稳定一周后放宽至 N=3。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) FAST_DAILY_LIMIT 默认 2，env FAST_DAILY_LIMIT_PER_USER=整数可覆盖。
//   2) getFastDailyLimit() / isFastSku() 纯函数；不依赖 db。
//   3) countFastUsageFor(db, { ownerEmail, sku, now }) 直接查 usage_events：
//      当日（UTC 日界）该 (owner, sku) 的成功扣费次数。给 walletService 结算时用。
//   4) checkFastDailyLimit(db, { ownerEmail, sku, now }) 限次守卫：超限抛
//      FAST_DAILY_LIMIT_EXCEEDED（带 code 409 给前端做友好提示）。
//   5) fastLimitStatus(db, { sku, now }) 给 admin 看板：今日 / 本周
//      按 day 聚合，给出「触发限次的用户数 + 总触发次数」。
// -----------------------------------------------------------------------------
import { FEATURE_SKUS } from './catalog.mjs';

export const FAST_DAILY_LIMIT_DEFAULT = 2;

const FAST_SKUS = Object.freeze([
  'video_seedance_fast_short',
  'video_seedance_fast_long',
]);

export function isFastSku(sku) {
  return typeof sku === 'string' && FAST_SKUS.includes(sku);
}

export function getFastDailyLimit({ env = process.env, fallback = FAST_DAILY_LIMIT_DEFAULT } = {}) {
  const raw = env?.FAST_DAILY_LIMIT_PER_USER;
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1000) return fallback;
  return parsed;
}

function dayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isoSql(value) {
  return value.toISOString().slice(0, 19).replace('T', ' ');
}

export function countFastUsageFor(db, { ownerEmail, sku, now = new Date() } = {}) {
  if (!db || typeof db.prepare !== 'function') return 0;
  if (!isFastSku(sku)) return 0;
  const email = String(ownerEmail || '').trim().toLowerCase();
  if (!email) return 0;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='usage_events'").get()) {
    return 0;
  }
  const { start, end } = dayBounds(now);
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM usage_events
    WHERE owner_email = ?
      AND sku = ?
      AND created_at >= ? AND created_at < ?
  `).get(email, sku, isoSql(start), isoSql(end));
  return Number(row?.n || 0);
}

export function checkFastDailyLimit(db, { ownerEmail, sku, now = new Date(), limit } = {}) {
  const effectiveLimit = Number.isSafeInteger(limit) ? limit : getFastDailyLimit();
  if (!isFastSku(sku)) return { ok: true, used: 0, limit: effectiveLimit, sku };
  const used = countFastUsageFor(db, { ownerEmail, sku, now });
  if (used >= effectiveLimit) {
    const err = Object.assign(new Error('今日额度已用，明日再来'), {
      code: 'FAST_DAILY_LIMIT_EXCEEDED',
      status: 409,
      sku,
      used,
      limit: effectiveLimit,
    });
    return { ok: false, used, limit: effectiveLimit, sku, error: err };
  }
  return { ok: true, used, limit: effectiveLimit, sku };
}

// admin bySku byDay 看板：每日（UTC）× 每周日界 聚合；列出触发限次的 top 5 账号。
export function fastLimitStatus(db, { sku, now = new Date() } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    return { enabled: false, dailyLimit: getFastDailyLimit(), perDay: [], topUsers: [] };
  }
  const dailyLimit = getFastDailyLimit();
  const targetSku = isFastSku(sku) ? sku : null;
  const skus = targetSku ? [targetSku] : [...FAST_SKUS];
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='usage_events'").get()) {
    return { enabled: true, dailyLimit, skus, perDay: [], topUsers: [] };
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const start = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const placeholders = skus.map(() => '?').join(',');
    const row = db.prepare(`
      SELECT COALESCE(NULLIF(sku, ''), 'unknown') AS sku,
        COUNT(*) AS actions,
        COUNT(DISTINCT owner_email) AS activeAccounts
      FROM usage_events
      WHERE created_at >= ? AND created_at < ?
        AND sku IN (${placeholders})
      GROUP BY COALESCE(NULLIF(sku, ''), 'unknown')
      ORDER BY actions DESC
    `).all(isoSql(start), isoSql(end), ...skus);
    const dayTotal = row.reduce((sum, r) => sum + Number(r.actions || 0), 0);
    days.push({
      day: start.toISOString().slice(0, 10),
      totalActions: dayTotal,
      activeAccounts: row.reduce((max, r) => Math.max(max, Number(r.activeAccounts || 0)), 0),
      bySku: row.map(r => ({ sku: r.sku, actions: Number(r.actions || 0) })),
    });
  }
  // 7 天内触发限次的用户：按用户聚合 fast 调用次数，>= dailyLimit 视为命中
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const userPlaceholders = skus.map(() => '?').join(',');
  const userRows = db.prepare(`
    SELECT owner_email AS owner,
      COUNT(*) AS calls
    FROM usage_events
    WHERE created_at >= ? AND owner_email <> ''
      AND sku IN (${userPlaceholders})
    GROUP BY owner_email
    HAVING calls >= ?
    ORDER BY calls DESC
    LIMIT 20
  `).all(isoSql(sevenDaysAgo), ...skus, dailyLimit);
  return {
    enabled: true,
    dailyLimit,
    skus,
    perDay: days,
    topUsers: userRows.map(row => ({ owner: row.owner, calls: Number(row.calls || 0) })),
  };
}

export const FAST_DAILY_LIMIT = Object.freeze({
  defaultLimit: FAST_DAILY_LIMIT_DEFAULT,
  skus: FAST_SKUS,
  envKey: 'FAST_DAILY_LIMIT_PER_USER',
  userMessage: '今日额度已用，明日再来',
  catalogDefaults: Object.freeze(Object.fromEntries(FAST_SKUS.map(sku => [
    sku, Number(FEATURE_SKUS?.[sku]?.dailyLimitPerUser ?? FAST_DAILY_LIMIT_DEFAULT),
  ]))),
});
