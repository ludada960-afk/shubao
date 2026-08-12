# Production Case and Canvas Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cropped placeholder showcases with traceable production-generated cases, correct Canvas layer semantics and interactions, and make per-generation revenue/cost/profit understandable in admin.

**Architecture:** Keep generated case metadata in focused model modules and let existing React workbenches render that data. Correct Canvas behavior first in pure functions, then bind UI state to those contracts. Build unit-economics rows from the authoritative billing catalog rather than duplicating prices in the admin page.

**Tech Stack:** React 18, Vite 6, Node test runner, Express billing catalog, CSS, production generation APIs.

## Global Constraints

- Real anything-tryon and free-creation showcase assets must be created through the ShuBao production image pipeline.
- One initial real task per case; retry the same request key only after verifying no duplicate settlement.
- Existing provider images must not trigger a second automatic provider call.
- Do not run real video generation.
- Deploy only with `scripts/deploy-production.ps1`.
- Never stage the 12 `server/extension_tasks/*.json` deletions, `.tmp/`, or `scripts/diagnose-recent-ecommerce-jobs.cjs`.

---

### Task 1: Traceable Case Catalog and Workbench Showcases

**Files:**
- Create: `src/pages/Home/productionCaseCatalog.js`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/ec/ParamsPanel.jsx`
- Modify: `src/pages/Home/Home.css`
- Modify: `src/pages/Home/visualCreationModel.js`
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`
- Test: `test/production-case-catalog.test.mjs`
- Test: `test/ecommerce-ability-ui-contract.test.mjs`
- Test: `test/visual-creation-ui.test.mjs`

**Interfaces:**
- Produces: `PRODUCTION_CASE_CATALOG`, `productionCaseById(id)`, and normalized case assets with `src`, `label`, `ratio`, `taskId`, `requestKey`, `intent`, and `status`.
- Consumes: stable `/images/...` assets downloaded only after successful production tasks.

- [ ] **Step 1: Write failing catalog and UI contracts**

```js
assert.equal(productionCaseById('tryon-reference').assets.length, 3);
assert.ok(productionCaseById('social-cover').assets.every(asset => asset.taskId && asset.requestKey));
assert.match(workbench, /ArrowLeft/);
assert.match(workbench, /ArrowRight/);
assert.doesNotMatch(paramsPanel, /type="checkbox"[\s\S]{0,200}preserveMaterial/);
assert.match(visualMode, /productionCaseById/);
```

- [ ] **Step 2: Run the focused tests and observe failure**

Run: `node --test test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/visual-creation-ui.test.mjs`

Expected: FAIL because the catalog and gallery navigation do not exist and try-on preservation is still optional.

- [ ] **Step 3: Implement the catalog, proportional cards, gallery keyboard navigation, mandatory advantages, and shared workbench language**

```js
export function productionCaseById(id) {
  const item = PRODUCTION_CASE_CATALOG.find(entry => entry.id === id);
  if (!item) throw new Error(`Unknown production case: ${id}`);
  return item;
}
```

The initial catalog may point at current local fixtures with `status: 'fixture'`; Task 6 replaces each fixture with a successful production asset and provenance before final release.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/visual-creation-ui.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/Home/productionCaseCatalog.js src/pages/Home/ec/EcommerceWorkbench.jsx src/pages/Home/ec/ParamsPanel.jsx src/pages/Home/Home.css src/pages/Home/visualCreationModel.js src/pages/Home/VisualCreationMode.jsx src/pages/Home/VisualCreationMode.css test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs test/visual-creation-ui.test.mjs
git commit -m "feat: rebuild production case showcases"
```

### Task 2: Canvas Layer Semantics and Natural Geometry

**Files:**
- Modify: `src/pages/EcCanvas/canvasLayerMaterialization.js`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/canvas-layer-materialization.test.mjs`
- Test: `test/canvas-studio-contract.test.mjs`
- Test: `test/ec-canvas-state.test.mjs`

**Interfaces:**
- Produces: virtual `layer-group` nodes without `url`, `assetId`, `ratio`, or inherited media fields.
- Produces: image nodes whose display geometry can be corrected after natural dimensions load.

- [ ] **Step 1: Change the existing layer test to require a virtual group**

```js
assert.equal(result.groupNode.kind, 'layer-group');
assert.equal(Object.hasOwn(result.groupNode, 'url'), false);
assert.equal(Object.hasOwn(result.groupNode, 'assetId'), false);
assert.equal(Object.hasOwn(result.groupNode, 'ratio'), false);
```

- [ ] **Step 2: Run the focused tests and observe failure**

