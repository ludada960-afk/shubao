import { FEATURE_SKUS, quoteFeature } from './billing/catalog.mjs';

export const VIDEO_CATALOG_VERSION = 'video-products-2026-08-12-v3';
export const DEFAULT_VIDEO_PRODUCT_ID = 'seedance_standard';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const VIDEO_PRODUCTS = deepFreeze({
  seedance_fast: {
    id: 'seedance_fast',
    label: 'Seedance 2.0 Fast',
    providerLabel: '字节跳动',
    tierLabel: '快速成片',
    description: '更快完成 720P 营销短片，适合试稿、批量迭代和节奏验证。',
    limitations: '优先速度；复杂人物一致性与精细动作建议改用标准版。',
    routeId: 'sd5-seedance-2.0-fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 4, max: 15 },
    resolutions: ['720p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: true,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  seedance_standard: {
    id: 'seedance_standard',
    label: 'Seedance 2.0 标准',
    providerLabel: '字节跳动',
    tierLabel: '正式交付',
    description: '稳定完成 720P 多模态营销短片，适合商品、人物与场景的正式交付。',
    limitations: '生成时间更长；高峰期会进入独立队列等待。',
    routeId: 'sd5-seedance-2.0',
    credential: 'seedance',
    public: true,
    default: true,
    durations: { min: 4, max: 15 },
    resolutions: ['720p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: true,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  minimax_h3_2k: {
    id: 'minimax_h3_2k',
    label: 'MiniMax H3 2K',
    providerLabel: 'MiniMax',
    tierLabel: '2K 精制',
    description: '支持 2K、多模态和首尾帧的精制路线，适合高质量短片。',
    limitations: '当前通道仍在稳定性验收，暂不向普通账号开放。',
    routeId: 'minimax-h3-2k',
    credential: 'minimax',
    public: false,
    default: false,
    durations: { min: 5, max: 15 },
    resolutions: ['2k'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
});

function productId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!Object.hasOwn(VIDEO_PRODUCTS, normalized)) throw new Error(`未知视频产品: ${normalized || 'empty'}`);
  return normalized;
}

export function getVideoProduct(value) {
  return VIDEO_PRODUCTS[productId(value)];
}

export function videoFeatureSku({ productId: requestedProductId, duration } = {}) {
  const product = getVideoProduct(requestedProductId);
  const seconds = Number(duration);
  if (!Number.isInteger(seconds) || seconds < product.durations.min || seconds > product.durations.max) {
    throw new Error(`视频产品 ${product.label} 支持 ${product.durations.min} 到 ${product.durations.max} 秒`);
  }
  return `video_${product.id}_${seconds <= 8 ? 'short' : 'long'}`;
}

export function validateVideoProductInput({
  productId: requestedProductId,
  duration,
  mode,
  resolution,
  generateAudio = true,
} = {}) {
  const product = getVideoProduct(requestedProductId);
  const seconds = Number(duration);
  if (!Number.isInteger(seconds) || seconds < product.durations.min || seconds > product.durations.max) {
    throw new Error(`视频产品 ${product.label} 支持 ${product.durations.min} 到 ${product.durations.max} 秒`);
  }
  const normalizedMode = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  if (!product.modes.includes(normalizedMode)) throw new Error(`视频产品不支持该创作模式: ${normalizedMode || 'empty'}`);
  const normalizedResolution = typeof resolution === 'string' ? resolution.trim().toLowerCase() : '';
  if (!product.resolutions.includes(normalizedResolution)) {
    throw new Error(`视频产品不支持该清晰度: ${normalizedResolution || 'empty'}`);
  }
  if (typeof generateAudio !== 'boolean') throw new TypeError('generateAudio must be boolean');
  if (normalizedMode === 'frame' && generateAudio && product.frameAudio === false) {
    throw new Error('该产品的首尾帧模式暂不支持生成声音');
  }
  return {
    productId: product.id,
    duration: seconds,
    mode: normalizedMode,
    resolution: normalizedResolution,
    generateAudio,
  };
}

function publicQuote(sku) {
  const quote = quoteFeature(sku, 1);
  return { sku, units: quote.totalUnits, points: Math.ceil(quote.totalUnits / 1000) };
}

export function publicVideoProducts({ includeHidden = false } = {}) {
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public === true || includeHidden)
    .map(product => ({
      id: product.id,
      label: product.label,
      providerLabel: product.providerLabel,
      tierLabel: product.tierLabel,
      description: product.description,
      limitations: product.limitations,
      public: true,
      default: product.default === true,
      durations: { ...product.durations },
      resolutions: [...product.resolutions],
      modes: [...product.modes],
      generatedAudio: product.generatedAudio,
      frameAudio: product.frameAudio,
      limits: { ...product.limits },
      quotes: {
        short: publicQuote(videoFeatureSku({ productId: product.id, duration: product.durations.min })),
        long: publicQuote(videoFeatureSku({ productId: product.id, duration: 9 })),
      },
    }));
}
