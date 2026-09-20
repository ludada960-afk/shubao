// test/video-model-menu-0912.test.mjs
// 2026-09-12 用户批注：① 模型图标是深色底，看着一团黑；② 模型弹层太矮，一次只看得到 2 个模型。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/pages/VideoStudio/VideoStudio.css', import.meta.url), 'utf8');

test('模型图标改为白底细边（彩色品牌标自带配色）', () => {
  const rule = css.match(/\.video-model-mark \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  /* 2026-09-14 §18 灰阶迁移：白底改用 --sb-neutral-0（值不变）。断言「解析后为白」。 */
  assert.match(rule[1], /background:\s*(#fff\b|var\(--sb-neutral-0\))/);
  assert.doesNotMatch(rule[1], /background: #343840/, '不得再用深色底');
  assert.doesNotMatch(css, /\.video-model-mark\.is-seedance \{ background: linear-gradient/, '渐变深底必须去掉');
});

test('模型弹层一次能看到 5 个以上（高度足够）且水平居中', () => {
  const rule = css.match(/\.video-inline-menu \{([^}]*)\}/);
  assert.ok(rule, '规则存在');
  assert.match(rule[1], /max-height: min\(58vh, 460px\)/);
  /* ═══ 2026-09-21 批 T：这条判据**被用户本轮原话推翻**（不是放宽，是改判）═══════════════════
     上一版（9-12）写的是「面板必须贴在触发按钮正上方：left: 0，不许 translateX(-50%)」，
     理由是"水平居中会让左侧被视口截断"。
     用户本轮原话（逐字）：
       「你现在这些张开的面板是会打架的。我点击这些按钮。他们向上张开面板就必须只能有一个张开，
        不能互相打架，明白吗？而且他们是**可以超出这些输入框的界限**的。你必须让这些向上张开的
        配置面板，他们要**居中于按钮的上方**。」
     ⇒ 新判据 = **居中于按钮上方** + **允许越出输入框边界**。
       截断的真实原因是当时它是 `.video-composer` 里的 absolute 元素、被祖先 overflow 裁掉；
       改成 position: fixed 之后居中不再会被裁（祖先链上无 transform/filter，已实测）。
     因此断言改成：定位走 fixed + 坐标由 JS 按按钮矩形居中算出（不在 CSS 里写 left: 0）。 */
  assert.match(rule[1], /position: fixed/, '必须走 fixed —— 只有这样才越得出输入框的边界');
  assert.doesNotMatch(rule[1], /left: 0/, '不再贴左缘展开（用户本轮要求居中于按钮上方）');
  const page = readFileSync(new URL('../src/pages/VideoStudio/index.jsx', import.meta.url), 'utf8');
  assert.match(page, /const positionModelMenu = useCallback/, '居中坐标必须由按钮矩形算出（positionModelMenu）');
  assert.match(page, /rect\.left \+ rect\.width \/ 2 - width \/ 2/, '居中算式：按钮中心 − 面板半宽');
  /* 互斥：模型菜单与配置面板不能同时展开（用户本轮：向上张开的面板只能有一个） */
  assert.match(page, /setInlineMenu\(null\);\s+\/\* 互斥：配置面板展开时收起模型菜单/, 'openPanel 必须收起模型菜单');
  assert.match(page, /setActivePanel\(null\);\s+\/\* 互斥：模型菜单展开时收起配置面板/, '开模型菜单必须收起配置面板');
});
