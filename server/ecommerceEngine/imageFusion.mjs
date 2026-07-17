/**
 * 薯包AI v4 双图差异化融合逻辑
 *
 * 核心思路：
 *   - 实拍图 (RealShot) → 高保真提取产品本体 → 控制产品形状/颜色/材质
 *   - 风格图 (StyleRef) → 提取视觉处理方式 → 控制光影/色调/构图
 *   - 融合时两者独立权重，互不干扰
 *
 * 融合结果用于构建 prompt 中的视觉描述部分
 */

/**
 * 融合实拍 + 风格双图分析，生成统一视觉描述文本
 *
 * @param {Object} realShot - parseRealShot 的输出
 * @param {Object} styleRef - parseStyleRef 的输出
 * @param {Object} options
 * @param {number} [options.productFidelity=0.85] - 产品保真权重
 * @param {number} [options.styleTransfer=0.65]  - 风格迁移权重
 * @returns {string} 融合后的视觉描述文本
 */
export function fuseDualAnalysis(realShot, styleRef, options = {}) {
  const pf = typeof options.productFidelity === 'number' ? options.productFidelity : 0.85;
  const st = typeof options.styleTransfer === 'number' ? options.styleTransfer : 0.65;

  const parts = [];

  // ======== 产品保真层（来自实拍图） ========
  if (realShot) {
    const r = realShot.product;
    const preserve = realShot.preservation || {};

    const productDesc = [];
    if (r.shape) productDesc.push(`PRODUCT SHAPE: "${r.shape}" — MUST preserve EXACTLY.`);
    if (r.dominantColors.length) productDesc.push(`PRODUCT COLORS: ${r.dominantColors.join(', ')} — maintain color accuracy (weight: ${pf}).`);
    if (r.materials.length) productDesc.push(`MATERIALS: ${r.materials.join(', ')}.`);
    if (r.texture) productDesc.push(`TEXTURE: ${r.texture}.`);
    if (r.keyFeatures.length) productDesc.push(`KEY FEATURES: ${r.keyFeatures.join(', ')} — must be visible.`);
    if (r.bestAngle) productDesc.push(`BEST ANGLE: ${r.bestAngle}.`);
    if (r.dimensionsHint) productDesc.push(`DIMENSIONS: ${r.dimensionsHint}.`);
    if (preserve.details && preserve.details.length) {
      productDesc.push(`DETAILS TO PRESERVE: ${preserve.details.join('; ')}.`);
    }

    const fidelityNote = pf > 0.7
      ? 'CRITICAL: The product appearance MUST match the reference photo EXACTLY. No shape changes, no color shifts, no material substitutions.'
      : pf > 0.4
        ? 'IMPORTANT: Keep product generally recognizable but allow moderate creative interpretation.'
        : 'Product is a creative reference only — adapt freely to fit the visual style.';

    parts.push(`╌╌╌ PRODUCT FIDELITY LAYER (weight: ${pf}) ╌╌╌\n${productDesc.join('\n')}\n${fidelityNote}`);
  }

  // ======== 风格迁移层（来自风格参考图） ========
  if (styleRef) {
    const vt = styleRef.visualTreatment;
    const tw = styleRef.transferWeights;

    const styleDesc = [];
    if (vt.lighting) {
      const ll = vt.lighting;
      styleDesc.push(`LIGHTING: ${ll.type}. Direction: ${ll.direction}. Temperature: ${ll.temperature}.`);
      styleDesc.push(`Shadows: ${ll.shadowHardness}. Contrast: ${ll.contrast}.`);
    }
    if (vt.colorPalette) {
      const cp = vt.colorPalette;
      styleDesc.push(`COLOR PALETTE: Dominant ${cp.dominant.join(', ')}. Accent ${cp.accent.join(', ')}.`);
      styleDesc.push(`Temperature: ${cp.temperature}. Saturation: ${cp.saturation}.`);
    }
    if (vt.composition) {
      const cc = vt.composition;
      styleDesc.push(`COMPOSITION: ${cc.style}. Product placement: ${cc.productPlacement}. Depth: ${cc.depth}. Background: ${cc.backgroundType}.`);
    }
    if (vt.mood) styleDesc.push(`MOOD: ${vt.mood}.`);
    if (vt.backgroundDetail) styleDesc.push(`BACKGROUND: ${vt.backgroundDetail}.`);

    const transferNote = st > 0.6
      ? `Apply these visual treatments to the product. Lighting: ${tw.lighting}, Color: ${tw.color}, Composition: ${tw.composition}, Mood: ${tw.mood} transfer strength.`
      : 'Use these as subtle inspiration, not strict rules.';

    parts.push(`╌╌╌ STYLE TRANSFER LAYER (weight: ${st}) ╌╌╌\n${styleDesc.join('\n')}\n${transferNote}`);
  }

  // ======== 融合约束 ========
  if (realShot && styleRef) {
    parts.push(
      '╌╌╌ FUSION CONSTRAINT ╌╌╌\n' +
      `FUSION RULE: The OUTPUT image must show the PRODUCT from the real shot (shape, colors, materials, exact product) ` +
      `but photographed in the STYLE of the reference image (lighting, composition, palette, mood).\n` +
      `DO NOT alter the product's physical appearance to match the reference's product.\n` +
      `DO NOT replace the product with the reference's product.\n` +
      `ONLY borrow the photographic treatment: lighting, color grading, composition approach, atmosphere.`
    );
  } else if (realShot) {
    parts.push(
      '╌╌╌ SINGLE-SOURCE MODE (real shot only) ╌╌╌\n' +
      `Use the product reference for both appearance and photographic style. ` +
      `Maintain product fidelity while applying professional e-commerce visual treatment.`
    );
  } else if (styleRef) {
    parts.push(
      '╌╌╌ SINGLE-SOURCE MODE (style reference only) ╌╌╌\n' +
      `Use the style reference for photographic direction. ` +
      `Generate the product based on text description with the reference's visual treatment.`
    );
  }

  return parts.join('\n\n');
}

