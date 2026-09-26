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

import { buildVideoModelRows, productForResolution, rowOfVariant, videoModelChip } from '../src/pages/VideoStudio/videoModelRows.js';
import { publicVideoProducts, videoFeatureSku } from '../server/videoCatalog.mjs';

const rows = buildVideoModelRows(publicVideoProducts());
/* 批 BO：MiniMax 的 2K 拆成了**独立一行**，三处判断都要用它 ⇒ 在模块作用域定义一次 */
const mini2k = rowOfVariant(rows, 'minimax-h3-2k');

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
  /* ═══ 2026-09-26 批 BR-2：**分组标题行已经删掉**（用户原话：「没必要分类完把名字都当标题
     再各自做一行啊，都应该去掉」）⇒ 页面上"分组"表现为**相邻**而不是一行标题：
     这里断言"同一家族的型号在展示顺序里连续出现"，分组语义一个没丢。 */
  const flat = rows.families.flatMap(family => family.rows.map(row => row.family));
  const firstSeen = new Set();
  let lastFamily = '';
  for (const key of flat) {
    if (key !== lastFamily) {
      assert.ok(!firstSeen.has(key), '家族 ' + key + ' 在列表里被切成了多段（分组失效）');
      firstSeen.add(key);
      lastFamily = key;
    }
  }
});

test('② 只有分辨率不同的档位合并成一行，分辨率交给「生成设置」', () => {
  /* 通义万相 3.0：720P/480P 与 1080P 是两条产品（价档不同），用户眼里是**一个**模型 */
  const wan = rowOfVariant(rows, 'wan-3.0');
  assert.ok(wan, '通义万相 3.0 必须是一行');
  assert.equal(wan.products.length, 2, '两条产品合并成一行');
  assert.deepEqual(wan.resolutions, ['480p', '720p', '1080p'], '三档清晰度按低→高排列（字典序会排错）');
  assert.equal(wan.label, '通义万相 3.0', '型号名不带分辨率');

  const mini = rowOfVariant(rows, 'minimax-h3');
  /* 批 BO：MiniMax 的 2K **不再并进 H3**（用户指示：「还不如直接在模型里面加个 Mini max 2k 的版本」）——
     它走另一条上游路由（xn-minimax-h3），参考素材额度也不同（30/30/30 vs 9/3/3），属「另一档供给」。
     判据：**同路由的档位 = 参数（进清晰度）；不同路由的档位 = 另一个模型（进模型行）**。 */
  assert.ok(mini2k, 'MiniMax H3 2K 必须是独立的一行');
  assert.equal(mini.products.length, 1, 'MiniMax H3 这行只放同路由的 480P/720P');
  /* 2026-09-25 批 BM 追加：MiniMax H3 的上游文档价目里 **480p 比 720p 更便宜**
     （480p 0.108 / 720p 0.162 / 1080p 0.4725 每秒，取自 /api/pricing 里 minimax-h3 那条的描述），
     同价提供不损毛利，所以这一档直接开 —— 与通义万相 480P 同一条判据。 */
  assert.deepEqual(mini.resolutions, ['480p', '720p']);
  assert.deepEqual(mini2k.resolutions, ['2k']);

  /* ═══ 型号名与分辨率的关系（批 BM 立规，批 BO 收窄）══════════════════════════════════════
     · 用户点名过的是「**720P 的特定模型**」⇒ **通用档位**（480P / 720P / 768P）一律不许进型号名 ——
       它们是跨模型的最大公约数，只能出现在「清晰度」里。
     · 但用户也要「**MiniMax H3 2K** 这种独立版本」（原话：「还不如直接在模型里面加个 Mini max 2k
       的版本」）⇒ **独有档位**允许出现在型号名里，条件是它必须是
       「单独一档 + 单一产品 + 独立路由」的行 —— 否则又变成"用参数切模型"。 */
  for (const row of rows.rows) {
    assert.doesNotMatch(row.label, /(480|720|768)P/i, `${row.label} 的型号名里还写着通用档位`);
    if (/(1080P|2K)/i.test(row.label)) {
      assert.equal(row.products.length, 1, `${row.label}：独有档位只能单独一行（不许合并多条产品）`);
      assert.equal(row.resolutions.length, 1, `${row.label}：既然写进名字了，这一行就只能有那一档`);
    }
  }
});

