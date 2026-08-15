import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createVideoGeneration } from '../server/videoGeneration.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';

const COOLDOWN_MS = 15 * 60 * 1000;

function providerRegistry() {
  return {
    get(productId) {
      if (productId !== 'seedance_standard') return null;
      return {
        enabled: true,
        productId,
        routeId: 'sd5-seedance-2.0',
        submit: async () => ({ id: 'test-task', progress: 0 }),
        get: async () => ({ status: 'processing', progress: 1 }),
        download: async () => { throw new Error('download is not used by this test'); },
      };
    },
    publicProducts: () => publicVideoProducts(),
  };
}

function createService({ db, assetRoot, now, quoteVerify = () => ({}), walletService, registry, maxConcurrent = 0 } = {}) {
  return createVideoGeneration({
    db,
    assetRoot,
    providerRegistry: registry || providerRegistry(),
    walletService: walletService || {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => ({ status: 'settled' }),
      releaseItem: () => ({ status: 'released' }),
    },
    quoteService: { verify: quoteVerify },
    upsertWork() {},
    now,
    maxConcurrent,
  });
}

function insertTerminalRow(db, { id, status, failureClass = '' }) {
  db.prepare(`INSERT INTO video_jobs (
    id, owner_email, idempotency_key, status, mode, sku, prompt, negative_prompt,
    duration, aspect_ratio, resolution, generate_audio, seed, refs_json, provider_task_id,
    progress, hold_id, result_asset_id, result_url, error, product_id, provider_route,
    catalog_version, provider_cost_cny, failure_class, quote_id
  ) VALUES (?, 'history@example.com', ?, ?, 'script', 'video_seedance_standard_short',
    'history', '', 5, '16:9', '720p', 0, 0, '{}', ?, 100, '', '', '', '',
    'seedance_standard', 'sd5-seedance-2.0', 'video-products-test', 4.355, ?, '')`)
    .run(id, `key-${id}`, status, `provider-task-${id}`, failureClass);
}

test('migrates legacy video jobs and preserves a stable historical snapshot', t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-migration-'));
  t.after(() => {
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  db.exec(`
    CREATE TABLE video_jobs (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      sku TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative_prompt TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL,
      aspect_ratio TEXT NOT NULL,
      resolution TEXT NOT NULL,
      generate_audio INTEGER NOT NULL DEFAULT 1,
      seed INTEGER NOT NULL DEFAULT 0,
      refs_json TEXT NOT NULL DEFAULT '{}',
      provider_task_id TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL DEFAULT 0,
      hold_id TEXT NOT NULL DEFAULT '',
      result_asset_id TEXT NOT NULL DEFAULT '',
      result_url TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(owner_email, idempotency_key)
    );
  `);

  const service = createService({ db, assetRoot, now: () => 1_000_000 });
  t.after(() => service.close());
  const columns = new Set(db.prepare('PRAGMA table_info(video_jobs)').all().map(column => column.name));
  for (const column of ['product_id', 'provider_route', 'catalog_version', 'provider_cost_cny', 'failure_class', 'quote_id', 'billing_state', 'delivery_state', 'projection_state', 'project_projection_state', 'project_id', 'source_version_id', 'result_version_id', 'reconciliation_error', 'release_attempts', 'review_deadline_ms', 'review_attempts', 'current_attempt_id']) {
    assert.equal(columns.has(column), true, column);
  }

  db.prepare(`INSERT INTO video_jobs (
    id, owner_email, idempotency_key, status, mode, sku, prompt, duration,
    aspect_ratio, resolution, provider_task_id
  ) VALUES (?, ?, ?, 'completed', 'script', ?, ?, 5, '16:9', '720p', ?)`)
    .run('legacy-job', 'owner@example.com', 'legacy-key', 'video_generation', 'legacy prompt', 'legacy-provider-task');

  const historical = service.getJob('owner@example.com', 'legacy-job');
  assert.equal(historical.productId, 'seedance_standard');
  assert.equal(historical.providerRoute, 'sd5-seedance-2.0');
  assert.equal(historical.catalogVersion, 'legacy-seedance-v1');
  assert.equal(historical.providerCostCny, 4.355);
  assert.equal(historical.failureClass, '');
  assert.equal(historical.billingState, 'settled');
});

test('a failed half-open admission does not reserve the circuit probe', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-circuit-'));
  let clock = 1_000_000;
  let quoteCalls = 0;
  t.after(() => {
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });
  const service = createService({
    db,
    assetRoot,
    now: () => clock,
    quoteVerify: ({ quoteId, expectedQuote }) => {
      quoteCalls += 1;
      if (quoteCalls === 1) {
        const error = new Error('quote expired');
        error.code = 'BILLING_QUOTE_EXPIRED';
        throw error;
      }
      return { quoteId, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' };
    },
  });
  t.after(() => service.close());
  insertTerminalRow(db, { id: 'success-1', status: 'completed' });
  insertTerminalRow(db, { id: 'success-2', status: 'completed' });
  insertTerminalRow(db, { id: 'failure-1', status: 'failed', failureClass: 'provider' });
  insertTerminalRow(db, { id: 'failure-2', status: 'failed', failureClass: 'provider' });
  insertTerminalRow(db, { id: 'failure-3', status: 'failed', failureClass: 'provider' });

  assert.equal(service.capabilities().products.some(product => product.id === 'seedance_standard'), false);
  clock += COOLDOWN_MS + 1;

  const input = {
    productId: 'seedance_standard',
    mode: 'script',
    prompt: '半开探针测试',
    duration: 5,
    aspectRatio: '16:9',
    resolution: '720p',
  };
  await assert.rejects(
    service.createJob({
      ownerEmail: 'owner@example.com',
      idempotencyKey: 'probe-invalid-quote',
      billingQuoteId: 'expired-quote',
      publicBaseUrl: 'https://example.com',
      input,
    }),
    error => error?.code === 'BILLING_QUOTE_EXPIRED',
  );

  const accepted = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'probe-valid-quote',
    billingQuoteId: 'valid-quote',
    publicBaseUrl: 'https://example.com',
    input,
  });
  assert.equal(accepted.replay, false);
});

