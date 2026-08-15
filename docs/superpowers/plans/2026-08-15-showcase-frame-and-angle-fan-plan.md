# Showcase Frame And Angle Fan Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the product-suite and try-on showcase frames while replacing the multi-angle banner with a four-card fan that preserves complete models and removes the flatlay/arrow stages.

**Architecture:** Keep the existing production case catalog and `EcommerceWorkbench` boundaries. Generate a versioned 1600x900 multi-angle composite from exactly four existing model-angle assets, point the catalog at it, and use one shared CSS frame contract so the product suite remains a complete 4:3 `contain` image inside the same outer footprint as the 16:9 try-on banner.

**Tech Stack:** React, CSS, Node.js ESM, Sharp, Node test runner, Vite.

## Global Constraints

- Do not modify AI video workbench, video tasks, providers, or deployment logic.
- Preserve the accepted product-suite 4:3 production asset and its exact prompts/provenance.
- Do not crop the 4:3 product-suite image to 16:9.
- Keep existing `ResponsiveImage`, gallery modal, Escape, keyboard, and remix data flows.
- Explicitly stage only files belonging to this feature; preserve unrelated user runtime changes.

### Task 1: Lock the failing contracts

**Files:**
- Modify: `test/home-showcase-composites.test.mjs`
- Modify: `test/production-case-catalog.test.mjs`
- Modify: `test/ecommerce-ability-ui-contract.test.mjs` if the existing selector contract references the old banner id

**Interfaces:**
- Consumes: existing `HOME_SHOWCASE_COMPOSITES`, `TRYON_LAYOUT_PLANS`, and `PRODUCTION_CASE_CATALOG` exports.
- Produces: exact assertions for the new versioned angle banner, four source images, no product stage, no arrow decoration, shared frame sizing declarations, and preserved product-suite 4:3 ratio.

- [ ] **Step 1: Write the failing composite contract.**

  Change the multi-angle expectations to require `editorial-multi-angle-v4`, four `sources`, `stages: ['result-fan']`, no `product` or `arrow` plan entry, rotations `[-8, -3, 3, 8]`, and a visual bound that leaves at least 24px on every canvas edge.

- [ ] **Step 2: Write the failing catalog contract.**

  Assert that the try-on angle workflow asset points to `/images/home/tryon-showcase/editorial-multi-angle-v4.webp`, remains `16:9`, and that the four angle result assets are the only `result` sources used by that workflow. Keep the product-suite final composite assertion at `4:3`.

- [ ] **Step 3: Run the focused tests and verify they fail for the old contract.**

  Run `node --test test/home-showcase-composites.test.mjs test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs`.

  Expected: FAIL because the implementation still exposes `editorial-multi-angle-v3`, includes the flatlay product stage, and still has arrow metadata.

### Task 2: Build and publish the four-angle fan asset

**Files:**
- Modify: `scripts/build-home-showcase-composites.mjs`
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Create: `public/images/home/tryon-showcase/editorial-multi-angle-v4.webp`
- Create: `public/images/.thumbs/home/tryon-showcase/editorial-multi-angle-v4.webp`
- Test: `test/home-showcase-composites.test.mjs`

**Interfaces:**
- Consumes: `angle-front.png`, `angle-motion.png`, `angle-side.png`, and `angle-back.png` from `public/images/home/tryon-showcase`.
- Produces: `HOME_SHOWCASE_COMPOSITES` entry `editorial-multi-angle-v4`, `TRYON_LAYOUT_PLANS['editorial-multi-angle-v4']`, and catalog workflow URL used by `TryOnShowcase`.

- [ ] **Step 1: Replace the multi-angle definition with a versioned four-source definition.**

  Set `id: 'editorial-multi-angle-v4'`, keep `kind: 'multi-angle'`, `extension: 'webp'`, `ratio: '16:9'`, `width: 1600`, `height: 900`, and set `sources` to exactly the four angle files in front, motion, side, back order.

- [ ] **Step 2: Define a fan-only layout plan.**

  Use `stages: ['result-fan']`, `fit: 'cover'`, `blurPadding: false`, no `product` or `arrow`, and four complete card placements centered in the canvas. Keep the card heights within 704px before rotation and set the outer visual bounds to at least `{ left: 24, top: 42, right: 1576, bottom: 858 }`.

- [ ] **Step 3: Remove product/arrow composition from `buildMultiAngle`.**

  Map every source directly to `plan.resultCards`, call `placedCard` for each, and composite only those four buffers over a quiet background with a soft grounding shadow. Delete the arrow SVG path and product placement from this build path. Keep the reference workflow builder unchanged.

- [ ] **Step 4: Generate the new image and thumb with the existing script.**

  Run `node scripts/build-home-showcase-composites.mjs` from the stability worktree. Verify Sharp reports exactly `1600x900` for the full asset and that the thumb exists under `.thumbs`.

