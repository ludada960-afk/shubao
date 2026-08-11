# Admin Access Billing Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hard-coded unlimited beta access with a database-backed admin console, explicit product permissions, real credit metering, and auditable per-account cost/profit reporting.

**Architecture:** Keep the existing SQLite wallet/hold/settlement ledger as the source of truth. Add account access, feature permissions, admin audit, provider cost snapshots, and reporting queries beside the billing schema. Authenticate by the existing signed session, then authorize every admin or product request from server-side database state. Reuse existing ecommerce, video, content, and one-shot billing flows and route any remaining paid AI action through one shared billing adapter.

**Tech Stack:** Node.js ESM, Express, SQLite/better-sqlite3, React/Vite, node:test, Playwright production audit scripts.

## Global Constraints

- Admin permission and credit balance are separate; administrators are not exempt from metering.
- `867550189@qq.com` starts with 300,000 `ec_points`; `240485042@qq.com` starts with 100,000 `ec_points`.
- Both migrated accounts have all four product permissions and no unlimited bypass.
- Every paid AI action uses server-authoritative SKU pricing, holds before provider submission, settlement on delivery, release on failure, and idempotency.
- Cost reports distinguish provider-reported, balance-delta, token-calculated, catalog-fixed, and estimated values.
- Do not submit real video-generation tasks during development or verification.

---

### Task 1: Add database-backed account access and audit schema

**Files:**
- Create: `server/accessControl.mjs`
- Modify: `server/billing/schema.mjs`
- Modify: `server/db.mjs`
- Test: `test/access-control.test.mjs`

**Interfaces:**
- Produces `ensureAccessSchema(db)`, `getAccountAccess(db, email)`, `requireFeatureAccess(db, email, feature)`, `requireAdminAccess(db, email)`, and transactional mutation helpers for later routes.

- [ ] Write tests for normalization, migration defaults, suspended accounts, explicit feature subsets, and admin-only authorization.
- [ ] Run `node --test test/access-control.test.mjs` and verify the new tests fail because the module/schema is absent.
- [ ] Add `account_access`, `account_features`, and `admin_audit_log` tables with unique email/feature keys, status checks, timestamps, actor and before/after JSON fields.
- [ ] Seed the two configured accounts idempotently with roles and all four feature permissions, but do not seed unlimited flags.
- [ ] Implement server-side access queries and transactional mutation helpers. Never trust request-body email for authorization.
- [ ] Run the focused test and the existing access-policy tests.
- [ ] Commit `feat: add database-backed account access control`.

### Task 2: Remove unlimited beta accounting and migrate real balances

**Files:**
- Modify: `server/accessPolicy.mjs`
- Modify: `server/index.mjs`
- Modify: `server/generationRouteGuard.mjs`
- Modify: `server/billing/walletService.mjs`
- Modify: `server/billing/routes.mjs`
- Modify: `test/access-policy.test.mjs`
- Modify: `test/billing-routes.test.mjs`
- Modify: `test/billing-wallet.test.mjs`

**Interfaces:**
- `createWalletService(db)` uses normal paid accounting for migrated accounts. Existing legacy unlimited tests are replaced with explicit grant-and-settle tests.

- [ ] Add failing tests proving both migrated accounts report numeric balances, settle by decreasing available units, and cannot use an unlimited shadow path.
- [ ] Remove the default emails from `isUnlimitedBetaEmail` and make new access-control records the allowlist source.
- [ ] Add an idempotent bootstrap grant for 300,000 and 100,000 points with source `admin_grant:migration-2026-08-11`.
- [ ] Keep legacy database balances intact while ensuring migration cannot duplicate grants on restart.
- [ ] Update frontend entitlement normalization so `unlimited` is false for migrated accounts.
- [ ] Run billing/access tests and confirm the old unlimited path has no production caller.
- [ ] Commit `feat: meter beta accounts with real credit balances`.

### Task 3: Build admin reporting and mutation APIs

**Files:**
- Create: `server/adminOperations.mjs`
- Create: `server/adminRoutes.mjs`
- Modify: `server/index.mjs`
- Modify: `server/billing/schema.mjs`
- Test: `test/admin-routes.test.mjs`

**Interfaces:**
- `createAdminOperations({ db, walletService })` exposes account listing/detail, permission mutation, grant/revoke, suspend/restore, summary, usage aggregation, and audit queries.
- Mounts `/api/admin/summary`, `/api/admin/accounts`, `/api/admin/accounts/:email`, `/api/admin/accounts/:email/permissions`, `/api/admin/accounts/:email/credits`, and `/api/admin/audit`.