test('a failed credit release remains truthful and is recoverable', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-billing-reconcile-'));
  let releaseShouldFail = true;
  let releaseCalls = 0;
  const walletService = {
    createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
    getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
    settleItem: () => ({ status: 'settled' }),
    releaseItem: () => {
      releaseCalls += 1;
      if (releaseShouldFail) throw new Error('wallet temporarily unavailable');
      return { status: 'released' };
    },
  };
  const failingRegistry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'provider-failed-task', progress: 0 }),
      get: async () => ({ status: 'failed', progress: 0 }),
      download: async () => { throw new Error('download must not run'); },
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    walletService,
    registry: failingRegistry,
    maxConcurrent: 1,
    quoteVerify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'release-reconciliation',
    billingQuoteId: 'release-reconciliation-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '账务补偿测试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.getJob('owner@example.com', created.job.id)?.status === 'reconciling'
      ? resolve()
      : setTimeout(check, 2);
    check();
  });

  const pending = service.getJob('owner@example.com', created.job.id);
  assert.equal(pending.billingState, 'release_pending');
  assert.match(pending.error, /退回处理中/);
  assert.doesNotMatch(pending.error, /已退回/);

  releaseShouldFail = false;
  const summary = service.reconcileBilling();
  const reconciled = service.getJob('owner@example.com', created.job.id);
  assert.equal(summary.released, 1);
  assert.equal(reconciled.status, 'failed');
  assert.equal(reconciled.billingState, 'released');
  assert.match(reconciled.error, /已退回/);
  assert.equal(releaseCalls, 2);
});

