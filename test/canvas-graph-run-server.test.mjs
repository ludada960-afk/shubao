// test/canvas-graph-run-server.test.mjs
// P1 后端宿主 — 画布整链 orchestrator 零成本回归（in-memory better-sqlite3 + FAKE 执行器）。
// 覆盖：拓扑分层/顺序、source 无扣费、按节点结算、失败传递封锁、幂等计费、
//       取消（worker 活跃 + 无主）、CAS 租约过期后 resume 不重扣、迁移幂等、路由守卫。

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { createCanvasBilledActionStore } from '../server/billing/canvasBilledActionStore.mjs';
import { createCanvasGraphRunStore } from '../server/canvas/graphRunSchema.mjs';
import { createCanvasGraphRunService } from '../server/canvas/graphRunService.mjs';
import { createCanvasGraphRunExecutor } from '../server/canvas/graphRunExecutor.mjs';
import { mountCanvasGraphRunRoutes } from '../server/canvas/graphRunRoutes.mjs';
import { buildRunPlan, planGraphRun, buildTransitiveDownstream } from '../server/canvas/graphRunPlan.mjs';

// ---------- 可控时钟 + 确定性 UUID ----------
function createClock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, advance: ms => { t += ms; }, value: () => t };
}
function createUuid() {
  let n = 0;
  return () => { n += 1; return 'test-uuid-' + n; };
}

// ---------- 测试 harness ----------
function createHarness({
  clock = createClock(),
  runLeaseMs = 30_000,
  billingLeaseMs = 120_000,
  executor = async () => ({ ok: true, outputUrl: 'https://cdn.test/out.png', units: 700 }),
} = {}) {
  const db = new Database(':memory:');
  const billActions = createCanvasBilledActionStore(db, { now: clock.now, randomUUID: createUuid(), defaultLeaseMs: billingLeaseMs });
  const store = createCanvasGraphRunStore(db, { now: clock.now, randomUUID: createUuid(), defaultLeaseMs: runLeaseMs });
  const service = createCanvasGraphRunService({ store, billActions, executeNode: executor, now: clock.now, randomUUID: createUuid(), defaultLeaseMs: runLeaseMs, billingLeaseMs });
  return { db, billActions, store, service, clock };
}

// ---------- 图 fixtures ----------
const productSrc = { id: 'src', kind: 'product-image', url: 'https://cdn.test/product.jpg' };
const chainNodes = [productSrc, { id: 'rb', kind: 'remove-bg' }, { id: 'up', kind: 'upscale' }];
const chainConns = [{ fromNodeId: 'src', toNodeId: 'rb' }, { fromNodeId: 'rb', toNodeId: 'up' }];
const diamondNodes = [productSrc, { id: 'b', kind: 'remove-bg' }, { id: 'c', kind: 'upscale' }, { id: 'd', kind: 'suite-composer' }];
const diamondConns = [
  { fromNodeId: 'src', toNodeId: 'b' }, { fromNodeId: 'src', toNodeId: 'c' },
  { fromNodeId: 'b', toNodeId: 'd' }, { fromNodeId: 'c', toNodeId: 'd' },
];
const longChainNodes = [productSrc, { id: 'rb', kind: 'remove-bg' }, { id: 'up', kind: 'upscale' }, { id: 'fin', kind: 'suite-composer' }];
const longChainConns = [
  { fromNodeId: 'src', toNodeId: 'rb' }, { fromNodeId: 'rb', toNodeId: 'up' }, { fromNodeId: 'up', toNodeId: 'fin' },
];

function makeExecutor({ calls = [], failNodeIds = new Set(), onExecuted = null, gate = null } = {}) {
  return async (node, inputs, ctx) => {
    calls.push({ nodeId: ctx.nodeId, kind: ctx.kind, inputKeys: Object.keys(inputs) });
    if (gate && gate.node === ctx.nodeId) await gate.promise;
    if (onExecuted) onExecuted(ctx);
    if (failNodeIds.has(ctx.nodeId)) return { ok: false, error: 'fake executor failed' };
    return { ok: true, outputUrl: 'https://cdn.test/' + ctx.nodeId + '.png', units: 700 };
  };
}

const stateOf = (result, nodeId) => result.steps.find(step => step.nodeId === nodeId)?.state;

