import crypto from 'node:crypto';

import {
  assertVideoExportJobIntegrity,
} from './videoExportJob.mjs';
import {
  assertVideoExportManifestIntegrity,
} from './videoExportManifest.mjs';

const REQUEST_STATES = new Set(['waiting_renderer', 'rendering']);
const RESPONSE_STATES = new Set(['accepted', 'queued', 'running', 'completed']);

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw coded('RENDER_REQUEST_INVALID', `${label}不能为空`);
  return value.trim();
}

function timestamp(value, label = '时间') {
  const normalized = value === undefined || value === null ? new Date().toISOString() : String(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) throw coded('RENDER_REQUEST_INVALID', `${label}无效`);
  return normalized;
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function budgetPoints(value, label) {
  const normalized = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw coded('RENDER_REQUEST_INTEGRITY_INVALID', `${label}无效`);
  }
  return normalized;
}

function budgetCap(value) {
  if (value === null || value === undefined || value === '') return null;
  return budgetPoints(value, '预算上限');
}

/**
 * Pull the immutable quote and cap from the strict preflight stored on the
 * export job. This is an attestation for the provider-neutral handoff. When
 * a provider later reports actual usage on its response, settlementUsage
 * enforces the same attested ceiling before anything downstream may treat
 * the attempt as settled.
 */
function budgetPolicyFromPreflight(job) {
  if (!job?.preflightHash) return null;
  let preflight;
  try {
    preflight = JSON.parse(job.preflightJson || '');
  } catch {
    throw coded('RENDER_REQUEST_STALE', '渲染请求的预检证明无法读取');
  }
  const attestation = preflight?.attestation;
  const requirements = attestation?.requirements;
  const quote = attestation?.plan?.quote;
  if (!requirements || !quote || requirements.enforce !== true) {
    throw coded('RENDER_REQUEST_STALE', '渲染请求缺少严格预算证明');
  }
  const estimatedPoints = budgetPoints(Number(quote.points), '预估积分');
  const maximumPoints = budgetPoints(Number(quote.maximumPoints ?? quote.points), '最高积分');
  const requestedCapPoints = budgetCap(requirements.budgetCapPoints);
  const withinCap = requestedCapPoints === null || estimatedPoints <= requestedCapPoints;
  if (!withinCap) {
    throw coded('RENDER_REQUEST_BUDGET_EXCEEDED', '渲染请求超过预算上限');
  }
  return {
    currency: 'ai_points',
    estimatedPoints,
    maximumPoints,
    requestedCapPoints,
    withinCap,
  };
}

function validBudgetPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.currency !== 'ai_points'
    || !Number.isSafeInteger(value.estimatedPoints) || value.estimatedPoints < 0
    || !Number.isSafeInteger(value.maximumPoints) || value.maximumPoints < 0
    || value.maximumPoints < value.estimatedPoints
    || !(value.requestedCapPoints === null
      || (Number.isSafeInteger(value.requestedCapPoints) && value.requestedCapPoints >= 0))
    || value.withinCap !== true
    || value.requestedCapPoints !== null && value.estimatedPoints > value.requestedCapPoints) {
    return false;
  }
  return true;
}

/**
 * Enforce the attested budget ceiling against a provider-reported usage
 * declaration at settlement time. Fails closed: an over-cap or malformed
 * usage never normalizes into an accepted renderer response.
 */
function settlementUsage(value, request) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw coded('RENDERER_RESPONSE_INVALID', '渲染器用量声明无效');
  }
  const raw = value.points;
  const points = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isSafeInteger(points) || points < 0) {
    throw coded('RENDERER_RESPONSE_INVALID', '渲染器用量积分无效');
  }
  const policy = request?.budgetPolicy;
  if (policy) {
    const capPoints = policy.requestedCapPoints === null
      ? policy.maximumPoints
      : Math.min(policy.maximumPoints, policy.requestedCapPoints);
    if (points > capPoints) {
      throw coded('RENDER_SETTLEMENT_BUDGET_EXCEEDED', `实际消耗 ${points} 积分超过预算上限 ${capPoints} 积分`);
    }
  }
  return { currency: 'ai_points', points };
}

function payloadWithoutHash(request) {
  const { requestHash: _requestHash, ...payload } = request || {};
  return payload;
}

export function videoRendererRequestHash(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw coded('RENDER_REQUEST_INTEGRITY_INVALID', '渲染请求无效');
  }
  return crypto.createHash('sha256').update(canonicalJson(payloadWithoutHash(request))).digest('hex');
}

export function buildVideoRendererRequest({ job, manifest, now } = {}) {
  try {
    assertVideoExportJobIntegrity(job);
    assertVideoExportManifestIntegrity(manifest, job.manifestHash);
  } catch {
    throw coded('RENDER_REQUEST_STALE', '渲染请求引用的任务或清单已过期');
  }
  if (!REQUEST_STATES.has(job.state)) throw coded('RENDER_REQUEST_NOT_READY', '任务尚未进入可渲染状态');
  const attempt = job.state === 'waiting_renderer' ? job.attempt + 1 : job.attempt;
  if (!Number.isInteger(attempt) || attempt < 1) throw coded('RENDER_REQUEST_INVALID', '渲染尝试次数无效');
  const requestId = `${job.id}:attempt:${attempt}`;
  const request = {
    schemaVersion: 1,
    kind: 'video-render-request',
    requestId,
    idempotencyKey: requestId,
    jobId: job.id,
    projectId: job.projectId,
    manifestId: job.manifestId,
    manifestHash: manifest.manifestHash,
    jobHash: job.jobHash,
    jobState: job.state,
    attempt,
    renderer: job.renderer,
    ...(job.preflightHash ? { preflightHash: job.preflightHash, preflightStatus: 'ready' } : {}),
    ...(job.preflightHash ? { budgetPolicy: budgetPolicyFromPreflight(job) } : {}),
    options: copy(manifest.options),
    timeline: copy(manifest.timeline),
    audio: copy(manifest.audio),
    providerSubmission: false,
    billingMutation: false,
    createdAt: timestamp(now, '请求时间'),
  };
  return { ...request, requestHash: videoRendererRequestHash(request) };
}

