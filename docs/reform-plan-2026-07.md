# 薯包AI 电商生图模块全链路改版规划

> 本文档基于以下分析产出：
> - 前端8个核心文件逐行审查（App.jsx / Home/index.jsx / EcMode.jsx / DesignDirection.jsx / EcCanvas/index.jsx / Works/index.jsx / AppContext.jsx / api.js）
> - 后端完整链路分析（server/index.mjs 3387行 + ecommercePromptEngine.mjs）
> - 用户原始需求文档中的6大模块 + 5轮交付要求
>
> **当前状态**：规划阶段，未开始实现。此文档待确认后按模块逐步实施。

---

## 一、现状总览与核心问题

### 产品链路现状

```
上传产品图/参考图 (EcMode) 
  → 填写产品描述
  → 智能方案配置 (Sizing/Style/Params/Sku/Copy 5面板)
  → 设计方向确认 (DesignDirection / VLM分析)
  → 生成电商图 (generateEcommerce / SSE流式)
  → 画布浏览/编辑 (EcCanvas)
  → 保存到作品集 (localStorage + 服务器)
```

### 已确认的 15 个问题清单

| 编号 | 严重度 | 问题 | 所在模块 |
|------|--------|------|----------|
| P0 | 🔴 | 重绘面板"开始重绘"按钮回调为空实现，点了没反应 | EcCanvas |
| P0 | 🔴 | api.js 语法错误（已热修复，需根因追溯防止复发） | api.js |
| P1 | 🟠 | SSE 进度/图片回调在 DesignDirection 中是空壳 | DesignDirection |
| P1 | 🟠 | 加载进度计时器是固定延时（2s/4s），与API实际进度无关 | DesignDirection |
| P1 | 🟠 | 修改文案/追加图片后方向不自动刷新 | DesignDirection |
| P2 | 🟡 | EcMode 配置不持久化，刷新/返回步骤1即丢失 | EcMode |
| P2 | 🟡 | 宫格切分/裁剪未实现（仅alert占位） | EcCanvas |
| P2 | 🟡 | 智能方案中 Params/Copy 面板的 effective 值未正确回退 | EcMode |
| P2 | 🟡 | GallerySection 在设计方向页中仍渲染，占据空间 | 布局 |
| P2 | 🟡 | DesignDirectionView.jsx 是死代码，需清理 | 代码质量 |
| P3 | 🔵 | ContextMenu 关闭监听存在 setTimeout 竞态 | EcCanvas |
| P3 | 🔵 | 下载进度无反馈 | EcCanvas |
| P3 | 🔵 | 多处 useEffect 依赖数组被 eslint-disable 掩盖 | 全局 |
| P3 | 🔵 | 画布布局简陋，无侧边工具面板 | EcCanvas |
| P4 | ⚪ | AI润色按钮用 pointerEvents 而非标准 disabled | DesignDirection |

### 后端架构约束（不可改）

- `IMAGE_ROLES`：11 种固定图片角色 key（white_bg / main_text / main_3x4 / transparent / sku / detail_slice_* × 6）
- `PLATFORM_SIZES`：6 平台（淘宝/京东/拼多多/抖音/小红书/亚马逊），尺寸统一 1440×1440(1:1) 或 1440×1920(3:4)，亚马逊例外
- `STYLE_SKILLS`：5 套视觉风格（premium_minimal / lifestyle_scene / fashion_editorial / warm_natural / tech_precision）
- 后端图片生成使用 `callImageAPI` → GPT-Image-2，SSE 流式返回，并发 5 的 worker 池

---

## 二、分模块改动方案

### 模块 A：导航栏（对应需求一）

**改动文件**：`src/App.jsx`

**改动内容**：
1. SideNav 已从4按钮精简为3按钮（生图/画布/作品），确认当前实现是否完整
2. 任务栏 TaskSidebar 已从 `top:50%` 移至 `bottom:80px`，解决与 SideNav 的 zIndex 层叠残留
3. 新建按钮已使用 `NEW_WORK` dispatch，触发完整重置 + 强制 remount
4. 验证：导航左侧没有异常文本/图片残留

### 模块 B：无限画布重构（对应需求二，最重要）

**改动文件**：`src/pages/EcCanvas/index.jsx` + 新增 `ContextMenu.jsx`

**已完成的基础能力**：
- ✅ CSS Transform 实现无限平移/缩放
- ✅ 图片节点自由拖拽
- ✅ 右键上下文菜单（Portal）
- ✅ 骨架屏加载（shimmer 动画 + 淡入）
- ✅ 重绘面板（提示词编辑 + AI润色 + 追加参考图）
- ✅ 作品集 tab（localStorage + 服务器双端读取）
- ✅ 顶部工具栏（缩放控制 / 下载 / 新建）
- ❌ AirTable / Figma 式网格背景点阵
- ❌ 连线交互
- ❌ 左侧工具面板

**待完成的功能**：

