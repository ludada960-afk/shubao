// test/nano-price-transition.test.mjs
// 2026-08-26 周一切片 · §6 #3 nano 2K 修复 1→1.5 积分 + 7 天过渡
// -----------------------------------------------------------------------------
// 验证：catalog ec_nano_flash_2k / ec_nano_pro_2k units 升至 1500；
// legacy_orders 表幂等创建；planLegacyNano2kTransition 写入 price_snapshot
// 并 stamp usage_events.metadata.legacyPriceFen；isLegacyTransitionActive
// 判定 7 天窗口；nanoPriceTransitionMessage 输出友好文案。
// -----------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

import Database from 'better-sqlite3';
import { FEATURE_SKUS } from '../server/billing/catalog.mjs';
import {
  NANO_TRANSITION,
  ensureLegacyOrderSnapshotTable,
  isLegacyTransitionActive,
  nanoPriceTransitionMessage,
  planLegacyNano2kTransition,
} from '../server/billing/nanoPriceTransition.mjs';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE usage_events (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, sku TEXT NOT NULL,
      charged_units INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT NOT NULL DEFAULT '{}'
    );
  `);
  return db;
}

function seedEvent(db, { id, sku, units, createdAt, owner = 'u@x' }) {
  db.prepare(`INSERT INTO usage_events (id, owner_email, sku, charged_units, created_at)
    VALUES (?, ?, ?, ?, ?)`).run(id, owner, sku, units, createdAt);
}

test('catalog: ec_nano_flash_2k and ec_nano_pro_2k now deduct 1500 units (1.5 积分)', () => {
  assert.equal(FEATURE_SKUS.ec_nano_flash_2k.units, 1500);
  assert.equal(FEATURE_SKUS.ec_nano_pro_2k.units, 1500);
  assert.equal(FEATURE_SKUS.ec_nano_flash_2k.providerCostCny, 0.06);
});

test('catalog: 1K/4K nano SKUs unchanged (1.0 / 2.0 积分 anchor preserved)', () => {
  assert.equal(FEATURE_SKUS.ec_nano_flash_1k.units, 1000);
  assert.equal(FEATURE_SKUS.ec_nano_flash_4k.units, 2000);
  assert.equal(FEATURE_SKUS.ec_nano_pro_1k.units, 1000);
  assert.equal(FEATURE_SKUS.ec_nano_pro_4k.units, 2000);
});

test('transition metadata records old/new price diff and 7-day window', () => {
  assert.equal(NANO_TRANSITION.flag, 'nano_2k_2026_08_26');
  assert.equal(NANO_TRANSITION.oldUnits, 1000);
  assert.equal(NANO_TRANSITION.newUnits, 1500);
  assert.equal(NANO_TRANSITION.transitionWindowDays, 7);
  assert.equal(NANO_TRANSITION.priceDiffFen, 131);
  assert.equal(NANO_TRANSITION.newPriceFen, 393);
  assert.deepEqual([...NANO_TRANSITION.affectedSkus], ['ec_nano_flash_2k', 'ec_nano_pro_2k']);
});

test('ensureLegacyOrderSnapshotTable creates table idempotently with expected columns', () => {
  const db = new Database(':memory:');
  ensureLegacyOrderSnapshotTable(db);
  ensureLegacyOrderSnapshotTable(db); // 二次调用不抛
  const cols = db.prepare("PRAGMA table_info('legacy_orders')").all().map(c => c.name);
  for (const expected of ['source_event_id', 'owner_email', 'sku', 'units',
    'old_price_fen', 'new_price_fen', 'price_diff_fen',
    'transition_flag', 'window_expires_at']) {
    assert.ok(cols.includes(expected), `column ${expected} present`);
  }
  db.close();
});

test('isLegacyTransitionActive classifies events by 7-day window', () => {
  const now = Date.parse('2026-08-26T12:00:00Z');
  const recent = '2026-08-25T12:00:00Z';
  const old = '2026-08-15T12:00:00Z';
  assert.equal(isLegacyTransitionActive(recent, { now }), true);
  assert.equal(isLegacyTransitionActive(old, { now }), false);
  assert.equal(isLegacyTransitionActive('not-a-date', { now }), false);
  assert.equal(isLegacyTransitionActive('', { now }), false);
});

test('planLegacyNano2kTransition snapshots 7-day events and stamps metadata.legacyPriceFen', () => {
  const db = makeDb();
  const now = Date.parse('2026-08-26T12:00:00Z');
  seedEvent(db, {
    id: 'u-1', sku: 'ec_nano_flash_2k', units: 1000,
    createdAt: '2026-08-25 12:00:00',
  });
  seedEvent(db, {
    id: 'u-2', sku: 'ec_nano_pro_2k', units: 1000,
    createdAt: '2026-08-22 09:00:00',
  });
  seedEvent(db, {
    id: 'u-3', sku: 'ec_nano_flash_1k', units: 1000,
    createdAt: '2026-08-25 12:00:00',
  });
  seedEvent(db, {
    id: 'u-4', sku: 'ec_nano_flash_2k', units: 1000,
    createdAt: '2026-08-15 09:00:00', // 早于 7 天
  });
  const result = planLegacyNano2kTransition(db, { now, windowDays: 7 });
  assert.equal(result.scanned, 2);
  assert.equal(result.inserted, 2);
  assert.equal(result.windowDays, 7);
  const snapshotted = db.prepare('SELECT * FROM legacy_orders ORDER BY source_event_id').all();
  assert.equal(snapshotted.length, 2);
  for (const row of snapshotted) {
    assert.equal(row.transition_flag, NANO_TRANSITION.flag);
    assert.equal(row.old_price_fen, NANO_TRANSITION.oldPriceFen);
    assert.equal(row.new_price_fen, NANO_TRANSITION.newPriceFen);
    assert.equal(row.price_diff_fen, NANO_TRANSITION.priceDiffFen);
  }
  // metadata 已 stamp legacyPriceFen
  const stamped = db.prepare(`SELECT json_extract(metadata, '$.legacyPriceFen') AS lpf
    FROM usage_events WHERE id = 'u-1'`).get();
  assert.equal(stamped.lpf, NANO_TRANSITION.oldPriceFen);
  // 非 nano_2k SKU 不被扫到
  const untouched = db.prepare(`SELECT json_extract(metadata, '$.legacyPriceFen') AS lpf
    FROM usage_events WHERE id = 'u-3'`).get();
  assert.equal(untouched.lpf, null);
  // 早于 7 天的事件不被纳入
  const outOfWindow = db.prepare(`SELECT json_extract(metadata, '$.legacyPriceFen') AS lpf
    FROM usage_events WHERE id = 'u-4'`).get();
  assert.equal(outOfWindow.lpf, null);
  db.close();
});

test('planLegacyNano2kTransition is idempotent: re-running snapshots zero new rows', () => {
  const db = makeDb();
  const now = Date.parse('2026-08-26T12:00:00Z');
  seedEvent(db, {
    id: 'u-idem', sku: 'ec_nano_flash_2k', units: 1000,
    createdAt: '2026-08-25 12:00:00',
  });
  const r1 = planLegacyNano2kTransition(db, { now, windowDays: 7 });
  const r2 = planLegacyNano2kTransition(db, { now, windowDays: 7 });
  assert.equal(r1.inserted, 1);
  // 二次扫描时 metadata.legacyPriceFen 已被 stamp，SELECT 直接过滤掉候选，
  // 所以 scanned/inserted/skipped 都为 0；legacy_orders 总行数仍为 1（不重复）。
  assert.equal(r2.inserted, 0);
  assert.equal(r2.scanned, 0);
  const total = db.prepare('SELECT COUNT(*) AS n FROM legacy_orders').get().n;
  assert.equal(total, 1);
  db.close();
});

test('planLegacyNano2kTransition returns a clean summary when usage_events missing', () => {
  const db = new Database(':memory:');
  const result = planLegacyNano2kTransition(db);
  assert.equal(result.scanned, 0);
  assert.equal(result.inserted, 0);
  assert.equal(result.table, 'usage_events_missing');
  db.close();
});

test('nanoPriceTransitionMessage returns the standard copy for old/new units', () => {
  assert.equal(
    nanoPriceTransitionMessage({ units: 'ec_nano_flash_2k', currentUnits: 1000 }),
    '按 7 天过渡窗口内老价结算',
  );
  assert.equal(
    nanoPriceTransitionMessage({ units: 'ec_nano_flash_2k', currentUnits: 1500 }),
    '按新价 1.5 积分结算',
  );
  // 不在 affected 集合内返回 null（业务方按需选择不展示）
  assert.equal(nanoPriceTransitionMessage({ units: 'ec_image_2k', currentUnits: 1000 }), null);
  // 未知单位：返回 null 避免误显示
  assert.equal(nanoPriceTransitionMessage({ units: 'ec_nano_flash_2k', currentUnits: 9999 }), null);
});
