import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { FONT_REGISTRY, resolveFont } from '../server/composition/fontRegistry.mjs';
import { compileTypographySystem } from '../server/ecommerceEngine/typographyPolicy.mjs';

test('font resolver never returns an undeployed planned font', () => {
  const policy = compileTypographySystem({
    category: '美妆',
    priceBand: 'premium',
    language: 'zh-CN',
  });
  const font = resolveFont({
    category: '美妆',
    priceBand: 'premium',
    language: 'zh-CN',
  });

  assert.equal(policy.displayFontId, font.fontId);
  assert.equal(policy.bodyFontId, font.fontId);
  assert.equal(policy.numericFontId, font.fontId);
  assert.match(policy.plannedTypography.displayFontId, /source-han/i);
  assert.equal(policy.fontAssetStatus, 'deployed');
  assert.equal(font.fontId, 'fallback-sans');
  assert.equal(font.deployed, true);
  assert.match(font.sha256, /^[a-f0-9]{64}$/);
});

test('registry exposes only checksum-valid deployed fonts or the fixed safe fallback', () => {
  for (const font of Object.values(FONT_REGISTRY)) {
    assert.ok(font.fontId === 'fallback-sans' || font.deployed === true);
    assert.match(font.sha256, /^[a-f0-9]{64}$/);
    assert.equal(font.commercialUse, true);
  }

  const font = resolveFont({ category: '未知品类', language: 'zh-CN' }, {
    'planned-display': {
      fontId: 'planned-display',
      family: 'Planned Display',
      deployed: false,
      sha256: null,
      commercialUse: true,
    },
    'fallback-sans': FONT_REGISTRY['fallback-sans'],
  });
  assert.equal(font.fontId, 'fallback-sans');
});

test('deployed fallback checksum is derived from committed licensed font bytes', () => {
  const font = FONT_REGISTRY['fallback-sans'];
  assert.equal(font.license, 'OFL-1.1');
  assert.equal(typeof font.filePath, 'string');
  const bytes = readFileSync(font.filePath);
  assert.ok(bytes.length > 1_000_000);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), font.sha256);
});
