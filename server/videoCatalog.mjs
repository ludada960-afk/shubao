import { FEATURE_SKUS, quoteFeature } from './billing/catalog.mjs';

export const VIDEO_CATALOG_VERSION = 'video-products-2026-09-16-v4';
export const DEFAULT_VIDEO_PRODUCT_ID = 'seedance_standard';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/* ── 上游可达性台账（2026-09-16 实测复核）────────────────────────────────────
   为什么要有这张表：上一版上架时只核对了「中转 /v1/models 里有这个模型名」，
   但那份清单是全站目录，不等于本站凭证能调到。视频端点真正要求三件事同时成立：
     ① 目录里该模型声明 supported_endpoint_types 含 openai-video（否则 /v1/videos 直接拒收）；
     ② 该模型在 /api/pricing 的 enable_groups 里含本站分组（默认 default）；
     ③ 渠道真的活着：提交能被上游参数校验接住（而不是「上游不认这个模型名」）。
   2026-09-16 复核：本站目录 10 条路由只有 2 条声明 openai-video，其余 8 条永远调不通。
   判定手段全部零成本（不产生任务、不产生费用）：
     /v1/models → supported_endpoint_types ｜ /api/pricing → enable_groups + 真实报价
     ｜ 故意用非法参数提交 → 上游参数校验拦下 = 渠道活着且报文口径对得上。
   状态口径：
     verified    已真实出片（有任务号 + 成片 URL）
     callable    渠道活着、报文口径对得上，未跑真实出片
     blocked     可接入，但本站中转余额不足，提交即被预扣费拦下
     unverified  渠道活着但本站报文口径尚未确认
     unreachable 上游不认该模型名 / 无渠道 / 未定价 / 聚合条件不支持
   门禁：public:true 只允许 verified / callable，见 test/video-route-reachability.test.mjs。 */
export const ROUTE_REACHABILITY = deepFreeze({
  'agv-seedance2.0fast': {
    state: 'verified',
    billingMode: 'per_request',
    quoteCny: 0.91,
    evidence: '2026-09-16 真实出片：720p/5s 提交 200，156s 完成并返回成片 URL（task_MHCiB6Yo1LuYbz6wLt9g4MvCN8klJ7oM）',
  },
  'seedance-2.0': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 5.07,
    evidence: '2026-09-16 提交 200（中转映射上游 sd10-seedance-2.0）；同族 1080p 被分辨率白名单拒收，故本档只开 720p',
  },
  'seedance-2.0-fast': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.77,
    evidence: '2026-09-16 免费探针：非法时长被上游拦下（渠道活着 + 报文口径对得上），未跑真实出片',
  },
  'seedance-2.0-mini': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.77,
    evidence: '2026-09-16 免费探针：非法时长被上游拦下（渠道活着 + 报文口径对得上），未跑真实出片',
  },
  'seedance-2.0-1080p': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 7.67,
    evidence: '2026-09-16 走完渠道与参数校验，仅因预扣 ¥7.67 超过中转余额被拒（insufficient_user_quota）；充值后可直接接生产路由',
  },
  'minimax-h3': {
    state: 'unverified',
    billingMode: 'per_second',
    quoteCny: 0.364,
    evidence: '2026-09-16 渠道活着（用 seedance 报文提交被上游指出字段不符，说明通道在、报文口径不同）；需用 minimax content 报文复核后转 callable',
  },
  'minimax-h3-per-request': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 7.41,
    evidence: '2026-09-16 走完渠道与参数校验，仅因预扣 ¥7.41 超过中转余额被拒',
  },
  'xn-seedance-2.5': {
    state: 'blocked',
    billingMode: 'per_second',
    quoteCny: 1.872,
    evidence: '2026-09-16 走完渠道与分辨率校验（1080p 合法），仅因预扣 ¥9.36 超过中转余额被拒',
  },
  'sd5-seedance-2.0': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video，/v1/videos 提交被上游拒（not a public model name）',
  },
  'sd5-seedance-2.0-fast': {
    state: 'unreachable',
    evidence: '2026-09-16 同 sd5-seedance-2.0：未声明 openai-video',
  },
  'minimax-h3-768p': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达',
  },
  'minimax-h3-2k': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达',
  },
  'grok-imagine-video': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video；同族 grok-video 声明了但上游不认该名',
  },
  'grok-video': { state: 'unreachable', evidence: '2026-09-16 声明 openai-video 但上游返回 not a public model name' },
  'grok-video-1.5': { state: 'unreachable', evidence: '2026-09-16 同 grok-video' },
  'xn-wan3.0': {
    state: 'unreachable',
    evidence: '2026-09-16 声明 openai-video，但提交返回「模型聚合条件不支持」/字段不符，无法出片',
  },
  'kling-3.0': { state: 'unreachable', evidence: '2026-09-16 该 id 未声明 openai-video；上游可用性面板亦为 degraded' },
  'kling-3.0-pro': { state: 'unreachable', evidence: '2026-09-16 该 id 未声明 openai-video；上游可用性面板亦为 degraded' },
  'veo-3.1-fast': { state: 'unreachable', evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达' },
  'sd8-seedance-2.5': { state: 'unreachable', evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达' },
  'seedance-2.0-720p': { state: 'unreachable', evidence: '2026-09-16 声明 openai-video 但上游返回 not a public model name' },
  'seedance-2.0-fast-720p': { state: 'unreachable', evidence: '2026-09-16 同 seedance-2.0-720p' },
  'seedance-2.0-480p': { state: 'unreachable', evidence: '2026-09-16 同 seedance-2.0-720p' },
  'seedance-2.0-fast-480p': { state: 'unreachable', evidence: '2026-09-16 同 seedance-2.0-720p' },
  'sd2.0-720p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.5-720p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.0-1080p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.5-1080p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd-full-1080p': { state: 'unreachable', evidence: '2026-09-16 中转未定价（模型价格尚未由管理员配置）' },
  'sd-full-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
  'sd-full-fast-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
  'sd-face-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
});

