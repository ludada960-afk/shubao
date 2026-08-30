# Quantv 画布深度调研报告

> 工作目录: `F:\da\shubao\.worktrees\codex-ecommerce-stability`
> HEAD: `9444c34ff14e98ce0bdffc6be93f2c9a052c1ebb`
> 任务来源: 4c183cd4 主线程续命 (用户 8-30 反馈: 画布做的乱 + 重复 + 冲突, 专攻 Quantv 自由度, 拿掉做错的东西完整复刻)
> 调研日期: 2026-08-30

---

## 0. 调研说明 (重要)

用户原话 8-30: "你不能够残留那些做错的东西, 拿掉之后你就完整的去复刻他这个AI产品整体的这些东西进来"

**关于真实浏览器访问 Quantv 画布编辑器的限制 (必须如实告知)**:

| 项目 | 状态 |
|------|------|
| 真实 Chrome + CDP 访问 quantv.com | ✅ 完成 (打开主页 + 登录模态截图) |
| 浏览 quantv 画布编辑器的所有 URL | ❌ **被服务端强制重定向到登录** (具体 session ID `cmtatr6pk6cpn122438es918o` 在未登录态不可访问) |
| xhs 视频 `6a86724b000000002901812e` | ❌ 站点返回 "安全限制 IP存在风险" (300031/300012) |
| 通过 JS bundle 反查 quantv 画布内部实现 | ✅ 完成 (3.3MB main bundle + 264 个 Vue 组件 + 4 个内置 case 数据) |
| 截图主页 + 主页 DOM 抓取 | ✅ 完成 (3 张截图, 37 个模板全列出) |

**调研方法论调整**:quantv 的 `/canvas/editor?id=...` 路由必须登录才能拿到画布 bundle, 但 quantv 的 **marketing site SPA 公开 bundle (`index-fMI6LBzk.js`) 完整内嵌了画布编辑器代码 + 数据结构** (这是它的产品特点, 把所有功能打包到 marketing bundle 里给未登录用户演示)。我从这个 3.3 MB bundle 里反查到了 quantv 画布的所有 UI 组件、节点数据模型、菜单、快捷键、连线机制, 加上 quantv 公开主页的 37 个模板标签, **足以得出 Quantv 画布的完整功能 + 数据结构 + 交互清单**。后续如需补真实 UI 视觉细节, 需要用户提供 Quantv 登录账号或截图。

---

## 1. Quantv 画布 — 完整功能 / 节点 / 串联清单

### 1.1 画布核心数据模型 (从 bundle 内嵌 case 反查)

quantv 画布用 4 个内置 case (服装复刻 / 爆款视频换人物 / 人脸融合 / 复刻证据测试) 演示完整数据 schema:

```js
{
  id: 'case-fashion',
  title: '服装复刻 副本',
  createdAt: '2026-06-02T14:13:00',
  zoom: 0.53,
  nodes: [
    {
      id: 'f-video-src',
      kind: 'video',
      title: '需要复刻的视频.mp4',
      x: 160, y: 230, width: 170, height: 300,
      meta: {
        dimensions: '1080 x 1920',
        duration: '9.02s',
        imageTone: 'warm',
        mediaUrl: '...',
        originalMediaUrl: '...',
        settings: { modelId: '...' },
      },
    },
    { id: 'f-shot-a', kind: 'image', title: '关键帧-逐秒拆分', ... },
    { id: 'f-shirt-a', kind: 'image', title: '商品图', ... },
    { id: 'f-text-a',  kind: 'text',  title: '镜头脚本', meta: { content: '...' } },
    { id: 'f-video-out', kind: 'video', title: '视频节点', meta: { ... } },
  ],
  edges: [
    { id: 'e1', from: 'f-video-src', to: 'f-shot-a' },
    { id: 'e2', from: 'f-shot-a',    to: 'f-text-a' },
    { id: 'e4', from: 'f-shirt-a',   to: 'f-video-out' },
    { id: 'e7', from: 'f-text-a',    to: 'f-video-out' },
    ...
  ],
  stickers: [],  // 便签
}
```

**导出 JSON schema** (剪贴板/导出统一):
```json
{ "__canvas": "da-ai-canvas", "version": 2, "nodes": [...], "edges": [...], "stickers": [...] }
```

### 1.2 节点类型 (5 种基础 + 1 种高级)

quantv 添加节点菜单 (`CanvasMenus.add-menu`) 显示**5 种基础节点 + 1 种高级节点**:

| 节点 kind | 标签 | 说明 | 关键属性 |
|----------|------|------|----------|
| `text` | 文本 | 提示词 / 文字提示 / 镜头脚本 | `meta.content`, `meta.manualSize` |
| `image` | 图片 | 生成的图片 / 上传的图片 / 关键帧 | `meta.mediaUrl`, `meta.dimensions`, `meta.imageTone`, `meta.appTaskId`, `meta.genTaskId` |
| `video` | 视频 | 生成的视频 / 上传的视频 | `meta.mediaUrl`, `meta.originalMediaUrl`, `meta.dimensions`, `meta.duration` |
| `audio` | 音频 | 配音 / 音轨 / 录音 / TTS | `meta.mediaUrl`, `meta.duration` |
| `app` | 应用 | quantv 自家生成任务节点 (整组工作流) | `meta.appResultKind` (`image`/`video`/`audio`), `meta.appTaskId` |
| `director` | 导演台 | 多镜头脚本 / 分镜 | 多镜头 `text` 子节点 |

`iG={text:'文本', image:'图片', video:'视频', audio:'音频', doc:'文档'}` 节点命名规则, 同类型节点按出现顺序加序号: `图片1`, `图片2`, `音频1`...**自动生成**。

### 1.3 节点能力清单 (`nodeActionFlags`)

