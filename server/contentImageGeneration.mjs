/* 上游内容策略拒绝的翻译层（批 BA，doc 75 §三.2）—— 判据与保守边界写在那份文件的头部 */
import { CONTENT_REJECTION_MESSAGE, isContentRejectionError } from './contentRejection.mjs';

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new TypeError('tasks must be a non-empty array');
  }
  const ids = new Set();
  return tasks.map(task => {
    const id = typeof task?.id === 'string' ? task.id.trim() : '';
    if (!id || ids.has(id)) throw new TypeError('tasks must have a unique non-empty id');
    ids.add(id);
    return { ...task, id };
  });
}

function incompleteSetError(failedTasks, errors) {
  const failedIds = failedTasks.map(task => task.id);
  const cause = errors.get(failedIds.at(-1));
  /* ═══ 2026-09-24 批 BA：**内容拒绝**不许说成"服务不可用、我们会重试"（doc 75 §三.2）════════════
     原来这一句对任何失败都一样（「图片服务暂时不可用，系统已自动重试，额度将原路退回」+
     retryable:true）—— 内容违规时这句话同时在骗两件事：① 把"素材的问题"说成"服务的问题"，
     ② 说"系统已自动重试"（内容问题重试一百次也是同一个结果，而每次都在花上游的钱）。
     ⇒ 成因是内容拒绝时，换成能照着做的那句、并且**不重试**。其余失败一字未改。 */
  if (isContentRejectionError(cause)) {
    const error = new Error(CONTENT_REJECTION_MESSAGE);
    error.code = 'CONTENT_REJECTED';
    error.retryable = false;
    error.contentRejected = true;
    error.failedIds = failedIds;
    error.cause = cause;
    return error;
  }
  const error = new Error('图片服务暂时不可用，系统已自动重试，额度将原路退回');
  error.code = 'CONTENT_IMAGE_SET_INCOMPLETE';
  error.retryable = true;
  error.failedIds = failedIds;
  if (cause) error.cause = cause;
  return error;
}

export async function generateCompleteImageSet({
  tasks: rawTasks,
  execute,
  onComplete = () => {},
  onAttemptFailure = () => {},
  primaryAttempts = 3,
  recoveryAttempts = 3,
  primaryConcurrency = 5,
  recoveryConcurrency = 2,
  primaryBackoffMs = attempt => 2_000 * (attempt - 1),
  recoveryBackoffMs = attempt => 5_000 * (attempt - 1),
  delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  const tasks = normalizeTasks(rawTasks);
  if (typeof execute !== 'function') throw new TypeError('execute must be a function');
  if (typeof onComplete !== 'function' || typeof onAttemptFailure !== 'function') {
    throw new TypeError('generation callbacks must be functions');
  }
  if (typeof primaryBackoffMs !== 'function' || typeof recoveryBackoffMs !== 'function') {
    throw new TypeError('backoff values must be functions');
  }
  if (typeof delay !== 'function') throw new TypeError('delay must be a function');
  positiveInteger(primaryAttempts, 'primaryAttempts');
  positiveInteger(recoveryAttempts, 'recoveryAttempts');
  positiveInteger(primaryConcurrency, 'primaryConcurrency');
  positiveInteger(recoveryConcurrency, 'recoveryConcurrency');

  const completed = new Map();
  const errors = new Map();

  async function runPhase(phaseTasks, concurrency, attempts, backoffMs, phase) {
    const queue = [...phaseTasks];
    async function worker() {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task || completed.has(task.id)) continue;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          try {
            if (attempt > 1) await delay(backoffMs(attempt));
            const value = await execute(task, { phase, attempt });
            if (typeof value !== 'string' || value.trim() === '') {
              const empty = new Error(`Image generation returned no asset for ${task.id}`);
              empty.code = 'IMAGE_PROVIDER_EMPTY_RESPONSE';
              throw empty;
            }
            const entry = { id: task.id, url: value.trim() };
            completed.set(task.id, entry);
            errors.delete(task.id);
            await onComplete(entry, task);
            break;
          } catch (error) {
            errors.set(task.id, error);
            await onAttemptFailure({ task, phase, attempt, attempts, error });
            /* ═══ 2026-09-24 批 BA：**内容拒绝当场停手**，不进重试、也不进恢复相 ═══════════════════
               用户原话：「**为什么还要重新花钱呢**……没有低成本的过滤方案吗」。
               这一族的重试循环原来只看"还剩几次机会"，不看失败是什么：内容违规时它会把同一份
               素材再送 3 次（主相）+ 3 次（恢复相）—— 每次都可能计费，而结果必然是同一个。
               ⇒ 内容拒绝直接跳出这个任务的循环（下面「恢复相」也不再收它）。 */
            if (isContentRejectionError(error)) break;
          }
        }
      }
    }
    await Promise.all(Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker(),
    ));
  }

  await runPhase(tasks, primaryConcurrency, primaryAttempts, primaryBackoffMs, 'primary');
  /* 恢复相只收"还有救"的任务：被上游按内容政策拒掉的那些**不再重跑**（同一份素材、同一套政策，
     重跑只会再花一次钱）。判据与上面那个 break 同源，所以不会出现"主相停了、恢复相又跑"的漏洞。 */
  const missing = tasks.filter(task => !completed.has(task.id) && !isContentRejectionError(errors.get(task.id)));
  if (missing.length > 0) {
    await runPhase(missing, recoveryConcurrency, recoveryAttempts, recoveryBackoffMs, 'recovery');
  }

  const failed = tasks.filter(task => !completed.has(task.id));
  if (failed.length > 0) throw incompleteSetError(failed, errors);
  return tasks.map(task => completed.get(task.id));
}
