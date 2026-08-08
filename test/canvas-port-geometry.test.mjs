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
  assert.match(canvasSource, /transform: `translate\(\$\{viewport\.x\}px,\$\{viewport\.y\}px\) scale\(\$\{viewport\.scale\}\)`[\s\S]*?<ConnectionLines connections=\{connections\}/);
  assert.doesNotMatch(canvasSource, /function ConnectionLines\(\{[^}]*viewport/);
  assert.match(canvasSource, /<StudioImageNode[\s\S]*?onDoubleClick=\{node => openImagePreview/);
  assert.match(canvasSource, /<StudioSourceNode[\s\S]*?onDoubleClick=\{preview => openImagePreview/);
});
