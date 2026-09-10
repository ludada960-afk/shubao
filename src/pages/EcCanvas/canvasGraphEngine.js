/* ═══════ P0 · 前端图执行引擎 (能力地图 N1/N5 / master-plan §3.4) ═══════
   画布在数据结构上早就是一张有向图 (节点 + 带端口的边), 但没有任何调度:
   谁该跑、跑完谁接着跑、上游改了谁要重跑 —— 全靠人点。
   本模块只做"算", 不做"跑": fetch / 计时器 / setState 一律留在 index.jsx 调用方。

   三个纯函数:
   - planGraphRun          入度 → 拓扑分层; 成环不抛异常, 返回 { ok:false, reason:'cycle', cycleNodeIds }
   - selectReadyNodes      入度已满足 且 未在跑 且 未 stale 的节点
   - markStaleDownstream   上游产物变了 → 沿出边 BFS 标下游 stale (不覆盖 running/failed)

   硬约束: 纯函数 / 零外部依赖 / 不改传入的数组 (全部返回新数组或原数组引用)。*/

/* 节点状态词表: 6 态节点状态 (workflowNodeViewModel.js) + 后端任务状态 + 本模块新增的 stale。*/
const SUCCESS_STATUSES = new Set(['success', 'ready', 'done', 'completed', 'succeeded']);
const IN_FLIGHT_STATUSES = new Set(['running', 'analyzing', 'queued', 'pending', 'processing', 'submitted']);
const FAILED_STATUSES = new Set(['error', 'failed', 'failure']);
const BLOCKED_STATUSES = new Set(['blocked', 'skipped']);
const STALE_STATUS = 'stale';

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

/* 取节点 id: 兼容 {id} 与裸字符串两种写法。*/
function readNodeId(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return node.id == null ? '' : String(node.id);
}

/* 取边两端: 兼容 normalizeCanvasConnection 之后的 fromNodeId/toNodeId 与手写的 from/to。*/
function readEdgeEnds(connection) {
  if (!connection || typeof connection !== 'object') return null;
  const fromId = String(connection.fromNodeId || connection.from || '');
  const toId = String(connection.toNodeId || connection.to || '');
  if (!fromId || !toId) return null;
  return { fromId, toId };
}

/* 只保留两端都存在的边, 并按 (from,to) 去重:
   同一对节点可能同时有 derived + reference 两条边 (addConnection 只按 relation 去重),
   重复计入会让入度虚高 —— 链会永远不 ready, 甚至被误判成环。*/
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

/* 按 id 建图: orderedIds 保留传入 nodes 的顺序, 保证分层结果稳定可断言。*/
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

function invertEdges(orderedIds, edges) {
  const incoming = new Map(orderedIds.map(id => [id, []]));
  const outgoing = new Map(orderedIds.map(id => [id, []]));
  for (const { fromId, toId } of edges) {
    outgoing.get(fromId).push(toId);
    incoming.get(toId).push(fromId);
  }
  return { incoming, outgoing };
}

/* 目标子图 = targetNodeIds + 它们的全部上游祖先 (不相关的分支不动)。
   targetNodeIds 为空 = 整张图; 传了但一个都不在图里 = 空计划 (绝不悄悄跑全图)。*/