test('a delivered video is preserved while settlement is reconciled without refunding', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-settlement-reconcile-'));
  let settlementShouldFail = true;
  let settlementCalls = 0;
  let releaseCalls = 0;
  const savedWorks = [];
  const walletService = {
    createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
    getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
    settleItem: () => {
      settlementCalls += 1;
      if (settlementShouldFail) throw new Error('settlement temporarily unavailable');
      return { status: 'settled' };
    },
    releaseItem: () => { releaseCalls += 1; return { status: 'released' }; },
  };
  const completedRegistry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'provider-completed-task', progress: 0 }),
      get: async () => ({ status: 'completed', progress: 100 }),
      download: async () => new Response(Buffer.from('video-output'), {
        headers: { 'content-type': 'video/mp4', 'content-length': '12' },
      }),
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createVideoGeneration({
    db,
    assetRoot,
    providerRegistry: completedRegistry,
    walletService,
    quoteService: { verify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }) },
    upsertWork: work => savedWorks.push(work),
    pollIntervalMs: 1,
    maxConcurrent: 1,
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'settlement-reconciliation',
    billingQuoteId: 'settlement-reconciliation-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '结算补偿测试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.getJob('owner@example.com', created.job.id)?.billingState === 'settlement_pending'
      ? resolve()
      : setTimeout(check, 2);
    check();
  });

  const pending = service.getJob('owner@example.com', created.job.id);
  assert.equal(pending.status, 'reconciling');
  assert.match(pending.error, /结算确认中/);
  assert.match(pending.resultUrl, /^\/api\/video\/media\//);
  assert.equal(releaseCalls, 0);
  assert.equal(savedWorks.length, 0);
  const pendingOutbox = db.prepare("SELECT * FROM video_outbox WHERE aggregate_id = ? AND event_type = 'video.billing.settle.requested'").get(created.job.id);
  assert.equal(pendingOutbox.state, 'pending');

  settlementShouldFail = false;
  const summary = service.reconcileBilling();
  const completed = service.getJob('owner@example.com', created.job.id);
  assert.equal(summary.settled, 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.billingState, 'settled');
  assert.equal(releaseCalls, 0);
  assert.equal(settlementCalls, 2);
  assert.equal(savedWorks.length, 1);
  const outbox = db.prepare('SELECT event_type, state FROM video_outbox WHERE aggregate_id = ? ORDER BY created_at, event_type').all(created.job.id);
  assert.deepEqual(outbox.map(event => [event.event_type, event.state]), [
    ['video.billing.settle.requested', 'done'],
    ['video.job.finalize.requested', 'done'],
    ['video.works.project.requested', 'done'],
  ]);
});

test('a settled delivery retries only the failed works projection', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-projection-reconcile-'));
  let projectionShouldFail = true;
  let settlementCalls = 0;
  let projectionCalls = 0;
  let releaseCalls = 0;
  const registry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'provider-projection-task', progress: 0 }),
      get: async () => ({ status: 'completed', progress: 100 }),
      download: async () => new Response(Buffer.from('video-output'), {
        headers: { 'content-type': 'video/mp4', 'content-length': '12' },
      }),
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createVideoGeneration({
    db,
    assetRoot,
    providerRegistry: registry,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => { settlementCalls += 1; return { status: 'settled' }; },
      releaseItem: () => { releaseCalls += 1; return { status: 'released' }; },
    },
    quoteService: { verify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }) },
    upsertWork: () => {
      projectionCalls += 1;
      if (projectionShouldFail) throw new Error('works store temporarily unavailable');
    },
    pollIntervalMs: 1,
    maxConcurrent: 1,
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'projection-reconciliation',
    billingQuoteId: 'projection-reconciliation-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '作品投影补偿测试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.getJob('owner@example.com', created.job.id)?.projectionState === 'pending'
      ? resolve()
      : setTimeout(check, 2);
    check();
  });

  const pending = service.getJob('owner@example.com', created.job.id);
  assert.equal(pending.status, 'reconciling');
  assert.equal(pending.billingState, 'settled');
  assert.equal(pending.deliveryState, 'verified');
  assert.equal(pending.projectionState, 'pending');
  assert.match(pending.error, /作品库同步中/);
  assert.equal(settlementCalls, 1);
  assert.equal(projectionCalls, 1);
  assert.equal(releaseCalls, 0);

  projectionShouldFail = false;
  service.reconcileBilling();
  const completed = service.getJob('owner@example.com', created.job.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.projectionState, 'projected');
  assert.equal(settlementCalls, 1);
  assert.equal(projectionCalls, 2);
  assert.equal(releaseCalls, 0);
});

