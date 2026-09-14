# 设计规范与最佳实践权威来源调研

> 目的：为 `docs/design/` 下的规范文档提供**可引用的权威依据**。每条规则都尽量落到**具体数值**，并标注来源 URL。
>
> **采集方式说明**：本报告的数值全部来自实际抓取的页面正文（Apple HIG、Material 3 为 JS 渲染页，通过 headless Chrome 渲染后提取；WCAG 2.2 为 W3C 正式推荐标准全文）。**读不通或抓取失败的来源已在各节明确标注**，未标注者均为已核实的原文数值。

---

## 目录

1. WCAG 2.2（W3C 正式标准）
2. Apple Human Interface Guidelines
3. Material Design 3
4. Radix Colors
5. Radix Primitives
6. shadcn/ui
7. 阴影与高度体系
8. 嵌套圆角体系
9. 动效体系
10. 毛玻璃（backdrop-filter）的正确用法
11. z-index 语义阶梯
12. 落地检查清单（20 条）
13. 附：来源可访问性总表

---

## 1. WCAG 2.2（W3C 正式标准）

**URL**
- 主文档：https://www.w3.org/TR/WCAG22/
- 本版本（2024-12-12 W3C Recommendation）：https://www.w3.org/TR/2024/REC-WCAG22-20241212/
- 快速参考：https://www.w3.org/WAI/WCAG22/quickref/

**抓取状态**：✅ 全文抓取成功（W3C Recommendation 12 December 2024）。

### 核心可执行规则（带数值）

| 编号 | 名称 | 等级 | 数值 / 规则原文要点 |
|---|---|---|---|
| **1.4.3** | Contrast (Minimum) | AA | 正文与文本图像对比度 **≥ 4.5:1**；**大号文本 ≥ 3:1**。大号文本 = 18pt（24px）常规 / 14pt（18.66px）加粗。非活动组件、纯装饰、logo 无要求 |
| **1.4.6** | Contrast (Enhanced) | AAA | 正文 **≥ 7:1**；大号文本 **≥ 4.5:1** |
| **1.4.11** | Non-text Contrast | AA | 识别**用户界面组件与其状态**所需的视觉信息、以及**理解内容所需的图形部分**，与相邻颜色的对比度 **≥ 3:1**。非活动组件除外 |
| **1.4.12** | Text Spacing | AA | 用户覆盖文本样式后不得丢失内容：行高 ≥ **1.5×** 字号、段后距 ≥ **2×** 字号、字距 ≥ **0.12×** 字号、词距 ≥ **0.16×** 字号 |
| **2.4.7** | Focus Visible | AA | 任何键盘可操作界面必须有**可见的焦点指示器** |
| **2.4.11** | Focus Not Obscured (Minimum) | AA | 组件获得键盘焦点时，**不得被作者创建的内容完全遮挡** |
| **2.4.12** | Focus Not Obscured (Enhanced) | AAA | 焦点组件**任何部分**都不得被作者内容遮挡 |
| **2.4.13** | Focus Appearance | AAA | 焦点指示器需满足：①面积 ≥ **未聚焦组件 2 CSS 像素粗周长的面积**；②聚焦与未聚焦**同一像素**的对比度 **≥ 3:1**。注：周长计算包含内容、边框、组件背景，**不含外阴影和辉光** |
| **2.5.5** | Target Size (Enhanced) | AAA | 指针目标 **≥ 44×44 CSS 像素** |
| **2.5.8** | Target Size (Minimum) | AA | 指针目标 **≥ 24×24 CSS 像素**。例外之一：小于 24×24 的目标，若以各目标包围盒中心画 **24 CSS 像素直径圆**，这些圆**互不相交**即可通过 |
| **2.3.3** | Animation from Interactions | AAA | 交互触发的前庭运动动画**可被禁用**（除非动画是功能必需） |
| **1.4.13** | Content on Hover or Focus | AA | 悬停/聚焦出现的附加内容必须满足 **Dismissible / Hoverable / Persistent** 三条 |

**2.5.8 Target Size (Minimum) 的例外原文**（逐条落地时可直接引用）：

1. **Spacing** — 欠尺寸目标按上述 24px 直径圆规则互不相交；
2. **Equivalent** — 同页存在满足条件的等效控件；
3. **Inline** — 目标位于句子中，或尺寸受非目标文本的 line-height 约束；
4. **User Agent Control / Essential** — 尺寸由 UA 决定，或特定呈现为必需。

### 对「嵌套 surfaces 如何拉开层级」的指导

WCAG **不直接规定**视觉层级手法，但给出了硬边界，这决定了几何等级体系的上限：

- **1.4.11 是关键约束**：如果一个卡片仅靠「背景色差 1 阶」与父表面区分，而这个色差 < 3:1，那么**卡片的边界在 WCAG 意义上不构成可辨识的组件边界**。因此纯 tonal 分层必须配合**边线（border）或阴影**，或确保 tonal 差达到 3:1。
- **1.4.3 约束文字层**：任何 surface 上的文字都必须对**该表面**达到 4.5:1，而不是对根背景。这意味着嵌套层级越深、颜色越偏，文字 token 必须逐层重算 —— 这是「`-foreground` 成对 token」存在的规范理由（见第 6 节）。
- **2.4.11 / 2.4.13 约束浮层**：模态、sticky header、toast **不得完全盖住**获得焦点的元素（AA）；AAA 更进一步，任何部分都不行。落地手段是 `scroll-margin` / `scroll-padding` 或焦点进入时自动滚动。
- **2.4.13 是「焦点环必须比外阴影更实在」的规范依据**：原文明确周长计算「does not include shadow and glow effects」。所以焦点环**不能用 box-shadow 外阴影糊弄**，必须是有实体面积的 outline/border。

### 对「状态层（state layer）覆盖率」的指导

WCAG 没有 state layer 概念，但 **1.4.11** 覆盖了它：

- 状态变化（hover / focus / selected / disabled）若通过**颜色变化**表达，且该颜色是「识别组件状态所需的视觉信息」，则该变化需满足 3:1 的**可辨识度**要求。
- **1.4.1 Use of Color（Level A）**：不得**仅**用颜色传达信息。这意味着状态层颜色变化**必须**辅以非颜色线索（如边框出现、图标切换、位移、形状变化）。
- **推论（行业共识做法）**：Material 的 8%/10%/16% 状态层叠加在深色表面上时，往往**达不到 3:1**。因此规范应规定：**关键状态（focus、selected、error）必须有不依赖状态层透明度的独立视觉指示**，状态层只能作为增强。

### 对 z-index 语义阶梯的指导

WCAG **没有** z-index 规则。唯一相关的是 **1.3.2 Meaningful Sequence（Level A）**（视觉顺序与 DOM 顺序应一致）和 **2.4.3 Focus Order（Level A）**（焦点顺序需保持意义与可操作性）。**z-index 阶梯属于行业共识，见第 11 节。**

### 对我们要抄的作业

- 把 **4.5:1 / 3:1 / 24×24 / 44×44 / 3:1 焦点环** 写进规范，作为**不可协商的硬约束**，而非「建议」。
- 焦点环规范必须包含：**≥ 2px 粗**（对应 2.4.13 的 perimeter 语义）、对**相邻背景** 3:1、且**不依赖 box-shadow**。
- 在色彩 token 章节强制「每个 surface token 必须配对一个已通过对比度校验的 foreground token」，并在 CI 里跑对比度检查脚本。

---
## 2. Apple Human Interface Guidelines

**URL**
- Materials：https://developer.apple.com/design/human-interface-guidelines/materials
- Layout：https://developer.apple.com/design/human-interface-guidelines/layout
- Color：https://developer.apple.com/design/human-interface-guidelines/color
- Dark Mode：https://developer.apple.com/design/human-interface-guidelines/dark-mode
- Motion：https://developer.apple.com/design/human-interface-guidelines/motion
- HIG 总入口：https://developer.apple.com/design/human-interface-guidelines

**抓取状态**：✅ 页面为 JS 渲染，已用 headless Chrome（`--headless=new --dump-dom`）成功渲染并提取正文。⚠️ 注意：直接请求只能拿到「This page requires JavaScript」，`/tutorials/data/...json` 端点全部 404 —— **不要引用该 JSON 端点，它不存在**。

### 核心可执行规则（带数值）

**Materials（材质分层）**

Apple 定义**两类**材质，这是分层的核心骨架：

- **Liquid Glass** —— 「a dynamic material that unifies the design language across Apple platforms, allowing you to present controls and navigation without obscuring underlying content」，构成一个**独立的功能层**，浮于内容层之上。
- **Standard materials** —— 「help with visual differentiation **within the content layer**」。iOS/iPadOS 提供**四档**：`ultraThin`、`thin`、`regular`（默认）、`thick`。

硬规则（原文提炼）：

- **「Don't use Liquid Glass in the content layer.」** —— 内容层内不得使用 Liquid Glass；内容层用 standard materials。
- **「Use Liquid Glass effects sparingly.」** —— 仅用于最重要的功能元素。
- **clear 变体的 dimming layer**：若底层内容**明亮**，在其后加一层 **35% 不透明度的暗色 dimming layer**；若底层已足够暗，则不需要。
- **regular vs clear**：`regular` 模糊并调整亮度以保障文字可读性，用于 **alerts / sidebars / popovers** 等文字量大或背景可能损害可读性的场景；`clear` 高度透明，用于**浮在媒体（照片/视频）之上**的组件。
- **Vibrancy 层级**：labels 有 default / secondary / tertiary / quaternary 四级；fills 有 default / secondary / tertiary 三级；separators 只有一级。**quaternary label 不得用在 thin / ultraThin 材质上**（对比度不足）。
- **材质与文字的关系**：「Thicker materials, which are more opaque, can provide better contrast for text」；「Thinner materials … help people retain their context」。

**Color**

- 「Avoid using the same color to mean different things.」—— 同一颜色不得表达多种含义。
- 「Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information.」—— 与 WCAG 1.4.1 同构。
- 必须为**每种**颜色提供 **light / dark / increased contrast** 变体。
- **「Avoid hard-coding system color values」** —— 系统色值会随版本浮动，必须走 API。
- **「Avoid redefining the semantic meanings of dynamic system colors.」** —— 不得把 separator 色当文字色，不得把 secondary label 色当背景色。
- Liquid Glass 上：「Apply color sparingly」，强调主操作时**给背景上色而非给符号/文字上色**；「Refrain from adding color to the background of multiple controls」。

**Dark Mode**

- **明确数值**：「At a minimum, make sure the contrast ratio between colors is **no lower than 4.5:1**. For custom foreground and background colors, **strive for a contrast ratio of 7:1**, especially in small text.」
- 「Avoid offering an app-specific appearance setting.」—— 不要提供 App 内的明暗切换（应跟随系统）。
- 「the color palette in Dark Mode … **aren't necessarily inversions** of their light counterparts」—— 深色模式**不是**简单反色。
- 「Soften the color of white backgrounds.」—— 纯白背景在深色模式下需略微压暗。
- 必须在 **Increase Contrast + Reduce Transparency 同时开启**的情况下测试。

**Layout**

