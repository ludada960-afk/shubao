// test/paid-chain-idempotency-0917.test.mjs
// 2026-09-17 第六批 · 收费链路真实端到端验收（去桩）钉下的契约。
//
// 背景：画布那批「去掉测试桩、走真实链路」挖出两个线上级 bug，
// 共同点是 —— **测试打桩返回假数据，于是「链路是通的」这个前提从未被真实验证**。
// 本批把同一条经验推广到**所有收费链路**：从本 worktree 起真实服务、
// 真实会话令牌、真实端点，逐条记录 请求 → 响应状态码 → 积分余额变化。
//
// 实测（真实 HTTP、零打桩）暴露的问题与数字：
//
//   链路 A 电商套图方案链 /api/billing/quote → design-directions
//     · publicQuote 只吐 quoteId、不吐 actionId，而 executeOnce 强制要 actionId
//       → 只取 quoteId 的调用方 [400] CANVAS_BILLING_REQUEST_INVALID
//     · 连点 3 次实测：稳定键 1000 units(1×) vs 随机键 3000 units(3×)
//
//   链路 B 视频方案链 video_plan_analysis → /api/video/plans
//     · actionId 用 randomUUID → 服务端去重失效
//     · 连点 3 次实测：稳定键 1000 units(1×) vs 随机键 **4000 units(4×)**
//
//   链路 D 视频直达 /api/video/jobs
//     · Idempotency-Key 用 randomUUID → 服务端 (owner,key) 查重永不命中
//     · 连点 3 次实测：随机键 **2 个真实任务 / 92,000 units**；
//       同键 3 次 = 1 个任务 / replay:true / 额外 0 units
//
//   首页直达（EcMode）
//     · 「下一步」只用异步 state 判重 → 同一 tick 连点全部放行（实测无同步闸门）
//     · 首页设计方案页「重试」裸调 loadDirections，不带计费参数
//       → 实测 [400]「收费动作请求无效」，「重试」**永远不可能成功**
//
// 本测试把这些钉成契约，防止回退。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const api = read('src/services/api.js');
const canvasIndex = read('src/pages/EcCanvas/index.jsx');
const videoStudio = read('src/pages/VideoStudio/index.jsx');
const workbench = read('src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
const ecMode = read('src/pages/Home/EcMode.jsx');
const designDirection = read('src/pages/Home/ec/DesignDirection.jsx');
const billingRoutes = read('server/billing/routes.mjs');
const oneShot = read('server/billing/oneShotBilling.mjs');
const videoGeneration = read('server/videoGeneration.mjs');

/* ── 两头皮对齐：报价单 vs 服务端强制要求 ─────────────────────────── */

test('报价单仍只吐 quoteId（服务端契约）—— 前端**必须**自己生成 actionId', () => {
  const publicQuote = billingRoutes.match(/function publicQuote\(quote\)[\s\S]*?\n\}/)[0];
  assert.match(publicQuote, /quoteId: quote\.quoteId/, 'publicQuote 必须吐 quoteId');
  assert.doesNotMatch(publicQuote, /actionId:/,
    'publicQuote 不返回 actionId —— 这是「两头不对齐」的根因，前端必须自己生成');
});

test('服务端仍然强制要求 actionId（否则 400）', () => {
  assert.match(oneShot, /!owner \|\| !safeActionId \|\| !safeSku/,
    'executeOnce 必须仍然校验 actionId（前端的稳定键才有意义）');
  assert.match(oneShot, /CANVAS_BILLING_REQUEST_INVALID/);
});

