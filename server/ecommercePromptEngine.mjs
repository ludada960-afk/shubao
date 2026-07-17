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
  white_bg:        { label:'白底图',      group:'主图', desc:'纯白底·无文字',        ratio:'1:1', priority:1 },
  main_text:       { label:'主图 1:1',    group:'主图', desc:'白底+促销文案',         ratio:'1:1', priority:2 },
  main_3x4:        { label:'主图 3:4',    group:'主图', desc:'多角度/场景 3:4',       ratio:'3:4', priority:3 },
  transparent:     { label:'透明PNG',     group:'素材', desc:'去底透明素材',          ratio:'1:1', priority:4 },
  sku:             { label:'SKU规格图',   group:'规格', desc:'多色/规格并排',         ratio:'1:1', priority:5 },
  detail_slice_size:    { label:'尺寸标注切片', group:'详情', desc:'引线标尺寸',     ratio:'3:4', priority:6 },
  detail_slice_scene:   { label:'场景拍摄切片', group:'详情', desc:'真实环境',       ratio:'3:4', priority:7 },
  detail_slice_qc:      { label:'质检报告切片', group:'详情', desc:'合格证/检测',     ratio:'3:4', priority:8 },
  detail_slice_compare: { label:'优势对比切片', group:'详情', desc:'vs同款差异',     ratio:'3:4', priority:9 },
  detail_slice_feature: { label:'细节功能切片', group:'详情', desc:'功能点callout',  ratio:'3:4', priority:10 },
  detail_slice_care:    { label:'保养维护切片', group:'详情', desc:'保养说明',       ratio:'3:4', priority:11 },
};

