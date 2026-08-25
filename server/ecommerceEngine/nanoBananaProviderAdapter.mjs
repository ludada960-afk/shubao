const MAX_REFERENCES = 8;
const DEFAULT_TIMEOUT_MS = 900_000;
// 上游瞬时故障（网络中断 / 5xx / 429 / 超时）的指数退避重试序列。
// 每个延迟约按 4 倍增长并封顶，避免打爆已经过载的上游。
const DEFAULT_RETRY_DELAYS_MS = [500, 2_000, 8_000];
const MAX_RETRY_DELAY_MS = 30_000;

function providerError(message, code = 'NANO_BANANA_PROVIDER_ERROR', retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

function modelIds(payload) {
  const entries = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  return new Set(entries.map(item => String(item?.id || item?.name || '').replace(/^models\//, '')).filter(Boolean));
}

function outputImage(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts || []) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data && /^image\/(?:png|jpeg|webp)$/i.test(inline.mimeType || inline.mime_type || '')) {
        return { data: inline.data, contentType: inline.mimeType || inline.mime_type };
      }
    }
  }
  return null;
}

async function responseJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { error: { message: text.slice(0, 500) } }; }
}

function parseRetryAfter(response, nowMs) {
  const value = String(response?.headers?.get?.('retry-after') || '').trim();
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return null;
    return Math.min(Math.ceil(seconds), MAX_RETRY_DELAY_MS / 1_000);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, Math.ceil((timestamp - nowMs) / 1_000)), MAX_RETRY_DELAY_MS / 1_000);
}

export function createNanoBananaProviderAdapter({
  apiKey,
  baseUrl = 'https://api.change2pro.com',
  flashModel = 'gemini-2.5-flash-image',
  proModel = 'gemini-3-pro-image',
  generatedAssetStore,
  publicBaseUrl = 'http://127.0.0.1:3002',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)),
  nowImpl = Date.now,
} = {}) {
  if (!String(apiKey || '').trim()) throw new TypeError('Nano Banana API key is required');
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function' || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore is required');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  if (!Array.isArray(retryDelaysMs)
    || retryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)) {
    throw new TypeError('retryDelaysMs must contain non-negative safe integers');
  }
  if (typeof sleepImpl !== 'function' || typeof nowImpl !== 'function') {
    throw new TypeError('sleepImpl and nowImpl must be functions');
  }
  const root = String(baseUrl).replace(/\/+$/, '');
  const publicRoot = String(publicBaseUrl).replace(/\/+$/, '');
  const allowedModels = new Set([flashModel, proModel]);
  let validatedModels;

  function currentTimeMs() {
    const value = nowImpl();
    const timestamp = value instanceof Date ? value.getTime() : value;
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  }

  async function fetchWithDeadline(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw providerError('Nano Banana 生成超时，已自动重试仍超时，请稍后重试', 'NANO_BANANA_TIMEOUT', true);
      }
      throw providerError('Nano Banana 网络请求失败，将自动重试', 'PROVIDER_NETWORK_ERROR', true);
    } finally {
      clearTimeout(timer);
    }
  }

  // 对「网络错误 / 超时 / 429 / 5xx」做指数退避重试；4xx 业务错误不重试。
  async function withRetries(operation, { describe = '请求' } = {}) {
    let lastError = null;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;
        const retryable = error?.retryable === true
          || error?.name === 'AbortError'
          || (Number.isInteger(error?.status) && (error.status === 429 || error.status >= 500));
        if (!retryable || attempt >= retryDelaysMs.length) break;
        const backoffMs = Math.min(retryDelaysMs[attempt], MAX_RETRY_DELAY_MS);
        const retryAfterSeconds = Number(error?.retryAfter);
        const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
          ? Math.max(backoffMs, Math.min(retryAfterSeconds * 1_000, MAX_RETRY_DELAY_MS))
          : backoffMs;
        if (delayMs > 0) await sleepImpl(delayMs);
      }
    }
    throw lastError;
  }

  async function requestJson(url, options = {}, label = '请求') {
    return withRetries(async () => {
      const response = await fetchWithDeadline(url, options);
      const retryAfter = parseRetryAfter(response, currentTimeMs());
      const payload = await responseJson(response);
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = providerError(
          payload?.error?.message || `Nano Banana ${label}失败（HTTP ${response.status}）`,
          retryable ? 'NANO_BANANA_PROVIDER_BUSY' : 'NANO_BANANA_GENERATION_FAILED',
          retryable,
        );
        error.status = response.status;
        if (retryAfter !== null) error.retryAfter = retryAfter;
        throw error;
      }
      return payload;
    }, { describe: label });
  }

  async function validateModel(model) {
    if (!allowedModels.has(model)) throw providerError('不支持的 Nano Banana 模型', 'NANO_BANANA_MODEL_INVALID');
    if (!validatedModels) {
      const payload = await requestJson(
        `${root}/v1/models`,
        { headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey } },
        '模型目录读取',
      );
      validatedModels = modelIds(payload);
    }
    if (!validatedModels.has(model)) throw providerError(`Nano Banana 模型当前不可用：${model}`, 'NANO_BANANA_MODEL_UNAVAILABLE');
  }

  async function generate(model, body) {
    const paths = [`/v1/models/${encodeURIComponent(model)}:generateContent`, `/v1beta/models/${encodeURIComponent(model)}:generateContent`];
    let lastPayload = {};
    for (const path of paths) {
      try {
        return await requestJson(`${root}${path}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, '生成');
      } catch (error) {
        if (error?.status !== 404) throw error;
        lastPayload = { error: { message: error.message } };
      }
    }
    throw providerError(lastPayload?.error?.message || 'Nano Banana 生成接口不可用，请稍后重试', 'NANO_BANANA_GENERATION_ENDPOINT_UNAVAILABLE');
  }

  async function completed(jobId) {
    const stored = await generatedAssetStore.read(jobId);
    if (!stored) return { jobId, status: 'failed', error: '生成图片未能持久化', retryable: true };
    return { jobId, status: 'completed', outputUrl: `${publicRoot}/api/generated-assets/${encodeURIComponent(jobId)}` };
  }

  return {
    async submitEdit(request = {}) {
      const model = request?.modelRoute?.model;
      await validateModel(model);
      const references = (Array.isArray(request.inputAssets) ? request.inputAssets : []).slice(0, MAX_REFERENCES);
      const parts = references.map(asset => ({
        inlineData: { mimeType: asset.contentType || 'image/png', data: asset.buffer.toString('base64') },
      }));
      parts.push({ text: String(request.prompt || '').trim() });
      const payload = await generate(model, {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: request?.modelRoute?.ratio || '1:1',
            imageSize: request?.modelRoute?.resolution || request?.modelRoute?.imageSize || '2K',
          },
        },
      });
      const image = outputImage(payload);
      if (!image) throw providerError('Nano Banana 没有返回可用图片，请稍后重试', 'NANO_BANANA_EMPTY_OUTPUT', true);
      const asset = await generatedAssetStore.persistBuffer({
        buffer: Buffer.from(image.data.replace(/\s/g, ''), 'base64'),
        contentType: image.contentType,
        taskId: request.idempotencyKey || '',
        label: request?.modelRoute?.imageModel || 'nano-banana',
      });
      return { jobId: asset.id, status: 'submitted' };
    },
    poll: completed,
    pollUntilReady: completed,
  };
}
