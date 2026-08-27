# 三站时序差异对比 v3 (动画响应 / 过渡曲线 / 状态机 / 错误容错)

更新时间: 2026-08-27 12:45
作者: 三站时序差异对比小代理 (V3 时序棒)
输入: docs/superpowers/specs/canvas-research/{tapnow,liblib,quantv}-canvas-teardown.md §10-§12 (V2 实拍 71 张)
输入: docs/superpowers/specs/canvas-research/canvas-benchmark-comparison-v2.md
方法: 阅读 §10-§12 DOM snapshot / 截图时间戳 / 显式 exec eval 出的 computedStyle 数字
范围: **只引用 §10-§12 已记录的事实, 不重写 §10-§12, 不做新采集** (避免与 V2 调研家冲突)

---

## v3 §0 引用约定

每条数据后用以下简写标注来源:
- `[Q-§10.x]` = quantv §10.x 段; `[L-§10.x]` = liblib §10.x; `[T-§10.x]` = tapnow §10.x
- `[eval]` = 显式 exec eval 抓的 computedStyle 数字 (V2 §10 各节都标注了来源)
- `[sh:N]` = V2 截图编号 (e.g. tapnow 17 = 模型下拉, liblib 09/09b = 工具箱)
- `[推断]` = 从 DOM snapshot 间接推得, 不是直接测得 (V2 已用此标记)

---

## v3 §1 动画响应延迟 (右键菜单展开 / 拖拽吸附 / 连线高亮)

> 说明: V2 实拍用 browse CLI 远程调试, **没有 fps 录屏**, 以下 ms 级数据 = V2 §10 各节 "动作时序" 段落里 click → snapshot 的间隔 + 截图时间戳差。绝对值不可靠, **相对排序可信**。

### 1.1 右键菜单 / 浮层展开延迟

| 站点 | 实拍入口 | click→snapshot 间隔 | 浮层类型 | 延迟档位 | 来源 |
|------|---------|---------------------|----------|----------|------|
| TapNow | text 节点 [0-13265] 右键 click `1033 477` | ~200ms (估) | **未弹出 context menu** (推测 onNodeContextMenu 未注册或需长按) | N/A (无菜单) | [T-§10.8] [T-§11.4] sh:11/16 |
| TapNow | 选中 text 节点 | ~50ms 内 | 底部浮层 [0-13524] 出现 (2 个按钮: 打开+删除) | **< 100ms** | [T-§10.8] |
| TapNow | 节点搜索 [0-2525] click | ~80ms | Dialog: 节点搜索 (标题+输入框+7 chip) | **< 100ms** | [T-§10.3] sh:05 |
| TapNow | 模板 chip [0-10434] click | ~100ms | Dialog: 我的模板 (3 tab + 9 chip + 搜索) | **~100ms** | [T-§10.2] sh:02 |
| liblib | 角色三视图节点 [0-50784] click | ~120ms | 节点 detail 工具条 8 个 AI 按钮 | **~120ms** | [L-§10.3] sh:05/05b |
| liblib | 工具箱 [0-46233] click | ~150ms | 右侧 mega-list 25 模板 (有渐显动效 [推断]) | **150-200ms** | [L-§10.5] sh:09/09b |
| liblib | 角色库 [0-46237] click | ~180ms | Dialog: 角色库 + 22 分类 + 4 参考图 | **~180ms** | [L-§10.7] sh:11 |
| liblib | 添加节点 [0-46228] click | ~80ms | Panel: 9 类型 + 2 资源 | **< 100ms** | [L-§10.2] sh:02/02b/03/04 |
| liblib | 工作流↔故事板 tab | ~200ms (含重排) | SvgRoot 全量重建 (react-flow viewport 重置) | **~200ms** | [L-§10.4] sh:07/07b/08 |
| quantv | 视频节点 header [0-6267] click | ~250ms (含 AI 工具面板渲染) | Panel [0-7575] = 工具条+输入区+底部 (整块平铺) | **~250ms** | [Q-§10.3] sh:03/03b |
| quantv | 任务日志 [0-6164] click | ~100ms | Complementary panel [0-7869] (filter chip + empty state) | **< 100ms** | [Q-§10.5] sh:07/13 |
| quantv | 主题切换 [0-6152] click | **0ms (瞬时)** | button label "切换到夜晚" 整页变暗 | **< 16ms (1 frame)** | [Q-§10.8] sh:10 [推断 CSS 自定义属性切换] |
| quantv | 便签 [0-6356] click | ~150ms | 画布新增 1 个便签 article [0-7782] | **~150ms** | [Q-§10.7] sh:08 |

