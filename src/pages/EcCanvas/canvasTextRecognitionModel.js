export function canvasTextRecognitionCacheKey(node = {}) {
  const assetId = String(node.assetId || '').trim();
  const url = String(node.url || '').trim();
  if (!assetId && !url) return '';
  return `${assetId}|${url}`;
}

export function readCanvasTextRecognitionCache(cache, node) {
  const key = canvasTextRecognitionCacheKey(node);
  if (!key || !cache?.has(key)) return undefined;
  return cache.get(key);
}

export function writeCanvasTextRecognitionCache(cache, node, blocks) {
  const key = canvasTextRecognitionCacheKey(node);
  if (!key || !cache?.set || !Array.isArray(blocks)) return false;
  cache.set(key, blocks);
  return true;
}
