import assert from 'node:assert/strict';
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
    assert.ok(['fixture', 'production'].includes(item.status));
    assert.ok(item.assets.length > 0);
    assert.ok(item.assets.every(asset => asset.src.startsWith('/images/')));
    assert.ok(item.assets.every(asset => /^\d+:\d+$/.test(asset.ratio)));
    assert.ok(item.assets.every(asset => asset.label && asset.intent));
  }
});

test('reference try-on describes the three real user-visible stages', () => {
  const item = productionCaseById('tryon-reference');
  assert.deepEqual(item.assets.map(asset => asset.role), ['source', 'reference', 'result']);
  assert.deepEqual(item.assets.map(asset => asset.label), ['商品与穿搭', '参考模特', '上身结果']);
});

test('product suite has a source and a publishable output deck', () => {
  const item = productionCaseById('product-suite');
  assert.ok(item.assets.some(asset => asset.role === 'source'));
  assert.ok(item.assets.filter(asset => asset.role === 'result').length >= 2);
});

test('visual cases support one input with multiple production outputs', () => {
  for (const id of ['free', 'poster', 'social-cover', 'brand-kv']) {
    const item = productionCaseById(id);
    assert.ok(item.assets.some(asset => asset.role === 'input'));
    assert.ok(item.assets.some(asset => asset.role === 'output'));
  }
});

test('production entries cannot omit task and request provenance', () => {
  for (const item of PRODUCTION_CASE_CATALOG.filter(entry => entry.status === 'production')) {
    assert.ok(item.assets.every(asset => asset.taskId && asset.requestKey));
  }
  assert.throws(() => productionCaseById('missing-case'), /Unknown production case/);
});
