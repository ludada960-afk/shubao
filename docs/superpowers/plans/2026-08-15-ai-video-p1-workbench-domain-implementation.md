# AI Video P1 Workbench Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default-off, owner-scoped persistence and HTTP contract for video workbench assets, shots, candidates and a minimal timeline without changing current generation, billing or UI behavior.

**Architecture:** Add one focused SQLite-backed store and one route module linked to the existing project store. Asset versions are immutable, shot bindings pin explicit versions, candidate selection is transactional, and timeline clips can reference only the current selected candidate. The entire surface is mounted only when `VIDEO_PLATFORM_P1_WORKBENCH` is true; the flag defaults off while current P0 flags preserve their existing defaults.

**Tech Stack:** Node.js ESM, Express-compatible route handlers, better-sqlite3, existing project schema/store, Node test runner.

## Global Constraints

- Do not modify Home, `productionCase*`, gallery publisher, or `generate-production-ecommerce-showcase` files.
- Do not deploy or enable the P1 flag during the shared production release window.
- Do not call video/image providers or charge points in any P1 test.
- All schema changes are additive; rollback is flag-off, not destructive SQL.
- The authenticated session owner is authoritative; ignore or reject owner fields in request bodies.
- Public P1 exposure remains blocked until the P0 production observation gate passes.
- Follow TDD for every behavior: write a focused test, run it and observe the expected failure, implement the minimum, rerun focused and related tests, then commit.

---

## File Map

- Modify `server/config.mjs`: add a default-off P1 flag without changing P0 flag defaults.
- Create `server/videoWorkbenchStore.mjs`: schema, validation, owner/project guards and transactional domain operations.
- Create `server/videoWorkbenchRoutes.mjs`: authenticated HTTP mapping only; no business logic.
- Modify `server/index.mjs`: call the tested mount contract; it constructs no P1 dependency and mounts no route unless enabled.
- Create `test/video-workbench-store.test.mjs`: real in-memory SQLite domain tests.
- Create `test/video-workbench-routes.test.mjs`: feature-mount and ownership/error contract tests.
- Modify `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`: link implementation evidence after local verification.
- Modify `RTK.md`: record local-only status and the remaining production gate.

### Task 1: Add a default-off P1 feature gate

**Files:**
- Modify: `server/config.mjs`
- Modify: `test/video-platform-cutover.test.mjs`

**Interfaces:**
- Consumes: `readVideoPlatformFlags(env)` and `VIDEO_PLATFORM_FLAG_NAMES`.
- Produces: `VIDEO_PLATFORM_P1_WORKBENCH` in the returned flag object, defaulting to `false` only for this new flag.

- [ ] **Step 1: Write the failing flag-default test**

Replace the first cutover test assertions with explicit defaults and extend the rollback input:

```js
test('video platform flags preserve P0 defaults while P1 workbench defaults off', () => {
  const defaults = readVideoPlatformFlags({});
  assert.deepEqual(Object.keys(defaults).sort(), [...VIDEO_PLATFORM_FLAG_NAMES].sort());
  assert.equal(defaults.VIDEO_PLATFORM_P1_WORKBENCH, false);
  assert.ok(Object.entries(defaults)
    .filter(([name]) => name !== 'VIDEO_PLATFORM_P1_WORKBENCH')
    .every(([, enabled]) => enabled));

  const enabled = readVideoPlatformFlags({ VIDEO_PLATFORM_P1_WORKBENCH: 'true' });
  assert.equal(enabled.VIDEO_PLATFORM_P1_WORKBENCH, true);
  assert.throws(
    () => readVideoPlatformFlags({ VIDEO_PLATFORM_P1_WORKBENCH: 'sometimes' }),
    /VIDEO_PLATFORM_P1_WORKBENCH/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="P1 workbench defaults off" test/video-platform-cutover.test.mjs`

Expected: FAIL because `VIDEO_PLATFORM_P1_WORKBENCH` is absent.

- [ ] **Step 3: Implement explicit per-flag defaults**

Add the flag and default map, then pass the default into the parser:

```js
export const VIDEO_PLATFORM_FLAG_NAMES = Object.freeze([
  'VIDEO_PLATFORM_OWNER_READS',
  'VIDEO_PLATFORM_ATTEMPTS',
  'VIDEO_PLATFORM_OUTBOX',
  'VIDEO_PLATFORM_PROJECT_BRIDGE',
  'VIDEO_PLATFORM_TUS_UPLOAD',
  'VIDEO_PLATFORM_READ_NEW_STATE',
  'VIDEO_PLATFORM_P1_WORKBENCH',
]);

const VIDEO_PLATFORM_FLAG_DEFAULTS = Object.freeze({
  VIDEO_PLATFORM_P1_WORKBENCH: false,
});

function readBooleanFlag(name, value, fallback = true) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  // existing normalization remains unchanged
}

export function readVideoPlatformFlags(env = process.env) {
  return Object.fromEntries(VIDEO_PLATFORM_FLAG_NAMES.map(name => [
    name,
    readBooleanFlag(name, env[name], VIDEO_PLATFORM_FLAG_DEFAULTS[name] ?? true),
  ]));
}
```

- [ ] **Step 4: Run focused and related tests**

Run:

```powershell
node --test test/video-platform-cutover.test.mjs test/runtime-config-verifier.test.mjs test/runtime-config-updater.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/config.mjs test/video-platform-cutover.test.mjs
git commit -m "feat: gate video workbench domain"
```

### Task 2: Persist semantic assets and immutable versions

**Files:**
- Create: `server/videoWorkbenchStore.mjs`
- Create: `test/video-workbench-store.test.mjs`

**Interfaces:**
- Consumes: better-sqlite3 `db`, existing `projectStore.getProject({ ownerEmail, projectId })`.
- Produces: `createVideoWorkbenchStore({ db, projectStore, now, randomUUID })` with `createAsset`, `addAssetVersion`, `approveAssetVersion` and `listWorkbench`.

- [ ] **Step 1: Write failing asset/version tests**

Create the harness and three focused tests:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createVideoWorkbenchStore } from '../server/videoWorkbenchStore.mjs';

function harness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  let sequence = 0;
  const now = () => new Date('2026-08-15T08:00:00.000Z');
  const projectStore = createProjectStore(db, { now, randomUUID: () => `p-${++sequence}` });
  const store = createVideoWorkbenchStore({ db, projectStore, now, randomUUID: () => `w-${++sequence}` });
  const project = projectStore.createProject({ ownerEmail: 'owner@example.com', kind: 'video', title: '广告短片' });
  return { db, store, project };
}

test('workbench assets require an owned video project', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  assert.throws(() => store.createAsset({
    ownerEmail: 'other@example.com', projectId: project.id, kind: 'product', name: '耳机',
  }), error => error.code === 'PROJECT_NOT_FOUND');
});

