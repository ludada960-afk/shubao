# Paid Workflow Task 5A Report

## Status

Task 5A implemented on `codex/ecommerce-stability` from base `5a4a112`.
Task 5B was not started: no new durable polling, incremental `onImage`, or draft resume behavior was added.

## Scope delivered

- First-step and supplementary JPEG/PNG files now use authenticated `POST /api/ecommerce/assets`.
- The frontend retains the returned original `{ assetId, url }` and preview URL; formal generation sends owner-scoped original asset references.
- The formal first-step 800px JPEG compression path was removed.
- Sizing UI/model exposes only supported production roles and ratios; `poster` and unsupported ratios are excluded.
- Smart presets resolve to explicit image selections.
- Planner honors configured counts for white background, 1:1 main, 3:4 main, transparent PNG, and detail slices.
- Transparent plan items expose PNG export targets only.
- Repeated and SKU plan items have deterministic unique item IDs and item-scoped versioned export target IDs.
- `generationSettings.resolution` is merged into formal planner sizing.
- UI quantity, quote quantity, billing hold item count, and production plan count share the same explicit plan cardinality.
- 1K/2K quote `ec_image_2k`; 4K quotes `ec_image_4k`.
- Quote copy is product-facing and unlimited owners display `无限内测`.
- Existing design-direction title immutability and description editing behavior were preserved.

## TDD evidence

### Initial Task 5A RED

Command:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs
```

Observed:

```text
tests 39
pass 29
fail 10
```

Expected failures covered the formal 800px JPEG path, missing original-upload helper, lost asset IDs/4K sizing, unsupported poster/ratios, ignored counts/transparent items, and missing authoritative quote usage.

### Transparent export RED

Command:

```text
node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs
```

Observed:

```text
tests 9
pass 8
fail 1
```

The transparent item still exposed non-PNG export targets.

### Repeated target-ID RED

Command:

```text
node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs test/ecommerce-export.test.mjs
```

Observed:

```text
tests 22
pass 20
fail 2
```

The expanded plan produced only 8 unique target IDs across 24 targets, and two repeated main items shared the same target ID.

### SKU target-ID RED

Command:

```text
node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs
```

Observed:

```text
tests 9
pass 8
fail 1
```

Two SKU items produced only 2 unique target IDs across 4 targets because their final item IDs were assigned after target versioning.

## GREEN evidence

Required command:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs
```

Result:

```text
tests 39
pass 39
fail 0
```

Adjacent ecommerce-engine regression:

```text
node --test --test-concurrency=1 test/ecommerce-model-routing.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-export.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-asset-planner.test.mjs
```

Result:

```text
tests 63
pass 63
fail 0
```

Build:

```text
npm run build
```

Result: export verification passed; Vite transformed 6404 modules and completed successfully.

Diff:

```text
git diff --check
```

Result: exit 0; no whitespace errors.

Collaboration:

```text
npm run collab:check
```

Result:

```text
[collaboration] READY
tracked runtime paths: 0
ignored runtime changes: 0
peer ownership conflicts: 0
```

## Exact changed files

- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/platformPolicies.mjs`
- `src/pages/Home/EcMode.jsx`
- `src/pages/Home/ec/DesignDirection.jsx`
- `src/pages/Home/ec/SizingPanel.jsx`
- `src/pages/Home/ec/ecommercePlanModel.js`
- `src/services/api.js`
- `test/ecommerce-upload-contract.test.mjs`
- `test/ecommerce-billing-ui.test.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-export.test.mjs`
- `.superpowers/sdd/paid-task-5a-report.md`

## Self-review

- Original upload retry is idempotent at the existing owner/content-scoped upload service, so a partial `Promise.all` failure does not create divergent originals on retry.
- Supplementary assets are replaced in component state with stable upload records; re-analysis and formal generation do not re-encode or re-upload completed records.
- Formal generation preserves mixed legacy callers: owned asset objects remain under `assets`, while legacy string/File inputs continue through the prior compatibility path.
- Quote effects cancel stale responses and reset the displayed quote before requesting a new SKU/quantity.
- Empty explicit plans produce no quote and cannot submit; the server independently rejects an empty asset plan.
- UI SKU validity matches planner SKU validity (`color`, `size`, `capacity`, or `dimLabel`).
- Billing creates exactly one hold item per planned item and independently maps each item generation size to the same 2K/4K feature family used by the UI quote.
- Item-scoped export target versioning preserves verification and non-job target compatibility while removing ambiguity for repeated counts and SKU variants.
- No `dist`, database, upload, cache, generated asset, deployment, XHS, Plog, or Canvas files are included.

## Concerns / deferred scope

- Task 5B remains intentionally deferred. Existing polling behavior was not extended with per-asset immediate emission or draft-scoped resume in this task.
- The build emits only the repository's existing Git global-ignore permission warning during collaboration checks; it does not affect the READY result.

---

## Review-fix closure

Implementation commit:

```text
910c76c fix: bind ecommerce quotes and transparent delivery
```

### Critical: accepted quote is bound to the recomputed plan

- Added `server/billing/quoteService.mjs`, using a versioned HMAC-SHA256 base64url token and `timingSafeEqual`.
- The token binds normalized owner email, SKU, quantity, units, total units, currency, issue time, and expiry.
- `/api/billing/quote` now returns only the product-facing quote plus `quoteId` and `expiresAt`.
- Formal generation submits `billing_quote_id`.
- The server recomputes the actual Asset Plan, rejects mixed effective SKUs, verifies exact owner/count/units/currency/expiry, and only then creates the hold.
- Missing, expired, tampered, cross-owner, or mismatched quotes fail closed without a hold or provider submission.
- The verified quote ID and expiry are persisted on the hold; existing hold/settlement/release idempotency and unlimited-owner shadow billing remain intact.

RED:

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/billing-routes.test.mjs test/ecommerce-upload-contract.test.mjs
tests 6
pass 2
fail 4
```

GREEN:

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/billing-routes.test.mjs test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs
tests 28
pass 28
fail 0
```

### Critical: 402 pending action keeps actionable references only

- Step one now creates one stable ecommerce `draftId` and passes it into step two.
- A 402 stores the signed owner, route, draft ID, quote ID, immutable direction ID, editable brief, sizing, resolution, SKUs, custom colors, original/supplement product and reference asset IDs, prompt text, and textual prompt references.
- The pending action strips raw image objects, `File`, `Blob`, Base64, `data:` URLs, `blob:` URLs, and preview payloads.
- React files, selected direction, sizing, SKUs, colors, and prompt state are not cleared by the access handler.

RED:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/generation-access.test.mjs
tests 10
pass 6
fail 4
```

GREEN:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs
tests 20
pass 20
fail 0
```

### Important: transparent output is alpha-specific and repaired deterministically

- Added a transparent role policy requiring an actual alpha canvas, an isolated product, no scene/background, and no added text.
- Transparent plan and prompt compilation discard style references so campaign styling cannot override transparency.
- Transparent quality checks require PNG plus meaningful transparent background, opaque product coverage, and transparent canvas edges.
- `transparent_background_missing` maps to `normalize_transparent_background`.
- Deterministic Sharp repair removes only connected near-white/neutral border backgrounds, applies a soft alpha ramp, and unblends product edge colors.
- Non-neutral scenes are not erased; if meaningful alpha remains absent, quality remains failed or needs review.
- The orchestrator always evaluates transparent items with `expectedFormat: 'png'`.

RED:

```text
node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-deterministic-repair.test.mjs test/ecommerce-orchestrator.test.mjs
tests 63
pass 56
fail 7
```

GREEN:

```text
node --test --test-concurrency=1 test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-deterministic-repair.test.mjs test/ecommerce-orchestrator.test.mjs
tests 64
pass 64
fail 0
```

### Durable error metadata RED/GREEN

The review fix also required actionable quote failures to survive the existing asynchronous job boundary.

RED:

```text
node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs
tests 37
pass 34
fail 3
```

The failures proved that persisted job errors dropped `status`, `retryable`, and `reQuoteRequired`, the frontend dropped the same metadata, and one structural assertion still inspected the pre-extraction billing location.

GREEN:

```text
node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs
tests 37
pass 37
fail 0
```

### Final verification

Required review command:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 88
pass 88
fail 0
```