// ============================================================
// 平台尺寸映射 — 更精准
// ============================================================
const PLATFORM_SIZES = {
  '淘宝':       { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'淘宝/天猫，首图1440×1440' },
  '京东':       { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'京东，品质优先' },
  '拼多多':     { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'拼多多，可含促销文字' },
  '小红书电商': { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'小红书商城，3:4竖版' },
  '抖音电商':   { '1:1':'1440×1440px', '3:4':'1440×1920px', desc:'抖音小店，移动优先' },
  '亚马逊':     { '1:1':'1000×1000px', '3:4':'1500×2000px', desc:'Amazon，白底图不可含文字' },
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
 * 构建单张电商图提示词（精修工坊重构版）
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.category
 * @param {string} params.roleKey - white_bg/main_text/main_3x4/transparent/sku/detail_slice_*
 * @param {string[]} params.sellingPoints
 * @param {string} params.platform
 * @param {Object} [params.variant] - SKU 变体行 {color,size,capacity,dimLabel}
 * @param {string} [params.sliceNote] - 切片自定义文案
 * @param {Object} [params.campaignLock] - 主图统一 lock（可选）
 * @returns {string}
 */
export function buildECPrompt({ productName, category, roleKey, sellingPoints = [], platform = '淘宝', variant, sliceNote, campaignLock, styleSkill }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  const baseKey = roleKey.replace(/_\d+$/, '');
  const role = IMAGE_ROLES[baseKey];
  if (!role) return buildGenericPrompt(productName, category, cat);

  const platformVisual = PLATFORM_VISUAL_GUIDE[platform] || PLATFORM_VISUAL_GUIDE['淘宝'];
  const platformDesc = PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'];
  const sizeInfo = platformDesc[role.ratio] || '';
  const myPoint = sellingPoints[0] || '';
  const allPoints = sellingPoints.slice(0, 4).filter(Boolean);

  let prompt;
  switch (baseKey) {
    case 'white_bg':    prompt = buildRolePrompt('white_bg',    { productName, category, cat, platformVisual, sizeInfo }); break;
    case 'main_text':   prompt = buildRolePrompt('main_text',   { productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }); break;
    case 'main_3x4':    prompt = buildMain3x4Prompt({ productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }); break;
    case 'transparent': prompt = buildRolePrompt('transparent', { productName, category, cat, platformVisual, sizeInfo }); break;
    case 'sku':         prompt = buildSkuPrompt({ productName, category, cat, variant, platformVisual, sizeInfo }); break;
    default:
      if (baseKey.startsWith('detail_slice_')) {
        prompt = buildDetailSlicePrompt(baseKey, { productName, category, cat, myPoint, allPoints, sliceNote, platformVisual, sizeInfo });
      } else {
        prompt = buildGenericPrompt(productName, category, cat);
      }
  }

  // 主图（非白底）套用统一 lock，保证一套主图视觉一致
  if (baseKey !== 'white_bg' && (baseKey === 'main_text' || baseKey === 'main_3x4')) {
    const lock = campaignLock || getCampaignLock(styleSkill);
    const lockText = buildCampaignLockText(lock);
    if (lockText) prompt = `${lockText}\n\n${prompt}`;
  }
  // 白底图也用 style skill 的氛围（更轻量）
  if (baseKey === 'white_bg' && styleSkill) {
    const skill = STYLE_SKILLS[styleSkill];
    if (skill) {
      prompt = `${skill.name} style: ${skill.desc}. ${prompt}`;
    }
  }
  return prompt;
}

// 统一默认 Campaign Style Lock（替代旧风格包）
const DEFAULT_CAMPAIGN_LOCK = {
  visualDirection: 'Professional e-commerce product photography, clean and consistent',
  palette: ['#FFFFFF', '#333333', '#666666'],
  colorTemp: 'neutral',
  backgroundSystem: 'Pure white or clean light gradient, seamless, no texture',
  lightingSystem: 'Softbox overhead, even diffused studio lighting, soft shadows',
  layoutSystem: 'Centered composition, 60-70% product coverage, generous whitespace',
  productPresentation: '3/4 elevated angle, product as hero, sharp focus on details',
};

// ============================================================
// 多风格 Skill 包 — 5 套差异化视觉风格
// ============================================================
const STYLE_SKILLS = {
  premium_minimal: {
    name: '高级极简',
    emoji: '⬜',
    desc: '大量留白·低饱和·产品细节突出',
    campaignLock: {
      visualDirection: 'Premium minimal e-commerce photography, clean and luxurious',
      palette: ['#FFFFFF', '#F5F0EB', '#333333', '#C4A882'],
      colorTemp: 'neutral-warm',
      backgroundSystem: 'Pure white or off-white seamless, generous whitespace around product',
      lightingSystem: 'Large softbox from above-left, diffused fill right, soft gradient shadow on surface',
      layoutSystem: 'Minimal centered composition, 50% product coverage, luxury editorial whitespace',
      productPresentation: 'Hero product isolated, 3/4 elevated angle, sharp focus on silhouette and material',
    },
  },
  lifestyle_scene: {
    name: '生活场景',
    emoji: '🌿',
    desc: '真实使用环境·生活感·故事性',
    campaignLock: {
      visualDirection: 'Lifestyle/editorial photography showing product in real use context',
      palette: ['#F8F4EF', '#E8DDD3', '#8B817A', '#4A4540'],
      colorTemp: 'warm',
      backgroundSystem: 'Soft lifestyle setting — warm wood table, cozy interior corner, natural textures',
      lightingSystem: 'Natural window light from the side, warm tone, soft shadows, gentle atmosphere',
      layoutSystem: 'Contextual composition showing product in use, lifestyle arrangement, 70% product',
      productPresentation: 'Product in authentic use context with complementary objects, not isolated',
    },
  },
  fashion_editorial: {
    name: '时尚杂志',
    emoji: '✨',
    desc: '高对比·戏剧光影·杂志封面感',
    campaignLock: {
      visualDirection: 'High-fashion editorial product photography, dramatic and bold',
      palette: ['#FFFFFF', '#000000', '#C0C0C0', '#FFD700'],
      colorTemp: 'cool-neutral',
      backgroundSystem: 'Clean dramatic backdrop — dark gradient or bright minimal, strong contrast',
      lightingSystem: 'Dramatic directional key light from above, strong rim light, hard shadows for edge definition',
      layoutSystem: 'Bold centered composition, product as hero object, strong geometric framing',
      productPresentation: 'Sculptural product presentation, dramatic angle, premium magazine quality',
    },
  },
  warm_natural: {
    name: '自然暖调',
    emoji: '🌅',
    desc: '日落光感·柔和温暖·治愈感',
    campaignLock: {
      visualDirection: 'Warm natural-light product photography, cozy and inviting',
      palette: ['#FFF8F0', '#F5E6C8', '#D4A574', '#8B6914'],
      colorTemp: 'warm-golden',
      backgroundSystem: 'Warm golden-hour inspired backdrop, subtle warm gradient, honey-toned',
      lightingSystem: 'Golden-hour warm side light simulating late afternoon sun, warm fill, long soft shadows',
      layoutSystem: 'Soft composition, product in warm light, cozy arrangement, 60% product coverage',
      productPresentation: 'Product bathed in warm golden light, soft focus background, inviting atmosphere',
    },
  },
  tech_precision: {
    name: '科技精工',
    emoji: '🔬',
    desc: '冷调·锐利·高科技感·细节放大',
    campaignLock: {
      visualDirection: 'Precision tech product photography, sharp and modern',
      palette: ['#F5F5F7', '#1D1D1F', '#007AFF', '#86868B'],
      colorTemp: 'cool',
      backgroundSystem: 'Clean cool backdrop — dark charcoal or bright clean, subtle gradient, sharp edges',
      lightingSystem: 'Multiple controlled studio lights: cool key, blue rim for edge definition, minimal shadows',
      layoutSystem: 'Precision centered composition, product as tech artifact, modular grid-aligned layout',
      productPresentation: 'Product on clean pedestal, sharp detail on surfaces, technical precision aesthetic',
    },
  },
};

/**
 * 根据风格技能 key 获取 campaign lock
 * @param {string} skillKey - STYLE_SKILLS 的 key
 * @returns {Object} campaign lock
 */
function getCampaignLock(skillKey) {
  const skill = STYLE_SKILLS[skillKey];
  return skill ? skill.campaignLock : DEFAULT_CAMPAIGN_LOCK;
}

/**
 * 根据品类推荐最适合的风格技能
 * @param {string} category - 品类
 * @returns {string} 推荐的 skillKey
 */
function recommendStyleSkill(category) {
  const map = {
    '美妆护肤': 'premium_minimal',
    '数码3C': 'tech_precision',
    '食品饮料': 'warm_natural',
    '服饰穿搭': 'fashion_editorial',
    '家居生活': 'lifestyle_scene',
    '母婴用品': 'lifestyle_scene',
    '宠物用品': 'lifestyle_scene',
  };
  return map[category] || 'premium_minimal';
}

// ============================================================
// 各角色提示词构建
// ============================================================

function buildRolePrompt(roleKey, ctx) {
  const { productName, category, cat, myPoint, allPoints, platform, platformVisual, sizeInfo } = ctx;

  switch (roleKey) {
    case 'white_bg':
      return (
        'Product on pure white background #FFFFFF. ' +
        'Product: ' + productName + '. ' + cat.materials + '. ' + cat.texture + '. ' +
        'Keep product as in reference. Extract from original bg. ' +
        'No new text: no prices, no badges, no labels. ' +
        'Only product original printed text preserved. ' +
        'Style: commercial catalog. 8K. 1:1. Final: ' + sizeInfo + '.'
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

function buildMain3x4Prompt({ productName, category, cat, myPoint, allPoints, platformVisual, sizeInfo }) {
  return (
    `E-commerce vertical main image (3:4) for ${productName}. ` +
    `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `BACKGROUND: Clean studio or soft gradient from ${cat.base_colors}. ` +
    `LIGHTING: ${cat.lighting}. Studio quality. ` +
    `COMPOSITION: Product as hero, 3:4 portrait, 55-65% of frame. ` +
    `Multi-angle or lifestyle angle preferred (3/4 view, elevated, or in-scene). ` +
    `TEXT: Optional minimal Chinese promotional text in corner (max 1-2 short elements). ` +
    `CRITICAL — NO PEOPLE unless lifestyle scene requires: no faces, no hands focus. Product is hero. ` +
    `STYLE: Professional e-commerce vertical main image. Polished, mobile-first. ` +
    `ASPECT RATIO: 3:4 portrait. Final output: ${sizeInfo}. ` +
    `PLATFORM: ${platformVisual}`
  );
}

/**
 * 构建 SKU 规格并排图 prompt
 * @param {Object} p
 * @param {string} p.productName
 * @param {string} p.category
 * @param {Object} p.cat - CATEGORY_VISUALS 项
 * @param {Object} [p.variant] - 单行变体 {color,size,capacity,dimLabel}
 * @param {string} p.platformVisual
 * @param {string} p.sizeInfo
 */
function buildSkuPrompt({ productName, category, cat, variant, platformVisual, sizeInfo }) {
  // 单行：展示一个变体；多行并排由调用方循环或一次性多变体（这里按单变体出图，前端一行一张图）
  const colorName = (variant && variant.color) ? variant.color : '';
  const sizeVal = (variant && variant.size) ? variant.size : '';
  const capVal = (variant && variant.capacity) ? variant.capacity : '';
  const dimVal = (variant && variant.dimLabel) ? variant.dimLabel : '';

  const labelParts = [colorName, sizeVal, capVal].filter(Boolean);
  const labelText = labelParts.join(' · ');
  const dimLine = dimVal ? `Dimension annotation "${dimVal}" printed below or beside the product in clean sans-serif Chinese.` : '';

  return (
    `E-commerce single SKU variant showcase for ${productName}. ` +
    `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `VARIANT: This image shows ONE variant of the product. ` +
    (colorName ? `Color name: "${colorName}" — render the product in exactly this color. Do NOT invent a different color. ` : '') +
    (sizeVal ? `Size/spec: "${sizeVal}". ` : '') +
    (capVal ? `Capacity/qty: "${capVal}". ` : '') +
    `LAYOUT: Single product centered, 3/4 angle, on clean light background (${cat.background_detail}). ` +
    `LIGHTING: ${cat.lighting}. ` +
    `TEXT: Small Chinese label below product: "${labelText || productName}". Max 8 Chinese chars. Clean pill badge, high contrast. ` +
    dimLine + ' ' +
    `STYLE: Clean catalog SKU photography. Sharp focus. ` +
    `CONSTRAINTS: Product shape MUST match the reference real-shot exactly — only color differs across variants. Color name text must be accurate, no fake characters. ` +
    `ASPECT RATIO: 1:1 square. Final output: ${sizeInfo}. ` +
    `PLATFORM: ${platformVisual}`
  );
}

/**
 * 构建详情长图切片 prompt（1440 宽，≤2880 高）
 * @param {string} sliceType - detail_slice_size/scene/qc/compare/feature/care
 * @param {Object} ctx
 */
function buildDetailSlicePrompt(sliceType, { productName, category, cat, myPoint, allPoints, sliceNote, platformVisual, sizeInfo }) {
  const note = sliceNote ? ` Extra instruction from seller: "${sliceNote}".` : '';
  const base = `PRODUCT: ${productName}, ${category}. ${cat.materials}. ${cat.texture}. ` +
    `BACKGROUND: ${cat.background_detail}. LIGHTING: ${cat.lighting}. COLOR: ${cat.color_scheme}. `;

  switch (sliceType) {
    case 'detail_slice_size':
      return (
        `E-commerce detail page slice — DIMENSION ANNOTATION for ${productName}. ` +
        base +
        `LAYOUT: Product centered with leader lines (thin red arrows) pointing to edges, ` +
        `each line ends in a dimension callout in Chinese (e.g., "长 20cm", "宽 10cm", "高 5cm"). ` +
        `Use the seller-provided dimensions if given, otherwise show representative measurements. ` +
        `Top header: "${productName} 尺寸标注" in Chinese. ` +
        `STYLE: Technical infographic, clean, readable on mobile. ` +
        `CONSTRAINTS: Chinese numbers/units accurate. No fake characters. ` +
        `SIZE: 1440px wide, height ≤2880px, 3:4-ish vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_scene':
      return (
        `E-commerce detail page slice — LIFESTYLE SCENE for ${productName}. ` +
        base +
        `SCENE: ${cat.scene_desc}. Surface: ${cat.surface}. Props: 2-3 contextual items. ` +
        `COMPOSITION: Product as hero in real environment, natural arrangement. ` +
        `TEXT: NO text overlay — natural scene. ` +
        `STYLE: Professional lifestyle e-commerce photography. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_qc':
      return (
        `E-commerce detail page slice — QUALITY CHECK / INSPECTION REPORT for ${productName}. ` +
        base +
        `LAYOUT: Product on one side, a mock inspection certificate / test report card on the other. ` +
        `Card shows Chinese headers: "质检报告", "检测项目", "检测结果:合格", a mock seal/stamp. ` +
        `Top header: "${productName} 质检报告". ` +
        `STYLE: Trustworthy, official-looking infographic. ` +
        `CONSTRAINTS: Chinese text accurate, report looks credible but is clearly a mock. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_compare':
      return (
        `E-commerce detail page slice — ADVANTAGE COMPARISON for ${productName}. ` +
        base +
        `LAYOUT: Split comparison. Left: "普通款" (generic version, slightly dull). ` +
        `Right: "${productName}" (premium, well-lit). Bottom: Chinese headline highlighting ${myPoint || '优势'}. ` +
        `A checkmark/cross icon column between them. ` +
        `STYLE: Clean comparison infographic, convincing. ` +
        `CONSTRAINTS: Chinese labels accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_feature':
      return (
        `E-commerce detail page slice — FEATURE / FUNCTION CALLOUT for ${productName}. ` +
        base +
        `LAYOUT: Product on left (55%), 3-4 feature callout pills on right with thin connector lines to product parts. ` +
        `Each callout: short Chinese label (max 8 chars) + 1 line description. ` +
        `Features: ${(allPoints && allPoints.length > 0) ? allPoints.join(' / ') : '核心功能点'}. ` +
        `Top header: "${productName} 细节功能". ` +
        `STYLE: Infographic, premium, readable. ` +
        `CONSTRAINTS: Chinese text accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
      );
    case 'detail_slice_care':
      return (
        `E-commerce detail page slice — MAINTENANCE / CARE GUIDE for ${productName}. ` +
        base +
        `LAYOUT: Product on top, 3-4 care instruction icons + Chinese text below ` +
        `(e.g., "避免暴晒", "温水手洗", "存放干燥处"). ` +
        `Use the seller-provided care note if given. ` +
        `Top header: "${productName} 保养维护". ` +
        `STYLE: Friendly, clear, icon-driven infographic. ` +
        `CONSTRAINTS: Chinese text accurate. ` +
        `SIZE: 1440px wide, height ≤2880px vertical slice. Final: ${sizeInfo}. ` +
        `PLATFORM: ${platformVisual}${note}`
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

// ============================================================
// v3 新功能: 智能推荐 + 大纲生成
// ============================================================

/**
 * 图片角色定义 — 用户端可见的信息（含推荐规则）
 */
const IMAGE_TYPE_INFO = [
  { key:'white_bg',    label:'白底图',     emoji:'⬜', mandatory:true,  defaultCount:1, maxCount:5, explainer:'纯白底产品居中，无文字无水印。平台首图硬性要求。', recommendRule:'必选至少1张' },
  { key:'main_text',   label:'主图 1:1',   emoji:'🖼️', mandatory:false, defaultCount:5, maxCount:5, explainer:'白底1张 + 卖点4张，1440×1440。', recommendRule:'默认5张' },
  { key:'main_3x4',    label:'主图 3:4',   emoji:'📱', mandatory:false, defaultCount:5, maxCount:5, explainer:'多角度/场景，1440×1920竖版。', recommendRule:'默认5张' },
  { key:'transparent', label:'PNG透明图',  emoji:'🎯', mandatory:false, defaultCount:1, maxCount:1, explainer:'去底透明素材，可导入PS/Canva。', recommendRule:'默认1张' },
  { key:'sku',         label:'SKU规格图',  emoji:'🎨', mandatory:false, defaultCount:0, maxCount:20, explainer:'按用户填的变体行生成并排图。', recommendRule:'用户定义数量' },
  { key:'detail_slice_size',    label:'尺寸标注切片', emoji:'📏', mandatory:false, defaultCount:0, maxCount:1, explainer:'引线标尺寸的详情切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_scene',   label:'场景拍摄切片', emoji:'🌄', mandatory:false, defaultCount:0, maxCount:1, explainer:'产品在真实环境切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_qc',      label:'质检报告切片', emoji:'✅', mandatory:false, defaultCount:0, maxCount:1, explainer:'合格证/检测信息切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_compare', label:'优势对比切片', emoji:'↔️', mandatory:false, defaultCount:0, maxCount:1, explainer:'vs同款差异切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_feature', label:'细节功能切片', emoji:'🔍', mandatory:false, defaultCount:0, maxCount:1, explainer:'功能点callout切片。', recommendRule:'勾选生成' },
  { key:'detail_slice_care',    label:'保养维护切片', emoji:'🧴', mandatory:false, defaultCount:0, maxCount:1, explainer:'保养说明切片。', recommendRule:'勾选生成' },
];

/**
 * 根据用户勾选/配置生成大纲列表
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.category
 * @param {Array<{key:string,count?:number,variant?:Object,sliceNote?:string}>} params.imageSelections
 * @param {string[]} params.sellingPoints
 * @param {Array<Object} [params.skus] - SKU 变体行 [{color,size,capacity,dimLabel}]
 * @param {Object} [params.detailPlan] - {sizeAnnot,scene,qc,compare,feature,notes}
 * @param {string} [params.maintenance]
 * @returns {Array<{key,instance,label,emoji,sellingPoint,outlineText,variant,sliceNote}>}
 */
export function buildOutline({ productName, category, imageSelections, sellingPoints = [], skus = [], detailPlan, maintenance }) {
  const cat = CATEGORY_VISUALS[category] || CATEGORY_VISUALS['其他'];
  const points = Array.isArray(sellingPoints) ? sellingPoints.filter(Boolean) : [];
  const outline = [];

  const LABELS = {
    white_bg:'白底图', main_text:'主图 1:1', main_3x4:'主图 3:4',
    transparent:'PNG透明图', sku:'SKU规格图',
    detail_slice_size:'尺寸标注切片', detail_slice_scene:'场景拍摄切片',
    detail_slice_qc:'质检报告切片', detail_slice_compare:'优势对比切片',
    detail_slice_feature:'细节功能切片', detail_slice_care:'保养维护切片',
  };

  const textFor = (key, i, sel) => {
    switch (key) {
      case 'white_bg':    return `${productName} — 纯白底图，产品居中，无文字。`;
      case 'main_text':   return `${productName} — 主图1:1 ${i+1}，白底+卖点${points[i]||''}。`;
      case 'main_3x4':    return `${productName} — 主图3:4 ${i+1}，多角度/场景。`;
      case 'transparent': return `${productName} — 去底透明PNG。`;
      case 'sku': {
        const v = sel.variant || {};
        return `${productName} — SKU：${[v.color,v.size,v.capacity].filter(Boolean).join(' · ')||'变体'}${v.dimLabel?' '+v.dimLabel:''}。`;
      }
      case 'detail_slice_size':    return `${productName} — 尺寸标注切片。${sel.sliceNote||''}`;
      case 'detail_slice_scene':   return `${productName} — 场景拍摄切片。${sel.sliceNote||''}`;
      case 'detail_slice_qc':      return `${productName} — 质检报告切片。${sel.sliceNote||''}`;
      case 'detail_slice_compare': return `${productName} — 优势对比切片。${sel.sliceNote||''}`;
      case 'detail_slice_feature': return `${productName} — 细节功能切片。${sel.sliceNote||''}`;
      case 'detail_slice_care':    return `${productName} — 保养维护切片。${maintenance||''}`;
      default: return `${productName} — 商品图。`;
    }
  };

  for (const sel of imageSelections || []) {
    const key = sel.key;
    const count = sel.count || 1;
    const label = LABELS[key] || key;

    if (key === 'sku' && skus && skus.length > 0) {
      // SKU 按 skus 行展开，忽略 count
      skus.forEach((variant, i) => {
        outline.push({
          key, instance: i + 1, label: `SKU ${i+1}`, variant,
          emoji: IMAGE_TYPE_INFO.find(t => t.key === key)?.emoji || '🎨',
          sellingPoint: '', cat, outlineText: textFor(key, i, { variant }),
        });
      });
      continue;
    }

    for (let i = 0; i < count; i++) {
      outline.push({
        key, instance: i + 1, label: count > 1 ? `${label} ${i+1}` : label,
        emoji: IMAGE_TYPE_INFO.find(t => t.key === key)?.emoji || '🖼️',
        sellingPoint: key === 'main_text' ? (points[i] || '') : '',
        cat, outlineText: textFor(key, i, sel), sliceNote: sel.sliceNote || '',
      });
    }
  }

  return outline;
}

export {
  CATEGORY_VISUALS, IMAGE_TYPE_INFO, PLATFORM_SIZES, PLATFORM_VISUAL_GUIDE, IMAGE_ROLES,
  STYLE_SKILLS, getCampaignLock, recommendStyleSkill,
};
