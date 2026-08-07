# Ecommerce Creative and Export Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver truth-stable creative variation, complete ecommerce format configuration, durable generation/task recovery, and verified end-to-end canvas exports.

**Architecture:** Add narrow policy modules for creative attempts, ecommerce formats, export delivery, and derived placement, then propagate their contracts through existing UI, campaign, prompt, orchestration, task, and canvas surfaces. Keep the current canvas engine and existing billing/orchestration stores; replace duplicated local decisions with shared pure functions and test every terminal state.

**Tech Stack:** React 18, Vite 6, Node.js ESM, Express 4, Sharp, SQLite, Node test runner, browser File System Access API, JSZip.

## Global Constraints

- Confirmed product facts and uncertainty guards never vary for novelty.
- Failed retries preserve creative attempt, route, asset plan, and billing identity.
- Explicit new planning creates a new bounded creative attempt.
- Detail imagery defaults to 9:16.
- Source uploads and internal JSON never enter image delivery.
- No writable stream opens before all required blobs pass status, content-type, and non-zero validation.
- Derived outputs are placed to the right of their source union first.
- Production deployment only uses `scripts/deploy-production.ps1`.
- Preserve the 12 user-owned deleted extension-task files, `.tmp/`, and `scripts/diagnose-recent-ecommerce-jobs.cjs`.

---

### Task 1: Creative Attempt and Route Contract

**Files:**
- Create: `server/ecommerceEngine/creativeRoutePolicy.mjs`
- Modify: `server/ecommerceEngine/designDirectionService.mjs`
- Modify: `server/ecommerceEngine/creativeDirectionPlan.mjs`
- Modify: `server/ecommerceEngine/campaignBible.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/pages/Home/ec/EcommerceDesignPlanEditor.jsx`
- Test: `test/ecommerce-creative-route-policy.test.mjs`
- Test: `test/ecommerce-design-direction-service.test.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`
- Test: `test/ecommerce-orchestrator.test.mjs`

**Interfaces:**
- Produces: `createCreativeAttemptId()`, `selectCreativeRoute({ evidence, attemptId, recentRoutes })`, `creativeRouteFingerprint(route)`, `creativeRouteSimilarity(left, right)`.
- Propagates: `creativeAttemptId`, `creativeRoute`, `routeFingerprint`, `routeRationale`, `routeDifference`.

- [ ] **Step 1: Write failing route-policy tests**

Assert that identical evidence with the same attempt ID returns the same route, a different deliberate attempt avoids the recent fingerprint, and factual evidence is returned unchanged.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test --test-concurrency=1 test/ecommerce-creative-route-policy.test.mjs test/ecommerce-design-direction-service.test.mjs`

Expected: failure because `creativeRoutePolicy.mjs` and propagated fields do not exist.

- [ ] **Step 3: Implement deterministic bounded route selection**

Use a stable hash of the attempt ID and normalized evidence to select compatible route dimensions. Fingerprints contain only creative dimensions, never product facts. Similarity is the matched-dimension ratio and rejects routes at or above the configured threshold.

- [ ] **Step 4: Update planner prompts and normalized direction output**

The planner prompt must include route dimensions, product observations, reference traits, user intent, and explicit instructions to explain why this route fits. Raise planning creativity only inside the bounded route, while the visual evidence pass remains low-temperature.

- [ ] **Step 5: Propagate route identity through campaign, asset, prompt, and snapshots**

Retry paths reuse stored orchestration snapshots. New direction requests create a fresh attempt only from explicit UI actions. Prompt payloads include route duties and visible rationale fields.

- [ ] **Step 6: Expose evidence and route explanation in the second-step plan**

Render product observations, reference adaptation, prompt interpretation, route rationale, and route difference using the existing neutral plan editor hierarchy.

- [ ] **Step 7: Run focused and regression tests**

Run: `node --test --test-concurrency=1 test/ecommerce-creative-route-policy.test.mjs test/ecommerce-design-direction-service.test.mjs test/ecommerce-creative-direction-plan.test.mjs test/campaign-bible.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-orchestrator.test.mjs`

Expected: all pass.

- [ ] **Step 8: Commit**

Commit message: `feat: add bounded ecommerce creative routes`

### Task 2: Shared Ecommerce Format Registry and Portal Overlays

**Files:**
- Create: `src/pages/Home/ec/ecommerceFormatRegistry.js`
- Create: `src/components/ui/AnchoredPortal.jsx`
- Modify: `src/pages/Home/ec/ecommercePlanModel.js`
- Modify: `src/pages/Home/ec/SizingPanel.jsx`
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/EcommerceDesignPlanEditor.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/canvasSuitePlanModel.js`
- Test: `test/ecommerce-format-registry.test.mjs`
- Test: `test/ecommerce-plan-model.test.mjs`
- Test: `test/canvas-suite-plan-model.test.mjs`
- Test: `test/ecommerce-ui-contract.test.mjs`

