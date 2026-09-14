# 02 · 品牌紫升格为 Token + 165 处硬编码迁移清单

> **这份文件回答**：品牌紫怎么进 token 体系？165 处硬编码分别在哪个文件哪一行、该改成哪个 token？\`--accent\` 怎么办？
> **用途**：§3 的迁移清单是**改造 agent 的作业表**，精确到 \`文件:行\`，逐行可勾。
> **前置**：本清单与 \`01-brand-decision.md\` 的 D1 决策**解耦**——无论最终主色选红还是紫，本清单的**迁移动作完全一样**（只是 \`--sb-brand-*\` 的值不同）。所以**这份迁移可以立刻开工，不必等 D1 拍板**。

---

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


## 0. ⚠️ 重要：165 处在哪个分支

| 分支 | 硬编码紫 | 说明 |
|---|---|---|
| **`codex-ecommerce-stability`**（worktree） | **165 处 / 44 文件** | **本清单基于此分支**——V3 改造的实际战场 |
| `master` | 77 处 / 21 文件 | 落后，未包含画布 V3 改造 |

**本文件 §3 的 165 条清单，路径全部相对于 `.worktrees/codex-ecommerce-stability/`。**
改造 agent 必须在**该 worktree** 内作业；在 master 上执行会因行号错位而失败。

> 自查脚本 `node scripts/design-audit.mjs` 扫描的是**当前工作目录**。在 worktree 内运行才能看到 165 的基线。

---

## 1. 定量事实（复现你的 grep）

\`\`\`
搜索范围: src/  正则: #7c3aed|#6d28d9|#8b5cf6|#a855f7|#9333ea
命中行数: 165
命中 hex 次数: 171（同一行可能含 2 个 hex）
涉及文件: 44
\`\`\`

**结论**：品牌紫是**事实上的品牌色**，但**从未进过 token 体系**——它被硬编码在 44 个文件里。而设计系统里的 \`--accent\` 是近黑 \`#0C0A09\`。这就是「两套语言并存」的定量证据。

### 1.1 各 hex 的实际用量（实测，决定色阶取值）

| Hex | 实测次数 | 语义 | 角色 |
|---|---|---|---|
| **`#7c3aed`** | **133** | 主色 | **brand-600** |
| `#6d28d9` | 30 | 深一档 | **brand-700**（hover / pressed / 深色文字） |
| `#a78bfa` | 24 | 亮 | **brand-400**（渐变终点 / 浅色图标） |
| `#f5f3ff` | 19 | 浅底 | **brand-50** |
| `#8b5cf6` | 12 | 中亮 | **brand-500**（focus / processing） |
| `#ede9fe` | 10 | 浅底 | **brand-100** |
| `#c4b5fd` | 8 | 浅描边 | **brand-300** |
| `#ddd6fe` | 3 | 浅描边 | **brand-200** |
| `#5b21b6` | 2 | 深 | **brand-800** |
| `#a855f7` | 2 | 亮 | 并入 **brand-400** |
| `#4c1d95` | 1 | 最深 | **brand-900** |
| `#9333ea` | **0** | — | ⚠️ **代码里根本没有**，搜索正则含它是冗余的。保留 token 备用，**不需要迁移** |

**印证**：这套色阶的"自然落点"恰好是 Tailwind 的 `violet-600/700/500/400/50`，说明它本来就是**成体系**的，只是被散落地硬编码了。

### 1.2 ⚠️ 附带发现：rgba 透明度有 **45 个不同取值**

`rgba(124,58,237,α)` 的 α 实测分布：

| α 区间 | 取值 | 语义（推断） |
|---|---|---|
| .025 – .06 | `.025 .04 .05 .055 .06` | 极浅底 / 选中行 |
| **.08 – .12** | `.08 .10 .12` ← **最密集（约 25 次）** | **浅底 / 选中态底** |
| .13 – .18 | `.13 .14 .15 .16 .18` | 描边强调 / 轻阴影 |
| .20 – .28 | `.20 .22 .24 .25 .28` | 阴影 / ring |
| .30 – .45 | `.30 .32 .34 .35 .36 .38 .40 .45` | 强 ring / 强阴影 |
| .55 – .92 | `.55 .58 .62 .90 .92` | 遮罩 / 特殊 |

