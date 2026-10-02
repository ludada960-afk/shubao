import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import sharp from 'sharp';

import { PRODUCTION_VISUAL_CASES } from '../scripts/production-visual-case-manifest.mjs';
import { DEFAULT_IMAGE_MODEL } from '../src/services/imageModelCatalog.js';
import {
  PRODUCTION_CASE_CATALOG,
  productionCaseById,
} from '../src/pages/Home/productionCaseCatalog.js';
import { productionGalleryItems } from '../src/pages/Home/galleryModel.js';

test('production case catalog gives every showcase asset a stable display contract', () => {
  assert.deepEqual(PRODUCTION_CASE_CATALOG.map(item => item.id), [
    'product-suite',
    'tryon-angles',
    'tryon-reference',
    'free',
    'poster',
    'social-cover',
    'brand-kv',
  ]);
  for (const item of PRODUCTION_CASE_CATALOG) {
    assert.ok(['fixture', 'curated-showcase', 'production'].includes(item.status));
    assert.ok(item.assets.length > 0);
    assert.ok(item.assets.every(asset => asset.src.startsWith('/images/') || asset.src.startsWith('/gallery/')));
    assert.ok(item.assets.every(asset => /^\d+:\d+$/.test(asset.ratio)));
    assert.ok(item.assets.every(asset => asset.label && asset.intent));
  }
});

test('ecommerce showcases are production-backed instead of curated stand-ins', () => {
  for (const id of ['product-suite', 'tryon-angles', 'tryon-reference']) {
    const item = productionCaseById(id);
    assert.equal(item.status, 'production');
    assert.ok(item.assets.filter(asset => asset.role === 'result').every(asset => asset.taskId && asset.requestKey));
    assert.ok(item.assets.every(asset => existsSync(new URL(`../public${asset.src}`, import.meta.url))));
  }
});

test('reference try-on preserves the complete product, model, and generated result stages', () => {
  const item = productionCaseById('tryon-reference');
  const stages = item.assets.filter(asset => asset.displayRole !== 'workflowBanner');
  assert.deepEqual(stages.map(asset => asset.role), ['source', 'reference', 'result']);
  assert.deepEqual(stages.map(asset => asset.label), ['完整商品与穿搭', '完整参考模特', '时尚街拍上身结果']);
  assert.deepEqual(stages.map(asset => asset.ratio), ['3:4', '3:4', '9:16']);
  // 裁剪条图(product-flatlay/reference-*，同高1254px极端比例)禁止进入任何生产案例资产
  assert.doesNotMatch(item.assets.map(asset => asset.src).join('\n'), /product-flatlay|reference-flatlay|reference-person|reference-result/);
  assert.equal(item.assets.find(asset => asset.displayRole === 'workflowBanner').ratio, '16:9');
});

test('multi-angle try-on exposes four independent complete model views', () => {
  const item = productionCaseById('tryon-angles');
  const angleSources = item.assets.filter(asset => asset.role === 'result' && !asset.displayRole);
  assert.equal(angleSources.length, 4);
  assert.equal(new Set(angleSources.map(asset => asset.src)).size, 4);
  assert.ok(angleSources.every(asset => asset.ratio === '9:16'));
  const workflow = item.assets.find(asset => asset.displayRole === 'workflowBanner');
  assert.equal(workflow.ratio, '16:9');
  // 9-14 首屏瘦身：?v= 缓存后缀会打断 .thumbs 缩略解析（responsiveImageModel 的
  // localPublicThumbnail 以扩展名结尾锚定），已从 src 移除；资源名本身即版本。
  assert.equal(workflow.src, '/images/home/tryon-showcase/editorial-multi-angle-workflow-v7.png');
  assert.equal(workflow.provenance, 'production-composite');
  assert.doesNotMatch(workflow.src, /fan-only/);
  assert.doesNotMatch(workflow.src, /\?v=/);
});

