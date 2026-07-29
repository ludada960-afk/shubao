# Market-Ready Ecommerce Creation Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining market-facing ecommerce creation loop from fail-closed visual understanding through exact-count differentiated generation, durable progress, coherent Canvas editing, honest PSD export, retention, UI audit, and production acceptance.

**Architecture:** Extend the existing SQLite-backed project, generation-job, billing, stable-asset and composition stores instead of replacing them. Product and style analysis become separate cached services, every downstream plan remains immutable and count-authoritative, global progress is reconstructed from owner-scoped server jobs, and Canvas commands share one registry and one server session. Pixel composition, PSD export and retention are independent capabilities with explicit gates.

**Tech Stack:** Node.js ESM, Express 4, better-sqlite3, React 18, Vite 6, Sharp, `ag-psd@31.0.2`, Node test runner, PowerShell production deployment.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Use the Git prefix from `RTK.md`; stage explicit files only and keep runtime databases, uploads, caches, logs, secrets and `dist/` out of commits.
- Formal ecommerce requests may never use Mock visual analysis or hidden provider calls.
- `gpt-5.6-terra` remains the default visual-analysis model and `gpt-image-2` remains the default generation model.
- Product images and style references are analyzed independently and reference facts never enter Product Truth.
- Asset-plan count, quote units, provider submissions and visible task items must match exactly.
- Only quality-approved stable assets settle billing; failed assets release their own reservation and successful assets are never regenerated because a sibling failed.
- A fresh or completed creation starts blank; only explicit unfinished checkpoints can restore input.
- Every user decision uses product dialogs; no browser-native alert, confirm or prompt.
- Production deployment uses only `scripts/deploy-production.ps1` and includes an authenticated real visual-analysis and generation acceptance run.

---

### Task 1: Fail-Closed Product And Style Visual Analysis

**Files:**
- Create: `server/ecommerceEngine/styleReferenceProfile.mjs`
- Create: `server/ecommerceEngine/visualAnalysisStore.mjs`
- Create: `server/ecommerceEngine/visualAnalysisService.mjs`
- Modify: `server/ecommerceEngine/vlmClient.mjs`
- Modify: `server/ecommerceEngine/campaignBible.mjs`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Modify: `server/index.mjs`
- Test: `test/style-reference-profile.test.mjs`
- Test: `test/visual-analysis-service.test.mjs`
- Modify: `test/ecommerce-orchestrator.test.mjs`

**Interfaces:**
- Produces `normalizeStyleReferenceProfile(input)`, `buildStyleReferencePrompt({ sourceAssetIds })`.
- Produces `createVisualAnalysisStore(db)` with `get(key)` and `put({ key, type, model, promptVersion, result })`.
- Produces `createVisualAnalysisService({ store, readAsset, callVision, model, promptVersion })` with `analyze({ productAssets, styleAssets, userFacts })`.
- `analyze` returns `{ productTruth, styleReferenceProfile, cache }` or throws a structured `VISUAL_ANALYSIS_*` error before billing hold creation.

- [ ] **Step 1: Write failing schema, isolation, cache and failure tests**

```js
test('style analysis transfers visual language but blocks reference facts', () => {
  const profile = normalizeStyleReferenceProfile({
    palette: ['#fff4e8'],
    referenceProduct: 'competitor bottle',
    logos: ['Other Brand'],
    visibleText: ['500ml'],
  });
  assert.deepEqual(profile.palette, ['#fff4e8']);
  assert.ok(profile.prohibitedTransfers.includes('reference products'));
  assert.equal(Object.hasOwn(profile, 'referenceProduct'), false);
  assert.equal(Object.hasOwn(profile, 'logos'), false);
});

test('same asset hashes and prompt version reuse one visual call', async () => {
  const first = await service.analyze(input);
  const replay = await service.analyze(input);
  assert.equal(visionCalls, 2); // one product call and one style call total
  assert.deepEqual(replay, first);
});

test('visual failure stops before billing and never returns mock facts', async () => {
  await assert.rejects(() => orchestrator.run(job.id), { code: 'VISUAL_ANALYSIS_UNAVAILABLE' });
  assert.equal(billingHolds.length, 0);
  assert.equal(providerSubmissions.length, 0);
});
```

- [ ] **Step 2: Run tests and confirm missing services fail**

Run: `node --test --test-concurrency=1 test/style-reference-profile.test.mjs test/visual-analysis-service.test.mjs test/ecommerce-orchestrator.test.mjs`

Expected: FAIL because the new modules and `analyzeVisualInputs` dependency do not exist.

- [ ] **Step 3: Implement strict profiles, durable cache and injectable VLM client**

