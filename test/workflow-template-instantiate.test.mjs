/* P2 Stage 1 前端契约测试: 工作流模板"一键铺开" 的纯逻辑半边（不联网、不部署）。
   覆盖:
   1. T2（model-try-on）入边顺序 = @图片N 编号（collectRunInputs 只读图边）;
   2. 无入边节点: collectRunInputs 空结构 + legacyComposerSourceIds 回退 = 旧并集逐字节一致（回归护栏）;
   3. T4/T5（requiresAudioVideo）P3 门控标记（不 mock、不提供扣费运行）。
   图数据直接用 server/templates/builtinTemplates.mjs 的真实内置模板（纯数据模块, 无服务端依赖）。
   Stage 2（连线@引用合一: mention->edge 迁移 + @菜单双向同步）见 p2-stage2.diff 的测试追加段。*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_WORKFLOW_TEMPLATES } from '../server/templates/builtinTemplates.mjs';
import {
  collectRunInputs,
  legacyComposerSourceIds,
  workflowSlotIds,
  markP3PendingNodes,
} from '../src/pages/EcCanvas/workflowTemplates.js';

const bySlug = slug => BUILTIN_WORKFLOW_TEMPLATES.find(t => t.slug === slug);

test('T2 模特试穿: 入边顺序 = @图片N 编号（图 = 唯一真源）', () => {
  const t2 = bySlug('model-try-on');
  assert.equal(t2.requiresAudioVideo, false, 'T2 是本期可端到端跑的纯图链');
  assert.equal(t2.runnableThisPhase, true);
  const { nodes, connections } = t2.graph;

  /* 槽位: 铺开后琥珀高亮的节点（isSlot/slot 标记 + 空 url）。*/
  assert.deepEqual(workflowSlotIds(nodes), ['slot-garment', 'slot-model']);

  /* 空槽没有产物 -> sources 仍按入边顺序登记（sources 记录所有可解析上游）, 但 images 为空。*/
  const emptyInputs = collectRunInputs('try-on', connections, nodes);
  assert.deepEqual(emptyInputs.sources, ['slot-garment', 'slot-model'], '入边顺序（connections 数组出现顺序）');
  assert.deepEqual(emptyInputs.images, [], '空槽暂无产物');

  /* 槽位填上商品图后: @图片1 = 第 1 条入边, @图片2 = 第 2 条入边（index 逐一对应）。*/
  const filled = nodes.map(node => String(node.id).startsWith('slot') ? { ...node, url: 'https://example.com/' + node.id + '.png' } : node);
  const inputs = collectRunInputs('try-on', connections, filled);
  assert.deepEqual(
    inputs.images.map(item => [item.nodeId, item.index]),
    [['slot-garment', 1], ['slot-model', 2]],
    '@图片N 编号 = 入边顺序',
  );
  const threeView = collectRunInputs('three-view', connections, filled);
  assert.deepEqual(threeView.sources, ['slot-model'], '三视图只吃模特图入边');
  assert.deepEqual(threeView.images.map(item => item.index), [1]);
});

test('无入边节点: 图收集为空 -> 回退旧并集, 与 P0 无图契约逐字节一致（回归护栏）', () => {
  const composer = {
    id: 'composer-1',
    sourceNodeIds: ['a', 'b'],
    mentionSourceNodeIds: ['c', 'a'],
  };
  const nodes = [
    { id: 'a', kind: 'image', url: 'https://example.com/a.png' },
    { id: 'b', kind: 'image', url: 'https://example.com/b.png' },
    { id: 'c', kind: 'image', url: 'https://example.com/c.png' },
    { id: 'composer-1', kind: 'image-composer', sourceNodeIds: ['a', 'b'], mentionSourceNodeIds: ['c', 'a'] },
  ];
  const run = collectRunInputs(composer.id, [], nodes);
  assert.deepEqual(run, { images: [], texts: [], videos: [], audios: [], sources: [] }, '无入边必须返回全空结构');

  /* 切出的纯函数必须与改动前的内联并集逻辑逐字节等价（同一公式独立复算）。*/
  const legacy = legacyComposerSourceIds(composer);
  const oldInline = [...new Set([...(composer.sourceNodeIds || []), ...(composer.mentionSourceNodeIds || [])])];
  assert.deepEqual(legacy, oldInline, 'legacyComposerSourceIds ≡ 旧并集（去重 + source 在前 mention 在后）');

  /* index.jsx 三处请求组装的新口径: 有入边走图, 无入边原样回退 —— 老图行为不变。*/
  const composerSourceIds = run.sources.length ? run.sources : legacyComposerSourceIds(composer);
  assert.deepEqual(composerSourceIds, oldInline);
  assert.deepEqual(composerSourceIds, ['a', 'b', 'c']);
});

