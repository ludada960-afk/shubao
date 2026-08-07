# Global Entitlement Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the signed-in account's authoritative AI credit balance and purchase entry consistently on the homepage and infinite canvas.

**Architecture:** Add a pure entitlement-display model and one reusable account control. Keep `AppContext.refreshBillingBalance` as the only balance source, extend it with guarded refresh-state reporting, then compose the same control into the non-canvas `TopBar` and `CanvasTopBar`.

**Tech Stack:** React 18, lucide-react, existing AppContext billing service, Vite 6, Node test runner.

## Global Constraints

- Balance values only come from the server-authoritative entitlement response.
- No client-side deduction, local balance cache, price change, or billing-state mutation is introduced.
- `ecPoints` is the shared AI-credit display for ecommerce, content, and canvas actions.
- Unlimited access is a separate label, never numeric zero.
- User-owned deleted extension-task files, `.tmp/`, and the diagnosis helper remain untouched.
- Production deployment only uses `scripts/deploy-production.ps1`.

---

### Task 1: Shared Account Entitlement Model and Control

**Files:**
- Create: `src/components/billing/accountEntitlementModel.js`
- Create: `src/components/billing/AccountEntitlementControl.jsx`
- Modify: `src/store/AppContext.jsx`
- Test: `test/account-entitlement-model.test.mjs`
- Test: `test/account-entitlement-control-contract.test.mjs`

**Interfaces:**
- Produces `accountEntitlementDisplay({ logged, ecPoints, unlimited, refreshStatus })`, returning `{ value, label, state }` where `state` is `signed-out`, `ready`, `refreshing`, `error`, or `unlimited`.
- Produces `AccountEntitlementControl({ logged, ecPoints, unlimited, refreshStatus, onRefresh, onPurchase, onLogin, compact })`.
- Extends `AppContext` state with `balanceRefreshStatus` and `balanceRefreshError`; `refreshBillingBalance()` sets `refreshing`, then only the current session epoch may set `ready` or `error`.

- [ ] **Step 1: Write failing display-model tests**

Create `test/account-entitlement-model.test.mjs` with assertions that a signed-in numeric balance produces `12 AI 积分`, unlimited produces `无限额度`, signed-out produces `登录后查看额度`, and `refreshing` preserves the supplied numeric value rather than replacing it with zero.

- [ ] **Step 2: Run the model test and confirm RED**

Run: `node --test --test-concurrency=1 test/account-entitlement-model.test.mjs`

Expected: FAIL because `accountEntitlementModel.js` does not exist.

- [ ] **Step 3: Implement the pure display model**

Add `accountEntitlementDisplay` with these exact branches:

```js
if (!logged) return { value: '登录后查看额度', label: '账户额度', state: 'signed-out' };
if (unlimited) return { value: '无限额度', label: 'AI 积分', state: 'unlimited' };
return {
  value: `${Number.isFinite(Number(ecPoints)) ? Number(ecPoints) : 0} AI 积分`,
  label: '账户额度',
  state: refreshStatus === 'refreshing' ? 'refreshing' : refreshStatus === 'error' ? 'error' : 'ready',
};
```

- [ ] **Step 4: Write failing component and AppContext contract tests**

Create `test/account-entitlement-control-contract.test.mjs` that reads the component and AppContext sources. Assert the component exposes `aria-label="刷新账户额度"`, `购买额度`, and `登录后查看额度`; assert `refreshBillingBalance` dispatches pending, success, and error balance-refresh states only after `sessionRequestGate.isCurrent` accepts the response.

- [ ] **Step 5: Run the contract tests and confirm RED**

Run: `node --test --test-concurrency=1 test/account-entitlement-control-contract.test.mjs test/entitlement-state.test.mjs`

Expected: FAIL because the shared component and balance-refresh state do not exist.

- [ ] **Step 6: Implement the shared control and guarded refresh state**

Create the control with `Coins`, `RefreshCw`, and `Plus` icons. The whole value area invokes `onLogin` when signed out; signed-in state renders the model value and a compact refresh icon button; `购买额度` invokes `onPurchase`. Use `title` and `aria-label` for icon actions. In `AppContext`, keep the previous `ecPoints` on refresh start/error, clear the error after a current successful response, and reset refresh state on logout.

- [ ] **Step 7: Run focused tests**

Run: `node --test --test-concurrency=1 test/account-entitlement-model.test.mjs test/account-entitlement-control-contract.test.mjs test/entitlement-state.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/components/billing/accountEntitlementModel.js src/components/billing/AccountEntitlementControl.jsx src/store/AppContext.jsx test/account-entitlement-model.test.mjs test/account-entitlement-control-contract.test.mjs
git commit -m "feat: add authoritative account credit control"
```

