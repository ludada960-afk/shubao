# 30 · 落地计划（Adoption Plan）

> **这份文件回答**：先改哪里、每步改什么、风险与回退。
> **前提铁律**：**本阶段只新建文件，不修改任何 `src/pages/**` 或组件。** 落地由后续专项 agent 按本文档执行。
> **上游**：`10-visual-language.md`（token）、`20-components.md`（组件）

---

> ## 🔒 决策口径（**唯一权威：`40-decisions.md`**）
>
> 本文档中的一切规则，若与 `docs/design/40-decisions.md` 的 **D1–D12** 冲突，**以 D-decisions 为准**。
> 本文档**引用 D 编号，不另立说法**。
>
> | 编号 | 决策 | 与本文档的对应 |
> |---|---|---|
> | **D1** | 主色 = 品牌紫 `--sb-brand-600`（近黑降为中性强调；**不直接改 V2 `--accent`**） | §0 取色决策树 |
> | **D1-补** | 品牌红 `#FB5358` = **标识色**（logo/吉祥物/hero/空态），**不接管交互主色** | §2A A 类清单 |
> | **D2** | 选中态统一用 **ring**（`--sb-shadow-ring`，不改边框宽度 → 零布局抖动）+ 三件套；**hover 与 selected 必须视觉不同** | §2C 选中态三件套 |
> | **D3** | 靛蓝 `#6366F1`/`#4338CA`/`#EEF2FF` 系 = **历史遗留，全部迁往品牌紫** | §B 迁移表「靛蓝→品牌紫」 |
> | **D4** | 覆盖层用**暖黑** `rgba(12,10,9,α)`，**纯黑退役** | §6 边框 / §11 阴影 |
> | **D5** | 改造顺序：**接 token → 色相替换 → surface 分层 → 尺寸统一**（**严禁反序**） | §2 批次划分 |
> | **D6** | 圆角**只有 4 档**（20/12/8/6），**10px 退役**按场景归入 8 或 12 | §10 圆角 |
> | **D7** | **面板内禁止再套白卡**，用留白 + 分组标题 | §2B 表面分层 |
> | **D8** | 同一选择器**只允许一处定义**（禁止追加式覆盖） | — |
> | **D9** | hover 位移必须**由容器预留空间**（三选一） | §2I / §0.6 |
> | **D10** | 语义**文字**用 `--sb-ink-*`，**填充**用 `--sb-danger/success/warning` | §2D 语义色 |
> | **D11** | `focus-visible` 必填，**禁止裸 `outline:none`** | §2C / §16 焦点环 |
> | **D12** | 幽灵变量与死代码**当 bug 清** | §A.0 |

> ## 📌 数据基准说明（**读任何数字前先看这条**）
>
> 本知识库中的所有**实测指标**，权威来源 = **活跃开发树 `.worktrees/codex-ecommerce-stability/`**。
>
> | 指标 | worktree（**权威**） | master（子集，仅供对照） |
> |---|---|---|
> | 源文件 | **316** | 55 |
> | hex 硬编码 | **5771 次 / 1785 个不同值** | 1571 次 / 239 值 |
> | 字号档位 | **27** | 24 |
> | gap 非阶梯值 | **896/1540（58%）** | 175/371（47%） |
> | z-index 裸值 | **32** | 21 |
> | `backdrop-filter` 文件 | **41** | 15 |
> | 悬停位移站点 | **85** | 71 |
> | **`focus-visible`** | **124 处 ✅ 已达标** | 0 处 ❌ |
> | **`prefers-reduced-motion`** | **32 处 ✅ 已达标** | 0 处 ❌ |
> | 品牌紫硬编码 | 159 次 / 150 行 / 38 文件 | 77 处 / 21 文件 |
>
> ⚠️ **两条曾被误判为"P0 缺陷"的项，在活跃树上已经修复**：
> `focus-visible` 与 `prefers-reduced-motion` 在 worktree 上分别有 **115 处**与 **32 处**，**不是缺陷**。
> （早期文档基于 master 得出"全站 0 次"的结论，**对活跃开发树不成立**，已在本节更正。）
>
> 复现：`cd .worktrees/codex-ecommerce-stability && node scripts/design-audit.mjs`


## 0. 全局约束

| # | 约束 |
|---|---|
| 1 | **不 commit**。所有改动由老板统一验收后提交。 |
| 2 | **每一步独立可回退**。每步改动范围可控，出问题能单独 revert。 |
| 3 | **不做大爆炸重构**。按页面/组件粒度推进，每步完成后可单独验收。 |
| 4 | **零回归底线**：`design-tokens-v3.css` 是纯新增文件，删掉它全站渲染必须与今天完全一致。 |
| 5 | **现有硬约束必须继承**：面板宽 480、间距 4/8/12/16/20/24、字号 13/700·12/600·12/400·11/400、控件高 32/36/40、圆角 8/12/20、品牌默认中性态。 |

---

## 1. 现状体检结论（决定优先级的事实基础）

### 1.1 五组硬数据

