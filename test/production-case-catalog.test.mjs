import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  PRODUCTION_CASE_CATALOG,
  productionCaseById,
} from '../src/pages/Home/productionCaseCatalog.js';

test('production case catalog gives every showcase asset a stable display contract', () => {
  assert.deepEqual(PRODUCTION_CASE_CATALOG.map(item => item.id), [
    'product-suite',
    'tryon-angles',
    'tryon-reference',
    'free',
    'poster',
    'social-cover',
    'brand-kv',
  ]);
  for (const item of PRODUCTION_CASE_CATALOG) {
    assert.ok(['fixture', 'curated-showcase', 'production'].includes(item.status));
    assert.ok(item.assets.length > 0);
    assert.ok(item.assets.every(asset => asset.src.startsWith('/images/') || asset.src.startsWith('/gallery/')));
    assert.ok(item.assets.every(asset => /^\d+:\d+$/.test(asset.ratio)));
    assert.ok(item.assets.every(asset => asset.label && asset.intent));
  }
});

test('ecommerce showcases are production-backed instead of curated stand-ins', () => {
  for (const id of ['product-suite', 'tryon-angles', 'tryon-reference']) {
    const item = productionCaseById(id);
    assert.equal(item.status, 'production');
    assert.ok(item.assets.filter(asset => asset.role === 'result').every(asset => asset.taskId && asset.requestKey));
    assert.ok(item.assets.every(asset => existsSync(new URL(`../public${asset.src}`, import.meta.url))));
  }
});

test('reference try-on preserves the complete product, model, and generated result stages', () => {
  const item = productionCaseById('tryon-reference');
  const stages = item.assets.filter(asset => asset.displayRole !== 'workflowBanner');
  assert.deepEqual(stages.map(asset => asset.role), ['source', 'reference', 'result']);
  assert.deepEqual(stages.map(asset => asset.label), ['完整商品与穿搭', '完整参考模特', '时尚街拍上身结果']);
  assert.deepEqual(stages.map(asset => asset.ratio), ['3:8', '1:4', '9:16']);
  assert.equal(item.assets.find(asset => asset.displayRole === 'workflowBanner').ratio, '16:9');
});

test('multi-angle try-on exposes four independent complete model views', () => {
  const item = productionCaseById('tryon-angles');
  const angleSources = item.assets.filter(asset => asset.role === 'result' && !asset.displayRole);
  assert.equal(angleSources.length, 4);
  assert.equal(new Set(angleSources.map(asset => asset.src)).size, 4);
  assert.ok(angleSources.every(asset => asset.ratio === '9:16'));
  assert.equal(item.assets.find(asset => asset.displayRole === 'workflowBanner').ratio, '16:9');
});

test('product suite has one final composite, five detail sources, and three rich selector previews', () => {
  const item = productionCaseById('product-suite');
  assert.ok(item.assets.some(asset => asset.role === 'source'));
  const finalAssets = item.assets.filter(asset => asset.displayRole === 'finalComposite');
  const detailAssets = item.assets.filter(asset => ['detailSource', 'selectorPreview'].includes(asset.displayRole));
  const previews = item.assets.filter(asset => asset.displayRole === 'selectorPreview');
  assert.equal(finalAssets.length, 1);
  assert.equal(finalAssets[0].ratio, '1:1');
  assert.equal(detailAssets.length, 5);
  assert.deepEqual(previews.map(asset => asset.selectorKind), ['structure', 'usage', 'scene']);
  assert.ok(previews.every(asset => asset.isWhiteBackground !== true));
  assert.ok(previews.every(asset => asset.ratio === '3:4'));
  assert.doesNotMatch(item.assets.map(asset => asset.src).join('\n'), /cobalt-lamp/);
});

test('try-on selector previews are purpose-built wide frames from production-backed assets', () => {
  const item = productionCaseById('tryon-angles');
  const previews = item.assets.filter(asset => asset.displayRole === 'selectorPreview');
  assert.equal(previews.length, 3);
  assert.ok(previews.every(asset => asset.ratio === '4:3'));
  assert.ok(previews.every(asset => asset.provenance === 'production-composite'));
});

test('social formats declare Xiaohongshu, Bilibili, and Douyin in visual order', () => {
  const chapter = productionCaseById('social-cover').chapters.find(item => item.id === 'social-formats');
  assert.deepEqual(chapter.assets.map(asset => asset.platform), ['xiaohongshu', 'bilibili', 'douyin']);
});

test('gallery product suite metadata describes the production earbuds instead of the retired lamp fixture', async () => {
  const source = await import('../src/pages/Home/galleryModel.js');
  const [item] = source.productionGalleryItems([productionCaseById('product-suite')]);
  assert.match(item.title, /耳机商品套图/);
  assert.doesNotMatch(item.title, /玻璃灯/);
  assert.equal(item.cover_url, '/images/home/ecommerce-showcase/earbuds-suite-composite.png');
  assert.equal(item.ratio, '1:1');
  assert.equal(item.images.length, productionCaseById('product-suite').manifest.outputs.length);
  assert.ok(item.images.every(image => image.prompt && image.requestKey && image.taskId));
  assert.deepEqual(item.remix.sourceAssets, productionCaseById('product-suite').manifest.sourceAssets);
});

test('visual cases expose six distinct production outputs across two chapters', () => {
  for (const id of ['free', 'poster', 'social-cover', 'brand-kv']) {
    const item = productionCaseById(id);
    assert.equal(item.status, 'production');
    assert.equal(item.chapters.length, 2);
    assert.deepEqual(item.chapters.map(chapter => chapter.assets.length), [3, 3]);
    assert.equal(new Set(item.assets.map(asset => asset.src)).size, 6);
    assert.ok(item.assets.every(asset => asset.role === 'output'));
  }
});

test('production output entries cannot omit task and request provenance', () => {
  for (const item of PRODUCTION_CASE_CATALOG.filter(entry => entry.status === 'production')) {
    assert.ok(item.assets.filter(asset => ['result', 'output'].includes(asset.role)).every(asset => asset.taskId && asset.requestKey));
    assert.ok(item.assets.every(asset => existsSync(new URL(`../public${asset.src}`, import.meta.url))));
  }
  assert.throws(() => productionCaseById('missing-case'), /Unknown production case/);
});
