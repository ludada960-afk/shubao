# 00 · 设计原则

> **这份文件回答**：为什么这样设计。每条原则都必须有证据（代码行号或外部 URL）。
> **谁该读**：任何要改薯包 UI 的人 / agent，**在动手前**。
> **配套**：`10-visual-language.md`（把原则变成 token）、`20-components.md`（把原则变成组件）。
>
> 证据标记约定：
> - `[证据: 路径:行号]` = 本仓库源码实测
> - `[来源: URL]` = 外部规范 / 调研
> - `[推断]` = 合理推断但未验证，落地前需复核

---

> ## 📌 数据基准说明（**读任何数字前先看这条**）
>
> 本知识库中的所有**实测指标**，权威来源 = **活跃开发树 `.worktrees/codex-ecommerce-stability/`**。
>
> | 指标 | worktree（**权威**） | master（子集，仅供对照） |
> |---|---|---|
> | 源文件 | **316** | 55 |
> | hex 硬编码 | **5789 次 / 1810 个不同值** | 1571 次 / 239 值 |
> | 字号档位 | **27** | 24 |
> | gap 非阶梯值 | **908/1562（58%）** | 175/371（47%） |
> | z-index 裸值 | **32** | 21 |
> | `backdrop-filter` 文件 | **41** | 15 |
> | 悬停位移站点 | **85** | 71 |
> | **`focus-visible`** | **115 处 ✅ 已达标** | 0 处 ❌ |
> | **`prefers-reduced-motion`** | **32 处 ✅ 已达标** | 0 处 ❌ |
> | 品牌紫硬编码 | 159 次 / 150 行 / 38 文件 | 77 处 / 21 文件 |
>
> ⚠️ **两条曾被误判为"P0 缺陷"的项，在活跃树上已经修复**：
> `focus-visible` 与 `prefers-reduced-motion` 在 worktree 上分别有 **115 处**与 **32 处**，**不是缺陷**。
> （早期文档基于 master 得出"全站 0 次"的结论，**对活跃开发树不成立**，已在本节更正。）
>
> 复现：`cd .worktrees/codex-ecommerce-stability && node scripts/design-audit.mjs`


## 0. 先立规矩：本系统要解决的真实问题

### 0.1 现状诊断（全部有据可查）

| # | 问题 | 证据 |
|---|---|---|
| P1 | **两套主色体系在打架** | `design-tokens.css:12-13` 明写「近黑极简，**无彩色主色**」`--accent: #0C0A09`；但 `#7c3aed` 紫硬编码出现 **67 次**，光 `DesignDirection.jsx` 就 15 处 [证据: src/pages/Home/ec/DesignDirection.jsx] |
| P2 | **颜色是碎片** | 全站 **1810 个不同 hex**、5789 次硬编码 [证据: worktree `node scripts/design-audit.mjs` ①] |
| P3 | **字号 27 档** | 实测 12(162次)/11(133)/13(98)/10(61)/14(43)/16(21)/… [证据: `design-audit.mjs` ①] |
| P4 | **圆角 21 档** | 同语义最多 6 档：选项卡 10/10/6/8/8/9999px [证据: `SizingPanel.jsx:237`、`StylePanel.jsx:117`、`ParamsPanel.jsx:75`、`EcPlatformPicker.jsx:117,50`] |
| P5 | **控件高度 12 档** | 26/28/30/32/34/36/38/40/42/44/45/50 px [证据: `audit-panels.md`] |
| P6 | **面板宽度 4 档** | copy=520 / sizing=460 / settings=380 / 其余=420 [证据: `EcMode.jsx:303`] |
| P7 | **键盘可达性部分达标** | ✅ `focus-visible` **115 处**（已达标）；✅ `prefers-reduced-motion` **32 处**（已达标）；⚠️ 仍有 **107 处** `<div onClick>` 伪按钮、**80 处** `outline:none` [证据: worktree `design-audit.mjs` ②] |
| P8 | **状态覆盖大面积缺失** | hover 有 3 种实现并存（内联 JS / CSS class / 完全没有）；loading 只在 2 处有；disabled 多为「视觉禁用但 onClick 仍挂着」[证据: `audit-panels.md` 发现 9] |
| P9 | **同一流程两个相反配色** | `DesignDirection.jsx`（暖白）与 `DesignDirectionView.jsx`（暗色 `#0f0f1a`）是同一个「确认设计方向」流程的两个实现 [证据: `DesignDirectionView.jsx:1-158`] |
| P10 | **z-index 裸值 32 种** | 1/2/3/5/10/50/100/101/200/900/999/1000/1001/9998/9999/10000/10001/10002/10003/99999/999999 [证据: `design-audit.mjs` ①] |
| P13 | **间距过半是手感值** | `gap` 非阶梯值 **908/1562 次（58%）** [证据: worktree `design-audit.mjs` ①] |
| P14 | ~~`prefers-reduced-motion` 缺失~~ | ✅ **worktree 已实现 32 处**，此项已解决（早期基于 master 的 0 处结论作废） |
| P15 | **毛玻璃泛滥** | **41 个文件**使用 `backdrop-filter`（白名单只允许 3 类场景）[证据: `design-audit.mjs` ③] |
| P16 | **悬停位移未预留** | **85 处**位移/放大站点，**20 种**位移值，5 处 >4px 高风险 [证据: `design-audit.mjs` ③c] |
| P11 | **6 个 CSS 变量根本不存在** | `--amber-400`/`--amber-500`（Navbar.jsx:101）、`--shadow-red-lg`（Button.jsx:31）、`--surface-raised`（Footer.jsx:14、Home.css:88）、`--shadow-red`（Home.css:229-230）全站无定义 → 这些样式**当前渲染为无效值** |
| P12 | **Navbar.jsx 是死代码** | `App.jsx:272` 渲染的是内联 `TopBar`，`Navbar.jsx`（208 行，含自己的毛玻璃规格）从未被引用 |