// ---------- (1) 拓扑分层 / 顺序 ----------
test('graph run plan: chain and diamond topo layers/order are P0-consistent', () => {
  const chainPlan = buildRunPlan({ nodes: chainNodes, connections: chainConns });
  assert.equal(chainPlan.ok, true);
  assert.deepEqual(chainPlan.layers, [['src'], ['rb'], ['up']]);
  assert.deepEqual(chainPlan.order, ['src', 'rb', 'up']);

  const diamondPlan = buildRunPlan({ nodes: diamondNodes, connections: diamondConns });
  assert.deepEqual(diamondPlan.layers, [['src'], ['b', 'c'], ['d']]);
  assert.deepEqual(diamondPlan.order, ['src', 'b', 'c', 'd']);
  assert.deepEqual(diamondPlan.executableNodeIds, ['b', 'c', 'd']);
  assert.deepEqual(diamondPlan.sourceNodeIds, ['src']);
  assert.deepEqual(diamondPlan.unsupportedNodeIds, []);

  const cyclic = planGraphRun({
    nodes: [{ id: 'a' }, { id: 'b' }],
    connections: [{ fromNodeId: 'a', toNodeId: 'b' }, { fromNodeId: 'b', toNodeId: 'a' }],
  });
  assert.equal(cyclic.ok, false);
  assert.equal(cyclic.reason, 'cycle');

  const targeted = planGraphRun({ nodes: diamondNodes, connections: diamondConns, targetNodeIds: ['d'] });
  assert.deepEqual(targeted.order, ['src', 'b', 'c', 'd']);

  const down = buildTransitiveDownstream(longChainNodes, longChainConns);
  assert.ok(down.get('rb').has('up') && down.get('rb').has('fin'));
  assert.ok(!down.get('up')?.has('rb'));
});

test('startRun executes a 3-node chain in layer order and feeds upstream outputs downstream', async () => {
  const calls = [];
  const harness = createHarness({ executor: makeExecutor({ calls }) });
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: chainNodes, connections: chainConns,
  });
  assert.equal(result.status, 'completed');
  assert.equal(typeof result.runId, 'string');
  assert.equal(stateOf(result, 'src'), 'completed');
  assert.equal(stateOf(result, 'rb'), 'completed');
  assert.equal(stateOf(result, 'up'), 'completed');
  assert.deepEqual(calls.map(entry => entry.nodeId), ['rb', 'up']);
  const rbCall = calls[0];
  const upCall = calls[1];
  assert.ok(rbCall.inputKeys.includes('src'));
  assert.ok(upCall.inputKeys.includes('rb'));
  assert.equal(result.steps.find(step => step.nodeId === 'up').outputUrl, 'https://cdn.test/up.png');
});

test('diamond: both branches run once and merge node receives both inputs', async () => {
  const calls = [];
  const harness = createHarness({ executor: makeExecutor({ calls }) });
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: diamondNodes, connections: diamondConns,
  });
  assert.equal(result.status, 'completed');
  assert.deepEqual(calls.filter(entry => entry.nodeId === 'b').length, 1);
  assert.deepEqual(calls.filter(entry => entry.nodeId === 'c').length, 1);
  assert.deepEqual(calls.filter(entry => entry.nodeId === 'd').length, 1);
  const dCall = calls.find(entry => entry.nodeId === 'd');
  assert.ok(dCall.inputKeys.includes('b') && dCall.inputKeys.includes('c'));
  assert.equal(result.settledUnits, 700 * 3);
});

// ---------- (2) source 节点无扣费 ----------
test('source node (hasProduct) completes as no-op with 0 charge and feeds downstream', async () => {
  const calls = [];
  const harness = createHarness({ executor: makeExecutor({ calls }) });
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: chainNodes, connections: chainConns,
  });
  const srcStep = result.steps.find(step => step.nodeId === 'src');
  assert.equal(srcStep.state, 'completed');
  assert.equal(srcStep.chargedUnits, 0);
  assert.equal(srcStep.outputUrl, 'https://cdn.test/product.jpg');
  assert.equal(calls.some(entry => entry.nodeId === 'src'), false);
  // source 节点绝不进计费动作表（claim/save 均未发生）
  assert.equal(harness.billActions.get('a@x.com', `${result.runId}:src`), null);
});

