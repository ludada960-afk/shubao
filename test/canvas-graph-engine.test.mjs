/* P0 节点生态: 边 = 数据通道 (canvasGraphInputs) + 前端图执行引擎 (canvasGraphEngine)。
   最后一组断言直接执行 src/pages/EcCanvas/index.jsx 里 [canvas-graph-inputs:*] 标记之间的
   真实接线代码 —— 证明"没有任何入边的节点, 执行输入与改动前逐字节一致",
   而不是在测试里各自复述一遍公式。*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { collectNodeInputsFromEdges, createEmptyNodeInputs } from '../src/pages/EcCanvas/canvasGraphInputs.js';
import { markStaleDownstream, planGraphRun, selectReadyNodes } from '../src/pages/EcCanvas/canvasGraphEngine.js';

const PAGE = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

/* ═══════════════ 1. canvasGraphInputs · 边 = 数据通道 ═══════════════ */

test('no inbound edges returns the empty input structure (callers fall back to sourceNodeIds[0])', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png' },
    { id: 'target', kind: 'smart-remix', sourceNodeIds: ['img'] },
  ];
  assert.deepEqual(collectNodeInputsFromEdges(nodes[1], [], nodes), createEmptyNodeInputs());
  // 只有出边 / 指向别人的边, 同样不算输入
  const outbound = [{ fromNodeId: 'target', toNodeId: 'img' }];
  assert.deepEqual(collectNodeInputsFromEdges(nodes[1], outbound, nodes), createEmptyNodeInputs());
  assert.deepEqual(collectNodeInputsFromEdges(nodes[1], undefined, undefined), createEmptyNodeInputs());
  assert.deepEqual(collectNodeInputsFromEdges(undefined, [], nodes), createEmptyNodeInputs());
});

test('each modality numbers from 1 in inbound-edge order (edge order = @图片N)', () => {
  const nodes = [
    { id: 'img-1', kind: 'image', url: 'a.png' },
    { id: 'text-1', kind: 'text', text: '  卖点文案  ' },
    { id: 'img-2', kind: 'image', url: 'b.png' },
    { id: 'vid-1', kind: 'video', url: 'v.mp4' },
    { id: 'aud-1', kind: 'audio', url: 'a.mp3' },
    { id: 'target', kind: 'video-composer' },
  ];
  const connections = [
    { id: 'e1', fromNodeId: 'img-1', toNodeId: 'target', relation: 'reference' },
    { id: 'e2', fromNodeId: 'text-1', toNodeId: 'target', relation: 'derived' },
    { id: 'e3', fromNodeId: 'img-2', toNodeId: 'target', relation: 'reference' },
    { id: 'e4', fromNodeId: 'vid-1', toNodeId: 'target', relation: 'reference' },
    { id: 'e5', fromNodeId: 'aud-1', toNodeId: 'target', relation: 'reference' },
  ];
  assert.deepEqual(collectNodeInputsFromEdges(nodes[5], connections, nodes), {
    images: [
      { nodeId: 'img-1', url: 'a.png', index: 1 },
      { nodeId: 'img-2', url: 'b.png', index: 2 },
    ],
    texts: [{ nodeId: 'text-1', content: '卖点文案', index: 1 }],
    videos: [{ nodeId: 'vid-1', url: 'v.mp4', index: 1 }],
    audios: [{ nodeId: 'aud-1', url: 'a.mp3', index: 1 }],
    sources: ['img-1', 'text-1', 'img-2', 'vid-1', 'aud-1'],
  });
});

