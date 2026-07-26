const MAX_INPUT_IMAGES = 10;
const SAFE_JOB_ID_RE = /^[a-z0-9][a-z0-9_.:-]{0,255}$/i;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

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

function providerError(message, { status = 0, retryable = false, jobId = '', code = 'PROVIDER_ERROR' } = {}) {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.jobId = jobId;
  error.code = code;
  return error;
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
  const candidates = [
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
      : own(error, 'message') ?? own(body, 'message') ?? own(body, 'detail'),
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

function buildEditForm(request) {
  if (request === null || typeof request !== 'object' || Array.isArray(request)) {
    throw new TypeError('provider edit request is required');
  }
  const prompt = cleanString(own(request, 'prompt'));
  const route = own(request, 'modelRoute');
  const model = cleanString(own(route, 'model'));
  const size = cleanString(own(route, 'size'));
  const assets = own(request, 'inputAssets');
  if (!prompt || !model || !size) throw new TypeError('provider edit prompt, model, and size are required');
  if (!Array.isArray(assets) || assets.length === 0) throw new TypeError('provider edit requires image inputs');
  if (assets.length > MAX_INPUT_IMAGES) throw new RangeError('provider edit accepts at most 10 images');

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  assets.forEach((asset, index) => {
    const normalized = normalizeAsset(asset, index);
    form.append(`image[${index}]`, normalized.blob, normalized.fileName);
  });
  return form;
}

function defaultPollPath(jobId) {
  return `/v1/images/tasks/${encodeURIComponent(jobId)}`;
}

export function createProviderAdapter(config = {}) {
  const baseUrl = validateBaseUrl(config.baseUrl);
  const auth = normalizeAuth(config);
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const pollIntervalMs = Number.isFinite(config.pollIntervalMs) && config.pollIntervalMs >= 0
    ? config.pollIntervalMs
    : 1_500;
  const maxSubmitAttempts = Number.isSafeInteger(config.maxSubmitAttempts) && config.maxSubmitAttempts > 0
    ? config.maxSubmitAttempts
    : 3;
  const editPath = cleanString(config.editPath) || '/v1/images/edits';
  const pollPath = typeof config.pollPath === 'function' || typeof config.pollPath === 'string'
    ? config.pollPath
    : defaultPollPath;
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof sleep !== 'function') throw new TypeError('sleep must be a function');

  function headers(extra = {}) {
    return { ...auth.headers, ...extra };
  }

  async function submitEdit(request) {
    const form = buildEditForm(request);
    let lastError;
    for (let attempt = 1; attempt <= maxSubmitAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(`${baseUrl}${editPath}`, {
          method: 'POST',
          headers: headers({ 'X-Async-Mode': 'true' }),
          body: form,
        });
        const body = await readBody(response);
        const jobId = extractJobId(body);
        const status = extractStatus(body);
        if (response.ok) {
          if (!jobId) throw providerError('provider did not return an async job id', {
            status: response.status,
            code: 'PROVIDER_JOB_ID_MISSING',
          });
          return { jobId: validateJobId(jobId), status };
        }
        if (response.status === 504 && jobId) {
          return { jobId: validateJobId(jobId), status, recoverable: true };
        }
        const retryable = RETRYABLE_STATUS.has(response.status);
        lastError = providerError(
          extractError(body) || `provider edit request failed with HTTP ${response.status}`,
          { status: response.status, retryable, jobId },
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
      await sleep(Math.min(250 * (2 ** (attempt - 1)), 2_000));
    }
    throw lastError || providerError('provider edit request failed');
  }

  async function poll(jobIdInput) {
    const jobId = validateJobId(jobIdInput);
    const path = typeof pollPath === 'function'
      ? pollPath(jobId)
      : pollPath.replace('{id}', encodeURIComponent(jobId));
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'GET',
      headers: headers(),
    });
    const body = await readBody(response);
    const responseJobId = extractJobId(body) || jobId;
    const status = extractStatus(body);
    if (!response.ok && !(response.status === 504 && responseJobId)) {
      throw providerError(
        extractError(body) || `provider polling failed with HTTP ${response.status}`,
        {
          status: response.status,
          retryable: RETRYABLE_STATUS.has(response.status),
          jobId: responseJobId,
        },
      );
    }
    return {
      jobId: validateJobId(responseJobId),
      status,
      outputUrl: extractOutputUrl(body),
      error: extractError(body),
    };
  }

  async function pollUntilReady(jobId, { maxPolls = 240, signal } = {}) {
    if (!Number.isSafeInteger(maxPolls) || maxPolls <= 0) {
      throw new TypeError('maxPolls must be a positive safe integer');
    }
    for (let count = 0; count < maxPolls; count += 1) {
      if (signal?.aborted) throw signal.reason || providerError('provider polling was aborted');
      const result = await poll(jobId);
      if (result.status === 'completed' || result.status === 'failed') return result;
      if (count + 1 < maxPolls) await sleep(pollIntervalMs);
    }
    throw providerError('provider job is still running', {
      retryable: true,
      jobId: validateJobId(jobId),
      code: 'PROVIDER_POLL_TIMEOUT',
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
