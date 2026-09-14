# 20 · 组件规范（Components）

> **这份文件回答**：每个组件长什么样、什么尺寸、什么状态、引用哪个 token。
> **谁该读**：任何要写/改组件的人 / agent。
> **上游**：`00-principles.md`（为什么）、`10-visual-language.md`（token 取值）
> **实现**：`src/styles/design-tokens-v3.css`

**通用约定**：
- 所有组件类前缀 `.sb-`
- 所有可交互元素加 `.sb-focusable` 获得统一焦点环
- 状态用**属性选择器**（`[aria-selected]` / `:disabled` / `:hover`），不用 JS 改内联 style
- 尺寸单位全部走 token，禁止硬编码

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


## 0 · 组件取色决策树（**写任何组件前先读这一节**）

> 来源：\`10-visual-language.md\` §2A–§2E 五条铁律的**组件化落地**。
> 目的：让「这个元素该用什么色」不再靠感觉，而是**查表**。

### 0.1 六问决策树

\`\`\`
你要给一个元素定颜色。依次问：

Q1 它是不是「用户此刻唯一该做的事」？
   ├─ 是 → primary 按钮：底 --sb-brand #7C3AED + 字 #FFF（每屏 ≤1 个）
   └─ 否 ↓

Q2 它是不是表达了「当前选中 / 键盘焦点 / 可点击」？
   ├─ 选中 → 三件套：底 --sb-sel-bg #F5F3FF + 描边 1.5px --sb-sel-line #7C3AED
   │        + 文字/图标 --sb-sel-ink #7C3AED（持久，不随鼠标移开消失）
   ├─ 焦点 → outline: 2px solid --sb-brand-500 #8B5CF6; outline-offset: 2px
   ├─ 可点文字 → --sb-ink-brand #7C3AED
   └─ 否 ↓

Q3 它是不是「用户最关心的数字」？
   ├─ 是 → --sb-ink-brand（如「共 12 张」的 12）
   └─ 否 ↓

Q4 它表达「成功 / 警告 / 危险 / 信息」吗？
   ├─ 是 → 语义色四件套，**文字一律用 ink 变体**
   │        成功 #2F7D46 / 警告 #B45309 / 危险 #D0443C / 信息 #3B5BA5
   │        ⚠️ 禁止用 solid 变体做文字（#5CA86C 仅 2.89:1）
   └─ 否 ↓

Q5 它表达「积分 / 金额 / 配额」吗？
   ├─ 积分余额 → 金棕 #C9902B（图标）/ #8A6216（文字），底 #FDF8EC
   ├─ 积分消耗 → #B45309
   ├─ 金额数字 → 中性 #1A1614（金额是事实，不花哨）
   ├─ 配额充足/偏低/耗尽 → #2F7D46 / #B45309 / #D0443C
   └─ 否 ↓

Q6 以上都不是 → **中性色**，按层级选：
   标题 --sb-ink-1 #1A1614
   正文 --sb-ink-2 #3D3835
   辅助/标签/placeholder --sb-ink-3 #6B6560
   禁用 --sb-ink-5 #B0AAA5
\`\`\`

### 0.2 「表面」决策树（背景色）

\`\`\`
这个元素的背景该用哪一层？

它是浮在内容之上的容器吗？
 ├─ 是（面板 / modal / 抽屉）→ L1 rgba(255,255,255,0.92) + 毛玻璃
 └─ 否 ↓

它在面板内部，且是「可点选的控件」吗？
 ├─ 是 → L3 #F4F4F4（默认）/ #EDEDED（hover）/ #F5F3FF（选中）
 └─ 否 ↓

它是「可以往里输入 / 凹陷」的区域吗？
 ├─ 是 → L2- #F2F2F1（凹槽语义）
 └─ 否 ↓

它是页面级的独立内容块（卡片）吗？
 ├─ 是 → 纯白 #FFFFFF + 1px --sb-border-subtle（**且必须不在 L1 面板内**）
 └─ 否 ↓

它是反色元素（深色 chip / 深色 CTA）吗？
 ├─ 是 → L4 #0C0A09
 └─ 否 → 透明（继承父级）
\`\`\`

### 0.3 ❌ 三条最容易犯的错

| 错误 | 为什么错 | 正确做法 |
|---|---|---|
| **面板内再放纯白卡片** | L1(#FEFEFD) 与 L2(#FFFFFF) 对比仅 **1.009:1**，肉眼不可辨，只剩 1px 边框分界 → 面板变成「小方框拼的表格」 | 用**留白 + 分组标题**分区；选项用 L3 \`#F4F4F4\` |
| **hover 用品牌紫** | 与 selected 抢同一通道，用户无法区分「鼠标停在这」和「被选中」 | hover 只动**中性灰底**（\`#F4F4F4\`→\`#EDEDED\`），selected 才动品牌紫 |
| **分不清「标签」和「动作」** | 分组标题染紫 → 品牌色通胀，面积超 10%，失去指示作用 | 标签一律中性（\`--sb-ink-3\`），品牌色只给动作/选中/焦点 |

### 0.4 状态取色总表（**所有组件通用**）

| 状态 | 背景 | 描边 | 文字 | 允许的其他变化 |
|---|---|---|---|---|
| default | \`#F4F4F4\` | \`1.5px transparent\`（占位防跳） | \`--sb-ink-1\` | — |
| hover | \`#EDEDED\` | 不变 | **不变** | — |
| active | \`#E4E4E4\` | 不变 | 不变 | \`scale(0.985)\` |
| selected | \`#F5F3FF\` | \`1.5px #7C3AED\` | \`#7C3AED\` | 图标底座 \`#7C3AED\` |
| selected+hover | \`#EDE9FE\` | \`1.5px #7C3AED\` | \`#7C3AED\` | — |
| focus-visible | 同当前态 | 同当前态 | 同当前态 | \`outline 2px #8B5CF6\`（**外加**） |
| disabled | \`#F4F4F4\` | \`rgba(12,10,9,0.06)\` | \`#B0AAA5\` | \`cursor: not-allowed\` |
| loading | 同 default | 同 default | \`visibility:hidden\` 保位 | spinner 绝对居中 |

> **实现方式**：优先用 \`.sb-opt\` 及 \`.sb-opt__icon\` 等预置类（见 \`design-tokens-v3.css\` §18），而不是手写内联 style。**内联 style 会覆盖声明式伪类**，这正是改前「hover 与选中长得一样」的成因之一。

### 0.5 品牌色面积自查（C1 规则）

把改完的面板截图 → 转灰度 → 目视清点紫色区域：

| 面积 | 判定 |
|---|---|
| **≤10%** | ✅ 健康。品牌色是「注意力货币」，稀缺才有价值 |
| 10–20% | ⚠️ 检查是否有标签/说明类元素被染紫 |
| **>20%** | ❌ 品牌色通胀。逐个元素走 §0.1 决策树，把非 A 类的降级为中性 |

---

## 目录

1. [按钮 Button](#1-按钮-button)
2. [标签页 / 分段控件 Tabs & Segmented](#2-标签页--分段控件-tabs--segmented)
3. [Chip（筛选胶囊）](#3-chip筛选胶囊)
4. [选项卡片 Option Card](#4-选项卡片-option-card)
5. [模型选择器 Model Selector](#5-模型选择器-model-selector)
6. [下拉选择 Select](#6-下拉选择-select)
7. [输入框 Input / 文本域 Textarea](#7-输入框-input--文本域-textarea)
8. [卡片 Card](#8-卡片-card)
9. [面板 Panel](#9-面板-panel)
10. [浮层 Popover / Dropdown](#10-浮层-popover--dropdown)
11. [弹窗 Modal](#11-弹窗-modal)
12. [标签 / 徽标 Badge](#12-标签--徽标-badge)
13. [Toast](#13-toast)
14. [空态 Empty State](#14-空态-empty-state)
15. [加载态 Loading & Skeleton](#15-加载态-loading--skeleton)
16. [状态横幅 Banner](#16-状态横幅-banner)

---

---

## 0.6 ⭐ 悬停位移的容器预留（**可直接照抄**）

> 规则本体见 \`10-visual-language.md\` §2I。本节给**可粘贴的实现**。
> **触发条件**：任何在 hover/selected 时 \`translateY\` 或 \`scale > 1\` 的卡片/按钮。

### 0.6.1 先算预留量

\`\`\`
R = |translateY| + 放大外扩
放大外扩 E = (W−1)×(scale−1)/2 + (H−1)×(scale−1)/2
\`\`\`

**速查表**（\`scale\` 对常见卡片尺寸的外扩）：

| 卡片尺寸 | scale(1.02) | scale(1.03) | scale(1.05) |
|---|---|---|---|
| 120×120 | 2.4 | 3.6 | 6.0 |
| **312×232** | **5.4** | **8.1** | **13.5** |
| 320×240 | 5.6 | 8.4 | 14.0 |
| 400×300 | 7.0 | 10.5 | 17.5 |

### 0.6.2 ✅ 纵向：\`::before\` / \`::after\` 占位（**唯一有效做法**）

\`\`\`css
/* 栅格容器：为 hover 位移预留纵向空间 */
.sb-lift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sb-space-4);
  /* 横向：padding 真的能扩宽裁剪矩形 */
  padding-inline: 8px;
  /* 用等量负 margin 把内容边界推回，保证"内容左右边界不变" */
  margin-inline: -8px;
}

/* 纵向：插入真实占位行，把内容流整体下推
   ⚠️ 不能用 padding-top —— overflow:auto 的裁剪矩形是 padding box，
      内容也从那里开始，padding 只会让裁剪边界和内容一起下移 */
.sb-lift-grid::before {
  content: '';
  display: block;
  grid-column: 1 / -1;   /* 跨所有列，不占列宽 */
  height: 16px;          /* = R，见 0.6.1 */
}
.sb-lift-grid::after {
  content: '';
  display: block;
  grid-column: 1 / -1;
  height: 16px;          /* 末行同理 */
}

/* 卡片本体 */
.sb-lift-card {
  border-radius: var(--sb-radius-xl);
  background: var(--sb-l3-option);
  transition: transform var(--sb-dur-fast) var(--sb-ease-out),
              box-shadow var(--sb-dur-fast) var(--sb-ease-out);
}
.sb-lift-card:hover {
  transform: translateY(-8px) scale(1.03);
  box-shadow: var(--sb-shadow-3);
}
\`\`\`

### 0.6.3 ✅ 横向：\`padding-inline\` + 负 \`margin-inline\`

\`\`\`css
/* 横向 padding 扩宽可绘区，负 margin 保持内容边界不变 */
.sb-lift-row {
  padding-inline: 8px;      /* --sb-lift-safe-x */
  margin-inline: -8px;      /* 抵消，内容 x 坐标不变 */
  overflow-x: auto;
}
\`\`\`

> **为什么横向可以而纵向不行**：横向内容宽度由 \`1fr\` 列宽 / 内容决定，**不随 padding 变化**，所以 padding 是**纯增的可绘空间**；纵向内容流跟随 padding box，padding 是**同步位移**。

### 0.6.4 ❌ 三个错误做法

\`\`\`css
/* ❌ 1. 只加 padding-top —— 实测无效，首行照样被裁 */
.grid { padding-top: 16px; }

/* ❌ 2. 用 overflow: visible 绕过 —— 会破坏滚动/圆角裁剪 */
.grid { overflow: visible; }

/* ❌ 3. 砍掉 hover 位移 —— 视觉降级，不是修法 */
.card:hover { transform: none; }
\`\`\`

### 0.6.5 推荐：**直接降低位移量**（最省事）

> \`translateY(-8px)\` 的预留成本（16px）远大于视觉收益。
> **把大卡片统一降到 \`translateY(-4px)\`，预留可降到 9px**——既解决裁切，又减少全站 71 处中的一大半风险。

| 场景 | 位移 | 预留 R |
|---|---|---|
| 按钮 / 小控件 | \`-1px\` | 3px |
| 卡片（可点） | \`-2px\` | 5px |
| 大卡片 / 作品卡 | **\`-4px\`**（原 \`-8px\`） | **9px** |

### 0.6.6 验收（四极端位置）

\`\`\`
① hover 第一行 → 顶边/圆角是否完整（不被裁平）
② hover 第一列 → 左缘是否完整
③ hover 最后一行 → 底边是否完整
④ hover 最后一列 → 右缘是否完整
⑤ 静置时 → 是否出现幽灵滚动条
⑥ 滚动到底/到顶 → 极端卡片是否仍完整
\`\`\`

---

---

## 0.7 ⭐ 弹窗 / 面板底部操作区（Dialog Footer）规范

> **来源**：用户报的真实问题——「从资产库选择」弹窗底部「取消 / 加入画布」两个按钮**挨得太近**。
> **诊断结论**：**不是间距值错了，是这条规范没有被执行。** 详见 §0.7.5。

### 0.7.1 现状：全站**已有**一套 footer 契约（但只有 3 个文件在用）

\`src/styles/design-tokens.css:92-114\` **已经定义了完整的 footer 契约**：

| Token | 值 | 语义 |
|---|---|---|
| \`--footer-actions-gap\` | **12px** | 按钮间距 |
| \`--footer-actions-gap-min\` | **8px** | 硬下限（契约测试断言不得低于此值） |
| \`--footer-actions-margin-top\` | 16px | 与内容区上间距 |
| \`--footer-actions-padding-block\` | 20px | 上下内边距（大弹窗 24） |
| \`--footer-actions-padding-inline\` | 20px | 左右内边距 |
| \`--footer-actions-button-height\` | **36px** | 常规（小 32 / 大 40） |
| \`--footer-actions-button-min-width\` | **88px** | 最小宽度（保证主次等重） |
| \`--footer-actions-radius\` | 10px | 圆角（主次一致） |
| \`--footer-actions-primary-disabled-bg\` | \`#e5e3e0\` | 禁用底色（不是「变灰看不清」） |

配套实现类 \`.ui-modal-footer\` / \`.ui-modal-footer-meta\` / \`.ui-modal-footer-actions\` / \`.ui-btn\`（\`design-tokens.css:228-280\`）。

> **原注释（\`:228-230\`）**：「任何弹窗/抽屉/面板的底部操作区都应挂 \`.ui-modal-footer\`，不要再各写各的 gap/padding 魔法数字。实测过的偏离值（**6 / 8 / 9 / 10 / 14px**）全部收敛到 12px。」

**⚠️ 但实测只有 3 个文件真正采用**：\`DialogProvider.jsx\`、\`ProjectAssetPicker.jsx\`、\`EcCanvas/index.jsx\`。
另有 **20+ 个文件各自手写 footer**，包括报出问题的 \`canvas-asset-picker.css\`。

### 0.7.2 完整规范（可直接照抄）

#### 结构

\`\`\`
┌─────────────────────────────────────────────────────────┐
│  弹窗内容区                                              │
│                                                          │
├─────────────────────────────────────────────────────────┤ ← 1px 分隔线
│  已选 3 个                        [ 取消 ]  [ 加入画布 ] │ ← 操作区
└─────────────────────────────────────────────────────────┘
    ↑ meta（可选，左）              ↑ 次要(左)  ↑ 主要(右)
    padding: 20px；间距 12px；按钮高 36px；最小宽 88px
\`\`\`

#### 取值表

| 项 | 值 | 理由 |
|---|---|---|
| **按钮间距** | **12px**（\`--footer-actions-gap\`） | 见 §0.7.3 详细论证 |
| 硬下限 | 8px | 低于 8px 误触风险显著上升 |
| **按钮高度** | **36px**（常规）/ 32（小）/ 40（大） | 与面板其他控件统一；触控友好 |
| **按钮最小宽度** | **88px** | 保证主次**视觉等重**；窄按钮会显得主次失衡 |
| 按钮圆角 | **10px**（主次一致） | 主次只在**配色与字重**上区分，不在形状上 |
| 按钮内边距 | \`0 18px\` | — |
| 操作区上间距（与内容） | **16px** + 1px 分隔线 | 明确切开内容与操作 |
| 操作区**上下**内边距 | **20px**（大弹窗 24） | 底部不能贴边 |
| 操作区**左右**内边距 | **20px** | 与弹窗内容区左右对齐 |
| 排列 | **次要左、主要右**，\`justify-content: flex-end\` | 符合中文/西文阅读流 |
| meta 文案 | 左侧，\`--sb-ink-3\` 12px | 计数/提示，与操作按钮分居两端 |

#### 可直接照抄的 CSS

\`\`\`css
/* 方案 A：用全站既有类（推荐） */
.ui-modal-footer { /* 已存在，直接挂类即可 */ }

/* 方案 B：自己的弹窗需要定制时，照抄这套取值 */
.sb-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sb-action-gap);              /* 12px */
  margin-top: var(--sb-space-4);          /* 16px 与内容区 */
  padding: var(--sb-space-5) var(--sb-space-5);  /* 20px 上下左右 */
  border-top: 1px solid var(--sb-border-subtle);
  flex: 0 0 auto;                          /* 不被内容压缩 */
}
.sb-dialog-footer__meta {
  font-size: var(--sb-text-sm);
  color: var(--sb-ink-3);
  line-height: var(--sb-leading-snug);
}
.sb-dialog-footer__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sb-action-gap);              /* 12px，必须显式声明 */
  flex: 0 0 auto;
}

/* 底栏按钮：主次视觉等重 —— 同高 / 同圆角 / 同最小宽 */
.sb-dialog-footer__actions > button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--sb-control-h-lg);          /* 36px */
  min-width: 88px;                         /* 主次等重 */
  padding: 0 18px;
  box-sizing: border-box;
  border-radius: var(--sb-radius-lg);      /* 10px */
  font-family: inherit;
  font-size: var(--sb-text-sm);
  font-weight: var(--sb-weight-bold);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--sb-dur-fast) var(--sb-ease-out),
              border-color     var(--sb-dur-fast) var(--sb-ease-out);
}
\`\`\`

### 0.7.3 为什么是 **12px**——不是 8，也不是 16

**用「间距 ÷ 按钮高度」这个比值来衡量**（这是判断两个实心块是否被读成「一组」的关键）：

| gap | gap ÷ 36px | 判定 |
|---|---|---|
| 6px | 0.17 | ❌ 太挤，误触风险 |
| **8px** | **0.22** | ⚠️ **仅是硬下限**，刚够「区分」，视觉上仍紧 |
| 10px | 0.28 | ⚠️ 非阶梯值，禁止 |
| **12px** | **0.33** | ✅ **采用** —— 达到 1/3 高度，稳定读作「两个独立按钮」 |
| 16px | 0.44 | ⚠️ 舒适，但在「图标+文字」的窄按钮旁会**拉散主次**，让主按钮失去「组内最右」的收束感 |
| 20px | 0.56 | ❌ 过宽，操作区被拉散，视觉上不再是一个整体 |

**结论**：
- **不能是 8px**：8px 只是「不误触」的下限，达不到「视觉分组清晰」的要求。
- **不能是 16px**：16px 与**分组间距**同值（\`--sb-space-4\` 是「组间」语义），用在**组内**按钮之间会造成**语义混淆**——用户会以为这两个按钮属于不同组。**同一组内的控件间距，必须小于组间距。**
- **12px 的理由**：① 是 4pt 阶梯的合法值；② 达到按钮高度的 1/3；③ **小于 16px 的组间距**，语义正确（组内 < 组间）。

> **通用原则**：\`组内间距 : 组间间距\` 应 ≥ 1 : 2。这里 12 : 16 = 1 : 1.33 偏小，但因为操作区是**独立语义块**（有分隔线 + 上下 20px padding 包裹），视觉上已被充分隔离，所以可接受。

### 0.7.4 主次顺序与对齐

| 场景 | 排列 | 说明 |
|---|---|---|
| **两按钮**（常规） | \`[取消] [确认]\`，右对齐 | 次要左、主要右 |
| **单按钮** | 仅一个主要按钮，**右对齐** | ⚠️ 不要居中——居中会让它看起来像「页面级 CTA」而非「弹窗确认」 |
| **三按钮** | \`[取消] [次要操作] [主要操作]\`，全部右对齐 | 例如 \`[取消] [另存为] [确认]\`；**不要**把「取消」放到最左端与另两个拉开 |
| **危险操作** | \`[取消] [删除]\`，删除按钮用 \`--sb-danger\` 实底 | 危险动作**必须在最右**（与主要动作同位），但用红色区分 |

**三个禁止**：
- ❌ 不要把「取消」放到弹窗最左端（与主按钮分离）——会让人以为是「关闭弹窗」的另一个入口
- ❌ 不要两按钮等宽拉伸（\`flex: 1\`）——除非是移动端全宽按钮
- ❌ 不要在操作区里再套一层卡片/边框

### 0.7.5 ⚠️ 为什么「从资产库选择」实际看起来挨太近（**关键诊断**）

实测该弹窗 footer 的几何：

\`\`\`
取消按钮     88px 宽（min-width 88 生效）
加入画布按钮 103px 宽（内容驱动："加入画布 (2)"）
按钮间距     12px  ← 值是对的
按钮高度     36px，圆角 10px
\`\`\`

**值是对的，视觉仍紧，有三个叠加原因**：

| # | 原因 | 说明 |
|---|---|---|
| **1** | **视觉重量失衡** | 主按钮是**实心渐变**（103px 实心块），次按钮是**描边幽灵**（88px 空心块）。一个重块紧贴一个轻块，边界处产生「挤压」错觉 |
| **2** | **圆角削弱了感知间隙** | 10px 圆角让两个按钮的相邻边都是「圆」的，直线段缩短，**感知间隙 < 实际 12px** |
| **3** | **间距值完全靠 token，但内层按钮组没有独立视觉锚点** | 见下 |

**修正建议（按性价比排序）**：

| 优先级 | 做法 | 效果 |
|---|---|---|
| **P0** | 主按钮改用**与次按钮同底色的轻量渐变**，或降为**品牌实底纯色**（去掉 \`#7454f3 → #d14db5\` 的高对比双色渐变） | 缩小视觉重量差，拥挤感立减 |
| **P1** | 按钮间距 **12 → 14px**（若视觉验收仍紧） | 达到 0.39 比值；⚠️ 需同步更新 \`--footer-actions-gap\`，**不能只改这一处** |
| **P1** | 主按钮文案缩短：\`加入画布 (2)\` → \`加入 (2)\`（计数已有） | 缩短实心块宽度，减小重量差 |
| **P2** | 次按钮加 \`background: var(--sb-surface-card)\` 而非完全透明 | 给幽灵按钮一点「体量」，平衡重量 |

> ⚠️ **注意**：\`canvas-asset-picker.css:26-28\` 的注释显示 9-16 已经对过一轮（底内边距 12→20、显式写 12px gap、最小宽 88px）。**说明问题不在 token 值，而在这三处视觉细节。**
> **且该文件仍未改用 \`.ui-modal-footer\`** —— 直接挂类可消除后续再漂移的风险。

### 0.7.6 禁用态

| 项 | 值 | 说明 |
|---|---|---|
| 禁用底色 | \`--footer-actions-primary-disabled-bg\` \`#e5e3e0\` | **明确底色**，不是只降透明度 |
| 禁用文字 | \`--footer-actions-primary-disabled-text\` \`#a8a39e\` | 明确文字色 |
| cursor | \`not-allowed\` | — |
| **必须真的挂 \`disabled\`** | — | ⚠️ 不能只用 \`pointerEvents: none\`（键盘仍会触发） |

> **原契约（\`:99\`）**：「主按钮禁用态要有明确表达（底色 + 文字色 + cursor），不是只变灰看不清。」
> **对照现状** \`canvas-asset-picker.css:35\` —— 已正确实现 ✅

### 0.7.7 验收清单

改任何弹窗/面板底部操作区后逐条勾：

- [ ] 按钮间距 = 12px（\`--footer-actions-gap\` / \`--sb-action-gap\`），**且是显式声明**，不吃浏览器默认值
- [ ] 按钮高度 36px（小 32 / 大 40），圆角 10px
- [ ] 按钮 \`min-width: 88px\`，白空间不换行
- [ ] 次要左、主要右；单按钮右对齐（不居中）
- [ ] 操作区上间距 16px + 1px 分隔线
- [ ] 操作区上下 padding 20px（大弹窗 24），左右 20px
- [ ] 主按钮禁用态有明确底色 + 文字色 + \`disabled\` 属性
- [ ] **优先改用 \`.ui-modal-footer\` 类**，而不是继续手写
- [ ] 视觉验收：两个按钮是否被读成「两个」而不是「一团」

---

## 1. 按钮 Button

### 1.1 结构

```
┌─────────────────────────────┐
│  [icon 16px]  gap 6  文字   │   height: lg=36 / md=32
└─────────────────────────────┘   padding: 0 16px (lg) / 0 14px (md)
      ↑                          border-radius: 8(md) / 10(lg) / pill
   focus ring 外扩 2px
