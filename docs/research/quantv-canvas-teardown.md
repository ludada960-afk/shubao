# 知渔 AI（laoyu.quantv.com）无限画布深度拆解

> 调研时间：2026-09-10 | 调研方式：**用真实登录态驱动受控 Chrome**（复制本机 Chrome profile + VSS 快照取 Cookie），
> 直接读它的公开接口、缓存、导出文件与 DOM，不是靠截图猜。
> 原始素材：`.tmp-research/quantv/`（api JSON、UI 截图、ui-log*.txt）

## 0. 可复现的调研配方（重要，后续还要复用）

1. 复制 Chrome profile 到 `.tmp-research/chrome-profile`（`Cookies` 被占用 → 用 `wmic shadowcopy call create Volume='C:'` +
   `mklink /d` 软链到快照再拷）。
2. 启动必须加 **`--no-proxy-server`**，否则本机代理会让所有导航超时（踩过）。
   `chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: true, args: ['--no-proxy-server', ...] })`
3. 鉴权：登录态是 **localStorage 里的 JWT `token`**，不是 Cookie；接口调用要带 `Authorization: Bearer <token>`。
4. 它的接口与模型清单会缓存进 localStorage（`da-ai-canvas:node-models` 135KB、`da-ai-canvas:node-functions` 15KB），可直接导出。

## 1. 画布数据模型（画布文档 `/api/canvas/documents/:id`）

```jsonc
// document = { id, userId, title, cover, graph, sourceCaseId, favorited, categoryId, createdAt, updatedAt, version }
// graph（schemaVersion: 5）
{
  "title": "水果小猫 副本",
  "viewport": { "x": 404.14, "y": 464.33, "zoom": 0.99 },
  "schemaVersion": 5,
  "nodes": [
    { "id": "node-...", "kind": "text|image|video|audio|app",
      "title": "文本节点", "x": -175.7, "y": 97.3, "width": 234, "height": 338,
      "meta": { /* 见下 */ } }
  ],
  "edges": [ { "id": "edge-...", "from": "node-...", "to": "node-..." } ],   // 极简：无端口、无类型
  "groups":  [ /* 分组背景，可整体选中 */ ],
  "stickers":[ /* 便签，5 个 */ ]
}
```

**node.meta 字段（真实抓取）**

| 字段 | 含义 | 出现在 |
|---|---|---|
| `content` | 文本内容 / 生成结果的文字 | text |
| `prompt` | **节点指令**，可用 `@图片1 @文本1` 引用上游节点 | text/image/video |
| `promptHidden` | 指令是否折叠隐藏 | 全部 |
| `settings.modelId` | 该节点选用的模型 id | 全部 |
| `settings.params` | `{ ratio:'9:16', duration:'15', resolution:'720p' }` 等 | image/video |
| `generationStatus` | `completed` 等（8 态子状态机） | 全部 |
| `mediaUrl / originalMediaUrl` | 产物地址 | image/video |
| `mediaStatus / mediaStage / mediaProgress` | 就绪状态与进度 | video |
| `dimensions` | `720 x 1280` | image/video |
| `objectFit` | 展示方式 | image/video |
| `imageTone` | `soft` 等展示态 | 全部 |
| `manualSize` | 用户手动改过尺寸 | 全部 |

**关键观察**：边只有 `from/to`，**没有端口和类型**；串联语义靠节点内的 `prompt` 里 `@图片1` 这类引用 +
上游节点顺序（`图片1` = 第 1 个上游）。也就是说：**"数据流"是软串联（引用式），不是强类型端口图** ——
这降低了他们的实现复杂度，但用户仍然得到"串起来就能跑"的体验。

## 2. 节点编辑器（composer）= 他们真正的竞争力

选中节点后展开的 drawer（真实 DOM 文本）：

- **文本节点** `canvas-node-drawer.kind-text-composer`：
  `[上游输入胶囊: 文本1 × / 图片1 <缩略图> ×] [添加] → 富文本编辑器（Markdown）→ [模型: K-Gemini-3.7-flash] [选择角色] [n/10] [深度思考] → ✦ 预计 0.00~0.66 积分`
- **视频节点** `kind-generation.kind-video`：
  `[上游输入胶囊] [添加] → [模型: 全能参考视频2.0 - mini] [9:16 15s 720p] [自定义] [1 次] → ✦ 预计 12.00 积分`
- **图片节点** `kind-generation.kind-image`：
  `[添加] → [模型: 智能图片G2臻享版] [自适应 1K] [自定义] [1 次] → ✦ 预计 1.00 积分`

要点：
1. **每个节点自带"输入槽 + 指令 + 模型 + 参数 + 次数 + 价格预览"**，用户不需要理解"工作流"概念也能串。
2. `@` 引用上游节点（`@图片1`）——把"连线"翻译成人能读的提示词。
3. **生成前就显示预计积分**（"预计 0.00~0.66 积分"），价格透明是他们转化的一部分。
4. `深度思考`、`选择角色`（角色/人设预设）、`1/10`（附件上限）等是"智能体化"的入口。

## 3. 节点类型（添加菜单实测）

`添加节点`：**文本 / 图片 / 视频 / 音频 / 应用**
`添加资源`：**从本地上传 / 从资产库选择**

模型清单（`/api/canvas/public/node-models`，按模态分组）：
- **text（3）**：K-Gemini-3.7-flash、deepseekV4、全能语言模型G3.1-pro
- **image（6）**：智能图片G2臻享版、智能图片image、即梦5.0pro、智能图片NaPro、即梦5.0、千问3.0pro
- **video（14）**：全能参考视频2.0（mini/fast/pro、首尾帧 mini/fast/pro）、全能参考视频2.5（含"视频编辑"）、
  视频模型H3（768p/2k）、快乐马1.1（含"视频编辑"）、万相3.0、SD 1.0
- **audio（1）**：KFish语音（TTS）

每个模型都带 **四档价格字段**：`pricePerMillion / memberPricePerMillion / agentPricePerMillion / discountRate` +
`pricingTier / basePricePerMillion / hasTierPricing` —— 即"按 token 计价 + 会员价 + 代理价 + 阶梯价"。

## 4. 一键"节点功能/模板"（`/api/canvas/public/node-functions`）

按模态分类的**预设提示词模板**，带封面（图/视频）与 `promptLength`：
- **image（40 个）**：分类 `模特生成 / 女装动作 / 男装动作`，例如 近景模特、奶油风三视图模特、女装——模特展示01~12、
  男装——模特展示1~11、对镜自拍（室内/室外）、男性模特（运动/正装精英/老钱风/美式工装）、儿童（男/女）模特…
- **video（19 个）**：分类 `广告 / 人物动作提示词（视频）`，例如 沙发换装13秒、旋转换装15秒、女性同场景5套换装（15秒）、
  香水/手镯/男鞋/女鞋广告、童装跳舞带货、女性服装带货舞蹈…
- **text / audio 分类目前为空**

→ 这是"**模板即节点**"：点一下就把整段经过验证的提示词灌进节点，直接跑。电商带货场景覆盖极强。

## 5. 画布交互全清单（帮助面板原文 + 实测）

| 操作 | 行为 |
|---|---|
| 双击画布空白 | 新增节点（弹出 composer） |
| 左键双击节点 | 聚焦节点并缩放到 160% |
| 鼠标滚轮 | 放大 / 缩小 |
| Ctrl/⌘ + 滚轮 | **上下平移**画布 |
| Shift + 滚轮 | **左右平移**画布 |
| 拖动节点 | 移动节点 |
| 抓手工具 / 中键拖动 / 空格+左键拖动 | 平移画布 |
| 左键拖动空白 | 框选多个节点 |
| 右键空白 | 上传 / 粘贴菜单（实测：复制节点 Ctrl+C / **创建副本** / 粘贴 Ctrl+V / 删除） |
| 拖动连接点 | 创建 / 重连连线（提示词："从此处拉出连线"/"连线终点"） |
| 点分组背景 | 选中整组并显示菜单 |
| Ctrl/⌘+A / C / V / D | 全选 / 复制 / 鼠标处粘贴（C 也可）/ 原地复制 |
| Ctrl/⌘+Z | 回退（新建/删除/连线/移动等，**最多 80 步**） |
| Ctrl/⌘+G / +Shift+G | 设为分组 / 解散分组 |
| Delete / Backspace | 删除选中节点/连线 |
| 方向键 / Shift+方向键 | 微调 1px / 10px |
| Esc | 取消选中 / 关闭浮层 |

工具栏（实测 title 全文）：返回画布列表、文档名（双击可重命名）、所有修改已保存、切换到夜晚、充值积分、
**导出画布节点、连线和便签为文本文件**、任务日志、字数统计、**去生图片 / 去生视频**（批量跑选中/全画布）、
聚焦、展开、**新建便签**、历史、帮助、显示画布工具栏、鼠标工具/抓手工具、当前：鼠标友好模式、
**小地图**、**自动整理卡片**、**对齐吸附：已关闭（可开）**、缩小/缩放比例/放大/重置缩放、播放（视频节点）。

## 6. 导出格式（可直接抄的互操作设计）