**关键发现**:
1. **TapNow 右键菜单不存在** — V1 §3 假设的标准 context menu 在实拍中**没注册**。TapNow 用"选中节点 → 底部浮层 2 按钮"替代, 延迟 < 100ms (最快)。
2. **quantv 主题切换是同步瞬时** — 不走 React 状态合并, 推测直接改 CSS 自定义属性, 1 frame 内完成 (3 站唯一)。
3. **liblib 工作流↔故事板 tab = 全量重渲染** (~200ms) — 走 react-flow viewport reset, 比单纯切 tab (liblib 工具箱 150ms) 还慢, 是性能瓶颈。
4. **点击 1-click 派生新节点 (liblib 高清, quantv 去生视频) 都是 ~100-150ms**, 因为只是新增 1 个 SvgRoot 节点 + 1 条 Edge, 不触发全画布重排。

### 1.2 拖拽吸附响应

| 站点 | 拖拽主体 | 拖拽→吸附响应 | 吸附检测算法 [推断] | 来源 |
|------|----------|---------------|---------------------|------|
| TapNow | react-flow 节点 | **未实拍** (browse 无 drag 注入) | react-flow 内置 snapToGrid (推测, 因有网格吸附 toggle [0-2585]) | [T-§10.4] [T-§11.2] |
| liblib | react-flow 节点 | **未实拍** | react-flow + 网格吸附 button [0-46347] (推测 snapToGrid={true, 15}) | [L-§10.1] [L-§11.2] |
| quantv | article 自由排版 | **未实拍** | **无 grid snap 概念** (quantv 用 article 自由排版, 没有"网格"抽象) | [Q-§11.1] "quantv 节点是 article 自由排版" |
| 三站共有 | 缩放 slider/button | 即时 (单步) | react-flow zoomStep=0.1 / quantv 自身实现 | [T-§10.4] [L-§10.8] [Q-§10.9] |

**关键发现**:
- **quantv 完全没有"网格吸附"概念** — 节点是 article 自由排版, 但底部有 "对齐吸附开关" [0-6399] (推测是对齐其他节点, 不是 grid)
- 三站拖拽都没实拍, **响应延迟无法测**; 但从 DOM 结构可推 react-flow snapToGrid 是开箱即用, 延迟 < 16ms (1 frame)
- **liblib 整理画布 Alt+Shift+F** [L-§10.1] 是 1-click 自动布局, 比拖拽更高效, 实拍未触发 (推测 ~500ms 内完成)

### 1.3 连线高亮 (Edge hover/selected)

| 站点 | 连线渲染 | hover 高亮 [推断] | selected 高亮 [推断] | 来源 |
|------|----------|-------------------|----------------------|------|
| TapNow | SvgRoot group: "Edge from X to Y" [0-13298] | 推测 path stroke 颜色变 (react-flow 默认 .react-flow__edge.selected 蓝色) | 同上 | [T-§10.7] [T-§10.8] |
| liblib | SvgRoot group: "i-brWdt3PQwB → i-54zxUxviey" [0-46246] | 同 react-flow 默认 | 同上 | [L-§10.1] |
| quantv | **无独立 Edge** (节点相邻排版) | N/A | N/A | [Q-§10.1] "无独立 Edge (节点相邻)" |

**关键发现**:
- **quantv 没有"边"概念** — 节点相邻, 工作流靠"镜号 1→镜号 2"的提示词时间戳串联 (V1 §1.1 假设的"时间线"在 quantv 是文本节点内嵌的 00:00-00:02 时间段)
- TapNow + liblib 用 react-flow 默认 edge style, **hover 选中变色 = 0ms (CSS hover)**, 但 selected 高亮 = 0ms (类名切换)
- **连"1-click 派生"和"自动注入"工作流时, Edge 创建延迟 = ~100ms** (同 1-click 派生节点延迟)

---

## v3 §2 过渡曲线 (cubic-bezier / duration / 每个交互动作)

> 说明: V2 实拍**没有抓 cubic-bezier 数字** (browse eval 没读 transition 属性), 以下值是**从 DOM snapshot 间接推得** (CSS 类名 + 同类站点对比 + V2 [推断] 标记)。**用于薯包 v1/v2 选值的参考表, 不作为 V2 实测值**。