// ---------- (3) 按节点结算 ----------
test('per-node charge settles on success (billing record + step charged_units + run settled_units)', async () => {
  const harness = createHarness();
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: chainNodes, connections: chainConns,
  });
  const rbRecord = harness.billActions.get('a@x.com', `${result.runId}:rb`);
  assert.equal(rbRecord?.status, 'settled');
  assert.equal(rbRecord.units, 700);
  assert.equal(rbRecord.sku, 'remove-bg');
  assert.equal(result.steps.find(step => step.nodeId === 'rb').chargedUnits, 700);
  assert.equal(result.settledUnits, 1400);
  assert.equal(result.totalUnits, 0); // 无 costOf -> 估算 0，绝不猜价
});

// ---------- (4) 失败传递封锁 ----------
test('failure containment: failing node\'s transitive downstream becomes skipped and is NOT charged', async () => {
  const calls = [];
  const harness = createHarness({ executor: makeExecutor({ calls, failNodeIds: new Set(['rb']) }) });
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: longChainNodes, connections: longChainConns,
  });
  assert.equal(result.status, 'failed');
  assert.equal(stateOf(result, 'src'), 'completed');
  assert.equal(stateOf(result, 'rb'), 'failed');
  assert.equal(stateOf(result, 'up'), 'skipped');
  assert.equal(stateOf(result, 'fin'), 'skipped');
  assert.equal(result.steps.find(step => step.nodeId === 'up').chargedUnits, 0);
  assert.equal(result.steps.find(step => step.nodeId === 'fin').chargedUnits, 0);
  assert.equal(calls.map(entry => entry.nodeId).join(','), 'rb'); // 下游执行器从未被调用
  assert.equal(harness.billActions.get('a@x.com', `${result.runId}:up`), null);
  assert.equal(harness.billActions.get('a@x.com', `${result.runId}:fin`), null);
  // 失败步骤的计费租约已释放：claim 行清空
  const claimRows = harness.db.prepare('SELECT COUNT(*) AS c FROM canvas_billed_action_claims').get();
  assert.equal(claimRows.c, 0);
  assert.equal(result.settledUnits, 0);
});

// ---------- (5) 幂等计费 ----------
test('idempotent billing: re-claiming a settled action does not double-charge', async () => {
  const calls = [];
  const harness = createHarness({ executor: makeExecutor({ calls }) });
  const result = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-1', nodes: chainNodes, connections: chainConns,
  });
  const before = result.settledUnits;
  const reClaim = harness.billActions.claim('a@x.com', `${result.runId}:rb`, { sku: 'remove-bg' });
  assert.equal(reClaim.status, 'settled');
  assert.equal(reClaim.record?.units, 700);
  const records = harness.db.prepare('SELECT COUNT(*) AS c FROM canvas_billed_actions WHERE owner_email = ? AND action_id = ?').get('a@x.com', `${result.runId}:rb`);
  assert.equal(records.c, 1);
  const after = harness.service.getRun(result.runId);
  assert.equal(after.settledUnits, before); // settled_units 稳定
  const resume = await harness.service.resumeRun(result.runId);
  assert.equal(resume.status, 'completed');
  assert.equal(calls.length, 2); // 已完成的 run 不重跑任何执行器
});

// ---------- (6) CAS 租约过期 + resume 不重扣 ----------
test('resume after lease expiry re-runs only incomplete steps with no double charge', async () => {
  const calls = [];
  const harness = createHarness({
    runLeaseMs: 100,
    billingLeaseMs: 120_000,
    executor: makeExecutor({
      calls,
      onExecuted: ctx => { if (ctx.nodeId === 'up') harness.clock.advance(300); },
    }),
  });
  const first = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-2', nodes: chainNodes, connections: chainConns,
  });
  // up 执行期间 run 租约过期 -> worker 主动让出（不写钱列），run 停在 running 可恢复。
  assert.equal(first.status, 'running');
  assert.equal(first.interrupted, true);
  assert.equal(first.settledUnits, 700);
  assert.equal(stateOf(first, 'up'), 'running');
  const originalToken = harness.store.getRun(first.runId).leaseToken;
  assert.ok(originalToken);
  // 计费记录已落 settled（执行器干完活），但 run 的钱列未累加
  assert.equal(harness.billActions.get('a@x.com', `${first.runId}:up`)?.status, 'settled');
  const claims = harness.db.prepare('SELECT COUNT(*) AS c FROM canvas_billed_action_claims').get();
  assert.equal(claims.c, 0);

  const resume = await harness.service.resumeRun(first.runId);
  assert.equal(resume.status, 'completed');
  assert.equal(resume.settledUnits, 1400); // 700(rb) + 700(up)：不重扣
  assert.equal(stateOf(resume, 'up'), 'completed');
  assert.equal(resume.steps.find(step => step.nodeId === 'up').chargedUnits, 700);
  assert.equal(calls.filter(entry => entry.nodeId === 'rb').length, 1);
  assert.equal(calls.filter(entry => entry.nodeId === 'up').length, 1); // 幂等短路：settled 不重跑执行器
  const newToken = harness.store.getRun(first.runId).leaseToken;
  assert.equal(newToken, ''); // 终态已释放租约
  void originalToken;
});

