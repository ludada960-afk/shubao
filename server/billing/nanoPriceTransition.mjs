// server/billing/nanoPriceTransition.mjs
// 2026-08-26 周一切片 · §6 #3 nano 2K 修复 1→1.5 积分 7 天过渡
// -----------------------------------------------------------------------------
// 风险：唯一图片动价项，零售端 ¥0.262→¥0.393（+50%），可能引发小卖家不满；
// 但同价异常确实属隐性补贴。
// 默认建议：随本次一并执行，但对存量 7 天内已生成未结算任务做按老价结算过渡。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) planLegacyNano2kTransition(db) 在 initDB 阶段幂等执行：把 usage_events
//      中最近 7 天内的 ec_nano_flash_2k / ec_nano_pro_2k 价格快照写入
//      legacy_orders.price_snapshot 字段（若 usage_events 表存在）。
//   2) 价格快照读取 catalog 旧值 1000 units = 1 积分；新值 1500 units = 1.5 积分；
//      diff 字段保留「老价 / 新价 / 差额」便于 admin 看板展示。
//   3) freezeLegacyTransitionAt(transitions, { now }) 纯函数：判断某行是否仍在
//      7 天过渡窗口内，供下游结算时按老价退费。
//   4) 不改账本：仅补一张快照表 + 现有 usage_events.metadata.legacyPriceFen。
// -----------------------------------------------------------------------------
import { randomUUID } from 'node:crypto';

export const NANO_TRANSITION = Object.freeze({
  flag: 'nano_2k_2026_08_26',
  affectedSkus: Object.freeze(['ec_nano_flash_2k', 'ec_nano_pro_2k']),
  oldUnits: 1000,           // 1 积分
  newUnits: 1500,           // 1.5 积分
  transitionWindowDays: 7,
  // 旧 1 积分面值 = units * anchor (199/760000) ≈ ¥0.262；新 1.5 积分面值 ≈ ¥0.393。
  oldPriceFen: 262,
  newPriceFen: 393,
  priceDiffFen: 131,         // +50%
});

function tableExists(db, name) {
  if (!db || typeof db.prepare !== 'function') return false;
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));
}

function ensureLegacyOrderSnapshotTable(db) {
  if (!db || typeof db.exec !== 'function') {
    throw new TypeError('db is required');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_orders (
      id TEXT PRIMARY KEY,
      source_event_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      sku TEXT NOT NULL,
      units INTEGER NOT NULL,
      old_price_fen INTEGER NOT NULL,
      new_price_fen INTEGER NOT NULL,
      price_diff_fen INTEGER NOT NULL,
      transition_flag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      event_created_at TEXT NOT NULL,
      window_expires_at TEXT NOT NULL,
      UNIQUE (source_event_id, sku)
    );
    CREATE INDEX IF NOT EXISTS idx_legacy_orders_owner ON legacy_orders(owner_email);
    CREATE INDEX IF NOT EXISTS idx_legacy_orders_expires ON legacy_orders(window_expires_at);
    CREATE INDEX IF NOT EXISTS idx_legacy_orders_sku ON legacy_orders(sku);
  `);
}

// 纯函数：判断给定时间戳是否仍在 7 天过渡窗口内。
export function isLegacyTransitionActive(eventCreatedAt, { now = Date.now(), windowDays = NANO_TRANSITION.transitionWindowDays } = {}) {
  if (typeof eventCreatedAt !== 'string' || !eventCreatedAt.trim()) return false;
  const ts = Date.parse(eventCreatedAt.includes('T') ? eventCreatedAt : eventCreatedAt.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(ts)) return false;
  return ts + windowDays * 24 * 60 * 60 * 1000 > now;
}

// 7 天过渡 SQL：扫描 usage_events 找 7 天内且 sku ∈ affectedSkus 的事件，
// 写入 legacy_orders 快照 + usage_events.metadata.legacyPriceFen。幂等。
// 返回 { scanned, inserted, skipped, windowDays }。
export function planLegacyNano2kTransition(db, {
  now = Date.now(),
  windowDays = NANO_TRANSITION.transitionWindowDays,
  actorEmail = 'system:nano_2k_transition',
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db is required');
  }
  ensureLegacyOrderSnapshotTable(db);
  if (!tableExists(db, 'usage_events')) {
    return { scanned: 0, inserted: 0, skipped: 0, windowDays, table: 'usage_events_missing' };
  }
  const cutoff = new Date(now - windowDays * 24 * 60 * 60 * 1000).toISOString()
    .replace('T', ' ').slice(0, 19);
  const candidates = db.prepare(`
    SELECT id, owner_email, sku, charged_units, created_at
    FROM usage_events
    WHERE created_at >= ?
      AND sku IN ('ec_nano_flash_2k', 'ec_nano_pro_2k')
      AND (json_extract(metadata, '$.legacyPriceFen') IS NULL
           OR json_extract(metadata, '$.legacyPriceFen') = 0)
    ORDER BY created_at DESC
  `).all(cutoff);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO legacy_orders (
      id, source_event_id, owner_email, sku, units,
      old_price_fen, new_price_fen, price_diff_fen,
      transition_flag, created_at, event_created_at, window_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stamp = db.prepare(`
    UPDATE usage_events
    SET metadata = json_set(COALESCE(metadata, '{}'),
      '$.legacyPriceFen', ?,
      '$.legacyPriceFlag', ?,
      '$.legacyPriceWindowDays', ?)
    WHERE id = ? AND (json_extract(metadata, '$.legacyPriceFen') IS NULL
                   OR json_extract(metadata, '$.legacyPriceFen') = 0)
  `);
  let inserted = 0;
  let skipped = 0;
  const windowExpiresAt = new Date(now + windowDays * 24 * 60 * 60 * 1000).toISOString()
    .replace('T', ' ').slice(0, 19);
  const createdAt = new Date(now).toISOString().replace('T', ' ').slice(0, 19);
  const transaction = db.transaction(() => {
    for (const row of candidates) {
      const id = `legacy-${NANO_TRANSITION.flag}-${randomUUID()}`;
      const result = insert.run(
        id, row.id, row.owner_email, row.sku, row.charged_units,
        NANO_TRANSITION.oldPriceFen, NANO_TRANSITION.newPriceFen, NANO_TRANSITION.priceDiffFen,
        NANO_TRANSITION.flag, createdAt, row.created_at, windowExpiresAt,
      );
      if (result.changes === 0) {
        skipped += 1;
        continue;
      }
      stamp.run(NANO_TRANSITION.oldPriceFen, NANO_TRANSITION.flag, windowDays, row.id);
      inserted += 1;
    }
  });
  transaction();
  return { scanned: candidates.length, inserted, skipped, windowDays, actorEmail };
}

// 公开端友好文案：业务侧（结算/退费）按状态返回 user-visible 文案。
export function nanoPriceTransitionMessage({ units, currentUnits, affectedSkus = NANO_TRANSITION.affectedSkus } = {}) {
  if (!affectedSkus.includes(units)) return null;
  if (currentUnits === NANO_TRANSITION.oldUnits) return '按 7 天过渡窗口内老价结算';
  if (currentUnits === NANO_TRANSITION.newUnits) return '按新价 1.5 积分结算';
  return null;
}

export { ensureLegacyOrderSnapshotTable };
