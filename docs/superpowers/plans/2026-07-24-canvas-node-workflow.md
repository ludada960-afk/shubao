# Canvas Node Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas's temporary generation menu and image-only connections with a non-destructive, persistent e-commerce node workflow that supports smart remix, layer editing, and extensible processing nodes.

**Architecture:** Keep existing image assets backward-compatible, then normalize every canvas node into an explicit `kind`, `status`, `inputs`, and `output` shape. Use one action registry for context-menu and port-created child nodes. Integrate presentational workflow-node components through a narrow adapter in `EcCanvas/index.jsx`; keep real generation, layer analysis, persistence, and export in existing service/server boundaries.

**Tech Stack:** React 18, Vite, existing `react-icons`, Express, SQLite, Sharp, existing canvas state helpers, Node test runner.

## Global Constraints

- Do not modify or restore unrelated runtime changes in `server/works.db` or `dist/assets/Footer-*`.
- Do not introduce a second persistence store for canvas state.
- Do not display or implement “视频分镜生成” in the e-commerce canvas.
- Right-click actions and port actions must use the same action registry and node factory.
- Source images remain immutable; derived operations create child nodes.
- Do not claim real PSD export until independent pixel layers/masks are available.
- Preserve existing work/asset API compatibility and existing image-node data.
- Run focused tests before full build; do not deploy until build, API smoke tests, and data-preservation checks pass.

---

### Task 1: Establish the node and action model

**Files:**
- Create: `src/pages/EcCanvas/nodeWorkflow.js`
- Modify: `src/pages/EcCanvas/canvasState.js`
- Test: `test/canvasNodeWorkflow.test.mjs`

**Interfaces:**
- Produces `CANVAS_NODE_ACTIONS`, `normalizeCanvasNode`, `normalizeCanvasConnection`, `createDerivedNode`, `createChildConnection`, `isDerivedAction`, and `getActionById`.
- Consumes the current asset shape returned by `normalizeAsset` and the current `{ from, to, type }` connection shape.

- [ ] **Step 1: Write failing tests for backward-compatible normalization.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_NODE_ACTIONS,
  normalizeCanvasNode,
  normalizeCanvasConnection,
  createDerivedNode,
  createChildConnection,
  isDerivedAction,
} from '../src/pages/EcCanvas/nodeWorkflow.js';

test('legacy image assets normalize as image nodes', () => {
  const node = normalizeCanvasNode({ id: 'asset-1', url: '/a.png', x: 10, y: 20, w: 200, h: 200 });
  assert.equal(node.kind, 'image');
  assert.equal(node.status, 'ready');
  assert.equal(node.url, '/a.png');
});

test('legacy connections normalize without losing relation', () => {
  assert.deepEqual(normalizeCanvasConnection({ from: 'a', to: 'b', type: 'reference' }), {
    id: 'edge_a_b_reference',
    fromNodeId: 'a',
    fromPort: 'output',
    toNodeId: 'b',
    toPort: 'input',
    relation: 'reference',
  });
});