export function routeReachability(routeId) {
  const key = typeof routeId === 'string' ? routeId.trim() : '';
  /* 用 hasOwn 取值：避免 'constructor' / '__proto__' 这类串拿到原型上的东西 */
  if (!key || !Object.hasOwn(ROUTE_REACHABILITY, key)) {
    return { state: 'unknown', evidence: '未登记：新路由必须先补台账与证据再公开' };
  }
  return ROUTE_REACHABILITY[key];
}

/* 门禁本体：公开产品只允许走台账里 verified / callable 的路由。
   返回违规清单（空数组 = 合规），供契约测试与发布前检查调用。 */
export function publicRouteViolations() {
  const allowed = new Set(['verified', 'callable']);
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public === true)
    .map(product => ({ productId: product.id, routeId: product.routeId, state: routeReachability(product.routeId).state }))
    .filter(entry => !allowed.has(entry.state));
}

/* 时长白名单：上游按秒档位校验（seedance 2.0 家族只认 5/10/15 秒）。
   产品不写 durationOptions 时沿用 [min,max] 整数区间；写了就只认白名单里的秒数。 */
function durationAllowed(product, seconds) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) return options.includes(seconds);
  return seconds >= product.durations.min && seconds <= product.durations.max;
}

export function durationErrorMessage(product) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) {
    return `视频产品 ${product.label} 只支持 ${options.join('/')} 秒`;
  }
  return `视频产品 ${product.label} 支持 ${product.durations.min} 到 ${product.durations.max} 秒`;
}

export function durationOptionsOf(product) {
  const options = product?.durationOptions;
  return Array.isArray(options) && options.length ? [...options] : null;
}

export function isDurationSupported(product, seconds) {
  const value = Number(seconds);
  if (!product || !Number.isInteger(value)) return false;
  return durationAllowed(product, value);
}

/* 把秒数吸附到最近的合法档位：有白名单时只可能落在白名单里，没有时按 [min,max] 夹取。
   前端滑块/输入框与后端估算都走这里，保证「界面上能选的秒数」= 「上游接受的秒数」。 */
