const POLICY_VERSION = 'global-commerce-v1';

function freezeOptions(values) {
  return Object.freeze(values.map(value => Object.freeze({ ...value })));
}

export const COMMERCE_CONTENT_TYPES = freezeOptions([
  { id: 'main', label: '主图', description: '商品首图、轮播主图与 SKU 展示' },
  { id: 'detail', label: '详情图', description: '移动端纵向详情切片与可拼成长图' },
  { id: 'ad', label: '广告图', description: '站内广告、信息流与活动素材' },
]);

export const COMMERCE_PLATFORMS = freezeOptions([
  { id: 'smart', label: '智能匹配', market: 'smart', group: 'smart', locale: 'und', summary: '根据商品和参考图选择更稳妥的交付规范' },
  { id: 'taobao', label: '淘宝', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '方形主图、商品卖点与详情长图' },
  { id: 'tmall', label: '天猫', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '品牌化主图、详情切片与活动素材' },
  { id: 'pinduoduo', label: '拼多多', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '商品主体清晰，主图轮播与卖点信息' },
  { id: 'jd', label: '京东', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '商品主图、参数解释与场景证明' },
  { id: 'douyin', label: '抖音电商', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '移动端首图、场景卖点与短视频封面' },
  { id: '1688', label: '1688', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '批发采购视角、规格参数与工艺细节' },
  { id: 'xiaohongshu', label: '小红书', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '生活方式视觉、种草信息流与封面' },
  { id: 'kuaishou', label: '快手电商', market: 'domestic', group: 'domestic', locale: 'zh-CN', summary: '短视频商品展示、直播卖点与场景素材' },
  { id: 'alibaba-international', label: '阿里巴巴国际站', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: 'B2B 产品信息、规格和多语言沟通' },
  { id: 'amazon', label: 'Amazon', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '白底首图、最多 9 张辅图与事实型详情' },
  { id: 'amazon-aplus-wide', label: 'Amazon A+ 超宽幅', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '模块化品牌详情与横幅视觉' },
  { id: 'temu', label: 'TEMU', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '商品清晰度、规格和本地化卖点' },
  { id: 'ebay', label: 'eBay', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '商品多角度、状态说明与可信细节' },
  { id: 'shein', label: 'SHEIN', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '服饰版型、面料细节与本地化表达' },
  { id: 'shopee', label: 'Shopee', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '移动端商品轮播与区域化卖点' },
  { id: 'lazada', label: 'Lazada', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '商品主图、详情模块与东南亚语言' },
  { id: 'tiktok-shop', label: 'TikTok Shop', market: 'cross-border', group: 'cross-border', locale: 'en-US', summary: '方形商品图、场景内容与短视频封面' },
  { id: 'ozon', label: 'Ozon', market: 'cross-border', group: 'cross-border', locale: 'ru-RU', summary: '商品主体、规格信息与俄语卖点' },
]);

export const COMMERCE_LANGUAGES = freezeOptions([
  { id: 'visual', label: '无文字（纯视觉）', shortLabel: '纯视觉', locale: 'und', direction: 'ltr' },
  { id: 'zh-CN', label: '中文（简体）', shortLabel: '简中', locale: 'zh-CN', direction: 'ltr' },
  { id: 'zh-TW', label: '中文（繁体）', shortLabel: '繁中', locale: 'zh-TW', direction: 'ltr' },
  { id: 'en', label: '英语', shortLabel: 'EN', locale: 'en-US', direction: 'ltr' },
  { id: 'ja', label: '日语', shortLabel: '日本語', locale: 'ja-JP', direction: 'ltr' },
  { id: 'ko', label: '韩语', shortLabel: '한국어', locale: 'ko-KR', direction: 'ltr' },
  { id: 'de', label: '德语', shortLabel: 'Deutsch', locale: 'de-DE', direction: 'ltr' },
  { id: 'nl', label: '荷兰语', shortLabel: 'Nederlands', locale: 'nl-NL', direction: 'ltr' },
  { id: 'fr', label: '法语', shortLabel: 'Français', locale: 'fr-FR', direction: 'ltr' },
  { id: 'it', label: '意大利语', shortLabel: 'Italiano', locale: 'it-IT', direction: 'ltr' },
  { id: 'ar', label: '阿拉伯语', shortLabel: 'العربية', locale: 'ar-SA', direction: 'rtl' },
  { id: 'ru', label: '俄语', shortLabel: 'Русский', locale: 'ru-RU', direction: 'ltr' },
  { id: 'th', label: '泰语', shortLabel: 'ไทย', locale: 'th-TH', direction: 'ltr' },
  { id: 'id', label: '印尼语', shortLabel: 'Bahasa Indonesia', locale: 'id-ID', direction: 'ltr' },
  { id: 'vi', label: '越南语', shortLabel: 'Tiếng Việt', locale: 'vi-VN', direction: 'ltr' },
  { id: 'ms', label: '马来语', shortLabel: 'Bahasa Melayu', locale: 'ms-MY', direction: 'ltr' },
  { id: 'es', label: '西班牙语', shortLabel: 'Español', locale: 'es-ES', direction: 'ltr' },
  { id: 'es-MX', label: '墨西哥西班牙语', shortLabel: 'Español MX', locale: 'es-MX', direction: 'ltr' },
  { id: 'pt', label: '葡萄牙语', shortLabel: 'Português', locale: 'pt-PT', direction: 'ltr' },
  { id: 'pt-BR', label: '巴西葡萄牙语', shortLabel: 'Português BR', locale: 'pt-BR', direction: 'ltr' },
  { id: 'ro', label: '罗马尼亚语', shortLabel: 'Română', locale: 'ro-RO', direction: 'ltr' },
  { id: 'tr', label: '土耳其语', shortLabel: 'Türkçe', locale: 'tr-TR', direction: 'ltr' },
]);