test('derived actions exclude video and create a child node', () => {
  assert.equal(CANVAS_NODE_ACTIONS.some(action => action.id === 'video'), false);
  assert.equal(isDerivedAction('smart-remix'), true);
  const child = createDerivedNode({ sourceNodeIds: ['asset-1'], actionId: 'smart-remix', x: 300, y: 100 });
  assert.equal(child.kind, 'smart-remix');
  assert.deepEqual(child.sourceNodeIds, ['asset-1']);
  assert.equal(child.status, 'draft');
  assert.equal(createChildConnection('asset-1', child.id, 'smart-remix').relation, 'derived');
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the model is absent.**

Run: `node --test test/canvasNodeWorkflow.test.mjs`
Expected: FAIL with the new module/functions not found.

- [ ] **Step 3: Implement the model without changing server persistence.**

`CANVAS_NODE_ACTIONS` must contain exactly these derived actions:

```js
export const CANVAS_NODE_ACTIONS = [
  { id: 'smart-remix', label: '智能二创', description: '解析原图描述，补充图片与文字后继续创作', nodeKind: 'smart-remix' },
  { id: 'layer-edit', label: '图层编辑', description: '拆分商品、人物、背景和文字并逐层调整', nodeKind: 'layer-workbench' },
  { id: 'inpaint', label: '局部改图', description: '框选区域，只修改需要调整的部分', nodeKind: 'inpaint' },
  { id: 'remove-bg', label: '商品抠图', description: '提取透明背景的商品素材', nodeKind: 'remove-bg' },
  { id: 'extend', label: '智能扩图', description: '扩展画面并适配新的投放比例', nodeKind: 'extend' },
  { id: 'translate', label: '图文翻译', description: '替换画面语言并尽量保持排版', nodeKind: 'translate' },
  { id: 'upscale', label: '高清修复', description: '提升清晰度、纹理和商品细节', nodeKind: 'upscale' },
];
```

`normalizeCanvasNode` must preserve unknown legacy fields and add:

```js
{
  kind: 'image',
  status: 'ready',
  sourceNodeIds: [],
  actionId: null,
  inputs: {},
  output: null,
}
```

`normalizeCanvasConnection` must accept both legacy and new shapes. `createDerivedNode` must create stable IDs using a timestamp/random suffix, preserve `x`, `y`, and set `w`/`h` defaults appropriate for a workflow card. `createChildConnection` must return the new edge shape while keeping `from`/`to`/`type` aliases for old consumers during migration.

- [ ] **Step 4: Update `canvasState.js` helpers to use the normalized edge fields while preserving legacy callers.**

`addConnection` must deduplicate based on normalized source, target, and relation. `removeConnectionsForNodes` must inspect both the new and legacy field names.

- [ ] **Step 5: Run tests and commit.**

Run: `node --test test/canvasNodeWorkflow.test.mjs`
Expected: PASS.

Commit: `git add src/pages/EcCanvas/nodeWorkflow.js src/pages/EcCanvas/canvasState.js test/canvasNodeWorkflow.test.mjs && git commit -m "feat: add persistent canvas node workflow model"`

### Task 2: Integrate reusable workflow UI nodes

**Files:**
- Create: `src/pages/EcCanvas/components/workflowNodes/` from the GLM branch output when available
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/canvasWorkflowIntegration.test.mjs`

**Interfaces:**
- Consumes the components' prop-driven interfaces: `CanvasNodeShell`, `CanvasPortHandle`, `CanvasNodeActionPicker`, `SmartRemixNodeCard`, `LayerWorkbenchNodeCard`, and `CompactProcessNodeCard`.
- Produces a single `renderCanvasNode` adapter and a single `openCanvasActionPicker` flow in `index.jsx`.

- [ ] **Step 1: Review GLM output without copying unrelated files.**

Verify only the agreed `workflowNodes` directory changed. If GLM has modified `index.jsx`, `canvasState.js`, services, server, package files, `dist`, or the database, stop and isolate those changes before integration.

- [ ] **Step 2: Add a focused pure integration test for action routing.**

```js
test('right click and port selection resolve through the same action factory', () => {
  const rightClick = resolveCanvasActionTarget({ actionId: 'smart-remix', sourceNodeId: 'a', x: 400, y: 120 });
  const portDrop = resolveCanvasActionTarget({ actionId: 'smart-remix', sourceNodeId: 'a', x: 400, y: 120 });
  assert.deepEqual({ ...rightClick, id: undefined }, { ...portDrop, id: undefined });
  assert.equal(rightClick.kind, 'smart-remix');
});
```

- [ ] **Step 3: Replace the current three-item generation menu with the shared action picker.**

Remove the current `reference/text/video` array and its special-case composer behavior. The picker must never render a video action. On selection, call one handler that creates a draft derived node at the requested position and a derived edge from the source.

- [ ] **Step 4: Extend `ImageNode` to expose a right output handle and a left input handle only where appropriate.**

The right handle is always the output/plus entry. It must be keyboard accessible and must not intercept image dragging except within its hit area. Hovering a node reveals the handle; focused/connected states remain visible.

- [ ] **Step 5: Render derived node cards from `node.kind`.**

Use the smart remix card for `smart-remix`, layer workbench for `layer-workbench`, and compact processing card for the remaining derived kinds. Unknown kinds render a safe compact fallback that preserves node metadata.

- [ ] **Step 6: Run integration tests and build.**

Run: `node --test test/canvasNodeWorkflow.test.mjs test/canvasWorkflowIntegration.test.mjs`
Expected: PASS.

Run: `npm run build`
Expected: build succeeds and no `video` action text is present in generated source.

- [ ] **Step 7: Commit.**

Commit: `git add src/pages/EcCanvas/index.jsx test/canvasWorkflowIntegration.test.mjs src/pages/EcCanvas/components/workflowNodes && git commit -m "feat: integrate canvas derived workflow nodes"`

### Task 3: Implement drag-to-blank action creation and canvas interaction states

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/canvasState.js`
- Test: `test/canvasConnectionFlow.test.mjs`

**Interfaces:**
- Consumes `createDerivedNode` and `createChildConnection` from Task 1.
- Produces a connection draft state with `{ sourceNodeId, sourcePort, pointer, actionId }` and a persistent child node after action selection.

- [ ] **Step 1: Add failing state transition tests.**

Test these transitions:

```js
startConnection({ nodeId: 'a', port: 'output' })
dropOnBlank({ x: 520, y: 180 })
selectAction('layer-edit')
```

Expected state: one new `layer-workbench` node at the drop point and one derived edge from `a` to that node.

Also test Esc/click-away cancellation and dropping on an existing input port without creating a new node.

- [ ] **Step 2: Implement the state transitions.**

The line follows the pointer while dragging. Dropping on blank space opens the picker at that world coordinate. Selecting an action immediately creates a draft node and edge, so the user sees a persistent object before any API work starts. Cancelling removes only the draft line/picker.

- [ ] **Step 3: Make background canvas dragging the default gesture.**

Blank primary-button drag must pan. Shift drag remains marquee selection. Node/port/input controls stop propagation. Wheel zoom remains cursor-centered. A completed child node must not change the viewport or push existing nodes off-screen.

- [ ] **Step 4: Add keyboard and pointer regression tests.**

Cover Enter, Escape, blank drag, Shift marquee, wheel zoom, port hit area, and pointer capture release.

- [ ] **Step 5: Run focused tests and commit.**

Run: `node --test test/canvasConnectionFlow.test.mjs`
Expected: PASS.

Commit: `git add src/pages/EcCanvas/index.jsx src/pages/EcCanvas/canvasState.js test/canvasConnectionFlow.test.mjs && git commit -m "feat: create canvas child nodes from blank-space connections"`

### Task 4: Connect smart remix and layer workbench to real API contracts

**Files:**
- Create: `src/services/canvasWorkflowApi.js`
- Modify: `src/services/api.js`
- Modify: `server/index.mjs`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/canvasWorkflowApi.test.mjs`

**Interfaces:**
- Produces `analyzeCanvasRemix`, `runCanvasRemix`, `analyzeCanvasLayerMasks`, `exportCanvasPsd`.
- Consumes the existing session email and existing `/api/canvas/*` conventions.

- [ ] **Step 1: Define request/response contracts in tests.**

Smart remix request:

```json
{
  "email": "...",
  "source_image": "...",
  "prompt": "...",
  "product_images": [],
  "reference_images": [],
  "instruction": "...",
  "output_count": 1,
  "ratio": "1:1"
}
```

Layer analysis response must distinguish analysis from real masks:

```json
{
  "ok": true,
  "status": "analyzed",
  "layers": [
    { "id": "layer-1", "kind": "product", "name": "商品主体", "preview_url": null, "mask_url": null, "editable": false }
  ],
  "capabilities": { "pixelLayers": false, "editableText": false, "psdExport": false }
}
```

- [ ] **Step 2: Add service wrappers with consistent error normalization.**

Each wrapper must throw an error carrying `status`, `code`, and `resumeable` when the server returns a structured error. No component may parse arbitrary error strings.

- [ ] **Step 3: Add server routes behind the existing beta access middleware.**

Do not bypass beta access or credits. The 867550189 internal account behavior must remain governed by the existing server rule. Save job state through the existing persistence path; do not introduce a second database.

- [ ] **Step 4: Make the smart remix node resumable.**

On insufficient credits or a transient error, keep prompt, images, source node, and selected options in node inputs. Show a modal/inline recovery state and allow retry without navigating away.

- [ ] **Step 5: Run API contract tests and the existing test suite.**

Run: `node --test test/canvasWorkflowApi.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit.**

Commit: `git add src/services/canvasWorkflowApi.js src/services/api.js server/index.mjs src/pages/EcCanvas/index.jsx test/canvasWorkflowApi.test.mjs && git commit -m "feat: add resumable canvas workflow API contracts"`

### Task 5: Build real layer masks and PSD export behind capability gates

**Files:**
- Create: `server/canvas/layerPipeline.mjs`
- Create: `server/canvas/psdExport.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/canvasWorkflowApi.js`
- Test: `test/canvasLayerPipeline.test.mjs`
- Modify: `package.json` only if the dependency spike proves a production-compatible PSD serializer is required

**Interfaces:**
- Produces `analyzeLayerPixels`, `writeCanvasPsd`, and `getLayerCapabilities`.
- Consumes source image URLs and model/mask service responses.

- [ ] **Step 1: Add capability and failure tests before enabling export.**

Test that a descriptive layer-only result returns `psdExport: false`, and that PSD export refuses missing pixel data instead of producing a fake file.

- [ ] **Step 2: Implement the pixel-layer contract.**

Each exportable layer must contain independent RGBA data or an RGBA source plus mask, bounds, z-order, visibility, opacity, and a stable name. Store generated masks and layer previews through the existing asset storage path with ownership checks.

- [ ] **Step 3: Implement PSD writing with an audited dependency.**

Run a small isolated compatibility test against the selected serializer in the production Node version. Do not add a dependency based only on its name. The output must reopen as a PSD and contain more than one layer with correct names and visibility.

- [ ] **Step 4: Add text-layer honesty rules.**

Only mark `editableText: true` when OCR text bounds and a supported font/style mapping are available. Otherwise expose text replacement as raster/inpainting editing and keep native PSD text disabled.

- [ ] **Step 5: Add export smoke tests using a tiny fixture.**

Assert output MIME/type, layer count, names, dimensions, and that source assets remain unchanged.

- [ ] **Step 6: Commit.**

Commit: `git add server/canvas server/index.mjs src/services/canvasWorkflowApi.js test/canvasLayerPipeline.test.mjs package.json package-lock.json && git commit -m "feat: add capability-gated canvas layer export"`

### Task 6: Persist, reload, and migrate canvas workflow nodes

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/services/api.js`
- Modify: `server/index.mjs`
- Modify: `test/canvasPersistence.test.mjs`

**Interfaces:**
- Consumes normalized nodes/edges from Task 1.
- Produces round-trip persistence that can load old works and new derived nodes without data loss.

- [ ] **Step 1: Add round-trip tests.**

Save a work containing one legacy image, one smart remix draft, one layer workbench, and two derived edges. Reload it and assert all IDs, positions, inputs, statuses, and source relationships survive.

- [ ] **Step 2: Add a read-time migration only.**

Old works are normalized when loaded. Do not rewrite every existing record in one migration. Save new schema fields on subsequent saves.

- [ ] **Step 3: Preserve soft-delete behavior.**

Deleting a node moves the work/asset to the existing trash/recovery path. It must not cascade-delete source assets or derived output files unless the existing retention policy explicitly does so.

- [ ] **Step 4: Run persistence tests and verify database hashes before/after local tests.**

Run: `node --test test/canvasPersistence.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit.**

Commit: `git add src/pages/EcCanvas/index.jsx src/services/api.js server/index.mjs test/canvasPersistence.test.mjs && git commit -m "feat: persist canvas workflow lineage"`

### Task 7: Full verification and deployment gate

**Files:**
- Modify only files already covered by previous tasks.
- Create: `docs/superpowers/reports/2026-07-24-canvas-node-workflow-verification.md`

- [ ] **Step 1: Run static checks and tests.**

Run:

```powershell
npm test
npm run build
npm run check
```

Expected: all commands exit 0.

- [ ] **Step 2: Start an isolated local server and run browser checks.**

Verify:

- blank drag pans the canvas;
- wheel zoom is cursor-centered;
- output port hover pulses;
- drag to blank space opens the action picker;
- video action is absent;
- selecting smart remix creates a persistent draft child node;
- source image remains unchanged;
- right-click and port picker create the same node kind;
- smart remix retains inputs on an error/credit modal;
- layer analysis accurately reports whether PSD is enabled;
- loading a legacy work does not fail;
- works/images still render after reload.

- [ ] **Step 3: Review the production diff.**

Confirm no changes to `server/works.db`, generated assets, unrelated pages, or deployment configuration are included. Confirm the production database backup/hash is captured before deployment.

- [ ] **Step 4: Deploy only after the gate passes.**

Build from the reviewed commit, create a server-side backup of the current deployed assets and database, upload the build/server files atomically, reload the process, and verify:

- HTTPS responds 200;
- SPA refresh does not 404;
- `/api/health` responds;
- canvas page loads without blank state;
- existing works and images load;
- old image assets can still be opened;
- new node creation does not throw browser or server errors.

- [ ] **Step 5: Write and commit the verification report.**

The report must contain commit SHA, test output summary, browser checks, deployment timestamp, rollback artifact locations, and any capability-gated features that are intentionally disabled.

Commit: `git add docs/superpowers/reports/2026-07-24-canvas-node-workflow-verification.md && git commit -m "docs: record canvas workflow verification"`

## Self-review checklist

- [ ] The design has one action registry for right-click and port creation.
- [ ] The video action is removed from the e-commerce canvas.
- [ ] Legacy assets and edges remain readable.
- [ ] Smart remix is a persistent editable child node, not a transient composer.
- [ ] Layer analysis does not pretend to be pixel layers or PSD export.
- [ ] PSD export is capability-gated and independently testable.
- [ ] Source images remain immutable and derived nodes are non-destructive.
- [ ] Credit errors preserve user inputs and support retry.
- [ ] Blank canvas dragging and wheel zoom have regression coverage.
- [ ] Deployment includes data backup, SPA refresh, image loading, and rollback checks.
