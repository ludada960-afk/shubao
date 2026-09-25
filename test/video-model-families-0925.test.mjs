/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-25 批 BM 门禁：**视频模型下拉按家族分组 + 分辨率进「生成设置」**

   用户原话（逐字）：
     「你这个模型选择……**为什么 seedance 不放到一起呢？mini max 你也没有放到一起**。
      然后现在视频生成这里的模型……**为什么会有 720P 的特定模型呢？720P 应该在生成设置里面去选的呀**，
      用户在这里就只负责选相应的模型就可以了，然后参数是在生成设置里面去做的呀。」

   这一批守三件事，每一件都能单独失败：
     ① **分组**：同一家族的行必须挨在一起（改前四条 Seedance 被 MiniMax/万相/可灵切成 4 段）；
     ② **合并**：同一个型号下"只有分辨率不同"的产品必须是**一行**，清晰度由「生成设置」选；
     ③ **不丢档 / 不动钱路**：合并只是展示层 —— 每个公开产品仍然恰好属于一行，
        服务端的公开清单与 SKU 派生一个字没变（点了 1080P 仍然走 video_wan_1080p_*）。
   ⚠️ 断言的是**行为**（函数返回值），不是源码字符串：分组逻辑是纯函数，改错了这里必红。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { buildVideoModelRows, productForResolution, rowOfVariant } from '../src/pages/VideoStudio/videoModelRows.js';
import { publicVideoProducts, videoFeatureSku } from '../server/videoCatalog.mjs';

const rows = buildVideoModelRows(publicVideoProducts());

test('① 同一家族的行挨在一起（Seedance 不再被别的家族切成 4 段）', () => {
  const order = rows.families.map(family => family.key);
  assert.deepEqual(order, [...new Set(order)], '家族不许重复出现 —— 重复就是"分组没生效、只是排了个序"');
  /* 改前的实际顺序：seedance / minimax / wan / kling / seedance / minimax / seedance —— 家族出现 4 次。
     现在每族只出现一次，且族内全是本族的产品。 */
  for (const family of rows.families) {
    for (const row of family.rows) {
      assert.equal(row.family, family.key, `${row.label} 落到了 ${family.key} 组里`);
    }
  }
  const seedance = rows.families.find(family => family.key === 'seedance');
  assert.ok(seedance.rows.length >= 5, 'Seedance 一族的型号都在这组里');
  assert.deepEqual(
    rows.families.map(family => family.label),
    ['Seedance', 'MiniMax', '通义万相', '可灵'],
    '四族顺序 = 目录顺序（用户记住的位置不该每版都换）',
  );
});

test('② 只有分辨率不同的档位合并成一行，分辨率交给「生成设置」', () => {
  /* 通义万相 3.0：720P/480P 与 1080P 是两条产品（价档不同），用户眼里是**一个**模型 */
  const wan = rowOfVariant(rows, 'wan-3.0');
  assert.ok(wan, '通义万相 3.0 必须是一行');
  assert.equal(wan.products.length, 2, '两条产品合并成一行');
  assert.deepEqual(wan.resolutions, ['480p', '720p', '1080p'], '三档清晰度按低→高排列（字典序会排错）');
  assert.equal(wan.label, '通义万相 3.0', '型号名不带分辨率');

  const mini = rowOfVariant(rows, 'minimax-h3');
  assert.equal(mini.products.length, 2, 'MiniMax H3 的 720P 与 2K 是同一行');
  /* 2026-09-25 批 BM 追加：MiniMax H3 的上游文档价目里 **480p 比 720p 更便宜**
     （480p 0.108 / 720p 0.162 / 1080p 0.4725 每秒，取自 /api/pricing 里 minimax-h3 那条的描述），
     同价提供不损毛利，所以这一档直接开 —— 与通义万相 480P 同一条判据。 */
  assert.deepEqual(mini.resolutions, ['480p', '720p', '2k']);

  /* 型号名里不许再出现分辨率（用户点名的就是「720P 的特定模型」） */
  for (const row of rows.rows) {
    assert.doesNotMatch(row.label, /(480|720|768|1080)P|2K|1440P/i, `${row.label} 的型号名里还有分辨率`);
  }
});

test('③ 选哪一档就切到哪条产品（价目/时长上限跟着走）—— 钱路一个字没改', () => {
  const wan = rowOfVariant(rows, 'wan-3.0');
  const mini = rowOfVariant(rows, 'minimax-h3');

  /* 关键映射：档位 → 产品 id。这两个 id 是服务端目录里**既有**的档位，不是新造的收费项。 */
  assert.equal(productForResolution(wan, '1080p').id, 'wan_1080p');
  assert.equal(productForResolution(wan, '720p').id, 'wan_standard');
  assert.equal(productForResolution(wan, '480p').id, 'wan_standard');
  assert.equal(productForResolution(mini, '2k').id, 'minimax_h3_2k');
  assert.equal(productForResolution(mini, '720p').id, 'minimax_h3_768p');
  assert.equal(productForResolution(mini, '480p').id, 'minimax_h3_768p', '480P 与 720P 同属一条产品（同价档，SKU 不变）');

  /* SKU 仍然由**产品 id** 派生 ⇒ 切档位 = 换一条既有价档，不是新价（铁律：不动钱路）。 */
  assert.equal(videoFeatureSku({ productId: 'wan_1080p', duration: 5 }), 'video_wan_1080p_short');
  assert.equal(videoFeatureSku({ productId: 'minimax_h3_2k', duration: 5 }), 'video_minimax_h3_2k_short');

  /* 合并的只是展示：每一条公开产品都必须**恰好**落在一行里（漏一条 = 用户选不到；重复 = 出现两遍）。 */
  const seen = rows.rows.flatMap(row => row.products.map(product => product.id));
  const publics = publicVideoProducts().map(product => product.id);
  assert.deepEqual(seen.slice().sort(), publics.slice().sort(), '公开产品一个不多一个不少');
  assert.equal(new Set(seen).size, seen.length, '没有产品被放进两行');
});

