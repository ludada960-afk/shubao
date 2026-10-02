import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_MEDIA_GAP_SCREEN,
  CANVAS_MEDIA_MAX_HEIGHT,
  canvasMediaFrameHeight,
  canvasNodeFootprint,
  findCanvasBatchPlacement,
  screenGapToWorld,
} from '../src/pages/EcCanvas/canvasMediaFitModel.js';
/* 2026-10-02：footer 高度不再由 canvasMediaFitModel 自带（那份 34 与端口几何的 46
   长期打架），改从唯一真相 canvasGeometry 取。 */
import { CANVAS_CARD_FOOTER_H } from '../src/pages/EcCanvas/canvasGeometry.js';
import { findCanvasBlankPlacement } from '../src/pages/EcCanvas/canvasInlineEditorModel.js';
import { createUploadedImageNodes, createUploadedVideoNodes } from '../src/pages/EcCanvas/canvasStudioModel.js';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

const overlaps = (a, b, gap = 0) => a.x < b.x + b.w + gap
  && a.x + a.w + gap > b.x
  && a.y < b.y + b.h + gap
  && a.y + a.h + gap > b.y;

/* ══════════════════════════════════════════════════════════════════════════════
   用户 2026-09-28 原话（这批修复的全部依据）：
     「用户无论生成什么东西或者上传什么东西进来到画布里面。他都应该所有的素材全部能够
       完整的展示出来，并且互相之间是不会有遮挡，不会有覆盖的情况。」
   ══════════════════════════════════════════════════════════════════════════════ */

test('框高由素材真实宽高比推出，不是写死的常数（ComfyUI fitDimensionsToNodeWidth 口径）', () => {
  // 一张 1080x1920 的 9:16 竖图，框宽 240 ⇒ 框高必须是 427，而不是 240（正方形）
  assert.equal(canvasMediaFrameHeight(240, 1080, 1920), 427);
  // 一张 1920x1080 的 16:9 横图 ⇒ 框高 135
  assert.equal(canvasMediaFrameHeight(240, 1920, 1080), 135);
  // 正方形就是正方形
  assert.equal(canvasMediaFrameHeight(240, 800, 800), 240);
  // 量不到尺寸时回落到方形，而不是算出 NaN / 0
  assert.equal(canvasMediaFrameHeight(240, 0, 0), 240);
  assert.ok(Number.isFinite(canvasMediaFrameHeight(240, 0, 0)));
});

test('极端长图不会被撑成一屏都放不下（上限口径同 Excalidraw「不超过视口高度一半」）', () => {
  // 一张 1000x20000 的极端长图
  const height = canvasMediaFrameHeight(240, 1000, 20000);
  assert.equal(height, CANVAS_MEDIA_MAX_HEIGHT);
});

test('间隙按屏幕像素表达，低缩放下世界坐标要相应放大（Excalidraw 50/zoom 同款）', () => {
  // 缩放 1 ⇒ 1:1
  assert.equal(screenGapToWorld(CANVAS_MEDIA_GAP_SCREEN, 1), CANVAS_MEDIA_GAP_SCREEN);
  // 缩放 0.5 ⇒ 同样 28 屏幕像素需要 56 世界坐标
  assert.equal(screenGapToWorld(CANVAS_MEDIA_GAP_SCREEN, 0.5), 56);
  // 缩放 2 ⇒ 14 世界坐标
  assert.equal(screenGapToWorld(CANVAS_MEDIA_GAP_SCREEN, 2), 14);
});

test('节点占位必须算上 footer —— 这正是「互相遮挡」的几何根因', () => {
  const withMeta = canvasNodeFootprint({ x: 0, y: 0, w: 240, h: 320 });
  const withoutMeta = canvasNodeFootprint({ x: 0, y: 0, w: 240, h: 320, showMeta: false });
  // 带 footer 的节点比裸框高出一个 footer
  assert.equal(withMeta.h, 320 + CANVAS_CARD_FOOTER_H);
  // showMeta === false 的节点不渲染 footer，不该多算
  assert.equal(withoutMeta.h, 320);
  // footer 高度与 CSS 里真实的 footer 对得上（padding 6+7 + 两行 12px/10px×1.35 + 2px gap + 1px 边框）
  assert.match(css, /\.ec-canvas-media-node footer \{[^}]*padding: 6px 8px 7px/);
  assert.match(css, /--ec-canvas-action-font: 12px/);
  assert.match(css, /--ec-canvas-meta-font: 10px/);
  /* 2026-10-02：这里原来断言 **34**，而端口几何那边用的是 46。
     按 CSS 真实值算一遍：padding 6+7 = 13、border-top 1、gap 2、
     两行文字 12×1.35 = 16.2 与 10×1.35 = 13.5 ⇒ 合计 **45.7 ≈ 46**。
     ⇒ 34 才是错的（它漏了 padding、边框和第二行），
       这正是「框选按 34、连线端点按 46」两套口径打架的由来。
     现在整卡高度只有 canvasGeometry 一处定义（可测的单一真相）。 */
  assert.equal(CANVAS_CARD_FOOTER_H, 46);
});

