import test from 'node:test';
import assert from 'node:assert/strict';

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