test('swapping the inbound order swaps @图片1 / @图片2 (variable = edge position)', () => {
  const nodes = [
    { id: 'img-1', kind: 'image', url: 'a.png' },
    { id: 'img-2', kind: 'image', url: 'b.png' },
    { id: 'target', kind: 'image-composer' },
  ];
  const forward = collectNodeInputsFromEdges(nodes[2], [
    { fromNodeId: 'img-1', toNodeId: 'target' },
    { fromNodeId: 'img-2', toNodeId: 'target' },
  ], nodes);
  const reversed = collectNodeInputsFromEdges(nodes[2], [
    { fromNodeId: 'img-2', toNodeId: 'target' },
    { fromNodeId: 'img-1', toNodeId: 'target' },
  ], nodes);
  assert.deepEqual(forward.images.map(image => [image.nodeId, image.index]), [['img-1', 1], ['img-2', 2]]);
  assert.deepEqual(reversed.images.map(image => [image.nodeId, image.index]), [['img-2', 1], ['img-1', 2]]);
});

test('duplicate edges from one upstream, self edges and dangling edges never double-number', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png' },
    { id: 'target', kind: 'smart-remix' },
  ];
  const connections = [
    { fromNodeId: 'img', toNodeId: 'target', relation: 'derived' },
    { fromNodeId: 'img', toNodeId: 'target', relation: 'reference' },   // 同一上游的第二条边
    { fromNodeId: 'target', toNodeId: 'target' },                       // 自环
    { fromNodeId: 'ghost', toNodeId: 'target' },                        // 上游已删除
  ];
  const inputs = collectNodeInputsFromEdges(nodes[1], connections, nodes);
  assert.deepEqual(inputs.images, [{ nodeId: 'img', url: 'a.png', index: 1 }]);
  assert.deepEqual(inputs.sources, ['img']);
});

test('upstream own url, output.urls and output.nodeIds all become image inputs', () => {
  const nodes = [
    { id: 'upload', kind: 'image', url: 'upload.png' },
    { id: 'remix', kind: 'smart-remix', output: { nodeIds: ['out-1', 'out-2'], urls: ['out-1.png', 'out-2.png'] } },
    { id: 'out-1', kind: 'output', url: 'out-1.png' },
    { id: 'out-2', kind: 'output', url: 'out-2.png' },
    { id: 'target', kind: 'image-composer' },
  ];
  const inputs = collectNodeInputsFromEdges(nodes[4], [
    { fromNodeId: 'remix', toNodeId: 'target' },
    { fromNodeId: 'upload', toNodeId: 'target' },
  ], nodes);
  assert.deepEqual(inputs.images, [
    { nodeId: 'remix', url: 'out-1.png', index: 1 },
    { nodeId: 'remix', url: 'out-2.png', index: 2 },
    { nodeId: 'upload', url: 'upload.png', index: 3 },
  ]);
});

test('source_group contributes every asset, and the url extension beats an unknown kind', () => {
  const nodes = [
    { id: 'group', kind: 'source_group', assets: [{ url: 'g1.png' }, { url: 'g2.png' }] },
    { id: 'mystery', kind: 'not-registered-yet', url: 'x.webm' },
    { id: 'app', kind: 'application', url: 'app.png' },
    { id: 'target', kind: 'smart-remix' },
  ];
  const inputs = collectNodeInputsFromEdges(nodes[3], [
    { fromNodeId: 'group', toNodeId: 'target' },
    { fromNodeId: 'mystery', toNodeId: 'target' },
    { fromNodeId: 'app', toNodeId: 'target' },
  ], nodes);
  assert.deepEqual(inputs.images, [
    { nodeId: 'group', url: 'g1.png', index: 1 },
    { nodeId: 'group', url: 'g2.png', index: 2 },
    { nodeId: 'app', url: 'app.png', index: 3 },
  ]);
  assert.deepEqual(inputs.videos, [{ nodeId: 'mystery', url: 'x.webm', index: 1 }]);
});

test('blank text upstreams are listed as sources but contribute no text', () => {
  const nodes = [
    { id: 'blank', kind: 'text', text: '   ' },
    { id: 'composer', kind: 'text-composer', text: '第二段文案' },
    { id: 'target', kind: 'smart-remix' },
  ];
  const inputs = collectNodeInputsFromEdges(nodes[2], [
    { fromNodeId: 'blank', toNodeId: 'target' },
    { fromNodeId: 'composer', toNodeId: 'target' },
  ], nodes);
  assert.deepEqual(inputs.texts, [{ nodeId: 'composer', content: '第二段文案', index: 1 }]);
  assert.deepEqual(inputs.sources, ['blank', 'composer']);
});

