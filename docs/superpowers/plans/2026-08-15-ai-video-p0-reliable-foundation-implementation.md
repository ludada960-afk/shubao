# AI Video P0 Reliable Foundation Implementation Plan

> **Required execution skill:** Use `superpowers:executing-plans` for implementation. Each task must be completed test-first and committed separately when its verification gate passes.

**Goal:** Turn the existing video generation path into a recoverable, owner-scoped, observable delivery system that never reports a refund before the wallet confirms it, never loses an accepted provider task silently, and can later support assets, storyboards, timelines, project memory, and declarative Skills without replacing the P0 foundation.

**Architecture:** Keep the existing Express, SQLite, wallet, provider adapter, queue, project, Works, and VideoStudio surfaces, but separate durable facts into job, attempt, delivery, billing, projection, review, and outbox records. Use additive migrations and compatibility projections so the current API remains usable while new state is adopted. Media is visible from a local object URL immediately, uploaded in the background, stored under authenticated ownership, and streamed to disk rather than buffered in memory.

**Tech Stack:** Node.js ESM, Express 4, better-sqlite3, React 18, Node test runner, official tus packages (`@tus/server`, `@tus/file-store`, `tus-js-client`), existing wallet/project/Works/provider abstractions.

**Global Constraints:**

- Do not call paid image or video generation while implementing or testing P0.
- Preserve the current production API contract unless a security fix requires authentication.
- Every provider submission uses a stable idempotency key and records an attempt before network I/O.
- A user-facing terminal success requires durable delivery, settled billing, and successful projection.
- A user-facing refund claim requires a confirmed wallet release. Otherwise expose a reconciliation state.
- Existing `video_assets`, `video_jobs`, and Works rows remain readable during migration.
- All new schema changes are additive and guarded by feature flags until backfill verification passes.
- Deployment uses only `scripts/deploy-production.ps1`; public verification occurs only after a successful fenced deployment.

## Task 1: Enforce Video Asset Ownership

**Files:**

- Modify: `server/videoGeneration.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/VideoStudio/index.jsx`
- Test: `test/video-generation.test.mjs`
- Test: `test/video-studio-contract.test.mjs`

**Step 1: Write failing service tests**

Add tests proving `readAsset(id, ownerEmail)` returns the owner's asset and rejects a different owner. Add a compatibility test proving provider-facing reference URLs are generated through a signed provider-media mechanism rather than relying on the user session route.

Run:

```powershell
node --test --test-concurrency=1 test/video-generation.test.mjs
```

Expected: FAIL because `readAsset` currently ignores ownership.

**Step 2: Write failing route contract tests**

Require `/api/video/assets/:id` to pass through `authenticateVideoRequest`, forward the normalized email, return `404` for another owner, and preserve range streaming for an authorized owner.

Run:

```powershell
node --test --test-concurrency=1 test/video-studio-contract.test.mjs
```

Expected: FAIL because the GET route is anonymous.

**Step 3: Implement owner-scoped reads**

Change the service interface to:

```js
readAsset(id, ownerEmail)
```

Query by both `id` and normalized `owner_email`. Authenticate the route and avoid leaking whether another user's asset exists. Keep range, content type, cache, and content-disposition behavior unchanged for the owner.

**Step 4: Separate provider delivery URLs**

Add an expiring HMAC-signed provider media URL or equivalent authenticated server-to-server route. The signature must bind asset id, owner, expiry, and purpose. Do not expose permanent public input URLs.

**Step 5: Verify and commit**

Run both focused tests, then:

```powershell
npm test
git diff --check
```

Commit: `fix: enforce video asset ownership`

## Task 2: Make Billing Compensation Truthful and Recoverable

**Files:**

- Modify: `server/videoGeneration.mjs`
- Add: `server/videoPlatformStore.mjs`
- Test: `test/video-generation-reliability.test.mjs`
- Test: `test/video-generation.test.mjs`
- Test: `test/billing-wallet.test.mjs`

**Step 1: Write fault-injection tests**