- 尺寸类：**compact / regular** 两档 × **水平/垂直**两个维度 = 四种组合。
- **「Determine layout based on size classes, not device type or orientation.」** —— 按尺寸类而非设备类型/方向做布局。
- 视觉层级四原则：按重要性排序（阅读顺序：从上到下、从起始边到结束边）；用**对齐**与**缩进**表达层级（「people perceive indented items as subordinate」）；用**负空间/容器形状/分隔线**分组；用**渐进披露**（disclosure triangles、menus、nested views）减少首屏内容。
- **「Differentiate controls from content.」** —— 用材质而非纯色背景把控件与内容分开。
- 支持 Dynamic Type：布局必须能容纳放大后的文字（横向排列可能需要改为纵向堆叠）。

**Motion**

- **「Add motion purposefully」** —— 「Don't add motion for the sake of adding motion.」
- **「Make motion optional.」** —— 「avoid using it as the only way to communicate important information」，需辅以 haptics / audio。
- **「Aim for brevity and precision in feedback animations.」**
- **「In apps, generally avoid adding motion to UI interactions that occur frequently.」** —— 高频交互不加动画。
- **「Let people cancel motion.」** —— 不要让用户必须等动画播完才能操作。

### 对「嵌套 surfaces 如何拉开层级」的指导

Apple 给的是**语义分层**，不是数值分层：

1. **功能层 vs 内容层** 是第一刀。导航/控制类（tab bar、sidebar、toolbar）属于功能层，可用重材质；卡片、区块、画布属于内容层，只能用 standard materials。
2. **内容层内部**再用 standard materials 的四档厚度（ultraThin → thick）做区分。
3. **不要靠「材质看起来是什么颜色」来选** —— 原文：「Avoid selecting a material or effect based on the apparent color it imparts to your interface」，因为系统设置会改变其外观。**按语义用途选，不按观感选。**
4. **控制与内容必须视觉可分离**，但不能靠「在控件下面垫一层实色或半透明背景」—— 原文明确建议改用 scroll edge effect。

### 对「状态层覆盖率」的指导

Apple 不讲 state layer 百分比，而讲**材质 + vibrancy** 的组合：

- 状态表达依赖 **vibrancy 层级**（label default / secondary / tertiary / quaternary）。
- **关键约束**：vibrancy 层级与材质厚度**互相制约**。quaternary 这类低对比层级只能用在厚材质上。
- Liquid Glass 的**联动态**：「the element takes on a Liquid Glass appearance to emphasize its interactivity when a person activates it」—— 即**激活时才升级材质**，这也是一种状态层策略。
- Liquid Glass 会响应系统设置（Reduce Transparency / Increase Contrast）而改变外观，**规范必须允许材质本身随无障碍设置降级**。

### 对 z-index 语义阶梯的指导

Apple **没有**给出 z-index 数值阶梯。但它给出了**层级语义**，可直接映射为 z-index 阶梯（见第 11 节）：

- 功能层（导航/控制）→ 内容层之上
- 临时性浮层（popover、alert、sheet）→ 更高
- scroll edge effect 表达「内容从控件下方滚过」→ 需要严格的前后关系

### 对我们要抄的作业

- **抄「两层骨架」**：功能层（导航/控制）与内容层分离，规范里写死「导航壳层可用重材质/重模糊，内容层内的卡片禁止用 backdrop-filter」。
- **抄「按语义选材质，不按观感选」**这条原则 —— 直接对应我们要建立的 token 语义化命名。
- **抄 35% dimming layer** 这个具体数值，用于 clear 材质浮在亮背景之上的场景。
- **抄 4.5:1 底线 + 7:1 目标** 作为对比度的双阈值（比 WCAG 的 AA 更进取）。
- 深色模式章节必须写明「不是反色」，并强制三态（light / dark / increased-contrast）测试。

---
## 3. Material Design 3

**URL**
- Elevation Overview：https://m3.material.io/styles/elevation/overview
- Applying Elevation：https://m3.material.io/styles/elevation/applying-elevation
- Elevation Tokens：https://m3.material.io/styles/elevation/tokens
- States Overview：https://m3.material.io/foundations/interaction/states/overview
- State Layers：https://m3.material.io/foundations/interaction/states/state-layers
- Applying States：https://m3.material.io/foundations/interaction/states/applying-states
- Shape Overview：https://m3.material.io/styles/shape/overview
- Corner Radius Scale：https://m3.material.io/styles/shape/corner-radius-scale
- Easing & Duration（Tokens & Specs）：https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

**抓取状态**：✅ 全部为 JS 渲染页，已用 headless Chrome 渲染成功。

⚠️ **读不通的 URL**：`https://m3.material.io/styles/shape`、`https://m3.material.io/styles/motion/easing-and-duration`、`https://m3.material.io/foundations/interaction/states` 等**不带子路径**的地址会重定向到需 JS 的壳页或 404 —— 必须使用上表中的完整子路径。

### 核心可执行规则（带数值）

**Elevation（六档）**

> 原文：「Material uses **six levels** of elevation … named for their relative distance above the UI's surface: **0, +1, +2, +3, +4, and +5**. An element's **resting state can be on levels 0 to +3**, while **levels +4 and +5 are reserved for user-interacted states** such as hover and dragged.」

| Level | dp | 归属组件（摘录原文） |
|---|---|---|
| 0 | **0dp** | App bar (not scrolled)、Buttons (filled/tonal/outlined)、Cards (filled/outlined)、Carousel、Chips、Dialog (full-screen)、Icon buttons、List、Navigation rail、Segmented button、Side sheet (docked)、Slider、Split button、Tabs |
| +1 | **1dp** | Banner、Bottom sheet (modal)、Button (elevated)、Card (elevated)、Chips (elevated)、Navigation drawer (modal)、Side sheet (modal) |
| +2 | **3dp** | App bar (scrolled)、Menu、Navigation bar、Rich tooltip、Toolbar |
| +3 | **6dp** | Date pickers、Dialogs (modal)、Extended FAB、FAB、FAB menu (close button)、Search、Time pickers |
| +4 | **8dp** | （不作为 resting level 分配） |
| +5 | **12dp** | （不作为 resting level 分配） |

其他硬规则：

- **「Avoid changing the default elevation of Material 3 components.」** 与 **「Stick to using a small amount of elevation levels.」**
- **hover 抬升规则**：「hovering a FAB temporarily increases the elevation by **1 level**, from level 3 to level 4. **All Material buttons increase elevation by 1 level when hovered.**」
- **M3 与 M2 的关键差异**：**M3 默认用色调（tonal）而非阴影沟通高度**。「Shadows: Instead of applying shadows by default to all levels, use shadows **only when required** to create additional protection against a background or to encourage interaction.」
- **Surface tint color 已废弃**：「Surface tint color is deprecated. Use elevation level tokens (0–5) instead.」
- **Scrim 不透明度 = 32%**（原文：「Scrims use the scrim color role at an **opacity of 32%**.」）。
- **阴影表达距离**：「a shadow that's small and sharp indicates a surface's **close proximity**… Larger, softer shadows express **more distance**.」
- **「When it comes to applying shadows, less is more.」**

**Surface 色调层级（tonal surface levels）**

> 五级 tonal surface 的权威表述在 **Applying Elevation** 页：「You can pick from a range of surface and **surface container** color roles. **These roles are not tied to elevation**, and provide flexibility for defining containment areas. **Any overlapping containment areas or components should have different color roles** in order to visually communicate separation.」

即角色分为：`surface`、`surface-container-lowest`、`surface-container-low`、`surface-container`、`surface-container-high`、`surface-container-highest` —— 这构成 **surface 家族的五级容器阶梯**。

⚠️ **重要澄清**：M3 **明确说明 surface 色角色不与 elevation 绑定**。任何声称「elevation N 必须对应 surface-container-N」的说法**不是 M3 的官方规定**，不要这么写。

**State Layers（状态层覆盖率 —— 本项目最关键的数值）**

> 原文：「A state layer is a **semi-transparent covering** on an element that indicates its state … **only one state layer can be applied at a given time**.」
> 「The state layer is an overlay with a **fixed opacity** for each state and **uses the same color as the content**.」

| 状态 | 不透明度 |
|---|---|
| **Hover** | **+8%（0.08）** |
| **Focus** | **+10%（0.10）** |
| **Press** | **+10%（0.10）** |
| **Drag** | **+16%（0.16）** |
| **Disabled** | **0.38**（对内容的不透明度，用于禁用态内容整体降低不透明度） |

- **尺寸**：「The size of state layers is **40dp** while the interactive target size is **48dp**.」
- **色彩来源**：状态层颜色 = **内容的颜色**（通常是 `on-` 色）。例：容器用 `secondary-container`、内容用 `on-secondary-container`，则状态层是 `on-secondary-container` 的叠加。
- **叠加顺序**：Container (1) → **State layer (2)** → Content (3)。
- **组合**：「States can be combined, such as selection and hover.」
- **disabled 继承规则**：action / selection / input 类组件**继承** disabled；communication / containment / navigation 类**不继承**（App bars、Badges、Dialogs、FAB、Menus、Navigation bar/drawer/rail、Sheets、Tabs、Tooltips）。
- **disabled 不得被 focus/drag/press**，且**不继承 hover 状态层**。
- **hover 与 focus 的继承范围**：同时有「are inherited by / aren't inherited by」两张清单，且都强调 **「The individual components that are actionable within the app bar inherit hover states, not the whole app bar」**（细化到可操作子元素，而非整个容器）。
- **任意时刻只有一个 hover、一个 focus**（「There can only be one hover state at a time in a layout.」）。
- **焦点指示器**：M3 认可 Web 上的 **ring-like keyboard focus indicator**。
- **disabled 的对比度豁免**：「Disabled states **don't need to meet Material's contrast requirements**.」（注意：WCAG 1.4.3 对 inactive component 同样豁免 —— 两者一致）

**Shape / Corner Radius（十档）**

> 原文：「The Material 3 shape system uses a size-based scale with **ten styles**.」

| 样式 | 圆角值 |
|---|---|
| None | **0dp** |
| Extra small | **4dp** |
| Small | **8dp** |
| Medium | **12dp** |
| Large | **16dp** |
| Large increased | **20dp** |
| Extra large | **28dp** |
| Extra large increased | **32dp** |
| Extra extra large | **48dp** |
| Full | **fully rounded**（不再定义为 50%，M3 Expressive 起用 `full`） |

- **M2 → M3 变化**：「M2: Three-level shape scale based on the size of **the component container**」→「M3: **Ten-level** shape scale based on **the roundedness of shape corners**」。
- **非对称圆角**：菜单、split button 等「closely-grouped items」使用 **inner corners**（内角）。
- **cut 家族警告**：「Be careful not to apply large or full corners to information-dense components, such as cards」—— 大圆角会裁切内容。

**Motion：Easing Tokens（CSS 可直接抄）**

> ⚠️ **重要时效性提示**（原文注）：「In the expressive update, components and motion now use the **motion physics system, which uses springs**. Products should migrate to the new system. **The easing and duration system is still used for transitions** and can be used by teams that haven't yet updated to GM3 Expressive, but is **no longer maintained**.」

Emphasized 组（最常用，表达 M3 风格）：

| Token | CSS |
|---|---|
| `md.sys.motion.easing.emphasized` | **N/A**（CSS 无实现，官方要求回退到 Standard） |
| `md.sys.motion.easing.emphasized.decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` |
| `md.sys.motion.easing.emphasized.accelerate` | `cubic-bezier(0.3, 0.0, 0.8, 0.15)` |

Standard 组（简单/小型/工具型过渡）：