- [ ] Write route tests for admin authorization, cross-account isolation, idempotent grants, required reasons, negative/overflow validation, and audit records.
- [ ] Add transactional operations that call wallet `grant`/`revoke`, never raw balance updates, and append immutable audit rows.
- [ ] Add reporting queries for credits consumed, cash revenue, promo subsidy, provider cost, contribution, margin, failure rate, and provider/source confidence.
- [ ] Add pagination, bounded date filters, feature/provider filters, and CSV-safe response data.
- [ ] Mount routes after session authentication and before SPA fallback.
- [ ] Run focused route tests and billing routes tests.
- [ ] Commit `feat: add admin account and billing operations api`.

### Task 4: Close the remaining AI billing gaps

**Files:**
- Create: `server/billing/aiActionBilling.mjs`
- Modify: `server/index.mjs`
- Modify: `server/extensionRoutes.mjs`
- Modify: `server/billing/catalog.mjs`
- Test: `test/ai-action-billing.test.mjs`
- Test: `test/route-billing-coverage.test.mjs`

**Interfaces:**
- `createAiActionBilling({ walletService, quoteService })` exposes `execute({ ownerEmail, feature, sku, actionId, referenceType, metadata, work })` and guarantees hold/settle/release/idempotency.

- [ ] Inventory all provider-backed routes and add failing route-contract tests for regeneration, reverse prompt, remove background, direction refresh, layer analysis, OCR/text replacement, extension analysis/regeneration, and free-creation generation.
- [ ] Add only the needed SKUs to the server catalog with versioned units and provider cost snapshots; deterministic local operations remain free.
- [ ] Wrap each provider-backed route with feature authorization and shared one-shot billing, preserving current response shapes.
- [ ] Ensure content and video routes use the same account access checks before they create holds.
- [ ] Ensure image/video provider errors release holds and ambiguous submissions are marked for review rather than silently retried.
- [ ] Run route coverage tests with mocked providers; never call a real video provider.
- [ ] Commit `feat: enforce billing across provider-backed ai actions`.

### Task 5: Add cost-source snapshots and admin UI

**Files:**
- Create: `server/providerCostAccounting.mjs`
- Create: `src/components/AdminConsole.jsx`
- Create: `src/components/AdminConsole.css`
- Modify: `src/App.jsx`
- Modify: `src/AppContext.jsx`
- Test: `test/provider-cost-accounting.test.mjs`
- Test: `test/admin-console-contract.test.mjs`

**Interfaces:**
- Cost normalizer returns `{ amountCny, source, confidence, provider, model, snapshotVersion, measuredAt }`.
- Admin UI consumes only `/api/admin/*` and exposes no provider credentials.

- [ ] Write tests for cost-source labels, revenue-vs-subsidy separation, margin calculations, and empty/error states.
- [ ] Normalize DeepSeek usage fields and official balance snapshots when available; normalize intermediary/video fixed-cost snapshots with explicit confidence.
- [ ] Store immutable cost metadata with usage events and expose grouped reporting fields.
- [ ] Add an admin-only entry in the top bar and a dense operational console with summary KPIs, account table, account drawer, grant/revoke form, permissions toggles, cost filters, and audit timeline.
- [ ] Add loading, error, pagination, confirmation, disabled, and narrow viewport states.
- [ ] Run UI contract tests and production build.
- [ ] Commit `feat: add admin console and cost source reporting`.

### Task 6: Full verification, migration, deployment, and rollback evidence

**Files:**
- Modify: `scripts/audit-production.mjs` if admin read-only checks are needed
- Modify: `scripts/verify-production-video.mjs` only for non-generating contract checks if needed
- Test: existing full suite plus new focused tests

- [ ] Run focused tests, then `npm test` and `npm run build`.
- [ ] Run static security checks for authorization, client-controlled email, raw balance writes, leaked secrets, and admin route exposure.
- [ ] Run local API smoke tests for both migrated accounts, including one mocked successful image action and one mocked failed action.
- [ ] Deploy only with `scripts/deploy-production.ps1 -CanarySeconds 600 -PublicWarmupSeconds 180`.
- [ ] Confirm production canary, PM2 health, queue/lock state, admin read-only summary, migrated balances, and no real video submission.
- [ ] Run `node scripts/audit-production.mjs --url=https://shuimg.cn` and the read-only video contract verifier.
- [ ] Commit `chore: verify admin billing operations rollout` if verification-only changes exist.