test('T4/T5 requiresAudioVideo: P3 门控标记（不 mock、不提供扣费运行）', () => {
  const t4 = bySlug('outfit-video');
  const t5 = bySlug('voiceover');
  assert.equal(t4.requiresAudioVideo, true);
  assert.equal(t5.requiresAudioVideo, true);
  for (const slug of ['white-bg-main', 'model-try-on', 'scene-detail']) {
    assert.equal(bySlug(slug).requiresAudioVideo, false, slug + ' 不是 P3 门控');
  }

  const marked4 = markP3PendingNodes(t4.graph.nodes, t4.requiresAudioVideo);
  const flagOf = id => marked4.find(node => node.id === id)?.p3Pending === true;
  assert.ok(flagOf('final-video'), 'video-composer 成片节点 = P3 灰态');
  assert.ok(flagOf('storyboard'), 'storyboard（P3 actionId）= P3 灰态');
  assert.ok(flagOf('slot-motion'), '视频槽位（P3 媒体 kind）= P3 灰态');
  assert.equal(flagOf('try-on'), false, 'T4 的 image-composer 节点不是 P3 门控');
  assert.equal(marked4.find(node => node.id === 'try-on')?.p3Pending, undefined);

  /* 入参不被改写（Object.freeze 的内置模板数据只读安全）。*/
  assert.equal(t4.graph.nodes.find(node => node.id === 'final-video').p3Pending, undefined);

  /* requiresAudioVideo=false 的模板: 一律不打 P3 标记（T2 全部可跑）。*/
  const t2 = bySlug('model-try-on');
  const marked2 = markP3PendingNodes(t2.graph.nodes, t2.requiresAudioVideo);
  assert.equal(marked2.some(node => node.p3Pending), false, 'T2 无 P3 灰态节点');
});

test('模板图 -> 实例化 snapshot 形状（instantiate API 契约: 可直接喂 createCanvasSnapshot）', () => {
  for (const template of BUILTIN_WORKFLOW_TEMPLATES) {
    const graph = template.graph;
    assert.ok(Array.isArray(graph.nodes) && graph.nodes.length, template.slug + ' 有节点');
    assert.ok(Array.isArray(graph.connections), template.slug + ' 有连线数组');
    const slotCount = workflowSlotIds(graph.nodes).length;
    if (template.slug === 'model-try-on') assert.equal(slotCount, 2, 'T2 两个槽位填齐即可端到端跑');
    /* 每条连线的两端都必须是图内节点（不造死边, 迁移/执行都不炸）。*/
    const ids = new Set(graph.nodes.map(node => String(node.id)));
    for (const edge of graph.connections) {
      assert.ok(ids.has(String(edge.fromNodeId)), template.slug + ': 连线起点在图内');
      assert.ok(ids.has(String(edge.toNodeId)), template.slug + ': 连线终点在图内');
      assert.equal(edge.relation, 'reference', template.slug + ': 连线统一 reference 关系');
    }
    /* 预估积分角标读 pricing（不变式③: 展示口径, 非结算）。*/
    assert.ok(Number.isFinite(Number(template.pricing?.estimatedUnits)), template.slug + ' pricing.estimatedUnits 可解析');
  }
});