Run: `node --test test/canvas-layer-materialization.test.mjs test/canvas-studio-contract.test.mjs test/ec-canvas-state.test.mjs`

Expected: FAIL because `groupNode` spreads all source image fields.

- [ ] **Step 3: Build the group from explicit relation fields and bind decoded natural geometry**

```js
const groupNode = {
  id: groupId,
  kind: 'layer-group',
  x: targetX,
  y: targetY,
  w: finite(sourceNode.w, 240),
  h: finite(sourceNode.h, 240),
  sourceNodeIds: [sourceId],
  layerChildIds: [],
  status: 'ready',
};
```

- [ ] **Step 4: Run focused tests**

Run: `node --test test/canvas-layer-materialization.test.mjs test/canvas-studio-contract.test.mjs test/ec-canvas-state.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/EcCanvas/canvasLayerMaterialization.js src/pages/EcCanvas/components/CanvasStudio.jsx src/pages/EcCanvas/index.jsx test/canvas-layer-materialization.test.mjs test/canvas-studio-contract.test.mjs test/ec-canvas-state.test.mjs
git commit -m "fix: correct canvas layer and image geometry"
```

### Task 3: Canvas Toolbar, Quick Derivation, and Focused Editors

**Files:**
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Modify: `src/pages/EcCanvas/canvasInlineEditorModel.js`
- Test: `test/canvas-studio-contract.test.mjs`
- Test: `test/canvas-tools.test.mjs`
- Test: `test/ec-canvas-state.test.mjs`

**Interfaces:**
- Produces: `isCompactCanvasToolbarAction(actionId)` for icon-only secondary actions.
- Produces: selection-driven `connectionPicker` state and move/scale drag options `{ scale, offsetX, offsetY, rotation }`.

- [ ] **Step 1: Add failing compact-toolbar, auto-menu, and drag-editor contracts**

```js
assert.match(toolbar, /isCompactCanvasToolbarAction/);
assert.match(page, /setConnectionPicker/);
assert.match(editor, /rotation/);
assert.match(editor, /onPointerDown/);
```

- [ ] **Step 2: Run focused tests and observe failure**

Run: `node --test test/canvas-studio-contract.test.mjs test/canvas-tools.test.mjs test/ec-canvas-state.test.mjs`

Expected: FAIL because all toolbar actions render labels and move/scale is input-only.

- [ ] **Step 3: Implement compact labels, tooltips, selected-node menu visibility, and direct manipulation**

```js
const LABELED_TOOLBAR_ACTIONS = new Set(['edit-text', 'grid-split', 'layer-edit', 'remove-background', 'move-scale', 'reverse-prompt', 'annotation']);
export const isCompactCanvasToolbarAction = id => !LABELED_TOOLBAR_ACTIONS.has(id);
```

- [ ] **Step 4: Run focused tests**

Run: `node --test test/canvas-studio-contract.test.mjs test/canvas-tools.test.mjs test/ec-canvas-state.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/EcCanvas/components/CanvasStudio.jsx src/pages/EcCanvas/index.jsx src/pages/EcCanvas/EcCanvas.css src/pages/EcCanvas/canvasInlineEditorModel.js test/canvas-studio-contract.test.mjs test/canvas-tools.test.mjs test/ec-canvas-state.test.mjs
git commit -m "feat: refine canvas object interactions"
```

### Task 4: Admin Unit Economics

**Files:**
- Create: `src/pages/AdminConsole/unitEconomicsModel.js`
- Modify: `src/pages/AdminConsole/index.jsx`
- Modify: `src/pages/AdminConsole/AdminConsole.css`
- Test: `test/admin-unit-economics.test.mjs`
- Test: `test/admin-console-contract.test.mjs`

**Interfaces:**
- Consumes: product cash prices and `FEATURE_SKUS` values mirrored from the public admin summary/catalog response.
- Produces: `buildUnitEconomicsRows({ products, features, paymentFeeRate, basisSku })` with revenue, cost, fee, profit, and margin.

- [ ] **Step 1: Write failing exact arithmetic tests**

