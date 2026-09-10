# P3 施工规格 — 音视频节点家族 + 假能力清理 + VideoStudio 并入 + 时间线预留

> 总统筹口径：P3 让 文/图/视/音 节点族可用、成片可拼、假能力清零。
> 成本铁律（用户）：只有真要生视频/生音频的环节才真跑，且绝不烧 Seedance/TTS 做验证 —— P3 全部用契约测试（断言路由/服务解析 provider + 报价 units）而非真调上游。
> 不 mock 假能力（§2.3）：接真上游 + 计费，或 UI 诚实标"内测/报价确认中"，绝不静默失败/假数据。

## 0. 范围与顺序（§576：TTS → 首尾帧 → 对口型 → 拼接）
本期安全交付（不烧上游、报价已定或本地免费）：
1. 拼接成片（本地 ffmpeg，免费，引流）—— 可实现 + 免费可验证。
2. TTS 配音（ec_tts_voice，火山/MiniMax 报价已定 §421）—— 接真上游 + 计费；契约测试不烧。
3. 假能力清理（§2.3 三项，见 §3）。
4. timeline/track 数据模型预留（§362：graph 增 timeline? 字段位，向后兼容，本期不做自动成片时间线，只留位）。
5. VideoStudio 并列步（§563：视频节点画布可用、旧 VideoStudio 界面暂保留为简化入口，稳态后再下线）。
诚实门控（报价未定，本期不接真、不 mock）：
- 对口型/数字人（ec_lip_sync，§422 报价待确认）→ 节点渲染为"能力内测中·报价确认后立即开放"，不允许发起运行/扣费（复用 P0 unsupported 视觉）。

## 1. 新节点 kind（接进 P0 GRAPH_RUN_KINDS，从 unsupported 转 supported）
- video-composer（首尾帧/参考视频/续写/换装）：in=image/text/video，out=video，走 Seedance。本期若 provider 就绪则 supported，否则保留 P0 灰态等 provider。
- audio（TTS 配音/音乐）：in=text，out=audio，TTS 接 ec_tts_voice，按字数计费。
- lip-sync（对口型/数字人）：in=audio+image，out=video，本期诚实门控（报价未定）。
- splice（拼接成片）：in=video[]+audio，out=video，本地 ffmpeg，免费，always supported。
执行器经 P1 executeNode 注入；拼接用 ffmpeg；TTS 调现有 provider 服务；测试用假执行器 + 契约断言，不烧上游。

## 2. 价格（唯一真源 = 后端 catalog，P2 建的 pricing 规则）
- TTS ec_tts_voice：火山 ¥0.0001/千字 → 0.5 积分/条（沿用定价锚点）；MiniMax 同档。
- 对口型 ec_lip_sync：先按 6 积分挂，但本期门控不开放（报价未确认），拿到报价再开。
- 拼接成片：不新增 SKU，本地免费。

## 3. 假能力清理（§2.3，逐项 接真/门控/删除）
1. TTS 配音（mock）：接 ec_tts_voice 真上游 + 计费；未接通前 UI 标"内测"，不静默失败。
2. chainService 前两步（deriveScript/deriveKeyframes 占位）：接真实分镜脚本服务（text 节点 video_plan_analysis 1）；接不上则把"一键视频模板"第 1/2 步标"能力开发中"，不再返回假占位数据。
3. 悬空路由 /api/canvas/tts 与 /api/canvas/one-click-video：TTS 路由实现（接 ec_tts_voice）；one-click-video 若对应未接真的一键视频模板 → 从动作注册表删 execute.route + UI 隐藏，诚实不留假入口。

## 4. VideoStudio 并入（§180/§543 不新增第三套画布）
- 视频节点进 EcCanvas 同一套节点模型；旧 VideoStudio 本期保留为简化入口，不删（不变式② 只读可用）。

## 5. 时间线/轨道数据模型预留（§357-364 只留位）
- graph snapshot 增 timeline? = { tracks: [{ kind: video|audio, items: [{ nodeId, start, end }] }] }；老 snapshot 无此字段照常加载；新字段仅拼接成片后续消费。

## 6. 测试（全契约、零付费）
- 拼接：最小合成或 ffmpeg 命令 dry-run（断言参数，不真烧）。
- TTS：契约断言 provider 解析 + ec_tts_voice 报价 units 正确 + 计费走 catalog（不真调）。
- 门控：对口型/数字人 在 P1 buildRunPlan 判 unsupported（不开放）；拼接 supported。
- 假能力：删/改后无悬空路由（扫动作注册表 execute.route 全部有 handler 或被删）；chainService 无占位返回。
- npm test 全绿 + npm run build 绿 + source-hygiene 绿。

## 7. 门禁
- npm test/build/source-hygiene 全绿 + 提交 + 上线（frontend 档；仅当拼接/ffmpeg 触到生成路径才考虑 full）。
- 零付费验证；对口型/数字人诚实门控不留假数据；不 mock。

## 8. 现状核实（做 P3 前已查清，供委托照此施工，勿重复调研）
- TTS：/api/tts/synthesize 已存在（server/services/ttsBridge.mjs:305），当前返回 mock 音频 + 真成本/真 provider 切换（ttsBridge:318 自述 'mock audio; real provider swaps adapter'）。P3 = 换真 provider（火山/MiniMax，ec_tts_voice 报价已定）或诚实标'内测'；audio 节点执行器接这条 + 计费。
- 视频：Seedance 已存在（src/services/videoWorkbench.js，generateAudio/720p/planHash → 真出片）。P3 video-composer 执行器接这条 + video_seedance_* SKU（¥0.1~1/次量级，契约测不烧）。
- 假能力（必清，'不 mock 假跑'）：(1) chainService.mjs deriveScript(prompt hash 假派生) + deriveKeyframes(/mock/ 占位 URL) → 改诚实标注'文案/首帧由 LLM/生图 驱动，接入中'或不返回假占位；(2) 动作注册表 canvasActionRegistry.js 的 one-click-video / tts-voiceover 若指向不存在的 /api/canvas/* 路由(悬空) → 实现或删注册项 + UI 隐藏。
- 拼接成片：本地 ffmpeg（免费，引流）—— always supported。
- 对口型/数字人（ec_lip_sync）：报价未定 → 诚实门控（灰态'报价确认中'，不发起运行/扣费）。
- 验证纪律：P3 全用契约测试（断言执行器解析 provider + 报价 units + 计费走 catalog），绝不烧 Seedance/TTS 真调用；拼接(ffmpeg)可最小合成验证（本地免费）。