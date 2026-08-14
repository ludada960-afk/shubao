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
  assert.deepEqual(item.assets.map(asset => asset.role), ['source', 'reference', 'result']);
  assert.deepEqual(item.assets.map(asset => asset.label), ['完整商品与穿搭', '完整参考模特', '时尚街拍上身结果']);
  assert.deepEqual(item.assets.map(asset => asset.ratio), ['3:8', '1:4', '9:16']);
});

test('multi-angle try-on exposes four independent complete model views', () => {
  const item = productionCaseById('tryon-angles');
  assert.deepEqual(item.assets.map(asset => asset.role), ['source', 'result', 'result', 'result', 'result']);
  assert.equal(new Set(item.assets.map(asset => asset.src)).size, 5);
  assert.ok(item.assets.slice(1).every(asset => asset.ratio === '9:16'));
});

test('product suite has a complete source and a publishable multi-image output deck', () => {
  const item = productionCaseById('product-suite');
  assert.ok(item.assets.some(asset => asset.role === 'source'));
  assert.ok(item.assets.filter(asset => asset.role === 'result').length >= 4);
  assert.doesNotMatch(item.assets.map(asset => asset.src).join('\n'), /cobalt-lamp/);
});

test('gallery product suite metadata describes the production earbuds instead of the retired lamp fixture', async () => {
  const source = await import('../src/pages/Home/galleryModel.js');
  const [item] = source.productionGalleryItems([productionCaseById('product-suite')]);
  assert.match(item.title, /耳机商品套图/);
  assert.doesNotMatch(item.title, /玻璃灯/);
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
