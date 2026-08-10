# Video Creation Experience Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the product's video creation experience around three distinct marketing-video jobs across the standalone studio and commerce Canvas.

**Architecture:** A small `videoStudioModel.js` owns the user-facing modes, their upstream API translation, and input requirements. `VideoStudioPage` uses that model and one material composer instead of separate script and reference flows. Canvas imports the same mode translation so its video composer has the same behavior and can continue the work from either surface.

**Tech Stack:** React, JavaScript modules, Node test runner, existing video service and Canvas studio model.

## Global Constraints

- Use exactly `智能成片`, `首尾帧`, and `爆款重构` as the visible video jobs.
- `智能成片` accepts optional images, videos, and audio; it maps to upstream `script` without reference materials and `reference` when any image, video, or audio exists.
- `首尾帧` requires both `first` and `last` image arrays; `爆款重构` requires both `images` and `videos` arrays.
- Do not invoke paid video generation during implementation or QA.
- Preserve existing billing quotes, result-to-Canvas import, and durable job polling.
- Do not stage, restore, or alter user-owned `server/extension_tasks/ext_*.json`, `.tmp/`, or `scripts/diagnose-recent-ecommerce-jobs.cjs`.
- Use `apply_patch` for manual file edits and explicit file paths when staging later.

---

### Task 1: Shared Video Job Model And Studio Composer

**Files:**
- Create: `src/pages/VideoStudio/videoStudioModel.js`
- Modify: `src/pages/VideoStudio/index.jsx`
- Modify: `src/pages/VideoStudio/VideoStudio.css`
- Test: `test/video-studio-model.test.mjs`
- Test: `test/video-studio-contract.test.mjs`

**Interfaces:**
- Produces: `VIDEO_CREATION_MODES`, `resolveVideoApiMode(mode, files)`, and `hasRequiredVideoInputs(mode, files)`.
- Consumes: the existing `createVideoJob` payload contract where API modes remain `script`, `frame`, `reference`, and `remake`.

- [ ] **Step 1: Keep the model contract red**

The existing model test must import these exports and expect the exact mode ids and labels:

```js
['smart', 'frame', 'remake']
['智能成片', '首尾帧', '爆款重构']
```

- [ ] **Step 2: Run the focused model test to verify red**

Run: `node --test test/video-studio-model.test.mjs`

Expected: failure because `videoStudioModel.js` does not yet exist.

- [ ] **Step 3: Implement the smallest shared model**

Create `videoStudioModel.js` with these semantics:

```js
export const VIDEO_CREATION_MODES = [
  { id: 'smart', label: '智能成片', hint: '一句话起步，素材可选' },
  { id: 'frame', label: '首尾帧', hint: '用两张图锁定镜头起点和终点' },
  { id: 'remake', label: '爆款重构', hint: '保留参考节奏，替换为你的内容' },
];

export function resolveVideoApiMode(mode, files = {}) {
  if (mode === 'smart') {
    const hasReferences = ['images', 'videos', 'audios'].some(key => files[key]?.length);
    return hasReferences ? 'reference' : 'script';
  }
  return mode;
}

export function hasRequiredVideoInputs(mode, files = {}) {
  if (mode === 'frame') return Boolean(files.first?.length && files.last?.length);
  if (mode === 'remake') return Boolean(files.images?.length && files.videos?.length);
  return true;
}
```

Update the studio to import and use those helpers, default to `smart`, pass `resolveVideoApiMode(mode, files)` into `createVideoJob`, and use `hasRequiredVideoInputs(mode, files)` for enablement.

- [ ] **Step 4: Collapse the duplicate upload entrypoint**

Remove `quickUploadRef` and its hidden input. Keep one `video-content-composer` containing materials, prompt, the mentions tool, the model selector, and the footer. The plus control must activate the material input already rendered in the deck rather than a second upload source.

- [ ] **Step 5: Make the visual hierarchy match the three jobs**

Change the mode tab grid to three columns at desktop widths. Apply `.video-content-composer` to the unified content area. Keep required frame pickers for `frame`; for `smart` and `remake`, use the same material deck. Use mode-specific guidance so `remake` clearly asks for a reference video and replacement product material.

- [ ] **Step 6: Verify focused contract and model tests**

Run: `node --test test/video-studio-model.test.mjs test/video-studio-contract.test.mjs`

Expected: both files pass without real video generation.

