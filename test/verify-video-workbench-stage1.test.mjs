import test from 'node:test';
import assert from 'node:assert/strict';

import { runVideoWorkbenchStage1Verification } from '../scripts/verify-video-workbench-stage1.mjs';

test('stage 1 workbench acceptance survives restart without paid generation', () => {
  const report = runVideoWorkbenchStage1Verification();
  assert.deepEqual(report, {
    ok: true,
    profile: 'local-no-paid-generation',
    projects: 1,
    shots: 3,
    candidates: 6,
    timelineClips: 3,
    restartRecovered: true,
    selectiveReplacement: true,
    exportQueued: true,
    providerSubmissions: 0,
    billingMutated: false,
    paidGenerationRequested: false,
    initialJobState: 'waiting_renderer',
    currentJobState: 'waiting_renderer',
  });
});
