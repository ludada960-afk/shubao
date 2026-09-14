# 薯包AI · 设计知识库

> **建立时间**：2026-08 · **版本**：Design System v1
> **适用**：React 18 + Vite 的薯包AI Web 端（`F:\da\shubao`）

---

## 这个知识库解决什么问题

老板的原话是「**很多面板做得又丑又 low —— 全是黑白极简风，没有符合我们当前的视觉语言，间距、主次、大小都没调好**」「**别人的视觉语言至少懂圆角、懂叠放、懂不同的地方用什么颜色的字、懂选中态有不同交互**」。

根因是一个可量化的事实：**这套代码库没有任何一层"共享的视觉词汇表"**。每个面板都是一次性手写内联 style，于是同一个东西在不同地方长出不同样子：

| 维度 | 现状 | 证据 |
|---|---|---|
| 颜色 | **239 个不同 hex**，1571 次硬编码 | `node scripts/design-audit.mjs` |
| 字号 | **24 档**（7–62px） | 同上 |
| 圆角 | **20 档** | 同上 |
| `gap` 非阶梯值 | **175/371 次（47%）** | 同上 |
| 控件高度 | **12 档**（26–50px） | `_research/audit-panels.md` |
| 面板宽度 | **4 档**（380/420/460/520） | `EcMode.jsx:303` |
| z-index | **21 个裸值**（1 到 999999） | `design-audit.mjs` |
| **`focus-visible`** | 真实应用代码里 **0 次** | ❌ 违反 WCAG 2.4.7 (AA) |
| **裸 `outline: none`** | **42 处** | ❌ 焦点环被主动抹掉 |
| **`<div onClick>`** | **133 处** | ❌ 键盘完全不可达 |
| **`prefers-reduced-motion`** | **0 处** | ❌ 前庭症用户无保护 |

> 📊 **可复现**：`node scripts/design-audit.mjs` 会实时重算以上全部数字，并输出落地进度看板。**任何时刻都可以用它验证规范文档里的结论是否仍然成立。**

**这个知识库就是那层词汇表。**

---

## 文件索引与阅读时机

| 文件 | 回答什么 | **谁 / 什么时候读** |
|---|---|---|
| **`README.md`**（本文） | 知识库怎么用 | 第一次接触设计改动时 |
| **`02-brand-purple-migration.md`** | **品牌紫怎么进 token？165 处硬编码改成什么？`--accent` 怎么办？** | **改造 agent 的作业表**（精确到 文件:行）+ `rgba` 45→5 档收敛 |
| **`01-brand-decision.md`** | **全站用哪套主色？为什么？怎么迁移？** | **决策前必读**。含 V2→V3 映射表、`--accent` 改动风险清单、四步落地策略、响应式规范 |
| **`00-principles.md`** | **为什么**这样设计（含证据与来源） | **动手前必读**。尤其 §3 嵌套表面、§4 状态、§6 色彩语义 |
| **`10-visual-language.md`** | **确切用什么值**（完整 token 表 + 现状映射表） | **写 CSS / 内联 style 前必读** |
| **`20-components.md`** | 每个组件长什么样、什么尺寸、什么状态 | **写组件前必读** |
| **`25-reference-teardown.md`** | 从 13 个产品学什么、**不学什么** | 想知道"为什么定这个规则"时 |
| **`30-adoption-plan.md`** | 落地顺序、风险、回退 | **排期 / 开工前必读** |
| **`../src/styles/sb-tokens.css`** | **机器可读的 token**（唯一实现源） | 写代码时随时查 |

### 按角色导航

