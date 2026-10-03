import { LEGAL_IMAGE_SIZES } from './modelCatalog.mjs';
/* 上游内容策略拒绝的翻译层（批 BA，doc 75 §三.2）：认出来就换中文文案 + 不重试。
   判据与保守边界（用的是我们已经收到的原始文本，不是猜的字段名）在那个文件的头部。 */
import { CONTENT_REJECTION_MESSAGE, classifyContentRejection } from '../contentRejection.mjs';

const MAX_INPUT_IMAGES = 10;
const SAFE_JOB_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,255}$/i;
const SAFE_IDEMPOTENCY_KEY_RE = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_DELAY_MS = 30_000;

function own(record, key) {
  return record !== null
    && typeof record === 'object'
    && !Array.isArray(record)
    && Object.hasOwn(record, key)
    ? record[key]
    : undefined;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function providerError(message, {
  status = 0,
  retryable = false,
  jobId = '',
  code = 'PROVIDER_ERROR',
  retryAfter = null,
} = {}) {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.jobId = jobId;
  error.code = code;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) error.retryAfter = retryAfter;
  return error;
}

function parseRetryAfter(response, nowMs) {
  const value = cleanString(response?.headers?.get?.('retry-after'));
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds)) return null;
    return Math.min(Math.ceil(seconds), MAX_RETRY_DELAY_MS / 1_000);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(
    Math.max(0, Math.ceil((timestamp - nowMs) / 1_000)),
    MAX_RETRY_DELAY_MS / 1_000,
  );
}

function retryDelayMs(fallbackMs, retryAfter) {
  const boundedFallback = Math.min(
    Math.max(0, Number.isFinite(fallbackMs) ? fallbackMs : 0),
    MAX_RETRY_DELAY_MS,
  );
  if (!Number.isFinite(retryAfter) || retryAfter < 0) return boundedFallback;
  return Math.max(
    boundedFallback,
    Math.min(Math.ceil(retryAfter * 1_000), MAX_RETRY_DELAY_MS),
  );
}

function validateBaseUrl(value) {
  let url;
  try { url = new URL(cleanString(value)); } catch {
    throw new TypeError('provider baseUrl must be an http(s) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('provider baseUrl must be an http(s) URL');
  }
  return url.href.replace(/\/+$/, '');
}

function normalizeAuth(config) {
  const bearerToken = cleanString(config.bearerToken);
  const apiKey = cleanString(config.apiKey);
  if (Boolean(bearerToken) === Boolean(apiKey)) {
    throw new TypeError('exactly one provider auth credential is required');
  }
  const inferred = bearerToken ? 'bearer' : 'x-api-key';
  const strategy = cleanString(config.authStrategy).toLowerCase() || inferred;
  if (!['bearer', 'x-api-key'].includes(strategy)) {
    throw new TypeError("authStrategy must be 'bearer' or 'x-api-key'");
  }
  if ((strategy === 'bearer' && !bearerToken) || (strategy === 'x-api-key' && !apiKey)) {
    throw new TypeError('provider auth strategy does not match its credential');
  }
  return strategy === 'bearer'
    ? { strategy, headers: { Authorization: `Bearer ${bearerToken}` } }
    : { strategy, headers: { 'x-api-key': apiKey } };
}

function validateJobId(value) {
  const jobId = cleanString(value);
  if (!SAFE_JOB_ID_RE.test(jobId)) throw new TypeError('provider job id is invalid');
  return jobId;
}

function normalizeStatus(value) {
  const status = cleanString(value).toLowerCase();
  if (['queued', 'pending', 'created', 'accepted'].includes(status)) return 'queued';
  if (['running', 'processing', 'in_progress', 'generating'].includes(status)) return 'running';
  if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(status)) return 'completed';
  if (['failed', 'failure', 'error', 'cancelled', 'canceled', 'rejected'].includes(status)) return 'failed';
  return 'queued';
}

function extractJobId(body) {
  const data = own(body, 'data');
  const candidates = [
    own(body, 'id'),
    own(body, 'job_id'),
    own(body, 'jobId'),
    own(body, 'task_id'),
    own(body, 'taskId'),
    own(data, 'id'),
    own(data, 'job_id'),
    own(data, 'task_id'),
  ];
  return candidates.map(cleanString).find(Boolean) || '';
}