导出的是 `.txt`（内容为 JSON），**完整图快照**：

```jsonc
{ "__canvas": "da-ai-canvas", "version": 2, "nodes": [...], "edges": [...], "stickers": [...] }
```

→ 意味着它的画布**可导出可导入**（工作流分享/迁移）。我们做节点化时，导入导出必须一开始就设计好。

## 7. 它调用的接口（一次画布加载）

```
GET /api/canvas/documents/:id            # 文档（nodes/edges/groups/stickers/viewport）
GET /api/canvas/documents/:id/tasks      # 该画布的任务队列
GET /api/canvas/public/node-models       # 模型清单（含四档价格）
GET /api/canvas/public/node-functions    # 一键模板清单
GET /api/canvas/public/modular-prompts   # 模块化提示词（text/image/video）
GET /api/canvas/public/image-grid-split-hd-model | video-subtitle-removal-model
    | image-background-removal-model | image-quality-enhancement-model   # 单功能模型的"能力开关"
GET /api/canvas/public/home              # 首页/模板/推荐/我的资产
GET /api/canvas/editor-version           # 编辑器版本（灰度/热更新）
GET /api/canvas/node-functions/prompt-access | node-function-favorites
GET /api/models/token-stats?modelId=...  # 模型 token 用量统计
```

## 8. 定价与商业化（可直接对标的点）

- **每个节点生成前显示预计积分**（文本量按 token 区间 `0.00~0.66`；视频 15s/720p = 12.0；图片 1K = 1.0）。
- 模型四档价：普通 / 会员 / 代理，另有阶梯价与折扣率。
- 顶栏常驻余额（`✦ 0.00`）+ 充值积分入口。
- 视频/图片按"次数 × 规格"计价（`1 次`、`9:16 15s 720p`）。

## 9. 对薯包AI 的初步结论（详细设计见总体方案）

**可以直接对标、且我们成本最低的：**
1. 节点内 composer 的"输入胶囊 + @引用 + 模型 + 参数 + 次数 + 价格预览"——它把图论包装成用户能懂的三件事。
2. 一键模板即节点（我们已有 40+ 电商经验与提示词资产，可直接做成模板库）。
3. 导出/导入 JSON 的互操作。
4. 小地图 / 对齐吸附 / 自动整理 / 80 步撤销 / 便签 / 分组——体验标配。

**我们比它强的：** 电商流水线的"产品事实 + 合规护栏 + 尺寸锁"（他们的模板是黑盒提示词）；
我们有真正的商品档案、套图规划、平台规格与导出。

**我们要补的：** 执行引擎（图驱动自动跑）、端口级多输入、失效重跑、任务队列落库。

---

# 第二遍深挖（2026-09-10 追加）

> 目的：补齐第一遍没覆盖的**交互细节、面板字段、批量能力、资产库、导入闭环、模板提示词结构**。
> 证据等级标注：**[DOM]** = 真实登录态浏览器实测 DOM 文案；**[API]** = 带 token 实测接口；**[CODE]** = 从同构建产物
> `https://cdn.quantv.com/site/models/front/assets/router-CVwx3mbw.js`（3.1 MB，全部画布代码集中在 1.83 MB~3.0 MB 区间）
> 读出的实现；**[未确认]** = 只能推断、没实测。
> 新增素材：`.tmp-research/quantv/ui2/*.png`、`api-paths.txt`、`featured-details.json`、`tpl-full.json`、`tpl2.txt`、`templates-3.txt`、`js-canvas.js`。
> **纪律**：全程只读——只打开、悬停、右键、读 DOM/接口、导出、截屏；**没有新建/删除任何节点、没有点任何生成按钮**。
> 因此凡是"点击后会写文档"的路径（新增节点、跑模板）一律用 **[CODE]** 标注，不做实测。

## 10. 连线交互（第一遍只写到"拖动连接点"，这里补全）

### 10.1 端口在哪、什么时候出现
- 每个节点在 DOM 里**常驻**两个连接点按钮 **[DOM 实测]**：
  - `button.connector.connector-in`，`title="连线终点"` → 位于节点**左边缘外**（实测节点 left=230.2，connector left=209.4，即外扩约 21px）
  - `button.connector.connector-out`，`title="从此处拉出连线"` → 位于节点**右边缘外**
  - 命中区 43.56 x 43.56 px 的屏幕像素盒（不随画布缩放变化），垂直位置与节点标题栏同一水平线。
- 端口不是"悬停才出现"的：`offsetParent !== null`，**始终在 DOM 且可见**，靠透明度做视觉弱化。
- 连线两端锚点固定 **[CODE]**：出端口取源节点 right 边中点、入端口取目标节点 left 边中点；路径是贝塞尔曲线
  （`canvas-edge-path`），另有两条覆盖层：`canvas-edge-hit`（加粗命中区）与 `canvas-edge-flow`（流动效果）。

### 10.2 拉线、落地、批量
- 从出端口按下（仅左键 `button===0`）→ 进入 `connector` 拖拽，锚点 `anchor:'target'`；从入端口按下 → `anchor:'source'` **[CODE]**。
- **拖到节点上**：目标节点获得 `isInputHot` 高亮类（仅当源节点 != 目标节点）。
- **拖到空白处松手**：不报错，而是**弹出"添加节点"菜单并记住连接意图** **[CODE]**：
  - 从出端口拖出 → 菜单底部提示 `新节点会连到来源节点`
  - 从入端口拖出 → 菜单底部提示 `新节点会作为上游连入当前节点`
  - （正常双击空白时的提示是 `新节点会插入到双击位置`）**[DOM 文案]**
- **多选批量连线**：多选状态下从任一节点出端口拖拽 → `batch-connector`，一次把**选中集合全部**连到落点节点。
  结果 toast：`已连接 N 个，跳过 M 个`（warning）/ `已连接 N 个节点`（success）/ `选中节点均无法连接到该节点`。

### 10.3 重连（关键机制，第一遍只说"可以重连"）
- 在**连线本身**上按下左键（`.canvas-edge-hit` 命中路径比视觉线宽）即进入 `edge-pending` **[CODE]**。
  锚点由点击位置决定：点在曲线中点左侧取 source，右侧取 target（按世界坐标 x 比较）。
- 移动超过 **4px**（常量 `J2=4`）后：先记一条历史 `断开连线`，然后**立刻把这条边从图里删掉**，
  再以剩余那端为起点重新拉一条 `connector`，并带 `replacingEdgeId`（替换语义）。
  → 也就是"拖连线" = 摘下一端 + 重新接上，视觉上就是重连。
- **拖到空白松手 = 这条连线被删除**（因为 `replacingEdgeId` 存在，不会弹添加菜单）。

### 10.4 删除连线
- 右键空白处的菜单里没有"删连线"；连线可删的三条路径 **[CODE]**：
  1. 拖拽摘链后落到空白（上一节）；
  2. 选中连线 + `Delete/Backspace`（`selectedEdgeId` 参与删除；帮助面板原文 `删除选中节点 / 连线`）**[DOM]**；
  3. 节点右键菜单里的"断开节点"（历史类型 `node-disconnect`，toast `已断开该节点的全部连线`）——一次断掉该节点**全部**连线。
- 连线右键：`CanvasEdges` 组件**声明了** `onEdgeContextMenu`（onContextmenu → 坐标 + edgeId），
  但 3.1 MB 构建产物里**父组件 CanvasEditorInner 没有把这个 prop 接线**，且实测右键连线**没有任何菜单弹出** **[DOM+CODE]**。
  → 结论：**连线右键菜单在当前构建是死代码 / 未上线**；边删除的现实入口是 Delete 键 + 拖链摘除。

### 10.5 无效连线怎么提示（第一遍没写）
- **即时拒绝**：建边前跑校验，不合法则调用 `onConnectReject(reason)` 弹 **warning 级 toast**，边不建立 **[CODE]**。
  真实 reason 文案（代码原文）：
  - `该节点不支持此类型输入`（目标节点不接受该模态）
  - `该节点不接受图片素材` / `该节点不接受视频素材` / `该节点不接受音频素材`（上限为 0）
  - `参考图片已达上限 N 个` / `参考视频已达上限 N 个` / `参考音频已达上限 N 个`（目标节点该模态参考数已达模型上限）
  - 批量场景：`不能连接到选区中的节点`、`部分节点已存在相同连线`
- **建边后仍可能失效**（上游换模型、素材被移除等）：这条边会被打上 `is-invalid` **[DOM+CODE]**：
  - 边分组加类 `is-invalid`，并叠加一条 `canvas-edge-flow.is-invalid` 流动层；
  - 同时挂一个原生 tooltip，**原文**：`当前模型不支持该上游输入，或参考素材数量已超出模型上限`。
- **运行中的边会流动**：`canvas-edge-flow.is-running`，由 `runningEdgeIds` 集合驱动——任务跑起来时对应连线有流动动画。

### 10.6 连线能有标签/类型吗？—— 没有
- 导出结构里边只有 `{id, from, to}`（内部可能多一个 `order`）**[实测导出文件]**；
  渲染层只有 `is-selected / is-selected-related / is-muted / is-invalid / is-running` 五种视觉态，
  **没有 label / type / 端口 id / 数据契约**。
