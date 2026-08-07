import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import { createGenerationJobs } from '../server/generationJobs.mjs';

test('new jobs persist the current immutable visual input schema version', () => {
  const jobs = createGenerationJobs();
  const job = jobs.create({ ownerEmail: '867550189@qq.com', payload: { productName: '杯子' } });

  assert.equal(job.visualInputSchemaVersion, 1);
  jobs.close();
});

test('job transition cannot skip from queued to complete', () => {
  const jobs = createGenerationJobs();
  const job = jobs.create({ ownerEmail: '867550189@qq.com', payload: { productName: '杯子' } });
  assert.throws(() => jobs.transition(job.id, 'completed'), /invalid transition/);
  jobs.close();
});

test('recoverable running jobs return to queued after restart', () => {
  const jobs = createGenerationJobs();
  const job = jobs.create({ ownerEmail: '867550189@qq.com', payload: {} });
  jobs.transition(job.id, 'analyzing');
  jobs.transition(job.id, 'generating');
  assert.equal(jobs.recoverInterrupted(), 1);
  assert.equal(jobs.get(job.id).status, 'queued');
  jobs.close();
});

test('structured provider assets remain resumable without resetting their parent job', () => {
  const jobs = createGenerationJobs();
  const job = jobs.create({ ownerEmail: '867550189@qq.com', payload: {} });
  jobs.transition(job.id, 'analyzing');
  jobs.transition(job.id, 'generating');
  jobs.assets.createAsset({ jobId: job.id, assetId: 'main', requestSnapshot: { prompt: 'safe' } });
  const lease = jobs.assets.claimAsset(job.id, 'main');
  jobs.assets.markSubmitted(job.id, 'main', {
    providerJobId: 'provider-main',
    leaseToken: lease.leaseToken,
  });

  assert.equal(jobs.recoverInterrupted(), 1);
  assert.equal(jobs.get(job.id).status, 'generating');
  assert.equal(jobs.assets.getAsset(job.id, 'main').state, 'submitted');
  jobs.close();
});

test('runs interrupted-job recovery when the durable store opens at startup', t => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-generation-jobs-'));
  const dbPath = join(directory, 'jobs.db');
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const first = createGenerationJobs(dbPath);
  const job = first.create({ ownerEmail: '867550189@qq.com', payload: {} });
  first.transition(job.id, 'analyzing');
  first.transition(job.id, 'generating');
  first.close();

  const restarted = createGenerationJobs(dbPath);
  assert.equal(restarted.recoveredOnStartup, 1);
  assert.equal(restarted.get(job.id).status, 'queued');
  restarted.close();
});

test('claimNext reclaims an expired non-terminal parent lease without stealing it while valid', t => {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-generation-jobs-expired-lease-'));
  const dbPath = join(directory, 'jobs.db');
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let nowMs = Date.parse('2026-07-26T00:00:00.000Z');
  let tokenIndex = 0;
  const options = {
    now: () => nowMs,
    randomUUID: () => `recovery-token-${++tokenIndex}`,
    defaultLeaseMs: 100,
  };

  const firstProcess = createGenerationJobs(dbPath, options);
  const job = firstProcess.create({ ownerEmail: '867550189@qq.com', payload: {} });
  const originalLease = firstProcess.claimNext();
  firstProcess.close();

  const restarted = createGenerationJobs(dbPath, options);
  assert.equal(restarted.get(job.id).status, 'analyzing');
  assert.equal(restarted.claimNext(), null);

  nowMs += 101;
  const reclaimed = restarted.claimNext();

  assert.equal(reclaimed.id, job.id);
  assert.equal(reclaimed.status, 'analyzing');
  assert.notEqual(reclaimed.leaseToken, originalLease.leaseToken);
  restarted.close();
});

test('owner task list never returns another owner job or request payload', () => {
  const jobs = createGenerationJobs();
  const first = jobs.create({
    id: 'job-a',
    ownerEmail: 'a@example.com',
    payload: { product_name: '保温杯', secretPrompt: 'must not leak' },
  });
  jobs.create({ id: 'job-b', ownerEmail: 'b@example.com', payload: { product_name: '鞋子' } });
  jobs.assets.createAsset({ jobId: first.id, assetId: 'main-1', requestSnapshot: { prompt: 'provider secret' } });

  const rows = jobs.listOwner('A@example.com');

  assert.deepEqual(rows.map(row => row.id), ['job-a']);
  assert.equal(rows[0].title, '保温杯套图');
  assert.equal(Object.hasOwn(rows[0], 'payload'), false);
  assert.equal(Object.hasOwn(rows[0].assets[0], 'requestSnapshot'), false);
  jobs.close();
});

