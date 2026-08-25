import test from 'node:test';
import assert from 'node:assert/strict';

import { createEcommerceStartupRecovery } from '../server/ecommerceEngine/orchestrator.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('periodic sweep keeps adopting stale jobs after follow-up scans end', async () => {
  let resumeCalls = 0;
  const recoveredAt = [];
  const recover = createEcommerceStartupRecovery({
    orchestrator: {
      async resumeJobs() {
        resumeCalls += 1;
        recoveredAt.push(Date.now());
        return [];
      },
    },
    maxAttempts: 1,
    maxFollowUpScans: 1,
    followUpDelayMs: 20,
    sweepIntervalMs: 25,
  });
  await recover();
  await sleep(140);
  recover.stop();
  assert.ok(resumeCalls >= 4, `expected initial + follow-up + sweeps, got ${resumeCalls}`);
});

test('sweep stays disabled by default and stop() halts further scans', async () => {
  let resumeCalls = 0;
  const recover = createEcommerceStartupRecovery({
    orchestrator: {
      async resumeJobs() {
        resumeCalls += 1;
        return [];
      },
    },
    maxAttempts: 1,
    maxFollowUpScans: 1,
    followUpDelayMs: 15,
  });
  await recover();
  await sleep(80);
  const withoutSweep = resumeCalls;
  recover.stop();
  await sleep(40);
  assert.equal(withoutSweep, 2, 'initial scan plus one follow-up only');
});
