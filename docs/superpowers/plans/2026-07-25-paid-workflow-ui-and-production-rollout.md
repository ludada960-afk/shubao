# Paid Workflow UI and Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the new billing and ecommerce job APIs to every user entrypoint, preserve interrupted work through paywalls, expose honest prices and progress, and deploy with reversible production validation.

**Architecture:** Add one frontend billing client and pure UI model, then integrate it into the existing AppContext, pricing modal/page, ecommerce flow, Xiaohongshu, Plog, canvas actions, and works. Reuse stable task IDs and draft snapshots so login or payment never resets the current workflow.

**Tech Stack:** React 18, Vite 6, native fetch/SSE, CSS Modules or existing design tokens, Node test runner, PowerShell deployment, Nginx, PM2.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability`.
- Use the approved Git prefix exactly from `F:/da/shubao`.
- Do not edit or stage runtime databases, generated assets, `dist/`, uploads, or caches.
- User-facing copy says “AI 积分” for ecommerce and “创作套数” for Xiaohongshu/Plog.
- Never expose upstream model names, provider prices, unsupported quality settings, or implementation notes to users.
- Payment-unavailable state must not render active Alipay/WeChat buttons.
- A paywall never clears files, prompt, selected direction, SKU, sizing, Plog style, layout, or canvas references.
- The owner account remains visibly unlimited without a fake numeric balance.
- GLM work is limited to new presentational files listed in Task 1 and may not modify AppContext, routes, API services, billing logic, or production pages.

---

## File Structure

- GLM-only create scope: `src/components/billing/BillingPriceBadge.jsx`, `BillingBalanceCard.jsx`, `BillingQuoteBreakdown.jsx`, `BillingHistoryList.jsx`, `Billing.module.css`, `billingUiModel.js`, `test/billing-ui-model.test.mjs`.
- GPT create scope: `src/services/billing.js`, `src/utils/pendingPaidAction.js`, `src/components/billing/InsufficientBalanceModal.jsx`.
- GPT modify scope: `src/store/AppContext.jsx`, `src/store/entitlementState.js`, `src/components/business/Modals.jsx`, `src/pages/Pricing/index.jsx`, `src/constants/data.js`, `src/pages/Home/EcMode.jsx`, `src/pages/Home/ec/DesignDirection.jsx`, `src/pages/Home/XhsContentMode.jsx`, `src/pages/Plog/index.jsx`, `src/pages/EcStudio/index.jsx`, `src/pages/EcCanvas/index.jsx`, `src/services/api.js`, and `scripts/deploy-production.ps1`.

### Task 1: Independent billing presentation components (GLM-safe)

**Files:**
- Create: `src/components/billing/BillingPriceBadge.jsx`
- Create: `src/components/billing/BillingBalanceCard.jsx`
- Create: `src/components/billing/BillingQuoteBreakdown.jsx`
- Create: `src/components/billing/BillingHistoryList.jsx`
- Create: `src/components/billing/Billing.module.css`
- Create: `src/components/billing/billingUiModel.js`
- Test: `test/billing-ui-model.test.mjs`

**Interfaces:**
- Produces pure presentational components with no fetch, context, routing, or side effects.

- [ ] **Step 1: Give GLM this exact isolated prompt**

```text
在 F:\da\shubao\.worktrees\glm-billing-ui 新建独立分支，只允许创建以下文件：
src/components/billing/BillingPriceBadge.jsx
src/components/billing/BillingBalanceCard.jsx
src/components/billing/BillingQuoteBreakdown.jsx
src/components/billing/BillingHistoryList.jsx
src/components/billing/Billing.module.css
src/components/billing/billingUiModel.js
test/billing-ui-model.test.mjs

