# Commerce Canvas Global Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a globally consistent ecommerce workflow covering direction planning, generation facts, Canvas interaction, long-detail composition, export destinations, and catalog-image quality.

**Architecture:** Keep the existing Canvas engine and introduce pure contract modules for pointer intent, asset provenance, detail ordering, and export strategy. Carry stable role/sequence/ratio metadata from the ecommerce plan through generation and Canvas, then apply role-level prompt and quality overrides before delivery.

**Tech Stack:** React, Vite, Node.js ESM, Sharp, JSZip, Node test runner, Playwright.

## Global Constraints

- Preserve user-owned deleted extension task files, `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs`.
- Use TDD for every behavioral change.
- New detail screens default to `9:16`; existing saved nodes retain their ratio.
- Normal exports contain generated/derived images only and never include JSON.
- White and transparent catalog images contain no shadow and preserve complete clean product edges.
- Do not replace the Canvas engine in this release.

---

### Task 1: Canvas Tool Semantics

**Files:**
- Modify: `src/pages/EcCanvas/canvasState.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Test: `test/ec-canvas-state.test.mjs`
- Test: `test/canvas-studio-contract.test.mjs`

**Interfaces:**
- Produces: `getCanvasPointerIntent({ tool, targetKind, button, shiftKey, altKey, spaceKey }) -> 'select-node' | 'marquee' | 'pan' | 'ignore'`.
- Produces: `canvasCursorForState({ tool, pointerMode, spacePressed }) -> CSS cursor`.

- [ ] Write failing tests proving blank select-drag returns `marquee`, hand/Space/middle returns `pan`, and select idle returns `default`.
- [ ] Run `node --test test/ec-canvas-state.test.mjs test/canvas-studio-contract.test.mjs` and confirm the new assertions fail.
- [ ] Implement tool-driven pointer intent, preserve Shift node toggling, and add the selection hint/tooltip.
- [ ] Rerun the focused tests and confirm they pass.

### Task 2: Global Canvas Density

**Files:**
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Test: `test/canvas-studio-contract.test.mjs`
- Test: `test/visual-system-contract.test.mjs`

**Interfaces:**
- Produces: shared `--ec-canvas-*` density tokens and content-sized toolbar classes.

- [ ] Add failing contract assertions rejecting fixed 680px toolbars, guessed label widths, 9px metadata, and 48px minimum media footers.
- [ ] Run the two focused contract tests and confirm failure.
- [ ] Replace inline sizing with stable compact controls, readable type, viewport-safe wrapping, and icon tooltips.
- [ ] Rerun the focused tests and inspect desktop/mobile CSS constraints.

### Task 3: Asset Provenance And Export Scope

**Files:**
- Create: `src/pages/EcCanvas/canvasAssetProvenance.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/canvasSessionModel.js`
- Test: `test/canvas-source-roles.test.mjs`
- Create: `test/canvas-export-contract.test.mjs`

**Interfaces:**
- Produces: `resolveAssetProvenance(node) -> 'source' | 'generated' | 'derived' | 'composition'`.
- Produces: `selectDeliverableNodes(nodes, selectedIds) -> { deliverables, excludedSources }`.

- [ ] Write failing tests for legacy source nodes, generated transparent assets, derived long images, and no-selection export scope.
- [ ] Run the focused tests and confirm the URL-based implementation fails.
- [ ] Implement normalization and replace all broad URL filters with the shared selector.
- [ ] Rerun focused tests and migration/session tests.

### Task 4: Detail Ordering And Long-Image UI

**Files:**
- Create: `src/pages/EcCanvas/detailCompositionModel.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Test: `test/canvas-export-contract.test.mjs`
- Create: `test/detail-composition-model.test.mjs`

**Interfaces:**
- Produces: `orderDetailNodes(nodes) -> node[]`, preferring explicit sequence then visual row order.
- Produces: `moveDetailItem(ids, fromIndex, toIndex) -> ids`.
- Consumes: `selectDeliverableNodes` from Task 3.

- [ ] Write failing ordering tests for scattered, horizontal, and explicit-sequence node sets.
- [ ] Write failing UI contract assertions for `合成长图`, ordered preview, and absence of alignment controls.
- [ ] Implement the pure ordering/reorder model and connect it to the export modal and multi-selection toolbar.
- [ ] Rerun model and UI contract tests.

### Task 5: Seam-Free Long Image Service

**Files:**
- Modify: `server/index.mjs`
- Modify: `server/ecommerceEngine/exportService.mjs`
- Test: `test/ecommerce-export.test.mjs`
- Create: `test/ecommerce-long-detail.test.mjs`

**Interfaces:**
- Consumes: ordered image URLs and output format.
- Produces: one stitched image with width, height, item count, and download URL metadata.

