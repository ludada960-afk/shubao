import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

test('shared responsive image component uses delivery variants and browser decode scheduling', async () => {
  const source = await readFile(new URL('./src/components/ResponsiveImage.jsx', root), 'utf8');
  assert.match(source, /proxyImg\(src, variant\)/);
  assert.match(source, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /fetchPriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(source, /objectFit: 'contain'/);
});

test('work and canvas surfaces use distinct delivery variants', async () => {
  const [works, canvas] = await Promise.all([
    readFile(new URL('./src/pages/Works/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/EcCanvas/index.jsx', root), 'utf8'),
  ]);
  assert.match(works, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(canvas, /ResponsiveImage[\s\S]*variant="canvas"/);
});
