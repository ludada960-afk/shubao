import { Upload } from 'tus-js-client';
import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';

const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

/* ═══ 批 CY-㊴ 之十四（2026-10-01）：上传体积上限的**客户端兜底** ══════════════════
   权威值来自 /api/video/capabilities 的 uploadLimits（服务端 mediaUploadLimits.mjs），
   下面这份只在"接口还没回来"时兜一下，两边刻意写成同一个数。
   ⚠️ 批 CY-㊴ 之前的注释写的是"服务端上限 50MB"——那正是本次线上事故的形状：
      服务端有三份上限（300 / 50 / 50），只改了一份。真相已搬到
      server/mediaUploadLimits.mjs，这里只保留兜底。 */
const MEDIA_UPLOAD_LIMIT_FALLBACK = Object.freeze({
  image: 10 * 1024 * 1024,
  video: 300 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
});

const KIND_LABEL = { image: '图片', video: '视频', audio: '音频' };

export function formatMediaSize(bytes) {
  const mb = Number(bytes || 0) / 1024 / 1024;
  return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB';
}

/** 超过上限就**上传前**拦下，并给一句人话（不再等服务端 413）。 */
export function describeUploadTooLarge(file, kind, limits = MEDIA_UPLOAD_LIMIT_FALLBACK) {
  const cap = Number(limits?.[kind] || 0);
  const size = Number(file?.size || 0);
  if (!cap || !size || size <= cap) return null;
  const label = KIND_LABEL[kind] || '素材';
  return `${label}「${file.name || '未命名'}」有 ${formatMediaSize(size)}，超过单文件上限 ${formatMediaSize(cap)}。`
    + '请压缩后再传，或换一个更小的文件。';
}

/* ═══ 批 CY-㊴ 之十四（2026-10-01）：把英文彻底挡在界面外 ═══════════════════════
   用户原话：「而且还有就是你的提示，为什么都是英文呢？肯定要用中文来回答呀。」
   截图里那条是 tus 的 DetailedError 原文：
     "tus: unexpected response while uploading chunk, originated from request
      (method: PATCH, url: …, response code: 413, response text: {…}, request id: n/a)"

   上次只判了 `error.status` / `Maximum size exceeded`，两条都没命中：
     ① tus 的 DetailedError **没有** `.status`，状态码在 `originalResponse.getStatus()`
        （见 node_modules/tus-js-client/lib.esm/error.js）—— 所以 `status` 恒为 0；
     ② 响应正文里是我们自己的中文 `error` 字段，不是 "Maximum size exceeded"。
   ⇒ `readableUploadError` 老老实实 `return raw`，把整段英文原样甩给用户。
   现在：先从 originalResponse 拿状态码与正文，正文里的中文 `error` 优先用；
   拿不到中文就退回按状态码给中文；最后一道只放行"确实是中文、且没裹着
   英文外壳"的消息（见下面 HAS_CHINESE / ENGLISH_SHELL 的注释）。 */

/** tus 的 DetailedError 把状态码和响应体挂在 originalResponse 上，不在 error 本身 */
function readTusResponse(error) {
  const response = error?.originalResponse;
  if (!response) return { status: 0, body: '' };
  let status = 0;
  try { status = Number(response.getStatus?.()) || 0; } catch { status = 0; }
  let body = '';
  try { body = String(response.getBody?.() || ''); } catch { body = ''; }
  return { status, body };
}

/** 服务端 413/415/401 的正文是 {"code":…,"error":"中文"} —— 那是权威口径，直接用 */
function readServerMessage(body) {
  const payload = parseServerBody(body);
  return String(payload?.error || payload?.message || '').trim();
}

function readServerCode(body) {
  return String(parseServerBody(body)?.code || '').trim();
}

