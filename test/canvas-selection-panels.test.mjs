import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_ACTIONS,
  actionsForSurface,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const pageSource = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studioSource = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('contract (9-05 定稿): selection opens toolbar + right panel together; derive menu is opened only via the + port', () => {
  const page = pageSource();
  // 顶部工具栏与右面板共享同一谓词, 且派生菜单打开时两者保持出现 (双面板共存)
  assert.match(page, /const selectionPanelsVisible = /);
  const uses = page.match(/selectionPanelsVisible && </g) || [];
  assert.equal(uses.length, 2, 'object toolbar + right panel share the predicate');
  assert.match(page, /selectionPanelsVisible && <CanvasObjectToolbar/);
  assert.match(page, /selectionPanelsVisible && <EcCanvasRightPanel/);
  // 派生菜单只由 + 触发 (connectionPicker), 不再挂 selectionPanelsVisible
  assert.match(page, /connectionPicker && <CanvasDeriveMenu/);
  assert.doesNotMatch(page, /&& !connectionPicker &&/, '派生菜单不能再把工具栏藏掉 (谓词里不得有 !connectionPicker 条件)');
  // 谓词本身覆盖：非聚焦编辑、无连线选择、单选、存在选中节点、排除文本与 composer
  const declaration = page.slice(page.indexOf('const selectionPanelsVisible'), page.indexOf(';', page.indexOf('selectedNode.kind')), page.indexOf('selectedNode.kind') + 40);
  for (const guard of ['!focusedEditor', 'multiSelected.size <= 1', 'selectedNode']) {
    assert.match(declaration, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), guard);
  }
});

test('contract: delete stays out of the selection surface (lone-trash regression)', () => {
  const deleteAction = CANVAS_ACTIONS.find(action => action.id === 'delete');
  assert.deepEqual([...deleteAction.surfaces], ['context']);
  const ready = { id: 'n1', kind: 'image', status: 'ready', url: '/a.png' };
  assert.equal(actionsForSurface({ surface: 'selection', node: ready }).some(action => action.id === 'delete'), false);
});

test('contract (9-10): panels can never outlive their node — hidden guard + stale-selection reaper', () => {
  const page = pageSource();
  // 节点被隐藏 -> 面板同步关闭 (原来只看 selectedNode 是否存在, hidden 节点会让面板残留)
  assert.match(page, /&& !selectedNode\.hidden/, 'hidden nodes must close the selection panels');
  // 选中 id 一旦脱离 nodes (删除/整张画布被替换/恢复会话/模板铺开/换作品) 立即回收
  assert.match(page, /if \(selected && !nodes\.some\(node => node\.id === selected\)\) setSelected\(null\)/, 'stale selection must be reaped');
  assert.match(page, /const next = new Set\(\[\.\.\.previous\]\.filter\(id => nodes\.some\(node => node\.id === id\)\)\)/, 'multi-selection must be pruned to existing nodes');
});

test('contract (9-11): node-anchored floating layers are reaped with their source node', () => {
  // 用户 9-11: 中央弹窗上传后删除节点, 右侧派生菜单(connectionPicker)仍残留。
  // 根因: 上传完成会 openConnectionPickerForNode, 而删除路径(Delete 键/多选删除)不清 picker。
  // 结构性防御: 回收器 effect 监听 nodes, 源节点消失即回收全部节点锚定浮层;
  // handleDelete 同时即时清理, 双保险。
  const page = pageSource();
  assert.match(
    page,
    /setConnectionPicker\(previous => \(\s*previous\?\.sourceNodeId && !nodes\.some\(node => node\.id === previous\.sourceNodeId\)\s*\? null : previous\s*\)\)/,
    'stale derive-menu picker must be reaped when its source node leaves nodes',
  );
  assert.match(
    page,
    /setFocusedEditor\(previous => \(\s*previous\?\.nodeId && !nodes\.some\(node => node\.id === previous\.nodeId\)\s*\? null : previous\s*\)\)/,
    'stale focused editor must be reaped when its node leaves nodes',
  );
  // 删除键路径(handleDelete)即时回收同款状态
  const deleteStart = page.indexOf('const handleDelete = useCallback');
  const deleteBlock = page.slice(deleteStart, page.indexOf('}, [selected, multiSelected]);', deleteStart));
  for (const setter of ['setConnectionPicker', 'setConnectionDraft', 'setFocusedEditor', 'setTextInspectorNodeId', 'setWatermarkPreview']) {
    assert.match(deleteBlock, new RegExp(setter + '\\('), 'handleDelete must reclaim ' + setter);
  }
});

test('derive menu rows use the balanced card anatomy with badge + arrow', () => {
  const source = studioSource();
  assert.match(source, /ec-canvas-derive-chip/);
  assert.match(source, /ec-canvas-derive-copy/);
  assert.match(source, /ec-canvas-derive-meta/);
  assert.match(source, /priceBadge/);
  assert.match(source, /<ArrowUpRight size=\{14\} \/>/);
  // 每行仍是 role=menuitem 且带 data-derive-action 钩子
  assert.match(source, /data-derive-action=\{action\.id\}/);
});

test('derive card css keeps three-column grid on token greys', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(css, /\.ec-canvas-derive-menu > button \{ grid-template-columns: 38px minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.ec-canvas-derive-menu \{ width: 324px; \}/);
  assert.match(css, /\.ec-canvas-derive-meta em \{/);
});
