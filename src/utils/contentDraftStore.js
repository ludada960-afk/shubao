const STORAGE_KEY = 'shubao.contentDrafts.v1';

function getStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function keyFor(ownerEmail, source) {
  const owner = String(ownerEmail || 'anonymous').trim().toLowerCase() || 'anonymous';
  const surface = String(source || 'content').trim().toLowerCase() || 'content';
  return `${owner}\n${surface}`;
}

function referenceAssetIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(value => (
    typeof value === 'string'
    && value.trim() !== ''
    && !/^(?:data:|blob:)/i.test(value.trim())
  )).map(value => value.trim()))];
}

function sanitizeDraft(draft = {}) {
  return {
    draftId: typeof draft.draftId === 'string' ? draft.draftId.trim() : '',
    text: typeof draft.text === 'string' ? draft.text : '',
    style: typeof draft.style === 'string' ? draft.style : '',
    layout: typeof draft.layout === 'string' ? draft.layout : '',
    coverVariant: typeof draft.coverVariant === 'string' ? draft.coverVariant : '',
    referenceAssetIds: referenceAssetIds(draft.referenceAssetIds),
  };
}

export function loadContentDraft({ ownerEmail, source } = {}, { storage } = {}) {
  try {
    const entries = JSON.parse(getStorage(storage)?.getItem?.(STORAGE_KEY) || '{}');
    const value = entries?.[keyFor(ownerEmail, source)];
    return value && typeof value === 'object' ? sanitizeDraft(value) : null;
  } catch {
    return null;
  }
}

export function saveContentDraft({ ownerEmail, source, draftId, draft } = {}, { storage } = {}) {
  const target = getStorage(storage);
  const key = keyFor(ownerEmail, source);
  const value = sanitizeDraft({ ...(draft || {}), draftId });
  try {
    const entries = JSON.parse(target?.getItem?.(STORAGE_KEY) || '{}');
    target?.setItem?.(STORAGE_KEY, JSON.stringify({
      ...(entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {}),
      [key]: value,
    }));
  } catch {
    // Draft recovery is best-effort; the live form remains authoritative.
  }
  return value;
}
