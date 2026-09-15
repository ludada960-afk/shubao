import { containsUnsafeImagePayload } from '../../../utils/imagePayloadText.js';
import {
  ECOMMERCE_FORMATS,
  formatsFor,
  normalizeCommerceFormat,
} from './ecommerceFormatRegistry.js';
import { normalizeCommerceContext } from './internationalCommerceRegistry.js';
import { generationBillingSku, normalizeImageModel } from '../../../services/imageModelCatalog.js';

const RESOLUTIONS = new Set(['1K', '2K', '4K']);

/* ⚠️ 这里**曾经**有 `CONTENT_TYPE_PRESETS`（main / detail / ad 三套预设）。
   2026-09-15 删除，两个理由，缺一不可：
     ① **全仓零引用**（`grep -r CONTENT_TYPE_PRESETS` 只有定义这一处）—— 死代码；
     ② 它的 `ad` 套里引用了 `main_3x4`，而该类型本次已从 IMAGE_TYPES 删除 ——
        死代码 + 幽灵类型 = 下次谁复活它就会得到一个静默丢图的预设。
   删除前已确认无导出、无测试引用（见本次审计记录）。 */

export const IMAGE_TYPES = Object.freeze([
  Object.freeze({
    key: 'white_bg',
    label: '白底首图',
    /* 图标不再用 emoji（用户批注图3-③：「这 5 个图标完全就是那种很简单的那种 demo 版的东西」）。
       emoji 在不同系统上形状/配色不可控，且天然带「占位」观感；
       这里只存**语义键**，具体图标由 SizingPanel 从项目既有的 lucide 图标族里取。 */
    iconKey: 'whiteBg',
    defaultRatio: '1:1',
    defaultCount: 1,
    desc: '纯白底产品居中，电商必选',
    usage: '首图/主图',
    maxCount: 3,
  }),
  Object.freeze({
    key: 'main_text',
    label: '商品主图',
    iconKey: 'mainText',
    defaultRatio: '1:1',
    defaultCount: 3,
    desc: '核心卖点展示，可含促销文字',
    usage: '主图轮播',
    maxCount: 5,
  }),
  /* ⚠️ 这里**曾经**有一行 `main_3x4 / 商品主图 3:4`，2026-09-15 删除（用户批注图4-②）。
     用户原话：「这个商品主图 3:4 这个不要了……因为你下面如果有那种移动端优先的平台，
     你就自动给他出 3:4 就行了，不用单独多一行出来。」
     —— 3:4 不是「另一种图片」，而是**同一个「商品主图」在移动优先平台上的默认比例**，
        所以它归 ③平台 管，不归 ①类型 管（一处事实只写一遍）。

     ⚠️ **角色 key `main_3x4` 本身没有删除，也不许删**：后端出图引擎（server/ecommerceEngine/*、
        server/ecommercePromptEngine.mjs）与试穿链路（TryOnPlanPanel / EcMode 的「穿搭成片」）
        仍在用它，历史订单 payload 里也有。删掉的只是**面板上的那一行类型**。
        见 defaultRatioFor() —— 3:4 现在由平台推出来。 */
  Object.freeze({
    key: 'transparent',
    label: '透明 PNG',
    iconKey: 'transparent',
    defaultRatio: '1:1',
    defaultCount: 1,
    desc: '去底素材，方便二次设计',
    usage: '素材/合成用',
    maxCount: 3,
  }),
  Object.freeze({
    key: 'detail',
    label: '详情切片',
    iconKey: 'detail',
    defaultRatio: '9:16',
    defaultCount: 5,
    desc: '长图详情页切片，含多种子类',
    usage: '详情页长图',
    maxCount: 10,
  }),
]);

/* ═══ 已下线类型的登记表（2026-09-15）═══
   main_3x4 从**面板**删除（3:4 改由平台决定，见 defaultRatioFor），
   但它**不许从解析层消失** —— 历史 payload 里到处都是它：
     · 用户没提交完的草稿、画布快照；
     · 服务端已派发/已完成的任务；
     · **试穿链路（anything_tryon）现在仍然用它当角色 key**（EcMode/TryOnPlanPanel）。
   把它从 TYPE_BY_KEY 里删掉 = 这些数据会被**静默丢掉**，用户看到的张数凭空变少
   （全量测试当场抓到：UI 计划 14 张 ≠ 服务端 15 张）。铁律③：旧数据必须仍然可读。
   所以：登记表留它，IMAGE_TYPES 不留它 —— 用户看不到这一行，但数据认得它。 */
const LEGACY_IMAGE_TYPES = Object.freeze([
  Object.freeze({
    key: 'main_3x4',
    label: '商品主图 3:4',
    iconKey: 'mainPortrait',
    defaultRatio: '3:4',
    defaultCount: 3,
    desc: '竖版主图（历史数据的兼容项，面板已不再提供）',
    usage: '竖版主图',
    maxCount: 5,
  }),
]);

export const RATIOS = ECOMMERCE_FORMATS;