| Token | CSS |
|---|---|
| `md.sys.motion.easing.standard` | `cubic-bezier(0.2, 0.0, 0, 1.0)` |
| `md.sys.motion.easing.standard.decelerate` | `cubic-bezier(0, 0, 0, 1)` |
| `md.sys.motion.easing.standard.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` |

**Motion：Duration Tokens**

| 组 | Token | 值 |
|---|---|---|
| Short | `short1` / `short2` / `short3` / `short4` | **50 / 100 / 150 / 200 ms** |
| Medium | `medium1` / `medium2` / `medium3` / `medium4` | **250 / 300 / 350 / 400 ms** |
| Long | `long1` / `long2` / `long3` / `long4` | **450 / 500 / 550 / 600 ms** |
| Extra long | `extra-long1` … `extra-long4` | **700 / 800 / 900 / 1000 ms** |

官方配套示例（可直接引用为规范里的「正确用法」）：

- 「Selection controls have a **short duration of 200ms** with **Standard** easing」
- 「A FAB expanding into a Sheet uses a **400ms** duration with **Emphasized** easing」
- 「A Card expanding to full screen uses a **long 500ms** duration with **Emphasized** easing」
- 「An ambient carousel auto-advance transition uses an **extra long 1000ms** duration with emphasized easing」

### 对「嵌套 surfaces 如何拉开层级」的指导

M3 给的是一套**可执行的判据**：

> 「To successfully depict elevation, a surface must show: **Surface edges** (contrasting the surface from its surroundings); **Overlap** with other surfaces (at rest or in motion); **Distance** from other surfaces.」

即：**一个新表面要成立，必须至少满足「有可辨识的边界」+「与相邻表面有重叠关系」+「体现出距离」。**

三种表达手段（按 M3 优先级）：

1. **Tonal difference** —— **默认手段**。原文：「**By default, Material 3's surfaces use tonal difference to indicate separation.**」
2. **Shadow** —— 「use shadows **only when required**」：背景杂乱/有图案时保护元素；或表达交互抬升。
3. **Scrim** —— 32% 不透明度，用于模态等大型浮层。

**硬约束**：「For interactive components, **edges must create sufficient contrast between surfaces (by meeting or exceeding accessible contrast ratios)** for them to be seen as separate from one another.」→ 这与 WCAG 1.4.11 的 3:1 直接对接。

**「Any overlapping containment areas or components should have different color roles」** —— 这是「嵌套 surfaces 必须换色角色」的官方依据。

### 对「状态层覆盖率」的指导

见上表。三条最关键的落地约束：

1. **同一时刻只能叠加一个状态层**（不得 hover + press 叠两个 8%）。
2. **状态层颜色 = 内容色**，不是固定黑/白。这条直接否定了「统一用 rgba(0,0,0,0.08)」的做法 —— 在深色主题上应该是内容色（通常是浅色）的 8%。
3. **40dp 状态层 vs 48dp 触达目标**：视觉反馈面积可以小于触达区域，两者解耦。这对 Web 实现意义重大（可以用伪元素做 48px 触达区，视觉只呈现 40px）。

### 对 z-index 语义阶梯的指导

M3 **没有** z-index 的数值阶梯。但 **elevation level 0–5 本身就是一套可映射的语义阶梯**，且明确区分了 **resting（0–+3）** 与 **interacted（+4、+5）**。这是本报告第 11 节 z-index 阶梯设计的主要依据。

### 对我们要抄的作业

- **抄六档 elevation + 明确 resting 范围（0–+3）**，并把「hover 抬升 1 档」写死。
- **抄 state layer 的四个百分比（8/10/10/16）**，且明确「用内容色而非黑色」。
- **抄「同一时刻只允许一个状态层」**这条 —— 可直接作为 code review 检查项。
- **抄十档圆角标尺**（0/4/8/12/16/20/28/32/48/full），替换任何自造的 `rounded-md/lg/xl` 无锚点体系。
- **抄标准 easing 的 cubic-bezier 值**（Emphasized 在 CSS 无实现，必须用 Standard 回退 —— 这点务必写进规范，否则前端会自己编一个）。
- **抄 scrim = 32%**。
- **不要抄「surface 角色绑定 elevation」** —— M3 明确否认。

---
## 4. Radix Colors

**URL**
- 总览：https://www.radix-ui.com/colors
- 色阶用法（Understanding the scale）：https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- 全部色阶（含 Alpha / Dark）：https://www.radix-ui.com/colors/docs/palette-composition/scales
- 组织调色板（Composing a palette）：https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette

**抓取状态**：✅ 四个页面均抓取成功。

⚠️ **读不通的 URL**：`/colors/docs/usage`、`/colors/docs/installation`、`/colors/docs/aliasing` 均返回 **404**（该文档站点结构已变更）。不要引用这三个地址。

### 核心可执行规则（带数值）

**12 阶色阶的语义分配（原文表格，逐条）**

| 阶 | 用途 |
|---|---|
| **1** | App background |
| **2** | Subtle background |
| **3** | UI element background |
| **4** | Hovered UI element background |
| **5** | Active / Selected UI element background |
| **6** | Subtle borders and separators |
| **7** | UI element border and focus rings |
| **8** | Hovered UI element border |
| **9** | Solid backgrounds |
| **10** | Hovered solid backgrounds |
| **11** | Low-contrast text |
| **12** | High-contrast text |

分组细则（原文）：

- **1–2（背景）**：可互换。适用：主 App 背景、斑马纹表格背景、代码块背景、**卡片背景**、**侧边栏背景**、画布区背景。深色模式下常用灰阶或彩色阶的 1 或 2 作 App 背景（此时建议用**可变别名** `AppBg` 映射到不同色值）。
- **3–5（组件背景）**：**3 = 常态**；**4 = hover**；**5 = pressed / selected**。「If your component has a **transparent background in its default state, you can use Step 3 for its hover state**.」
- **6–8（边框）**：**6 = 非交互组件**的细边框（sidebar、header、card、alert、separator）；**7 = 交互组件**的细边框；**8 = 交互组件的强边框 + focus rings**。
- **9–10（实色背景）**：**9 是全阶彩度最高的**（最 pure）。用途：站点/App 背景、区块背景、header 背景、组件背景、图形/logo、overlay、**彩色阴影**、强调边框。**10 = 9 作常态时的 hover 色**。多数 9 阶配**白色前景文字**；例外：**Sky、Mint、Lime、Yellow、Amber** 五阶设计为**深色前景文字**。
- **11–12（文字）**：**11 = 低对比文字**；**12 = 高对比文字**。

**对比度承诺（原文数值）**：

> 「Steps **11** and **12** — which are designed for text — are guaranteed to **Lc 60 and Lc 90 APCA contrast ratio** on top of a **step 2 background** from the same scale.」

即：11 阶对同色阶 2 阶背景保证 **APCA Lc 60**，12 阶保证 **APCA Lc 90**。

**Alpha 色阶**

- 每套色阶提供四个变体：**`X`**、**`X Alpha`**、**`X Dark`**、**`X Dark Alpha`**（共 31 套 × 4 = 124 组）。
- **Overlays 系列**（`Black Alpha`、`White Alpha`）**不区分明暗主题**（「don't change across light and dark theme」）。这是做 scrim / overlay / 阴影时唯一应该用的色阶。

**Gray 阶选择**

提供 6 套中性阶：`gray`（纯灰）、`mauve`（紫调）、`slate`（蓝调）、`sage`（绿调）、`olive`（青柠调）、`sand`（黄调）。

- **Neutral pairing**：`gray` 与任何色相都能配。
- **Natural pairing**：选与强调色相最接近的饱和灰，更和谐。
- **警告**：若项目大量使用彩色组件（如 Badge），**深色模式下用饱和灰作 App 背景需谨慎**，彩色组件会与饱和灰背景冲突。

**语义色约定（原文配对建议）**

| 语义 | 推荐色阶 |
|---|---|
| **Error** | `red`, `ruby`, `tomato`, `crimson` |
| **Success** | `green`, `teal`, `jade`, `grass`, `mint` |
| **Warning** | `yellow`, `amber`, `orange` |
| **Info** | `blue`, `indigo`, `sky`, `cyan` |

**重要警告（原文）**：

> 「Radix Colors are **not intended to be customised**. They're designed to be accessible, well-balanced, and harmonious. **Any customisation would likely break these features.**」

如果必须用品牌色，**应新增自定义色阶与 Radix 色阶并存**，而不是改 Radix 的值。

### 对「嵌套 surfaces 如何拉开层级」的指导

Radix 的 12 阶实质是一套**「一个色相内的层级刻度」**，嵌套层级直接映射到阶数：

- 页面底 → **1**（App background）
- 次级区块 / 侧栏 / 卡片 → **2**（Subtle background）
- 组件本体 → **3**
- 组件 hover → **4**
- 组件 selected → **5**

**关键洞察**：Radix 用**同一色相的不同阶**表达层级，而非换色相。这与 Material 的 tonal surface 是同一思路，但 Radix 把它做成了可直接引用的**离散刻度**。

**边界（6/7/8）是层级成立的关键**：Radix 细分了**三种边界强度**（非交互细边框 6 / 交互细边框 7 / 交互强边框 + 焦点环 8）。这直接回应了 WCAG 1.4.11 —— 当背景色差不足以区分时，用 6/7/8 提供可辨识边界。

### 对「状态层覆盖率」的指导

Radix **不用透明度叠加**，而是用**实色阶**表达状态：

- 常态 3 → hover 4 → selected/pressed 5
- 实色按钮：常态 9 → hover 10
- 边框：常态 7 → hover 8

**这个差异很重要**：Radix 的状态是**离散的、预先校验过对比度的实色**，而 Material 的 state layer 是**运行时叠加的半透明层**（其对比度不受控）。对需要严格对比度保证的 Web 项目，**Radix 式实色状态刻度更可靠**。

特例：「If your component has a transparent background in its default state, you can use **Step 3 for its hover state**.」—— 这覆盖了 ghost button / 透明列表项的情况。

### 对 z-index 语义阶梯的指导

Radix Colors **没有** z-index 相关内容。但它提供的 **Overlays（Black Alpha / White Alpha）跨主题不变**这一特性，正是实现「统一的遮罩层级」的基础 —— scrim、modal 背景、drawer 遮罩都应取自此系列。

### 对我们要抄的作业

- **抄完整的 1–12 阶语义表**，把每一阶的**唯一用途**写死，禁止跨阶挪用。
- **抄「边框三档（6/7/8）」** —— 这是很多自造体系缺失的一环，直接决定嵌套层级能否被看清。
- **抄「同色阶 2 阶背景上，11 阶保证 Lc 60、12 阶保证 Lc 90」** 作为文字 token 的对比度依据。
- **抄「Overlays 系列跨主题恒定」** 用于 scrim / overlay。
- **抄「9 阶中 Sky/Mint/Lime/Yellow/Amber 用深色前景，其余用白色前景」** 这条例外清单。
- **抄「不要改 Radix 的值，品牌色另建色阶」** 这条纪律。
- 语义色约定（Error/Success/Warning/Info）直接采用。

---

## 5. Radix Primitives

**URL**
- 介绍：https://www.radix-ui.com/primitives/docs/overview/introduction
- 组合（asChild）：https://www.radix-ui.com/primitives/docs/guides/composition
- 样式指南：https://www.radix-ui.com/primitives/docs/guides/styling
- 无障碍总览：https://www.radix-ui.com/primitives/docs/overview/accessibility
- 版本记录：https://www.radix-ui.com/primitives/docs/overview/releases

