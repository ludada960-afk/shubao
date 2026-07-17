/**
 * 薯包AI v4 VLM 识图解析 Schema & 解析器
 *
 * 完整定义实拍图分析 / 风格参考分析 的 JSON Schema 及解析逻辑。
 * VLM API 客户端在 ./vlmClient.mjs (预留接口位)。
 *
 * 使用方式：
 *   1. vlmClient.analyze(imageUrls) → raw VLM JSON
 *   2. parseRealShot(raw) → RealShotAnalysis (校验+兜底)
 *   3. parseStyleRef(raw) → StyleRefAnalysis (校验+兜底)
 */

// ============================================================
// 实拍图分析 Schema (TypeScript 类型标注，实际为 JS)
// ============================================================

/**
 * @typedef {Object} RealShotAnalysis
 * @property {Object} product
 * @property {string} product.shape        - "cylindrical bottle" / "box-like" / "organic"
 * @property {string[]} product.dominantColors  - ["#F5F0EB", "#C4A882"]
 * @property {string[]} product.materials       - ["frosted glass", "matte plastic"]
 * @property {string} product.texture           - "smooth matte" / "brushed metal"
 * @property {string[]} product.anglesPresent   - ["front", "45-degree", "top-down"]
 * @property {string} product.bestAngle         - "45-degree elevated"
 * @property {string[]} product.keyFeatures     - ["brand logo", "cap/closure"]
 * @property {string[]} product.printText       - 产品上印刷的文字
 * @property {string} product.dimensionsHint    - "approx 15cm tall"
 * @property {Object} quality
 * @property {'high'|'medium'|'low'} quality.resolution
 * @property {'sharp'|'soft'|'motion_blur'} quality.focus
 * @property {'clean'|'slight'|'noisy'} quality.noise
 * @property {number} quality.suitability       - 0-1
 * @property {Object} preservation
 * @property {boolean} preservation.shape
 * @property {boolean} preservation.colorAccuracy
 * @property {boolean} preservation.textureFidelity
 * @property {string[]} preservation.details
 */

/** 实拍图分析默认值 (兜底用) */
export const DEFAULT_REAL_SHOT = {
  product: {
    shape: '',
    dominantColors: [],
    materials: [],
    texture: '',
    anglesPresent: [],
    bestAngle: '3/4 elevated',
    keyFeatures: [],
    printText: [],
    dimensionsHint: '',
  },
  quality: {
    resolution: 'medium',
    focus: 'sharp',
    noise: 'clean',
    suitability: 0.7,
  },
  preservation: {
    shape: true,
    colorAccuracy: true,
    textureFidelity: true,
    details: [],
  },
};

// ============================================================
// 风格参考图分析 Schema
// ============================================================

/**
 * @typedef {Object} StyleRefAnalysis
 * @property {Object} visualTreatment
 * @property {Object} visualTreatment.lighting
 * @property {string} lighting.type          - "natural window" / "studio softbox" / "golden hour"
 * @property {string} lighting.direction     - "side-left" / "above" / "backlit"
 * @property {string} lighting.temperature   - "warm ~3500K" / "neutral ~5500K" / "cool ~6500K"
 * @property {'soft'|'medium'|'hard'} lighting.shadowHardness
 * @property {'low'|'medium'|'high'} lighting.contrast
 * @property {Object} visualTreatment.colorPalette
 * @property {string[]} colorPalette.dominant
 * @property {string[]} colorPalette.accent
 * @property {'warm'|'cool'|'neutral'} colorPalette.temperature
 * @property {'desaturated'|'natural'|'vibrant'} colorPalette.saturation
 * @property {Object} visualTreatment.composition
 * @property {string} composition.style
 * @property {string} composition.productPlacement
 * @property {'flat'|'medium'|'deep'} composition.depth
 * @property {string} composition.backgroundType
 * @property {string} visualTreatment.mood
 * @property {string} visualTreatment.backgroundDetail
 * @property {Object} transferWeights
 * @property {number} transferWeights.lighting   - 0-1
 * @property {number} transferWeights.color      - 0-1
 * @property {number} transferWeights.composition - 0-1
 * @property {number} transferWeights.mood       - 0-1
 */

