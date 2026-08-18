const text = value => String(value || '').trim();

export function buildXhsPublishPages(entry = {}) {
  return [entry.cover_url, ...(Array.isArray(entry.image_urls) ? entry.image_urls : [])]
    .map(text)
    .filter(Boolean)
    .slice(0, 9)
    .map((src, index) => ({
      index,
      src,
      alt: `${text(entry.title) || '小红书案例'} 第${index + 1}张`,
    }));
}

export function getNextXhsPublishIndex(index, delta, count) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  return (index + delta + count) % count;
}

export function getXhsPublishBody(entry = {}) {
  return String(entry.body || '');
}
