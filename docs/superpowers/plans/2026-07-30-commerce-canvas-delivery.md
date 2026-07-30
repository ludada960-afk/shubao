# Commerce Canvas and Image Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver fast responsive image loading and a persistent, fluid e-commerce canvas with recoverable generation states.

**Architecture:** Add a server-owned image derivative service and a client URL helper so every list/card requests the appropriate media size. Replace DOM-measured edge geometry with pure node-rectangle geometry and animation-frame drag updates, while keeping the existing commerce workflow model. Persist drafts locally and remotely, arrange imported outputs into role lanes, and map generation failures to safe actionable states.

**Tech Stack:** Node.js, Express, Sharp, React 18, Vite, Node test runner, existing SQLite/session APIs.

## Global Constraints

- Stable local generated assets must not traverse the remote image proxy.
- Do not introduce video or generic workflow capabilities absent from the product.
- Do not expose provider payloads, credentials, stack traces, or `undefined` to users.
- Image cards preserve their source aspect ratio and use `object-fit: contain`.
- Default edges are unlabeled; labels are an explicit selected-edge affordance only.
- Existing billing and quality gates continue to protect credit settlement.
- All modified behavior receives targeted automated coverage.

---

### Task 1: Add derivative image delivery

**Files:**
- Create: `server/imageDelivery.mjs`
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Test: `test/image-delivery.test.mjs`

**Interfaces:**
- Produces `createImageDelivery({ assetRoot, proxyCacheRoot, fetchImpl })` with `serveGeneratedVariant(req, res)` and `serveProxyVariant(req, res)`.
- Produces `imageVariantUrl(input, variant)` for `thumb`, `canvas`, and `full`.

- [ ] **Step 1: Write failing delivery tests**

```js
assert.equal(imageVariantUrl('/api/generated-assets/a', 'thumb'), '/api/generated-assets/a?variant=thumb');
assert.equal(await delivery.readVariant('asset-a', 'thumb').then(file => file.format), 'webp');
assert.equal(fetchCount, 1); // concurrent cold proxy requests coalesce
```

- [ ] **Step 2: Run the targeted test and verify failure**

Run: `node --test test/image-delivery.test.mjs`
Expected: FAIL because `imageVariantUrl` and `createImageDelivery` do not exist.

- [ ] **Step 3: Implement delivery service and endpoints**

```js
const VARIANTS = { thumb: { width: 360, quality: 74 }, canvas: { width: 960, quality: 82 } };
const pending = new Map();
export function imageVariantUrl(url, variant = 'full') {
  if (variant === 'full' || !url || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}variant=${variant}`;
}
```

Generate and cache WebP derivatives by source hash, use immutable cache headers for generated assets, preserve SSRF validation in proxying, and map external sources to a variant endpoint instead of returning the source original.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/image-delivery.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/imageDelivery.mjs server/index.mjs src/services/api.js test/image-delivery.test.mjs
git commit -m "feat: add responsive image delivery variants"
```

### Task 2: Apply image loading policy to works and canvas

**Files:**
- Create: `src/components/ResponsiveImage.jsx`
- Modify: `src/pages/Works/index.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/image-view-policy.test.mjs`

**Interfaces:**
- Consumes `imageVariantUrl`.
- Produces `ResponsiveImage({ src, variant, alt, priority, ratio, className })`.

- [ ] **Step 1: Write failing component-policy tests**

```js
assert.match(source, /loading=\{priority \? 'eager' : 'lazy'\}/);
assert.match(source, /decoding="async"/);
assert.match(source, /variant="thumb"/);
assert.match(canvasSource, /variant="canvas"/);
```

- [ ] **Step 2: Run targeted test and verify failure**

Run: `node --test test/image-view-policy.test.mjs`
Expected: FAIL because the shared component is absent.

- [ ] **Step 3: Implement aspect-ratio placeholders and viewport-safe media**

```jsx
<img src={imageVariantUrl(src, variant)} loading={priority ? 'eager' : 'lazy'}
  decoding="async" fetchPriority={priority ? 'high' : 'auto'} alt={alt} />
```