/** 风格参考分析默认值 */
export const DEFAULT_STYLE_REF = {
  visualTreatment: {
    lighting: {
      type: 'professional studio',
      direction: 'above-left 45°',
      temperature: 'neutral ~5500K',
      shadowHardness: 'soft',
      contrast: 'medium',
    },
    colorPalette: {
      dominant: ['#FFFFFF', '#F5F0EB'],
      accent: ['#333333'],
      temperature: 'neutral',
      saturation: 'natural',
    },
    composition: {
      style: 'centered product',
      productPlacement: 'center',
      depth: 'medium',
      backgroundType: 'solid',
    },
    mood: 'professional clean',
    backgroundDetail: 'Clean solid background',
  },
  transferWeights: {
    lighting: 0.7,
    color: 0.6,
    composition: 0.5,
    mood: 0.6,
  },
};

// ============================================================
// 质量评估 Schema
// ============================================================

/**
 * @typedef {Object} QualityVerdict
 * @property {string} imageId
 * @property {'pass'|'fail'|'borderline'} verdict
 * @property {number} score          - 0-100
 * @property {string[]} issues       - 发现的问题列表
 * @property {Object} details
 * @property {number} details.productAccuracy  - 0-100
 * @property {number} details.styleConsistency - 0-100
 * @property {number} details.visualQuality    - 0-100
 * @property {Object} suggestedFixes  - 修复建议参数
 * @property {number} [suggestedFixes.creativity]
 * @property {number} [suggestedFixes.productFidelity]
 * @property {string} [suggestedFixes.adjustPrompt]
 */

export const DEFAULT_QUALITY = {
  imageId: '',
  verdict: 'pass',
  score: 85,
  issues: [],
  details: {
    productAccuracy: 85,
    styleConsistency: 85,
    visualQuality: 85,
  },
  suggestedFixes: {},
};

// ============================================================
// 聚合分析结果
// ============================================================

/**
 * @typedef {Object} VlmAnalysisResult
 * @property {RealShotAnalysis|null} realShot
 * @property {StyleRefAnalysis|null} styleRef
 * @property {number} realShotCount   - 实拍图张数
 * @property {number} styleRefCount   - 风格图张数
 * @property {boolean} hasRealShot
 * @property {boolean} hasStyleRef
 * @property {string} mode            - 'real_only' | 'style_only' | 'dual' | 'none'
 */

// ============================================================
// 解析器 (解析 VLM 返回的 raw JSON，合并兜底默认值)
// ============================================================

/**
 * 解析实拍图 VLM 输出
 * @param {Object} raw - VLM 返回的原始 JSON
 * @returns {RealShotAnalysis}
 */
export function parseRealShot(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_REAL_SHOT };

  const r = raw.product || {};
  const q = raw.quality || {};
  const p = raw.preservation || {};

  return {
    product: {
      shape: r.shape || DEFAULT_REAL_SHOT.product.shape,
      dominantColors: Array.isArray(r.dominantColors) ? r.dominantColors : (Array.isArray(r.dominant_colors) ? r.dominant_colors : DEFAULT_REAL_SHOT.product.dominantColors),
      materials: Array.isArray(r.materials) ? r.materials : DEFAULT_REAL_SHOT.product.materials,
      texture: r.texture || DEFAULT_REAL_SHOT.product.texture,
      anglesPresent: Array.isArray(r.anglesPresent) ? r.anglesPresent : (Array.isArray(r.angles_present) ? r.angles_present : DEFAULT_REAL_SHOT.product.anglesPresent),
      bestAngle: r.bestAngle || r.best_angle || DEFAULT_REAL_SHOT.product.bestAngle,
      keyFeatures: Array.isArray(r.keyFeatures) ? r.keyFeatures : (Array.isArray(r.key_features) ? r.key_features : DEFAULT_REAL_SHOT.product.keyFeatures),
      printText: Array.isArray(r.printText) ? r.printText : (Array.isArray(r.print_text) ? r.print_text : DEFAULT_REAL_SHOT.product.printText),
      dimensionsHint: r.dimensionsHint || r.dimensions_hint || DEFAULT_REAL_SHOT.product.dimensionsHint,
    },
    quality: {
      resolution: q.resolution || DEFAULT_REAL_SHOT.quality.resolution,
      focus: q.focus || DEFAULT_REAL_SHOT.quality.focus,
      noise: q.noise || DEFAULT_REAL_SHOT.quality.noise,
      suitability: typeof q.suitability === 'number' ? q.suitability : DEFAULT_REAL_SHOT.quality.suitability,
    },
    preservation: {
      shape: typeof p.shape === 'boolean' ? p.shape : DEFAULT_REAL_SHOT.preservation.shape,
      colorAccuracy: typeof p.colorAccuracy === 'boolean' ? p.colorAccuracy : (typeof p.color_accuracy === 'boolean' ? p.color_accuracy : DEFAULT_REAL_SHOT.preservation.colorAccuracy),
      textureFidelity: typeof p.textureFidelity === 'boolean' ? p.textureFidelity : (typeof p.texture_fidelity === 'boolean' ? p.texture_fidelity : DEFAULT_REAL_SHOT.preservation.textureFidelity),
      details: Array.isArray(p.details) ? p.details : DEFAULT_REAL_SHOT.preservation.details,
    },
  };
}

