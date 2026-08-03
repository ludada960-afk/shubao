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
  canvasCursorForState,
  moveSelectedNodes,
  normalizeAsset,
  removeConnectionsForNodes,
  selectNodesInRect,
  zoomAroundCursor,
} from '../src/pages/EcCanvas/canvasState.js';
import { readFileSync } from 'node:fs';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const canvasChromeSource = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
const canvasStudioSource = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const worksSource = readFileSync(new URL('../src/pages/Works/index.jsx', import.meta.url), 'utf8');


test('plain left drag pans the canvas while Shift drag starts marquee selection', () => {
  assert.equal(getCanvasPointerIntent({ button: 0 }), 'pan');
  assert.equal(getCanvasPointerIntent({ button: 0, shiftKey: true }), 'marquee');
  assert.equal(getCanvasPointerIntent({ button: 1 }), 'pan');
  assert.equal(getCanvasPointerIntent({ button: 0, altKey: true }), 'pan');
  assert.equal(getCanvasPointerIntent({ button: 0, spaceKey: true }), 'pan');
});

test('canvas controls do not start pan or marquee gestures', () => {
  assert.equal(getCanvasPointerIntent({ button: 0, isInteractive: true }), 'ignore');
  assert.equal(getCanvasPointerIntent({ button: 2 }), 'ignore');
});

