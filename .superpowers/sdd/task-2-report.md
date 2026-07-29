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

---

# Task 2 Remaining Important Findings Fix Wave

## Status

DONE. All four remaining Important findings were reproduced with tests, fixed, self-reviewed, and verified without deployment.

## Scope Implemented

- Canonicalized bare trailing Arabic ordinals, hash ordinals, parenthesized ordinals, and Chinese `第N张`/`第二张` presentation suffixes so they cannot make equivalent duties appear distinct.
- Kept factual numbers intact when attached to durations, units/capacity, sizes, model identifiers, and Chinese duration facts. Known image/shot/duty presentation tokens remain removable without globally deleting numbers.
- Reconstructed provider submission diagnostics as a monotonic union of logical intents, idempotency keys, provider job identities, repair request evidence, and prior durable execution counts. Repair evidence implies the initial submission, and later Sharp snapshots cannot erase provider history.
- Persisted the monotonic provider count with initial and repair intent checkpoints and acknowledgements. Existing one-provider-repair enforcement remains before external submission and corrupt over-cap history is a permanent failure.
- Replaced raw seam-count collage classification with full-span boundary and narrow full-span gutter evidence. Product-confined appliance panel seams are allowed, while 2x2 grids and one-axis contact strips remain rejected.
- Mapped transient provider-output and Sharp-output write failures to `GENERATED_ASSET_STORAGE_UNAVAILABLE` (`503`, `retryable: true`, original `cause`). Assets stay in `downloading` or `repairing`; resume reuses the durable provider output/job and does not repeat holds, provider submissions, completed siblings, or releases.

## RED Evidence

Combined RED command after splitting every ordinal form into an independently visible test:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 85 tests discovered, 75 passed, 10 failed for the intended gaps:

- Five ordinal bypass tests failed: bare `1/2`, `#1/#2`, `(1)/(2)`, `第一张/第二张`, and `第1张/第2张`.
- The realistic single-view appliance was falsely classified as a collage from product-confined vertical seams.
- A legacy initial provider job followed by a new repair intent was counted as one submission instead of two.
- A legacy provider repair followed by an overwritten Sharp repair snapshot was counted as one submission instead of two.
- Provider-output `EIO` did not reject as retryable and permanently released the child.
- Sharp-output `EIO` did not reject as retryable and permanently released the child.

Self-review RED command:

```powershell
node --test --test-concurrency=1 --test-name-pattern="provider repair cap violations" test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 0 passed, 1 failed. The over-cap assertion had inherited `retryable: true` from the checkpoint wrapper. It made zero provider calls but left corrupt history resumable instead of releasing it permanently.

## GREEN Evidence

Focused GREEN after the four requested fixes:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
```

The first implementation run passed 84/85 and correctly exposed a regression in the existing 2x2 collage fixture. Measured evidence separated it from the appliance: the grid had one full-span boundary on each axis, while the appliance had zero full-span boundaries. After adding the two-axis full-span rule, the command passed 85/85.

Self-review repair-cap GREEN: exit 0; 1 passed, 0 failed.

Final focused and adjacent Task 2 command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs
```

Result: exit 0; 148 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once on the final code:

```powershell
npm test
```

Result: exit 0; 747 passed, 0 failed, 0 skipped, 0 cancelled.

Static and collaboration verification:

- `node --check` passed for all six changed JavaScript modules/tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- No test used production secrets, real network access, or a formal Mock visual/provider path.
- No deployment was performed.

## Changed Files

- `server/ecommerceEngine/orchestrator.mjs`
- `server/ecommerceEngine/planContract.mjs`
- `server/ecommerceEngine/suiteDiversity.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-plan-contract.test.mjs`
- `test/ecommerce-suite-diversity.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Confirmed presentation normalization operates only on known presentation tokens or terminal suffixes and keeps tested factual numeric distinctions.
- Confirmed provider evidence is unioned rather than selected by field precedence; adding intents or overwriting `repairAction` cannot lower the durable count.
- Confirmed a repair intent is checkpointed before submission, acknowledgement uses the same fixed key, and diagnostics expose only aggregate counts by asset ID.
- Confirmed the provider repair cap is evaluated before `submitEdit`; over-cap durable history submits zero work and is not mislabeled retryable.
- Confirmed a local Sharp repair contributes no provider submission, while a historical provider repair remains counted after a Sharp snapshot.
- Confirmed product-confined seams do not trigger collage rejection; repeated full-span strip boundaries, narrow gutters, and intersecting grid evidence do.
- Confirmed transient storage errors preserve the exact child state and parent resumability. Recovery repeats only the failed storage operation/local deterministic transform and never reruns a successful sibling or creates another hold/provider submission.
- Confirmed invalid deterministic repair bytes still use the existing nonretryable failure path because only recognized transient OS storage codes are mapped.
- Confirmed Task 1 visual snapshots, analysis-before-hold ordering, strict snapshot migration, durable asset rows, fenced leases, exact visible count, and stable-only settlement are unchanged.

