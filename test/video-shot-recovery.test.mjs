import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertShotRecoveryPlanIntegrity,
  buildShotRecoveryPlan,
  videoShotRecoveryLimits,
} from '../server/videoShotRecovery.mjs';

const workbench = Object.freeze({
  shots: [
    { id: 'shot-b', position: 1, selectedCandidateId: 'candidate-b', revision: 3 },
    { id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2 },
  ],
  timelineClips: [
    { id: 'clip-b', shotId: 'shot-b', position: 1, status: 'active' },
    { id: 'clip-a', shotId: 'shot-a', position: 0, status: 'active' },
    { id: 'clip-old', shotId: 'shot-a', position: 2, status: 'stale' },
  ],
});

test('shot recovery plan is deterministic, bounded and preserves unrelated work', () => {
  const first = buildShotRecoveryPlan(workbench, {
    shotId: 'shot-a',
    mode: 'replace_candidate',
    reason: '上游任务超时，保留其他镜头。',
  });
  const second = buildShotRecoveryPlan(workbench, {
    shotId: 'shot-a',
    mode: 'replace_candidate',
    reason: '上游任务超时，保留其他镜头。',
  });
  assert.deepEqual(first, second);
  assert.equal(first.replace.candidateId, 'candidate-a');
  assert.deepEqual(first.replace.timelineClipIds, ['clip-a', 'clip-old']);
  assert.deepEqual(first.preserve.shotIds, ['shot-b']);
  assert.deepEqual(first.preserve.candidateIds, ['candidate-b']);
  assert.deepEqual(first.preserve.timelineClipIds, ['clip-b']);
  assert.equal(first.providerSubmission, false);
  assert.equal(first.billingMutation, false);
  assert.equal(first.reason, '上游任务超时，保留其他镜头。');
  assert.match(first.planHash, /^[a-f0-9]{64}$/);
  assert.strictEqual(assertShotRecoveryPlanIntegrity(first), first);
});

test('shot recovery plan supports rebuilding a shot without accepting unknown modes', () => {
  const plan = buildShotRecoveryPlan(workbench, { shotId: 'shot-b', mode: 'rebuild_shot' });
  assert.equal(plan.mode, 'rebuild_shot');
  assert.equal(plan.replace.candidateId, 'candidate-b');
  assert.equal(plan.reason, '');
  assert.throws(() => buildShotRecoveryPlan(workbench, { shotId: 'shot-b', mode: 'provider_override' }),
    error => error.code === 'SHOT_RECOVERY_INVALID');
  assert.throws(() => buildShotRecoveryPlan(workbench, { shotId: 'missing' }),
    error => error.code === 'SHOT_NOT_FOUND');
  assert.deepEqual(videoShotRecoveryLimits.modes.sort(), ['rebuild_shot', 'replace_candidate']);
});

test('tampered recovery plans fail closed before any provider path can consume them', () => {
  const plan = buildShotRecoveryPlan(workbench, { shotId: 'shot-a' });
  assert.throws(() => assertShotRecoveryPlanIntegrity({ ...plan, reason: 'changed' }),
    error => error.code === 'SHOT_RECOVERY_INVALID');
  assert.throws(() => assertShotRecoveryPlanIntegrity({ ...plan, providerSubmission: true }),
    error => error.code === 'SHOT_RECOVERY_INVALID');
});
