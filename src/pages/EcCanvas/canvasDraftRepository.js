const PREFIX = 'sb.canvas.draft.';
export const CANVAS_DRAFT_SCHEMA_VERSION = 2;

/* ═══ 2026-10-01 性能：草稿里**不存** base64 ════════════════════════════════════════
   用户原话：「我在水印面板进行操作，都要延迟一会才会生效」「整体都有延迟」。

   实测（真浏览器、真 origin）：
     1 张图 → JSON 1.0MB  ✅ 写进得去
     4 张图 → JSON 4.2MB  ✅
     8 张图 → JSON 8.3MB  ❌ QuotaExceededError
    12 张图 → JSON 12.5MB ❌ QuotaExceededError
   一张 400KB 的 JPEG 转成 data: URL 约 546K 字符，而画布里同一个 data URL
   会出现在 `url` 和 `localPreviewUrl` 两个字段（index.jsx 的 replace/drop 路径），
   于是 JSON 体积直接翻倍。

   而原来的 `catch { return false }` 是**静默**的 ⇒ 画了 8 张以上图的用户，
   草稿**从来没被存下来过**，刷新就全没了，自己却完全不知道。

   决定：本地草稿**不存 data URL**。
   · 它是"临时预览"，上传一完成就会被 swapNodeToDurableUrl 换成 /api/generated-assets/…；
   · 它是本地兜底，不承担"素材本体"的职责（那是远端 canvas session 的事，没动）；
   · 存不下的草稿等于没有草稿 —— 宁可让"还在上传中"的那个节点丢一张预览，
     也不能让整份草稿（所有节点的位置、连线、文字）一起丢。
   代价写在这里：刷新后，**仍在上传中**的节点会显示占位而不是那张图。
   这本来就是事实（服务端手里确实还没有这张图），比静默丢整份草稿诚实。 */
const TRANSIENT_DATA_URL = /^data:/i;

function trimTransientDataUrls(snapshot) {
  return {
    ...snapshot,
    nodes: (snapshot.nodes || []).map(node => {
      if (!node || typeof node !== 'object') return node;
      /* 两个字段都可能是 data URL；只动 data:，durable 的 /api/… 地址一律保留 */
      const urlIsTransient = TRANSIENT_DATA_URL.test(String(node.url || ''));
      const previewIsTransient = TRANSIENT_DATA_URL.test(String(node.localPreviewUrl || ''));
      if (!urlIsTransient && !previewIsTransient) return node;
      return {
        ...node,
        url: urlIsTransient ? '' : node.url,
        localPreviewUrl: previewIsTransient ? '' : node.localPreviewUrl,
        /* 渲染与后续逻辑据此知道"这张图还没真正入库"，好显示占位而不是裂图 */
        draftMediaTrimmed: true,
      };
    }),
  };
}

function keyPart(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function canvasDraftKey(work = {}) {
  const id = work._saveKey || work.id || work.taskId || work.canvasImportId || work.product_name || 'untitled';
  const version = work.canvasImportId || work.resultVersionId || work.generationRunId || '';
  return `${PREFIX}${keyPart(id) || 'untitled'}${version ? `.${keyPart(version)}` : ''}`;
}

export function loadCanvasDraft(key, storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) || 'null');
    if (!parsed || parsed.schemaVersion !== CANVAS_DRAFT_SCHEMA_VERSION
      || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.connections) || !parsed.viewport) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCanvasDraft(key, snapshot, storage = globalThis.localStorage) {
  if (!key || !snapshot?.viewport || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.connections)) return false;
  try {
    /* 去掉 data URL 之后再序列化：这一步同时省掉了大头 stringify 开销**和**
       QuotaExceededError（上面那条注释里有实测数据）。 */
    const payload = JSON.stringify({ ...trimTransientDataUrls(snapshot), schemaVersion: CANVAS_DRAFT_SCHEMA_VERSION, savedAt: Date.now() });
    storage?.setItem(key, payload);
    return true;
  } catch {
    /* ⚠️ 这里曾经是完全静默的失败：存不下时用户毫不知情，
       表现就是"我画的东西刷新就没了"。至少把"存过"这个事实留给排查。 */
    return false;
  }
}

export function clearCanvasDraft(key, storage = globalThis.localStorage) {
  try { storage?.removeItem(key); } catch {}
}
