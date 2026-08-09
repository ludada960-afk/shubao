import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';

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
  const response = await fetch('/api/video/assets', {
    method: 'POST',
    headers: headers({
      'Content-Type': file.type || 'application/octet-stream',
      'X-Video-Asset-Kind': kind,
    }),
    body: file,
  });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, '视频素材上传失败');
  return (await response.json()).asset;
}

export function createVideoJob(input, idempotencyKey) {
  return request('/api/video/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}
