// server/canvas/graphRunSchema.mjs
// P1 后端宿主 — 画布整链 run/step 持久化 + CAS 租约（镜像 server/ecommerceEngine/jobStore.mjs 的 CAS 模型）。
//
// 状态词表：
//   runs : running / cancel_requested / completed / failed / cancelled
//          （cancel_requested = "取消已请求，持有租约的 worker 会在步间把它落成 cancelled"；
//            failed 不是对 resume 的终态——显式重试可 failed -> running 重开，P0"失败留给用户显式重试"）
//   steps: queued / running / completed / failed / skipped
//
// CAS 口径（与 jobStore 一致）：所有状态迁移都是
//   UPDATE ... WHERE ... AND <旧状态> AND COALESCE(lease_token,'')=? -> changed===1，否则抛错。
// 不变式 ①：结算列 settled_units 只能在"持有 run 租约"的事务里累加（settleStep 双表 CAS），
// 任何丢掉租约的 worker 都无法再写钱列。
//
// 迁移：CREATE TABLE IF NOT EXISTS + PRAGMA table_info 守卫的 ALTER TABLE ADD COLUMN
// （镜像 server/db.mjs 的既有列补齐方式；旧库缺列时自动补，新库是 no-op）。

import { randomUUID as nodeRandomUUID } from 'node:crypto';

export const RUN_STATES = Object.freeze(['running', 'cancel_requested', 'completed', 'failed', 'cancelled']);
export const STEP_STATES = Object.freeze(['queued', 'running', 'completed', 'failed', 'skipped']);
const RUN_FINAL_STATES = new Set(['completed', 'cancelled', 'failed']);

