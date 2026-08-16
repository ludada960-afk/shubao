# AI Video Project Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner- and project-scoped, auditable project-memory layer that stores bounded creative facts, only references approved workbench asset versions, appears in the video workbench, and is preserved in replay/clone manifests without invoking providers or billing.

**Architecture:** Store one soft-deletable fact per `(owner_email, project_id, fact_key)` in SQLite. The workbench store owns authorization, optimistic revisions, and approved-asset validation; routes expose read/upsert/delete operations; the client and gated workbench provide a small editable memory panel. Replay manifests receive a sanitized active-memory snapshot so clone/replay retains creative intent while excluding runtime identity and secrets.

**Tech Stack:** Node.js ESM, better-sqlite3, Express-style route handlers, React, existing video workbench store/routes/client, Node test runner.

## Global Constraints

- Every query and mutation must derive owner identity from the signed session and validate the video project; request-body owner fields are ignored.
- Memory values are bounded JSON and never trigger provider calls, generation jobs, usage-ledger writes, or billing mutations.
- Asset references must point to an asset version approved for the same owner/project; unapproved or cross-project references fail atomically.
- Updates use optimistic `revision`; stale writes return `VERSION_CONFLICT`; deletes are soft deletes for auditability.
- Replay snapshots include active facts only, whitelist fields, exclude playback URLs/runtime IDs/secrets, and remain backward compatible when memory is absent.
- Do not modify Home, productionCase, gallery publisher, or ecommerce showcase generation files.

---

### Task 1: Define the memory contract and failing unit tests

**Files:**
- Create: `server/videoProjectMemory.mjs`
- Create: `test/video-project-memory.test.mjs`

**Interfaces:**
- Produces `normalizeProjectMemoryFact(input)`, `normalizeProjectMemoryList(input)`, and `memoryFactSnapshot(fact)`.
- Normalized fact shape: `{ id, key, value, source, assetRefs, status, revision, createdAt, updatedAt, deletedAt }`.

- [x] **Step 1: Write the failing tests**

```js
test('normalizes bounded facts and strips runtime fields', () => {
  const fact = normalizeProjectMemoryFact({
    id: 'fact-1', key: 'heroMood', value: { tone: 'warm' }, source: 'user',
    assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }],
    status: 'active', revision: 2, createdAt: '2026-08-16T00:00:00Z', updatedAt: '2026-08-16T00:00:00Z',
    ownerEmail: 'secret@example.com', playbackUrl: 'https://signed.test/secret',
  });
  assert.deepEqual(memoryFactSnapshot(fact), {
    key: 'heroMood', value: { tone: 'warm' }, source: 'user',
    assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }], revision: 2,
  });
});

test('rejects oversized, invalid, and duplicate facts', () => {
  assert.throws(() => normalizeProjectMemoryFact({ key: 'x', value: 'a'.repeat(8193) }), /too large/);
  assert.throws(() => normalizeProjectMemoryFact({ key: 'x', value: {}, source: 'provider' }), /source/);
  assert.throws(() => normalizeProjectMemoryList([{ key: 'x', value: 1 }, { key: 'x', value: 2 }]), /duplicate/);
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test --test-concurrency=1 test/video-project-memory.test.mjs`

Expected: FAIL because the memory normalizer module does not exist.

- [x] **Step 3: Implement the bounded normalizer**

