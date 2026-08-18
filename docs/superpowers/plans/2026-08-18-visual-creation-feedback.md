# 自由创作配置反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the free-creation configuration panels with visual style examples, clear title hierarchy, live point estimates, and a safe disabled initial generation state.

**Architecture:** Keep `VisualCreationMode.jsx` as the composition owner, add option metadata and a pure estimate helper to `visualCreationModel.js`, and reuse existing ecommerce image model catalog and static visual recipe assets. The client estimate is advisory; `regenerateCanvasImage` continues to request the authoritative server quote immediately before generation.

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

### Task 2: Update the free-creation panels

**Files:**
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`

**Interfaces:**
- `VisualRecipePanel` renders image-backed style cards.
- `VisualCreationMode` derives button readiness and estimate from current state.

- [ ] **Step 1: Add UI contract assertions** for image sources, disabled state, estimate helper, and non-duplicated inner labels.
- [ ] **Step 2: Run the focused UI test and confirm failure.**
- [ ] **Step 3: Implement the cards, title hierarchy, live estimate, and `canGenerate` guard.**
- [ ] **Step 4: Run focused UI/model tests and confirm pass.**

### Task 3: Regression and browser verification

**Files:**
- Modify: `test/visual-creation-ui.test.mjs` only if contract assertions need adjustment.

- [ ] **Step 1: Run the visual creation test suite.**
- [ ] **Step 2: Run the complete test suite and production build.**
- [ ] **Step 3: Verify desktop and mobile panel opening, card imagery, live estimate, and disabled/enabled button states in the browser.**
