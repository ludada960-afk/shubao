import sharp from 'sharp';

const SAMPLE_SIZE = 32;
const NEAR_DUPLICATE_THRESHOLD = 0.04;
const CROSS_ASPECT_NEAR_DUPLICATE_THRESHOLD = 0.035;
const SEMANTIC_LAYOUT_CONFIDENCE_THRESHOLD = 0.7;

function cleanRole(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function semanticPart(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function normalizeSemanticLayout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const verdict = semanticPart(value.verdict);
  const confidence = value.confidence;
  const evidence = Array.isArray(value.evidence)
    ? [...new Set(value.evidence.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean))]
    : [];
  if (!['single_product', 'collage'].includes(verdict)
    || !Number.isFinite(confidence)
    || confidence < SEMANTIC_LAYOUT_CONFIDENCE_THRESHOLD
    || confidence > 1
    || evidence.length === 0) {
    return null;
  }
  return { verdict, confidence, evidence };
}

export function suiteSemanticKey(item = {}) {
  const shot = item?.shotIntent && typeof item.shotIntent === 'object' && !Array.isArray(item.shotIntent)
    ? item.shotIntent
    : {};
  return [
    item?.communicationGoal,
    shot.type,
    shot.camera?.azimuth,
    shot.crop,
    shot.interactionState,
    shot.sceneFamily,
  ].map(semanticPart).join('|');
}

function completeSemanticKey(item) {
  const key = suiteSemanticKey(item);
  return key.split('|').every(Boolean) ? key : '';
}

function diversityFamily(role) {
  const normalized = cleanRole(role);
  if (['white_background', 'white_bg', 'transparent'].includes(normalized)) return `isolated:${normalized}`;
  if (['main', 'main_text', 'main_3x4'].includes(normalized)) return 'main';
  if (normalized.startsWith('detail_slice_') || normalized === 'detail') return 'detail';
  if (normalized === 'sku' || normalized.startsWith('sku_')) return 'sku';
  return normalized || 'other';
}

function aspectRatio(item) {
  const raw = typeof item?.ratio === 'string' ? item.ratio.trim() : '';
  const match = /^(\d+)\s*:\s*(\d+)$/.exec(raw);
  if (!match) return 0;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : 0;
}

function duplicateThreshold(candidate, existing) {
  const candidateRole = cleanRole(candidate?.role);
  const existingRole = cleanRole(existing?.role);
  const candidateRatio = aspectRatio(candidate?.assetPlanItem);
  const existingRatio = aspectRatio(existing?.assetPlanItem);
  if (candidateRole && existingRole && candidateRole !== existingRole
    && candidateRatio && existingRatio && Math.abs(candidateRatio - existingRatio) >= 0.1) {
    return CROSS_ASPECT_NEAR_DUPLICATE_THRESHOLD;
  }
  return NEAR_DUPLICATE_THRESHOLD;
}

function lineScores(pixels, width, height, axis) {
  const scores = [];
  const limit = axis === 'vertical' ? width : height;
  const cross = axis === 'vertical' ? height : width;
  for (let position = 1; position < limit; position += 1) {
    let total = 0;
    for (let index = 0; index < cross; index += 1) {
      const current = axis === 'vertical' ? index * width + position : position * width + index;
      const previous = axis === 'vertical' ? current - 1 : current - width;
      total += Math.abs(pixels[current] - pixels[previous]);
    }
    scores.push(total / cross);
  }
  return scores;
}

function lineTransitionProfiles(pixels, width, height, axis) {
  const profiles = [];
  const limit = axis === 'vertical' ? width : height;
  const cross = axis === 'vertical' ? height : width;
  for (let position = 1; position < limit; position += 1) {
    let total = 0;
    let strong = 0;
    for (let index = 0; index < cross; index += 1) {
      const current = axis === 'vertical' ? index * width + position : position * width + index;
      const previous = axis === 'vertical' ? current - 1 : current - width;
      const difference = Math.abs(pixels[current] - pixels[previous]);
      total += difference;
      if (difference >= 24) strong += 1;
    }
    profiles.push({ mean: total / cross, coverage: strong / cross });
  }
  return profiles;
}

function fullSpanBoundaryCount(profiles) {
  const peaks = [];
  for (let index = 1; index < profiles.length - 1; index += 1) {
    const profile = profiles[index];
    if (profile.mean < 28 || profile.coverage < 0.85) continue;
    if (profile.mean < profiles[index - 1].mean || profile.mean < profiles[index + 1].mean) continue;
    if (!peaks.length || index - peaks.at(-1) >= 4) peaks.push(index);
    else if (profile.mean > profiles[peaks.at(-1)].mean) peaks[peaks.length - 1] = index;
  }
  return peaks.length;
}

function fullSpanGutterCount(pixels, width, height, axis) {
  const limit = axis === 'vertical' ? width : height;
  const cross = axis === 'vertical' ? height : width;
  const uniform = [];
  for (let position = 0; position < limit; position += 1) {
    let min = 255;
    let max = 0;
    for (let index = 0; index < cross; index += 1) {
      const offset = axis === 'vertical' ? index * width + position : position * width + index;
      min = Math.min(min, pixels[offset]);
      max = Math.max(max, pixels[offset]);
    }
    uniform.push(max - min <= 14);
  }

  const maxGutterWidth = Math.max(2, Math.floor(limit * 0.08));
  let count = 0;
  for (let start = 0; start < limit;) {
    if (!uniform[start]) {
      start += 1;
      continue;
    }
    let end = start;
    while (end + 1 < limit && uniform[end + 1]) end += 1;
    const widthOfRun = end - start + 1;
    const internal = start > 1 && end < limit - 2;
    if (internal && widthOfRun <= maxGutterWidth) count += 1;
    start = end + 1;
  }
  return count;
}

