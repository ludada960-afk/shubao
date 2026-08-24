import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  assertShotRecoveryPlanIntegrity,
  buildShotRecoveryPlan,
  buildShotRecoveryApplication,
  buildShotRecoveryDeliveryReceipt,
  assertShotRecoveryDeliveryReceiptIntegrity,
  compileShotRecoveryCommit,
  compileShotRecoveryCommitPreflight,
  compileShotRecoveryExecution,
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
  assert.deepEqual(videoShotRecoveryLimits.modes.sort(), [
    'extend_shot', 'rebuild_shot', 'replace_candidate', 'reshoot_range', 'reshoot_shot', 'track_replace',
  ]);
});

test('reshoot and extend plans expose bounded edit intent without provider work', () => {
  const reshoot = buildShotRecoveryPlan(workbench, { shotId: 'shot-a', mode: 'reshoot_shot' });
  assert.deepEqual(reshoot.edit, {
    operation: 'reshoot',
    strategy: 'preserve_bindings',
    sourceDurationMs: null,
    extensionMs: 0,
    targetDurationMs: null,
    region: null,
  });
  const extend = buildShotRecoveryPlan({
    ...workbench,
    shots: workbench.shots.map(shot => shot.id === 'shot-a' ? { ...shot, durationMs: 6000 } : shot),
  }, { shotId: 'shot-a', mode: 'extend_shot', extensionMs: 2500 });
  assert.equal(extend.edit.operation, 'extend');
  assert.equal(extend.edit.sourceDurationMs, 6000);
  assert.equal(extend.edit.extensionMs, 2500);
  assert.equal(extend.edit.targetDurationMs, 8500);
  assert.equal(extend.providerSubmission, false);
  assert.equal(extend.billingMutation, false);
  assert.strictEqual(assertShotRecoveryPlanIntegrity(extend), extend);
});

test('track replacement requires a normalized in-frame region and remains deterministic', () => {
  const plan = buildShotRecoveryPlan(workbench, {
    shotId: 'shot-b',
    mode: 'track_replace',
    region: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
  });
  assert.deepEqual(plan.edit.region, { x: 0.1, y: 0.2, width: 0.4, height: 0.5 });
  assert.equal(plan.edit.strategy, 'tracked_object_replace');
  assert.strictEqual(assertShotRecoveryPlanIntegrity(plan), plan);
  assert.throws(() => buildShotRecoveryPlan(workbench, {
    shotId: 'shot-b', mode: 'track_replace', region: { x: 0.8, y: 0, width: 0.4, height: 0.2 },
  }), error => error.code === 'SHOT_RECOVERY_INVALID');
  assert.throws(() => buildShotRecoveryPlan(workbench, {
    shotId: 'shot-b', mode: 'extend_shot', extensionMs: 100,
  }), error => error.code === 'SHOT_RECOVERY_INVALID');
});

test('tampered recovery plans fail closed before any provider path can consume them', () => {
  const plan = buildShotRecoveryPlan(workbench, { shotId: 'shot-a' });
  assert.throws(() => assertShotRecoveryPlanIntegrity({ ...plan, reason: 'changed' }),
    error => error.code === 'SHOT_RECOVERY_INVALID');
  assert.throws(() => assertShotRecoveryPlanIntegrity({ ...plan, providerSubmission: true }),
    error => error.code === 'SHOT_RECOVERY_INVALID');
});

test('recovery execution compilation preserves canonical candidate and timeline facts', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'video-hash', mimeType: 'video/mp4',
        stableUrl: '/api/video/assets/video-a', projectAssetRefStatus: 'verified',
        projectAssetRef: {
          projectId: 'project-a', projectAssetId: 'project-asset-a', assetId: 'video-a',
          contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/api/video/assets/video-a',
        },
      }],
    }],
    timelineClips: [{
      id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0,
      trimStartMs: 0, trimEndMs: 4000, muted: false, revision: 1, status: 'active',
    }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a', mode: 'reshoot_shot' });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  assert.equal(execution.planId, 'plan-a');
  assert.equal(execution.sourceCandidate.projectAssetRef.projectAssetId, 'project-asset-a');
  assert.deepEqual(execution.sourceTimelineClips.map(clip => clip.id), ['clip-a']);
  assert.equal(execution.providerSubmission, false);
  assert.equal(execution.billingMutation, false);
  assert.match(execution.executionHash, /^[a-f0-9]{64}$/);
});

