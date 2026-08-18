import crypto from 'node:crypto';

import {
  assertVideoRendererRequestIntegrity,
} from './videoRendererAdapter.mjs';

const STATES = new Set(['pending', 'processing', 'failed', 'completed', 'canceled']);

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw coded('RENDER_OUTBOX_INVALID', `${label}不能为空`);
  return value.trim();
}

function timestamp(value, label = '时间') {
  const normalized = value === undefined || value === null ? new Date().toISOString() : String(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw coded('RENDER_OUTBOX_INVALID', `${label}无效`);
  return normalized;
}

function leaseDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 1_000 || duration > 15 * 60 * 1_000) {
    throw coded('RENDER_OUTBOX_INVALID', '租约时长必须在 1 秒到 15 分钟之间');
  }
  return Math.floor(duration);
}

function leaseExpiry(now, duration) {
  const expiry = new Date(Date.parse(now) + duration);
  if (!Number.isFinite(expiry.getTime())) throw coded('RENDER_OUTBOX_INVALID', '租约时间无效');
  return expiry.toISOString();
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function payloadWithoutHash(event) {
  const { eventHash: _eventHash, ...payload } = event || {};
  return payload;
}

export function videoRendererOutboxHash(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox event 无效');
  }
  return crypto.createHash('sha256').update(canonicalJson(payloadWithoutHash(event))).digest('hex');
}

export function createVideoRendererOutboxEvent({ id, request, createdAt } = {}) {
  assertVideoRendererRequestIntegrity(request);
  const created = timestamp(createdAt, '创建时间');
  const event = {
    id: requiredString(id || request.requestId, '事件'),
    eventType: 'renderer.submit.requested',
    jobId: request.jobId,
    projectId: request.projectId,
    requestId: request.requestId,
    requestHash: request.requestHash,
    payload: request,
    state: 'pending',
    attempts: 0,
    nextAttemptAt: created,
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
    lastErrorCode: '',
    lastError: '',
    providerSubmission: false,
    billingMutation: false,
    createdAt: created,
    updatedAt: created,
  };
  return { ...event, eventHash: videoRendererOutboxHash(event) };
}

export function assertVideoRendererOutboxIntegrity(event, expectedHash = '') {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox event 无效');
  }
  try {
    requiredString(event.id, '事件');
    requiredString(event.jobId, '任务');
    requiredString(event.projectId, '项目');
    requiredString(event.requestId, '请求');
    requiredString(event.requestHash, '请求哈希');
    requiredString(event.createdAt, '创建时间');
    requiredString(event.updatedAt, '更新时间');
    assertVideoRendererRequestIntegrity(event.payload, event.requestHash);
  } catch {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox event 字段无效');
  }
  const leaseFields = [event.workerId, event.leaseToken, event.leaseExpiresAt];
  const leaseEmpty = leaseFields.every(value => value === '');
  const leaseComplete = leaseFields.every(value => typeof value === 'string' && value.trim())
    && !Number.isNaN(Date.parse(event.leaseExpiresAt));
  if (!STATES.has(event.state) || event.eventType !== 'renderer.submit.requested'
    || event.jobId !== event.payload.jobId || event.projectId !== event.payload.projectId
    || event.requestId !== event.payload.requestId || event.requestHash !== event.payload.requestHash
    || !Number.isInteger(event.attempts) || event.attempts < 0
    || event.providerSubmission !== false || event.billingMutation !== false
    || !leaseEmpty && !leaseComplete || event.state !== 'processing' && !leaseEmpty
    || typeof event.eventHash !== 'string' || videoRendererOutboxHash(event) !== event.eventHash
    || expectedHash && expectedHash !== event.eventHash) {
    throw coded('RENDER_OUTBOX_INTEGRITY_INVALID', 'renderer outbox event 完整性校验失败');
  }
  return true;
}

function assertActiveLease(event, workerId, leaseToken, now) {
  if (event.state !== 'processing' || !event.workerId || !event.leaseToken || !event.leaseExpiresAt) {
    throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer outbox event 没有活动租约');
  }
  const worker = requiredString(workerId, 'worker');
  const token = requiredString(leaseToken, '租约令牌');
  const changedAt = timestamp(now, '更新时间');
  if (event.workerId !== worker || event.leaseToken !== token
    || Date.parse(event.leaseExpiresAt) <= Date.parse(changedAt)) {
    throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer outbox event 租约已失效');
  }
  return changedAt;
}

