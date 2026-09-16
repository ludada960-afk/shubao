import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { responsiveImageCandidates } from '../src/components/responsiveImageModel.js';
import { proxyImg } from '../src/services/api.js';
import { PRODUCTION_CASE_CATALOG } from '../src/pages/Home/productionCaseCatalog.js';
/* ── 2026-09-15 第 18 轮补：**面板里的图也吃带宽** ──────────────────────────────
   首屏契约（上面六条）只管首屏，于是同一个坑在**非首屏**又踩了一次：
   视觉创作面板的选项图标是 48×48 的位子，却直引 5–7MB 的源 PNG；
   14 张选项图翻一遍 ≈ 84MB —— 在 3Mbps 出口下是 3 分多钟，
   而用户看到的只是「图标转圈」。实测同一个文件：源图 6.8MB / w320 变体 43KB（159 倍）。
   判据：把每个源图按组件里的换算跑一遍，结果必须**不等于源图**且落在小尺寸档上；
   不能用「写没写某个函数名」当判据（那是锁拼写，RTK §3.1-10）。 */
test('面板/内联图不得直引源图：选项图标必须走小尺寸变体', () => {
  const model = readFileSync(new URL('../src/pages/Home/visualCreationModel.js', import.meta.url), 'utf8');
  const images = [...model.matchAll(/image: '(\/images\/[^']+)'/g)].map(match => match[1]);
  assert.ok(images.length >= 10, '样本量自证：选项图应 >= 10 张，实际 ' + images.length);

  for (const src of images) {
    const variant = proxyImg(src, 'w320', 'webp');
    assert.notEqual(variant, src, '选项图标不得直引源图：' + src + '（换算后仍是源图）');
    assert.match(variant, /[?&]variant=w320(?:&|$)/, '必须请求 w320 档：' + variant);
    assert.ok(variant.startsWith('/api/public-image?path='), '必须经变体服务：' + variant);
  }

  /* 渲染点：源码里不得再出现「把源图直接塞进 img src」的写法。
     这一条是文本断言（JSX 渲染点没有别的静态判据），故配一条自证证明它抓得住。 */
  const view = readFileSync(new URL('../src/pages/Home/VisualCreationMode.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(view, /src=\{optionMeta\.image\}/, '选项图标不得直引源图');
});

test('检测器自证：源图直引的写法抓得住，走变体的写法不误报', () => {
  const RAW = /src=\{optionMeta\.image\}/;
  assert.match('<img src={optionMeta.image} />', RAW, '直引写法必须被抓出来');
  assert.doesNotMatch("<img src={proxyImg(optionMeta.image, 'w320', 'webp')} />", RAW, '走变体的写法不得误报');
});

// 9-14 P1-1 首屏瘦身契约：首屏可见大图的“主候选”必须是已落盘的 .thumbs WebP（<=200KB），
// 源 PNG/大图只允许作为失败回退或放大/下载用途，不得成为首个请求的 URL。
// 基线证据：headless 实测改前首屏 9,155KB/45 请求，最大单文件 6.3MB（earbuds-suite-composite-v3.png）。
const THUMB_BUDGET_BYTES = 200 * 1024;

const publicPathOf = url => new URL('../public' + url, import.meta.url);

const thumbPathOf = url => {
  assert.ok(String(url).startsWith('/images/.thumbs/'), 'primary candidate must be a .thumbs preview: ' + url);
  return publicPathOf(url);
};

function assertThumbBudget(url, context) {
  const file = thumbPathOf(url);
  assert.ok(existsSync(file), `missing thumbnail for ${context}: ${url}`);
  const size = statSync(file).size;
  assert.ok(size <= THUMB_BUDGET_BYTES, `${context} thumb over 200KB (${Math.round(size / 1024)}KB): ${url}`);
}

/* 2026-09-17：一级入口从四张收敛成两张（视频生成 / 图片生成），
   所以这里从"四张卡都有缩略图"改成"**每一张实际渲染的卡**都有缩略图"（判据不变，样本跟着界面走）。
   ⚠️ 数字不写死：写死 4 会让这条门禁在下次增删入口时变成绊脚石，
      而它真正要守的是"卡上的图不许直引源 PNG"。 */
test('every rendered mode-card entry image resolves to an existing webp thumb before any PNG source', () => {
  const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const srcs = [...options.matchAll(/src: '([^']+)'/g)].map(match => match[1]);
  assert.ok(srcs.length >= 2, '至少两张入口卡（实际 ' + srcs.length + '）');
  // ModeCardImage → modeCardThumb 是唯一首屏渲染路径：必须先剥 ?v= 再匹配扩展名（否则直拉源 PNG）。
  // 该行为以文本断言锁死（正则捕获组必须不含扩展名，否则会生成 *.png.webp 假路径回退到源图）；
  // 缩略产物存在性与预算用与 modeCardThumb 相同的换算在下方校验。
  // 捕获组 (.+?) 必须不含扩展名 —— 若扩展名进组会产出 *.png.webp 假路径并回退源图。
  assert.ok(source.includes(String.raw`const MODE_CARD_THUMB_PATTERN = /^\/images\/(.+?)\.(?:png|jpe?g)$/i;`), 'thumb pattern must strip the extension in its capture group');
  assert.ok(source.includes(String.raw`const clean = String(src || '').split('?')[0];`), 'modeCardThumb must strip query strings before matching');
  assert.match(source, /clean\.match\(MODE_CARD_THUMB_PATTERN\)/);
  for (const src of srcs) {
    const primary = '/images/.thumbs/' + src.split('?')[0].replace(/^\/images\//, '').replace(/\.(png|jpe?g)$/i, '.webp');
    assert.match(primary, /\.webp$/);
    assert.doesNotMatch(primary, /\?v=/);
    if (src.includes('?v=')) {
      assert.match(src, /^\/images\/home\/entry-(ecommerce|video|xhs|visual)\.png\?v=\d{8}$/);
    }
    assertThumbBudget(primary, src);
  }
});

test('product-suite composite first candidate is the 1600px detail webp, not the 6.3MB PNG', () => {
  const item = PRODUCTION_CASE_CATALOG.find(entry => entry.id === 'product-suite');
  const composite = item.assets.find(asset => asset.displayRole === 'finalComposite');
  const detail = publicPathOf(composite.src);
  assert.ok(existsSync(detail), 'composite detail webp missing: ' + composite.src);
  assert.ok(statSync(detail).size <= THUMB_BUDGET_BYTES, 'composite detail over 200KB');
  // Workbench 用 variant=display 直渲 finalComposite —— 它本身必须已是优化产物
  const [displayCandidate] = responsiveImageCandidates(composite.src, 'display');
  assert.equal(displayCandidate, composite.src);
  // 画廊卡（variant=thumb）仍走 .thumbs 720px
  const thumb = responsiveImageCandidates(composite.src, 'thumb')[0];
  assertThumbBudget(thumb, composite.src);
  // 6.3MB 源 PNG 保留在仓库（供回滚/下载），但 Catalog 不再引用它
  const raw = new URL('../public/images/home/ecommerce-showcase/earbuds-suite-composite-v3.png', import.meta.url);
  assert.ok(existsSync(raw), 'source PNG should stay on disk');
  assert.doesNotMatch(item.assets.map(asset => asset.src).join('\n'), /earbuds-suite-composite-v3\.png$/);
});

test('multi-angle try-on selector and workflow have live 720px previews with no cache-buster', () => {
  const item = PRODUCTION_CASE_CATALOG.find(entry => entry.id === 'tryon-angles');
  for (const asset of item.assets.filter(entry => entry.displayRole === 'selectorPreview' || entry.displayRole === 'workflowBanner')) {
    assert.doesNotMatch(asset.src, /\?v=/, 'query suffix would bypass .thumbs resolution: ' + asset.src);
    assertThumbBudget(responsiveImageCandidates(asset.src, 'thumb')[0], asset.src);
  }
});

test('every production gallery cover resolves to a checked-in thumbnail (no raw giant PNG in the critical path)', async () => {
  const galleryModel = await import('../src/pages/Home/galleryModel.js');
  const items = galleryModel.productionGalleryItems(PRODUCTION_CASE_CATALOG);
  assert.ok(items.length >= 6);
  for (const item of items.slice(0, 6)) {
    const primary = responsiveImageCandidates(item.cover_url, 'thumb')[0];
    assertThumbBudget(primary, item.cover_url);
  }
});

test('index.html keeps Google Fonts out of the render-blocking critical path', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
  assert.match(page, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(page, /rel="dns-prefetch" href="https:\/\/fonts\.gstatic\.com"/);
  /* 首屏的两张入口卡都要预载，其中 LCP 那张（视频生成）带 fetchpriority=high。
     ⚠️ 预载清单必须与 modeOptions 一一对应：多预载一张已下线的图 = 白白占首屏带宽。 */
  const preloads = [...page.matchAll(/rel="preload" as="image"[^>]*href="([^"]+)"/g)].map(match => match[1]);
  const modeSource = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  const modeOptions = modeSource.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const entrySrcs = [...modeOptions.matchAll(/src: '([^']+)'/g)].map(match => match[1].split('?')[0]);
  assert.ok(entrySrcs.length >= 2, '入口卡至少两张');
  for (const src of entrySrcs) {
    const thumb = '/images/.thumbs/' + src.replace(/^\/images\//, '').replace(/\.png$/i, '.webp');
    assert.ok(preloads.includes(thumb), 'index.html should preload ' + thumb);
  }
  /* 老模式的图不许再预载（已经不在首屏上了） */
  for (const stale of ['/images/.thumbs/home/entry-ecommerce.webp', '/images/.thumbs/home/entry-xhs.webp']) {
    assert.ok(!preloads.includes(stale), '下线的入口不该继续预载：' + stale);
  }
  assert.match(page, /fetchpriority="high"[^>]*href="\/images\/\.thumbs\/home\/entry-video\.webp"/);
});

test('mode cards render eager with fetchpriority high only on the primary card', () => {
  const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /loading="eager"/);
  assert.match(source, /fetchpriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(source, /priority=\{index === 0\}/);
  assert.match(source, /decoding="async"/);
});