test('accepts a bare node id and never mutates or shares its result', () => {
  const nodes = [{ id: 'img', kind: 'image', url: 'a.png' }, { id: 'target', kind: 'smart-remix' }];
  const connections = [{ fromNodeId: 'img', toNodeId: 'target' }];
  assert.equal(collectNodeInputsFromEdges('target', connections, nodes).images.length, 1);
  const first = collectNodeInputsFromEdges('target', connections, nodes);
  first.images.push({ nodeId: 'poison', url: 'x' });
  const second = collectNodeInputsFromEdges('target', connections, nodes);
  assert.equal(second.images.length, 1);
  assert.deepEqual(connections, [{ fromNodeId: 'img', toNodeId: 'target' }]);
});

/* ═══════════════ 2. canvasGraphEngine · 拓扑计划 ═══════════════ */

test('empty graph and single node plans are trivially valid', () => {
  assert.deepEqual(planGraphRun({}), { ok: true, layers: [], order: [], indegree: {}, nodeIds: [], targetNodeIds: [] });
  const single = planGraphRun({ nodes: [{ id: 'solo' }] });
  assert.equal(single.ok, true);
  assert.deepEqual(single.layers, [['solo']]);
  assert.deepEqual(single.order, ['solo']);
  assert.deepEqual(single.indegree, { solo: 0 });
});

test('a chain becomes one node per layer, a diamond shares the middle layer', () => {
  const nodes = ['a', 'b', 'c'].map(id => ({ id }));
  const chain = planGraphRun({ nodes, connections: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }] });
  assert.deepEqual(chain.layers, [['a'], ['b'], ['c']]);
  assert.deepEqual(chain.indegree, { a: 0, b: 1, c: 1 });

  const diamondNodes = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  const diamond = planGraphRun({
    nodes: diamondNodes,
    connections: [
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'a', toNodeId: 'c' },
      { fromNodeId: 'b', toNodeId: 'd' },
      { fromNodeId: 'c', toNodeId: 'd' },
    ],
  });
  assert.deepEqual(diamond.layers, [['a'], ['b', 'c'], ['d']]);
  assert.deepEqual(diamond.order, ['a', 'b', 'c', 'd']);
});

test('duplicate edges between the same pair do not inflate in-degree (no false cycle)', () => {
  const plan = planGraphRun({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [
      { fromNodeId: 'a', toNodeId: 'b', relation: 'derived' },
      { fromNodeId: 'a', toNodeId: 'b', relation: 'reference' },
    ],
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.layers, [['a'], ['b']]);
  assert.deepEqual(plan.indegree, { a: 0, b: 1 });
});

test('dangling edges are ignored instead of breaking the plan', () => {
  const plan = planGraphRun({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'ghost', toNodeId: 'b' },
      { fromNodeId: 'b', toNodeId: 'ghost' },
    ],
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.layers, [['a'], ['b']]);
});

test('cycles report ok:false with cycleNodeIds instead of throwing', () => {
  const cycle = planGraphRun({
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    connections: [
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'b', toNodeId: 'a' },
      { fromNodeId: 'b', toNodeId: 'c' },
    ],
  });
  assert.equal(cycle.ok, false);
  assert.equal(cycle.reason, 'cycle');
  assert.deepEqual(cycle.cycleNodeIds, ['a', 'b']);
  assert.deepEqual(cycle.blockedNodeIds, ['c']);
  assert.deepEqual(cycle.layers, []);

  const selfLoop = planGraphRun({ nodes: [{ id: 's' }], connections: [{ fromNodeId: 's', toNodeId: 's' }] });
  assert.equal(selfLoop.ok, false);
  assert.deepEqual(selfLoop.cycleNodeIds, ['s']);
  assert.doesNotThrow(() => planGraphRun({ nodes: [{ id: 'a' }], connections: [{ fromNodeId: 'a', toNodeId: 'a' }] }));
});

