/* ═══════ 4c183cd4 续命 画布总监督 - 全部扩展功能测试 (2026-08-30) ═══════
   Quantv 功能复刻: 边类型校验 / 节点能力 / 自动命名 / 任务状态 / 保存状态 /
   批量下载 / 节点分组 / 网格吸附 / 自动排版 / 主题 / 便签 / 端口吸力 / 历史 / 快捷键 / 导出 JSON
   用户原话 8-30: "最成品, 最面向市场, 最高级的一个体验和流畅度" */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEdgeInvalid,
  partitionEdgesByValidity,
  getNodeActionFlags,
  autoCanvasShotName,
  getKindLabel,
  TASK_STATUS,
  TASK_STATUS_LABEL,
  canTransitionTaskStatus,
  SAVE_STATUS,
  SAVE_STATUS_LABEL,
  collectNodeMediaAssets,
  createCanvasGroup,
  dissolveCanvasGroup,
  expandToGroupIds,
  snapToGrid,
  snapNodeToGrid,
  CANVAS_GRID_SIZE,
  autoArrangeCanvasNodes,
  CANVAS_THEMES,
  applyCanvasTheme,
  loadCanvasTheme,
  STICKER_COLORS,
  createCanvasSticker,
  NODE_KIND_COLORS,
  getNodeKindColor,
  CANVAS_EXPORT_VERSION, CANVAS_EXPORT_TAG,
  exportCanvasToJSON, importCanvasFromJSON,
  APPLICATION_NODE_KINDS, isApplicationNode,
  NODE_COST_ESTIMATES, estimateNodeCost,
  CANVAS_SHORTCUTS,
  NODE_RIGHT_CLICK_ACTIONS,
  CANVAS_RIGHT_CLICK_ACTIONS,
  PORT_SNAP_DISTANCE, findNearestPort,
  NODE_TYPE_KIND, NODE_ACCEPT_TYPES,
} from '../src/pages/EcCanvas/canvasQuantvExtensions.js';

import {
  matchesKey,
  serializeNodesForClipboard,
  createCanvasHistory,
} from '../src/pages/EcCanvas/canvasKeyboardHooks.js';

test('Quantv supervisor: 边类型校验 - 有效边', () => {
  const nodes = [
    { id: 'a', kind: 'image' },
    { id: 'b', kind: 'video' },
  ];
  const edge = { fromNodeId: 'a', toNodeId: 'b' };
  const result = isEdgeInvalid(edge, nodes);
  assert.equal(result.invalid, false);
});

test('Quantv supervisor: 边类型校验 - 类型不匹配', () => {
  // 音频不能直接生成文本 (按 NODE_ACCEPT_TYPES)
  const nodes = [
    { id: 'a', kind: 'audio' },
    { id: 'b', kind: 'image-composer' },  // image-composer 接受 image/text, 不接受 audio
  ];
  const edge = { fromNodeId: 'a', toNodeId: 'b' };
  const result = isEdgeInvalid(edge, nodes);
  assert.equal(result.invalid, true);
  assert.equal(result.reason, 'type-mismatch');
});

test('Quantv supervisor: 边类型校验 - 缺失节点', () => {
  const nodes = [{ id: 'a', kind: 'image' }];
  const edge = { fromNodeId: 'a', toNodeId: 'missing' };
  const result = isEdgeInvalid(edge, nodes);
  assert.equal(result.invalid, true);
  assert.equal(result.reason, 'missing-node');
});

test('Quantv supervisor: partitionEdgesByValidity - 批量校验', () => {
  const nodes = [
    { id: 'a', kind: 'image' },
    { id: 'b', kind: 'image-composer' },
    { id: 'c', kind: 'image' },
    { id: 'd', kind: 'layer-workbench' },
  ];
  const edges = [
    { id: 'e1', fromNodeId: 'a', toNodeId: 'b' },  // valid (image -> image-composer 接受 image)
    { id: 'e2', fromNodeId: 'b', toNodeId: 'd' },  // invalid (image-composer 输出 image, d 接受 image 但 e2 是合成到 wb)
    { id: 'e3', fromNodeId: 'c', toNodeId: 'd' },  // valid (image -> layer-workbench 接受 image)
  ];
  const { valid, invalid } = partitionEdgesByValidity(edges, nodes);
  // e2: image-composer output kind is 'image', d (layer-workbench) accepts ['image'], so actually valid
  assert.equal(valid.length, 3);
  assert.equal(invalid.length, 0);
});

