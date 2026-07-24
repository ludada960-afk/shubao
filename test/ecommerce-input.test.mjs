import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEcommerceInput, roleForIndex } from '../server/ecommerceInput.mjs';

test('assigns product roles in deterministic order', () => {
  assert.equal(roleForIndex(0), '正面主视图');
  assert.equal(roleForIndex(1), '侧面 / 45°图');
  assert.equal(roleForIndex(4), '材质或结构细节');
});

test('keeps six product images and samples reference anchors', () => {
  const normalized = normalizeEcommerceInput({ productImages: Array(8).fill('x'), referenceImages: Array(50).fill('r') });
  assert.equal(normalized.productImages.length, 6);
  assert.equal(normalized.referenceImages.length, 50);
  assert.ok(normalized.styleAnchorCandidates.length <= 4);
  assert.equal(normalized.productRoles[0].role, '正面主视图');
});
