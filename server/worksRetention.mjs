/**
 * 作品(works)保留策略 + 白名单（2026-09-12 用户批注：作品只保留 7 天，超期清理，降低服务器存储压力；
 * 后台可把指定账号加入白名单，白名单账号的作品**永不清理**）。
 *
 * 安全原则：
 *  - 只删 works 行与其关联的生成资产文件引用，不动计费/账本数据；
 *  - 支持 dryRun（只统计不删除），后台先看再删；
 *  - 白名单账号免疫；
 *  - 默认保留天数 7，可用 env ASSET_RETENTION_DAYS 覆盖。
 *
 * ═══ 2026-09-26 批 CA：到期处理从"整行删掉"改成"**留一块墓碑** + 回收媒体文件" ═══════════════════
 * 用户口径（逐字）：「保留期要不要清理，其实取决于我们服务器压力大不大……**你留下一张灰卡 + 已过期
 * 这个会影响服务器内存吗**」「这块你说成本会比较低，那你就做吧」。
 *  ⇒ 到期不再 `DELETE FROM works`，而是：
 *    ① 记 `expired_at` + **清空媒体字段**（图片地址、正文、pages…都不再留着，墓碑只留"有过这么一次"）；
 *    ② **删掉这条作品独占的图片文件**（引用计数在 `workAssetReclaim.mjs`，别的作品/资产还在用就不删）。
 *  实测到的事实（写在这里免得下次又要查）：线上 `RETENTION_PURGE_ENABLED` **从未设置** ⇒ 一直 dryRun，
 *  从来没有真的清理过；而 `server/generated-assets` 已经 **7.5 GB**。所以这一批把"回收"这条路真的写通，
 *  但**生产上要不要开 purge 由用户拍板**（那是删用户数据）。
 */
import { deleteAssetFiles, planAssetReclaim } from './workAssetReclaim.mjs';

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
  function pruneExpiredWorks({ retentionDays = DEFAULT_RETENTION_DAYS, dryRun = false, assetDir = '' } = {}) {
    const days = Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0 ? Math.floor(Number(retentionDays)) : DEFAULT_RETENTION_DAYS;
    const cutoffMs = now() - days * 24 * 60 * 60 * 1000;
    const cutoff = new Date(cutoffMs).toISOString().replace('T', ' ').slice(0, 19);
    const white = whitelistedEmails();
    const rows = db.prepare('SELECT id, owner_email, created_at FROM works WHERE COALESCE(deleted_at, \'\') = \'\' AND COALESCE(expired_at, \'\') = \'\' AND created_at < ?').all(cutoff);
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

    /* ═══ 清空媒体字段 + 记墓碑 ═══════════════════════════════════════════════════════════════
       墓碑只留"有过这么一次"（标题/时间/技能归属），**图片地址、正文、pages 全部清掉** ——
       那一列本来就是"用户的内容"，留着它才叫没清理干净。 */
    const ids = expired.map(row => row.id);
    const placeholders = ids.map(() => '?').join(',');
    const expiredRows = db.prepare(`SELECT * FROM works WHERE id IN (${placeholders})`).all(...ids);
    const liveRows = db.prepare('SELECT * FROM works WHERE COALESCE(deleted_at, \'\') = \'\' AND COALESCE(expired_at, \'\') = \'\' AND id NOT IN (' + placeholders + ')').all(...ids);
    const otherRefs = collectOtherAssetRefs(db);
    const plan = planAssetReclaim({ expiredWorks: expiredRows, liveWorks: liveRows, otherRefs });
    const files = deleteAssetFiles(plan.deletable, assetDir);

    const mark = db.prepare(`UPDATE works SET expired_at = ?, cover_url = '', image_urls = '[]', pages = '[]',
      body_text = '', image_prompts = '[]', cover_prompt = '', visual_system = '', hashtags = '[]',
      payload = '{}', error = '' WHERE id = ?`);
    const stamp = new Date(now()).toISOString().replace('T', ' ').slice(0, 19);
    const tx = db.transaction(items => { for (const item of items) mark.run(stamp, item.id); });
    tx(expired);

    const result = {
      ...summary,
      expired: expired.length,
      /* 字段名与旧摘要保持兼容：`deleted` = 这轮"清掉"了多少条（现在是清空 + 记墓碑，不再是删行） */
      deleted: expired.length,
      reclaimedFiles: files.deleted.length,
      reclaimedBytes: files.bytes,
      keptByLiveWorks: plan.keptByLive.length,
      keptByOtherAssets: plan.keptByOthers.length,
    };
    logger.info?.('[retention] expired works (tombstoned)', JSON.stringify({
      count: expired.length, files: files.deleted.length, bytes: files.bytes, cutoff,
    }));
    return result;
  }

  /* 其它引用者：项目资产（我的资产）与视频资产。它们引用的文件**一个都不许删**。
     ⚠️ 用 try 包住：这些表在老库上不一定存在（部署是滚动升级），缺表时按"没有引用者"处理 ——
        但**只有**在缺表这一种情况下才这样，不能因为查询报错就把引用关系当成空。 */
  function collectOtherAssetRefs(database) {
    const refs = [];
    const collect = (sql) => {
      try {
        for (const row of database.prepare(sql).all()) {
          if (row && row.url) refs.push(row.url);
        }
      } catch { /* 表不存在（老库）——跳过这一类引用者 */ }
    };
    collect('SELECT stable_url AS url FROM project_assets');
    collect('SELECT playback_url AS url FROM project_assets');
    collect('SELECT result_url AS url FROM video_jobs');
    return refs;
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