// test/ecommerce-spec-parity-1002.test.mjs
// 门禁：电商套图的**规格只有一个真相**（2026-10-02，批 之二十三 收尾）。
//
// 起因是用户批注⑧：「详情图这个规格不对呀，我这边明明是 200×267，它显示的是 1:1」。
// 追出来的是**三张互相打架的比例表** + 一处把服务端下发尺寸整个扔掉的代码：
//
//   ① 服务端 `modelCatalog.LEGAL_IMAGE_SIZES` 才是真正决定像素的那一方（详情图 9:16 / 1152×2048）。
//   ② 前端 `ASSET_META` 里 6 个 `detail_slice_*` 有 5 个服务端根本不发，
//      而服务端实际发的 10 个详情 role 一个都不在表里 ⇒ 全部掉进兜底。
//   ③ 兜底写死 `ratio: '1:1'` ⇒ 标签说 1:1、画面是竖图。**这就是用户看到的那一幕。**
//   ④ `normalizeAsset` 只读 `input.w/h`，把服务端下发的 `width/height` 扔了，
//      200×267 就是它按比例分支自己算出来的，不是真实尺寸。
//   ⑤ 画布套图请求写的是 `detail_slice_feature`，而服务端 `COUNTED_SIZING_KEYS` 只认 `detail`
//      ⇒ 这一行被 `normalizeSizing` 丢弃 ⇒ **详情图一张都不生成**。
//
// 这里守的是**判据**：兜底不许再一律 1:1；真实尺寸不许被丢弃；
// 服务端 role 前缀要能正确归组；画布请求的 key 必须是服务端认的那个。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAssetMeta, normalizeAsset, ASSET_GROUPS } from '../src/pages/EcCanvas/canvasState.js';
import { mediaHeightForRatio } from '../src/pages/EcCanvas/canvasGeometry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('① 服务端真正会发的 role，兜底**不许**一律给 1:1', () => {
  /* 下面是 server/ecommerceEngine/assetPlanner.mjs 实际产出的详情 role，
     改动服务端时这条会红 —— 那正是它该红的时候（说明要同步补 ASSET_META 或别名）。 */
  const detailRoles = [
    'detail_slice_construction_detail',
    'detail_slice_edge_geometry',
    'detail_slice_exterior_structure',
    'detail_slice_material_transition',
    'detail_slice_surface_finish',
    'detail_slice_surface_texture',
    'detail_slice_visible_feature',
    'detail_slice_visible_material',
    'detail_slice_visible_outline',
    'detail_slice_visual_form',
  ];
  detailRoles.forEach(role => {
    const meta = getAssetMeta(role);
    assert.equal(meta.ratio, '9:16', role + ' 必须是 9:16（服务端 LEGAL_IMAGE_SIZES 就是这个）');
    assert.equal(meta.group, '详情图', role + ' 必须归到「详情图」，不是「素材」');
    assert.ok(ASSET_GROUPS.includes(meta.group));
  });

  /* 服务端下发 ratio 时，**它优先** —— 它才是决定像素的那一方 */
  assert.equal(getAssetMeta('detail_slice_visual_form', { ratio: '3:4' }).ratio, '3:4',
    '服务端下发的 ratio 必须压过前端猜的值');

  /* 连字符写法也要认（服务端 prompt 里有 detail-slice-visual-form 这种形态） */
  assert.equal(getAssetMeta('detail-slice-visual-form').group, '详情图');

  /* 非详情类不得被误判成详情图 */
  assert.equal(getAssetMeta('main_text').group, '主图');
  assert.equal(getAssetMeta('sku').group, 'SKU');
  assert.equal(getAssetMeta('transparent').group, '素材');
  assert.equal(getAssetMeta('white_background').ratio, '1:1', '白底图服务端 key 是 white_background');
});

