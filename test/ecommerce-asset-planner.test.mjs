import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGAL_IMAGE_SIZES, validateGenerationSize } from '../server/ecommerceEngine/modelCatalog.mjs';
import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';

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
  assert.deepEqual(qc.productAssetIds, ['product-front', 'product-side', 'food-lab-report']);
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
  const main = plan.find((item) => item.role === 'main');
  const whiteBackground = plan.find((item) => item.role === 'white_background');

  assert.ok(details.length >= 4 && details.length <= 7);
  assert.equal(main.ratio, '3:4');
  assert.equal(whiteBackground.ratio, '1:1');
  assert.ok(details.every((item) => item.ratio === '4:3'));
  for (const item of plan) {
    assert.ok(LEGAL_SIZES.has(item.generationSize));
    assert.equal(validateGenerationSize(item.generationSize), true);
    assert.ok(item.exportTargets.length > 0);
    assert.equal(item.exportTargets.some((target) => `${target.width}x${target.height}` === item.generationSize), false);
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
