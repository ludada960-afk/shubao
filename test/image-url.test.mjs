import assert from 'node:assert/strict';
import test from 'node:test';

import { galleryImg, imageVariantUrl } from '../src/services/api.js';
import { responsiveImageCandidates } from '../src/components/responsiveImageModel.js';

test('gallery image URLs are stable across calls so browser caching can work', () => {
  const first = galleryImg('xm', '01-封面.png');
  const second = galleryImg('xm', '01-封面.png');
  assert.equal(first, second);
  assert.equal(first.includes('t='), false);
});

test('client image variants include local gallery thumbnails', () => {
  assert.equal(
    imageVariantUrl('/api/gallery-image?id=xm&file=cover.png', 'thumb'),
    '/api/gallery-image?id=xm&file=cover.png&variant=thumb',
  );
});

test('responsive images fall back from optimized proxy to full and direct remote sources', () => {
  assert.deepEqual(
    responsiveImageCandidates('https://cdn.example.com/product.png', 'canvas'),
    [
      '/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Fproduct.png&variant=canvas',
      '/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Fproduct.png',
      'https://cdn.example.com/product.png',
    ],
  );
  assert.deepEqual(
    responsiveImageCandidates('/api/generated-assets/a.png', 'thumb'),
    ['/api/generated-assets/a.png?variant=thumb', '/api/generated-assets/a.png'],
  );
});