### Task 2: Homepage and Canvas Shell Integration

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Test: `test/global-entitlement-ui-contract.test.mjs`
- Test: `test/canvas-ui-contract.test.mjs`

**Interfaces:**
- `TopBar` and `CanvasTopBar` render `AccountEntitlementControl` with the same `AppContext` fields and callback behavior.
- `CanvasTopBar` accepts `entitlement` and forwards it to the compact control beside existing export and new-generation commands.
- `EcCanvas` passes `logged`, `ecPoints`, `unlimited`, `balanceRefreshStatus`, `refreshBillingBalance`, login dispatch, and pricing dispatch to `CanvasTopBar`.

- [ ] **Step 1: Write failing shell contract tests**

Create `test/global-entitlement-ui-contract.test.mjs` asserting `src/App.jsx` imports and renders `AccountEntitlementControl`, forwards `refreshBillingBalance`, opens `SHOW_PRICE`, and no longer presents a standalone `套餐` command. Assert the canvas source imports the same control path through `CanvasChrome` and passes the account fields to `CanvasTopBar`.

Add assertions to `test/canvas-ui-contract.test.mjs` that the topbar contains `账户额度`, `购买额度`, and the existing `导出整套图片` command.

- [ ] **Step 2: Run the shell tests and confirm RED**

Run: `node --test --test-concurrency=1 test/global-entitlement-ui-contract.test.mjs test/canvas-ui-contract.test.mjs`

Expected: FAIL because neither shell renders the shared control.

- [ ] **Step 3: Integrate the homepage/application shell**

In `TopBar`, replace the standalone package button with the shared control. Use `refreshBillingBalance` rather than legacy `fetchCredits`; request a refresh after the signed-in header mounts and whenever the document becomes visible. The control opens the existing pricing modal and login modal via `dispatch`.

- [ ] **Step 4: Integrate the canvas shell**

Read account state and `refreshBillingBalance` in `EcCanvas`, refresh on signed-in canvas entry, and pass a compact entitlement object plus callbacks to `CanvasTopBar`. Render the compact shared control before export, preserving the export, restore, and new-generation actions.

- [ ] **Step 5: Add responsive canvas styling**

Give the account control a stable compact width and allow topbar actions to wrap into orderly rows on narrow screens. At `390px`, retain an accessible balance value, purchase command, export command, and new-generation command without horizontal overflow or overlap.

- [ ] **Step 6: Run focused tests and production build**

Run: `node --test --test-concurrency=1 test/account-entitlement-model.test.mjs test/account-entitlement-control-contract.test.mjs test/global-entitlement-ui-contract.test.mjs test/canvas-ui-contract.test.mjs test/entitlement-state.test.mjs`

Run: `npm run build`

Expected: all focused tests pass and Vite production build succeeds.

- [ ] **Step 7: Browser acceptance**

Run the local browser fixture at `1440x1000` and `390x844`. Verify signed-in balance visibility, refresh affordance, purchase modal opening, canvas controls remaining reachable, and no horizontal overflow or console errors.

- [ ] **Step 8: Commit**

```powershell
git add src/App.jsx src/pages/EcCanvas/components/CanvasChrome.jsx src/pages/EcCanvas/index.jsx src/pages/EcCanvas/EcCanvas.css test/global-entitlement-ui-contract.test.mjs test/canvas-ui-contract.test.mjs
git commit -m "feat: show account credits across creative workspaces"
```

### Task 3: Release Evidence

**Files:**
- Modify: `RTK.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Records the deployed commit, test totals, desktop/mobile browser evidence, production health, authenticated billing verification, ecommerce canary result, PM2 PID, public audit, and known user-owned dirty files.

- [ ] **Step 1: Run complete release checks**

Run: `npm test`

Run: `npm run build`

Run: `npm run check`

Run: `npm run collab:check`

Run: `git diff --check`

Expected: all pass before deployment.

- [ ] **Step 2: Deploy through the required release gate**

Run: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`

Expected: backups, health, billing, two authenticated ecommerce checks, Canary, and lock release pass. Stop and preserve the rollback result on any failed gate.

- [ ] **Step 3: Record evidence and commit documentation**

Append exact release evidence and remaining user-owned dirty files to `RTK.md` and `.superpowers/sdd/progress.md`.

```powershell
git add RTK.md .superpowers/sdd/progress.md
git commit -m "docs: record global entitlement release"
```
