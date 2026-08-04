function abortError(error) {
  return error?.name === 'AbortError';
}

export function isTransientTaskSyncError(error) {
  if (!error || abortError(error)) return false;
  const status = Number(error.status || 0);
  if (status === 429 || status >= 500) return true;
  if (status === 0 && (error.code === 'API_ERROR' || error instanceof TypeError)) return true;
  return /(?:failed to fetch|network|networkerror|连接|网络|超时|timeout|econn|fetch)/i.test(
    String(error.message || ''),
  );
}

export function taskSyncMessage(error) {
  if (error?.status === 401 || error?.status === 403) return '登录状态已失效，请重新登录';
  if (isTransientTaskSyncError(error)) return '任务进度同步暂时中断，生成仍在后台继续';
  return '任务列表暂时无法刷新，请稍后重试';
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    }, { once: true });
  });
}

export async function withTransientTaskSyncRetry(operation, {
  signal,
  retries = 2,
  baseDelayMs = 250,
} = {}) {
  if (typeof operation !== 'function') throw new TypeError('operation must be a function');
  const maxRetries = Number.isSafeInteger(retries) && retries >= 0 ? retries : 0;
  let attempt = 0;
  while (true) {
    try {
      return await operation({ attempt, signal });
    } catch (error) {
      if (abortError(error) || !isTransientTaskSyncError(error) || attempt >= maxRetries) throw error;
      const delay = Math.min(2000, Math.max(0, baseDelayMs) * (2 ** attempt));
      attempt += 1;
      await wait(delay, signal);
    }
  }
}
