import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/layout/Footer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('home presents image, content, and video as one visual workspace family', () => {
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  assert.equal((options.match(/mode: '(?:ecommerce|content)'/g) || []).length, 2);
  assert.equal((options.match(/page: 'video-studio'/g) || []).length, 1);
  assert.match(source, /homepage-mode-cards/);
  assert.doesNotMatch(source, /homepage-mode-indicator/);
  assert.match(source, /上传创意素材，生成/);
  assert.match(source, /电商套图、小红书图文与 AI 视频/);
  assert.match(page, /智能视觉内容创作平台/);
  assert.match(footer, /AI 视觉内容策划、生成与编辑/);
  assert.match(styles, /\.homepage-mode-card\.card-1 \{ transform: rotate\(-9deg\)/);
  assert.match(styles, /\.homepage-mode-card\.card-3 \{ transform: rotate\(9deg\)/);
  assert.match(styles, /translateY\(-16px\)/);
  assert.match(styles, /transition: transform \.2s cubic-bezier/);
});
