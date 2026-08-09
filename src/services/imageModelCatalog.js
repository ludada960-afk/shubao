export const IMAGE_MODELS = Object.freeze([
  Object.freeze({
    id: 'image2', label: 'GPT Image 2', badge: '高性价比',
    description: '适合高频电商套图、白底图与常规商品视觉。',
  }),
  Object.freeze({
    id: 'nano-banana-2', label: 'Nano Banana 2', badge: '多参考一致性',
    description: '适合多参考图、文字排版、商品一致性与局部修改。',
  }),
  Object.freeze({
    id: 'nano-banana-pro', label: 'Nano Banana Pro', badge: '专业精修',
    description: '适合复杂品牌资产、精细本地化与高要求商业成片。',
  }),
]);

const IDS = new Set(['smart', ...IMAGE_MODELS.map(model => model.id)]);

export function normalizeImageModel(value, fallback = 'image2') {
  const normalized = String(value || '').trim().toLowerCase();
  return IDS.has(normalized) ? normalized : fallback;
}

export function imageModelLabel(value) {
  const id = normalizeImageModel(value);
  if (id === 'smart') return '智能推荐';
  return IMAGE_MODELS.find(model => model.id === id)?.label || 'GPT Image 2';
}

export function generationBillingSku(imageModel, resolution = '2K') {
  const model = normalizeImageModel(imageModel);
  const size = ['1K', '2K', '4K'].includes(String(resolution).toUpperCase()) ? String(resolution).toLowerCase() : '2k';
  if (model === 'nano-banana-2') return `ec_nano_flash_${size}`;
  if (model === 'nano-banana-pro') return `ec_nano_pro_${size}`;
  return size === '4k' ? 'ec_image_4k' : 'ec_image_2k';
}

export function generationUnits(imageModel, resolution = '2K') {
  const sku = generationBillingSku(imageModel, resolution);
  return {
    ec_image_2k: 1000, ec_image_4k: 2000,
    ec_nano_flash_1k: 1000, ec_nano_flash_2k: 1000, ec_nano_flash_4k: 2000,
    ec_nano_pro_1k: 1000, ec_nano_pro_2k: 1000, ec_nano_pro_4k: 2000,
  }[sku];
}
