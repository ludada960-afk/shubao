# 节点生态 P0→P3 全链路回归指南（商业化终极版 · 已上线 shuimg.cn）

> 总统筹口径：不确认不扣费 / 老文档只读可用 / 价格唯一真源（后端 catalog）。零 bug 门禁：每阶段 npm test 全绿 + build + source-hygiene，部署用 frontend 档（不烧付费 canary）。

## 一、现在线上有什么（都可直接在 /canvas/editor 试）
1. **P0 连线自动供料**：两个节点拉一根线 → 下游生成自动吃上游产物（@图片N=入边顺序）；不连线行为和以前一模一样。
2. **P0.5 整链"▶运行"**：选中一组节点 → 工具栏"运行"→ 先弹报价预览（这条链花多少积分）→ 你确认才跑（不确认绝不扣费）。改文案/换素材 → 下游自动黄标"已失效·需重跑"。
3. **P2 模板库 + 一键铺开**：顶栏"工作流模板"按钮 → 精选(真实 usage/like 排序)/我的/分类 tab → 点模板"一键铺开"→ 图上铺开节点连线 → 只高亮琥珀 [槽] 节点（"把商品图拖进来"）→ 顶部"运行整链(预计 X 积分)"→ 二次确认跑。点赞幂等（真数，非占位）。
   - **T2 模特试穿**：纯图链，填 2 张图即可端到端跑。
   - **T1 白底主图 / T3 场景详情**：填"反推提示词"文本后跑图像段（T3 详情拼接 splice 已免费接进 P1，可跑；视频拼接 P3.1）。
   - **T4 换装短视频 / T5 口播带货**：卡片 + 节点"视频/音频能力即将上线（待 P3.1）"灰态，**无扣费入口、不 mock 假跑**（对口型/数字人报价未定）。
4. **P3 假能力清零**：TTS（/api/canvas/tts + /api/tts/synthesize）标"真 provider 待接入/内测"；一键视频（/api/canvas/one-click-video）4 步链带 mock 标记（文案/首帧 LLM 接入中）—— 都不再静默假装走过；图片拼接 splice 免费可用；timeline/轨道字段已预留。

## 二、后端宿主（P1，宕机可恢复/可计费/可取消）
- POST /api/canvas/graph/run（整链编排：拓扑分层 + 每节点复用计费守卫 + 失败只隔离下游 + 取消/恢复 + 幂等不重扣）；GET /runs/:id；POST /runs/:id/cancel。
- 免费白底链（商品图→去背景→放大）端到端 0 扣费已验证；图片拼接（splice）免费。

## 三、回归探针（线上 curl，全应 200/401，非 404/500）
- /api/health=200；/api/workflow-templates=200（5 内置模板 + 真实 usage/like）；/api/canvas/graph/run=401(未登录)；/api/canvas/one-click-video=401；/api/canvas/tts=401。
- 免费链零成本：T2 填 2 图→运行；T1/T3 填反推文本→跑；T4/T5 应只显示"待 P3.1"灰态、无运行按钮。

## 四、诚实门控（哪些是"待"，非遗漏）
- **P3.1（需上游/报价确认，本期不硬开）**：真 TTS(ec_tts_voice 火山/MiniMax)、Seedance 视频真出片、LLM 文案/生图首帧 adapter、对口型/数字人(lip-sync, 报价未定)、视频拼接(ffmpeg)、客户端 GRAPH_RUN_KINDS 补 splice 镜像。全部已留接口/字段/门控，确认后即可开，属加法不返工。
- **不变式**：不确认不扣费（一切扣费在 P0.5 二次确认 + P1 执行器 catalog 报价后）；老文档只读可用（P2 @引用合一是纯增量迁移）；价格唯一真源（模板 pricing 仅展示预估）。

## 五、提交栈（本轮）
- a87ba596 P0/P0.5 · 5f496210+a8ce8b57 P1 · a32f0cea P2后端 · 3e7dbc85 P2前端Stage1 · cb5f6356 P2前端Stage2(@引用合一) · 7e4c7e5e P3(诚实门控版)。全量 npm test 3088 pass/0 fail + build + source-hygiene 绿。