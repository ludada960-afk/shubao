# E-commerce Workbench Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current e-commerce generation entry screen with a compact Xiaohongshu-consistent workbench, make output assets durable, and remove canvas/result routing regressions.

**Architecture:** The new workbench keeps one source of truth for the generation brief and uses compact command controls instead of independently-mutating panels. The server persists every completed output to a managed asset directory before emitting it, then saves the stable URLs in the existing SQLite-backed task/work record. Canvas and home routing treat e-commerce results as sessions, never as a generic NoteModal.

**Tech Stack:** React 18, Vite, Express, better-sqlite3, Sharp, Node test runner.

## Global Constraints

- Work only in `F:\da\shubao\.worktrees\codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Do not change unrelated generated `dist/` files or `server/works.db` runtime state.
- Reuse the Xiaohongshu `hero-textarea-*` and `ref-*` interaction vocabulary; do not create a parallel upload style.
- Product photos are guided to 3–5 useful angles; references are horizontally scrollable and may be uploaded in bulk.
- SKU is an independently configurable data matrix; package changes may suggest SKU output but never erase a user’s SKU data.
- Persist generated output immediately; never save expiring upstream URLs as the only work asset.
- Test each new behavior red → green before production implementation.

---

### Task 1: Deterministic workbench state and package reconciliation

**Files:**
- Create: `src/pages/Home/ec/workbenchState.js`
- Test: `test/ecommerce-workbench-state.test.mjs`
- Modify: `src/pages/Home/EcMode.jsx`

**Interfaces:**
- Produces `createWorkbenchState()`, `nextProductSlot(count)`, `reconcilePackage({ baseline, draft, applied })`, and `summarizePackage(packagePlan)`.
- Consumes product and reference arrays from `EcMode`.

- [ ] **Step 1: Write the failing state tests**

```js
assert.equal(nextProductSlot(0).key, 'front');
assert.equal(nextProductSlot(3).key, 'detail');
assert.deepEqual(reconcilePackage({ baseline, draft: ['main'], applied: ['main', 'sku'] }), ['main']);
```

- [ ] **Step 2: Run the test and verify it fails because the module is absent**

Run: `node --test test/ecommerce-workbench-state.test.mjs`

- [ ] **Step 3: Implement the pure helpers and wire them into EcMode state**

```js
export const PRODUCT_SLOT_PLAN = [
  { key: 'front', label: '产品图', hint: '正面主视图' },
  { key: 'angle', label: '补充图', hint: '45° 侧面图' },
  { key: 'back', label: '补充图', hint: '背面或俯视图' },
  { key: 'detail', label: '补充图', hint: '材质或工艺细节' },
  { key: 'scale', label: '补充图', hint: '使用尺度或场景图' },
];
```

- [ ] **Step 4: Re-run the test and verify it passes**

Run: `node --test test/ecommerce-workbench-state.test.mjs`

### Task 2: Compact Xiaohongshu-consistent upload workbench

**Files:**
- Create: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/Home.css`

**Interfaces:**
- Consumes `{ productImages, refImages, description, onProductUpload, onReferenceUpload, onRemoveProduct, onRemoveReference }`.
- Produces the compact upload deck and a horizontal media rail; it does not own generation state.

- [ ] **Step 1: Write the failing state-level test for the first empty product/reference cards and append behavior**
- [ ] **Step 2: Run the state test and verify the missing workbench behavior fails**
- [ ] **Step 3: Implement `EcommerceWorkbench` using the existing `hero-textarea-wrap`, `ref-thumb`, `ref-remove`, and `ref-add` classes**

```jsx
<div className="ec-upload-deck">
  <UploadCard tilt="right" role="product" slot={nextProductSlot(productImages.length)} />
  <span className="ec-upload-operator">×</span>
  <UploadCard tilt="left" role="reference" />
</div>
<MediaRail aria-label="已上传图片" items={[...productImages, ...refImages]} />
<div className="hero-textarea-wrap ec-brief-input">...</div>
```

- [ ] **Step 4: Keep the existing 3-step orchestration but remove the large, duplicated upload cards and step banner from the primary viewport**
- [ ] **Step 5: Run state tests and `npm run build`**

### Task 3: Unified command bar and reversible package/SKU behavior

