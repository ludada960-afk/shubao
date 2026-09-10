# P2 前端施工规格 —— 一键铺开 + 模板库 + 连线@引用合一（index.jsx 最小 diff 策略）

> 总统筹：P2 让"点模板 → 图上铺开节点连线 → 只拖商品图 → 运行"成立。前端必须精致（设计师审美），index.jsx 是 6000 行 TDZ 易碎单体，逻辑一律抽新模块，index.jsx diff 尽量 <150 行。
> 铁律：① 不确认不扣费；② 老文档只读可用；③ 价格唯一真源。T4/T5 的 video/audio 节点诚实门控到 P3（不 mock）。

## 1. 新前端模块（不塞进 index.jsx）
- src/pages/EcCanvas/workflowTemplates.jsx（或 .js）：
  - fetchWorkflowTemplates()：GET /api/workflow-templates（P2 后端路由，返回 graph + usage + like，真实计数）。
  - instantiateWorkflowTemplate(template, {projectId})：调 /api/workflow-templates/:slug/instantiate（后端 usage+1）+ createCanvasSession({projectId, baseVersionId, snapshot: createCanvasSnapshot(template.graph)})（canvasSessionModel.js 已有）→ 返回 {session, slotNodeIds}。
  - 一键铺开交互：模板卡片 → instantiate → 图上按相对坐标铺开节点连线 → **只高亮 [槽] 节点**（琥珀描边 + "把商品图拖进来"）→ 顶部浮出"运行整链（预计 X 积分）"（复用 P0.5 整链运行 UI + 确认面板，走 P1 /api/canvas/graph/run 或前端 canvasGraphRunController）。
  - T4/T5：video/audio 节点渲染"待 P3"灰态（复用 P0 unsupported 视觉 + 文案"视频/音频能力即将上线"），**不发起运行/扣费**。
- src/pages/EcCanvas/workflowTemplateGallery.jsx：模板库 UI（精选=public+按 usage/like 真实排序 / 我的 / 分类；卡片三件套：缩略图 + 便签教程 + 一键同款=instantiate；"预计积分"角标读 pricing；like 按钮幂等；空态 + loading + hover/圆角栅格）。
- src/pages/EcCanvas/mentionEdgeMigration.js：加载时迁移函数（复用 P2 后端 server/templates/mentionEdgeMigration.mjs 的纯逻辑或前端等价实现）：把 node.mentionSourceNodeIds 里没有对应边的补成 relation:'reference' 边，幂等只补一次。

## 2. 连线 ↔ @引用 合一（§3.5.2.1，图=唯一真源）—— index.jsx 最小 diff
目标：请求组装只读图，不再取 mentionSourceNodeIds 与 sourceNodeIds 并集（index.jsx 现 :3498 / :3610 / :3793 的并集逻辑）：
1. 抽 collectRunInputs(nodeId) 到一个新模块（复用 P0 collectNodeInputsFromEdges + 上面迁移）：返回该节点全部上游（只读图）。
2. index.jsx 三处请求组装改为：`const upstreams = collectRunInputs(nodeId);`（替换并集），diff 收敛为 3 处等量替换 + 1 个 import。
3. composer @ 选择器：@ 一个上游 → 自动补一条 reference 边（同 from→to 去重）；拉一条线 → 该上游自动进 @ 菜单（P0 已让入边生成 @图片N，这条是双向同步）。
4. 老文档迁移：loadCanvasSession/loadCanvasDraft 时跑一次 mentionEdgeMigration（幂等）；同 from→to 只一条线。
5. 契约测试：旧文档（有 mentionSourceNodeIds 无对应边）迁移后 与 纯图 等价；二次加载幂等；双 from→to 只一条。

## 3. 老文档只读可用（不变式②）
- 迁移是**追加边**（幂等），绝不删除/改写已存文档的既有节点产物；老文档加载照常渲染 + 只读可用，跑整链时才按新图。

## 4. 门禁
- 抽模块后 index.jsx diff <150 行；npm run build + source-hygiene 绿；npm test 全绿（新契约测试 + 既有 P0/P0.5/P1 不回归）。
- 提交 + 上线（frontend 档；模板库/一键铺开不改生成路径，除非 T1/T2/T3 触发真实生成——那是用户显式点运行确认后的付费动作，非部署 canary）。

## 5. 与现有 publicTemplates（提示词模板层）共存
- /api/templates/public（100 套提示词模板，L2 单节点层）保持不动；P2 新增 /api/workflow-templates（图工作流，L1/L3 一键铺开层）。两层并存，前端模板库 UI 分 tab 或分区（精选图模板 / 提示词模板）。