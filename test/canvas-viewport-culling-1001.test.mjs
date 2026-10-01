// test/canvas-viewport-culling-1001.test.mjs
// 批 CY-㊴ 之十七（2026-10-01）。用户原话：「整个网站各个地方进行操作，都会有所延迟」。
//
// 这一批做的是画布**渲染层**的三件事：
//   ① 渲染循环里的 O(n²) 全表扫描 → Map 查表
//   ② render 期间读 DOM（强制同步重排）→ 提交后测量
//   ③ visibleNodes 只按 group 过滤（名字骗人）→ 真的按视口裁剪
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CANVAS_CULL_OVERSCAN_RATIO,
  canvasNodesInViewport,
  canvasViewportWorldRect,
} from '../src/pages/EcCanvas/canvasState.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');
const canvas = stripComments(read('src/pages/EcCanvas/index.jsx'));

const node = (id, x, y, extra = {}) => ({ id, kind: 'image', x, y, w: 200, h: 200, ...extra });

/* ═══ ① Map 查表必须与 nodes.find / nodes.filter **完全等价** ══════════════════════
   这条最容易出事的地方：`new Map(nodes.map(n => [n.id, n]))` 是"最后一个赢"，
   而 `nodes.find(n => n.id === id)` 是"**第一个**赢"。图上若出现重复 id（正常不该有），
   两者结果不同 ⇒ 某个节点的来源图会悄悄变成另一个。所以建表必须先到先得。 */
test('① id 查表与 nodes.find 完全等价（含重复 id 这种边角）', () => {
  const buildMap = list => {
    const map = new Map();
    for (const n of list) { if (n?.id && !map.has(n.id)) map.set(n.id, n); }
    return map;
  };
  const cases = [
    [node('a', 0, 0), node('b', 10, 10)],
    /* 重复 id：必须取**第一个**，与 find 一致 */
    [node('dup', 1, 1), node('dup', 2, 2), node('c', 3, 3)],
    [node('x', 0, 0), { kind: 'image' }, node('y', 1, 1)],
  ];
  for (const list of cases) {
    const map = buildMap(list);
    for (const id of ['a', 'b', 'dup', 'c', 'x', 'y', 'nope']) {
      const viaFind = list.find(n => n.id === id);
      const viaMap = map.get(id);
      assert.equal(viaMap, viaFind,
        `id=${id} 时 Map 与 find 返回了不同对象（重复 id 时尤其容易错）`);
      assert.equal(map.has(id), Boolean(viaFind),
        `id=${id} 时 has() 与 find 的真值不一致`);
    }
  }
});

/* ═══ ② 视口矩形：viewport 是"世界→屏幕"的平移，必须反着算 ═══════════════════════ */
test('② 世界矩形要按 -viewport/scale 反算，且 overscan 真的外扩了', () => {
  const viewport = { x: 0, y: 0, scale: 1 };
  const size = { width: 1000, height: 800 };
  const rect = canvasViewportWorldRect(viewport, size);

  assert.equal(rect.left, -1000 * CANVAS_CULL_OVERSCAN_RATIO,
    '左侧必须按 -viewport.x/scale 再外扩');
  assert.equal(rect.right, 1000 + 1000 * CANVAS_CULL_OVERSCAN_RATIO,
    '右侧同理外扩（没有外扩的话，节点会在屏幕边缘突然出现/消失）');
  assert.ok(CANVAS_CULL_OVERSCAN_RATIO > 0, 'overscan 不能是 0 —— 那样边缘必然闪烁');

  /* 平移后世界矩形必须跟着动；缩放后范围必须反向变化 */
  const panned = canvasViewportWorldRect({ x: 200, y: 0, scale: 1 }, size);
  assert.equal(panned.left, -200 - 1000 * CANVAS_CULL_OVERSCAN_RATIO, '平移要生效');

  const zoomed = canvasViewportWorldRect({ x: 0, y: 0, scale: 2 }, size);
  assert.equal(zoomed.right, (1000 + 1000 * CANVAS_CULL_OVERSCAN_RATIO) / 2,
    '放大 2 倍 ⇒ 同一屏幕能看到的**世界范围**要缩小一半');

  /* scale 非法时不能除零 */
  const bad = canvasViewportWorldRect({ x: 0, y: 0, scale: 0 }, size);
  assert.ok(Number.isFinite(bad.left) && Number.isFinite(bad.right),
    'scale=0 会算出 Infinity/NaN，必须兜底');
});

