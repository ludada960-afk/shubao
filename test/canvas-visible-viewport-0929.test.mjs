import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readCanvasVisibleViewport } from '../src/pages/EcCanvas/canvasVisibleViewport.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   小地图视窗框必须按「真正看得见的」画布尺寸算（批 CY-㉚）

   用户 2026-09-30 逐字：
     「当地图上出现右边的派生面板时，你小地图这里显示的当前视窗的这个锁定框。
       他右边就会缩小一点点。然后当我关掉这个派生面板的话，他这个框的右边就会再多出一点点。」

   实测（本地真浏览器，2000x1000，右面板开着）：
     .ec-canvas-stage 的 clientWidth = 1524
     但右侧面板是靠 margin-right: 476px 让位的（批 CY-⑱ 的 min(…, 38vw)）
     ⇒ 用户实际能看到的画布只有 1524 − 476 = **1048**
   改前把 clientWidth(1524) 当"视口尺寸"喂给 CanvasMinimap
   ⇒ 视窗框被高估 **45.4%**。
   ══════════════════════════════════════════════════════════════════════════════ */

const style = m => ({ marginRight: m.marginRight || '0px', marginLeft: m.marginLeft || '0px', marginTop: m.marginTop || '0px', marginBottom: m.marginBottom || '0px' });
const el = (w, h) => ({ clientWidth: w, clientHeight: h });

test('① 右面板打开：必须扣掉 marginRight（这是本次事故本身）', () => {
  const got = readCanvasVisibleViewport(el(1524, 892), undefined, () => style({ marginRight: '476px' }));
  assert.equal(got.width, 1048, '1524 − 476 = 1048 才是我看得见的画布宽');
  assert.equal(got.height, 892, '垂直方向没有 margin 让位，不该变');
});

test('② 右面板关闭（margin 归零）：宽度就是 clientWidth', () => {
  const got = readCanvasVisibleViewport(el(2000, 892), undefined, () => style({}));
  assert.equal(got.width, 2000);
  assert.equal(got.height, 892);
});

test('③ 关键性质：开/关面板时，**用户看得见的画布宽度差多少，框就该差多少**', () => {
  /* 用户报的正是"框跟着面板开关一涨一缩"。这两件事都合法：
     面板打开时画布确实变窄了（1524 布局 − 476 让位 = 1048 可见），
     面板关闭时确实变宽了（2000 可见）。
     所以框**应该**变 —— 前提是它变的是"真实可见宽"这个量，而不是"布局宽"。
     改前：开面板时框按 1524 算（比真实可见宽 1048 多算 45.4%），
           关面板时按 2000 算 ⇒ 两者之间凭空多出 476 的误差。
     改后：两个值都落在真实可见宽上。 */
  const open = readCanvasVisibleViewport(el(1524, 892), undefined, () => style({ marginRight: '476px' }));
  const closed = readCanvasVisibleViewport(el(2000, 892), undefined, () => style({}));
  assert.equal(open.width, 1048, '开面板：真实可见 1048');
  assert.equal(closed.width, 2000, '关面板：真实可见 2000');
  assert.equal(closed.width - open.width, 952, '差值 = 476(margin) + 476(布局也变宽了)');
  // 反证：改前这两个值分别是 1524 / 2000，差 476 —— 那就是"框平白多出 476"的误差
  assert.notEqual(open.width, 1524, '开面板时不得再直接用 clientWidth');
});

test('④ 四边 margin 都要扣（将来左侧若也让位，不会又漏一边）', () => {
  const got = readCanvasVisibleViewport(el(1000, 800), undefined,
    () => style({ marginLeft: '10px', marginRight: '20px', marginTop: '30px', marginBottom: '40px' }));
  assert.deepEqual(got, { width: 970, height: 730 });
});

test('⑤ 拿不到有效值时兜底，绝不能返回 0（0 会让视窗框整个消失）', () => {
  assert.deepEqual(
    readCanvasVisibleViewport(null, { width: 1440, height: 900 }),
    { width: 1440, height: 900 },
    '没有容器时用兜底',
  );
  assert.deepEqual(
    readCanvasVisibleViewport(el(0, 0), { width: 1440, height: 900 }, () => style({})),
    { width: 1440, height: 900 },
    '尺寸为 0 时也要兜底',
  );
  // margin 扣完 <= 0 时退回兜底（宽度），高度不受影响
  assert.deepEqual(
    readCanvasVisibleViewport(el(500, 400), { width: 1440, height: 900 },
      () => style({ marginLeft: '300px', marginRight: '300px' })),
    { width: 1440, height: 400 },
    'margin 扣完 <= 0 时宽度退回兜底，而不是 0 或负数；高度没有 margin 就不受影响',
  );
});

test('⑥ 调用点必须用新函数，不能再直接把 clientWidth 当视口尺寸', () => {
  assert.match(index, /viewportSize=\{canvasVisibleViewportSize\}/,
    'CanvasMinimap 必须收到扣过 margin 的可见尺寸');
  assert.doesNotMatch(
    index,
    /viewportSize=\{\{\s*width: containerRef\.current\?\.clientWidth/,
    '「直接把 clientWidth 当视口尺寸」这个写法必须已消失（那是 45.4% 高估的来源）',
  );
});
