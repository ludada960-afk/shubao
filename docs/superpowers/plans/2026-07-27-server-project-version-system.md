# Server Project Version System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace account-level browser restoration with server-owned projects and immutable versions, then connect authoritative sessions, recoverable generation, shot-aware ecommerce output, editable typography, honest layering, and one Canvas command system.

**Architecture:** SQLite remains the durable source of truth. New focused stores own projects, versions, recovery checkpoints, Canvas sessions, composition documents, and asset references; existing billing and generation jobs remain execution engines and are linked by IDs. The frontend starts every fresh visit with an empty in-memory editor and only restores an unfinished version after an explicit user action.

**Tech Stack:** Node.js ESM, Express 4, better-sqlite3, React 18, Sharp, SVG text composition, ag-psd, Node test runner, Vite.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Use the approved Git prefix from `RTK.md`; stage explicit files only.
- Runtime SQLite databases, generated assets, uploads, caches, secrets and `dist/` never enter Git.
- Every service resource is owner-scoped from the signed session, never from a request-body email.
- New visits are blank; historical and unfinished work only opens through an explicit user action.
- Existing billing holds, usage events, job leases and stable generated assets remain authoritative.
- UI copy must be market-facing and must not expose beta access, internal accounts, provider endpoints or model routing.
- Paid actions show server catalog prices; deterministic text and layout edits remain free.
- PSD controls remain disabled until a real multilayer document passes structural validation.
- Each task follows red-green-refactor, focused regression, explicit staging, review and commit.

---

### Task 1: Project, Version, Recovery, Canvas Session And Composition Stores

**Files:**
- Create: `server/projects/schema.mjs`
- Create: `server/projects/projectStore.mjs`
- Create: `server/projects/compositionStore.mjs`
- Modify: `server/db.mjs`
- Test: `test/project-version-store.test.mjs`
- Test: `test/composition-store.test.mjs`

**Interfaces:**
- Produces: `ensureProjectSchema(db)`, `createProjectStore(db, options)`, `createCompositionStore(db, options)`.
- Project store methods: `createProject`, `createVersion`, `getProject`, `listProjects`, `createCheckpoint`, `listCheckpoints`, `consumeCheckpoint`, `dismissCheckpoint`, `createCanvasSession`, `saveCanvasSession`, `getCanvasSession`, `discardCanvasSession`, `linkGenerationRun`, `completeProject`.
- Composition store methods: `createDocument`, `getDocument`, `saveRevision`, `listRevisions`, `linkRenderedAsset`.

- [x] **Step 1: Write failing schema and store tests**

```js
test('creates immutable owner-scoped project versions and explicit recovery checkpoints', () => {
  const store = createProjectStore(db, { randomUUID: ids('p', 'v', 'c') });
  const project = store.createProject({ ownerEmail: 'owner@example.com', kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail: 'owner@example.com', projectId: project.id, reason: 'generation', inputSnapshot: { prompt: '杯子' } });
  assert.throws(() => store.createVersion({ ownerEmail: 'other@example.com', projectId: project.id, reason: 'manual_save' }), /not found/i);
  const checkpoint = store.createCheckpoint({ ownerEmail: 'owner@example.com', projectId: project.id, versionId: version.id, reason: 'payment_required' });
  assert.equal(store.listCheckpoints({ ownerEmail: 'owner@example.com' })[0].id, checkpoint.id);
  assert.deepEqual(store.listCheckpoints({ ownerEmail: 'other@example.com' }), []);
});

test('composition revisions are immutable and reject stale optimistic revisions', () => {
  const document = compositions.createDocument({ ownerEmail, projectId, versionId, width: 1200, height: 1500, layers: [] });
  const next = compositions.saveRevision({ ownerEmail, documentId: document.id, expectedRevision: 1, layers: [{ id: 'title', kind: 'text' }] });
  assert.equal(next.revision, 2);
  assert.throws(() => compositions.saveRevision({ ownerEmail, documentId: document.id, expectedRevision: 1, layers: [] }), error => error.code === 'VERSION_CONFLICT');
});
```

- [x] **Step 2: Run tests and confirm missing modules fail**

Run: `node --test --test-concurrency=1 test/project-version-store.test.mjs test/composition-store.test.mjs`

