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
  /* 2026-09-15 V3：hover 与 focus-visible 从「合并选择器」拆成各自独立的规则 ——
     原则 4.2 要求 focus 必须独立于 hover 可见（键盘用户看不到 hover），
     合并写法会让焦点环被 hover 的 transform 规则牵连。契约不变：hover 仍是上浮 16px。 */
  assert.match(styles, /\.homepage-mode-card:hover \{[\s\S]*?transform:\s*translateY\(-16px\) rotate\(0deg\)/);
  assert.match(styles, /\.homepage-mode-card:focus-visible/);
  assert.match(styles, /\.homepage-mode-card:active/);
  assert.doesNotMatch(styles, /\.homepage-mode-card\.is-active[^}]*rotate\(0\)/);
  /* 2026-09-15 V3：时长/缓动改走 token（--sb-duration-* + --sb-ease-out），
     契约「位移有过渡、且是产品级缓动」不变，只是取值来源统一。 */
  assert.match(styles, /\.homepage-mode-card \{[\s\S]*?transition:\s*transform var\(--sb-duration-normal\)/);
  assert.doesNotMatch(styles, /\.homepage-mode-card:hover \.homepage-mode-card-visual img/);
  /* hover 规则不得带 z-index（避免 hover 制造层叠事故） */
  const hoverRule = styles.match(/\.homepage-mode-card:hover \{([^}]*)\}/)?.[1] || '';
  assert.ok(hoverRule, 'hover 规则存在');
  assert.doesNotMatch(hoverRule, /z-index\s*:/);
  /* 原则 4.3：hover 不得染紫（只允许中性 token） */
  assert.doesNotMatch(hoverRule, /--sb-brand/, 'hover 不得出现品牌色');
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

test('ecommerce controls: 模型优先; 避免出现的元素归内容规范; 画面风格=技能库真源 (9-11 二轮 + 9-15 批注)', () => {
  const ecMode = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../src/pages/Home/ec/GenSettingsPanel.jsx', import.meta.url), 'utf8');
  const style = readFileSync(new URL('../src/pages/Home/ec/StylePanel.jsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('../src/services/imageModelCatalog.js', import.meta.url), 'utf8');
  const buttons = ecMode.match(/const DEFAULT_BUTTONS = \[([\s\S]*?)\n  \];/)?.[1] || '';

  assert.match(buttons.trimStart(), /^\{\s*key: 'settings'/);
  /* 2026-09-15 用户批注：「避免出现的元素为什么要放在生成设置里？它不应该在这个面板。」
     生成设置 = 模型/清晰度/品牌主色（设备与输出参数）；
     「避免出现的元素」= 画面内容约束 → 迁到「内容规范」（正向要什么 + 反向不要什么）。
     数据链路不变（仍是 genSettings.negativePrompt），画布侧同步不受影响。 */
  const constraints = readFileSync(new URL('../src/pages/Home/ec/GenerationConstraintsPanel.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(settings, /避免出现的元素/, '生成设置面板不得再渲染该分组');
  assert.match(constraints, /避免出现的元素/, '该分组已落到内容规范面板');
  assert.match(constraints, /商品结构变形/, '常用约束快选保留');
  assert.match(ecMode, /negativePrompt=\{genSettings\.negativePrompt\}/, '数据仍走 genSettings.negativePrompt');
  assert.doesNotMatch(style, /避免出现的元素/);
  /* 积分说明句已删（2026-09-15 批注③）：积分只在主 CTA 动态显示 */
  assert.doesNotMatch(settings, /generationUnits/, '不再在面板内展示「当前约 N AI 积分/张」');
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
  /* 2026-09-15：标题从「锁定品牌主色调」改为「品牌主色调」——
     默认必须表示「未锁定任何颜色」（用户批注①），标题自称「锁定」会与默认态矛盾。
     锁定与否由色块描边 + 按钮文案（锁定/已锁定）表达。 */
  assert.match(settings, /品牌主色调/);
  assert.match(settings, /\{brandLocked \? '已锁定' : '锁定'\}/);
  /* 9-11 三轮: 三个模型的视觉标识改为品牌 key (openai / gemini), 由 modelLogos 统一解析成 SVG 标 */
  /* 9-13 扩档：目录现有 8 档（原 3 档 + 新增 2.5 两个变体 / MDKJ / Gemini 3 / Midjourney）；
     品牌 key 由 modelLogos 统一解析成 SVG 标，仍然是“不再用示例大图”这条契约。 */
  assert.equal((catalog.match(/brand: '(openai|gemini|midjourney|qwen|alibaba|seedream)'/g) || []).length, 8);
  assert.doesNotMatch(catalog, /images\/models\//);
});
