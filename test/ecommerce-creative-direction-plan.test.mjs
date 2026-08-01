import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeCreativeDirectionPlans,
} from '../server/ecommerceEngine/creativeDirectionPlan.mjs';

const requestedImages = [
  { key: 'white_bg', label: '白底图', count: 1, ratio: '1:1' },
  { key: 'main_text', label: '商品主图', count: 3, ratio: '1:1' },
  { key: 'transparent', label: '透明素材', count: 1, ratio: '1:1' },
  { key: 'detail', label: '详情图', count: 5, ratio: '3:4' },
];

function normalize(rawDirections = []) {
  return normalizeCreativeDirectionPlans(rawDirections, {
    requestedImages,
    productName: '便携焖烧杯',
    category: '家居日用',
    platform: '淘宝',
    userPrompt: '突出保温、便携和食品接触质感',
  });
}

test('always returns four complete and commercially distinct directions', () => {
  const plans = normalize([
    {
      id: 'trust',
      title: '材质信任',
      commercial_objective: '建立耐用和安全感知',
      audience: '重视长期使用价值的家庭用户',
      visual_system: {
        composition: '结构证据与材质特写',
        background_language: '冷静的中性实验室背景',
      },
      product_strategy: {
        scenario_plan: '厨房收纳与通勤携带',
      },
    },
  ]);

  assert.equal(plans.length, 4);
  assert.equal(new Set(plans.map(plan => plan.id)).size, 4);
  assert.ok(plans.every(plan => plan.schema_version === 1));
  assert.ok(plans.every(plan => plan.title && plan.one_liner));
  assert.ok(plans.every(plan => plan.commercial_objective && plan.audience));
  assert.ok(plans.every(plan => plan.execution_guide));
  assert.ok(plans.every(plan => plan.visual_system.composition));
  assert.ok(plans.every(plan => plan.product_strategy.hero_focus));
  assert.ok(plans.every(plan => plan.risk_guards.length >= 2));

  const signatures = plans.map(plan => [
    plan.commercial_objective,
    plan.visual_system.composition,
    plan.product_strategy.scenario_plan,
  ].join('\u0000').toLowerCase());
  assert.equal(new Set(signatures).size, 4);
});

test('treats the requested suite configuration as authoritative for every direction', () => {
  const [plan] = normalize([{
    title: '模型试图修改数量',
    deliverables: [
      {
        role: 'main_text',
        label: '主图',
        count: 99,
        ratio: '9:16',
        shots: [{ label: '第一张' }],
      },
      {
        role: 'video',
        label: '视频',
        count: 8,
        ratio: '16:9',
      },
    ],
  }]);

  assert.deepEqual(plan.deliverables.map(group => ({
    role: group.role,
    label: group.label,
    count: group.count,
    ratio: group.ratio,
    shots: group.shots.length,
  })), [
    { role: 'white_background', label: '白底图', count: 1, ratio: '1:1', shots: 1 },
    { role: 'main_text', label: '商品主图', count: 3, ratio: '1:1', shots: 3 },
    { role: 'transparent', label: '透明素材', count: 1, ratio: '1:1', shots: 1 },
    { role: 'detail', label: '详情图', count: 5, ratio: '3:4', shots: 5 },
  ]);
  assert.equal(plan.deliverables.some(group => group.role === 'video'), false);
  assert.ok(plan.deliverables.every(group => group.shots.every((shot, index) => (
    shot.index === index
      && shot.label
      && shot.purpose
      && shot.visual_execution
      && shot.variation_key
      && shot.depends_on.length > 0
  ))));
});

test('normalizes legacy direction fields without mutating the source object', () => {
  const legacy = {
    id: ' warm-life ',
    title: ' 暖光餐桌日常 ',
    description: '在温暖餐桌环境中突出便携和安心使用。',
    visual_tone: [' 温暖 ', '生活感', '温暖'],
    colors: [' #fff4df ', '#8B5A2B', 'invalid'],
    image_plan: ['白底识别图', '通勤场景主图', '材质细节图'],
  };
  const snapshot = structuredClone(legacy);
  const [plan] = normalize([legacy]);

  assert.deepEqual(legacy, snapshot);
  assert.equal(plan.id, 'warm-life');
  assert.equal(plan.title, '暖光餐桌日常');
  assert.equal(plan.execution_guide, legacy.description);
  assert.deepEqual(plan.visual_tone, ['温暖', '生活感']);
  assert.deepEqual(plan.preview_colors, ['#FFF4DF', '#8B5A2B']);
  assert.equal(plan.deliverables.length, requestedImages.length);
});

test('replaces duplicate or incomplete model output with deterministic fallback strategies', () => {
  const duplicate = {
    title: '同一个方向',
    commercial_objective: '只做换色',
    visual_system: { composition: '商品居中' },
    product_strategy: { scenario_plan: '白色背景' },
  };
  const first = normalize([duplicate, structuredClone(duplicate), {}, null]);
  const second = normalize([duplicate, structuredClone(duplicate), {}, null]);

  assert.deepEqual(first, second);
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map(plan => plan.id)).size, 4);
  assert.equal(new Set(first.map(plan => plan.title)).size, 4);
});

test('returns defensive data and ignores prototype-polluting fields', () => {
  const raw = JSON.parse(`[{
    "id":"safe",
    "title":"安全方案",
    "visual_system":{"palette":["#112233"],"__proto__":{"polluted":true}},
    "product_strategy":{"hero_focus":"商品结构","constructor":{"polluted":true}},
    "deliverables":[{"role":"main_text","shots":[{"label":"主图","__proto__":{"polluted":true}}]}],
    "__proto__":{"polluted":true}
  }]`);
  const first = normalize(raw);
  const second = normalize(raw);

  first[0].visual_tone.push('mutated');
  first[0].deliverables[0].shots[0].depends_on.push('mutated');

  assert.equal({}.polluted, undefined);
  assert.equal(second[0].visual_tone.includes('mutated'), false);
  assert.equal(second[0].deliverables[0].shots[0].depends_on.includes('mutated'), false);
  assert.equal(Object.hasOwn(second[0], '__proto__'), false);
  assert.equal(Object.hasOwn(second[0].visual_system, '__proto__'), false);
});
