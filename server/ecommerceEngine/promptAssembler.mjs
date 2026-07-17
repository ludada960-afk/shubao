/**
 * 薯包AI v4 分层动态 Prompt 构建器
 *
 * 不再是 "写一条 prompt"，而是从 5 个独立层面逐层组装：
 *   1. 基础层 — 产品身份 (名称/品类/材质/纹理)
 *   2. 视觉层 — 光照/色调/构图/背景
 *   3. 风格层 — Campaign Lock (选中的 Skill 包)
 *   4. 细节层 — 当前图片角色的卖点/文案/标注
 *   5. 约束层 — 出图规范 (平台/文字/比例/禁止项)
 *
 * 最终 = 基础 + 视觉 + 风格 + 细节 + 约束 + 融合描述
 */

import { buildCampaignLockText } from '../ecommercePromptEngine.mjs';
import { getCampaignLock, buildSkillDescription, getRoleOverride } from './styleSkills.mjs';
import { getCategoryInfo } from './categoryKnowledge.mjs';
import { fuseDualAnalysis } from './imageFusion.mjs';

// ============================================================
// 平台视觉规范
// ============================================================
const PLATFORM_VISUAL_GUIDE = {
  '淘宝': 'Taobao/Tmall style. Clean commercial photography for Chinese marketplace.',
  '京东': 'JD.com premium style. High-end, minimal promotional elements.',
  '拼多多': 'Pinduoduo style. Energetic, bright colors, price-aware.',
  '抖音电商': 'Douyin style. Dynamic, high impact, mobile-first vertical.',
  '小红书电商': 'RED lifestyle style. Aesthetic, aspirational, 3:4 vertical, warm editorial.',
  '亚马逊': 'Amazon compliant. Main image: pure white #FFFFFF bg, no text/logos/watermarks.',
};

const PLATFORM_SIZES = {
  '淘宝':       { '1:1':'1440×1440px', '3:4':'1440×1920px' },
  '京东':       { '1:1':'1440×1440px', '3:4':'1440×1920px' },
  '拼多多':     { '1:1':'1440×1440px', '3:4':'1440×1920px' },
  '小红书电商': { '1:1':'1440×1440px', '3:4':'1440×1920px' },
  '抖音电商':   { '1:1':'1440×1440px', '3:4':'1440×1920px' },
  '亚马逊':     { '1:1':'1000×1000px', '3:4':'1500×2000px' },
};

// ============================================================
// 图片角色定义 (与 IMAGE_ROLES 保持一致)
// ============================================================
const ROLE_INFO = {
  white_bg:        { label: '白底图',  ratio: '1:1', hasText: false, hasSellingPoint: false },
  main_text:       { label: '主图 1:1', ratio: '1:1', hasText: true, hasSellingPoint: true },
  main_3x4:        { label: '主图 3:4', ratio: '3:4', hasText: true, hasSellingPoint: false },
  transparent:     { label: 'PNG透明图', ratio: '1:1', hasText: false, hasSellingPoint: false },
  sku:             { label: 'SKU规格图', ratio: '1:1', hasText: true, hasSellingPoint: false },
  detail_slice_size:    { label: '尺寸标注', ratio: '3:4', hasText: true, hasSellingPoint: false },
  detail_slice_scene:   { label: '场景切片', ratio: '3:4', hasText: false, hasSellingPoint: false },
  detail_slice_qc:      { label: '质检报告', ratio: '3:4', hasText: true, hasSellingPoint: false },
  detail_slice_compare: { label: '对比切片', ratio: '3:4', hasText: true, hasSellingPoint: false },
  detail_slice_feature: { label: '功能切片', ratio: '3:4', hasText: true, hasSellingPoint: false },
  detail_slice_care:    { label: '保养切片', ratio: '3:4', hasText: true, hasSellingPoint: false },
};

// ============================================================
// 分层 Prompt 构建器
// ============================================================

/**
 * 构建单张图的完整分层 prompt
 *
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.category
 * @param {string} params.roleKey      - white_bg / main_text / main_3x4 / sku / detail_slice_*
 * @param {string[]} params.sellingPoints
 * @param {string} params.platform
 * @param {Object} [params.variant]     - SKU variant
 * @param {string} [params.sliceNote]   - 自定义切片文案
 * @param {string} [params.styleSkill]  - Style Skill key
 * @param {Object} [params.realShot]    - VLM 实拍分析
 * @param {Object} [params.styleRef]    - VLM 风格分析
 * @param {number} [params.productFidelity=0.85]
 * @param {number} [params.styleTransfer=0.65]
 * @returns {string} 完整 prompt
 */