**抓取状态**：✅ 全部抓取成功。

### 核心可执行规则（带数值）

**三大设计承诺（原文）**：

1. **Accessible** —— 「Components adhere to the **WAI-ARIA design patterns** where possible. We handle many of the difficult implementation details related to accessibility, including **aria and role attributes, focus management, and keyboard navigation**.」
2. **Unstyled** —— 「Components ship **without styles**, giving you complete control over the look and feel.」
3. **Opened** —— 「Our open component architecture provides you **granular access to each component part**, so you can wrap them and add your own event listeners, props, or refs.」

**受控性**：「Where applicable, components are **uncontrolled by default** but can also be controlled.」

**安装建议**：「We recommend installing the `radix-ui` package and importing the primitives you need. This is the simplest way to get started, **prevent version conflicts or duplication**… The package is **tree-shakeable**.」若分别安装，**「we recommend updating all Radix packages together to prevent duplication of shared dependencies」**。

**`asChild` 组合契约（两条硬性要求）**：

> 「Your component **must spread props**」—— Radix 克隆你的组件时会传入自己的 props 与事件处理器，组件不支持就会 break。
> 「Your component **must forward ref**」—— Radix 有时需要 attach ref（例如测量尺寸）。

**改用非默认元素时的责任**：「If you do decide to change the underlying element type, **it is your responsibility to ensure it remains accessible and functional**.」例如 `Tooltip.Trigger` 若改成 `div` 就不再可访问。

### 对「嵌套 surfaces 如何拉开层级」的指导

Radix Primitives **不涉及视觉层级** —— 它是无样式的原语层。但它给出了**层级所需的机制**：

- **Portal 工具**：「Portal」原语用于把浮层渲染到 DOM 树的其它位置。
- **组合关系**：`Root → Trigger → Portal → Content` 的结构本身就编码了层级语义，且这套结构由 Radix 管理 focus 与 dismissal 行为。

**对规范的意义**：嵌套层级不应通过「调高某个 wrapper 的 z-index」实现，而应通过**使用正确的 Portal + 结构**实现。

### 对「状态层覆盖率」的指导

Radix Primitives 暴露状态的方式是 **data 属性**（如 `data-state`、`data-disabled`、`data-highlighted`），而非内联样式。这意味着：

- 状态样式由**使用方**决定（配合 Tailwind 的 `data-[state=open]:` 等）。
- **规范必须自己定义**：每个 primitive 的每个 `data-state` 对应什么视觉。Radix 提供状态钩子，**不提供状态视觉**。

### 对 z-index 语义阶梯的指导

Radix Primitives **没有** z-index 规则。它通过 **Portal** 让浮层脱离父级 stacking context —— 这实际上**规避**了 z-index 冲突，是比「手写 z-index 阶梯」更稳的架构选择。

### 对我们要抄的作业

- **抄「无样式原语 + 自建视觉」的分工** —— 无障碍行为交给 Radix，视觉规范由我们定义。
- **抄 `asChild` 的两条契约**（spread props + forwardRef）作为组件编写的强制要求。
- **抄「状态用 data 属性表达」**，并据此建立一份 **「primitive × data-state × 视觉 token」的映射表** —— 这是规范里往往缺失、但实现时最需要的部分。
- **抄「用 Portal 而非 z-index 解决浮层层级」** 的架构原则。

---
## 6. shadcn/ui

**URL**
- Theming：https://ui.shadcn.com/docs/theming
- components.json：https://ui.shadcn.com/docs/components-json
- Dark Mode：https://ui.shadcn.com/docs/dark-mode
- Button：https://ui.shadcn.com/docs/components/button
- Dialog：https://ui.shadcn.com/docs/components/dialog

**抓取状态**：✅ 全部抓取成功。

### 核心可执行规则（带数值）

**Token 命名约定（原文）**

> 「We use semantic **background** and **foreground pairs**. The base token controls the **surface color** and the `-foreground` token controls the **text and icon color that sits on that surface**.」
> 「The `background` suffix is **omitted** for the surface token. For example, `primary` pairs with `primary-foreground`.」

**完整 Token 清单（原文表格，逐条）**

| Token | 控制什么 | 用于 |
|---|---|---|
| `background` / `foreground` | 默认 App 背景与文字色 | 页面外壳、页面区块、默认文字 |
| `card` / `card-foreground` | **抬升表面**及其内容 | Card、dashboard 面板、设置面板 |
| `popover` / `popover-foreground` | **浮动表面**及其内容 | Popover、DropdownMenu、ContextMenu 等浮层 |
| `primary` / `primary-foreground` | 高强调操作与品牌表面 | 默认 Button、选中态、badge、激活强调 |
| `secondary` / `secondary-foreground` | 较低强调的填充操作与辅助表面 | Secondary button、secondary badge |
| `muted` / `muted-foreground` | 低强调表面与低强调内容 | 描述文字、placeholder、空状态、辅助文字 |
| `accent` / `accent-foreground` | **交互 hover / focus / active 表面** | Ghost button、菜单高亮、hover 行、选中项 |
| `destructive` | 破坏性操作与错误强调 | 破坏性按钮、无效状态、破坏性菜单项 |
| `border` | 默认边框与分隔线 | Card、菜单、表格、分隔线、布局分割 |
| `input` | 表单控件边框与输入面 | Input、Textarea、Select、outline 风格控件 |
| `ring` | **焦点环与轮廓** | Button、input、checkbox、菜单等可聚焦控件 |
| `chart-1` … `chart-5` | 默认图表调色板 | 图表 |
| `sidebar` / `sidebar-foreground` | 侧栏基面与默认文字 | Sidebar 容器及其内容 |
| `sidebar-primary` / `-foreground` | 侧栏内高强调操作 | 激活项、图标块、badge、侧栏 CTA |
| `sidebar-accent` / `-foreground` | 侧栏内 hover / selected | 侧栏菜单 hover、展开项、交互行 |
| `sidebar-border` | 侧栏专属边框与分隔线 | 侧栏 header、分组、内部分割 |

**Radius token（可直接抄的公式）**

> 「`--radius` is the **base radius token** for your theme. We derive a small radius scale from it so components can use consistent corner sizes while still sharing a **single source of truth**.」

```css
@theme inline {
  --radius-sm:  calc(var(--radius) * 0.6);
  --radius-md:  calc(var(--radius) * 0.8);
  --radius-lg:  var(--radius);
  --radius-xl:  calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}
```

要点：「`radius-lg` is the **base value**」；改 `--radius` 即全站联动。**默认 `--radius: 0.625rem`（= 10px）**。

**默认主题的实际色值（Light，原文摘录）**

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);            /* 纯白 */
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --popover: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

**深色主题（.dark，原文摘录 —— 注意其「抬升表面变亮」策略）**

```css
.dark {
  --background: oklch(0.145 0 0);   /* 最深 */
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);         /* 卡片比背景亮一档 */
  --popover: oklch(0.205 0 0);
  --primary: oklch(0.922 0 0);      /* 明暗主色反转 */
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --border: oklch(1 0 0 / 10%);     /* 边框用白色 10% 而非实色 */
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

**关键观察（可直接写进规范）**：

- **浅色模式**：`background` = `card` = `popover` **都是纯白**（`oklch(1 0 0)`），层级**只能靠 border 和 shadow** 拉开。
- **深色模式**：`background` 0.145 → `card` 0.205 → `secondary/muted/accent` 0.269，**用亮度递增表达抬升**。
- **深色模式下 border 用 `oklch(1 0 0 / 10%)`**（半透明白），而非固定灰色 —— 这样边框能随底层变化。

**Base Colors 选项**：`neutral` | `stone` | `zinc` | `mauve` | `olive` | `mist` | `taupe`。

**初始化策略**：`tailwind.cssVariables: true`（默认，推荐）；`false` 则生成内联 Tailwind 色类。**「This is an installation-time choice」**，且 `style`、`baseColor`、`cssVariables` **初始化后不可更改**（需删除并重装组件）。

**组件 API 形态（Button）**

- 安装：`pnpm dlx shadcn@latest add button`
- **variant**：`default` | `outline` | `secondary` | `ghost` | `destructive` | `link`
- **size**：`xs`（Extra Small）| `sm`（Small）| `default` | `lg`（Large）| `icon`
- **图标间距**：必须加 **`data-icon="inline-start"`** 或 **`data-icon="inline-end"`** 属性，才能获得正确间距。
- **loading 态**：在按钮内渲染 `<Spinner />`，同样需要 `data-icon` 属性。
- **圆角变体**：用 `rounded-full` 类。
- **cursor 行为变更**：「Tailwind v4 switched from `cursor: pointer` to **`cursor: default`** for the button component.」如需恢复 pointer，在 globals.css 添加：

```css
@layer base {
  button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }
}
```

或初始化时加 `--pointer` 标志。

### 对「嵌套 surfaces 如何拉开层级」的指导

shadcn/ui 给出了**最直接可抄的三层结构**：

1. **`background`** —— App 底
2. **`card`** —— 抬升面（elevated surfaces）
3. **`popover`** —— 浮动面（floating surfaces）

再加上 `secondary` / `muted` / `accent` 作为**页内低强调表面**。

**核心机制：background/foreground 成对**。这是应对 WCAG 1.4.3 的架构答案 —— 每个表面自带其经过校验的文字色，嵌套时不需要重新推导。

**规范可抄的原则**：**「一级抬升 = 换一对 token，而不是在现有颜色上叠透明度。」** 叠加透明度会让对比度不可预测。

### 对「状态层覆盖率」的指导

shadcn/ui 用 **`accent`** token 承担全部交互状态：

> 「`accent` / `accent-foreground` —— **Interactive hover, focus, and active surfaces.** Used by: Ghost buttons, menu highlight states, hovered rows, and selected items.」

**关键设计决策**：**hover / focus / active 共用一个 token**，不区分三档。这与 Material 的 8%/10%/10% 三档策略**截然不同**。

- **Material 路线**：细粒度状态层（3 个不同不透明度），表达丰富但对比度不可控。
- **shadcn 路线**：单一 `accent` 表面色，对比度可预先校验，但状态区分度低。

**规范建议**：若采用 shadcn 路线，需额外补 `accent`（hover/selected）与 `ring`（focus）的区分 —— 这正是当前 token 集里 focus 与 hover 的唯一分界。

### 对 z-index 语义阶梯的指导

shadcn/ui **没有** z-index 阶梯文档。但 `popover` 作为独立 token 的存在，暗示了**浮动层需要独立表面语义**。实际的 z-index 管理由 Radix Portal 承担。

### 对我们要抄的作业

- **直接抄整套 token 名称**（`background/foreground`、`card`、`popover`、`primary`、`secondary`、`muted`、`accent`、`destructive`、`border`、`input`、`ring`、`sidebar-*`）—— 这套命名已成为社区事实标准，抄它等于免费获得生态兼容。
- **抄 `-foreground` 成对约定**，并把「每个 surface token 必须配对 foreground」设为硬规则。
- **抄 radius 派生公式**（base × 0.6/0.8/1.0/1.4/1.8/2.2/2.6），用单一 `--radius` 作唯一真源。
- **抄深色模式的「亮度递增表达抬升」**与 **「border 用 `oklch(1 0 0 / 10%)`」**这两个具体做法。
- **抄 `data-icon="inline-start|inline-end"` 的属性约定**，用于图标/加载态的间距控制。
- **抄 `variants` + `size` 的 API 形态**（6 variant × 5 size），作为组件 API 的基线。
- **注意 v4 的 `cursor: default` 变更**，规范里需明确要不要恢复 pointer。

---

## 7. 阴影与高度体系

**URL**
- Josh Comeau, "Designing Beautiful Shadows in CSS"：https://www.joshwcomeau.com/css/designing-shadows/
- Tobias Ahlin, "Smoother & sharper shadows with layered box-shadows"：https://tobiasahlin.com/blog/layered-smooth-box-shadows/
- Tailwind CSS `box-shadow`：https://tailwindcss.com/docs/box-shadow
- Material 3 Applying Elevation（见第 3 节）：https://m3.material.io/styles/elevation/applying-elevation

**抓取状态**：✅ Comeau、Ahlin、Tailwind 三篇均抓取成功。

⚠️ **读不通的 URL**：Josh Comeau 的 **"The Math of Nested Border Radii" 系列文章不存在** —— `/css/perfect-nested-border-radius`、`/css/nested-border-radius` 等路径均返回 **404**，且其博客索引页中查无此文。**不要引用该 URL**。嵌套圆角的权威依据请使用 **Material 3 Corner Radius Scale 的 "optical roundness" 公式**（见第 8 节），这是官方来源。

### 核心可执行规则（带数值）

**Josh Comeau 的三条核心原则**

**1. 统一光源 → 所有阴影共享同一比例（ratio）**

> 「every shadow on the page should **share the same ratio**. This will make it seem like every element is lit from the same light source.」

文章示例的偏移比例：「the resulting shadow has a **4px vertical offset and a 2px horizontal offset**」，即 **水平:垂直 = 2:4 = 1:2**。常用做法：「It's common for that light source to be **above and slightly to the left**.」

**2. 分层（Layering）—— 用多个小阴影替代一个大阴影**

> 「If we layer 5 shadows, our device has to do **5x more work**!」

典型的分层值（原文代码）：

```css
/* 优化后的分层阴影 */
box-shadow:
  0 1px 1px hsl(0deg 0% 0% / 0.075),
  0 2px 2px hsl(0deg 0% 0% / 0.075),
  0 4px 4px hsl(0deg 0% 0% / 0.075),
  0 8px 8px hsl(0deg 0% 0% / 0.075),
  0 16px 16px hsl(0deg 0% 0% / 0.075);
