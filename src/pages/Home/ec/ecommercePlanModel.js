const RESOLUTION_RATIOS = Object.freeze({
  '1K': Object.freeze(['1:1', '3:4', '4:3']),
  '2K': Object.freeze(['1:1', '3:4', '4:3', '9:16']),
  '4K': Object.freeze(['1:1', '3:4', '4:3', '9:16']),
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
    defaultRatio: '3:4',
    defaultCount: 5,
    desc: '长图详情页切片，含多种子类',
    usage: '详情页长图',
    maxCount: 10,
  }),
]);

export const RATIOS = Object.freeze([
  Object.freeze({ key: '1:1', label: '1:1', w: 18, h: 18, usage: '正方形' }),
  Object.freeze({ key: '3:4', label: '3:4', w: 14, h: 18, usage: '竖版' }),
  Object.freeze({ key: '4:3', label: '4:3', w: 18, h: 14, usage: '横版' }),
  Object.freeze({ key: '9:16', label: '9:16', w: 10, h: 18, usage: '全屏竖版' }),
]);

function preset(name, icon, desc, images) {
  return Object.freeze({
    name,
    icon,
    desc,
    images: Object.freeze(images.map(image => Object.freeze({ ...image }))),
  });
}

export const PLATFORM_PRESETS = Object.freeze({
  smart: preset('智能推荐', '🤖', 'AI 根据产品自动选择最佳平台和套餐', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '3:4' },
  ]),
  淘宝: preset('淘宝/天猫', '🟠', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '3:4' },
  ]),
  京东: preset('京东', '🔴', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '3:4' },
  ]),
  拼多多: preset('拼多多', '🟢', '5商品主图+3详情切片，促销风格', [
    { key: 'main_text', count: 5, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '3:4' },
  ]),
  抖音: preset('抖音小店', '🎵', '3商品主图+1透明PNG+3详情，竖版优先', [
    { key: 'main_3x4', count: 3, ratio: '3:4' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '3:4' },
  ]),
  小红书: preset('小红书商城', '📕', '3竖版主图+2详情，生活方式调性', [
    { key: 'main_3x4', count: 3, ratio: '3:4' },
    { key: 'detail', count: 2, ratio: '3:4' },
  ]),
  亚马逊: preset('Amazon', '🌐', '1纯白底首图+4商品主图+1透明PNG，不可含文字', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 4, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]),
});

const TYPE_BY_KEY = new Map(IMAGE_TYPES.map(type => [type.key, type]));

function normalizeResolution(value) {
  return Object.hasOwn(RESOLUTION_RATIOS, value) ? value : '2K';
}

function normalizeCount(value, maxCount) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(maxCount, Math.trunc(count)));
}

function legalRatio(type, requestedRatio, resolution) {
  const legal = RESOLUTION_RATIOS[resolution];
  if (legal.includes(requestedRatio)) return requestedRatio;
  if (legal.includes(type.defaultRatio)) return type.defaultRatio;
  return legal[0];
}

function sourceImages(platform, sizing) {
  if (Array.isArray(sizing?.images) && sizing.images.length > 0) return sizing.images;
  return (PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.smart).images;
}

export function getLegalRatios(resolution = '2K') {
  const legal = new Set(RESOLUTION_RATIOS[normalizeResolution(resolution)]);
  return RATIOS.filter(ratio => legal.has(ratio.key));
}

export function resolveSizingImages(platform = 'smart', sizing = {}) {
  const resolution = normalizeResolution(sizing?.resolution);
  const seen = new Set();
  const result = [];
  for (const image of sourceImages(platform, sizing)) {
    const type = TYPE_BY_KEY.get(image?.key);
    if (!type || seen.has(type.key)) continue;
    seen.add(type.key);
    result.push({
      key: type.key,
      count: normalizeCount(image?.count ?? type.defaultCount, type.maxCount),
      ratio: legalRatio(type, image?.ratio, resolution),
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
  if (unlimited) return `生成 ${quantity} 张 · 无限内测`;
  if (!quote) return `生成 ${quantity} 张 · 费用计算中`;
  return `生成 ${quantity} 张 · ${readablePoints(quote.totalUnits)} AI 积分`;
}
