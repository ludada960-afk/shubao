// test/canvas-direction-billing-chain-0917.test.mjs
// 2026-09-17 修「方案链」两个真实缺陷 —— 都是**不打桩实跑**才暴露出来的：
//
// 【缺陷①·方案链 100% 失败】报价拿不到 actionId → 服务端判「收费动作请求无效」
//   实测（真实接口，未打桩）：点「生成方案」→
//     200 /api/billing/quote
//     400 /api/ecommerce/design-directions  {"error":"收费动作请求无效","code":"CANVAS_BILLING_REQUEST_INVALID"}
//   根因：EcCanvas/index.jsx 直接调 services/billing.js 的 quoteBillingAction，
//         该函数只返回 { quote }（服务端 publicQuote 只吐 quoteId，无 actionId），
//         于是 quote.actionId === undefined → 服务端 oneShotBilling.executeOnce 的
//         「!owner || !actionId || !sku」分支命中，400。
//   修法：改走 quoteCanvasAction（= 报价 + 生成 actionId），与其余 17 处收费动作同口径。
//
// 【缺陷②·连点 N 次扣 N 次费】幂等键每次都变 + state 判重挡不住同步连点
//   实测：连点 3 次「生成方案」→ 3 次报价 + 3 次 design-directions（3 倍扣费暴露）。
//   两个原因叠加：
//     a) canvasBillingActionId() 每次返回新的 randomUUID → 服务端按 actionId 去重失效；
//     b) 原判重只看 node.status（React state 异步），3 个 handler 都在 status
//        变成 processing 之前跑进来，判重形同虚设。
//   修法：a) 方案链用**稳定键** `direction-analysis:${node.id}`（服务端命中已完成记录即 replay）；
//         b) 加**同步** directionBusyRef 闸门（同一 tick 内即写入）。
//   「换一套」是用户有意重复动作 → 仍用带时间戳的新 actionId。
//
// 本测试把两条钉成契约，防止回退。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasIndex = read('src/pages/EcCanvas/index.jsx');
const api = read('src/services/api.js');
const serverIndex = read('server/index.mjs');
const routes = read('server/billing/routes.mjs');

/* ── 缺陷①：方案链必须带 actionId ─────────────────────────────────── */