```js
export function buildStyleReferencePrompt({ sourceAssetIds = [] } = {}) {
  return {
    systemPrompt: `Return JSON only. Extract transferable palette, lighting, composition, camera language, typography intent, information density, background language and mood. Never transfer products, people identities, brands, logos, prices, claims, parameters, certifications or source copy.`,
    userPrompt: `Analyze style references ${sourceAssetIds.join(', ')}.`,
  };
}

export function createVlmClient({ fetchImpl = fetch, apiKey, baseUrl, model = 'gpt-5.6-terra' } = {}) {
  if (!apiKey || !baseUrl) throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
  return { analyzeJson };
}
```

Use original asset IDs as content hashes, plus model, prompt version and analysis type, for the SQLite cache key. Send Terra image inputs with `detail: 'original'`. Delete the formal-request Mock fallback. Persist both analyses in `orchestrationSnapshot` before `billing.hold`, and compile `CampaignBible` from `StyleReferenceProfile` plus user overrides.

- [ ] **Step 4: Run focused and adjacent regressions**

Run: `node --test --test-concurrency=1 test/style-reference-profile.test.mjs test/visual-analysis-service.test.mjs test/product-truth.test.mjs test/campaign-bible.test.mjs test/ecommerce-orchestrator.test.mjs test/vision-model-defaults.test.mjs`

Expected: PASS with no network dependency.

- [ ] **Step 5: Commit Task 1**

```powershell
git add server/ecommerceEngine/styleReferenceProfile.mjs server/ecommerceEngine/visualAnalysisStore.mjs server/ecommerceEngine/visualAnalysisService.mjs server/ecommerceEngine/vlmClient.mjs server/ecommerceEngine/campaignBible.mjs server/ecommerceEngine/orchestrator.mjs server/index.mjs test/style-reference-profile.test.mjs test/visual-analysis-service.test.mjs test/ecommerce-orchestrator.test.mjs
git commit -m "feat: separate product and style visual analysis"
```

### Task 2: Exact-Count Planning And Suite Differentiation Contract

**Files:**
- Create: `server/ecommerceEngine/planContract.mjs`
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/shotDirector.mjs`
- Modify: `server/ecommerceEngine/suiteDiversity.mjs`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Test: `test/ecommerce-plan-contract.test.mjs`
- Modify: `test/ecommerce-asset-planner.test.mjs`
- Modify: `test/ecommerce-suite-diversity.test.mjs`
- Modify: `test/ecommerce-orchestrator.test.mjs`

**Interfaces:**
- Produces `validatePlanContract(items)` and `assertExecutionCount({ plan, assetRows, providerSubmissions })`.
- `validatePlanContract` rejects duplicate IDs, roles without unique duties, collages/contact sheets, unsafe evidence tiers and semantically duplicate shot plans.
- Produces `suiteSemanticKey(item)` from communication goal, shot type, camera azimuth, crop, interaction state and scene family.

- [ ] **Step 1: Write failing exact-count and semantic-diversity tests**

```js
test('three quoted plan items create exactly three visible assets and three provider submissions', async () => {
  const result = await harness.run(planOfThree);
  assert.equal(result.assetPlan.length, 3);
  assert.equal(result.assets.length, 3);
  assert.equal(harness.submissions.length, 3);
  assert.equal(result.quote.units, 3);
});

test('a suite cannot contain two items with the same commercial duty and shot intent', () => {
  assert.throws(() => validatePlanContract([hero, { ...hero, id: 'hero-2' }]), /duplicate suite intent/);
});

test('a duplicate output repairs only that asset once', async () => {
  const result = await harness.runWithDuplicate('main-2');
  assert.equal(harness.submissionsByAsset.get('main-1'), 1);
  assert.equal(harness.submissionsByAsset.get('main-2'), 2);
  assert.equal(harness.totalSubmissions, plan.length + 1);
  assert.equal(result.assets.length, plan.length);
});
```

- [ ] **Step 2: Run tests and confirm current planner lacks the aggregate contract**

Run: `node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs`

Expected: FAIL for the missing plan contract and exact submission accounting.

- [ ] **Step 3: Enforce plan validation before hold and execution accounting after delivery**

```js
export function suiteSemanticKey(item = {}) {
  const shot = item.shotIntent || {};
  return [item.communicationGoal, shot.type, shot.camera?.azimuth, shot.crop, shot.interactionState, shot.sceneFamily]
    .map(value => String(value || '').trim().toLowerCase()).join('|');
}
```

Give each role one explicit `communicationGoal`. Preserve safe one-view fallbacks in `shotDirector`; never plan hidden structure without confirmed evidence. Call `validatePlanContract` before `billing.hold`. Count provider submissions by asset ID, permit at most one quality repair, never append new visible asset rows, and checkpoint count diagnostics without provider secrets.

- [ ] **Step 4: Run engine regression**

Run: `node --test --test-concurrency=1 test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-shot-director.test.mjs test/ecommerce-prompt-compiler.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-quality-gate.test.mjs test/ecommerce-orchestrator.test.mjs test/ecommerce-billing-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```powershell
git add server/ecommerceEngine/planContract.mjs server/ecommerceEngine/assetPlanner.mjs server/ecommerceEngine/shotDirector.mjs server/ecommerceEngine/suiteDiversity.mjs server/ecommerceEngine/orchestrator.mjs test/ecommerce-plan-contract.test.mjs test/ecommerce-asset-planner.test.mjs test/ecommerce-suite-diversity.test.mjs test/ecommerce-orchestrator.test.mjs
git commit -m "feat: enforce exact differentiated ecommerce plans"
```