New and adjacent review tests:

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 67
pass 67
fail 0
```

Build and repository checks:

```text
npm run build
exit 0; export verification passed; Vite transformed 6404 modules.

git diff --check
exit 0; no whitespace errors.

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
ignored runtime changes: 0
peer ownership conflicts: 0
```

Additional full-suite audit:

```text
npm test
tests 486
pass 484
fail 2
```

Both failures are pre-existing structural assertions outside Task 5A scope:

- `test/content-billing.test.mjs` expects the old `CONTENT_PREVIEW_ROUTES.has(req.path)` expression, while production already uses normalized `guardedPath`.
- `test/payment-orders.test.mjs` expects the old payment-service method list without the existing `listProviders` method.

This review fix did not modify either test or the corresponding behavior, and the requested focused/regression suites are green.

### Exact review-fix files

- `server/billing/quoteService.mjs`
- `server/billing/routes.mjs`
- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/deterministicRepair.mjs`
- `server/ecommerceEngine/ecommerceBilling.mjs`
- `server/ecommerceEngine/index.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `server/ecommerceEngine/platformPolicies.mjs`
- `server/ecommerceEngine/promptCompiler.mjs`
- `server/ecommerceEngine/qualityGate.mjs`
- `server/ecommerceEngine/repairPlanner.mjs`
- `server/index.mjs`
- `src/pages/Home/EcMode.jsx`
- `src/pages/Home/ec/DesignDirection.jsx`
- `src/pages/Home/ec/ecommercePlanModel.js`
- `src/services/api.js`
- `test/billing-quote-token.test.mjs`
- `test/billing-routes.test.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-billing-contract.test.mjs`
- `test/ecommerce-billing-ui.test.mjs`
- `test/ecommerce-deterministic-repair.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-prompt-compiler.test.mjs`
- `test/ecommerce-quality-gate.test.mjs`
- `test/ecommerce-repair-planner.test.mjs`
- `test/ecommerce-route-integration.test.mjs`
- `test/ecommerce-upload-contract.test.mjs`
- `test/generation-access.test.mjs`
- `.superpowers/sdd/paid-task-5a-report.md`

### Review-fix self-review

- Quote verification happens before hold creation and before provider submission; no synthetic `ec-quote:<job>` authority remains.
- The billing service derives one effective SKU and exact quantity from the recomputed plan instead of trusting the client quote payload.
- Structured re-quote metadata persists through the durable job and reaches the frontend error object.
- Pending 402 data is owner/draft scoped and contains enough stable IDs and text to reconstruct the interrupted form without persisting binary content.
- Transparent generation, prompt compilation, quality evaluation, repair planning, deterministic repair, and retry evaluation agree on PNG/alpha semantics.
- Non-neutral generated scenes are deliberately not background-erased, preventing destructive false-positive cutouts.
- No Task 5B persistent polling, incremental `onImage`, or resume behavior was introduced.
- No XHS, Plog, Canvas, deployment, runtime database, upload, cache, generated asset, or `dist` files were changed or staged.

### Review-fix concerns

- The repository-wide suite still has the two unrelated stale structural assertions documented above; focused Task 5A and adjacent ecommerce/billing regressions are fully green.
- Task 5B remains intentionally unstarted.

---

## Final independent re-review closure

Baseline:

```text
49e2a63 docs: record second task 5a review fixes
```

Implementation commit:

```text
2dfcf1c fix: harden task 5a payload and alpha safety
```

### Important: image-payload detection no longer deletes normal text

- Replaced character-set/length heuristics in both pending-action paths with a shared pure utility at `src/utils/imagePayloadText.js`.
- Field schema still rejects known binary-bearing fields and ecommerce asset IDs still use the exact server-issued `64 hex + .jpg/.png/.webp` schema.
- Complete `data:` and `blob:` URLs are rejected at any position in a text value, including ordinary text before the URL and surrounding whitespace.
- Raw Base64/Base64url is rejected only when decoded prefix bytes match real image signatures (PNG, JPEG, WebP, GIF, BMP, TIFF, ICO, or supported ISO-BMFF image brands).
- Long punctuation-free English, 64-character hashes, non-image Base64url text, and valid server asset IDs remain preserved.
- Short image payloads are detected by magic bytes, so the previous 64-character threshold is gone.

### Important: pixel-space foreground-intrusion veto

- Transparent flood-fill repair now computes the non-removable foreground bounds and refuses removal when the connected removable region penetrates the eroded foreground interior.
- This is independent of the finite color-keyword Product Truth veto and catches a dark body with a light edge-touching label/part even without matching color facts.
- Refused repairs return an opaque PNG; the existing transparent alpha gate therefore routes the item to retry/needs review instead of settlement.
- The existing centered dark product on a consistent white background remains a successful automatic repair.

### Final re-review TDD evidence

RED command:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/pending-paid-action.test.mjs test/ecommerce-deterministic-repair.test.mjs
tests 22
pass 18
fail 4
```

