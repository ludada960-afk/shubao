// server/canvas/graphRunPlan.mjs
// P1 后端宿主 — 画布整链运行计划的纯逻辑层（P0 的 server 副本）。
//
// 设计约束（与 P0 同源，保证前后端口径一致）：
//   - 纯函数 / 零外部依赖 / 零副作用；不读 DB、不发请求，可单测可快照。
//   - 节点/边口径与 P0 canvasGraphEngine.planGraphRun 完全一致：
//     节点兼容 {id} 与裸字符串；边兼容 fromNodeId/toNodeId 与 from/to；(from,to) 去重。
//   - 成环不抛异常：返回 { ok:false, reason:'cycle', cycleNodeIds, blockedNodeIds }。
//   - 目标子图 = targetNodeIds + 全部上游祖先；targets 为空 = 整张图；
//     传了但都不在图里 = 空计划（绝不悄悄跑全图）。
//   - 分层稳定可断言：orderedIds 保留传入 nodes 的顺序（P0 planGraphRun 行为）。
//
// 服务端支持的 kind 白名单（镜像 P0 index.jsx GRAPH_RUN_KINDS）：
//   image-composer / smart-remix / suite-composer -> 'generate'（P1 执行器未接线前走 400 守卫）
//   remove-bg / extend / inpaint / translate / upscale / layer-workbench -> 'process'
//   text / video / audio 暂不支持（不进白名单；已有产物时可作 source 喂下游，否则 400）。

export const SUPPORTED_GRAPH_RUN_KINDS = Object.freeze([
  'image-composer', 'smart-remix', 'suite-composer',
  'remove-bg', 'extend', 'inpaint', 'translate', 'upscale', 'layer-workbench',
]);

/* P0 index.jsx GRAPH_RUN_KINDS 的镜像（kind -> 动作类别，仅描述用，不作计费依据）。 */
export const GRAPH_RUN_KIND_ACTIONS = Object.freeze({
  'image-composer': 'generate',
  'smart-remix': 'generate',
  'suite-composer': 'generate',
  'remove-bg': 'process',
  extend: 'process',
  inpaint: 'process',
  translate: 'process',
  upscale: 'process',
  'layer-workbench': 'process',
});

export function readNodeId(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return node.id == null ? '' : String(node.id);
}

/* 取边的两端：兼容 P0 的 fromNodeId/toNodeId 与 from/to。 */
function readEdgeEnds(connection) {
  if (!connection || typeof connection !== 'object') return null;
  const fromId = String(connection.fromNodeId || connection.from || '');
  const toId = String(connection.toNodeId || connection.to || '');
  if (!fromId || !toId) return null;
  return { fromId, toId };
}

/* 节点是否"已有可用产物"（镜像 P0 nodeHasProduct）：源素材/上游结果就是这类。 */
export function nodeHasProduct(node = {}) {
  if (node.url) return true;
  if (String(node.text || '').trim()) return true;
  if (node.assets?.length) return true;
  if (node.output?.url || node.output?.urls?.length || node.output?.nodeId || node.output?.nodeIds?.length) return true;
  return false;
}

/* 取节点的可用产物 URL（下游输入用；没有则空串）。 */
export function nodeProductUrl(node = {}) {
  if (typeof node.url === 'string' && node.url.trim()) return node.url.trim();
  if (typeof node.output?.url === 'string' && node.output.url.trim()) return node.output.url.trim();
  if (Array.isArray(node.output?.urls) && node.output.urls.length) return String(node.output.urls[0] || '');
  if (Array.isArray(node.assets) && node.assets.length) return String(node.assets[0]?.url || '');
  return '';
}

function buildGraph(nodes) {
  const orderedIds = [];
  const nodeById = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const id = readNodeId(node);
    if (!id || nodeById.has(id)) continue;
    nodeById.set(id, node);
    orderedIds.push(id);
  }
  return { orderedIds, nodeById, nodeIdSet: new Set(orderedIds) };
}

/* 只保留两端都存在的边，按 (from,to) 去重（P0 collectGraphEdges 同口径）。 */
function collectGraphEdges(nodeIdSet, connections) {
  const edges = [];
  const seen = new Set();
  for (const connection of Array.isArray(connections) ? connections : []) {
    const ends = readEdgeEnds(connection);
    if (!ends) continue;
    if (!nodeIdSet.has(ends.fromId) || !nodeIdSet.has(ends.toId)) continue;
    const key = ends.fromId + '\u0000' + ends.toId;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(ends);
  }
  return edges;
}