### Task 3: Durable Global Task Dock And In-Context Errors

**Files:**
- Modify: `server/generationJobs.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Create: `src/store/durableTaskModel.js`
- Modify: `src/store/taskStore.jsx`
- Modify: `src/components/task/TaskSidebar.jsx`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/pages/Home/ec/DesignDirectionView.jsx`
- Test: `test/durable-task-model.test.mjs`
- Modify: `test/generation-jobs.test.mjs`
- Modify: `test/ecommerce-task-progress.test.mjs`
- Modify: `test/mobile-layout.test.mjs`

**Interfaces:**
- `generationJobs.listOwner(ownerEmail, { limit = 20 })` returns sanitized summaries only.
- `listEcommerceTasks()` calls `GET /api/ecommerce/jobs` with the signed session.
- `normalizeDurableTask(job)` returns `{ id, title, status, done, total, failed, error, updatedAt, actions }`.
- Task context hydrates and polls server summaries; it never invents completion from local reducer state.

- [ ] **Step 1: Write failing owner-scope, hydration and inline-error tests**

```js
test('owner task list never returns another owner job or request payload', () => {
  const rows = jobs.listOwner('a@example.com');
  assert.deepEqual(rows.map(row => row.id), ['job-a']);
  assert.equal(Object.hasOwn(rows[0], 'payload'), false);
});

test('durable task summary preserves completed, failed and total image counts', () => {
  assert.deepEqual(normalizeDurableTask(serverJob), {
    id: 'job-a', title: '保温杯套图', status: 'generating', done: 1, total: 3,
    failed: 1, error: '第 2 张商品一致性未通过', updatedAt: serverJob.updatedAt,
    actions: ['open'],
  });
});
```

Add a source contract asserting that the current image error is rendered inside the progress surface, not only sent to a top toast.

- [ ] **Step 2: Run tests and verify memory-only task behavior fails**

Run: `node --test --test-concurrency=1 test/durable-task-model.test.mjs test/generation-jobs.test.mjs test/ecommerce-task-progress.test.mjs test/mobile-layout.test.mjs`

Expected: FAIL for missing owner list and durable task model.

- [ ] **Step 3: Implement signed task listing, polling and an accessible dock**

```js
export function normalizeDurableTask(job = {}) {
  const items = Array.isArray(job.assets) ? job.assets : [];
  return {
    id: String(job.id || ''),
    title: String(job.title || '电商套图'),
    status: String(job.status || 'queued'),
    done: items.filter(item => item.state === 'completed').length,
    failed: items.filter(item => ['failed', 'needs_review'].includes(item.state)).length,
    total: items.length,
    error: String(job.error || ''),
    updatedAt: job.updatedAt,
    actions: ['failed', 'needs_review'].includes(job.status) ? ['open', 'retry_failed'] : ['open'],
  };
}
```

Replace the 8px hover strip with a stable icon button and popover that works by click, keyboard and touch. Poll while any owner job is non-terminal and refresh on visibility changes. Show per-image errors beside their cards and in the task dock. Retry commands must call the existing explicit retry API and only target failed assets.

- [ ] **Step 4: Run task, auth, API and build regressions**

Run: `node --test --test-concurrency=1 test/durable-task-model.test.mjs test/generation-jobs.test.mjs test/ecommerce-task-progress.test.mjs test/auth-session-client.test.mjs test/api-contract.test.mjs test/mobile-layout.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add server/generationJobs.mjs server/index.mjs src/services/api.js src/store/durableTaskModel.js src/store/taskStore.jsx src/components/task/TaskSidebar.jsx src/pages/Home/ec/DesignDirection.jsx src/pages/Home/ec/DesignDirectionView.jsx test/durable-task-model.test.mjs test/generation-jobs.test.mjs test/ecommerce-task-progress.test.mjs test/mobile-layout.test.mjs
git commit -m "feat: restore ecommerce tasks globally"
```

