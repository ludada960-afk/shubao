# Canvas Real Segmentation And Automatic Layering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace semantic-only Canvas background removal and layer workbenches with pixel-faithful multi-product removal and automatic movable image/text layers.

**Architecture:** A server-only SAM 3 provider returns scored masks from VLM-validated product boxes. A focused layering service validates and converts masks into owned, tightly cropped original-pixel assets, unions grouped products and optionally requests one clean background plate. Canvas materializes the returned layers directly as ordinary connected image and text nodes.

**Tech Stack:** Node.js 22 fetch/FormData, Sharp, existing ecommerce VLM and image-edit gateways, React 18, Vite, Node test runner, fal.ai SAM 3.

## Global Constraints

- Work only in `F:/da/shubao/.worktrees/codex-ecommerce-stability` on `codex/ecommerce-stability`.
- Keep the 12 user-owned deleted `server/extension_tasks` files and `.tmp/` untouched.
- Use explicit Git paths; never `git add .` or `git add -A`.
- `FAL_KEY` and `SHUBAO_FAL_KEY` never enter source, fixtures, logs or commits.
- Product layers contain original source pixels only; generative reconstruction is limited to the background clean plate.
- Semantic labels without a persisted mask asset are never advertised as movable layers.
- New Smart Layer actions never create `layer-workbench`; legacy saved workbenches remain readable.
- Production deployment uses only `scripts/deploy-production.ps1`.

---

### Task 1: SAM 3 Provider Boundary

**Files:**
- Create: `server/falSegmentationClient.mjs`
- Create: `test/fal-segmentation-client.test.mjs`

**Interfaces:**
- Consumes: `fetch`, `FAL_KEY`, source data URL or owned URL, pixel box prompts.
- Produces: `createFalSegmentationClient({ apiKey, fetchImpl, timeoutMs }).segment({ imageUrl, prompts, maxMasks }) -> { masks, metadata, requestId }`.

- [ ] **Step 1: Write failing provider tests**

```js
test('submits bounded box prompts without exposing credentials', async () => {
  const client = createFalSegmentationClient({ apiKey: 'test-key', fetchImpl });
  const result = await client.segment({
    imageUrl: 'data:image/png;base64,AA==',
    prompts: [{ id: 'box-1', box: [10, 20, 80, 90] }],
    maxMasks: 4,
  });
  assert.equal(result.masks.length, 1);
  assert.equal(request.headers.Authorization, 'Key test-key');
  assert.deepEqual(request.body.box_prompts[0], {
    x_min: 10, y_min: 20, x_max: 80, y_max: 90, object_id: 1,
  });
});
```

Cover missing key, timeout/abort, non-2xx response, malformed URLs, mask-count limits and provider error redaction.

- [ ] **Step 2: Run the provider tests and observe failure**

Run: `node --test test/fal-segmentation-client.test.mjs`

Expected: FAIL because `server/falSegmentationClient.mjs` does not exist.

- [ ] **Step 3: Implement the minimal provider**

```js
export function createFalSegmentationClient({
  apiKey = process.env.FAL_KEY || '',
  fetchImpl = fetch,
  timeoutMs = 45_000,
} = {}) {
  return {
    async segment({ imageUrl, prompts = [], maxMasks = 8 } = {}) {
      // Validate input, POST to fal-ai/sam-3/image, bound timeout and
      // normalize masks/metadata without returning credentials.
    },
  };
}
```

Use direct HTTPS so no browser dependency or new client package is required.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/fal-segmentation-client.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit explicit files**

```powershell
git add server/falSegmentationClient.mjs test/fal-segmentation-client.test.mjs
git commit -m "feat: add canvas segmentation provider"
```

### Task 2: Semantic Plan And Pixel-Faithful Layer Service

**Files:**
- Create: `server/canvasLayeringService.mjs`
- Modify: `server/canvasTools.mjs`
- Modify: `server/canvasSegmentation.mjs`
- Create: `test/canvas-layering-service.test.mjs`
- Modify: `test/canvas-tools.test.mjs`

**Interfaces:**
- Consumes: source buffer, validated semantic plan, SAM masks, `generatedAssetStore`, optional `createBackgroundCleanPlate`.
- Produces: `createCanvasLayeringService(deps).removeBackground(input)` and `.createLayers(input)` with the API structures in the approved spec.

- [ ] **Step 1: Write failing semantic-plan and mask tests**

```js
test('keeps three valid merchant instances and rejects a plate prop', () => {
  const plan = normalizeCanvasLayerPlan(rawPlan);
  assert.deepEqual(plan.instances.map(item => item.id), ['gray-box', 'blue-box', 'orange-box']);
});

test('creates tight original-pixel assets and a grouped union', async () => {
  const result = await service.createLayers({ sourceBuffer, semanticPlan, masks });
  assert.equal(result.capabilities.productInstances, 3);
  assert.equal(result.layers.filter(layer => layer.semanticType === 'product-instance').length, 3);
  assert.ok(result.layers.some(layer => layer.semanticType === 'product-group'));
});
```