```

### 1.2 变体

| 变体 | 背景 | 文字 | 边框 | 用途 | token |
|---|---|---|---|---|---|
| **primary** | `#7C3AED` | `#FFF` | 无 | 一屏唯一的主行动 | `--sb-brand` |
| **secondary** | `#FFFFFF` | `--sb-ink-2` | `1px --sb-border-default` | 次要动作 | `--sb-surface-card` |
| **ghost** | 透明 | `--sb-ink-2` | 无 | 工具栏 / 图标按钮 | — |
| **danger** | `#E8544B` | `#FFF` | 无 | 破坏性动作 | `--sb-danger` |
| **danger-ghost** | 透明 | `--sb-ink-danger` | 无 | 列表内删除（hover 才显红底） | — |

> ⚠️ **`primary` 每屏 ≤1 个**（原则 1.1）。违反时要重新想清楚"哪个才是用户此刻要做的"。

### 1.3 尺寸

| 尺寸 | 高度 | 内边距 | 字号/字重 | 圆角 | 图标 | 用途 |
|---|---|---|---|---|---|---|
| `xs` | **24px** | `0 10px` | 11/600 | 6px | 12px | 面板内微型操作 |
| `sm` | **28px** | `0 12px` | 12/600 | 8px | 14px | 面板内次级 |
| `md` | **32px** | `0 14px` | 12/600 | **8px** | 14px | **面板内默认** |
| `lg` | **36px** | `0 16px` | 13/700 | **10px** | 16px | **表单主按钮** |
| `xl` | **44px** | `0 24px` | 15/700 | pill | 16px | 顶栏 / 主 CTA |

