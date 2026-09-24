# 74 · 数字人（火山口型对齐）：实现记录与待办（2026-09-26 批 AU）

> 用户原话：「数字人要不要用对口型的，你先看一下**知渔他们那边是什么策略**」→「**数字人你也可以做**」。
> 上游策略与选型算账在 **docs/design/72**；这篇记**我们怎么做完的**、**哪些还没做**、**为什么没公开**。

---

## 一、这一批做完的东西（逐件，带判据）

| 件 | 落点 | 关键判据 |
|---|---|---|
| HTTP 底座（共用） | `server/volcMediaKitClient.mjs`（新） | 字幕擦除与口型对齐**共用同一份**上传/票据/轮询骨架；三个实测坑（票据要 `file_size`、`upload_url` 6079 字符不许截断、结果在 `result` 里）只写一遍 |
| 口型对齐适配器 | `server/volcLipSync.mjs`（新） | `POST /tools/lip-sync`、Bearer 鉴权、body = `video_url` + `audio_url` + `enable_video_loop`（**没有** `mode`/`model_version` —— 与字幕擦除的参数表不同，逐字核对过官方文档） |
| 产品 | `server/videoCatalog.mjs` 的 `lipsync_volc` | `videoProcess: true` + `credential: 'volc'` + `routeId: 'volc-media-kit-lipsync'`；**多要一段音频**（`localSpec.audio: true`） |
| 路由台账 | 同上 `ROUTE_REACHABILITY['volc-media-kit-lipsync']` | 状态 **`unverified`**（一次真调用都没跑过，如实记，不写"即将可用"） |
| 收费项 | `server/billing/catalog.mjs` 的 `video_lipsync_volc_short/long` | **120 units/秒 = 0.12 积分/秒**；成本按秒记 ¥1/60；面值毛利 46.9%（过引流带 40% 地板）；**public: false** |
| 派发 | `server/videoGeneration.mjs` | 按 **routeId** 分流（不再只看 `credential === 'volc'` —— 两条路同一把 Key，只看 credential 会把数字人提到字幕擦除的接口上）；上传**两个文件**（视频 + 音频）；计费**按音频秒数** |
| 建单校验 | 同上 | 缺人物视频 / 缺驱动音频 / 缺时长 ⇒ 400，**不建单、不冻结积分、一次上游请求都不发** |
| 能力位 | 同上 `capabilities().digitalHuman` | 只读状态：**现在必然 `available: false`**，原因写清是"没实测"还是"价没签" |
| 技能声明 | `src/skills/videoSkills.js` 的 `video.digital_human` | `availability: 'blocked'`（角标「即将上线」）；`plan.engine = 'upstream-process'`（新引入的方案引擎常量）；`hideModel: true` |
| 工作台 | `src/skills/videoWorkbenches.js` | 驱动方式（静态一行）+ 人物视频 + 驱动配音 + 配音从哪来（说明），照知渔 /digital-human 的**第 02 步形态** |
| 出处登记 | `src/skills/skillSources.js` / `src/skills/quantvVideoParity.js` | 两处实证：知渔路由页 + 他们的模型登记表（入参 `source_video_url` + `source_audio_url`） |
| 规格暴露 | `src/skills/videoSpecExposure.js` | 派生自知渔 `/digital-human` 的实采 panelText ⇒ **三项全 false**（与 fallback 同形） |
| 测试 | `test/video-lipsync-dispatch-0926.test.mjs`（6 条） | 产品/收费项契约、适配器契约、启用循环、建单闸门、上传与提交分流、能力位 |

**门禁改判记录（哪条改了、为什么）**——都是"事实变了"，不是放宽：
* `test/billing-catalog.test.mjs`：视频 SKU 38 → **40**（+2 条）；
* `test/video-catalog.test.mjs`：产品 id 清单 +1（`lipsync_volc`）、非模型产品清单 +1；
* `test/quantv-video-parity-machine-0920.test.mjs`：视频 skill 58 → **59**、有对应页 32 → **33**；
* `test/video-route-subpage-parity-0921.test.mjs`：对到知渔**路由页**的清单 +1（`/digital-human`
  本来就在"没有参数配置组头"那 7 条名单里）；
* `test/video-skill-library-contract-0916.test.mjs`：**判据推广**——原来只把
  `plan.engine === 'local-render'` 当"方案页"，现在改成"**声明了 `plan.engine` 的方案页**"
  （本批新增的 `upstream-process` 是第二个方案引擎）。守的东西一个字没变：
  方案页仍要 ≥2 格用户字段、仍不许出现 `model` 字段、仍必须 `hideModel`。
* `test/skill-source-provenance-0918`：补登 `video.digital_human` 的出处。

---

## 二、真机实测：**2026-09-24 跑通了**（批 AX）

用户原话：「数字人这个，**真人视频你自己可以找呀**，网上一大堆，我们反正只是测试呀」+
「数字人价格我不清楚，你调研过知渔他们收多少钱吗，**你利润这块觉得还可以就行**」。
⇒ 这一批把最后一道"实测"门过了，并把价格确认记下来。