test('recovery execution compilation rejects stale graph and unverified candidate refs', () => {
  const graph = {
    shots: [{ id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, candidates: [{
      id: 'candidate-a', contentHash: 'hash', mimeType: 'video/mp4', stableUrl: '/video-a',
      projectAssetRefStatus: 'unverified-legacy', projectAssetRef: { projectAssetId: 'legacy' },
    }] }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a' });
  assert.throws(() => compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph),
    error => error.code === 'PROJECT_ASSET_REF_INVALID');
  const verifiedGraph = {
    ...graph,
    shots: graph.shots.map(shot => ({ ...shot, revision: 3, candidates: shot.candidates.map(candidate => ({
      ...candidate, projectAssetRefStatus: 'verified', projectAssetRef: { projectAssetId: 'canonical' },
    })) })),
  };
  assert.throws(() => compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, verifiedGraph),
    error => error.code === 'SHOT_RECOVERY_STALE');
});

test('recovery application draft describes deterministic candidate and timeline operations', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/video-a',
        projectAssetRefStatus: 'verified',
        projectAssetRef: { projectId: 'project-a', projectAssetId: 'asset-a', assetId: 'video-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/video-a' },
      }],
    }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, trimStartMs: 0, trimEndMs: 4000, revision: 7, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a', mode: 'extend_shot', extensionMs: 2500 });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  const application = buildShotRecoveryApplication(execution);
  assert.equal(application.status, 'draft');
  assert.equal(application.candidateAction.type, 'create_candidate');
  assert.equal(application.candidateAction.expectedCandidateId, 'candidate-a');
  assert.deepEqual(application.timelineActions, [{
    type: 'extend_tail', clipId: 'clip-a', expectedRevision: 7,
    expectedCandidateId: 'candidate-a', extensionMs: 2500, targetDurationMs: 6500,
  }]);
  assert.equal(application.providerSubmission, false);
  assert.equal(application.billingMutation, false);
  assert.match(application.applicationHash, /^[a-f0-9]{64}$/);
});

