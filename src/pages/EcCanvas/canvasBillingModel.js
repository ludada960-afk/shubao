const FREE = Object.freeze({ paid: false, units: 0, currency: 'ec_points', sku: null });
const ACTIONS = Object.freeze({
  'reverse-prompt': { paid: true, units: 0.2, currency: 'ec_points', sku: 'ec_reverse_prompt' },
  'remove-bg': { paid: true, units: 0.5, currency: 'ec_points', sku: 'ec_remove_bg' },
  'smart-remix': { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  inpaint: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  retouch: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  extend: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  translate: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  upscale: { paid: true, units: 1, currency: 'ec_points', sku: 'ec_image_2k' },
  'upscale-4k': { paid: true, units: 2, currency: 'ec_points', sku: 'ec_image_4k' },
  'psd-export': { ...FREE, enabled: false, reason: '完成真实像素分层后开放' },
});

export function getCanvasActionBilling(actionId) {
  return { ...(ACTIONS[actionId] || FREE) };
}

export function formatCanvasActionPrice(actionId) {
  const billing = getCanvasActionBilling(actionId);
  if (billing.enabled === false) return billing.reason;
  return billing.paid ? `${billing.units} 积分` : '免费';
}
