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

test('standard launch: 素材行 + 设计方案节点 (连线 素材→方案)', () => {
  const graph = createPlanLaunchGraph({ launch, now: 1 });
  assert.equal(graph.targetKind, 'design-direction');
  assert.equal(graph.nodes.length, 4, '3 素材 + 1 方案');
  assert.equal(graph.connections.length, 3);
  const target = graph.nodes.find(node => node.id === graph.targetId);
  assert.equal(target.kind, 'design-direction');
  assert.deepEqual(target.sourceNodeIds.map(id => graph.nodes.find(node => node.id === id)?.role), ['product', 'reference', 'scene']);
  assert.equal(target.prompt, '干净产品视觉');
  assert.equal(target.productName, '珍珠白耳机');
  for (const conn of graph.connections) {
    assert.equal(conn.toNodeId, graph.targetId);
  }
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

test('no materials: 目标节点退到默认坐标, 连线为空', () => {
  const graph = createPlanLaunchGraph({ launch: { kind: 'ec-plan-launch', description: 'x' }, now: 1 });
  assert.equal(graph.nodes.length, 1);
  assert.deepEqual(graph.connections, []);
  assert.equal(graph.targetKind, 'design-direction');
});

test('direction node factory defaults (draft 态, 空 directions)', () => {
  const node = createCanvasDirectionNode({ now: 9, ecParams: launch });
  assert.equal(node.kind, 'design-direction');
  assert.equal(node.status, 'draft');
  assert.deepEqual(node.directions, []);
  assert.equal(node.ecParams.description, '干净产品视觉');
});
