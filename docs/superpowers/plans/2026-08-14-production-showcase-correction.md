# Production Showcase Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace rejected static ecommerce cases with traceable ShuBao production results and make every ecommerce/visual showcase compact, complete, consistently styled, and fast to decode.

**Architecture:** Keep production provenance in `productionCaseCatalog.js`, rendering behavior in the existing workbench components, and visual composition in the existing page CSS. Production generation is performed through the deployed ShuBao API and downloaded into versioned public assets before the catalog is updated.

**Tech Stack:** React, Vite, Vitest, CSS, Node.js production scripts, ShuBao ecommerce generation API.

## Global Constraints

- Ecommerce cases require ShuBao production task and request identifiers.
- Source assets are complete uploaded images, never crops or output montages.
- Cards preserve natural media ratio and do not add fixed-frame letterboxing.
- Ecommerce showcase and composer use one continuous warm gradient.
- All four visual-creation stages share one outer size.
- Deployment uses `scripts/deploy-production.ps1` and completes public canary verification.

### Task 0: Production Upload Reliability

**Files:**
- Modify: `src/services/api.js`
- Modify: `server/ecommerceEngine/assetUpload.mjs`
- Modify: `server/index.mjs`
- Test: `test/ecommerce-upload-contract.test.mjs`
- Test: `test/ecommerce-asset-upload.test.mjs`

- [ ] Reproduce the production upload failure without repeating a paid generation request.
- [ ] Add failing contracts for direct binary upload, bounded transient retry, and same-file request deduplication.
- [ ] Preserve the existing content-hash idempotency contract on the server while accepting raw image bytes.
- [ ] Run the focused upload tests before retrying the real product-suite task.

---

### Task 1: Production Case Contract

**Files:**
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Test: `test/homeProductionCaseCatalog.test.js`

**Interfaces:**
- Consumes: production task output metadata and downloaded asset URLs.
- Produces: `productionCaseById(id)` entries with `status: 'production'`, complete role assignments, and immutable task metadata.

- [ ] Write a failing catalog test asserting `product-suite`, `tryon-angles`, and `tryon-reference` are production cases and every output has `taskId` and `requestKey`.
- [ ] Run `npx vitest run test/homeProductionCaseCatalog.test.js` and confirm the curated cases fail the new assertions.
- [ ] Replace the curated entries with production task assets and explicit source/reference roles.
- [ ] Re-run the catalog test and confirm it passes.

### Task 2: Real Product Suite and Try-on Assets

**Files:**
- Create: `public/images/home/product-suite/earbuds-*.webp`
- Create: `public/images/home/tryon-showcase/fashion-*.webp`
- Modify: `scripts/generate-production-tryon-case.mjs` only if the existing request contract cannot express the approved shots.

**Interfaces:**
- Consumes: user-provided reference images and structured ecommerce prompts.
- Produces: complete source/reference media plus production result files and task identifiers.

- [ ] Prepare a structured pearl-white/champagne-gold earbuds prompt that locks identity, materials, product count, four ecommerce panels, and no copied brand.
- [ ] Submit the product suite through ShuBao's deployed ecommerce generation API, wait for a terminal successful task, and download its stable assets.
- [ ] Submit two try-on tasks: flatlay to four-angle fashion views, and flatlay plus full reference model to a full-body street result.
- [ ] Verify every file decodes, inspect pixel dimensions, and reject any cropped source or montage mislabeled as input.

### Task 3: Compact Ecommerce Showcase

**Files:**
- Modify: `src/pages/Home/ec/EcommerceWorkbench.jsx`
- Modify: `src/pages/Home/Home.css`
- Test: `test/ecommerceWorkbench.test.jsx`

**Interfaces:**
- Consumes: `productionCaseById()` assets.
- Produces: compact ability selector, product-suite editorial board, and two try-on workflow slides.

- [ ] Add failing component assertions for compact selectors, one-layer showcase structure, complete input roles, and zoomable output media.
- [ ] Restore compact selector height and render a restrained three-card fan thumbnail derived from each case.
- [ ] Render the earbuds suite as one dominant panel plus three supporting production panels without nested background layers.
- [ ] Render try-on slide A as flatlay to a fanned four-angle result and slide B as flatlay plus model to a full-body result.
- [ ] Consolidate late CSS overrides into one final contract and make mobile dimensions bounded.
- [ ] Run the targeted tests and confirm they pass.

### Task 4: Unified Visual Creation Stage and Loading

**Files:**
- Modify: `src/pages/Home/VisualCreationMode.jsx`
- Modify: `src/pages/Home/VisualCreationMode.css`
- Test: `test/visualCreationMode.test.jsx`

**Interfaces:**
- Consumes: `selectedShowcase.assets` and media ratios.
- Produces: fixed-size common stage, mirrored social layouts, and active-slide eager loading.

- [ ] Add failing assertions that every mode uses the common stage class and social alternate slides use mirrored layouts.
- [ ] Replace mode-specific outer sizing with one common stage height and ratio-aware internal composition.
- [ ] Tighten social landscape-card stacking, mirror the alternate slide, and remove blank fixed frames.
- [ ] Eager-load active media, preload only the next slide after decode, and keep inactive media lazy.
- [ ] Run targeted tests and confirm they pass.

### Task 5: Integrated Verification and Deployment

**Files:**
- Modify: `RTK.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: completed implementation and production assets.
- Produces: tested commit, production release, and recovery evidence.

- [ ] Run targeted tests, full `npm run check`, and `npm run build`.
- [ ] Start the local app and capture desktop plus 390px screenshots; verify decoded images, equal stage sizes, no clipping, and no horizontal overflow.
- [ ] Commit only task-owned files, preserving all existing user runtime changes.
- [ ] Deploy with `scripts/deploy-production.ps1` and wait for the real generation and 600-second canary checks.
- [ ] Verify public HTML/version, health, audit, image decoding, and desktop/mobile screenshots.
- [ ] Record release, production task IDs, and online evidence in `RTK.md` and the progress ledger.
