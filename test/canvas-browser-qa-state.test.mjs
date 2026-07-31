import assert from 'node:assert/strict';
import test from 'node:test';

import { createCanvasBrowserQaState } from '../src/pages/EcCanvas/canvasBrowserQaState.js';

test('canvas browser QA state is unavailable outside local development', () => {
  assert.equal(createCanvasBrowserQaState({ enabled: false, search: '?qa=ec-canvas' }), null);
  assert.equal(createCanvasBrowserQaState({ enabled: true, search: '' }), null);
});

test('canvas browser QA state supplies one source and all commerce asset lanes', () => {
  const state = createCanvasBrowserQaState({ enabled: true, search: '?qa=ec-canvas' });

  assert.equal(state.page, 'ec-canvas');
  assert.equal(state.logged, true);
  assert.equal(state.result.browserQa, true);
  assert.equal(state.result.productAssets.length, 1);
  assert.deepEqual(
    state.result.images.map(image => image.key),
    [
      'white-background-01',
      'main-text-01',
      'detail-feature-01',
      'sku-01',
      'transparent-01',
    ],
  );
  assert.deepEqual(
    state.result.images.map(image => image.ratio),
    ['1:1', '1:1', '3:4', '1:1', '1:1'],
  );
});
