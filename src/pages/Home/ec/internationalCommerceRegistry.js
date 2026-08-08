export const COMMERCE_CONTENT_TYPES = Object.freeze([
  Object.freeze({ id: 'main', label: '主图', description: '商品首图、轮播主图与 SKU 展示' }),
  Object.freeze({ id: 'detail', label: '详情图', description: '移动端纵向详情切片与可拼成长图' }),
  Object.freeze({ id: 'ad', label: '广告图', description: '站内广告、信息流与活动素材' }),
]);

export const COMMERCE_PLATFORMS = Object.freeze([
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
].map(Object.freeze));

export const COMMERCE_LANGUAGES = Object.freeze([
  ['visual', '无文字（纯视觉）', '纯视觉', 'und', 'ltr'], ['zh-CN', '中文（简体）', '简中', 'zh-CN', 'ltr'], ['zh-TW', '中文（繁体）', '繁中', 'zh-TW', 'ltr'],
  ['en', '英语', 'EN', 'en-US', 'ltr'], ['ja', '日语', '日本語', 'ja-JP', 'ltr'], ['ko', '韩语', '한국어', 'ko-KR', 'ltr'], ['de', '德语', 'Deutsch', 'de-DE', 'ltr'],
  ['nl', '荷兰语', 'Nederlands', 'nl-NL', 'ltr'], ['fr', '法语', 'Français', 'fr-FR', 'ltr'], ['it', '意大利语', 'Italiano', 'it-IT', 'ltr'], ['ar', '阿拉伯语', 'العربية', 'ar-SA', 'rtl'],
  ['ru', '俄语', 'Русский', 'ru-RU', 'ltr'], ['th', '泰语', 'ไทย', 'th-TH', 'ltr'], ['id', '印尼语', 'Bahasa Indonesia', 'id-ID', 'ltr'], ['vi', '越南语', 'Tiếng Việt', 'vi-VN', 'ltr'],
  ['ms', '马来语', 'Bahasa Melayu', 'ms-MY', 'ltr'], ['es', '西班牙语', 'Español', 'es-ES', 'ltr'], ['es-MX', '墨西哥西班牙语', 'Español MX', 'es-MX', 'ltr'],
  ['pt', '葡萄牙语', 'Português', 'pt-PT', 'ltr'], ['pt-BR', '巴西葡萄牙语', 'Português BR', 'pt-BR', 'ltr'], ['ro', '罗马尼亚语', 'Română', 'ro-RO', 'ltr'], ['tr', '土耳其语', 'Türkçe', 'tr-TR', 'ltr'],
].map(([id, label, shortLabel, locale, direction]) => Object.freeze({ id, label, shortLabel, locale, direction })));

const alias = new Map([
  ['智能匹配', 'smart'], ['淘宝', 'taobao'], ['天猫', 'tmall'], ['拼多多', 'pinduoduo'], ['京东', 'jd'], ['抖音', 'douyin'], ['小红书', 'xiaohongshu'],
  ['阿里巴巴国际站', 'alibaba-international'], ['亚马逊', 'amazon'], ['亚马逊A+超宽幅', 'amazon-aplus-wide'], ['TEMU', 'temu'], ['eBay', 'ebay'], ['SHEIN', 'shein'], ['快手', 'kuaishou'],
  ['Shopee', 'shopee'], ['Lazada', 'lazada'], ['TikTok', 'tiktok-shop'], ['TikTok Shop', 'tiktok-shop'], ['Ozon', 'ozon'],
  ['无文字', 'visual'], ['无文字（纯视觉）', 'visual'], ['中文', 'zh-CN'], ['中文（简体）', 'zh-CN'], ['中文（繁体）', 'zh-TW'], ['英语', 'en'],
]);

export function normalizeCommerceContext(value = {}) {
  const rawPlatform = String(value.platform || '').trim();
  const rawLanguage = String(value.targetLanguage || value.target_language || '').trim();
  const platform = COMMERCE_PLATFORMS.some(item => item.id === rawPlatform)
    ? rawPlatform
    : alias.get(rawPlatform) || 'smart';
  const targetLanguage = COMMERCE_LANGUAGES.some(item => item.id === rawLanguage)
    ? rawLanguage
    : alias.get(rawLanguage) || 'visual';
  const language = COMMERCE_LANGUAGES.find(item => item.id === targetLanguage) || COMMERCE_LANGUAGES[0];
  return {
    platform,
    contentType: ['main', 'detail', 'ad'].includes(value.contentType) ? value.contentType : 'main',
    targetLanguage,
    locale: language.locale,
    policyVersion: 'global-commerce-v1',
  };
}