test('② 真实的 width/height 不许被丢弃（用户看到的 200×267 就是丢弃后的产物）', () => {
  const detail = normalizeAsset({ key: 'detail_slice_visual_form', ratio: '9:16', width: 1152, height: 2048, url: '/d.png' });
  assert.equal(detail.w, 1152, '必须用服务端下发的真实宽度');
  assert.equal(detail.h, 2048, '必须用服务端下发的真实高度');
  assert.equal(detail.ratio, '9:16');

  /* 没有下发尺寸时才按比例推 —— 而推出来的比例必须与几何模块一致 */
  const derived = normalizeAsset({ key: 'detail_slice_visual_form', url: '/d2.png' });
  assert.equal(derived.w, 200);
  assert.equal(derived.h, mediaHeightForRatio('9:16', 200));

  /* 比例分支必须认全，不能只有 3:4 / 9:16 / 长图 —— 4:3、2:3、5:4 原来全退化成正方形。
     判据：高度必须等于「按比例算出来的那个数」，而不是等于某个写死的分支。 */
  ['4:3', '2:3', '5:4', '16:9', '3:4', '9:16', '1:5', '4:5'].forEach(ratio => {
    const [a, b] = ratio.split(':').map(Number);
    const asset = normalizeAsset({ key: 'x', ratio, url: '/x.png' });
    assert.equal(asset.h, Math.round(200 * b / a), ratio + ' 的高度必须按比例算');
    assert.equal(asset.h, mediaHeightForRatio(ratio, 200), ratio + ' 必须与几何模块同口径');
    if (b > a) assert.ok(asset.h > asset.w, ratio + ' 必须是竖图');
    if (a > b) assert.ok(asset.w > asset.h, ratio + ' 必须是横图');
  });
  const square = normalizeAsset({ key: 'x', ratio: '1:1', url: '/x.png' });
  assert.equal(square.h, square.w);
  const long = normalizeAsset({ key: 'x', ratio: '长图', url: '/x.png' });
  assert.ok(long.h > long.w, '长图没有比例含义，按既有约定给一个更高的框');
  const tall = normalizeAsset({ key: 'x', ratio: '9:16', url: '/x.png' });
  assert.ok(tall.h > tall.w, '9:16 必须是竖图');
});

test('③ 画布套图请求必须用服务端认的那个 key，否则那一行会被静默丢掉', () => {
  const planner = read('server/ecommerceEngine/assetPlanner.mjs');
  const counted = planner.match(/COUNTED_SIZING_KEYS\s*=\s*new Set\(\[([^\]]*)\]/)?.[1]
    || planner.match(/COUNTED_SIZING_KEYS\s*=\s*\{([^}]*)\}/)?.[1]
    || '';
  assert.ok(counted, '必须仍能找到服务端的 COUNTED_SIZING_KEYS');
  ['white_bg', 'main_text', 'detail'].forEach(key => {
    assert.ok(counted.includes(key), '服务端认的 key 里必须有 ' + key);
  });

  const INDEX = read('src/pages/EcCanvas/index.jsx');
  const block = INDEX.slice(INDEX.indexOf('const imageSelections = sizingImages.length'));
  const keys = [...block.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
  assert.ok(keys.includes('detail'), '详情图那一行必须写 key: \'detail\'');
  keys.forEach(key => {
    assert.ok(counted.includes(key), `'${key}' 不在服务端 COUNTED_SIZING_KEYS 里，会被 normalizeSizing 整行丢弃`);
  });
  /* 详情图默认 9:16 —— 与服务端 catalog 一致，不要再写 1:1 */
  assert.match(block, /key: 'detail', count: detailCount, ratio: composer\.ratio \|\| '9:16'/);
});

test('④ 卡片尺寸只能来自一处：整卡几何与素材归一化必须共用 mediaHeightForRatio', () => {
  const state = stripComments(read('src/pages/EcCanvas/canvasState.js'));
  assert.match(state, /import \{ mediaHeightForRatio \}/, '必须复用 canvasGeometry 的比例→高度');
  /* 旧的四分支写法不许复活 */
  assert.doesNotMatch(state, /ratio === '3:4' \? Math\.round/,
    '不许再写死三分支（4:3 / 2:3 / 5:4 会全部退化成正方形）');

  /* 比例→高度必须是**解析**而不是枚举：服务端 catalog 有 13 种比例，
     枚举式写法每漏一种就是一张画错的卡（2:3、5:4、1:5… 全都变方图）。 */
  const geometry = read('src/pages/EcCanvas/canvasGeometry.js');
  assert.match(geometry, /export function mediaHeightForRatio/);
  const start = geometry.indexOf('export function mediaHeightForRatio');
  const body = geometry.slice(start, geometry.indexOf('\n}', start));
  assert.doesNotMatch(body, /if \(normalized === '\d+:\d+'\)/,
    'mediaHeightForRatio 不许再逐条枚举比例 —— 必须解析 `宽:高`');
  assert.match(body, /\\d\+/, '必须真的解析比例字符串');
  assert.equal(mediaHeightForRatio('2:3', 200), 300);
  assert.equal(mediaHeightForRatio('1:5', 200), 1000);
  assert.equal(mediaHeightForRatio('乱写', 200), 200, '解析不了就退回正方形，不许崩');
});

test('⑤ 详情图标签不许再说 1:1（用户批注原文）', () => {
  /* 脚注渲染的就是 node.ratio，所以只要归一化阶段不再兜底 1:1，标签就对了 */
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(studio, /node\.group, node\.ratio/, '卡片脚注读的是 node.ratio');
  const detail = normalizeAsset({ key: 'detail_slice_visual_form', url: '/d.png' });
  assert.notEqual(detail.ratio, '1:1', '详情图归一化后不得再是 1:1');
  assert.equal(detail.group, '详情图');
});