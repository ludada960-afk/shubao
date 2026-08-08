import { containsUnsafeImagePayload } from '../../../utils/imagePayloadText.js';
import {
  ECOMMERCE_FORMATS,
  formatsFor,
  normalizeCommerceFormat,
} from './ecommerceFormatRegistry.js';
import { normalizeCommerceContext } from './internationalCommerceRegistry.js';

const RESOLUTIONS = new Set(['1K', '2K', '4K']);

const CONTENT_TYPE_PRESETS = Object.freeze({
  main: Object.freeze([
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 4, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]),
  detail: Object.freeze([
    { key: 'detail', count: 6, ratio: '9:16' },
    { key: 'sku', count: 1, ratio: '1:1' },
  ]),
  ad: Object.freeze([
    { key: 'main_3x4', count: 3, ratio: '3:4' },
    { key: 'main_text', count: 2, ratio: '1:1' },
    { key: 'detail', count: 2, ratio: '9:16' },
  ]),
});

export const IMAGE_TYPES = Object.freeze([
  Object.freeze({
    key: 'white_bg',
    label: '白底首图',
    icon: '⬜',
    defaultRatio: '1:1',
    defaultCount: 1,
    desc: '纯白底产品居中，电商必选',
    usage: '首图/主图',
    maxCount: 3,
  }),
  Object.freeze({
    key: 'main_text',
    label: '商品主图',
    icon: '🖼️',
    defaultRatio: '1:1',
    defaultCount: 3,
    desc: '核心卖点展示，可含促销文字',
    usage: '主图轮播',
    maxCount: 5,
  }),
  Object.freeze({
    key: 'main_3x4',
    label: '商品主图 3:4',
    icon: '📱',
    defaultRatio: '3:4',
    defaultCount: 3,
    desc: '竖版主图，适合移动端展示',
    usage: '竖版主图',
    maxCount: 5,
  }),
  Object.freeze({
    key: 'transparent',
    label: '透明 PNG',
    icon: '🔲',
    defaultRatio: '1:1',
    defaultCount: 1,
    desc: '去底素材，方便二次设计',
    usage: '素材/合成用',
    maxCount: 3,
  }),
  Object.freeze({
    key: 'detail',
    label: '详情切片',
    icon: '📋',
    defaultRatio: '9:16',
    defaultCount: 5,
    desc: '长图详情页切片，含多种子类',
    usage: '详情页长图',
    maxCount: 10,
  }),
]);

export const RATIOS = ECOMMERCE_FORMATS;

function preset(name, icon, desc, images) {
  return Object.freeze({
    name,
    icon,
    desc,
    images: Object.freeze(images.map(image => Object.freeze({ ...image }))),
  });
}

export const PLATFORM_PRESETS = Object.freeze({
  smart: preset('智能推荐', '🤖', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  淘宝: preset('淘宝/天猫', '🟠', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  京东: preset('京东', '🔴', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  拼多多: preset('拼多多', '🟢', '5商品主图+3详情切片，促销风格', [
    { key: 'main_text', count: 5, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '9:16' },
  ]),
  抖音: preset('抖音小店', '🎵', '3商品主图+1透明PNG+3详情，竖版优先', [
    { key: 'main_3x4', count: 3, ratio: '3:4' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '9:16' },
  ]),
  小红书: preset('小红书商城', '📕', '3竖版主图+2详情，生活方式调性', [
    { key: 'main_3x4', count: 3, ratio: '3:4' },
    { key: 'detail', count: 2, ratio: '9:16' },
  ]),
  亚马逊: preset('Amazon', '🌐', '1纯白底首图+4商品主图+1透明PNG，不可含文字', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 4, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]),
});

const TYPE_BY_KEY = new Map(IMAGE_TYPES.map(type => [type.key, type]));

function normalizeResolution(value) {
  return RESOLUTIONS.has(value) ? value : '2K';
}

function normalizeCount(value, maxCount) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(maxCount, Math.trunc(count)));
}

function legalRatio(type, image) {
  return normalizeCommerceFormat({
    ratio: image?.ratio || type.defaultRatio,
    targetRatio: image?.targetRatio || image?.target_ratio,
    role: type.key,
  });
}

