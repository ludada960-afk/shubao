import { proxyImg } from '../services/api.js';

export const RESPONSIVE_IMAGE_WIDTHS = Object.freeze([320, 640, 960, 1600]);
const predecodeRequests = new Map();

export function rawImageUrl(source) {
  if (!source) return '';
  if (typeof source === 'object') {
    return rawImageUrl(source.url || source.src || source.image_url || source.cover_url || '');
  }
  return String(source);
}

function isDirectPublicAsset(url) {
  return /^\/(?:images|gallery)\//i.test(String(url || ''));
}

export function responsiveImageCandidates(source, variant = 'thumb') {
  const raw = rawImageUrl(source);
  if (!raw) return [];
  // Public showcase assets are already web-ready files. Loading them directly
  // avoids an unnecessary image-service round trip on the first viewport.
  if (isDirectPublicAsset(raw)) return [raw];
  const candidates = [proxyImg(raw, variant), proxyImg(raw, 'full')];
  candidates.push(raw);
  return [...new Set(candidates.filter(Boolean))];
}

export function responsiveImageSrcSet(source, format = 'webp') {
  const raw = rawImageUrl(source);
  if (!raw) return '';
  if (isDirectPublicAsset(raw)) return '';
  return RESPONSIVE_IMAGE_WIDTHS
    .map(width => `${proxyImg(raw, `w${width}`, format)} ${width}w`)
    .join(', ');
}

export function retryImageUrl(url, retryCount = 0) {
  const value = String(url || '');
  const attempt = Number(retryCount);
  if (!value || !Number.isSafeInteger(attempt) || attempt <= 0) return value;
  return `${value}${value.includes('?') ? '&' : '?'}image_retry=${attempt}`;
}

export function retryImageSrcSet(srcSet, retryCount = 0) {
  if (!srcSet || retryCount <= 0) return srcSet;
  return String(srcSet).split(',').map(candidate => {
    const value = candidate.trim();
    const separator = value.lastIndexOf(' ');
    if (separator < 0) return retryImageUrl(value, retryCount);
    return `${retryImageUrl(value.slice(0, separator), retryCount)}${value.slice(separator)}`;
  }).join(', ');
}

function decodeUrl(url) {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  if (predecodeRequests.has(url)) return predecodeRequests.get(url);
  const request = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try { await image.decode?.(); } catch {}
      resolve(url);
    };
    image.onerror = reject;
    image.src = url;
  }).finally(() => {
    setTimeout(() => predecodeRequests.delete(url), 30_000);
  });
  predecodeRequests.set(url, request);
  return request;
}

export async function predecodeResponsiveImage(source, variant = 'display') {
  const raw = rawImageUrl(source);
  if (!raw) return '';
  const avif = proxyImg(raw, variant, 'avif');
  try {
    await decodeUrl(avif);
    return avif;
  } catch {
    const webp = proxyImg(raw, variant, 'webp');
    await decodeUrl(webp);
    return webp;
  }
}