- 语义完全靠**节点内 prompt 里的 @图片1 式引用 + 上游顺序**承载（引用编号的生成规则见 12.1）。

## 11. 修正第一遍的一处误记：「去生图片 / 去生视频」不在顶栏

第一遍把 `去生图片 / 去生视频` 记成"顶栏批量按钮（跑选中/全画布）"。**实际不是。**

- 真实顶栏（`CanvasEditorTopbar`）只有 7 个元素 **[DOM+CODE]**：
  返回画布列表（跳 `/canvas?tab=projects`）、文档名输入框、保存指示器、`切换到夜晚/白天`、
  `充值积分`（显示 `✦ 余额`）、**导出**（title 全文 `导出画布节点、连线和便签为文本文件`）、
  **任务日志**（title 全文 `查看任务日志与报错记录`）。
- 真实位置：`去生图片 / 去生视频` 在**文本节点的节点动作条** `node-action-bar` 上，
  且**只对 kind==='text' 的节点出现** **[DOM+CODE]**：
  - 文本节点动作条全集：`{n} 字`（muted，点击=版本）→ `去生图片` → `去生视频` → `聚焦` → `展开`
  - 点击后的行为 **[CODE]**：`createLinkedPlaceholderNode(该文本节点, 'image'|'video')` ——
    **在该文本节点右侧自动创建一个占位图片/视频节点并自动连线**，写一条历史 `task-create / 生成图片|生成视频`，
    toast `图片生成任务已添加` / `视频生成任务已添加`。
  - → 它是**"这段话去生一张图/一段视频"的单节点快捷派生**，不是批量执行器，**不跑全画布、也不按选区跑**。
- **真正的批量执行器是"并发提交确认弹窗"** **[CODE]**：确认文案二态
  - 单次：`本次提交生成任务，预计消耗 X 积分，确认提交？`
  - 多次：`即将并发提交 N 次生成任务，预计消耗 X 积分，确认提交？`
  确认按钮固定文案 `确认提交`；该弹窗是全局单例。
  可见他们的"批量" = **同一节点 x N 次**，而不是"一堆节点一起跑"。
- **节点动作条完整清单**（对做节点化生态直接可用）**[DOM+CODE]**：

  | 节点类型 | 动作条按钮（从左到右） |
  |---|---|
  | text | `{n} 字` / `去生图片` / `去生视频` / `聚焦` / `展开` |
  | image | `宫格切分`(带下拉) / `图片分析` / `图片工作台`(开关) / `背景去除`(开关) / `画质增强`(开关) / `聚焦` / `下载` / `添加` / `预览` |
  | video | `脚本拆解`(开关) / `关键帧`(开关) / `智能去字幕`(开关) / `聚焦` / `下载` / `添加` / `预览` |
  | audio | `聚焦` / `下载` / `添加` |
  | app | `聚焦` / `下载` / `添加` / `预览` |

  其中 `添加` 的 tooltip 是 `把素材添加到我的资产库`；`图片工作台` 是 `图片编辑与图片分层`；
  `背景去除` 是 `移除图片背景`；`画质增强` 是 `提升图片清晰度`。
  按钮在节点内容未就绪时除 `聚焦` 外全部 disabled。
- 实测某图片节点动作条为 `宫格切分 图片分析 背景去除 画质增强 聚焦 下载 添加 预览`：
  `图片工作台` 因 config 里 `imageWorkspace=false` 未出现，`宫格切分` 因 `imageGridSplitEnabled=true` 出现 **[DOM]**。
  → **动作条是服务端开关驱动的**，同一套前端可以按租户/时段开关能力。

## 12. 节点五类全枚举（composer 的输入槽 / 参数项 / 模型列表 / 次数 / 价格预览）

### 12.1 所有 composer 共用的"媒体条"（第一遍叫"上游输入胶囊"，真实组件名 DrawerMediaStrip）
- 标签规则 **[CODE]**：按**模态分别从 1 开始编号**，拼成 `@图片1 / @文本2 / @视频1 / @音频3 / @文档1`；
  模态中文名固定为 `文本 / 图片 / 视频 / 音频 / 文档`。→ **这就是 prompt 里 @图片1 的唯一来源与计数规则**。
- 每个胶囊 **[DOM+CODE]**：图标+缩略图、`@图片N` 标签、文件原名、右上角 `x`（aria-label `移除 @图片N`）、
  悬停大型预览（图片；视频自动播放；音频带 controls）。
- **可拖拽排序**——拖拽会**改变编号**，等于改变 prompt 里 @图片N 的指向。
- 超出模型上限的胶囊加 `is-over-cap`，tooltip：`超出模型上限，提交前请移除`。
- 末尾统一一个 `添加` 按钮，tooltip/aria 为 `添加素材`，上传中变转圈。

### 12.2 text 节点 composer
- 结构 **[DOM 实测]**：`[媒体条] -> [Markdown 富文本编辑器] -> [模型选择器] [选择角色] [{n}/10] [深度思考] -> ✦ 预计 x~y 积分`
- **斜杠 / = 个人提示词库**（第一遍漏掉）**[CODE]**：
  在编辑器里输入 `/` 会弹出提示词菜单，可按标题过滤，上下键选择、Enter 插入、Esc 关闭；
  数据源是 `GET /canvas/prompts`（`listPrompts/createPrompt/updatePrompt/removePrompt`）。
  对应管理弹窗标题 **`我的提示词`**：搜索框 placeholder `搜索提示词标题`，卡片展示 标题 / 来源(source) / 日期 / 正文，
  行内操作 `复制提示词` / `编辑提示词` / `删除提示词`，编辑态校验 `标题和提示词内容不能为空`、
  失败 `保存失败，请重试`；标题 maxlength 200、正文 maxlength 10000。
- 引用/上传上限由模型 `genParams.upload` 决定 **[CODE]**：
  `{enabled, maxTotal:10, maxImages:10, maxVideos:1, maxAudios:5, maxDocs:10, docFormats:"pdf,docx,xls,xlsx,csv,pptx,txt,md,json,xml,html,log"}`
  —— 三个 text 模型完全一样。界面上的 `1/10` 就是 maxTotal。
- `深度思考` 开关对应 `genParams.enableDeepThinking`，写进节点 `meta.settings.deepThinking`。
- `选择角色` 对应 `meta.settings.characterId / characterName`（在导出与图结构里确认了这两个字段）。
- 价格：按 token 区间预估 `✦ 预计 0.00~0.66 积分`；区间来自
  `GET /api/models/token-stats?modelId=...` 返回的 `{minTokens,maxTokens,sampleCount}`
  （实测 K-Gemini-3.7-flash：min=13 / max=41800 / sampleCount=5595），乘以 pricePerMillion/1e6 得上下界 **[API+CODE]**。
- 文本节点默认尺寸 234 x 338，节点标题可双击重命名（title `双击可重命名`）。

### 12.3 image 节点 composer
- 结构 **[DOM 实测]**：`[媒体条] -> [模型选择器] [自适应 1K] [自定义] [1 次] -> ✦ 预计 1.00 积分`
- **模型参数是服务端下发的声明式 schema**（`node-models[].genParams.params[]`）**[API+CODE]**，每项：
  `{key, label, description, icon, type, options[], path, requiredTip, maxSize, priceAddon/memberPriceAddon/agentPriceAddon/costPriceAddon, priceMultiplier, useDurationPriceMultiplier, showCondition}`；
  `type` 已知取值：`select / referenceImages / referenceVideo / referenceAudio / prompt / voiceClone`。
  → **这条最值得抄：前端 composer 完全由这份 JSON 渲染，加模型 = 加一行数据。**
- 图片模型的 select 参数典型值：
  - `ratio` 图片尺寸：`自适应auto / 1:1 / 3:2 / 2:3 / 16:9 / 9:16 / 5:4 / 4:5 / 4:3 / 3:4 / 21:9 / 9:21 / 1:3 / 3:1 / 2:1 / 1:2`（G2臻享版 16 档）
  - `resolution` 分辨率：`1K`（基础）/ `2K`（+0.5 普通 / +0.4 会员 / +0.4 代理，cost 0.243）/ `4K`（更高）
  - `image_urls` 参考图：`type:referenceImages, multiple:true, maxSize:10`（NaPro 14 张、千问3.0pro 3 张）
- **图片模型只有 6 个**，按"每张"计价 **[API]**：

  | 标题 | name | 普通/会员/代理 | 备注 |
  |---|---|---|---|
  | 智能图片G2臻享版 | gpt-image-2-all | 1 / 0.7 / 0.6 | 默认，16 档比例 |
  | 智能图片image | gpt-image-2 | 0.6 / 0.38 / 0.3 | |
  | 即梦5.0pro | jimeng5.0pro | 0.6 / 0.38 / 0.3 | |
  | 智能图片NaPro | nano2pro | 0.6 / 0.38 / 0.3 | 参考图最多 14 张 |
  | 即梦5.0 | jimeng5.0 | 0.4 / 0.3 / 0.2 | |
  | 千问3.0pro | qwen3pro | 0.45 / 0.33 / 0.28 | 参考图 3 张 |

