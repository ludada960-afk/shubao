import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const geometrySource = readFileSync(new URL('../src/pages/EcCanvas/canvasGeometry.js', import.meta.url), 'utf8');
const workflowSource = readFileSync(new URL('../src/pages/EcCanvas/nodeWorkflow.js', import.meta.url), 'utf8');

test('Canvas derives port geometry from node rectangles without viewport-bound DOM measurements', () => {
  assert.match(geometrySource, /export function getNodePortCenter/);
  assert.match(workflowSource, /return getNodePortCenter\(normalized, port\)/);
  assert.doesNotMatch(canvasSource, /getCanvasDomPortCenter/);
  assert.doesNotMatch(canvasSource, /setRenderedPortCenters/);
  assert.doesNotMatch(canvasSource, /new ResizeObserver\(measure\)/);
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
  assert.match(canvasSource, /<StudioImageNode[\s\S]*?onDoubleClick=\{node => openImagePreview/);
  assert.match(canvasSource, /<StudioSourceNode[\s\S]*?onDoubleClick=\{preview => openImagePreview/);
});
