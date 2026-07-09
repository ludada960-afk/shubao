/**
 * 薯包AI 电商 GPT-Image2 提示词引擎 v3
 *
 * 新设计：
 *   - 去掉固定 tier（basic/standard/complete）
 *   - 用户自由勾选要生成的图片类型 + 数量
 *   - 系统根据品类/卖点/参考图给出智能推荐
 *   - 每张图可以单独编辑 prompt 和重新生成
 */

import { loadPrompt } from './promptLoader.mjs';

// ============================================================
// Campaign Style Lock — 多图视觉一致性锁定机制
// ============================================================

/**
 * 风格包定义 — 每种风格包的 Campaign Style Lock 默认值
 * 描述改成卖家痛点语言，不是技术文档
 */
const STYLE_PACKS = {
  default: {
    label: '官方主图',
    subtitle: '纯白背景，产品居中，平台首图首选',
    emoji: '⬜',
    problem: '适合所有电商平台的首图和白底图。专业棚拍光线突出产品本身，支持叠加促销角标。',
    value: '所有电商平台的主图规范都适用，白底凸显产品',
    lock: {
      visualDirection: 'Professional e-commerce product photography, clean and minimal',
      palette: ['#FFFFFF', '#333333', '#666666'],
      colorTemp: 'neutral',
      backgroundSystem: 'Pure white infinity curve background, seamless, no texture',
      lightingSystem: 'Softbox overhead, even diffused studio lighting, soft shadows',
      layoutSystem: 'Centered composition, 60-70% product coverage, generous whitespace',
      productPresentation: '3/4 elevated angle, product as hero, sharp focus on details',
    },
  },
  scene_selling: {
    label: '场景卖点',
    subtitle: '买家用了是什么效果？照片告诉他',
    emoji: '🌿',
    problem: '买家犹豫不决？场景图让他想象使用效果，降低决策门槛，提升加购率',
    value: '✅ 产品融入真实使用环境  ✅ 提升购买欲望  ✅ 商品详情页转化首选',
    lock: {
      visualDirection: 'Warm lifestyle product photography, natural and inviting',
      palette: ['#F5F0EB', '#8B7355', '#C4A882', '#2C1810'],
      colorTemp: 'warm',
      backgroundSystem: 'Natural indoor/outdoor setting, soft textiles, wooden surfaces, botanical touches',
      lightingSystem: 'Soft natural window light, golden hour warmth, gentle ambient fill',
      layoutSystem: 'Rule of thirds, product as natural focal point in scene',
      productPresentation: 'Product naturally placed in context, lifestyle angles, human scale',
    },
  },
  detail_selling: {
    label: '卖点信息图',
    subtitle: '把产品优势讲清楚，买家不用问客服',
    emoji: '📋',
    problem: '买家不仔细看详情页？信息图把核心卖点一句话一张图讲完，减少咨询成本',
    value: '✅ 每张图聚焦一个卖点  ✅ 结构化排版  ✅ 配图标+中文标注  ✅ 减少客服咨询量',
    lock: {
      visualDirection: 'E-commerce infographic layout, clear information hierarchy',
      palette: ['#FFFFFF', '#1F2937', '#3B82F6', '#F3F4F6'],
      colorTemp: 'neutral',
      backgroundSystem: 'Clean white background with structured card sections, subtle divider lines',
      lightingSystem: 'Even studio lighting, no dramatic shadows, maximum readability',
      layoutSystem: 'Structured modular layout, numbered sections, icon+text badge pairs, 45%+ whitespace',
      productPresentation: 'Product on left 40%, information panels on right 55%, clear visual hierarchy',
    },
  },
  ugc_trust: {
    label: '真实感',
    emoji: '📱',
    problem: '买家怕买回来不一样？实拍感提升信任，降低退货率',
    value: '✅ 手机实拍感  ✅ 真实环境不摆拍  ✅ 看起来像真实买家秀  ✅ 信任度提升',
    lock: {
      visualDirection: 'Authentic UGC-style smartphone photo, candid and real, NOT professional',
      palette: ['#F5E6D3', '#8B7355', '#D4A574', '#3D2B1F'],
      colorTemp: 'warm',
      backgroundSystem: 'Real lived-in space, slightly messy, authentic environment, not styled',
      lightingSystem: 'Indoor mixed lighting, warm yellow cast, uneven, natural shadows',
      layoutSystem: 'Off-center, slightly tilted, imperfect framing, candid snapshot feel',
      productPresentation: 'Handheld or casually placed, imperfect framing, natural human interaction',
    },
  },
  brand_unified: {
    label: '品牌统一',
    subtitle: '多款商品放在店铺里像同一家出品',
    emoji: '💎',
    problem: '不同批次的商品图风格不统一，店铺像杂货铺？统一色板/光线/风格，提升专业感',
    value: '✅ 多款商品统一视觉风格  ✅ 提升店铺溢价能力  ✅ 品牌感瞬间拉满',
    lock: {
      visualDirection: 'Premium brand-consistent e-commerce photography, sophisticated and elegant',
      palette: ['#1A1A2E', '#16213E', '#E94560', '#0F3460'],
      colorTemp: 'cool',
      backgroundSystem: 'Dark gradient background from deep charcoal to black, subtle smoke or haze',
      lightingSystem: 'Dramatic side lighting with rim light, high contrast, selective spotlight',
      layoutSystem: 'Centered or slightly offset, dramatic negative space, editorial cropping',
      productPresentation: 'Low angle, heroic perspective, metallic reflections emphasized',
    },
  },
  promo_sale: {
    label: '促销活动',
    subtitle: '大促上新时抓住眼球',
    emoji: '🏷️',
    problem: '大促期间竞品多，主图不够突出？促销角标+价格文案，一眼抓住点击',
    value: '✅ 促销配色吸引注意  ✅ 价格/折扣区预留  ✅ 双11/618/新品上市场景适配',
    lock: {
      visualDirection: 'High-conversion promotional e-commerce banner, polished and urgent',
      palette: ['#FFFFFF', '#DC2626', '#FCD34D', '#1F2937'],
      colorTemp: 'warm',
      backgroundSystem: 'Clean bright background with accent color blocking, reserved zones for price/CTA',
      lightingSystem: 'Bright commercial lighting, high contrast to make product and promo area stand out',
      layoutSystem: 'Wide conversion-first layout, product clearly readable, planned negative space for marketing copy',
      productPresentation: 'Product prominently displayed, badges/callouts/price overlays in reserved zones',
    },
  },
};