Add deterministic Sharp fixtures for IoU deduplication, nested-mask rejection, non-zero alpha, union bounds, crop geometry, over-98% rejection, under-0.5% rejection and partial clean-plate failure.

- [ ] **Step 2: Run the service tests and observe failure**

Run: `node --test test/canvas-layering-service.test.mjs test/canvas-tools.test.mjs`

Expected: FAIL on missing plan normalizer and layer service.

- [ ] **Step 3: Implement small pure helpers**

```js
export function normalizeCanvasLayerPlan(raw = {}, { maxInstances = 8, maxTextBlocks = 20 } = {}) {}
export function maskIntersectionOverUnion(left, right) {}
export async function normalizeSegmentationMask(maskBuffer, { width, height }) {}
export async function compositeMaskedAsset(sourceBuffer, mask, bounds) {}
```

Keep image math in `canvasSegmentation.mjs`; keep orchestration and persistence in `canvasLayeringService.mjs`.

- [ ] **Step 4: Implement removal and automatic layering**

```js
const service = createCanvasLayeringService({
  visionClient,
  segmentationClient,
  generatedAssetStore,
  imageInputReader,
  createBackgroundCleanPlate,
});

await service.removeBackground({ imageUrl, ownerEmail, signal });
await service.createLayers({ imageUrl, ownerEmail, signal });
```

Use the VLM only for merchant semantics and OCR geometry. Persist every accepted PNG before returning. Return partial capabilities when clean-plate creation alone fails.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/canvas-layering-service.test.mjs test/canvas-tools.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit explicit files**

```powershell
git add server/canvasLayeringService.mjs server/canvasTools.mjs server/canvasSegmentation.mjs test/canvas-layering-service.test.mjs test/canvas-tools.test.mjs
git commit -m "feat: create real canvas pixel layers"
```

### Task 3: Signed Routes, Billing And Production Configuration

**Files:**
- Modify: `server/index.mjs`
- Modify: `server/generationRouteGuard.mjs`
- Modify: `scripts/deploy-production.ps1`
- Modify: `test/canvas-generation-contract.test.mjs`
- Modify: `test/generation-route-guard.test.mjs`
- Modify: `test/deploy-script.test.mjs`

**Interfaces:**
- Consumes: Task 2 service, signed ecommerce owner, existing quote/action metadata.
- Produces: truthful `/api/remove-bg` and `/api/canvas/analyze-layers` responses plus remote `FAL_KEY` configuration sourced from local `SHUBAO_FAL_KEY`.

- [ ] **Step 1: Write failing route/configuration tests**

```js
assert.match(removeRoute, /canvasLayeringService\.removeBackground/);
assert.match(layerRoute, /canvasLayeringService\.createLayers/);
assert.doesNotMatch(layerRoute, /segmentUniformBackground/);
assert.match(deployScript, /FAL_KEY\s*=\s*\$env:SHUBAO_FAL_KEY/);
```

Also assert owner authentication, billing settlement on persisted layers, billing release on provider failure and no provider URL leakage.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test test/canvas-generation-contract.test.mjs test/generation-route-guard.test.mjs test/deploy-script.test.mjs`

Expected: FAIL because routes still call `segmentUniformBackground` and deployment does not forward `FAL_KEY`.

- [ ] **Step 3: Replace route internals**

Instantiate the provider and layer service next to existing ecommerce gateways. Preserve response compatibility fields for remove-background, remove the semantic-only layer mapping, and settle billing only after owned assets exist.

- [ ] **Step 4: Add deployment preflight and remote environment mapping**

`scripts/deploy-production.ps1` must fail before mutation when real segmentation is enabled but `SHUBAO_FAL_KEY` is absent, and must pass only `FAL_KEY` to PM2 without printing it.

- [ ] **Step 5: Run focused tests and syntax checks**

Run: `node --test test/canvas-generation-contract.test.mjs test/generation-route-guard.test.mjs test/deploy-script.test.mjs`

Run: `node --check server/falSegmentationClient.mjs; node --check server/canvasLayeringService.mjs; node --check server/index.mjs`

Expected: PASS.

- [ ] **Step 6: Commit explicit files**

```powershell
git add server/index.mjs server/generationRouteGuard.mjs scripts/deploy-production.ps1 test/canvas-generation-contract.test.mjs test/generation-route-guard.test.mjs test/deploy-script.test.mjs
git commit -m "feat: expose automatic canvas layering"
```

### Task 4: Materialize Layers As Canvas Nodes

**Files:**
- Modify: `src/pages/EcCanvas/canvasActionRegistry.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/canvasStudioModel.js`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Modify: `test/canvas-action-registry.test.mjs`
- Modify: `test/canvas-entry-ui.test.mjs`
- Modify: `test/ec-canvas-state.test.mjs`

**Interfaces:**
- Consumes: Task 3 `layers[]`, `capabilities`, `warnings`, stable owned URLs and normalized bounds.
- Produces: ordinary connected Canvas image/text children and processing/error state on the source.

- [ ] **Step 1: Write failing Canvas contracts**

```js
assert.doesNotMatch(registry, /create:layer-edit/);
assert.doesNotMatch(registry, /nodeKind:\s*'layer-workbench'/);
assert.match(canvas, /materializeCanvasLayers/);
assert.match(canvas, /semanticType === 'text'/);
```

Add pure-model tests for deterministic fan-out placement, tight image aspect ratio, text-node construction, one edge per child, partial warnings and idempotent retry keys.

- [ ] **Step 2: Run tests and observe failure**

Run: `node --test test/canvas-action-registry.test.mjs test/canvas-entry-ui.test.mjs test/ec-canvas-state.test.mjs`

Expected: FAIL because Smart Layering still creates a workbench node.

- [ ] **Step 3: Add pure materialization helpers**

```js
export function materializeCanvasLayers({ source, layers, gap = 28 }) {
  return { nodes, connections };
}
```

Image child geometry comes from tight asset dimensions/bounds. Text children use the normal editable text node model. Placement is stable and avoids overlap with the source and prior siblings.

- [ ] **Step 4: Replace the interaction path**

Run analysis directly from the selected source, show an in-place processing state, append all valid children atomically, select the grouped product output, display partial warnings once, and keep legacy workbench rendering only for restored sessions.

- [ ] **Step 5: Run focused Canvas tests**

Run: `node --test test/canvas-action-registry.test.mjs test/canvas-entry-ui.test.mjs test/ec-canvas-state.test.mjs test/canvas-studio-contract.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit explicit files**

