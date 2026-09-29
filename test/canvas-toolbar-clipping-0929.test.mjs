import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getCanvasToolbarPosition } from '../src/pages/EcCanvas/canvasInteractionModel.js';

/* ══════════════════════════════════════════════════════════════════════════════
   选中工具条被**裁掉左边**（批 CY-㉔）

   用户 2026-09-28（自己账号实测，截图 zoom = 39%，箭头指着工具条左端）：
     「不对啊，你画布还是没修复啊，这里不还是截断了吗。
       我用自己的号测试的，这个问题应该是非常普遍的 bug 了」

   ⚠️ 先说清楚：**这和批 CY-⑲ 修的不是同一个 bug**。CY-⑲ 修的是「素材框互相重叠」，
   那条确实修好了；这次是**工具条自己的定位算错了**。

   坐标系（不看懂这段就看不懂 bug）：
     · 工具条渲染在内容层里（index.jsx:7424 那个 `transform: scale(s)` 的 div）；
     · 工具条自己带 `transform: … scale(var(--canvas-overlay-scale))`，
       那个变量 = `1/s`（index.jsx 内联注入）⇒ **两级缩放互相抵消**，
       工具条在屏幕上恒定大小 —— 这是设计意图（缩放画布时工具条不该跟着变大变小）；
     · 所以 `width`/`height` 是**屏幕像素**，而 `visibleLeft/visibleRight` 是**世界坐标**。

   算它在世界里占多宽 ⇒ 必须 `width / scale`。
   原代码**高度除了、宽度没除**：
       centeredX   = … toolbarWidth / 2 …          ← 屏幕像素被当世界坐标用了
       belowBottom = … toolbarHeight / scale …      ← 高度是对的
   ⇒ 39% 缩放下少算 1924 世界单位 ⇒ 左边甩出视口约 375 屏幕像素
   ⇒ 再被内容层 `overflow: clip` **一刀切掉**。

   为什么「非常普遍」：**100% 缩放下 `/scale` 恰好等于 1，这个 bug 完全看不出来**。
   只要用户缩放画布（几乎人人都会），就一定命中。
   ══════════════════════════════════════════════════════════════════════════════ */

const SCALES = [0.25, 0.39, 0.5, 0.68, 0.75, 1, 1.5, 2, 3];
const VIEWPORT = { x: -120, y: 40, scale: 0.39 };
const BOUNDS = { width: 1440, height: 900 };
/** 工具条的**屏幕**宽度（CSS 宽度，两级缩放抵消后就是屏幕像素） */
const TOOLBAR_SCREEN_WIDTH = 820;

/** 工具条在屏幕上实际占据的横向区间。 */
function toolbarScreenRect({ node, viewport, bounds, screenWidth }) {
  const pos = getCanvasToolbarPosition({ node, viewport, bounds, width: screenWidth, height: 48 });
  // CSS: translate(-50%, -100%) ⇒ left 是**中心**；两级 scale 抵消 ⇒ 屏幕宽 = CSS 宽
  const centerX = pos.left * viewport.scale + viewport.x;
  return { left: centerX - screenWidth / 2, right: centerX + screenWidth / 2 };
}

test('① 工具条在屏幕上永远完整可见（左边不被裁）', () => {
  for (const scale of SCALES) {
    const viewport = { ...VIEWPORT, scale };
    for (const nodeX of [0, 60, 200, 700, 1400, 3000, 9000]) {
      const node = { x: nodeX, y: 300, w: 240, h: 240 };
      const rect = toolbarScreenRect({ node, viewport, bounds: BOUNDS, screenWidth: TOOLBAR_SCREEN_WIDTH });
      assert.ok(rect.left >= -0.5,
        `scale=${scale} nodeX=${nodeX}：工具条左边跑出屏幕 ${rect.left.toFixed(1)}px（会被 overflow:clip 裁掉）`);
      assert.ok(rect.right <= BOUNDS.width + 0.5,
        `scale=${scale} nodeX=${nodeX}：工具条右边跑出屏幕 ${rect.right.toFixed(1)}px`);
    }
  }
});

