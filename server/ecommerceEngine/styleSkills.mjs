/**
 * 薯包AI v4 Style Skill 包完整定义
 *
 * 每个 Skill 包不仅是 "campaignLock"，而是完整视觉系统定义：
 *   - 视觉一致性锁 (已实现)
 *   - 光照系统参数
 *   - 色彩系统参数
 *   - 构图规则
 *   - 品类增强偏好
 *   - 各图片类型的个性化 override
 */

// ============================================================
// 五套完整 Style Skill 定义
// ============================================================

const STYLE_SKILL_DEFS = {
  premium_minimal: {
    key: 'premium_minimal',
    name: '高级极简',
    emoji: '⬜',
    desc: '大量留白·低饱和·产品细节突出',
    categoryBoost: ['美妆护肤', '珠宝配饰', '家居日用', '图书文具'],
    campaignLock: {
      visualDirection: 'Premium minimal e-commerce photography, clean and luxurious',
      palette: ['#FFFFFF', '#F5F0EB', '#333333', '#C4A882'],
      colorTemp: 'neutral-warm',
      backgroundSystem: 'Pure white or off-white seamless, generous whitespace around product',
      lightingSystem: 'Large softbox from above-left, diffused fill right, soft gradient shadow on surface',
      layoutSystem: 'Minimal centered composition, 50% product coverage, luxury editorial whitespace',
      productPresentation: 'Hero product isolated, 3/4 elevated angle, sharp focus on silhouette and material',
    },
    lightingSystem: {
      type: 'softbox_diffuse',
      keyLight: 'above-left 45° large softbox',
      fillLight: 'right side white reflector',
      rimLight: 'back-edge cool LED strip',
      shadowType: 'soft gradient ground shadow',
      colorTemp: 'neutral-warm ~5200K',
    },
    colorSystem: {
      palette: ['#FFFFFF', '#F5F0EB', '#333333', '#C4A882'],
      saturation: 'desaturated -20%',
      contrast: 'medium-soft',
      treatment: 'editorial minimal',
    },
    compositionRules: {
      productCoverage: '50%',
      positioning: 'centered',
      anglePreference: '3/4 elevated',
      whitespace: 'generous',
      depth: 'shallow depth of field',
    },
    roleOverrides: {
      white_bg: { bg: 'pure white #FFFFFF', coverage: '60-70%', shadow: 'soft visible ground shadow' },
      main_3x4: { coverage: '55%', angle: 'elevated 3/4, subtle lifestyle hint' },
      transparent: { shadow: 'soft ground shadow for compositing', edge: 'clean precise cutout' },
      detail_slice_size: { style: 'minimal technical drawing overlay' },
      detail_slice_feature: { style: 'clean product on left, callout pills on right' },
    },
  },

  lifestyle_scene: {
    key: 'lifestyle_scene',
    name: '生活场景',
    emoji: '🌿',
    desc: '真实使用环境·生活感·故事性',
    categoryBoost: ['家居生活', '母婴用品', '宠物用品', '食品饮料'],
    campaignLock: {
      visualDirection: 'Lifestyle/editorial photography showing product in real use context',
      palette: ['#F8F4EF', '#E8DDD3', '#8B817A', '#4A4540'],
      colorTemp: 'warm',
      backgroundSystem: 'Soft lifestyle setting — warm wood table, cozy interior corner, natural textures',
      lightingSystem: 'Natural window light from the side, warm tone, soft shadows, gentle atmosphere',
      layoutSystem: 'Contextual composition showing product in use, lifestyle arrangement, 70% product',
      productPresentation: 'Product in authentic use context with complementary objects, not isolated',
    },
    lightingSystem: {
      type: 'natural_window',
      keyLight: 'large side window natural light',
      fillLight: 'warm interior ambient fill',
      rimLight: 'subtle warm back-edge from interior lights',
      shadowType: 'soft diffused natural shadows',
      colorTemp: 'warm ~4500K',
    },
    colorSystem: {
      palette: ['#F8F4EF', '#E8DDD3', '#8B817A', '#4A4540'],
      saturation: 'natural',
      contrast: 'soft',
      treatment: 'warm editorial lifestyle',
    },
    compositionRules: {
      productCoverage: '70%',
      positioning: 'contextual with props',
      anglePreference: 'eye-level lifestyle',
      whitespace: 'balanced with scene elements',
      depth: 'medium depth with blurred background',
    },
    roleOverrides: {
      white_bg: { lighting: 'softer, preserve natural feel', bg: 'warm off-white #F8F4EF' },
      main_3x4: { style: 'lifestyle scene in 3:4 portrait', coverage: '65%' },
      transparent: { shadow: 'warm tinted ground shadow' },
    },
  },

  fashion_editorial: {
    key: 'fashion_editorial',
    name: '时尚杂志',
    emoji: '✨',
    desc: '高对比·戏剧光影·杂志封面感',
    categoryBoost: ['服饰穿搭', '珠宝配饰', '美妆护肤'],
    campaignLock: {
      visualDirection: 'High-fashion editorial product photography, dramatic and bold',
      palette: ['#FFFFFF', '#000000', '#C0C0C0', '#FFD700'],
      colorTemp: 'cool-neutral',
      backgroundSystem: 'Clean dramatic backdrop — dark gradient or bright minimal, strong contrast',
      lightingSystem: 'Dramatic directional key light from above, strong rim light, hard shadows for edge definition',
      layoutSystem: 'Bold centered composition, product as hero object, strong geometric framing',
      productPresentation: 'Sculptural product presentation, dramatic angle, premium magazine quality',
    },
    lightingSystem: {
      type: 'editorial_dramatic',
      keyLight: 'single strong source from above-right',
      fillLight: 'minimal black fill for contrast',
      rimLight: 'strong cool rim from back-side',
      shadowType: 'hard defined shadows with clean edge',
      colorTemp: 'cool ~6000K',
    },
    colorSystem: {
      palette: ['#FFFFFF', '#000000', '#C0C0C0', '#FFD700'],
      saturation: 'vibrant selective',
      contrast: 'high',
      treatment: 'editorial magazine',
    },
    compositionRules: {
      productCoverage: '60%',
      positioning: 'bold centered',
      anglePreference: 'dramatic low or high angle',
      whitespace: 'minimal, high-impact',
      depth: 'flat magazine style',
    },
    roleOverrides: {
      white_bg: { bg: 'pure white #FFFFFF with subtle shadow gradient' },
      main_text: { text: 'magazine cover style headline typography' },
      main_3x4: { style: 'editorial portrait orientation', coverage: '55%' },
      detail_slice: { style: 'editorial grid layout with magazine aesthetic' },
    },
  },

  warm_natural: {
    key: 'warm_natural',
    name: '自然暖调',
    emoji: '🌅',
    desc: '日落光感·柔和温暖·治愈感',
    categoryBoost: ['食品饮料', '家居生活', '母婴用品', '宠物用品'],
    campaignLock: {
      visualDirection: 'Warm natural-light product photography, cozy and inviting',
      palette: ['#FFF8F0', '#F5E6C8', '#D4A574', '#8B6914'],
      colorTemp: 'warm-golden',
      backgroundSystem: 'Warm golden-hour inspired backdrop, subtle warm gradient, honey-toned',
      lightingSystem: 'Golden-hour warm side light simulating late afternoon sun, warm fill, long soft shadows',
      layoutSystem: 'Soft composition, product in warm light, cozy arrangement, 60% product coverage',
      productPresentation: 'Product bathed in warm golden light, soft focus background, inviting atmosphere',
    },
    lightingSystem: {
      keyLight: 'golden hour simulated from lower-left',
      type: 'golden_hour',
      fillLight: 'warm ambient bounce',
      rimLight: 'golden back-edge sunlight',
      shadowType: 'long soft warm shadows',
      colorTemp: 'warm ~3500K',
    },
    colorSystem: {
      palette: ['#FFF8F0', '#F5E6C8', '#D4A574', '#8B6914'],
      saturation: 'warm natural',
      contrast: 'soft warm',
      treatment: 'cozy documentary',
    },
    compositionRules: {
      productCoverage: '60%',
      positioning: 'soft center with ambient space',
      anglePreference: 'warm eye-level',
      whitespace: 'generous with warm negative space',
      depth: 'soft dreamy focus',
    },
    roleOverrides: {
      white_bg: { bg: 'warm cream #FFFEF8', lighting: 'softer warm tone' },
      main_3x4: { temperature: 'extra warm', coverage: '55%' },
      transparent: { shadow: 'warm golden tinted ground shadow' },
      detail_slice_scene: { mood: 'golden hour lifestyle', props: 'warm coffee, natural materials' },
    },
  },

  tech_precision: {
    key: 'tech_precision',
    name: '科技精工',
    emoji: '🔬',
    desc: '冷调·锐利·高科技感·细节放大',
    categoryBoost: ['数码3C', '汽车用品', '运动户外'],
    campaignLock: {
      visualDirection: 'Precision tech product photography, sharp and modern',
      palette: ['#F5F5F7', '#1D1D1F', '#007AFF', '#86868B'],
      colorTemp: 'cool',
      backgroundSystem: 'Clean cool backdrop — dark charcoal or bright clean, subtle gradient, sharp edges',
      lightingSystem: 'Multiple controlled studio lights: cool key, blue rim for edge definition, minimal shadows',
      layoutSystem: 'Precision centered composition, product as tech artifact, modular grid-aligned layout',
      productPresentation: 'Product on clean pedestal, sharp detail on surfaces, technical precision aesthetic',
    },
    lightingSystem: {
      type: 'multi_studio_precision',
      keyLight: 'cool studio key from above-center',
      fillLight: 'shadowless fill from both sides',
      rimLight: 'cool blue rim for edge definition',
      shadowType: 'minimal, near-shadowless',
      colorTemp: 'cool ~6500K',
    },
    colorSystem: {
      palette: ['#F5F5F7', '#1D1D1F', '#007AFF', '#86868B'],
      saturation: 'accurate neutral',
      contrast: 'crisp',
      treatment: 'product catalog precision',
    },
    compositionRules: {
      productCoverage: '65%',
      positioning: 'exact centered',
      anglePreference: 'straight-on and isometric',
      whitespace: 'clean grid-aligned',
      depth: 'hyper-sharp edge to edge',
    },
    roleOverrides: {
      white_bg: { bg: '#F5F5F7 subtle cool gradient', sharpness: 'maximum' },
      main_text: { text: 'minimal tech sans-serif', color: '#1D1D1F on white' },
      main_3x4: { style: 'tech portrait', backdrop: 'dark gradient #1D1D1F' },
      transparent: { edge: 'laser-sharp cutout, no shadow' },
      detail_slice: { style: 'tech schematic with callout lines' },
      detail_slice_feature: { style: 'exploded view with feature highlights' },
    },
  },
};