## Concerns

No known contract failures. Residual risk: pixel collage detection is intentionally deterministic and conservative; irregular borderless montages without full-span grid evidence continue to rely on explicit plan-intent rejection and the surrounding semantic/quality gates.

## Commit

Planned subject: `fix: close ecommerce exact-count review gaps`

---

# Task 2 Final Important Findings Fix Wave

## Status

DONE. The final duty-normalization and irregular-montage findings were reproduced with RED tests, fixed, self-reviewed, and verified without deployment.

## Scope Implemented

- Replaced finite ordinal-word handling and generic terminal-number removal with controlled presentation-marker normalization.
- Stripped numeric, Chinese, and structurally recognized English ordinal tokens only after known presentation markers such as image, asset, shot, duty, treatment, recognition variant, `方案`, `图N`, and `第N张`, plus the existing explicit `#N` and `(N)` forms.
- Preserved unmarked product facts and identifiers including `model X 2`, `SKU 2`, `version 2`, durations, sizes, and capacities.
- Added deterministic planner-generated `commercialDutyId` values derived from role and commercial purpose, independent of shot metadata. Current plans require unique IDs; legacy plans remain compatible through conservative text normalization.
- Extended the existing formal visual-quality response with one explicit semantic layout verdict: `single_product`, `collage`, or `uncertain`, with numeric confidence and concrete evidence.
- Required a valid high-confidence semantic non-collage verdict whenever deterministic geometry is inconclusive. Missing, invalid, uncertain, low-confidence, and numeric-string confidence values fail closed.
- Preserved deterministic rejection for obvious contact sheets and strip layouts while allowing an explicitly confirmed single-view multi-panel product.
- Routed semantic collage failures through the existing `regenerate_from_product_truth` path for only the failed durable asset row. No second visual-model call, hidden provider submission, new visible row, sibling rerun, or additional hold was added.

## RED Evidence

