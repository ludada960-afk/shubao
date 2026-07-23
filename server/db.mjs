/**
 * 薯包AI 数据库层（SQLite）
 * 代替 JSON 文件存储，支持并发写入
 */
import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, 'works.db');

let db;
let activeDbPath;

export function initDB(dbPath = DB_PATH) {
  if (db && activeDbPath === dbPath) return db;
  if (db) { try { db.close(); } catch {} }
  db = new Database(dbPath);
  activeDbPath = dbPath;
  // WAL 模式：读不阻塞写，写不阻塞读
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      _saveKey TEXT UNIQUE,
      title TEXT DEFAULT '',
      body_text TEXT DEFAULT '',
      hashtags TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      pages TEXT DEFAULT '[]',
      cover_url TEXT DEFAULT '',
      image_urls TEXT DEFAULT '[]',
      image_count INTEGER DEFAULT 0,
      _inputText TEXT DEFAULT '',
      visual_system TEXT DEFAULT '',
      cover_prompt TEXT DEFAULT '',
      image_prompts TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      error TEXT DEFAULT '',
      payload TEXT DEFAULT '{}',
      deleted_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_works_savekey ON works(_saveKey);
    CREATE INDEX IF NOT EXISTS idx_works_created ON works(created_at DESC);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'pending',
      text TEXT DEFAULT '',
      owner_email TEXT DEFAULT '',
      progress TEXT DEFAULT '{}',
      result TEXT DEFAULT '{}',
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      credits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  // 兼容已经运行过旧版表结构的线上数据库。
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all().map(column => column.name);
  if (!taskColumns.includes('owner_email')) {
    db.exec("ALTER TABLE tasks ADD COLUMN owner_email TEXT DEFAULT ''");
  }
  const workColumns = db.prepare("PRAGMA table_info(works)").all().map(column => column.name);
  if (!workColumns.includes('payload')) {
    db.exec("ALTER TABLE works ADD COLUMN payload TEXT DEFAULT '{}'");
  }
  if (!workColumns.includes('deleted_at')) {
    db.exec("ALTER TABLE works ADD COLUMN deleted_at TEXT DEFAULT ''");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_email, created_at DESC)');

  console.log('  → SQLite 数据库就绪:', dbPath);
  return db;
}

// =========== 作品 CRUD ===========

/** 获取全部作品，按创建时间倒序 */
export function getAllWorks({ includeDeleted = false } = {}) {
  if (!db) initDB();
  const rows = db.prepare(`SELECT * FROM works ${includeDeleted ? '' : "WHERE COALESCE(deleted_at, '') = ''"} ORDER BY id DESC LIMIT 100`).all();
  return rows.map(rowToWork);
}

export function getDeletedWorks() {
  if (!db) initDB();
  return db.prepare("SELECT * FROM works WHERE COALESCE(deleted_at, '') <> '' ORDER BY updated_at DESC LIMIT 100").all().map(rowToWork);
}

/** 按 _saveKey 查单个作品 */
export function getWorkBySaveKey(saveKey) {
  if (!db) initDB();
  const row = db.prepare('SELECT * FROM works WHERE _saveKey = ?').get(saveKey);
  return row ? rowToWork(row) : null;
}

/** 插入或更新作品（按 _saveKey） */
export function upsertWork(work) {
  if (!db) initDB();
  const saveKey = work._saveKey || String(Date.now() + Math.random());
  const stmt = db.prepare(`
    INSERT INTO works (_saveKey, title, body_text, hashtags, category, pages,
      cover_url, image_urls, image_count, _inputText, visual_system,
      cover_prompt, image_prompts, tags, error, payload, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      datetime('now', 'localtime'))
    ON CONFLICT(_saveKey) DO UPDATE SET
      title = excluded.title,
      body_text = excluded.body_text,
      hashtags = excluded.hashtags,
      category = excluded.category,
      pages = excluded.pages,
      cover_url = excluded.cover_url,
      image_urls = excluded.image_urls,
      image_count = excluded.image_count,
      _inputText = excluded._inputText,
      visual_system = excluded.visual_system,
      cover_prompt = excluded.cover_prompt,
      image_prompts = excluded.image_prompts,
      tags = excluded.tags,
      error = excluded.error,
      payload = excluded.payload,
      updated_at = datetime('now', 'localtime')
  `);

  stmt.run(
    saveKey,
    work.title || '',
    work.body_text || '',
    JSON.stringify(work.hashtags || []),
    work.category || '',
    JSON.stringify(work.pages || []),
    work.cover_url || '',
    JSON.stringify(work.image_urls || []),
    work.image_count || 0,
    work._inputText || '',
    work.visual_system || '',
    work.cover_prompt || '',
    JSON.stringify(work.image_prompts || []),
    JSON.stringify(work.tags || []),
    work.error || '',
    JSON.stringify(work)
  );
  return saveKey;
}

/** 删除作品 */
export function softDeleteWork(saveKey) {
  if (!db) initDB();
  db.prepare("UPDATE works SET deleted_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE _saveKey = ?").run(saveKey);
}

export function restoreWork(saveKey) {
  if (!db) initDB();
  db.prepare("UPDATE works SET deleted_at = '', updated_at = datetime('now', 'localtime') WHERE _saveKey = ?").run(saveKey);
}

/** 获取作品总数 */
export function getWorkCount() {
  if (!db) initDB();
  const row = db.prepare("SELECT COUNT(*) as count FROM works WHERE COALESCE(deleted_at, '') = ''").get();
  return row?.count || 0;
}

