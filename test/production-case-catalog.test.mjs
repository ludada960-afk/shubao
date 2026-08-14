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

test('reference try-on describes three honest curated user-visible stages', () => {
  const item = productionCaseById('tryon-reference');
  assert.equal(item.status, 'curated-showcase');
  assert.deepEqual(item.assets.map(asset => asset.role), ['source', 'reference', 'result']);
  assert.deepEqual(item.assets.map(asset => asset.label), ['完整商品与穿搭', '完整参考模特', '时尚街拍上身结果']);
  assert.ok(item.assets.every(asset => !asset.taskId && !asset.requestKey));
  assert.ok(item.assets.every(asset => asset.ratio === '3:4'));
});

test('product suite has a source and a publishable output deck', () => {
  const item = productionCaseById('product-suite');
  assert.ok(item.assets.some(asset => asset.role === 'source'));
  assert.ok(item.assets.filter(asset => asset.role === 'result').length >= 2);
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

test('production entries cannot omit task and request provenance', () => {
  for (const item of PRODUCTION_CASE_CATALOG.filter(entry => entry.status === 'production')) {
    assert.ok(item.assets.every(asset => asset.taskId && asset.requestKey));
    assert.ok(item.assets.every(asset => existsSync(new URL(`../public${asset.src}`, import.meta.url))));
  }
  assert.throws(() => productionCaseById('missing-case'), /Unknown production case/);
});
