import crypto from 'node:crypto';

import { assertVideoExportManifestIntegrity } from './videoExportManifest.mjs';

const STATES = new Set(['waiting_renderer', 'rendering', 'failed', 'completed', 'canceled']);
const TRANSITIONS = Object.freeze({
  waiting_renderer: new Set(['rendering', 'canceled']),
  rendering: new Set(['failed', 'completed', 'canceled']),
  failed: new Set(['waiting_renderer', 'canceled']),
  completed: new Set(),
  canceled: new Set(),
});

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw coded('EXPORT_JOB_INVALID', `${label}不能为空`);
  return value.trim();
}

function timestamp(value, label = '时间') {
  const normalized = value === undefined || value === null ? new Date().toISOString() : String(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw coded('EXPORT_JOB_INVALID', `${label}无效`);
  return normalized;
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function payloadWithoutHash(job) {
  const { jobHash: _jobHash, ...payload } = job || {};
  return payload;
}

export function videoExportJobHash(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw coded('EXPORT_JOB_INTEGRITY_INVALID', '渲染任务无效');
  return crypto.createHash('sha256').update(canonicalJson(payloadWithoutHash(job))).digest('hex');
}

function assertManifest(manifest) {
  try {
    assertVideoExportManifestIntegrity(manifest);
  } catch (error) {
    throw coded('EXPORT_JOB_STALE', '渲染任务引用的导出清单无效');
  }
}

export function createVideoExportJob({
  id,
  ownerEmail,
  projectId,
  manifestId,
  manifest,
  createdAt,
} = {}) {
  const normalizedManifestId = requiredString(manifestId, '导出清单');
  assertManifest(manifest);
  const normalizedManifestHash = requiredString(manifest.manifestHash, '导出清单哈希');
  const created = timestamp(createdAt, '创建时间');
  const job = {
    id: requiredString(id, '渲染任务'),
    ownerEmail: requiredString(ownerEmail, '账号').toLowerCase(),
    projectId: requiredString(projectId, '项目'),
    manifestId: normalizedManifestId,
    manifestHash: normalizedManifestHash,
    state: 'waiting_renderer',
    attempt: 0,
    renderer: 'external-worker',
    providerSubmission: false,
    billingMutation: false,
    outputAssetId: '',
    outputUrl: '',
    errorCode: '',
    errorMessage: '',
    createdAt: created,
    updatedAt: created,
    startedAt: '',
    completedAt: '',
    canceledAt: '',
  };
  return { ...job, jobHash: videoExportJobHash(job) };
}

export function assertVideoExportJobIntegrity(job) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw coded('EXPORT_JOB_INTEGRITY_INVALID', '渲染任务无效');
  try {
    requiredString(job.id, '渲染任务');
    requiredString(job.ownerEmail, '账号');
    requiredString(job.projectId, '项目');
    requiredString(job.manifestId, '导出清单');
    requiredString(job.manifestHash, '导出清单哈希');
    requiredString(job.renderer, '渲染器');
  } catch {
    throw coded('EXPORT_JOB_INTEGRITY_INVALID', '渲染任务字段无效');
  }
  if (!STATES.has(job.state) || !Number.isInteger(job.attempt) || job.attempt < 0
    || job.providerSubmission !== false || job.billingMutation !== false
    || typeof job.jobHash !== 'string' || videoExportJobHash(job) !== job.jobHash) {
    throw coded('EXPORT_JOB_INTEGRITY_INVALID', '渲染任务完整性校验失败');
  }
  return true;
}

export function assertVideoExportJobCurrent(job, { manifestId, manifest } = {}) {
  assertVideoExportJobIntegrity(job);
  try {
    assertManifest(manifest);
  } catch {
    throw coded('EXPORT_JOB_STALE', '渲染任务引用的导出清单已过期');
  }
  if (requiredString(manifestId, '导出清单') !== job.manifestId || manifest.manifestHash !== job.manifestHash) {
    throw coded('EXPORT_JOB_STALE', '渲染任务引用的导出清单已过期');
  }
  return true;
}

export function transitionVideoExportJob(job, nextState, {
  now,
  errorCode = '',
  errorMessage = '',
  outputAssetId = '',
  outputUrl = '',
} = {}) {
  assertVideoExportJobIntegrity(job);
  if (!STATES.has(nextState) || !TRANSITIONS[job.state]?.has(nextState)) {
    throw coded('EXPORT_JOB_INVALID_TRANSITION', `不允许从 ${job.state} 转为 ${nextState}`);
  }
  const changedAt = timestamp(now, '更新时间');
  const next = { ...job, state: nextState, updatedAt: changedAt };
  if (nextState === 'rendering') {
    next.attempt += 1;
    next.startedAt = changedAt;
  }
  if (nextState === 'failed') {
    next.errorCode = requiredString(errorCode, '失败原因');
    next.errorMessage = String(errorMessage || '').trim();
  }
  if (nextState === 'waiting_renderer') {
    next.errorCode = '';
    next.errorMessage = '';
    next.startedAt = '';
  }
  if (nextState === 'completed') {
    if (typeof outputAssetId !== 'string' || !outputAssetId.trim()
      || typeof outputUrl !== 'string' || !outputUrl.trim()) {
      throw coded('EXPORT_JOB_OUTPUT_REQUIRED', '完成渲染必须提供输出资产和地址');
    }
    next.outputAssetId = outputAssetId.trim();
    next.outputUrl = outputUrl.trim();
    next.errorCode = '';
    next.errorMessage = '';
    next.completedAt = changedAt;
  }
  if (nextState === 'canceled') {
    next.errorCode = 'EXPORT_CANCELED';
    next.errorMessage = String(errorMessage || '用户取消渲染').trim();
    next.canceledAt = changedAt;
  }
  return { ...next, jobHash: videoExportJobHash(next) };
}
