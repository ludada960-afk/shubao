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

function canonicalName(role, index) {
  return `${role === 'product' ? '产品图' : '参考图'}${index + 1}`;
}

function referenceRecord(item) {
  return {
    sourceNodeId: item.sourceNodeId,
    assetId: item.assetId,
    url: item.url,
    displayName: item.name,
    mention: item.label,
    role: item.role,
    order: item.order,
  };
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
      name: '',
      role: normalizeRole(image?.role),
    });
  }

  const roleOrders = new Map();
  return unique.map((image, order) => {
    const role = normalizeRole(image.role);
    const roleIndex = roleOrders.get(role) || 0;
    roleOrders.set(role, roleIndex + 1);
    const name = canonicalName(role, roleIndex);
    return {
      ...image,
      role,
      name,
      label: `@${name}`,
      order,
    };
  });
}

export function appendImageMention(text, label) {
  const current = String(text || '');
  const mention = String(label || '').trim();
  if (!mention || current.includes(mention)) return current;
  const separator = current && !/\s$/.test(current) ? ' ' : '';
  return `${current}${separator}${mention} `;
}

export function removeImageMention(text, label) {
  const current = String(text || '');
  const mention = String(label || '').trim();
  if (!mention) return current;
  const escaped = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return current
    .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([，。；：！？、])/g, '$1')
    .trim();
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
    references: normalized.map(referenceRecord),
  };
}

export function buildRoleAwareImagePayload(mentions = []) {
  const normalized = buildImageMentions(mentions);
  return {
    productImages: normalized.filter(item => item.role === 'product').map(item => item.url),
    referenceImages: normalized.filter(item => item.role === 'reference').map(item => item.url),
    assets: normalized.map(referenceRecord),
  };
}