function sourceImages(platform, sizing) {
  if (Array.isArray(sizing?.images) && sizing.images.length > 0) return sizing.images;
  if (CONTENT_TYPE_PRESETS[sizing?.contentType]) return CONTENT_TYPE_PRESETS[sizing.contentType];
  const platformAliases = {
    taobao: '淘宝', tmall: '淘宝', pinduoduo: '拼多多', jd: '京东', douyin: '抖音',
    xiaohongshu: '小红书', amazon: '亚马逊', 'amazon-aplus-wide': '亚马逊',
  };
  return (PLATFORM_PRESETS[platform] || PLATFORM_PRESETS[platformAliases[platform]] || PLATFORM_PRESETS.smart).images;
}

export function getLegalRatios(resolution = '2K', role = 'main_text', platform = 'smart') {
  normalizeResolution(resolution);
  return formatsFor({ role, platform });
}

export function resolveSizingImages(platform = 'smart', sizing = {}) {
  const resolution = normalizeResolution(sizing?.resolution);
  const seen = new Set();
  const result = [];
  for (const image of sourceImages(platform, sizing)) {
    const type = TYPE_BY_KEY.get(image?.key);
    if (!type || seen.has(type.key)) continue;
    seen.add(type.key);
    const format = legalRatio(type, image);
    result.push({
      key: type.key,
      count: normalizeCount(image?.count ?? type.defaultCount, type.maxCount),
      ratio: format.generationRatio,
      targetRatio: format.targetRatio,
      cropPolicy: format.cropPolicy,
      label: type.label,
    });
  }
  return result;
}

function validSkuCount(skus) {
  if (!Array.isArray(skus)) return 0;
  return skus.filter(sku => ['color', 'size', 'capacity', 'dimLabel']
    .some(field => String(sku?.[field] || '').trim())).length;
}

export function resolveEcommercePlan({
  platform = 'smart',
  sizing = {},
  resolution = '2K',
  skus = [],
} = {}) {
  const normalizedResolution = normalizeResolution(resolution);
  const images = resolveSizingImages(platform, { ...sizing, resolution: normalizedResolution });
  const quantity = images.reduce((total, image) => total + image.count, 0) + validSkuCount(skus);
  return {
    resolution: normalizedResolution,
    images,
    quantity,
    quoteRequest: quantity > 0
      ? {
          sku: normalizedResolution === '4K' ? 'ec_image_4k' : 'ec_image_2k',
          quantity,
        }
      : null,
  };
}

function readablePoints(totalUnits) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format((Number(totalUnits) || 0) / 1000);
}

export function formatEcommerceQuote({ quantity = 0, quote = null, unlimited = false } = {}) {
  if (!quote) return `生成 ${quantity} 张 · 费用计算中`;
  return `生成 ${quantity} 张 · ${readablePoints(quote.totalUnits)} AI 积分`;
}

const SERVER_ORIGINAL_ASSET_ID = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/;
const PENDING_TEXT_LIMITS = Object.freeze({
  platform: 40,
  directionId: 96,
  directionBrief: 1200,
  skuLabel: 120,
  promptKey: 80,
  promptText: 6000,
  promptReference: 3000,
});
function safeReferenceText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || containsUnsafeImagePayload(text)) return '';
  return Number.isSafeInteger(maxLength) && maxLength > 0
    ? text.slice(0, maxLength)
    : text;
}

function uniqueAssetIds(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const assetId = typeof value?.assetId === 'string' ? value.assetId.trim() : '';
    if (!SERVER_ORIGINAL_ASSET_ID.test(assetId)) continue;
    if (!assetId || seen.has(assetId)) continue;
    seen.add(assetId);
    result.push(assetId);
  }
  return result;
}

function pendingSkus(values) {
  return (Array.isArray(values) ? values : []).flatMap((sku) => {
    const normalized = {
      color: safeReferenceText(sku?.color, PENDING_TEXT_LIMITS.skuLabel),
      size: safeReferenceText(sku?.size, PENDING_TEXT_LIMITS.skuLabel),
      capacity: safeReferenceText(sku?.capacity, PENDING_TEXT_LIMITS.skuLabel),
      dimLabel: safeReferenceText(sku?.dimLabel, PENDING_TEXT_LIMITS.skuLabel),
      count: Number.isSafeInteger(Number(sku?.count)) && Number(sku.count) > 0
        ? Number(sku.count)
        : 1,
    };
    return [normalized.color, normalized.size, normalized.capacity, normalized.dimLabel].some(Boolean)
      ? [normalized]
      : [];
  });
}

