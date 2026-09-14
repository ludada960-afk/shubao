# 10 · 视觉语言规范（Visual Language）

> **这份文件回答**：确切用什么值。每一个 token 给出**取值 / 用途 / 禁止用法**。
> **谁该读**：任何要写 CSS 或内联 style 的人 / agent。
> **机器可读版本**：`src/styles/design-tokens-v3.css`（本文件的唯一实现）
> **上游**：`00-principles.md`（为什么）

---

> ## 🔒 决策口径（**唯一权威：`40-decisions.md`**）
>
> 本文档中的一切规则，若与 `docs/design/40-decisions.md` 的 **D1–D12** 冲突，**以 D-decisions 为准**。
> 本文档**引用 D 编号，不另立说法**。
>
> | 编号 | 决策 | 与本文档的对应 |
> |---|---|---|
> | **D1** | 主色 = 品牌紫 `--sb-brand-600`（近黑降为中性强调；**不直接改 V2 `--accent`**） | §2A / §A.1 品牌色 |
> | **D1-补** | 品牌红 `#FB5358` = **标识色**（logo/吉祥物/hero/空态），**不接管交互主色** | §2A A 类清单 |
> | **D2** | 选中态统一用 **ring**（`--sb-shadow-ring`，不改边框宽度 → 零布局抖动）+ 三件套；**hover 与 selected 必须视觉不同** | §2C 选中态三件套 |
> | **D3** | 靛蓝 `#6366F1`/`#4338CA`/`#EEF2FF` 系 = **历史遗留，全部迁往品牌紫** | §B 迁移表「靛蓝→品牌紫」 |
> | **D4** | 覆盖层用**暖黑** `rgba(12,10,9,α)`，**纯黑退役** | §6 边框 / §11 阴影 |
> | **D5** | 改造顺序：**接 token → 色相替换 → surface 分层 → 尺寸统一**（**严禁反序**） | — |
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


# §A · V3 Token 权威对照表

> **唯一权威源**：\`src/styles/design-tokens-v3.css\`（**总统筹落定并提交 \`12133cb0\`**）。
> 本表**由该文件自动提取**（light \`:root\` 首次定义优先），变量名与取值**与其完全一致**。
> ⚠️ **本规范不得改写 token 名或取值**——只解释「用途 / 禁止用法」。改值需评审（见 §A.9）。
>
> 已接入：\`src/main.jsx:5\`（在 \`design-tokens.css\` 之后、\`theme.css\` 之前）。

## §A.0 统计

| 项 | 值 |
|---|---|
| 文件行数 | 959 |
| 含 dark 覆盖的 token 定义总数 | 362 |
| light \`:root\` 首次定义数 | 220 |
| 深色主题覆盖 | ✅ \`[data-theme="dark"]\`（1 个块） |

## §A.1–§A.16 逐 token 对照


### §1 色板 · 品牌

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-brand-50` | `#F5F3FF` | 选中态浅底 / 品牌 wash | 大段文字底（太浅） |
| `--sb-brand-100` | `#EDE9FE` | selected+hover 底 | — |
| `--sb-brand-200` | `#DDD6FE` | 浅描边（选中态弱描边） | 强描边（对比不足） |
| `--sb-brand-300` | `#C4B5FD` | 装饰描边 | 正文文字 |
| `--sb-brand-400` | `#A78BFA` | 渐变终点 / 大号装饰图标 | 小字号文字（2.72:1 不达标） |
| `--sb-brand-500` | `#8B5CF6` | **焦点环** / processing 状态 | 大面积实底 |
| `--sb-brand-600` | `#7C3AED` | **品牌主色**：主 CTA 实底 / 选中文字 / 激活图标 | 装饰性铺色 |
| `--sb-brand-700` | `#6D28D9` | hover 压深 / 深色品牌文字 | — |
| `--sb-brand-800` | `#5B21B6` | active 按下 | — |
| `--sb-brand-900` | `#4C1D95` | 深底上的文字 | —— |
| `--sb-brand` | `var(--sb-brand-600) → #7C3AED` | 品牌主色（= brand-600） | 默认态（未选中/未激活）**禁止**使用 |
| `--sb-brand-strong` | `var(--sb-brand-700) → #6D28D9` | primary hover | 默认态 |
| `--sb-brand-soft` | `#F5F3FF` | **选中态浅底**（= brand-50） | 不要指向 400（曾有覆盖 bug，见文件注释） |
| `--sb-brand-border` | `#C4B5FD` | 选中态浅描边 | 文字 |
| `--sb-brand-ring` | `rgba(124, 58, 237, 0.32)` | 焦点环外发光 / ring | 装饰 |
| `--sb-brand-shadow` | `0 2px 8px rgba(124, 58, 237, 0.16)` | 选中项微投影 | 静态元素 |
| `--sb-brand-shadow-lg` | `0 6px 20px rgba(124, 58, 237, 0.24)` | primary 按钮投影 | 静态元素 |
| `--sb-brand-gradient` | `linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)` | **品牌时刻专用**：logo | 功能按钮（裁定 2 禁止） |
| `--sb-brand-gradient-3` | `linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)` | **仅 logo / hero / 空态插画** | **功能按钮、控件、卡片（裁定 2 明令禁止）** |
| `--sb-brand-a05` | `rgba(124, 58, 237, 0.05)` |  |  |
| `--sb-brand-a10` | `rgba(124, 58, 237, 0.10)` |  |  |
| `--sb-brand-a18` | `rgba(124, 58, 237, 0.18)` |  |  |
| `--sb-brand-a32` | `rgba(124, 58, 237, 0.32)` |  |  |
| `--sb-brand-a55` | `rgba(124, 58, 237, 0.55)` |  |  |

### §2 色板 · 中性

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-neutral-0` | `#FFFFFF` |  |  |
| `--sb-neutral-25` | `#FDFBF7` |  |  |
| `--sb-neutral-50` | `#FAF7F2` |  |  |
| `--sb-neutral-100` | `#F5F1EA` |  |  |
| `--sb-neutral-150` | `#EFEAE1` |  |  |
| `--sb-neutral-200` | `#E7E3DD` |  |  |
| `--sb-neutral-300` | `#D6D1C9` |  |  |
| `--sb-neutral-400` | `#B0AAA5` |  |  |
| `--sb-neutral-500` | `#9A9490` |  |  |
| `--sb-neutral-600` | `#6B6560` |  |  |
| `--sb-neutral-700` | `#3D3835` |  |  |
| `--sb-neutral-800` | `#1A1614` |  |  |
| `--sb-neutral-900` | `#0C0A09` |  |  |

### §3 色板 · 表面

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-surface-page` | `var(--sb-neutral-50) → #FAF7F2` | L0 页面底 | — |
| `--sb-surface-panel` | `rgba(255, 255, 255, 0.85)` | L1 浮层面板（必须配毛玻璃） | 卡片 |
| `--sb-surface-panel-solid` | `#FFFFFF` |  |  |
| `--sb-surface-card` | `#FFFFFF` | L2 卡片 | **面板内部**（L1 内放白卡 = 不可辨，原则 3.2） |
| `--sb-surface-sunken` | `var(--sb-neutral-150) → #EFEAE1` | L2- 凹槽 / 输入框底 | 卡片 |
| `--sb-surface-tint` | `rgba(12, 10, 9, 0.03)` | L3 面板内选中行 / 分组底 | 大面积背景 |
| `--sb-surface-tint-strong` | `rgba(12, 10, 9, 0.06)` | L3 hover 态 | — |
| `--sb-surface-inverse` | `var(--sb-neutral-900) → #0C0A09` | L4 反色面（深色 chip / CTA） | 正文背景 |

### §4 色板 · 文字

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-ink-1` | `var(--sb-neutral-800) → #1A1614` | 标题 / 关键数值 | — |
| `--sb-ink-2` | `var(--sb-neutral-700) → #3D3835` | 正文默认 | — |
| `--sb-ink-3` | `var(--sb-neutral-600) → #6B6560` | 辅助说明 / 分组标签 / **placeholder** | — |
| `--sb-ink-4` | `var(--sb-neutral-500) → #9A9490` | 提示（**仅 ≥14px 粗体或大图标**） | **12px 正文**（2.99:1 不达标） |
| `--sb-ink-5` | `var(--sb-neutral-400) → #B0AAA5` | **仅 disabled** | 任何可读内容 |
| `--sb-ink-on-dark` | `#FFFFFF` |  |  |
| `--sb-ink-brand` | `var(--sb-brand-600) → #7C3AED` | 品牌动作文字 / 链接 | 装饰 |
| `--sb-ink-danger` | `#D0443C` | 错误 / 删除文字 | 普通强调 |
| `--sb-ink-success` | `#2F7D46` | 成功文字 | 普通强调 |
| `--sb-ink-warning` | `#B45309` | 警告文字 | 普通强调 |
| `--sb-ink-info` | `#3B5BA5` | 信息文字 | 普通强调 |

### §5 色板 · 语义状态

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-danger` | `#E8544B` |  |  |
| `--sb-danger-hover` | `#D0443C` |  |  |
| `--sb-danger-soft` | `#FEF2F0` |  |  |
| `--sb-danger-border` | `#F6C9C4` |  |  |
| `--sb-danger-ring` | `rgba(232, 84, 75, 0.30)` |  |  |
| `--sb-success` | `#5CA86C` |  |  |
| `--sb-success-hover` | `#4A9059` |  |  |
| `--sb-success-soft` | `#F0F9F2` |  |  |
| `--sb-success-border` | `#C3E3CB` |  |  |
| `--sb-success-ring` | `rgba(92, 168, 108, 0.30)` |  |  |
| `--sb-warning` | `#E08A2E` |  |  |
| `--sb-warning-hover` | `#C6761F` |  |  |
| `--sb-warning-soft` | `#FDF6EC` |  |  |
| `--sb-warning-border` | `#F2D9B0` |  |  |
| `--sb-warning-ring` | `rgba(224, 138, 46, 0.30)` |  |  |
| `--sb-info` | `#5275CC` |  |  |
| `--sb-info-hover` | `#4262B4` |  |  |
| `--sb-info-soft` | `#F0F4FD` |  |  |
| `--sb-info-border` | `#C2D0EE` |  |  |
| `--sb-info-ring` | `rgba(82, 117, 204, 0.30)` |  |  |

### §6 边框

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-border-subtle` | `rgba(12, 10, 9, 0.06)` |  |  |
| `--sb-border-default` | `rgba(12, 10, 9, 0.10)` |  |  |
| `--sb-border-strong` | `rgba(12, 10, 9, 0.16)` |  |  |
| `--sb-border-focus` | `var(--sb-brand-500) → #8B5CF6` |  |  |
| `--sb-border-inverse` | `rgba(255, 255, 255, 0.70)` |  |  |

### §7 排版

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-font-mono` | `'SF Mono', 'Fira Code', ui-monospace, monospace` |  |  |
| `--sb-text-2xs` | `10px` |  |  |
| `--sb-text-xs` | `11px` |  |  |
| `--sb-text-sm` | `12px` |  |  |
| `--sb-text-md` | `13px` |  |  |
| `--sb-text-lg` | `15px` |  |  |
| `--sb-text-xl` | `18px` |  |  |
| `--sb-text-2xl` | `24px` |  |  |
| `--sb-text-3xl` | `32px` |  |  |
| `--sb-text-4xl` | `48px` |  |  |
| `--sb-weight-regular` | `400` |  |  |
| `--sb-weight-medium` | `500` |  |  |
| `--sb-weight-semibold` | `600` |  |  |
| `--sb-weight-bold` | `700` |  |  |
| `--sb-weight-heavy` | `800` |  |  |
| `--sb-leading-tight` | `1.25` |  |  |
| `--sb-leading-snug` | `1.4` |  |  |
| `--sb-leading-normal` | `1.5` |  |  |
| `--sb-leading-relaxed` | `1.65` |  |  |
| `--sb-tracking-tight` | `-0.01em` |  |  |
| `--sb-tracking-normal` | `0` |  |  |
| `--sb-tracking-label` | `0.02em` |  |  |

### §8 间距

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-space-0` | `0` |  |  |
| `--sb-space-1` | `4px` |  |  |
| `--sb-space-2` | `8px` |  |  |
| `--sb-space-3` | `12px` |  |  |
| `--sb-space-4` | `16px` |  |  |
| `--sb-space-5` | `20px` |  |  |
| `--sb-space-6` | `24px` |  |  |
| `--sb-space-8` | `32px` |  |  |
| `--sb-space-10` | `40px` |  |  |
| `--sb-space-12` | `48px` |  |  |
| `--sb-space-16` | `64px` |  |  |

### §9 圆角

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-radius-xs` | `4px` |  |  |
| `--sb-radius-sm` | `6px` |  |  |
| `--sb-radius-md` | `8px` |  |  |
| `--sb-radius-lg` | `12px` |  |  |
| `--sb-radius-xl` | `16px` |  |  |
| `--sb-radius-2xl` | `20px` |  |  |
| `--sb-radius-3xl` | `24px` |  |  |
| `--sb-radius-pill` | `9999px` |  |  |
| `--sb-radius-nested-outer` | `var(--sb-radius-2xl) → 20px` |  |  |
| `--sb-radius-nested-inner` | `var(--sb-radius-lg) → 12px` |  |  |

### §10 阴影 / 海拔

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-shadow-0` | `none` |  |  |
| `--sb-shadow-1` | `0 1px 2px rgba(57, 45, 26, 0.05)` |  |  |
| `--sb-shadow-3` | `0 4px 16px rgba(57, 45, 26, 0.10)` |  |  |
| `--sb-shadow-inset-top` | `inset 0 1px 0 rgba(255, 255, 255, 0.90)` |  |  |
| `--sb-shadow-ring` | `0 0 0 3px var(--sb-brand-ring) → `0 0 0 3px rgba(124, 58, 237, 0.32)` |  |  |

### §11 毛玻璃

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-blur-nav` | `24px` |  |  |
| `--sb-blur-panel` | `24px` |  |  |
| `--sb-blur-bar` | `16px` |  |  |
| `--sb-blur-overlay` | `4px` |  |  |
| `--sb-saturate-glass` | `180%` |  |  |
| `--sb-scrim-weak` | `rgba(24, 20, 16, 0.24)` |  |  |
| `--sb-scrim` | `rgba(24, 20, 16, 0.44)` |  |  |
| `--sb-scrim-strong` | `rgba(24, 20, 16, 0.62)` |  |  |

### §12 控件尺寸

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-control-h-xs` | `24px` |  |  |
| `--sb-control-h-sm` | `28px` |  |  |
| `--sb-control-h-md` | `32px` |  |  |
| `--sb-control-h-lg` | `36px` |  |  |
| `--sb-control-h-xl` | `44px` |  |  |
| `--sb-control-px-sm` | `10px` |  |  |
| `--sb-control-px-md` | `14px` |  |  |
| `--sb-control-px-lg` | `18px` |  |  |
| `--sb-control-px-xl` | `24px` |  |  |
| `--sb-tap-min` | `44px` |  |  |

### §12b 悬停位移预留

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-lift-btn` | `3px` | 按钮 hover 位移预留 | — |
| `--sb-lift-card` | `5px` |  |  |
| `--sb-lift-card-lg` | `9px` |  |  |
| `--sb-lift-safe-x` | `8px` |  |  |
| `--sb-lift-safe-y` | `16px` |  |  |

### §13 布局

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-panel-w` | `480px` |  |  |
| `--sb-panel-w-wide` | `560px` |  |  |
| `--sb-panel-max-h` | `min(70vh, 640px)` |  |  |
| `--sb-panel-offset` | `8px` |  |  |
| `--sb-nav-h` | `72px` |  |  |
| `--sb-nav-pad-top` | `16px` |  |  |
| `--sb-content-max` | `1240px` |  |  |
| `--sb-wide-max` | `1680px` |  |  |
| `--sb-gutter` | `20px` |  |  |

### §14 动效

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |  |  |
| `--sb-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |  |  |
| `--sb-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |  |  |
| `--sb-dur-instant` | `100ms` |  |  |
| `--sb-dur-fast` | `150ms` |  |  |
| `--sb-dur-normal` | `200ms` |  |  |
| `--sb-dur-slow` | `300ms` |  |  |
| `--sb-dur-slower` | `400ms` |  |  |
| `--sb-duration-instant` | `var(--sb-dur-instant) → 100ms` |  |  |
| `--sb-duration-fast` | `var(--sb-dur-fast) → 150ms` |  |  |
| `--sb-duration-normal` | `var(--sb-dur-normal) → 200ms` |  |  |
| `--sb-duration-slow` | `var(--sb-dur-slow) → 300ms` |  |  |
| `--sb-duration-slower` | `var(--sb-dur-slower) → 400ms` |  |  |

### §15 层级

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-z-base` | `0` |  |  |
| `--sb-z-raised` | `10` |  |  |
| `--sb-z-sticky` | `100` |  |  |
| `--sb-z-panel` | `400` | 参数浮层面板 | — |
| `--sb-z-dropdown` | `600` | 下拉菜单（必须 > panel） | — |
| `--sb-z-scrim` | `800` |  |  |
| `--sb-z-modal` | `810` |  |  |
| `--sb-z-toast` | `900` |  |  |
| `--sb-z-tooltip` | `950` |  |  |
| `--sb-z-top` | `1000` |  |  |

