import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ext = read('src/pages/EcCanvas/canvasQuantvExtensions.js');
const billing = read('src/pages/EcCanvas/canvasBillingModel.js');
const index = read('src/pages/EcCanvas/index.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   画布上有**两张互不相干的成本表**（批 CY-㉒ 实测，这是最容易出事的组合）：

     ① `canvasBillingModel.ACTIONS`（13 档）—— **计费表**，带真实 sku，
        报价/扣费走它。它的 units 是**积分**。
     ② `canvasQuantvExtensions.NODE_COST_ESTIMATES`（21 档）—— **估算表**，
        只有数字、没有 sku。右面板「预计消耗」与整链运行的「预计积分」读它。

   两表有 **6 个键同名**（smart-remix / remove-bg / extend / inpaint / translate / upscale），
   而它们的数值**不是一回事**（本批实测，见 ②）。

   哪个是真的？我 SSH 上生产读了 `server/billing/catalog.mjs` 的线上单价：
     ec_image_2k = 1000 units, ec_image_4k = 2000, ec_remove_bg = 500,
     ec_smart_layer = 3000, ec_reverse_prompt = 200, ec_canvas_ocr = 200
     ⇒ 1 积分 = 1000 units
   代入计费表：**全部对得上**（0.2/0.2/1/1/1/1/1/1/2）。
   两处「对不上」是**故意**的，且代码里写了原因：
     · remove-bg  声明 0.7 = 商品识别 0.2 + 抠图 0.5（展示价必须含前置那次识别）
     · layer-edit 声明 3.2 = 商品识别 0.2 + 分层 3.0（同理）
   ⇒ **计费表是对的，估算表是错的**（差一个数量级）。

   为什么这不是「估高一点无所谓」：用户点一个动作前看到的价（计费表）与
   右面板/整链运行里显示的「预计消耗」（估算表）**差 10 倍**，
   而真实扣的是前者 ⇒ 同一个功能在两个界面报两个价。这正是用户反复报的
   「看着是 A、跑的是 B」。
   ══════════════════════════════════════════════════════════════════════════════ */

function parseEstimates() {
  const m = /NODE_COST_ESTIMATES = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(ext);
  assert.ok(m, '必须还能找到 NODE_COST_ESTIMATES');
  const out = {};
  for (const line of m[1].split('\n')) {
    const k = /^\s*'?([\w-]+)'?\s*:\s*([\d.]+)/.exec(line);
    if (k) out[k[1]] = Number(k[2]);
  }
  return out;
}

function parseBilling() {
  const m = /const ACTIONS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(billing);
  assert.ok(m, '必须还能找到 ACTIONS');
  const out = {};
  for (const line of m[1].split('\n')) {
    const k = /^\s*'?([\w-]+)'?\s*:\s*(FREE|\{)/.exec(line);
    if (!k) continue;
    const um = /units:\s*([\d.]+)/.exec(line);
    const sm = /sku:\s*'([\w-]+)'/.exec(line);
    out[k[1]] = { points: um ? Number(um[1]) : 0, sku: sm ? sm[1] : null };
  }
  return out;
}

test('① 两张表都必须还解析得出来（改坏结构时立刻发现，而不是静默返回 0）', () => {
  const estimates = parseEstimates();
  const actions = parseBilling();
  assert.ok(Object.keys(estimates).length >= 20, `估算表应有 20+ 档，实际 ${Object.keys(estimates).length}`);
  assert.ok(Object.keys(actions).length >= 12, `计费表应有 12+ 档，实际 ${Object.keys(actions).length}`);
  // 掉到 0 的档位是最危险的：estimateNodeCost 用 `|| 0` 兜底，缺一个键就静默变成"免费"
  const zeroed = Object.entries(estimates).filter(([, v]) => v === 0);
  assert.ok(zeroed.length <= 2,
    `估算表里不该有这么多 0 档（0 = 这条链不花钱）：${zeroed.map(([k]) => k).join(', ')}`);
});

test('② 同名的 6 个键：两表数值**必须一致**（不一致 = 同一功能在两个界面报两个价）', () => {
  const estimates = parseEstimates();
  const actions = parseBilling();
  const shared = Object.keys(estimates).filter(k => k in actions);
  assert.deepEqual(
    shared.sort(),
    ['extend', 'inpaint', 'remove-bg', 'smart-remix', 'translate', 'upscale'],
    '同名键的集合变了。若是有意新增/删除，请同步两张表并在 RTK 记下依据',
  );
  const mismatched = shared
    .map(k => ({ k, estimate: estimates[k], billing: actions[k].points }))
    .filter(row => row.estimate !== row.billing);
  assert.deepEqual(
    mismatched, [],
    '这些键在「计费表」与「估算表」里数值不同 ⇒ 用户点之前看到一个价、'
      + '在右面板/整链运行里又看到另一个价，而真实扣的是前一个：\n'
      + mismatched.map(r => `  ${r.k}: 估算=${r.estimate} 计费=${r.billing}`).join('\n'),
  );
});

test('③ 计费表的「展示价含前置消耗」这个意图必须保留（remove-bg 0.7 / layer-edit 3.2）', () => {
  /* 这两条是**故意**不等于单一 sku 的单价：
     抠图前会先跑一次商品识别（ec_canvas_recognize 0.2），展示价必须含它，
     否则用户看到 0.5、实际被扣 0.7 —— 代码里的原话就是这么写的。 */
  const actions = parseBilling();
  assert.equal(actions['remove-bg'].points, 0.7,
    'remove-bg 展示价必须 = 识别 0.2 + 抠图 0.5，否则用户看到的价低于实际扣的');
  assert.equal(actions['layer-edit'].points, 3.2,
    'layer-edit 展示价必须 = 识别 0.2 + 分层 3.0，同理');
  // 前提：这两条必须真的声明了 skus 数组（证明那个加法是有出处的，不是拍脑袋）
  assert.match(billing, /'remove-bg':[\s\S]*?skus: \['ec_canvas_recognize', 'ec_remove_bg'\]/);
  assert.match(billing, /'layer-edit':[\s\S]*?skus: \['ec_canvas_recognize', 'ec_smart_layer'\]/);
});

test('④ 估算表里不得再有「计费表按 paid 收钱、估算却报 0」的键（那会让整链运行报 0 积分）', () => {
  const estimates = parseEstimates();
  const actions = parseBilling();
  const free = actions['psd-export'];
  const offenders = Object.entries(estimates)
    .filter(([k, v]) => v === 0 && k in actions && actions[k].sku)
    .map(([k]) => k);
  assert.deepEqual(offenders, [],
    '这些键计费表里有 sku（要收钱），估算表却报 0 ⇒ 整链运行会显示"预计 0 积分"：'
      + offenders.join(', '));
  assert.ok(free, 'psd-export 必须是免费档');
  assert.equal(actions['psd-export'].points, 0);
});

test('⑤ 估算表与计费表的**职责分工**必须写在代码里（别让下一个人把两表合并或互换）', () => {
  /* 两表不能合并：计费表带 sku、要跟着服务端 catalog 走；估算表是给界面报"预计"的，
     覆盖的是节点 kind（text/image/output/video…）而不是动作 id。 */
  const estimates = parseEstimates();
  const actions = parseBilling();
  const kindish = ['text', 'image', 'output', 'video', 'audio', 'image-composer', 'text-composer', 'video-composer', 'suite-composer'];
  for (const k of kindish) {
    assert.ok(k in estimates, `估算表应当按节点 kind 覆盖 "${k}"`);
    assert.ok(!(k in actions), `计费表不该按节点 kind 收钱（"${k}"）—— 那是估算表的职责`);
  }
  for (const k of Object.keys(actions)) {
    assert.ok(actions[k].sku || actions[k].points === 0,
      `计费表 "${k}" 应当带 sku（免费档除外）`);
  }
});

test('⑥ 「估算」这两个字必须出现在界面上（把估算报成"消耗"就是看着是 A、跑的是 B）', () => {
  /* 批 CY-⑯ 已经处理过：右面板按 exact 分别写「累计消耗」/「预计消耗」。
     这条防止有人为了"简洁"把它改回统一的「消耗」。 */
  const panel = read('src/pages/EcCanvas/components/EcCanvasRightPanel.jsx');
  assert.match(panel, /预计消耗/, '估算值必须标成「预计消耗」');
  assert.match(panel, /累计消耗/, '真实记账值才配叫「累计消耗」');
  // index.jsx 的 chainCost 必须保留 exact 标记
  assert.match(index, /return \{ value: estimateNodeCost\(node \|\| \{\}\), exact: false \};/,
    'estimateNodeCost 的结果必须标成 exact: false，否则界面会把它当成真实消耗');
  // buildRunPlan 只能用估算（它不产生扣费）
  assert.match(index, /costOf: \(n\) => estimateNodeCost\(n\)/);
});
