function normalizeEntry(value, key, index) {
  const isObject = value && typeof value === 'object';
  const url = typeof value === 'string'
    ? value
    : value?.url || value?.src || value?.image_url || value?.cover_url || '';
  if (!url) return null;
  const normalizedKey = isObject
    ? value.key || value.sourceKey || key || `image_${index + 1}`
    : key || `image_${index + 1}`;
  return {
    ...(isObject ? value : {}),
    url,
    key: normalizedKey,
    label: isObject ? (value.label || value.style || normalizedKey) : normalizedKey,
  };
}

export function normalizeWorkImages(images) {
  if (Array.isArray(images)) {
    return images
      .map((value, index) => normalizeEntry(value, value && typeof value === 'object' ? value.key : '', index))
      .filter(Boolean);
  }
  if (!images || typeof images !== 'object') return [];
  return Object.entries(images)
    .map(([key, value], index) => normalizeEntry(value, key, index))
    .filter(Boolean);
}