test('an unrelated branch still gets a valid plan while another branch is cyclic', () => {
  const plan = planGraphRun({
    nodes: [{ id: 'x' }, { id: 'y' }, { id: 'a' }, { id: 'b' }],
    connections: [
      { fromNodeId: 'x', toNodeId: 'y' },
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'b', toNodeId: 'a' },
    ],
  });
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.layers, [['x'], ['y']]);
  assert.deepEqual(plan.order, ['x', 'y']);
  assert.deepEqual(plan.cycleNodeIds, ['a', 'b']);
});

test('targetNodeIds narrows the plan to the targets plus their ancestors', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const connections = [
    { fromNodeId: 'a', toNodeId: 'b' },
    { fromNodeId: 'b', toNodeId: 'c' },
    { fromNodeId: 'c', toNodeId: 'd' },
  ];
  const scoped = planGraphRun({ nodes, connections, targetNodeIds: ['c'] });
  assert.equal(scoped.ok, true);
  assert.deepEqual(scoped.nodeIds, ['a', 'b', 'c']);
  assert.deepEqual(scoped.layers, [['a'], ['b'], ['c']]);
  assert.deepEqual(scoped.targetNodeIds, ['c']);

  const whole = planGraphRun({ nodes, connections });
  assert.deepEqual(whole.nodeIds, ['a', 'b', 'c', 'd']);

  const unknown = planGraphRun({ nodes, connections, targetNodeIds: ['ghost'] });
  assert.deepEqual(unknown.layers, []);
  assert.deepEqual(unknown.nodeIds, []);
});

/* ═══════════════ 3. canvasGraphEngine · 就绪判定 ═══════════════ */

const READY_NODES = [
  { id: 'photo', kind: 'image', status: 'ready' },
  { id: 'remix', kind: 'smart-remix', status: 'draft', sourceNodeIds: ['photo'] },
  { id: 'video', kind: 'video-composer', status: 'draft' },
];
const READY_EDGES = [{ fromNodeId: 'photo', toNodeId: 'remix' }];
const ids = list => list.map(node => node.id);

test('selectReadyNodes skips settled sources and waits for upstream success', () => {
  // 素材节点已 ready (产物本身就是输入), 不重复入队; 派生节点入度已满足 -> ready
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES })), ['remix', 'video']);
  // 上游还在跑: 下游必须等
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { remix: 'running' } })), ['video']);
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { photo: { status: 'running' } } })), ['video']);
  // 上游失败 / 被阻塞: 下游永远不 ready
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { photo: 'error' } })), ['video']);
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { remix: 'blocked' } })), ['video']);
  // runs 同时支持 Map 与 { status } 两种写法
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: new Map([['photo', 'running']]) })), ['video']);
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { photo: { status: 'success' } } })), ['remix', 'video']);
});

test('selectReadyNodes excludes stale nodes and honours includeSettled', () => {
  const staleNodes = READY_NODES.map(node => node.id === 'remix' ? { ...node, stale: true } : node);
  assert.deepEqual(ids(selectReadyNodes({ nodes: staleNodes, connections: READY_EDGES })), ['video']);
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, runs: { remix: 'stale' } })), ['video']);
  // 字面语义 (入度满足 且 未在跑 且 未 stale) 时, 已成功的节点也会入队
  assert.deepEqual(ids(selectReadyNodes({ nodes: READY_NODES, connections: READY_EDGES, includeSettled: true })), ['photo', 'remix', 'video']);
  assert.deepEqual(selectReadyNodes({}), []);
});

