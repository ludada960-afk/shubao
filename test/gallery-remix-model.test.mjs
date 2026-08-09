import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryRemixCheckpoint } from '../src/pages/Home/galleryRemixModel.js';

test('ecommerce gallery remix restores prompt plus product and style references', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'case-1',
    type: 'ecommerce',
    title: '便捷酱料盒',
    hint: '生成一套暖色厨房场景电商图',
    platform: '淘宝/天猫',
    images: [
      { url: '/gallery/ecommerce/case-1/scene.webp', label: '使用场景图' },
      { url: '/gallery/ecommerce/case-1/white.webp', label: '标准白底图' },
      { url: '/gallery/ecommerce/case-1/detail.webp', label: '材质细节图' },
    ],
  });

  assert.equal(checkpoint.project.kind, 'ecommerce');
  assert.equal(checkpoint.version.inputSnapshot.description, '生成一套暖色厨房场景电商图');
  assert.deepEqual(checkpoint.version.inputSnapshot.productImages.map(item => item.url), [
    '/gallery/ecommerce/case-1/white.webp',
  ]);
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceImages.map(item => item.url), [
    '/gallery/ecommerce/case-1/scene.webp',
    '/gallery/ecommerce/case-1/detail.webp',
  ]);
});

test('xiaohongshu gallery remix restores copy and up to three visual references', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'note-1',
    title: '厦门旅行攻略',
    _inputText: '厦门三天两夜旅行攻略',
    cover_url: '/gallery/xhs/cover.webp',
    image_urls: ['/gallery/xhs/2.webp', '/gallery/xhs/3.webp', '/gallery/xhs/4.webp'],
  });

  assert.equal(checkpoint.project.kind, 'xiaohongshu');
  assert.equal(checkpoint.version.inputSnapshot.text, '厦门三天两夜旅行攻略');
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceImages, [
    '/gallery/xhs/cover.webp',
    '/gallery/xhs/2.webp',
    '/gallery/xhs/3.webp',
  ]);
});
