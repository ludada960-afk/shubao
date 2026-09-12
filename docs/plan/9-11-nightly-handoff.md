# 9-11 夜间执行交接（用户已睡，明早看这份）

## 一、今晚已完成并上线
1. **LLM/VLM 死链修复**：线上 LLM 从失效的 DeepSeek key 切到 **65535 / gpt-5.6-luna**（远端+本地 .env 均已更新，备份 `.env.bak-911`）。实测：文案链路 2.9s 真出稿；视频方案分析 36-40s 真出方案（原来 30s 超时预算必然被兜底接管，已提到 90s）。提交 625407af。
2. **上游计费模式复核**（用户要求）：我们 10 条视频路由里**只有 Grok 是按秒**，其余 9 条按条；按秒的便宜备选见 §二。
3. **模型 LOGO 改造**（用户批注：LOGO 不对，照竞品那套）：10 个官方品牌 SVG 入库 `public/logos/`（字节 / MiniMax / 可灵 / Google / Gemini / 通义云 / 千问 / DeepSeek / Anthropic / x，共 ~7KB），新增 `src/services/modelLogos.js` + `src/components/ModelLogo.jsx`；首页生成设置、画布生成器、视频生成器三处统一使用；**删掉 3 张 1.5-2MB 的示例大图（共 5MB）**；OpenAI / Midjourney 无可公开取件的品牌标识 → 用同尺寸品牌色字标兜底（不伪造他人 logo）。提交 d501d9e5，全量 3123/3123 绿。

## 二、用户已拍板、待执行的定价与模型方案
### 2.1 决定（用户原话）
- **不做会员档**："一个档位的价格就够了。多做一个会员档会让用户觉得普通价不够便宜。" → 只保留单一价档。
- **价格按我的建议走**（§7 总表：视频按秒 × 分辨率档；图片新档按 §7.3 建议价）。
- **新模型全部上**（§7.3 的 9 类）。
- 画布节点、管理后台、会员中心的定价与模型清单都要同步。
- 做一份像竞品那样的**公开价格长清单**（透明、逐档列出）。

### 2.2 视频计费重构（核心待办）
现状：`videoFeatureSku({productId, duration})` → `video_<id>_short|long`，**一条一价、与时长无关**。
目标：**按秒计价**，charge = 每秒单价 × 时长；SKU 保留短/长两档仅作流水分类，实际单价改为每秒口径。
改动面（一次性做完，避免半成品）：
1. `server/billing/catalog.mjs`：video SKU 的 units 改为「每秒」量；`providerCostCny` 取**最坏时长（min durations）**的每秒成本，保证毛利地板按最坏情况校验：
   - agv ¥0.91/条 ÷ 5s = ¥0.182/秒；sd5 ¥3.77 ÷ 4s = ¥0.9425/秒；sd8-2.5 ¥5.07 ÷ 5s = ¥1.014/秒；H3-768p ¥4.55 ÷ 5s = ¥0.91/秒；H3-2K ¥5.85 ÷ 5s = ¥1.17/秒；kling ¥1.82 ÷ 5s = ¥0.364/秒；kling-pro ¥3.77 ÷ 5s = ¥0.754/秒；veo ¥1.17 ÷ 5s = ¥0.234/秒；wan ¥0.455 ÷ 5s = ¥0.091/秒；grok ¥0.104/秒（按秒成本，原样）。
2. `server/videoCatalog.mjs` + `server/billing/videoMeter.mjs`：报价改为 `perSecondCny × seconds`；`publicVideoProducts().quotes` 也返回每秒价与不同时长的示例总价。
3. 视频下单链路：`quoteFeature(sku, quantity = duration)`（quantity 语义从「条」改「秒」），`canvasOneShotBilling` / 冻结 / 结算 / 退款按秒数记账，历史流水用 `catalog_version` 标记。
4. 客户端：视频页与画布的「N AI 积分/次」改为「每秒 X 积分 · 本次 N 秒 = Y 积分」，随时长实时变化。
5. 测试与部署校验脚本同步（`test/video-catalog.test.mjs`、`billing-video-meter`、`billing-catalog`、`scripts/verify-production-video.mjs`）。
6. **建议的每秒价（普通档，单一档位）**：agv 1.28 / sd5 1.60 / sd8-2.5 2.44 / H3-768p 1.82 / H3-2K 2.34 / kling 0.78 / kling-pro 2.00 / veo 1.60 / wan 0.76 / grok 0.40（单位 ¥/秒；对应积分/秒 = ¥/秒 ÷ 0.2618）。
   - 这些价按「最坏时长」校验后毛利 50～95%，全部过 40% 地板。

