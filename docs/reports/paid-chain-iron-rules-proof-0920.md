# 收费链路两条铁律 · 可执行证明（2026-09-20）

> 铁律 ① **没有用户确认，绝不扣费**
> 铁律 ② **定价只有一个来源 = 后端目录**，前端不得存在第二份参与计算的价目表

起点 HEAD：`c2f0a806`（复核见文末 §0）
验收方式：**真实 HTTP，零打桩** —— 从本 worktree 源码起独立实例（`PORT=3111` + 独立 SQLite），
真实 HMAC 会话令牌、真实落库账号与积分，以**服务端状态码 + 钱包流水 + 余额差值**为唯一依据。

---

## 0. 先复核上一批结论（是否仍然成立）

上一批交付 **`9e189578`**（`git merge-base --is-ancestor 9e189578 HEAD` → **YES**，仍是 HEAD 祖先）。

| 上一批修复 | HEAD 处是否仍生效 | 复核证据 |
|---|---|---|
| `stableCanvasActionId` 导出 | ✅ | `git show HEAD:src/services/api.js` → `export function stableCanvasActionId(value) {` |
| 「上游」文案泄漏修复 | ✅ | `git show HEAD:server/billing/oneShotBilling.mjs` → `这次处理的结果还在确认中，为避免重复扣费，请稍后查看结果` |
| 首页重试自报价 + effective billing | ✅ | `git show HEAD:src/pages/Home/ec/DesignDirection.jsx` → `let effectiveAnalysisBilling = analysisBilling;` / `effectiveAnalysisBilling = { quoteId: quote.quoteId, actionId };` |
| 画布视频方案稳定 actionId | ✅（被他人 commit 卷走） | 承载于 `82fb7410`；`git show HEAD:src/pages/EcCanvas/index.jsx` → `billingActionId: analysisActionKey,` |
| 画布视频任务稳定幂等键 | ✅（同上） | 同文件 → `'video-job',` |
| 契约测试 `test/paid-chain-idempotency-0917.test.mjs` | ✅ | 仍在 HEAD；**重跑 14/14 全绿** |

**结论：上一批结论全部仍然成立，无回退。**

---

## 1. 扣费点清单（点位 × 三问）

### 1.1 服务端唯一的扣费「咽喉」

所有积分变动都必须经过 **`server/billing/walletService.mjs`** 的 6 个事务原语 ——
这是「钱怎么动」的唯一入口，也是审计的落点：

| 原语 | 文件:行 | 作用 |
|---|---|---|
| `grantTx` | walletService.mjs:852 | 发放（购买/管理员赠送） |
| `revokeTx` | walletService.mjs:925 | 回收 |
| `createHoldTx` | walletService.mjs:1000 | **冻结**（可用 → 冻结，尚未真正扣） |
| `settleItemTx` | walletService.mjs:1096 | **结算**（冻结 → 真实扣减） |
| `releaseItemTx` | walletService.mjs:1262 | **退款/释放**（冻结 → 归还可用） |
| `releaseRemainderTx` | walletService.mjs:1364 | 剩余部分释放 |

**幂等的总闸**：`existingMutation()`（walletService.mjs:618）按 `idempotency_key` 查 `wallet_ledger`，
命中即返回既有结果；键相同但**内容指纹不同**时抛 `idempotencyConflict`（:378）。

### 1.2 上层扣费入口（19 处 one-shot + 电商套图 + 视频）