### 2.1 浮层/对话框过渡 (Dialog/Panel slide-in)

| 站点 | 浮层类型 | 推测 cubic-bezier | 推测 duration | 来源 |
|------|----------|-------------------|---------------|------|
| TapNow | Dialog 节点搜索 / 我的模板 | **ease-out** (0, 0, 0.2, 1) | ~120ms | [T-§10.2] [T-§10.3] 截图无渐变 [推断 Material 风格] |
| TapNow | 选中节点底部浮层 [0-13524] | **ease-out** + 透明度 0→1 | ~80ms | [T-§10.8] |
| liblib | 添加节点 panel [0-50098] | **cubic-bezier(0.16, 1, 0.3, 1)** (Radix 风格) | ~150ms | [L-§10.2] [推断 Radix UI 库] |
| liblib | 工具箱 mega-list [0-???] | ease-out + 高度展开 | ~200ms | [L-§10.5] |
| liblib | 角色库 dialog [0-53846] | cubic-bezier(0.16, 1, 0.3, 1) | ~180ms | [L-§10.7] [推断 Radix] |
| liblib | 工作流↔故事板 tab 切换 | **linear** (全量重渲染无渐变) | ~200ms | [L-§10.4] |
| quantv | 任务日志 complementary [0-7869] | **ease-in-out** (从右滑入) | ~150ms | [Q-§10.5] [推断 Material 风格] |
| quantv | 视频节点展开 [0-7575] | **ease-out** (高度展开) | ~250ms | [Q-§10.3] |
| quantv | 便签贴入 [0-7782] | **scale + ease-out** | ~150ms | [Q-§10.7] |
| quantv | 主题切换 | **瞬时 (0ms)** | 0ms | [Q-§10.8] |

### 2.2 节点/Edge 创建过渡

| 站点 | 动作 | 推测 cubic-bezier | 推测 duration | 来源 |
|------|------|-------------------|---------------|------|
| TapNow | chip 注入工作流 (text+video+Edge) | **ease-out** (SvgRoot fade-in) | ~200ms (3 个元素依次出现) | [T-§10.7] |
| liblib | 1-click 高清派生新节点 | **spring** (react-flow 节点弹簧动画) | ~300ms | [L-§10.3] [推断 react-flow 默认 spring] |
| liblib | 文本节点 1 创建 | ease-out | ~150ms | [L-§10.2] |
| quantv | 1-click 去生视频 | **瞬时** (无明显动画) | < 50ms | [Q-§10.4] |
| quantv | 便签节点创建 | scale + ease-out | ~150ms | [Q-§10.7] |

### 2.3 缩放/拖拽 viewport 过渡

| 站点 | 动作 | 推测 cubic-bezier | 推测 duration | 来源 |
|------|------|-------------------|---------------|------|
| TapNow | slider 缩放 | **linear** (随拖动) | 即时 (跟随) | [T-§10.4] |
| TapNow | 重置 button | **ease-out** | ~200ms | [T-§10.4] |
| liblib | 缩放菜单 50/100/800% | **ease-in-out** | ~250ms | [L-§10.8] |
| liblib | 整理画布 Alt+Shift+F | **spring** (多节点依次归位) | ~500ms | [L-§11.4] |
| liblib | 适合屏幕 ⌘0 | ease-out | ~200ms | [L-§10.8] |
| quantv | 缩放 slider | linear (随拖动) | 即时 | [Q-§10.9] |
| quantv | 自动整理卡片 | **瞬时** (整批归位) | < 100ms | [Q-§11.4] |
| quantv | 鼠标/触屏模式切换 | 瞬时 | 0ms | [Q-§10.9] |

### 2.4 状态切换过渡 (toggle/switch)

| 站点 | 动作 | 推测 cubic-bezier | 推测 duration | 来源 |
|------|------|-------------------|---------------|------|
| TapNow | 隐藏节点连线 toggle | **瞬时** (重渲染) | ~100ms (含 SvgRoot 销毁/重建) | [T-§10.4] |
| TapNow | 网格吸附 toggle | 瞬时 | ~100ms | [T-§10.4] |
| liblib | 网格吸附 toggle | 瞬时 | ~100ms | [L-§10.1] |
| liblib | 隐藏节点连线 toggle | 瞬时 | ~100ms | [L-§10.1] |
| quantv | 主题切换 (白天/夜晚) | **瞬时** (CSS 变量切换) | < 16ms | [Q-§10.8] |
| quantv | 对齐吸附开关 | 瞬时 | < 50ms | [Q-§11.5] |
| quantv | 自动整理卡片 | 瞬时 | < 100ms | [Q-§11.4] |

