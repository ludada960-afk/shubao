import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createOneShotBilling } from '../server/billing/oneShotBilling.mjs';
import { createCanvasBilledActionStore } from '../server/billing/canvasBilledActionStore.mjs';

function makeDeps({ insufficient = false, workFails = false } = {}) {
  const calls = [];
  const actions = new Map();
  const claims = new Map();
  let leaseSequence = 0;
  return {
    calls,
    actionStore: {
      get(ownerEmail, actionId) { return actions.get(`${ownerEmail}:${actionId}`) || null; },
      claim(ownerEmail, actionId, { sku }) {
        const key = `${ownerEmail}:${actionId}`;
        const record = actions.get(key) || null;
        if (record?.status === 'settled') return { status: 'settled', record };
        if (claims.has(key)) return { status: 'in_progress' };
        const leaseToken = `lease-${++leaseSequence}`;
        claims.set(key, { leaseToken, sku });
        return { status: 'claimed', leaseToken, record };
      },
      renew(ownerEmail, actionId, leaseToken) {
        const claim = claims.get(`${ownerEmail}:${actionId}`);
        if (claim?.leaseToken !== leaseToken) throw Object.assign(new Error('lease lost'), { code: 'CANVAS_BILLING_ACTION_LEASE_LOST' });
        return { leaseToken };
      },
      save(ownerEmail, actionId, value, { leaseToken } = {}) {
        const key = `${ownerEmail}:${actionId}`;
        const claim = claims.get(key);
        if (claim?.leaseToken !== leaseToken) throw Object.assign(new Error('lease lost'), { code: 'CANVAS_BILLING_ACTION_LEASE_LOST' });
        actions.set(key, structuredClone(value));
        if (value.status === 'settled') claims.delete(key);
        return value;
      },
      release(ownerEmail, actionId, leaseToken) {
        const key = `${ownerEmail}:${actionId}`;
        if (claims.get(key)?.leaseToken !== leaseToken) return false;
        claims.delete(key);
        return true;
      },
    },
    walletService: {
      getBalance: () => ({ availableUnits: 3000, unlimited: false }),
      createHold(input) {
        calls.push(['hold', input]);
        if (insufficient) throw Object.assign(new Error('余额不足'), { code: 'BILLING_INSUFFICIENT_CREDITS' });
        return { id: 'hold-1', status: 'held', items: [{ key: 'canvas_action', status: 'held' }] };
      },
      settleItem(...input) {
        calls.push(['settle', input]);
        return { status: 'settled', balance: { availableUnits: 2000, unlimited: false } };
      },
      releaseItem(...input) { calls.push(['release', input]); return { status: 'released' }; },
    },
    quoteService: {
      verify: input => ({ ...input.expectedQuote, quoteId: input.quoteId, expiresAt: '2099-01-01T00:00:00.000Z' }),
    },
    work: async () => {
      if (workFails) throw Object.assign(new Error('上游失败'), { status: 503, code: 'UPSTREAM_FAILED' });
      return { url: '/api/generated-assets/canvas-result.png' };
    },
  };
}

test('one-shot canvas billing holds then settles only after a stable result', async () => {
  const deps = makeDeps();
  const billing = createOneShotBilling(deps);
  const output = await billing.execute({
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-1',
    sku: 'ec_image_2k', referenceType: 'canvas_image', work: deps.work,
  });
  assert.equal(output.result.url, '/api/generated-assets/canvas-result.png');
  assert.deepEqual(output.billing, { currency: 'ec_points', status: 'settled', balance: 2000, unlimited: false });
  assert.equal(deps.calls[0][0], 'hold');
  assert.equal(deps.calls[1][0], 'settle');
  assert.equal(deps.calls.some(([type]) => type === 'release'), false);
});

test('one-shot canvas billing replays a settled stable result without rerunning work', async () => {
  const deps = makeDeps();
  const billing = createOneShotBilling(deps);
  let workCalls = 0;
  const request = {
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-replay',
    sku: 'ec_image_2k', referenceType: 'canvas_image',
    work: async () => {
      workCalls += 1;
      return { url: '/api/generated-assets/replayed-canvas.png' };
    },
  };

  const first = await billing.execute(request);
  const replay = await billing.execute(request);

  assert.equal(first.result.url, '/api/generated-assets/replayed-canvas.png');
  assert.deepEqual(replay, { ...first, replay: true });
  assert.equal(workCalls, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'hold').length, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'settle').length, 1);
});