| 维度 | 现状 | 目标 | 收敛比 |
|---|---|---|---|
| **hex 颜色** | 208 个不同值 / 1568 次硬编码 | 全部走 token（≈60 个） | 3.5 : 1 |
| **字号** | 27 档（7–62px） | 9 档 | 2.7 : 1 |
| **圆角** | 同语义最多 6 档 | 6 档语义明确 | — |
| **控件高度** | 12 档（26–50px） | 5 档 | 2.4 : 1 |
| **z-index** | 22 个裸值（1–999999） | 9 档语义阶梯 | 2.4 : 1 |

### 1.2 三个"结构性"问题（不是调参能解决的）

| # | 问题 | 证据 |
|---|---|---|
| **S1** | **两套主色体系并存** | `design-tokens.css:12-13` 声明"无彩色主色"，但 `#7c3aed` 紫硬编码 **151 次 / 30 文件**（迁移中） |
| **S2** | **同一流程两个相反配色** | `DesignDirection.jsx`（暖白）vs `DesignDirectionView.jsx`（暗色 `#0f0f1a`） |
| **S3** | **三对平行实现已视觉分叉** | SKU（`ec/SkuPanel.jsx` ↔ `EcSkuPanel.jsx`）、产品参数（`ec/ParamsPanel.jsx` ↔ `EcProductParams.jsx`）、设计方向（`DesignDirection.jsx` ↔ `DesignDirectionView.jsx`） |

### 1.3 两个"零成本高收益"的 bug

| # | 问题 | 证据 | 修复成本 |
|---|---|---|---|
| **B1** | **6 个幽灵 CSS 变量** | `--amber-400`/`--amber-500`（`Navbar.jsx:101`）、`--shadow-red-lg`（`Button.jsx:31`）、`--surface-raised`（`Footer.jsx:14`、`Home.css:88`）、`--shadow-red`（`Home.css:229-230`） | 低（加 6 个变量 或 删除引用） |
| **B2** | **Navbar.jsx 是死代码** | `App.jsx:272` 渲染的是内联 `TopBar`，`Navbar.jsx`（208 行）从未被引用 | 低（删除或接线） |

---

## 2. 阶段划分

> ### 🔒 D5 顺序约束（**严禁反序**）
> **接 token → 色相替换 → surface 分层 → 尺寸统一**
> 反序的代价：先把尺寸改完再替换色相，等于**把硬编码重新种一遍**。
>
> | D5 步骤 | 状态 | 对应本文档 |
> |---|---|---|
> | ① 接 token | ✅ 已完成（`design-tokens-v3.css`，已 import，commit `59d1fe82`） | 批次 0 |
> | ② 全局暖黑色相替换（`rgba(0,0,0,α)` → `rgba(12,10,9,α)`，约 320 处，**零布局风险**） | 🚧 进行中 | 批次 0.5 |
> | ③ surface 分层（补 35 处分层失败点） | ⬜ | 批次 1–2 |
> | ④ 尺寸统一与主 CTA 组件化（9 档高度 38–58px → `--sb-control-h-*`） | ⬜ | 批次 2–3 |

> **落地依赖顺序**（后一批依赖前一批的 token 与组件，**不可跳批**）：

```
批次 0  基础设施（token 接线）        ← 零风险，前置依赖，先做
批次 1  外壳 + 首页                   ← 用户第一眼看到；也验证 token 是否够用
批次 2  电商链路（生成→方向→参数→SKU→文案→画布入库）
批次 3  画布 / 工作台                 ← 紫色最密集（116 处），依赖批次 2 的组件
批次 4  遗留页 + 清理收口             ← 作品/定价/图库/重制/Plog + 删死代码
```

| 批次 | 内容 | 预估 | 依赖 | 回退粒度 |
|---|---|---|---|---|
| **0** | token 接线 + 6 幽灵变量 + 决策 S1 | 0.5 天 | — | 删一行 import |
| **1** | **外壳（顶栏/侧栏） + 首页** | 3 天 | 0 | 按文件 revert |
| **2** | **电商链路**（6 个参数面板 + 设计方向 + 生成流程） | 4 天 | 1 | 按面板 revert |
| **3** | **画布 / 工作台**（EcCanvas / EcStudio / VideoStudio） | 3 天 | 2 | 按文件 revert |
| **4** | **遗留页 + 清理**（作品/定价/图库/重制/Plog + 死代码） | 2 天 | 3 | 按文件 revert |


---

## 2.1 批次文件清单（**改造 agent 的派工表**）