- [ ] **Step 5: Point the production catalog at v4.**

  Change only the multi-angle workflow banner source and label metadata needed for the new composition. Keep the four individual result assets and their prompts/provenance intact.

- [ ] **Step 6: Run the focused tests and commit the asset contract.**

  Run `node --test test/home-showcase-composites.test.mjs test/production-case-catalog.test.mjs test/ecommerce-ability-ui-contract.test.mjs`. Expected: PASS. Commit with `git add` limited to the script, catalog, tests, and two v4 image files, then `git commit -m "fix: rebuild try-on angle fan showcase"`.

### Task 3: Unify showcase frames and preview sizing

**Files:**
- Modify: `src/pages/Home/Home.css`
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx` only if the shared frame needs a semantic class or stable preview wrapper
- Modify: `test/home-showcase-composites.test.mjs` or the relevant Home UI contract test for stable class/ratio assertions

**Interfaces:**
- Consumes: `finalComposite.ratio`, `slide.banner.ratio`, and the v4 catalog asset.
- Produces: matching outer frame dimensions, complete 4:3 product image, complete 16:9 try-on banner, and a preview dialog without artificial top whitespace.

- [ ] **Step 1: Add shared frame tokens at the end of `Home.css`.**

  Define `--ec-showcase-frame-height` and `--ec-showcase-visual-padding` once. Apply them to `.ec-product-suite-showcase`, `.ec-tryon-showcase`, `.ec-product-suite-showcase-visual`, and `.ec-tryon-showcase-visual`; keep the product image aspect ratio at `4 / 3` and the try-on banner at `16 / 9`.

- [ ] **Step 2: Constrain product-suite content without cropping.**

  Set `.ec-product-suite-final` to `width: min(520px, 100%)` (with a responsive reduction at 980px/640px), preserve `aspect-ratio: 4 / 3`, and keep both the responsive wrapper and image at `object-fit: contain`. The shared visual region must remain the same height as the try-on region.

- [ ] **Step 3: Make the v4 banner fill its shared visual region.**

  Set `.ec-tryon-workflow-banner` to `width: min(620px, 100%)`, `aspect-ratio: 16 / 9`, and `object-fit: contain`; remove any transform or fixed image height that can create an inner blank band. Keep the frame border and maximize control stable.

- [ ] **Step 4: Correct preview dialog alignment.**

  Adjust the final preview rules so the image is centered in the available stage, capped by both width and `72vh`, and the dialog content starts at the usable top edge. Avoid a fixed top offset or an image height that leaves a large blank strip above a complete 4:3 image.

- [ ] **Step 5: Run UI tests and build.**

  Run `node --test test/home-showcase-composites.test.mjs test/production-case-catalog.test.mjs test/gallery-experience.test.mjs test/ecommerce-ability-ui-contract.test.mjs` and `npm run build`. Expected: all focused tests pass and Vite reports the production bundle built successfully.

- [ ] **Step 6: Commit the frame refinement.**

  Run `git diff --check`, stage only `Home.css`, any necessary `EcommerceWorkbench.jsx`/test changes, and commit with `git commit -m "fix: align showcase frames and preview sizing"`.

### Task 4: Browser verification and release handoff

**Files:**
- Modify: none unless a browser regression is found
- Test artifacts: local `.tmp/qa-showcase-refinement/` only; do not stage

**Interfaces:**
- Consumes: the two feature commits and built application.
- Produces: verified desktop/mobile screenshots and a release readiness report.

- [ ] **Step 1: Start the local app using the repository’s existing dev command.**

  Use an unused port, then open the Home page in the browser QA tool. Do not touch production or the AI video task.

- [ ] **Step 2: Verify the product suite frame.**

  At 1440px, record `getBoundingClientRect()` for `.ec-product-suite-showcase` and `.ec-tryon-showcase`; assert equal outer heights. Record `.ec-product-suite-final img` natural dimensions and `objectFit`; assert `2400x1792` (or the current stable source dimensions), `contain`, and no horizontal scroll.

- [ ] **Step 3: Verify both try-on slides.**

  Assert the v4 banner is `1600x900`, capture the first slide, switch to the second slide, and confirm the second workflow remains complete. Inspect the first slide screenshot for exactly four model cards, no flatlay, no straight arrow, no cut feet, and no inner white padding beyond the deliberate card borders.

- [ ] **Step 4: Verify the preview modal.**

  Open the product suite and try-on previews, capture screenshots, and assert no large top whitespace, correct close/Escape behavior, and no console errors or failed image requests.

- [ ] **Step 5: Repeat at 390x844.**

  Confirm `document.documentElement.scrollWidth <= innerWidth`, both shared frames stay inside the viewport, and no cards or labels overlap.

- [ ] **Step 6: Run final repository checks and report.**

  Run `npm run collab:check`, `git diff --check`, and `git status --short`. Do not deploy unless the user separately authorizes a production release.