- `次数` 选择器从 `1 次` 起，配合确认弹窗（见第 11 节）。
- 参数区还有 `自定义` 入口，点击展开完整参数面板。

### 12.4 video 节点 composer
- 结构 **[DOM 实测]**：`[媒体条] -> [模型选择器] [9:16 15s 720p] [自定义] [1 次] -> ✦ 预计 12.00 积分`
- 视频模型 **14 个**，参数键与图片不同 **[API]**：
  - `images`（参考图 maxSize 2~30）/ `videos`（参考视频 maxSize 1~10）/ `audios`（参考音频 maxSize 1~10）
  - `ratio` 画面比例（多为 16:9 / 9:16 / 1:1 / 4:3 / 3:4 / 21:9；"视频编辑"类只有 `自适应`）
  - `duration` 视频时长（`4秒`~`15秒` 分档；多数用 priceMultiplier 线性乘，如 4 秒 x4、15 秒 x15）
  - `resolution`：`720p / 1080P / 2k`，带 priceAddon
  - 特殊参数 `useDurationPriceMultiplier {unit:'s'|'m', rate, includePriceAddonKeys}` —— **按参考视频时长线性计价**
  - 首尾帧模型有两个同名 `images` 参数，label 分别是 `首帧图` / `尾帧图`，
    requiredTip `请上传首帧图` / `请上传尾帧图`
  - `快乐马-视频编辑` 有 `audio_origin`：`原音 origin` / `自动 auto`
  - `SD 1.0` 里有嵌套 `model` 选择：`视频3.0 / 视频3.0Fast / 视频3.0Pro(x5) / 视频3.5Pro(x8)`
- 参数行显示格式 **[DOM+CODE]**：`{比例} {时长}s {分辨率}`，如 `9:16 15s 720p`；
  时长有专有滑块（`drawer-duration-slider`，两端标签 + 中间当前值高亮）；选项 <=2 用两列网格，否则三列网格。
- 视频动作条额外开关来自服务端 config **[CODE]**：`videoScript`(脚本拆解)、`videoKeyframe`(关键帧)、
  `videoSubtitleRemoval`(智能去字幕，含 `框选擦除 region` / `智能擦除` 两模式，region 显示 `N 个区域`)。
- 视频节点底部有播放条（`播放` 按钮、`00:00 / 00:15` 时间轴）。

### 12.5 audio 节点 composer
- 音频模型只有 **1 个**：`KFish语音`（name `fish`），价格 `0.01 / 0.007 / 0.006` **[API]**。参数 schema：
  - `reference_id`（`type:'voiceClone'`）—— **音色选择器**，`requiredTip: 请选择音色`；
    配置 `cloneUrl: https://miheai.com/plugin/voice_clone_to_model`；
    `clonePrice:4 / memberClonePrice:3 / agentClonePrice:2 / costPrice:1.5`（**创建自定义音色单独收费**）
  - `speed` 播放速度：`正常 1 / 半速 0.5 / 两倍速 2`（写入 `$.prosody`）
  - `volume` 音量：`无变化 0 / 音频增大 1 / 音频减小 -1`（写入 `$.prosody`）
  - `text`（`type:'prompt'`）placeholder：`请输入生成的音频文案.`
- 音色抽屉文案 **[CODE]**：标题 `选择系统音色 / 选择自定义音色 / 选择音色`，按钮 `添加音色`、
  面板标题 `新建音色`、输入 placeholder `请输入音色名称`、错误 `请选择音频文件` /
  `该模型未配置 cloneUrl` / `创建失败`；列表项带试听（同一时间只播一个）。
- 生成框 placeholder **[CODE]**：音频 `输入音频生成指令，或使用 @ 引用已添加的文本素材。`
  （图片 `可上传参考图并输入文字，或使用 @ 引用已添加的素材。可自由组合图、文。`；
  视频 `上传参考素材并输入文字，或使用 @ 引用已添加的素材。可自由组合图、文、音、视频。`）
- **音频 composer 的视觉未实测**：本画布没有音频节点，新建节点属于写操作，按只读纪律不做。以上为 **[API]+[CODE]**，
  标注 **未确认（UI 呈现）**。

### 12.6 「应用」节点（app）—— 它到底是什么
- **它不是"应用市场里的第三方 App"，而是"后台勾选给该节点用的自研应用插件"** **[CODE]**。证据链：
  - `node-models.app` 分组**是空数组**（app 不走模型清单）；
  - 应用节点空态文案 **`后台暂未勾选可用应用`**；
  - 提交校验失败文案 **`请先在后台为应用节点勾选可用应用`**。
- 数据结构 **[CODE]**：
  - `meta.settings` 持久化 `{ modelId(=appId), appName, appIcon, appParams }`；
  - 应用定义含 `title / icon / pricePerMillion / inputConfigs[]`；
  - `inputConfigs` 里 `type==='file'` 的项声明 `fileType(image/video/audio) / maxImages / optional / variableName`，
    其余是普通表单项。
- UI **[CODE]**：
  - 顶栏 `app-bar`：`选择应用` 下拉（弹层标题 `选择应用`）+ 右侧 `✦ {价格}` + `运行应用` 按钮
    （禁用时 title 显示校验错误；余额不足文案 `积分余额不足`）
  - 参数区 `app-params-drawer`：标题=应用名，分区 `上游素材`（卡片显示已分配/容量，必需项未满足标红）
  - 校验文案 `请补充：{缺失项列表}`；提交成功后按 `appResultKind`（image/video/audio）把结果写回节点
  - 节点 meta 里会记 `appTaskId` / `appResultKind`
- **实测限制**：本画布无 app 节点，无法打开真实 composer；应用清单接口**不存在**
  （试过 `/api/canvas/public/apps`、`/api/canvas/apps`、`/api/canvas/public/app-list` 全部 404）**[API]**。
  → **未确认**：应用清单由哪个接口下发（可能挂在管理端，或该能力尚未对普通用户开放）。
  但可以确定：**"应用"是运营手工配置的白名单能力，不是开放生态** —— 这与"节点化创作生态"的想象不同，是我们做差异化的切口。
- 旁证：localStorage 历史里有一条 `应用节点（已连线）` 的 `node-add` 记录 **[DOM]**，说明该能力对该账号可见过。

## 13. 便签 / 分组 / 分镜组 / 小地图 / 自动整理 / 对齐吸附

### 13.1 便签（sticker）
- 数据结构（导出实测）：`{id, x, y, width, height, targetType:'free', title:'便签', html:'<p>...</p>',
  style:{theme:'yellow', opacity:0.98, radius:16}, zIndex:10, locked:false, collapsed:false}`
- 行为 **[CODE]**：
  - 新建入口：左侧工具栏 `新建便签` 按钮，点击后出现在按钮右侧；
  - 空内容占位 `双击编辑内容...`；**双击进入编辑**（`is-editing`），选中态 `is-selected`；
  - **富文本工具条**（编辑时出现）：
    - 字号：`标题`(h2) / `副标题`(h3) / `正文`(p)
    - `加粗` / `斜体` / `下划线` / `删除线`
    - 链接：无协议自动补 `https://`；新链接强制 `target="_blank" rel="noreferrer noopener"`
    - 颜色：**8 种背景色** `#fffef0 #f0f8ff #f0fdf4 #fff0f6 #ffffff #fef2f2 #fff7ed #f5f3ff`
      + 一组文字色（含 `#16a34a #2563eb #7c3aed`）
  - **HTML 白名单净化**：允许标签 `b,i,u,s,strike,a,ul,ol,li,p,br,span,strong,em,div,h2,h3`，
    属性 `href,target,rel,style`，禁 data-*；粘贴的裸 URL 自动转 `<a>`；
  - 四角拖拽改尺寸（`resize-nw/ne/sw/se`），有最小宽高限制；`locked` 时不可拖不可编辑；
  - 层级：贴纸层 z-index 4（有选中贴纸时 25），单张默认 zIndex 10，按 zIndex 升序渲染；
  - 变换随画布缩放（left = viewport.x + x*zoom，字号 14*zoom）。
- 导出会带便签（样例文件里 5 张便签原文可见）；`targetType:'free'` 说明数据结构预留了"贴在节点上"的形态
  （`targetId`），但当前模板全部是 free，**未确认 UI 是否开放吸附到节点**。

### 13.2 分组（group）
- 数据结构 `{id:'group-...', nodeIds:[...]}`，纯逻辑分组（导出实测）。
- 包络盒计算 **[CODE]**：bbox(nodes) 外扩 **28px**（宽高各 +56）。
- 创建/解散：`Ctrl/⌘+G` `设为分组`；`Ctrl/⌘+Shift+G` `解散分组`；
  **成员少于 2 个的分组自动丢弃**；解散时**连带删除组内所有边**。
- 分组标题：默认 `分组 {n} 个节点`，双击改名（aria-label `分组名称`，maxlength 60，Enter 提交 / Esc 取消）。
- 点分组背景 = 选中整组并显示菜单（帮助面板原文）；组可整体拖动，拖动时只预览位移、松手落地。