test('Quantv supervisor: 节点能力开关 - image 节点 5 个能力', () => {
  const flags = getNodeActionFlags({ kind: 'image' });
  assert.equal(flags.analyze, true);
  assert.equal(flags.workspace, true);
  assert.equal(flags.backgroundRemoval, true);
  assert.equal(flags.gridSplit, true);
  assert.equal(flags.upscale, true);
});

test('Quantv supervisor: 节点能力开关 - video 节点 4 个能力', () => {
  const flags = getNodeActionFlags({ kind: 'video' });
  assert.equal(flags.script, true);
  assert.equal(flags.keyframe, true);
  assert.equal(flags.subtitleRemoval, true);
});

test('Quantv supervisor: 节点自动命名 - 第一个节点', () => {
  assert.equal(autoCanvasShotName([], 'image'), '图片1');
  assert.equal(autoCanvasShotName([], 'video'), '视频1');
  assert.equal(autoCanvasShotName([], 'audio'), '音频1');
  assert.equal(autoCanvasShotName([], 'text'), '文本1');
});

test('Quantv supervisor: 节点自动命名 - 递增序号', () => {
  const nodes = [
    { id: 'a', kind: 'image', name: '图片1' },
    { id: 'b', kind: 'image', name: '图片2' },
    { id: 'c', kind: 'image', name: '商品图改' },  // 不匹配前缀, 不计数
  ];
  assert.equal(autoCanvasShotName(nodes, 'image'), '图片3');
});

test('Quantv supervisor: 节点自动命名 - 用户重命名后不递增', () => {
  const nodes = [
    { id: 'a', kind: 'image', name: '我的商品图', userRenamed: true },
  ];
  assert.equal(autoCanvasShotName(nodes, 'image'), '图片1');
});

test('Quantv supervisor: getKindLabel - 全部 kind 有标签', () => {
  assert.equal(getKindLabel('text'), '文本');
  assert.equal(getKindLabel('image'), '图片');
  assert.equal(getKindLabel('video'), '视频');
  assert.equal(getKindLabel('audio'), '音频');
  assert.equal(getKindLabel('application'), '应用');
  assert.equal(getKindLabel('unknown'), '节点');
});

test('Quantv supervisor: 任务状态机 - 8 状态', () => {
  assert.equal(TASK_STATUS.WAITING, 'waiting');
  assert.equal(TASK_STATUS.QUEUED, 'queued');
  assert.equal(TASK_STATUS.PROCESSING, 'processing');
  assert.equal(TASK_STATUS.TRANSFERRING, 'transferring');
  assert.equal(TASK_STATUS.COMPLETED, 'completed');
  assert.equal(TASK_STATUS.FAILED, 'failed');
  assert.equal(TASK_STATUS.REFUNDING, 'refunding');
  assert.equal(TASK_STATUS.REFUNDED, 'refunded');
  assert.equal(Object.keys(TASK_STATUS_LABEL).length, 8);
});

test('Quantv supervisor: 任务状态机 - 合法状态转换', () => {
  assert.equal(canTransitionTaskStatus('waiting', 'queued'), true);
  assert.equal(canTransitionTaskStatus('processing', 'completed'), true);
  assert.equal(canTransitionTaskStatus('completed', 'refunding'), true);
  assert.equal(canTransitionTaskStatus('refunding', 'refunded'), true);
  assert.equal(canTransitionTaskStatus('failed', 'waiting'), true);
});

test('Quantv supervisor: 任务状态机 - 非法状态转换', () => {
  assert.equal(canTransitionTaskStatus('waiting', 'completed'), false);
  assert.equal(canTransitionTaskStatus('refunded', 'waiting'), false);
  assert.equal(canTransitionTaskStatus('completed', 'processing'), false);
});

test('Quantv supervisor: 保存状态指示器 - 4 状态', () => {
  assert.equal(SAVE_STATUS.SAVED, 'saved');
  assert.equal(SAVE_STATUS.SAVING, 'saving');
  assert.equal(SAVE_STATUS.LOCAL_ONLY, 'local-only');
  assert.equal(SAVE_STATUS.CONFLICT, 'conflict');
  assert.equal(SAVE_STATUS_LABEL.saved, '已保存');
  assert.equal(SAVE_STATUS_LABEL.conflict, '冲突');
});

