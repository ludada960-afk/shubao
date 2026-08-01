import sharp from 'sharp';

import { validateGenerationSize } from './modelCatalog.mjs';
import { planRepair } from './repairPlanner.mjs';
import { normalizeSemanticLayout } from './suiteDiversity.mjs';

const WHITE_BACKGROUND_ROLES = new Set(['white_background', 'white_bg', 'transparent_white']);
const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const BLANK_STDDEV_THRESHOLD = 3;
// Calibrated against accepted 2K product generations; lower values still reject defocused outputs.
const BLUR_EDGE_THRESHOLD = 8;
const PIXEL_SAMPLE_MAX_DIMENSION = 768;
const SEMANTIC_REVIEW_MAX_DIMENSION = 1280;
const SEMANTIC_REVIEW_MAX_BYTES = 1_000_000;

export function buildFormalEcommerceQualityPrompt() {
  const example = {
    productFidelity: { passed: true, confidence: 0.98, issueCodes: [] },
    copyAndLogo: { passed: true, confidence: 0.98, issueCodes: [] },
    visualQuality: {
      passed: true,
      confidence: 0.98,
      issueCodes: [],
      intentFulfillment: {
        passed: true,
        evidence: ['the image visibly fulfills the confirmed shot responsibility'],
      },
      layout: {
        verdict: 'single_product',
        confidence: 0.98,
        evidence: ['one coherent product view in one continuous scene'],
      },
    },
  };
  return `你是电商商品图质检系统。只返回 JSON。
layout.verdict 只能是 single_product、collage 或 uncertain。必须提供数值 confidence 和具体 evidence。
collage 包括 collage、montage、contact sheet 和 multi-candidate layout；单视角的多面板家电仍属于 single_product。
QUALITY_JSON_EXAMPLE_START
${JSON.stringify(example, null, 2)}
QUALITY_JSON_EXAMPLE_END
根据 Product Truth 检查商品主体是否漂移、结构、颜色、包装、Logo 是否被篡改，并检查乱码、错误文字、水印、糊雾、噪点、明显变形、廉价塑料感或不自然阴影。
如果请求中包含 Asset Responsibility，还要检查画面是否明显完成该图已经确认的 purpose、creativeExecution 和 variationKey。只判断画面中可观察的任务，不因主观风格偏好判失败；明确没有完成时令 visualQuality.passed=false，并加入 issueCodes: ["planned_shot_not_fulfilled"]，同时在 intentFulfillment.evidence 说明可见依据。没有足够证据时不要臆造问题。`;
}
export const WHITE_BACKGROUND_REQUIREMENTS = Object.freeze({
  nearWhiteThreshold: 245,
  minNearWhiteCoverage: 0.25,
  minEdgeWhiteCoverage: 0.9,
  edgeThickness: 2,
});
export const TRANSPARENT_BACKGROUND_REQUIREMENTS = Object.freeze({
  transparentAlphaMax: 16,
  opaqueAlphaMin: 239,
  minTransparentCoverage: 0.05,
  minOpaqueCoverage: 0.05,
  minEdgeTransparentCoverage: 0.8,
  edgeThickness: 2,
});

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function own(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

function normalizeRole(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/_\d+$/, '')
    : '';
}

function normalizeFormat(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase().replace(/^\./, '');
  return normalized === 'jpg' ? 'jpeg' : normalized;
}

