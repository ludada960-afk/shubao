import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeWorkImages } from '../src/utils/workImages.js';
import {
  filterWorksForOwner,
  isPersistentEcommerceImageUrl,
  mergeWorkCollections,
  replaceCachedWorksForOwner,
  stableWorkKey,
} from '../src/utils/workRecords.js';

const STABLE_A = `/api/generated-assets/${'a'.repeat(64)}.png`;
const STABLE_B = `/api/generated-assets/${'b'.repeat(64)}.jpg`;
const STABLE_C = `/api/generated-assets/${'c'.repeat(64)}.webp`;

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

test('keeps only durable ecommerce image URLs in saved work records', () => {
  assert.equal(isPersistentEcommerceImageUrl(STABLE_A), true);
  assert.equal(isPersistentEcommerceImageUrl('https://cdn.example.com/stable-image.png'), true);
  assert.equal(isPersistentEcommerceImageUrl('blob:https://shuimg.cn/image'), false);
  assert.equal(isPersistentEcommerceImageUrl('data:image/png;base64,abc'), false);
  assert.equal(isPersistentEcommerceImageUrl('/api/ec-temp-img/source.png'), false);
  assert.equal(isPersistentEcommerceImageUrl('/uploads/source.png'), false);
});

test('uses server works first and deduplicates stale local ecommerce copies by task and stable images', () => {
  const server = {
    _ecResult: true,
    _saveKey: 'ec-task-101',
    taskId: '101',
    generationStatus: 'generating',
    product_name: '保温杯',
    images: [{ key: 'main-1', url: STABLE_A, label: '商品识别主图' }],
  };
  const sameTaskLocal = {
    ...server,
    images: [{ key: 'old', url: 'blob:https://shuimg.cn/old' }],
  };
  const sameImageOtherKey = {
    _ecResult: true,
    _saveKey: 'ec-task-legacy',
    generationStatus: 'completed',
    product_name: '旧副本',
    images: [{ key: 'main-1', url: STABLE_A }],
  };
  const sameTaskOtherKey = {
    _ecResult: true,
    _saveKey: 'legacy-task-101',
    taskId: '101',
    generationStatus: 'completed',
    product_name: '同任务旧副本',
    images: [{ key: 'detail-1', url: STABLE_B }],
  };
  const separateWork = {
    _ecResult: true,
    _saveKey: 'ec-task-102',
    generationStatus: 'needs_review',
    product_name: '咖啡杯',
    images: [{ key: 'detail-1', url: STABLE_C }],
  };

  const works = mergeWorkCollections([server], [sameTaskLocal, sameImageOtherKey, sameTaskOtherKey, separateWork]);

  assert.equal(works.length, 2);
  assert.deepEqual(works[0].images.map(image => image.url), [STABLE_A]);
  assert.equal(works[0].generationStatus, 'generating');
  assert.equal(works[1]._saveKey, 'ec-task-102');
  assert.equal(stableWorkKey(works[0]), 'ec-task-101');
});

test('retains an in-progress work without images but drops a broken completed record', () => {
  const works = mergeWorkCollections([
    {
      _ecResult: true,
      _saveKey: 'ec-task-generating',
      generationStatus: 'generating',
      product_name: '待生成商品',
      images: [{ key: 'temp', url: 'data:image/png;base64,abc' }],
    },
    {
      _ecResult: true,
      _saveKey: 'ec-task-broken',
      generationStatus: 'completed',
      product_name: '损坏历史记录',
      images: [{ key: 'temp', url: '/api/ec-temp-img/source.png' }],
    },
  ]);

  assert.deepEqual(works.map(work => work._saveKey), ['ec-task-generating']);
});

test('local work fallback never exposes another owner or an unowned legacy cache entry', () => {
  const works = filterWorksForOwner([
    { _saveKey: 'mine', _phone: ' Owner@Example.com ' },
    { _saveKey: 'other', _phone: 'other@example.com' },
    { _saveKey: 'legacy-unowned' },
  ], 'owner@example.com');

  assert.deepEqual(works.map(work => work._saveKey), ['mine']);
  assert.deepEqual(filterWorksForOwner(works, ''), []);
});

test('replacing one owner cache preserves another owner unsynced works', () => {
  const cache = [
    { _saveKey: 'owner-old', _phone: 'owner@example.com' },
    { _saveKey: 'other-unsynced', _phone: 'other@example.com' },
    { _saveKey: 'legacy-unowned' },
  ];

  const replaced = replaceCachedWorksForOwner(cache, 'owner@example.com', [
    { _saveKey: 'owner-server', _phone: 'owner@example.com' },
    { _saveKey: 'spoofed-other', _phone: 'other@example.com' },
  ]);

  assert.deepEqual(replaced.map(work => work._saveKey), [
    'owner-server',
    'other-unsynced',
    'legacy-unowned',
  ]);
});