test('findCanvasBlankPlacement 避让时把已有节点的 footer 也算进去了', () => {
  // 一个 240x320 的节点（带 footer ⇒ 实际占位到 y=354），新节点紧贴它下方 28 处就会压住 footer
  const existing = [{ id: 'a', x: 100, y: 100, w: 240, h: 320 }];
  const placement = findCanvasBlankPlacement({
    width: 240,
    height: 320,
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1200, height: 800 },
    nodes: existing,
    gap: 0,
  });
  const mine = { x: placement.x, y: placement.y, w: 240, h: 320 + CANVAS_CARD_FOOTER_H };
  const theirs = canvasNodeFootprint(existing[0]);
  assert.equal(overlaps(mine, theirs, 0), false, '新节点不能压在已有节点的 footer 上');
});

test('整批上传的每一个节点都有不重叠的位置（原来只检查了第一个）', () => {
  const sizes = [
    { w: 240, h: 240 },
    { w: 240, h: 320 },
    { w: 240, h: 427 },
    { w: 240, h: 135 },
  ];
  // 先在画布上摆满已有节点，逼它去找空位
  const existing = [];
  for (let i = 0; i < 6; i += 1) {
    existing.push({ id: `e${i}`, x: 20 + i * 260, y: 20, w: 240, h: 240 });
    existing.push({ id: `f${i}`, x: 20 + i * 260, y: 300, w: 240, h: 240 });
  }
  const origin = findCanvasBatchPlacement({
    sizes,
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1200, height: 800 },
    nodes: existing,
    preferred: { x: 30, y: 30 },
  });
  assert.ok(origin, '必须找到一个落位');

  // 批内自己不能互相压
  const placed = [];
  let cursorX = origin.x;
  for (const size of sizes) {
    placed.push({ x: cursorX, y: origin.y, w: size.w, h: size.h });
    cursorX += size.w + 28;
  }
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      assert.equal(overlaps(placed[i], placed[j], -1), false, `批内第 ${i + 1} 与第 ${j + 1} 张重叠了`);
    }
  }
  // 也不能压到任何已有节点
  for (const mine of placed) {
    for (const node of existing) {
      assert.equal(overlaps(mine, canvasNodeFootprint(node), 0), false, `第 ${mine.x} 的新节点压住了已有节点 ${node.id}`);
    }
  }
});

test('9:16 视频按真实比例算占位，不会按写死的 320x240 压在下面节点上', () => {
  const [node] = createUploadedVideoNodes({
    assets: [{ id: 'v1', url: '/api/generated-assets/v1.mp4', width: 1080, height: 1920 }],
    x: 0, y: 0,
  });
  // 320 宽的 9:16 ⇒ 高 569，而不是 240
  assert.equal(node.w, 320);
  assert.ok(node.h > 500, `9:16 视频框高应接近 569，实际 ${node.h}`);
});