test('stableCanvasActionId 必须导出（所有收费链路用它算稳定幂等键）', () => {
  assert.match(api, /export function stableCanvasActionId\(/,
    'stableCanvasActionId 必须 export —— 视频方案链/视频任务/首页重试都要用');
});

/* ── 链路 B：视频方案链的 actionId 必须是稳定键 ───────────────────── */

test('画布视频方案链用稳定 actionId（随机 UUID 会导致 4× 扣费）', () => {
  const start = canvasIndex.indexOf('const handleVideoComposerAnalyze = useCallback');
  assert.ok(start > 0, '必须能找到画布视频方案链');
  const seg = canvasIndex.slice(start, start + 6000);
  assert.match(seg, /stableCanvasActionId\(\[/, '方案分析必须用稳定键');
  assert.match(seg, /billingActionId: analysisActionKey/, '必须把稳定键作为 billingActionId 发出');
  assert.doesNotMatch(seg, /billingActionId: globalThis\.crypto\?\.randomUUID/,
    '不得再用 randomUUID 当 billingActionId（服务端去重会失效）');
});

test('VideoStudio 视频方案链同样用稳定 actionId', () => {
  const start = videoStudio.indexOf('const planQuote = (await quoteBillingAction');
  assert.ok(start > 0);
  const seg = videoStudio.slice(start, start + 1600);
  assert.match(seg, /stableCanvasActionId\(\[/);
  assert.match(seg, /billingActionId: planActionKey/);
  assert.doesNotMatch(seg, /billingActionId: globalThis\.crypto\?\.randomUUID/);
});

/* ── 链路 D：视频任务的 Idempotency-Key 必须是稳定键 ─────────────── */

test('服务端按 (owner_email, idempotency_key) 查重 —— 键必须稳定', () => {
  assert.match(videoGeneration, /WHERE owner_email = \? AND idempotency_key = \?/,
    'createJob 必须按 owner + key 查重');
  assert.match(videoGeneration, /VIDEO_IDEMPOTENCY_REQUIRED/, '缺键必须 400');
});

test('画布视频任务用稳定幂等键（随机键实测 = 2 个任务 / 92,000 积分）', () => {
  const start = canvasIndex.indexOf('const response = await createVideoJob({');
  assert.ok(start > 0);
  const seg = canvasIndex.slice(start, start + 2200);
  assert.match(seg, /stableCanvasActionId\(\[/, '必须用稳定键做 Idempotency-Key');
  assert.doesNotMatch(seg, /globalThis\.crypto\?\.randomUUID\?\.\(\) \|\| `canvas-video-/,
    '不得再用 randomUUID 当幂等键');
});

test('VideoStudio 视频任务用稳定幂等键', () => {
  const start = videoStudio.indexOf('const idempotencyKey =');
  assert.ok(start > 0);
  const seg = videoStudio.slice(start, start + 1200);
  assert.match(seg, /stableCanvasActionId\(\[/);
  assert.doesNotMatch(seg, /globalThis\.crypto\?\.randomUUID\?\.\(\) \|\| `video-/);
});

test('VideoCanvasWorkbench 分镜任务不再用随机 keyFor()', () => {
  assert.doesNotMatch(workbench, /\}, keyFor\('canvas-shot-job'\)\)/,
    '分镜任务不得再用随机 keyFor —— 连点 N 次 = N 个真实任务');
  const start = workbench.indexOf("'video-shot-job'");
  assert.ok(start > 0, '必须能找到分镜任务的稳定键');
});

/* ── 同步闸门：state 异步挡不住同 tick 连点 ───────────────────────── */

test('首页 EcMode「下一步」有**同步** ref 闸门', () => {
  assert.match(ecMode, /const nextClickInFlightRef = useRef\(false\)/,
    '必须有同步 ref 闸门（uploadingAssets 是异步 state，挡不住连点）');
  const start = ecMode.indexOf('const handleNext = async () => {');
  const seg = ecMode.slice(start, start + 2600);
  assert.match(seg, /if \(nextClickInFlightRef\.current\) return;/, '必须做同步判重');
  assert.match(seg, /nextClickInFlightRef\.current = true;/, '必须同步置位');
});

test('首页 EcMode 闸门在所有出口释放（含失败），否则按钮永久卡死', () => {
  const start = ecMode.indexOf('const handleNext = async () => {');
  const seg = ecMode.slice(start, start + 7000);
  const releases = seg.match(/nextClickInFlightRef\.current = false;/g) || [];
  assert.ok(releases.length >= 3,
    '闸门必须在 finally + 两个早退分支都释放（实测到 ' + releases.length + ' 处）');
});

test('首页设计方案页有同步闸门 + 自报价（「重试」原来实测 400 永远失败）', () => {
  assert.match(designDirection, /const analysisBusyRef = useRef\(false\)/);
  const start = designDirection.indexOf('const loadDirections = async ({');
  /* 函数体很长（>6KB），取到下一个顶层 const 为止，别用固定窗口截断。 */
  const end = designDirection.indexOf('const handleRefreshDirections = async () =>', start);
  const seg = designDirection.slice(start, end > start ? end : start + 9000);
  assert.match(seg, /if \(analysisBusyRef\.current\) return;/, '必须同步判重');
  assert.match(seg, /analysisBusyRef\.current = false;/, '必须在 finally 释放');
  /* 「重试」裸调 loadDirections 时没有计费参数 → 必须自报价，否则服务端 400 */
  assert.match(seg, /if \(!refreshBilling && !analysisBilling\)/, '无计费参数时必须自报价');
  assert.match(seg, /effectiveAnalysisBilling = \{ quoteId: quote\.quoteId, actionId \}/,
    '自报价必须同时产出 quoteId 与 actionId');
});

test('设计方案页发出的 billing 参数用 effective 值（两头皮对齐）', () => {
  const start = designDirection.indexOf('const loadDirections = async ({');
  const end2 = designDirection.indexOf('const handleRefreshDirections = async () =>', start);
  const seg = designDirection.slice(start, end2 > start ? end2 : start + 9000);
  assert.match(seg, /billingQuoteId: refreshBilling\?\.quoteId \?\? effectiveAnalysisBilling\?\.quoteId/);
  assert.match(seg, /billingActionId: refreshBilling\?\.actionId \?\? effectiveAnalysisBilling\?\.actionId/);
});

/* ── 用户可见文案不得泄漏内部信息（硬性不变式） ──────────────────── */

test('收费链路错误文案不含「上游/供应商/备用/任务号」等内部信息', () => {
  const sources = {
    'server/billing/oneShotBilling.mjs': oneShot,
    'server/billing/routes.mjs': billingRoutes,
    'src/pages/Home/EcMode.jsx': ecMode,
    'src/pages/Home/ec/DesignDirection.jsx': designDirection,
  };
  const forbidden = /上游|供应商|备用|任务号/;
  for (const [file, src] of Object.entries(sources)) {
    /* 只检查**用户可见字符串**（引号/模板里的中文文案），跳过注释。 */
    const withoutComments = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const stringLiterals = withoutComments.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) || [];
    for (const literal of stringLiterals) {
      assert.doesNotMatch(literal, forbidden,
        file + ' 的用户可见文案泄漏了内部信息: ' + literal.slice(0, 80));
    }
  }
});