### 13.3 分镜组 / 故事板（storyboard）—— 第一遍完全漏掉
- 分组对象可以带 `storyboard` 字段，成为**网格化分镜容器**（组件 `CanvasStoryboardLayer`），
  组内**只有 image 节点**参与占格 **[CODE]**。
- 行为 **[CODE]**：
  - 把节点拖到分组上时实时计算落点格（hoverIndex），悬停 **150ms** 后才确认落点（防误触）；
  - 落格后把原尺寸写回 `meta.storyboardOriginalSize` 以便拖出还原；
  - 拖出格子时按"以指针为中心"还原位置；
  - 支持从空格子直接建节点。
- 历史里能看到真实动作名 `图片加入分镜组`（node-edit 类型）。
- **对我们的意义**：这是"套图/多镜头规划"的画布原生形态，比 便签+分组 更接近电商套图生产。**建议直接对标。**

### 13.4 小地图（minimap）
- 组件 `CanvasMinimap`，仅当**画布有节点**时渲染 **[CODE]**。
- UI 文案 **[DOM 实测]**：标题 `小地图` + `{N} 个节点`；SVG `viewBox="0 0 206 138"`，aria-label `画布缩略图`。
- 映射规则 **[CODE]**：世界包围盒外扩 **90px**，等比缩放到 206x138 内居中；
  视口框 = `{x:-viewport.x/zoom, y:-viewport.y/zoom, w:innerWidth/zoom, h:innerHeight/zoom}`；
  **点击缩略图任意位置 = 把该世界坐标居中**（指针捕获 + 可拖动）。
- 渲染的是节点矩形 + 边，不是 DOM 截图。

### 13.5 自动整理卡片（auto arrange）
- 按钮 title/aria `自动整理卡片` **[DOM]**；点击走 `autoArrangeNodes`，并写一条历史
  type `auto-arrange` -> 面板显示 `自动整理` **[CODE]**。
- 另有 `arrangeSubset`（局部整理）供内部使用（例如新插入的上游素材节点）。
- **未确认**：具体排布算法（分层 DAG 还是网格布局）——被混淆在内部函数里，未做逆向。
  建议只对标"一键整理 + 进历史 + 可撤销"这个行为契约。

### 13.6 对齐吸附（snap）
- 开关状态存在 **localStorage `mihe:canvas-snap-enabled`**（'1'/'0'），**默认关闭** **[DOM+CODE]**；
  title 文案 `对齐吸附：已开启` / `对齐吸附：已关闭`，按钮带 `aria-pressed`。
- 吸附算法 **[CODE]**：
  - 对每个其他节点取三条竖线 `x / x+w/2 / x+w` 与三条横线 `y / y+h/2 / y+h`，
    与被拖节点的同名三线做距离比较；
  - 容差 `6px / zoom`（屏幕上恒定 6px）；
  - x / y 各自只吸附**最近的一条**；
  - **仅当只拖动 1 个节点时生效**，多选拖动不吸附；
  - 命中后产生对齐参考线 `guides:[{axis:'x'|'y', position}]` 由舞台绘制。
- **画布边缘自动平移**（第一遍没写）**[CODE]**：拖节点时若指针距舞台左右边缘 <72px，
  每帧（requestAnimationFrame）平移视口 4px，靠近边缘持续滚动——长距离拖拽不需要松手。
- 缩放范围：滑杆 10%~300%，步长 5%；滚轮用指数步进（logDelta ±0.06）；
  鼠标友好模式下 `Ctrl/⌘+滚轮 = 上下平移`、`Shift+滚轮 = 左右平移`；
  触控板模式 `双指 = 平移`、`捏合 = 缩放` **[CODE+帮助面板原文]**。
- 拖动阈值：节点 **4px** 才算"移动"（否则算点击）。

## 14. 历史面板 & 任务日志面板（字段全集）

### 14.1 历史记录（canvas-history-panel）
- **存储**：内存 items + 内存 snapshots Map；**items 持久化到 localStorage `da-ai-canvas-history:{docId}`**（实测 484B）**[DOM+CODE]**。
- **条目字段**（真实落库结构）：
  `{ id:'history-{ts}-{rand5}', type, title, nodeId?, details?, timestamp:'HH:mm:ss' }`
  - timestamp 用 `Intl.DateTimeFormat('zh-CN',{hour,minute,second})` 生成
  - details 是可选副标题
  - **上限 80 条**（新的在前）
- **type 枚举与显示名（全 15 种，代码原文）** **[CODE]**：

  | type | 面板显示 | 典型 title |
  |---|---|---|
  | template-insert | 插入模板 | - |
  | template-replace | 替换画布 | - |
  | node-add | 添加节点 | `应用节点（已连线）` |
  | node-copy | 复制节点 | `{节点名} 副本` |
  | node-edit | 编辑文本 | `移动节点` / `批量连接节点` / `图片加入分镜组` |
  | node-delete | 删除节点 | `删除 1 个节点` |
  | node-disconnect | 断开节点 | `{节点名}` |
  | edge-disconnect | 断开连线 | `断开连线` |
  | asset-add | 添加素材 | - |
  | chat-submit | 提交对话 | - |
  | task-create | 创建任务 | `生成图片` / `生成视频` / `图片分析提示词` |
  | task-complete | 任务完成 | - |
  | result-adopt | 采用结果 | - |
  | result-replace | 替换源节点 | - |
  | auto-arrange | 自动整理 | - |

- **交互** **[DOM+CODE]**：
  - 点条目主体 = **定位到该节点**（无 nodeId 的条目 disabled）；
  - 右侧一个**撤回按钮**（aria-label `撤回到此步之前`），title 二态：
    `撤回到此步之前` / **`该步骤无法撤回（刷新前的记录）`**；
  - 撤回语义：`canRevert(id) = snapshots.has(id)` -> **只有本次会话内做过的步骤才有快照可回**；
    `revertStep` 会删掉该步及其之后的全部条目与快照（即"回到这一步之前"）；
  - 头部还有 `清空` 按钮（无历史时 disabled）和 `关闭`；空态：图标 + `暂无历史`。
  - **实测**：本画布 4 条历史（从 localStorage 恢复）**全部不可撤回**，title 全是 `该步骤无法撤回（刷新前的记录）` —— 与代码一致。
- **它和 Ctrl+Z 是两套东西**：`Ctrl+Z` 是 80 步撤销栈（帮助面板原文 `回退上一步（新建/删除节点、连线、移动等，最多 80 步）`），
  历史面板是**只读日志 + 单点回滚**。

### 14.2 任务日志（canvas-chat-panel canvas-tasklog-panel）
- 入口：顶栏 `任务日志`（title `查看任务日志与报错记录`）；面板标题右侧显示**上次刷新时间 HH:MM**；
  **每 15 秒自动轮询** `GET /canvas/documents/{id}/tasks`；头部按钮 `刷新`（title）与 `收起`。
- **筛选器（DOM 原文）** **[DOM 实测]**：
  - 状态：`全部状态 / 进行中 / 已完成 / 失败`
  - 类型：`全部类型 / 文本 / 图片 / 视频 / 音频 / 应用`
  - "进行中"是 processing 分组，会同时保留 pending 与 processing 两种 status **[CODE]**。
- **状态机（两套）** **[CODE]**：
  - 普通生成任务：`pending->待处理`、`processing->生成中`、`completed->已完成`、`failed->失败`
  - 媒体后处理（去字幕/去背景/画质增强/转存）：`waiting->等待提交`、`queued->排队中`、`processing->处理中`、
    `transferring->结果转存中`、`completed->已完成`、`failed->已失败`、`refunding->退款处理中`、`refunded->已退款`
- **单条任务记录字段全集**（从渲染代码反推）**[CODE]**：

  | 字段 | 用途 |
  |---|---|
  | id | 任务 ID（面板底部 `任务ID：{id}` + `复制`/`已复制` 按钮） |
  | canvasNodeTitle | 节点名（无则 `未命名节点`） |
  | mediaType | text / image / video / audio / app |
  | modelTitle / modelName | 模型名 |
  | status / stage / operation | 状态与后处理阶段 |
  | statusMessage | 状态徽标 tooltip |
  | errorMsg | 失败原因（红色块，原文直出） |
  | results | JSON 字符串数组（结果 URL 列表，取 [0] 判断有无产物） |
  | createdAt / submittedAt / processingAt / transferringAt / completedAt / updatedAt | 时间轴（MM-DD HH:mm:ss） |
  | estimatedPoints / chargedPoints / refundedPoints | `预计积分` / `实际扣除` / `退款积分`（>0 高亮） |
  | durationSeconds | 去字幕的 `计费时长`（<60s 显示 N 秒，否则 N 分 M 秒） |
  | sourceImageUrl / sourceVideoUrl | 后处理任务的源素材缩略图 |
  | mode / regionCount | 去字幕：`框选擦除` + `N 个区域` / `智能擦除` |
  | multiple | 画质增强：`增强倍数 N 倍` |

