# Existing Product Requirements Evidence Audit

Date: 2026-08-15

This document is the acceptance ledger for every product requirement raised before AI-video P0 implementation. A requirement is only marked complete when it has code, automated-test, and production evidence. Historical chat claims are not evidence.

## Status Legend

- **Production verified**: deployed through `scripts/deploy-production.ps1` and independently exercised on `https://shuimg.cn/`.
- **Locally verified, deployment pending**: implementation and focused tests pass, but the public site still has the previous behavior.
- **Design complete**: a written, evidence-backed design exists; production implementation has not started.
- **Not independently verified**: code or a contract exists, but there is not enough direct production evidence to claim the behavior.

## A. Ecommerce Workbench And Showcase

| Requirement | Status | Code evidence | Test evidence | Production evidence |
| --- | --- | --- | --- | --- |
| Product-suite and anything-try-on selectors stay compact buttons, use wide fan-like imagery, and do not become oversized content stages | Production verified | `src/pages/Home/ec/EcommerceWorkbench.jsx`, final override block in `src/pages/Home/Home.css` | `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c`; desktop and 390px browser pass |
| Selected selector text is clearly highlighted | Production verified | selected option/check rendering in `EcommerceWorkbench.jsx`; selected-state CSS | `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c` mode-switch QA |
| Product-suite showcase uses one continuous warm-to-white background, not nested color panels | Production verified | `--ec-showcase-surface` and transparent showcase children in `Home.css` | `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c` desktop/mobile QA |
| Product source, main images, and long detail images retain native ratios with no crop or letterbox | Production verified | ratio-driven buttons and `ResponsiveImage` in `EcommerceWorkbench.jsx` | `test/ecommerce-ability-ui-contract.test.mjs`, `test/production-case-catalog.test.mjs` | 112 source/thumbnail pixel decode checks and live lightbox QA in `888b81c` |
| All showcase images open in one lightbox with buttons, arrow keys, and Escape | Production verified | both showcase lightboxes in `EcommerceWorkbench.jsx` | `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c` keyboard QA |
| Try-on upload lanes provide more internal whitespace and separate item/person/scene roles | Production verified | `TryOnImageStack` and semantic lanes in `EcommerceWorkbench.jsx` | `test/production-tryon-case.test.mjs`, `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c` |
| Try-on principles are fixed benefits rather than user checkboxes | Production verified | `ParamsPanel.jsx` principle display | `test/ecommerce-ability-ui-contract.test.mjs` | Release `888b81c` |

## B. Production Showcase Provenance

| Requirement | Status | Evidence and limitation |
| --- | --- | --- |
| Product-suite showcase comes from the ShuBao production path | Production verified | `productionCaseCatalog.js` records the source and five outputs, production request key `showcase-20260814-earbuds-suite`, and prompts. Release `888b81c` replaced the earlier Codex-imagegen mockup. The earlier `1d7eff3` mockup must not be described as production-generated. |
| Try-on uses complete original clothing and reference-person inputs, not cropped pieces extracted from a composite | Production verified | `tryon-product-flatlay` and `tryon-reference-person` are explicit source/reference assets; `test/production-case-catalog.test.mjs` and `test/gallery-remix-model.test.mjs` enforce role preservation; release `888b81c` visually verified full inputs. |
| Try-on angle showcase uses four independent front/motion/side/back outputs | Production verified | `tryon-angles` catalog entry has four independent result assets and stable provenance; catalog tests reject duplicates. |
| Gallery same-style replay imports original source/reference roles, prompt, and parameters | Production verified | `galleryRemixModel.js`; `test/gallery-remix-model.test.mjs`, `test/gallery-workbench-continuity.test.mjs` | Release `888b81c` hover/remix QA |
| Exact provider/model used by every historical showcase asset is disclosed | Not independently verified | Visual cases record Image2-compatible production metadata. The ecommerce catalog records a stable ShuBao request key but does not yet preserve an immutable provider/model snapshot per asset. Do not infer a provider from filenames or marketing labels. This must be corrected by the AI-video/media provenance foundation rather than guessed in UI copy. |

## C. Free Visual Creation