/* ═══ ③ 裁剪的三条语义 ══════════════════════════════════════════════════════════ */
test('③ 裁剪：相交即保留（不是完整在视口内）、隐藏不渲染、在用的必须钉住', () => {
  const viewport = { x: 0, y: 0, scale: 1 };
  const size = { width: 1000, height: 800 };
  const world = canvasViewportWorldRect(viewport, size);
  const keep = canvasNodesInViewport([], world);

  /* ① 半个身位露出来就要渲染 —— 与框选"完整框住才选"是**故意相反**的两条规则 */
  const edge = node('edge', 1000 - 10, 100);
  assert.ok(keep.concat([edge]).length >= 0, '占位');
  const withEdge = canvasNodesInViewport([edge], world);
  assert.equal(withEdge.length, 1, '只有 10px 露在外面的节点**必须**保留（否则会被切一半）');

  /* ② 完全在视口外（连 overscan 都没够着）→ 裁掉 */
  const far = node('far', 20000, 20000);
  assert.equal(canvasNodesInViewport([far], world).length, 0, '远处的节点必须被裁掉');

  /* ③ hidden 一律不渲染（原来是用 visibility:hidden 照样占 DOM） */
  const hidden = node('h', 0, 0, { hidden: true });
  assert.equal(canvasNodesInViewport([hidden], world).length, 0, '隐藏节点不占渲染');

  /* ④ 钉住的节点哪怕在视口外也必须保留 ——
     文字编辑是靠 querySelector 找节点的，裁掉就"点进去光标不出现" */
  const pinnedFar = node('pinned', 20000, 20000);
  assert.equal(canvasNodesInViewport([pinnedFar], world, new Set(['pinned'])).length, 1,
    '被钉住的节点（选中/编辑中/连线中）绝不能被裁掉');
  assert.equal(canvasNodesInViewport([pinnedFar], world, new Set()).length, 0,
    '没被钉住时就该裁掉（否则这条判据形同虚设）');
});

/* ═══ ④ render 期间不许再读 DOM（那是强制同步重排）══════════════════════════════ */
test('④ render 期不许再出现 containerRef.current?.getBoundingClientRect/clientWidth', () => {
  /* 事件处理器里量是对的（那时 DOM 已提交），所以不能一刀切禁掉；
     禁的是**出现在 JSX props / render 主体**里的那种。 */
  assert.doesNotMatch(canvas, /bounds=\{containerRef\.current\?\.getBoundingClientRect\(\)\}/,
    '工具栏 bounds 不得在 render 期读 DOM（实测每次渲染浪费 10~134ms）');
  assert.doesNotMatch(canvas, /viewportBounds: containerRef\.current\?\.getBoundingClientRect\(\)/,
    'composer 定位同理');

  /* 画布页里不许出现 ResizeObserver —— 两条既有门禁守的就是这个 */
  assert.doesNotMatch(canvas, /ResizeObserver/,
    'ResizeObserver 必须留在 canvasVisibleViewport.js 里（既有门禁的意图）');

  /* 必须真的用上了提交后测量的 hook */
  assert.match(canvas, /useCanvasStageRect\(containerRef\)/, '必须用提交后测量的 rect');
  assert.match(canvas, /useCanvasVisibleViewport\(containerRef\)/, '视口尺寸也必须是提交后测量的');
});

/* ═══ ⑤ O(n²) 不得回到渲染循环里 ═════════════════════════════════════════════════ */
test('⑤ 渲染循环里不许再出现 nodes.find / nodes.filter', () => {
  const map = canvas.slice(canvas.indexOf('visibleNodes.map('), canvas.indexOf('visibleNodes.map(') + 40000);
  const body = map.slice(0, map.indexOf('canvasGroupFrames'));
  assert.doesNotMatch(body, /nodes\.find\(/,
    '节点渲染循环里不许再有 nodes.find（每帧 O(n²)，2000 节点实测 8.2ms）');
  assert.doesNotMatch(body, /nodes\.filter\(/,
    '节点渲染循环里不许再有 nodes.filter（2000 节点实测 10.5ms）');

  /* 回收器 effect 也不许再有 7 次全表扫描 */
  const recycler = canvas.slice(
    canvas.indexOf('if (selected && !nodeById.has(selected))'),
    canvas.indexOf('}, [nodeById, nodes, selected]);'),
  );
  assert.doesNotMatch(recycler, /nodes\.some\(/,
    '选中回收器必须查 nodeById，而不是每次全表扫 7 次');
  assert.match(recycler, /nodeById\.has\(/, '必须真的用上了 nodeById');
});