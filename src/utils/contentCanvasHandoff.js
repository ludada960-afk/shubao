function stableUrl(value) {
  return typeof value === 'string' && value.trim() && !/^(?:data:|blob:)/i.test(value.trim())
    ? value.trim()
    : '';
}

export function buildContentCanvasResult(item = {}) {
  const urls = [stableUrl(item.cover_url), ...(Array.isArray(item.image_urls) ? item.image_urls.map(stableUrl) : [])].filter(Boolean);
  if (!urls.length) throw new Error('作品还没有可送入画板的稳定图片');
  const source = typeof item.source === 'string' && item.source ? item.source : 'content-set';
  const workId = typeof item.workId === 'string' ? item.workId : (typeof item._saveKey === 'string' ? item._saveKey : '');
  const refs = Array.isArray(item.projectAssetRefs) ? item.projectAssetRefs : [];
  const refByUrl = new Map(refs.map(ref => [stableUrl(ref?.stableUrl || ref?.url), ref]).filter(([url]) => url));
  return {
    _ecResult: true,
    product_name: item.title || '内容套图二创',
    platform: source.includes('plog') ? 'Plog' : '小红书',
    source_content: { workId, source, copiedAt: new Date().toISOString() },
    ...(item.projectId ? { projectId: item.projectId } : {}),
    ...(item.sourceVersionId ? { sourceVersionId: item.sourceVersionId } : {}),
    ...(item.resultVersionId ? { resultVersionId: item.resultVersionId } : {}),
    ...(refs.length ? { projectAssetRefs: refs } : {}),
    images: urls.map((url, index) => ({
      id: `${workId || 'content'}-${index}`,
      url,
      label: index === 0 ? '内容封面' : `内容配图 ${index}`,
      role: index === 0 ? '封面' : '配图',
      group: '素材',
      sourceWorkId: workId,
      sourceType: source,
      sourceIndex: index,
      ...(refByUrl.get(url) ? { assetRef: refByUrl.get(url) } : {}),
    })),
  };
}