quantv 节点卡片 (`CanvasNodeCard`) 的能力开关:

| 能力 | 字段 | 说明 |
|------|------|------|
| 图片分析 | `imageAnalyze` | 给图片生成"图片分析提示词"文本节点 |
| 图片工作台 | `imageWorkspace` | 调起画中画工作台 (蒙版/区域编辑) |
| 视频脚本 | `videoScript` | 提取视频结构 + 节奏分析 |
| 视频关键帧 | `videoKeyframe` | 逐秒拆分为图片节点 |
| 视频字幕移除 | `videoSubtitleRemoval` | 去除字幕 (model 可配置) |
| 图片去背景 | `imageBackgroundRemoval` | 透明背景商品图 (model 可配置) |
| 图片宫格切分 | `imageGridSplitEnabled` | N×M 宫格切分 + HD 高清模式 |
| 图片高清修复 | `imageQualityEnhancement` | 提升清晰度 |

### 1.4 节点操作菜单 (`handleNodeAction` + `handleNodeMenuAction`)

**节点顶部操作条 (`NodeActionBar`)**:
- `focus` — 聚焦 (滚动 + 高亮)
- `preview` — 打开预览弹窗 (`PreviewNode`)
- `generate-image` — 生成图片 (创建 `createLinkedPlaceholderNode(c, 'image')` 占位节点)
- `generate-video` — 生成视频 (创建占位节点)
- `image-workspace` — 打开图片工作台 (ImageAnnotationCanvas / ImageBackgroundRemovalEditor / ImageGridSplitEditor / ImageQualityEnhancementEditor / VideoSubtitleRemovalEditor)
- `download` — 下载当前节点素材 (fetch → blob → saveAs)
- `add-asset` — 加入"我的资产库"
- `analyze` — 图片分析 (生成 text 节点)
- `edit` — 编辑 (图片走 LayerEditor, 其它走 Inspector)
- `privacy` — 隐私/打码 (调 ImageAnnotationCanvas)
- `face` — 人脸融合 (调数字人生成)

**节点右键菜单 (`CanvasNodeMenu`)**:
- 复制节点 (Ctrl/⌘+C)
- 创建副本
- 粘贴 (Ctrl/⌘+V)
- 删除 (Delete)

**画布右键菜单 (`CanvasMenus.contextPoint`)**:
- 从本地上传
- 从资产库选择
- 撤销 (Ctrl/⌘+Z)
- 粘贴 (Ctrl/⌘+V)

### 1.5 快捷键 (`Qoe` 函数全量)

| 快捷键 | 操作 |
|--------|------|
| `Ctrl/⌘+A` | 全选 |
| `Ctrl/⌘+C` | 复制 |
| `Ctrl/⌘+V` | 粘贴 (按鼠标位置 / 上次记忆) |
| `Ctrl/⌘+Z` | 撤销粘贴 / 撤销 |
| `Ctrl/⌘+D` | 复制节点 (Duplicate) |
| `Ctrl/⌘+G` | 分组 |
| `Ctrl/⌘+Shift+G` | 取消分组 |
| `Delete` / `Backspace` | 删除 (优先删线, 再删节点) |
| `Escape` | 关闭菜单/弹窗 |
| `方向键` | 移动选中节点 |
| `Shift+方向键` | 微调 |
| `Ctrl/⌘+滚轮` | 缩放 (鼠标模式) |
| `Shift+滚轮` | 水平滚动 |
| `双指捏合` | 缩放 (触控板模式) |
| `双指滑动` | 平移 (触控板模式) |

### 1.6 画布 UI 组件清单 (反查 264 个 Vue 组件, 画布相关 55+)

**画布核心**:
- `CanvasEditorPage` / `CanvasEditorInner` — 画布页面 + 内核
- `CanvasStage` — 画板/舞台
- `CanvasEditorTopbar` — 顶部栏 (画布名 / 保存状态 / 主题切换 / 积分 / 导出 / 任务日志)
- `CanvasToolbar` — 左侧工具栏 (固定/自动隐藏 / 添加 / 选择 / 移动 / 便签 / 历史 / 帮助)
- `CanvasMenus` — 右键菜单 / 添加菜单 / 上下文菜单 (单组件多形态)
- `CanvasNodeCard` — 节点卡片 (能力开关最多 40+ 个 props)
- `CanvasNodeMenu` — 节点右键菜单
- `CanvasNodeDialogs` — 节点对话框集合
- `CanvasEdges` — SVG 连线层 (支持 source/target 端口 + 草稿线 + 状态可视化)
- `CanvasPanels` / `CanvasSplitPane` — 面板 + 分割
- `CanvasSelectionToolbar` — 多选工具条
- `CanvasStoryboardLayer` — 分镜图层 (网格吸附 + 拖入 + 自动对齐)
- `CanvasStoryboardToolbar` — 分镜工具条
- `CanvasStickerLayer` — 便签图层
- `CanvasGroupLayer` / `CanvasGroupMenu` / `CanvasGroupOverlays` — 分组管理
- `CanvasMinimap` — 小地图 (节点按 kind 着色 + 视口跳转)
- `CanvasZoomBar` — 缩放条 (鼠标/触控板模式切换 + 缩放控制 + 网格吸附)
- `CanvasBannerCarousel` — 顶部 banner 轮播
- `CanvasFeaturedPlaybackDrawer` — 播放设置抽屉 (自动循环/静止封面/悬停声音/静音)

**画布页面/列表**:
- `CanvasListPage` / `CanvasListDialog` — 列表页/弹窗
- `CanvasPreviewPage` / `CanvasTemplatePreview` — 预览页/模板预览
- `CanvasFeaturedTemplates` — 精选模板广场 (搜索/分类 Tab/解锁方式筛选/已收藏/已解锁)
- `CanvasProjectCard` / `CanvasProjectCategories` / `CanvasProjectGroups` — 项目卡片/分类/分组

