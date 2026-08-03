function identityFor(image = {}) {
  if (typeof image === 'string') return image.trim();
  return String(image.sourceNodeId || image.id || image.assetId || image.url || '').trim();
}

function urlFor(image = {}) {
  return String(typeof image === 'string' ? image : image?.url || '').trim();
}

function normalizeRole(role) {
  return role === 'product' ? 'product' : 'reference';
}

export function buildImageMentions(images = []) {
  const seen = new Set();
  const unique = [];

  for (const image of Array.isArray(images) ? images : []) {
    const identity = identityFor(image);
    const url = urlFor(image);
    if (!identity || !url || seen.has(identity)) continue;
    seen.add(identity);
    unique.push({
      sourceNodeId: String(image?.sourceNodeId || image?.id || identity),
      assetId: String(image?.assetId || ''),
      url,
      name: String(image?.name || image?.displayLabel || ''),
      role: normalizeRole(image?.role),
    });
  }

  return unique.map((image, order) => ({
    ...image,
    label: `@图片${order + 1}`,
    order,
  }));
}

export function appendImageMention(text, label) {
  const current = String(text || '');
  const mention = String(label || '').trim();
  if (!mention || current.includes(mention)) return current;
  const separator = current && !/\s$/.test(current) ? ' ' : '';
  return `${current}${separator}${mention} `;
}

export function toggleImageMention(mentions = [], image = {}) {
  const normalized = buildImageMentions(mentions);
  const identity = identityFor(image);
  if (!identity) return normalized;
  const exists = normalized.some(item => identityFor(item) === identity);
  return buildImageMentions(exists
    ? normalized.filter(item => identityFor(item) !== identity)
    : [...normalized, image]);
}

export function buildCanvasImageReferencePayload(mentions = []) {
  const normalized = buildImageMentions(mentions);
  return {
    imageUrl: normalized[0]?.url || '',
    referenceImages: normalized.slice(1).map(item => item.url),
    sourceNodeIds: normalized.map(item => item.sourceNodeId),
  };
}

export function buildRoleAwareImagePayload(mentions = []) {
  const normalized = buildImageMentions(mentions);
  return {
    productImages: normalized.filter(item => item.role === 'product').map(item => item.url),
    referenceImages: normalized.filter(item => item.role === 'reference').map(item => item.url),
  };
}
