# 小红书图文与 Plog 工作台重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage XHS and Plog workbench share the ecommerce workbench structure while preserving the real Xiamen nine-image publish case and existing generation contracts.

**Architecture:** Keep generation state and API calls in `XhsContentMode.jsx`, but replace the compact surface composition with a shared mode selector, mode-aware showcase, and one reusable composer template. `CreationShowcase` owns only showcase content and publish preview behavior; CSS owns the fan cards, workbench spacing, and upward panels. Existing `SupplementAssetDeck` remains the upload primitive and its ecommerce defaults remain unchanged.

**Tech Stack:** React 18, Vite, CSS, Node `node:test`, existing Lucide/React Icons components.

## Global Constraints

- Do not alter the independent `/plog` page.
- Do not call production image generation, mutate billing, create real generation tasks, or depend on production state during verification.
- Keep existing XHS/Plog generation, upload, save, billing, draft, mention-picker, and `NoteModal` contracts.
- Preserve the real Xiamen nine-image case and complete title/body/tags preview.
- Keep ecommerce `SupplementAssetDeck` default behavior unchanged.

---

### Task 1: Lock the new workbench contract

**Files:**
- Modify: `test/xhs-workbench-ui.test.mjs`
- Modify: `test/xhs-showcase-ui.test.mjs`

**Interfaces:**
- Produces source contracts for `.xhs-mode-selector`, `.xhs-mode-card`, `.xhs-mode-fan`, `.xhs-workbench-card`, and the removal of showcase-internal mode tabs.

- [ ] **Step 1: Write the failing tests**

Add assertions that `XhsContentMode.jsx` contains the shared mode selector and mode-aware `CreationShowcase`, that the selector uses `aria-selected`, and that `CreationShowcase.jsx` no longer contains `creation-showcase-content-tabs`. Add CSS assertions for the fan-card rules and upward panel arrow.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `node --test test/xhs-workbench-ui.test.mjs test/xhs-showcase-ui.test.mjs`

Expected: FAIL because the current source still renders `.xhs-mode-tabs` and the showcase still owns its own case tabs.

### Task 2: Rebuild the XHS/Plog showcase and selector

**Files:**
- Modify: `src/pages/Home/CreationShowcase.jsx`
- Modify: `src/pages/Home/CreationShowcase.css`
- Modify: `src/pages/Home/XhsContentMode.jsx`

**Interfaces:**
- `CreationShowcase({ mode: 'content', subMode, entry })` renders one active showcase: the Xiamen case for `content`, the explicit empty case for `plog`.
- `XhsModeSelector({ value, onChange, contentImages })` renders two accessible mode cards and uses the case images only for the content fan.

- [ ] **Step 1: Implement the showcase mode boundary**

Remove `caseIndex` and the showcase-internal tab list. Select the existing Xiamen case when `subMode !== 'plog'` and the existing empty Plog case when `subMode === 'plog'`. Keep `XhsPublishPreview`, `ContentPreview`, and all full-body data paths intact.

- [ ] **Step 2: Implement the selector**

Add `XhsModeSelector` near the compact surface. Use the first three `buildXhsPublishPages` images for the content fan, render a stable `案例暂未入库` card for Plog, and call `setXhsSubMode` on card click. Use `button`, `role="tab"`, and `aria-selected`.

- [ ] **Step 3: Render selector before showcase and remove duplicate tabs**

In `compactMode`, render `XhsModeSelector`, then `CreationShowcase mode="content" subMode={xhsSubMode}`, then the composer card. Keep the two existing `XhsInputTemplate` branches and generation callbacks unchanged.

- [ ] **Step 4: Add responsive fan-card styles**

Use a two-column selector on desktop, with each card containing a fixed preview rail and text. The content preview rail uses three overlapping cards with `rotate(-7deg)`, `rotate(0deg)`, and `rotate(7deg)`; the Plog rail uses one dashed empty card. At `760px`, selector cards remain stable and stack without horizontal overflow.

- [ ] **Step 5: Run focused showcase tests**

Run: `node --test test/xhs-workbench-ui.test.mjs test/xhs-showcase-ui.test.mjs`

Expected: PASS.

### Task 3: Align the composer with ecommerce workbench controls

**Files:**
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Home/CreationShowcase.css`
- Modify: `src/pages/Home/Home.css`

**Interfaces:**
- `XhsInputTemplate` keeps its existing props and generation callback contract.
- The bottom toolbar uses `.ec-config-trigger`, `.ec-workbench-primary-row`, and `.xhs-template-options--upward` without ecommerce-only labels.

- [ ] **Step 1: Replace the compact card shell**

Rename the outer compact composer class to `.xhs-workbench-card`, keep the existing active-mode input branch, and remove the old `.xhs-mode-tabs` markup.

- [ ] **Step 2: Keep shared asset deck behavior and localize labels**

Keep `XhsSupplementDeck` as the only upload path. Use `我的素材/风格参考` for content and `生活素材/风格参考` for Plog, with existing max counts and mention picker behavior.

- [ ] **Step 3: Normalize upward option panels**

Keep the panel in the option slot with `bottom: calc(100% + 10px)`. Add a visible upward connector triangle and change the trigger icon to `ChevronUp` while the panel is open. Do not introduce a separate downward panel path.

- [ ] **Step 4: Add desktop/mobile composer styles**

Make the workbench a continuous white surface with the ecommerce spacing rhythm. Keep the text area and upload deck inside one bordered composer. On mobile, stack the upload deck, prompt, options, and generate button while preserving readable text and no overflow.

- [ ] **Step 5: Run focused UI contracts**

Run: `node --test test/xhs-workbench-ui.test.mjs test/xhs-showcase-ui.test.mjs test/content-reference-picker-ui.test.mjs test/image-mention-surfaces.test.mjs`

Expected: PASS.

### Task 4: Verify build and local visual behavior

**Files:**
- Modify: none unless verification exposes a regression.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all tests pass with no production-provider calls.

- [ ] **Step 2: Run build checks**

Run: `npm run build` and `npm run check`

Expected: Vite build and export/build checks pass.

- [ ] **Step 3: Start a local Vite server and inspect both modes**

Run: `npm run dev -- --host 127.0.0.1`

Inspect the homepage at desktop and 390px widths. Confirm top selector, fan cards, Xiamen content, Plog empty state, upload cards, upward panel arrow, and no horizontal overflow. Stop the local process after capture.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check` and `git status --short`.

Expected: only the XHS/Plog source, tests, CSS, and the plan/spec changes are attributable to this task; existing user-owned changes remain untouched.