function extractStatus(body) {
  const data = own(body, 'data');
  return normalizeStatus(
    own(body, 'status')
    ?? own(body, 'state')
    ?? own(data, 'status')
    ?? own(data, 'state'),
  );
}

function extractOutputUrl(body) {
  const data = own(body, 'data');
  const output = own(body, 'output');
  const result = own(body, 'result');
  const firstData = Array.isArray(data) ? data[0] : data;
  const firstOutput = Array.isArray(output) ? output[0] : output;
  const firstResult = Array.isArray(result) ? result[0] : result;
  const resultUrls = own(body, 'result_urls');
  const candidates = [
    Array.isArray(resultUrls) ? resultUrls[0] : undefined,
    own(body, 'output_url'),
    own(body, 'outputUrl'),
    own(body, 'url'),
    own(firstData, 'url'),
    own(firstData, 'output_url'),
    own(firstOutput, 'url'),
    own(firstOutput, 'output_url'),
    own(firstResult, 'url'),
    own(firstResult, 'output_url'),
  ];
  return candidates.map(cleanString).find(Boolean) || '';
}

function extractError(body) {
  const error = own(body, 'error');
  return cleanString(
    typeof error === 'string'
      ? error
      : own(error, 'message')
        ?? own(body, 'error_message')
        ?? own(body, 'message')
        ?? own(body, 'detail'),
  );
}

async function readBody(response) {
  try {
    const text = await response.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    try {
      const parsed = await response.json();
      return parsed !== null && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}

function normalizeAsset(asset, index) {
  if (asset === null || typeof asset !== 'object' || Array.isArray(asset)) {
    throw new TypeError(`input asset ${index} is invalid`);
  }
  const raw = own(asset, 'buffer') ?? own(asset, 'bytes') ?? own(asset, 'blob');
  let blob;
  if (raw instanceof Blob) {
    blob = raw;
  } else if (Buffer.isBuffer(raw) || raw instanceof Uint8Array || raw instanceof ArrayBuffer) {
    const contentType = cleanString(own(asset, 'contentType')) || 'image/png';
    if (!contentType.startsWith('image/')) throw new TypeError(`input asset ${index} content type is invalid`);
    blob = new Blob([raw], { type: contentType });
  } else {
    throw new TypeError(`input asset ${index} must contain image bytes`);
  }
  if (!blob.size) throw new TypeError(`input asset ${index} is empty`);
  const candidateName = cleanString(own(asset, 'fileName'));
  const fileName = /^[a-z0-9][a-z0-9_.-]{0,127}$/i.test(candidateName)
    ? candidateName
    : `image-${index + 1}.png`;
  return { blob, fileName };
}

function buildEditForm(request, { standardFields = false } = {}) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('provider edit request is required');
  }
  const prompt = cleanString(own(request, 'prompt'));
  const idempotencyKey = cleanString(own(request, 'idempotencyKey'));
  const route = own(request, 'modelRoute');
  const model = cleanString(own(route, 'model'));
  const size = cleanString(own(route, 'size'));
  const assets = own(request, 'inputAssets');
  if (!SAFE_IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new TypeError('provider edit idempotency key is invalid');
  }
  if (!prompt || !model || !size) throw new TypeError('provider edit prompt, model, and size are required');
  if (!Array.isArray(assets) || assets.length === 0) throw new TypeError('provider edit requires image inputs');
  if (assets.length > MAX_INPUT_IMAGES) throw new RangeError('provider edit accepts at most 10 images');

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  const syncFieldNames = standardFields === true;
  assets.forEach((asset, index) => {
    const normalized = normalizeAsset(asset, index);
    const field = syncFieldNames
      ? (assets.length === 1 ? 'image' : 'image[]')
      : `image[${index}]`;
    form.append(field, normalized.blob, normalized.fileName);
  });
  return { form, idempotencyKey };
}

/* ⚠️ 2026-10-04：autoRatio = 用户选的是「自适应」，即**不指定宽高比**。
   实测 image2 收到 size 才会按那个比例出图；不传 size 时它一律给 2048x2048 方图
   （两个完全不同的内容都如此），而"不指定比例、让模型自己分配宽高"正是竞品
   自适应档的口径（固定总像素量级 + 模型分配宽高）。
   ⇒ 自适应时**只传 resolution、不传 size**，那条"必须是目录里的合法尺寸"的闸
   在自适应下不适用 —— 它防的是乱传，不该挡住"故意不指定"。
   ⚠️ 非自适应时这道闸一字不改：用户显式选了档位，就必须是那一档。 */
