# Unified Creation Showcase Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the four creation capabilities share the ecommerce-style capability showcase while keeping ecommerce/video confirmation depth and giving XHS/Plog/free creation direct, understandable result workspaces.

**Architecture:** Keep `home` as the lightweight creation hub, add a shared `CreationShowcase` frame for capability examples, and introduce a content result workspace that renders the 9-image/article deliverable from existing result data. Reuse the ecommerce upload deck through a configurable role adapter instead of maintaining a second thumbnail-only picker. Keep video at `video-studio`, canvas at `ec-canvas`, and preserve the ecommerce direction step.

**Tech Stack:** React 18, Vite, existing `lucide-react`/`react-icons`, Node `node:test`, existing `ResponsiveImage`, current AppContext and work persistence APIs.

## Global Constraints

- The second left navigation item is video creation; the third is canvas; the fourth opens works inside canvas.
- All four capabilities remain reachable from the first `生图` home entry.
- Ecommerce keeps `upload → direction confirmation → generation/canvas`.
- Video keeps material analysis and generation-plan confirmation.
- XHS/Plog and free creation do not receive an ecommerce-style design-direction page.
- Capability examples are static/curated display data and never trigger generation or billing.
- XHS/Plog results must show 9 images plus title, body, and hashtags as one understandable deliverable.
- Every delivered XHS/Plog image keeps its actual prompt and page metadata for later case reuse.
- Private works do not automatically become public Inspiration cases.
- Preserve unrelated dirty files; never use `git add .`.
- Do not trigger paid video generation during development or verification.

---

## File Map

### New files

- `src/pages/Home/creationShowcaseModel.js` — normalizes capability showcase data and display variants.
- `src/pages/Home/CreationShowcase.jsx` — shared capability-example frame and variant renderers.
- `src/pages/Home/CreationShowcase.css` — shared showcase layout, responsive rules, focus states.
- `src/pages/Home/contentPublishPreviewModel.js` — normalizes XHS/Plog result data into a 9-image/article view model.
- `src/components/creation/ContentPublishWorkspace.jsx` — result workspace with overview, originals, and publish-preview modes.
- `src/components/creation/ContentPublishWorkspace.css` — result workspace visual system.
- `test/creation-showcase-model.test.mjs` — showcase data and mode contract tests.
- `test/content-publish-preview.test.mjs` — content result normalization and fallback tests.
- `test/creation-navigation-contract.test.mjs` — navigation and flow contract tests.

### Modified files

- `src/pages/Home/ec/EcommerceWorkbench.jsx` — use the shared showcase frame for existing ecommerce suite and try-on examples; keep upload/generation logic intact.
- `src/pages/Home/XhsContentMode.jsx` — use the shared content showcase, configurable upload deck, and expose the content result view model.
- `src/pages/Plog/index.jsx` — use the same content showcase/upload deck/result data contract for the standalone Plog path.
- `src/pages/VideoStudio/index.jsx` — add the shared video capability showcase without changing plan confirmation or job polling.
- `src/pages/Home/VisualCreationMode.jsx` — mount shared showcase framing around existing four-skill examples without removing lightweight configuration.
- `src/pages/Home/index.jsx` — pass the active mode/submode into the shared showcase and preserve the existing home hub state.
- `src/App.jsx` — render `ContentPublishWorkspace` for XHS/Plog results instead of making the global note modal the only result surface.
- `src/components/creation/ContentReferencePicker.jsx` — replace the independent thumbnail implementation with the configurable ecommerce upload-deck adapter or retire it after all consumers migrate.
- `src/pages/Home/ec/components/SupplementAssetDeck.jsx` — add role configuration while preserving current ecommerce defaults.
- `src/pages/Home/ec/components/SupplementImageCard.jsx` — accept role-specific suggestion/status configuration while preserving product/reference defaults.
- `src/pages/Home/ec/components/supplementUploadModel.js` — expose role-neutral suggestion and count helpers used by both ecommerce and content decks.
- `src/pages/Home/GallerySection.jsx` — render XHS/Plog public cases with a content成品板 cover when result data contains 9 images and article fields.
- `src/pages/Home/galleryModel.js` — normalize content-case assets and preserve prompt/replay metadata.
- `src/NoteModal.jsx` — keep legacy visual/ecommerce behavior and route content cases/results to the new content workspace when needed.
- `test/content-reference-picker-ui.test.mjs` — update semantic upload assertions to target the shared role deck.
- `test/gallery-workbench-continuity.test.mjs` — cover content case overview and replay preservation.
- `test/ecommerce-work-persistence.test.mjs` — retain prompt persistence regression coverage while accepting the new result shape.

