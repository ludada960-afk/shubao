# Task 2 Report: Exact-Count Planning And Suite Differentiation Contract

## Status

DONE. Implementation, verification, and the explicit Task 2 commit are complete.

## Scope Implemented

- Added `validatePlanContract(items)` and `assertExecutionCount({ plan, assetRows, providerSubmissions })`.
- Added `suiteSemanticKey(item)` over communication goal, shot type, camera azimuth, crop, interaction state, and scene family.
- Required unique plan IDs, globally unique commercial duties, complete semantic shot intent, approved evidence tiers, and non-collage intent before billing.
- Added one explicit `communicationGoal` to every planned item and one semantic `sceneFamily` to every directed shot.
- Preserved evidence-safe fallback shots for unsupported hidden, internal, open-state, and component requests.
- Added durable per-asset provider submission counts without provider IDs, request secrets, URLs, or credentials.
- Enforced one initial provider submission per planned asset and at most one provider-backed quality repair for that same asset.
- Kept one durable visible asset row per plan item; repairs reuse the row and successful siblings are not rerun.
- Added public plan and quoted image-unit counts plus durable aggregate execution diagnostics.
- Advanced strict orchestration snapshots to schema version 3 and added metadata-only migration for schema 1 and Task 1 schema 2 snapshots without repeating visual analysis, planning, or billing.
- Left Product Truth and Style Reference Profile isolated and unchanged.
- Left per-asset settle/release authority unchanged: only completed quality-approved stable assets settle, while failed assets release their own reservation.

## RED Evidence

Command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 58 tests discovered, 51 passed, 7 failed.

Expected failures observed:

- `ERR_MODULE_NOT_FOUND` for `server/ecommerceEngine/planContract.mjs`.
- `suiteSemanticKey` was not exported.
- Exact-count orchestration result had no `assetPlan`, quote count, or execution diagnostics.
- Duplicate suite intent completed instead of failing before billing.
- Existing snapshot fixture lacked the new strict plan fields and schema version.

## GREEN Evidence

Focused Task 2 command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

Result: exit 0; 75 passed, 0 failed.

Required focused and adjacent engine regression:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs
```

Final result after self-review hardening: exit 0; 116 passed, 0 failed.

Full regression:

```powershell
npm test
```

Final authoritative result after self-review hardening: exit 0; 723 passed, 0 failed, 0 skipped, 0 cancelled. An earlier full run also passed 723/723 before the repair-cap guard was moved ahead of the provider call; the full suite was rerun so the reported result covers the final code.

Additional verification:

- `node --check` passed for all nine changed code and test files.
- `git diff --check` passed; only Git LF-to-CRLF working-copy notices were emitted.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- No test used network access, production secrets, or formal Mock visual/provider behavior.
- No deployment was performed.

## Changed Files

- `server/ecommerceEngine/planContract.mjs` (new)
- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/shotDirector.mjs`
- `server/ecommerceEngine/suiteDiversity.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `test/ecommerce-plan-contract.test.mjs` (new)
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-suite-diversity.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`

## Self-Review

- Verified plan validation runs before `billing.hold` for current and migrated snapshots.
- Verified formal collage/contact-sheet/multi-candidate-grid intent is rejected before provider work and pixel-level collage rejection remains active after generation.
- Verified every current plan item has a distinct commercial duty and complete semantic key.
- Verified a three-item plan creates three rows, three initial submissions, quote units `3`, and three visible task items.
- Verified duplicate-output repair submits only the failed asset a second time, creates no row, and leaves the successful sibling at one submission.
- Found and fixed a review defect where the hard repair-count check was after `submitEdit`; it now rejects before a possible third provider call.
- Verified submission diagnostics persist only counts keyed by plan asset ID and do not contain provider job IDs or request data.
- Verified schema migrations preserve IDs, deterministic plan content, prior hold IDs, and Task 1 visual snapshots.
- Verified no unrelated files, runtime data, frontend scope, deployment code, model defaults, Product Truth fields, or Style Reference Profile fields changed.

## Concerns

None. The quoted `units` exposed by the task result is the authoritative number of planned image units; billing point totals remain governed by the existing signed quote and per-item billing contract.

## Commit

`7356e68` - `feat: enforce exact differentiated ecommerce plans`

---

# Task 2 Review Fix Wave

## Status

DONE. All five review findings were reproduced with RED tests, fixed, and verified without deployment.

## Scope Implemented