### Task 2: Canvas Video Composer Alignment And Empty Canvas Entry

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/canvasStudioModel.js`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Test: `test/canvas-entry-ui.test.mjs`
- Test: `test/video-studio-contract.test.mjs`

**Interfaces:**
- Consumes: `resolveVideoApiMode(mode, files)` from `src/pages/VideoStudio/videoStudioModel.js`.
- Produces: Canvas video generation that stores a user-facing `mode` on the composer node and supplies the resolved upstream API mode without changing its current job or result-node lifecycle.

- [ ] **Step 1: Keep the Canvas red contract**

The existing UI test must require the empty canvas heading `从一个素材开始，继续完成整套视觉内容` and a five-column `.ec-canvas-empty-actions` grid.

- [ ] **Step 2: Run the focused Canvas test to verify red**

Run: `node --test test/canvas-entry-ui.test.mjs`

Expected: failure on the old empty-state heading and flex action layout.

- [ ] **Step 3: Align Canvas empty state with the working model**

Keep image upload, video upload, works import, ecommerce suite, and video creation as five immediately actionable entrypoints. Change the heading to `从一个素材开始，继续完成整套视觉内容` and use a five-column desktop action grid that collapses safely on narrow widths.

- [ ] **Step 4: Use the studio mode resolver in Canvas**

Import `resolveVideoApiMode` in `EcCanvas/index.jsx`. In the Canvas video-generation path, preserve the Canvas-facing mode (`smart`, `frame`, or `remake`) in state and pass the resolver's return value to the existing API call. Do not recreate any server-side API mode or bypass validation.

- [ ] **Step 5: Align Canvas video controls to the same three user jobs**

Set new Canvas video composer nodes to `mode: 'smart'`. In `CanvasVideoComposer`, expose only `智能成片`, `首尾帧`, and `爆款重构`. Reuse `sourceRoles` to mark `first`, `last`, and `reference` images. Extend the existing composer source-upload callback to accept video files for video-composer nodes and create connected uploaded video nodes through `createUploadedVideoNodes`; do not add a second hidden upload mechanism. Allow optional images and videos for smart creation, enforce first/last image roles for frame creation, and enforce at least one image plus one video for remake. Disable the generate command until the selected mode's material requirement is met.

- [ ] **Step 6: Verify Canvas and cross-surface contracts**

Run: `node --test test/canvas-entry-ui.test.mjs test/video-studio-contract.test.mjs`

Expected: both files pass without real video generation.

### Task 3: Global Header And Navigation Behavior

**Files:**
- Create: `src/styles/app-shell.css`
- Modify: `src/App.jsx`
- Modify: `src/pages/Home/Home.css`
- Create: `test/app-shell-contract.test.mjs`
- Test: `test/mobile-layout.test.mjs`

**Interfaces:**
- Produces: one globally loaded shell stylesheet for the top bar and side navigation.
- Preserves: existing navigation actions, login gating, entitlement control, and mobile bottom-navigation placement.

- [ ] **Step 1: Write the shell contract red test**

Assert that `App.jsx` imports `app-shell.css`, the top bar no longer uses sticky positioning, every navigation button has an `app-side-nav-item` class and visible-on-hover label span, and mobile/reduced-motion rules exist in the global stylesheet.

- [ ] **Step 2: Run the shell and mobile tests to verify red**

Run: `node --test test/app-shell-contract.test.mjs test/mobile-layout.test.mjs`

Expected: failure because the shell still uses inline sticky/hover behavior and Home-only mobile rules.

- [ ] **Step 3: Make the top bar part of normal document flow**

Remove `position: 'sticky'` and `top: 0` from the top bar. Keep its brand, account, login controls, spacing, and responsive constraints so it scrolls away instead of covering page content.

- [ ] **Step 4: Build an expanding desktop navigation rail**

Replace imperative `onMouseEnter`/`onMouseLeave` styling with `app-side-nav-item`, active/primary classes, and an `app-side-nav-label` span. Desktop buttons stay 44px square at rest and expand right to reveal their label on hover or keyboard focus. Keep exact `aria-label`, `title`, and `aria-current` behavior; use stable dimensions and visible focus states.

- [ ] **Step 5: Move shell responsiveness into global CSS**

Import `src/styles/app-shell.css` from `App.jsx`. Move the mobile `.app-side-nav` and top-bar rules out of `Home.css` so standalone video and other routes get the same behavior. At `max-width: 639px`, keep the bottom horizontal rail and hide labels; honor `prefers-reduced-motion`.

- [ ] **Step 6: Verify shell tests**

Run: `node --test test/app-shell-contract.test.mjs test/mobile-layout.test.mjs`

Expected: both files pass.

### Task 4: Integration Verification

**Files:**
- Modify only files required by failures from the commands below.

- [ ] **Step 1: Run targeted regression tests**

Run: `node --test test/video-studio-model.test.mjs test/video-studio-contract.test.mjs test/canvas-entry-ui.test.mjs`

Expected: all tests pass.

- [ ] **Step 2: Run the complete serial regression suite**

Run: `npm test`

Expected: no failures.

- [ ] **Step 3: Run build and collaboration checks**

Run: `npm run build` and `npm run collab:check`

Expected: both pass.
