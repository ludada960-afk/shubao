# Billing Ledger and Content Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auditable multi-currency billing ledger, secure server-owned product catalog, resumable holds, and complete server-side charging for Xiaohongshu content and Plog without changing their current package prices.

**Architecture:** Add a focused `server/billing/` boundary over the existing SQLite database. Every paid action follows quote → hold → settle/release, while payment orders grant server-defined products idempotently. Xiaohongshu and Plog share `content_sets`; ecommerce uses separate `ec_points`.

**Tech Stack:** Node.js ESM, Express 4, better-sqlite3, Node test runner, React 18.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability`.
- Use the approved Git prefix exactly: `git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability` from `F:/da/shubao`.
- Never stage `dist/`, `server/works.db*`, runtime uploads, caches, or unrelated user changes.
- `867550189@qq.com` remains unlimited but must produce shadow usage records.
- Store balances as integer billing units; `1000 units = 1 ec_point` and `1 unit = 1 content_set` for the content currency.
- Client-supplied `amount`, `sets`, `credits`, or `points` are never authoritative.
- Xiaohongshu/Plog package prices and set counts remain 19/3, 49/10, 99/25, 199/60.
- A content set settles only after text plus nine stable images are deliverable, unless the user explicitly accepts a partial result.
- Alipay and WeChat remain disabled until a configured provider passes signature and webhook tests.

---

## File Structure

- Create `server/billing/schema.mjs`: idempotent billing table migration.
- Create `server/billing/catalog.mjs`: server-owned products, feature SKUs, prices, and margin checks.
- Create `server/billing/walletService.mjs`: grants, holds, settlement, release, refunds, ledger queries.
- Create `server/billing/paymentService.mjs`: payment order state machine and idempotent credit grant.
- Create `server/billing/contentEntitlements.mjs`: content-set and per-work regeneration entitlements.
- Create `server/billing/contentBilling.mjs`: generation lifecycle wrapper for Xiaohongshu/Plog.
- Create `server/billing/routes.mjs`: quotes, balance, ledger, orders, and admin beta grants.
- Modify `server/db.mjs`: expose the initialized database and run billing schema migration.
- Modify `server/index.mjs`: mount billing routes and wrap content/Plog generation.
- Test with `test/billing-schema.test.mjs`, `test/billing-catalog.test.mjs`, `test/billing-wallet.test.mjs`, `test/payment-orders.test.mjs`, `test/content-entitlements.test.mjs`, and `test/content-billing.test.mjs`.

### Task 1: Billing schema and database boundary

**Files:**
- Create: `server/billing/schema.mjs`
- Modify: `server/db.mjs`
- Test: `test/billing-schema.test.mjs`

**Interfaces:**
- Produces: `ensureBillingSchema(db)`, `getDatabase()`.
- Consumes: a `better-sqlite3` database instance.

- [ ] **Step 1: Write the failing schema test**

```js
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
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test --test-concurrency=1 test/billing-schema.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/billing/schema.mjs`.

- [ ] **Step 3: Implement the idempotent schema**

```js
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
      status TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
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
}
```

- [ ] **Step 4: Export the database handle and invoke the migration**

Add to `server/db.mjs`:

```js
import { ensureBillingSchema } from './billing/schema.mjs';

export function getDatabase() {
  if (!db) initDB();
  return db;
}
```

Call `ensureBillingSchema(db)` immediately after the legacy column migrations in `initDB()`.

- [ ] **Step 5: Run the focused and existing persistence tests**

Run: `node --test --test-concurrency=1 test/billing-schema.test.mjs test/task-persistence.test.mjs test/ecommerce-work-persistence.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/schema.mjs server/db.mjs test/billing-schema.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add auditable billing schema"
```

### Task 2: Server-owned catalog and margin gate

**Files:**
- Create: `server/billing/catalog.mjs`
- Test: `test/billing-catalog.test.mjs`

**Interfaces:**
- Produces: `PRODUCTS`, `FEATURE_SKUS`, `getProduct(sku)`, `quoteFeature(sku, quantity)`, `assertContributionMargin(item, unitPriceCny)`.

- [ ] **Step 1: Write failing catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getProduct, quoteFeature, assertContributionMargin } from '../server/billing/catalog.mjs';

test('client cannot choose the price or grant amount', () => {
  assert.deepEqual(getProduct('ec_starter_29'), { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null });
});

test('quotes ecommerce outputs from server feature weights', () => {
  assert.equal(quoteFeature('ec_image_2k', 8).totalUnits, 8000);
  assert.equal(quoteFeature('ec_image_4k', 2).totalUnits, 4000);
});

test('rejects a feature price below the 70 percent contribution margin gate', () => {
  assert.throws(() => assertContributionMargin({ providerCostCny: 0.0694 }, 0.20), /margin/i);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/billing-catalog.test.mjs`