### Task 4: One Canvas Action Registry, Fresh Sessions And Source Fan-Out

**Files:**
- Create: `src/pages/EcCanvas/canvasActionRegistry.js`
- Create: `src/pages/EcCanvas/canvasSessionModel.js`
- Modify: `src/pages/EcCanvas/nodeWorkflow.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/ContextMenu.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/modular/CanvasNodeActionPicker.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/workflowNodes.css`
- Modify: `src/pages/Works/index.jsx`
- Test: `test/canvas-action-registry.test.mjs`
- Test: `test/canvas-session-model.test.mjs`
- Modify: `test/canvasNodeWorkflow.test.mjs`
- Modify: `test/ec-canvas-state.test.mjs`

**Interfaces:**
- `CANVAS_ACTIONS` is the only command registry and each record defines `id`, `label`, `surfaces`, `priceFeature`, `canRun(node)`, `requiresPrompt`, and `execute` route metadata.
- `createFreshCanvasSession({ work, productAssets, outputs })` returns one source group and parallel output nodes with source-group edges.
- `actionsForSurface({ surface, node })` drives hover, selection, context and port menus.

- [ ] **Step 1: Write failing registry, fan-out, derivation and fresh-import tests**

```js
test('hover exposes only adjust requirements and regenerate', () => {
  assert.deepEqual(actionsForSurface({ surface: 'hover', node: completedOutput }).map(x => x.id), ['adjust-requirements', 'regenerate']);
});

test('work import creates one product source group and parallel output edges', () => {
  const session = createFreshCanvasSession(workInput);
  assert.equal(session.nodes.filter(node => node.kind === 'source_group').length, 1);
  assert.ok(session.connections.every(edge => edge.from === session.nodes[0].id));
  assert.equal(session.connections.some(edge => edge.from.startsWith('output-')), false);
});

test('process nodes and unfinished outputs cannot derive', () => {
  assert.equal(canDeriveFromNode({ kind: 'process', status: 'draft' }), false);
  assert.equal(canDeriveFromNode({ kind: 'output', status: 'completed' }), true);
});
```

- [ ] **Step 2: Run tests and confirm duplicate dispatch and local auto-restore fail**

Run: `node --test --test-concurrency=1 test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs`

Expected: FAIL for missing registry/session modules and old fan-out behavior.

- [ ] **Step 3: Implement registry-driven commands and explicit server sessions**

```js
export const CANVAS_ACTIONS = Object.freeze([
  action('adjust-requirements', '调整生成要求', ['hover', 'context'], 'canvas_regenerate', true),
  action('regenerate', '重新生成', ['hover', 'context'], 'canvas_regenerate', false),
  action('download', '下载', ['selection', 'context'], null, false),
  action('image-info', '图片信息', ['selection', 'context'], null, false),
  action('add-reference', '加入引用', ['selection', 'context'], null, false),
  action('delete', '删除', ['selection', 'context'], null, false),
  action('product-remix', '商品图改造', ['context', 'port'], 'canvas_regenerate', true),
  action('outpaint', '智能扩图', ['context', 'port'], 'canvas_regenerate', true),
]);
```

Remove `shubao_ec_canvas_state` automatic load/save. A Works import always creates a fresh in-memory session; only explicit server Canvas-session save/restore persists it. Merge rename and purpose into `图片信息`. Require ratio and prompt before outpaint quote. Keep picker coordinates in canvas world space, clamp its scroll container to the viewport, and derive edge endpoints from real port centers.

- [ ] **Step 4: Run Canvas, billing and build regressions**

Run: `node --test --test-concurrency=1 test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs test/canvas-billing.test.mjs test/canvas-generation-contract.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src/pages/EcCanvas/canvasActionRegistry.js src/pages/EcCanvas/canvasSessionModel.js src/pages/EcCanvas/nodeWorkflow.js src/pages/EcCanvas/index.jsx src/pages/EcCanvas/ContextMenu.jsx src/pages/EcCanvas/components/workflowNodes/index.jsx src/pages/EcCanvas/components/workflowNodes/modular/CanvasNodeActionPicker.jsx src/pages/EcCanvas/components/workflowNodes/workflowNodes.css src/pages/Works/index.jsx test/canvas-action-registry.test.mjs test/canvas-session-model.test.mjs test/canvasNodeWorkflow.test.mjs test/ec-canvas-state.test.mjs
git commit -m "refactor: unify canvas actions and sessions"
```

