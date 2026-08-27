// test/fast-daily-limit.test.mjs
// 2026-08-26 周一切片 · §6 #6 Fast 每日限次 N=2 运行时开关
// -----------------------------------------------------------------------------
// 验证：env FAST_DAILY_LIMIT_PER_USER 覆盖默认 2；isFastSku 限定 fast_*；
// countFastUsageFor 按 UTC 日界聚合；checkFastDailyLimit 触顶返
// FAST_DAILY_LIMIT_EXCEEDED；fastLimitStatus 输出 byDay 7 天面板 + 触限用户。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import Database from 'better-sqlite3';
import {
  FAST_DAILY_LIMIT,
  FAST_DAILY_LIMIT_DEFAULT,
  checkFastDailyLimit,
  countFastUsageFor,
  fastLimitStatus,
  getFastDailyLimit,
  isFastSku,
} from '../server/billing/fastDailyLimit.mjs';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE usage_events (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, sku TEXT NOT NULL,
      charged_units INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function seedEvent(db, { id, owner, sku, createdAt }) {
  db.prepare('INSERT INTO usage_events (id, owner_email, sku, charged_units, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, owner, sku, 27000, createdAt);
}

test('getFastDailyLimit defaults to 2 and accepts env override', () => {
  assert.equal(getFastDailyLimit(), 2);
  assert.equal(getFastDailyLimit({ env: { FAST_DAILY_LIMIT_PER_USER: '3' } }), 3);
  assert.equal(getFastDailyLimit({ env: { FAST_DAILY_LIMIT_PER_USER: '0' } }), 0);
  // 非法 env 回落到默认值
  assert.equal(getFastDailyLimit({ env: { FAST_DAILY_LIMIT_PER_USER: 'abc' } }), FAST_DAILY_LIMIT_DEFAULT);
  assert.equal(getFastDailyLimit({ env: { FAST_DAILY_LIMIT_PER_USER: '99999' } }), FAST_DAILY_LIMIT_DEFAULT);
});

test('isFastSku admits only the two fast SKUs', () => {
  assert.equal(isFastSku('video_seedance_fast_short'), true);
  assert.equal(isFastSku('video_seedance_fast_long'), true);
  assert.equal(isFastSku('video_seedance_standard_short'), false);
  assert.equal(isFastSku('ec_image_2k'), false);
  assert.equal(isFastSku(undefined), false);
  assert.equal(isFastSku('video_seedance_fast_other'), false);
});

test('FAST_DAILY_LIMIT metadata pins the default and the envKey', () => {
  assert.equal(FAST_DAILY_LIMIT.defaultLimit, 2);
  assert.equal(FAST_DAILY_LIMIT.envKey, 'FAST_DAILY_LIMIT_PER_USER');
  assert.equal(FAST_DAILY_LIMIT.userMessage, '今日额度已用，明日再来');
  assert.deepEqual([...FAST_DAILY_LIMIT.skus], ['video_seedance_fast_short', 'video_seedance_fast_long']);
});

test('countFastUsageFor aggregates by UTC day for the same owner+sku', () => {
  const db = makeDb();
  const now = new Date('2026-08-26T08:00:00Z');
  // 当日两条
  seedEvent(db, { id: 'u-1', owner: 'a@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-26 00:30:00' });
  seedEvent(db, { id: 'u-2', owner: 'a@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-26 05:00:00' });
  // 前一天一条（不应计入）
  seedEvent(db, { id: 'u-3', owner: 'a@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-25 23:30:00' });
  // 当日其它 SKU 一条（不应计入）
  seedEvent(db, { id: 'u-4', owner: 'a@x', sku: 'video_seedance_standard_short', createdAt: '2026-08-26 06:00:00' });
  assert.equal(countFastUsageFor(db, { ownerEmail: 'a@x', sku: 'video_seedance_fast_short', now }), 2);
  // 其它 user 当日 1 条
  seedEvent(db, { id: 'u-5', owner: 'b@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-26 07:00:00' });
  assert.equal(countFastUsageFor(db, { ownerEmail: 'b@x', sku: 'video_seedance_fast_short', now }), 1);
  // 非 fast SKU 返回 0
  assert.equal(countFastUsageFor(db, { ownerEmail: 'a@x', sku: 'ec_image_2k', now }), 0);
  db.close();
});

test('checkFastDailyLimit allows below the limit and blocks at/over the limit', () => {
  const db = makeDb();
  const now = new Date('2026-08-26T08:00:00Z');
  // 第 1 次：放行
  const r1 = checkFastDailyLimit(db, { ownerEmail: 'a@x', sku: 'video_seedance_fast_short', now, limit: 2 });
  assert.equal(r1.ok, true);
  assert.equal(r1.used, 0);
  assert.equal(r1.limit, 2);
  // 落 1 条
  seedEvent(db, { id: 'u-1', owner: 'a@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-26 01:00:00' });
  const r2 = checkFastDailyLimit(db, { ownerEmail: 'a@x', sku: 'video_seedance_fast_short', now, limit: 2 });
  assert.equal(r2.ok, true);
  assert.equal(r2.used, 1);
  // 落第 2 条（达到 limit）
  seedEvent(db, { id: 'u-2', owner: 'a@x', sku: 'video_seedance_fast_short', createdAt: '2026-08-26 02:00:00' });
  const r3 = checkFastDailyLimit(db, { ownerEmail: 'a@x', sku: 'video_seedance_fast_short', now, limit: 2 });
  assert.equal(r3.ok, false);
  assert.equal(r3.error.code, 'FAST_DAILY_LIMIT_EXCEEDED');
  assert.equal(r3.error.status, 409);
  assert.equal(r3.error.used, 2);
  assert.equal(r3.error.limit, 2);
  assert.equal(r3.error.message, '今日额度已用，明日再来');
  db.close();
});

test('checkFastDailyLimit always allows non-fast SKUs regardless of env', () => {
  const db = makeDb();
  const now = new Date('2026-08-26T08:00:00Z');
  for (let i = 0; i < 5; i += 1) {
    seedEvent(db, { id: 's-' + i, owner: 'a@x', sku: 'ec_image_2k', createdAt: '2026-08-26 0' + i + ':00:00' });
  }
  const result = checkFastDailyLimit(db, { ownerEmail: 'a@x', sku: 'ec_image_2k', now, limit: 0 });
  assert.equal(result.ok, true);
  db.close();
});

test('fastLimitStatus emits 7-day perDay + top users above the limit', () => {
  const db = makeDb();
  const now = new Date('2026-08-26T08:00:00Z');
  // 5 天前 - 触发限次用户 A
  for (let i = 0; i < 2; i += 1) {
    seedEvent(db, { id: 'past-' + i, owner: 'a@x', sku: 'video_seedance_fast_short',
      createdAt: '2026-08-21 0' + (i + 1) + ':00:00' });
  }
  // 昨天 - 普通用户 B
  seedEvent(db, { id: 'y-1', owner: 'b@x', sku: 'video_seedance_fast_short',
    createdAt: '2026-08-25 09:00:00' });
  // 今天 - 触发限次用户 A 再次
  seedEvent(db, { id: 't-1', owner: 'a@x', sku: 'video_seedance_fast_short',
    createdAt: '2026-08-26 03:00:00' });
  const status = fastLimitStatus(db, { now });
  assert.equal(status.enabled, true);
  assert.equal(status.dailyLimit, 2);
  assert.equal(status.perDay.length, 7);
  // 末位（最旧）必须是 5 天前
  assert.equal(status.perDay[0].day, '2026-08-21');
  assert.equal(status.perDay[0].totalActions, 2);
  // 倒数第二是昨天
  assert.equal(status.perDay[5].day, '2026-08-25');
  assert.equal(status.perDay[5].totalActions, 1);
  // 最后是今天
  assert.equal(status.perDay[6].day, '2026-08-26');
  assert.equal(status.perDay[6].totalActions, 1);
  // topUsers: A 7 天内调用 3 次 >= 2
  assert.equal(status.topUsers.length, 1);
  assert.equal(status.topUsers[0].owner, 'a@x');
  assert.equal(status.topUsers[0].calls, 3);
  db.close();
});

test('fastLimitStatus returns safe defaults when usage_events is missing', () => {
  const db = new Database(':memory:');
  const status = fastLimitStatus(db, { now: new Date('2026-08-26T08:00:00Z') });
  assert.equal(status.enabled, true);
  assert.equal(status.dailyLimit, 2);
  assert.equal(status.perDay.length, 7);
  assert.equal(status.topUsers.length, 0);
  db.close();
});

test('fastLimitStatus can scope by a single fast SKU', () => {
  const db = makeDb();
  const now = new Date('2026-08-26T08:00:00Z');
  seedEvent(db, { id: 's-1', owner: 'a@x', sku: 'video_seedance_fast_short',
    createdAt: '2026-08-26 01:00:00' });
  seedEvent(db, { id: 'l-1', owner: 'a@x', sku: 'video_seedance_fast_long',
    createdAt: '2026-08-26 02:00:00' });
  const status = fastLimitStatus(db, { sku: 'video_seedance_fast_long', now });
  assert.deepEqual(status.skus, ['video_seedance_fast_long']);
  const today = status.perDay[status.perDay.length - 1];
  assert.equal(today.totalActions, 1);
  assert.equal(today.bySku.length, 1);
  assert.equal(today.bySku[0].sku, 'video_seedance_fast_long');
  db.close();
});
