import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
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
  for (const column of ['product_id', 'provider_route', 'catalog_version', 'provider_cost_cny', 'failure_class', 'quote_id', 'billing_state', 'reconciliation_error', 'release_attempts']) {
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

  settlementShouldFail = false;
  const summary = service.reconcileBilling();
  const completed = service.getJob('owner@example.com', created.job.id);
  assert.equal(summary.settled, 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.billingState, 'settled');
  assert.equal(releaseCalls, 0);
  assert.equal(settlementCalls, 2);
  assert.equal(savedWorks.length, 1);
});
