/**
 * 薯包AI v4 品类视觉知识库 (扩展版)
 *
 * 比 ecommercePromptEngine.mjs 的 CATEGORY_VISUALS 更丰富
 * 增加了：品类描述、典型应用场景、推荐风格、出图策略
 */

export const CATEGORY_KNOWLEDGE = {
  '美妆护肤': {
    name: '美妆护肤',
    description: '护肤品、化妆品、美容仪器',
    visualStyle: 'premium_minimal',
    recommendedSkills: ['premium_minimal', 'fashion_editorial', 'warm_natural'],
    materials: 'Frosted glass bottle, metallic cap, glossy label, smooth matte finish',
    texture: 'Smooth matte finish with soft glow, frosted glass texture, premium paper label',
    lighting: 'Soft beauty key light + fill 2:1 + backlight for product silhouette',
    sceneDesc: 'Elegant bathroom vanity with white marble countertop',
    surface: 'White Carrara marble with subtle veining',
    detailFeature: 'Premium bottle cap with brand engraving',
    baseColors: 'Warm white, soft beige, rose gold',
    accentColors: 'Rose gold, soft pink, pearl',
    colorScheme: 'Rose gold + soft pink + pure white — warm luxurious',
    backgroundDetail: 'Soft gradient from pure white to pale pink',
    lightingDetail: 'Macro beauty ring light, even diffused illumination',
    // 出图策略
    genStrategy: {
      preferWhiteBg: true,
      preferScene: true,
      detailSlices: ['size', 'scene', 'feature'],
      mainTextStyle: 'beauty promotional with elegance',
      showSKU: true,
    },
  },
  '数码3C': {
    name: '数码3C',
    description: '手机配件、耳机、智能设备、电子产品',
    visualStyle: 'tech_precision',
    recommendedSkills: ['tech_precision', 'premium_minimal', 'fashion_editorial'],
    materials: 'Brushed metal alloy, tempered glass, matte black finish, silicone grips',
    texture: 'Brushed metal, precision edges, anti-fingerprint coating, hairline finish',
    lighting: 'Dramatic studio light + cool rim light for metallic edges',
    sceneDesc: 'Clean modern desk workspace with ambient lighting',
    surface: 'Light oak wood desk with subtle grain',
    detailFeature: 'Port/button details with precision machining',
    baseColors: 'Matte black, warm wood, clean white',
    accentColors: 'Electric blue, cool silver',
    colorScheme: 'Charcoal black + cool silver + electric blue accent — tech premium',
    backgroundDetail: 'Dark gradient from charcoal to pure black',
    lightingDetail: 'Edge rim light + soft ambient studio + subtle LED glow',
    genStrategy: {
      preferWhiteBg: false,
      preferScene: true,
      detailSlices: ['feature', 'size', 'compare'],
      mainTextStyle: 'tech spec promotional',
      showSKU: true,
    },
  },
  '食品饮料': {
    name: '食品饮料',
    description: '零食、饮品、调味品、健康食品',
    visualStyle: 'warm_natural',
    recommendedSkills: ['warm_natural', 'lifestyle_scene', 'premium_minimal'],
    materials: 'Glass bottle/can, paper/cardboard label, sealed cap, natural ingredients',
    texture: 'Smooth cool glass, paper label texture, authentic ingredient visibility',
    lighting: 'Golden hour warm light + soft food photography fill',
    sceneDesc: 'Rustic wooden table or natural outdoor setting with fresh ingredients',
    surface: 'Weathered wood tabletop with natural grain',
    detailFeature: 'Packaging seal and product freshness indicator',
    baseColors: 'Warm cream, olive green, natural wood',
    accentColors: 'Deep red, amber, fresh green',
    colorScheme: 'Warm cream + olive green + amber — natural appetizing',
    backgroundDetail: 'Warm gradient from cream to warm white',
    lightingDetail: 'Soft food photography lighting from upper-left window',
    genStrategy: {
      preferWhiteBg: false,
      preferScene: true,
      detailSlices: ['scene', 'feature', 'qc'],
      mainTextStyle: 'appetizing text with flavor highlights',
      showSKU: false,
    },
  },
  '服饰穿搭': {
    name: '服饰穿搭',
    description: '服装、鞋帽、配饰、包包',
    visualStyle: 'fashion_editorial',
    recommendedSkills: ['fashion_editorial', 'lifestyle_scene', 'warm_natural'],
    materials: 'Cotton/linen/silk fabric, metal zipper/buttons, leather/fabric tags',
    texture: 'Fabric weave texture, soft drape, natural fiber detail, stitch precision',
    lighting: 'Soft window light + gentle fill, fashion editorial style',
    sceneDesc: 'Minimalist interior or clean urban background',
    surface: 'Clean floor or flat lay surface',
    detailFeature: 'Fabric weave and texture detail close-up',
    baseColors: 'Warm beige, cream, charcoal',
    accentColors: 'Season fashion color, metallic hardware',
    colorScheme: 'Cream + charcoal + seasonal accent — editorial fashion',
    backgroundDetail: 'Soft gray gradient to warm beige',
    lightingDetail: 'Soft fashion window light + subtle rim',
    genStrategy: {
      preferWhiteBg: true,
      preferScene: true,
      detailSlices: ['feature', 'size', 'care'],
      mainTextStyle: 'fashion editorial with style tags',
      showSKU: true,
    },
  },
  '家居生活': {
    name: '家居生活',
    description: '家具、厨具、日用品、收纳、装饰品',
    visualStyle: 'lifestyle_scene',
    recommendedSkills: ['lifestyle_scene', 'warm_natural', 'premium_minimal'],
    materials: 'Porcelain/ceramic, natural wood, cotton/linen, metal accents',
    texture: 'Natural grain, glazed finish, woven fabric, brushed metal',
    lighting: 'Natural daylight + warm accent lamp, cozy ambience',
    sceneDesc: 'Cozy living room or bedroom corner with warm decor',
    surface: 'Coffee table, shelf, or bedside table with linen runner',
    detailFeature: 'Material grain and craftsmanship detail',
    baseColors: 'Warm beige, soft gray, cream',
    accentColors: 'Sage green, terracotta, warm brown',
    colorScheme: 'Warm beige + sage green + terracotta — cozy Nordic',
    backgroundDetail: 'Soft texture wall, warm earthy tones',
    lightingDetail: 'Natural window light + warm table lamp glow',
    genStrategy: {
      preferWhiteBg: true,
      preferScene: true,
      detailSlices: ['scene', 'size', 'feature'],
      mainTextStyle: 'lifestyle promotional with space aesthetics',
      showSKU: false,
    },
  },
  '母婴用品': {
    name: '母婴用品',
    description: '婴儿用品、孕妇用品、儿童玩具',
    visualStyle: 'lifestyle_scene',
    recommendedSkills: ['lifestyle_scene', 'warm_natural', 'premium_minimal'],
    materials: 'BPA-free smooth plastic, soft silicone, gentle fabric, rounded edges',
    texture: 'Soft-touch matte surface, smooth polished edges, gentle fabric',
    lighting: 'Very soft, diffuse warm light — safe, gentle atmosphere',
    sceneDesc: 'Soft, calm nursery or clean family interior',
    surface: 'Soft rug or clean changing table surface',
    detailFeature: 'Safety edge and smooth surface detail',
    baseColors: 'Soft mint, lavender, peach',
    accentColors: 'Pure white, warm cream',
    colorScheme: 'Pastel mint + lavender + cream — gentle safe',
    backgroundDetail: 'Pastel gradient — pale mint to cream',
    lightingDetail: 'Diffuse nursery window light, soft and even',
    genStrategy: {
      preferWhiteBg: true,
      preferScene: true,
      detailSlices: ['qc', 'scene', 'feature'],
      mainTextStyle: 'gentle parenting tone',
      showSKU: false,
    },
  },
  '宠物用品': {
    name: '宠物用品',
    description: '宠物食品、用品、玩具、护理产品',
    visualStyle: 'lifestyle_scene',
    recommendedSkills: ['lifestyle_scene', 'warm_natural', 'premium_minimal'],
    materials: 'Durable nylon/polyester, rubber base, soft foam, metal hardware',
    texture: 'Durable woven fabric, rubber grip texture, smooth plastic, foam padding',
    lighting: 'Warm natural light + playful bright accent',
    sceneDesc: 'Cozy home corner or clean outdoor grass/park setting',
    surface: 'Floor, pet bed surface, or clean grass',
    detailFeature: 'Material durability and stitch reinforcement',
    baseColors: 'Warm neutrals, soft greens',
    accentColors: 'Brand signature color, bright blue/red',
    colorScheme: 'Warm tan + sage green + brand accent — active pet lifestyle',
    backgroundDetail: 'Soft warm neutral, subtle green tint',
    lightingDetail: 'Natural window light, bright and playful',
    genStrategy: {
      preferWhiteBg: true,
      preferScene: true,
      detailSlices: ['scene', 'feature'],
      mainTextStyle: 'playful pet-friendly tone',
      showSKU: true,
    },
  },
  '其他': {
    name: '其他',
    description: '未分类商品',
    visualStyle: 'premium_minimal',
    recommendedSkills: ['premium_minimal', 'lifestyle_scene', 'warm_natural'],
    materials: 'Premium quality materials, clean finish, professional appearance',
    texture: 'High-quality surface texture, refined finish',
    lighting: 'Professional studio lighting — soft key + rim + fill',
    sceneDesc: 'Clean professional setting appropriate for product type',
    surface: 'Clean neutral surface',
    detailFeature: 'Product quality detail',
    baseColors: 'Clean white, soft gray, neutral',
    accentColors: 'Professional brand tone',
    colorScheme: 'White + soft gray + brand accent — clean professional',
    backgroundDetail: 'Clean neutral gradient',
    lightingDetail: 'Professional studio — soft key + rim + fill',
    genStrategy: {
      preferWhiteBg: true,
      preferScene: false,
      detailSlices: ['size', 'feature'],
      mainTextStyle: 'clean generic promotional',
      showSKU: false,
    },
  },
};