### §16 焦点环

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-focus-ring-w` | `2px` |  |  |
| `--sb-focus-ring-offset` | `2px` |  |  |
| `--sb-focus-ring-color` | `var(--sb-brand-500) → #8B5CF6` |  |  |

### §17 基础实现类

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-brand-hover` | `var(--sb-brand-700) → #6D28D9` |  |  |
| `--sb-brand-active` | `#5B21B6` |  |  |
| `--sb-brand-wash` | `var(--sb-brand-50) → #F5F3FF` |  |  |
| `--sb-brand-line` | `var(--sb-brand-200) → #DDD6FE` |  |  |
| `--sb-brand-ink` | `#FFFFFF` |  |  |
| `--sb-text-primary` | `var(--sb-ink-1) → #1A1614` |  |  |
| `--sb-text-secondary` | `var(--sb-ink-2) → #3D3835` |  |  |
| `--sb-text-muted` | `var(--sb-ink-3) → #6B6560` |  |  |
| `--sb-text-hint` | `var(--sb-ink-4) → #9A9490` |  |  |
| `--sb-text-faint` | `var(--sb-ink-5) → #B0AAA5` |  |  |
| `--sb-text-brand` | `var(--sb-ink-brand) → #7C3AED` |  |  |
| `--sb-text-on-inverse` | `var(--sb-ink-on-dark) → #FFFFFF` |  |  |
| `--sb-radius-panel` | `var(--sb-radius-2xl) → 20px` |  |  |
| `--sb-radius-card` | `var(--sb-radius-lg) → 12px` |  |  |
| `--sb-radius-control` | `var(--sb-radius-md) → 8px` |  |  |
| `--sb-radius-chip` | `var(--sb-radius-sm) → 6px` |  |  |
| `--sb-control-sm` | `var(--sb-control-h-sm) → 28px` |  |  |
| `--sb-control-md` | `var(--sb-control-h-md) → 32px` |  |  |
| `--sb-control-lg` | `var(--sb-control-h-lg) → 36px` |  |  |
| `--sb-control-touch` | `var(--sb-control-h-xl) → 44px` |  |  |
| `--sb-control-min-w` | `88px` |  |  |
| `--sb-panel-padding` | `var(--sb-space-5) → 20px` |  |  |
| `--sb-group-gap` | `var(--sb-space-5) → 20px` |  |  |
| `--sb-field-gap` | `var(--sb-space-2) → 8px` |  |  |
| `--sb-action-gap` | `var(--footer-actions-gap, var(--sb-space-3)) → var(--footer-actions-gap, 12px)` | **底部操作区按钮间距 12px** | <8px 或 >16px |
| `--sb-state-hover-bg` | `rgba(12, 10, 9, 0.035)` |  |  |
| `--sb-state-active-bg` | `rgba(12, 10, 9, 0.06)` |  |  |
| `--sb-state-selected-bg` | `var(--sb-brand-50) → #F5F3FF` |  |  |
| `--sb-state-selected-line` | `var(--sb-brand-200) → #DDD6FE` |  |  |
| `--sb-state-selected-ink` | `var(--sb-brand-600) → #7C3AED` |  |  |
| `--sb-state-disabled-bg` | `rgba(12, 10, 9, 0.04)` |  |  |
| `--sb-state-disabled-ink` | `var(--sb-ink-5) → #B0AAA5` |  |  |
| `--sb-focus-ring` | `var(--sb-shadow-ring) → 0 0 0 3px rgba(124, 58, 237, 0.32)` |  |  |

---

## 1. 使用方式

### 1.1 引入（一行，由落地 agent 执行）

```diff
  // src/main.jsx
  import './styles/design-tokens.css';
+ import './styles/design-tokens-v3.css';      // 必须在 design-tokens.css 之后
```

### 1.2 三条铁律

| # | 规则 |
|---|---|
| 1 | **新代码只用 `--sb-*`。** 老代码里已有的 `--text-muted` / `--accent` 等不强制替换，但**新写的样式不得引用它们**——否则新老体系继续分裂。 |
| 2 | **禁止硬编码 hex。** 现状 208 个不同 hex / 1568 次硬编码，是碎片化的根源。需要新颜色时，先问「这个语义在 token 表里对应哪个」，找不到就提 PR 加 token，别就地写 hex。 |
| 3 | **删除 `design-tokens-v3.css` 后，全站渲染必须与今天完全一致。** 这是零回归保证，也是本文件「纯新增」的验收标准。 |

### 1.3 命名约定

```
--sb-{类别}-{名称}[-{变体}]        CSS 变量
.sb-{block}__{element}--{modifier}  组件类（BEM）
.sb-{utility}                       工具类
```

组件类前缀统一 `sb-`。**现状代码里没有任何 `sb-` 前缀的 class**，所以新增的类绝不会误命中现有 DOM。


---

# §2A–§2E · 视觉语言五条铁律