function preset(name, desc, images) {
  return Object.freeze({
    name,
    desc,
    images: Object.freeze(images.map(image => Object.freeze({ ...image }))),
  });
}

/* ═══ 平台决定「商品主图」的默认比例（2026-09-15 用户批注图4-②）═══
   用户原话：「如果它是那种移动端优先的平台，你就自动给它出 3:4 就行了。」

   判据（写清楚，免得下次又被问「为什么淘宝不是 3:4」）：
     竖版主图是**内容/信息流驱动**型平台的流量形态 —— 抖音、小红书、快手、TikTok Shop、SHEIN
     的浏览场景是竖屏信息流/短视频/穿搭，主图竖版才不被裁。
     而淘宝 / 京东 / 拼多多 / TEMU / Shopee / Lazada 这类**货架型商城**，
     主图规格本身仍是 1:1 方形 —— 不覆盖，否则会给用户出一个平台不收的尺寸。

   为什么放在这里而不是每个 type 上：
     3:4 是「同一个商品主图」在不同平台上的默认值，属于平台维度；放类型上就会出现
     「商品主图」和「商品主图 3:4」两行 —— 那正是这次要删掉的东西。 */
const PLATFORM_ID_ALIASES = Object.freeze({
  taobao: 'taobao', tmall: 'tmall', pinduoduo: 'pinduoduo', jd: 'jd',
  douyin: 'douyin', xiaohongshu: 'xiaohongshu', kuaishou: 'kuaishou',
  'tiktok-shop': 'tiktok-shop', shein: 'shein',
});
/* 中文 preset 名也认（resolveSizingImages 的入参历史上两种都有） */
const PLATFORM_LABEL_ALIASES = Object.freeze({
  淘宝: 'taobao', 天猫: 'tmall', 京东: 'jd', 拼多多: 'pinduoduo',
  抖音: 'douyin', 小红书: 'xiaohongshu', 快手: 'kuaishou', 亚马逊: 'amazon',
});

export const MOBILE_FIRST_PLATFORMS = Object.freeze(['douyin', 'xiaohongshu', 'kuaishou', 'tiktok-shop', 'shein']);

/** 把平台 id / 中文名 / 英文别名收敛成平台 id。 */
export function canonicalPlatform(platform) {
  const raw = String(platform || '').trim();
  if (!raw) return 'smart';
  return PLATFORM_LABEL_ALIASES[raw] || PLATFORM_ID_ALIASES[raw.toLowerCase()] || (raw === 'smart' ? 'smart' : raw);
}

/**
 * 某个图片类型在给定平台上的**默认比例**。
 * 规则：平台覆盖 > 类型默认。目前只有「商品主图 × 移动优先平台 → 3:4」一条覆盖。
 * @param {string} typeKey
 * @param {string} platform
 * @returns {string} 如 '3:4'
 */
export function defaultRatioFor(typeKey, platform = 'smart') {
  const type = TYPE_BY_KEY.get(typeKey);
  const base = type?.defaultRatio || '1:1';
  const id = canonicalPlatform(platform);
  if (typeKey === 'main_text' && MOBILE_FIRST_PLATFORMS.includes(id)) return '3:4';
  return base;
}

export const PLATFORM_PRESETS = Object.freeze({
  smart: preset('智能推荐', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  淘宝: preset('淘宝/天猫', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  京东: preset('京东', '1白底首图+3商品主图+1透明PNG+5详情=10张', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 5, ratio: '9:16' },
  ]),
  拼多多: preset('拼多多', '5商品主图+3详情切片，促销风格', [
    { key: 'main_text', count: 5, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '9:16' },
  ]),
  抖音: preset('抖音小店', '3商品主图+1透明PNG+3详情，竖版优先', [
    /* 3:4 挂在 main_text 上（原来是独立的 main_3x4 行）—— 见 defaultRatioFor 的注释 */
    { key: 'main_text', count: 3, ratio: '3:4' },
    { key: 'transparent', count: 1, ratio: '1:1' },
    { key: 'detail', count: 3, ratio: '9:16' },
  ]),
  小红书: preset('小红书商城', '3竖版主图+2详情，生活方式调性', [
    { key: 'main_text', count: 3, ratio: '3:4' },
    { key: 'detail', count: 2, ratio: '9:16' },
  ]),
  亚马逊: preset('Amazon', '1纯白底首图+4商品主图+1透明PNG，不可含文字', [
    { key: 'white_bg', count: 1, ratio: '1:1' },
    { key: 'main_text', count: 4, ratio: '1:1' },
    { key: 'transparent', count: 1, ratio: '1:1' },
  ]),
});

/* ⚠️ 用**全量表**建索引（含已下线类型）—— 解析层必须认得旧 key，
   否则历史 payload 会被静默丢弃。面板只遍历 IMAGE_TYPES，所以用户看不到那一行。 */
const ALL_IMAGE_TYPES = Object.freeze([...IMAGE_TYPES, ...LEGACY_IMAGE_TYPES]);
const TYPE_BY_KEY = new Map(ALL_IMAGE_TYPES.map(type => [type.key, type]));

