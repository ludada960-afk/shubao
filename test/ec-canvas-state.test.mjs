import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSET_GROUPS,
  addConnection,
  bindNonPassiveWheel,
  canStitch,
  fitViewport,
  readableInitialViewport,
  getCanvasPointerIntent,
  getNodePointerIntent,
  canvasCursorForState,
  moveSelectedNodes,
  normalizeAsset,
  removeConnectionsForNodes,
  selectNodesInRect,
  zoomAroundCursor,
  zoomPreviewByWheel,
} from '../src/pages/EcCanvas/canvasState.js';
import { readFileSync } from 'node:fs';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const canvasChromeSource = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
const canvasStudioSource = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const canvasCss = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');


test('select drag starts marquee while hand and temporary navigation gestures pan', () => {
  assert.equal(getCanvasPointerIntent({ tool: 'select', button: 0 }), 'marquee');
  assert.equal(getCanvasPointerIntent({ tool: 'select', button: 0, shiftKey: true }), 'marquee');
  assert.equal(getCanvasPointerIntent({ tool: 'select', button: 1 }), 'pan');
  assert.equal(getCanvasPointerIntent({ tool: 'select', button: 0, altKey: true }), 'pan');
  assert.equal(getCanvasPointerIntent({ tool: 'select', button: 0, spaceKey: true }), 'pan');
  assert.equal(getCanvasPointerIntent({ tool: 'hand', button: 0 }), 'pan');
});

test('hand mode selects a node while preserving empty-canvas panning', () => {
  assert.equal(getCanvasPointerIntent({ tool: 'hand', button: 0 }), 'pan');
  assert.equal(getNodePointerIntent({ tool: 'hand', button: 0 }), 'select');
  assert.equal(getNodePointerIntent({ tool: 'select', button: 0 }), 'drag');
});

test('canvas controls do not start pan or marquee gestures', () => {
  assert.equal(getCanvasPointerIntent({ button: 0, isInteractive: true }), 'ignore');
  assert.equal(getCanvasPointerIntent({ button: 2 }), 'ignore');
});

test('canvas cursor communicates pan and marquee modes', () => {
  assert.equal(canvasCursorForState({ tool: 'select', pointerKind: null }), 'default');
  assert.equal(canvasCursorForState({ tool: 'hand', pointerKind: null }), 'grab');
  assert.equal(canvasCursorForState({ tool: 'select', pointerKind: 'pan' }), 'grabbing');
  assert.equal(canvasCursorForState({ tool: 'select', pointerKind: 'marquee' }), 'crosshair');
  assert.equal(canvasCursorForState({ tool: 'select', spaceKey: true }), 'grab');
});

test('Canvas exposes the select-tool multi-selection hint through the tool label', () => {
  assert.match(canvasChromeSource, /拖拽框选\s*\/\s*Shift\+点击多选/);
  assert.doesNotMatch(canvasChromeSource, /ec-canvas-selection-hint/);
  assert.match(canvasSource, /tool:\s*activeTool/);
});

test('binds canvas wheel handling as non-passive and removes it cleanly', () => {
  const calls = [];
  const element = {
    addEventListener(type, listener, options) { calls.push(['add', type, listener, options]); },
    removeEventListener(type, listener, options) { calls.push(['remove', type, listener, options]); },
  };
  const handler = () => {};

  const cleanup = bindNonPassiveWheel(element, handler);

  assert.equal(calls[0][0], 'add');
  assert.equal(calls[0][1], 'wheel');
  assert.equal(calls[0][2], handler);
  assert.deepEqual(calls[0][3], { passive: false });

  cleanup();
  assert.deepEqual(calls[1], ['remove', 'wheel', handler, { passive: false }]);
});

test('zoom keeps the canvas point under the cursor fixed', () => {
  const before = { x: 40, y: 60, scale: 1 };
  const point = { x: 320, y: 260 };
  const after = zoomAroundCursor(before, point, 1.25);
  assert.equal((point.x - after.x) / after.scale, (point.x - before.x) / before.scale);
  assert.equal((point.y - after.y) / after.scale, (point.y - before.y) / before.scale);
});

test('preview wheel zoom stays within a usable range', () => {
  assert.equal(zoomPreviewByWheel(1, -120), 1.15);
  assert.equal(zoomPreviewByWheel(0.5, 120), 0.5);
  assert.equal(zoomPreviewByWheel(4, -120), 4);
});

test('fitViewport centres a node group', () => {
  const view = fitViewport([{ x: 0, y: 0, w: 200, h: 200 }], { width: 800, height: 600 });
  assert.ok(view.x > 100 && view.y > 100);
});

test('initial canvas framing keeps commerce cards readable instead of shrinking every lane', () => {
  const nodes = Array.from({ length: 5 }, (_, index) => ({
    x: index === 0 ? 0 : 340,
    y: index * 360,
    w: 200,
    h: 260,
  }));
  const view = readableInitialViewport(nodes, { width: 1600, height: 900 });

  assert.equal(view.scale, 0.68);
  assert.ok(view.y >= 64);
});

test('only two detail nodes enable long image stitching', () => {
  const nodes = [{ id: 'a', group: '详情图' }, { id: 'b', group: '主图' }, { id: 'c', group: '详情图' }];
  assert.equal(canStitch(nodes, new Set(['a', 'b'])), false);
  assert.equal(canStitch(nodes, new Set(['a', 'c'])), true);
});

