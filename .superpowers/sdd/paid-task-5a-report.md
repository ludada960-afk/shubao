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
