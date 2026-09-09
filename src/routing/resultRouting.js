const NOTE_TEXT_KEYS = ['cover_url', 'body_text', 'title', 'content', 'text'];
const NOTE_IMAGE_KEYS = ['image_urls', 'images', 'imageRecords'];

// 结果弹窗只有在"确实有东西可展示"时才允许自动打开。
// 反例（2026-09-10 用户反馈）：画布内点"新建画布"会把 result 置为 {}，
// 回到首页后 result 仍是 {}，旧逻辑只排除 _ecResult，于是弹出一个只有"暂无图片"的空白弹窗。
function hasDisplayableContent(result) {
  if (!result || typeof result !== 'object') return false;
  for (const key of NOTE_TEXT_KEYS) {
    const value = result[key];
    if (typeof value === 'string' && value.trim()) return true;
  }
  for (const key of NOTE_IMAGE_KEYS) {
    const list = result[key];
    if (!Array.isArray(list)) continue;
    const hasImage = list.some(entry => (typeof entry === 'string'
      ? entry.trim().length > 0
      : Boolean(entry && (entry.url || entry.src || entry.playbackUrl))));
    if (hasImage) return true;
  }
  return false;
}

export function shouldShowNoteModal({ page, result } = {}) {
  if (!result || result._ecResult) return false;
  if (page === 'ec-canvas') return false;
  return hasDisplayableContent(result);
}