> 每批都给出：**要改的文件** / **改什么** / **验收** / **回退**。
> 列出的路径均相对 \`.worktrees/codex-ecommerce-stability/\`。

### 批次 1 · 外壳 + 首页

| # | 文件 | 改什么 | 风险 |
|---|---|---|---|
| 1 | \`src/App.jsx\` | 顶栏 \`TopBar\`（:118-199）按钮统一 \`.sb-btn--xl\`；字重 900→700；\`SideNav\`(:24-115) 圆角/状态改 token | 中（全站可见） |
| 2 | \`src/components/layout/Navbar.jsx\` | **死代码**（\`App.jsx:272\` 渲染的是 TopBar）→ 删除或接线，二选一 | 低 |
| 3 | \`src/pages/Home/index.jsx\` | hero 区（:35-51）字号收敛；主模式切换（:55-88）近黑实底 → 规范 Segmented；\`.hero-gradient-text\` 去渐变 | 中 |
| 4 | \`src/pages/Home/EcMode.jsx\` | \`GLASS_PANEL\`(:46-54) → \`.sb-panel\`；面板宽 4 档 → 480(:303)；功能按钮 hover/selected 分通道(:763-792)；上传区红/蓝语义色误用(:503,594) | **高**（首页主路径） |
| 5 | \`src/pages/Home/Home.css\` | 22 处 hover 位移的容器预留；\`#6d28d9\` 等紫收敛；\`creative-bg-glow\` 评估 | 中 |
| 6 | \`src/styles/app-shell.css\` | 外壳样式 token 化；6 处 hover 位移预留 | 中 |

**验收**：首页 1440/390 截图对比；键盘走完顶栏+hero；\`design-audit.mjs\` ① 指标下降。
**回退**：按文件 \`git checkout\`。

### 批次 2 · 电商链路

| # | 文件 | 改什么 | 风险 |
|---|---|---|---|
| 1 | \`src/pages/Home/ec/GenSettingsPanel.jsx\` | **样板先行**（§2F 十条逐行对照）：选中三件套、图标底座、transition token 名 | 中 |
| 2 | \`src/pages/Home/ec/SizingPanel.jsx\` | 选项卡圆角 10→12；RatioSelect 下拉改 Popover API（**当前会被 overflow 裁切**）；平台 chip 改 \`.sb-chip\` | 中 |
| 3 | \`src/pages/Home/ec/StylePanel.jsx\` | 分组标签统一；渐变 → token | 低 |
| 4 | \`src/pages/Home/ec/ParamsPanel.jsx\` | 与 \`EcProductParams.jsx\` 二选一（§4.1 平行实现） | 中 |
| 5 | \`src/pages/Home/ec/SkuPanel.jsx\` | 与 \`EcSkuPanel.jsx\` 二选一；状态横幅统一为通栏 | 中 |
| 6 | \`src/pages/Home/ec/CopyPanel.jsx\` | 边框 1.5px→1px；label 规格统一 | 低 |
| 7 | \`src/pages/Home/ec/DesignDirection.jsx\` | 与 \`DesignDirectionView.jsx\` 合并（**暖白 vs 暗色两套配色**）；主按钮 radius 25→规范 | **高** |
| 8 | \`src/pages/Home/ec/EcProfileRail.css\` | 10 处紫收敛；hover 位移预留 | 中 |
| 9 | \`src/pages/Home/ec/*.css\`（6 个） | crossModeProductProfile / ProductProfileShelf / skill-library / model-pricing / resizable-textarea | 低 |

**验收**：完整走一遍「上传产品图 → 生成套图 → 设计方向 → 生成」；6 个面板截图对比。
**回退**：**按面板单独 revert**（每个面板是独立文件）。

### 批次 3 · 画布 / 工作台

| # | 文件 | 改什么 | 风险 |
|---|---|---|---|
| 1 | \`src/pages/EcCanvas/EcCanvas.css\` | 11 处紫收敛；对象工具栏选中态；5 处 hover 位移预留 | **高**（核心功能） |
| 2 | \`src/pages/EcCanvas/index.jsx\` | 12 处紫；节点选中 ring；\`zIndex:10001\` 放大遮罩 → \`--sb-z-modal\` | **高** |
| 3 | \`src/pages/EcCanvas/components/canvas-library.css\` | ✅ 位移预留**已修**（:147-190），仅需紫收敛 + footer 改契约类 | 低 |
| 4 | \`src/pages/EcCanvas/components/canvas-asset-picker.css\` | **用户报的间距问题**：主按钮双色渐变减重；footer 改 \`.ui-modal-footer\` | 低 |
| 5 | \`src/pages/EcCanvas/components/workflowNodes/**\` | 13 处紫；节点/端口选中态 | 中 |
| 6 | \`src/pages/EcCanvas/components/CanvasTemplateMarketplace.jsx\` 等 | 5+4+3 处紫 | 低 |
| 7 | \`src/styles/canvas-*.css\`（6 个） | supervisor / right-panel / minimap / derive-menu / empty-actions / watermark | 中 |
| 8 | \`src/pages/EcStudio/index.jsx\` + \`VideoStudio/**\` | 靛蓝 \`#4338CA\` 统一；7 处 hover 位移 | 中 |

**验收**：画布全流程（建节点→连线→生成→导出）；\`design-audit.mjs\` ③b 紫色数下降。
**回退**：按文件 revert；画布改动**单独 commit**。

### 批次 4 · 遗留页 + 清理收口

| # | 文件 | 改什么 | 风险 |
|---|---|---|---|
| 1 | \`src/pages/Works/index.jsx\` | 卡片规格、空态文案、栅格间距 | 低 |
| 2 | \`src/pages/Pricing/index.jsx\` + \`styles/pricing-modal.css\` | 套餐卡层级；推荐态用品牌色；主 CTA 唯一性；4+4 处紫 | 中 |
| 3 | \`src/pages/Gallery/index.jsx\` | 覆盖文字对比度；1 处毛玻璃评估 | 低 |
| 4 | \`src/pages/Remake/index.jsx\` | 表单规格；2 处紫 | 低 |
| 5 | \`src/pages/Plog/index.jsx\` | 卡片/按钮规格 | 低 |
| 6 | \`src/NoteModal.jsx\` | 4 处毛玻璃；\`#7c3aed\` 文字 | 中 |
| 7 | \`src/components/business/Modals.jsx\`、\`ProjectAssetPicker.jsx\`、\`ui/Toast.jsx\` | Toast 改白底+图标色；**去掉侧边彩条反模式** | 中 |
| 8 | **清理**：\`Navbar.jsx\` / \`ui/Button.jsx\` / 三对平行实现 / \`EcSkuPanel:87-95\` 死代码 | 删除 | 中 |

**验收**：5 个页面截图；\`design-audit.mjs\` 全指标达标。
**回退**：清理类改动**单独 commit**，便于单独 revert。

---

## 阶段 0 · 基础设施（零风险）

**目标**：让规范可以被使用。**不改任何现有视觉。**

### 步骤 0.1 — 接线 token

| 动作 | 文件 | 内容 |
|---|---|---|
| 新增 import | `src/main.jsx:4` 之后 | `import './styles/design-tokens-v3.css';` |

**验收**：页面渲染与改动前**逐像素一致**（因为新文件只定义变量和工具类，没有选择器命中现有 DOM）。

**回退**：删掉那一行 import。

### 步骤 0.2 — 补齐 6 个幽灵变量

在 `design-tokens.css` 的 `:root` 里补上（或在 `design-tokens-v3.css` 里补 `--amber-400` 等，但**不改名**，避免影响引用处）：

```css
--amber-400: #FBBF24;
--amber-500: #F59E0B;
--shadow-red: 0 4px 16px rgba(232, 84, 75, 0.15);
--shadow-red-lg: 0 8px 28px rgba(232, 84, 75, 0.24);
--surface-raised: #FFFFFF;
```

> ⚠️ 这会让**当前渲染发生变化**（之前是无效值，现在生效）。需要单独看一眼受影响处：`Navbar.jsx:101`（积分图标色）、`Button.jsx:31`（primary hover 阴影）、`Footer.jsx:14` 和 `Home.css:88`（footer 背景）、`Home.css:229-230`（xg 生成按钮阴影）。
> **替代方案**：如果不想改变渲染，就把这 6 处引用直接替换成对应 token。**推荐后者**（更干净）。

### 步骤 0.3 — 决策 S1（品牌主色）

> **这是唯一需要人拍板的事项。**

| 选项 | 做法 | 影响 |
|---|---|---|
| **A（推荐）** | 把紫 `#7C3AED` 提升为正式品牌色，同时强制"默认中性态"规则 | 零代码改动，与现状一致；规范已按此写 |
| **B** | 回归 `design-tokens.css` 原意（`--accent: #0C0A09` 近黑），把 67 处紫色全部替换为近黑 | 大范围改动；品牌识别度下降 |
| **C** | 双主色：近黑用于中性场景，紫只用于 CTA | 需要逐处判断，最费人力 |

