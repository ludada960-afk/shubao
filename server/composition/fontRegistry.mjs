import crypto from 'node:crypto';

import { normalizeEcommerceCategory } from '../ecommerceEngine/categoryKnowledge.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;
const FALLBACK_DESCRIPTOR = 'fallback-sans|css-generic:sans-serif|commercial-safe-system-fonts|v1';

const FALLBACK_SANS = Object.freeze({
  fontId: 'fallback-sans',
  family: 'sans-serif',
  commercialUse: true,
  license: 'system-font-fallback',
  coverage: 'system-dependent',
  deployed: true,
  verified: true,
  filePath: null,
  sha256: crypto.createHash('sha256').update(FALLBACK_DESCRIPTOR).digest('hex'),
});

export const FONT_REGISTRY = Object.freeze({
  'fallback-sans': FALLBACK_SANS,
});

function plannedFontId({ category, priceBand }) {
  const normalizedCategory = normalizeEcommerceCategory(category);
  const normalizedPriceBand = typeof priceBand === 'string' ? priceBand.trim().toLowerCase() : '';
  if (normalizedCategory === '美妆护肤' && normalizedPriceBand === 'premium') return 'source-han-serif-sc';
  if (['美妆护肤', '服饰穿搭', '食品饮料', '家居生活'].includes(normalizedCategory)) return 'source-han-serif-sc';
  return 'source-han-sans-sc';
}

function chooseToneFont(input, registry) {
  const explicitId = typeof input?.fontId === 'string' ? input.fontId.trim() : '';
  if (explicitId && registry[explicitId]) return registry[explicitId];
  return registry[plannedFontId(input || {})];
}

function isUsableFont(font) {
  return Boolean(font?.deployed === true
    && font?.commercialUse === true
    && SHA256_RE.test(font.sha256));
}

export function resolveFont(input = {}, registry = FONT_REGISTRY) {
  const fallback = registry?.['fallback-sans'] || FONT_REGISTRY['fallback-sans'];
  const candidate = chooseToneFont(input, registry || {});
  if (isUsableFont(candidate)) return candidate;
  return isUsableFont(fallback) ? fallback : FONT_REGISTRY['fallback-sans'];
}

export { SHA256_RE };