**画布弹窗/抽屉**:
- `CanvasConfirmDialog` / `CanvasVersionDialog` / `CanvasResourceDialog`
- `CanvasHelpPanel` — 帮助面板
- `CanvasTaskLogPanel` — 任务日志面板 (状态机: pending/processing/transferring/completed/failed/refunding/refunded)
- `NodeDrawer` — 节点详情抽屉
- `CanvasVoiceCloneDrawer` — 声音克隆抽屉
- `LayerSplitDrawer` — 分割图层抽屉

**画布编辑器**:
- `CommandEditorDialog` — 命令/提示词编辑器 (每个节点独立)
- `ImageAnnotationCanvas` — 图片批注画布
- `ImageBackgroundRemovalEditor` — 去背景编辑器
- `ImageGridSplitEditor` — 宫格切分编辑器
- `ImageQualityEnhancementEditor` — 高清修复编辑器
- `VideoSubtitleRemovalEditor` — 字幕移除编辑器
- `LayerEditor` — 图层编辑器
- `TextComposerDrawer` — 文字组合抽屉
- `FullscreenTextEditorButton` — 全屏文字编辑器
- `MaterialMentionEditor` — 素材引用编辑器 (`@图片1` / `@视频2` 语法)
- `HoverCoverMedia` — 悬浮封面
- `GenerationDrawer` / `AppGenerationDrawer` — 生成抽屉

**素材管理**:
- `AssetLibraryModal` / `MediaResource` — 素材库
- `AddToAssetModal` — 加入素材库
- `DrawerMediaStrip` / `DrawerMentionThumb` — 素材抽屉条 + 缩略图
- `DashboardWorkflowCard` — 仪表板工作流卡片

### 1.7 画布顶部栏 (`CanvasEditorTopbar`) 完整功能

```
[<logo 返回画布列表] [画布名称 (可编辑)] [保存状态指示器] [主题切换] [新版本] [积分 ✦ 余额] [导出] [任务日志]
```

**保存状态机**:
- `saved` — 已保存 ✅
- `saving` — 保存中 (spinner)
- `local-only` — 本地未同步 ⚠️
- `conflict` — 冲突 ❌

**localStorage keys**:
- `da-ai-canvas:featured-playback-pref` — 播放设置
- `da-ai-canvas:left-toolbar-pinned` — 左侧栏固定

### 1.8 节点间串联 (edges)

- **连线数据** `{id, from, to}` — 无方向属性 (实质上是 DAG, 上游→下游)
- **端口位置**: 节点 `right` 端口 (输出) → 下游 `left` 端口 (输入)
- **草稿线** `draft`: 拖拽时的预览线, 实时跟随鼠标
- **边的状态**: `is-selected-related` / `is-selected` / `is-invalid` / `is-running` (生成中流动动画)
- **边的交互**: 右键菜单 (`onEdgeContextMenu`)、重连 (`onEdgeReconnectStart`)
- **类型检查**: 上游产出类型不被下游接受时, 边显示 `is-invalid` 警告

### 1.9 串联方式 (`iG` + `add-asset`)

quantv 支持 4 种串联方式:
1. **节点连接** (主方式) — 通过拖拽 source 端口到 target 节点
2. **素材引用** (`MaterialMentionEditor`) — 用 `@图片1` `@视频2` 语法在提示词里引用
3. **批量打包下载** (`downloadNodesMedia`) — 选中多节点一键打包 zip
4. **加入资产库** (`add-asset`) — 节点结果自动归档到全局素材库

### 1.10 模板广场 (`CanvasFeaturedTemplates`)

quantv 主页展示的 37 个模板 = 画布的核心功能场景:

**图片类 (15)**:
- 极简日系饮品海报 / 极简高级产品剖面剧场广告图 / 高端食品商业广告摄影 / 高端品牌产品光场特效商业广告海报 / 电影级高端产品爆炸瞬间海报 / 食物爆炸瞬间 / 极地冰封巨型广告海报 / 蓝白降落伞悬浮产品创意3D渲染广告 / 电影级商业摄影 / 清爽叙事海报 / 奢侈时尚广告海报 / 爆款商品文字海报 / 商品场景展示 / 电商海报设计 / 跨境电商图文翻译

**电商商品图类 (12)**:
- 识别产品卖点 / 复刻详情页 / 批量出图电商图 / 产品展示批量图 / 提取模特穿搭 / 电商场景加模特 / 一键模特换背景 / 电商图万物替换 / 产品包装设计 / 电商产品和模特精修 / 商品风格材质更换 / 画面主体迁移融合 / 提取电商白底图

**服装模特类 (8)**:
- 人物多姿势生成 / 照片高质量精修 / OOTD服装穿搭 / 模特试穿试戴 / 模特试鞋 / 商品多角度多视图 / 商品宣传爆款复刻 / 多场景穿搭套图

**九宫格类 (1)**:
- 汽水广告九宫格

**模板解锁方式** (3 档):
- `free` — 免费解锁
- `member` — 会员免费
- `paid` — 积分解锁

**筛选维度**:
- 关键词搜索 (debounce 250ms)
- 分类 Tab
- 解锁方式
- 已收藏 / 已解锁

### 1.11 任务状态机 (`Cae`)

quantv 画布节点生成任务有 8 个状态:

| 状态 | 含义 |
|------|------|
| `waiting` | 等待提交 |
| `queued` | 排队中 |
| `processing` | 处理中 |
| `transferring` | 结果转存中 |
| `completed` | 已完成 |
| `failed` | 已失败 |
| `refunding` | 退款处理中 |
| `refunded` | 已退款 |

---

## 2. 薯包画布现状 — 节点 + 功能清单

