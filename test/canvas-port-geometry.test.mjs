import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const geometrySource = readFileSync(new URL('../src/pages/EcCanvas/canvasGeometry.js', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../src/pages/EcCanvas/nodeWorkflow.js', import.meta.url), 'utf8');

test('Canvas derives port geometry from node rectangles without viewport-bound DOM measurements', () => {
  assert.match(geometrySource, /export function getNodePortCenter/);
  /* 2026-10-04：端点现在**优先**用实测的端口盒子（React Flow `nodeInternals.handleBounds`
     的口径），量不到才退回模型 rect —— 见 canvasNodeRects.js。
     `normalized, port` 仍是兜底路径的实参，所以这条判据形状变了但意图没变。 */
  assert.match(workflowSource, /return getNodePortCenter\(normalized, port, measured\)/);
  assert.match(geometrySource, /if \(measured\) return/,
    '实测端口必须优先于模型矩形');
  /* 旧的"不许把 DOM 测量塞进画布页"这条纪律仍然成立 ——
     实测必须走**提交后的 hook**（canvasNodeRects.js），不许进渲染路径。 */
  assert.doesNotMatch(canvasSource, /getCanvasDomPortCenter/);
  assert.doesNotMatch(canvasSource, /setRenderedPortCenters/);
  assert.doesNotMatch(canvasSource, /new ResizeObserver\(measure\)/);
  const rectsSource = readFileSync(new URL('../src/pages/EcCanvas/canvasNodeRects.js', import.meta.url), 'utf8');
  assert.match(rectsSource, /useLayoutEffect/,
    'DOM 实测只许在提交后的 layout effect 里做（本仓既有纪律）');
  assert.match(canvasSource, /useCanvasNodePortRects\(containerRef, viewport\)/,
    '画布必须挂上测量 hook');
  assert.match(canvasSource, /requestAnimationFrame\(flushDragFrame\)/);
  assert.match(canvasSource, /cancelAnimationFrame\(dragFrameRef\.current\)/);
  /* 批 CY-㉕ 把裁切盒与变换盒分开（治「可见世界范围不随缩放变大」）；
     批 CY-㉖ 又把平移**放回 transform**（治「我把 left 的符号与缩放都算错了」）。
     两次改完，最终形态 = 「视口层只裁剪 + 内容层 translate+scale 且留足余量」。
     这条断言真正要守的始终是「**存在一个被变换的内容层，且连线层在它里面**」，
     所以只守这个不变量，不钉某一种 left 的写法。详见 canvas-viewport-clip-0929。 */
  assert.match(canvasSource, /transform: `translate\(\$\{viewport\.x\}px, \$\{viewport\.y\}px\) scale\(\$\{viewport\.scale\}\)`[\s\S]*?<ConnectionLines connections=\{connections\}/,
    '必须存在一个被平移+缩放的内容层，且 ConnectionLines 在它里面（连线才能跟着画布一起变换）');
  assert.doesNotMatch(canvasSource, /function ConnectionLines\(\{[^}]*viewport/);
  /* 2026-10-01（批 CY-㊴ 之十八）：双击预览改走「按 node.id 缓存的稳定回调」，
     所以这里守的是**仍然接到了预览能力**，而不是必须写成内联箭头 ——
     后者恰恰是会让 React.memo 失效的写法。 */
  assert.match(canvasSource, /<StudioImageNode[\s\S]*?onDoubleClick=\{h\.onDoubleClickImage\}/);
  assert.match(canvasSource, /onDoubleClickImage:\s*\(nodeId, node\) => \{[\s\S]*?openImagePreview\(/,
    '图片节点双击仍必须打开预览');
  assert.match(canvasSource, /onPreviewSource:\s*\(nodeId, node\) => \{[\s\S]*?openImagePreview\(/,
    '素材节点双击仍必须打开预览');
  assert.match(canvasSource, /onDoubleClick=\{h\.onPreviewSource\}/,
    'StudioSourceNode 的双击预览必须接上');
});
