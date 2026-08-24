import { getSessionToken } from './auth.js';
import { createApiError } from './apiError.js';

function pathSegment(value, message) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 200 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new Error(message);
  }
  return encodeURIComponent(normalized);
}

const projectSegment = value => pathSegment(value, '请选择有效的视频项目');
const assetSegment = value => pathSegment(value, '请选择有效的项目素材');
const shotSegment = value => pathSegment(value, '请选择有效的分镜');
const manifestSegment = value => pathSegment(value, '请选择有效的配方快照');
const exportJobSegment = value => pathSegment(value, '请选择有效的渲染任务');
const skillRunSegment = value => pathSegment(value, '请选择有效的 SkillRun');
const checkpointSegment = value => pathSegment(value, '请选择有效的确认节点');
const guardSegment = value => pathSegment(value, '请选择有效的 SkillRun guard');
const stepSegment = value => pathSegment(value, '请选择有效的 SkillRun 步骤');
const memoryFactSegment = value => pathSegment(value, '请选择有效的项目记忆');
const audioTrackSegment = value => pathSegment(value, '请选择有效的音轨');
const timelineClipSegment = value => pathSegment(value, '请选择有效的时间线片段');

function signedHeaders(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

async function requestJson(path, options = {}, fallbackMessage = '视频项目请求失败') {
  const response = await fetch(path, {
    ...options,
    headers: signedHeaders(options.headers),
  });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
  return response.json();
}

function jsonBody(value) {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value || {}),
  };
}

function normalizeBudgetCap(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (!['number', 'string'].includes(typeof value)) {
    throw new Error('预算上限必须是非负整数积分');
  }
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error('预算上限必须是非负整数积分');
  }
  return normalized;
}

function requireValue(response, key, message) {
  const value = response?.[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value;
}

function workbenchBase(projectId) {
  return `/api/video/projects/${projectSegment(projectId)}/workbench`;
}

function shotBase(projectId, shotId) {
  return `${workbenchBase(projectId)}/shots/${shotSegment(shotId)}`;
}

function replayManifestBase(projectId) {
  return `${workbenchBase(projectId)}/replay-manifests`;
}

function exportManifestBase(projectId) {
  return `${workbenchBase(projectId)}/export-manifests`;
}

function exportJobBase(projectId) {
  return `${workbenchBase(projectId)}/export-jobs`;
}

function skillRunBase(projectId) {
  return `${workbenchBase(projectId)}/skill-runs`;
}

function idempotencyKey(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized && normalized.length <= 200 && !/[\u0000-\u001F\u007F]/.test(normalized)) return normalized;
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `clone-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getVideoWorkbench(projectId) {
  const response = await requestJson(workbenchBase(projectId), {}, '暂时无法读取视频项目');
  if (!response?.project?.id || !Array.isArray(response.assets)
    || !Array.isArray(response.shots) || !Array.isArray(response.timelineClips)) {
    throw new Error('视频项目数据暂时不可用，请稍后重试');
  }
  return response;
}

export async function getVideoWorkbenchPlan(projectId, {
  productId = 'seedance_standard', mode = 'smart', resolution = '720p', generateAudio = true,
  budgetCapPoints,
} = {}) {
  const normalizedBudgetCap = normalizeBudgetCap(budgetCapPoints);
  const params = new URLSearchParams({
    productId: String(productId),
    mode: String(mode),
    resolution: String(resolution),
    generateAudio: String(generateAudio !== false),
  });
  if (normalizedBudgetCap !== null) params.set('budgetCapPoints', String(normalizedBudgetCap));
  const response = await requestJson(`${workbenchBase(projectId)}/plan?${params.toString()}`, {}, '暂时无法检查视频生成计划');
  const plan = requireValue(response, 'plan', '视频生成计划暂时不可用，请稍后重试');
  return { ...plan, approval: response.approval || null };
}

export async function getVideoWorkbenchPreflight(projectId, {
  productId = 'seedance_standard', mode = 'smart', resolution = '720p', generateAudio = true,
  rightsConfirmations = [], moderation, storage, budgetCapPoints,
} = {}) {
  const normalizedBudgetCap = normalizeBudgetCap(budgetCapPoints);
  const response = await requestJson(`${workbenchBase(projectId)}/preflight`, {
    method: 'POST',
    ...jsonBody({
      productId,
      mode,
      resolution,
      generateAudio: generateAudio !== false,
      rightsConfirmations,
      ...(moderation ? { moderation } : {}),
      ...(storage ? { storage } : {}),
      ...(normalizedBudgetCap !== null ? { budgetCapPoints: normalizedBudgetCap } : {}),
    }),
  }, '暂时无法完成视频提交前预检');
  const result = requireValue(response, 'preflight', '视频提交前预检结果暂时不可用，请稍后重试');
  if (!result.preflight || typeof result.preflight !== 'object') throw new Error('视频提交前预检结果暂时不可用，请稍后重试');
  return result;
}

export async function approveVideoWorkbenchPlan(projectId, {
  productId = 'seedance_standard', mode = 'smart', resolution = '720p', generateAudio = true, planHash,
  budgetCapPoints,
} = {}) {
  const normalizedBudgetCap = normalizeBudgetCap(budgetCapPoints);
  const response = await requestJson(`${workbenchBase(projectId)}/plan/approve`, {
    method: 'POST',
    ...jsonBody({ productId, mode, resolution, generateAudio: generateAudio !== false, planHash,
      ...(normalizedBudgetCap !== null ? { budgetCapPoints: normalizedBudgetCap } : {}) }),
  }, '暂时无法确认视频生成计划');
  return requireValue(response, 'approval', '视频生成计划确认结果暂时不可用，请稍后重试');
}

export async function createVideoWorkbenchGenerationDraft(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/generation-draft`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法编译视频生成草稿');
  return requireValue(response, 'draft', '视频生成草稿暂时不可用，请稍后重试');
}

