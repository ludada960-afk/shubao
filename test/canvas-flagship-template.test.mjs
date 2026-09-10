import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRunPlan, createGraphRunner, buildTransitiveDownstream } from '../src/pages/EcCanvas/canvasGraphRunController.js';
import { markStaleDownstream } from '../src/pages/EcCanvas/canvasGraphEngine.js';

/* 旗舰模板 T1「白底主图」的最小可整链子图：
   商品图(image,0) → 抠图(remove-bg,4) → 放大(upscale,6)。全部在 P0.5 支持的 kind 内。*/
const SUPPORTED = new Set(['image-composer','remove-bg','extend','inpaint','translate','upscale','layer-workbench','suite-composer','smart-remix']);
const COST = { image: 0, 'remove-bg': 4, upscale: 6 };
const costOf = (n) => COST[n.kind] || 0;

test('flagship template: plan order + cost + runner + source-invalidation', async () => {
  const nodes = [
    { id: 'goods', kind: 'image', url: 'https://x/goods.jpg' },
    { id: 'cutout', kind: 'remove-bg', status: 'draft' },
    { id: 'big', kind: 'upscale', status: 'draft' },
  ];
  const connections = [
    { fromNodeId: 'goods', toNodeId: 'cutout' },
    { fromNodeId: 'cutout', toNodeId: 'big' },
  ];
  // 目标 = 最下游 big，子图自动带上全部上游
  const plan = buildRunPlan({ nodes, connections, targetNodeIds: ['big'], supportedKinds: SUPPORTED, costOf });
  assert.equal(plan.ok, true);
  assert.deepEqual(new Set(plan.executableNodeIds), new Set(['cutout', 'big'])); // 有执行器的才真跑
  assert.deepEqual(new Set(plan.sourceNodeIds), new Set(['goods']));            // 上传的图=源，不花钱不跑
  assert.equal(plan.estimatedUnits, 10); // 4 + 6（源节点不计）
  assert.deepEqual(new Set(plan.layers.flat()), new Set(['goods', 'cutout', 'big']));

  // 跑一遍（假执行器）：全成功
  const execOrder = [];
  const res = await createGraphRunner({
    plan,
    downstream: buildTransitiveDownstream(nodes, connections),
    supportedKinds: SUPPORTED,
    runNode: async (id) => { execOrder.push(id); },
    awaitTerminal: async () => 'success',
    signal: new AbortController().signal,
  });
  assert.deepEqual(new Set(res.succeeded), new Set(['goods', 'cutout', 'big']));
  assert.deepEqual(res.failed, []);
  assert.deepEqual(res.blocked, []);
  assert.deepEqual(execOrder, ['cutout', 'big']); // 源节点不"跑"，只有可执行节点进 execOrder

  // 换素材（goods.url 变了）→ 下游 cutout/big 标 stale
  const changed = nodes.map(n => n.id === 'goods' ? { ...n, url: 'https://x/goods-v2.jpg' } : n);
  const { nodes: after, staleNodeIds } = markStaleDownstream({ nodes: changed, connections, changedNodeId: 'goods' });
  assert.deepEqual(new Set(staleNodeIds), new Set(['cutout', 'big']));
  assert.equal(after.find(n => n.id === 'cutout').status, 'stale');
  assert.equal(after.find(n => n.id === 'big').status, 'stale');
  assert.equal(after.find(n => n.id === 'goods').status, undefined); // 源头自身不标脏
});

test('flagship template: a mid-chain failure blocks only its downstream, not the source', async () => {
  const nodes = [
    { id: 'goods', kind: 'image', url: 'https://x/goods.jpg' }, // 有产物 → 源节点(可用)
    { id: 'cutout', kind: 'remove-bg' },
    { id: 'big', kind: 'upscale' },
    { id: 'scene', kind: 'image-composer' }, // 与 cutout/big 无关的旁支
  ];
  const connections = [
    { fromNodeId: 'goods', toNodeId: 'cutout' },
    { fromNodeId: 'cutout', toNodeId: 'big' },
    { fromNodeId: 'goods', toNodeId: 'scene' },
  ];
  const plan = buildRunPlan({ nodes, connections, targetNodeIds: ['big', 'scene'], supportedKinds: SUPPORTED, costOf });
  const res = await createGraphRunner({
    plan,
    downstream: buildTransitiveDownstream(nodes, connections),
    supportedKinds: SUPPORTED,
    runNode: async () => {},
    awaitTerminal: async (id) => (id === 'cutout' ? 'error' : 'success'),
    signal: new AbortController().signal,
  });
  assert.deepEqual(res.failed, ['cutout']);
  assert.deepEqual(new Set(res.blocked), new Set(['big'])); // big 被阻塞
  assert.ok(res.succeeded.includes('scene')); // 旁支照跑
  assert.ok(res.succeeded.includes('goods'));
});
