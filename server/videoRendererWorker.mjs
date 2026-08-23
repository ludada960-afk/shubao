import { randomUUID } from 'node:crypto';
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
    'RENDER_REQUEST_STALE',
    'RENDER_REQUEST_INTEGRITY_INVALID',
    'RENDER_REQUEST_BUDGET_EXCEEDED',
    'EXPORT_JOB_OUTPUT_REQUIRED',
    'RENDER_PREFLIGHT_INVALID',
    'RENDER_PREFLIGHT_STALE',
    'RENDER_PREFLIGHT_REQUIRED',
  ]).has(code);
}

function boundedBatchLimit(value) {
  const requested = Number(value);
  return Number.isFinite(requested) ? Math.max(1, Math.min(20, Math.floor(requested))) : 1;
}

function publicBatchError(error) {
  return {
    errorCode: String(error?.code || 'RENDERER_WORKER_FAILED').slice(0, 120),
    errorMessage: String(error?.message || error?.code || 'renderer worker failed').slice(0, 240),
  };
}

function publicBatchJob(job, extra = {}) {
  return {
    jobId: String(job?.id || ''),
    state: String(job?.state || 'unknown'),
    attempt: Number.isFinite(Number(job?.attempt)) ? Number(job.attempt) : 0,
    providerSubmission: Boolean(job?.providerSubmission),
    billingMutation: Boolean(job?.billingMutation),
    ...extra,
  };
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
              : error.code.startsWith('RENDER_PREFLIGHT_') || error.code.startsWith('RENDER_REQUEST_')
                ? error.code : 'RENDER_RECONCILIATION_INVALID',
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

/**
 * Process a bounded set of waiting renderer jobs for one owner/project scope.
 * This is orchestration only: all state transitions, leases, retries and
 * output persistence remain owned by the existing single-job worker/store.
 * Failed jobs are intentionally excluded so retry remains an explicit action.
 */
export async function runVideoRendererWorkerBatch({
  store,
  ownerEmail,
  projectId,
  adapter,
  workerId,
  limit = 1,
  leaseMs = 30_000,
  now,
  pollAt = [],
  deadlineAt = '',
  retryAt = '',
  autoRecoverExpired = true,
  requirePreflight = false,
  leaseTokenFactory,
} = {}) {
  if (!store || typeof store.listExportJobs !== 'function'
    || typeof store.getExportJob !== 'function') {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer batch store contract is incomplete');
  }
  const owner = requiredString(ownerEmail, '账号');
  const project = requiredString(projectId, '项目');
  const worker = requiredString(workerId, 'worker');
  if (!adapter || typeof adapter.submit !== 'function') {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer adapter 未配置');
  }

  // Inspect a bounded page before selecting work. The page is deliberately
  // larger than the execution limit so terminal/failed jobs do not starve
  // older waiting jobs, while the store still caps the query at 50 rows.
  const inspectedJobs = store.listExportJobs({ ownerEmail: owner, projectId: project, limit: 50 });
  if (!Array.isArray(inspectedJobs)) {
    throw coded('RENDER_RECONCILIATION_INVALID', 'renderer batch store returned an invalid job list');
  }
  const waitingJobs = inspectedJobs.filter(job => job?.state === 'waiting_renderer');
  const executionLimit = boundedBatchLimit(limit);
  const selectedJobs = waitingJobs.slice(0, executionLimit);
  const selectedIds = new Set(selectedJobs.map(job => job.id));
  const skippedJobs = inspectedJobs
    .filter(job => !selectedIds.has(job.id))
    .map(job => publicBatchJob(job, {
      reason: job.state === 'waiting_renderer' ? 'batch_limit' : 'state_not_eligible',
    }));
  const results = [];
  let providerCalls = 0;
  let providerSubmission = false;
  let billingMutated = false;

  for (let index = 0; index < selectedJobs.length; index += 1) {
    const candidate = selectedJobs[index];
    try {
      // Keep token generation inside the per-job boundary. A broken injected
      // token source must not abort the rest of a bounded batch or claim work.
      const token = typeof leaseTokenFactory === 'function'
        ? leaseTokenFactory({ job: candidate, index })
        : randomUUID();
      const result = await runVideoRendererWorkerOnce({
        store,
        ownerEmail: owner,
        projectId: project,
        jobId: candidate.id,
        adapter,
        workerId: worker,
        leaseToken: token,
        leaseMs,
        now,
        pollAt,
        deadlineAt,
        retryAt,
        autoRecoverExpired,
        requirePreflight,
      });
      const current = result.job || store.getExportJob({
        ownerEmail: owner, projectId: project, jobId: candidate.id,
      });
      const calls = Number(result.providerCalls || 0);
      providerCalls += Number.isFinite(calls) && calls > 0 ? calls : 0;
      providerSubmission = providerSubmission || Boolean(current.providerSubmission);
      billingMutated = billingMutated || Boolean(current.billingMutation);
      results.push(publicBatchJob(current, {
        providerCalls: Number.isFinite(calls) && calls > 0 ? calls : 0,
        externalJobId: String(result.externalJobId || ''),
        errorCode: String(current.errorCode || ''),
      }));
    } catch (error) {
      const failure = publicBatchError(error);
      let current = candidate;
      try {
        current = store.getExportJob({ ownerEmail: owner, projectId: project, jobId: candidate.id });
      } catch {
        // Keep the pre-claim snapshot; the original error remains the result.
      }
      providerSubmission = providerSubmission || Boolean(current.providerSubmission);
      billingMutated = billingMutated || Boolean(current.billingMutation);
      results.push(publicBatchJob(current, {
        ...failure,
        providerCalls: 0,
      }));
    }
  }

  return {
    inspected: inspectedJobs.length,
    eligible: waitingJobs.length,
    processed: results.length,
    skipped: skippedJobs.length,
    skippedJobs,
    results,
    providerCalls,
    providerSubmission,
    billingMutated,
  };
}