test('a whole chain becomes ready layer by layer as upstream nodes settle', () => {
  const nodes = [
    { id: 'copy', kind: 'text', status: 'draft' },
    { id: 'image', kind: 'smart-remix', status: 'draft' },
    { id: 'video', kind: 'video-composer', status: 'draft' },
  ];
  const connections = [{ fromNodeId: 'copy', toNodeId: 'image' }, { fromNodeId: 'image', toNodeId: 'video' }];
  const readyIds = runs => ids(selectReadyNodes({ nodes, connections, runs }));
  assert.deepEqual(readyIds({}), ['copy']);
  assert.deepEqual(readyIds({ copy: 'success' }), ['image']);
  assert.deepEqual(readyIds({ copy: 'success', image: 'success' }), ['video']);
});

/* ═══════════════ 4. canvasGraphEngine · stale 传播 ═══════════════ */

test('markStaleDownstream walks outgoing edges and never mutates the input array', () => {
  const nodes = [
    { id: 'a', kind: 'image', status: 'ready' },
    { id: 'b', kind: 'smart-remix', status: 'success' },
    { id: 'c', kind: 'video-composer', status: 'success' },
  ];
  const connections = [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }];
  const result = markStaleDownstream({ nodes, connections, changedNodeId: 'a' });
  assert.deepEqual(result.staleNodeIds, ['b', 'c']);
  assert.deepEqual(result.nodes.map(node => node.status), ['ready', 'stale', 'stale']);
  assert.deepEqual(result.nodes.map(node => node.stale), [undefined, true, true]);
  assert.notEqual(result.nodes, nodes);
  // 入参数组一尘不染
  assert.deepEqual(nodes.map(node => node.status), ['ready', 'success', 'success']);
  assert.equal(nodes[1].stale, undefined);
});

test('stale propagation does not cross a running node (and never overwrites its status)', () => {
  const nodes = [
    { id: 'a', status: 'ready' },
    { id: 'b', status: 'running' },
    { id: 'c', status: 'success' },
  ];
  const connections = [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }];
  const running = markStaleDownstream({ nodes, connections, changedNodeId: 'a' });
  assert.deepEqual(running.staleNodeIds, []);
  assert.equal(running.nodes, nodes);            // 什么都没变 -> 原数组引用 (省一次重渲染)
  assert.deepEqual(nodes.map(node => node.status), ['ready', 'running', 'success']);

  const analyzing = markStaleDownstream({
    nodes: [{ id: 'a', status: 'ready' }, { id: 'x', status: 'analyzing' }],
    connections: [{ fromNodeId: 'a', toNodeId: 'x' }],
    changedNodeId: 'a',
  });
  assert.deepEqual(analyzing.staleNodeIds, []);
  assert.equal(analyzing.nodes[1].status, 'analyzing');
});

test('stale propagation stops at failed nodes, other branches still get marked', () => {
  const nodes = [
    { id: 'a', status: 'ready' },
    { id: 'failed', status: 'error' },
    { id: 'after-failure', status: 'success' },
    { id: 'ok', status: 'success' },
  ];
  const connections = [
    { fromNodeId: 'a', toNodeId: 'failed' },
    { fromNodeId: 'failed', toNodeId: 'after-failure' },
    { fromNodeId: 'a', toNodeId: 'ok' },
  ];
  const result = markStaleDownstream({ nodes, connections, changedNodeId: 'a' });
  assert.deepEqual(result.staleNodeIds, ['ok']);
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  assert.equal(byId.get('failed').status, 'error');       // 不覆盖失败状态
  assert.equal(byId.get('after-failure').status, 'success');
  assert.equal(byId.get('ok').status, 'stale');
});

test('already-stale nodes keep propagating and cycles terminate', () => {
  const chain = markStaleDownstream({
    nodes: [{ id: 'a', status: 'ready' }, { id: 'b', status: 'stale', stale: true }, { id: 'c', status: 'success' }],
    connections: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'c' }],
    changedNodeId: 'a',
  });
  assert.deepEqual(chain.staleNodeIds, ['b', 'c']);

  const cyclic = markStaleDownstream({
    nodes: [{ id: 'a', status: 'ready' }, { id: 'b', status: 'success' }],
    connections: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'a' }],
    changedNodeId: 'a',
  });
  assert.deepEqual(cyclic.staleNodeIds, ['b']);   // 不回标变化源自己, 也不会无限循环
  assert.equal(cyclic.nodes[0].status, 'ready');
});

