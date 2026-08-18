import assert from 'node:assert/strict';
import test from 'node:test';

import { runVideoWorkbenchPilotVerification } from '../scripts/verify-video-workbench-pilot.mjs';

test('pilot verifier proves ten storyboard-ready projects without billing or provider jobs', () => {
  const report = runVideoWorkbenchPilotVerification();
  assert.equal(report.projects, 10);
  assert.equal(report.metrics.gate.ready, true);
  assert.equal(report.metrics.funnel.storyboardReadyProjects, 10);
  assert.equal(report.billingMutated, false);
  assert.deepEqual(report.before, report.after);
});