Use `thumb` for grids and `canvas` for cards. Keep only above-fold work cards eager, and remove direct `proxyImg` use from card markup.

- [ ] **Step 4: Run targeted tests and production build**

Run: `node --test test/image-view-policy.test.mjs && npm run build`
Expected: PASS and Vite build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResponsiveImage.jsx src/pages/Works/index.jsx src/pages/EcCanvas/index.jsx test/image-view-policy.test.mjs
git commit -m "feat: apply responsive media policy"
```

### Task 3: Make canvas geometry synchronous and role-aware

**Files:**
- Create: `src/pages/EcCanvas/canvasGeometry.js`
- Modify: `src/pages/EcCanvas/canvasSessionModel.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Test: `test/canvas-geometry.test.mjs`
- Test: `test/canvas-session-model.test.mjs`

**Interfaces:**
- Produces `getNodePortCenter(node, side)`, `edgePath(edge, nodesById)`, and `layoutAssetLanes({ sourceNode, assets })`.
- `createFreshCanvasSession` consumes the lane layout and produces geometry with no default edge label.

- [ ] **Step 1: Write failing geometry and lane tests**

```js
assert.deepEqual(getNodePortCenter({ x: 10, y: 20, w: 200, h: 100 }, 'output'), { x: 210, y: 70 });
assert.equal(layout.nodes.filter(node => node.group === '主图')[0].y,
  layout.nodes.filter(node => node.group === '主图')[1].y);
assert.equal(session.connections.every(edge => !edge.label), true);
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run: `node --test test/canvas-geometry.test.mjs test/canvas-session-model.test.mjs`
Expected: FAIL because geometry and lane layout do not exist.

- [ ] **Step 3: Implement pure geometry and category lanes**

```js
export function getNodePortCenter(node, side = 'output') {
  return { x: node.x + (side === 'output' ? node.w : 0), y: node.y + node.h / 2 };
}
export function layoutAssetLanes({ sourceNode, assets }) {
  const lanes = ['主图', '详情图', 'SKU', '素材'];
  return lanes.flatMap((group, row) => assets.filter(asset => asset.group === group)
    .map((asset, column) => ({ ...asset, x: sourceNode.x + sourceNode.w + 180 + column * 276, y: 72 + row * 390 })));
}
```

Remove viewport-dependent `ResizeObserver` port computation for fixed media nodes. Derive edges from this model and reserve `ResizeObserver` only for dynamic workflow card height changes.

- [ ] **Step 4: Throttle movement at animation-frame cadence**

```js
const scheduleNodeDelta = delta => {
  pendingDeltaRef.current = delta;
  if (!dragFrameRef.current) dragFrameRef.current = requestAnimationFrame(flushDragFrame);
};
```

Make the visual and edge state update inside `flushDragFrame`, cancel the pending frame on pointer up/unmount, and memoize node views.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/canvas-geometry.test.mjs test/canvas-session-model.test.mjs test/canvas-port-geometry.test.mjs && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/EcCanvas/canvasGeometry.js src/pages/EcCanvas/canvasSessionModel.js src/pages/EcCanvas/index.jsx test/canvas-geometry.test.mjs test/canvas-session-model.test.mjs
git commit -m "feat: synchronize canvas geometry and asset lanes"
```

### Task 4: Rebuild canvas entry, inspection, and draft persistence