不得修改 AppContext、Modals、Pricing、任何 server 文件、API 服务或现有页面。
组件必须是纯展示组件，不得 fetch、读 localStorage 或操作路由。
BillingPriceBadge props: { units, currency, compact=false }
BillingBalanceCard props: { ecommercePoints, contentSets, unlimited=false }
BillingQuoteBreakdown props: { items, totalUnits, currency }
BillingHistoryList props: { entries, emptyText='暂无积分记录' }
billingUiModel.js 导出 formatBillingUnits(units,currency)、formatLedgerEntry(entry)、getBillingTone(eventType)。
使用现有 design tokens，颜色克制，收费动作采用黑色细边框，余额不足使用暖黄色提示，不使用渐变大面积背景。
只运行 node --test --test-concurrency=1 test/billing-ui-model.test.mjs 和 npm run build。完成后提交并报告 commit hash，不要部署。
```

- [ ] **Step 2: Review the GLM commit before integration**

Check for write-scope violations:

Run: `git diff --name-only <base>..<glm-commit>`

Expected: exactly the seven allowed files.

- [ ] **Step 3: Integrate by cherry-pick only after tests pass**

Run the focused test and build. Reject inline business logic or inconsistent copy before cherry-pick.

### Task 2: Frontend billing API and entitlement state

**Files:**
- Create: `src/services/billing.js`
- Modify: `src/store/entitlementState.js`
- Modify: `src/store/AppContext.jsx`
- Test: `test/billing-client.test.mjs`
- Test: `test/entitlement-state.test.mjs`

**Interfaces:**
- Produces: `fetchBillingCatalog`, `fetchBillingBalance`, `quoteBillingAction`, `createBillingOrder`, `fetchBillingLedger`.

- [ ] **Step 1: Write failing client tests**

Mock fetch and verify session email is sent, non-2xx responses use `createApiError`, and `normalizeEntitlement` returns separate `ecPoints`, `contentSets`, and `unlimited`.

```js
assert.deepEqual(normalizeEntitlement({ balances: { ec_points: 105000, content_sets: 10 }, unlimited: false }), { ecPoints: 105, contentSets: 10, unlimited: false });
```

- [ ] **Step 2: Implement the client**

```js
export async function quoteBillingAction(input) {
  return requestJson('/api/billing/quote', { method: 'POST', body: JSON.stringify(withSessionEmail(input)) });
}
```

AppContext stores `ecPoints`, `contentSets`, `billingCatalog`, `billingLedger`, and `pendingPaidAction`, while keeping a temporary `credits` compatibility selector until all pages migrate.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/billing-client.test.mjs test/entitlement-state.test.mjs`

Commit only the client, state, and tests.

### Task 3: Serializable pending action and resumable insufficient-balance modal

**Files:**
- Create: `src/utils/pendingPaidAction.js`
- Create: `src/components/billing/InsufficientBalanceModal.jsx`
- Modify: `src/components/business/Modals.jsx`
- Test: `test/pending-paid-action.test.mjs`
- Test: `test/generation-access.test.mjs`

**Interfaces:**
- Produces: `createPendingPaidAction`, `savePendingPaidAction`, `loadPendingPaidAction`, `clearPendingPaidAction`.

- [ ] **Step 1: Write tests**

Test serialization of route, source, draft ID, action payload, and quote ID without File objects or Base64 blobs. Test expiration after 24 hours and user mismatch rejection.

- [ ] **Step 2: Implement pending action storage**

```js
export function createPendingPaidAction({ ownerEmail, source, draftId, action, quoteId }) {
  return { version: 1, ownerEmail, source, draftId, action, quoteId, createdAt: Date.now() };
}
```

Files stay in the draft asset store; the pending action references asset IDs only.

- [ ] **Step 3: Implement modal behavior**

Show action cost, balance, shortfall, package recommendations, preserved-work message, disabled payment state, and “继续刚才的操作” after balance changes. Closing only hides the modal.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/pending-paid-action.test.mjs test/generation-access.test.mjs`

Commit the modal integration.

### Task 4: Honest pricing page and secure order creation

**Files:**
- Modify: `src/constants/data.js`
- Modify: `src/pages/Pricing/index.jsx`
- Modify: `src/components/business/Modals.jsx`
- Test: `test/pricing-catalog.test.mjs`

- [ ] **Step 1: Write pricing tests**

Assert ecommerce cards are 9.9/30, 29/105, 79/295, 199/760; Xiaohongshu cards remain unchanged; order creation sends only `productSku` and provider; no active payment button renders when catalog providers are disabled.

- [ ] **Step 2: Replace static trusted prices with server catalog rendering**

Static constants may provide fallback copy only. Order payload:

```js
{ productSku: selected.sku, provider: selectedProvider, idempotencyKey: crypto.randomUUID() }
```

Remove the client-supplied `amount` and `sets` fields and remove the false “Stripe supports Alipay/WeChat” copy.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/pricing-catalog.test.mjs test/api-contract.test.mjs`

Commit pricing changes.

### Task 5: Ecommerce original assets, live quote, and durable job progress

**Files:**
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/services/api.js`
- Test: `test/ecommerce-upload-contract.test.mjs`
- Test: `test/ecommerce-billing-ui.test.mjs`

- [ ] **Step 1: Write tests that forbid the 800px JPEG production path**

Read `EcMode.jsx` and assert formal generation uploads original files through `/api/ecommerce/assets`; preview compression may remain UI-only. Assert `customColors`, `sizing`, selected direction, and asset IDs reach the create-job request.

- [ ] **Step 2: Implement asset upload and quote updates**

On every Asset Plan change call `quoteBillingAction({ action: 'ecommerce_generate', items })`. Display `生成 N 张 · M 积分`. Do not generate direction images unless the user explicitly requests a 1K visual preview.

- [ ] **Step 3: Implement durable progress**

After `202`, poll `/api/ecommerce/jobs/:id` or subscribe to SSE. Render each asset as queued, generating, quality checking, repairing, completed, or needs review. Completed images become usable immediately.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs`

Commit ecommerce frontend changes.

### Task 6: Xiaohongshu and both Plog entrypoints use content sets