---

## Task 1: Lock the navigation and showcase data contracts

**Files:**

- Create: `src/pages/Home/creationShowcaseModel.js`
- Create: `test/creation-showcase-model.test.mjs`
- Create: `test/creation-navigation-contract.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/pages/Home/index.jsx`

**Interfaces:**

- Produce `normalizeShowcase({ mode, subMode, entry }) -> { id, mode, subMode, eyebrow, title, description, kind, assets, outputLabel }`.
- Produce `creationNavigationContract() -> { primary: 'home', video: 'video-studio', canvas: 'ec-canvas', works: { page: 'ec-canvas', tab: 'works' } }`.
- Produce `isDirectCreationMode(mode) -> boolean`, returning `true` for `content` and `visual`, `false` for `ecommerce` and `video`.

- [ ] **Step 1: Write failing model tests.**

```js
test('navigation keeps video and canvas on distinct left-nav destinations', () => {
  const contract = creationNavigationContract();
  assert.equal(contract.video, 'video-studio');
  assert.equal(contract.canvas, 'ec-canvas');
  assert.equal(contract.works.page, 'ec-canvas');
});

test('showcase normalization distinguishes direct content from confirmed ecommerce/video flows', () => {
  assert.equal(isDirectCreationMode('content'), true);
  assert.equal(isDirectCreationMode('visual'), true);
  assert.equal(isDirectCreationMode('ecommerce'), false);
  assert.equal(isDirectCreationMode('video'), false);
});
```

- [ ] **Step 2: Run the focused tests and verify failure.**

Run: `node --test test/creation-showcase-model.test.mjs test/creation-navigation-contract.test.mjs`

Expected: FAIL because the new model functions do not exist.

- [ ] **Step 3: Implement the pure model and export it.**

Use stable mode IDs (`ecommerce`, `video`, `content`, `visual`) and content submode IDs (`content`, `plog`). Do not read AppContext or touch the DOM from the model.

- [ ] **Step 4: Add source-level navigation assertions.**

Assert `src/App.jsx` keeps `video-studio` on the `SquarePlay` item and `ec-canvas` on the `LayoutGrid` item, and `src/pages/Home/index.jsx` keeps the four mode options under the home workbench.

- [ ] **Step 5: Run focused tests and commit.**

Run: `node --test test/creation-showcase-model.test.mjs test/creation-navigation-contract.test.mjs`

Expected: PASS.

Commit: `git add src/pages/Home/creationShowcaseModel.js src/App.jsx src/pages/Home/index.jsx test/creation-showcase-model.test.mjs test/creation-navigation-contract.test.mjs && git commit -m "test: lock creation navigation contracts"`

---

## Task 2: Build the shared ecommerce-style capability showcase

**Files:**

- Create: `src/pages/Home/CreationShowcase.jsx`
- Create: `src/pages/Home/CreationShowcase.css`
- Modify: `src/pages/Home/creationShowcaseModel.js`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/VideoStudio/index.jsx`
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Home/index.jsx`
- Test: `test/creation-showcase-model.test.mjs`

**Interfaces:**

- `CreationShowcase({ mode, subMode, entries, onOpen })` renders the shared left-copy/right-visual frame.
- `CreationShowcase` supports `product-suite`, `anything-tryon`, `content-set`, `plog-set`, `video-workflow`, and `visual-skill` display kinds.
- Existing ecommerce showcase assets remain sourced from `productionCaseCatalog.js`; no new generation call is introduced.

- [ ] **Step 1: Add failing showcase variant tests.**

