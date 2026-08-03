import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PREFIX = 'csp1';
const TOKEN_VERSION = 1;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_PROMPTS = 8;
const MAX_MASK_BYTES = 1024 * 1024;
const MAX_TOTAL_MASK_BYTES = 6 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function segmentationError(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status, retryable: false });
}

function normalizeOwnerEmail(value) {
  const ownerEmail = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!ownerEmail || !ownerEmail.includes('@')) throw new TypeError('ownerEmail is invalid');
  return ownerEmail;
}

function normalizeImageUrl(value) {
  const imageUrl = typeof value === 'string' ? value.trim() : '';
  if (!imageUrl) throw new TypeError('imageUrl is required');
  return imageUrl;
}

function safeDimension(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 16_384) {
    throw new TypeError(`${name} is invalid`);
  }
  return value;
}

function signature(secret, encodedPayload) {
  return createHmac('sha256', secret).update(`${TOKEN_PREFIX}.${encodedPayload}`).digest('base64url');
}

function invalidPlan() {
  return segmentationError('CANVAS_SEGMENTATION_PLAN_INVALID', '智能抠图计划无效，请重试');
}

function parseToken(secret, token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw segmentationError('CANVAS_SEGMENTATION_PLAN_REQUIRED', '缺少智能抠图计划', 400);
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) throw invalidPlan();
  const expected = Buffer.from(signature(secret, parts[1]), 'base64url');
  let actual;
  try {
    actual = Buffer.from(parts[2], 'base64url');
  } catch {
    throw invalidPlan();
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalidPlan();
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload || payload.v !== TOKEN_VERSION || Array.isArray(payload)) throw invalidPlan();
    return payload;
  } catch (error) {
    if (error?.code === 'CANVAS_SEGMENTATION_PLAN_INVALID') throw error;
    throw invalidPlan();
  }
}

function normalizedPrompt(prompt, index) {
  const id = typeof prompt?.id === 'string' ? prompt.id.trim() : '';
  const name = typeof prompt?.name === 'string' && prompt.name.trim() ? prompt.name.trim() : `商品 ${index + 1}`;
  const box = Array.isArray(prompt?.box) ? prompt.box.map(Number) : [];
  if (!id || box.length !== 4 || !box.every(Number.isSafeInteger)) throw invalidPlan();
  if (box[0] < 0 || box[1] < 0 || box[2] <= box[0] || box[3] <= box[1]) throw invalidPlan();
  return { id, name, box };
}

export function createBrowserSegmentationPrompts(plan, {
  width,
  height,
  paddingRatio = 0.12,
} = {}) {
  const sourceWidth = safeDimension(width, 'width');
  const sourceHeight = safeDimension(height, 'height');
  if (!Number.isFinite(paddingRatio) || paddingRatio < 0 || paddingRatio > 0.5) {
    throw new TypeError('paddingRatio is invalid');
  }
  const instances = Array.isArray(plan?.instances) ? plan.instances.slice(0, MAX_PROMPTS) : [];
  return instances.map((instance, index) => {
    const normalized = Array.isArray(instance?.box) ? instance.box.map(Number) : [];
    if (normalized.length !== 4 || !normalized.every(Number.isFinite)) throw new TypeError('instance box is invalid');
    const [x, y, boxWidth, boxHeight] = normalized;
    const rawLeft = Math.floor(x * sourceWidth);
    const rawTop = Math.floor(y * sourceHeight);
    const rawRight = Math.ceil((x + boxWidth) * sourceWidth);
    const rawBottom = Math.ceil((y + boxHeight) * sourceHeight);
    const paddingX = Math.ceil(Math.max(1, rawRight - rawLeft) * paddingRatio);
    const paddingY = Math.ceil(Math.max(1, rawBottom - rawTop) * paddingRatio);
    return {
      id: String(instance.id || `product-${index + 1}`).trim(),
      name: String(instance.name || `商品 ${index + 1}`).trim(),
      box: [
        Math.max(0, rawLeft - paddingX),
        Math.max(0, rawTop - paddingY),
        Math.min(sourceWidth, rawRight + paddingX),
        Math.min(sourceHeight, rawBottom + paddingY),
      ],
    };
  }).filter(prompt => prompt.id && prompt.box[2] > prompt.box[0] && prompt.box[3] > prompt.box[1]);
}

