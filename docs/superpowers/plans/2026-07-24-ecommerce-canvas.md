# 电商无限画布重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `EcCanvas` 升级为可管理电商资产、支持多选/框选/端口连线/详情合并/方案二次编辑的生产画布，并部署到 `https://shuimg.cn`。

**Architecture:** 保留现有 React + Vite + 自定义 viewport 画布，不引入第三方画布库。先把资产命名、分组、选择、移动和连接关系抽成纯函数，再把单体页面拆成清晰的画布组件和面板组件；真实 API 继续复用，所有生成结果通过 `sourceDirectionId` 和 `connections` 保留来源链路。

**Tech Stack:** React 18, Vite 6, `react-icons`, Node test runner, PM2, PowerShell deployment script.

## Global Constraints

- 画布节点必须包含 `id/assetId/url/name/group/role/ratio/usage/sourceKey/editable/x/y/w/h`。
- 分组只能使用 `主图`、`详情图`、`SKU`、`素材`。
- 连线只能从可见端口创建，关系类型为 `reference`、`variant` 或 `merge`。
- 拖动节点不得改变连接关系。
- 不渲染左侧固定悬浮工具栏；只保留一组缩放控件。
- 没有真实后端能力的操作不得伪装成可用按钮。

---

### Task 1: 建立资产模型与画布纯函数

**Files:**
- Modify: `src/pages/EcCanvas/canvasState.js`
- Modify: `test/ec-canvas-state.test.mjs`
- Modify: `src/pages/EcCanvas/index.jsx:1-130`

**Interfaces:**
- `normalizeAsset(input, index): AssetNode`
- `getAssetMeta(sourceKey): { name, group, role, ratio, usage }`
- `selectNodesInRect(nodes, rect): string[]`
- `moveSelectedNodes(nodes, selectedIds, dx, dy): AssetNode[]`
- `addConnection(connections, from, to, type): Connection[]`
- `removeConnectionsForNodes(connections, ids): Connection[]`
- `canStitch(nodes, selectedIds): boolean`

- [ ] **Step 1: Write failing pure-function tests**

```js
test('normalizes ecommerce asset names and groups', () => {
  const node = normalizeAsset({ key: 'detail_slice_size', url: '/size.png' }, 0);
  assert.equal(node.name, '尺寸标注图-01');
  assert.equal(node.group, '详情图');
  assert.equal(node.role, '尺寸标注图');
  assert.equal(node.editable, true);
});

test('marquee selection includes intersecting nodes only', () => {
  const nodes = [
    { id: 'a', x: 10, y: 10, w: 100, h: 100 },
    { id: 'b', x: 300, y: 300, w: 100, h: 100 },
  ];
  assert.deepEqual(selectNodesInRect(nodes, { x: 0, y: 0, w: 150, h: 150 }), ['a']);
});

test('moving a selection preserves unrelated node positions and connections', () => {
  const nodes = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 300, y: 300 }];
  const moved = moveSelectedNodes(nodes, new Set(['a']), 20, 30);
  assert.deepEqual(moved[0], { id: 'a', x: 30, y: 40 });
  assert.deepEqual(moved[1], { id: 'b', x: 300, y: 300 });
});

test('connections are deduplicated and removed with deleted nodes', () => {
  const edge = addConnection([], 'a', 'b', 'reference');
  assert.deepEqual(addConnection(edge, 'a', 'b', 'reference'), edge);
  assert.deepEqual(removeConnectionsForNodes(edge, new Set(['a'])), []);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --test-name-pattern="normalizes ecommerce|marquee selection|moving a selection|connections are deduplicated"`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the pure functions**

Use a single `ASSET_META` map in `canvasState.js`, map legacy `规格` to `SKU`, map legacy `详情` to `详情图`, and use a per-role counter in `normalizeAsset` to produce stable `role-01` names. Use rectangle intersection for marquee selection and return new arrays from movement/connection helpers.

- [ ] **Step 4: Update `parseImages` and `autoLayout`**

