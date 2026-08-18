import {
  assertVideoRendererRequestIntegrity,
} from './videoRendererAdapter.mjs';
import {
  assertVideoRendererOutboxIntegrity,
  cancelVideoRendererOutboxEvent,
  claimVideoRendererOutboxEvent,
  completeVideoRendererOutboxEvent,
  failVideoRendererOutboxEvent,
} from './videoRendererOutbox.mjs';

const ACTIVE_STATUSES = new Set(['accepted', 'queued', 'running']);
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled']);

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw coded('RENDER_RECONCILIATION_INVALID', `${label}不能为空`);
  return value.trim();
}

function timestamp(value, label = '时间') {
  const normalized = value === undefined || value === null ? new Date().toISOString() : String(value);
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw coded('RENDER_RECONCILIATION_INVALID', `${label}无效`);
  }
  return normalized;
}

function normalizeProviderResult(result, request, externalJobId = '') {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer 回调无效');
  }
  const external = requiredString(result.externalJobId, '外部任务');
  const status = requiredString(result.status, '外部状态').toLowerCase();
  if (!ACTIVE_STATUSES.has(status) && !TERMINAL_STATUSES.has(status)) {
    throw coded('RENDER_RECONCILIATION_INVALID', '外部状态无效');
  }
  if (externalJobId && external !== externalJobId) {
    throw coded('RENDER_RECONCILIATION_INVALID', '外部任务与当前请求不匹配');
  }
  if (result.requestId !== request.requestId || result.requestHash !== request.requestHash) {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer 回调与当前请求不匹配');
  }
  return {
    externalJobId: external,
    status,
    errorCode: String(result.errorCode || '').trim(),
    errorMessage: String(result.errorMessage || '').trim(),
    outputAssetId: String(result.outputAssetId || '').trim(),
    outputUrl: String(result.outputUrl || '').trim(),
  };
}

function assertInputs(event, request) {
  try {
    assertVideoRendererOutboxIntegrity(event);
    assertVideoRendererRequestIntegrity(request, event.requestHash);
  } catch {
    throw coded('RENDER_RECONCILIATION_STALE', 'renderer reconciliation 引用已过期');
  }
  if (request.requestId !== event.requestId || request.requestHash !== event.requestHash) {
    throw coded('RENDER_RECONCILIATION_STALE', 'renderer reconciliation 请求不匹配');
  }
}

function terminalNoop(event) {
  return { event, externalJobId: '', trace: [{ step: 'noop-terminal', state: event.state }] };
}

function transitionFailure(event, { workerId, leaseToken, now, errorCode, errorMessage, retryAt }) {
  return failVideoRendererOutboxEvent(event, {
    workerId, leaseToken, now, errorCode, errorMessage, retryAt,
  });
}

/**
 * Run one provider-neutral reconciliation attempt. The adapter is injected so
 * tests can exercise submit/poll/retry semantics without calling a provider.
 * This function never writes billing or provider state; callers persist the
 * returned outbox event atomically with their own job transition.
 */