- Canonicalized commercial duties so ordinal suffixes and conservative equivalent wording cannot hide duplicates.
- Replaced planner-generated `duty N` wording with role-, placement-, evidence-, SKU-, and composition-specific purposes for every supported repeated slot.
- Narrowed formal collage rejection to explicit output/layout intent such as contact sheets, collages, montages, candidate grids, and multi-panel layouts while allowing product descriptions such as a single-view multi-panel appliance.
- Added a fenced same-state asset checkpoint and durable sanitized submission intents containing asset ID, generation ordinal, kind, fixed idempotency key, and acknowledgement status.
- Reused initial and repair idempotency keys after provider acknowledgement/local persistence gaps; acknowledgement persistence failures remain retryable and do not release billing reservations.
- Counted logical provider submissions from durable intents, prior execution snapshots, provider job evidence, and explicit repair-request evidence only. `attemptCount` is no longer submission evidence, and local Sharp repairs count as zero provider calls.
- Deferred terminal exact-count assertions while any child row is non-final because its lease is held. The parent remains `generating`, releases its parent lease, and resumes without another hold or rerunning completed siblings.
- Advanced strict orchestration snapshots to schema version 4 and migrated schema-3 ordinal duties into genuine role/composition purposes without repeating Task 1 visual analysis, planning, billing, or completed asset work.

## RED Evidence

Primary review RED command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-job-store.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 90 tests discovered, 81 passed, 9 failed for the intended missing behavior:

- Repeated planner purposes were not globally distinct (`9 !== 13`).
- `store.checkpointAsset` did not exist.
- A legacy local Sharp repair was counted as two provider submissions instead of one.
- A temporarily held child lease failed the parent instead of leaving it `generating`.
- Initial and repair acknowledgement-persistence tests did not receive retryable rejections.
- Ordinal/equivalent commercial duties were accepted.
- Candidate-grid and montage intent were accepted.
- A single-view multi-panel appliance description was falsely rejected.

Additional RED cycles:

- Schema-3 ordinal-duty migration: targeted run failed because the resumed job became `failed` instead of `completed`.
- Maximum repeated white-background count: targeted run exposed only 12 unique purposes for 20 slots.
- Expanded repeated-role and legacy evidence audit: two targeted tests failed with 5 unique main purposes for 20 slots and 2 inferred provider submissions instead of 1.
- Schema-3 six-hero migration: targeted run failed because the legacy five-duty cycle duplicated the sixth migrated purpose.

Each targeted RED failed before its corresponding production edit and for the asserted review defect.

## GREEN Evidence

Final focused Task 2 command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-job-store.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

Result: exit 0; 94 passed, 0 failed, 0 skipped, 0 cancelled.

Final focused and adjacent engine command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs
```

Result: exit 0; 135 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once as instructed:

```powershell
npm test
```

Result: exit 0; 732 passed, 0 failed, 0 skipped, 0 cancelled. The final self-review additions made after this repository-wide run are directly covered by the final 94-test focused and 135-test adjacent runs; the full suite was not run a second time.

Static and collaboration verification:

- `node --check` passed for all eight changed JavaScript modules/tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.

## Changed Files

- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/jobStore.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `server/ecommerceEngine/planContract.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-job-store.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-plan-contract.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Duty normalization strips ordinal-only differentiation and maps only the conservative synonym set proven by tests; alternate-angle, placement, evidence, and buyer-purpose distinctions remain distinct.
- Every supported repeated main, white-background, and transparent slot has a deterministic non-ordinal purpose. Schema-3 migration also remains unique beyond the prior five-duty hero cycle.
- Collage validation checks explicit formal output/layout language and no longer treats `multi-panel` alone as a forbidden layout.
- Provider submission accounting contains no `attemptCount` fallback. A provider-backed repair is inferred for old rows only when durable repair-request evidence exists; eligibility or a Sharp repair alone does not increment the count.
- Submission intent is persisted before `submitEdit`; provider acknowledgement and provider job ID are persisted atomically with the submitted state. Initial and repair resume paths reuse the same logical key, append no asset row, and expose no provider secret in diagnostics.
- A non-final child prevents terminal exact-count assertions. Completed siblings remain final, billing hold creation remains single-shot, and the resumed child is the only new provider submission.
- Current snapshots remain strict and versioned. Task 1 Product Truth, Style Reference Profile, visual analysis cache, hold ordering, legacy input checkpoints, and per-asset leases are preserved.
- Only quality-approved stable assets enter settlement; permanent failures retain the existing per-item release path. Retryable local acknowledgement failures do not incorrectly release a reservation.
- No network, real provider secret, formal Mock provider, or deployment was used. No unrelated production files changed.

## Concerns

No known behavior concerns. Verification note: the single 732-test full run preceded the final self-review edge-case additions by instruction; both additions are included in the final focused and adjacent GREEN runs above.

## Fix Commit

Subject: `fix: harden ecommerce exact-count recovery`