function normalizeResolution(value) {
  return RESOLUTIONS.has(value) ? value : '2K';
}

function normalizeCount(value, maxCount) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(maxCount, Math.trunc(count)));
}

function legalRatio(type, image, platform) {
  return normalizeCommerceFormat({
    ratio: image?.ratio || defaultRatioFor(type.key, platform),
    targetRatio: image?.targetRatio || image?.target_ratio,
    role: type.key,
  });
}

function sourceImages(platform, sizing) {
  if (Array.isArray(sizing?.images) && sizing.images.length > 0) return sizing.images;
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
    const format = legalRatio(type, image, platform);
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

/* ═══ 面板显示层的历史类型迁移 ═══
   ⚠️ **只给面板用**（SizingPanel），绝不能塞进 resolveSizingImages：
   公共解析层一旦改 key，出图链路（尤其试穿）下发的角色就变了 —— 那是动生产，不是改显示。
   面板的问题很具体：它只渲染 IMAGE_TYPES 那 4 行，而历史 sizing 里可能带 main_3x4，
   于是「共 N 张图片」把一行看不见的图也算进去了。
   判据：**迁移前后总张数必须完全相等**（合并计数），否则用户会看到张数凭空变化。
   副作用（有意为之）：用户一旦改动这张表，写回的就已经是迁移后的形态了。 */
const LEGACY_SIZING_ALIASES = Object.freeze({ main_3x4: 'main_text' });

/**
 * 把历史 sizing 里的已下线类型合并进当前类型（仅用于面板显示/编辑）。
 * @param {Array<{key: string, count?: number}>} images
 * @returns {Array<object>} 新数组；原数组不被修改
 */
export function migrateLegacySizingImages(images) {
  if (!Array.isArray(images) || images.length === 0) return [];
  const out = [];
  const at = new Map();
  for (const image of images) {
    const target = LEGACY_SIZING_ALIASES[image?.key];
    if (!target) {
      if (!at.has(image.key)) { at.set(image.key, out.length); out.push({ ...image }); }
      continue;
    }
    const index = at.get(target);
    if (index === undefined) {
      at.set(target, out.length);
      out.push({ ...image, key: target });
      continue;
    }
    /* 合并计数：总张数不变（否则就是丢图） */
    out[index] = { ...out[index], count: (out[index].count || 0) + (image.count || 0) };
  }
  return out;
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
  imageModel = 'image2',
  skus = [],
} = {}) {
  const normalizedResolution = normalizeResolution(resolution);
  const normalizedImageModel = normalizeImageModel(imageModel);
  const images = resolveSizingImages(platform, { ...sizing, resolution: normalizedResolution });
  const quantity = images.reduce((total, image) => total + image.count, 0) + validSkuCount(skus);
  return {
    resolution: normalizedResolution,
    imageModel: normalizedImageModel,
    images,
    quantity,
    quoteRequest: quantity > 0
      ? {
          sku: generationBillingSku(normalizedImageModel, normalizedResolution),
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
  abilityRecipe,
  personMode,
  roleAssets,
  assetRoles,
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
  const normalizedAbilityRecipe = abilityRecipe && typeof abilityRecipe === 'object'
    ? {
      id: safeReferenceText(abilityRecipe.id, 64),
      version: Number.isSafeInteger(abilityRecipe.version) ? abilityRecipe.version : 1,
    }
    : null;
  const isTryOn = normalizedAbilityRecipe?.id === 'anything_tryon';
  const normalizedRoleAssets = isTryOn && roleAssets && typeof roleAssets === 'object'
    ? Object.fromEntries(['items', 'person', 'scene'].map(role => [role, uniqueAssetIds(roleAssets[role])]))
    : null;
  const normalizedAssetRoles = isTryOn
    ? (Array.isArray(assetRoles) ? assetRoles : []).map(item => ({
      assetId: safeReferenceText(item?.assetId, 160),
      role: safeReferenceText(item?.role, 24),
      ordinal: Number.isSafeInteger(item?.ordinal) && item.ordinal >= 0 ? item.ordinal : 0,
    })).filter(item => item.assetId && ['items', 'person', 'scene'].includes(item.role))
    : [];
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
    ...(isTryOn ? {
      abilityRecipe: normalizedAbilityRecipe,
      personMode: personMode === 'reference' ? 'reference' : 'smart',
      assetIds: {
        product: {
          original: uniqueAssetIds(originalProductAssets),
          supplemental: uniqueAssetIds(supplementalProductAssets),
        },
        reference: {
          original: uniqueAssetIds(originalReferenceAssets),
          supplemental: uniqueAssetIds(supplementalReferenceAssets),
        },
        items: normalizedRoleAssets?.items || [],
        person: normalizedRoleAssets?.person || [],
        scene: normalizedRoleAssets?.scene || [],
      },
      assetRoles: normalizedAssetRoles,
    } : {}),
    prompt: {
      text: safeReferenceText(promptText, PENDING_TEXT_LIMITS.promptText),
      references: pendingPromptReferences(promptReferences),
    },
  };
}
