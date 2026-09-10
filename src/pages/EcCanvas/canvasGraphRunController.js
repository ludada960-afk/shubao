/* ═══════ P0.5 · 分组"运行整链" 编排器 (master-plan §3.4 / §6 P0.5) ═══════
   P0 (canvasGraphEngine.js) 只"算"不"跑"。本模块把"算"升级成"按拓扑序跑"：
   失败只污染下游、可取消、可测 —— 但 **不产生任何副作用**：
   - 真正执行某个节点 = 注入的 runNode(node)（index.jsx 里映射到已有单节点执行器）；
   - 观察某节点跑到终态 = 注入的 awaitTerminal(nodeId)（index.jsx 里轮询 nodesRef）；
   - 状态变更 = 注入的 onStatus(nodeId, status, detail)。
   三条不变式：不确认不扣费（本模块被"运行整链"按钮在用户二次确认后调用）；
   成环/无执行器的节点绝不硬跑；失败只把"该节点的下游"标 blocked，无关分支照跑。*/

import { planGraphRun } from './canvasGraphEngine.js';

function readNodeId(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  return node.id == null ? '' : String(node.id);
}

/* 判断一个节点是否"已有可用产物"（无需再跑）：源素材(上传的图/视频/音频/文本)就是这类。
   有产物 = 下游可以直接拿它的产物继续跑，即使这个 kind 没有执行器。 */
export function nodeHasProduct(node = {}) {
  if (node.url) return true;
  if (String(node.text || '').trim()) return true;
  if (node.assets?.length) return true;
  if (node.output?.url || node.output?.urls?.length || node.output?.nodeId || node.output?.nodeIds?.length) return true;
  return false;
}

/* 把 planGraphRun 的结果 + 执行器覆盖度 + 成本估算 合成一份"运行计划"。
   supportedKinds: 哪些 kind/actionId 有可用执行器（没有的 = 暂不支持整链跑，跑前就告诉用户）。
   costOf(node): 单节点预计积分（用 estimateNodeCost，前端估算表唯一真源）。
   返回 {
     ok, reason?, cycleNodeIds?, blockedNodeIds?,
     layers, order,
     executableNodeIds,   // 会真跑的（有执行器 且 不在环下游）
     unsupportedNodeIds,  // 无执行器 → 跳过并阻塞其下游
     nodeCount, estimatedUnits
   } */
export function buildRunPlan({ nodes = [], connections = [], targetNodeIds = [], supportedKinds = null, costOf = () => 0, hasProduct = nodeHasProduct } = {}) {
  const hp = typeof hasProduct === 'function' ? hasProduct : nodeHasProduct;
  const plan = planGraphRun({ nodes, connections, targetNodeIds });
  const supported = supportedKinds instanceof Set ? supportedKinds : (Array.isArray(supportedKinds) ? new Set(supportedKinds) : null);
  if (!plan.ok) {
    return {
      ok: false, reason: plan.reason, cycleNodeIds: plan.cycleNodeIds, blockedNodeIds: plan.blockedNodeIds,
      layers: plan.layers, order: plan.order, executableNodeIds: [], unsupportedNodeIds: [],
      nodeCount: plan.nodeIds.length, estimatedUnits: 0,
    };
  }
  const nodeById = new Map((Array.isArray(nodes) ? nodes : []).map(n => [readNodeId(n), n]));
  const executable = [];   // 有执行器 → 会真跑
  const source = [];       // 没执行器但已有产物 → 视作"可用源"，不阻塞下游
  const unsupported = [];  // 没执行器且无产物 → 跑不了，阻塞其下游
  let estimatedUnits = 0;
  for (const id of plan.order) {
    const node = nodeById.get(id) || {};
    const kind = node.actionId || node.kind;
    if (supported && !supported.has(kind)) {
      (hp(node) ? source : unsupported).push(id);
      continue;
    }
    executable.push(id);
  }
  for (const id of executable) estimatedUnits += Number(costOf(nodeById.get(id) || {})) || 0;
  return {
    ok: true,
    layers: plan.layers, order: plan.order,
    executableNodeIds: executable, sourceNodeIds: source, unsupportedNodeIds: unsupported,
    nodeCount: plan.nodeIds.length,
    estimatedUnits: Math.round(estimatedUnits * 100) / 100,
  };
}

