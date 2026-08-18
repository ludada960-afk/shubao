import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryRemixCheckpoint } from '../src/pages/Home/galleryRemixModel.js';
import { mergeGalleryReplayPrompts } from '../src/pages/Home/galleryReplayModel.js';

test('production product suite restores the exact prompt and manifest source roles', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'product-suite',
    type: 'ecommerce',
    title: '珍珠白降噪耳机商品套图',
    intent: 'product_suite',
    images: [{ url: '/generated-detail.png', label: '声学结构解析', role: 'detail' }],
    remix: {
      mode: 'product_suite',
      prompt: '为珍珠白耳机生成统一详情套图。',
      sourceAssets: [
        { role: 'product', url: '/earbuds-product.png', name: '商品母图' },
        { role: 'style', url: '/layout-reference.png', name: '排版参考' },
      ],
    },
  });

  const snapshot = checkpoint.version.inputSnapshot;
  assert.equal(snapshot.description, '为珍珠白耳机生成统一详情套图。');
  assert.equal(snapshot.abilityRecipe.id, 'product_suite');
  assert.deepEqual(snapshot.productImages.map(item => item.url), ['/earbuds-product.png']);
  assert.deepEqual(snapshot.referenceImages.map(item => item.url), ['/layout-reference.png']);
  assert.equal(snapshot.productImages[0].name, '商品母图');
  assert.doesNotMatch(snapshot.referenceImages.map(item => item.url).join('\n'), /generated-detail/);
});

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

test('prompt-only xiaohongshu gallery remix restores the prompt without gallery images', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'xm',
    title: '厦门旅行攻略',
    prompt: '厦门3天2夜旅游攻略',
    promptOnlyReplay: true,
    cover_url: '/gallery/xhs/cover.webp',
    image_urls: ['/gallery/xhs/2.webp', '/gallery/xhs/3.webp'],
  });

  assert.equal(checkpoint.version.inputSnapshot.text, '厦门3天2夜旅游攻略');
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceImages, []);
});

test('gallery prompt metadata replaces the built-in hint without changing case identity', () => {
  const items = [{ id: 'xm', title: '厦门旅行攻略', hint: '旧提示', promptOnlyReplay: true }];
  const merged = mergeGalleryReplayPrompts(items, [{ id: 'xm', prompt: '厦门3天2夜旅游攻略' }]);

  assert.equal(merged[0].id, 'xm');
  assert.equal(merged[0].prompt, '厦门3天2夜旅游攻略');
  assert.equal(merged[0].promptOnlyReplay, true);
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

test('anything try-on restores declared scene sources into the scene role', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'tryon-with-scene',
    type: 'ecommerce',
    title: '场景上身',
    intent: 'anything_tryon',
    remix: {
      mode: 'anything_tryon',
      prompt: '让完整穿搭进入参考街拍场景。',
      sourceAssets: [
        { role: 'product', url: '/full-product.png', name: '完整商品' },
        { role: 'reference_model', url: '/full-model.png', name: '参考模特' },
        { role: 'scene', url: '/street.png', name: '街拍场景' },
      ],
    },
  });

  const snapshot = checkpoint.version.inputSnapshot;
  assert.deepEqual(snapshot.roleImages.items.map(item => item.url), ['/full-product.png']);
  assert.deepEqual(snapshot.roleImages.person.map(item => item.url), ['/full-model.png']);
  assert.deepEqual(snapshot.roleImages.scene.map(item => item.url), ['/street.png']);
});