| # | 入口（服务端路由） | SKU | ① 用户确认 | ② 失败回滚 | ③ 幂等 |
|---|---|---|---|---|---|
| 1 | `POST /api/regenerate-image` (:2407) | `ecommerceFeatureForItem` 动态 | 前端按钮 | ✅ `work()` 抛错→release | ✅ actionId |
| 2 | `POST /api/regenerate-text` (:2445) | `ec_ai_assistant` | 前端按钮 | ✅ | ✅ actionId |
| 3 | `POST /api/analyze` (:2758) | `ec_ai_assistant` | 前端按钮 | ✅ | ✅ |
| 4 | `POST /api/extract-product-link` (:3344) | `ec_ai_assistant` | 前端按钮（表单内） | ✅ | ✅ |
| 5 | `POST /api/ecommerce/auto-recognize` (:3775) | `ec_ai_assistant` | 前端「智能识别」按钮 | ✅ | ✅ 稳定键（同 brief+图 = 同键） |
| 6 | `POST /api/ecommerce/design-directions` (:4342) | `ec_direction_analysis` / `ec_direction_refresh` | ⚠️ **见 §3 待裁定** | ✅ | ✅ 稳定键 |
| 7 | `POST /api/polish-ec-text` (:4424) | `ec_ai_assistant` | 前端按钮 | ✅ | ✅ 稳定键 |
| 8 | `POST /api/reverse-prompt` (:4456) | `ec_reverse_prompt` | 前端按钮 | ✅ | ✅ |
| 9 | `POST /api/remove-bg` (:4587) | `ec_remove_bg` | 前端按钮 | ✅ | ✅ |
| 10 | `POST /api/video/plans` (:4749) | `video_plan_analysis` | 前端按钮 | ✅ | ✅ 稳定键（本批已修） |
| 11 | `POST /api/canvas/transform` (:5051) | `ecommerceFeatureForItem` 动态 | 前端按钮 | ✅ `resumableWork` | ✅ |
| 12 | `POST /api/canvas/regenerate-text` (:5199) | `ec_ai_assistant` | 前端按钮 | ✅ | ✅ |
| 13 | `POST /api/canvas/segmentation-plan` (:5259) | `ec_canvas_recognize` | 前端按钮 | ✅ | ✅ |
| 14 | `POST /api/canvas/analyze-layers` (:5309) | `ec_smart_layer` | 前端按钮 | ✅ | ✅ |
| 15 | `POST /api/canvas/ocr` (:5353) | `ec_canvas_ocr` | 前端按钮 | ✅ | ✅ **稳定键**（`ocr\0<url>`） |
| 16 | `POST /api/canvas/pixel-layers` (:5435) | `ec_layer_psd` | 前端按钮 | ✅ | ✅ |
| 17 | `POST /api/canvas/psd-export` (:5472) | `ec_preview_cover` | 前端按钮 | ✅ | ✅ |
| 18 | `POST /api/generate-ecommerce` | 电商套图（多张） | 前端「确认方案」两段闸门 | ✅ hold/release 配对 | ✅ `Idempotency-Key` |
| 19 | `POST /api/video/jobs` (:4844) | `video_*` | 前端按钮 | ✅ `releaseHeldJob` | ✅ `Idempotency-Key`（本批已修） |
| 20 | `POST /xhs/preview-cover`、`runXhsPreview` (:2545) | `ec_preview_cover` | 前端按钮 | ✅ `resumableWork` | ✅ 稳定键（`sha256(owner|xhs|text)`） |

**三问的证据行（共性，全部 20 处一致）**：

