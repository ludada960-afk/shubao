import test from 'node:test';
import assert from 'node:assert/strict';
import { formatsFor, normalizeCommerceFormat } from '../src/pages/Home/ec/ecommerceFormatRegistry.js';

test('detail images expose the complete commerce ratio set while retaining 9:16 default', () => {
  assert.deepEqual(
    formatsFor({ role: 'detail' }).map(item => item.key),
    ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9'],
  );
  assert.equal(normalizeCommerceFormat({ role: 'detail' }).targetRatio, '9:16');
});
