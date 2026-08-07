import test from 'node:test';
import assert from 'node:assert/strict';

import { compileCampaignBible } from '../server/ecommerceEngine/campaignBible.mjs';

test('retains the selected direction title while applying the editable second-step brief', () => {
  const bible = compileCampaignBible({
    id: 'premium-minimal',
    title: 'Premium minimal',
    brief: 'Soft studio restraint',
    objective: 'premium conversion',
    audience: 'design-conscious buyers',
    visualKeywords: [' clean ', 'luxury', 'clean'],
    palette: [' #f5f0eb ', '#333333'],
    lighting: 'softbox',
    composition: 'centered product',
    backgroundLanguage: 'warm white',
    typographyIntent: 'quiet editorial',
    copyTone: 'confident',
    consistencyLocks: ['soft shadow'],
    prohibitedStyles: ['neon'],
  }, {
    title: 'An invented title',
    editableBrief: 'Keep the product hero and leave copy room.',
  });

  assert.equal(bible.directionId, 'premium-minimal');
  assert.equal(bible.title, 'Premium minimal');
  assert.equal(bible.editableBrief, 'Keep the product hero and leave copy room.');
  assert.equal(bible.commercialObjective, 'premium conversion');
  assert.deepEqual(bible.visualKeywords, ['clean', 'luxury']);
  assert.deepEqual(bible.palette, ['#f5f0eb', '#333333']);
  assert.equal(Object.hasOwn(bible, 'role'), false);
});

test('uses custom colors as an immutable palette and adds an explicit palette consistency lock', () => {
  const colors = [' #1155cc ', '#ffffff', '#1155cc'];
  const bible = compileCampaignBible({
    id: 'tech',
    title: 'Precision tech',
    palette: ['#000000'],
    consistencyLocks: ['lighting: cool', 'palette: #1155cc, #ffffff'],
  }, { customColors: colors });

  assert.deepEqual(bible.palette, ['#1155cc', '#ffffff']);
  assert.ok(bible.consistencyLocks.includes('palette: #1155cc, #ffffff'));
  assert.equal(bible.consistencyLocks.filter((lock) => lock === 'palette: #1155cc, #ffffff').length, 1);
  assert.deepEqual(colors, [' #1155cc ', '#ffffff', '#1155cc']);
});

test('replaces every existing palette or color consistency lock for custom colors', () => {
  const bible = compileCampaignBible({
    consistencyLocks: [
      'lighting: cool studio',
      'palette: #000000',
      'colors: muted neutrals',
      'color consistency: avoid warm tones',
    ],
  }, { customColors: ['#1155cc', '#ffffff'] });

  assert.deepEqual(bible.consistencyLocks, [
    'lighting: cool studio',
    'palette: #1155cc, #ffffff',
  ]);
});

test('honors an empty own editable brief override and otherwise falls back to the direction', () => {
  const direction = { brief: 'Keep the product centered.' };

  assert.equal(compileCampaignBible(direction, { editableBrief: '' }).editableBrief, '');
  assert.equal(compileCampaignBible(direction, { editable_brief: '' }).editableBrief, '');
  assert.equal(compileCampaignBible(direction, {}).editableBrief, 'Keep the product centered.');
});

test('returns defensive normalized data without inherited or prototype-polluting fields', () => {
  const direction = JSON.parse(`{
    "id":" editorial ",
    "title":" Editorial ",
    "visualKeywords":[" bold ","bold", ""],
    "referenceAssetIds":[" ref-1 ","ref-1"],
    "__proto__":{"polluted":true}
  }`);
  const overrides = Object.create({ editableBrief: 'inherited brief', referenceAssetIds: ['inherited'] });
  overrides.editableBrief = '  Real editable brief  ';
  overrides.referenceAssetIds = [' ref-2 ', 'ref-2'];
  overrides.constructor = 'unsafe';

  const first = compileCampaignBible(direction, overrides);
  const second = compileCampaignBible(direction, overrides);
  first.visualKeywords.push('mutated');
  first.referenceAssetIds.push('mutated');

  assert.equal(first.directionId, 'editorial');
  assert.equal(first.editableBrief, 'Real editable brief');
  assert.deepEqual(second.visualKeywords, ['bold']);
  assert.deepEqual(second.referenceAssetIds, ['ref-2']);
  assert.equal(Object.hasOwn(second, '__proto__'), false);
  assert.equal({}.polluted, undefined);
});