**本规范默认按 A 编写。** 若选 B 或 C，只需替换 `design-tokens-v3.css` §1 的 `--sb-brand-*` 九个值，**其余规范全部不变**——这正是 token 化的价值。

---

## 阶段 1 · P0 组件 + 首页参数面板（收益最大）

### 步骤 1.0 — 底部操作区契约收口（**独立小任务，半人日**）

**问题**：全站已有 `--footer-actions-*` 契约（`design-tokens.css:92-114`）与 `.ui-modal-footer` 类，但**只有 5 个文件采用，9 个文件自写**，gap 值残留 8 种（`2/4/5/6/7/8/10/12px`）。用户报的「取消/加入画布挨太近」正是其中之一。

| 动作 | 文件 |
|---|---|
| 1. 把 9 个自写 footer 改用 `.ui-modal-footer` + `.ui-modal-footer-actions` | 见 `20-components.md` §0.7.1 表 |
| 2. `canvas-asset-picker.css` 的**视觉重量失衡**（主按钮双色渐变过重） | 见 §0.7.5 的 P0 修正 |
| 3. 全站搜硬编码 footer `gap` 值，收敛到 `--footer-actions-gap` | `grep -rn "footer.*gap:.*[0-9]px"` |

**验收**：`node scripts/design-audit.mjs` ③d 显示「自写 footer: 0 个文件」「硬编码 gap: 无」。

**风险**：低。契约已存在且有测试（`--footer-actions-gap-min: 8px` 契约断言）。