test('normalizes ecommerce asset names and groups', () => {
  const node = normalizeAsset({ key: 'detail_slice_size', url: '/size.png' }, 0);
  assert.equal(node.name, '尺寸标注图-01');
  assert.equal(node.group, '详情图');
  assert.equal(node.role, '尺寸标注图');
  assert.equal(node.editable, true);
});

test('white-background deliverables keep a dedicated Canvas lane', () => {
  assert.deepEqual(ASSET_GROUPS, ['白底图', '主图', '详情图', 'SKU', '素材']);
  const node = normalizeAsset({ key: 'white_bg', url: '/white.png' }, 0);
  assert.equal(node.name, '白底首图-01');
  assert.equal(node.group, '白底图');
});

test('marquee 只选中**完整落在框内**的节点（部分相交不算 —— 批 CY-㊴ 改了口径）', () => {
  const nodes = [
    { id: 'a', x: 10, y: 10, w: 100, h: 100 },
    { id: 'b', x: 300, y: 300, w: 100, h: 100 },
  ];
  assert.deepEqual(selectNodesInRect(nodes, { x: 0, y: 0, w: 150, h: 150 }), ['a']);

  /* ⚠️ 口径在批 CY-㊴（2026-10-01）变过一次：原来只要**相交**就算选中。
     用户原话：「你的拖动框选却没有把最下面的图**完整选中**呀。
       …这下面为什么还是漏了一些呀？」—— 蓝色框选矩形并没有盖住那个节点，
     它却整块变成了选中态，视觉上就是"框没盖满却被选中"。
     ⇒ 现在要求**四条边都落在框内**。下面这几条才是那次变更真正要守的东西。 */
  const one = [{ id: 'p', x: 10, y: 10, w: 100, h: 100 }];
  assert.deepEqual(selectNodesInRect(one, { x: 0, y: 0, w: 60, h: 60 }), [],
    '只框住一部分不算选中（本次口径变更的核心）');
  assert.deepEqual(selectNodesInRect(one, { x: 0, y: 0, w: 1000, h: 1000 }), ['p'],
    '完整框住就选中');
  /* 方向无关：往右下拖与往左上拖结果一致（w/h 为负） */
  assert.deepEqual(selectNodesInRect(nodes, { x: 150, y: 150, w: -150, h: -150 }), ['a'],
    '反向拖拽结果必须一致');
  /* 隐藏节点不参与 */
  const hidden = [{ id: 'h', x: 10, y: 10, w: 100, h: 100, hidden: true }];
  assert.deepEqual(selectNodesInRect(hidden, { x: 0, y: 0, w: 1000, h: 1000 }), [],
    '隐藏节点不该被框选');
});

test('moving a selection preserves unrelated node positions', () => {
  const nodes = [{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 300, y: 300 }];
  const moved = moveSelectedNodes(nodes, new Set(['a']), 20, 30);
  assert.equal(moved[0].x, 30);
  assert.equal(moved[0].y, 40);
  assert.equal(moved[1].x, 300);
  assert.equal(moved[1].y, 300);
});

test('locked nodes stay in place when a mixed selection is dragged', () => {
  const nodes = [
    { id: 'locked', x: 10, y: 10, locked: true },
    { id: 'free', x: 40, y: 50 },
  ];
  const moved = moveSelectedNodes(nodes, new Set(['locked', 'free']), 20, 30);
  assert.deepEqual(moved[0], nodes[0]);
  assert.deepEqual(moved[1], { id: 'free', x: 60, y: 80 });
});

test('connections are deduplicated and removed with deleted nodes', () => {
  const edge = addConnection([], 'a', 'b', 'reference');
  assert.deepEqual(addConnection(edge, 'a', 'b', 'reference'), edge);
  assert.deepEqual(removeConnectionsForNodes(edge, new Set(['a'])), []);
});