/**
 * 解析风格参考图 VLM 输出
 * @param {Object} raw
 * @returns {StyleRefAnalysis}
 */
export function parseStyleRef(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STYLE_REF };

  const vt = raw.visualTreatment || raw.visual_treatment || {};
  const lt = vt.lighting || {};
  const cp = vt.colorPalette || vt.color_palette || {};
  const co = vt.composition || {};
  const tw = raw.transferWeights || raw.transfer_weights || {};

  return {
    visualTreatment: {
      lighting: {
        type: lt.type || DEFAULT_STYLE_REF.visualTreatment.lighting.type,
        direction: lt.direction || DEFAULT_STYLE_REF.visualTreatment.lighting.direction,
        temperature: lt.temperature || DEFAULT_STYLE_REF.visualTreatment.lighting.temperature,
        shadowHardness: lt.shadowHardness || lt.shadow_hardness || DEFAULT_STYLE_REF.visualTreatment.lighting.shadowHardness,
        contrast: lt.contrast || DEFAULT_STYLE_REF.visualTreatment.lighting.contrast,
      },
      colorPalette: {
        dominant: Array.isArray(cp.dominant) ? cp.dominant : DEFAULT_STYLE_REF.visualTreatment.colorPalette.dominant,
        accent: Array.isArray(cp.accent) ? cp.accent : DEFAULT_STYLE_REF.visualTreatment.colorPalette.accent,
        temperature: cp.temperature || DEFAULT_STYLE_REF.visualTreatment.colorPalette.temperature,
        saturation: cp.saturation || DEFAULT_STYLE_REF.visualTreatment.colorPalette.saturation,
      },
      composition: {
        style: co.style || DEFAULT_STYLE_REF.visualTreatment.composition.style,
        productPlacement: co.productPlacement || co.product_placement || DEFAULT_STYLE_REF.visualTreatment.composition.productPlacement,
        depth: co.depth || DEFAULT_STYLE_REF.visualTreatment.composition.depth,
        backgroundType: co.backgroundType || co.background_type || DEFAULT_STYLE_REF.visualTreatment.composition.backgroundType,
      },
      mood: vt.mood || DEFAULT_STYLE_REF.visualTreatment.mood,
      backgroundDetail: vt.backgroundDetail || vt.background_detail || DEFAULT_STYLE_REF.visualTreatment.backgroundDetail,
    },
    transferWeights: {
      lighting: typeof tw.lighting === 'number' ? tw.lighting : DEFAULT_STYLE_REF.transferWeights.lighting,
      color: typeof tw.color === 'number' ? tw.color : DEFAULT_STYLE_REF.transferWeights.color,
      composition: typeof tw.composition === 'number' ? tw.composition : DEFAULT_STYLE_REF.transferWeights.composition,
      mood: typeof tw.mood === 'number' ? tw.mood : DEFAULT_STYLE_REF.transferWeights.mood,
    },
  };
}

/**
 * 构建 VLM 分析 prompt (发送给 VLM 模型)
 * @param {'real_shot'|'style_ref'} type
 * @param {string[]} imageUrls
 * @returns {Object} { systemPrompt, userPrompt }
 */