**收敛为 5 档**（命名用 `-a<两位alpha>`，**刻意避开已占用的 `--sb-brand-wash`/`--sb-brand-line`**——那两位是 §1 的实色别名，语义不同，同名会互相覆盖）：

| 语义 token | 值 | 吸收的 α |
|---|---|---|
| `--sb-brand-a05` | `rgba(124,58,237,0.05)` | .025 – .06 |
| `--sb-brand-a10` | `rgba(124,58,237,0.10)` | **.08 / .10 / .12**（最密集区间） |
| `--sb-brand-a18` | `rgba(124,58,237,0.18)` | .13 – .18 |
| `--sb-brand-a32` | `rgba(124,58,237,0.32)` | .20 – .45（含焦点环外发光） |
| `--sb-brand-a55` | `rgba(124,58,237,0.55)` | .55 – .92 |

> **45 个 α → 5 个语义档**。这是迁移中**最容易被忽略但收益很大**的一块：rgba 的碎片化比 hex 更隐蔽。

---

## 2. 品牌紫色阶（**从现有硬编码收敛，不新造**）

V3 已在 \`design-tokens-v3.css\` §1 定义完整色阶。**取值全部来自现有硬编码**：

| Token | 值 | 来源 | 用途 |
|---|---|---|---|
| \`--sb-brand-50\` | \`#F5F3FF\` | 现有 \`#f5f3ff\`(15次) | 选中态浅底 |
| \`--sb-brand-100\` | \`#EDE9FE\` | 现有 \`#ede9fe\`（PricingModal \`tint\`） | selected+hover 底 |
| \`--sb-brand-200\` | \`#DDD6FE\` | 现有 \`#ddd6fe\` | 选中描边（浅） |
| \`--sb-brand-300\` | \`#C4B5FD\` | 现有 \`#c4b5fd\`（CanvasWorkflowNodes:54 虚线） | 装饰描边 |
| \`--sb-brand-400\` | \`#A78BFA\` | 现有 \`#a78bfa\`(15次) | 渐变终点 / 浅色图标 |
| \`--sb-brand-500\` | \`#8B5CF6\` | 现有 \`#8b5cf6\` | **焦点环** / processing |
| \`--sb-brand-600\` | \`#7C3AED\` | **现有最多的硬编码** | **品牌主色** |
| \`--sb-brand-700\` | \`#6D28D9\` | 现有第 2 多 | **hover / pressed / 深色文字** |
| \`--sb-brand-800\` | \`#5B21B6\` | 现有 \`#5b21b6\` | active 压深 |
| \`--sb-brand-900\` | \`#4C1D95\` | 新增（色阶补全） | 深底上的文字 |

### 2.1 语义别名（**组件应该用这些，不是数字**）

| 语义 token | 指向 | 用于 |
|---|---|---|
| \`--sb-brand\` | \`--sb-brand-600\` \`#7C3AED\` | 主 CTA 实底、激活图标 |
| \`--sb-brand-strong\` | \`--sb-brand-700\` \`#6D28D9\` | hover 压深 |
| \`--sb-brand-soft\` | \`--sb-brand-50\` \`#F5F3FF\` | 选中态浅底 |
| \`--sb-brand-border\` | \`--sb-brand-200\` \`#DDD6FE\` | 选中态描边（浅） |
| \`--sb-sel-line\` | \`--sb-brand-600\` \`#7C3AED\` | 选中态**强**描边（1.5px） |
| \`--sb-ink-brand\` | \`--sb-brand-600\` \`#7C3AED\` | 品牌文字 / 图标 |
| \`--sb-brand-ring\` | \`rgba(124,58,237,0.32)\` | 焦点环外发光 |
| \`--sb-brand-wash\` | \`rgba(124,58,237,0.10)\` | 浅色底（rgba 系） |
| \`--sb-brand-gradient\` | \`linear-gradient(135deg,#7C3AED,#A78BFA)\` | 主 CTA 渐变 |

> ⚠️ 组件里**优先用语义别名**（\`--sb-ink-brand\`），数字刻度（\`--sb-brand-600\`）留给"确实需要特定档位"的场合。

---

> ## ✅ 行号复核（2026-09-15）
>
> 本作业表已按 **worktree 当前状态逐条复核**（165/165 条全部核对）：
>
> | 结果 | 条数 | 处理 |
> |---|---|---|
> | ✅ 行号准确 | **125** | 原样可用 |
> | ⏭️ **已迁移完成** | **39** | 该 hex 已不在文件中 → **可勾掉**（见下方标注） |
> | ⚠️ 行号已修正 | **15** | 已更新为当前行号 |
> | 📄 token 定义处 | 14 | **属定义而非使用处，请跳过不迁** |
>
> **修正结论：15 条行号已修正；39 条已由其他 agent 迁完。**
>
> ⚠️ **本块口径作废说明（2026-09-15 订正）**：上表四个数字相加为 **193 ≠ 165**（表自身笔误，无法自洽）。
> **请勿再用本块判断「还剩多少要做」**——行号会随并发提交持续漂移，逐条数行号本身就不是可靠口径。
>
> **现行权威口径 = 按「色值特征串」全库扫描**（`node scripts/design-ratchet.mjs` + 全库 grep 12 个品牌紫 hex 与 `rgba(124,58,237,α)`）：
> 排除 token 定义处后，剩余分布为 **`EcCanvas/**` ≈137、`Home/**` ≈100、`constants/data.js` 2（内容数据）、
> `NoteModal.jsx` 2、`Plog/index.jsx` 1（**JS 值，不应迁移**）**；**迁移线授权范围内已清零**。
>
> 📌 **JS 值 ≠ CSS 值（本表必须区分）**：形如 JSX 属性传色值（`referenceColor` 传 `#8b5cf6`）、
> `directionUiModel.js` 默认参数、`SupplementAssetDeck.jsx:46` 这类值，**在 JS 里 `var()` 不解析**；
> 像 `Plog/index.jsx:601` 还会把值拼接成「色值 + 20」当 alpha 用——**换成 `var(--x)` 会直接产出非法 CSS**。
> 这类一律按 §4.2 处理：**抽命名常量**，不要换 token。

## 3. ⭐ 165 处迁移清单（**作业表**）

> **分布汇总**：\`--sb-brand\` 39 · \`--sb-brand-700\` 29 · \`--sb-ink-brand\` 29 · \`--sb-brand-gradient\` 25 · \`--sb-brand-500\` 13 · \`--sb-sel-line\` 12 · \`--sb-brand-wash\` 11 · \`--sb-brand-ring\` 6 · \`--sb-brand-400\` 1
>
> **使用方式**：按文件从上到下改，每改完一个文件勾掉。**同一文件的改动应一次性提交**。

#### `styles/design-tokens-v3.css` — 14 处

> ⚠️ **本文件的条目是「定义处」而非「使用处」**——它们**不应被迁移**（迁了会破坏 token 体系本身）。
> 列入此表仅为**完整性与审计对照**。改造 agent **请跳过本文件**。

| 行 | 现值 | 说明 |
|---|---|---|
| L35 | `#8B5CF6` | `--sb-brand-500` 定义（品牌 500 档） |
| L36 | `#7C3AED` | `--sb-brand-600` 定义（品牌主色）**← 权威源，勿改** |
| L48 | `#7C3AED` | `--sb-brand-gradient` 定义 |
| L49 | `#7C3AED` | `--sb-brand-gradient-3` 定义 |
| L594 | `#7C3AED` | 兼容别名层 `--sb-brand-gradient` 定义 |
| L595 | `#7C3AED` | 兼容别名层 `--sb-brand-gradient-3` 定义 |
| L662 | `#7C3AED` | `[data-theme="dark"]` 下 `--sb-brand-400` |
| L664 | `#8B5CF6` | `[data-theme="dark"]` 下 `--sb-brand-600` |
| L728 | `#7C3AED` | `--sb-sel-line` 定义 |
| L729 | `#7C3AED` | `--sb-sel-ink` 定义 |
| L730 | `#7C3AED` | `--sb-sel-icon-bg` 定义 |
| L732 | `#7C3AED` | `--sb-sel-bar` 定义 |
| L760 | `#7C3AED` | `--sb-plan-active-line` 定义 |
| L956–958 | `#7C3AED` | `--sb-brand-gradient-hero/-logo/-soft` 定义（§20 拍板） |

#### `pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNodes.module.css` — 12 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L13 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.18 |
| L16 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L31 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.32 |
| L32 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L42 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L54 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L64 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L65 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L80 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L81 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L96 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L110 | `#7c3aed` | `--sb-brand` | 品牌实底 |

#### `pages/EcCanvas/index.jsx` — 12 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L414 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.25 |
| L423 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L433 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L434 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L442 | `rgba(124,58,237,0.08)` | `--sb-brand-a10` | 浅底 α=0.08 |
| L463 | `rgba(124,58,237,0.08)` | `--sb-brand-a10` | 浅底 α=0.08 |
| L517 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L7082 | `rgba(124,58,237,0.1)` | `--sb-brand-a10` | 浅底 α=0.1 |
| L7296 | `rgba(124,58,237,0.08)` | `--sb-brand-a10` | 浅底 α=0.08 |
| L7297 | `rgba(124,58,237,0.08)` | `--sb-brand-a10` | 浅底 α=0.08 |
| L7520 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L7578 | `rgba(124,58,237,0.12)` | `--sb-brand-a10` | 浅底 α=0.12 |

#### `pages/Home/ec/EcProfileRail.css` — 10 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L80 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L105 | `rgba(124,58,237,0.1)` | `--sb-brand-a10` | 浅底 α=0.1 |
| L130 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L200 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L228 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L277 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L285 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L286 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L397 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L427 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/EcCanvas/components/canvas-library.css` — 9 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L70 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L122 | `#7c3aed + #6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L123 | `#7c3aed` | `--sb-brand-500` | 焦点环 |
| L137 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L139 | `#7c3aed` | `--sb-brand-500` | 焦点环 |
| L222 | `#6d28d9` | `--sb-brand-gradient` | 渐变起点 |
| L226 | `#7c3aed` | `--sb-brand-500` | 焦点环 |
| L242 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.36 |
| L243 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

#### `pages/EcCanvas/EcCanvas.css` — 9 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L186 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L409 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |
| L441 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L531 | `rgba(124,58,237,0.16)` | `--sb-brand-a18` | 浅底 α=0.16 |
| L542 | `#7c3aed + #6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L545 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.1 |
| L664 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L1475 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L1508 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |

#### `pages/Home/VisualCreationMode.css` — 8 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L703 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L705 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L708 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L734 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L741 | `rgba(124,58,237,0.1)` | `--sb-brand-a10` | 浅底 α=0.1 |
| L746 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L761 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L763 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/Home/ec/DesignDirection.jsx` — 7 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L865 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L880 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L1016 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1050 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1059 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L1065 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1075 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/EcMode.jsx` — 7 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L1294 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1294 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L1294 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1294 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L1601 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |
| L1294 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L1294 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/ec/crossModeProductProfile.css` — 6 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L4 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L33 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L111 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L133 | `rgba(124,58,237,0.1)` | `--sb-brand-a10` | 浅底 α=0.1 |
| L207 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L236 | `#7c3aed` | `--sb-brand` | 品牌实底 |

#### `pages/Home/ec/ProductProfileShelf.css` — 6 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L41 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L50 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L119 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L202 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L207 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L208 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

#### `pages/EcCanvas/components/CanvasTemplateMarketplace.jsx` — 5 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L31 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L33 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L85 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L99 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L156 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `styles/canvas-supervisor.css` — 5 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L715 | `#7c3aed + #6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L719 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L720 | `#7c3aed + #6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L725 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L735 | `#7c3aed + #6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

#### `pages/Home/Home.css` — 4 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L296 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L525 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L859 | `#a855f7` | `--sb-brand-400` | 400 档（浅色装饰） |
| L1912 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |

#### `styles/pricing-modal.css` — 4 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L178 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L407 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L484 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L549 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

#### `components/ProjectAssetPicker.jsx` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L65 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L91 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L111 | `#7c3aed` | `--sb-brand` | 品牌实底 |

#### `pages/EcCanvas/WorkflowTemplateGallery.jsx` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L14 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L182 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L243 | `rgba(124,58,237,0.35)` | `--sb-brand-a32` | 外发光/阴影 α=0.35 |

#### `pages/Home/ec/components/directionUiModel.js` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L58 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L123 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L130 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Pricing/index.jsx` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L101 | `#8b5cf6` | `--sb-brand-gradient` | 渐变起点 |
| L104 | `#7c3aed + #a855f7` | `--sb-brand-gradient` | 渐变起点 |
| L204 | `#8b5cf6` | `--sb-brand-gradient` | 渐变起点 |

#### `styles/app-shell.css` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L333 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L345 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L359 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `styles/canvas-right-panel.css` — 3 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L362 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L375 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |
| L425 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `components/business/PricingModal.jsx` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L26 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |
| L29 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/EcCanvas/components/canvas-asset-picker.css` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L17 | `#7c3aed` | `--sb-brand-ring` | rgba 透明度 0.22 |
| L23 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |

#### `pages/Home/ec/resizable-textarea.css` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L8 | `#7c3aed` | `--sb-sel-line` | 选中/强调描边 |
| L27 | `#7c3aed` | `--sb-brand-500` | 焦点环 |

#### `pages/Home/ec/StylePanel.jsx` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L15 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |
| L24 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `pages/Remake/index.jsx` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L289 | `#7c3aed` | `--sb-brand` | 品牌实底 |
| L445 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `styles/design-tokens.css` — 2 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L295 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |
| L430 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `components/layout/Navbar.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L56 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `components/ui/Toast.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L27 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `constants/data.js` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L17 | `#8b5cf6` | `--sb-brand-gradient` | 渐变起点 |

#### `NoteModal.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L841 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/EcCanvas/canvasQuantvExtensions.js` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L499 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |

#### `pages/EcCanvas/components/CanvasChainOverlay.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L26 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/EcCanvas/components/CanvasContextMenuPanel.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L507 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |

#### `pages/EcCanvas/components/CanvasMinimap.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L159 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |

#### `pages/EcStudio/index.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L646 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/ec/components/SupplementAssetDeck.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L46 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/ec/crossModeProductProfile.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L56 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/ec/DesignDirectionView.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L144 | `#7c3aed` | `--sb-brand-gradient` | 渐变起点 |

#### `pages/Home/ec/model-pricing.css` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L16 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

#### `pages/Home/VisualCreationMode.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L125 | `#7c3aed` | `--sb-brand` | 品牌实底（默认归类） |

#### `pages/Home/XhsContentMode.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L130 | `#7c3aed` | `--sb-ink-brand` | 品牌文字/图标 |

#### `pages/Plog/index.jsx` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L601 | `#8b5cf6` | `--sb-brand-500` | 500 档（focus / 处理中） |

#### `styles/generate-cta.css` — 1 处

| 行 | 现值 | 改为 | 依据 |
|---|---|---|---|
| L33 | `#6d28d9` | `--sb-brand-700` | 深一档（hover/pressed/深色文字） |

---

## 3.5 ⭐ `rgba(124,58,237,α)` 的迁移（45 个 α → 5 个语义档）

> **这块不在你的 165 里**（正则只匹配 hex），但同属"品牌紫硬编码"，且碎片化更严重。**建议与 §3 同批处理**。

**迁移方式**：不按 α 数值机械替换，**按属性用途归类**：

| 用途（看属性名判断） | 原 α 范围 | 改为 |
|---|---|---|
| `background` 浅底 | .025–.12 | `--sb-brand-a10` |
| `border-color` 描边 | .13–.18 | `--sb-brand-a18` |
| `box-shadow` / `outline` | .20–.45 | `--sb-brand-ring` |
| 遮罩 / 大量覆盖 | .55–.92 | `--sb-brand-a55` |

**验证命令**：

```bash
grep -rEo 'rgba\(\s*124\s*,\s*58\s*,\s*237\s*,\s*[0-9.]+' src/ | wc -l
```

---

## 4. 迁移注意事项（改造 agent 必读）

### 4.1 五条硬规则

| # | 规则 | 理由 |
|---|---|---|
| **M1** | **先改 \`.css\` 文件，后改 \`.jsx\` 内联样式** | CSS 类可被全局替换验证；内联样式要改每一处 JS 对象 |
| **M2** | **rgba 系不要换成 hex** | \`rgba(124,58,237,.18)\` → \`--sb-brand-ring\` 这类语义别名，**不要**换成 \`--sb-brand\`（会丢掉透明度，视觉突变） |
| **M3** | **渐变保持渐变** | \`linear-gradient(135deg,#7c3aed,...)\` → \`--sb-brand-gradient\`，不要拆成纯色 |
| **M4** | **JS 常量/默认参数值要保留"可被覆盖"语义** | 如 \`directionUiModel.js:58\` 的 \`fallback = '#7c3aed'\` 是**函数默认参数**，改成 \`var(--sb-brand)\` 不生效（JS 读不到 CSS 变量）。应改为读 token 或用常量字符串 |
| **M5** | **\`design-tokens-v3.css\` 自身的 12 处不要改** | 那是**定义处**，不是使用处 |

### 4.2 ⚠️ 三个不能机械替换的地方

| 位置 | 问题 | 正确做法 |
|---|---|---|
| \`directionUiModel.js:58,123,130\`、\`crossModeProductProfile.jsx:56\`、\`SupplementAssetDeck.jsx:46\` | **JS 默认参数**——\`var(--sb-brand)\` 在 JS 里是无效值 | 用 \`getComputedStyle(document.documentElement).getPropertyValue('--sb-brand')\` 读，或抽一个 \`BRAND = '#7c3aed'\` 常量 |
| \`constants/data.js:17\` | 是**小红书文案的渐变字符串**（内容数据，不是 UI 样式） | **不改** |
| \`Navbar.jsx:56\`、\`EcStudio/index.jsx:646\` | 三色/双色渐变 logo 底 | 保留但收敛为 \`--sb-brand-gradient\`；\`EcStudio:646\` 的 \`#4338CA\` 是**靛蓝**，与品牌紫冲突，应统一 |

### 4.3 按文件类型的批次建议

| 批次 | 范围 | 文件数 | 处数 | 风险 |
|---|---|---|---|---|
| **批 1** | \`styles/*.css\`（全局样式） | 6 | ~26 | 中（影响面广，需截图对比） |
| **批 2** | \`pages/EcCanvas/**\`（画布，紫色最密集） | 12 | ~60 | 中高（画布是核心功能） |
| **批 3** | \`pages/Home/**\`（首页） | 12 | ~50 | 中 |
| **批 4** | \`components/**\` + 其余页面 | 14 | ~29 | 低 |
| **批 5** | \`design-tokens-v3.css\` 自身（**跳过**） | 1 | 12 | 跳过 |

---

## 5. \`--accent\` 在 V3 里的定位

### 5.1 结论：**你的倾向是对的，我同意并给出理由**

> **\`--accent\` 保留为中性强调，新增 \`--sb-brand-*\` 系列承载品牌色。不改 \`--accent\` 的指向。**

### 5.2 三条理由

**理由 1 — 语义不同，不该合流。**
\`--accent\` 的语义是「**强调**」，\`--brand\` 的语义是「**品牌**」。同一句代码里，\`border-color: var(--accent)\`（"这是重点"）和 \`background: var(--sb-brand)\`（"这是品牌动作"）是**两件事**。合流会让以后无法区分"想强调"和"想用品牌色"。

**理由 2 — 一次改指向 = 全站一次性变色，违背分批原则。**
实测 \`--accent\` 被引用 **56 次**，受影响面包括：所有 primary 按钮、导航选中态、**Logo 文字**、**h1/h2 标题**、积分数字、\`::selection\`。改一行全变，且**无法分批**。

**理由 3 — 保留 \`--accent\` 正好服务「近黑降级为中性强调」的定位。**
\`01-brand-decision.md\` §5 已定义近黑的 4 个合法场合（正文/标题、反色面、图标描边、中性强按钮）。\`--accent\` 恰好承载这些——**它不是废token，是"中性强调"的正确载体**。

### 5.3 V3 的最终定位表

| Token | V3 定位 | 用途 | 是否改动 |
|---|---|---|---|
| \`--accent\` | ✅ **保留，中性强调** | 正文/标题文字、反色面、图标描边、中性强按钮 | **改指向 ❌ 不改** |
| \`--accent-hover\` | ✅ 保留 | 中性强按钮 hover | 不改 |
| \`--accent-muted\` | ✅ 保留 | 次要中性文字 | 不改 |
| \`--accent-bg\` | ⚠️ **改指向** | 从 \`rgba(12,10,9,.06)\` → \`--sb-surface-tint\` | 低风险（同色系） |
| \`--sb-brand-*\` | 🆕 **新增** | 品牌紫全套（§2 表） | 新增，不动老 token |
| \`--sb-ink-brand\` 等语义别名 | 🆕 新增 | 组件实际引用这些 | 新增 |

> **关键**：老 token **一个都不删、不改指向**。新增 \`--sb-*\` 系列，组件**逐步迁移**过去。当 165 处全部迁完、且确认无引用后，老 token 自然"退居二线"（仍可保留兼容）。

### 5.4 与 D1 决策的关系

| 若 D1 选… | 迁移动作 | 额外工作 |
|---|---|---|
| **A 品牌红** | 165 处**照本清单迁移**（先迁到 \`--sb-brand-*\`），然后**只改 §2 色阶的 10 个值**为红色系 | 改 token 值，不动组件 |
| **B 紫** | 165 处**照本清单迁移** | **零额外工作**——紫色阶已经是最终形态 |
| **C 近黑** | 165 处**照本清单迁移**，然后把色阶值改近黑 | 会退回"黑白极简"，不推荐 |

> **这就是本清单的价值**：**它把"颜色决策"和"代码迁移"解耦了**。无论 D1 怎么定，165 处的迁移动作完全一致——所以**迁移可以立刻开工，不必等拍板**。

---

## 6. 落地步骤

\`\`\`
Step 1  确认 design-tokens-v3.css §1 色阶取值与现有硬编码一致（本文件 §2 已核对）
Step 2  按批 1→批 4 顺序迁移 165 处，每批独立 commit + 截图对比
Step 3  每批完成后跑 node scripts/design-audit.mjs 验证紫色硬编码数下降
Step 4  全部迁完后，确认无 --accent 引用被误改（应保持 0 变化）
\`\`\`

### 6.1 验证命令

\`\`\`bash
# 迁移进度（应从 165 降到 0）
grep -rEo '#7c3aed|#6d28d9|#8b5cf6|#a855f7|#9333ea' src/ | wc -l
\`\`\`

> ⚠️ **不要一次性全改**。165 处跨 44 文件，一次改完无法定位回归来源。按 §4.3 的 4 个批次推进。