test('Canvas imports a fresh session instead of automatically restoring local node state', () => {
  assert.match(canvasSource, /createFreshCanvasSession/);
  assert.doesNotMatch(canvasSource, /shubao_ec_canvas_state/);
  assert.doesNotMatch(canvasSource, /localStorage\.setItem\([^\n]*canvas_state/);
  assert.doesNotMatch(canvasSource, /ECOMMERCE_ACTIONS/);
  assert.doesNotMatch(canvasSource, /CANVAS_NODE_ACTIONS/);
  assert.match(canvasSource, /actionsForSurface/);
});

test('fresh Canvas generation creates a blank canvas in place and imports Works as a new session', () => {
  // P0-6: 新建画布就地清空成一张空白画布 (不再跳回首页)
  // 空画布结果必须带 _ecResult 标记：否则回到首页会自动弹出空白结果弹窗（2026-09-10 用户反馈）
  assert.match(canvasSource, /dispatch\(\{ type: 'SET_RESULT', result: \{ _ecResult: true, _emptyCanvas: true \} \}\);\s*showToast\('已新建空白画布/);
  assert.match(canvasSource, /setNodes\(\[\]\);\s*setConnections\(\[\]\);\s*setViewport\(\{ x: 80, y: 40, scale: 1 \}\)/);
  assert.match(canvasSource, /createFreshCanvasSession\(\{\s*work: result,/);
  assert.match(canvasSource, /dispatch\(\{ type: 'SET_RESULT', result: buildCanvasImportResult\(work\) \}\);/);
});

test('Canvas uses product dialogs and omits internal direction copy', () => {
  assert.doesNotMatch(canvasSource, /方案名称由 AI/);
  assert.doesNotMatch(canvasSource, /window\.(?:alert|confirm|prompt)\s*\(/);
});

test('fresh Canvas renders source groups and completed outputs as visual assets', () => {
  assert.match(canvasSource, /node\.kind === 'source_group'/);
  assert.match(canvasSource, /node\.kind === 'image' \|\| node\.kind === 'output'/);
  assert.match(canvasSource, /<StudioSourceNode/);
  assert.match(canvasSource, /<StudioImageNode/);
});

test('image generation handlers remain executable from the non-hover creation surfaces', () => {
  assert.match(canvasSource, /handler === 'adjust-requirements'/);
  assert.match(canvasSource, /handler === 'regenerate'/);
  assert.match(canvasSource, /regenerateCanvasImage/);
  assert.match(canvasSource, /<CanvasObjectToolbar[\s\S]{0,300}?onAction=\{handleToolAction\}/);
  assert.doesNotMatch(canvasSource, /hoverActions=\{/);
});

test('canvas interaction surfaces dismiss each other and text has one toolbar', () => {
  assert.match(canvasSource, /setContextMenu\(null\);\s*setConnectionPicker\(null\);\s*setAddMenuOpen\(false\);/);
  // 9-05 定稿: 工具栏与右面板共享谓词且共存; 派生菜单只由素材 + 触发（见 canvas-selection-panels）
  assert.match(canvasSource, /const selectionPanelsVisible = !focusedEditor && multiSelected\.size <= 1[\s\S]{0,260}selectedNode\.kind !== 'text'/);
  assert.match(canvasSource, /selectionPanelsVisible && <CanvasObjectToolbar/);
  assert.match(canvasSource, /\['text', 'text-composer'\]\.includes\(selectedNode\?\.kind\) && <CanvasTextToolbar/);
  /* ⚠️ 2026-09-30 批 CY-㊴：pointerup 现在必须把 side 一起传出去，这条判据方向被用户推翻。
     事故：左右两侧的 pointerup 都不传 side，父组件又把 side 写死成 'out'，
     于是 handlePortPointerUp 的 `side !== 'in'` 直接把它丢弃 ——
     用户看到的现象是「左边也有个加号，但把线拉过去连不上」。 */
  assert.match(canvasStudioSource, /const handlerSide = isInput \? 'in' : 'out'/);
  assert.match(canvasStudioSource, /onPointerUp=\{event => onPointerUp\?\.\(event, handlerSide\)\}/);
});

test('clicking an image output port opens the derive picker without requiring a drag', () => {
  assert.match(canvasStudioSource, /function DerivePort\(\{[^}]*onClick/);
  /* 9-11 三轮: 左右加号都点击开派生菜单 (用户: 左加号点了没反应) */
  /* 同上：onClick 也要带 side（9-11 用户口径「左右加号都点开派生菜单」在改后依然成立）。 */
  assert.match(canvasStudioSource, /onClick=\{event => \{ event\.stopPropagation\(\); onClick\?\.\(event, handlerSide\); \}\}/);
  assert.match(canvasSource, /const handlePortClick = useCallback/);
  /* 2026-09-20：锚点从「世界坐标 toWorldPoint(event)」改为「触发按钮的视口矩形 anchorRect」。
     原因见 test/canvas-popover-anchor-authority-0920.test.mjs：世界坐标要经缩放层换算，
     实测右侧面板打开时算飞（世界 -717 → 屏幕 x=10），面板被甩到最左并盖住素材。
     这里断言「先取触发元素再量视口矩形」这一实质，不绑定旧的字面量。 */
  assert.match(canvasSource, /setConnectionPicker\(\{\s*sourceNodeId:\s*nodeId,\s*anchorRect:/,
    '点击加号必须把触发元素的视口矩形作为锚点传给派生菜单');
  assert.match(canvasSource, /const rect = portEl\?\.getBoundingClientRect\?\.\(\)/, '锚点必须来自触发元素的实测矩形');
  /* 2026-10-01（批 CY-㊴ 之十八）：素材分组节点的点端口改走稳定缓存。
     守的是"仍然打到 handlePortClick 并带上节点 id"，而不是必须写成内联箭头。 */
  assert.match(canvasSource, /onPortClick=\{h\.onPortClick\}/);
  assert.match(canvasSource, /onPortClick: \(nodeId, event, side\) => handlePortClick\(event, nodeId, side\)/,
    '缓存里的 onPortClick 必须把节点 id 换到正确位置');
  assert.match(canvasSource, /onPortClick=\{h\.onPortClick\}/,
    '素材分组节点的点端口必须接上');
});

test('selecting a derivable image opens its adjacent quick action menu', () => {
  assert.match(canvasSource, /openConnectionPickerForNode/);
  assert.match(canvasSource, /sourceNodeId:\s*node\.id/);
  assert.match(canvasSource, /onNaturalSize=\{handleImageNaturalSize\}/);
});

test('locked nodes cannot enter the resize interaction and empty paste is a no-op', () => {
  assert.match(canvasSource, /if \(!node \|\| node\.locked \|\| event\.button !== 0\) return;/);
  assert.match(canvasSource, /if \(handler === 'paste' && !objectClipboardRef\.current\) \{[\s\S]{0,180}?return;/);
});

test('node dragging expands an established group before movement starts', () => {
  assert.match(canvasSource, /expandCanvasDragSelection\(nodes, id, baseIds\)/);
});

test('hidden and locked objects remain recoverable from a dedicated layers panel', () => {
  assert.match(canvasSource, /<CanvasLayersPanel/);
  assert.match(canvasSource, /onToggleVisibility=\{handleLayerVisibilityToggle\}/);
  assert.match(canvasSource, /onToggleLock=\{handleLayerLockToggle\}/);
  assert.match(canvasSource, /isCanvasConnectionVisible\(conn, nodes\)/);
  assert.match(canvasSource, /visibility: node\.hidden \? 'hidden' : 'visible'/);
});

test('canvas uploads render local previews before durable persistence and an empty canvas remains saveable', () => {
  assert.match(canvasSource, /persistCanvasUploadAssets/);
  assert.match(canvasSource, /handleCanvasSourceUpload[\s\S]*?createUploadedImageNodes[\s\S]*?persistCanvasUploadAssets\(assets(?:,\s*\{[^}]*\})?\)/);
  assert.match(canvasSource, /status:\s*'uploading'/);
  assert.match(canvasSource, /localPreviewUrl/);
  assert.doesNotMatch(canvasSource, /canvasSaveKeyRef\.current \|\| !nodes\.length/);
  assert.doesNotMatch(canvasSource, /draftReadyRef\.current \|\| !nodes\.length/);
  assert.doesNotMatch(canvasSource, /if \(!snapshot\.nodes\.length\) return;/);
});

test('Canvas persists uploaded source assets through durable ecommerce storage', () => {
  assert.match(canvasSource, /uploadEcommerceAssets/);
  assert.doesNotMatch(canvasSource, /persistCanvasUploadAssets[\s\S]{0,260}uploadECTempImages/);
  assert.doesNotMatch(canvasSource, /temporary:\s*true/);
});

test('Canvas promotes uploaded video and audio into the owner-scoped project asset library', () => {
  assert.match(canvasSource, /createProject, createProjectVersion/);
  assert.match(canvasSource, /importVideoAssetToProject/);
  assert.match(canvasSource, /ensureCanvasMediaProject/);
  assert.match(canvasSource, /handleCanvasVideoUpload[\s\S]*?importCanvasMediaAssets\(assets, projectContext, 'reference-video'\)/);
  assert.match(canvasSource, /handleComposerSourceUpload[\s\S]*?importCanvasMediaAssets\(audioAssets, projectContext, 'reference-audio'\)/);
  assert.match(canvasSource, /attachCanvasProjectAssetRef\(\{[\s\S]*?kind: 'audio'/);
  assert.doesNotMatch(canvasSource, /importVideoAssetToProject\([\s\S]{0,220}ownerEmail/);
});

test('资产库（9-12 用户批注）：搜索 + 额度 + 卡片只留悬停删除', () => {
  assert.match(canvasSource, /normalizeProjectAssetLibrary/);
  assert.match(canvasSource, /filterProjectAssetLibrary/);
  assert.match(canvasSource, /aria-label="搜索项目素材"/);
  /* 用户原话：卡片上只需要一个悬停出现的删除按钮，其它按钮全部去掉 */
  assert.match(canvasSource, /className="ec-asset-card-delete"/);
  assert.match(canvasSource, /handleDeleteProjectAsset/);
  assert.doesNotMatch(canvasSource, /aria-label="筛选素材保留状态"/, '多余的筛选下拉已移除');
  assert.doesNotMatch(canvasSource, /筛选素材生产状态/, '生产状态筛选已移除');
  /* 额度条（已用 / 可用） */
  assert.match(canvasSource, /ec-asset-quota/);
  assert.match(canvasSource, /已用 \{formatBytes\(assetUsage\?\.usedBytes\)\}/);
});

test('Canvas works category filters stay inside the mobile content column', () => {
  assert.match(canvasCss, /\.ec-canvas-work-filters\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(canvasCss, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.ec-canvas-work-filters\s*\{[\s\S]*?width:\s*100%[\s\S]*?flex-wrap:\s*wrap/);
  assert.match(canvasCss, /@media\s*\(max-width:\s*620px\)[\s\S]*?\.ec-canvas-work-filters button\s*\{[\s\S]*?min-width:\s*0/);
});

test('Canvas keeps uploads out of the auto asset library (9-11 用户批注①): 上传/替换只做草稿持久化, 资产库走用户显式收藏', () => {
  const uploadBlock = canvasSource.match(/canvasImportId: `upload-\$\{uploadStartedAt\}`[\s\S]*?已加入 \$\{uploadedNodes\.length\} 张图片[\s\S]*?图片上传失败，请重试/)?.[0] || '';
  assert.ok(uploadBlock.length > 0, '上传块应存在');
  assert.doesNotMatch(uploadBlock, /importCanvasImageAssets/);
  assert.doesNotMatch(uploadBlock, /ensureCanvasMediaProject\(files\[0\]/);
  assert.doesNotMatch(uploadBlock, /enqueuePendingProjectAssetImports/);
  assert.doesNotMatch(uploadBlock, /正在后台保存原图/);
  assert.match(uploadBlock, /canvasPersistenceGenerationRef\.current !== persistenceGeneration/);
  const replaceBlock = canvasSource.match(/if \(mediaReplaceTargetRef\.current\) \{[\s\S]*?素材已替换[\s\S]*?\r?\n      return;\r?\n    \}/)?.[0] || '';
  assert.ok(replaceBlock.length > 0, '替换块应存在');
  assert.doesNotMatch(replaceBlock, /importCanvasImageAssets|正在后台保存原图/);
  assert.match(replaceBlock, /fitW/);
  assert.match(canvasSource, /handler === 'save-to-assets'/);
  assert.match(canvasSource, /importCanvasImageAssets\(\[sourceAsset\], projectContext, 'user-saved'\)/);
});

test('Canvas keeps failed project asset archives actionable and retries them against durable upload identities', () => {
  assert.match(canvasSource, /pendingProjectAssetImports/);
  assert.match(canvasSource, /retryPendingProjectAssetImports/);
  assert.match(canvasSource, /sourceAssetId/);
  assert.match(canvasSource, /setPendingProjectAssetImports/);
  assert.match(canvasSource, /importImageAssetToProject/);
  assert.match(canvasSource, /importVideoAssetToProject/);
  assert.match(canvasSource, /attachCanvasProjectAssetRef\(\{[\s\S]{0,80}\.\.\.node,/);
  assert.match(canvasSource, /素材待处理/);
  assert.match(canvasSource, /重试处理/);
  assert.match(canvasSource, /createCanvasSnapshot\(\{ nodes, connections, viewport, pendingProjectAssetImports \}\)/);
  assert.match(canvasSource, /normalizePendingProjectAssetImports\(rawRemoteSnapshot\.pendingProjectAssetImports\)/); /* P2 Stage-2 var rename; normalization on remote-restore preserved */
});

test('Canvas automatically archives stable generated images into the project asset library', () => {
  assert.match(canvasSource, /registerGeneratedAssetToProject/);
  assert.match(canvasSource, /generatedAssetRegistrationRef = useRef\(new Map\(\)\)/);
  assert.match(canvasSource, /const candidates = nodes\.filter\(node => \{[\s\S]*?generatedAssetIdFromUrl\(node\?\.url\)/);
  assert.match(canvasSource, /ensureCanvasMediaProject\('Canvas 图片创作项目', 'ecommerce'\)/);
  assert.match(canvasSource, /stableUrl: node\.url/);
  assert.match(canvasSource, /attachCanvasProjectAssetRef\(candidate, existing\.asset\)/);
});

test('Canvas keeps a failed generated-asset registration recoverable without misclassifying it as an upload', () => {
  const generatedRegistration = canvasSource.match(/useEffect\(\(\) => \{\n    if \(!state\.logged \|\| result\.browserQa\)[\s\S]*?\n  \}, \[enqueuePendingProjectAssetImports, ensureCanvasMediaProject, nodes, result\.browserQa, result\.projectId, result\.resultVersionId, result\.sourceVersionId, state\.logged\]\);/)?.[0] || '';
  assert.match(generatedRegistration, /enqueuePendingProjectAssetImports\(\[\{[\s\S]*?operation:\s*'register-generated'/);
  assert.match(generatedRegistration, /generatedAssetRegistrationRef\.current\.set\(key, \{ queued: true \}\)/);
  assert.match(generatedRegistration, /if \(existing\?\.pending \|\| existing\?\.queued\) continue;/);
  assert.match(canvasSource, /return `\$\{record\.operation \|\| 'import-source'\}:\$\{record\.kind \|\| 'media'\}:/);
  const retryHandler = canvasSource.match(/const retryPendingProjectAssetImports = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[dispatch, ensureCanvasMediaProject, result, showToast, state\.logged\]\);/)?.[0] || '';
  assert.match(retryHandler, /record\.operation === 'register-generated'[\s\S]*?registerGeneratedAssetToProject\(/);
  assert.doesNotMatch(retryHandler, /record\.operation === 'register-generated'[\s\S]{0,220}importImageAssetToProject\(/);
});

/* 9-12 用户批注：保留/生产状态这类控件从「资产库页面」撤掉；
   但底层服务端契约仍然保留（其它入口与数据恢复仍在使用），所以只断言数据层仍可用。 */
test('保留与生产状态的底层契约仍在（只是不再出现在资产库页面）', () => {
  assert.match(canvasSource, /setProjectAssetRetention/);
  assert.match(canvasSource, /setProjectAssetProductionState/);
  assert.match(canvasSource, /PROJECT_ASSET_PRODUCTION_STATES/);
  assert.doesNotMatch(canvasSource, /更新\$\{label\}的生产状态/, '卡片上的状态下拉已按用户要求去掉');
});

test('Canvas Work projection preserves media-only sources for later recovery', () => {
  assert.match(canvasSource, /collectCanvasMediaAssets/);
  assert.match(canvasSource, /const resultMediaAssets = collectCanvasMediaAssets\(result\)/);
  assert.match(canvasSource, /hasCurrent = imageList\.length > 0 \|\| Boolean\(resultVideoUrl\) \|\| resultMediaAssets\.length > 0/);
  assert.match(canvasSource, /createFreshCanvasSession\(\{ work: result, mediaAssets: resultMediaAssets \}\)/);
  assert.match(canvasSource, /const canvasWorkMediaFields = useCallback/);
  const mediaFieldsBlock = canvasSource.match(/const canvasMediaFields = useCallback[\s\S]*?const canvasWorkMediaFields/)?.[0] || '';
  assert.match(mediaFieldsBlock, /mediaAssets/);
  assert.match(mediaFieldsBlock, /projectAssetRefs/);
  assert.match(canvasSource, /const saveKey = result\._saveKey \|\| canvasGeneratedWorkKeyRef\.current/);
  assert.match(canvasSource, /\$\{work\.mediaAssets\?\.length \|\| 0\} 个媒体素材/);
  assert.match(canvasSource, /mediaKind === 'audio' \? <audio src=\{asset\.playbackUrl \|\| asset\.stableUrl\}/);
  assert.match(canvasSource, /const mediaUrl = asset\.playbackUrl \|\| asset\.url \|\| asset\.stableUrl/);
  assert.match(canvasSource, /asset\.mediaKind === 'video' \? <video[\s\S]*?src=\{mediaUrl\}/);
  assert.match(canvasSource, /asset\.mediaKind === 'audio' \? \([\s\S]*?<audio[\s\S]*?src=\{mediaUrl\}/);
});

test('project library imports create a durable Canvas work context before switching tabs', () => {
  const importBlock = canvasSource.match(/const handleImportProjectAsset = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(importBlock, /ensureCanvasMediaProject/);
  assert.match(importBlock, /saveWork\(/);
  assert.match(importBlock, /canvasWorkMediaFields/);
  assert.match(importBlock, /SET_RESULT/);
  /* 批 CY-㊴（2026-09-30）：用户原话「不会产生生成或者扣费，这一句是废话，你要把它去掉」。
    旧断言写的是 match —— 也就是**要求这句话必须在**，与用户要求正相反。
    改成反向断言：这句话不许再出现；且删掉它之后，"已加入画布"这个事实仍要说清楚。 */
 assert.doesNotMatch(importBlock, /不会产生生成|不会产生任何费用|不扣积分/);
 assert.match(importBlock, /项目素材已加入画布/);
  assert.match(canvasSource, /const mediaAssets = collectCanvasMediaAssets\(work, currentNodes\);[\s\S]*?const projectAssetRefs = collectCanvasProjectAssetRefs/);
  assert.match(canvasSource, /!work\.videoUrl && !work\.images\?\.length && work\.productAssets\?\.length/);
  assert.match(canvasSource, /createProjectVersion\(projectId, \{[\s\S]*?idempotencyKey: `canvas-media-version:/);
});

test('project library imports are single-flight and do not duplicate project versions', () => {
  const importBlock = canvasSource.match(/const handleImportProjectAsset = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(canvasSource, /const projectAssetImportBusyRef = useRef\(false\)/);
  assert.match(importBlock, /if \(projectAssetImportBusyRef\.current\) return/);
  assert.match(importBlock, /projectAssetImportBusyRef\.current = true/);
  assert.match(importBlock, /projectAssetImportBusyRef\.current = false/);
});

test('project library batch imports revalidate each asset and persist one accumulated Canvas session', () => {
  const batchBlock = canvasSource.match(/const handleImportProjectAssets = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(canvasSource, /selectedProjectAssetKeys/);
  assert.match(canvasSource, /加入所选/);
  assert.match(batchBlock, /setProjectAssetBatchBusy\(true\)/);
  /* 9-15：登录态改为服务端为准 —— ensureReusableProjectAsset 内部做 reuse 复检，
     被保留策略标记为待清理的素材自动「长期保留」后再重试（用户自己的素材不再被误判）。 */
  assert.match(batchBlock, /ensureReusableProjectAsset\(asset\)/);
  assert.match(canvasSource, /const ensureReusableProjectAsset = useCallback/);
  assert.match(canvasSource, /setProjectAssetRetention\(asset\.projectId, asset\.projectAssetId, true\)/);
  assert.match(batchBlock, /session = imported\.session/);
  assert.match(batchBlock, /saveWork\(workResult, phone\)/);
  assert.match(batchBlock, /setSelectedProjectAssetKeys\(new Set\(\)\)/);
  assert.doesNotMatch(batchBlock, /generateImage|generateVideo|charge|debit/);
});

test('project library imports revalidate the canonical asset before mutating Canvas', () => {
  const importBlock = canvasSource.match(/const handleImportProjectAsset = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  /* 9-15：单素材导入同样走 ensureReusableProjectAsset（服务端 reuse 复检 + 自动长期保留），
     取消本地快照 canReuseProjectAsset 的直接拦截。 */
  assert.match(importBlock, /reusableAsset = await ensureReusableProjectAsset\(asset\)/);
  assert.match(canvasSource, /const ensureReusableProjectAsset = useCallback/);
  assert.match(importBlock, /importProjectAssetToCanvas\(\{[\s\S]*?asset: reusableAsset/);
});

test('project library imports distinguish local recovery from remote archive failure', () => {
  const importBlock = canvasSource.match(/const handleImportProjectAsset = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(importBlock, /let savedWork = null/);
  assert.match(importBlock, /savedWork = await saveWork/);
  assert.match(importBlock, /Boolean\(savedWork\?\._saveKey\)/);
  assert.match(importBlock, /云端作品暂未保存/);
});

test('double-click image preview is a keyboard-accessible dialog', () => {
  /* ⚠️ 2026-10-02：aria-label 判据**不再钉那个兜底词**。
     原来钉的是 `zoomImg.label || '图片'`。视频节点的工具栏加了「预览」之后，
     同一个灯箱也服务视频，兜底词必须从「图片」变成中立的「素材」——
     而旧判据把「图片」**逐字**钉住了，于是行为完全正确却被判红。
     ⇒ 改成断言**意图**：这是一个 dialog、模态、有**关闭按钮**，
        可访问名由 zoomImg.label 派生（无论兜底用哪个词）。
     措辞会变、意图不会；钉意图才拦得住真正的回归。 */
  assert.match(canvasSource, /role="dialog" aria-modal="true"/, '预览必须是模态对话框');
  assert.match(canvasSource, /aria-label=\{`\$\{zoomImg\.label \|\| '[^']+'\}大图预览`\}/,
    '可访问名必须由 zoomImg.label 派生（兜底词中立即可）');
  assert.match(canvasSource, /button type="button" aria-label="关闭大图预览"/, '必须有键盘可达的关闭按钮');
  assert.match(canvasSource, /bindNonPassiveWheel\(previewDialogRef\.current, handlePreviewWheel\)/, '滚轮缩放监听必须保留');
  assert.match(canvasSource, /transform:\s*`scale\(\$\{previewScale\}\)`/, '图片分支的缩放必须保留');
});

test('credit hover keeps every label legible on the dark Canvas hover state', () => {
  const control = readFileSync(new URL('../src/components/billing/AccountEntitlementControl.jsx', import.meta.url), 'utf8');
  assert.match(control, /\.account-entitlement-value:hover \.account-entitlement-copy small \{ color: #d9dde7; \}/);
  /* 2026-09-14 §18 灰阶迁移：白字改用 --sb-neutral-0（值不变）。断言改为「解析后为白色」。 */
  assert.match(
    control,
    /\.account-entitlement-value:hover \.account-entitlement-copy strong \{ color: (?:#fff|var\(--sb-neutral-0\)); \}/,
  );
  assert.match(control, /\.account-entitlement-value:hover \.account-entitlement-arrow \{ color: #d9dde7; \}/);
});

test('Canvas top navigation uses one spacious control rhythm and consistent surface feedback', () => {
  assert.match(canvasCss, /--ec-canvas-topbar-control-height:\s*38px/);
  assert.match(canvasCss, /\.ec-canvas-topbar\s*\{[\s\S]*?height:\s*62px;[\s\S]*?flex:\s*0 0 62px;/);
  assert.match(canvasCss, /\.ec-canvas-topbar-actions\s*\{\s*gap:\s*9px;/);
  // 新版导航重构后 surface 反馈收敛到 .ec-canvas-topbar 容器（hairline 分隔线），不再使用 per-widget topbar-surface 类
  assert.match(canvasCss, /\.ec-canvas-topbar\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--canvas-hairline\);/);
});

test('image information opens an editable product dialog and saves node metadata', () => {
  assert.match(canvasSource, /handler === 'image-info'[\s\S]*?setImageInfoNode\(node\)/);
  assert.match(canvasSource, /imageInfoNode &&[\s\S]*?value=\{imageInfoName\}[\s\S]*?value=\{imageInfoUsage\}/);
  assert.match(canvasSource, /handleImageInfoSave[\s\S]*?const name = imageInfoName\.trim\(\)[\s\S]*?const usage = imageInfoUsage\.trim\(\)[\s\S]*?name,[\s\S]*?usage,/);
});

test('every Works import carries a fresh Canvas session token', () => {
  assert.match(canvasSource, /buildCanvasImportResult\(work\)/);
  assert.match(canvasSource, /result\.canvasImportId/);
});

test('switching Canvas works resets the remote snapshot identity before autosave', () => {
  const resultIdentityBlock = canvasSource.match(/useEffect\(\(\) => \{\s*canvasGeneratedWorkKeyRef\.current = result\._saveKey \|\| ''[\s\S]*?\}, \[result\.id, result\._saveKey, result\.canvasImportId\]\);/)?.[0] || '';
  assert.match(resultIdentityBlock, /remoteSnapshotRef\.current = ''/);
  assert.match(canvasSource, /const nextCanvasSession = result\.canvasSession\?\.id[\s\S]*?canvasSessionRef\.current = nextCanvasSession/);
});

test('Canvas autosave ignores an older result after the active work changes', () => {
  assert.match(canvasSource, /const canvasPersistenceGenerationRef = useRef\(0\)/);
  assert.match(canvasSource, /canvasPersistenceGenerationRef\.current \+= 1/);
  const autosaveBlock = canvasSource.match(/remoteSaveTimerRef\.current = setTimeout\(async \(\) => \{[\s\S]*?\n    \}, 1200\);/)?.[0] || '';
  assert.match(autosaveBlock, /const persistenceGeneration = canvasPersistenceGenerationRef\.current/);
  assert.match(autosaveBlock, /canvasPersistenceGenerationRef\.current !== persistenceGeneration/);
});

test('manual Canvas save ignores a stale response after the active work changes', () => {
  const saveBlock = canvasSource.match(/const handleCanvasSessionSave = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(saveBlock, /const persistenceGeneration = canvasPersistenceGenerationRef\.current/);
  assert.match(saveBlock, /canvasPersistenceGenerationRef\.current !== persistenceGeneration/);
});

test('Canvas restore ignores a stale session response after the active work changes', () => {
  const restoreBlock = canvasSource.match(/const handleCanvasSessionRestore = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(restoreBlock, /const persistenceGeneration = canvasPersistenceGenerationRef\.current/);
  assert.match(restoreBlock, /canvasPersistenceGenerationRef\.current !== persistenceGeneration/);
});

test('Canvas Work autosave ignores a stale archive response after the active work changes', () => {
  const workAutosaveBlock = canvasSource.match(/const persistenceGeneration = canvasPersistenceGenerationRef\.current;[\s\S]*?const timer = setTimeout\(async \(\) => \{[\s\S]*?\n    \}, 900\);/)?.[0] || '';
  assert.match(workAutosaveBlock, /const persistenceGeneration = canvasPersistenceGenerationRef\.current/);
  assert.match(workAutosaveBlock, /canvasPersistenceGenerationRef\.current !== persistenceGeneration/);
});

test('manual Canvas save reports a Work archive failure without claiming full success', () => {
  const saveBlock = canvasSource.match(/const handleCanvasSessionSave = useCallback\([\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] || '';
  assert.match(saveBlock, /let savedWork = null/);
  assert.match(saveBlock, /savedWork = await saveWork/);
  assert.match(saveBlock, /云端作品暂未保存/);
  assert.match(saveBlock, /canvasSessionRef\.current = session/);
  assert.match(saveBlock, /remoteSnapshotRef\.current = JSON\.stringify\(snapshot\)/);
});

test('fresh Canvas imports hydrate durable text compositions from the project version', () => {
  assert.match(canvasSource, /listTextCompositions/);
  assert.match(canvasSource, /projectId: result\.projectId/);
  assert.match(canvasSource, /versionId: result\.resultVersionId \|\| result\.sourceVersionId/);
  assert.match(canvasSource, /compositionBackgroundAssetId/);
});

test('Canvas persistence keeps recovery and autosave without exposing a broken manual save command', () => {
  assert.match(canvasSource, /createCanvasSession/);
  assert.match(canvasSource, /saveCanvasSession/);
  assert.match(canvasSource, /loadCanvasSession/);
  assert.match(canvasSource, /const handleCanvasSessionSave[\s\S]*?createCanvasSnapshot/);
  assert.match(canvasSource, /const handleCanvasSessionRestore[\s\S]*?restoreCanvasSnapshot/);
  assert.match(canvasSource, /<CanvasTopBar[\s\S]*?onRestore=\{handleCanvasSessionRestore\}/);
  assert.doesNotMatch(canvasChromeSource, /<Save[^>]*\/>\{saving \? '保存中' : '保存'\}/);
  assert.match(canvasChromeSource, /label="恢复已保存画布"[\s\S]*?<RotateCcw/);
  assert.match(canvasSource, /saveCanvasDraft\(/);
  assert.match(canvasSource, /remoteSaveTimerRef/);
  assert.match(canvasSource, /canvasSessionRef/);
});

test('an explicit Canvas save records the session handle on its owner-scoped Work for later manual restore', () => {
  const saveBlock = canvasSource.match(/const handleCanvasSessionSave[\s\S]*?const handleCanvasSessionRestore/)?.[0] || '';
  assert.match(saveBlock, /await saveWork\(\{[\s\S]*?canvasSessionId: session\.id[\s\S]*?canvasSessionRevision: session\.revision/);
  assert.match(saveBlock, /phone/);
});

test('generated outputs from a blank Canvas are saved into the unified work collection', () => {
  const autosaveBlock = canvasSource.match(/const fingerprint = canvasWorkOutputFingerprint[\s\S]*?\}, \[[^\]]*canvasWorkMediaFields[^\]]*\]\);/)?.[0] || '';
  assert.doesNotMatch(autosaveBlock, /!result\._saveKey/);
  assert.match(autosaveBlock, /canvasGeneratedWorkKeyRef\.current/);
  assert.match(autosaveBlock, /await saveWork\(workResult, phone\)/);
  assert.match(autosaveBlock, /setPastWorks/);
});

test('source-group workflow generation uses the first owned product asset', () => {
  const generateBlock = canvasSource.match(/const handleWorkflowGenerate[\s\S]*?const handleWorkflowRetry/)?.[0] || '';
  /* P0 边传值 (N2) 插在链首: 入边优先, 老链路 (inputs.sourceUrl > source.url > source.assets[0].url) 原样保留。*/
  assert.match(generateBlock, /const sourceUrl = edgeInputs\.images\[0\]\?\.url \|\| node\.inputs\?\.sourceUrl \|\| source\?\.url \|\| source\?\.assets\?\.find\(asset => asset\?\.url\)\?\.url/);
  assert.match(generateBlock, /regenerateCanvasImage\(\{[\s\S]*?imageUrl: sourceUrl/);
});

test('connection geometry derives endpoints from the synchronous node model', () => {
  assert.match(canvasSource, /getCanvasPortCenter/);
  assert.match(canvasSource, /data-canvas-node-id/);
  assert.doesNotMatch(canvasSource, /ResizeObserver/);
  assert.doesNotMatch(canvasSource, /renderedPortCenters/);
});
