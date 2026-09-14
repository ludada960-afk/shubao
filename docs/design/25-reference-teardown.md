# 25 · 参考产品拆解（Reference Teardown）

> **这份文件回答**：从谁身上学什么、**明确不学什么**。
> **方法说明**：调研报告 `_research/ai-tools-ui.md`（13 个产品线上 DOM 实测）与 `_research/standards.md`（权威规范原文）是本文的证据底座。本文件里的 px 数值是**线上实测值**，不是目测估算。
> **立场**：**不抄配色**。学的是**层级、状态、结构、留白**。薯包的品牌基底（暖米白 + 品牌紫）保持不变。

---

## 0. 一句话结论

> 13 个参考产品的共性是：**克制**。它们不靠颜色和装饰建立层级，靠的是**表面色阶 + 圆角递减 + 阴影层数**这套结构语法。毛玻璃在 Canva 和 Figma 里**出现次数是 0**。

---

## 1. 跨产品共性规律（10 条，全部有实测证据）

| # | 规律 | 实测证据 |
|---|---|---|
| **1** | **hover 只动底色，selected 才动文字**——两个维度不混用 | Vercel Colors 官方原文：`Color 1=默认底 / Color 2=Hover / Color 3=Active`。Krea 最严格：选中**只加 5% 白底 + 阴影，文字完全不变**，因为它把"文字亮度"单独留给 label(60%) vs value(100%) 的区分 |
| **2** | **`8%` 是跨产品、跨明暗主题的收敛常数** | 即梦 `rgba(255,255,255,0.08)`（出现 103 次，最高频）、可灵同值、Linear 同值（36 次，最高频）、Vidu 同值、Vercel `--ds-gray-alpha-200: #00000014`（=8% 黑） |
| **3** | **嵌套语法 = 圆角由外向内递减 + 阴影只给最外层** | 即梦：浮层卡片 `12px` 圆角 → 内部条目 `8px` 圆角，**内层阴影一律 `none`**；子项宽度 232 = 240 − 4×2（**精确 4px 内缩**）。Vercel Materials 官方原文：「**Don't stack two Materials on the same element**」 |
| **4** | **阴影用"层数"编码高度，不是用"变黑"** | Vercel Geist `--ds-shadow-*`：tooltip = 边框 + **2 层**投影、menu = **3 层**、modal = **4 层**，每层都带 `0 0 0 1px #00000014` 兜底描边，**所有投影 alpha ≤ 6%** |
| **5** | **毛玻璃不是"高级感"的必要条件** | 实测 **Canva 和 Figma 完全没有 `backdrop-filter`**；Notion 只有 `blur(0px)`；Linear 仅 2 处且一处在 transparent 底上 |
| **6** | **面板内分组靠"留白 + 分组标题"，不靠套卡片** | 即梦参数面板：分组间用 `24px` 留白 + 11px 分组标题，组内元素无背景无边框 |
| **7** | **参数项用"图标 + 名称 + 描述语"三段式** | 即梦/可灵/Krea 的模型选择器统一结构：左侧 16–20px 图标，主标题 13–14px/500，副标题 11–12px/400 且用 60% 不透明度 |
| **8** | **chip / segmented 用胶囊 + 单选语义** | 即梦平台选择、Krea 模型切换均为胶囊，选中 = 实底 + 白字，未选 = 透明底 + 60% 文字 |
| **9** | **浮层阶梯：dropdown < popover < modal < toast < tooltip** | Vercel Geist z-index：drawer(200) < modal(300) ≪ menu(2001) < toast(5000) ≪ **tooltip(99999)**。**tooltip 高于 modal** 是极易踩坑的细节 |
| **10** | **遮罩不透明度与"阻断程度"成正比** | Vercel `--ds-overlay-backdrop-opacity: 0.8`；Notion 遮罩 `rgba(0,0,0,0.75)`。两者高度接近 |

---

## 2. 逐产品拆解：从谁身上学什么

### 2.1 即梦 Dreamina / Seedream（火山引擎）— 学「中文电商场景的参数面板」

**URL**：https://jimeng.jianying.com/ai-tool/home ｜ https://jimeng.jianying.com/ai-tool/generate