- **① 用户确认**：服务端**强制要求 `billing_quote_id` + `billing_action_id`**——
  `server/billing/oneShotBilling.mjs:80```js
  if (!owner || !safeActionId || !safeSku || typeof work !== 'function') {
    throw billingError('收费动作请求无效', { status: 400, code: 'CANVAS_BILLING_REQUEST_INVALID' });
  }
  ```
  前端必须**先** `POST /api/billing/quote` 拿到签名令牌，而这个令牌只在用户点按钮后才申请。
- **② 失败回滚**：`oneShotBilling.mjs:184-193` —— 只要 `hold` 已建且**未交付**，异常路径一律 `releaseItem`：
  ```js
  if (hold && !delivered && current?.status !== 'settled' && !leaseLost) {
    walletService.releaseItem(hold.id, 'canvas_action', {
      reason: `canvas_action_failed:${...}`,
      idempotencyKey: `canvas-release:${safeActionId}`,
  ```
- **③ 幂等**：`actionStore.claim()`（`canvasBilledActionStore.mjs:103`，`db.transaction(...).immediate()`）
  + 钱包层 `existingMutation()`（`walletService.mjs:618`）双重去重；
  同 `actionId` 二次执行命中 `status='settled'` 直接 **replay**（`oneShotBilling.mjs:84-86`）。

---

## 2. 定价单一来源审计

### 2.1 唯一权威（后端目录）

| 项目 | 位置 |
|---|---|
| **功能单价表** | `server/billing/catalog.mjs:52` → `export const FEATURE_SKUS = freezeCatalog({...})` |
| **唯一算价函数** | `server/billing/catalog.mjs:225` → `export function quoteFeature(sku, quantity)` |
| 套餐/商品表 | `server/billing/catalog.mjs:24` → `export const PRODUCTS` |
| 视频按量档位 | `server/billing/videoMeter.mjs` + `server/videoCatalog.mjs` |
| 对外目录接口 | `GET /api/billing/catalog`（`server/billing/routes.mjs:49 publicCatalog`） |
| 报价令牌 | `server/billing/quoteService.mjs`（HMAC-SHA256 签名 + `timingSafeEqual`） |

**计费路径全部从目录取价**（已断言）：`oneShotBilling.mjs` → `quoteFeature(safeSku, 1)`；
`routes.mjs` → `quoteFeature(sku, quantity)`；`ecommerceEngine/ecommerceBilling.mjs` → `quoteFeature(...)`。

### 2.2 前端 `src/**` 的硬编码价目 —— 逐条判定

扫描口径：全部含「积分/¥/units/credits/cost」字面量的位置，共 **68 处匹配**。
但**按用户提醒（原则 §12）：「扫出 N 个含积分的字符串」不是缺陷** ——
判据是**它是否参与扣费计算**。逐条判定如下：

| 位置 | 形态 | 判定 | 理由 |
|---|---|---|---|
| `src/pages/EcCanvas/canvasBillingModel.js` | `units: 0.2 / 1 / 3.2` 表 | **展示兜底**（白名单） | 只喂 `canvasActionRegistry.priceLabel` 渲菜单标签；真实扣费走 `quoteCanvasAction(sku)` |
| `src/services/imageModelCatalog.js` `generationUnits()` | sku → units 表 | **展示兜底**（白名单） | 只用于「预计消耗 N 积分」预估（`EcMode` / `visualCreationModel` / `canvasPointsEstimate`） |
| `src/components/billing/billingUiModel.js` | `formatBillingUnits` | 纯格式化 | 把**服务端返回的** units 渲染成文本 |
| `src/pages/AdminConsole/unitEconomicsModel.js` | 运营看板计算 | 后台展示 | 管理端毛利看板，不参与用户扣费 |
| `src/constants/data.js`、`store/AppContext.jsx`、`Pricing/index.jsx`、`PricingModal.jsx` | 价格文案/展示 | 展示 | 价格页文案；实际下单金额由 `POST /api/billing/orders` 按 `PRODUCTS` 算 |
| 各处 `「XX 积分」` 按钮文案 | 字符串 | 展示 | 文案，不进入任何计费请求体 |

**参与扣费的硬编码价目：0 处** —— 这是本批最重要的结论，且已被两条机器断言锁住
（见 §4：`扣费请求体不得携带前端自算的金额字段` + `quantity 只能是常量 1 或服务端来源`）。

> ⚠️ **风险（非缺陷，但已在白名单里点名）**：`generationUnits()` 与后端目录是**两份会漂移的数据**。
> 历史真实事故已写在源码注释里（`imageModelCatalog.js:105-106`）：
> 「后端 2026-08-26 把 nano 2K 调到 1500 units，前端还停在 1000 → 用户看到预估 1 积分、实际扣 1.5 积分」。
> 它**不会**导致多扣（扣费以服务端为准），但会**误导用户**。建议后续让前端预估改调 `GET /api/billing/catalog`。

---

## 3. 发现的真实缺陷

### 缺陷 A（已修）：`NoteModal` 文案重生成「点一下立刻扣费」，无任何确认

**根因**：`src/NoteModal.jsx:915-922` 的「重新生成 · 0.2 AI 积分」按钮，
`onClick` 里**直接**调用 `textRegen()` → `regenerateText()` → `POST /api/regenerate-text`（真实扣 `ec_ai_assistant` 200 units）。
而同屏的「单图重刷」`regenSingle`（同文件 :191）却**有** `dialog.confirm`：
```js
// 图片：有确认
if (!await dialog.confirm({ title: '重新生成这张图片？', ... confirmLabel: '确认重刷' })) return;
// 文案：原本没有 —— 点下去就扣
await textRegen();
```
两个**同性质**的扣费按钮口径不一致 → 违反铁律 ①。
按钮上写「· 0.2 AI 积分」**不等于**用户在扣费前做了确认。

**影响面**：所有打开作品详情弹窗（`NoteModal`）的用户，每次误点即扣 0.2 积分，无提示、无撤销。

**修法**：补上与同屏按钮同口径的 `dialog.confirm`（`src/NoteModal.jsx`）。

**修前/修后实测**（静态检测器，可复现）：
```
修前： node --test test/charge-requires-confirmation.test.mjs
      ✖ 这些扣费点既不在事件处理器里、也没有显式确认弹窗
        → src/NoteModal.jsx:918 textRegen() 外层=(anonymous)
修后： ✔ 每个扣费点都必须能追溯到显式用户手势（或显式确认）
```

### 缺陷 B（已修 · 本批顺带）：视频方案链 4× 扣费 / 视频任务重复建单

即上一批 `9e189578` 修的两个；本批复核确认**仍生效**（见 §0），不重复计。

---

## 4. 门禁测试（含检测器自证）

### `test/charge-requires-confirmation.test.mjs`（7 条，全绿）

判据：**扣费只能由显式用户手势触发**。**不锁写法**（RTK §3.1-10）——
不断言「必须有某个函数名」，而是做**调用链传递追溯**：

| 断言 | 判据 |
|---|---|
| 扣费不得在 `useEffect`/`useMemo` 里被调用 | 副作用路径 = 挂载/渲染即扣费 |
| 每个扣费点必须追溯到手势，或在**逐条写理由**的豁免清单里 | 传递追溯：内联 onClick → 命名处理器 → 确认弹窗 |
| 豁免清单禁止空理由（≥20 字 + 非占位符） | 防止「加个白名单就绕过」 |
| 服务端拒绝缺 actionId 的扣费 | 扣费必须锚定到一次用户动作 |
| 服务端拒绝不符/过期报价 | 报价是扣费的上游凭证 |
| **动态**：无报价→400且余额不动；合法→扣一次；同 actionId 重放→不重扣 | 真实跑 `oneShotBilling` + 内存钱包 |

**检测器自证（喂反例必须变红）**：运行时构造反例字符串喂检测器 ——
① 扣费写在 `useEffect` 里 → 断言 `inEffect === 'useEffect'` 且 `traceUp().origin === null`（判红）；
② 扣费写在渲染体顶层 → 断言无手势、无确认（判红）；
③ onClick + `dialog.confirm` → 断言放行（**证明判据不是「一律判红」**）。
反例不是仓库文件 → 「改坏实现让测试变绿」走不通。

### `test/pricing-single-source.test.mjs`（8 条，全绿）

判据：**前端不存在参与计算的硬编码价目**。

| 断言 | 判据 |
|---|---|
| 扣费请求体不得含**数值型**的 `units/totalUnits/price/amount/points/credits…` | 金额只能来自服务端 |
| `quantity` 只能是常量 1，或可证来自服务端 | 份数决定总价，不得前端自算 |
| 前端价目白名单：每条 ≥40 字 + 必须含「不参与扣费」+ 必须点名 `server/billing/catalog.mjs` | 禁空理由 |
| 白名单里的价目表不得被扣费路径直接用于计算 | 形式检查 |
| 后端 `FEATURE_SKUS` + `quoteFeature` 必须存在 | 唯一权威 |
| 计费路径必须从目录取价 | 防写死回流 |
| 报价令牌必须 HMAC 签名 + 恒定时间比较 | 前端无法伪造金额 |

**检测器自证**：反例 ① `{billing_quote_id, units: 2000}` → 断言命中 `['units']`（判红）；
反例 ② `{billingQuoteId, totalUnits: 3000, price: 3}` → 断言命中（判红）；
正例 `{sku, quantity:1, billing_quote_id, billing_action_id}` → 断言放行；
空/占位豁免理由 → 断言不合格。

> **判据修正记录**：检测器第一版把 `DesignDirection.jsx` 的
> `points: '轻便、耐用'`（**卖点文案**）误判为价格字段。
> 已收紧为「属性值必须是**数值形态**」—— 这正是「指标必须测量判据本身」的实践。

---

## 5. 真实请求验证（不读代码猜）

### 5.1 完整扣费链路（真实余额变化）

```
POST /api/billing/balance                       → 200  余额 500000
POST /api/billing/quote {sku:ec_ai_assistant,quantity:1} → 200  units=200
POST /api/regenerate-text {…, billing_quote_id, billing_action_id} → 200  billing="settled"
POST /api/billing/balance                       → 200  余额 499800   ← 实际扣减 **200**
```

### 5.2 幂等（同 actionId 重放）

```
POST /api/regenerate-text （同一 billing_action_id 再发一次） → 200
POST /api/billing/balance → 499800   二次扣减 **0**   ← replay 生效
```

### 5.3 回滚链路（失败必须不扣费）

```
POST /api/billing/quote {sku:ec_canvas_recognize} → 200 units=200
POST /api/canvas/segmentation-plan （喂无效图） → 500 "商品识别暂时不可用，请稍后重试"
POST /api/billing/balance → 498800  变化 **0**          ← 失败不扣
```

**钱包流水佐证**（`wallet_ledger` 真实落库）：
```
grant   n=3  ΣdeltaAvail=+900000
hold    n=3  ΣdeltaAvail=  -1400   ΣdeltaHeld=+1400
release n=1  ΣdeltaAvail=   +200   ΣdeltaHeld= -200    ← 失败那次把钱还回来了
settle  n=2  ΣdeltaAvail=      0   ΣdeltaHeld=-1200
未结清 hold: 0    未结清 hold items: 0
```

### 5.4 服务端确认门控（无凭证即拒）

```
POST /api/regenerate-text （不带 billing_quote_id） → 400  CANVAS_BILLING_REQUEST_INVALID
POST /api/regenerate-text （报价 SKU 与消费 SKU 不符） → 409  BILLING_QUOTE_MISMATCH
```

### 5.5 未打上游的说明与局限

- **没有**真打图片/视频上游（会烧真实配额）。所有验证都用**余额变化**与**报价门控**这两个
  **可离线验证**的判据——它们恰好就是「钱有没有动」的直接测量，比「调用是否返回 200」更贴近判据本身。
- **局限**：因此本批**未验证**上游成功但产物不合格时的**部分结算**（`settleItem` vs `releaseItem` 的
  逐项取舍，电商套图 `orchestrator` 的 item 级结算）。该路径建议在**隔离上游 stub**（非真实配额）下补测。
- 另一个已观察到的现象：给 `/api/video/plans` 传空 prompt **不会失败**，而是照常生成并扣 1000 units。
  这属于产品判据（空输入是否该拒），已列为**待裁定**。

---

## 6. 待裁定（需要你决策，我不擅自改）

| # | 事项 | 影响面 | 我的建议 |
|---|---|---|---|
| 1 | **进入「设计方向」页即自动计费**（`DesignDirection.jsx` 挂载时 `loadDirections` 自报价 `ec_direction_analysis`）。它确实是用户点「生成设计方案」跳转而来，但**用户在那个页面里没有再做一次确认** | 所有走首页「下一步 → 设计方案」的用户；每次进入扣 1 积分 | 二选一：**(a)** 保持现状（跳转即视为确认，且按钮上写了价）；**(b)** 改为页内「开始分析」按钮显式确认。我倾向 (b)，与铁律 ① 最严格口径一致 |
| 2 | **电商套图自动修复会再扣一次**（`services/api.js:243 repairIncompleteSuite`）。上限 `MAX_AUTOMATIC_SUITE_REPAIRS = 1`，且仅用于「本轮有失败图需要补」，文案已写「避免重复扣费」 | 套图有失败项的用户；自动补一次 = 再扣一次 | 倾向保留（它是**恢复**不是**新购**），但建议给用户一句可见提示（「已自动补跑失败图，将按实际张数结算」） |
| 3 | **`/api/video/plans` 空 prompt 也生成并扣费** | 传空输入的用户 | 建议在服务端对空 prompt 返回 400（与 `/api/video/jobs` 的 `VIDEO_PROMPT_REQUIRED` 一致） |

---

## 7. 交付与提交

- 新增门禁：`test/charge-requires-confirmation.test.mjs`、`test/pricing-single-source.test.mjs`
- 检测器：`test/support/charge-gesture-detector.mjs`（基于 `@babel/parser` 的真实 AST 调用图）
- 缺陷修复：`src/NoteModal.jsx`（补确认弹窗）
- `npm run build`：✅ 通过
- `npm test`：见提交信息（本批两条门禁 15/15 全绿）