### Task 5: Deterministic Typography And Editable Text Composition

**Files:**
- Create: `server/composition/fontRegistry.mjs`
- Create: `server/composition/textComposer.mjs`
- Create: `server/composition/compositionService.mjs`
- Create: `src/pages/EcCanvas/components/TextLayerInspector.jsx`
- Modify: `server/ecommerceEngine/typographyPolicy.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/font-registry.test.mjs`
- Test: `test/text-composer.test.mjs`
- Test: `test/composition-service.test.mjs`

**Interfaces:**
- `resolveFont({ category, priceBand, language })` returns a deployed, checksum-verified licensed font or the fixed safe fallback.
- `renderTextLayer({ text, fontId, fontSize, color, width, align, lineHeight })` returns sanitized SVG bytes and metrics.
- `createCompositionService({ compositionStore, generatedAssetStore })` creates immutable revisions and renders stable output assets.

- [ ] **Step 1: Write failing license, exact-text, fallback and immutable-revision tests**

```js
test('font resolver never returns an undeployed planned font', () => {
  const font = resolveFont({ category: '美妆', priceBand: 'premium', language: 'zh-CN' });
  assert.equal(font.deployed, true);
  assert.match(font.sha256, /^[a-f0-9]{64}$/);
});

test('text rendering preserves the exact confirmed Chinese copy', async () => {
  const layer = await renderTextLayer({ text: '轻盈保湿', fontId: 'fallback-sans', fontSize: 64, color: '#111111', width: 800, align: 'center', lineHeight: 1.2 });
  assert.match(layer.svg.toString(), /轻盈保湿/);
  assert.doesNotMatch(layer.svg.toString(), /undefined|NaN/);
});
```

- [ ] **Step 2: Run tests and confirm composition modules are absent**

Run: `node --test --test-concurrency=1 test/font-registry.test.mjs test/text-composer.test.mjs test/composition-service.test.mjs test/composition-store.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement licensed font gates, SVG text and Sharp composition**

```js
export function resolveFont(input, registry = FONT_REGISTRY) {
  const candidate = chooseToneFont(input, registry);
  return candidate?.deployed && SHA256_RE.test(candidate.sha256) ? candidate : registry['fallback-sans'];
}
```

Do not claim the existing typography plan is deployed. Register only font files present in a committed/public licensed asset directory and verify checksums on startup. User text edits update `CompositionDocument` revisions without AI billing. Render background, product bitmap and exact text layers through Sharp to a stable PNG.

- [ ] **Step 4: Run composition, Canvas and API regressions**

Run: `node --test --test-concurrency=1 test/font-registry.test.mjs test/text-composer.test.mjs test/composition-service.test.mjs test/composition-store.test.mjs test/canvas-tools.test.mjs test/api-contract.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
git add server/composition/fontRegistry.mjs server/composition/textComposer.mjs server/composition/compositionService.mjs src/pages/EcCanvas/components/TextLayerInspector.jsx server/ecommerceEngine/typographyPolicy.mjs server/index.mjs src/services/api.js src/pages/EcCanvas/index.jsx test/font-registry.test.mjs test/text-composer.test.mjs test/composition-service.test.mjs
git commit -m "feat: add deterministic ecommerce text composition"
```

### Task 6: Honest Pixel Layers And Structurally Valid PSD Export

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/composition/layerService.mjs`
- Create: `server/composition/psdExporter.mjs`
- Modify: `server/canvasTools.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx`
- Test: `test/layer-service.test.mjs`
- Test: `test/psd-exporter.test.mjs`
- Modify: `test/canvas-tools.test.mjs`
- Modify: `test/canvas-generation-contract.test.mjs`

**Interfaces:**
- `analyzeScene` returns semantic regions with `pixelLayers: false`.
- `createPixelLayers` persists transparent bitmap layers and masks before returning `pixelLayers: true`.
- `exportPsd(document)` returns a PSD buffer; `validatePsdStructure(buffer)` parses it and rejects flattened or single-layer output.

- [ ] **Step 1: Install the exact PSD dependency**

Run: `npm install ag-psd@31.0.2 --save-exact`

Expected: `package.json` and `package-lock.json` pin `31.0.2` exactly.

- [ ] **Step 2: Write failing semantic-vs-pixel and PSD structure tests**

```js
test('semantic scene analysis cannot claim editable layers', async () => {
  const result = await analyzeScene(flatImage);
  assert.equal(result.capabilities.pixelLayers, false);
  assert.equal(result.capabilities.psdExport, false);
});

test('PSD export contains separate bitmap and text layers', async () => {
  const buffer = await exportPsd(documentWithBackgroundProductAndTitle);
  const structure = validatePsdStructure(buffer);
  assert.deepEqual(structure.layerNames, ['背景', '商品', '标题']);
  assert.equal(structure.flattened, false);
});
```

