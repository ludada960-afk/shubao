import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeWorkImages } from '../src/utils/workImages.js';

test('normalizes object-based ecommerce images for gallery and canvas rendering', () => {
  assert.deepEqual(normalizeWorkImages({
    white_bg: '/api/generated-assets/white.png',
    scene: { url: '/api/generated-assets/scene.png', label: '场景图' },
    empty: '',
  }), [
    { url: '/api/generated-assets/white.png', key: 'white_bg', label: 'white_bg' },
    { url: '/api/generated-assets/scene.png', key: 'scene', label: '场景图' },
  ]);
});

test('normalizes array-based legacy images without losing labels', () => {
  assert.deepEqual(normalizeWorkImages([
    '/legacy/one.png',
    { url: '/legacy/two.png', key: 'detail_1', label: '详情图' },
    { src: '', key: 'missing' },
  ]), [
    { url: '/legacy/one.png', key: 'image_1', label: 'image_1' },
    { url: '/legacy/two.png', key: 'detail_1', label: '详情图' },
  ]);
});
