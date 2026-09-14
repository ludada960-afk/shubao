# 第六批 · 收费链路真实端到端验收（去桩）

工作目录：`F:\da\shubao\.worktrees\codex-ecommerce-stability`
验收方式：**真实 HTTP，零打桩** —— 从本 worktree 源码起独立服务（PORT=3101 + 独立 SQLite），
用真实 HMAC 会话令牌调用真实端点，逐条记录请求 → 响应状态码 → 积分余额变化。

服务：`PORT=3101 SHUBAO_DB_PATH=.tmp-billing-e2e/e2e.sqlite node server/index.mjs`（本 worktree 源码）

## 实测环境
- 账号：e2ebilling@example.com（member / active / 4 项 feature 全开）
- 起始余额：500,000 ec_points
- 每次改动前后均读 `GET /api/billing/balance` 取 `balances.ec_points.availableUnits` 差值

---

## 链路 A · 电商套图方案链（/api/billing/quote → design-directions → 确认 → 生成）

### a) 报价单能不能满足后续调用？—— **不能，实测复现**
两条头**不对齐**：
- 服务端 `publicQuote()`（server/billing/routes.mjs:91-101）**只吐** 7 个字段：
  `sku, quantity, units, totalUnits, currency, quoteId, expiresAt` —— **没有 actionId**
- 服务端 `executeOnce`（server/billing/oneShotBilling.mjs:80-82）**强制要求** actionId，
  否则 400。

实测轨迹：
```
[200] POST /api/billing/quote            → quote keys: sku,quantity,units,totalUnits,currency,quoteId,expiresAt
[400] POST /api/ecommerce/design-directions  code=CANVAS_BILLING_REQUEST_INVALID  err=收费动作请求无效
```
→ 用只拿 quoteId 的调用方式，方案链 **100% 失败**（400）。
→ 用 `quoteCanvasAction`（自带 actionId）后：
```
[200] POST /api/ecommerce/design-directions
     billing: {"currency":"ec_points","status":"settled","balance":499000}
     余额差 = 1000 units
```

### b) 连点 N 次会不会重复扣费？—— **会，实测 3 倍**
真实并发 3 连点（Promise.all 同时发 3 个请求），同一节点：

| actionId 策略 | 3 次响应 | 计费状态 | 实测扣费 |
|---|---|---|---|
| **稳定键** `direction-analysis:e2e-node-triple` | 200,200,200 | settled×3（服务端 replay） | **1000 units（1×）** |
| **随机 UUID**（修复前行为） | 200,200,200 | settled×3 | **3000 units（3×）** |

→ 去重键稳定性 = 唯一决定因素。闸门必须**同步**（React state 异步挡不住同 tick 连点）。

### c) 失败时的行为
- 缺 actionId → **400** + `收费动作请求无效`（用户可见文案，无内部信息）
- 额度不足 → 402 `AI 积分不足，请购买套餐后继续`
- 报价过期 → 409 `费用确认已过期，请重新获取费用后再生成`（`reQuoteRequired:true`）
- 「钱扣了但没出东西」：executeOnce 在 work() 抛错且未交付时走 `releaseItem` 释放 hold → **实测未发生扣款**
  （B1 场景：502 VIDEO_PLAN_INVALID_RESPONSE，实测 charged=0，hold 已释放）

### d) 用户可见文案
上述所有错误文案均为纯用户语言，**未出现** 上游/供应商/备用/任务号。

---

## 链路 B · 视频方案链（video_plan_analysis → 确认 → /api/video/... 生成）

### a) 两头皮对齐
- quote `video_plan_analysis` → 200，keys 同上（**无 actionId**）
- `/api/video/plans` 消费 `billingActionId`（server/index.mjs:4752）
- **但前端传的是每次新随机 UUID**：
  - `src/pages/EcCanvas/index.jsx:4254` → `billingActionId: globalThis.crypto?.randomUUID?.() || ...`
  - `src/pages/VideoStudio/index.jsx:668` → 同样 randomUUID
- 两处都用 `quoteBillingAction`（只拿 quoteId），actionId 是自己现编的随机值

实测：
```
B1 无 billingActionId            → [502] VIDEO_PLAN_INVALID_RESPONSE  charged=0
B2 稳定 actionId × 3 并发        → [200,200,200]                     charged=1000  (1×)
B3 随机 actionId × 3 并发        → [200,200,200]                     charged=4000  (4×!)
```
→ 随机键下 3 连点实测 **4000 units**（含服务端重试/并发叠加），稳定键 **1000 units**。