- **单条可做的动作** **[CODE]**：`定位结果节点` / `预览` / `下载` / `定位源节点` /
  **`重新提交`**（仅"失败 + 源节点在 + 结果节点在"时出现，是最接近"重试"的能力）/ `复制任务ID`。
- **时间轴文案**：`提交 {t}` / `开始处理 {t}` / `开始转存 {t}` / `完成 {t}`；
  失败时：`失败 {t}` / `处理失败，退款处理中` / `失败，积分已退回`。
- 空态 `暂无任务记录`；加载中 `加载中...`；底部常驻
  **`报错时把上方任务ID发给客服，可快速定位问题`**（用"客服 + 任务ID"替代自助排障，是低成本运营策略）。
- 实测本画布 `GET /canvas/documents/:id/tasks` 返回 `[]`，面板显示空态 **[DOM+API]**；
  **未确认**：有任务时的真实渲染（无任务可造，按只读纪律不触发）。

## 15. 批量能力（修正 + 打包下载）

- **批量生成**：见第 11 节——只有"单节点 x N 次"的并发确认弹窗，**没有"选中一批节点一起跑"**，
  也没有"全画布跑一遍"。文本节点的 `去生图片/去生视频` 是**逐个快捷派生**，连"多选文本节点批量派生"都没做。
  → **这是他们明确的空白，也是我们的机会点。**
- **批量下载 / 打包导出**（第一遍完全漏掉）**[CODE]**：
  - 存在 `downloadNodesMedia(节点id数组, 文件名, 空提示)` 与 `downloadGroupMedia(分组id)` 两个入口；
    分组入口的文件名是 **`分组-{N}个节点-{时间戳}`**，空组提示 `该分组暂无可下载的素材`。
  - 实现：并行 Promise.allSettled 拉取所有 `meta.mediaUrl` -> 用 **JSZip**（动态 import `jszip.min-*.js`）打包 ->
    下载 `{title}.zip`；同名自动 `名称_1.ext` 去重；扩展名缺省 `mp4/webm/png/bin`。
  - 过程 toast：`正在打包下载，请稍候...` -> `打包下载完成`；
    部分失败：`已下载 {成功}/{总数} 个素材，{失败} 个失败`；全失败：`素材下载失败，请稍后重试`。
  - **未确认**：触发这两个函数的 UI 入口（多选动作条 / 分组右键菜单）在只读探测中没找到可见按钮，
    代码里它们挂在节点动作处理与分组处理上导出，推测由多选状态或分组菜单调用。
- **"添加到资产库"**（单节点级）**[CODE]**：动作条 `添加` 按钮 -> 若素材已在自家 CDN 域内直接登记，
  否则先下载再以 `assets` 前缀重传 -> 调素材登记 `{ossUrl, name, assetType, sourceType:'generate'|'upload'}`，
  toast `已添加到我的资产库` / `该节点暂无可添加的素材` / `正在整理素材，请稍候...` / `素材整理失败，请稍后重试`。

## 16. 资产库（添加资源 -> 从资产库选择）

- **入口** **[DOM]**：右键空白 -> `从本地上传` / `从资产库选择`；或工具栏 `添加` 菜单下半区 `添加资源` 的同样两项。
- **接口** **[API 实测]**：
  - 列表 `GET /api/assets?type=all&page=1&pageSize=20` -> `{total, items[]}`
  - 配额 `GET /api/assets/quota`
  - item 字段：`{id, userId, channelId, sourceUrl, ossUrl, assetType(image|video|audio), fileSize, name, description, deletedAt, createdAt, updatedAt}`
  - 实测该账号 `total=1`：就是画布里那张 `0b10853761e8195894d39cf51734a74d.jpg`（308.2 KB）——
    **说明"上传过/点过添加"的素材才进资产库，不是自动收集全画布。**
- **弹窗 UI（DOM 全文实测）**：
  - 容器 `asset-library-modal`（720px 宽，max-h 85vh，深色玻璃拟态）
  - 标题 `从资产库选择`，副标题 **`点击资产即可选用`**
  - 工具条：搜索输入框 + `查询` 按钮
  - 类型页签：`全部 / 图片 / 视频 / 音频`
  - 常驻告示：**`附件类（图片/音频/视频）仅保留 30 天，过期自动清除。`**
  - 卡片网格 4 列：左上角类型角标、缩略图（图片可点开大图、视频带播放键）、名称（截断）、文件大小（如 `308.2 KB`）
- **来源结论**：资产库 = **用户级素材池**（上传 + 生成结果经"添加"动作入库），**跨画布复用**；
  与画布节点是两套东西——`从资产库选择` 是"把资产实例化成新节点"，不是引用。
- 另有**画布内已有节点复用**通道（`CanvasResourceDialog`）**[CODE]**：
  `从本地上传` 弹窗底部会列出**当前画布里的 text/image/video 节点**，
  卡片 tooltip **`再复制一份「{title}」到画布`**；空态 `画布中暂无文本 / 图片 / 视频节点`；
  上传区文案 `点击选择或拖入文件` / `支持 txt 文本、图片、视频`；
  错误 `仅支持 txt 文本、图片或视频文件`；副标题 `拖入或选择 txt / 图片 / 视频，添加到画布`。
- **拖拽入库**：把文件拖到画布上时显示遮罩 **`松开鼠标，把文件添加到画布`** **[CODE]**。

## 17. 导出 / 导入闭环（导入入口找到了：**就是粘贴**）

- 导出 **[实测]**：顶栏 `导出` -> 下载 `{画布名}.txt`，内容是 JSON：
  `{ "__canvas":"da-ai-canvas", "version":2, "nodes":[...], "edges":[...], "stickers":[...] }`（2 空格缩进）。
  导出前会**剥离瞬时字段**：`uploadPreviewUrl / uploadProgress / uploading / genTaskId / result` **[CODE]**。
- **导入 = 复制粘贴，没有独立的"导入"菜单** **[CODE]**：
  - `Ctrl/⌘+V` -> 读取**系统剪贴板文本** -> 用校验函数判断：
    必须以 `{` 开头、能 JSON.parse、`__canvas === 'da-ai-canvas'`、`nodes` 是数组；
    否则**整个文本按普通文本处理**（返回 null，不报错）。
  - 校验通过后 `nodes / edges / stickers` **全部重新分配 id**（node-… / edge-… / sticker-…），
    按"包围盒左上角对齐到鼠标落点"整体平移粘贴，并自动选中新节点。
  - 边的过滤规则：from / to 必须是字符串，且两端都在粘贴集合内才保留；
    便签要求 id 是字符串且 html 是字符串。
  - 若 nodes 和 stickers 都为空 -> 视为无效，不粘贴。
  - toast：`已粘贴 N 个节点` / `剪贴板为空，暂无可粘贴内容`。
- 另一个隐藏用法 **[CODE]**：**画布内复制节点（Ctrl+C）也是把同一份 __canvas JSON 写进系统剪贴板**。
  -> "复制节点"和"导出画布"是同一种格式，**跨画布/跨账号搬运的路径就是 Cmd+C 到别处 Cmd+V**。
- 导入的**失败模式**（对我们设计导入很关键）：格式不对时**静默按文本粘贴**，用户看不到"导入失败"。
  我们做导入时必须给明确报错。

## 18. 「节点功能」模板库 + 完整提示词结构（做模板库最有用的一节）

### 18.1 三层模板体系（第一遍只看到第 2 层）
| 层 | 载体 | 数量 | 是否含提示词正文 | 接口 |
|---|---|---|---|---|
| L1 模块化提示词 | modular-prompts | image 8 条 / text 0 / video 0 | **免费直接返回 prompt 全文** | `GET /api/canvas/public/modular-prompts` |
| L2 节点功能（一键模板） | node-functions | image 40 / video 19 / text 0 / audio 0 | **列表不含正文**，只有 `promptLength`；正文要 `POST /canvas/node-functions/{id}/unlock` 解锁（受 `prompt-access.canUnlock` 控制，实测本账号 `canUnlock:false`） | `GET /api/canvas/public/node-functions` |
| L3 社区同款（Featured） | featured | **272 个完整画布图** | **详情接口直接返回整张图的 prompt 全文** | `GET /api/canvas/public/featured/{id}` |

- L3 才是真正的富矿：每个 featured 都是一个**完整可跑的画布图**（nodes + edges + groups + stickers 全带）。
  价格机制：`costPoints`（多为 5 点）、`unlockType: free|member|paid`、`isUnlocked`、`discountRate`；
  配置里还有 `featuredUserTemplateDiscountRate:5`、`featuredFreeUnlockRoles:['agent','vip']`、
  列表按 `unlockCount desc` 排序、可见 `viewCount / unlockCount / favoriteCount` **[API+CODE]**。
- **节点记住自己来自哪个模板**：节点 `meta.settings.functionId` = 生成它的节点功能 id **[实测]**。
  例：`男装——模特展示2` = `cmqakuo3y00dyr3w7ita8f60i`。-> **"模板即节点"，且可追溯**，
  这对"哪个模板被用得多、效果好不好"的数据闭环非常关键。
