import { ensureAccessSchema } from '../accessControl.mjs';
import { ensureH3InviteSchema } from './h3InviteCodes.mjs';
import { ensureXhsLegacySchema } from './xhsLegacyProtection.mjs';

export function ensureBillingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      owner_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      available_units INTEGER NOT NULL DEFAULT 0,
      held_units INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (owner_email, currency)
    );
    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      event_type TEXT NOT NULL,
      delta_available INTEGER NOT NULL,
      delta_held INTEGER NOT NULL,
      balance_available INTEGER NOT NULL,
      balance_held INTEGER NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS credit_lots (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      granted_units INTEGER NOT NULL,
      remaining_units INTEGER NOT NULL,
      refundable INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS billing_holds (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      quote_id TEXT NOT NULL,
      status TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      settled_units INTEGER NOT NULL DEFAULT 0,
      released_units INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS billing_hold_items (
      id TEXT PRIMARY KEY,
      hold_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      sku TEXT NOT NULL,
      units INTEGER NOT NULL,
      status TEXT NOT NULL,
      reference_id TEXT NOT NULL DEFAULT '',
      UNIQUE (hold_id, item_key)
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      currency TEXT NOT NULL,
      sku TEXT NOT NULL,
      charged_units INTEGER NOT NULL,
      shadow_units INTEGER NOT NULL DEFAULT 0,
      provider_cost_cny REAL NOT NULL DEFAULT 0,
      credit_face_value_cny REAL NOT NULL DEFAULT 0,
      cash_revenue_cny REAL NOT NULL DEFAULT 0,
      promo_subsidy_cny REAL NOT NULL DEFAULT 0,
      cost_source TEXT NOT NULL DEFAULT 'catalog_fixed',
      cost_confidence TEXT NOT NULL DEFAULT 'medium',
      feature TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      catalog_version INTEGER NOT NULL DEFAULT 0,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS billing_catalog (
      sku TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      effective_at TEXT NOT NULL,
      PRIMARY KEY (sku, version)
    );
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      catalog_version INTEGER NOT NULL,
      amount_cny INTEGER NOT NULL,
      grant_currency TEXT NOT NULL,
      grant_units INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_order_id TEXT NOT NULL DEFAULT '',
      channel_ref TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      checkout_payload TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS processed_provider_events (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, event_id)
    );
    CREATE TABLE IF NOT EXISTS work_regeneration_entitlements (
      work_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      included_count INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      held_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      plan_snapshot TEXT NOT NULL
    );
  `);

  const paymentOrderColumns = db.prepare("PRAGMA table_info(payment_orders)").all().map(column => column.name);
  if (!paymentOrderColumns.includes('checkout_payload')) {
    db.exec("ALTER TABLE payment_orders ADD COLUMN checkout_payload TEXT NOT NULL DEFAULT ''");
  }
  // 支付通道引用（2026-08-26 终案预留）：wechat_qr/alipay 上线时记录成交通道；balance/内部通道留空串。
  if (!paymentOrderColumns.includes('channel_ref')) {
    db.exec("ALTER TABLE payment_orders ADD COLUMN channel_ref TEXT NOT NULL DEFAULT ''");
  }
  const usageEventColumns = db.prepare("PRAGMA table_info(usage_events)").all().map(column => column.name);
  const usageColumns = [
    ['credit_face_value_cny', 'REAL NOT NULL DEFAULT 0'],
    ['cash_revenue_cny', 'REAL NOT NULL DEFAULT 0'],
    ['promo_subsidy_cny', 'REAL NOT NULL DEFAULT 0'],
    ['cost_source', "TEXT NOT NULL DEFAULT 'catalog_fixed'"],
    ['cost_confidence', "TEXT NOT NULL DEFAULT 'medium'"],
    ['feature', "TEXT NOT NULL DEFAULT ''"],
    ['provider', "TEXT NOT NULL DEFAULT ''"],
    ['model', "TEXT NOT NULL DEFAULT ''"],
    ['catalog_version', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [name, definition] of usageColumns) {
    if (!usageEventColumns.includes(name)) {
      db.exec(`ALTER TABLE usage_events ADD COLUMN ${name} ${definition}`);
    }
  }
  // 2026-08-26 §6 #7 H3 灰度邀请表（独立 sqlite migration，幂等）。
  ensureH3InviteSchema(db);
  // 2026-08-26 §6 #8 XHS studio 60→50 套 60 天老客保护快照表（独立 sqlite migration，幂等）。
  ensureXhsLegacySchema(db);
  ensureAccessSchema(db);
}