import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);

test('shared responsive image component reserves layout and reveals loaded pixels without waiting for decode', async () => {
  const [source, model] = await Promise.all([
    readFile(new URL('./src/components/ResponsiveImage.jsx', root), 'utf8'),
    readFile(new URL('./src/components/responsiveImageModel.js', root), 'utf8'),
  ]);
  assert.match(source, /responsiveImageCandidates\(src, variant\)/);
  assert.match(source, /responsiveImageSrcSet\(src, 'avif'\)/);
  assert.match(source, /responsiveImageSrcSet\(src, 'webp'\)/);
  assert.match(model, /proxyImg\(raw, variant\)/);
  assert.match(model, /proxyImg\(raw, 'full'\)/);
  assert.match(model, /RESPONSIVE_IMAGE_WIDTHS/);
  assert.match(source, /srcSet=\{retryAvifSrcSet\}/);
  assert.match(source, /srcSet=\{retryWebpSrcSet\}/);
  assert.match(source, /sizes=\{sizes\}/);
  assert.match(source, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(source, /decoding="async"/);
  assert.match(source, /fetchpriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(source, /\.decode\(\)/);
  assert.match(source, /responsive-image-skeleton/);
  assert.match(source, /setLoaded\(true\)/);
  assert.doesNotMatch(source, /await image\.decode\(\)/);
  assert.match(source, /objectFit: 'contain'/);
  assert.match(source, /retryCount/);
  assert.match(source, /IMAGE_RETRY_DELAYS_MS/);
  assert.match(source, /retryImageUrl/);
  assert.match(source, /sourceKeyRef\s*=\s*useRef/);
  assert.match(source, /if\s*\(sourceKeyRef\.current\s*===\s*nextKey\)\s*return/);
  assert.match(source, /sourceKeyRef\.current\s*=\s*nextKey/);
});

test('large public showcase images use the variant delivery route instead of shipping source PNG files', async () => {
  const [apiSource, serverSource] = await Promise.all([
    readFile(new URL('./src/services/api.js', root), 'utf8'),
    readFile(new URL('./server/index.mjs', root), 'utf8'),
  ]);
  assert.match(apiSource, /url\.startsWith\('\/images\/'\)/);
  assert.match(apiSource, /\/api\/public-image\?path=/);
  assert.match(apiSource, /value\.startsWith\('\/api\/public-image'\)/);
  assert.match(serverSource, /app\.get\('\/api\/public-image'/);
  assert.match(serverSource, /PUBLIC_IMAGE_ROOTS/);
  assert.match(serverSource, /readLocalVariant/);
});

test('work, case, detail, and canvas surfaces declare purpose-sized candidates', async () => {
  const [canvas, gallery, noteModal] = await Promise.all([
    readFile(new URL('./src/pages/EcCanvas/index.jsx', root), 'utf8'),
    readFile(new URL('./src/pages/Home/GallerySection.jsx', root), 'utf8'),
    readFile(new URL('./src/NoteModal.jsx', root), 'utf8'),
  ]);
  assert.match(canvas, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(canvas, /ResponsiveImage[\s\S]*variant="canvas"/);
  assert.match(gallery, /ResponsiveImage[\s\S]*variant="thumb"/);
  assert.match(gallery, /predecodeResponsiveImage/);
  assert.match(noteModal, /variant="display"/);
  assert.match(noteModal, /variant="thumb"/);
});