### 步骤 1.1 — 实现 6 个基础组件

**新建**（不改现有组件）`src/components/ds/`：

| 组件 | 文件 | 对应规范 |
|---|---|---|
| `Button` | `ds/Button.jsx` + `ds/Button.css` | `20-components.md` §1 |
| `Chip` | `ds/Chip.jsx` + `ds/Chip.css` | §3 |
| `OptionCard` | `ds/OptionCard.jsx` + `ds/OptionCard.css` | §4 |
| `Field` | `ds/Field.jsx` + `ds/Field.css` | §7 |
| `Panel` | `ds/Panel.jsx` + `ds/Panel.css` | §9 |
| `Banner` | `ds/Banner.jsx` + `ds/Banner.css` | §16 |

**为什么新建而不是改 `src/components/ui/`**：现有 `Button.jsx`（`--red` 主色 + 60 行）和 `index.jsx`（Card/Modal/Tag 等）**仍被多处引用**，直接改会引发连锁回归。新建平行组件，逐页迁移，**老组件在用完后再删**。

**验收**：起一个临时页面渲染 6 个组件的全部变体 × 全部状态，与 `20-components.md` 的状态表逐条对照。

### 步骤 1.2 — 改造首页 6 个参数面板

**目标文件**：`src/pages/Home/EcMode.jsx` + `src/pages/Home/ec/*.jsx`

| # | 改什么 | 现状 → 规范 | 文件:行号 |
|---|---|---|---|
| 1 | **面板宽度统一 480** | copy=520/sizing=460/settings=380/其余=420 → **480** | `EcMode.jsx:303` |
| 2 | **面板毛玻璃参数** | `blur(40px) saturate(220%)` → `blur(24px) saturate(180%)` | `EcMode.jsx:49` |
| 3 | **面板阴影** | 紫色 `rgba(124,58,237,.15)` + 冷灰 `rgba(0,0,0,.08)` → `--sb-shadow-4`（暖棕） | `EcMode.jsx:52` |
| 4 | **面板 z-index** | `101` → `--sb-z-panel`(400) | `EcMode.jsx:367` |
| 5 | **面板内套白卡** | `#fff` + `1.5px rgba(0,0,0,.08)` → `--sb-surface-tint` + `1.5px transparent` | `GenSettingsPanel.jsx:17-21` |
| 6 | **面板 header/footer** | 7 个面板全部没有 → 加 `.sb-panel__header` / `.sb-panel__footer` | 7 个面板 |
| 7 | **选项卡统一** | 圆角 10/10/6/8/8/9999 → **OptionCard 统一 12px** | `SizingPanel.jsx:237`、`StylePanel.jsx:117`、`ParamsPanel.jsx:75`、`EcPlatformPicker.jsx:117,50` |
| 8 | **分组标签统一** | marginBottom 4/6/8/10 四档、字重 700/900 混用 → `8px` / `700` / `--sb-ink-3` | `StylePanel.jsx:107`、`EcPlatformPicker.jsx:108`、`SizingPanel.jsx:229`、`ParamsPanel.jsx:54` |
| 9 | **状态横幅统一** | 4 处通栏 + `SkuPanel.jsx:37-52` 卡片 → **全部通栏** | `SizingPanel.jsx:204-225`、`SkuPanel.jsx:37-52` |
| 10 | **RatioSelect 下拉被裁剪** | `position: absolute; zIndex: 1000` 在 `overflow:auto` 面板内 → **Popover API / portal** | `SizingPanel.jsx:76-104` |
| 11 | **功能按钮 hover/selected 区分** | 两者视觉几乎相同 → hover 中性灰 / selected 品牌紫描边 | `EcMode.jsx:763-792` |
| 12 | **上传区语义色误用** | 产品图红框 `var(--red)` / 参考图蓝框 `var(--blue)` → 同为中性规格 | `EcMode.jsx:503,594` |
| 13 | **近黑三值统一** | `#1a1a1a` 硬编码 → `var(--sb-ink-1)` | `SizingPanel.jsx:239,276`、`StylePanel.jsx:119`、`ParamsPanel.jsx:76`、`DesignDirection.jsx:192,284,355` |
| 14 | **字段 label 四维统一** | 字号 11/12、字重 600/700、色 secondary/muted、marginBottom 3/4/5 → `Field` 组件统一 | `ParamsPanel.jsx:57`、`CopyPanel.jsx:4`、`SkuPanel.jsx:85`、`EcProductParams.jsx:26` |
| 15 | **表单边框宽度** | 1px / 1.5px 混用 → **1px** | `CopyPanel.jsx:9`、`ParamsPanel.jsx:9` |
| 16 | **语义色绕过 token** | `#16a34a`/`#22c55e`（绿）、`#e74c3c`/`#dc2626`（红）、`#d97706`/`#e67e22`（橙） → `--sb-{success,danger,warning}` | `SizingPanel.jsx:209,330`、`DesignDirection.jsx:223,244`、`SkuPanel.jsx:41,74` |