| 功能 | 优先级 | 实现思路 |
|------|--------|----------|
| 左侧工具栏面板 | P1 | 52px 宽浮动工具栏：选取/文字/连线/拼图 |
| 连线交互 | P2 | SVG overlay + Bezier 曲线，选中后弹出AI指令输入框 |
| 框选多张合并长图 | P2 | 拖拽框选 → 调后端 `/api/ecommerce/stitch-long` |
| 宫格切分 | P2 | Canvas API 切片，纯前端操作 |
| 裁剪 | P2 | Portal 遮罩 + 拖拽裁剪框 |
| 导出 PSD | P3 | 按需 import `ag-psd` |
| 图片标注 | P3 | SVG 文字 + 箭头 overlay |
| Smart 分层 | P4 | 后端 AI 拆分 |

**关键 Bug 修复**：
- P0：`onRedraw` 回调从 `setRedrawPanel(null)` 改为实际调用 API
- P1：ContextMenu 关闭监听去掉 `setTimeout`，改用 `useRef` + `pointerdown` 事件

### 模块 C：图片加载优化（对应需求三）

**改动文件**：`src/pages/EcCanvas/index.jsx` + `src/pages/Home/GallerySection.jsx`

**已完成**：
- ✅ 骨架屏 shimmer 动画（已内联在 EcCanvas 的 ImageNode 中）
- ✅ `loading="lazy"` 图片属性

**待完成**：
- [ ] 缩略图预览：服务端返回图片时同时返回低质量缩略图 URL，或前端 canvas 降质压缩后先渲染模糊版本
- [ ] 预加载策略：`new Image().src = url` 预热浏览器缓存
- [ ] SSE 流式生成中的图片边生成边预热

### 模块 D：上传区复原（对应需求四）

**改动文件**：`src/pages/Home/EcMode.jsx`

**当前状态与完善**：
- 已实现单排横向滚动（产品图 + × 分隔符 + 参考图）
- 已实现互歪对称（产品图 -3deg/上浮hover、参考图 +3deg/上浮hover）
- 已实现浮动标签（"📸 产品图"和 "🎨 参考图 可选" 分别嵌在对应插槽上）
- 动态文案已添加：第0→1→2→N张逐步变化

**只需验证**：确认恢复的是"之前成熟的交互样式"——即产品图左倾、参考图右倾、中间×分隔的单行横滚布局。当前实现是否符合预期？如不符合请指出细节。

### 模块 E：按钮视觉升级（对应需求五）

**改动文件**：`src/pages/Home/EcMode.jsx` + `ec/SizingPanel.jsx` + `ec/CopyPanel.jsx` + `ec/StylePanel.jsx` + `ec/ParamsPanel.jsx` + `ec/SkuPanel.jsx`

**已完成**：
- ✅ `lucide-react` 图标统一（13个图标替换）
- ✅ 玻璃拟态面板样式（`GLASS_PANEL` 常量）
- ✅ 按钮统一样式（`BTN_BASE` + `BTN_BASE.active`）
- ✅ 智能方案指示条（绿色 = 智能开启，紫色 = 已自定义）
- ✅ SizingPanel 比例形状预览（7种比例，SVG形状卡片，Popup弹窗）
- ✅ CopyPanel 自适应高度多行 textarea

**待完成**：
- [ ] StylePanel：安装 `react-colorful`，集成 HexColorPicker 取色器
- [ ] SkuPanel：面板宽度加宽 + 字体放大至 12-13px
- [ ] ParamsPanel：添加智能指示条
- [ ] 面板定位从 `bottom` 吸附改为 `top` 向下展开

### 模块 F：整体架构优化（对应需求六）

**改动文件**：`src/services/api.js` + `server/index.mjs`

**已完成**：
- ✅ `POST /api/polish-ec-text`：文案润色
- ✅ `POST /api/reverse-prompt`：反推提示词
- ✅ `POST /api/remove-bg`：去除背景

**待完成**：
- [ ] `POST /api/canvas-save`：画布节点状态持久化
- [ ] SSE 进度回调接入 TaskStore，实现真实进度条
- [ ] 全局 ErrorBoundary（已实现）

### 模块 G：稳定性加固（新增）

**已完成**：
- ✅ 全局 ErrorBoundary（`src/components/ErrorBoundary.jsx`）
- ✅ EcCanvas 滚轮事件 try/catch 保护
- ✅ galleryImg URL 编码修复

**待完成**：
- [ ] `DesignDirectionView.jsx` 死代码清理
- [ ] 全局 `useEffect` 依赖数组审查

---

## 三、实施顺序与时间预估

按优先级排列：

```
第1批（1-2天）：P0/P1 Bug 修复
  └─ 重绘回调对接真实API → 修复EcCanvas关键bug
  
第2批（1天）：画布功能补齐
  └─ 左侧工具栏 + 宫格切分 + 裁剪 → 补齐右键菜单功能
  
第3批（1-2天）：上传区 + 视觉升级
  └─ 确认上传区布局 → StylePanel取色器 → SkuPanel加宽 → 面板定位
  
第4批（0.5天）：架构 + 稳定性
  └─ 死代码清理 → SSE进度对接 → useEffect审计 → canvas-save接口

第5批（0.5天）：构建 + 部署 + 回归验证
```

---

## 四、确认点

1. 以上模块划分是否符合你的预期？
2. 模块 D 上传区的"互歪对称+×分隔+浮动标签"样式是否就是你要的"之前成熟的交互样式"？
3. 模块 B 画布的功能优先级是否需要调整？

确认后按批次逐步实现，每批完成后附改动说明和验证截图。
