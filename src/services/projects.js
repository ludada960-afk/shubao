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

function productProfilePathSegment(profileId) {
  return pathSegment(profileId, '请选择有效的商品档案');
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

function productProfileFromResponse(response) {
  if (!response?.profile?.profileId) throw new Error('商品档案暂时不可用，请稍后重试');
  return response.profile;
}

export async function listProductProfiles({ status = '', limit = 100 } = {}) {
  const searchParams = new URLSearchParams();
  if (status) searchParams.set('status', status);
  if (limit != null) searchParams.set('limit', String(limit));
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await requestJson(`/api/product-profiles${suffix}`, {}, '暂时无法读取商品档案');
  return Array.isArray(response?.profiles) ? response.profiles : [];
}

export async function createProductProfile({ name, category = '', facts = {}, variants = [], assets = [], idempotencyKey } = {}) {
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!key) throw new Error('商品档案创建标识缺失，请重试');
  const response = await requestJson('/api/product-profiles', {
    method: 'POST',
    headers: { ...jsonBody().headers, 'Idempotency-Key': key },
    body: JSON.stringify({ name, category, facts, variants, assets }),
  }, '暂时无法创建商品档案');
  return productProfileFromResponse(response);
}

export async function getProductProfile(profileId) {
  const response = await requestJson(
    `/api/product-profiles/${productProfilePathSegment(profileId)}`,
    {},
    '暂时无法读取商品档案',
  );
  return productProfileFromResponse(response);
}

export async function updateProductProfile(profileId, { idempotencyKey, ...patch } = {}) {
  const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
  if (!key) throw new Error('商品档案更新标识缺失，请重试');
  const response = await requestJson(
    `/api/product-profiles/${productProfilePathSegment(profileId)}`,
    {
      method: 'PATCH',
      headers: { ...jsonBody().headers, 'Idempotency-Key': key },
      body: JSON.stringify(patch),
    },
    '暂时无法更新商品档案',
  );
  return productProfileFromResponse(response);
}

export async function archiveProductProfile(profileId) {
  const response = await requestJson(
    `/api/product-profiles/${productProfilePathSegment(profileId)}/archive`,
    { method: 'POST' },
    '暂时无法归档商品档案',
  );
  return productProfileFromResponse(response);
}

// 生成完成后把新资产追加挂到当前商品档案（只增弱关联，重复挂载自动去重）。
export async function attachProductProfileImages(profileId, images = []) {
  const assets = (Array.isArray(images) ? images : [])
    .map(image => ({
      assetId: String(image?.assetId || image?.id || '').trim(),
      role: String(image?.role || '').trim(),
    }))
    .filter(asset => asset.assetId)
    .slice(0, 128);
  if (!assets.length) throw new Error('没有可归档到商品档案的新素材');
  const response = await requestJson(
    `/api/product-profiles/${productProfilePathSegment(profileId)}/assets/attach`,
    { method: 'POST', ...jsonBody({ assets }) },
    '暂时无法归档到商品档案',
  );
  if (!response?.profile?.profileId) throw new Error('商品档案暂时不可用，请稍后重试');
  return response;
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

export async function listProjectAssetLibrary({ projectId = '', projectKind = '', mediaKind = '', productionState = '', query = '', limit = 200 } = {}) {
  const searchParams = new URLSearchParams();
  if (projectId) searchParams.set('projectId', projectId);
  if (projectKind) searchParams.set('projectKind', projectKind);
  if (mediaKind) searchParams.set('mediaKind', mediaKind);
  if (productionState) searchParams.set('productionState', productionState);
  if (query) searchParams.set('query', query);
  if (limit != null) searchParams.set('limit', String(limit));
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const response = await requestJson(`/api/project-assets${suffix}`, {}, '暂时无法读取项目素材库');
  return Array.isArray(response?.assets) ? response.assets : [];
}

export async function getProjectAsset(projectId, projectAssetId, purpose = 'read') {
  const normalizedPurpose = String(purpose || 'read').trim().toLowerCase() || 'read';
  if (!['read', 'reuse'].includes(normalizedPurpose)) {
    throw Object.assign(new Error('素材访问意图无效'), { code: 'PROJECT_ASSET_PURPOSE_INVALID' });
  }
  const query = normalizedPurpose === 'read' ? '' : `?purpose=${encodeURIComponent(normalizedPurpose)}`;
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets/${pathSegment(projectAssetId, '请选择有效的项目素材')}${query}`,
    {},
    '暂时无法读取项目素材',
  );
  if (!response?.asset?.projectAssetId) throw new Error('项目素材暂时不可用，请稍后重试');
  return response.asset;
}

export async function importVideoAssetToProject(projectId, {
  videoAssetId,
  role = 'reference',
  metadata = {},
} = {}) {
  const normalizedProjectId = projectPathSegment(projectId);
  const normalizedVideoAssetId = pathSegment(videoAssetId, '请选择有效的媒体素材');
  const response = await requestJson(
    `/api/projects/${normalizedProjectId}/assets/import-media`,
    {
      method: 'POST',
      ...jsonBody({ videoAssetId: decodeURIComponent(normalizedVideoAssetId), role, metadata }),
    },
    '暂时无法把媒体加入项目',
  );
  if (!response?.asset?.projectAssetId) throw new Error('项目媒体暂时不可用，请稍后重试');
  return response.asset;
}

export async function importImageAssetToProject(projectId, {
  imageAssetId,
  role = 'reference',
  metadata = {},
} = {}) {
  const normalizedProjectId = projectPathSegment(projectId);
  const normalizedImageAssetId = pathSegment(imageAssetId, '请选择有效的图片素材');
  const response = await requestJson(
    `/api/projects/${normalizedProjectId}/assets/import-media`,
    {
      method: 'POST',
      ...jsonBody({
        sourceKind: 'image',
        imageAssetId: decodeURIComponent(normalizedImageAssetId),
        role,
        metadata,
      }),
    },
    '暂时无法把图片加入项目',
  );
  if (!response?.asset?.projectAssetId) throw new Error('项目图片暂时不可用，请稍后重试');
  return response.asset;
}

export async function registerGeneratedAssetToProject(projectId, {
  versionId = null,
  assetId,
  stableUrl,
  role = 'generated',
  metadata = {},
} = {}) {
  const normalizedProjectId = projectPathSegment(projectId);
  const response = await requestJson(
    `/api/projects/${normalizedProjectId}/assets/register-generated`,
    {
      method: 'POST',
      ...jsonBody({ versionId, assetId, stableUrl, role, metadata }),
    },
    '暂时无法归档生成图片',
  );
  if (!response?.asset?.projectAssetId) throw new Error('生成图片项目资产暂时不可用，请稍后重试');
  return response.asset;
}

export async function getProjectAssetLineage(projectId, projectAssetId) {
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets/${pathSegment(projectAssetId, '请选择有效的项目素材')}/lineage`,
    {},
    '暂时无法读取素材关系',
  );
  if (!response?.lineage?.asset?.projectAssetId) throw new Error('素材关系暂时不可用，请稍后重试');
  return response.lineage;
}