Cover provider failure with wallet release success, wallet release throw, queue-closed after hold creation, job persistence throw, and replay of the same release operation. Assert a release failure never produces `failed` plus a refund-success message.

Expected new public states:

```js
{ status: 'reconciling', billingState: 'release_pending' }
{ status: 'failed', billingState: 'released' }
```

**Step 2: Add additive state columns**

Create compatibility migrations for `video_jobs`:

```sql
billing_state TEXT NOT NULL DEFAULT 'none'
delivery_state TEXT NOT NULL DEFAULT 'none'
projection_state TEXT NOT NULL DEFAULT 'none'
review_state TEXT NOT NULL DEFAULT 'none'
reconciliation_error TEXT
```

Extend the allowed status contract with `reconciling`. Keep old rows readable by deriving sensible defaults.

**Step 3: Implement idempotent compensation**

Record a durable release intent before calling the wallet. On success mark `released`; on failure keep `release_pending`, record the error, enqueue reconciliation, and use accurate user copy. Replays must use the same hold id, item key, and reason.

**Step 4: Verify and commit**

Run focused reliability and wallet tests, then full tests and `git diff --check`.

Commit: `fix: reconcile failed video billing releases`

## Task 3: Replace the `needs_review` Dead End with Review Cases

**Files:**

- Add: `server/videoReviewStore.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `server/videoQueue.mjs`
- Modify: `server/adminOperations.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/AdminConsole/index.jsx`
- Modify: `src/pages/VideoStudio/index.jsx`
- Test: `test/video-generation-reliability.test.mjs`
- Test: `test/admin-routes.test.mjs`
- Test: `test/admin-console-contract.test.mjs`
- Test: `test/video-studio-model.test.mjs`

**Step 1: Specify the review state machine in tests**

Use:

```text
open -> checking_provider -> accepted | not_submitted | quarantined
accepted -> processing
not_submitted -> queued (same submission key, incremented attempt)
quarantined -> manual resolution
```

Assert `needs_review` is operational waiting, not a terminal result, and cannot settle or release credits without a resolution.

**Step 2: Persist review cases**

Store `job_id`, `attempt_id`, `provider`, `submission_key`, timestamps, evidence, resolution, actor, and resolution note. Enforce one open case per job/attempt.

**Step 3: Add automatic and manual resolution**

On startup and on a bounded interval, query providers that support idempotency lookup. Add admin actions for accepted, not submitted, and quarantine. Audit all manual changes.

**Step 4: Update user and admin UI**

Show “正在核实上游受理结果，不会重复扣费或重复提交” with last-check time. Do not label it as failed. Admin lists expose age, provider, attempt, hold amount, and next safe action.

**Step 5: Verify and commit**

Run focused video/admin tests, full tests, build, and diff check.

Commit: `feat: add recoverable video review cases`

## Task 4: Persist Attempts Before Provider Submission

**Files:**

- Add: `server/videoAttemptStore.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `server/videoProviders.mjs`
- Test: `test/video-generation-reliability.test.mjs`
- Test: `test/video-providers.test.mjs`

**Step 1: Write idempotency and crash-window tests**

Test crashes before submission, after provider acceptance but before task id persistence, and after task id persistence. Assert all retries use the same submission key until the attempt is conclusively not submitted.

**Step 2: Add `video_job_attempts`**

Persist attempt number, submission key, request hash, provider, model, capability snapshot, provider task id, state, timestamps, and error classification before network I/O.

**Step 3: Extend provider adapters**

Provider interface:

```js
submit(request, { idempotencyKey, signal })
lookupSubmission({ idempotencyKey, providerTaskId, signal })
poll(providerTaskId, { signal })
download(providerTaskId, result, { signal })
```

Adapters declare whether idempotent submission and lookup are supported. Unsupported uncertainty goes to a review case, never an automatic duplicate submission.

**Step 4: Verify and commit**

Commit: `feat: persist video provider attempts`

## Task 5: Stream and Verify Provider Deliveries

**Files:**