**风险**：中。面板是首页主路径，改动面广。
**缓解**：先改 `GenSettingsPanel.jsx`（最小、142 行）作为样板，验收通过后再批量。

**验收标准**：截图对比 + `10-visual-language.md` §17 检查清单逐条勾。

**回退**：面板文件各自独立，可单独 revert。

---

## 阶段 2 · 交互态全覆盖（解决"没状态"）

### 步骤 2.1 — 焦点环（P0 无障碍）

> **这是最高优先级**：`focus-visible` 在真实应用代码里出现 **0 次**（`grep -c` 实测），违反 WCAG 2.4.7（AA 级）。

| 动作 | 范围 |
|---|---|
| 给所有可交互元素加 `.sb-focusable` 类 | 11 个面板 + 导航 + 按钮 + 卡片 |
| 删除 10+ 处裸 `outline: 'none'` | `SizingPanel.jsx:307`、`ParamsPanel.jsx:10`、`CopyPanel.jsx:10`、`SkuPanel.jsx:6`、`EcSkuPanel.jsx:73,84,127`、`DesignDirection.jsx:436` |
| 把 80+ 处 `<div onClick>` 换成 `<button>` | `SizingPanel.jsx:234,274`、`StylePanel.jsx:114,156`、`EcRefImages.jsx:48,75,87` 等 |

**注意**：`EcPlatformPicker.jsx:46,72` 用了 `<button>` 但没重置 outline，会冒出**系统默认蓝色焦点环**——改造成 `.sb-focusable` 时一并处理。

**风险**：低（只加不改视觉，除非键盘操作）。
**验收**：纯键盘 Tab 走完首页 + 面板，焦点始终可见。

### 步骤 2.2 — disabled 真实化

| 现状 | 位置 | 改为 |
|---|---|---|
| `opacity: 0.4` + `pointerEvents: none`，但 `onClick` 仍挂着（键盘可触发） | `SkuPanel.jsx:122-123`、`DesignDirection.jsx:447` | 真 `disabled` 属性 或 `aria-disabled` + early return |

### 步骤 2.3 — hover 实现统一

**现状三种实现并存**：
1. 内联 `onMouseEnter` 改 style（`SizingPanel.jsx:244-245`、`StylePanel.jsx:123-124`、`SkuPanel.jsx:126-127`、`EcPlatformPicker.jsx:84-85`、`DesignDirection.jsx:383-384`）
2. 全局 CSS class（**7 个 ec/ 面板一个都没用**）
3. **完全缺失**（所有文本输入框、textarea、平台 pill 的未选态、上传块、方向卡）

**统一到**：**CSS `:hover` 伪类**（不是 JS 内联）。理由：① 性能 ② 可用 `:focus-visible` 并列 ③ 可被 `prefers-reduced-motion` 覆盖。

### 步骤 2.4 — loading 态

| 现状 | 位置 |
|---|---|
| 只有 2 处有 loading | `DesignDirection.jsx:481-482`（主按钮 spin）、`:439-451`（AI 润色） |
| 所有面板内按钮都不反映 SSE 进度 | 全部面板 |

**补**：所有提交类按钮都要有 loading（label 用 `visibility:hidden` 保位，宽度不跳）。

---

## 阶段 3 · 页面级统一

### 步骤 3.1 — 画布 `src/pages/EcCanvas/`

**参考**：剪映的浮层阶梯（`25-reference-teardown.md` §2.13）

| 改什么 | 依据 |
|---|---|
| 放大遮罩 `zIndex: 10001` → `--sb-z-modal`(810) | `EcCanvas/index.jsx:692` |
| 遮罩色 `rgba(0,0,0,0.75)` → `--sb-scrim-strong` `rgba(24,20,16,.62)` | 同上 |
| `ContextMenu.jsx` 圆角/阴影/内边距走 token | `EcCanvas/ContextMenu.jsx` |
| 浮动工具条规格统一（`.sb-overlay-bar`，blur 16px） | — |

### 步骤 3.2 — 作品集 / 定价 / 图库

| 页面 | 文件 | 重点 |
|---|---|---|
| 作品集 | `pages/Works/index.jsx` | 卡片规格、空态文案、栅格间距 |
| 定价 | `pages/Pricing/index.jsx` | 套餐卡片层级、推荐态（品牌紫）、主 CTA 唯一性 |
| 图库 | `pages/Gallery/index.jsx` | 覆盖文字 `.gallery-card-overlay` 的对比度 |
| 重制 | `pages/Remake/index.jsx` | 表单规格 |
| Plog | `pages/Plog/index.jsx` | 卡片与按钮规格 |

### 步骤 3.3 — 全局浮层