export async function getVideoWorkbenchGenerationDraft(projectId, planHash) {
  const normalizedHash = typeof planHash === 'string' ? planHash.trim() : '';
  const params = new URLSearchParams({ planHash: normalizedHash });
  const response = await requestJson(
    `${workbenchBase(projectId)}/generation-draft?${params.toString()}`,
    {},
    '暂时无法读取视频生成草稿',
  );
  if (response?.draft === null) return null;
  return requireValue(response, 'draft', '视频生成草稿暂时不可用，请稍后重试');
}

export async function getVideoProjectMemory(projectId) {
  const response = await requestJson(`${workbenchBase(projectId)}/memory`, {}, '暂时无法读取项目记忆');
  if (!Array.isArray(response?.memory)) throw new Error('项目记忆暂时不可用，请稍后重试');
  return response.memory;
}

export async function getVideoSkillTemplates(projectId) {
  const response = await requestJson(`${workbenchBase(projectId)}/skill-templates`, {}, '暂时无法读取视频工作流模板');
  if (!Array.isArray(response?.templates)) throw new Error('视频工作流模板暂时不可用，请稍后重试');
  return response.templates;
}

export async function upsertVideoProjectMemoryFact(projectId, key, payload = {}) {
  const response = await requestJson(
    `${workbenchBase(projectId)}/memory/${memoryFactSegment(key)}`,
    { method: 'PUT', ...jsonBody(payload) },
    '暂时无法保存项目记忆',
  );
  return requireValue(response, 'fact', '项目记忆暂时不可用，请稍后重试');
}

export async function removeVideoProjectMemoryFact(projectId, key, expectedRevision) {
  const response = await requestJson(
    `${workbenchBase(projectId)}/memory/${memoryFactSegment(key)}`,
    { method: 'DELETE', ...jsonBody({ expectedRevision }) },
    '暂时无法删除项目记忆',
  );
  return requireValue(response, 'fact', '项目记忆暂时不可用，请稍后重试');
}