test('an unknown or missing changed node marks nothing', () => {
  const nodes = [{ id: 'a', status: 'success' }];
  assert.deepEqual(markStaleDownstream({ nodes, connections: [], changedNodeId: 'ghost' }), { nodes, staleNodeIds: [] });
  assert.deepEqual(markStaleDownstream({ nodes, connections: [], changedNodeId: undefined }), { nodes, staleNodeIds: [] });
  assert.deepEqual(markStaleDownstream({}), { nodes: [], staleNodeIds: [] });
});

/* ═══════════════ 5. index.jsx 接线契约 (执行真实代码, 不是复述公式) ═══════════════ */

function wiringBlock(name) {
  const startMark = `[canvas-graph-inputs:${name}]`;
  const endMark = `[/canvas-graph-inputs:${name}]`;
  const start = PAGE.indexOf(startMark);
  const end = PAGE.indexOf(endMark);
  assert.ok(start > -1, `index.jsx 缺少接线标记 ${startMark}`);
  assert.ok(end > start, `index.jsx 缺少接线标记 ${endMark}`);
  const body = PAGE.slice(PAGE.indexOf('\n', start) + 1, PAGE.lastIndexOf('\n', end)).replace(/\r/g, '');
  assert.notEqual(body.trimStart()[0], '*', '接线标记必须单独占一行, 否则抽出来的是半个块注释');
  return body;
}

/* 把 index.jsx 里那段接线代码原样编译成函数执行: 线上代码改了, 这里就会红。*/
function runWiringBlock(name, { returns, node, nodes, connections }) {
  const body = wiringBlock(name);
  assert.match(body, /collectNodeInputsFromEdges\(node, connections, nodes\)/);
  const fn = new Function('collectNodeInputsFromEdges', 'node', 'nodes', 'connections', `${body}
return { ${returns} };`);
  return fn(collectNodeInputsFromEdges, node, nodes, connections);
}

function runGenerateRefsBlock({ edgeInputs, referenceImages }) {
  const body = wiringBlock('generate-refs');
  assert.match(body, /edgeInputs\.images\.slice\(1\)/);
  const fn = new Function('edgeInputs', 'referenceImages', `${body}
return referenceImages;`);
  return fn(edgeInputs, referenceImages);
}

/* 改动前 index.jsx 的原始公式, 逐字符照抄 git HEAD —— 兼容性对照真值。*/
function legacyInputs({ node, nodes }) {
  const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
  const sourceUrl = node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
  const prompt = String(node.inputs?.prompt || '').trim();
  const referenceImages = [
    ...(node.inputs?.productImages || []),
    ...(node.inputs?.referenceImages || []),
  ].map(image => image?.url || image?.src || image?.image_url).filter(Boolean);
  return { source, sourceUrl, prompt, referenceImages };
}

test('index.jsx keeps the legacy sourceNodeIds[0] fallback chain verbatim', () => {
  for (const name of ['generate', 'process']) {
    const body = wiringBlock(name);
    assert.match(body, /const source = nodes\.find\(item => item\.id === node\.sourceNodeIds\?\.\[0\]\)/);
    assert.match(body, /node\.inputs\?\.sourceUrl \|\| source\?\.url \|\| source\?\.assets\?\.find\(asset => asset\?\.url\)\?\.url \|\| ''/);
  }
  assert.match(PAGE, /import \{ collectNodeInputsFromEdges \} from '\.\/canvasGraphInputs\.js';/);
});

