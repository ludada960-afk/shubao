// test/canvas-right-panel-hint-1001.test.mjs
// 批 CY-㊴（2026-10-01）：右栏提示的 + 号、派生卡片的描述
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const panel = read('src/pages/EcCanvas/components/EcCanvasRightPanel.jsx');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const deriveCss = read('src/styles/canvas-derive-menu.css');
const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');

test('① 右栏提示里的 + 号必须是画布那一个图标，不是文本字符', () => {
  /* 用户原话：「这个+号的图标明显是歪的，向下歪了呀，
     你不是应该跟真正画布上的+号图标一致才对嘛」
     根因：它是文本字符 `<strong>+</strong>`，坐在文字基线上；
     画布上那个是 30px 圆钮里的 SVG（DerivePort 用的 Plus）。两者不是同一种东西。 */
  const hint = panel.match(/<p className="ec-canvas-right-panel__menu-hint">[\s\S]*?<\/p>/);
  assert.ok(hint, '找不到那段提示');
  assert.doesNotMatch(hint[0], /<strong>\+<\/strong>/, '不许再用文本字符 +');
  assert.match(hint[0], /className="ec-canvas-node-port is-hint"/,
    '必须复用画布端口的类名（同一个外观来源）');
  assert.match(hint[0], /<Plus size=\{16\} \/>/, '必须用与画布端口同一个 SVG 图标');
  assert.match(panel, /import \{[^}]*\bPlus\b[^}]*\} from 'lucide-react'/, 'Plus 图标要显式导入');
  assert.match(canvasCss, /\.ec-canvas-node-port\.is-hint\s*\{[^}]*pointer-events:\s*none/,
    '提示里的 + 不可点（它只是个示意，不是真端口）');
  assert.match(canvasCss, /\.ec-canvas-node-port\.is-hint\s*\{[^}]*place-items:\s*center/,
    '必须垂直居中 —— 这正是"歪"的根因（文本字符坐在基线上）');
});

test('② 派生卡片的描述默认不显示，hover 才看得到完整句子', () => {
  /* 用户原话：「而且你这些按钮的描述现在都是看不全的，还不如不直接显示，
     鼠标放上去再显示描述吧」
     根因：`.ec-canvas-derive-copy small` 是 -webkit-line-clamp: 2，
     12~18 个字的描述每张都被砍成半句 + 省略号。 */
  const small = deriveCss.match(/\.ec-canvas-derive-copy small \{([^}]*)\}/);
  assert.ok(small, '找不到 small 规则');
  assert.match(small[1], /display:\s*none/, '描述默认收起（不占位、不截断）');
  assert.doesNotMatch(small[1], /-webkit-line-clamp/, '不许再靠两行截断显示半句话');
  /* 完整句子要能被 hover 拿到：整块 tile 与文字容器都挂 title */
  assert.match(studio, /className="ec-canvas-derive-tile" title=\{action\.description\}/,
    '整块 tile 要挂 title（鼠标停在图标/价格上也拿得到）');
  assert.match(studio, /className="ec-canvas-derive-copy" title=\{action\.description\}/,
    '文字容器也要挂 title');
  assert.match(studio, /<small aria-hidden="true">\{action\.description\}<\/small>/,
    'small 既然不显示，就别让读屏念两遍');
});

test('③ 小地图视窗框是**一个盒子**（用户：「看起来很割裂，不要这样割裂式的去组装」）', () => {
  const panel2 = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
  const supCss = read('src/styles/canvas-supervisor.css');
  assert.doesNotMatch(panel2, /ec-canvas-minimap-covered/, '不许再画第二个盒子（第一版就是这么被退回的）');
  assert.match(panel2, /width:\s*visibleW \+ coveredW/, '一个盒子的宽度 = 看得见的 + 被遮住的');
  assert.match(panel2, /'--covered-w'/, '被遮住那一段的宽度用 CSS 变量交给同一层背景');
  const vp = supCss.match(/\.ec-canvas-minimap-viewport \{([^}]*)\}/);
  assert.ok(vp, '找不到视窗框规则');
  assert.match(vp[1], /repeating-linear-gradient/, '被遮住的那段用同一层背景的斜纹区分');
  assert.match(vp[1], /var\(--covered-w/, '斜纹宽度由 --covered-w 限定（而不是另加一个盒子）');
});