test('④ 下拉渲染消费分组结果，清晰度药丸来自**型号行**而不是单条产品', async () => {
  const page = fs.readFileSync('src/pages/VideoStudio/index.jsx', 'utf8');
  assert.match(page, /buildVideoModelRows\(products\)/, '下拉必须用分组结果，不许再直接 map products');
  assert.match(page, /modelRows\.families\.map/, '按家族分组渲染');
  assert.match(page, /rowOfVariant\(modelRows, selectedProduct\?\.variant\)/, '当前型号行按 variant 判定（选了 2K 勾还在）');
  /* 清晰度药丸的来源：改前是 `(selectedProduct?.resolutions || ['720p'])` ——
     那样通义万相选到 1080P 档后只剩 1080P 一个药丸，用户没法切回 720P（正是"一直都没有相应的参数"）。 */
  assert.match(page, /clarityOptions\.map/, '清晰度药丸必须来自型号行的档位集合');
  assert.doesNotMatch(page, /\(selectedProduct\?\.resolutions \|\| \['720p'\]\)\.map/, '旧的单产品药丸已下线');
  assert.match(page, /selectClarity/, '选档位要能切产品（selectClarity）');
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   第五节：下拉面板的**版式与可见滚动条**（把实机量到的约束钉在源头）

   为什么单列一节：分组是把按钮包在 `<React.Fragment>` 里渲染的（**不套 div**），
   而模型行的样式全挂在 `.video-inline-menu > button` 这一族**直接子选择器**上 ——
   将来谁把 Fragment 换成 div，整族样式会**静默失配**（页面照常渲染、行变成裸文字）。
   实机复验（.qa/bm6-verify.mjs → .tmp/bm6/bm6-verify.json）量到：直接子 button = 10、
   行底 #f4f4f4 / 圆角 12 / min-height 56 / 选中环 3px，都来自这一族。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
test('⑤ 分组标题是纯文本、行样式仍是直接子选择器、滚动条看得见', () => {
  const page = fs.readFileSync('src/pages/VideoStudio/index.jsx', 'utf8');
  const css = fs.readFileSync('src/pages/VideoStudio/VideoStudio.css', 'utf8');

  /* ① 分组用 Fragment：套了 div 就会让 `.video-inline-menu > button` 整族失效 */
  assert.match(page, /<React\.Fragment key=\{family\.key\}>/, '分组必须用 Fragment 包（不套 div）');
  assert.match(css, /\.video-inline-menu > button\b/, '行样式的直接子选择器仍在（前提就是上面那条）');

  /* ② 分组标题是标签、不是选项：不是 button / 没有手型指针 / 没有 hover 底 */
  assert.match(css, /\.video-model-group-label \{/, '分组标题要有自己的类');
  const labelBlock = css.slice(css.indexOf('.video-model-group-label {'), css.indexOf('.video-model-group-label + .video-model-group-label'));
  assert.doesNotMatch(labelBlock, /cursor:\s*pointer/, '分组标题不许有手型指针（会让人以为能点）');
  assert.doesNotMatch(labelBlock, /:hover/, '分组标题不许有 hover 态');
  assert.match(page, /<div className="video-model-group-label">/, '分组标题渲染成 div（不是 button）');
  /* 11/700：10/600 实测压不住下面的模型行（角标档 vs 说明档，见 CSS 里的注释） */
  assert.match(css, /\.video-model-group-label \{[\s\S]{0,400}font-size: var\(--sb-text-xs\)/);
  assert.match(css, /\.video-model-group-label \{[\s\S]{0,400}font-weight: var\(--sb-weight-bold\)/);

  /* ③ 滚动条**看得见**（用户原话：「右边要搞一条这种拉动条可以往下面拉」）——
      批 BG 那版是 `width: 0`（Chromium 里彻底不画），本轮改回站内素材条那套细滚动条。 */
  assert.doesNotMatch(css, /\.video-inline-menu::-webkit-scrollbar \{ width: 0/, '不许再把滚动条画成 0 宽');
  assert.match(css, /\.video-inline-menu::-webkit-scrollbar \{ width: 8px/, '模型下拉的滚动条 8px');
  assert.match(css, /\.video-inline-menu \{ scrollbar-width: thin; \}/, 'Firefox 一侧同样给细条');
});