export async function createWorkbenchAsset(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/assets`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法创建项目素材');
  return requireValue(response, 'asset', '项目素材暂时不可用，请稍后重试');
}

export async function importWorkbenchAssetVersion(projectId, assetId, payload = {}) {
  const response = await requestJson(
    `${workbenchBase(projectId)}/assets/${assetSegment(assetId)}/versions`,
    { method: 'POST', ...jsonBody(payload) },
    '暂时无法导入项目素材',
  );
  return requireValue(response, 'version', '项目素材版本暂时不可用，请稍后重试');
}

export async function importProjectAssetVersion(projectId, assetId, sourceProjectAssetRef, metadata = {}) {
  const response = await requestJson(
    `${workbenchBase(projectId)}/assets/${assetSegment(assetId)}/versions`,
    { method: 'POST', ...jsonBody({ sourceProjectAssetRef, metadata }) },
    '暂时无法导入已有项目素材',
  );
  return requireValue(response, 'version', '已有项目素材暂时不可用，请稍后重试');
}

export async function approveWorkbenchAssetVersion(projectId, assetId, payload = {}) {
  const response = await requestJson(
    `${workbenchBase(projectId)}/assets/${assetSegment(assetId)}/approve`,
    { method: 'POST', ...jsonBody(payload) },
    '暂时无法确认项目素材',
  );
  return requireValue(response, 'asset', '项目素材暂时不可用，请稍后重试');
}

export async function createStoryboardShot(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/shots`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法创建分镜');
  return requireValue(response, 'shot', '分镜信息暂时不可用，请稍后重试');
}

export async function updateStoryboardShot(projectId, shotId, payload = {}) {
  const response = await requestJson(shotBase(projectId, shotId), {
    method: 'PATCH',
    ...jsonBody(payload),
  }, '暂时无法更新分镜');
  return requireValue(response, 'shot', '分镜信息暂时不可用，请稍后重试');
}

