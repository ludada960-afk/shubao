# Cross-Domain Asset Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make image, video, Canvas, Works, and project workflows share one owner-scoped physical asset contract while preserving domain-specific video timeline and image composition models.

**Architecture:** `project_assets` remains the canonical project-scoped physical asset identity. Video workbench tables remain domain aggregates and reference canonical `project_assets.id`; Canvas imports canonical assets through an adapter and never reads video tables directly. The first release adds explicit bridge helpers and tests, then updates video ingestion to create/resolve canonical project assets before creating video asset versions.

**Tech Stack:** React 18, Vite, Express, better-sqlite3, Node test runner, existing projectStore, videoWorkbenchStore, EcCanvas and service-layer request helpers.

## Global Constraints

- Do not add a second general-purpose image/video asset database.
- Do not change existing SKU behavior or the product-suite/anything-tryon recipe contracts.
- Do not move video shots, candidates, timeline clips, audio tracks, or SkillRuns into EcCanvas.
- Do not trust client email, stable URLs, asset IDs, project IDs, or provider URLs without server-side owner/project/hash validation.
- Asset selection, version switching, project opening, and Canvas import do not mutate billing.
- Generation, regeneration, smart layering, PSD export, and video export retain their existing server-authoritative billing boundaries.
- No production deployment, real image generation, real video generation, payment mutation, or quota consumption in this phase.
- Shared files are edited only by the main thread; the video thread edits only its declared video-domain files.

---

### Task 1: Freeze the cross-thread contract and establish focused test fixtures

**Files:**
- Create: `test/project-asset-contract.test.mjs`
- Create: `server/projects/projectAssetContract.mjs`
- Create: `src/services/projectAssetContract.js`
- Modify: `docs/superpowers/specs/2026-08-19-cross-domain-asset-contract-design.md`

**Interfaces:**
- `server/projects/projectAssetContract.mjs` exports `normalizeProjectAssetRef`, `assertCanonicalProjectAssetRef`, and `mediaKindFromMime`.
- `src/services/projectAssetContract.js` exports `normalizeClientProjectAssetRef` and `projectAssetReferenceKey` for non-authoritative UI state only.
- The server normalizer accepts `{ projectId, projectAssetId, role, expectedContentHash }` and rejects missing project or asset identifiers.

- [ ] **Step 1: Write failing tests for media kind and canonical reference validation.**