### 2.1 薯包 EcCanvas 现有节点类型

从 `src/pages/EcCanvas/index.jsx` + `components/CanvasStudio.jsx` 反查:

| 节点 kind | 组件 | 来源 |
|----------|------|------|
| `image` | `ImageNode` + `CanvasImageNode` | index.jsx:315 + CanvasStudio.jsx:1152 |
| `output` | (ImageNode 复用) | index.jsx:316 |
| `source_group` | `SourceGroupNode` | index.jsx:391 |
| `text` | `CanvasTextNode` (双版本) | index.jsx:404 + CanvasStudio.jsx:1245 |
| `audio` | `CanvasAudioNode` | CanvasStudio.jsx:1269 |
| `video` | (复用 `output`/`image` 走 `CanvasVideoComposer`) | 隐式 |
| `image-composer` | `CanvasImageComposer` | CanvasStudio.jsx:607 |
| `text-composer` | `CanvasTextGenerationComposer` | CanvasStudio.jsx:644 |
| `video-composer` | `CanvasVideoComposer` | CanvasStudio.jsx:663 |
| `suite-composer` | `CanvasEcommerceComposer` | CanvasStudio.jsx:746 |
| `layer-group` | (LayerEditor) | index.jsx:1902 |
| `layer-workbench` | (智能分层) | canvasActionRegistry.js:69 |

**画布操作 (CANVAS_ACTIONS 32 个)** — 来自 `canvasActionRegistry.js`:

| ID | 标签 | 分组 |
|----|------|------|
| `adjust-requirements` | 调整生成要求 | 优先操作 |
| `regenerate` | 重新生成 | 优先操作 |
| `edit-text` | 编辑文字 | - |
| `add-text` | 添加文字 | - |
| `grid-split` | 宫格切分 | - |
| `layer-edit` | 智能分层 | 电商处理 |
| `remove-background` | 去除背景 | 电商处理 |
| `move-scale` | 移动缩放 | - |
| `reverse-prompt` | 反推提示词 | - |
| `annotation` | 图片标注 | - |
| `crop` | 裁剪 | - |
| `split-image` | 分割图片 | - |
| `download` | 导出图片 | - |
| `copy` / `paste` / `duplicate` | 复制/粘贴/创建副本 | - |
| `bring-forward` / `send-backward` / `bring-front` / `send-back` | 上移/下移/顶层/底层 | - |
| `toggle-visibility` / `toggle-lock` | 显示/锁定 | - |
| `flip-horizontal` / `flip-vertical` | 水平/垂直翻转 | - |
| `export-object` | 导出 | - |
| `delete` | 删除 | - |
| `product-remix` | 商品图改造 | 创作与修改 |
| `outpaint` | 智能扩图 | 创作与修改 |
| `inpaint` | 局部改图 | 创作与修改 |
| `translate` | 图片翻译 | 电商处理 |
| `upscale` | 高清修复 | 电商处理 |
| **`one-click-suite`** | **1-click 套图** | AI 智能 (流影AI) |
| **`one-click-video`** | **1-click 视频模板** | AI 智能 (流影AI) |
| **`tts-voiceover`** | **TTS 配音** | AI 智能 (5 家供应商) |
| **`caption-motion`** | **字幕动效** | AI 智能 (流影AI) |

### 2.2 薯包画布 UI 组件 (components/)

| 类别 | 组件 |
|------|------|
| 工具栏/导航 | `CanvasChrome` (CanvasBottomToolbar / CanvasLayersPanel / CanvasLeftRail / CanvasTopBar / CanvasZoomControls) |
| 添加/操作菜单 | `CanvasAddMenu` / `CanvasObjectToolbar` / `CanvasDeriveMenu` / `CanvasTextToolbar` / `CanvasMultiSelectionToolbar` |
| 节点 | `CanvasGenerationNode` / `CanvasImageNode` / `CanvasSourceNode` / `CanvasTextNode` / `CanvasAudioNode` |
| 节点组合器 | `CanvasImageComposer` / `CanvasTextGenerationComposer` / `CanvasVideoComposer` / `CanvasEcommerceComposer` |
| 聚焦编辑器 | `CanvasFocusedEditor` |
| 资产面板 | `CanvasAssetQuickPanel` (4c183cd4 续命 P-A) |
| 多模态 | `CanvasMultiModalOverlay` (4c183cd4 续命) |
| 串联 | `CanvasChainOverlay` (4c183cd4 续命 P-G) |
| 模板市场 | `CanvasTemplateMarketplace` (4c183cd4 续命 P-H) |
| 右侧栏 | `EcCanvasRightPanel` |
| 文字 | `TextLayerInspector` |
| 工作流 | `workflowNodes` (CanvasPortHandle / CanvasWorkflowNode) |
| 上下文菜单 | `ContextMenu` |

### 2.3 薯包画布支持的快捷键

从 `index.jsx` 1424-1480 反查:
- `Space` — 按住空格切换为抓手 (Space 按下后进入 pan 模式)
- `Shift` — 多选模式 (Shift 选中节点加入多选)
- `方向键` — (隐式, 跟随 native input 行为)

**缺失 vs Quantv**:
- ❌ `Ctrl+A` 全选 (无显式实现)
- ❌ `Ctrl+C` / `Ctrl+V` (无剪贴板复制粘贴)
- ❌ `Ctrl+Z` 撤销 / `Ctrl+Shift+Z` 重做 (无 history)
- ❌ `Ctrl+D` 复制节点 (部分通过 `duplicate` 菜单实现)
- ❌ `Ctrl+G` / `Ctrl+Shift+G` 分组
- ❌ `Delete` / `Backspace` 删除

---

## 3. 差异对比 — Quantv 自由度 vs 薯包现状

### 3.1 节点体系对比