function invertEdges(orderedIds, edges) {
  const incoming = new Map(orderedIds.map(id => [id, []]));
  const outgoing = new Map(orderedIds.map(id => [id, []]));
  for (const { fromId, toId } of edges) {
    outgoing.get(fromId).push(toId);
    incoming.get(toId).push(fromId);
  }
  return { incoming, outgoing };
}

/* 目标子图 = targetNodeIds + 全部上游祖先（P0 resolveRunSubgraph 同语义）。 */
function resolveRunSubgraph({ orderedIds, incoming, targetNodeIds }) {
  const targets = (Array.isArray(targetNodeIds) ? targetNodeIds : []).map(readNodeId).filter(Boolean);
  if (!targets.length) return [...orderedIds];
  const validTargets = orderedIds.filter(id => targets.includes(id));
  if (!validTargets.length) return [];
  const picked = new Set(validTargets);
  const queue = [...validTargets];
  while (queue.length) {
    for (const fromId of incoming.get(queue.shift()) || []) {
      if (picked.has(fromId)) continue;
      picked.add(fromId);
      queue.push(fromId);
    }
  }
  return orderedIds.filter(id => picked.has(id));
}

/* 环上的节点：从每个"没排进拓扑序"的节点出发，沿出边能否回到自己（P0 同实现）。 */
function findCycleNodeIds(stalledIds, adjacency) {
  const cycleIds = [];
  for (const id of stalledIds) {
    const stack = [...(adjacency.get(id) || [])];
    const seen = new Set();
    let onCycle = false;
    while (stack.length) {
      const current = stack.pop();
      if (current === id) { onCycle = true; break; }
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of adjacency.get(current) || []) stack.push(next);
    }
    if (onCycle) cycleIds.push(id);
  }
  return cycleIds;
}

/* 入度 -> 拓扑分层（P0 planGraphRun 纯函数副本；口径与分层结果逐字节一致）。
   返回 { ok:true, layers, order, indegree, nodeIds, targetNodeIds }；
   成环 { ok:false, reason:'cycle', cycleNodeIds, blockedNodeIds, layers, order, indegree, nodeIds }。*/
export function planGraphRun({ nodes = [], connections = [], targetNodeIds = [] } = {}) {
  const { orderedIds, nodeIdSet } = buildGraph(nodes);
  const edges = collectGraphEdges(nodeIdSet, connections);
  const { incoming } = invertEdges(orderedIds, edges);
  const working = resolveRunSubgraph({ orderedIds, incoming, targetNodeIds });

  const workingSet = new Set(working);
  const adjacency = new Map(working.map(id => [id, []]));
  const indegree = new Map(working.map(id => [id, 0]));
  for (const { fromId, toId } of edges) {
    if (!workingSet.has(fromId) || !workingSet.has(toId)) continue;
    adjacency.get(fromId).push(toId);
    indegree.set(toId, indegree.get(toId) + 1);
  }

  const initialIndegree = Object.fromEntries([...indegree].map(([id, value]) => [id, value]));
  const remaining = new Set(working);
  const layers = [];
  const order = [];
  while (remaining.size) {
    const layer = working.filter(id => remaining.has(id) && indegree.get(id) === 0);
    if (!layer.length) break;
    layers.push(layer);
    for (const id of layer) {
      remaining.delete(id);
      order.push(id);
      for (const toId of adjacency.get(id) || []) {
        if (remaining.has(toId)) indegree.set(toId, indegree.get(toId) - 1);
      }
    }
  }

  if (remaining.size) {
    const stalledIds = working.filter(id => remaining.has(id));
    const cycleNodeIds = findCycleNodeIds(stalledIds, adjacency);
    return {
      ok: false,
      reason: 'cycle',
      cycleNodeIds,
      blockedNodeIds: stalledIds.filter(id => !cycleNodeIds.includes(id)),
      layers,
      order,
      indegree: initialIndegree,
      nodeIds: working,
      targetNodeIds: (Array.isArray(targetNodeIds) ? targetNodeIds : []).map(readNodeId).filter(Boolean),
    };
  }
  return {
    ok: true,
    layers,
    order,
    indegree: initialIndegree,
    nodeIds: working,
    targetNodeIds: (Array.isArray(targetNodeIds) ? targetNodeIds : []).map(readNodeId).filter(Boolean),
  };
}