export function assemblePrompt(params) {
  const {
    productName, category, roleKey, sellingPoints = [],
    platform = '淘宝', variant, sliceNote,
    styleSkill = 'premium_minimal',
    realShot, styleRef,
    productFidelity = 0.85, styleTransfer = 0.65,
  } = params;

  const baseKey = roleKey.replace(/_\d+$/, '');
  const role = ROLE_INFO[baseKey];
  if (!role) return buildFallbackPrompt(productName, category, roleKey);

  const cat = getCategoryInfo(category);
  const platformGuide = PLATFORM_VISUAL_GUIDE[platform] || PLATFORM_VISUAL_GUIDE['淘宝'];
  const sizeInfo = getSizeInfo(platform, role.ratio);
  const myPoint = sellingPoints[0] || '';

  const layers = [];

  // ───── 第 1 层: 基础层 (产品身份) ─────
  layers.push(buildFoundationLayer(productName, category, cat, roleKey));

  // ───── 第 2 层: 视觉层 (品类视觉 + 双图融合描述) ─────
  layers.push(buildVisualLayer(cat, roleKey, realShot, styleRef, { productFidelity, styleTransfer }));

  // ───── 第 3 层: 风格层 (Skill 包 Campaign Lock) ─────
  const lock = getCampaignLock(styleSkill);
  const lockText = buildCampaignLockText(lock);
  if (lockText) layers.push(`[CAMPAIGN STYLE LOCK]\n${lockText}`);

  // ───── 第 4 层: 细节层 (卖点/文案/标注) ─────
  layers.push(buildDetailLayer(roleKey, baseKey, productName, category, cat, myPoint, sellingPoints, variant, sliceNote));

  // ───── 第 5 层: 约束层 (平台规范/比例/禁止项) ─────
  layers.push(buildConstraintLayer(roleKey, baseKey, platform, platformGuide, sizeInfo));

  // Role override from skill
  const override = getRoleOverride(styleSkill, baseKey);
  if (override && Object.keys(override).length > 0) {
    const overrideText = Object.entries(override)
      .map(([k, v]) => `${k}: ${v}`)
      .join('. ');
    layers.push(`[ROLE OVERRIDE]\n${overrideText}.`);
  }

  // 合并
  return layers.filter(Boolean).join('\n\n');
}

// ============================================================
// 各层构建函数
// ============================================================

