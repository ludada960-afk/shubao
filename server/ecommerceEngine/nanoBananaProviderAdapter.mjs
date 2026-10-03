/* ⚠️ 上游模型名的**唯一声明处**（2026-09-15 第 18 轮）。
   起因是一次真实故障：`modelCatalog.selectGenerationModel` 里写死了
   'gemini-2.5-flash-image'，而供应商已经把它下架、换成了 'gemini-3.1-flash-image'；
   适配器又用自己的 env 默认值做白名单校验 —— 两处各写一份，谁也不知道对方写的是什么，
   结果就是「目录说调 A、适配器只认 B」，用户看到「模型当前不可用」。
   → 现在两个名字只在这里写一遍：目录**引用**它，适配器默认值**引用**它。
   （本文件**刻意不引用站内业务模块**，所以目录反向引用它不会造成循环依赖 ——
     批 BA 加的下面这条 import 也守同一个纪律：contentRejection.mjs 是**零依赖的叶子模块**。） */
import { CONTENT_REJECTION_MESSAGE, classifyContentRejection } from '../contentRejection.mjs';

export const NANO_UPSTREAM_MODELS = Object.freeze({
  flash: 'gemini-3.1-flash-image',
  pro: 'gemini-3-pro-image',
});

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
  /* 默认用**国内专用**端点：本站服务大陆用户，而供应商的默认端点
     `api.change2pro.com` 在大陆被 DNS 污染（解析到 Meta 的 IP、TCP 不通，实测 15.2s 超时），
     配成它等于每次生成先白等一轮失败再切备用。国内端点由供应商明示。
     2026-10-03 复测：官方新接入地址 `gateway.change2pro.com` 在大陆**同样连不上**
     （IP 128.242.240.91，TCP 443 超时），所以本默认值继续留在 forkc2p。
     换端点前先跑 `powershell -File scripts/check-cn-gateway-reach.ps1`（绕开 DNS/代理的直连判据），
     通了再用 `NANO_BANANA_BASE_URL` 覆盖，不要直接改这里。 */
  baseUrl = 'https://api.forkc2p.com',
  flashModel = NANO_UPSTREAM_MODELS.flash,
  proModel = NANO_UPSTREAM_MODELS.pro,
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
        /* ═══ 2026-09-24 批 BA：上游按内容政策拒单 → 中文文案 + **不重试**（doc 75 §三.2）═══════
           这一条尤其要紧：nano 收到 safety 拒绝时回的是英文原句（"The response was blocked due to
           safety reasons"），用户既看不懂也不知道该改什么；而 400/403 之外的状态码在我们这里
          还可能被当成"忙"再排队。内容问题重试一百次也是同一个结果。 */
        const detail = payload?.error?.message || `Nano Banana ${label}失败（HTTP ${response.status}）`;
        const rejected = classifyContentRejection({ status: response.status, detail });
        if (rejected.rejected) {
          const error = providerError(CONTENT_REJECTION_MESSAGE, 'CONTENT_REJECTED', false);
          error.status = response.status;
          throw error;
        }
        const retryable = response.status === 429 || response.status >= 500;
        const error = providerError(
          detail,
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
      const route = request?.modelRoute || {};
      /* ⚠️ 2026-10-04「自适应 = 不指定比例」：Gemini 侧实测**不传** aspectRatio 时
         模型会自己按内容分配宽高（瓶子摆窗台 → 1376x768 横图），这正是竞品自适应档的
         口径。所以自适应时**整个 imageConfig.aspectRatio 都不能带** ——
         带着就等于我们替它指定了。
         ⚠️ imageSize（画质档）两种情况都要传：那才是"固定总像素量级"。 */
      const autoRatio = route.autoRatio === true;
      const imageConfig = { imageSize: route.resolution || route.imageSize || '2K' };
      if (!autoRatio) imageConfig.aspectRatio = route.ratio || '1:1';
      const payload = await generate(model, {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig,
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