Expected: FAIL because `catalog.mjs` does not exist.

- [ ] **Step 3: Implement immutable catalog entries**

```js
export const PRODUCTS = Object.freeze({
  ec_trial_990: { sku: 'ec_trial_990', priceFen: 990, currency: 'ec_points', grantUnits: 30000, validityDays: null },
  ec_starter_29: { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null },
  ec_growth_79: { sku: 'ec_growth_79', priceFen: 7900, currency: 'ec_points', grantUnits: 295000, validityDays: null },
  ec_studio_199: { sku: 'ec_studio_199', priceFen: 19900, currency: 'ec_points', grantUnits: 760000, validityDays: null },
  xhs_entry_19: { sku: 'xhs_entry_19', priceFen: 1900, currency: 'content_sets', grantUnits: 3, validityDays: 30, regenPerWork: 5 },
  xhs_growth_49: { sku: 'xhs_growth_49', priceFen: 4900, currency: 'content_sets', grantUnits: 10, validityDays: 30, regenPerWork: 8 },
  xhs_creator_99: { sku: 'xhs_creator_99', priceFen: 9900, currency: 'content_sets', grantUnits: 25, validityDays: 30, regenPerWork: 15 },
  xhs_studio_199: { sku: 'xhs_studio_199', priceFen: 19900, currency: 'content_sets', grantUnits: 60, validityDays: 30, regenPerWork: 30 },
});

export const FEATURE_SKUS = Object.freeze({
  ec_image_2k: { units: 1000, providerCostCny: 0.0694 },
  ec_image_4k: { units: 2000, providerCostCny: 0.0694 },
  ec_reverse_prompt: { units: 200, providerCostCny: 0.01 },
  ec_remove_bg: { units: 500, providerCostCny: 0.03 },
  ec_layer_psd: { units: 3000, providerCostCny: 0.20, enabled: false },
  content_full_set: { units: 1, currency: 'content_sets' },
});
```

Implement `getProduct` as a defensive copy, `quoteFeature` with integer multiplication, and the margin equation from the spec.

- [ ] **Step 4: Run tests**

Run: `node --test --test-concurrency=1 test/billing-catalog.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/catalog.mjs test/billing-catalog.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add server owned billing catalog"
```

### Task 3: Atomic wallet, holds, settlement, and shadow usage

**Files:**
- Create: `server/billing/walletService.mjs`
- Test: `test/billing-wallet.test.mjs`

**Interfaces:**
- Produces: `createWalletService(db, { isUnlimited })` with `grant`, `getBalance`, `createHold`, `settleItem`, `releaseItem`, `releaseRemainder`, `listLedger`.

- [ ] **Step 1: Write failing transaction tests**

```js
test('a hold prevents concurrent overspending and partial failure releases units', () => {
  service.grant({ ownerEmail: 'a@b.com', currency: 'ec_points', units: 2000, idempotencyKey: 'grant-1' });
  const hold = service.createHold({ ownerEmail: 'a@b.com', currency: 'ec_points', quoteId: 'q1', idempotencyKey: 'hold-1', items: [{ key: 'one', sku: 'ec_image_2k', units: 1000 }, { key: 'two', sku: 'ec_image_2k', units: 1000 }] });
  assert.equal(service.getBalance('a@b.com', 'ec_points').availableUnits, 0);
  assert.throws(() => service.createHold({ ownerEmail: 'a@b.com', currency: 'ec_points', quoteId: 'q2', idempotencyKey: 'hold-2', items: [{ key: 'x', sku: 'ec_image_2k', units: 1000 }] }), /insufficient/i);
  service.settleItem(hold.id, 'one', { referenceId: 'asset-1', providerCostCny: 0.038 });
  service.releaseItem(hold.id, 'two', { reason: 'provider_failed' });
  assert.deepEqual(service.getBalance('a@b.com', 'ec_points'), { availableUnits: 1000, heldUnits: 0, unlimited: false });
});
```

