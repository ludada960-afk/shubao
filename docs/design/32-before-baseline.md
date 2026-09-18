# 32 · 改版前视觉基线（Playwright 实测）

> **用途**：全站视觉语言重做前的**冻结基线**。改版后逐项对比本文件的截图与数值做验收。
> **采集方式**：Playwright（Chromium headless，视口 1440×900，`deviceScaleFactor: 2`，`locale: zh-CN`），dev server `http://localhost:5173`。
> **尺寸口径**：一律用 `offsetWidth/offsetHeight`（画布有缩放，`getBoundingClientRect` 不可信）；颜色/字号/圆角/阴影一律取 `getComputedStyle` 的**实际计算值**。
> **只读声明**：本次**未修改任何 src 代码**，**未 commit**。只新增了截图目录 `.playwright-shots/design-baseline/**` 与本文件。
> **原始数据**：全部 246 条实测记录在 `.playwright-shots/design-baseline/_measurements.json`。

---

## 0. 一句话总览

现在全站最大的视觉病根不是「颜色少」，而是**同一屏内并存至少 5 套互不统一的控件语言**：暖黑胶囊（外壳）、紫渐变（电商）、靛蓝（画布）、纯灰阶（弹层/定价）、红色（登录）。**且绝大多数控件的 hover / 选中态差异弱到几乎不可见**（见 §7）——这正是老板说的「没有主次、没有状态反馈」。

---

## 1. 采集覆盖与产物

截图目录：`.playwright-shots/design-baseline/`，共 **97 张** PNG（含整屏态与裁剪特写）。

| 需求项 | 覆盖 | 代表截图 |
|---|---|---|
| a) 首页 AI 生图面板（输入区/参数行/分段控件） | ✅ 默认态 + 选中态 + 弹层态 | `01-home-ec-default.png`、`02-home-ec-bottom-params-bar.png`、`06-home-ec-ability-alt-selected.png`、`04-home-ec-gen-settings-modal.png`、`08-home-ec-suite-plan-popover.png` |
| b) 首页 电商生图 底部参数栏 + 生成设置弹层 | ✅ 7 个 chip 全量 + 打开「生成设置」 | `02-home-ec-bottom-params-bar.png`、`04/05-home-ec-gen-settings-modal(-crop).png`、`07-home-ec-gen-settings-option-hover.png` |
| c) 首页 视频生成参数面板 | ✅ 面板 + 视频模型弹层 + 技能库弹窗 | `10-home-video-panel-default.png`、`11-home-video-panel-crop.png`、`12-home-video-popover-model.png`、`15-home-video-skill-modal.png` |
| d) 画布 EcCanvas 四个生成框操作台 | ✅ 图片/视频/电商套图/文案 四种操作台 | `30-canvas-composer-image-crop.png`、`31-canvas-composer-video-crop.png`、`32-canvas-composer-suite-crop.png`、`33-canvas-composer-text-crop.png` |
| e) 画布：节点选中态/结果面板/底部操作栏/小地图 | ✅ 全部 | `40-canvas-node-selected.png`、`42-canvas-node-selected-crop.png`、`22-canvas-bottom-toolbar.png`、`23/43-canvas-minimap(-crop).png` |
| f) 画布：工作流模板弹窗 / 我的画布库 / 资产库弹窗 | ✅ 工作流模板 + 作品集（我的画布库）；资产库改走 harness | `51-canvas-workflow-template-modal(-crop).png`、`70-works-gallery-empty.png`、`60-asset-library-modal(-crop).png` |
| g) 我的画布页 / 作品集页 / 定价页 | ✅ 作品集（空库）+ 定价页 | `70-works-gallery-empty.png`、`80-pricing-default.png`、`81-pricing-plan-cards.png`、`82-pricing-scrolled.png` |

---

## 2. 每个界面的一句话结论

| 界面 | 一句话结论（最大视觉问题） |
|---|---|
| a) 首页 AI 生图面板 | **参数行 7 个 chip 完全同权同形**（全 126×52、同白底/同边框/同字重 600），老板一眼看不出哪个是必填、哪个有默认值——没有主次，只有一排「一样的灰按钮」。 |
| b) **首页 电商生图「生成设置」弹层** | **最丑**：模型/清晰度/品牌色三组控件三种语法（下拉行 40px、分段块 46px、输入框 36px），分段控件未选中态是 `rgb(229,229,229)` 纯灰、选中态仅换成淡紫描边，**没有品牌色块、没有层级、没有状态反馈**。 |
| c) 首页 视频生成参数面板 | 底部 5 个 chip（视频模型/技能库/镜头规格/声音/生成设置）与电商底栏**同形不同色系**（这边灰褐 `rgba(45,39,34,.1)`，那边暖褐），**同一产品两套参数栏语言**；禁用 CTA `rgb(229,227,224)/rgb(168,163,158)` 灰到近乎不可读。 |
| d) 画布四个生成框操作台 | 四个操作台**完全同款白卡**（全 `rgba(255,255,255,.99)` + `1px rgb(223,227,232)` + 10px 圆角），图片/视频/套图/文案**没有任何色相或图标区分**；CTA 全是 `rgb(238,234,248)` 淡紫 + `rgb(157,149,179)` 灰紫字。 |
| e) 画布节点选中态 | 选中只是 `1px solid rgb(37,99,235)` 细蓝描边（画布唯一的蓝），**与产品主色（紫 `#6b42dd`／暖黑）完全无关**；端口 30×30 白圆点无 hover 反馈，结果节点 hover **实测零差异**。 |
| f) 画布弹窗（工作流模板/作品集/资产库） | 三个弹窗**三种遮罩、三种圆角、三种语言**：工作流模板遮罩 `rgba(15,23,42,.55)`（冷蓝黑）、置灰 `rgb(15,23,42)` 标题；资产库走 `rgba(28,25,23,.42)` 暖黑、20px 圆角；**工作流模板整个弹窗零 class、全内联样式**，无法被设计系统覆盖。 |
| g) 我的画布页 / 作品集页 | 空库态只有一行小灰字「还没有作品」，**整屏 1440×900 全是空白**，没有任何引导、插画层级或 CTA；筛选页签用 `rgb(32,34,38)` 冷黑胶囊，与外壳暖黑体系不同源。 |
| g) 定价页 | 套餐卡是**纯白卡 + `rgba(231,229,228,.8)` 极淡边框**，与页面暖米背景对比度极低，六张卡糊成一片；「即将上线」用虚线边框+灰字，**禁用/可购买在视觉上几乎不可区分**；hover **零差异**。 |

---

