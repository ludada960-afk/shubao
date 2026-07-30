import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const tokens = readFileSync(new URL('../src/styles/semanticTokens.css', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('semantic tokens define command success warning danger neutral focus and image states', () => {
  for (const token of ['--command:', '--success:', '--warning:', '--danger:', '--neutral-surface:', '--focus-ring:', '--image-loading:', '--image-error:', '--image-selected:']) {
    assert.match(tokens, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Canvas toolbar consumes semantic command tokens', () => {
  const toolbar = canvas.slice(canvas.indexOf('const handleNew'), canvas.indexOf('<main'));
  assert.match(toolbar, /var\(--command\)/);
  assert.match(toolbar, /var\(--focus-ring\)/);
});