**根因（一句话）**：没有任何一层「共享的视觉词汇表」。每个面板都是一次性手写内联 style，于是同一件事在不同地方长出不同样子。**本文档体系存在的唯一目的，就是建立那层词汇表。**

### 0.2 本系统的定位（写作前提）

- **Register = product（产品型）**，非 brand（品牌型）。依据：`App.jsx` 有 `/pricing`、`/works`、`/ec-canvas` 等真实功能面，用户在这里**完成任务**，不是被说服。产品型的验收标准不是「惊艳」，而是：
  > **熟悉得不需要思考。工具应该消失在任务里。** [来源: impeccable `reference/product.md`]
- 这意味着：**不追求独树一帜的视觉冒险**，追求的是「每一个细微处都对」。产品 UI 的失败模式不是平淡，而是**没有理由的陌生感**——过度装饰的按钮、不匹配的表单控件、无意义的动效、本该是标签却用了展示字体。

### 0.3 品牌基底（不可推翻，必须继承）

| 项 | 取值 | 来源 |
|---|---|---|
| 页面底色 | `#F5EFE4` 暖米白 | `design-tokens.css:6` |
| 品牌色 | 紫 `#7C3AED`（实际使用最多） | 67 次硬编码 [证据: 全站扫描] |
| 强调黑 | `#0C0A09` | `design-tokens.css:13` |
| 排版字体 | system sans + `Fredoka`/`ZCOOL KuaiLe` display | `design-tokens.css:47-49` |
| 面板宽 | 480px | 用户硬约束 |
| 间距阶梯 | 4/8/12/16/20/24 | 用户硬约束 + `design-tokens.css:75-80` |
| 字号阶梯 | 13/700 · 12/600 · 12/400 · 11/400 | 用户硬约束 |
| 控件高 | 32/36/40 | 用户硬约束 |
| 圆角 | 8/12/20 | 用户硬约束 |
| 暖棕投影 | `rgba(57,45,26,·)` | `design-tokens.css:95-99` |

> ⚠️ **P1 是唯一需要人拍板的冲突**：`design-tokens.css` 说「无彩色主色」，但实际代码 67 次用紫。本规范的处理是——**把紫提升为正式品牌色，同时定义「默认必须处于未锁定/中性态」**（见 §6）。理由：紫色已经是事实上的品牌识别（导航、CTA、选中态全在用），推翻它等于否定现有产品人格；而「无彩色主色」的原始意图（*不要到处乱用彩色*）恰恰由 §6 的语义规则来满足。
> **优先级**：若老板决定改回近黑主色，只需替换 `design-tokens-v3.css` §1 的 `--sb-brand-*` 九个值，其余规范全部不变。**这就是 token 化的意义。**

---

## 1. 层级（Hierarchy）：一次只让一个东西说话

### 原则 1.1 — 一屏一个主行动（The One Primary Rule）

任何一个界面区域（页面 / 面板 / 弹窗 / 区块）**最多一个 primary 按钮**。其余全部降级为 secondary 或 ghost。