Expected: FAIL with module-not-found errors.

- [x] **Step 3: Implement idempotent schema and transactional stores**

```js
export function ensureProjectSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
      head_version_id TEXT, accepted_version_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      completed_at TEXT, deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_version_id TEXT,
      reason TEXT NOT NULL, sequence INTEGER NOT NULL,
      input_snapshot TEXT NOT NULL, plan_snapshot TEXT NOT NULL,
      canvas_snapshot_id TEXT, created_at TEXT NOT NULL,
      UNIQUE(project_id, sequence), FOREIGN KEY(project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS project_generation_runs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_version_id TEXT NOT NULL,
      result_version_id TEXT, owner_email TEXT NOT NULL, kind TEXT NOT NULL,
      status TEXT NOT NULL, quote_id TEXT, hold_id TEXT, progress TEXT NOT NULL,
      error_code TEXT, created_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recovery_checkpoints (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      version_id TEXT NOT NULL, generation_run_id TEXT, reason TEXT NOT NULL,
      status TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS canvas_sessions (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      base_version_id TEXT NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL,
      snapshot TEXT NOT NULL, expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS composition_documents (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      version_id TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
      color_space TEXT NOT NULL, revision INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS composition_revisions (
      document_id TEXT NOT NULL, revision INTEGER NOT NULL, layers TEXT NOT NULL,
      background_asset_id TEXT, rendered_asset_id TEXT, created_at TEXT NOT NULL,
      PRIMARY KEY(document_id, revision)
    );
    CREATE TABLE IF NOT EXISTS project_assets (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, project_id TEXT NOT NULL,
      version_id TEXT, generation_run_id TEXT, role TEXT NOT NULL,
      parent_asset_id TEXT, content_hash TEXT NOT NULL, stable_url TEXT NOT NULL,
      mime_type TEXT NOT NULL, width INTEGER, height INTEGER,
      expires_at TEXT, retention_class TEXT NOT NULL,
      created_at TEXT NOT NULL, deleted_at TEXT
    );
  `);
}
```

Store JSON as canonical serialized snapshots, validate enums before SQL, use database transactions for head-version updates, and return `null` for cross-owner reads so routes can respond with 404.

- [x] **Step 4: Run focused and database regression tests**

Run: `node --test --test-concurrency=1 test/project-version-store.test.mjs test/composition-store.test.mjs test/task-persistence.test.mjs test/billing-wallet.test.mjs`

Expected: PASS.

- [x] **Step 5: Commit Task 1**

```powershell
git add server/projects/schema.mjs server/projects/projectStore.mjs server/projects/compositionStore.mjs server/db.mjs test/project-version-store.test.mjs test/composition-store.test.mjs
git commit -m "feat: add durable project version stores"
```

### Task 2: Authoritative Session And Project APIs

**Files:**
- Create: `server/projects/projectRoutes.mjs`
- Modify: `server/index.mjs`
- Modify: `server/generationRouteGuard.mjs`
- Test: `test/project-routes.test.mjs`
- Test: `test/auth-session-api.test.mjs`
- Test: `test/generation-route-guard.test.mjs`

**Interfaces:**
- Consumes: Task 1 stores and existing `contentSessionTokens.verify`.
- Produces: `mountProjectRoutes(app, dependencies)` and `GET /api/session`.

- [ ] **Step 1: Write failing owner-scope, session and idempotency tests**

```js
test('GET /api/session rejects an expired token and returns the signed owner for a valid token', async () => {
  assert.equal((await request('/api/session')).status, 401);
  const response = await request('/api/session', { token: validToken });
  assert.deepEqual(await response.json(), { ok: true, email: 'owner@example.com' });
});

test('project routes never trust owner_email from the request body', async () => {
  const response = await request('/api/projects', { method: 'POST', token: ownerToken, body: { owner_email: 'victim@example.com', kind: 'ecommerce' } });
  assert.equal((await response.json()).ownerEmail, 'owner@example.com');
});
```

- [ ] **Step 2: Run tests and verify route failures**

Run: `node --test --test-concurrency=1 test/project-routes.test.mjs test/auth-session-api.test.mjs`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement authenticated REST handlers**

```js
function owner(req, sessionTokens) {
  return authenticateContentRequest(req, { sessionTokens, isAllowedEmail: () => true });
}