- Add: `server/videoDeliveryStore.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `server/generatedAssets.mjs`
- Test: `test/video-generation-reliability.test.mjs`
- Test: `test/video-generation.test.mjs`

**Step 1: Write delivery integrity tests**

Cover chunked response streaming, maximum size enforcement, content type rejection, truncated response, checksum mismatch, process crash before rename, and replay after an already verified delivery.

**Step 2: Implement streaming persistence**

Use `Readable.fromWeb(response.body)` and `stream/promises.pipeline()` to a temp file while counting bytes and hashing SHA-256. Validate media headers and configured limits, fsync when supported, then atomically rename. Never call `response.arrayBuffer()` for provider output.

**Step 3: Persist immutable delivery facts**

Store attempt id, provider source, local object path, content type, byte count, checksum, duration when inspectable, verification state, and timestamps. Replays return the same verified delivery.

**Step 4: Verify and commit**

Commit: `feat: stream and verify video deliveries`

## Task 6: Add a Durable Outbox for Settlement and Projection

**Files:**

- Add: `server/videoOutbox.mjs`
- Add: `server/videoProjection.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `server/videoQueue.mjs`
- Modify: `server/works.mjs`
- Modify: `server/index.mjs`
- Test: `test/video-generation-reliability.test.mjs`
- Add: `test/video-outbox.test.mjs`
- Test: `test/canvas-work-model.test.mjs`

**Step 1: Write convergence tests**

Inject failures between delivery verification, wallet settlement, project projection, Works projection, and final job status. Restart the worker and assert eventual convergence without double charge, duplicate Works, or duplicate project versions.

**Step 2: Add transactional outbox records**

Events:

```text
video.delivery.verified
video.billing.settle.requested
video.project.project.requested
video.works.project.requested
video.job.finalize.requested
video.billing.release.requested
```

Each event has deterministic id, aggregate id, payload, state, attempt count, next attempt, lock owner, and last error.

**Step 3: Implement idempotent consumers**

Wallet uses existing idempotent item settlement/release. Project and Works projections use deterministic external ids. Finalization requires all mandatory projections to be complete.

**Step 4: Verify and commit**

Commit: `feat: converge video delivery through durable outbox`

## Task 7: Bridge Video Assets into the Existing Project Model

**Files:**

- Modify: `server/projects/projectStore.mjs`
- Add: `server/videoProjectBridge.mjs`
- Modify: `server/videoGeneration.mjs`
- Modify: `src/pages/VideoStudio/index.jsx`
- Test: `test/project-version-store.test.mjs`
- Add: `test/video-project-bridge.test.mjs`

**Step 1: Write project-version tests**

Creating a video draft must create or reuse a transparent project, append immutable input/output asset versions, retain lineage from references to delivery, and keep legacy `video_assets` readable during double-write.

**Step 2: Implement the bridge**

Map current source media, prompt, model settings, plan, attempt, and selected output to the existing project/version APIs. Use stable lineage ids and do not copy large media blobs into SQLite.

**Step 3: Backfill and verify**

Add a dry-run backfill script reporting orphaned assets, missing owners, duplicate checksums, and unsupported rows before any write mode is enabled.

Commit: `feat: version video assets in projects`

## Task 8: Add Resumable Upload with Immediate Local Preview

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Add: `server/videoUploadService.mjs`
- Modify: `server/index.mjs`
- Add: `src/services/videoUploadClient.js`
- Modify: `src/pages/VideoStudio/index.jsx`
- Add: `test/video-upload.test.mjs`
- Test: `test/video-studio-contract.test.mjs`

**Step 1: Add official tus packages**

Install pinned compatible versions of `@tus/server`, `@tus/file-store`, and `tus-js-client`. Record licenses and avoid a custom resumable protocol.

**Step 2: Test the upload contract**

Assert owner-bound upload creation, resumable offsets, size/type limits, expired session cleanup, checksum verification, and conversion into a project asset. Anonymous access and ownership changes must fail.

**Step 3: Implement immediate preview**