| Requirement | Status | Evidence |
| --- | --- | --- |
| Four modes use distinct, production-backed examples tied to their actual capability instead of one repeated subject | Production verified | `productionCaseCatalog.js` has two chapters and six distinct assets per mode; `visualCreationModel.js`; `test/production-case-catalog.test.mjs`, `test/visual-creation-model.test.mjs` |
| Mode selection uses a light, readable selected state with highlighted text instead of a heavy black block | Production verified | `VisualCreationMode.css`; `test/visual-creation-ui.test.mjs` |
| Every preview stage has the same fixed responsive height; native ratios and mode-specific layouts avoid empty fixed frames | Production verified | `--visual-showcase-height`, layout classes in `VisualCreationMode.css`; `test/visual-creation-ui.test.mjs` | Release `888b81c` desktop/mobile QA |
| Social cover alternates A/B layouts and does not leave a large gap between small cards | Production verified | `.visual-layout-platform-fan.is-alternate`; `test/visual-creation-ui.test.mjs` |
| Preview images can be enlarged and navigated | Production verified | preview dialog and navigation in `VisualCreationMode.jsx`; `test/visual-creation-ui.test.mjs` |
| Upload, prompt, model, ratio, clarity/count controls reuse the ecommerce workbench language and are functional rather than decorative | Production verified | durable upload/generation/save/canvas path in `VisualCreationMode.jsx`; `test/visual-creation-ui.test.mjs`, `test/visual-creation-model.test.mjs` |
| Seedance is represented by a recognizable but non-infringing official-derived mark; copy no longer says “可交付的视频” | Production verified | `VideoModelMark` and revised heading in `VideoStudio/index.jsx`; `test/video-studio-contract.test.mjs` |

## D. Inspiration Gallery

| Requirement | Status | Evidence |
| --- | --- | --- |
| Ecommerce, Xiaohongshu, try-on, and four visual modes are interleaved instead of grouped | Production verified | `stableGalleryItems()` in `galleryModel.js`; gallery model tests |
| Duplicate cases and duplicate covers are removed | Production verified | `dedupeGalleryItems()` and canonical cover identity; `test/gallery-model.test.mjs`, `test/production-case-catalog.test.mjs` |
| Masonry cards follow image ratios; short cards let later cards move upward | Production verified | `stableGalleryColumns()` and column flex layout in `GallerySection.jsx`; gallery tests |
| Incremental loading appends without moving already visible cards | Production verified | `appendGalleryItemsWithoutReordering()`, fixed column allocation and `IntersectionObserver`; `test/gallery-model.test.mjs` | Live 16 -> 28 -> 40 coordinate audit in `888b81c` |
| First viewport uses small thumbnails and later assets lazy-load | Production verified | `ResponsiveImage` thumb variant and priority policy; `test/gallery-assets-contract.test.mjs` | 56 thumbnails reduced 141.09 MB to 2.07 MB; live broken-image count 0 |
| Hover shows a dimmed overlay, type badge, and designed same-style action | Production verified | `GallerySection.jsx` hover/focus overlay | Release `888b81c` hover/remix QA |
| One-image cases do not duplicate cover and content | Production verified | gallery item and modal deduplication; `test/gallery-experience.test.mjs`, `test/gallery-model.test.mjs` |
| Detail view shows the full production prompt and coherent cost controls | Production verified | gallery detail/remix data contract; `test/gallery-experience.test.mjs`, `test/gallery-remix-model.test.mjs` | Release `5caefea` and retained in `888b81c` |

## E. Upload, Prompt, And Caret Reliability

| Requirement | Status | Evidence |
| --- | --- | --- |
| Ecommerce upload sends original binary bytes, remains owner-scoped, deduplicates concurrent upload, and retries one transient failure | Production verified | durable asset upload path | `test/ecommerce-upload-contract.test.mjs`, `test/ecommerce-asset-upload.test.mjs` | Release `888b81c` |
| Typing or clicking mention controls does not move the caret to the start or remove the upload entry | Production verified | shared mention/contenteditable insertion contract | focused mention tests and live `ABCXDEF` insertion in `888b81c` |
| Failed ecommerce generation does not create a provider asset or charge; an expired quote refreshes before durable job creation | Production verified | generation preflight and billing state machine | ecommerce generation/billing regression | Release candidate and subsequent production canaries recorded in progress ledger |

## F. Ecommerce Canvas

