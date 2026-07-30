const PREFIX = 'sb.canvas.draft.';

export function canvasDraftKey(work = {}) {
  const id = work._saveKey || work.id || work.taskId || work.canvasImportId || work.product_name || 'untitled';
  return `${PREFIX}${String(id).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled'}`;
}

export function loadCanvasDraft(key, storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections) || !parsed.viewport) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCanvasDraft(key, snapshot, storage = globalThis.localStorage) {
  if (!key || !snapshot?.viewport || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.connections)) return false;
  try {
    storage?.setItem(key, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearCanvasDraft(key, storage = globalThis.localStorage) {
  try { storage?.removeItem(key); } catch {}
}