| 学什么 | 实测细节 | 薯包怎么用 |
|---|---|---|
| ✅ **深色浮层的嵌套语法** | 浮层卡片 `12px` 圆角 / `#262626` / `4px` padding / 阴影 `0 8px 56px` → 内部条目 `8px` 圆角 / 全透明底 / `9px 12px` padding / 阴影 `none`。子项宽度 232 = 240 − 4×2，**精确 4px 内缩** | 面板 20px → 组内选项 12px；**内层一律零阴影** |
| ✅ **选中态的克制** | 未选 `color: 0.698`（≈70% 白）→ 选中 `color: 1.0` + `bg: rgba(255,255,255,0.04)`。**只动文字亮度 + 4% 底色** | 选中 = `--sb-brand-soft` 底 + `--sb-ink-brand` 文字，**不加阴影不渐变** |
| ✅ **8% 填充常数** | `rgba(255,255,255,0.08)` 出现 **103 次**（最高频） | 亮色主题对应 `--sb-surface-tint-strong`(`rgba(12,10,9,.06)`) 或 `--sb-surface-sunken` |
| ❌ **不学：`blur(80px)` 作用在 transparent 底上** | 实测有 2 处，此时几乎不产生可读模糊，**接近纯装饰** | 毛玻璃的底必须有实际半透明色，且 blur ≤24px |

### 2.2 可灵 Kling — 学「参数分组的克制」

**URL**：https://klingai.com/ ｜ https://kling.ai/

| 学什么 | 实测细节 |
|---|---|
| ✅ **8% 选中底** | 与即梦同值 `rgba(255,255,255,0.08)` |
| ⚠️ **反面教材：底座是 Element Plus 且未覆盖默认蓝** | 实测到 `--el-*` 变量，说明它直接用组件库默认主题，**没做品牌覆盖**。结果是"能用的工具"而不是"有身份的产品" |
| **对薯包的启示** | 我们有品牌紫，**不要走可灵这条"用默认主题"的路**。但也别走到另一个极端（到处用紫）——见 §3 |

### 2.3 Vidu — 学「一致的 8% 体系」

**URL**：https://www.vidu.cn/

- ✅ 与即梦/可灵/Linear 一致的 `rgba(255,255,255,0.08)`。
- **结论**：8% 是行业收敛值，可以直接作为 `--sb-surface-tint-strong` 的设计依据。

### 2.4 Midjourney Web — 学「大规模图墙的留白控制」

**URL**：https://www.midjourney.com/home

| 学什么 | 要点 |
|---|---|
| ✅ **图墙的呼吸感** | 图片之间用 **固定列宽 + 大间距**，而不是"铺满"。容器的 padding 明显大于图片间距 |
| ✅ **浮层工具条贴在图片上** | 操作按钮浮在图片下缘，用半透明底 + 模糊，**不占据布局空间** |
| ❌ **不学：极简到极致的门槛** | Midjourney 的 UI 是"给熟手用的"，新用户几乎无引导。薯包的用户是电商卖家，**需要更多路径指引** |

### 2.5 Krea — 学「最严格的 hover/selected 分离」

**URL**：https://www.krea.ai/ ｜ https://www.krea.ai/image

| 学什么 | 实测细节 | 薯包怎么用 |
|---|---|---|
| ✅ **最强证据：hover 与 selected 走完全不同的维度** | 选中**只加 5% 白底 + 阴影，文字完全不变**。它把"文字亮度"这个维度**单独留给** "label(60%) vs value(100%)" 的区分——**两个维度不混用** | 这正是老板说的"选中态有不同交互"。薯包规则：hover 动底色（中性灰），selected 动描边 + 文字色（品牌紫），**互不重叠** |
| ✅ **毛玻璃的正当用法示范** | 全站**只有 2 处** `backdrop-filter`，且都严格用于「浮在作品之上的输入框/选择器」。外层 `blur(40px)` + 32px 圆角 → 内层 `blur(8px)` + 8px 圆角，**圆角与模糊同步递减** | 薯包：只允许面板 / 吸顶导航 / 画布浮条三处。且**禁止嵌套毛玻璃**（Krea 是唯一做嵌套的，我们不跟） |
| ✅ **Promptbox 的圆角递减** | Promptbox `32px` → Model 控件 `8px` | 面板 20px → 内层选项 12px → 微件 8px |

### 2.6 Runway — 学「生成工作流的进度可视」

**URL**：https://runway.com/ ｜ https://app.runwayml.com/