### 1.4 状态表（每个尺寸都要有）

| 状态 | primary | secondary | ghost | danger | 时长/缓动 |
|---|---|---|---|---|---|
| **default** | `--sb-brand` 底 | 白底 + 描边 | 透明 | `--sb-danger` 底 | — |
| **hover** | `--sb-brand-strong` | `--sb-surface-tint` 底 + `--sb-border-strong` 描边 | `--sb-surface-tint` 底 | `--sb-danger-hover` | 100ms `--sb-ease-out` |
| **focus-visible** | `outline: 2px solid --sb-brand-500; outline-offset: 2px` | 同左 | 同左 | 同左 | 0ms（即时） |
| **active** | `--sb-brand-800` + `transform: scale(0.98)` | `--sb-surface-tint-strong` | `--sb-surface-tint-strong` | 更深红 | 100ms |
| **selected**（用于可切换按钮） | `--sb-brand-soft` 底 + `--sb-brand` 文字 + `1.5px --sb-brand` 描边 | 同左 | — | — | 100ms |
| **disabled** | `--sb-neutral-200` 底 + `--sb-ink-5` 文字 + `cursor: not-allowed` | 透明底 + `--sb-ink-5` 文字 | 同左 | `--sb-danger` @40% | 0ms |
| **loading** | 同 default，label 用 `visibility: hidden` 保留占位，spinner 绝对居中 | 同左 | 同左 | 同左 | spinner 800ms linear |

> ⚠️ **loading 必须保持宽度不变**——label 用 `visibility: hidden` 而不是移除。
> ⚠️ **disabled 必须真的挂 `disabled` 属性**，不能只 `pointerEvents: none`（键盘仍会触发）。

