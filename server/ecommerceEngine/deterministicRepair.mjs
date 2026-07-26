import sharp from 'sharp';

const BACKGROUND_EDGE_THICKNESS = 2;
const MIN_NEUTRAL_BACKGROUND = 225;
const MAX_NEUTRAL_CHROMA = 12;
const BORDER_COLOR_DISTANCE_LIMIT = 14;
const MIN_BORDER_COLOR_CONSISTENCY = 0.94;
const BACKGROUND_DISTANCE_LIMIT = 42;
const FULL_TRANSPARENCY_DISTANCE = 6;
const MIN_REMOVABLE_BACKGROUND_COVERAGE = 0.5;
const MAX_REMOVABLE_BACKGROUND_COVERAGE = 0.9;
const LIGHT_NEUTRAL_ENGLISH = /(?:^|[^a-z])(?:white|ivory|cream|off[\s-]*white|light[\s-]*gr[ae]y|silver)(?:[^a-z]|$)/i;
const LIGHT_NEUTRAL_CHINESE = /(?:白色|纯白|米白|象牙白|象牙色|奶油白|奶油色|乳白|浅灰|淡灰|银色|银灰|银白)/;

function targetDimensions(item) {
  const match = /^(\d+)x(\d+)$/.exec(String(item?.generationSize || '').trim());
  if (!match) throw new Error('修复目标尺寸无效');
  return { width: Number(match[1]), height: Number(match[2]) };
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function colorDistance(data, offset, background) {
  return Math.max(
    Math.abs(data[offset] - background.r),
    Math.abs(data[offset + 1] - background.g),
    Math.abs(data[offset + 2] - background.b),
  );
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function borderBackground(data, info) {
  const samples = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const edge = x < BACKGROUND_EDGE_THICKNESS
        || y < BACKGROUND_EDGE_THICKNESS
        || x >= info.width - BACKGROUND_EDGE_THICKNESS
        || y >= info.height - BACKGROUND_EDGE_THICKNESS;
      if (!edge) continue;
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] < 239) continue;
      samples.push({
        r: data[offset],
        g: data[offset + 1],
        b: data[offset + 2],
      });
    }
  }
  if (!samples.length) return null;
  const background = {
    r: median(samples.map(sample => sample.r)),
    g: median(samples.map(sample => sample.g)),
    b: median(samples.map(sample => sample.b)),
  };
  const channels = [background.r, background.g, background.b];
  const luminance = channels.reduce((sum, value) => sum + value, 0) / channels.length;
  const chroma = Math.max(...channels) - Math.min(...channels);
  if (luminance < MIN_NEUTRAL_BACKGROUND || chroma > MAX_NEUTRAL_CHROMA) return null;
  const consistent = samples.filter(sample => Math.max(
    Math.abs(sample.r - background.r),
    Math.abs(sample.g - background.g),
    Math.abs(sample.b - background.b),
  ) <= BORDER_COLOR_DISTANCE_LIMIT).length;
  return consistent / samples.length >= MIN_BORDER_COLOR_CONSISTENCY ? background : null;
}

function unblendChannel(channel, background, opacity) {
  if (opacity <= 0.08 || opacity >= 0.98) return channel;
  return clampByte((channel - background * (1 - opacity)) / opacity);
}

function factText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(factText).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';
  return typeof value.value === 'string' ? value.value : '';
}

function lightNeutralProduct(productTruth) {
  if (!productTruth || typeof productTruth !== 'object' || Array.isArray(productTruth)) return false;
  const values = [
    factText(Object.hasOwn(productTruth, 'primaryColors') ? productTruth.primaryColors : null),
    factText(Object.hasOwn(productTruth, 'materials') ? productTruth.materials : null),
  ];
  const confirmedFacts = Object.hasOwn(productTruth, 'confirmedFacts')
    && productTruth.confirmedFacts
    && typeof productTruth.confirmedFacts === 'object'
    && !Array.isArray(productTruth.confirmedFacts)
    ? productTruth.confirmedFacts
    : {};
  for (const [name, fact] of Object.entries(confirmedFacts)) {
    if (/(?:color|colour|material|颜色|色彩|材质)/i.test(name)) values.push(factText(fact));
  }
  return values.some(value => LIGHT_NEUTRAL_ENGLISH.test(value) || LIGHT_NEUTRAL_CHINESE.test(value));
}