/** 获取某品类的视觉信息 */
export function getCategoryInfo(category) {
  return CATEGORY_KNOWLEDGE[category] || CATEGORY_KNOWLEDGE['其他'];
}

/** 获取所有品类名 */
export function getCategoryList() {
  return Object.keys(CATEGORY_KNOWLEDGE);
}

/** 获取推荐出图策略 */
export function getGenStrategy(category) {
  return (CATEGORY_KNOWLEDGE[category] || CATEGORY_KNOWLEDGE['其他']).genStrategy;
}

/** 构建品类视觉描述文字 (与旧版兼容) */
export function buildCategoryDescription(category) {
  const cat = CATEGORY_KNOWLEDGE[category] || CATEGORY_KNOWLEDGE['其他'];
  return [
    `PRODUCT TYPE: ${cat.name} — ${cat.description}.`,
    `MATERIALS: ${cat.materials}.`,
    `TEXTURE: ${cat.texture}.`,
    `LIGHTING: ${cat.lighting}.`,
    `SCENE: ${cat.sceneDesc}. Surface: ${cat.surface}. Detail: ${cat.detailFeature}.`,
    `COLORS: Base ${cat.baseColors}. Accent ${cat.accentColors}. Scheme: ${cat.colorScheme}.`,
  ].join('\n');
}