### b) 结论：与链路 A 同源缺陷 —— 随机 actionId = 去重失效

### c) 失败行为
- 缺 actionId：**不会 400**（服务端 video/plans 不强制），但会变成「每次都真实扣费」
  —— 这比链路 A 更危险：**A 是失败，B 是静默多扣**
- 素材无效 → 400 `视频方案包含无效或无权访问的分析素材`
- 本地兜底方案（degraded）**不扣费**：`{plan, billing:{charged:false, reason:'DEGRADED_LOCAL_PLAN'}}`

### d) 用户可见文案
`AI 积分不足，请购买套餐后继续` / `视频方案分析失败` —— 无内部信息。

---

## 链路 C · 万物上身 / 先出方案再生成
- 入口：`src/pages/Home/EcMode.jsx`（abilityRecipeId='anything_tryon'）→ 「下一步」即走设计方案 → 进画布
- 复用链路 A 的 `/api/ecommerce/design-directions`，因此**继承链路 A 的全部结论**
- 额外缺陷：见链路 D 的「首页闸门缺失」

---

## 链路 D · 普通出图 / 出视频直达链路（首页 + 画布）

### D-1 画布出视频（/api/video/jobs）
实测（正确 SKU `video_seedance_standard_short`，5s / 720p）：

| Idempotency-Key 策略 | 3 次响应 | 生成任务数 | 实测扣费 |
|---|---|---|---|
| **随机 UUID × 3 并发**（当前代码） | 202,202,429 | **2** | **92,000 units** |
| **同一稳定键 × 3 顺序** | 202,200,200 | **1**（replay=true,true） | **0 units** |

- 429 = `VIDEO_USER_CONCURRENCY_LIMIT`（同账号最多 2 个并发任务）——
  **这个并发上限意外地把损失从 3 倍压到了 2 倍**，但它不是设计上的幂等保护。
- 缺 Idempotency-Key → **400** `VIDEO_IDEMPOTENCY_REQUIRED` `缺少防重复提交标识`（文案合规）
- 稳定键序列连点：第 2、3 次 `status 200 + replay:true`，**不扣费**

### D-2 首页直达（EcMode）—— **闸门完全缺失**
```
EcMode.jsx:1672   disabled={!canGen || uploadingAssets}
EcMode.jsx:537    if (!canGen || uploadingAssets) return;
```
- 没有 `inFlight` ref 闸门；`uploadingAssets` 是 **React state（异步）**，
  同一 tick 内的 3 次点击都会在它变为 true **之前**通过判断。
- 对比：画布方案链在上一批已加 `directionBusyRef`（同步 ref）—— 首页这条**没有**。

### D-3 首页设计方案页（Home/ec/DesignDirection.jsx）
- 分析阶段：用 ref 存 actionId（Line 233-236）——**但成功后置回 null**（Line 241），
  重挂载即产生新 UUID → 重复扣费窗口仍在
- 生成按钮：`disabled={generating}`（Line 1011）—— 同为异步 state

### D-4 画布出图 / 文案（quoteCanvasAction 入口）
- 17 处收费动作走 `quoteCanvasAction`：默认 `canvasBillingActionId()` = **每次新随机 UUID**
- 仅在调用方显式传稳定键时幂等（如 `recognizeCanvasText`、`autoRecognizeEcommerce`）
- `regenerateCanvasImage` 用 `stableRequestKey`（Line 1784）→ 已对齐

---

## 真 bug 清单（按金额风险排序）

| # | 链路 | 根因 | 实测损失 |
|---|---|---|---|
| 1 | 视频方案链（画布+VideoStudio） | actionId 用 randomUUID，服务端去重失效 | 3 连点 = **4× 扣费（4000 units）** |
| 2 | 画布出视频 | Idempotency-Key 用 randomUUID / keyFor() | 3 连点 = **2 个任务 / 92,000 units** |
| 3 | 首页 EcMode 直达 | 无同步闸门，仅靠异步 state | 同 tick 连点全部放行 |
| 4 | 首页 DesignDirection 分析 | ref 成功后置 null，重挂载换新键 | 重复分析可重复扣费 |
| 5 | 报价单契约 | publicQuote 不吐 actionId，两头皮不对齐 | 任何只取 quoteId 的新调用方 100% 400 |
---

