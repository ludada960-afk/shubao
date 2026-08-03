const DEFAULT_ENDPOINT = 'https://fal.run/fal-ai/sam-3/image';
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_PROMPTS = 8;

function isAllowedImageUrl(value) {
  const raw = String(value || '').trim();
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return true;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeBoxPrompt(prompt, index) {
  const box = Array.isArray(prompt?.box) ? prompt.box.map(Number) : [];
  if (box.length !== 4 || !box.every(Number.isFinite)) {
    throw new FalSegmentationError('分割坐标不合法', { code: 'SEGMENTATION_INPUT_INVALID', status: 400 });
  }
  const [xMin, yMin, xMax, yMax] = box.map(value => Math.round(value));
  if (xMin < 0 || yMin < 0 || xMax <= xMin || yMax <= yMin) {
    throw new FalSegmentationError('分割坐标不合法', { code: 'SEGMENTATION_INPUT_INVALID', status: 400 });
  }
  return {
    x_min: xMin,
    y_min: yMin,
    x_max: xMax,
    y_max: yMax,
    object_id: index + 1,
  };
}

function publicProviderError(code, status = 502) {
  const message = code === 'SEGMENTATION_TIMEOUT'
    ? '图像分割服务处理超时'
    : code === 'SEGMENTATION_RESPONSE_INVALID'
      ? '图像分割服务返回了无效结果'
      : '图像分割服务暂时不可用';
  return new FalSegmentationError(message, { code, status });
}

export class FalSegmentationError extends Error {
  constructor(message, { code = 'SEGMENTATION_PROVIDER_FAILED', status = 502 } = {}) {
    super(message);
    this.name = 'FalSegmentationError';
    this.code = code;
    this.status = status;
  }
}

export function createFalSegmentationClient({
  apiKey = process.env.FAL_KEY || '',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  endpoint = DEFAULT_ENDPOINT,
} = {}) {
  const key = String(apiKey || '').trim();
  const requestTimeoutMs = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);

  return {
    async segment({ imageUrl, prompts = [], maxMasks = MAX_PROMPTS, signal } = {}) {
      if (!key) {
        throw new FalSegmentationError('图像分割服务尚未配置', {
          code: 'SEGMENTATION_NOT_CONFIGURED',
          status: 503,
        });
      }
      if (!isAllowedImageUrl(imageUrl) || !Array.isArray(prompts) || prompts.length > MAX_PROMPTS) {
        throw new FalSegmentationError('图像分割请求不合法', {
          code: 'SEGMENTATION_INPUT_INVALID',
          status: 400,
        });
      }
      const boundedMaxMasks = Math.max(1, Math.min(MAX_PROMPTS, Math.floor(Number(maxMasks) || MAX_PROMPTS)));
      const boxPrompts = prompts.map(normalizeBoxPrompt);
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort(signal?.reason);
      if (signal?.aborted) abortFromCaller();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        let response;
        try {
          response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Key ${key}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              image_url: String(imageUrl).trim(),
              box_prompts: boxPrompts,
              apply_mask: true,
              output_format: 'png',
              return_multiple_masks: true,
              max_masks: boundedMaxMasks,
              include_scores: true,
              include_boxes: true,
            }),
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted && !signal?.aborted) {
            throw publicProviderError('SEGMENTATION_TIMEOUT', 504);
          }
          if (signal?.aborted) throw signal.reason || error;
          throw publicProviderError('SEGMENTATION_PROVIDER_FAILED');
        }

        if (!response?.ok) throw publicProviderError('SEGMENTATION_PROVIDER_FAILED');
        let payload;
        try {
          payload = await response.json();
        } catch {
          throw publicProviderError('SEGMENTATION_RESPONSE_INVALID');
        }
        const result = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
        const rawMasks = Array.isArray(result?.masks) ? result.masks.slice(0, boundedMaxMasks) : [];
        const metadata = Array.isArray(result?.metadata) ? result.metadata : [];
        const masks = rawMasks.map((mask, index) => {
          const url = String(mask?.url || '').trim();
          if (!isAllowedImageUrl(url)) return null;
          const meta = metadata.find(item => Number(item?.index) === index) || metadata[index] || {};
          return {
            url,
            width: Math.max(0, Number(mask?.width) || 0),
            height: Math.max(0, Number(mask?.height) || 0),
            score: Number.isFinite(Number(meta?.score)) ? Number(meta.score) : null,
            box: Array.isArray(meta?.box) ? meta.box.map(Number) : null,
            promptId: prompts[index]?.id ? String(prompts[index].id) : null,
          };
        }).filter(Boolean);
        if (!masks.length) throw publicProviderError('SEGMENTATION_RESPONSE_INVALID');
        return {
          requestId: String(payload?.request_id || result?.request_id || ''),
          masks,
        };
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
      }
    },
  };
}