- [ ] **Step 3: Run tests and confirm the current disabled placeholder is insufficient**

Run: `node --test --test-concurrency=1 test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs`

Expected: FAIL because the services do not exist.

- [ ] **Step 4: Implement capability gates and verified export**

```js
export function layerCapabilities(document = {}) {
  const layers = Array.isArray(document.layers) ? document.layers : [];
  const pixelLayers = layers.length > 1 && layers.every(layer => layer.kind === 'text' || (layer.assetId && layer.maskAssetId));
  return { semanticAnalysis: true, pixelLayers, psdExport: pixelLayers };
}
```

Keep market-facing `画面分析` separate from paid pixel layering. Persist layer and mask stable assets, create an immutable composition revision, write PSD with `ag-psd`, read it back, and publish a download only after structural validation.

- [ ] **Step 5: Run layer, billing, API and build regressions**

Run: `node --test --test-concurrency=1 test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs test/canvas-generation-contract.test.mjs test/canvas-billing.test.mjs test/one-shot-billing.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```powershell
git add package.json package-lock.json server/composition/layerService.mjs server/composition/psdExporter.mjs server/canvasTools.mjs server/index.mjs src/services/api.js src/pages/EcCanvas/index.jsx src/pages/EcCanvas/components/workflowNodes/modular/LayerWorkbenchNodeCard.jsx test/layer-service.test.mjs test/psd-exporter.test.mjs test/canvas-tools.test.mjs test/canvas-generation-contract.test.mjs
git commit -m "feat: export verified layered PSD files"
```

### Task 7: Reference-Safe Retention And Legacy State Migration

**Files:**
- Create: `server/projects/retentionService.mjs`
- Create: `server/projects/legacyMigration.mjs`
- Create: `src/pages/Works/retentionModel.js`
- Modify: `server/projects/schema.mjs`
- Modify: `server/index.mjs`
- Modify: `src/pages/Works/index.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/project-retention.test.mjs`
- Test: `test/project-legacy-migration.test.mjs`
- Test: `test/work-retention-ui.test.mjs`

**Interfaces:**
- `createRetentionService({ db, assetStore, now })` exposes `markExpired()`, `isolateMarked()`, `deleteIsolated()` and `sweep()`.
- `migrateLegacyWorkOnRead({ ownerEmail, work })` creates one completed project/version without duplicating stable assets.
- `formatRetentionStatus({ expiresAt, preserved, expired }, now)` returns market-facing label and action availability.

- [ ] **Step 1: Write failing retention, legal-hold and migration-idempotency tests**

```js
test('retention deletes only expired unprotected binary assets', () => {
  const report = retention.sweep();
  assert.deepEqual(report.deletedAssetIds, ['expired-unreferenced']);
  assert.ok(report.protectedAssetIds.includes('active-canvas'));
  assert.ok(report.protectedAssetIds.includes('billing-dispute'));
});

test('expired project versions retain metadata without retaining the binary forever', () => {
  const version = projectStore.getVersion('version-1');
  assert.equal(version.assets[0].expired, true);
  assert.equal(assetStore.exists(version.assets[0].assetId), false);
});
```

- [ ] **Step 2: Run tests and verify services are absent**

Run: `node --test --test-concurrency=1 test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Implement mark-isolate-recheck-delete and one-time browser cleanup**

```js
export const RETENTION_MS = Object.freeze({
  temporary: 24 * 60 * 60 * 1000,
  unfinished: 7 * 24 * 60 * 60 * 1000,
  completed: 30 * 24 * 60 * 60 * 1000,
});
```

Use a grace state between mark and delete. Re-query running jobs, preserved works, active Canvas/composition references and billing disputes immediately before deleting bytes. Retain immutable version metadata and mark expired assets. Remove obsolete `shubao_ec_canvas_state` and old draft indexes once per browser migration version.

- [ ] **Step 4: Run project, Works and runtime-boundary regressions**

Run: `node --test --test-concurrency=1 test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs test/project-version-store.test.mjs test/ecommerce-work-persistence.test.mjs test/runtime-boundary.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add server/projects/retentionService.mjs server/projects/legacyMigration.mjs src/pages/Works/retentionModel.js server/projects/schema.mjs server/index.mjs src/pages/Works/index.jsx src/pages/EcCanvas/index.jsx test/project-retention.test.mjs test/project-legacy-migration.test.mjs test/work-retention-ui.test.mjs
git commit -m "feat: enforce ecommerce asset retention"
```

