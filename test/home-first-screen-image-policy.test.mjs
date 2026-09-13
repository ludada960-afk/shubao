import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

import { responsiveImageCandidates } from '../src/components/responsiveImageModel.js';
import { PRODUCTION_CASE_CATALOG } from '../src/pages/Home/productionCaseCatalog.js';

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

test('four mode-card entry images resolve to existing webp thumbs before any PNG source', () => {
  const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  const options = source.match(/const modeOptions = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const srcs = [...options.matchAll(/src: '([^']+)'/g)].map(match => match[1]);
  assert.equal(srcs.length, 4);
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
      assert.match(src, /^\/images\/home\/entry-(video|xhs|visual)\.png\?v=\d{8}$/);
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
  // 首屏 4 张模式卡都有预载（其中 entry-ecommerce 带 fetchpriority=high 作 LCP 候选）
  const preloads = [...page.matchAll(/rel="preload" as="image"[^>]*href="([^"]+)"/g)].map(match => match[1]);
  for (const thumb of [
    '/images/.thumbs/home/entry-ecommerce.webp',
    '/images/.thumbs/home/entry-video.webp',
    '/images/.thumbs/home/entry-xhs.webp',
    '/images/.thumbs/home/entry-visual.webp',
  ]) {
    assert.ok(preloads.includes(thumb), 'index.html should preload ' + thumb);
  }
  assert.match(page, /fetchpriority="high"[^>]*href="\/images\/\.thumbs\/home\/entry-ecommerce\.webp"/);
});

test('mode cards render eager with fetchpriority high only on the primary card', () => {
  const source = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /loading="eager"/);
  assert.match(source, /fetchpriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(source, /priority=\{index === 0\}/);
  assert.match(source, /decoding="async"/);
});