Combined final-findings RED command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/api-contract.test.mjs
```

Result: exit 1; 150 tests discovered, 135 passed, 15 failed for the intended missing behavior:

- 1 production API schema failure: no semantic layout verdict/schema or details propagation.
- 2 planner failures: no canonical duty IDs and repeated-role plans had no unique canonical duty identity.
- 1 orchestration failure: semantic layout was not passed to delivery and the targeted collage repair did not complete.
- 6 plan-contract failures: sixth/seventh, twenty-first/twenty-second, Chinese plan/image markers, factual-number preservation, and canonical-ID duplicate enforcement.
- 2 quality-gate failures: collage was not converted to `suite_collage_layout`, and explicit single-product layout was not required/preserved.
- 3 suite-gate failures: semantic collage reject, semantic single-product pass, and unavailable/uncertain fail-closed behavior.

Self-review strict-schema RED command:

```powershell
node --test --test-concurrency=1 test/ecommerce-suite-diversity.test.mjs
```

Result: exit 1; 9 tests discovered, 8 passed, 1 failed. A numeric-string confidence value (`'0.98'`) was coerced and incorrectly accepted instead of failing closed.

## GREEN Evidence

Initial implementation focused GREEN: 150 passed, 0 failed.

Initial adjacent Task 2 GREEN: 181 passed, 0 failed.

Strict confidence targeted GREEN:

```powershell
node --test --test-concurrency=1 test/ecommerce-suite-diversity.test.mjs
```

Result: exit 0; 9 passed, 0 failed.

Final focused command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 151 passed, 0 failed, 0 skipped, 0 cancelled.

Final adjacent Task 2 command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 182 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once on the final code:

```powershell
npm test
```

Result: exit 0; 760 passed, 0 failed, 0 skipped, 0 cancelled.

Static and collaboration verification:

- `node --check` passed for all twelve changed JavaScript modules/tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- No test used production secrets, real network access, or a formal Mock provider.
- No deployment was performed.

## Changed Files

- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `server/ecommerceEngine/planContract.mjs`
- `server/ecommerceEngine/qualityGate.mjs`
- `server/ecommerceEngine/suiteDiversity.mjs`
- `server/index.mjs`
- `test/api-contract.test.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-plan-contract.test.mjs`
- `test/ecommerce-quality-gate.test.mjs`
- `test/ecommerce-suite-diversity.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Confirmed ordinal removal is terminal and marker-controlled; generic trailing numbers are no longer stripped. Tested factual identifiers and measurements remain distinct.
- Confirmed canonical duty IDs are deterministic, lowercase, structured, unique for every current planner item, and derived before shot direction. Different camera, crop, scene, or interaction metadata cannot legitimize a shared duty ID.
- Confirmed legacy snapshots may omit the optional canonical ID and continue through the existing strict snapshot migration and plan-text compatibility path.
- Confirmed the existing quality-model call is the only semantic visual call. The adapter now propagates its layout result; orchestration reuses that durable quality result at suite delivery.
- Confirmed semantic layout requires an exact supported verdict, a real finite numeric confidence of at least `0.7`, and non-empty evidence. Invalid or unavailable adapters remain retryable quality unavailability and cannot settle.
- Confirmed deterministic obvious-contact-sheet checks run first. Inconclusive geometry requires semantic `single_product`; semantic `collage` rejects only that asset.
- Confirmed collage repair uses the existing one-provider-repair cap, submission intent/idempotency key, durable asset row, and per-item reservation. The sibling remains at one submission and the failed asset at no more than two.
- Confirmed exact plan/quote/row/submission parity, Task 1 Product Truth and Style Reference Profile isolation, analysis-before-hold ordering, durable leases, storage recovery, and stable-only settlement remain covered by focused, adjacent, and full regression.
- Confirmed no unrelated source, runtime data, model route, billing price, frontend behavior, deployment code, or snapshot version changed.

## Concerns

No known contract failures. Production model-output behavior was not exercised because this task prohibits network, secrets, and deployment; invalid or unavailable semantic output fails closed by design.

## Commit

Planned subject: `fix: close final ecommerce suite review gaps`

---

# Task 2 Canonical Duty And Quality Prompt Review Fix

## Status

DONE. The remaining canonical-duty, controlled legacy ordinal, and formal quality-prompt findings were reproduced with RED tests, fixed, self-reviewed, and verified without deployment.

## Scope Implemented

- Replaced planner duty IDs derived from full purpose text with explicit canonical duty keys. The role and buyer-facing duty key are assigned before shot direction; camera, view, crop, scene, and composition metadata cannot affect `commercialDutyId`.
- Defined finite buyer-facing duty catalogs for hero, white-background, and transparent roles. Counts beyond a catalog reuse the canonical duty and fail the pre-billing plan contract instead of manufacturing uniqueness from shot wording or hashes.
- Kept SKU duties tied to normalized user-provided SKU facts rather than camera or generated purpose text.
- Replaced broad English suffix matching with a controlled presentation-ordinal parser. It recognizes valid numeric, Chinese, and English ordinals only after known presentation markers, plus the explicitly supported terminal `Product recognition <ordinal>` compatibility phrase.
- Added Chinese `廿`/`卅`/`卌` presentation-number support while preserving model, SKU, version, duration, dimension, size, and capacity facts.
- Moved the formal quality-model prompt into `buildFormalEcommerceQualityPrompt()` and made the production adapter call that helper. Its schema example is valid JSON with the concrete `single_product` verdict, numeric confidence, and non-empty evidence.

## RED Evidence

