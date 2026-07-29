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
      assetPlan: {
        detailRoles: ['feature', 'texture', 'shade', 'usage', 'package', 'applicator', 'closure', 'label', 'scale', 'finish'],
        buyingQuestions: ['What product form should the buyer recognize?', 'What visible product texture can be inspected?', 'Which user-confirmed shade or variant is shown?', 'How is the product handled or applied using visible evidence?', 'What packaging form should remain accurate?', 'Which visible applicator or dispenser detail helps use?', 'How does the visible cap, pump, or closure operate?', 'Which protected label and model text must remain legible?', 'What user-confirmed package size helps the buyer judge scale?', 'Which visible surface finish distinguishes the package?'],
      },
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
      assetPlan: {
        detailRoles: ['feature', 'parameters', 'structure', 'compatibility', 'usage', 'controls', 'ports', 'finish', 'scale', 'identifier'],
        buyingQuestions: ['Which evidence-supported feature matters most?', 'Which user-confirmed parameters apply?', 'What visible exterior structure must stay accurate?', 'Which confirmed compatibility information is available?', 'How is the product used without inventing an interaction?', 'Which visible controls help the buyer operate it?', 'Which visible connection points or ports help the buyer decide?', 'Which visible material and surface finish can be inspected?', 'What confirmed dimensions help the buyer judge scale and placement?', 'Which protected model or product identifier must remain accurate?'],
      },
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
      assetPlan: {
        detailRoles: ['package', 'flavor', 'texture', 'serving', 'scene', 'label', 'seal', 'quantity', 'form', 'opening'],
        buyingQuestions: ['What package format should the buyer recognize?', 'Which user-confirmed flavor or variant is shown?', 'What visible food or package texture can be inspected?', 'How can the product be served without unsupported claims?', 'Which credible serving scene fits the product?', 'Which protected package text must remain legible?', 'Which visible closure or seal detail helps package inspection?', 'What user-confirmed net quantity or count helps the buyer decide?', 'What visible product form or portion format is shown?', 'How does the visible package opening or dispensing format work?'],
        proofRole: 'qc',
      },
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
      assetPlan: {
        detailRoles: ['silhouette', 'material', 'fit', 'detail', 'scene', 'color_variant', 'hardware', 'drape', 'length', 'care'],
        buyingQuestions: ['What complete silhouette should the buyer understand?', 'What visible material can be inspected?', 'Which user-confirmed fit information applies?', 'Which visible construction detail matters?', 'How does the item look in a credible wearing context?', 'Which user-confirmed color or variant is shown?', 'Which visible fastener or hardware detail helps the buyer decide?', 'How does the visible fabric drape or hold its shape?', 'Which user-confirmed length or proportion helps fit judgment?', 'Which user-confirmed care information is available?'],
      },
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
      assetPlan: {
        detailRoles: ['scale', 'material', 'craft', 'scene', 'feature', 'footprint', 'storage', 'interaction', 'care', 'finish'],
        buyingQuestions: ['What overall scale should the buyer understand?', 'Which visible material can be inspected?', 'Which visible craft or joinery detail matters?', 'How does the product fit a credible room context?', 'Which evidence-supported feature answers a buying question?', 'What confirmed footprint or clearance helps placement planning?', 'Which visible storage or organization area can be understood?', 'Which visible handle, opening, or access point explains interaction?', 'Which user-confirmed cleaning or care information is available?', 'Which visible surface finish helps the buyer compare quality?'],
      },
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
      assetPlan: {
        detailRoles: ['feature', 'material', 'scale', 'scene', 'care', 'edges', 'grip', 'closure', 'fit', 'label'],
        buyingQuestions: ['Which evidence-supported feature matters?', 'Which visible material is shown?', 'What user-confirmed scale applies?', 'How is the product used in a credible family context?', 'Which care information is user-confirmed?', 'Which visible edge and exterior geometry can be inspected without unsupported claims?', 'Which visible grip or handling point helps a caregiver use it?', 'Which visible closure or fastener explains access?', 'Which user-confirmed age, size, or fit information applies?', 'Which protected package or model label must remain accurate?'],
      },
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
      assetPlan: {
        detailRoles: ['feature', 'material', 'scale', 'scene', 'detail', 'closure', 'base_grip', 'care', 'fit', 'portability'],
        buyingQuestions: ['Which evidence-supported feature matters?', 'Which visible material can be inspected?', 'What user-confirmed scale applies?', 'How is the product used in a credible pet context?', 'Which visible construction detail matters?', 'Which visible clip, closure, or attachment point helps use?', 'Which visible base or grip detail explains placement stability without making a safety claim?', 'Which user-confirmed cleaning or care information is available?', 'Which user-confirmed pet size or compatibility information applies?', 'Which visible carrying or storage feature helps portability?'],
      },
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
      assetPlan: {
        detailRoles: ['feature', 'material', 'scale', 'usage', 'detail', 'identity', 'controls', 'finish', 'label', 'care'],
        buyingQuestions: ['Which evidence-supported feature matters?', 'Which visible material can be inspected?', 'What user-confirmed scale applies?', 'How is the product used without inventing an interaction?', 'Which visible construction detail matters?', 'What complete product form should the buyer recognize?', 'Which visible control, handle, or access point helps use?', 'Which visible surface finish helps quality comparison?', 'Which protected package, model, or product label must remain accurate?', 'Which user-confirmed care information is available?'],
      },
    },
  },
};

