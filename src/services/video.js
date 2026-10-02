import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';
export { createImmediateMediaPreview, createVideoAssetUpload } from './videoUploadClient.js';
import { createVideoAssetUpload, uploadVideoAssetResumable } from './videoUploadClient.js';

function headers(extra = {}) {
  const token = getSessionToken();
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: headers(options.headers) });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, '视频服务请求失败');
  return response.json();
}

export function fetchVideoCapabilities() {
  return request('/api/video/capabilities');
}

export function listVideoJobs() {
  return request('/api/video/jobs');
}

export function getVideoJob(id) {
  return request(`/api/video/jobs/${encodeURIComponent(id)}`);
}

/* 批 CY-㊴ 之十四（2026-10-01）：
   ① 把服务端公布的上限传下去 —— 画布这条路以前调 uploadVideoAssetResumable(file, kind)
      不带 callbacks，于是 createVideoAssetUpload 拿不到 limits，只能用兜底常量；
      服务端一旦改过上限，前端这道"上传前拦截"就是拿旧数字在拦。
   ② callbacks 透传，让画布能显示真实进度（一条 200MB 视频要传好几分钟，
      没有进度用户只会觉得"卡住了"）。 */
export async function uploadVideoAsset(file, kind, callbacks = {}) {
  const capabilities = await fetchVideoCapabilities().catch(() => ({ uploadMode: 'tus' }));
  const options = { ...callbacks, limits: callbacks.limits || capabilities?.uploadLimits };
  if (capabilities.uploadMode !== 'direct') return uploadVideoAssetResumable(file, kind, options);
  const { promise } = createVideoAssetUpload(file, kind, { ...options, resumable: false });
  return promise;
}

export function createVideoJob(input, idempotencyKey) {
  return request('/api/video/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function analyzeVideoPlan(input) {
  return request('/api/video/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