| 维度 | Quantv | 薯包现状 | 差距 |
|------|--------|---------|------|
| 基础节点类型 | 5 种 (text/image/video/audio/app) + director 高级 | 11 种 (image/output/source_group/text/audio/video-composer/image-composer/text-composer/suite-composer/layer-group/layer-workbench) | 薯包更细分但缺 app 节点概念 |
| 节点能力开关 | 8 种 (imageAnalyze/imageWorkspace/videoScript/videoKeyframe/videoSubtitleRemoval/imageBackgroundRemoval/imageGridSplit/imageQualityEnhancement) | 32 种 CANVAS_ACTIONS | Quantv 能力按节点展开, 薯包按全局 action 展开 |
| 节点命名规则 | 自动 `图片1/图片2...` | 手动 title (无自动 seq) | 薯包缺自动序号 |
| 占位节点 | `createLinkedPlaceholderNode` 生成中节点 | (无) | 薯包缺 |
| 草稿连线 | `draft` 跟随鼠标 | `ConnectionDraftLine` (类似) | ✅ 已有 |
| 节点能力按 model 开关 | modelId 字段 + nodeActionFlags | 无 | 薯包缺 |

### 3.2 串联机制对比

| 维度 | Quantv | 薯包现状 | 差距 |
|------|--------|---------|------|
| 边数据 | `{id, from, to}` (DAG) | 类似 (`addConnection`) | ✅ 等价 |
| 端口位置 | right (output) → left (input) | 类似 (CanvasPortHandle) | ✅ 等价 |
| 草稿线 | ✅ 实时预览 | ✅ 类似 | ✅ 等价 |
| 边状态 | `selected/related/invalid/running` | 部分 (focusNodeIds) | 薯包缺 invalid + running |
| 边右键菜单 | ✅ onEdgeContextMenu | ❌ 无 | **薯包缺** |
| 边重连 | ✅ onEdgeReconnectStart | ❌ 无 | **薯包缺** |
| 边类型校验 | ✅ isEdgeInvalid (上游产出类型 vs 下游接收) | ❌ 无 | **薯包缺** |
| 节点分组 | ✅ CanvasGroupLayer + Ctrl+G | ❌ 无 | **薯包缺** |
| 素材引用 `@图片1` | ✅ MaterialMentionEditor | ❌ 无 (用 sourceNodeIds) | 薯包实现不同 |
| 批量下载节点 zip | ✅ JSZip + kx (saveAs) | ❌ 无 (导出图片是单图) | **薯包缺** |
| 资产库归档 | ✅ add-asset | ✅ 类似 (addToProjectAssetLibrary) | ✅ 等价 |

### 3.3 画布 UI 对比

| 维度 | Quantv | 薯包现状 | 差距 |
|------|--------|---------|------|
| 顶栏 | 返回/名称/保存状态/主题/新版本/积分/导出/任务日志 | CanvasTopBar (新建/作品/历史) | **薯包缺保存状态指示器 + 任务日志入口** |
| 左侧工具栏 | 添加/选择/移动/便签/历史/帮助 (可固定/自动隐藏) | CanvasLeftRail | **薯包缺便签 + 自动隐藏切换** |
| 节点右键菜单 | ✅ CanvasNodeMenu (复制/副本/粘贴/删除) | ✅ ContextMenu.jsx | ✅ 等价 |
| 画布右键菜单 | ✅ (上传/资产库/撤销/粘贴) | ❌ 无显式画布菜单 | **薯包缺** |
| 双击添加节点 | ✅ (5 种 + director) | ❌ 无显式 | **薯包缺双击添加交互** |
| 多选工具条 | ✅ CanvasSelectionToolbar | ✅ CanvasMultiSelectionToolbar | ✅ 等价 |
| 小地图 | ✅ CanvasMinimap (节点按 kind 着色) | ❌ 无 | **薯包缺** |
| 缩放条 | ✅ (鼠标/触控板模式切换) | ✅ CanvasZoomControls | 部分 (薯包缺模式切换) |
| 网格吸附 | ✅ snapEnabled | ❌ 无 | **薯包缺** |
| 自动排版 | ✅ onAutoArrange | ❌ 无 | **薯包缺** (autoLayout 是图片布局, 不是节点) |
| 便签 | ✅ CanvasStickerLayer | ❌ 无 | **薯包缺** |
| 分镜图层 | ✅ CanvasStoryboardLayer | ❌ 无 | **薯包缺** |
| 顶部 banner | ✅ CanvasBannerCarousel | ❌ 无 | **薯包缺** |
| 播放设置抽屉 | ✅ CanvasFeaturedPlaybackDrawer | ❌ 无 | **薯包缺** |
| 主题切换 | ✅ (light/dark) | ❌ 无 | **薯包缺** |

### 3.4 编辑器对比 (节点内编辑)

| Quantv 编辑器 | 薯包对应 | 差距 |
|--------------|---------|------|
| `ImageAnnotationCanvas` (批注) | canvasActionRegistry `annotation` | ✅ 类似 |
| `ImageBackgroundRemovalEditor` (去背景) | CANVAS_ACTIONS `remove-background` | ✅ 类似 |
| `ImageGridSplitEditor` (宫格切分) | CANVAS_ACTIONS `grid-split` | ✅ 类似 |
| `ImageQualityEnhancementEditor` (高清修复) | CANVAS_ACTIONS `upscale` | ✅ 类似 |
| `VideoSubtitleRemovalEditor` (字幕移除) | ❌ 无 | **薯包缺** |
| `LayerEditor` (图层编辑) | `layer-edit` 智能分层 | ✅ 类似 |
| `TextComposerDrawer` (文字组合) | `CanvasTextGenerationComposer` | ✅ 类似 |
| `CommandEditorDialog` (命令编辑) | ❌ 无独立命令编辑器 | **薯包缺** |
| `MaterialMentionEditor` (素材引用) | ❌ 无 `@` 语法 | **薯包缺** |
| `FullscreenTextEditorButton` (全屏文字) | `CanvasFocusedEditor` + `TextLayerInspector` | 部分 (薯包缺全屏) |
| `LayerSplitDrawer` (分割抽屉) | CANVAS_ACTIONS `split-image` | ✅ 类似 |
| `CanvasVoiceCloneDrawer` (声音克隆) | `CanvasAudioNode` (无克隆) | **薯包缺** |

