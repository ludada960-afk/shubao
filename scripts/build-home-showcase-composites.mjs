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
    id: 'editorial-multi-angle-fan-v7',
    kind: 'multi-angle-fan',
    extension: 'webp',
    ratio: '16:9',
    width: 1600,
    height: 900,
    sources: ['angle-front.png', 'angle-motion.png', 'angle-side.png', 'angle-back.png'],
  }),
  Object.freeze({
    id: 'editorial-multi-angle-workflow-v7',
    kind: 'multi-angle-workflow',
    extension: 'png',
    ratio: '16:9',
    width: 1600,
    height: 900,
    sources: ['editorial-flatlay-matched-v1.webp', 'angle-front.png', 'angle-motion.png', 'angle-side.png', 'angle-back.png'],
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
  'editorial-multi-angle-fan-v7': Object.freeze({
    stages: Object.freeze(['result-fan']),
    fit: 'contain',
    blurPadding: false,
    visualBounds: Object.freeze({ left: 158, top: 52, right: 1572, bottom: 832 }),
    resultCards: Object.freeze([
      Object.freeze({ left: 235, top: 150, width: 330, height: 600, rotation: -8, fit: 'contain', border: 5 }),
      Object.freeze({ left: 555, top: 100, width: 330, height: 600, rotation: -3, fit: 'contain', border: 5 }),
      Object.freeze({ left: 875, top: 100, width: 330, height: 600, rotation: 3, fit: 'contain', border: 5 }),
      Object.freeze({ left: 1195, top: 150, width: 330, height: 600, rotation: 8, fit: 'contain', border: 5 }),
    ]),
  }),
  'editorial-multi-angle-workflow-v7': Object.freeze({
    stages: Object.freeze(['product', 'arrow', 'result-fan']),
    fit: 'contain',
    blurPadding: false,
    visualBounds: Object.freeze({ left: 56, top: 100, right: 1594, bottom: 800 }),
    product: Object.freeze({ left: 72, top: 168, width: 390, height: 560, rotation: -2, fit: 'contain', border: 8, radius: 28 }),
    arrow: Object.freeze({ left: 468, top: 292, right: 566, bottom: 535 }),
    resultCards: Object.freeze([
      Object.freeze({ left: 560, top: 170, width: 315, height: 560, rotation: -8, fit: 'contain', border: 5 }),
      Object.freeze({ left: 790, top: 125, width: 315, height: 560, rotation: -3, fit: 'contain', border: 5 }),
      Object.freeze({ left: 1020, top: 125, width: 315, height: 560, rotation: 3, fit: 'contain', border: 5 }),
      Object.freeze({ left: 1247, top: 170, width: 315, height: 560, rotation: 8, fit: 'contain', border: 5 }),
    ]),
  }),
  'tryon-reference-workflow': Object.freeze({
    stages: Object.freeze(['product', 'reference-model', 'result']),
    fit: 'cover',
    blurPadding: false,
    visualBounds: Object.freeze({ left: 24, top: 54, right: 1580, bottom: 846 }),
    product: Object.freeze({ left: 30, top: 48, width: 548, height: 804, rotation: -2 }),
    reference: Object.freeze({ left: 704, top: 48, width: 250, height: 804, rotation: -1 }),
    result: Object.freeze({ left: 1308, top: 48, width: 250, height: 804, rotation: 2 }),
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

function multiAngleDecoration({ withArrow = false } = {}) {
  return Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#4b3929" flood-opacity=".16"/></filter>
    </defs>
    <rect width="1600" height="900" fill="#f7f5f2"/>
    <ellipse cx="820" cy="824" rx="650" ry="28" fill="#5d4939" opacity=".08" filter="url(#shadow)"/>
  </svg>`);
}

function multiAngleArrow() {
  return Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="arrowGradient" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#c9bdb0"/>
        <stop offset="1" stop-color="#9f8d7c"/>
      </linearGradient>
      <marker id="arrowHead" markerWidth="28" markerHeight="28" refX="21" refY="9" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0 0 L22 9 L0 18 Z" fill="#9f8d7c"/>
      </marker>
    </defs>
    <path d="M474 540 C496 524 520 496 548 454" fill="none" stroke="url(#arrowGradient)" stroke-width="20" stroke-linecap="round"/>
    <path d="M560 440 L536 448 L546 464 Z" fill="#9f8d7c"/>
  </svg>`);
}

async function buildMultiAngle(definition) {
  const plan = TRYON_LAYOUT_PLANS[definition.id];
  const hasProduct = definition.kind === 'multi-angle-workflow';
  const product = hasProduct
    ? await placedCard(resolve(SOURCE_ROOT, definition.sources[0]), plan.product)
    : null;
  const cardSources = hasProduct ? definition.sources.slice(1) : definition.sources;
  const results = await Promise.all(
    cardSources.map((source, index) => placedCard(resolve(SOURCE_ROOT, source), plan.resultCards[index])),
  );
  const layers = [...(product ? [product] : []), ...results];
  if (hasProduct) layers.push({ input: multiAngleArrow(), left: 0, top: 0 });
  return sharp(multiAngleDecoration())
    .composite(layers)
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
    const bytes = ['multi-angle-fan', 'multi-angle-workflow'].includes(definition.kind)
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
