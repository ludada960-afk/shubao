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
  /* 批 CY-㉕：这一条原本钉死内容层用 `transform: translate(vx,vy) scale(s)`。
     那个写法本身**就是病灶** —— 裁切盒与变换同一个 div，裁切窗被钉死在世界坐标的
     一块固定区域里，缩小画布时可见世界范围不随缩放变大、更右边的素材永远看不见。
     现在内容层是 `transform: scale(s)` + 按 scale 换算的 left/top（平移不再重复计算），
     而这条断言真正想守的是「**存在一个被变换的内容层，且连线层在它里面**」，
     所以改成守这个不变量，而不是守某一种写法。详见 canvas-viewport-clip-0929。 */
  assert.match(canvasSource, /transform: `scale\(\$\{viewport\.scale\}\)`[\s\S]*?<ConnectionLines connections=\{connections\}/,
    '必须存在一个被 scale 的内容层，且 ConnectionLines 在它里面（连线才能跟着画布一起变换）');
  assert.doesNotMatch(canvasSource, /function ConnectionLines\(\{[^}]*viewport/);
  assert.match(canvasSource, /<StudioImageNode[\s\S]*?onDoubleClick=\{node => openImagePreview/);
  assert.match(canvasSource, /<StudioSourceNode[\s\S]*?onDoubleClick=\{preview => openImagePreview/);
});