| 学什么 | 要点 |
|---|---|
| ✅ **生成过程的可见性** | 生成不是"转圈等待"，而是展示**当前步骤 + 进度**。用户知道系统在干什么 |
| ✅ **画布优先** | 工具栏围绕画布边缘分布，**不占用中心** |
| **薯包对照** | 现状 `Generate/Loading.jsx` 是全屏 Loading，且 `App.jsx:301-305` 用 `zIndex: 9999` 覆盖全屏——**用户完全看不到进度**。应改为骨架屏 + 分步进度 |

### 2.7 Photoroom — 学「电商工具的模板化引导」

**URL**：https://www.photoroom.com/

| 学什么 | 要点 |
|---|---|
| ✅ **空态即入口** | 首页不是空画布，而是**预置模板网格**。用户点一下就有产出 |
| ✅ **分类导航在左侧，宽而浅** | 分类项一行一个，带缩略图，**不做多级折叠菜单** |
| **薯包对照** | `GallerySection` 已在做这件事，方向对；但首页 hero 下方的主卡是"空白输入框"，新用户不知道从哪开始 |

### 2.8 Canva — 学「零毛玻璃也能做出层次」

**URL**：https://www.canva.com/zh_cn/

| 学什么 | 实测细节 |
|---|---|
| ✅ **最重要的一条：完全没有 `backdrop-filter`** | 实测 Canva 全站 `backdrop-filter` 出现次数 = **0** |
| ✅ **靠表面色阶 + 卡片阴影建立层级** | 侧栏 `#F2F3F5` → 内容区 `#FFFFFF` → 卡片白色 + 阴影 |
| ✅ **大量使用"选中 = 浅紫底 + 紫色描边"** | 与我们规范 §8.3 完全一致 |
| **结论** | **毛玻璃不是高级感的必要条件。** 薯包现状 5 处 `backdrop-filter`（`Navbar.jsx:45`、`App.jsx:63`、`EcMode.jsx:49`、`Popover.jsx` 无、`ui/index.jsx:39`）中，至少 `App.jsx:63`（侧边导航）应当去掉 |

### 2.9 Figma — 学「面板系统的极简层级」

**URL**：https://www.figma.com/

| 学什么 | 实测细节 |
|---|---|
| ✅ **同样零 `backdrop-filter`** | 实测 = 0 |
| ✅ **右侧属性面板的结构** | 分组标题 11px / 600 / `#666` + `8px` marginBottom；分组之间 `16px`；**面板内零卡片、零阴影**——全靠留白分隔 |
| ✅ **分段控件（segmented control）** | 胶囊容器 + 内层滑动指示块；容器 `bg: #EEE`，选中块 `bg: #FFF` + `1px` 描边 + 微阴影 |
| **对薯包的启示** | 这正是我们说"面板内禁止套白卡"的**真实范本**。Figma 的属性面板信息密度是我们的 3 倍，但看起来干净得多——因为它**不画框** |

### 2.10 Linear — 学「键盘优先 + Tooltip 最高层」

**URL**：https://linear.app/method ｜ https://linear.app/docs

| 学什么 | 实测细节 | 薯包怎么用 |
|---|---|---|
| ✅ **8% 又是最高频值** | `rgba(255,255,255,0.08)` 出现 **36 次**（最高频） | 确认 `--sb-surface-tint-strong` 的取值 |
| ✅ **tooltip 层级最高** | 见 §2.11 Vercel 的 z-index 阶梯 | `--sb-z-tooltip: 950` > `--sb-z-toast: 900` |
| ✅ **动效极短** | 状态变化 100–150ms，**没有超过 200ms 的交互** | 与规范 §14 一致 |
| ✅ **键盘优先** | 每个操作都有快捷键；`?` 唤起快捷键面板 | 薯包当前 0 个快捷键。**不是必须**，但 focus-visible 必须补上 |

### 2.11 Vercel Geist — 学「阴影即高度」的权威实现

**URL**：https://vercel.com/geist/materials ｜ https://vercel.com/geist/colors ｜ https://vercel.com/geist/modal ｜ https://vercel.com/geist/typography

