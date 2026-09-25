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

/* ── ① 间距阶梯：4pt 栅格上的 6 个语义档，不多不少 ── */
test('间距阶梯全部落在 4pt 栅格上，且只有 6 档', () => {
  const values = Object.values(SPACING);
  assert.deepEqual(values, [...values].sort((a, b) => a - b), '阶梯必须单调递增');
  assert.equal(new Set(values).size, values.length, '不得有重复档位');
  for (const v of values) {
    assert.equal(v % 4, 0, `间距 ${v} 不在 4pt 栅格上`);
  }
  assert.deepEqual(SPACING, { sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24 });
  /* 改造前是 1/2/3/5/6/10/14 这类 4 的倍数以外的碎档 → 必须消失 */
  for (const stale of [1, 2, 3, 5, 6, 10, 14]) {
    assert.ok(!values.includes(stale), `不得再出现碎档 ${stale}px（「挤在一块」的来源）`);
  }
});

/* ── ② 字号层级：4 档，且不再出现 9/10px 小字 ── */
test('字号只有 4 档，最小 11px（用户批注「清晰度这些模块做得特别小」）', () => {
  const sizes = Object.values(FONT_SIZE);
  /* 批 BK：分组标题 13 → **14**（用户：「标题你可以加粗，再大一点用黑色」）——
     档位仍是 4 档、最小仍 11px，主次关系（标题 > 字段标签 > 辅助）没变。 */
  assert.deepEqual(sizes, [14, 12, 12, 11]);
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
  assert.equal(resolvePanelWidth(392), 360, '392-32=360 恰好等于下限');
  assert.equal(resolvePanelWidth(380), 348, '可用宽度小于下限时吃满可用宽度，绝不超过视口');
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

test('面板内边距与分区间距取自统一间距来源（依 D6 + V3 规范；旧值 24/16 已废弃）', () => {
  /* ── 口径变更依据（b 类：规范被 D 决策与 V3 取代，非私自放宽）──
     依据文档：docs/design/40-decisions.md **D6**「圆角只有 4 档…」
               与 40-decisions.md **D2/D7**（面板内分组用留白 + 分组标题）
     依据实现：src/styles/design-tokens-v3.css（V3 token，唯一取值来源）

     旧断言（本文件早期版本）为「24 内边距 / 16 分区间距」——那是
     panelVisualLanguage.SPACING 时代的取值。V3 落地后，间距唯一权威上移到
     design-tokens-v3.css，现行数值为：
       面板内边距 --sb-panel-padding = 20px（原 24）
       分组间距   --sb-group-gap     = 20px（原 16）
       字段间距   --sb-field-gap     = 8px
     故旧值 24/16 **已废弃**，本断言改为校验**现行规范的实际数值**，
     而不是「存在即可」——后者无法防止数值被悄悄改坏。 */
  const spec = read('src/pages/Home/ec/panelVisualLanguage.js');
  assert.ok(spec.includes('panelBodyStyle'), '规范必须导出面板根样式');
  assert.ok(spec.includes('sectionStyle'), '规范必须导出分组样式');

  const tokens = read('src/styles/design-tokens-v3.css');
  /** 解析 token 值（支持 var() 别名两级）。 */
  const def = n => (tokens.match(new RegExp(n.replace(/-/g, '\\-') + ':\\s*([^;]+);')) || [])[1];
  const resolve = n => {
    const v = def(n);
    if (!v) return null;
    const alias = v.match(/var\((--[\w-]+)\)/);
    if (!alias) return v.trim();
    const inner = def(alias[1]);
    return inner ? inner.trim() : null;
  };

  /* 现行规范数值（依 D6 与 V3）：面板内边距 20、分组间距 20、字段间距 8 */
  assert.ok(def('--sb-panel-padding'), 'token 层必须提供面板内边距');
  assert.ok(def('--sb-group-gap'), 'token 层必须提供分组间距');
  assert.ok(def('--sb-field-gap'), 'token 层必须提供字段间距');
  assert.equal(
    def('--sb-panel-padding') === 'var(--sb-space-5)' ? resolve('--sb-space-5') : resolve('--sb-panel-padding'),
    '20px',
    '面板内边距必须为 20px（D6 + V3 规范；旧值 24 已废弃）',
  );
  assert.equal(
    def('--sb-group-gap') === 'var(--sb-space-5)' ? resolve('--sb-space-5') : resolve('--sb-group-gap'),
    '20px',
    '分组间距必须为 20px（D6 + V3 规范；旧值 16 已废弃）',
  );
  assert.equal(
    def('--sb-field-gap') === 'var(--sb-space-2)' ? resolve('--sb-space-2') : resolve('--sb-field-gap'),
    '8px',
    '字段间距必须为 8px（标签↔控件，用户要求 ≥8）',
  );

  for (const panel of ['GenSettingsPanel', 'ParamsPanel', 'CopyPanel', 'SkuPanel', 'SizingPanel']) {
    const source = read('src/pages/Home/ec/' + panel + '.jsx');
    const usesToken = /--sb-(panel-padding|group-gap|field-gap|space-\d)/.test(source);
    const usesSpec = source.includes('panelVisualLanguage.js');
    assert.ok(
      usesToken || usesSpec,
      panel + ' 必须消费统一间距来源（--sb-* token 或 panelVisualLanguage 规范），而不是自带一套字号/间距',
    );
  }
});