// ============================================================
// 导出
// ============================================================

/** 获取所有 Skill 包的简要列表 (用于 UI 选择器) */
export function getSkillList() {
  return Object.values(STYLE_SKILL_DEFS).map(s => ({
    key: s.key,
    name: s.name,
    emoji: s.emoji,
    desc: s.desc,
    categoryBoost: s.categoryBoost,
  }));
}

/** 根据 key 获取完整 Skill 包定义 */
export function getSkillByKey(key) {
  return STYLE_SKILL_DEFS[key] || STYLE_SKILL_DEFS.premium_minimal;
}

/** 根据品类推荐最佳 Skill 包 key */
export function recommendSkill(category) {
  const boostMap = {};
  for (const skill of Object.values(STYLE_SKILL_DEFS)) {
    for (const cat of skill.categoryBoost) {
      boostMap[cat] = boostMap[cat] || [];
      boostMap[cat].push(skill.key);
    }
  }
  const candidates = boostMap[category] || [];
  if (candidates.length > 0) return candidates[0];
  return 'premium_minimal'; // 默认
}

/** 获取 Skill 包的 campaignLock */
export function getCampaignLock(skillKey) {
  const skill = STYLE_SKILL_DEFS[skillKey];
  return skill ? skill.campaignLock : STYLE_SKILL_DEFS.premium_minimal.campaignLock;
}