/** 从 JSON 文件导入所有作品 */
export function importFromJSON(worksArray) {
  if (!db) initDB();
  if (!Array.isArray(worksArray) || worksArray.length === 0) return 0;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO works (_saveKey, title, body_text, hashtags, category, pages,
      cover_url, image_urls, image_count, _inputText, visual_system,
      cover_prompt, image_prompts, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction((items) => {
    let count = 0;
    for (const w of items) {
      if (w._saveKey) {
        insert.run(
          w._saveKey, w.title || '', w.body_text || '',
          JSON.stringify(w.hashtags || []), w.category || '',
          JSON.stringify(w.pages || []), w.cover_url || '',
          JSON.stringify(w.image_urls || []), w.image_count || 0,
          w._inputText || '', w.visual_system || '',
          w.cover_prompt || '', JSON.stringify(w.image_prompts || []),
          JSON.stringify(w.tags || []),
          w.at || w.created_at || new Date().toISOString(),
          w.at || w.updated_at || new Date().toISOString()
        );
        count++;
      }
    }
    return count;
  });
  return tx(worksArray);
}

// =========== 异步任务队列 ===========

/** 创建任务 */
export function createTask(id, text, ownerEmail = '') {
  if (!db) initDB();
  db.prepare('INSERT INTO tasks (id, text, owner_email, status) VALUES (?, ?, ?, ?)').run(id, text, ownerEmail, 'pending');
}

/** 更新任务进度 */
export function updateTaskProgress(id, progress) {
  if (!db) initDB();
  db.prepare("UPDATE tasks SET progress = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(JSON.stringify(progress), id);
}

/** 完成任务（保存结果） */
export function completeTask(id, result) {
  if (!db) initDB();
  db.prepare("UPDATE tasks SET status = 'done', result = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(JSON.stringify(result), id);
}

/** 标记任务失败 */
export function failTask(id, error) {
  if (!db) initDB();
  db.prepare("UPDATE tasks SET status = 'failed', error = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(error, id);
}

/** 标记任务开始处理 */
export function startTask(id) {
  if (!db) initDB();
  db.prepare("UPDATE tasks SET status = 'processing', updated_at = datetime('now', 'localtime') WHERE id = ? AND status = 'pending'").run(id);
}

/** 查询任务状态 */
export function getTask(id) {
  if (!db) initDB();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    text: row.text,
    owner_email: row.owner_email || '',
    progress: safeParseJSON(row.progress, {}),
    result: safeParseJSON(row.result, null),
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** 获取一个 pending 任务并标记为 processing（原子操作，适合 worker 抢占） */
export function claimPendingTask() {
  if (!db) initDB();
  const tx = db.transaction(() => {
    const row = db.prepare("SELECT id FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get();
    if (!row) return null;
    db.prepare("UPDATE tasks SET status = 'processing', updated_at = datetime('now', 'localtime') WHERE id = ? AND status = 'pending'").run(row.id);
    return row.id;
  });
  return tx();
}

/** 获取正在处理中的任务数 */
export function getProcessingTaskCount() {
  if (!db) initDB();
  const row = db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('pending','processing')").get();
  return row?.c || 0;
}

/** 清理7天前的已完成/失败任务 */
export function cleanOldTasks() {
  if (!db) initDB();
  db.prepare("DELETE FROM tasks WHERE created_at < datetime('now', '-7 days') AND status IN ('done','failed')").run();
}

/** 关闭数据库 */
export function closeDB() {
  if (db) { try { db.close(); } catch(e) {} }
  db = undefined;
  activeDbPath = undefined;
}

// =========== 用户额度（与作品、任务共用同一 SQLite 数据源）===========

export function getUserCredits(email) {
  if (!db) initDB();
  return db.prepare('SELECT credits FROM users WHERE email = ?').get(email)?.credits || 0;
}

export function getAllUsers() {
  if (!db) initDB();
  return Object.fromEntries(db.prepare('SELECT email, credits FROM users').all().map(row => [row.email, row.credits]));
}

export function addUserCredits(email, amount) {
  if (!db) initDB();
  db.prepare(`
    INSERT INTO users (email, credits) VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET credits = users.credits + excluded.credits,
      updated_at = datetime('now', 'localtime')
  `).run(email, amount);
}

/** 原子扣减额度，返回扣减后余额；余额不足返回 null。 */
export function consumeUserCredit(email, amount = 1) {
  if (!db) initDB();
  const result = db.prepare(`
    UPDATE users SET credits = credits - ?, updated_at = datetime('now', 'localtime')
    WHERE email = ? AND credits >= ?
  `).run(amount, email, amount);
  if (!result.changes) return null;
  return getUserCredits(email);
}

// =========== 辅助 ===========

function rowToWork(row) {
  const payload = safeParseJSON(row.payload, {});
  return {
    _saveKey: row._saveKey,
    title: row.title,
    body_text: row.body_text,
    hashtags: safeParseJSON(row.hashtags, []),
    category: row.category,
    pages: safeParseJSON(row.pages, []),
    cover_url: row.cover_url,
    image_urls: safeParseJSON(row.image_urls, []),
    image_count: row.image_count,
    _inputText: row._inputText,
    visual_system: row.visual_system,
    cover_prompt: row.cover_prompt,
    image_prompts: safeParseJSON(row.image_prompts, []),
    tags: safeParseJSON(row.tags, []),
    error: row.error,
    at: row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...payload,
    _saveKey: row._saveKey,
    at: row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(row.deleted_at ? { deleted_at: row.deleted_at, _deleted: true } : {}),
  };
}

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch(e) { return fallback; }
}

export default {
  initDB, getAllWorks, getDeletedWorks, getWorkBySaveKey, upsertWork, softDeleteWork, restoreWork, getWorkCount,
  importFromJSON, closeDB, getUserCredits, getAllUsers, addUserCredits, consumeUserCredit,
};
