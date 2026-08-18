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
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
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
  const leaseFields = [job.workerId, job.leaseToken, job.leaseExpiresAt];
  const leaseIsEmpty = leaseFields.every(value => value === '');
  const leaseIsComplete = leaseFields.every(value => typeof value === 'string' && value.trim())
    && !Number.isNaN(Date.parse(job.leaseExpiresAt));
  if (!STATES.has(job.state) || !Number.isInteger(job.attempt) || job.attempt < 0
    || job.providerSubmission !== false || job.billingMutation !== false
    || !leaseIsEmpty && !leaseIsComplete
    || job.state !== 'rendering' && !leaseIsEmpty
    || typeof job.workerId !== 'string' || typeof job.leaseToken !== 'string' || typeof job.leaseExpiresAt !== 'string'
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
  workerId = '',
  leaseToken = '',
} = {}) {
  assertVideoExportJobIntegrity(job);
  const changedAt = timestamp(now, '更新时间');
  const hasLease = Boolean(job.workerId || job.leaseToken || job.leaseExpiresAt);
  if (hasLease) {
    if (job.workerId !== String(workerId || '').trim() || job.leaseToken !== String(leaseToken || '').trim()) {
      throw coded('EXPORT_JOB_LEASE_LOST', '渲染任务租约不属于当前 worker');
    }
    if (Date.parse(job.leaseExpiresAt) <= Date.parse(changedAt)) {
      throw coded('EXPORT_JOB_LEASE_LOST', '渲染任务租约已过期');
    }
  }
  if (!STATES.has(nextState) || !TRANSITIONS[job.state]?.has(nextState)) {
    throw coded('EXPORT_JOB_INVALID_TRANSITION', `不允许从 ${job.state} 转为 ${nextState}`);
  }
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
  if (nextState !== 'rendering') {
    next.workerId = '';
    next.leaseToken = '';
    next.leaseExpiresAt = '';
  }
  return { ...next, jobHash: videoExportJobHash(next) };
}

function leaseDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 1_000 || duration > 15 * 60 * 1_000) {
    throw coded('EXPORT_JOB_INVALID', '租约时长必须在 1 秒到 15 分钟之间');
  }
  return Math.floor(duration);
}

function leaseExpiry(now, duration) {
  const expiry = new Date(Date.parse(now) + duration);
  if (!Number.isFinite(expiry.getTime())) throw coded('EXPORT_JOB_INVALID', '租约时间无效');
  return expiry.toISOString();
}

export function claimVideoExportJob(job, {
  workerId,
  leaseToken = crypto.randomUUID(),
  now,
  leaseMs = 30_000,
} = {}) {
  assertVideoExportJobIntegrity(job);
  if (job.state !== 'waiting_renderer') {
    throw coded('EXPORT_JOB_LEASE_BUSY', '渲染任务已被其他 worker 领取或已结束');
  }
  const worker = requiredString(workerId, 'worker');
  const token = requiredString(leaseToken, '租约令牌');
  const claimedAt = timestamp(now, '领取时间');
  const duration = leaseDuration(leaseMs);
  const next = {
    ...job,
    state: 'rendering',
    attempt: job.attempt + 1,
    startedAt: claimedAt,
    updatedAt: claimedAt,
    workerId: worker,
    leaseToken: token,
    leaseExpiresAt: leaseExpiry(claimedAt, duration),
    errorCode: '',
    errorMessage: '',
  };
  return { ...next, jobHash: videoExportJobHash(next) };
}

export function renewVideoExportJobLease(job, {
  workerId,
  leaseToken,
  now,
  leaseMs = 30_000,
} = {}) {
  assertVideoExportJobIntegrity(job);
  if (job.state !== 'rendering' || !job.workerId || !job.leaseToken || !job.leaseExpiresAt) {
    throw coded('EXPORT_JOB_LEASE_LOST', '渲染任务没有可续租的活动租约');
  }
  const worker = requiredString(workerId, 'worker');
  const token = requiredString(leaseToken, '租约令牌');
  const renewedAt = timestamp(now, '续租时间');
  if (job.workerId !== worker || job.leaseToken !== token) {
    throw coded('EXPORT_JOB_LEASE_LOST', '渲染任务租约不属于当前 worker');
  }
  if (Date.parse(job.leaseExpiresAt) <= Date.parse(renewedAt)) {
    throw coded('EXPORT_JOB_LEASE_LOST', '渲染任务租约已过期');
  }
  const next = {
    ...job,
    updatedAt: renewedAt,
    leaseExpiresAt: leaseExpiry(renewedAt, leaseDuration(leaseMs)),
  };
  return { ...next, jobHash: videoExportJobHash(next) };
}

export function recoverExpiredVideoExportJob(job, { now } = {}) {
  assertVideoExportJobIntegrity(job);
  if (job.state !== 'rendering' || !job.leaseExpiresAt) return job;
  const recoveredAt = timestamp(now, '恢复时间');
  if (Date.parse(job.leaseExpiresAt) > Date.parse(recoveredAt)) return job;
  const next = {
    ...job,
    state: 'failed',
    updatedAt: recoveredAt,
    errorCode: 'EXPORT_JOB_LEASE_EXPIRED',
    errorMessage: '渲染 worker 租约已过期，任务可重新领取',
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
  };
  return { ...next, jobHash: videoExportJobHash(next) };
}