test('one-shot billing single-flights concurrent requests for the same owner action', async () => {
  const deps = makeDeps();
  const billing = createOneShotBilling(deps);
  let workCalls = 0;
  let releaseWork;
  const workGate = new Promise(resolve => { releaseWork = resolve; });
  const request = {
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-concurrent',
    sku: 'ec_image_2k', referenceType: 'canvas_image',
    work: async () => {
      workCalls += 1;
      await workGate;
      return { url: '/api/generated-assets/concurrent-canvas.png' };
    },
  };

  const first = billing.execute(request);
  const second = billing.execute(request);
  releaseWork();
  const [firstOutput, secondOutput] = await Promise.all([first, second]);

  assert.deepEqual(secondOutput, firstOutput);
  assert.equal(workCalls, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'hold').length, 1);
  assert.equal(deps.calls.filter(([type]) => type === 'settle').length, 1);
});

test('one-shot billing uses a durable SQLite lease across independent service instances', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-one-shot-lease-'));
  const path = join(directory, 'billing.db');
  const firstDb = new Database(path);
  const secondDb = new Database(path);
  t.after(async () => {
    firstDb.close();
    secondDb.close();
    await rm(directory, { recursive: true, force: true });
  });
  const shared = makeDeps();
  const firstBilling = createOneShotBilling({
    ...shared,
    actionStore: createCanvasBilledActionStore(firstDb),
  });
  const secondBilling = createOneShotBilling({
    ...shared,
    actionStore: createCanvasBilledActionStore(secondDb),
  });
  let releaseWork;
  const workGate = new Promise(resolve => { releaseWork = resolve; });
  let workCalls = 0;
  const request = {
    ownerEmail: 'creator@example.com', quoteId: 'quote-1', actionId: 'action-cross-process',
    sku: 'ec_image_2k', referenceType: 'canvas_image',
    work: async () => {
      workCalls += 1;
      await workGate;
      return { url: '/api/generated-assets/cross-process.png' };
    },
  };

  const first = firstBilling.execute(request);
  setTimeout(releaseWork, 20);
  await assert.rejects(() => secondBilling.execute(request), error => (
    error.status === 409 && error.code === 'CANVAS_BILLING_ACTION_IN_PROGRESS'
  ));
  await first;

  assert.equal(workCalls, 1);
  assert.equal(shared.calls.filter(([type]) => type === 'hold').length, 1);
  assert.equal(shared.calls.filter(([type]) => type === 'settle').length, 1);
});

test('durable action lease expires, can be reclaimed, and fences the previous worker', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-action-store-'));
  const path = join(directory, 'billing.db');
  const firstDb = new Database(path);
  const secondDb = new Database(path);
  let now = 1_700_000_000_000;
  let sequence = 0;
  const options = {
    now: () => now,
    randomUUID: () => `lease-${++sequence}`,
    defaultLeaseMs: 1_000,
  };
  const firstStore = createCanvasBilledActionStore(firstDb, options);
  const secondStore = createCanvasBilledActionStore(secondDb, options);
  t.after(async () => {
    firstDb.close();
    secondDb.close();
    await rm(directory, { recursive: true, force: true });
  });

  const first = firstStore.claim('creator@example.com', 'action-reclaim', { sku: 'ec_image_2k' });
  assert.equal(first.status, 'claimed');
  assert.equal(secondStore.claim('creator@example.com', 'action-reclaim', { sku: 'ec_image_2k' }).status, 'in_progress');

  now += 1_001;
  const reclaimed = secondStore.claim('creator@example.com', 'action-reclaim', { sku: 'ec_image_2k' });
  assert.equal(reclaimed.status, 'claimed');
  assert.notEqual(reclaimed.leaseToken, first.leaseToken);
  assert.throws(() => firstStore.save('creator@example.com', 'action-reclaim', {
    status: 'delivered',
    sku: 'ec_image_2k',
    result: { url: '/api/generated-assets/stale.png' },
  }, { leaseToken: first.leaseToken }), error => error.code === 'CANVAS_BILLING_ACTION_LEASE_LOST');
});

