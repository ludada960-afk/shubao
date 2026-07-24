# Ecommerce Canvas, Direction and Credits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the ecommerce canvas intuitive to pan and select, make design directions visibly selectable/editable without editable titles, provide correctly separated supplemental product/reference uploads, and support unlimited owner testing plus recoverable paywall interruptions.

**Architecture:** Keep pointer semantics and testable calculations in focused pure helpers, while EcCanvas owns React event wiring. Treat the owner account as a server-authoritative unlimited entitlement. Represent insufficient-credit interruptions as structured API errors and preserve the in-memory design draft while a global pricing overlay opens. Split supplemental uploads into product and reference collections instead of array parity.

**Tech Stack:** React 18, Node.js ESM, Express, SQLite, node:test, Vite.

## Global Constraints

- Work only in F:\da\shubao\.worktrees\codex-ecommerce-stability.
- Do not modify GLM-5.2's worktree or new component files.
- Preserve server/works.db, uploads, generated-assets and environment files.
- The email 867550189@qq.com is an unlimited closed-beta owner account.
- No production deployment until unit tests, build, browser regression and data-protection checks pass.

---

### Task 1: Canvas gesture contract

**Files:**
- Modify: src/pages/EcCanvas/canvasState.js
- Modify: src/pages/EcCanvas/index.jsx
- Test: test/ec-canvas-state.test.mjs

**Interfaces:**
- Produces: getCanvasPointerIntent(eventLike), canvasCursorForState(state), normalized wheel/pan behavior.

- [ ] Add failing tests proving plain left-drag on blank canvas means pan, Shift+drag means marquee, and node controls do not start canvas gestures.
- [ ] Run the focused test and confirm RED.
- [ ] Implement the pure pointer-intent helper and wire pointer handlers so blank drag pans by default.
- [ ] Add grab/grabbing/crosshair cursors and prevent accidental text selection.
- [ ] Verify focused and full tests.
- [ ] Browser-test pan, Shift marquee, node selection, and wheel zoom.

### Task 2: Unlimited owner entitlement

**Files:**
- Modify: server/accessPolicy.mjs
- Modify: server/index.mjs
- Test: test/access-policy.test.mjs

**Interfaces:**
- Produces: isUnlimitedBetaEmail(email), API payload { credits: null, unlimited: true }.

- [ ] Add failing tests for the owner unlimited entitlement and ordinary invited-account behavior.
- [ ] Run focused test and confirm RED.
- [ ] Bypass credit rejection and deduction for the owner on the server.
- [ ] Return unlimited metadata from /api/user/credits.
- [ ] Standardize insufficient-credit 402 payload with code INSUFFICIENT_CREDITS and resumeable true.
- [ ] Verify server syntax and full tests.

### Task 3: Recoverable pricing interruption

**Files:**
- Modify: src/services/api.js
- Modify: src/store/AppContext.jsx
- Modify: src/components/business/Modals.jsx
- Modify: src/pages/Home/ec/DesignDirection.jsx
- Test: test/ecommerce-routing.test.mjs or a new focused state test.

**Interfaces:**
- Produces: ApiError(status, code, payload), state.pendingPaidAction, OPEN_PAYWALL/CLEAR_PAYWALL actions.

- [ ] Add failing tests for classifying HTTP 402 and preserving pending generation context.
- [ ] Implement structured API errors without changing successful generation behavior.
- [ ] Add unlimited and pending-paid-action fields to global state.
- [ ] Open PricingModal from DesignDirection on 402 without clearing directions, selected option, uploads or text.
- [ ] Make the modal explain that the current draft is preserved and expose a continue callback after credits refresh.
- [ ] Do not auto-repeat a request after payment; require an explicit Continue generation action.
- [ ] Verify tests and build.

### Task 4: Design-direction interaction and supplemental data model

**Files:**
- Modify: src/pages/Home/ec/DesignDirection.jsx
- Test: test/ecommerce-workbench-state.test.mjs or a new design-direction model test.

**Interfaces:**
- Consumes future GLM leaf components only after review; current implementation must remain complete without them.
- Produces: fixed titles, editable descriptions, strong selected state, extraProductImages and extraReferenceImages.

- [ ] Add failing tests for independent product/reference additions and stable direction titles.
- [ ] Replace editable title input with static heading.
- [ ] Add explicit editable-description affordance and helper text.
- [ ] Make tags display-only with readable colors independent of selection theme.
- [ ] Strengthen selected state with border, tint, checkmark and selected label.
- [ ] Split extraImages into extraProductImages and extraReferenceImages with separate file inputs.
- [ ] Reuse the first-step upload-card visual language, horizontal rails, next empty card and optional reference badge.
- [ ] Send product additions to realShots and reference additions to refImgs.
- [ ] Preserve inherited first-step images separately from removable new additions.
- [ ] Verify keyboard/accessibility behavior and responsive overflow.

### Task 5: Full verification and deployment

**Files:**
- No new production files unless a regression demands a focused fix.

- [ ] Run npm test, npm run check, npm run verify, npm run build and node --check server/index.mjs.
- [ ] Inspect git diff and ensure no runtime data is staged.
- [ ] Commit only intentional source/tests/plan files.
- [ ] Record production works.db hash, uploads count and generated-assets count.
- [ ] Deploy through scripts/deploy-production.ps1 from the isolated worktree.
- [ ] Verify PM2, Nginx, 80/443/3001, /health and SPA pages.
- [ ] Browser-test direction editing/selection, supplemental rails, canvas pan/zoom and pricing preservation.
- [ ] Verify owner generation is not blocked by credits and ordinary unauthenticated requests remain blocked.
- [ ] Confirm production data hashes/counts remain protected.