test('nodes without inbound edges keep byte-identical inputs (old graphs unchanged)', () => {
  const photo = { id: 'photo', kind: 'image', url: 'photo.png' };
  const group = { id: 'group', kind: 'source_group', assets: [{ url: 'g1.png' }] };
  const cases = [
    { name: '老图: 派生节点 + sourceNodeIds', node: { id: 'n1', kind: 'smart-remix', sourceNodeIds: ['photo'], inputs: { prompt: '白底主图' } } },
    { name: '老图: source_group 上游', node: { id: 'n2', kind: 'smart-remix', sourceNodeIds: ['group'], inputs: {} } },
    { name: '老图: 手填 sourceUrl', node: { id: 'n3', kind: 'smart-remix', sourceNodeIds: [], inputs: { sourceUrl: 'manual.png', prompt: '改背景' } } },
    { name: '老图: 上游已删除', node: { id: 'n4', kind: 'smart-remix', sourceNodeIds: ['ghost'], inputs: { prompt: 'x' } } },
    { name: '老图: 商品图 + 参考图', node: { id: 'n5', kind: 'smart-remix', sourceNodeIds: ['photo'], inputs: { productImages: [{ url: 'p1.png' }], referenceImages: [{ src: 'r1.png' }] } } },
    { name: '老图: 空节点', node: { id: 'n6', kind: 'smart-remix', sourceNodeIds: [], inputs: {} } },
  ];
  const nodes = [photo, group, ...cases.map(item => item.node)];

  for (const item of cases) {
    const legacy = legacyInputs({ node: item.node, nodes });
    const wired = runWiringBlock('generate', { returns: 'source, sourceUrl, prompt, edgeInputs', node: item.node, nodes, connections: [] });
    assert.deepEqual(
      { source: wired.source, sourceUrl: wired.sourceUrl, prompt: wired.prompt },
      { source: legacy.source, sourceUrl: legacy.sourceUrl, prompt: legacy.prompt },
      item.name,
    );
    assert.deepEqual(wired.edgeInputs, createEmptyNodeInputs(), `${item.name}: 无入边必须收集到空结构`);
    // 参考图数组: 无入边时一根汗毛都不加
    assert.deepEqual(
      runGenerateRefsBlock({ edgeInputs: wired.edgeInputs, referenceImages: [...legacy.referenceImages] }),
      legacy.referenceImages,
      item.name,
    );

    const processed = runWiringBlock('process', { returns: 'source, sourceUrl, edgeInputs', node: item.node, nodes, connections: [] });
    assert.deepEqual(
      { source: processed.source, sourceUrl: processed.sourceUrl },
      { source: legacy.source, sourceUrl: legacy.sourceUrl },
      `${item.name} (process)`,
    );
  }
});

test('hand-drawn edges now carry values into the run (reference edge = @图片1)', () => {
  // 手拉线只建 relation:'reference' 的边, 不写 sourceNodeIds —— 改动前这里根本取不到值。
  const nodes = [
    { id: 'photo-a', kind: 'image', url: 'a.png' },
    { id: 'photo-b', kind: 'image', url: 'b.png' },
    { id: 'photo-c', kind: 'image', url: 'c.png' },
    { id: 'copy', kind: 'text', text: '春季连衣裙卖点' },
    { id: 'remix', kind: 'smart-remix', sourceNodeIds: [], inputs: {} },
  ];
  const connections = [
    { fromNodeId: 'photo-a', toNodeId: 'remix', relation: 'reference' },
    { fromNodeId: 'photo-b', toNodeId: 'remix', relation: 'reference' },
    { fromNodeId: 'photo-c', toNodeId: 'remix', relation: 'reference' },
    { fromNodeId: 'copy', toNodeId: 'remix', relation: 'reference' },
  ];
  const wired = runWiringBlock('generate', { returns: 'sourceUrl, prompt, edgeInputs', node: nodes[4], nodes, connections });
  assert.equal(wired.sourceUrl, 'a.png');                     // @图片1 = 第一条入边
  assert.equal(wired.prompt, '春季连衣裙卖点');                 // 上游文案成为 prompt
  assert.deepEqual(wired.edgeInputs.images.map(image => image.url), ['a.png', 'b.png', 'c.png']);

  const refs = runGenerateRefsBlock({ edgeInputs: wired.edgeInputs, referenceImages: [] });
  assert.deepEqual(refs, ['b.png', 'c.png']);                  // @图片2..@图片N 进参考图
  const deduped = runGenerateRefsBlock({ edgeInputs: wired.edgeInputs, referenceImages: ['b.png'] });
  assert.deepEqual(deduped, ['b.png', 'c.png']);               // 已经在参考图里的不重复追加

  // 处理节点: 入边既给 url, 也把上游节点补成 source (下游要读 source.ratio/几何)
  const processor = { id: 'inpaint', kind: 'inpaint', sourceNodeIds: [], inputs: { prompt: '去掉水印' } };
  const processed = runWiringBlock('process', {
    returns: 'source, sourceUrl',
    node: processor,
    nodes,
    connections: [{ fromNodeId: 'photo-b', toNodeId: 'inpaint' }],
  });
  assert.equal(processed.sourceUrl, 'b.png');
  assert.equal(processed.source.id, 'photo-b');
});

