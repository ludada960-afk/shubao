import test from 'node:test';
import assert from 'node:assert/strict';

import { nextProductRole } from '../src/pages/Home/ec/uploadRoles.js';

test('shows the next empty role card after every uploaded product image', () => {
  assert.equal(nextProductRole([]).label, '产品图1');
  assert.equal(nextProductRole(['a']).label, '产品图2');
});
