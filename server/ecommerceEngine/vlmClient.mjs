import { aggregateAnalyses, buildVlmPrompt } from './vlmSchema.mjs';

const VLM_CONFIG = {
  apiKey: process.env.MINI_API_KEY || '',
  baseUrl: (process.env.MINI_BASE_URL || '').replace(/\/+$/, ''),
  model: process.env.MINI_MODEL || 'gpt-5.6-terra',
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

function parseJsonContent(content) {
  const text = cleanString(content);
  if (!text) {
    throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了空结果', {
      status: 502,
      retryable: true,
    });
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch (error) {
    throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了无效 JSON', {
      status: 502,
      retryable: true,
      cause: error,
    });
  }
}

export function createVlmClient({
  fetchImpl = fetch,
  apiKey,
  baseUrl,
  model = 'gpt-5.6-terra',
} = {}) {
  const key = cleanString(apiKey);
  const endpoint = cleanString(baseUrl).replace(/\/+$/, '');
  const modelName = cleanString(model);
  if (!key || !endpoint || !modelName || typeof fetchImpl !== 'function') {
    throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
  }

  return {
    async analyzeJson({ systemPrompt, userPrompt, images = [] } = {}) {
      const system = cleanString(systemPrompt);
      const user = cleanString(userPrompt);
      const imageUrls = Array.isArray(images) ? images.map(cleanString).filter(Boolean) : [];
      if (!system || !user || imageUrls.length === 0) {
        throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', '图片分析请求不完整', {
          status: 400,
          retryable: false,
        });
      }

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
            max_tokens: 2048,
            temperature: 0.1,
          }),
        });
      } catch (error) {
        throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用', { cause: error });
      }

      if (!response?.ok) {
        throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用');
      }
      let data;
      try {
        data = await response.json();
      } catch (error) {
        throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', '图片分析服务返回了无效响应', {
          status: 502,
          retryable: true,
          cause: error,
        });
      }
      return parseJsonContent(data?.choices?.[0]?.message?.content);
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