test('③ 选哪一档就切到哪条产品（价目/时长上限跟着走）—— 钱路一个字没改', () => {
  const wan = rowOfVariant(rows, 'wan-3.0');
  const mini = rowOfVariant(rows, 'minimax-h3');

  /* 关键映射：档位 → 产品 id。这两个 id 是服务端目录里**既有**的档位，不是新造的收费项。 */
  assert.equal(productForResolution(wan, '1080p').id, 'wan_1080p');
  assert.equal(productForResolution(wan, '720p').id, 'wan_standard');
  assert.equal(productForResolution(wan, '480p').id, 'wan_standard');
  assert.equal(productForResolution(mini2k, '2k').id, 'minimax_h3_2k');
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
test('⑦ 族内行序：默认档置顶 → 价格升序 → 稳定（用户：「为什么又乱了呢」）', () => {
  /* 实测改前 Seedance 组是目录书写顺序（Fast / 标准 / 2.5 / 轻量 / 满参数 / Mini），
     同一底座的档位被 2.5 插在中间 ⇒ 看着就是乱的。
     规则必须客观可复算：**默认档置顶，其余按短档价从低到高，价格相同按 variant 稳定排序**。 */
  for (const family of rows.families) {
    const prices = family.rows.map(row => Number(row.primary?.quotes?.short?.points ?? 0));
    const first = family.rows[0];
    if (family.rows.some(row => row.products.some(product => product.default === true))) {
      assert.ok(first.products.some(product => product.default === true),
        family.label + '：默认档必须排第一，实测第一行是 ' + first.label);
    }
    const rest = prices.slice(1);
    assert.deepEqual(rest, [...rest].sort((a, b) => a - b),
      family.label + '：默认档之后必须按价格升序，实测 ' + prices.join('/'));
  }
});

test('⑤ 分组标题是纯文本、行样式仍是直接子选择器、滚动条看得见', () => {
  const page = fs.readFileSync('src/pages/VideoStudio/index.jsx', 'utf8');
  const css = fs.readFileSync('src/pages/VideoStudio/VideoStudio.css', 'utf8');

  /* ① 分组用 Fragment：套了 div 就会让 `.video-inline-menu > button` 整族失效 */
  assert.match(page, /<React\.Fragment key=\{family\.key\}>/, '分组必须用 Fragment 包（不套 div）');
  assert.match(css, /\.video-inline-menu > button\b/, '行样式的直接子选择器仍在（前提就是上面那条）');

  /* ② 2026-09-26 批 BR-2：**分组标题行整块删掉**（用户原话见上）——
     判据翻转：页面里不许再出现那个类，样式表里也不许留死规则。 */
  assert.doesNotMatch(page, /video-model-group-label/, '族名不许再当标题占一行（用户明确要求拿掉）');
  assert.doesNotMatch(css, /\.video-model-group-label/, '样式表里不许留分组标题的死规则');

  /* ③ 滚动条**看得见**（用户原话：「右边要搞一条这种拉动条可以往下面拉」）——
      批 BG 那版是 `width: 0`（Chromium 里彻底不画），本轮改回站内素材条那套细滚动条。 */
  assert.doesNotMatch(css, /\.video-inline-menu::-webkit-scrollbar \{ width: 0/, '不许再把滚动条画成 0 宽');
  assert.match(css, /\.video-inline-menu::-webkit-scrollbar \{ width: 8px/, '模型下拉的滚动条 8px');
  assert.match(css, /\.video-inline-menu \{ scrollbar-width: thin; \}/, 'Firefox 一侧同样给细条');
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   第六节：型号行的小标签写"支持的清晰度"（用户提问引出的一处发现性修补）

   用户原话（逐字）：「可是这样做的话，不是没有所谓的 **2K** 的配置按钮吗，
   那不是还得在模型选择里面做这个选项吗？」

   答案分两半，两半都要在这里守住：
     · 2K 的**按钮**在「生成设置 → 清晰度」里（见第 ③ 条断言的映射），不需要在模型列表里占一行；
     · 但合并之后列表里确实**看不出**"这个型号还能出 2K" ⇒ 多档行的标签改成档位清单。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
test('⑥ 多清晰度档位的型号行：标签写"支持哪些清晰度"（2K 在列表里看得见，选择仍在生成设置）', async () => {
  const wan = rowOfVariant(rows, 'wan-3.0');
  const mini = rowOfVariant(rows, 'minimax-h3');
  const single = rowOfVariant(rows, 'sd-2.0');

  assert.equal(videoModelChip(mini, mini.tierLabel), '480P · 720P', 'MiniMax H3 列出它那两档');
  assert.equal(videoModelChip(wan, wan.tierLabel), '480P · 720P · 1080P', '通义万相 3.0 列出三档');
  /* 单档行保持档位文案（'正式交付' 这类），不要被改成 "720P" 这种没有信息量的东西 */
  assert.equal(videoModelChip(single, single.tierLabel), single.tierLabel, '单档行仍写档位文案');

  const page = fs.readFileSync('src/pages/VideoStudio/index.jsx', 'utf8');
  assert.match(page, /videoModelChip\(row,/, '页面必须走这一个函数（标签口径只有一处）');
  /* 2K / 1080P 的"按钮"仍然只可能来自清晰度药丸：这两种清晰度各自映射到既有价档产品 */
  assert.equal(productForResolution(mini2k, '2k').id, 'minimax_h3_2k', '2K 现在由它自己那一行承载');
  assert.equal(productForResolution(wan, '1080p').id, 'wan_1080p');
});