| 学什么 | 官方实测细节 |
|---|---|
| ✅ **阴影层数 = 高度等级** | tooltip = 边框 + **2 层**、menu = **3 层**、modal = **4 层**；每层带 `0 0 0 1px #00000014` 兜底描边；**所有投影 alpha ≤ 6%** |
| ✅ **Color 1/2/3 的官方定义** | `Color 1 = 默认底 / Color 2 = Hover 底 / Color 3 = Active 底` —— **hover 与 selected 用不同的色阶，这是官方明文** |
| ✅ **`--ds-overlay-backdrop-opacity: 0.8`** | 遮罩标准值 |
| ✅ **「Don't stack two Materials on the same element」** | 官方原文，直接支持我们的「禁止嵌套毛玻璃」 |
| ✅ **z-index 阶梯** | drawer(200) < modal(300) ≪ menu(2001) < toast(5000) ≪ tooltip(99999) |
| ⚠️ **修正我们的阴影规范** | Geist 的 alpha 全部 ≤6%，而薯包 `--shadow-xl` 用了 `rgba(57,45,26,0.14)`——**偏重**。建议收敛：`--sb-shadow-5` 的第一层 alpha 从 0.16 → **0.10**，靠**层数**而非**浓度**表达高度 |

### 2.12 Notion — 学「内容密度下的阅读舒适度」

**URL**：https://www.notion.com/ ｜ https://www.notion.com/help/category/design

| 学什么 | 实测细节 |
|---|---|
| ✅ **毛玻璃几乎为零** | 只有 `blur(0px)`（等于没有） |
| ✅ **遮罩 `rgba(0,0,0,0.75)`** | 强遮罩，明确"必须处理完才能回去" |
| ✅ **正文行高 1.5，行长 ~70ch** | 与规范 §8.5 一致 |
| **对薯包的启示** | 薯包是工具型产品，信息密度可以参考 Notion 的克制，但**不需要它的编辑态复杂度** |

### 2.13 剪映 CapCut — 学「中文创作者工具的时间轴浮层」

**URL**：https://www.capcut.cn/

| 学什么 | 要点 |
|---|---|
| ✅ **深色界面下的浮层阶梯** | 时间轴（底）→ 素材库（侧）→ 属性面板（侧）→ 弹窗 → toast，层级清晰 |
| ✅ **工具条图标 + 文字的双重标识** | 每个工具图标下有 10px 标签，降低学习成本 |
| ✅ **选中态用"高亮描边 + 亮底"** | 与规范 §8.3 一致 |
| **薯包对照** | `EcCanvas` 是画布型界面，可直接参考剪映的浮层阶梯与工具条规格 |

---

## 3. 明确「不学什么」（Anti-references）

| ❌ 不学 | 谁在用 | 为什么不适合薯包 |
|---|---|---|
| **深色 / 近黑界面** | Midjourney、Runway、Krea（部分） | 薯包是**电商卖家白天在办公室用的生产力工具**，不是创意人的夜间创作台。暖米白底是品牌资产，保留 |
| **冷灰中性色** | Vercel（`#000`/`#fff` 灰度）、Linear | 薯包用**暖灰**（色相 ~30°），冷灰会让暖米白底显脏 |
| **零毛玻璃** | Canva、Figma | 它们的内容区是**不透明画布**，不需要毛玻璃。薯包有**浮在表单之上的参数面板**，毛玻璃在那一处是正确的 |
| **默认组件库主题不覆盖** | 可灵（Element Plus 默认蓝） | 薯包有明确品牌紫，**必须覆盖** |
| **极简到无引导** | Midjourney | 薯包用户是电商运营/卖家，不是 AI 熟手。**必须有步骤指引**（现状的三段式 StepIndicator 方向是对的） |
| **三色渐变到处用** | 无（这是薯包现状问题） | `#7C3AED → #EC4899 → #F59E0B` 彩虹渐变**全站最多 2 处**（首页 hero 标题 + 主 CTA） |
| **嵌套毛玻璃** | Krea（唯一例外） | 性能灾难 + 视觉糊。Vercel 官方明文禁止 |
| **大圆角（≥24px）用在卡片/输入框** | 无 | AI 生成设计的典型特征。卡片上限 12–16px |

---

## 4. 权威规范来源（可直接引用的硬依据）

> 完整版见 `_research/standards.md`（88KB，47 个唯一 URL，13 章）。

### 4.1 WCAG 2.2（W3C 正式推荐标准）

**URL**：https://www.w3.org/TR/WCAG22/ ｜ https://www.w3.org/TR/2024/REC-WCAG22-20241212/

