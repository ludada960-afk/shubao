// 记住上次导出用的文件夹 —— 2026-10-01 用户批注
//
// 用户原话：
//   「用户他选择过一次路径之后，你就帮他记住这个路径，用户他下次进行导出的时候，
//     这个路径你不需要让他再进行选择了，就是你就默认上一次他导出的那个路径显示给他。
//     如果他还需要更改路径的话，他自己会点那个更改保存路径的那个按钮，自己去改的。
//     这样做的目的是用户他可能多次导出……你不需要让他经常去选。」
//
// ⚠️ 先说清一件做不到的事，避免下一个人以为能做：**浏览器永远不暴露绝对路径**。
//   File System Access API 的 `FileSystemDirectoryHandle` 只有 `name`（文件夹名），
//   出于安全**不提供** `C:\Users\…` / `/Users/…` 这样的完整路径 —— 任何网站都拿不到，
//   所以「把本地完整路径写出来」这一半是平台限制，不是没做。
//   能做、也已经在这里做的是另一半：**记住他上次选的文件夹，下次直接用**。
//
// 存储用 IndexedDB 而不是 localStorage：handle 是结构化可克隆对象，
// localStorage 只能存字符串，塞进去就废了。

const DB_NAME = 'shubao-export-destinations';
const DB_VERSION = 1;
const STORE = 'directories';
const LAST_KEY = 'last-directory';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexedDB open failed'));
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try { result = run(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
      tx.onerror = () => reject(tx.error || new Error('indexedDB tx failed'));
      tx.onabort = () => reject(tx.error || new Error('indexedDB tx aborted'));
    });
  } finally {
    try { db.close(); } catch { /* 忽略 */ }
  }
}

/** 记住这个目录。**只对 directory 策略有意义**（单文件/zip 没有"上次那个文件夹"）。 */
export async function rememberExportDirectory(handle) {
  if (!handle || typeof handle !== 'object' || typeof handle.getDirectoryHandle !== 'function') return false;
  try {
    await withStore('readwrite', store => store.put(handle, LAST_KEY));
    return true;
  } catch {
    return false;   // 记不住不是致命错误：下次多选一次文件夹而已
  }
}

/**
 * 取回上次那个目录，**并确认权限仍然可用**。
 * `requestPermission` 由调用方注入（必须在**用户手势里**调用，浏览器不允许后台弹权限）。
 * 返回 handle 或 null。
 */
export async function recallExportDirectory({ requestPermission } = {}) {
  try {
    const handle = await withStore('readonly', store => store.get(LAST_KEY));
    if (!handle || typeof handle.queryPermission !== 'function') return null;
    const opts = { mode: 'readwrite' };
    let state = await handle.queryPermission(opts);
    if (state !== 'granted' && typeof requestPermission === 'function') {
      state = await handle.requestPermission(opts);
    }
    return state === 'granted' ? handle : null;
  } catch {
    return null;
  }
}

/** 忘记它（「更改保存位置」被用到时不需要 —— 换目录会覆盖，不需要显式清）。 */
export async function forgetExportDirectory() {
  try { await withStore('readwrite', store => store.delete(LAST_KEY)); return true; } catch { return false; }
}

/** 界面上能显示的那部分路径 —— 只有文件夹名，理由见文件头。 */
export function exportDestinationLabel(destination) {
  if (!destination) return '';
  if (destination.strategy === 'directory') return destination.name || destination.handle?.name || '已选文件夹';
  return destination.name || destination.filename || '';
}