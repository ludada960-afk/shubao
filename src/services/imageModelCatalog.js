export const IMAGE_MODELS = Object.freeze([
  Object.freeze({
    id: 'image2', label: 'GPT Image 2', badge: '高性价比',
    description: '适合高频电商套图、白底图与常规商品视觉。',
    brand: 'openai',
  }),
  Object.freeze({
    id: 'nano-banana-2', label: 'Nano Banana 2', badge: '多参考一致性',
    description: '适合多参考图、文字排版、商品一致性与局部修改。',
    brand: 'gemini',
  }),
  Object.freeze({
    id: 'nano-banana-pro', label: 'Nano Banana Pro', badge: '专业精修',
    description: '适合复杂品牌资产、精细本地化与高要求商业成片。',
    brand: 'gemini',
  }),
  /* ── 9-13 新增四族五档（与竞品一致：2.5 放两个变体；全部走同一上游 IP233）── */
  Object.freeze({
    pending: true, /* 待真实生成验收后开放（A 方案） */
    id: 'image2-5-sunburst', label: 'GPT Image 2.5 Sunburst', badge: '旗舰',
    description: '最新旗舰图片模型，画质与指令理解更强，复杂编辑更精准。',
    brand: 'openai',
  }),
  Object.freeze({
    pending: true, /* 待真实生成验收后开放（A 方案） */
    id: 'image2-5-flare', label: 'GPT Image 2.5 Flare', badge: '极速',
    description: '新一代快速图片模型，兼顾速度与画面细节，适合日常批量出图。',
    brand: 'openai',
  }),
  Object.freeze({
    pending: true, /* 待真实生成验收后开放（A 方案） */
    id: 'mdkj-super', label: 'MDKJ Super', badge: '极致性价比',
    description: '成本最低的通用出图档，适合高频铺量、白底图与常规商品视觉。',
    brand: 'openai',
  }),
  Object.freeze({
    pending: true, /* 待真实生成验收后开放（A 方案） */
    id: 'gemini-3-image', label: 'Gemini 3 图像', badge: '文字排版',
    description: 'Google 新一代图片模型，擅长画面内文字、多参考一致性与复杂场景。',
    brand: 'gemini',
  }),
  Object.freeze({
    pending: true, /* 待真实生成验收后开放（A 方案） */
    id: 'midjourney', label: 'Midjourney', badge: '风格美学',
    description: '以美学风格见长，适合概念图、情绪板与高质感视觉；最高支持 2K。',
    brand: 'midjourney',
    /* 用户 9-13 决定：上游只有 1K/2K → 直接不给 4K 选项，不做静默回落 */
    resolutions: Object.freeze(['1K', '2K']),
  }),
]);

/** 可对用户展示的模型（pending=true 的档位尚未通过真实生成验收，先不进选择器） */
export const SELECTABLE_IMAGE_MODELS = Object.freeze(IMAGE_MODELS.filter(model => model.pending !== true));

const IDS = new Set(['smart', ...IMAGE_MODELS.map(model => model.id)]);

export function normalizeImageModel(value, fallback = 'image2') {
  const normalized = String(value || '').trim().toLowerCase();
  return IDS.has(normalized) ? normalized : fallback;
}

/** 某个模型支持的清晰度列表（缺省 = 全支持）。Midjourney 上游只有 1K/2K。 */
export function imageModelResolutions(value) {
  const model = IMAGE_MODELS.find(entry => entry.id === normalizeImageModel(value));
  return Array.isArray(model?.resolutions) && model.resolutions.length ? [...model.resolutions] : ['1K', '2K', '4K'];
}

export function imageModelLabel(value) {
  const id = normalizeImageModel(value);
  if (id === 'smart') return '智能推荐';
  return IMAGE_MODELS.find(model => model.id === id)?.label || 'GPT Image 2';
}

export function generationBillingSku(imageModel, resolution = '2K') {
  const model = normalizeImageModel(imageModel);
  const size = ['1K', '2K', '4K'].includes(String(resolution).toUpperCase()) ? String(resolution).toLowerCase() : '2k';
  /* 9-13 新增四族五档（Midjourney 无 4K：上游只有 1K/2K，UI 层已不给 4K 选项） */
  if (model === 'image2-5-sunburst') return `ec_image25_sunburst_${size}`;
  if (model === 'image2-5-flare') return `ec_image25_flare_${size}`;
  if (model === 'mdkj-super') return `ec_mdkj_${size}`;
  if (model === 'gemini-3-image') return `ec_gemini3_${size}`;
  if (model === 'midjourney') return `ec_mj_${size === '4k' ? '2k' : size}`;
  if (model === 'nano-banana-2') return `ec_nano_flash_${size}`;
  if (model === 'nano-banana-pro') return `ec_nano_pro_${size}`;
  return size === '4k' ? 'ec_image_4k' : 'ec_image_2k';
}

export function generationUnits(imageModel, resolution = '2K') {
  const sku = generationBillingSku(imageModel, resolution);
  return {
    ec_image_2k: 1000, ec_image_4k: 2000,
    ec_image25_sunburst_1k: 1500, ec_image25_sunburst_2k: 1500, ec_image25_sunburst_4k: 2000,
    ec_image25_flare_1k: 1500, ec_image25_flare_2k: 1500, ec_image25_flare_4k: 2000,
    ec_mdkj_1k: 1000, ec_mdkj_2k: 1000, ec_mdkj_4k: 1500,
    ec_gemini3_1k: 2000, ec_gemini3_2k: 2000, ec_gemini3_4k: 3000,
    ec_mj_1k: 3000, ec_mj_2k: 3500,
    ec_nano_flash_1k: 1000, ec_nano_flash_2k: 1000, ec_nano_flash_4k: 2000,
    ec_nano_pro_1k: 1000, ec_nano_pro_2k: 1000, ec_nano_pro_4k: 2000,
  }[sku];
}
