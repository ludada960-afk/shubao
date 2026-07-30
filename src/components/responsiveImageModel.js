import { proxyImg } from '../services/api.js';

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
