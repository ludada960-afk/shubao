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
