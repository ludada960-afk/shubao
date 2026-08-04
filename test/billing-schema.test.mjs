import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ensureBillingSchema } from '../server/billing/schema.mjs';

test('billing schema is idempotent and creates all ledger tables', () => {
  const db = new Database(':memory:');
  ensureBillingSchema(db);
  ensureBillingSchema(db);
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const name of ['wallets', 'wallet_ledger', 'credit_lots', 'billing_holds', 'billing_hold_items', 'usage_events', 'billing_catalog', 'payment_orders', 'processed_provider_events', 'work_regeneration_entitlements']) {
    assert.ok(names.includes(name), name);
  }
  db.close();
});

test('billing schema migrates an existing payment order table with checkout storage', () => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE payment_orders (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      catalog_version INTEGER NOT NULL,
      amount_cny INTEGER NOT NULL,
      grant_currency TEXT NOT NULL,
      grant_units INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_order_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureBillingSchema(db);

  assert.ok(db.prepare('PRAGMA table_info(payment_orders)').all().some(column => column.name === 'checkout_payload'));
  db.close();
});