Make `parseImages` call `normalizeAsset`; make `autoLayout` group in this order: `主图`, `详情图`, `SKU`, `素材`. Each node must carry `assetId`, `name`, `role`, `sourceKey`, `editable`, and `displayLabel: name`.

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- --test-name-pattern="normalizes ecommerce|marquee selection|moving a selection|connections are deduplicated"`

Expected: PASS.

- [ ] **Step 6: Commit the model layer**

```bash
git add src/pages/EcCanvas/canvasState.js src/pages/EcCanvas/index.jsx test/ec-canvas-state.test.mjs
git commit -m "feat: add ecommerce canvas asset model"
```

### Task 2: Replace single-node interaction with marquee, batch movement, and ports

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx:100-620`
- Modify: `src/pages/EcCanvas/ContextMenu.jsx`

**Interfaces:**
- `ImageNode` accepts `selected`, `multiSelected`, `onToggleSelect`, `onPortPointerDown`, `onPortPointerUp`.
- `ConnectionLines` renders `connection.type` labels and uses the node map for coordinates.
- Canvas pointer handlers maintain `{mode:'pan'|'marquee'|'drag'|'connect', ...}`.

- [ ] **Step 1: Add pointer-mode tests to `test/ec-canvas-state.test.mjs`**

```js
test('port connections use explicit semantic types', () => {
  const connections = addConnection([], 'source', 'target', 'variant');
  assert.deepEqual(connections[0], { from: 'source', to: 'target', type: 'variant' });
});
```

- [ ] **Step 2: Implement selection state**

Replace `panning`, `dragging`, and `shiftLinking` with a pointer-mode ref/state. On canvas pointer down with a small movement start pan; with Ctrl/Cmd start marquee; on node pointer down select or toggle; when a selection is dragged, calculate the world-space delta and call `moveSelectedNodes` for all selected IDs.

- [ ] **Step 3: Render the marquee rectangle**

Render a fixed overlay inside the canvas using the normalized screen rectangle converted to world coordinates. On pointer up call `selectNodesInRect` and preserve existing selection when Ctrl/Cmd is held.

- [ ] **Step 4: Render explicit ports**

Add small circular left/right ports to every selected node. Port pointer down starts a connection draft; port pointer up on another node creates a `reference` edge by default. A small edge-type chooser (`引用素材`, `生成变体`, `合并产物`) appears while connecting. Do not attach handlers to the node body.

- [ ] **Step 5: Render and remove semantic edges**

Update `ConnectionLines` to draw `reference` as solid purple, `variant` as dashed indigo, and `merge` as solid dark gray, with a small label at the midpoint. Clicking an edge selects it; Delete removes it. Deleting a node calls `removeConnectionsForNodes`.

- [ ] **Step 6: Add keyboard and batch toolbar behavior**

Make Ctrl/Cmd+A select all nodes, Escape clear selection/draft, Delete remove selected nodes, and batch toolbar show selected count, download, classify, merge and delete actions. Keep `handleStitch` restricted to selected `详情图` nodes.

- [ ] **Step 7: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add src/pages/EcCanvas/index.jsx src/pages/EcCanvas/ContextMenu.jsx test/ec-canvas-state.test.mjs
git commit -m "feat: add ecommerce canvas multi-select and ports"
```

### Task 3: Make asset classification, renaming, batch merge, and direction re-editable

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/ContextMenu.jsx`
- Modify: `src/services/api.js` only if an existing helper needs a typed wrapper

**Interfaces:**
- `renameNode(id, name): void`
- `reclassifyNodes(ids, group): void`
- `createMergedNode(sourceNodes, result): AssetNode`
- `directionDraft: { id, title, purpose, composition, copy, ratio, platform, references, params }`

- [ ] **Step 1: Add asset metadata controls**

Add a compact inspector for the active selection with editable name input, group select (`主图`, `详情图`, `SKU`, `素材`), role label, ratio and usage. Save on Enter/blur and show a success toast.

- [ ] **Step 2: Add batch classification**

When multiple nodes are selected, show a group menu and call `reclassifyNodes`; update names only when the existing name is still the generated default, preserving intentional user names.

- [ ] **Step 3: Make long-image stitching create a real asset**