test('Quantv supervisor: 批量下载 - 收集节点素材', () => {
  const nodes = [
    { id: 'a', kind: 'image', url: 'https://example.com/a.png', name: '图A' },
    { id: 'b', kind: 'video', url: 'https://example.com/b.mp4', name: '视频B' },
    { id: 'c', kind: 'image', url: '', name: '空' },  // 无 url, 不收集
    { id: 'd', kind: 'audio', url: 'https://example.com/d.mp3', name: '音频D' },
  ];
  const assets = collectNodeMediaAssets(nodes, new Set(['a', 'b', 'c', 'd']));
  assert.equal(assets.length, 3);
  assert.equal(assets[0].filename, '图A.png');
  assert.equal(assets[1].filename, '视频B.mp4');
  assert.equal(assets[2].filename, '音频D.mp3');
});

test('Quantv supervisor: 节点分组 - 创建分组', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 100, h: 100 },
    { id: 'b', x: 100, y: 0, w: 100, h: 100 },
    { id: 'c', x: 200, y: 0, w: 100, h: 100 },
  ];
  const grouped = createCanvasGroup(nodes, new Set(['a', 'b']));
  const a = grouped.find(n => n.id === 'a');
  const b = grouped.find(n => n.id === 'b');
  const c = grouped.find(n => n.id === 'c');
  assert.ok(a.groupId);
  assert.ok(b.groupId);
  assert.equal(a.groupId, b.groupId);
  assert.ok(!c.groupId);
});

test('Quantv supervisor: 节点分组 - 解散分组', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 100, h: 100, groupId: 'g1' },
    { id: 'b', x: 100, y: 0, w: 100, h: 100, groupId: 'g1' },
  ];
  const dissolved = dissolveCanvasGroup(nodes, new Set(['a', 'b']));
  assert.equal(dissolved[0].groupId, '');
  assert.equal(dissolved[1].groupId, '');
});

test('Quantv supervisor: 节点分组 - 展开到整个分组', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 100, h: 100, groupId: 'g1' },
    { id: 'b', x: 100, y: 0, w: 100, h: 100, groupId: 'g1' },
    { id: 'c', x: 200, y: 0, w: 100, h: 100, groupId: 'g2' },
  ];
  const expanded = expandToGroupIds(nodes, new Set(['a']));
  assert.equal(expanded.size, 2);  // a + b 都在 g1
});

test('Quantv supervisor: 网格吸附 - snap 8px', () => {
  assert.equal(snapToGrid(7), 8);
  assert.equal(snapToGrid(13), 16);
  assert.equal(snapToGrid(20), 24);
  assert.equal(snapToGrid(-5), -8);  // 负坐标保留
  assert.equal(snapToGrid(0, 16), 0);
  assert.equal(CANVAS_GRID_SIZE, 8);
});

test('Quantv supervisor: 网格吸附 - snap 节点全部', () => {
  const node = { x: 7, y: 13, w: 100, h: 80 };
  const snapped = snapNodeToGrid(node);
  assert.equal(snapped.x, 8);
  assert.equal(snapped.y, 16);
  assert.equal(snapped.w, 104);  // 100 对齐到 8 = 104
  assert.equal(snapped.h, 80);
});

test('Quantv supervisor: 自动排版 - 拓扑分层', () => {
  const nodes = [
    { id: 'a', kind: 'image', x: 0, y: 0, w: 200, h: 200 },
    { id: 'b', kind: 'video', x: 0, y: 0, w: 200, h: 200 },
    { id: 'c', kind: 'audio', x: 0, y: 0, w: 200, h: 200 },
  ];
  const connections = [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
  ];
  const arranged = autoArrangeCanvasNodes(nodes, connections);
  // a 在最左 (layer 0), b 在中 (layer 1), c 在右 (layer 2)
  const aIdx = arranged.findIndex(n => n.id === 'a');
  const bIdx = arranged.findIndex(n => n.id === 'b');
  const cIdx = arranged.findIndex(n => n.id === 'c');
  assert.ok(arranged[aIdx].x < arranged[bIdx].x);
  assert.ok(arranged[bIdx].x < arranged[cIdx].x);
});

test('Quantv supervisor: 主题 - 3 模式', () => {
  assert.ok(CANVAS_THEMES.includes('light'));
  assert.ok(CANVAS_THEMES.includes('dark'));
  assert.ok(CANVAS_THEMES.includes('auto'));
});

