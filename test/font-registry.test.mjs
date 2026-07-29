import assert from 'node:assert/strict';
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

  assert.match(policy.displayFontId, /source-han/i);
  assert.equal(policy.fontAssetStatus, 'planned');
  assert.equal(font.fontId, 'fallback-sans');
  assert.equal(font.deployed, true);
  assert.match(font.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(font.fontId, policy.displayFontId);
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