### 1.5 CSS

```css
.sb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; white-space: nowrap; user-select: none;
  font-family: var(--sb-font-sans);
  transition: background-color var(--sb-dur-instant) var(--sb-ease-out),
              border-color    var(--sb-dur-instant) var(--sb-ease-out),
              color           var(--sb-dur-instant) var(--sb-ease-out),
              transform       var(--sb-dur-fast)    var(--sb-ease-out);
  position: relative;
}
.sb-btn:active:not(:disabled) { transform: scale(0.98); }

/* --- 尺寸 --- */
.sb-btn--xs { height: var(--sb-control-h-xs); padding: 0 10px; font-size: var(--sb-text-xs); font-weight: 600; border-radius: var(--sb-radius-sm); }
.sb-btn--sm { height: var(--sb-control-h-sm); padding: 0 12px; font-size: var(--sb-text-sm); font-weight: 600; border-radius: var(--sb-radius-md); }
.sb-btn--md { height: var(--sb-control-h-md); padding: 0 14px; font-size: var(--sb-text-sm); font-weight: 600; border-radius: var(--sb-radius-md); }
.sb-btn--lg { height: var(--sb-control-h-lg); padding: 0 16px; font-size: var(--sb-text-md); font-weight: 700; border-radius: var(--sb-radius-lg); }
.sb-btn--xl { height: var(--sb-control-h-xl); padding: 0 24px; font-size: var(--sb-text-lg); font-weight: 700; border-radius: var(--sb-radius-pill); }

/* --- primary --- */
.sb-btn--primary { background: var(--sb-brand); color: var(--sb-ink-on-dark); border: none; }
.sb-btn--primary:hover:not(:disabled)  { background: var(--sb-brand-strong); }
.sb-btn--primary:active:not(:disabled) { background: var(--sb-brand-800); }
.sb-btn--primary:disabled { background: var(--sb-neutral-200); color: var(--sb-ink-5); cursor: not-allowed; }

/* --- secondary --- */
.sb-btn--secondary {
  background: var(--sb-surface-card); color: var(--sb-ink-2);
  border: 1px solid var(--sb-border-default);
}
.sb-btn--secondary:hover:not(:disabled) {
  background: var(--sb-surface-tint); border-color: var(--sb-border-strong);
}
.sb-btn--secondary:disabled { background: transparent; color: var(--sb-ink-5); border-color: var(--sb-border-subtle); cursor: not-allowed; }

/* --- ghost --- */
.sb-btn--ghost { background: transparent; color: var(--sb-ink-2); border: none; }
.sb-btn--ghost:hover:not(:disabled)   { background: var(--sb-surface-tint); }
.sb-btn--ghost:active:not(:disabled)  { background: var(--sb-surface-tint-strong); }
.sb-btn--ghost:disabled { color: var(--sb-ink-5); cursor: not-allowed; }

/* --- danger --- */
.sb-btn--danger { background: var(--sb-danger); color: var(--sb-ink-on-dark); border: none; }
.sb-btn--danger:hover:not(:disabled) { background: var(--sb-danger-hover); }

/* --- danger-ghost --- */
.sb-btn--danger-ghost { background: transparent; color: var(--sb-ink-3); border: none; }
.sb-btn--danger-ghost:hover:not(:disabled) { background: var(--sb-danger-soft); color: var(--sb-ink-danger); }

/* --- 图标按钮（正方形）--- */
.sb-btn--icon { padding: 0; width: var(--sb-control-h-md); }
.sb-btn--icon.sb-btn--sm { width: var(--sb-control-h-sm); }
.sb-btn--icon.sb-btn--xs { width: var(--sb-control-h-xs); }

/* --- loading --- */
.sb-btn__label--loading { visibility: hidden; }
.sb-btn__spinner {
  position: absolute; inset: 0; margin: auto;
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid currentColor; border-top-color: transparent;
  animation: sbSpin 0.8s linear infinite;
}
```

**HTML 结构**：
```html
<button class="sb-btn sb-btn--md sb-btn--primary sb-focusable">
  <svg class="sb-btn__icon" aria-hidden="true"><!-- 14px --></svg>
  <span class="sb-btn__label">生成套图</span>
</button>
```

---

## 2. 标签页 / 分段控件 Tabs & Segmented

### 2.1 什么时候用哪个

| 组件 | 语义 | 何时用 |
|---|---|---|
| **Tabs** | 切换**内容视图**（下面内容整体换掉） | 首页「电商生图 / 小红书图文」 |
| **Segmented** | 切换**一个值**（下面内容不变） | 「标准 / 高清」 |

### 2.2 结构（Segmented）

```
容器 bg: --sb-surface-sunken, radius 10, padding 3, gap 2
┌──────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────┐    │
│ │   标准        │ │   高清        │    │  ← 选项 height 28, radius 8
│ └──────────────┘ └──────────────┘    │     选中: 白底 + 微阴影
└──────────────────────────────────────┘
```

### 2.3 尺寸

| 属性 | 值 |
|---|---|
| 容器高度 | `34px`（= 选项 28 + padding 3×2） |
| 容器 padding | `3px` |
| 容器圆角 | `10px` |
| 容器背景 | `--sb-surface-sunken` |
| 容器边框 | **无**（靠色差） |
| 选项高度 | `28px` |
| 选项 padding | `0 14px` |
| 选项圆角 | `8px` |
| 选项字号 | 12 / 500 |

### 2.4 状态表

| 状态 | 未选中 | 已选中 |
|---|---|---|
| **default** | 背景透明 / 文字 `--sb-ink-3` | 背景 `--sb-surface-card` / 文字 `--sb-ink-1` / `--sb-shadow-1` / 字重 500→600 |
| **hover** | 背景 `--sb-surface-tint` / 文字 `--sb-ink-2` | 无变化（已选中项 hover 不变） |
| **focus-visible** | `outline` 2px 品牌色，offset 2px | 同左 |
| **active** | `transform: scale(0.97)` | 同左 |
| **disabled** | 文字 `--sb-ink-5` / cursor not-allowed | — |

> ⚠️ **hover 用中性色，selected 用白底 + 阴影**——两个不同通道，绝不混用（原则 4.3）。
> ⚠️ **不要给选中项加品牌紫**。分段控件表达的是"当前值"，不是"品牌动作"。用白底 + 阴影表达"浮起"即可。
> **现状对照**：`Home/index.jsx:55-88` 的主模式切换用了 `background: '#1a1a1a'`（近黑实底）+ `inset shadow`，**颜色过重**。按本规范应改为白底 + 微阴影。

### 2.5 CSS

```css
.sb-segmented {
  display: inline-flex; gap: 2px; padding: 3px;
  background: var(--sb-surface-sunken);
  border-radius: 10px;
}
.sb-segmented__item {
  height: var(--sb-control-h-sm); padding: 0 14px;
  display: inline-flex; align-items: center; gap: 6px;
  border: none; background: transparent;
  border-radius: var(--sb-radius-md);
  font-size: var(--sb-text-sm); font-weight: 500;
  color: var(--sb-ink-3); cursor: pointer;
  transition: background-color var(--sb-dur-instant) var(--sb-ease-out),
              color var(--sb-dur-instant) var(--sb-ease-out);
}
.sb-segmented__item:hover:not([aria-selected="true"]):not(:disabled) {
  background: var(--sb-surface-tint); color: var(--sb-ink-2);
}
.sb-segmented__item[aria-selected="true"] {
  background: var(--sb-surface-card); color: var(--sb-ink-1);
  font-weight: 600; box-shadow: var(--sb-shadow-1);
}
.sb-segmented__item:disabled { color: var(--sb-ink-5); cursor: not-allowed; }
.sb-segmented__item:active:not(:disabled) { transform: scale(0.97); }
```

### 2.6 Tabs（内容视图切换）

与 Segmented 的区别：**无容器底**，靠下划线或实底胶囊表达选中。

| 属性 | 值 |
|---|---|
| Tabs 高度 | `40px` |
| 项 padding | `0 16px` |
| 选中指示 | 底部 `2px --sb-brand` 下划线，或实底胶囊 |
| 项字号 | 13 / 600（选中）/ 13 / 500（未选） |
| 项间距 | `4px` |

**无障碍**：用 `role="tablist"` + `role="tab"` + `aria-selected`，配合 **roving tabindex**（选中项 `tabindex="0"`，其余 `-1`，方向键移动）。

---

## 3. Chip（筛选胶囊）

### 3.1 结构

```
┌──────────────────┐
│ [icon 14] 淘宝    │  height 28, padding 0 12, radius pill
└──────────────────┘
```

### 3.2 尺寸

| 属性 | 值 |
|---|---|
| 高度 | `28px` |
| padding | `0 12px` |
| 圆角 | `--sb-radius-pill` |
| 字号/字重 | 12 / 500（未选）· 12 / 600（选中） |
| 图标 | 14px |
| 组间距 | `--sb-space-2`(8px) |

### 3.3 状态表

| 状态 | 样式 |
|---|---|
| **default** | 背景 `--sb-surface-tint` / 文字 `--sb-ink-3` / 无边框 |
| **hover** | 背景 `--sb-surface-tint-strong` / 文字 `--sb-ink-2` |
| **focus-visible** | outline 2px 品牌色，offset 2px |
| **selected** | 背景 `--sb-surface-inverse`(`#0C0A09`) / 文字 `#FFF` / 无边框 |
| **selected + hover** | 背景 `--sb-neutral-800` |
| **active** | `scale(0.97)` |
| **disabled** | 背景 `--sb-surface-tint` / 文字 `--sb-ink-5` |