test('a reclaimed non-resumable action never submits the upstream work twice', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-one-shot-recovery-'));
  const path = join(directory, 'billing.db');
  const firstDb = new Database(path);
  const secondDb = new Database(path);
  let clock = 1_700_000_000_000;
  let leaseSequence = 0;
  const shared = makeDeps();
  const storeOptions = {
    now: () => clock,
    randomUUID: () => `recovery-lease-${++leaseSequence}`,
    defaultLeaseMs: 100,
  };
  const firstBilling = createOneShotBilling({
    ...shared,
    actionStore: createCanvasBilledActionStore(firstDb, storeOptions),
    leaseMs: 100,
    heartbeatMs: 50,
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });
  const secondBilling = createOneShotBilling({
    ...shared,
    actionStore: createCanvasBilledActionStore(secondDb, storeOptions),
    leaseMs: 100,
    heartbeatMs: 50,
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
  });
  t.after(async () => {
    firstDb.close();
    secondDb.close();
    await rm(directory, { recursive: true, force: true });
  });

  let releaseFirstWork;
  let workCalls = 0;
  const workGate = new Promise(resolve => { releaseFirstWork = resolve; });
  const request = {
    ownerEmail: 'creator@example.com', quoteId: 'quote-recovery', actionId: 'action-recovery',
    sku: 'ec_reverse_prompt', referenceType: 'canvas_reverse_prompt',
    work: async () => {
      workCalls += 1;
      if (workCalls > 1) {
        throw Object.assign(new Error('duplicate upstream submission'), {
          code: 'DUPLICATE_UPSTREAM_SUBMISSION',
        });
      }
      await workGate;
      return { url: '/api/generated-assets/recovery.png' };
    },
  };

  const first = firstBilling.execute(request);
  await new Promise(resolve => setImmediate(resolve));
  clock += 101;
  await assert.rejects(
    () => secondBilling.execute(request),
    error => error.status === 409 && error.code === 'CANVAS_BILLING_ACTION_RECOVERY_REQUIRED',
  );
  assert.equal(workCalls, 1);

  releaseFirstWork();
  await assert.rejects(() => first, error => error.code === 'CANVAS_BILLING_ACTION_LEASE_LOST');
  assert.equal(workCalls, 1);
});

test('a reclaimed durable action may resume its persisted provider job', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-one-shot-durable-recovery-'));
  const path = join(directory, 'billing.db');
  const db = new Database(path);
  let clock = 1_700_000_000_000;
  const actionStore = createCanvasBilledActionStore(db, {
    now: () => clock,
    randomUUID: (() => {
      let sequence = 0;
      return () => `durable-recovery-lease-${++sequence}`;
    })(),
    defaultLeaseMs: 100,
  });
  t.after(async () => {
    db.close();
    await rm(directory, { recursive: true, force: true });
  });

  actionStore.claim('creator@example.com', 'action-durable-recovery', {
    sku: 'ec_image_2k',
    leaseMs: 100,
  });
  clock += 101;
  const deps = makeDeps();
  const billing = createOneShotBilling({
    ...deps,
    actionStore,
    leaseMs: 100,
    heartbeatMs: 50,
  });
  let resumeCalls = 0;
  const output = await billing.execute({
    ownerEmail: 'creator@example.com',
    quoteId: 'quote-durable-recovery',
    actionId: 'action-durable-recovery',
    sku: 'ec_image_2k',
    referenceType: 'canvas_transform',
    resumableWork: true,
    work: async () => {
      resumeCalls += 1;
      return { taskId: 'canvas_persisted_job', url: '/api/generated-assets/durable-recovery.png' };
    },
  });

  assert.equal(resumeCalls, 1);
  assert.equal(output.result.taskId, 'canvas_persisted_job');
  assert.equal(output.billing.status, 'settled');
});

test('one-shot canvas billing returns an actionable 402 and releases failed work', async () => {
  const insufficient = makeDeps({ insufficient: true });
  const billing = createOneShotBilling(insufficient);
  await assert.rejects(() => billing.execute({ ownerEmail: 'creator@example.com', quoteId: 'quote', actionId: 'action', sku: 'ec_image_2k', work: insufficient.work }), error => (
    error.status === 402 && error.code === 'BILLING_INSUFFICIENT_CREDITS' && error.required === 1000
  ));

  const failed = makeDeps({ workFails: true });
  const failedBilling = createOneShotBilling(failed);
  await assert.rejects(() => failedBilling.execute({ ownerEmail: 'creator@example.com', quoteId: 'quote', actionId: 'action', sku: 'ec_image_2k', work: failed.work }), /上游失败/);
  assert.equal(failed.calls.some(([type]) => type === 'release'), true);
  assert.equal(failed.calls.some(([type]) => type === 'settle'), false);
});