const PLATFORM_ALIASES = new Map([
  ['smart', 'smart'], ['智能', 'smart'], ['智能匹配', 'smart'],
  ['淘宝', 'taobao'], ['taobao', 'taobao'],
  ['天猫', 'tmall'], ['tmall', 'tmall'],
  ['拼多多', 'pinduoduo'], ['pdd', 'pinduoduo'], ['pinduoduo', 'pinduoduo'],
  ['京东', 'jd'], ['jd', 'jd'],
  ['抖音', 'douyin'], ['抖音电商', 'douyin'], ['douyin', 'douyin'],
  ['1688', '1688'],
  ['小红书', 'xiaohongshu'], ['xiaohongshu', 'xiaohongshu'],
  ['快手', 'kuaishou'], ['快手电商', 'kuaishou'], ['kuaishou', 'kuaishou'],
  ['阿里巴巴国际站', 'alibaba-international'], ['alibaba-international', 'alibaba-international'],
  ['亚马逊', 'amazon'], ['amazon', 'amazon'],
  ['亚马逊a+超宽幅', 'amazon-aplus-wide'], ['amazon a+ wide', 'amazon-aplus-wide'], ['amazon-aplus-wide', 'amazon-aplus-wide'],
  ['temu', 'temu'], ['eBay', 'ebay'], ['ebay', 'ebay'], ['shein', 'shein'],
  ['shopee', 'shopee'], ['lazada', 'lazada'], ['tiktok', 'tiktok-shop'], ['tiktok shop', 'tiktok-shop'], ['tiktok-shop', 'tiktok-shop'],
  ['ozon', 'ozon'],
]);

const CONTENT_TYPE_ALIASES = new Map([
  ['main', 'main'], ['主图', 'main'], ['主图模式', 'main'],
  ['detail', 'detail'], ['详情图', 'detail'], ['详情', 'detail'],
  ['ad', 'ad'], ['广告图', 'ad'], ['广告', 'ad'],
]);

const LANGUAGE_ALIASES = new Map([
  ['visual', 'visual'], ['无文字', 'visual'], ['无文字（纯视觉）', 'visual'], ['纯视觉', 'visual'],
  ['中文', 'zh-CN'], ['中文（简体）', 'zh-CN'], ['简体中文', 'zh-CN'], ['zh-cn', 'zh-CN'],
  ['中文（繁体）', 'zh-TW'], ['繁体中文', 'zh-TW'], ['zh-tw', 'zh-TW'],
  ['英语', 'en'], ['英文', 'en'], ['en', 'en'],
  ...['日语', '韩语', '德语', '荷兰语', '法语', '意大利语', '阿拉伯语', '俄语', '泰语', '印尼语', '越南语', '马来语', '西班牙语', '葡萄牙语', '罗马尼亚语', '土耳其语']
    .map((label, index) => [label, ['ja', 'ko', 'de', 'nl', 'fr', 'it', 'ar', 'ru', 'th', 'id', 'vi', 'ms', 'es', 'pt', 'ro', 'tr'][index]]),
  ['墨西哥西班牙语', 'es-MX'], ['es-mx', 'es-MX'], ['巴西葡萄牙语', 'pt-BR'], ['pt-br', 'pt-BR'],
]);

function normalized(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizePlatformId(value) {
  const key = normalized(value);
  return PLATFORM_ALIASES.get(key) || PLATFORM_ALIASES.get(key.toLowerCase()) || 'smart';
}

export function isKnownPlatform(value) {
  const key = normalized(value);
  return PLATFORM_ALIASES.has(key) || PLATFORM_ALIASES.has(key.toLowerCase());
}

export function normalizeContentType(value) {
  return CONTENT_TYPE_ALIASES.get(normalized(value)) || 'main';
}

export function normalizeTargetLanguage(value) {
  const key = normalized(value);
  return LANGUAGE_ALIASES.get(key) || LANGUAGE_ALIASES.get(key.toLowerCase()) || 'zh-CN';
}

export function commercePlatform(platformId) {
  return COMMERCE_PLATFORMS.find(platform => platform.id === normalizePlatformId(platformId)) || COMMERCE_PLATFORMS[0];
}

export function commerceLanguage(languageId) {
  return COMMERCE_LANGUAGES.find(language => language.id === normalizeTargetLanguage(languageId)) || COMMERCE_LANGUAGES[0];
}

export function normalizeCommerceContext(value = {}) {
  const platform = commercePlatform(value.platform || value.platformId);
  const language = commerceLanguage(value.targetLanguage || value.target_language || value.language);
  return {
    platform: platform.id,
    contentType: normalizeContentType(value.contentType || value.content_type),
    targetLanguage: language.id,
    locale: language.locale === 'und' ? 'und' : language.locale,
    policyVersion: POLICY_VERSION,
  };
}

export { POLICY_VERSION };
