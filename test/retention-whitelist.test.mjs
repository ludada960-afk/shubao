// test/retention-whitelist.test.mjs
// 2026-09-12 用户批注：作品只保留 7 天（超期清理，降低存储压力）；后台可加白名单，白名单账号永久保留。
import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { createWorksRetentionService, RETENTION_DEFAULT_DAYS } from '../server/worksRetention.mjs';

function harness({ now = Date.now() } = {}) {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE works (id TEXT PRIMARY KEY, owner_email TEXT, title TEXT, deleted_at TEXT, created_at TEXT)");
  const service = createWorksRetentionService({ db, now: () => now, logger: { info() {} } });
  return { db, service };
}

function insertWork(db, id, ownerEmail, daysAgo, now = Date.now()) {
  const created = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  db.prepare('INSERT INTO works (id, owner_email, title, deleted_at, created_at) VALUES (?, ?, ?, \'\', ?)').run(id, ownerEmail, id, created);
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

test('超期作品被清理，未超期与被白名单的保留', () => {
  const { db, service } = harness();
  insertWork(db, 'expired', 'a@example.com', 10);
  insertWork(db, 'fresh', 'a@example.com', 2);
  insertWork(db, 'vip-expired', '867550189@qq.com', 30);
  service.addWhitelist('867550189@qq.com');
  const summary = service.pruneExpiredWorks();
  assert.equal(summary.expired, 1, '只有非白名单的超期作品算过期');
  assert.equal(summary.skippedWhitelisted, 1);
  assert.equal(summary.deleted, 1);
  const left = db.prepare('SELECT id FROM works ORDER BY id').all().map(row => row.id);
  assert.deepEqual(left, ['fresh', 'vip-expired']);
});

test('保留天数可覆盖', () => {
  const { db, service } = harness();
  insertWork(db, 'd3', 'a@example.com', 3);
  assert.equal(service.pruneExpiredWorks({ retentionDays: 7, dryRun: true }).expired, 0);
  assert.equal(service.pruneExpiredWorks({ retentionDays: 1, dryRun: true }).expired, 1);
});
