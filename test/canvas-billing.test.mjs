import test from 'node:test';
import assert from 'node:assert/strict';

import { getCanvasActionBilling, formatCanvasActionPrice } from '../src/pages/EcCanvas/canvasBillingModel.js';

test('canvas action prices distinguish deterministic tools from AI work', () => {
  for (const action of ['rename', 'classify', 'crop', 'grid-split', 'annotation', 'download', 'stitch']) {
    assert.deepEqual(getCanvasActionBilling(action), { paid: false, units: 0, currency: 'ec_points', sku: null });
    assert.equal(formatCanvasActionPrice(action), '免费');
  }
  assert.equal(formatCanvasActionPrice('reverse-prompt'), '0.2 积分');
  assert.equal(formatCanvasActionPrice('ocr'), '0.2 积分');
  // 抠图/分层都先跑一次商品识别（ec_canvas_recognize 0.2），展示价必须等于真实总扣费
  assert.equal(formatCanvasActionPrice('remove-bg'), '0.7 积分');
  for (const action of ['smart-remix', 'inpaint', 'retouch', 'extend', 'translate', 'upscale']) {
    assert.equal(formatCanvasActionPrice(action), '1 积分');
  }
  assert.equal(formatCanvasActionPrice('upscale-4k'), '2 积分');
  assert.equal(formatCanvasActionPrice('layer-edit'), '3.2 积分');
});

test('first-pass OCR is billed while deterministic text replacement remains free', () => {
  assert.deepEqual(getCanvasActionBilling('ocr'), {
    paid: true,
    units: 0.2,
    currency: 'ec_points',
    sku: 'ec_canvas_ocr',
  });
  assert.equal(formatCanvasActionPrice('replace-text'), '免费');
});

test('automatic smart layering uses its own billed action', () => {
  assert.deepEqual(getCanvasActionBilling('layer-edit'), {
    paid: true,
    units: 3.2,
    currency: 'ec_points',
    sku: 'ec_smart_layer',
    skus: ['ec_canvas_recognize', 'ec_smart_layer'],
  });
});

test('action registry price labels never fall through to 免费 for a billed action', async () => {
  // 事故模式：注册表写成 'layers'，而计价表里叫 'layer-edit' → 查表落空回落 FREE，
  // UI 显示"免费"但后端实收 3 积分。这条测试锁死注册表与计价表的键必须对得上。
  const { getCanvasActionBilling, CANVAS_BILLING_KEYS } = await import('../src/pages/EcCanvas/canvasBillingModel.js');
  const { CANVAS_ACTIONS } = await import('../src/pages/EcCanvas/canvasActionRegistry.js');
  // 这几个是纯本地确定性工具（裁剪/宫格/标注），免费是设计如此
  const LOCAL_FREE = new Set(['crop', 'grid-split', 'annotation']);
  const known = new Set(CANVAS_BILLING_KEYS);
  const unknown = CANVAS_ACTIONS
    .filter(action => action.priceFeature && !known.has(action.priceFeature) && !LOCAL_FREE.has(action.priceFeature));
  assert.deepEqual(unknown.map(action => action.id), [], 'registry priceFeature has no entry in the billing table (silently renders 免费)');
  for (const action of CANVAS_ACTIONS) {
    if (!action.priceFeature || LOCAL_FREE.has(action.priceFeature)) continue;
    assert.equal(getCanvasActionBilling(action.priceFeature).paid, true, action.id + ' should be a paid action');
  }
  const layerEdit = CANVAS_ACTIONS.find(action => action.id === 'layer-edit');
  assert.equal(layerEdit.priceLabel, '3.2 积分');
  const removeBackground = CANVAS_ACTIONS.find(action => action.id === 'remove-background');
  assert.equal(removeBackground.priceLabel, '0.7 积分');
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