**Files:**
- Create: `src/pages/EcCanvas/canvasDraftRepository.js`
- Create: `src/pages/EcCanvas/components/CanvasEmptyState.jsx`
- Create: `src/pages/EcCanvas/components/CanvasImageLightbox.jsx`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/canvasWorkModel.js`
- Test: `test/canvas-draft-repository.test.mjs`
- Test: `test/canvas-entry-ui.test.mjs`

**Interfaces:**
- Produces `loadDraft(key)`, `saveDraft(key, snapshot)`, and `clearDraft(key)`.
- Canvas entry accepts imported works or local files with roles `product_original`, `style_reference`, `general_material`.

- [ ] **Step 1: Write failing persistence and entry tests**

```js
saveDraft('work-1', snapshot);
assert.deepEqual(loadDraft('work-1'), snapshot);
assert.match(source, /双击画布导入商品素材/);
assert.match(source, /product_original/);
assert.match(source, /CanvasImageLightbox/);
```

- [ ] **Step 2: Run targeted tests and verify failure**

Run: `node --test test/canvas-draft-repository.test.mjs test/canvas-entry-ui.test.mjs`
Expected: FAIL because no repository or entry component exists.

- [ ] **Step 3: Implement local-first draft synchronization**

```js
export function saveDraft(key, snapshot) {
  localStorage.setItem(`sb.canvas.draft.${key}`, JSON.stringify(snapshot));
}
```

Save after an interaction debounce, restore before creating a fresh session, and queue existing remote session save without blocking pointer interaction.

- [ ] **Step 4: Implement source roles, hover focus, contextual controls, and full inspection**

Add a compact import sheet, only present workflows eligible for the selected role, dim unrelated nodes on hover, keep default edges unlabeled, and open `CanvasImageLightbox` on double-click.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test test/canvas-draft-repository.test.mjs test/canvas-entry-ui.test.mjs test/canvas-work-import.test.mjs && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/EcCanvas test/canvas-draft-repository.test.mjs test/canvas-entry-ui.test.mjs
git commit -m "feat: add persistent guided commerce canvas"
```

### Task 5: Make generation failures safe and actionable

**Files:**
- Create: `src/pages/EcCanvas/generationStatusModel.js`
- Modify: `src/services/api.js`
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `server/ecommerceEngine/orchestrator.mjs`
- Test: `test/canvas-generation-status.test.mjs`
- Test: `test/ecommerce-orchestrator.test.mjs`

**Interfaces:**
- Produces `toGenerationStatus(task)` returning `{ tone, title, detail, retryable, action }`.
- Server produces a client-safe generation error code and message only.

- [ ] **Step 1: Write failing status mapping tests**

```js
assert.deepEqual(toGenerationStatus({ status: 'needs_review' }).action, 'retry');
assert.doesNotMatch(toGenerationStatus({ error: 'Vision API key invalid' }).detail, /API|key|invalid/i);
```

- [ ] **Step 2: Run targeted test and verify failure**

Run: `node --test test/canvas-generation-status.test.mjs test/ecommerce-orchestrator.test.mjs`
Expected: FAIL because the status mapper is absent.

- [ ] **Step 3: Implement safe server/client state mapping**

```js
const SAFE_FAILURE = { provider_unavailable: '视觉服务暂时不可用，未扣除本次积分，可稍后重试。' };
```

Retain internal reason codes for billing and logs, return only safe messages, and give `needs_review` a preview/retry/keep-material route rather than an opaque raw error.

- [ ] **Step 4: Run targeted tests and build**

Run: `node --test test/canvas-generation-status.test.mjs test/ecommerce-orchestrator.test.mjs && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/EcCanvas/generationStatusModel.js src/pages/EcCanvas/index.jsx src/services/api.js server/ecommerceEngine/orchestrator.mjs test/canvas-generation-status.test.mjs test/ecommerce-orchestrator.test.mjs
git commit -m "fix: present recoverable generation states safely"
```

### Task 6: Verify and deploy

**Files:**
- Modify: `test/image-delivery.test.mjs`, `test/canvas-geometry.test.mjs`, or `test/canvas-generation-status.test.mjs` only when an observed verification failure proves the relevant written contract is incomplete.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run production build and static checks**

Run: `npm run build && npm run check && npm run collab:check`
Expected: all commands exit 0.

- [ ] **Step 3: Run visual and interaction regression**

Run the local app at desktop and mobile viewports. Verify initial import, work import, generated lane layout, 24-node drag, edge endpoint attachment, double-click inspection, image lazy loading, reload persistence, and safe failed-task messaging.

- [ ] **Step 4: Deploy and verify production**

Deploy using the existing production workflow, verify the production URL, then run a smoke test against image variants and a saved canvas session.

- [ ] **Step 5: Commit final verification corrections**

```bash
git add test/image-delivery.test.mjs test/canvas-geometry.test.mjs test/canvas-generation-status.test.mjs
git commit -m "test: verify commerce canvas redesign"
```