test('an unknown provider submission expires to an automatic credit release', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-submission-review-'));
  let clock = 1_000_000;
  let releaseCalls = 0;
  const unknownSubmissionRegistry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => {
        const error = new Error('submission response was lost');
        error.code = 'VIDEO_PROVIDER_UNREACHABLE';
        error.retryable = true;
        throw error;
      },
      get: async () => { throw new Error('poll must not run without a provider task id'); },
      download: async () => { throw new Error('download must not run'); },
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    now: () => clock,
    registry: unknownSubmissionRegistry,
    maxConcurrent: 1,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => ({ status: 'settled' }),
      releaseItem: () => { releaseCalls += 1; return { status: 'released' }; },
    },
    quoteVerify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'unknown-submission-review',
    billingQuoteId: 'unknown-submission-review-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '未知受理补偿测试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.getJob('owner@example.com', created.job.id)?.status === 'needs_review'
      ? resolve()
      : setTimeout(check, 2);
    check();
  });

  const reviewing = service.getJob('owner@example.com', created.job.id);
  assert.equal(reviewing.billingState, 'held');
  assert.ok(reviewing.reviewDeadlineAt > clock);
  assert.match(reviewing.error, /自动核对/);
  assert.equal(releaseCalls, 0);
  const uncertainAttempt = db.prepare('SELECT * FROM video_job_attempts WHERE job_id = ?').get(created.job.id);
  assert.equal(uncertainAttempt.state, 'uncertain');
  assert.equal(uncertainAttempt.submission_key, created.job.id);

  clock = reviewing.reviewDeadlineAt + 1;
  const summary = service.reconcileBilling();
  const expired = service.getJob('owner@example.com', created.job.id);
  assert.equal(summary.expiredReviews, 1);
  assert.equal(expired.status, 'failed');
  assert.equal(expired.billingState, 'released');
  assert.equal(releaseCalls, 1);
});

test('an operator can attach the recovered provider task without resubmitting', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-review-resolve-'));
  let submitCalls = 0;
  let settleCalls = 0;
  const registry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => {
        submitCalls += 1;
        const error = new Error('submission response was lost');
        error.code = 'VIDEO_PROVIDER_UNREACHABLE';
        error.retryable = true;
        throw error;
      },
      get: async taskId => {
        assert.equal(taskId, 'recovered-provider-task');
        return { status: 'completed', progress: 100 };
      },
      download: async taskId => {
        assert.equal(taskId, 'recovered-provider-task');
        return new Response(Buffer.from('recovered-video'), {
          headers: { 'content-type': 'video/mp4', 'content-length': '15' },
        });
      },
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    registry,
    maxConcurrent: 1,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => { settleCalls += 1; return { status: 'settled' }; },
      releaseItem: () => { throw new Error('resolved review must not release credits'); },
    },
    quoteVerify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'operator-review-resolve',
    billingQuoteId: 'operator-review-resolve-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '运营核对恢复测试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.listSubmissionReviews().length === 1 ? resolve() : setTimeout(check, 2);
    check();
  });

  const resolved = service.resolveSubmissionReview(created.job.id, 'recovered-provider-task');
  assert.equal(resolved.status, 'processing');
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 2_000;
    const check = () => {
      const job = service.getJob('owner@example.com', created.job.id);
      if (job?.status === 'completed') return resolve();
      if (job?.status === 'failed') return reject(new Error(`delivery failed: ${job.error}`));
      if (Date.now() >= deadline) return reject(new Error(`delivery timed out in state ${job?.status}`));
      return setTimeout(check, 2);
    };
    check();
  });
  assert.equal(submitCalls, 1);
  assert.equal(settleCalls, 1);
  assert.equal(service.listSubmissionReviews().length, 0);
});

test('provider attempts are durable before submission and retain the accepted task id', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-attempt-ledger-'));
  let submissionKey = '';
  const registry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      model: 'sd5-seedance-2.0',
      submit: async (_payload, key) => {
        submissionKey = key;
        const attempt = db.prepare('SELECT * FROM video_job_attempts WHERE submission_key = ?').get(key);
        assert.equal(attempt.state, 'submitting');
        assert.match(attempt.request_hash, /^[a-f0-9]{64}$/);
        return { id: 'accepted-provider-task', progress: 1 };
      },
      get: async taskId => {
        assert.equal(taskId, 'accepted-provider-task');
        return { status: 'failed', progress: 5 };
      },
      download: async () => { throw new Error('download must not run'); },
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    registry,
    maxConcurrent: 1,
    quoteVerify: ({ quoteId, expectedQuote }) => ({
      quoteId,
      currency: expectedQuote.currency,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'attempt-ledger',
    billingQuoteId: 'attempt-ledger-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard',
      mode: 'script',
      prompt: '持久化提交尝试',
      duration: 5,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  await new Promise(resolve => {
    const check = () => service.getJob('owner@example.com', created.job.id)?.status === 'failed'
      ? resolve()
      : setTimeout(check, 2);
    check();
  });

  assert.equal(submissionKey, created.job.id);
  const attempts = db.prepare('SELECT * FROM video_job_attempts WHERE job_id = ? ORDER BY attempt_number').all(created.job.id);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].submission_key, created.job.id);
  assert.equal(attempts[0].provider_task_id, 'accepted-provider-task');
  assert.equal(attempts[0].state, 'failed');
});