test('canvas cursor communicates pan and marquee modes', () => {
  assert.equal(canvasCursorForState({ pointerKind: null, shiftKey: false }), 'grab');
  assert.equal(canvasCursorForState({ pointerKind: 'pan' }), 'grabbing');
  assert.equal(canvasCursorForState({ pointerKind: 'marquee' }), 'crosshair');
  assert.equal(canvasCursorForState({ pointerKind: null, shiftKey: true }), 'crosshair');
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

test('marquee selection includes intersecting nodes only', () => {
  const nodes = [
    { id: 'a', x: 10, y: 10, w: 100, h: 100 },
    { id: 'b', x: 300, y: 300, w: 100, h: 100 },
  ];
  assert.deepEqual(selectNodesInRect(nodes, { x: 0, y: 0, w: 150, h: 150 }), ['a']);
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

test('fresh Canvas generation returns to ecommerce home and imports Works as a new session', () => {
  assert.match(canvasSource, /dispatch\(\{ type: 'SET_MODE', mode: 'ecommerce' \}\);\s*dispatch\(\{ type: 'NAVIGATE', page: 'home' \}\);/);
  assert.match(canvasSource, /createFreshCanvasSession\(\{\s*work: result,/);
  assert.match(worksSource, /dispatch\(\{ type: 'SET_RESULT', result: normalized \}\);/);
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
  assert.match(canvasSource, /multiSelected\.size <= 1[\s\S]{0,260}<CanvasObjectToolbar/);
  assert.match(canvasSource, /\['text', 'text-composer'\]\.includes\(selectedNode\?\.kind\) && <CanvasTextToolbar/);
  assert.doesNotMatch(canvasStudioSource, /onPointerUp=\{event => \{ event\.stopPropagation\(\); onPointerUp/);
});

test('clicking an image output port opens the derive picker without requiring a drag', () => {
  assert.match(canvasStudioSource, /function DerivePort\(\{[^}]*onClick/);
  assert.match(canvasStudioSource, /onClick=\{event => \{ event\.stopPropagation\(\); onClick\?\.\(event\); \}\}/);
  assert.match(canvasSource, /const handlePortClick = useCallback/);
  assert.match(canvasSource, /setConnectionPicker\(\{\s*sourceNodeId:\s*nodeId,\s*world:\s*toWorldPoint\(event\)/);
  assert.match(canvasSource, /onPortClick=\{event => handlePortClick\(event, node\.id\)\}/);
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

test('canvas uploads are persisted before node creation and an empty canvas remains saveable', () => {
  assert.match(canvasSource, /persistCanvasUploadAssets/);
  assert.match(canvasSource, /handleCanvasSourceUpload[\s\S]*?persistCanvasUploadAssets\(assets\)[\s\S]*?createUploadedImageNodes/);
  assert.match(canvasSource, /handleComposerSourceUpload[\s\S]*?persistCanvasUploadAssets\(assets\)[\s\S]*?createUploadedImageNodes/);
  assert.doesNotMatch(canvasSource, /canvasSaveKeyRef\.current \|\| !nodes\.length/);
  assert.doesNotMatch(canvasSource, /draftReadyRef\.current \|\| !nodes\.length/);
  assert.doesNotMatch(canvasSource, /if \(!snapshot\.nodes\.length\) return;/);
});

test('double-click image preview is a keyboard-accessible dialog', () => {
  assert.match(canvasSource, /role="dialog" aria-modal="true" aria-label=\{`\$\{zoomImg\.label \|\| '图片'\}大图预览`\}/);
  assert.match(canvasSource, /button type="button" aria-label="关闭大图预览"/);
});

test('image information opens an editable product dialog and saves node metadata', () => {
  assert.match(canvasSource, /handler === 'image-info'[\s\S]*?setImageInfoNode\(node\)/);
  assert.match(canvasSource, /imageInfoNode &&[\s\S]*?value=\{imageInfoName\}[\s\S]*?value=\{imageInfoUsage\}/);
  assert.match(canvasSource, /handleImageInfoSave[\s\S]*?const name = imageInfoName\.trim\(\)[\s\S]*?const usage = imageInfoUsage\.trim\(\)[\s\S]*?name,[\s\S]*?usage,/);
});

test('every Works import carries a fresh Canvas session token', () => {
  assert.match(worksSource, /canvasImportId:/);
  assert.match(canvasSource, /result\.canvasImportId/);
});

test('fresh Canvas imports hydrate durable text compositions from the project version', () => {
  assert.match(canvasSource, /listTextCompositions/);
  assert.match(canvasSource, /projectId: result\.projectId/);
  assert.match(canvasSource, /versionId: result\.resultVersionId \|\| result\.sourceVersionId/);
  assert.match(canvasSource, /compositionBackgroundAssetId/);
});

test('Canvas persistence keeps explicit recovery commands while synchronizing drafts automatically', () => {
  assert.match(canvasSource, /createCanvasSession/);
  assert.match(canvasSource, /saveCanvasSession/);
  assert.match(canvasSource, /loadCanvasSession/);
  assert.match(canvasSource, /const handleCanvasSessionSave[\s\S]*?createCanvasSnapshot/);
  assert.match(canvasSource, /const handleCanvasSessionRestore[\s\S]*?restoreCanvasSnapshot/);
  assert.match(canvasSource, /<CanvasTopBar[\s\S]*?onSave=\{handleCanvasSessionSave\}[\s\S]*?onRestore=\{handleCanvasSessionRestore\}/);
  assert.match(canvasChromeSource, /<Save[^>]*\/>\{saving \? '保存中' : '保存'\}/);
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

test('source-group workflow generation uses the first owned product asset', () => {
  const generateBlock = canvasSource.match(/const handleWorkflowGenerate[\s\S]*?const handleWorkflowRetry/)?.[0] || '';
  assert.match(generateBlock, /const sourceUrl = node\.inputs\?\.sourceUrl \|\| source\?\.url \|\| source\?\.assets\?\.find\(asset => asset\?\.url\)\?\.url/);
  assert.match(generateBlock, /regenerateCanvasImage\(\{[\s\S]*?imageUrl: sourceUrl/);
});

test('connection geometry derives endpoints from the synchronous node model', () => {
  assert.match(canvasSource, /getCanvasPortCenter/);
  assert.match(canvasSource, /data-canvas-node-id/);
  assert.doesNotMatch(canvasSource, /ResizeObserver/);
  assert.doesNotMatch(canvasSource, /renderedPortCenters/);
});
