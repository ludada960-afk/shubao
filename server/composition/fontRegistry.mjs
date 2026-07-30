import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { normalizeEcommerceCategory } from '../ecommerceEngine/categoryKnowledge.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/;
const FALLBACK_FONT_PATH = fileURLToPath(new URL('./fonts/NotoSansCJKsc-Regular.otf', import.meta.url));
const FALLBACK_FONT_SHA256 = '2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b';
const FALLBACK_FONT_BYTES = readFileSync(FALLBACK_FONT_PATH);
const actualFallbackSha256 = crypto.createHash('sha256').update(FALLBACK_FONT_BYTES).digest('hex');
if (actualFallbackSha256 !== FALLBACK_FONT_SHA256) {
  throw Object.assign(new Error('deployed fallback font checksum mismatch'), { code: 'FONT_CHECKSUM_MISMATCH' });
}
const FALLBACK_FONT_DATA_URL = `data:font/otf;base64,${FALLBACK_FONT_BYTES.toString('base64')}`;

const FALLBACK_SANS = Object.freeze({
  fontId: 'fallback-sans',
  family: 'Noto Sans CJK SC',
  commercialUse: true,
  license: 'OFL-1.1',
  licenseFilePath: fileURLToPath(new URL('./fonts/OFL.txt', import.meta.url)),
  coverage: 'zh-CN,latin,numeric',
  deployed: true,
  verified: true,
  filePath: FALLBACK_FONT_PATH,
  mimeType: 'font/otf',
  sha256: FALLBACK_FONT_SHA256,
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

export function fontDataUrl(fontId = 'fallback-sans') {
  const font = resolveFont({ fontId });
  if (font.fontId === 'fallback-sans') return FALLBACK_FONT_DATA_URL;
  const bytes = font.fontId === 'fallback-sans' ? FALLBACK_FONT_BYTES : readFileSync(font.filePath);
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== font.sha256) throw Object.assign(new Error('font checksum mismatch'), { code: 'FONT_CHECKSUM_MISMATCH' });
  return `data:${font.mimeType || 'font/otf'};base64,${bytes.toString('base64')}`;
}

export { FALLBACK_FONT_SHA256, SHA256_RE };