function buildFoundationLayer(productName, category, cat, roleKey) {
  const name = productName.replace(/["""]/g, '');
  return [
    `PRODUCT: "${name}"`,
    `CATEGORY: ${category}`,
    `MATERIALS: ${cat.materials}`,
    `TEXTURE: ${cat.texture}`,
    `COLORS: Base ${cat.baseColors}. Accent ${cat.accentColors}. Scheme: ${cat.colorScheme}.`,
  ].join('\n');
}

function buildVisualLayer(cat, roleKey, realShot, styleRef, { productFidelity, styleTransfer }) {
  const parts = [
    `LIGHTING: ${cat.lighting}.`,
    `BACKGROUND: ${cat.backgroundDetail}.`,
    `LIGHTING DETAIL: ${cat.lightingDetail}.`,
    `SCENE: ${cat.sceneDesc}. Surface: ${cat.surface}.`,
  ];

  // 如果有双图融合分析，拼入
  if (realShot || styleRef) {
    const fusion = fuseDualAnalysis(realShot, styleRef, { productFidelity, styleTransfer });
    parts.push(fusion);
  }

  return `[VISUAL DIRECTION]\n${parts.join('\n')}`;
}

function buildDetailLayer(roleKey, baseKey, productName, category, cat, myPoint, sellingPoints, variant, sliceNote) {
  const note = sliceNote ? ` Extra note: "${sliceNote}".` : '';
  let detail;

  switch (baseKey) {
    case 'white_bg':
      return '';
    case 'main_text':
      detail = [
        `TEXT CONTENT: Include Chinese promotional text on the image.`,
        `Main headline: "${myPoint || '新品'}" (max 6 Chinese chars).`,
        sellingPoints.length > 1 && `Sub: "${sellingPoints.slice(1, 3).join(' · ')}" (max 10 chars each).`,
        `Style: Clean sans-serif, high contrast, bottom or corner placement. Max 2-3 text elements.`,
        `Specific product feature to highlight: ${cat.detailFeature}.`,
      ].filter(Boolean).join('\n');
      break;
    case 'main_3x4':
      detail = [
        `Multi-angle or lifestyle angle preferred (3/4 view, elevated, or in-scene).`,
        `TEXT: Optional minimal Chinese text in corner (max 1-2 elements).`,
        `Feature: ${cat.detailFeature}.`,
      ].join('\n');
      break;
    case 'transparent':
      detail = `Absolutely NO background — transparent. Soft shadow below product for compositing. NO text. Clean edges.`;
      break;
    case 'sku': {
      const col = variant?.color || '';
      const sz = variant?.size || '';
      const cap = variant?.capacity || '';
      const dim = variant?.dimLabel || '';
      const labelStr = [col, sz, cap].filter(Boolean).join(' · ');
      detail = [
        `SKU VARIANT: This image shows ONE specific variant.`,
        col ? `COLOR: "${col}" — render the product in exactly this color.` : '',
        sz ? `SIZE: "${sz}".` : '',
        cap ? `CAPACITY: "${cap}".` : '',
        dim ? `DIMENSION ANNOTATION: "${dim}" printed below product.` : '',
        `LABEL: "${labelStr || productName}" — small Chinese label below product.`,
      ].filter(Boolean).join('\n');
      break;
    }
    case 'detail_slice_size':
      detail = `Dimension annotation — red leader lines pointing to edges with Chinese dimension labels. Header: "${productName} 尺寸标注".${note}`;
      break;
    case 'detail_slice_scene':
      detail = `Lifestyle scene — ${cat.sceneDesc}. Surface: ${cat.surface}. Props: 2-3 contextual items. Product in real environment. NO text.${note}`;
      break;
    case 'detail_slice_qc':
      detail = `QC/Inspection report — Product on one side, mock certificate card on the other. Headers: "质检报告" and "检测结果:合格".${note}`;
      break;
    case 'detail_slice_compare':
      detail = `Advantage comparison — Split: "普通款" (dull) vs "${productName}" (premium). Highlight "${myPoint || '优势'}".${note}`;
      break;
    case 'detail_slice_feature':
      detail = `Feature callouts — Product on left (55%), 3-4 feature pills on right with connector lines. Features: ${(sellingPoints.length ? sellingPoints.slice(0, 3).join(' / ') : '核心功能点')}.${note}`;
      break;
    case 'detail_slice_care':
      detail = `Maintenance/care guide — 3-4 care instruction icons + Chinese text. Care notes: "${sliceNote || '妥善保养'}".${note}`;
      break;
    default:
      detail = '';
  }

  return detail ? `[DETAIL LAYER]\n${detail}` : '';
}

function buildConstraintLayer(roleKey, baseKey, platform, platformGuide, sizeInfo) {
  const constraints = [];

  // 角色特定约束
  if (baseKey === 'white_bg') {
    constraints.push('CRITICAL: Pure white background #FFFFFF. NO text, badges, labels, or logos.');
    constraints.push('Only original product printed text is allowed.');
    constraints.push('NO people, no models, no hands, no body parts.');
  } else if (baseKey === 'main_text') {
    constraints.push('Product prominently displayed in main area (50-60% of frame).');
    constraints.push('Reserved zone for promotional text overlay.');
    constraints.push(`Text: Chinese promotional text. "${platform === '亚马逊' ? 'No text on Amazon' : 'Max 2-3 short Chinese text elements, clean sans-serif.'}"`);
    constraints.push('CRITICAL — NO PEOPLE: No models, no hands, no body parts. Product only plus text.');
  } else if (baseKey === 'main_3x4') {
    constraints.push('CRITICAL — NO PEOPLE unless lifestyle scene. Product is hero.');
    constraints.push('Optional minimal Chinese promotional text in corner.');
  } else if (baseKey === 'transparent') {
    constraints.push('NO background. NO text. Clean cutout edges.');
    constraints.push('Soft shadow for compositing only.');
  }

  // 通用约束
  constraints.push(`ASPECT RATIO: ${ROLE_INFO[baseKey]?.ratio || '1:1'}. Final output: ${sizeInfo}.`);
  constraints.push(`PLATFORM REQUIREMENTS: ${platformGuide}`);
  constraints.push('QUALITY: Hyper-realistic. 8K detail. Professional lighting. Sharp focus.');
  if (platform === '亚马逊' && baseKey === 'white_bg') {
    constraints.push('Amazon compliance: pure white #FFFFFF bg, NO text/logos/watermarks/people.');
  }

  return `[CONSTRAINTS]\n${constraints.join('\n')}`;
}

// ============================================================
// 工具函数
// ============================================================

function getSizeInfo(platform, ratio) {
  const dims = PLATFORM_SIZES[platform];
  if (dims && ratio && dims[ratio]) return dims[ratio];
  return ratio === '1:1' ? '1440×1440px' : '1440×1920px';
}

function buildFallbackPrompt(productName, category, roleKey) {
  return [
    `E-commerce product photo: ${productName} (${category}).`,
    `Role: ${roleKey}.`,
    `Professional photography, studio lighting, 8K detail.`,
  ].join(' ');
}