/**
 * 转化驱动力类型 — 来自 liangdabiao 的诊断系统
 */
const CONVERSION_DRIVERS = {
  visual: {
    label: '视觉驱动型',
    description: '决策依赖外观、质感、风格匹配，重点展现视觉吸引力',
  },
  painpoint: {
    label: '痛点驱动型',
    description: '买家有明确问题需要解决，重点展示问题→解决方案',
  },
  emotional: {
    label: '情感价值驱动型',
    description: '购买与身份、信心、归属相关，重点塑造情感共鸣',
  },
};

/**
 * 构建 Campaign Style Lock 文字前缀
 * 所有图使用完全相同的前缀，确保视觉一致性
 */
function buildCampaignLockText(lock = {}) {
  if (!lock || !lock.visualDirection) return '';
  const parts = [
    `Campaign Style Lock: ${lock.visualDirection}`,
    lock.palette?.length ? `Fixed palette: ${lock.palette.join(', ')}` : '',
    lock.colorTemp ? `Color temperature: ${lock.colorTemp}` : '',
    lock.backgroundSystem ? `Background: ${lock.backgroundSystem}` : '',
    lock.lightingSystem ? `Lighting: ${lock.lightingSystem}` : '',
    lock.layoutSystem ? `Layout: ${lock.layoutSystem}` : '',
    lock.productPresentation ? `Product: ${lock.productPresentation}` : '',
  ].filter(Boolean);
  return parts.join('. ') + '. No color palette changes, no mixed styles, no inconsistent lighting.';
}