| 你是 | 读这些 |
|---|---|
| **要改某个面板的视觉** | `00-principles.md` §2/§3/§4 → `10-visual-language.md` 全文 → `20-components.md` 对应组件 → `30-adoption-plan.md` 找到对应步骤 |
| **要新建一个组件** | `00-principles.md` §1/§4 → `20-components.md`（先找有没有现成的）→ `sb-tokens.css` |
| **要审代码 / 验收** | `10-visual-language.md` §17 检查清单 + `30-adoption-plan.md` §4 验收清单 |
| **要决策方向** | `25-reference-teardown.md`（别人怎么做）→ `00-principles.md` §0.3（我们的品牌基底） |
| **第一次接手这个项目** | 本文 → `00-principles.md` §0（现状诊断）→ `30-adoption-plan.md` §1（体检结论） |

---

## 三分钟上手

### 1. 引入 token（一行）

```diff
  // src/main.jsx
  import './styles/design-tokens.css';
+ import './styles/sb-tokens.css';
```

### 2. 用 token，不要硬编码

```diff
- <div style={{ padding: '14px 16px', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.08)', background: '#fff' }}>
+ <div className="sb-option">
```

### 3. 记住这 6 条（其余在文档里）

```
① 一屏一个 primary 按钮
② 面板内禁止套白卡 —— 用留白 + 分组标题
③ 内层圆角 = 外层圆角 − 内边距（20 → 12 → 8）
④ hover 用中性灰，selected 用品牌紫 —— 两个不同通道
⑤ 默认态零品牌紫（未选中/未激活/未付费）
⑥ 彩色字只有三种合法场合：品牌动作 / 状态语义 / 关键数据
```

---

## 核心约定

### 品牌基底（**继承，不推翻**）

| 项 | 取值 | 来源 |
|---|---|---|
| 页面底色 | `#F5EFE4` 暖米白 | `design-tokens.css:6` |
| 品牌色 | 紫 `#7C3AED` | 现状硬编码 67 次，事实上的品牌识别 |
| 强调黑 | `#0C0A09` | `design-tokens.css:13` |
| 投影 | 暖棕 `rgba(57,45,26,·)` | `design-tokens.css:95-99` |
| 面板宽 | **480px** | 用户硬约束 |
| 间距阶梯 | **4/8/12/16/20/24** | 用户硬约束 |
| 字号阶梯 | **13/700 · 12/600 · 12/400 · 11/400** | 用户硬约束 |
| 控件高 | **32/36/40** | 用户硬约束 |
| 圆角 | **8/12/20** | 用户硬约束 |

### 命名空间

- **CSS 变量**：`--sb-*`（现状无任何 `--sb-` 变量，零冲突）
- **class**：`.sb-*`（现状无任何 `sb-` class，零冲突）
- **新组件目录**：`src/components/ds/`（与现有 `src/components/ui/` 平行，逐页迁移）

> ⚠️ **`src/styles/sb-tokens.css` 是纯新增文件**：删掉它后，全站渲染必须与今天完全一致。这是零回归保证。

---

## 当前未决事项

| # | 事项 | 影响 | 需要谁 |
|---|---|---|---|
| **S1** | **品牌主色**：`design-tokens.css:12-13` 声明「无彩色主色」，但 `#7c3aed` 紫硬编码 67 次 | 决定 §6 色彩语义的基准 | **老板拍板**（规范默认按"紫为品牌色 + 默认中性态"编写；若改近黑，只需换 9 个 token 值） |
| **S2** | `DesignDirection.jsx`（暖白）vs `DesignDirectionView.jsx`（暗色 `#0f0f1a`）—— 同一流程两个相反配色 | 需确认哪个在用 | 开发 |
| **S3** | 三对平行实现（SKU / 产品参数 / 设计方向）字段集不同 | 合并前需确认业务字段 | 产品 + 开发 |

---

## 调研证据底座

本知识库的所有结论都有证据，分三类：