export function claimVideoRendererOutboxEvent(event, {
  workerId,
  leaseToken = crypto.randomUUID(),
  now,
  leaseMs = 30_000,
} = {}) {
  assertVideoRendererOutboxIntegrity(event);
  if (!['pending', 'failed'].includes(event.state)) {
    throw coded('RENDER_OUTBOX_INVALID_TRANSITION', 'renderer outbox event 不可领取');
  }
  const claimedAt = timestamp(now, '领取时间');
  if (event.state === 'failed' && event.nextAttemptAt && Date.parse(event.nextAttemptAt) > Date.parse(claimedAt)) {
    throw coded('RENDER_OUTBOX_NOT_DUE', 'renderer outbox event 尚未到重试时间');
  }
  const worker = requiredString(workerId, 'worker');
  const token = requiredString(leaseToken, '租约令牌');
  const next = {
    ...event,
    state: 'processing',
    attempts: event.attempts + 1,
    workerId: worker,
    leaseToken: token,
    leaseExpiresAt: leaseExpiry(claimedAt, leaseDuration(leaseMs)),
    updatedAt: claimedAt,
    lastErrorCode: '',
    lastError: '',
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}

export function renewVideoRendererOutboxLease(event, {
  workerId,
  leaseToken,
  now,
  leaseMs = 30_000,
} = {}) {
  assertVideoRendererOutboxIntegrity(event);
  const renewedAt = assertActiveLease(event, workerId, leaseToken, now);
  const next = {
    ...event,
    leaseExpiresAt: leaseExpiry(renewedAt, leaseDuration(leaseMs)),
    updatedAt: renewedAt,
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}

export function failVideoRendererOutboxEvent(event, {
  workerId,
  leaseToken,
  now,
  errorCode,
  errorMessage = '',
  retryAt,
} = {}) {
  assertVideoRendererOutboxIntegrity(event);
  const failedAt = event.state === 'processing'
    ? assertActiveLease(event, workerId, leaseToken, now)
    : timestamp(now, '失败时间');
  const code = requiredString(errorCode, '失败原因');
  const next = {
    ...event,
    state: 'failed',
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
    lastErrorCode: code,
    lastError: String(errorMessage || '').trim(),
    nextAttemptAt: timestamp(retryAt || failedAt, '重试时间'),
    updatedAt: failedAt,
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}

export function recoverExpiredVideoRendererOutboxEvent(event, {
  now,
  retryAt,
} = {}) {
  assertVideoRendererOutboxIntegrity(event);
  if (event.state !== 'processing') return event;
  const recoveredAt = timestamp(now, '恢复时间');
  if (!event.leaseExpiresAt || Date.parse(event.leaseExpiresAt) > Date.parse(recoveredAt)) return event;
  const next = {
    ...event,
    state: 'failed',
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
    lastErrorCode: 'RENDER_OUTBOX_LEASE_EXPIRED',
    lastError: 'renderer outbox worker lease expired',
    nextAttemptAt: timestamp(retryAt || recoveredAt, '重试时间'),
    updatedAt: recoveredAt,
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}

export function completeVideoRendererOutboxEvent(event, { workerId, leaseToken, now } = {}) {
  assertVideoRendererOutboxIntegrity(event);
  const completedAt = event.state === 'processing'
    ? assertActiveLease(event, workerId, leaseToken, now)
    : timestamp(now, '完成时间');
  if (!['pending', 'processing'].includes(event.state)) {
    throw coded('RENDER_OUTBOX_INVALID_TRANSITION', 'renderer outbox event 不可完成');
  }
  const next = {
    ...event,
    state: 'completed',
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
    updatedAt: completedAt,
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}

export function cancelVideoRendererOutboxEvent(event, {
  workerId,
  leaseToken,
  now,
  errorCode = 'EXPORT_CANCELED',
  errorMessage = '导出任务已取消',
} = {}) {
  assertVideoRendererOutboxIntegrity(event);
  const canceledAt = event.state === 'processing'
    ? assertActiveLease(event, workerId, leaseToken, now)
    : timestamp(now, '取消时间');
  if (!['pending', 'processing', 'failed'].includes(event.state)) {
    throw coded('RENDER_OUTBOX_INVALID_TRANSITION', 'renderer outbox event 不可取消');
  }
  const next = {
    ...event,
    state: 'canceled',
    workerId: '',
    leaseToken: '',
    leaseExpiresAt: '',
    lastErrorCode: String(errorCode || '').trim() || 'EXPORT_CANCELED',
    lastError: String(errorMessage || '').trim(),
    updatedAt: canceledAt,
  };
  return { ...next, eventHash: videoRendererOutboxHash(next) };
}