function normalizeStrings(values) {
  const source = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
  const result = [];
  const seen = new Set();
  for (const value of source) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function commercialIntentFromPlanItem(value, role) {
  const item = isRecord(value) ? value : {};
  const shotIntent = isRecord(own(item, 'shotIntent')) ? own(item, 'shotIntent') : {};
  const result = {
    assetId: typeof own(item, 'id') === 'string' ? own(item, 'id').trim() : '',
    role,
    label: typeof own(item, 'label') === 'string' ? own(item, 'label').trim() : '',
    purpose: typeof own(item, 'purpose') === 'string' ? own(item, 'purpose').trim() : '',
    communicationGoal: typeof own(item, 'communicationGoal') === 'string'
      ? own(item, 'communicationGoal').trim()
      : '',
    plannedPurpose: typeof own(shotIntent, 'plannedPurpose') === 'string'
      ? own(shotIntent, 'plannedPurpose').trim()
      : '',
    creativeExecution: typeof own(shotIntent, 'creativeExecution') === 'string'
      ? own(shotIntent, 'creativeExecution').trim()
      : '',
    variationKey: typeof own(shotIntent, 'variationKey') === 'string'
      ? own(shotIntent, 'variationKey').trim()
      : '',
    groupStrategy: typeof own(shotIntent, 'groupStrategy') === 'string'
      ? own(shotIntent, 'groupStrategy').trim()
      : '',
    dependsOn: normalizeStrings(own(shotIntent, 'dependsOn')),
  };
  const hasConfirmedResponsibility = [
    result.assetId,
    result.label,
    result.purpose,
    result.communicationGoal,
    result.plannedPurpose,
    result.creativeExecution,
    result.variationKey,
    result.groupStrategy,
    result.dependsOn,
  ].some(value => Array.isArray(value) ? value.length > 0 : Boolean(value));
  return hasConfirmedResponsibility ? result : null;
}

async function semanticReviewAsset(buffer, metadata, actualFormat) {
  const width = Number(metadata.width) || 0;
  const height = Number(metadata.height) || 0;
  if (width <= SEMANTIC_REVIEW_MAX_DIMENSION
    && height <= SEMANTIC_REVIEW_MAX_DIMENSION
    && buffer.length <= SEMANTIC_REVIEW_MAX_BYTES) {
    return {
      buffer,
      metadata: { width, height, format: actualFormat },
    };
  }

  const review = await sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize({
      width: SEMANTIC_REVIEW_MAX_DIMENSION,
      height: SEMANTIC_REVIEW_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: review.data,
    metadata: {
      width: review.info.width,
      height: review.info.height,
      format: 'jpeg',
    },
  };
}

function parseExpectedDimensions(input) {
  const raw = own(input, 'generationSize')
    ?? own(input, 'expectedSize')
    ?? own(input, 'dimensions');
  if (typeof raw === 'string') {
    const match = /^(\d+)x(\d+)$/.exec(raw.trim());
    if (!match) return { invalid: true };
    return { width: Number(match[1]), height: Number(match[2]) };
  }
  if (isRecord(raw)) {
    const width = Number(own(raw, 'width'));
    const height = Number(own(raw, 'height'));
    if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
      return { width, height };
    }
    return { invalid: true };
  }
  return null;
}

function statusCheck(status, issueCodes = [], metrics = {}, details = {}) {
  return {
    status,
    passed: status === 'pass' ? true : status === 'fail' ? false : null,
    issueCodes: normalizeStrings(issueCodes),
    metrics,
    details,
  };
}

function finiteConfidence(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function normalizeAdapterResult(value, { requireSemanticLayout = false } = {}) {
  if (!isRecord(value) || !Object.hasOwn(value, 'passed') || typeof value.passed !== 'boolean') {
    return null;
  }
  const confidence = Object.hasOwn(value, 'confidence') ? finiteConfidence(value.confidence) : null;
  if (Object.hasOwn(value, 'confidence') && confidence === null) return null;
  const details = isRecord(own(value, 'details')) ? { ...own(value, 'details') } : {};
  const layout = requireSemanticLayout
    ? normalizeSemanticLayout(own(value, 'layout') ?? own(details, 'layout'))
    : null;
  if (requireSemanticLayout && !layout) return null;
  if (layout) details.layout = layout;
  const layoutFailed = layout?.verdict === 'collage';
  return {
    passed: value.passed && !layoutFailed,
    confidence,
    issueCodes: [...new Set([
      ...normalizeStrings(own(value, 'issueCodes')),
      ...(layoutFailed ? ['suite_collage_layout'] : []),
    ])],
    details,
    observedFingerprint: typeof own(value, 'observedFingerprint') === 'string'
      ? own(value, 'observedFingerprint').trim()
      : '',
    recognizedText: normalizeStrings(own(value, 'recognizedText')),
  };
}

async function runAdapter(adapter, payload, {
  unavailableStatus = 'unavailable',
  failureCode = 'adapter_check_failed',
  requireSemanticLayout = false,
} = {}) {
  if (typeof adapter !== 'function') {
    return statusCheck(unavailableStatus, ['adapter_unavailable']);
  }
  try {
    const normalized = normalizeAdapterResult(await adapter(payload), { requireSemanticLayout });
    if (!normalized) return statusCheck('unavailable', ['invalid_adapter_result']);
    const normalizedIssues = normalized.passed || normalized.issueCodes.length
      ? normalized.issueCodes
      : [failureCode];
    return statusCheck(
      normalized.passed ? 'pass' : 'fail',
      normalizedIssues,
      normalized.confidence === null ? {} : { confidence: normalized.confidence },
      {
        ...normalized.details,
        ...(normalized.observedFingerprint ? { observedFingerprint: normalized.observedFingerprint } : {}),
        ...(normalized.recognizedText.length ? { recognizedText: normalized.recognizedText } : {}),
      },
    );
  } catch (error) {
    return statusCheck('unavailable', ['adapter_error'], {}, {
      message: error instanceof Error ? error.message : 'adapter failed',
    });
  }
}

async function runAdapterWithTransientRetry(adapter, payload, options) {
  const first = await runAdapter(adapter, payload, options);
  if (typeof adapter !== 'function' || first.status !== 'unavailable') return first;
  return runAdapter(adapter, payload, options);
}

export function measureWhiteBackgroundCoverage(data, info) {
  const channels = info.channels;
  const count = info.width * info.height;
  let nearWhite = 0;
  let edgeNearWhite = 0;
  let edgePixels = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * channels;
    const red = data[offset];
    const green = channels > 1 ? data[offset + 1] : red;
    const blue = channels > 2 ? data[offset + 2] : red;
    const white = red >= WHITE_BACKGROUND_REQUIREMENTS.nearWhiteThreshold
      && green >= WHITE_BACKGROUND_REQUIREMENTS.nearWhiteThreshold
      && blue >= WHITE_BACKGROUND_REQUIREMENTS.nearWhiteThreshold;
    if (white) nearWhite += 1;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    const edge = WHITE_BACKGROUND_REQUIREMENTS.edgeThickness;
    const onEdge = x < edge || y < edge || x >= info.width - edge || y >= info.height - edge;
    if (onEdge) {
      edgePixels += 1;
      if (white) edgeNearWhite += 1;
    }
  }
  return {
    edgeWhiteCoverage: Number((edgePixels ? edgeNearWhite / edgePixels : 0).toFixed(4)),
    nearWhiteCoverage: Number((nearWhite / count).toFixed(4)),
  };
}

export function isWhiteBackgroundCompliant(metrics) {
  return metrics?.nearWhiteCoverage >= WHITE_BACKGROUND_REQUIREMENTS.minNearWhiteCoverage
    && metrics?.edgeWhiteCoverage >= WHITE_BACKGROUND_REQUIREMENTS.minEdgeWhiteCoverage;
}

export function measureAlphaCoverage(data, info) {
  const channels = info.channels;
  const count = info.width * info.height;
  let transparent = 0;
  let opaque = 0;
  let edgeTransparent = 0;
  let edgePixels = 0;
  for (let index = 0; index < count; index += 1) {
    const alpha = channels >= 4 ? data[index * channels + 3] : 255;
    if (alpha <= TRANSPARENT_BACKGROUND_REQUIREMENTS.transparentAlphaMax) transparent += 1;
    if (alpha >= TRANSPARENT_BACKGROUND_REQUIREMENTS.opaqueAlphaMin) opaque += 1;
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    const edge = TRANSPARENT_BACKGROUND_REQUIREMENTS.edgeThickness;
    const onEdge = x < edge || y < edge || x >= info.width - edge || y >= info.height - edge;
    if (onEdge) {
      edgePixels += 1;
      if (alpha <= TRANSPARENT_BACKGROUND_REQUIREMENTS.transparentAlphaMax) edgeTransparent += 1;
    }
  }
  return {
    transparentCoverage: Number((transparent / count).toFixed(4)),
    opaqueCoverage: Number((opaque / count).toFixed(4)),
    edgeTransparentCoverage: Number((edgePixels ? edgeTransparent / edgePixels : 0).toFixed(4)),
  };
}

export function isTransparentBackgroundCompliant(metrics) {
  return metrics?.transparentCoverage >= TRANSPARENT_BACKGROUND_REQUIREMENTS.minTransparentCoverage
    && metrics?.opaqueCoverage >= TRANSPARENT_BACKGROUND_REQUIREMENTS.minOpaqueCoverage
    && metrics?.edgeTransparentCoverage >= TRANSPARENT_BACKGROUND_REQUIREMENTS.minEdgeTransparentCoverage;
}

function pixelMetrics(data, info) {
  const channels = info.channels;
  const count = info.width * info.height;
  const luminance = new Float32Array(count);
  let sum = 0;
  let sumSquares = 0;
  const whiteBackground = measureWhiteBackgroundCoverage(data, info);
  const alpha = measureAlphaCoverage(data, info);

  for (let index = 0; index < count; index += 1) {
    const offset = index * channels;
    const red = data[offset];
    const green = channels > 1 ? data[offset + 1] : red;
    const blue = channels > 2 ? data[offset + 2] : red;
    const value = (red + green + blue) / 3;
    luminance[index] = value;
    sum += value;
    sumSquares += value * value;
  }

  const gradientHistogram = new Uint32Array(766);
  let gradientCount = 0;
  const recordGradient = (left, right) => {
    const bucket = Math.min(765, Math.max(0, Math.round(Math.abs(left - right) * 3)));
    gradientHistogram[bucket] += 1;
    gradientCount += 1;
  };
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      if (x + 1 < info.width) recordGradient(luminance[index], luminance[index + 1]);
      if (y + 1 < info.height) recordGradient(luminance[index], luminance[index + info.width]);
    }
  }
  const topCount = Math.max(1, Math.ceil(gradientCount * 0.05));
  let remaining = topCount;
  let gradientTotal = 0;
  for (let bucket = gradientHistogram.length - 1; bucket >= 0 && remaining > 0; bucket -= 1) {
    const selected = Math.min(remaining, gradientHistogram[bucket]);
    gradientTotal += selected * (bucket / 3);
    remaining -= selected;
  }
  const edgeStrength = gradientTotal / topCount;
  const mean = sum / count;
  const variance = Math.max(0, (sumSquares / count) - (mean * mean));

  return {
    edgeStrength: Number(edgeStrength.toFixed(3)),
    edgeWhiteCoverage: whiteBackground.edgeWhiteCoverage,
    edgeTransparentCoverage: alpha.edgeTransparentCoverage,
    luminanceStdDev: Number(Math.sqrt(variance).toFixed(3)),
    nearWhiteCoverage: whiteBackground.nearWhiteCoverage,
    opaqueCoverage: alpha.opaqueCoverage,
    transparentCoverage: alpha.transparentCoverage,
  };
}

