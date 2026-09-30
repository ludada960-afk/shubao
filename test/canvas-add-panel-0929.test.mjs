import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveAnchoredRight } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   左侧「+」面板：小地图该隐藏 + 面板该居中于加号（批 CY-㉛）

   用户 2026-09-30 两条批注：
     ① 「你张开左边这个加号的面板的时候，你下面的这个功能栏的小地图。它不是会隐藏起来吗？
         那为什么你这个小地图的按钮还亮着呀？」
     ② 「你画布左边这个加号打开之后这块面板它似乎是有些偏下的，甚至是有点盖到了
         左下角的这个功能栏的。你应该让这个加号跟他张开的这个面板两者的关系是一个居中关系吧。」

   ① 的根因很具体：`floatingCanvasPanelOpen` 那份清单列的是 `addNodePanel`
     （双击空白弹的「添加节点」面板），而左侧「+」开的是**另一个**浮层 `addMenuOpen`
     （`CanvasAddMenu`，走 addMenuAnchor 定位）。两者名字像、长得像，清单只写了前者。
   ② 的根因：`resolveAnchoredRight` 的竖直口径是「顶对齐 + 放不下就上移」，
     面板高 728、锚点在 y=533 ⇒ 算出 top=228，比锚点高一大截看着就是"偏上"，
     底边还压到 y=956（贴近视口底 1000）。
   ══════════════════════════════════════════════════════════════════════════════ */

test('① 「+」打开的浮层必须计入「开浮层就收小地图」那份清单', () => {
  const start = index.indexOf('const floatingCanvasPanelOpen');
  assert.ok(start > 0, '必须能找到 floatingCanvasPanelOpen');
  const block = index.slice(start, start + 400);
  assert.match(block, /addMenuOpen/, 'addMenuOpen 必须在这份清单里 —— 漏了它，小地图在点「+」时照常亮着');
  // 旧的那些也必须还在，不能为了加一个把别的删了
  for (const key of ['addNodePanel', 'canvasContextPanel', 'taskLogOpen', 'layersPanelOpen', 'exportOpen', 'shortcutHelpOpen', 'watermarkPanelOpen']) {
    assert.ok(block.includes(key), `${key} 必须仍在清单里`);
  }
});

test('② resolveAnchoredRight 默认仍是「顶对齐」（旧行为一字未改）', () => {
  const anchor = { x: 18, y: 533, width: 40, height: 40, right: 58, bottom: 573 };
  const got = resolveAnchoredRight({ anchor, width: 286, height: 400, gap: 12, viewportWidth: 2000, viewportHeight: 1000 });
  assert.equal(got.top, 533, '不传 alignVertical 时就是顶对齐（派生菜单/图层面板依赖这个）');
});

test('③ alignVertical:"center" 时面板竖直居中于锚点', () => {
  const anchor = { x: 18, y: 533, width: 40, height: 40, right: 58, bottom: 573 };
  const height = 728;
  const got = resolveAnchoredRight({
    anchor, width: 286, height, gap: 12, viewportWidth: 2000, viewportHeight: 1000, alignVertical: 'center',
  });
  const anchorCy = anchor.y + anchor.height / 2;
  const panelCy = got.top + height / 2;
  assert.ok(Math.abs(panelCy - anchorCy) < 1,
    `面板中心 ${panelCy} 应等于加号中心 ${anchorCy}`);
});

test('④ 居中后仍要受「不得出屏」约束（面板比视口还高时不能顶出屏幕）', () => {
  const anchor = { x: 18, y: 100, width: 40, height: 40, right: 58, bottom: 140 };
  const height = 1600; // 比视口 1000 还高
  const got = resolveAnchoredRight({
    anchor, width: 286, height, gap: 12, viewportWidth: 2000, viewportHeight: 1000, alignVertical: 'center',
  });
  assert.ok(got.top >= 12, `不得小于 gutter，实际 ${got.top}`);
  assert.ok(got.top + height <= 1000 - 12 + height, '超出部分由 CSS overflow-y 滚动，不溢出屏幕');
});

test('⑤ 水平方向一字未改：仍然向右展开、绝不向左翻', () => {
  const anchor = { x: 18, y: 300, width: 40, height: 40, right: 58, bottom: 340 };
  const got = resolveAnchoredRight({ anchor, width: 286, height: 400, gap: 12, viewportWidth: 2000, viewportHeight: 1000 });
  assert.equal(got.left, 70, '左缘 = 锚点右缘 58 + gap 12');
  assert.equal(got.clampedRight, false);
});

test('⑥ 调用点必须显式要求居中（否则改了函数默认值也白改）', () => {
  assert.match(index, /alignVertical: 'center'/,
    '加号菜单的调用点必须显式传 alignVertical:"center"');
  // 且只在这一处加，别把派生菜单也改了
  const count = (index.match(/alignVertical: 'center'/g) || []).length;
  assert.equal(count, 1, `只允许在加号菜单这一处用 center（当前 ${count} 处）`);
});
