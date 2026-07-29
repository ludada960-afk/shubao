import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGAL_IMAGE_SIZES, validateGenerationSize } from '../server/ecommerceEngine/modelCatalog.mjs';
import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { validatePlanContract } from '../server/ecommerceEngine/planContract.mjs';
import { suiteSemanticKey } from '../server/ecommerceEngine/suiteDiversity.mjs';

const LEGAL_SIZES = new Set(Object.values(LEGAL_IMAGE_SIZES).flatMap(Object.values));

function productTruth(overrides = {}) {
  return {
    category: '数码3C',
    productName: 'Nova Hub',
    sourceAssetIds: ['product-front', 'product-side'],
    confirmedFacts: {
      model: { value: 'NH-42', source: 'user' },
      ports: { value: 'USB-C × 2', source: 'user' },
      width: { value: '120 mm', source: 'user' },
    },
    uncertainFacts: [{ name: 'weight', value: '80 g', source: 'vision' }],
    ...overrides,
  };
}

const campaignBible = {
  directionId: 'clean-tech',
  title: 'Clean tech',
  confirmed: true,
  referenceAssetIds: ['style-board'],
};

function factValues(item) {
  return item.requiredFacts.map((fact) => `${fact.name}:${fact.value}`);
}

test('plans 3C parameter content from confirmed user facts only', () => {
  const plan = buildAssetPlan({ productTruth: productTruth(), campaignBible, platform: 'taobao' });
  const parameters = plan.find((item) => item.role === 'detail_slice_parameters');

  assert.ok(parameters);
  assert.equal(parameters.generationMode, 'deterministic_overlay');
  assert.deepEqual(factValues(parameters), [
    'model:NH-42',
    'ports:USB-C × 2',
    'width:120 mm',
  ]);
  assert.deepEqual(parameters.productAssetIds, ['product-front', 'product-side']);
  assert.deepEqual(parameters.styleReferenceIds, ['style-board']);
  assert.equal(factValues(parameters).some((fact) => fact.includes('80 g')), false);
});

test('food plans exclude certification and QC without a real proof asset', () => {
  const plan = buildAssetPlan({
    productTruth: productTruth({
      category: '食品饮料',
      confirmedFacts: {
        flavor: { value: '海盐焦糖', source: 'user' },
        certification: { value: '有机认证', source: 'user' },
      },
    }),
    campaignBible,
    platform: 'jd',
  });

  assert.equal(plan.some((item) => item.role === 'detail_slice_qc'), false);
  assert.equal(plan.some((item) => factValues(item).some((fact) => fact.includes('certification'))), false);
});

test('plans exactly one SKU item per valid user SKU variant and preserves its fields', () => {
  const plan = buildAssetPlan({
    productTruth: productTruth(),
    campaignBible,
    platform: 'taobao',
    skus: [
      { color: '曜石黑', capacity: '256GB', count: 99 },
      { color: '月岩白', size: '标准版', dimLabel: '120 mm' },
      { color: '   ', count: 1 },
      { constructor: { polluted: true }, prototype: 'unsafe' },
    ],
  });
  const skuItems = plan.filter((item) => item.role === 'sku');

  assert.equal(skuItems.length, 2);
  assert.deepEqual(skuItems.map(factValues), [
    ['color:曜石黑', 'capacity:256GB', 'count:99'],
    ['color:月岩白', 'size:标准版', 'dimLabel:120 mm'],
  ]);
  assert.deepEqual(skuItems.map((item) => item.id), ['sku-1', 'sku-2']);
  const skuTargetIds = skuItems.flatMap(item => item.exportTargets.map(target => target.targetId));
  assert.equal(new Set(skuTargetIds).size, skuTargetIds.length);
});

test('adds QC slice only with a real proof asset and assigns that asset to the slice', () => {
  const withoutProof = buildAssetPlan({
    productTruth: productTruth({ category: '食品饮料' }), campaignBible, platform: 'jd', uploadedProofs: [],
  });
  const withProof = buildAssetPlan({
    productTruth: productTruth({ category: '食品饮料' }),
    campaignBible,
    platform: 'jd',
    uploadedProofs: [{ assetId: 'food-lab-report', type: 'test_report' }, { assetId: '__proto__' }],
  });

  assert.equal(withoutProof.some((item) => item.role === 'detail_slice_qc'), false);
  const qc = withProof.find((item) => item.role === 'detail_slice_qc');
  assert.ok(qc);
  assert.deepEqual(qc.productAssetIds, ['product-front', 'product-side']);
  assert.deepEqual(qc.proofAssetIds, ['food-lab-report']);
  assert.ok(withProof.filter((item) => item !== qc).every((item) => item.proofAssetIds.length === 0));
  assert.deepEqual(factValues(qc), ['proofAssetId:food-lab-report']);
});

