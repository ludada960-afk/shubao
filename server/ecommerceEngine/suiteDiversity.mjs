import sharp from 'sharp';

const SAMPLE_SIZE = 32;
const NEAR_DUPLICATE_THRESHOLD = 0.04;

function cleanRole(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function semanticPart(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
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
  return {
    fingerprint,
    verticalSeams,
    horizontalSeams,
    likelyCollage: verticalSeams >= 2 || horizontalSeams >= 2 || (verticalSeams >= 1 && horizontalSeams >= 1),
  };
}

export function visualFingerprintDistance(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 1;
  const total = left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0);
  return total / left.length;
}

export async function evaluateSuiteDiversity({ candidate = {}, existing = [] } = {}) {
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
  const measured = await measureSuiteImage(candidate.buffer);
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

  const family = diversityFamily(candidate.role);
  for (const asset of Array.isArray(existing) ? existing : []) {
    if (diversityFamily(asset?.role) !== family || !Buffer.isBuffer(asset?.buffer)) continue;
    const other = await measureSuiteImage(asset.buffer);
    const distance = visualFingerprintDistance(measured.fingerprint, other.fingerprint);
    if (distance <= NEAR_DUPLICATE_THRESHOLD) {
      return {
        passed: false,
        issueCodes: ['suite_near_duplicate'],
        details: {
          duplicateOf: String(asset.assetId || ''),
          family,
          distance: Number(distance.toFixed(4)),
          threshold: NEAR_DUPLICATE_THRESHOLD,
        },
      };
    }
  }
  return {
    passed: true,
    issueCodes: [],
    details: {
      family,
      verticalSeams: measured.verticalSeams,
      horizontalSeams: measured.horizontalSeams,
    },
  };
}
