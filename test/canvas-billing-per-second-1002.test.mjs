// test/canvas-billing-per-second-1002.test.mjs
// 画布计价表与**服务端目录**必须逐值同源（2026-10-02 立；2026-10-04 改了口径）。
// ─────────────────────────────────────────────────────────────────────────────
// 这条门禁存在的理由是一个**真的会扣错钱**的形状：
//   画布计价表里所有动作的 `units` 都是**这一次调用要付的总数**，
//   `formatCanvasActionPrice` 直接渲染 `${units} 积分`。
//   而服务端的去字幕当时是 `{ units: 40, perSecond: true }`（0.04 积分/秒，数量 = 秒数）。
//   ⇒ 一旦照别的动作那样填 `units: 40`，按钮上就会写「**40 积分**」，
//     而 10 秒的片子真实只扣 0.4 积分 —— **差 100 倍**。
//
// ⚠️ 2026-10-04 口径变了：两个擦除档都改成**按次固定价**
//   （用户原话「这里应该固定一个费用呀…不管他框选哪里…都应该是一个固定的费用才对吧」）。
//   ⇒ 这条门禁守的东西**没变**，只是换了个形状：
//     界面上那个数，仍然必须与服务端 catalog 里那条 SKU 逐值相同。
//     框选档比 `units`；智能档比 `flatUnits`（≤ 封顶时的那一次调用价）。
//
// ⚠️ 同时删掉了画布计价表里 `perSecond` / `unitsPerSecond` / `isPerSecondAction`
//   那条分支：画布上已经没有按秒的动作了，它永远走不到。
//   按秒的真身在服务端（billableQuantity + localQuoteFor + flatMaxSeconds），
//   这里再留一条就是**第二份真相**。本文件断言它**不在**了。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { formatCanvasActionPrice, getCanvasActionBilling, CANVAS_BILLING_KEYS } from '../src/pages/EcCanvas/canvasBillingModel.js';
import { FEATURE_SKUS } from '../server/billing/catalog.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const catalog = read('server/billing/catalog.mjs');

/** 从服务端 catalog 源码里读某个 SKU 的真实字段（前端不许另写一个数）。 */
function catalogEntry(sku) {
  const m = new RegExp(`\\b${sku}:\\s*\\{([^}]*)\\}`, 'm').exec(catalog);
  if (!m) return null;
  const body = m[1];
  const num = key => {
    const v = new RegExp(`${key}:\\s*([0-9.]+)`).exec(body);
    return v ? Number(v[1]) : null;
  };
  return {
    units: num('units'),
    flatUnits: num('flatUnits'),
    flatMaxSeconds: num('flatMaxSeconds'),
    perSecond: /perSecond:\s*true/.test(body),
    publicOk: /public:\s*true/.test(body),
  };
}

test('① 前端显示的价必须与服务端 catalog 逐值一致（差一位就是扣错钱）', () => {
  /* 框选档：服务端已摘掉 perSecond ⇒ 纯按条，固定价 = units / 1000 积分 */
  const box = getCanvasActionBilling('video-desubtitle');
  assert.equal(box.paid, true, '必须是付费动作');
  assert.notEqual(box.perSecond, true, '框选档已改按次 —— 界面不该再显示"0.04 积分/秒"');
  for (const sku of box.skus) {
    const server = catalogEntry(sku);
    assert.ok(server, `服务端 catalog 里没有 SKU：${sku}`);
    assert.notEqual(server.perSecond, true, `${sku} 在服务端也必须是按条档`);
    assert.equal(server.publicOk, true, `${sku} 还没 public（点了必失败的东西不许变成选项）`);
    assert.equal(server.units / 1000, box.units,
      `${sku} 的 units(${server.units}) 必须等于前端显示的积分(${box.units}) × 1000 —— 单位是 1/1000 积分，两边必须同源`);
  }
});