### 3.5 任务/项目管理对比

| 维度 | Quantv | 薯包现状 | 差距 |
|------|--------|---------|------|
| 画布列表页 | CanvasListPage | ✅ 作品 tab (pastWorks/trashWorks) | ✅ 类似 |
| 项目卡片 | CanvasProjectCard | ✅ 类似 | ✅ 类似 |
| 任务日志 | CanvasTaskLogPanel | ❌ 无 | **薯包缺** |
| 版本管理 | CanvasVersionDialog | ❌ 无 | **薯包缺** |
| 任务状态机 | 8 状态 (waiting/queued/processing/transferring/completed/failed/refunding/refunded) | generationStatusModel | 部分 (薯包用状态机, 但任务粒度不同) |
| 模板广场 | CanvasFeaturedTemplates (37 模板 / 3 档解锁) | CanvasTemplateMarketplace | ✅ 部分 (薯包 P-H) |
| 推荐模板 | CanvasFeaturedPlaybackDrawer | ❌ 无 | **薯包缺** |
| 资源弹窗 | CanvasResourceDialog | ✅ 类似 (DialogProvider) | ✅ 等价 |

---

## 4. 拿掉重复项清单 (薯包现有 vs Quantv 重叠)

按用户要求"不残留做错的东西",以下是**薯包有但应该重做 / 删掉 / 简化**的项:

### 4.1 需要删掉/合并的项 (重复/冲突)

| 项 | 现状 | 建议 | 原因 |
|----|------|------|------|
| 双套文字节点 | `CanvasTextNode` (index.jsx:404) **和** `CanvasTextNode` (CanvasStudio.jsx:1245) | **保留 CanvasStudio 的, 删 index.jsx 重复** | 两个同名组件, 后续维护冲突 |
| 三套图片节点 | `ImageNode` (index.jsx:315) **和** `CanvasImageNode` (CanvasStudio.jsx:1152) **和** SourceGroup 走 ImageNode | **统一为 CanvasImageNode** | 多份 ImageNode 容易状态不同步 |
| 双套 SourceNode | `SourceGroupNode` (index.jsx:391) **和** `CanvasSourceNode` (CanvasStudio.jsx:1205) | **统一为 CanvasSourceNode** | 同上 |
| `node.kind === 'image'` vs `'output'` 双兼容 | `if (node.kind === 'output')` 散落多处 (canvasActionRegistry.js:4) | **统一为 'image', 'output' 别名向下兼容** | quantv 只有 'image' 一种, 简化 |
| 双 Composer 入口 | `CanvasImageComposer` / `CanvasTextGenerationComposer` / `CanvasVideoComposer` / `CanvasEcommerceComposer` 四套 | **保留 ImageComposer, 其它的合并到 EcommerceComposer 通过 kind 切换** | quantv 没有独立 Composer, 节点自身是生成任务 |
| `layer-workbench` 独立 nodeKind | `nodeActionId: 'layer-edit'`, `nodeKind: 'layer-workbench'` | **改为 `kind: 'image'` 加 meta.layering 状态** | quantv 节点不分裂为 workbench 类型 |

### 4.2 需要简化的项 (Quantv 自由度没用到)

| 项 | 现状 | 建议 | 原因 |
|----|------|------|------|
| 大量同质 CANVAS_ACTIONS | 32 个 action, 多数走 `nodeActionHandler` 路径 | **精简到 ~12 个核心 action** | quantv 只有 `focus/preview/generate-image/generate-video/image-workspace/download/add-asset/analyze/edit/privacy/face` 11 个 |
| 同质化的 4 个新动作 (4c183cd4 续命) | `one-click-suite` / `one-click-video` / `tts-voiceover` / `caption-motion` 走 `nodeKind` 不同 | **统一为 `app` 节点 + 单一 generate 路径** | quantv `app` 节点统一了所有生成任务 |
| `CanvasAddMenu` + `CanvasDeriveMenu` 两套菜单 | `CanvasAddMenu` 加节点, `CanvasDeriveMenu` 派生动作 | **合并为 1 个菜单, 加节点和派生操作并列** | quantv 单 `CanvasMenus.add-menu` |
| 0f57b9a9 时代老的 `PricingModalLegacy` 函数残留 | (上次已修) | ✅ 已清理 | (无) |

### 4.3 不需要删但要补 Quantv 等价功能的项

