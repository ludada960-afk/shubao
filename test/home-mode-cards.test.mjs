import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import sharp from 'sharp';

const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/layout/Footer.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('home presents four stable visual creation domains in one workspace family', () => {
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  assert.equal((options.match(/mode: '(?:ecommerce|video|content|visual)'/g) || []).length, 4);
  assert.doesNotMatch(options, /page: 'video-studio'/);
  assert.match(options, /mode: 'ecommerce'[\s\S]*mode: 'video'[\s\S]*mode: 'content'[\s\S]*mode: 'visual'/);
  assert.match(options, /title: '视频生成'/);
  assert.match(options, /title: '自由创作'/);
  assert.match(source, /homepage-mode-cards/);
  assert.match(source, /<VideoStudioPage embedded/);
  assert.match(source, /<VisualCreationMode/);
  assert.match(source, /reference-card-video\.png/);
  assert.match(source, /reference-card-product\.png/);
  assert.doesNotMatch(source, /homepage-mode-indicator/);
  assert.match(source, /上传创意素材，生成/);
  assert.match(source, /电商套图、营销视频、小红书图文与自由创作/);
  assert.match(page, /智能视觉内容创作平台/);
  assert.match(footer, /AI 视觉内容策划、生成与编辑/);
  assert.match(styles, /\.homepage-mode-card\.card-1 \{[^}]*rotate\(-10deg\)/);
  assert.match(styles, /\.homepage-mode-card\.card-2 \{[^}]*rotate\(5deg\)/);
  assert.match(styles, /\.homepage-mode-card\.card-3 \{[^}]*rotate\(-5deg\)/);
  assert.match(styles, /\.homepage-mode-card\.card-4 \{[^}]*rotate\(5deg\)/);
  assert.match(styles, /\.homepage-mode-card:hover,[\s\S]*transform:\s*translateY\(-16px\) rotate\(0deg\)/);
  assert.match(styles, /\.homepage-mode-card:focus-visible/);
  assert.doesNotMatch(styles, /\.homepage-mode-card\.is-active[^}]*rotate\(0\)/);
  assert.match(styles, /transition: transform \.2s cubic-bezier/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.homepage-mode-card/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.homepage-mode-card \{[^}]*width:\s*min\(/);
  assert.match(styles, /\.homepage-mode-card-visual img \{[^}]*object-fit:\s*contain/);
});

test('mode card reference assets preserve their transparent layered-card silhouettes', async () => {
  const assets = [
    '../public/images/home/reference-card-product.png',
    '../public/images/home/reference-card-fashion.png',
    '../public/images/home/reference-card-video.png',
    '../public/images/home/reference-card-remix.png',
  ];

  for (const asset of assets) {
    const input = readFileSync(new URL(asset, import.meta.url));
    const metadata = await sharp(input).metadata();
    const alpha = await sharp(input).extractChannel('alpha').stats();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.hasAlpha, true);
    assert.equal(alpha.channels[0].min, 0);
    assert.ok(alpha.channels[0].max >= 250);
  }
});

test('ecommerce controls put model first and keep negative constraints with visual direction', () => {
  const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/pages/Home/ec/GenSettingsPanel.jsx', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../src/pages/Home/ec/StylePanel.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../src/services/imageModelCatalog.js', import.meta.url), 'utf8');
  const buttons = ecMode.match(/const BUTTONS = \[([\s\S]*?)\n  \];/)?.[1] || '';

  assert.match(buttons.trimStart(), /^\{\s*key: 'settings'/);
  assert.match(ecMode, /negativePrompt=\{genSettings\.negativePrompt\}/);
  assert.match(ecMode, /onNegativePromptChange=/);
  assert.doesNotMatch(settings, /避免出现的元素/);
  assert.match(settings, /generationUnits/);
  assert.match(settings, /<img src=\{model\.visual\}/);
  assert.match(style, /避免出现的元素/);
  assert.match(style, /商品结构变形、异常手部、乱码文字、无关道具/);
  assert.equal((catalog.match(/visual: '\/images\/models\//g) || []).length, 3);
});
