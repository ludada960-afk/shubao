// test/home-panel-resizable-inputs.test.mjs
// 2026-09-15 用户批注①（子项 3 / 图3-图4）：
//   「这些输入区都特别小……我觉得每一个输入框右下角还是得有一个可以拉伸的按钮，
//    可以拉长当前这个框的高度，但这样就得往下面再做一些适配」
//   「内容规范这边也是一样，输入框没有拉动按钮，而且这个面板做得特别宽……
//    你这些面板最好宽度都是统一的」
//
// 本测试锁死：所有面板的多行输入都挂统一拉伸手柄；手柄逻辑真正改高度且被夹逼；
// 六个面板宽度统一；面板内控件点击区 ≥32px。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveResizedHeight, CONTROL_HEIGHT, PANEL_WIDTH } from '../src/pages/Home/ec/panelVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const PANELS = ['CopyPanel', 'ParamsPanel', 'SkuPanel', 'GenerationConstraintsPanel'];
const STATIC_PANELS = ['GenSettingsPanel', 'SizingPanel'];

/* ── ① 每个多行输入框都挂右下角拉伸手柄 ── */
test('所有含多行输入的面板都使用统一的 ResizableTextarea（右下角手柄）', () => {
  for (const name of PANELS) {
    const src = read(`src/pages/Home/ec/${name}.jsx`);
    assert.ok(src.includes('ResizableTextarea'), name + ' 必须使用统一的可拉伸多行输入框');
    assert.ok(!/<textarea\b/.test(src), name + ' 不得再直接用裸 <textarea>（那样没有拉伸手柄）');
    assert.ok(!/resize:\s*'vertical'/.test(src), name + ' 不得依赖 CSS resize（会被 flex 覆写，即「一拉就截断」）');
  }
});

test('ResizableTextarea 有真实手柄且不依赖 CSS resize', () => {
  const src = read('src/pages/Home/ec/ResizableTextarea.jsx');
  assert.ok(src.includes('rsz-textarea-handle'), '手柄元素存在');
  assert.ok(src.includes('onPointerDown') && src.includes('onPointerMove') && src.includes('onPointerUp'), '手柄走 pointer 事件');
  assert.ok(src.includes("resize:none") || src.includes("resize: 'none'"), '原生 resize 必须关闭（真拉伸由手柄接管）');
  assert.ok(src.includes('setPointerCapture'), '指针移出元素后仍要跟随');
  /* 样式必须写在真实存在的 css 文件里 —— 回归护栏：曾把 jsx 内容误写进 .css，
     导致样式完全没加载、手柄宽度为 0、拖拽无任何效果。 */
  const css = read('src/pages/Home/ec/resizable-textarea.css');
  assert.ok(css.trimStart().startsWith('/*'), '.css 必须是纯样式（不得混入 jsx）');
  assert.ok(css.includes('.rsz-textarea-handle'), '.css 必须定义手柄样式');
  assert.ok(css.includes('cursor: ns-resize'), '手柄必须给出纵向可拖拽的光标暗示');
  assert.ok(!css.includes('import React'), '.css 不得包含 React import');
});

/* ── ② 手柄真正改高度，且被夹逼（不截断） ── */
test('手柄拖拽真正改高度（不是改一个会被 flex 覆写的值）', () => {
  const src = read('src/pages/Home/ec/ResizableTextarea.jsx');
  assert.ok(src.includes('setHeight('), '拖拽必须写回受控 state');
  assert.ok(src.includes('height: \'var(--rsz-height)\''), '文本域高度绑定到受控变量');
  assert.ok(src.includes('resolveResizedHeight'), '必须走规范的夹逼函数');
});

test('拉伸上限不越过容器可视区，超出时内部滚动（用户批注「一拉就截断」）', () => {
  const src = read('src/pages/Home/ec/ResizableTextarea.jsx');
  assert.ok(src.includes('overflowY: \'auto\''), '到顶后必须内部滚动，而不是被裁断');
  assert.ok(src.includes('available'), '必须接收容器可用高度');
  /* 可用高度参与夹逼 */
  assert.equal(resolveResizedHeight({ startHeight: 100, deltaY: 9999, minHeight: 72, maxHeight: 320, available: 200 }), 200);
  assert.equal(resolveResizedHeight({ startHeight: 100, deltaY: 9999, minHeight: 72, maxHeight: 320, available: 5000 }), 320);
});

test('EcMode 把面板可视区可用高度传给各面板（这就是「往下面做的适配」）', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.ok(ecMode.includes('textareaAvailable'), 'EcMode 必须计算并上报输入框可用高度');
  const passed = [...ecMode.matchAll(/available=\{panelPos\.textareaAvailable\}/g)];
  assert.ok(passed.length >= 3, '内容规范/商品信息/SKU 等面板都要收到 available（实测 ' + passed.length + ' 处）');
});

/* ── ③ 面板宽度统一 ── */
test('六个面板宽度统一 480px（实测值，非推断）', () => {
  assert.equal(PANEL_WIDTH.standard, 480);
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.ok(!ecMode.includes('copy: 620'), '内容规范面板不得再是 620（用户批注「做得特别宽」）');
  assert.ok(!ecMode.includes('sku: 540'), 'SKU 面板不得再是 540');
  assert.ok(!ecMode.includes('settings: 460'), '生成设置面板不得再是 460');
});

/* ── ④ 控件点击区 ≥32px ── */
test('面板内可点击控件的点击区统一 ≥32px（用户批注「输入区都特别小」）', () => {
  assert.equal(CONTROL_HEIGHT.compact, 32, '紧凑档必须是 32px（点击区下限）');
  for (const name of PANELS.concat(STATIC_PANELS)) {
    const src = read(`src/pages/Home/ec/${name}.jsx`);
    /* 只检查「可点击控件」的写死高度：按钮/可点行必须 ≥32。
       纯视觉指示器（勾选框 20×20、色块内圆点等）不计入 —— 它们的点击目标
       由父级可点行承担（实测整行 minHeight 48px 且带 onClick）。 */
    const controlLines = src.split('\n').filter(line => (
      /cursor:\s*'pointer'/.test(line) || /<button/.test(line) || /role="checkbox"/.test(line)
    ));
    for (const line of controlLines) {
      const h = [...line.matchAll(/height:\s*(\d{2,3})\b/g)].map(m => Number(m[1]));
      for (const v of h) assert.ok(v >= 32, `${name} 的可点击控件出现小于 32px 的高度 ${v}px`);
    }
  }
});

test('整行可点的列表项：点击目标 ≥32px 而不是只点小勾选框', () => {
  const src = read('src/pages/Home/ec/SizingPanel.jsx');
  assert.ok(/minHeight:\s*48/.test(src), '图片类型行必须 ≥48px 可点');
  assert.ok(src.includes('aria-checked={checked}'), '整行作为 checkbox 暴露给无障碍树');
  assert.ok(src.includes('onClick={() => toggleType(typeDef.key)}'), '整行承载切换逻辑');
  assert.ok(src.includes('aria-hidden="true"'), '视觉勾选框不再单独承担点击');
});
