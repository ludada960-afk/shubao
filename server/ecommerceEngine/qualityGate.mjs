import sharp from 'sharp';

import { validateGenerationSize } from './modelCatalog.mjs';
import { planRepair } from './repairPlanner.mjs';

const WHITE_BACKGROUND_ROLES = new Set(['white_background', 'white_bg', 'transparent_white']);
const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const BLANK_STDDEV_THRESHOLD = 3;
const BLUR_EDGE_THRESHOLD = 18;
export const WHITE_BACKGROUND_REQUIREMENTS = Object.freeze({
  nearWhiteThreshold: 245,
  minNearWhiteCoverage: 0.25,
  minEdgeWhiteCoverage: 0.9,
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

function normalizeAdapterResult(value) {
  if (!isRecord(value) || !Object.hasOwn(value, 'passed') || typeof value.passed !== 'boolean') {
    return null;
  }
  const confidence = Object.hasOwn(value, 'confidence') ? finiteConfidence(value.confidence) : null;
  if (Object.hasOwn(value, 'confidence') && confidence === null) return null;
  return {
    passed: value.passed,
    confidence,
    issueCodes: normalizeStrings(own(value, 'issueCodes')),
    details: isRecord(own(value, 'details')) ? { ...own(value, 'details') } : {},
    observedFingerprint: typeof own(value, 'observedFingerprint') === 'string'
      ? own(value, 'observedFingerprint').trim()
      : '',
    recognizedText: normalizeStrings(own(value, 'recognizedText')),
  };
}

async function runAdapter(adapter, payload, {
  unavailableStatus = 'unavailable',
  failureCode = 'adapter_check_failed',
} = {}) {
  if (typeof adapter !== 'function') {
    return statusCheck(unavailableStatus, ['adapter_unavailable']);
  }
  try {
    const normalized = normalizeAdapterResult(await adapter(payload));
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

function pixelMetrics(data, info) {
  const channels = info.channels;
  const count = info.width * info.height;
  const luminance = new Float64Array(count);
  let sum = 0;
  let sumSquares = 0;
  const whiteBackground = measureWhiteBackgroundCoverage(data, info);

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

  const gradients = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      if (x + 1 < info.width) gradients.push(Math.abs(luminance[index] - luminance[index + 1]));
      if (y + 1 < info.height) gradients.push(Math.abs(luminance[index] - luminance[index + info.width]));
    }
  }
  gradients.sort((left, right) => right - left);
  const topCount = Math.max(1, Math.ceil(gradients.length * 0.05));
  const edgeStrength = gradients.slice(0, topCount)
    .reduce((total, value) => total + value, 0) / topCount;
  const mean = sum / count;
  const variance = Math.max(0, (sumSquares / count) - (mean * mean));

  return {
    edgeStrength: Number(edgeStrength.toFixed(3)),
    edgeWhiteCoverage: whiteBackground.edgeWhiteCoverage,
    luminanceStdDev: Number(Math.sqrt(variance).toFixed(3)),
    nearWhiteCoverage: whiteBackground.nearWhiteCoverage,
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

  let metadata;
  let raw;
  try {
    const image = sharp(buffer, { failOn: 'error' });
    metadata = await image.metadata();
    raw = await image.clone().toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
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

  const role = normalizeRole(own(safeInput, 'role') ?? own(safeInput, 'roleKey'));
  const platformIssues = [];
  if (WHITE_BACKGROUND_ROLES.has(role)
    && !isWhiteBackgroundCompliant(metrics)) {
    platformIssues.push('white_background_insufficient');
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
    },
  );

  const deterministicVisualIssues = [];
  if (metrics.luminanceStdDev < BLANK_STDDEV_THRESHOLD) deterministicVisualIssues.push('blank_or_uniform');
  else if (metrics.edgeStrength < BLUR_EDGE_THRESHOLD) deterministicVisualIssues.push('too_blurry');

  const adapterPayload = {
    buffer,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: actualFormat,
    },
    role,
    productTruth: isRecord(own(safeInput, 'productTruth')) ? { ...own(safeInput, 'productTruth') } : {},
  };
  const productFidelity = await runAdapter(own(adapters, 'productFidelity'), adapterPayload, {
    failureCode: 'product_fidelity_failed',
  });
  const visualAdapter = await runAdapter(own(adapters, 'visualQuality'), adapterPayload, {
    failureCode: 'visual_quality_failed',
  });
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
    ? await runAdapter(own(adapters, 'ocr'), {
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
  const passed = Object.values(checks).every((check) => check.status !== 'fail');
  const confidence = passed
    ? Object.values(checks).some((check) => check.status === 'unavailable') ? 'medium' : 'high'
    : 'low';
  const result = {
    passed,
    checks,
    repairAction: null,
    confidence,
  };
  result.repairAction = planRepair(result);
  return result;
}
