const FREE = Object.freeze({ paid: false, units: 0, currency: 'ec_points', sku: null });
const ACTIONS = Object.freeze({
  'reverse-prompt': { paid: true, units: 0.2, currency: 'ec_points', sku: 'ec_reverse_prompt' },
  ocr: { paid: true, units: 0.2, currency: 'ec_points', sku: 'ec_canvas_ocr' },
  // 抠图前会先跑一次商品识别（ec_canvas_recognize 0.2），展示价必须含它，否则用户看到 0.5 实际被扣 0.7
  'remove-bg': { paid: true, units: 0.7, currency: 'ec_points', sku: 'ec_remove_bg', skus: ['ec_canvas_recognize', 'ec_remove_bg'] },
  'smart-remix': { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  inpaint: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  retouch: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  extend: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  translate: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  upscale: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  'upscale-4k': { paid: true, units: 2, currency: 'ec_points', sku: 'ec_image_4k' },
  // 同上：智能分层 = 商品识别 0.2 + 分层 3 = 3.2
  'layer-edit': { paid: true, units: 3.2, currency: 'ec_points', sku: 'ec_smart_layer', skus: ['ec_canvas_recognize', 'ec_smart_layer'] },
  'pixel-layers': { paid: true, units: 3, currency: 'ec_points', sku: 'ec_layer_psd' },
  'psd-export': FREE,
});

/** 计价表里存在的动作键；注册表的 priceFeature 必须落在这里面（否则会静默回落成"免费"） */
export const CANVAS_BILLING_KEYS = Object.freeze(Object.keys(ACTIONS));

export function getCanvasActionBilling(actionId) {
  return { ...(ACTIONS[actionId] || FREE) };
}

export function formatCanvasActionPrice(actionId) {
  const billing = getCanvasActionBilling(actionId);
  if (billing.enabled === false) return billing.reason;
  return billing.paid ? `${billing.units} 积分` : '免费';
}