// ============================================================
// 品类视觉特征库
// ============================================================
const CATEGORY_VISUALS = {
  '美妆护肤': {
    materials: 'Frosted glass bottle, metallic cap, glossy label, smooth matte finish',
    texture: 'Smooth matte finish with soft glow, frosted glass texture, premium paper label',
    lighting: 'Soft beauty key light + fill 2:1 + backlight for product silhouette',
    scene_desc: 'Elegant bathroom vanity with white marble countertop',
    surface: 'White Carrara marble with subtle veining',
    detail_feature: 'Premium bottle cap with brand engraving',
    base_colors: 'Warm white, soft beige, rose gold',
    accent_colors: 'Rose gold, soft pink, pearl',
    color_scheme: 'Rose gold + soft pink + pure white — warm luxurious',
    background_detail: 'Soft gradient from pure white to pale pink',
    lighting_detail: 'Macro beauty ring light, even diffused illumination',
  },
  '数码3C': {
    materials: 'Brushed metal alloy, tempered glass, matte black finish, silicone grips',
    texture: 'Brushed metal, precision edges, anti-fingerprint coating, hairline finish',
    lighting: 'Dramatic studio light + cool rim light for metallic edges',
    scene_desc: 'Clean modern desk workspace with ambient lighting',
    surface: 'Light oak wood desk with subtle grain',
    detail_feature: 'Port/button details with precision machining',
    base_colors: 'Matte black, warm wood, clean white',
    accent_colors: 'Electric blue, cool silver',
    color_scheme: 'Charcoal black + cool silver + electric blue accent — tech premium',
    background_detail: 'Dark gradient from charcoal to pure black',
    lighting_detail: 'Edge rim light + soft ambient studio + subtle LED glow',
  },
  '食品饮料': {
    materials: 'Glass bottle/can, paper/cardboard label, sealed cap, natural ingredients',
    texture: 'Smooth cool glass, paper label texture, authentic ingredient visibility',
    lighting: 'Golden hour warm light + soft food photography fill',
    scene_desc: 'Rustic wooden table or natural outdoor setting with fresh ingredients',
    surface: 'Weathered wood tabletop with natural grain',
    detail_feature: 'Packaging seal and product freshness indicator',
    base_colors: 'Warm cream, olive green, natural wood',
    accent_colors: 'Deep red, amber, fresh green',
    color_scheme: 'Warm cream + olive green + amber — natural appetizing',
    background_detail: 'Warm gradient from cream to warm white',
    lighting_detail: 'Soft food photography lighting from upper-left window',
  },
  '服饰穿搭': {
    materials: 'Cotton/linen/silk fabric, metal zipper/buttons, leather/fabric tags',
    texture: 'Fabric weave texture, soft drape, natural fiber detail, stitch precision',
    lighting: 'Soft window light + gentle fill, fashion editorial style',
    scene_desc: 'Minimalist interior or clean urban background',
    surface: 'Clean floor or flat lay surface',
    detail_feature: 'Fabric weave and texture detail close-up',
    base_colors: 'Warm beige, cream, charcoal',
    accent_colors: 'Season fashion color, metallic hardware',
    color_scheme: 'Cream + charcoal + seasonal accent — editorial fashion',
    background_detail: 'Soft gray gradient to warm beige',
    lighting_detail: 'Soft fashion window light + subtle rim',
  },
  '家居生活': {
    materials: 'Porcelain/ceramic, natural wood, cotton/linen, metal accents',
    texture: 'Natural grain, glazed finish, woven fabric, brushed metal',
    lighting: 'Natural daylight + warm accent lamp, cozy ambience',
    scene_desc: 'Cozy living room or bedroom corner with warm decor',
    surface: 'Coffee table, shelf, or bedside table with linen runner',
    detail_feature: 'Material grain and craftsmanship detail',
    base_colors: 'Warm beige, soft gray, cream',
    accent_colors: 'Sage green, terracotta, warm brown',
    color_scheme: 'Warm beige + sage green + terracotta — cozy Nordic',
    background_detail: 'Soft texture wall, warm earthy tones',
    lighting_detail: 'Natural window light + warm table lamp glow',
  },
  '母婴用品': {
    materials: 'BPA-free smooth plastic, soft silicone, gentle fabric, rounded edges',
    texture: 'Soft-touch matte surface, smooth polished edges, gentle fabric',
    lighting: 'Very soft, diffuse warm light — safe, gentle atmosphere',
    scene_desc: 'Soft, calm nursery or clean family interior',
    surface: 'Soft rug or clean changing table surface',
    detail_feature: 'Safety edge and smooth surface detail',
    base_colors: 'Soft mint, lavender, peach',
    accent_colors: 'Pure white, warm cream',
    color_scheme: 'Pastel mint + lavender + cream — gentle safe',
    background_detail: 'Pastel gradient — pale mint to cream',
    lighting_detail: 'Diffuse nursery window light, soft and even',
  },
  '宠物用品': {
    materials: 'Durable nylon/polyester, rubber base, soft foam, metal hardware',
    texture: 'Durable woven fabric, rubber grip texture, smooth plastic, foam padding',
    lighting: 'Warm natural light + playful bright accent',
    scene_desc: 'Cozy home corner or clean outdoor grass/park setting',
    surface: 'Floor, pet bed surface, or clean grass',
    detail_feature: 'Material durability and stitch reinforcement',
    base_colors: 'Warm neutrals, soft greens',
    accent_colors: 'Brand signature color, bright blue/red',
    color_scheme: 'Warm tan + sage green + brand accent — active pet lifestyle',
    background_detail: 'Soft warm neutral, subtle green tint',
    lighting_detail: 'Natural window light, bright and playful',
  },
  '其他': {
    materials: 'Premium quality materials, clean finish, professional appearance',
    texture: 'High-quality surface texture, refined finish',
    lighting: 'Professional studio lighting — soft key + rim + fill',
    scene_desc: 'Clean professional setting appropriate for product type',
    surface: 'Clean neutral surface',
    detail_feature: 'Product quality detail',
    base_colors: 'Clean white, soft gray, neutral',
    accent_colors: 'Professional brand tone',
    color_scheme: 'White + soft gray + brand accent — clean professional',
    background_detail: 'Clean neutral gradient',
    lighting_detail: 'Professional studio — soft key + rim + fill',
  },
};

// ============================================================
// 图片角色定义 — 每张图的内容策略不同
// ============================================================
const IMAGE_ROLES = {
  white_bg: {
    label: '白底图',
    group: '主图',
    desc: '纯白底产品展示·无文字',
    ratio: '1:1',
    priority: 1,
  },
  main_text: {
    label: '主图文案',
    group: '主图',
    desc: '白底+促销文案/角标',
    ratio: '1:1',
    priority: 2,
  },
  feature_1: {
    label: '卖点图①',
    group: '卖点图',
    desc: '核心卖点展示',
    ratio: '1:1',
    priority: 3,
  },
  feature_2: {
    label: '卖点图②',
    group: '卖点图',
    desc: '第二卖点展示',
    ratio: '1:1',
    priority: 4,
  },
  feature_3: {
    label: '卖点图③',
    group: '卖点图',
    desc: '第三卖点展示',
    ratio: '1:1',
    priority: 5,
  },
  composite: {
    label: '组合图',
    group: '品牌',
    desc: '主图+细节+场景 三合一展示',
    ratio: '3:4',
    priority: 7,
  },
  scene: {
    label: '场景图',
    group: '场景',
    desc: '使用场景展示',
    ratio: '3:4',
    priority: 6,
  },
  detail: {
    label: '详情图',
    group: '详情',
    desc: '商品详情竖向大图',
    ratio: '3:4',
    priority: 7,
  },
  macro: {
    label: '材质特写',
    group: '细节',
    desc: '材质/工艺微距',
    ratio: '3:4',
    priority: 8,
  },
  comparison: {
    label: '效果对比',
    group: '对比',
    desc: '使用前后对比',
    ratio: '3:4',
    priority: 9,
  },
  sku: {
    label: '多规格展示',
    group: '规格',
    desc: '颜色/尺寸变体',
    ratio: '1:1',
    priority: 10,
  },
  package: {
    label: '包装组合',
    group: '包装',
    desc: '全套配件/包装',
    ratio: '3:4',
    priority: 11,
  },
  transparent: {
    label: '透明PNG素材',
    group: '素材',
    desc: '无背景透明图',
    ratio: '1:1',
    priority: 12,
  },
  beauty_report: {
    label: '美妆分析报告',
    group: '报告',
    desc: '肤质分析+产品推荐+试色矩阵信息图',
    ratio: '3:4',
    priority: 20,
  },
};