export function assertVideoRendererRequestIntegrity(request, expectedHash = '') {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw coded('RENDER_REQUEST_INTEGRITY_INVALID', '渲染请求无效');
  }
  try {
    requiredString(request.requestId, '请求');
    requiredString(request.idempotencyKey, '幂等键');
    requiredString(request.jobId, '任务');
    requiredString(request.projectId, '项目');
    requiredString(request.manifestId, '清单');
    requiredString(request.manifestHash, '清单哈希');
    requiredString(request.jobHash, '任务哈希');
    requiredString(request.renderer, '渲染器');
    requiredString(request.createdAt, '创建时间');
  } catch {
    throw coded('RENDER_REQUEST_INTEGRITY_INVALID', '渲染请求字段无效');
  }
  const expectedRequestId = `${request.jobId}:attempt:${request.attempt}`;
  const preflightFieldsValid = request.preflightHash === undefined
    ? (request.preflightStatus === undefined || request.preflightStatus === 'not_run')
    : /^[a-f0-9]{64}$/i.test(String(request.preflightHash)) && request.preflightStatus === 'ready';
  const budgetPolicyValid = request.budgetPolicy === undefined || validBudgetPolicy(request.budgetPolicy);
  if (request.schemaVersion !== 1 || request.kind !== 'video-render-request'
    || !REQUEST_STATES.has(request.jobState) || request.jobState !== 'rendering'
    || !Number.isInteger(request.attempt) || request.attempt < 1
    || request.requestId !== expectedRequestId || request.idempotencyKey !== request.requestId
    || !/^[a-f0-9]{64}$/i.test(request.manifestHash) || !/^[a-f0-9]{64}$/i.test(request.jobHash)
    || !request.options || typeof request.options !== 'object' || Array.isArray(request.options)
    || !request.timeline || typeof request.timeline !== 'object' || !Array.isArray(request.timeline.clips)
    || !request.audio || typeof request.audio !== 'object' || !Array.isArray(request.audio.tracks)
    || !preflightFieldsValid
    || !budgetPolicyValid
    || request.providerSubmission !== false || request.billingMutation !== false
    || typeof request.requestHash !== 'string' || videoRendererRequestHash(request) !== request.requestHash
    || expectedHash && expectedHash !== request.requestHash) {
    throw coded('RENDER_REQUEST_INTEGRITY_INVALID', '渲染请求完整性校验失败');
  }
  return true;
}

function normalizeProviderResponse(response, request) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw coded('RENDERER_RESPONSE_INVALID', '渲染器返回值无效');
  }
  const externalJobId = requiredString(response.externalJobId, '外部任务');
  const status = requiredString(response.status, '外部状态').toLowerCase();
  if (!RESPONSE_STATES.has(status)) throw coded('RENDERER_RESPONSE_INVALID', '外部状态无效');
  if (response.requestId !== undefined && response.requestId !== request.requestId) {
    throw coded('RENDERER_RESPONSE_INVALID', '外部回调请求不匹配');
  }
  if (response.requestHash !== undefined && response.requestHash !== request.requestHash) {
    throw coded('RENDERER_RESPONSE_INVALID', '外部回调哈希不匹配');
  }
  const normalized = {
    externalJobId,
    status,
    requestId: request.requestId,
    requestHash: request.requestHash,
  };
  for (const field of ['outputAssetId', 'outputUrl', 'errorCode', 'errorMessage']) {
    if (response[field] !== undefined) normalized[field] = String(response[field] || '').trim();
  }
  const usage = settlementUsage(response.usage, request);
  if (usage) normalized.usage = usage;
  return normalized;
}

export function createVideoRendererAdapter({
  name = 'external-worker',
  capabilities = {},
  submit,
  poll,
  cancel,
} = {}) {
  const adapterName = requiredString(name, '渲染器名称');
  const invoke = (handler, code, ...args) => {
    if (typeof handler !== 'function') throw coded(code, '渲染器尚未配置供应商实现');
    return handler(...args);
  };
  return Object.freeze({
    name: adapterName,
    capabilities: copy(capabilities || {}),
    async submit(request) {
      assertVideoRendererRequestIntegrity(request);
      const response = await invoke(submit, 'RENDERER_NOT_CONFIGURED', request);
      return normalizeProviderResponse(response, request);
    },
    async poll(request, externalJobId) {
      assertVideoRendererRequestIntegrity(request);
      const id = requiredString(externalJobId, '外部任务');
      return invoke(poll, 'RENDERER_POLL_NOT_CONFIGURED', request, id);
    },
    async cancel(request, externalJobId) {
      assertVideoRendererRequestIntegrity(request);
      const id = requiredString(externalJobId, '外部任务');
      return invoke(cancel, 'RENDERER_CANCEL_NOT_CONFIGURED', request, id);
    },
  });
}
