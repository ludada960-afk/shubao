import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { repairEcommerceAsset } from '../server/ecommerceEngine/deterministicRepair.mjs';
import { evaluateAsset } from '../server/ecommerceEngine/qualityGate.mjs';

async function productOnBackground(background) {
  return sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background,
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
        <rect x="34" y="22" width="60" height="84" rx="12" fill="#d43f32"/>
        <rect x="46" y="36" width="36" height="14" rx="4" fill="#f8f8f8"/>
      </svg>
    `),
  }]).png().toBuffer();
}

async function alphaSnapshot(buffer) {
  const output = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphas = [];
  for (let index = 3; index < output.data.length; index += 4) alphas.push(output.data[index]);
  return { ...output, alphas };
}

async function opaqueProductScene({
  background = '#f8f8f8',
  product = '#242424',
  x = 34,
  y = 22,
  width = 60,
  height = 84,
} = {}) {
  return sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background,
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
        <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${product}"/>
      </svg>
    `),
  }]).png().toBuffer();
}

test('deterministically converts a connected near-white background to soft alpha while preserving product pixels', async () => {
  const repaired = await repairEcommerceAsset({
    buffer: await productOnBackground('#f7f7f5'),
    action: {
      type: 'sharp_repair',
      operations: ['normalize_transparent_background'],
    },
    item: { role: 'transparent', generationSize: '128x128' },
  });
  const metadata = await sharp(repaired.buffer).metadata();
  const output = await alphaSnapshot(repaired.buffer);
  const centerOffset = ((64 * 128) + 64) * 4;

  assert.equal(repaired.contentType, 'image/png');
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.hasAlpha, true);
  assert.ok(output.alphas.filter(alpha => alpha <= 16).length > 128 * 128 * 0.4);
  assert.ok(output.alphas.filter(alpha => alpha >= 239).length > 128 * 128 * 0.1);
  assert.ok(output.alphas.some(alpha => alpha > 16 && alpha < 239), 'soft antialiased edges remain');
  assert.ok(output.data[centerOffset] > 150);
  assert.ok(output.data[centerOffset + 1] < 120);
  assert.ok(output.data[centerOffset + 2] < 120);

  const quality = await evaluateAsset({
    buffer: repaired.buffer,
    role: 'transparent',
    generationSize: '128x128',
    expectedFormat: 'png',
  });
  assert.equal(quality.checks.platformCompliance.status, 'pass');
});

test('does not erase a non-neutral scene and leaves it failing the transparent alpha gate', async () => {
  const repaired = await repairEcommerceAsset({
    buffer: await productOnBackground('#3867a8'),
    action: {
      type: 'sharp_repair',
      operations: ['normalize_transparent_background'],
    },
    item: { role: 'transparent', generationSize: '128x128' },
  });
  const output = await alphaSnapshot(repaired.buffer);
  const quality = await evaluateAsset({
    buffer: repaired.buffer,
    role: 'transparent',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(output.alphas.every(alpha => alpha === 255), true);
  assert.equal(quality.passed, false);
  assert.ok(quality.checks.platformCompliance.issueCodes.includes('transparent_background_missing'));
});

test('refuses alpha repair when neutral border colors are inconsistent', async () => {
  const input = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: '#ffffff',
    },
  }).composite([
    {
      input: Buffer.from('<svg width="64" height="128" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="128" fill="#d0d0d0"/></svg>'),
      left: 64,
      top: 0,
    },
    {
      input: Buffer.from('<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg"><rect x="38" y="24" width="52" height="80" rx="8" fill="#202020"/></svg>'),
      left: 0,
      top: 0,
    },
  ]).png().toBuffer();

  const repaired = await repairEcommerceAsset({
    buffer: input,
    action: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    item: { role: 'transparent', generationSize: '128x128' },
  });
  const output = await alphaSnapshot(repaired.buffer);

  assert.equal(output.alphas.every(alpha => alpha === 255), true);
});

test('refuses alpha repair when the removable neutral background is not dominant', async () => {
  const repaired = await repairEcommerceAsset({
    buffer: await opaqueProductScene({
      background: '#fafafa',
      product: '#202020',
      x: 8,
      y: 8,
      width: 112,
      height: 112,
    }),
    action: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    item: { role: 'transparent', generationSize: '128x128' },
  });
  const output = await alphaSnapshot(repaired.buffer);

  assert.equal(output.alphas.every(alpha => alpha === 255), true);
});

test('keeps a light neutral edge-touching product opaque when Product Truth marks it silver', async () => {
  const repaired = await repairEcommerceAsset({
    buffer: await opaqueProductScene({
      background: '#fafafa',
      product: '#dedede',
      x: 0,
      y: 18,
      width: 100,
      height: 92,
    }),
    action: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    item: { role: 'transparent', generationSize: '128x128' },
    productTruth: {
      primaryColors: ['银色', '浅灰'],
      materials: ['silver metal'],
    },
  });
  const output = await alphaSnapshot(repaired.buffer);

  assert.equal(output.alphas.every(alpha => alpha === 255), true);
});

test('refuses alpha repair when a light product part invades the foreground from the canvas edge', async () => {
  const input = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: '#fafafa',
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
        <rect x="34" y="22" width="60" height="84" rx="8" fill="#202020"/>
        <rect x="0" y="56" width="58" height="12" rx="2" fill="#f2f2f2"/>
      </svg>
    `),
  }]).png().toBuffer();

  const repaired = await repairEcommerceAsset({
    buffer: input,
    action: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    item: { role: 'transparent', generationSize: '128x128' },
  });
  const output = await alphaSnapshot(repaired.buffer);
  const partOffset = ((62 * 128) + 48) * 4;
  const quality = await evaluateAsset({
    buffer: repaired.buffer,
    role: 'transparent',
    generationSize: '128x128',
    expectedFormat: 'png',
  });

  assert.equal(output.alphas.every(alpha => alpha === 255), true);
  assert.ok(output.data[partOffset] >= 235, 'light edge-touching product part remains intact');
  assert.equal(quality.passed, false);
  assert.ok(quality.checks.platformCompliance.issueCodes.includes('transparent_background_missing'));
});

test('converts a centered dark product on a consistent white background to meaningful alpha', async () => {
  const repaired = await repairEcommerceAsset({
    buffer: await opaqueProductScene(),
    action: { type: 'sharp_repair', operations: ['normalize_transparent_background'] },
    item: { role: 'transparent', generationSize: '128x128' },
    productTruth: {
      primaryColors: ['深黑'],
      materials: ['黑色塑料'],
    },
  });
  const output = await alphaSnapshot(repaired.buffer);

  assert.ok(output.alphas.filter(alpha => alpha <= 16).length > 128 * 128 * 0.5);
  assert.ok(output.alphas.filter(alpha => alpha >= 239).length > 128 * 128 * 0.1);
});