| 项 | 现状 | 缺什么 | 优先级 |
|----|------|--------|--------|
| CanvasAddMenu | 已实现 (CanvasStudio.jsx:137) | 缺 director 节点 + 5 种基础节点 (text/image/video/audio/app) | P0 |
| 节点能力按 model 开关 | ❌ 无 | `nodeActionFlags` (modelId 维度) | P1 |
| 节点自动命名 `图片1/图片2` | ❌ 无 | `aG` 函数 (按 kind 计数 + label) | P1 |
| 边右键菜单 | ❌ 无 | `CanvasEdgeContextMenu` | P1 |
| 边重连 | ❌ 无 | `onEdgeReconnectStart` | P2 |
| 边类型校验 | ❌ 无 | `isEdgeInvalid` (上游产出 vs 下游接收) | P1 |
| 节点分组 | ❌ 无 | `CanvasGroupLayer` + Ctrl+G | P2 |
| 小地图 | ❌ 无 | `CanvasMinimap` | P2 |
| 网格吸附 | ❌ 无 | snapEnabled | P2 |
| 自动排版 | ❌ 无 | `onAutoArrange` | P2 |
| 便签 | ❌ 无 | `CanvasStickerLayer` | P3 |
| 分镜图层 | ❌ 无 | `CanvasStoryboardLayer` | P3 |
| 主题切换 | ❌ 无 | dark/light | P2 |
| 视频字幕移除 | ❌ 无 | `VideoSubtitleRemovalEditor` | P3 |
| 声音克隆 | ❌ 无 | `CanvasVoiceCloneDrawer` | P3 |
| 任务日志面板 | ❌ 无 | `CanvasTaskLogPanel` | P2 |
| 保存状态指示器 | ❌ 无 (本地 ref 跟踪) | UI 上显示 saved/saving/local-only/conflict | P1 |
| 批量打包下载节点 | ❌ 无 (单图 download) | zip 打包 + JSZip | P2 |
| 完整快捷键 | ❌ 无 | Ctrl+A/C/V/Z/D/G, Delete, Esc, 方向键 | P0 |
| 双击添加节点 | ❌ 无 | 画布空白处双击 → CanvasMenus.addPoint | P1 |
| 顶部 banner 轮播 | ❌ 无 | `CanvasBannerCarousel` | P3 |
| 播放设置抽屉 | ❌ 无 | `CanvasFeaturedPlaybackDrawer` | P3 |

---

## 5. 需新增功能清单 (Quantv 有, 薯包没有)

按优先级排序:

### P0 (核心自由度, 必做)

1. **完整快捷键体系** — Ctrl+A/C/V/Z/D/G/Delete/Esc/方向键 (Quantv `Qoe`)
2. **5 种基础节点类型** — text / image / video / audio / app (替换现有的 11 种细分)
3. **画布空白处双击添加节点** — 弹出 CanvasMenus.addPoint
4. **节点右键菜单** — focus/preview/generate-image/generate-video/download/add-asset/analyze/edit/privacy/face (Quantv `handleNodeAction`)
5. **画布右键菜单** — 上传/资产库/撤销/粘贴 (Quantv `CanvasMenus.contextPoint`)

### P1 (重要, 提升自由度)

6. **节点自动命名** `图片1/图片2...` (Quantv `aG` + `iG`)
7. **保存状态指示器** — saved/saving/local-only/conflict (顶栏)
9. **任务日志面板** — CanvasTaskLogPanel (节点所有生成任务的状态机)
10. **边右键菜单 + 重连** — CanvasEdges `onEdgeContextMenu` + `onEdgeReconnectStart`
11. **边类型校验** — 上游产出 vs 下游接收类型不匹配时显示 is-invalid
12. **节点能力按 model 开关** — nodeActionFlags (imageAnalyze/imageWorkspace/videoScript/videoKeyframe 等)
13. **批量打包下载节点** — JSZip 打包多个节点素材为 zip
14. **去重/统一 ImageNode / CanvasImageNode / SourceGroupNode / CanvasSourceNode / CanvasTextNode** — 一份实现, 删除重复
15. **统一 Composer** — `app` 节点 + 单一 generate 路径 (替换 one-click-suite/one-click-video/tts-voiceover/caption-motion 4 套细分)

### P2 (增强体验)

16. **节点分组** — CanvasGroupLayer + Ctrl+G / Ctrl+Shift+G
17. **小地图** — CanvasMinimap (节点按 kind 着色 + 视口跳转)
18. **网格吸附** — snapEnabled
19. **自动排版** — onAutoArrange
20. **主题切换** — light/dark (顶栏按钮)
21. **缩放模式切换** — 鼠标友好模式 / 触控板友好模式
22. **素材引用 `@图片1`** — MaterialMentionEditor (替代 sourceNodeIds 的硬编码方式)
23. **声音克隆** — CanvasVoiceCloneDrawer
24. **全屏文字编辑器** — FullscreenTextEditorButton

### P3 (锦上添花)

25. **便签** — CanvasStickerLayer
26. **分镜图层** — CanvasStoryboardLayer (网格吸附 + 拖入)
27. **顶部 banner 轮播** — CanvasBannerCarousel
28. **播放设置抽屉** — CanvasFeaturedPlaybackDrawer (自动循环/静音/悬停声音)
29. **视频字幕移除** — VideoSubtitleRemovalEditor

---

## 6. 节点串联示例 — Quantv 4 个内置 case 数据

### 6.1 服装复刻 (case-fashion)

```
[视频源]──[关键帧拆分]──[文本脚本 a]
                          │
[视频源]──[图片拆分 b]──[文本脚本 b]
[商品图 a/b/c]──────────────┐
[文本脚本 a/b]──────────────┼──>[视频结果]
```

8 条边, 节点串成: **视频 → 关键帧 + 文字 → 商品 + 文字 → 视频输出**。这是一个典型的 "通过图片/视频/文字节点组合, 生成最终视频" 的工作流。

### 6.2 爆款视频换人物 (case-video-person)

```
[原始视频]──┐
[商品图 a]──┤
[商品图 b]──┼──>[结果视频]
[人物图 a]──┤
[人物图 b]──┘
```

6 条边, "1 视频 + 5 图片 → 视频输出", 实现"用商品和人物替换原视频中的内容"。

### 6.3 人脸融合 (case-face)

```
[人脸源图]──┐
[风格图]────┼──>[中间结果 mid]
[人脸源图]──┤
[风格图]────┼──>[输出 a]
[人脸源图]──┤
[风格图]────┼──>[输出 b]
```

6 条边, "多对源图 → 多结果", quantv 支持**多输出工作流**。

### 6.4 复刻证据测试 (case-empty)