```js
const row = rows.find(item => item.sku === 'ec_image_2k');
assert.equal(row.points, 1);
assert.equal(row.revenueCny.toFixed(4), '0.2618');
assert.equal(row.providerCostCny.toFixed(3), '0.038');
assert.equal(row.profitCny.toFixed(3), '0.216');
```

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test test/admin-unit-economics.test.mjs test/admin-console-contract.test.mjs`

Expected: FAIL because no unit-economics model or simple table exists.

- [ ] **Step 3: Implement the pure calculator, conservative package selector, gift-point separation, table, and quantity calculator**

```js
const revenueCny = points * pointRevenueCny;
const paymentFeeCny = revenueCny * paymentFeeRate;
const profitCny = revenueCny - providerCostCny - paymentFeeCny;
const margin = revenueCny > 0 ? profitCny / revenueCny : null;
```

- [ ] **Step 4: Run focused tests**

Run: `node --test test/admin-unit-economics.test.mjs test/admin-console-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/AdminConsole/unitEconomicsModel.js src/pages/AdminConsole/index.jsx src/pages/AdminConsole/AdminConsole.css test/admin-unit-economics.test.mjs test/admin-console-contract.test.mjs
git commit -m "feat: explain per-generation unit economics"
```

### Task 5: Video Selection and Neutral Model Identity

**Files:**
- Modify: `src/pages/VideoStudio/index.jsx`
- Modify: `src/pages/VideoStudio/VideoStudio.css`
- Test: `test/video-studio-contract.test.mjs`

**Interfaces:**
- Produces: selected mode styling for icon, title, detail, and status.
- Produces: neutral `Seedance 2.0` text identity without copied official artwork.

- [ ] **Step 1: Add failing copy and active-title contracts**

```js
assert.match(page, /把创意素材变成吸引人的短片/);
assert.match(styles, /button\.is-selected[\s\S]*?strong/);
assert.match(page, /Seedance 2\.0/);
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `node --test test/video-studio-contract.test.mjs`

Expected: FAIL on the old headline and incomplete selected typography.

- [ ] **Step 3: Implement the copy, active styles, and neutral model mark**

Do not call any video generation API.

- [ ] **Step 4: Run the focused test**

Run: `node --test test/video-studio-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/VideoStudio/index.jsx src/pages/VideoStudio/VideoStudio.css test/video-studio-contract.test.mjs
git commit -m "fix: clarify video mode selection"
```

### Task 6: Local QA, Candidate Deployment, and Real Production Cases

**Files:**
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Add/replace: `public/images/production-cases/**`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: production task IDs, stable asset URLs, billing events, and actual output dimensions.
- Produces: final catalog entries with `status: 'production'` and no fixture assets.

- [ ] **Step 1: Run the full local gate**

Run: `npm test`, `npm run build`, `npm run check`, `npm run collab:check`, and `git diff --check`.

Expected: all pass; no paid request appears in browser network logs.

- [ ] **Step 2: Browser-test 1440px and 390px**

Check homepage mode selection, try-on gallery keyboard navigation, four visual recipes, Canvas smart layers and focused editors, video mode selection, and admin economics without overflow or console errors.

- [ ] **Step 3: Deploy the candidate**

Run only: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`

Expected: tests, build, health, billing probes, real ecommerce canary, 600-second Canary, and lock release pass. No video task is created.

- [ ] **Step 4: Generate one production image case at a time**

Order: `tryon-reference`, `free`, `poster`, `social-cover`, `brand-kv`. Record request key, task ID, quote, freeze, settlement/release, cost, stable URL, dimensions, and quality. Retry only the same failed request key after confirming no settlement duplication.

- [ ] **Step 5: Download successful stable assets and replace fixtures**

Each catalog entry must contain production provenance and each local asset must decode at its declared ratio. Do not rewrite model output beyond transparent frontend arrangement.

- [ ] **Step 6: Re-run focused and full tests, then commit**

```powershell
git add src/pages/Home/productionCaseCatalog.js public/images/production-cases .superpowers/sdd/progress.md
git commit -m "assets: publish verified production cases"
```

### Task 7: Final Release and Evidence

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md`

**Interfaces:**
- Produces: authoritative release, accounting, real-case, browser QA, and residual-risk record.

- [ ] **Step 1: Run final verification**

Run: `npm test`, `npm run build`, `npm run check`, `npm run collab:check`, `git diff --check`.

- [ ] **Step 2: Deploy with the mandated script and wait for completion**

Run only: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`

- [ ] **Step 3: Independently verify production**

Verify `/health`, `npm run audit:production`, all case assets, owner admin access, no duplicate billing, no active tasks, stable PM2 PID, and released deploy lock. Browser-test 1440px and 390px.

- [ ] **Step 4: Record and commit evidence**

```powershell
git add .superpowers/sdd/progress.md RTK.md
git commit -m "docs: record production case release"
```

## Self-Review

- Spec coverage: Tasks 1-7 cover real cases, shared workbenches, Canvas semantics/interactions, video UI, admin economics, paid-image-only validation, and release evidence.
- Placeholder scan: no TBD/TODO/implement-later steps remain.
- Type consistency: the case catalog and unit-economics interfaces are defined once and consumed by later tasks under the same names.