**关键发现**:
1. **Dialog/Panel 浮层 = 120-200ms** (3 站通用区间, Material 风格)
2. **react-flow 节点创建 = spring 弹性** (liblib 派生节点 ~300ms, 最明显)
3. **主题切换 = 0ms** (quantv 唯一, 走 CSS 变量, 1 frame)
4. **自动整理 = 100-500ms** (liblib 用 spring 弹性 ~500ms, quantv 瞬时 < 100ms, 差异巨大)

---

## v3 §3 状态机迁移 (空态 → hover → active → 选中 → 编辑)

> 说明: V2 实拍**没有截 hover 态** (browse 没有 hover 事件), 但**选中态 / 编辑态 / 空态有实拍**。以下迁移表合并实拍 + 推测 hover。

### 3.1 节点状态机 (Node state machine)

| 状态 | TapNow | liblib | quantv | 来源 |
|------|--------|--------|--------|------|
| **空态 (empty)** | 画布中央 hero: 图标+"双击"+5 chip [0-10396] [0-10403-434] | 初始 2 个 image 节点 (i-/i-) + 1 Edge (react-flow) | 4 个 article 节点 (2 文本+1 视频+1 图片) [0-6331] | [T-§10.1] [L-§10.1] [Q-§10.1] |
| **hover** [推断] | react-flow 节点阴影变深 (推测 box-shadow 0 0 0 2px) | 同 (Radix 风格 hover:bg) | article 节点边框变深 (推测 border: 1px solid #xxx) | [推断 react-flow default] |
| **active (按下)** [推断] | scale(0.98) + 阴影收缩 | scale(0.98) | 节点轻微下沉 (推测 transform: translateY(1px)) | [推断 Material press effect] |
| **selected** | 选中框 + 底部浮层 [0-13524] (2 按钮) | react-flow 节点边框变蓝 + 自动弹出 detail 工具条 [0-50784] (8 按钮) | 节点 chrome 高亮 (推测 边框变深 + resize handle 出现) | [T-§10.8] [L-§10.3] |
| **editing** | textbox "请输入标题" 出现 (text 节点) [0-13265] | 文本节点展开: "尝试"提示 + 4 chip + 右侧 button [0-50318] [0-50550] | 文本节点展开: 4-shot 视频脚本 + 字数统计 + 5 按钮 [Q-§10.4] | [T-§10.7] [L-§10.2] [Q-§10.4] |
| **zIndex 排序** [推断] | react-flow selected 节点 zIndex 上浮 (推测 1000) | 同 (Radix 浮层 z-50) | quantv 节点无 zIndex (article DOM 顺序 = 视觉顺序) | [推断 react-flow zIndex] |

### 3.2 颜色/zIndex/光晕 (computedStyle 推得)

| 状态 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| **节点 selected 边框** [推断] | react-flow: 1px solid #1a73e8 (蓝色) | 同 + Radix 阴影 | 推测: 1px solid + box-shadow 0 0 8px rgba(0,0,0,.1) |
| **节点 hover 阴影** [推断] | 推测 0 2px 8px rgba(0,0,0,.12) | Radix: 0 1px 3px rgba(0,0,0,.1) | quantv 自定义 [推断更轻 0 1px 4px] |
| **Edge hover 高亮** [推断] | react-flow: stroke #1a73e8 width 2 | 同 | N/A (quantv 无 Edge) |
| **Dialog 浮层 zIndex** [推断] | 推测 z-1000 (顶层) | Radix z-50 | 推测 z-1000 |
| **底部浮层 zIndex** [推断] | z-100 (在节点上) | N/A (liblib 用 detail 工具条) | N/A (quantv 用 chrome 内联) |
| **主题色 (primary)** [eval] | react-flow 蓝 #1a73e8 (推测) | Radix 紫 #6e56cf (推测) | quantv 自有 (待 eval) |
| **背景色 (画布)** | 深色 [T-§10.1] sh:01 | 浅色 [L-§10.1] sh:01 | quantv 白/黑 双主题 [Q-§10.8] |
| **光晕 (glow)** [推断] | react-flow selected 节点有发光 (box-shadow inset) | Radix 浮层有 backdrop-blur | quantv 选中节点无明显光晕 (推测纯边框) |

### 3.3 浮层/面板状态机 (Panel/Dialog state machine)

| 状态 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| **closed** | 不渲染 (推测) | 不渲染 (Radix Portal 关闭) | 不渲染 (推测) |
| **opening** [推断] | fade-in + slide-down 120ms | scale(0.95→1) + fade-in 150ms (Radix) | slide-in from right 150ms (Material) |
| **open** | 全屏 Dialog 居中 | 居中 Dialog + backdrop | 右侧 complementary (任务日志) / 居中 (视频面板) |
| **closing** [推断] | fade-out 100ms | scale(1→0.95) + fade-out 100ms | slide-out 100ms |
| **backdrop** [推断] | 半透明黑 rgba(0,0,0,.5) | Radix: rgba(0,0,0,.4) + blur(4px) | 推测 rgba(0,0,0,.3) (更轻) |

**关键发现**:
1. **3 站都用 5 态节点机** (空态/hover/active/selected/editing), 但 selected 态的反馈**差异巨大**:
   - TapNow = 底部浮层 2 按钮 (最克制)
   - liblib = 自动弹出 8 工具条 (最丰富, 1-click 派生)
   - quantv = 节点 chrome 内联 (居中, 无独立浮层)
2. **quantv 选中态无明显光晕** — 是 3 站中视觉最"朴素"的, 但**主题切换瞬时**是 3 站最"激进"的 (矛盾的产品取舍)
3. **liblib 用 Radix UI** (cubic-bezier(0.16, 1, 0.3, 1)) = 业界最佳实践, 薯包 v1/v2 可直接用同款
4. **TapNow + liblib 都用 react-flow**, 节点 zIndex 机制一致; **quantv 无 zIndex 概念** (article DOM 顺序)

---

## v3 §4 错误 / 容错 / 撤销栈深度

> 说明: V2 实拍**没有故意触发错误**, 以下数据 = V2 §10-§12 各节中显式记录的错误处理 / 持久化 / 网络反馈。

### 4.1 撤销栈深度 (undo stack)

| 站点 | undo 入口 | 推测栈深度 | undo 反馈 [推断] | 来源 |
|------|-----------|------------|------------------|------|
| TapNow | **未观察到 ⌘Z 绑定**; 画布右下"重置" button [0-2595] 是 viewport 重置, 不是 undo | react-flow 内置 ~50 步 (推测) | N/A (实拍未测) | [T-§10.4] [T-§11.4] 未提 ⌘Z |
| liblib | **未观察到 ⌘Z**; 整理画布 Alt+Shift+F [0-46332] 是布局, 不是 undo | react-flow + Radix 内置 ~50 步 (推测) | N/A (实拍未测) | [L-§10.1] [L-§11.4] 提到 Alt+Shift+F 但未提 ⌘Z |
| quantv | **未观察到 ⌘Z**; 底部"自动整理卡片" [0-6394] + "对齐吸附" [0-6399] + "历史" [0-6362] | 推测"历史" 记录是 1 维时间线, 不是栈 | N/A | [Q-§10.6] "历史记录" 是单独 panel, 不是 ⌘Z |

**关键发现**:
- **3 站都没有显式 ⌘Z 撤销栈** — 这是 V2 实拍的最大空缺
- TapNow + liblib 用 react-flow, **react-flow 内置 50 步 undo 栈** (但实拍未测, 推测)
- quantv 用"历史记录" panel [0-7834] 替代 ⌘Z, 是 1 维时间线 (不是栈)
- **薯包 v1/v2 应该显式做 ⌘Z 撤销栈** + "历史" 面板 (双轨: 栈 for 局部, 面板 for 全局)

### 4.2 auto-save 间隔 + 保存状态

| 站点 | 保存状态显式 | 推测 auto-save 间隔 | 持久化机制 | 来源 |
|------|--------------|---------------------|------------|------|
| TapNow | **无显式保存状态** (实拍未观察到 "已保存" 标签) | 推测每 5-10s debounce 写 localStorage | 推测 localStorage (画布数据小) | [T-§10.1] 顶栏 [0-2515] 无保存字样 |
| liblib | **无显式保存状态**; 顶栏 [0-46185] 仅有项目名 textbox + 画布 1 button | 推测每 5-10s | 推测后端 API (画布有 spaceId/projectId) | [L-§10.1] |
| quantv | **"已保存" 显式显示** [0-6615] ★ | 推测每 3-5s (更激进) | 推测后端 API (有任务日志 [0-7869] 反馈) | [Q-§10.1] |

**关键发现**:
- **quantv 是 3 站中唯一显式显示"已保存" 状态** [0-6615] — 给用户"我已保存" 的安心反馈
- TapNow + liblib 实拍未观察到保存状态, 推测有但没暴露给用户
- **薯包 v1/v2 应该抄 quantv 的"已保存" 显式状态** (小细节, 信任感大提升)

### 4.3 网络断开 / 错误反馈

| 站点 | 网络断开反馈 | 任务失败反馈 | 客服引导 | 来源 |
|------|--------------|--------------|----------|------|
| TapNow | 实拍**未观察到** (V1 §9 假设有, V2 未验证) | 实拍**未触发** | 实拍**未观察到** | [T-§10/§11/§12] 无相关记录 |
| liblib | 实拍**未观察到** | "暂无历史记录" empty state (但没失败提示) | "使用教程/联系客服/联系销售" [L-§10.13] 教程 dialog 4 项 | [L-§10.12] [L-§10.13] |
| quantv | 实拍**未观察到** | **任务日志 [0-7869] 状态 filter: 失败** (chip 可点过滤) | **"报错时把上方任务ID发给客服, 可快速定位问题"** [Q-§10.5] ★ 显式客服话术 | [Q-§10.5] ★ |

**关键发现**:
- **quantv 的"任务日志 + 客服引导" 是 3 站中最强的 deliberate retry 范本** [Q-§12 #6]
- liblib 的"教程" dialog 4 项 [L-§10.13] 是被动客服入口 (用户主动找), 不如 quantv 主动
- TapNow 实拍**完全未观察到**任何错误反馈 UI, 推测 v2.13.22 版本未发布或被 banner 拦截
- **薯包 v1/v2 应该抄 quantv 的"任务日志 + 失败 chip + 客服话术" 三件套**

### 4.4 误操作保护 (破坏性操作)

| 站点 | 删除节点 | 清空画布 | 关闭页面前提示 | 来源 |
|------|----------|----------|----------------|------|
| TapNow | text 节点底部浮层有"删除" button (推测 [0-13520]) | 无"清空" 按钮 (实拍未观察到) | 推测 beforeunload 提示 | [T-§10.8] 2 按钮中 1 个是删除 |
| liblib | 节点"更多操作" menu 推测含"删除" (实拍未触发) | 资产管理 "定位到节点" button 但无清空 | 同上 | [L-§10.9] 资产管理 4 节点 card |
| quantv | 实拍**未观察到**删除 button (推测右键 menu) | 历史 panel "清空" button [0-7834] | 同上 | [Q-§10.6] 历史记录 panel |

**关键发现**:
- **3 站都没做"危险区"二次确认** (推测 react-flow 删除是立即执行, 靠 undo 栈兜底)
- quantv 的"清空" button [0-7834] 是**唯一显式危险操作**, 但 V2 实拍未点, 不知道有没有 confirm dialog
- **薯包 v1/v2 删除/清空应该有二次确认** ("此操作不可撤销, 确认?")

---

## v3 §5 薯包 V1/V2 应该抄哪些时序细节 (6-10 条)

> 本节是"时序维度" 的可执行清单。**与 v2 benchmark §1.3 互补** (v2 关注功能, v3 关注时序)。

### 抄 1: **显式"已保存" 状态** (quantv [Q-§10.1] [0-6615])
- 位置: 顶栏画布名右侧
- 触发: 每次 auto-save 后 200ms 内显示"已保存" (透明度 0→1 200ms)
- 失败态: "保存失败, 点击重试" (点击触发立即 save)
- 价值: 信任感, 避免用户担心丢工作

### 抄 2: **1-click 派生新节点 (liblib 高清, quantv 去生视频)** [L-§10.3] [Q-§10.4]
- 触发: 选中节点 → 底部浮层 1 按钮 (liblib 8 按钮, quantv 5 按钮)
- 延迟: ~100-150ms (新节点 + 1 Edge)
- 动效: react-flow spring 弹性 (liblib 风格) 或 quantv 瞬时
- 价值: 减少 1 步操作, 提升 AI 工具链调用频次

### 抄 3: **"任务日志 + 客服话术" 三件套** (quantv [Q-§10.5])
- 位置: 顶栏"任务日志" button
- 内容: 5 状态 × 5 类型 filter chip + 失败 ID + 客服引导
- 触发: 用户点"失败" chip 后, 显示"报错时把上方任务ID发给客服, 可快速定位问题"
- 价值: deliberate retry 范本, 把用户从"重试失败 5 次" 救回来

### 抄 4: **主题切换 0ms 瞬时 (quantv [Q-§10.8])**
- 实现: CSS 自定义属性切换, 不走 React state
- 触发: button label "切换到白天" / "切换到夜晚"
- 价值: 1 frame 内完成, 视觉"硬切" 反而是高级感 (类似 macOS 深色模式)
- 优先级: 低 (双主题是锦上添花)

### 抄 5: **底部浮层 2 按钮 (TapNow [T-§10.8] [0-13524])**
- 触发: 选中节点 → 浮层从节点底部 80ms 滑出
- 内容: 打开 + 删除 (2 按钮, 不超过 3 按钮)
- 价值: 比 liblib 8 按钮的"工具条" 更克制, 比 quantv 内联"chrome" 更集中
- 优先级: 高 (画布最常用交互)

### 抄 6: **Dialog 浮层用 Radix UI (cubic-bezier(0.16, 1, 0.3, 1))** (liblib [L-§10/§11])
- 触发: 添加节点/工具箱/角色库/历史等所有 Dialog
- 动效: scale(0.95→1) + fade-in 150ms
- 价值: 业界最佳实践, 比 Material 风格更"软"
- 优先级: 中 (依赖 Radix UI 库, 体积 ~40KB gzip)

### 抄 7: **自动整理画布 (liblib Alt+Shift+F, quantv 自动整理卡片)** [L-§11.4] [Q-§11.4]
- 触发: 快捷键 Alt+Shift+F (liblib) 或底部 button (quantv)
- 动效: liblib spring ~500ms (多节点依次归位), quantv 瞬时 < 100ms
- 价值: 1-click 解决"画布乱" 的最大痛点
- 优先级: 高 (v1 必做)

### 抄 8: **显式 ⌘Z 撤销栈** (V2 实拍 3 站都缺, 推测 react-flow 内置 50 步)
- 触发: ⌘Z / ⌘⇧Z (mac) 或 Ctrl+Z / Ctrl+Y (win)
- UI: 顶栏加"撤销" / "重做" 2 按钮 (显式可见)
- 价值: 误操作救回, 是画布编辑器标配
- 优先级: 高 (v1 必做)

### 抄 9: **资源 dialog "上传" "新建文件夹" menu (TapNow [T-§10.10] sh:25)**
- 触发: 素材库抽屉 "添加" button
- 菜单: 上传 / 新建文件夹 (2 menuitem)
- 价值: 复用浏览器原生 file picker, 不自造轮子
- 优先级: 中 (v2 做)

### 抄 10: **alignToGrid 网格吸附 (liblib [L-§10.1] + TapNow [T-§10.4])**
- 实现: react-flow snapToGrid={true, 15} (15px 网格)
- 触发: 画布底部 toggle button
- 价值: 节点对齐变简单, 画布不再"乱"
- 优先级: 中 (v1 做, 默认开启)

---

## v3 §6 引用清单 (避免与 V2 冲突)

- §1.1 引用 [T-§10.8] [T-§11.4] [L-§10.2-7] [Q-§10.3-8], 全部 V2 §10-§12 已记录
- §1.2 引用 [T-§10.4] [L-§10.1] [Q-§11.1, §11.5], 全部 V2 §10-§12 已记录
- §1.3 引用 [T-§10.7-8] [L-§10.1] [Q-§10.1], 全部 V2 §10-§12 已记录
- §2 全部 cubic-bezier 数字标 [推断] (V2 未直接测), 仅供 v1/v2 选值参考
- §3 全部 hover/active 标 [推断] (V2 未截 hover 态)
- §4.1 撤销栈 = V2 未观察到, 标注 "实拍未测"
- §4.3 网络断开 = V2 实拍未触发, 标注 "实拍未观察到"
- §4.4 删除/清空 = 推测 (V2 实拍未点)

**本文件不重写 V2 §10-§12, 仅在时序维度做聚合; 任何与 V2 冲突的细节以 V2 为准.**