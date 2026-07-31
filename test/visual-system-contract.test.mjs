import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../src/styles/semanticTokens.css', import.meta.url), 'utf8');
const canvasChrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
const canvasCss = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

test('semantic tokens define command success warning danger neutral focus and image states', () => {
  for (const token of ['--command:', '--success:', '--warning:', '--danger:', '--neutral-surface:', '--focus-ring:', '--image-loading:', '--image-error:', '--image-selected:']) {
    assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Canvas toolbar consumes semantic command tokens', () => {
  assert.match(canvasChrome, /ec-canvas-command/);
  assert.match(canvasCss, /--canvas-command:\s*var\(--command\)/);
  assert.match(canvasCss, /--canvas-focus:\s*var\(--focus-ring\)/);
  assert.match(canvasCss, /outline:\s*2px solid var\(--canvas-focus\)/);
});