test('上传落位用的尺寸公式和真正建节点的公式是同一个（否则又变成「按 A 找位、按 B 画框」）', () => {
  const assets = [{ url: '/api/generated-assets/a.png', width: 1080, height: 1920 }];
  const [node] = createUploadedImageNodes({ assets, x: 0, y: 0 });
  // index.jsx 里的 canvasUploadFootprintSizes 必须复现同样的 h
  const helper = /function canvasUploadFootprintSizes[\s\S]*?\n}/.exec(page);
  assert.ok(helper, 'canvasUploadFootprintSizes 必须存在');
  const expected = Math.round(240 / (1080 / 1920));
  assert.equal(node.h, expected);
  assert.match(page, /const ratio = ratioValue\(mediaRatioFor\(\{/);
  assert.match(page, /h: Math\.max\(1, Math\.round\(width \/ \(ratio \|\| fallbackRatio\)\)\)/);
});

test('上传路径确实改成了整批落位（不再是只算第一个节点）', () => {
  // 图片上传
  assert.match(page, /const blank = findCanvasBatchPlacement\(\{\s*\n\s*sizes: canvasUploadFootprintSizes\(assets, 240, 38\)/);
  // 视频上传
  assert.match(page, /sizes: canvasUploadFootprintSizes\(imported\.assets, 320, 42, 'aspectRatio', 16 \/ 9\)/);
  // 上传路径里不再有那个写死 200x200 的单框避让
  assert.doesNotMatch(page, /findCanvasBlankPlacement\(\{\s*\n\s*width: 200,\s*\n\s*height: 200,/);
  assert.doesNotMatch(page, /findCanvasBlankPlacement\(\{\s*\n\s*width: 320,\s*\n\s*height: 240,/);
});

test('handleMediaNaturalSize 走带上限的框高公式（一条 9:16 长图不会把整排节点顶没）', () => {
  assert.match(page, /const height = canvasMediaFrameHeight\(width, measuredWidth, measuredHeight\);/);
  // 不再是那个没有上限的 Math.round(width * h / w)
  assert.doesNotMatch(page, /const height = Math\.max\(1, Math\.round\(width \* measuredHeight \/ measuredWidth\)\);/);
});

test('无限画布的固有属性：素材在视口外只是「没画出来」，绝不能从状态里消失', () => {
  /* 调研结论（React Flow translateExtent 默认无限 / Excalidraw Renderer 只把出视口元素
     移进 removed **绘制集合**，状态原封不动）：stage 边缘裁切不是 bug，是无限画布的固有属性。

     ⚠️ 这条门禁原来的**意图**不是"不许有视口裁剪"，而是
        「**绝不能**因为看不见就把素材从**状态**里切掉」——
        原注释写得很清楚：「免得下一个人看用户抱怨『又看不到素材』就加个 viewport filter，
        那会把素材**真的**切掉」。

     2026-10-01（批 CY-㊴ 之十七）加了**渲染层**的视口裁剪（`visibleNodes`），
     裁掉的只是**不画**，与 Excalidraw 的 `removed` 绘制集合是同一个口径：
        · `visibleNodes` 只在 `visibleNodes.map(...)` 里用于渲染；
        · `nodes` **状态**一个字节都没动；
        · 导出 / 小地图 / 适配 / 框选 / 分组 全部仍然用 `nodes`。
     所以下面不是把门禁放松，而是**按它的原意改写成更强的形式**：
     从"不许出现某段代码"，变成"任何按视口过滤都**只能**出现在渲染派生里，
     一旦流进 setNodes / 导出 / 小地图，立刻判红"。 */
  assert.match(page, /const visibleNodes = useMemo\(\(\) => \{/,
    'visibleNodes 必须是**渲染用的派生值**');
  assert.match(page, /canvasNodesInViewport\(grouped, cullWorldRect, pinnedNodeIds\)/,
    'visibleNodes 必须经过视口裁剪（渲染层，不动状态）');

  /* ① 状态本身绝不能被视口过滤 */
  assert.doesNotMatch(page, /setNodes\([^)]*canvasNodesInViewport/,
    '❗绝不能把视口过滤的结果写回 nodes 状态 —— 那才是"把素材真的切掉"');
  assert.doesNotMatch(page, /setNodes\([^)]*rectsOverlap|onlyRenderVisible/);

  /* ② 依赖**全部**节点的地方，必须用 nodes 而不是 visibleNodes */
  for (const [what, pattern] of [
    ['导出', /selectDeliverableNodes\(nodes,/],
    ['框选', /selectNodesInRect\(nodes,/],
    ['分组框', /canvasGroupFrames\(nodes\)/],
    ['视图适配', /fitViewport\(nodes,/],
  ]) {
    assert.match(page, pattern, `${what} 必须基于完整的 nodes，不能基于裁剪后的 visibleNodes`);
  }
  /* 小地图的世界范围是**写死的常量**（6400×4800），根本不看节点列表 ——
     所以裁剪对它没有任何影响（这比"从 nodes 算"还要安全一层）。 */
  assert.match(page, /const minimapWorldBounds = useMemo\(\(\) => \(\{\s*width: 6400,\s*height: 4800/,
    '小地图世界范围必须是固定常量，不依赖任何节点列表');

  /* ③ 可见性之外的东西不得参与过滤：hidden 只是"不画"，仍在状态里。
     判据读的是 canvasState.js（裁剪函数本身住在那里，不在 index.jsx）。 */
  const state = readFileSync(new URL('../src/pages/EcCanvas/canvasState.js', import.meta.url), 'utf8');
  const cullFn = state.slice(
    state.indexOf('export function canvasNodesInViewport'),
    state.indexOf('export function moveSelectedNodes'),
  );
  assert.match(cullFn, /if \(node\?\.hidden\) return false;/,
    '裁剪函数必须跳过 hidden 节点');
  assert.match(cullFn, /pinnedIds\?\.has\(node\.id\)/,
    '被钉住的节点必须无视视口一律保留（文字编辑靠 querySelector 找节点）');
  assert.doesNotMatch(cullFn, /\.splice\(|\.pop\(|\.shift\(/,
    '裁剪函数只许返回新数组，**绝不允许**改动传入的 nodes');
});

test('画布仍然只按「图层筛选 chip」过滤节点（CY-⑮ 修过的回归防护）', () => {
  assert.match(page, /activeFilter === '全部' \? nodes : nodes\.filter\(node => node\.group === activeFilter\)/);
});