function parseServerBody(body) {
  const text = String(body || '').trim();
  if (!text.startsWith('{')) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/* 判定"这段话是中文"：只要含 CJK 就算。 */
const HAS_CHINESE = /[一-鿿]/;
/* 判定"这段话裹着 tus 的英文外壳"：前缀、HTTP 术语、内部 URL 都在里面。
   ⚠️ 为什么中文判据**不够**：tus 的原文里**嵌着我们自己的中文**
   （`response text: {"error":"素材文件大小不符合要求"}`）——
   所以"含中文"为真，却仍然是一整段英文外壳。只查中文会把 URL 和
   `originated from request` 一起放行。两个判据必须**同时**用。 */
const ENGLISH_SHELL = /originated from request|response code|request id|^\s*tus:|\/api\/video\/uploads\//i;

/* 导出供门禁直接调用（test/video-upload-limit-and-message-1001.test.mjs）：
   这条逻辑的正确性靠"跑一遍真实的 tus 报错"来证明，不靠读源码猜。 */
export function readableUploadError(error, kind) {
  const label = KIND_LABEL[kind] || '素材';
  const raw = String(error?.message || error || '');
  const { status, body } = readTusResponse(error);
  const code = Number(error?.status || error?.statusCode || status || 0);

  /* ① 服务端自己说的中文最权威（它知道真实上限与该怎么改） */
  const fromServer = readServerMessage(body);
  if (fromServer && HAS_CHINESE.test(fromServer) && !ENGLISH_SHELL.test(fromServer)) return fromServer;

  /* ② 按状态码给中文兜底 */
  if (code === 413 || /Maximum size exceeded|too large/i.test(raw)) {
    const limit = MEDIA_UPLOAD_LIMIT_FALLBACK[kind];
    return `${label}体积超过上限${limit ? `（单个文件最大 ${formatMediaSize(limit)}）` : ''}，请压缩后再传。`;
  }
  if (code === 415) return `${label}格式不支持，请换一个常见格式的文件。`;
  if (code === 401) return '登录已失效，请重新登录后再上传。';
  if (code === 409 || code === 410) return '这次上传已中断，请重新选择文件上传。';

  /* ③ 兜底：只有"确实是中文、且没裹着英文外壳"才原样放行。
     用户原话：「为什么都是英文呢？肯定要用中文来回答呀。」
     —— 判据是"它**是**中文吗"，而不是"它**像不像**英文"：
     后者永远只能挡住已知的英文，漏一条就又漏一句出去。 */
  if (HAS_CHINESE.test(raw) && !ENGLISH_SHELL.test(raw)) return raw;
  return `${label}上传失败，请检查网络后重试；若反复失败，请换一个更小的文件。`;
}

export function createImmediateMediaPreview(file, urlApi = globalThis.URL) {
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  const url = file && urlApi?.createObjectURL ? urlApi.createObjectURL(file) : '';
  let revoked = false;
  return {
    url,
    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
    revoke() {
      if (!revoked && url) {
        revoked = true;
        urlApi?.revokeObjectURL?.(url);
      }
    },
  };
}

async function fetchUploadResult(uploadUrl) {
  const uploadId = new URL(uploadUrl, globalThis.location?.origin || 'http://localhost').pathname.split('/').filter(Boolean).pop();
  const token = getSessionToken();
  const response = await fetch(`/api/video/upload-results/${encodeURIComponent(uploadId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, '视频素材入库失败');
  const payload = await response.json();
  if (!payload.asset) throw new Error('素材上传完成但尚未入库，请重试');
  return payload.asset;
}

export function createVideoAssetUpload(file, kind, callbacks = {}) {
  /* 批 CY-㊴（2026-10-01）：**上传前**就拦体积。
     用户原话：「为什么我上传视频上传不了呢？」—— 截图里那条
     `413 / "Maximum size exceeded"` 是传到一半才被服务端打回来的，
     白等一轮；而且 tus 的英文原文被当成 toast 直接甩给用户。
     现在超限立刻给一句中文（含具体上限与怎么减小），不去打这个请求。 */
  const tooLarge = describeUploadTooLarge(file, kind, callbacks.limits);
  if (tooLarge) {
    const error = Object.assign(new Error(tooLarge), { status: 413, code: 'MEDIA_TOO_LARGE' });
    callbacks.onState?.('error');
    callbacks.onError?.(error);
    return { promise: Promise.reject(error), abort() {} };
  }
  if (callbacks.resumable === false) {
    const controller = new AbortController();
    let settled = false;
    let rejectPromise;
    const token = getSessionToken();
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      callbacks.onState?.('uploading');
      callbacks.onProgress?.({ bytesUploaded: 0, bytesTotal: file.size, progress: 0 });
      fetch('/api/video/assets', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-Video-Asset-Kind': kind,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
        signal: controller.signal,
      }).then(async response => {
        handleSessionResponse(response);
        if (!response.ok) throw await createApiError(response, '视频素材上传失败');
        const payload = await response.json();
        if (!payload.asset) throw new Error('素材上传完成但尚未入库，请重试');
        settled = true;
        callbacks.onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size, progress: 100 });
        callbacks.onState?.('completed');
        resolve(payload.asset);
      }).catch(error => {
        if (settled) return;
        settled = true;
        callbacks.onState?.(error?.name === 'AbortError' ? 'cancelled' : 'error');
        reject(error);
      });
    });
    return {
      promise,
      abort() {
        if (settled) return;
        settled = true;
        controller.abort();
        const error = Object.assign(new Error('素材上传已取消'), { name: 'AbortError' });
        rejectPromise?.(error);
      },
    };
  }
  let upload;
  let settled = false;
  let rejectPromise;
  const token = getSessionToken();
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    upload = new Upload(file, {
      endpoint: '/api/video/uploads',
      chunkSize: 5 * 1024 * 1024,
      retryDelays: RETRY_DELAYS,
      removeFingerprintOnSuccess: true,
      storeFingerprintForResuming: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      metadata: {
        filename: file.name || `${kind}-asset`,
        filetype: file.type || 'application/octet-stream',
        kind,
      },
      onProgress(bytesUploaded, bytesTotal) {
        callbacks.onProgress?.({
          bytesUploaded,
          bytesTotal,
          progress: bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0,
        });
      },
      onError(error) {
        if (settled) return;
        settled = true;
        callbacks.onState?.('error');
        /* 批 CY-㊴ 之十四：413 换成中文，不再把 tus 原文（"unexpected response while
           creating upload… Maximum size exceeded"）甩到界面上。
           状态码必须从 originalResponse.getStatus() 取 —— DetailedError 本身没有 .status。 */
        const { status } = readTusResponse(error);
        reject(Object.assign(new Error(readableUploadError(error, kind)), {
          status: Number(error?.status || status || 0),
          code: error?.code || readServerCode(readTusResponse(error).body),
          cause: error,
        }));
      },
      async onSuccess() {
        if (settled) return;
        try {
          const asset = await fetchUploadResult(upload.url);
          settled = true;
          callbacks.onState?.('completed');
          resolve(asset);
        } catch (error) {
          settled = true;
          callbacks.onState?.('error');
          reject(error);
        }
      },
    });
    callbacks.onState?.('uploading');
    upload.start();
  });
  return {
    promise,
    abort() {
      if (settled) return;
      settled = true;
      void upload?.abort(false);
      const error = Object.assign(new Error('素材上传已取消'), { name: 'AbortError' });
      rejectPromise?.(error);
    },
  };
}

export function uploadVideoAssetResumable(file, kind, callbacks) {
  return createVideoAssetUpload(file, kind, callbacks).promise;
}