test('owner task list exposes only numeric progress counters and never orchestration snapshots', () => {
  const jobs = createGenerationJobs(':memory:');
  try {
    const created = jobs.create({
      id: 'job-safe-progress',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '测试商品', secret: 'hidden-payload' },
    });
    jobs.checkpoint(created.id, {
      progress: {
        current: 1,
        total: 2,
        completed: 1,
        failed: 1,
        orchestrationSnapshot: { assetPlan: [{ request: { prompt: 'hidden-provider-prompt' } }] },
        visualInputSnapshot: { assets: { product: [{ assetId: 'private-input' }] } },
      },
    });

    const [summary] = jobs.listOwner('owner@example.com');
    assert.deepEqual(summary.progress, {
      current: 1,
      total: 2,
      completed: 1,
      needsReview: 0,
      failed: 1,
      delivered: 1,
      charged: 1,
      released: 1,
      retryable: 1,
    });
    assert.equal(JSON.stringify(summary).includes('hidden-provider-prompt'), false);
    assert.equal(JSON.stringify(summary).includes('private-input'), false);
    assert.equal(JSON.stringify(summary).includes('hidden-payload'), false);
  } finally {
    jobs.close();
  }
});

test('owner task list closes a stale pre-billing visual analysis instead of showing it forever', () => {
  let nowMs = Date.parse('2026-07-31T16:23:12.783Z');
  const jobs = createGenerationJobs(':memory:', { now: () => nowMs });
  try {
    const job = jobs.create({
      id: 'job-stale-visual-analysis',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '酱料盒' },
    });
    jobs.transition(job.id, 'analyzing');
    jobs.checkpoint(job.id, { progress: { visualInputSnapshot: { assets: [] } } });

    nowMs += 3 * 60 * 1000 + 1;
    const [summary] = jobs.listOwner('owner@example.com');

    assert.equal(summary.status, 'failed');
    assert.equal(summary.error, '生成暂未完成，请重新开始');
    assert.equal(jobs.get(job.id).error, '图片分析超时，本轮未扣费，请重新生成');
  } finally {
    jobs.close();
  }
});

test('startup fails a stale pre-billing analysis before interrupted-job recovery can requeue it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shubao-stale-analysis-'));
  const dbPath = join(dir, 'jobs.sqlite');
  let nowMs = Date.parse('2026-07-31T16:23:12.783Z');
  try {
    const first = createGenerationJobs(dbPath, { now: () => nowMs });
    const job = first.create({
      id: 'job-stale-on-restart',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '酱料盒' },
    });
    first.transition(job.id, 'analyzing');
    first.close();

    nowMs += 3 * 60 * 1000 + 1;
    const reopened = createGenerationJobs(dbPath, { now: () => nowMs });
    assert.equal(reopened.staleVisualAnalysesFailedOnStartup, 1);
    assert.equal(reopened.recoveredOnStartup, 0);
    assert.equal(reopened.get(job.id).status, 'failed');
    assert.equal(reopened.get(job.id).error, '图片分析超时，本轮未扣费，请重新生成');
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('startup treats a recent SQLite UTC timestamp as recent in every local timezone', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shubao-recent-analysis-'));
  const dbPath = join(dir, 'jobs.sqlite');
  const nowMs = Date.parse('2026-08-01T02:00:01.000Z');
  try {
    const first = createGenerationJobs(dbPath, { now: () => nowMs });
    const job = first.create({
      id: 'job-recent-on-restart',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '酱料盒' },
    });
    first.transition(job.id, 'analyzing');
    first.close();

    const db = new Database(dbPath);
    db.prepare('UPDATE ecommerce_jobs SET updated_at = ? WHERE id = ?')
      .run('2026-08-01 02:00:00', job.id);
    db.close();

    const reopened = createGenerationJobs(dbPath, { now: () => nowMs });
    assert.equal(reopened.staleVisualAnalysesFailedOnStartup, 0);
    assert.equal(reopened.recoveredOnStartup, 1);
    assert.equal(reopened.get(job.id).status, 'queued');
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dismisses only owned terminal task summaries while preserving the durable job', () => {
  const jobs = createGenerationJobs(':memory:');
  try {
    const active = jobs.create({
      id: 'job-active-dismiss',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '活动商品' },
    });
    assert.throws(
      () => jobs.dismissOwned(active.id, 'owner@example.com'),
      error => error?.status === 409,
    );

    const terminal = jobs.create({
      id: 'job-terminal-dismiss',
      ownerEmail: 'owner@example.com',
      payload: { product_name: '完成商品' },
    });
    jobs.transition(terminal.id, 'analyzing');
    jobs.transition(terminal.id, 'generating');
    jobs.transition(terminal.id, 'completed');

    assert.throws(
      () => jobs.dismissOwned(terminal.id, 'other@example.com'),
      error => error?.status === 404,
    );
    assert.deepEqual(jobs.dismissOwned(terminal.id, 'OWNER@example.com'), {
      id: terminal.id,
      status: 'dismissed',
    });
    assert.deepEqual(jobs.listOwner('owner@example.com').map(job => job.id), [active.id]);
    assert.equal(jobs.get(terminal.id).status, 'completed');
    assert.ok(jobs.get(terminal.id).dismissedAt);
  } finally {
    jobs.close();
  }
});
