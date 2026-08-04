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
  const missing = tasks.filter(task => !completed.has(task.id));
  if (missing.length > 0) {
    await runPhase(missing, recoveryConcurrency, recoveryAttempts, recoveryBackoffMs, 'recovery');
  }

  const failed = tasks.filter(task => !completed.has(task.id));
  if (failed.length > 0) throw incompleteSetError(failed, errors);
  return tasks.map(task => completed.get(task.id));
}