export async function reconcileVideoRendererAttempt({
  event,
  request,
  adapter,
  workerId,
  leaseToken,
  now,
  leaseMs = 30_000,
  pollAt = [],
  deadlineAt = '',
  retryAt = '',
} = {}) {
  assertInputs(event, request);
  if (!adapter || typeof adapter.submit !== 'function') {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer adapter 未配置');
  }
  if (['completed', 'canceled'].includes(event.state)) return terminalNoop(event);
  const startedAt = timestamp(now, '开始时间');
  const deadline = deadlineAt ? timestamp(deadlineAt, '超时时间') : '';
  const retry = retryAt ? timestamp(retryAt, '重试时间') : startedAt;
  let current = event;
  const trace = [];
  if (current.state === 'pending' || current.state === 'failed') {
    current = claimVideoRendererOutboxEvent(current, {
      workerId, leaseToken, leaseMs, now: startedAt,
    });
    trace.push({ step: 'claim', state: current.state, attempt: current.attempts });
  } else if (current.state !== 'processing') {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer outbox 当前状态不可执行');
  } else if (current.workerId !== workerId || current.leaseToken !== leaseToken) {
    throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer outbox worker lease 不匹配');
  }

  let submission;
  try {
    submission = normalizeProviderResult(await adapter.submit(request), request);
    trace.push({ step: 'submit', status: submission.status, externalJobId: submission.externalJobId });
  } catch (error) {
    if (error?.code === 'RENDER_RECONCILIATION_INVALID' || error?.code === 'RENDER_RECONCILIATION_STALE') {
      throw error;
    }
    const failed = transitionFailure(current, {
      workerId, leaseToken, now: startedAt, retryAt: retry,
      errorCode: 'RENDERER_SUBMIT_UNKNOWN',
      errorMessage: String(error?.message || 'renderer submit failed').trim(),
    });
    trace.push({ step: 'submit-failed', code: failed.lastErrorCode });
    return { event: failed, externalJobId: '', trace };
  }

  let externalJobId = submission.externalJobId;
  let status = submission.status;
  if (status === 'completed') {
    const completed = completeVideoRendererOutboxEvent(current, { workerId, leaseToken, now: startedAt });
    trace.push({ step: 'complete', state: completed.state });
    return {
      event: completed,
      externalJobId,
      outputAssetId: submission.outputAssetId,
      outputUrl: submission.outputUrl,
      trace,
    };
  }
  if (status === 'failed') {
    const failed = transitionFailure(current, {
      workerId, leaseToken, now: startedAt, retryAt: retry,
      errorCode: submission.errorCode || 'RENDERER_FAILED', errorMessage: submission.errorMessage,
    });
    trace.push({ step: 'failed', code: failed.lastErrorCode });
    return { event: failed, externalJobId, trace };
  }
  if (status === 'canceled') {
    const canceled = cancelVideoRendererOutboxEvent(current, {
      workerId, leaseToken, now: startedAt,
      errorCode: submission.errorCode || 'RENDERER_CANCELED', errorMessage: submission.errorMessage,
    });
    trace.push({ step: 'canceled', state: canceled.state });
    return { event: canceled, externalJobId, trace };
  }

  if (typeof adapter.poll !== 'function') return { event: current, externalJobId, trace };
  const pollTimes = Array.isArray(pollAt) ? pollAt : [];
  for (const pollTimeValue of pollTimes) {
    const pollTime = timestamp(pollTimeValue, '轮询时间');
    if (deadline && Date.parse(pollTime) >= Date.parse(deadline)) {
      const timedOut = transitionFailure(current, {
        workerId, leaseToken, now: pollTime, retryAt: retry,
        errorCode: 'RENDER_TIMEOUT', errorMessage: 'renderer poll deadline exceeded',
      });
      trace.push({ step: 'timeout', code: timedOut.lastErrorCode });
      return { event: timedOut, externalJobId, trace };
    }
    const result = normalizeProviderResult(await adapter.poll(request, externalJobId), request, externalJobId);
    externalJobId = result.externalJobId;
    status = result.status;
    trace.push({ step: 'poll', status, externalJobId });
    if (status === 'completed') {
      const completed = completeVideoRendererOutboxEvent(current, { workerId, leaseToken, now: pollTime });
      trace.push({ step: 'complete', state: completed.state });
      return {
        event: completed,
        externalJobId,
        outputAssetId: result.outputAssetId,
        outputUrl: result.outputUrl,
        trace,
      };
    }
    if (status === 'failed') {
      const failed = transitionFailure(current, {
        workerId, leaseToken, now: pollTime, retryAt: retry,
        errorCode: result.errorCode || 'RENDERER_FAILED', errorMessage: result.errorMessage,
      });
      trace.push({ step: 'failed', code: failed.lastErrorCode });
      return { event: failed, externalJobId, trace };
    }
    if (status === 'canceled') {
      const canceled = cancelVideoRendererOutboxEvent(current, {
        workerId, leaseToken, now: pollTime,
        errorCode: result.errorCode || 'RENDERER_CANCELED', errorMessage: result.errorMessage,
      });
      trace.push({ step: 'canceled', state: canceled.state });
      return { event: canceled, externalJobId, trace };
    }
  }
  return { event: current, externalJobId, trace };
}
