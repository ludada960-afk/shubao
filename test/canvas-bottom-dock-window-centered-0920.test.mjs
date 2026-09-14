// test/canvas-bottom-dock-window-centered-0920.test.mjs
// 画布底部操作栏必须**居中于整个窗口**，不随右侧面板左移。
// ─────────────────────────────────────────────────────────────────────────────
// 用户批注（同一件事提了 4 次）：「你下面这个操作栏也依然歪向左边，没有居中」
// 根因：dock 的定位基准是 .ec-canvas-stage，而右侧面板一开 stage 就变窄
//       （.has-right-panel 的 margin-right = 面板让位宽），于是「居中于画布可视区」
//       变成了「跟着面板往左移」。实测（修复前，1440px，面板打开）：
//         dock 中心 482px，窗口中心 720px —— 差 238px。
// 口径（用户已确认，2026-09-20）：要**永远居中于整个窗口**，像 Figma 那样不随面板移动。
// 实现：stage 左缘恒在 x=0，所以「窗口中心」在 stage 坐标系里 = 50% + (面板让位宽)/2。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* ⚠️ 必须先剥注释：CSS 注释里出现的花括号会让所有「朴素括号匹配」的正则失准
   （本文件第一版就中过这个招；注释里现在也不再写花括号了）。 */
const css = readFileSync(path.join(ROOT, 'src/pages/EcCanvas/EcCanvas.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

/** 取某个选择器的**全部**规则体（同一选择器可能在媒体查询里另有定义） */
const rulesOf = (selector) => {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const out = [];
  let m;
  while ((m = re.exec(css))) out.push(m[1]);
  return out;
};
const ruleOf = (selector) => { const all = rulesOf(selector); return all.length ? all[all.length - 1] : null; };

test('① 面板打开时，底部 dock 按「窗口中心」定位（不再跟随 stage）', () => {
  const body = ruleOf('.ec-canvas-stage.has-right-panel .ec-canvas-bottom-dock');
  assert.ok(body, '必须存在 .ec-canvas-stage.has-right-panel .ec-canvas-bottom-dock 规则');
  assert.match(body, /left:\s*min\(/, '定位必须带 min() 回夹，否则窄屏会被 stage 的 overflow:clip 裁掉');
  assert.match(
    body,
    /calc\(\s*50%\s*\+\s*\(\s*var\(--canvas-right-panel-width[^)]*\)\s*\+\s*var\(--cvl-right-panel-margin[^)]*\)\s*\)\s*\/\s*2\s*\)/,
    '窗口中心 = 50% + (面板让位宽)/2 —— 必须用变量表达，不许写死像素',
  );
});

test('② 回夹上限 = 100% − 余量（余量必须来自变量，不是散落的魔法数字）', () => {
  const body = ruleOf('.ec-canvas-stage.has-right-panel .ec-canvas-bottom-dock');
  assert.match(body, /calc\(\s*100%\s*-\s*var\(--ec-canvas-hud-reserve-right/, '回夹上限必须引用 --ec-canvas-hud-reserve-right');
  const reserve = css.match(/--ec-canvas-hud-reserve-right:\s*([0-9.]+)px/);
  assert.ok(reserve, '--ec-canvas-hud-reserve-right 必须有定义');
  const px = parseFloat(reserve[1]);
  assert.ok(px >= 100 && px <= 200, '余量应在 100–200px（工具条半宽 95 + 间距），实测 ' + px + 'px');
});

test('③ 默认（面板关闭）仍是纯 50% 居中 —— 不许把打开态的选择器写成全局', () => {
  const all = rulesOf('.ec-canvas-bottom-dock');
  assert.ok(all.length, '基础规则必须存在');
  const base = all[0];
  assert.match(base, /left:\s*50%\s*;/, '基础态必须仍是 left: 50%，实际：' + base);
  assert.match(base, /transform:\s*translateX\(-50%\)/, '必须用 translateX(-50%) 做居中，避免半像素偏移');
});

test('③b 窄屏覆盖必须继续锚在 stage 右缘（left:auto + right），不得退回 50% 居中', () => {
  const all = rulesOf('.ec-canvas-bottom-dock');
  const narrow = all.slice(1).join(' ');
  if (!narrow.includes('right:')) return; // 没有窄屏覆盖就不适用
  assert.match(narrow, /left:\s*auto\s*;/, '窄屏覆盖必须写 left: auto，否则会与居中规则打架');
  assert.match(narrow, /transform:\s*none\s*;/, '窄屏覆盖必须清掉 translateX(-50%)，否则会自己左移半个宽度');
});

test('④ 反向断言：打开态不许退回裸 left:50%（那就是被投诉 4 次的那一版）', () => {
  assert.doesNotMatch(
    css,
    /\.ec-canvas-stage\.has-right-panel\s+\.ec-canvas-bottom-dock\s*\{[^}]*left:\s*50%\s*;[^}]*\}/,
    '退回裸 left:50% 会让 dock 重新跟着面板左移（实测差 238px）',
  );
});