```

**关键结构**：偏移与模糊**同步翻倍**（1/2/4/8/16），不透明度**恒定**。

**3. 色彩匹配（Color-matched shadows）—— 阴影不用纯黑**

> 「A similar effect happens when we use a **darker color** for our shadows」

对比：

```css
/* 原始：中性黑 */
--shadow-color: hsl(0deg 0% 0% / 0.25);
/* 优化：用色相的更暗版本 */
--shadow-color: hsl(220deg 100% 55%);
```

文章示例的完整彩色阴影：

```css
box-shadow:
  1px 2px 2px hsl(220deg 60% 50% / 0.333),
  2px 4px 4px hsl(220deg 60% 50% / 0.333),
  3px 6px 6px hsl(220deg 60% 50% / 0.333);
```

以及 5 层版本（alpha 恒定 0.2）：

```css
box-shadow:
  1px 2px 2px  hsl(220deg 60% 50% / 0.2),
  2px 4px 4px  hsl(220deg 60% 50% / 0.2),
  4px 8px 8px  hsl(220deg 60% 50% / 0.2),
  8px 16px 16px hsl(220deg 60% 50% / 0.2),
  16px 32px 32px hsl(220deg 60% 50% / 0.2);
```

**4. Elevation 是目的，阴影是手段**

> 「**Shadows imply elevation, and bigger shadows imply more elevation.**」
> 「by using different shadows on the header and dialog box, we create the impression that the dialog box is **closer to us**… **We can use elevation as a tool to direct attention.**」

**Tobias Ahlin 的分层阴影方法论**

> 「we can achieve this effect by creating multiple `box-shadow`s … and **increasing the offset and blur for every shadow**」

三种控制维度（原文提供完整代码）：

**(a) 锐利 vs 弥散 —— 通过 alpha 的递增/递减控制**

```css
/* 锐利：内层 alpha 最高，逐层递减 */
.shadow-sharp {
  box-shadow:
    0  1px  1px rgba(0,0,0,0.25),
    0  2px  2px rgba(0,0,0,0.20),
    0  4px  4px rgba(0,0,0,0.15),
    0  8px  8px rgba(0,0,0,0.10),
    0 16px 16px rgba(0,0,0,0.05);
}
/* 弥散：内层 alpha 最低，逐层递增 */
.shadow-diffuse {
  box-shadow:
    0  1px  1px rgba(0,0,0,0.08),
    0  2px  2px rgba(0,0,0,0.12),
    0  4px  4px rgba(0,0,0,0.16),
    0  8px  8px rgba(0,0,0,0.20);
}
```

**(b) 柔和「梦幻」—— 模糊增长快于偏移**

```css
.shadow-dreamy {
  box-shadow:
    0  1px  2px rgba(0,0,0,0.07),
    0  2px  4px rgba(0,0,0,0.07),
    0  4px  8px rgba(0,0,0,0.07),
    0  8px 16px rgba(0,0,0,0.07),
    0 16px 32px rgba(0,0,0,0.07),
    0 32px 64px rgba(0,0,0,0.07);
}
```

**(c) 距离 —— 解耦偏移与模糊**

```css
/* 近距离：偏移与模糊 1:1 */
.shadow-shorter {
  box-shadow:
    0 1px  1px rgba(0,0,0,0.11),
    0 2px  2px rgba(0,0,0,0.11),
    0 4px  4px rgba(0,0,0,0.11),
    0 6px  8px rgba(0,0,0,0.11),
    0 8px 16px rgba(0,0,0,0.11);
}
/* 远距离：偏移大于模糊 */
.shadow-longer {
  box-shadow:
    0  2px  1px rgba(0,0,0,0.09),
    0  4px  2px rgba(0,0,0,0.09),
    0  8px  4px rgba(0,0,0,0.09),
    0 16px  8px rgba(0,0,0,0.09),
    0 32px 16px rgba(0,0,0,0.09);
}
```

**关键比例**：

- 层数增加 → **必须降低每层 alpha** 以维持整体强度（「Note that if you increase the number of layers you'll have to **decrease the alpha value for each layer** if you wish to keep the strength somewhat the same.」）
- 参考值：**4 层 → 15% alpha**；**5 层 → 12%**；**6 层 → 11%**

**Tailwind CSS 的 shadow scale**

Tailwind **v4 使用 `--shadow-*` theme 变量**定义阴影：

```css
@theme {
  --shadow-3xl: 0 35px 35px rgba(0, 0, 0, 0.25);
}
@theme {
  --inset-shadow-md: inset 0 2px 3px rgba(0, 0, 0, 0.25);
}
```

- 工具类命名：`shadow-2xs` | `shadow-xs` | `shadow-sm` | `shadow-md` | `shadow-lg` | `shadow-xl` | `shadow-2xl`（v4 新增 2xs 层级）
- **内阴影**：`inset-shadow-2xs` | `inset-shadow-xs` | `inset-shadow-sm`
- **环（ring）**：`ring-*` 与 `inset-ring-*`（用于焦点环，**独立于 box-shadow**）
- **彩色阴影**：`shadow-indigo-500`、`shadow-cyan-500/50`；默认彩色阴影不透明度为 **100%**，可用修饰符调整
- **重要设计说明（原文）**：「The default box shadow opacities are quite **low (25% or less)**, so increasing the opacity (to like 50%) will make the box shadows more pronounced.」

### 对「嵌套 surfaces 如何拉开层级」的指导

三篇文章指向同一套**阶梯化**方法论：

1. **每一级高度 = 一组完整的阴影参数**（偏移 × 模糊 × alpha × 层数），而非只调一个数字。
2. **相邻级的差异应体现在「距离感」上**：低层级用小偏移 + 小模糊（贴得近），高层级用大偏移 + 大模糊（离得远）。
3. **所有层级共用同一光源比例**（如 1:2 或纯垂直），否则会显得光源不一致。
4. **层级数应少** —— Comeau：「**We can use elevation as a tool to direct attention**」；M3：「**less is more**」；两者一致。

**可执行的建议**：定义 **3–5 级**阴影 token（如 `shadow-subtle` / `shadow-raised` / `shadow-overlay` / `shadow-modal`），每级给完整 `box-shadow` 值，**禁止在组件里手写 box-shadow**。

### 对「状态层覆盖率」的指导

Comeau 的性能警告**直接约束状态层设计**：

> 「Layered shadows are undeniably beautiful, but they do come with a cost. If we layer 5 shadows, our device has to do **5x more work**! This isn't as much of an issue on modern hardware, but it can **slow rendering down on older inexpensive mobile devices**.」

**落地含义**：**hover 态不要新增/切换到多层阴影**（会触发重绘与滤镜开销）。Material 的「hover 抬升 1 级」在 Web 上实现时应谨慎 —— 建议改用**颜色/边框变化**表达 hover，把阴影变化留给真正的结构变化。

### 对 z-index 语义阶梯的指导

**无 z-index 内容**。但阴影层级与 z-index 阶梯应**语义对齐**：`shadow-raised` 对应的 z-index 应低于 `shadow-modal`，否则会出现「看起来在上面、实际被盖住」的矛盾。

### 对我们要抄的作业

- **抄 Comeau 的「统一光源比例」原则**，并在 token 里写死一个比例（如 `0 1px`、`0 2px`、`0 4px` 的垂直递增）。
- **抄「阴影不用纯黑」** —— 用当前主题色相的暗色版，由 CSS 变量 `--shadow-color` 驱动。
- **抄分层阴影的结构**（偏移与模糊同步翻倍、alpha 恒定），这是最易实现且效果最接近原生的做法。
- **抄 Ahlin 的 alpha-层数对照表**（4 层 15% / 5 层 12% / 6 层 11%）作为调参起点。
- **抄 Tailwind 的 `--shadow-*` 变量命名与 `ring` 独立于 `box-shadow`** 的设计。
- **抄性能约束**：明确写「hover/active 状态不得切换多层阴影」。
- ⚠️ **不要引用 "The Math of Nested Border Radii"** —— 该 URL 不存在。

---
## 8. 嵌套圆角体系

**URL**
- **Material 3 Corner Radius Scale（权威来源）**：https://m3.material.io/styles/shape/corner-radius-scale
- Material 3 Shape Overview：https://m3.material.io/styles/shape/overview
- shadcn/ui Radius Scale：https://ui.shadcn.com/docs/theming

**抓取状态**：✅ 抓取成功。

⚠️ **读不通的 URL**：任务描述中提到的 **"The Math of Nested Border Radii" 一文无法找到** —— 其常见 URL（`joshwcomeau.com/css/perfect-nested-border-radius`、`css-tricks.com/using-css-calc-to-perfectly-nest-border-radius`、`smashingmagazine.com/2021/08/nested-border-radius-css`）**全部返回 404**。**请勿引用**。所幸 **Material 3 官方文档给出了同一公式**，权威性更高。

### 核心可执行规则（带数值）

**★ 嵌套圆角公式（Material 3 官方原文）**

> 「When nesting rounded objects, **avoid using the same corner radii for both objects**. This can make the corners look **unbalanced**.
> Instead, adjust the corner radii to be **proportional** to each other; this is called **optical roundness**. To calculate optical roundness:
>
> **Outer radius - padding = inner radius**
>
> For example: **48dp - 14dp = 34dp**」

**Do / Don't（原文明确标注）**：

- ✅ **Do**：「Use different corner radii values for nested components so they have **optical roundness**」
- ❌ **Don't**：「Avoid using the **same corner radius value**」

**Material 3 十档圆角标尺（可作 token 源）**

| 样式 | 值 |
|---|---|
| None | 0dp |
| Extra small | 4dp |
| Small | 8dp |
| Medium | 12dp |
| Large | 16dp |
| Large increased | 20dp |
| Extra large | 28dp |
| Extra large increased | 32dp |
| Extra extra large | 48dp |
| Full | fully rounded |

（完整说明见第 3 节 Shape 部分。）

**shadcn/ui 的 radius 派生体系**

`--radius` 为唯一真源，默认 **0.625rem = 10px**：

```css
--radius-sm:  calc(var(--radius) * 0.6);   /* 6px  */
--radius-md:  calc(var(--radius) * 0.8);   /* 8px  */
--radius-lg:  var(--radius);               /* 10px */
--radius-xl:  calc(var(--radius) * 1.4);   /* 14px */
--radius-2xl: calc(var(--radius) * 1.8);   /* 18px */
--radius-3xl: calc(var(--radius) * 2.2);   /* 22px */
--radius-4xl: calc(var(--radius) * 2.6);   /* 26px */
```

**圆角与信息密度的约束（M3 原文）**：

> 「**Be careful not to apply large or full corners to information-dense components, such as cards**.」
> 「a large cut corner on a card will **clip content and images** in the area more than a rounded corner of the same size.」

即：大圆角会**裁切内容**，信息密集组件必须用小圆角。

**非对称圆角**：

> 「Asymmetrical shapes are used in M3 components with **closely-grouped items**, such as **menus and split buttons**. These are called **inner corners**.」

### 对「嵌套 surfaces 如何拉开层级」的指导

**嵌套圆角是「层级可读性」的几何基础**：

1. **同心原则**：子元素的圆角圆心应与父元素圆角圆心重合 → 因此**内半径 = 外半径 − 内边距**。
2. **反例的视觉后果**（M3 原文）：用相同圆角值会让圆角看起来「**unbalanced**」（不均衡）—— 内层圆角显得**过圆**，视觉上「鼓出来」。
3. **方向性**：padding 越大，内半径越小。若 `padding > outer radius`，公式结果为负 → **内层应取 0（直角）**，负圆角在 CSS 中是非法的。
4. **非对称场景**：若父元素四角圆角不同（如菜单的 inner corner），需对**每个角分别计算**。

**与「surface 分层」的结合**：当卡片嵌套卡片时，外层卡片的圆角、padding、内层卡片圆角三者必须满足公式，否则层级会「塌陷」（看起来像一整块，而非两层）。

### 对「状态层覆盖率」的指导

圆角影响状态层与焦点环的**形状边界**：

- **WCAG 2.4.13** 的焦点指示器面积按「**2 CSS 像素粗的周长**」计算 —— 圆角元素的实际周长**小于**其外接矩形周长，因此**圆角越大，需要的焦点环越粗/越完整**才能满足面积要求。
- **状态层须与容器圆角同形**：Material 的 40dp 圆形状态层不适用于圆角矩形；矩形组件的状态层应用**相同 radius**（或 `border-radius: inherit`）。
- **焦点环的圆角**：`outline` 在现代浏览器中会**自动跟随 `border-radius`**；若用 `box-shadow` 模拟焦点环则需手动设置 `border-radius`，容易出错 —— 这是**优先用 `outline` 而非 `box-shadow` 做焦点环**的又一个理由（与 WCAG 2.4.13 的结论一致）。

### 对 z-index 语义阶梯的指导

**无相关内容。**

### 对我们要抄的作业

- **★ 抄公式：`inner radius = outer radius − padding`**，并在规范里给出**明确的组件配对表**（例如：`--radius-lg` 的卡片、16px padding，则内部元素用 `calc(var(--radius-lg) - 16px)`）。
- **抄「禁止内外同值」这条 Don't**，作为 code review 检查项。
- **抄 M3 的 48 − 14 = 34 作为示例**（这个例子非常有说服力）。
- **抄「padding ≥ outer radius 时内层取 0」** 这个边界规则。
- **抄 shadcn 的 `--radius` 单一真源 + 乘法派生** 架构。
- **抄「信息密集组件禁用大圆角」** 的约束。
- 💡 **建议在 CSS 中实现自动化**，这样嵌套圆角就**不可能写错**：

```css
.card {
  --radius-outer: var(--radius-lg);
  --card-pad: 16px;
  border-radius: var(--radius-outer);
  padding: var(--card-pad);
}
.card > .inner {
  border-radius: max(0px, calc(var(--radius-outer) - var(--card-pad)));
}
```

---

## 9. 动效体系

**URL**
- **Material 3 Easing & Duration (Tokens & Specs)**：https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Material 3 Applying Easing & Duration：https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration
- Apple HIG Motion：https://developer.apple.com/design/human-interface-guidelines/motion
- easing functions cheat sheet：https://easings.net/
- WCAG 2.3.3 Animation from Interactions：https://www.w3.org/TR/WCAG22/#animation-from-interactions

**抓取状态**：✅ M3、Apple HIG、easings.net 均抓取成功。

### 核心可执行规则（带数值）

**Material 3 Easing Tokens（CSS 值，见第 3 节完整表）**

| Token | CSS |
|---|---|
| `emphasized` | **N/A —— 官方要求 CSS 回退到 Standard** |
| `emphasized.decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1.0)` |
| `emphasized.accelerate` | `cubic-bezier(0.3, 0.0, 0.8, 0.15)` |
| `standard` | `cubic-bezier(0.2, 0.0, 0, 1.0)` |
| `standard.decelerate` | `cubic-bezier(0, 0, 0, 1)` |
| `standard.accelerate` | `cubic-bezier(0.3, 0, 1, 1)` |

**Material 3 Duration Tokens**：Short **50/100/150/200ms**；Medium **250/300/350/400ms**；Long **450/500/550/600ms**；Extra-long **700/800/900/1000ms**。

**官方配对示例（可直接作为规范里的「场景 → 时长 + 缓动」查表）**：

| 场景 | 时长 | 缓动 |
|---|---|---|
| 选择控件（selection controls） | **200ms** | Standard |
| FAB 展开为 Sheet | **400ms** | Emphasized |
| Card 展开为全屏 | **500ms** | Emphasized |
| 环境型轮播自动切换 | **1000ms** | Emphasized |

**⚠️ 时效性**：M3 官方注记 —— Expressive 更新后组件动效已转向 **motion physics（springs）**；easing/duration 体系**仍用于 transitions**，但**不再维护**。规范应同时给出 spring 迁移路径。

**Apple HIG Motion（原则，非数值）**

- 「**Add motion purposefully**, supporting the experience without overshadowing it. **Don't add motion for the sake of adding motion.** Gratuitous or excessive animation can distract people and may make them feel disconnected or **physically uncomfortable**.」
- 「**Make motion optional.** … it's essential to **avoid using it as the only way to communicate important information**. … supplement visual feedback by also using alternatives like **haptics and audio**.」
- 「**Aim for brevity and precision** in feedback animations.」
- 「**In apps, generally avoid adding motion to UI interactions that occur frequently.**」
- 「**Let people cancel motion.** As much as possible, don't make people wait for an animation to complete before they can do anything.」
- **游戏帧率参考**：「maintaining a consistent frame rate of **30 to 60 fps** typically results in a smooth, visually appealing experience.」
- **visionOS 特有**：「avoid displaying motion at the **edges of a person's field of view**」—— 周边视觉的运动特别容易引起不适。

**easings.net**

- 该站点是**缓动函数的速查表**，收录标准缓动族：`easeIn/Out/InOut` × `Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back, Elastic, Bounce`（共 30 个函数）。
- 提供每个函数的 **CSS 实现、TypeScript 实现、cubic-bezier 编辑器链接**。
- ⚠️ **抓取局限**：页面上的具体 `cubic-bezier()` 数值由 JS 动态渲染，静态抓取时**未获得完整数值**。**引用时请以「函数名与语义」为准，具体 bezier 值请现场查证**，不要凭空写数。
- 其核心论点（原文）：「Objects in real life don't just start and stop instantly, and almost never move at a constant speed.」
- **实用建议**：`easeIn*` 系列**不应用于**主要过渡（前段过慢）；**进入动画用 easeOut（decelerate），退出动画用 easeIn（accelerate）** —— 这与 Material 的 `emphasized.decelerate` / `emphasized.accelerate` 分工一致。

**WCAG 对动效的硬约束**

- **2.3.3 Animation from Interactions（AAA）**：交互触发的前庭运动动画**可被禁用**。
- **2.2.2 Pause, Stop, Hide（A）**：自动播放、持续 **超过 5 秒**的移动/闪烁内容，必须提供暂停/停止/隐藏机制。
- **2.3.1 Three Flashes or Below Threshold（A）**：任何 1 秒内**闪烁超过 3 次**的内容不合规。

### 对「嵌套 surfaces 如何拉开层级」的指导

动效**本身不建立层级**，但**动效的编排（choreography）表达层级**：

- **M3 的 spring / emphasized 缓动用于「元素从一个表面移动到另一个表面」** —— 移动方向本身传达层级关系（向上 = 提升，向下 = 降级）。
- **Apple visionOS 提示**（M3 Shape 页原文同构）：「Apply motion and shape differently on each **layer** to give it the illusion of depth」—— **每层用不同动效参数**可产生深度错觉。这是「动效表达层级」的直接依据。
- **时序滞后（stagger）**：父/子表面用微小的时间差入场，能强化「包含关系」。

### 对「状态层覆盖率」的指导

- **Material 状态动效**：hover 状态「appear and disappear using a **low-emphasis animated fade**」（原文）—— 即 hover 用**淡入淡出**，不用位移动画。结合 duration tokens，应取 **short 组（50–200ms）**。
- **Apple**：「In apps, generally avoid adding motion to UI interactions that **occur frequently**」—— hover 属于高频交互，**必须极简或零动画**。
- **规范建议**：hover/active 状态变化用 **`transition: background-color 150ms`**（short3）级别；focus 出现应**近乎瞬时**（≤ 100ms），因为键盘用户需要即时反馈。

### 对 z-index 语义阶梯的指导

**无直接内容。** 但浮层的**入场顺序**应遵循 z-index 层级（高层级的浮层后入场），这是可感知的层级线索。

### 对我们要抄的作业

- **直接抄 M3 的 easing cubic-bezier 值**，并**明确标注 `emphasized` 在 CSS 无实现、必须回退 Standard** —— 这一条能防止前端自己编造曲线。
- **直接抄 M3 的四组 duration tokens**（short / medium / long / extra-long），并建立**「场景 → token」映射表**（照抄 M3 的四个官方示例）。
- **抄「进入用 decelerate、退出用 accelerate」** 的分配原则。
- **抄 Apple 的五条原则**（有目的、可关闭、简短精确、高频不加、可取消），这些应写进规范的「设计原则」而非「实现细节」。
- **抄 WCAG 2.3.3 + 2.2.2**：必须实现 `prefers-reduced-motion` 支持；自动播放内容超 5 秒须可暂停。
- **抄「周边视觉避免运动」**（visionOS 经验，对 Web 全屏动效同样适用）。
- **抄 M3 的 motion physics 迁移提示**，为未来切换 spring 预留 token 命名空间。

---
## 10. 毛玻璃（backdrop-filter）的正确用法

**URL**
- **Apple HIG Materials**：https://developer.apple.com/design/human-interface-guidelines/materials
- **web.dev, "Create OS-style backgrounds with backdrop-filter"**：https://web.dev/articles/backdrop-filter
- MDN `backdrop-filter`：https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- Apple HIG Layout（scroll edge effect）：https://developer.apple.com/design/human-interface-guidelines/layout

**抓取状态**：✅ Apple HIG 与 web.dev 抓取成功。

⚠️ **MDN 在本环境不可达**（`developer.mozilla.org` 多次请求均 **ERR_TIMED_OUT**）—— 该 URL 无法验证，引用时请自行核实。

### 核心可执行规则（带数值）

**★ web.dev 的性能警告（原文，最关键的引用）**

> 「**Caution: `backdrop-filter` may harm performance. Test it before deploying.**」

**★ 浏览器支持与降级（原文数值）**

> 「Browser Support: **76 / 79 / 103 / 18**」（Chrome 76、Edge 79、Firefox 103、Safari 18）
> 「**For performance reasons, fall back to an image instead of a polyfill** when `backdrop-filter` isn't supported.」

官方推荐的降级写法：

```css
@supports (backdrop-filter: none) {
  .background { backdrop-filter: blur(10px); }
}
@supports not (backdrop-filter: none) {
  .background { background-image: blurred-hero.png; }
}
```

**★ 必须有的前提条件（原文）**

> 「The overlaying element **must be at least partially transparent**.」
> 「The **overlaying element will get a new stacking context**.」
> 「Without opacity, there would be **nothing to apply blurring to**. It almost goes without saying that if opacity is set to **1 (fully opaque)** there will be **no effect** on the background.」

**★ stacking context 副作用（原文）**

> 「When `backdrop-filter` is set to anything other than `none`, the browser creates a **new stacking context**. A **containing block** may also be created, but only if the element has **absolute and fixed position descendants**.」

**官方数值示例（可直接抄）**

```css
/* 单滤镜：毛玻璃基本式 */
.blur-behind-me {
  background-color: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(.5rem);
}

