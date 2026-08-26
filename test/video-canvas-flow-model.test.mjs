import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toFlowNodes, toFlowEdges, canvasIsValidConnection, buildFlowNodes, EDGE_KINDS } from '../src/pages/VideoStudio/videoCanvasFlowModel.js';

const domainNodes = [
  { id: 'a1', type: 'asset', title: '素材A' },
  { id: 's1', type: 'shot', title: '镜头一' },
  { id: 'c1', type: 'candidate', shotId: 's1', title: '候选' },
];

test('toFlowNodes 映射为 React Flow 结构并保留数据', () => {
  const flow = toFlowNodes(domainNodes);
  assert.equal(flow.length, 3);
  const shot = flow.find(n => n.id === 's1');
  assert.equal(shot.type, 'shubaoShot');
  assert.equal(shot.data.title, '镜头一');
  assert.ok(Number.isFinite(shot.position.x) && Number.isFinite(shot.position.y));
});

test('buildFlowNodes 从工作台输入构建', () => {
  const flow = buildFlowNodes({ workbench: { assets: [{ id: 'wa1', name: '商品A', versions: [{ id: 'v1', stableUrl: 'x' }] }], shots: [{ id: 'sh1', purpose: '开箱' }] } });
  const types = new Set(flow.map(n => n.data.type));
  assert.ok(types.has('asset') && types.has('shot'));
});

test('toFlowEdges 按种类着色且跳过未解析源', () => {
  const edges = toFlowEdges([
    { id: 'e1', from: 'a1', to: 's1', kind: 'first_frame', label: '首帧链' },
    { id: 'e2', from: '', to: 's1', kind: 'last_frame' },
    { id: 'e3', from: 'ghost', to: 's1', kind: 'binding' },
  ], ['a1', 's1']);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].style.stroke, EDGE_KINDS.first_frame.stroke);
  assert.equal(edges[0].source, 'a1');
});

test('canvasIsValidConnection 端口语义', () => {
  const nodes = toFlowNodes(domainNodes);
  const ok = canvasIsValidConnection({ source: 'a1', target: 's1' }, { nodes });
  assert.equal(ok, true);
  assert.equal(canvasIsValidConnection({ source: 's1', target: 'a1' }, { nodes }), false);
  assert.equal(canvasIsValidConnection({ source: 'c1', target: 's1' }, { nodes }), false);
  assert.equal(canvasIsValidConnection({ source: 'a1', target: 'c1' }, { nodes }), false);
  assert.equal(canvasIsValidConnection({ source: 'a1', target: 'a1' }, { nodes }), false);
});
