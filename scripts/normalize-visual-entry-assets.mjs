import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUTPUTS = {
  entry: { width: 420, height: 360, directory: path.join(ROOT, 'public/images/home') },
  recipe: { width: 760, height: 300, directory: path.join(ROOT, 'public/images/visual-recipes') },
};

function usage() {
  throw new Error([
    'Usage: node scripts/normalize-visual-entry-assets.mjs',
    '  --entry-ecommerce=<source>',
    '  --entry-video=<source>',
    '  --entry-xhs=<source>',
    '  --entry-visual=<source>',
    '  --recipe-free=<source>',
    '  --recipe-poster=<source>',
    '  --recipe-social-cover=<source>',
    '  --recipe-brand-kv=<source>',
  ].join('\n'));
}

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    if (!arg.startsWith('--') || !arg.includes('=')) usage();
    const [key, ...rest] = arg.slice(2).split('=');
    const value = rest.join('=').trim();
    if (!value) usage();
    values[key] = value;
  }
  const required = [
    'entry-ecommerce', 'entry-video', 'entry-xhs', 'entry-visual',
    'recipe-free', 'recipe-poster', 'recipe-social-cover', 'recipe-brand-kv',
  ];
  if (required.some(key => !values[key])) usage();
  return values;
}

function isChromaPixel(r, g, b) {
  return g >= 72 && g - r >= 30 && g - b >= 18 && g >= r * 1.22 && g >= b * 1.08;
}

function removeBorderChroma({ data, info }) {
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * info.channels;
    if (isChromaPixel(data[offset], data[offset + 1], data[offset + 2])) queue.push(index);
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % width;
    const y = Math.floor(index / width);
    data[index * info.channels + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < height) enqueue(x, y + 1);
  }

  // Remove a thin green fringe around the cutout without touching interior pixels.
  const alphaAt = (x, y) => data[(y * width + x) * info.channels + 3];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const offset = index * info.channels;
      if (!data[offset + 3] || !isChromaPixel(data[offset], data[offset + 1], data[offset + 2])) continue;
      const neighbors = [
        alphaAt(x - 1, y), alphaAt(x + 1, y), alphaAt(x, y - 1), alphaAt(x, y + 1),
      ];
      if (neighbors.some(alpha => alpha === 0)) data[offset + 3] = Math.min(data[offset + 3], 96);
    }
  }

  return data;
}

async function normalize(sourcePath, outputPath, dimensions) {
  const input = await readFile(sourcePath);
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeBorderChroma(decoded);

  const { data, info } = decoded;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error(`No visible artwork found in ${sourcePath}`);

  const padding = Math.max(2, Math.round(Math.min(info.width, info.height) * 0.01));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(info.width - 1, maxX + padding);
  maxY = Math.min(info.height - 1, maxY + padding);

  const cropped = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({
      width: dimensions.width - 24,
      height: dimensions.height - 24,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  const output = await sharp({
    create: {
      width: dimensions.width,
      height: dimensions.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, gravity: 'centre' }])
    .png()
    .toBuffer();
  const normalized = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minOutputAlpha = 255;
  let outputMinX = normalized.info.width;
  let outputMinY = normalized.info.height;
  let outputMaxX = -1;
  let outputMaxY = -1;
  for (let y = 0; y < normalized.info.height; y++) {
    for (let x = 0; x < normalized.info.width; x++) {
      const alpha = normalized.data[(y * normalized.info.width + x) * normalized.info.channels + 3];
      minOutputAlpha = Math.min(minOutputAlpha, alpha);
      if (alpha <= 8) continue;
      outputMinX = Math.min(outputMinX, x);
      outputMinY = Math.min(outputMinY, y);
      outputMaxX = Math.max(outputMaxX, x);
      outputMaxY = Math.max(outputMaxY, y);
    }
  }
  if (minOutputAlpha !== 0) throw new Error(`Output has no transparent pixels: ${outputPath}`);
  if (outputMinX <= 0 || outputMinY <= 0 || outputMaxX >= dimensions.width - 1 || outputMaxY >= dimensions.height - 1) {
    throw new Error(`Visible artwork touches the output edge: ${outputPath}`);
  }

  await writeFile(outputPath, output);
  const metadata = await sharp(output).metadata();
  return {
    file: path.basename(outputPath),
    width: metadata.width,
    height: metadata.height,
    alpha: metadata.hasAlpha === true,
    sha256: createHash('sha256').update(output).digest('hex'),
  };
}

const values = parseArgs(process.argv.slice(2));
await mkdir(OUTPUTS.entry.directory, { recursive: true });
await mkdir(OUTPUTS.recipe.directory, { recursive: true });

const jobs = [
  ['entry-ecommerce', 'entry-ecommerce.png', OUTPUTS.entry, '/images/home/entry-ecommerce.png', 'Original three-card ecommerce product stack'],
  ['entry-video', 'entry-video.png', OUTPUTS.entry, '/images/home/entry-video.png', 'Original three-card product video sequence'],
  ['entry-xhs', 'entry-xhs.png', OUTPUTS.entry, '/images/home/entry-xhs.png', 'Original three-card lifestyle editorial stack'],
  ['entry-visual', 'entry-visual.png', OUTPUTS.entry, '/images/home/entry-visual.png', 'Original three-card visual design stack'],
  ['recipe-free', 'free.png', OUTPUTS.recipe, '/images/visual-recipes/free.png', 'Original free-creation transformation diptych'],
  ['recipe-poster', 'poster.png', OUTPUTS.recipe, '/images/visual-recipes/poster.png', 'Original poster transformation diptych'],
  ['recipe-social-cover', 'social-cover.png', OUTPUTS.recipe, '/images/visual-recipes/social-cover.png', 'Original social-cover transformation diptych'],
  ['recipe-brand-kv', 'brand-kv.png', OUTPUTS.recipe, '/images/visual-recipes/brand-kv.png', 'Original brand-key-visual transformation diptych'],
];

const assets = {};
for (const [key, filename, output, publicPath, promptSummary] of jobs) {
  const result = await normalize(values[key], path.join(output.directory, filename), output);
  assets[result.file] = {
    path: publicPath,
    sha256: result.sha256,
    width: result.width,
    height: result.height,
    alpha: result.alpha,
    promptSummary,
    kind: key.startsWith('entry-') ? 'entry' : 'recipe',
  };
  process.stdout.write(`normalized ${key} -> ${result.file}\n`);
}

await writeFile(
  path.join(OUTPUTS.entry.directory, 'entry-assets.manifest.json'),
  `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
  'utf8',
);
