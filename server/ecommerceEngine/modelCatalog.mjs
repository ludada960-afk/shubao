export const LEGAL_IMAGE_SIZES = Object.freeze({
  '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048' },
  '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840' },
});

const RESOLUTIONS = new Set(Object.keys(LEGAL_IMAGE_SIZES));
const MAX_EDGE = 3840;
const MAX_PIXELS = 8_294_400;

function parseDimensions(size) {
  if (typeof size === 'string') {
    const match = /^\s*(\d+)x(\d+)\s*$/.exec(size);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
  }

  if (size && typeof size === 'object' && !Array.isArray(size)) {
    return { width: size.width, height: size.height };
  }

  throw new TypeError('Generation size must be expressed as WIDTHxHEIGHT');
}

export function validateGenerationSize(size) {
  const { width, height } = parseDimensions(size);
  const validInteger = Number.isInteger(width) && Number.isInteger(height);

  if (!validInteger || width <= 0 || height <= 0) {
    throw new RangeError('Generation dimensions must be positive integers');
  }
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new RangeError('Generation dimensions must be multiples of 16');
  }
  if (width > MAX_EDGE || height > MAX_EDGE) {
    throw new RangeError('Generation dimensions exceed the maximum edge');
  }
  if (width * height > MAX_PIXELS) {
    throw new RangeError('Generation dimensions exceed the maximum pixel count');
  }
  if (Math.max(width, height) / Math.min(width, height) > 3) {
    throw new RangeError('Generation dimensions exceed the maximum aspect ratio');
  }

  return true;
}

function campaignBibleIsConfirmed(input) {
  return input.campaignConfirmed === true
    || input.campaignBibleConfirmed === true
    || input.campaignBible?.confirmed === true;
}

function hasExplicitFourKRequirement(input) {
  return input.resolution === '4K'
    || input.explicit4K === true
    || input.requires4K === true
    || input.fourKRequired === true;
}

export function selectGenerationModel(input = {}) {
  const assetCount = input.assetCount;
  const eligibleBatch = Number.isInteger(assetCount)
    && assetCount >= 2
    && assetCount <= 4
    && input.batchEligible !== false
    && campaignBibleIsConfirmed(input)
    && input.sameStyle === true
    && input.highRiskFacts === false
    && !hasExplicitFourKRequirement(input);

  return eligibleBatch ? 'gpt-image-2-n' : 'gpt-image-2';
}

export function resolveGenerationSize(input = {}) {
  let resolution = RESOLUTIONS.has(input.resolution) ? input.resolution : '2K';
  const requestedRatio = input.ratio ?? input.aspectRatio;
  if (requestedRatio && !Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio)) {
    const resolutionOrder = Object.keys(LEGAL_IMAGE_SIZES);
    const requestedIndex = resolutionOrder.indexOf(resolution);
    const promoted = resolutionOrder.slice(Math.max(0, requestedIndex + 1)).find(candidate => Object.hasOwn(LEGAL_IMAGE_SIZES[candidate], requestedRatio));
    if (promoted) resolution = promoted;
  }
  const ratio = Object.hasOwn(LEGAL_IMAGE_SIZES[resolution], requestedRatio) ? requestedRatio : '1:1';
  const size = LEGAL_IMAGE_SIZES[resolution][ratio];

  validateGenerationSize(size);

  return { resolution, ratio, size };
}

export function buildModelRoute(input = {}) {
  const { resolution, size } = resolveGenerationSize(input);

  return {
    model: selectGenerationModel({ ...input, resolution }),
    size,
    async: true,
    mode: 'edit',
  };
}