Test that ecommerce, content, Plog, video, and visual variants normalize to distinct `kind` values, that content output copy includes `9 张配图`, and that a missing asset produces a safe text fallback.

- [ ] **Step 2: Implement `CreationShowcase` using the ecommerce frame.**

The shared frame must have:

```jsx
<section className="creation-showcase">
  <div className="creation-showcase-copy">...</div>
  <div className="creation-showcase-visual">...</div>
</section>
```

Keep the existing warm gradient surface, white image frames, clickable enlarge affordance, case labels, and mobile stacked layout. Avoid adding unrelated decorative card grids.

- [ ] **Step 3: Move existing ecommerce display bodies behind the shared frame.**

The product-suite earbud composite and try-on workflow continue using their existing assets and interactions, but their outer layout and responsive rules come from `CreationShowcase.css`. The upload deck and ecommerce handlers remain unchanged.

- [ ] **Step 4: Add content/video/visual example entries.**

Use existing local curated assets where available. For XHS/Plog, use a 9-tile content board plus article copy; for video, show the material → plan → output relationship without pretending a static image is a playable video; for visual, reuse the selected skill’s existing showcase assets.

- [ ] **Step 5: Mount the showcase in each capability workbench.**

The showcase appears above the input area in the home embedded workbench and in the standalone video path where that path has a full header. It must be display-only and must not change generation state or billing.

- [ ] **Step 6: Run showcase tests and commit.**

Run: `node --test test/creation-showcase-model.test.mjs test/home-showcase-composites.test.mjs`

Expected: PASS.

Commit: `git add src/pages/Home/CreationShowcase.jsx src/pages/Home/CreationShowcase.css src/pages/Home/creationShowcaseModel.js src/pages/Home/ec/EcommerceWorkbench.jsx src/pages/VideoStudio/index.jsx src/pages/Home/VisualCreationMode.jsx src/pages/Home/XhsContentMode.jsx src/pages/Home/index.jsx test/creation-showcase-model.test.mjs && git commit -m "feat: unify creation capability showcases"`

---

## Task 3: Reuse the ecommerce upload deck for XHS/Plog roles

**Files:**

- Modify: `src/pages/Home/ec/components/supplementUploadModel.js`
- Modify: `src/pages/Home/ec/components/SupplementImageCard.jsx`
- Modify: `src/pages/Home/ec/components/SupplementAssetDeck.jsx`
- Modify: `src/components/creation/ContentReferencePicker.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Modify: `test/content-reference-picker-ui.test.mjs`

**Interfaces:**

- `SupplementAssetDeck` keeps its current default props and adds an optional `roleConfig` object:

```js
{
  primary: { key, label, max, hint, suggestions, accent },
  secondary: { key, label, max, hint, suggestions, accent }
}
```

- `ContentReferencePicker` becomes a compatibility adapter that passes `styleImages` and `sourceImages` through the shared deck, or is removed only after both XHS/Plog consumers migrate.
- Existing ecommerce calls with `productImages` and `referenceImages` retain their current labels, limits, inherited-image behavior, and callbacks.

- [ ] **Step 1: Add failing source contract tests.**

Assert the shared deck exposes configurable role labels, max counts, and suggestions; assert the old ecommerce default strings remain present; assert XHS/Plog no longer render the independent 58px rail implementation.

- [ ] **Step 2: Make supplement helpers role-neutral.**

Move suggestion lookup behind a supplied suggestion list while keeping `PRODUCT_IMAGE_SUGGESTIONS` and `REFERENCE_IMAGE_SUGGESTIONS` as defaults. Preserve validation, blob cleanup, inherited image handling, and current callback signatures.

- [ ] **Step 3: Add role configuration to `SupplementImageCard` and `SupplementAssetDeck`.**

The shared implementation must continue rendering the existing ecommerce horizontal lanes, dashed add card, count, preview, delete, and suggestion area. Content roles only change labels, hints, accent, limits, and source type.

- [ ] **Step 4: Replace XHS/Plog picker usage with the shared deck.**

Configure:

```js
primary: { key: 'style', label: '风格参考', max: 3 }
secondary: { key: 'source', label: '我的素材', max: 6 }
```

For Plog, use `生活素材` as the secondary label. Preserve the semantic API payload `{ style, source }` and old `referenceAssetIds` fallback.

- [ ] **Step 5: Run focused upload tests and commit.**

Run: `node --test test/content-reference-picker-ui.test.mjs test/content-reference-assets.test.mjs test/content-reference-router.test.mjs`

Expected: PASS.

Commit: `git add src/pages/Home/ec/components/supplementUploadModel.js src/pages/Home/ec/components/SupplementImageCard.jsx src/pages/Home/ec/components/SupplementAssetDeck.jsx src/components/creation/ContentReferencePicker.jsx src/pages/Home/XhsContentMode.jsx src/pages/Plog/index.jsx test/content-reference-picker-ui.test.mjs && git commit -m "refactor: reuse ecommerce asset deck for content roles"`

---

## Task 4: Add the XHS/Plog content result workspace

**Files:**

- Create: `src/pages/Home/contentPublishPreviewModel.js`
- Create: `src/components/creation/ContentPublishWorkspace.jsx`
- Create: `src/components/creation/ContentPublishWorkspace.css`
- Modify: `src/App.jsx`
- Modify: `src/NoteModal.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Create: `test/content-publish-preview.test.mjs`

