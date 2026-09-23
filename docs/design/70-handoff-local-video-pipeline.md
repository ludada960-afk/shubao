# 70 · 交接提示词（下个会话直接整段复制粘贴）

> 用途：本会话上下文已接近上限，把**本地视频链路最后三步**交接给新会话。
> 复制下面代码块里的全部内容，作为新会话的第一条消息发出去即可。

```
接手 薯包 AI（线上 https://shuimg.cn/）的持续开发。你在一棵既有 worktree 里工作：
F:/da/shubao/.worktrees/codex-ecommerce-stability，分支 codex/ecommerce-stability。
**绝对不许新建分支**。用户在外面等结果，指令是"全部做完"，不要频繁回头问，不要停在半成品。

【开工前先读这三样，别跳】
1. RTK.md 的**最后一段**（标题形如「批 AG–AL（2026-09-24/25）…」）—— 那是我留给你的完整交接：
   已完成批次、剩下三步、等用户拍板的事项、上游事实、以及本会话踩过的坑。
   ⚠️ 读 RTK.md 用 Node 的 fs（`fs.readFileSync('RTK.md','utf8')`）按行切片，
      **绝对不要用 Read 工具**（它会在 2000 行处截断，本项目因此丢过 4020 行）。
2. docs/design/69-skill-as-plan-architecture.md —— 「技能＝方案，模型＝实现细节」这条原则，
   以及为什么用户批评我们"把模型/清晰度/时长摊给用户"是方向性错误。
3. docs/design/70（本文件）与你手上这条提示词。

【当前状态：本地链路三层已做完，各有门禁】
· 渲染层：server/videoExportRender.mjs 支持 output={resolution,fps}（scale）与 replace=[{type:'delogo',x,y,w,h}]（先擦后缩）。
  提交 a2a0c238 + 73524fe0，门禁 test/video-render-output-spec-0924.test.mjs（6 条）
· 清单层：server/localVideoPlan.mjs（用户输入 → 渲染清单，纯函数）。提交 a1838a6b，门禁 test/local-video-plan-0925.test.mjs（4 条）
· 派发层：server/videoLocalAdapter.mjs（与上游适配器同形，只服务 localEngine 产品）。提交 1caa23ee，门禁 test/video-local-adapter-0925.test.mjs（4 条）
· 收费项：video_upscale_local_{short,long}=500 units（0.50 积分/条）、video_desubtitle_local_{short,long}=40 units/秒（0.04 积分/秒），
  都带 localEngine:true、**现在 public:false**（链路没通之前不许放出可点档位）。提交 dd6c3a10

【你要做完的三步（照做，不要重新设计）】
1. 把派发层挂进作业流水线：server/videoGeneration.mjs 里按产品的 localEngine 选适配器
   （上游仍走 videoProviders.mjs 的 registry，本地走 createLocalVideoAdapter）。
   成片交给**既有**的资产落库 / 历史 / 失败重试；本地渲染是同步的，不要做假轮询。
   ⚠️ 用 grep 找派发点（buildProviderPayload / createVideoProviderRegistry 的调用处），
      不要通读 1100 行；改完必须补一条门禁：**声明了 localEngine 的产品必须走本地适配器**。
2. 两条 skill 页面（字段照知渔，**不带模型格**；知渔那两页在 docs/design/data/quantv-video-pages.json 里是路由页）：
   · video.upscale「视频高清」= 上传视频 0/1 + 输出分辨率（720p/1080p/2k）+ FPS（30/60，本地 ffmpeg 支持，可照做）
   · video.desubtitle「视频字幕去除」= 上传视频 0/1 + 字幕标记方式（自动标记｜手动标记：放大视频并手动框选字幕区域）
   按 docs/design/69 的 plan 形态声明（engine:'local-render'、hideModel:true、userFields 只露该露的），
   同步补 quantvVideoParity 对照（kind:'page'）与 skillSources 出处（competitor），
   并把这两条登记进 src/skills/videoSpecExposure.js 的体系（它们该露的是分辨率/字幕标记方式，不是模型/清晰度/时长）。
3. 链路通了之后把两条 SKU 翻成 public:true 并发版：
   npm run test → npm run precommit（构建 + 渲染冒烟 + e2e 231 条断言 + 260 条 BLOCKING 门禁）
   → 本地逐页探针复验（照 .tmp/zc-label-probe.mjs 的写法：node:http 服 dist/ + Playwright 逐页 dump 面板文字）
   → 部署：cd /d F:/da/_deploy-b39 && git checkout --detach <新提交> 然后
     pwsh -NoProfile -File scripts/deploy-production.ps1 -RepoPath F:/da/_deploy-b39 -SkipPublicChecks
     （约 10 分钟，600 秒 canary，成功会打印 `Deployed <sha> to https://shuimg.cn/`）
   → 把这一批写进 RTK.md（用 fs.appendFileSync）。

【铁律（违反任何一条都算失败）】
· **钱**：不许在没有用户明确批准时新增/变更收费项或扣费金额；不许跑付费生成（哪怕"验证一下"）。
  上游付费探针必须先看 /api/pricing 里该模型的 api_doc 确认会不会校验非法参数（omni-fast 不校验，
  我因此在它上面误建过一个任务、花了 ¥0.86112，已记台账）。余额 ¥4.24776。
· **不许猜上游字段名**：每个模型的完整参数表在 /api/pricing 的 api_doc 里（字段名/示例/限制/计费/是否失败计费）。
· **不许放"点了必失败"的东西**：不可用/未接通的功能一律 public:false 或不渲染，并在注释里写明原因。
· 每批固定流程：改 → 全量 test → precommit → 提交（写清依据与用户原话）→ 部署 → 复验 → RTK。
  红了先修，不许绕过；也不许为了让断言过而删真实功能（要改判据必须写明"事实变了"还是"判据错了"）。
· 环境是 **cmd**：不要用 `;` 串命令（会把脚本喂给 npm 当配置并制造假错误）；多行 Node 代码写成
  .tmp/*.mjs 再跑（`node -e` 遇到 | $ 换行会被吃掉字符、静默失效）；用 Read 看长行会被截断，
  改长行前先确认看到的是整行。

【等用户拍板的（做完上面三步后顺带推进，但改价/新增收费项必须他自己说）】
· 1080P：他要"比 720P 贵一倍"；判断可行且偏保守（seedance 按条族 1080P 与 720P 上游同价、minimax 贵 12%、
  通义万相贵 40%）⇒ 建议按家族各加一条独立 1080P 档（复用现成的 video_seedance_1080p SKU 思路）。
· 数字人：方案流水线（文案生成 → TTS（站内已有 ec_tts_voice）→ 本地口型合成 Wav2Lip/SadTalker），涉及算力评估。
· 示例区：用户自己在生产环境跑，别动。
```

## 为什么这份提示词是这个形状

· **先给状态、再给动作**：新会话没有任何上下文，所以前三样必读材料 + "三层已完成、各有门禁、提交号" 必须写在最前面，它才不会被"再做一遍"诱惑。
· **把纪律写成铁律清单**：钱路、不许猜字段名、不许放死的入口、每批流程、cmd 环境的三个坑 —— 这些是本会话花钱与踩坑换来的，写下来比让它自己"悟"便宜得多。
· **判据与出处都给到文件级**：门禁文件名、实采 json 路径、探针脚本写法都点名，避免重新发明。
· **明确"不要重新设计"**：三层已经按 `docs/design/69` 的设计落好了，剩下的是接线与页面。