> **本节解决的核心矛盾**：\`GenSettingsPanel.jsx\` **已经**在走面板视觉规范（间距/字号/控件高/圆角全部走 \`panelVisualLanguage.js\` 常量），却依然被用户点名为「最丑」。
> **根因不是间距，是颜色与层级体系缺失。** 实测证据见下方各条。
> **证据基线**：\`.worktrees/codex-ecommerce-stability\` 分支（\`cd132359\`），token 权威源 \`src/styles/design-tokens-v3.css\`。

---

## §2A · 铁律一：品牌色用在哪（穷举清单）

### 先说病根：两个极端的摇摆

这个面板经历过一次**矫枉过正**：

| 阶段 | 做法 | 结果 | 证据 |
|---|---|---|---|
| **改前** | 到处铺紫：普通分组标签的图标染紫、选项选中用紫色渐变背景 + 紫色阴影、hover 也用紫 | 「紫色通货膨胀」——品牌色失去稀缺性，用户分不清「选中」和「悬停」 | 原 \`GenSettingsPanel.jsx:52-54\`（\`linear-gradient(135deg, rgba(124,58,237,0.06)...)\` + \`boxShadow: 0 2px 8px rgba(124,58,237,0.12)\`） |
| **改后** | 全面中性：选中态改 \`#1F1D1A\` 近黑描边 + 4.5% 淡灰底，注释写明「紫只用于已调整徽标与图标」 | 「黑白极简」——整个面板白底黑字灰描边，**没有任何品牌色/语义色**，与网站暖米白 + 品牌紫基调脱节 | 用户批注 + 现文件 \`:127-129\` 用 \`--sb-state-selected-*\` |

> **结论**：不是「该不该用紫」的二选一，而是**缺一张明确的分配表**。下表就是那张表。

### 穷举分配表（**16 个场合，逐一定性**）

#### A 类 · 必须用品牌紫（品牌紫的正当使用，共 8 处）

| # | 场合 | 取值 | 为什么必须是品牌色 |
|---|---|---|---|
| A1 | **主 CTA 填充按钮**（每屏唯一） | 底 \`--sb-brand\` \`#7C3AED\`，字 \`#FFF\` | 用户此刻唯一该做的事。这是品牌色最重要的用途 |
| A2 | **选中态描边** | \`1.5px --sb-sel-line\` \`#7C3AED\` | 「选中」是全站最高频的状态语义，必须有稳定的品牌识别 |
| A3 | **选中态文字 / 图标** | \`--sb-sel-ink\` \`#7C3AED\` | 与描边同一信号，缺一则选中反馈弱 |
| A4 | **选中态图标底座** | 底 \`--sb-brand\` + 图标 \`#FFF\` | 图形化强化，用于「图标 + 名称 + 描述」三段式选项 |
| A5 | **focus 焦点环** | \`2px --sb-brand-500\` \`#8B5CF6\`，offset 2px | 键盘用户的唯一导航线索。用品牌色让「焦点」也带品牌识别 |
| A6 | **链接 / 可点文字** | \`--sb-ink-brand\` \`#7C3AED\` | 可点性信号，5.70:1 达标 |
| A7 | **进度 / 强调数字** | \`--sb-ink-brand\` | 「共 **12** 张」里的 12。数据高亮是三种合法彩色字之一 |
| A8 | **当前套餐 / 推荐档** | 底 \`--sb-plan-active-bg\` + 描边 \`--sb-plan-active-line\` | 定价页的「推荐」是品牌主张 |

#### B 类 · 必须中性（**禁止**用品牌紫，共 8 处）

| # | 场合 | 取值 | 为什么禁止品牌色 |
|---|---|---|---|
| B1 | **分组标题**（「生图模型」「清晰度」） | \`--sb-ink-3\` \`#6B6560\` + 中性图标 | **层级信息，不是品牌动作**。改前把 \`Monitor/Gauge/Ban\` 图标染紫是明确禁止项 |
| B2 | **字段标签** | \`--sb-ink-2\` \`#3D3835\` | 同上 |
| B3 | **选项默认态** | 底 \`--sb-l3-option\` \`#F4F4F4\` + 字 \`--sb-ink-1\` | **默认 = 未锁定 = 零品牌色**（铁律 6.3） |
| B4 | **hover 态** | 底 \`--sb-hover-bg\` \`#EDEDED\` | hover 与 selected 必须走**不同通道**；hover 抢用品牌色 → 选中失去增量 |
| B5 | **辅助说明 / 描述语** | \`--sb-ink-3\` | 层级信息 |
| B6 | **图标底座（未选中）** | 底 \`--sb-l2-inset\` \`#F2F2F1\`，图标 \`--sb-text-muted\` | 底座是容器不是动作 |
| B7 | **金额数字** | \`--sb-amount\` \`#1A1614\` | **金额是事实，不该花哨**。彩色金额会让人怀疑「是不是有附加条件」 |
| B8 | **禁用态** | 底 \`#F4F4F4\` + 字 \`--sb-disabled-ink\` \`#B0AAA5\` | 禁用是「不可用」，不承载任何语义 |

#### C 类 · 用**语义色**（既不中性也不品牌）

见 §2D。

### 判定决策树（写代码时照这个问）

\`\`\`
这个元素……
├─ 是「用户此刻唯一该做的事」吗？          → 品牌紫（A1）
├─ 表达「当前选中 / 焦点 / 可点」吗？      → 品牌紫（A2–A6）
├─ 是「用户最关心的数字」吗？              → 品牌紫（A7）
├─ 表达「成功/警告/危险/信息」吗？          → 语义色（§2D）
├─ 表达「积分 / 配额」吗？                  → 积分金 / 配额三色（§2D）
└─ 以上都不是                              → 中性色（B 类）
\`\`\`

### 三条硬约束

| # | 规则 | 可执行判据 |
|---|---|---|
| **C1** | **品牌色面积 ≤ 10%** | 截图转灰度、清点紫色像素占比。超了说明有元素该降级 |
| **C2** | **默认态零品牌紫** | 未选中/未激活/未锁定的控件，其 \`background\`/\`border-color\`/\`color\` 三属性中不得出现 \`--sb-brand-*\`/\`--sb-sel-*\` |
| **C3** | **一个区域最多一个品牌紫「实底」元素** | 同屏品牌实底块 ≤1（选中态浅底不算实底） |

---

## §2B · 铁律二：表面分层体系（L0–L4 + elevation）

### 推导方法（**基于真实值，不是凭空造**）

\`\`\`
L0  页面底     = #F5EFE4                      ← design-tokens.css:6 --bg（既有权威值）
L1  浮层面板   = rgba(255,255,255,0.92)        ← 白 92% 叠在 L0 上 → 合成 #FEFEFD
L2  面板内凹槽 = #F2F2F1                        ← 暖黑 #0C0A09 @5.5% on 白
L3  选项默认底 = #F4F4F4                        ← 暖黑 @4.5% on 白
L3- 选项 hover = #EDEDED                        ← 暖黑 @7.5% on 白
L4  反色面     = #0C0A09                        ← --sb-neutral-900
\`\`\`

> **为什么 L1 不用纯白**：纯白叠在暖米白上会显得「冷、发灰、像贴上去的一张纸」。92% 白保留一丝暖底透出，合成色 \`#FEFEFD\` 与 L0 的对比是 **1.134:1**——刚好可辨而不突兀。

### 实测：分层可辨性

| 相邻层 | 色值变化 | 对比度 | 判定 |
|---|---|---|---|
| L0 → L1 | \`#F5EFE4\` → \`#FEFEFD\` | **1.134:1** | ✅ 可辨 |
| L1 → L2 | \`#FEFEFD\` → \`#FFFFFF\` | 1.009:1 | ⚠️ **不可辨 → 所以 L1 内部禁止再放纯白卡** |
| L2 → L3 | \`#FFFFFF\` → \`#F4F4F4\` | **1.100:1** | ✅ 可辨 |
| L3 → L3- | \`#F4F4F4\` → \`#EDEDED\` | **1.064:1** | ✅ 可辨 |
| L3- → L4 | \`#EDEDED\` → \`#0C0A09\` | 16.874:1 | ✅ 强对比 |

> **这张表回答了一个关键问题**：为什么「面板内套白卡」是致命的——\`L1→L2\` 只有 **1.009:1**，肉眼完全不可辨，那条 1px 边框成了唯一分界，面板就变成了「一堆小方框拼的表格」。

### 层级 → elevation 规则表

| 层 | 色值 token | 背景 | 描边 | 阴影 | 圆角 | 何时用 |
|---|---|---|---|---|---|---|
| **L0** | \`--sb-l0-page\` \`#F5EFE4\` | 页面底 | 无 | 无 | — | 页面最底 |
| **L1** | \`--sb-l1-panel\` \`rgba(255,255,255,0.92)\` | 毛玻璃 | \`1px --sb-border-inverse\` | \`--sb-shadow-4\` + inset 高光 | **20px** | 浮层面板 / modal / 抽屉 |
| **L1'** | \`--sb-l1-panel-solid\` \`#FFFFFF\` | 不透明降级 | 同 L1 | 同 L1 | 20px | 不支持 backdrop-filter 时 |
| **L2** | \`--sb-l2-raised\` \`#FFFFFF\` | 纯白 | \`1px --sb-border-subtle\` | \`--sb-shadow-1\` | **12px** | 面板内需要「浮起」的容器（少用） |
| **L2-** | \`--sb-l2-inset\` \`#F2F2F1\` | 凹槽 | 无 | 无 | 8px | 输入框 / 图标底座 |
| **L3** | \`--sb-l3-option\` \`#F4F4F4\` | 轻着色 | **无**（选中才上描边） | 无 | **12px** | 面板内选项默认态 |
| **L3-** | \`--sb-l3-option-hover\` \`#EDEDED\` | 轻着色+ | 无 | 无 | 12px | 选项 hover |
| **L4** | \`--sb-l4-inverse\` \`#0C0A09\` | 反色 | 无 | \`--sb-shadow-2\` | pill | 深色 chip / 反色 CTA |

### 嵌套铁律

\`\`\`
✅ L0 页面 → L1 面板 → L3 选项           （色差 1.134 + 1.100，两级都清晰）
✅ L0 页面 → L1 面板 → L2- 输入框        （凹槽语义，与选项并列不冲突）
✅ L0 页面 → L1 面板 → L3 选项 → L2- 图标底座（三级嵌套，最内层是"凹槽"不是"卡片"）
❌ L0 页面 → L1 面板 → L2 白卡           （1.009:1，不可辨 —— 这就是"最丑"的成因）
❌ L1 面板 → L1 玻璃卡                   （Vercel 官方明令：Don't stack two Materials）
❌ 任意 4 层「表面 + 边框 + 圆角」叠加     （超过 3 层视觉嵌套）
\`\`\`

**关键洞察**：**面板内分组的正确分层手段是「留白 + 分组标题」，不是再套一层有色卡片。** 选项控件（L3）是「控件」不是「卡片」——它是 L1 内部唯一需要的层。

---

## §2C · 铁律三：选中态三件套（与 hover / active / focus 的区分）

### 实测病根

| 状态 | 改前取值 | 合成色值 | 与默认态的对比 |
|---|---|---|---|
| 默认 | \`--sb-surface-tint\` 暖黑 3% on 白 | \`#F8F8F8\` | — |
| **hover** | \`--sb-state-hover-bg\` 暖黑 3.5% on 白 | \`#F6F6F6\` | **1.018:1 → 肉眼不可分辨** ❌ |

> **默认与 hover 只差 0.5% alpha**。用户把鼠标移上去，界面**没有任何反应**——这是「像硬塞进来的」直接来源之一。

### 五态取值表（**确切色值 + alpha**）

| 状态 | 背景 | 描边 | 文字/图标 | 其他 | 与默认对比 |
|---|---|---|---|---|---|
| **default** | \`#F4F4F4\`（\`--sb-l3-option\`） | \`1.5px transparent\`（**占位防跳**） | \`--sb-ink-1\` \`#1A1614\` | — | — |
| **hover** | \`#EDEDED\`（\`--sb-l3-option-hover\`） | 不变（transparent） | **不变** | — | **1.064:1** ✅ |
| **active**（按下） | \`#E4E4E4\`（\`--sb-active-bg\`） | 不变 | 不变 | \`transform: scale(0.985)\` | 1.13:1 |
| **selected** | \`#F5F3FF\`（\`--sb-sel-bg\` = brand-50） | \`1.5px #7C3AED\` | \`#7C3AED\`（\`--sb-sel-ink\`） | 图标底座 \`#7C3AED\` + 白图标 | 1.15:1 + 色相突变 |
| **selected + hover** | \`#EDE9FE\`（\`--sb-sel-bg-hover\` = brand-100） | \`1.5px #7C3AED\` | \`#7C3AED\` | — | — |
| **focus-visible** | 同当前态 | 同当前态 | 同当前态 | **+\`outline: 2px solid #8B5CF6; outline-offset: 2px\`** | — |
| **disabled** | \`#F4F4F4\` | \`rgba(12,10,9,0.06)\` | \`#B0AAA5\` | \`cursor: not-allowed\` | — |

### 核心规则：四态走**四个不同的视觉通道**

| 状态 | **只**允许改变的属性 | **禁止**改变的属性 |
|---|---|---|
| **hover** | ① 背景（中性灰，+1 档） | ❌ 文字色 ❌ 描边 ❌ 字重 ❌ 阴影 |
| **active** | ① 背景（比 hover 再深 1 档）② \`scale(0.985)\` **或** \`translateY(1px)\`（**二选一**） | 同上 |
| **selected** | ① 背景（品牌浅底）② 描边（品牌 1.5px）③ 文字/图标（品牌色） | ❌ 阴影（不用紫阴影，那会让选中"发光"）❌ 渐变 |
| **focus-visible** | ① \`outline\`（**外加**，与上面四态叠加共存） | ❌ 不要用 \`box-shadow\` 做焦点环（WCAG 2.4.13 明确周长不含 shadow） |

> **为什么 hover 用中性灰、selected 用品牌紫**：两者是**正交**的——鼠标停在一个已选中项上时，hover 的中性灰与 selected 的品牌紫同时存在也不冲突。若两者都用紫，用户就无法区分「我鼠标停在这」和「这项被选中了」。

### 不同组件的选中态差异（用户要的「不同地方不同交互」）

| 组件 | 选中底 | 选中描边 | 额外信号 | 语义 |
|---|---|---|---|---|
| **选项卡片**（分辨率/模型） | \`#F5F3FF\` | \`1.5px #7C3AED\` | 图标底座变品牌实底 | 「我选了这个值」 |
| **Chip / 平台胶囊** | \`#0C0A09\` 反色黑 | 无 | 文字变白 | 「这是一个筛选条件」——反色更强，因为 chip 常多选 |
| **Segmented** | \`#FFFFFF\` 纯白 | 无 | \`--sb-shadow-1\` 浮起 | 「当前视图」——白底浮起表达，不用品牌色 |
| **Tab** | 无底 | 底部 \`2px #7C3AED\` | — | 「当前标签页」 |
| **列表行** | \`#F5F3FF\` | 无 | 左侧 \`2px #7C3AED\` 竖条 | 行级选中，描边会太吵 |
| **开关 Switch** | 轨道 \`#7C3AED\` | 无 | 滑块右移 | 二进制状态 |

> ⚠️ **禁止 \`border-left: 3px solid <color>\`** 作为普通卡片的状态条（impeccable 明列为 anti-pattern）。**唯一例外**是上表的「列表行选中」——那是导航语义，不是装饰。

---

## §2D · 铁律四：语义色体系（含积分 / 计费 / 配额）

### 四组基础语义（每组四件套）

| 语义 | soft（浅底） | border | **ink（文字）** | solid（实底） | 用途 |
|---|---|---|---|---|---|
| **成功** | \`#F0F9F2\` | \`#C3E3CB\` | **\`#2F7D46\`** (5.07:1) | \`#5CA86C\` | 生成完成 / 已保存 |
| **警告** | \`#FDF6EC\` | \`#F2D9B0\` | **\`#B45309\`** (5.02:1) | \`#E08A2E\` | 需注意 / 额度不足 |
| **危险** | \`#FEF2F0\` | \`#F6C9C4\` | **\`#D0443C\`** (4.59:1) | \`#E8544B\` | 错误 / 删除 / 必填 |
| **信息** | \`#F0F4FD\` | \`#C2D0EE\` | **\`#3B5BA5\`** (6.51:1) | \`#5275CC\` | 提示 / 说明 |

> ⚠️ **solid 变体一律不得用于文字**（成功绿 \`#5CA86C\` 在白底仅 2.89:1，危险红 \`#E8544B\` 仅 3.62:1）。文字必须用 **ink** 变体。

### 特殊语义：积分 / 计费 / 配额

**现状问题**：积分散落在 \`#FCD34D\`/\`#FBBF24\`/\`#F59E0B\` 等无 token 金色，且**积分与金额视觉上无法区分**。

| 概念 | 本质 | 用什么色 | 为什么 |
|---|---|---|---|
| **积分余额** | **资产**（可增值、可消耗） | **金棕 \`#C9902B\`** | 金色天然关联「价值/资产」。它既不是成功也不是警告，是独立的第四种语义 |
| **积分消耗 / 扣减** | 资产减少 | \`#B45309\`（复用 warning ink） | 表达「减少」的负面感，但不至于到危险红 |
| **金额（¥）** | **事实** | **中性 \`#1A1614\`** | 金额不该花哨。彩色金额会让人怀疑有附加条件 |
| **配额充足** | 正常 | \`#2F7D46\` | — |
| **配额偏低（<20%）** | 预警 | \`#B45309\` | 唯一该亮橙的时刻 |
| **配额耗尽** | 阻断 | \`#D0443C\` | — |
| **当前/推荐套餐** | 品牌主张 | 底 \`#F5F3FF\` + 描边 \`#7C3AED\` | 复用品牌选中态 |

**积分徽标规范**（\`.sb-credit-chip\`）：

\`\`\`
┌────────────────────┐
│ ✨ 1,280 套         │  底 #FDF8EC / 描边 #F0DFB4 / 字 #8A6216
└────────────────────┘  高 22px, radius pill, padding 2px 8px
      ↑ 图标 --sb-credit #C9902B    ↑ 数字用 tabular-nums 等宽对齐
\`\`\`

> **关键**：积分数字用 **\`font-variant-numeric: tabular-nums\`**（等宽数字），余额变化时不会左右抖动。

---

## §2E · 铁律五：毛玻璃与遮罩的允许 / 禁止矩阵

### 毛玻璃（\`backdrop-filter\`）白名单 —— **只有 3 个位置**

| # | 位置 | 底 | blur | saturate | 为什么允许 |
|---|---|---|---|---|---|
| ① | **浮层参数面板**（L1） | \`rgba(255,255,255,0.92)\` | \`24px\` | \`180%\` | 面板浮在表单/画布之上，需要「我盖在它上面但没挡住它」 |
| ② | **画布 / 图片上的浮动工具条** | \`rgba(255,255,255,0.86)\` | \`16px\` | \`180%\` | 内容在下面流动 |
| ③ | **吸顶导航** | \`rgba(255,255,255,0.78)\` | \`24px\` | \`180%\` | 滚动时内容从下面穿过 |

### 明确禁止（黑名单）

| ❌ 禁止 | 理由 |
|---|---|
| **普通卡片** | 卡片是不透明内容层。Canva 与 Figma 的 \`backdrop-filter\` 实测出现次数是 **0** |
| **列表项 / 表格行** | 会叠加成一片糊 |
| **按钮 / chip / 输入框** | 控件需要清晰边界，模糊会削弱可点感 |
| **嵌套毛玻璃** | Vercel 官方原文：「Don't stack two Materials on the same element」。性能灾难 + 视觉糊 |
| **作装饰贴在任意元素上** | Apple HIG 明令：materials 必须 sparingly，**禁止用在内容层** |
| **\`transparent\` 底上使用** | 即梦实测有 2 处 \`blur(80px)\` 作用在 transparent 底上——**完全无效**，纯装饰 |

### 参数收敛

| 参数 | 现状 | 规范 | 为什么 |
|---|---|---|---|
| blur（面板） | 40px | **24px** | 40px 把底层糊死，失去「能感知下面有东西」的意义，GPU 开销翻倍 |
| saturate | 220% | **180%** | 220% 会在暖米白的高饱和区产生**彩色镶边**（chromatic fringing） |
| 面板底 alpha | 0.85 | **0.92** | 0.85 太透，面板内文字要跟底层图案抢对比度 |

### 必须降级（**硬要求**）

\`\`\`css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sb-panel { background: #FFFFFF; }                 /* 低端安卓 / 老 Safari */
}
@media (prefers-contrast: more) {
  .sb-panel { background: #FFFFFF; backdrop-filter: none; }
}
@media (forced-colors: active) { /* 系统强制色模式 */ }
\`\`\`

### 遮罩（scrim）阶梯

| 档 | 色值 | 用途 | 允许毛玻璃？ |
|---|---|---|---|
| **weak** | \`rgba(24,20,16,0.24)\` | popover 背后弱化（内容仍可读） | 否 |
| **standard** | \`rgba(24,20,16,0.44)\` | modal / 抽屉 | ✅ \`blur(4px)\` |
| **strong** | \`rgba(24,20,16,0.62)\` | 破坏性确认 / 全屏画布 | ✅ \`blur(4px)\` |

**规则**：
- 遮罩色固定**暖黑 \`rgba(24,20,16,·)\`**，禁止 \`rgba(0,0,0,·)\`（在暖调页面上会显脏）。
- 遮罩 alpha 与「阻断程度」成正比。**能继续操作** → weak；**必须处理** → standard；**不可逆** → strong。
- 遮罩后景虚化固定 \`blur(4px)\`，不要更大——遮罩的职责是分离前后景，不是把背景糊掉。

### 性能红线

| 约束 | 说明 |
|---|---|
| 同屏 \`backdrop-filter\` 元素 **≤2** | 每个都触发独立的 GPU 合成层 |
| 玻璃元素**不得作为其他浮层的定位基准** | 它会创建新的 stacking context 与 containing block |
| 玻璃元素内部**禁止**再放玻璃元素 | — |
| 移动端（≤640px）建议关闭面板毛玻璃 | 低端设备滚动掉帧的主要来源 |

---

## §2F · 把五条铁律应用到 GenSettingsPanel（**逐行对照**）

| # | 位置 | 现状 | 改为 | 依据 |
|---|---|---|---|---|
| 1 | 选项默认底 | \`--sb-surface-tint\` → 合成 \`#F8F8F8\` | \`--sb-l3-option\` \`#F4F4F4\` | §2B（与面板白底 1.100:1 可辨） |
| 2 | hover 底 | \`--sb-state-hover-bg\` 3.5% → \`#F6F6F6\`（与默认差 1.018:1） | \`--sb-l3-option-hover\` \`#EDEDED\` | §2C（提到 1.064:1） |
| 3 | 选中底 | \`--sb-state-selected-bg\` = brand-50（**但被 \`:495\` 覆盖成 brand-400**） | \`--sb-sel-bg\` \`#F5F3FF\` | 修复 token 冲突 |
| 4 | 选中描边 | \`--sb-state-selected-line\` = brand-200 \`#DDD6FE\`（过浅） | \`--sb-sel-line\` \`#7C3AED\` | §2C（描边必须清晰） |
| 5 | 分组标题图标 | 已改中性 ✅ | 保持 | §2A B1 |
| 6 | 图标底座 | \`--sb-surface-tint\` | \`--sb-l2-inset\` \`#F2F2F1\`（凹槽语义） | §2B |
| 7 | 选中图标底座 | **无变化** | 底 \`#7C3AED\` + 图标 \`#FFF\` | §2A A4 |
| 8 | transition | \`var(--sb-duration-fast)\` **未定义 → 0s** | \`var(--sb-dur-fast)\` | 修复 token 名不匹配 |
| 9 | 面板底 | \`rgba(255,255,255,0.85)\` | \`rgba(255,255,255,0.92)\` | §2E（0.85 太透） |
| 10 | 未锁定色块 | 棋盘底 + 虚线 ✅ | 保持（符合铁律 6.3） | §2A B3 |

**修复后预期**：默认→hover 可辨（1.064:1）；选中态有明确的品牌紫三件套（底/描边/文字）；分组层级靠留白 + 凹槽表达，不再是一片平；整体保留暖米白基调并出现品牌色点缀。

---

## 2. 颜色 · 品牌（Brand）

**一句话**：品牌紫是"注意力货币"。默认态一分不花，选中态才支付。

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-brand-50` | `#F5F3FF` | 选中项浅底 | 大面积背景 |
| `--sb-brand-100` | `#EDE9FE` | 品牌浅底（hover 于浅底之上） | 正文底 |
| `--sb-brand-200` | `#DDD6FE` | 分隔 / 装饰描边 | 文字 |
| `--sb-brand-300` | `#C4B5FD` | 选中态描边（浅） | 文字（对比度不足） |
| `--sb-brand-400` | `#A78BFA` | 渐变终点 / 大号装饰图标 | 小字号文字（3.1:1，不足） |
| `--sb-brand-500` | `#8B5CF6` | **焦点环** / 选中图形 | 大段文字 |
| `--sb-brand-600` | `#7C3AED` | **品牌主色**：primary 按钮底、选中文字、链接 | 装饰性使用 |
| `--sb-brand-700` | `#6D28D9` | primary 按钮 hover | — |
| `--sb-brand-800` | `#5B21B6` | primary 按钮 active（按下） | — |
| `--sb-brand-900` | `#4C1D95` | 深色文本于浅紫底上 | — |

**语义别名（写代码时优先用这些，而不是上面的数字）：**

| Token | 值 | 用途 |
|---|---|---|
| `--sb-brand` | `#7C3AED` | 品牌主色 |
| `--sb-brand-strong` | `#6D28D9` | hover 态 |
| `--sb-brand-soft` | `#F5F3FF` | 选中态浅底 |
| `--sb-brand-border` | `#C4B5FD` | 选中态描边 |
| `--sb-brand-ring` | `rgba(124,58,237,.32)` | 焦点环 / 外发光 |
| `--sb-brand-shadow` | `0 2px 8px rgba(124,58,237,.16)` | 选中项微投影 |
| `--sb-brand-shadow-lg` | `0 6px 20px rgba(124,58,237,.24)` | primary 按钮投影 |
| `--sb-brand-gradient` | `linear-gradient(135deg,#7C3AED,#A78BFA)` | 主 CTA / 徽标 |
| `--sb-brand-gradient-3` | `linear-gradient(135deg,#7C3AED,#EC4899,#F59E0B)` | ⚠️ **仅限首页 hero 主 CTA 一处** |
| ~~`--sb-gradient-text`~~（**不存在的 token，仅用于记录禁止项**） | — | ❌ **不提供此 token**。渐变文字（`background-clip: text` + 渐变）被 impeccable 判为反模式：装饰性而非表意，是典型的 AI 生成痕迹。标题强调用**字重或字号**，不用渐变 |

> ⚠️ **`--sb-brand-gradient-3` 的使用限制**：三色渐变在 `EcMode.jsx:824`「下一步」和 `design-tokens.css:286` `.hero-gradient-text` 各出现一次。三色渐变**最多全站用 2 处**（首页 hero 主 CTA + hero 标题文字）。再多就变成"到处都是彩虹"，彻底失效。

---

## 3. 颜色 · 中性（Neutral）

**一句话**：暖灰系（色相 ~30°），与 `--bg: #F5EFE4` 同一家族。**禁止换成冷灰**（Tailwind `slate`/`gray`/`zinc`）。

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-neutral-0` | `#FFFFFF` | 卡片面 | 面板底（用半透明白） |
| `--sb-neutral-25` | `#FDFBF7` | 悬浮层最亮面 | — |
| `--sb-neutral-50` | `#FAF7F2` | 次级表面 / 页面底 | — |
| `--sb-neutral-100` | `#F5F1EA` | 分组底 / 骨架屏底 | 文字（太浅） |
| `--sb-neutral-150` | `#EFEAE1` | **输入框凹槽底** | 大面积背景（显脏） |
| `--sb-neutral-200` | `#E7E3DD` | 强分割线 | 控件描边（对比度不足） |
| `--sb-neutral-300` | `#D6D1C9` | 控件描边（可见） | 文字 |
| `--sb-neutral-400` | `#B0AAA5` | **仅限 disabled 文字** | 正文 / placeholder（2.2:1，违规） |
| `--sb-neutral-500` | `#9A9490` | 大号图标 / ≥14px 粗体提示 | 12px 正文（3.0:1，不足 4.5:1） |
| `--sb-neutral-600` | `#6B6560` | **辅助文字（正文级）** | — |
| `--sb-neutral-700` | `#3D3835` | 正文 | — |
| `--sb-neutral-800` | `#1A1614` | 标题 / 关键数值 | — |
| `--sb-neutral-900` | `#0C0A09` | 反色面（深色 chip / CTA） | 正文（已用 ink-1） |

> 📌 **收敛说明**：现状有 **3 个近黑**并存——硬编码 `#1a1a1a`、`--text-primary: #1A1614`、`--accent: #0C0A09`。规范统一到 `--sb-ink-1`(`#1A1614`) 用于文字，`--sb-neutral-900`(`#0C0A09`) 用于**面**（深色按钮底），两者不再混用。

---

## 4. 颜色 · 表面（Surface）— 嵌套层级