function resolveNativeTaskSizing(pixelSize, { autoRatio = false, resolution = '' } = {}) {
  if (autoRatio) return { resolution: String(resolution || '2K').toLowerCase() };
  for (const [resolution, ratios] of Object.entries(LEGAL_IMAGE_SIZES)) {
    for (const [ratio, candidateSize] of Object.entries(ratios)) {
      if (candidateSize === pixelSize) {
        return { size: ratio, resolution: resolution.toLowerCase() };
      }
    }
  }
  throw new RangeError('native task size must be a catalog-owned legal image size');
}

async function buildNativeTask(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('provider edit request is required');
  }
  const prompt = cleanString(own(request, 'prompt'));
  const idempotencyKey = cleanString(own(request, 'idempotencyKey'));
  const route = own(request, 'modelRoute');
  const model = cleanString(own(route, 'model'));
  const size = cleanString(own(route, 'size'));
  const assets = own(request, 'inputAssets') ?? [];
  if (!SAFE_IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw new TypeError('provider edit idempotency key is invalid');
  }
  if (!prompt || !model || !size) throw new TypeError('provider edit prompt, model, and size are required');
  if (!Array.isArray(assets)) throw new TypeError('provider image inputs must be an array');
  if (assets.length > MAX_INPUT_IMAGES) throw new RangeError('provider edit accepts at most 10 images');
  /* ⚠️ resolution 必须从 route 单独取：pixelSize 是像素串（'2048x2048'），
     自适应分支要的是**档位名**（'2K'），两者不是一回事。 */
  const nativeSizing = resolveNativeTaskSizing(size, {
    autoRatio: own(route, 'autoRatio') === true,
    resolution: cleanString(own(route, 'resolution') || own(route, 'imageSize')),
  });

  const images = await Promise.all(assets.map(async (asset, index) => {
    const { blob } = normalizeAsset(asset, index);
    const bytes = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type};base64,${bytes.toString('base64')}`;
  }));
  return {
    body: JSON.stringify({
      kind: 'image',
      model,
      input: {
        prompt,
        ...nativeSizing,
        n: 1,
        ...(images.length ? { image: images.length === 1 ? images[0] : images } : {}),
      },
    }),
    idempotencyKey,
  };
}

function defaultPollPath(jobId) {
  return `/v1/images/tasks/${encodeURIComponent(jobId)}`;
}

function nativePollPath(jobId) {
  return `/v1/tasks/${encodeURIComponent(jobId)}`;
}

export function createProviderAdapter(config = {}) {
  const baseUrl = validateBaseUrl(config.baseUrl);
  const auth = normalizeAuth(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = config.now ?? Date.now;
  const pollIntervalMs = Number.isFinite(config.pollIntervalMs) && config.pollIntervalMs >= 0
    ? config.pollIntervalMs
    : 1_500;
  // 显式请求截止时间：上游悬挂时不能无限占用生成槽位。
  // 提交（含多模态图片上传）允许更长时间；轮询是轻量 GET。0 表示禁用。
  const submitTimeoutMs = Number.isSafeInteger(config.submitTimeoutMs) && config.submitTimeoutMs >= 0
    ? config.submitTimeoutMs
    : 120_000;
  const pollTimeoutMs = Number.isSafeInteger(config.pollTimeoutMs) && config.pollTimeoutMs >= 0
    ? config.pollTimeoutMs
    : 20_000;
  if (submitTimeoutMs > 0 || pollTimeoutMs > 0) {
    if (typeof AbortController === 'undefined') throw new TypeError('AbortController is required for request deadlines');
  }
  const maxSubmitAttempts = Number.isSafeInteger(config.maxSubmitAttempts) && config.maxSubmitAttempts > 0
    ? config.maxSubmitAttempts
    : 3;
  const protocol = cleanString(config.protocol).toLowerCase() || 'legacy-edits';
  if (!['legacy-edits', 'native-tasks', 'openai-images'].includes(protocol)) {
    throw new TypeError("provider protocol must be 'legacy-edits', 'native-tasks' or 'openai-images'");
  }
  /* 9-12 同模型备用供应商：IP233 这类走「同步 OpenAI 图片接口」（POST 即返回图片 URL，无异步任务）。
     为不改下游契约（submit → jobId → poll），同步结果用一个合成 jobId 暂存，poll 时立即返回 completed。 */
  const isSyncImages = protocol === 'openai-images';
  const syncResults = new Map();
  let syncSequence = 0;
  const MODEL_MAP = config.modelMap && typeof config.modelMap === 'object' ? config.modelMap : null;
  const editPath = cleanString(config.editPath) || '/v1/images/edits';
  const submitPath = cleanString(config.submitPath)
    || (protocol === 'native-tasks' ? '/v1/tasks' : protocol === 'openai-images' ? '/v1/images/generations' : editPath);
  const pollPath = typeof config.pollPath === 'function' || typeof config.pollPath === 'string'
    ? config.pollPath
    : protocol === 'native-tasks' ? nativePollPath : defaultPollPath;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof sleep !== 'function') throw new TypeError('sleep must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  function currentTimeMs() {
    const value = now();
    const timestamp = value instanceof Date ? value.getTime() : value;
    if (!Number.isFinite(timestamp)) throw new TypeError('now must return a finite timestamp');
    return timestamp;
  }

  function headers(extra = {}) {
    return { ...auth.headers, ...extra };
  }

  async function fetchWithDeadline(url, options = {}, timeoutMs) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      return fetchImpl(url, options);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw providerError(`provider request exceeded the ${Math.round(timeoutMs / 1_000)}s deadline`, {
          retryable: true,
          code: 'PROVIDER_NETWORK_ERROR',
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /* 同步 OpenAI 图片接口：POST JSON → 直接拿 data[0].url；带参考图时走 /v1/images/edits (multipart)。 */
  function syncModelFor(request) {
    const route = own(request, 'modelRoute') || {};
    const model = cleanString(own(route, 'model'));
    const resolution = cleanString(own(route, 'resolution') || own(route, 'imageSize')).toUpperCase();
    /* 支持三种键：`模型:分辨率`（同一上游按模型区分，如 nano-banana-pro:2K）、`分辨率`、以及无映射时沿用原模型名 */
    if (MODEL_MAP && resolution && MODEL_MAP[`${model}:${resolution}`]) return cleanString(MODEL_MAP[`${model}:${resolution}`]);
    if (MODEL_MAP && resolution && MODEL_MAP[resolution]) return cleanString(MODEL_MAP[resolution]);
    if (MODEL_MAP && MODEL_MAP[model]) return cleanString(MODEL_MAP[model]);
    return model;
  }

  async function submitSyncImages(request) {
    const route = own(request, 'modelRoute') || {};
    const prompt = cleanString(own(request, 'prompt'));
    const size = cleanString(own(route, 'size'));
    const assets = own(request, 'inputAssets') ?? [];
    const idempotencyKey = cleanString(own(request, 'idempotencyKey'));
    const model = syncModelFor(request);
    if (!prompt || !model || !size) throw new TypeError('provider edit prompt, model, and size are required');
    const hasInputs = Array.isArray(assets) && assets.length > 0;
    let url = `${baseUrl}${submitPath}`;
    let init;
    if (hasInputs) {
      const built = buildEditForm(request, { standardFields: true });
      url = `${baseUrl}${editPath}`;
      init = { method: 'POST', headers: headers({ 'Idempotency-Key': built.idempotencyKey }), body: built.form };
    } else {
      init = {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify({ model, prompt, size, n: 1 }),
      };
    }
    const response = await fetchWithDeadline(url, init, submitTimeoutMs);
    const responseBody = await readBody(response);
    if (!response.ok) {
      const detail = extractError(responseBody) || `provider image request failed with HTTP ${response.status}`;
      /* ═══ 2026-09-24 批 BA：上游按内容政策拒单 → 换中文文案 + 不重试（doc 75 §三.2）════════════
         用户原话：「有这种内容肯定是要**直接拒**的」+「为什么还要重新花钱呢…没有低成本的过滤方案吗」。
         原来这里把上游那句英文原样透出去（"Your request was rejected as a result of our safety
         system"），用户既看不懂也不知道该改什么，而池子还会按 retryable 再花一次钱重试。 */
      const rejection = classifyContentRejection({ status: response.status, detail });
      if (rejection.rejected) {
        throw providerError(CONTENT_REJECTION_MESSAGE, {
          status: response.status,
          retryable: false,
          code: 'CONTENT_REJECTED',
        });
      }
      throw providerError(
        detail,
        {
          status: response.status,
          retryable: RETRYABLE_STATUS.has(response.status),
          code: 'PROVIDER_ERROR',
        },
      );
    }
    const outputUrl = extractOutputUrl(responseBody);
    if (!outputUrl) throw providerError('provider returned no image url', { status: 502, code: 'PROVIDER_RESULT_MISSING' });
    syncSequence += 1;
    const jobId = `sync-${currentTimeMs()}-${syncSequence}-${Math.random().toString(36).slice(2, 10)}`;
    syncResults.set(jobId, { outputUrl, createdAt: currentTimeMs() });
    return { jobId, status: 'pending' };
  }

  async function submitEdit(request) {
    if (isSyncImages) return submitSyncImages(request);
    const { form, body, idempotencyKey } = protocol === 'native-tasks'
      ? await buildNativeTask(request)
      : buildEditForm(request);
    let lastError;
    for (let attempt = 1; attempt <= maxSubmitAttempts; attempt += 1) {
      try {
        const response = await fetchWithDeadline(`${baseUrl}${submitPath}`, {
          method: 'POST',
          headers: headers(protocol === 'native-tasks'
            ? {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            }
            : {
              'X-Async-Mode': 'true',
              'Idempotency-Key': idempotencyKey,
            }),
          body: protocol === 'native-tasks' ? body : form,
        }, submitTimeoutMs);
        const responseBody = await readBody(response);
        const jobId = extractJobId(responseBody);
        const status = extractStatus(responseBody);
        const retryAfter = parseRetryAfter(response, currentTimeMs());
        if (response.ok) {
          if (!jobId) throw providerError('provider did not return an async job id', {
            status: response.status,
            code: 'PROVIDER_JOB_ID_MISSING',
          });
          return { jobId: validateJobId(jobId), status };
        }
        if (response.status === 504 && jobId) {
          return {
            jobId: validateJobId(jobId),
            status,
            recoverable: true,
            ...(retryAfter !== null ? { retryAfter } : {}),
          };
        }
        const retryable = RETRYABLE_STATUS.has(response.status);
        lastError = providerError(
          extractError(responseBody) || `provider edit request failed with HTTP ${response.status}`,
          { status: response.status, retryable, jobId, retryAfter },
        );
        if (!retryable || attempt === maxSubmitAttempts) throw lastError;
      } catch (error) {
        if (error?.code === 'PROVIDER_JOB_ID_MISSING' || error?.retryable === false) throw error;
        lastError = error?.code === 'PROVIDER_ERROR'
          ? error
          : providerError('provider edit request failed before acknowledgement', {
              retryable: true,
              code: 'PROVIDER_NETWORK_ERROR',
            });
        if (attempt === maxSubmitAttempts) throw lastError;
      }
      const backoffMs = Math.min(250 * (2 ** (attempt - 1)), 2_000);
      await sleep(retryDelayMs(backoffMs, lastError?.retryAfter));
    }
    throw lastError || providerError('provider edit request failed');
  }

  async function poll(jobIdInput) {
    const jobId = validateJobId(jobIdInput);
    if (isSyncImages) {
      const cached = syncResults.get(jobId) || (String(jobId).startsWith('sync-') ? syncResults.get(String(jobId)) : null);
      if (cached) {
        syncResults.delete(jobId);
        return { jobId: validateJobId(jobId), status: 'completed', outputUrl: cached.outputUrl, error: '' };
      }
      throw providerError('provider sync job result expired', { status: 410, retryable: true, code: 'PROVIDER_RESULT_EXPIRED' });
    }
    const path = typeof pollPath === 'function'
      ? pollPath(jobId)
      : pollPath.replace('{id}', encodeURIComponent(jobId));
    const response = await fetchWithDeadline(`${baseUrl}${path}`, {
      method: 'GET',
      headers: headers(),
    }, pollTimeoutMs);
    const body = await readBody(response);
    const providerJobId = extractJobId(body);
    const responseJobId = providerJobId || jobId;
    const status = extractStatus(body);
    const retryAfter = parseRetryAfter(response, currentTimeMs());
    const recoverableGatewayTimeout = response.status === 504 && providerJobId;
    if (!response.ok && !recoverableGatewayTimeout) {
      const detail = extractError(body) || `provider polling failed with HTTP ${response.status}`;
      /* 轮询阶段的内容拒绝同样要换文案 + 不重试（有些网关是"提交成功、轮询时判失败"） */
      const rejection = classifyContentRejection({ status: response.status, detail });
      if (rejection.rejected) {
        throw providerError(CONTENT_REJECTION_MESSAGE, {
          status: response.status,
          retryable: false,
          jobId: responseJobId,
          code: 'CONTENT_REJECTED',
        });
      }
      throw providerError(
        detail,
        {
          status: response.status,
          retryable: RETRYABLE_STATUS.has(response.status),
          jobId: responseJobId,
          retryAfter,
        },
      );
    }
    return {
      jobId: validateJobId(responseJobId),
      status,
      outputUrl: extractOutputUrl(body),
      error: extractError(body),
      ...(retryAfter !== null ? { retryAfter } : {}),
      ...(!response.ok ? {
        recoverable: true,
        httpStatus: response.status,
      } : {}),
    };
  }

  async function pollUntilReady(jobId, { maxPolls = 240, signal } = {}) {
    if (!Number.isSafeInteger(maxPolls) || maxPolls <= 0) {
      throw new TypeError('maxPolls must be a positive safe integer');
    }
    let lastFailure = null;
    let lastRetryAfter = null;
    for (let count = 0; count < maxPolls; count += 1) {
      if (signal?.aborted) throw signal.reason || providerError('provider polling was aborted');
      let result;
      try {
        result = await poll(jobId);
      } catch (error) {
        if (error?.retryable !== true) throw error;
        lastFailure = error;
        if (Number.isFinite(error.retryAfter) && error.retryAfter >= 0) {
          lastRetryAfter = error.retryAfter;
        }
        if (count + 1 < maxPolls) {
          await sleep(retryDelayMs(pollIntervalMs, error.retryAfter));
        }
        continue;
      }
      if (result.status === 'completed' || result.status === 'failed') {
        /* ═══ 2026-09-24 批 BA：轮询到"失败"且理由是内容政策 → 当场换成中文、不重试（doc 75 §三.2）
           这一条是**最常走到的那个口**（上游接单成功、渲染时判违规）：原来调用方拿到的是一句
           上游原文，我们只能报"生成失败"。⇒ 判据只用**已经拿到的那段文本**，命中不了行为不变。 */
        const rejection = result.status === 'failed'
          ? classifyContentRejection({ status: Number(result.httpStatus) || 0, detail: result.error || '' })
          : { rejected: false };
        if (rejection.rejected) {
          throw providerError(CONTENT_REJECTION_MESSAGE, {
            status: Number.isInteger(result.httpStatus) && result.httpStatus ? result.httpStatus : 400,
            retryable: false,
            jobId: validateJobId(jobId),
            code: 'CONTENT_REJECTED',
          });
        }
        return result;
      }
      if (Number.isFinite(result.retryAfter) && result.retryAfter >= 0) {
        lastRetryAfter = result.retryAfter;
      }
      if (result.recoverable && Number.isInteger(result.httpStatus)) {
        lastFailure = providerError(
          result.error || `provider polling failed with HTTP ${result.httpStatus}`,
          {
            status: result.httpStatus,
            retryable: true,
            jobId: result.jobId,
            retryAfter: result.retryAfter,
          },
        );
      }
      if (count + 1 < maxPolls) {
        await sleep(retryDelayMs(pollIntervalMs, result.retryAfter));
      }
    }
    throw providerError(lastFailure?.message || 'provider job is still running', {
      status: Number.isInteger(lastFailure?.status) ? lastFailure.status : 0,
      retryable: true,
      jobId: validateJobId(jobId),
      code: 'PROVIDER_POLL_TIMEOUT',
      retryAfter: lastRetryAfter,
    });
  }

  return {
    authStrategy: auth.strategy,
    submitEdit,
    poll,
    pollUntilReady,
  };
}

export { MAX_INPUT_IMAGES };