export async function setProjectAssetRetention(projectId, projectAssetId, pinned) {
  if (typeof pinned !== 'boolean') throw new Error('请选择有效的素材保留设置');
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets/${pathSegment(projectAssetId, '请选择有效的项目素材')}/retention`,
    { method: 'PATCH', ...jsonBody({ pinned }) },
    '暂时无法更新素材保留设置',
  );
  if (!response?.asset?.projectAssetId) throw new Error('素材保留状态暂时不可用，请稍后重试');
  return response.asset;
}

export async function addToProjectAssetLibrary(projectId, projectAssetId, visibleInLibrary = true) {
  const pid = pathSegment(projectId, '请选择有效的项目');
  const aid = pathSegment(projectAssetId, '请选择有效的项目素材');
  const response = await requestJson(`/api/projects/${pid}/assets/${aid}/library`, {
    method: 'POST',
    ...jsonBody({ visibleInLibrary }),
  }, '暂时无法加入素材库');
  if (!response?.asset?.projectAssetId) throw new Error('素材暂时无法加入素材库，请稍后重试');
  return response.asset;
}

export async function setProjectAssetProductionState(projectId, projectAssetId, productionState) {
  const normalizedState = String(productionState || '').trim().toLowerCase();
  if (!['draft', 'candidate', 'delivered', 'archived'].includes(normalizedState)) {
    throw new Error('请选择有效的素材生产状态');
  }
  if (normalizedState === 'delivered') {
    throw Object.assign(new Error('已交付状态由系统确认，不能手动设置'), { code: 'PROJECT_ASSET_PRODUCTION_STATE_SYSTEM_ONLY' });
  }
  const response = await requestJson(
    `/api/projects/${projectPathSegment(projectId)}/assets/${pathSegment(projectAssetId, '请选择有效的项目素材')}/production-state`,
    { method: 'PATCH', ...jsonBody({ productionState: normalizedState }) },
    '暂时无法更新素材生产状态',
  );
  if (!response?.asset?.projectAssetId) throw new Error('素材生产状态暂时不可用，请稍后重试');
  return response.asset;
}

export async function createProjectVersion(projectId, payload = {}) {
  const { idempotencyKey = '', ...versionPayload } = payload || {};
  const headers = {
    ...jsonBody().headers,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
  const response = await requestJson(`/api/projects/${projectPathSegment(projectId)}/versions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(versionPayload),
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
