import assert from 'node:assert/strict';
import test from 'node:test';

import { compileTypographySystem } from '../server/ecommerceEngine/typographyPolicy.mjs';
import {
  layoutContractFor,
  layoutRegionsOverlap,
  textLayerPlanFor,
  validateLayoutContract,
} from '../server/ecommerceEngine/layoutContracts.mjs';

test('premium skincare plans restrained licensed typography without claiming font assets are deployed', () => {
  const system = compileTypographySystem({
    category: '美妆护肤',
    priceBand: 'premium',
    language: 'zh-CN',
  });

  assert.equal(system.tone, 'premium');
  assert.match(system.displayFontId, /serif/i);
  assert.match(system.bodyFontId, /sans/i);
  assert.ok(system.fallbackFontIds.length > 0);
  assert.equal(system.fontAssetStatus, 'planned');
  assert.ok(system.fontRegistryPlan.every(record => record.commercialUse === true));
  assert.ok(system.fontRegistryPlan.every(record => record.deployed === false && record.sha256 === null));
  assert.ok(system.hierarchy.title.maxLines <= 2);
});

test('technical products keep numeric hierarchy clear while fashion and baby products use different tones', () => {
  const technology = compileTypographySystem({ category: '数码3C', language: 'zh-CN' });
  const fashion = compileTypographySystem({ category: '服饰穿搭', language: 'zh-CN' });
  const baby = compileTypographySystem({ category: '母婴用品', language: 'zh-CN' });

  assert.equal(technology.tone, 'technology');
  assert.notEqual(technology.displayFontId, fashion.displayFontId);
  assert.notEqual(fashion.tone, baby.tone);
  assert.equal(technology.tracking, 0);
  assert.equal(fashion.tracking, 0);
  assert.equal(baby.tracking, 0);
});

test('frontend category labels resolve to the same typography policy as canonical ecommerce categories', () => {
  const aliases = [
    ['3C数码', '数码3C'],
    ['家居日用', '家居生活'],
    ['服饰鞋包', '服饰穿搭'],
  ];

  for (const [alias, canonical] of aliases) {
    const aliased = compileTypographySystem({ category: alias, language: 'zh-CN' });
    const expected = compileTypographySystem({ category: canonical, language: 'zh-CN' });
    assert.equal(aliased.tone, expected.tone);
    assert.equal(aliased.displayFontId, expected.displayFontId);
  }
});

test('layout contracts give white, hero, usage, material, and parameter images different structures', () => {
  const items = [
    { id: 'white', role: 'white_background', shotIntent: { type: 'identity' } },
    { id: 'hero', role: 'main_text', shotIntent: { type: 'feature' } },
    { id: 'usage', role: 'detail_slice_usage', shotIntent: { type: 'usage_scale' } },
    { id: 'material', role: 'detail_slice_material', shotIntent: { type: 'material_macro' } },
    { id: 'parameters', role: 'detail_slice_parameters', shotIntent: { type: 'feature' } },
  ];
  const contracts = items.map(item => layoutContractFor(item, { platform: '淘宝' }));

  assert.equal(new Set(contracts.map(contract => contract.template)).size, contracts.length);
  assert.equal(contracts[0].textRegions.length, 0);
  assert.ok(contracts[1].productRegion.priority > contracts[1].textRegions[0].priority);
  assert.ok(contracts.every(contract => contract.maxMarketingTextBlocks <= 2));
  assert.ok(contracts.every(validateLayoutContract));
  assert.ok(contracts.every(contract => contract.textRegions.every(region => (
    !layoutRegionsOverlap(contract.productRegion, region)
  ))));
});

test('text plans reserve composition regions without claiming editable layers already exist', () => {
  const item = { id: 'hero', role: 'main_text', shotIntent: { type: 'feature' } };
  const layoutContract = layoutContractFor(item, { platform: '淘宝' });
  const plan = textLayerPlanFor(item, {
    layoutContract,
    typographySystem: compileTypographySystem({ category: '数码3C' }),
  });

  assert.equal(plan.mode, 'planned_text_regions');
  assert.equal(plan.editableLayersAvailable, false);
  assert.equal(plan.requiresComposition, true);
  assert.equal(plan.renderMarketingTextInImageModel, false);
});