> **Chip 的选中用反色黑，不用品牌紫**。原因：Chip 通常是**筛选**（多选），品牌紫要留给"品牌动作"和真正的"当前项"。反色黑是中性且足够强的信号。
> **现状对照**：`SizingPanel.jsx:234-247` 平台 chip 选中用 `#1a1a1a` 实底 —— **方向正确**，但圆角用了 10px（规范是 pill），border 用了 1.5px（规范是 none），尺寸 `padding: 7px 14px` 无固定高度（规范是 28px）。

### 3.4 CSS

```css
.sb-chip {
  display: inline-flex; align-items: center; gap: 5px;
  height: var(--sb-control-h-sm); padding: 0 12px;
  border: none; border-radius: var(--sb-radius-pill);
  background: var(--sb-surface-tint); color: var(--sb-ink-3);
  font-size: var(--sb-text-sm); font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: background-color var(--sb-dur-instant) var(--sb-ease-out),
              color var(--sb-dur-instant) var(--sb-ease-out);
}
.sb-chip:hover:not([aria-pressed="true"]):not(:disabled) {
  background: var(--sb-surface-tint-strong); color: var(--sb-ink-2);
}
.sb-chip[aria-pressed="true"] {
  background: var(--sb-surface-inverse); color: var(--sb-ink-on-dark); font-weight: 600;
}
.sb-chip[aria-pressed="true"]:hover:not(:disabled) { background: var(--sb-neutral-800); }
.sb-chip:disabled { color: var(--sb-ink-5); cursor: not-allowed; }
.sb-chip:active:not(:disabled) { transform: scale(0.97); }
```

---

## 4. 选项卡片 Option Card

> **用途**：面板内的"多选一"或"多选多"，**带图标 + 描述**。这是老板最关心的「嵌套式做法」的核心组件。

### 4.1 结构

```
┌────────────────────────────────────────┐
│ ┌────┐                                  │
│ │ 1:1│  1024×1024            [✓]        │  ← 图标容器 28×28 r6
│ └────┘  正方形·适合主图                  │     标题 12/600, 描述 11/400
└────────────────────────────────────────┘
   选中时: 背景 --sb-brand-soft, 边框 1.5px --sb-brand
```

### 4.2 尺寸

| 属性 | 值 |
|---|---|
| 外边距（容器内） | `--sb-space-2`(8px) |
| padding | `10px 12px` |
| 圆角 | `--sb-radius-lg`(12px) ← **面板 20px − 内边距 8px = 12px**，符合嵌套公式 |
| 边框 | `1.5px`（**默认透明**，用 transparent 占位防止选中时布局跳动） |
| 图标容器 | `28×28` / 圆角 `6px` |
| 标题字号 | 12 / 600 |
| 描述字号 | 11 / 400 / `--sb-ink-3` |
| 标题与描述间距 | `2px` |
| 图标与文字间距 | `--sb-space-2`(8px) |

> ⚠️ **默认态必须有透明的 1.5px 边框**：否则选中时从 0px → 1.5px 会导致**整行位移**。
> **现状违反**：`DesignDirectionView.jsx:94` 默认 `1px` → 选中 `2px`，卡片会跳动 [证据: `audit-panels.md` 发现 10]。

### 4.3 状态表

| 状态 | 背景 | 边框 | 文字 | 说明 |
|---|---|---|---|---|
| **default** | `--sb-surface-tint` | `1.5px transparent` | 标题 `--sb-ink-1` / 描述 `--sb-ink-3` | **零品牌紫**（原则 6.3） |
| **hover** | `--sb-surface-tint-strong` | `1.5px transparent` | 不变 | **只动背景，不动文字颜色** |
| **focus-visible** | 同 default | `1.5px transparent` + outline 2px 品牌色 offset 2px | 不变 | — |
| **selected** | `--sb-brand-soft` | `1.5px --sb-brand` | 标题 `--sb-ink-brand` / 描述 `--sb-ink-3` | 图标容器底 `--sb-brand` + 白图标 |
| **selected + hover** | `--sb-brand-100` | `1.5px --sb-brand` | 不变 | 比 selected 略深一档 |
| **disabled** | `--sb-surface-tint` @50% | transparent | 全部 `--sb-ink-5` | cursor not-allowed |

> ⚠️ **关键差异（老板点名的"选中态有不同交互"）**：
> - **hover** = 只动**背景**（中性灰，+1 档）
> - **selected** = 动**边框 + 背景 + 文字色**（品牌紫系），且**持久**
> 两条通道完全不重叠，鼠标停在已选中项上时也不会混淆。

### 4.4 CSS

```css
.sb-option {
  display: flex; align-items: center; gap: var(--sb-space-2);
  padding: 10px 12px;
  border: 1.5px solid transparent;     /* 占位，防跳动 */
  border-radius: var(--sb-radius-lg);
  background: var(--sb-surface-tint);
  cursor: pointer;
  transition: background-color var(--sb-dur-instant) var(--sb-ease-out),
              border-color     var(--sb-dur-instant) var(--sb-ease-out),
              color            var(--sb-dur-instant) var(--sb-ease-out);
}
.sb-option:hover:not([aria-selected="true"]):not(:disabled) {
  background: var(--sb-surface-tint-strong);
}
.sb-option[aria-selected="true"] {
  background: var(--sb-brand-soft);
  border-color: var(--sb-brand);
}
.sb-option[aria-selected="true"]:hover:not(:disabled) {
  background: var(--sb-brand-100);
}
.sb-option[aria-selected="true"] .sb-option__title { color: var(--sb-ink-brand); }
.sb-option[aria-selected="true"] .sb-option__icon-box {
  background: var(--sb-brand); color: var(--sb-ink-on-dark);
}
.sb-option:disabled { cursor: not-allowed; opacity: 0.5; }
.sb-option:active:not(:disabled) { transform: scale(0.99); }

.sb-option__icon-box {
  width: 28px; height: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--sb-radius-sm);
  background: var(--sb-surface-tint-strong);
  color: var(--sb-ink-3);
  font-size: var(--sb-text-2xs); font-weight: 700;
  transition: background-color var(--sb-dur-instant) var(--sb-ease-out);
}
.sb-option__title { font-size: var(--sb-text-sm); font-weight: 600; color: var(--sb-ink-1); }
.sb-option__desc  { font-size: var(--sb-text-xs); font-weight: 400; color: var(--sb-ink-3); margin-top: 2px; }
```

**HTML（单选组）**：
```html
<div role="radiogroup" aria-label="分辨率" class="sb-option-grid">
  <div class="sb-option sb-focusable" role="radio" aria-checked="true" tabindex="0">
    <span class="sb-option__icon-box">1:1</span>
    <span>
      <span class="sb-option__title">1024×1024</span>
      <span class="sb-option__desc">正方形·适合主图</span>
    </span>
  </div>
  ...
</div>
```

> ⚠️ **不要用 `aria-selected`**（那是 tab/option 用的）。单选组用 `role="radio" aria-checked`。CSS 里两个都支持：
> `.sb-option[aria-checked="true"], .sb-option[aria-selected="true"] { ... }`

---

## 5. 模型选择器 Model Selector

> **这是参考产品拆解里最值得学的一个组件**（见 `25-reference-teardown.md` §1 规律 7）。即梦/可灵/Krea 的统一结构是「**图标 + 名称 + 描述语**」三段式。

### 5.1 结构（触发态）

```
┌──────────────────────────────────────────────┐
│ ┌──────┐                                      │
│ │ 16px │  模型名称              ▾             │  height 40, radius 10
│ │ icon │  一句话描述（60% 透明）               │
│ └──────┘                                      │
└──────────────────────────────────────────────┘
```

### 5.2 结构（展开态）

```
┌──────────────────────────────────────────────┐
│  ┌──────┐                                     │
│  │ icon │  模型名称              ▴  (选中高亮) │
│  │      │  描述语                              │
│  └──────┘                                     │
├──────────────────────────────────────────────┤
│  ┌──────┐                                     │
│  │ icon │  另一个模型            [✓]          │  ← 选中标记
│  │      │  描述语                              │
│  └──────┘                                     │
└──────────────────────────────────────────────┘
   浮层: bg #FFF, radius 12, shadow-3, padding 4
```

### 5.3 尺寸

| 属性 | 值 |
|---|---|
| 触发器高度 | `40px`（两行内容需要） |
| 触发器 padding | `6px 10px` |
| 触发器圆角 | `--sb-radius-lg`(12px) |
| 浮层宽度 | 与触发器同宽（`min-width: 280px`） |
| 浮层圆角 | `--sb-radius-xl`(16px) |
| 浮层 padding | `4px` |
| 选项高度 | `48px`（图标 32 + 两行文字） |
| 选项圆角 | `--sb-radius-md`(8px) |
| 图标容器 | `32×32` / 圆角 `--sb-radius-sm`(6px) |
| 名称字号 | 13 / 600 |
| 描述字号 | 11 / 400 / `--sb-ink-3` |

### 5.4 状态表（触发器）

| 状态 | 背景 | 边框 |
|---|---|---|
| **default** | `--sb-surface-card` | `1px --sb-border-default` |
| **hover** | `--sb-surface-card` | `1px --sb-border-strong` |
| **focus-visible** | 同 default | outline 2px 品牌色 |
| **open** | `--sb-surface-card` | `1px --sb-brand` + `--sb-shadow-ring` |
| **disabled** | `--sb-surface-tint` | `1px --sb-border-subtle`，文字 `--sb-ink-5` |