| 组件 | 文件 | 重点 |
|---|---|---|
| 弹窗 | `components/business/Modals.jsx` | 遮罩 `rgba(24,20,16,.44)`、圆角 20、进出场参数 |
| Toast | `components/ui/Toast.jsx` | **去掉整块彩色底**，改白底 + 图标色 |
| 模态 | `components/ui/index.jsx` | `zIndex: 999` → `--sb-z-modal`(810)；去掉 ghost-card |
| Popover | `components/ui/Popover.jsx` | `zIndex: 9999` → `--sb-z-dropdown`(600)；圆角 18 → 16 |
| 任务侧栏 | `components/task/TaskSidebar.jsx` | 宽度、列表项状态 |
| 加载 | `pages/Generate/Loading.jsx` + `App.jsx:301-305` | 全屏阻断 → 分步进度（参考 Runway） |

### 步骤 3.4 — 顶栏

| 问题 | 位置 | 改法 |
|---|---|---|
| **两套顶栏并存** | `App.jsx:118-199`（TopBar，实际渲染）vs `Navbar.jsx`（死代码） | **二选一**：删 `Navbar.jsx`，或接线它并删 `TopBar` |
| 顶栏按钮高 44 ✅ | `App.jsx:154,171,184` | 保持（= `--sb-control-h-xl`） |
| 字重 900/800 过多 | `App.jsx:77,98,157,175` | 降到 700（UI 控件上限） |
| 侧边导航毛玻璃 | `App.jsx:63` | 评估是否移除（Canva/Figma 零毛玻璃） |

---

## 阶段 4 · 清理与收口

### 步骤 4.1 — 合并三对平行实现

| 对 | 保留 | 删除 | 注意 |
|---|---|---|---|
| SKU | 待定（字段集不同：`capacity/dimLabel` vs `spec/label`） | 另一个 | **需先确认业务字段** |
| 产品参数 | 待定 | 另一个 | 两者都是 98 行，规格不同 |
| 设计方向 | `DesignDirection.jsx`（暖白，与全站一致） | `DesignDirectionView.jsx`（暗色 `#0f0f1a`，与全站冲突） | ⚠️ **需确认是否在用** |

### 步骤 4.2 — 删除死代码

| 文件 | 理由 |
|---|---|
| `src/components/layout/Navbar.jsx`（208 行） | `App.jsx:272` 渲染的是 `TopBar`，此文件从未被引用 |
| 老 `src/components/ui/Button.jsx` 等 | P0 组件迁移完成后 |
| `ParamsPanel.jsx:6` 的 `fontSize: 12` 基座 | 两处使用都覆盖成 11，是死代码 |
| `EcSkuPanel.jsx:87-95` 的 `transition` | 死代码（无对应可变化属性） |

### 步骤 4.3 — 移除渐变文字（gradient text）

> **impeccable 检测器实测判定**：`design-tokens.css:285-290` 的 `.hero-gradient-text`（`background: linear-gradient(...)` + `-webkit-background-clip: text`）被标记为 `gradient-text` 反模式——「装饰性而非表意，是典型的 AI 生成痕迹」。

**现状使用点**：`Home/index.jsx:43` —— `<span className="hero-gradient-text">视觉内容</span>`

**处理**：标题强调改用**字重或字号**表达，而不是渐变。
```diff
- <h1>AI 一键生成<span className="hero-gradient-text">视觉内容</span></h1>
+ <h1>AI 一键生成<span style={{ color: 'var(--sb-ink-brand)' }}>视觉内容</span></h1>
```

> 📌 这是**唯一**在 `design-tokens.css` 里被检测器标记的项；`design-tokens-v3.css` 本身已通过检测（`detect.mjs` 零命中）。
> 复现：`node .agents/skills/impeccable/scripts/detect.mjs src/styles/design-tokens.css`

### 步骤 4.4 — 修复 `EcRefImages.jsx:60`

> **用颜色字符串做条件判断来决定文案**——把语义色当状态机的键。一旦换色逻辑就崩。**必须改为语义布尔/枚举**。

---

## 3. 风险与回退总表

| 风险 | 概率 | 影响 | 缓解 | 回退 |
|---|---|---|---|---|
| `design-tokens-v3.css` 意外覆盖现有样式 | 低 | 高 | 文件只定义 `--sb-*` 和 `.sb-*`；现状无 `sb-` 前缀 class | 删除 import 一行 |
| 面板改造引发首页主流程回归 | 中 | 高 | 先改 `GenSettingsPanel.jsx` 作样板；**每改一个面板就截图验收** | 面板文件独立，单独 revert |
| 焦点环改造影响键盘操作 | 低 | 低 | 只加不删 | revert |
| 品牌主色决策（S1）选错 | 低 | 中 | token 化隔离——**只换 9 个值** | 改 `--sb-brand-*` |
| 合并平行实现丢失业务逻辑 | 中 | 高 | **先确认字段集与引用点**，不确认不合并 | 保留双份 |
| 删除"死代码"其实是动态引用 | 低 | 中 | 全局 grep 确认 + 保留 1 个 commit 周期 | revert |

---

## 4. 验收清单（每个阶段逐条勾）

### 通用（每步都查）

