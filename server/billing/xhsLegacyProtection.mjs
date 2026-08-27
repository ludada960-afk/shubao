// server/billing/xhsLegacyProtection.mjs
// 2026-08-26 周一切片 · §6 #8 XHS studio 60→50 套 60 天老客保护
// -----------------------------------------------------------------------------
// 风险：变相提价 20%，老用户续费心理摩擦。
// 默认建议：执行，但保留老用户价格 60 天（按用户 ID 写入老客保护期），
// 新客立即 50 套。
// -----------------------------------------------------------------------------
// 设计要点：
//   1) legacy_user_snapshot 表：owner_email 主键，存 protectedSku/protectedGrantUnits/
//      windowExpiresAt/createdAt，便于后续查某用户是否仍在保护期。
//   2) ensureXhsLegacySchema 在 ensureBillingSchema 时幂等调用，迁移是独立的
//      sqlite migration（不依赖现有 schema 字段）。
//   3) planXhsStudioLegacySnapshot 扫描所有已购 xhs_studio_199 的 owner_email
//      （来源 xhs_purchases 优先，回退 wallet_ledger 标的 sku=xhs_studio_199），
//      写入 legacy_user_snapshot（UNIQUE(owner_email, sku)）。
//   4) resolveXhsStudioGrantUnits({ ownerEmail, now }) 决定最终下发套数：保护期
//      内返回 60（老价），保护期外返回 catalog 新值 50。
//   5) isXhsLegacyProtectionActive 纯函数：判定某 owner 是否仍在 60 天保护窗口。
//   6) xhsLegacyProtectionMessage 返回中文 user-visible 文案。
// -----------------------------------------------------------------------------
import { randomUUID } from 'node:crypto';
import { PRODUCTS } from './catalog.mjs';

export const XHS_LEGACY = Object.freeze({
  flag: 'xhs_studio_60_to_50_2026_08_26',
  affectedSku: 'xhs_studio_199',
  oldGrantUnits: 60,        // 老价套数
  newGrantUnits: 50,        // 新价套数
  protectionWindowDays: 60,
  priceDeltaUnits: 10,      // 60 - 50
});

function tableExists(db, name) {
  if (!db || typeof db.prepare !== 'function') return false;
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));
}