**一句话**：五级表面，靠**色阶**分层，不靠画框。

| 级别 | Token | 值 | 用途 | 说明 |
|---|---|---|---|---|
| **L0** | `--sb-surface-page` | `#FAF7F2` | 页面底 | ⚠️ 现状 `--bg` 是 `#F5EFE4`（更暖），落地时**保留 `--bg` 不动**，新代码用它时映射到 L0 |
| **L1** | `--sb-surface-panel` | `rgba(255,255,255,.85)` | 浮层面板 / 抽屉 / 弹窗 | **必须配毛玻璃**（§11） |
| L1' | `--sb-surface-panel-solid` | `#FFFFFF` | 毛玻璃降级 | 不支持 `backdrop-filter` 时用 |
| **L2** | `--sb-surface-card` | `#FFFFFF` | 卡片（可点的大块） | ⚠️ **不得放在 L1 面板内部**（原则 3.2） |
| L2' | `--sb-surface-sunken` | `#EFEAE1` | 输入框 / 凹槽 | 表达"可以往里写东西" |
| **L3** | `--sb-surface-tint` | `rgba(12,10,9,.03)` | 面板内选中行 / 分组底 | **面板内分组的默认底色** |
| L3' | `--sb-surface-tint-strong` | `rgba(12,10,9,.06)` | hover 态 / 强着色行 | 比 tint 深一档，用于 hover |
| **L4** | `--sb-surface-inverse` | `#0C0A09` | 反色面（深色 chip、主 CTA） | 文字用 `--sb-ink-on-dark` |

### 4.1 嵌套速查表

```
L0 页面 ─── L1 面板 ─── L2 卡片                    ✅
L0 页面 ─── L1 面板 ─── L3 tint 行 ─── L4 输入框    ✅
L0 页面 ─── L1 面板 ─── L2 卡片 ─── L2 卡片         ❌ 白卡套白卡
L0 页面 ─── L1 面板 ─── L2 卡片 ─── L3 ─── L4       ❌ 超过 3 层视觉
```

**判据**：把截图转成灰度，"这层在上一层之上"应当**一眼可辨**。如果眯眼看不出层级，就是 L 级不够。

---

## 5. 颜色 · 文字（Ink）

**一句话**：只有三种情况用彩色字，其余全部中性。

| Token | 值 | on #FFF | on #F5EFE4 | 用途 | ❌ 禁止 |
|---|---|---|---|---|---|
| `--sb-ink-1` | `#1A1614` | 17.97 | 15.70 | 标题、关键数值、面板标题 | — |
| `--sb-ink-2` | `#3D3835` | 11.57 | 10.11 | **正文默认** | — |
| `--sb-ink-3` | `#6B6560` | 5.74 | 5.02 | 辅助说明、分组标签、**placeholder**、元信息 | — |
| `--sb-ink-4` | `#9A9490` | **2.99** | 2.62 | ⚠️ 仅 ≥14px 粗体 或 大号图标 | **12px 正文**（2.99 < 4.5，违规） |
| `--sb-ink-5` | `#B0AAA5` | **2.30** | 2.01 | ⚠️ **仅 disabled** | 任何可读内容 |
| `--sb-ink-on-dark` | `#FFFFFF` | — | — | 深色面上的文字 | — |
| `--sb-ink-brand` | `#7C3AED` | 5.70 | 4.98 | **品牌动作 / 当前选中 / 链接** | 装饰 |
| `--sb-ink-danger` | `#D0443C` | 4.59 | **4.01** | 错误、删除动作 | 普通强调；**暖米白底上需加深** |
| `--sb-ink-success` | `#2F7D46` | 5.07 | 4.43 | 成功、已完成 | 普通强调；暖底略欠 |
| `--sb-ink-warning` | `#B45309` | 5.02 | 4.39 | 警告、额度不足 | 普通强调；暖底略欠 |
| `--sb-ink-info` | `#3B5BA5` | 6.51 | 5.69 | 信息、提示 | 普通强调 |

> 📐 以上均为 **WCAG 2.x 相对亮度公式实算值**（`L = 0.2126R + 0.7152G + 0.0722B`，sRGB 线性化；对比度 `= (L1+0.05)/(L2+0.05)`）。复算脚本见 `30-adoption-plan.md` §4。
> ⚠️ **注意暖米白底 `#F5EFE4` 会拉低对比度 0.5–0.9**。状态色文字不要直接放在页面底上，要么用 `--sb-surface-card` 托底，要么加深颜色。

### 5.1 彩色字决策树（照这个问）

```
这段文字……
├─ 是「当前选中 / 可点的品牌动作 / 链接」吗？  → --sb-ink-brand
├─ 是「成功 / 失败 / 警告 / 提示」状态吗？      → --sb-ink-{success|danger|warning|info}
├─ 是「用户最关心的那个数字」吗？               → --sb-ink-brand（或 ink-1 + 加粗）
└─ 以上都不是                                  → 中性 ink-1 ~ ink-4，按层级选
```

**验证**：一屏上彩色文字不超过 **3 处**。数一数，超了就砍。

---

## 6. 颜色 · 语义状态（Semantic）

每个状态是**四件套**：`solid`（实底）/ `soft`（浅底）/ `border`（描边）/ `ink`（文字）。

| 语义 | solid | hover | soft | border | ink | ring |
|---|---|---|---|---|---|---|
| **Danger** 危险/删除 | `#E8544B` | `#D0443C` | `#FEF2F0` | `#F6C9C4` | `#D0443C` | `rgba(232,84,75,.30)` |
| **Success** 成功 | `#5CA86C` | `#4A9059` | `#F0F9F2` | `#C3E3CB` | `#2F7D46` | `rgba(92,168,108,.30)` |
| **Warning** 警告 | `#E08A2E` | `#C6761F` | `#FDF6EC` | `#F2D9B0` | `#B45309` | `rgba(224,138,46,.30)` |
| **Info** 信息 | `#5275CC` | `#4262B4` | `#F0F4FD` | `#C2D0EE` | `#3B5BA5` | `rgba(82,117,204,.30)` |

**用法规则**：

| 场景 | 用哪件 | 示例 |
|---|---|---|
| 图标 / 小圆点 / 进度条 | `solid` | 成功对勾 |
| 页面区块背景 | `soft` | 错误提示条底 |
| 输入框错误态描边 | `border` + `ring` | 校验失败 |
| 文字 | `ink` | 「生成失败，请重试」 |

> ⚠️ **`solid` 不得用于文字**。`#5CA86C` 在白底上是 2.8:1，不满足 4.5:1；文字必须用 `ink` 变体（`#2F7D46` 是 5.4:1）。
> ⚠️ **Warning 是现状缺失的 token**：代码里散落 `#f59e0b`、`#e67e22`、`#d97706` 三种橙，全部收敛到上表。

### 6.1 语义色禁止挪作身份标识

**规则**：红只能表示危险，蓝只能表示信息，绿只能表示成功。

**现状最严重的违反**：`EcMode.jsx:503`（产品图上传来区红框）/ `EcMode.jsx:594`（参考图上传区蓝框）——用危险色和信息色区分两个上传区块。**必须改**为同规格中性，靠标题区分。

---

## 7. 边框（Border）

**一句话**：能靠表面色差分层，就不画线。

| Token | 值 | 用途 | ❌ 禁止 |
|---|---|---|---|
| `--sb-border-subtle` | `rgba(12,10,9,.06)` | 组内分隔、面板分段 | 控件描边（不可见） |
| `--sb-border-default` | `rgba(12,10,9,.10)` | **控件描边默认** | 大面积区块描边 |
| `--sb-border-strong` | `rgba(12,10,9,.16)` | hover / 强调描边 | — |
| `--sb-border-focus` | `#8B5CF6` | 焦点描边 | 静态元素 |
| `--sb-border-inverse` | `rgba(255,255,255,.70)` | 毛玻璃面上的白描边 | 浅底上（不可见） |

**硬规则**：
- **禁止 `rgba(0,0,0,x)`**。现状全站大量使用纯黑半透明（`rgba(0,0,0,.03)`/`.06`/`.08`/`.1`/`.12`/`.14`/`.15`），在暖米白底上会显脏发灰。统一用**暖黑** `rgba(12,10,9,x)`。
- **边框宽度只用 1px**。现状 `1.5px`（`CopyPanel.jsx:9`、`EcMode.jsx:36`）与 `2px`（`EcMode.jsx:503`、`SizingPanel.jsx:276`）必须收敛。**唯一例外**：选中态描边可以用 1.5px（见 §8.3）。
- **禁止色差微弱 + 边框微弱同时出现**（原则 3.3）。

---

## 8. 排版（Typography）

### 8.1 字族

| Token | 值 | 用途 |
|---|---|---|
| `--sb-font-sans` | system-ui 栈（PingFang SC / Microsoft YaHei / Noto Sans SC） | **全部 UI 文本**（产品型界面单一字族即可） |
| `--sb-font-display` | `Fredoka` / `ZCOOL KuaiLe` | ⚠️ **仅限首页 hero 大标题**。禁止用于 UI 标签、按钮、数据。 |
| `--sb-font-mono` | SF Mono / Fira Code | 尺寸数字、比例值（如 `1024×1024`） |

> **为什么 UI 只用单一字族**：产品型界面不需要 display/body 配对。一个调校良好的 sans 可以同时承担标题、按钮、标签、正文、数据 [来源: impeccable `reference/product.md` §Typography]。

### 8.2 字号阶梯（8 档）

| Token | 值 | 字重 | 行高 | 用途 | 现状对应 |
|---|---|---|---|---|---|
| `--sb-text-2xs` | 10px | 600 | 1.4 | 角标（"必须"/"可选"）、极次要元信息 | 10px（54 次） |
| `--sb-text-xs` | 11px | 400/700 | 1.5 | 面板说明文字、分组标签、元信息 | 11px（101 次） |
| `--sb-text-sm` | **12px** | 400/600/700 | 1.5 | **UI 标签、控件文字、面板正文**（最高频） | 12px（137 次） |
| `--sb-text-md` | **13px** | 600/700 | 1.4 | 按钮、面板标题 | 13px（91 次） |
| `--sb-text-lg` | 15px | 500/700 | 1.5 | 强调正文、大按钮、顶栏 | 15px（29 次） |
| `--sb-text-xl` | 18px | 700 | 1.35 | 小节标题 | 18px（14 次） |
| `--sb-text-2xl` | 24px | 800 | 1.25 | 页面标题 | 24px（6 次） |
| `--sb-text-3xl` | 32px | 800 | 1.2 | 区块标题 | 30px（1 次） |
| `--sb-text-4xl` | 48px | 900 | 1.1 | Hero（桌面 62px 收敛到此，移动 32px） | 48/56/62px |

**收敛策略**：现状 **24 档字号** → 本规范 **9 档**。映射见 §16。

### 8.3 字重

| Token | 值 | 用途 |
|---|---|---|
| `--sb-weight-regular` | 400 | 正文、说明 |
| `--sb-weight-medium` | 500 | 需要轻微强调的正文 |
| `--sb-weight-semibold` | 600 | 控件文字、按钮（次级） |
| `--sb-weight-bold` | 700 | 分组标签、面板标题、主按钮 |
| `--sb-weight-heavy` | 800 | 页面标题、Hero |

> ⚠️ **`--sb-weight-heavy`(800) 的滥用是现状的明显问题**：`fontWeight: 900` 在导航项、积分数字、按钮、标签上到处出现（`App.jsx:77,98,157,175`、`Navbar.jsx:61,77,98,113`）。**900/800 只留给页面级标题和 Hero**。UI 控件用 600/700，正文用 400。中文字体的 900 字重渲染差异极小，只会让字变糊。

### 8.4 行高与字距

| Token | 值 | 用途 |
|---|---|---|
| `--sb-leading-tight` | 1.25 | 大标题（≥18px） |
| `--sb-leading-snug` | 1.4 | 控件内文字、按钮 |
| `--sb-leading-normal` | 1.5 | 正文默认 |
| `--sb-leading-relaxed` | 1.65 | 长文段落 |

| Token | 值 | 用途 |
|---|---|---|
| `--sb-tracking-tight` | `-0.01em` | ≥32px 大标题 |
| `--sb-tracking-normal` | `0` | 默认 |
| `--sb-tracking-label` | `0.02em` | ≤12px 小标签（补偿小字号视觉拥挤） |

> ⚠️ **字距下限 `-0.04em`**。比这更紧字母就贴在一起了，读起来是「挤」而不是「设计」。
> 现状：`App.jsx:142` 用 `letterSpacing: '0.03em'`；`Navbar.jsx:62` 用 `-0.3px`；`SizingPanel.jsx:229` 用 `0.3`（无单位，即 0.3px≈0.025em）。**统一到上表 3 档。**

### 8.5 行宽

正文行长上限 **65–75ch**。超过则降低可读性。

**现状违反**：`Home/index.jsx:47` 副标题 `maxWidth: 860` + 15px 字号 ≈ 100ch，过宽。

---

## 9. 间距（Spacing）

**一句话**：4px 基数，只走阶梯。

| Token | 值 | 典型用途 |
|---|---|---|
| `--sb-space-1` | 4px | 图标与文字之间、紧凑元素 |
| `--sb-space-2` | 8px | **组内元素默认间距**、面板与触发按钮间距 |
| `--sb-space-3` | 12px | 组内次级间距、控件内左右 padding（小） |
| `--sb-space-4` | 16px | **面板内边距**、组间最小间距 |
| `--sb-space-5` | 20px | **组间默认间距** |
| `--sb-space-6` | 24px | 大区块间距 |
| `--sb-space-8` | 32px | 页面 section 间距 |
| `--sb-space-10` | 40px | 页面 section 大间距 |
| `--sb-space-12` | 48px | 页面级分隔 |
| `--sb-space-16` | 64px | Hero 上下留白 |

### 9.1 各层间距配方（照抄即可）

| 位置 | 值 |
|---|---|
| **面板内边距** | `--sb-space-4`(16px) 四周 |
| 面板 header padding | `12px 16px` |
| 面板 footer padding | `12px 16px` |
| **分组之间** | `--sb-space-5`(20px) |
| 分组标题 → 组内首个控件 | `--sb-space-2`(8px) |
| 组内控件之间 | `--sb-space-2`(8px) |
| 卡片内边距 | `--sb-space-3`(12px) 或 `--sb-space-4`(16px) |
| 页面内容区左右 | `--sb-gutter`(20px) |
| 页面 section 之间 | `--sb-space-8`(32px) |

### 9.2 禁止的间距值

`2px` / `3px` / `5px` / `6px` / `10px` / `14px` / `18px` / `22px` / `15px` / `25px`

**现状违反统计**：gap 实测中，6px(71次) / 10px(47次) / 5px(23次) / 14px(10次) / 2px(10次) / 3px(9次) = **170 次非阶梯值**。

### 9.3 邻近原则（组内:组间 = 1:2）

```
组内 8px  → 组间 ≥ 16px    ✅
组内 8px  → 组间 8px       ❌ 分组失效
组内 12px → 组间 24px      ✅
组内 4px  → 组间 20px      ✅（1:5，更强分组）
```

---

## 10. 圆角（Radius）

**一句话**：外层 − 内边距 = 内层。

| Token | 值 | 用途 | 现状对应 |
|---|---|---|---|
| `--sb-radius-xs` | 4px | 微型徽标、进度条 | 4px（21 次） |
| `--sb-radius-sm` | 6px | 小图标容器、20px 复选格 | 6px（43 次） |
| `--sb-radius-md` | **8px** | **输入框、小 chip、菜单项** | 8px（85 次，最高频） |
| `--sb-radius-lg` | **12px** | **选项卡、中按钮、面板内层卡片** | 12px（36 次）、10px（72 次） |
| `--sb-radius-xl` | 16px | 卡片、面板内分组 | 16px（26 次） |
| `--sb-radius-2xl` | **20px** | **浮层面板、弹窗** | 20px（16 次） |
| `--sb-radius-3xl` | 24px | 大容器（移动端面板） | 24px（1 次） |
| `--sb-radius-pill` | 9999px | 胶囊：主 CTA、平台 chip、导航项 | 9999px（18 次） |

### 10.1 嵌套圆角速算表

| 外层 | 内边距 | 内层应用 |
|---|---|---|
| 20px | 8px | **12px** |
| 20px | 4px | **16px** |
| 16px | 8px | **8px** |
| 16px | 4px | **12px** |
| 12px | 4px | **8px** |
| 12px | 2px | **10px ≈ 8px** |

### 10.2 禁止

- ❌ **卡片/弹窗/输入框用 ≥ 24px 圆角**。「insanely rounded」是 AI 生成的典型特征；卡片上限 12–16px [来源: impeccable SKILL.md §Codex-specific defects]。
- ❌ **同一语义在不同地方用不同圆角**。现状：选项卡圆角有 10/10/6/8/8/9999 共 6 档；面板内小输入框有 6/7/8 共 3 档。

> ⚠️ **与现有 `design-tokens.css` 的冲突**：该文件定义 `--radius-md: 16px` / `--radius-lg: 30px` / `--radius-xl: 40px`（灵图「超圆角」风格）。但面板代码里 `--radius-md` 实际被当作 8px 语义使用（`Button.jsx:12`），且 `--radius-lg`(30px) 在 `card-glass` 上产生极大圆角。**本规范不修改该文件**，但新代码一律用 `--sb-radius-*`。