export async function bindShotAssetVersion(projectId, shotId, payload = {}) {
  const response = await requestJson(`${shotBase(projectId, shotId)}/bindings`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法绑定分镜素材');
  return requireValue(response, 'binding', '分镜素材关系暂时不可用，请稍后重试');
}

export async function importJobCandidate(projectId, shotId, payload = {}) {
  const response = await requestJson(`${shotBase(projectId, shotId)}/candidates`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法导入视频候选');
  return requireValue(response, 'candidate', '视频候选暂时不可用，请稍后重试');
}

export async function selectShotCandidate(projectId, shotId, payload = {}) {
  const response = await requestJson(`${shotBase(projectId, shotId)}/select`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法选定视频候选');
  requireValue(response, 'shot', '分镜信息暂时不可用，请稍后重试');
  requireValue(response, 'candidate', '视频候选暂时不可用，请稍后重试');
  return response;
}

export async function applyShotCandidateToTimeline(projectId, shotId, payload = {}) {
  const response = await requestJson(`${shotBase(projectId, shotId)}/apply-candidate`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法把视频候选加入时间线');
  return requireValue(response, 'application', '时间线应用结果暂时不可用，请稍后重试');
}

export async function createShotRecoveryPlan(projectId, shotId, payload = {}) {
  const response = await requestJson(`${shotBase(projectId, shotId)}/recovery-plans`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法建立镜头恢复计划');
  return requireValue(response, 'plan', '镜头恢复计划暂时不可用，请稍后重试');
}

export async function prepareShotRecoveryExecution(projectId, planId) {
  const response = await requestJson(`${workbenchBase(projectId)}/recovery-plans/${pathSegment(planId, '请选择有效的镜头恢复计划')}/prepare`, {
    method: 'POST',
  }, '暂时无法校验镜头执行草稿');
  return requireValue(response, 'execution', '镜头执行草稿暂时不可用，请稍后重试');
}

export async function addTimelineClip(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/timeline/clips`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法加入时间线');
  return requireValue(response, 'clip', '时间线片段暂时不可用，请稍后重试');
}

export async function updateTimelineClip(projectId, clipId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/timeline/clips/${timelineClipSegment(clipId)}`, {
    method: 'PATCH',
    ...jsonBody(payload),
  }, '暂时无法更新时间线片段');
  return requireValue(response, 'clip', '时间线片段暂时不可用，请稍后重试');
}

export async function replaceTimelineClipCandidate(projectId, clipId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/timeline/clips/${timelineClipSegment(clipId)}/replace-candidate`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法应用新的视频候选');
  return requireValue(response, 'clip', '时间线片段暂时不可用，请稍后重试');
}

export async function createVideoAudioTrack(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/audio-tracks`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法创建视频音轨');
  return requireValue(response, 'track', '视频音轨暂时不可用，请稍后重试');
}

export async function updateVideoAudioTrack(projectId, trackId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/audio-tracks/${audioTrackSegment(trackId)}`, {
    method: 'PATCH',
    ...jsonBody(payload),
  }, '暂时无法更新视频音轨');
  return requireValue(response, 'track', '视频音轨暂时不可用，请稍后重试');
}

export async function createVideoReplayManifest(projectId, payload = {}) {
  const response = await requestJson(replayManifestBase(projectId), {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法保存视频创作配方');
  return requireValue(response, 'manifest', '视频创作配方暂时不可用，请稍后重试');
}

export async function getVideoReplayManifest(projectId, manifestId) {
  const response = await requestJson(
    `${replayManifestBase(projectId)}/${manifestSegment(manifestId)}`,
    {},
    '暂时无法读取视频创作配方',
  );
  return requireValue(response, 'manifest', '视频创作配方暂时不可用，请稍后重试');
}

export async function listVideoReplayManifests(projectId, { limit } = {}) {
  const suffix = limit == null ? '' : `?limit=${encodeURIComponent(limit)}`;
  const response = await requestJson(
    `${replayManifestBase(projectId)}${suffix}`,
    {},
    '暂时无法读取视频创作配方',
  );
  if (!Array.isArray(response?.manifests)) throw new Error('视频创作配方暂时不可用，请稍后重试');
  return response.manifests;
}

export async function createVideoExportManifest(projectId, options = {}) {
  const response = await requestJson(exportManifestBase(projectId), {
    method: 'POST',
    ...jsonBody({ options }),
  }, '暂时无法生成视频导出清单');
  return requireValue(response, 'manifest', '视频导出清单暂时不可用，请稍后重试');
}

export async function listVideoExportManifests(projectId, { limit } = {}) {
  const suffix = limit == null ? '' : `?limit=${encodeURIComponent(limit)}`;
  const response = await requestJson(
    `${exportManifestBase(projectId)}${suffix}`,
    {},
    '暂时无法读取视频导出清单',
  );
  if (!Array.isArray(response?.manifests)) throw new Error('视频导出清单暂时不可用，请稍后重试');
  return response.manifests;
}

export async function getVideoExportManifest(projectId, manifestId) {
  const response = await requestJson(
    `${exportManifestBase(projectId)}/${manifestSegment(manifestId)}`,
    {},
    '暂时无法读取视频导出清单',
  );
  return requireValue(response, 'manifest', '视频导出清单暂时不可用，请稍后重试');
}

export async function createVideoExportJob(projectId, manifestId, { preflight, requirePreflight = false } = {}) {
  const body = { manifestId };
  if (preflight !== undefined) body.preflight = preflight;
  if (requirePreflight === true) body.requirePreflight = true;
  const response = await requestJson(exportJobBase(projectId), {
    method: 'POST',
    ...jsonBody(body),
  }, '暂时无法交接视频渲染任务');
  return requireValue(response, 'job', '视频渲染任务暂时不可用，请稍后重试');
}

export async function listVideoExportJobs(projectId, { limit } = {}) {
  const suffix = limit == null ? '' : `?limit=${encodeURIComponent(limit)}`;
  const response = await requestJson(`${exportJobBase(projectId)}${suffix}`, {}, '暂时无法读取视频渲染任务');
  if (!Array.isArray(response?.jobs)) throw new Error('视频渲染任务暂时不可用，请稍后重试');
  return response.jobs;
}

export async function getVideoExportJob(projectId, jobId) {
  const response = await requestJson(
    `${exportJobBase(projectId)}/${exportJobSegment(jobId)}`,
    {},
    '暂时无法读取视频渲染任务',
  );
  return requireValue(response, 'job', '视频渲染任务暂时不可用，请稍后重试');
}

export async function recoverVideoExportJob(projectId, jobId) {
  const response = await requestJson(
    `${exportJobBase(projectId)}/${exportJobSegment(jobId)}/recover`,
    { method: 'POST', ...jsonBody({}) },
    '暂时无法恢复视频渲染任务',
  );
  return requireValue(response, 'job', '视频渲染任务暂时不可用，请稍后重试');
}

export async function retryVideoExportJob(projectId, jobId) {
  const response = await requestJson(
    `${exportJobBase(projectId)}/${exportJobSegment(jobId)}/retry`,
    { method: 'POST', ...jsonBody({}) },
    '暂时无法重试视频渲染任务',
  );
  return requireValue(response, 'job', '视频渲染任务暂时不可用，请稍后重试');
}

export async function cloneVideoReplayManifest(projectId, manifestId, {
  title = '',
  idempotencyKey: requestedKey,
} = {}) {
  const response = await requestJson(
    `${replayManifestBase(projectId)}/${manifestSegment(manifestId)}/clone`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey(requestedKey),
      },
      body: JSON.stringify({ title }),
    },
    '暂时无法复用视频创作配方',
  );
  requireValue(response, 'project', '复用后的视频项目暂时不可用，请稍后重试');
  if (!response?.workbench || !Array.isArray(response.workbench.assets)
    || !Array.isArray(response.workbench.shots)
    || !Array.isArray(response.workbench.timelineClips)) {
    throw new Error('复用后的视频工作流暂时不可用，请稍后重试');
  }
  return response;
}

export async function previewVideoSkillRun(projectId, spec, { idempotencyKey: requestedKey } = {}) {
  const response = await requestJson(`${skillRunBase(projectId)}/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey(requestedKey),
    },
    body: JSON.stringify({ spec }),
  }, '暂时无法预览视频 SkillRun');
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function previewVideoSkillTemplate(projectId, templateId, input = {}, {
  idempotencyKey: requestedKey,
} = {}) {
  const normalizedTemplateId = typeof templateId === 'string' ? templateId.trim() : '';
  if (!normalizedTemplateId || normalizedTemplateId.length > 128 || /[\u0000-\u001F\u007F]/.test(normalizedTemplateId)) {
    throw new Error('请选择有效的视频工作流模板');
  }
  const response = await requestJson(`${skillRunBase(projectId)}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey(requestedKey) },
    body: JSON.stringify({ templateId: normalizedTemplateId, input }),
  }, '暂时无法预览视频工作流模板');
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function getVideoSkillRun(projectId, runId) {
  const response = await requestJson(`${skillRunBase(projectId)}/${skillRunSegment(runId)}`, {},
    '暂时无法读取视频 SkillRun');
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function previewVideoSkillRunExecution(projectId, runId, stepCosts = {}) {
  const response = await requestJson(
    `${skillRunBase(projectId)}/${skillRunSegment(runId)}/execution-preview`,
    { method: 'POST', ...jsonBody({ stepCosts }) },
    '暂时无法预览视频 SkillRun 执行状态',
  );
  return requireValue(response, 'executionPreview', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function confirmVideoSkillCheckpoint(projectId, runId, checkpointId, expectedRevision) {
  const response = await requestJson(
    `${skillRunBase(projectId)}/${skillRunSegment(runId)}/checkpoints/${checkpointSegment(checkpointId)}/confirm`,
    { method: 'POST', ...jsonBody({ expectedRevision }) },
    '暂时无法确认视频 SkillRun 节点',
  );
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function confirmVideoSkillRunGuard(projectId, runId, guardId, expectedRevision) {
  const response = await requestJson(
    `${skillRunBase(projectId)}/${skillRunSegment(runId)}/guards/${guardSegment(guardId)}/confirm`,
    { method: 'POST', ...jsonBody({ expectedRevision }) },
    '暂时无法确认视频 SkillRun 条件',
  );
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}

export async function completeVideoSkillRunStep(projectId, runId, stepId, expectedRevision) {
  const response = await requestJson(
    `${skillRunBase(projectId)}/${skillRunSegment(runId)}/steps/${stepSegment(stepId)}/complete`,
    { method: 'POST', ...jsonBody({ expectedRevision }) },
    '暂时无法推进视频 SkillRun 步骤',
  );
  return requireValue(response, 'run', '视频 SkillRun 暂时不可用，请稍后重试');
}
export async function listProjectComments(projectId, { shotId, limit } = {}) {
  const params = new URLSearchParams();
  if (shotId) params.set('shotId', String(shotId));
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  const response = await requestJson(`${workbenchBase(projectId)}/comments${query ? `?${query}` : ''}`, {}, '暂时无法加载项目评论');
  return Array.isArray(response?.comments) ? response.comments : [];
}

export async function addProjectComment(projectId, payload = {}) {
  const response = await requestJson(`${workbenchBase(projectId)}/comments`, {
    method: 'POST',
    ...jsonBody(payload),
  }, '暂时无法保存项目评论');
  return requireValue(response, 'comment', '项目评论暂时不可用，请稍后重试');
}