**Interfaces:**

- `normalizeContentPublishResult(item) -> { kind, title, body, hashtags, images, cover, promptRecords, layout }`.
- `ContentPublishWorkspace({ item, onClose, onDownload, onCopy, onSendToCanvas, onRegenerate })` supports `overview`, `originals`, and `publish` internal views.
- The component accepts both current XHS/Plog result shapes (`_saveKey`, `_plogResult`, `cover_url`, `image_urls`, `image_prompts`) and legacy gallery shapes.

- [ ] **Step 1: Write failing normalization tests.**

Cover these cases:

1. nine-image XHS result with title/body/hashtags;
2. Plog result with cover plus eight image URLs;
3. legacy result with only `cover_url` and strings;
4. prompt records mapped by `page_id` without losing `shot_role` or `reference_use`.

- [ ] **Step 2: Implement the pure result adapter.**

Always return exactly nine display slots when the result is a complete set; use explicit loading/failed placeholders only for incomplete active generation, not for old saved works. Never expose raw prompts in the visible article copy.

- [ ] **Step 3: Implement the overview view.**

Render one ecommerce-style finished-content board:

```text
left:  content type, title, body excerpt, tags, “9 张配图 · 1 篇正文”
right: 3×3 image board with cover marker
```

The board must have keyboard-accessible buttons for opening originals and publish preview.

- [ ] **Step 4: Implement originals and publish preview views.**

Originals: 3-column image grid, page number, shot role, single-image enlarge/download. Publish: narrow note-reading layout with cover, title, body, tags, and all content images. Do not add fake like/comment/account controls.

- [ ] **Step 5: Route content results through the workspace.**

In `App.jsx`, detect `_xhsResult`, `_plogResult`, or `type` values `xhs-content`/`xhs-plog` before the generic `NoteModal` branch. Keep ecommerce, visual, and gallery legacy behavior unchanged. Preserve global callbacks for download, save, regeneration, and canvas handoff.

- [ ] **Step 6: Keep prompt persistence wired.**

Confirm `image_prompts` remains present on the result passed to `saveWork`, and that `ContentPublishWorkspace` reads it only as metadata for regeneration/case replay. Add a persistence assertion to `test/ecommerce-work-persistence.test.mjs` if the result adapter changes field placement.

- [ ] **Step 7: Run focused result tests and commit.**

Run: `node --test test/content-publish-preview.test.mjs test/ecommerce-work-persistence.test.mjs test/xhs-creative-planner.test.mjs`

Expected: PASS.

Commit: `git add src/pages/Home/contentPublishPreviewModel.js src/components/creation/ContentPublishWorkspace.jsx src/components/creation/ContentPublishWorkspace.css src/App.jsx src/NoteModal.jsx src/pages/Home/XhsContentMode.jsx src/pages/Plog/index.jsx test/content-publish-preview.test.mjs test/ecommerce-work-persistence.test.mjs && git commit -m "feat: add content publish result workspace"`