In VideoStudio, create an object URL after local decode and render it immediately. Start the resumable upload in the background, show byte progress and retry state, and replace the temporary URL only after cloud persistence. Revoke object URLs on replacement/removal/unmount.

**Step 4: Verify performance without network spend**

Use local fixtures. Require decoded local preview to appear within 300 ms on the test machine after file selection; cloud persistence may continue independently.

Commit: `feat: add resumable video asset uploads`

## Task 9: Add Reconciliation, Metrics, and Operations Views

**Files:**

- Add: `server/videoReconciliation.mjs`
- Modify: `server/adminOperations.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/AdminConsole/index.jsx`
- Add: `test/video-reconciliation.test.mjs`
- Test: `test/admin-routes.test.mjs`
- Test: `test/admin-console-contract.test.mjs`

**Step 1: Define operational metrics**

Expose counts and age buckets for queued, submitting, processing, review, reconciliation, delivery pending, settlement pending, projection pending, completed, and failed. Segment success rate, first-result time, delivery time, retry rate, and cost by provider/model/capability.

**Step 2: Implement bounded reconcilers**

Use leases and deterministic backoff. Reconcile stale attempts, review cases, pending releases, pending settlements, incomplete projections, abandoned upload sessions, and orphaned temp files. A worker restart must safely resume.

**Step 3: Add admin actions with audit records**

Allow safe recheck, replay projection, retry confirmed-not-submitted jobs, and quarantine. Do not expose destructive bulk actions.

Commit: `feat: operate and reconcile video jobs`

## Task 10: Migrate, Cut Over, and Prove the P0 Foundation

**Files:**

- Add: `scripts/backfill-video-platform.mjs`
- Add: `scripts/verify-video-platform.mjs`
- Modify: `scripts/deploy-production.ps1`
- Modify: `server/config.mjs`
- Modify: `RTK.md`
- Test: `test/verify-production-video.test.mjs`
- Test: `test/api-contract.test.mjs`

**Step 1: Add feature flags**

Flags:

```text
VIDEO_PLATFORM_OWNER_READS
VIDEO_PLATFORM_ATTEMPTS
VIDEO_PLATFORM_OUTBOX
VIDEO_PLATFORM_PROJECT_BRIDGE
VIDEO_PLATFORM_TUS_UPLOAD
VIDEO_PLATFORM_READ_NEW_STATE
```

Every flag has a rollback path that keeps new rows but restores the previous reader/writer safely.

**Step 2: Run dry-run backfill and invariants**

Verify every active job has an owner, hold, attempt or migration marker, and recoverable state; every completed job has a verified delivery and projection; every failed job claiming refund has a released wallet item.

**Step 3: Run the complete local gate**

```powershell
npm test
npm run build
npm run check
git diff --check
node scripts/verify-video-platform.mjs --local --no-paid-generation
```

Expected: all pass, with zero provider submissions.

**Step 4: Deploy with the fenced production script**

Only after SSH credentials are available to the executing environment:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1
```

The script must run migration verification before switch, confirm health after switch, and roll back only while it still owns the deployment fence.

**Step 5: Run public non-billable canaries**

Verify authentication, capabilities, upload session creation/cancel, owner isolation, range reads, admin metrics, and reconciliation visibility. Do not submit a paid generation.

**Step 6: Update the durable roadmap**

Record P0 completion evidence and unblock P1 in `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`. P1 starts only after production metrics show the P0 invariants hold.

Commit: `docs: record ai video p0 production evidence`

## P0 Exit Criteria

- No video input or output asset can be read by an anonymous or different user.
- Provider uncertainty never causes an automatic duplicate submission.
- Provider output is streamed, integrity checked, and durable before billing settlement.
- Refund messaging is backed by a confirmed wallet release.
- Any crash window between submission and completion converges after restart.
- Completed jobs project exactly once into project history and Works.
- Uploads are resumable and local previews do not wait for cloud persistence.
- Admins can identify and safely resolve every non-terminal state.
- Full test/build/check gates pass and public non-billable canaries pass after a fenced deployment.
- P1 asset/storyboard/timeline work remains blocked until these criteria have production evidence.
