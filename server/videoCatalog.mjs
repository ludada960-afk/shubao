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
    limitations: '优选通道按条计费；不支持参考视频/参考音频与首尾帧模式，这些需求请改用标准版。',
    /* 9-11 换档: 路由切到 IP233 优选通道 agv-seedance2.0fast(¥0.91/条, 实测报价),
       原 sd5-seedance-2.0-fast(¥5.07/条) 退役; 同 host 同协议(任务式 /videos)。 */
    routeId: 'agv-seedance2.0fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 0, audios: 0, total: 9 },
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
  /* 9-11 用户批注: 视频只有 Seedance → 接入 MiniMax H3 768p (IP233 按条 ¥4.55, 实测目录可路由)。
     能力: 文生/图生/多模态/首尾帧, 5-15 秒, 720P; 用 MINIMAX_VIDEO_API_KEY 走同一 IP233 上游。 */
  minimax_h3_768p: {
    id: 'minimax_h3_768p',
    label: 'MiniMax H3 768P',
    providerLabel: 'MiniMax',
    tierLabel: '主流可选',
    description: '文生/图生/多模态/首尾帧都能做，节奏与人物稳定性好，适合口播与生活场景短片。',
    limitations: '按条计费；参考视频与参考音频不限，首尾帧需两张图。',
    routeId: 'minimax-h3-768p',
    credential: 'minimax',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    resolutions: ['720p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  /* ── 9-11 用户拍板「全上」: 7 个新档位 (IP233 权威价目 docs/research/ip233-model-pricing-20260911.md) ──
     能力口径取保守值: 只在价目/广场描述明确支持的范围内开放, 其余写进 limitations, 不夸大。
     凭证统一走 seedance (IP233 主 key) 或 minimax, 两把 key 权限相同 (实测 124 个模型全通)。 */
  grok_fast: {
    id: 'grok_fast',
    label: 'Grok 极速',
    providerLabel: 'xAI',
    tierLabel: '极速试稿',
    description: '全场最便宜的可用路线，几秒出片，适合试方向、批量试稿和节奏验证。',
    limitations: '单张参考图；仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'grok-imagine-video',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 8000,
  },
  wan_standard: {
    id: 'wan_standard',
    label: '通义万相 3.0',
    providerLabel: '阿里通义',
    tierLabel: '通用性价比',
    description: '国产主流路线，商品与场景稳定性好，价格低，适合日常出片。',
    limitations: '单张参考图；仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'xn-wan3.0',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  kling_standard: {
    id: 'kling_standard',
    label: '可灵 3.0',
    providerLabel: '快手可灵',
    tierLabel: '主流第三方',
    description: '第三方认知度最高的路线，人物动作与镜头运动自然，适合剧情与口播。',
    limitations: '仅 720P；不支持参考视频、参考音频与首尾帧（该能力需先小流量验证后再开）。',
    routeId: 'kling-3.0',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 2, videos: 0, audios: 0, total: 2 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  kling_pro: {
    id: 'kling_pro',
    label: '可灵 3.0 Pro',
    providerLabel: '快手可灵',
    tierLabel: '第三方精制',
    description: '可灵高质量档，细节与一致性更好，适合品牌片与人物口播。',
    limitations: '仅 720P（1080P 档需先小流量验证）；不支持参考视频与参考音频。',
    routeId: 'kling-3.0-pro',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 2, videos: 0, audios: 0, total: 2 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  veo_fast: {
    id: 'veo_fast',
    label: 'Veo 3.1 Fast',
    providerLabel: 'Google',
    tierLabel: '国际路线',
    description: 'Google Veo 快速档，物理运动与真实感强，适合写实场景与产品演示。',
    limitations: '单张参考图；仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'veo-3.1-fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 8 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  seedance_25: {
    id: 'seedance_25',
    label: 'Seedance 2.5',
    providerLabel: '字节跳动',
    tierLabel: '画质升级',
    description: '新一代画质与一致性，细节和材质表现更好，适合品牌主推片。',
    limitations: '仅 720P；高峰期排队更久；不支持参考视频与参考音频。',
    routeId: 'sd8-seedance-2.5',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 0, audios: 0, total: 9 },
    concurrency: 1,
    pollIntervalMs: 12000,
  },
  minimax_h3_2k: {
    id: 'minimax_h3_2k',
    label: 'MiniMax H3 2K',
    providerLabel: 'MiniMax',
    tierLabel: '2K 精制',
    description: '支持 2K、多模态和首尾帧的精制路线，适合高质量短片。',
    limitations: '按条计费；仅 2K 输出，生成时间更长。',
    routeId: 'minimax-h3-2k',
    credential: 'minimax',
    public: true,
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
        /* 9-11: long 档不再写死 9 秒 —— 按产品自身时长上限收敛 (Veo Fast 上限 8s 会直接抛错) */
        short: publicQuote(videoFeatureSku({ productId: product.id, duration: product.durations.min })),
        long: publicQuote(videoFeatureSku({ productId: product.id, duration: Math.max(product.durations.min, Math.min(9, product.durations.max)) })),
      },
    }));
}