Add a second test verifying repeated idempotency keys do not duplicate grants or settlements, plus an unlimited account test that leaves balances unchanged and writes `shadow_units`.

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/billing-wallet.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement wallet transactions**

Use `db.transaction()` for every state change. The hold transaction must:

```js
const createHoldTx = db.transaction(input => {
  const units = input.items.reduce((sum, item) => sum + item.units, 0);
  const wallet = ensureWallet(input.ownerEmail, input.currency);
  if (!isUnlimited(input.ownerEmail) && wallet.available_units < units) throw insufficientCredits(input.currency, units, wallet.available_units);
  if (!isUnlimited(input.ownerEmail)) {
    db.prepare('UPDATE wallets SET available_units = available_units - ?, held_units = held_units + ?, version = version + 1 WHERE owner_email = ? AND currency = ?').run(units, units, input.ownerEmail, input.currency);
  }
  // Insert hold, hold items, and a single ledger row keyed by input.idempotencyKey.
});
```

Settlement inserts `usage_events`; unlimited accounts write `shadow_units` instead of changing the wallet.

- [ ] **Step 4: Run focused tests**

Run: `node --test --test-concurrency=1 test/billing-wallet.test.mjs test/billing-schema.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/walletService.mjs test/billing-wallet.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add atomic wallet holds and settlement"
```

### Task 4: Secure payment orders and disabled provider adapters

**Files:**
- Create: `server/billing/paymentService.mjs`
- Test: `test/payment-orders.test.mjs`

**Interfaces:**
- Produces: `createPaymentService(db, walletService, providers)` with `createOrder`, `applyProviderEvent`, `getOrder`.

- [ ] **Step 1: Write payment security tests**

Test that `createOrder({ productSku: 'ec_starter_29', clientAmount: 1, clientGrantUnits: 999999 })` still stores `2900` fen and `105000` units. Test the same provider event twice and assert the wallet is credited once. Test `alipay` and `wechat` return `PAYMENT_PROVIDER_DISABLED` when disabled.

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/payment-orders.test.mjs`

Expected: FAIL with missing payment service.

- [ ] **Step 3: Implement order creation from product SKU only**

```js
createOrder({ ownerEmail, productSku, provider, idempotencyKey }) {
  const product = getProduct(productSku);
  const adapter = providers[provider];
  if (!adapter?.enabled) throw codedError('PAYMENT_PROVIDER_DISABLED');
  // Persist the server snapshot before calling the adapter.
}
```

`applyProviderEvent` must verify the adapter signature before entering one transaction that inserts `processed_provider_events`, changes `paid → credited`, and calls `walletService.grant`.

- [ ] **Step 4: Run tests**

Run: `node --test --test-concurrency=1 test/payment-orders.test.mjs test/billing-wallet.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/paymentService.mjs test/payment-orders.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: secure payment order settlement"
```

### Task 5: Content-set and per-work regeneration entitlements

**Files:**
- Create: `server/billing/contentEntitlements.mjs`
- Test: `test/content-entitlements.test.mjs`

**Interfaces:**
- Produces: `createContentEntitlements(db, walletService)` with `holdSet`, `completeSet`, `acceptPartial`, `failSet`, `holdRegeneration`, `completeRegeneration`, `releaseRegeneration`.

- [ ] **Step 1: Write entitlement tests**

Create tests for: full nine-image result settles one set and creates five regeneration credits; eight images remain `needs_review`; accepted partial settles; system repair does not reduce regeneration count; a user-requested regeneration does.

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/content-entitlements.test.mjs`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement completion validation**

```js
export function isCompleteContentDelivery(result) {
  const urls = [result.cover_url, ...(result.image_urls || [])].filter(Boolean);
  const hasText = Boolean(result.title || result.caption || result.body_text || result.copyLines?.length);
  return hasText && urls.length === 9 && urls.every(url => url.startsWith('/api/generated-assets/'));
}
```

Create the regeneration entitlement from the product/order snapshot, not from a client field.

- [ ] **Step 4: Run tests**

Run: `node --test --test-concurrency=1 test/content-entitlements.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/contentEntitlements.mjs test/content-entitlements.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: add content set entitlements"
```

### Task 6: Wrap Xiaohongshu and both Plog entrypoints in server billing

