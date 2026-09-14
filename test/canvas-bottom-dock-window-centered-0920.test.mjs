// test/canvas-bottom-dock-window-centered-0920.test.mjs
// 画布底部操作栏必须**居中于整个窗口**，且**不被裁切**。
// ─────────────────────────────────────────────────────────────────────────────
// 用户批注（同一件事提了 4 次）：「你下面这个操作栏也依然歪向左边，没有居中」
//
// ⚠️ 本文件在 2026-09-20 被**实测推翻过一次**，留下三条教训：
//   1. 我最初断言「必须有 min() 回夹，否则窄屏会被 stage 的 overflow:clip 裁掉」——
//      **这个前提是错的**。实测（1024px + 右侧面板打开）那个 min() 正是**偏移的来源**：
//      `100% − 120 = 428` 赢了 `50vw = 512`，把 dock 按到左边 **−84px**。
//   2. 「用偏移换不裁切」是错的交易：min() 版 9/9 探针可命中但偏 84px；
//      去掉 min() 版中心 0 偏差但有 6/9 可命中 —— **两个都不对**。
//   3. 正解是把**裁剪边界从 stage 下移到内容层**：HUD 本来就不该被内容层的裁剪切掉。
//      实测（8 组宽度×面板开关）中心偏差全部 0px、9/9 探针可命中。
//
// 所以本文件的断言改为**判据**（居中 + 不被裁），不再锁某一种写法：
//   · 不许出现「把 HUD 回夹进 stage」的写法（那就是 −84px 那一版）；
//   · 裁剪必须发生在**内容层**，不能发生在 stage 上。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(path.join(ROOT, 'src/pages/EcCanvas/EcCanvas.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

const rulesOf = (selector) => {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const out = []; let m;
  while ((m = re.exec(css))) out.push(m[1]);
  return out;
};
const ruleOf = (selector) => { const all = rulesOf(selector); return all.length ? all[all.length - 1] : null; };

test('① 底部 dock 按「窗口中心」定位（两种等价写法都接受，但不许回夹进 stage）', () => {
  const base = rulesOf('.ec-canvas-bottom-dock')[0];
  assert.ok(base, '基础规则必须存在');
  assert.match(base, /left:\s*(50%|50vw)\s*;/, '必须按窗口居中（left: 50% 或 50vw），实际：' + base);
  assert.match(base, /transform:\s*translateX\(-50%\)/, '用 translateX(-50%) 居中，避免半像素偏移');
});

test('② 打开态不许把 HUD 回夹进 stage —— 那正是 −84px 偏移的来源', () => {
  const body = ruleOf('.ec-canvas-stage.has-right-panel .ec-canvas-bottom-dock');
  if (!body) return;   /* 不需要打开态覆盖时直接适用基础规则，不算违规 */
  assert.doesNotMatch(
    body,
    /--ec-canvas-hud-reserve-right/,
    '回夹会把 dock 按到左边（实测 1024px 下 −84px）；裁剪应交给内容层，不是靠把 HUD 挤进来',
  );
  assert.match(body, /left:\s*(50%|50vw)\s*;/, '打开态同样必须按窗口居中，实际：' + body);
});

test('③ 裁剪必须在**内容层**，不能落在 stage 上（HUD 不该被内容裁剪切掉）', () => {
  /* ⚠️ 必须检查**全部** .ec-canvas-stage 规则，不能只看最后一条 ——
     这个选择器在文件里出现多次（152 行主体 + 2158 行 z-index），只看最后一条会假绿。 */
  const stages = rulesOf('.ec-canvas-stage');
  assert.ok(stages.length, '.ec-canvas-stage 规则必须存在');
  for (const body of stages) {
    assert.doesNotMatch(
      body,
      /overflow:\s*(clip|hidden)/,
      'stage 不得裁剪：底部操作栏/缩放条/小地图都是它的子元素，被裁就会缺一块（实测 1024px 下 3/9 探针不可命中）。实际：' + body.slice(0, 120),
    );
  }
});

test('④ 反向断言：不许再出现把 HUD 挤回 stage 的 clamp 写法', () => {
  assert.doesNotMatch(
    css,
    /\.ec-canvas-bottom-dock[^{]*\{[^}]*left:\s*min\(/,
    '被投诉 4 次的那一版就是「按 stage 居中 / 回夹」—— 不许复活',
  );
});
