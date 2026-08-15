import assert from 'node:assert/strict';
import test from 'node:test';

import {
  manifestOutputsToGalleryImages,
  validateProductionCaseManifest,
} from '../src/pages/Home/productionCaseManifest.js';

const VALID_MANIFEST = {
  id: 'earbuds-suite',
  title: '珍珠白降噪耳机商品套图',
  category: 'ecommerce',
  prompt: '为珍珠白降噪耳机生成完整商品套图。',
  sourceAssets: [
    { role: 'product', url: '/images/product.png', name: '商品母图' },
  ],
  outputs: [
    {
      id: 'hero',
      role: 'finalComposite',
      title: '完整套图成片',
      prompt: '将五张详情图编排成具有倾斜动势的 4:3 商品套图成片。',
      url: '/images/hero.png',
      taskId: 'canvas_hero',
      requestKey: 'showcase-earbuds-hero-v3',
      quoteId: 'quote_hero',
      ratio: '4:3',
    },
  ],
  cover: { strategy: 'single', outputIds: ['hero'] },
  remix: {
    mode: 'product_suite',
    prompt: '为珍珠白降噪耳机生成完整商品套图。',
    sourceAssetRoles: ['product'],
  },
};

test('new production outputs require exact prompts', () => {
  assert.throws(() => validateProductionCaseManifest({
    ...VALID_MANIFEST,
    outputs: [{ ...VALID_MANIFEST.outputs[0], prompt: '' }],
  }), /outputs\[0\]\.prompt/);
});

test('production manifests reject missing replay and source contracts', () => {
  assert.throws(() => validateProductionCaseManifest({
    ...VALID_MANIFEST,
    remix: { ...VALID_MANIFEST.remix, prompt: '' },
  }), /remix\.prompt/);

  assert.throws(() => validateProductionCaseManifest({
    ...VALID_MANIFEST,
    sourceAssets: [{ role: '', url: '/images/product.png', name: '商品母图' }],
  }), /sourceAssets\[0\]\.role/);
});

test('gallery images preserve exact prompts and production provenance', () => {
  const images = manifestOutputsToGalleryImages(VALID_MANIFEST);
  assert.deepEqual(images, [{
    id: 'hero',
    role: 'finalComposite',
    title: '完整套图成片',
    label: '完整套图成片',
    prompt: '将五张详情图编排成具有倾斜动势的 4:3 商品套图成片。',
    url: '/images/hero.png',
    src: '/images/hero.png',
    taskId: 'canvas_hero',
    requestKey: 'showcase-earbuds-hero-v3',
    quoteId: 'quote_hero',
    ratio: '4:3',
    provenance: 'production',
  }]);
});

test('validated production manifests are deeply frozen', () => {
  const manifest = validateProductionCaseManifest(structuredClone(VALID_MANIFEST));
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.outputs));
  assert.ok(Object.isFrozen(manifest.outputs[0]));
  assert.ok(Object.isFrozen(manifest.sourceAssets));
  assert.ok(Object.isFrozen(manifest.remix));
});
