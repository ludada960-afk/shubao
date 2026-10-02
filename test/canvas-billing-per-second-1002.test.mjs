// test/canvas-billing-per-second-1002.test.mjs
// 2026-10-02：画布计价表第一次出现「按秒」的动作（视频去字幕）。
// ─────────────────────────────────────────────────────────────────────────────
// 这条门禁存在的理由是一个**真的会扣错钱**的形状：
//   画布计价表里所有动作的 `units` 都是**固定总价**，`formatCanvasActionPrice`
//   直接渲染 `${units} 积分`；而去字幕在服务端是 `{ units: 40, perSecond: true }`
//   （0.04 积分/秒，数量 = 秒数）。
//   ⇒ 一旦照别的动作那样填 `units: 40`，按钮上就会写「**40 积分**」，
//     而 10 秒的片子真实只扣 0.4 积分 —— **差 100 倍**。
//   `canvas-billing` 那条门禁的注释原话就是这个事故：
//     「注册表写 'layers'，而计价表里叫 'layer-edit' → 查表落空回落 FREE，
//       UI 显示"免费"但后端实收 3 积分」。
//
// ⇒ 本文件钉三件事：① 单价必须与服务端 catalog 逐值一致（不能前端另写一个数）；
//                   ② 按秒的档不许被渲染成总价；
//                   ③ 总价必须来自 videoStudioModel.localQuoteFor，不许前端自己算。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { formatCanvasActionPrice, isPerSecondAction, getCanvasActionBilling, CANVAS_BILLING_KEYS } from '../src/pages/EcCanvas/canvasBillingModel.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const catalog = read('server/billing/catalog.mjs');

/** 从服务端 catalog 里读某个 SKU 的真实字段（前端不许另写一个数）。 */
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
    priceFen: num('priceFen'),
    perSecond: /perSecond:\s*true/.test(body),
    publicOk: /public:\s*true/.test(body),
  };
}

test('① 前端单价必须与服务端 catalog 逐值一致（差一位就是扣错钱）', () => {
  const billing = getCanvasActionBilling('video-desubtitle');
  assert.equal(billing.paid, true, '必须是付费动作');
  assert.equal(billing.perSecond, true, '必须声明按秒 —— 否则会被当成固定总价');
  for (const sku of billing.skus) {
    const server = catalogEntry(sku);
    assert.ok(server, `服务端 catalog 里没有 SKU：${sku}`);
    assert.equal(server.perSecond, true, `${sku} 在服务端是按秒档`);
    assert.equal(server.publicOk, true, `${sku} 还没 public（点了必失败的东西不许变成选项）`);
    assert.equal(server.units, billing.unitsPerSecond * 1000,
      `${sku} 的 units(${server.units}) 必须等于前端单价(${billing.unitsPerSecond}) × 1000 —— ` +
      `单位是 1/1000 积分，两边必须同源`);
  }
});

test('② 按秒的档不许被渲染成总价', () => {
  assert.equal(isPerSecondAction('video-desubtitle'), true);
  const label = formatCanvasActionPrice('video-desubtitle');
  assert.match(label, /^[\d.]+ 积分\/秒$/, `按秒的档必须报单价，实际「${label}」`);
  assert.doesNotMatch(label, /^40 积分$/,
    '这就是那个差 1000 倍的形状：40 units/秒被当成 40 积分总价显示');
  /* 按条的档仍是总价，行为一字未变 */
  assert.equal(formatCanvasActionPrice('layer-edit'), '3.2 积分');
  assert.equal(formatCanvasActionPrice('psd-export'), '免费');
});

test('③ 总价必须来自 localQuoteFor，前端不许自己再算一遍', () => {
  /* 前端计价表里只准出现"单价"，不准出现按秒总价 ——
     挑 short/long 两档 + ×秒数 那件事在 videoStudioModel 里（服务端 capabilities 驱动）。 */
  const model = strip(read('src/pages/EcCanvas/canvasBillingModel.js'));
  assert.doesNotMatch(model, /totalUnits/,
    '总价（totalUnits）不许在画布计价表里算 —— 那是 localQuoteFor 的活，两处各算一次就是扣费漂移');
  const billing = getCanvasActionBilling('video-desubtitle');
  assert.equal(billing.units, undefined,
    '按秒的档不许有 units 字段（那个字段的语义是"固定总价"，一填就会被 formatCanvasActionPrice 当总价显示）');
  /* localQuoteFor 必须真的存在且按秒取数量 */
  const studio = read('src/pages/VideoStudio/videoStudioModel.js');
  assert.match(studio, /export function localQuoteFor\(product, seconds\)/, '按秒报价的唯一真源必须是 localQuoteFor');
  assert.match(studio, /quantity,\s*totalUnits: quote\.units \* quantity/, 'localQuoteFor 必须返回数量与总价');
});

test('④ 新键必须落在 CANVAS_BILLING_KEYS 里（否则注册表查表落空→显示免费）', () => {
  assert.ok(CANVAS_BILLING_KEYS.includes('video-desubtitle'),
    '注册表的 priceFeature 必须能在计价表里查到，查不到就静默变"免费"');
  const registry = strip(read('src/pages/EcCanvas/canvasActionRegistry.js'));
  assert.doesNotMatch(registry, /video-subtitle/,
    '不存在的 priceFeature（video-subtitle）不许再出现 —— 那正是上一版被我写错、靠门禁抓住的');
});