# P2 施工规格 — 工作流模板层 + 技能市场 + 连线@引用合一

> 总统筹口径：P2 让"点一个模板 → 图上铺开节点连线 → 只拖商品图 → 运行"成立。
> 前置：P1 后端宿主（/api/canvas/graph/run + canvas_graph_runs）已完成并上线。
> 铁律：① 不确认不扣费；② 老文档只读可用；③ 价格唯一真源（后端 catalog）。零 bug、不 mock 假能力。

## 0. 本期范围（诚实分期）
- **可跑通（本期 end-to-end 可运行）**：T1 白底主图 / T2 模特试穿 / T3 场景详情(N 张) — 仅用 image + text 节点（P1/P2 已支持的 kind）。
- **铺全但诚实门控（本期只做"目录 + 图结构 + 一键铺开"，video/audio 节点标"能力即将上线"）**：T4 换装短视频 / T5 口播带货 — 依赖 P3 音视频节点家族，节点在图上以"待 P3"灰态呈现（复用 P0 unsupported 视觉），**不 mock 假跑**。

## 1. 数据模型（新表，幂等 PRAGMA/ALTER，仿 db.mjs）
### 1.1 workflow_templates（模板）
```
template_id TEXT PK, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
description TEXT NOT NULL, author_email TEXT NOT NULL, is_built_in INTEGER NOT NULL DEFAULT 0,
is_public INTEGER NOT NULL DEFAULT 0, graph_json TEXT NOT NULL,   -- {nodes[], connections[]} 唯一真源
pricing_json TEXT NOT NULL DEFAULT '{}', -- {estimatedUnits, unitNote} 展示用，实际扣费仍以 catalog 为准
usage_count INTEGER NOT NULL DEFAULT 0, like_count INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL, updated_at TEXT NOT NULL
INDEX (is_public, category, updated_at), INDEX (author_email)
```
### 1.2 workflow_template_claims（技能市场"喜欢"幂等去重，仿 canvasBilledActionStore）
```
template_id TEXT NOT NULL, owner_email TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('like')),
created_at TEXT NOT NULL, PRIMARY KEY(template_id, owner_email, kind)
```
### 1.3 usage 口径（技能市场"使用量"必须是真数，禁占位——master-plan §153 红线）
- 模板实例化成功（createCanvasSession from template）→ usage_count + 1；
- 或复用 adminOperations.usage_events：写一条 `{feature:'workflow_template', template_id, owner_email}` 事件，看板/聚合直接用。
- **禁止**沿用 publicTemplates.mjs 里"100 套占位 base 计数"的假数字（见 §2.3 清理）。

## 2. 五个模板的图结构（graph_json，唯一真源=节点+连线；@ 编号=入边顺序）
- **T1 白底主图**（预估 ~1.2）：`[槽:商品图 source] → 反推提示词(text ec_reverse_prompt 0.2) → 主图生成(image-composer ec_image_2k)`
- **T2 模特试穿**（预估 ~2，无模特图 +1）：`[服装图] + [模特图] → 换装(image-composer)` 双入边；`[模特图] → 三视图(image-composer 16:9)` 并行分支
- **T3 场景详情(N)**（预估 ~1.2+N）：`[商品图] → 反推(0.2) → 场景生成×N(image) → 详情图拼接(本地免费)`
- **T4 换装短视频（旗舰，P3 门控）**（预估 ~29）：`[模特图]+[服装图]→换装(1)→成片(video seedance 27)`；`[动作参考视频]→分镜脚本(text 1)→成片`
- **T5 口播带货（P3 门控）**（预估 ~8.2）：`[商品图]→卖点文案(text 0.2)→TTS(audio 1)→对口型(video 6)`；`[商品图]→主播图(image 1)→对口型`
> 模板不单独收费，只收内部节点；卡片点开前显示"预计 X 积分"（读 pricing_json，扣费走 catalog 唯一真源）。

## 3. 服务端（新模块，零付费可测）
- `server/templates/workflowTemplateStore.mjs`：上表建表 + CRUD（listTemplates({public|mine|category}), get, create(内置 by 系统), incrementUsage, toggleLike 幂等）。
- `server/templates/workflowTemplateRoutes.mjs`：`mountWorkflowTemplateRoutes(app,{store,authorize})` → GET /api/workflow-templates, GET /:id, POST /:id/instantiate（→ 建 canvas session, usage+1）, POST /:id/like（幂等）, POST /api/workflow-templates（用户自建, is_built_in=0）。
- 内置 5 模板以代码常量 `server/templates/builtinTemplates.mjs`（graph_json 按 §2），首次迁移播种（幂等，slug 唯一）。

## 4. 前端（设计审美到位，非 demo）
- 画布"一键铺开"：模板卡片 → `instantiate` 建 session → `createCanvasSession({snapshot: template.graph})` → 图上按相对坐标铺开节点连线 → **只高亮 [槽] 节点**（琥珀描边 + "把商品图拖进来"）→ 顶部出现"运行整链（预计 X 积分）"（走 P1 /api/canvas/graph/run 前端预览 + 确认，P0.5 已有整链运行 UI）。
- T4/T5：video/audio 节点渲染为"待 P3"灰态（复用 P0 unsupported 视觉 + 文案"视频/音频能力即将上线"），**不允许发起扣费运行**（P1 对 unsupported kind 返回清晰 400/skipped）。
- 模板库 UI：精选模板（is_public, 按 usage/like 排序 + 真实数字）/ 我的模板 / 分类；卡片三件套（缩略图 + 便签教程 + 一键同款=instantiate）。设计师审美：栅格、卡片圆角、hover、"预计积分"角标、空态。

## 5. 连线 ↔ @引用 合一（§3.5.2.1，本期必做，图=唯一真源）
- @ 一个上游 → 自动补一条 relation:'reference' 边（同 from→to 去重）；
- 拉一条线 → 该上游自动进 @ 菜单；
- 请求组装**只读图**（删除 mentionSourceNodeIds 与 sourceNodeIds 的并集，见 index.jsx:3498/3610/3793）；
- **老文档迁移（幂等只补一次）**：loadCanvasSession/loadCanvasDraft 时，把 mentionSourceNodeIds 里没有对应边的补成边；同 from→to 只一条。写一次迁移函数 + 单测（旧文档 → 补边后与纯图等价、二次加载幂等）。

## 6. 测试（全零付费）
- 模板 store/路由 node:test（in-memory sqlite）：建表幂等、instantiate → usage+1、like 幂等、内置播种幂等（不重复）、graph_json 合法性。
- §3.5.2.1 迁移单测：mentionSourceNodeIds 补边幂等 + 与纯图等价；双 from→to 只一条。
- 契约：T1/T2/T3 的 graph 能喂给 P1 buildRunPlan 得出可行 layers（可跑）；T4/T5 的 video/audio 节点被判 unsupported（P3 门控）。
- 前端 `npm run build` + source-hygiene 绿。

## 7. 门禁
- npm test 全绿 + npm run build 绿 + source-hygiene 绿 + 提交 + 上线（生成路径未改 → frontend 档）。
- 不 mock 假能力；T4/T5 诚实门控到 P3；模板使用量必须是真数。
