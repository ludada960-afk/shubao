import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createGenerationJobs } from '../server/generationJobs.mjs';

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
