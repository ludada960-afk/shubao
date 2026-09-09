/**
 * 用户自建 Skill 表结构（与 projects/ 域同风格：显式 ensure + 幂等迁移）
 *
 * 只存用户资产，不存内置 skill（内置 skill 是代码常量，随版本发布）。
 * 删除采用归档（status='archived'），保证历史生成记录里引用的版本可追溯。
 */
export const SKILL_SCHEMA_VERSION = 1;

export function ensureSkillSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db must be a better-sqlite3 database');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image','video','canvas','copy')),
      name TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      params_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_user_skills_owner
      ON user_skills(owner_email, kind, updated_at DESC);
  `);
  return db;
}
