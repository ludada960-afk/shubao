function abortError() {
  if (typeof DOMException === 'function') return new DOMException('智能抠图已取消', 'AbortError');
  return Object.assign(new Error('智能抠图已取消'), { name: 'AbortError' });
}

function runtimeError(message, code = 'CANVAS_SEGMENTATION_RUNTIME_FAILED') {
  return Object.assign(new Error(message || '智能抠图组件运行失败'), { code });
}

function nextJobId() {
  return globalThis.crypto?.randomUUID?.() || `canvas-segmentation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function segmentationMasksToApi(masks = []) {
  return Promise.all(masks.map(async mask => {
    if (!mask?.promptId || !(mask.blob instanceof Blob) || mask.blob.type !== 'image/png') {
      throw new TypeError('valid PNG segmentation masks are required');
    }
    const bytes = new Uint8Array(await mask.blob.arrayBuffer());
    return {
      prompt_id: mask.promptId,
      data: `data:image/png;base64,${bytesToBase64(bytes)}`,
    };
  }));
}

export function createCanvasSegmentationRuntime({
  createWorker = () => new Worker(new URL('./canvasSegmentationWorker.js', import.meta.url), { type: 'module' }),
} = {}) {
  let worker = null;
  let warmed = false;
  let warmOperation = null;
  const jobs = new Map();

  function rejectAll(error) {
    for (const job of jobs.values()) {
      job.cleanup?.();
      job.reject(error);
    }
    jobs.clear();
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = createWorker();
    worker.onmessage = event => {
      const message = event?.data || {};
      const job = jobs.get(message.jobId);
      if (!job) return;
      if (message.type === 'progress') {
        job.onProgress?.(message);
        return;
      }
      jobs.delete(message.jobId);
      job.cleanup?.();
      if (message.type === 'ready') {
        warmed = true;
        job.resolve({ cached: Boolean(message.cached) });
        return;
      }
      if (message.type === 'result') {
        job.resolve((message.masks || []).map(mask => ({
          promptId: mask.promptId,
          blob: new Blob([mask.buffer], { type: 'image/png' }),
        })));
        return;
      }
      job.reject(runtimeError(message.message, message.code));
    };
    worker.onerror = event => {
      rejectAll(runtimeError(event?.message || '智能抠图 Worker 异常'));
      worker?.terminate?.();
      worker = null;
      warmed = false;
    };
    return worker;
  }

  function request(type, payload = {}, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    const target = ensureWorker();
    const jobId = nextJobId();
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (!jobs.has(jobId)) return;
        jobs.delete(jobId);
        target.postMessage({ type: 'cancel', jobId });
        reject(abortError());
      };
      const cleanup = () => signal?.removeEventListener?.('abort', onAbort);
      signal?.addEventListener?.('abort', onAbort, { once: true });
      jobs.set(jobId, { resolve, reject, onProgress, cleanup });
      target.postMessage({ type, jobId, ...payload });
    });
  }

  function startWarmOperation() {
    const operation = {
      lastProgress: null,
      listeners: new Set(),
      promise: null,
    };
    operation.promise = request('warm', {}, {
      onProgress(event) {
        operation.lastProgress = event;
        for (const listener of operation.listeners) listener(event);
      },
    }).finally(() => {
      if (warmOperation === operation) warmOperation = null;
    });
    warmOperation = operation;
    return operation;
  }

  function observeWarmOperation(operation, { signal, onProgress } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    if (onProgress) {
      operation.listeners.add(onProgress);
      if (operation.lastProgress) onProgress(operation.lastProgress);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        if (onProgress) operation.listeners.delete(onProgress);
        signal?.removeEventListener?.('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(abortError());
      };
      signal?.addEventListener?.('abort', onAbort, { once: true });
      operation.promise.then(
        value => {
          cleanup();
          resolve(value);
        },
        error => {
          cleanup();
          reject(error);
        },
      );
    });
  }

  return {
    prewarm({ signal, onProgress } = {}) {
      if (warmed) return Promise.resolve({ cached: true });
      return observeWarmOperation(warmOperation || startWarmOperation(), { signal, onProgress });
    },

    segment({ imageUrl, prompts, signal, onProgress } = {}) {
      if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
        return Promise.reject(new TypeError('imageUrl is required'));
      }
      if (!Array.isArray(prompts) || !prompts.length) {
        return Promise.reject(new TypeError('segmentation prompts are required'));
      }
      return request('segment', { imageUrl, prompts }, { signal, onProgress });
    },

    activeJobCount() {
      return jobs.size;
    },

    isWarm() {
      return warmed;
    },
  };
}

export const canvasSegmentationRuntime = createCanvasSegmentationRuntime();
