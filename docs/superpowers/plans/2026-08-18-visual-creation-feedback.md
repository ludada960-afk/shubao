# 自由创作配置反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve visual-creation configuration panels with semantic preview cards, a precise source-to-result arrow, clear title hierarchy, live point estimates, and a safe disabled initial generation state.

**Architecture:** Keep `VisualCreationMode.jsx` as the composition owner, add explicit option preview metadata and a pure estimate helper to `visualCreationModel.js`, and reuse existing ecommerce image model catalog and static visual recipe assets. Keep the source-to-result arrow as a local visual component with explicit geometry. The client estimate is advisory; `regenerateCanvasImage` continues to request the authoritative server quote immediately before generation.

**Tech Stack:** React, CSS, Lucide/Material icons, Node test runner, Vite.

## Global Constraints

- Reuse existing ecommerce card patterns and visual recipe assets.
- Do not change server billing, quote, settlement, refund, or generation APIs.
- Preserve unrelated user-owned worktree changes.
- Keep production deployment entrypoint unchanged.

---

### Task 1: Add testable visual metadata and estimate helper

**Files:**
- Modify: `src/pages/Home/visualCreationModel.js`
- Test: `test/visual-creation-model.test.mjs`

**Interfaces:**
- Produce `visualGenerationEstimate({ imageModel, resolution, count }) -> { points, unitsPerImage, quantity }`.
- Produce `controlOptionMeta` for the free skill's three visual-language options.

- [ ] **Step 1: Add failing assertions** for the three image-backed options and estimate values.
- [ ] **Step 2: Run the focused model test and confirm failure.**
- [ ] **Step 3: Implement metadata and pure estimate helper using `generationUnits`.**
- [ ] **Step 4: Run the focused model test and confirm pass.**

### Task 2: Add semantic preview metadata for every primary direction

**Files:**
- Modify: `src/pages/Home/visualCreationModel.js`
- Test: `test/visual-creation-model.test.mjs`

**Interfaces:**
- Each primary `control` may expose `optionMeta` entries with `{ value, image, description }`.
- `VisualRecipePanel` uses metadata when present and retains the icon fallback only for options without a verified image.

- [ ] **Step 1: Add failing assertions** for poster information-priority options and the other primary creation controls, requiring an image and option-specific explanatory text.
- [ ] **Step 2: Run the focused model test and confirm the metadata assertions fail.**
- [ ] **Step 3: Map each primary option to an existing case image that demonstrates the option's actual output, without changing option values or server prompt ids.**
- [ ] **Step 4: Run the focused model test and confirm all preview metadata assertions pass.**

### Task 3: Update the configuration panels and source-to-result arrow

**Files:**
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`
- Modify: `src/pages/Home/CreationShowcase.jsx` or the existing case-preview component that owns the source-to-result visual.
- Modify: the owning CSS file for that preview component.

**Interfaces:**
- `VisualRecipePanel` renders image-backed primary direction cards and style cards.
- `VisualCreationMode` derives button readiness and estimate from current state.
- The source-to-result preview renders a narrow shaft and larger arrowhead sharing the same endpoint.

- [ ] **Step 1: Add UI contract assertions** for image sources, disabled state, estimate helper, and non-duplicated inner labels.
- [ ] **Step 2: Run the focused UI test and confirm failure.**
- [ ] **Step 3: Implement the cards, title hierarchy, live estimate, `canGenerate` guard, and explicit arrow geometry.**
- [ ] **Step 4: Run focused UI/model tests and confirm pass.**

### Task 4: Regression and browser verification

**Files:**
- Modify: `test/visual-creation-ui.test.mjs` only if contract assertions need adjustment.

- [ ] **Step 1: Run the visual creation test suite.**
- [ ] **Step 2: Run the complete test suite and production build.**
- [ ] **Step 3: Verify desktop and mobile panel opening, all primary option preview images, arrow endpoint alignment, live estimate, and disabled/enabled button states in the browser.**