function opaquePng(data, info) {
  const opaque = Buffer.from(data);
  for (let offset = 3; offset < opaque.length; offset += 4) opaque[offset] = 255;
  return sharp(opaque, { raw: info }).png().toBuffer();
}

export async function normalizeTransparentBackground({
  buffer,
  width,
  height,
  productTruth,
} = {}) {
  const raw = await sharp(buffer)
    .rotate()
    .resize({ width, height, fit: 'fill' })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  if (lightNeutralProduct(productTruth)) return opaquePng(data, raw.info);
  const background = borderBackground(data, raw.info);
  if (!background) return opaquePng(data, raw.info);

  const count = raw.info.width * raw.info.height;
  const connected = new Uint8Array(count);
  const queued = new Uint8Array(count);
  const queue = [];
  const enqueue = (index) => {
    if (queued[index]) return;
    const offset = index * 4;
    if (colorDistance(data, offset, background) > BACKGROUND_DISTANCE_LIMIT) return;
    queued[index] = 1;
    queue.push(index);
  };
  for (let x = 0; x < raw.info.width; x += 1) {
    enqueue(x);
    enqueue((raw.info.height - 1) * raw.info.width + x);
  }
  for (let y = 0; y < raw.info.height; y += 1) {
    enqueue(y * raw.info.width);
    enqueue(y * raw.info.width + raw.info.width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    connected[index] = 1;
    const x = index % raw.info.width;
    const y = Math.floor(index / raw.info.width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < raw.info.width) enqueue(index + 1);
    if (y > 0) enqueue(index - raw.info.width);
    if (y + 1 < raw.info.height) enqueue(index + raw.info.width);
  }

  const removableCoverage = connected.reduce((sum, value) => sum + value, 0) / count;
  if (removableCoverage < MIN_REMOVABLE_BACKGROUND_COVERAGE
    || removableCoverage > MAX_REMOVABLE_BACKGROUND_COVERAGE) {
    return opaquePng(data, raw.info);
  }

  for (let index = 0; index < count; index += 1) {
    if (!connected[index]) continue;
    const offset = index * 4;
    const distance = colorDistance(data, offset, background);
    const opacity = Math.max(0, Math.min(
      1,
      (distance - FULL_TRANSPARENCY_DISTANCE)
        / (BACKGROUND_DISTANCE_LIMIT - FULL_TRANSPARENCY_DISTANCE),
    ));
    const originalAlpha = data[offset + 3] / 255;
    const outputOpacity = Math.min(originalAlpha, opacity);
    data[offset] = unblendChannel(data[offset], background.r, outputOpacity);
    data[offset + 1] = unblendChannel(data[offset + 1], background.g, outputOpacity);
    data[offset + 2] = unblendChannel(data[offset + 2], background.b, outputOpacity);
    data[offset + 3] = clampByte(outputOpacity * 255);
  }

  return sharp(data, { raw: raw.info }).png().toBuffer();
}

export async function repairEcommerceAsset({
  buffer,
  action,
  item,
  productTruth,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new TypeError('修复图片不能为空');
  const { width, height } = targetDimensions(item);
  const operations = new Set(Array.isArray(action?.operations) ? action.operations : []);
  if (operations.has('normalize_transparent_background')) {
    return {
      buffer: await normalizeTransparentBackground({
        buffer,
        width,
        height,
        productTruth,
      }),
      contentType: 'image/png',
    };
  }

  let pipeline = sharp(buffer).rotate().resize({ width, height, fit: 'fill' });
  if (operations.has('normalize_white_background')) {
    pipeline = pipeline.flatten({ background: '#ffffff' });
  }
  return {
    buffer: await pipeline.png().toBuffer(),
    contentType: 'image/png',
  };
}