export function nearestSupportedDuration(product, seconds) {
  const value = Number(seconds);
  const options = durationOptionsOf(product);
  if (!options) {
    const fallback = Number.isFinite(value) ? value : product.durations.min;
    return Math.max(product.durations.min, Math.min(product.durations.max, fallback));
  }
  if (!Number.isFinite(value)) return options[0];
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best), options[0]);
}

/* 报价用的合法长档秒数：取白名单里第一个大于 8 秒的档位（对应计费 long 档），没有则取最大档。 */
function longQuoteSeconds(product) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) {
    const long = options.find(seconds => seconds > 8);
    return long || options[options.length - 1];
  }
  return Math.max(product.durations.min, Math.min(9, product.durations.max));
}

export const VIDEO_PRODUCTS = deepFreeze({
  seedance_fast: {
    id: 'seedance_fast',
    label: 'Seedance 2.0 Fast',
    providerLabel: '字节跳动',
    tierLabel: '快速成片',
    description: '更快完成 720P 营销短片，适合试稿、批量迭代和节奏验证。',
    limitations: '优选通道按条计费，只出 5/10/15 秒；不支持参考视频/参考音频与首尾帧模式，这些需求请改用标准版。',
    /* 9-11 换档: 路由切到 IP233 优选通道 agv-seedance2.0fast(¥0.91/条, 实测报价),
       原 sd5-seedance-2.0-fast(¥5.07/条) 退役; 同 host 同协议(任务式 /videos)。
       9-16 复核: 该路由是目录里唯一已真实出片验证的通道, 保留公开。 */
    routeId: 'agv-seedance2.0fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
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
    limitations: '只出 5/10/15 秒；生成时间更长，高峰期会进入独立队列等待。',
    /* 9-16 路由纠错: 原 sd5-seedance-2.0 未声明 openai-video, /v1/videos 永远调不通(用户看到的是
       「模型不可用」), 实测换成 seedance-2.0 —— 中转映射上游 sd10-seedance-2.0, 提交 200。
       账面成本 ¥5.07/条与 billing/catalog.mjs 原记录一致, 因此用户价格不动。 */
    routeId: 'seedance-2.0',
    credential: 'seedance',
    public: true,
    default: true,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: true,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  /* 9-16 下架: minimax-h3-768p 未声明 openai-video, 视频端点不可达。
     改接同族活路由 minimax-h3(¥0.364/秒, 走 minimax content 报文), 待用该报文复核后开 public。 */
  minimax_h3_768p: {
    id: 'minimax_h3_768p',
    label: 'MiniMax H3 768P',
    providerLabel: 'MiniMax',
    tierLabel: '主流可选',
    description: '文生/图生/多模态/首尾帧都能做，节奏与人物稳定性好，适合口播与生活场景短片。',
    limitations: '按秒计费；参考视频与参考音频不限，首尾帧需两张图。',
    routeId: 'minimax-h3',
    credential: 'minimax',
    public: false,
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
  /* ── 9-16 下架批次（路由复核不可达，全部 public:false；老任务数据仍可读，符合「老数据必须可读」）──
     上架时只核对了「目录里有这个名字」，没有确认视频端点可达；这批路由要么未声明 openai-video，
     要么上游不认该模型名、无本站分组渠道或未定价。恢复上架的唯一路径：台账转 verified/callable。 */
  grok_fast: {
    id: 'grok_fast',
    label: 'Grok 极速',
    providerLabel: 'xAI',
    tierLabel: '极速试稿',
    description: '几秒出片，适合试方向、批量试稿和节奏验证。',
    limitations: '仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'grok-imagine-video',
    credential: 'seedance',
    public: false,
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
    public: false,
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
    description: '人物动作与镜头运动自然，适合剧情与口播。',
    limitations: '仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'kling-3.0',
    credential: 'seedance',
    public: false,
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
    limitations: '仅 720P；不支持参考视频与参考音频。',
    routeId: 'kling-3.0-pro',
    credential: 'seedance',
    public: false,
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
    public: false,
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
  /* 9-16: sd8-seedance-2.5 未声明 openai-video；改接同族活路由 xn-seedance-2.5（¥1.872/秒），
     该路由已通过分辨率校验，但 5 秒预扣 ¥9.36 超过当前中转余额，充值后可直接开 public。 */
  seedance_25: {
    id: 'seedance_25',
    label: 'Seedance 2.5',
    providerLabel: '字节跳动',
    tierLabel: '画质升级',
    description: '新一代画质与一致性，细节和材质表现更好，适合品牌主推片。',
    limitations: '仅 720P；高峰期排队更久；不支持参考视频与参考音频。',
    routeId: 'xn-seedance-2.5',
    credential: 'seedance',
    public: false,
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
  /* 9-16: minimax-h3-2k 未声明 openai-video；改接按条计费的活路由 minimax-h3-per-request，
     预扣 ¥7.41 超过当前中转余额；2K 输出待充值后实测复核。 */
  minimax_h3_2k: {
    id: 'minimax_h3_2k',
    label: 'MiniMax H3 2K',
    providerLabel: 'MiniMax',
    tierLabel: '2K 精制',
    description: '支持 2K、多模态和首尾帧的精制路线，适合高质量短片。',
    limitations: '按条计费；仅 2K 输出，生成时间更长。',
    routeId: 'minimax-h3-per-request',
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
  if (!Number.isInteger(seconds) || !durationAllowed(product, seconds)) {
    throw new Error(durationErrorMessage(product));
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
  if (!Number.isInteger(seconds) || !durationAllowed(product, seconds)) {
    throw new Error(durationErrorMessage(product));
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
      /* 上游按秒档位校验，白名单必须透传到前端，否则用户会选到上游拒收的秒数 */
      durationOptions: Array.isArray(product.durationOptions) ? [...product.durationOptions] : null,
      resolutions: [...product.resolutions],
      modes: [...product.modes],
      generatedAudio: product.generatedAudio,
      frameAudio: product.frameAudio,
      limits: { ...product.limits },
      quotes: {
        /* 长档报价取白名单里第一个 >8 秒的合法档位(没有白名单时沿用 9 秒上限口径)，
           避免报出一个上游根本不接受的时长。 */
        short: publicQuote(videoFeatureSku({ productId: product.id, duration: product.durations.min })),
        long: publicQuote(videoFeatureSku({ productId: product.id, duration: longQuoteSeconds(product) })),
      },
    }));
}

/* ═══ 未上架模型清单（只读，给界面一句实话用）══════════════════════════════════════════
   2026-09-19 批 H-7。为什么需要它：用户问「我们之前明明做了特别多的模型啊，起码有差不多 10 个，
   为什么现在都不见了呢？」—— 目录里**确实有 10 个**，但只有 2 个 public:true，
   另外 8 个被上游可达性 / 中转余额挡住，而界面上**一个字都没说**，于是看起来像"被删了"。
   ⚠️ 这份清单**只能用来显示**，绝不允许拿它生成 / 路由 / 计费：
      id / label / tierLabel / reason 四项都是只读的展示字段，没有任何可提交的字段。
      "能选"与"只是告诉你它在接通"是两件事，混在一起就是"用户选了会失败"的老问题。
   ⚠️ reason 按**路由台账状态**给（ROUTE_REACHABILITY），不是手写的安慰话：
      unreachable 上游不认 / blocked 余额不足 / unverified 报文待确认。 */
const UNAVAILABLE_REASON = Object.freeze({
  unreachable: "上游暂未开放该模型",
  blocked: "中转账户余额不足",
  unverified: "上游报文口径确认中",
});

export function unavailableVideoProducts() {
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public !== true)
    .map(product => {
      const state = ROUTE_REACHABILITY[product.routeId]?.state || "unverified";
      return {
        id: product.id,
        label: product.label,
        tierLabel: product.tierLabel || "",
        routeState: state,
        reason: UNAVAILABLE_REASON[state] || UNAVAILABLE_REASON.unverified,
      };
    });
}