| 项 | 实测值 |
|---|---|
| 素材（视频） | 免版权素材站的**单人正脸**片段，960×540，**8.56 秒** |
| 素材（音频） | **站内 TTS**（火山/豆包）合成的中文配音，36 字，**7.25 秒**（成本 ¥0.000004） |
| 任务号 | `amk-tool-lip-sync-1401540081154` |
| 提交 → 完成 | 约 **92 秒**（官方口径 RTF 6~8：7.25 秒音频 → 90 秒上下，与文档吻合） |
| 成片 | **7.28 秒**（= 音频时长 ⇒ `enable_video_loop: true` 生效，没有按视频的 8.56 秒截） |
| 上游成本 | ≈ **¥0.1213**（7.28 秒 ÷ 60 × 1 元/分钟） |
| 真伪验证 | 抽帧比对：同一时间点原片闭嘴、成片**张嘴** ⇒ 嘴型确实由配音驱动（`.tmp/dh/out/compare.jpg`） |

**因此台账 `volc-media-kit-lipsync` 由 `unverified` 转 `callable`**（证据行写在 server/videoCatalog.mjs），
**价格也已确认**（0.12 积分/秒；对标知渔 2.40 积分/分钟 ⇒ 我们便宜约 21%，面值毛利 46.9%）。

### 现在**只剩一道门**：创作台接线
产品仍是 `public: false`，但原因变了 —— 不是"没实测/没定价"，而是 **VideoStudio 还没有
`upstream-process` 引擎的那条分支**：
1. 音频槽位的**时长探针**（现在只对源视频探时长；这一档要按音频秒数计费）；
2. 报价数量取**音频秒数**（`billableQuantity({sku, seconds})` 服务端已经支持，页面还没传）；
3. 生成按钮的闸门从"拦死"改成"按 available 放开"（`processPlanBlocked` 已经写成读服务端状态，
   接线完成后会自动放开）；
4. 规格暴露：这一页不露模型/清晰度/时长三项（已按知渔实况登记为全 false）。

这四件事是同一批活（都在 VideoStudio 的 process-product 分支上），做完就能把
产品的两条 `public` 一起翻成 `true`、摘掉技能角标「即将上线」。

1. **一次真调用都没跑过** —— 手上没有"单人真人出镜"的素材（官方要求：单人、正脸、
   水平转动 ≤45°、俯仰 ≤15°、无遮挡、不支持 HDR），而铁律是"不许跑付费生成（哪怕验证一下）"。
   ⇒ 产品 `public: false`、SKU `public: false`、台账 `unverified`。
2. **价格没签字** —— 0.12 积分/秒是我按文档成本推的（对标知渔 2.40 积分/分钟，
   我们便宜约 21%）。**新增收费项必须用户明确批准**（铁律），所以再合理也不能自己打开。

**翻公开需要你做的两件事**：
① 给一段**真人出镜视频**（手机随手拍一段 5~10 秒的正脸即可）+ 一段 10 秒左右的配音；
② 对 0.12 积分/秒 说一句"可以"。
⇒ 我跑一次真机（约 ¥0.17 成本），把证据写进台账、把两条 `public` 翻成 `true`、技能角标摘掉。

---

## 三、上游约束（来自官方文档，用户侧会看到的那几条）

* **视频**：只支持 **MP4**；**单人真人**出镜；人脸正对镜头、水平 ≤45°、俯仰 ≤15°、无遮挡、面部光线稳定；
  **≤30 分钟**；不支持 HDR。
* **音频**：mp3 / aac / wav / m4a / flac。
* **耗时**：官方给的平均 **RTF 6~8**（处理耗时 / 音频时长）⇒ **1 分钟音频要跑 6~8 分钟**。
  这一条对体验影响最大（用户在页面上要等很久），已写进产品的 `limitations`。
* **计费**：按**输出**时长，1 元/分钟，毫秒级累计（90 秒 = 1.5 分钟）；
  **未查到**最低时长，**未查到**"失败不计费"的表述（⇒ 失败时上游可能照收，但我们给用户退费，成本由我们承担）。
* **成片地址有效期 24 小时**（查询接口在剩余不足 2 小时时会自动续期）⇒ 必须及时下载落库
  （流水线本来就是收到 completed 立刻下载，不受影响）。

**一个与计费绑死的参数**：`enable_video_loop` **固定传 `true`**。
官方语义：`false`（默认）= 以较短者截断；`true` = 以**音频**时长为准（画面往复循环）。
我们按**音频秒数**收费 ⇒ 用默认值会出现"收 20 秒的钱、交 10 秒的货"。

---

## 四、还没做的（如实列，别当成已做）

1. **创作台那页还进不去**：`video.digital_human` 是 `blocked`（即将上线），
   所以 VideoStudio 里**没有**为 `upstream-process` 引擎做页面接线（音频槽位的时长探针、
   报价数量取音频秒数、生成按钮的闸门）。⚠️ **批 AX 已经把"实测"与"定价"两道门过了**
   （见 §二），所以现在**只差这一件**；接线完成即可把产品两条 `public` 一起翻成 `true`。
2. **没有"文案 → TTS → 口型"的一体化**：火山 AI MediaKit **整个产品里没有语音合成工具**
   （查过它的完整文档树，299 篇），所以 `audio_url` 只能由用户提供。
   ⇒ 现在只能"上传配音"；要"输入文案自动配音"得另外接 TTS（站内有 `ec_tts_voice` SKU，
   但那是另一条链路，本批**没接**）。
   * 备选（留档，未采用）：火山**旧版媒体处理**的「智能表情合成」支持
     `DrivenText` + `TTSParams`（文本驱动 + 音色 male/female），但那是旧产品的工作流模板制
     （`SubmitJob` + ActivityId），与 MediaKit 是两套独立计费/鉴权 —— 要做是另一个项目。
3. **数字人形象库不做**：照知渔（他们新账号下没有任何内置虚拟形象，只能自带视频）。
   这也是**零肖像权风险**的取法 —— 我们不替用户造一张脸。
