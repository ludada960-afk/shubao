import { randomUUID } from 'node:crypto';
import {
  getAccountAccess,
  normalizeAccountEmail,
  replaceAccountFeatures,
  upsertAccountAccess,
} from './accessControl.mjs';
import { buildUpstreamCostLedger } from './billing/upstreamLedger.mjs';
import { buildUnitEconomicsCatalog } from './billing/unitEconomicsCatalog.mjs';
import { VIDEO_PRODUCTS } from './videoCatalog.mjs';
import {
  PRICING_EXPERIMENT,
  breakdownByVariant,
  listExperimentVariants,
} from './billing/priceExperiment.mjs';
import {
  buildDefenseSummary,
  isoWeekStartUtc as defenseIsoWeekStartUtc,
} from './billing/priceDefensePlan.mjs';
import {
  batchCreateH3InviteCodes,
  exportH3InviteCodesCsv,
  listH3InviteCodes,
  H3_INVITE,
} from './billing/h3InviteCodes.mjs';

const CURRENCIES = ['ec_points', 'content_sets'];
const MAX_CREDIT_ADJUSTMENT = 100_000_000;

function nonEmpty(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw Object.assign(new TypeError(`${label} is required`), { code: 'ADMIN_REQUEST_INVALID' });
  return normalized;
}

function safeInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw Object.assign(new TypeError(`${label} is invalid`), { code: 'ADMIN_REQUEST_INVALID' });
  }
  return number;
}

function currency(value) {
  const normalized = String(value || 'ec_points').trim();
  if (!CURRENCIES.includes(normalized)) {
    throw Object.assign(new TypeError('currency is invalid'), { code: 'ADMIN_REQUEST_INVALID' });
  }
  return normalized;
}

function roundMoney(value) {
  return Number((Number(value) || 0).toFixed(6));
}

const SKU_CLASSIFICATIONS = Object.freeze({
  ec_image_2k: { feature: 'ecommerce_image', provider: '65535' },
  ec_image_4k: { feature: 'ecommerce_image', provider: '65535' },
  xhs_image_set_2k: { feature: 'content_generation', provider: '65535' },
  ec_nano_flash_1k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  ec_nano_flash_2k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  ec_nano_flash_4k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  ec_nano_pro_1k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  ec_nano_pro_2k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  ec_nano_pro_4k: { feature: 'ecommerce_image', provider: 'Change2Pro' },
  video_seedance_fast_short: { feature: 'video_generation', provider: 'IP233' },
  video_seedance_fast_long: { feature: 'video_generation', provider: 'IP233' },
  video_seedance_standard_short: { feature: 'video_generation', provider: 'IP233' },
  video_seedance_standard_long: { feature: 'video_generation', provider: 'IP233' },
  video_minimax_h3_2k_short: { feature: 'video_generation', provider: 'Poke' },
  video_minimax_h3_2k_long: { feature: 'video_generation', provider: 'Poke' },
  video_plan_analysis: { feature: 'video_generation', provider: '65535' },
  ec_ai_assistant: { feature: 'visual_creation', provider: '65535' },
  ec_reverse_prompt: { feature: 'ecommerce_image', provider: '65535' },
  ec_extension_analysis: { feature: 'ecommerce_image', provider: '65535' },
  ec_extension_basic: { feature: 'ecommerce_image', provider: '65535' },
  ec_extension_standard: { feature: 'ecommerce_image', provider: '65535' },
  ec_extension_complete: { feature: 'ecommerce_image', provider: '65535' },
  ec_canvas_ocr: { feature: 'visual_creation', provider: '65535' },
  ec_remove_bg: { feature: 'visual_creation', provider: '65535' },
  ec_direction_refresh: { feature: 'ecommerce_image', provider: '65535' },
  ec_smart_layer: { feature: 'visual_creation', provider: '65535' },
  ec_layer_psd: { feature: 'visual_creation', provider: '65535' },
});

// 成本定案（2026-09）：用户在 poke2api 充值实测确认美元余额按人民币 1:1 核算，
// MiniMax H3 单条成本从双情景（1:1 ≈¥0.76 / 7.15 ¥5.45）收敛为单值 ≈¥0.76/条落库；
// 看板 H3 行一律按该定案成本重算毛利，历史若按旧保守上界 ¥5.45 落库也在展示层修正。
const MINIMAX_H3_SETTLED_COST_CNY = 0.76;

function classifyUsageRow(item) {
  const fallback = SKU_CLASSIFICATIONS[item.sku] || {};
  return {
    ...item,
    feature: item.feature && item.feature !== 'unclassified' ? item.feature : (fallback.feature || 'unclassified'),
    provider: item.provider && item.provider !== 'unknown' ? item.provider : (fallback.provider || 'unknown'),
  };
}

function breakdownBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key] || 'unclassified';
    const current = grouped.get(value) || {
      [key]: value, actions: 0, points_consumed: 0, theoretical_revenue: 0,
      cash_revenue: 0, provider_cost_cny: 0,
    };
    current.actions += Number(row.actions || 0);
    current.points_consumed += Number(row.points_consumed || 0);
    current.theoretical_revenue += Number(row.theoretical_revenue || 0);
    current.cash_revenue += Number(row.cash_revenue || 0);
    current.provider_cost_cny += Number(row.provider_cost_cny || 0);
    grouped.set(value, current);
  }
  return [...grouped.values()]
    .sort((a, b) => b.provider_cost_cny - a.provider_cost_cny || b.actions - a.actions)
    .map(item => ({
      ...item,
      theoretical_revenue: roundMoney(item.theoretical_revenue),
      cash_revenue: roundMoney(item.cash_revenue),
      provider_cost_cny: roundMoney(item.provider_cost_cny),
      theoretical_contribution_cny: roundMoney(item.theoretical_revenue - item.provider_cost_cny),
    }));
}