**Files:**
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/SizingPanel.jsx`
- Modify: `src/pages/Home/ec/SkuPanel.jsx`
- Modify: `src/pages/Home/ec/GenSettingsPanel.jsx`
- Test: `test/ecommerce-workbench-state.test.mjs`

**Interfaces:**
- Command bar controls: `套图方案`, `商品信息`, `视觉方向`, `SKU 规格`, `生成设置`.
- `packagePlan` is the applied output plan. A cancelled or reverted package draft restores the AI baseline exactly.

- [ ] **Step 1: Write failing tests for revert-to-baseline and independent SKU retention**
- [ ] **Step 2: Run tests and verify expected failure**
- [ ] **Step 3: Replace six ambiguous buttons with five task-named controls and one shared bottom sheet**
- [ ] **Step 4: Make SKU available regardless of output-plan selection; use package selection only to suggest SKU deliverables**
- [ ] **Step 5: Add an explicit “恢复智能方案” action that resets package draft without altering user SKU rows**
- [ ] **Step 6: Re-run tests and build**

### Task 4: Durable generated asset storage and stable work records

**Files:**
- Create: `server/generatedAssets.mjs`
- Modify: `server/index.mjs`
- Modify: `server/db.mjs`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/generated-assets.test.mjs`

**Interfaces:**
- `persistGeneratedImage({ sourceUrl, taskId, label, fetchImpl }) -> { id, url, contentType }`.
- Stable asset URL is `/api/generated-assets/:id`; completed ecommerce `images` only contain stable URLs.
- Legacy proxy URLs are displayed through proxy fallback but marked unavailable only when the source is genuinely expired.

- [ ] **Step 1: Write failing tests that persist a fetched image and reject unsafe or failed sources without creating a record**
- [ ] **Step 2: Run `node --test test/generated-assets.test.mjs` and verify failure**
- [ ] **Step 3: Implement managed asset persistence using hashed filenames beneath `server/generated-assets`, bounded size, MIME validation, and read-only asset route**
- [ ] **Step 4: Persist each ecommerce image before it is emitted over SSE and include stable URLs in task completion data**
- [ ] **Step 5: Extend SQLite works with ecommerce metadata / owner / image payload fields, preserving old rows through a migration check**
- [ ] **Step 6: Save the stable payload from `DesignDirection`; proxy canvas thumbnails consistently and show a recoverable legacy-expired state**
- [ ] **Step 7: Re-run generated-asset and existing persistence tests**

### Task 5: Canvas return and result-routing regression fix

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/ecommerce-routing.test.mjs`

**Interfaces:**
- `shouldShowNoteModal({ page, result })` returns `false` for every `_ecResult`, including after navigation from canvas to home.
- E-commerce result remains accessible through the canvas/session entry, not a generic homepage modal.

- [ ] **Step 1: Write failing routing tests for home, canvas, and ordinary content results**
- [ ] **Step 2: Run tests and verify the e-commerce-home case fails**
- [ ] **Step 3: Extract and use `shouldShowNoteModal`; retain normal NoteModal behavior for non-ecommerce results**
- [ ] **Step 4: Re-run routing tests and build**

### Task 6: Integration verification and deployment package

**Files:**
- Modify: `docs/architecture/ecommerce-stability.md`
- Test: all `test/*.test.mjs`

- [ ] **Step 1: Run the full Node test suite, `npm run verify`, `npm run build`, and `npm run check`**
- [ ] **Step 2: Inspect the diff, exclude runtime/database/build artifacts, and commit source/documentation changes**
- [ ] **Step 3: Build the release archive from verified output and deploy with a timestamped rollback backup**
- [ ] **Step 4: Verify HTTPS, health, beta access rejection, e-commerce task creation, and stable asset response on the server**
- [ ] **Step 5: Record the live release and rollback location in the architecture document**

## Coverage Review

- Compact product/reference cards, horizontal scrolling, guided product angles: Tasks 1–2.
- Xiaohongshu consistency and compact prompt/composer layout: Task 2.
- Product-manager-level task naming, SKU independence, reversible smart plan: Task 3.
- Broken works and failed image loading: Task 4.
- Canvas-to-home modal regression: Task 5.
- Build, server health, and deployment verification: Task 6.