function seamCount(scores) {
  if (!scores.length) return 0;
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const variance = scores.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / scores.length;
  const threshold = Math.max(28, mean + Math.sqrt(variance) * 2.2);
  const peaks = [];
  for (let index = 2; index < scores.length - 2; index += 1) {
    const value = scores[index];
    if (value < threshold || value < scores[index - 1] || value < scores[index + 1]) continue;
    if (!peaks.length || index - peaks.at(-1) >= 4) peaks.push(index);
    else if (value > scores[peaks.at(-1)]) peaks[peaks.length - 1] = index;
  }
  return peaks.length;
}

export async function measureSuiteImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new TypeError('suite image buffer is required');
  const { data, info } = await sharp(buffer, { failOn: 'error' })
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const fingerprint = Array.from(data, value => value / 255);
  const verticalSeams = seamCount(lineScores(data, info.width, info.height, 'vertical'));
  const horizontalSeams = seamCount(lineScores(data, info.width, info.height, 'horizontal'));
  const verticalBoundaries = fullSpanBoundaryCount(
    lineTransitionProfiles(data, info.width, info.height, 'vertical'),
  );
  const horizontalBoundaries = fullSpanBoundaryCount(
    lineTransitionProfiles(data, info.width, info.height, 'horizontal'),
  );
  const verticalGutters = fullSpanGutterCount(data, info.width, info.height, 'vertical');
  const horizontalGutters = fullSpanGutterCount(data, info.width, info.height, 'horizontal');
  // Product-confined seams are valid product structure. Collage evidence must
  // span the image as repeated strip boundaries or as intersecting gutters.
  const likelyCollage = verticalBoundaries >= 2
    || horizontalBoundaries >= 2
    || verticalGutters >= 2
    || horizontalGutters >= 2
    || (verticalBoundaries >= 1 && horizontalBoundaries >= 1)
    || (verticalGutters >= 1 && horizontalGutters >= 1);
  return {
    fingerprint,
    verticalSeams,
    horizontalSeams,
    verticalBoundaries,
    horizontalBoundaries,
    verticalGutters,
    horizontalGutters,
    likelyCollage,
  };
}

export function visualFingerprintDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 1;
  const total = left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0);
  return total / left.length;
}

function validMeasurement(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray(value.fingerprint)
    && value.fingerprint.length === SAMPLE_SIZE * SAMPLE_SIZE
    && value.fingerprint.every(item => Number.isFinite(item));
}

async function resolveMeasurement(asset) {
  if (validMeasurement(asset?.measurement)) return asset.measurement;
  if (Buffer.isBuffer(asset?.buffer)) return measureSuiteImage(asset.buffer);
  if (typeof asset?.loadBuffer === 'function') {
    const buffer = await asset.loadBuffer();
    return measureSuiteImage(buffer);
  }
  return null;
}

export async function evaluateSuiteDiversity({ candidate = {}, existing = [], semanticLayout } = {}) {
  const candidateSemanticKey = completeSemanticKey(candidate.assetPlanItem);
  if (candidateSemanticKey) {
    for (const asset of Array.isArray(existing) ? existing : []) {
      if (completeSemanticKey(asset?.assetPlanItem) !== candidateSemanticKey) continue;
      return {
        passed: false,
        issueCodes: ['suite_semantic_duplicate'],
        details: {
          duplicateOf: String(asset.assetId || ''),
          semanticKey: candidateSemanticKey,
        },
      };
    }
  }
  const measured = await resolveMeasurement(candidate);
  if (!measured) throw new TypeError('suite candidate image is required');
  if (measured.likelyCollage) {
    return {
      passed: false,
      issueCodes: ['suite_collage_layout'],
      details: {
        verticalSeams: measured.verticalSeams,
        horizontalSeams: measured.horizontalSeams,
      },
    };
  }

  const normalizedLayout = normalizeSemanticLayout(semanticLayout);
  if (!normalizedLayout) {
    return {
      passed: false,
      issueCodes: ['suite_collage_semantic_unavailable'],
      details: {
        verticalSeams: measured.verticalSeams,
        horizontalSeams: measured.horizontalSeams,
      },
    };
  }
  if (normalizedLayout.verdict === 'collage') {
    return {
      passed: false,
      issueCodes: ['suite_collage_layout'],
      details: {
        semanticLayout: normalizedLayout,
        verticalSeams: measured.verticalSeams,
        horizontalSeams: measured.horizontalSeams,
      },
    };
  }

  const family = diversityFamily(candidate.role);
  for (const asset of Array.isArray(existing) ? existing : []) {
    if (diversityFamily(asset?.role) !== family) continue;
    const other = await resolveMeasurement(asset);
    if (!other) continue;
    const distance = visualFingerprintDistance(measured.fingerprint, other.fingerprint);
    const threshold = duplicateThreshold(candidate, asset);
    if (distance <= threshold) {
      return {
        passed: false,
        issueCodes: ['suite_near_duplicate'],
        details: {
          duplicateOf: String(asset.assetId || ''),
          family,
          distance: Number(distance.toFixed(4)),
          threshold,
        },
      };
    }
  }
  return {
    passed: true,
    issueCodes: [],
    details: {
      family,
      semanticLayout: normalizedLayout,
      verticalSeams: measured.verticalSeams,
      horizontalSeams: measured.horizontalSeams,
      measurement: measured,
    },
  };
}