**Files:**
- Create: `server/billing/contentBilling.mjs`
- Modify: `server/index.mjs`
- Test: `test/content-billing.test.mjs`

**Interfaces:**
- Produces: `beginContentGeneration`, `completeContentGeneration`, `failContentGeneration`.

- [ ] **Step 1: Write route-contract tests**

Read `server/index.mjs` as text and assert `/api/generate` and `/api/plog-generate` call `beginContentGeneration`, complete only after `persistGeneratedAsset`, and call failure release in `catch/finally`. Add a pure service test proving the same `generationId` returns the existing hold.

- [ ] **Step 2: Verify failure**

Run: `node --test --test-concurrency=1 test/content-billing.test.mjs`

Expected: FAIL because the wrapper is not integrated.

- [ ] **Step 3: Implement the lifecycle wrapper**

```js
export function beginContentGeneration({ ownerEmail, generationId, mode, planSnapshot }) {
  return contentEntitlements.holdSet({
    ownerEmail,
    generationId,
    idempotencyKey: `content:${generationId}:hold`,
    metadata: { mode, planSnapshot },
  });
}
```

At both route completions, persist every returned URL through `persistGeneratedAsset` before evaluating nine-image completeness. Ensure `withSessionEmail` supplies the owner and that anonymous preview takes a separate preview path without a full-set hold.

- [ ] **Step 4: Remove client-only authority from the route result**

Return the authoritative entitlement snapshot in the SSE complete event:

```js
send('complete', { ...result, billing: { currency: 'content_sets', settledUnits: 1, balance: updatedBalance } });
```

- [ ] **Step 5: Run regression tests**

Run: `npm run test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/contentBilling.mjs server/index.mjs test/content-billing.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: enforce content and plog billing server side"
```

### Task 7: Billing API routes and legacy balance migration

**Files:**
- Create: `server/billing/routes.mjs`
- Modify: `server/index.mjs`
- Modify: `server/db.mjs`
- Test: `test/billing-routes.test.mjs`

**Interfaces:**
- Produces endpoints `/api/billing/catalog`, `/api/billing/balance`, `/api/billing/quote`, `/api/billing/orders`, `/api/billing/orders/:id`, `/api/billing/ledger`.

- [ ] **Step 1: Write route handler tests with fake request/response objects**

Verify unauthenticated access fails, catalog omits disabled SKUs, quote ignores client units, and owner account returns `unlimited: true` with shadow balances.

- [ ] **Step 2: Implement route mounting**

```js
export function mountBillingRoutes(app, deps) {
  app.get('/api/billing/catalog', deps.catalogHandler);
  app.get('/api/billing/balance', deps.requireUser, deps.balanceHandler);
  app.post('/api/billing/quote', deps.requireUser, deps.quoteHandler);
  app.post('/api/billing/orders', deps.requireUser, deps.createOrderHandler);
  app.get('/api/billing/orders/:id', deps.requireUser, deps.orderHandler);
  app.get('/api/billing/ledger', deps.requireUser, deps.ledgerHandler);
}
```

Migrate legacy `users.credits` once into `content_sets` with a `legacy-content-credit:<email>` idempotency key. Keep `users.credits` read-only until the frontend migration is deployed, then stop writing it.

- [ ] **Step 3: Run tests**

Run: `node --test --test-concurrency=1 test/billing-routes.test.mjs test/access-policy.test.mjs test/entitlement-state.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing/routes.mjs server/index.mjs server/db.mjs test/billing-routes.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "feat: expose secure billing APIs"
```

### Task 8: Full billing verification

**Files:**
- Modify only files required by failures from this task.

- [ ] **Step 1: Run all tests**

Run: `npm run test`

Expected: all tests PASS with no database lock or open-handle warnings.

- [ ] **Step 2: Run export verification and build**

Run: `npm run build`

Expected: `verify-exports` and Vite build PASS.

- [ ] **Step 3: Inspect staged scope before commit**

Run: `git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability status --short`

Expected: only billing source/tests and intentional integration files; no `dist/` or `server/works.db*` staged.

- [ ] **Step 4: Commit final billing fixes**

```powershell
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability add -- server/billing server/db.mjs server/index.mjs test/billing-*.test.mjs test/content-*.test.mjs test/payment-orders.test.mjs
git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability commit -m "test: verify billing and content entitlements"
```