/* 多滤镜：组合式 */
.brighten-saturate-and-blur-behind-me {
  backdrop-filter: brightness(150%) saturate(150%) blur(1rem);
}

/* 模态：blur 10px + 50% 白底 */
.modal {
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.5);
}
```

支持的滤镜函数：`blur()`、`brightness()`、`contrast()`、`opacity()`、`drop-shadow()`、`url()`。

**Apple HIG 的材质纪律（原文）**

- 「**Don't use Liquid Glass in the content layer.**」
- 「**Use Liquid Glass effects sparingly.** … overusing this material in multiple custom controls can provide a **subpar user experience by distracting from that content**. **Limit these effects to the most important functional elements in your app.**」
- 「**Choose materials and effects based on semantic meaning and recommended usage.** Avoid selecting a material or effect based on the **apparent color** it imparts to your interface.」
- 「**Help ensure legibility by using vibrant colors on top of materials.**」
- clear 变体：底层内容明亮时，加 **35% 不透明度的暗色 dimming layer**。
- **替代方案**：Apple 明确建议「**Instead of applying a solid or semi-opaque background color beneath controls, use a scroll edge effect**」—— 即用渐变遮罩/边缘效果替代整块毛玻璃。

### 对「嵌套 surfaces 如何拉开层级」的指导

**毛玻璃是层级阶梯中的「特殊档位」，不是通用手段**：

1. **它天然属于「浮在内容之上」的层**（Apple 的功能层，或浮在媒体之上的组件）。
2. **它的层级语义是「半透明的前景」**：能看见背景 → 传达「我浮在你之上，但没把你完全遮住」。
3. **不应在内容层内使用**（Apple 明令）。内容层内的层级应用实色 / tonal / 边框 / 阴影。
4. **嵌套禁忌**：**不要在毛玻璃表面上再叠毛玻璃** —— 每层都会：
   - 创建新的 stacking context（作用域嵌套，`position: fixed` 子元素行为异常）
   - 触发额外的合成与模糊开销（成本叠加）
   - 降低文字对比度（多层半透明叠加导致背景不确定，WCAG 1.4.3 无法保证）

**规范建议**：**毛玻璃表面内的子元素必须是实色或不透明**，禁止嵌套 `backdrop-filter`。可用 lint 规则或 code review 强制。

### 对「状态层覆盖率」的指导

- **状态层叠在毛玻璃上会失效**：因为毛玻璃的背景是动态的，8% 的状态层在浅底 vs 深底上效果差异巨大，**无法保证 3:1（WCAG 1.4.11）**。
- **规范建议**：毛玻璃表面上的状态变化**不得依赖低透明度叠加**，应使用：
  - 边框出现 / 加粗
  - 明确的背景色变化（非半透明）
  - 图标 / 文字颜色变化
- **对比度必须按最坏情况校验**：由于背景可变，应对「背景最亮」和「背景最暗」两种情况分别验证 4.5:1。
- **官方提示**：web.dev 明确给出「Text contrast on dynamic backgrounds」的解法 —— 用 `backdrop-filter: invert(1)` 或 `brightness()` **动态维持对比度**，而非假设静态背景。

### 对 z-index 语义阶梯的指导

**backdrop-filter 直接干预 z-index 体系**（关键落地点）：

- 「the browser creates a **new stacking context**」—— 因此 `backdrop-filter` 元素的 z-index **只在自身 stacking context 内有效**。
- 若毛玻璃元素是 `position: fixed` 的后代，还会创建 **containing block**，破坏 `position: fixed` 相对视口的定位假设。
- **规范必须写明**：使用 `backdrop-filter` 的元素**不得作为其他浮层的定位基准**；浮层应通过 Portal 提升到最外层。

### 对我们要抄的作业

- **★ 抄「Caution: may harm performance. Test it before deploying」** 作为规范里的强制要求。
- **★ 抄 `@supports` 降级模式**（`@supports not (backdrop-filter: none)` → 用预模糊图片，**而不是 polyfill**）。
- **★ 抄 Apple 的两条禁止令**：「不要用在内容层」「要节制」，直接写进规范的红线区。
- **抄 `background-color: rgba(255,255,255,0.3)` + `blur(.5rem)`** 这个最小可用组合作为基线。
- **抄模态的 `blur(10px)` + `rgba(255,255,255,0.5)`**。
- **抄 Apple 的 35% dimming layer** 用于亮背景上的 clear 材质。
- **抄 web.dev 的动态对比度方案**（`invert` / `brightness`）应对可变背景。
- **抄「不得嵌套 backdrop-filter」+「不得用 backdrop-filter 元素做定位基准」** 两条硬约束。
- **抄「用 scroll edge effect 替代大面积实色/半透明底」** 的思路。
- **关于「glassmorphism 何时是滥用」的批评文章**：⚠️ 本环境未能抓取到公认的权威批评文章（尝试的多篇均不可达或 404）。**规范中的批评立场应主要引用 Apple HIG 的「sparingly / don't use in content layer」以及 web.dev 的性能 Caution** —— 这两条已足够构成权威依据，无需依赖二手评论。

---

## 11. z-index 语义阶梯

**URL**
- MDN `z-index`：https://developer.mozilla.org/en-US/docs/Web/CSS/z-index ⚠️ **本环境不可达**
- MDN Stacking context：https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context ⚠️ **本环境不可达**
- Radix Primitives Portal：https://www.radix-ui.com/primitives/docs/utilities/portal
- Apple HIG Materials（层级语义）：https://developer.apple.com/design/human-interface-guidelines/materials
- Material 3 Elevation（0–+5 语义档）：https://m3.material.io/styles/elevation/tokens

### 官方说法核查

**结论：本报告调研的所有权威来源中，没有任何一个给出过 z-index 的数值阶梯。**

- **WCAG 2.2**：无 z-index 规则。仅有 1.3.2（意义顺序）与 2.4.3（焦点顺序）间接约束。
- **Apple HIG**：无 z-index。只给层级**语义**（功能层 vs 内容层）。
- **Material 3**：无 z-index。但有**六档 elevation（0–+5）语义阶梯**，且明确区分 resting（0–+3）与 interacted（+4、+5）。
- **Radix / shadcn**：无 z-index 阶梯。Radix 用 **Portal** 从架构上规避该问题。

**因此：z-index 阶梯属于行业共识做法，不应当作标准引用。** 下面的方案是把各家**语义层级**映射为数值，属于**本规范的工程决策**。

### 建议的语义阶梯（基于各家语义映射，标明依据）

| 层级 | z-index | 语义 | 依据 |
|---|---|---|---|
| `base` | **0** | 页面基础内容流 | — |
| `raised` | **10** | 抬升的内容卡片（elevated card，对应 M3 +1） | M3 elevation +1 |
| `sticky` | **20** | 吸顶/吸底导航（对应 M3 +2 scrolled app bar） | M3 elevation +2 |
| `dropdown` | **30** | 下拉菜单、Select、Combobox（M3 Menu = +2） | M3 Menu @ +2 |
| `overlay` | **40** | 遮罩 / scrim（M3 scrim = 32% 不透明度） | M3 scrim |
| `modal` | **50** | 模态对话框、Drawer、Sheet（M3 Dialog = +3） | M3 dialogs @ +3 |
| `popover` | **60** | 浮在模态之上的浮层（Popover 在 Dialog 内） | shadcn `popover` token 独立 |
| `toast` | **70** | 全局通知（必须浮于一切业务浮层之上） | 行业共识 |
| `tooltip` | **80** | 提示（必须浮于触发它的任何元素之上） | WCAG 1.4.13（附加内容可悬停） |

**间距用 10**：为将来插入中间层留出空间，且便于阅读。

### 硬性约束（基于已核实的技术事实）

1. **数值必须集中在单一 token 文件**，禁止在组件里写字面量。
2. **`backdrop-filter` / `transform` / `filter` / `opacity < 1` / `will-change` 都会创建新的 stacking context** —— 在该元素内部，z-index 只在子作用域内比较。这是 web.dev 明确指出的（「the browser creates a new stacking context」）。
3. **浮层优先用 Portal 提升到 body 下**（Radix 的做法），而非提高 z-index 与父级 stacking context 搏斗。
4. **不要用 `z-index: 9999`** 这类魔法数字 —— 一旦出现，说明层级体系已失控。
5. **焦点环的 z-index**：焦点指示器必须在**所有同级内容之上**，否则违反 WCAG 2.4.11（焦点被遮挡）。建议焦点环用 `outline`（自动在最上层），而非需要 z-index 的伪元素。

### 对我们要抄的作业

- **不要声称 z-index 阶梯有权威标准** —— 规范中应明确标注这是**工程约定**。
- **抄 M3 的 `resting(0–+3) / interacted(+4,+5)` 二分**，映射为「静态层级」与「临时浮层层级」。
- **抄 Radix 的 Portal 优先原则** —— 作为 z-index 阶梯的**架构替代方案**，能规避大部分冲突。
- **抄「用 outline 作焦点环」** —— 规避 z-index 问题同时满足 WCAG。
- 把上述表格作为规范的**附录（Engineering Convention）**，而非「标准章节」。

---
## 12. 落地检查清单（20 条）

> 每条都是**可直接审代码**的具体规则。括号内为来源（见上文各节）。

### 颜色与对比度

- [ ] **1.** 所有正文文字对其**所在表面**的对比度 ≥ **4.5:1**；≥ 24px 或 ≥ 18.66px 加粗的大号文字 ≥ **3:1**，禁止对 inactive / 装饰 / logo 之外的内容放宽。（WCAG 1.4.3）
- [ ] **2.** 所有**可交互组件的边界**（边框、图标、状态指示）对其相邻颜色的对比度 ≥ **3:1**；纯靠背景色差区分表面时，色差也必须 ≥ 3:1。（WCAG 1.4.11 / M3「edges must create sufficient contrast」）
- [ ] **3.** 每个 surface token **必须**配对同名 `-foreground` token（`primary` ↔ `primary-foreground`），且配对项已通过对比度校验；代码中不得出现「在 `--card` 上用 `--foreground`」这类跨层取色。（shadcn/ui Theming）
- [ ] **4.** 颜色 token 采用 **Radix 12 阶语义分配**：1–2 背景、3–5 组件背景/状态、6–8 边框、9–10 实色、11–12 文字 —— 禁止跨阶挪用（如用 9 阶当文字色）。（Radix Colors "Understanding the scale"）
- [ ] **5.** 每个颜色必须提供 **light / dark / increased-contrast** 三种变体；深色模式**不是**简单反色，深色模式下抬升表面用**更高的亮度值**表达（如 `oklch(0.145)` → `oklch(0.205)`）。（Apple HIG Dark Mode / shadcn .dark 主题）

### 层级与表面

- [ ] **6.** 嵌套表面的圆角满足 **`inner radius = outer radius − padding`**；padding ≥ outer radius 时内层取 **0**。**禁止内外使用相同圆角值**。（M3 Corner Radius Scale "optical roundness"，例：48 − 14 = 34）
- [ ] **7.** 高度 / elevation 只有 **0–+5 六档**，且静态元素仅用 **0–+3**，**+4/+5 保留给交互态**（hover / drag）；hover 抬升固定为 **+1 档**；组件**不得**自定义 resting elevation。（M3 Elevation Overview / Applying Elevation / Tokens）
- [ ] **8.** 相邻表面必须有**可辨识边界**：要么 tonal 色差达标，要么有 border，要么有 shadow；**禁止**仅靠 < 3:1 的微弱色差区分。（WCAG 1.4.11 / M3「a surface must show: surface edges, overlap, distance」）
- [ ] **9.** 阴影**不得使用纯黑**（`rgba(0,0,0,*)`）；阴影颜色应由 `--shadow-color` 变量驱动、取自当前主题色相的暗色版；所有阴影 token **共享同一光源比例**（如垂直偏移与模糊同步翻倍）。（Comeau "Designing Beautiful Shadows"）
- [ ] **10.** 阴影 token 全局不超过 **4–5 级**；组件内**禁止手写 box-shadow 字面量**，必须引用 token；hover / active 状态**不得切换多层阴影**（性能）。（Comeau 性能警告 / M3「less is more」）

### 状态与交互

- [ ] **11.** 状态层不透明度固定为 **hover 8% / focus 10% / press 10% / drag 16%**；**同一时刻只允许叠加一个状态层**；状态层颜色**取内容的颜色**（`on-` 色），**不得**统一用黑色半透明。（M3 State Layers）
- [ ] **12.** 状态层视觉尺寸与触达尺寸解耦：视觉 **40dp**，触达区域 **48dp**（Web 实现用伪元素扩展触达区，不得改变视觉尺寸）。（M3 State Layers）
- [ ] **13.** 任何**仅靠颜色**表达的状态变化必须辅以非颜色线索（边框、图标、位移、形状）；`disabled` 状态组件不得可聚焦、不得响应 hover。（WCAG 1.4.1 / M3 Applying States）
- [ ] **14.** hover / focus / selected / disabled 四种状态的视觉规则，必须以 **`data-state` 属性选择器**实现（`data-[state=open]:`），并在规范中提供「primitive × data-state × token」完整映射表。（Radix Primitives）

### 焦点与无障碍

- [ ] **15.** 焦点指示器：**≥ 2 CSS 像素粗**、对相邻背景 **≥ 3:1** 对比度、**不依赖 `box-shadow`**（用 `outline`）；其面积 ≥ 未聚焦组件 2px 周长面积。**禁止 `outline: none` 且无替代方案**。（WCAG 2.4.13 / 2.4.7）
- [ ] **16.** 焦点元素**不得被** sticky header、toast、浮层**完全遮挡**；需通过 `scroll-margin` / `scroll-padding` 或滚动策略保证。（WCAG 2.4.11）
- [ ] **17.** 所有指针目标 **≥ 24×24 CSS 像素**（触达区可含伪元素 padding）；若小于 24px，则相邻目标的 24px 直径判定圆**互不相交**；次要操作建议 44×44。（WCAG 2.5.8 / 2.5.5）

### 动效

- [ ] **18.** 过渡时长**只能**取自四组 duration token（short **50–200ms** / medium **250–400ms** / long **450–600ms** / extra-long **700–1000ms**），缓动只能取自 **`standard` `cubic-bezier(0.2,0,0,1)`** 或 **`emphasized.decelerate` `cubic-bezier(0.05,0.7,0.1,1)`** 等已定义曲线；**进入用 decelerate、退出用 accelerate**；高频交互（hover）用 short 组且仅做渐变。（M3 Easing & Duration / Apple HIG Motion）
- [ ] **19.** 必须实现 **`@media (prefers-reduced-motion: reduce)`** 分支（关闭非必要位移动画）；自动播放且持续 **> 5 秒**的动效必须可暂停；任何 1 秒内**闪烁 > 3 次**的内容禁止。（WCAG 2.3.3 / 2.2.2 / 2.3.1）

### 毛玻璃与层级

- [ ] **20.** `backdrop-filter` 使用纪律：① 元素必须有**半透明背景**（`opacity < 1`）否则无效；② **禁止在内容层（卡片、面板内部）使用**，仅限导航壳层与浮于媒体之上的组件；③ **禁止嵌套** backdrop-filter；④ 必须提供 `@supports not (backdrop-filter: none)` 降级（用预模糊图片，**不用 polyfill**）；⑤ 该元素**不得作为其他浮层的定位基准**（它会创建新 stacking context 与 containing block）；⑥ 其上的文字对比度必须按**背景最亮与最暗**两种情况分别验证。（Apple HIG Materials / web.dev backdrop-filter）

---

## 附：来源可访问性总表

| 来源 | URL | 状态 |
|---|---|---|
| WCAG 2.2 全文 | https://www.w3.org/TR/WCAG22/ | ✅ 已抓取 |
| WCAG 2.2 本版本 | https://www.w3.org/TR/2024/REC-WCAG22-20241212/ | ✅ |
| Apple HIG Materials | https://developer.apple.com/design/human-interface-guidelines/materials | ✅（需 JS，已渲染） |
| Apple HIG Layout | https://developer.apple.com/design/human-interface-guidelines/layout | ✅（已渲染） |
| Apple HIG Color | https://developer.apple.com/design/human-interface-guidelines/color | ✅（已渲染） |
| Apple HIG Dark Mode | https://developer.apple.com/design/human-interface-guidelines/dark-mode | ✅（已渲染） |
| Apple HIG Motion | https://developer.apple.com/design/human-interface-guidelines/motion | ✅（已渲染） |
| Apple HIG 总入口 | https://developer.apple.com/design/human-interface-guidelines | ✅ |
| M3 Elevation Overview | https://m3.material.io/styles/elevation/overview | ✅（已渲染） |
| M3 Applying Elevation | https://m3.material.io/styles/elevation/applying-elevation | ✅（已渲染） |
| M3 Elevation Tokens | https://m3.material.io/styles/elevation/tokens | ✅（已渲染） |
| M3 States Overview | https://m3.material.io/foundations/interaction/states/overview | ✅（已渲染） |
| M3 State Layers | https://m3.material.io/foundations/interaction/states/state-layers | ✅（已渲染） |
| M3 Applying States | https://m3.material.io/foundations/interaction/states/applying-states | ✅（已渲染） |
| M3 Shape Overview | https://m3.material.io/styles/shape/overview | ✅（已渲染） |
| M3 Corner Radius Scale | https://m3.material.io/styles/shape/corner-radius-scale | ✅（已渲染） |
| M3 Easing & Duration Tokens | https://m3.material.io/styles/motion/easing-and-duration/tokens-specs | ✅（已渲染） |
| Radix Colors 总览 | https://www.radix-ui.com/colors | ✅ |
| Radix Colors 色阶用法 | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale | ✅ |
| Radix Colors 全部色阶（含 Alpha） | https://www.radix-ui.com/colors/docs/palette-composition/scales | ✅ |
| Radix Colors 组织调色板 | https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette | ✅ |
| Radix Primitives 介绍 | https://www.radix-ui.com/primitives/docs/overview/introduction | ✅ |
| Radix Primitives 组合 | https://www.radix-ui.com/primitives/docs/guides/composition | ✅ |
| shadcn/ui Theming | https://ui.shadcn.com/docs/theming | ✅ |
| shadcn/ui components.json | https://ui.shadcn.com/docs/components-json | ✅ |
| shadcn/ui Dark Mode | https://ui.shadcn.com/docs/dark-mode | ✅ |
| shadcn/ui Button | https://ui.shadcn.com/docs/components/button | ✅ |
| Comeau 阴影文章 | https://www.joshwcomeau.com/css/designing-shadows/ | ✅ |
| Ahlin 分层阴影 | https://tobiasahlin.com/blog/layered-smooth-box-shadows/ | ✅ |
| Tailwind box-shadow | https://tailwindcss.com/docs/box-shadow | ✅ |
| easings.net | https://easings.net/ | ⚠️ 可访问但曲线数值由 JS 渲染，未取到完整数值 |
| web.dev backdrop-filter | https://web.dev/articles/backdrop-filter | ✅ |
| **"The Math of Nested Border Radii"** | （多处候选 URL） | ❌ **404，文章不存在；改用 M3 官方公式** |
| Radix Colors `/docs/usage`、`/docs/installation`、`/docs/aliasing` | — | ❌ **404** |
| Apple `/tutorials/data/.../*.json` | — | ❌ **404，该端点不存在** |
| MDN z-index / Stacking context | https://developer.mozilla.org/... | ❌ **本环境 ERR_TIMED_OUT，无法验证** |
| m3.material.io 无子路径地址 | — | ⚠️ 重定向至 JS 壳页，须用完整子路径 |
| 毛玻璃滥用批评文章 | — | ⚠️ 未找到可引用的权威来源；改用 Apple HIG + web.dev 的官方约束 |

---

*报告完成。所有标注 ✅ 的数值均来自实际渲染/抓取的页面正文；标注 ⚠️ / ❌ 的来源已在正文对应位置说明。*
