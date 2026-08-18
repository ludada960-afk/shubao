import assert from 'node:assert/strict';
import test from 'node:test';

import { runVideoRendererReconciliationDryRun } from '../scripts/verify-video-renderer-reconciliation-dry-run.mjs';

test('reconciliation dry-run covers recovery scenarios without provider or billing side effects', async () => {
  const report = await runVideoRendererReconciliationDryRun();
  assert.equal(report.ok, true);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.providerCalls, 0);
  assert.equal(report.billingMutated, false);
  assert.deepEqual(report.scenarios.map(item => item.name), [
    'complete', 'lost-submit-retry', 'timeout', 'invalid-submit-callback',
  ]);
  assert.ok(report.scenarios.every(item => item.providerSubmission === false));
  assert.ok(report.scenarios.every(item => item.billingMutation === false));
});
