import test from 'node:test';
import assert from 'node:assert/strict';

import { getCanvasActionBilling, formatCanvasActionPrice } from '../src/pages/EcCanvas/canvasBillingModel.js';

test('canvas action prices distinguish deterministic tools from AI work', () => {
  for (const action of ['rename', 'classify', 'crop', 'grid-split', 'annotation', 'download', 'stitch']) {
    assert.deepEqual(getCanvasActionBilling(action), { paid: false, units: 0, currency: 'ec_points', sku: null });
    assert.equal(formatCanvasActionPrice(action), '免费');
  }
  assert.equal(formatCanvasActionPrice('reverse-prompt'), '0.2 积分');
  assert.equal(formatCanvasActionPrice('remove-bg'), '0.5 积分');
  for (const action of ['smart-remix', 'inpaint', 'retouch', 'extend', 'translate', 'upscale']) {
    assert.equal(formatCanvasActionPrice(action), '1 积分');
  }
  assert.equal(formatCanvasActionPrice('upscale-4k'), '2 积分');
});

test('pixel-layer preparation is billed while PSD export is free after a real layered asset exists', () => {
  assert.deepEqual(getCanvasActionBilling('pixel-layers'), {
    paid: true,
    units: 3,
    currency: 'ec_points',
    sku: 'ec_layer_psd',
  });
  assert.deepEqual(getCanvasActionBilling('psd-export'), {
    paid: false,
    units: 0,
    currency: 'ec_points',
    sku: null,
  });
});