function safeOperationalText(value, maxLength = 220) {
  return String(value || '')
    .replace(/\bsk-[a-z0-9_-]{8,}\b/gi, '[redacted]')
    .replace(/\bBearer\s+[a-z0-9._~+/=-]{8,}\b/gi, 'Bearer [redacted]')
    .replace(/\b(api[_ -]?key|token|secret|password)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .trim()
    .slice(0, maxLength);
}

function parseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function accessNotFound() {
  return Object.assign(new Error('account not found'), { code: 'ACCOUNT_NOT_FOUND', status: 404 });
}

function forbidden(message) {
  return Object.assign(new Error(message), { code: 'ADMIN_OPERATION_FORBIDDEN', status: 403 });
}

function pageOptions(input = {}) {
  return {
    limit: safeInteger(input.limit ?? 50, 'limit', { min: 1, max: 100 }),
    offset: safeInteger(input.offset ?? 0, 'offset', { min: 0, max: 1_000_000 }),
  };
}

function dateFilter(input = {}) {
  const parse = (value, label) => {
    if (!value) return null;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      throw Object.assign(new TypeError(`${label} is invalid`), { code: 'ADMIN_REQUEST_INVALID' });
    }
    return new Date(timestamp).toISOString();
  };
  const from = parse(input.from, 'from');
  const to = parse(input.to, 'to');
  if (from && to && Date.parse(from) >= Date.parse(to)) {
    throw Object.assign(new TypeError('date range is invalid'), { code: 'ADMIN_REQUEST_INVALID' });
  }
  return { from, to };
}

function whereForUsage(input = {}, alias = 'u') {
  const range = dateFilter(input);
  const predicates = [];
  const params = [];
  if (range.from) { predicates.push(`${alias}.created_at >= ?`); params.push(range.from); }
  if (range.to) { predicates.push(`${alias}.created_at < ?`); params.push(range.to); }
  if (input.feature) { predicates.push(`${alias}.feature = ?`); params.push(nonEmpty(input.feature, 'feature')); }
  if (input.provider) { predicates.push(`${alias}.provider = ?`); params.push(nonEmpty(input.provider, 'provider')); }
  return { sql: predicates.length ? `WHERE ${predicates.join(' AND ')}` : '', params };
}