The four failures were the intended regressions: long punctuation-free/hash text was deleted, short/embedded image payloads were retained, and the edge-touching light part was erased by alpha repair.

Focused GREEN:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/pending-paid-action.test.mjs test/ecommerce-deterministic-repair.test.mjs
tests 22
pass 22
fail 0
```

Required 90-test command:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 90
pass 90
fail 0
```

Adjacent command:

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 73
pass 73
fail 0
```

The adjacent suite is the former 72-test command plus the new edge-intrusion regression, so all original 72 tests remain covered.

Build and repository checks:

```text
npm run build
exit 0; export verification passed; Vite transformed 6405 modules.

git diff --check
exit 0; no whitespace errors.

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
ignored runtime changes: 0
peer ownership conflicts: 0
```

### Exact final re-review files

- `src/utils/imagePayloadText.js`
- `src/pages/Home/ec/ecommercePlanModel.js`
- `src/utils/pendingPaidAction.js`
- `server/ecommerceEngine/deterministicRepair.mjs`
- `test/ecommerce-billing-ui.test.mjs`
- `test/pending-paid-action.test.mjs`
- `test/ecommerce-deterministic-repair.test.mjs`
- `.superpowers/sdd/paid-task-5a-report.md`

### Final self-review

- No character-set/length-only Base64 decision remains in either pending-action path; decoding is bounded to the prefix needed for magic detection and never treats arbitrary decoded bytes as an image.
- Data/blob URL detection is value-based and position-independent, while schema-based binary keys and the exact original asset-ID allowlist remain intact.
- Pixel-space intrusion safety is independent of Product Truth keyword coverage; ambiguous edge-connected structures are kept opaque and sent through the existing quality retry/needs-review path.
- The safe centered dark-product case and all prior quote, upload, planner, billing, orchestration, and quality regressions remain green.
- No Task 5B polling, `onImage`, or resume work was started.
- No runtime database, uploads, cache, dist, deployment, XHS, Plog, or Canvas files were modified or staged.

---

## Second re-review closure

Implementation commit:

```text
3db9432 fix: close ecommerce task 5a review gaps
```

### Critical: pending-action binary and field-boundary hardening

- Ecommerce pending actions accept original asset references only when they match the server-issued schema `^[a-f0-9]{64}\.(jpg|png|webp)$`.
- Direction IDs and briefs, SKU labels, prompt keys, prompt text, and prompt-reference text now have field-specific bounds.
- `data:`/`blob:` values and long standard Base64 or Base64url-looking binary strings are rejected before pending storage, including under otherwise safe generic keys.
- Long ordinary Chinese and English copy remains intact within the product-specific limits.
- Stable server asset IDs remain usable because their extension prevents them from being mistaken for raw binary.

### Important: expired formal quote refresh

- A durable formal-generation error marked `reQuoteRequired` immediately clears the stale quote and disables submission.
- A refresh-version dependency forces an authoritative quote request even when the recomputed SKU and quantity are unchanged.
- The UI displays `当前方案费用已更新，正在重新确认…` while refreshing.
- Selected direction, sizing, SKUs, colors, product/reference uploads, and prompt state are not reset.
- Quote refresh never calls the generation handler; the user must explicitly submit again after a fresh quote arrives.

### Important: conservative transparent-background repair

- Border removal now requires a bright neutral median, at least 94% border-color consistency, tighter chroma/color-distance thresholds, and a dominant but bounded connected removable region.
- Refused repairs return an opaque PNG so the alpha quality gate routes the result to retry or needs review.
- Product Truth is passed into deterministic repair. White, ivory, cream, light-gray, silver, and equivalent Chinese primary-color/material facts veto automatic neutral-background removal.
- The orchestrator returns a repaired asset to `quality_check`; all adapters, including product fidelity, run again before settlement.
- A repaired output that fails product fidelity is released as `needs_review` and is never settled.

### Second re-review TDD evidence

RED command:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/pending-paid-action.test.mjs test/ecommerce-deterministic-repair.test.mjs test/ecommerce-orchestrator.test.mjs
tests 45
pass 37
fail 8
```