test('applies sizing overrides per matching role with legal generation dimensions and separate exports', () => {
  const plan = buildAssetPlan({
    productTruth: productTruth(),
    campaignBible,
    platform: 'taobao',
    sizing: {
      smart: false,
      images: [
        { key: 'detail', ratio: '4:3' },
        { key: 'main_text', ratio: '3:4' },
      ],
    },
  });
  const details = plan.filter((item) => item.role.startsWith('detail_slice_') && item.role !== 'detail_slice_parameters');
  const main = plan.find((item) => item.role === 'main_text');
  const whiteBackground = plan.find((item) => item.role === 'white_background');

  assert.ok(details.length >= 4 && details.length <= 7);
  assert.equal(main.ratio, '3:4');
  assert.equal(whiteBackground.ratio, '1:1');
  assert.ok(details.every((item) => item.ratio === '4:3'));
  for (const item of plan) {
    assert.ok(LEGAL_SIZES.has(item.generationSize));
    assert.equal(validateGenerationSize(item.generationSize), true);
    assert.ok(item.exportTargets.length > 0);
    assert.ok(item.exportTargets.every(target => /^et_[a-f0-9]{64}$/.test(target.targetId)));
    assert.ok(item.exportTargets.every(target => /^\d{4}\.\d{2}(?:\.\d{2})?$/.test(target.policyVersion)));
    assert.ok(item.exportTargets.every(target => /^[a-f0-9]{64}$/.test(target.fingerprint)));
    assert.equal(item.exportTargets.some((target) => `${target.width}x${target.height}` === item.generationSize), false);
  }
});

test('prefers exact sizing roles over generic aliases regardless of input order', () => {
  const plan = buildAssetPlan({
    productTruth: productTruth({ category: '食品饮料' }),
    campaignBible,
    platform: 'taobao',
    sizing: {
      smart: false,
      images: [
        { key: 'detail', ratio: '4:3' },
        { role: 'detail_slice_package', ratio: '1:1' },
        { key: 'white_bg', ratio: '3:4' },
        { role: 'white_background', ratio: '1:1' },
      ],
    },
  });

  assert.equal(plan.find((item) => item.role === 'detail_slice_package').ratio, '1:1');
  assert.equal(plan.find((item) => item.role === 'detail_slice_flavor').ratio, '4:3');
  assert.equal(plan.find((item) => item.role === 'white_background').ratio, '1:1');
});

test('plans explicit main roles independently and is invariant to sizing order', () => {
  const mainSelections = [
    { key: 'main_text', ratio: '1:1' },
    { key: 'main_3x4', ratio: '3:4' },
  ];
  const build = (images) => buildAssetPlan({
    productTruth: productTruth(),
    campaignBible,
    platform: 'taobao',
    sizing: { smart: false, images },
  });
  const snapshot = (plan) => plan
    .filter((item) => ['main', 'main_text', 'main_3x4'].includes(item.role))
    .map(({ id, role, ratio, generationSize, exportTargets }) => ({ id, role, ratio, generationSize, exportTargets }));

  const first = snapshot(build(mainSelections));
  const reversed = snapshot(build([...mainSelections].reverse()));
  const smart = snapshot(build([]));

  assert.deepEqual(first, reversed);
  assert.deepEqual(first.map((item) => item.role), ['main_3x4', 'main_text']);
  assert.deepEqual(first.map((item) => item.id), ['main-3x4', 'main-text']);
  assert.deepEqual(first.map((item) => item.ratio), ['3:4', '1:1']);
  assert.deepEqual(first.map((item) => item.generationSize), ['1536x2048', '2048x2048']);
  assert.deepEqual(smart.map((item) => item.role), ['main']);
});