---

## 11. 阴影 / 海拔（Elevation）

**一句话**：暖棕投影，五档海拔，与 z-index 阶梯一一对应。

| Token | 值 | 海拔 | 对应层级 | 用途 |
|---|---|---|---|---|
| `--sb-shadow-0` | `none` | 0 | 页面内容 | 分组行、选项卡（用色差而非阴影） |
| `--sb-shadow-1` | `0 1px 2px rgba(57,45,26,.05)` | 1 | 静态 | 输入框、静态卡片 |
| `--sb-shadow-2` | `0 1px 3px rgba(57,45,26,.07), 0 2px 8px rgba(57,45,26,.05)` | 2 | 卡片 rest | 可点卡片 |
| `--sb-shadow-3` | `0 4px 16px rgba(57,45,26,.10)` | 3 | dropdown | 下拉、popover |
| `--sb-shadow-4` | `0 12px 36px rgba(57,45,26,.13), 0 2px 8px rgba(57,45,26,.06)` | 4 | panel | 浮层面板 |
| `--sb-shadow-5` | `0 28px 90px rgba(57,45,26,.16), 0 8px 24px rgba(57,45,26,.08)` | 5 | modal | 弹窗、全屏抽屉 |
| `--sb-shadow-inset-top` | `inset 0 1px 0 rgba(255,255,255,.90)` | — | — | 毛玻璃面顶部高光 |
| `--sb-shadow-ring` | `0 0 0 3px var(--sb-brand-ring)` | — | — | 焦点外发光 |

**硬规则**：
1. **投影颜色固定暖棕 `rgba(57,45,26,·)`**，禁止冷灰 `rgba(0,0,0,·)`。现状全站混用（`Popover.jsx:70` 用 `rgba(57,45,26,.16)`，`App.jsx:65` 用 `rgba(0,0,0,.12)`）。
2. **禁止 "ghost-card"**：`border: 1px solid X` + `box-shadow` 模糊 ≥16px 不得同时出现 [来源: impeccable]。现状违反：`Popover.jsx:69-70`、`EcMode.jsx:51-52`、`ui/index.jsx:14-18`。
3. **阴影的模糊半径与海拔成正比**。海拔 3 = 16px 模糊，海拔 5 = 90px 模糊。不要用「大模糊 + 低海拔」这种不匹配组合。
4. **静态元素默认无阴影**（`--sb-shadow-0` 或 `-1`）。阴影是**状态响应**（hover / 浮起），不是装饰 [来源: impeccable `reference/product.md`]。

---

## 12. 毛玻璃（Backdrop）与遮罩（Scrim）

### 12.1 毛玻璃参数

| Token | 值 | 用途 |
|---|---|---|
| `--sb-blur-nav` | 24px | 吸顶导航（现状 `Navbar.jsx:45` = 24px ✅） |
| `--sb-blur-panel` | **24px** | 浮层面板（现状 `EcMode.jsx:49` = **40px** ❌ 过度） |
| `--sb-blur-bar` | 16px | 画布上的浮动工具条 |
| `--sb-blur-overlay` | 4px | 遮罩后景虚化 |
| `--sb-saturate-glass` | **180%** | 饱和度（现状 **220%** ❌ 产生彩色镶边） |

**白名单（仅 3 处可用）**：① 浮在画布/图片之上的工具条 ② 吸顶导航 ③ 浮层参数面板。
**黑名单**：普通卡片、列表项、按钮、chip、输入框、嵌套毛玻璃。

**必须降级**：见 §14。

### 12.2 遮罩阶梯

| Token | 值 | 用途 |
|---|---|---|
| `--sb-scrim-weak` | `rgba(24,20,16,.24)` | 轻遮罩：popover 背后弱化 |
| `--sb-scrim` | `rgba(24,20,16,.44)` | **标准遮罩：modal / 抽屉** |
| `--sb-scrim-strong` | `rgba(24,20,16,.62)` | 强遮罩：破坏性确认、全屏画布 |

**规则**：
- 遮罩色固定**暖黑** `rgba(24,20,16,·)`，禁止 `rgba(0,0,0,·)`。现状 `ui/index.jsx:36` 用 `rgba(0,0,0,.45)`。
- 遮罩**带 4px 虚化**（`--sb-blur-overlay`），让背景前后景分离更清晰。
- 遮罩透明度与「阻断程度」成正比：可继续操作内容 → weak；必须处理当前 → scrim；破坏性 → strong。

---

## 13. 控件尺寸（Control Sizing）

| Token | 值 | 用途 | 内边距 | 字号 |
|---|---|---|---|---|
| `--sb-control-h-xs` | **24px** | 面板内微型：数量输入、比例选择器 | `0 8px` | 11px |
| `--sb-control-h-sm` | **28px** | 小：chip、次级输入 | `0 10px` | 12px |
| `--sb-control-h-md` | **32px** | **中：面板内按钮、下拉**（继承项目既有 32） | `0 14px` | 12px |
| `--sb-control-h-lg` | **36px** | **大：表单主控件**（继承项目既有 36） | `0 16px` | 13px |
| `--sb-control-h-xl` | **44px** | 特大：主 CTA、顶栏按钮 | `0 24px` | 15px |

**现状收敛**：实测高度 **12 档**（26/28/30/32/34/36/38/40/42/44/45/50）→ 本规范 **5 档**。

| 现状值 | 出现位置 | 收敛到 |
|---|---|---|
| 26 | `SizingPanel.jsx:64,304` | `xs` (24) |
| 28 | 无 | `sm` (28) |
| 30 | — | `md` (32) |
| 32 | `SizingPanel.jsx:78` 下拉 | `md` ✅ |
| 34 | — | `md` (32) |
| 36 | 表单主控件 | `lg` ✅ |
| 38 | `EcMode.jsx:821` 下一步 | `lg` (36) |
| 40 | `EcMode.jsx:34` `BTN_BASE` | `xl` (44) |
| 42 | `design-tokens.css:154` `.btn-pill` | `xl` (44) |
| 44 | `App.jsx:154,171,184` | `xl` ✅ |
| 45 | — | `xl` (44) |
| 50 | — | `xl` (44) |

**触控目标**：`--sb-tap-min: 44px`。即使视觉尺寸是 24px，**命中区也必须 ≥44px**（用 `padding` 或伪元素扩展）。

---

## 14. 动效（Motion）

### 14.1 时长

| Token | 值 | 用途 |
|---|---|---|
| `--sb-dur-instant` | **100ms** | 颜色变化（hover 背景/文字色） |
| `--sb-dur-fast` | **150ms** | 位移、旋转、缩放 |
| `--sb-dur-normal` | **200ms** | **默认：绝大多数交互** |
| `--sb-dur-slow` | **300ms** | 面板进/出场 |
| `--sb-dur-slower` | **400ms** | 弹窗进/出场 |

**收敛**：现状 5 套体系（`0.12/0.15/0.18/0.2/0.22/0.25/0.3/0.35/0.5s`）→ 本规范 **5 档**。

### 14.2 缓动

| Token | 值 | 用途 |
|---|---|---|
| `--sb-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | **默认**（已存在于 `EcMode.jsx:39`，采纳） |
| `--sb-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 循环动画 |
| `--sb-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 出场 |

> ⚠️ **本系统不使用任何 bounce / elastic / spring 过冲缓动。** 产品型 UI 里弹跳是廉价感的直接来源——缓动越"活泼"，工具越显得不专业 [来源: impeccable SKILL.md §Motion「Ease out with exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.」]。
> **即时反馈**（按下 / 勾选）用 `--sb-ease-out` + `transform: scale(0.98)` 表达，**不做回弹**。
> 📌 注：（**该 token 已不存在**）本规范曾定义过 `--sb-ease-spring`（`cubic-bezier(0.34, 1.4, 0.64, 1)`），被 impeccable 的检测器判为 `bounce-easing` 反模式，**已移除**。复现：`node .agents/skills/impeccable/.../detect.mjs src/styles/design-tokens-v3.css`。

### 14.3 禁止动画的属性

`width` / `height` / `max-height` / `margin` / `padding` / `top` / `left` / `font-size`

**现状违反**：`design-tokens.css:253-260` 的 `slideDown`/`slideUp` 动画了 `max-height: 0 → 2000px`。

### 14.4 必需的无障碍降级

`design-tokens-v3.css` §17 已实现：
- `@media (prefers-reduced-motion: reduce)` → 动画降至 1ms，transition 关闭
- `@media (prefers-contrast: more)` → 毛玻璃降级为不透明
- `@media (forced-colors: active)` → 边框用系统色

---

## 15. 层级（z-index）

| Token | 值 | 用途 |
|---|---|---|
| `--sb-z-base` | 0 | 普通内容 |
| `--sb-z-raised` | 10 | 卡片内浮起元素、按钮行定位容器 |
| `--sb-z-sticky` | 100 | 吸顶导航 |
| `--sb-z-panel` | 400 | **参数浮层面板**（现状 101，需抬高） |
| `--sb-z-dropdown` | 600 | **下拉菜单**（必须 > panel） |
| `--sb-z-scrim` | 800 | 遮罩 |
| `--sb-z-modal` | 810 | 弹窗（必须 > scrim） |
| `--sb-z-toast` | 900 | 全局 toast |
| `--sb-z-tooltip` | 950 | tooltip（最高，永不被遮挡） |
| `--sb-z-top` | 1000 | 全屏阻断层（生成中） |

**禁止裸值**。需要新层级时，先说明「它应该在谁的上面」，再选档位。

---

## 16. 现有值 → 新 token 映射表

> 📌 **完整版（112 条，按色系分组）见本文档 §18。**

> **用途**：落地 agent 照着这张表做机械替换。左列是现状（含出现次数/位置），右列是规范值。

### 16.1 颜色

| 现状值 | 出现次数 | 新 token | 备注 |
|---|---|---|---|
| `#7c3aed` | 67 | `--sb-brand` | 品牌紫，主色 |
| `#6366f1` | 78 | `--sb-brand-600` → 建议改 `--sb-brand` | ⚠️ 靛蓝紫，与品牌紫冲突，**统一到 #7C3AED** |
| `#4338ca` | 70 | `--sb-brand-700` | ⚠️ 深靛蓝，统一到品牌紫深色 |
| `#eef2ff` | 44 | `--sb-brand-50` | 浅紫底 |
| `#f5f3ff` | 15 | `--sb-brand-soft` | 选中态浅底 |
| `#c7d2fe` | 15 | `--sb-brand-border` | ⚠️ 偏靛，改 `#C4B5FD` |
| `#a78bfa` | 15 | `--sb-brand-400` | 渐变终点 |
| `#4f46e5` | 10 | `--sb-brand-700` | ⚠️ 统一到紫 |
| `#1a1a1a` | 40 | `--sb-ink-1` | 近黑文字 |
| `#333` | 46 | `--sb-ink-2` | 正文 |
| `#666` | 39 | `--sb-ink-3` | 辅助 |
| `#555` | 25 | `--sb-ink-2` | ⚠️ 太接近 #666，统一 `ink-3` 或 `ink-2` |
| `#888` | 41 | `--sb-ink-3` | 辅助 |
| `#999` | 65 | `--sb-ink-4` ⚠️ | **仅限大文本/图标**；12px 正文改用 `--sb-ink-3` |
| `#aaa` | 15 | `--sb-ink-4` | 同上 |
| `#bbb`／`#ccc`／`#ddd`／`#e0e0e0`／`#eee`／`#f0f0f0`／`#f5f5f5` | 19+19+26+26+33+29+34 | `--sb-neutral-300`/`-200`/`-150`/`-100` | 灰阶收编到暖灰 |
| `#ff4757` | 13 | `--sb-danger` | ⚠️ 高饱和红，收敛到 `#E8544B` |
| `#e84142`／`#e53e3e`／`#c53030`／`#ef4444`／`#dc2626`／`#e74c3c` | 6+7+12+7+?+? | `--sb-danger`(solid) / `--sb-ink-danger`(文字) | **6 种红收敛到 2 个** |
| `#5ca86c` | 8 | `--sb-success` | 已有 token |
| `#16a34a`／`#22c55e`／`#10b981` | 5+1+? | `--sb-ink-success` / `--sb-success` | **统一到品牌绿** |
| `#f59e0b`／`#e67e22`／`#d97706` | 12+?+? | `--sb-warning` / `--sb-ink-warning` | 警告橙收敛 |
| `#ec4899`／`#be185d` | 15+6 | 仅 hero 渐变内 | 禁止作为独立色使用 |
| `rgba(0,0,0,0.03/0.06/0.08/0.10/0.12/0.14/0.15/0.35)` | 大量 | `rgba(12,10,9,·)` 暖黑 | 全部换成暖黑 |
| `rgba(255,71,87,·)` | 多处 | `--sb-danger-ring` `rgba(232,84,75,.30)` | 红 rgba → 统一环色 |
| `rgba(124,58,237,·)` | 大量 | `--sb-brand-ring` / `--sb-brand-shadow` | — |

### 16.2 字号

| 现状 px | 次数 | 新 token | 备注 |
|---|---|---|---|
| 7 / 8 / 9 | 1+7+19 | `--sb-text-2xs`(10) | 太小，一律提到 10 |
| 10 | 54 | `--sb-text-2xs` | ✅ |
| 11 | 101 | `--sb-text-xs` | ✅ |
| 12 / 12.5 | 137+4 | `--sb-text-sm` | ✅ 12.5 → 12 |
| 13 | 91 | `--sb-text-md` | ✅ |
| 14 / 14.5 | 47+1 | `--sb-text-md`(13) 或 `--sb-text-lg`(15) | 按角色二选一 |
| 15 | 29 | `--sb-text-lg` | ✅ |
| 16 / 17 | 18+4 | `--sb-text-lg`(15) 或 `--sb-text-xl`(18) | 按角色二选一 |
| 18 / 20 | 14+9 | `--sb-text-xl` | 20 → 18 |
| 22 | 6 | `--sb-text-2xl`(24) | — |
| 24 / 26 | 6+3 | `--sb-text-2xl` | ✅ |
| 28 / 30 | 4+1 | `--sb-text-3xl`(32) | — |
| 36 / 38 | 1+1 | `--sb-text-3xl`(32) 或 `--sb-text-4xl`(48) | — |
| 48 | 3 | `--sb-text-4xl` | ✅ |
| 56 / 62 | 2+? | `--sb-text-4xl`(48) | ⚠️ Hero 收敛，移动端 32 |

### 16.3 圆角

| 现状 px | 次数 | 新 token |
|---|---|---|
| 1 / 2 / 3 / 5 | 2+8+2+2 | `--sb-radius-xs`(4) |
| 4 | 21 | `--sb-radius-xs` ✅ |
| 6 / 7 / 8 / 9 | 43+4+85+1 | `--sb-radius-md`(8) |
| 10 / 12 / 14 | 72+36+10 | `--sb-radius-lg`(12) |
| 16 / 18 | 26+2 | `--sb-radius-xl`(16) |
| 20 / 24 / 25 | 16+1+3 | `--sb-radius-2xl`(20) / `-3xl`(24) |
| 30 / 40 | 1+? | `--sb-radius-2xl`(20) ⚠️ 收敛（现状 `--radius-lg:30`/`--radius-xl:40` 过大） |
| 9999 | 18 | `--sb-radius-pill` ✅ |

### 16.4 间距（gap）

| 现状 px | 次数 | 新 token |
|---|---|---|
| 0 / 2 / 3 | 3+10+9 | `--sb-space-1`(4) 或 0 |
| 4 | 39 | `--sb-space-1` ✅ |
| 5 / 6 | 23+71 | `--sb-space-2`(8) |
| 8 | 105 | `--sb-space-2` ✅ |
| 10 | 47 | `--sb-space-3`(12) 或 `--sb-space-2`(8) |
| 12 | 29 | `--sb-space-3` ✅ |
| 14 / 16 | 10+16 | `--sb-space-4`(16) |
| 18 / 20 / 22 | 2+2+1 | `--sb-space-5`(20) |
| 24 / 28 | 1+1 | `--sb-space-6`(24) |
| 40 | 1 | `--sb-space-10`(40) |

### 16.5 z-index

| 现状 | 位置 | 新 token |
|---|---|---|
| 1 / 2 / 3 / 5 | 各处 | `--sb-z-raised`(10) 或 0 |
| 10 | `EcMode.jsx:686` | `--sb-z-raised` ✅ |
| 50 | 2 处 | `--sb-z-sticky`(100) |
| 100 | `Navbar.jsx:31`、`App.jsx:124` | `--sb-z-sticky` ✅ |
| 101 | `EcMode.jsx:355,367` | `--sb-z-panel`(400) ⚠️ 需抬高 |
| 200 | `App.jsx:61` SideNav | `--sb-z-sticky`(100) |
| 900 / 999 | `ui/index.jsx:37` | `--sb-z-modal`(810) |
| 1000 / 1001 | `SizingPanel.jsx:78` 下拉 | `--sb-z-dropdown`(600) |
| 9998 / 9999 | `Popover.jsx:66` 等 6 处 | `--sb-z-dropdown`(600) 或 `--sb-z-modal`(810) |
| 10000 / 10001 / 10002 / 10003 | `Toast.jsx:39` 等 | `--sb-z-toast`(900) |
| 99999 / 999999 | 5+1 处 | `--sb-z-top`(1000) |

