// test/xhs-legacy-protection.test.mjs
// 2026-08-26 周一切片 · §6 #8 XHS studio 60→50 套 60 天老客保护
// -----------------------------------------------------------------------------
// 验证：catalog xhs_studio_199 grantUnits 60→50；
// legacy_user_snapshot 表幂等创建；planXhsStudioLegacySnapshot 按 owner_email
// 扫描写入（UNIQUE 防重）；resolveXhsStudioGrantUnits 保护期内 60、保护期外 50；
// isXhsLegacyProtectionActive 60 天窗口判定；xhsLegacyProtectionMessage 中文文案。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import Database from 'better-sqlite3';
import { PRODUCTS } from '../server/billing/catalog.mjs';
import {
  XHS_LEGACY,
  ensureXhsLegacySchema,
  isXhsLegacyProtectionActive,
  planXhsStudioLegacySnapshot,
  resolveXhsStudioGrantUnits,
  xhsLegacyProtectionMessage,
} from '../server/billing/xhsLegacyProtection.mjs';

function makeDb({ withPurchases = true } = {}) {
  const db = new Database(':memory:');
  if (withPurchases) {
    db.exec(`
      CREATE TABLE xhs_purchases (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        sku TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return db;
}

test('catalog: xhs_studio_199 grantUnits shrunk from 60 to 50 (-20% effective price uplift)', () => {
  const entry = PRODUCTS.xhs_studio_199;
  assert.equal(entry.sku, 'xhs_studio_199');
  assert.equal(entry.priceFen, 19900);
  assert.equal(entry.grantUnits, 50);
  assert.equal(entry.currency, 'content_sets');
  // 其他 XHS 阶梯不动
  assert.equal(PRODUCTS.xhs_entry_19.grantUnits, 3);
  assert.equal(PRODUCTS.xhs_growth_49.grantUnits, 10);
  assert.equal(PRODUCTS.xhs_creator_99.grantUnits, 25);
});

test('XHS_LEGACY metadata records 60-day window and 60→50 delta', () => {
  assert.equal(XHS_LEGACY.flag, 'xhs_studio_60_to_50_2026_08_26');
  assert.equal(XHS_LEGACY.affectedSku, 'xhs_studio_199');
  assert.equal(XHS_LEGACY.oldGrantUnits, 60);
  assert.equal(XHS_LEGACY.newGrantUnits, 50);
  assert.equal(XHS_LEGACY.protectionWindowDays, 60);
  assert.equal(XHS_LEGACY.priceDeltaUnits, 10);
});

test('ensureXhsLegacySchema creates legacy_user_snapshot idempotently', () => {
  const db = makeDb();
  ensureXhsLegacySchema(db);
  ensureXhsLegacySchema(db); // 二次幂等
  const cols = db.prepare("PRAGMA table_info('legacy_user_snapshot')").all().map(c => c.name);
  for (const expected of ['owner_email', 'sku', 'protected_grant_units',
    'new_grant_units', 'protection_window_days', 'window_expires_at']) {
    assert.ok(cols.includes(expected), `column ${expected} present`);
  }
  db.close();
});

test('isXhsLegacyProtectionActive respects 60-day window', () => {
  const now = Date.parse('2026-08-26T12:00:00Z');
  // window_expires_at 是「未来 60 天到期的时间戳」
  const future30 = '2026-09-25T12:00:00Z';          // 30 天后到期
  const future59 = '2026-10-24T11:59:00Z';          // ~59 天后到期，仍有效
  const future1m = '2026-08-27T12:00:00Z';          // 1 小时后到期
  const past = '2026-08-26T11:59:00Z';              // 已过期
  assert.equal(isXhsLegacyProtectionActive({ window_expires_at: future30 }, { now }), true);
  assert.equal(isXhsLegacyProtectionActive({ window_expires_at: future59 }, { now }), true);
  assert.equal(isXhsLegacyProtectionActive({ window_expires_at: future1m }, { now }), true);
  assert.equal(isXhsLegacyProtectionActive({ window_expires_at: past }, { now }), false);
  assert.equal(isXhsLegacyProtectionActive(null, { now }), false);
  assert.equal(isXhsLegacyProtectionActive({}, { now }), false);
  assert.equal(isXhsLegacyProtectionActive({ window_expires_at: 'not-a-date' }, { now }), false);
});

test('planXhsStudioLegacySnapshot scans owners from xhs_purchases and inserts 60-day window', () => {
  const db = makeDb();
  const now = Date.parse('2026-08-26T12:00:00Z');
  const oldPurchase = '2026-08-20T08:00:00.000Z';
  const newPurchase = '2026-08-25T03:00:00.000Z';
  db.prepare("INSERT INTO xhs_purchases (id, owner_email, sku, created_at) VALUES (?, ?, ?, ?)")
    .run('p1', 'a@x.com', 'xhs_studio_199', oldPurchase);
  db.prepare("INSERT INTO xhs_purchases (id, owner_email, sku, created_at) VALUES (?, ?, ?, ?)")
    .run('p2', 'b@x.com', 'xhs_studio_199', newPurchase);
  // 干扰行：不同 sku 不应进入快照
  db.prepare("INSERT INTO xhs_purchases (id, owner_email, sku, created_at) VALUES (?, ?, ?, ?)")
    .run('p3', 'c@x.com', 'xhs_creator_99', newPurchase);

  const result = planXhsStudioLegacySnapshot(db, { now });
  assert.equal(result.scanned, 2);
  assert.equal(result.inserted, 2);
  assert.equal(result.skipped, 0);
  assert.equal(result.source, 'xhs_purchases');
  assert.equal(result.windowDays, 60);

  const rows = db.prepare("SELECT owner_email, protected_grant_units, new_grant_units FROM legacy_user_snapshot ORDER BY owner_email").all();
  assert.deepEqual(rows.map(r => r.owner_email), ['a@x.com', 'b@x.com']);
  assert.equal(rows[0].protected_grant_units, 60);
  assert.equal(rows[0].new_grant_units, 50);

  // 二次调用幂等
  const result2 = planXhsStudioLegacySnapshot(db, { now });
  assert.equal(result2.scanned, 2);
  assert.equal(result2.inserted, 0);
  assert.equal(result2.skipped, 2);
  db.close();
});

test('planXhsStudioLegacySnapshot falls back to wallet_ledger when xhs_purchases missing', () => {
  const db = makeDb({ withPurchases: false });
  db.exec(`
    CREATE TABLE wallet_ledger (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      sku TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const now = Date.parse('2026-08-26T12:00:00Z');
  db.prepare("INSERT INTO wallet_ledger (id, owner_email, sku, event_type, created_at) VALUES (?, ?, ?, ?, ?)")
    .run('l1', 'd@x.com', 'xhs_studio_199', 'grant', '2026-08-22T10:00:00Z');
  db.prepare("INSERT INTO wallet_ledger (id, owner_email, sku, event_type, created_at) VALUES (?, ?, ?, ?, ?)")
    .run('l2', 'e@x.com', 'xhs_creator_99', 'grant', '2026-08-22T10:00:00Z');

  const result = planXhsStudioLegacySnapshot(db, { now });
  assert.equal(result.source, 'wallet_ledger');
  assert.equal(result.scanned, 1);
  assert.equal(result.inserted, 1);
  const row = db.prepare("SELECT owner_email, protected_grant_units FROM legacy_user_snapshot").get();
  assert.equal(row.owner_email, 'd@x.com');
  assert.equal(row.protected_grant_units, 60);
  db.close();
});

test('resolveXhsStudioGrantUnits returns 50 for owners without snapshot', () => {
  const db = makeDb();
  const now = Date.parse('2026-08-26T12:00:00Z');
  const r = resolveXhsStudioGrantUnits(db, { ownerEmail: 'new@x.com', now });
  assert.equal(r.grantUnits, 50);
  assert.equal(r.protected, false);
  assert.equal(r.sku, 'xhs_studio_199');
  assert.equal(r.transitionFlag, XHS_LEGACY.flag);
  db.close();
});

test('resolveXhsStudioGrantUnits returns 60 within protection window and 50 after expiry', () => {
  const db = makeDb();
  const purchaseAt = Date.parse('2026-08-01T00:00:00Z');
  db.prepare("INSERT INTO xhs_purchases (id, owner_email, sku, created_at) VALUES (?, ?, ?, ?)")
    .run('px', 'f@x.com', 'xhs_studio_199', new Date(purchaseAt).toISOString().replace('T', ' ').slice(0, 19));
  planXhsStudioLegacySnapshot(db, { now: purchaseAt });

  // 30 天后 → 仍在 60 天保护期内
  const r30 = resolveXhsStudioGrantUnits(db, { ownerEmail: 'f@x.com', now: purchaseAt + 30 * 86400 * 1000 });
  assert.equal(r30.grantUnits, 60);
  assert.equal(r30.protected, true);

  // 61 天后 → 保护期已过
  const r61 = resolveXhsStudioGrantUnits(db, { ownerEmail: 'f@x.com', now: purchaseAt + 61 * 86400 * 1000 });
  assert.equal(r61.grantUnits, 50);
  assert.equal(r61.protected, false);
  db.close();
});

test('resolveXhsStudioGrantUnits rejects empty ownerEmail', () => {
  const db = makeDb();
  assert.throws(
    () => resolveXhsStudioGrantUnits(db, { ownerEmail: '' }),
    /ownerEmail is required/,
  );
  assert.throws(
    () => resolveXhsStudioGrantUnits(db, { ownerEmail: '  ' }),
    /ownerEmail is required/,
  );
  db.close();
});

test('xhsLegacyProtectionMessage returns Chinese copy for old/new buyers', () => {
  assert.equal(
    xhsLegacyProtectionMessage({ grantUnits: 60, protected: true }),
    '老客 60 天保护期内按 60 套结算',
  );
  assert.equal(
    xhsLegacyProtectionMessage({ grantUnits: 50, protected: false }),
    '新客按 50 套结算',
  );
  assert.equal(xhsLegacyProtectionMessage({ grantUnits: 30, protected: false }), null);
  assert.equal(xhsLegacyProtectionMessage({ grantUnits: 60, protected: false }), null);
});
