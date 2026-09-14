// test/home-panel-visual-language.test.mjs
// 2026-09-15 用户批注：「没有视觉逻辑、小气、主次不分、像硬塞进来的」
//   「你需要一套统一的视觉语言（间距阶梯/字号层级/控件高度/圆角/面板宽度），
//    然后六个面板都按它执行——不要逐个瞎调。」
//
// 本测试锁死规范本身，以及六个面板是否真的在消费规范（而不是各写各的魔法数字）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SPACING,
  FONT_SIZE,
  CONTROL_HEIGHT,
  RADIUS,
  PANEL_WIDTH,
  PANEL_WIDTH_TABLE,
  TEXTAREA_RESIZE,
  resolvePanelWidth,
  resolveResizedHeight,
} from '../src/pages/Home/ec/panelVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* ── ① 间距阶梯：8pt 栅格，只允许一个 4 的半档 ── */
test('间距阶梯是 8pt 栅格（唯一半档为 4，其余全是 8 的倍数）', () => {
  const values = Object.values(SPACING);
  assert.deepEqual(values, [...values].sort((a, b) => a - b), '阶梯必须单调递增');
  assert.equal(new Set(values).size, values.length, '不得有重复档位');
  for (const v of values) {
    assert.ok(v === 4 || v % 8 === 0, `间距 ${v} 既不是 4 也不是 8 的倍数`);
  }
  assert.deepEqual(SPACING, { sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24 });
});

/* ── ② 字号层级：4 档，且不再出现 9/10px 小字 ── */
test('字号只有 4 档，最小 11px（用户批注「清晰度这些模块做得特别小」）', () => {
  const sizes = Object.values(FONT_SIZE);
  assert.deepEqual(sizes, [13, 12, 12, 11]);
  assert.ok(Math.min(...sizes) >= 11, '不得再出现 9px/10px 的不可读小字');
  assert.equal(FONT_SIZE.groupTitle > FONT_SIZE.fieldLabel, true, '分组标题必须大于字段标签（主次分明）');
  assert.equal(FONT_SIZE.fieldLabel > FONT_SIZE.helper, true, '字段标签必须大于辅助说明');
});

/* ── ③ 控件高度：点击区 ≥32px ── */
test('控件高度三档且全部 ≥32px（点击区下限）', () => {
  assert.deepEqual(CONTROL_HEIGHT, { compact: 32, base: 36, large: 40 });
  for (const h of Object.values(CONTROL_HEIGHT)) assert.ok(h >= 32, `控件高度 ${h} 小于 32px 点击区下限`);
  assert.ok(CONTROL_HEIGHT.base >= 36, '标准输入框 ≥36px，不再用 26/30px 的小控件');
});

/* ── ④ 圆角三档 ── */
test('圆角只有三档：控件 8 / 卡片 12 / 面板 20', () => {
  assert.deepEqual(RADIUS, { control: 8, card: 12, panel: 20 });
});

/* ── ⑤ 面板宽度统一在 [360, 560] ── */
test('六个面板宽度统一为 480（口径 ≥360 且 ≤560）', () => {
  assert.equal(PANEL_WIDTH.standard, 480);
  assert.ok(PANEL_WIDTH.standard >= 360 && PANEL_WIDTH.standard <= 560);
  for (const [key, w] of Object.entries(PANEL_WIDTH_TABLE)) {
    assert.equal(w, PANEL_WIDTH.standard, key + ' 面板宽度必须与统一值一致');
  }
  assert.equal(Object.keys(PANEL_WIDTH_TABLE).length, 5, '五个浮层面板（技能库是弹窗，不计入）');
});

