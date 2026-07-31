import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

test('shared responsive image component uses width candidates and reveals only decoded pixels', async () => {
  const [source, model] = await Promise.all([
    readFile(new URL('./src/components/ResponsiveImage.jsx', root), 'utf8'),
    readFile(new URL('./src/components/responsiveImageModel.js', root), 'utf8'),
  ]);
  assert.match(source, /responsiveImageCandidates\(src, variant\)/);
  assert.match(source, /responsiveImageSrcSet\(src, 'avif'\)/);
  assert.match(source, /responsiveImageSrcSet\(src, 'webp'\)/);
  assert.match(model, /proxyImg\(raw, variant\)/);
  assert.match(model, /proxyImg\(raw, 'full'\)/);
  assert.match(source, /srcSet=\{avifSrcSet\}/);
  assert.match(source, /sizes=\{sizes\}/);
  assert.match(source, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /fetchpriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(source, /\.decode\(\)/);
  assert.match(source, /objectFit: 'contain'/);
});

test('work, case, detail, and canvas surfaces declare purpose-sized candidates', async () => {
  const [works, canvas, gallery, noteModal] = await Promise.all([
    readFile(new URL('./src/pages/Works/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/EcCanvas/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/Home/GallerySection.jsx', root), 'utf8'),
    readFile(new URL('./src/NoteModal.jsx', root), 'utf8'),
  ]);
  assert.match(works, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(works, /sizes="56px"/);
  assert.match(canvas, /ResponsiveImage[\s\S]*variant="canvas"/);
  assert.match(gallery, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(gallery, /predecodeResponsiveImage/);
  assert.match(noteModal, /variant="display"/);
  assert.match(noteModal, /variant="thumb"/);
});
