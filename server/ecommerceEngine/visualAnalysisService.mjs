import { createHash } from 'node:crypto';

import { buildProductTruthPrompt, mergeProductFacts, normalizeProductTruth } from './productTruth.mjs';
import { buildStyleReferencePrompt, normalizeStyleReferenceProfile } from './styleReferenceProfile.mjs';

const MIN_CONFIDENCE = 0.5;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function normalizeAssets(value, label) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((asset) => {
    if (!isRecord(asset)) return [];
    const assetId = cleanString(asset.assetId ?? asset.asset_id ?? asset.id);
    if (!assetId) {
      throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', `${label} asset ID is required`, {
        status: 400,
        retryable: false,
      });
    }
    if (seen.has(assetId)) return [];
    seen.add(assetId);
    return [{ ...asset, assetId }];
  });
}

function cacheKey({ assetIds, model, promptVersion, type }) {
  return createHash('sha256').update(JSON.stringify({
    assetIds: [...assetIds].sort(),
    model,
    promptVersion,
    type,
  })).digest('hex');
}

function confidenceOf(result) {
  return typeof result?.confidence === 'number' && Number.isFinite(result.confidence)
    ? Math.max(0, Math.min(1, result.confidence))
    : null;
}

function assertConfidence(result, type) {
  const confidence = confidenceOf(result);
  if (confidence !== null && confidence < MIN_CONFIDENCE) {
    throw codedError('VISUAL_ANALYSIS_LOW_CONFIDENCE', `${type} visual analysis confidence is too low`, {
      status: 422,
      retryable: false,
    });
  }
  return confidence;
}

function imageDataUrl(image) {
  if (!image || !Buffer.isBuffer(image.buffer) || image.buffer.length === 0) {
    throw new TypeError('visual analysis asset reader returned invalid image bytes');
  }
  const contentType = cleanString(image.contentType) || 'image/png';
  if (!contentType.startsWith('image/')) throw new TypeError('visual analysis asset is not an image');
  return `data:${contentType};base64,${image.buffer.toString('base64')}`;
}

function validateCachedResult(result, type) {
  if (!isRecord(result)) {
    throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', `${type} visual analysis returned invalid JSON`, {
      status: 502,
      retryable: true,
    });
  }
  assertConfidence(result, type);
  return result;
}

export function createVisualAnalysisService({
  store,
  readAsset,
  callVision,
  model = 'gpt-5.6-terra',
  promptVersion = 'visual-analysis-v1',
} = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    throw new TypeError('visual analysis store get and put are required');
  }
  if (typeof readAsset !== 'function' || typeof callVision !== 'function') {
    throw new TypeError('visual analysis readAsset and callVision functions are required');
  }
  const modelName = cleanString(model);
  const version = cleanString(promptVersion);
  if (!modelName || !version) throw new TypeError('visual analysis model and prompt version are required');

  async function analyzeType({ type, assets, prompt, normalize }) {
    const assetIds = assets.map(asset => asset.assetId);
    const key = cacheKey({ assetIds, model: modelName, promptVersion: version, type });
    const cached = store.get(key);
    if (cached) return { key, result: validateCachedResult(cached, type) };

    try {
      const images = [];
      const resolvedAssets = [];
      for (const asset of assets) {
        const image = await readAsset(asset);
        images.push(imageDataUrl(image));
        resolvedAssets.push({ assetId: asset.assetId, contentType: cleanString(image.contentType) || 'image/png' });
      }
      const raw = await callVision({
        type,
        model: modelName,
        promptVersion: version,
        ...prompt,
        assets: resolvedAssets,
        images,
      });
      if (!isRecord(raw)) {
        throw codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', `${type} visual analysis returned invalid JSON`, {
          status: 502,
          retryable: true,
        });
      }
      const confidence = assertConfidence(raw, type);
      const result = normalize({ ...raw, sourceAssetIds: assetIds });
      if (confidence !== null) result.confidence = confidence;
      store.put({ key, type, model: modelName, promptVersion: version, result });
      return { key, result };
    } catch (error) {
      if (cleanString(error?.code).startsWith('VISUAL_ANALYSIS_')) throw error;
      throw codedError('VISUAL_ANALYSIS_UNAVAILABLE', '图片分析服务暂时不可用', {
        status: 503,
        retryable: true,
        cause: error,
      });
    }
  }

  return {
    async analyze({ productAssets = [], styleAssets = [], userFacts = {} } = {}) {
      const products = normalizeAssets(productAssets, 'product');
      const styles = normalizeAssets(styleAssets, 'style');
      if (products.length === 0) {
        throw codedError('VISUAL_ANALYSIS_INPUT_REQUIRED', '请至少上传一张清晰的产品图', {
          status: 400,
          retryable: false,
        });
      }

      const product = await analyzeType({
        type: 'product',
        assets: products,
        prompt: buildProductTruthPrompt({ sourceAssetIds: products.map(asset => asset.assetId) }),
        normalize: normalizeProductTruth,
      });
      const style = styles.length > 0
        ? await analyzeType({
            type: 'style',
            assets: styles,
            prompt: buildStyleReferencePrompt({ sourceAssetIds: styles.map(asset => asset.assetId) }),
            normalize: normalizeStyleReferenceProfile,
          })
        : { key: '', result: normalizeStyleReferenceProfile() };
      const productTruth = mergeProductFacts({ vision: product.result, user: isRecord(userFacts) ? userFacts : {} });
      if (product.result.confidence !== null && product.result.confidence !== undefined) {
        productTruth.confidence = product.result.confidence;
      }

      return {
        productTruth,
        styleReferenceProfile: style.result,
        cache: { product: product.key, style: style.key },
      };
    },
  };
}