app.get('/api/session', (req, res) => {
  try { res.json({ ok: true, email: owner(req, sessionTokens) }); }
  catch (error) { res.status(401).json({ code: 'SESSION_INVALID', error: '登录已失效，请重新登录' }); }
});
```

Mount create/list/get/version/checkpoint/Canvas-session routes. Require `Idempotency-Key` for POST task boundaries, use `If-Match` or `expectedRevision` for mutable Canvas sessions, and map cross-owner records to 404.

- [ ] **Step 4: Run focused security and route guard regression**

Run: `node --test --test-concurrency=1 test/project-routes.test.mjs test/auth-session-api.test.mjs test/generation-route-guard.test.mjs test/api-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add server/projects/projectRoutes.mjs server/index.mjs server/generationRouteGuard.mjs test/project-routes.test.mjs test/auth-session-api.test.mjs test/generation-route-guard.test.mjs
git commit -m "feat: expose authenticated project APIs"
```

### Task 3: Frontend Session Authority And Explicit Recovery Client

**Files:**
- Create: `src/services/projects.js`
- Create: `src/store/sessionState.js`
- Modify: `src/services/auth.js`
- Modify: `src/services/api.js`
- Modify: `src/store/AppContext.jsx`
- Modify: `src/components/business/Modals.jsx`
- Modify: `src/components/business/loginOtpState.js`
- Test: `test/auth-session-client.test.mjs`
- Test: `test/project-client.test.mjs`
- Test: `test/login-continuity.test.mjs`

**Interfaces:**
- Produces: `validateSession`, `clearSession`, `onSessionInvalid`, `listRecoveryCheckpoints`, `consumeRecoveryCheckpoint`, `dismissRecoveryCheckpoint`.

- [ ] **Step 1: Write failing split-brain and OTP lifecycle tests**

```js
test('getSession validates the token with the server before reporting logged in', async () => {
  storage.setItem('sb-auth', JSON.stringify({ token: 'expired', email: 'owner@example.com' }));
  fetchMock.once(401, { code: 'SESSION_INVALID' });
  assert.equal(await getSession(), null);
  assert.equal(storage.getItem('sb-auth'), null);
});