Use `createMergedNode` to generate a stable `assetId`, name `详情长图-01` with the next available number, group `详情图`, role `详情长图`, `sourceKey: 'detail_long'`, and `merge` connections from each source node. Keep source nodes selected only until the API resolves.

- [ ] **Step 4: Add design-direction editor**

Store the selected direction in state with a controlled form containing purpose, composition, copy, ratio, platform, references and model parameters. The “再次编辑” action opens the form; save updates the direction object without losing its `id`.

- [ ] **Step 5: Link regenerated output to its direction**

Pass `sourceDirectionId` into `regenerateCanvasImage` when available and copy it onto the new node. Add a `variant` connection from the edited source node to the regenerated node.

- [ ] **Step 6: Update context-menu actions**

Expose only real actions: download, rename, classify, remove background, reverse prompt, edit direction/regenerate, copy URL, delete. Context menu labels must use `node.name`, not legacy `displayLabel`.

- [ ] **Step 7: Run test/build checks and commit**

Run: `npm test`

Expected: PASS.

```bash
git add src/pages/EcCanvas/index.jsx src/pages/EcCanvas/ContextMenu.jsx src/services/api.js
git commit -m "feat: add ecommerce asset metadata and direction editing"
```

### Task 4: Clean the visual shell and remove misleading controls

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- No new public API; visual shell consumes the asset and selection state from Tasks 1–3.

- [ ] **Step 1: Remove the fixed left rail**

Delete the fixed `left: 0; top: 50%; transform: translateY(-50%)` rail from `src/App.jsx`. Navigation remains available through the page header and existing route controls.

- [ ] **Step 2: Keep one compact zoom group**

Use one group with minus, percentage, plus and fit buttons in the canvas header. Remove any duplicate zoom controls from page-level overlays and remove the old Shift-click connection hint.

- [ ] **Step 3: Add business filters and selection summary**

Add `全部`, `主图`, `详情图`, `SKU`, `素材` filter pills, and show node count plus selected count. Filters only affect visibility; they must not delete nodes or connections.

- [ ] **Step 4: Verify production visual constraints**

Run: `rg -n "position:\\s*['\\\"]fixed|left:\\s*0|MdZoomOut|MdZoomIn|Shift\\+点击" src/App.jsx src/pages/EcCanvas/index.jsx`

Expected: no left floating rail and exactly one zoom group in `EcCanvas/index.jsx`; any remaining fixed positions are for modal/toast overlays only.

- [ ] **Step 5: Commit the shell cleanup**

```bash
git add src/App.jsx src/pages/EcCanvas/index.jsx
git commit -m "fix: simplify ecommerce canvas shell"
```

### Task 5: Verify, deploy, and perform HTTPS acceptance

**Files:**
- Modify: `scripts/deploy-production.ps1` if the isolated worktree copy needs the deployment helper
- No source changes expected unless verification exposes a concrete defect.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS with no failing test files.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite finishes with `✓ built in ...` and writes `dist/`.

- [ ] **Step 3: Run build checks**

Run: `npm run check`

Expected: build integrity check passes.

- [ ] **Step 4: Deploy through the configured SSH key**

Run from the repository root:

```powershell
.\scripts\deploy-production.ps1 -RepoPath "F:\da\shubao\.worktrees\codex-ecommerce-stability"
```

Expected: remote backup created, PM2 `shubao` online, local health response contains `"ok":true`.

- [ ] **Step 5: Verify HTTPS**

Run:

```powershell
curl.exe -fsS https://shuimg.cn/
curl.exe -fsS https://shuimg.cn/health
```

Expected: homepage returns HTML, health returns JSON with `ok: true`.

- [ ] **Step 6: Smoke-test the canvas**

Open `https://shuimg.cn`, enter the canvas, and verify: no left rail, one zoom group, category labels, multi-select, marquee selection, visible ports, semantic edge creation, detail merge, rename/reclassify, and direction re-edit.

- [ ] **Step 7: Commit verification artifacts**

```bash
git status --short
git log -1 --oneline
```

Expected: source changes are committed; only deployment-generated `dist`/runtime files may remain dirty and are excluded from the source commit.
