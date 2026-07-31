import { aggregateAnalyses, buildVlmPrompt } from './vlmSchema.mjs';

const VLM_CONFIG = {
  apiKey: process.env.MINI_API_KEY || '',
  baseUrl: (process.env.MINI_BASE_URL || '').replace(/\/+$/, ''),
  model: process.env.MINI_MODEL || 'gpt-5.6-luna',
  enabled: Boolean(process.env.MINI_API_KEY && process.env.MINI_BASE_URL),
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function codedError(code, message, { status = 503, retryable = true, cause } = {}) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), {
    code,
    status,
    retryable,
  });
}

export function createVlmDeadline({
  timeoutMs = 75_000,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  AbortControllerImpl = AbortController,
} = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('VLM deadline must be a positive integer');
  }
  const controller = new AbortControllerImpl();
  let cleaned = false;
  const timeout = setTimeoutImpl(() => {
    controller.abort(codedError(
      'VISUAL_ANALYSIS_TIMEOUT',
      '图片分析超时，请检查网络后重试',
      { status: 504, retryable: true },
    ));
  }, timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      clearTimeoutImpl(timeout);
    },
  };
}

function parseJsonContent(content) {
  const text = cleanString(content);
  if (!text) {
    throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了空结果', {
      status: 502,
      retryable: false,
    });
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch (error) {
    throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了无效 JSON', {
      status: 502,
      retryable: false,
      cause: error,
    });
  }
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status) {
  return status === 429 || (Number.isInteger(status) && status >= 500);
}

function externalAbortError(signal) {
  return codedError('VISUAL_ANALYSIS_ABORTED', '图片分析请求已取消', {
    status: 499,
    retryable: false,
    cause: signal?.reason instanceof Error ? signal.reason : undefined,
  });
}

export function createVlmClient({
  fetchImpl = fetch,
  apiKey,
  baseUrl,
  model = 'gpt-5.6-luna',
  timeoutMs = 30_000,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  retryDelaysMs = [750, 2_250],
  sleepImpl = sleep,
} = {}) {
  const key = cleanString(apiKey);
  const endpoint = cleanString(baseUrl).replace(/\/+$/, '');
  const modelName = cleanString(model);
  if (!key || !endpoint || !modelName || typeof fetchImpl !== 'function') {
    throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0
    || typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function'
    || !Array.isArray(retryDelaysMs) || retryDelaysMs.length > 5
    || retryDelaysMs.some(delay => !Number.isSafeInteger(delay) || delay < 0)
    || typeof sleepImpl !== 'function') {
    throw new TypeError('VLM timeout configuration is invalid');
  }

  async function completeText({
    systemPrompt,
    userPrompt,
    images = [],
    signal,
    maxTokens = 2048,
    temperature = 0.1,
  } = {}) {
      const system = cleanString(systemPrompt);
      const user = cleanString(userPrompt);
      const imageUrls = Array.isArray(images) ? images.map(cleanString).filter(Boolean) : [];
      if (!system || !user) {
        throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', '图片分析请求不完整', {
          status: 400,
          retryable: false,
        });
      }
      if (signal?.aborted) throw externalAbortError(signal);

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        const abortController = new AbortController();
        let timedOut = false;
        const forwardExternalAbort = () => abortController.abort(signal?.reason);
        signal?.addEventListener?.('abort', forwardExternalAbort, { once: true });
        const timeout = setTimeoutImpl(() => {
          timedOut = true;
          abortController.abort(new Error('visual analysis request timed out'));
        }, timeoutMs);
        try {
          let response;
          try {
            response = await fetchImpl(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: 'system', content: system },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: user },
                    ...imageUrls.map(url => ({
                      type: 'image_url',
                      image_url: { url, detail: 'original' },
                    })),
                  ],
                },
              ],
              max_tokens: maxTokens,
              temperature,
            }),
            signal: abortController.signal,
            });
          } catch (error) {
            if (signal?.aborted) throw externalAbortError(signal);
            if (!timedOut && !abortController.signal.aborted && attempt < retryDelaysMs.length) {
              await sleepImpl(retryDelaysMs[attempt]);
              continue;
            }
            throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用', {
              cause: error,
            });
          }

          if (!response?.ok) {
            if (isRetryableStatus(response?.status) && attempt < retryDelaysMs.length) {
              await sleepImpl(retryDelaysMs[attempt]);
              continue;
            }
            throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
          }
          let data;
          try {
            data = await response.json();
          } catch (error) {
            if (signal?.aborted) throw externalAbortError(signal);
            if (timedOut || abortController.signal.aborted) {
              throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用', {
                cause: error,
              });
            }
            throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了无效响应', {
              status: 502,
              retryable: false,
              cause: error,
            });
          }
          const content = cleanString(data?.choices?.[0]?.message?.content);
          if (!content) {
            throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了空结果', {
              status: 502,
              retryable: false,
            });
          }
          return content;
        } finally {
          clearTimeoutImpl(timeout);
          signal?.removeEventListener?.('abort', forwardExternalAbort);
        }
      }
      throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
  }

  return {
    completeText,
    async analyzeJson(request = {}) {
      const imageUrls = Array.isArray(request.images)
        ? request.images.map(cleanString).filter(Boolean)
        : [];
      if (imageUrls.length === 0) {
        throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', '图片分析请求不完整', {
          status: 400,
          retryable: false,
        });
      }
      return parseJsonContent(await completeText({ ...request, images: imageUrls }));
    },
  };
}

export async function analyzeImages(imageUrls, type = 'real_shot') {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;
  const client = createVlmClient({
    apiKey: VLM_CONFIG.apiKey,
    baseUrl: VLM_CONFIG.baseUrl,
    model: VLM_CONFIG.model,
  });
  const prompt = buildVlmPrompt(type, imageUrls);
  return client.analyzeJson({ ...prompt, images: imageUrls });
}

export async function runFullAnalysis(realShots = [], styleRefs = []) {
  const hasReal = realShots.length > 0;
  const hasStyle = styleRefs.length > 0;
  const mode = hasReal && hasStyle ? 'dual' : hasReal ? 'real_only' : hasStyle ? 'style_only' : 'none';
  let realShot = null;
  let styleRef = null;

  if (hasReal) {
    const rawResults = await Promise.all(realShots.slice(0, 5).map(url => analyzeImages([url], 'real_shot')));
    realShot = aggregateAnalyses(rawResults.filter(Boolean), 'real_shot');
  }
  if (hasStyle) {
    const rawResults = await Promise.all(styleRefs.slice(0, 5).map(url => analyzeImages([url], 'style_ref')));
    styleRef = aggregateAnalyses(rawResults.filter(Boolean), 'style_ref');
  }
  return { realShot, styleRef, mode };
}

export { VLM_CONFIG };