test('resume of a failed run retries only failed/skipped steps (explicit retry, no re-charge of settled)', async () => {
  const calls = [];
  const failNow = new Set(['rb']);
  const harness = createHarness({
    executor: makeExecutor({ calls, failNodeIds: failNow, onExecuted: () => {} }),
  });
  const first = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-3', nodes: longChainNodes, connections: longChainConns,
  });
  assert.equal(first.status, 'failed');
  failNow.clear(); // 用户显式重试
  const retry = await harness.service.resumeRun(first.runId);
  assert.equal(retry.status, 'completed');
  assert.equal(retry.settledUnits, 700 * 3);
  assert.equal(calls.filter(entry => entry.nodeId === 'rb').length, 2); // 失败步骤重跑一次
  assert.equal(calls.filter(entry => entry.nodeId === 'up').length, 1);
  assert.equal(calls.filter(entry => entry.nodeId === 'fin').length, 1);
});

// ---------- (7) 取消 ----------
test('cancelRun stops an active run (worker finalizes between steps, unsettled hold released)', async () => {
  const calls = [];
  const gate = { node: 'rb', promise: null };
  let releaseGate;
  gate.promise = new Promise(resolve => { releaseGate = resolve; });
  let cancelled = null;
  const harness = createHarness({
    executor: makeExecutor({
      calls,
      gate,
      // worker 进入 rb 执行（租约仍有效）时请求取消：cancelRun 只能标 cancel_requested，
      // 由 worker 在步间落成 cancelled（本用例验证的正是这条路径）。
      onExecuted: ctx => { cancelled = harness.service.cancelRun(ctx.runId); },
    }),
  });
  const pending = harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-4', nodes: longChainNodes, connections: longChainConns,
  });
  while (!calls.length) await new Promise(resolve => setTimeout(resolve, 5));
  releaseGate();
  const result = await pending;
  assert.equal(cancelled.status, 'cancel_requested');
  assert.equal(cancelled.cancelled, false);
  assert.equal(result.status, 'cancelled');
  assert.equal(stateOf(result, 'rb'), 'skipped');
  assert.equal(stateOf(result, 'up'), 'skipped');
  assert.equal(stateOf(result, 'fin'), 'skipped');
  assert.equal(result.settledUnits, 0);
  // 未决持有全部释放：claim 表无残留
  const claims = harness.db.prepare('SELECT COUNT(*) AS c FROM canvas_billed_action_claims').get();
  assert.equal(claims.c, 0);
});

test('cancelRun (ownerless, lease expired) finalizes immediately and skips remaining steps', async () => {
  const calls = [];
  const harness = createHarness({
    runLeaseMs: 100,
    executor: makeExecutor({
      calls,
      onExecuted: ctx => {
        if (ctx.nodeId === 'rb') harness.clock.advance(60);   // rb 在租约内完成 -> 正常结算
        if (ctx.nodeId === 'up') harness.clock.advance(300);  // up 跑久 -> 执行返回时租约已过期，worker 让出
      },
    }),
  });
  const first = await harness.service.startRun({
    ownerEmail: 'a@x.com', docId: 'doc-5', nodes: longChainNodes, connections: longChainConns,
  });
  assert.equal(first.status, 'running'); // up 结算前租约过期，worker 让出（钱列未写）
  assert.equal(stateOf(first, 'rb'), 'completed');
  assert.equal(stateOf(first, 'up'), 'running');
  assert.equal(first.settledUnits, 700);
  const cancel = harness.service.cancelRun(first.runId);
  assert.equal(cancel.cancelled, true);
  assert.equal(cancel.status, 'cancelled');
  const detail = harness.service.getRun(first.runId);
  assert.equal(detail.status, 'cancelled');
  assert.equal(stateOf(detail, 'rb'), 'completed');
  assert.equal(stateOf(detail, 'up'), 'skipped');
  assert.equal(detail.settledUnits, 700); // 已结算的 rb 不受取消影响
  assert.equal(harness.billActions.get('a@x.com', `${first.runId}:rb`)?.status, 'settled');
  // up 的未决计费持有已被释放：claim 表无残留
  const claims = harness.db.prepare('SELECT COUNT(*) AS c FROM canvas_billed_action_claims').get();
  assert.equal(claims.c, 0);
});

