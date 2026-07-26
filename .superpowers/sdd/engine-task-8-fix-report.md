# Structured Ecommerce Engine Task 8 Fix Report

## Status

- Result: DONE
- Worktree: `F:/da/shubao/.worktrees/codex-ecommerce-stability`
- Branch: `codex/ecommerce-stability`
- Baseline: `d6417e3`
- Commit message: `fix: harden ecommerce recovery and settlement`

## Requirement source

Implemented only the requirements in:

`F:/da/shubao/.worktrees/codex-ecommerce-stability/.superpowers/sdd/engine-task-8-fix-brief.md`

## TDD evidence

Each production behavior was preceded by a regression test and an observed expected RED failure:

1. Orchestration snapshot persistence and reuse
   - RED: persisted parent progress had no `orchestrationSnapshot`.
   - RED: resume rebuilt analysis/planning and could select a changed Asset Plan.
   - RED: the persisted snapshot did not include the billing hold ID.
   - GREEN: sanitized Product Truth, Campaign Bible, complete Asset Plan, deterministic inputs, and hold ID are persisted and reused; persisted per-asset plan items remain authoritative.

2. Parent fenced lease ownership
   - RED: `claimNext()` returned no parent lease token.
   - RED: the parent store had no `claim()` API and stale owners were not fenced.
   - GREEN: parent claims, renewals, releases, checkpoints, and transitions are token-fenced; `resumeJobs()` passes the claimed token into `runJob()`.

3. Recoverable successful settlement
   - RED: transient settlement left the asset in `quality_check`.
   - RED: a successful settlement followed by a local completion-write failure fell into the generic failure/release path.
   - GREEN: durable `settling` state precedes settlement; replay uses the same billing item/idempotency identity and completes without a second charge or release.

4. Recoverable release and hold remainder compensation
   - RED: an invalid later Asset Plan item allowed the hold to be created.
   - RED: parent setup failure after hold creation released no remainder.
   - RED: transient parent compensation could be retried more than once in the same resume attempt.
   - RED: quality-release failure remained in `quality_check`.
   - RED: provider failure swallowed a failed release and terminalized the asset.
   - GREEN: the full plan is validated before hold creation; hold ID is checkpointed before asset setup; parent setup uses durable hold-level `releaseRemainder`; assets use durable `releasing` state and retry the same per-item release before terminalization.

5. Stable-image MIME
   - RED: no stable-image data URL helper existed and production quality analysis was hard-coded to PNG.
   - GREEN: JPEG, PNG, and WebP stable bytes use their detected MIME in quality-analysis data URLs.

6. Startup recovery
   - RED: no bounded/coalesced startup recovery helper existed and production used fire-and-forget `.then().catch()` before `app.listen`.
   - GREEN: startup recovery is awaited before listening, coalesces duplicate callers, retries top-level scan failures with a fixed bound, reports per-task rejected recovery results, and treats missing provider credentials as retryable work so the service remains startable.

## Implementation summary

- Persisted a sanitized orchestration snapshot in parent job progress and reused it on every restart.
- Added durable parent job lease columns with idempotent schema migration.
- Added fenced `claim`, `claimNext`, `checkpoint`, `renewLease`, `releaseLease`, and transition enforcement.
- Added `settling` and `releasing` asset states to close billing/local-state failure windows.
- Added durable parent setup compensation metadata and hold-level remainder release.
- Preserved existing provider job IDs, stable bytes, repair cap, per-item billing identities, and API contracts.
- Added an actual-content-type stable data URL helper and wired it into ecommerce quality analysis.
- Added bounded, memoized startup recovery and awaited it before HTTP/HTTPS traffic starts.

## Adjacent files touched

The following adjacent ecommerce files were necessary and are within the brief's permitted exception:

- `server/ecommerceEngine/jobStore.mjs`
  - Required to persist the durable `settling` and `releasing` intermediate states and include them in recovery scans.
- `server/ecommerceEngine/index.mjs`
  - Required only to export the new startup recovery helper used by production wiring.

No billing catalog, billing schema, database runtime file, product page, upload/cache directory, generated asset directory, or `dist/` output is included.

## Verification

- Focused brief suite:
  - `node --test --test-concurrency=1 test/ecommerce-orchestrator.test.mjs test/ecommerce-route-integration.test.mjs test/api-contract.test.mjs test/generated-assets.test.mjs`
  - PASS: 46/46
- Adjacent store regressions:
  - `node --test --test-concurrency=1 test/ecommerce-job-store.test.mjs test/generation-jobs.test.mjs`
  - PASS: 12/12
- Full repository tests:
  - `npm test`
  - PASS: 377/377
- Syntax:
  - `node --check server/index.mjs`
  - PASS
- Production build:
  - `npm run build`
  - PASS
- Diff hygiene:
  - `git diff --check`
  - PASS

## Self-review

- API routes remain `/api/generate-ecommerce` and `/api/ecommerce/jobs/:id`.
- Provider IDs are still persisted before polling.
- Stable bytes are still persisted before quality evaluation and completion.
- System repairs remain capped at two and do not create new user charges.
- Settlement and release identities remain stable and per-item; parent setup compensation uses one stable hold-remainder identity.
- Missing provider credentials leave recovery work retryable and do not prevent startup after the completed scan.
- No runtime database, generated asset, upload, cache, or `dist/` file is staged.

## Concerns

None within the Task 8 scope.
