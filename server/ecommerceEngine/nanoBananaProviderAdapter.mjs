const MAX_REFERENCES = 8;
const DEFAULT_TIMEOUT_MS = 900_000;

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

export function createNanoBananaProviderAdapter({
  apiKey,
  baseUrl = 'https://api.change2pro.com',
  flashModel = 'gemini-2.5-flash-image',
  proModel = 'gemini-3-pro-image',
  generatedAssetStore,
  publicBaseUrl = 'http://127.0.0.1:3002',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!String(apiKey || '').trim()) throw new TypeError('Nano Banana API key is required');
  if (!generatedAssetStore || typeof generatedAssetStore.persistBuffer !== 'function' || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore is required');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  const root = String(baseUrl).replace(/\/+$/, '');
  const publicRoot = String(publicBaseUrl).replace(/\/+$/, '');
  const allowedModels = new Set([flashModel, proModel]);
  let validatedModels;

  async function fetchWithDeadline(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') throw providerError('Nano Banana 生成超时，请稍后重试', 'NANO_BANANA_TIMEOUT', true);
      throw providerError('Nano Banana 网络请求失败', 'PROVIDER_NETWORK_ERROR', true);
    } finally {
      clearTimeout(timer);
    }
  }

  async function validateModel(model) {
    if (!allowedModels.has(model)) throw providerError('不支持的 Nano Banana 模型', 'NANO_BANANA_MODEL_INVALID');
    if (!validatedModels) {
      const response = await fetchWithDeadline(`${root}/v1/models`, { headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey } });
      const payload = await responseJson(response);
      if (!response.ok) throw providerError(payload?.error?.message || '无法读取 Nano Banana 模型目录', 'NANO_BANANA_MODEL_CATALOG_ERROR', response.status >= 500);
      validatedModels = modelIds(payload);
    }
    if (!validatedModels.has(model)) throw providerError(`Nano Banana 模型当前不可用：${model}`, 'NANO_BANANA_MODEL_UNAVAILABLE');
  }

  async function generate(model, body) {
    const paths = [`/v1/models/${encodeURIComponent(model)}:generateContent`, `/v1beta/models/${encodeURIComponent(model)}:generateContent`];
    let lastPayload = {};
    for (const path of paths) {
      const response = await fetchWithDeadline(`${root}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      lastPayload = await responseJson(response);
      if (response.ok) return lastPayload;
      if (response.status !== 404) throw providerError(lastPayload?.error?.message || 'Nano Banana 生成失败', 'NANO_BANANA_GENERATION_FAILED', response.status >= 429);
    }
    throw providerError(lastPayload?.error?.message || 'Nano Banana 生成接口不可用', 'NANO_BANANA_GENERATION_ENDPOINT_UNAVAILABLE');
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
      if (!image) throw providerError('Nano Banana 没有返回可用图片', 'NANO_BANANA_EMPTY_OUTPUT', true);
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