```powershell
git add src/pages/EcCanvas/canvasActionRegistry.js src/pages/EcCanvas/index.jsx src/pages/EcCanvas/canvasStudioModel.js src/pages/EcCanvas/EcCanvas.css test/canvas-action-registry.test.mjs test/canvas-entry-ui.test.mjs test/ec-canvas-state.test.mjs
git commit -m "feat: materialize canvas layers automatically"
```

### Task 5: Real Three-Container Acceptance And Release Closure

**Files:**
- Create: `scripts/verify-canvas-segmentation.mjs`
- Modify: `test/api-contract.test.mjs`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: local or production base URL, signed owner token, `SHUBAO_FAL_KEY`, supplied three-container source.
- Produces: machine-readable evidence for grouped/individual masks, transparency, persisted URLs and Canvas save/reload.

- [ ] **Step 1: Write the verifier contract test**

Assert the verifier uploads the supplied image, calls remove-background and Smart Layering, decodes every returned PNG, checks alpha coverage, requires one group plus at least three product instances, and redacts authentication/provider secrets.

- [ ] **Step 2: Implement the verifier**

```js
await verifyCanvasSegmentation({
  baseUrl,
  token,
  imagePath,
  expectedInstances: 3,
});
```

The verifier must fail on opaque copies, missing instances, external provider URLs, undecodable assets or unstable post-reload URLs.

- [ ] **Step 3: Run focused and complete regression**

Run: `node --test test/fal-segmentation-client.test.mjs test/canvas-layering-service.test.mjs test/canvas-tools.test.mjs test/canvas-action-registry.test.mjs test/canvas-entry-ui.test.mjs test/ec-canvas-state.test.mjs test/api-contract.test.mjs`

Run: `npm test`

Run: `npm run build`

Run: `npm run collab:check`

Run from the repository root: `git -c safe.directory=F:/da/shubao/.worktrees/codex-ecommerce-stability -C .worktrees/codex-ecommerce-stability diff --check`

Expected: all commands pass.

- [ ] **Step 4: Run real provider acceptance with the supplied image**

Run: `node scripts/verify-canvas-segmentation.mjs --image "C:/Users/SHEJI/AppData/Local/Temp/codex-clipboard-4b6d1734-6028-42de-b8e2-9f2326fcf643.webp" --expected-instances 3`

Expected: transparent grouped product, at least three independent product assets, truthful clean-plate/text capability flags, all owned stable URLs.

- [ ] **Step 5: Browser QA at desktop and mobile widths**

Exercise Smart Layer and Remove Background on `?qa=ec-canvas`; verify automatic fan-out, drag, resize, delete, retry, edges, save/reload, no stale workbench and no overlaps.

- [ ] **Step 6: Review and commit explicit files**

Run a correctness/security review, fix findings, update `.superpowers/sdd/progress.md`, then stage only owned implementation/test/docs files and commit with `feat: complete real canvas layering`.

- [ ] **Step 7: Deploy and verify production**

Run only `scripts/deploy-production.ps1`, then run the authenticated ecommerce verifier and the new segmentation verifier against `https://shuimg.cn`. On any critical failure, stop and use the deployment script's rollback path.