---

## Task 5: Make Inspiration cases show the complete content deliverable

**Files:**

- Modify: `src/pages/Home/galleryModel.js`
- Modify: `src/pages/Home/GallerySection.jsx`
- Modify: `src/NoteModal.jsx`
- Modify: `test/gallery-workbench-continuity.test.mjs`

**Interfaces:**

- `contentGalleryItem(item) -> item` preserves `images`, `image_urls`, `cover_url`, `title`, `body_text`, `hashtags`, `image_prompts`, and replay fields.
- `galleryType(item)` continues returning `xiaohongshu` for XHS/Plog cases.

- [ ] **Step 1: Add failing content-gallery tests.**

Assert that a content case with 9 images produces a content-board presentation marker, preserves all image prompts, and keeps its “做同款” replay payload.

- [ ] **Step 2: Add the content board as the gallery card visual.**

For XHS/Plog cards, use the same 3×3 board language as `ContentPublishWorkspace` at thumbnail scale. Keep ecommerce and visual cards unchanged.

- [ ] **Step 3: Use the content workspace for case details.**

Opening an XHS/Plog inspiration item must show the complete image/article relationship. “做同款” remains disabled for non-owner private work and continues using saved prompt/input metadata for public cases.

- [ ] **Step 4: Run gallery and replay tests and commit.**

Run: `node --test test/gallery-workbench-continuity.test.mjs test/content-publish-preview.test.mjs`

Expected: PASS.

Commit: `git add src/pages/Home/galleryModel.js src/pages/Home/GallerySection.jsx src/NoteModal.jsx test/gallery-workbench-continuity.test.mjs && git commit -m "feat: show complete content cases in inspiration"`

---

## Task 6: Verify all flows and perform visual QA

**Files:**

- Modify only files required by failing tests or visual regressions from Tasks 1–5.
- Test: existing full test suite and build checks.

- [ ] **Step 1: Run focused suites.**

Run:

```powershell
node --test test/creation-showcase-model.test.mjs test/creation-navigation-contract.test.mjs test/content-reference-picker-ui.test.mjs test/content-publish-preview.test.mjs test/gallery-workbench-continuity.test.mjs test/xhs-creative-planner.test.mjs test/ecommerce-work-persistence.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete test suite.**

Run: `npm test`

Expected: no regressions in ecommerce, video, canvas, billing, persistence, or gallery tests.

- [ ] **Step 3: Build and run repository checks.**

Run: `npm run build; npm run check; npm run collab:check`

Expected: build succeeds, asset references resolve, and collaboration policy reports ready.

- [ ] **Step 4: Browser-check the four entry states.**

Use the local preview to verify:

1. Ecommerce: earbud showcase → input → next → direction confirmation remains available.
2. Video: second left nav opens video studio; plan modal and job result remain available.
3. XHS/Plog: content showcase → grouped upload deck → direct generation → 9-image/article workspace.
4. Visual: four skill examples → lightweight config → image result grid and canvas handoff.

Capture desktop and mobile screenshots for XHS/Plog and verify console errors are absent.

- [ ] **Step 5: Verify no paid video generation.**

Confirm test and browser QA use mock/local states only; do not submit a real video job.

- [ ] **Step 6: Commit only verified fixes.**

Run: `git diff --check` and `git status --short`; confirm unrelated dirty files remain untouched. Commit any final task-scoped fixes with a focused message.

---

## Self-review

- Navigation mapping is covered by Task 1 and browser verification in Task 6.
- Shared ecommerce-style showcase is covered by Task 2.
- XHS/Plog asset upload reuse is covered by Task 3.
- Direct generation and 9-image/article result presentation are covered by Task 4.
- Inspiration case overview and prompt replay are covered by Task 5.
- Ecommerce/video/free-creation complexity boundaries are covered by Tasks 2, 4, and 6.
- Private/public case separation remains covered by Task 5 and existing gallery replay behavior.
- Every new function named in later tasks is defined in its task’s interface block or an earlier task.
- No task introduces a new top-level route for XHS/Plog/free creation.
