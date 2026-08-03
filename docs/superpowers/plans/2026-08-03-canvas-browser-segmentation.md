# Canvas Browser Segmentation Implementation Plan

**Goal:** Replace paid FAL segmentation with cached browser-side U2NetP inference, truthful staged progress and server-validated original-pixel Canvas outputs.

**Architecture:** The authenticated server signs VLM-derived crop prompts. A dedicated browser Worker runs a pinned U2NetP ONNX model for each crop. Existing final routes verify the signed plan, expand submitted crop masks to source pixels, bill once and materialize owned assets.

**Tech stack:** React 18, Vite, Web Worker, OffscreenCanvas, ONNX Runtime Web WASM, U2NetP ONNX, Node.js 22, Sharp, Node test runner.

## Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Keep the 12 user-owned deleted extension-task files and `.tmp/` untouched.
- Use test-driven development and explicit Git staging.
- Never expose or require a segmentation provider key.
- Product output must use source pixels; only the background clean plate may be generative.
- Deploy only with `scripts/deploy-production.ps1` after all local verification passes.

### Task 1: Signed browser-mask contract

**Files:**
- Create `server/canvasSegmentationPlan.mjs`
- Modify `server/canvasLayeringService.mjs`
- Modify `server/canvasSegmentation.mjs`
- Modify `server/index.mjs`
- Add or modify focused server tests under `test/`

1. Write failing tests for padded crop prompts, HMAC owner/source binding, expiry, PNG/count/size limits and crop-mask expansion.
2. Run focused tests and confirm the expected red state.
3. Implement the signed plan service and split semantic planning from mask materialization.
4. Add authenticated `/api/canvas/segmentation-plan`; update final routes to consume verified masks.
5. Run focused tests, syntax checks and commit explicit files.

### Task 2: Browser inference runtime

**Files:**
- Add `onnxruntime-web` to `package.json` and lockfile
- Add pinned model/runtime assets and third-party notices under `public/`
- Create `src/pages/EcCanvas/canvasSegmentationModel.js`
- Create `src/pages/EcCanvas/canvasSegmentationWorker.js`
- Create `src/pages/EcCanvas/canvasSegmentationRuntime.js`
- Add focused runtime/model tests

1. Write failing pure tests for preprocessing constants, monotonic progress, crop correlation and cancellation state.
2. Add pinned dependencies and assets with recorded SHA-256 hashes.
3. Implement streamed model loading, a single warm WASM session and sequential crop inference in the Worker.
4. Implement the singleton controller, prewarm, progress callbacks, abort and mask serialization.
5. Run focused tests and production build, then commit explicit files.

### Task 3: Contextual loading and Canvas integration

**Files:**
- Create a transient progress component under `src/pages/EcCanvas/components/`
- Modify `src/pages/EcCanvas/index.jsx`
- Modify `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify `src/pages/EcCanvas/EcCanvas.css`
- Modify `src/services/api.js`
- Add focused Canvas/API contract tests

1. Write failing contracts for the four progress stages, source anchoring, cancel/retry and exclusion from persisted `nodes`.
2. Add API helpers for plan and final mask submission.
3. Prewarm after Canvas idle; route both direct actions through the shared runtime.
4. Render the transient card beside the source, with real download and per-instance progress.
5. Preserve existing automatic node materialization and connected output behavior.
6. Run focused tests and desktop/mobile browser QA, then commit explicit files.

### Task 4: Remove paid segmentation configuration

**Files:**
- Modify `server/index.mjs`
- Modify `scripts/deploy-production.ps1`
- Modify deployment and route contract tests
- Remove obsolete FAL client/test files when no production reference remains

1. Write failing contracts asserting no FAL runtime construction or deployment key requirement.
2. Remove FAL imports, construction, environment forwarding and preflight failure.
3. Keep only truthful legacy fallbacks for old clients.
4. Run focused tests and commit explicit files.

### Task 5: End-to-end verification and release

1. Run the complete repository test suite, production build, asset check, syntax checks, collaboration check and `git diff --check`.
2. Run Chromium acceptance with the supplied three-container image; inspect transparent output pixels and the three Smart Layer child nodes.
3. Verify warm-cache retry, cancellation, unsupported-browser and server-validation failures.
4. Update `.superpowers/sdd/progress.md` with exact evidence.
5. Deploy through `scripts/deploy-production.ps1` only when authenticated release prerequisites are present; otherwise report the precise external gap without weakening verification.

