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

export async function uploadVideoAsset(file, kind) {
  const capabilities = await fetchVideoCapabilities().catch(() => ({ uploadMode: 'tus' }));
  if (capabilities.uploadMode !== 'direct') return uploadVideoAssetResumable(file, kind);
  const { promise } = createVideoAssetUpload(file, kind, { resumable: false });
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
