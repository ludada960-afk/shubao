import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const legacyNodes = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/index.jsx', import.meta.url), 'utf8');
const modularPort = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/CanvasPortHandle.jsx', import.meta.url), 'utf8');

test('Canvas measures actual DOM port rectangles and supplies their centers to connection geometry', () => {
  assert.match(canvasSource, /querySelectorAll\('\[data-canvas-port-role\]'\)/);
  assert.match(canvasSource, /portElement\.getBoundingClientRect\(\)/);
  assert.match(canvasSource, /getCanvasDomPortCenter/);
  assert.match(canvasSource, /portCenters:\s*renderedPortCenters\[node\.id\]/);
  assert.match(canvasSource, /data-canvas-port-role="input"/);
  assert.match(canvasSource, /data-canvas-port-role="output"/);
  assert.match(legacyNodes, /data-canvas-port-role=\{role\}/);
  assert.match(modularPort, /data-canvas-port-role=\{role\}/);
});