Focused RED command, run before production edits:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/api-contract.test.mjs
```

Result: exit 1; 155 tests discovered, 148 passed, 7 failed, 0 skipped, 0 cancelled. The seven expected failures covered:

- repeated planner roles exceeding their canonical duty catalogs, including the first/sixth hero sharing a duty despite different shot intent;
- bare English `sixth`/`seventh` and Chinese `第廿一张`/`第廿二张` compatibility normalization while preserving `image width` versus `image depth`;
- the production quality adapter lacking a shared prompt with a concrete, parseable semantic-layout JSON example.

No production code was changed before this RED run.

## GREEN Evidence

Final focused command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 155 passed, 0 failed, 0 skipped, 0 cancelled.

Final adjacent Task 2 command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 186 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once on the final production code:

```powershell
npm test
```

Result: exit 0; 764 passed, 0 failed, 0 skipped, 0 cancelled.

Static and collaboration verification:

- `node --check` passed for all nine changed JavaScript modules and tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- Tests used no production secrets, external network access, database, or provider Mock path.
- No deployment was performed.

## Changed Files

- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/index.mjs`
- `server/ecommerceEngine/planContract.mjs`
- `server/ecommerceEngine/qualityGate.mjs`
- `server/index.mjs`
- `test/api-contract.test.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-plan-contract.test.mjs`
- `test/ecommerce-quality-gate.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Confirmed `commercialDutyId` is constructed before `directShot` and receives only the normalized role plus an explicit canonical duty key. Shot/camera/view/composition wording is not read by the ID builder.
- Confirmed hero slot 1 and slot 6 share `maintext:productrecognition`, share the same communication goal, retain distinct shot intents, and are rejected by `validatePlanContract` as a duplicate duty.
- Confirmed white-background and transparent catalogs also fail closed when requested counts exceed their supported commercial duties. The planner still creates exactly the requested rows; validation rejects the unsupported suite before billing.
- Confirmed legacy text normalization recognizes `sixth`, `seventh`, `twenty-first`, `twenty-second`, and Chinese formal ordinals only in controlled presentation contexts. It contains no generic rule that strips arbitrary words ending in `st`, `nd`, `rd`, or `th`.
- Confirmed `image width` and `image depth`, attached and spaced model identifiers, SKU/version identifiers, ordinary numbers, durations, sizes, and capacities remain semantically distinct.
- Confirmed structured `commercialDutyId` remains the first duplicate check; legacy text normalization remains compatibility-only and cannot be bypassed with different shot metadata.
- Confirmed the production quality adapter calls the exported prompt builder. The embedded example parses as JSON and uses an accepted verdict, a real finite numeric confidence, and non-empty string evidence.
- Confirmed Task 1 visual snapshot isolation and analysis-before-hold ordering, Task 2 exact count/submission parity, durable leases/intents, bounded repair, semantic collage fail-closed behavior, stable-output retryability, and successful-sibling non-rerun behavior remain covered by focused, adjacent, and full regression.
- Confirmed no runtime database, generated output, cache, log, environment file, secret, `dist` artifact, upload, or deployment change is included.

## Concerns

No known contract failures. Production model output was not exercised because tests prohibit network and secrets; malformed or unavailable semantic layout output continues to fail closed by design.

## Commit

Planned subject: `fix: make ecommerce duties canonical`

---

# Task 2 Second Review: Detail Capacity And Schema-3 Duties

## Status

DONE. Both remaining Important findings were reproduced with RED tests, fixed, self-reviewed, and verified without deployment or network access.

## Scope Implemented

- Preserved the frontend `detail` contract at `0..10`; no UI count or test count was lowered.
- Restored the planner regression fixture from detail `5` to detail `6`.
- Expanded every canonical ecommerce category policy from five to ten genuinely different detail roles and buyer questions.
- Kept uncertain Product Truth out of required facts. Parameter, compatibility, fit, quantity, care, and similar duties explicitly require user-confirmed evidence; visible duties are limited to exterior/product evidence.
- Added a shared canonical commercial-duty catalog used by both the current planner and schema-3 migration. Canonical IDs are derived only from role plus an explicit duty key.
- Retained the legacy no-explicit-count planner default at five details while allowing explicit UI-supported detail counts through ten.
- Replaced schema-3 composition/view-based duty rewriting with fixed buyer-duty catalogs. Six repeated legacy main items now receive six real duties, including visible controls/handling as the sixth duty.
- Added canonical IDs to upgraded schema-3 items. Known roles recover through their catalogs; counts beyond a known catalog fail closed before provider work instead of manufacturing uniqueness.
- Preserved proof-backed legacy QC items as `detail_slice_qc` with `proofanswer`, required proof facts, and no repeated hold.

## RED Evidence

Primary focused RED command, run after test-only edits and before production edits:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/api-contract.test.mjs
```

