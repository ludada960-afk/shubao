export function contentResultPages(item = {}) {
  const urls = [item.cover_url, ...(Array.isArray(item.image_urls) ? item.image_urls : [])].filter(Boolean).slice(0, 9);
  const prompts = Array.isArray(item.image_prompts) ? item.image_prompts : [];
  return urls.map((url, index) => {
    const pageId = index === 0 ? 0 : index;
    const prompt = index === 0
      ? item.cover_prompt || prompts.find(entry => Number(entry.page_id) === 0)?.prompt || ''
      : prompts.find(entry => Number(entry.page_id) === pageId)?.prompt || '';
    return { id: `${item._saveKey || item.id || 'content'}-${pageId}`, url, index, pageId, prompt };
  });
}

export function isContentResult(item = {}) {
  return Boolean(item._contentResult || item._plogResult || item.type === 'xhs-content' || item.type === 'xhs-plog');
}

export function contentResultSummary(item = {}) {
  const pages = contentResultPages(item);
  return {
    pageCount: pages.length,
    promptCount: pages.filter(page => page.prompt).length,
    hasPublishCopy: Boolean(String(item.title || '').trim() || String(item.body_text || '').trim()),
  };
}
