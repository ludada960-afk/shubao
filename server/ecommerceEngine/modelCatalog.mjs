/* 上游真实模型名**不在本文件里写死** —— 它由 provider 适配器单点声明（NANO_UPSTREAM_MODELS）。
   本文件只负责「用户选的档位 → 调哪个上游模型」这一层判断。 */
import { NANO_UPSTREAM_MODELS } from './nanoBananaProviderAdapter.mjs';

export const LEGAL_IMAGE_SIZES = Object.freeze({
  '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768', '9:16': '576x1024', '16:9': '1024x576', '21:9': '1008x432' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048', '16:9': '2048x1152', '21:9': '2048x864' },
  '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840', '16:9': '3840x2160', '21:9': '3584x1536' },
});

const RESOLUTIONS = new Set(Object.keys(LEGAL_IMAGE_SIZES));
export const IMAGE_MODEL_IDS = Object.freeze({
  SMART: 'smart',
  IMAGE2: 'image2',
  NANO_BANANA_2: 'nano-banana-2',
  NANO_BANANA_PRO: 'nano-banana-pro',
  /* 9-13 新增四族五档（前端目录已有，pending=true 暂不进选择器）。
     后端先把接线做齐：route.model = 族 id，真实上游模型名由 provider 适配器的
     「族:分辨率」modelMap 决定 —— 这样上架/下架只改前端 pending，不动路由。 */
  IMAGE2_5_SUNBURST: 'image2-5-sunburst',
  IMAGE2_5_FLARE: 'image2-5-flare',
  MDKJ_SUPER: 'mdkj-super',
  GEMINI_3_IMAGE: 'gemini-3-image',
  MIDJOURNEY: 'midjourney',
});
const IMAGE_MODELS = new Set(Object.values(IMAGE_MODEL_IDS));
/* 走「新族」通道的模型：同一上游（同步 OpenAI 图片接口）按模型名区分，计费口径见 server/billing/catalog.mjs */
const ADVANCED_IMAGE_MODELS = new Set([
  IMAGE_MODEL_IDS.IMAGE2_5_SUNBURST,
  IMAGE_MODEL_IDS.IMAGE2_5_FLARE,
  IMAGE_MODEL_IDS.MDKJ_SUPER,
  IMAGE_MODEL_IDS.GEMINI_3_IMAGE,
  IMAGE_MODEL_IDS.MIDJOURNEY,
]);

export function isAdvancedImageModel(value) {
  return ADVANCED_IMAGE_MODELS.has(normalizeImageModel(value));
}
const MAX_EDGE = 3840;
const MAX_PIXELS = 8_294_400;

function parseDimensions(size) {
  if (typeof size === 'string') {
    const match = /^\s*(\d+)x(\d+)\s*$/.exec(size);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }

  if (size && typeof size === 'object' && !Array.isArray(size)) {
    return { width: size.width, height: size.height };
  }

  throw new TypeError('Generation size must be expressed as WIDTHxHEIGHT');
}

export function validateGenerationSize(size) {
  const { width, height } = parseDimensions(size);
  const validInteger = Number.isInteger(width) && Number.isInteger(height);

  if (!validInteger || width <= 0 || height <= 0) {
    throw new RangeError('Generation dimensions must be positive integers');
  }
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new RangeError('Generation dimensions must be multiples of 16');
  }
  if (width > MAX_EDGE || height > MAX_EDGE) {
    throw new RangeError('Generation dimensions exceed the maximum edge');
  }
  if (width * height > MAX_PIXELS) {
    throw new RangeError('Generation dimensions exceed the maximum pixel count');
  }
  if (Math.max(width, height) / Math.min(width, height) > 3) {
    throw new RangeError('Generation dimensions exceed the maximum aspect ratio');
  }

  return true;
}

function campaignBibleIsConfirmed(input) {
  return input.campaignConfirmed === true
    || input.campaignBibleConfirmed === true
    || input.campaignBible?.confirmed === true;
}

function hasExplicitFourKRequirement(input) {
  return input.resolution === '4K'
    || input.explicit4K === true
    || input.requires4K === true
    || input.fourKRequired === true;
}

export function normalizeImageModel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return IMAGE_MODELS.has(normalized) ? normalized : IMAGE_MODEL_IDS.SMART;
}

export function selectGenerationModel(input = {}) {
  const imageModel = normalizeImageModel(input.imageModel);
  /* ⚠️ 曾在此处写死 'gemini-2.5-flash-image'，供应商下架后就成了「目录说调 A、适配器只认 B」
     （用户看到「模型当前不可用」）。现改为引用适配器的单点声明，两者不可能再分叉。 */
  if (imageModel === IMAGE_MODEL_IDS.NANO_BANANA_2) return NANO_UPSTREAM_MODELS.flash;
  if (imageModel === IMAGE_MODEL_IDS.NANO_BANANA_PRO) return NANO_UPSTREAM_MODELS.pro;
  /* 新族：route.model 用族 id 本身（上游真实模型名在适配器的 modelMap 里按分辨率决定） */
  if (ADVANCED_IMAGE_MODELS.has(imageModel)) return imageModel;
  const assetCount = input.assetCount;
  const eligibleBatch = Number.isInteger(assetCount)
    && assetCount >= 2
    && assetCount <= 4
    && input.batchEligible !== false
    && campaignBibleIsConfirmed(input)
    && input.sameStyle === true
    && input.highRiskFacts === false
    && !hasExplicitFourKRequirement(input);

  return eligibleBatch ? 'gpt-image-2-n' : 'gpt-image-2';
}

export function resolveGenerationSize(input = {}) {
  let resolution = RESOLUTIONS.has(input.resolution) ? input.resolution : '2K';
  /* Midjourney 上游只有 1K/2K（前端也只在 1K/2K 里给选择）——这里兜底降到 2K，
     不做「静默换成别的模型」那种替换：宁可少一档清晰度，也不偷偷给别的结果。 */
  if (normalizeImageModel(input.imageModel) === IMAGE_MODEL_IDS.MIDJOURNEY && resolution === '4K') resolution = '2K';
  const requestedRatio = input.ratio ?? input.aspectRatio;
  if (requestedRatio && !Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio)) {
    const resolutionOrder = Object.keys(LEGAL_IMAGE_SIZES);
    const requestedIndex = resolutionOrder.indexOf(resolution);
    const promoted = resolutionOrder.slice(Math.max(0, requestedIndex + 1)).find(candidate => Object.hasOwn(LEGAL_IMAGE_SIZES[candidate], requestedRatio));
    if (promoted) resolution = promoted;
  }
  const ratio = Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio) ? requestedRatio : '1:1';
  const size = LEGAL_IMAGE_SIZES[resolution][ratio];

  validateGenerationSize(size);

  return { resolution, ratio, size };
}

export function buildModelRoute(input = {}) {
  const imageModel = normalizeImageModel(input.imageModel);
  const { resolution, ratio, size } = resolveGenerationSize(input);
  const provider = ADVANCED_IMAGE_MODELS.has(imageModel)
    ? 'advanced-image'
    : imageModel === IMAGE_MODEL_IDS.NANO_BANANA_2 || imageModel === IMAGE_MODEL_IDS.NANO_BANANA_PRO
      ? 'nano-banana'
      : 'image2';

  return {
    imageModel,
    provider,
    model: selectGenerationModel({ ...input, imageModel, resolution }),
    resolution,
    ratio,
    imageSize: resolution,
    size,
    async: true,
    mode: 'edit',
  };
}
