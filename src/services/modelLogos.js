/**
 * 模型品牌标识（2026-09-11 用户：模型选项的 LOGO 不对，照竞品那套做）。
 * - 有官方标识的用 public/logos/*.svg（从 simple-icons 取件、已入库，单文件 0.4～2KB）；
 * - OpenAI 取官方 Blossom 标识（openai.com/brand，抽单枚矢量路径，未改形）；Midjourney 官方无公开品牌页，
 *   用社区 MIT 图标库 @lobehub/icons-static-svg 的同款标识。两者均写死品牌色（<img> 下 currentColor 不生效）。
 * - 尺寸与竞品一致：方形小标（16～18px），旁边跟模型名。
 */
export const BRAND_LOGOS = Object.freeze({
  bytedance: { src: '/logos/bytedance.svg', color: '#325AB4', label: '字节跳动' },
  minimax: { src: '/logos/minimax.svg', color: '#F23F5D', label: 'MiniMax' },
  kuaishou: { src: '/logos/kuaishou.svg', color: '#FF5000', label: '快手可灵' },
  google: { src: '/logos/google.svg', color: '#4285F4', label: 'Google' },
  gemini: { src: '/logos/googlegemini.svg', color: '#8E75B2', label: 'Google Gemini' },
  xai: { src: '/logos/x.svg', color: '#111111', label: 'xAI' },
  alibaba: { src: '/logos/alibabacloud.svg', color: '#FF6A00', label: '阿里通义' },
  qwen: { src: '/logos/qwen.svg', color: '#615CED', label: '通义千问' },
  deepseek: { src: '/logos/deepseek.svg', color: '#4D6BFE', label: 'DeepSeek' },
  anthropic: { src: '/logos/anthropic.svg', color: '#D97757', label: 'Anthropic' },
  openai: { src: '/logos/openai.svg', color: '#10A37F', label: 'OpenAI' },
  midjourney: { src: '/logos/midjourney.svg', color: '#1A1A1A', label: 'Midjourney' },
  seedream: { src: '/logos/bytedance.svg', color: '#325AB4', label: '即梦 Seedream' },
});

/* 生图模型 → 品牌 key */
const IMAGE_MODEL_BRAND = Object.freeze({
  image2: 'openai',
  'gpt-image-2': 'openai',
  'gpt-image-2.5': 'openai',
  'gpt-image-2.5-flare': 'openai',
  'gpt-image-2.5-sunburst': 'openai',
  'mdkj-super-gpt-image-2': 'openai',
  'nano-banana': 'gemini',
  'nano-banana-2': 'gemini',
  'nano-banana-pro': 'gemini',
  'gemini-3-pro-image': 'gemini',
  'gemini-3.1-flash-image': 'gemini',
  'midjourney-1k': 'midjourney',
  'midjourney-2k': 'midjourney',
  'qwen-image': 'qwen',
  'wan-image': 'alibaba',
  'seedream-4': 'seedream',
});

/* 视频产品 → 品牌 key（按 providerLabel 或产品 id 兜底） */
const VIDEO_PROVIDER_BRAND = Object.freeze({
  '字节跳动': 'bytedance',
  MiniMax: 'minimax',
  '快手可灵': 'kuaishou',
  Google: 'google',
  '阿里通义': 'alibaba',
  xAI: 'xai',
});

export function brandLogo(key) {
  return BRAND_LOGOS[String(key || '').trim()] || null;
}

export function imageModelBrand(modelId) {
  const id = String(modelId || '').trim();
  return IMAGE_MODEL_BRAND[id] || 'openai';
}

export function imageModelLogo(modelId) {
  return brandLogo(imageModelBrand(modelId));
}

export function videoProductLogo(product) {
  if (!product) return null;
  const byLabel = VIDEO_PROVIDER_BRAND[String(product.providerLabel || '').trim()];
  if (byLabel) return brandLogo(byLabel);
  const id = String(product.id || '');
  if (/minimax/.test(id)) return brandLogo('minimax');
  if (/kling/.test(id)) return brandLogo('kuaishou');
  if (/veo/.test(id)) return brandLogo('google');
  if (/wan/.test(id)) return brandLogo('alibaba');
  if (/grok/.test(id)) return brandLogo('xai');
  if (/seedance/.test(id)) return brandLogo('bytedance');
  return null;
}
