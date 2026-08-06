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

test('returns one complete executable direction with a locked design system', () => {
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

  assert.equal(plans.length, 1);
  assert.ok(plans.every(plan => plan.schema_version === 1));
  assert.ok(plans.every(plan => plan.title && plan.one_liner));
  assert.ok(plans.every(plan => plan.commercial_objective && plan.audience));
  assert.ok(plans.every(plan => plan.execution_guide));
  assert.ok(plans.every(plan => plan.visual_system.composition));
  assert.ok(plans.every(plan => plan.product_strategy.hero_focus));
  assert.ok(plans.every(plan => plan.risk_guards.length >= 2));

  assert.equal(plans[0].overall_spec.locked, true);
  assert.equal(plans[0].overall_spec.palette.length, 3);
  assert.match(plans[0].overall_spec.product_fidelity, /商品外观/);
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

test('replaces incomplete model output with one deterministic fallback strategy', () => {
  const duplicate = {
    title: '同一个方向',
    commercial_objective: '只做换色',
    visual_system: { composition: '商品居中' },
    product_strategy: { scenario_plan: '白色背景' },
  };
  const first = normalize([duplicate, structuredClone(duplicate), {}, null]);
  const second = normalize([duplicate, structuredClone(duplicate), {}, null]);

  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0].deliverables.length, requestedImages.length);
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

test('writes merchant-facing shot briefs with distinct visual decisions', () => {
  const [plan] = normalizeCreativeDirectionPlans([{}], {
    productName: '不锈钢便携餐盒',
    category: '餐具',
    userPrompt: '突出密封、便携和日常使用',
    visualObservations: ['银色金属盒身和透明上盖'],
    requestedImages: [
      { key: 'main_text', label: '商品主图', count: 3, ratio: '1:1' },
      { key: 'detail', label: '详情图', count: 5, ratio: '3:4' },
    ],
  });
  const shots = plan.deliverables.flatMap(group => group.shots);
  const executions = shots.map(shot => shot.visual_execution);
  assert.equal(new Set(executions).size, executions.length);
  assert.ok(executions.every(value => /光|角度|场景|细节|结构|材质|拍|放大|好处|动作|组件|大小/.test(value)));
  assert.ok(executions.some(value => /使用场景|真实动作|生活/.test(value)));
  assert.ok(executions.some(value => /侧光|表面|边缘|质感/.test(value)));
  assert.ok(executions.every(value => !/继承“.*”的构图、光线和色彩系统/.test(value)));
});

test('builds a category-specific creative profile instead of reusing a generic type and copy rule', () => {
  const [wine] = normalizeCreativeDirectionPlans([{}], {
    productName: '赤霞珠干红葡萄酒',
    category: '红酒',
    userPrompt: '礼赠场景，突出年份感和高级感',
    visualObservations: ['深红色酒液和深色玻璃瓶'],
    requestedImages: [{ key: 'main_text', label: '商品主图', count: 2, ratio: '1:1' }],
  });
  const [doll] = normalizeCreativeDirectionPlans([{}], {
    productName: '毛绒安抚娃娃',
    category: '玩具娃娃',
    userPrompt: '送给学龄前孩子的礼物',
    visualObservations: ['柔软毛绒和圆润耳朵'],
    requestedImages: [{ key: 'main_text', label: '商品主图', count: 2, ratio: '1:1' }],
  });

  assert.equal(wine.product_creative_profile.id, 'red-wine');
  assert.match(wine.visual_system.typography_intent, /优雅|衬线/);
  assert.match(wine.visual_system.copy_tone, /克制|礼赠/);
  assert.match(wine.deliverables[0].shots[0].copy, /优雅|克制|礼赠/);

  assert.equal(doll.product_creative_profile.id, 'playful-doll');
  assert.match(doll.visual_system.typography_intent, /圆润|童趣/);
  assert.match(doll.visual_system.copy_tone, /亲切|轻快/);
  assert.notEqual(wine.visual_system.typography_intent, doll.visual_system.typography_intent);
});
