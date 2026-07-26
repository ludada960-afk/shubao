# Paid Workflow Task 5B Report

## Scope

- Added a pure owner/draft task-progress model with a versioned, 24-hour reference record.
- Normalized every asset state into Chinese user-facing progress labels and never render provider state text.
- Reworked the existing `202` polling path to emit each stable asset URL once as soon as it appears, including during quality checking.
- Added safe active-task resume, timeout retention, matching-only cleanup, explicit retry after terminal failure, and isolated 403/404 expiry handling.
- Updated DesignDirection to pass the stable draft ID, render per-asset progress and stable previews, retain form state on interruption, and navigate only from a final usable task.
- Kept the existing 402 pending-action sanitizer and billing path unchanged; regression tests confirm binary/image payloads are excluded.

## Files

- `src/services/api.js`
- `src/pages/Home/ec/DesignDirection.jsx`
- `src/pages/Home/ec/ecommerceTaskProgressModel.js`
- `test/api-contract.test.mjs`
- `test/ecommerce-billing-ui.test.mjs`
- `test/ecommerce-task-progress.test.mjs`

## TDD evidence

RED was observed before each implementation increment:

1. Missing pure task model: `ERR_MODULE_NOT_FOUND` from `test/ecommerce-task-progress.test.mjs`.
2. Resume/poll contracts: active resume attempted the old stream path, timeout had no stored reference, and 403 was not converted to an isolated expired-task error (3 failures).
3. DesignDirection integration: missing asset-progress/stable-preview state (1 failure).
4. Unknown final provider state incorrectly mapped to `正在生成` instead of `失败` (1 failure).
5. Terminal failed/cancelled polls retained their task reference (1 failure).
6. A forged foreign-owner reference could be cleared by a matching task ID (1 failure).

GREEN after the final focused run:

```text
node --test --test-concurrency=1 test/api-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-upload-contract.test.mjs test/ecommerce-task-progress.test.mjs
tests 36
pass 36
fail 0
```

## Verification

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 96
pass 96
fail 0
```

The required Task 5A file set now contains 96 tests because Task 5B added six focused frontend contracts.

```text
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 73
pass 73
fail 0

npm run build
exit 0; export verification passed; Vite transformed 6406 modules.

git diff --check
exit 0

npm run collab:check
[collaboration] READY
branch: codex/ecommerce-stability
linked worktree: yes
tracked runtime paths: 0
peer ownership conflicts: 0
```

## Independent self-review

- Stable URL dedupe is keyed by `asset ID + URL`, so a later replacement URL is emitted once while repeat polls do not duplicate previews.
- Only `completed` clears the stored task reference; `needs_review`, timeout, network/retryable errors retain it. Failed/cancelled and explicit expiry clear only the matching owner/draft/task record.
- References are lowercased by owner, draft-scoped, versioned, timestamped, expired after 24 hours, and reject malformed or foreign records.
- DesignDirection holds directions, supplementary assets, prompt, SKU, sizing, and colors in component state across timeout and 402 paths; no binary content was introduced into pending billing data.
- No server, database, runtime output, deployment, `dist`, uploads, cache, or Task 6/7 files changed.

## Concerns

- The durable frontend flow is covered with mocked signed job responses; no paid provider generation was invoked.
- Task references deliberately expire after 24 hours. A later resume requires a fresh explicit generation action after the UI reports expiry.

## Commits

`4fcaf1e feat: resume durable ecommerce generation tasks` — implementation, focused tests, and regression tests.

---

## Independent review fix closure (2026-07-26)

### Findings closed

- All reachable production ecommerce generation entrypoints now use a stable `draftId` and pass the durable `onProgress`/`onImage` contract: EcStudio, EcAuto, EcLegacyForm, Home/XhsContentMode `doGenEC`, and Home/ec/DesignDirection. The API wrappers `generateEcommerceSuite` and `autoGenerate` forward the same fields.
- Unknown active states, including `completion_pending` and `complete_pending`, map to `正在生成`; only recognized terminal/error markers map unknown final/error states to `失败`. No arbitrary `complete` substring is used as a failure classifier.
- Task references with future `createdAt` timestamps are rejected.
- EcStudio prevents duplicate clicks while generating and admits stable previews before the parent task reaches a terminal state.

### TDD evidence

RED was observed before each review-fix implementation:

1. The future-`createdAt` contract loaded the reference instead of rejecting it.
2. The all-entrypoint contract failed because EcStudio had no stable `draftId`.
3. EcStudio's duplicate-submit/early-preview contracts failed.
4. `completion_pending` and then `complete_pending` were incorrectly mapped to `失败`.

GREEN after the final implementation:

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-task-progress.test.mjs
tests 38
pass 38
fail 0
```

### Review-fix verification

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 97
pass 97
fail 0

node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 73
pass 73
fail 0

npm run build
exit 0; export verification passed; Vite transformed 6406 modules.

git diff --check
exit 0

npm run collab:check
[collaboration] READY
branch: codex/ecommerce-stability
linked worktree: yes
tracked runtime paths: 0
peer ownership conflicts: 0
```

### Review-fix files and self-review

- Updated only `src/pages/EcStudio/index.jsx`, `src/pages/EcAuto/index.jsx`, `src/pages/Home/EcLegacyForm.jsx`, `src/pages/Home/XhsContentMode.jsx`, `src/pages/Home/ec/ecommerceTaskProgressModel.js`, `src/services/api.js`, `test/ecommerce-billing-ui.test.mjs`, and `test/ecommerce-task-progress.test.mjs`, plus this report.
- Added one contract covering every reachable production generation call site and the API forwarding surface.
- No server, database, runtime output, deployment, `dist`, uploads, cache, or Task 6/7 files changed.
- No paid provider generation was invoked; remaining concern is the intentional 24-hour reference expiry documented above.

### Review-fix commit

`92c5831 fix: close task 5b durable entrypoint gaps`
