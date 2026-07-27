const VERSION = 1;
const DB_NAME = 'shubao-creation-drafts';
const STORE_NAME = 'ecommerce-assets';

export function draftSnapshotKey({ ownerEmail = '', surface = 'home' } = {}) {
  return `sb-ec-workbench:v${VERSION}:${encodeURIComponent(ownerEmail.trim().toLowerCase() || 'anonymous')}:${surface}`;
}

export function saveDraftSnapshot(identity, snapshot, storage = globalThis.localStorage) {
  try {
    storage?.setItem(draftSnapshotKey(identity), JSON.stringify({ version: VERSION, updatedAt: Date.now(), ...snapshot }));
    return true;
  } catch { return false; }
}

export function loadDraftSnapshot(identity, storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(draftSnapshotKey(identity)) || 'null');
    return value?.version === VERSION ? value : null;
  } catch { return null; }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraftFiles(key, files = []) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(files.map(item => item.file).filter(Boolean), key);
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadDraftFiles(key) {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
    request.onsuccess = () => { db.close(); resolve(Array.isArray(request.result) ? request.result : []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export function filesToPreviewItems(files = []) {
  return files.map(file => ({ file, url: URL.createObjectURL(file) }));
}