### 5.5 状态表（浮层内选项）

| 状态 | 背景 | 文字 |
|---|---|---|
| **default** | 透明 | 名称 `--sb-ink-1` / 描述 `--sb-ink-3` |
| **hover** | `--sb-surface-tint` | 不变 |
| **selected** | `--sb-brand-soft` | 名称 `--sb-ink-brand` / 右侧显示 `✓` 品牌色图标 |
| **selected + hover** | `--sb-brand-100` | 不变 |
| **disabled** | 透明 | 全部 `--sb-ink-5` |

### 5.6 与 Option Card 的区别

| | Option Card | Model Selector |
|---|---|---|
| 展示方式 | **全部平铺**（3–6 个选项） | **收起在浮层里**（选项多） |
| 何时用 | 选项 ≤6 且需要对比 | 选项多，或需要节省面板空间 |
| 面板高度 | 占空间 | 恒定 40px |

---

## 6. 下拉选择 Select

> ⚠️ **Priority 1 实现要求**：**必须用 Popover API 或 portal**，不能 `position: absolute` 放在 `overflow: hidden/auto` 容器里——**这是生成式代码最常见的下拉 bug**。

### 6.1 结构

```
触发器 (同 Model Selector 的 height 32 单行版)
   ↓
┌────────────────────────┐
│  选项 1                 │  ← 选中: 左侧 ✓ + brand 浅底
│  选项 2                 │
│  ─────────────────────  │  ← 分组分隔: --sb-border-subtle
│  选项 3                 │
└────────────────────────┘
  bg #FFF, radius 12, shadow-3, padding 4, min-width 等于触发器
```

### 6.2 尺寸

| 属性 | 值 |
|---|---|
| 触发器高度 | `32px` |
| 触发器 padding | `0 10px` |
| 触发器圆角 | `--sb-radius-md`(8px) |
| 箭头图标 | 12px，未展开 40% 透明，展开时旋转 180° |
| 浮层 padding | `4px` |
| 浮层圆角 | `--sb-radius-lg`(12px) |
| 浮层阴影 | `--sb-shadow-3` |
| 浮层与触发器间距 | `4px` |
| 选项高度 | `32px` |
| 选项 padding | `0 10px` |
| 选项圆角 | `--sb-radius-sm`(6px) |
| 选项字号 | 12 / 400（默认）· 12 / 600（选中） |

### 6.3 实现要点

```html
<!-- ✅ 推荐：Popover API，自动进 top layer，免疫 overflow 裁剪 -->
<button class="sb-select__trigger sb-focusable" popovertarget="res-menu">1:1 ▾</button>
<div id="res-menu" popover class="sb-select__menu">
  <button class="sb-select__item" role="option" aria-selected="true">1:1 正方形</button>
</div>
```

> ⚠️ **触发元素和浮层不得是父子关系**（`popover` 要求）。用 `popovertarget` 关联。
> ⚠️ **不要用 `backdrop-filter` 元素作为浮层的定位基准**——它会创建新的 containing block [来源: web.dev/backdrop-filter]。

**现状对照**：`SizingPanel.jsx:76-104` 的 `RatioSelect` 用 `position: absolute; top: 30; right: 0; zIndex: 1000`，**在 `overflow: auto` 的面板里会被裁剪**。必须改。

---

## 7. 输入框 Input / 文本域 Textarea

### 7.1 尺寸

| 尺寸 | 高度 | padding | 字号 | 圆角 |
|---|---|---|---|---|
| `sm` | **28px** | `0 10px` | 12 | 8px |
| `md` | **32px** | `0 12px` | 12 | 8px |
| `lg` | **36px** | `0 14px` | 13 | 10px |
| textarea | 自适应 | `10px 12px` | 13 | 12px |

### 7.2 状态表

| 状态 | 背景 | 边框 | 文字 | 说明 |
|---|---|---|---|---|
| **default** | `--sb-surface-card` | `1px --sb-border-default` | `--sb-ink-1` | placeholder `--sb-ink-3`（**≥4.5:1**） |
| **hover** | `--sb-surface-card` | `1px --sb-border-strong` | 不变 | — |
| **focus** | `--sb-surface-card` | `1px --sb-brand` + `--sb-shadow-ring` | 不变 | **不用 outline，用 ring** |
| **error** | `--sb-surface-card` | `1px --sb-danger` + `0 0 0 3px --sb-danger-ring` | 不变 | 下方 `11px --sb-ink-danger` 说明 |
| **disabled** | `--sb-surface-tint` | `1px --sb-border-subtle` | `--sb-ink-5` | cursor not-allowed |
| **readonly** | `--sb-surface-sunken` | 无 | `--sb-ink-2` | — |

> ⚠️ **placeholder 必须 ≥4.5:1**。这是最常被忽略的对比度要求。`--sb-ink-4`(`#9A9490`) = 3.0:1 **不合格**，placeholder 必须用 `--sb-ink-3`(`#6B6560`) = 5.9:1。
> ⚠️ **placeholder 不是 label**。永远要有可见的 `<label>` 或 `aria-label`。
> ⚠️ **无边框输入框**：如果输入框放在 `--sb-surface-sunken` 底上，可以用 `border: none` + 聚焦时加 ring。但这只限于**搜索框 / 内联编辑**等场景。

### 7.3 无边框变体（用于面板内的紧凑输入）

```css
.sb-input--bare {
  border: none; background: transparent;
  outline: none;
}
.sb-input--bare:focus-visible {
  outline: 2px solid var(--sb-brand-500); outline-offset: 0;
}
```

> ⚠️ **`outline: none` 必须配 `:focus-visible` 替代**。现状 10+ 处只写了 `outline: 'none'` 就完事 [证据: `audit-panels.md` 发现 2]，这是 WCAG 2.4.7 违规。

---

## 8. 卡片 Card

### 8.1 铁律

> **面板内禁止套白卡**（原则 3.2）。

| 场景 | 用什么 |
|---|---|
| 首页 / 页面级的独立内容块 | ✅ Card（白底 + 描边，圆角 16px） |
| 面板内的分组 | ❌ 不用 Card，用 **留白 + 分组标题**（`.sb-group`） |
| 面板内的可选项 | ❌ 不用 Card，用 **Option Card**（L3 tint 底，圆角 12px） |

### 8.2 尺寸

| 属性 | 值 |
|---|---|
| 圆角 | `--sb-radius-xl`(16px) —— **上限，不得更大** |
| padding | `--sb-space-4`(16px) 或 `--sb-space-5`(20px) |
| 背景 | `--sb-surface-card` |
| 边框 | `1px --sb-border-subtle`（**或**无边框 + `--sb-shadow-1`，**不可两者同时**） |
| 阴影（静态） | `--sb-shadow-1` 或 `none` |
| 阴影（hover，仅可点卡片） | `--sb-shadow-2` |

> ⚠️ **禁止 "ghost-card"**：`border: 1px` + `box-shadow` 模糊 ≥16px 不得同时出现。
> **现状违反**：`ui/index.jsx:14-18`（Card 组件同时有 border + shadow-lg）、`Popover.jsx:69-70`、`EcMode.jsx:51-52`。

### 8.3 状态表（可点卡片）

| 状态 | 表现 |
|---|---|
| **default** | 白底 / `1px --sb-border-subtle` / 无阴影 |
| **hover** | `--sb-shadow-2` + `transform: translateY(-1px)` + 边框变 `--sb-border-default` |
| **focus-visible** | outline 2px 品牌色 offset 2px |
| **active** | `translateY(0)` + `--sb-shadow-1` |
| **selected** | `1.5px --sb-brand` 描边 + `--sb-brand-soft` 底 |
| **disabled** | opacity 0.5 / cursor not-allowed |

---

## 9. 面板 Panel

> **这是本次设计的核心组件**。宽度固定 **480px**（用户硬约束）。

### 9.1 结构

```
        ┌────────────────────────────────────────┐  ← 连接箭头 (8px 三角)
        │  生图设置                         [×]  │  ← header: 吸顶, 12px 16px
        │  分辨率与出图品质                       │     标题 13/700, 副标题 11/400
        ├────────────────────────────────────────┤  ← 1px --sb-border-subtle
        │                                        │
        │  分辨率                                 │  ← 分组标签 11/700 ink-3
        │  ┌──────────┐  ┌──────────┐            │
        │  │ option   │  │ option   │            │  ← Option Card
        │  └──────────┘  └──────────┘            │
        │                                        │  ← 20px 组间距
        │  出图品质                               │
        │  ┌──────────┐  ┌──────────┐            │
        │  └──────────┘  └──────────┘            │
        │                                        │
        ├────────────────────────────────────────┤  ← footer: 吸顶 12px 16px
        │              [ 重置 ]  [ 应用设置 ]     │  ← primary 在右
        └────────────────────────────────────────┘
             ↑
        圆角 20px, bg rgba(255,255,255,.85) + blur 24px, shadow-4
```

### 9.2 尺寸

