import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertExecutionCount,
  validatePlanContract,
} from '../server/ecommerceEngine/planContract.mjs';
import { suiteSemanticKey } from '../server/ecommerceEngine/suiteDiversity.mjs';

function planItem(id, overrides = {}) {
  return {
    id,
    role: 'main_text',
    purpose: `Commercial purpose for ${id}`,
    communicationGoal: `Commercial duty for ${id}`,
    riskLevel: 'low',
    shotIntent: {
      type: 'identity',
      camera: { azimuth: 12 },
      crop: 'complete product crop',
      interactionState: 'stationary',
      sceneFamily: 'studio_identity',
      evidenceTier: 'safe',
    },
    ...overrides,
  };
}

test('suite semantic key normalizes every contract dimension', () => {
  assert.equal(suiteSemanticKey(planItem('hero', {
    communicationGoal: '  Product Recognition ',
    shotIntent: {
      type: ' Identity ',
      camera: { azimuth: 12 },
      crop: ' Complete Product Crop ',
      interactionState: ' Stationary ',
      sceneFamily: ' Studio Identity ',
      evidenceTier: 'safe',
    },
  })), 'product recognition|identity|12|complete product crop|stationary|studio identity');
});

test('a suite cannot contain two items with the same commercial duty and shot intent', () => {
  const hero = planItem('hero');
  assert.throws(
    () => validatePlanContract([hero, { ...hero, id: 'hero-2' }]),
    /duplicate suite intent/i,
  );
});

test('plan contract rejects duplicate IDs and roles without unique commercial duties', () => {
  assert.throws(
    () => validatePlanContract([planItem('hero'), planItem('hero')]),
    /duplicate asset plan item id/i,
  );
  assert.throws(
    () => validatePlanContract([
      planItem('hero'),
      planItem('hero-2', {
        communicationGoal: 'Commercial duty for hero',
        shotIntent: {
          ...planItem('hero-2').shotIntent,
          type: 'usage_scale',
          camera: { azimuth: 34 },
          crop: 'environmental medium-wide crop',
          interactionState: 'credible in-use context',
          sceneFamily: 'lifestyle_context',
        },
      }),
    ]),
    /duplicate commercial duty/i,
  );
});

test('plan contract rejects collage intent and unsafe evidence tiers', () => {
  assert.throws(
    () => validatePlanContract([planItem('collage', { purpose: 'Four-panel contact sheet comparison' })]),
    /collage|contact sheet/i,
  );
  assert.throws(
    () => validatePlanContract([planItem('unsafe', {
      shotIntent: { ...planItem('unsafe').shotIntent, evidenceTier: 'unverified' },
    })]),
    /unsafe evidence tier/i,
  );
});

test('execution count requires one durable visible row and initial submission per plan item', () => {
  const plan = [planItem('main-1'), planItem('main-2'), planItem('main-3')];
  const diagnostics = assertExecutionCount({
    plan,
    assetRows: plan.map(item => ({ assetId: item.id })),
    providerSubmissions: plan.map(item => ({ assetId: item.id })),
  });

  assert.deepEqual(diagnostics, {
    planItems: 3,
    quoteUnits: 3,
    visibleAssetRows: 3,
    initialProviderSubmissions: 3,
    providerSubmissions: 3,
    providerRepairs: 0,
    submissionsByAsset: { 'main-1': 1, 'main-2': 1, 'main-3': 1 },
  });
  assert.throws(() => assertExecutionCount({
    plan,
    assetRows: [...plan.map(item => ({ assetId: item.id })), { assetId: 'hidden-candidate' }],
    providerSubmissions: plan.map(item => ({ assetId: item.id })),
  }), /visible asset row count mismatch/i);
});

test('execution count allows at most one provider-backed repair for the failed asset', () => {
  const plan = [planItem('main-1'), planItem('main-2')];
  const assetRows = plan.map(item => ({ assetId: item.id }));
  const repaired = assertExecutionCount({
    plan,
    assetRows,
    providerSubmissions: [
      { assetId: 'main-1' },
      { assetId: 'main-2' },
      { assetId: 'main-2' },
    ],
  });

  assert.equal(repaired.providerSubmissions, plan.length + 1);
  assert.equal(repaired.providerRepairs, 1);
  assert.deepEqual(repaired.submissionsByAsset, { 'main-1': 1, 'main-2': 2 });
  assert.throws(() => assertExecutionCount({
    plan,
    assetRows,
    providerSubmissions: [
      { assetId: 'main-1' },
      { assetId: 'main-2' },
      { assetId: 'main-2' },
      { assetId: 'main-2' },
    ],
  }), /more than one provider repair/i);
});