/** 获取 Skill 包的某个图片角色 override */
export function getRoleOverride(skillKey, roleKey) {
  const skill = STYLE_SKILL_DEFS[skillKey];
  if (!skill || !skill.roleOverrides) return {};
  return skill.roleOverrides[roleKey] || {};
}

/** 构建 Skill 包描述文字 (注入到 prompt) */
export function buildSkillDescription(skillKey) {
  const skill = STYLE_SKILL_DEFS[skillKey];
  if (!skill) return '';
  const { lightingSystem, colorSystem, compositionRules } = skill;
  return [
    `STYLE DIRECTION: ${skill.campaignLock.visualDirection}`,
    `LIGHTING: ${lightingSystem.keyLight}. Fill: ${lightingSystem.fillLight}. Shadow: ${lightingSystem.shadowType}. Color temperature: ${lightingSystem.colorTemp}.`,
    `COLOR: Palette ${colorSystem.palette.join(', ')}. Saturation: ${colorSystem.saturation}. Contrast: ${colorSystem.contrast}.`,
    `COMPOSITION: ${compositionRules.positioning}. Product coverage: ${compositionRules.productCoverage}. ${compositionRules.anglePreference ? `Angle: ${compositionRules.anglePreference}.` : ''} Depth: ${compositionRules.depth}.`,
  ].join('\n');
}

export { STYLE_SKILL_DEFS };
