import assert from 'node:assert/strict';
import test from 'node:test';

import { renderTextLayer } from '../server/composition/textComposer.mjs';

const VALID_LAYER = {
  text: '轻盈保湿',
  fontId: 'fallback-sans',
  fontSize: 64,
  color: '#111111',
  width: 800,
  align: 'center',
  lineHeight: 1.2,
};

test('text rendering preserves the exact confirmed Chinese copy', async () => {
  const layer = await renderTextLayer(VALID_LAYER);
  const svg = layer.svg.toString('utf8');

  assert.match(svg, /轻盈保湿/);
  assert.doesNotMatch(svg, /undefined|NaN/);
  assert.equal(layer.metrics.lineCount, 1);
  assert.ok(Number.isFinite(layer.metrics.height));
  assert.ok(Buffer.isBuffer(layer.svg));
});

test('text rendering escapes SVG injection without rewriting user copy', async () => {
  const text = '新品 & 安心</text><script>alert("x")</script>';
  const layer = await renderTextLayer({ ...VALID_LAYER, text, align: 'left' });
  const svg = layer.svg.toString('utf8');

  assert.match(svg, /新品 &amp; 安心&lt;\/text&gt;&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(svg, /<script>|<\/text><script>/);
  assert.equal(layer.metrics.text, text);
});

test('text rendering validates dimensions, colors and numeric inputs', async () => {
  await assert.rejects(() => renderTextLayer({ ...VALID_LAYER, fontSize: 0 }), /fontSize/);
  await assert.rejects(() => renderTextLayer({ ...VALID_LAYER, width: 800.5 }), /width/);
  await assert.rejects(() => renderTextLayer({ ...VALID_LAYER, lineHeight: Number.NaN }), /lineHeight/);
  await assert.rejects(() => renderTextLayer({ ...VALID_LAYER, color: 'url(javascript:alert(1))' }), /color/);
  await assert.rejects(() => renderTextLayer({ ...VALID_LAYER, align: 'justify' }), /align/);
});
