import { getSessionToken } from './auth.js';
import { createApiError } from './apiError.js';

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function checkpointPathSegment(checkpointId) {
  const value = typeof checkpointId === 'string' ? checkpointId.trim() : '';
  if (!value || value.length > 200 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new Error('请选择有效的未完成任务');
  }
  return encodeURIComponent(value);
}

async function requestJson(path, options = {}, fallbackMessage) {
  const response = await fetch(path, {
    ...options,
    headers: signedHeaders(options.headers),
  });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
  return response.json();
}

function checkpointFromResponse(response) {
  const checkpoint = response?.checkpoint;
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    throw new Error('未完成任务信息暂时不可用，请稍后重试');
  }
  return checkpoint;
}

export async function listRecoveryCheckpoints() {
  const response = await requestJson('/api/recovery-checkpoints', {}, '暂时无法读取未完成任务');
  return Array.isArray(response?.checkpoints) ? response.checkpoints : [];
}

export async function consumeRecoveryCheckpoint(checkpointId) {
  const checkpoint = await requestJson(
    `/api/recovery-checkpoints/${checkpointPathSegment(checkpointId)}/consume`,
    { method: 'POST' },
    '暂时无法继续未完成任务',
  );
  return checkpointFromResponse(checkpoint);
}

export async function dismissRecoveryCheckpoint(checkpointId) {
  const checkpoint = await requestJson(
    `/api/recovery-checkpoints/${checkpointPathSegment(checkpointId)}/dismiss`,
    { method: 'POST' },
    '暂时无法关闭未完成任务',
  );
  return checkpointFromResponse(checkpoint);
}