test('provider delivery streams to disk without buffering the complete video', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-stream-delivery-'));
  const chunks = [Buffer.from('streamed-'), Buffer.from('video-output')];
  const registry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      model: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'stream-task', progress: 0 }),
      get: async () => ({ status: 'completed', progress: 100 }),
      download: async () => ({
        headers: new Headers({ 'content-type': 'video/mp4', 'content-length': String(chunks.reduce((sum, chunk) => sum + chunk.length, 0)) }),
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
        arrayBuffer() { throw new Error('delivery must not use arrayBuffer'); },
      }),
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    registry,
    maxConcurrent: 1,
    quoteVerify: ({ quoteId, expectedQuote }) => ({ quoteId, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com',
    idempotencyKey: 'stream-delivery',
    billingQuoteId: 'stream-delivery-quote',
    publicBaseUrl: 'https://example.com',
    input: {
      productId: 'seedance_standard', mode: 'script', prompt: '流式交付测试',
      duration: 5, aspectRatio: '16:9', resolution: '720p',
    },
  });
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 2_000;
    const check = () => {
      const job = service.getJob('owner@example.com', created.job.id);
      if (job?.status === 'completed') return resolve();
      if (job?.status === 'failed') return reject(new Error(`delivery failed: ${job.error}`));
      if (Date.now() >= deadline) return reject(new Error(`delivery timed out in state ${job?.status}`));
      return setTimeout(check, 2);
    };
    check();
  });

  const delivery = db.prepare('SELECT * FROM video_deliveries WHERE job_id = ?').get(created.job.id);
  assert.equal(delivery.verification_state, 'verified');
  assert.match(delivery.sha256, /^[a-f0-9]{64}$/);
  assert.equal(readFileSync(join(assetRoot, 'output', delivery.file_name), 'utf8'), 'streamed-video-output');
});

test('a truncated provider delivery is removed and never settled', async t => {
  const db = new Database(':memory:');
  const assetRoot = mkdtempSync(join(tmpdir(), 'video-generation-truncated-delivery-'));
  let releases = 0;
  let settlements = 0;
  const registry = {
    get: () => ({
      enabled: true,
      routeId: 'sd5-seedance-2.0',
      submit: async () => ({ id: 'truncated-task', progress: 0 }),
      get: async () => ({ status: 'completed', progress: 100 }),
      download: async () => ({
        headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '20' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from('short'));
            controller.close();
          },
        }),
      }),
    }),
    publicProducts: () => publicVideoProducts(),
  };
  const service = createService({
    db,
    assetRoot,
    registry,
    maxConcurrent: 1,
    walletService: {
      createHold: input => ({ id: `hold-${input.metadata.taskId}` }),
      getBalance: () => ({ unlimited: false, availableUnits: 999999 }),
      settleItem: () => { settlements += 1; return { status: 'settled' }; },
      releaseItem: () => { releases += 1; return { status: 'released' }; },
    },
    quoteVerify: ({ quoteId, expectedQuote }) => ({ quoteId, currency: expectedQuote.currency, expiresAt: '2099-01-01T00:00:00.000Z' }),
  });
  t.after(() => {
    service.close();
    db.close();
    rmSync(assetRoot, { recursive: true, force: true });
  });

  const created = await service.createJob({
    ownerEmail: 'owner@example.com', idempotencyKey: 'truncated-delivery', billingQuoteId: 'truncated-delivery-quote',
    publicBaseUrl: 'https://example.com',
    input: { productId: 'seedance_standard', mode: 'script', prompt: '截断文件测试', duration: 5, aspectRatio: '16:9', resolution: '720p' },
  });
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 2_000;
    const check = () => {
      const job = service.getJob('owner@example.com', created.job.id);
      if (job?.status === 'failed') return resolve();
      if (Date.now() >= deadline) return reject(new Error(`truncated delivery timed out in state ${job?.status}`));
      return setTimeout(check, 2);
    };
    check();
  });

  assert.equal(settlements, 0);
  assert.equal(releases, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM video_deliveries').get().count, 0);
  assert.deepEqual(readdirSync(join(assetRoot, 'output')), []);
});
