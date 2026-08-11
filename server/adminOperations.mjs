import { randomUUID } from 'node:crypto';
import {
  getAccountAccess,
  normalizeAccountEmail,
  replaceAccountFeatures,
  upsertAccountAccess,
} from './accessControl.mjs';

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

export function createAdminOperations({ db, walletService, runtimeStatus = null } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db is required');
  if (!walletService || typeof walletService.grant !== 'function'
    || typeof walletService.revoke !== 'function'
    || typeof walletService.getBalance !== 'function') {
    throw new TypeError('walletService with grant, revoke, and getBalance is required');
  }
  if (runtimeStatus !== null && typeof runtimeStatus !== 'function') {
    throw new TypeError('runtimeStatus must be a function');
  }

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
      return {
        service: config.service,
        total: rows.reduce((total, row) => total + row.count, 0),
        active,
        completed,
        failed,
        failureRate: terminal ? Number((failed / terminal).toFixed(4)) : 0,
        byStatus: rows,
      };
    });
    const totals = services.reduce((result, service) => ({
      total: result.total + service.total,
      active: result.active + service.active,
      completed: result.completed + service.completed,
      failed: result.failed + service.failed,
    }), { total: 0, active: 0, completed: 0, failed: 0 });
    const terminal = totals.completed + totals.failed;
    return {
      totals: { ...totals, failureRate: terminal ? Number((totals.failed / terminal).toFixed(4)) : 0 },
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
    if (!actor || !['owner', 'admin'].includes(actor.role)) throw forbidden('admin access denied');
    if (input.role === 'owner') throw forbidden('不能创建第二个主管理员账号');
    if (actor.role !== 'owner' && input.role === 'admin') throw forbidden('只有主管理员可以创建管理员');
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
    if (!actor || !['owner', 'admin'].includes(actor.role)) throw forbidden('admin access denied');
    if (current.role === 'owner' && actor.email !== current.email) throw forbidden('不能修改主管理员账号');
    if (current.email === actor.email && current.role === 'owner'
      && ((input.role && input.role !== 'owner') || (input.status && input.status !== 'active'))) {
      throw forbidden('主管理员不能停用或降级自己的账号');
    }
    if (input.role === 'owner' && current.role !== 'owner') throw forbidden('不能新增主管理员');
    if (actor.role !== 'owner' && (current.role === 'admin' || input.role === 'admin')) {
      throw forbidden('管理员不能修改其他管理员');
    }
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
    if (!actor || !['owner', 'admin'].includes(actor.role)) throw forbidden('admin access denied');
    if (actor.role !== 'owner' && ['owner', 'admin'].includes(target.role)) {
      throw forbidden('管理员不能修改管理账号权限');
    }
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
    if (!actor || !['owner', 'admin'].includes(actor.role)) throw forbidden('admin access denied');
    if (actor.role !== 'owner' && target.role === 'owner') throw forbidden('管理员不能调整主管理员额度');
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
      byProvider: db.prepare(`
        SELECT COALESCE(NULLIF(provider, ''), 'unknown') AS provider,
          COUNT(*) AS actions,
          COALESCE(SUM(charged_units), 0) AS points_consumed,
          COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
          COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
          COALESCE(SUM(provider_cost_cny), 0) AS provider_cost_cny
        FROM usage_events u ${usageWhere.sql}
        GROUP BY COALESCE(NULLIF(provider, ''), 'unknown')
        ORDER BY provider_cost_cny DESC
      `).all(...usageWhere.params).map(item => ({
        ...item,
        theoretical_revenue: roundMoney(item.theoretical_revenue),
        cash_revenue: roundMoney(item.cash_revenue),
        provider_cost_cny: roundMoney(item.provider_cost_cny),
        theoretical_contribution_cny: roundMoney(Number(item.theoretical_revenue || 0) - Number(item.provider_cost_cny || 0)),
      })),
      byFeature: db.prepare(`
        SELECT COALESCE(NULLIF(feature, ''), 'unclassified') AS feature,
          COUNT(*) AS actions,
          COALESCE(SUM(charged_units), 0) AS points_consumed,
          COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
          COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
          COALESCE(SUM(provider_cost_cny), 0) AS provider_cost_cny
        FROM usage_events u ${usageWhere.sql}
        GROUP BY COALESCE(NULLIF(feature, ''), 'unclassified')
        ORDER BY provider_cost_cny DESC
      `).all(...usageWhere.params).map(item => ({
        ...item,
        theoretical_revenue: roundMoney(item.theoretical_revenue),
        cash_revenue: roundMoney(item.cash_revenue),
        provider_cost_cny: roundMoney(item.provider_cost_cny),
        theoretical_contribution_cny: roundMoney(Number(item.theoretical_revenue || 0) - Number(item.provider_cost_cny || 0)),
      })),
      bySku: db.prepare(`
        SELECT COALESCE(NULLIF(sku, ''), 'unclassified') AS sku,
          COALESCE(NULLIF(feature, ''), 'unclassified') AS feature,
          COALESCE(NULLIF(provider, ''), 'unknown') AS provider,
          COALESCE(NULLIF(model, ''), '') AS model,
          COUNT(*) AS actions,
          COALESCE(SUM(charged_units), 0) AS points_consumed,
          COALESCE(SUM(credit_face_value_cny), 0) AS theoretical_revenue,
          COALESCE(SUM(cash_revenue_cny), 0) AS cash_revenue,
          COALESCE(SUM(provider_cost_cny), 0) AS provider_cost_cny
        FROM usage_events u ${usageWhere.sql}
        GROUP BY COALESCE(NULLIF(sku, ''), 'unclassified'),
          COALESCE(NULLIF(feature, ''), 'unclassified'),
          COALESCE(NULLIF(provider, ''), 'unknown'),
          COALESCE(NULLIF(model, ''), '')
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
      })),
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
  };
}
