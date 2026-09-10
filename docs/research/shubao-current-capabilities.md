# 薯包AI 现有能力地图（面向总架构师）

> 生成时间：2026-09-10 ｜ 代码基线：worktree `codex-ecommerce-stability`（只读盘点，未修改任何源码）
> 目的：在做"节点化工作流 / 有向图执行引擎"之前，先把**已有能力**、**已有底座**、**已有债**用代码证据钉死。
> 证据约定：每条结论后 `(相对路径:行号)`。未经确证的一律写"未确认"，不编造。

### 目录

1. [画布（EcCanvas）](#1-画布eccanvas)
2. [AI 能力在画布里的入口](#2-ai-能力在画布里的入口前端动作--后端路由--计费-sku)
3. [视频工作台（VideoStudio）](#3-视频工作台videostudio)
4. [素材库 / 作品集](#4-素材库--作品集)
5. [技能系统](#5-技能系统)
6. [计费体系](#6-计费体系)
7. [其他与创作生态相关的既有能力](#7-其他与创作生态相关的既有能力)
8. [可复用的底座与限制](#8-可复用的底座与限制)
9. [**距离"节点图"还差什么（架构决策必读）**](#9-距离节点图有向图--端口--执行引擎还差什么)

> 详细原始笔记（子代理产出，未删减）在 `.tmp-research/`：
> `billing.md`(51KB)、`canvas-ai-backend.md`(45KB)、`videostudio.md`(46KB)、`assets-skills.md`(46KB)、`ecommerce-ecosystem.md`(75KB)。
> 本报告中的所有行号均已通过 read/grep 工具核对；凡标注"未确认"的即为未能确证的项。

---

## 0. 一页速览

| 维度 | 现状 |
|---|---|
| 产品形态 | SPA，state-based 路由 + pathname 映射；16 个页面目录，主力是 `EcCanvas`(809KB 源码) 与 `Home`(698KB) |
| 画布 | **已经是"节点+连线"结构的可视化编辑器**：节点有 kind/x/y/w/h/输入输出端口，边有 fromPort/toPort/relation。但边**不参与执行**，只是视觉关系 |
| 执行模型 | 每条派生链**手动触发**；点"+"建节点 → 填 prompt → 点生成。仅 3 条链做到"派生即执行"（文案/TTS/字幕） |
| 引擎 | 无通用 DAG 执行引擎。已有 4 个彼此独立的"链"实现：`chainService`(4 步 mock)、`ecommerceEngine/orchestrator`(电商套图)、`videoWorkbench`(视频)、`generationJobs`(单任务) |
| 计费 | 完整：wallet + quote + hold + settle + 上游台账；SKU 目录集中在 `server/billing/catalog.mjs` |
| 最大结构性风险 | `server/index.mjs` 单文件 267KB / **5274 行 / 64 条路由**承载全部业务路由；`EcCanvas/index.jsx` 单文件 **6182 行**承载全部画布逻辑 |

---

## 1. 画布（EcCanvas）

### 1.1 代码分布

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/pages/EcCanvas/index.jsx` | 6182 | 画布唯一容器：状态、指针、执行、渲染（巨石） |
| `src/pages/EcCanvas/components/CanvasStudio.jsx` | 1410 | 工作台/合成器 UI |
| `src/pages/EcCanvas/EcCanvas.css` | 1135 | 样式 |
| `src/pages/EcCanvas/canvasQuantvExtensions.js` | 675 | Quantv 风格节点图规格（类型表/边校验/自动排版/快捷键/右键菜单/成本估算） |
| `src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx` | 605 | 右键菜单 + 便签组件 |
| `src/pages/EcCanvas/canvasStudioModel.js` | 455 | 节点工厂 + 缩放/网格 |
| `src/pages/EcCanvas/canvasSuitePlanModel.js` | 342 | 套图计划 |
| `src/pages/EcCanvas/canvasInteractionModel.js` | 263 | 多选动作、位置计算、图层组替换 |
| `src/pages/EcCanvas/canvasSessionModel.js` | 259 | 会话快照 + 项目素材导入 |
| `src/pages/EcCanvas/canvasWorkModel.js` | 245 | 作品↔画布的数据归一 |
| `src/pages/EcCanvas/canvasKeyboardHooks.js` | 258 | 快捷键 hook + 撤销历史 + 剪贴板 |
| `src/pages/EcCanvas/canvasActionRegistry.js` | 191 | **画布动作注册表（30 个动作）** |
| `src/pages/EcCanvas/canvasState.js` | 180 | 指针意图/缩放/框选/连线增删 |
| `src/pages/EcCanvas/canvasDerivedAutoRun.js` | 159 | 派生即执行纯函数层 |
| `src/pages/EcCanvas/components/CanvasMinimap.jsx` | 151 | 小地图 |
| `src/pages/EcCanvas/canvasActionRegistry.js` 等 20+ 个 model 文件 | — | 见上 |

### 1.2 数据模型

**节点（Node）** —— 归一化函数 `normalizeCanvasNode` `(src/pages/EcCanvas/nodeWorkflow.js:83-101)`：

```
{ id, kind, status, sourceNodeIds[], actionId, inputs{}, output, editable,
  x, y, w, h }
```

- `kind` 默认 `'image'`；`status` 默认 `image→'ready'`、其他 `'draft'` `(nodeWorkflow.js:85-90)`
- 节点状态枚举 6 态：`draft/analyzing/running/ready/success/error` `(src/pages/EcCanvas/components/workflowNodes/modular/workflowNodeViewModel.js:1-8)`
- **完整节点 kind 全集**（`NODE_TYPE_KIND` `(canvasQuantvExtensions.js:21-41)` + 扩展）：
  - 素材类：`text` / `image` / `output` / `video` / `audio` / `source_group` / `layer-group`
  - 合成器类：`image-composer` / `text-composer` / `video-composer` / `suite-composer`
  - 处理节点类：`smart-remix` / `layer-workbench` / `remove-bg` / `extend` / `inpaint` / `translate` / `upscale`
  - 应用节点类：`application`（`application-1click-suite/-1click-video/tts/caption` 四个 `actionId`，`(canvasQuantvExtensions.js:557-562)`）
  - 其他：`subtitle` `(src/pages/EcCanvas/index.jsx:4055)`、`sticker` 便签 `(canvasQuantvExtensions.js:465-478)`
- 节点工厂（真正"造节点"的地方）：
  - 上传图片 `createUploadedImageNodes` `(canvasStudioModel.js:384-419)`（240 宽、按比例算高、默认名 `Enclosure-001`）
  - 上传视频 `createUploadedVideoNodes` `(canvasStudioModel.js:421-455)`（320 宽、默认名 `Breakthrough-001`）
  - 文本 `createCanvasTextNode` `(canvasStudioModel.js:219-241)`
  - 四个 composer `(canvasStudioModel.js:243-347)`
  - 项目音频 `audioNodeFromAsset` `(canvasSessionModel.js:115-140)`
  - 处理节点 `createDerivedNode` `(nodeWorkflow.js:124-145)`，尺寸表 `ACTION_SIZES` `(nodeWorkflow.js:4-12)`
- 节点字段不止上述核心字段，工厂还会挂：`url / name / displayLabel / group / role / ratio / size / rotation / locked / hidden / provenance / projectAssetRef / assetRef / inputs / output` `(canvasStudioModel.js:392-417)`
- 图层组：`layerChildIds[]` / `parentLayerGroupId` `(canvasInteractionModel.js:124-130, 206-222)`；文本图层优先级最高 `(canvasInteractionModel.js:212-215)`

**边（Connection）** —— 归一化函数 `normalizeCanvasConnection` `(nodeWorkflow.js:103-122)`：

```
{ id, fromNodeId, fromPort='output', toNodeId, toPort='input', relation,
  from, to, type, actionId? }
```

- **已经是"带端口的有向边"**：`fromPort`/`toPort` 字段存在，几何计算在 `getNodePortCenter` `(src/pages/EcCanvas/canvasGeometry.js:25-33)`，贝塞尔连线 `cubicEdgePath` `(canvasGeometry.js:35-38)`
- 关系类型 `relation`：`'reference'`（画布手拉线，默认）/ `'derived'`（派生）/ `'source-output'`（工作导入）/ `'smart-remix-output'`（生成结果）
  - 手拉线固定为 `'reference'` `(src/pages/EcCanvas/index.jsx:2065)`
  - 派生边 `createChildConnection` `(nodeWorkflow.js:147-157)`
  - 导入边 `(canvasSessionModel.js:243-254)`
  - 生成结果边 `(index.jsx:2411)`
- 去重规则：同 `(from, to, relation)` 不重复添加 `(src/pages/EcCanvas/canvasState.js:152-171)`
- 边类型校验（**已实现且已接线**）：`isEdgeInvalid` 用 `NODE_TYPE_KIND`×`NODE_ACCEPT_TYPES` 判断上游产出类型是否被下游接受 `(canvasQuantvExtensions.js:43-82)`，渲染时标记无效边 `(index.jsx:463-465)`
- 删除节点会级联删边 `removeConnectionsForNodes` `(canvasState.js:173-181)`

**画布会话快照** —— `createCanvasSnapshot` `(src/pages/EcCanvas/canvasSessionModel.js:93-102)`：

```
{ nodes[], connections[], viewport{x,y,scale}, pendingProjectAssetImports[] }
```

### 1.3 交互能力（逐项，含"有/没有"）

| 能力 | 状态 | 证据 |
|---|---|---|
| 拖拽移动节点 | ✅ | `moveCanvasNodes` `(canvasInteractionModel.js:186-193)`；指针模式 `'drag'` `(index.jsx:1861)` |
| 缩放画布（滚轮/光标锚点） | ✅ 0.15–4x | `zoomAroundCursor`/`zoomPreviewByWheel` `(canvasState.js:28-38)`；wheel 处理 `(index.jsx:1917)` |
| 平移（Space / Alt / 中键 / 抓手） | ✅ | `getCanvasPointerIntent` `(canvasState.js:1-7)`；`spacePressed` `(index.jsx:1539-1542)` |
| 框选（marquee） | ✅ | `selectNodesInRect` `(canvasState.js:133-143)`；渲染 `(index.jsx:5740)` |
| 多选（Shift） | ✅ | `handleToggleSelect` `(index.jsx:2048-2053)`；`shiftPressed` `(index.jsx:1543)` |
| 节点缩放（8 向手柄） | ✅ | `resizeCanvasNodeByHandle` `(canvasStudioModel.js:119-205)`；入口 `handleNodeResizeStart` `(index.jsx:2011)` |
| 右键菜单（画布空白） | ✅ 13 项 | `CANVAS_RIGHT_CLICK_ACTIONS` `(canvasQuantvExtensions.js:641-655)` |
| 右键菜单（节点） | ✅ 11 项 | `NODE_RIGHT_CLICK_ACTIONS` `(canvasQuantvExtensions.js:625-637)` |
| 双击节点 | ✅ 预览/检查；文本节点进入编辑 | `(index.jsx:359, 427, 5500)` |
| 双击空白 | ✅ 添加节点面板 | 由 `setAddNodePanel` 驱动 `(index.jsx:1551)`（面板组件见 `CanvasContextMenuPanel.jsx`） |
| 快捷键 | ⚠️ 部分 | 实现在 `index.jsx:1537-1720`（自研 keydown）：T/Del/Backspace/Ctrl+A/Ctrl+D(取消全选)/F/Ctrl+C/Ctrl+V/Ctrl+Z/Ctrl+Shift+Z/Ctrl+G；规格表 `CANVAS_SHORTCUTS` 列了 19 条 `(canvasQuantvExtensions.js:601-621)`，其中 Ctrl+S / ? / 方向键微调在 index.jsx 中**未确认**已实现 |
| 撤销/重做 | ⚠️ 仅 nodes | `createCanvasHistory` `(canvasKeyboardHooks.js:211-240)`，接线 `(index.jsx:719, 1645-1663)`；`undo/redo` 只保存 `{nodes}`，**connections 不参与历史** |
| 复制/粘贴节点 | ✅ 系统剪贴板 | `copyNodesToClipboard`/`readClipboardNodes` `(canvasKeyboardHooks.js:252-272)`，接线 `(index.jsx:1597, 1606)` |
| 打组 | ✅ `groupId/groupName` | `createCanvasGroup` `(canvasQuantvExtensions.js:291-299)`，接线 `(index.jsx:1670)` |
| 组内联动拖拽 | ✅ | `expandCanvasDragSelection` `(canvasInteractionModel.js:195-203)` |
| 解组 | ⚠️ 函数存在，接线未确认 | `dissolveCanvasGroup` `(canvasQuantvExtensions.js:302-307)`（在 src 内无其它引用） |
| 对齐/自动排版（多选） | ⚠️ 部分 | `applyMultiSelectionAction` 支持 `align-left/center/right/auto-layout` `(canvasInteractionModel.js:236-259)`，接线 `(index.jsx:3071)`；`group-elements/bind-elements/stitch-details` 有 UI 无执行（与本仓 master-plan G7 一致） |
| 图层 z 序（上移/下移/置顶/置底） | ✅ | `index.jsx:2825-2838` |
| 显示/隐藏 | ✅ | `toggle-visibility` `(index.jsx:2840-2845)` |
| 锁定/解锁 | ✅ | `toggle-lock` `(index.jsx:2844)`；移动时跳过锁定节点 `(canvasState.js:147)` |
| 翻转 | ✅ | `flip-horizontal/vertical` `(index.jsx:2840-2845)` |
| 小地图导航 | ✅ | `src/pages/EcCanvas/components/CanvasMinimap.jsx` |
| **网格吸附** | ❌ 未接线 | `snapToGrid`/`snapNodeToGrid` 已实现 `(canvasQuantvExtensions.js:330-349)`，但全仓无引用 |
| **端口就近吸附** | ❌ 未接线 | `findNearestPort` `(canvasQuantvExtensions.js:662-675)`，全仓无引用 |
| **自动排版（拓扑分层）** | ✅ 已接线 | `autoArrangeCanvasNodes` `(canvasQuantvExtensions.js:353-431)`，接线 `(index.jsx:6055)` |
| 画布导入/导出 JSON | ❌ 未接线 | `exportCanvasToJSON`/`importCanvasFromJSON` `(canvasQuantvExtensions.js:511-553)`，全仓无引用 |
| 批量下载 | ❌ 未接线 | `downloadNodeMediaBatch` `(canvasQuantvExtensions.js:277-286)`，全仓无引用 |
| 便签 sticker | ❌ 部分 | `createCanvasSticker` 未接线 `(canvasQuantvExtensions.js:465-478)`，但渲染组件 `CanvasSticker` 存在 `(src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx:599)` |
| 任务状态机（8 态） | ❌ 未接线 | `TASK_STATUS`/`canTransitionTaskStatus` `(canvasQuantvExtensions.js:167-209)`，全仓无引用 |

> 关键澄清：`src/pages/EcCanvas/components/workflowNodes/index.jsx`（222 行）里的 `CanvasPortHandle/CanvasNodeShell/SmartRemixNodeCard` 等**是旧版实现**；实际渲染走 `components/workflowNodes/modular/*`（`CanvasWorkflowNode.jsx` 转给 modular 版）`(workflowNodes/index.jsx:207-222)`。两套并存 = 一处债。

### 1.4 持久化

| 层 | 存哪 | 存什么 | 证据 |
|---|---|---|---|
| 本地草稿 | `localStorage`，key `sb.canvas.draft.<workId>[.<version>]` | `{nodes, connections, viewport, schemaVersion:2, savedAt}` | `src/pages/EcCanvas/canvasDraftRepository.js:1-33` |
| 云端会话 | SQLite 表 `canvas_sessions` | `snapshot TEXT`（上面那份 JSON）+ `revision` + `expires_at` | `server/projects/schema.mjs:79-93` |
| 画布落盘时对媒体做"稳定化" | — | `durableCanvasValue` 把 `url` 换成 `assetRef.stableUrl`，去掉 `playbackUrl` | `canvasSessionModel.js:28-39` |

- 云端 4 个接口：`POST /api/canvas-sessions`（建）、`GET /api/canvas-sessions/:id`、`POST /api/canvas-sessions/:id/save`、`PATCH /api/canvas-sessions/:id` `(server/projects/projectRoutes.mjs:448-495)`
- 前端封装 `createCanvasSession/saveCanvasSession/loadCanvasSession` `(src/services/projects.js:362-386)`
- 保存/恢复入口 `handleCanvasSessionSave` `(src/pages/EcCanvas/index.jsx:5078-5131)` / `handleCanvasSessionRestore` `(index.jsx:5134-5166)`；保存时**同时**写作品集 `saveWork({..., canvasSessionId})` `(index.jsx:5099-5111)`
- 乐观并发：`expectedRevision` `(projectRoutes.mjs:477)`
- 恢复时会重新解析视频/音频播放地址 `restoreCanvasMediaPlayback` `(canvasSessionModel.js:69-91)`

### 1.5 画布后端接口清单（`/api/canvas/*`）

| 方法 | 路径 | 定义位置 | 认证 |
|---|---|---|---|
| POST | `/api/canvas/regenerate` | `server/index.mjs:4722` | 路由内 |
| POST | `/api/canvas/regenerate/status` | `server/index.mjs:4723` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/transform` | `server/index.mjs:4777` | 路由内 |
| POST | `/api/canvas/regenerate-text` | `server/index.mjs:4925` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/segmentation-plan` | `server/index.mjs:4985` | 路由内 |
| POST | `/api/canvas/analyze-layers` | `server/index.mjs:5035` | 路由内 |
| POST | `/api/canvas/ocr` | `server/index.mjs:5079` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/replace-text` | `server/index.mjs:5124` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/pixel-layers` | `server/index.mjs:5161` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/psd-export` | `server/index.mjs:5198` | `authenticateEcommerceRequest` |
| POST | `/api/canvas/caption` | `server/services/chainService.mjs:486` | `chainService auth` |
| GET/POST | `/api/canvas/feedback/{summary,event,aggregate}` | `server/extensions/canvasFeedback.mjs:209/214/235` | 部分需登录 |

> ⚠️ **死链缺陷**：`canvasActionRegistry.js:168` 指向 `/api/canvas/one-click-video`、`:171` 指向 `/api/canvas/tts`，**这两个路由在后端不存在**（全 server 目录无定义）。真实 TTS 端点是 `/api/tts/synthesize` `(server/services/ttsBridge.mjs:305)` 与 `/api/tts/providers` `(:301)`。前端实际调用的是 `/api/tts/synthesize` `(src/pages/EcCanvas/index.jsx:3998 ← src/services/api.js)`，注册表里的 route 字段是**陈旧元数据**。


---

## 2. AI 能力在画布里的入口（前端动作 → 后端路由 → 计费 SKU）

### 2.1 动作注册表

- 注册表：`CANVAS_ACTIONS`，工厂函数 `action()` 签名 `(id, label, surfaces, priceFeature, requiresPrompt, execute, options)` `(src/pages/EcCanvas/canvasActionRegistry.js:43-58)`；共 **35 条** action `(:60-176)`
- `execute` 字段决定动作怎么跑：`type` ∈ `route | node | composer | inspector | local | focused-editor`，`handler`，`nodeKind` `(:43-58)`
- **注册表里不含快捷键**：19 条快捷键规格在 `CANVAS_SHORTCUTS` `(canvasQuantvExtensions.js:601-621)`；右键菜单在 `(:625-637)` 与 `(:641-655)`
- 分派逻辑在 `handleToolAction`：`handler.startsWith('create:')` → `handleCreateDerivedNode` `(src/pages/EcCanvas/index.jsx:2784-2787)`

### 2.2 逐项能力对照表

| 能力 | 有/无 | 前端入口（文件:行号） | 后端路由 | 计费 SKU |
|---|---|---|---|---|
| 重新生成 | ✅ | `index.jsx:2889`（`regenerate` 动作 `canvasActionRegistry.js:64`） | `POST /api/canvas/regenerate` `(server/index.mjs:4722)` | `ec_image_2k` 1 分 / `ec_image_4k` 2 分 `(server/canvasGenerationService.mjs:543)`、`(server/billing/catalog.mjs:56-57)` |
| 调整生成要求 | ✅ | `canvasActionRegistry.js:61` | 同上 | 同 `ec_image_2k/4k` |
| 变体（variant） | ❌ **无独立实现** | — | — | 多输出靠前端并发 `Promise.allSettled` `(index.jsx:2374-2388)`；服务端不读 count `(server/canvasGenerationService.mjs:102-151)` |
| 抠图 / 去背景 | ✅ 三段式 | `index.jsx:2494` → `executeBrowserSegmentation` `(:2090)` | ① `POST /api/canvas/segmentation-plan` `(index.mjs:4985)` ② 浏览器 u2netp 推理 `(:2121)`、`(canvasSegmentationRuntime.js:36)` ③ `POST /api/remove-bg` `(index.mjs:4342)` | ① `ec_canvas_recognize` 0.2 `(:4994)` ② `ec_remove_bg` 0.5 `(:4367)` → **一次点击实扣 0.7 积分**，但前端只显示 0.5 `(canvasBillingModel.js:5)` |
| 智能分层（图层分析） | ✅ | `index.jsx:2968` → `handleSmartLayerMaterialization` `(:2146)` → `(:2130)` | `POST /api/canvas/analyze-layers` `(index.mjs:5035)` | `ec_smart_layer` 3 `(:5055)`（+ 前置 0.2 = 3.2） |
| 像素分层 | ✅ | `handleWorkflowPixelLayers` `(index.jsx:2590-2618)` | `POST /api/canvas/pixel-layers` `(index.mjs:5161)` | `ec_layer_psd` 3 `(:5181)` |
| PSD 分层导出 | ✅ **真实存在** | `handleWorkflowPsdExport` `(index.jsx:2620-2640)` | `POST /api/canvas/psd-export` `(index.mjs:5198)` | **免费**（`composition/psdExporter.mjs:98,127`） |
| OCR / 文字识别 | ✅ | `handleRecognizeCanvasText` `(index.jsx:2724-2746)`，调用点 `(:2735)` | `POST /api/canvas/ocr` `(index.mjs:5079)` | `ec_canvas_ocr` 0.2 `(:5091)` |
| 文字替换 | ✅ | `index.jsx:4977`（`handleSaveTextLayer`） | `POST /api/canvas/replace-text` `(index.mjs:5124)` | **免费**（纯像素合成） |
| 商品识别（VLM） | ✅ 与抠图共用 | `index.jsx:2114` | `POST /api/canvas/segmentation-plan` `(index.mjs:4985)` → `(server/canvasLayeringService.mjs:211,213)` | `ec_canvas_recognize` 0.2 `(:4994)` |
| 文字重写（文案生成） | ✅ | `handleDerivedTextGeneration` `(index.jsx:3885-3943)` | `POST /api/canvas/regenerate-text` `(index.mjs:4925)` | `ec_ai_assistant` 0.2 `(:4944)` |
| 扩图（outpaint） | ✅ | 动作 `outpaint` `(canvasActionRegistry.js:144-146)` | `POST /api/canvas/transform`（`action:'extend'`）`(index.mjs:4777)`；白名单 `(:4803-4804)`；提示词 `(server/canvasTools.mjs:17,19,18)` | `ec_image_2k`/`ec_image_4k` `(src/services/api.js:1828,1831)` |
| 高清修复（upscale） | ✅ | `canvasActionRegistry.js:153-155` | 同 `/api/canvas/transform` | 同上；`upscale-4k` 走 `ec_image_4k` 2 分 `(canvasBillingModel.js:12)` |
| 图片翻译（translate） | ✅ | `canvasActionRegistry.js:150-152` | 同 `/api/canvas/transform` | 同上 |
| 局部重绘（inpaint） | ⚠️ 有但**派生路径丢选区** | 动作 `inpaint` `(canvasActionRegistry.js:147-149)` | 复用 `/api/canvas/regenerate`；选区处理 `(canvasGenerationService.mjs:52-57, 104-105)` | `ec_image_2k` 1 分 `(canvasBillingModel.js:7)` |
| 图片标注（annotations） | ✅ 纯像素、免费 | 动作 `annotation` `(canvasActionRegistry.js:88-90)` | `/api/canvas/transform` 分支 `(index.mjs:4878-4888)` | 免费 |
| 反推提示词 | ✅ | 动作 `reverse-prompt` `(canvasActionRegistry.js:85-87)`，调用 `(index.jsx:2923)` 与 `(:2333)` | `POST /api/reverse-prompt` `(index.mjs:4291)` | `ec_reverse_prompt` 0.2 `(:4300)` |
| 水印 | ⚠️ **纯前端叠加，后端无路由** | `canvasWatermarkModel.js:307,330,343`，面板 `index.jsx:633-655, 5345-5356` | — | 免费 |
| AI 去水印 | ❌ 不存在 | — | — | — |
| TTS 配音 | ✅（上游 mock） | `handleDerivedTtsGeneration` `(index.jsx:3949-4023)` | `POST /api/tts/synthesize` `(server/services/ttsBridge.mjs:305)`；供应商列表 `(:301)` | 未确认是否真扣费（`ttsBridge.mjs:10` 注释称交上层，未定位 settle 点） |
| 字幕动效 | ✅ | `handleDerivedCaptionGeneration` `(index.jsx:4029-4106)` | `POST /api/canvas/caption` `(server/services/chainService.mjs:486)` | 未确认（caption 记账未定位） |
| 1-click 套图 / 1-click 视频 | ⚠️ 节点已注册，执行**疑似不通** | 动作 `canvasActionRegistry.js:164-169` | 注册表写 `/api/canvas/regenerate` 与 `/api/canvas/one-click-video` | 前者同生图；后者路由不存在 |

### 2.3 这一节的硬缺陷（建议架构师优先处理）

1. **悬空路由**：`canvasActionRegistry.js:168` 指向 `/api/canvas/one-click-video`、`:171` 指向 `/api/canvas/tts`，**server 全仓 0 命中**。之所以没暴雷，是因为前端**从不读 `execute.route`**（全 EcCanvas 只有 `index.jsx:2784` 读 `handler` 前缀）——注册表里的 route 是纯装饰性元数据。
2. **价格显示与实际扣费不一致**：`canvasActionRegistry.js:76` 的 `priceFeature` 写的是 `'layers'`，而 `canvasBillingModel.js:2-16` 里的键叫 `'layer-edit'` → 查表落空、回落到 FREE → **UI 显示"免费"，后端实收 3 积分**。（两份文件我都读过，键名确实对不上。）
3. **一次操作扣两个 SKU 但只展示一个**：抠图 0.2 + 0.5 = 0.7，UI 只显示 0.5 `(canvasBillingModel.js:5)`；智能分层 0.2 + 3 = 3.2。
4. **静态推断（未实跑验证）**：`application-1click-suite/-video` 点"开始处理"会走到 `transformCanvasImage` `(index.jsx:2506)`，而服务端白名单不含 `application-*` `(index.mjs:4805-4806)` → 预计 400。**这条未实跑，仅静态推断。**
5. **无 SSE**：画布异步是"同步阻塞提交 + HTTP 轮询"，全仓 grep `EventSource` 0 命中。轮询在 `src/services/api.js:1731`（180 次上限、退避 `:1748`），后端 `server/canvasGenerationService.mjs:452,581`。
6. **缺门禁**：`regenerate-text` / `caption` 不在 `server/generationRouteGuard.mjs:1-25` 与 `index.mjs:634-659` 的 beta 门禁名单里（无灰度、无限流）。

### 2.4 画布生成任务的异步机制

- 提交：同步阻塞 `(server/canvasGenerationService.mjs:257)`，幂等键 `requestId = canvas_<sha256>` `(:148)`
- 落库表：`canvas_generation_jobs` `(server/canvasGenerationStore.mjs:3, 47-65)`，租约 30s `(:35)`，心跳 `(canvasGenerationService.mjs:213-249)`
- 状态机：`queued → submitted → completed/failed` `(canvasGenerationStore.mjs:53, 191, 205, 220)`
- 查询：`POST /api/canvas/regenerate/status` `(index.mjs:4723)`，返回 200/202(`retryAfter:2`)/404 `(canvasGenerationService.mjs:452, 581)`；错误码 `(:486-512)`

## 3. 视频工作台（VideoStudio）

### 3.1 前端构成

主入口 `src/pages/VideoStudio/index.jsx`（`VideoStudioPage :201`，注册于 `App.jsx:24, 320`）。三个界面并存：

| 界面 | 文件 | 状态 |
|---|---|---|
| 节点画布工作台（默认） | `src/pages/VideoStudio/VideoCanvasWorkbench.jsx`（1852 行） | 默认 |
| 旧瀑布流工作台（回退） | `src/pages/VideoStudio/VideoProjectWorkbench.jsx`（1678 行） | 由 `index.jsx:940-962` 开关切换 |
| 导演台 | `src/pages/VideoStudio/DirectorWorkbench.jsx`（338 行） | `index.jsx:939` |

现有能力：三模式 `(videoStudioModel.js:1-5)`；多素材上传/续传 `(index.jsx:405-442)`，上限 9 个 `(:497)`；方案分析 1 积分 `(:605-662)`（探针 `videoAssetAnalysis.js:89-110`）；提交生成 `(:547-600)` + 5 秒轮询 `(:531-545)`；预览/历史 `(:925-938)`。

### 3.2 它已经是"节点画布"（但与 EcCanvas 是两套）

- 自研 DOM 无限画布：舞台 `(VideoCanvasWorkbench.jsx:1361-1374)`、节点 `(:1384-1489)`、SVG 连线 `(:1377-1382)`
- **只有 3 类节点**：`asset` / `shot` / `candidate`，id 规则 `(videoCanvasModel.js:38-48)`，字段与构建 `buildCanvasNodes (:57-140)`，尺寸表 `(:28-32)`
- **端口是纯视觉 4 角标，不可拖拽连线** `(VideoCanvasWorkbench.jsx:1394-1399)` —— 与 EcCanvas 的真端口有本质差别
- 连线结构 `buildCanvasEdges (:365-404)`：三类关系 `continuation / 绑定 / 首尾帧`，字段 `{id, from, to, kind, label}`；样式 `(videoCanvasFlowModel.js:9-14)`
- React Flow 是一条**旁路实验**：状态存 localStorage 键 `shubao_flow_canvas` `(:229, :1375)`，转换 `(:20-62)`、合法性校验 `(:64-80)`、拖线落库 `(VideoCanvasFlowCanvas.jsx:63-73)` → `(VideoCanvasWorkbench.jsx:259-271)`

### 3.3 分镜（storyboard shot）数据结构

权威表 `video_storyboard_shots` `(server/videoWorkbenchStore.mjs:696-704)`，字段：
`position / purpose / duration_ms / prompt / direction_json / status / selected_candidate_id / first_frame_ref / last_frame_ref / model_intent / revision`。
读模型 `shotFromRow (:471-493)`；`direction` 子结构 `(server/videoShotDirection.mjs:49-69)`。

### 3.4 后端路由

- `server/videoWorkbenchRoutes.mjs` 共 **50 条** `/api/video/projects/:projectId/workbench/...`（`:273` → `:780`，无 router 前缀，直接挂 app）；planning 模式会拦截 export-job 写操作 `(:260-264)`
- 另有 10 条视频生成 API：`server/index.mjs:4490 / 4504 / 4551 / 4571 / 4577 / 4580 / 4585 / 4595 / 4615 / 4618`
- ⚠️ **`/api/workbench` 路径全仓零命中**（对外只有 `/api/video/...`）

### 3.5 生成链路

`videoGeneration.mjs`(1590 行) 编排 ／ `videoProviders.mjs` 适配 ／ `videoModelRouter.mjs` **纯推荐函数**（唯一生产调用点 `videoWorkbenchPlan.mjs:170`；实际下单用的是客户端传来的 `productId` `videoGeneration.mjs:1037` → 路由决策不生效）／ `videoQueue.mjs` 队列。

- 仅 3 个产品：seedance `(server/videoCatalog.mjs:20, 40)` + minimax `(:60)`（`public:false`）
- 真实上游 `api-new.ip233.com/v1` `(server/videoProviders.mjs:148)`
- **无 webhook，全靠 5 秒轮询** `(server/videoGeneration.mjs:966-967)`，默认 5000ms `(:194)`（短路了 catalog 的 10000）
- 计费：`createHold (:1120-1135)` → `settleItem (:712-729)` → 失败 `releaseHeldJob (:832-860)`

### 3.6 导出

- 契约：`mp4/webm` + `720p/1080p/4k` + `24-60fps` + cue `(server/videoExportManifest.mjs:3-5, 69-82)`；**无 srt / 无 zip / 无水印**
- ffmpeg 渲染真代码在 `(server/videoExportRender.mjs:32)`，但**写死 10 秒 mp4 并忽略 format** `(:13, :27)`
- ⚠️ `server/videoRendererWorker.mjs`（`:73, :211, :338`）在 `server/index.mjs` **0 引用 → 生产未接线**（前端自己也承认 `VideoCanvasWorkbench.jsx:1690`）
- `server/videoExportWebhooks.mjs:3-4` 只有队列，没有投递实现

### 3.7 与 EcCanvas 的打通程度：**前端通了，后端没通**

- ✅ 前端投递链路：`(src/pages/EcCanvas/index.jsx:90-93)` 导入 → `(:4739-4744)` 选择 → `(:6147-6150)` 弹窗；协议 `(src/pages/VideoStudio/videoDeliveryModel.js:5-76)`；执行 `(VideoProjectDeliveryDialog.jsx:101-149)`；接收 `(VideoCanvasWorkbench.jsx:316-317, 1298-1306)`；反向回跳 `(EcCanvas/index.jsx:664-690, :931)`
- ❌ 后端不通：6 个 workbench 后端文件 grep `canvas` **全 0 命中**；`videoWorkbenchStore.mjs:2617-2618` 甚至硬写 `canvas_snapshot_id = NULL`
- ⚠️ 容易误认：`server/videoProjectBridge.mjs` 是"生成 job → 项目存储"的桥，**不是画布桥**

### 3.8 视频计费 SKU

`video_seedance_fast_short/long` `(server/billing/catalog.mjs:77, 83)` 27 分；`standard_short/long` `(:91, :98)` 46 / 57 分；`video_seedance_1080p` `(:105)` 未上架；`minimax_h3_2k_short/long` `(:110, :118)` 未上架；`video_plan_analysis` `(:123)` 1 分。导出不计费 `(videoExportJob.mjs:133)`。

---

## 4. 素材库 / 作品集

### 4.1 模块职责

| 模块 | 职责 | 证据 |
|---|---|---|
| `server/generatedAssets.mjs` | 生成图稳定存储工厂 `createGeneratedAssetStore` | `:64`；文件名 = `sha256(buffer)`+扩展名 `:31-33`；只收 jpeg/png/webp `:16-20`；上限 15MB `:5` |
| `server/imageDelivery.mjs` | 派生图 + 外链代理；变体 `w320/640/960/1600` | `:8-13`；别名 `thumb→w640` `:14`；版本 v3 `:7`；派生目录 `generated-assets/.derivatives` `:165` |
| `server/worksRoutes.mjs` | 作品集 CRUD | `GET /api/works :37`、`/api/trash :38`、`POST /api/save-work :39`、`/api/delete-work :47`、`/api/restore-work :55`、`/api/migrate-works →410 :63`；挂载 `server/index.mjs:2843` |
| `server/galleryCatalog.mjs` | 14 个内置案例目录常量 | `:1-16`，被 `/api/gallery-prompts (server/index.mjs:2920)`、`/api/gallery-image (:2933)` 消费 |

### 4.2 存储路径

| 目录 | 放什么 | 证据 |
|---|---|---|
| `server/generated-assets/` | 全部生成图 + 上传原图/预览 | `(server/index.mjs:298, :618)` |
| `server/generated-assets/.derivatives/` | 缩略图/变体 | `(server/imageDelivery.mjs:165)` |
| `server/video-assets/` | 分 `input/` 与 `output/` | `(server/videoGeneration.mjs:205-208)` |
| `server/temp_uploads/` | 一次性分析图 | `(server/index.mjs:3794)` |
| `server/uploads/` | **死目录**：磁盘上有 4 个 `ref_*` 文件，但 `server/*.mjs` 无任何读写代码，仅出现在部署排除项 | `(scripts/deploy-production.ps1:459)`；历史写入点未确认 |

### 4.3 数据表

`works` `(server/db.mjs:76-98)`、`tasks (:102)`、`users (:115)`；**素材库权威表 `project_assets`** `(server/projects/schema.mjs:122-148)`（含 `stable_url / content_hash / retention_state / production_state`）；血缘表 `project_asset_lineage (:154-167)`；上传表 `ecommerce_asset_uploads` `(server/ecommerceEngine/assetUpload.mjs:97)`、`ecommerce_asset_records (:109)`；视频 `video_assets` `(server/videoGeneration.mjs:210)`。

> ⚠️ **没有 `asset` / `generated_assets` 表——生成图完全不落库**，删除时直接 `unlink` `(server/index.mjs:433-439)`，无法做对账。

### 4.4 上传

| 链路 | 路由 | 限制 / 命名 |
|---|---|---|
| 主链路 | `POST /api/ecommerce/assets` `(server/index.mjs:4482)`，raw 15mb `(:4477-4480)` | 15MB / 40MP / 单边 12000 `(server/ecommerceEngine/assetUpload.mjs:5-7)`；角色白名单 `product|reference|style|proof|person|scene` `(:11)`；幂等键 `sha256('ecommerce-upload-v1'+owner+role+buffer)` `(:335-342)` |
| 视频 | `POST /api/video/assets` `(server/index.mjs:4551)` | image 10M / video 50M / audio 15M `(:4554)`；命名 `randomUUID+ext` `(server/videoGeneration.mjs:473)` |
| 临时 | `POST /api/ec-temp-upload` `(server/index.mjs:4119)` | 最多 15 张 `(:4124)`；命名 `ec_<ts>_<rand>` `(:4131)` |

### 4.5 缩略图（两套并存）

1. **通用派生**：`.derivatives/<sha256>.v3.<variant>.<format>` `(server/imageDelivery.mjs:308)`；对外表现为 URL 参数 `variant + format + v=3` `(:133-138)`；落盘后预热 `(server/index.mjs:299-301)`
2. **电商上传预览**：512px webp 独立入库，`kind='preview'` `(server/ecommerceEngine/assetUpload.mjs:300-320, :371-382)`；前端字段 `previewUrl` `(src/services/api.js:590)`

### 4.6 检索与复用

- 检索：`GET /api/project-assets` `(server/projects/projectRoutes.mjs:252)`，参数 `projectId/projectKind/mediaKind/productionState/query/limit` `(:255-263)`；实现 `listProjectAssetLibrary` `(server/projects/projectStore.mjs:1035)`，硬过滤 `visibleInLibrary (:1054)`，关键字 LIKE 命中 6 个字段 `(:1073-1084)`
- **没有 tags 列**，分类只能靠 `role + metadata_json + production_state` `(src/pages/Works/projectAssetLibraryModel.js:46-51)`
- 复用：服务端只认 `/api/generated-assets/<64hex>.<ext>` 正则 `(server/billing/contentBilling.mjs:8)`；素材库→电商不重传 `projectAssetToEcommerceImage` `(src/services/api.js:652-670)`；作品→素材库 `handleAddWorkToLibrary` `(src/pages/EcCanvas/index.jsx:4714)` → `POST .../assets/:assetId/library` `(server/projects/projectRoutes.mjs:359)`
- 素材库→画布：`importProjectAssetToCanvas` `(src/pages/EcCanvas/canvasSessionModel.js:142-189)`，按 `canvasProjectAssetRefKey` 去重 `(:147-149)`

### 4.7 作品集页面

**没有 `src/pages/Works/index.jsx`** —— "我的作品集"是**画布内的一个 Tab** `(src/pages/EcCanvas/components/CanvasChrome.jsx:64)`，导航映射 `(src/components/layout/creativeDomainNavigation.js:61)`。

### 4.8 溯源（provenance）

- 画布侧四类：`source / generated / derived / composition` `(src/pages/EcCanvas/canvasAssetProvenance.js:1)`，解析函数 `resolveAssetProvenance (:16-24)`
- 视频侧：`verified` 需七个字段齐全，否则降级为 `unverified-legacy` `(server/videoProvenance.mjs:59-64)`

## 5. 技能系统

### 5.1 数据结构

| 类别 | 存哪 | 证据 |
|---|---|---|
| **内置技能** | 代码常量，**不入库** | `(server/skills/skillCatalog.mjs:5-11)`；id 形如 `builtin:image:<key>` `(:65)` |
| ├ 生图风格包 ×5 | `styleSkills.mjs` | `(server/ecommerceEngine/styleSkills.mjs:17-239)` |
| ├ 视频模板 ×2 | `videoSkillTemplates.mjs` | `(server/videoSkillTemplates.mjs:55-119)` |
| └ 画布配方 ×4 | `visualCreationSkills.mjs` | `(server/visualCreationSkills.mjs:16-21)` |
| **用户技能** | 表 `user_skills` | `(server/skills/schema.mjs:23-36)`：`id / owner_email / kind / name / summary / body / params_json / version / status / group_id` |
| **分组** | 表 `skill_groups` | `(:39-49)`；默认 4 组：主图 / 详情图 / 小红书 / 视频 `(:11-16)` |

- 删除 = 归档（软删）`(server/skills/skillStore.mjs:90)`；更新时 `version+1` `(:80)`
- 校验 `(server/skills/skillValidation.mjs)`：长度 40/80/2000 `(:13-19)`；参数键白名单 8 个 `(:21-30)`；7 条越权正则 `(:33-41)` + 否定豁免 `(:44)`

### 5.2 CRUD 路由

挂载点 `(server/index.mjs:915)`（`mountSkillRoutes`），实现在 `server/skills/skillRoutes.mjs`：
`GET /api/skills (:40)`、`GET/POST /api/skill-groups (:53, :59)`、`PATCH/DELETE /api/skill-groups/:id (:70, :82)`、`POST /api/skills (:90)`、`PATCH /api/skills/:id (:101)`、`DELETE /api/skills/:id (:115)`、`GET /api/skills/builtin/:id (:124)`。

### 5.3 注入点（5 条，这是"技能怎么影响生成"的真相）

| # | 场景 | 注入链路 |
|---|---|---|
| 1 | **电商生图**（用户技能） | 前端只取前 2 个 `(src/services/api.js:1179-1188)` → `POST /api/generate-ecommerce (server/index.mjs:4434)` → payload 整个 body `(server/ecommerceEngine/orchestrator.mjs:2476)` → `compileAssetRequest (:1409)` → 二次过滤越权/超长 `normalizeUserSkills (promptCompiler.mjs:614-631)` → 拼进 `sections.userSkill (:781-786)` → **段序排最后 = 最低优先级** `(promptAssembler.mjs:311)` |
| 2 | **电商内置风格包** | `[CAMPAIGN STYLE LOCK] (promptAssembler.mjs:119-122)` + `[ROLE OVERRIDE] (:131-137)`，默认 `premium_minimal (:96)` |
| 3 | **视频方案分析** | `POST /api/video/plans (server/index.mjs:4504)` → `buildVideoPlanningRequest (server/videoPlanning.mjs:101)` → 注入 userPrompt 末段 `(:128-133)`，上限 2 个 `(:83)` |
| 4 | **画布生成** | `normalizeRequest` 归一 `skillId (server/canvasGenerationService.mjs:108-111)` → `buildCanvasGenerationPrompt (server/visualCreationSkills.mjs:23-49)`，调用点 `(canvasGenerationService.mjs:351)` |
| 5 | **视频 SkillRun** | `buildSkillRunSpecFromTemplate (videoSkillTemplates.mjs:137)` → `normalizeSkillRunSpec (videoSkillRun.mjs:80)`；路由 `(server/videoWorkbenchRoutes.mjs:737, 747, 754, 762)`；落库 `video_skill_runs (videoWorkbenchStore.mjs:816)`——**结构化，不进提示词** |

### 5.4 前端 UI 与计费

- 主入口 `src/pages/Home/ec/SkillLibraryModal.jsx`（328 行；内置列 `:167-197`、我的 `:199-221`、编辑器 `:223-323`、保存 `:70-91`）；客户端 `src/services/skills.js:37-79`
- 挂载点：`EcommerceWorkbench.jsx:396`、`VideoStudio/index.jsx:873`、`MemberCenterModal.jsx:162`
- **技能本身不计费**：`server/billing` 全目录 grep `skill` = 0 命中；技能路由只做登录鉴权、**无 feature 门禁** `(server/index.mjs:917-922)`（对比视频侧才有 `authenticateFeatureRequest('video_generation')` `(server/index.mjs:4476)`）。计费发生在生成侧。

### 5.5 技能系统的债

- **"最多 2 个技能"硬编码三处**：`(src/services/api.js:1181)`、`(server/ecommerceEngine/promptCompiler.mjs:610)`、`(server/videoPlanning.mjs:83)`
- 越权过滤是**纯正则**，绕过强度未评估 `(server/skills/skillValidation.mjs:33-41)`

---

## 6. 计费体系

### 6.1 钱包与生命周期

服务工厂 `createWalletService(db, { isUnlimited, now })` `(server/billing/walletService.mjs:395)`，对外 API `(:1485-1545)`：

| 方法 | 行号 | 语义 |
|---|---|---|
| `grant` | `:1486`（事务 `:852`） | 发分（充值/赠送） |
| `revoke` | `:1490` | 回收 |
| `getBalance` / `getBalanceWithExpiry` | `:1494`（`balanceFor :1471`）/ `:1501` | 查余额 |
| `createHold` | `:1517`（事务 `:1000`） | **available → held**（`:1030-1039`） |
| `settleItem` | `:1525`（`:1096`） | held 实扣 + 写 `usage_events` `(:1123-1135, 1200-1220)` |
| `releaseItem` / `releaseRemainder` | `:1529`（`:1262`）/ `:1533` | 退回 available |
| `listLedger` | `:1537` | 台账 |

- 余额不足抛 `BILLING_INSUFFICIENT_CREDITS`，HTTP 402 `(:384)`
- 幂等：`existingMutation` `(:618)`；过期批次重算 `reconcileExpiredLots (:680)`
- **账款口径钉死**：`unitRevenue = 199/760000` `(:825-827)`
- 表结构共 **10 张**：`(server/billing/schema.mjs:7-129)` —— `wallets 7-15`、`wallet_ledger 16-30`、`credit_lots 31-42`、`billing_holds 43-57`、`hold_items 58-67`、`usage_events 68-89`、`billing_catalog 90-97`、`payment_orders 98-114`、`processed_provider_events 115-120`、`work_regeneration_entitlements 121-129`

### 6.2 SKU 目录（`server/billing/catalog.mjs` 全量）

单位换算：**1 积分 = 1000 units** `(server/billing/unitEconomicsCatalog.mjs:4)`。

**PRODUCTS（10 条，充值/套餐）** `(catalog.mjs:24-50)`：

| SKU | 价格 | 到账 | 行号 |
|---|---|---|---|
| `ec_trial_990` | ¥9.9 | 30 积分 | `:25` |
| `ec_starter_29` | ¥29 | 105 积分 | `:26` |
| `ec_growth_79` | ¥79 | 295 积分 | `:27` |
| `ec_studio_199` | ¥199 | 760 积分（**面值锚**） | `:28` |
| `ec_monthpack_39` | ¥39 | 175 分（基础 150 + 赠 25，30 天） | `:36-39` |
| `ec_monthpack_59` | ¥59 | 270 分（基础 230 + 赠 40，30 天） | `:40-43` |
| `xhs_entry_19` | ¥19 | 3 套（content_sets，30 天，regen/work 5） | `:44` |
| `xhs_growth_49` | ¥49 | 10 套（regen/work 8） | `:45` |
| `xhs_creator_99` | ¥99 | 25 套（regen/work 15） | `:46` |
| `xhs_studio_199` | ¥199 | 50 套（regen/work 30） | `:49` |

**FEATURE_SKUS（32 条，按能力计费）** `(catalog.mjs:52-144)`：

| SKU | units | 折合积分 | 上游成本 CNY | 行号 |
|---|---|---|---|---|
| `ec_image_2k` | 1000 | 1 | 0.038 | `:56` |
| `ec_image_4k` | 2000 | 2 | 0.038 | `:57` |
| `ec_nano_flash_1k` | 1000 | 1 | 0.06 | `:58` |
| `ec_nano_flash_2k` | 1500 | 1.5 | 0.06 | `:62` |
| `ec_nano_flash_4k` | 2000 | 2 | 0.06 | `:63` |
| `ec_nano_pro_1k` | 1000 | 1 | 0.06 | `:64` |
| `ec_nano_pro_2k` | 1500 | 1.5 | 0.06 | `:65` |
| `ec_nano_pro_4k` | 2000 | 2 | 0.06 | `:66` |
| `video_seedance_fast_short` | 27000 | 27（¥6.9） | 5.07 | `:77-82` |
| `video_seedance_fast_long` | 27000 | 27（¥6.9） | 5.07 | `:83-88` |
| `video_seedance_standard_short` | 46000 | 46（¥11.9） | 5.07 | `:91-95` |
| `video_seedance_standard_long` | 57000 | 57（¥14.9，含 1 次免费重跑） | 5.07 | `:98-102` |
| `video_seedance_1080p` | 73000 | 73（¥18.9）**public:false** | 6.37 | `:105-109` |
| `video_minimax_h3_2k_short` | 57000 | 57（¥14.9）**public:false** | 0.76 | `:110-114` |
| `video_minimax_h3_2k_long` | 57000 | 57（¥16.9）**public:false** | 0.76 | `:118-122` |
| `video_plan_analysis` | 1000 | 1 | 0.05 | `:123` |
| `xhs_image_set_2k` | 9000 | 9（1 套 = 封面 + 8 图） | 0.342 | `:126` |
| `ec_ai_assistant` | 200 | 0.2 | 0.01 | `:127` |
| `ec_extension_analysis` | 1500 | 1.5 | 0.09 | `:128` |
| `ec_extension_basic` | 3000 | 3 | 0.114 | `:129` |
| `ec_extension_standard` | 5000 | 5 | 0.19 | `:130` |
| `ec_extension_complete` | 9000 | 9 | 0.342 | `:131` |
| `ec_reverse_prompt` | 200 | 0.2 | 0.01 | `:132` |
| `ec_canvas_ocr` | 200 | 0.2 | 0.01 | `:133` |
| `ec_remove_bg` | 500 | 0.5 | 0.03 | `:134` |
| `ec_direction_refresh` | 1000 | 1 | 0.05 | `:135` |
| `ec_direction_analysis` | 1000 | 1 | 0.05 | `:138` |
| `ec_canvas_recognize` | 200 | 0.2 | 0.01 | `:139` |
| `ec_preview_cover` | 500 | 0.5 | 0.038 | `:140` |
| `ec_smart_layer` | 3000 | 3 | 0.20 | `:141` |
| `ec_layer_psd` | 3000 | 3 | 0.20 | `:142` |
| `content_full_set` | 1 | 1 套 | — | `:143`（currency `content_sets`） |

启动期 **fail-closed 毛利门禁** `assertCatalogMarginGates` `(catalog.mjs:310-335)`。

### 6.3 四个计费模块

| 模块 | 作用 | 证据 |
|---|---|---|
| `quoteService.mjs` | 签发 **HMAC 报价令牌** `bq1`，TTL 10 分钟；校验 sku/quantity/units/totalUnits/currency 5 个字段 | `:92`；字段校验 `:6-12, :167` |
| `oneShotBilling.mjs` | 画布一次性动作：`execute (:203)` → `executeOnce (:76)`：**租约 + 验价(:88) + hold(:122) + 干活 + settle(:157)**，失败自动 release(`:184-194`) | `:44` |
| `videoMeter.mjs` | **纯报价，不扣费**；唯一调用方是只读的 `GET /api/billing/video-meter` | `:134`；`(server/billing/routes.mjs:352-359, 401)` |
| `contentBilling.mjs` | 内容生成状态机 | `:817`；`holdSet (:1007)` / `completeSet (:1198)` / `failSet (:1104)` |

### 6.4 计费点 ↔ 路由对应表（`server/index.mjs` 行号）

| 路由 | 路由行 | 计费行 | SKU |
|---|---|---|---|
| `POST /api/regenerate-image` | `:2343` | `:2360` | `ec_image_2k` / `ec_image_4k` |
| `POST /api/regenerate-text` | `:2381` | `:2389` | `ec_ai_assistant` |
| `POST /api/analyze` | `:2707` | `:2715` | `ec_ai_assistant` |
| `POST /api/extract-product-link` | `:3293` | `:3304` | `ec_ai_assistant` |
| `POST /api/auto-recognize` | `:3724` | `:3734` | `ec_ai_assistant` |
| `POST /api/polish-ec-text` | `:4259` | `:4271` | `ec_ai_assistant` |
| `POST /api/design-directions` | `:4177` | `:4186`（refresh）/ `:4210`（analysis） | `ec_direction_refresh` / `ec_direction_analysis` |
| `POST /api/reverse-prompt` | `:4291` | `:4300` | `ec_reverse_prompt` |
| `POST /api/remove-bg` | `:4342` | `:4367` | `ec_remove_bg` |
| `POST /api/canvas/regenerate` | `:4722` | `(server/canvasGenerationService.mjs:543)` | `ec_image_2k/4k`（按 creationIntent 分流 `:544-551`） |
| `POST /api/canvas/transform` | `:4777` | `:4896` | `ec_image_2k/4k` |
| `POST /api/canvas/regenerate-text` | `:4925` | `:4944` | `ec_ai_assistant` |
| `POST /api/canvas/segmentation-plan` | `:4985` | `:4994` | `ec_canvas_recognize` |
| `POST /api/canvas/analyze-layers` | `:5035` | `:5055` | `ec_smart_layer` |
| `POST /api/canvas/ocr` | `:5079` | `:5091` | `ec_canvas_ocr` |
| `POST /api/canvas/pixel-layers` | `:5161` | `:5181` | `ec_layer_psd` |
| `POST /api/canvas/psd-export` | `:5198` | — | **免费** |
| `POST /api/generate` | `:2667` | `:2486` / `:5257` | 预览 `ec_preview_cover`；全量 `xhs_image_set_2k` |
| `POST /api/plog-generate` | `:5450` | 同上 | 同上 |
| `POST /api/video/plans` | `:4504` | `:4529` | `video_plan_analysis` |
| `POST /api/video/jobs` | `:4595` | hold `(server/videoGeneration.mjs:1120)`、settle `(:713)` | `videoFeatureSku` `(server/videoCatalog.mjs:85-92)` |
| `POST /api/generate-ecommerce` | `:4434` | `(server/ecommerceEngine/ecommerceBilling.mjs:35-42)` | 逐图 `ec_image_2k/4k` |
| `POST /api/extension/*` | `(server/extensionRoutes.mjs:620, 653)` | `:624` / `:652` | `ec_extension_*` |

### 6.5 前端计费入口

`src/services/billing.js:31 quoteBillingAction`、`:27` 余额、`:143` 交易记录；`src/services/api.js:792 quoteCanvasAction`（SKU 调用点 `:811/823/844/869/972/996/1418/1506/1557/1600/1621/1863/1921`）；全局余额 `(src/store/AppContext.jsx:283)`；弹窗 `InsufficientBalanceModal.jsx:58`。

### 6.6 额度 / 套餐 / 支付

- `fastDailyLimit.mjs`：每日 2 次限额实现 `(:19)`、判定 `checkFastDailyLimit (:66)` —— **全仓无生产调用点（死代码）**，而 catalog 里写的是 3 次 `(catalog.mjs:81, 87)`
- 套图重跑权益：`regenPerWork` `(server/billing/contentEntitlements.mjs:556-562)`，三态 `:671-783`
- 支付墙白名单 6 个 SKU `(server/billing/paywall.mjs:45-52)`；sandbox 渠道 `(:41)`；入账 `(server/billing/paymentService.mjs:495-509)`

### 6.7 计费体系的真缺陷（已核实）

1. **`server/billing/checkin.mjs` 文件损坏**：整个文件被写成**字面量 `\n` 转义字符**而不是真实换行，只剩 2 行、代码被截断 —— 模块根本无法解析。👈 **我亲自 read 过该文件确认**（`(server/billing/checkin.mjs:1-2)`）
2. **`dailyCheckin` 未 import**：`server/index.mjs:2675` 调用 `dailyCheckin({ ownerEmail })`，但 `server` 全目录 grep `dailyCheckin` 只有这一处定义外的引用，**没有任何 import** → 命中必 ReferenceError。👈 **我亲自 grep 确认**
3. **签到路由被嵌在 `/api/generate` 的 handler 内部**：`app.post('/api/billing/checkin', ...)` 写在 `app.post('/api/generate', ...)` 的函数体里 `(server/index.mjs:2667-2680)` → 首次请求 `/api/generate` 之后才注册，且每次请求重复注册。👈 **我亲自 read 确认**
4. **任意 SKU 可报价**：`server/billing/routes.mjs:298-305` 对入参 sku 直接报价，`public:false` 的 `video_seedance_1080p` / `h3_2k_*` 也能拿到报价令牌
5. **`ec_canvas_recognize` 覆盖面不全**：只出现在 3 处 `(server/index.mjs:4994)`、`(catalog.mjs:139)`、`(billingLabels.mjs:50)`，缺 `adminOperations.mjs:57-83`、`xcardWhitelist.mjs:22-24`、`upstreamLedger.mjs:72,79` → 后台成本看板/白名单/上游台账看不到这个 SKU
6. **content 币种默认值未确认**：`contentBillingConfig.mjs:35-51` 默认 `content_sets`，`server/index.mjs:282` 未覆盖 —— 生产实际取值**未确认**

## 7. 其他与创作生态相关的既有能力

### 7.1 电商套图流水线（ecommerceEngine）

- 入口 `server/ecommerceEngine/index.mjs:53-123` 是**纯 barrel**（只做 re-export）
- ⚠️ 教科书式的 v4 五阶段 `runPipeline` `(server/ecommerceEngine/pipeline.mjs:47)` **是死代码**：它只在 barrel 里被 re-export `(server/ecommerceEngine/index.mjs:122)`，**全仓没有任何调用方**；且自带一条绕过 provider 适配层的 `callImageGen` `(pipeline.mjs:248)`
- **现役是 8 阶段**：`createEcommerceOrchestrator (:935)` → `executeJob (:1932)` → `runAsset (:1361)`
  1. 建单 `:1108` ｜ 2. 视觉分析 `:2019` ｜ 3. 策略 `:2034, :2039` ｜ 4. Prompt `:1402`（`promptCompiler.mjs:633`）｜ 5. 生成 `:1482, :1507` ｜ 6. 质检 `:1543`（`qualityGate.mjs:420`）｜ 7. 修复 `:1653`（`repairPlanner.mjs:67`）、`:1724` ｜ 8. 结算 `:2103, :1911`。**导出是独立的第 9 步 HTTP**
- ⚠️ **修复阶段名存实亡**：provider 二次修复被硬关闭 `(orchestrator.mjs:1759-1772)`，只剩确定性本地修复，且每资产限 1 次 `(:1655)`
- **三层状态机**：父任务 7 态 `(server/generationJobs.mjs:5)` → 资产 13 态 `(jobStore.mjs:3-17, 22-39)` → 扩展 8 态 `(server/extensionTaskManager.mjs:39-48)`
- **资产层是唯一有完整租约的**：CAS `WHERE lease_token=? AND state=?` `(jobStore.mjs:243-250)`，租约 30s `(:164)`，表 `ecommerce_job_assets (:176-195)`；父表 `ecommerce_jobs (generationJobs.mjs:87)`；库 `server/works.db (server/index.mjs:429)`
- 恢复：`resumeJobs (orchestrator.mjs:2358)` + 每 120s sweep `(server/index.mjs:5519)`

**前端入口**：**6 个页面共用同一个 `POST /api/generate-ecommerce`** `(server/index.mjs:4434)`，主驱动是 `src/pages/EcCanvas/index.jsx:3681`，其余 `EcStudio/index.jsx:316`、`Home/ec/DesignDirection.jsx:601`、`Home/XhsContentMode.jsx:707`、`Home/EcLegacyForm.jsx:152`。画布路径是 **3 步**（门禁 `EcCanvas/index.jsx:3613` → 取方案 `:3616` → 生成 `:3681`）。认证 `(server/index.mjs:4444)`；`/api/ecommerce/exports` **只有 POST 没有状态查询** `(:4483)`。

### 7.2 Provider 适配层（**这是最值得复用的底座**）

四层抽象：

```
modelCatalog.mjs:106  buildModelRoute    模型 → provider 决策
   ↓
modelProviderRouter.mjs:21               跨协议分发（按 modelRoute.provider）
   ↓
providerAdapter.mjs:295                  OpenAI 风格通用工厂（protocol: legacy-edits | native-tasks, :318-321）
nanoBananaProviderAdapter.mjs:51         Gemini 协议专用
   ↓
providerRouter.mjs:29                    同协议内 primary / overflow / legacy
```

统一契约：`submitEdit / poll / pollUntilReady` 三个方法 `(server/ecommerceEngine/modelProviderRouter.mjs:1-6)`。

- ✅ `modelProviderRouter` 按 `provider` 字段泛化分发，**新增模型不用改它** `(:24-25)`
- ⚠️ **但新增一个模型要改 12 处、跨 8 个文件**：`modelCatalog.mjs:8-13, 75, 109-111`、`nanoBananaProviderAdapter.mjs:55, 78, 147`、`server/index.mjs:1051-1054, 4038-4045`、`billing/catalog.mjs:64-66`、`billingLabels.mjs:38-40`、`upstreamLedger.mjs:90`、`ecommerceBilling.mjs:39-41`、`src/services/imageModelCatalog.js:1-17, 32-47`
- ⚠️ **计费散落 5 个文件，没有单一事实源**
- ❌ **最大缺口：底座只被电商套图 + 画布复用** `(server/index.mjs:4063-4070, 4089)`；**小红书 / Plog 走的是老路径** `generateImage (server/index.mjs:2607)` / `callImageAPI (:5389)`，**根本没接进底座**

### 7.3 小红书 / Plog

- ⚠️ **不存在 `/api/xhs` 路由**。小红书 = `POST /api/generate` `(server/index.mjs:2667)` → `generateXhsContentSet (:2524)`，**6 步 SSE**（`content_analysis :2526` / `vision :2535` / `creative_plan :2576` / `visual_planning :2578` / `generating_images :2602` / `assembling :2625`）—— 这是**全仓唯一用 SSE 的创作链路**
- Plog = `POST /api/plog-generate` `(:5450)` → `generatePlogContentSet (:5303)`，**4 步**（`scene :5318` / `lens :5322` / `tone :5343` / `generating :5368`）
- 策划契约 `(server/xhsCreativePlanner.mjs:8, 51, 126)`；prompt 引擎 `(server/plogPromptEngine.mjs:392)`
- 前端两入口：`src/pages/Plog/index.jsx:65`（路由 `src/App.jsx:316`）与内嵌 `Home/XhsContentMode.jsx:991`
- **9 图硬约束** `(server/billing/contentEntitlements.mjs:115-127)`
- 死导出 3 处：`xhsCreativePlanner.mjs:233, 253`、`plogPromptEngine.mjs:428`

### 7.4 插件 / 扩展

- 形态：**Chrome / Edge MV3 浏览器插件** `(shubao-extension/manifest.json:2-4)`；服务端挂载 `server/index.mjs:5231`（`mountExtRoutes`）
- 通信：**纯 HTTP 两段式，无 WS / SSE / long-poll** —— 插件 `POST /api/extension/collect` 一次 `(server/extensionRoutes.mjs:580)` 后只做跳转 `(bg-wrapper.js:43-45)`，**轮询发生在前端页面** `(src/pages/Remake/index.jsx:28-30, 124)`
- 接口：4 条 + 旧 bookmarklet 2 条 `(server/index.mjs:3501, 3528)`；文件里还藏着**一份从未挂载的死 router** `(extensionRoutes.mjs:573)`
- 任务 8 态、产物落 `server/extension_tasks/*.json` `(extensionTaskManager.mjs:13, 39-48)`
- ⚠️ **无 worker claim**：`getNextPendingTask (:118)` 全仓无调用点；**`collect` 无鉴权无限流** `(:580)`；task 查询也无鉴权 `(:597)`
- ⚠️ 分发的是 **3.3.0 旧插件** `(src/pages/EcStudio/index.jsx:592)`，与主线脱节；插件写死 `localhost:3099` `(bg-wrapper.js:8)` 而后端默认 3001 `(server/index.mjs:1001)`

### 7.5 任务队列 / 并发控制（**4 套互不相干**，全手写，无 `p-limit` 依赖）

| 队列 | 实现 | 并发上限 | 持久化 | 证据 |
|---|---|---|---|---|
| 图片生成池 | `createImageGenerationPool` | 默认 3 / 队列上限 240 | ❌ **纯内存，重启即丢** | `(server/imageGenerationPool.mjs:7, 70-73)`，env `IMAGE_GENERATION_CONCURRENCY` |
| 视频队列 | `createOwnerFairVideoQueue`（按 owner 公平轮转） | 默认 2 | ❌ 内存 | `(server/videoQueue.mjs:19-124)`；`(server/videoGeneration.mjs:195)` |
| 电商任务 | **SQLite 抢占式 + 租约** | 资产并发 3（clamp 1-4）、质检并发 1 | ✅ **不丢** | `(generationJobs.mjs:430)`、`(jobStore.mjs:287)`；信号量 `(orchestrator.mjs:1004-1009, 1024-1038)` |
| 扩展任务 | `extensionTaskManager` | **无任何上限** | ✅ JSON 文件 | `(extensionTaskManager.mjs:118)` |

上限几乎全硬编码，仅 `IMAGE_GENERATION_CONCURRENCY` 与 `ECOMMERCE_RECOVERY_SWEEP_MS` 可 env 覆盖。

### 7.6 导出 / 发布

- 电商导出：`exportService.mjs:440` 是 **sharp 单图按平台规格重绘**（格式仅 jpg/png/webp `:19`），**不是 zip**；幂等 `sha256(owner+transformFingerprint)` `(:539-545)`；表 `ecommerce_exports (:102-113)`
- ❌ **前端零调用**：`src/` grep `/api/ecommerce/exports` = **0** —— 接口建好了没人用
- 画布导出：`src/pages/EcCanvas/exportDeliveryModel.js:44` 的"成功"实际是 `download-started`，**无渠道枚举**；写盘 `(browserFileDelivery.js:228)`；另有 PSB/PSD 导出 `(server/index.mjs:5198)`
- 视频导出：ffmpeg 实现在 `(server/videoExportRender.mjs:32)`，**无对外触发入口**（`videoRendererWorker.mjs:267` 只被自己调用）
- ❌ **"一键发布到小红书 / 抖音 / 淘宝"不存在**：相关 grep 命中全是提示词、尺寸表、合规外链（如 `server/ecommerceEngine/platformPolicies.mjs:18, 20`），`server/routes/` 零命中，OAuth 全是自家登录。**真实能力 = 本地下载 + 平台规格导出 + 画布 PSD 导出**

---

## 8. 可复用的底座与限制

### 8.1 可复用底座清单

| 底座 | 位置 | 成熟度 | 备注 |
|---|---|---|---|
| **Provider 适配四层** | `server/ecommerceEngine/{modelCatalog,modelProviderRouter,providerAdapter,nanoBananaProviderAdapter,providerRouter}.mjs` | ★★★★ | 统一 `submitEdit/poll/pollUntilReady`；但只被电商+画布用 |
| **钱包 / hold-settle** | `server/billing/walletService.mjs` | ★★★★★ | 事务化、幂等、租约、过期批次、台账齐全 |
| **报价令牌** | `server/billing/quoteService.mjs:92` | ★★★★ | HMAC `bq1`，TTL 10min，5 字段校验 |
| **一次性动作计费** | `server/billing/oneShotBilling.mjs:44` | ★★★★ | 验价 → hold → 干活 → settle，失败自动 release |
| **项目 / 版本 / 会话** | `server/projects/{projectStore,projectRoutes,schema}.mjs` | ★★★★ | `projects / project_versions / canvas_sessions / project_assets / project_asset_lineage` |
| **素材服务** | `server/generatedAssets.mjs` + `server/imageDelivery.mjs` | ★★★★ | 内容寻址（sha256）+ 变体派生 + 外链代理 |
| **鉴权 / 会话** | `server/auth/authService.mjs`、`server/authSessionSecret.mjs`、`server/accessControl.mjs` | ★★★★ | OAuth + 邮箱验证码 + 双模式 token |
| **SSE 流** | 前端 `src/services/sse.js:1-33` `consumeSseJson`；后端见 `/api/generate` 6 步流 | ★★★ | **只有小红书/Plog 用了**；画布/视频都不是 SSE |
| **任务状态机** | `server/ecommerceEngine/jobStore.mjs`（13 态 + CAS 租约） | ★★★★ | 唯一"不丢任务"的实现，可做图引擎的宿主 |
| **队列** | `imageGenerationPool` / `videoQueue` | ★★ | 内存、重启丢、上限硬编码 |
| **契约测试** | `test/*.test.mjs`（**378 个**，画布相关 ≥60）`npm test` | ★★★★ | `node --test --test-concurrency=1` |
| **验收脚本** | `scripts/verify-*.mjs`（视频 pilot/acceptance/reconciliation）、`scripts/audit-production.mjs` | ★★★ | 视频链路有较完整的验收工具 |
| **中文合规** | `server/components/aiCompliance.mjs`（4.1KB） | ★★★ | AI 生成内容合规水印 |

### 8.2 明显的技术债与痛点（会直接影响"节点化工作流"的可行性）

**A. 结构级**

1. **`server/index.mjs` 5274 行 / 64 条路由**，全部业务路由内联在一个文件里（另外全仓 route 定义约 246 条分散在各 mount 模块）
2. **`src/pages/EcCanvas/index.jsx` 6182 行**，画布的状态、指针、执行、渲染全在一个组件里；所有"执行"逻辑内联在 `useCallback` 中，**没有可独立测试的 runner**
3. **两套节点渲染并存**：`components/workflowNodes/index.jsx`（旧，222 行）与 `components/workflowNodes/modular/*`（新）；前者只是转发 `(workflowNodes/index.jsx:207-222)`
4. **同名文件歧义**：`src/pages/EcCanvas/canvasQuantvExtensions.js`（675 行规格）vs `src/services/canvasQuantvExtensions.js`（36 行、**零引用死代码**，真正的同名函数在 `canvasDerivedPlacement.js:22`）
5. **两套引擎平行**：`ecommerceEngine/orchestrator.mjs`（102.9KB）与 `services/chainService.mjs`（501 行）各管一摊，**没有共享的"步骤"抽象**

**B. 正确性级（已核实，建议立刻修）**

6. **`server/billing/checkin.mjs` 文件损坏**：整个文件是**字面量 `\n`**、只有 2 行、代码截断 → 无法解析（我亲自 read 确认）
7. **`dailyCheckin` 无 import**：`server/index.mjs:2675` 调用，但全 server 目录无 import（我亲自 grep 确认）→ 命中必 500
8. **签到路由嵌在 `/api/generate` handler 内部** `(server/index.mjs:2667-2680)` → 首次请求后才注册且重复注册（我亲自 read 确认）
9. **`VideoCanvasWorkbench.jsx:1818` 调 `handleUpdateAudioVolume`，唯一同名定义在死代码 `:394`**（`:348-412` 被 `:346→:413` 的 `setPositions` IIFE 吞掉）→ 音量滑杆必抛 ReferenceError；活函数其实是 `handleChangeAudioVolume :952`（子代理静态分析，**未实跑**）
10. **画布"智能分层"UI 显示"免费"但实收 3 积分**（`priceFeature:'layers'` vs 计费表键 `'layer-edit'`）；**抠图实收 0.7 只显示 0.5**

**C. 一致性级**

11. **计费 SKU 三处硬编码**：`canvasBillingModel.js:2-16`（10 条）、`canvasQuantvExtensions.js:570-592`（22 条，纯展示估算）、后端 `catalog.mjs`（42 条）—— 三份数据彼此不一致，且没有单一事实源
12. **"最多 2 个技能"硬编码三处** `(src/services/api.js:1181)`、`(promptCompiler.mjs:610)`、`(videoPlanning.mjs:83)`
13. **`fastDailyLimit` 是死代码**（`checkFastDailyLimit` 无调用点 `fastDailyLimit.mjs:66`），而 catalog 却据此写了 3 次限额 `(catalog.mjs:81, 87)` → **成本敞口**
14. **生成图完全不落库**（无 `generated_assets` 表），删除即 `unlink` `(server/index.mjs:433-439)` → 无法对账
15. **画布异步无 SSE**（全仓 `EventSource` 0 命中），只有轮询；而小红书链路已经有 SSE 实现 → **两套异步范式并存**
16. **视频路由决策不生效**：`videoModelRouter` 是纯推荐函数，下单实际用客户端传来的 `productId` `(videoGeneration.mjs:1037)`
17. **`temp_uploads` 两套清理阈值不一致**：24h `(server/index.mjs:1004)` vs 1h `(:4150)`
18. **死导出/死路由若干**：`ecommerceEngine/pipeline.mjs:47 runPipeline`、`extensionRoutes.mjs:573` 未挂载 router、`xhsCreativePlanner.mjs:233,253`、`plogPromptEngine.mjs:428`

### 8.3 这些债对"节点化工作流"的直接影响

| 债 | 对节点化的影响 |
|---|---|
| index.jsx 巨石 + 执行逻辑内联 | 抽"节点执行器"必须先在组件内做外科手术，且 TDZ 风险高（仓库自己记录过：`.superpowers/sdd/2026-09-05-canvas-master-plan.md:145`） |
| 三套计费数据源 | 图级编排要"预估总价→预扣→逐节点结算"，必须先统一 SKU 真源，否则算不准 |
| 内存队列 + 无持久化 | 图执行若走异步，关页面即断；要用图引擎就必须先把任务落到 SQLite（可借鉴 `ecommerceEngine/jobStore.mjs` 的 CAS 租约模式） |
| 两套引擎平行 | 做统一图引擎前必须先决定谁是宿主，否则会变成第三套 |
| 生成图不落库 | 节点产物无法可靠引用与对账，"节点输出 = 资产 ID"这条链路不成立 |
| 无 SSE（画布）+ 有 SSE（小红书） | 图执行进度推送需要先统一异步范式 |
| checkin/dailyCheckin 已坏 | 说明"未接线代码"长期无人发现 → 做新引擎时必须配自动化验收，不能只靠契约测试 |

## 9. 距离"节点图（有向图 + 端口 + 执行引擎）"还差什么

> 这是本报告最重要的一节。结论先说：**薯包画布在"数据结构"上已经是节点图，在"执行语义"上还不是**——边是画出来的，不是跑出来的。

### 9.1 已经具备、可直接复用的部分

| 已有 | 证据 |
|---|---|
| 节点结构 = 标准图节点（id / kind / 位置尺寸 / status / inputs / output / sourceNodeIds） | `(src/pages/EcCanvas/nodeWorkflow.js:83-101)` |
| 边结构 = **带端口的有向边**（fromNodeId/fromPort/toNodeId/toPort/relation） | `(src/pages/EcCanvas/nodeWorkflow.js:103-122)` |
| 端口几何（左入右出，取节点边中点） | `getNodePortCenter` `(src/pages/EcCanvas/canvasGeometry.js:25-33)`；贝塞尔路径 `cubicEdgePath` `(:35-38)` |
| 端口 UI 组件（输出端口带 "+"，输入端口在左侧） | `(src/pages/EcCanvas/components/workflowNodes/modular/CanvasPortHandle.jsx:4-43)`；挂载点 `(src/pages/EcCanvas/components/workflowNodes/index.jsx:62-63)` |
| 拖端口连线交互（拖出 → 落到输入端口建边） | `handlePortPointerDown` `(src/pages/EcCanvas/index.jsx:2055-2067)` / `handlePortPointerUp` `(:2080-2088)` |
| **端口类型系统**（产出类型 × 可接受类型） | `NODE_TYPE_KIND` `(canvasQuantvExtensions.js:21-41)`、`NODE_ACCEPT_TYPES` `(:43-63)`、`isEdgeInvalid` `(:70-82)` |
| 拓扑分层算法（BFS + 入度） | `autoArrangeCanvasNodes` `(canvasQuantvExtensions.js:353-431)` |
| **图驱动数据流的先例**（沿边反向 BFS 找上游文案节点） | `findUpstreamCanvasCopy` `(src/pages/EcCanvas/canvasDerivedAutoRun.js:12-34)` |
| 任务状态机规格（8 态 + 迁移表） | `TASK_STATUS`/`TASK_STATUS_TRANSITIONS`/`canTransitionTaskStatus` `(canvasQuantvExtensions.js:167-209)` |
| 节点卡片按 kind 分派渲染 | `(src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNode.jsx:22-73)` |
| **~20 个已封装的执行原语**（见下表） | `(src/pages/EcCanvas/index.jsx:6)` 的 import 行 + 各调用点 |
| 契约测试基建（378 个测试文件，画布相关 ≥60 个） | `test/canvas-*.test.mjs`、`test/video-canvas-*.test.mjs` |

**可复用的执行原语清单**（都在 `src/services/api.js` 里封装好，可直接被未来的执行器调用）：

`regenerateCanvasImage` `(index.jsx:2374, 2504, 2889, 3502)`、`transformCanvasImage` `(:2506, 2941, 3005, 3515)`、`regenerateCanvasText` `(:3918)`、`synthesizeCanvasTts` `(:3998)`、`synthesizeCanvasCaption` `(:4079)`、`generateEcommerceSuite` `(:3681)`、`analyzeCanvasLayers` `(:2130)`、`removeBg` `(:2131)`、`createCanvasSegmentationPlan`、`recognizeCanvasText` `(:2735)`、`replaceCanvasText` `(:4977)`、`createCanvasPixelLayers` `(:2598)`、`exportCanvasPsd` `(:2627)`、`reversePrompt` `(:2923)`、`stitchLongImage` `(:3150)`、`createVideoJob` `(:3349)`、`executeChainService` `(:4845)`、`quoteBillingAction` `(:3347, 3431)`、`uploadEcommerceAssets` `(:524, 2461)`。

### 9.2 缺的每一块（缺口 → 证据 → 要做什么 → 动哪些文件）

| # | 缺口 | 现状证据 | 要做什么 | 主要涉及文件 |
|---|---|---|---|---|
| **N1** | **没有图执行引擎**（无拓扑排序调度、无就绪判定、无并发/串行编排、无失败传播） | 全仓无 runner；唯一的拓扑代码 `autoArrangeCanvasNodes` 只算布局坐标 `(canvasQuantvExtensions.js:353-431)` | 新增 `canvasGraphEngine.js`：入度计算 → ready 队列 → 逐节点调执行器 → 下游置 dirty；失败只标记该子图 | 新增 `src/pages/EcCanvas/canvasGraphEngine.js`；若走后端则新增 `server/services/graphRunService.mjs` |
| **N2** | **边不传值**：连线只是视觉关系，执行输入取的是节点字段而非入边 | 手拉线固定 `relation:'reference'` `(index.jsx:2065)`；建边后只 toast"已建立素材关系" `(:2083-2087)`，无任何执行；节点执行读 `node.sourceNodeIds[0]` + `node.inputs.sourceUrl` `(:2303-2313, 2348-2349, 2472-2506)` | 定义"边即数据通道"：执行前按入边收集上游 output，写进 `inputs`；relation 决定语义（derived=处理链、reference=素材引用） | `canvasDerivedAutoRun.js`（加 `collectNodeInputsFromEdges`）、`index.jsx`（`handleWorkflowGenerate:2347` / `handleWorkflowProcess:2472`）、`canvasState.js:152-171` |
| **N3** | **端口是节点级的、且每节点只有 1 进 1 出**：没有端口级类型声明，也没有多输入槽 | `CanvasNodeShell` 固定渲染一个左 input、一个右 output `(workflowNodes/index.jsx:62-63)`；`NODE_ACCEPT_TYPES` 是节点级白名单 `(canvasQuantvExtensions.js:43-63)` | action 注册表增加 `inputs:[{id,type,label,required}]` / `outputs:[...]`；端口几何从"取边中点"改为"按槽位索引排布" | `canvasActionRegistry.js:43-176`（`action()` 工厂签名）、`canvasGeometry.js:25-33`、`modular/CanvasPortHandle.jsx`、`modular/CanvasNodeShell.jsx` |
| **N4** | **执行要手点，不是"接线即执行"** | 只有 3 条链做到派生即执行（文案 `index.jsx:3885-3943`、TTS `3949-4023`、字幕 `4029-4106`）；处理节点必须 prompt 非空才跑，否则 toast 提示 `(:2351-2354)` | 在 action 上声明 `autoRun`；引擎对 ready 节点自动触发，UI 只做重试/取消 | `canvasActionRegistry.js`、`index.jsx`（6 个 `handle*Generate/Process/Derived*` 函数） |
| **N5** | **无失效/重跑（stale 传播）**：上游改了，下游不标脏、不能一键刷新整链 | 只有输出指纹 `canvasWorkOutputFingerprint` `(canvasWorkModel.js:237-245)`，无图级失效 | 给节点算 `inputFingerprint`；上游变更 → 沿出边标 `stale`；"一键重跑"按拓扑序重放 | 新增 `src/pages/EcCanvas/canvasGraphInvalidation.js`；`index.jsx` 编辑类 handler（`handleTextNodeChange:4112`、`handleWorkflowAddImages:2451` 等） |
| **N6** | **状态机未落地**：8 态规格没人用，节点只有 6 态，且与后端任务状态无映射 | `TASK_STATUS` 全仓无引用 `(canvasQuantvExtensions.js:167-209)`；节点 6 态 `(workflowNodeViewModel.js:1-8)`；后端另有 canvas 生成状态 `server/canvasGenerationStore.mjs` | 统一成一套状态 + 迁移函数，前端节点状态由后端任务状态派生 | `canvasQuantvExtensions.js`、`workflowNodeViewModel.js`、`server/canvasGenerationStore.mjs`、`server/canvasGenerationService.mjs` |
| **N7** | **撤销/重做不覆盖边与图层** | history 只 `push({nodes})` `(index.jsx:1647, 1651, 1658)`，`createCanvasHistory` 也只接收单值 `(canvasKeyboardHooks.js:211-240)` | 历史单元改为 `{nodes, connections, viewport}`；所有变更点统一走 `commit()` | `canvasKeyboardHooks.js`、`index.jsx:1644-1663` 及所有 `setNodes/setConnections` 调用点 |
| **N8** | **后端没有"提交整图"的端点** | `/api/canvas/*` 全是一次一个动作（见 §1.5），无图级入口；`chainService` 是固定 4 步硬编码流程 `(server/services/chainService.mjs:22-27, 311-412)`，且第 1/2 步是 **mock**（`deriveScript`/`deriveKeyframes` 返回占位数据 `(:71-112)`） | 新增 `POST /api/canvas/graph/run`（收 {nodes, edges, targetNodeIds}），或把 chainService 泛化成通用步骤执行器 | `server/index.mjs`（路由挂载区，参考 `:4722-5231`）、新增 `server/services/graphRunService.mjs`、或改 `server/services/chainService.mjs` |
| **N9** | **队列是进程内内存队列，无持久化，重启即丢** | `createImageGenerationPool`（并发 3 / 队列 240，纯内存）`(server/imageGenerationPool.mjs:7-73)`；`createOwnerFairVideoQueue`（按 owner 公平的内存队列）`(server/videoQueue.mjs:19-124)` | 图执行若要走异步，需要落库的任务表（可复用 `server/ecommerceEngine/jobStore.mjs` 与 `server/projects/schema.mjs:45` 的 `project_generation_runs`） | `server/imageGenerationPool.mjs`、`server/videoQueue.mjs`、`server/ecommerceEngine/jobStore.mjs`、`server/projects/schema.mjs` |
| **N10** | **计费 SKU 三处硬编码、彼此不一致** | 前端 `canvasBillingModel.js:2-16`（10 条）／前端 `NODE_COST_ESTIMATES` `(canvasQuantvExtensions.js:570-592)`（22 条，纯展示估算）／后端 `server/billing/catalog.mjs` | 以后端 catalog 为唯一真源，前端只做展示格式化 | `src/pages/EcCanvas/canvasBillingModel.js`、`canvasQuantvExtensions.js:570-597`、`server/billing/catalog.mjs` |
| **N11** | **未接线的节点图能力积压**（已写好但没人调） | `snapNodeToGrid` `(:341)`、`findNearestPort` `(:662)`、`partitionEdgesByValidity` `(:85)`、`exportCanvasToJSON/importCanvasFromJSON` `(:511-553)`、`createCanvasSticker` `(:465)`、`canTransitionTaskStatus` `(:205)`、`downloadNodeMediaBatch` `(:277)` —— 全仓 0 引用 | 接线或删除，避免"看起来有其实没有" | `canvasQuantvExtensions.js`、`index.jsx`、`CanvasContextMenuPanel.jsx` |

### 9.3 三条路线的代价对比（给架构师决策）

| 路线 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A. 前端引擎（最小） | 在 `EcCanvas` 内新增 `canvasGraphEngine.js`，复用现有 20 个 API 原语，边传值 + 拓扑执行，后端不动 | 改动面小、可增量、不动计费、不动队列 | 长任务仍需轮询前端；关页面即断；不能做团队协作/服务端重跑 |
| B. 后端引擎（正解） | 新增 `graphRunService.mjs` + `/api/canvas/graph/run`，复刻 `ecommerceEngine/orchestrator` 的 job 化模式（`jobStore`），前端只提交图与订阅状态 | 可断点重跑、可计费预扣、可并发治理 | 要动 `server/index.mjs`（已 5274 行）、要新增 SKU、要接 `videoQueue/imageGenerationPool` |
| C. 泛化 chainService | 把现有 4 步 chain 泛化成"步骤数组 + 依赖声明" | 复用已有的 cost 聚合（`aggregateCost` `chainService.mjs:267-296`）与 4 步状态机 | chainService 目前 1/2 步是 mock，且与 `ecommerceEngine` 完全平行，会加深"两套引擎"债 |

### 9.4 明确的风险点

1. **单文件巨石**：`src/pages/EcCanvas/index.jsx` 6182 行，所有执行逻辑内联在组件 `useCallback` 里；`server/index.mjs` 5274 行承载 64 条路由。抽执行器时极易踩 TDZ（仓库自己记录了这条教训：`.superpowers/sdd/2026-09-05-canvas-master-plan.md:145`）。
2. **两套节点渲染并存**：`components/workflowNodes/index.jsx`（222 行，旧）与 `components/workflowNodes/modular/*`（新）同时存在，`workflowNodes/index.jsx:207-222` 只是转发到 modular。改端口/节点卡片时要确认改的是哪一套。
3. **同名文件歧义**：`src/pages/EcCanvas/canvasQuantvExtensions.js`（675 行规格）与 `src/services/canvasQuantvExtensions.js`（36 行，只有 `placeDerivedRightOfSources`，**无任何引用 = 死代码**）同名不同物；真正的 `placeDerivedRightOfSources` 在 `src/pages/EcCanvas/canvasDerivedPlacement.js:22`。
4. **契约测试是护栏也是成本**：378 个测试文件、画布相关 ≥60 个，任何节点结构改动都要同步 `test/canvas-*.test.mjs`；好处是这类重构有回归网。
5. **两条引擎平行**：`server/ecommerceEngine/orchestrator.mjs`（102.9KB）与 `server/services/chainService.mjs` 各管一摊，没有共享的步骤抽象。做统一图引擎前需先决定"谁是宿主"。

