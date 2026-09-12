/**
 * 作品(works)保留策略 + 白名单（2026-09-12 用户批注：作品只保留 7 天，超期清理，降低服务器存储压力；
 * 后台可把指定账号加入白名单，白名单账号的作品**永不清理**）。
 *
 * 安全原则：
 *  - 只删 works 行与其关联的生成资产文件引用，不动计费/账本数据；
 *  - 支持 dryRun（只统计不删除），后台先看再删；
 *  - 白名单账号免疫；
 *  - 默认保留天数 7，可用 env ASSET_RETENTION_DAYS 覆盖。
 */
const DEFAULT_RETENTION_DAYS = 7;

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeOwnerEmail(value) {
  return clean(value, 320).toLowerCase();
}

export function createWorksRetentionService({ db, now = () => Date.now(), logger = console } = {}) {
  if (!db) throw new TypeError('retention service requires a database');
  db.exec(`CREATE TABLE IF NOT EXISTS retention_whitelist (
    owner_email TEXT PRIMARY KEY,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )`);

  const listStatement = db.prepare('SELECT owner_email, note, created_at FROM retention_whitelist ORDER BY created_at DESC');
  const insertStatement = db.prepare('INSERT INTO retention_whitelist (owner_email, note) VALUES (?, ?) ON CONFLICT(owner_email) DO UPDATE SET note = excluded.note');
  const deleteStatement = db.prepare('DELETE FROM retention_whitelist WHERE owner_email = ?');

  function listWhitelist() {
    return listStatement.all().map(row => ({
      ownerEmail: row.owner_email,
      note: row.note || '',
      createdAt: row.created_at,
    }));
  }

  function addWhitelist(ownerEmail, note = '') {
    const email = normalizeOwnerEmail(ownerEmail);
    if (!email || !email.includes('@')) throw Object.assign(new Error('请输入有效的账号邮箱'), { status: 400, code: 'INVALID_OWNER_EMAIL' });
    insertStatement.run(email, clean(note, 200));
    logger.info?.('[retention] whitelist added', email);
    return { ownerEmail: email, note: clean(note, 200) };
  }

  function removeWhitelist(ownerEmail) {
    const email = normalizeOwnerEmail(ownerEmail);
    const info = deleteStatement.run(email);
    return { ownerEmail: email, removed: info.changes > 0 };
  }

  function whitelistedEmails() {
    return new Set(listStatement.all().map(row => normalizeOwnerEmail(row.owner_email)));
  }

  function isWhitelisted(ownerEmail) {
    return whitelistedEmails().has(normalizeOwnerEmail(ownerEmail));
  }

  /**
   * 清理超期作品：created_at 早于 cutoff 且 owner 不在白名单。
   * dryRun=true 时只统计，不写库。
   */
  function pruneExpiredWorks({ retentionDays = DEFAULT_RETENTION_DAYS, dryRun = false } = {}) {
    const days = Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0 ? Math.floor(Number(retentionDays)) : DEFAULT_RETENTION_DAYS;
    const cutoffMs = now() - days * 24 * 60 * 60 * 1000;
    const cutoff = new Date(cutoffMs).toISOString().replace('T', ' ').slice(0, 19);
    const white = whitelistedEmails();
    const rows = db.prepare('SELECT id, owner_email, created_at FROM works WHERE COALESCE(deleted_at, \'\') = \'\' AND created_at < ?').all(cutoff);
    const expired = rows.filter(row => !white.has(normalizeOwnerEmail(row.owner_email)));
    const summary = {
      retentionDays: days,
      cutoff,
      scanned: rows.length,
      expired: expired.length,
      skippedWhitelisted: rows.length - expired.length,
      dryRun: dryRun === true,
      owners: [...new Set(expired.map(row => normalizeOwnerEmail(row.owner_email)))].slice(0, 20),
    };
    if (dryRun === true || !expired.length) return summary;
    const remove = db.prepare('DELETE FROM works WHERE id = ?');
    const tx = db.transaction(items => { for (const item of items) remove.run(item.id); });
    tx(expired);
    logger.info?.('[retention] pruned works', JSON.stringify({ deleted: expired.length, cutoff }));
    return { ...summary, deleted: expired.length };
  }

  return {
    listWhitelist,
    addWhitelist,
    removeWhitelist,
    isWhitelisted,
    pruneExpiredWorks,
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

export const RETENTION_DEFAULT_DAYS = DEFAULT_RETENTION_DAYS;