/* 每个节点的全部直接上游（去重，P0 边口径）：Map(nodeId -> [upstreamId...])。
   服务端编排器用它把上游产物 URL 喂给执行器。 */
export function buildGraphIncoming(nodes = [], connections = []) {
  const { orderedIds, nodeIdSet } = buildGraph(nodes);
  const edges = collectGraphEdges(nodeIdSet, connections);
  const incoming = new Map(orderedIds.map(id => [id, []]));
  for (const { fromId, toId } of edges) incoming.get(toId).push(fromId);
  return incoming;
}

/* 预计算每个节点的全部下游（传递闭包，P0 buildTransitiveDownstream 副本）：
   Map(id -> Set(downstreamId...))。节点失败时用它一次性把下游全标 blocked/skipped。 */
export function buildTransitiveDownstream(nodes = [], connections = []) {
  const ids = [...new Set((Array.isArray(nodes) ? nodes : []).map(readNodeId).filter(Boolean))];
  const idSet = new Set(ids);
  const outgoing = new Map(ids.map(id => [id, []]));
  const seen = new Set();
  for (const c of Array.isArray(connections) ? connections : []) {
    const from = String(c.fromNodeId || c.from || '');
    const to = String(c.toNodeId || c.to || '');
    if (!from || !to || !idSet.has(from) || !idSet.has(to)) continue;
    const key = from + '\u0000' + to;
    if (seen.has(key)) continue;
    seen.add(key);
    outgoing.get(from).push(to);
  }
  const downstream = new Map(ids.map(id => [id, new Set()]));
  for (const id of ids) {
    const queue = [...(outgoing.get(id) || [])];
    const visited = new Set();
    while (queue.length) {
      const next = queue.shift();
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(...(outgoing.get(next) || []));
    }
    visited.forEach(v => downstream.get(id).add(v));
  }
  return downstream;
}

/* 把拓扑计划 + 支持度 + 成本估算 合成"运行计划"（P0 buildRunPlan 副本，服务端默认口径）：
   - supportedKinds 缺省 = SUPPORTED_GRAPH_RUN_KINDS（服务端白名单，不是 null=全可执行）；
   - costOf 缺省 () => 0 —— 服务端绝不内置价格（单一价格源 = 计费目录），
     估算值只用于展示；实际扣费单位永远以执行器回报（catalog 报价）为准。
   返回 { ok, layers, order, executableNodeIds, sourceNodeIds, unsupportedNodeIds, nodeCount, estimatedUnits }。*/
export function buildRunPlan({
  nodes = [],
  connections = [],
  targetNodeIds = [],
  supportedKinds = SUPPORTED_GRAPH_RUN_KINDS,
  costOf = () => 0,
  hasProduct = nodeHasProduct,
} = {}) {
  const hp = typeof hasProduct === 'function' ? hasProduct : nodeHasProduct;
  const plan = planGraphRun({ nodes, connections, targetNodeIds });
  const supported = supportedKinds instanceof Set
    ? supportedKinds
    : (Array.isArray(supportedKinds) ? new Set(supportedKinds) : new Set(SUPPORTED_GRAPH_RUN_KINDS));
  if (!plan.ok) {
    return {
      ok: false,
      reason: plan.reason,
      cycleNodeIds: plan.cycleNodeIds,
      blockedNodeIds: plan.blockedNodeIds,
      layers: plan.layers,
      order: plan.order,
      executableNodeIds: [],
      unsupportedNodeIds: [],
      nodeCount: plan.nodeIds.length,
      estimatedUnits: 0,
    };
  }
  const nodeById = new Map((Array.isArray(nodes) ? nodes : []).map(n => [readNodeId(n), n]));
  const kindOf = node => node?.actionId || node?.kind;
  const executable = [];
  const source = [];
  const unsupported = [];
  let estimatedUnits = 0;
  for (const id of plan.order) {
    const node = nodeById.get(id) || {};
    const kind = kindOf(node);
    if (supported.has(kind)) {
      executable.push(id);
      estimatedUnits += Number(costOf(node)) || 0;
      continue;
    }
    (hp(node) ? source : unsupported).push(id);
  }
  return {
    ok: true,
    layers: plan.layers,
    order: plan.order,
    executableNodeIds: executable,
    sourceNodeIds: source,
    unsupportedNodeIds: unsupported,
    nodeCount: plan.nodeIds.length,
    estimatedUnits: Math.round(estimatedUnits * 100) / 100,
  };
}