function pendingPromptReferences(values) {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const key = safeReferenceText(value?.key, PENDING_TEXT_LIMITS.promptKey);
    const text = safeReferenceText(value?.text, PENDING_TEXT_LIMITS.promptReference);
    const identity = `${key}\u0000${text}`;
    if (!key || !text || seen.has(identity)) continue;
    seen.add(identity);
    result.push({ key, text });
  }
  return result;
}

export function createEcommerceDraftId(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') {
    return `ec-draft-${cryptoApi.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const entropy = Math.random().toString(36).slice(2, 12) || 'fallback';
  return `ec-draft-${timestamp}-${entropy}`;
}

export function ecommerceQuoteRequestKey(quoteRequest, refreshVersion = 0) {
  const sku = typeof quoteRequest?.sku === 'string' ? quoteRequest.sku.trim() : '';
  const quantity = Number.isSafeInteger(quoteRequest?.quantity) && quoteRequest.quantity > 0
    ? quoteRequest.quantity
    : 0;
  const version = Number.isSafeInteger(refreshVersion) && refreshVersion >= 0
    ? refreshVersion
    : 0;
  return `${sku}:${quantity}:${version}`;
}

export function invalidateEcommerceQuote({ refreshVersion = 0 } = {}) {
  const version = Number.isSafeInteger(refreshVersion) && refreshVersion >= 0
    ? refreshVersion
    : 0;
  return {
    quote: null,
    refreshVersion: version + 1,
    message: '当前方案费用已更新，正在重新确认…',
  };
}

export function buildEcommercePendingAction({
  platform = 'smart',
  commerceContext,
  direction = {},
  sizing = {},
  skus = [],
  customColors = [],
  originalProductAssets = [],
  supplementalProductAssets = [],
  originalReferenceAssets = [],
  supplementalReferenceAssets = [],
  promptText = '',
  promptReferences = [],
} = {}) {
  const resolution = normalizeResolution(sizing?.resolution);
  const normalizedCommerceContext = commerceContext
    ? normalizeCommerceContext({ platform, ...commerceContext })
    : null;
  const safePlatform = safeReferenceText(normalizedCommerceContext?.platform || platform, PENDING_TEXT_LIMITS.platform) || 'smart';
  const directionBrief = safeReferenceText(
    direction?.brief
      ?? direction?.editableBrief
      ?? direction?.description
      ?? direction?.short_desc
      ?? direction?.one_liner,
    PENDING_TEXT_LIMITS.directionBrief,
  );
  return {
    type: 'ecommerce_generate',
    ...(normalizedCommerceContext ? { commerceContext: normalizedCommerceContext } : {}),
    direction: {
      id: safeReferenceText(direction?.id, PENDING_TEXT_LIMITS.directionId) || 'smart',
      brief: directionBrief,
    },
    sizing: {
      platform: safePlatform,
      ...(normalizedCommerceContext ? { contentType: normalizedCommerceContext.contentType } : {}),
      smart: sizing?.smart !== false,
      resolution,
      images: resolveSizingImages(safePlatform, { ...sizing, resolution })
        .map(({ key, count, ratio, targetRatio, cropPolicy }) => ({
          key,
          count,
          ratio,
          targetRatio,
          cropPolicy,
        })),
    },
    skus: pendingSkus(skus),
    customColors: (Array.isArray(customColors) ? customColors : [])
      .map(color => safeReferenceText(color, 16))
      .filter(color => /^#[0-9a-f]{3,8}$/i.test(color)),
    assetIds: {
      product: {
        original: uniqueAssetIds(originalProductAssets),
        supplemental: uniqueAssetIds(supplementalProductAssets),
      },
      reference: {
        original: uniqueAssetIds(originalReferenceAssets),
        supplemental: uniqueAssetIds(supplementalReferenceAssets),
      },
    },
    prompt: {
      text: safeReferenceText(promptText, PENDING_TEXT_LIMITS.promptText),
      references: pendingPromptReferences(promptReferences),
    },
  };
}