function resolveRunSubgraph({ orderedIds, incoming, targetNodeIds }) {
  const targets = (Array.isArray(targetNodeIds) ? targetNodeIds : []).map(readNodeId).filter(Boolean);
  if (!targets.length) return [...orderedIds];
  const validTargets = orderedIds.filter(id => targets.includes(id));
  if (!validTargets.length) return [];   /* 指定的目标都不在图里 = 没有要跑的 (不回退成整张图) */
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

/* 环上的节点: 从每个"没排进拓扑序"的节点出发, 沿出边能不能回到自己。只在报错路径上跑。*/
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

/* 入度 → 拓扑分层。返回 { ok:true, layers:[[id...],...], order:[id...], indegree:{id:n}, nodeIds, targetNodeIds }
   成环返回 { ok:false, reason:'cycle', cycleNodeIds, blockedNodeIds, layers, order, indegree }
   (cycleNodeIds = 真在环上的节点; blockedNodeIds = 环下游, 永远等不到入度满足)。*/
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

/* 读某节点的运行态: runs 支持 { id: 'running' } / { id: { status } } / Map 三种写法。*/
function readRunStatus(runs, id) {
  if (!runs) return '';
  const entry = runs instanceof Map ? runs.get(id) : runs[id];
  if (!entry) return '';
  return normalizeStatus(typeof entry === 'string' ? entry : entry.status);
}

/* 就绪节点: 入度已满足 (上游全部跑完) 且自己没在跑、没 stale、没失败、没跑过。
   - 有入边的节点: 所有上游都必须是 success 类状态, 否则等;
   - 没入边的节点: 入度天然满足 (源节点);
   - 已成功/已就绪的节点不重复入队 (重跑走 stale: markStaleDownstream 标脏后再放开);
   - 失败节点留给用户显式重试, 引擎不自动重跑 (避免静默重复计费);
   - includeSettled:true 时按字面语义"入度满足 且 未在跑 且 未 stale"返回, 含已成功节点。*/
export function selectReadyNodes({ nodes = [], connections = [], runs = {}, includeSettled = false } = {}) {
  const { orderedIds, nodeById, nodeIdSet } = buildGraph(nodes);
  const edges = collectGraphEdges(nodeIdSet, connections);
  const { incoming } = invertEdges(orderedIds, edges);

  const statusOf = id => readRunStatus(runs, id) || normalizeStatus(nodeById.get(id)?.status);

  return orderedIds
    .filter(id => {
      const node = nodeById.get(id);
      const status = statusOf(id);
      if (IN_FLIGHT_STATUSES.has(status)) return false;
      if (status === STALE_STATUS || node?.stale === true) return false;
      if (FAILED_STATUSES.has(status) || BLOCKED_STATUSES.has(status)) return false;
      if (!includeSettled && SUCCESS_STATUSES.has(status)) return false;
      return (incoming.get(id) || []).every(fromId => SUCCESS_STATUSES.has(statusOf(fromId)));
    })
    .map(id => nodeById.get(id));
}

/* 上游产物变了 → 沿出边 BFS 把下游标成 stale。
   规则 (master-plan §3.4 第 4 条 + 边的三态 §3.5.3):
   - changedNodeId 自己不动 (它就是变化的来源);
   - 只沿"已定局"的节点继续传播; 撞到 running/analyzing (结论还会变) 或 error/failed
     (产物没变, 而且是需要人工重试的终态) 就停 —— 既不覆盖它们的状态, 也不越过它们往下标;
   - 已经 stale 的节点继续往下传 (它的下游同样过时);
   - 返回 { nodes, staleNodeIds }: nodes 是新数组; 没有任何节点需要标脏时原样返回入参数组 (省一次重渲染)。*/
export function markStaleDownstream({ nodes = [], connections = [], changedNodeId } = {}) {
  const list = Array.isArray(nodes) ? nodes : [];
  const changedId = readNodeId(changedNodeId);
  if (!changedId) return { nodes: list, staleNodeIds: [] };

  const { nodeById, nodeIdSet } = buildGraph(list);
  if (!nodeIdSet.has(changedId)) return { nodes: list, staleNodeIds: [] };
  const { outgoing } = invertEdges([...nodeIdSet], collectGraphEdges(nodeIdSet, connections));

  const staleNodeIds = [];
  const visited = new Set([changedId]);
  const queue = [changedId];
  while (queue.length) {
    for (const toId of outgoing.get(queue.shift()) || []) {
      if (visited.has(toId)) continue;
      visited.add(toId);
      const node = nodeById.get(toId);
      if (!node) continue;
      const status = normalizeStatus(node.status);
      if (IN_FLIGHT_STATUSES.has(status) || FAILED_STATUSES.has(status)) continue;
      staleNodeIds.push(toId);
      queue.push(toId);
    }
  }

  if (!staleNodeIds.length) return { nodes: list, staleNodeIds };
  const staleSet = new Set(staleNodeIds);
  return {
    nodes: list.map(node => staleSet.has(readNodeId(node)) ? { ...node, stale: true, status: STALE_STATUS } : node),
    staleNodeIds,
  };
}
