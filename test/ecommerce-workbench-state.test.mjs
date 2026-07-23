import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_SLOT_PLAN,
  buildUploadDeck,
  createWorkbenchState,
  nextProductSlot,
  reconcilePackage,
  summarizePackage,
} from '../src/pages/Home/ec/workbenchState.js';

test('guides each added product photo to a complementary angle', () => {
  assert.equal(nextProductSlot(0).key, 'front');
  assert.equal(nextProductSlot(0).label, '正面图');
  assert.equal(nextProductSlot(1).key, 'angle');
  assert.equal(nextProductSlot(1).label, '45°侧面图');
  assert.equal(nextProductSlot(2).label, '背面图');
  assert.equal(nextProductSlot(3).key, 'detail');
  assert.equal(nextProductSlot(3).label, '细节图');
  assert.equal(nextProductSlot(4).label, '场景图');
  assert.equal(nextProductSlot(99).key, PRODUCT_SLOT_PLAN.at(-1).key);
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

test('new workbench state starts with a smart package and independent SKU data', () => {
  const state = createWorkbenchState();

  assert.equal(state.packageMode, 'smart');
  assert.deepEqual(state.skus, []);
  assert.equal(summarizePackage({ platform: 'smart', images: [] }), '智能套图方案');
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