test('recovery application draft rejects malformed target candidate refs and stale clips', () => {
  const execution = {
    schemaVersion: 1, planId: 'plan-a', planHash: 'a'.repeat(64),
    shot: { id: 'shot-a', revision: 2, selectedCandidateId: 'candidate-a' },
    sourceCandidate: { id: 'candidate-a', projectAssetRef: { projectAssetId: 'asset-a' } },
    sourceTimelineClips: [{ id: 'clip-a', candidateId: 'candidate-a', revision: 1, status: 'stale' }],
    edit: { operation: 'replace_candidate', extensionMs: 0, targetDurationMs: 4000, region: null },
    preserve: { shotIds: [], candidateIds: [], timelineClipIds: [] },
    providerSubmission: false, billingMutation: false,
  };
  assert.throws(() => buildShotRecoveryApplication(execution), error => error.code === 'SHOT_RECOVERY_STALE');
  const graph = {
    shots: [{ id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2,
      candidates: [{ id: 'candidate-a', contentHash: 'hash', mimeType: 'video/mp4', stableUrl: '/video-a', projectAssetRefStatus: 'verified', projectAssetRef: { projectAssetId: 'asset-a' } }] }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, revision: 1, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a' });
  const valid = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  assert.throws(() => buildShotRecoveryApplication(valid, { targetProjectAssetRef: { assetId: 'asset-b' } }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
});

test('recovery delivery receipt requires a verified video project asset and preserves the draft actions', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/video-a',
        projectAssetRefStatus: 'verified',
        projectAssetRef: { projectId: 'project-a', projectAssetId: 'asset-a', assetId: 'video-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/video-a' },
      }],
    }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, trimStartMs: 0, trimEndMs: 4000, revision: 7, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a', mode: 'reshoot_shot' });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  const application = buildShotRecoveryApplication(execution);
  assert.equal(application.candidateAction.targetProjectAssetRef, null);
  const receipt = buildShotRecoveryDeliveryReceipt(application, {
    status: 'completed',
    projectId: 'project-a',
    outputAssetId: 'video-b',
    stableUrl: '/video-b',
    contentHash: 'video-hash-b',
    mimeType: 'video/mp4',
    projectAssetRef: {
      projectId: 'project-a', projectAssetId: 'asset-b', assetId: 'video-b',
      stableUrl: '/video-b', contentHash: 'video-hash-b', mimeType: 'video/mp4',
    },
    provider: 'stub-provider', model: 'stub-model', requestId: 'request-b',
  }, { ownerEmail: 'owner@example.com', projectId: 'project-a' });
  assert.equal(receipt.status, 'ready');
  assert.equal(receipt.candidate.projectAssetRef.projectAssetId, 'asset-b');
  assert.equal(receipt.candidate.outputAssetId, 'video-b');
  assert.deepEqual(receipt.timelineActions, application.timelineActions);
  assert.equal(receipt.providerSubmission, false);
  assert.equal(receipt.billingMutation, false);
  assert.match(receipt.receiptHash, /^[a-f0-9]{64}$/);
});