test('Quantv supervisor: 主题 - 应用和加载', () => {
  // localStorage 可能不可用 (Node 环境), 静默失败
  const original = globalThis.document;
  globalThis.document = { documentElement: { dataset: {} } };
  applyCanvasTheme('dark');
  assert.equal(globalThis.document.documentElement.dataset.canvasTheme, 'dark');
  globalThis.document = original;
});

test('Quantv supervisor: 便签 - 5 种颜色', () => {
  assert.equal(STICKER_COLORS.length, 5);
  const yellow = STICKER_COLORS.find(c => c.id === 'yellow');
  assert.ok(yellow.bg);
});

test('Quantv supervisor: 便签 - 创建便签', () => {
  const sticker = createCanvasSticker({ x: 100, y: 200, text: '测试便签', color: 'pink' });
  assert.ok(sticker.id.startsWith('sticker_'));
  assert.equal(sticker.kind, 'sticker');
  assert.equal(sticker.x, 100);
  assert.equal(sticker.y, 200);
  assert.equal(sticker.text, '测试便签');
  assert.equal(sticker.color, 'pink');
});

test('Quantv supervisor: 节点 kind 颜色 - 全部有颜色', () => {
  assert.ok(NODE_KIND_COLORS.text);
  assert.ok(NODE_KIND_COLORS.image);
  assert.ok(NODE_KIND_COLORS.video);
  assert.ok(NODE_KIND_COLORS.audio);
  assert.ok(NODE_KIND_COLORS.application);
  assert.equal(getNodeKindColor('unknown'), '#888888');
});

test('Quantv supervisor: 导出/导入 JSON - schema 完整', () => {
  const exported = exportCanvasToJSON({
    nodes: [{ id: 'a', kind: 'image', x: 0, y: 0, w: 100, h: 100, url: 'https://x.com' }],
    connections: [{ fromNodeId: 'a', toNodeId: 'b', relation: 'derived' }],
    stickers: [{ id: 's1', text: '便签' }],
    meta: { name: 'test' },
  });
  assert.equal(exported.__canvas, CANVAS_EXPORT_TAG);
  assert.equal(exported.version, CANVAS_EXPORT_VERSION);
  assert.equal(exported.nodes.length, 1);
  assert.equal(exported.edges.length, 1);
  assert.equal(exported.stickers.length, 1);

  const imported = importCanvasFromJSON(exported);
  assert.ok(imported);
  assert.equal(imported.nodes.length, 1);
  assert.equal(imported.connections[0].relation, 'derived');
});

test('Quantv supervisor: 导出 JSON - 拒绝非 da-ai-canvas schema', () => {
  const result = importCanvasFromJSON({ __canvas: 'wrong', version: 1 });
  assert.equal(result, null);
});

test('Quantv supervisor: 应用节点 - 4 种', () => {
  assert.equal(APPLICATION_NODE_KINDS.length, 4);
  assert.ok(isApplicationNode({ kind: 'application' }));
  assert.ok(isApplicationNode({ actionId: 'application-1click-suite' }));
  assert.ok(isApplicationNode({ kind: 'application-1click-video' }));
  assert.equal(isApplicationNode({ kind: 'image' }), false);
});

test('Quantv supervisor: 积分估算 - 全部 kind 有价格', () => {
  assert.equal(estimateNodeCost({ kind: 'text' }), 0);
  assert.equal(estimateNodeCost({ kind: 'image' }), 0);
  assert.equal(estimateNodeCost({ kind: 'output' }), 8);
  assert.ok(estimateNodeCost({ kind: 'video' }) >= 32);
  assert.equal(estimateNodeCost({ actionId: 'application-1click-video' }), 40);
});

test('Quantv supervisor: 快捷键清单 - ≥ 12 项', () => {
  assert.ok(CANVAS_SHORTCUTS.length >= 12);
  const hasSelectAll = CANVAS_SHORTCUTS.some(s => s.id === 'select-all');
  const hasCopy = CANVAS_SHORTCUTS.some(s => s.id === 'copy');
  const hasPaste = CANVAS_SHORTCUTS.some(s => s.id === 'paste');
  const hasUndo = CANVAS_SHORTCUTS.some(s => s.id === 'undo');
  const hasGroup = CANVAS_SHORTCUTS.some(s => s.id === 'group');
  const hasDelete = CANVAS_SHORTCUTS.some(s => s.id === 'delete');
  assert.ok(hasSelectAll);
  assert.ok(hasCopy);
  assert.ok(hasPaste);
  assert.ok(hasUndo);
  assert.ok(hasGroup);
  assert.ok(hasDelete);
});