test('an explicit node-level prompt still wins over an inbound text edge', () => {
  const nodes = [
    { id: 'photo', kind: 'image', url: 'edge.png' },
    { id: 'copy', kind: 'text', text: '上游文案' },
    { id: 'remix', kind: 'smart-remix', sourceNodeIds: [], inputs: { prompt: '我写的提示词' } },
  ];
  const connections = [
    { fromNodeId: 'photo', toNodeId: 'remix' },
    { fromNodeId: 'copy', toNodeId: 'remix' },
  ];
  const wired = runWiringBlock('generate', { returns: 'sourceUrl, prompt', node: nodes[2], nodes, connections });
  assert.equal(wired.prompt, '我写的提示词');
  assert.equal(wired.sourceUrl, 'edge.png');
});

/* ═══════════════ 6. P0 验收: 文本 → 图 一条真实链路 (零成本, 不打上游) ═══════════════ */

test('engine + edge inputs drive a 文本 → 图 chain layer by layer without any network call', () => {
  const nodes = [
    { id: 'copy', kind: 'text', status: 'draft', text: '把这张图改成秋季场景' },
    { id: 'photo', kind: 'image', status: 'ready', url: 'photo.png' },
    { id: 'remix', kind: 'smart-remix', status: 'draft', sourceNodeIds: [], inputs: {} },
    { id: 'out', kind: 'output', status: 'draft' },
  ];
  const connections = [
    { fromNodeId: 'copy', toNodeId: 'remix', relation: 'reference' },
    { fromNodeId: 'photo', toNodeId: 'remix', relation: 'reference' },
    { fromNodeId: 'remix', toNodeId: 'out', relation: 'smart-remix-output' },
  ];
  const plan = planGraphRun({ nodes, connections });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.layers, [['copy', 'photo'], ['remix'], ['out']]);

  const runs = {};
  const readyIds = () => selectReadyNodes({ nodes, connections, runs }).map(node => node.id);
  // 第 1 层: 待生成的是文案节点; 素材图已 ready, 不重复跑
  assert.deepEqual(readyIds(), ['copy']);
  runs.copy = 'success';
  // 第 2 层: 派生节点的入边输入此时已经能取到 (文案 → prompt, 图 → @图片1)
  assert.deepEqual(readyIds(), ['remix']);
  const inputs = collectNodeInputsFromEdges(nodes[2], connections, nodes);
  assert.equal(inputs.texts[0].content, '把这张图改成秋季场景');
  assert.deepEqual(inputs.images.map(image => [image.url, image.index]), [['photo.png', 1]]);
  runs.remix = 'running';
  assert.deepEqual(readyIds(), []);
  runs.remix = 'success';
  assert.deepEqual(readyIds(), ['out']);
  // 上游产物变了 → 整条下游标脏, 重跑前不再入队
  const invalidated = markStaleDownstream({ nodes, connections, changedNodeId: 'photo' });
  assert.deepEqual(invalidated.staleNodeIds, ['remix', 'out']);
});