test('recovery delivery receipt fails closed for wrong project, non-video, and mismatched hashes', () => {
  const application = {
    schemaVersion: 1, status: 'draft', planId: 'plan-a', planHash: 'a'.repeat(64), executionHash: 'b'.repeat(64),
    candidateAction: { type: 'create_candidate', sourceCandidateId: 'candidate-a', expectedCandidateId: 'candidate-a', canonicalAssetRequired: true, targetProjectAssetRef: null, recoveryOperation: 'replace_candidate' },
    shot: { id: 'shot-a', revision: 2, selectedCandidateId: 'candidate-a' }, timelineActions: [], preserve: { shotIds: [], candidateIds: [], timelineClipIds: [] }, providerSubmission: false, billingMutation: false,
  };
  const appPayload = { ...application };
  application.applicationHash = crypto.createHash('sha256').update(stableValueForTest(appPayload)).digest('hex');
  const validDelivery = {
    status: 'completed', outputAssetId: 'video-b', stableUrl: '/video-b', contentHash: 'hash-b', mimeType: 'video/mp4',
    projectAssetRef: { projectId: 'project-a', projectAssetId: 'asset-b', assetId: 'video-b', stableUrl: '/video-b', contentHash: 'hash-b', mimeType: 'video/mp4' },
  };
  assert.throws(() => buildShotRecoveryDeliveryReceipt(application, { ...validDelivery, projectId: 'project-b' }, { projectId: 'project-a' }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
  assert.throws(() => buildShotRecoveryDeliveryReceipt(application, { ...validDelivery, mimeType: 'image/png', projectAssetRef: { ...validDelivery.projectAssetRef, mimeType: 'image/png' } }, { projectId: 'project-a' }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
  assert.throws(() => buildShotRecoveryDeliveryReceipt(application, { ...validDelivery, contentHash: 'wrong' }, { projectId: 'project-a' }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
});

test('recovery delivery compiles a guarded candidate and timeline commit draft', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'source-hash', mimeType: 'video/mp4', stableUrl: '/source',
        projectAssetRefStatus: 'verified',
        projectAssetRef: { projectId: 'project-a', projectAssetId: 'source-asset', assetId: 'source', contentHash: 'source-hash', mimeType: 'video/mp4', stableUrl: '/source', role: 'generated-video', expectedContentHash: 'source-hash' },
      }],
    }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, trimStartMs: 0, trimEndMs: 4000, revision: 7, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a', mode: 'reshoot_shot' });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  const application = buildShotRecoveryApplication(execution);
  const receipt = buildShotRecoveryDeliveryReceipt(application, {
    status: 'completed', projectId: 'project-a', candidateId: 'candidate-b', outputAssetId: 'output-b',
    stableUrl: '/output-b', contentHash: 'output-hash', mimeType: 'video/mp4',
    projectAssetRef: { projectId: 'project-a', projectAssetId: 'output-asset', assetId: 'output-b', stableUrl: '/output-b', contentHash: 'output-hash', mimeType: 'video/mp4', role: 'generated-video', expectedContentHash: 'output-hash' },
    provider: 'provider-a', model: 'model-a', requestId: 'request-b',
  }, { projectId: 'project-a' });

  assert.strictEqual(assertShotRecoveryDeliveryReceiptIntegrity(receipt), receipt);
  const commit = compileShotRecoveryCommit(receipt, { projectId: 'project-a' });
  assert.equal(commit.status, 'ready');
  assert.equal(commit.projectId, 'project-a');
  assert.equal(commit.candidate.shotId, 'shot-a');
  assert.equal(commit.candidate.requestedCandidateId, 'candidate-b');
  assert.equal(commit.candidate.expectedCandidateId, 'candidate-a');
  assert.equal(commit.candidate.projectAssetRef.projectAssetId, 'output-asset');
  assert.equal(commit.timelineActions[0].targetCandidateId, 'candidate-b');
  assert.equal(commit.timelineActions[0].expectedRevision, 7);
  assert.match(commit.commitHash, /^[a-f0-9]{64}$/);

  const tampered = { ...receipt, candidate: { ...receipt.candidate, stableUrl: '/tampered' } };
  assert.throws(() => compileShotRecoveryCommit(tampered, { projectId: 'project-a' }), error => error.code === 'SHOT_RECOVERY_DELIVERY_INVALID');
  assert.throws(() => compileShotRecoveryCommit(receipt, { projectId: 'project-b' }), error => error.code === 'PROJECT_ASSET_REF_INVALID');
});

test('recovery commit preflight rechecks the current shot, candidate and clips before persistence', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'source-hash', mimeType: 'video/mp4', stableUrl: '/source',
        projectAssetRefStatus: 'verified',
        projectAssetRef: { projectId: 'project-a', projectAssetId: 'source-asset', assetId: 'source', contentHash: 'source-hash', mimeType: 'video/mp4', stableUrl: '/source', role: 'generated-video', expectedContentHash: 'source-hash' },
      }],
    }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, trimStartMs: 0, trimEndMs: 4000, revision: 7, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, { shotId: 'shot-a', mode: 'reshoot_shot' });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-a' }, graph);
  const application = buildShotRecoveryApplication(execution);
  const receipt = buildShotRecoveryDeliveryReceipt(application, {
    status: 'completed', projectId: 'project-a', candidateId: 'candidate-b', outputAssetId: 'output-b',
    stableUrl: '/output-b', contentHash: 'output-hash', mimeType: 'video/mp4',
    projectAssetRef: { projectId: 'project-a', projectAssetId: 'output-asset', assetId: 'output-b', stableUrl: '/output-b', contentHash: 'output-hash', mimeType: 'video/mp4', role: 'generated-video', expectedContentHash: 'output-hash' },
  }, { projectId: 'project-a' });
  const commit = compileShotRecoveryCommit(receipt, { projectId: 'project-a' });
  const preflight = compileShotRecoveryCommitPreflight(commit, graph, { projectId: 'project-a' });
  assert.equal(preflight.status, 'ready');
  assert.equal(preflight.shot.revision, 2);
  assert.equal(preflight.timelineActions[0].expectedRevision, 7);
  assert.match(preflight.preflightHash, /^[a-f0-9]{64}$/);

  assert.throws(() => compileShotRecoveryCommitPreflight(commit, {
    ...graph,
    shots: [{ ...graph.shots[0], revision: 3 }],
  }, { projectId: 'project-a' }), error => error.code === 'SHOT_RECOVERY_STALE');
  assert.throws(() => compileShotRecoveryCommitPreflight(commit, {
    ...graph,
    timelineClips: [{ ...graph.timelineClips[0], revision: 8 }],
  }, { projectId: 'project-a' }), error => error.code === 'SHOT_RECOVERY_STALE');
});