**证据**：
- 现状首页底部同时存在：紫色渐变「下一步」按钮 + 6 个白色功能按钮 + 产品图红框卡片 + 参考图蓝框卡片。其中**红色边框（`--red`）与蓝色边框（`--blue`）在语义上是「危险 / 信息」色，却被用作两个上传区的身份标识** [证据: `EcMode.jsx:503,594`]。这直接违反语义色规则，导致画面上有 4 种饱和度极高的颜色在抢注意力。
- Material 3 的 color roles 体系规定：一个界面区域只应有一个 `primary` 角色承载主行动，其余使用 `secondary`/`tertiary`/`surface` 变体 [来源: https://m3.material.io/styles/color/roles]

**可执行判据**：
```
在一个 <section> 内，[class*="sb-btn--primary"] 的元素数量必须 ≤ 1
```
违反时的正确修法**不是**「把另一个也改成 primary」，而是问：这两个动作里，哪个是用户此刻真正要做的？

### 原则 1.2 — 主次靠「尺寸 + 权重 + 颜色」三轴，不靠第四种手段

建立主次的允许手段，按强度排序：

| 强度 | 手段 | 示例 |
|---|---|---|
| 最强 | **颜色填充** | primary 按钮实心紫 vs secondary 白底描边 |
| 强 | **尺寸**（同一控件内的字重/字号差） | 面板标题 13/700 vs 副标题 11/400 |
| 中 | **字重**（同尺寸） | 分组标签 12/700 vs 值 12/400 |
| 弱 | **文字颜色**（同尺寸同字重） | 标题 `--sb-ink-1` vs 辅助 `--sb-ink-3` |
| 最弱 | **位置 / 留白** | 靠分组间距分组 |

**禁止**：给一个元素同时上「加粗 + 变色 + 加阴影 + 加边框 + 加图标底」，那是没想清楚重点在哪。

**证据**：现状 `EcMode.jsx:756-814` 的功能按钮在选中时同时改变**边框色 + 背景渐变 + 阴影 + 图标颜色 + 文字字重 + ChevronDown 旋转 + opacity**（7 个属性），而 hover 时又改背景渐变 + transform + boxShadow（3 个属性）。结果是 hover 和 selected 在视觉上难以区分——用户分不清「我鼠标停在这」和「这个面板是开着的」。

### 原则 1.3 — 层级不超过 3 层视觉嵌套

**规则**：页面 → 容器 → 卡片 → **停**。第 4 层不允许再用「表面 + 边框」表达包含关系。

**为什么**：`20-components.md` §卡片 会详述。简版——嵌套卡片是设计上的懒答案（impeccable 明列为 absolute ban：「Nested cards are always wrong」）[来源: impeccable SKILL.md §Absolute bans]。

**现状证据**：`SizingPanel.jsx` 内有 4 层真实 surface 嵌套（玻璃面板 `EcMode.jsx:46-54` → 图片类型行 `SizingPanel.jsx:268` → 勾选框 `SizingPanel.jsx:275` / 输入框 `SizingPanel.jsx:304`），且**每一层都用「白底 + 边框 + 圆角」表达**，而不是用表面色差 [证据: `audit-panels.md` §1.1 嵌套分析]。视觉结果就是老板说的「又丑又 low」——满屏小方框。

**正确做法见 §3。**

---

## 2. 间距与留白（Spacing & Whitespace）

### 原则 2.1 — 用留白分组，用间距表达关系（The Proximity Rule）

**格式塔邻近原则的可执行版本**：
```
组内元素间距  : 组间元素间距 = 1 : 2 或 1 : 2.5
```
即：如果组内用 `--sb-space-2`(8px)，组间必须 ≥ `--sb-space-5`(20px)。

**现状违反**：`SizingPanel.jsx` 的平台 chip 之间 `gap: 5`（行 230），chip 组到下一组「图片类型」标签的距离是 `marginBottom: 16`（行 230）——比值仅 1:3.2 但绝对值都太小（5px vs 16px），分组感很弱。而 `StylePanel.jsx:107` 的分组标签 `marginBottom: 4`，`ParamsPanel.jsx:54` 是 `marginBottom: 10`——**同一个东西四档间距** [证据: `audit-panels.md` 跨面板不一致清单]。

### 原则 2.2 — 间距只用阶梯值

本系统间距阶梯固定为：**4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64**（继承项目既有 4/8/12/16/20/24，向上补齐）。

**禁止**出现 5px / 6px / 10px / 14px / 18px / 22px 这类「手感值」。现状 gap 实测有：8(105次) / 6(71) / 10(47) / 4(39) / 12(29) / **5(23)** / 16(16) / 14(10) / 2(10) / 3(9) [证据: 全站扫描 `gap:`]。其中 6/10/5/14 四个非阶梯值共出现 151 次，占了将近一半。

**为什么这条重要**：间距是唯一一个「用户说不出哪里不对，但一眼能看出廉价」的维度。非阶梯间距的视觉后果是节奏感丧失——眼睛找不到规律。

### 原则 2.3 — 面板内边距 16px，不妥协

面板内容区内边距统一 `--sb-space-4`(16px)。现状实测：`14px 16px 12px`（`SizingPanel.jsx:227`）、`14px 16px`（`GenSettingsPanel.jsx:39`）、`10px 16px`（`SizingPanel.jsx:207`）、`16px 20px 20px`（`EcMode.jsx:492`）。

**准则**：面板宽 480px，两侧 16px 内边距 → 内容宽 448px。这个数字要能整除 2 列（每列 216px + 16px gap），也接近 3 列（每列 139px + 16px gap）。

### 原则 2.4 — 留白不是「剩下多少」，是主动设计

Apple HIG 的 Layout 指引：留白用于**建立分组和呼吸感**，而非填补空间 [来源: https://developer.apple.com/design/human-interface-guidelines/layout]。

**可执行判据**：一个面板滚到底，如果最后一组元素紧贴面板底边（`padding-bottom` < 12px），算违规。

---

## 3. 嵌套表面（Nested Surfaces）：靠"色阶"分层，不靠"画框"

### 原则 3.1 — 五级表面色阶（The Five-Level Surface Rule）

| 级别 | Token | 取值 | 用途 |
|---|---|---|---|
| **L0** | `--sb-surface-page` | `#FAF7F2` | 页面底 |
| **L1** | `--sb-surface-panel` | `rgba(255,255,255,.85)` + 毛玻璃 | 浮层面板 / 抽屉 / 弹窗 |
| **L2** | `--sb-surface-card` | `#FFFFFF` | 卡片（可点的大块） |
| **L3** | `--sb-surface-tint` | `rgba(12,10,9,.03)` | 面板内的「凹陷区」/ 选中行 |
| **L4** | `--sb-surface-sunken` | `#EFEAE1` | 输入框凹槽 |

**核心规则**：**相邻两级必须至少差一档；跨级嵌套禁止。**

### 原则 3.2 — 面板内禁止再套白卡（The No-White-Card-Inside-Panel Rule）

> **浮层面板（L1，半透明白）内部，禁止直接放白色卡片（L2）。**

**为什么**：L1 是 `rgba(255,255,255,0.85)` 叠在 L0 暖米白上，实际观感已接近白。再放 `#FFFFFF` 卡片，两者色差 **≈0**，中间那条 1px 边框就成了唯一的分界——于是整个面板看起来像**一堆小方框拼起来的表格**。这正是「又丑又 low」的视觉来源。

**正确做法**：面板内分组用 **留白 + 分组标题** 分区，而不是套卡片：

```
╔══════════════════════════════════════════╗  ← L1 面板 rgba(255,255,255,.85) r20
║  生图设置                         [×]    ║
║  ─────────────────────────────────────  ║  ← border-subtle
║                                          ║
║  分辨率                                  ║  ← 11/700 ink-3（分组标题）
║  ┌──────────────┐  ┌──────────────┐     ║
║  │ 1:1  1024×1024│  │ 3:2  1536×1024│    ║  ← 选项卡：L3 tint 底，无边框
║  │  正方形·主图  │  │  横版·场景图  │    ║     选中时才加 brand 描边
║  └──────────────┘  └──────────────┘     ║
║                                          ║  ← 20px 组间距（留白分区）
║  出图品质                                ║
║  ┌──────────────┐  ┌──────────────┐     ║
║  │ 标准 ·快预览  │  │ 高清 ·最终出图│    ║
║  └──────────────┘  └──────────────┘     ║
║                                          ║
║  ─────────────────────────────────────  ║
║                    [ 应用设置 ]          ║  ← 唯一 primary
╚══════════════════════════════════════════╝
```

对照现状 `GenSettingsPanel.jsx:17-21`：`cardBase` 用了 `background: '#fff'` + `border: '1.5px solid rgba(0,0,0,0.08)'` + `borderRadius: 10`——**白卡 + 半透明黑边框，套在半透明白面板里**。改成「L3 tint 底 + 无边框」，同样的信息量，视觉噪音降一个数量级。

### 原则 3.3 — 用色差分层时，边框要么不画，要么画足

**两种合法的分层方式，二选一：**

| 方式 | 做法 | 何时用 |
|---|---|---|
| **A. 色差** | 相邻表面明度差 ≥ 2.5%（≈ 相邻 neutral 档位），**不画边框** | 面板内分组、大面积区块 |
| **B. 描边** | 表面色相同，用 `--sb-border-default` 1px 全周描边 | 需要明确「这是可交互控件」时 |

**禁止 C：色差微弱 + 边框微弱** —— 现状 `GenSettingsPanel.jsx:18` 就是这种：`#fff` 卡片 + `rgba(0,0,0,0.08)` 边框，同时又有 L1 的 `rgba(255,255,255,0.85)` 底，三层几乎同色。**这是最典型的 "低质量感" 配方。**

> ⚠️ 同时禁止 **impeccable 点名的 "ghost-card" 反模式**：`border: 1px solid X` + `box-shadow: 0 Npx Mpx`（M ≥ 16px）同时出现在一个元素上 [来源: impeccable SKILL.md §Codex-specific defects]。
> 现状违反：`Popover.jsx:69-70`（border 1px + shadow 46px 模糊）、`EcMode.jsx:51-52`（border 1px + shadow 48px 模糊）、`cards` 组件 `ui/index.jsx:14-18`（border + shadow-lg）。

### 原则 3.4 — 嵌套圆角公式

**内层半径 = 外层半径 − 内边距**

| 外层半径 | 内边距 | 内层半径 |
|---|---|---|
| 20px（面板） | 8px | **12px** |
| 20px（面板） | 4px | **16px** |
| 16px（卡片） | 6px | **10px ≈ 8px** |
| 12px（选项卡） | 4px | **8px** |

**现状违反**：`SizingPanel.jsx` 面板 r20（`EcMode.jsx:47`），内层图片类型行 r10（行 268，padding 8px 10px → 应 r12），勾选框 r6（行 275），输入框 r6（行 304），下拉触发器 r7（行 65）——**面板内 4 个内层圆角各不相同（10/6/6/7），且都不符合公式**。

**记忆锚点**：面板 20 → 内层 12 → 更内层 8 → 微件 6/4。只有这 4 档。

---

## 4. 状态（States）：八个状态，一个都不能少

### 原则 4.1 — 八态全覆盖（The Eight States Rule）

**每一个可交互元素，必须定义以下八个状态。少一个就是没做完。**

| # | 状态 | 何时 | 视觉处理 |
|---|---|---|---|
| 1 | **Default** | 静止 | 基础样式 |
| 2 | **Hover** | 指针悬停（**非触屏**） | 表面色微变（≤1 档），或边框微变；**不动布局** |
| 3 | **Focus** | 键盘 / 程序聚焦 | `--sb-focus-ring` 2px 外扩环，offset 2px |
| 4 | **Active** | 正被按下 | 表面压深 1 档 + 缩小到 0.98（**或** translateY(1px)，二选一） |
| 5 | **Selected** | 当前选中项 | **brand 描边 + brand 浅底**（见 §6.3） |
| 6 | **Disabled** | 不可交互 | `--sb-ink-5` 文字 + L3 tint 底 + `cursor: not-allowed`；**且必须真的挂 `disabled` 属性** |
| 7 | **Loading** | 处理中 | 按钮内 spinner，**按钮宽度不变**（防止布局跳动） |
| 8 | **Error** | 校验失败 | `--sb-danger` 描边 + 下方 `--sb-danger` 说明文字（带 `aria-describedby`） |

[来源: impeccable `reference/interaction-design.md` §The Eight Interactive States；Material 3 States https://m3.material.io/foundations/interaction/states]

### 原则 4.2 — Hover 和 Focus 是两件事

> **常见失误**：设计了 hover 但没设计 focus。键盘用户永远看不到 hover 状态。

[来源: impeccable `reference/interaction-design.md`]

**硬性要求**：
```css
/* ❌ 现状：大量 outline: 'none'（10+ 处，见 audit-panels.md） */
outline: none;

/* ✅ 正确：只对键盘用户隐藏鼠标态，键盘态必须可见 */
.x:focus { outline: none; }
.x:focus-visible {
  outline: 2px solid var(--sb-brand-500);
  outline-offset: 2px;
}
```

**现状**：`focus-visible` 在 11 个面板文件中出现 **0 次** [证据: `audit-panels.md` 发现 2]。这是 P0 级无障碍缺陷（违反 WCAG 2.4.7 Focus Visible，AA 级）。

### 原则 4.3 — Hover **只做一件事**，Selected 做另一件事（关键差异化）

> **这是老板明确点出的问题：「懂选中态有不同交互」。**

**规则**：hover 和 selected 必须使用**不同的视觉通道**，让用户一眼能分。

| 状态 | 允许改变的属性 | 禁止改变的属性 |
|---|---|---|
| **Hover** | ① 表面色（≤1 档）② 边框色（变深）③ 可选的 translateY(-1px) | ❌ 文字颜色（不要变紫）❌ 字重 ❌ 阴影（除非 item 本身是卡片）❌ 不可改变尺寸 |
| **Selected** | ① **brand 描边 1.5px** ② **brand 浅底** ③ 文字/图标变 brand ④ **持久**（不随鼠标移开消失） | ❌ 不要用纯色实底（除非是 pill）❌ 不要同时加阴影 + 描边 + 变色（选 2 个） |

**现状违反**：`EcMode.jsx:775-792` 功能按钮的 hover 状态用了「紫色渐变背景 + translateY(-1px) + 紫色阴影」，而 selected 状态（行 763-773）也用了「紫色渐变背景 + 紫色阴影」——**两者视觉几乎相同**。用户无法判断面板是否打开。

**正确实现**（`20-components.md` 的 chip / option-card 都用这个）：
```css
/* hover: 只动背景，中性 */
.sb-option:hover:not([aria-selected="true"]):not(:disabled) {
  background: var(--sb-surface-tint-strong);   /* 中性灰，不是紫色 */
}
/* selected: brand 描边 + brand 浅底 + 文字变品牌色，持久 */
.sb-option[aria-selected="true"] {
  background: var(--sb-brand-soft);
  border-color: var(--sb-brand);
  color: var(--sb-ink-brand);
}
.sb-option[aria-selected="true"] .sb-option__icon { color: var(--sb-brand); }
```

**关键**：hover 用**中性灰**，selected 用**品牌紫**。这样即使两者同时存在（鼠标停在已选中项上），也不冲突。

### 原则 4.4 — Loading 不能让布局跳动

按钮进入 loading 时，宽度必须保持不变。做法：用 `visibility: hidden` 保留原 label 占位，spinner 绝对定位覆盖。

**现状**：`DesignDirection.jsx:481-482` 的 spinner 会替换文字内容，导致按钮宽度跳变 [证据: `audit-panels.md` 发现 9]。

### 原则 4.6 — 位移必须在容器内预留空间（The Lift Reservation Rule）

> **规则**：任何在 hover / selected / active 时产生**位移或放大**的卡片或按钮，其**父容器必须为位移预留空间**，且四个极端位置（首行/首列/末行/末列）**不得被滚动容器或裁剪容器切断**。

**需求预留量**：

```
R = |translateY| + 放大外扩
放大外扩 E = (W−1)×(scale−1)/2 + (H−1)×(scale−1)/2
安全余量 = R × 1.5
```

**实测规模**：全站 **71 处** hover 位移/放大站点，位移值多达 **18 种**（`-1px` 25 处、`-2px` 14 处、`-3px` 7 处、`-8px` 3 处、`scale(1.02–1.4)` 14 处）。

**⚠️ 关键技术真相**（`canvas-library.css:168-174` 实测）：
> `overflow: auto` 的裁剪矩形是 **padding box**，而内容也**从 padding box 的边开始**——padding 只会把裁剪边界和内容**一起下移**，两者永远重合。
>
> | 方向 | padding 是否有效 | 原因 |
> |---|---|---|
> | **纵向** | ❌ **无效** | 内容流跟随 padding box |
> | **横向** | ✅ 有效 | 内容宽度由 `1fr` 决定，不随 padding 变 |

**正确解法**：
- **纵向** → 插入 `::before` / `::after` **真实占位**（跨列空行），把内容流整体下推
- **横向** → `padding-inline` 扩宽可绘区 + 等量负 `margin-inline` 保持内容边界

**推荐同时降低位移量**：`translateY(-8px)` 的预留成本（16px）远大于视觉收益，大卡片统一降到 `-4px`，预留降到 9px。

> 详细规范与可照抄实现见 `10-visual-language.md` §2I 与 `20-components.md` §0.6。

### 原则 4.5 — Disabled 必须真禁用

**反模式**：`opacity: 0.4` + `pointerEvents: 'none'`，但 `onClick` 仍挂着。
- 键盘 `Enter`/`Space` **仍然会触发**（pointerEvents 不管键盘）
- 屏幕阅读器**仍然报为可操作**

**现状违反**：`SkuPanel.jsx:122-123`、`DesignDirection.jsx:447` [证据: `audit-panels.md` 发现 9]。

**正确**：`<button disabled>`；非按钮元素用 `aria-disabled="true"` + 事件处理里 early return。

---

## 5. 可访问性（Accessibility）

### 原则 5.1 — 对比度硬门槛

| 文本类型 | 最低对比度 | WCAG |
|---|---|---|
| 正文（< 18.66px / < 14px bold） | **4.5:1** | 1.4.3 AA |
| 大文本（≥ 18.66px 或 ≥ 14px **粗体**） | **3:1** | 1.4.3 AA |
| **placeholder** | **4.5:1**（同正文，不是"次要"就放宽） | 1.4.3 AA |
| 非文本（图标、边框、图表） | **3:1** | 1.4.11 AA |
| 焦点指示器 | **3:1**（与相邻色） | 1.4.11 AA |

[来源: https://www.w3.org/TR/WCAG22/#contrast-minimum, https://www.w3.org/TR/WCAG22/#non-text-contrast]

**本系统实测值**（WCAG 2.x 相对亮度公式计算，在 `#FFFFFF` / `#F5EFE4` / `#FDFAF4`（面板近似色）三种底上）：

| Token | 色值 | on #FFF | on #F5EFE4 | on 面板 | 判定 |
|---|---|---|---|---|---|
| `--sb-ink-1` | `#1A1614` | 17.97 | 15.70 | 17.25 | ✅ 正文级 |
| `--sb-ink-2` | `#3D3835` | 11.57 | 10.11 | 11.10 | ✅ 正文级 |
| `--sb-ink-3` | `#6B6560` | 5.74 | 5.02 | 5.51 | ✅ 正文级（**placeholder 也应使用此色**） |
| `--sb-ink-4` | `#9A9490` | **2.99** | **2.62** | 2.87 | ❌ **不满足 4.5:1**，仅可用于大号图标 / ≥14px 粗体 |
| `--sb-ink-5` | `#B0AAA5` | **2.30** | 2.01 | 2.21 | ❌ **仅限 disabled** |
| `--sb-ink-brand` | `#7C3AED` | 5.70 | 4.98 | 5.47 | ✅ 正文可用 |
| `--sb-ink-danger` | `#D0443C` | 4.59 | **4.01** | 4.41 | ⚠️ 白底 ✅；**暖米白底不达标**，暖底上需用更深值 |
| `--sb-ink-success` | `#2F7D46` | 5.07 | 4.43 | 4.87 | ⚠️ 白底 ✅；暖底 4.43 略欠 |
| `--sb-ink-warning` | `#B45309` | 5.02 | 4.39 | 4.82 | ⚠️ 同上 |
| `--sb-ink-info` | `#3B5BA5` | 6.51 | 5.69 | 6.25 | ✅ |

**实色（solid）变体绝不能用于文字**：

| Token | 色值 | on #FFF | 判定 |
|---|---|---|---|
| `--sb-success` | `#5CA86C` | **2.89** | ❌ 文字不可用 |
| `--sb-danger` | `#E8544B` | **3.62** | ❌ 文字不可用 |
| `--sb-warning` | `#E08A2E` | **2.68** | ❌ 文字不可用 |
| `--sb-info` | `#5275CC` | 4.40 | ⚠️ 勉强，仍应用 `--sb-ink-info` |

> ⚠️ **三条实测发现的真实违规**：
> 1. `--sb-ink-4`(`#9A9490`) 在 12px 正文上仅 **2.99:1**，**不满足 4.5:1**。而现状代码里 `var(--text-hint)` 被用在提示文字上（`EcMode.jsx:567` 的 `#999`，实测 **2.85:1**）。
>    **修法**：12px 及以下的正文/提示**一律用 `--sb-ink-3`(`#6B6560`, 5.74:1)**。`--sb-ink-4` 只留给「大号图标」或「≥14px 粗体」。
> 2. **语义色的 solid 变体全部不能做文字**（2.68–3.62:1）。必须用 `--sb-ink-*` 变体。
> 3. **暖米白底(`#F5EFE4`)会拉低对比度约 0.5–0.9**。`--sb-ink-danger` 在白底 4.59 ✅，在暖底 4.01 ❌。**在 `--bg` 上直接放状态色文字是危险的**——要么加深颜色，要么给文字加中性底。
>
> **通用陷阱**：impeccable 明确指出——「最常见的失败是**在带色调的近白底上放灰色正文**。为了"优雅"用浅灰，是 AI 设计读起来费劲的头号原因。」[来源: impeccable SKILL.md §Color]
>
> 📐 **复算方法**（审代码时可自查）：WCAG 相对亮度 `L = 0.2126R + 0.7152G + 0.0722B`（R/G/B 经 sRGB 线性化），对比度 `= (L1+0.05)/(L2+0.05)`。

### 原则 5.2 — 触控目标 ≥ 44×44px

WCAG 2.5.8 Target Size (Minimum) 的 AA 要求是 24×24px [来源: https://www.w3.org/TR/WCAG22/#target-size-minimum]。**本系统取更严的 44×44px**（Apple HIG 与 Material 的推荐值），因为电商用户大量在手机上操作。

**允许的例外**：内联文本链接、以及「等价控件在附近存在」的情况（WCAG 2.5.8 的 exception）。

**现状违反**（面板内普遍偏小）：
- `SizingPanel.jsx:275` 勾选框 20×20
- `SizingPanel.jsx:304` 数量输入 38×26
- `SizingPanel.jsx:65` RatioSelect 触发器 高 26
- `EcMode.jsx:534` 图片删除按钮 18×18

### 原则 5.3 — 键盘可达与语义 HTML

**规则**：
1. 可点击的东西用 `<button>`，不是 `<div onClick>`。现状 80+ 处违反 [证据: `audit-panels.md` 发现 2]。
2. 一组选项（tab / 分段控件 / 单选组）用 `role="tablist"` + `role="tab"`，或 `role="radiogroup"` + `role="radio"`，配合 **roving tabindex**（只有当前项 `tabindex="0"`，其余 `-1`，方向键移动）[来源: impeccable `reference/interaction-design.md` §Roving Tabindex]。
3. 弹窗用原生 `<dialog>` + `showModal()`，或用 `inert` 属性锁背景——**不要手写 focus trap** [来源: https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal]。
4. 非模态浮层（下拉、tooltip）用 **Popover API**（`popover` 属性）——它自动进 top layer，免疫 `overflow: hidden` 裁剪，天然 light-dismiss [来源: https://developer.mozilla.org/en-US/docs/Web/API/Popover_API]。
5. 装饰性图标加 `aria-hidden="true"`；纯图标按钮必须有 `aria-label`。

### 原则 5.4 — 减少动效不是可选项

每一处动画都必须有 `@media (prefers-reduced-motion: reduce)` 的替代（通常是瞬时切换或纯交叉淡入）。[来源: impeccable SKILL.md §Motion]

已在 `design-tokens-v3.css` §17 统一实现。

---

## 6. 色彩语义（Color Semantics）：什么时候用彩色字

### 原则 6.1 — 彩色字的三个合法场合（The Three-Color-Text Rule）

> **这是「懂不同的地方用什么颜色的字」的可执行版本。**

**只有以下三种情况允许文字使用彩色。其余一律中性色（ink-1 ~ ink-4）。**

| # | 场合 | 用什么色 | 示例 |
|---|---|---|---|
| **1** | **品牌动作 / 当前选中** | `--sb-ink-brand` 紫 | 「已选中的模型名」「当前 tab」「链接」 |
| **2** | **状态语义**（成功/警告/危险/信息） | `--sb-ink-success/warning/danger/info` | 「生成失败」「余额不足」「已保存」 |
| **3** | **关键数据高亮**（用户最关心的那个数字） | `--sb-ink-brand` 或 `--sb-ink-1` | 「共 **12** 张图片」里的 12 |

**明确禁止**：
- ❌ 用彩色字做**装饰**（比如「套图配置」这个标签本身染成紫色）
- ❌ 用彩色字表达**普通层级**（次要文字用浅灰 = 对比度不足；应该用不同深浅的**中性**色）
- ❌ 同一个屏幕上出现 **>3 种**彩色文字

**现状违反**：
- `SizingPanel.jsx:220` 「已自定义配置 · 基于智能推荐修改」整条横幅文字染紫 `#7c3aed`
- `SizingPanel.jsx:209` 智能方案横幅染绿 `#16a34a`——**这不是成功状态，是"当前模式"提示，属于第 4 种非法用途**
- `GenSettingsPanel.jsx:43,67,79,101` 「分辨率」「出图品质」等**普通分组标签**的图标和标签文字染紫——标签是层级信息，不是品牌动作
- `EcRefImages.jsx:60` **用颜色字符串做条件判断来决定文案** [证据: `audit-panels.md` 发现 6]——这是把语义色当成状态机的键，一旦换色就逻辑崩坏

### 原则 6.2 — 语义色不得被挪作身份标识

**现状最严重的违规**：`EcMode.jsx:503` 产品图上传区用 `border: 2px solid var(--red)`（危险色）`EcMode.jsx:594` 参考图上传区用 `border: 2px solid var(--blue)`（信息色）——**红和蓝在这里表达的是"这两个区块不一样"，而不是危险/信息**。

**修法**：两个上传区用**同一个中性规格**，靠标题和图标区分。如果非要视觉区分，用 `--sb-brand-soft` vs `--sb-neutral-100` 这种同族色差，而不是跨语义的红蓝。

### 原则 6.3 — 「默认必须处于未锁定 / 中性态」

> **用户硬约束**：品牌主色调默认必须是「未锁定 / 中性」态。

**定义**：
```
默认态（Default / Hover）→ 中性灰系，零品牌紫
选中态（Selected / Active）→ 才出现品牌紫
```

**为什么**：如果默认态就是紫色，那么「选中」就没有视觉增量了——用户看不出自己选了没有。品牌色的稀缺性正是它的价值。

**可执行判据**：
```
一个未选中、未激活、未付费的控件，
其 border-color / background / color 三属性中不得出现 --sb-brand-* 系列。
```

**现状违反**：`GenSettingsPanel.jsx:52-54`（非选中卡片 hover 时边框变 `rgba(124,58,237,0.3)` 紫）、`EcMode.jsx:777`（未打开按钮 hover 背景变紫渐变）、`App.jsx:73`（"生图"按钮即使未激活也是紫底紫字）。

**唯一例外**：产品级的**主行动按钮**（如顶栏「套餐」、首页主 CTA）可以常驻品牌色——因为它是**始终被推荐的动作**，不属于"选中态"。

---

## 7. 毛玻璃（Glassmorphism）：正当使用白名单

### 原则 7.1 — 毛玻璃只用于「浮在内容之上」的容器

**白名单（仅这 3 处）：**

| # | 场景 | 理由 |
|---|---|---|
| ① | **浮在画布 / 图片之上的工具条** | 内容在下面流动，需要「我盖在它上面但我没挡住它」的语义 |
| ② | **吸顶导航栏** | 滚动时内容从下面穿过，毛玻璃正确传达了"这是固定层" |
| ③ | **浮层参数面板（L1）** | 同上，且面板是临时的、非模态的 |

**黑名单（禁止）：**
- ❌ 普通卡片、列表项、静态区块
- ❌ 按钮、chip、输入框
- ❌ 作为"高级感"装饰贴在任何东西上
- ❌ **嵌套毛玻璃**（毛玻璃里再放毛玻璃）——性能灾难，且视觉糊成一团

[来源: Apple HIG Materials https://developer.apple.com/design/human-interface-guidelines/materials；impeccable SKILL.md §Absolute bans「Glassmorphism as default. Blurs and glass cards used decoratively. Rare and purposeful, or nothing.」]

### 原则 7.2 — 毛玻璃的参数收窄

**现状问题**：`EcMode.jsx:49` 用了 `backdropFilter: blur(40px) saturate(220%)`。

| 参数 | 现状 | 规范值 | 为什么改 |
|---|---|---|---|
| blur | **40px** | **24px** | 40px 模糊太强，底层内容完全糊死，失去"能感知到下面有东西"的意义；同时 GPU 开销翻倍 |
| saturate | **220%** | **180%** | 220% 会让底层暖米白的高饱和区域产生**彩色镶边**（chromatic fringing），在大面积面板上尤其明显 |
| 背景不透明度 | 0.85 | **0.85**（保留） | 合理 |

### 原则 7.3 — 毛玻璃必须有降级方案

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sb-panel { background: #FFFFFF; }   /* 不透明降级 */
}
@media (prefers-contrast: more) {
  .sb-panel { background: #FFFFFF; backdrop-filter: none; }
}
@media (forced-colors: active) { /* 系统强制色模式 */ }
```

**为什么必须**：毛玻璃在低端安卓 / 老版 Safari 上要么完全不生效（变成半透明色块，可读性崩溃），要么触发严重的滚动掉帧。**不降级的毛玻璃是不负责任的。**

---

## 8. 动效（Motion）

### 原则 8.1 — 动效传达状态，不做装饰

**允许**：状态变化、反馈、加载、揭示。
**禁止**：装饰性动画、编排式页面入场、「让它看起来高级」。

[来源: impeccable `reference/product.md` §Motion「No orchestrated page-load sequences. Product loads into a task; users don't want to watch it load.」]

**现状违反**：`design-tokens.css:264` `.animate-float`（无限上下浮动 2.5s）、`design-tokens.css:314-317` `creative-bg-glow`（固定背景光晕）。前者在首页 hero 持续消耗 GPU 且无信息量。

### 原则 8.2 — 时长与缓动

| 场景 | 时长 | 缓动 |
|---|---|---|
| 颜色变化（hover 背景/文字） | **100ms** | `--sb-ease-out` |
| 位移 / 旋转 / 缩放 | **150ms** | `--sb-ease-out` |
| 默认（绝大多数） | **200ms** | `--sb-ease-out` |
| 面板进/出场 | **300ms** | `--sb-ease-out` |
| 弹窗进/出场 | **400ms** | `--sb-ease-out` |

**硬规则**：
- **缓动只用指数曲线**（ease-out-quart / quint / expo 近似）。**禁止 bounce / elastic / spring 的过冲**——产品 UI 里弹跳是廉价感的直接来源 [来源: impeccable SKILL.md §Motion]。
- **超过 250ms 的交互让用户等编排**。产品型界面的绝大多数过渡应该在 150–250ms 之间 [来源: impeccable `reference/product.md`]。

**现状**：`SizingPanel.jsx:242` 用 `transition: 'all 0.18s ease'`，`ParamsPanel.jsx` 用 `0.15s`，`EcMode.jsx:39` 用 `0.25s cubic-bezier(0.22, 1, 0.36, 1)`，`design-tokens.css:113-116` 定义 `0.12/0.2/0.35/0.5s` —— **5 套时长体系并存**。

### 原则 8.3 — 不要动画布局属性

不要 animate `width`/`height`/`margin`/`padding`/`top`/`left`。用 `transform` 和 `opacity`（合成层，不触发重排）。

**现状违反**：`design-tokens.css:253-260` 的 `slideDown`/`slideUp` 动画了 `max-height: 0 → 2000px` —— 这会导致**每帧重排**，且 2000px 是个魔法数字，实际内容高度变化时动效速度会不一致。

### 原则 8.4 — 揭示动画必须建立在"已可见"的默认之上

**不要**把内容可见性挂在 class 触发的 transition 上——transition 在隐藏标签页 / 无头渲染器里会暂停，动画永不触发，**页面直接渲染成空白**。

[来源: impeccable SKILL.md §Motion]

---

## 9. 层级（z-index）

### 原则 9.1 — 语义阶梯，禁止裸值

**现状**：22 种裸值散布全站（1 到 999999）。

**规范阶梯（9 档）**：

```
  --sb-z-base:       0      普通内容
  --sb-z-raised:    10      卡片内浮起元素 / 按钮行的定位容器
  --sb-z-sticky:   100      吸顶导航
  --sb-z-panel:    400      参数浮层面板
  --sb-z-dropdown: 600      下拉菜单（必须高于 panel）
  --sb-z-scrim:    800      遮罩
  --sb-z-modal:    810      弹窗（必须 > scrim）
  --sb-z-toast:    900      全局 toast
  --sb-z-tooltip:  950      tooltip（最高，永不被遮挡）
  --sb-z-top:     1000      最后手段：全屏阻断层
```

**关键：顺序即语义。** 任何新的浮层都要问：它应该在谁的上面？答案决定它落在哪一档，而不是「我随便加个 9999」。

**现状 bug 实例**：`EcMode.jsx:355` 面板 z-index `100`，`EcMode.jsx:686` 按钮行 `zIndex: 10`，但 `App.jsx:124` 顶栏是 `zIndex: 100` —— 面板和顶栏同层，且都在按钮行之上。面板打开时可能被顶栏遮挡。

---

## 10. 文案（Copy）

### 原则 10.1 — 控件说清楚点了会发生什么

按钮用**主动语态 + 具体动词**：「生成套图」而不是「提交」；「保存设置」而不是「确定」。动作名在整个流程里保持一致。

[来源: impeccable SKILL.md §More on writing in design]

**现状违反**：`GenSettingsPanel.jsx:131` placeholder「例如：模糊、变形、水印、文字...」—— 而标签是「避免出现的元素」。用户看到「避免出现的元素」不知道是要填什么，placeholder 又用「例如」开头没有主语。

**改进**：标签改成「不要出现的内容」，placeholder 改成「模糊、变形、水印、文字」。

### 原则 10.2 — 空态是邀请，错误是指路

- **空态**：告诉用户下一步做什么，并给出入口。不要只写「暂无数据」。
- **错误**：说清楚**发生了什么**和**怎么修**。不道歉、不含糊。
- **禁止 meta 式文案**：不要先立一个概念再用反讽修饰它。

### 原则 10.3 — 一个元素只做一件事

标签就是标签，示例就是示例。不要让 placeholder 兼职当标签（placeholder 输入后就消失），不要让图标兼职当说明。

**现状违反**：`EcMode.jsx:675-678` 用 `.custom-placeholder` 自制了一个两行 placeholder——**这不是 label**，输入后内容消失。必须有真实的 `<label>` 或 `aria-label`。

---

## 附：原则速查卡（贴墙版）

```
① 一屏一个 primary
② 主次靠 颜色 > 尺寸 > 字重 > 文字色 四轴，别叠
③ 嵌套 ≤ 3 层视觉
④ 间距只用 4/8/12/16/20/24/32/40/48/64
⑤ 组内:组间 = 1:2
⑥ 面板内禁止套白卡 —— 用留白 + 分组标题
⑦ 内层圆角 = 外层圆角 − 内边距
⑧ 八态全覆盖；hover 和 focus 是两件事
⑨ hover 用中性灰，selected 用品牌紫 —— 不同通道
⑩ 默认态零品牌色
⑪ 彩色字只有三种合法场合
⑫ 语义色不得当身份标识用
⑬ 毛玻璃只用于浮在内容之上的容器，且必须降级
⑭ 动效 150–250ms，指数缓动，不变布局属性
⑮ z-index 走 9 档语义阶梯
⑯ 正文 4.5:1，非文本 3:1，触控 44px
⑰ 可点击的用 <button>，别用 <div onClick>
```