- [ ] 没有新增硬编码 hex
- [ ] 没有新增裸 z-index
- [ ] 间距全部在 4/8/12/16/20/24/32/40/48/64 内
- [ ] 圆角符合嵌套公式
- [ ] 默认态零品牌紫
- [ ] 每个可交互元素有 focus-visible
- [ ] disabled 真的禁用
- [ ] 12px 及以下文字对比度 ≥4.5:1
- [ ] 可点元素是 `<button>` 或带正确 role
- [ ] 面板宽 480 / 间距阶梯 / 字号阶梯 / 控件高 32-36-40 / 圆角 8-12-20 **未被破坏**

### 阶段级

| 阶段 | 关键验收 |
|---|---|
| **0** | 页面与改动前逐像素一致 |
| **1** | 6 个面板截图对比；面板宽统一 480；无白卡套白卡 |
| **2** | 纯键盘走完全流程，焦点始终可见；无"视觉禁用但可点"的控件 |
| **3** | 画布/作品/定价三页视觉一致；全站浮层阶梯符合 §15；毛玻璃 ≤3 处白名单 |
| **4** | `grep -c "focus-visible"` > 0；`grep -rn "99900\|9999\|99999"` = 0；平行实现只剩一份 |

---

## 4.5 自动化验证

```bash
node scripts/design-audit.mjs      # 只读，实时重算全部指标 + 输出落地进度看板
```

**每完成一个阶段跑一次**，把它作为验收的第一道关。脚本会明确告诉你哪一步还 ⬜ 未完成。

它校验的内容：

| 区块 | 检查项 |
|---|---|
| ① 碎片化 | hex 数量 / 字号档位 / 圆角档位 / z-index 裸值 / gap 非阶梯值占比 |
| ② 无障碍 | `focus-visible` 出现次数、裸 `outline:none` 处数、`<div onClick>` 处数、`prefers-reduced-motion` 处数 |
| ③ 白名单 | 使用 `backdrop-filter` 的文件清单、危险色被当作标识的处数 |
| ④ 对比度 | `design-tokens-v3.css` 里每个 `--sb-ink-*` 在白底与暖米白底上的实算对比度 |
| ⑤ 进度 | 对照本计划的阶段性 checklist（如"面板宽统一 480"会直接检测 `EcMode.jsx` 的 `baseWidth` 是否还在） |

**基线值（2026-09 首次运行）**：

```
hex 硬编码    1571 次 / 239 个不同值
字号          27 档
圆角          20 档
z-index       32 个裸值
gap 非阶梯    896/1540 (58%)
focus-visible 0 次          ← P0
outline:none  42 处
<div onClick> 133 处
reduced-motion 0 处
backdrop-filter 15 个文件    ← 白名单只允许 3 类场景
```

---

## 5. 时间与人力估算

| 阶段 | 工作量 | 说明 |
|---|---|---|
| **0** | 0.5 天 | 接线 + 6 个变量 + 拍板 S1 |
| **1** | 3–4 天 | 6 个组件（1.5 天）+ 7 个面板改造（2 天） |
| **2** | 2 天 | 焦点环 + disabled + hover 统一 + loading |
| **3** | 2–3 天 | 画布 + 3 个页面 + 6 个全局浮层 |
| **4** | 1 天 | 合并 + 清理 |

**合计 ≈ 9–11 人日**，分 5 个可独立验收的批次。

---

## 6. 最该先改的 5 个界面问题（按 ROI 排序）

| # | 问题 | 文件:行号 | 为什么先改 | 成本 |
|---|---|---|---|---|
| **1** | **面板宽度 4 档不一致**（copy=520/sizing=460/settings=380/其余=420） | `EcMode.jsx:303` | **一行改动**，立刻让 6 个面板对齐；是"看起来不成体系"的直接来源 | ⭐ 极低 |
| **2** | **面板内套白卡 + 毛玻璃过强**（`#fff` 卡片套在 `rgba(255,255,255,.85)` 面板里 + `blur(40px) saturate(220%)`） | `GenSettingsPanel.jsx:17-21`、`EcMode.jsx:49` | 老板说的"又丑又 low"的**视觉主因**——满屏小方框。改色阶即解决 | ⭐ 低 |
| **3** | **交互态几乎全缺**（`focus-visible` 全站 0 次；hover 三种实现；loading 只 2 处；"视觉禁用但可点"） | 11 个面板全部 | 老板说的"没状态"。**无障碍硬缺陷**（WCAG 2.4.7 AA） | ⭐⭐ 中 |
| **4** | **hover 与 selected 视觉几乎相同** | `EcMode.jsx:763-792` | 老板说的"选中态没有不同交互"。用户分不清面板是否打开 | ⭐ 低 |
| **5** | **语义色被当作身份标识**（产品图红框 vs 参考图蓝框；普通标签染紫） | `EcMode.jsx:503,594`、`GenSettingsPanel.jsx:43,67,79,101` | 一屏 4 种高饱和色抢注意力，是"廉价感"的第二来源 | ⭐ 低 |

> **建议路径**：先花 **半天** 做 #1 + #2 + #5（纯调参，零架构风险，视觉提升立竿见影），拿到老板确认后再投入 #3 + #4 + 阶段 1 的组件抽离。
