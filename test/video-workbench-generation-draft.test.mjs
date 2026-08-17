import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoWorkbenchPlan, videoWorkbenchPlanFingerprint } from '../server/videoWorkbenchPlan.mjs';
import { buildVideoWorkbenchGenerationDraft } from '../server/videoWorkbenchGenerationDraft.mjs';

function fixture() {
  return {
    project: { id: 'project-1' },
    assets: [{
      id: 'asset-1',
      kind: 'product',
      name: 'lamp',
      status: 'approved',
      approvedVersionId: 'version-1',
      versions: [{ id: 'version-1', sourceProjectAssetId: 'source-asset-1', stableUrl: 'https://private.invalid/media' }],
    }],
    shots: [{
      id: 'shot-1',
      position: 0,
      purpose: 'hero reveal',
      durationMs: 8000,
      prompt: 'A premium product reveal',
      bindings: [{ assetId: 'asset-1', assetVersionId: 'version-1', role: 'subject' }],
    }],
  };
}

function readyPlan(workbench) {
  const plan = buildVideoWorkbenchPlan(workbench, { productId: 'seedance_standard', mode: 'smart', resolution: '720p', generateAudio: true });
  assert.equal(plan.status, 'ready');
  return plan;
}

test('generation draft preserves approved references without exposing media URLs or mutating billing', () => {
  const workbench = fixture();
  const plan = readyPlan(workbench);
  const planHash = videoWorkbenchPlanFingerprint(plan);
  const draft = buildVideoWorkbenchGenerationDraft(workbench, plan, { planHash, approvalHash: planHash });

  assert.equal(draft.providerSubmission, false);
  assert.equal(draft.billingMutation, false);
  assert.equal(draft.requiresMainGeneration, true);
  assert.equal(draft.shots[0].references[0].sourceProjectAssetId, 'source-asset-1');
  assert.equal('stableUrl' in draft.shots[0].references[0], false);
  assert.equal(draft.planHash, planHash);
});

test('generation draft rejects stale approval before compiling', () => {
  const workbench = fixture();
  const plan = readyPlan(workbench);
  const planHash = videoWorkbenchPlanFingerprint(plan);

  assert.throws(
    () => buildVideoWorkbenchGenerationDraft(workbench, plan, { planHash, approvalHash: '0'.repeat(64) }),
    error => error.code === 'VIDEO_PLAN_APPROVAL_REQUIRED',
  );
});

test('generation draft rejects bindings that are no longer approved', () => {
  const workbench = fixture();
  const plan = readyPlan(workbench);
  const planHash = videoWorkbenchPlanFingerprint(plan);
  workbench.assets[0].approvedVersionId = 'version-old';

  assert.throws(
    () => buildVideoWorkbenchGenerationDraft(workbench, plan, { planHash, approvalHash: planHash }),
    error => error.code === 'ASSET_NOT_APPROVED',
  );
});