// ============================================================
// 生成等级 → 包含的图片角色
// ============================================================
const TIER_ROLES = {
  basic:    ['white_bg', 'feature_1', 'scene'],
  standard: ['white_bg', 'feature_1', 'feature_2', 'scene', 'detail'],
  complete: ['white_bg', 'feature_1', 'feature_2', 'feature_3', 'scene', 'detail', 'comparison', 'sku', 'package'],
};

const TIER_META = {
  basic:    { label: '基础版', count: 3, price: 1 },
  standard: { label: '标准版', count: 5, price: 2 },
  complete: { label: '完整版', count: 9, price: 3 },
};

// ============================================================
// 平台尺寸映射 — 更精准
// ============================================================
const PLATFORM_SIZES = {
  '淘宝': {
    '1:1': '800×800px',
    '3:4': '750×1000px',
    desc: '淘宝/天猫，首图800×800纯白底',
  },
  '京东': {
    '1:1': '800×800px',
    '3:4': '790×1024px',
    desc: '京东，品质优先，首图800×800',
  },
  '拼多多': {
    '1:1': '480×480px',
    '3:4': '750×1000px',
    desc: '拼多多，可含促销文字',
  },
  '小红书电商': {
    '1:1': '800×800px',
    '3:4': '1242×1660px',
    desc: '小红书商城，3:4竖版与信息流一致',
  },
  '抖音电商': {
    '1:1': '800×800px',
    '3:4': '720×960px',
    desc: '抖音小店，视觉冲击力强',
  },
  '亚马逊': {
    '1:1': '1000×1000px',
    '3:4': '1500×2000px',
    desc: 'Amazon，白底图不可含文字，建议大图2000px',
  },
};

const PLATFORM_VISUAL_GUIDE = {
  '淘宝': 'Taobao/Tmall style. Clean commercial photography for Chinese marketplace.',
  '京东': 'JD.com premium style. High-end, minimal promotional elements.',
  '拼多多': 'Pinduoduo style. Energetic, bright colors, price-aware.',
  '小红书电商': 'RED lifestyle style. Aesthetic, aspirational, 3:4 vertical, warm editorial.',
  '抖音电商': 'Douyin style. Dynamic, high impact, mobile-first vertical.',
  '亚马逊': 'Amazon compliant. Main image: pure white #FFFFFF bg, no text/logos/watermarks.',
};

// ============================================================
// 提示词构建器 — 每张图不同角色
// ============================================================

/**
 * 获取某个生成等级下的所有图片角色配置
 */
export function getTierImages(tier = 'basic', sellingPoints = [], category = '其他') {
  const roleKeys = TIER_ROLES[tier] || TIER_ROLES.basic;
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  return roleKeys.map((key, idx) => {
    const role = IMAGE_ROLES[key];
    const sp = sellingPoints[idx] || sellingPoints[0] || '';
    return { key, ...role, sellingPoint: sp, cat };
  });
}

/**
 * 构建单张电商图提示词
 * @param {Object} params
 * @param {string} params.productName - 商品名称
 * @param {string} params.category - 品类
 * @param {string} params.roleKey - 图片角色键 (main_white / feature_1 / scene / etc.)
 * @param {string[]} params.sellingPoints - 所有卖点列表
 * @param {string} params.platform - 目标平台
 * @returns {string} prompt
 */
export function buildECPrompt({ productName, category, roleKey, sellingPoints = [], platform = '淘宝', stylePack, campaignLock, conversionDriver }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  // 去掉数字后缀（如 detail_1 → detail，white_bg_2 → white_bg）
  const baseKey = roleKey.replace(/_\d+$/, '');
  // feature_N → feature_1/2/3 映射到 IMAGE_ROLES
  const mappedKey = baseKey === 'feature' ? `feature_${roleKey.match(/_(\d+)$/)?.[1] || 1}` : baseKey;
  const role = IMAGE_ROLES[mappedKey];
  if (!role) return buildGenericPrompt(productName, category, cat);

  // 定位当前图片要突出的卖点
  const roleIdx = Object.keys(IMAGE_ROLES).indexOf(roleKey);
  const myPoint = sellingPoints[Math.min(roleIdx, sellingPoints.length - 1)] || '';
  const allPoints = sellingPoints.slice(0, 3).filter(Boolean);

  const platformVisual = PLATFORM_VISUAL_GUIDE[platform] || PLATFORM_VISUAL_GUIDE['淘宝'];
  const platformDesc = PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'];
  const sizeInfo = platformDesc[role.ratio] || '';

  let prompt = buildRolePrompt(mappedKey, {
    productName, category, cat, myPoint, allPoints,
    platform, platformVisual, sizeInfo,
  });

  // Campaign Style Lock — 多图视觉一致性锁定
  // 白底图跳过锁：白底图必须纯白无文案，不受风格包影响
  let lock = (mappedKey === 'white_bg') ? null : campaignLock;
  if (!lock && mappedKey !== 'white_bg' && stylePack && STYLE_PACKS[stylePack]) {
    lock = STYLE_PACKS[stylePack].lock;
  }
  const lockText = buildCampaignLockText(lock);
  if (lockText) {
    prompt = `${lockText}\n\n${prompt}`;
  }

  // 转化驱动力提示
  if (conversionDriver && CONVERSION_DRIVERS[conversionDriver]) {
    const driver = CONVERSION_DRIVERS[conversionDriver];
    prompt += `\n\nCONVERSION STRATEGY: ${driver.label} — ${driver.description}`;
  }

  return prompt;
}

// ============================================================
// 各角色提示词构建
// ============================================================

