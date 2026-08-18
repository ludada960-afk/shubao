import { reconcileVideoRendererAttempt } from './videoRendererReconciliation.mjs';

function coded(code, message = code) {
  return Object.assign(new Error(message), { code });
}
function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw coded('RENDER_RECONCILIATION_INVALID', `${label}不能为空`);
  return value.trim();
}

function nowValue(value) {
  const normalized = typeof value === 'function' ? value() : value;
  const date = normalized === undefined || normalized === null ? new Date() : new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw coded('RENDER_RECONCILIATION_INVALID', 'worker 时间无效');
  return date.toISOString();
}

function leaseMatches(job, workerId, leaseToken) {
  return job?.state === 'rendering'
    && job.workerId === workerId
    && job.leaseToken === leaseToken;
}

function isExpired(job, at) {
  return Boolean(job?.leaseExpiresAt) && Date.parse(job.leaseExpiresAt) <= Date.parse(at);
}

function shouldFailClosed(code) {
  return new Set([
    'RENDER_RECONCILIATION_INVALID',
    'RENDER_RECONCILIATION_STALE',
    'RENDERER_RESPONSE_INVALID',
    'EXPORT_JOB_OUTPUT_REQUIRED',
    'RENDER_PREFLIGHT_INVALID',
    'RENDER_PREFLIGHT_STALE',
    'RENDER_PREFLIGHT_REQUIRED',
  ]).has(code);
}

/**
 * Execute one provider-neutral renderer worker turn. The store owns all
 * persistence and leases; the adapter is injected so this path can be tested
 * without making a provider request or mutating billing.
 */
export async function runVideoRendererWorkerOnce({
  store,
  ownerEmail,
  projectId,
  jobId,
  adapter,
  workerId,
  leaseToken,
  leaseMs = 30_000,
  now,
  pollAt = [],
  deadlineAt = '',
  retryAt = '',
  autoRecoverExpired = true,
  requirePreflight = false,
} = {}) {
  if (!store || typeof store.getExportJob !== 'function'
    || typeof store.claimExportJob !== 'function'
    || typeof store.getRendererAttempt !== 'function'
    || typeof store.persistRendererReconciliation !== 'function') {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer worker store contract is incomplete');
  }
  const owner = requiredString(ownerEmail, '账号');
  const project = requiredString(projectId, '项目');
  const job = requiredString(jobId, '任务');
  const worker = requiredString(workerId, 'worker');
  const token = requiredString(leaseToken, '租约令牌');
  const startedAt = nowValue(now);
  let current = store.getExportJob({ ownerEmail: owner, projectId: project, jobId: job });
  const trace = [];

  if (requirePreflight && !current.preflightHash) {
    throw coded('RENDER_PREFLIGHT_REQUIRED', '渲染任务没有严格预检证明，不能交接供应商');
  }

  if (current.state === 'completed' || current.state === 'canceled') {
    return { job: current, event: null, externalJobId: '', trace: [{ step: 'noop-terminal', state: current.state }], providerCalls: 0 };
  }
  if (current.state === 'failed') {
    throw coded('RENDERER_RETRY_REQUIRED', 'failed renderer jobs must be explicitly retried');
  }

  if (current.state === 'waiting_renderer') {
    current = store.claimExportJob({
      ownerEmail: owner, projectId: project, jobId: job,
      workerId: worker, leaseToken: token, leaseMs,
    });
    trace.push({ step: 'claim-job', attempt: current.attempt });
  } else if (current.state === 'rendering') {
    if (!leaseMatches(current, worker, token)) {
      throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer worker lease does not match the job');
    }
    if (isExpired(current, startedAt)) {
      if (!autoRecoverExpired) throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer worker lease has expired');
      current = store.recoverExportJob({ ownerEmail: owner, projectId: project, jobId: job, now: startedAt });
      trace.push({ step: 'recover-expired', state: current.state, errorCode: current.errorCode });
      if (current.state !== 'failed') throw coded('RENDER_RECONCILIATION_INVALID', 'expired renderer job was not recovered');
      current = store.transitionExportJob({
        ownerEmail: owner, projectId: project, jobId: job, nextState: 'waiting_renderer',
      });
      current = store.claimExportJob({
        ownerEmail: owner, projectId: project, jobId: job,
        workerId: worker, leaseToken: token, leaseMs,
      });
      trace.push({ step: 'reclaim-after-recovery', attempt: current.attempt });
    }
  } else {
    throw coded('RENDER_RECONCILIATION_INVALID', `unsupported renderer job state: ${current.state}`);
  }

  try {
    const context = store.getRendererAttempt({ ownerEmail: owner, projectId: project, jobId: job });
    if (!leaseMatches(context.job, worker, token)) {
      throw coded('RENDER_OUTBOX_LEASE_LOST', 'renderer worker lease was lost before reconciliation');
    }
    const outcome = await reconcileVideoRendererAttempt({
      event: context.event,
      request: context.request,
      adapter,
      workerId: worker,
      leaseToken: token,
      now: startedAt,
      leaseMs,
      pollAt,
      deadlineAt,
      retryAt,
    });
    const persisted = store.persistRendererReconciliation({
      ownerEmail: owner,
      projectId: project,
      jobId: job,
      event: outcome.event,
      workerId: worker,
      leaseToken: token,
      outputAssetId: outcome.outputAssetId || '',
      outputUrl: outcome.outputUrl || '',
      errorCode: outcome.event.lastErrorCode || '',
      errorMessage: outcome.event.lastError || '',
    });
    return {
      ...persisted,
      externalJobId: outcome.externalJobId || '',
      trace: [...trace, ...outcome.trace],
      providerCalls: outcome.trace.filter(step => step.step === 'submit' || step.step === 'poll').length,
    };
  } catch (error) {
    if (shouldFailClosed(error?.code)) {
      try {
        const latest = store.getExportJob({ ownerEmail: owner, projectId: project, jobId: job });
        if (leaseMatches(latest, worker, token)) {
          store.transitionExportJob({
            ownerEmail: owner,
            projectId: project,
            jobId: job,
            nextState: 'failed',
            workerId: worker,
            leaseToken: token,
            errorCode: error.code === 'EXPORT_JOB_OUTPUT_REQUIRED'
              ? 'RENDERER_OUTPUT_MISSING'
              : error.code.startsWith('RENDER_PREFLIGHT_') ? error.code : 'RENDER_RECONCILIATION_INVALID',
            errorMessage: String(error.message || error.code).slice(0, 2000),
          });
        }
      } catch {
        // Preserve the original validation error; lease loss is reported by the store.
      }
    }
    throw error;
  }
}