Result: exit 1; 175 tests discovered, 169 passed, 6 failed, 0 skipped, 0 cancelled. All six failures were expected:

- the restored detail=6 planner fixture produced only 12 unique commercial-duty IDs for 13 plan items;
- the all-category detail=6/10 test found only five unique detail roles for the first category;
- the existing UI detail=6 quote/plan parity test failed plan validation on a repeated detail duty;
- the explicit UI detail=6/10 test failed the same pre-billing contract;
- schema-3 white-background migration returned two undefined canonical IDs;
- schema-3 six-main migration returned six undefined canonical IDs and still depended on composition/view text.

Self-review proof migration RED:

```powershell
node --test --test-concurrency=1 --test-name-pattern="schema-3 migration preserves a proof-backed QC commercial duty" test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 1 test discovered, 0 passed, 1 failed. The migrated role was `detail_slice_package` instead of proof-backed `detail_slice_qc`.

No production code was changed before either corresponding RED run.

## GREEN Evidence

Targeted proof migration GREEN: 1 passed, 0 failed.

Final focused command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 176 passed, 0 failed, 0 skipped, 0 cancelled.

Final complete Task 2 adjacent command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 207 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once on the final code:

```powershell
npm test
```

Result: exit 0; 767 passed, 0 failed, 0 skipped, 0 cancelled.

Static and collaboration verification:

- `node --check` passed for all seven changed JavaScript modules and tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- No production secret, provider Mock, external network, runtime database, upload, cache, log, environment file, or deployment was used.

## Changed Files

- `server/ecommerceEngine/commercialDutyCatalog.mjs` (new)
- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/categoryKnowledge.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-billing-ui.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Confirmed all eight canonical categories produce exactly six and ten requested detail rows with unique roles, canonical IDs, buyer goals, semantic suite keys, and a valid plan contract.
- Confirmed frontend quantity, quote request quantity, server plan length, and plan validation agree exactly for detail `6` and `10`; `IMAGE_TYPES.detail.maxCount` remains `10`.
- Confirmed no detail duty uses an ordinal, hash, camera, view, or composition as commercial differentiation.
- Confirmed category duties do not request hidden/internal structure, efficacy, medical claims, certification without proof, or uncertain parameter values.
- Confirmed the old no-explicit-count planner path remains five details, avoiding an unrequested default price increase.
- Confirmed current hero slot six remains rejected by the five-duty current planner catalog; only schema-3 recovery has a sixth evidence-safe buyer duty so already-held legacy work can finish.
- Confirmed schema-3 output IDs and buyer goals are fixed by role and catalog position before shot metadata is read. Changing camera, view, or composition cannot change the IDs or goals.
- Confirmed schema-3 six-item recovery performs zero analysis, planning, or new hold calls and submits exactly the six existing rows once.
- Confirmed proof-backed QC migration preserves role, proof IDs, required facts, deterministic generation mode, and the existing hold. A QC label without durable proof evidence does not receive the proof duty.
- Confirmed catalog overflow is a deterministic pre-execution error; migration no longer falls back to composition text to make an unsupported count pass.
- Confirmed ordinal width/depth compatibility normalization and the valid concrete semantic-quality prompt remain covered by focused, adjacent, and full regression.
- Confirmed Task 1 Product Truth/Style Reference Profile isolation, visual snapshot versions, analysis-before-hold ordering, durable leases/intents, exact visible count, one bounded repair, successful-sibling non-rerun, and stable-only settlement remain unchanged.

## Concerns

No known contract failures. Legacy schema-3 counts beyond a defined canonical role catalog now fail closed rather than fabricate buyer duties; this is intentional and occurs before any new provider submission or hold.

## Commit

Planned subject: `fix: align ecommerce detail and legacy duties`

---

# Task 2 Third Review: Evidence-Aware Duties And Mixed Migration

## Status

DONE. The default planner, evidence-aware detail-duty selection, and mixed schema-3 detail/QC recovery findings were reproduced with behavior-level RED tests, fixed, self-reviewed, and verified without deployment or network access.

## Scope Implemented

- Fixed the no-explicit-count planner to use the `communicationGoal` returned by `heroDuty()` and routed both default and explicit detail planning through one canonical duty resolver.
- Added a centralized detail-duty policy with exact normalized fact-name aliases, role-specific evidence types, semantic families, and a finite evidence-safe visible-duty fallback catalog.
- Kept factual duties such as parameters, compatibility, shade, fit, quantity, scale, care, flavor, and identifiers only when matching user-confirmed facts exist. Each factual item receives only its matching fact subset and uses deterministic overlay mode.
- Preserved the UI-supported detail count through ten. Missing evidence replaces the unavailable duty with an unused, semantically distinct exterior or use-context duty rather than changing quote units or manufacturing uniqueness with camera, view, ordinals, or hashes.
- Migrated schema-3 ordinary details by structured `sourceRole` before compatibility fallback. Proof-backed QC keeps its proof duty and does not consume an ordinary detail slot.
- Limited migrated ordinary detail duties to ten and fail closed before asset rows or provider work when an old plan exceeds that catalog.
- Made the migrated parent `assetPlan` authoritative for compile, quality, repair, settlement, and suite-comparison semantics. Non-final child snapshots are updated with the canonical plan item while preserving their submission intents, provider jobs, requests, quality, and repair history; final siblings remain untouched and are never rerun.

## RED Evidence

Primary focused RED command, run after test-only edits and before production edits:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/api-contract.test.mjs
```