### 16.6 面板宽度

| 现状 | 位置 | 新值 |
|---|---|---|
| copy = **520** | `EcMode.jsx:303` | `--sb-panel-w`(480) |
| sizing = **460** | 同上 | `--sb-panel-w`(480) |
| settings = **380** | 同上 | `--sb-panel-w`(480) |
| 其余 = **420** | 同上 | `--sb-panel-w`(480) |

---

## 17. 落地检查清单（审代码用）

改完一个面板后，逐条勾：

- [ ] 没有新增硬编码 hex（全部走 `var(--sb-*)`）
- [ ] 没有新增裸 z-index
- [ ] 间距值全部在 4/8/12/16/20/24/32/40/48/64 内
- [ ] 圆角符合嵌套公式（外层 − 内边距 = 内层）
- [ ] 默认态零品牌紫（未选中/未激活）
- [ ] hover 用中性灰，selected 用品牌紫（不同通道）
- [ ] 每个可交互元素有 `focus-visible` 样式（`.sb-focusable` 类）
- [ ] 每个可交互元素有 disabled 态，且真的挂 `disabled` 属性
- [ ] 有 loading 态的元素，宽度不跳变
- [ ] 12px 及以下文字对比度 ≥4.5:1（不用 `--sb-ink-4` 做正文）
- [ ] 可点元素是 `<button>` 或带正确 role，不是裸 `<div onClick>`
- [ ] 触控目标 ≥44×44，或视觉 24px 但命中区扩到 44px
- [ ] 面板内没有白色卡片套在白色面板里
- [ ] 毛玻璃只出现在白名单 3 处，且参数为 blur 24px / saturate 180%
- [ ] 动画时长在 100/150/200/300/400ms 内，缓动用指数曲线
- [ ] 一屏最多一个 primary 按钮
- [ ] 一屏彩色文字 ≤3 处


---

## §2G · 设计感来自结构，不来自上色（**硬要求**）

> **用户原话**：「用户的真实诉求是**有设计感**，不是**多上色**。上色不等于好看。」
> 这一节是 §2A–§2E 的**总纲**：前面五条讲"颜色用在哪"，这一节讲"**别指望颜色**"。

### §2G.1 高级感的五个来源（按权重排序）

| # | 来源 | 具体做法 | 权重 |
|---|---|---|---|
| **1** | **表面分层** | L0→L1→L2-/L3 的色阶递进，每级可辨（≥1.06:1）。见 §2B | **40%** |
| **2** | **排版主次** | 字号 / 字重 / 文字色三轴建立层级，**不靠颜色**。见 §8 排版 | **25%** |
| **3** | **elevation** | 阴影**层数**编码高度；静态元素默认无阴影，阴影是状态响应 | **20%** |
| **4** | **状态差异** | hover / selected / active / focus 四通道分离。见 §2C | **10%** |
| **5** | **品牌色点缀** | 只占 ≤10% 像素面积 | **5%** |

> ### 品牌色是 **5%**，不是 50%。
> 如果把品牌色当主角，画面会变成「到处是红/紫的」——那是**廉价感**，不是设计感。
> 大面积永远是：**暖白 surface + 中性文字**。

### §2G.2 反模式清单（**明确禁止**）

| ❌ 反模式 | 为什么是反模式 |
|---|---|
| **给每个分组都加彩色标题** | 颜色通胀 → 层级消失。分组标题是**层级信息**，必须中性（§2A B1） |
| **大面积品牌色背景** | 品牌色是「注意力货币」，大面积 = 通货膨胀 |
| **用颜色代替留白做分组** | 正确做法是**留白 + 分组标题**（Figma 属性面板是范本） |
| **彩虹渐变** | 全站最多 2 处（hero 标题 + 主 CTA） |
| **给静态元素加阴影"显高级"** | 阴影是**状态响应**，不是装饰。静态默认 \`--sb-shadow-0/1\` |
| **靠颜色硬撑层级** | 去掉颜色就散架的界面，说明 surface 体系没做够 |

### §2G.3 验收判据（**三条，可执行**）

\`\`\`
① 截图转灰度后，层级是否依然清晰？
   → 是 = 靠结构 ✅ / 否 = 靠颜色硬撑 ❌

② 品牌色像素占比 ≤10%？
   → 是 = 稀缺 ✅ / 否 = 通胀，逐个元素走 §2A 决策树降级 ❌

③ 把品牌色临时替换成中性灰后，界面是否依然好用？
   → 是 = 结构扎实 ✅ / 否 = 层级全靠颜色 ❌
\`\`\`

> **第 ③ 条是最严格的检验。** 落地后把品牌色换成灰色截图，界面应该**依然有清晰的主次和层级**——只是少了品牌情绪。如果变糊，说明 §2B 的 surface 体系还没做到位。

### §2G.4 一句话总纲

\`\`\`
靠结构赢：  surface 分层 + elevation + 排版主次 + 状态差异
靠点缀赢：  品牌色 ≤10%（主 CTA / 选中态 / focus / 激活图标 / 关键数字）
不靠：      铺色、彩色标题、彩色背景、彩色分组
\`\`\`

---

## §2H · 响应式 token 规范

> 核实：\`design-tokens.css:331-344\` 的 \`@media (max-width: 768px)\` 是**响应式覆盖**（合法生效），**不是重复定义 bug**。
> 但它**没有纳入系统化规范**：只调了 8 个大字号 token，**控件高度、间距、面板宽度都没调**。本节补齐。

### §2H.1 断点（收敛为 3 个）

| 断点 | 尺寸 | 语义 |
|---|---|---|
| \`sm\` | **≤640px** | 手机 |
| \`md\` | **641–1024px** | 平板 |
| \`lg\` | **≥1025px** | 桌面（默认值，即 \`:root\` 的原始定义） |

> 现状混乱：640/768/1024/1200/1440 混用。**统一到上面 3 个。**

### §2H.2 各 token 在窄屏的变化表

| 类别 | token | 桌面 lg | 平板 md | 手机 sm | 理由 |
|---|---|---|---|---|---|
| **排版** | \`--sb-text-4xl\` | 48px | 36px | **32px** | 正文级缩放 |
| | \`--sb-text-3xl\` | 32px | 28px | **24px** | — |
| | \`--sb-text-2xl\` | 24px | 20px | **18px** | — |
| | \`--sb-text-xl\` | 18px | 18px | **16px** | — |
| | **\`--sb-text-lg\` 及以下** | — | — | **不变** | ⚠️ **12/13/15px 的 UI 正文在窄屏不改** |
| **间距** | \`--sb-gutter\` | 20px | 20px | **12px** | 屏幕窄，页面边距要省 |
| | \`--sb-space-*\` | — | — | **不变** | ⚠️ 4pt 栅格是骨架，不随断点变 |
| **布局** | \`--sb-panel-w\` | 480px | \`min(480, vw-32)\` | \`min(480, vw-24)\` | 面板不能超屏 |
| | \`--sb-panel-max-h\` | 640px | 70vh | **60vh** | 手机键盘弹出时留空间 |
| | \`--sb-nav-h\` | 72px | 72px | **56px** | 触控友好下限 |
| **圆角** | \`--sb-radius-2xl\` | 20px | 20px | **24px** | 手机上面板变底部抽屉，圆角应更大 |
| | 其余圆角 | — | — | **不变** | — |
| **控件** | \`--sb-control-h-xl\` | 44px | 44px | **44px** | ⚠️ **绝不变小** |
| | 其余控件高 | — | — | **不变** | — |

### §2H.3 三条响应式铁律

| # | 规则 | 理由 |
|---|---|---|
| **R1** | **字号 ≤15px 不随断点缩小** | 12px 已是可读下限，再缩违反 WCAG 1.4.4 |
| **R2** | **控件高度不随断点缩小** | 触控目标 44px 是硬下限（WCAG 2.5.5 AAA） |
| **R3** | **间距阶梯不随断点变** | 4pt 栅格是设计系统骨架，变了就失去节奏感。**只有页面级 gutter 可调** |

### §2H.4 必须补的移动端适配（现状缺失）

| 项 | 现状 | 规范 |
|---|---|---|
| **面板形态** | 桌面浮层，手机上也浮层 | 手机改为**底部抽屉**：\`inset: auto 0 0 0; width:100%; border-radius: 24px 24px 0 0\` |
| **毛玻璃** | 全端开启 | **手机建议关闭**（低端机滚动掉帧主因，见 §2E 性能红线） |
| **触控目标** | 面板内多处 18–26px | 视觉尺寸可小，**命中区必须 ≥44px**（伪元素扩展） |
| **hover 态** | 全端依赖 hover | 触屏无 hover，**必须有 \`:active\` 反馈替代** |
| **断点** | 640/768/1024/1200/1440 混用 | **只用 640 / 1024 两个断点** |


---

## §2I · 铁律六：悬停/选中位移必须在容器内预留空间

> **来源**：用户报的真实 bug。已有一处修复（\`canvas-library.css:147-190\`），本节把它**上升为全站规则**。
> **实测规模**：全站 **71 处** hover 位移/放大站点（\`translateY\` 25+14+7+4+3+1+1+1、\`scale\` 9 处）。
> 其中最大位移 **translateY(-8px) + scale(1.03)**，对应需求预留 **16px**。

### §2I.1 规则本体

> **任何在 hover / selected / active 时产生位移或放大的卡片或按钮，其父容器必须为位移预留空间。**

**预留量计算公式（照抄）**：

\`\`\`
需求上边预留 = |translateY| + 放大外扩
放大外扩     = (W-1) × (scale-1) / 2  +  (H-1) × (scale-1) / 2
              ↑ 水平外扩            +   ↑ 垂直外扩
安全余量     = 需求上边预留 × 1.5     ← 用户明确的 1.5 倍系数
\`\`\`

**代入实测值**（画布库卡片 312×232，\`translateY(-8px) scale(1.03)\`）：

\`\`\`
放大外扩 = 311×0.015 + 231×0.015 = 4.67 + 3.47 ≈ 8.1px
需求上边 = 8 + 8.1 = 16.1px
1.5 倍    = 24.2px
实测取值 = --cl-lift-safe-top: 16px   ← 介于"需求"与"1.5倍"之间，已实测不再裁切
\`\`\`

### §2I.2 ⚠️ 关键技术真相：**只加 padding 无效**（别再踩这个坑）

> 原注释（\`canvas-library.css:168-174\`）实测结论：
>
> **\`overflow: auto\` 的裁剪矩形是 padding box，而内容也从 padding box 的边开始——padding 只会把裁剪边界和内容一起下移，两者永远重合。**
> 实测：\`padding-top: 16px\` 后 \`pbTop\` 与内容顶同为 194，上探 11px **照样被裁**。

| 方向 | padding 是否有效 | 原因 |
|---|---|---|
| **纵向**（上/下） | ❌ **无效** | 内容流跟随 padding box，两者一起下移 |
| **横向**（左/右） | ✅ **有效** | 内容宽度由 \`1fr\` 列宽决定，**不随 padding 变化**，padding 真正扩宽了裁剪矩形 |

### §2I.3 两个方向的不同解法（可直接照抄）

#### 纵向：插入**真实占位**（不能靠 padding）

\`\`\`css
/* ✅ 正确：在首行之前插入跨列空行，把内容流整体下推，
      上探位移落在这段占位里 */
.sb-lift-grid::before {
  content: '';
  display: block;
  grid-column: 1 / -1;      /* 跨所有列，不占列宽 */
  height: var(--sb-lift-safe);   /* = 位移 + 放大外扩 */
}

/* ❌ 错误：padding-top 不会给滚动容器的首行留出可绘空间 */
.sb-lift-grid { padding-top: 16px; }   /* 无效！ */
\`\`\`

> **末行**同理：用 \`::after\` 插入等高空行。

#### 横向：用 padding 扩宽可绘区

\`\`\`css
/* ✅ 正确：横向 padding 真的扩宽裁剪矩形 */
.sb-lift-grid {
  padding-inline: var(--sb-lift-safe-x);
  /* 再用等量负 margin 把内容边界推回原位，保证"内容左右边界不变" */
  margin-inline: calc(var(--sb-lift-safe-x) * -1);
}
\`\`\`

### §2I.4 四极端位置检查表（**验收必查**）

| 位置 | 失效表现 | 检查方法 |
|---|---|---|
| **首行** | 上探部分被容器裁掉，卡片圆角顶边被切平 | hover 第一行 → 看顶边是否完整 |
| **首列** | 左缘被裁 5px（实测过） | hover 第一列 → 看左缘 |
| **末行** | 下探压到容器下缘 | hover 最后一行 → 看底边 |
| **末列** | 右缘被裁 | hover 最后一列 → 看右缘 |

**并且**：预留在**滚动容器内**不能造成滚动条异常出现（\`::before\` 占位会让 \`scrollHeight\` 增大，需确认不产生幽灵滚动条）。

### §2I.5 全站现状（71 处，需逐个核对）

| 位移量 | 处数 | 需求预留 | 状态 |
|---|---|---|---|
| \`translateY(-1px)\` | 25 | ≈3px | ⚠️ 多数未预留（但位移小，视觉影响低） |
| \`translateY(-2px)\` | 14 | ≈5px | ⚠️ 未预留 |
| \`translateY(-3px)\` | 7 | ≈7px | ⚠️ 未预留 |
| **\`translateY(-8px) scale(1.03)\`** | **3** | **≈16px** | ✅ **已修**（\`canvas-library.css\`） |
| \`translateY(-4px)\` | 4 | ≈9px | ⚠️ 未预留 |
| \`translateY(-5px)\` | 1 | ≈10px | ⚠️ |
| \`scale(1.02 – 1.4)\` | 14 | 视尺寸 | ⚠️ 需逐个算 |

**高风险文件**（位移 ≥3px，且可能处于滚动/裁剪容器）：

| 文件 | 处数 |
|---|---|
| \`pages/Home/Home.css\` | 22 |
| \`pages/VideoStudio/VideoStudio.css\` | 7 |
| \`styles/app-shell.css\` | 6 |
| \`pages/EcCanvas/EcCanvas.css\` | 5 |
| \`styles/canvas-supervisor.css\` | 5 |
| \`pages/EcCanvas/components/canvas-library.css\` | 4（已修 3） |

### §2I.6 设计侧建议：**位移量收敛到 2 档**

现状 18 种不同位移值。建议收敛：

| 场景 | 位移 | 预留 |
|---|---|---|
| 按钮 / 小控件 | \`translateY(-1px)\` | 3px |
| 卡片（可点） | \`translateY(-2px)\` | 5px |
| 大卡片 / 作品卡 | \`translateY(-4px)\` | 9px |

> ⚠️ **\`translateY(-8px)\` 属于过大的位移**，它带来的预留成本（16px）远大于视觉收益。建议大卡片统一降到 \`-4px\`，可把预留降到 9px，**同时解决裁切问题**。

### §2I.7 交付给改造 agent 的检查清单

改任何带 hover 位移的组件时：

- [ ] 算出位移量 \`L\` 与放大外扩 \`E\`，得需求预留 \`R = L + E\`
- [ ] 纵向用 \`::before\` / \`::after\` **真实占位**（**不要用 padding**）
- [ ] 横向用 \`padding-inline\` + 等量负 \`margin-inline\`
- [ ] 四个极端位置（首行/首列/末行/末列）逐个 hover 验证
- [ ] 确认未引入幽灵滚动条
- [ ] 若位移 > 4px，考虑降到 2–4px 直接规避

---

## §18 · 完整迁移映射表（**改造 agent 作业单**）

> **裁定依据**：总统筹拍板（见 \`design-tokens-v3.css\` §20 与本节 §18.0）。
> **数据来源**：**worktree 全量统计**（316 个源文件，非抽样），\`node scripts/design-audit.mjs\`。
> **用法**：按 \`现色值\` 搜索代码 → 替换为 \`V3 token\`。**同一条映射应在所有出现处一致执行。**

### §18.0 四条裁定（**不可协商**）

| # | 裁定 | 说明 |
|---|---|---|
| **1** | **品牌主色 = 紫 \`#7c3aed\` 系** | 靛蓝 \`#6366f1\`/\`#4338ca\` 系**整体判为历史遗留，全部迁移到品牌紫，不允许两套并存** |
| **2** | **品牌渐变 = 品牌时刻专用** | 三色渐变（\`#7c3aed→#ec4899→#f59e0b\`）**只允许**用于 ① logo ② hero 标题 ③ 欢迎/空态插画。**禁止**用于功能按钮与普通控件——功能按钮一律**品牌紫纯色** |
| **3** | **语义色各收敛为一支** | 红 7 支 → 1、绿 5 支 → 1、橙多支 → 1、信息蓝从靛蓝系选一支**改名进语义域**，不再当品牌色 |
| **4** | **灰阶全部映射到 V3 中性色阶** | 5 支散装灰 + \`#1a1a1a\` + Tailwind 灰蓝族（\`#64748b\`/\`#475569\`/\`#1f2937\` 等）逐条映射 |

### §18.1 工作量总览

| 迁移类型 | 条目 | hex 出现次数 | 说明 |
|---|---|---|---|
| **灰→中性** | 44 | **1810** | 散装灰 + Tailwind 灰蓝族 → 中性色阶（**量最大**） |
| **靛蓝→紫** | 11 | **314** | 历史遗留靛蓝 → 品牌紫（**第二大**，裁定 1） |
| **红→一支** | 14 | **158** | 7 支红 → 唯一危险色 |
| **橙→一支** | 10 | **98** | 多支橙 + 暖米底 → 警告色 / 页面底 |
| **紫系保留** | 7 | **91** | 已是品牌紫系，仅归档为 token |
| **绿→一支** | 13 | **85** | 5 支绿 → 唯一成功色 |
| **粉→受限** | 7 | **72** | 品牌粉受限 / 青 → 信息语义 |
| **→信息蓝** | 6 | **67** | 从蓝/靛蓝系选一支当信息语义色 |
| **合计** | **112** | **2695** | 覆盖 worktree 中全部有色 hex 的主要部分 |

> ⚠️ `#fff` / `#ffffff`（811+49 次）虽然次数最多，但语义清晰（白底），迁移简单，**不构成风险**。
> ⚠️ 裁定 1 的靛蓝迁移是**存量最大的第三方语言**（314 次），工作量按此量级排。