function missingBufferResult(input) {
  const checks = {
    technical: statusCheck('fail', ['missing_image_buffer']),
    productFidelity: statusCheck('unavailable', ['image_unavailable']),
    copyAndLogo: normalizeStrings(own(input, 'requiredText')).length
      ? statusCheck('unavailable', ['image_unavailable'])
      : statusCheck('skipped'),
    platformCompliance: statusCheck('unavailable', ['image_unavailable']),
    visualQuality: statusCheck('unavailable', ['image_unavailable']),
  };
  const result = {
    passed: false,
    checks,
    repairAction: null,
    confidence: 'low',
  };
  result.repairAction = planRepair(result);
  if (result.repairAction.type === 'manual_review') {
    result.repairAction = {
      type: 'regenerate_from_product_truth',
      focusIssueCodes: ['missing_image_buffer'],
      preserveUserFacts: true,
      userCharge: false,
    };
  }
  return result;
}

export async function evaluateAsset(input = {}, adapters = {}) {
  const safeInput = isRecord(input) ? input : {};
  const buffer = own(safeInput, 'buffer') ?? own(safeInput, 'imageBuffer');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return missingBufferResult(safeInput);
  const role = normalizeRole(own(safeInput, 'role') ?? own(safeInput, 'roleKey'));

  let metadata;
  let raw;
  try {
    const image = sharp(buffer, { failOn: 'error' });
    metadata = await image.metadata();
    raw = await image.clone()
      .resize({
        width: PIXEL_SAMPLE_MAX_DIMENSION,
        height: PIXEL_SAMPLE_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    const checks = {
      technical: statusCheck('fail', ['invalid_image'], {}, {
        message: error instanceof Error ? error.message : 'invalid image',
      }),
      productFidelity: statusCheck('unavailable', ['image_unavailable']),
      copyAndLogo: statusCheck('unavailable', ['image_unavailable']),
      platformCompliance: statusCheck('unavailable', ['image_unavailable']),
      visualQuality: statusCheck('unavailable', ['image_unavailable']),
    };
    const result = { passed: false, checks, repairAction: null, confidence: 'low' };
    result.repairAction = planRepair(result);
    return result;
  }

  const expectedDimensions = parseExpectedDimensions(safeInput);
  const expectedFormat = normalizeFormat(own(safeInput, 'expectedFormat'));
  const actualFormat = normalizeFormat(metadata.format);
  const technicalIssues = [];
  if (expectedDimensions?.invalid) technicalIssues.push('invalid_expected_dimensions');
  if (expectedDimensions?.width
    && (metadata.width !== expectedDimensions.width || metadata.height !== expectedDimensions.height)) {
    technicalIssues.push('dimension_mismatch');
  }
  if (expectedFormat && actualFormat !== expectedFormat) technicalIssues.push('format_mismatch');
  if (!SUPPORTED_FORMATS.has(actualFormat)) technicalIssues.push('unsupported_format');
  try {
    validateGenerationSize(`${metadata.width}x${metadata.height}`);
  } catch {
    technicalIssues.push('illegal_generation_dimensions');
  }
  const metrics = pixelMetrics(raw.data, raw.info);
  const technical = statusCheck(
    technicalIssues.length ? 'fail' : 'pass',
    technicalIssues,
    {
      actualWidth: metadata.width,
      actualHeight: metadata.height,
      expectedWidth: expectedDimensions?.width ?? null,
      expectedHeight: expectedDimensions?.height ?? null,
      actualFormat,
      expectedFormat: expectedFormat || null,
      byteLength: buffer.length,
    },
  );

  const platformIssues = [];
  if (WHITE_BACKGROUND_ROLES.has(role)
    && !isWhiteBackgroundCompliant(metrics)) {
    platformIssues.push('white_background_insufficient');
  }
  if (role === 'transparent' && !isTransparentBackgroundCompliant(metrics)) {
    platformIssues.push('transparent_background_missing');
  }
  const platformCompliance = statusCheck(
    platformIssues.length ? 'fail' : 'pass',
    platformIssues,
    {
      nearWhiteCoverage: metrics.nearWhiteCoverage,
      edgeWhiteCoverage: metrics.edgeWhiteCoverage,
      requiredNearWhiteCoverage: WHITE_BACKGROUND_ROLES.has(role)
        ? WHITE_BACKGROUND_REQUIREMENTS.minNearWhiteCoverage
        : null,
      requiredEdgeWhiteCoverage: WHITE_BACKGROUND_ROLES.has(role)
        ? WHITE_BACKGROUND_REQUIREMENTS.minEdgeWhiteCoverage
        : null,
      transparentCoverage: metrics.transparentCoverage,
      opaqueCoverage: metrics.opaqueCoverage,
      edgeTransparentCoverage: metrics.edgeTransparentCoverage,
      requiredTransparentCoverage: role === 'transparent'
        ? TRANSPARENT_BACKGROUND_REQUIREMENTS.minTransparentCoverage
        : null,
      requiredOpaqueCoverage: role === 'transparent'
        ? TRANSPARENT_BACKGROUND_REQUIREMENTS.minOpaqueCoverage
        : null,
      requiredEdgeTransparentCoverage: role === 'transparent'
        ? TRANSPARENT_BACKGROUND_REQUIREMENTS.minEdgeTransparentCoverage
        : null,
    },
  );

  const reviewAsset = await semanticReviewAsset(buffer, metadata, actualFormat);
  const commercialIntent = commercialIntentFromPlanItem(own(safeInput, 'assetPlanItem'), role);
  const adapterPayload = {
    ...reviewAsset,
    role,
    productTruth: isRecord(own(safeInput, 'productTruth')) ? { ...own(safeInput, 'productTruth') } : {},
    ...(commercialIntent ? { commercialIntent } : {}),
  };
  const productFidelity = await runAdapterWithTransientRetry(
    own(adapters, 'productFidelity'),
    adapterPayload,
    {
      failureCode: 'product_fidelity_failed',
    },
  );
  const visualAdapter = await runAdapterWithTransientRetry(
    own(adapters, 'visualQuality'),
    adapterPayload,
    {
      failureCode: 'visual_quality_failed',
      requireSemanticLayout: true,
    },
  );
  const deterministicVisualIssues = [];
  if (metrics.luminanceStdDev < BLANK_STDDEV_THRESHOLD) {
    deterministicVisualIssues.push('blank_or_uniform');
  } else if (metrics.edgeStrength < BLUR_EDGE_THRESHOLD && visualAdapter.status !== 'pass') {
    // A fixed pixel-gradient threshold is not resolution invariant. Preserve it as a fallback
    // signal, but do not override a successful semantic quality review of a real product image.
    deterministicVisualIssues.push('too_blurry');
  }
  const visualStatus = deterministicVisualIssues.length || visualAdapter.status === 'fail'
    ? 'fail'
    : visualAdapter.status === 'pass'
      ? 'pass'
      : 'unavailable';
  const visualQuality = statusCheck(
    visualStatus,
    [
      ...deterministicVisualIssues,
      ...(visualAdapter.status === 'fail' || visualAdapter.status === 'unavailable'
        ? visualAdapter.issueCodes
        : []),
    ],
    {
      luminanceStdDev: metrics.luminanceStdDev,
      edgeStrength: metrics.edgeStrength,
      blankThreshold: BLANK_STDDEV_THRESHOLD,
      blurThreshold: BLUR_EDGE_THRESHOLD,
      pixelSampleWidth: raw.info.width,
      pixelSampleHeight: raw.info.height,
      ...(visualAdapter.metrics || {}),
    },
    {
      deterministicStatus: deterministicVisualIssues.length ? 'fail' : 'pass',
      adapterStatus: visualAdapter.status,
      ...visualAdapter.details,
    },
  );

  const requiredText = normalizeStrings(own(safeInput, 'requiredText'));
  const requiredLogos = normalizeStrings(own(safeInput, 'requiredLogos'));
  const copyAndLogo = requiredText.length || requiredLogos.length
    ? await runAdapterWithTransientRetry(own(adapters, 'ocr'), {
      ...adapterPayload,
      requiredText,
      requiredLogos,
    }, {
      failureCode: 'copy_or_logo_failed',
    })
    : statusCheck('skipped');

  const checks = {
    technical,
    productFidelity,
    copyAndLogo,
    platformCompliance,
    visualQuality,
  };
  const requiredChecks = [technical, productFidelity, platformCompliance, visualQuality];
  if (requiredText.length || requiredLogos.length) requiredChecks.push(copyAndLogo);
  const hasFailure = requiredChecks.some((check) => check.status === 'fail');
  const hasUnavailable = requiredChecks.some((check) => check.status === 'unavailable');
  const passed = requiredChecks.every((check) => check.status === 'pass');
  const confidence = passed
    ? 'high'
    : !hasFailure && hasUnavailable ? 'medium' : 'low';
  const result = {
    passed,
    retryable: !hasFailure && hasUnavailable,
    checks,
    repairAction: null,
    confidence,
  };
  result.repairAction = planRepair(result);
  return result;
}
