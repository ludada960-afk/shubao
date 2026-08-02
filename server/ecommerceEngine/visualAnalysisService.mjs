import { createHash } from 'node:crypto';

import { buildProductTruthPrompt, mergeProductFacts, normalizeProductTruth } from './productTruth.mjs';
import { buildStyleReferencePrompt, normalizeStyleReferenceProfile } from './styleReferenceProfile.mjs';

const MIN_CONFIDENCE = 0.5;
const PRODUCT_STRING_FIELDS = Object.freeze([
  ['category'],
  ['productName', 'product_name'],
  ['silhouette'],
]);
const PRODUCT_STRING_LIST_FIELDS = Object.freeze([
  ['primaryColors', 'primary_colors'],
  ['materials'],
  ['components'],
  ['forbiddenMutations', 'forbidden_mutations'],
  ['sourceAssetIds', 'source_asset_ids'],
]);
const PRODUCT_RECORD_FIELDS = Object.freeze([
  ['skuFacts', 'sku_facts'],
  ['confirmedFacts', 'confirmed_facts'],
  ['facts'],
]);
const STYLE_STRING_FIELDS = Object.freeze([
  ['lighting'],
  ['composition'],
  ['cameraLanguage', 'camera_language'],
  ['typographyIntent', 'typography_intent'],
  ['informationDensity', 'information_density'],
  ['backgroundLanguage', 'background_language'],
  ['mood'],
]);
const STYLE_STRING_LIST_FIELDS = Object.freeze([
  ['palette', 'colors', 'color_palette'],
  ['prohibitedTransfers', 'prohibited_transfers'],
  ['sourceAssetIds', 'source_asset_ids'],
]);

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
  if (!Array.isArray(value)) {
    throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', `${label} assets must be an array`, {
      status: 400,
      retryable: false,
    });
  }
  const seen = new Set();
  return value.flatMap((asset) => {
    if (!isRecord(asset)) {
      throw codedError('VISUAL_ANALYSIS_INVALID_INPUT', `${label} asset is invalid`, {
        status: 400,
        retryable: false,
      });
    }
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

function invalidResponse(type, detail) {
  return codedError('VISUAL_ANALYSIS_INVALID_RESPONSE', `${type} visual analysis ${detail}`, {
    status: 502,
    retryable: false,
  });
}

function valuesForAliases(result, aliases) {
  return aliases.flatMap(key => Object.hasOwn(result, key) ? [result[key]] : []);
}

function assertStringFields(result, fieldGroups, type) {
  for (const aliases of fieldGroups) {
    for (const value of valuesForAliases(result, aliases)) {
      if (typeof value !== 'string') throw invalidResponse(type, `field ${aliases[0]} has an invalid type`);
    }
  }
}

function assertStringListFields(result, fieldGroups, type) {
  for (const aliases of fieldGroups) {
    for (const value of valuesForAliases(result, aliases)) {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw invalidResponse(type, `field ${aliases[0]} has an invalid type`);
      }
    }
  }
}

function assertRecordFields(result, fieldGroups, type) {
  for (const aliases of fieldGroups) {
    for (const value of valuesForAliases(result, aliases)) {
      if (!isRecord(value)) throw invalidResponse(type, `field ${aliases[0]} has an invalid type`);
    }
  }
}

function assertBoundedOptionalConfidence(record, type, label) {
  if (!Object.hasOwn(record, 'confidence')) return;
  const confidence = record.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)
    || confidence < 0 || confidence > 1) {
    throw invalidResponse(type, `${label} confidence is invalid`);
  }
}

function assertProductEntryFields(result, type) {
  for (const value of valuesForAliases(result, ['packageText', 'package_text'])) {
    if (!Array.isArray(value)) throw invalidResponse(type, 'field packageText has an invalid type');
    for (const entry of value) {
      if (!isRecord(entry) || !cleanString(entry.text ?? entry.value)) {
        throw invalidResponse(type, 'field packageText contains an invalid entry');
      }
      if (Object.hasOwn(entry, 'sourceAssetId') && typeof entry.sourceAssetId !== 'string') {
        throw invalidResponse(type, 'field packageText contains an invalid sourceAssetId');
      }
      if (Object.hasOwn(entry, 'source_asset_id') && typeof entry.source_asset_id !== 'string') {
        throw invalidResponse(type, 'field packageText contains an invalid sourceAssetId');
      }
      assertBoundedOptionalConfidence(entry, type, 'packageText entry');
    }
  }
  for (const value of valuesForAliases(result, ['logos'])) {
    if (!Array.isArray(value)) throw invalidResponse(type, 'field logos has an invalid type');
    for (const entry of value) {
      if (!isRecord(entry) || !cleanString(entry.description ?? entry.text ?? entry.value)) {
        throw invalidResponse(type, 'field logos contains an invalid entry');
      }
      if (Object.hasOwn(entry, 'sourceAssetId') && typeof entry.sourceAssetId !== 'string') {
        throw invalidResponse(type, 'field logos contains an invalid sourceAssetId');
      }
      if (Object.hasOwn(entry, 'source_asset_id') && typeof entry.source_asset_id !== 'string') {
        throw invalidResponse(type, 'field logos contains an invalid sourceAssetId');
      }
      assertBoundedOptionalConfidence(entry, type, 'logo entry');
    }
  }
  for (const value of valuesForAliases(result, ['uncertainFacts', 'uncertain_facts'])) {
    if (!Array.isArray(value) || value.some(entry => !isRecord(entry))) {
      throw invalidResponse(type, 'field uncertainFacts has an invalid type');
    }
  }
}