/* 预计算每个节点的全部下游（传递闭包）—— 失败时用来一次把下游全标 blocked。
   入参 nodes/connections 用和 planGraphRun 相同的口径（同 from,to 去重）。返回 Map(id -> Set(id...))。*/
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

/* 按层顺序执行。默认**层内也串行**（避免同层并发把成本翻倍、也避免和 promptLoading 打架）。
   返回 { aborted, succeeded:[], failed:[], skipped:[], blocked:[] }。
   节点分类（由 buildRunPlan 预计算在 plan.sourceNodeIds / plan.unsupportedNodeIds / plan.executableNodeIds）：
   - 源节点（无执行器但已有产物）→ 视作可用，不花钱、不阻塞下游；
   - 无执行器且无产物 → skipped + 阻塞其全部下游（缺这块输入跑不出结果）；
   - 有执行器 → 真跑；某节点 error → failed + 阻塞其全部下游；
   - signal.abort() → 立刻停，已完成的保留，未跑的进 blocked。*/
export async function createGraphRunner({ plan, downstream = new Map(), supportedKinds = null, runNode, awaitTerminal, onStatus, signal } = {}) {
  if (!plan || !plan.ok) {
    return { aborted: false, skipped: [], succeeded: [], failed: [], blocked: plan ? (plan.blockedNodeIds || []) : [] , reason: plan?.reason || 'no-plan' };
  }
  void supportedKinds; // 分类已交给 buildRunPlan；保留形参仅为签名兼容
  const blocked = new Set(plan.blockedNodeIds || []);
  const succeeded = []; const failed = []; const skipped = [];
  const notify = (id, status, detail) => { try { if (typeof onStatus === 'function') onStatus(id, status, detail); } catch { /* 通知失败不阻断执行 */ } };

  for (const layer of plan.layers) {
    for (const id of layer) {
      if (signal?.aborted) {
        // 剩余所有未跑的节点都进 blocked（含本层后续）
        for (const restId of plan.order) if (!succeeded.includes(restId) && !failed.includes(restId) && !skipped.includes(restId)) blocked.add(restId);
        return { aborted: true, succeeded, failed, skipped, blocked: [...blocked] };
      }
      if (blocked.has(id)) continue;
      if (plan.sourceNodeIds?.includes(id)) {
        succeeded.push(id);           // 已有产物：直接用，不花钱
        notify(id, 'success', 'source');
        continue;
      }
      if (plan.unsupportedNodeIds?.includes(id)) {
        skipped.push(id);            // 无执行器且无产物：跳过并阻塞下游
        notify(id, 'skipped', 'unsupported');
        (downstream.get(id) || []).forEach(v => blocked.add(v));
        continue;
      }
      notify(id, 'running');          // 有执行器：真跑
      let ok = false;
      try {
        if (typeof runNode === 'function') await runNode(id);
        const terminal = (typeof awaitTerminal === 'function') ? await awaitTerminal(id) : 'success';
        ok = terminal !== 'error';
      } catch {
        ok = false;
      }
      if (ok) {
        succeeded.push(id);
        notify(id, 'success');
      } else {
        failed.push(id);
        notify(id, 'error');
        (downstream.get(id) || []).forEach(v => blocked.add(v));
      }
    }
  }
  return { aborted: false, succeeded, failed, skipped, blocked: [...blocked] };
}

/* 轮询 nodesRef 直到节点状态进入 success/error（或超时）。纯"观察"，不改变节点。
   超时返回 'error'（当作失败，交由用户显式重试，绝不静默挂起）。*/
export function createTerminalAwaiter(readNodes, { pollMs = 250, timeoutMs = 120000, successStatuses = ['success','ready','done','completed'], failedStatuses = ['error','failed'] } = {}) {
  const success = new Set(successStatuses); const failed = new Set(failedStatuses);
  return (nodeId) => new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (Date.now() - start > timeoutMs) return resolve('error');
      let node;
      try { node = (readNodes() || []).find(n => String(n?.id) === String(nodeId)); } catch { node = undefined; }
      const status = String(node?.status || '').toLowerCase();
      if (success.has(status)) return resolve('success');
      if (failed.has(status)) return resolve('error');
      setTimeout(tick, pollMs);
    };
    tick();
  });
}