**Interfaces:**
- Produces: `ECOMMERCE_FORMATS`, `formatsFor({ role, platform, resolution })`, `normalizeCommerceFormat(...)`, `generationSizeForFormat(...)`.
- Produces: `AnchoredPortal({ anchorRef, open, onDismiss, children })`.

- [ ] **Step 1: Write failing registry and UI contract tests**

Cover 1:1, 3:4, 4:5, 2:3, 9:16, 4:3, 3:2, 16:9, role restrictions, model promotion, and 9:16 detail defaults. Assert that ratio menus use a portal rather than panel-local overflow.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test --test-concurrency=1 test/ecommerce-format-registry.test.mjs test/ecommerce-plan-model.test.mjs test/ecommerce-ui-contract.test.mjs`

- [ ] **Step 3: Implement registry and replace local ratio constants**

Keep displayed target ratio separate from promoted generation ratio. Every consumer reads the registry; no component keeps a private four-ratio list.

- [ ] **Step 4: Implement anchored portal positioning**

Use `createPortal`, `getBoundingClientRect`, viewport padding, flip-above collision behavior, resize/scroll repositioning, Escape, outside click, and responsive max height.

- [ ] **Step 5: Update configuration, second-step, and canvas suite surfaces**

Use role/platform labels, compact content-sized controls, scrollable format groups, and shared validation summaries.

- [ ] **Step 6: Run focused tests and build**

Run: `node --test --test-concurrency=1 test/ecommerce-format-registry.test.mjs test/ecommerce-plan-model.test.mjs test/canvas-suite-plan-model.test.mjs test/ecommerce-ui-contract.test.mjs`

Run: `npm run build`

- [ ] **Step 7: Commit**

Commit message: `feat: unify ecommerce formats and overlays`

### Task 3: Generation Terminal States, Billing Release, and Task Dismissal

**Files:**
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/generationJobs.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Modify: `src/store/taskStore.jsx`
- Modify: `src/components/task/TaskSidebar.jsx`
- Test: `test/ecommerce-orchestrator.test.mjs`
- Test: `test/generation-jobs.test.mjs`
- Test: `test/api-contract.test.mjs`
- Test: `test/task-store.test.mjs`
- Test: `test/task-sidebar-contract.test.mjs`

**Interfaces:**
- Produces API: `DELETE /api/generation/tasks/:id` for owner-scoped terminal-task dismissal.
- Produces client: `dismissGenerationTask(id)`.
- Terminal responses expose delivered, charged, released, failed, and retryable counts.

- [ ] **Step 1: Write failing billing-terminal and dismissal tests**

Assert one settle/release decision per terminal path, no charge for failed assets, no dismissal of active tasks, owner isolation, and successful removal of completed/failed/cancelled task history.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/generation-jobs.test.mjs test/api-contract.test.mjs test/task-store.test.mjs test/task-sidebar-contract.test.mjs`

- [ ] **Step 3: Normalize failure classification and terminal summaries**

Map provider timeout/network/429/5xx to transient retryable failures, malformed output to bounded planner/provider recovery, cancellation to release, and terminal validation to explicit non-billable failure.

- [ ] **Step 4: Add owner-scoped terminal task dismissal**

Reject active states with 409, reject foreign ownership with 404, archive or remove only the task-list record while preserving immutable billing and project evidence.

- [ ] **Step 5: Update task UI**

Add a compact dismiss action on terminal cards, protect active cards, keep retry separate, and ensure panel-close does not mutate history.

- [ ] **Step 6: Run focused tests**

Expected: all pass with exact-once accounting assertions.

- [ ] **Step 7: Commit**

Commit message: `fix: close generation and task terminal states`

### Task 4: Two-Stage Verified Browser Delivery

**Files:**
- Rewrite: `src/pages/EcCanvas/browserFileDelivery.js`
- Create: `src/pages/EcCanvas/exportDeliveryModel.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Test: `test/canvas-export-contract.test.mjs`
- Test: `test/browser-file-delivery.test.mjs`
- Test: `test/canvas-export-delivery-model.test.mjs`

**Interfaces:**
- Produces: `chooseDeliveryDestination(request, deps)`.
- Produces: `prepareImageDeliverables(items, deps)` returning validated blobs.
- Produces: `writePreparedDeliverables(destination, prepared, deps)` with progress callbacks.
- Produces model reducer for `configuring`, `destination-ready`, `preparing`, `writing`, `success`, `cancelled`, and `error`.

- [ ] **Step 1: Write failing delivery tests**

Cover picker-only destination selection, explicit later write, response status, image content type, zero-byte rejection, all-before-write suite preparation, writable abort, picker cancellation, ZIP fallback, single-file fallback, generated-only scope, and repeat export.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test --test-concurrency=1 test/canvas-export-contract.test.mjs test/browser-file-delivery.test.mjs test/canvas-export-delivery-model.test.mjs`

- [ ] **Step 3: Implement destination, preparation, and writing phases**

Never call `createWritable` during destination selection. Validate all blobs before any file handle is created. Abort open streams on failure and return structured progress/results.

- [ ] **Step 4: Rebuild export modal actions**