// 幂等迁移：legacy_user_snapshot 表 + 索引。
export function ensureXhsLegacySchema(db) {
  if (!db || typeof db.exec !== 'function') {
    throw new TypeError('db is required');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_user_snapshot (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      sku TEXT NOT NULL,
      protected_grant_units INTEGER NOT NULL,
      new_grant_units INTEGER NOT NULL,
      protection_window_days INTEGER NOT NULL,
      transition_flag TEXT NOT NULL,
      first_purchase_at TEXT NOT NULL,
      snapshot_at TEXT NOT NULL,
      window_expires_at TEXT NOT NULL,
      UNIQUE (owner_email, sku)
    );
    CREATE INDEX IF NOT EXISTS idx_legacy_user_snapshot_owner
      ON legacy_user_snapshot(owner_email);
    CREATE INDEX IF NOT EXISTS idx_legacy_user_snapshot_expires
      ON legacy_user_snapshot(window_expires_at);
    CREATE INDEX IF NOT EXISTS idx_legacy_user_snapshot_sku
      ON legacy_user_snapshot(sku);
  `);
}

// 纯函数：判定 owner 是否仍在 60 天保护窗口内。
export function isXhsLegacyProtectionActive(snapshot, { now = Date.now() } = {}) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const expiresRaw = snapshot.window_expires_at;
  if (typeof expiresRaw !== 'string' || !expiresRaw.trim()) return false;
  // sqlite 默认 'YYYY-MM-DD HH:MM:SS'，补 'Z' 转 UTC
  const normalized = expiresRaw.includes('T') ? expiresRaw : expiresRaw.replace(' ', 'T') + 'Z';
  const expires = Date.parse(normalized);
  if (!Number.isFinite(expires)) return false;
  return expires > now;
}

// 60 天保护迁移：扫描历史上购过 xhs_studio_199 的 owner_email，写入快照。
// 输入：db（已 ensure schema）；输出 { scanned, inserted, skipped, windowDays, source }。
// 优先从 xhs_purchases 表读（若有），否则回退到 wallet_ledger。
export function planXhsStudioLegacySnapshot(db, {
  now = Date.now(),
  windowDays = XHS_LEGACY.protectionWindowDays,
  actorEmail = 'system:xhs_studio_legacy',
} = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db is required');
  }
  ensureXhsLegacySchema(db);
  const windowExpiresAt = new Date(now + windowDays * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);
  const snapshotAt = new Date(now).toISOString().replace('T', ' ').slice(0, 19);

  // 找候选 owner 列表：先 xhs_purchases，再 wallet_ledger
  let candidates = [];
  let source = 'xhs_purchases';
  if (tableExists(db, 'xhs_purchases')) {
    candidates = db.prepare(`
      SELECT owner_email, MIN(created_at) AS first_purchase_at
      FROM xhs_purchases
      WHERE sku = ?
      GROUP BY owner_email
    `).all(XHS_LEGACY.affectedSku);
  } else if (tableExists(db, 'wallet_ledger')) {
    source = 'wallet_ledger';
    candidates = db.prepare(`
      SELECT owner_email, MIN(created_at) AS first_purchase_at
      FROM wallet_ledger
      WHERE sku = ? AND event_type IN ('grant', 'topup', 'purchase')
      GROUP BY owner_email
    `).all(XHS_LEGACY.affectedSku);
  } else {
    return { scanned: 0, inserted: 0, skipped: 0, windowDays, source: 'no_source_table' };
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO legacy_user_snapshot (
      id, owner_email, sku, protected_grant_units, new_grant_units,
      protection_window_days, transition_flag, first_purchase_at,
      snapshot_at, window_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  let skipped = 0;
  const transaction = db.transaction(() => {
    for (const row of candidates) {
      const id = `legacy-${XHS_LEGACY.flag}-${randomUUID()}`;
      const firstAt = String(row.first_purchase_at || snapshotAt);
      const result = insert.run(
        id, row.owner_email, XHS_LEGACY.affectedSku,
        XHS_LEGACY.oldGrantUnits, XHS_LEGACY.newGrantUnits,
        windowDays, XHS_LEGACY.flag, firstAt, snapshotAt, windowExpiresAt,
      );
      if (result.changes === 0) {
        skipped += 1;
        continue;
      }
      inserted += 1;
    }
  });
  transaction();
  return { scanned: candidates.length, inserted, skipped, windowDays, source, actorEmail };
}

// 决定某 owner 购 xhs_studio_199 时应下发套数：保护期内 60，否则 catalog 新值 50。
export function resolveXhsStudioGrantUnits(db, { ownerEmail, now = Date.now(), catalog } = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('db is required');
  }
  if (typeof ownerEmail !== 'string' || !ownerEmail.trim()) {
    throw new TypeError('ownerEmail is required');
  }
  ensureXhsLegacySchema(db);
  const skuSource = (catalog && catalog.PRODUCTS) || PRODUCTS;
  const newUnits = (skuSource && skuSource.xhs_studio_199 && skuSource.xhs_studio_199.grantUnits)
    || XHS_LEGACY.newGrantUnits;
  const row = db.prepare(`
    SELECT protected_grant_units, new_grant_units, window_expires_at, transition_flag
    FROM legacy_user_snapshot
    WHERE owner_email = ? AND sku = ?
  `).get(ownerEmail, XHS_LEGACY.affectedSku);
  if (!row) {
    return {
      ownerEmail,
      sku: XHS_LEGACY.affectedSku,
      grantUnits: newUnits,
      protected: false,
      transitionFlag: XHS_LEGACY.flag,
    };
  }
  const active = isXhsLegacyProtectionActive(row, { now });
  return {
    ownerEmail,
    sku: XHS_LEGACY.affectedSku,
    grantUnits: active ? row.protected_grant_units : row.new_grant_units,
    protected: active,
    transitionFlag: row.transition_flag || XHS_LEGACY.flag,
    windowExpiresAt: row.window_expires_at,
  };
}

// user-visible 文案（中文）：结算/购卡时返回状态文本。
export function xhsLegacyProtectionMessage({ grantUnits, protected: isProtected } = {}) {
  if (grantUnits === XHS_LEGACY.oldGrantUnits && isProtected) {
    return '老客 60 天保护期内按 60 套结算';
  }
  if (grantUnits === XHS_LEGACY.newGrantUnits) {
    return '新客按 50 套结算';
  }
  return null;
}
