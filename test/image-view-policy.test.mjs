import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

test('shared responsive image component uses delivery variants and browser decode scheduling', async () => {
  const [source, model] = await Promise.all([
    readFile(new URL('./src/components/ResponsiveImage.jsx', root), 'utf8'),
    readFile(new URL('./src/components/responsiveImageModel.js', root), 'utf8'),
  ]);
  assert.match(source, /responsiveImageCandidates\(src, variant\)/);
  assert.match(model, /proxyImg\(raw, variant\)/);
  assert.match(model, /proxyImg\(raw, 'full'\)/);
  assert.match(source, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /fetchpriority=\{priority \? 'high' : 'auto'\}/);
  assert.doesNotMatch(source, /fetchPriority=/);
  assert.match(source, /objectFit: 'contain'/);
});

test('work, case, and canvas surfaces use purpose-sized delivery variants', async () => {
  const [works, canvas, gallery] = await Promise.all([
    readFile(new URL('./src/pages/Works/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/EcCanvas/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/Home/GallerySection.jsx', root), 'utf8'),
  ]);
  assert.match(works, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(canvas, /ResponsiveImage[\s\S]*variant="canvas"/);
  assert.match(gallery, /ResponsiveImage[\s\S]*variant="thumb"/);
});