test('② 复算用户那张截图：39% 缩放、节点靠左时，左边不再出界', () => {
  /* 用户截图里 zoom=39%，节点大约落在世界 x≈214，工具条左边被削掉半截「图层」。 */
  const node = { x: 214, y: 328, w: 240, h: 240 };
  const rect = toolbarScreenRect({ node, viewport: VIEWPORT, bounds: BOUNDS, screenWidth: TOOLBAR_SCREEN_WIDTH });
  assert.ok(rect.left >= -0.5, `39% 缩放下左边出界 ${rect.left.toFixed(1)}px`);
  assert.ok(rect.right <= BOUNDS.width + 0.5, `右边出界 ${rect.right.toFixed(1)}px`);
});

test('③ 越缩小越要靠得住（这就是「非常普遍」的含义：100% 之外全都命中）', () => {
  /* 旧公式在 scale=1 时恰好正确（/1 一样），所以这个 bug 藏了很久。
     修好之后，所有缩放档位都必须在屏幕内。 */
  for (const scale of SCALES.filter(x => x !== 1)) {
    const viewport = { ...VIEWPORT, scale };
    const node = { x: 0, y: 300, w: 240, h: 240 };
    const rect = toolbarScreenRect({ node, viewport, bounds: BOUNDS, screenWidth: TOOLBAR_SCREEN_WIDTH });
    assert.ok(rect.left >= -0.5 && rect.right <= BOUNDS.width + 0.5,
      `scale=${scale} 仍出界：[${rect.left.toFixed(1)}, ${rect.right.toFixed(1)}]`);
  }
});

test('④ 定位函数内部必须把宽度也除以 scale（与高度同一口径）', () => {
  const src = readFileSync(new URL('../src/pages/EcCanvas/canvasInteractionModel.js', import.meta.url), 'utf8');
  const start = src.indexOf('export function getCanvasToolbarPosition');
  assert.ok(start > 0, '必须能找到 getCanvasToolbarPosition');
  const body = src.slice(start, start + 2600);
  assert.match(body, /screenWidth\s*\/\s*scale/, '宽度必须由屏幕像素换算成世界坐标（/ scale）');
  // 高度那边的既有写法不能被弄坏
  assert.match(body, /toolbarHeight \/ scale/, '高度仍应是 toolbarHeight / scale');
  // 旧的错误写法必须消失
  assert.doesNotMatch(body, /Math\.min\(Math\.max\(180, finite\(width, 520\)\), Math\.max\(180, viewportWidth \/ scale/,
    '旧的「宽度不除 scale」写法已被本次修复替换掉');
});

test('⑤ CSS 的 max-width 上限要被一并兜住（免得算出比视口还宽的位置）', () => {
  const src = readFileSync(new URL('../src/pages/EcCanvas/canvasInteractionModel.js', import.meta.url), 'utf8');
  const start = src.indexOf('export function getCanvasToolbarPosition');
  const body = src.slice(start, start + 2600);
  assert.match(body, /820/, '要兜住 CSS 的 max-width: min(820px, 86vw)');
  assert.match(body, /viewportWidth \* 0\.86/, '也要兜住 86vw');
});

test('⑥ 工具条量宽度用 offsetWidth —— 但这不是本次修复的功劳（自我更正留痕）', () => {
  /* 我第一反应是 `getBoundingClientRect().width` 量错了单位，改成 offsetWidth。
     **那是错的**：工具条自身 `scale(1/s)` 与祖先 `scale(s)` 抵消，两者数值相等。
     这条断言只是把「改过、且写法更直白」这件事钉住，并且明确写下它不是修复本身，
     免得下一个人以为「offsetWidth 修好了裁剪」而去动那行 CSS 的反向缩放。 */
  const src = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const start = src.indexOf('export function CanvasObjectToolbar');
  assert.ok(start > 0, '必须能找到 CanvasObjectToolbar');
  const body = src.slice(start, start + 3200);
  assert.match(body, /Math\.round\(el\.offsetWidth\)/);
  assert.match(body, /自我更正|并不是这次修复的功劳/,
    '必须留下「这不是修复本身」的说明，否则下一个人会去动反向缩放那行 CSS');
});