Implement `server/videoProjectMemory.mjs` with max 64 facts, max 128-character keys, max 8 KiB serialized value per fact, max 16 asset references, allowed sources `user`, `approved_asset`, `skill`, statuses `active`/`deleted`, depth-limited JSON validation, duplicate-key detection, sorted snapshot output, and `MEMORY_INVALID` errors.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node --test --test-concurrency=1 test/video-project-memory.test.mjs`

Expected: PASS.

- [x] **Step 5: Commit the contract**

Run: `git add server/videoProjectMemory.mjs test/video-project-memory.test.mjs && git commit -m "feat: define bounded project memory contract"`

### Task 2: Persist owner-scoped memory facts in the workbench store

**Files:**
- Modify: `server/videoWorkbenchStore.mjs:200-300` (schema), `server/videoWorkbenchStore.mjs:300-980` (store methods)
- Modify: `test/video-workbench-store.test.mjs`

**Interfaces:**
- Produces `listProjectMemory({ ownerEmail, projectId })`.
- Produces `setProjectMemoryFact({ ownerEmail, projectId, key, value, source, assetRefs, expectedRevision })`.
- Produces `removeProjectMemoryFact({ ownerEmail, projectId, key, expectedRevision })`.

- [x] **Step 1: Add failing store tests**

Cover: empty list; insert/update increments revision; stale update throws `VERSION_CONFLICT`; soft delete removes the fact from active list; approved version refs succeed; unapproved and other-owner refs throw coded errors; other owner cannot read or mutate.

- [x] **Step 2: Run store tests to verify failure**

Run: `node --test --test-concurrency=1 test/video-workbench-store.test.mjs`

Expected: FAIL with missing store methods/table.

- [x] **Step 3: Add the SQLite table and conversion helper**

Create `video_project_memory_facts` with unique `(owner_email, project_id, fact_key)`, JSON columns, revision/status timestamps, soft-delete timestamp, foreign key to `projects`, and owner/project/status index. Parse rows through the normalizer so malformed stored data cannot escape the store API.

- [x] **Step 4: Implement transactional CRUD with approved-version validation**

Require `projectStore.requireProject`/existing project guard, validate all asset refs against the same owner/project and `approved_version_id`, enforce expected revision, update `revision + 1`, and preserve deleted rows. Return normalized API facts.

- [x] **Step 5: Expose `memory` from `listWorkbench`**

Return `memory: listProjectMemory(...)` alongside project/assets/shots/timeline so one workbench read hydrates the panel without a second request.

- [x] **Step 6: Run store tests to verify success**

Run: `node --test --test-concurrency=1 test/video-project-memory.test.mjs test/video-workbench-store.test.mjs`

Expected: PASS with all existing store tests unchanged.

- [x] **Step 7: Commit persistence**

Run: `git add server/videoWorkbenchStore.mjs test/video-workbench-store.test.mjs && git commit -m "feat: persist owner-scoped project memory"`

### Task 3: Add authenticated memory routes and client helpers

**Files:**
- Modify: `server/videoWorkbenchRoutes.mjs:1-220` (error mapping and routes)
- Modify: `src/services/videoWorkbench.js:1-220`
- Modify: `test/video-workbench-routes.test.mjs`
- Modify: `test/video-workbench-client.test.mjs`

**Interfaces:**
- `GET /api/video/projects/:projectId/workbench/memory` returns `{ memory }`.
- `PUT /api/video/projects/:projectId/workbench/memory/:factKey` accepts `{ value, source, assetRefs, expectedRevision }` and returns `{ fact }`.
- `DELETE /api/video/projects/:projectId/workbench/memory/:factKey` accepts `{ expectedRevision }` and returns `{ fact }`.
- Client exports `getVideoProjectMemory`, `upsertVideoProjectMemoryFact`, `removeVideoProjectMemoryFact`.

- [x] **Step 1: Add failing route/client tests**

Assert signed-owner derivation, route registration, encoded fact keys, 201 for first upsert/200 for update, 409 stale revision, 404 cross-owner project, and that client validates `{ memory: [] }`/`{ fact: {} }` response shapes.

- [x] **Step 2: Run route/client tests to verify failure**

Run: `node --test --test-concurrency=1 test/video-workbench-routes.test.mjs test/video-workbench-client.test.mjs`

Expected: FAIL because routes and client functions are absent.

- [x] **Step 3: Implement route dispatch and error mapping**

Add DELETE support to the fake/real app contract only where already available, use existing `dispatch`/`handle`, record `memory.read`, `memory.upsert`, `memory.delete`, map memory not-found to 404, revision/asset-reference conflicts to 409, and invalid payloads to 400.

- [x] **Step 4: Implement client path/body helpers**

Add a `memoryFactSegment` using existing `pathSegment`, preserve signed headers, use JSON request bodies, and validate response arrays/objects before returning.

- [x] **Step 5: Run route/client tests to verify success**

Run: `node --test --test-concurrency=1 test/video-workbench-routes.test.mjs test/video-workbench-client.test.mjs`

Expected: PASS.

- [x] **Step 6: Commit API surface**

Run: `git add server/videoWorkbenchRoutes.mjs src/services/videoWorkbench.js test/video-workbench-routes.test.mjs test/video-workbench-client.test.mjs && git commit -m "feat: expose project memory API"`

### Task 4: Preserve memory in replay and clone manifests

**Files:**
- Modify: `server/videoReplayManifest.mjs:1-220`
- Modify: `server/videoWorkbenchStore.mjs:600-660`
- Modify: `test/video-replay-manifest.test.mjs`
- Modify: `test/video-workbench-store.test.mjs`

**Interfaces:**
- `buildReplayManifest({ workbench, memory, ... })` includes sanitized `memory` only when active facts exist.
- `createReplayManifest` obtains active memory from the same owner/project store call.
- Clone `planSnapshot.memory` preserves the snapshot for the new draft project.

- [x] **Step 1: Add failing replay/clone tests**

Verify active facts survive with key/value/source/assetRefs/revision, deleted/runtime fields do not; manifests without memory remain valid; clone plan snapshot carries memory without owner/email/playback URL.

- [x] **Step 2: Run replay tests to verify failure**

Run: `node --test --test-concurrency=1 test/video-replay-manifest.test.mjs test/video-workbench-store.test.mjs`

Expected: FAIL because `buildReplayManifest` and clone snapshot do not accept memory.

- [x] **Step 3: Implement sanitized memory snapshot and store wiring**

Use `memoryFactSnapshot` and bounded list normalization; pass `listProjectMemory` from `createReplayManifest`; conditionally copy memory during clone.

- [x] **Step 4: Run replay/clone tests to verify success**

Run: `node --test --test-concurrency=1 test/video-replay-manifest.test.mjs test/video-workbench-store.test.mjs`

Expected: PASS.

- [x] **Step 5: Commit replay compatibility**

Run: `git add server/videoReplayManifest.mjs server/videoWorkbenchStore.mjs test/video-replay-manifest.test.mjs test/video-workbench-store.test.mjs && git commit -m "feat: include project memory in video replay"`

### Task 5: Add a small gated workbench memory panel

**Files:**
- Modify: `src/pages/VideoStudio/VideoProjectWorkbench.jsx:1-500`
- Modify: `src/pages/VideoStudio/VideoProjectWorkbench.css`
- Modify: `test/video-project-workbench-ui.test.js`

**Interfaces:**
- Consumes `workbench.memory` and the three client helpers.
- Produces an editable “项目记忆” section with key/value/source, revision-aware save, soft delete, loading, and error states.

- [x] **Step 1: Add failing UI assertions**

Assert the memory heading renders from a workbench payload, save calls the PUT helper with the current revision, delete calls DELETE, and stale errors use the existing refresh/error language.

- [x] **Step 2: Run UI tests to verify failure**

Run: `node --test --test-concurrency=1 test/video-project-workbench-ui.test.js`

Expected: FAIL because the memory panel and handlers are absent.

- [x] **Step 3: Implement minimal panel**

Render active facts as compact rows with editable JSON text, source badge, revision, save/delete icon buttons, and one “新增事实” row. Use existing lucide icons and CSS tokens; never expose internal Skill terminology or provider controls.

- [x] **Step 4: Run UI tests and build**

Run: `node --test --test-concurrency=1 test/video-project-workbench-ui.test.js && npm run check && npm run build`

Expected: PASS and a successful production build.

- [x] **Step 5: Commit the gated UI**

Run: `git add src/pages/VideoStudio/VideoProjectWorkbench.jsx src/pages/VideoStudio/VideoProjectWorkbench.css test/video-project-workbench-ui.test.js && git commit -m "feat: add project memory panel to video workbench"`

### Task 6: Full verification, documentation, and release gate

**Files:**
- Modify: `RTK.md`
- Modify: `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md` (status/evidence note only)

- [x] **Step 1: Run focused verification**

Run: `node --test --test-concurrency=1 test/video-project-memory.test.mjs test/video-workbench-store.test.mjs test/video-workbench-routes.test.mjs test/video-workbench-client.test.mjs test/video-replay-manifest.test.mjs test/video-project-workbench-ui.test.js`

Expected: all focused tests pass.

- [x] **Step 2: Run repository gates**

Run: `npm test && npm run check && npm run build && git diff --check`

Expected: all tests/check/build commands exit 0; runtime staging directories remain untracked.

- [x] **Step 3: Update recovery evidence**

Record table/schema, API contract, replay behavior, test counts, no-provider/no-billing guarantee, local commit, deployment status, and any SSH/deployment blocker in `RTK.md`; leave roadmap exit criteria unchecked unless production evidence exists.

- [x] **Step 4: Commit documentation**

Run: `git add RTK.md docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md docs/superpowers/plans/2026-08-16-ai-video-p2-project-memory.md && git commit -m "docs: record project memory release evidence"`

- [ ] **Step 5: Release only through the approved gate**

Run: `pwsh -File scripts/deploy-production.ps1 -ReleaseRef HEAD -SkipTests` only after the SSH key is available and the release window is explicitly open. Then run the production video verifier and a bounded canary. If SSH access is still unavailable, report the exact blocker and do not claim deployment.

## Self-review checklist

- [x] Every user/project boundary is enforced by the existing authenticated owner guard.
- [x] Values, arrays, nesting, keys, and asset references have explicit bounded tests.
- [x] Soft deletes remain auditable but never appear in active UI/replay snapshots.
- [x] Stale revisions cannot overwrite newer facts.
- [x] Replay/clone remains backward compatible when no memory exists.
- [x] No provider, generation, usage ledger, or billing path is touched.
- [x] UI is gated and reuses existing workbench visual language.
