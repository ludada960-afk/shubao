/* ═══ 门禁：方案预览的**模型调用必须在计费幂等判定之内**（2026-09-25 批 BT）══════════════════
   用户口径（逐字）：「那用户关掉的话会怎么样，**再点一次会一直薅我们的 API 额度吗**」→ 会。
   改前顺序：`compose(payload)`（调模型，我们花钱）**先**跑，再走 `canvasOneShotBilling.execute()`；
   而计费的幂等重放在**第一行就返回**了（`actionStore.claim` → settled ⇒ 直接 return、不跑 work）。
   两条叠起来 = **扣费只收一次（幂等键相同），模型却每点一次都被调一次** —— 我们白掏上游成本。
   改法：把 compose 放进 `work` 回调 ⇒ 重放路径上模型一次都不会被调；扣费语义不变。

   这一组断言守两件事（都是"会静默坏掉"的点）：
     ① `compose` 必须出现在 `work:` **之后**（即包在 work 里）—— 挪回去就等于把成本漏点又打开；
     ② 降级仍必须**不扣费**：work 内抛带 code 的错 + 外层 catch 翻回 `charged: false`。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');

/* 只取 /api/plan-preview 这一段（到下一个 app.post 为止），避免误伤别处的 compose */
const start = src.indexOf("app.post('/api/plan-preview'");
assert.ok(start > 0, '找不到 /api/plan-preview 路由');
const rest = src.slice(start);
const end = rest.indexOf('\napp.post(', 10);
const block = end > 0 ? rest.slice(0, end) : rest;

test('① 模型调用（compose）必须在 work 回调之内 —— 否则重放时模型会被重复调用', () => {
  const workAt = block.indexOf('work: async () =>');
  const composeAt = block.indexOf('planPreviewService.compose(');
  assert.ok(workAt > 0, '这一段的 work 回调不见了 —— 结构变了，这条断言要重新对一遍');
  assert.ok(composeAt > 0, '找不到 compose 调用');
  assert.ok(composeAt > workAt,
    'compose 又跑回 work **外面**了 —— 幂等重放（同一 actionId 已结算）时不会跑 work，'
    + '模型却已经在外面被调过一次 ⇒ 用户反复点「生成预览」会一直消耗我们的上游成本');
  /* 顺带守住"execute 之前不许再有 compose"：execut 的位置要在 compose 之前 */
  const executeAt = block.indexOf('canvasOneShotBilling.execute(');
  assert.ok(executeAt > 0 && executeAt < composeAt, 'execute 与 compose 的先后关系变了，请重新核对这条判据');
});

test('② 降级仍必须不扣费（抛错 → 计费释放 hold → 翻回原响应形状）', () => {
  assert.match(block, /if \(composed\?\.degraded\) throw planPreviewDegraded\(composed\)/,
    '降级不再抛错 ⇒ 会走成"结算"而扣费（铁律：为无效/降级结果扣费是禁止的）');
  assert.match(block, /code === PLAN_PREVIEW_DEGRADED[\s\S]{0,200}charged: false/,
    '降级没有翻回 charged:false 的响应形状 —— 接口契约变了');
  assert.match(src, /walletService\.releaseItem/, '（依赖自查）计费模块应当仍有释放 hold 的路径');
});