| 类型 | 位置 | 说明 |
|---|---|---|
| **代码实测** | 各文档的 `[证据: 路径:行号]` | 本仓库源码逐行核对 |
| **产品实测** | `docs/design/_research/ai-tools-ui.md`（64KB） | **13 个产品线上 DOM 的 `getComputedStyle` 全量采样**——px 数值是实测值，不是目测估算 |
| **规范原文** | `docs/design/_research/standards.md`（88KB，47 个 URL） | WCAG 2.2 / Apple HIG / Material 3 / Radix / shadcn 官方文档（Apple 与 M3 为 JS 渲染页，已用 headless Chrome 渲染后提取原文） |

### 已审计文件

| 报告 | 覆盖 | 状态 |
|---|---|---|
| `_research/audit-panels.md`（60KB） | 11 个电商面板组件，逐控件尺寸/状态/圆角/颜色 | ✅ 完成 |
| `_research/ai-tools-ui.md`（64KB） | 13 个产品线上 DOM 实测 | ✅ 完成 |
| `_research/standards.md`（88KB，47 URL） | WCAG / Apple HIG / M3 / Radix / shadcn | ✅ 完成 |
| ~~`audit-pages.md`~~ | 画布 / 工作台 / 作品集 / 定价 / 图库 / 重制 / Plog | ⚠️ **未完成**（见下） |
| ~~`audit-home-css.md`~~ | `Home.css`（55KB）+ 导航 / 弹窗 / 侧栏 / 上传组件 | ⚠️ **未完成**（见下） |

> ⚠️ **两份审计未完成**：对 `EcCanvas/index.jsx`（36KB）、`EcStudio/index.jsx`（53KB）、`Home.css`（55KB）的逐行审计未产出报告。
> **不影响本知识库的结论**——本文档中关于这些页面的判断来自：
> ① `scripts/design-audit.mjs` 的全站扫描（`backdrop-filter` 文件清单、z-index 裸值分布、无障碍缺陷计数）
> ② 手工抽查的关键行号（`EcCanvas/index.jsx:692` 放大遮罩 `zIndex: 10001`、`App.jsx:301-305` 全屏 Loading 等）
> ③ `standards.md` 与 `ai-tools-ui.md` 的横向规律
>
> **落地 agent 在改这几个文件前，应先跑一遍 `node scripts/design-audit.mjs` 并补充局部审计。**

> `_research/` 目录是**调研原始报告**，不是规范。规范以根目录的 `00/10/20/25/30` 五份为准。

---

## 自查脚本

```bash
node scripts/design-audit.mjs
```

只读脚本，做四件事：

1. **统计现状碎片化**（hex / 字号 / 圆角 / z-index / gap 非阶梯值）
2. **检查无障碍硬缺陷**（`focus-visible` / 裸 `outline:none` / `<div onClick>` / `prefers-reduced-motion`）
3. **校验 `sb-tokens.css` 的对比度**是否满足 WCAG AA（含暖米白底这一容易被忽略的场景）
4. **输出落地进度看板**（对照 `30-adoption-plan.md` 的每一步）

> **任何时刻都可以用它验证本知识库里的结论是否仍然成立。** 文档里的数字如果和脚本输出不一致，以脚本为准。

---

## 维护约定

1. **改 token 只改一处**：`src/styles/sb-tokens.css`。文档里的值是它的说明，不是第二份真相。
2. **新增 token 要同步三处**：`sb-tokens.css` 定义 → `10-visual-language.md` 表格 → `20-components.md`（如果组件用到）。
3. **不要在本知识库写入与视觉无关的内容**（产品需求、技术架构走别的文档）。
4. **规范是活的**：如果某条规则在实践中被证明不合适，改文档 + 说明理由，**不要默默违反**。

---

## 不做的事

- ❌ **不抄参考产品的配色**。学的是层级、状态、结构、留白。品牌基底（暖米白 + 品牌紫）保持不变。
- ❌ **不做大爆炸重构**。按 `30-adoption-plan.md` 的阶段推进，每步可独立验收。
- ❌ **不修改现有 `design-tokens.css` 的变量**。新老并行，逐步迁移。
- ❌ **不 commit**。改动由老板统一验收后提交。