/* 状态机（镜像 jobStore 的 TRANSITIONS）：越界迁移一律抛错。 */
const RUN_TRANSITIONS = Object.freeze({
  running: new Set(['cancel_requested', 'completed', 'failed', 'cancelled']),
  cancel_requested: new Set(['cancelled']),
  failed: new Set(['running']),   // 显式重试（resumeRun 先 claim 租约再重开）
  completed: new Set(),
  cancelled: new Set(),
});
const STEP_TRANSITIONS = Object.freeze({
  queued: new Set(['running', 'completed', 'failed', 'skipped']),
  running: new Set(['completed', 'failed', 'skipped', 'queued']), // queued = 崩溃恢复 requeue
  failed: new Set(['queued']),                                     // 显式重试
  skipped: new Set(['queued']),                                    // 失败封锁的下游随重试重开
  completed: new Set(),
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNow(now) {
  const value = now();
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
  return timestamp;
}

function parsePlan(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function rowToRun(row) {
  if (!row) return null;
  return {
    runId: row.run_id,
    ownerEmail: row.owner_email,
    docId: row.doc_id,
    status: row.status,
    plan: parsePlan(row.plan_json),
    totalUnits: Number(row.total_units) || 0,
    settledUnits: Number(row.settled_units) || 0,
    leaseToken: row.lease_token || '',
    leaseExpiresAt: row.lease_expires_at || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToStep(row) {
  if (!row) return null;
  return {
    runId: row.run_id,
    stepIndex: Number(row.step_index),
    nodeId: row.node_id,
    kind: row.kind,
    state: row.state,
    heldUnits: Number(row.held_units) || 0,
    chargedUnits: Number(row.charged_units) || 0,
    outputUrl: row.output_url || '',
    error: row.error || '',
    updatedAt: row.updated_at,
  };
}

/* 列清单（名称 + 旧库缺列时的 ADD COLUMN 默认值）——迁移幂等的唯一依据。 */
const RUN_COLUMNS = [
  ['run_id', 'TEXT'],
  ['owner_email', "TEXT NOT NULL DEFAULT ''"],
  ['doc_id', "TEXT NOT NULL DEFAULT ''"],
  ['status', "TEXT NOT NULL DEFAULT 'running'"],
  ['plan_json', "TEXT NOT NULL DEFAULT '{}'"],
  ['total_units', 'INTEGER NOT NULL DEFAULT 0'],
  ['settled_units', 'INTEGER NOT NULL DEFAULT 0'],
  ['lease_token', 'TEXT'],
  ['lease_expires_at', 'TEXT'],
  ['created_at', "TEXT NOT NULL DEFAULT ''"],
  ['updated_at', "TEXT NOT NULL DEFAULT ''"],
];
const STEP_COLUMNS = [
  ['run_id', 'TEXT NOT NULL'],
  ['step_index', 'INTEGER NOT NULL'],
  ['node_id', "TEXT NOT NULL DEFAULT ''"],
  ['kind', "TEXT NOT NULL DEFAULT ''"],
  ['state', "TEXT NOT NULL DEFAULT 'queued'"],
  ['held_units', 'INTEGER NOT NULL DEFAULT 0'],
  ['charged_units', 'INTEGER NOT NULL DEFAULT 0'],
  ['output_url', "TEXT NOT NULL DEFAULT ''"],
  ['error', "TEXT NOT NULL DEFAULT ''"],
  ['updated_at', "TEXT NOT NULL DEFAULT ''"],
];

function ensureColumns(db, table, columns) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  for (const [name, definition] of columns) {
    if (existing.has(name)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

export function createCanvasGraphRunStore(db, {
  now = Date.now,
  randomUUID = nodeRandomUUID,
  defaultLeaseMs = 30_000,
} = {}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('a better-sqlite3 database is required');
  }
  if (typeof now !== 'function' || typeof randomUUID !== 'function') {
    throw new TypeError('now and randomUUID must be functions');
  }
  if (!Number.isSafeInteger(defaultLeaseMs) || defaultLeaseMs <= 0) {
    throw new TypeError('defaultLeaseMs must be a positive safe integer');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_graph_runs (
      run_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      plan_json TEXT NOT NULL,
      total_units INTEGER NOT NULL DEFAULT 0,
      settled_units INTEGER NOT NULL DEFAULT 0,
      lease_token TEXT,
      lease_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS canvas_graph_run_steps (
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued',
      held_units INTEGER NOT NULL DEFAULT 0,
      charged_units INTEGER NOT NULL DEFAULT 0,
      output_url TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (run_id, step_index)
    );
  `);
  // 旧库升级守卫：缺哪列补哪列（PRAGMA 检查，镜像 server/db.mjs）。
  // 必须在建恢复索引之前补齐——旧表缺 lease_expires_at 时，索引 DDL 会直接报错。
  ensureColumns(db, 'canvas_graph_runs', RUN_COLUMNS);
  ensureColumns(db, 'canvas_graph_run_steps', STEP_COLUMNS);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_canvas_graph_runs_recovery
      ON canvas_graph_runs(status, lease_expires_at, updated_at);
    CREATE INDEX IF NOT EXISTS idx_canvas_graph_run_steps_recovery
      ON canvas_graph_run_steps(state, updated_at);
  `);

  const statements = {
    getRun: db.prepare('SELECT * FROM canvas_graph_runs WHERE run_id = ?'),
    getStep: db.prepare('SELECT * FROM canvas_graph_run_steps WHERE run_id = ? AND step_index = ?'),
    listSteps: db.prepare('SELECT * FROM canvas_graph_run_steps WHERE run_id = ? ORDER BY step_index'),
    insertRun: db.prepare(`
      INSERT INTO canvas_graph_runs (
        run_id, owner_email, doc_id, status, plan_json, total_units, settled_units,
        lease_token, lease_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'running', ?, ?, 0, ?, ?, ?, ?)
    `),
    insertStep: db.prepare(`
      INSERT INTO canvas_graph_run_steps (
        run_id, step_index, node_id, kind, state, held_units, charged_units, output_url, error, updated_at
      ) VALUES (?, ?, ?, ?, 'queued', 0, 0, '', '', ?)
    `),
    claimRun: db.prepare(`
      UPDATE canvas_graph_runs
      SET lease_token = ?, lease_expires_at = ?, updated_at = ?
      WHERE run_id = ?
        AND status IN ('running', 'cancel_requested', 'failed')
        AND (
          lease_token IS NULL
          OR lease_expires_at IS NULL
          OR lease_expires_at <= ?
        )
    `),
    renewRunLease: db.prepare(`
      UPDATE canvas_graph_runs
      SET lease_expires_at = ?, updated_at = ?
      WHERE run_id = ? AND lease_token = ? AND lease_expires_at > ?
    `),
    releaseRunLease: db.prepare(`
      UPDATE canvas_graph_runs
      SET lease_token = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE run_id = ? AND lease_token = ?
    `),
    requestCancel: db.prepare(`
      UPDATE canvas_graph_runs
      SET status = 'cancel_requested', updated_at = ?
      WHERE run_id = ? AND status = 'running'
    `),
    transitionRunKeepLease: db.prepare(`
      UPDATE canvas_graph_runs
      SET status = ?, updated_at = ?
      WHERE run_id = ? AND status = ? AND COALESCE(lease_token, '') = ?
    `),
    transitionRunReleaseLease: db.prepare(`
      UPDATE canvas_graph_runs
      SET status = ?, lease_token = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE run_id = ? AND status = ? AND COALESCE(lease_token, '') = ?
    `),
    addRunSettledUnits: db.prepare(`
      UPDATE canvas_graph_runs
      SET settled_units = settled_units + ?, updated_at = ?
      WHERE run_id = ? AND status = 'running' AND COALESCE(lease_token, '') = ?
    `),
    transitionStep: db.prepare(`
      UPDATE canvas_graph_run_steps
      SET state = ?, charged_units = ?, output_url = ?, error = ?, updated_at = ?
      WHERE run_id = ? AND step_index = ? AND state = ?
    `),
    recoverableRuns: db.prepare(`
      SELECT run_id FROM canvas_graph_runs
      WHERE status IN ('running', 'cancel_requested', 'failed')
        AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
      ORDER BY updated_at, run_id
    `),
  };

  function getRun(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) throw new TypeError('runId is required');
    return rowToRun(statements.getRun.get(runId));
  }

  function createRun(input = {}) {
    const ownerEmail = cleanString(input.ownerEmail).toLowerCase();
    const docId = cleanString(input.docId);
    if (!ownerEmail || !docId) throw new TypeError('ownerEmail and docId are required');
    const plan = input.plan && typeof input.plan === 'object' ? input.plan : {};
    const layers = Array.isArray(plan.layers) && plan.layers.every(l => Array.isArray(l)) ? plan.layers : [];
    const order = Array.isArray(plan.order) ? plan.order.map(String) : [];
    if (!order.length) throw new TypeError('plan.order must be a non-empty node id list');
    const totalUnits = Number(input.totalUnits) || 0;
    if (!Number.isFinite(totalUnits) || totalUnits < 0) throw new TypeError('totalUnits must be a non-negative finite number');
    const steps = Array.isArray(input.steps)
      ? input.steps
      : order.map((nodeId, stepIndex) => ({ nodeId: String(nodeId), stepIndex, kind: plan.kinds?.[nodeId] || '' }));
    if (steps.length !== order.length) throw new TypeError('steps must align with plan.order');

    const runId = cleanString(randomUUID());
    if (!runId) throw new TypeError('randomUUID returned an invalid run id');
    const timestampMs = finiteNow(now);
    const leaseMs = Number.isSafeInteger(input.leaseMs) && input.leaseMs > 0 ? input.leaseMs : defaultLeaseMs;
    const leaseToken = cleanString(randomUUID());
    if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
    const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
    const timestamp = new Date(timestampMs).toISOString();

    const tx = db.transaction(() => {
      statements.insertRun.run(runId, ownerEmail, docId, JSON.stringify(plan), Math.round(totalUnits), leaseToken, leaseExpiresAt, timestamp, timestamp);
      for (const step of steps) {
        const stepIndex = Number(step.stepIndex);
        if (!Number.isSafeInteger(stepIndex) || stepIndex < 0) throw new TypeError('stepIndex must be a non-negative safe integer');
        statements.insertStep.run(runId, stepIndex, String(step.nodeId || order[stepIndex] || ''), cleanString(step.kind) || '', timestamp);
      }
    });
    tx.immediate();
    return getRun(runId);
  }

  /* 抢占/重抢 run 租约（镜像 jobStore.claimAsset）：终态不可抢；有活跃租约也抢不到。
     返回 { leaseToken, leaseExpiresAt, status } 或 null。 */
  function claimRun(runIdInput, { leaseMs = defaultLeaseMs } = {}) {
    const runId = cleanString(runIdInput);
    if (!runId) throw new TypeError('runId is required');
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('leaseMs must be a positive safe integer');
    const current = getRun(runId);
    if (!current) throw new Error('graph run not found');
    if (RUN_FINAL_STATES.has(current.status) && current.status !== 'failed') return null;
    const timestampMs = finiteNow(now);
    const leaseToken = cleanString(randomUUID());
    if (!leaseToken) throw new TypeError('randomUUID returned an invalid lease token');
    const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
    const changed = statements.claimRun.run(
      leaseToken,
      leaseExpiresAt,
      new Date(timestampMs).toISOString(),
      runId,
      new Date(timestampMs).toISOString(),
    ).changes;
    if (changed !== 1) return null; // 另一个 worker 先抢到了
    return { leaseToken, leaseExpiresAt, status: current.status };
  }

  function renewLease(runIdInput, leaseTokenInput, { leaseMs = defaultLeaseMs } = {}) {
    const runId = cleanString(runIdInput);
    const leaseToken = cleanString(leaseTokenInput);
    if (!runId || !leaseToken) throw new Error('run lease token is required');
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0) throw new TypeError('leaseMs must be a positive safe integer');
    const timestampMs = finiteNow(now);
    const leaseExpiresAt = new Date(timestampMs + leaseMs).toISOString();
    const changed = statements.renewRunLease.run(
      leaseExpiresAt,
      new Date(timestampMs).toISOString(),
      runId,
      leaseToken,
      new Date(timestampMs).toISOString(),
    ).changes;
    if (changed !== 1) throw new Error('run lease is no longer owned by this worker');
    return getRun(runId);
  }

  function releaseLease(runIdInput, leaseTokenInput) {
    const runId = cleanString(runIdInput);
    const leaseToken = cleanString(leaseTokenInput);
    if (!runId || !leaseToken) throw new Error('run lease token is required');
    const changed = statements.releaseRunLease.run(
      new Date(finiteNow(now)).toISOString(),
      runId,
      leaseToken,
    ).changes;
    if (changed !== 1) throw new Error('run lease is no longer owned by this worker');
    return getRun(runId);
  }

  /* 用户请求取消：running -> cancel_requested（持有租约的 worker 步间落成 cancelled）。
     幂等：已 cancel_requested / 终态时原样返回当前 status。 */
  function requestCancel(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) throw new TypeError('runId is required');
    const current = getRun(runId);
    if (!current) throw new Error('graph run not found');
    if (RUN_FINAL_STATES.has(current.status)) return current.status;
    if (current.status === 'running') {
      const changed = statements.requestCancel.run(new Date(finiteNow(now)).toISOString(), runId).changes;
      if (changed !== 1) throw new Error('run state changed during cancel request');
    }
    return getRun(runId).status;
  }

  /* run 状态 CAS（镜像 jobStore.transitionAsset）：from + 期望租约双重门；
     releaseLease=true 时同时清租约（落终态用）。 */
  function transitionRun(runIdInput, { from, to, leaseToken, releaseLease = false } = {}) {
    const runId = cleanString(runIdInput);
    const fromStatus = cleanString(from);
    const toStatus = cleanString(to);
    if (!runId || !RUN_STATES.includes(fromStatus) || !RUN_STATES.includes(toStatus)) {
      throw new TypeError('runId and valid from/to states are required');
    }
    if (!RUN_TRANSITIONS[fromStatus]?.has(toStatus)) {
      throw new Error(`invalid run transition ${fromStatus} -> ${toStatus}`);
    }
    const expectedLease = cleanString(leaseToken);
    const statement = releaseLease ? statements.transitionRunReleaseLease : statements.transitionRunKeepLease;
    const changed = statement.run(
      toStatus,
      new Date(finiteNow(now)).toISOString(),
      runId,
      fromStatus,
      expectedLease,
    ).changes;
    if (changed !== 1) throw new Error('run state or lease changed during transition');
    return getRun(runId);
  }

  function getStep(runIdInput, stepIndexInput) {
    const runId = cleanString(runIdInput);
    if (!runId || !Number.isSafeInteger(stepIndexInput)) throw new TypeError('runId and stepIndex are required');
    return rowToStep(statements.getStep.get(runId, stepIndexInput));
  }

  function listSteps(runIdInput) {
    const runId = cleanString(runIdInput);
    if (!runId) throw new TypeError('runId is required');
    return statements.listSteps.all(runId).map(rowToStep);
  }

  function validateStep(runId, stepIndex, from, to) {
    if (!STEP_STATES.includes(from)) throw new TypeError(`unknown step state: ${from}`);
    if (!STEP_STATES.includes(to)) throw new TypeError(`unknown step state: ${to}`);
    if (!STEP_TRANSITIONS[from]?.has(to)) throw new Error(`invalid step transition ${from} -> ${to}`);
  }

  function transitionStep(runId, stepIndex, { from, to, chargedUnits = 0, outputUrl = '', error = '' }) {
    validateStep(runId, stepIndex, from, to);
    const charged = Number.isFinite(Number(chargedUnits)) ? Math.max(0, Number(chargedUnits)) : 0;
    const changed = statements.transitionStep.run(
      to,
      charged,
      cleanString(outputUrl),
      cleanString(error),
      new Date(finiteNow(now)).toISOString(),
      runId,
      stepIndex,
      from,
    ).changes;
    if (changed !== 1) throw new Error('step state changed during transition');
    return getStep(runId, stepIndex);
  }

  /* 结算双表 CAS（不变式 ① 的核心）：
     1) step running/queued -> completed（charged_units 落库）
     2) run settled_units += charged，且必须仍由 <leaseToken> 租约持有、状态仍 running。
     两条都 changed===1 才算数；任何一条 CAS 失败（租约丢失/被抢/状态漂移）整事务回滚并抛错。 */
  const settleStepTx = db.transaction((runId, stepIndex, leaseToken, chargedUnits, outputUrl) => {
    const from = statements.getStep.get(runId, stepIndex)?.state;
    if (from !== 'running' && from !== 'queued') {
      throw new Error(`step is not settleable from state: ${from || 'missing'}`);
    }
    const charged = Math.max(0, Number(chargedUnits) || 0);
    const stepChanged = statements.transitionStep.run(
      'completed',
      charged,
      cleanString(outputUrl),
      '',
      new Date(finiteNow(now)).toISOString(),
      runId,
      stepIndex,
      from,
    ).changes;
    if (stepChanged !== 1) throw new Error('step state changed during settle');
    const runChanged = statements.addRunSettledUnits.run(
      Math.round(charged),
      new Date(finiteNow(now)).toISOString(),
      runId,
      cleanString(leaseToken),
    ).changes;
    if (runChanged !== 1) throw new Error('run lease lost during settle');
  });

  function settleStep(runIdInput, stepIndexInput, { leaseToken, chargedUnits, outputUrl }) {
    const runId = cleanString(runIdInput);
    if (!runId || !Number.isSafeInteger(stepIndexInput)) throw new TypeError('runId and stepIndex are required');
    if (!cleanString(leaseToken)) throw new Error('run lease token is required to settle');
    settleStepTx.immediate(runId, stepIndexInput, cleanString(leaseToken), Number(chargedUnits) || 0, cleanString(outputUrl));
    return getStep(runId, stepIndexInput);
  }

  /* 恢复扫描（镜像 jobStore.recoverInterrupted）：租约已失效/无主的非终态 run。 */
  function recoverInterrupted() {
    const timestampMs = finiteNow(now);
    return statements.recoverableRuns.all(new Date(timestampMs).toISOString())
      .map(row => getRun(row.run_id))
      .filter(Boolean);
  }

  return {
    RUN_STATES,
    STEP_STATES,
    createRun,
    getRun,
    claimRun,
    renewLease,
    releaseLease,
    requestCancel,
    transitionRun,
    getStep,
    listSteps,
    transitionStep,
    settleStep,
    recoverInterrupted,
  };
}
