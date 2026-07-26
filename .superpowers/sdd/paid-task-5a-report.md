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