### 2.3 新模型（9 类，全部要上）
见 `docs/research/pricing-upstream-analysis-20260911.md` §7.3：gpt-image-2.5 / -flare / -sunburst、nano-banana-pro、nano-banana 2、mdkj-super-gpt-image-2（¥0.026 最便宜）、Gemini 3 pro / 3.1 flash image、Midjourney 1K/2K、图片画质增强（seedvr2）、图片背景去除（本地 sharp）。
落地需要：`server/ecommerceEngine/modelCatalog.mjs` 扩 id → `src/services/imageModelCatalog.js` 加档位（brand 字段已有）→ 每个模型 × 分辨率一组 SKU（含中文标签 + costBasis + upstreamLedger 路由）→ 生成链路按模型选路由（**IP233 一条 key 覆盖全部**：gpt-image 系列 / nano-banana 系列 / mdkj / gemini / midjourney 都在 IP233）。

### 2.4 同步面
- 画布节点：生图模型选项要读同一份 catalog（`CanvasStudio` 的模型下拉已读 `IMAGE_MODELS`，扩档即可）。
- 管理后台 + 会员中心：确认它们都读 `/api/billing/rules` 与 `/api/billing/catalog`（单一真源），有硬编码就改读接口。
- 公开价格长清单：新增「模型价格」页/弹窗（照竞品：按模型分组，逐行列出配置 + 单价），数据源 = 上面的 catalog + billing rules。

### 2.5 成本优化待验证（一条视频的钱）
- IP233 `minimax-h3` = **¥0.162/秒**（8s ≈ ¥1.30），比现在用的 `minimax-h3-768p`（¥4.55/条）**便宜 3.5 倍**；`sd25-30s` ¥0.27/秒（30 秒长片）也值得看。
- 建议先各花一条真实调用验证 routeId 可用性与质量，再切路由。

## 三、key 清单（都在远端 server/.env，勿写进代码）
- IP233（视频 + 图片全模型）：`IP233_VIDEO_API_KEY`（= 用户给的 Change2Pro key，同平台）
- 65535（LLM + VLM + 部分生图）：`LLM_API_KEY` / `MINI_API_KEY`（同为 gpt-5.6-luna 那把）
- 火山 TTS：`TTS_API_KEY_VOLCENGINE`

## 四、按秒重构的实测结论（9-12 凌晨实做一轮后回退，给下一步省时间）
已按 §2.2 真做过一遍并跑通毛利门禁，改动如下（**代码已回退，数字可直接复用**）：
- `server/billing/catalog.mjs`：20 个 video SKU 改「每秒」口径 —— units/秒 与 cost/秒 取最坏时长：
  fast 4890/0.182 · standard 6110/0.754 · 2.5 9320/1.014 · h3-768p 6950/0.91 · h3-2k 8940/1.17 · kling 2980/0.364 · kling-pro 7640/0.754 · veo 6110/0.234 · wan 2900/0.091 · grok 1530/0.104（priceFen/秒 依次 128/160/244/182/234/78/200/160/76/40）。
- `server/videoCatalog.mjs`：standard 最短时长 4s → **5s**（4s 在按条成本 ¥3.77 下必然破 40% 地板）。
- `server/videoGeneration.mjs`：`quoteFeature(sku, 1)` → **`quoteFeature(sku, duration)`**（数量＝秒数）。
- 门禁修正：standard_long 与 minimax_h3_2k 两档从 core 带改判 **traffic 带**（按秒后毛利 50% / 47%），全 20 个 SKU 通过地板，实测毛利 **47%～85%**。
- **卡点（回退原因）**：改完 `npm test` 有 **28 个用例失败**，集中在视频报价形状/单位被写死的套件（video-workbench-plan、billing-video-meter、billing-catalog、video-catalog、verify-production-video 等）。计费层不留半成品 → 已 `git checkout` 回退，仓库恢复 3123/3123 全绿。
- 下一步：按上面数字一次性改完，并同步更新这些套件的 units/points/报价断言（约 6 个测试文件），再一并部署。