function buildRolePrompt(roleKey, ctx) {
  const { productName, category, cat, myPoint, allPoints, platform, platformVisual, sizeInfo } = ctx;

  switch (roleKey) {
    case 'white_bg':
      return (
        `E-commerce pure white background product photo of ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `BACKGROUND: Absolutely pure white background (RGB #FFFFFF, no gradient, no texture, no pattern). ` +
        `The entire background behind the product must be uniform pure white. ` +
        `LIGHTING: ${cat.lighting}. Soft diffused shadow below product on white surface. ` +
        `COMPOSITION: Product centered, 3/4 elevated angle, covering 60-70% of frame. ` +
        `Ample whitespace around product. Product edges clearly defined. ` +
        `STYLE: Professional commercial product photography. Hyper-realistic 8K. Extreme sharp focus. ` +
        `CRITICAL — TEXT RULE: ABSOLUTELY NO text, Chinese characters, badges, labels, logos, watermarks, ` +
        `price tags, brand marks, or any writing on this image. The image must be completely text-free. ` +
        `CRITICAL — NO PEOPLE: No models, no hands, no body parts. Product only. ` +
        `CRITICAL — NO DECOR: No flowers, no props, no decorative elements. Just the product on white. ` +
        `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'main_text':
      return (
        `E-commerce main listing image with promotional text for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `BACKGROUND: White or clean gradient background. Not necessarily pure white — soft accent allowed. ` +
        `LIGHTING: ${cat.lighting}. Studio quality. ` +
        `COMPOSITION: Product prominently displayed in main area (50-60% of frame). ` +
        `Reserved zone for promotional text overlay. ` +
        `TEXT: Include Chinese promotional text on the image. ` +
        `At bottom or corner: small price tag or discount badge (e.g., "${myPoint || '限时优惠'}" or "新品" in Chinese). ` +
        `Max 2-3 short Chinese text elements. Text should be clean sans-serif, high contrast. ` +
        `STYLE: Professional e-commerce main image. Polished, conversion-optimized. ` +
        `CRITICAL — NO PEOPLE: No models, no hands, no body parts. Product only plus text. ` +
        `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'feature_1':
    case 'feature_2':
    case 'feature_3': {
      const point = myPoint || (allPoints[roleKey === 'feature_1' ? 0 : roleKey === 'feature_2' ? 1 : 2]) || '优质精选';
      return (
        `E-commerce feature/selling-point image of ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `SETTING: Clean studio background — soft gradient from ${cat.base_colors}. ` +
        `Lighting: ${cat.lighting}. ${cat.surface} surface with subtle reflection. ` +
        `COMPOSITION: Product on left (60%), space on right for text. ` +
        `TEXT OVERLAY on right side: Large Chinese headline "${point}" in bold white sans-serif (48px), ` +
        `with 1-2 line supporting description in Chinese below (24px). Clean pill badge style. ` +
        `Color: ${cat.accent_colors} accent for text. Subtle glow behind text area. ` +
        `STYLE: Premium commercial product photography. Sharp focus on product. ` +
        `CONSTRAINTS: Chinese text must be accurate. No fake characters. Product readable. ` +
        `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );
    }

    case 'scene':
      return (
        `Professional lifestyle e-commerce product scene of ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `SCENE: ${cat.scene_desc}. Surface: ${cat.surface}. Props: 2-3 contextual lifestyle items. ` +
        `LIGHTING: ${cat.lighting}. Color palette: ${cat.color_scheme}. ` +
        `COMPOSITION: Product as hero in lifestyle context, natural arrangement. ` +
        `STYLE: Professional lifestyle e-commerce photography. Warm natural atmosphere. ` +
        `Product packaging readable. Natural white balance. ` +
        `TEXT: NO text overlay — scene should feel natural. ` +
        `CONSTRAINTS: Chinese product labels/packaging text MUST be readable and accurate. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'detail': {
      const point = myPoint || (allPoints.length > 0 ? allPoints[0] : '精工细节');
      return (
        `E-commerce product detail description image for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `LAYOUT: Vertical 3:4 portrait infographic-style detail page. ` +
        `Top 20%: Product hero shot with "${productName}" Chinese title. ` +
        `Middle 50%: 3-4 feature panels stacked vertically. Each panel: ` +
        `icon + short Chinese label + 1 line explanation. Panels separated by thin hairline rules. ` +
        `Bottom 30%: Product shown in context or with size/specs summary. ` +
        `BACKGROUND: ${cat.background_detail}. LIGHTING: ${cat.lighting}. ` +
        `COLOR: ${cat.color_scheme}. ` +
        `TEXT: All text in Chinese. Feature panels each labeled in Chinese. ` +
        `Product price/specs in bottom area. ` +
        `STYLE: Clean infographic-style detail page. Professional, convincing, readable on mobile. ` +
        `CONSTRAINTS: Chinese text accurate. Mobile-friendly font sizes. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );
    }

    case 'macro': {
      const point = myPoint || (allPoints.length > 1 ? allPoints[1] : '精工细节');
      return (
        `Professional product detail close-up of ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `DETAIL: ${cat.detail_feature}. Macro photography shot. Extreme close-up on material/craft. ` +
        `LIGHTING: ${cat.lighting_detail}. ` +
        `LAYOUT: Macro close-up occupies 75% of frame. 25% space for feature callouts. ` +
        `Left side: extreme macro close-up showing material texture and craftsmanship detail. ` +
        `Right side: 2-3 short feature callout labels with thin connector lines pointing to details. ` +
        `TEXT OVERLAY: Main headline "${point}" in top area (Chinese, bold, 36px). ` +
        `2-3 callout badges: pill badges with white text on semi-transparent dark background. ` +
        `Max 8 Chinese characters per callout. Connector lines from callout to detail area. ` +
        `STYLE: Macro product photography. 8K sharp focus. Texture detail clearly visible. ` +
        `CONSTRAINTS: ALL Chinese annotations accurate. Short text only. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );
    }

    case 'comparison': {
      const point = myPoint || (allPoints[0] || '全新升级');
      return (
        `Professional before-after / comparison image for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `LAYOUT: Split-screen comparison design. Left half labeled "BEFORE" / "改善前", ` +
        `right half labeled "AFTER" / "改善后" with ${productName}. ` +
        `Right side: ${productName} in use, showing improvement. ` +
        `Center divider: thin vertical line with arrow or progress indicator. ` +
        `LIGHTING: Consistent across both halves — ${cat.lighting}. ` +
        `COLOR: ${cat.color_scheme}. ` +
        `Bottom strip: Chinese text "${point}" in bold. ` +
        `STYLE: Professional comparison layout. Clean, editorial, trustworthy. ` +
        `CONSTRAINTS: Both halves must look like same environment/lighting. Chinese text accurate. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );
    }

    case 'composite':
      return (
        `Multi-panel brand product showcase image for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `LAYOUT: Single image with built-in panel divisions (NOT a collage of separate photos). ` +
        `MAIN PANEL (left 55-60% x full height): Product hero shot, clean brand background. ` +
        `SIDE PANEL TOP (right 40-45%, top half): Detail close-up with short Chinese label. ` +
        `${cat.detail_feature}. ` +
        `SIDE PANEL BOTTOM (right 40-45%, bottom half): Lifestyle/use context scene. ` +
        `BOTTOM STRIP (full width, ~15% height): Product name and category in Chinese. ` +
        `BACKGROUND: ${cat.background_detail}. LIGHTING: Consistent across all panels - ${cat.lighting}. ` +
        `COLOR: ${cat.color_scheme}. ` +
        `DIVIDERS: Thin 1px lines between panels. Subtle shadow depth between sections. ` +
        `STYLE: Premium brand lookbook editorial. Magazine-quality layout. ` +
        `CONSTRAINTS: All panels share consistent lighting/color. Chinese text accurate. ` +
        `CRITICAL: This is ONE image with panel divisions, NOT a collage of separate photos. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'sku':
      return (
        `E-commerce SKU/variant showcase image for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `LAYOUT: Multiple variants (colors/sizes) arranged horizontally. ` +
        `Each variant with a small Chinese label below: color/size name. ` +
        `BACKGROUND: ${cat.background_detail}. LIGHTING: ${cat.lighting}. ` +
        `COMPOSITION: 3-4 products side by side, equally spaced, consistent angle. ` +
        `TEXT: Small Chinese labels under each variant (color name, max 4 chars). ` +
        `STYLE: Clean, organized SKU display. Professional catalog photography. ` +
        `CONSTRAINTS: All variants must share same lighting/angle. Labels accurate. ` +
        `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'package':
      return (
        `Professional packaging and accessories showcase for ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `LAYOUT: Full set display — product + packaging box + all accessories. ` +
        `Arranged in a clean fan-out or layered composition. ` +
        `BACKGROUND: ${cat.background_detail}. LIGHTING: ${cat.lighting}. ` +
        `COMPOSITION: Elevated flat lay or slight angle showing all items. ` +
        `TEXT: "${productName}" product name + "全套展示" label in Chinese. ` +
        `STYLE: Premium unboxing / product set photography. Brand presentation. ` +
        `CONSTRAINTS: Chinese text accurate. All items in sharp focus. ` +
        `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    case 'transparent':
      return (
        `E-commerce transparent PNG product image of ${productName}. ` +
        `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
        `SETTING: Absolutely NO background — transparent. Product isolated. ` +
        `LIGHTING: ${cat.lighting}. Soft shadow below product (for compositing). ` +
        `COMPOSITION: 3/4 elevated angle, product centered, covering 85%+ of frame. ` +
        `STYLE: Cut-out product photography. Clean edges. No background at all. ` +
        `TEXT: NO text, badges, labels, or logos. ` +
        `CONSTRAINTS: Must look like a professionally cut-out transparent PNG. ` +
        `Edges must be clean and sharp. No background elements. ` +
        `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}`
      );

    default:
      return buildGenericPrompt(productName, category, cat);
  }
}

function buildGenericPrompt(name, category, v) {
  return (
    `E-commerce product photo of ${name}. ` +
    `PRODUCT: ${name}, ${category}. ${v.materials}. ${v.texture}. ` +
    `SETTING: Clean studio. ${v.lighting}. ` +
    `COMPOSITION: Product centered, professional angle. ` +
    `STYLE: Professional commercial photography. Hyper-realistic. ` +
    `ASPECT RATIO: 1:1 square.`
  );
}

export function getCategoryOptions() {
  return Object.keys(CATEGORY_VISUALS);
}

/**
 * 构建「美妆分析报告」提示词 — 一张信息图 = 分析+推荐+试色
 * 来自 awesome-gpt-image-2 的 Personalized Beauty Report 模板
 */
export function buildBeautyReportPrompt({ productName, category = '美妆护肤', sellingPoints = [], platform = '淘宝' }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['美妆护肤'];
  const points = sellingPoints.slice(0, 4).filter(Boolean);
  const pointText = points.length > 0
    ? points.map((p, i) => `- 卖点${i + 1}：${p}`).join('\n')
    : '- 卖点1：核心成分/功效\n- 卖点2：适合肤质\n- 卖点3：使用场景';

  return (
    `你是专业美妆顾问 + 品牌视觉设计系统。生成一张竖版美妆推荐报告信息图。

PRODUCT: ${productName}
CATEGORY: ${category}
MATERIALS: ${cat.materials}
COLORS: ${cat.color_scheme}

版式结构（9:16 竖版）：
- 左上区（30%）：${productName} 产品 hero 展示，品牌名，一句定位语
- 右上区（20%）：肤质/品类分析结论，2-3 行
- 中区（30%）：3-4 个卖点/推荐矩阵（图标+短文案+小色块）
  ${pointText}
- 底区（20%）：一句话建议 + 品牌视觉点缀（细线/强调色/小 icon）

视觉要求：
高端美妆编辑视觉，结构化信息可视化排版，真实质感，9:16 竖版。
配色：${cat.color_scheme}。
背景：${cat.background_detail}。
灯光：${cat.lighting_detail}。
风格：品牌级美妆推荐报告，克制高级，文字短而有力。

约束：
- 所有文字必须清晰可读，中文准确
- 同一张脸（或产品），仅展示不同维度
- 品牌只做点缀（细线、强调色），不铺大色块
- NO fake Chinese characters, NO placeholder text
- 输出：高完成度信息图，9:16 竖版`
  );
}

// ============================================================
// v3 新功能: 智能推荐 + 大纲生成
// ============================================================

/**
 * 图片角色定义 — 用户端可见的信息（含推荐规则）
 */
const IMAGE_TYPE_INFO = [
  {
    key: 'white_bg',
    label: '白底图',
    emoji: '⬜',
    mandatory: true,
    defaultCount: 1,
    maxCount: 3,
    explainer: '纯白底+产品居中，无文字无水印无模特。所有电商平台搜索首图的硬性要求。亚马逊必须用这个。',
    recommendRule: '必选。至少 1 张纯白底'
  },
  {
    key: 'main_text',
    label: '主图文案',
    emoji: '🖼️',
    mandatory: false,
    defaultCount: 0,
    maxCount: 3,
    explainer: '在白底图上叠加促销文案/角标/价格标签。淘宝/京东/拼多多主图可选。亚马逊不可用。',
    recommendRule: '需要突出促销信息时选，白底图之外额外增加'
  },
  {
    key: 'feature',
    label: '卖点解说图',
    emoji: '💬',
    mandatory: false,
    defaultCount: 0,
    maxCount: 6,
    explainer: '每张讲一个卖点，配中文标注和排版，买家扫一眼就知道值在哪',
    recommendRule: '有卖点文案时推荐，每张图讲清楚一个核心卖点'
  },
  {
    key: 'scene',
    label: '使用场景图',
    emoji: '🌿',
    mandatory: false,
    defaultCount: 0,
    maxCount: 4,
    explainer: '产品出现在真实使用环境中，买家看了会想象"我也需要"',
    recommendRule: '家居/美妆/食品类目效果翻倍，推荐1-2张'
  },
  {
    key: 'detail',
    label: '详情图',
    emoji: '📋',
    mandatory: false,
    defaultCount: 0,
    maxCount: 6,
    explainer: '3:4竖版详情大图，展示产品细节/卖点/规格。放在商品详情页，替代详情页文案。',
    recommendRule: '建议出2-4张，覆盖材质/工艺/尺寸/功能等细节',
  },
  {
    key: 'macro',
    label: '材质特写',
    emoji: '🔍',
    mandatory: false,
    defaultCount: 0,
    maxCount: 3,
    explainer: '微距拍材质/工艺细节，高客单价商品靠这个打消质量疑虑',
    recommendRule: '填了材质信息时推荐1张'
  },
  {
    key: 'sku',
    label: '多规格展示',
    emoji: '🎨',
    mandatory: false,
    defaultCount: 0,
    maxCount: 3,
    explainer: '不同颜色/尺寸放在一张图里，买家挑款不用来回翻',
    recommendRule: '有多张参考图时推荐，适合多色/多规格商品'
  },
  {
    key: 'comparison',
    label: '效果对比',
    emoji: '↔️',
    mandatory: false,
    defaultCount: 0,
    maxCount: 2,
    explainer: '左侧使用前/右侧使用后，对比结果最有说服力',
    recommendRule: '美妆/食品/清洁/家居品类推荐，转化率提升明显'
  },
  {
    key: 'package',
    label: '包装组合',
    emoji: '📦',
    mandatory: false,
    defaultCount: 0,
    maxCount: 2,
    explainer: '全套产品+包装+配件一起展示，送人体面、套装感强',
    recommendRule: '礼盒/套装/有配件产品推荐'
  },
  {
    key: 'beauty_report',
    label: '美妆分析报告',
    emoji: '📊',
    mandatory: false,
    defaultCount: 0,
    maxCount: 1,
    explainer: '一张信息图 = 肤质分析 + 产品推荐 + 试色，看着就很专业',
    recommendRule: '美妆护肤品类可选'
  },
  {
    key: 'transparent',
    label: '透明PNG素材',
    emoji: '🖼️',
    mandatory: false,
    defaultCount: 0,
    maxCount: 1,
    explainer: '去底透明素材，可导入 PS/Canva 自己叠加背景排版',
    recommendRule: '电商美工需要自己排版时选，普通卖家通常不用'
  },
];

/**
 * 根据输入生成智能推荐
 * @param {Object} input
 * @param {string} input.category - 品类
 * @param {string[]} input.sellingPoints - 卖点列表
 * @param {number} input.refCount - 参考图数量
 * @param {boolean} input.hasMaterial - 是否填写了材质/规格
 * @returns {Array<{key:string, count:number, reason:string}>}
 */
export function getSmartRecommendations({ category, sellingPoints = [], refCount = 0, hasMaterial = false, stylePack }) {
  const points = Array.isArray(sellingPoints) ? sellingPoints.filter(Boolean) : [];
  const pointsCount = points.length;
  const recs = [];

  // 每个风格包推荐一套完整默认图
  switch (stylePack) {
    case 'scene_selling':
      recs.push({ key: 'scene', count: 2, reason: '2 张场景图覆盖不同使用环境' });
      recs.push({ key: 'white_bg', count: 1, reason: '保留 1 张白底图作为平台首图' });
      if (pointsCount) recs.push({ key: 'detail', count: Math.min(pointsCount, 2), reason: '搭配场景的详情图，每张讲一个卖点' });
      break;
    case 'detail_selling':
      recs.push({ key: 'white_bg', count: 1, reason: '白底图作为搜索首图' });
      if (pointsCount) recs.push({ key: 'detail', count: Math.min(pointsCount, 4), reason: '每张详情图聚焦一个卖点，配中文标注' });
      else recs.push({ key: 'detail', count: 2, reason: '详情图展示产品核心卖点与细节' });
      break;
    case 'ugc_trust':
      recs.push({ key: 'scene', count: 2, reason: '真实感场景图，看起来像买家实拍' });
      recs.push({ key: 'white_bg', count: 1, reason: '留一张白底图，平台搜索需要' });
      break;
    case 'brand_unified':
      recs.push({ key: 'composite', count: 1, reason: '组合图=主图+细节+场景三合一，品牌展示核心' });
      recs.push({ key: 'white_bg', count: 1, reason: '干净的白底图保持搜索可见' });
      recs.push({ key: 'scene', count: 1, reason: '品牌调性场景图' });
      break;
    case 'promo_sale':
      recs.push({ key: 'main_text', count: 1, reason: '主图带促销文案角标，大促吸引点击' });
      if (pointsCount) recs.push({ key: 'detail', count: Math.min(pointsCount, 2), reason: '详情图标价格/折扣信息' });
      break;
    default:
      recs.push({ key: 'white_bg', count: 2, reason: '纯白底棚拍，不同角度各一张' });
      if (pointsCount) recs.push({ key: 'detail', count: Math.min(pointsCount, 1), reason: '配 1 张卖点详情图' });
      break;
  }

  return recs;
}

/**
 * 根据用户勾选的图片类型生成大纲列表
 * @param {Object} params
 * @returns {Array<{key:string, label:string, emoji:string, sellingPoint:string, cat:Object, outlineText:string}>}
 */
export function buildOutline({ productName, category, imageSelections, sellingPoints = [] }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  const points = Array.isArray(sellingPoints) ? sellingPoints.filter(Boolean) : [];
  const outline = [];

  const ROLE_LABELS = {
    white_bg: '白底图',
    main_text: '主图文案',
    feature: '卖点图',
    scene: '场景图',
    detail: '详情图',
    macro: '材质特写',
    sku: '多规格展示',
    comparison: '效果对比图',
    package: '包装组合',
    beauty_report: '美妆分析报告',
    transparent: '透明PNG素材',
  };

  for (const sel of imageSelections || []) {
    const key = sel.key;
    const count = sel.count || 1;
    const label = ROLE_LABELS[key] || key;

    for (let i = 0; i < count; i++) {
      const pointIdx = key === 'feature' ? Math.min(i, points.length - 1) : -1;
      const point = pointIdx >= 0 ? points[pointIdx] || points[0] || '' : '';

      // 生成大纲描述文本
      let outlineText = '';
      switch (key) {
        case 'white_bg':
          outlineText = `${productName} — 纯白底图，产品居中展示，无文字。`;
          break;
        case 'main_text':
          outlineText = `${productName} — 主图带促销文案/角标`;
          break;
        case 'feature':
          outlineText = point
            ? `${productName} — 卖点「${point}」。产品在左，标注${point}。`
            : `${productName} — 卖点展示图。`;
          break;
        case 'scene':
          outlineText = `${productName} — ${cat.scene_desc}。${cat.surface}。`;
          break;
        case 'detail':
          outlineText = `${productName} — 详情图，展示产品核心卖点与规格，3:4竖版。`;
          break;
        case 'macro':
          outlineText = `${productName} — 材质细节特写。${cat.detail_feature}。`;
          break;
        case 'sku':
          outlineText = `${productName} — 多色/多规格并排展示。`;
          break;
        case 'comparison':
          outlineText = `${productName} — 使用前/使用后对比。`;
          break;
        case 'package':
          outlineText = `${productName} — 全套包装+配件展示。`;
          break;
        case 'beauty_report':
          outlineText = `${productName} — 美妆分析信息图：肤质分析+产品推荐+试色。`;
          break;
        case 'transparent':
          outlineText = `${productName} — 去底透明PNG。`;
          break;
        default:
          outlineText = `${productName} — 商品图。`;
      }

      outline.push({
        key,
        instance: i + 1,
        label: count > 1 ? `${label} ${i + 1}` : label,
        emoji: IMAGE_TYPE_INFO.find(t => t.key === key)?.emoji || '🖼️',
        sellingPoint: point,
        cat,
        outlineText,
      });
    }
  }

  return outline;
}

export { STYLE_PACKS, CONVERSION_DRIVERS, CATEGORY_VISUALS, IMAGE_TYPE_INFO, PLATFORM_SIZES, PLATFORM_VISUAL_GUIDE, IMAGE_ROLES };