function stableValueForTest(value) {
  if (Array.isArray(value)) return `[${value.map(stableValueForTest).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableValueForTest(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
test('reshoot range preserves untouched ranges with a bounded window', () => {
  const timedWorkbench = {
    ...workbench,
    shots: [
      { id: 'shot-b', position: 1, selectedCandidateId: 'candidate-b', revision: 3 },
      { id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000 },
    ],
  };
  const plan = buildShotRecoveryPlan(timedWorkbench, {
    shotId: 'shot-a', mode: 'reshoot_range', rangeStartMs: 1000, rangeEndMs: 2500,
  });
  assert.equal(plan.mode, 'reshoot_range');
  assert.deepEqual(plan.edit, {
    operation: 'reshoot', strategy: 'preserve_untouched_ranges', sourceDurationMs: 4000,
    extensionMs: 0, targetDurationMs: 4000, region: null,
    range: { startMs: 1000, endMs: 2500 }, fallbackToWholeShot: false,
  });
  assert.strictEqual(assertShotRecoveryPlanIntegrity(plan), plan);

  for (const bad of [
    { rangeStartMs: -1, rangeEndMs: 1000 },
    { rangeStartMs: 2000, rangeEndMs: 2000 },
    { rangeStartMs: 3000, rangeEndMs: 5000 },
    { rangeStartMs: 0, rangeEndMs: 400 },
    {},
  ]) {
    assert.throws(() => buildShotRecoveryPlan(timedWorkbench, { shotId: 'shot-a', mode: 'reshoot_range', ...bad }),
      error => error.code === 'SHOT_RECOVERY_INVALID');
  }
  assert.throws(() => buildShotRecoveryPlan(workbench, {
    shotId: 'shot-a', mode: 'reshoot_range', rangeStartMs: 0, rangeEndMs: 1000,
  }), error => error.code === 'SHOT_RECOVERY_INVALID');

  const whole = buildShotRecoveryPlan(timedWorkbench, {
    shotId: 'shot-a', mode: 'reshoot_range', rangeStartMs: 0, rangeEndMs: 4000,
  });
  assert.equal(whole.edit.fallbackToWholeShot, true);
});

test('reshoot range compiles through the existing reshoot execution path', () => {
  const graph = {
    shots: [{
      id: 'shot-a', position: 0, selectedCandidateId: 'candidate-a', revision: 2, durationMs: 4000,
      candidates: [{
        id: 'candidate-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/api/video/assets/video-a',
        projectAssetRefStatus: 'verified',
        projectAssetRef: { projectId: 'project-a', projectAssetId: 'project-asset-a', assetId: 'video-a', contentHash: 'video-hash', mimeType: 'video/mp4', stableUrl: '/api/video/assets/video-a' },
      }],
    }],
    timelineClips: [{ id: 'clip-a', shotId: 'shot-a', candidateId: 'candidate-a', position: 0, trimStartMs: 0, trimEndMs: 4000, muted: false, revision: 1, status: 'active' }],
  };
  const plan = buildShotRecoveryPlan(graph, {
    shotId: 'shot-a', mode: 'reshoot_range', rangeStartMs: 1500, rangeEndMs: 3000,
  });
  const execution = compileShotRecoveryExecution({ ...plan, id: 'plan-range' }, graph);
  assert.equal(execution.planId, 'plan-range');
  assert.equal(execution.providerSubmission, false);
  assert.equal(execution.billingMutation, false);
  assert.match(execution.executionHash, /^[a-f0-9]{64}$/);
  const application = buildShotRecoveryApplication(execution, graph);
  assert.ok(application);
});
