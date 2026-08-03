# Canvas Selected Composer and Image Mentions Implementation Plan

> Execute test-first in `F:/da/shubao/.worktrees/codex-ecommerce-stability`. Keep the 12 user-owned deleted extension task files and `.tmp/` untouched.

**Goal:** Make Canvas generation nodes content-first, selection-driven, and backed by real ordered image references, then reuse the reference interaction on existing creation surfaces.

**Architecture:** Generation nodes retain their persisted workflow data but render a compact body in the Canvas world. One selected-composer layer is rendered outside the node map and positioned from node geometry. A pure image-mention model supplies ordered labels and request payloads; a shared picker component presents those references across Canvas and home creation surfaces.

**Stack:** React, Vite, Node test runner, existing Canvas APIs, existing ecommerce workbench components and CSS.

## Task 1: Lock the state and mention contracts

**Files:**
- Modify: `test/canvas-studio-contract.test.mjs`
- Create: `test/image-mention-model.test.mjs`
- Modify: `src/pages/EcCanvas/canvasStudioModel.js`
- Create: `src/components/creation/imageMentionModel.js`

1. Add failing tests for compact body geometry, selected-only composer presentation, fixed image model fields and legacy normalization.
2. Add failing tests for deterministic `@图片N` labels, deduplication, role preservation and ordered request references.
3. Implement the pure models and rerun the focused tests.

## Task 2: Split Canvas node bodies from selected composers

**Files:**
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Modify: `test/canvas-studio-contract.test.mjs`

1. Add source-contract tests proving composers are rendered once from `selectedNode`, not inside the node map.
2. Add compact body components for text, image placeholder/result and ecommerce plan summary.
3. Render one contextual composer below the selected node and derive visibility only from selection.
4. Make text double-click editing and toolbar behavior share the normal text-node path.
5. Remove model selectors and add ratio, quality, quantity and mention controls.
6. Verify close/delete, blank-click dismissal, drag bounds and responsive layout.

## Task 3: Connect structured mentions to generation

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/services/api.js`
- Modify: relevant server Canvas generation route/handler files discovered by contract tests
- Modify: `test/canvas-generation-contract.test.mjs`
- Modify: `test/canvas-generation-handler.test.mjs`

1. Add failing tests for ordered image references and role-preserving ecommerce inputs.
2. Build request payloads from structured sources, not parsed display text.
3. Keep GPT Image 2 fixed and carry quality/ratio/count through quote and generation paths.
4. Ensure image-aware text generation receives visual references or explicitly disables image mention for unsupported routes.
5. Verify source ownership, request idempotency and billing parity.

## Task 4: Reuse reference picking on existing creation surfaces

**Files:**
- Create: `src/components/creation/ImageMentionPicker.jsx`
- Create: `src/components/creation/ImageReferenceRail.jsx`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Home/ec/components/SupplementAssetDeck.jsx`
- Modify: affected page CSS and focused tests

1. Add failing component/source-contract tests for the shared `@` picker.
2. Reuse the existing upload-card visual language and keep product/reference roles visible.
3. Wire selected mentions into each surface's existing request data without changing billing or model selection.
4. Verify keyboard access, remove behavior, empty states and mobile wrapping.

## Task 5: Regression and browser acceptance

1. Run focused Canvas, mention, homepage upload, generation contract and billing tests.
2. Run `npm test`, `npm run build`, `npm run collab:check` and `git diff --check`.
3. Start the local Vite server and exercise desktop/mobile flows with browser screenshots:
   - left-created text/image/suite nodes;
   - selection and deselection;
   - image-derived nodes with `@图片1`;
   - text edit without AI generation;
   - image ratio/quality/quantity;
   - ecommerce direction then suite generation;
   - homepage and Xiaohongshu reference picking.
4. Commit explicit files only, deploy through `scripts/deploy-production.ps1`, and run authenticated production ecommerce verification.