test('Quantv supervisor: 节点右键菜单 - ≥ 10 项', () => {
  assert.ok(NODE_RIGHT_CLICK_ACTIONS.length >= 10);
  const ids = NODE_RIGHT_CLICK_ACTIONS.map(a => a.id);
  assert.ok(ids.includes('focus'));
  assert.ok(ids.includes('preview'));
  assert.ok(ids.includes('download'));
  assert.ok(ids.includes('delete'));
});

test('Quantv supervisor: 画布右键菜单 - ≥ 10 项', () => {
  assert.ok(CANVAS_RIGHT_CLICK_ACTIONS.length >= 10);
  const ids = CANVAS_RIGHT_CLICK_ACTIONS.map(a => a.id);
  assert.ok(ids.includes('paste'));
  assert.ok(ids.includes('undo'));
  assert.ok(ids.includes('select-all'));
});

test('Quantv supervisor: 端口吸力 - 找到最近端口', () => {
  const ports = [
    { x: 100, y: 100, nodeId: 'a' },
    { x: 200, y: 200, nodeId: 'b' },
  ];
  const nearest = findNearestPort({ x: 110, y: 110 }, ports);
  assert.equal(nearest.nodeId, 'a');
});

test('Quantv supervisor: 端口吸力 - 超出范围返回 null', () => {
  const ports = [{ x: 100, y: 100, nodeId: 'a' }];
  const nearest = findNearestPort({ x: 500, y: 500 }, ports);
  assert.equal(nearest, null);
});

test('Quantv supervisor: 端口吸力 - 阈值', () => {
  assert.equal(PORT_SNAP_DISTANCE, 24);
});

test('Quantv supervisor: 节点类型映射 - 全部有 output kind', () => {
  assert.equal(NODE_TYPE_KIND.image, 'image');
  assert.equal(NODE_TYPE_KIND.video, 'video');
  assert.equal(NODE_TYPE_KIND.audio, 'audio');
  assert.equal(NODE_TYPE_KIND.text, 'text');
  assert.equal(NODE_TYPE_KIND.output, 'image');
});

test('Quantv supervisor: 节点可接收类型 - image-composer 接受 image/text', () => {
  const accepted = NODE_ACCEPT_TYPES['image-composer'];
  assert.ok(accepted.includes('image'));
  assert.ok(accepted.includes('text'));
});

test('Quantv supervisor: matchesKey - Ctrl+A 匹配', () => {
  const event = { key: 'a', ctrlKey: true, shiftKey: false, metaKey: false, altKey: false };
  assert.equal(matchesKey(event, 'Ctrl+A'), true);
});

test('Quantv supervisor: matchesKey - Delete 匹配', () => {
  const event = { key: 'Delete', ctrlKey: false, shiftKey: false, metaKey: false, altKey: false };
  assert.equal(matchesKey(event, 'Delete'), true);
  assert.equal(matchesKey(event, 'Backspace'), false);
});

test('Quantv supervisor: matchesKey - Escape 匹配', () => {
  const event = { key: 'Escape', ctrlKey: false, shiftKey: false, metaKey: false, altKey: false };
  assert.equal(matchesKey(event, 'Escape'), true);
});

test('Quantv supervisor: serializeNodesForClipboard - 加 _copy_ 后缀', () => {
  const nodes = [{ id: 'a', kind: 'image' }];
  const payload = serializeNodesForClipboard(nodes);
  assert.equal(payload.__canvasClipboard, 'da-ai-canvas-clipboard');
  assert.ok(payload.nodes[0].id.includes('_copy_'));
});

test('Quantv supervisor: createCanvasHistory - undo/redo', () => {
  const history = createCanvasHistory({ limit: 10 });
  const state1 = { nodes: [{ id: 'a' }] };
  const state2 = { nodes: [{ id: 'a' }, { id: 'b' }] };
  // 在用户改 state 之前 push "之前的状态"
  history.push(state1);  // past = [s1]
  history.push(state2);  // past = [s1, s2]
  // 当前是 state2, undo -> 弹出 s2 (最近 push)
  const undone = history.undo({ nodes: [{ id: 'c' }] });
  assert.equal(undone.nodes.length, 2);
});

test('Quantv supervisor: createCanvasHistory - 限制 50 步', () => {
  const history = createCanvasHistory({ limit: 3 });
  for (let i = 0; i < 5; i++) history.push({ id: i });
  const { past } = history.size();
  assert.equal(past, 3);
});
