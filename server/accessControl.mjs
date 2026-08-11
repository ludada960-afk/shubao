import { randomUUID } from 'node:crypto';

export const ACCOUNT_FEATURES = Object.freeze([
  'ecommerce_image',
  'video_generation',
  'content_generation',
  'visual_creation',
]);

const ACCOUNT_ROLES = new Set(['owner', 'admin', 'tester', 'member']);
const ACCOUNT_STATUSES = new Set(['active', 'invited', 'suspended']);
const DEFAULT_OWNER_EMAIL = '867550189@qq.com';
const DEFAULT_TESTER_EMAIL = '240485042@qq.com';
const ACCESS_BOOTSTRAP_ID = 'account-access-bootstrap-2026-08-11';

function nonEmpty(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${label} is required`);
  return normalized;
}

export function normalizeAccountEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('account email must be a valid email');
  }
  return email;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function validateFeature(feature) {
  const normalized = nonEmpty(feature, 'feature');
  if (!ACCOUNT_FEATURES.includes(normalized)) {
    throw new TypeError(`Unknown account feature: ${normalized}`);
  }
  return normalized;
}

function validateFeatures(features) {
  if (!Array.isArray(features)) throw new TypeError('features must be an array');
  return [...new Set(features.map(validateFeature))];
}

function validateRole(role) {
  const normalized = nonEmpty(role, 'role').toLowerCase();
  if (!ACCOUNT_ROLES.has(normalized)) throw new TypeError(`Unknown account role: ${normalized}`);
  return normalized;
}

function validateStatus(status) {
  const normalized = nonEmpty(status, 'status').toLowerCase();
  if (!ACCOUNT_STATUSES.has(normalized)) throw new TypeError(`Unknown account status: ${normalized}`);
  return normalized;
}

function normalizeExpiresAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('expiresAt must be a valid timestamp');
  return new Date(timestamp).toISOString();
}

function auditInput(input) {
  return {
    actorEmail: normalizeAccountEmail(input.actorEmail),
    reason: nonEmpty(input.reason, 'reason'),
    idempotencyKey: nonEmpty(input.idempotencyKey, 'idempotencyKey'),
  };
}

export function ensureAccessSchema(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a better-sqlite3 database');
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_access (
      email TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','tester','member')),
      status TEXT NOT NULL CHECK(status IN ('active','invited','suspended')),
      notes TEXT NOT NULL DEFAULT '',
      expires_at TEXT,
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS account_features (
      email TEXT NOT NULL,
      feature TEXT NOT NULL CHECK(feature IN ('ecommerce_image','video_generation','content_generation','visual_creation')),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
      granted_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (email, feature)
    );
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      before_json TEXT NOT NULL DEFAULT 'null',
      after_json TEXT NOT NULL DEFAULT 'null',
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS access_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_account_access_status ON account_access(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_account_features_feature ON account_features(feature, enabled, email);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_email, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_email, created_at DESC);
  `);
}

export function getAccountAccess(db, value) {
  let email;
  try { email = normalizeAccountEmail(value); } catch { return null; }
  const row = db.prepare(`
    SELECT email, role, status, notes, expires_at
    FROM account_access WHERE email = ?
  `).get(email);
  if (!row) return null;
  const enabledRows = db.prepare(`
    SELECT feature FROM account_features WHERE email = ? AND enabled = 1
  `).all(email);
  const enabled = new Set(enabledRows.map(item => item.feature));
  const permissions = ACCOUNT_FEATURES.filter(feature => enabled.has(feature));
  return {
    email: row.email,
    role: row.role,
    status: row.status,
    notes: row.notes,
    expiresAt: row.expires_at || null,
    permissions,
    allFeatures: permissions.length === ACCOUNT_FEATURES.length,
  };
}

function denied(code, error) {
  return { ok: false, status: 403, code, error };
}

function activeAccess(db, value) {
  const account = getAccountAccess(db, value);
  if (!account) return denied('ACCOUNT_NOT_ALLOWED', '当前账号暂时无法使用此功能');
  if (account.status === 'suspended') return denied('ACCOUNT_SUSPENDED', '当前账号已暂停使用');
  if (account.status !== 'active') return denied('ACCOUNT_NOT_ACTIVE', '当前账号尚未启用');
  if (account.expiresAt && Date.parse(account.expiresAt) <= Date.now()) {
    return denied('ACCOUNT_EXPIRED', '当前账号的使用权限已到期');
  }
  return { ok: true, email: account.email, account };
}

export function requireAccountAccess(db, value) {
  return activeAccess(db, value);
}