// ---------- (8) 迁移幂等 ----------
test('schema migration is idempotent (double init + legacy column backfill)', () => {
  const dbA = new Database(':memory:');
  createCanvasGraphRunStore(dbA);
  createCanvasGraphRunStore(dbA); // 第二次初始化不报错
  const colsA = dbA.prepare('PRAGMA table_info(canvas_graph_runs)').all().map(c => c.name);
  assert.deepEqual(colsA.sort(), [
    'created_at', 'doc_id', 'lease_expires_at', 'lease_token', 'owner_email',
    'plan_json', 'run_id', 'settled_units', 'status', 'total_units', 'updated_at',
  ].sort());

  // 旧库：缺 total_units/settled_units/lease_token/lease_expires_at -> PRAGMA 守卫 ALTER 补齐
  const dbL = new Database(':memory:');
  dbL.exec(`
    CREATE TABLE canvas_graph_runs (
      run_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      plan_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE canvas_graph_run_steps (
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'queued',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (run_id, step_index)
    );
  `);
  createCanvasGraphRunStore(dbL);
  const colsL = dbL.prepare('PRAGMA table_info(canvas_graph_runs)').all().map(c => c.name);
  for (const col of ['total_units', 'settled_units', 'lease_token', 'lease_expires_at']) {
    assert.ok(colsL.includes(col), `legacy table backfilled with ${col}`);
  }
  const stepCols = dbL.prepare('PRAGMA table_info(canvas_graph_run_steps)').all().map(c => c.name);
  for (const col of ['held_units', 'charged_units', 'output_url', 'error']) {
    assert.ok(stepCols.includes(col), `legacy steps table backfilled with ${col}`);
  }
});

// ---------- 执行器薄适配 ----------
test('executor adapter: wired free kinds work, unwired kinds fail with a clear message (zero-cost)', async () => {
  const executor = createCanvasGraphRunExecutor({
    removeBackground: async ({ imageUrl }) => ({ ok: true, outputUrl: 'https://cdn.test/cut.png', units: 0 }),
  });
  const ok = await executor({ id: 'n1', kind: 'remove-bg' }, { src: 'https://cdn.test/src.png' }, { nodeId: 'n1', kind: 'remove-bg' });
  assert.equal(ok.ok, true);
  assert.equal(ok.outputUrl, 'https://cdn.test/cut.png');
  assert.equal('units' in ok, false); // 免费本地路径不回报 units（0 结算，不变式 ③）
  const miss = await executor({ id: 'n2', kind: 'translate' }, {}, { nodeId: 'n2', kind: 'translate' });
  assert.equal(miss.ok, false);
  assert.match(miss.error, /executor not wired for kind translate/);
  // 执行器抛错也被归一化为 { ok:false, error }（绝不冒泡崩溃编排器）
  const throwing = createCanvasGraphRunExecutor({
    removeBackground: async () => { throw new Error('local pipeline broke'); },
  });
  const thrown = await throwing({ id: 'n3', kind: 'remove-bg' }, { src: 'https://cdn.test/src.png' }, { nodeId: 'n3', kind: 'remove-bg' });
  assert.equal(thrown.ok, false);
  assert.match(thrown.error, /local pipeline broke/);
});

// ---------- 路由守卫 ----------
function createFakeApp() {
  const routes = new Map();
  return {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); },
    routes,
  };
}
function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}
/* 支持 :param 占位的路由匹配（镜像 admin-routes 测试的 fake app 口径）。 */
function findRoute(app, method, path) {
  const segments = path.split('/');
  for (const key of app.routes.keys()) {
    if (!key.startsWith(method + ' ')) continue;
    const pattern = key.slice(method.length + 1).split('/');
    if (pattern.length !== segments.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < pattern.length; i += 1) {
      if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = segments[i];
      else if (pattern[i] !== segments[i]) { match = false; break; }
    }
    if (match) return { key, params };
  }
  return null;
}
async function invoke(app, method, path, request = {}) {
  const found = findRoute(app, method, path);
  assert.ok(found, `mounted ${method} ${path}`);
  const handlers = app.routes.get(found.key);
  const req = { body: request.body ?? {}, headers: request.headers ?? {}, params: { ...found.params, ...(request.params ?? {}) }, query: request.query ?? {} };
  const res = createResponse();
  let index = 0;
  const next = async () => { const handler = handlers[index]; if (handler) await handler(req, res, next); };
  await next();
  return res;
}