The expected failures proved that invalid asset IDs and raw Base64 were retained, fields were unbounded, unchanged plans could not force a quote refresh, broad alpha removal accepted inconsistent/non-dominant backgrounds and light products, Product Truth was absent from repair, and generic pending storage retained raw binary under safe keys.

Focused GREEN:

```text
node --test --test-concurrency=1 test/ecommerce-billing-ui.test.mjs test/pending-paid-action.test.mjs test/generation-access.test.mjs test/ecommerce-deterministic-repair.test.mjs test/ecommerce-orchestrator.test.mjs
tests 52
pass 52
fail 0
```

Required regression command:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 90
pass 90
fail 0
```

Adjacent review command:

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 72
pass 72
fail 0
```

Build and repository checks:

```text
npm run build
exit 0; export verification passed; Vite transformed 6404 modules.

git diff --check
exit 0; no whitespace errors.

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
ignored runtime changes: 0
peer ownership conflicts: 0
```

### Exact second re-review files

- `server/ecommerceEngine/deterministicRepair.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `src/pages/Home/ec/DesignDirection.jsx`
- `src/pages/Home/ec/ecommercePlanModel.js`
- `src/utils/pendingPaidAction.js`
- `test/ecommerce-billing-ui.test.mjs`
- `test/ecommerce-deterministic-repair.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/generation-access.test.mjs`
- `test/pending-paid-action.test.mjs`
- `.superpowers/sdd/paid-task-5a-report.md`

### Second re-review self-review

- The server-issued asset-ID allowlist is exact, lowercase, extension-bound, and independent of caller-provided URL or preview fields.
- Generic pending storage rejects binary-looking strings by value, not only by suspicious property name, while existing long-human-text coverage remains green.
- A stale quote cannot be submitted after `reQuoteRequired`: it is cleared synchronously in the error path and the button remains disabled through refresh.
- Quote refresh changes only quote state/version and does not invoke generation or clear any form data.
- Conservative alpha repair refuses ambiguous borders, non-dominant backgrounds, over-large removable areas, and light-neutral products identified by Product Truth.
- Deterministic repair remains uncharged, but settlement still requires the complete post-repair quality gate, including product fidelity.
- No Task 5B polling, `onImage`, or resume behavior was added.
- No XHS, Plog, Canvas, deployment, runtime database, uploads, cache, generated assets, or `dist` files were staged.

### Second re-review concerns

- Task 5B remains intentionally unstarted.
- The two unrelated pre-existing full-suite structural assertions remain as documented in the preceding review section; all requested Task 5A and adjacent suites pass.
