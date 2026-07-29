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

test('commercial duty normalization rejects ordinal suffixes and equivalent wording', () => {
  const alternateShot = {
    ...planItem('alternate').shotIntent,
    type: 'alternate_angle',
    camera: { azimuth: 48 },
    crop: 'complete exterior crop',
    sceneFamily: 'exterior_angle_study',
  };
  assert.throws(() => validatePlanContract([
    planItem('ordinal-1', { communicationGoal: 'Product recognition duty 1' }),
    planItem('ordinal-2', {
      communicationGoal: 'Product recognition duty 2',
      shotIntent: alternateShot,
    }),
  ]), /duplicate commercial duty/i);
  assert.throws(() => validatePlanContract([
    planItem('wording-1', { communicationGoal: 'Show the complete product for buyer identification' }),
    planItem('wording-2', {
      communicationGoal: 'Display the full item for customer recognition',
      shotIntent: alternateShot,
    }),
  ]), /duplicate commercial duty/i);
});

const PRESENTATION_ORDINAL_DUTY_PAIRS = [
  ['recognition variant ordinal', 'Product recognition variant 1', 'Product recognition variant 2'],
  ['hash ordinal', 'Product recognition #1', 'Product recognition #2'],
  ['parenthesized ordinal', 'Product recognition (1)', 'Product recognition (2)'],
  ['arbitrary English ordinal word', 'Product recognition image sixth', 'Product recognition image seventh'],
  ['hyphenated English ordinal word', 'Product recognition duty twenty-first', 'Product recognition duty twenty-second'],
  ['Chinese word ordinal', '商品识别第一张', '商品识别第二张'],
  ['Chinese Arabic ordinal', '商品识别第1张', '商品识别第2张'],
  ['Chinese plan marker', '商品识别方案六', '商品识别方案七'],
  ['Chinese image marker', '商品识别图6', '商品识别图7'],
];

for (const [label, firstDuty, secondDuty] of PRESENTATION_ORDINAL_DUTY_PAIRS) {
  test(`commercial duty normalization rejects ${label}`, () => {
    const alternateShot = {
      ...planItem('alternate').shotIntent,
      type: 'alternate_angle',
      camera: { azimuth: 48 },
      crop: 'complete exterior crop',
      sceneFamily: 'exterior_angle_study',
    };
    assert.throws(() => validatePlanContract([
      planItem('presentation-1', { communicationGoal: firstDuty }),
      planItem('presentation-2', {
        communicationGoal: secondDuty,
        shotIntent: alternateShot,
      }),
    ]), /duplicate commercial duty/i, `${firstDuty} and ${secondDuty}`);
  });
}

test('commercial duty normalization preserves numeric product facts', () => {
  const alternateShot = {
    ...planItem('alternate').shotIntent,
    type: 'alternate_angle',
    camera: { azimuth: 48 },
    crop: 'complete exterior crop',
    sceneFamily: 'exterior_angle_study',
  };
  const factualPairs = [
    ['Product recognition 1', 'Product recognition 2'],
    ['Show confirmed 24-hour runtime', 'Show confirmed 48-hour runtime'],
    ['Show confirmed 24 hours', 'Show confirmed 48 hours'],
    ['Show confirmed 500 ml', 'Show confirmed 750 ml'],
    ['Show confirmed 2L capacity', 'Show confirmed 3L capacity'],
    ['Show confirmed Size 2 fit', 'Show confirmed Size 3 fit'],
    ['Identify confirmed model X2', 'Identify confirmed model X3'],
    ['Identify confirmed model X 2', 'Identify confirmed model X 3'],
    ['Identify confirmed SKU 2', 'Identify confirmed SKU 3'],
    ['Identify confirmed version 2', 'Identify confirmed version 3'],
    ['展示确认的24小时续航', '展示确认的48小时续航'],
  ];

  for (const [firstDuty, secondDuty] of factualPairs) {
    const plan = [
      planItem('fact-1', { communicationGoal: firstDuty }),
      planItem('fact-2', {
        communicationGoal: secondDuty,
        shotIntent: alternateShot,
      }),
    ];
    assert.equal(validatePlanContract(plan), plan, `${firstDuty} and ${secondDuty}`);
  }
});

test('canonical commercial duty IDs reject duplicate duties regardless of shot metadata', () => {
  assert.throws(() => validatePlanContract([
    planItem('canonical-1', {
      commercialDutyId: 'main:product-recognition',
      communicationGoal: 'Establish immediate product recognition',
    }),
    planItem('canonical-2', {
      commercialDutyId: 'main:product-recognition',
      communicationGoal: 'Use a different composition and camera angle',
      shotIntent: {
        ...planItem('canonical-2').shotIntent,
        type: 'alternate_angle',
        camera: { azimuth: 64 },
        crop: 'environmental medium crop',
        interactionState: 'credible in-use context',
        sceneFamily: 'lifestyle_context',
      },
    }),
  ]), /duplicate commercial duty id/i);

  assert.throws(() => validatePlanContract([
    planItem('invalid-duty-id', { commercialDutyId: 'Main Duty #1' }),
  ]), /commercial duty id is invalid/i);
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
  assert.throws(
    () => validatePlanContract([planItem('candidate-grid', { communicationGoal: 'Render a candidate grid output' })]),
    /collage|contact sheet/i,
  );
  assert.throws(
    () => validatePlanContract([planItem('montage', { purpose: 'Deliver a product montage' })]),
    /collage|contact sheet/i,
  );
});

test('multi-panel product descriptions are not mistaken for collage output intent', () => {
  const appliance = planItem('appliance', {
    purpose: 'Single-view multi-panel appliance product hero',
    communicationGoal: 'Show the complete multi-panel appliance in one compliant hero view',
  });
  const plan = [appliance];

  assert.equal(validatePlanContract(plan), plan);
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