Rename modes to `导出整套图片` and `合成并导出详情长图`. First action selects destination; second action starts export. Show destination name, progress, success count, retry, repeat export, and cancellation without losing configuration.

- [ ] **Step 5: Route single and multi-image save through the same subsystem**

Replace direct anchor clicks with `另存为` using the shared delivery workflow.

- [ ] **Step 6: Run focused tests and build**

Run the three focused test files, then `npm run build`.

- [ ] **Step 7: Commit**

Commit message: `fix: complete browser export delivery flow`

### Task 5: Durable Long-Detail Storage and Right-Side Placement

**Files:**
- Create: `src/pages/EcCanvas/canvasDerivedPlacement.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `server/index.mjs`
- Modify: `server/ecommerceEngine/longDetailComposer.mjs`
- Modify: `server/generatedAssets.mjs`
- Test: `test/canvas-derived-placement.test.mjs`
- Test: `test/ecommerce-long-detail-composer.test.mjs`
- Test: `test/api-contract.test.mjs`

**Interfaces:**
- Produces: `placeDerivedRightOfSources({ sources, occupied, width, height, gap })`.
- Stitch response returns a durable generated-asset URL plus width, height, content type, and byte size.

- [ ] **Step 1: Write failing placement and durable-asset tests**

Assert right-first placement, collision fallback, ordered provenance, non-zero output, readable durable URL, and rejection of invalid/empty source images.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --test --test-concurrency=1 test/canvas-derived-placement.test.mjs test/ecommerce-long-detail-composer.test.mjs test/api-contract.test.mjs`

- [ ] **Step 3: Move stitched output into stable generated storage**

Use the existing immutable asset route/storage adapter, not frontend `dist`. Validate metadata after Sharp encoding and before returning success.

- [ ] **Step 4: Use shared right-side derived placement**

Compute source union bounds and choose the first collision-free right-side location. Keep connections and ordered source IDs.

- [ ] **Step 5: Separate composition status from local delivery status**

Cancelling the picker retains the composed canvas node. Composition failure produces no node and no file.

- [ ] **Step 6: Run focused tests and commit**

Commit message: `fix: make long detail assets durable`

### Task 6: Canvas Interaction and Global UI Closure

**Files:**
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/canvasInteractionModel.js`
- Test: `test/canvas-interaction-model.test.mjs`
- Test: `test/canvas-studio-contract.test.mjs`
- Test: `test/canvas-ui-contract.test.mjs`

**Interfaces:**
- Select tool owns arrow/crosshair marquee behavior.
- Hand tool owns grab/grabbing pan behavior.
- Bottom toolbar exposes non-obstructive selection hint and existing layer/zoom capabilities.

- [ ] **Step 1: Extend interaction and UI contract tests**

Cover cursor ownership, marquee selection, Shift multi-select hint, compact command sizing, non-overlapping bottom controls, suite export visibility, and dismissible transient notices.

- [ ] **Step 2: Run focused tests and confirm RED where gaps remain**

- [ ] **Step 3: Implement shared spacing and control sizing**

Remove oversized text containers, keep icon buttons dimensionally stable, and ensure labels wrap or truncate without changing canvas geometry.

- [ ] **Step 4: Complete bottom controls using existing capabilities**

Keep selection, hand, image, text, layers, zoom, fit, and discoverable secondary controls. Do not add unsupported decorative controls.

- [ ] **Step 5: Run focused tests and responsive build checks**

Run the three focused files and `npm run build`.

- [ ] **Step 6: Commit**

Commit message: `fix: close canvas interaction and ui gaps`

### Task 7: Full Regression, Browser QA, and Production Release

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md`
- Add release evidence documentation if required by current repository convention.

- [ ] **Step 1: Run full serial regression**

Run: `npm test`

Expected: every test passes with zero failures.

- [ ] **Step 2: Run build, asset, collaboration, and whitespace checks**

Run: `npm run build`

Run: `npm run check`

Run: `npm run collab:check`

Run: `git diff --check`

- [ ] **Step 3: Run browser acceptance**

Verify desktop 1440x1000 and mobile 390x844: unclipped ratio overlays, deliberate new route differences, retry route stability, task dismissal, arrow marquee, hand pan, two-stage suite export, two-stage long export, single-image save, non-zero delivered files, right-side long node placement, no horizontal overflow, and no console errors.

- [ ] **Step 4: Review the complete diff**

Confirm no user-owned deleted/untracked runtime files are staged. Review billing, export, durable asset, and retry paths for regressions.

- [ ] **Step 5: Deploy through the mandated script**

Run: `powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`

Wait for the script's full test, build, backup, restart, billing, ecommerce generation, and canary gates.

- [ ] **Step 6: Run independent production verification**

Run production audit, health, billing, authenticated ecommerce delivery, durable image reads, Canvas persistence, and PM2 stability checks. Do not report release success until the remote lock is released.

- [ ] **Step 7: Record release evidence and commit**

Commit message: `docs: record creative export stability release`
