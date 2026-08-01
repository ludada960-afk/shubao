/**
 * directionUiModel 单元测试
 * 纯函数测试，不依赖浏览器环境
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDirectionColor,
  getReadableTextColor,
  getDirectionCardState,
  normalizeDirectionTags,
  isValidDirection,
  getDirectionEditState,
  shouldActivateDirection,
  getDirectionPlanSummary,
  getDirectionDeliverableGroups,
  getDirectionShotRows,
  summarizeDirectionDeliverables,
} from '../src/pages/Home/ec/components/directionUiModel.js';

test('normalizeDirectionColor - 应该返回有效的十六进制颜色', () => {
  assert.equal(normalizeDirectionColor('#7c3aed'), '#7c3aed');
  assert.equal(normalizeDirectionColor('#FFF'), '#fff');
  assert.equal(normalizeDirectionColor('7c3aed'), '#7c3aed');
});

test('normalizeDirectionColor - 应该处理 RGB 格式', () => {
  assert.equal(normalizeDirectionColor('rgb(124, 58, 237)'), '#7c3aed');
  assert.equal(normalizeDirectionColor('rgba(255, 255, 255, 0.5)'), '#ffffff');
});

test('normalizeDirectionColor - 应该对无效颜色返回回退值', () => {
  assert.equal(normalizeDirectionColor(null, '#ff0000'), '#ff0000');
  assert.equal(normalizeDirectionColor(undefined, '#00ff00'), '#00ff00');
  assert.equal(normalizeDirectionColor('', '#0000ff'), '#0000ff');
  assert.equal(normalizeDirectionColor('invalid', '#ffffff'), '#ffffff');
});

test('normalizeDirectionColor - 应该处理 3 位十六进制', () => {
  assert.equal(normalizeDirectionColor('#F0A'), '#f0a');
  assert.equal(normalizeDirectionColor('abc'), '#abc');
});

test('getReadableTextColor - 应该为亮色背景返回深色文字', () => {
  assert.equal(getReadableTextColor('#ffffff'), '#1a1a1a');
  assert.equal(getReadableTextColor('#ffffcc'), '#1a1a1a');
  assert.equal(getReadableTextColor('#eeeeee'), '#1a1a1a');
});

test('getReadableTextColor - 应该为暗色背景返回浅色文字', () => {
  assert.equal(getReadableTextColor('#000000'), '#ffffff');
  assert.equal(getReadableTextColor('#1a1a1a'), '#ffffff');
  assert.equal(getReadableTextColor('#7c3aed'), '#ffffff');
});

test('getReadableTextColor - 应该支持自定义回退颜色', () => {
  assert.equal(getReadableTextColor('#ffffff', '#333333', '#cccccc'), '#333333');
  assert.equal(getReadableTextColor('#000000', '#333333', '#cccccc'), '#cccccc');
});

test('getDirectionCardState - 应该返回完整的卡片状态', () => {
  const mockDirection = {
    id: 'dir-1',
    title: '测试方向',
    preview_colors: ['#7c3aed', '#ec4899', '#f59e0b'],
  };

  const state = getDirectionCardState({
    direction: mockDirection,
    selected: false,
    index: 0,
  });

  assert.equal(state.index, 0);
  assert.equal(state.selected, false);
  assert.ok(state.colors);
  assert.ok(state.styles);
  assert.ok(state.editableStyles);
});

test('getDirectionCardState - 选中状态应该有正确的样式', () => {
  const mockDirection = {
    id: 'dir-1',
    title: '测试方向',
    preview_colors: ['#7c3aed', '#ec4899', '#f59e0b'],
  };

  const state = getDirectionCardState({
    direction: mockDirection,
    selected: true,
    index: 1,
  });

  assert.equal(state.selected, true);
  assert.ok(state.styles.border.includes('#7c3aed'));
  assert.ok(state.styles.boxShadow.includes('7c3aed'));
});

test('getDirectionCardState - 未选中状态应该有默认样式', () => {
  const mockDirection = {
    id: 'dir-1',
    title: '测试方向',
    preview_colors: ['#7c3aed', '#ec4899', '#f59e0b'],
  };

  const state = getDirectionCardState({
    direction: mockDirection,
    selected: false,
    index: 2,
  });

  assert.equal(state.selected, false);
  assert.ok(state.styles.border.includes('rgba(0,0,0,0.06)'));
});

test('getDirectionCardState - 应该处理缺失的配色', () => {
  const state = getDirectionCardState({
    direction: { id: 'dir-2', title: '无配色' },
    selected: false,
    index: 0,
  });

  assert.equal(state.colors.primary, '#7c3aed');
  assert.equal(state.colors.secondary, '#a78bfa');
});

test('getDirectionCardState - 应该生成正确的渐变', () => {
  const mockDirection = {
    id: 'dir-1',
    title: '测试方向',
    preview_colors: ['#7c3aed', '#ec4899', '#f59e0b'],
  };

  const state = getDirectionCardState({
    direction: mockDirection,
    selected: false,
    index: 0,
  });

  assert.ok(state.styles.headerGradient.includes('linear-gradient'));
  assert.ok(state.styles.headerGradient.includes('#7c3aed'));
  assert.ok(state.styles.headerGradient.includes('#ec4899'));
});

test('getDirectionCardState - 浅色方案仍应使用清晰可见的选择强调色', () => {
  const state = getDirectionCardState({
    direction: {
      id: 'dir-light',
      title: '浅色方案',
      preview_colors: ['#ffffff', '#f5efe5', '#fffaf0'],
    },
    selected: true,
    index: 0,
  });

  assert.equal(state.colors.primary, '#7c3aed');
  assert.ok(state.styles.border.includes('#7c3aed'));
});

test('shouldActivateDirection - 编辑区域输入空格时不能触发方向选择', () => {
  assert.equal(shouldActivateDirection({ key: ' ', withinEditableArea: true }), false);
  assert.equal(shouldActivateDirection({ key: 'Enter', withinEditableArea: true }), false);
  assert.equal(shouldActivateDirection({ key: ' ', withinEditableArea: false }), true);
  assert.equal(shouldActivateDirection({ key: 'Enter', withinEditableArea: false }), true);
});

test('normalizeDirectionTags - 应该处理字符串标签', () => {
  assert.deepEqual(normalizeDirectionTags('简约·现代·高级'), ['简约', '现代', '高级']);
  assert.deepEqual(normalizeDirectionTags('清新,自然,舒适'), ['清新', '自然', '舒适']);
});

test('normalizeDirectionTags - 应该处理数组标签', () => {
  assert.deepEqual(normalizeDirectionTags(['简约', '现代', '高级']), ['简约', '现代', '高级']);
});

test('normalizeDirectionTags - 应该限制标签数量', () => {
  const tags = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(normalizeDirectionTags(tags, { maxCount: 3 }), ['a', 'b', 'c']);
});

test('normalizeDirectionTags - 应该处理空值', () => {
  assert.deepEqual(normalizeDirectionTags(null), []);
  assert.deepEqual(normalizeDirectionTags(undefined), []);
  assert.deepEqual(normalizeDirectionTags(''), []);
});

test('normalizeDirectionTags - 应该过滤空字符串', () => {
  assert.deepEqual(normalizeDirectionTags('a,,b, ,c'), ['a', 'b', 'c']);
});

test('isValidDirection - 应该验证有效的方向对象', () => {
  assert.equal(isValidDirection({ id: '1', title: '测试' }), true);
  assert.equal(isValidDirection({ id: 'abc', title: '方向', extra: 'data' }), true);
});

test('isValidDirection - 应该拒绝无效的方向对象', () => {
  assert.equal(isValidDirection(null), false);
  assert.equal(isValidDirection(undefined), false);
  assert.equal(isValidDirection({}), false);
  assert.equal(isValidDirection({ id: '1' }), false);
  assert.equal(isValidDirection({ title: '测试' }), false);
  assert.equal(isValidDirection('string'), false);
});

test('getDirectionEditState - 应该检测未更改状态', () => {
  const state = getDirectionEditState({
    description: '原始描述',
    originalDescription: '原始描述',
  });

  assert.equal(state.hasChanged, false);
  assert.equal(state.isEmpty, false);
  assert.equal(state.canSave, true);
});

test('getDirectionEditState - 应该检测已更改状态', () => {
  const state = getDirectionEditState({
    description: '修改后的描述',
    originalDescription: '原始描述',
  });

  assert.equal(state.hasChanged, true);
  assert.equal(state.isEmpty, false);
});

test('getDirectionEditState - 应该检测空状态', () => {
  const state = getDirectionEditState({
    description: '',
    originalDescription: '原始',
  });

  assert.equal(state.isEmpty, true);
  assert.equal(state.canSave, false);
});

test('getDirectionEditState - 应该计算字符数', () => {
  const state = getDirectionEditState({
    description: '测试文字',
    originalDescription: '',
  });

  assert.equal(state.charCount, 4);
});

test('getDirectionEditState - 应该检测超限状态', () => {
  const longText = 'a'.repeat(501);
  const state = getDirectionEditState({
    description: longText,
    originalDescription: '',
  });

  assert.equal(state.isOverLimit, true);
  assert.equal(state.canSave, false);
});

const concreteDirection = {
  commercial_objective: '提升首屏识别和核心卖点转化',
  audience: '正在比较同类商品的高意向用户',
  product_strategy: {
    hero_focus: '主体轮廓与可见材质',
    angle_plan: '主视角、轻侧视与局部细节交替',
    interaction_plan: '只展示来源图片可证明的使用关系',
    scenario_plan: '厨房台面与收纳场景',
  },
  deliverables: [
    {
      role: 'white_background',
      label: '白底首图',
      count: 1,
      ratio: '1:1',
      group_strategy: '先建立商品识别',
      shots: [{
        label: '标准识别白底图',
        purpose: '完整展示商品轮廓',
        visual_execution: '纯白背景，商品完整不裁切',
      }],
    },
    {
      role: 'main_text',
      label: '商品主图',
      count: 3,
      ratio: '1:1',
      group_strategy: '三张分别承担身份、利益和场景职责',
      shots: [
        { label: '商品识别主图', purpose: '建立身份', visual_execution: '清晰主视觉' },
        { label: '核心利益主图', purpose: '解释收益', visual_execution: '功能证据' },
        { label: '使用场景主图', purpose: '降低想象成本', visual_execution: '真实场景' },
      ],
    },
  ],
};

test('direction plan UI - 应把商业目标和商品执行策略整理为可读摘要', () => {
  assert.deepEqual(getDirectionPlanSummary(concreteDirection), {
    commercialObjective: '提升首屏识别和核心卖点转化',
    audience: '正在比较同类商品的高意向用户',
    strategyItems: [
      { key: 'hero_focus', label: '核心主张', value: '主体轮廓与可见材质' },
      { key: 'angle_plan', label: '视角计划', value: '主视角、轻侧视与局部细节交替' },
      { key: 'interaction_plan', label: '使用关系', value: '只展示来源图片可证明的使用关系' },
      { key: 'scenario_plan', label: '场景计划', value: '厨房台面与收纳场景' },
    ],
  });
});

test('direction plan UI - 应展示用户配置的完整套图摘要和组级职责', () => {
  assert.equal(summarizeDirectionDeliverables(concreteDirection), '1白底首图 / 3商品主图');
  assert.deepEqual(getDirectionDeliverableGroups(concreteDirection), [
    {
      role: 'white_background',
      label: '白底首图',
      count: 1,
      ratio: '1:1',
      strategy: '先建立商品识别',
    },
    {
      role: 'main_text',
      label: '商品主图',
      count: 3,
      ratio: '1:1',
      strategy: '三张分别承担身份、利益和场景职责',
    },
  ]);
});

test('direction plan UI - 应展开每张图的标题、职责、比例和执行要求', () => {
  const rows = getDirectionShotRows(concreteDirection);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {
    id: 'white_background-0',
    role: 'white_background',
    groupLabel: '白底首图',
    ratio: '1:1',
    index: 0,
    label: '标准识别白底图',
    purpose: '完整展示商品轮廓',
    visualExecution: '纯白背景，商品完整不裁切',
  });
  assert.equal(rows[3].label, '使用场景主图');
});

test('direction plan UI - 对畸形模型数据应安全降级且不显示虚假数量', () => {
  const malformed = {
    commercial_objective: 42,
    product_strategy: { hero_focus: '__proto__', scenario_plan: '  ' },
    deliverables: [
      { role: '__proto__', label: '<script>', count: 99, shots: [] },
      { role: 'detail', label: '详情图', count: 2, ratio: '3:4', shots: [{ label: '卖点页' }] },
    ],
  };
  assert.deepEqual(getDirectionPlanSummary(malformed), {
    commercialObjective: '',
    audience: '',
    strategyItems: [],
  });
  assert.equal(summarizeDirectionDeliverables(malformed), '2详情图');
  assert.equal(getDirectionShotRows(malformed).length, 1);
});
