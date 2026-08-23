# Video Shot Execution Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile a persisted shot recovery plan into a deterministic, owner-scoped execution draft that a future provider worker can consume without silently changing the selected candidate or timeline.

**Architecture:** Keep recovery plans as immutable intent and add a read/compile operation in the video workbench store. The compiler rehydrates the current workbench, verifies the plan hash, shot revision, selected candidate, timeline clip bindings, and canonical project-asset references, then returns a provider-neutral draft with a separate execution hash. It performs no provider submission, billing mutation, or shared asset writes.

**Tech Stack:** Node.js ESM, better-sqlite3, Express 4, React 18, existing video workbench service and Node test runner.

## Global Constraints

- Only modify video-domain files and their tests; do not modify `server/projects/*`, Canvas, Works, shared asset contracts, billing, production scripts, or deployment files.
- Historical project-asset reads remain `purpose: 'read'`; new reuse/binding paths remain `purpose: 'reuse'`.
- No provider submission, billing mutation, real generation, or credit consumption is allowed in this stage.
- Owner and project scope must be checked on every store and route operation.
- A stale shot/candidate/timeline binding must fail closed with an actionable error.

---

### Task 1: Compile a recovery plan into a provider-neutral execution draft

**Files:**
- Modify: `server/videoShotRecovery.mjs`
- Modify: `server/videoWorkbenchStore.mjs`
- Test: `test/video-shot-recovery.test.mjs`
- Test: `test/video-workbench-store.test.mjs`

**Interfaces:**
- Produce `compileShotRecoveryExecution(plan, workbench)` in `server/videoShotRecovery.mjs`.
- Produce `store.prepareShotRecoveryExecution({ ownerEmail, projectId, planId })` returning `{ execution, replayed: false }`-compatible data with `providerSubmission: false` and `billingMutation: false`.
- The execution draft contains `planId`, `planHash`, `shot`, `sourceCandidate`, `sourceTimelineClips`, `edit`, `preserve`, `executionHash`, and the two no-side-effect flags.

- [x] **Step 1: Write failing tests**

  Add tests proving a valid plan returns the selected candidate's canonical ref and affected timeline clips, that a changed shot revision raises `SHOT_RECOVERY_STALE`, and that a missing candidate canonical ref raises `PROJECT_ASSET_REF_INVALID` without creating provider or billing rows.

- [x] **Step 2: Run focused tests and verify the new contract fails**

  Run `node --test test/video-shot-recovery.test.mjs test/video-workbench-store.test.mjs`.
  Expected: FAIL because `compileShotRecoveryExecution` and `prepareShotRecoveryExecution` do not exist.

- [x] **Step 3: Implement deterministic compilation**

  In `videoShotRecovery.mjs`, validate the persisted plan with `assertShotRecoveryPlanIntegrity`, locate the matching current shot, require equal revisions and selected candidate ids, resolve each affected clip to its candidate, and return a stable object whose hash is computed from the normalized execution payload. Preserve untouched shot/candidate/clip ids exactly as the plan recorded them.

  In `videoWorkbenchStore.mjs`, owner-scope the recovery row lookup, parse and integrity-check `plan_json`, call `api.listWorkbench`, compile the draft, and return it. Do not update the row or call provider/billing APIs.

- [x] **Step 4: Run focused tests**

  Run `node --test test/video-shot-recovery.test.mjs test/video-workbench-store.test.mjs`.
  Expected: PASS with all existing and new tests green.

### Task 2: Expose the execution draft through the video route and client

**Files:**
- Modify: `server/videoWorkbenchRoutes.mjs`
- Modify: `src/services/videoWorkbench.js`
- Modify: `src/pages/VideoStudio/VideoProjectWorkbench.jsx`
- Modify: `src/pages/VideoStudio/VideoProjectWorkbench.css`
- Test: `test/video-workbench-routes.test.mjs`
- Test: `test/video-project-workbench-ui.test.mjs`

**Interfaces:**
- Add `POST /api/video/projects/:projectId/workbench/recovery-plans/:planId/prepare`.
- Add `prepareShotRecoveryExecution(projectId, planId)` in `src/services/videoWorkbench.js`.
- The UI shows a compact “校验执行草稿” action and only displays the returned plan hash, source candidate, and target operation; it never labels the draft as generated output.

- [x] **Step 1: Write failing route/client/UI tests**

  Assert owner-scoped success, stale-plan conflict, and no provider/billing mutation. Assert the UI contains the prepare action and the no-side-effect execution status copy.

- [x] **Step 2: Run focused tests and verify failure**

  Run `node --test test/video-workbench-routes.test.mjs test/video-project-workbench-ui.test.mjs`.
  Expected: FAIL because the route, client method, and action are absent.

- [x] **Step 3: Implement the route/client/UI wiring**

  Route through the existing authenticated `dispatch` helper. Keep errors unchanged so `SHOT_RECOVERY_STALE` and canonical-ref failures reach the client. Disable the action while another mutation is active and clear the preview when the workbench refreshes or the plan changes.

- [x] **Step 4: Run focused tests**

  Run `node --test test/video-workbench-routes.test.mjs test/video-project-workbench-ui.test.mjs`.
  Expected: PASS.

### Task 3: Run local gates and hand off without deployment

**Files:**
- No source files beyond Tasks 1-2.

- [x] **Step 1: Run video-focused regression**

  Run `node --test test/video-shot-recovery.test.mjs test/video-workbench-store.test.mjs test/video-workbench-routes.test.mjs test/video-workbench-plan.test.mjs test/video-model-router.test.mjs test/video-project-workbench-model.test.mjs`.