export function requireFeatureAccess(db, value, feature) {
  const normalizedFeature = validateFeature(feature);
  const access = activeAccess(db, value);
  if (!access.ok) return access;
  if (!access.account.permissions.includes(normalizedFeature)) {
    return denied('ACCOUNT_FEATURE_FORBIDDEN', '当前账号未开通该功能');
  }
  return access;
}

export function requireAdminAccess(db, value) {
  const access = activeAccess(db, value);
  if (!access.ok) return access;
  if (!['owner', 'admin'].includes(access.account.role)) {
    return denied('ACCOUNT_ADMIN_FORBIDDEN', '当前账号没有管理权限');
  }
  return access;
}

function insertAudit(db, { actorEmail, action, targetEmail, reason, before, after, idempotencyKey }) {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO admin_audit_log (
      id, actor_email, action, target_email, reason, before_json, after_json, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, actorEmail, action, targetEmail, reason, json(before), json(after), idempotencyKey);
  return id;
}

export function upsertAccountAccess(db, input = {}) {
  const email = normalizeAccountEmail(input.email);
  const role = validateRole(input.role);
  const status = validateStatus(input.status);
  const notes = String(input.notes || '').trim().slice(0, 500);
  const expiresAt = normalizeExpiresAt(input.expiresAt);
  const audit = auditInput(input);
  ensureAccessSchema(db);

  return db.transaction(() => {
    const replay = db.prepare('SELECT after_json FROM admin_audit_log WHERE idempotency_key = ?')
      .get(audit.idempotencyKey);
    if (replay) return parseJson(replay.after_json, getAccountAccess(db, email));
    const before = getAccountAccess(db, email);
    db.prepare(`
      INSERT INTO account_access (email, role, status, notes, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        role = excluded.role,
        status = excluded.status,
        notes = excluded.notes,
        expires_at = excluded.expires_at,
        updated_at = datetime('now')
    `).run(email, role, status, notes, expiresAt, audit.actorEmail);
    const after = getAccountAccess(db, email);
    insertAudit(db, {
      ...audit,
      action: before ? 'account.update' : 'account.create',
      targetEmail: email,
      before,
      after,
    });
    return after;
  })();
}

export function replaceAccountFeatures(db, input = {}) {
  const email = normalizeAccountEmail(input.email);
  const features = validateFeatures(input.features);
  const audit = auditInput(input);
  ensureAccessSchema(db);

  return db.transaction(() => {
    const replay = db.prepare('SELECT after_json FROM admin_audit_log WHERE idempotency_key = ?')
      .get(audit.idempotencyKey);
    if (replay) return parseJson(replay.after_json, getAccountAccess(db, email));
    const before = getAccountAccess(db, email);
    if (!before) throw Object.assign(new Error('account not found'), { code: 'ACCOUNT_NOT_FOUND', status: 404 });
    const enabled = new Set(features);
    const upsert = db.prepare(`
      INSERT INTO account_features (email, feature, enabled, granted_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email, feature) DO UPDATE SET
        enabled = excluded.enabled,
        granted_by = excluded.granted_by,
        updated_at = datetime('now')
    `);
    for (const feature of ACCOUNT_FEATURES) {
      upsert.run(email, feature, enabled.has(feature) ? 1 : 0, audit.actorEmail);
    }
    const after = getAccountAccess(db, email);
    insertAudit(db, {
      ...audit,
      action: 'account.permissions.replace',
      targetEmail: email,
      before,
      after,
    });
    return after;
  })();
}

export function bootstrapDefaultAccountAccess(db) {
  ensureAccessSchema(db);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM access_migrations WHERE id = ?').get(ACCESS_BOOTSTRAP_ID)) {
      return { applied: false, migrationId: ACCESS_BOOTSTRAP_ID };
    }
    const insertAccount = db.prepare(`
      INSERT OR IGNORE INTO account_access (email, role, status, notes, created_by)
      VALUES (?, ?, 'active', ?, 'system:migration')
    `);
    const insertFeature = db.prepare(`
      INSERT OR IGNORE INTO account_features (email, feature, enabled, granted_by)
      VALUES (?, ?, 1, 'system:migration')
    `);
    insertAccount.run(DEFAULT_OWNER_EMAIL, 'owner', '系统迁移的主管理员账号');
    insertAccount.run(DEFAULT_TESTER_EMAIL, 'tester', '系统迁移的内测账号');
    for (const email of [DEFAULT_OWNER_EMAIL, DEFAULT_TESTER_EMAIL]) {
      for (const feature of ACCOUNT_FEATURES) insertFeature.run(email, feature);
    }
    db.prepare('INSERT INTO access_migrations (id) VALUES (?)').run(ACCESS_BOOTSTRAP_ID);
    return { applied: true, migrationId: ACCESS_BOOTSTRAP_ID };
  })();
}
