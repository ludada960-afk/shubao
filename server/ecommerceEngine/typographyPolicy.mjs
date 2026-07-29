import { normalizeEcommerceCategory } from './categoryKnowledge.mjs';
import { resolveFont } from '../composition/fontRegistry.mjs';

const FONT_REGISTRY_PLAN = Object.freeze({
  'source-han-sans-sc': Object.freeze({ commercialUse: true, license: 'OFL-1.1', coverage: 'zh-CN,latin,numeric', deployed: false, sha256: null }),
  'source-han-serif-sc': Object.freeze({ commercialUse: true, license: 'OFL-1.1', coverage: 'zh-CN,latin,numeric', deployed: false, sha256: null }),
});

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function policyFor(category, priceBand) {
  if (category === '数码3C') return { tone: 'technology', displayFontId: 'source-han-sans-sc', weights: [500, 700, 900] };
  if (category === '美妆护肤' && priceBand === 'premium') return { tone: 'premium', displayFontId: 'source-han-serif-sc', weights: [400, 600, 700] };
  if (category === '美妆护肤' || category === '服饰穿搭') return { tone: 'premium', displayFontId: 'source-han-serif-sc', weights: [400, 600, 700] };
  if (category === '母婴用品' || category === '宠物用品') return { tone: 'playful', displayFontId: 'source-han-sans-sc', weights: [500, 700] };
  if (category === '食品饮料' || category === '家居生活') return { tone: 'natural', displayFontId: 'source-han-serif-sc', weights: [400, 600, 700] };
  return { tone: 'functional', displayFontId: 'source-han-sans-sc', weights: [500, 700, 900] };
}

export function compileTypographySystem({ category = '其他', priceBand = '', language = 'zh-CN' } = {}) {
  const normalizedCategory = normalizeEcommerceCategory(category);
  const normalizedPriceBand = cleanString(priceBand).toLowerCase();
  const policy = policyFor(normalizedCategory, normalizedPriceBand);
  const resolvedFont = resolveFont({ category: normalizedCategory, priceBand: normalizedPriceBand, language });
  const bodyFontId = 'source-han-sans-sc';
  const numericFontId = 'source-han-sans-sc';
  const fallbackFontIds = policy.displayFontId === bodyFontId ? [numericFontId] : [bodyFontId, numericFontId];
  const fontIds = [...new Set([policy.displayFontId, bodyFontId, numericFontId, ...fallbackFontIds])];

  return {
    tone: policy.tone,
    language: cleanString(language) || 'zh-CN',
    displayFontId: policy.displayFontId,
    bodyFontId,
    numericFontId,
    weights: [...policy.weights],
    hierarchy: {
      title: { minSize: 42, maxSize: 88, maxLines: 2, weight: policy.weights.at(-1) },
      subtitle: { minSize: 24, maxSize: 42, maxLines: 2, weight: 600 },
      body: { minSize: 20, maxSize: 32, maxLines: 4, weight: 400 },
      numeric: { minSize: 30, maxSize: 64, maxLines: 1, weight: 700 },
    },
    alignment: policy.tone === 'technology' || policy.tone === 'functional' ? 'left' : 'balanced',
    lineHeight: 1.25,
    tracking: 0,
    maxLines: 4,
    contrastPolicy: 'WCAG AA for body copy; never place text over product identity features.',
    fallbackFontIds,
    resolvedFontId: resolvedFont.fontId,
    resolvedFont: { ...resolvedFont },
    fontAssetStatus: 'planned',
    fontRegistryPlan: fontIds.map(fontId => ({ fontId, ...FONT_REGISTRY_PLAN[fontId] })),
  };
}

export { FONT_REGISTRY_PLAN };
