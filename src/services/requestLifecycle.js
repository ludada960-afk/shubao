export const DESIGN_DIRECTION_TIMEOUT_MS = 75_000;

function abortError(message = 'Request cancelled') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function createBoundedRequestLifecycle({
  timeoutMs = DESIGN_DIRECTION_TIMEOUT_MS,
  timeoutMessage = '图片分析超时，请检查网络后重试',
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  AbortControllerImpl = AbortController,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Request timeout must be a positive integer');
  }
  const controller = new AbortControllerImpl();
  let timedOut = false;
  let cleaned = false;
  const timer = setTimeoutImpl(() => {
    timedOut = true;
    controller.abort(abortError(timeoutMessage));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timeoutMessage,
    didTimeout: () => timedOut,
    cancel(reason = abortError()) {
      if (!controller.signal.aborted) controller.abort(reason);
    },
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      clearTimeoutImpl(timer);
    },
  };
}

export function requestFailureMessage(error, lifecycle, fallback = '加载失败，请稍后重试') {
  if (lifecycle?.didTimeout?.()) return lifecycle.timeoutMessage;
  if (error?.name === 'AbortError' || error?.code === 'VISUAL_ANALYSIS_ABORTED') return '';
  return error?.message || fallback;
}