const CATEGORY_ALIASES = Object.freeze({
  '3c': '数码3C',
  '3c数码': '数码3C',
  '数码': '数码3C',
  '数码家电': '数码3C',
  '美妆个护': '美妆护肤',
  '食品': '食品饮料',
  food: '食品饮料',
  '服饰鞋包': '服饰穿搭',
  '服饰': '服饰穿搭',
  '家居日用': '家居生活',
  '家居': '家居生活',
  '母婴': '母婴用品',
  '宠物': '宠物用品',
});

export function normalizeEcommerceCategory(category) {
  const value = typeof category === 'string' ? category.trim() : '';
  if (!value) return '其他';
  if (Object.hasOwn(CATEGORY_KNOWLEDGE, value)) return value;
  return CATEGORY_ALIASES[value.toLowerCase()] || '其他';
}

/** 获取某品类的视觉信息 */
export function getCategoryInfo(category) {
  return CATEGORY_KNOWLEDGE[normalizeEcommerceCategory(category)];
}

/** 获取所有品类名 */
export function getCategoryList() {
  return Object.keys(CATEGORY_KNOWLEDGE);
}

/** 获取推荐出图策略 */
export function getGenStrategy(category) {
  return CATEGORY_KNOWLEDGE[normalizeEcommerceCategory(category)].genStrategy;
}

/** 获取动态资产规划策略（保留旧版 genStrategy 导出不变） */
export function getAssetPlanStrategy(category) {
  return getGenStrategy(category).assetPlan || CATEGORY_KNOWLEDGE['其他'].genStrategy.assetPlan;
}

/** 构建品类视觉描述文字 (与旧版兼容) */
export function buildCategoryDescription(category) {
  const cat = CATEGORY_KNOWLEDGE[normalizeEcommerceCategory(category)];
  return [
    `PRODUCT TYPE: ${cat.name} — ${cat.description}.`,
    `MATERIALS: ${cat.materials}.`,
    `TEXTURE: ${cat.texture}.`,
    `LIGHTING: ${cat.lighting}.`,
    `SCENE: ${cat.sceneDesc}. Surface: ${cat.surface}. Detail: ${cat.detailFeature}.`,
    `COLORS: Base ${cat.baseColors}. Accent ${cat.accentColors}. Scheme: ${cat.colorScheme}.`,
  ].join('\n');
}
