// test/canvas-blank-and-minimap-scrim-1001.test.mjs
// 批 CY-㊴（用户 2026-10-01 三张批注里可机械判定的两条）
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
const supCss = read('src/styles/canvas-supervisor.css');
const canvasCode = canvasCss.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 生成面板的提示语不许被压成 0 宽（0 宽 + normal 换行 = 逐字换行 = 一大片空白）', () => {
  /* 用户 10-01 原话：「那你视频生成下面为什么还是有大量空白呢」
     实测根因：footer 里那个提示语 span 是 `flex: 0 1 0`（**grow 是 0**），
     被压成 0 宽；另一条规则又给了 `white-space: normal` ⇒ 文字逐字换行，
     实测该 span **0 宽 × 136 高**，footer 整体 152 高。
     改后：`flex: 0 1 auto` + min-width 兜底，实测 102×10，footer 37 高。

     ⚠️ 判据的取法：`.ec-canvas-composer-footer > span` 在这个文件里有 **8 条**规则
     （层层覆盖），取"最后一条"会拿到只写 `order: 2` 的收尾规则 —— 那是判据的错。
     正确做法：**所有规则里都不许再出现 `flex: 0 1 0`**，且**设了 flex 的那些**里
     最后一条必须是 `0 1 auto`，并且必须有一条给了 min-width 兜底。 */
  const rules = canvasCode.match(/\.ec-canvas-composer-footer > span \{[^}]*\}/g) || [];
  assert.ok(rules.length, '找不到 .ec-canvas-composer-footer > span');
  for (const r of rules) {
    assert.doesNotMatch(r, /flex:\s*0 1 0\s*;/,
      '不得再出现 `flex: 0 1 0`（grow=0 ⇒ span 被压成 0 宽 ⇒ 逐字换行）');
  }
  const withFlex = rules.filter(r => /flex:/.test(r));
  assert.ok(withFlex.length, '至少要有一条设 flex');
  const lastFlex = withFlex[withFlex.length - 1];
  assert.match(lastFlex, /flex:\s*0 1 auto/,
    '设 flex 的规则里最后一条必须是 `0 1 auto`（basis 取内容宽度），实际：' + lastFlex.trim());
  assert.ok(rules.some(r => /min-width:\s*\d/.test(r)),
    '必须有一条给 min-width 兜底：宁可被压缩后省略，也不许逐字换行');
});

test('② 小地图必须把「被右侧面板遮住的那一段」画出来（用户连着三次反馈的就是这个）', () => {
  /* 事实先说清：实心框的**数值**一直是对的（框宽/画布宽两态都是 0.0409、宽高比精确匹配）。
     但用户三次说「小地图依然会被派生框遮住一部分」「素材图的右边为什么还是比较窄」
     「这个派生面板在你的小地图里依然是被遮蔽的元素呀」——
     他要的是：画布右边被面板盖住的那一段**在框里要看得见，并且看得出它是被遮住的**。
     ⚠️ 我前两次都把方向搞反了：先把实心框改窄，再给框外加压暗 ——
     那等于把「被遮住」画成了「窗外」，越修越像"框被切掉了"。
     ⇒ 现在：实心框 = 看得见的部分；紧接其右画一段**斜纹**的"被面板压住"，
       两段合起来正好是画布的完整宽度（实测 45.97 + 19.47 = 65.44）。 */
  const geo = read('src/pages/EcCanvas/canvasVisibleViewport.js');
  assert.match(geo, /coveredWidth/, '取数函数必须把「被遮住的宽度」一起报上来');
  assert.match(geo, /marginRight/, '被遮住的宽度来自面板让位的 margin-right');

  const panel = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
  assert.match(panel, /ec-canvas-minimap-covered/, '小地图必须渲染"被遮住"那一段');
  assert.match(panel, /coveredW > 0 &&/, '没有遮住时就不渲染（面板关着不该多一条）');

  const supCss = read('src/styles/canvas-supervisor.css');
  const cov = supCss.match(/\.ec-canvas-minimap-covered \{([^}]*)\}/);
  assert.ok(cov, '缺少 .ec-canvas-minimap-covered 样式');
  assert.match(cov[1], /repeating-linear-gradient/, '必须是斜纹/条纹 —— 一眼看得出"被遮住"');
  const canvas = supCss.match(/\.ec-canvas-minimap-canvas \{([^}]*)\}/);
  assert.ok(canvas, '找不到 .ec-canvas-minimap-canvas');
  assert.match(canvas[1], /overflow:\s*hidden/,
    '小地图画布必须 overflow:hidden —— 否则框外那圈巨大阴影会糊到卡片外面去');
});

test('③ 视窗框的数值判据不变（斜纹段是"加"出来的，不是把实心框改回去）', () => {
  /* 防止"为了画出被遮住的部分、把实心框又改回整宽"——那正是批 CY-㉚ 的老 bug。 */
  const geo = read('src/pages/EcCanvas/canvasGeometry.js');
  assert.match(geo, /getNodePortCenter/, '端口中心仍是几何真源');
  const vp = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
  assert.match(vp, /w:\s*\(stage\.width \/ safeScale\) \* scale/,
    '实心框宽度仍由 stage.width（**看得见**的画布宽）驱动');
  assert.match(vp, /\(coveredWidth \/ safeScale\) \* scale/,
    '斜纹段宽度才用 coveredWidth（被面板遮住的那部分）');
  assert.doesNotMatch(vp, /marginRight|margin-right/,
    '取宽度时不得直接参与 margin 减法（那是批 CY-㉚ 的根因）');
});
