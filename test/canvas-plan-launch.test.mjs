// test/canvas-plan-launch.test.mjs
// P7 方案入画布: 首页发射器 payload → 画布图 (纯函数层, 零 DOM/网络)。
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlanLaunch,
  planLaunchMaterialNodes,
  createPlanLaunchGraph,
  createCanvasDirectionNode,
} from '../src/pages/EcCanvas/canvasPlanLaunch.js';

const launch = {
  kind: 'ec-plan-launch',
  productName: '珍珠白耳机',
  description: '干净产品视觉',
  realShots: [{ assetId: 'a1', url: '/api/generated-assets/p1.png', name: '产品图 1' }],
  refShots: [{ assetId: 'r1', url: '/api/generated-assets/ref1.png' }],
  personShots: [],
  sceneShots: [{ assetId: 's1', url: '/api/generated-assets/scene1.png' }],
  platform: 'taobao',
  sizing: { smart: true, resolution: '2K' },
  genSettings: { imageModel: 'image2', resolution: '2K' },
  skus: [],
};

test('isPlanLaunch only accepts ec-plan-launch payloads', () => {
  assert.equal(isPlanLaunch(launch), true);
  assert.equal(isPlanLaunch({ kind: 'other' }), false);
  assert.equal(isPlanLaunch(null), false);
});

test('material nodes keep role order (产品→参考→模特→场景) and skip url-less assets', () => {
  const nodes = planLaunchMaterialNodes({ launch, now: 1 });
  assert.equal(nodes.length, 3);
  assert.deepEqual(nodes.map(node => node.role), ['product', 'reference', 'scene']);
  assert.deepEqual(nodes.map(node => node.displayLabel), ['产品图', '参考图', '场景图']);
  assert.equal(nodes[0].url, '/api/generated-assets/p1.png');
  assert.equal(nodes[0].name, '产品图 1');
  const noUrl = planLaunchMaterialNodes({ launch: { realShots: [{ assetId: 'x' }] }, now: 1 });
  assert.equal(noUrl.length, 0, '无 url 的素材不产节点');
});

test('standard launch: 素材按列排 + 提示词节点 + 设计方案节点 (全部连到方案)', () => {
  const graph = createPlanLaunchGraph({ launch, now: 1 });
  assert.equal(graph.targetKind, 'design-direction');
  /* 9-12 用户批注：3 素材 + 提示词节点 + 方案节点 = 5 */
  assert.equal(graph.nodes.length, 5, '3 素材 + 提示词 + 方案');
  assert.equal(graph.connections.length, 4, '每个素材与提示词各一条连线');
  const target = graph.nodes.find(node => node.id === graph.targetId);
  assert.equal(target.kind, 'design-direction');
  const roles = target.sourceNodeIds.map(id => graph.nodes.find(node => node.id === id));
  assert.deepEqual(roles.filter(node => node.kind === 'image').map(node => node.role), ['product', 'reference', 'scene']);
  assert.ok(roles.some(node => node.kind === 'text'), '提示词节点必须是方案节点的来源之一');
  assert.equal(target.prompt, '干净产品视觉');
  assert.equal(target.productName, '珍珠白耳机');
  for (const conn of graph.connections) {
    assert.equal(conn.toNodeId, graph.targetId);
  }
  /* 列排：产品图 → 参考图 → 场景图 依次往右；提示词在素材右侧；方案在最右 */
  const columnX = ['product', 'reference', 'scene'].map(role => graph.nodes.find(node => node.role === role).x);
  assert.ok(columnX[0] < columnX[1] && columnX[1] < columnX[2], '每种素材一列，向右推进');
  const promptNode = graph.nodes.find(node => node.kind === 'text');
  assert.ok(promptNode.x > columnX[2], '提示词在素材列右侧');
  assert.ok(target.x > promptNode.x, '方案节点在提示词右侧');
});

test('quick launch: 跳过方案, 直接套图生成节点 (prompt/配置带入, 不扣设计分析费)', () => {
  const quick = { ...launch, quick: true };
  const graph = createPlanLaunchGraph({ launch: quick, now: 1 });
  assert.equal(graph.targetKind, 'suite-composer');
  const target = graph.nodes.find(node => node.id === graph.targetId);
  assert.equal(target.prompt, '干净产品视觉');
  assert.equal(target.configuration.sizing.smart, true);
  assert.equal(target.configuration.genSettings.imageModel, 'image2');
  assert.equal(target.directions, undefined, '快速通道不带方案对象');
});

test('no materials: 仍然带提示词节点（提示词不是素材，必须留下）', () => {
  const graph = createPlanLaunchGraph({ launch: { kind: 'ec-plan-launch', description: 'x' }, now: 1 });
  assert.equal(graph.nodes.length, 2, '提示词节点 + 方案节点');
  assert.equal(graph.nodes.filter(node => node.kind === 'image').length, 0, '没有素材节点');
  assert.equal(graph.connections.length, 1, '提示词 → 方案');
  assert.equal(graph.targetKind, 'design-direction');
});

test('direction node factory defaults (draft 态, 空 directions)', () => {
  const node = createCanvasDirectionNode({ now: 9, ecParams: launch });
  assert.equal(node.kind, 'design-direction');
  assert.equal(node.status, 'draft');
  assert.deepEqual(node.directions, []);
  assert.equal(node.ecParams.description, '干净产品视觉');
});
