/* 2026-09-13 用户批注：画布四个生成框必须和首页一样 —— **生成前就把积分算给用户看，并随配置实时变化**
   （换模型 / 换清晰度 / 改张数 / 改时长都要跟着变）。口径与后端计费目录（server/billing/catalog.mjs）
   同源：图片 = generationUnits(模型, 清晰度) × 张数；文案 = ec_ai_assistant(200 单位) = 0.2 积分；
   套图 = 首页 resolveSizingImages 的整套张数 × 单价；视频 = 产品报价的 short / long 档。
   这里只做「报价展示」，真正扣费仍由后端一次性结算（失败自动退回），前端不得自行定价。 */
import { generationUnits, normalizeImageModel, IMAGE_MODELS } from '../../services/imageModelCatalog.js';
import { resolveSizingImages } from '../Home/ec/ecommercePlanModel.js';

const UNITS_PER_POINT = 1000;

/* 文案生成（regenerate-text）= ec_ai_assistant：200 单位 = 0.2 积分/次 */
export const CANVAS_TEXT_POINTS = 0.2;
/* 素材分析 / 生成前方案 = 1 积分（与首页「带设计方案」同口径） */
export const CANVAS_PLAN_ANALYSIS_POINTS = 1;

export function formatCanvasPoints(points) {
  const value = Number(points);
  if (!Number.isFinite(value) || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function imagePointsPerShot(imageModel, resolution = '2K') {
  return (generationUnits(imageModel, resolution) || 0) / UNITS_PER_POINT;
}

export function canvasImageModelLabel(imageModel) {
  const id = normalizeImageModel(imageModel);
  if (id === 'smart') return '智能推荐';
  return IMAGE_MODELS.find(model => model.id === id)?.label || 'GPT Image 2';
}

/* 生图框：单价 × 张数 */
export function estimateImageComposerPoints({ imageModel, resolution = '2K', count } = {}) {
  const perShot = imagePointsPerShot(imageModel, resolution);
  const quantity = Math.max(1, Math.round(Number(count) || 1));
  return { points: perShot * quantity, perShot, count: quantity, resolution: String(resolution).toUpperCase() };
}

/* 文案框：按次计费，与后端 ec_ai_assistant 一致 */
export function estimateTextComposerPoints() {
  return { points: CANVAS_TEXT_POINTS };
}

/* SKU 变体也会各出一张图 —— 与首页 resolveEcommercePlan 的 validSkuCount 同一口径
   （只有真正填了 颜色/规格/容量/标注尺寸 之一的变体才算数，空行不计费）。
   2026-09-17：SKU 现在会真的进生成与排版，报价必须跟着算进去，
   否则「报价张数」与「实际产出张数」会对不上（少报）。 */
export function canvasValidSkuCount(skus) {
  if (!Array.isArray(skus)) return 0;
  /* 2026-09-16 用户裁决：「SKU 数量当然要算张数去收啊，跟其他套图规则一样。」
     —— 与首页 resolveEcommercePlan.validSkuCount 同一口径：规格数 × 每个规格的张数。 */
  return skus
    .filter(sku => ['color', 'size', 'capacity', 'dimLabel']
      .some(field => String(sku?.[field] || '').trim()))
    .reduce((sum, sku) => sum + Math.max(1, Number(sku?.count) || 1), 0);
}

/* 套图框：与首页 planPoints 完全同源（整套张数不能退化成 1 张；SKU 变体计入张数） */
export function estimateSuiteComposerPoints({ platform = 'smart', sizing = {}, resolution = '2K', imageModel = 'image2', skus = [] } = {}) {
  const normalizedResolution = String(resolution || '2K').toUpperCase();
  const planned = resolveSizingImages(platform, { ...(sizing || {}), resolution: normalizedResolution });
  const fallback = Array.isArray(sizing?.images) ? sizing.images : [];
  const source = Array.isArray(planned) && planned.length ? planned : fallback;
  const totalImages = source.reduce((sum, item) => sum + (Number(item?.count) || 0), 0);
  const skuCount = canvasValidSkuCount(skus);
  const count = Math.max(1, totalImages + skuCount);
  const perShot = imagePointsPerShot(imageModel, normalizedResolution);
  return { points: perShot * count, perShot, count, resolution: normalizedResolution, skuCount, sizingCount: totalImages };
}

/* 视频框：产品报价 short(≤8 秒) / long，报价来自服务端，前端只展示 */
export function estimateVideoComposerPoints({ products = [], modelProductId, duration } = {}) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return null;
  const product = list.find(item => item?.id === modelProductId) || list[0];
  const quote = product?.quotes?.[Number(duration) <= 8 ? 'short' : 'long'] || product?.quotes?.short || null;
  const points = Number(quote?.points);
  if (!Number.isFinite(points)) return null;
  return { points, product, quote };
}
