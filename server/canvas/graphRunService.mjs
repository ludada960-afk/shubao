// server/canvas/graphRunService.mjs
// P1 后端宿主 — 画布整链 orchestrator：billing-aware、可取消、可恢复（resume）。
//
// 架构不变式（P1 红线）：
//   ① 不确认不扣费：每个收费步骤先 billActions.claim（租约）拿到独占权，执行成功才
//      billActions.save('settled')；失败/取消一律 release 未决租约。settled_units 只在
//      持有 run 租约的事务里累加（store.settleStep 双表 CAS），丢租约即丢写钱权。
//   ② 旧文档只读可用：本服务只写 canvas_graph_* 新表，不碰任何既有文档表。
//   ③ 单一价格源：服务层不内置任何价格；units 只来自执行器回报（执行器从后端
//      计费目录 quoteFeature/buildBillingRules 报价）。执行器未实际扣费时 units 缺省，
//      服务按 0 结算——绝不猜价。
//
// 恢复语义（P0"失败留给用户显式重试"）：
//   - 崩溃/租约过期后 run 停在 'running'（无主）：resumeRun 重抢租约，从第一个未完成
//     步骤续跑；已 settled 的计费动作经 claim 幂等短路（不重跑、不重扣）。
//   - 'failed' run：resumeRun = 显式重试（failed -> running，重开 failed/skipped 步骤）。
//   - 'cancel_requested'：持租约 worker 步间落成 'cancelled'；无主时 cancelRun 直接落。

import {
  SUPPORTED_GRAPH_RUN_KINDS,
  GRAPH_RUN_KIND_ACTIONS,
  buildRunPlan,
  buildGraphIncoming,
  buildTransitiveDownstream,
  nodeHasProduct,
  nodeProductUrl,
  readNodeId,
} from './graphRunPlan.mjs';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function codedError(code, message, status, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, details);
  return error;
}