Result: exit 1; 196 tests discovered, 190 passed, 6 failed, 0 skipped, 0 cancelled. The six expected failures covered:

- the default planner returning an empty hero communication goal;
- empty-fact category plans retaining factual duties;
- parameter duties consuming compatibility, care, and unrelated facts while compatibility received only product identity;
- the production-planner orchestrator fallback failing before hold instead of completing exact-count execution;
- schema-3 mixed food detail/QC migration assigning duties by global occurrence rather than structured source role;
- an empty-fact provider request retaining an unsupported compatibility duty.

No production file had changed before this RED run.

Additional overflow RED, added during self-review before the overflow implementation:

```powershell
node --test --test-concurrency=1 --test-name-pattern="schema-3 ordinary detail overflow fails closed" test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 1 test discovered, 0 passed, 1 failed. The eleven-item legacy detail plan incorrectly completed instead of failing before rows, holds, or provider submissions. After adding the ordinary-detail cap while excluding proof QC, the same command passed 1/1.

Additional canonical suite-authority RED, added before changing suite comparison:

```powershell
node --test --test-concurrency=1 --test-name-pattern="schema-3 mixed detail and QC resume" test/ecommerce-orchestrator.test.mjs
```

Result: exit 1; 1 test discovered, 0 passed, 1 failed. A completed sibling reached suite comparison with an undefined canonical duty ID from its old child snapshot. After parent-plan lookup by asset ID, the same command passed 1/1.

## GREEN Evidence

The directly affected asset-planner suite passed 16/16 after the evidence resolver and default-path fix.

Final focused command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 197 passed, 0 failed, 0 skipped, 0 cancelled.

Final complete Task 2 adjacent command:

```powershell
node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs test/ecommerce-job-store.test.mjs test/ecommerce-billing-ui.test.mjs test/api-contract.test.mjs
```

Result: exit 0; 213 passed, 0 failed, 0 skipped, 0 cancelled.

Full repository regression, run exactly once on the final production code:

```powershell
npm test
```

Result: exit 0; 773 passed, 0 failed, 0 skipped, 0 cancelled.

Static and collaboration verification:

- `node --check` passed for all six changed JavaScript modules and tests.
- `git diff --check` exited 0; Git emitted only LF-to-CRLF working-copy notices.
- `npm run collab:check` reported `READY`, linked worktree `yes`, tracked runtime paths `0`, ignored runtime changes `0`, and peer ownership conflicts `0`.
- No production secret, provider Mock, external network, runtime database, upload, cache, log, environment file, or deployment was used.

## Changed Files

- `server/ecommerceEngine/detailDutyPolicy.mjs` (new)
- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-prompt-compiler.test.mjs`
- `.superpowers/sdd/task-2-report.md`

## Self-Review