test('a new OTP send cycle clears the old code and keeps the email input available', () => {
  assert.deepEqual(nextOtpState({ phase: 'code', email, code: '123456' }, { type: 'SEND_REJECTED', retryAfter: 60 }), { phase: 'email', email, code: '', retryAfter: 60 });
});
```

- [ ] **Step 2: Run tests and confirm current local-token behavior fails**

Run: `node --test --test-concurrency=1 test/auth-session-client.test.mjs test/project-client.test.mjs test/login-continuity.test.mjs`

Expected: FAIL because `getSession` trusts local storage and OTP state is not centralized.

- [ ] **Step 3: Implement one session-invalid event path**

```js
export async function validateSession() {
  const token = getSessionToken();
  if (!token) return null;
  const response = await fetch('/api/session', { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) { clearSession(); return null; }
  return response.json();
}
```

All authenticated clients call a shared response guard. A 401 clears auth once, invalidates billing epochs, closes stale private recovery UI, and opens the login modal without navigating. OTP input state remains component memory only and resets after resend, logout, close or successful verification.

- [ ] **Step 4: Run auth, billing and pending-action regression**

Run: `node --test --test-concurrency=1 test/auth-session-client.test.mjs test/project-client.test.mjs test/login-continuity.test.mjs test/billing-client.test.mjs test/pending-paid-action.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/services/projects.js src/store/sessionState.js src/services/auth.js src/services/api.js src/store/AppContext.jsx src/components/business/Modals.jsx src/components/business/loginOtpState.js test/auth-session-client.test.mjs test/project-client.test.mjs test/login-continuity.test.mjs
git commit -m "fix: make server sessions authoritative"
```

### Task 4: Blank-By-Default Creation Lifecycle And Recovery Shelf

**Files:**
- Create: `src/pages/Home/ec/projectLifecycleModel.js`
- Create: `src/pages/Home/ec/RecoveryShelf.jsx`
- Create: `src/pages/Home/ec/RecoveryShelf.css`
- Modify: `src/pages/Home/EcMode.jsx`
- Modify: `src/pages/Home/ec/ecommerceDraftStore.js`
- Modify: `src/pages/Home/ec/ecommerceTaskProgressModel.js`
- Modify: `src/pages/Home/index.jsx`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Modify: `src/utils/contentDraftStore.js`
- Test: `test/project-lifecycle-model.test.mjs`
- Test: `test/ecommerce-draft-store.test.mjs`
- Test: `test/content-draft-store.test.mjs`
- Test: `test/ecommerce-task-progress.test.mjs`

**Interfaces:**
- Produces: `freshEditorState`, `beginDurableProject`, `completeCreationCycle`, `restoreCheckpointIntoEditor`, `discardLegacyDraftState`.

- [ ] **Step 1: Write failing lifecycle tests**

```js
test('fresh visit and completed generation always create a blank editor', () => {
  assert.deepEqual(freshEditorState({ legacySnapshot: oldDraft, completedRunId: 'run-1' }), EMPTY_ECOMMERCE_EDITOR);
});

test('unfinished work is listed but never injected until the user consumes it', () => {
  assert.equal(selectInitialEditor({ checkpoints: [checkpoint] }).prompt, '');
  assert.equal(restoreCheckpointIntoEditor(checkpoint).prompt, '保留的提示词');
});
```

- [ ] **Step 2: Run tests and verify unconditional restoration fails**

Run: `node --test --test-concurrency=1 test/project-lifecycle-model.test.mjs test/ecommerce-draft-store.test.mjs test/content-draft-store.test.mjs test/ecommerce-task-progress.test.mjs`

Expected: FAIL because account/surface drafts auto-load.

- [ ] **Step 3: Remove permanent editor persistence and add explicit shelf**

```js
const [editor, setEditor] = useState(() => freshEditorState());
const restore = async checkpoint => setEditor(await consumeRecoveryCheckpoint(checkpoint.id));
```

Keep login interruptions in mounted component memory. Persist only server checkpoints for payment/generation interruption. On completion clear old local draft keys, IndexedDB files and active task references, rotate to a fresh in-memory ID, and save output to Works. XHS and Plog follow the same lifecycle while retaining `content_set` billing.

- [ ] **Step 4: Run creation-flow regressions and build**

Run: `node --test --test-concurrency=1 test/project-lifecycle-model.test.mjs test/ecommerce-draft-store.test.mjs test/content-draft-store.test.mjs test/ecommerce-task-progress.test.mjs test/api-contract.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/pages/Home/ec/projectLifecycleModel.js src/pages/Home/ec/RecoveryShelf.jsx src/pages/Home/ec/RecoveryShelf.css src/pages/Home/EcMode.jsx src/pages/Home/ec/ecommerceDraftStore.js src/pages/Home/ec/ecommerceTaskProgressModel.js src/pages/Home/index.jsx src/pages/Home/XhsContentMode.jsx src/pages/Plog/index.jsx src/utils/contentDraftStore.js test/project-lifecycle-model.test.mjs test/ecommerce-draft-store.test.mjs test/content-draft-store.test.mjs test/ecommerce-task-progress.test.mjs
git commit -m "feat: close creation lifecycles explicitly"
```

### Task 5: Shot Director, Typography Policy And Layout Contracts

**Files:**
- Create: `server/ecommerceEngine/shotDirector.mjs`
- Create: `server/ecommerceEngine/typographyPolicy.mjs`
- Create: `server/ecommerceEngine/layoutContracts.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/campaignBible.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Modify: `server/ecommerceEngine/index.mjs`
- Test: `test/ecommerce-shot-director.test.mjs`
- Test: `test/ecommerce-typography-policy.test.mjs`
- Test: `test/ecommerce-asset-planner.test.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`

**Interfaces:**
- Produces: `directShot(item, context)`, `compileTypographySystem(context)`, `layoutContractFor(item, context)`.
- Each Asset Plan item gains `shotIntent`, `layoutContract`, and `textLayerPlan`.

- [ ] **Step 1: Write failing diversity, evidence and typography tests**

```js
test('single-view products receive distinct safe camera intents and evidence-gated fallbacks', () => {
  const intents = plan.items.map(item => item.shotIntent);
  assert.ok(new Set(intents.map(value => `${value.camera.azimuth}:${value.type}`)).size >= 4);
  assert.equal(intents.find(value => value.type === 'exploded_view')?.evidenceTier, 'confirmed_only');
});

test('premium skincare uses a licensed serif display face with readable CJK body fallback', () => {
  const system = compileTypographySystem({ category: '美妆护肤', priceBand: 'premium', language: 'zh-CN' });
  assert.equal(system.tone, 'premium');
  assert.ok(system.displayFontId);
  assert.ok(system.fallbackFontIds.length);
});
```

- [ ] **Step 2: Run tests and verify generic purpose prompts fail**

Run: `node --test --test-concurrency=1 test/ecommerce-shot-director.test.mjs test/ecommerce-typography-policy.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs`

Expected: FAIL because Asset Plan items lack explicit camera/state/font contracts.

- [ ] **Step 3: Implement deterministic directors and compiler sections**

```js
export function directShot(item, context) {
  const requested = intentForRole(item.role, item.purpose);
  return evidenceAllows(requested, context.productTruth)
    ? requested
    : safeFallback(requested, context.productTruth);
}
```

The prompt compiler emits per-item camera elevation/azimuth, product orientation, interaction state, crop, required visible features, allowed inference and forbidden mutations. Marketing text is excluded from image pixels and emitted as exact `textLayerPlan`; immutable packaging text remains protected Product Truth.

- [ ] **Step 4: Run engine regression**

Run: `node --test --test-concurrency=1 test/ecommerce-shot-director.test.mjs test/ecommerce-typography-policy.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs test/product-truth.test.mjs test/platform-policies.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add server/ecommerceEngine/shotDirector.mjs server/ecommerceEngine/typographyPolicy.mjs server/ecommerceEngine/layoutContracts.mjs server/ecommerceEngine/assetPlanner.mjs server/ecommerceEngine/campaignBible.mjs server/ecommerceEngine/promptCompiler.mjs server/ecommerceEngine/index.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-typography-policy.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-prompt-compiler.test.mjs
git commit -m "feat: direct distinct ecommerce shots and typography"
```

### Task 6: Deterministic Editable Text Composition

**Files:**
- Create: `server/composition/fontRegistry.mjs`
- Create: `server/composition/textLayout.mjs`
- Create: `server/composition/renderer.mjs`
- Create: `server/composition/validation.mjs`
- Create: `server/composition/fonts/README.md`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/ecommerceEngine/exportService.mjs`
- Test: `test/font-registry.test.mjs`
- Test: `test/text-layout.test.mjs`
- Test: `test/composition-renderer.test.mjs`
- Test: `test/ecommerce-orchestrator.test.mjs`

**Interfaces:**
- Produces: `createFontRegistry`, `solveTextLayout`, `renderComposition`, `validateComposition`.
- Consumes Task 1 Composition Store and Task 5 text-layer plans.

- [ ] **Step 1: Write failing exact-text, fallback and rendering tests**

```js
test('layout preserves exact Chinese copy and stays inside its safe region', () => {
  const result = solveTextLayout({ text: '轻盈保湿，全天舒适', region, typography });
  assert.equal(result.text, '轻盈保湿，全天舒适');
  assert.ok(result.bounds.x >= region.x && result.bounds.right <= region.right);
});

test('renderer produces a flat preview and an editable text layer document', async () => {
  const output = await renderComposition({ background, layers: [titleLayer] });
  assert.equal(output.document.layers[0].kind, 'text');
  assert.equal((await sharp(output.buffer).metadata()).width, 1200);
});
```

- [ ] **Step 2: Run tests and confirm composition modules are missing**

Run: `node --test --test-concurrency=1 test/font-registry.test.mjs test/text-layout.test.mjs test/composition-renderer.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement licensed registry, SVG text and Sharp composition**

```js
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${fontBase64})}</style><text x="${x}" y="${baseline}" font-family="${family}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}">${escapeXml(text)}</text></svg>`;
const buffer = await sharp(background).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
```

Font records require license metadata, hashes, language coverage and fallback chains. Validate missing glyphs, contrast, safe regions, min size, max lines and overflow before rendering. Persist CompositionDocument and stable flat output together before marking an asset complete.

- [ ] **Step 4: Run composition and ecommerce integration regression**

Run: `node --test --test-concurrency=1 test/font-registry.test.mjs test/text-layout.test.mjs test/composition-renderer.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-export.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add server/composition/fontRegistry.mjs server/composition/textLayout.mjs server/composition/renderer.mjs server/composition/validation.mjs server/composition/fonts/README.md server/ecommerceEngine/orchestrator.mjs server/ecommerceEngine/exportService.mjs test/font-registry.test.mjs test/text-layout.test.mjs test/composition-renderer.test.mjs test/ecommerce-orchestrator.test.mjs
git commit -m "feat: compose editable ecommerce typography"
```

### Task 7: One Canvas Action Registry And Server Canvas Sessions

**Files:**
- Create: `src/pages/EcCanvas/canvasActionRegistry.js`
- Create: `src/pages/EcCanvas/canvasSessionModel.js`
- Create: `src/pages/EcCanvas/components/SelectionToolbar.jsx`
- Modify: `src/pages/EcCanvas/nodeWorkflow.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/ContextMenu.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/workflowNodes.css`
- Modify: `src/pages/Works/index.jsx`
- Test: `test/canvas-action-registry.test.mjs`
- Test: `test/canvas-session-model.test.mjs`
- Test: `test/canvasNodeWorkflow.test.mjs`
- Test: `test/ec-canvas-state.test.mjs`

**Interfaces:**
- Produces: `CANVAS_ACTION_REGISTRY`, `dispatchCanvasAction`, `createFreshCanvasSession`, `restoreSavedCanvasSession`.

- [ ] **Step 1: Write failing registry, import and derivation tests**

```js
test('toolbar, context menu and port picker expose one canonical action definition', () => {
  for (const surface of ['toolbar', 'context', 'port']) {
    assert.strictEqual(actionsForSurface(surface).find(action => action.id === 'remove-bg'), CANVAS_ACTION_REGISTRY['remove-bg']);
  }
});

test('importing a completed work creates source nodes only', () => {
  const session = createFreshCanvasSession(work);
  assert.ok(session.nodes.every(node => node.kind === 'image'));
  assert.deepEqual(session.connections, []);
});
```

- [ ] **Step 2: Run tests and verify duplicate action paths fail**

Run: `node --test --test-concurrency=1 test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs`

Expected: FAIL because `ECOMMERCE_ACTIONS`, `CANVAS_NODE_ACTIONS` and handlers diverge.

- [ ] **Step 3: Implement registry, fresh import and unified dispatch**

```js
export const CANVAS_ACTION_REGISTRY = Object.freeze(Object.fromEntries(definitions.map(action => [action.id, Object.freeze(action)])));
export const actionsForSurface = surface => definitions.filter(action => action.surfaces.includes(surface));
```

Left click selects and shows immediate tools. Right click and port drag use the same AI registry and dispatcher. Merge name/purpose into `图片信息`, rename Smart Remix to `商品图改造`, remove product-name localStorage restoration, and save only explicit server Canvas sessions. Keep action picker anchored in canvas coordinates and compute edges from actual port centers.

- [ ] **Step 4: Run Canvas regression and build**

Run: `node --test --test-concurrency=1 test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs test/canvas-billing.test.mjs test/api-contract.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add src/pages/EcCanvas/canvasActionRegistry.js src/pages/EcCanvas/canvasSessionModel.js src/pages/EcCanvas/components/SelectionToolbar.jsx src/pages/EcCanvas/nodeWorkflow.js src/pages/EcCanvas/index.jsx src/pages/EcCanvas/ContextMenu.jsx src/pages/EcCanvas/components/workflowNodes/index.jsx src/pages/EcCanvas/components/workflowNodes/workflowNodes.css src/pages/Works/index.jsx test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs
git commit -m "refactor: unify canvas actions and sessions"
```

### Task 8: Honest Layering, Text Editing And Multilayer PSD Export

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/composition/layerService.mjs`
- Create: `server/composition/psdExporter.mjs`
- Create: `src/pages/EcCanvas/components/TextLayerInspector.jsx`
- Modify: `server/canvasTools.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx`
- Test: `test/layer-service.test.mjs`
- Test: `test/psd-exporter.test.mjs`
- Test: `test/canvas-tools.test.mjs`
- Test: `test/canvas-generation-contract.test.mjs`

**Interfaces:**
- Produces: `analyzeScene`, `createPixelLayers`, `exportPsd`, `validatePsdStructure`.

- [ ] **Step 1: Install the PSD writer and record the exact dependency**

Run: `npm install ag-psd --save-exact`

Expected: `package.json` and lockfile contain an exact `ag-psd` version.

- [ ] **Step 2: Write failing semantic-vs-pixel and PSD tests**

```js
test('semantic analysis cannot claim editable layers', async () => {
  const result = await analyzeScene(flatImage);
  assert.equal(result.capabilities.pixelLayers, false);
  assert.equal(result.capabilities.psdExport, false);
});

test('PSD export contains separate bitmap and text layers', async () => {
  const buffer = exportPsd(documentWithBackgroundProductAndTitle);
  const structure = validatePsdStructure(buffer);
  assert.deepEqual(structure.layerNames, ['背景', '商品', '标题']);
  assert.equal(structure.flattened, false);
});
```

- [ ] **Step 3: Run tests and confirm current label-only layering fails**

Run: `node --test --test-concurrency=1 test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs`

Expected: FAIL.

- [ ] **Step 4: Implement capability levels and editable text controls**

```js
export function layerCapabilities(result) {
  const pixelLayers = result.layers.every(layer => layer.kind === 'text' || layer.assetId && layer.maskAssetId);
  return { semanticAnalysis: true, pixelLayers, psdExport: pixelLayers && result.layers.length > 1 };
}
```

Keep `/api/canvas/analyze-layers` as market-facing `画面分析`. A separate paid layer task must persist masks and transparent layer assets before reporting editable status. Text edits update CompositionDocument revisions without AI billing. PSD export reconstructs bitmap/text layers, parses the output, and only then returns a stable download URL.

- [ ] **Step 5: Run layer, Canvas billing and API regressions**

Run: `node --test --test-concurrency=1 test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs test/canvas-generation-contract.test.mjs test/canvas-billing.test.mjs test/one-shot-billing.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```powershell
git add package.json package-lock.json server/composition/layerService.mjs server/composition/psdExporter.mjs src/pages/EcCanvas/components/TextLayerInspector.jsx server/canvasTools.mjs server/index.mjs src/pages/EcCanvas/index.jsx src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs test/canvas-generation-contract.test.mjs
git commit -m "feat: add honest layers and PSD export"
```

### Task 9: Asset Retention, Legacy Migration And Expiry UX

**Files:**
- Create: `server/projects/retentionService.mjs`
- Create: `server/projects/legacyMigration.mjs`
- Create: `src/pages/Works/retentionModel.js`
- Modify: `server/index.mjs`
- Modify: `src/pages/Works/index.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/project-retention.test.mjs`
- Test: `test/project-legacy-migration.test.mjs`
- Test: `test/work-retention-ui.test.mjs`

**Interfaces:**
- Produces: `createRetentionService`, `migrateLegacyWorkOnRead`, `formatRetentionStatus`.

- [ ] **Step 1: Write failing reference-safe cleanup tests**

```js
test('retention never deletes assets referenced by a version, running task or ledger dispute', () => {
  const report = retention.sweep({ now: day(31) });
  assert.deepEqual(report.deletedAssetIds, ['unreferenced-expired']);
  assert.ok(report.protectedAssetIds.includes('version-reference'));
});
```

- [ ] **Step 2: Run tests and verify services are absent**

Run: `node --test --test-concurrency=1 test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement mark-isolate-delete and lazy migration**

```js
const RETENTION_MS = { temporary: hours(24), checkpoint: hours(24), unfinished: days(7), work: days(30), canvas: hours(24) };
```

First mark expired rows, then isolate, then delete only after a grace period and a fresh reference query. Lazy-migrate legacy Works to completed projects without rewriting stable asset URLs. Remove obsolete local draft/Canvas keys once per browser version. Show work expiry date and preservation state in market-facing copy.

- [ ] **Step 4: Run retention, Works and deployment regressions**

Run: `node --test --test-concurrency=1 test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs test/ecommerce-work-persistence.test.mjs test/deploy-script.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 9**

```powershell
git add server/projects/retentionService.mjs server/projects/legacyMigration.mjs src/pages/Works/retentionModel.js server/index.mjs src/pages/Works/index.jsx src/pages/EcCanvas/index.jsx test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs
git commit -m "feat: enforce project asset retention"
```

### Task 10: End-To-End Quality Gates, Mobile QA And Production Rollout

**Files:**
- Create: `test/project-lifecycle-integration.test.mjs`
- Create: `test/ecommerce-shot-diversity.test.mjs`
- Modify: `scripts/verify-production-billing.ps1`
- Modify: `scripts/deploy-production.ps1`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes every prior task.
- Produces repeatable local and production acceptance evidence.

- [ ] **Step 1: Add end-to-end contract tests**

```js
test('complete run archives a work, clears recovery and starts a blank editor identity', async () => {
  const completed = await harness.completeRun({ ownerEmail, projectId, sourceVersionId, assets: [stableAsset] });
  assert.equal(completed.project.status, 'completed');
  assert.deepEqual(store.listCheckpoints({ ownerEmail }), []);
  assert.deepEqual(freshEditorState(), EMPTY_ECOMMERCE_EDITOR);
});

test('one-product input yields safe distinct shot intents without invented internals', () => {
  const plan = buildAssetPlan(singleViewProductInput);
  assert.ok(new Set(plan.items.map(item => `${item.shotIntent.type}:${item.shotIntent.camera.azimuth}`)).size >= 4);
  assert.ok(plan.items.filter(item => item.shotIntent.evidenceTier === 'confirmed_only').every(item => item.shotIntent.fallbackIntent));
});

test('replayed completion cannot duplicate billing, work or result version', async () => {
  const first = await harness.completeRun(completionEvent);
  const replay = await harness.completeRun(completionEvent);
  assert.equal(replay.resultVersion.id, first.resultVersion.id);
  assert.equal(replay.work._saveKey, first.work._saveKey);
  assert.equal(replay.settlement.id, first.settlement.id);
});
```

- [ ] **Step 2: Run focused cross-system regression**

Run: `node --test --test-concurrency=1 test/project-*.test.mjs test/auth-session-*.test.mjs test/ecommerce-shot-*.test.mjs test/composition-*.test.mjs test/canvas-*.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run the complete quality gate**

Run: `npm test`

Run: `npm run build`

Run: `npm run collab:check`

Run: `git diff --check`

Expected: all tests pass, Vite build succeeds, collaboration policy reports READY, and diff check is empty.

- [ ] **Step 4: Perform browser QA at desktop and mobile widths**

Verify at 1440x900 and 390x844:

```text
blank fresh visit -> login in place -> upload -> quote -> generate -> navigate away -> global progress -> completed work -> blank home
payment interruption -> collapsed recovery -> explicit restore
work import -> fresh Canvas -> unified action -> connected child -> editable text -> multilayer PSD
logout/login -> no old form, OTP or Canvas auto-restore
```

Capture screenshots and inspect for overlap, clipped text, unscrollable menus, incorrect port geometry and broken touch pan/zoom.

- [ ] **Step 5: Commit verification and progress ledger**

```powershell
git add test/project-lifecycle-integration.test.mjs test/ecommerce-shot-diversity.test.mjs scripts/verify-production-billing.ps1 scripts/deploy-production.ps1 .superpowers/sdd/progress.md
git commit -m "test: verify project creation lifecycle"
```

- [ ] **Step 6: Deploy only through the production script**

Run: `.\scripts\deploy-production.ps1`

Expected: preflight tests and build pass, remote backup succeeds, PM2 is online, public verification passes, the 600-second canary passes, and the script prints `Deployed <commit> to https://shuimg.cn/`.

- [ ] **Step 7: Verify production behavior and record the deployed commit**

Check `/health`, `/api/session`, owner-scoped project APIs, one real generation run, billing hold/settlement/release, stable work URLs, Canvas session save, editable composition render and PSD structural download. Update `.superpowers/sdd/progress.md` with exact commands, counts, deployed commit and residual risks.