- [ ] Create colored Sharp fixtures and failing tests for order, common width, exact height sum, and no separator rows.
- [ ] Run the focused server tests and confirm missing metadata/edge behavior fails.
- [ ] Harden the stitch route/service, validate limits, and return derived provenance metadata.
- [ ] Rerun focused tests and export route integration tests.

### Task 6: User-Chosen Save Destinations

**Files:**
- Create: `src/pages/EcCanvas/browserFileDelivery.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/canvas-export-contract.test.mjs`

**Interfaces:**
- Produces: `deliveryStrategy({ mode, fileCount, capabilities })`.
- Produces: `saveIndividualImages`, `saveLongImage`, and one-download fallback functions.

- [ ] Write failing tests for directory picker, save-file picker, image-only ZIP fallback, cancellation, and deferred download.
- [ ] Run the focused tests and confirm failure.
- [ ] Implement feature-detected save helpers; remove normal JSON packaging and repeated anchor clicks.
- [ ] Rerun export tests and verify cancellation creates no download.

### Task 7: 9:16 Plan-To-Canvas Metadata

**Files:**
- Modify: `server/ecommerceEngine/creativeDirectionPlan.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/platformPolicies.mjs`
- Modify: `server/ecommerceEngine/modelCatalog.mjs`
- Modify: `src/pages/EcCanvas/canvasSuitePlanModel.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/ecommerce-creative-direction-plan.test.mjs`
- Test: `test/ecommerce-asset-planner.test.mjs`
- Test: `test/ecommerce-model-routing.test.mjs`
- Test: `test/ecommerce-direction-ui-contract.test.mjs`

**Interfaces:**
- Produces: stable `role`, `sequence`, `aspectRatio`, and `provenance` fields from plan through Canvas.

- [ ] Change tests to require 9:16 detail plans and provider-supported routing while preserving old saved ratios.
- [ ] Run focused tests and confirm existing 3:4 defaults fail.
- [ ] Update all plan, policy, routing, Canvas display, and generation handoff paths together.
- [ ] Rerun focused tests and canvas generation contracts.

### Task 8: Fact-Gated Variant Comparison

**Files:**
- Modify: `server/ecommerceEngine/detailDutyPolicy.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/designDirectionService.mjs`
- Test: `test/ecommerce-asset-planner.test.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`
- Test: `test/ecommerce-design-direction-service.test.mjs`

**Interfaces:**
- Produces: fact-gated `variant_comparison` duty and deterministic overlay labels without increasing asset count.

- [ ] Write failing tests for two confirmed variants, missing differentiators, deterministic label text, and unchanged billing count.
- [ ] Run focused tests and confirm failure.
- [ ] Add the comparison duty, fact extraction, prompt prohibition for unlabeled variants, and step-two display metadata.
- [ ] Rerun focused planner/compiler/direction tests.

### Task 9: Catalog Isolation And Passthrough

**Files:**
- Create: `server/ecommerceEngine/catalogIsolation.mjs`
- Modify: `server/ecommerceEngine/platformPolicies.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/promptAssembler.mjs`
- Modify: `server/ecommerceEngine/styleSkills.mjs`
- Modify: `server/ecommerceEngine/qualityGate.mjs`
- Modify: `server/ecommerceEngine/postProcessor.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`
- Test: `test/ecommerce-quality-gate.test.mjs`
- Test: `test/ecommerce-deterministic-repair.test.mjs`

**Interfaces:**
- Produces: `catalogIsolationContract(role, sourceAnalysis)` and deterministic passthrough eligibility.

- [ ] Write failing tests proving catalog roles remove all shadows/style backgrounds and compliant white sources choose passthrough.
- [ ] Add failing quality tests for shadow contamination, alpha fringe, clipping, and edge clearance.
- [ ] Implement one high-priority isolation contract and remove contradictory role instructions from legacy/style paths.
- [ ] Implement conservative passthrough and quality decisions using existing analysis data.
- [ ] Rerun focused prompt, repair, and quality tests.

### Task 10: Full Verification And Production Rollout

**Files:**
- Modify: `RTK.md`
- Modify: deployment evidence files only through the existing deployment workflow.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified production deployment and recovery notes.

- [ ] Run all focused Canvas and ecommerce tests.
- [ ] Run `npm test`, `npm run build`, and `npm run collab:check`; resolve every failure.
- [ ] Start the app and run Playwright desktop/mobile interaction checks for select marquee, Shift multi-select, hand pan, compact UI, export contents, reorder, and long-image output.
- [ ] Inspect screenshots and canvas pixels for overlaps, clipping, blank regions, and stale 3:4 metadata.
- [ ] Run the repository deployment script and wait for completion.
- [ ] Run production smoke and ecommerce verification against the deployed site.
- [ ] Update `RTK.md` with the deployed commit, evidence, behavior changes, and rollback branch.

