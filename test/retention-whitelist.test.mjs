// test/retention-whitelist.test.mjs
// 2026-09-12 用户批注：作品只保留 7 天（超期清理，降低存储压力）；后台可加白名单，白名单账号永久保留。
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createWorksRetentionService, RETENTION_DEFAULT_DAYS } from '../server/worksRetention.mjs';

function harness({ now = Date.now() } = {}) {
  const db = new Database(':memory:');
  /* ⚠️ 2026-09-27 批 CA：这张临时表要跟**真表的列**对齐 —— 到期墓碑会清空媒体字段并写 `expired_at`，
     少一列这里的 UPDATE 就会抛（本批实测：三条断言因为缺列一起红）。 */
  db.exec(`CREATE TABLE works (
    id TEXT PRIMARY KEY, owner_email TEXT, title TEXT, deleted_at TEXT, created_at TEXT,
    expired_at TEXT DEFAULT '', cover_url TEXT DEFAULT '', image_urls TEXT DEFAULT '[]',
    pages TEXT DEFAULT '[]', body_text TEXT DEFAULT '', image_prompts TEXT DEFAULT '[]',
    cover_prompt TEXT DEFAULT '', visual_system TEXT DEFAULT '', hashtags TEXT DEFAULT '[]',
    payload TEXT DEFAULT '{}', error TEXT DEFAULT ''
  )`);
  const service = createWorksRetentionService({ db, now: () => now, logger: { info() {} } });
  return { db, service };
}

function insertWork(db, id, ownerEmail, daysAgo, now = Date.now()) {
  const created = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare(`INSERT INTO works (id, owner_email, title, deleted_at, created_at, cover_url, image_urls)
    VALUES (?, ?, ?, '', ?, ?, ?)`)
    .run(id, ownerEmail, id, created, '/api/generated-assets/' + 'a'.repeat(64) + '.png', JSON.stringify(['/api/generated-assets/' + 'a'.repeat(64) + '.png']));
}

test('默认保留 7 天', () => {
  const { service } = harness();
  assert.equal(service.retentionDays, RETENTION_DEFAULT_DAYS);
  assert.equal(service.retentionDays, 7);
});

test('白名单可增删查，邮箱统一小写', () => {
  const { service } = harness();
  service.addWhitelist('867550189@QQ.com', '我们自己的账号');
  assert.equal(service.isWhitelisted('867550189@qq.com'), true);
  assert.equal(service.listWhitelist()[0].ownerEmail, '867550189@qq.com');
  assert.equal(service.removeWhitelist('867550189@qq.com').removed, true);
  assert.equal(service.isWhitelisted('867550189@qq.com'), false);
  assert.throws(() => service.addWhitelist('not-an-email'), /邮箱|email/i);
});

test('dryRun 只统计不删除', () => {
  const { db, service } = harness();
  insertWork(db, 'old', 'a@example.com', 10);
  const summary = service.pruneExpiredWorks({ dryRun: true });
  assert.equal(summary.expired, 1);
  assert.equal(summary.deleted, undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM works').get().n, 1, 'dryRun 不得删除');
});

test('超期作品被清理：留**墓碑**（不复存在地删行），未超期与被白名单的保留', () => {
  /* ⚠️ 2026-09-27 批 CA：**口径变更**（用户拍板）—— 到期不再把整行删掉（那样用户以为东西凭空消失），
     改成"清空媒体字段 + 记 expired_at"留一块灰卡，媒体文件由 workAssetReclaim 回收。
     ⇒ 断言从"行没了"改成"行还在、但内容清空了、并且标记了过期时间"。 */
  const { db, service } = harness();
  insertWork(db, 'expired', 'a@example.com', 10);
  insertWork(db, 'fresh', 'a@example.com', 2);
  insertWork(db, 'vip-expired', '867550189@qq.com', 30);
  service.addWhitelist('867550189@qq.com');
  const summary = service.pruneExpiredWorks();
  assert.equal(summary.expired, 1, '只有非白名单的超期作品算过期');
  assert.equal(summary.skippedWhitelisted, 1);
  assert.equal(summary.deleted, 1, '摘要仍然报"这一轮清掉了几条"（字段名保持不变）');
  const rows = db.prepare('SELECT id, title, cover_url, image_urls, expired_at FROM works ORDER BY id').all();
  const byId = Object.fromEntries(rows.map(row => [row.id, row]));
  assert.deepEqual(rows.map(row => row.id), ['expired', 'fresh', 'vip-expired'], '三条都还在（到期的那条留成墓碑）');
  assert.ok(byId.expired.expired_at, '到期的那条要写 expired_at');
  assert.equal(byId.expired.cover_url, '', '墓碑不含媒体地址');
  assert.equal(byId.expired.image_urls, '[]', '墓碑不含图片清单');
  assert.equal(byId.fresh.expired_at, '', '没超期的一条不许被动');
  assert.equal(byId['vip-expired'].expired_at, '', '白名单永远不清理');
  assert.ok(byId.fresh.cover_url, '没超期的作品图片地址留着');
  /* 再跑一遍：已经立了墓碑的不该被反复处理（否则每轮都要重扫一遍） */
  assert.equal(service.pruneExpiredWorks().expired, 0);
});

test('保留天数可覆盖', () => {
  const { db, service } = harness();
  insertWork(db, 'd3', 'a@example.com', 3);
  assert.equal(service.pruneExpiredWorks({ retentionDays: 7, dryRun: true }).expired, 0);
  assert.equal(service.pruneExpiredWorks({ retentionDays: 1, dryRun: true }).expired, 1);
});