test('routes: kind guard, auth, owner check, cancel', async () => {
  const harness = createHarness();
  const app = createFakeApp();
  mountCanvasGraphRunRoutes(app, {
    service: harness.service,
    authorize(req) {
      const email = String(req.headers['x-test-user'] || '').trim().toLowerCase();
      if (!email) throw Object.assign(new Error('session required'), { code: 'AUTH_SESSION_REQUIRED', status: 401 });
      return email;
    },
  });

  // 未登录 -> 401
  const unauth = await invoke(app, 'POST', '/api/canvas/graph/run', { body: { docId: 'd' } });
  assert.equal(unauth.statusCode, 401);

  // text 节点（无产物）-> 400 'kind not supported yet'
  const textRun = await invoke(app, 'POST', '/api/canvas/graph/run', {
    headers: { 'x-test-user': 'a@x.com' },
    body: {
      docId: 'd',
      nodes: [{ id: 't1', kind: 'text' }, { id: 'a', kind: 'image-composer' }],
      connections: [{ fromNodeId: 't1', toNodeId: 'a' }],
    },
  });
  assert.equal(textRun.statusCode, 400);
  assert.equal(textRun.body.code, 'CANVAS_GRAPH_RUN_KIND_UNSUPPORTED');
  assert.equal(textRun.body.error, 'kind not supported yet');
  assert.deepEqual(textRun.body.unsupportedKinds, ['text']);

  // video 节点（无产物）-> 400
  const videoRun = await invoke(app, 'POST', '/api/canvas/graph/run', {
    headers: { 'x-test-user': 'a@x.com' },
    body: {
      docId: 'd',
      nodes: [{ id: 'v1', kind: 'video' }, { id: 'a', kind: 'upscale' }],
      connections: [{ fromNodeId: 'v1', toNodeId: 'a' }],
    },
  });
  assert.equal(videoRun.statusCode, 400);
  assert.deepEqual(videoRun.body.unsupportedKinds, ['video']);

  // 合法白底旗舰链 -> 200 completed
  const okRun = await invoke(app, 'POST', '/api/canvas/graph/run', {
    headers: { 'x-test-user': 'a@x.com' },
    body: { docId: 'd', nodes: chainNodes, connections: chainConns },
  });
  assert.equal(okRun.statusCode, 200);
  assert.equal(okRun.body.status, 'completed');
  assert.equal(okRun.body.ok, true);

  // 缺 docId -> 400
  const noDoc = await invoke(app, 'POST', '/api/canvas/graph/run', {
    headers: { 'x-test-user': 'a@x.com' },
    body: { nodes: chainNodes, connections: chainConns },
  });
  assert.equal(noDoc.statusCode, 400);
  assert.equal(noDoc.body.code, 'CANVAS_GRAPH_RUN_REQUEST_INVALID');

  // GET owner 校验：他人 -> 404；本人 -> 200
  const foreign = await invoke(app, 'GET', `/api/canvas/graph/runs/${okRun.body.runId}`, { headers: { 'x-test-user': 'b@x.com' } });
  assert.equal(foreign.statusCode, 404);
  const mine = await invoke(app, 'GET', `/api/canvas/graph/runs/${okRun.body.runId}`, { headers: { 'x-test-user': 'a@x.com' } });
  assert.equal(mine.statusCode, 200);
  assert.equal(mine.body.status, 'completed');
  assert.equal(mine.body.steps.length, 3);

  // cancel：他人 -> 404；本人（已完成）-> 200 cancelled:false
  const cancelForeign = await invoke(app, 'POST', `/api/canvas/graph/runs/${okRun.body.runId}/cancel`, { headers: { 'x-test-user': 'b@x.com' } });
  assert.equal(cancelForeign.statusCode, 404);
  const cancelMine = await invoke(app, 'POST', `/api/canvas/graph/runs/${okRun.body.runId}/cancel`, { headers: { 'x-test-user': 'a@x.com' } });
  assert.equal(cancelMine.statusCode, 200);
  assert.equal(cancelMine.body.cancelled, false);
  assert.equal(cancelMine.body.status, 'completed');
});