- L2 节点功能的 `tip` 字段就是**输入槽说明书**，原文举例：
  `需要1张模特图` / `需要1张模特图和1张产品图` / `必须要有对应的模特图1张，场景图1张，衣服图5套` /
  `前提要先生成一张图片，图片在生视频`（原文有错别字）/ `必须有一张穿着想展示的服装的图片参考`。
  -> **"这个模板需要喂什么"是模板的一等公民字段。**
- L1 的分类名也值得抄：`原有模特转多角度图` / `电商` / `原有模特转三视图`。

### 18.2 三个模板的完整提示词结构拆解

#### (A) 模特类 —— 男装—模特展示（图片）（28 节点 / 45 边 / 0 便签，free）
结构：**2 个输入 -> 2 条归一化 -> 1 组输入 x 24 个"动作"叶子**
```
[模特实拍] --> "将图中衣服裤子鞋子按照电商平面图9：16展示"   <- 变量入口(模特)
[产品实拍] --> "将图中衣服裤子鞋子按照电商平面图9：16展示"   <- 变量入口(产品)
                    |  扇出到 20+ 个 image 叶子节点
                    v
   每个叶子 = 一个「男装动作」节点功能，例：
     functionId cmqakuo3y00dyr3w7ita8f60i = 男装——模特展示2   (params ratio:9:16, resolution:2K)
     functionId cmqetbw1300w611i10gir3k6v = 男装——模特展示6
     ... 展示1~13 全量铺开，每个叶子消费「1 张模特图 + 1 张产品图」
```
- **有几段**：提示词本体被**藏在节点功能里**（不在图上），图上只有 2 条"归一化"提示词 + 24 个叶子。
- **变量在哪**：变量 = **连到这个叶子的两条上游图片**（tip 原文 `需要1张模特图和1张产品图`）。
  即"变量不是占位符，是**连线的位置**"—— 这是它最核心的设计。
- 归一化提示词原文：`将图中衣服裤子鞋子按照电商平面图9：16展示`（两条文字相同、上游不同）。
- **无 negative、无镜头/时长约束**（纯图片模态）；约束靠参数 `ratio=9:16 + resolution=2K`。
- **给我们模板库的启发**：一个"模特展示"模板 = **1 组输入槽 x N 个已验证动作**，用户只需上传 2 张图。
  我们做的时候要把"哪张图是模特、哪张是产品"做成**显式命名槽**，
  而不是靠用户猜连线顺序（他们的 @图片1/@图片2 跨模板时是脆的）。

#### (B) 视频带货类 —— 薯片口播带货（8 节点 / 10 边 / 1 分组 / 5 便签，paid 5 点）
最完整的一条带货流水线：
```
(1) 参考视频 [upload, video]
      |
      v
(2) text「分镜拆解」  模型 K-Gemini-3.7-flash
    prompt: "@视频1 是要展示的参考视频，请你分析这个视频的分镜，
             给出表格格式，中文提示词，分析详尽。"
    输出: Markdown 表格，7 列 = 镜头 | 时间轴 | 景别 | 运镜/视角 | 画面内容 | 台词/音频 | 中文提示词(Prompt)

(3) 产品图 [upload]  (4) 模特图 [upload]  (5) 场景图 [upload]
      |
      +--> (6) image「合成主播图」  模型 智能图片image
      |      prompt: "@图片3 是薯片。 @图片1 是模特， @图片2 是场景。
      |              让这个模特在场景图中如同主播一样正视展示自己的薯片，
      |              桌子上要有很多薯片。"
      |      params: ratio 3:4, resolution 2K
      |
      +--> (7) text「二创分镜改写」  模型 全能语言模型G3.1-pro, deepThinking=true
             prompt: "@图片2是薯片。@图片1 是模特的展示产品图。@文本1 是分镜参考提示词，
                      请根据提示词生成专属的二创复刻提示词，视频不要有字幕，不要太多展示营销，
                      表格格式，中文提示词，人物的口播稿要和参考的语速差不多。"
             上游: [(2) 分镜拆解文本, (6) 合成主播图, (5) 场景图]
             输出: 同 7 列表格，但「台词」列改为「口播稿 (无字幕)」，Prompt 列改写为自家产品
             |
             v
(8) video「成片」  模型 全能参考视频2.0-mini, params: 3:4, 9秒, 720p
    prompt: "@图片2 产品， @图片1 是模特展示产品图。 @文本1 是视频提示词。
             要求严格按照提示词来生成。不要有字幕，不要有水印，不要出现人物的穿帮，
             不得出现乱字，人物不得崩坏。"
    上游: [(6) 合成主播图, (7) 二创分镜文本, (5) 场景图]
```
- **有几段**：4 段职责分明的提示词（分析参考 -> 合成首帧 -> 改写成自家提示词 -> 按提示词出片）。
- **变量在哪**：3 个上传槽（产品 / 模特 / 场景）+ 1 个参考视频槽，全部靠**连线位置**注入；
  文本里用 @图片1/2/3、@文本1、@视频1 引用。
- **negative（有，且是硬约束，写在正向提示词末尾）**：
  `不要有字幕，不要有水印，不要出现人物的穿帮，不得出现乱字，人物不得崩坏。`
  -> 它**没有独立的 negative 字段**，负面约束是在正向 prompt 里用"不要…"句子表达的。
- **镜头 / 时长约束**：
  - 时长与比例在节点参数里：`duration:9, ratio:3:4, resolution:720p`；
  - 镜头约束在**分镜表格的「时间轴」列**（`00:00-00:01` 等），并且**便签明确要求对齐**；
  - `景别`（中景/特写/中近景）+ `运镜/视角`（固定镜头/微俯/平视）作为结构化列，让模型逐镜可控。
- **5 张便签就是"人工教程"**（原文照抄，非常值得学）：
  1. `这个3个节点上传产品图片，模特图片和背景图片。然后让模特在背景图展示产品`
  2. `这个是AI生成的原视频作为参考。人物和薯片都是生成的`
  3. `这里是是参考视频的分镜拆解，用于后一个文本节点的参考分镜`
  4. `这里的一般720p的就可以，保证上传的薯片的文字都是清楚的就没问题。时间线可以根据复刻分镜的时间线调整。`
  5. `这里做二创提示词分镜，运行前可以先检查一遍。确保生成视频的时间和这里的时间保持一致。`
  -> **模板 = 图 + 便签教程 + 一键同款**，三者缺一不可。
- 另有 1 个 group 把 [产品图, 模特图, 合成主播图, 场景图] 框成一组（相当于"输入区"）。

#### (C) 广告类 —— 香水广告15秒（6 节点 / 4 边，free）
```
(1) image「产品概念图」 params: 16:9, 2K
    prompt（4 段，自带分栏构图规范）:
      "香水瓶子（造型时尚），瓶中有装满香水，瓶子玻璃材质（体现质感），长方形（竖着），
       玻璃瓶盖（方便拧开的形状）
       瓶身商标是一张有质感的纸面上面写着写着（电商画布，无限可能）字体排版有设计感，极简风格
       画面左边50%区域是整体瓶身，右边50%区域是瓶体的各个部位特写
       灰色棚拍背景"
(2) image 实拍图（无 prompt）
      |
      v
(3) image「提取瓶身 + 五视图」
    prompt: "将图片香水提取，按照画面左边50%区域是整体瓶身，右边50%区域是瓶体的各个部位特写
             灰色棚拍背景"
(4) image「场景氛围图」
    prompt: "@图片1 是香水暗调场景，暧昧的氛围感，香水在底座上，光线从画面左侧打在香水上，
             光线透过香水产生折射以后投射在底座上背景高级感"
(5) video  16:9 / 15s / 480p / 模型 mivideo     / functionId = 香水—广告15秒   <- 低价预览档
(6) video  16:9 / 15s / 720p / 模型 mivideo_pro / functionId = 香水—广告15秒   <- 成片档
```
- **有几段**：3 段图片提示词（概念图 -> 五视图分解 -> 场景氛围），视频提示词藏在节点功能里。
- **变量**：产品实拍图（节点 2）是唯一外部变量，通过连线进入 (3)；
  (1) 的文案是**可替换的示例品牌文字**（`电商画布，无限可能` 是占位）。
- **negative**：无显式负面句；靠"灰色棚拍背景 / 极简风格 / 暗调"等**正向风格锁定**。
- **镜头 / 时长约束**：`duration:15, ratio:16:9`；**同一提示词跑两档模型（480p 草稿 + 720p 成片）**，
  functionId 完全相同 —— 这是"**先用便宜档试，再出正片**"的成本策略，非常值得抄。
- **双视频节点共用同一 functionId** 也说明：functionId 是"提示词来源"，模型与参数是**独立可选**的。

### 18.3 模板库整体统计（40 个含"模特/带货/广告/换装/开箱"关键词的 featured）
- 结构规模：4 ~ 38 个节点；最多 16 张便签（`TK带货爆款开头>卡车快递hook`）。
- 被引用最多的节点功能 **[实测统计]**：
  `女性服装展示动作（室外）10秒` x5、`男鞋—广告15秒（登山户外）` x4、`男性模特生成（美式工装）` x4、
  `女性模特（室内）image` x3、`运动内衣展示动作（8秒）` x3、`女性睡衣展示动作（室内）10秒` x3。
