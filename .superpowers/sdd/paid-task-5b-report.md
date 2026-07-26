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

---

## Final review root-cause closure (2026-07-26)

### Findings closed

- Added `ecommerceTaskProgressModel.js` as the shared pure model for owner+surface active draft persistence. References use lowercase owners, a version, `createdAt`, a 24-hour expiry, and reject malformed, foreign-owner, expired, and future-dated records.
- `EcMode`, `EcStudio`, `EcAuto`, `EcLegacyForm`, and `XhsContentMode` now restore the same persisted draft after refresh. Explicit new-product/continue-new-work actions rotate the draft atomically, clear only the matching old task reference, and clear the old preview/result state. `EcMode` and the app-level `_workVersion` path share the stable home-wizard draft with `DesignDirection`.
- All reachable ecommerce generation surfaces now pass a stable draft and `onProgress`/`onImage`; no production ecommerce call remains on a mount-random or unreferenced duplicate-POST path.
- `EcAuto`, `EcLegacyForm`, `EcStudio`, and `XhsContentMode` keep stable early images in `inProgressPreview`. Final `results`/`result` state and “generation complete” UI are committed only for `completed` or `needs_review` with usable stable images.
- Unknown provider statuses now use semantic tokens with pending-state priority: `completion_pending` and `complete_pending` remain “正在生成”, while unknown final/error markers such as `provider_completed` map to “失败”.
- The SSE completion branch now preserves the normalized completed status needed by the final-result gate.

### TDD evidence

RED was observed before each implementation slice:

1. The retry SSE behavior returned no final status (`undefined !== completed`).
2. `provider_completed` incorrectly mapped to “正在生成”.
3. Draft persistence/rotation and preview-gating model exports were absent.
4. Entrypoint contract tests found mount-random drafts, missing lifecycle wiring, and no independent preview state.
5. The explicit `_workVersion` rotation contract initially failed on the remaining surfaces.

GREEN was then observed with real model/API behavior tests and entrypoint integration contracts. No implementation was accepted from source-pattern checks alone.

### Verification

```text
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-task-progress.test.mjs
tests 44
pass 44
fail 0

node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 98
pass 98
fail 0

node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 73
pass 73
fail 0

npm run build
exit 0; export verification passed; Vite transformed 6406 modules.

git diff --check
exit 0; only expected LF/CRLF normalization warnings.

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
peer ownership conflicts: 0
```

### Scope and self-review

- Implementation and tests are limited to the allowed frontend/test files plus this report. No server, database, `dist`, uploads, cache, deployment, Task 6, or Task 7 files were changed.
- `sb-last-ecommerce-task` is not used. Task references remain owner+draft isolated; timeout/network/retryable/needs-review references remain resumable, while terminal success/cancel/failure and explicit rotation clear only the matching task.
- The five surface keys prevent cross-owner and cross-surface draft reuse. A `needs_review` task is preserved until explicit continuation/new-product rotation, after which the next task is written under the new draft and cannot reuse the old preview/result.
- No paid provider call was made during verification. The intentional remaining product concern is the 24-hour local reference expiry; the collab check also reports the environment’s pre-existing inability to read the user Git ignore file while returning READY.

### Final commits

Implementation: `a9c59c9 fix: persist task 5b drafts across ecommerce surfaces`

Report: `4837884 docs: record final task 5b review closure`

---

## Final review epoch/SSE closure (2026-07-26)

### Findings closed

- Added pure `createEcommerceGenerationToken` / `isEcommerceGenerationTokenCurrent` guards in `ecommerceTaskProgressModel.js`. Each token contains a monotonic epoch plus normalized owner and draft ID; callbacks are current only when all three bindings match the live identity.
- Wired the guard through `EcMode`, `DesignDirection`, `EcStudio`, `EcAuto`, `EcLegacyForm`, and `XhsContentMode`. Every active generation/upload path invalidates its token and aborts its controller on explicit rotation, owner/draft change, and unmount.
- Guarded progress/image callbacks, awaited completion, stage/result writes, access-error handling, `saveWork`, credits refresh, navigation, and `catch`/`finally` cleanup. The API also accepts the guard and stops polling, POST task-reference persistence, SSE callbacks, and stale completion before they can reattach an old task to a new draft.
- Added optional AbortController propagation through ecommerce POST/GET/poll/SSE and `saveWork`; token checks remain authoritative even when a callback has already arrived.
- Fixed the SSE completion path so only a successful `completed` result clears its task reference. `needs_review` remains stored, and a refresh resumes it through GET without a duplicate POST. SSE `failed`/`cancelled` clear according to the existing terminal rule.

### TDD evidence

RED was observed first:

1. The new SSE POST `needs_review` test found the task reference missing after completion.
2. The real A→B generation-token behavior test failed because the model exports did not exist.
3. The six-entry contract failed because none of the entrypoints created or invalidated a generation token.

GREEN was then observed after the minimal model, API, and entrypoint wiring. The A→B test is behavior-based: a late A stable-image/completion effect is rejected after B becomes current, while B remains current.

### Verification

```text
focused:
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-task-progress.test.mjs
tests 47
pass 47
fail 0

Task5A required current exact collection:
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-asset-upload.test.mjs test/billing-routes.test.mjs test/billing-client.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-repair-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
tests 100
pass 100
fail 0

adjacent:
node --test --test-concurrency=1 test/billing-quote-token.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-deterministic-repair.test.mjs test/generation-access.test.mjs test/pending-paid-action.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/ecommerce-export.test.mjs
tests 73
pass 73
fail 0

npm run build
exit 0; export verification passed; Vite transformed 6406 modules.

git diff --check
exit 0; only expected LF/CRLF normalization warnings.

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
peer ownership conflicts: 0
```

### Scope and self-review

- Changed only the allowed frontend/model/test files plus this report. No server, database, `dist`, uploads, cache, deployment, Task 6, or Task 7 files were changed.
- The API guard checks occur before legacy image preparation completes, before 202 task-reference persistence, before SSE job persistence, and before all poll callbacks. A stale request therefore cannot reattach task A after draft B rotation.
- `needs_review`, timeout, and retryable paths preserve references; only successful completed results and existing terminal failure/cancel rules clear references. The SSE needs-review refresh test verifies GET-only recovery.
- No paid provider call was made. The remaining environment warning is the pre-existing inability to read `C:\Users\SHEJI/.config/git/ignore`; collaboration status is READY.

### Final commits

Implementation: `b3ef6dd fix: guard stale ecommerce generation callbacks`

Report: documentation commit for this closure

---

## Final review analysis/precondition/abort closure (2026-07-27)

### Findings closed

- Split `DesignDirection` supplementary uploads into token-free direction analysis and token-guarded formal generation. Initial `loadDirections` analysis now always receives its uploaded product/reference arrays, while a stale formal-generation upload still returns no result and cannot continue into generation.
- Every reachable ecommerce UI entry (`EcMode`, `DesignDirection`, `EcStudio`, `EcAuto`, `EcLegacyForm`, and `XhsContentMode`) now rejects a missing owner/draft generation context before any API request. The explicit `ECOMMERCE_GENERATION_CONTEXT_REQUIRED` error resets the local loading state instead of silently returning with a spinner active.
- `EcAuto` observes an incoming work-version increment during render and immediately invalidates the old token and aborts its controller, before the effect-driven React state rotation. The later effect remains responsible for persistent draft rotation and UI reset; the early invalidation makes a late A callback unable to reach B.
- `EcMode` now owns an upload AbortController and forwards its signal through both product/reference asset uploads. Owner changes, work rotation, and unmount invalidate the token and abort the in-flight upload; the token guard remains the authority for already-arrived callbacks.

### TDD evidence

RED was observed first with four focused failures: asset upload did not forward a signal; `loadDirections` still used the stale-generation supplementary upload path; the token-free analysis helper was absent; and the explicit missing-context error was absent. The behavioral model test then verified that token-free analysis returns both asset groups, while an explicitly stale formal-generation token is rejected. A second real model test verifies immediate A invalidation/abort before a B callback can be considered current; the existing A→B late image/completion behavior test remains in the focused set.

GREEN followed the minimal model/API/UI wiring:

```text
focused:
node --test --test-concurrency=1 test/ecommerce-upload-contract.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs test/ecommerce-task-progress.test.mjs
tests 51
pass 51
fail 0

Task5A required current exact collection
tests 102
pass 102
fail 0

adjacent collection
tests 73
pass 73
fail 0

npm run build
exit 0; export verification passed; Vite transformed 6406 modules.

git diff --check
exit 0

npm run collab:check
[collaboration] READY
tracked runtime paths: 0
peer ownership conflicts: 0
```

### Scope and self-review

- Changed only Task5B-allowed frontend/model/test files plus this report. No server, database, `dist`, uploads, cache, deployment, Task 6, or Task 7 paths were changed.
- API asset upload cancellation is additive: existing callers retain the old two-argument API; callers that own a request can pass the standard signal as the optional third argument.
- The precondition is enforced at every production UI entrypoint, so the durable API is not invoked from a tokenless user interaction. No paid provider call was made during verification.
- The only environment note remains the pre-existing unreadable `C:\\Users\\SHEJI/.config/git/ignore`; the collaboration policy still reports READY.

### Final commits

Implementation: `7fa03cf fix: harden ecommerce generation preconditions`

Report: documentation commit for this closure.