test('窄屏兜底：可用宽度吃紧时收窄，绝不横向溢出', () => {
  assert.equal(resolvePanelWidth(1440), 480, '宽屏用统一 480');
  assert.equal(resolvePanelWidth(600), 480, '扣除 32px 后仍够 480');
  assert.equal(resolvePanelWidth(512), 480, '512-32=480 恰好等于统一值');
  assert.equal(resolvePanelWidth(500), 468, '500-32=468，夹在 [360,480] 内取可用值');
  assert.equal(resolvePanelWidth(400), 368, '400-32=368 ≥360，用可用值');
  assert.equal(resolvePanelWidth(380), 360, '348 <360 时夹到下限 360，仍 ≤ 视口-32');
  assert.equal(resolvePanelWidth(320), 288, '极窄屏吃满可用宽度，不强行撑到 360 造成横向滚动');
  assert.equal(resolvePanelWidth(0), 480, '未知视口回落到统一值');
});

/* ── ⑥ 多行输入框拉伸：受控高度夹逼 ── */
test('拉伸高度同时受下限与上限约束，永不越界', () => {
  const base = { minHeight: 72, maxHeight: 320 };
  assert.equal(resolveResizedHeight({ ...base, startHeight: 100, deltaY: 50 }), 150);
  assert.equal(resolveResizedHeight({ ...base, startHeight: 100, deltaY: -500 }), 72, '向上拉不小于下限');
  assert.equal(resolveResizedHeight({ ...base, startHeight: 100, deltaY: 5000 }), 320, '向下拉不超过上限');
  assert.equal(resolveResizedHeight({ ...base, startHeight: 100, deltaY: 200 }), 300);
});

test('容器可视区剩余空间才是真上限（用户批注「一拉就直接往下面截断了」）', () => {
  const base = { minHeight: 72, maxHeight: 320 };
  assert.equal(
    resolveResizedHeight({ ...base, startHeight: 100, deltaY: 5000, available: 210 }),
    210,
    '可用高度小于配置上限时，以可用高度为上限，避免被容器底部截断',
  );
  assert.equal(
    resolveResizedHeight({ ...base, startHeight: 100, deltaY: 5000, available: 12 }),
    72,
    '可用高度比下限还小时保底到下限（内部滚动兜底，不塌成 0）',
  );
  assert.ok(TEXTAREA_RESIZE.bottomSafeGap >= 16, '上限计算必须为面板底部留 ≥16px 呼吸');
  assert.equal(TEXTAREA_RESIZE.handleSize, 12, '右下角拉伸手柄抓取区 12×12');
});

/* ── ⑦ 六个面板必须消费规范，不许再各写各的魔法数字 ── */
test('EcMode 的面板宽度从规范模块读取，不再硬编码 460/480/540/520/620', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.ok(ecMode.includes("from './ec/panelVisualLanguage.js'"), 'EcMode 必须引入统一规范');
  assert.ok(ecMode.includes('resolvePanelWidth('), '面板宽度必须走 resolvePanelWidth（窄屏兜底）');
  for (const stale of ['sizing: 480', 'sku: 540', 'style: 520', 'params: 520', 'copy: 620', 'settings: 460']) {
    assert.ok(!ecMode.includes(stale), '仍残留写死宽度：' + stale);
  }
  /* 两处定位映射（openPanel / repositionPanel）都必须走同一个解析函数 */
  const calls = [...ecMode.matchAll(/resolvePanelWidth\(/g)];
  assert.ok(calls.length >= 2, '两处面板定位都要走统一宽度解析');
});

test('面板内边距与分区间距取自间距阶梯（24 内边距 / 16 分区间距）', () => {
  const spec = read('src/pages/Home/ec/panelVisualLanguage.js');
  assert.ok(spec.includes('panelBodyStyle'), '规范必须导出面板根样式');
  assert.ok(spec.includes('sectionStyle'), '规范必须导出分组样式');
  for (const panel of ['GenSettingsPanel', 'ParamsPanel', 'CopyPanel', 'SkuPanel', 'SizingPanel']) {
    const source = read('src/pages/Home/ec/' + panel + '.jsx');
    assert.ok(
      source.includes("panelVisualLanguage.js"),
      panel + ' 必须消费统一视觉语言规范，而不是自带一套字号/间距',
    );
  }
});