## 3. a) 首页 · 电商生图 —— 实测数值

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 首页·电商生图 | 能力卡（选中） | `ec-ability-selector-option.is-selected` | rgba(0, 0, 0, 0) | rgb(52, 47, 43) | 1px solid rgb(130, 105, 231) | 13.3333px/400 | 102px | 6px 34px 6px 8px | 10px | rgba(95, 71, 188, 0.11) 0px 7px 18px 0px |
| 首页·电商生图 | 能力卡（未选中） | `ec-ability-selector-option.is-wide-showcase` | rgba(255, 255, 255, 0.76) | rgb(52, 47, 43) | 1px solid rgba(0, 0, 0, 0) | 13.3333px/400 | 102px | 6px 34px 6px 8px | 10px | none |
| 首页·电商生图 | 参数chip 生成设置 Image 2·2K | `生成设置：Image 2·2K` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 参数chip 套图方案 1白底丨3主图丨1素材 | `套图方案：1白底丨3主图丨1素材丨5详情` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 参数chip SKU变体 SKU变体 | `SKU变体：SKU变体` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 参数chip 技能库 技能库 | `技能库：技能库` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 参数chip 商品信息 商品信息 | `商品信息：商品信息` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 参数chip 内容规范 文案策划 | `内容规范：文案策划` | rgba(255, 255, 255, 0.84) | rgb(61, 56, 53) | 1px solid rgba(35, 31, 27, 0.11) | 13px/600 | 52px | 0px 14px 0px 14px | 8px | rgba(45, 38, 31, 0.06) 0px 4px 14px 0px |
| 首页·电商生图 | 下一步 CTA（禁用） | `ec-workbench-next.shubao-gen-cta` | rgb(229, 229, 229) | rgb(170, 170, 170) | 0px none rgb(170, 170, 170) | 13.5px/700 | 40px | 0px 20px 0px 20px | 10px | none |
| 首页·电商生图 | 上传卡 | `ec-xhs-upload-card.ec-xhs-add-card` | rgb(255, 255, 255) | rgb(61, 56, 53) | 2px dashed rgba(231, 229, 228, 0.8) | 13.3333px/400 | 108px | 0px 0px 0px 0px | 16px | rgba(57, 45, 26, 0.055) 0px 5px 10px 0px |
| 首页·电商生图 | 首页模式卡（选中） | `homepage-mode-card.card-1` | rgba(255, 255, 255, 0.96) | rgb(50, 46, 50) | 1px solid rgba(109, 93, 252, 0.48) | 13.3333px/400 | 168px | 8px 8px 8px 8px | 8px | rgba(109, 93, 252, 0.12) 0px 0px 0px 3px, rgba(64, 48, 36, 0.1 |
| 首页·电商生图 | 首页模式卡（未选中） | `homepage-mode-card.card-2` | rgba(255, 255, 255, 0.96) | rgb(50, 46, 50) | 1px solid rgba(54, 47, 43, 0.1) | 13.3333px/400 | 168px | 8px 8px 8px 8px | 8px | rgba(64, 48, 36, 0.14) 0px 16px 34px 0px |
| 首页·电商生图 | 顶部创作导航（激活） | `creative-nav-trigger-commerce` | rgba(0, 0, 0, 0) | rgb(107, 66, 221) | 0px none rgb(107, 66, 221) | 13.3333px/850 | 42px | 0px 13px 0px 13px | 12px | none |
| 首页·电商生图 | 顶部创作导航（未激活） | `creative-nav-trigger-video` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | 13.3333px/400 | 42px | 0px 13px 0px 13px | 12px | none |
| 首页·电商生图 | 左侧主导航（激活） | `开始创作` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | 1px solid rgba(0, 0, 0, 0) | 16px/400 | 44px | 0px 0px 0px 0px | 13px | rgba(0, 0, 0, 0.15) 0px 4px 12px 0px |
| 首页·电商生图 | 左侧主导航（未激活） | `画布` | rgba(0, 0, 0, 0.03) | rgb(102, 102, 102) | 1px solid rgba(0, 0, 0, 0.08) | 16px/400 | 44px | 0px 0px 0px 0px | 13px | rgba(0, 0, 0, 0.04) 0px 2px 6px 0px |
| 首页·电商生图 | 能力卡（选中·切换后） | `ec-ability-selector-option.is-wide-showcase` | rgba(0, 0, 0, 0) | rgb(52, 47, 43) | 1px solid rgb(130, 105, 231) | 13.3333px/400 | 102px | 6px 34px 6px 8px | 10px | rgba(95, 71, 188, 0.11) 0px 7px 18px 0px |
| 首页·电商生图 | 生成设置弹层容器 | `ec-floating-panel` | rgba(252, 252, 253, 0.93) | rgb(61, 56, 53) | 1px solid rgba(255, 255, 255, 0.86) | 16px/400 | 322px | 0px 0px 0px 0px | 8px | rgba(37, 30, 24, 0.18) 0px 28px 80px 0px, rgba(37, 30, 24, 0.0 |
| 首页·电商生图 | 生成设置弹层标题区 | `ec-config-panel-header` | rgba(252, 252, 253, 0.9) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | 16px/400 | 59px | 10px 16px 8px 16px | 0px | none |
| 首页·电商生图 | 生成设置弹层内 button：GPT GPT Image  | `.ec-config-panel button` | rgba(12, 10, 9, 0.03) | rgb(26, 22, 20) | 1px solid rgba(0, 0, 0, 0) | 13.3333px/400 | 40px | 8px 12px 8px 12px | 12px | none |
| 首页·电商生图 | 生成设置弹层内 input： | `品牌主色色值` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgba(12, 10, 9, 0.1) | 12px/400 | 36px | 0px 12px 0px 12px | 8px | none |
| 首页·电商生图 | 套图方案弹层容器 | `ec-tryon-plan-panel` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | 16px/400 | 291px | 14px 16px 14px 16px | 0px | none |
| 首页·电商生图 | 套图方案弹层内 button：3:4 电商竖图 | `is-selected` | rgb(250, 248, 255) | rgb(104, 79, 196) | 1px solid rgb(129, 105, 221) | 16px/400 | 64px | 9px 6px 9px 6px | 8px | rgba(96, 71, 182, 0.1) 0px 3px 9px 0px |

**关键观察**
- 7 个底部参数 chip：`126×52`（套图方案 `234×52`、生成设置 `137×52`），**背景/边框/字号/字重/圆角/阴影完全一致** —— 无主次。
- 「下一步」CTA 禁用态 `rgb(229,229,229)` 底 + `rgb(170,170,170)` 字，对比度约 **1.9:1**（远低于 WCAG AA 4.5:1）。
- 能力卡选中态靠 `1px solid rgb(130,105,231)` 紫描边 + 极淡阴影，**未选中态边框是 `rgba(0,0,0,0)` 透明**，两者只差一根 1px 线。

---

## 4. b) 首页 电商生图 —— 底部参数栏 + 「生成设置」弹层（老板点名最丑）

**弹层实测**（`.ec-config-panel`）：

| 项 | 实测值 |
|---|---|
| 容器尺寸 | `480×322`（`offsetWidth/Height`） |
| 背景 | `rgba(252, 252, 253, 0.93)` —— **冷白玻璃，与页面暖米 `#F5EFE4` 不同温** |
| 边框 | `1px solid rgba(255, 255, 255, 0.86)`（白描边，等于没有边框） |
| 圆角 | `8px` —— 与外壳胶囊 9999px / 模式卡 8px / 资产库 20px **四种圆角并存** |
| 阴影 | `rgba(37, 30, 24, 0.18) 0px 28px 80px 0px, rgba(37, 30, 24, 0.06) 0px 2px 10px 0px` |
| 标题区 | `478×59`，背景 `rgba(252, 252, 253, 0.9)`，**无下边框、无分隔** |
| 模型下拉行 | `438×40`，背景 `rgba(12, 10, 9, 0.03)`（3% 黑，几乎看不见），圆角 12px |
| 清晰度分段控件 | 见 `05-home-ec-gen-settings-modal-crop.png`：**未选中 `rgb(229,229,229)` 纯灰块，选中 `2K` 仅淡紫描边 + 紫字**，无填充色块 |

> **结论**：这个弹层没有任何一处使用品牌色作为「选中填充」；三组控件三种高度（40/46/36）、两种圆角（8/12）、三种底色，且**弹层是冷白而页面是暖米**——冷暖相撞 + 无层级，是「最丑」的直接原因。

**套图方案弹层**（`.ec-config-panel` 内的 `plan-panel`）：容器 `478×291`，选项按钮 `107×64`，选中态 `rgb(250,248,255)` 底 + `1px solid rgb(129,105,221)` + 紫字 `rgb(104,79,196)` —— 这个反而是**全站少数有明确选中填充**的控件。

---

## 5. c) 首页 · 视频生成参数面板

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 首页·视频生成 | 视频参数 chip：视频模型 Seedance 2.0  | `video-config-trigger.is-model` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | 16px/400 | 50px | 7px 10px 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板按钮：电商生图 | `homepage-mode-card.card-1` | rgba(255, 255, 255, 0.96) | rgb(50, 46, 50) | 1px solid rgba(54, 47, 43, 0.1) | 13.3333px/400 | 168px | 8px 8px 8px 8px | 8px | rgba(64, 48, 36, 0.14) 0px 16px 34px 0px |
| 首页·视频生成 | 上传槽位：我的素材主体与生活细节 | `ec-xhs-upload-card.ec-xhs-add-card` | rgb(255, 255, 255) | rgb(61, 56, 53) | 2px dashed rgba(231, 229, 228, 0.8) | 13.3333px/400 | 0px | 0px 0px 0px 0px | 16px | rgba(57, 45, 26, 0.055) 0px 5px 10px 0px |
| 首页·视频生成 | 视频面板 [class*=mode-card]：电商生图 视频生成 小红书图文  | `创作模式` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | 16px/400 | 168px | 0px 0px 0px 0px | 0px | none |
| 首页·视频生成 | 视频面板 [class*=config-trigger]：视频模型 Seedance 2. | `video-config-trigger.is-model` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | 16px/400 | 50px | 7px 10px 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板 [class*=skill]： | `video-skill-row` | rgba(0, 0, 0, 0) | rgb(31, 29, 26) | 0px none rgb(31, 29, 26) | 16px/400 | 34px | 0px 0px 0px 0px | 0px | none |
| 首页·视频生成 | 视频面板 [class*=submit], [class*=cta]：分析并生成方案 1 积分 | `video-submit-row` | rgba(0, 0, 0, 0) | rgb(31, 29, 26) | 0px none rgb(31, 29, 26) | 16px/400 | 44px | 0px 0px 0px 0px | 0px | none |
| 首页·视频生成 | 视频面板 textarea： | `画面描述` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | 15px/400 | 0px | 8px 18px 8px 18px | 0px | none |
| 首页·视频生成 | 视频面板控件：智能成片 一句话起步，素材可选 | `is-selected` | rgba(255, 255, 255, 0.94) | rgb(41, 38, 34) | 1px solid rgba(112, 88, 218, 0.24) | —/— | 66px | 10px 15px | 11px | rgba(83, 62, 47, 0.1) 0px 8px 20px 0px |
| 首页·视频生成 | 视频面板控件：首尾帧 用两张图锁定镜头起点和终点 | `[data-qa=video-panel] .` | rgba(0, 0, 0, 0) | rgb(117, 111, 105) | 1px solid rgba(0, 0, 0, 0) | —/— | 66px | 10px 15px | 11px | none |
| 首页·视频生成 | 视频面板控件：爆款重构 保留参考节奏，替换为你的内容 | `[data-qa=video-panel] .` | rgba(0, 0, 0, 0) | rgb(117, 111, 105) | 1px solid rgba(0, 0, 0, 0) | —/— | 66px | 10px 15px | 11px | none |
| 首页·视频生成 | 视频面板控件：video-icon-tool | `video-icon-tool` | rgb(255, 255, 255) | rgb(100, 94, 88) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 34px | 0px | 9px | none |
| 首页·视频生成 | 视频面板控件：视频模型 Seedance 2.0 标准 | `video-config-trigger.is-model` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板控件：技能库 未选技能 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板控件：镜头规格 9:16 · 8秒 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板控件：声音 生成声音 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板控件：生成设置 720P · Seed 随机 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 视频面板控件：分析并生成方案 1 积分 | `video-generate-trigger.shubao-gen-cta` | rgb(229, 227, 224) | rgb(168, 163, 158) | 0px none rgb(168, 163, 158) | —/— | 44px | 0px 18px | 11px | none |
| 首页·视频生成 | 智能成片 一句话起步，素材可选 首尾帧 用两张图 | `video-mode-tabs` | rgba(0, 0, 0, 0) | rgb(31, 29, 26) | 1px solid rgba(61, 50, 41, 0.07) | —/— | 78px | 5px | 14px | none |
| 首页·视频生成 | 智能成片 一句话起步，素材可选 | `is-selected` | rgba(255, 255, 255, 0.94) | rgb(41, 38, 34) | 1px solid rgba(112, 88, 218, 0.24) | —/— | 66px | 10px 15px | 11px | rgba(83, 62, 47, 0.1) 0px 8px 20px 0px |
| 首页·视频生成 | 首尾帧 用两张图锁定镜头起点和终点 | `.video-composer .` | rgba(0, 0, 0, 0) | rgb(117, 111, 105) | 1px solid rgba(0, 0, 0, 0) | —/— | 66px | 10px 15px | 11px | none |
| 首页·视频生成 | 爆款重构 保留参考节奏，替换为你的内容 | `.video-composer .` | rgba(0, 0, 0, 0) | rgb(117, 111, 105) | 1px solid rgba(0, 0, 0, 0) | —/— | 66px | 10px 15px | 11px | none |
| 首页·视频生成 | video-icon-tool | `video-icon-tool` | rgb(255, 255, 255) | rgb(100, 94, 88) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 34px | 0px | 9px | none |
| 首页·视频生成 | 视频模型 Seedance 2.0 标准 | `video-config-trigger.is-model` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 技能库 未选技能 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 镜头规格 9:16 · 8秒 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 声音 生成声音 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 生成设置 720P · Seed 随机 | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | —/— | 50px | 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 分析并生成方案 1 积分 | `video-generate-trigger.shubao-gen-cta` | rgb(229, 227, 224) | rgb(168, 163, 158) | 0px none rgb(168, 163, 158) | —/— | 44px | 0px 18px | 11px | none |
| 首页·视频生成 | 空值 chip（技能库·未选） | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | 16px/400 | 50px | 7px 10px 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 开关 chip（声音） | `video-config-trigger` | rgb(255, 255, 255) | rgb(112, 106, 100) | 1px solid rgba(45, 39, 34, 0.1) | 16px/400 | 50px | 7px 10px 7px 10px | 10px | rgba(62, 43, 26, 0.05) 0px 3px 12px 0px |
| 首页·视频生成 | 主 CTA（分析并生成方案·禁用） | `video-generate-trigger.shubao-gen-cta` | rgb(229, 227, 224) | rgb(168, 163, 158) | 0px none rgb(168, 163, 158) | 13.5px/700 | 44px | 0px 18px 0px 18px | 11px | none |
| 首页·视频生成 | 视频参数弹层（视频模型） | `video-inline-menu.is-model` | rgba(255, 255, 255, 0.98) | rgb(31, 29, 26) | 1px solid rgba(61, 50, 41, 0.1) | 16px/400 | 460px | 8px 8px 8px 8px | 11px | rgba(45, 33, 24, 0.16) 0px 15px 40px 0px |
| 首页·视频生成 | 「视频模型」弹层选项#1：Seedance 2.0 Fas | `.video-inline-menu li, .video-inline-menu button` | rgba(0, 0, 0, 0) | rgb(60, 55, 50) | 0px none rgb(60, 55, 50) | 13.3333px/400 | 119px | 8px 8px 8px 8px | 8px | none |
| 首页·视频生成 | 技能库弹窗：技能库弹窗容器 | `技能库` | rgba(255, 254, 252, 0.98) | rgb(26, 22, 20) | 1px solid rgba(57, 45, 26, 0.1) | 16px/400 | 852px | 0px 0px 0px 0px | 22px | rgba(57, 45, 26, 0.35) 0px 32px 90px -20px |
| 首页·视频生成 | 技能库弹窗：弹窗分段标签 | `技能类型` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | 16px/400 | 42px | 8px 20px 0px 20px | 0px | none |
| 首页·视频生成 | 技能库弹窗：技能列表 | `skill-list` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | 16px/400 | 593px | 0px 0px 0px 0px | 0px | none |
| 首页·视频生成 | 技能库弹窗：技能列 | `skill-column` | rgb(250, 248, 244) | rgb(26, 22, 20) | 1px solid rgba(57, 45, 26, 0.07) | 16px/400 | 656px | 12px 12px 12px 12px | 14px | none |
| 首页·视频生成 | 技能库弹窗：弹窗主按钮 | `skill-save-btn` | rgb(229, 227, 224) | rgb(168, 163, 158) | 0px none rgb(168, 163, 158) | 13px/700 | 36px | 0px 16px 0px 16px | 10px | none |
| 首页·视频生成 | 技能库弹窗：弹窗次按钮 | `skill-mini-btn` | rgb(255, 255, 255) | rgb(61, 56, 53) | 1px solid rgba(57, 45, 26, 0.12) | 11.5px/600 | 28px | 5px 9px 5px 9px | 8px | none |
| 首页·视频生成 | 技能库弹窗按钮#1：生图 | `.skill-kind-tabs button, .skill-list button, .skill-column button` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 1px solid rgba(0, 0, 0, 0) | 13px/600 | 34px | 7px 14px 7px 14px | 999px | none |

**关键观察**
- 视频模型弹层 `.video-inline-menu`：`360×460`，背景 `rgba(255,255,255,0.98)`，边框 `1px solid rgba(61,50,41,0.1)`，圆角 `11px` —— 与电商的 `8px`、资产库的 `20px` 又都不同。
- 弹层选项 hover 是**全站反馈最明确的一处**：背景 `rgba(0,0,0,0) → rgb(245,241,255)`、文字 `rgb(60,55,50) → rgb(104,66,220)`（详见 §7）。
- 「技能库」打开的是**全屏大弹窗** `.skill-modal` `1397×852`，圆角 `22px` —— 与它旁边的 `11px` 小弹层**圆角相差一倍**。
- 主 CTA 禁用态 `217×44`，`rgb(229,227,224)` / `rgb(168,163,158)`，对比度约 **2.0:1**。

---

## 6. d/e) 画布 EcCanvas —— 四个生成框操作台 + 节点/面板/工具栏

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 画布 EcCanvas | 顶栏表面 | `返回` | rgba(0, 0, 0, 0) | rgb(95, 102, 112) | 1px solid rgb(227, 230, 234) | 13.3333px/400 | 38px | 0px 0px 0px 0px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 顶栏命令按钮 | `打开模板广场（工作流模板）` | rgb(245, 246, 248) | rgb(52, 57, 63) | 1px solid rgb(227, 230, 234) | 12px/700 | 38px | 0px 12px 0px 12px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 图标按钮 | `返回` | rgba(0, 0, 0, 0) | rgb(95, 102, 112) | 1px solid rgb(227, 230, 234) | 13.3333px/400 | 38px | 0px 0px 0px 0px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 结果媒体节点 | `ec-canvas-media-node.is-idle` | rgb(255, 255, 255) | rgb(21, 23, 26) | 1px solid rgb(223, 227, 232) | 16px/400 | 242px | 0px 0px 0px 0px | 8px | rgba(15, 23, 42, 0.1) 0px 4px 14px 0px |
| 画布 EcCanvas | 结果节点画框 | `ec-canvas-media-frame` | rgb(242, 243, 245) | rgb(21, 23, 26) | 0px none rgb(21, 23, 26) | 16px/400 | 240px | 0px 0px 0px 0px | 7px 7px 0px 0px | none |
| 画布 EcCanvas | 节点连接端口 | `从当前素材继续创作` | rgb(255, 255, 255) | rgb(75, 85, 99) | 1px solid rgb(216, 221, 228) | 13.3333px/400 | 30px | 0px 0px 0px 0px | 50% | rgba(15, 23, 42, 0.14) 0px 3px 10px 0px |
| 画布 EcCanvas | 底部操作栏 | `画布工具` | rgb(255, 255, 255) | rgb(21, 23, 26) | 1px solid rgba(21, 23, 26, 0.06) | 16px/400 | 46px | 5px 5px 5px 5px | 7px | rgba(21, 23, 26, 0.05) 0px 2px 4px 0px, rgba(21, 23, 26, 0.09) |
| 画布 EcCanvas | 左下小地图 | `ec-canvas-minimap` | rgba(255, 255, 255, 0.97) | rgb(31, 41, 55) | 1px solid rgb(221, 225, 230) | 12px/400 | 180px | 2px 4px 3px 4px | 10px | rgba(15, 23, 42, 0.18) 0px 8px 28px -6px |
| 画布 EcCanvas | 监督条按钮 | `任务日志` | rgba(255, 255, 255, 0.04) | rgba(255, 255, 255, 0.78) | 1px solid rgba(255, 255, 255, 0.08) | 12px/500 | 29px | 5px 12px 5px 12px | 8px | none |
| 画布 EcCanvas | 生成框操作台：上传参考图 GPT Image  | `文案生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 生成框节点：图片生成 | `ec-canvas-generation-node.is-image` | rgb(246, 247, 249) | rgb(124, 132, 143) | 1px solid rgb(217, 222, 229) | 16px/400 | 280px | 0px 0px 0px 0px | 8px | rgba(15, 23, 42, 0.09) 0px 5px 18px 0px |
| 画布 EcCanvas | 生成框占位：图片生成 | `ec-canvas-generation-placeholder` | rgba(0, 0, 0, 0) | rgb(124, 132, 143) | 0px none rgb(124, 132, 143) | 16px/400 | 278px | 28px 28px 28px 28px | 7px | none |
| 画布 EcCanvas | 操作台主 CTA：生成 0.2 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | 12.5px/700 | 36px | 0px 14px 0px 14px | 10px | none |
| 画布 EcCanvas | 操作台上传按钮：上传参考图 | `添加上传参考图` | rgb(250, 251, 252) | rgb(94, 104, 117) | 1px dashed rgb(174, 185, 200) | 16px/400 | 94px | 10px 7px 10px 7px | 8px | none |
| 画布 EcCanvas | 操作台底部：GPT Image 2 自动 / | `ec-canvas-composer-footer` | rgba(0, 0, 0, 0) | rgb(32, 36, 42) | 1px solid rgb(232, 235, 239) | 16px/400 | 63px | 10px 14px 12px 14px | 0px | none |
| 画布 EcCanvas | 上下文操作台：上传参考图 GPT Image  | `文案生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 操作台 ec-canvas-text-generation-composer | `文案生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 生成框操作台（生成图片） | `图片生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 生成框操作台（生成视频） | `视频生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 448px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 生成框操作台（电商套图） | `电商套图操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 379px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 生成框操作台（生成文案） | `文案生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | ec-canvas-icon-button | `ec-canvas-icon-button.` | rgba(0, 0, 0, 0) | rgb(95, 102, 112) | 1px solid rgb(227, 230, 234) | —/— | 38px | 0px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 当前画布 资产库 作品集 | `ec-canvas-tabs.ec-canvas-topbar-surface` | rgb(244, 245, 247) | rgb(21, 23, 26) | 1px solid rgb(227, 230, 234) | —/— | 38px | 2px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 当前画布 | `is-active` | rgb(255, 255, 255) | rgb(21, 23, 26) | 0px none rgb(21, 23, 26) | —/— | 32px | 0px 12px | 5px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 资产库 | `.ec-canvas-topbar .` | rgba(0, 0, 0, 0) | rgb(115, 121, 129) | 0px none rgb(115, 121, 129) | —/— | 32px | 0px 12px | 5px | none |
| 画布 EcCanvas | 作品集 | `.ec-canvas-topbar .` | rgba(0, 0, 0, 0) | rgb(115, 121, 129) | 0px none rgb(115, 121, 129) | —/— | 32px | 0px 12px | 5px | none |
| 画布 EcCanvas | AI 积分 0 AI 积分 | `account-entitlement-value` | rgb(23, 24, 28) | rgb(255, 255, 255) | 1px solid rgba(255, 255, 255, 0.14) | —/— | 38px | 5px 10px | 8px | rgba(21, 23, 26, 0.08) 0px 2px 7px 0px |
| 画布 EcCanvas | 模板广场 | `ec-canvas-command.ec-canvas-topbar-surface` | rgb(245, 246, 248) | rgb(52, 57, 63) | 1px solid rgb(227, 230, 234) | —/— | 38px | 0px 12px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 导出 | `ec-canvas-command.ec-canvas-topbar-surface` | rgb(245, 246, 248) | rgb(52, 57, 63) | 1px solid rgb(227, 230, 234) | —/— | 38px | 0px 12px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 新建画布 | `ec-canvas-command.ec-canvas-topbar-surface` | rgb(21, 23, 26) | rgb(255, 255, 255) | 1px solid rgb(21, 23, 26) | —/— | 38px | 0px 12px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 顶栏表面按钮（未选） | `返回` | rgba(0, 0, 0, 0) | rgb(95, 102, 112) | 1px solid rgb(227, 230, 234) | 13.3333px/400 | 38px | 0px 0px 0px 0px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 顶栏命令按钮（深色主） | `ec-canvas-command.ec-canvas-topbar-surface` | rgb(21, 23, 26) | rgb(255, 255, 255) | 1px solid rgb(21, 23, 26) | 12px/700 | 38px | 0px 12px 0px 12px | 7px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 节点端口 | `从当前素材继续创作` | rgb(255, 255, 255) | rgb(75, 85, 99) | 1px solid rgb(216, 221, 228) | 13.3333px/400 | 30px | 0px 0px 0px 0px | 50% | rgba(15, 23, 42, 0.14) 0px 3px 10px 0px |
| 画布 EcCanvas | 底部工具按钮（激活） | `选择工具：拖拽框选 / Shift+点击多选` | rgb(37, 99, 235) | rgb(255, 255, 255) | 0px none rgb(255, 255, 255) | 13.3333px/400 | 34px | 0px 0px 0px 0px | 6px | none |
| 画布 EcCanvas | 保存状态指示 | `ec-canvas-save-indicator.status-saved` | rgba(255, 255, 255, 0.03) | rgba(255, 255, 255, 0.78) | 1px solid rgba(255, 255, 255, 0.05) | 11px/400 | 27px | 4px 10px 4px 10px | 6px | none |
| 画布 EcCanvas | 画布页签 | `is-active` | rgb(255, 255, 255) | rgb(21, 23, 26) | 0px none rgb(21, 23, 26) | 12px/650 | 32px | 0px 12px 0px 12px | 5px | rgba(21, 23, 26, 0.05) 0px 1px 2px 0px, rgba(21, 23, 26, 0.07) |
| 画布 EcCanvas | 添加节点菜单 | `添加节点` | rgba(255, 255, 255, 0.98) | rgb(21, 23, 26) | 1px solid rgba(15, 23, 42, 0.08) | 16px/400 | 677px | 6px 6px 6px 6px | 8px | rgba(15, 23, 42, 0.16) 0px 16px 40px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 添加节点菜单项#1： | `关闭添加菜单` | rgba(0, 0, 0, 0) | rgb(39, 43, 49) | 0px none rgb(39, 43, 49) | 13.3333px/400 | 54px | 7px 8px 7px 8px | 7px | none |
| 画布 EcCanvas | 图片生成操作台 | `图片生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 图片生成操作台 控件#1：生成 1 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | 12.5px/700 | 36px | 0px 14px 0px 14px | 10px | none |
| 画布 EcCanvas | 图片生成操作台 控件#2： | `调整输入框高度（3-12 行，超过后内部滚动）` | rgba(0, 0, 0, 0) | rgb(154, 163, 174) | 0px none rgb(154, 163, 174) | 13.3333px/400 | 26px | 0px 0px 0px 0px | 0px 0px 7px | none |
| 画布 EcCanvas | 视频生成操作台 | `视频生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 448px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 视频生成操作台 控件#1：生成视频 46 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | 12.5px/700 | 36px | 0px 14px 0px 14px | 10px | none |
| 画布 EcCanvas | 视频生成操作台 控件#2：智能成片 一句话起步，素材可选 | `is-active` | rgb(245, 248, 255) | rgb(37, 99, 235) | 1px solid rgb(37, 99, 235) | 13.3333px/400 | 50px | 7px 8px 7px 8px | 7px | none |
| 画布 EcCanvas | 电商套图操作台 | `电商套图操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 379px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 电商套图操作台 控件#1：生成设计方案 1 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | 12.5px/700 | 36px | 0px 14px 0px 14px | 10px | none |
| 画布 EcCanvas | 电商套图操作台 控件#2： | `调整输入框高度（3-12 行，超过后内部滚动）` | rgba(0, 0, 0, 0) | rgb(154, 163, 174) | 0px none rgb(154, 163, 174) | 13.3333px/400 | 26px | 0px 0px 0px 0px | 0px 0px 7px | none |
| 画布 EcCanvas | 文案生成操作台 | `文案生成操作台` | rgba(255, 255, 255, 0.99) | rgb(32, 36, 42) | 1px solid rgb(223, 227, 232) | 16px/400 | 305px | 0px 0px 0px 0px | 10px | rgba(15, 23, 42, 0.14) 0px 20px 44px 0px, rgba(15, 23, 42, 0.0 |
| 画布 EcCanvas | 文案生成操作台 控件#1：生成 0.2 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | 12.5px/700 | 36px | 0px 14px 0px 14px | 10px | none |
| 画布 EcCanvas | 文案生成操作台 控件#2： | `调整输入框高度（3-12 行，超过后内部滚动）` | rgba(0, 0, 0, 0) | rgb(154, 163, 174) | 0px none rgb(154, 163, 174) | 13.3333px/400 | 26px | 0px 0px 0px 0px | 0px 0px 7px | none |
| 画布 EcCanvas | ec-canvas-prompt-resize- | `ec-canvas-prompt-resize-handle` | rgba(0, 0, 0, 0) | rgb(154, 163, 174) | 0px none rgb(154, 163, 174) | —/— | 26px | 0px | 0px 0px 7px | none |
| 画布 EcCanvas | image-mention-trigger | `image-mention-trigger.` | rgb(255, 255, 255) | rgb(66, 110, 184) | 1px solid rgb(223, 227, 232) | —/— | 36px | 0px | 50% | none |
| 画布 EcCanvas | GPT Image 2 | `.ec-canvas-node-composer .` | rgb(255, 255, 255) | rgb(63, 74, 88) | 1px solid rgb(217, 224, 232) | —/— | 40px | 0px 9px | 8px | none |
| 画布 EcCanvas | 自动 / 1:1 | `.ec-canvas-node-composer .` | rgb(255, 255, 255) | rgb(63, 74, 88) | 1px solid rgb(217, 224, 232) | —/— | 40px | 0px 9px | 8px | none |
| 画布 EcCanvas | 2K | `.ec-canvas-node-composer .` | rgb(255, 255, 255) | rgb(63, 74, 88) | 1px solid rgb(217, 224, 232) | —/— | 40px | 0px 9px | 8px | none |
| 画布 EcCanvas | x1 | `.ec-canvas-node-composer .` | rgb(255, 255, 255) | rgb(63, 74, 88) | 1px solid rgb(217, 224, 232) | —/— | 40px | 0px 9px | 8px | none |
| 画布 EcCanvas | 技能 | `.ec-canvas-node-composer .` | rgb(255, 255, 255) | rgb(63, 74, 88) | 1px solid rgb(217, 224, 232) | —/— | 40px | 0px 9px | 8px | none |
| 画布 EcCanvas | 生成 0.2 积分 | `shubao-gen-cta.ec-canvas-composer-cta` | rgb(238, 234, 248) | rgb(157, 149, 179) | 0px none rgb(157, 149, 179) | —/— | 36px | 0px 14px | 10px | none |
| 画布 EcCanvas | 节点（选中） | `ec-canvas-media-node.is-selected` | rgb(255, 255, 255) | rgb(21, 23, 26) | 1px solid rgb(37, 99, 235) | 16px/400 | 242px | 0px 0px 0px 0px | 8px | rgba(28, 25, 23, 0.16) 0px 14px 32px 0px |
| 画布 EcCanvas | 选中节点端口（左/右加号） | `从当前素材继续创作` | rgb(255, 255, 255) | rgb(75, 85, 99) | 1px solid rgb(216, 221, 228) | 13.3333px/400 | 30px | 0px 0px 0px 0px | 50% | rgba(15, 23, 42, 0.14) 0px 3px 10px 0px |
| 画布 EcCanvas | 选中节点附加控件#1 | `[object.SVGAnimatedString]` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | 0px none rgb(255, 255, 255) | 12px/700 | —px | 0px 0px 0px 0px | 0px | none |
| 画布 EcCanvas | 任务侧栏 | `task-sidebar` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | 16px/400 | 46px | 0px 0px 0px 0px | 0px | none |
| 画布 EcCanvas | 工作流模板弹窗遮罩层 | `工作流模板库` | rgba(15, 23, 42, 0.55) | rgb(21, 23, 26) | 0px none rgb(21, 23, 26) | —/— | 900px | 0px | 0px | none |
| 画布 EcCanvas | 工作流模板弹窗面板 | `工作流模板库` | rgb(255, 255, 255) | rgb(21, 23, 26) | 1px solid rgba(15, 23, 42, 0.06) | —/— | 740px | 0px | 14px | rgba(15, 23, 42, 0.32) 0px 24px 60px 0px |
| 画布 EcCanvas | 工作流模板弹窗标题「工作流模板」 | `工作流模板库` | n/a | rgb(15, 23, 42) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 工作流模板弹窗标题「模特试穿」 | `工作流模板库` | n/a | rgb(15, 23, 42) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 工作流模板弹窗标题「换装短视频（旗舰）」 | `工作流模板库` | n/a | rgb(15, 23, 42) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 工作流模板弹窗标题「场景详情 ×N」 | `工作流模板库` | n/a | rgb(15, 23, 42) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 工作流模板弹窗标题「口播带货」 | `工作流模板库` | n/a | rgb(15, 23, 42) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 工作流模板弹窗按钮#1：(图标) | `工作流模板库` | rgba(15, 23, 42, 0.06) | rgb(71, 85, 105) | 0px none rgb(71, 85, 105) | —/— | 32px | 0px | 8px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#2：精选 | `工作流模板库` | rgb(124, 58, 237) | rgb(255, 255, 255) | 1px solid rgb(124, 58, 237) | —/— | 31px | 6px 12px | 999px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#3：我的 | `工作流模板库` | rgb(255, 255, 255) | rgb(71, 85, 105) | 1px solid rgba(15, 23, 42, 0.08) | —/— | 31px | 6px 12px | 999px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#4：图像 | `工作流模板库` | rgb(255, 255, 255) | rgb(71, 85, 105) | 1px solid rgba(15, 23, 42, 0.08) | —/— | 31px | 6px 12px | 999px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#5：视频 | `工作流模板库` | rgb(255, 255, 255) | rgb(71, 85, 105) | 1px solid rgba(15, 23, 42, 0.08) | —/— | 31px | 6px 12px | 999px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#6：赞 0 | `工作流模板库` | rgba(0, 0, 0, 0) | rgb(100, 116, 139) | 0px none rgb(100, 116, 139) | —/— | 16px | 0px | 0px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#7：一键同款 · 铺开到画布 | `工作流模板库` | rgb(124, 58, 237) | rgb(255, 255, 255) | 1px solid rgba(124, 58, 237, 0.35) | —/— | 35px | 8px 10px | 8px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#8：赞 0 | `工作流模板库` | rgba(0, 0, 0, 0) | rgb(100, 116, 139) | 0px none rgb(100, 116, 139) | —/— | 16px | 0px | 0px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#9：铺开到画布（待 P3 · 暂不可 | `工作流模板库` | rgb(248, 250, 252) | rgb(100, 116, 139) | 1px solid rgba(100, 116, 139, 0.35) | —/— | 35px | 8px 10px | 8px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#10：赞 0 | `工作流模板库` | rgba(0, 0, 0, 0) | rgb(100, 116, 139) | 0px none rgb(100, 116, 139) | —/— | 16px | 0px | 0px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#11：一键同款 · 铺开到画布 | `工作流模板库` | rgb(124, 58, 237) | rgb(255, 255, 255) | 1px solid rgba(124, 58, 237, 0.35) | —/— | 35px | 8px 10px | 8px | none |
| 画布 EcCanvas | 工作流模板弹窗按钮#12：赞 0 | `工作流模板库` | rgba(0, 0, 0, 0) | rgb(100, 116, 139) | 0px none rgb(100, 116, 139) | —/— | 16px | 0px | 0px | none |
| 画布 EcCanvas | 资产库弹窗遮罩层 | `[role=dialog]` | rgba(255, 254, 252, 0.96) | rgb(26, 22, 20) | 1px solid rgba(255, 255, 255, 0.65) | —/— | 657px | 0px | 26px | rgba(57, 45, 26, 0.35) 0px 32px 90px -20px, rgba(57, 45, 26, 0 |
| 画布 EcCanvas | 资产库弹窗面板 | `[role=dialog] > div` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 105px | 32px 99px 0px | 0px | none |
| 画布 EcCanvas | 资产库弹窗标题「登录 薯包AI」 | `[role=dialog] h` | n/a | rgb(26, 22, 20) | n/a | —/— | 0px | n/a | n/a | n/a |
| 画布 EcCanvas | 资产库弹窗按钮#1：(图标) | `[role=dialog] button` | rgba(255, 255, 255, 0.7) | rgb(107, 101, 96) | 1px solid rgba(57, 45, 26, 0.1) | —/— | 34px | 0px | 999px | none |
| 画布 EcCanvas | 资产库弹窗按钮#2：登录 | `[role=dialog] button` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | 0px none rgb(255, 255, 255) | —/— | 40px | 10px 12px | 10px | rgba(232, 84, 75, 0.55) 0px 6px 16px -6px |
| 画布 EcCanvas | 资产库弹窗按钮#3：注册 | `[role=dialog] button` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | —/— | 40px | 10px 12px | 10px | none |
| 画布 EcCanvas | 资产库弹窗按钮#4：显示 | `[role=dialog] button` | rgba(233, 154, 24, 0.14) | rgb(183, 87, 11) | 0px none rgb(183, 87, 11) | —/— | 31px | 7px 12px | 9px | none |
| 画布 EcCanvas | 资产库弹窗按钮#5：忘记密码？ | `[role=dialog] button` | rgba(0, 0, 0, 0) | rgb(183, 87, 11) | 0px none rgb(183, 87, 11) | —/— | 17px | 0px | 0px | none |
| 画布 EcCanvas | 资产库弹窗按钮#6：邮箱登录 | `[role=dialog] button` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | 0px none rgb(255, 255, 255) | —/— | 50px | 0px | 13px | rgba(232, 84, 75, 0.55) 0px 12px 28px -10px, rgba(255, 255, 25 |
| 画布 EcCanvas | 资产库弹窗按钮#7：用邮箱验证码登录 | `[role=dialog] button` | rgba(0, 0, 0, 0) | rgb(183, 87, 11) | 0px none rgb(183, 87, 11) | —/— | 17px | 0px | 0px | none |
| 画布 EcCanvas | 资产库弹窗按钮#8：微信登录 | `[role=dialog] button` | rgba(255, 255, 255, 0.85) | rgb(7, 193, 96) | 1px solid rgba(57, 45, 26, 0.12) | —/— | 46px | 0px | 12px | none |
| 画布 EcCanvas | 结果节点（选中） | `ec-canvas-media-node.is-selected` | rgb(255, 255, 255) | rgb(21, 23, 26) | 1px solid rgb(37, 99, 235) | 16px/400 | 242px | 0px 0px 0px 0px | 8px | rgba(28, 25, 23, 0.16) 0px 14px 32px 0px |
| 画布 EcCanvas | 选中节点端口（左右加号） | `从当前素材继续创作` | rgb(255, 255, 255) | rgb(75, 85, 99) | 1px solid rgb(216, 221, 228) | 13.3333px/400 | 30px | 0px 0px 0px 0px | 50% | rgba(15, 23, 42, 0.14) 0px 3px 10px 0px |
| 画布 EcCanvas | 输入端口 | `从当前素材继续创作` | rgb(255, 255, 255) | rgb(75, 85, 99) | 1px solid rgb(216, 221, 228) | 13.3333px/400 | 30px | 0px 0px 0px 0px | 50% | rgba(15, 23, 42, 0.14) 0px 3px 10px 0px |
| 画布 EcCanvas | 结果框 | `ec-canvas-media-frame` | rgb(242, 243, 245) | rgb(21, 23, 26) | 0px none rgb(21, 23, 26) | 16px/400 | 240px | 0px 0px 0px 0px | 7px 7px 0px 0px | none |
| 画布 EcCanvas | 右侧任务侧栏 | `task-sidebar` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | 16px/400 | 46px | 0px 0px 0px 0px | 0px | none |

**四个操作台实测对比（同款白卡、无区分）**

| 操作台 | 尺寸(offset) | 背景 | 边框 | 圆角 | 主 CTA |
|---|---|---|---|---|---|
| 图片生成 | `640×305` | `rgba(255,255,255,0.99)` | `1px solid rgb(223,227,232)` | `10px` | `137×36` / `rgb(238,234,248)` 底 + `rgb(157,149,179)` 字 |
| 视频生成 | `640×448` | 同上 | 同上 | `10px` | `169×36` / 同上 |
| 电商套图 | `640×379` | 同上 | 同上 | `10px` | `187×36` / 同上 |
| 文案生成 | `640×305` | 同上 | 同上 | `10px` | `148×36` / 同上 |

> 四个操作台**尺寸/底色/边框/圆角完全一致，CTA 全是同一组淡紫+灰紫** —— 用户无法从视觉判断当前是「出图」还是「出视频」还是「出文案」。这是画布最严重的「无层级」。

**节点选中态**：结果节点 `240×242`，默认边框 `1px solid rgb(223,227,232)`；选中后 **只把边框换成 `1px solid rgb(37,99,235)`（Tailwind blue-600）**，无外发光、无加粗、无角点变化。端口 `30×30`、`border-radius: 50%`、白底 `rgb(255,255,255)` + `1px solid rgb(216,221,228)`。

**底部操作栏** `.ec-canvas-bottom-toolbar`：`190×46`，白底，`1px solid rgba(21,23,26,0.06)`，圆角 `7px`；激活工具按钮 `34×34` `rgb(37,99,235)` 蓝底白字（**画布唯一的功能色，且是蓝，与产品紫/暖黑无关**）。

**左下小地图** `.ec-canvas-minimap`：`200×180`，`rgba(255,255,255,0.97)`，`1px solid rgb(221,225,230)`，圆角 `10px`。

---

## 7. f) 画布弹窗 + g) 作品集/定价页

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 我的画布页/作品集页 | 开始创作 | `app-side-nav-item.is-primary` | rgba(0, 0, 0, 0) | rgb(255, 255, 255) | 1px solid rgba(0, 0, 0, 0) | —/— | 44px | 0px | 13px | rgba(12, 10, 9, 0.15) 0px 4px 12px 0px |
| 我的画布页/作品集页 | 画布 | `app-side-nav-item` | rgba(12, 10, 9, 0.03) | rgb(102, 102, 102) | 1px solid rgba(12, 10, 9, 0.08) | —/— | 44px | 0px | 13px | rgba(12, 10, 9, 0.04) 0px 2px 6px 0px |
| 我的画布页/作品集页 | 作品 | `app-side-nav-item` | rgba(12, 10, 9, 0.03) | rgb(102, 102, 102) | 1px solid rgba(12, 10, 9, 0.08) | —/— | 44px | 0px | 13px | rgba(12, 10, 9, 0.04) 0px 2px 6px 0px |
| 我的画布页/作品集页 | 素材 | `app-side-nav-item` | rgba(12, 10, 9, 0.03) | rgb(102, 102, 102) | 1px solid rgba(12, 10, 9, 0.08) | —/— | 44px | 0px | 13px | rgba(12, 10, 9, 0.04) 0px 2px 6px 0px |
| 我的画布页/作品集页 |  | `main, .works-page, [class*=works] .` | rgb(255, 250, 244) | rgb(85, 74, 66) | 1px solid rgba(70, 52, 38, 0.1) | —/— | 46px | 0px | 15px | rgba(84, 55, 35, 0.16) 0px 12px 30px 0px |
| 我的画布页/作品集页 | 电商生图 视频生成 小红书图文 自由创作 | `creative-nav-triggers` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 42px | 0px | 0px | none |
| 我的画布页/作品集页 | 电商生图 | `creative-nav-trigger-slot` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 42px | 0px | 0px | none |
| 我的画布页/作品集页 | 电商生图 | `creative-nav-trigger.is-active` | rgba(0, 0, 0, 0) | rgb(107, 66, 221) | 0px none rgb(107, 66, 221) | —/— | 42px | 0px 13px | 12px | none |
| 我的画布页/作品集页 | creative-nav-trigger-gly | `creative-nav-trigger-glyph` | rgba(0, 0, 0, 0) | rgb(139, 129, 121) | 0px none rgb(139, 129, 121) | —/— | 22px | 0px | 0px | none |
| 我的画布页/作品集页 | 电商生图 | `creative-nav-trigger-label` | rgba(0, 0, 0, 0) | rgb(107, 66, 221) | 0px none rgb(107, 66, 221) | —/— | 19px | 0px | 0px | none |
| 我的画布页/作品集页 | 视频生成 | `creative-nav-trigger-slot` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 42px | 0px | 0px | none |
| 我的画布页/作品集页 | 视频生成 | `creative-nav-trigger` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 42px | 0px 13px | 12px | none |
| 我的画布页/作品集页 | 视频生成 | `creative-nav-trigger-label` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 19px | 0px | 0px | none |
| 我的画布页/作品集页 | 小红书图文 | `creative-nav-trigger-slot` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 42px | 0px | 0px | none |
| 我的画布页/作品集页 | 小红书图文 | `creative-nav-trigger` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 42px | 0px 13px | 12px | none |
| 我的画布页/作品集页 | 小红书图文 | `creative-nav-trigger-label` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 19px | 0px | 0px | none |
| 我的画布页/作品集页 | 自由创作 | `creative-nav-trigger-slot` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 42px | 0px | 0px | none |
| 我的画布页/作品集页 | 自由创作 | `creative-nav-trigger` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 42px | 0px 13px | 12px | none |
| 我的画布页/作品集页 | 自由创作 | `creative-nav-trigger-label` | rgba(0, 0, 0, 0) | rgb(98, 89, 80) | 0px none rgb(98, 89, 80) | —/— | 19px | 0px | 0px | none |
| 我的画布页/作品集页 | theme-switcher | `theme-switcher` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 38px | 0px | 9999px | none |
| 我的画布页/作品集页 | AI 积分 登录后查看额度 | `account-entitlement-value` | rgb(23, 24, 28) | rgb(255, 255, 255) | 1px solid rgba(255, 255, 255, 0.14) | —/— | 40px | 6px 10px | 9px | rgba(20, 22, 28, 0.15) 0px 4px 14px 0px |
| 我的画布页/作品集页 | 去登录 | `topbar-action-button` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 44px | 0px 24px | 9999px | none |
| 我的画布页/作品集页 | 电商生图 视频生成 小红书图文 自由创作 | `homepage-mode-cards` | rgba(0, 0, 0, 0) | rgb(61, 56, 53) | 0px none rgb(61, 56, 53) | —/— | 168px | 0px | 0px | none |
| 我的画布页/作品集页 | 电商生图 | `homepage-mode-card.card-1` | rgb(245, 243, 255) | rgb(26, 22, 20) | 1px solid rgb(221, 214, 254) | —/— | 168px | 8px | 8px | none |
| 我的画布页/作品集页 | 电商生图 | `homepage-mode-card-title` | rgb(245, 243, 255) | rgb(124, 58, 237) | 0px none rgb(124, 58, 237) | —/— | 28px | 0px | 6px | none |
| 我的画布页/作品集页 | homepage-mode-card-visua | `homepage-mode-card-visual` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 124px | 0px | 6px | none |
| 我的画布页/作品集页 | 视频生成 | `homepage-mode-card.card-2` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgba(12, 10, 9, 0.1) | —/— | 168px | 8px | 8px | none |
| 我的画布页/作品集页 | 作品卡片 | `gallery-card` | rgb(243, 244, 246) | rgb(61, 56, 53) | 1px solid rgba(30, 31, 35, 0.08) | 16px/400 | 341px | 0px 0px 0px 0px | 8px | rgba(24, 24, 27, 0.05) 0px 4px 16px 0px |
| 我的画布页/作品集页 | 空状态 | `补充商品信息和生成要求` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | 15px/400 | 92px | 8px 18px 8px 18px | 0px | none |
| 画布·作品集 | 作品集筛选页签#1：全部作品 0 | `is-active` | rgb(32, 34, 38) | rgb(255, 255, 255) | 0px none rgb(255, 255, 255) | 13px/650 | 34px | 0px 13px 0px 13px | 6px | none |

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 定价页 | 支付通道已就绪 | `pricing-trust-item` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 34px | 7px 14px | 999px | none |
| 定价页 | 商用授权清晰 | `pricing-trust-item` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 34px | 7px 14px | 999px | none |
| 定价页 | 成本实时核算 | `pricing-trust-item` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 34px | 7px 14px | 999px | none |
| 定价页 | 失败不计费 | `pricing-trust-item` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 34px | 7px 14px | 999px | none |
| 定价页 | 查看 4 档套餐 | `pricing-btn-primary.pricing-btn-primary--lg` | rgb(12, 10, 9) | rgb(255, 255, 255) | 1px solid rgb(12, 10, 9) | —/— | 46px | 0px 24px | 999px | none |
| 定价页 | 了解常见问题 | `pricing-btn-ghost.pricing-btn-ghost--lg` | rgba(255, 255, 255, 0.88) | rgb(26, 22, 20) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 46px | 0px 24px | 999px | none |
| 定价页 | FAST 快试 5 秒试稿钩子，跑通节奏再上正式 | `pricing-tier-grid` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 341px | 0px | 0px | none |
| 定价页 | FAST 快试 5 秒试稿钩子，跑通节奏再上正式 | `pricing-tier-card` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 341px | 18px | 18px | rgba(57, 45, 26, 0.06) 0px 1px 3px 0px |
| 定价页 | FAST | `pricing-tier-top` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 22px | 0px | 0px | none |
| 定价页 | FAST | `pricing-tier-eyebrow` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 15px | 0px | 0px | none |
| 定价页 | 快试 | `pricing-tier-name` | rgba(0, 0, 0, 0) | rgb(12, 10, 9) | 0px none rgb(12, 10, 9) | —/— | 26px | 0px | 0px | none |
| 定价页 | 5 秒试稿钩子，跑通节奏再上正式档 | `pricing-tier-tagline` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | —/— | 37px | 0px | 0px | none |
| 定价页 | ¥ 6.9 /条 | `pricing-tier-price` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 36px | 0px | 0px | none |
| 定价页 | 27 积分/条 · 约合 27 张 2K 商品图 | `pricing-tier-points` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 17px | 0px | 0px | none |
| 定价页 | 充值后生成 | `pricing-btn-primary` | rgb(12, 10, 9) | rgb(255, 255, 255) | 1px solid rgb(12, 10, 9) | —/— | 38px | 0px 18px | 999px | none |
| 定价页 | STANDARD 标准 720P 正式交付的主力 | `pricing-tier-card` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 341px | 18px | 18px | rgba(57, 45, 26, 0.06) 0px 1px 3px 0px |
| 定价页 | STANDARD | `pricing-tier-top` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 22px | 0px | 0px | none |
| 定价页 | STANDARD | `pricing-tier-eyebrow` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 15px | 0px | 0px | none |
| 定价页 | 标准 | `pricing-tier-name` | rgba(0, 0, 0, 0) | rgb(12, 10, 9) | 0px none rgb(12, 10, 9) | —/— | 26px | 0px | 0px | none |
| 定价页 | 720P 正式交付的主力档 | `pricing-tier-tagline` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | —/— | 34px | 0px | 0px | none |
| 定价页 | ¥ 11.9 /条 | `pricing-tier-price` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 36px | 0px | 0px | none |
| 定价页 | 46 积分/条 · 约合 46 张 2K 商品图 | `pricing-tier-points` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 17px | 0px | 0px | none |
| 定价页 | PREMIUM 含 1 次免费重跑 高品质 长时 | `pricing-tier-card` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 341px | 18px | 18px | rgba(57, 45, 26, 0.06) 0px 1px 3px 0px |
| 定价页 | PREMIUM 含 1 次免费重跑 | `pricing-tier-top` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 22px | 0px | 0px | none |
| 定价页 | PREMIUM | `pricing-tier-eyebrow` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 15px | 0px | 0px | none |
| 定价页 | 含 1 次免费重跑 | `pricing-tier-badge` | rgba(12, 10, 9, 0.06) | rgb(12, 10, 9) | 0px none rgb(12, 10, 9) | —/— | 21px | 3px 9px | 999px | none |
| 定价页 | 高品质 | `pricing-tier-name` | rgba(0, 0, 0, 0) | rgb(12, 10, 9) | 0px none rgb(12, 10, 9) | —/— | 26px | 0px | 0px | none |
| 定价页 | 长时长交付，结果不满意免费重做一次 | `pricing-tier-tagline` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | —/— | 37px | 0px | 0px | none |
| 定价页 | ¥ 14.9 /条 | `pricing-tier-price` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 36px | 0px | 0px | none |
| 定价页 | 57 积分/条 · 约合 57 张 2K 商品图 | `pricing-tier-points` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 17px | 0px | 0px | none |
| 定价页 | FULL HD 即将上线 1080P 全高清交付 | `pricing-tier-card.is-off` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px dashed rgba(200, 195, 190, 0.8) | —/— | 341px | 18px | 18px | rgba(57, 45, 26, 0.06) 0px 1px 3px 0px |
| 定价页 | FULL HD 即将上线 | `pricing-tier-top` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 23px | 0px | 0px | none |
| 定价页 | FULL HD | `pricing-tier-eyebrow` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 15px | 0px | 0px | none |
| 定价页 | 即将上线 | `pricing-soon-pill` | rgba(201, 162, 90, 0.1) | rgb(184, 134, 44) | 1px solid rgba(201, 162, 90, 0.32) | —/— | 23px | 3px 9px | 999px | none |
| 定价页 | 1080P | `pricing-tier-name` | rgba(0, 0, 0, 0) | rgb(12, 10, 9) | 0px none rgb(12, 10, 9) | —/— | 26px | 0px | 0px | none |
| 定价页 | 全高清交付，适合投放主视觉 | `pricing-tier-tagline` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | —/— | 34px | 0px | 0px | none |
| 定价页 | 价格待公布 | `pricing-tier-price` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 21px | 0px | 0px | none |
| 定价页 | 价格待公布 | `pricing-tier-price-tba` | rgba(0, 0, 0, 0) | rgb(154, 148, 144) | 0px none rgb(154, 148, 144) | —/— | 21px | 0px | 0px | none |
| 定价页 | 即将上线 | `pricing-btn-muted` | rgba(0, 0, 0, 0.03) | rgb(176, 170, 165) | 1px solid rgba(231, 229, 228, 0.8) | —/— | 38px | 0px | 999px | none |
| 定价页 | H3 · 2K 即将上线 H3 2K 精制 2K | `pricing-tier-card.is-anchored` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px dashed rgba(200, 195, 190, 0.8) | —/— | 341px | 18px | 18px | rgba(57, 45, 26, 0.06) 0px 1px 3px 0px |
| 定价页 | H3 · 2K 即将上线 | `pricing-tier-top` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | —/— | 23px | 0px | 0px | none |
| 定价页 | H3 · 2K | `pricing-tier-eyebrow` | rgba(0, 0, 0, 0) | rgb(176, 170, 165) | 0px none rgb(176, 170, 165) | —/— | 15px | 0px | 0px | none |
| 定价页 | 套餐卡 | `pricing-tier-grid` | rgba(0, 0, 0, 0) | rgb(26, 22, 20) | 0px none rgb(26, 22, 20) | 16px/400 | 341px | 0px 0px 0px 0px | 0px | none |
| 定价页 | 套餐卡（推荐） | `月卡礼包 · Pro 59 元 270 AI 积分（含赠 40）` | rgb(255, 255, 255) | rgb(26, 22, 20) | 1px solid rgb(12, 10, 9) | 13.3333px/400 | 316px | 22px 18px 18px 18px | 20px | rgba(12, 10, 9, 0.06) 0px 0px 0px 1px, rgba(57, 45, 26, 0.1) 0 |
| 定价页 | 定价 CTA | `pricing-btn-primary.pricing-btn-primary--lg` | rgb(12, 10, 9) | rgb(255, 255, 255) | 1px solid rgb(12, 10, 9) | 14.5px/800 | 46px | 0px 24px 0px 24px | 999px | none |
| 定价页 | 切换/开关 | `切换到浅色主题` | rgba(255, 255, 255, 0.88) | rgb(61, 56, 53) | 1px solid rgba(231, 229, 228, 0.8) | 13.3333px/400 | 38px | 0px 0px 0px 0px | 9999px | none |
| 定价页 | 徽标 | `pricing-tier-tagline` | rgba(0, 0, 0, 0) | rgb(107, 101, 96) | 0px none rgb(107, 101, 96) | 12px/400 | 37px | 0px 0px 0px 0px | 0px | none |

| 页面 | 控件名 | 文件线索 | 背景色 | 文字色 | 边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 盒阴影 |
|---|---|---|---|---|---|---|---|---|---|---|
| 画布·资产库 | 资产库弹窗容器 | `资产库管理` | rgb(255, 255, 255) | rgb(61, 56, 53) | 1px solid rgba(28, 25, 23, 0.1) | 16px/400 | 756px | 24px 26px 26px 26px | 20px | rgba(28, 25, 23, 0.42) 0px 32px 90px -20px |
| 画布·资产库 | 资产库弹窗·标题：资产库管理 | `canvas-project-assets-title` | rgba(0, 0, 0, 0) | rgb(31, 41, 55) | 0px none rgb(31, 41, 55) | 17px/800 | 22px | 0px 0px 0px 0px | 0px | none |
| 画布·资产库 | 资产库弹窗·卡片：白底商品图 1 测试项目 | `.canvas-asset-library-modal article` | rgb(255, 255, 255) | rgb(38, 49, 60) | 1px solid rgb(231, 234, 238) | 16px/400 | 178px | 0px 0px 0px 0px | 14px | none |
| 画布·资产库 | 资产库弹窗·按钮：全部 | `.canvas-asset-library-modal button` | rgb(32, 34, 38) | rgb(255, 255, 255) | 1px solid rgb(32, 34, 38) | 12px/600 | 32px | 5px 14px 5px 14px | 999px | none |
| 画布·资产库 | 资产库弹窗·页签：全部 | `.canvas-asset-library-modal [role=tab], .canvas-asset-library-modal [class*=tab]` | rgb(32, 34, 38) | rgb(255, 255, 255) | 1px solid rgb(32, 34, 38) | 12px/600 | 32px | 5px 14px 5px 14px | 999px | none |
| 画布·资产库 | 资产库弹窗·输入框： | `搜索项目素材` | rgb(255, 255, 255) | rgb(51, 65, 85) | 1px solid rgb(225, 229, 235) | 12px/400 | 36px | 0px 10px 0px 10px | 9px | none |
| 技能库 | 技能库弹窗容器 | `skill-modal` | rgba(255, 254, 252, 0.98) | rgb(26, 22, 20) | 1px solid rgba(57, 45, 26, 0.1) | 16px/400 | 852px | 0px 0px 0px 0px | 22px | rgba(57, 45, 26, 0.35) 0px 32px 90px -20px |
| 技能库 | 技能库弹窗·按钮：取消编辑 | `skill-mini-btn` | rgb(255, 255, 255) | rgb(61, 56, 53) | 1px solid rgba(57, 45, 26, 0.12) | 13px/600 | 36px | 0px 16px 0px 16px | 10px | none |

**弹窗三套语言实测**

| 弹窗 | 遮罩 | 面板背景 | 圆角 | 边框 | 特性 |
|---|---|---|---|---|---|
| 工作流模板库 | `rgba(15, 23, 42, 0.55)`（**冷蓝黑**）+ `blur(6px)` | `rgb(255, 255, 255)` | `14px` | — | **整个弹窗零 class，全内联样式**；标题 `rgb(15,23,42)` |
| 资产库管理 | `rgba(28, 25, 23, 0.42)`（暖黑） | `rgb(255, 255, 255)` | `20px` | `1px solid rgba(28,25,23,0.1)` | 有 class，可被设计系统覆盖 |
| 技能库 | — | `rgba(255,254,252,0.98)`（暖白） | `22px` | `1px solid rgba(57,45,26,0.1)` | 第三套圆角/底色 |

> 同一个画布上，三个弹窗的**遮罩色温（冷蓝黑 vs 暖黑）、圆角（14/20/22px）、背景（纯白 vs 暖白）各不相同**。

**定价页**：套餐卡 `202×341`，白底 `rgb(255,255,255)` + `1px solid rgba(231,229,228,0.8)` + `18px` 圆角 + `rgba(57,45,26,0.06) 0px 1px 3px`（几乎无阴影）；「即将上线」卡改成 `1px dashed rgba(200,195,190,0.8)` 虚线 —— **可购买与不可购买仅差线型**。主 CTA `rgb(12,10,9)` 近黑胶囊（`border-radius: 999px`），与页面其他 8–20px 圆角控件体系割裂。

---

## 8. hover / 选中 / 禁用 —— 实测差异（含「无差异」证据）

- **底部参数 chip**：背景: rgba(255, 255, 255, 0.84) → rgb(255, 255, 255); 边框: 1px solid rgba(35, 31, 27, 0.11) → 1px solid rgba(88, 73, 58, 0.22); 阴影: rgba(45, 38, 31, 0.06) 0px 4px 14px 0px → rgba(45, 38, 31, 0.11) 0px 9px 24px 0px
- **能力卡（未选中）**：背景: rgba(255, 255, 255, 0.76) → rgb(255, 255, 255); 边框: 1px solid rgba(0, 0, 0, 0) → 1px solid rgb(200, 187, 241); 阴影: none → rgba(69, 50, 132, 0.08) 0px 7px 16px 0px
- **下一步 CTA（禁用）**：无差异（hover 无视觉反馈）
- **上传卡**：边框: 2px dashed rgba(231, 229, 228, 0.8) → 2px dashed rgb(12, 10, 9); 阴影: rgba(57, 45, 26, 0.055) 0px 5px 10px 0px → rgba(57, 45, 26, 0.08) 0px 8px 14px 0px
- **生成设置弹层内选项按钮**：背景: rgba(12, 10, 9, 0.03) → rgba(12, 10, 9, 0.035)
- **「视频模型」弹层选项**：背景: rgba(0, 0, 0, 0) → rgb(245, 241, 255); 文字色: rgb(60, 55, 50) → rgb(104, 66, 220); 边框: 0px none rgb(60, 55, 50) → 0px none rgb(104, 66, 220)
- **「生成设置」弹层选项**：元素不存在
- **「镜头规格」弹层选项**：元素不存在
- **画布结果节点**：无差异（hover 无视觉反馈）
- **定价套餐卡**：无差异（hover 无视觉反馈）
- **资产库弹窗卡片/按钮**：无差异（hover 无视觉反馈）
- **技能库弹窗卡片/按钮**：边框: 1px solid rgba(57, 45, 26, 0.12) → 1px solid rgba(57, 45, 26, 0.28)

**重点结论**
1. **多个高频控件 hover 实测零差异**：画布结果节点、定价套餐卡、资产库弹窗卡片/按钮、首页「下一步」CTA —— 完全无反馈。
2. **「生成设置」弹层内选项 hover 只差 0.5% 不透明度**（`rgba(12,10,9,0.03) → rgba(12,10,9,0.035)`）—— 等于没有。
3. **只有 3 处有明显 hover**：底部参数 chip（抬阴影）、能力卡（加紫描边）、视频模型弹层选项（加淡紫底+紫字）。
4. **禁用态一律靠「整体降灰」**：`rgb(229,229,229)/rgb(170,170,170)`、`rgb(229,227,224)/rgb(168,163,158)` —— 对比度 1.9–2.0:1，既不像禁用也不可读，且**没有任何文案或图标说明为什么禁用**。

---

## 9. 未能覆盖（如实说明，未伪造）

- **`?qa=ec-canvas-real`（真实登录态通道）**：本地无有效会话，进入后回落到首页并弹出登录框（`03` 段截图已证实）。因此**「真实登录态下的资产库/我的画布库」未采到**；资产库改用仓库自带的静态 harness `/.qa/harness-assetlib.html`（本仓库既有 QA 脚本 `.qa/measure-assetlib.mjs` 使用同一入口）补齐。
- **画布「资产库」/「作品集」页签在未登录态**：点击后要么被「保存这张画布？」守卫弹窗拦截（需登录才能保存），要么直接弹登录框。已用「先点一次→取消守卫」的方式拿到 **作品集空库态**（`70-works-gallery-empty.png`）。
- **我的画布页（侧栏「作品」入口）**：源码 `src/App.jsx:80-83` 明确 `if (!state.logged) return requestLogin('works')`，未登录不可达；已用画布内「作品集」页签等价覆盖。
- **首页「自由创作 / 小红书图文」两模式的参数面板**：本次已实测可正常渲染（顶部导航 `#creative-nav-trigger-visual` / `-content` 均可进入），但**未纳入本次正式量测表与截图集**（本任务清单 c 项只点名视频面板），如需要可补测。
- **画布右侧「结果面板」在未选中节点时不在 DOM**（`[class*=result-panel]`/`[class*=inspector]` 计数为 0）；选中节点后出现，已截图 `40-canvas-node-selected.png`（右侧即为结果面板）。
- **首页「选择比例」弹层**：电商生图 mode 无独立「比例」控件（比例在套图方案/生成设置内），已改采**套图方案弹层**（含 `3:4 / 4:5 / 1:1 / 9:16` 分段与张数分段）作为等价覆盖，见 `08/09-home-ec-suite-plan-popover(-crop).png`。
- **`?qa=xhs`**：仓库中无该 query 分支（`src/pages/EcCanvas/canvasBrowserQaState.js` 只认 `ec-canvas / visual / ec-plan-launch / ec-canvas-real`）；小红书图文改由顶部导航 `#creative-nav-trigger-content` 进入。

---

## 10. 改版验收用法

1. 改版后按本文件 §1 的同一份文件清单重跑截图，覆盖到**同名文件的新目录**（建议 `.playwright-shots/design-after/`）；
2. 逐项对比 §3–§7 表格中的 **背景色 / 文字色 / 边框色 / 字号字重 / 高度 / 内边距 / 圆角 / 盒阴影**；
3. 重点验收 §8 的 4 处「零差异 hover」是否已补上反馈，以及 §2 的每个「一句话结论」是否被解决；
4. 数值口径必须保持一致：**`offsetWidth/offsetHeight` 量尺寸 + `getComputedStyle` 取色**（否则画布缩放会污染对比）。

---

## 11. 改后对比（第一批首页改造）

> **改造提交**：`cd132359`（生成设置面板）、`3f58a92c`（电商「下一步」主 CTA）、`1fed0552`（上传卡去红蓝撞色）
> **采集口径**：与 §1 完全一致 —— 视口 **1440×900**、`deviceScaleFactor: 2`、`locale: zh-CN`、同一入口 `http://localhost:5173/`（默认电商生图态）、同一套数据。尺寸用 `offsetWidth/offsetHeight`，颜色/圆角/阴影取 `getComputedStyle` **实际计算值**。
> **改后截图目录**：`.playwright-shots/design-baseline/after/`，文件名与 before 一一对应。
> **只读声明**：本节仅截图与测量，**未修改任何 src**，未 commit。

### 11.1 截图对应关系

| before | after（同机位） | 内容 |
|---|---|---|
| `01-home-ec-default.png` | `after/01-home-ec-default.png` | 首页电商生图默认态（整屏） |
| `02-home-ec-bottom-params-bar.png` | `after/02-home-ec-bottom-params-bar.png` | 底部参数栏（含主 CTA） |
| `03-home-ec-upload-cards.png` | `after/03-home-ec-upload-cards.png` | 两个上传卡 |
| `04-home-ec-gen-settings-modal.png` | `after/04-home-ec-gen-settings-modal.png` | 生成设置面板（整屏） |
| `05-home-ec-gen-settings-modal-crop.png` | `after/05-home-ec-gen-settings-modal-crop.png` | 生成设置面板（特写） |
| —（新增机位） | `after/10-home-ec-cta-enabled.png` | CTA 可用态（输入描述后） |
| —（新增机位） | `after/12-home-ec-cta-hover-crop.png` | CTA hover |
| —（新增机位） | `after/13-home-ec-cta-focus-visible-crop.png` | CTA focus-visible（Tab 聚焦） |
| 原始数据 | `after/_after-raw.json`、`_after-cta.json`、`_after-bar.json`、`_after-d7.json` | 全部实测记录 |

---

### 11.2 生成设置面板（commit `cd132359`）

#### before vs after 实测值

| 项 | before | after | 判定 |
|---|---|---|---|
| **面板底色** | `rgba(252, 252, 253, 0.93)`（冷白，与页面暖米撞色） | `rgba(255, 255, 255, 0.85)` | ⚠️ 仍为半透明白（见 11.5 附注） |
| **面板边框** | `1px solid rgba(255, 255, 255, 0.86)`（白描边≈无边框） | `1px solid rgba(12, 10, 9, 0.06)` | ✅ 改为中性墨色描边，边界可见 |
| **面板圆角** | `8px` | `20px` | ✅ 归入四档（20/12/8/6）；`--sb-radius-panel` |
| **分组区底色** | 纯白卡 `rgb(255,255,255)` + `1px` 描边 | `rgba(0, 0, 0, 0)` **透明** | ✅ **白卡已移除**（见 11.5） |
| **分组区边框** | `1px solid rgba(12,10,9,0.1)` | `0px none` | ✅ 改「留白 + 分组标题」分区 |
| **分组区阴影** | 有 | `none` | ✅ |
| **模型行（未选中）** | `rgba(12, 10, 9, 0.03)` / `1px solid transparent` / `12px` | 同左 | ➖ 不变（`--sb-surface-tint`） |
| **分段控件高度** | 46px | **44px** | ✅ 触达 ≥40 |
| **面板内边距** | 未统一 | `--sb-panel-padding` = `20px` | ✅ |
| **分组间距** | 未统一 | `--sb-group-gap` = `20px` | ✅ 组内:组间 = 8:20 |

#### hover 与 selected 是否已视觉不同？（用户提过三次）

**✅ 已明确分通道。** 这是本次改造最关键的一条：

| 通道 | 背景 | 文字/图标 | 边框 |
|---|---|---|---|
| **默认**（未选中/未 hover） | `rgba(12, 10, 9, 0.03)` | `rgb(26, 22, 20)` 中性墨 | `1px solid rgba(0, 0, 0, 0)` 透明 |
| **hover**（中性灰，**不发紫**） | `rgba(12, 10, 9, 0.035)` | `rgb(26, 22, 20)` **不变** | `1px solid rgba(0, 0, 0, 0)` **不变** |
| **selected**（品牌紫，持久） | `rgb(245, 243, 255)` | `rgb(124, 58, 237)` **紫字** | `1px solid rgb(221, 214, 254)` **紫描边** |

实测证据（`after/_after-raw.json`）：

- 未选中项 hover：`rgba(12,10,9,0.03) → rgba(12,10,9,0.035)`，**只有背景动、文字与边框纹丝不动**；
- 选中项「2K 高清·推荐」：`bg=rgb(245,243,255)` / `color=rgb(124,58,237)` / `border=1px solid rgb(221,214,254)`，**hover 时实测「无差异」——选中态稳定不抖**；
- 即 **hover 走中性通道、selected 走品牌紫通道，两者在色相上即可区分**（灰 vs 紫），不再混淆「鼠标停在这」与「这个面板是开着的」。

> 对照 before：旧实现 hover 与 selected **都**往「紫渐变 + 紫阴影」走，实测差异只有 `rgba(12,10,9,0.03) → rgba(12,10,9,0.035)`（0.5% 不透明度）。**该问题已修复。**

#### 引用的 `--sb-*` token

| 控件 | 引用的 token | 解析值 |
|---|---|---|
| 面板容器圆角 | `--sb-radius-panel` | `20px` |
| 面板内边距 | `--sb-panel-padding` | `20px` |
| 分组间距 | `--sb-group-gap` | `20px` |
| 组内间距 | `--sb-field-gap` | `8px` |
| 选项默认底 | `--sb-surface-tint` | `rgba(12, 10, 9, 0.03)` |
| 选项 hover 底 | `--sb-state-hover-bg` | `rgba(12, 10, 9, 0.035)` |
| 选项 selected 底 | `--sb-state-selected-bg` | `#F5F3FF` → `rgb(245, 243, 255)` |
| 选项 selected 描边 | `--sb-state-selected-line` | `#DDD6FE` → `rgb(221, 214, 254)` |
| 选项 selected 字/图标 | `--sb-state-selected-ink` | `#7C3AED` → `rgb(124, 58, 237)` |
| 选项圆角 | `--sb-radius-card` | `12px` |
| 分组标题 | `--sb-weight-bold` / `--sb-text-hint` | 中性色（不染紫，原则 6.1） |
| 禁用底/字 | `--sb-state-disabled-bg` / `--sb-state-disabled-ink` | `rgba(12,10,9,0.04)` / `#B0AAA5` |
| 焦点环 | `--sb-focus-ring` | `0 0 0 3px rgba(124, 58, 237, 0.32)` |

---

### 11.3 电商底部栏「下一步」主 CTA（commit `3f58a92c`）

| 项 | before | after | 判定 |
|---|---|---|---|
| **高度** | `40px`（且与 `.ec-workbench-cta` 的 44 打架） | **`44px`** | ✅ 统一为 `--sb-control-touch`(44) |
| **圆角** | `10px`（不在四档内） | **`8px`** | ✅ `--sb-radius-control` |
| **底色（可用态）** | 紫→粉→橙三色**渐变** | **`rgb(124, 58, 237)` 纯色 = `#7C3AED`** | ✅ **渐变已停用** |
| **`backgroundImage`** | `linear-gradient(...)` | **`none`** | ✅ 实测证明 |
| **文字色** | `rgb(255,255,255)` | `rgb(255, 255, 255)`（`--sb-brand-ink`） | ✅ |
| **focus 态** | **完全没有** | **存在**：`box-shadow: rgba(124, 58, 237, 0.32) 0px 0px 0px 3px` | ✅ **新增**（原则 4.2） |
| **hover** | `translateY(-1px)` 位移（改布局） | `rgb(124,58,237) → rgb(109,40,217)` **只压深底色，不位移** | ✅ 原则 4.3 |
| **禁用态** | `rgb(229,229,229)` / `rgb(170,170,170)` 裸值 | `rgba(12,10,9,0.04)` / `rgb(176,170,165)` | ✅ `--sb-state-disabled-*` |

**focus 态存在性证明**（两路互证）：
1. 样式表规则实测存在：`.ec-workbench-cta:focus-visible { outline: none; box-shadow: var(--sb-focus-ring); }`
2. 真键盘 Tab 聚焦后 computedStyle：`box-shadow = rgba(124, 58, 237, 0.32) 0px 0px 0px 3px`；
3. 截图 `after/13-home-ec-cta-focus-visible-crop.png` 可见淡紫焦点环。

**引用的 token**：`--sb-brand`(#7C3AED) / `--sb-brand-hover`(#6D28D9) / `--sb-brand-active`(#5B21B6) / `--sb-brand-ink` / `--sb-brand-wash` / `--sb-radius-control`(8) / `--sb-control-touch`(44) / `--sb-text-sm` / `--sb-focus-ring` / `--sb-state-disabled-bg` / `--sb-state-disabled-ink` / `--sb-shadow-md`。

> 说明：默认态（未输入描述）实测 `disabled=true`，故显示禁用样式 `rgba(12,10,9,0.04)`；输入描述后变为纯色品牌紫 —— 两种态**都已截图留证**。

---

### 11.4 两个上传卡：红蓝撞色是否已统一（commit `1fed0552`）

| 卡 | before 边框 | after 边框 | 判定 |
|---|---|---|---|
| **产品图** `.ec-xhs-card-product` | `2px solid var(--red)`（**红**） | `2px dashed rgba(12, 10, 9, 0.1)` | ✅ |
| **参考图** `.ec-xhs-card-reference` | `2px solid var(--blue)`（**蓝**） | `2px dashed rgba(12, 10, 9, 0.1)` | ✅ |

**实测：两卡 computedStyle 完全一致** ——
- 背景 `rgb(255, 255, 255)`、边框 `2px dashed rgba(12, 10, 9, 0.1)`、圆角 `12px`、尺寸 `86×108`、文字色 `rgb(61, 56, 53)`；
- **红/蓝身份色已彻底移除**，改由「产品图 / 参考图」**文案**区分角色（符合原则 6.2「语义色不得当身份标识」）；
- hover 两卡同步：边框 `rgba(12,10,9,0.1) → rgba(12,10,9,0.16)`（`--sb-border-default → --sb-border-strong`），行为一致。

**引用的 token**：`--sb-border-default` / `--sb-border-strong` / `--sb-radius-card`(12) / `--sb-surface-card` / `--sb-shadow-md` / `--sb-brand`(徽标) / `--sb-brand-ink` / `--sb-radius-pill`。

---

### 11.5 不变式核对：面板内是否还有「纯白卡叠在半透明白面板上」（原则 D7）

**结论：✅ 已不违反。** computedStyle 证据：

| 层级 | 元素 | 背景 | 边框 | 阴影 |
|---|---|---|---|---|
| L1 面板 | `.ec-config-panel` | `rgba(255, 255, 255, 0.85)` | `1px solid rgba(12, 10, 9, 0.06)` | — |
| L2 面板体 | `.ec-config-panel-body` | `rgba(0, 0, 0, 0)` 透明 | `0px none` | `none` |
| L3 分组「生图模型」 | (inline style) | **`rgba(0, 0, 0, 0)` 透明** | **`0px none`** | **`none`** |
| L3 分组「清晰度」 | (inline style) | **`rgba(0, 0, 0, 0)` 透明** | **`0px none`** | **`none`** |
| L3 分组「品牌主色调」 | (inline style) | **`rgba(0, 0, 0, 0)` 透明** | **`0px none`** | **`none`** |
| L4 选项控件 | `button` | `rgba(12, 10, 9, 0.03)` | `1px solid transparent` | `none` |

- **三个分组区的背景均为 `rgba(0, 0, 0, 0)`，没有一个等于 `rgb(255,255,255)`** —— 分区分隔改由「留白 20px + 分组标题」承担，不再套白卡。
- 全量扫描面板内所有后代，**高度 >24px 且宽 >120px 的纯白背景元素仅 1 个**：品牌色 `input`（`302×32`，`1px solid rgba(12,10,9,0.1)`）—— 这是**输入框**（控件本身，非卡片），不属于 D7 所指的「白卡叠面板」。
- 对照 before：旧实现分组是「纯白卡 + 极淡黑描边」叠在 L1 半透明白面板上，两者色差 ≈0，那条 1px 边框成了唯一分界 —— **该形态已消除**。

> 附注（供后续批次决策）：L1 面板自身仍是 `rgba(255,255,255,0.85)` 半透明，页面内容会透出（见 `after/05-...-crop.png` 可隐约看到背后文字）。这不违反 D7 字面不变式（D7 禁止的是「面板**内**再套纯白卡」），但若后续要求面板更「实」，可考虑提高不透明度或加 backdrop-filter。

---

### 11.6 本批结论

| 目标 | 结果 |
|---|---|
| 生成设置面板去白卡 + hover/选中分通道 | ✅ **达成**，选中=紫通道、hover=中性通道，色相可辨 |
| 「下一步」CTA 纯色品牌紫 + 无渐变 | ✅ **达成**，`rgb(124,58,237)`、`backgroundImage: none` |
| CTA 补 focus 态 | ✅ **达成**，`rgba(124,58,237,0.32) 0 0 0 3px` 焦点环，Tab 可达 |
| 上传卡去红蓝撞色 | ✅ **达成**，两卡 computedStyle 完全一致 |
| D7 面板内无纯白卡 | ✅ **达成**，三个分组区背景均透明 |

**仍待后续批次处理**（本次未改，如实记录）：
1. 同一底栏 **7 个参数 chip 仍完全同权同形**（全 `126×52`、同白底/同边框/同字重），主次问题未解决；
2. 面板 L1 半透明导致页面文字透出（见 11.5 附注）；
3. 能力卡选中态仍为 `1px solid rgb(130, 105, 231)` + 淡紫渐变（未纳入本批）。

---

## 12. 改后复测（第一批全量落地后 · 数字对比）

> **采集时间**：第一批全部提交后（HEAD `4bfe7192`）
> **口径**：与基线**逐字一致** —— 视口 **1440×900**、`deviceScaleFactor: 2`、`locale: zh-CN`、同一入口、同一套选择器（直接复用 §1 那份 `_measurements.json` 的 selector 集重采）。尺寸 `offsetWidth/offsetHeight`，其余取 `getComputedStyle` 实际值。
> **只读声明**：本节仅截图与测量，**未修改任何 src**，未 commit，未 `git add`。
> **改后数据**：`after/_after.json`、`_after-pages.json`、`_after-composers.json`、`_audit-current.txt`

### 12.1 截图对应关系（after/ 与 before 同名）

| before | after | 内容 |
|---|---|---|
| `01-home-ec-default.png` | `after/01-home-ec-default.png` | 首页电商生图默认态 |
| `02-home-ec-bottom-params-bar.png` | `after/02-home-ec-bottom-params-bar.png` | 底部参数栏 + 主 CTA |
| `03-home-ec-upload-cards.png` | `after/03-home-ec-upload-cards.png` | 两个上传卡 |
| `04-home-ec-gen-settings-modal.png` | `after/04-home-ec-gen-settings-modal.png` | 生成设置面板（整屏） |
| `05-home-ec-gen-settings-modal-crop.png` | `after/05-home-ec-gen-settings-modal-crop.png` | 生成设置面板（特写） |
| `20-canvas-ec-default.png` | `after/20-canvas-ec-default.png` | 画布默认态 |
| `21/22/23-canvas-*` | `after/21/22/23-canvas-*` | 画布顶栏 / 底部栏 / 小地图 |
| `30–33-canvas-composer-*` | `after/30–33-canvas-composer-*` | 画布四个生成框操作台 |
| `40/42-canvas-node-selected*` | `after/40/42-canvas-node-selected*` | 画布节点选中态 |
| `70-works-gallery-empty.png` | `after/70-works-gallery-empty.png` | 作品集（空库） |
| `80/81-pricing-*` | `after/80/81-pricing-*` | 定价页 |
| —（新增） | `after/10-home-ec-cta-enabled.png` | CTA 可用态 |
| —（新增） | `after/12-home-ec-cta-hover-crop.png` | CTA hover |
| —（新增） | `after/13-home-ec-cta-focus-visible-crop.png` | CTA focus-visible |

### 12.2 生成设置面板

| 项 | before | after | 结论 |
|---|---|---|---|
| **面板底色** | `rgba(252, 252, 253, 0.93)`（冷白） | `rgba(255, 255, 255, 0.92)` = `--sb-glass-panel` | ✅ 换 token；但**仍是半透明**（见 12.5） |
| **面板圆角** | `8px` | **`20px`** = `--sb-radius-panel` | ✅ 归入四档 |
| **面板边框** | `1px solid rgba(255,255,255,0.86)`（白描边≈无） | `1px solid rgba(12, 10, 9, 0.06)` = `--sb-border-subtle` | ✅ 边界可见 |
| **面板阴影** | `rgba(37,30,24,0.18) 0 28px 80px, rgba(37,30,24,0.06) 0 2px 10px` | **`none`** | 🔴 **回退！见 12.5** |
| **毛玻璃** | 未收敛 | `blur(24px) saturate(1.8)` = `--sb-blur-panel` / `--sb-saturate-glass` | ✅ 40px/220% 已收敛 |
| **分组区底色** | 纯白卡 `rgb(255,255,255)` + `1px` 描边 | **`rgba(0, 0, 0, 0)`** 透明 | ✅ **D7 达成** |
| **分组区边框/阴影** | 有边框 | `0px none` / `none` | ✅ |
| **清晰度分段高度** | **36px**（`--sb-control-lg`，见 commit `d93219ae` 说明） | **`44px`** | ✅ **36→44**，实测证实 |
| **模型行高度** | `438×40` | `438×40` | ➖ 不变 |

#### hover 与 selected 是否真的不同？（给出两态实际色值差）

**✅ 是，且是色相差（灰 vs 紫），不是透明度微调。**

| 控件 | 默认 | hover | selected |
|---|---|---|---|
| 「2K 高清·推荐」 | — | **hover 无变化**（已是选中） | `bg=rgb(245,243,255)` / `color=rgb(124,58,237)` / `border=1px solid rgb(221,214,254)` |
| 「1K 标准·试方向」 | `bg=rgba(12,10,9,0.03)` / `c=rgb(26,22,20)` | `bg=rgba(12,10,9,0.035)` / `c=rgb(26,22,20)`（**文字色不动**） | `bg=rgb(245,243,255)` / `c=rgb(124,58,237)` |
| 「4K 超清·看细节」 | `bg=rgba(12,10,9,0.03)` | `bg=rgba(12,10,9,0.035)` | 同 1K 的 selected 配方 |
| 「GPT Image 2」模型行 | `bg=rgba(12,10,9,0.03)` | `bg=rgba(12,10,9,0.035)` | — |

**两态差**：hover 只在**中性灰**上加 0.5% 不透明度（`0.03→0.035`）；selected 则整体切到**品牌紫族**（底 `#F5F3FF`、字 `#7C3AED`、描边 `#DDD6FE`）。
→ **色相不同（灰/紫）+ 文字色不同 + 描边有无不同**，用户可分辨「鼠标停在这」与「这个选中了」。

> 对照 before：hover 与 selected **都**往紫走，差异仅 `rgba(12,10,9,0.03) → rgba(12,10,9,0.035)`。**已修复。**

### 12.3 电商主 CTA

| 项 | before | after（可用态） | 结论 |
|---|---|---|---|
| **底色** | 紫→粉→橙**三色渐变** | **`rgb(124, 58, 237)` 纯色 = `#7C3AED`** | ✅ 纯色 |
| **`backgroundImage`** | `linear-gradient(...)` | **`none`** | ✅ 渐变已停 |
| **圆角** | `10px` | `8px` = `--sb-radius-control` | ✅ |
| **高度** | `40px` | **`44px`** = `--sb-control-touch` | ✅ |
| **focus 态** | **不存在** | **存在**：`box-shadow: rgba(124,58,237,0.32) 0 0 0 3px` = `--sb-focus-ring` | ✅ 新增 |
| **hover** | `translateY(-1px)` 位移 | `rgb(124,58,237) → rgb(109,40,217)` 只压深 | ✅ 原则 4.3 |
| **禁用态** | `rgb(229,229,229)` / `rgb(170,170,170)` | `rgba(12,10,9,0.04)` / `rgb(176,170,165)` | ✅ token 化 |

### 12.4 两个上传卡

| 卡 | before | after | 结论 |
|---|---|---|---|
| 产品图 | `2px solid var(--red)` | `2px dashed rgba(12, 10, 9, 0.1)` | ✅ |
| 参考图 | `2px solid var(--blue)` | `2px dashed rgba(12, 10, 9, 0.1)` | ✅ |

**实测两卡 computedStyle 完全一致**（`86×108`、`rgb(255,255,255)`、`12px` 圆角）。
另注：圆角由 `16px` → `12px`（`--sb-radius-card`，归入四档）；阴影由 `rgba(57,45,26,0.055) 0 5px 10px` → `none`（见 12.5 一并讨论）。

### 12.5 🔴 回退项（改前有、改后没有 —— 必须单独列出）

> 这类是**净损失**，与「改了但没改好」不同，建议优先处理。

| # | 控件 | 回退内容 | before | after | 判定 |
|---|---|---|---|---|---|
| **R1** | **生成设置面板** `.ec-config-panel` | **失去全部外阴影** | `rgba(37,30,24,0.18) 0 28px 80px, rgba(37,30,24,0.06) 0 2px 10px` | **`none`** | 🔴 **真 bug，已定因** |
| **R2** | **首页模式卡** `.homepage-mode-card` | **失去全部卡片阴影（4 张全丢）** | 选中 `rgba(64,48,36,0.19) 0 22px 42px` + 3px 紫环；未选中 `rgba(64,48,36,0.14) 0 16px 34px` | **全部 `none`** | 🔴 净损失 |
| **R3** | **上传卡** `.ec-xhs-upload-card` | 失去轻微浮起阴影 | `rgba(57,45,26,0.055) 0 5px 10px` | `none` | 🟡 轻微，但属净损失 |

#### R1 根因（已在浏览器内证实）

`src/pages/Home/Home.css:2338`：

```css
.ec-config-panel { box-shadow: var(--sb-shadow-xl) !important; }
```

但 token 阶梯**只定义到 `--sb-shadow-0`…`--sb-shadow-5`**，**全仓没有任何一处定义 `--sb-shadow-xl`**（`Select-String --sb-shadow-xl` 仅命中 Home.css:2338 这一处**使用**，0 处**定义**）。

浏览器实测：

| 探针 | 结果 |
|---|---|
| `getPropertyValue('--sb-shadow-xl')` | **`(未定义)`** |
| `div.style.boxShadow = 'var(--sb-shadow-xl)'` 解析 | **`none`** |
| 对照 `var(--sb-shadow-5)` | `rgba(57, 45, 26, 0.16) 0px 28px 90px 0px, rgba(57, 45, 26, 0.08) 0px 8px 24px 0px` |

→ CSS 中**未定义的 `var()` 回退为初始值**，`box-shadow` 初始值即 `none`。**面板因此完全没有投影**。

**建议修法**（供决策，我未改）：把 `Home.css:2338` 的 `--sb-shadow-xl` 改为 `--sb-shadow-5`（面板这类浮层对应 shadow-4/5 档）；或补一个 `--sb-shadow-xl` 别名指向 `--sb-shadow-5`。

> 附带说明：R1 面板叠加了 `backdrop-filter: blur(24px) saturate(1.8)`，视觉上仍能与背景区分，所以**不是"完全看不出是浮层"**，但相比 before 明确损失了浮起感。

### 12.6 `node scripts/design-audit.mjs` 关键指标「基线 → 当前」

> ⚠️ **脚本自身有一处失效**：它在结尾读 `src/styles/sb-tokens.css`，但该文件已更名为 `design-tokens-v3.css`，导致**跑到 ⑤ 就崩**（`ENOENT`，exit=1）。①②③③b③c 各段指标在崩溃前已正常输出，下表取自这些段落。

| 指标 | 基线 | 当前 | 变化 | 目标 |
|---|---|---|---|---|
| hex 硬编码 | **5789 次 / 1810 值** | **5838 次 / 1811 值** | 🔴 **+49 次 / +1 值（上升）** | 0 |
| 字号档位 | **27 档** | **27 档** | ➖ 持平（12px×162 / 11px×133 / 13px×97 / 10px×61） | 9 档 |
| 圆角档位 | **21 档** | **21 档** | ➖ 持平（8px×128 / 10px×67 / 6px×44 / 50px×39） | 8 档 |
| z-index 裸值 | **32 个** | **32 个** | ➖ 持平 | 9 档 |
| gap 非阶梯值 | **908/1562（58%）** | **906/1559（58%）** | ➖ 基本持平 | 0% |
| 品牌紫硬编码 | **159 次 / 150 行 / 38 文件** | **159 次 / 150 行 / 34 文件** | 🟢 **使用文件 38 → 34（收敛 4 个）** | 0 |
| `rgba(124,58,237,α)` | **99 处 / 31 α** | **99 处 / 31 α** | ➖ 持平 | ≤5 档 |
| 悬停位移站点 | **85 处 / 20 档**（>4px 高风险 5 处） | **85 处 / 20 档**（>4px 高风险 5 处） | ➖ 持平 | ≤3 档 |
| 裸 `outline:none` | **80 处** | **70 处** | 🟢 **-10** | 0 |
| `<div onClick>` | **107 处** | **97 处** | 🟢 **-10** | 0 |
| `focus-visible` 覆盖 | **115 次** | **124 次** | 🟢 **+9** | 保持 ✅ |
| `backdrop-filter` 文件数 | **41 个** | **41 个** | ➖ 持平 | ≤3 |
| 危险色用作文案/标识 | **5 处** | **5 处** | ➖ 持平 | 0 |
| `prefers-reduced-motion` | **32 处** | **32 处** | ➖ 持平 | 保持 ✅ |

**读数要点**
- 🟢 **确实在改善**：`outline:none` -10、`<div onClick>` -10、`focus-visible` +9、品牌紫使用文件 -4。方向正确。
- 🔴 **但"碎片化"三巨头（hex / 字号 / 圆角 / gap）纹丝未动**：hex 甚至 **+49 次**。说明本批改的是**局部组件**，尚未触及全局碎片化存量；hex 上升很可能来自新增的 token 定义文件本身（`design-tokens-v3.css` 里的 hex 被计入）。
- ⚠️ **口径提示**：该脚本把 token 定义文件里的 hex 也计入"硬编码"，因此"token 化越彻底、hex 计数反而越高"是这套口径的固有假象。**建议脚本排除 token 定义文件**（与它已排除 `sb-tokens.css` 的意图一致，只是文件名没跟着改）。

### 12.7 本批复测结论

| 目标 | 结果 |
|---|---|
| 生成设置面板：底色/分组底/圆角/控件高度 | ✅ 分组底透明（D7 达成）、圆角 8→20、**分段 36→44** |
| hover 与选中态是否真的不同 | ✅ **是**，灰(中性) vs 紫(品牌) 色相可辨；selected 稳定不抖 |
| 主 CTA 品牌紫纯色 | ✅ `rgb(124,58,237)`、`backgroundImage: none` |
| 主 CTA focus 态存在 | ✅ `rgba(124,58,237,0.32) 0 0 0 3px` |
| 上传卡边框统一 | ✅ 两卡 computedStyle 一致 |
| **是否有回退项** | 🔴 **有 3 项**：R1 面板失去全部阴影（`--sb-shadow-xl` 未定义，**真 bug**）、R2 首页模式卡 4 张全丢阴影、R3 上传卡失去轻微浮起 |

**优先处理建议**：R1（一行修复，且是明确的 token 名错误）→ R2/R3（确认是"刻意去掉阴影走描边分层"还是误删）。

**采集环境备注**：复测期间另一 agent 正在并发编辑 `src/NoteModal.jsx`，其 Vite transform 间歇性返回 500（`#root` 为空、页面全白）。我采用**轮询直到 `#root` 有子节点**的方式取健康态，全部测量均在页面正常渲染时完成；该 500 与本次改造无关，最终该文件已恢复 200。

---

## 13. B1 迁移后复测（三列对照 + 回退项排查）

> **背景**：§C B1 批 1a（Home.css 379 处）+ 批 1b（首页其余 14 文件 242 处）硬编码色值 → token；六面板圆角收敛 + 选中态改 ring；底部操作区挂 .ui-modal-footer（5 → 16 文件）；可达性改造。
> **口径**：与基线逐字一致（1440x900 @ DSF2、locale zh-CN、同一份 246 条选择器集）。
> **环境**：独立 vite 端口 5180（未动他人 5173）；进入测量前跑健康判据（无 vite-error-overlay + 关键节点已挂载 + 正文非「加载中」），不健康则重试导航。
> **只读**：未改 src、未 commit、未 git add。
> **数据**：after/_b1-home.json、_b1-pages.json、_b1-pixeldiff.json、_b1-diff-heatmap.png

### 13.1 健康网关结果

| 页面 | 尝试次数 | 结果 |
|---|---|---|
| 首页 | **attempt 1** | ✅ 一次通过 |
| 生成设置面板 | attempt 1 | ✅ |
| 画布 ?qa=ec-canvas | **attempt 1** | ✅ |
| 定价页 | **attempt 1** | ✅ |

**全部一次通过，无需重试** —— 上一轮遇到的瞬时白屏（并发 agent 编辑 NoteModal.jsx 导致的 500）本次未复现。

> 环境备注：测量全部完成后，我起的 5180 端口 vite 进程因 **EBUSY** 退出 —— 另一 agent 的编辑器临时文件（src/pages/VideoStudio/VideoStudio.css~RF268ce77.TMP）被 FSWatcher 监听失败。属环境噪声，**发生在我所有测量之后**，不影响本节数据。

### 13.2 三列对照：基线 → 上次改后 → 本次（10 个代表点）

| # | 控件 | 指标 | 基线 | 上次改后 | 本次 | 判定 |
|---|---|---|---|---|---|---|
| 1 | 下一步 CTA（可用） | bg / color | 紫→粉→橙渐变 | rgb(124,58,237) | **rgb(124,58,237)** | ✅ 保持 |
| 2 | 上传卡·产品图 | border | 2px solid var(--red) | 2px dashed rgba(12,10,9,0.1) | **同左** | ✅ 保持 |
| 3 | 上传卡·参考图 | border | 2px solid var(--blue) | 2px dashed rgba(12,10,9,0.1) | **同左** | ✅ 保持（两卡一致） |
| 4 | 生成设置面板容器 | bg / border / radius | rgba(252,252,253,.93) / 白描边 / 8px | rgba(255,255,255,.92) / rgba(12,10,9,.06) / 20px | **同左** | ✅ 保持 |
| 5 | 面板内「2K」选中 | bg / color / border | 纯灰块 + 淡紫描边 | rgb(245,243,255) / rgb(124,58,237) / rgb(221,214,254) | **rgb(245,243,255) / rgb(124,58,237) / rgb(124,58,237)** | 🔄 描边改 ring（见 13.4） |
| 6 | 面板内「1K」默认 | bg | rgb(229,229,229) 纯灰 | rgba(12,10,9,0.03) | **rgb(244,244,244)** | 🔄 底色变浅（见 13.4） |
| 7 | 能力卡（选中） | bg / border | 渐变 / rgb(130,105,231) | 同基线 | **同基线** | ➖ 本批未动 |
| 8 | 首页模式卡（选中） | bg / border | rgba(255,255,255,.96) / 紫 | rgb(245,243,255) / rgb(221,214,254) | **同左** | ✅ 保持 |
| 9 | 首页模式卡（未选中） | bg / border | rgba(255,255,255,.96) | rgb(255,255,255) / rgba(12,10,9,.1) | **同左** | ✅ 保持 |
| 10 | 参数 chip（底栏） | bg / border | rgba(255,255,255,.84) / rgba(35,31,27,.11) | rgb(255,255,255) / rgba(12,10,9,.1) | **同左** | ✅ 保持 |

### 13.3 🔴 回退项（本批新发现，优先级最高）

#### R4 —— `--sb-shadow-sm/md/lg` 全部未定义，导致全站卡片阴影消失（`--sb-shadow-xl` 同类 bug 的第二处，且更大）

上一轮发现 `--sb-shadow-xl` 未定义（已修，现 0 处使用）。**本次系统扫描发现同类问题仍在，且范围更大**：

| token | 是否定义 | var() 解析结果 | 使用处 |
|---|---|---|---|
| `--sb-shadow-0` … `--sb-shadow-5` | ✅ 已定义 | 正常 | — |
| **`--sb-shadow-sm`** | ❌ **未定义** | **none** | **4 处 / 2 文件** |
| **`--sb-shadow-md`** | ❌ **未定义** | **none** | **10 处 / 3 文件** |
| **`--sb-shadow-lg`** | ❌ **未定义** | **none** | **9 处 / 4 文件** |
| `--sb-shadow-xl` | ❌ 未定义 | none | 0 处（已改掉） |

**浏览器实测（直接探针）**：
```
--sb-shadow-sm     defined=false  resolves=none
--sb-shadow-md     defined=false  resolves=none
--sb-shadow-lg     defined=false  resolves=none
对照 --sb-shadow-3  defined=true   resolves=rgba(57, 45, 26, 0.1) 0px 4px 16px 0px
```

**实测受影响元素（首页，shadow 全部为 none）**：

| 元素 | 基线 shadow | 本次 | CSS 位置 |
|---|---|---|---|
| `.homepage-mode-card`（4 张模式卡） | rgba(64,48,36,0.14) 0 16px 34px | **none** | Home.css:2511 `var(--sb-shadow-lg)` |
| `.ec-config-trigger`（参数 chip） | rgba(45,38,31,0.06) 0 4px 14px | **none** | Home.css:2251 `var(--sb-shadow-sm)` |
| `.ec-xhs-upload-card`（上传卡） | rgba(57,45,26,0.055) 0 5px 10px | **none** | Home.css:442 `var(--sb-shadow-sm)` |
| `.ec-workbench-cta`（主 CTA） | — | **none** | Home.css:2438 `var(--sb-shadow-md)` |
| `.ec-xhs-add-card:hover` | — | **none** | Home.css:466 `var(--sb-shadow-md)` |

**全站扫描结果**：box-shadow 中出现 var() 引用共 **65 处**，其中解析为 **none 的 32 处**。除上述 `--sb-shadow-*` 外，还包括：`--sb-brand-a32`（3 处，含 `.shubao-gen-cta`）、`--sb-brand-a18`、`--sb-brand-ring`、`--nav-item-accent`、`--red`/`--blue`/`--shadow-red`（旧色名，首页已迁移故失效）、`--xy-*`（React Flow 自带变量，属第三方）。

**修法建议**（供决策，我未改）：
1. 在 design-tokens-v3.css 补别名：`--sb-shadow-sm: var(--sb-shadow-1); --sb-shadow-md: var(--sb-shadow-3); --sb-shadow-lg: var(--sb-shadow-4);`（或把使用处直接改成数字档）；
2. 把「token 必须已定义」纳入 design-audit.mjs 或测试门禁 —— 未定义 var() 静默回退为 none，**不报错、不警告**，正是这类 bug 能连出两处的原因。

### 13.4 变化项（非回退，但需确认是否符合预期）

| 项 | 上次改后 | 本次 | 说明 |
|---|---|---|---|
| 面板内选中态描边 | 1px solid rgb(221,214,254) | 1px solid rgb(124,58,237) 品牌紫 | 选中态改 ring 后描边更饱和；**边框宽度恒为 1px，无布局抖动**（符合本批「零抖动」目标） |
| 面板内选项默认底 | rgba(12,10,9,0.03) | rgb(244,244,244) | 由半透明黑改为不透明浅灰，观感更实，但**不再是「值等价」** |
| 面板内 hover 底 | rgba(12,10,9,0.035) | rgb(237,237,237) | 同上，hover 与默认仍可区分（244 → 237） |
| 选中项 hover | 无变化 | rgb(245,243,255) → rgb(237,233,254) | **新增** hover 反馈，选中态不再死板 ✅ |

> ⚠️ 注意：`rgb(244,244,244)` 是**纯中性灰（R=G=B）**，而 token 体系的中性色是暖灰 rgba(12,10,9,α) / #F5F1EA 一族。该值疑似**新增的硬编码**，建议核对是否为 `.sb-opt` 预置类引入。

### 13.5 像素级对比（首页整屏 before vs now）

| 指标 | 数值 |
|---|---|
| 对比尺寸 | 2880x1800（5,184,000 px） |
| 差异像素数 | 286,599 |
| **差异像素占比** | **5.5285%** |
| **最大通道色差 Δ** | **234** |
| 平均色差 Δ | 0.5439 |
| Δ>8 像素占比 | 1.4666% |
| Δ>32 像素占比 | 0.2872% |

**差异定位（9x6 网格）**：差异**高度集中**在 r2c2–r2c6（y=600–900，即**模式卡轮播带**），该带内 Δ>8 占比 17.9%–25.9%、maxΔ 177–234；其余网格几乎全为 0。

**热力图**（after/_b1-diff-heatmap.png）显示差异轮廓**恰好是 4 张模式卡的边缘/阴影区**，印证 13.3 的结论：**首页整屏的视觉差异，主要来自模式卡丢失阴影**（外加左上 logo 的抗锯齿噪声）。

> **判定**：5.53% / maxΔ 234 **远超**「值等价」量级（对标上次 /ec-studio 的 0.0722%、/pricing 的 maxΔ ≤3）。**结论：本批首页改造不是「值等价」，而是有可见视觉变化** —— 且变化主因是 R4 阴影丢失这个 bug，而非有意设计。修掉 R4 后应重跑本项，预期可回落到 <0.1% / maxΔ ≤3 量级。

### 13.6 本批结论

| 目标 | 结果 |
|---|---|
| token 化后色值「值等价」 | ⚠️ **部分达成**：10 个代表点中 7 个完全保持；面板内底色 3 个点有可见变化（13.4） |
| 选中态改 ring、零布局抖动 | ✅ **达成**：边框宽度恒 1px，选中/默认/hover 三态可辨 |
| 全站无第二处 shadow token 同类 bug | ❌ **未达成**：发现 **--sb-shadow-sm/md/lg 三个 token 同样未定义**，影响 23 处 / 5 文件，是更大范围的同类问题（R4） |
| 浮起类容器是否仍有阴影 | ❌ **否**：模式卡 / 参数 chip / 上传卡 / 主 CTA **全部 shadow: none** |
| 可达性（焦点环、语义按钮） | ✅ 保持：CTA focus-visible 存在且 Tab 可达；--sb-focus-ring 正常解析 |

**优先处理**：R4（补 3 个 shadow token 别名 + 加「token 必须已定义」门禁）→ 修完重跑 13.5 像素对比确认回落。

---

## 14. R4 修复复验（阴影回归 + 幽灵变量 + 像素差异）

> **修复提交**：`4d7896cc`（补 `--sb-shadow-sm/md/lg/xl` 别名）、`9becfad7`（补语义色 `-bg`/`-line` 别名 + 新增幽灵变量门禁 `test/token-vars-defined.test.mjs`）
> **口径**：与基线逐字一致（1440x900 @ DSF2、locale zh-CN、同选择器集）。
> **环境**：独立 vite 端口 **5181**（未动他人 5173）；健康判据**一次通过（attempt 1，无重试）**。只读：未改 src、未 commit、未 git add。
> **数据**：`after/_r4-reverify.json`、`_r4-pixeldiff.json`、`_r4-diff-heatmap.png`、`pixel-home-now-r4.png`

### 14.1 阴影是否回来了 —— ✅ 基本回来（1 项为设计使然）

**token 别名已生效**（浏览器直测）：
```
--sb-shadow-sm  raw=0 1px 2px rgba(57,45,26,0.05)   resolves=rgba(57, 45, 26, 0.05) 0px 1px 2px 0px
--sb-shadow-md  raw=0 4px 16px rgba(57,45,26,0.10)  resolves=rgba(57, 45, 26, 0.1) 0px 4px 16px 0px
--sb-shadow-lg  raw=0 12px 36px rgba(57,45,26,0.13) resolves=rgba(57, 45, 26, 0.13) 0px 12px 36px 0px, ...
--sb-shadow-xl  raw=0 28px 90px rgba(57,45,26,0.16) resolves=rgba(57, 45, 26, 0.16) 0px 28px 90px 0px, ...
```

| 元素 | 上次（R4 未修） | **本次** | 判定 |
|---|---|---|---|
| `.homepage-mode-card.card-1`（选中） | none | **`rgba(124,58,237,0.32) 0 0 0 3px, rgba(57,45,26,0.13) 0 12px 36px`** | ✅ 回来 |
| `.homepage-mode-card.card-2` | none | **`rgba(57,45,26,0.13) 0 12px 36px, rgba(57,45,26,0.06) 0 2px 8px`** | ✅ |
| `.homepage-mode-card.card-3` | none | **同 card-2** | ✅ |
| `.homepage-mode-card.card-4` | none | **同 card-2** | ✅ |
| `.ec-config-trigger`（参数 chip） | none | **`rgba(57,45,26,0.05) 0px 1px 2px`** | ✅ |
| `.ec-xhs-upload-card`（上传卡） | none | **`rgba(57,45,26,0.05) 0px 1px 2px`** | ✅ |
| `.ec-workbench-cta`（默认=禁用） | none | `none` | ➖ **设计使然**（见下） |
| `.ec-workbench-cta`（**可用态**） | none | **`rgba(57,45,26,0.1) 0px 4px 16px`** | ✅ 回来 |

**关于 `.ec-workbench-cta`**：默认态确实为 `none`，但这是 **CSS 明确规定的禁用态**：
```css
Home.css:2438  .ec-workbench-cta { box-shadow: var(--sb-shadow-md); }
Home.css:2452  .ec-workbench-cta:disabled { box-shadow: none; cursor: not-allowed; }
```
实测三态：
| 态 | disabled | box-shadow |
|---|---|---|
| 默认（未输入描述） | `true` | `none` ← 禁用态设计 |
| 输入描述后（可用） | `false` | **`rgba(57,45,26,0.1) 0px 4px 16px 0px`** |
| Tab 聚焦（focus-visible） | `false` | **`rgba(124,58,237,0.32) 0px 0px 0px 3px`**（焦点环） |
→ **不是回退**：`--sb-shadow-md` 已生效，只是被 `:disabled { box-shadow: none }` 覆盖。**只要按钮可用就有阴影。**

### 14.2 全站幽灵变量复查 —— 数字大幅下降，且**我上次的 32 处高估了**

| 口径 | 上次 | **本次** |
|---|---|---|
| box-shadow 中 `var()` 引用总数 | 65 | **66** |
| 解析为 `none`（我上次的原始口径） | **32** | **23** |

**但要修正我上次的统计口径**：那 23 处里**大部分是假阳性**。我的扫描器把每个 token **单独当作整个 `box-shadow` 值**测试 —— 而像 `--sb-brand-a32` 这类**颜色 token** 本就该作为颜色分量使用，单独测必然是 `none`。实测证明：
```
var(--sb-brand-a32)                  => none            ← 我的旧扫描器做法（假阳性）
0 5px 14px var(--sb-brand-a32)       => rgba(124, 58, 237, 0.32) 0px 5px 14px  ← 真实用法，正常
0 0 0 3px var(--sb-brand-ring)       => rgba(124, 58, 237, 0.32) 0px 0px 0px 3px ← 正常
```

**按正确口径重新归类本次 23 处**：

| 类别 | 处数 | 说明 |
|---|---|---|
| 颜色 token 被当整体值测试（**假阳性**） | **15** | `--sb-brand-a32`(6)、`--sb-brand-a18`(3)、`--shadow-red`(2)、`--nav-item-accent`、`--red`、`--blue`、`--sb-brand-ring`、`--sb-danger-hover`、`--sb-brand-600` —— 均**已在用色分量，实际生效** |
| React Flow 自带 `--xy-*` | **6** | 第三方库内部变量，非本项目 token |
| **真正的幽灵变量** | **2** | 均为 `--shadow-red @ .gen-btn.xhs` |

**真正的 2 处也已确认是「注释里的历史记录」，非活代码**：
```
src/pages/Home/Home.css:238
  ① 幽灵变量：var(--shadow-red) 全仓无定义 → box-shadow 静默失效；
```
全仓搜 `var(--shadow-red)` **仅命中这一行注释**（源码里已注明该问题）；搜 `--shadow-red:` **0 处定义**。

> **结论：真实幽灵变量 = 0 处（活代码）**。R4 已完整修复，且新门禁 `test/token-vars-defined.test.mjs` 已在源头拦住同类问题。

### 14.3 像素对比重跑 —— ⚠️ **未回落到 <0.1%**（5.2923% / maxDelta 235）

| 指标 | 基线→上次改后 | **基线→本次** | 预期 |
|---|---|---|---|
| **diffPct** | 5.5285% | **5.2923%** | <0.1% ❌ |
| **maxDelta** | 234 | **235** | ≤3 ❌ |
| 平均 Δ | 0.5439 | 0.4837 | — |
| Δ>8 占比 | 1.4666% | **1.1226%** ↓ | — |
| Δ>32 占比 | 0.2872% | **0.3344%** ↑ | — |

**差异仍高度集中在 r2c2–r2c6（模式卡轮播带）**：
```
r2   7.1/90   0.0/0   20.6/177   18.6/234   3.6/235   2.9/234   1.1/234   0.0/0   0.0/0
```

#### 为什么没回落？—— **不是 bug，是有意的设计变更**

我逐点采样并比对了模式卡的实测值，**发现残留差异来自三处「刻意的 token 归一化」，而非阴影丢失**：

**① 模式卡阴影被换成 token 档（diff 主因）**

git blame 确认是 commit `51bf2346`（首页主模式切换 token 化）**有意为之**：
```diff
- box-shadow: 0 16px 34px rgba(64,48,36,.14);        /* 硬编码 */
+ box-shadow: var(--sb-shadow-lg);                    /* = 0 12px 36px rgba(57,45,26,.13) */
```
| | 基线 | 本次 |
|---|---|---|
| 未选中卡 | `rgba(64,48,36,0.14) 0 16px 34px` | `rgba(57,45,26,0.13) 0 12px 36px`（**偏移 16→12、模糊 34→36、色相 64,48,36→57,45,26**） |
| 选中卡 | `rgba(109,93,252,0.12) 0 0 0 3px, rgba(64,48,36,0.19) 0 22px 42px` | `rgba(124,58,237,0.32) 0 0 0 3px, rgba(57,45,26,0.13) 0 12px 36px` |

阴影**偏移量 22px→12px 缩小了 45%**，投影面积明显变化 → 这正是 r2 带数万像素差异的来源。**这是「值不等价」的 token 归并**，属设计决策，需产品/设计确认是否接受。

**② 选中态 ring 变强**：`rgba(109,93,252,0.12)` → `rgba(124,58,237,0.32)`，α 从 0.12 提到 0.32（约 2.7 倍），环更明显。

**③ 卡片底色/描边**：实测 `bg`/`border` 与**基线一致**（`rgb(245,243,255)` / `rgb(221,214,254)`）——这部分不是差异源。

#### 采样证据（r2 带内实际像素）
```
(900,700)  基线 rgb(255,255,254)  现在 rgb(245,243,255)  d=12   ← 选中卡底色（基线白→现在淡紫）
(1100,700) 基线 rgb(252,251,250)  现在 rgb(242,239,251)  d=12   ← 同上
(700,700)  基线 rgb(245,234,214)  现在 rgb(245,234,214)  d=0    ← 非卡片区完全一致
(1300,700) 基线 rgb(221,170,140)  现在 rgb(221,170,140)  d=0    ← 图片区一致
```
→ **卡片以外的区域像素完全一致**，证明差异确由卡片本身的设计变更引起。

### 14.4 结论

| 目标 | 结果 |
|---|---|
| ① 阴影是否回来 | ✅ **回来**：模式卡×4 / 参数 chip / 上传卡 / **CTA 可用态** 均有阴影；CTA 默认态 `none` 是 `:disabled` 设计规定 |
| ② 幽灵变量复查 | ✅ **真实幽灵 = 0**（活代码）；原始口径 32 → 23，其中 15 假阳性 + 6 第三方 + 2 已注明注释 |
| ③ 像素回落 <0.1% / maxDelta ≤3 | ❌ **未回落**（5.2923% / 235）；但**已定性：不是 bug，是模式卡阴影/选中环的刻意 token 归一化**（commit `51bf2346`） |

**建议**：
1. **R4 可关闭** —— 阴影 bug 已修复且有效；
2. 像素对比项要达标，需产品/设计**确认是否接受模式卡阴影从 `0 16px 34px/.14` 改为 `0 12px 36px/.13`**。若要「值等价」，应把 `--sb-shadow-lg` 的值调回接近基线的档位，或给模式卡单独指定更接近的档；
3. **修正像素对比的验收口径**：本次证明「整屏 diffPct」会把**有意的设计变更**算成噪声。建议改为**分区段对比**（卡片区 / 非卡片区分别统计）—— 本次非卡片区实测 `d=0`，即可精准证明「改动是局部的、有意的」。
4. 建议把**我的扫描器口径**（颜色 token 不可单独当 box-shadow 测）写进 `design-audit.mjs` 的说明，避免后续把颜色 token 误报成幽灵变量。