```js
test('derives media kind from MIME without trusting a client supplied kind', () => {
  assert.equal(mediaKindFromMime('image/webp'), 'image');
  assert.equal(mediaKindFromMime('video/mp4'), 'video');
  assert.equal(mediaKindFromMime('audio/mpeg'), 'audio');
  assert.equal(mediaKindFromMime('application/octet-stream'), 'document');
});

test('canonical project asset references require project, asset and expected hash', () => {
  assert.deepEqual(normalizeProjectAssetRef({ projectId: 'p1', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1' }), {
    projectId: 'p1', projectAssetId: 'a1', role: 'reference', expectedContentHash: 'h1',
  });
  assert.throws(() => normalizeProjectAssetRef({ projectId: 'p1', projectAssetId: 'a1' }), /expectedContentHash/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the bridge modules do not exist.**

Run: `node --test test/project-asset-contract.test.mjs`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement the minimal server and client normalizers.**

The server helper must trim strings, reject control characters and overlong values, allow only known roles as non-empty bounded strings, and never accept `stableUrl` as identity. The client helper may normalize display fields but must not claim ownership or authorization.

- [ ] **Step 4: Run the focused test and confirm it passes.**

Run: `node --test test/project-asset-contract.test.mjs`  
Expected: all focused tests pass.

- [ ] **Step 5: Commit only the contract helper and focused test.**

```bash
git add server/projects/projectAssetContract.mjs src/services/projectAssetContract.js test/project-asset-contract.test.mjs docs/superpowers/specs/2026-08-19-cross-domain-asset-contract-design.md
git commit -m "feat: define cross-domain project asset contract"
```

### Task 2: Expose owner-scoped canonical project asset operations

**Files:**
- Modify: `server/projects/projectStore.mjs`
- Modify: `server/projects/projectRoutes.mjs`
- Modify: `src/services/projects.js`
- Test: `test/project-routes.test.mjs` or the existing project store/routing test file discovered by `rg --files test`

**Interfaces:**
- `projectStore.createProjectAsset({ ownerEmail, projectId, versionId, generationRunId, role, stableUrl, contentHash, mimeType, width, height, parentAssetId, retentionClass, provenance })` returns an owner-scoped canonical project asset.
- `projectStore.getProjectAsset({ ownerEmail, projectId, projectAssetId })` returns the asset or `null`.
- `projectStore.listProjectAssets({ ownerEmail, projectId, mediaKind })` returns newest-first canonical assets.
- `projectStore.linkProjectAsset({ ownerEmail, projectId, sourceProjectAssetId, targetProjectAssetId, relation, generationRunId })` is idempotent and validates both assets belong to the same project.
- Routes are authenticated and do not accept browser authority for `ownerEmail`; they use the signed session.

- [ ] **Step 1: Add failing store tests for create, owner isolation, hash validation, listing and idempotent lineage.**
- [ ] **Step 2: Run only the new project asset tests and confirm failure.**
- [ ] **Step 3: Add the store methods using the existing `project_assets` table and retention columns.**
- [ ] **Step 4: Add read/list/link routes only if an existing route convention requires HTTP access; keep internal video ingestion on the store API.**
- [ ] **Step 5: Add service helpers that send only signed-session requests and never serialize raw provider URLs as identity.**
- [ ] **Step 6: Run focused project tests and the existing project/retention test suite.**
- [ ] **Step 7: Commit as `feat: expose owner-scoped project assets`.**

### Task 3: Video-domain adapter to canonical project assets

**Files:**
- Modify only in the video thread: `server/videoWorkbenchStore.mjs`, `server/videoWorkbenchRoutes.mjs`, `src/services/videoWorkbench.js`, `src/pages/VideoStudio/*`, and video-specific tests.
- Shared changes, if unavoidable, must be proposed to the main thread as a separate patch; do not edit `server/projects/*` directly from the video thread.

**Interfaces:**
- Video `addAssetVersionFromVideoAsset` must resolve/create a canonical `project_assets` row and store that row's `id` in `source_project_asset_id`.
- `listWorkbench` returns both the domain asset/version and a read-only `projectAssetRef` containing `{ projectId, projectAssetId, contentHash, mimeType, stableUrl }`.
- Video tables remain the source of truth for shot bindings, selected candidates, stale state, timeline clips, audio tracks, memory and SkillRun events.

- [ ] **Step 1: Add a failing test proving a video version currently cannot use a raw `video_assets.id` as `source_project_asset_id`.**
- [ ] **Step 2: Add a video-only adapter that calls the main-thread project asset operation through an injected dependency, with a test double for the video store test harness.**
- [ ] **Step 3: Update `addAssetVersionFromVideoAsset` to use the canonical project asset ID and preserve the raw upload ID only in metadata.**
- [ ] **Step 4: Add tests for owner isolation, stale candidate replacement, repeated import idempotency and no billing/provider submission.**
- [ ] **Step 5: Run the video-focused suite and `scripts/verify-video-workbench-stage1.mjs` in local no-provider mode only.**
- [ ] **Step 6: Commit video-domain changes separately as `feat: bind video versions to project assets`.**

### Task 4: Canonical asset import into Canvas and Works

**Files:**
- Modify: `src/pages/EcCanvas/canvasWorkModel.js`, `src/pages/EcCanvas/canvasSessionModel.js`, `src/pages/EcCanvas/index.jsx`, `src/services/projects.js`
- Modify: `src/pages/Home/GallerySection.jsx`, `src/pages/Home/ec/RecoveryShelf.jsx` only where existing work metadata needs the canonical project asset reference.
- Create: `test/cross-domain-canvas-assets.test.mjs`

**Interfaces:**
- `buildCanvasAssetRef(asset)` returns a display-safe ref with `{ projectId, projectAssetId, mediaKind, stableUrl, contentHash, role }`.
- `importProjectAssetToCanvas({ asset, source, session })` creates a Canvas source node without copying video timeline/candidate state.
- Works entries preserve `projectId`, `versionId`, `projectAssetId` and `provenance` while remaining backward-compatible with legacy image work records.

- [ ] **Step 1: Add failing tests for image and video asset import, legacy image fallback, owner-scoped references and no duplicate source nodes.**
- [ ] **Step 2: Implement the pure canvas asset adapter without changing generation handlers.**
- [ ] **Step 3: Wire existing Works/Canvas import paths to retain canonical references when present.**
- [ ] **Step 4: Add explicit empty, loading, stale and unauthorized asset states close to the affected Canvas/Works action.**
- [ ] **Step 5: Run Canvas, Works, project and video contract tests without any provider call.**
- [ ] **Step 6: Commit as `feat: preserve canonical assets across canvas and works`.**

### Task 5: Shared integration gate and browser QA

**Files:**
- Modify: `docs/superpowers/plans/2026-08-19-cross-domain-asset-contract.md`
- Modify: `RTK.md` only after fresh evidence is collected
- Test/inspect: all changed files and existing runtime contracts

- [ ] **Step 1: Review both thread diffs and reject any unapproved modification to shared files.**
- [ ] **Step 2: Run `npm test`, `npm run build`, `npm run check`, `npm run collab:check`, and `git diff --check`.**
- [ ] **Step 3: Run local browser checks for project restore, Works, Canvas import, asset unauthorized state, mobile layout and reduced-motion behavior.**
- [ ] **Step 4: Run local no-paid video verification and the existing project/Canvas/ecommerce test suites.**
- [ ] **Step 5: Confirm there are no provider submissions, billing mutations, production deployment or generated quota usage.**
- [ ] **Step 6: Record exact evidence and residual risks; do not deploy this phase.**