export function createCanvasSegmentationPlanTokenService({
  secret,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  if (!(typeof secret === 'string' && secret.length >= 32) && !Buffer.isBuffer(secret)) {
    throw new TypeError('segmentation plan secret must contain at least 32 characters');
  }
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs is invalid');

  return {
    issue({ ownerEmail, imageUrl, source, plan, prompts } = {}) {
      const issuedAtMs = Math.trunc(Number(now()));
      const expiresAtMs = issuedAtMs + ttlMs;
      const normalizedPrompts = Array.isArray(prompts) ? prompts.map(normalizedPrompt) : [];
      if (!normalizedPrompts.length || normalizedPrompts.length > MAX_PROMPTS) throw new TypeError('prompts are invalid');
      const payload = {
        v: TOKEN_VERSION,
        ownerEmail: normalizeOwnerEmail(ownerEmail),
        imageUrl: normalizeImageUrl(imageUrl),
        source: {
          width: safeDimension(source?.width, 'source.width'),
          height: safeDimension(source?.height, 'source.height'),
        },
        plan,
        prompts: normalizedPrompts,
        issuedAt: new Date(issuedAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return {
        planToken: `${TOKEN_PREFIX}.${encodedPayload}.${signature(secret, encodedPayload)}`,
        expiresAt: payload.expiresAt,
      };
    },

    verify({ token, ownerEmail, imageUrl } = {}) {
      const payload = parseToken(secret, token);
      let normalized;
      try {
        normalized = {
          ...payload,
          ownerEmail: normalizeOwnerEmail(payload.ownerEmail),
          imageUrl: normalizeImageUrl(payload.imageUrl),
          source: {
            width: safeDimension(payload.source?.width, 'source.width'),
            height: safeDimension(payload.source?.height, 'source.height'),
          },
          prompts: Array.isArray(payload.prompts) ? payload.prompts.map(normalizedPrompt) : [],
        };
      } catch {
        throw invalidPlan();
      }
      const expiresAtMs = Date.parse(normalized.expiresAt);
      if (!Number.isFinite(expiresAtMs)) throw invalidPlan();
      if (Number(now()) >= expiresAtMs) {
        throw segmentationError('CANVAS_SEGMENTATION_PLAN_EXPIRED', '智能抠图计划已过期，请重试');
      }
      if (normalized.ownerEmail !== normalizeOwnerEmail(ownerEmail)
        || normalized.imageUrl !== normalizeImageUrl(imageUrl)) {
        throw segmentationError('CANVAS_SEGMENTATION_PLAN_MISMATCH', '智能抠图计划与当前图片不匹配');
      }
      if (!normalized.prompts.length || normalized.prompts.length > MAX_PROMPTS) throw invalidPlan();
      return normalized;
    },
  };
}

export function decodeBrowserSegmentationMasks(rawMasks, prompts) {
  if (!Array.isArray(rawMasks) || !Array.isArray(prompts)) {
    throw segmentationError('CANVAS_SEGMENTATION_MASKS_REQUIRED', '缺少浏览器抠图结果', 400);
  }
  const promptsById = new Map(prompts.map((prompt, index) => {
    const normalized = normalizedPrompt(prompt, index);
    return [normalized.id, normalized];
  }));
  const seen = new Set();
  let totalBytes = 0;
  return rawMasks.map(mask => {
    const promptId = typeof mask?.prompt_id === 'string' ? mask.prompt_id.trim() : '';
    if (!promptsById.has(promptId)) {
      throw segmentationError('CANVAS_SEGMENTATION_MASK_UNKNOWN', '抠图结果包含未知商品');
    }
    if (seen.has(promptId)) {
      throw segmentationError('CANVAS_SEGMENTATION_MASK_DUPLICATE', '抠图结果包含重复商品');
    }
    seen.add(promptId);
    const match = typeof mask?.data === 'string'
      ? mask.data.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/)
      : null;
    if (!match) throw segmentationError('CANVAS_SEGMENTATION_MASK_FORMAT', '抠图结果必须是 PNG');
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw segmentationError('CANVAS_SEGMENTATION_MASK_FORMAT', '抠图结果必须是有效 PNG');
    }
    totalBytes += buffer.length;
    if (!buffer.length || buffer.length > MAX_MASK_BYTES || totalBytes > MAX_TOTAL_MASK_BYTES) {
      throw segmentationError('CANVAS_SEGMENTATION_MASK_SIZE', '抠图结果大小超出限制', 413);
    }
    const prompt = promptsById.get(promptId);
    return { promptId, box: prompt.box, buffer };
  });
}