- [x] **Step 2: Run repository checks**

  Run `npm run check`, `npm run collab:check`, and `git diff --check`. Run `npm run build` when the current `dist` directory is not held by another process; report an EPERM lock rather than deleting runtime files.

- [x] **Step 3: Handoff**

  Report exact video files, focused test counts, build/check results, no-deployment/no-generation status, and the remaining provider capability gate. Main thread selectively stages the video files; no shared files are staged by this thread.

### Task 4: Validate renderer delivery before candidate/timeline writes

**Files:**
- Modify: `server/videoShotRecovery.mjs`
- Modify: `server/videoWorkbenchStore.mjs`
- Test: `test/video-shot-recovery.test.mjs`
- Test: `test/video-workbench-store.test.mjs`

The renderer handoff is a read-only boundary. A completed delivery must carry a canonical video `projectAssetRef` and match the current owner/project recovery application before a later transaction may register a candidate or apply timeline actions. This task deliberately does not expose a client-writable completion route, call a provider, mutate billing, or persist the result.

- [x] **Step 1: Build a deterministic delivery receipt**

  Validate application integrity, project scope, canonical asset identity, video MIME, stable URL and content hash; return a receipt with the candidate/timeline actions and no-side-effect flags.

- [x] **Step 2: Add an owner-scoped store validator**

  Add `validateShotRecoveryDelivery({ ownerEmail, projectId, planId, delivery })` as a read-only store method that rehydrates the current plan and graph before building the receipt.

- [x] **Step 3: Verify without persistence or real generation**

  Cover successful validation, foreign-owner rejection, and unchanged candidate/timeline row counts. Focused recovery/store tests pass; provider registration and billing remain a later transaction boundary.

### Task 5: Revalidate a commit draft immediately before persistence

**Files:**
- Modify: `server/videoShotRecovery.mjs`
- Modify: `server/videoWorkbenchStore.mjs`
- Test: `test/video-shot-recovery.test.mjs`
- Test: `test/video-workbench-store.test.mjs`

The compiled commit is still a draft. Before a future transaction registers a candidate or applies timeline actions, the current owner-scoped plan must be reloaded and compared with the draft. This boundary is read-only and must reject stale shot revisions, changed selected candidates, missing active clips, project-asset lifecycle failures, and tampered commit hashes without calling providers, billing, or shared asset writers.

- [x] **Step 1: Add deterministic commit-draft integrity checks**

  Verify the commit hash, project scope, canonical video asset reference, candidate target, and every timeline action's expected shot/candidate revision.

- [x] **Step 2: Add an owner-scoped store preflight**

  Rehydrate the current recovery plan and workbench, compare the draft against current shot/candidate/clip state, and return a stable ready-to-apply preflight without persistence.

- [x] **Step 3: Cover stale and lifecycle rejection paths**

Add regressions for changed shot revision, changed selected candidate, missing clip, and non-reusable project asset. Assert candidate/timeline row counts and provider/billing evidence remain unchanged.

### Task 6: Apply a recovery commit atomically and idempotently

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Modify: `server/videoProvenance.mjs`
- Test: `test/video-workbench-store.test.mjs`

The video workbench now owns the write boundary after Task 5. `applyShotRecoveryCommit` repeats owner, plan, shot, candidate, timeline revision, and `purpose: 'reuse'` canonical-asset checks inside one SQLite transaction. It registers one candidate keyed by the delivered `outputAssetId`, selects it, updates the affected clips, and advances the shot revision together. The recovery commit hash is retained in candidate provenance so an identical retry returns `replayed: true` without duplicate rows; a conflicting reuse of the same output asset fails closed.

- [x] **Step 1: Add atomic/idempotent store regression**

  Cover first application, replay with unchanged candidate/timeline counts, and a stale retry after the shot changes.

- [x] **Step 2: Implement the video-only transaction boundary**

  Do not create canonical assets, submit providers, mutate billing, expose internal worker fields, or change shared project/Canvas/Works contracts.

- [x] **Step 3: Verify local gates**

  Run the video-focused suite, full `npm test`, `npm run check`, `npm run build`, `npm run collab:check`, and `git diff --check`; do not deploy or trigger real generation.

### Task 7: Apply a candidate to the timeline atomically and idempotently

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Test: `test/video-workbench-store.test.mjs`

Candidate application is the write boundary after a candidate has passed the existing reuse checks. The operation is owner/project scoped and performs candidate selection, stale-clip invalidation, timeline clip insert-or-replace, and shot revision advancement in one SQLite transaction. A repeated request replays the committed result without provider or billing side effects; stale revisions and occupied positions fail closed.

- [x] **Step 1: Add replacement, insertion, replay, owner and stale-revision regressions**
- [x] **Step 2: Implement the video-only transactional upsert**
- [x] **Step 3: Verify focused and repository-local gates without deployment or real generation**

### Task 8: Expose the atomic candidate-to-timeline boundary

**Files:**
- Modify: `server/videoWorkbenchRoutes.mjs`
- Modify: `src/services/videoWorkbench.js`
- Modify: `src/pages/VideoStudio/VideoProjectWorkbench.jsx`
- Test: `test/video-workbench-routes.test.mjs`
- Test: `test/video-workbench-client.test.mjs`
- Test: `test/video-project-workbench-ui.test.mjs`

- [x] **Step 1: Add an owner-scoped HTTP route with sanitized conflict responses**
- [x] **Step 2: Use the route from the workbench UI instead of separate select/add calls**
- [x] **Step 3: Verify first-apply and replay behavior without provider or billing mutation**