test('honors configured counts including transparent assets and expands deterministic unique IDs', () => {
  const input = {
    productTruth: productTruth(),
    campaignBible,
    platform: 'taobao',
    sizing: {
      resolution: '4K',
      smart: false,
      images: [
        { key: 'white_bg', count: 2, ratio: '1:1' },
        { key: 'main_text', count: 2, ratio: '1:1' },
        { key: 'main_3x4', count: 1, ratio: '9:16' },
        { key: 'transparent', count: 2, ratio: '1:1' },
        { key: 'detail', count: 6, ratio: '3:4' },
        { key: 'poster', count: 9, ratio: '3:4' },
      ],
    },
  };
  const first = buildAssetPlan(input);
  const second = buildAssetPlan(input);
  const roleCount = role => first.filter(item => item.role === role).length;

  assert.equal(roleCount('white_background'), 2);
  assert.equal(roleCount('main_text'), 2);
  assert.equal(roleCount('main_3x4'), 1);
  assert.equal(roleCount('transparent'), 2);
  assert.equal(first.filter(item => item.role.startsWith('detail_slice_')).length, 6);
  assert.equal(first.length, 13);
  assert.equal(first.some(item => item.role === 'poster'), false);
  assert.equal(new Set(first.map(item => item.id)).size, first.length);
  const targetIds = first.flatMap(item => item.exportTargets.map(target => target.targetId));
  assert.equal(new Set(targetIds).size, targetIds.length);
  assert.ok(first
    .filter(item => item.role === 'transparent')
    .every(item => item.exportTargets.length > 0
      && item.exportTargets.every(target => target.format === 'png')
      && item.styleReferenceIds.length === 0));
  assert.equal(first.find(item => item.role === 'main_3x4').generationSize, '2160x3840');
  assert.ok(first.every(item => item.communicationGoal));
  assert.equal(new Set(first.map(item => item.communicationGoal.toLowerCase())).size, first.length);
  assert.equal(new Set(first.map(suiteSemanticKey)).size, first.length);
  assert.equal(validatePlanContract(first), first);
  assert.deepEqual(first, second);
});

test('assigns repeated hero images distinct commercial shot duties', () => {
  const plan = buildAssetPlan({
    productTruth: productTruth(),
    campaignBible,
    platform: 'taobao',
    sizing: {
      images: [
        { key: 'main_text', count: 3, ratio: '1:1' },
        { key: 'detail', count: 0, ratio: '3:4' },
      ],
    },
  });
  const heroes = plan.filter(item => item.role === 'main_text');

  assert.equal(heroes.length, 3);
  assert.equal(new Set(heroes.map(item => item.purpose)).size, 3);
  assert.match(heroes[0].purpose, /identity|recognition/i);
  assert.match(heroes[1].purpose, /benefit|feature/i);
  assert.match(heroes[2].purpose, /usage|scene|scale/i);
});

test('frontend category aliases use the same asset strategy as canonical categories', () => {
  const aliases = [
    ['3C数码', '数码3C'],
    ['家居日用', '家居生活'],
    ['服饰鞋包', '服饰穿搭'],
  ];

  for (const [alias, canonical] of aliases) {
    const aliased = buildAssetPlan({
      productTruth: productTruth({ category: alias }),
      campaignBible,
      platform: 'taobao',
    });
    const expected = buildAssetPlan({
      productTruth: productTruth({ category: canonical }),
      campaignBible,
      platform: 'taobao',
    });
    assert.deepEqual(
      aliased.map(item => [item.role, item.shotIntent.type]),
      expected.map(item => [item.role, item.shotIntent.type]),
    );
  }
});

test('normalizes prototype-sensitive inputs and returns deterministic stable item IDs', () => {
  const inherited = { sourceAssetIds: ['inherited-product'], referenceAssetIds: ['inherited-style'] };
  const unsafeTruth = Object.assign(Object.create(inherited), productTruth({ sourceAssetIds: ['product-front'] }));
  const unsafeBible = Object.assign(Object.create(inherited), campaignBible);
  const input = {
    productTruth: unsafeTruth,
    campaignBible: unsafeBible,
    platform: 'taobao',
    uploadedProofs: ['proof-2', { assetId: 'proof-1' }, { assetId: 'constructor' }],
  };

  const first = buildAssetPlan(input);
  const second = buildAssetPlan(input);

  assert.deepEqual(first, second);
  assert.equal(first.some((item) => item.productAssetIds.includes('inherited-product')), false);
  assert.equal(first.some((item) => item.styleReferenceIds.includes('inherited-style')), false);
  assert.equal(first.some((item) => item.productAssetIds.includes('constructor')), false);
  assert.deepEqual(first.map((item) => item.id), [...first.map((item) => item.id)].sort());
});
