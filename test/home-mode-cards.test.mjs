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
  const hoverRule = styles.match(/\.homepage-mode-card:hover,\s*\.homepage-mode-card:focus-visible\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(hoverRule, /z-index\s*:/);
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

test('ecommerce controls: 模型优先; 避免出现的元素归生成设置; 画面风格=技能库真源 (9-11 二轮批注)', () => {
  const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/pages/Home/ec/GenSettingsPanel.jsx', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../src/pages/Home/ec/StylePanel.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../src/services/imageModelCatalog.js', import.meta.url), 'utf8');
  const buttons = ecMode.match(/const DEFAULT_BUTTONS = \[([\s\S]*?)\n  \];/)?.[1] || '';

  assert.match(buttons.trimStart(), /^\{\s*key: 'settings'/);
  /* 9-11 二轮: 「避免出现的元素」从视觉方向搬到生成设置 (生成约束与清晰度同族) */
  assert.match(settings, /避免出现的元素/);
  assert.match(settings, /商品结构变形、异常手部、乱码文字、无关道具/);
  assert.doesNotMatch(style, /避免出现的元素/);
  assert.doesNotMatch(ecMode, /negativePrompt=\{genSettings\.negativePrompt\}/);
  assert.match(settings, /generationUnits/);
  /* 9-11 三轮: 模型卡片改用真实品牌标 (ModelLogo + brandLogo), 不再用 1.5MB 示例大图 */
  assert.match(settings, /<ModelLogo logo=\{brandLogo\(model\.brand\)\}/);
  assert.doesNotMatch(settings, /model\.visual/);
  /* 画面风格 = 技能库「生图」内置技能 (唯一真源), 本地只留兜底视觉 */
  assert.match(style, /fetchSkillLibrary\(\{ kind: 'image' \}\)/);
  assert.match(style, /FALLBACK_STYLE_SKILLS/);
  assert.doesNotMatch(style, /const STYLES = \[/);
  /* 9-11 三轮: 视觉方向面板被技能库取代 — 触发按钮直接开技能库, StylePanel 不再挂首页 */
  assert.match(ecMode, /opensSkillLibrary: true/);
  assert.match(ecMode, /if \(key === 'skills'\)/);
  assert.doesNotMatch(ecMode, /activePanel === 'style'/);
  assert.match(settings, /锁定品牌主色调/);
  /* 9-11 三轮: 三个模型的视觉标识改为品牌 key (openai / gemini), 由 modelLogos 统一解析成 SVG 标 */
  /* 9-13 扩档：目录现有 8 档（原 3 档 + 新增 2.5 两个变体 / MDKJ / Gemini 3 / Midjourney）；
     品牌 key 由 modelLogos 统一解析成 SVG 标，仍然是“不再用示例大图”这条契约。 */
  assert.equal((catalog.match(/brand: '(openai|gemini|midjourney|qwen|alibaba|seedream)'/g) || []).length, 8);
  assert.doesNotMatch(catalog, /images\/models\//);
});