**Files:**
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Modify: `src/utils/generationAccess.js`
- Test: `test/content-entitlement-ui.test.mjs`

- [ ] **Step 1: Write tests**

Assert no page directly subtracts `credits - 1`; both Plog entrypoints handle authoritative SSE billing; free trial state does not come from localStorage; paywall currency is `content_sets`.

- [ ] **Step 2: Remove client-side deduction**

Replace:

```js
dispatch({ type: 'SET_CREDITS', credits: credits - 1, unlimited: false });
```

with authoritative balance refresh from the complete event or `/api/billing/balance`.

- [ ] **Step 3: Preserve forms through paywall**

Persist text, reference asset ID, Plog style, layout, and cover variant in the draft store; pass only `draftId` in `pendingPaidAction`.

- [ ] **Step 4: Run tests and commit**

Run: `node --test --test-concurrency=1 test/content-entitlement-ui.test.mjs test/generation-access.test.mjs test/api-contract.test.mjs`

Commit content UI changes.

### Task 7: Canvas and studio billing quotes

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcStudio/index.jsx`
- Test: `test/canvas-billing.test.mjs`

- [ ] **Step 1: Write action-price tests**

Map canvas actions: deterministic operations free; reverse prompt 0.2; remove background 0.5; 2K remix 1; 4K output 2; PSD layers disabled until catalog enables it.

- [ ] **Step 2: Add price badges and quotes**

Every paid node action requests a quote before submission. Free actions bypass billing. Hidden/unavailable providers render disabled with a clear explanation, not a fake success.

- [ ] **Step 3: Run tests and commit**

Run: `node --test --test-concurrency=1 test/canvas-billing.test.mjs test/canvas-tools.test.mjs test/ec-canvas-state.test.mjs`

Commit canvas/studio integration.

### Task 8: Full frontend QA and visual consistency

**Files:**
- Modify only files required by failures.

- [ ] **Step 1: Run unit tests and build**

Run: `npm run test`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Browser QA matrix**

Verify at desktop and narrow widths:

1. Ecommerce quote updates with image count and 4K selection.
2. Insufficient balance modal preserves the full draft.
3. Owner account shows “无限内测” and shadow usage remains server-side.
4. Xiaohongshu and Plog each settle one set only after complete delivery.
5. Payment disabled state has no active Alipay/WeChat buttons.
6. Ledger distinguishes purchase, grant, hold, settle, release, and refund.
7. Canvas action badges match the server quote.

- [ ] **Step 3: Commit QA fixes**

Stage only intentional source/test files and commit `test: verify paid workflow user experience`.

### Task 9: Production-safe deployment and canary

**Files:**
- Modify: `scripts/deploy-production.ps1`
- Create: `scripts/verify-production-billing.ps1`
- Test: `test/deploy-script.test.mjs`

- [ ] **Step 1: Write deployment script tests**

Assert runtime databases are excluded, a database backup is taken before restart, migrations run once, health checks include billing catalog, and rollback restores code without overwriting the migrated runtime DB.

- [ ] **Step 2: Harden deployment**

Add preflight checks:

```powershell
npm run test
npm run build
git diff --check
```

Remote sequence: backup DB with SQLite backup command, unpack release, run migration/health command, restart PM2 once, verify local health, verify HTTPS, then canary owner account.

- [ ] **Step 3: Create production verification script**

The script must verify:

- `https://shuimg.cn` returns 200.
- `/health` reports database and queue ready.
- `/api/billing/catalog` exposes enabled products but disabled payment providers.
- Owner account balance reports unlimited.
- A zero-cost quote works without mutation.
- PM2 restart count does not increase during a ten-minute canary.

- [ ] **Step 4: Run local verification and commit**

Run: `node --test --test-concurrency=1 test/deploy-script.test.mjs`

Run: `npm run test && npm run build`

Commit deployment scripts.

### Task 10: Deploy, real-generation acceptance, and handoff

- [ ] **Step 1: Inspect the exact release commit**

Confirm the worktree is clean except known ignored runtime files and record `git rev-parse HEAD`.

- [ ] **Step 2: Deploy with `scripts/deploy-production.ps1`**

Use the configured SSH key, server `43.129.180.134`, remote `/home/ubuntu/shubao`, and web root `/var/www/shubao/assets`.

- [ ] **Step 3: Execute real acceptance**

With the owner account, generate one 2K ecommerce representative image, one four-image same-style batch, one Xiaohongshu set, and one Plog set. Verify stable works/canvas URLs, billing shadow events, no real debit, and restart recovery of one in-flight test job.

- [ ] **Step 4: Observe canary**

Watch PM2 logs, queue depth, provider 429/5xx/504, image persistence, billing holds, and release mismatches for at least ten minutes.

- [ ] **Step 5: Final report**

Report release commit, deployed URL, tests, real generation results, billing results, PM2 status, known disabled providers, and rollback location. Do not claim success if any required real generation or persistence check fails.
