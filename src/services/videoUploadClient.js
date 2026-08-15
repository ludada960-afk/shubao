import { Upload } from 'tus-js-client';
import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';

const RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

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
        reject(error);
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
