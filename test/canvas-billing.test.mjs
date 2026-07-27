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

test('PSD export remains disabled until a real layered asset exists', () => {
  assert.deepEqual(getCanvasActionBilling('psd-export'), {
    paid: false,
    units: 0,
    currency: 'ec_points',
    sku: null,
    enabled: false,
    reason: '完成真实像素分层后开放',
  });
});
