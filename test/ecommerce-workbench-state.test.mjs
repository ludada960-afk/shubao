import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplementDeck,
  buildUploadDeck,
  createSmartConfiguration,
  createSmartOverrides,
  createWorkbenchState,
  deriveEffectiveSmartOverrides,
  nextProductSlot,
  reconcilePackage,
  summarizeCommerceConfiguration,
  summarizePackage,
  withEcommerceCanvasSources,
} from '../src/pages/Home/ec/workbenchState.js';

test('names each uploaded product image with one canonical product label', () => {
  assert.equal(nextProductSlot(0).key, 'front');
  assert.equal(nextProductSlot(0).label, '产品图1');
  assert.equal(nextProductSlot(1).key, 'angle');
  assert.equal(nextProductSlot(1).label, '产品图2');
  assert.equal(nextProductSlot(2).label, '产品图3');
  assert.equal(nextProductSlot(3).key, 'detail');
  assert.equal(nextProductSlot(3).label, '产品图4');
  assert.equal(nextProductSlot(4).label, '产品图5');
  assert.equal(nextProductSlot(99).key, 'product-100');
  assert.equal(nextProductSlot(99).label, '产品图100');
});

test('restoring the smart package discards an unapplied SKU package change', () => {
  const baseline = ['white_bg', 'main', 'detail'];
  const result = reconcilePackage({
    baseline,
    draft: baseline,
    applied: ['white_bg', 'main', 'detail', 'sku'],
  });

  assert.deepEqual(result, baseline);
});

test('new workbench state starts with a Taobao package and independent SKU data', () => {
  const state = createWorkbenchState();

  assert.equal(state.packageMode, 'taobao');
  assert.deepEqual(state.skus, []);
  assert.equal(summarizePackage({ platform: 'taobao', images: [] }), '淘宝套图方案');
});

test('default configuration starts from Taobao and keeps every editable panel independent', () => {
  assert.deepEqual(createSmartOverrides(), {
    sizing: false,
    style: false,
    params: false,
    sku: false,
    copy: false,
    settings: false,
  });
  assert.deepEqual(createSmartConfiguration(), {
    platform: 'taobao',
    commerceContext: {
      platform: 'taobao',
      contentType: 'main',
      targetLanguage: 'zh-CN',
    },
    sizing: { smart: true, images: [] },
    styleSkill: 'smart',
    customColors: null,
    productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
    skus: [],
    copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
    genSettings: { resolution: '2K', negativePrompt: '' },
  });
});

test('effective smart overrides clear immediately when the last SKU is deleted', () => {
  const configured = deriveEffectiveSmartOverrides({
    platform: 'taobao',
    sizing: { smart: true, images: [] },
    styleSkill: 'smart',
    customColors: null,
    productParams: {},
    skus: [{ color: '月岩白', count: 1 }],
    copywriting: {},
    genSettings: { resolution: '2K', negativePrompt: '' },
  });
  assert.equal(configured.sku, true);

  const cleared = deriveEffectiveSmartOverrides({
    platform: 'taobao',
    sizing: { smart: true, images: [] },
    styleSkill: 'smart',
    customColors: null,
    productParams: {},
    skus: [],
    copywriting: {},
    genSettings: { resolution: '2K', negativePrompt: '' },
  });
  assert.equal(cleared.sku, false);
  assert.equal(Object.values(cleared).some(Boolean), false);
});

test('configuration summaries stay compact while exposing the meaningful selections', () => {
  assert.equal(summarizeCommerceConfiguration('sizing', {
    images: [
      { key: 'white_bg', count: 1 },
      { key: 'main_text', count: 3 },
      { key: 'transparent', count: 1 },
      { key: 'detail', count: 5 },
    ],
  }), '1白底丨3主图丨1素材丨5详情');
  assert.equal(summarizeCommerceConfiguration('sku', {
    skus: [{ color: '月岩白', count: 2 }],
  }), '1变体丨2张');
  assert.equal(summarizeCommerceConfiguration('params', {
    productParams: { material: '不锈钢', size: '20cm', craft: '拉丝' },
  }), '材质丨尺寸丨工艺');
  assert.equal(summarizeCommerceConfiguration('params', {
    productParams: {
      preserveMaterial: true,
      preservePattern: false,
      consistentPersonScene: true,
    },
  }), '材质锁定丨人物场景一致');
});

test('upload deck keeps two starter cards while later uploads enter scrollable rails', () => {
  assert.deepEqual(buildUploadDeck({ productImages: [], refImages: [] }), {
    productSlot: 'front',
    productRail: [],
    referenceRail: [],
  });
  assert.deepEqual(buildUploadDeck({ productImages: ['a', 'b'], refImages: ['r'] }), {
    productSlot: 'back',
    productRail: ['a', 'b'],
    referenceRail: ['r'],
  });
});

test('supplement deck keeps inherited and newly added product/reference images independent', () => {
  const deck = buildSupplementDeck({
    inheritedProductImages: ['/product-old.png'],
    addedProductImages: [{ url: '/product-new.png' }],
    inheritedReferenceImages: ['/reference-old.png'],
    addedReferenceImages: [{ url: '/reference-new.png' }],
  });
  assert.deepEqual(deck.productImages.map(image => [image.url, image.locked, image.status]), [
    ['/product-old.png', true, '已带入'],
    ['/product-new.png', false, '本轮新增'],
  ]);
  assert.deepEqual(deck.referenceImages.map(image => [image.url, image.locked, image.status]), [
    ['/reference-old.png', true, '已带入'],
    ['/reference-new.png', false, '本轮新增'],
  ]);
});

test('completed delivery keeps original product and reference assets for the canvas', () => {
  const result = withEcommerceCanvasSources(
    { status: 'completed', images: { main: '/main.png' } },
    {
      productAssets: [{ assetId: 'product-1', url: '/product.png' }, { url: '' }],
      referenceAssets: [{ assetId: 'reference-1', url: '/reference.png' }],
    },
  );
  assert.deepEqual(result.productAssets, [{ assetId: 'product-1', url: '/product.png' }]);
  assert.deepEqual(result.referenceAssets, [{ assetId: 'reference-1', url: '/reference.png' }]);
  assert.equal(result.images.main, '/main.png');
});