function sanitizeOptionalProductFields(result) {
  const normalized = { ...result };
  for (const key of ['uncertainFacts', 'uncertain_facts']) {
    if (!Object.hasOwn(normalized, key)) continue;
    if (!Array.isArray(normalized[key])) {
      delete normalized[key];
      continue;
    }
    normalized[key] = normalized[key].filter(isRecord);
  }
  return normalized;
}

function sanitizeOptionalStyleFields(result) {
  const normalized = { ...result };
  for (const aliases of STYLE_STRING_FIELDS) {
    for (const key of aliases) {
      if (Object.hasOwn(normalized, key) && typeof normalized[key] !== 'string') delete normalized[key];
    }
  }
  for (const aliases of STYLE_STRING_LIST_FIELDS) {
    for (const key of aliases) {
      if (!Object.hasOwn(normalized, key)) continue;
      if (!Array.isArray(normalized[key])) {
        delete normalized[key];
        continue;
      }
      normalized[key] = normalized[key].filter(item => typeof item === 'string');
    }
  }
  return normalized;
}

function hasMeaningfulString(result, fieldGroups) {
  return fieldGroups.some(aliases => valuesForAliases(result, aliases).some(value => cleanString(value)));
}

function hasMeaningfulStringList(result, fieldGroups) {
  return fieldGroups.some(aliases => valuesForAliases(result, aliases)
    .some(value => value.some(item => cleanString(item))));
}

function hasMeaningfulProductEntry(result, aliases) {
  return valuesForAliases(result, aliases).some(value => value.length > 0);
}

function assertResultShape(result, type) {
  if (!isRecord(result)) throw invalidResponse(type, 'returned invalid JSON');
  if (type === 'product') {
    assertStringFields(result, PRODUCT_STRING_FIELDS, type);
    assertStringListFields(result, PRODUCT_STRING_LIST_FIELDS, type);
    assertRecordFields(result, PRODUCT_RECORD_FIELDS, type);
    assertProductEntryFields(result, type);
    const hasProductData = hasMeaningfulString(result, PRODUCT_STRING_FIELDS)
      || hasMeaningfulStringList(result, PRODUCT_STRING_LIST_FIELDS.slice(0, 3))
      || hasMeaningfulProductEntry(result, ['packageText', 'package_text'])
      || hasMeaningfulProductEntry(result, ['logos']);
    if (!hasProductData) throw invalidResponse(type, 'did not include required product fields');
    return;
  }
  if (type === 'style') {
    assertStringFields(result, STYLE_STRING_FIELDS, type);
    assertStringListFields(result, STYLE_STRING_LIST_FIELDS, type);
    const hasStyleData = hasMeaningfulString(result, STYLE_STRING_FIELDS)
      || hasMeaningfulStringList(result, [STYLE_STRING_LIST_FIELDS[0]]);
    if (!hasStyleData) throw invalidResponse(type, 'did not include required style fields');
    return;
  }
  throw invalidResponse(type, 'type is unsupported');
}

function assertConfidence(result, type) {
  const confidence = result.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)
    || confidence < 0 || confidence > 1) {
    throw invalidResponse(type, 'confidence must be a finite number from 0 to 1');
  }
  if (confidence < MIN_CONFIDENCE) {
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
  assertResultShape(result, type);
  assertConfidence(result, type);
  return result;
}

export function createVisualAnalysisService({
  store,
  readAsset,
  callVision,
  model = 'gpt-5.5',
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
      const normalizedRaw = type === 'product'
        ? sanitizeOptionalProductFields(raw)
        : sanitizeOptionalStyleFields(raw);
      assertResultShape(normalizedRaw, type);
      const confidence = assertConfidence(normalizedRaw, type);
      const result = normalize({ ...normalizedRaw, sourceAssetIds: assetIds });
      result.confidence = confidence;
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
