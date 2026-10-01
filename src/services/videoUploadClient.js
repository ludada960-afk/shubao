import { Upload } from 'tus-js-client';
import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';

const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

/* ═══ 批 CY-㊴（2026-10-01）：上传体积上限 ═══════════════════════════════════════
   用户截图里那条红字 `POST /api/video/uploads → 413, "Maximum size exceeded"` 就是它：
   服务端上限 50MB，手机拍一段就超了；而且 tus 的英文原文被当成 toast 直接甩给用户。
   权威值来自 /api/video/capabilities 的 uploadLimits（服务端 videoUploadService 的 LIMITS），
   下面这份只是"接口没回来之前"的兜底，两边刻意写成同一个数。 */
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

function readableUploadError(error, kind) {
  const status = Number(error?.status || error?.statusCode || 0);
  const raw = String(error?.message || error || '');
  if (status === 413 || /Maximum size exceeded/i.test(raw)) {
    const label = KIND_LABEL[kind] || '素材';
    return `${label}体积超过服务端上限，请压缩后再传。`;
  }
  return raw;
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
        /* 批 CY-㊴：413 换成中文，不再把 tus 原文（"unexpected response while creating
           upload… Maximum size exceeded"）甩到界面上。 */
        reject(Object.assign(new Error(readableUploadError(error, kind)), {
          status: Number(error?.status || 0),
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
