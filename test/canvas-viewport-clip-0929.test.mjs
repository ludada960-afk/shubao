import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

/* ══════════════════════════════════════════════════════════════════════════════
   无限画布的裁切坐标系（批 CY-㉕）

   用户 2026-09-28（11 个素材、zoom=29%）：
     「还是一样，我把截断的边界都给你拉出来了，现在的画布就这么小的面积有素材而已」

   我靠看图猜了两次都猜错了（第一次以为是工具条裁剪、第二次以为是素材重叠）。
   第三次改成**本地真浏览器量**，量出来的结果是：

     stage        屏幕 0..2000
     contentLayer **局部尺寸 2000 x 892 世界单位**，且带 translate+scale
     8 个节点里 2 个被裁

   根因：`overflow: clip` 裁的是**元素自己的盒子**，而那个盒子同时被
   `translate(vx,vy) scale(s)` 变换过 ⇒ **裁切窗口被钉死在「世界坐标 [0,2000]」
   这一块，与平移无关**。缩小到 29% 时可见世界区域仍然只有 2000 宽
   （而不是 2000/0.29 = 6896）⇒ 排在更右边的素材**永远看不见，平移也救不回来**。

   这就是无限画布与普通滚动容器的分水岭：滚动容器里"看得见的范围"跟着滚动条走；
   无限画布里它必须**恒等于视口**，否则画布就不是无限的了。

   正确结构（tldraw / Konva / React Flow 一致）：
     · 视口层：尺寸=舞台、**不参与变换**、只负责裁剪
     · 内容层：只负责缩放，且必须**始终盖住整个视口**

   验证（本地真浏览器）：
     修复前 平移前后可见内容**完全相同**（裁切窗固定）
     修复后 平移后可见节点 8/8 → 5/8，x 范围也变了 ⇒ 视野真的跟着平移走
   ══════════════════════════════════════════════════════════════════════════════ */

test('① 视口层存在：overflow:clip 且**自身没有 transform**（裁剪只归它管）', () => {
  /* 修复前那一个 div 同时背了 clip 和 transform —— 这就是病灶。
     判据不能靠正则去"解析 JSX"（style 是多行带嵌套花括号的，正则必然脆），
     改成断言**那一种错误形态已经不存在**。 */
  assert.ok(page.includes("overflow: 'clip'"), '必须还能找到 overflow:clip 的视口层');
  assert.doesNotMatch(
    page,
    /overflow: 'clip',\s*transform:/,
    '**clip 与 transform 不得再出现在同一个 style 里** —— '
    + '一旦裁切盒自己被 translate+scale，裁切窗就被钉死在「世界坐标里的一块固定区域」，'
    + '缩小画布时可见世界范围不随缩放变大，排在更右边的素材**永远看不见、平移也救不回来**。'
    + '这正是用户说的「现在的画布就这么小的面积有素材而已」。',
  );
  // 视口层本体：只有定位/尺寸/裁剪，没有 transform
  assert.match(
    page,
    /<div style=\{\{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'clip' \}\}>/,
    '视口层应当是一个只带定位+尺寸+clip 的朴素 div',
  );
});

test('② 内容层只负责缩放，且 left/top/width/height **全部除以 scale**', () => {
  /* 这四个值是一组：内容层的偏移与尺寸必须同时按 scale 换算，
     否则它盖不满视口，裁切窗又退化成「世界坐标里的一块固定区域」。 */
  const S = 'Math.max(0.1, viewport.scale)';
  assert.ok(page.includes('left: `calc(${-viewport.x}px / ${' + S + '})`'), '内容层 left 必须按 scale 换算');
  assert.ok(page.includes('top: `calc(${-viewport.y}px / ${' + S + '})`'), '内容层 top 必须按 scale 换算');
  assert.ok(page.includes('width: `calc((100% + ${40 + Math.abs(viewport.x)}px) / ${' + S + '})`'),
    '内容层宽度必须除以 scale');
  assert.ok(page.includes('height: `calc((100% + ${40 + Math.abs(viewport.y)}px) / ${' + S + '})`'),
    '内容层高度必须除以 scale');
});

test('③ 内容层不得再自己带 translate —— 平移已经由 left/top 承担了', () => {
  assert.ok(page.includes('transform: `scale(${viewport.scale})`'), '内容层应当只做 scale');
  const oldForm = /transform: `translate\(\$\{viewport\.x\}px,\$\{viewport\.y\}px\) scale\(\$\{viewport\.scale\}\)`/;
  assert.doesNotMatch(page, oldForm,
    '内容层同时带 translate 和按 scale 换算的 left/top 会**双重计算平移**。'
    + '修复后平移只由 left/top 承担。');
});

test('④ 尺寸余量必须含 |viewport.x| / |viewport.y|（省了就是「往右拖一点，最右边又不见了」）', () => {
  /* 推导：内容层左边缘落在屏幕 -vx，要盖到屏幕 stageW ⇒ 局部宽 W 需满足
       -vx + W*s >= stageW  ⇒  W >= (stageW + vx) / s
     vx 为负时要向左多铺 |vx|；两边合起来 W = (stageW + 40 + |vx|) / s。
     第一版只写了 `+40px`，于是 |vx| > 40 时右边就盖不住了 ——
     这是本批自己算完式子发现的，不是用户报的。 */
  assert.match(page, /40 \+ Math\.abs\(viewport\.x\)/, '宽度余量必须跟着横向平移量长');
  assert.match(page, /40 \+ Math\.abs\(viewport\.y\)/, '高度余量必须跟着纵向平移量长');
});

test('⑤ HUD 仍在视口层**之外**（stage 装着底部操作栏/缩放条/小地图/左工具栏，不能被裁）', () => {
  /* 2026-09-20 那次把裁剪从 stage 挪走，正是为了这个；本批不能把它请回来。 */
  assert.doesNotMatch(page, /\.ec-canvas-stage\s*\{[^}]*overflow:\s*(hidden|clip)/,
    'stage 不能带 overflow:hidden/clip —— 它装着 HUD，裁了会把操作栏切掉一块');
  // HUD 用的类必须还在源码里（说明它们仍是 stage 的直接子节点）
  for (const cls of ['ec-canvas-bottom-dock', 'ec-canvas-zoom-controls', 'ec-canvas-minimap', 'ec-canvas-left-rail']) {
    assert.ok(page.includes(cls), `${cls} 必须还在（它是不能被裁的 HUD）`);
  }
});

test('⑥ 选区框（marquee）用屏幕坐标，必须留在内容层**外面**', () => {
  /* marquee 的定位式是 `marquee.x * viewport.scale + viewport.x` —— 那是**屏幕**坐标。
     它若落在被 scale 的内容层里，会被再缩一次。所以它必须在视口层的兄弟位置。 */
  assert.match(page, /marquee\.x \* viewport\.scale \+ viewport\.x/,
    '选区框按屏幕坐标定位（与内容层里的世界坐标不同）');
  const contentClose = page.indexOf('/* 批 CY-㉕：上面这个 `</div>` 收的是**内容层**');
  const marqueeAt = page.indexOf('marquee.x * viewport.scale');
  assert.ok(contentClose > 0 && marqueeAt > contentClose,
    '选区框必须排在内容层闭合之后 —— 否则它会被内容层的 scale 再缩一次');
});
