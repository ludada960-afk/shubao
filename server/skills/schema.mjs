/**
 * 用户自建 Skill 表结构（与 projects/ 域同风格：显式 ensure + 幂等迁移）
 *
 * 只存用户资产，不存内置 skill（内置 skill 是代码常量，随版本发布）。
 * 删除采用归档（status='archived'），保证历史生成记录里引用的版本可追溯。
 * 2026-09-10：新增 skill_groups 分组表 + user_skills.group_id（2026-09-10 用户反馈：
 * 技能需要分组，默认提供 主图/详情图/小红书/视频；分组 owner 隔离）。
 */
export const SKILL_SCHEMA_VERSION = 2;

const DEFAULT_GROUPS = Object.freeze([
  { key: 'main_image', label: '主图', kind: 'image' },
  { key: 'detail_image', label: '详情图', kind: 'image' },
  { key: 'xhs', label: '小红书', kind: 'copy' },
  { key: 'video', label: '视频', kind: 'video' },
]);

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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      group_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_skills_owner
      ON user_skills(owner_email, kind, updated_at DESC);
    CREATE TABLE IF NOT EXISTS skill_groups (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT '',
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_email, key)
    );
    CREATE INDEX IF NOT EXISTS idx_skill_groups_owner
      ON skill_groups(owner_email, status, updated_at DESC);
  `);
  // 幂等迁移：已存在的 user_skills 表补 group_id（CREATE TABLE IF NOT EXISTS 不会改老表）。
  // 注意顺序：引用 group_id 的索引必须在补列之后创建。
  const skillColumns = db.prepare('PRAGMA table_info(user_skills)').all().map(column => column.name);
  if (!skillColumns.includes('group_id')) {
    db.exec('ALTER TABLE user_skills ADD COLUMN group_id TEXT');
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_skills_group
      ON user_skills(owner_email, group_id);
  `);
  return db;
}

/** 首次访问技能库时补齐默认分组（幂等：UNIQUE(owner_email,key) 冲突即跳过） */
export function ensureDefaultSkillGroups(db, ownerEmail, { now = () => new Date().toISOString() } = {}) {
  const email = String(ownerEmail || '').trim().toLowerCase();
  if (!email) return [];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO skill_groups (id, owner_email, kind, key, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const list = [];
  for (const group of DEFAULT_GROUPS) {
    const id = `skg_default_${group.key}`;
    insert.run(id, email, group.kind, group.key, group.label, now(), now());
    list.push({ id, key: group.key, name: group.label, kind: group.kind, isDefault: true });
  }
  return list;
}

export { DEFAULT_GROUPS };
