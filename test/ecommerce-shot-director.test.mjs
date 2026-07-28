import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { compileAssetRequest } from '../server/ecommerceEngine/promptCompiler.mjs';
import { directShot } from '../server/ecommerceEngine/shotDirector.mjs';

function singleViewTruth(overrides = {}) {
  return {
    category: '数码3C',
    productName: 'Nova Hub',
    sourceAssetIds: ['product-front'],
    primaryColors: ['银色'],
    materials: ['铝合金'],
    components: [],
    confirmedFacts: {},
    forbiddenMutations: [
      'silhouette: preserve the exact enclosure',
      'component: invent no ports or controls',
    ],
    ...overrides,
  };
}

const campaignBible = {
  directionId: 'clean-tech',
  title: '精密科技',
  editableBrief: '保持商品识别度，并用不同信息目标完成一套图。',
  audience: '桌面数码用户',
  referenceAssetIds: [],
};

test('single-view smart suites receive distinct safe shot intents for every planned image', () => {
  const plan = buildAssetPlan({
    productTruth: singleViewTruth(),
    campaignBible,
    platform: '淘宝',
    sizing: {
      resolution: '2K',
      images: [
        { key: 'white_bg', count: 1, ratio: '1:1' },
        { key: 'main_text', count: 3, ratio: '1:1' },
        { key: 'transparent', count: 1, ratio: '1:1' },
        { key: 'detail', count: 5, ratio: '3:4' },
      ],
    },
  });

  assert.equal(plan.length, 10);
  assert.ok(plan.every(item => item.shotIntent));
  assert.ok(plan.every(item => item.layoutContract));
  assert.ok(plan.every(item => item.textLayerPlan));

  const heroes = plan.filter(item => item.role === 'main_text');
  assert.equal(heroes.length, 3);
  assert.equal(new Set(heroes.map(item => (
    `${item.shotIntent.type}:${item.shotIntent.camera.azimuth}:${item.shotIntent.interactionState}`
  ))).size, 3);

  const commercialDuties = plan
    .filter(item => !['white_background', 'transparent'].includes(item.role))
    .map(item => `${item.shotIntent.type}:${item.shotIntent.camera.azimuth}:${item.shotIntent.crop}`);
  assert.equal(new Set(commercialDuties).size, commercialDuties.length);
  assert.ok(plan.every(item => item.shotIntent.forbiddenMutations.length > 0));
});

test('detail subroles map to distinct semantic shot types instead of all becoming material macros', () => {
  const cases = [
    ['detail_slice_feature', 'feature'],
    ['detail_slice_material', 'material_macro'],
    ['detail_slice_usage', 'usage_scale'],
    ['detail_slice_compatibility', 'usage_scale'],
    ['detail_slice_parameters', 'alternate_angle'],
    ['detail_slice_package', 'packaging'],
    ['detail_slice_structure', 'component_relationship'],
  ];

  for (const [role, requestedType] of cases) {
    const directed = directShot({ id: role, role, purpose: '' }, {
      productTruth: singleViewTruth(),
      itemIndex: 2,
    });
    assert.equal(directed.requestedType, requestedType, role);
  }
});

test('unsupported exploded or open-state requests fall back instead of inventing product internals', () => {
  const directed = directShot({
    id: 'detail-structure',
    role: 'detail_slice_structure',
    purpose: 'Show an exploded engineering structure.',
  }, {
    productTruth: singleViewTruth(),
    category: '数码3C',
    itemIndex: 4,
  });

  assert.equal(directed.evidenceTier, 'confirmed_only');
  assert.ok(directed.fallbackIntent);
  assert.notEqual(directed.interactionState, 'exploded');
  assert.match(directed.fallbackIntent.reason, /evidence|visible|confirmed/i);
  assert.match(directed.forbiddenMutations.join(' '), /internal|component|invent/i);
});

test('confirmed visible components may use a component-relationship shot without changing part count', () => {
  const directed = directShot({
    id: 'detail-structure',
    role: 'detail_slice_structure',
    purpose: 'Show the relationship between visible components.',
  }, {
    productTruth: singleViewTruth({
      sourceAssetIds: ['product-front', 'product-open'],
      components: ['主机', '可拆卸底座'],
      confirmedFacts: {
        openState: { value: '底座可拆卸', source: 'user' },
      },
    }),
    category: '数码3C',
    itemIndex: 4,
  });

  assert.equal(directed.type, 'component_relationship');
  assert.equal(directed.evidenceTier, 'conditional');
  assert.match(directed.requiredVisibleFeatures.join(' '), /主机|底座/);
  assert.match(directed.forbiddenMutations.join(' '), /count|数量|invent/i);
});

test('compiled provider prompts carry the exact shot, layout, and text-layer contracts', () => {
  const truth = singleViewTruth();
  const [item] = buildAssetPlan({
    productTruth: truth,
    campaignBible,
    platform: '淘宝',
    sizing: { images: [{ key: 'main_text', count: 1, ratio: '1:1' }] },
  });
  const request = compileAssetRequest({
    assetPlanItem: item,
    productTruth: truth,
    campaignBible,
    assets: {
      product: [{ assetId: 'product-front', url: '/api/generated-assets/product-front.png' }],
    },
  });

  assert.match(request.prompt, /"shotIntent"/);
  assert.match(request.prompt, /"camera"/);
  assert.match(request.prompt, /"layoutContract"/);
  assert.match(request.prompt, /"textLayerPlan"/);
  assert.match(request.prompt, /one complete independent image/i);
});