test('① 之二 智能档显示的是**平价**那个数（≤ 封顶时的一次调用价），不是每秒单价', () => {
  const auto = getCanvasActionBilling('video-desubtitle-auto');
  assert.notEqual(auto.perSecond, true, '界面上给的是一个固定的数，不是单价/秒');
  for (const sku of auto.skus) {
    const server = catalogEntry(sku);
    assert.ok(server, `服务端 catalog 里没有 SKU：${sku}`);
    assert.equal(server.publicOk, true, `${sku} 还没 public`);
    assert.ok(server.flatMaxSeconds > 0,
      `${sku} 必须声明 flatMaxSeconds —— 成本随秒数涨的档没有封顶就是每卖一单亏一单`);
    assert.equal(server.flatUnits / 1000, auto.units,
      `${sku} 的 flatUnits(${server.flatUnits}) 必须等于前端显示的积分(${auto.units}) × 1000`);
    assert.equal(FEATURE_SKUS[sku].flatUnits, server.flatUnits, '源码读数与导入的目录逐值一致');
  }
});

test('② 画布计价表不再有「按秒」那条分支（按秒的真身在服务端，不许第二份）', () => {
  const model = strip(read('src/pages/EcCanvas/canvasBillingModel.js'));
  assert.doesNotMatch(model, /unitsPerSecond/,
    '画布上没有按秒动作了，unitsPerSecond 永远走不到 —— 留着会让人以为这张表能表达按秒');
  assert.doesNotMatch(model, /export function isPerSecondAction/,
    '同一个理由：那个导出没有任何调用方了');
  /* 真身在服务端，而且那边必须还留着「按秒」这个概念（数字人那一档还在用） */
  assert.equal(FEATURE_SKUS.video_lipsync_volc_short.perSecond, true,
    '服务端的按秒档没被一起删掉（数字人 0.12 积分/秒 还在用）');
});

test('③ 画布计价表不许自己算总价（那是 localQuoteFor 的活）', () => {
  const model = strip(read('src/pages/EcCanvas/canvasBillingModel.js'));
  assert.doesNotMatch(model, /totalUnits/,
    '总价（totalUnits）不许在画布计价表里算 —— 两处各算一次就是扣费漂移');
  /* localQuoteFor 必须真的存在，并且按「平价优先」取面值 */
  const studio = read('src/pages/VideoStudio/videoStudioModel.js');
  assert.match(studio, /export function localQuoteFor\(product, seconds\)/, '报价的唯一真源必须是 localQuoteFor');
  assert.match(studio, /export function localQuoteUnits\(product, seconds\)/,
    '平价档的面值取法必须是一个可单测的纯函数');
});

test('④ 渲染出来的文案：一个动作 = 一个固定的数', () => {
  assert.equal(formatCanvasActionPrice('video-desubtitle'), '1 积分');
  assert.equal(formatCanvasActionPrice('video-desubtitle-auto'), '3 积分');
  assert.doesNotMatch(formatCanvasActionPrice('video-desubtitle'), /积分\/秒/,
    '不许再出现"积分/秒" —— 用户要的是固定的费用');
  /* 按条的其它档位行为一字未变 */
  assert.equal(formatCanvasActionPrice('layer-edit'), '3.2 积分');
  assert.equal(formatCanvasActionPrice('psd-export'), '免费');
});

test('⑤ 新键必须落在 CANVAS_BILLING_KEYS 里（否则注册表查表落空→显示免费）', () => {
  assert.ok(CANVAS_BILLING_KEYS.includes('video-desubtitle'),
    '注册表的 priceFeature 必须能在计价表里查到，查不到就静默变"免费"');
  assert.ok(CANVAS_BILLING_KEYS.includes('video-desubtitle-auto'));
  const registry = strip(read('src/pages/EcCanvas/canvasActionRegistry.js'));
  assert.doesNotMatch(registry, /video-subtitle/,
    '不存在的 priceFeature（video-subtitle）不许再出现 —— 那正是上一版被我写错、靠门禁抓住的');
});