- 40 个模板的节点功能分类分布：`模特生成` / `女装动作` / `男装动作`（图片 40 条）；
  `广告` / `人物动作提示词（视频）`（视频 19 条）。text / audio 分类为空。

## 19. 第一遍漏掉的其他高价值细节

1. **导演台（Director Node）** **[CODE]**：`添加节点` 菜单在 `home.config.directorNodeEnabled=true` 时会多一项
   **`导演台`**（当前开关为 false）。它是内嵌 3D 场景编辑器：多机位相机、角色、模型资产（FBX/OBJ/GLB/GLTF）、
   全景背景（JPG/PNG/WEBP，equirectangular）、工程导入导出（`工程导入失败` / `素材导入失败` /
   `仅支持 FBX、OBJ、GLB、GLTF 模型` / `仅支持 JPG、PNG、WEBP 全景图`），
   **从多个相机位批量截图并"发送到画布"**（`导演台截图-{ts}-{i}`，toast `已发送 N 张截图到画布` /
   `所选截图已在画布中`）。-> "**3D 分镜 -> 画布节点**"的重型能力，说明他们在往"可控相机"走。
2. **人脸合规认证** **[CODE]**：存在 `faceNode` / `人脸认证` 弹窗，原文
   **`将对「{节点名}」进行人脸合规与授权校验，确认后会进入认证前置流程。`**
   节点动作里有 `face` action。-> 换脸/真人相关的**合规闸门已经产品化**，电商场景必须对标。
3. **宫格切分（grid split）** **[CODE+DOM]**：图片节点动作条第一个就是 `宫格切分`；
   下拉标题 `选择宫格`，预设 `4 / 9 / 16 / 25 宫格`（2x2 ~ 5x5，每项显示 `N 宫格 / N x N`），
   另有 `自定义宫格` -> `自定义布局` 5x5 网格悬停选行列数，实时显示 `R x C`；
   计价按 `imageGridSplitScaleKey` 的 2 倍/4 倍档单独报价（`imageGridSplitScale2Value:2`、
   `imageGridSplitScale4Value:4`），模型来自 `GET /canvas/public/image-grid-split-hd-model`。
   -> **"一张图切九宫格再分别放大"是电商刚需。**
4. **图片分析提示词生成器** **[CODE]**：图片节点动作条 `图片分析` -> 本地拼一段**固定 5 段结构**的提示词并新建文本节点
   （toast `已生成图片分析提示词`，历史 `图片分析提示词`）。5 段原文结构：
   1. `主体描述：请围绕「{标题}」中的核心人物/物体进行细致描写，包含外观、姿态、服饰、表情、动作与画面占比{，画面尺寸约为 WxH}。`
   2. `环境：描述背景空间、场景材质、季节/时间氛围、前景与远景层次，以及主体和环境之间的关系。`
   3. `光影：说明主光源方向、光线软硬、明暗对比、阴影形态、肤色/材质反光和整体色温。`
   4. `镜头语言：补充景别、构图、视角、焦段感、景深、运动感和画面裁切方式。`
   5. `风格关键词：写出适合复用到生成模型的中文…`
   -> 这是一份现成的"**图像反推提示词**"骨架，可直接吸收进我们的提示词工程库。
5. **上游素材节点自动布局** **[CODE]**：上传/连接上游素材时，新节点自动放在目标节点**左侧**
   （x = node.x - 180 - 40），纵向步进 **206px**，尺寸 image 180x190、video 170x…、audio 另一套；并且**自动连边**。
   上游图片有 9 张上限（超出截断）。
6. **聚焦 / 展开** **[CODE]**：双击节点 = 缩放到 **1.6 倍**并居中；
   `fitNodesToViewport` 有 padding 常量与外边距，单节点时用更大的最大缩放。
7. **保存状态机（顶栏 4 态）** **[CODE]**：`saved -> 已保存` / `saving -> 保存中` /
   `local-only -> 未同步` / `conflict -> 未同步`，title 显示 `saveMessage`（默认 `所有修改已保存`）。
   保存用 `PUT /canvas/documents/{id}`，载荷带 `clientUpdatedAt` 与 `clientVersion`（并发控制），
   并支持 `keepalive` 的 fetch 兜底（关页面时保命保存）。
8. **节点尺寸自动跟随媒体** **[CODE]**：video/image 加载出真实尺寸后按真实像素重算节点宽高并写回
   `meta.dimensions`（`{W} x {H}`），差 >1px 才写；播放时还会回写 duration。
9. **视频源失效自愈** **[CODE]**：视频 error 事件里判断 `MEDIA_ERR_DECODE || MEDIA_ERR_SRC_NOT_SUPPORTED`
   且非生成中/非失败态 -> 自动 `replaceNodeMedia(id, url, {processVideo:true})`，即**换一个可播地址**（转码/转存），
   避免画布上出现黑块。-> 我们自己也要有这层。
10. **节点生成态与警告** **[CODE]**：节点有 `generating` / `generationStatus(pending|processing|failed|completed)`、
    `warningNodeIds`（节点级异常角标）、`mediaStatus / mediaStage / mediaProgress`。
11. **两套版本号**：导出文件里有 `version:2` + `__canvas:"da-ai-canvas"` 双重标识；
    而文档接口的 graph 里另有 `schemaVersion:5`（导出文件不含它）。做兼容时要注意。
12. **画布名与列表**：顶栏品牌 logo 点击回 `/canvas?tab=projects`；文档标题 input 宽度按标题自适应（最小 64px）。
13. **默认文案**：新节点默认内容统一是 `双击画布添加的新节点`；节点标题默认 `文本节点` /
    `图片节点` / `视频节点` / `音频节点`；上传的图片节点标题直接是文件名。
14. **提示词资产分层开放**：L1 模块化提示词免费全文可读（如 `白底图` 正文只有一句
    `将图片生成一张白底展示图，不要添加介绍文字`），L2 杀手锏模板要付费解锁。
    -> **方法论公开、生产力收费**，是很聪明的分层。

## 20. 对薯包 AI 的增补结论（在第一章第 9 节之外）

**必须对标（成本低、收益高）：**
1. **模板三段式 = 图 + 便签教程 + 一键同款**。我们有 40+ 电商经验和提示词资产，缺的正是"**把提示词画成图 + 用便签写操作说明**"这一步。
2. **模板的输入槽说明书字段（tip）**：`需要1张模特图和1张产品图`、`必须要有对应的模特图1张，场景图1张，衣服图5套`。
   把"要喂什么"做成一等公民，比任何提示词技巧都更能降低失败率。
3. **模板即节点 + functionId 可追溯**：节点记住自己来自哪个模板 -> 我们能统计模板效果、做 AB、做"同款改造"；他们只做到"用"。
4. **同提示词双档出片（480p 草稿 / 720p 成片）**：把成本策略做进模板，而不是丢给用户。
5. **图片分析 5 段骨架**（主体 / 环境 / 光影 / 镜头 / 风格）——直接进我们的提示词工程库。
6. **宫格切分 + 白底图 + 三视图**：电商最高频的三个原子操作，他们每个都有独立计价入口。
7. **任务日志字段表**（`estimatedPoints / chargedPoints / refundedPoints` + 时间轴 + 重新提交 + 复制任务ID + 客服引导）
   是"可信交付"的标准答案，直接照抄字段清单即可。
8. **画布 JSON 即剪贴板**（复制 = 导出格式），跨画布/跨账号靠 Cmd+C/V —— 极低成本的分享链路。
9. **撤销 UI 的正确姿势**：只读日志（持久化、80 条）+ 会话内快照回滚（`撤回到此步之前`），
   并诚实告诉用户"刷新前的记录无法撤回"。
10. **服务端开关驱动节点能力**（`imageWorkspace / imageGridSplitEnabled / videoScript / directorNodeEnabled`…），
    一套前端按租户/时段开关，灰度成本极低。

**他们的明确空白 = 我们的机会：**
- **没有真正的批量**：无"选中一批节点一起跑"、无"全画布跑一遍"、无队列编排；只有"同节点 x N 次"。
- **没有导入入口和导入报错**：导入靠粘贴、失败静默。
- **连线无类型 / 无标签 / 无端口语义**，右键连线菜单是死代码；数据流是软的 @图片N 引用，**模板之间不可组合复用**。
- **资产库只管"附件"且 30 天过期**，不是品牌/商品档案，无法承载"产品事实 + 合规"。
- **"应用"节点是运营白名单，不是开放生态**。
- **L2 模板提示词要付费解锁的黑盒**，用户无法审计、无法改。

**我们要补、且他们已经验证过的体验标配：** 分镜组/故事板、画布边缘自动平移、对齐吸附参考线、
便签富文本 + HTML 白名单、视频源失效自愈、保存冲突态、节点级 warning 角标、
`Ctrl+Z` 80 步 + 历史回滚双轨、拖文件入画布的遮罩提示、任务日志 15 秒轮询 + 复制任务ID。