| 条款 | 等级 | 数值 |
|---|---|---|
| **1.4.3** Contrast (Minimum) | AA | 正文 **≥4.5:1**；大号文本（18pt/24px 常规 或 14pt/18.66px 加粗）**≥3:1** |
| **1.4.6** Contrast (Enhanced) | AAA | 正文 **≥7:1** |
| **1.4.11** Non-text Contrast | AA | UI 组件与其状态、理解内容所需图形 **≥3:1** |
| **2.4.7** Focus Visible | AA | 必须有**可见的焦点指示器** |
| **2.4.13** Focus Appearance | AAA | 焦点指示器面积 ≥ **2 CSS 像素粗周长**；对比度 **≥3:1**。⚠️ **周长计算不含 box-shadow 和辉光** → **必须用 `outline`，不能用 `box-shadow` 做焦点环** |
| **2.5.8** Target Size (Minimum) | AA | 指针目标 **≥24×24 CSS px** |
| **2.5.5** Target Size (Enhanced) | AAA | **≥44×44 CSS px** |
| **2.3.3** Animation from Interactions | AAA | 交互触发的运动动画**可被禁用** |

> ⚠️ **这条改变了我方的实现**：焦点环**必须用 `outline`**，不能用 `box-shadow`。（`sb-tokens.css` 的 `.sb-focusable:focus-visible` 已正确使用 `outline`；`--sb-shadow-ring` 保留给"外发光"装饰用途，**不作为焦点指示器**。）

### 4.2 Apple HIG

**URL**：https://developer.apple.com/design/human-interface-guidelines/materials ｜ /layout ｜ /color ｜ /dark-mode ｜ /motion

| 规则 | 要点 |
|---|---|
| **Materials** | 材质用于**建立层级**，必须 **sparingly（节制）**；**禁止用在内容层** |
| **Layout** | 留白用于建立分组和呼吸感 |
| **Color** | 对比度底线 **4.5:1**，**目标 7:1** |
| **Motion** | 动效传达状态，不做装饰 |

### 4.3 Material Design 3

**URL**：https://m3.material.io/styles/elevation/overview ｜ /foundations/interaction/states/state-layers ｜ /styles/shape/corner-radius-scale ｜ /styles/motion/easing-and-duration/tokens-specs

| 规则 | 数值 |
|---|---|
| **Elevation 六档** | 0 / +1 / +3 / +6 / +8 / +12 dp。**静态元素只用 0–+3**；+4/+5 保留给 hover/drag。**hover 固定抬升 1 档** |
| **State layers** | hover **8%** / focus **10%** / press **10%** / drag **16%**。**同一时刻只能叠一个**；颜色取**内容的颜色**（`on-` 色），**不是黑色** |
| **Corner Radius** | 嵌套公式：`inner = outer − padding`（官方示例 48 − 14 = 34）。**禁止内外同值**。padding ≥ outer 时内层取 0 |
| **Motion tokens** | duration：short **50–200ms** / medium **250–400ms** / long **450–600ms** / extra-long **700–1000ms** |
| **Easing** | `standard = cubic-bezier(0.2, 0, 0, 1)`；`emphasized.decelerate = cubic-bezier(0.05, 0.7, 0.1, 1)`。⚠️ **`emphasized` 在 CSS 无实现，官方要求回退 Standard** |

> 📌 **对规范 §14 的修正**：M3 的 `standard` 缓动是 `cubic-bezier(0.2, 0, 0, 1)`，比我们采用的 `(0.22, 1, 0.36, 1)` 更平缓（没有明显的"快速起步"）。**保留 `--sb-ease-out` 不变**（它已是项目现状且在 `EcMode.jsx:39` 使用），但在文档中记录 M3 的 `standard` 作为可选替代。

### 4.4 Radix Colors

**URL**：https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale

**12 阶语义（极其有用的框架）**：

| 阶 | 用途 |
|---|---|
| **1–2** | 背景 |
| **3–5** | 组件背景与状态（3=常态、4=hover、5=active/selected） |
| **6–8** | **三档边框**（6=非交互、7=交互、**8=交互强边框 + 焦点环**） |
| **9–10** | 实色（9=实底、10=hover 实底） |
| **11–12** | 文字（**11 阶保证 APCA Lc 60**、**12 阶 Lc 90**） |