test('product suite has one wide final composite, five exact-prompt detail sources, and three rich selector previews', async () => {
  const item = productionCaseById('product-suite');
  assert.ok(item.assets.some(asset => asset.role === 'source'));
  const finalAssets = item.assets.filter(asset => asset.displayRole === 'finalComposite');
  const detailAssets = item.assets.filter(asset => ['detailSource', 'selectorPreview'].includes(asset.displayRole));
  const previews = item.assets.filter(asset => asset.displayRole === 'selectorPreview');
  assert.equal(finalAssets.length, 1);
  assert.equal(finalAssets[0].ratio, '4:3');
  assert.equal(finalAssets[0].requestKey, 'showcase-20260815-earbuds-composite-v3');
  assert.equal(finalAssets[0].taskId, 'canvas_9ddb1e933e598050fe014e69aa969d52b32a230623a586e6546a7ffcb02a5197');
  assert.equal(detailAssets.length, 5);
  assert.deepEqual(previews.map(asset => asset.selectorKind), ['structure', 'usage', 'scene']);
  const usagePreview = previews.find(asset => asset.selectorKind === 'usage');
  assert.equal(usagePreview.src, '/images/home/ecommerce-showcase/earbuds-suite-panel-model-usage.png');
  assert.equal(usagePreview.requestKey, 'showcase-20260815-earbuds-model-usage-v4');
  assert.equal(usagePreview.taskId, 'canvas_65d1792df11385e019c60ef2a69239732fc4ca109195aedcc530d404fc601adf');
  assert.match(usagePreview.prompt, /face clearly visible/i);
  assert.match(usagePreview.prompt, /earbud (?:is )?visibly worn/i);
  const [compositeMetadata, usageMetadata] = await Promise.all([
    sharp(fileURLToPath(new URL(`../public${finalAssets[0].src}`, import.meta.url))).metadata(),
    sharp(fileURLToPath(new URL(`../public${usagePreview.src}`, import.meta.url))).metadata(),
  ]);
  assert.ok(Math.abs((compositeMetadata.width / compositeMetadata.height) - (4 / 3)) < 0.01);
  assert.ok(Math.abs((usageMetadata.width / usageMetadata.height) - (3 / 4)) < 0.01);
  assert.ok(previews.every(asset => asset.isWhiteBackground !== true));
  assert.ok(previews.every(asset => asset.ratio === '3:4'));
  assert.doesNotMatch(item.assets.map(asset => asset.src).join('\n'), /cobalt-lamp/);
});

test('try-on selector uses one purpose-built wide fan from production-backed assets', () => {
  const item = productionCaseById('tryon-angles');
  const previews = item.assets.filter(asset => asset.displayRole === 'selectorPreview');
  assert.equal(previews.length, 1);
  assert.ok(previews.every(asset => asset.ratio === '16:9'));
  assert.ok(previews.every(asset => asset.provenance === 'production-composite'));
  assert.equal(previews[0].src, '/images/home/tryon-showcase/editorial-multi-angle-fan-v7.webp');
  assert.doesNotMatch(previews[0].src, /\?v=/);
  assert.match(previews[0].prompt, /不裁切/);
});

test('social formats declare Xiaohongshu, Bilibili, and Douyin in visual order', () => {
  const chapter = productionCaseById('social-cover').chapters.find(item => item.id === 'social-formats');
  assert.deepEqual(chapter.assets.map(asset => asset.platform), ['xiaohongshu', 'bilibili', 'douyin']);
});

test('gallery product suite metadata describes the production earbuds instead of the retired lamp fixture', async () => {
  const source = await import('../src/pages/Home/galleryModel.js');
  const [item] = source.productionGalleryItems([productionCaseById('product-suite')]);
  assert.match(item.title, /耳机商品套图/);
  assert.doesNotMatch(item.title, /玻璃灯/);
  // 9-14 首屏瘦身：finalComposite 改引 1600px WebP 详情图（Workbench 展示/放大共用），
  // 6.3MB 源 PNG 保留在仓库供回滚与下载，但不再出现在首屏关键路径。
  assert.equal(item.cover_url, '/images/home/ecommerce-showcase/earbuds-suite-composite-v3-1600.webp');
  assert.equal(item.ratio, '4:3');
  assert.equal(item.images.length, productionCaseById('product-suite').manifest.outputs.length);
  assert.ok(item.images.every(image => image.prompt && image.requestKey && image.taskId));
  assert.deepEqual(item.remix.sourceAssets, productionCaseById('product-suite').manifest.sourceAssets);
});

test('visual cases expose six distinct production outputs across two chapters', () => {
  for (const id of ['free', 'poster', 'social-cover', 'brand-kv']) {
    const item = productionCaseById(id);
    assert.equal(item.status, 'production');
    assert.equal(item.chapters.length, 2);
    assert.deepEqual(item.chapters.map(chapter => chapter.assets.length), [3, 3]);
    assert.equal(new Set(item.assets.map(asset => asset.src)).size, 6);
    assert.ok(item.assets.every(asset => asset.role === 'output'));
  }
});