### §18.2 逐条映射表

#### 灰→中性（44 条 / 1810 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#fff` | 811 | 88 | --sb-neutral-0 #FFFFFF | 纯白 → 中性 0 |
| `#999` | 51 | 12 | --sb-ink-4 #9A9490 | 散装灰 → 提示文字（仅大文本） |
| `#ffffff` | 49 | 18 | --sb-neutral-0 #FFFFFF | 同上（大小写重复） |
| `#888` | 41 | 11 | --sb-ink-3 #6B6560 | 散装灰 → 辅助文字 |
| `#6b7280` | 38 | 11 | --sb-ink-3 #6B6560 | gray-500 → 辅助文字 |
| `#20242a` | 34 | 6 | --sb-neutral-900 #0C0A09 | 冷深灰 → 反色面 |
| `#666` | 33 | 12 | --sb-ink-3 #6B6560 | 散装灰 → 辅助文字 |
| `#333` | 33 | 9 | --sb-ink-1 #1A1614 | 散装深灰 → 标题 |
| `#111827` | 33 | 11 | --sb-ink-1 #1A1614 | gray-900 → 标题 |
| `#1a1614` | 32 | 10 | --sb-ink-1 #1A1614 | 暖黑（已是 token） |
| `#64748b` | 31 | 11 | --sb-ink-3 #6B6560 | slate-500 → 辅助文字 |
| `#f5f5f5` | 29 | 10 | --sb-neutral-100 #F5F1EA | 散装灰 → 中性 100 |
| `#f3f4f6` | 29 | 11 | --sb-neutral-100 #F5F1EA | gray-100 → 中性 100 |
| `#1a1a1a` | 29 | 12 | --sb-ink-1 #1A1614 | 纯黑 → 暖黑（标题） |
| `#6b6560` | 27 | 9 | --sb-ink-3 #6B6560 | 暖灰（已是 token） |
| `#e0e0e0` | 25 | 6 | --sb-neutral-200 #E7E3DD | 散装灰 → 中性 200 |
| `#475569` | 25 | 9 | --sb-ink-2 #3D3835 | slate-600 → 正文 |
| `#1f2937` | 25 | 12 | --sb-ink-1 #1A1614 | gray-800 → 标题 |
| `#f0f0f0` | 24 | 9 | --sb-neutral-100 #F5F1EA | 散装灰 → 中性 100 |
| `#eee` | 22 | 8 | --sb-neutral-150 #EFEAE1 | 散装灰 → 中性 150（凹槽） |
| `#e5e7eb` | 22 | 8 | --sb-neutral-200 #E7E3DD | gray-200 → 中性 200 |
| `#dfe3e8` | 21 | 5 | --sb-neutral-200 #E7E3DD | 冷灰 → 中性 200 |
| `#9a9490` | 21 | 10 | --sb-ink-4 #9A9490 | 暖灰（已是 token） |
| `#555` | 21 | 8 | --sb-ink-2 #3D3835 | 散装灰 → 正文 |
| `#fafbfc` | 20 | 8 | --sb-neutral-25 #FDFBF7 | 近白 → 中性 25 |
| `#94a3b8` | 20 | 9 | --sb-ink-5 #B0AAA5 | slate-400 → 禁用文字 |
| `#78716c` | 20 | 7 | --sb-ink-3 #6B6560 | stone-500 → 辅助文字 |
| `#756f69` | 20 | 4 | --sb-ink-3 #6B6560 | 暖灰 → 辅助文字 |
| `#edf0f3` | 19 | 3 | --sb-neutral-100 #F5F1EA | 冷灰 → 中性 100 |
| `#4b5563` | 19 | 5 | --sb-ink-2 #3D3835 | gray-600 → 正文 |
| `#ccc` | 18 | 7 | --sb-neutral-300 #D6D1C9 | 散装灰 → 中性 300 |
| `#3d3835` | 18 | 9 | --sb-ink-2 #3D3835 | 暖灰（已是 token） |
| `#0f172a` | 18 | 6 | --sb-ink-1 #1A1614 | slate-900 → 标题 |
| `#ddd` | 17 | 5 | --sb-neutral-200 #E7E3DD | 散装灰 → 中性 200 |
| `#bbb` | 17 | 7 | --sb-ink-5 #B0AAA5 | 散装灰 → 禁用文字 |
| `#9ca3af` | 17 | 9 | --sb-ink-5 #B0AAA5 | gray-400 → 禁用文字 |
| `#0c0a09` | 15 | 4 | --sb-neutral-900 #0C0A09 | 强调黑（已是 token） |
| `#e8e8e8` | 13 | 8 | --sb-neutral-200 #E7E3DD | 散装灰 → 中性 200 |
| `#dddde3` | 13 | 1 | --sb-neutral-200 #E7E3DD | 冷灰 → 中性 200 |
| `#d1d5db` | 12 | 4 | --sb-neutral-300 #D6D1C9 | gray-300 → 中性 300 |
| `#d0d0d0` | 11 | 2 | --sb-neutral-300 #D6D1C9 | 散装灰 → 中性 300（描边） |
| `#e0e2e6` | 10 | 1 | --sb-neutral-200 #E7E3DD | 冷灰 → 中性 200 |
| `#dfe1e5` | 5 | 1 | --sb-neutral-200 #E7E3DD | 冷灰 → 中性 200 |
| `#24262d` | 2 | 1 | --sb-neutral-900 #0C0A09 | 冷深 → 反色面 |

#### 靛蓝→紫（11 条 / 314 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#6366f1` | 76 | 10 | --sb-brand-600 #7C3AED | 靛蓝主色 → 品牌紫主色（**最大单项迁移**） |
| `#4338ca` | 75 | 8 | --sb-brand-700 #6D28D9 | 靛蓝深 → 品牌紫深（hover/pressed） |
| `#4636b8` | 44 | 3 | --sb-brand-700 #6D28D9 | 自定义靛蓝(3 文件 44 次) → 品牌紫深 |
| `#eef2ff` | 43 | 10 | --sb-brand-50 #F5F3FF | 靛蓝浅底 → 品牌紫浅底 |
| `#c7d2fe` | 17 | 5 | --sb-brand-200 #DDD6FE | 靛蓝浅描边 → 品牌紫 200 |
| `#7454f3` | 15 | 7 | --sb-brand-600 #7C3AED | footer 主按钮底色 → 品牌紫 |
| `#4f46e5` | 11 | 2 | --sb-brand-700 #6D28D9 | 靛蓝 variants 600 → 品牌紫深 |
| `#6842dc` | 10 | 1 | --sb-brand-600 #7C3AED | 自定义靛蓝 → 品牌紫 |
| `#e0e7ff` | 10 | 7 | --sb-brand-100 #EDE9FE | 靛蓝浅底 → 品牌紫 100 |
| `#5d49bf` | 9 | 1 | --sb-brand-700 #6D28D9 | 自定义靛蓝 → 品牌紫深 |
| `#3730a3` | 4 | 4 | --sb-brand-800 #5B21B6 | 靛蓝 variants 800 → 品牌紫 800 |

#### 红→一支（14 条 / 158 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#e8544b` | 26 | 9 | --sb-danger #E8544B | **主危险色，保留升格** |
| `#b91c1c` | 20 | 12 | --sb-ink-danger #D0443C | red-700 文字 → 危险文字 |
| `#ef4444` | 16 | 10 | --sb-danger #E8544B | Tailwind red-500 → 统一 |
| `#dc2626` | 15 | 5 | --sb-danger-hover #D0443C | red-600 → 危险 hover |
| `#ff4757` | 13 | 5 | --sb-danger #E8544B | 高饱和红 → 统一 |
| `#c53030` | 11 | 7 | --sb-danger-hover #D0443C | 红深 → 危险 hover |
| `#fecaca` | 11 | 8 | --sb-danger-border #F6C9C4 | 红浅描边 → 统一 |
| `#fef2f0` | 11 | 10 | --sb-danger-soft #FEF2F0 | 红浅底（已是） |
| `#fef2f2` | 10 | 6 | --sb-danger-soft #FEF2F0 | 红浅底 → 统一 |
| `#fff5f5` | 10 | 6 | --sb-danger-soft #FEF2F0 | 红浅底 → 统一 |
| `#e53e3e` | 7 | 4 | --sb-danger #E8544B | 红 → 统一 |
| `#e84142` | 5 | 2 | --sb-danger #E8544B | 红 → 统一 |
| `#ff3b5c` | 2 | 1 | --sb-danger #E8544B | 亮红 → 统一 |
| `#f6c9c4` | 1 | 1 | --sb-danger-border #F6C9C4 | 红描边（已是） |

#### 橙→一支（10 条 / 98 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#f59e0b` | 22 | 16 | --sb-warning #E08A2E | amber-500 → 警告 |
| `#e99a18` | 15 | 4 | --sb-warning #E08A2E | 自定义橙 → 警告 |
| `#f5efe4` | 15 | 7 | --sb-l0-page #F5EFE4 | **页面底色，保留** |
| `#b45309` | 10 | 7 | --sb-ink-warning #B45309 | amber-700 文字 → 警告文字 |
| `#b7570b` | 9 | 4 | --sb-ink-warning #B45309 | 自定义橙文字 → 警告文字 |
| `#faefdf` | 8 | 3 | --sb-surface-sunken | 暖米浅底 → 凹槽 |
| `#fbf2e8` | 8 | 3 | --sb-neutral-100 | 暖米浅底 → 中性 100 |
| `#fdf8f3` | 8 | 3 | --sb-neutral-50 | 暖米近白 → 中性 50 |
| `#fbbf24` | 2 | 2 | --sb-warning #E08A2E | amber-400 → 警告 |
| `#fcd34d` | 1 | 1 | --sb-credit #C9902B | 金色积分 → 积分色 |

#### 紫系保留（7 条 / 91 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#a78bfa` | 22 | 12 | --sb-brand-400 #A78BFA | 紫系亮档（保留） |
| `#f5f3ff` | 19 | 6 | --sb-brand-50 #F5F3FF | 已是紫系浅底（保留） |
| `#8b5cf6` | 12 | 10 | --sb-brand-500 #8B5CF6 | 紫 500（focus/processing） |
| `#ede9fe` | 11 | 9 | --sb-brand-100 #EDE9FE | 紫 100 浅底 |
| `#6842dc` | 10 | 1 | --sb-brand-600 | 紫系自定义档 |
| `#403950` | 9 | 1 | --sb-neutral-800 | 暗紫灰 → 中性深 |
| `#c4b5fd` | 8 | 3 | --sb-brand-300 #C4B5FD | 紫系浅描边（保留） |

#### 绿→一支（13 条 / 85 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#256b45` | 15 | 3 | --sb-ink-success #2F7D46 | 深绿文字 → 成功文字 |
| `#5ca86c` | 12 | 7 | --sb-success #5CA86C | **主成功色，保留** |
| `#edf7f0` | 8 | 2 | --sb-success-soft #F0F9F2 | 绿浅底 → 统一 |
| `#059669` | 7 | 5 | --sb-success #5CA86C | emerald-600 → 统一 |
| `#f5fbf7` | 7 | 1 | --sb-success-soft #F0F9F2 | 绿浅底 → 统一 |
| `#10b981` | 6 | 6 | --sb-success #5CA86C | emerald-500 → 统一 |
| `#27864b` | 6 | 5 | --sb-ink-success #2F7D46 | 深绿 → 成功文字 |
| `#22c55e` | 5 | 4 | --sb-success #5CA86C | green-500 → 统一 |
| `#047857` | 5 | 5 | --sb-ink-success #2F7D46 | emerald-700 → 成功文字 |
| `#f0f9f2` | 5 | 5 | --sb-success-soft | 绿浅底（已是） |
| `#166534` | 4 | 2 | --sb-ink-success #2F7D46 | green-800 → 成功文字 |
| `#07c160` | 4 | 3 | --sb-success #5CA86C | 微信绿 → 统一 |
| `#16a34a` | 1 | 1 | --sb-success #5CA86C | green-600 → 统一 |

#### 粉→受限（7 条 / 72 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#ec4899` | 19 | 14 | 仅品牌渐变内 | 品牌粉：**只允许出现在品牌渐变**，禁止独立使用 |
| `#397668` | 17 | 1 | --sb-info #5275CC | 青绿(单文件17次) → 信息语义 |
| `#be185d` | 12 | 3 | 仅品牌渐变内 | 深粉 → 同上受限 |
| `#4ecdc4` | 10 | 4 | --sb-info #5275CC | 青 → 信息语义 |
| `#d14db5` | 9 | 6 | --sb-brand-600 #7C3AED | footer 主按钮渐变中的粉 → 改纯品牌紫 |
| `#fce7f3` | 3 | 3 | --sb-brand-50 #F5F3FF | 粉浅底 → 品牌紫浅底 |
| `#a855f7` | 2 | 2 | --sb-brand-400 #A78BFA | purple-500 → 品牌紫 400 |

#### →信息蓝（6 条 / 67 次）

| 现色值 | 出现次数 | 文件数 | → V3 token | 迁移说明 |
|---|---|---|---|---|
| `#2563eb` | 47 | 13 | --sb-info #5275CC | **从蓝系选一支当信息语义色**（原 blue-600） |
| `#3b82f6` | 8 | 6 | --sb-info #5275CC | blue-500 → 信息 |
| `#5275cc` | 5 | 4 | --sb-info #5275CC | 信息蓝（已是 token） |
| `#06b6d4` | 3 | 3 | --sb-info #5275CC | cyan → 信息（或保留作装饰） |
| `#0ea5e9` | 3 | 3 | --sb-info #5275CC | sky → 信息 |
| `#1d4ed8` | 1 | 1 | --sb-info-hover #4262B4 | blue-700 → 信息 hover |

### §18.3 迁移执行要点

