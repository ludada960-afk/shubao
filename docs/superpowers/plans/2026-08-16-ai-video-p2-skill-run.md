# AI Video P2 SkillRun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an owner-scoped, declarative SkillRun preview and checkpoint event log that can later drive video generation without submitting provider or billing requests.

**Architecture:** Keep the existing video workbench store and route gate as the boundary. Store a normalized SkillRun and append-only events in dedicated SQLite tables; use the existing project idempotency table for preview creation. The first release ends at human confirmation and exposes no provider execution.

**Tech Stack:** Node.js ESM, better-sqlite3, Express 4 route adapters, Node test runner.

## Global Constraints

- Owner identity comes only from the signed session; request bodies cannot select an owner.
- Every read and write is scoped to an existing owner-owned video project.
- SkillRun input, plan, and events are bounded JSON snapshots; no hidden prompt state is accepted.
- Preview and confirmation must not create provider jobs, generation runs, usage records, wallet entries, or billing holds.
- The workbench remains default-off and all existing routes retain their current behavior.

### Task 1: Define the SkillRun contract with failing store tests

**Files:**
- Modify: `test/video-workbench-store.test.mjs`
- Create: `server/videoSkillRun.mjs`

**Interfaces:**
- `normalizeSkillRunSpec(spec)` returns a bounded normalized `{skillId, skillVersion, input, steps, checkpoints, modelPolicy, outputContract}` or throws a coded validation error.
- `createVideoWorkbenchStore().previewSkillRun({ ownerEmail, projectId, idempotencyKey, spec })` returns a run projection.
- `createVideoWorkbenchStore().getSkillRun({ ownerEmail, projectId, runId })` returns the run plus ordered events.
- `createVideoWorkbenchStore().confirmSkillCheckpoint({ ownerEmail, projectId, runId, checkpointId, expectedRevision })` returns the updated run.

- [x] Write tests for normalized valid specs, invalid/oversized specs, owner isolation, idempotent preview, append-only event order, optimistic revision conflict, and no billing/provider tables.
- [x] Run the red test first and observe the expected missing-method failures.

### Task 2: Implement the bounded SkillRun normalizer and persistence

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Modify: `server/videoSkillRun.mjs`

- [x] Add the two SkillRun tables and owner/project indexes in the existing schema initializer.
- [x] Implement preview creation with a `skill-run.preview` event and project idempotency response.
- [x] Implement owner-scoped reads and confirmation with `expectedRevision`; confirmation only appends `checkpoint.confirmed` and moves the run to `confirmed`.
- [x] Run the focused store tests and keep the implementation limited to the tested contract.

### Task 3: Expose owner-gated routes and client helpers

**Files:**
- Modify: `server/videoWorkbenchRoutes.mjs`
- Modify: `src/services/videoWorkbench.js`
- Modify: `test/video-workbench-routes.test.mjs`
- Modify: `test/video-workbench-client.test.mjs`

- [x] Add POST preview, GET run, and POST checkpoint confirmation routes under the existing workbench prefix.
- [x] Require `Idempotency-Key` for preview and `expectedRevision` for confirmation; map missing projects and conflicts through existing error handling.
- [x] Add signed client helpers and route tests proving owner isolation, replayed preview response, and no generation/billing mutation.

### Task 4: Verify, document, and release

**Files:**
- Modify: `docs/superpowers/plans/2026-08-16-ai-video-p2-skill-run.md`
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md`

- [x] Run focused tests, `npm test`, `npm run check`, `npm run build`, and `git diff --check`.
- [x] Run the non-billing workbench verifier and confirm no provider submissions or billing mutations.
- [ ] Deploy only through `scripts/deploy-production.ps1`; run the independent video, billing, and health checks plus canary.
- [ ] Record commit, active release, PM2, canary, and any unrelated gallery probe findings.

### Task 5: Add the provider-free DAG execution preview

**Files:**
- Modify: `server/videoSkillRun.mjs`
- Modify: `test/video-skill-run.test.mjs`
- Create: `docs/superpowers/plans/2026-08-16-ai-video-p2-skill-executor.md`

- [x] Reject cyclic step dependencies during normalization.
- [x] Compute deterministic ready, blocked, and complete step sets from a
  normalized spec and completed step IDs.
- [x] Reject unknown or duplicate completed step IDs with a coded state error.
- [x] Keep the executor pure; it performs no provider, generation, usage, or
  billing writes.
- [x] Focused SkillRun/workbench regression passed `33/33`; full test/build
  gates are recorded below.

Release note: local commits `834cfa6`, `29d61d1`, and the follow-up executor
slice pass all local gates. The deployment
script reached the remote step but could not read
`C:\\Users\\SHEJI\\.ssh\\shubao_deploy_ed25519`; it refused an unfenced
rollback before mutating production. Public video and billing checks still pass,
while the new SkillRun route returns `404`, confirming that this commit is not
deployed. The release gate remains open until the controlled deployment
credential is available to the release process.
