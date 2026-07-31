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

export function responsiveImageCandidates(source, variant = 'thumb') {
  const raw = rawImageUrl(source);
  if (!raw) return [];
  const candidates = [proxyImg(raw, variant), proxyImg(raw, 'full')];
  if (/^https?:\/\//i.test(raw)) candidates.push(raw);
  return [...new Set(candidates.filter(Boolean))];
}

export function responsiveImageSrcSet(source, format = 'webp') {
  const raw = rawImageUrl(source);
  if (!raw) return '';
  return RESPONSIVE_IMAGE_WIDTHS
    .map(width => `${proxyImg(raw, `w${width}`, format)} ${width}w`)
    .join(', ');
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