| 属性 | 值 | Token |
|---|---|---|
| **宽度** | **480px** | `--sb-panel-w` |
| 最大高度 | `min(70vh, 640px)` | `--sb-panel-max-h` |
| 圆角 | **20px** | `--sb-radius-2xl` |
| 背景 | `rgba(255,255,255,0.85)` | `--sb-surface-panel` |
| 毛玻璃 | `blur(24px) saturate(180%)` | `--sb-blur-panel` |
| 边框 | `1px rgba(255,255,255,0.70)` | `--sb-border-inverse` |
| 阴影 | `--sb-shadow-4` + `--sb-shadow-inset-top` | — |
| **内边距** | `16px` | `--sb-space-4` |
| header 内边距 | `12px 16px` | — |
| 与触发按钮间距 | `8px` | `--sb-panel-offset` |
| z-index | `400` | `--sb-z-panel` |
| 出场动画 | `sbPanelIn 300ms --sb-ease-out` | — |

### 9.3 面板内分组

```css
.sb-group + .sb-group { margin-top: var(--sb-space-5); }   /* 20px 组间距 */
.sb-group__label {
  font-size: var(--sb-text-xs); font-weight: 700;
  color: var(--sb-ink-3); letter-spacing: var(--sb-tracking-label);
  margin-bottom: var(--sb-space-2);                        /* 8px */
}
```

**三层结构铁律**：

| 层 | 元素 | 允许的背景 | 允许的边框 |
|---|---|---|---|
| L1 | 面板 | `rgba(255,255,255,.85)` + 毛玻璃 | `1px --sb-border-inverse` |
| L2 | Option Card / 分组行 | `--sb-surface-tint` | `1.5px transparent`（选中才显色） |
| L3 | 图标容器 / 输入框 | `--sb-surface-tint-strong` / `--sb-surface-card` | `1px --sb-border-default` |

> **L1 到 L2 靠色差**（半透明白 → 3% 暖黑），**不画框**。这是「面板看起来高级」的关键。