/**
 * 构建 VLM 质检 prompt（用于生成后评估）
 * @param {string} prompt 原始 prompt
 * @param {string} productName 产品名
 * @returns {string} 质检 prompt
 */
export function buildQualityCheckPrompt(prompt, productName) {
  return `You are an e-commerce image quality inspector.

Evaluate this generated image against its requirements:

Generated for: ${productName}
Prompt used: ${prompt}

Checklist:
1. PRODUCT ACCURACY: Does the image match the described product? Score 0-100.
2. VISUAL QUALITY: Is the lighting professional? Composition balanced? Score 0-100.
3. TEXT HANDLING (if applicable): Is Chinese text legible, accurate, well-placed? Score 0-100.
4. CONSISTENCY: Would this image fit in a coherent set? Score 0-100.
5. ISSUES: List any problems (bad anatomy, distorted text, wrong colors, etc).

Return JSON only:
{
  "verdict": "pass|fail|borderline",
  "score": 85,
  "issues": ["issue1", "issue2"],
  "details": {
    "productAccuracy": 85,
    "visualQuality": 85,
    "textHandling": 90,
    "consistency": 80
  },
  "suggestedFixes": {
    "adjustPrompt": "specific text to add/change",
    "productFidelity": 0.9,
    "creativity": 0.3
  }
}`;
}

/**
 * 构建图片反推 prompt（灵图 AI 风格 — 从图片提取可用于再生的 prompt）
 * @param {Object} vlmResult - VLM 分析结果
 * @returns {Object} { shortPrompt, detailedPrompt }
 */
export function buildReversePrompt(vlmResult) {
  if (!vlmResult) return { shortPrompt: '', detailedPrompt: '' };

  const rs = vlmResult.realShot;
  const sr = vlmResult.styleRef;

  // 精简版 (适合 AI 生成)
  const shortParts = [];
  if (rs?.product) {
    const p = rs.product;
    shortParts.push(`Product: ${p.shape}, ${p.dominantColors.slice(0, 2).join(', ')}`);
    if (p.materials.length) shortParts.push(p.materials[0]);
  }
  if (sr?.visualTreatment) {
    const vt = sr.visualTreatment;
    shortParts.push(`Style: ${vt.mood || ''} ${vt.lighting?.type || ''}`);
    if (vt.colorPalette?.dominant.length) shortParts.push(`Colors: ${vt.colorPalette.dominant.join(', ')}`);
  }

  // 专业版 (含全部参数)
  const detailedParts = [];
  if (rs) {
    detailedParts.push('=== PRODUCT ===');
    const p = rs.product;
    detailedParts.push(`Shape: ${p.shape || 'N/A'}`);
    detailedParts.push(`Colors: ${p.dominantColors.join(', ') || 'N/A'}`);
    detailedParts.push(`Materials: ${p.materials.join(', ') || 'N/A'}`);
    detailedParts.push(`Texture: ${p.texture || 'N/A'}`);
    detailedParts.push(`Best angle: ${p.bestAngle || 'N/A'}`);
  }
  if (sr) {
    detailedParts.push('=== VISUAL STYLE ===');
    const vt = sr.visualTreatment;
    detailedParts.push(`Lighting: ${vt.lighting?.type || 'N/A'} (${vt.lighting?.direction || 'N/A'}, ${vt.lighting?.temperature || 'N/A'})`);
    detailedParts.push(`Palette: ${vt.colorPalette?.dominant.join(', ') || 'N/A'} + accent ${vt.colorPalette?.accent.join(', ') || 'N/A'}`);
    detailedParts.push(`Composition: ${vt.composition?.style || 'N/A'}`);
    detailedParts.push(`Mood: ${vt.mood || 'N/A'}`);
    detailedParts.push(`Background: ${vt.backgroundDetail || 'N/A'}`);
  }

  return {
    shortPrompt: shortParts.join('. ') || 'Product photography.',
    detailedPrompt: detailedParts.join('\n') || 'Product on clean background.',
  };
}
