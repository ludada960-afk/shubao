import test from 'node:test';
import assert from 'node:assert/strict';

import { isRuntimePathIgnored } from '../server/runtimePaths.mjs';

test('runtime caches, uploads, and database files are runtime-only paths', () => {
  assert.equal(isRuntimePathIgnored('cache_img/a.png'), true);
  assert.equal(isRuntimePathIgnored('./uploads/a.png'), true);
  assert.equal(isRuntimePathIgnored('server\\works.db'), false);
  assert.equal(isRuntimePathIgnored('works.db'), true);
  assert.equal(isRuntimePathIgnored('src/assets/logo.svg'), false);
});