- Confirmed `heroDuty()` consumers use its returned `communicationGoal`; default no-count planning produces seven valid, exact items and the formal orchestrator validates before one seven-item hold.
- Confirmed the frontend and quote detail maximum remains ten. Every supported category produces ten contract-valid duties with empty confirmed facts, distinct roles, canonical IDs, buyer goals, and suite semantics.
- Confirmed fact matching is exact and centralized. An unrelated fact cannot unlock a factual role; parameter and compatibility duties receive separate matching subsets, and non-user facts cannot unlock them.
- Confirmed unavailable factual duties are omitted before planning. Safe replacements describe only visible form, material, finish, exterior detail, or credible context and do not request hidden structure, efficacy, certification, or unconfirmed parameters.
- Confirmed factual duties use deterministic overlays and high risk; safe duties retain only product identity as required facts. Provider-visible role objectives contain no unsupported factual commitment.
- Confirmed schema-3 ordinary detail mapping honors a known source role regardless of plan order. A proof-backed QC item retains proof IDs/facts and does not shift later ordinary roles.
- Confirmed eleven ordinary legacy details fail before new analysis, planning, hold, asset-row creation, or provider submission; a proof-backed QC item is not counted against the ten ordinary duties.
- Confirmed the canonical parent plan controls every live semantic consumer, including suite comparison against already completed siblings. Durable child submission intents, acknowledged provider jobs, repair actions, and completed states remain intact.
- Confirmed the mixed resume performs zero repeated analysis, planning, or hold calls; completed siblings submit and settle zero times, the polling child reuses its provider job, and only the queued child submits once.
- Confirmed Task 1 Product Truth/Style Reference Profile isolation, strict snapshot versions, analysis-before-hold ordering, Task 2 exact row/quote/submission parity, bounded repair, semantic collage behavior, retryable storage, leases, and stable-only settlement remain covered by focused, adjacent, and full regression.
- Confirmed no frontend count, billing price, model route, runtime file, generated output, cache, log, secret, `dist` artifact, upload, or deployment code changed.

## Concerns

No known contract failures. Production provider/model output was not exercised because this task prohibits network and secrets; malformed or unavailable semantic quality output continues to fail closed under the existing contract.

## Commit

Planned subject: `fix: make ecommerce detail duties evidence aware`

---

## Task 2 Review Fix Wave 4

### RED/GREEN evidence

- RED focused command: `node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-ui.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/api-contract.test.mjs` exited 1: 203 tests, 197 pass, 6 intended failures (trusted source, typed aliases, safe fallback, SKU identity/contract).
- Additional migration/repair RED: `node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/ecommerce-quality-gate.test.mjs` exited 1: 96 tests, 92 pass, 4 intended failures (untrusted proof, repeated detail family, two Sharp retry assertions).
- GREEN focused: same required focused command exited 0: 205 passed.
- Adjacent Task 2 suite exited 0: 221 passed.
- Final full repository `npm test` (after fixing formal export fixtures to supply trusted Product Truth source IDs) exited 0: 781 passed, 0 failed, 0 skipped, 0 cancelled.
- `node --check`, `git diff --check`, and `npm run collab:check` passed on the final tree.

### Changes and self-review

- Trusted product source assets are mandatory before formal planning; empty-fact ten-detail plans use only generic exterior/material/finish/detail/context duties.
- Fact aliases are exclusive by commercial claim; generic size is not silently promoted to fit or scale, while explicit typed names unlock only their matching role.
- Schema-3 QC migration intersects declared proof IDs with durable deterministic proof/protection inputs; untrusted proof is replaced by a safe ordinary duty.
- Repeated legacy detail semantic families select an unused replacement; local Sharp and provider repairs share the one-repair cap.
- SKU rows use `sku:variant` plus normalized structured `variantIdentity`; contract permits only distinct identities and no hash-derived duty identifier.
- Updated export fixtures to provide the newly required trusted product source.

### Changed files

- `server/ecommerceEngine/assetPlanner.mjs`
- `server/ecommerceEngine/detailDutyPolicy.mjs`
- `server/ecommerceEngine/orchestrator.mjs`
- `server/ecommerceEngine/planContract.mjs`
- `server/ecommerceEngine/repairPlanner.mjs`
- `test/ecommerce-asset-planner.test.mjs`
- `test/ecommerce-export.test.mjs`
- `test/ecommerce-orchestrator.test.mjs`
- `test/ecommerce-plan-contract.test.mjs`
- `test/ecommerce-quality-gate.test.mjs`