test('asset versions are immutable ordered records', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail: 'owner@example.com', projectId: project.id, kind: 'product', name: '耳机' });
  const first = store.addAssetVersion({ ownerEmail: 'owner@example.com', projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/a', contentHash: 'hash-a', mimeType: 'image/png', metadata: { angle: 'front' } });
  const second = store.addAssetVersion({ ownerEmail: 'owner@example.com', projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/b', contentHash: 'hash-b', mimeType: 'image/png', metadata: { angle: 'three-quarter' } });
  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.deepEqual(first.metadata, { angle: 'front' });
});

test('approving an asset version uses optimistic revision control', t => {
  const { db, store, project } = harness();
  t.after(() => db.close());
  const asset = store.createAsset({ ownerEmail: 'owner@example.com', projectId: project.id, kind: 'person', name: '主角' });
  const version = store.addAssetVersion({ ownerEmail: 'owner@example.com', projectId: project.id, assetId: asset.id,
    stableUrl: '/api/video/assets/person', contentHash: 'person-hash', mimeType: 'image/png' });
  const approved = store.approveAssetVersion({ ownerEmail: 'owner@example.com', projectId: project.id,
    assetId: asset.id, versionId: version.id, expectedRevision: 1 });
  assert.equal(approved.revision, 2);
  assert.equal(approved.approvedVersionId, version.id);
  assert.throws(() => store.approveAssetVersion({ ownerEmail: 'owner@example.com', projectId: project.id,
    assetId: asset.id, versionId: version.id, expectedRevision: 1 }), error => error.code === 'VERSION_CONFLICT');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/video-workbench-store.test.mjs`

Expected: FAIL with module-not-found for `videoWorkbenchStore.mjs`.

- [ ] **Step 3: Implement the schema and asset operations**

Create `server/videoWorkbenchStore.mjs` with:

```js
const ASSET_KINDS = new Set(['product', 'person', 'wardrobe', 'scene', 'prop', 'style', 'voice', 'music']);

function coded(code, message = code, current = null) {
  return Object.assign(new Error(message), { code, current });
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_workbench_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      kind TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      approved_version_id TEXT, revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_video_workbench_assets_project
      ON video_workbench_assets(owner_email, project_id, created_at);
    CREATE TABLE IF NOT EXISTS video_workbench_asset_versions (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      sequence INTEGER NOT NULL, source_project_asset_id TEXT, stable_url TEXT NOT NULL,
      content_hash TEXT NOT NULL, mime_type TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL, UNIQUE(asset_id, sequence),
      FOREIGN KEY(asset_id) REFERENCES video_workbench_assets(id),
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );
  `);
}
```

Implement row mappers plus the four produced methods. `approveAssetVersion` must run in `db.transaction`, verify owner/project/asset/version, compare `expectedRevision`, update the approved version and return the mapped current asset.

- [ ] **Step 4: Run focused tests and refactor only after green**

Run: `node --test test/video-workbench-store.test.mjs`

Expected: 3 tests PASS. Then extract repeated owner/project lookup into `requireVideoProject` without changing behavior and rerun.

- [ ] **Step 5: Commit**

```powershell
git add server/videoWorkbenchStore.mjs test/video-workbench-store.test.mjs
git commit -m "feat: persist video workbench assets"
```

### Task 3: Add ordered shots, pinned bindings and stale dependency state

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Modify: `test/video-workbench-store.test.mjs`

**Interfaces:**
- Produces: `createShot`, `updateShot`, `bindShotAssetVersion`.
- Extends: `approveAssetVersion` to mark shots stale when they remain bound to an older version.

- [ ] **Step 1: Write failing shot and stale-binding tests**

Append tests that create a product asset with two versions, bind the first version to a shot, approve the second version, and assert:

```js
assert.equal(store.listWorkbench({ ownerEmail, projectId }).shots[0].status, 'stale');
assert.equal(store.listWorkbench({ ownerEmail, projectId }).shots[0].bindings[0].assetVersionId, first.id);
```

Add separate assertions that duplicate shot positions throw `INVALID_POSITION`, `durationMs: 499` throws `INVALID_DURATION`, an owner-mismatched binding throws `INVALID_BINDING`, and an old `expectedRevision` throws `VERSION_CONFLICT`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="shot|binding|stale" test/video-workbench-store.test.mjs`

Expected: FAIL because shot methods/tables are missing.

- [ ] **Step 3: Implement shot and binding tables**

Extend schema:

```sql
CREATE TABLE IF NOT EXISTS video_storyboard_shots (
  id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
  position INTEGER NOT NULL, purpose TEXT NOT NULL, duration_ms INTEGER NOT NULL,
  camera_language TEXT NOT NULL DEFAULT '', prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', selected_candidate_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(project_id, position), FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE TABLE IF NOT EXISTS video_shot_asset_bindings (
  shot_id TEXT NOT NULL, asset_id TEXT NOT NULL, asset_version_id TEXT NOT NULL,
  owner_email TEXT NOT NULL, project_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(shot_id, role, asset_id),
  FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id),
  FOREIGN KEY(asset_id) REFERENCES video_workbench_assets(id),
  FOREIGN KEY(asset_version_id) REFERENCES video_workbench_asset_versions(id)
);
```

Implement the three methods with real owner/project/version validation. In the existing approval transaction run:

```sql
UPDATE video_storyboard_shots
SET status = 'stale', revision = revision + 1, updated_at = ?
WHERE owner_email = ? AND project_id = ? AND id IN (
  SELECT shot_id FROM video_shot_asset_bindings
  WHERE owner_email = ? AND project_id = ? AND asset_id = ? AND asset_version_id <> ?
)
```

- [ ] **Step 4: Run focused and project regression tests**

Run:

```powershell
node --test test/video-workbench-store.test.mjs test/project-version-store.test.mjs test/video-project-bridge.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/videoWorkbenchStore.mjs test/video-workbench-store.test.mjs
git commit -m "feat: model video storyboard dependencies"
```

### Task 4: Add candidates, explicit selection and minimal timeline

**Files:**
- Modify: `server/videoWorkbenchStore.mjs`
- Modify: `test/video-workbench-store.test.mjs`

**Interfaces:**
- Produces: `registerCandidate`, `selectCandidate`, `addTimelineClip`.
- Extends: `listWorkbench` projection with candidates and timeline clips.

- [ ] **Step 1: Write failing candidate/timeline tests**

Cover these behaviors with separate tests:

```js
const replay = store.registerCandidate(candidateInput);
assert.equal(replay.id, first.id); // idempotent on shot/output asset

const selected = store.selectCandidate({ ownerEmail, projectId, shotId, candidateId: second.id, expectedRevision: 1 });
assert.equal(selected.shot.selectedCandidateId, second.id);
assert.equal(selected.candidate.status, 'selected');

assert.throws(() => store.addTimelineClip({
  ownerEmail, projectId, shotId, candidateId: first.id, position: 0,
  trimStartMs: 0, trimEndMs: 3000, muted: false,
}), error => error.code === 'INVALID_TIMELINE_CANDIDATE');
```

Also prove that changing the shot selection does not rewrite an existing timeline clip and causes the old clip to be returned with `valid: false` in `listWorkbench`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test --test-name-pattern="candidate|timeline" test/video-workbench-store.test.mjs`

Expected: FAIL because candidate/timeline methods are missing.

- [ ] **Step 3: Implement candidate and timeline tables/transactions**

Add:

```sql
CREATE TABLE IF NOT EXISTS video_shot_candidates (
  id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL, shot_id TEXT NOT NULL,
  generation_job_id TEXT, output_asset_id TEXT NOT NULL, stable_url TEXT NOT NULL,
  content_hash TEXT NOT NULL, mime_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available',
  created_at TEXT NOT NULL, UNIQUE(shot_id, output_asset_id),
  FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id)
);
CREATE TABLE IF NOT EXISTS video_timeline_clips (
  id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
  shot_id TEXT NOT NULL, candidate_id TEXT NOT NULL, position INTEGER NOT NULL,
  trim_start_ms INTEGER NOT NULL DEFAULT 0, trim_end_ms INTEGER NOT NULL,
  muted INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, position),
  FOREIGN KEY(shot_id) REFERENCES video_storyboard_shots(id),
  FOREIGN KEY(candidate_id) REFERENCES video_shot_candidates(id)
);
```

`selectCandidate` must transact the revision check, previous candidate normalization, chosen candidate selection and shot update. `listWorkbench` computes `clip.valid` by comparing `clip.candidate_id` with the joined shot `selected_candidate_id`; it never mutates clips on read.

- [ ] **Step 4: Run focused tests and full workbench suite**

Run: `node --test test/video-workbench-store.test.mjs`

Expected: all store tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/videoWorkbenchStore.mjs test/video-workbench-store.test.mjs
git commit -m "feat: select video candidates for timeline"
```

### Task 5: Mount authenticated routes only when enabled

**Files:**
- Create: `server/videoWorkbenchRoutes.mjs`
- Create: `test/video-workbench-routes.test.mjs`
- Modify: `server/index.mjs`

**Interfaces:**
- Consumes: `videoWorkbenchStore`, `authenticateOwner`.
- Produces: `mountVideoWorkbenchRoutes(app, { enabled, store, authenticateOwner })`.

- [ ] **Step 1: Write failing route tests**

Use the existing fake-app/response style. Prove:

```js
assert.equal(mountVideoWorkbenchRoutes(disabledApp, {
  enabled: false,
  store: null,
  authenticateOwner: null,
}), false);
assert.equal(disabledApp.routes.has('GET /api/video/projects/:projectId/workbench'), false);

assert.equal(mountVideoWorkbenchRoutes(enabledApp, {
  enabled: true,
  store,
  authenticateOwner,
}), true);
const created = await invoke(enabledApp, 'POST', '/api/video/projects/:projectId/workbench/assets', {
  headers: signedHeaders(sessionTokens, 'owner@example.com'),
  params: { projectId },
  body: { ownerEmail: 'attacker@example.com', kind: 'product', name: '耳机' },
});
assert.equal(created.statusCode, 201);
assert.equal(created.body.asset.ownerEmail, 'owner@example.com');
```

Also test 404 for another owner, 409 for `VERSION_CONFLICT`, and 400 for `INVALID_DURATION` without raw SQL text.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/video-workbench-routes.test.mjs`

Expected: FAIL because the route module does not exist.

- [ ] **Step 3: Implement the route module**

Make the feature gate part of the mount contract so the default-off behavior is
covered without starting the full server. Check `enabled` before validating or
constructing any P1 dependency:

```js
export function mountVideoWorkbenchRoutes(app, {
  enabled = false,
  store,
  authenticateOwner,
} = {}) {
  if (!enabled) return false;
  if (!store || typeof authenticateOwner !== 'function') {
    throw new TypeError('enabled video workbench routes require store and authenticateOwner');
  }

  // Mount the nine routes below.
  return true;
}
```

Create a small mapper and handlers:

```js
function ownerFor(req, authenticateOwner) {
  const result = authenticateOwner(req);
  return typeof result === 'string' ? result : result?.email;
}

function routeError(error, res) {
  if (error?.code === 'VERSION_CONFLICT') return res.status(409).json({ code: error.code, error: '内容已更新，请刷新后重试' });
  if (String(error?.code || '').endsWith('_NOT_FOUND') || error?.code === 'PROJECT_NOT_FOUND') {
    return res.status(404).json({ code: error.code || 'PROJECT_NOT_FOUND', error: '未找到该视频项目内容' });
  }
  return res.status(400).json({ code: error?.code || 'VIDEO_WORKBENCH_REQUEST_FAILED', error: '视频项目参数无效' });
}
```

Mount the nine routes from the design. Each passes `ownerFor(req, authenticateOwner)` and `req.params.projectId`; no handler forwards a body owner field.

- [ ] **Step 4: Construct conditionally in `server/index.mjs`**

Import the store and routes. After flags and project store initialization:

```js
const videoWorkbenchEnabled = videoPlatformFlags.VIDEO_PLATFORM_P1_WORKBENCH;
const videoWorkbenchStore = videoWorkbenchEnabled
  ? createVideoWorkbenchStore({ db, projectStore })
  : null;
```

After project routes, call the tested mount contract once. A disabled call must
not dereference the null store or authentication callback:

```js
mountVideoWorkbenchRoutes(app, {
  enabled: videoWorkbenchEnabled,
  store: videoWorkbenchStore,
  authenticateOwner: videoWorkbenchEnabled
    ? (req) => authenticateContentRequest(req, {
        sessionTokens: contentSessionTokens,
        authorizeEmail: authorizeAccountEmail,
      })
    : null,
});
```

- [ ] **Step 5: Run route and integration regression tests**

Run:

```powershell
node --test test/video-workbench-routes.test.mjs test/project-routes.test.mjs test/video-platform-cutover.test.mjs test/api-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/videoWorkbenchRoutes.mjs server/index.mjs test/video-workbench-routes.test.mjs
git commit -m "feat: expose gated video workbench contracts"
```

### Task 6: Verify the local slice and record truthful status

**Files:**
- Modify: `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`
- Modify: `RTK.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: local evidence only; no production-complete statement.

- [ ] **Step 1: Run focused P1 and P0 tests**

Run:

```powershell
node --test test/video-workbench-store.test.mjs test/video-workbench-routes.test.mjs test/video-platform-cutover.test.mjs test/video-generation-reliability.test.mjs test/video-project-bridge.test.mjs test/video-upload.test.mjs
```

Expected: PASS with zero provider submissions.

- [ ] **Step 2: Run full local gates**

Run:

```powershell
npm test
npm run build
npm run check
git diff --check
```

Expected: all commands PASS. Record exact test count and build module count from actual output; do not copy old counts.

- [ ] **Step 3: Confirm the default route is absent**

Start the server with no P1 flag and run a local no-auth request against `/api/video/projects/example/workbench`.

Expected: Express 404 because the route is not mounted. Do not use a paid endpoint.

- [ ] **Step 4: Update documentation**

Change the roadmap P1 row to “local domain contract complete; public release blocked” only if every gate above passes. Add an `RTK.md` checkpoint with commit, flags, test evidence, browser-QA status, deployment status and rollback boundary.

- [ ] **Step 5: Commit verification evidence**

```powershell
git add docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md RTK.md
git commit -m "docs: record video workbench verification"
```

## Plan Self-Review

- Spec coverage: every in-scope design method and invariant has a task and test; UI, billing, provider submission and export remain excluded.
- Completeness scan: no deferred markers or unspecified error handling remains.
- Type consistency: `projectId`, `assetId`, `assetVersionId`, `shotId`, `candidateId`, `expectedRevision` and method names match the design spec.
- Isolation: every task is independently reviewable and ends in a focused commit.
- Safety: the new flag defaults off, schema is additive, no paid call exists, and no production deployment is included.