> 📌 **这套 12 阶正好对应我们的需求**：薯包现状的问题是"只有 3 个灰"（`--text-muted`/`--text-hint`/`--text-faint`）却要承担 6 种角色。**`--sb-neutral-*` 的 13 档已经覆盖了 Radix 的 12 阶**，映射见 `10-visual-language.md` §3。

### 4.5 shadcn/ui

**URL**：https://ui.shadcn.com/docs/theming ｜ https://ui.shadcn.com/docs/components/button

**CSS 变量约定**（可作为我们 token 命名的交叉验证）：

```css
--background / --foreground      /* 底 / 字 */
--card / --card-foreground
--popover / --popover-foreground
--primary / --primary-foreground
--secondary / --secondary-foreground
--muted / --muted-foreground
--accent / --accent-foreground
--destructive / --destructive-foreground
--border / --input / --ring
--radius
```

> 📌 **命名对照**：shadcn 的 `--muted-foreground` ≈ 我们的 `--sb-ink-3`；`--ring` ≈ 我们的 `--sb-brand-ring`；`--destructive` ≈ `--sb-danger`。**我们的命名是 shadcn 的超集**，因为它把"ink 层级"和"surface 层级"分开编号，在 5 级表面上比 shadcn 更明确。

### 4.6 阴影与高度体系

**URL**：https://www.joshwcomeau.com/css/designing-shadows/ ｜ https://tobiasahlin.com/blog/layered-smooth-box-shadows/ ｜ https://tailwindcss.com/docs/box-shadow

**核心观点**：
- **分层阴影**（多层小模糊）比单层大模糊更自然 [Josh Comeau]
- 阴影的**模糊半径应随高度增加**，但**alpha 应保持低**（≤6%，Vercel 实测值）
- Tailwind 的 `shadow-sm/md/lg/xl` 只能作为"从小到大"的相对顺序参考，**具体数值需按品牌投影色调校**

### 4.7 毛玻璃（backdrop-filter）

**URL**：https://developer.apple.com/design/human-interface-guidelines/materials ｜ https://web.dev/articles/backdrop-filter

| 纪律 | 说明 |
|---|---|
| ✅ 必须有半透明底 | 在 `transparent` 底上 `backdrop-filter` 无效（即梦实测有 2 处犯此错） |
| ❌ **禁止用在内容层** | Apple HIG 明令 |
| ❌ **禁止嵌套** | Vercel 官方：「Don't stack two Materials on the same element」 |
| ✅ **降级用预模糊图片，而非 polyfill** | 性能考虑 |
| ⚠️ **该元素不得作为其他浮层的定位基准** | 它会创建新的 stacking context + containing block —— **这解释了为什么现状 `Popover.jsx` 用 `position: fixed` 手动定位**（`Popover.jsx:61-65`），做法正确 |

### 4.8 z-index 语义阶梯

> ⚠️ **诚实声明**：**WCAG、Apple HIG、M3、Radix、shadcn 五家全都没有给出 z-index 数值阶梯。**
> `10-visual-language.md` §15 的表格是**工程约定**（以 Vercel Geist 的实测顺序为参考），**不是标准**。
> 它的价值在于"顺序即语义"这条方法论，而不在于具体数字有权威出处。

---

## 5. 一句话行动清单

| 从谁 | 学什么 | 落到薯包的哪个规范 |
|---|---|---|
| **Krea** | hover 与 selected 走**完全不同维度** | `00-principles.md` §4.3 |
| **即梦** | 圆角由外向内递减、内层零阴影、4px 精确内缩 | `10-visual-language.md` §10.1 |
| **Figma** | 面板内**不画框**，靠留白分组 | `00-principles.md` §3.2 |
| **Canva** | 零毛玻璃也能做出层次 | `10-visual-language.md` §12 |
| **Vercel** | 阴影用**层数**编码高度；Color 1/2/3 官方定义 | `10-visual-language.md` §11 |
| **Linear** | 8% 常数值、tooltip 最高层、动效 ≤200ms | `10-visual-language.md` §12.2/§15 |
| **M3** | 嵌套圆角公式、state layer 8/10/10/16% | `00-principles.md` §4.2 |
| **WCAG 2.2** | 焦点环**必须用 outline**（不含 shadow） | `10-visual-language.md` §16 |
| **Radix** | 12 阶语义（6/7/8 三档边框） | `10-visual-language.md` §3 |
| **剪映** | 画布型界面的浮层阶梯 + 工具条规格 | `30-adoption-plan.md` EcCanvas 步骤 |