function isLeaseActive(run, now) {
  if (!run || !run.leaseToken || !run.leaseExpiresAt) return false;
  const expiresAt = Date.parse(run.leaseExpiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  const nowMs = typeof now === 'function' ? now() : Date.now();
  const timestamp = nowMs instanceof Date ? nowMs.getTime() : nowMs;
  return expiresAt > timestamp;
}

/* 客户端传入 plan（P0 前端构建）时的口径：
   服务端永远以 nodes/connections 为准重算拓扑（防陈旧计划误跑）；
   客户端 layers/order 只有与重算拓扑同序集时才被信任（isValidTopologicalOrder），
   否则整体重算。estimatedUnits / targetNodeIds 从客户端透传（展示用）。 */
function normalizePlanInput({ plan, nodes, connections, targetNodeIds, costOf }) {
  const supported = new Set(SUPPORTED_GRAPH_RUN_KINDS);
  const computed = buildRunPlan({
    nodes, connections, targetNodeIds, supportedKinds: supported,
    costOf: typeof costOf === 'function' ? costOf : () => 0,
  });
  if (computed.ok === false) return computed;
  const clientPlan = plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : null;
  if (!clientPlan || clientPlan.ok === false) return computed;
  if (clientPlan.order && clientPlan.layers
    && isValidTopologicalOrder(clientPlan.order, clientPlan.layers, computed)) {
    return {
      ...computed,
      layers: clientPlan.layers,
      order: clientPlan.order,
      estimatedUnits: Number(clientPlan.estimatedUnits) || computed.estimatedUnits,
    };
  }
  return computed;
}

/* 只有客户端 layers/order 与服务端重算拓扑逐位一致时才信任（防陈旧计划误跑）；
   不一致（图被改动、目标子图变化）整体回退到服务端重算结果——仍走同一套分类口径。 */
function isValidTopologicalOrder(clientOrder, clientLayers, computed) {
  if (!Array.isArray(clientOrder) || clientOrder.length === 0) return false;
  const flat = [];
  if (Array.isArray(clientLayers)) {
    for (const layer of clientLayers) {
      if (!Array.isArray(layer)) return false;
      flat.push(...layer);
    }
  }
  if (flat.length !== clientOrder.length) return false;
  if (flat.some((id, i) => id !== clientOrder[i])) return false;
  if (clientOrder.length !== computed.order.length) return false;
  for (let i = 0; i < clientOrder.length; i += 1) {
    if (clientOrder[i] !== computed.order[i]) return false;
  }
  return true;
}

/* 落库的运行计划快照（resume 时重建执行上下文的唯一依据，不依赖客户端重传）。 */
function snapshotPlan(plan, nodeById, incoming, nodes) {
  const kindOf = node => (node?.actionId || node?.kind || '');
  const kinds = {};
  for (const id of plan.order) kinds[id] = nodeById.get(id) ? kindOf(nodeById.get(id)) : '';
  return {
    layers: plan.layers,
    order: plan.order,
    sourceNodeIds: plan.sourceNodeIds || [],
    unsupportedNodeIds: plan.unsupportedNodeIds || [],
    executableNodeIds: plan.executableNodeIds || [],
    estimatedUnits: plan.estimatedUnits || 0,
    nodeCount: plan.nodeCount || plan.order.length,
    kinds,
    nodes: (Array.isArray(nodes) ? nodes : [])
      .map(node => ({
        id: readNodeId(node),
        kind: kindOf(node),
        productUrl: nodeProductUrl(node),
        hasProduct: nodeHasProduct(node),
      }))
      .filter(entry => entry.id),
    incoming: incoming ? [...incoming.entries()].map(([id, ups]) => [id, ups]) : [],
  };
}

export function createCanvasGraphRunService({
  store,
  billActions,
  executeNode,
  now = Date.now,
  randomUUID,
  defaultLeaseMs = 30_000,
  billingLeaseMs = 120_000,
} = {}) {
  if (!store || typeof store.createRun !== 'function' || typeof store.transitionRun !== 'function') {
    throw new TypeError('canvas graph run store is required');
  }
  if (!billActions || typeof billActions.claim !== 'function' || typeof billActions.save !== 'function' || typeof billActions.release !== 'function') {
    throw new TypeError('leased canvas billed action store (claim/save/release) is required');
  }
  if (typeof executeNode !== 'function') throw new TypeError('executeNode executor is required');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (randomUUID !== undefined && typeof randomUUID !== 'function') throw new TypeError('randomUUID must be a function');
  if (!Number.isSafeInteger(defaultLeaseMs) || defaultLeaseMs <= 0) throw new TypeError('defaultLeaseMs must be a positive safe integer');
  if (!Number.isSafeInteger(billingLeaseMs) || billingLeaseMs <= 0) throw new TypeError('billingLeaseMs must be a positive safe integer');

  const supportedKinds = new Set(SUPPORTED_GRAPH_RUN_KINDS);

  /* 把持久化的计划快照重建回执行上下文（nodes 还原为最小可执行视图）。 */
  function contextFromSnapshot(snapshot) {
    const nodeById = new Map((snapshot.nodes || []).map(entry => [String(entry.id), {
      id: entry.id,
      kind: entry.kind || '',
      url: entry.productUrl || '',
      output: entry.productUrl ? { url: entry.productUrl } : undefined,
    }]));
    const incoming = new Map(snapshot.incoming || []);
    return { nodeById, incoming };
  }

  /* 汇出某节点的上游产物 URL（inputs[上游id] = url）：
     已完成步骤用落库 output_url；source 节点用其产物 URL。上游缺失/被封锁时不回退全图。 */
  function collectInputs(nodeId, incoming, outputs) {
    const ups = incoming.get(nodeId) || [];
    const inputs = {};
    for (const up of ups) inputs[up] = outputs.get(up) || '';
    return inputs;
  }

  function skipTransitiveDownstream(runId, nodeId, downstream, errorText) {
    const targets = downstream?.get?.(nodeId);
    if (!targets) return;
    const steps = store.listSteps(runId);
    const indexById = new Map(steps.map(step => [step.nodeId, step.stepIndex]));
    for (const target of [...targets]) {
      const stepIndex = indexById.get(target);
      if (stepIndex === undefined) continue;
      const step = store.getStep(runId, stepIndex);
      if (!step || step.state === 'completed' || step.state === 'skipped') continue;
      try {
        store.transitionStep(runId, stepIndex, { from: step.state, to: 'skipped', error: errorText });
      } catch {
        /* 并发漂移（另一 worker 已动过该步骤）：留给恢复路径处理，不阻断本 worker */
      }
    }
  }

  /* 执行层循环。假定调用方已持有 run 租约（startRun=createRun 自带；resumeRun=claimRun）。
     返回 { status, interrupted?, leaseLost?, billingInProgress? }。 */
  async function executeLayers(runId, owner, leaseToken, plan, nodeById, incoming, downstream) {
    const stepIndexById = new Map(plan.order.map((id, index) => [id, index]));
    const outputs = new Map();
    for (const step of store.listSteps(runId)) {
      if (step.state === 'completed') outputs.set(step.nodeId, step.outputUrl || nodeProductUrl(nodeById.get(step.nodeId) || {}));
    }
    const docId = store.getRun(runId)?.docId || '';

    for (const layer of plan.layers) {
      for (const nodeId of layer) {
        const stepIndex = stepIndexById.get(nodeId);
        const step = store.getStep(runId, stepIndex);
        if (!step || step.state === 'completed' || step.state === 'skipped' || step.state === 'failed') {
          continue; // completed=已完成(不再扣费)；skipped/failed=前次尝试已封锁，独立分支继续
        }
        // 每步之前先验权：状态漂移/租约过期/取消请求 都立即停止，不写任何钱列。
        const run = store.getRun(runId);
        if (!run || run.leaseToken !== leaseToken || !isLeaseActive(run, now)) {
          return { status: run?.status || 'running', interrupted: true, leaseLost: true };
        }
        if (run.status === 'cancel_requested') {
          finalizeCancellation(runId, leaseToken, downstream);
          return { status: 'cancelled' };
        }

        const node = nodeById.get(nodeId) || {};
        const kind = step.kind;
        const isSource = (plan.sourceNodeIds || []).includes(nodeId)
          || (!supportedKinds.has(kind) && nodeHasProduct(node));

        if (isSource) {
          const url = outputs.get(nodeId) || nodeProductUrl(node);
          try {
            store.settleStep(runId, stepIndex, { leaseToken, chargedUnits: 0, outputUrl: url });
          } catch {
            return { status: store.getRun(runId)?.status || 'running', interrupted: true, leaseLost: true };
          }
          outputs.set(nodeId, url);
          continue;
        }
        if ((plan.unsupportedNodeIds || []).includes(nodeId)) {
          store.transitionStep(runId, stepIndex, { from: 'queued', to: 'skipped', error: 'kind not supported yet' });
          skipTransitiveDownstream(runId, nodeId, downstream, 'upstream unsupported');
          continue;
        }

        const actionId = `${runId}:${nodeId}`;
        const claim = billActions.claim(owner, actionId, { sku: kind, leaseMs: billingLeaseMs });
        if (claim.status === 'settled') {
          // 幂等短路：该动作已在前次尝试 settled —— 不重跑执行器、不二次扣费。
          const record = claim.record || {};
          const charged = Number(record.units) || 0;
          const url = cleanString(record.outputUrl || record.result?.url || record.result?.result_url);
          try {
            store.settleStep(runId, stepIndex, { leaseToken, chargedUnits: charged, outputUrl: url });
          } catch {
            return { status: store.getRun(runId)?.status || 'running', interrupted: true, leaseLost: true };
          }
          outputs.set(nodeId, url);
          continue;
        }
        if (claim.status === 'in_progress') {
          // 另一个活跃 worker 持有该计费租约：本次让出，run 保持 running 可恢复。
          return { status: 'running', interrupted: true, billingInProgress: actionId };
        }
        const billingToken = claim.leaseToken;
        store.transitionStep(runId, stepIndex, { from: 'queued', to: 'running' });

        const ctx = {
          ownerEmail: owner,
          docId,
          runId,
          nodeId,
          kind,
          action: GRAPH_RUN_KIND_ACTIONS[kind] || 'process',
          stepIndex,
        };
        let result;
        try {
          result = await executeNode(node, collectInputs(nodeId, incoming, outputs), ctx);
        } catch (error) {
          result = { ok: false, error: error?.message || String(error) };
        }
        if (!result || typeof result !== 'object') result = { ok: false, error: 'executor returned an invalid result' };

        const after = store.getRun(runId);
        const ownershipLost = !after || after.leaseToken !== leaseToken || !isLeaseActive(after, now);

        if (result.ok) {
          const units = Number(result.units) || 0;          // 不变式 ③：只结算执行器回报的单位
          const outputUrl = cleanString(result.outputUrl || result.url);
          let persisted = false;
          try {
            billActions.save(owner, actionId, { status: 'settled', sku: kind, units, outputUrl }, { leaseToken: billingToken });
            persisted = true;
          } catch {
            persisted = false; // 计费租约已失效：保留动作记录（若已落 settled），恢复路径幂等接管
          }
          if (after.status === 'cancel_requested') {
            if (ownershipLost) {
              // 取消由仍持租约的 worker 负责收尾；这里只释放自己的未决持有。
              if (persisted) safeRelease(owner, actionId, billingToken);
              return { status: 'cancel_requested', interrupted: true, leaseLost: true };
            }
            if (!persisted) safeRelease(owner, actionId, billingToken);
            store.transitionStep(runId, stepIndex, { from: 'running', to: 'skipped', error: 'cancelled' });
            skipTransitiveDownstream(runId, nodeId, downstream, 'cancelled');
            finalizeCancellation(runId, leaseToken, downstream);
            return { status: 'cancelled' };
          }
          if (ownershipLost) {
            // 丢租约：钱记录已持久（若 save 成功），步骤行留给 resume 以 settled 记录幂等补齐。
            if (persisted) safeRelease(owner, actionId, billingToken);
            return { status: after.status, interrupted: true, leaseLost: true };
          }
          try {
            store.settleStep(runId, stepIndex, { leaseToken, chargedUnits: units, outputUrl });
          } catch {
            safeRelease(owner, actionId, billingToken); // 保留已落的 settled 记录；resume 幂等补齐
            return { status: store.getRun(runId)?.status || 'running', interrupted: true, leaseLost: true };
          }
          outputs.set(nodeId, outputUrl);
          continue;
        }

        // 失败路径：释放未决租约（不变式 ①），步骤落 failed，传递封锁下游（全部零扣费）。
        safeRelease(owner, actionId, billingToken);
        const failureText = cleanString(result.error) || 'executor failed';
        try {
          store.transitionStep(runId, stepIndex, { from: 'running', to: 'failed', error: failureText });
          skipTransitiveDownstream(runId, nodeId, downstream, `upstream failed: ${failureText}`);
        } catch {
          return { status: store.getRun(runId)?.status || 'running', interrupted: true, leaseLost: true };
        }
        continue;
      }
    }

    const steps = store.listSteps(runId);
    const dirty = steps.some(step => step.state === 'failed' || step.state === 'skipped');
    const finalStatus = dirty ? 'failed' : 'completed';
    try {
      store.transitionRun(runId, { from: 'running', to: finalStatus, leaseToken, releaseLease: true });
    } catch {
      return { status: store.getRun(runId)?.status || 'running', interrupted: true, leaseLost: true };
    }
    return { status: finalStatus };
  }

  function safeRelease(owner, actionId, billingToken) {
    try { billActions.release(owner, actionId, billingToken); } catch { /* 租约已丢/已删：无未决持有，安全 */ }
  }

  /* 取消收尾（worker 路径）：剩余未完成步骤全标 skipped（它们没有未决计费持有——
     每个步骤的 claim 在其迭代内已 settled 或 release），run 落 cancelled 并释放租约。 */
  function finalizeCancellation(runId, leaseToken, downstream) {
    const steps = store.listSteps(runId);
    for (const step of steps) {
      if (step.state !== 'queued' && step.state !== 'running') continue;
      try {
        store.transitionStep(runId, step.stepIndex, { from: step.state, to: 'skipped', error: 'cancelled' });
      } catch { /* 已被并发方处理 */ }
    }
    store.transitionRun(runId, { from: 'cancel_requested', to: 'cancelled', leaseToken, releaseLease: true });
  }

  function buildResult(runId, extra = {}) {
    const run = store.getRun(runId);
    const steps = store.listSteps(runId).map(step => ({
      stepIndex: step.stepIndex,
      nodeId: step.nodeId,
      kind: step.kind,
      state: step.state,
      chargedUnits: step.chargedUnits,
      outputUrl: step.outputUrl,
      error: step.error,
    }));
    return {
      runId,
      ownerEmail: run.ownerEmail,
      docId: run.docId,
      status: run.status,
      totalUnits: run.totalUnits,
      settledUnits: run.settledUnits,
      steps,
      ...extra,
    };
  }

  async function startRun(input = {}) {
    const ownerEmail = cleanString(input.ownerEmail).toLowerCase();
    if (!ownerEmail) throw codedError('CANVAS_GRAPH_RUN_REQUEST_INVALID', 'ownerEmail is required', 400);
    const docId = cleanString(input.docId);
    if (!docId) throw codedError('CANVAS_GRAPH_RUN_REQUEST_INVALID', 'docId is required', 400);

    const nodes = Array.isArray(input.nodes) ? input.nodes : [];
    const connections = Array.isArray(input.connections) ? input.connections : [];
    const plan = normalizePlanInput({
      plan: input.plan, nodes, connections,
      targetNodeIds: input.targetNodeIds, costOf: input.costOf,
    });
    if (plan.ok === false) {
      throw codedError('CANVAS_GRAPH_RUN_PLAN_INVALID', plan.reason === 'cycle' ? 'run plan contains a cycle' : 'run plan is invalid', 400, {
        reason: plan.reason,
        cycleNodeIds: plan.cycleNodeIds,
        blockedNodeIds: plan.blockedNodeIds,
      });
    }
    if (!plan.order.length) {
      throw codedError('CANVAS_GRAPH_RUN_EMPTY', 'run plan has no executable nodes', 400);
    }
    if (plan.unsupportedNodeIds.length) {
      const nodeById0 = new Map(nodes.map(node => [readNodeId(node), node]).filter(([id]) => id));
      const kinds = [...new Set(plan.unsupportedNodeIds.map(id => nodeById0.get(id)?.actionId || nodeById0.get(id)?.kind).filter(Boolean))];
      throw codedError('CANVAS_GRAPH_RUN_KIND_UNSUPPORTED', 'kind not supported yet', 400, {
        unsupportedKinds: kinds,
        unsupportedNodeIds: plan.unsupportedNodeIds,
      });
    }

    const nodeById = new Map(nodes.map(node => [readNodeId(node), node]).filter(([id]) => id));
    const incoming = buildGraphIncoming(nodes, connections);
    const downstream = buildTransitiveDownstream(nodes, connections);
    const snapshot = snapshotPlan(plan, nodeById, incoming, nodes);

    const created = store.createRun({
      ownerEmail, docId,
      plan: snapshot,
      totalUnits: plan.estimatedUnits,
      steps: plan.order.map((nodeId, stepIndex) => ({ nodeId, stepIndex, kind: snapshot.kinds[nodeId] || '' })),
      leaseMs: defaultLeaseMs,
    });
    const result = await executeLayers(created.runId, ownerEmail, created.leaseToken, plan, nodeById, incoming, downstream);
    return buildResult(created.runId, { resumed: false, ...result });
  }

  function cancelRun(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) throw codedError('CANVAS_GRAPH_RUN_REQUEST_INVALID', 'runId is required', 400);
    const run = store.getRun(runId);
    if (!run) throw codedError('CANVAS_GRAPH_RUN_NOT_FOUND', 'graph run not found', 404);
    if (run.status === 'completed' || run.status === 'cancelled' || run.status === 'failed') {
      return { runId, status: run.status, cancelled: false, note: `run already ${run.status}` };
    }
    if (isLeaseActive(run, now)) {
      // 有活跃 worker：标记取消，由 worker 步间落 cancelled（并释放其未决持有）。
      store.requestCancel(runId);
      return { runId, status: 'cancel_requested', cancelled: false, note: 'cancel requested; worker finalizes between steps' };
    }
    // 无主（worker 崩溃/租约过期）：直接落 cancelled，并释放所有未决计费持有。
    const claimed = store.claimRun(runId, { leaseMs: defaultLeaseMs });
    if (!claimed) return { runId, status: store.getRun(runId).status, cancelled: false, note: 'another worker is claiming the run' };
    for (const step of store.listSteps(runId)) {
      if (step.state === 'completed') continue;
      const actionId = `${runId}:${step.nodeId}`;
      try {
        const claim = billActions.claim(run.ownerEmail, actionId, { sku: step.kind, leaseMs: billingLeaseMs });
        if (claim.status === 'claimed') billActions.release(run.ownerEmail, actionId, claim.leaseToken);
        // settled：计费记录已落，不动（钱已结清，不是"未决持有"）。
      } catch { /* sku 冲突等：留待恢复路径 */ }
    }
    for (const step of store.listSteps(runId)) {
      if (step.state === 'completed') continue;
      try { store.transitionStep(runId, step.stepIndex, { from: step.state, to: 'skipped', error: 'cancelled' }); } catch {}
    }
    store.transitionRun(runId, { from: run.status, to: 'cancelled', leaseToken: claimed.leaseToken, releaseLease: true });
    return { runId, status: 'cancelled', cancelled: true };
  }

  async function resumeRun(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) throw codedError('CANVAS_GRAPH_RUN_REQUEST_INVALID', 'runId is required', 400);
    const run = store.getRun(runId);
    if (!run) throw codedError('CANVAS_GRAPH_RUN_NOT_FOUND', 'graph run not found', 404);
    if (run.status === 'completed' || run.status === 'cancelled') {
      return buildResult(runId, { resumed: false, note: `run already ${run.status}` });
    }
    if (isLeaseActive(run, now)) {
      throw codedError('CANVAS_GRAPH_RUN_IN_PROGRESS', 'run is in progress; retry after its lease expires', 409);
    }

    // 从落库快照重建上下文（不信任客户端重传）。
    const plan = run.plan || {};
    const { nodeById, incoming } = contextFromSnapshot(plan);
    const downstream = buildTransitiveDownstream(
      (plan.nodes || []).map(entry => ({ id: entry.id, kind: entry.kind })),
      (plan.incoming || []).flatMap(([id, ups]) => ups.map(up => ({ fromNodeId: up, toNodeId: id }))),
    );

    const claimed = store.claimRun(runId, { leaseMs: defaultLeaseMs });
    if (!claimed) throw codedError('CANVAS_GRAPH_RUN_IN_PROGRESS', 'run is in progress; retry after its lease expires', 409);
    const leaseToken = claimed.leaseToken;

    if (run.status === 'cancel_requested') {
      // 取消优先于重试：落成 cancelled（先 requeue 崩溃时停在 running 的步骤再统一 skipped）。
      for (const step of store.listSteps(runId)) {
        if (step.state === 'running') {
          try { store.transitionStep(runId, step.stepIndex, { from: 'running', to: 'queued' }); } catch {}
        }
      }
      finalizeCancellation(runId, leaseToken, downstream);
      return buildResult(runId, { resumed: false, note: 'cancelled: cancel was requested before resume', status: 'cancelled' });
    }

    if (run.status === 'failed') {
      // 显式重试：failed -> running；重开 failed 步骤与失败封锁的 skipped 步骤。
      store.transitionRun(runId, { from: 'failed', to: 'running', leaseToken });
      for (const step of store.listSteps(runId)) {
        if (step.state !== 'failed' && step.state !== 'skipped') continue;
        try { store.transitionStep(runId, step.stepIndex, { from: step.state, to: 'queued', error: '' }); } catch {}
      }
    } else {
      // 崩溃恢复：把停在 running 的步骤（前 worker 死在半途）requeue 回 queued。
      for (const step of store.listSteps(runId)) {
        if (step.state !== 'running') continue;
        try { store.transitionStep(runId, step.stepIndex, { from: 'running', to: 'queued', error: '' }); } catch {}
      }
    }

    const result = await executeLayers(runId, run.ownerEmail, leaseToken, plan, nodeById, incoming, downstream);
    return buildResult(runId, { resumed: true, ...result });
  }

  function getRun(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) return null;
    const run = store.getRun(runId);
    if (!run) return null;
    return buildResult(runId);
  }

  function recoverInterrupted() {
    return store.recoverInterrupted().map(entry => buildResult(entry.runId, { resumable: true }));
  }

  return {
    startRun,
    cancelRun,
    resumeRun,
    getRun,
    recoverInterrupted,
  };
}

/* P1 里程碑生产执行器适配（薄）：把既有免费/本地服务接到 graph-run 编排器。
   未接线的 kind 一律返回 { ok:false, error:'executor not wired for kind X' }——
   绝不在测试或默认路径里发起任何付费调用。接线见 graphRunRoutes.mjs 顶部 WIRE-IN。 */
export { createCanvasGraphRunExecutor } from './graphRunExecutor.mjs';
