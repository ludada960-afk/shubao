/**
 * 兑换码表结构（2026-09-10）
 * redeem_codes：码本体（额度/次数/有效期/状态）
 * redeem_records：兑换流水（每人每码次数上限 + 审计）
 */
export function ensureRedeemSchema(db) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db must be a better-sqlite3 database');
  db.exec(`
    CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      grant_units INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ec_points',
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      per_user_limit INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS redeem_records (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      grant_units INTEGER NOT NULL,
      ledger_key TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_redeem_records_user ON redeem_records(code, owner_email);
  `);
  return db;
}