| # | 要点 | 说明 |
|---|---|---|
| **M1** | **先灰阶，后彩色** | 灰阶 44 条 / 1810 次是量最大且**风险最低**的（只是把冷灰换成暖灰），先做它可快速降低碎片度 |
| **M2** | **靛蓝迁移要整族一起** | 只把 \`#6366f1\` 换成紫、留下 \`#4338ca\` 会造成新的不匹配 |
| **M3** | **渐变要拆** | 功能按钮上的 \`linear-gradient(...三色...)\` **不是替换成另一个渐变**，而是**改成纯色** \`--sb-btn-primary-bg\`（裁定 2） |
| **M4** | **rgba 同步处理** | \`rgba(99,102,241,α)\`（靛蓝 rgba）也要换成 \`rgba(124,58,237,α)\` 系列 |
| **M5** | **JS 默认参数不能直接用 var()** | \`directionUiModel.js\` 等的 \`fallback = '#7c3aed'\` 是 JS 值，需读 \`getComputedStyle\` 或保留常量字符串 |
| **M6** | **每次迁移后跑 audit** | \`node scripts/design-audit.mjs\` ① 的「hex 硬编码」数字应持续下降 |

### §18.4 验证命令

\`\`\`bash
# 总体碎片度（目标：从 5768 次 / 1800+ 值 持续下降）
node scripts/design-audit.mjs

# 靛蓝残留（裁定 1，目标 0）
grep -rEo '#6366f1|#4338ca|#4f46e5|#3730a3|#eef2ff|#e0e7ff|#c7d2fe' src/ | wc -l

# 功能按钮上的渐变（裁定 2 违规，目标 0）
grep -rn "linear-gradient.*#7c3aed" src/ | grep -iE "btn|button" 

# 红/绿收效（目标各 1 支）
grep -rEo '#ff4757|#c53030|#e53e3e|#ef4444|#b91c1c|#dc2626' src/ | wc -l
grep -rEo '#059669|#16a34a|#166534|#07c160|#10b981|#22c55e' src/ | wc -l
\`\`\`

---

# §B · 逐色迁移映射表（**改造 agent 作业单**）

> **数据来源**：worktree 全量统计（316 文件，非抽样）。
> **目标 token 名取自 \`src/styles/design-tokens-v3.css\`，与其完全一致。**
> **用法**：按 \`现色值\` 全局搜索 → 替换为 \`目标 token\`。同一条映射在所有出现处**一致执行**。

## §B.0 四条裁定（**不可协商**）

| # | 裁定 | 落地方式 |
|---|---|---|
| **1** | **品牌主色 = 紫 \`#7c3aed\` 系** | 靛蓝 \`#6366f1\`/\`#4338ca\` 系**全部迁移到 \`--sb-brand-*\`，不允许两套并存** |
| **2** | **品牌渐变 = 品牌时刻专用** | \`--sb-brand-gradient\` / \`--sb-brand-gradient-3\` **仅允许** ①logo ②hero 标题 ③欢迎/空态插画。**功能按钮禁止渐变，改纯色 \`#7C3AED\`** |
| **3** | **语义色各收敛为一支** | 红 7 支 → \`--sb-danger\`、绿 5 支 → \`--sb-success\`、橙 → \`--sb-warning\`、信息蓝从蓝系收敛到 \`--sb-info\` |
| **4** | **灰阶全部映射到中性阶** | 5 支散装灰 + \`#1a1a1a\` + Tailwind 灰蓝族 → \`--sb-neutral-*\` / \`--sb-ink-*\` |

## §B.1 工作量总览

| 分组 | 条目 | hex 出现次数 | 说明 |
|---|---|---|---|
| **靛蓝→品牌紫** | 13 | **328** | 历史遗留靛蓝（**最大彩色族**，裁定 1） |
| **品牌紫保留** | 12 | **257** | 已是品牌紫系，仅归档 |
| **红→一支** | 13 | **159** | 7 支红 → `--sb-danger` |
| **绿→一支** | 13 | **87** | 5 支绿 → `--sb-success` |
| **橙→一支** | 11 | **102** | 多支橙 + 暖米底 |
| **→信息蓝** | 6 | **72** | 蓝/靛蓝 → `--sb-info` |
| **灰→中性** | 44 | **1852** | 散装灰 + Tailwind 灰蓝族（**量最大**） |
| **粉→受限** | 6 | **73** | 品牌粉受限 / 青 → 信息 |
| **合计** | **118** | **2930** | — |

## §B.2 逐条映射

### 靛蓝→品牌紫（13 条 / 328 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#6366f1` | 77 | 11 | `--sb-brand-600` | 靛蓝主色 → 品牌紫主色（最大单项） |
| `#4338ca` | 75 | 9 | `--sb-brand-700` | 靛蓝深 → 品牌紫深（hover） |
| `#4636b8` | 44 | 3 | `--sb-brand-700` | 自定义靛蓝(3文件44次) → 品牌紫深 |
| `#eef2ff` | 42 | 10 | `--sb-brand-50` | 靛蓝浅底 → 品牌紫浅底 |
| `#c7d2fe` | 17 | 5 | `--sb-brand-200` | 靛蓝浅描边 → 品牌紫 200 |
| `#7454f3` | 15 | 7 | `--sb-brand-600` | footer 主按钮底 → 品牌紫**纯色** |
| `#8b5cf6` | 12 | 10 | `--sb-brand-500` | 紫 500（focus） |
| `#4f46e5` | 11 | 2 | `--sb-brand-700` | indigo variants-600 → 品牌紫深 |
| `#6842dc` | 10 | 1 | `--sb-brand-600` | 自定义靛蓝 → 品牌紫 |
| `#e0e7ff` | 10 | 7 | `--sb-brand-100` | 靛蓝浅底 → 品牌紫 100 |
| `#5d49bf` | 9 | 1 | `--sb-brand-700` | 自定义靛蓝 → 品牌紫深 |
| `#3730a3` | 4 | 4 | `--sb-brand-800` | indigo variants-800 → 品牌紫 800 |
| `#a855f7` | 2 | 2 | `--sb-brand-400` | purple-500 → 品牌紫 400 |

### 品牌紫保留（12 条 / 257 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#7c3aed` | 130 | 32 | `--sb-brand-600` | 品牌主色（已是） |
| `#a78bfa` | 23 | 12 | `--sb-brand-400` | 品牌 400（已是） |
| `#6d28d9` | 22 | 10 | `--sb-brand-700` | 品牌深（已是） |
| `#f5f3ff` | 19 | 6 | `--sb-brand-50` | 品牌浅底（已是） |
| `#faf8ff` | 13 | 5 | `--sb-brand-50` | 近白紫底 → 品牌 50 |
| `#faf7ff` | 12 | 7 | `--sb-brand-50` | 近白紫底 → 品牌 50 |
| `#ede9fe` | 11 | 9 | `--sb-brand-100` | 品牌 100（已是） |
| `#c4b5fd` | 8 | 3 | `--sb-brand-300` | 品牌 300（已是） |
| `#fbf9ff` | 7 | 5 | `--sb-brand-50` | 近白紫底 → 品牌 50 |
| `#fbf8ff` | 6 | 3 | `--sb-brand-50` | 近白紫底 → 品牌 50 |
| `#ddd6fe` | 3 | 3 | `--sb-brand-200` | 品牌 200（已是） |
| `#f3e8ff` | 3 | 2 | `--sb-brand-100` | 紫 100 底 |

### 红→一支（13 条 / 159 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#e8544b` | 27 | 9 | `--sb-danger` | **唯一危险色（保留升格）** |
| `#b91c1c` | 20 | 12 | `--sb-ink-danger` | red-700 → 危险**文字** |
| `#ef4444` | 16 | 10 | `--sb-danger` | red-500 → 统一 |
| `#dc2626` | 15 | 5 | `--sb-danger-hover` | red-600 → 危险 hover |
| `#ff4757` | 13 | 5 | `--sb-danger` | 高饱和红 → 统一 |
| `#fef2f0` | 12 | 10 | `--sb-danger-soft` | 红浅底（已是） |
| `#c53030` | 11 | 7 | `--sb-danger-hover` | 红深 → 危险 hover |
| `#fecaca` | 11 | 8 | `--sb-danger-border` | 红浅描边 |
| `#fef2f2` | 10 | 6 | `--sb-danger-soft` | 红浅底 → 统一 |
| `#fff5f5` | 10 | 6 | `--sb-danger-soft` | 红浅底 → 统一 |
| `#e53e3e` | 7 | 4 | `--sb-danger` | 红 → 统一 |
| `#e84142` | 5 | 2 | `--sb-danger` | 红 → 统一 |
| `#ff3b5c` | 2 | 1 | `--sb-danger` | 亮红 → 统一 |

### 绿→一支（13 条 / 87 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#256b45` | 15 | 3 | `--sb-ink-success` | 深绿 → 成功文字 |
| `#5ca86c` | 13 | 7 | `--sb-success` | **唯一成功色（保留）** |
| `#edf7f0` | 8 | 2 | `--sb-success-soft` | 绿浅底 → 统一 |
| `#059669` | 7 | 5 | `--sb-success` | emerald-600 → 统一 |
| `#f5fbf7` | 7 | 1 | `--sb-success-soft` | 绿浅底 → 统一 |
| `#10b981` | 6 | 6 | `--sb-success` | emerald-500 → 统一 |
| `#27864b` | 6 | 5 | `--sb-ink-success` | 深绿 → 成功文字 |
| `#f0f9f2` | 6 | 5 | `--sb-success-soft` | 绿浅底（已是） |
| `#22c55e` | 5 | 4 | `--sb-success` | green-500 → 统一 |
| `#047857` | 5 | 5 | `--sb-ink-success` | emerald-700 → 成功文字 |
| `#07c160` | 4 | 3 | `--sb-success` | 微信绿 → 统一 |
| `#166534` | 4 | 2 | `--sb-ink-success` | green-800 → 成功文字 |
| `#16a34a` | 1 | 1 | `--sb-success` | green-600 → 统一 |

### 橙→一支（11 条 / 102 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#f59e0b` | 24 | 16 | `--sb-warning` | amber-500 → 警告 |
| `#e99a18` | 15 | 4 | `--sb-warning` | 自定义橙 → 警告 |
| `#f5efe4` | 15 | 7 | `--sb-l0-page` | **页面底，保留** |
| `#b45309` | 11 | 7 | `--sb-ink-warning` | amber-700 → 警告文字 |
| `#b7570b` | 9 | 4 | `--sb-ink-warning` | 橙文字 → 警告文字 |
| `#faefdf` | 8 | 3 | `--sb-surface-sunken` | 暖米浅底 → 凹槽 |
| `#fbf2e8` | 8 | 3 | `--sb-neutral-100` | 暖米浅底 → 中性 100 |
| `#fdf8f3` | 8 | 3 | `--sb-neutral-50` | 暖米近白 → 中性 50 |
| `#fbbf24` | 2 | 2 | `--sb-warning` | amber-400 → 警告 |
| `#fcd34d` | 1 | 1 | `--sb-credit` | 金色 → 积分色 |
| `#e67e22` | 1 | 1 | `--sb-warning` | 橙 → 警告 |

### →信息蓝（6 条 / 72 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#2563eb` | 49 | 14 | `--sb-info` | **从蓝系选一支当信息语义色** |
| `#3b82f6` | 9 | 7 | `--sb-info` | blue-500 → 信息 |
| `#5275cc` | 6 | 4 | `--sb-info` | 信息蓝（已是） |
| `#0ea5e9` | 3 | 3 | `--sb-info` | sky → 信息 |
| `#06b6d4` | 3 | 3 | `--sb-info` | cyan → 信息 |
| `#1d4ed8` | 2 | 2 | `--sb-info-hover` | blue-700 → 信息 hover |

### 灰→中性（44 条 / 1852 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#fff` | 812 | 89 | `--sb-neutral-0` | 纯白 |
| `#999` | 52 | 13 | `--sb-ink-4` | 散装灰 → 提示（仅大文本） |
| `#ffffff` | 51 | 18 | `--sb-neutral-0` | 纯白（大小写重复） |
| `#888` | 42 | 12 | `--sb-ink-3` | 散装灰 → 辅助文字 |
| `#6b7280` | 39 | 12 | `--sb-ink-3` | gray-500 → 辅助文字 |
| `#20242a` | 35 | 7 | `--sb-neutral-900` | 冷深灰 → 反色面 |
| `#666` | 34 | 13 | `--sb-ink-3` | 散装灰 → 辅助文字 |
| `#333` | 34 | 10 | `--sb-ink-1` | 散装深灰 → 标题 |
| `#111827` | 34 | 12 | `--sb-ink-1` | gray-900 → 标题 |
| `#1a1614` | 33 | 10 | `--sb-ink-1` | 暖黑（已是） |
| `#64748b` | 32 | 12 | `--sb-ink-3` | slate-500 → 辅助文字 |
| `#1a1a1a` | 31 | 13 | `--sb-ink-1` | **纯黑 → 暖黑标题**（裁定 4） |
| `#f5f5f5` | 30 | 11 | `--sb-neutral-100` | 散装灰 #f5f5f5 → 中性 100 |
| `#f3f4f6` | 30 | 12 | `--sb-neutral-100` | gray-100 → 中性 100 |
| `#6b6560` | 28 | 9 | `--sb-ink-3` | 暖灰（已是） |
| `#e0e0e0` | 26 | 7 | `--sb-neutral-200` | 散装灰 #e0e0e0 → 中性 200 |
| `#475569` | 26 | 10 | `--sb-ink-2` | slate-600 → 正文 |
| `#1f2937` | 26 | 13 | `--sb-ink-1` | gray-800 → 标题 |
| `#f0f0f0` | 25 | 10 | `--sb-neutral-100` | 散装灰 #f0f0f0 → 中性 100 |
| `#eee` | 23 | 9 | `--sb-neutral-150` | 散装灰 #eee → 中性 150 |
| `#e5e7eb` | 23 | 9 | `--sb-neutral-200` | gray-200 → 中性 200 |
| `#dfe3e8` | 22 | 6 | `--sb-neutral-200` | 冷灰 → 中性 200 |
| `#9a9490` | 22 | 10 | `--sb-ink-4` | 暖灰（已是） |
| `#555` | 22 | 9 | `--sb-ink-2` | 散装灰 → 正文 |
| `#fafbfc` | 21 | 9 | `--sb-neutral-25` | 近白 → 中性 25 |
| `#94a3b8` | 21 | 10 | `--sb-ink-5` | slate-400 → 禁用文字 |
| `#78716c` | 21 | 8 | `--sb-ink-3` | stone-500 → 辅助文字 |
| `#edf0f3` | 20 | 4 | `--sb-neutral-100` | 冷灰 → 中性 100 |
| `#756f69` | 20 | 4 | `--sb-ink-3` | 暖灰 → 辅助文字 |
| `#4b5563` | 20 | 6 | `--sb-ink-2` | gray-600 → 正文 |
| `#ccc` | 19 | 8 | `--sb-neutral-300` | 散装灰 #ccc → 中性 300 |
| `#3d3835` | 19 | 9 | `--sb-ink-2` | 暖灰（已是） |
| `#0f172a` | 19 | 7 | `--sb-ink-1` | slate-900 → 标题 |
| `#ddd` | 18 | 6 | `--sb-neutral-200` | 散装灰 #ddd → 中性 200 |
| `#bbb` | 18 | 8 | `--sb-ink-5` | 散装灰 → 禁用文字 |
| `#9ca3af` | 18 | 10 | `--sb-ink-5` | gray-400 → 禁用文字 |
| `#0c0a09` | 16 | 4 | `--sb-neutral-900` | 强调黑（已是） |
| `#e8e8e8` | 14 | 9 | `--sb-neutral-200` | 散装灰 #e8e8e8 → 中性 200 |
| `#dddde3` | 13 | 1 | `--sb-neutral-200` | 冷灰 → 中性 200 |
| `#d1d5db` | 13 | 5 | `--sb-neutral-300` | gray-300 → 中性 300 |
| `#d0d0d0` | 12 | 3 | `--sb-neutral-300` | 散装灰 #d0d0d0 → 中性 300 |
| `#e0e2e6` | 10 | 1 | `--sb-neutral-200` | 冷灰 → 中性 200 |
| `#dfe1e5` | 5 | 1 | `--sb-neutral-200` | 冷灰 → 中性 200 |
| `#24262d` | 3 | 2 | `--sb-neutral-900` | 冷深 → 反色面 |

### 粉→受限（6 条 / 73 次）

| 现色值 | 次数 | 文件 | → 目标 token | 迁移说明 |
|---|---|---|---|---|
| `#ec4899` | 22 | 14 | `--sb-brand-gradient-3` | 品牌粉：**仅允许出现在品牌渐变内** |
| `#397668` | 17 | 1 | `--sb-info` | 青绿(单文件17次) → 信息语义 |
| `#be185d` | 12 | 3 | `--sb-brand-gradient-3` | 深粉 → 同上受限 |
| `#4ecdc4` | 10 | 4 | `--sb-info` | 青 → 信息语义 |
| `#d14db5` | 9 | 6 | `--sb-brand-600` | footer 渐变中的粉 → 改品牌紫**纯色** |
| `#fce7f3` | 3 | 3 | `--sb-brand-50` | 粉浅底 → 品牌 50 |

## §B.3 执行要点

| # | 要点 |
|---|---|
| **M1** | **先灰阶，后彩色** —— 灰阶 44 条 / 1852 次，风险最低（只是冷灰→暖灰），先做可快速降碎片度 |
| **M2** | **靛蓝整族一起迁** —— 只换 \`#6366f1\` 而留 \`#4338ca\` 会造成新的不匹配 |
| **M3** | **渐变要拆，不是换** —— 功能按钮上的三色渐变**改成纯色** \`#7C3AED\`，不是换成另一个渐变（裁定 2） |
| **M4** | **rgba 同步** —— \`rgba(99,102,241,α)\`（靛蓝）→ \`rgba(124,58,237,α)\` 系列 |
| **M5** | **JS 默认参数不能用 var()** —— \`directionUiModel.js\` 等的 \`fallback = '#7c3aed'\` 是 JS 值，需 \`getComputedStyle\` 读取或保留常量 |
| **M6** | **每批后跑 audit** —— \`node scripts/design-audit.mjs\` 的「hex 硬编码」应持续下降 |

## §B.4 验证命令

\`\`\`bash
node scripts/design-audit.mjs                                   # 总碎片度

# 裁定 1：靛蓝残留（目标 0）
grep -rEo '#6366f1|#4338ca|#4f46e5|#3730a3|#eef2ff|#e0e7ff|#c7d2fe' src/ | wc -l

# 裁定 2：功能按钮上的渐变（目标 0）
grep -rn "linear-gradient" src/ | grep -iE "btn|button"

# 裁定 3：红/绿收敛（目标各 1 支）
grep -rEo '#ff4757|#c53030|#e53e3e|#ef4444|#b91c1c|#dc2626' src/ | wc -l
grep -rEo '#059669|#16a34a|#166534|#07c160|#10b981|#22c55e' src/ | wc -l

# 裁定 4：灰阶收敛
grep -rEo '#f5f5f5|#f0f0f0|#e0e0e0|#e8e8e8|#d0d0d0|#1a1a1a' src/ | wc -l
\`\`\`
