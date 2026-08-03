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

function normalizedXyxyFromCxcywh(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(value => Number.isFinite(Number(value)))) return null;
  const [cx, cy, width, height] = box.map(Number);
  if (width <= 0 || height <= 0) return null;
  return [cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2];
}

function boxAffinity(left, right) {
  if (!left || !right) return Number.NEGATIVE_INFINITY;
  const intersectionWidth = Math.max(0, Math.min(left[2], right[2]) - Math.max(left[0], right[0]));
  const intersectionHeight = Math.max(0, Math.min(left[3], right[3]) - Math.max(left[1], right[1]));
  const intersection = intersectionWidth * intersectionHeight;
  const leftArea = Math.max(0, left[2] - left[0]) * Math.max(0, left[3] - left[1]);
  const rightArea = Math.max(0, right[2] - right[0]) * Math.max(0, right[3] - right[1]);
  const union = leftArea + rightArea - intersection;
  if (union > 0 && intersection > 0) return 1 + intersection / union;
  const leftCenterX = (left[0] + left[2]) / 2;
  const leftCenterY = (left[1] + left[3]) / 2;
  const rightCenterX = (right[0] + right[2]) / 2;
  const rightCenterY = (right[1] + right[3]) / 2;
  return -Math.hypot(leftCenterX - rightCenterX, leftCenterY - rightCenterY);
}

function matchPromptIds({ boxes, objectIds = [], prompts, imageWidth, imageHeight }) {
  if (prompts.length === 1) {
    const promptId = prompts[0]?.id ? String(prompts[0].id) : null;
    return boxes.map(() => promptId);
  }
  if (!prompts.length) return boxes.map(() => null);
  const width = Number(imageWidth);
  const height = Number(imageHeight);
  const canMatchGeometry = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  const promptBoxes = canMatchGeometry
    ? prompts.map(prompt => [
      Number(prompt.box[0]) / width,
      Number(prompt.box[1]) / height,
      Number(prompt.box[2]) / width,
      Number(prompt.box[3]) / height,
    ])
    : [];
  const result = boxes.map(() => null);
  const usedPrompts = new Set();
  const promptById = new Map(prompts.map((prompt, index) => [String(prompt?.id || ''), index]));
  for (let outputIndex = 0; outputIndex < boxes.length; outputIndex += 1) {
    const rawObjectId = objectIds[outputIndex];
    if (rawObjectId == null || rawObjectId === '') continue;
    const numericObjectId = Number(rawObjectId);
    const promptIndex = Number.isSafeInteger(numericObjectId) && numericObjectId >= 1 && numericObjectId <= prompts.length
      ? numericObjectId - 1
      : promptById.get(String(rawObjectId));
    if (promptIndex == null || usedPrompts.has(promptIndex)) continue;
    result[outputIndex] = String(prompts[promptIndex]?.id || '') || null;
    if (result[outputIndex]) usedPrompts.add(promptIndex);
  }

  const unresolvedOutputs = boxes
    .map((_, index) => index)
    .filter(index => !result[index]);
  const availablePrompts = prompts
    .map((_, index) => index)
    .filter(index => !usedPrompts.has(index));
  if (!unresolvedOutputs.length) return result;
  if (!canMatchGeometry || unresolvedOutputs.length > availablePrompts.length) return result;

  const affinities = unresolvedOutputs.map(outputIndex => {
    const normalizedBox = normalizedXyxyFromCxcywh(boxes[outputIndex]);
    return availablePrompts.map(promptIndex => boxAffinity(normalizedBox, promptBoxes[promptIndex]));
  });
  let best = null;
  let secondBestScore = Number.NEGATIVE_INFINITY;
  const visit = (row, usedColumns, assignment, score) => {
    if (row === unresolvedOutputs.length) {
      if (!best || score > best.score) {
        if (best) secondBestScore = Math.max(secondBestScore, best.score);
        best = { score, assignment: [...assignment] };
      } else {
        secondBestScore = Math.max(secondBestScore, score);
      }
      return;
    }
    for (let column = 0; column < availablePrompts.length; column += 1) {
      if (usedColumns.has(column) || affinities[row][column] <= 1) continue;
      usedColumns.add(column);
      assignment.push(column);
      visit(row + 1, usedColumns, assignment, score + affinities[row][column]);
      assignment.pop();
      usedColumns.delete(column);
    }
  };
  visit(0, new Set(), [], 0);
  if (!best || (Number.isFinite(secondBestScore) && best.score - secondBestScore < 0.01)) return result;
  best.assignment.forEach((column, row) => {
    const prompt = prompts[availablePrompts[column]];
    result[unresolvedOutputs[row]] = prompt?.id ? String(prompt.id) : null;
  });
  return result;
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
    async segment({ imageUrl, prompts = [], maxMasks = MAX_PROMPTS, imageWidth, imageHeight, signal } = {}) {
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
        const scores = Array.isArray(result?.scores) ? result.scores : [];
        const boxes = rawMasks.map((_, index) => {
          const meta = metadata.find(item => Number(item?.index) === index) || metadata[index] || {};
          return Array.isArray(meta?.box) ? meta.box.map(Number) : Array.isArray(result?.boxes?.[index]) ? result.boxes[index].map(Number) : null;
        });
        const objectIds = rawMasks.map((mask, index) => {
          const meta = metadata.find(item => Number(item?.index) === index) || metadata[index] || {};
          return meta?.object_id ?? meta?.objectId ?? mask?.object_id ?? result?.object_ids?.[index] ?? null;
        });
        const promptIds = matchPromptIds({ boxes, objectIds, prompts, imageWidth, imageHeight });
        const masks = rawMasks.map((mask, index) => {
          const url = String(mask?.url || '').trim();
          if (!isAllowedImageUrl(url) || (prompts.length > 0 && !promptIds[index])) return null;
          const meta = metadata.find(item => Number(item?.index) === index) || metadata[index] || {};
          const score = meta?.score ?? scores[index];
          return {
            url,
            width: Math.max(0, Number(mask?.width) || 0),
            height: Math.max(0, Number(mask?.height) || 0),
            score: Number.isFinite(Number(score)) ? Number(score) : null,
            box: boxes[index],
            promptId: promptIds[index],
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