## 五、生图故障与「同模型换供应商」方案（9-12 实查，用户已纠正方向）

### 5.1 用户纠正（重要，改变实现方向）
用户原话："跑失败肯定是替换供应商啊，就是他选了什么模型，用户只想用这个模型跑出来，他又不知道你背后有没有换供应商。"
→ **绝不能静默换模型**（我原先提的"降级到 Nano Banana"是错的：用户选的是模型，换模型＝给用户换了另一个东西）。
→ 正确做法：**同一模型，换供应商**（gpt-image-2 挂了就换另一家提供 gpt-image-2 的上游），用户无感。

### 5.2 故障取证（2026-09-12）
- 内测用户 610567026@qq.com 的画布任务：模型 image2，2048×2048，3 张参考图，上游任务 `img_2143ff94…`。
- 上游返回 `error_code: upstream_5xx`，`cost_usd: 0`（未扣费）；那句英文报错是**上游原话**，我方代码无此文案。
- 复现：直连 `task-api-1-cn.65535.space` 提交 2 个探针任务 → 全部 8 秒后 `upstream_5xx`；换国际端点 `task-api-1.65535.space` 同样 `upstream_5xx`。
  ⇒ **65535 网关背后的 gpt-image-2 通道故障**（两个区域都挂），非我方 bug。

### 5.3 同模型备用供应商（已实测可用）
- **IP233 提供同一个 `gpt-image-2`**：`POST https://api-new.ip233.com/v1/images/generations`，model `gpt-image-2-1k`，用 `MINIMAX_VIDEO_API_KEY`（或 `VIDEO_API_KEY`）→ **200 真出图 URL** ✓。
  - 价目：gpt-image-2 ¥0.0195、-1k ¥0.0715、-2k ¥0.0975、-4k ¥0.1235；mdkj-super-gpt-image-2 ¥0.026（更便宜）。
  - ⚠️ `IP233_VIDEO_API_KEY` 这个 env 名是**空的**，可用的是 `VIDEO_API_KEY` / `MINIMAX_VIDEO_API_KEY`（后者实测可调图片接口）。
- 结论：可以做「同模型换供应商」，无需换模型。

### 5.4 实现要点（下一步动手清单）
1. `server/ecommerceEngine/providerAdapter.mjs` 目前只支持 `legacy-edits` / `native-tasks` 两种协议（都不是"同步 OpenAI 图片接口"）。
   → 需**新增 `openai-images` 协议**：POST JSON 到 `/v1/images/generations`（model/prompt/size/n），同步取 `data[0].url`；带参考图走 `/v1/images/edits`（multipart）。
2. `server/index.mjs:4024` 的 `createProviderRouter({ primary, overflow, legacy })` **已支持多供应商**——把 IP233 配成 image2 的 overflow（**同一个模型名**，按分辨率映射 gpt-image-2-1k/2k/4k），主通道 5xx 自动切、模型不变。
3. 重试语义：上游 `upstream_5xx`/超时 → `retryable: true`，**同模型**自动换供应商重试一次；两次都失败才报错（文案说明已尝试多家），**不静默换模型**。
4. 前端：失败卡片给「重试」按钮（同模型同参数），不提供自动换模型。

### 5.5 本轮已修并上线的小问题
- `NANO_BANANA_FLASH_MODEL` 原为 `gemini-2.5-flash-image`（上游 404 `model_not_found`）→ 改成 **`gemini-3.1-flash-image`**（实测 200，27s 真出图）。
  ⇒ 即"Nano Banana 2"选项此前对所有用户都是坏的，现已修复（线上重启完成，health 正常，备份 `.env.bak-912`）。
  - Change2Pro 可用模型名：`gemini-3.1-flash-image`、`gemini-3-pro-image`、`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`。