### 9.4 面板的降级

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sb-panel { background: #FFFFFF; }
}
@media (prefers-contrast: more) {
  .sb-panel { background: #FFFFFF; backdrop-filter: none; border-color: var(--sb-neutral-300); }
}
```

### 9.5 移动端

```css
@media (max-width: 640px) {
  .sb-panel {
    position: fixed; inset: auto 0 0 0;
    width: 100%; max-height: 70vh;
    border-radius: var(--sb-radius-3xl) var(--sb-radius-3xl) 0 0;
  }
}
```

### 9.6 现状收敛清单

| 现状 | 位置 | 改为 |
|---|---|---|
| 宽度 copy=520 / sizing=460 / settings=380 / 其余=420 | `EcMode.jsx:303` | 全部 **480** |
| `blur(40px) saturate(220%)` | `EcMode.jsx:49` | `blur(24px) saturate(180%)` |
| `borderRadius: 20` ✅ | `EcMode.jsx:47` | 保持 20px |
| `boxShadow` 含 `rgba(124,58,237,0.15)` 紫 + `rgba(0,0,0,0.08)` 冷灰 | `EcMode.jsx:52` | `--sb-shadow-4`（暖棕，无紫） |
| `zIndex: 101` | `EcMode.jsx:367` | `--sb-z-panel`(400) |
| 面板内套白卡 | `GenSettingsPanel.jsx:18` | 改 `--sb-surface-tint` + 无边框 |
| 无 header / 无 footer | 7 个面板全部 | 加 `.sb-panel__header` 和 `.sb-panel__footer` |

---

## 10. 浮层 Popover / Dropdown

### 10.1 层级阶梯

| 层级 | z-index | 圆角 | 阴影 | 遮罩 |
|---|---|---|---|---|
| **Dropdown / Select** | 600 | 12px | `--sb-shadow-3` | 无 |
| **Popover** | 600 | 16px | `--sb-shadow-3` | 无（或 `--sb-scrim-weak`） |
| **Modal** | 810 | 20px | `--sb-shadow-5` | `--sb-scrim` |
| **Drawer** | 810 | 20px（左侧直角） | `--sb-shadow-5` | `--sb-scrim` |
| **Toast** | 900 | 10px | `--sb-shadow-4` | 无 |
| **Tooltip** | 950 | 6px | `--sb-shadow-3` | 无 |

> **tooltip 层级最高**（Vercel Geist 实测 tooltip=99999 > modal=300）。它必须永不被遮挡。

### 10.2 定位要求（关键）

| 要求 | 做法 |
|---|---|
| 不被 `overflow` 裁剪 | 用 **Popover API**（`popover` 属性）或 **portal 到 body** + `position: fixed` |
| 越界翻转 | 下方空间不足时翻到上方；右侧不足时右对齐 |
| 视口边距 | 至少 `12px` |
| 与触发器间距 | `4px`（dropdown）/ `8px`（popover） |

```css
.sb-popover {
  position: fixed;
  z-index: var(--sb-z-dropdown);
  background: var(--sb-surface-card);
  border: 1px solid var(--sb-border-subtle);
  border-radius: var(--sb-radius-xl);
  box-shadow: var(--sb-shadow-3);
  padding: var(--sb-space-1);
  animation: sbFadeUp var(--sb-dur-fast) var(--sb-ease-out) both;
}
```

**现状对照**：`Popover.jsx` 用 `position: fixed` + 手动计算（`Popover.jsx:29-35`）—— **做法正确**，但缺：
- 无翻转逻辑的视口边界检查（只有 `goUp` 判断）
- `zIndex: 9999`（应用 `--sb-z-dropdown`）
- `borderRadius: 18`（应用 16）
- `border: 1px` + `boxShadow: 0 18px 46px`（ghost-card，二选一）

---

## 11. 弹窗 Modal

### 11.1 结构

```
╔══════════════════════════════════════════════╗  ← 遮罩 rgba(24,20,16,.44) + blur 4px
║  ┌────────────────────────────────────────┐  ║
║  │  标题                             [×]  │  ║  ← header 16px 20px
║  │  副标题／说明                           │  ║
║  ├────────────────────────────────────────┤  ║
║  │                                        │  ║
║  │  内容                                   │  ║  ← body padding 20px
║  │                                        │  ║
║  ├────────────────────────────────────────┤  ║
║  │              [ 取消 ]  [ 确认 ]         │  ║  ← footer 16px 20px
║  └────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════╝
   圆角 20px, bg #FFF, shadow-5
```

### 11.2 尺寸

| 尺寸 | 宽度 | 用途 |
|---|---|---|
| `sm` | 380px | 确认框 |
| `md` | 480px | 表单弹窗（与面板同宽） |
| `lg` | 640px | 复杂内容 |
| `full` | 90vw | 媒体查看 |

| 属性 | 值 |
|---|---|
| 最大高度 | `90vh`（超出时 body 内部滚动） |
| 圆角 | `--sb-radius-2xl`(20px) |
| 背景 | `--sb-surface-card`(#FFF) |
| 阴影 | `--sb-shadow-5` |
| header padding | `16px 20px` |
| body padding | `20px` |
| footer padding | `16px 20px` |
| 遮罩 | `--sb-scrim` + `blur(4px)` |
| z-index | 遮罩 800 / 弹窗 810 |

### 11.3 进出场

| 阶段 | 遮罩 | 弹窗本体 | 时长/缓动 |
|---|---|---|---|
| **进场** | opacity 0→1 | opacity 0→1 + `translateY(12px)→0` + `scale(0.97)→1` | **400ms** `--sb-ease-out` |
| **出场** | opacity 1→0 | opacity 1→0 + `translateY(0)→8px` + `scale(1)→0.98` | **200ms** `--sb-ease-in` |

> **出场比进场快**——这是通行做法：用户已经决定关闭，不想等。

### 11.4 无障碍硬要求

| 要求 | 做法 |
|---|---|
| 焦点陷阱 | 用原生 `<dialog>` + `showModal()`，**或** 给背景加 `inert` 属性。**不要手写 focus trap** |
| Escape 关闭 | `<dialog>` 原生支持；手写时监听 `keydown` |
| 初始焦点 | 聚焦到第一个可交互元素，或标题（`tabindex="-1"`） |
| 焦点返回 | 关闭后焦点回到触发元素 |
| `aria-modal` / `role="dialog"` | 必须有 |
| 标题关联 | `aria-labelledby` 指向标题元素 |

```html
<dialog class="sb-modal" aria-labelledby="modal-title">
  <header class="sb-modal__header">
    <h2 id="modal-title" class="sb-modal__title">确认删除</h2>
    <button class="sb-btn sb-btn--ghost sb-btn--icon sb-focusable" aria-label="关闭">×</button>
  </header>
  <div class="sb-modal__body">删除后不可恢复。</div>
  <footer class="sb-modal__footer">
    <button class="sb-btn sb-btn--lg sb-btn--secondary sb-focusable">取消</button>
    <button class="sb-btn sb-btn--lg sb-btn--danger sb-focusable">删除</button>
  </footer>
</dialog>
```

### 11.5 用不用 Modal？（先问这个）

> **Modal 通常是懒惰的答案。优先考虑内联 / 渐进式替代。** [来源: impeccable `reference/product.md`]

| 场景 | 更好的方案 |
|---|---|
| 确认删除 | **Undo toast**（先删，给 5 秒撤销）—— 比确认框好得多 |
| 简单的表单 | 内联展开 |
| 设置项 | 侧面板 / Popover |
| 必须阻断的破坏性操作 | ✅ Modal |

---

## 12. 标签 / 徽标 Badge

### 12.1 变体

| 变体 | 背景 | 文字 | 用途 |
|---|---|---|---|
| **neutral** | `--sb-surface-tint-strong` | `--sb-ink-3` | 元信息（如"可选"） |
| **brand** | `--sb-brand-soft` | `--sb-ink-brand` | 品牌相关标记 |
| **success** | `--sb-success-soft` | `--sb-ink-success` | 已完成 |
| **warning** | `--sb-warning-soft` | `--sb-ink-warning` | 需注意 |
| **danger** | `--sb-danger-soft` | `--sb-ink-danger` | 错误 / 必填 |
| **solid** | `--sb-danger` | `#FFF` | 强提示（如"必须"） |

### 12.2 尺寸

| 尺寸 | 高度 | padding | 字号 | 圆角 |
|---|---|---|---|---|
| `sm` | `18px` | `0 6px` | 10 / 600 | 4px |
| `md` | `22px` | `0 8px` | 11 / 600 | 6px |

> ⚠️ **Badge 不是按钮**。如果它可以点，用 `.sb-chip`。
> **现状对照**：`EcMode.jsx:521` 「必须」徽标用 `background: var(--red)` + `borderRadius: 8` + `fontSize: 10` —— 尺寸接近，但圆角应用 4px（sm）；`EcMode.jsx:612` 「可选」用 `rgba(0,0,0,0.04)` —— 应用 `--sb-surface-tint-strong`。

---

## 13. Toast

### 13.1 结构

```
┌────────────────────────────────────┐
│  [icon 16]  消息文字                │  height auto, padding 10px 16px
└────────────────────────────────────┘   radius 10, shadow-4
     ↑ 底部居中, bottom 24px
```

### 13.2 规格

| 属性 | 值 |
|---|---|
| 位置 | 底部居中，`bottom: 24px` |
| 最大宽度 | `min(420px, 90vw)` |
| padding | `10px 16px` |
| 圆角 | `10px` |
| 字号 | 13 / 500 |
| 阴影 | `--sb-shadow-4` |
| z-index | `--sb-z-toast`(900) |
| 间距（多条堆叠） | `8px` |
| 自动消失 | 3000ms（success/info）· **6000ms**（error） |
| 进场 | `sbFadeUp 200ms --sb-ease-out` |
| 出场 | opacity → 0，`150ms` |

### 13.3 变体（**改：不要用整块彩色底**）

> **现状问题**：`Toast.jsx:44` 用 `background: colors[t.type]` 整块高饱和彩色底 + 白字。这有三个问题：① 视觉过重 ② 成功绿的实底 `#10b981` 上白字对比度仅 2.3:1（**违规**）③ 一屏多个 toast 会像跑马灯。

**规范做法**：**白底 + 左侧语义色图标**（不用侧边彩条——那是 impeccable 明确禁止的 anti-pattern）。

| 变体 | 背景 | 图标色 | 文字 |
|---|---|---|---|
| **info** | `--sb-surface-card` | `--sb-info` | `--sb-ink-2` |
| **success** | `--sb-surface-card` | `--sb-success` | `--sb-ink-2` |
| **error** | `--sb-surface-card` | `--sb-danger` | `--sb-ink-2` |
| **warning** | `--sb-surface-card` | `--sb-warning` | `--sb-ink-2` |

> ❌ **禁止 `border-left: 3px solid <color>`** 作为状态指示——impeccable 明列为 "Side-stripe borders. Never intentional." [来源: impeccable SKILL.md §Absolute bans]

### 13.4 Undo 优于确认

> **删除操作优先用 Undo toast**：立即从 UI 移除，显示「已删除 · 撤销」，5 秒后才真正删除。确认框只留给**真正不可逆**的操作（账号注销、批量删除）。[来源: impeccable `reference/interaction-design.md`]

---

## 14. 空态 Empty State

### 14.1 结构

```
        ┌─────────┐
        │  插图    │  ← 48px 图标 或 96px 插图，--sb-ink-5 着色
        └─────────┘
         主文案         ← 15 / 600 / --sb-ink-1
         说明文案       ← 12 / 400 / --sb-ink-3，max-width 280px
        [ 主行动按钮 ]   ← primary, lg
```

### 14.2 规格

| 属性 | 值 |
|---|---|
| 容器 padding | `48px 20px` |
| 图标尺寸 | `48px`（线性）或 `96px`（插图） |
| 图标颜色 | `--sb-ink-5` |
| 图标 → 标题 | `--sb-space-4`(16px) |
| 标题字号 | 15 / 600 / `--sb-ink-1` |
| 标题 → 说明 | `--sb-space-1`(4px) |
| 说明字号 | 12 / 400 / `--sb-ink-3`，`max-width: 280px` |
| 说明 → 按钮 | `--sb-space-4`(16px) |

### 14.3 文案原则

> **空屏是一个行动邀请，不是情绪表达。** [来源: impeccable SKILL.md §More on writing]

| ❌ 不要写 | ✅ 应该写 |
|---|---|
| 「暂无数据」 | 「还没有作品 · 上传产品图，30 秒生成第一套电商图」+ [开始生成] |
| 「空空如也～」 | 「画布还是空的 · 从左侧拖入素材，或点击「生成套图」」 |

**必须包含**：① 说清为什么空 ② 给出**一个**明确的下一步动作。

---

## 15. 加载态 Loading & Skeleton

### 15.1 优先级

> **骨架屏 > spinner**。骨架屏预览内容形状，感觉比通用 spinner 更快。[来源: impeccable `reference/interaction-design.md`]

| 场景 | 用什么 |
|---|---|
| 内容区首次加载 | **骨架屏**（`.sb-skeleton`） |
| 按钮提交 | 按钮内 spinner（宽度不变） |
| 局部刷新 | 该区域 skeleton |
| 全页阻断（生成中） | 分步进度 + 百分比，**不要只转圈** |

### 15.2 骨架屏

```css
.sb-skeleton {
  background: linear-gradient(90deg,
    var(--sb-neutral-100) 25%, var(--sb-neutral-50) 37%, var(--sb-neutral-100) 63%);
  background-size: 200% 100%;
  animation: sbShimmer 1.4s ease-in-out infinite;
  border-radius: var(--sb-radius-md);
}
```

**尺寸**：骨架块的高度/圆角应**匹配真实内容**（标题块 16px 高 r4，正文块 12px 高 r4，图片块 r12）。

**减少动效**：`@media (prefers-reduced-motion: reduce)` 下改静态底 `--sb-neutral-100`。

### 15.3 现状问题

`App.jsx:301-305` 生成中用 `position: fixed; inset: 0; zIndex: 9999; background: var(--bg)` 全屏覆盖——**用户完全看不到进度**。应改为：① 保留界面可见 ② 在内容区显示分步进度 ③ 用 `--sb-z-top`(1000)。

---

## 16. 状态横幅 Banner

> **用途**：面板顶部的"当前模式"提示条（智能方案 / 已自定义）。

### 16.1 结构

```
┌──────────────────────────────────────────────┐
│  [icon 14]  当前：已启用智能方案              │  ← 无边框通栏
└──────────────────────────────────────────────┘     padding 10px 16px, 无圆角
     ↑ 贴在面板 header 下方
```

### 16.2 规格

| 属性 | 值 |
|---|---|
| padding | `10px 16px` |
| 圆角 | **无**（通栏，贴面板边缘） |
| 边框 | **仅底部 1px**（语义色 @12% 透明） |
| 背景 | 语义色 @6% → @3% 的极浅渐变 |
| 字号 | 12 / 600 |
| 图标 | 14px |
| 图标与文字间距 | `--sb-space-2`(8px) |

### 16.3 变体

| 变体 | 图标色 / 文字色 | 背景 | 用途 |
|---|---|---|---|
| **brand**（已自定义） | `--sb-ink-brand` | `--sb-brand-soft` | 用户覆盖了 AI 推荐 |
| **success**（已启用 AI） | `--sb-ink-success` | `--sb-success-soft` | AI 全自动 |
| **warning** | `--sb-ink-warning` | `--sb-warning-soft` | 需注意 |
| **info** | `--sb-ink-info` | `--sb-info-soft` | 一般提示 |

> ⚠️ **状态横幅的文字必须用 `--sb-ink-*`，不要用 `--sb-*` 实色**。`SizingPanel.jsx:209` 用 `color: '#16a34a'`（成功实色绿）在浅绿底上 —— 对比度不足且非 token。
> ⚠️ **不要用渐变**。现状 `SizingPanel.jsx:207` 用 `linear-gradient(135deg, rgba(34,197,94,.08), rgba(34,197,94,.04))` —— 实色更干净。
> **现状不一致**：4 个面板用无边框通栏，`SkuPanel.jsx:37-52` 却用 radius 10 + 1px 边框的卡片 [证据: `audit-panels.md` 发现 7]。**统一到通栏**。

---

## 附：组件优先级（落地顺序）

| 优先级 | 组件 | 为什么先做 |
|---|---|---|
| **P0** | Button、Option Card、Chip、Panel | 面板里 80% 的视觉噪音来自这四个 |
| **P0** | Field（标签 + 输入框组合） | 消除"字段 label 四维全不一致" |
| **P1** | Segmented、Select、Badge、Banner | 统一交互态 |
| **P1** | Modal、Toast、Empty State | 统一反馈 |
| **P2** | Model Selector、Tooltip、Skeleton | 体验增强 |

**预计收益**：抽出 `<Button> <Chip> <OptionCard> <Field> <Panel> <Banner>` 六个组件，可消除现状约 **80%** 的视觉不一致 [依据: `_research/audit-panels.md` 跨面板不一致清单 —— 7 档圆角、3 种 hover 实现、3 种边框粗细的根因都是"每个面板手写内联样式"]。
