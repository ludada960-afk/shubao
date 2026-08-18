import crypto from 'node:crypto';

const OPERATIONS = new Set([
  'recheck',
  'replay_projection',
  'confirm_not_submitted',
  'retry_confirmed_not_submitted',
  'quarantine',
]);

function clean(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function integer(value, fallback, min = 1, max = 200) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function localTimestampMs(value) {
  const text = clean(value, 40);
  if (!text) return 0;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(normalized) ? normalized : `${normalized}+08:00`) || 0;
}

function serializeJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    status: row.status,
    billingState: row.billing_state,
    deliveryState: row.delivery_state,
    projectProjectionState: row.project_projection_state,
    projectionState: row.projection_state,
    providerRoute: row.provider_route,
    productId: row.product_id,
    failureClass: row.failure_class,
    error: row.error,
    updatedAt: row.updated_at,
  };
}

function operationError(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}

export function createVideoReconciliation({
  db,
  now = Date.now,
  leaseMs = 60_000,
  reconcile = async () => ({}),
  cleanupUploads = async () => ({}),
  actions = {},
  readAttempts = true,
  readOutbox = true,
  readNewState = true,
} = {}) {
  if (!db?.prepare) throw new TypeError('video reconciliation requires a database');
  if (typeof reconcile !== 'function' || typeof cleanupUploads !== 'function') {
    throw new TypeError('video reconciliation callbacks must be functions');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_reconciliation_leases (
      lease_name TEXT PRIMARY KEY,
      owner TEXT NOT NULL DEFAULT '',
      lease_until_ms INTEGER NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_run_ms INTEGER NOT NULL DEFAULT 0,
      last_summary_json TEXT NOT NULL DEFAULT '{}',
      last_error TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS video_admin_operations (
      idempotency_key TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      result_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);
  const tableExists = name => Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(name));
  const columnsFor = name => tableExists(name)
    ? new Set(db.prepare(`PRAGMA table_info(${name})`).all().map(column => column.name))
    : new Set();
  const jobColumns = columnsFor('video_jobs');
  const fullJobSchema = ['billing_state', 'delivery_state', 'project_projection_state', 'projection_state']
    .every(column => jobColumns.has(column));
  const selectJob = tableExists('video_jobs') ? db.prepare('SELECT * FROM video_jobs WHERE id = ?') : null;

  function metrics() {
    const empty = {
      generatedAt: new Date(Number(now())).toISOString(),
      backlog: {
        queued: 0, submitting: 0, processing: 0, reviewPending: 0, reconciliationPending: 0,
        deliveryPending: 0, settlementPending: 0, releasePending: 0, projectionPending: 0,
        completed: 0, failed: 0,
      },
      ageBuckets: { under5m: 0, from5To15m: 0, from15To30m: 0, over30m: 0 },
      segments: [],
      attention: [],
      uploads: {},
      outbox: {},
      lease: null,
    };
    if (!selectJob || !fullJobSchema || !readNewState) return empty;
    const rows = db.prepare('SELECT * FROM video_jobs ORDER BY updated_at, rowid').all();
    const countStatus = status => rows.filter(row => row.status === status).length;
    const backlog = {
      queued: countStatus('queued'),
      submitting: countStatus('submitting'),
      processing: countStatus('processing'),
      reviewPending: countStatus('needs_review'),
      reconciliationPending: countStatus('reconciling'),
      deliveryPending: rows.filter(row => !['none', 'verified'].includes(row.delivery_state)).length,
      settlementPending: rows.filter(row => row.billing_state === 'settlement_pending').length,
      releasePending: rows.filter(row => row.billing_state === 'release_pending').length,
      projectionPending: rows.filter(row => row.delivery_state === 'verified' && row.billing_state === 'settled'
        && (row.project_projection_state !== 'projected' || row.projection_state !== 'projected')).length,
      completed: countStatus('completed'),
      failed: rows.filter(row => ['failed', 'cancelled'].includes(row.status)).length,
    };
    const currentMs = Number(now());
    const ageBuckets = { under5m: 0, from5To15m: 0, from15To30m: 0, over30m: 0 };
    const operationalRows = rows.filter(row => ['queued', 'submitting', 'processing', 'needs_review', 'reconciling'].includes(row.status)
      || ['settlement_pending', 'release_pending'].includes(row.billing_state)
      || (row.delivery_state === 'verified' && row.billing_state === 'settled'
        && (row.project_projection_state !== 'projected' || row.projection_state !== 'projected')));
    for (const row of operationalRows) {
      const age = Math.max(0, currentMs - localTimestampMs(row.created_at));
      if (age < 5 * 60_000) ageBuckets.under5m += 1;
      else if (age < 15 * 60_000) ageBuckets.from5To15m += 1;
      else if (age < 30 * 60_000) ageBuckets.from15To30m += 1;
      else ageBuckets.over30m += 1;
    }
    const segments = readAttempts && tableExists('video_job_attempts')
      ? db.prepare(`
        SELECT a.*, j.created_at AS job_created_at, j.provider_cost_cny,
          d.created_at AS delivery_created_at, d.verification_state
        FROM video_job_attempts a
        LEFT JOIN video_jobs j ON j.id = a.job_id
        LEFT JOIN video_deliveries d ON d.attempt_id = a.id
        ORDER BY a.created_at
      `).all().reduce((groups, row) => {
        const capability = parseJson(row.capability_json);
        const key = `${row.provider}\u0000${row.model}\u0000${capability.mode || capability.productId || 'unknown'}`;
        const group = groups.get(key) || {
          provider: row.provider || 'unknown', model: row.model || 'unknown',
          capability: capability.mode || capability.productId || 'unknown', attempts: 0, jobs: new Set(),
          delivered: 0, retries: 0, firstResult: [], delivery: [], providerCostCny: 0,
        };
        group.attempts += 1;
        group.jobs.add(row.job_id);
        if (Number(row.attempt_number) > 1) group.retries += 1;
        if (row.state === 'delivered' && row.verification_state === 'verified') {
          group.delivered += 1;
          const deliveredAt = localTimestampMs(row.delivery_created_at);
          group.firstResult.push(Math.max(0, deliveredAt - localTimestampMs(row.created_at)));
          group.delivery.push(Math.max(0, deliveredAt - localTimestampMs(row.job_created_at)));
          group.providerCostCny += Number(row.provider_cost_cny || 0);
        }
        groups.set(key, group);
        return groups;
      }, new Map()) : new Map();
    const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    const segmentRows = [...segments.values()].map(group => ({
      provider: group.provider,
      model: group.model,
      capability: group.capability,
      attempts: group.attempts,
      jobs: group.jobs.size,
      delivered: group.delivered,
      successRate: group.attempts ? Number((group.delivered / group.attempts).toFixed(4)) : 0,
      retryRate: group.attempts ? Number((group.retries / group.attempts).toFixed(4)) : 0,
      firstResultMs: average(group.firstResult),
      deliveryMs: average(group.delivery),
      providerCostCny: Number(group.providerCostCny.toFixed(4)),
    })).sort((left, right) => right.attempts - left.attempts || left.provider.localeCompare(right.provider));
    const attention = rows.flatMap(row => {
      let reason = '';
      if (row.status === 'needs_review') reason = row.failure_class === 'submission_unknown' ? 'submission_review' : 'manual_review';
      else if (row.billing_state === 'release_pending') reason = 'release_pending';
      else if (row.billing_state === 'settlement_pending') reason = 'settlement_pending';
      else if (row.status === 'reconciling') reason = 'projection_pending';
      else if (['queued', 'submitting', 'processing'].includes(row.status)
        && currentMs - localTimestampMs(row.updated_at) >= 15 * 60_000) reason = 'stale_active';
      return reason ? [{ ...serializeJob(row), reason, ageMs: Math.max(0, currentMs - localTimestampMs(row.updated_at)) }] : [];
    }).slice(0, 100);
    const groupedStates = table => tableExists(table)
      ? Object.fromEntries(db.prepare(`SELECT status AS state, COUNT(*) AS count FROM ${table} GROUP BY status`).all().map(row => [row.state, row.count]))
      : {};
    const outbox = readOutbox && tableExists('video_outbox')
      ? Object.fromEntries(db.prepare('SELECT state, COUNT(*) AS count FROM video_outbox GROUP BY state').all().map(row => [row.state, row.count]))
      : {};
    return {
      generatedAt: empty.generatedAt,
      backlog,
      ageBuckets,
      segments: segmentRows,
      attention,
      uploads: groupedStates('video_upload_sessions'),
      outbox,
      lease: db.prepare("SELECT * FROM video_reconciliation_leases WHERE lease_name = 'video-operations'").get() || null,
    };
  }

  function acquireLease(owner, force) {
    const current = Number(now());
    return db.transaction(() => {
      const row = db.prepare("SELECT * FROM video_reconciliation_leases WHERE lease_name = 'video-operations'").get();
      if (row && !force && (row.lease_until_ms > current || row.next_run_ms > current)) return null;
      db.prepare(`INSERT INTO video_reconciliation_leases (
        lease_name, owner, lease_until_ms, attempt_count, next_run_ms, updated_at
      ) VALUES ('video-operations', ?, ?, 0, 0, datetime('now', 'localtime'))
      ON CONFLICT(lease_name) DO UPDATE SET owner = excluded.owner,
        lease_until_ms = excluded.lease_until_ms, updated_at = excluded.updated_at`)
        .run(owner, current + leaseMs);
      return true;
    })();
  }

  async function run(input = {}) {
    const limit = integer(input.limit, 50);
    const owner = `reconcile-${process.pid}-${crypto.randomUUID()}`;
    if (!acquireLease(owner, input.force === true)) return { skipped: 'lease_held' };
    const startedAt = Number(now());
    try {
      const reconciliation = await reconcile({ limit, force: input.force === true });
      const uploads = await cleanupUploads({ limit });
      const result = { startedAt, finishedAt: Number(now()), limit, reconciliation, uploads };
      db.prepare(`UPDATE video_reconciliation_leases SET owner = '', lease_until_ms = 0,
        attempt_count = 0, next_run_ms = 0, last_summary_json = ?, last_error = '',
        updated_at = datetime('now', 'localtime') WHERE lease_name = 'video-operations' AND owner = ?`)
        .run(JSON.stringify(result), owner);
      return result;
    } catch (error) {
      const row = db.prepare("SELECT attempt_count FROM video_reconciliation_leases WHERE lease_name = 'video-operations'").get();
      const attempts = Number(row?.attempt_count || 0) + 1;
      const delay = Math.min(5 * 60_000, 5_000 * (2 ** Math.min(6, attempts - 1)));
      db.prepare(`UPDATE video_reconciliation_leases SET owner = '', lease_until_ms = 0,
        attempt_count = ?, next_run_ms = ?, last_error = ?, updated_at = datetime('now', 'localtime')
        WHERE lease_name = 'video-operations' AND owner = ?`)
        .run(attempts, Number(now()) + delay, clean(error?.message), owner);
      throw error;
    }
  }

  async function operate(jobId, input = {}) {
    const id = clean(jobId, 140);
    const action = clean(input.action, 80);
    const reason = clean(input.reason, 500);
    const idempotencyKey = clean(input.idempotencyKey, 200);
    if (!OPERATIONS.has(action)) throw operationError('VIDEO_OPERATION_INVALID', '不支持该视频运维操作', 400);
    if (!reason) throw operationError('VIDEO_OPERATION_REASON_REQUIRED', '必须填写操作原因', 400);
    if (!idempotencyKey) throw operationError('VIDEO_OPERATION_IDEMPOTENCY_REQUIRED', '缺少防重复操作标识', 400);
    const replay = db.prepare('SELECT result_json FROM video_admin_operations WHERE idempotency_key = ?').get(idempotencyKey);
    if (replay) return { ...parseJson(replay.result_json), replay: true };
    const beforeRow = selectJob?.get(id);
    if (!beforeRow) throw operationError('VIDEO_JOB_NOT_FOUND', '视频任务不存在', 404);
    const handler = actions[action === 'replay_projection' ? 'replayProjection'
      : action === 'confirm_not_submitted' ? 'confirmNotSubmitted'
        : action === 'retry_confirmed_not_submitted' ? 'retryConfirmedNotSubmitted'
          : action];
    if (typeof handler !== 'function') throw operationError('VIDEO_OPERATION_UNAVAILABLE', '该运维操作尚未接入', 503);
    await handler(id, { ...input, reason });
    const result = { action, before: serializeJob(beforeRow), after: serializeJob(selectJob.get(id)) };
    db.prepare(`INSERT INTO video_admin_operations (
      idempotency_key, job_id, action, reason, result_json
    ) VALUES (?, ?, ?, ?, ?)`)
      .run(idempotencyKey, id, action, reason, JSON.stringify(result));
    return result;
  }

  return { metrics, run, operate };
}
