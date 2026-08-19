import { getSessionToken } from './auth.js';
import { createApiError } from './apiError.js';

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function pathSegment(value, message) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 200 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error(message);
  }
  return encodeURIComponent(normalized);
}

function checkpointPathSegment(checkpointId) {
  return pathSegment(checkpointId, '请选择有效的未完成任务');
}

function projectPathSegment(projectId) {
  return pathSegment(projectId, '请选择有效的项目');
}

function canvasSessionPathSegment(sessionId) {
  return pathSegment(sessionId, '请选择有效的画布会话');
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

function jsonBody(value) {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value || {}) };
}

export async function createProject({ kind, title, idempotencyKey } = {}) {
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!key) throw new Error('创建任务标识缺失，请重试');
  const response = await requestJson('/api/projects', {
    method: 'POST',
    headers: { ...jsonBody().headers, 'Idempotency-Key': key },
    body: JSON.stringify({ kind, title }),
  }, '暂时无法创建任务');
  if (!response?.project?.id) throw new Error('任务信息暂时不可用，请稍后重试');
  return response.project;
}

export async function listProjects() {
  const response = await requestJson('/api/projects', {}, '暂时无法读取项目');
  return Array.isArray(response?.projects) ? response.projects : [];
}

export async function getProject(projectId) {
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}`,
    {},
    '暂时无法读取项目',
  );
  if (!response?.project?.id) throw new Error('项目信息暂时不可用，请稍后重试');
  return response.project;
}

export async function listProjectAssets(projectId, mediaKind = '') {
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets${mediaKind ? `?mediaKind=${encodeURIComponent(mediaKind)}` : ''}`,
    {},
    '暂时无法读取项目素材',
  );
  return Array.isArray(response?.assets) ? response.assets : [];
}

export async function getProjectAsset(projectId, projectAssetId) {
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets/${pathSegment(projectAssetId, '请选择有效的项目素材')}`,
    {},
    '暂时无法读取项目素材',
  );
  if (!response?.asset?.projectAssetId) throw new Error('项目素材暂时不可用，请稍后重试');
  return response.asset;
}

export async function createProjectVersion(projectId, payload = {}) {
  const response = await requestJson(`/api/projects/${projectPathSegment(projectId)}/versions`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法保存任务内容');
  if (!response?.version?.id) throw new Error('任务版本暂时不可用，请稍后重试');
  return response.version;
}

export async function createRecoveryCheckpoint(projectId, payload = {}) {
  const response = await requestJson(`/api/projects/${projectPathSegment(projectId)}/checkpoints`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法保留未完成任务');
  return checkpointFromResponse(response);
}

export async function completeProject(projectId, payload = {}) {
  const response = await requestJson(`/api/projects/${projectPathSegment(projectId)}/complete`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法完成任务');
  if (!response?.project?.id) throw new Error('任务完成信息暂时不可用，请稍后重试');
  return response.project;
}

function canvasSessionFromResponse(response) {
  const session = response?.session;
  if (!session?.id) throw new Error('画布会话暂时不可用，请稍后重试');
  return session;
}

export async function createCanvasSession({ projectId, baseVersionId, snapshot } = {}) {
  return canvasSessionFromResponse(await requestJson('/api/canvas-sessions', {
    method: 'POST',
    ...jsonBody({ projectId, baseVersionId, snapshot }),
  }, '暂时无法保存画布'));
}

export async function saveCanvasSession(sessionId, { expectedRevision, snapshot } = {}) {
  return canvasSessionFromResponse(await requestJson(
    `/api/canvas-sessions/${canvasSessionPathSegment(sessionId)}/save`,
    { method: 'POST', ...jsonBody({ expectedRevision, snapshot }) },
    '暂时无法保存画布',
  ));
}

export async function loadCanvasSession(sessionId) {
  return canvasSessionFromResponse(await requestJson(
    `/api/canvas-sessions/${canvasSessionPathSegment(sessionId)}`,
    {},
    '暂时无法恢复画布',
  ));
}
