import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

import { createVideoReconciliation } from '../server/videoReconciliation.mjs';

function harness() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE video_jobs (
      id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, status TEXT NOT NULL,
      billing_state TEXT NOT NULL, delivery_state TEXT NOT NULL,
      project_projection_state TEXT NOT NULL, projection_state TEXT NOT NULL,
      provider_route TEXT NOT NULL, product_id TEXT NOT NULL,
      provider_cost_cny REAL NOT NULL DEFAULT 0, failure_class TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '', review_deadline_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE video_job_attempts (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL, attempt_number INTEGER NOT NULL,
      provider TEXT NOT NULL, model TEXT NOT NULL, capability_json TEXT NOT NULL,
      state TEXT NOT NULL, error_class TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE video_deliveries (
      id TEXT PRIMARY KEY, job_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
      verification_state TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE video_outbox (
      id TEXT PRIMARY KEY, aggregate_id TEXT NOT NULL, event_type TEXT NOT NULL,
      state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_ms INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
    );
    CREATE TABLE video_upload_sessions (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const jobs = db.prepare(`INSERT INTO video_jobs (
    id, owner_email, status, billing_state, delivery_state,
    project_projection_state, projection_state, provider_route, product_id,
    provider_cost_cny, failure_class, error, review_deadline_ms, created_at, updated_at
  ) VALUES (?, 'user@example.com', ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`);
  jobs.run('queued-old', 'queued', 'held', 'none', 'pending', 'none', 'route-a', 'model-a', 0, '', 0,
    '2026-08-15 08:00:00', '2026-08-15 08:00:00');
  jobs.run('review', 'needs_review', 'held', 'none', 'pending', 'none', 'route-a', 'model-a', 0, 'submission_unknown', 1,
    '2026-08-15 08:10:00', '2026-08-15 08:11:00');
  jobs.run('settlement', 'reconciling', 'settlement_pending', 'verified', 'pending', 'pending', 'route-b', 'model-b', 4.2, '', 0,
    '2026-08-15 08:20:00', '2026-08-15 08:21:00');
  jobs.run('complete', 'completed', 'settled', 'verified', 'projected', 'projected', 'route-a', 'model-a', 3.4, '', 0,
    '2026-08-15 08:30:00', '2026-08-15 08:40:00');
  jobs.run('projection', 'reconciling', 'settled', 'verified', 'pending', 'pending', 'route-a', 'model-a', 1.2, '', 0,
    '2026-08-15 08:45:00', '2026-08-15 08:50:00');
  db.prepare(`INSERT INTO video_job_attempts VALUES
    (?, ?, ?, ?, ?, ?, ?, '', ?, ?)`)
    .run('attempt-1', 'complete', 1, 'provider-a', 'video-v1', '{"mode":"reference"}', 'delivered', '2026-08-15 08:31:00', '2026-08-15 08:39:00');
  db.prepare('INSERT INTO video_deliveries VALUES (?, ?, ?, ?, ?)')
    .run('delivery-1', 'complete', 'attempt-1', 'verified', '2026-08-15 08:39:00');
  return { db };
}

test('video operations metrics expose backlog, age, and provider-model delivery quality', t => {
  const { db } = harness();
  t.after(() => db.close());
  const service = createVideoReconciliation({ db, now: () => Date.parse('2026-08-15T09:00:00+08:00') });

  const result = service.metrics();
  assert.equal(result.backlog.queued, 1);
  assert.equal(result.backlog.reviewPending, 1);
  assert.equal(result.backlog.settlementPending, 1);
  assert.equal(result.backlog.projectionPending, 1);
  assert.equal(result.ageBuckets.from15To30m, 1);
  assert.equal(result.ageBuckets.over30m, 3);
  assert.equal(result.segments[0].provider, 'provider-a');
  assert.equal(result.segments[0].model, 'video-v1');
  assert.equal(result.segments[0].successRate, 1);
  assert.equal(result.segments[0].firstResultMs, 8 * 60 * 1000);
  assert.equal(result.segments[0].deliveryMs, 9 * 60 * 1000);
  assert.equal(result.segments[0].providerCostCny, 3.4);
  assert.ok(result.attention.some(item => item.id === 'review' && item.reason === 'submission_review'));
  assert.ok(result.attention.some(item => item.id === 'projection' && item.reason === 'projection_pending'));
});

test('bounded reconciliation uses a lease and does not run the same recovery twice concurrently', async t => {
  const { db } = harness();
  t.after(() => db.close());
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const service = createVideoReconciliation({
    db,
    now: () => Date.parse('2026-08-15T09:00:00+08:00'),
    reconcile: async ({ limit }) => { calls += 1; assert.equal(limit, 2); await gate; return { checked: 2 }; },
    cleanupUploads: async ({ limit }) => ({ cleaned: limit }),
  });

  const first = service.run({ limit: 2 });
  const second = await service.run({ limit: 2 });
  assert.equal(second.skipped, 'lease_held');
  release();
  const completed = await first;
  assert.equal(calls, 1);
  assert.equal(completed.reconciliation.checked, 2);
  assert.equal(completed.uploads.cleaned, 2);
});

test('video operations are explicit, idempotent, and return before/after state', async t => {
  const { db } = harness();
  t.after(() => db.close());
  const calls = [];
  const service = createVideoReconciliation({
    db,
    actions: {
      quarantine(jobId, input) {
        calls.push([jobId, input.reason]);
        db.prepare("UPDATE video_jobs SET status = 'needs_review', failure_class = 'manual_quarantine' WHERE id = ?").run(jobId);
      },
    },
  });

  const changed = await service.operate('queued-old', {
    action: 'quarantine', reason: '上游响应无法确认', idempotencyKey: 'quarantine-1',
  });
  const replay = await service.operate('queued-old', {
    action: 'quarantine', reason: '上游响应无法确认', idempotencyKey: 'quarantine-1',
  });
  assert.equal(changed.before.status, 'queued');
  assert.equal(changed.after.failureClass, 'manual_quarantine');
  assert.equal(replay.replay, true);
  assert.equal(calls.length, 1);
  await assert.rejects(() => service.operate('queued-old', {
    action: 'delete', reason: 'not allowed', idempotencyKey: 'delete-1',
  }), error => error.code === 'VIDEO_OPERATION_INVALID');
});
