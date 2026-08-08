import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');

test('home uses exactly two visual workspace cards without a duplicate switch', () => {
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  assert.equal((options.match(/mode: '(?:ecommerce|content)'/g) || []).length, 2);
  assert.match(source, /homepage-mode-cards/);
  assert.doesNotMatch(source, /homepage-mode-indicator/);
  assert.match(source, /上传创意素材，生成/);
  assert.match(source, /更多营销内容/);
});
