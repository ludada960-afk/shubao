import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharp from 'sharp';

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_ROOT, '..');
const SOURCE_ROOT = resolve(PROJECT_ROOT, 'public/images/home/tryon-showcase');
const DEFAULT_OUTPUT_ROOT = SOURCE_ROOT;
const DEFAULT_THUMB_ROOT = resolve(PROJECT_ROOT, 'public/images/.thumbs/home/tryon-showcase');
const SOCIAL_SOURCE_ROOT = resolve(PROJECT_ROOT, 'public/images/visual-recipes/cases');
const DEFAULT_SOCIAL_OUTPUT_ROOT = resolve(PROJECT_ROOT, 'public/images/home/social-showcase');
const DEFAULT_SOCIAL_THUMB_ROOT = resolve(PROJECT_ROOT, 'public/images/.thumbs/home/social-showcase');

export const HOME_SHOWCASE_COMPOSITES = Object.freeze([
  Object.freeze({ id: 'tryon-selector-front-motion', kind: 'selector', ratio: '4:3', width: 1200, height: 900, sources: ['angle-front.png', 'angle-motion.png'] }),
  Object.freeze({ id: 'tryon-selector-side-back', kind: 'selector', ratio: '4:3', width: 1200, height: 900, sources: ['angle-side.png', 'angle-back.png'] }),
  Object.freeze({ id: 'tryon-selector-source-result', kind: 'selector', ratio: '4:3', width: 1200, height: 900, sources: ['editorial-flatlay-v3.webp', 'editorial-street-result-v3.webp'] }),
  Object.freeze({ id: 'tryon-reference-workflow', kind: 'workflow', ratio: '16:9', width: 1600, height: 900, sources: ['editorial-flatlay-v3.webp', 'editorial-model-v3.webp', 'editorial-street-result-v3.webp'] }),
]);

export const SOCIAL_SHOWCASE_ADAPTATIONS = Object.freeze([
  Object.freeze({
    id: 'social-douyin-stretch-card',
    source: 'social-douyin-stretch.png',
    ratio: '3:4',
    width: 1200,
    height: 1600,
    provenance: 'production-composite',
  }),
]);

async function fullFrame(sourcePath, width, height) {
  const background = await sharp(sourcePath)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .blur(24)
    .modulate({ brightness: 1.04, saturation: 0.7 })
    .png()
    .toBuffer();
  const foreground = await sharp(sourcePath)
    .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp(background)
    .composite([
      { input: Buffer.from('<svg width="100%" height="100%"><rect width="100%" height="100%" fill="rgba(255,255,255,.30)"/></svg>') },
      { input: foreground },
    ])
    .png()
    .toBuffer();
}

async function buildPair(definition) {
  const panelWidth = 570;
  const panelHeight = 860;
  const panels = await Promise.all(definition.sources.map(source => fullFrame(resolve(SOURCE_ROOT, source), panelWidth, panelHeight)));
  return sharp({ create: { width: definition.width, height: definition.height, channels: 4, background: '#eee9e2' } })
    .composite([
      { input: panels[0], left: 20, top: 20 },
      { input: panels[1], left: 610, top: 20 },
    ])
    .png()
    .toBuffer();
}

function marker(symbol) {
  return Buffer.from(`<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="29" fill="#ffffff" stroke="#d8d0c8" stroke-width="2"/><text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#5b524b">${symbol}</text></svg>`);
}

async function buildWorkflow(definition) {
  const [product, model, result] = await Promise.all([
    fullFrame(resolve(SOURCE_ROOT, definition.sources[0]), 520, 760),
    fullFrame(resolve(SOURCE_ROOT, definition.sources[1]), 392, 700),
    fullFrame(resolve(SOURCE_ROOT, definition.sources[2]), 392, 700),
  ]);
  return sharp({ create: { width: definition.width, height: definition.height, channels: 4, background: '#f4f1ed' } })
    .composite([
      { input: product, left: 44, top: 70 },
      { input: marker('+'), left: 576, top: 418 },
      { input: model, left: 650, top: 100 },
      { input: marker('>'), left: 1058, top: 418 },
      { input: result, left: 1148, top: 100 },
    ])
    .png()
    .toBuffer();
}

export async function buildHomeShowcaseComposites({
  outputRoot = DEFAULT_OUTPUT_ROOT,
  thumbRoot = DEFAULT_THUMB_ROOT,
  writeThumbs = true,
} = {}) {
  await mkdir(outputRoot, { recursive: true });
  if (writeThumbs) await mkdir(thumbRoot, { recursive: true });
  const outputs = [];
  for (const definition of HOME_SHOWCASE_COMPOSITES) {
    const bytes = definition.kind === 'workflow'
      ? await buildWorkflow(definition)
      : await buildPair(definition);
    const outputPath = resolve(outputRoot, `${definition.id}.png`);
    await sharp(bytes).png().toFile(outputPath);
    if (writeThumbs) {
      await sharp(bytes)
        .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(resolve(thumbRoot, `${definition.id}.webp`));
    }
    outputs.push({
      ...definition,
      path: outputPath,
      pixelRatio: `${definition.width}:${definition.height}`,
    });
  }
  return outputs;
}

export async function buildSocialShowcaseAdaptations({
  outputRoot = DEFAULT_SOCIAL_OUTPUT_ROOT,
  thumbRoot = DEFAULT_SOCIAL_THUMB_ROOT,
  writeThumbs = true,
} = {}) {
  await mkdir(outputRoot, { recursive: true });
  if (writeThumbs) await mkdir(thumbRoot, { recursive: true });
  const outputs = [];
  for (const definition of SOCIAL_SHOWCASE_ADAPTATIONS) {
    const bytes = await fullFrame(
      resolve(SOCIAL_SOURCE_ROOT, definition.source),
      definition.width,
      definition.height,
    );
    const outputPath = resolve(outputRoot, `${definition.id}.png`);
    await sharp(bytes).png().toFile(outputPath);
    if (writeThumbs) {
      await sharp(bytes)
        .resize({ width: 540, height: 720, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(resolve(thumbRoot, `${definition.id}.webp`));
    }
    outputs.push({
      ...definition,
      path: outputPath,
      pixelRatio: `${definition.width}:${definition.height}`,
    });
  }
  return outputs;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  Promise.all([buildHomeShowcaseComposites(), buildSocialShowcaseAdaptations()])
    .then(([homeOutputs, socialOutputs]) => console.log(JSON.stringify({
      ok: true,
      outputs: [...homeOutputs, ...socialOutputs].map(({ id, path }) => ({ id, path })),
    }, null, 2)))
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