### Task 8: Market Copy, Pricing, Dialog And Visual-System Audit

**Files:**
- Modify: `src/components/business/Modals.jsx`
- Modify: `src/components/business/loginOtpState.js`
- Modify: `src/pages/Pricing/index.jsx`
- Modify: `src/components/task/TaskSidebar.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/workflowNodes.css`
- Modify: `src/pages/Home/Home.css`
- Create: `src/styles/semanticTokens.css`
- Modify: `src/index.css`
- Test: `test/login-otp-state.test.mjs`
- Test: `test/pricing-catalog.test.mjs`
- Create: `test/market-copy-contract.test.mjs`
- Create: `test/dialog-contract.test.mjs`
- Create: `test/visual-system-contract.test.mjs`
- Modify: `test/mobile-layout.test.mjs`

**Interfaces:**
- OTP state always preserves the email-edit path during resend cooldown and clears code on close, logout and a new login attempt.
- Pricing has exactly two user-facing currencies: `小红书 / Plog 创作套数` and `电商图片 / 画布 AI 积分`.
- Semantic tokens define command, success, warning, danger, neutral, focus and image states; feature components consume tokens rather than arbitrary toolbar colors.

- [ ] **Step 1: Write failing copy, OTP, dialog and color-contract tests**

```js
test('starting a new login attempt never restores an old OTP', () => {
  const next = beginLoginAttempt({ email: 'a@example.com', code: '123456', step: 'code' });
  assert.equal(next.code, '');
  assert.equal(next.step, 'email');
});

test('market copy exposes no rollout or privileged-account language', async () => {
  const source = await readMarketSources();
  assert.doesNotMatch(source, /内测|白名单|无限额度|已开通访问权限|本地开发模式/);
});
```

Assert no production source calls `window.alert`, `window.confirm` or `window.prompt`; icon-only buttons require `aria-label` or a named tooltip; Canvas toolbar colors reference semantic CSS variables.

- [ ] **Step 2: Run tests and reproduce current dev-copy and color failures**

Run: `node --test --test-concurrency=1 test/login-otp-state.test.mjs test/pricing-catalog.test.mjs test/market-copy-contract.test.mjs test/dialog-contract.test.mjs test/visual-system-contract.test.mjs test/mobile-layout.test.mjs`

Expected: FAIL on the visible local-development OTP copy and inconsistent Canvas colors.

- [ ] **Step 3: Implement market copy, OTP lifecycle and semantic visual tokens**

```css
:root {
  --command: #2563eb;
  --command-hover: #1d4ed8;
  --success: #27864b;
  --warning: #b76a00;
  --danger: #c43d35;
  --neutral-surface: #f5f6f8;
  --focus-ring: #2563eb;
}
```

Remove developer and access-list text. Keep the email input and “修改邮箱” command available during cooldown. Clear OTP code on lifecycle boundaries. Preserve the two pricing sections and honest disabled-payment state. Normalize dialog layout, hover/focus feedback, image loading/error/selected states and Canvas toolbar colors. Do not add decorative cards or marketing hero content.

- [ ] **Step 4: Run UI contracts and production build**

Run: `node --test --test-concurrency=1 test/login-otp-state.test.mjs test/pricing-catalog.test.mjs test/market-copy-contract.test.mjs test/dialog-contract.test.mjs test/visual-system-contract.test.mjs test/mobile-layout.test.mjs`

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```powershell
git add src/components/business/Modals.jsx src/components/business/loginOtpState.js src/pages/Pricing/index.jsx src/components/task/TaskSidebar.jsx src/pages/EcCanvas/index.jsx src/pages/EcCanvas/components/workflowNodes/workflowNodes.css src/pages/Home/Home.css src/styles/semanticTokens.css src/index.css test/login-otp-state.test.mjs test/pricing-catalog.test.mjs test/market-copy-contract.test.mjs test/dialog-contract.test.mjs test/visual-system-contract.test.mjs test/mobile-layout.test.mjs
git commit -m "refactor: align market copy and visual feedback"
```

### Task 9: End-To-End Acceptance, Real Provider Verification And Production Rollout

**Files:**
- Create: `test/market-creation-lifecycle.test.mjs`
- Create: `test/ecommerce-visual-analysis-integration.test.mjs`
- Create: `scripts/verify-production-ecommerce.ps1`
- Modify: `scripts/verify-production-billing.ps1`
- Modify: `scripts/deploy-production.ps1`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Production verifier accepts a signed canary token from `SHUBAO_CANARY_SESSION_TOKEN` and never prints it.
- It verifies visual analysis, exact plan count, billing hold/settlement/release, incremental stable Works assets, completed blank-home lifecycle, Canvas session, text composition and PSD structure.