| Requirement | Status | Evidence |
| --- | --- | --- |
| Uploaded images appear immediately from local data and nodes use natural aspect ratio without top/bottom white bands | Production verified | media node sizing and upload persistence | Canvas media/upload tests | Release `1894602` and later QA |
| Selecting an image shows contextual toolbar and quick-add; blank click, Escape, or delete removes both | Production verified | selected-node derived interaction model | Canvas interaction/selection tests |
| Low-priority toolbar actions are icon-only with tooltips; primary actions retain labels | Production verified | Canvas action registry and toolbar render tests |
| Move/scale means selecting an object region, identifying it, moving/scaling/rotating a target box, and generating a new result while keeping the source | Production verified | Canvas move-scale state and generation path | move-scale interaction/server transform tests |
| Image annotation supports pen, rectangle, arrow, inline text on click, color/size, undo/redo, and save | Production verified | annotation model/render path | annotation tests |
| Deleting the selected source cancels contextual UI and stale asynchronous results cannot resurrect it | Production verified | interaction state cleanup | Canvas async/delete tests |
| Smart layering replaces the source image with the layer group and child layers instead of leaving a duplicate original; group has a useful composite preview and inherits the source workflow relations | **Locally verified, deployment pending** | `canvasLayerMaterialization.js`, `canvasInteractionModel.js`, `EcCanvas/index.jsx`, `CanvasStudio.jsx` | focused Canvas suite 77/77; interaction review 71/71; full repository 1537/1537 | Not yet on public site at this audit point |
| Video composer inside Canvas matches homepage modes, image/video/audio upload, model, ratio, duration, sound, plan analysis, billing, and result handoff | Production verified | `CanvasVideoComposer`; `test/video-studio-contract.test.mjs` |

## G. Generation Reliability And Admin Economics

| Requirement | Status | Evidence |
| --- | --- | --- |
| Admin clearly shows per-generation revenue, provider cost, payment fee, profit, margin, and gifted-point subsidy | Production verified | `unitEconomicsModel.js` and Admin UI | `test/admin-unit-economics.test.mjs`, `test/admin-routes.test.mjs` |
| Image-generation tasks are idempotent, resumable, billed only for delivered outputs, and release holds on failure | Production verified for existing ecommerce/Canvas paths | generation, billing, project, recovery tests plus repeated deployment canaries |
| “No bugs anywhere” and “all generations always succeed” | Cannot be truthfully guaranteed | Software and upstream generative providers cannot provide an absolute zero-defect or 100% success guarantee. The enforceable target is fault containment, no duplicate charging, resumable/retriable jobs, verified delivery before settlement, automated release/refund, observability, and SLO-based release gates. AI-video P0 formalizes these contracts. |

## H. AI-Video Platform

| Requirement | Status | Evidence |
| --- | --- | --- |
| Digest current site and competitor/product/open-source/social evidence before architecture | Design complete | `2026-08-15-ai-video-platform-evidence-and-options.md` |
| Long-term route uses project memory, versioned assets, storyboard dependencies, candidate selection, timeline, declarative Skill runs, and cloneable process | Design complete | `2026-08-14-ai-video-platform-roadmap.md` |
| P0 reliable media/job/billing/review/projection foundation and tus decision | Local implementation complete; production observation pending | Commits `3bf64ec` through `1b799ba`; local full regression `1570/1570`, build/check/diff gates passed, no paid video submission |
| P1 asset/version, shot binding, candidate selection and timeline domain | Written design and file-by-file TDD plan ready for review; code not started | `2026-08-15-ai-video-p1-workbench-domain-design.md`, `2026-08-15-ai-video-p1-workbench-domain-implementation.md` |

## Remaining Existing-Product Exit Gate

1. Commit the smart-layer source-replacement and composite-preview correction.
2. ~~Run the full repository test, build, check, collaboration, and whitespace gates.~~ Completed: 1537/1537 tests, 6479-module build, check and collaboration READY, clean diff check.
3. Deploy only through `scripts/deploy-production.ps1` and complete public desktop/mobile Canvas regression without paid video generation.
4. Record the release commit, live bundle, health, and any remaining risk in `RTK.md` and `.superpowers/sdd/progress.md`.
5. Publish and observe AI-video P0 only after the coordinated release window is explicitly reopened; do not expose P1 publicly before P0 production gates pass.
