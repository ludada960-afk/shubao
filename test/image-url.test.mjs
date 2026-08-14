import assert from 'node:assert/strict';
import test from 'node:test';

import { galleryImg, imageVariantUrl } from '../src/services/api.js';
import { responsiveImageCandidates, responsiveImageSrcSet } from '../src/components/responsiveImageModel.js';

test('gallery image URLs are stable across calls so browser caching can work', () => {
  const first = galleryImg('xm', '01-封面.png');
  const second = galleryImg('xm', '01-封面.png');
  assert.equal(first, second);
  assert.equal(first.includes('t='), false);
});

test('client image variants include local gallery thumbnails', () => {
  assert.equal(
    imageVariantUrl('/api/gallery-image?id=xm&file=cover.png', 'thumb'),
    '/api/gallery-image?id=xm&file=cover.png&variant=thumb&v=3',
  );
});

test('responsive image sets expose stable DPR candidates in both modern formats', () => {
  assert.equal(
    responsiveImageSrcSet('/api/generated-assets/a.png', 'avif'),
    [320, 640, 960, 1600]
      .map(width => `/api/generated-assets/a.png?variant=w${width}&format=avif&v=3 ${width}w`)
      .join(', '),
  );
});

test('responsive images fall back from optimized proxy to full and direct remote sources', () => {
  assert.deepEqual(
    responsiveImageCandidates('https://cdn.example.com/product.png', 'canvas'),
    [
      '/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Fproduct.png&variant=canvas&v=3',
      '/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Fproduct.png',
      'https://cdn.example.com/product.png',
    ],
  );
  assert.deepEqual(
    responsiveImageCandidates('/api/generated-assets/a.png', 'thumb'),
    ['/api/generated-assets/a.png?variant=thumb&v=3', '/api/generated-assets/a.png'],
  );
});

test('web-ready public assets bypass the image API on first paint', () => {
  assert.deepEqual(
    responsiveImageCandidates('/images/home/tryon-showcase/editorial-flatlay-v3.webp', 'thumb'),
    ['/images/home/tryon-showcase/editorial-flatlay-v3.webp'],
  );
  assert.equal(
    responsiveImageSrcSet('/gallery/ecommerce/example/cover.webp', 'avif'),
    '',
  );
});