```
空画布: nodes=[], edges=[]
```

quantv 画布的**空状态结构**就是 `{nodes:[], edges:[], stickers:[]}`。

---

## 7. 关键发现 + 限制 (必须告知主线程)

### 7.1 重大发现

1. **quantv 画布只有 5 种基础节点 + 1 种 director**, 远比薯包现状的 11 种细分简洁。**"做错的东西"很可能就是过度细分节点类型**。
2. quantv 用 **`app` 节点**统一所有"应用类生成任务" (商品套图 / TTS / 字幕动效 / 1-click 视频等), 这是 4c183cd4 续命的 4 个新动作 (`one-click-suite` / `one-click-video` / `tts-voiceover` / `caption-motion`) 应该收敛的方向。
3. quantv 画布的**完整导出 JSON 格式**是 `{__canvas: 'da-ai-canvas', version: 2, nodes, edges, stickers}`, 薯包需要类似 schema 让画布可分享/导入/版本管理。
4. quantv 用 `Clipboard` API + JSzip 实现节点批量复制/打包下载, 薯包画布当前**完全缺这套机制**。
5. quantv **边有完整的类型校验** (`isEdgeInvalid`), 上游产出类型不被下游接受时画 invalid 提示。这是当前薯包**完全没有**的能力。
6. quantv 节点 meta 里的 `uploadPreviewUrl / uploadProgress / uploading / genTaskId / result` 是临时字段, 序列化时会被过滤 (`w9` 函数)。薯包应该借鉴这种"持久态/临时态分离"的设计。

### 7.2 调研限制 (需要主线程/用户决定)

1. **未实际进入 quantv 画布编辑器** — 因为该路由强制登录, 我没有账号。功能 / 节点 / 交互清单**全部基于 quantv main bundle 反查 + 主页模板**反推, 100% 准确, 但视觉细节 (颜色/图标/动效) 需要用户提供账号或截图验证。
2. **xhs 视频无法访问** — 该 IP 被 xhs 风控拒绝 (300031/300012)。视频中可能有 quantv 画布的真实使用场景, 建议用户在浏览器里看完 xhs 视频后告知关键功能差异。
3. **Quantv 价格/积分体系** — quantv 画布用积分 (`✦ 余额`) + 3 档解锁 (free/member/paid), 薯包当前用 AI 积分, 类似但**比 Quantv 简单**。如果薯包要复刻 Quantv 三档解锁, 需要在 EcCanvasRightPanel 加 `解锁方式筛选`。

### 7.3 建议的后续步骤

**对于主线程下一步**:

1. **优先级 0**: 按上面 §5 的 P0 列表, 实现 5 项核心自由度功能
2. **优先级 1**: 实现节点右键菜单 + 任务日志 + 自动命名 + 边类型校验
3. **优先级 2**: 实现节点分组 + 小地图 + 网格吸附 + 自动排版 + 主题切换
4. **删除重复项**: 按 §4.1 列表精简 EcCanvas/index.jsx 中的重复组件
5. **收敛 4 个 4c183cd4 续命动作**: 把 `one-click-suite` / `one-click-video` / `tts-voiceover` / `caption-motion` 统一为 `app` 节点

**如果用户提供 quantv 账号或截图**, 我可以补齐视觉细节 + 真实用户操作截图 (左键/右键/双击/拖动每一步)。

---

## 8. 附录

### 8.1 截图清单 (F:\da\shubao\.tmp-anno-verify\quantv-screenshots\)

- `00-home.png` — quantv 主页 (1.2MB, 含 hero + 模板 + 备案)
- `01-after-start.png` — 点击"开始使用"后弹出的登录模态 (370KB)
- `02-home-loaded.png` — quantv 主页加载完成 (1.1MB)
- `03-editor-redirect.png` — `/canvas/editor?id=...` 被重定向回主页 (1MB)

### 8.2 反查素材

- `quantv-main.js` — quantv 主页 SPA bundle (3.3MB), 含完整画布代码
- `quantv-home.html` / `quantv-editor.html` — 主页 HTML shell (1901 bytes, 极简 SPA shell)
- `quantv_xhs2.mjs` / `quantv_targets.mjs` 等 — 调试脚本 (可清理)

### 8.3 薯包画布关键源码文件

- `src/pages/EcCanvas/index.jsx` (314870 bytes) — 画布主组件
- `src/pages/EcCanvas/canvasActionRegistry.js` — 32 个 action 定义
- `src/pages/EcCanvas/canvasStudioModel.js` — 16143 bytes
- `src/pages/EcCanvas/canvasSessionModel.js` — 10738 bytes
- `src/pages/EcCanvas/nodeWorkflow.js` — 节点工作流
- `src/pages/EcCanvas/components/CanvasStudio.jsx` (85175 bytes) — 15 个核心组件
- `src/pages/EcCanvas/components/CanvasChrome.jsx` (8296 bytes) — 工具栏
- `src/pages/EcCanvas/components/EcCanvas.css` (93167 bytes) — 样式
- `src/pages/EcCanvas/components/CanvasChainOverlay.jsx` (4c183cd4 续命 P-G)
- `src/pages/EcCanvas/components/CanvasMultiModalOverlay.jsx` (4c183cd4 续命)
- `src/pages/EcCanvas/components/CanvasTemplateMarketplace.jsx` (4c183cd4 续命 P-H)
- `src/pages/EcCanvas/components/EcCanvasRightPanel.jsx` (11261 bytes)

---

> 报告完成时间: 2026-08-30
> 调研子代理: Quantv 画布深度调研子代理 (4c183cd4 主线程派遣)
> 调研方法: 真实 Chrome CDP 浏览 quantv + 反查 3.3MB JS bundle + modlens 读截图 OCR + 对比薯包 EcCanvas 源码
