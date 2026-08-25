/**
 * P1 认证底座 — auth 域表结构与一次性迁移
 *
 * 命名说明：主库已有 legacy `users` 表（email 主键、credits 计费字段），
 * 为不破坏 billing/works 引用，认证域用户表命名为 `auth_users`
 * （primary_email UNIQUE + nickname + status + role），其余按蓝图命名。
 * works 等域的 owner_email 引用一律不改。
 */
import { ensureAccessSchema } from '../accessControl.mjs';

export const AUTH_USERS_BRIDGE_MIGRATION_ID = 'auth-users-bridge-v1';
export const AUTH_V2_CUTOVER_MIGRATION_ID = 'auth-v2-cutover-record';

const ACCOUNT_ACCESS_STATUS_TO_AUTH_USER = Object.freeze({
  active: 'active',
  invited: 'invited',
  suspended: 'suspended',
});

export function ensureAuthSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      primary_email TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','admin','tester','member')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auth_credentials (
      user_id INTEGER PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
      password_hash TEXT NOT NULL,
      password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('login','register')),
      code_hash TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      next_send_at TEXT NOT NULL DEFAULT '',
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (email, purpose)
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      jti TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      family_id TEXT NOT NULL,
      refresh_hash TEXT NOT NULL UNIQUE,
      device TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '',
      remember INTEGER NOT NULL DEFAULT 0 CHECK(remember IN (0,1)),
      revoked_at TEXT,
      expires_at TEXT NOT NULL,
      last_refreshed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS auth_refresh_history (
      token_hash TEXT PRIMARY KEY,
      jti TEXT NOT NULL,
      family_id TEXT NOT NULL,
      superseded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, revoked_at);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_family ON auth_sessions(family_id);
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_family ON auth_refresh_history(family_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, used_at);
  `);
}

function nicknameFromEmail(email) {
  const local = String(email || '').split('@')[0] || '';
  return local.slice(0, 64);
}

/**
 * account_access 按 email 桥接进 auth_users（owner/admin 角色原样保留即管理员标记）。
 * 幂等：迁移记录写 access_migrations，行级用 primary_email UNIQUE 兜底。
 */
export function migrateAccountAccessToAuthUsers(db, { migrationId = AUTH_USERS_BRIDGE_MIGRATION_ID } = {}) {
  ensureAccessSchema(db);
  ensureAuthSchema(db);
  return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM access_migrations WHERE id = ?').get(migrationId)) {
      return { applied: false, migrationId, bridged: 0 };
    }
    const rows = db.prepare('SELECT email, role, status FROM account_access').all();
    const insert = db.prepare(`
      INSERT INTO auth_users (primary_email, nickname, role, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(primary_email) DO NOTHING
    `);
    let bridged = 0;
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) continue;
      const status = ACCOUNT_ACCESS_STATUS_TO_AUTH_USER[row.status] || 'active';
      const result = insert.run(email, nicknameFromEmail(email), row.role || 'member', status);
      bridged += result.changes;
    }
    db.prepare('INSERT INTO access_migrations (id) VALUES (?)').run(migrationId);
    return { applied: true, migrationId, bridged };
  })();
}

/**
 * 记录 v2 会话切换时间点：存量 HMAC token 的 30 天 legacy 宽限期以它为锚，
 * 重启/多进程下锚点稳定。幂等，返回宽限截止 ISO 时间。
 */
export function recordAuthV2Cutover(db, { now = () => Date.now(), graceMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  ensureAccessSchema(db);
  return db.transaction(() => {
    const at = now();
    db.prepare('INSERT OR IGNORE INTO access_migrations (id, applied_at) VALUES (?, ?)')
      .run(AUTH_V2_CUTOVER_MIGRATION_ID, new Date(at).toISOString());
    const row = db.prepare('SELECT applied_at FROM access_migrations WHERE id = ?')
      .get(AUTH_V2_CUTOVER_MIGRATION_ID);
    // 兼容由 datetime('now') 默认值写入的 "YYYY-MM-DD HH:MM:SS" 本地时间格式。
    const anchored = Date.parse(row?.applied_at || '');
    const anchorMs = Number.isFinite(anchored)
      ? anchored
      : Date.parse(String(row?.applied_at || '').replace(' ', 'T') + 'Z');
    const safeAnchorMs = Number.isFinite(anchorMs) ? anchorMs : at;
    return {
      applied: safeAnchorMs === at,
      cutoverAt: new Date(safeAnchorMs).toISOString(),
      graceEndsAt: new Date(safeAnchorMs + graceMs).toISOString(),
    };
  })();
}
