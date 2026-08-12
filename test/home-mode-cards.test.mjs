import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
  assert.match(options, /entry-ecommerce\.png/);
  assert.match(options, /entry-video\.png/);
  assert.match(options, /entry-xhs\.png/);
  assert.match(options, /entry-visual\.png/);
  assert.match(options, /entry-video\.png\?v=20260812/);
  assert.match(options, /entry-xhs\.png\?v=20260812/);
  assert.match(options, /entry-visual\.png\?v=20260812/);
  assert.doesNotMatch(source, /reference-card-/);
  assert.doesNotMatch(source, /homepage-mode-indicator/);
  assert.match(source, /上传创意素材，生成/);
  assert.match(source, /从一张素材开始，生成能上架、能种草、能传播的专业视觉/);
  assert.doesNotMatch(source, /在同一个工作台完成/);
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
  assert.doesNotMatch(styles, /\.homepage-mode-card:hover \.homepage-mode-card-visual img/);
  assert.doesNotMatch(styles, /\.homepage-mode-card:hover,[\s\S]*?z-index:\s*5/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.homepage-mode-card/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.homepage-mode-card \{[^}]*width:\s*min\(/);
  assert.match(styles, /\.homepage-mode-card-visual img \{[^}]*object-fit:\s*contain/);
});

test('mode cards use original normalized artwork with transparent margins', async () => {
  const assets = [
    '../public/images/home/entry-ecommerce.png',
    '../public/images/home/entry-video.png',
    '../public/images/home/entry-xhs.png',
    '../public/images/home/entry-visual.png',
  ];

  const manifest = JSON.parse(readFileSync(new URL('../public/images/home/entry-assets.manifest.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(manifest.assets).length, 8);
  for (const item of Object.values(manifest.assets)) {
    assert.match(item.path, /^\/images\/(?:home|visual-recipes)\/[a-z-]+\.png$/);
    assert.equal(item.alpha, true);
    assert.match(item.promptSummary, /^Original /);
  }

  for (const asset of assets) {
    const input = readFileSync(new URL(asset, import.meta.url));
    const metadata = await sharp(input).metadata();
    const alpha = await sharp(input).extractChannel('alpha').stats();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 420);
    assert.equal(metadata.height, 360);
    assert.equal(metadata.hasAlpha, true);
    assert.equal(alpha.channels[0].min, 0);
    assert.ok(alpha.channels[0].max >= 250);
    const name = new URL(asset, import.meta.url).pathname.split('/').pop();
    assert.equal(manifest.assets[name].sha256, createHash('sha256').update(input).digest('hex'));
  }

  for (const copiedAsset of [
    '../public/images/home/reference-card-product.png',
    '../public/images/home/reference-card-fashion.png',
    '../public/images/home/reference-card-video.png',
    '../public/images/home/reference-card-remix.png',
  ]) assert.equal(existsSync(new URL(copiedAsset, import.meta.url)), false);
});

test('ecommerce controls put model first and keep negative constraints with visual direction', () => {
  const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/pages/Home/ec/GenSettingsPanel.jsx', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../src/pages/Home/ec/StylePanel.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../src/services/imageModelCatalog.js', import.meta.url), 'utf8');
  const buttons = ecMode.match(/const DEFAULT_BUTTONS = \[([\s\S]*?)\n  \];/)?.[1] || '';

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