test('quoteCanvasAction 必须导出（画布收费动作统一入口）', () => {
  assert.match(api, /export async function quoteCanvasAction\(/, 'quoteCanvasAction 必须 export —— 方案链要用它拿 actionId');
});

test('quoteCanvasAction 同时返回 quoteId 与 actionId', () => {
  assert.match(api, /return \{ quoteId: quote\.quoteId, actionId: actionId \|\| canvasBillingActionId\(\) \}/,
    'quoteCanvasAction 必须同时给出 quoteId 与 actionId（缺 actionId 会被服务端判 400）');
});

test('方案链（生成/刷新）不再用只给 quoteId 的 quoteBillingAction', () => {
  const start = canvasIndex.indexOf('const handleDirectionGenerate = useCallback');
  const end = canvasIndex.indexOf('const handleDirectionRefresh = useCallback');
  assert.ok(start > 0 && end > start, '必须能找到方案链两段实现');
  const generate = canvasIndex.slice(start, end);
  const refreshStart = end;
  const refreshEnd = canvasIndex.indexOf('}, [updateComposerNode, handleCanvasActionError]);', refreshStart);
  const refresh = canvasIndex.slice(refreshStart, refreshEnd);

  for (const [name, seg] of [['生成方案', generate], ['换一套', refresh]]) {
    assert.ok(!/quoteBillingAction\(/.test(seg), name + ' 不得再用 quoteBillingAction（它不返回 actionId）');
    assert.match(seg, /quoteCanvasAction\(/, name + ' 必须走 quoteCanvasAction');
    assert.match(seg, /billingActionId: actionId/, name + ' 必须把 actionId 发给服务端');
    assert.match(seg, /billingQuoteId: quoteId/, name + ' 必须把 quoteId 发给服务端');
  }
});

test('服务端确实要求 actionId（契约两头对齐，防止前端单方面改）', () => {
  /* 服务端：!owner || !safeActionId || !safeSku → 400 CANVAS_BILLING_REQUEST_INVALID */
  const read2 = readFileSync(new URL('../server/billing/oneShotBilling.mjs', import.meta.url), 'utf8');
  assert.match(read2, /!owner \|\| !safeActionId \|\| !safeSku/, '服务端必须仍然校验 actionId');
  assert.match(read2, /CANVAS_BILLING_REQUEST_INVALID/);
  /* 报价单接口只吐 quoteId（没有 actionId）—— 所以前端必须自己生成 */
  assert.match(routes, /quoteId: quote\.quoteId/);
  assert.doesNotMatch(routes.match(/function publicQuote[\s\S]*?\n\}/)[0], /actionId:/,
    'publicQuote 不返回 actionId → 前端必须自己生成（本bug 的根因）');
});

test('design-directions 路由消费 billing_quote_id + billing_action_id', () => {
  const start = serverIndex.indexOf("app.post('/api/ecommerce/design-directions'");
  const seg = serverIndex.slice(start, start + 4200);
  assert.match(seg, /billing_quote_id: quoteId, billing_action_id: actionId/);
  assert.match(seg, /quoteId,/, '必须把 quoteId 传给计费服务');
  assert.match(seg, /actionId,/, '必须把 actionId 传给计费服务');
  assert.match(seg, /sku: 'ec_direction_analysis'/, '首次分析用 ec_direction_analysis');
  assert.match(seg, /sku: 'ec_direction_refresh'/, '刷新用 ec_direction_refresh');
});

/* ── 缺陷②：幂等（连点只扣一次） ───────────────────────────────────── */

test('方案链有**同步** in-flight 闸门（ref，不是 state）', () => {
  assert.match(canvasIndex, /const directionBusyRef = useRef\(\{\}\)/,
    '必须有同步 ref 闸门 —— state 异步，挡不住同一 tick 的连点');
  const start = canvasIndex.indexOf('const handleDirectionGenerate = useCallback');
  const seg = canvasIndex.slice(start, start + 4200);
  assert.match(seg, /if \(directionBusyRef\.current\[node\.id\]\) return;/, '生成方案必须做同步判重');
  assert.match(seg, /directionBusyRef\.current\[node\.id\] = true;/, '必须同步置位');
  assert.match(seg, /finally \{[\s\S]*?delete directionBusyRef\.current\[node\.id\];/, '必须在 finally 释放（失败也要放）');
});

test('「换一套」同样有同步闸门', () => {
  const start = canvasIndex.indexOf('const handleDirectionRefresh = useCallback');
  const seg = canvasIndex.slice(start, start + 3200);
  assert.match(seg, /if \(directionBusyRef\.current\[node\.id\]\) return;/);
  assert.match(seg, /finally \{[\s\S]*?delete directionBusyRef\.current\[node\.id\];/);
});

test('生成方案的 actionId 是**稳定键**（同节点同轮 = 同一个 key，服务端可 replay）', () => {
  const start = canvasIndex.indexOf('const handleDirectionGenerate = useCallback');
  const seg = canvasIndex.slice(start, start + 4200);
  assert.match(seg, /quoteCanvasAction\('ec_direction_analysis', \`direction-analysis:\$\{node\.id\}\`\)/,
    '生成方案必须用稳定 actionId；用随机 UUID 会让服务端无法按 actionId 去重 → 连点 N 次扣 N 次');
  assert.doesNotMatch(seg, /quoteCanvasAction\('ec_direction_analysis'\)/,
    '生成方案不得用默认（每次新 UUID）的 actionId');
});

test('「换一套」是有意重复动作 → 每次新的 actionId（否则被 replay 拿回旧方案）', () => {
  const start = canvasIndex.indexOf('const handleDirectionRefresh = useCallback');
  const seg = canvasIndex.slice(start, start + 3200);
  assert.match(seg, /direction-refresh:\$\{node\.id\}:\$\{Date\.now\(\)\}/,
    '刷新必须带时间戳，保证是新的 actionId');
});

/* ── 离线单测里的打桩必须标注用途（真实链路验收不得打桩） ────────── */

test('验收脚本不得对 design-directions 打桩（打桩过的验收不算验收）', () => {
  /* page.route 只允许出现在 test/ 的离线单测里；验收脚本（.playwright-shots 旁的一次性脚本）
     不在仓库内，这里守住仓库内不出现"对 design-directions 打桩"的验收。 */
  const files = ['test/canvas-studio-contract.test.mjs', 'test/canvas-suite-plan-gate-0917.test.mjs'];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /page\.route\('\*\*\/api\/ecommerce\/design-directions/,
      f + ' 不得对 design-directions 打桩 —— 方案链验收必须在真实接口上跑');
  }
});


