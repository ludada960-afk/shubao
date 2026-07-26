import sharp from 'sharp';

const BACKGROUND_EDGE_THICKNESS = 2;
const MIN_NEUTRAL_BACKGROUND = 180;
const MAX_NEUTRAL_CHROMA = 20;
const BACKGROUND_DISTANCE_LIMIT = 96;
const FULL_TRANSPARENCY_DISTANCE = 8;

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

function borderBackground(data, info) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let samples = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const edge = x < BACKGROUND_EDGE_THICKNESS
        || y < BACKGROUND_EDGE_THICKNESS
        || x >= info.width - BACKGROUND_EDGE_THICKNESS
        || y >= info.height - BACKGROUND_EDGE_THICKNESS;
      if (!edge) continue;
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] === 0) continue;
      red += data[offset];
      green += data[offset + 1];
      blue += data[offset + 2];
      samples += 1;
    }
  }
  if (!samples) return null;
  const background = {
    r: red / samples,
    g: green / samples,
    b: blue / samples,
  };
  const channels = [background.r, background.g, background.b];
  const luminance = channels.reduce((sum, value) => sum + value, 0) / channels.length;
  const chroma = Math.max(...channels) - Math.min(...channels);
  return luminance >= MIN_NEUTRAL_BACKGROUND && chroma <= MAX_NEUTRAL_CHROMA
    ? background
    : null;
}

function unblendChannel(channel, background, opacity) {
  if (opacity <= 0.08 || opacity >= 0.98) return channel;
  return clampByte((channel - background * (1 - opacity)) / opacity);
}

export async function normalizeTransparentBackground({ buffer, width, height } = {}) {
  const raw = await sharp(buffer)
    .rotate()
    .resize({ width, height, fit: 'fill' })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const data = Buffer.from(raw.data);
  const background = borderBackground(data, raw.info);
  if (!background) {
    return sharp(data, { raw: raw.info }).png().toBuffer();
  }

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

export async function repairEcommerceAsset({ buffer, action, item } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new TypeError('修复图片不能为空');
  const { width, height } = targetDimensions(item);
  const operations = new Set(Array.isArray(action?.operations) ? action.operations : []);
  if (operations.has('normalize_transparent_background')) {
    return {
      buffer: await normalizeTransparentBackground({ buffer, width, height }),
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