export function buildVlmPrompt(type, imageUrls = []) {
  const systemReal = `You are an e-commerce product image analysis expert. Analyze the product photo(s) below and return a JSON object with EXACTLY this structure (return ONLY valid JSON, no markdown, no explanation):

{
  "product": {
    "shape": "brief shape description",
    "dominantColors": ["#hex1", "#hex2"],
    "materials": ["material1", "material2"],
    "texture": "texture description",
    "anglesPresent": ["front", "45-degree"],
    "bestAngle": "best angle for hero shot",
    "keyFeatures": ["feature1", "feature2"],
    "printText": ["any visible text on product"],
    "dimensionsHint": "estimated dimensions"
  },
  "quality": {
    "resolution": "high|medium|low",
    "focus": "sharp|soft|motion_blur",
    "noise": "clean|slight|noisy",
    "suitability": 0.85
  },
  "preservation": {
    "shape": true,
    "colorAccuracy": true,
    "textureFidelity": true,
    "details": ["detail_to_preserve"]
  }
}`;

  const systemStyle = `You are a photography style analyst. Analyze the reference image(s) below and return a JSON object with EXACTLY this structure (return ONLY valid JSON, no markdown, no explanation):

{
  "visualTreatment": {
    "lighting": {
      "type": "natural window|studio softbox|golden hour|etc",
      "direction": "side-left|above|backlit|etc",
      "temperature": "warm ~3500K|neutral ~5500K|cool ~6500K",
      "shadowHardness": "soft|medium|hard",
      "contrast": "low|medium|high"
    },
    "colorPalette": {
      "dominant": ["#hex1", "#hex2"],
      "accent": ["#hex3"],
      "temperature": "warm|cool|neutral",
      "saturation": "desaturated|natural|vibrant"
    },
    "composition": {
      "style": "centered product|lifestyle scene|flat lay",
      "productPlacement": "center|rule-of-thirds|off-center",
      "depth": "flat|medium|deep",
      "backgroundType": "solid|gradient|scene|transparent"
    },
    "mood": "describe the mood in 3 words",
    "backgroundDetail": "detailed description of background"
  },
  "transferWeights": {
    "lighting": 0.8,
    "color": 0.7,
    "composition": 0.6,
    "mood": 0.7
  }
}`;

  return {
    systemPrompt: type === 'real_shot' ? systemReal : systemStyle,
    userPrompt: `Analyze this e-commerce product image${imageUrls.length > 1 ? 's' : ''}. Image count: ${imageUrls.length}. Return JSON only.`,
  };
}

/**
 * 聚合多张图的分析结果 (多实拍取最清晰的，多风格取平均)
 * @param {Object[]} results - 各张图的分析结果
 * @param {'real_shot'|'style_ref'} type
 * @returns {Object}
 */
export function aggregateAnalyses(results, type) {
  if (!results || results.length === 0) {
    return type === 'real_shot' ? { ...DEFAULT_REAL_SHOT } : { ...DEFAULT_STYLE_REF };
  }
  if (results.length === 1) {
    return type === 'real_shot' ? parseRealShot(results[0]) : parseStyleRef(results[0]);
  }
  // 多图：实拍选 quality.suitability 最高的，风格取平均值
  if (type === 'real_shot') {
    const parsed = results.map(r => parseRealShot(r));
    parsed.sort((a, b) => b.quality.suitability - a.quality.suitability);
    return parsed[0];
  }
  // 风格参考：加权融合
  const parsed = results.map(r => parseStyleRef(r));
  const avg = parsed[0];
  if (parsed.length > 1) {
    for (let i = 1; i < parsed.length; i++) {
      avg.transferWeights.lighting = (avg.transferWeights.lighting + parsed[i].transferWeights.lighting) / 2;
      avg.transferWeights.color = (avg.transferWeights.color + parsed[i].transferWeights.color) / 2;
      avg.transferWeights.composition = (avg.transferWeights.composition + parsed[i].transferWeights.composition) / 2;
      avg.transferWeights.mood = (avg.transferWeights.mood + parsed[i].transferWeights.mood) / 2;
    }
  }
  return avg;
}

/**
 * 判断用户输入模式
 * @param {string[]} realShots
 * @param {string[]} styleRefs
 * @returns {'real_only'|'style_only'|'dual'|'none'}
 */
export function getInputMode(realShots = [], styleRefs = []) {
  const hasReal = realShots.length > 0;
  const hasStyle = styleRefs.length > 0;
  if (hasReal && hasStyle) return 'dual';
  if (hasReal) return 'real_only';
  if (hasStyle) return 'style_only';
  return 'none';
}