export function createAdminOperations({
  db,
  walletService,
  runtimeStatus = null,
  videoOperations = null,
  videoWorkbenchMetrics = null,
} = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db is required');
  if (!walletService || typeof walletService.grant !== 'function'
    || typeof walletService.revoke !== 'function'
    || typeof walletService.getBalance !== 'function') {
    throw new TypeError('walletService with grant, revoke, and getBalance is required');
  }
  if (runtimeStatus !== null && typeof runtimeStatus !== 'function') {
    throw new TypeError('runtimeStatus must be a function');
  }
  if (videoOperations !== null && typeof videoOperations !== 'function' && typeof videoOperations !== 'object') {
    throw new TypeError('videoOperations must be an object or provider function');
  }

  const resolveVideoOperations = () => typeof videoOperations === 'function' ? videoOperations() : videoOperations;

  const tableExists = name => Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));

  const JOB_SERVICES = [
    {
      service: 'ecommerce_image', table: 'ecommerce_jobs',
      active: ['queued', 'analyzing', 'generating'],
      completed: ['completed'], failed: ['needs_review', 'failed', 'cancelled'],
    },
    {
      service: 'video_generation', table: 'video_jobs',
      active: ['queued', 'submitting', 'processing'],
      completed: ['completed'], failed: ['needs_review', 'failed', 'cancelled'],
      extras: 'provider_route, product_id, failure_class',
    },
    {
      service: 'content_generation', table: 'tasks',
      active: ['pending', 'processing'], completed: ['done'], failed: ['failed'],
    },
  ];

  function jobDateWhere(input = {}, alias = 'j') {
    const range = dateFilter(input);
    const predicates = [];
    const params = [];
    if (range.from) { predicates.push(`datetime(${alias}.created_at) >= datetime(?)`); params.push(range.from); }
    if (range.to) { predicates.push(`datetime(${alias}.created_at) < datetime(?)`); params.push(range.to); }
    return { sql: predicates.length ? `WHERE ${predicates.join(' AND ')}` : '', params };
  }

  function jobStats(input = {}) {
    const services = JOB_SERVICES.map(config => {
      if (!tableExists(config.table)) {
        return { service: config.service, total: 0, active: 0, completed: 0, failed: 0, failureRate: 0, byStatus: [] };
      }
      const where = jobDateWhere(input);
      const rows = db.prepare(`
        SELECT status, COUNT(*) AS count
        FROM ${config.table} j ${where.sql}
        GROUP BY status ORDER BY count DESC, status ASC
      `).all(...where.params);
      const count = statuses => rows
        .filter(row => statuses.includes(row.status))
        .reduce((total, row) => total + row.count, 0);
      const active = count(config.active);
      const completed = count(config.completed);
      const failed = count(config.failed);
      const terminal = completed + failed;

      // 演练加固(2026-08-26)：业务性拒绝（如积分不足）与系统性失败分开统计，
      // 并给出全时段 TOP 错误分组，避免口径混淆掩盖真实故障信号。
      let billingRejected = 0;
      const topErrors = [];
      if (tableExists(config.table) && ['ecommerce_jobs', 'video_jobs'].includes(config.table)) {
        const guard = db.prepare(`
          SELECT COUNT(*) AS n FROM ${config.table} j ${where.sql ? where.sql + ' AND ' : 'WHERE '}
            j.status = 'failed' AND (j.error LIKE '%积分不足%' OR j.error LIKE '%购买套餐%')
        `).get(...where.params);
        billingRejected = Number(guard?.n || 0);
        topErrors.push(...db.prepare(`
          SELECT COALESCE(NULLIF(j.error, ''), '(no error)') AS error, COUNT(*) AS count,
            MAX(j.updated_at) AS latestAt
          FROM ${config.table} j ${where.sql ? where.sql + ' AND ' : 'WHERE '}
            j.status IN ('failed', 'cancelled')
          GROUP BY error ORDER BY count DESC, latestAt DESC LIMIT 5
        `).all(...where.params).map(row => ({
          error: String(row.error || '').slice(0, 200),
          count: Number(row.count || 0),
          latestAt: row.latestAt,
        })));
      }
      const systemFailed = Math.max(failed - billingRejected, 0);
      const systemTerminal = completed + systemFailed;
      return {
        service: config.service,
        total: rows.reduce((total, row) => total + row.count, 0),
        active,
        completed,
        failed,
        billingRejected,
        systemFailed,
        failureRate: terminal ? Number((failed / terminal).toFixed(4)) : 0,
        systemFailureRate: systemTerminal ? Number((systemFailed / systemTerminal).toFixed(4)) : 0,
        byStatus: rows,
        topErrors,
      };
    });
    const totals = services.reduce((result, service) => ({
      total: result.total + service.total,
      active: result.active + service.active,
      completed: result.completed + service.completed,
      failed: result.failed + service.failed,
      billingRejected: result.billingRejected + Number(service.billingRejected || 0),
    }), { total: 0, active: 0, completed: 0, failed: 0, billingRejected: 0 });
    const terminal = totals.completed + totals.failed;
    const systemFailed = Math.max(totals.failed - totals.billingRejected, 0);
    const systemTerminal = totals.completed + systemFailed;
    return {
      totals: {
        ...totals,
        systemFailed,
        failureRate: terminal ? Number((totals.failed / terminal).toFixed(4)) : 0,
        // 剔除「积分不足」等业务性拒绝后的真实系统失败率；admin 看板 >10% 阈值高亮用。
        systemFailureRate: systemTerminal ? Number((systemFailed / systemTerminal).toFixed(4)) : 0,
      },
      services,
    };
  }

  function recentTasks(input = {}) {
    const limit = safeInteger(input.limit ?? 30, 'limit', { min: 1, max: 100 });
    const rows = [];
    for (const config of JOB_SERVICES) {
      if (!tableExists(config.table)) continue;
      const where = jobDateWhere(input);
      const extras = config.extras ? `, ${config.extras}` : '';
      const found = db.prepare(`
        SELECT id, owner_email, status, error, created_at, updated_at${extras}
        FROM ${config.table} j ${where.sql}
        ORDER BY datetime(updated_at) DESC, rowid DESC LIMIT ?
      `).all(...where.params, limit);
      rows.push(...found.map(row => ({
        id: row.id,
        service: config.service,
        ownerEmail: row.owner_email || '',
        status: row.status,
        error: safeOperationalText(row.error),
        providerRoute: row.provider_route || '',
        productId: row.product_id || '',
        failureClass: row.failure_class || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    }
    return rows
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);
  }

  function videoRouteStats(input = {}) {
    if (!tableExists('video_jobs')) return [];
    const where = jobDateWhere(input);
    return db.prepare(`
      SELECT COALESCE(NULLIF(provider_route, ''), 'unknown') AS routeId,
        COALESCE(NULLIF(product_id, ''), 'unknown') AS productId,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('queued','submitting','processing') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status IN ('needs_review','failed','cancelled') THEN 1 ELSE 0 END) AS failed
      FROM video_jobs j ${where.sql}
      GROUP BY COALESCE(NULLIF(provider_route, ''), 'unknown'), COALESCE(NULLIF(product_id, ''), 'unknown')
      ORDER BY total DESC
    `).all(...where.params).map(row => {
      const terminal = row.completed + row.failed;
      return { ...row, failureRate: terminal ? Number((row.failed / terminal).toFixed(4)) : 0 };
    });
  }

  function readRuntimeStatus() {
    if (!runtimeStatus) return { imageQueue: null, ecommerce: null, video: { routes: [] } };
    try {
      const status = runtimeStatus();
      return status && typeof status === 'object' ? status : { unavailable: true };
    } catch {
      return { unavailable: true };
    }
  }

  function readVideoWorkbenchMetrics() {
    if (typeof videoWorkbenchMetrics !== 'function') return { unavailable: true };
    try {
      const value = videoWorkbenchMetrics();
      return value && typeof value === 'object' ? value : { unavailable: true };
    } catch {
      return { unavailable: true };
    }
  }

  const recordAudit = ({ actorEmail, action, targetEmail, reason, before, after, idempotencyKey }) => {
    db.prepare(`
      INSERT OR IGNORE INTO admin_audit_log (
        id, actor_email, action, target_email, reason, before_json, after_json, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      normalizeAccountEmail(actorEmail),
      nonEmpty(action, 'action'),
      normalizeAccountEmail(targetEmail),
      nonEmpty(reason, 'reason'),
      JSON.stringify(before ?? null),
      JSON.stringify(after ?? null),
      nonEmpty(idempotencyKey, 'idempotencyKey'),
    );
  };

  function usageFor(email) {
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(charged_units), 0) AS charged_units,
        COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
        COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
        COALESCE(SUM(promo_subsidy_cny), 0) AS promo_subsidy,
        COALESCE(SUM(provider_cost_cny), 0) AS provider_cost,
        COUNT(*) AS action_count,
        MAX(created_at) AS last_activity
      FROM usage_events WHERE owner_email = ?
    `).get(email);
    return {
      pointsConsumed: row.charged_units,
      theoreticalRevenueCny: roundMoney(row.theoretical_revenue),
      cashRevenueCny: roundMoney(row.cash_revenue),
      promoSubsidyCny: roundMoney(row.promo_subsidy),
      providerCostCny: roundMoney(row.provider_cost),
      theoreticalContributionCny: roundMoney(row.theoretical_revenue - row.provider_cost),
      cashContributionCny: roundMoney(row.cash_revenue - row.provider_cost),
      actionCount: row.action_count,
      lastActivityAt: row.last_activity || null,
    };
  }

  function accountDetail(value) {
    const email = normalizeAccountEmail(value);
    const access = getAccountAccess(db, email);
    if (!access) throw accessNotFound();
    const balances = Object.fromEntries(CURRENCIES.map(unit => [unit, walletService.getBalance(email, unit)]));
    return { ...access, balances, usage: usageFor(email) };
  }

  function listAccounts(input = {}) {
    const { limit, offset } = pageOptions(input);
    const query = String(input.query || '').trim().toLowerCase().slice(0, 200);
    const status = String(input.status || '').trim().toLowerCase();
    const predicates = [];
    const params = [];
    if (query) { predicates.push('(email LIKE ? OR notes LIKE ?)'); params.push(`%${query}%`, `%${query}%`); }
    if (status) { predicates.push('status = ?'); params.push(status); }
    const where = predicates.length ? `WHERE ${predicates.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) AS count FROM account_access ${where}`).get(...params).count;
    const rows = db.prepare(`
      SELECT email FROM account_access ${where}
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, updated_at DESC, email ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return { total, limit, offset, accounts: rows.map(row => accountDetail(row.email)) };
  }

  function createAccount(actorEmail, input = {}) {
    const actor = getAccountAccess(db, actorEmail);
    if (!actor || actor.role !== 'owner') throw forbidden('owner access denied');
    if (input.role === 'owner') throw forbidden('不能创建第二个主管理员账号');
    const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
    const reason = nonEmpty(input.reason, 'reason');
    const account = upsertAccountAccess(db, {
      email: input.email,
      role: input.role || 'tester',
      status: input.status || 'active',
      notes: input.notes || '',
      expiresAt: input.expiresAt,
      actorEmail,
      reason,
      idempotencyKey: `${idempotencyKey}:account`,
    });
    if (Array.isArray(input.permissions)) {
      replaceAccountFeatures(db, {
        email: account.email,
        features: input.permissions,
        actorEmail,
        reason,
        idempotencyKey: `${idempotencyKey}:permissions`,
      });
    }
    return accountDetail(account.email);
  }

  function updateAccount(actorEmail, value, input = {}) {
    const actor = getAccountAccess(db, actorEmail);
    const current = getAccountAccess(db, value);
    if (!current) throw accessNotFound();
    if (!actor || actor.role !== 'owner') throw forbidden('owner access denied');
    if (current.role === 'owner' && actor.email !== current.email) throw forbidden('不能修改主管理员账号');
    if (current.email === actor.email && current.role === 'owner'
      && ((input.role && input.role !== 'owner') || (input.status && input.status !== 'active'))) {
      throw forbidden('主管理员不能停用或降级自己的账号');
    }
    if (input.role === 'owner' && current.role !== 'owner') throw forbidden('不能新增主管理员');
    return accountDetail(upsertAccountAccess(db, {
      email: current.email,
      role: input.role ?? current.role,
      status: input.status ?? current.status,
      notes: input.notes ?? current.notes,
      expiresAt: Object.hasOwn(input, 'expiresAt') ? input.expiresAt : current.expiresAt,
      actorEmail,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    }).email);
  }

  function setPermissions(actorEmail, value, input = {}) {
    const actor = getAccountAccess(db, actorEmail);
    const email = normalizeAccountEmail(value);
    const target = getAccountAccess(db, email);
    if (!target) throw accessNotFound();
    if (!actor || actor.role !== 'owner') throw forbidden('owner access denied');
    replaceAccountFeatures(db, {
      email,
      features: input.permissions,
      actorEmail,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
    return accountDetail(email);
  }

  function adjustCredits(actorEmail, value, input = {}) {
    const actor = getAccountAccess(db, actorEmail);
    const email = normalizeAccountEmail(value);
    const target = getAccountAccess(db, email);
    if (!target) throw accessNotFound();
    if (!actor || actor.role !== 'owner') throw forbidden('owner access denied');
    const operation = nonEmpty(input.operation, 'operation').toLowerCase();
    if (!['grant', 'revoke'].includes(operation)) {
      throw Object.assign(new TypeError('operation is invalid'), { code: 'ADMIN_REQUEST_INVALID' });
    }
    const selectedCurrency = currency(input.currency);
    const units = safeInteger(input.units, 'units', { min: 1, max: MAX_CREDIT_ADJUSTMENT });
    const reason = nonEmpty(input.reason, 'reason').slice(0, 500);
    const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
    const before = walletService.getBalance(email, selectedCurrency);
    const walletResult = operation === 'grant'
      ? walletService.grant({
          ownerEmail: email,
          currency: selectedCurrency,
          units,
          expiresAt: input.expiresAt || null,
          sourceType: 'admin_grant',
          sourceId: idempotencyKey,
          idempotencyKey: `admin-credit:${operation}:${idempotencyKey}`,
          metadata: { actorEmail: normalizeAccountEmail(actorEmail), reason },
        })
      : walletService.revoke({
          ownerEmail: email,
          currency: selectedCurrency,
          units,
          sourceType: 'admin_revoke',
          sourceId: idempotencyKey,
          idempotencyKey: `admin-credit:${operation}:${idempotencyKey}`,
          metadata: { actorEmail: normalizeAccountEmail(actorEmail), reason },
        });
    const after = walletService.getBalance(email, selectedCurrency);
    recordAudit({
      actorEmail,
      action: `credits.${operation}`,
      targetEmail: email,
      reason,
      before: { currency: selectedCurrency, ...before },
      after: { currency: selectedCurrency, ...after, units },
      idempotencyKey: `admin-audit:credits:${operation}:${idempotencyKey}`,
    });
    return { operation, currency: selectedCurrency, units, balance: after, wallet: walletResult };
  }

  // 视频成本看板：今日 / 近 7 日（UTC 口径，与 usage_events 的 datetime('now') 一致）。
  // 毛利口径与既有 theoretical_contribution_cny 相同：积分面值收入 − 上游成本。
  function videoCostBoard() {
    const windows = {
      today: "created_at >= datetime('now', 'start of day')",
      last7Days: "created_at >= datetime('now', '-7 days')",
    };
    const queryWindow = where => db.prepare(`
      SELECT
        COALESCE(NULLIF(sku, ''), 'unclassified') AS sku,
        COUNT(*) AS actions,
        COALESCE(SUM(charged_units + shadow_units), 0) AS points_consumed,
        COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
        COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
        COALESCE(SUM(provider_cost_cny), 0) AS provider_cost_cny
      FROM usage_events
      WHERE substr(sku, 1, 6) = 'video_' AND ${where}
      GROUP BY sku
    `).all();
    const totalsOf = rows => rows.reduce((acc, row) => ({
      calls: acc.calls + Number(row.actions || 0),
      pointsConsumed: acc.pointsConsumed + Number(row.points_consumed || 0),
      theoreticalRevenueCny: acc.theoreticalRevenueCny + Number(row.theoretical_revenue || 0),
      cashRevenueCny: acc.cashRevenueCny + Number(row.cash_revenue || 0),
      providerCostCny: acc.providerCostCny + Number(row.provider_cost_cny || 0),
    }), { calls: 0, pointsConsumed: 0, theoreticalRevenueCny: 0, cashRevenueCny: 0, providerCostCny: 0 });
    const withGrossProfit = totals => ({
      ...totals,
      theoreticalRevenueCny: roundMoney(totals.theoreticalRevenueCny),
      cashRevenueCny: roundMoney(totals.cashRevenueCny),
      providerCostCny: roundMoney(totals.providerCostCny),
      grossProfitCny: roundMoney(totals.theoreticalRevenueCny - totals.providerCostCny),
    });
    const todayRows = queryWindow(windows.today);
    const weekRows = queryWindow(windows.last7Days);
    const todayBySku = new Map(todayRows.map(row => [row.sku, row]));
    const byModel = weekRows.map(row => {
      const productId = String(row.sku).replace(/^video_/, '').replace(/_(short|long)$/, '');
      const product = VIDEO_PRODUCTS[productId];
      const todayRow = todayBySku.get(row.sku);
      const revenue = Number(row.theoretical_revenue || 0);
      const cost = Number(row.provider_cost_cny || 0);
      const actions = Number(row.actions || 0);
      const rowBase = {
        productId,
        label: product?.label || productId,
        provider: SKU_CLASSIFICATIONS[row.sku]?.provider || (productId.startsWith('minimax') ? 'Poke' : 'IP233'),
        skus: [row.sku],
        callsToday: Number(todayRow?.actions || 0),
        calls7d: actions,
        pointsConsumed7d: Number(row.points_consumed || 0),
        theoreticalRevenueCny7d: roundMoney(revenue),
        cashRevenueCny7d: roundMoney(Number(row.cash_revenue || 0)),
        providerCostCny7d: roundMoney(cost),
        avgCostPerCallCny7d: actions > 0 ? roundMoney(cost / actions) : null,
        grossProfitCny7d: roundMoney(revenue - cost),
        theoreticalMargin7d: revenue > 0 ? Number(((revenue - cost) / revenue).toFixed(4)) : null,
      };
      if (!productId.startsWith('minimax')) return rowBase;
      // H3 行：成本已定案（用户实测确认 1:1），看板按 ¥0.76/条 重算单值毛利，不再输出区间字段；
      // today/last7Days 账面合计保持落库原值，H3 行展示层按定案口径修正历史保守落库值。
      const settledCost = roundMoney(actions * MINIMAX_H3_SETTLED_COST_CNY);
      return {
        ...rowBase,
        providerCostCny7d: settledCost,
        avgCostPerCallCny7d: actions > 0 ? MINIMAX_H3_SETTLED_COST_CNY : null,
        grossProfitCny7d: roundMoney(revenue - settledCost),
        theoreticalMargin7d: revenue > 0 ? Number(((revenue - settledCost) / revenue).toFixed(4)) : null,
        costNote: '成本已定案：用户充值实测确认 poke2api 美元余额按人民币 1:1 核算，H3 单条成本 ¥0.76',
      };
    }).sort((left, right) => right.providerCostCny7d - left.providerCostCny7d || right.calls7d - left.calls7d);
    return {
      timezoneNote: 'utc',
      grossProfitFormula: 'credit_face_value_cny - provider_cost_cny',
      today: withGrossProfit(totalsOf(todayRows)),
      last7Days: withGrossProfit(totalsOf(weekRows)),
      byModel,
    };
  }

  // 2026-08-26 §6 #5 月卡细则：admin byChannel 收入看板。
  // 通过解析 payment_orders.channel_ref 字段（balance / balance_monthpack / wechat_qr / alipay）
  // 聚合最近订单，与 usage_events.cash_revenue_cny 互补（积分扣费对账不计入通道收入）。
  function byChannelRevenue(input = {}) {
    const range = dateFilter(input);
    const where = [];
    const params = [];
    if (range.from) { where.push('created_at >= ?'); params.push(range.from); }
    if (range.to) { where.push('created_at < ?'); params.push(range.to); }
    const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='payment_orders'").get()) {
      return [];
    }
    const rows = db.prepare(`
      SELECT COALESCE(NULLIF(channel_ref, ''), 'unknown') AS channel,
        COALESCE(NULLIF(product_sku, ''), 'unknown') AS sku,
        COALESCE(NULLIF(grant_currency, ''), 'unknown') AS grantCurrency,
        COUNT(*) AS orders,
        COALESCE(SUM(amount_cny), 0) AS amount_fen,
        COALESCE(SUM(grant_units), 0) AS grant_units,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
        SUM(CASE WHEN status = 'paid' THEN amount_cny ELSE 0 END) AS paid_amount_fen
      FROM payment_orders ${sql}
      GROUP BY COALESCE(NULLIF(channel_ref, ''), 'unknown'),
        COALESCE(NULLIF(product_sku, ''), 'unknown'),
        COALESCE(NULLIF(grant_currency, ''), 'unknown')
      ORDER BY paid_amount_fen DESC, orders DESC
      LIMIT 50
    `).all(...params).map(row => ({
      channel: row.channel,
      sku: row.sku,
      grantCurrency: row.grantCurrency,
      orders: Number(row.orders || 0),
      paidOrders: Number(row.paid_orders || 0),
      amountCny: roundMoney(Number(row.amount_fen || 0) / 100),
      paidAmountCny: roundMoney(Number(row.paid_amount_fen || 0) / 100),
      grantUnits: Number(row.grant_units || 0),
    }));
    // 跨 sku 汇总到 channel 级别：给 admin 看板直接展示「balance / balance_monthpack」总览。
    const channelMap = new Map();
    for (const row of rows) {
      const current = channelMap.get(row.channel) || {
        channel: row.channel,
        orders: 0, paidOrders: 0, amountCny: 0, paidAmountCny: 0, grantUnits: 0,
        skus: new Set(), giftCurrencies: new Set(),
      };
      current.orders += row.orders;
      current.paidOrders += row.paidOrders;
      current.amountCny = roundMoney(current.amountCny + row.amountCny);
      current.paidAmountCny = roundMoney(current.paidAmountCny + row.paidAmountCny);
      current.grantUnits += row.grantUnits;
      current.skus.add(row.sku);
      current.giftCurrencies.add(row.grantCurrency);
      channelMap.set(row.channel, current);
    }
    return [...channelMap.values()].map(channel => ({
      ...channel,
      skus: [...channel.skus].sort(),
      giftCurrencies: [...channel.giftCurrencies].sort(),
    })).sort((a, b) => b.paidAmountCny - a.paidAmountCny || b.orders - a.orders);
  }

  // 2026-08-26 §6 #4 降价预案：把过去 N 周的注册→付费转化率按周汇总，
  // 给 priceDefensePlan.evaluateDefensePlan 喂数据；N 至少 6 周（streak 4 周 + 缓冲 2 周）。
  function weeklyConversionRows({ weeks = 6 } = {}) {
    const limit = Math.max(1, Math.min(26, Number(weeks) || 6));
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='account_access'").get()) {
      return [];
    }
    const hasPaymentOrders = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='payment_orders'").get();
    // 注册按 account_access.created_at UTC 周一分桶，付费按 payment_orders.created_at 周一分桶。
    const signups = db.prepare(`
      SELECT date(datetime(created_at, 'weekday 1', '-7 days')) AS week_start,
        COUNT(*) AS signups
      FROM account_access
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT ?
    `).all(limit);
    const paying = hasPaymentOrders ? db.prepare(`
      SELECT date(datetime(created_at, 'weekday 1', '-7 days')) AS week_start,
        COUNT(DISTINCT customer_email) AS paying_users
      FROM payment_orders
      WHERE status = 'paid' AND customer_email IS NOT NULL AND customer_email != ''
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT ?
    `).all(limit) : [];
    const payingMap = new Map(paying.map(row => [row.week_start, Number(row.paying_users || 0)]));
    return signups.map(row => ({
      weekStart: row.week_start,
      signups: Number(row.signups || 0),
      payingUsers: payingMap.get(row.week_start) || 0,
    })).sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  }

  function summary(input = {}) {
    const usageWhere = whereForUsage(input);
    const row = db.prepare(`
      SELECT
        COALESCE(SUM(charged_units), 0) AS points_consumed,
        COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
        COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
        COALESCE(SUM(promo_subsidy_cny), 0) AS promo_subsidy,
        COALESCE(SUM(provider_cost_cny), 0) AS provider_cost,
        COUNT(*) AS settled_actions,
        COUNT(DISTINCT owner_email) AS active_accounts
      FROM usage_events u ${usageWhere.sql}
    `).get(...usageWhere.params);
    const accountCounts = db.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
      FROM account_access
    `).get();
    const jobs = jobStats(input);
    const providerCost = roundMoney(row.provider_cost);
    const theoreticalRevenue = roundMoney(row.theoretical_revenue);
    const cashRevenue = roundMoney(row.cash_revenue);
    const bySku = db.prepare(`
      SELECT COALESCE(NULLIF(sku, ''), 'unclassified') AS sku,
        COALESCE(NULLIF(feature, ''), 'unclassified') AS feature,
        COALESCE(NULLIF(provider, ''), 'unknown') AS provider,
        COALESCE(NULLIF(model, ''), '') AS model,
        COALESCE(NULLIF(json_extract(u.metadata, '$.variantKey'), ''), 'unknown') AS variantKey,
        COUNT(*) AS actions,
        COALESCE(SUM(charged_units), 0) AS points_consumed,
        COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
        COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
        COALESCE(SUM(provider_cost_cny), 0) AS provider_cost_cny
      FROM usage_events u ${usageWhere.sql}
      GROUP BY COALESCE(NULLIF(sku, ''), 'unclassified'),
        COALESCE(NULLIF(feature, ''), 'unclassified'),
        COALESCE(NULLIF(provider, ''), 'unknown'),
        COALESCE(NULLIF(model, ''), ''),
        COALESCE(NULLIF(json_extract(u.metadata, '$.variantKey'), ''), 'unknown')
      ORDER BY provider_cost_cny DESC, actions DESC
      LIMIT 100
    `).all(...usageWhere.params).map(item => ({
      ...item,
      theoretical_revenue: roundMoney(item.theoretical_revenue),
      cash_revenue: roundMoney(item.cash_revenue),
      provider_cost_cny: roundMoney(item.provider_cost_cny),
      theoretical_contribution_cny: roundMoney(Number(item.theoretical_revenue || 0) - Number(item.provider_cost_cny || 0)),
      theoretical_margin: Number(item.theoretical_revenue || 0) > 0
        ? Number(((Number(item.theoretical_revenue) - Number(item.provider_cost_cny || 0)) / Number(item.theoretical_revenue)).toFixed(4))
        : null,
    })).map(classifyUsageRow);
    // 2026-08-26 §6 #2 标准档 A/B 实验：bySku 同一 sku 现在按 variantKey 二次分组，
    // byVariant 把控 SKU 的实验行单独聚合给 admin 看板，实验 SKU 之外仍按 sku 整体聚合。
    const experimentSku = PRICING_EXPERIMENT.sku;
    const experimentRows = bySku.filter(row => row.sku === experimentSku);
    const byVariant = experimentRows.length > 0
      ? breakdownByVariant(experimentRows).map(row => ({
        ...row,
        experimentFlag: PRICING_EXPERIMENT.flag,
        // 单一 variant 转化率 = 该 variant 占比，无 baseline 时退到 null。
        shareOfSku: experimentRows.reduce((sum, r) => sum + Number(r.actions || 0), 0) > 0
          ? Number((row.actions / experimentRows.reduce((sum, r) => sum + Number(r.actions || 0), 0)).toFixed(4))
          : null,
      }))
      : [];
    return {
      metrics: {
        accountsTotal: accountCounts.total,
        accountsActive: accountCounts.active || 0,
        accountsSuspended: accountCounts.suspended || 0,
        activeAccounts: row.active_accounts,
        pointsConsumed: row.points_consumed,
        settledActions: row.settled_actions,
        failedOrReleasedActions: jobs.totals.failed,
        failureRate: jobs.totals.failureRate,
        theoreticalRevenueCny: theoreticalRevenue,
        cashRevenueCny: cashRevenue,
        promoSubsidyCny: roundMoney(row.promo_subsidy),
        providerCostCny: providerCost,
        theoreticalContributionCny: roundMoney(theoreticalRevenue - providerCost),
        cashContributionCny: roundMoney(cashRevenue - providerCost),
        theoreticalMargin: theoreticalRevenue > 0
          ? Number(((theoreticalRevenue - providerCost) / theoreticalRevenue).toFixed(4))
          : null,
      },
      byProvider: breakdownBy(bySku, 'provider'),
      byFeature: breakdownBy(bySku, 'feature'),
      bySku,
      byVariant,
      defensePlan: buildDefenseSummary(bySku, {
        weeklyRows: weeklyConversionRows({ weeks: 6 }),
        env: process.env,
      }),
      byChannel: byChannelRevenue(input),
      pricingExperiment: {
        flag: PRICING_EXPERIMENT.flag,
        sku: PRICING_EXPERIMENT.sku,
        variants: listExperimentVariants(),
        split: PRICING_EXPERIMENT.split,
        enabled: true,
      },
      unitEconomicsCatalog: buildUnitEconomicsCatalog(),
      upstreamLedger: buildUpstreamCostLedger({ bySku, localSettledCostCny: providerCost }),
      videoCost: videoCostBoard(),
      jobs,
    };
  }

  function monitoring(input = {}) {
    const tasks = recentTasks(input);
    const failures = new Map();
    for (const task of tasks.filter(item => item.error)) {
      const key = `${task.service}:${task.failureClass}:${task.error}`;
      const current = failures.get(key) || {
        service: task.service,
        failureClass: task.failureClass,
        message: task.error,
        count: 0,
        latestAt: task.updatedAt,
      };
      current.count += 1;
      failures.set(key, current);
    }
    const runtime = readRuntimeStatus();
    const persistedRoutes = videoRouteStats(input);
    const persistedByRoute = new Map(persistedRoutes.map(route => [route.routeId, route]));
    const runtimeRoutes = Array.isArray(runtime?.video?.routes) ? runtime.video.routes : [];
    const routeIds = new Set([...runtimeRoutes.map(route => route.routeId), ...persistedRoutes.map(route => route.routeId)]);
    return {
      generatedAt: new Date().toISOString(),
      runtime,
      jobs: jobStats(input),
      videoWorkbench: readVideoWorkbenchMetrics(),
      providerRoutes: [...routeIds].map(routeId => ({
        ...(persistedByRoute.get(routeId) || { routeId, total: 0, active: 0, completed: 0, failed: 0, failureRate: 0 }),
        ...(runtimeRoutes.find(route => route.routeId === routeId) || {}),
      })),
      recentTasks: tasks,
      recentFailures: [...failures.values()]
        .sort((left, right) => right.count - left.count || Date.parse(right.latestAt) - Date.parse(left.latestAt))
        .slice(0, 8),
    };
  }

  function listAudit(input = {}) {
    const { limit, offset } = pageOptions(input);
    const targetEmail = input.targetEmail ? normalizeAccountEmail(input.targetEmail) : null;
    const rows = targetEmail
      ? db.prepare('SELECT * FROM admin_audit_log WHERE target_email = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?').all(targetEmail, limit, offset)
      : db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?').all(limit, offset);
    return {
      limit,
      offset,
      entries: rows.map(row => ({
        id: row.id,
        actorEmail: row.actor_email,
        action: row.action,
        targetEmail: row.target_email,
        reason: row.reason,
        before: parseJson(row.before_json),
        after: parseJson(row.after_json),
        createdAt: row.created_at,
      })),
    };
  }

  function videoOperationsMetrics() {
    const service = resolveVideoOperations();
    return service?.metrics?.() || {
      unavailable: true,
      backlog: {},
      ageBuckets: {},
      segments: [],
      attention: [],
    };
  }

  async function runVideoReconciliation(actorEmail, input = {}) {
    const service = resolveVideoOperations();
    if (!service?.run) throw Object.assign(new Error('视频恢复服务暂不可用'), { code: 'VIDEO_OPERATION_UNAVAILABLE', status: 503 });
    const reason = nonEmpty(input.reason, 'reason');
    const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
    const result = await service.run({ limit: input.limit, force: input.force === true });
    recordAudit({
      actorEmail,
      action: 'video.reconcile',
      targetEmail: actorEmail,
      reason,
      before: null,
      after: result,
      idempotencyKey: `admin-audit:video-reconcile:${idempotencyKey}`,
    });
    return result;
  }

  // 2026-08-26 §6 #7 H3 灰度邀请：列表 + 批量生成；admin 才能调用，CSV 导出走
  // exportH3InviteCodesCsv 纯函数，路由层负责 content-type。
  function listH3Invites(input = {}) {
    const { limit, offset } = pageOptions(input);
    const rows = listH3InviteCodes(db, { limit, offset });
    return { limit, offset, total: db.prepare(`SELECT COUNT(*) AS n FROM ${H3_INVITE.table}`).get().n, codes: rows };
  }

  function createH3Invites(actorEmail, input = {}) {
    const actor = getAccountAccess(db, actorEmail);
    if (!actor || actor.role !== 'owner') throw forbidden('owner access denied');
    const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
    const reason = nonEmpty(input.reason, 'reason');
    const count = input.count ?? H3_INVITE.defaultBatchSize;
    const maxUses = input.maxUses ?? H3_INVITE.defaultMaxUses;
    const cohort = input.cohort ?? H3_INVITE.defaultCohort;
    const note = input.note ?? '';
    const result = batchCreateH3InviteCodes(db, {
      count, maxUses, cohort, note,
      actorEmail: normalizeAccountEmail(actorEmail),
      expiresAt: input.expiresAt,
    });
    recordAudit({
      actorEmail,
      action: 'h3.invites.create',
      targetEmail: actorEmail,
      reason,
      before: null,
      after: { count: result.count, maxUses, cohort },
      idempotencyKey: `admin-audit:h3-invites:${idempotencyKey}`,
    });
    return result;
  }

  function exportH3InvitesCsv() {
    const rows = listH3InviteCodes(db, { limit: 1000, offset: 0 });
    return exportH3InviteCodesCsv(rows);
  }

  async function operateVideoJob(actorEmail, jobId, input = {}) {
    const service = resolveVideoOperations();
    if (!service?.operate) throw Object.assign(new Error('视频运维服务暂不可用'), { code: 'VIDEO_OPERATION_UNAVAILABLE', status: 503 });
    const reason = nonEmpty(input.reason, 'reason');
    const idempotencyKey = nonEmpty(input.idempotencyKey, 'idempotencyKey');
    const result = await service.operate(jobId, { ...input, reason, idempotencyKey });
    const targetEmail = result?.after?.ownerEmail || result?.before?.ownerEmail || actorEmail;
    recordAudit({
      actorEmail,
      action: `video.${nonEmpty(input.action, 'action')}`,
      targetEmail,
      reason,
      before: result?.before || null,
      after: result?.after || result,
      idempotencyKey: `admin-audit:video:${idempotencyKey}`,
    });
    return result;
  }

  return {
    summary,
    monitoring,
    listAccounts,
    getAccount: accountDetail,
    createAccount,
    updateAccount,
    setPermissions,
    adjustCredits,
    listAudit,
    videoOperationsMetrics,
    runVideoReconciliation,
    operateVideoJob,
    listH3Invites,
    createH3Invites,
    exportH3InvitesCsv,
  };
}
