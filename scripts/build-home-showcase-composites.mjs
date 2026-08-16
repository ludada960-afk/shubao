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
  Object.freeze({
    id: 'editorial-multi-angle-v4',
    kind: 'multi-angle',
    extension: 'webp',
    ratio: '16:9',
    width: 1600,
    height: 900,
    sources: ['editorial-flatlay-v3.webp', 'angle-front.png', 'angle-motion.png', 'angle-side.png', 'angle-back.png'],
  }),
  Object.freeze({
    id: 'tryon-reference-workflow',
    kind: 'reference-workflow',
    extension: 'png',
    ratio: '16:9',
    width: 1600,
    height: 900,
    sources: ['editorial-flatlay-v3.webp', 'reference-person.png', 'reference-result.png'],
  }),
]);

export const TRYON_LAYOUT_PLANS = Object.freeze({
  'editorial-multi-angle-v4': Object.freeze({
    stages: Object.freeze(['product', 'arrow', 'result-fan']),
    fit: 'contain',
    blurPadding: false,
    visualBounds: Object.freeze({ left: 44, top: 74, right: 1570, bottom: 826 }),
    product: Object.freeze({ left: 78, top: 190, width: 360, height: 500, rotation: -3, fit: 'contain' }),
    resultCards: Object.freeze([
      Object.freeze({ left: 570, top: 130, width: 300, height: 700, rotation: -8, fit: 'contain' }),
      Object.freeze({ left: 805, top: 95, width: 300, height: 700, rotation: -3, fit: 'contain' }),
      Object.freeze({ left: 1040, top: 95, width: 300, height: 700, rotation: 3, fit: 'contain' }),
      Object.freeze({ left: 1245, top: 130, width: 300, height: 700, rotation: 8, fit: 'contain' }),
    ]),
  }),
  'tryon-reference-workflow': Object.freeze({
    stages: Object.freeze(['product', 'reference-model', 'result']),
    fit: 'cover',
    blurPadding: false,
    visualBounds: Object.freeze({ left: 24, top: 54, right: 1580, bottom: 846 }),
    product: Object.freeze({ left: 24, top: 72, width: 508, height: 756, rotation: -2 }),
    reference: Object.freeze({ left: 716, top: 68, width: 206, height: 764, rotation: -1 }),
    result: Object.freeze({ left: 1350, top: 68, width: 206, height: 764, rotation: 2 }),
  }),
});

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

function roundedMask(width, height, radius) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="${radius}" fill="#fff"/></svg>`);
}

async function framedCover(sourcePath, { width, height, rotation = 0, border = 8, radius = 24, fit = 'cover' } = {}) {
  const contentWidth = width - (border * 2);
  const contentHeight = height - (border * 2);
  const content = await sharp(sourcePath)
    .resize(contentWidth, contentHeight, {
      fit,
      position: 'centre',
      background: fit === 'contain' ? { r: 255, g: 255, b: 255, alpha: 0 } : undefined,
    })
    .composite([{ input: roundedMask(contentWidth, contentHeight, Math.max(8, radius - border)), blend: 'dest-in' }])
    .png()
    .toBuffer();
  const card = await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
    .composite([
      { input: roundedMask(width, height, radius), blend: 'dest-in' },
      { input: content, left: border, top: border },
    ])
    .png()
    .toBuffer();
  if (!rotation) return card;
  return sharp(card).rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function placedCard(sourcePath, placement) {
  const input = await framedCover(sourcePath, placement);
  const metadata = await sharp(input).metadata();
  const left = Math.round(placement.left - ((metadata.width - placement.width) / 2));
  const top = Math.round(placement.top - ((metadata.height - placement.height) / 2));
  return { input, left, top };
}

function multiAngleDecoration() {
  return Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#4b3929" flood-opacity=".16"/></filter>
      <linearGradient id="arrow" x1="0" x2="1"><stop stop-color="#d0c7bd"/><stop offset="1" stop-color="#958679"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="#f7f5f2"/>
    <path d="M455 470 C490 430 520 400 552 365" fill="none" stroke="url(#arrow)" stroke-width="18" stroke-linecap="round" opacity=".92"/>
    <path d="M528 345 L578 360 L548 402 Z" fill="#958679" opacity=".92"/>
    <ellipse cx="820" cy="836" rx="690" ry="32" fill="#5d4939" opacity=".08" filter="url(#shadow)"/>
  </svg>`);
}

async function buildMultiAngle(definition) {
  const plan = TRYON_LAYOUT_PLANS[definition.id];
  const product = await placedCard(resolve(SOURCE_ROOT, definition.sources[0]), plan.product);
  const results = await Promise.all(
    definition.sources.slice(1).map((source, index) => placedCard(resolve(SOURCE_ROOT, source), plan.resultCards[index])),
  );
  return sharp(multiAngleDecoration())
    .composite([product, ...results])
    .png()
    .toBuffer();
}

function referenceDecoration() {
  return Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="flow" x1="0" x2="1"><stop stop-color="#d1c9c0"/><stop offset="1" stop-color="#9f9183"/></linearGradient></defs>
    <rect width="1600" height="900" fill="#f7f5f2"/>
    <circle cx="618" cy="450" r="42" fill="#2f2b28"/><path d="M598 450h40M618 430v40" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <path d="M978 526 C1082 466 1164 382 1288 334" fill="none" stroke="url(#flow)" stroke-width="22" stroke-linecap="round"/>
    <path d="M1270 302 L1320 320 L1292 364 Z" fill="#9f9183"/>
  </svg>`);
}

async function buildReferenceWorkflow(definition) {
  const plan = TRYON_LAYOUT_PLANS[definition.id];
  const [product, reference, result] = await Promise.all([
    placedCard(resolve(SOURCE_ROOT, definition.sources[0]), plan.product),
    placedCard(resolve(SOURCE_ROOT, definition.sources[1]), plan.reference),
    placedCard(resolve(SOURCE_ROOT, definition.sources[2]), plan.result),
  ]);
  return sharp(referenceDecoration())
    .composite([product, reference, result])
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
    const bytes = definition.kind === 'multi-angle'
      ? await buildMultiAngle(definition)
      : await buildReferenceWorkflow(definition);
    const outputPath = resolve(outputRoot, `${definition.id}.${definition.extension}`);
    const output = sharp(bytes);
    if (definition.extension === 'webp') await output.webp({ quality: 91 }).toFile(outputPath);
    else await output.png().toFile(outputPath);
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