# 修复后 · 真实链路复测（同一环境、同一账号、同一端点，零打桩）

```
════════ FINAL VERIFICATION (real HTTP, no stubs) ════════

── 链路 A · 电商套图方案链 ──
  quote        → 200
  directions   → 200 billing=settled
  扣费          → 1000 units (首次)
  同键重放      → 200 扣费 0 units (应为 0)          ← 幂等生效

── 链路 B · 视频方案链 ──
  3 连点(稳定键) → 200,200,200 扣费 1000 units       ← 修前 4000 units（4×）

── 链路 D · 视频直达 /api/video/jobs ──
  3 连点(稳定键) → 202,200,200
  生成任务数    → 1 (应为 1)                          ← 修前 2 个
  replay        → false,true,true
  扣费          → 46000 units (1× 正常单次价)

── 硬性不变式 · 用户可见文案 ──
  恢复态 409 文案 → "这次处理的结果还在确认中，为避免重复扣费，请稍后查看结果"
  含内部词?      → NO ✅                              ← 修前含「上游」
```

# 修前 / 修后对照表

| 链路 | 场景 | 修前实测 | 修后实测 | 结论 |
|---|---|---|---|---|
| A 方案链 | 缺 actionId | **400** CANVAS_BILLING_REQUEST_INVALID | 由 quoteCanvasAction 保证带 actionId | 方案链可用 |
| A 方案链 | 3 连点随机键 | 3000 units (3×) | — | 稳定键修复 |
| A 方案链 | 3 连点稳定键 | 1000 units (1×) | 1000 / 重放 0 | 幂等成立 |
| B 视频方案 | 3 连点随机键 | **4000 units (4×)** | — | 已改稳定键 |
| B 视频方案 | 3 连点稳定键 | 1000 units | 1000 units (1×) | 幂等成立 |
| D 视频直达 | 3 连点随机键 | **2 个任务 / 92,000 units** | — | 已改稳定键 |
| D 视频直达 | 3 连点稳定键 | 1 个任务 / 0 额外 | 1 个任务 / replay×2 | 幂等成立 |
| 首页重试 | 裸调 loadDirections | **400 永远失败** | 自报价 + effective billing | 重试可用 |
| 文案不变式 | 恢复态 409 | 含「上游」 | 纯用户语言 | 不变式恢复 |

# 去桩清单

本批验收**全部走真实接口**，未使用任何 `page.route` 打桩：

| 动作 | 做法 |
|---|---|
| 起服务 | 从**本 worktree 源码**起独立实例：`PORT=3101 SHUBAO_DB_PATH=<独立 sqlite> node server/index.mjs` |
| 会话 | 用服务端**同一 HMAC 密钥**签真实会话令牌（`server/.auth-session-secret`），非 mock |
| 账号 | 真实落库 `account_access` + 4 项 feature + 真实 `walletService.grant` 50 万积分 |
| 计费验证 | 每次调用前后读 `GET /api/billing/balance` 取 `availableUnits` **真实差值**（不猜、不读日志） |
| 断言依据 | 以**服务端真实状态码 + billing.status + 余额差**为准，不以「前端有没有弹 toast」为准 |

仓库内 `page.route` 现状：仅剩 15 处，**全部在资产库选择器测试**里
（`asset-library-picker-v2-0913`、`asset-type-badge-upload-0915`），
且都不是收费链路（`/api/project-assets`、`usage`、`assets/*/delete`）—— 与钱无关，保留。

# 新增契约测试

`test/paid-chain-idempotency-0917.test.mjs`（14 条，全部通过）：
- **两头皮对齐**：publicQuote 不吐 actionId ↔ executeOnce 强制要 actionId；
  DesignDirection 必须用 `effectiveAnalysisBilling`
- **连点幂等**：画布视频方案链 / VideoStudio 方案链 / 画布视频任务 /
  VideoStudio 视频任务 / Workbench 分镜任务 —— 全部不得再用随机 UUID 当幂等键
- **同步闸门**：EcMode「下一步」ref 闸门 + 所有出口释放；DesignDirection `analysisBusyRef`
- **不变式**：收费链路用户可见文案不得含 上游/供应商/备用/任务号

修正既有测试：`test/ecommerce-billing-ui.test.mjs` 原来断言的正是**那行 bug 代码**
（`analysisBilling?.actionId`），已改为 effective 口径并写明原因。