- [ ] **Step 1: Write cross-system lifecycle tests**

```js
test('login interruption resumes the current command and completion rotates to a blank editor', async () => {
  const flow = await harness.startAnonymous(input);
  await flow.next();
  assert.equal(flow.dialog, 'login');
  await flow.login(owner);
  assert.deepEqual(flow.editorInput, input);
  await flow.complete();
  assert.deepEqual(flow.freshEditor, EMPTY_ECOMMERCE_EDITOR);
});

test('quoted count, provider attempts, stable works and billed deliveries reconcile', async () => {
  const result = await harness.generate({ count: 3, failAssetId: 'asset-2' });
  assert.equal(result.quote.units, 3);
  assert.equal(result.visibleItems.length, 3);
  assert.equal(result.stableWorks.length, 2);
  assert.equal(result.billing.settledItems, 2);
  assert.equal(result.billing.releasedItems, 1);
});
```

- [ ] **Step 2: Run focused cross-system regression**

Run: `node --test --test-concurrency=1 test/market-creation-lifecycle.test.mjs test/ecommerce-visual-analysis-integration.test.mjs test/project-*.test.mjs test/ecommerce-*.test.mjs test/canvas-*.test.mjs test/composition-*.test.mjs test/billing-*.test.mjs`

Expected: PASS.

- [ ] **Step 3: Run the complete local quality gate**

Run: `npm test`

Run: `npm run build`

Run: `npm run collab:check`

Run: `git diff --check`

Expected: all tests pass, build succeeds, collaboration reports READY, and diff check is empty.

- [ ] **Step 4: Perform browser QA at 1440x900 and 390x844**

Use Playwright against the local production build and verify:

```text
fresh blank editor → Next opens login → email resend/edit/code lifecycle → inputs preserved
visual analysis → exact quote → exact visible items → navigate away → global task dock
inline image error → successful images in Works → retry only failed item → completed blank home
Works import → product source fan-out → hover two actions → outpaint form → result child
text edit → pixel layers → structurally validated PSD
pricing sections → product dialogs → keyboard tooltips → no overlap or unscrollable menus
```

Capture desktop and mobile screenshots. Inspect canvas pixels and DOM geometry for blank images, clipped text, dock overlap, menu scroll, port/edge alignment and keyboard focus.

- [ ] **Step 5: Run authenticated staging/production-equivalent provider canaries before deployment**

Verify with non-secret environment configuration:

```text
one product image + one reference image → separate cached analyses
one three-image ecommerce plan → exactly three provider items
at least two commercial duties and camera intents → no collage/contact sheet
one forced failed item → release only that item and preserve successful stable Works
one Canvas regeneration and one verified layered PSD
```

Stop deployment if any canary fails or if the account lacks enough quota. Record request IDs and aggregate costs without keys or raw user images.

- [ ] **Step 6: Commit verification artifacts and progress ledger**

```powershell
git add test/market-creation-lifecycle.test.mjs test/ecommerce-visual-analysis-integration.test.mjs scripts/verify-production-ecommerce.ps1 scripts/verify-production-billing.ps1 scripts/deploy-production.ps1 .superpowers/sdd/progress.md
git commit -m "test: verify market ecommerce creation closure"
```

- [ ] **Step 7: Deploy only through the production script with the full canary**

Run: `.\scripts\deploy-production.ps1`

Expected: preflight tests/build/diff check pass, backup and remote lock succeed, PM2 restarts once, health and public verification pass, authenticated ecommerce verification passes, the 600-second canary keeps one stable PID, and the script prints `Deployed <commit> to https://shuimg.cn/`.

- [ ] **Step 8: Record final production evidence**

Update `.superpowers/sdd/progress.md` with the deployed commit, test count, bundle names, PM2 PID, authenticated visual model, exact provider-count result, billing reconciliation, stable Works URLs, Canvas/PSD verification and any residual external risks. Commit that ledger update separately.

## Plan Self-Review

- Spec coverage: Tasks 1–9 cover every section of the approved design in dependency order.
- Scope: each task creates one independently reviewable capability; Tasks 5 and 6 intentionally separate deterministic text from paid pixel layering.
- Type consistency: visual profiles enter the immutable orchestration snapshot before the plan; durable task summaries use the existing job/asset states; Canvas registry surfaces share one action ID set; composition revisions feed PSD export; retention reads those references.
- Cost safety: no hidden model upgrade, no Mock visual output, no unquoted assets, one repair per failed item, and production canaries stop before deployment on quota or reconciliation failure.
- Placeholder scan: no `TBD`, `TODO`, “implement later” or unspecified test step remains.
