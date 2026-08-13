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

test('anything try-on gallery remix restores complete role inputs instead of cropped outputs', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'tryon-reference',
    type: 'ecommerce',
    title: '商品与模特精准上身',
    intent: 'anything_tryon',
    prompt: '保留商品版型与模特姿态，生成自然上身结果',
    assets: [
      { url: '/full-product.png', label: '商品与穿搭', role: 'source', width: 1200, height: 1600 },
      { url: '/full-model.png', label: '参考模特', role: 'reference', width: 1200, height: 1600 },
      { url: '/result.png', label: '上身结果', role: 'result', width: 1200, height: 1600 },
    ],
  });

  assert.equal(checkpoint.project.kind, 'ecommerce');
  assert.equal(checkpoint.version.inputSnapshot.abilityRecipe.id, 'anything_tryon');
  assert.equal(checkpoint.version.inputSnapshot.personMode, 'reference');
  assert.deepEqual(checkpoint.version.inputSnapshot.roleImages.items.map(item => item.url), ['/full-product.png']);
  assert.deepEqual(checkpoint.version.inputSnapshot.roleImages.person.map(item => item.url), ['/full-model.png']);
  assert.deepEqual(checkpoint.version.inputSnapshot.roleImages.scene, []);
  assert.deepEqual(checkpoint.version.inputSnapshot.productImages.map(item => item.url), ['/full-product.png']);
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceImages.map(item => item.url), ['/full-model.png']);
});