test('production output entries cannot omit task and request provenance', () => {
  for (const item of PRODUCTION_CASE_CATALOG.filter(entry => entry.status === 'production')) {
    assert.ok(item.assets.filter(asset => ['result', 'output'].includes(asset.role)).every(asset => asset.taskId && asset.requestKey));
    assert.ok(item.assets.every(asset => existsSync(new URL(`../public${asset.src}`, import.meta.url))));
  }
  assert.throws(() => productionCaseById('missing-case'), /Unknown production case/);
});

/* ═══ 逐案例的出图模型：记录，不是默认值 ═══════════════════════════════════════════════════════
   用户 2026-09-30 原话：「如果以后再添加其他的案例进来，他们的导向就是他们生成时候的各种各样
   的模型和配置方案呀。你不要把这个做同款给写死了，就是完全指向 2 啊。」
   ⚠️ 这组用例的判据刻意**不**断言"这些案例是 image2"——那是数据，会随重新生成而变；
   它断言的是三条不会随数据漂移的契约。 */
test('每一条生产案例资产都必须自带 imageModel 记录（漏写就构造失败，不静默继承）', () => {
  for (const entry of PRODUCTION_CASE_CATALOG) {
    for (const asset of entry.assets) {
      assert.equal(typeof asset.imageModel, 'string', `${entry.id}/${asset.id} 缺 imageModel 记录`);
      assert.ok(asset.imageModel.trim(), `${entry.id}/${asset.id} 的 imageModel 是空串`);
    }
  }
});

test('目录里逐资产的 imageModel 与生成声明（manifest）不许走岔', () => {
  /* 两边各写各的（src/ 不能依赖 scripts/，发布归档里没有 scripts/），所以靠这条钉住。
     manifest 的粒度是"一条案例 = 一张图"，与目录里的资产一一对应。 */
  const declared = new Map(PRODUCTION_VISUAL_CASES.map(item => [item.id, item.imageModel]));
  const visualAssets = PRODUCTION_CASE_CATALOG
    .filter(entry => entry.status === 'production')
    .flatMap(entry => entry.assets)
    .filter(asset => declared.has(asset.id));
  assert.equal(visualAssets.length, 24, '视觉案例资产应当全部能在生成声明里找到对应记录');
  for (const asset of visualAssets) {
    assert.equal(asset.imageModel, declared.get(asset.id),
      `${asset.id}：目录记的出图模型与生成声明不一致 —— 重新生成后必须两边一起改`);
  }
});

test('做同款读案例自己的记录；记录不在时才回落到全局默认', () => {
  /* ⚠️ 判据用 image2（**非默认**）而不是 sunburst：全局默认本身就是 2.5，
     拿 2.5 当假数据的话，"读了记录"和"回落了默认"两件事观测结果一模一样，验不出任何东西。 */
  const fakeCase = (id, imageModel) => ({
    id: 'free',
    status: 'production',
    assets: [{
      id, src: `/images/visual-recipes/cases/${id}.png`, label: '假案例', role: 'output',
      ratio: '1:1', intent: 'free', prompt: '假提示词', requestKey: `showcase-fake-${id}`,
      ...(imageModel === undefined ? {} : { imageModel }),
    }],
  });
  const replayModelOf = entry => {
    const item = productionGalleryItems([entry])[0];
    return { outer: item.imageModel, replay: item.replay.imageModel };
  };

  for (const recorded of ['image2', 'image2-5-sunburst', 'nano-banana']) {
    const { outer, replay } = replayModelOf(fakeCase(`recorded-${recorded}`, recorded));
    assert.equal(outer, recorded, `案例记的是 ${recorded}，做同款就必须带 ${recorded}`);
    assert.equal(replay, recorded, 'replay 与外层必须是同一个来源，不许只改一处');
  }
  /* 空白与缺字段都算"没有记录" —— 那才是"没得选"，回落全局默认。 */
  for (const entry of [fakeCase('blank', '   '), fakeCase('absent')]) {
    const { outer, replay } = replayModelOf(entry);
    assert.equal(outer, DEFAULT_IMAGE_MODEL, '没有记录时回落到全局默认');
    assert.equal(replay, DEFAULT_IMAGE_MODEL, 'replay 同样回落，不许留一个写死的旧模型');
  }
});