test('compiles the concrete second-step strategy and shot manifest into the shared campaign bible', () => {
  const direction = {
    schema_version: 1,
    id: 'craft-proof',
    title: '材质结构与品质证明',
    execution_guide: '整套围绕可验证材质与结构证据展开。',
    commercial_objective: '建立品质信任并降低决策风险',
    audience: '关注做工和耐用性的理性用户',
    visual_system: {
      palette: ['#F2F1EE', '#282A2D'],
      lighting: '侧向商业光，保留真实材质变化',
      composition: '整体商品与局部证据交替',
      camera_language: '整体视角结合证据安全的材质微距',
      background_language: '低饱和中性背景',
      typography_intent: '证据标题与短标签分层',
      information_density: '中等',
      mood: '严谨、稳定',
      copy_tone: '证据化、克制',
    },
    product_strategy: {
      hero_focus: '可见材质、边缘与结构关系',
      angle_plan: '整体识别和细节镜头交替',
      interaction_plan: '只呈现已确认组件关系',
      scenario_plan: '品质检视与真实使用环境结合',
    },
    deliverables: [{
      role: 'main_text',
      label: '商品主图',
      count: 1,
      ratio: '1:1',
      group_strategy: '先建立商品身份，再证明品质',
      shots: [{
        index: 0,
        label: '品质证明主图',
        purpose: '用可见材质和做工建立信任',
        visual_execution: '整体商品结合一处可验证细节',
        variation_key: 'proof-hero',
        depends_on: ['product_truth', 'campaign_bible'],
      }],
    }],
    risk_guards: ['不得虚构内部结构', '不得改变商品颜色和比例'],
    consistency_locks: ['商品身份一致', '主视觉光线一致'],
  };

  const first = compileCampaignBible(direction);
  const second = compileCampaignBible(direction);
  first.productStrategy.heroFocus = 'mutated';
  first.deliverables[0].shots[0].label = 'mutated';
  first.riskGuards.push('mutated');

  assert.equal(second.schemaVersion, 2);
  assert.equal(second.editableBrief, '整套围绕可验证材质与结构证据展开。');
  assert.equal(second.lighting, '侧向商业光，保留真实材质变化');
  assert.equal(second.composition, '整体商品与局部证据交替');
  assert.equal(second.cameraLanguage, '整体视角结合证据安全的材质微距');
  assert.equal(second.backgroundLanguage, '低饱和中性背景');
  assert.equal(second.copyTone, '证据化、克制');
  assert.deepEqual(second.productStrategy, {
    heroFocus: '可见材质、边缘与结构关系',
    anglePlan: '整体识别和细节镜头交替',
    interactionPlan: '只呈现已确认组件关系',
    scenarioPlan: '品质检视与真实使用环境结合',
  });
  assert.deepEqual(second.deliverables, [{
    role: 'main_text',
    label: '商品主图',
    count: 1,
    ratio: '1:1',
    groupStrategy: '先建立商品身份，再证明品质',
    shots: [{
      index: 0,
      label: '品质证明主图',
      purpose: '用可见材质和做工建立信任',
      visualExecution: '整体商品结合一处可验证细节',
      variationKey: 'proof-hero',
      dependsOn: ['product_truth', 'campaign_bible'],
    }],
  }]);
  assert.deepEqual(second.riskGuards, ['不得虚构内部结构', '不得改变商品颜色和比例']);
  assert.deepEqual(second.consistencyLocks, ['商品身份一致', '主视觉光线一致']);
});

test('nested visual system takes precedence over legacy flat fields without accepting inherited plan data', () => {
  const inherited = {
    product_strategy: { hero_focus: 'inherited' },
    deliverables: [{ role: 'main_text', count: 9 }],
  };
  const direction = Object.create(inherited);
  direction.lighting = 'legacy light';
  direction.visual_system = { lighting: 'nested light', palette: ['#111111'] };

  const bible = compileCampaignBible(direction);
  assert.equal(bible.lighting, 'nested light');
  assert.deepEqual(bible.palette, ['#111111']);
  assert.deepEqual(bible.productStrategy, {
    heroFocus: '',
    anglePlan: '',
    interactionPlan: '',
    scenarioPlan: '',
  });
  assert.deepEqual(bible.deliverables, []);
});

test('preserves creative attempt and route identity in the campaign bible', () => {
  const route = {
    id: 'spec-comparison-grid',
    sellingThesis: '规格差异与决策效率',
    sceneFamily: '统一背景的规格对照',
    composition: '模块网格与等尺度对比',
    cameraLanguage: '一致机位配局部放大',
    proofStrategy: '并列呈现已确认尺寸材质和规格',
  };
  const bible = compileCampaignBible({
    creative_attempt_id: 'attempt-42',
    creative_route: route,
    route_fingerprint: 'fingerprint-42',
    route_rationale: '针对多规格商品提高决策效率',
    route_difference: '改为规格网格对比',
  });

  assert.equal(bible.creativeAttemptId, 'attempt-42');
  assert.equal(bible.routeFingerprint, 'fingerprint-42');
  assert.deepEqual(bible.creativeRoute, route);
  assert.equal(bible.routeRationale, '针对多规格商品提高决策效率');
  assert.equal(bible.routeDifference, '改为规格网格对比');
});
