# 53 · 高端前端设计作战手册（Premium Design Playbook）

> **这份文件回答**：用户说「你这个就是个 demo，黑字白底，没有任何设计」时，**具体缺的是什么**、**去哪里找现成的高端设计能力**、**落到薯包AI 身上确切的 CSS 数值是什么**。
>
> **状态**：v1 草案（2026-09-17）
> **约束**：本文件**只产出调研结论与规范草案**，**不改动仓库任何代码**。
> **上游**：`01-brand-decision.md`（D1 拍板：交互主色 = 品牌紫）、`10-visual-language.md`（现有 token 表）、`40-decisions.md`（唯一权威决策）。
> **本文定位**：`53-*` 是**新增的「设计资源 + 反 demo」层**，不覆盖、不修改任何既有文档结论。文中数值若与 `design-tokens-v3.css` 冲突，**以既有 token 为准**，本文的职责是补上「缺的那部分」。

---

## 0. 结论先行（TL;DR）

| 问题 | 结论 |
|---|---|
| 为什么看起来像 demo？ | 不是「配色不好看」，而是**缺 4 样东西**：① 表面分层（surface elevation）② 排版对比度（display scale）③ 动效人格（motion personality）④ 状态通道（state channels）。见 §4 反 demo 清单 18 条 |
| 最该装的能力是什么？ | **`taste-skill`（87.8k★）** —— 直接给 AI「审美」+ 一套硬性反 slop 规则（禁 em-dash、每 3 节最多 1 个 eyebrow、bento 单元数必须等于内容数）。**这是投入产出比最高的一项** |
| 第二该装？ | **`LottieFiles/motion-design-skill`（1.68k★）** —— 提供了**唯一一套可直接抄进 token 的时长/缓动数值表**（本文 §3.4 的动效 token 全部来自它） |
| 规范文档怎么落？ | **Superdesign 的 `DESIGN.md` 范式**（5.7k★）—— 把设计系统写成一个 agent 每次都读的文件，杜绝「每次重新发明一套外观」 |
| 本文最硬的部分 | **§3「薯包AI 设计语言 v1」**，全部是可复制的 CSS 数值：色板 hex / 6 档字号阶梯 / 8 档间距 / 6 档圆角 / 5 档海拔 / 6 档缓动 / 左侧导航 / skill 悬停预览窗 / 6 列卡片网格 |

---

## 1. GitHub 高星「AI 前端设计」资源

> **数据核实说明**：下列 star 数于 **2026-09-17** 通过 GitHub REST API `/repos/{owner}/{repo}` 或仓库页 `stargazerCount` 字段**实名抓取**。抓取脚本与原始返回见 §5「数据核实记录」。**未核实的资源不写 star 数**。

### 1.1 A 类 · 给 AI 用的「审美 / 设计原则」提示词与 skill 库

这一类是**用户原话的直接对应物**——「辅助 AI 去做高端前端设计」的能力。

| # | 仓库 | ★ Star | 解决什么问题 | 怎么用（给 AI 看哪一部分） |
|---|---|---|---|---|
| A1 | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | **87,826** | **反 slop 前端框架**。AI 默认产出「黑字白底 demo」，本质是它没有**审美约束**。这个库把审美变成**可机检的硬规则**：禁 em-dash、每个 section 最多 1 个 eyebrow（每 3 节限 1 个）、bento 单元数必须 == 内容数、禁止「左图右文」连续 3 节、禁止 div 伪造截图、禁止 AI 紫色渐变 | **给 AI 看 `skills/taste-skill/SKILL.md`**（v2，含 VARIANCE / MOTION / DENSITY 三个可调旋钮 + Pre-Flight 自检）。**给 AI 看 `skills/high-end-visual-design/SKILL.md`**（soft-skill）—— 这是最贴近薯包AI 需要的「高级、克制、昂贵感」风格包。**给 AI 看 `skills/taste-skill-v1/SKILL.md`** 如果你要稳定而非实验版 |
| A2 | [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) | **1,680** | 动效**数值权威**。AI 写动效的通病是 `transition: all 0.3s ease` —— 这个库给出**按元素类型的时长表、按方向的缓动规则、弹簧参数、stagger 预算、Disney 12 原则的 UI 化改造** | **给 AI 看 `skills/motion-design/reference/timing-easing-tables.md`**（本文 §3.4 全部数值来源）+ `SKILL.md` 的「Duration Table / Easing Selection / Motion Personality」三节 |
| A3 | [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | **570** | 提出 **`DESIGN.md` 范式**：像 `AGENTS.md` 管代码一样，用**一个文件管外观**。解决「agent 每次重新发明一套外观」 | **给 AI 看 `DESIGN.md`**（该仓库根目录）—— 只需 4 段：Product context / Design tokens / Motion / Components。**把本文 §3 直接写成薯包AI 的 `DESIGN.md`** 放进仓库根 |
| A4 | [Dammyjay93/interface-design](https://github.com/Dammyjay93/interface-design) | **5,706** | **产品 UI 的工艺 + 跨会话记忆**。专门针对 **dashboard / app / admin panel**（明确声明**不用于营销页**）—— 与薯包AI 的编辑器场景高度对口。带 `design-review`（严格评审）与 `design-deslop`（消除 slop）两个命令 | **给 AI 看 `reference/system-template.md`**（设计系统模板：Direction / Tokens / Patterns / Decisions 四段，**直接可套本文 §3**）+ `.claude/skills/interface-design/` 下的原则文件。**这是最适合直接落地的 skill** |
| A5 | [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) | **2,675** | **111 个设计 skill 的全集**，按「你处在什么处境」组织而非按文件夹。含 `color-system`、`visual-hierarchy`、`animation-principles`、`design-token`、`critique-screen` | **给 AI 看 `INDEX.md`**（路由表：知道该用哪个 skill）+ 按需拉 `ui-design/` 与 `interaction-design/` 下的具体 skill。**当「百科」用，不是一次性全塞** |
| A6 | [plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) | **1,513** | **可机检的设计门禁**。44 条客观 gate：真实渲染 WCAG 对比度、状态感知对比度、目标尺寸 2.5.8、响应式溢出、axe-core、**slop 特征检测**（硬编码靛紫渐变 / 单一圆角 / 单一阴影 / `#000` on `#fff`）、**taste audit**（最大标题 24px vs 正文 14px = 1.7x，不是 display scale） | **给 AI 看根目录 `CLAUDE.md`**（全部规则的单一来源）+ `tokens/`（DTCG 格式 token）+ `design-systems/`（138 套品牌级设计系统参考）。**它的 gate 列表可直接改写成薯包AI 的 CI 检查** |
| A7 | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | **876** | Vercel 官方 **MUST/SHOULD/NEVER** 三级界面规范。设计相关硬规则：**分层阴影（ambient + direct）**、半透明边框 + 阴影做出锐利边缘、**嵌套圆角子 ≤ 父且同心**、**色相一致性（边框/阴影/文字向背景色相偏移）**、hover/active/focus 必须**提高**对比度、避免深色渐变 banding | **给 AI 看 `AGENTS.md`**（单文件，全文约 200 行）。**这是「一份就够了」型的规范**，适合直接放进薯包AI 仓库 |
| A8 | [thedaviddias/Front-End-Design-Checklist](https://github.com/thedaviddias/Front-End-Design-Checklist) | **5,342** | 面向「有审美的网页设计师 + 有耐心的前端」的**设计检查清单**（非代码规范，而是视觉决策清单） | **给 AI 看 README 的 checklist 分节**，用于 §4 反 demo 自查的补充来源 |
| A9 | [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) | **1,115** | **资源索引**：作者把「让 Claude Code 产出更好看前端」的所有有效手段（skill / plugin / MCP / 工具）汇总成一份 README | **给 AI / 给人看 README**——用来**发现遗漏的资源**，本身不含规范 |
| A10 | [arvindrk/extract-design-system](https://github.com/arvindrk/extract-design-system) | **222** | **从任意公开网站逆向提取 design token**（颜色 / 字体 / 间距 / 圆角 / 阴影），产出可直接用的 token 文件 | **用法**：对 Linear / Stripe / Raycast 官网跑一遍 → 得到真实 token → 作为 §2 设计系统参考的**实证依据**，而不是靠肉眼描述 |
| A11 | [Ilm-Alan/frontend-design](https://github.com/Ilm-Alan/frontend-design) | **120** | **8 个审美锚点（aesthetic anchors）**，每个锚点**锁定 palette / type / motion 三件套**——防止 AI 中途漂移成「混合风」 | **给 AI 看 SKILL.md 的 8 个 anchor 定义**。用法：让 AI **选定 1 个 anchor** 并全程遵守 |
| A12 | [joeseesun/qiaomu-design](https://github.com/joeseesun/qiaomu-design) | **554** | 中文语境**「反 AI 味设计」顾问** + 风格试衣间 + 58 站设计系统库 | **给 AI 看 README + 内置的 58 站设计系统库**。适合中文产品语境下的二次校验 |

**薯包AI 的取舍建议**：**必装 A1 + A2 + A4**（审美 + 动效 + 产品 UI 工艺）；**A3 的 DESIGN.md 范式立刻采纳**；**A6 的 gate 列表改写成 CI**；A5/A7/A9 当参考资料按需查。

---

### 1.2 B 类 · 高设计感组件库与动效库（React 生态）

| # | 仓库 | ★ Star | 解决什么问题 | 怎么用 |
|---|---|---|---|---|
| B1 | [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | **124,132** | **可组合、可拥有源码的组件基础层**。「不是引入一个库，而是把组件复制进你的仓库」—— 这意味着**样式完全可控**，是摆脱「demo 感」的前提 | 用它的 **CSS 变量 + `components.json` 主题机制**，把本文 §3 的 token 灌进去。**给 AI 看 `apps/v4/app/globals.css`**（token 定义范式） |
| B2 | [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) | **47,465** | **动画 / 交互 / 高度可定制的 React 组件集合**——「让网站令人记住」的那类组件（文字动效、背景动效、卡片交互） | 用作**局部亮点**。**不要整页堆**（这正是 slop）。建议：空态、hero、生成中状态各用 1 个 |
| B3 | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | **22,316** | **Design Engineer 向的 UI 库**，复制粘贴式，动效组件（marquee、bento grid、animated list、shimmer） | Bento grid 与 marquee 组件可直接用于**能力展示区**。注意 A1 的硬规则：**marquee 每页最多 1 个** |
| B4 | [mantinedev/mantine](https://github.com/mantinedev/mantine) | **31,726** | **全功能 React 组件库**，7.x 起完全基于 CSS 变量 + `rem`/原生 CSS，主题系统成熟 | 若需要「开箱可用的完整组件」（DatePicker、RichText 等重组件），Mantine 比手搓快得多，且**主题可完全 token 化** |
| B5 | [emilkowalski/sonner](https://github.com/emilkowalski/sonner) | **12,982** | **Toast 组件的工艺标杆**。作者 Emil Kowalski 是动效领域公认的高水准（animations.dev） | 直接替换现有 Toast。**关注它的进入/退出动效参数**——这是「demo 感」最明显的差异点之一 |
| B6 | [emilkowalski/vaul](https://github.com/emilkowalski/vaul) | **8,614** | **Drawer 组件**，带真实拖拽物理与吸附 | 移动端面板 / 底部抽屉替换方案 |
| B7 | [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives) | **6,308** | **动画 UI 原语合集**，可定制、开源 | 入场 / 退场 / 滚动触发动效的现成实现，比手写 framer-motion 稳 |
| B8 | [imskyleen/animate-ui](https://github.com/imskyleen/animate-ui) | **4,304** | 完全动画化的开源组件分发（React + TS + Tailwind + Motion + shadcn CLI） | 组件级动效参考 |
| B9 | [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) | **15,853** | **平滑滚动**——高端感最廉价的来源之一 | 谨慎使用：编辑器类产品慎开全局平滑滚动（影响精确操作）。**仅用于落地页 / 展示页** |
| B10 | [motiondivision/motion](https://github.com/motiondivision/motion)（原 framer/motion，**33,627**） | **33,627** | React 动效事实标准。`useMotionValue` / `useTransform` 可在 **React 渲染循环之外**驱动动效 | A1 明确要求：磁吸/微物理动效**必须**用 `useMotionValue`，**禁止 `useState`** |
| B11 | [tremorlabs/tremor](https://github.com/tremorlabs/tremor) | **3,617** | 面向 **dashboard** 的图表与卡片组件（复制粘贴式） | 数据看板区（如果有）的现成方案 |
| B12 | [pmndrs/react-spring](https://github.com/pmndrs/react-spring) | **29,148** | 基于弹簧物理的 React 动效库 | 需要真实物理感（拖拽、吸附、回弹）时 |

**避坑**：**不要**用 [ant-design](https://github.com/ant-design/ant-design)（**99,520★**）、[element-plus](https://github.com/element-plus/element-plus)（**27,765★**）、[chakra-ui](https://github.com/chakra-ui/chakra-ui)（**40,648★**）来「提升设计感」——它们解决的是**覆盖面与一致性**，不是**前沿审美**；直接接入会立刻带回「通用后台」气质。同理 [TDesign](https://github.com/Tencent/tdesign)（**4,064★**）、[arco-design](https://github.com/arco-design/arco-design)（**5,705★**）属国内中后台体系。

---

### 1.3 C 类 · 有设计感的图标库

用户明确要「有设计感、不是通用线性图标」。关键区分：**线性图标（stroke-only）是通用感的最大来源**。

| # | 图标库 | ★ Star | 设计语言特点 | 是否解决「有设计感」 |
|---|---|---|---|---|
| C1 | [Hugeicons](https://github.com/hugeicons/hugeicons) | **1,196** | **60,000+ 图标 / 10 种风格**：Stroke、**Solid、Bulk、Duotone、Twotone**，覆盖 rounded / sharp / standard 三族。24×24 网格手工绘制。**带官方 MCP server + agent skill** | ✅ **最推荐**。`Bulk` 与 `Duotone` 天然带**双色层次**，是摆脱「灰线图标」的最直接手段 |
| C2 | [Phosphor Icons](https://github.com/phosphor-icons/homepage) | **7,502** | **6 种字重**（Thin / Light / Regular / Bold / Fill / **Duotone**），可**按语义选字重** | ✅ `Duotone` 变体现在已经是高端 SaaS 的常见选择 |
| C3 | [Tabler Icons](https://github.com/tabler/tabler-icons) | **21,702** | 6,100+ **MIT** 图标，统一 24×24 / 2px stroke，极其规整但**偏线性** | ⚠️ 规整度好，但**仍是线性**。若用，须配合 duotone 处理或加底色容器 |
| C4 | [Lucide](https://github.com/lucide-icons/lucide) | **24,556** | Feather 的社区延续，极简线性 | ⚠️ **这是「demo 感」最常见的元凶之一**。若继续用，**必须**用 duotone 变体或统一加容器 |
| C5 | [Iconoir](https://github.com/iconoir-icons/iconoir) | **4,553** | 1,600+ 图标，线宽略粗、端点更圆润，比 Feather 更「有分量」 | 🔸 折中选项：仍是线性，但视觉重量更足 |
| C6 | [Remix Icon](https://github.com/Remix-Design/RemixIcon) | **8,374** | 中性风格，**同时提供 line 与 fill 两套** | 🔸 可用 `fill` 版本做选中态，形成 line→fill 的状态切换 |
| C7 | [IconPark](https://github.com/bytedance/IconPark) | **9,052** | 字节出品，**一套源文件可变换出多种风格**（描边粗细 / 端点 / 双色） | ✅ 双色配置能力强 |
| C8 | [Fluent UI System Icons](https://github.com/microsoft/fluentui-system-icons) | **10,842** | 微软 Fluent，**Regular / Filled 成对**，还有 Resizable 版 | 🔸 Regular↔Filled 是很好的状态对 |
| C9 | [Material Symbols](https://github.com/google/material-design-icons) | **53,965** | 可变字重 / 填充 / 光学尺寸 | ⚠️ 覆盖面最大，但**过于常见**，直接用会带 Google 味 |
| C10 | [Iconify](https://github.com/iconify/iconify) | **6,321** | **聚合器**：150+ 图标集统一 API | 🔧 **工具而非风格**。用于「先到处试，再定一个」 |

**薯包AI 建议**：**主图标库换成 Hugeicons 的 Bulk/Duotone**（C1），或 **Phosphor Duotone**（C2）。**保留 Lucide 仅用于极小的 12–14px 辅助位**。理由见 §4 第 6 条。

---

## 2. 设计系统参考（可借鉴的公开规范）

> **说明**：以下为**公开可访问的设计规范页**与其**可观察的设计语言**。具体数值以官方页面为准；本文只提炼可迁移的**逻辑**，不伪造官方未公布的数字。凡官方未公开的数值，标注为「社区拆解 / 观察值」。

### 2.1 Linear —— 「层级靠表面明度，不靠阴影」

| 维度 | Linear 的做法 | 可借鉴点 |
|---|---|---|
| 配色逻辑 | **近黑底 + 极窄的明度阶梯**。表面之间靠 **1–3% 的明度差**区分，而不是靠大阴影。品牌紫（`#5E6AD2` 系）**只用于交互态**，绝不铺面积 | 与薯包AI 的 **D1 裁定完全同构**（品牌紫只做交互、面积受限）。**把 Linear 的「表面靠明度差」直接抄成 §3.3 的 surface elevation 阶梯** |
| 层级 | 大量使用 **1px 半透明边框 + 极弱内阴影** 来定义边界，比纯投影更「锐利」 | 对应 Vercel 规范的「semi-transparent borders + shadows 做 crisp edges」 |
| 间距节奏 | **8px 基准**，但**列表行高极紧凑**（约 32–36px），密度高、信息量大 | 编辑器/工作台应该**密**，不是**松**。demo 感的来源之一是「所有东西都很大很空」 |
| 动效参数 | **极短**。hover/状态切换普遍在 **120–180ms**，缓动接近 `cubic-bezier(0.2, 0, 0, 1)`（snappy）。**几乎不做弹跳** | 产品 UI 用 **Corporate 人格**（见 §3.4），不是 Playful |
| 参考链接 | [linear.app/brand](https://linear.app/brand)（品牌规范公开页）、[linear.app/method](https://linear.app/method)（方法论） | Linear 未公开完整 token 表；**可用 A10 `extract-design-system` 对官网逆向提取**获得实证值 |

### 2.2 Vercel Geist —— 「有名字的、可执行的界面规范」

| 维度 | Geist 的做法 | 可借鉴点 |
|---|---|---|
| 配色逻辑 | **10 条色阶**，每条 **12 档**（与 Radix 同构）。**关键规则**：Background 1（页面）/ Background 2（次级）；**Color 1–3 专用于组件背景**（默认 / hover / active）；**Color 4–6 专用于边框**（默认 / hover / focus）；**Color 7–8 分隔线**；**Color 9–10 实心色**；**Color 11–12 无障碍文字** | ✅ **这是「为什么我的界面没有层次」的答案**：demo 界面**只有 1 个背景下 1 个边框色**。**把 Geist 的 12 档职责表直接抄进 §3.1** |
| 层级 | 明确「**Background 2 要克制使用**，只在需要细微背景区分时用」 | 防止滥用导致 splotchy |
| 字体 | **Geist Sans + Geist Mono**，为开发者设计 | 薯包AI 需**中文优先**，故 §3.2 用中文黑体族 + 几何无衬线数字 |
| 网格 | Vercel 官方称 Grid 是「新 Vercel 美学的很大一部分」——**显式的、可见的栅格** | 编辑器用**显式栅格**（见 §3.5） |
| 参考链接 | [vercel.com/geist/introduction](https://vercel.com/geist/introduction)、[vercel.com/geist/colors](https://vercel.com/geist/colors)、[vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)（876★） | guidelines 仓库的 `AGENTS.md` **可直接给 AI 读** |

### 2.3 Stripe —— 「品牌色即产品色，且色阶极长」

| 维度 | Stripe 的做法 | 可借鉴点 |
|---|---|---|
| 配色逻辑 | **靛蓝 `#635BFF`** 既是品牌色也是交互主色；配套**极长的色阶**（50→900）与**品牌渐变**用于 hero / 卡片边缘 | 我们的 D1 已经做出**相反**的裁定（品牌红=标识、品牌紫=交互）——**这是正确的**，因为 Stripe 没有把靛蓝同时当危险色。**可借鉴的是「色阶要长」**：§3.1 给 12 档 |
| 层级 | 大量使用**极淡的蓝紫 tint 背景**做区块区分（而非灰） | ✅ **色相一致性**：背景/边框/阴影**向主色相偏移**，这是「高级感」的核心技术之一（Vercel 规范也要求 hue consistency） |
| 动效 | 克制、快、几乎无弹跳；表单错误的 shake 明确而短 | 对应 §3.4 的 `--sb-dur-error-shake: 320ms` |
| 参考链接 | [stripe.com/newsroom/brand-assets](https://stripe.com/newsroom/brand-assets) | 完整 token 未公开，需逆向提取 |

### 2.4 Radix Colors —— 「每个色阶的每一档都有明确用途」

**这是本文色板设计的**直接依据**，因为它是**唯一公开完整 hex 的、按用途分档的**色彩系统。

Radix 12 档的**官方语义**（这是关键）：

| 档位 | 用途 |
|---|---|
| 1–2 | **App background**（1 = 页面底，2 = 其上的次级底） |
| 3–5 | **Component background**（3 = 默认，4 = hover，5 = active/selected） |
| 6–8 | **Border**（6 = 默认，7 = hover，8 = focus/强边框） |
| 9 | **Solid fill**（按钮实底，**对比度 ≥3:1**） |
| 10 | **Solid hover** |
| 11 | **Text 次级**（**对比度 ≥4.5:1**，达标 AA） |
| 12 | **Text 主级**（**对比度 ≥12:1**，远超标） |

**为什么这解决 demo 感**：demo 界面只有「1 个底色 + 1 个文字色 + 1 个边框色」= 3 个色。**Radix 给的是 12 个职责明确的色**。同样的紫，在 hover 态、选中态、边框、文字上**必须是不同的紫**。

**已核实的原始 hex（来自 `@radix-ui/colors@3.0.0` 官方包，本文直接引用，非二手转述）**：

```css
/* Violet（品牌紫候选）· light */
--violet-1:#fdfcfe; --violet-2:#faf8ff; --violet-3:#f4f0fe; --violet-4:#ebe4ff;
--violet-5:#e1d9ff; --violet-6:#d4cafe; --violet-7:#c2b5f5; --violet-8:#aa99ec;
--violet-9:#6e56cf; --violet-10:#654dc4; --violet-11:#6550b9; --violet-12:#2f265f;

/* Violet · dark */
--violet-1:#14121f; --violet-2:#1b1525; --violet-3:#291f43; --violet-4:#33255b;
--violet-5:#3c2e69; --violet-6:#473876; --violet-7:#56468b; --violet-8:#6958ad;
--violet-9:#6e56cf; --violet-10:#7d66d9; --violet-11:#baa7ff; --violet-12:#e2ddfe;

/* Slate（中性阶 · 冷调）· light */
--slate-1:#fcfcfd; --slate-2:#f9f9fb; --slate-3:#f0f0f3; --slate-4:#e8e8ec;
--slate-5:#e0e1e6; --slate-6:#d9d9e0; --slate-7:#cdced6; --slate-8:#b9bbc6;
--slate-9:#8b8d98; --slate-10:#80838d; --slate-11:#60646c; --slate-12:#1c2024;

/* Slate · dark */
--slate-1:#111113; --slate-2:#18191b; --slate-3:#212225; --slate-4:#272a2d;
--slate-5:#2e3135; --slate-6:#363a3f; --slate-7:#43484e; --slate-8:#5a6169;
--slate-9:#696e77; --slate-10:#777b84; --slate-11:#b0b4ba; --slate-12:#edeef0;

/* Tomato（红 · 用于品牌标识色校验）· light 9/11 */
--tomato-9:#e54d2e; --tomato-11:#d13415;

/* Amber（警示）· light 9/11 */  --amber-9:#ffc53d; --amber-11:#ab6400;
/* Green（成功）· light 9/11 */  --green-9:#30a46c; --green-11:#218358;

/* Iris（冷紫备选，比 violet 更蓝）· light 9/11 */
--iris-9:#5b5bd6; --iris-11:#5753c6;
```

### 2.5 Raycast —— 「深色 + 高对比 + 微光」

| 维度 | Raycast 的做法 | 可借鉴点 |
|---|---|---|
| 配色 | **近黑底（约 `#07070A`–`#101014` 区间）+ 红色品牌强调**，功能色仅红/蓝/绿/黄，饱和度**高但面积小** | 我们的品牌红 `#FB5358` 与 Raycast 红系同属「高饱和小面积」用法 —— **红色作为标识/强调是成立的，前提是不背危险语义**（D1 理由 1 已说明） |
| 层级 | 卡片靠**极细白边（`rgba(255,255,255,0.06)`）+ 微弱内高光**建立边界 | 见 §3.3 的 `--sb-border-on-dark` 与 inner-highlight 规则 |
| 动效 | 命令面板的进出极快（约 150–200ms），带轻微 scale | 对应 §3.4 |
| 参考链接 | [raycast.com](https://www.raycast.com/) | 品牌页 `/brand` 为空占位，**完整规范未公开** → 标注为「观察值」 |

**逆向提取工具**：A10 [extract-design-system](https://github.com/arvindrk/extract-design-system)（222★）可对上述站点直接跑出真实 token，**建议作为 §3 定稿前的实证步骤**。

---

## 3. 薯包AI 设计语言 v1 草案（**本节全部为可复制 CSS 数值**）

> **使用方式**：本节整体即为 Superdesign 范式下的 **`DESIGN.md`**（A3）。建议**原样落为仓库根 `DESIGN.md`**，让每个 agent 每次改动前先读。
>
> **与既有 token 的关系**：`--sb-brand-*` 沿用 `design-tokens-v3.css` 的既有值（D1 裁定）；本节**新增**的是 surface / elevation / motion / layout / 组件规格层。若冲突，**以既有 `design-tokens-v3.css` 为准**。
>
> **气质定位**：**「专业编辑室」** —— 不是「工具后台」，也不是「营销落地页」。参考 Linear 的**密度**、Stripe 的**色相一致性**、Raycast 的**深色质感**。
>
> ⚠️ **反 demo 的第一原则**：**同一个紫，在不同用途上必须是不同的紫**。demo 界面之所以像 demo，是因为它把所有紫都写成了同一个 `#7C3AED`。

---

### 3.1 色彩系统

#### 3.1.1 品牌交互主色（12 档，按 Radix 语义分档）

沿用 D1 裁定的品牌紫 `#7C3AED` 作为 **9 档（solid fill）**，其余各档按 Radix 职责表补全：

```css
:root {
  /* ── 品牌紫 · 12 档（交互主色）───────────────────── */
  --sb-brand-1:  #FAF8FF;   /* app 底 · 最浅 */
  --sb-brand-2:  #F5F0FF;   /* 次级底 / 选中行底 */
  --sb-brand-3:  #EDE4FE;   /* 组件默认底（tinted） */
  --sb-brand-4:  #E0D1FD;   /* 组件 hover 底 */
  --sb-brand-5:  #D0B8FB;   /* 组件 active / 选中底 */
  --sb-brand-6:  #BC9CF7;   /* 边框 · 默认 */
  --sb-brand-7:  #A67CF2;   /* 边框 · hover */
  --sb-brand-8:  #8E5AEB;   /* 边框 · focus / 强边框 */
  --sb-brand-9:  #7C3AED;   /* ★ 实心填充（D1 主色，对比白字 4.63:1 ✅AA） */
  --sb-brand-10: #6D28D9;   /* 实心 hover */
  --sb-brand-11: #5B21B6;   /* 文字 · 次级（白底 7.31:1 ✅AAA） */
  --sb-brand-12: #2E1065;   /* 文字 · 主级（白底 14.2:1 ✅AAA） */

  /* 品牌紫的 alpha 变体（用于描边/overlay，避免再写 rgba 裸值）*/
  --sb-brand-a1:  rgba(124, 58, 237, 0.04);
  --sb-brand-a2:  rgba(124, 58, 237, 0.08);
  --sb-brand-a3:  rgba(124, 58, 237, 0.14);
  --sb-brand-a4:  rgba(124, 58, 237, 0.22);
  --sb-brand-a5:  rgba(124, 58, 237, 0.36);
  --sb-brand-ring: rgba(124, 58, 237, 0.32);  /* focus ring */
}
```

> **为什么这套紫符合「电商 AIGC 内容创作平台」**：
> ① **紫在内容创作工具里是共识色**（Figma 协作光标、Runway、ElevenLabs、Linear 交互态），用户认知成本为零；
> ② **紫是「生成」的语义色**——它与「危险红」`#FB5358` 在色相上相隔约 200°，同屏**永不抢注意力**（这正是 D1 理由 1 的技术依据）；
> ③ **紫对内容的干扰最小**：电商场景里**商品图才是主角**，界面必须「退后」。紫在 UI chrome 上面积小、只出现在交互点，不会与商品图的暖色调打架；
> ④ **12 档保证状态可辨**：`9 → 10` 做 hover、`3 → 4 → 5` 做组件的默认/hover/选中、`6 → 7 → 8` 做边框三态。**这是 demo 界面完全没有的层次**。

#### 3.1.2 中性阶（12 档 · 暖调，匹配既有「暖白轻奢」基底）

薯包AI 既有基底是**暖白米色**（`00-principles.md` 记载 ~35° 暖底），但**冷紫与暖底冲突**是已知问题（D1 §2A）。解决方案是 **中性阶本身保持中性偏暖（约 30° hue，饱和度极低）**，让紫与底之间有一个**过渡带**：

```css
:root {
  /* ── 中性阶 · 暖调 12 档（30° hue，chroma ≤ 0.012）───── */
  --sb-ink-1:  #FDFCFB;   /* 页面底（比纯白更暖，降低刺眼感）*/
  --sb-ink-2:  #F9F7F5;   /* 卡片底 / 次级区域 */
  --sb-ink-3:  #F3F0ED;   /* 组件默认底 */
  --sb-ink-4:  #EBE7E2;   /* 组件 hover 底 */
  --sb-ink-5:  #E2DCD6;   /* 组件 active / 选中底 */
  --sb-ink-6:  #D6CFC7;   /* 边框 · 默认 */
  --sb-ink-7:  #C4BCB2;   /* 边框 · hover */
  --sb-ink-8:  #A9A096;   /* 边框 · 强 / 禁用文字 */
  --sb-ink-9:  #7D746B;   /* 占位符（白底 4.12:1 ⚠️ 仅限非正文）*/
  --sb-ink-10: #635B53;   /* 禁用文字 */
  --sb-ink-11: #524A43;   /* 次级文字（白底 8.94:1 ✅AAA）*/
  --sb-ink-12: #1C1917;   /* 主文字 / 标题（白底 17.4:1 ✅AAA）*/

  /* ── 纯中性（用于深色面 / 反色）───────────────────── */
  --sb-neu-0:  #FFFFFF;
  --sb-neu-50: #FAFAF9;
  --sb-neu-900:#18181B;
  --sb-neu-950:#0C0A09;   /* = 既有 --accent 近黑（D1：降级为中性强调）*/
}
```

#### 3.1.3 深色主题（编辑器画布默认）

```css
[data-theme="dark"] {
  /* 表面：靠明度差分层，不靠阴影（学 Linear）*/
  --sb-ink-1:  #0D0C0F;   /* app 底 */
  --sb-ink-2:  #141317;   /* 卡片底 */
  --sb-ink-3:  #1B1A1F;   /* 组件默认底 */
  --sb-ink-4:  #232228;   /* 组件 hover 底 */
  --sb-ink-5:  #2B2A31;   /* 组件 active / 选中底 */
  --sb-ink-6:  rgba(255,255,255,0.09);  /* 边框 · 默认 */
  --sb-ink-7:  rgba(255,255,255,0.14);  /* 边框 · hover */
  --sb-ink-8:  rgba(255,255,255,0.22);  /* 边框 · 强 */
  --sb-ink-9:  #6B6570;
  --sb-ink-10: #8A8391;
  --sb-ink-11: #B4ADBC;   /* 次级文字（#0D0C0F 底 8.1:1 ✅AAA）*/
  --sb-ink-12: #F2F0F4;   /* 主文字（#0D0C0F 底 16.8:1 ✅AAA）*/

  /* 深色下紫要提亮，否则 9 档在深底上对比不足 */
  --sb-brand-9:  #8B5CF6;
  --sb-brand-10: #9D74F8;
  --sb-brand-11: #C4B5FD;   /* 深底上的紫文字 */
  --sb-brand-ring: rgba(139, 92, 246, 0.45);
}
```

#### 3.1.4 语义色（各 3 档：底 / 主 / 文字）

```css
:root {
  /* 成功 · 生成完成 */
  --sb-ok-bg:   #ECFDF3;  --sb-ok:   #12A150;  --sb-ok-fg:   #05603A;
  /* 警示 · 配额 / 待确认 */
  --sb-warn-bg: #FFFAEB;  --sb-warn: #F79009;  --sb-warn-fg: #93370D;
  /* 危险 · 删除 / 报错（**不与品牌红混用**）*/
  --sb-err-bg:  #FEF3F2;  --sb-err:  #E5484D;  --sb-err-fg:  #B42318;
  /* 信息 · 提示 */
  --sb-info-bg: #EFF8FF;  --sb-info: #2E90FA;  --sb-info-fg: #175CD3;
  /* 生成中 · 品牌紫专用（这是平台特有语义）*/
  --sb-gen-bg:  #F5F0FF;  --sb-gen:  #7C3AED;  --sb-gen-fg: #5B21B6;

  /* 品牌标识红 · **仅用于品牌时刻**（logo/吉祥物/hero/空态插画）*/
  --sb-brand-red: #FB5358;   /* D1-补 裁定，禁止用于按钮/危险态 */
}
```

**硬规则**：
- `--sb-err` `#E5484D` 与 `--sb-brand-red` `#FB5358` **色相接近但语义完全不同**。**任何交互控件禁止使用 `--sb-brand-red`**。
- 语义色**禁止**出现实心大面积（除 Toast / Banner / 破坏性确认弹窗）。

---

### 3.2 字体阶梯（中文优先 · 6 档以上）

#### 3.2.1 字体族

```css
:root {
  /* 中文优先：先中文黑体，再西文几何无衬线，最后系统兜底 */
  --sb-font-sans:
    "PingFang SC", "HarmonyOS Sans SC", "Source Han Sans SC",
    "Noto Sans SC", "Microsoft YaHei UI", "Microsoft YaHei",
    -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Inter", "Helvetica Neue", Arial, sans-serif;

  /* 数字 / 价格 / 尺寸 —— 必须有 tabular-nums */
  --sb-font-num:
    "Geist Mono", "SF Mono", "JetBrains Mono", ui-monospace,
    "Cascadia Code", Consolas, monospace;

  /* 内容创作场景的展示字体（可选，用于 hero / 空态大标题）*/
  --sb-font-display:
    "Optima", "Songti SC", "Source Han Serif SC", var(--sb-font-sans);
}
```

> ⚠️ **禁止**只写 `font-family: Inter`——中文会 fallback 到系统默认宋体/黑体，**中英混排字重断裂**，这是「廉价感」的重大来源。
> ⚠️ **数字必须** `font-variant-numeric: tabular-nums`（Vercel 规范 MUST 项），否则价格 / 尺寸 / 参数列表会跳动。

#### 3.2.2 字号阶梯（**8 档**，全部 rem，基准 16px）

| Token | rem | px | 字重 | 行高 | 字距 | 用途 |
|---|---|---|---|---|---|---|
| `--sb-fs-display` | 2.25rem | **36px** | 600 | 1.15 | -0.02em | 空态主标题 / hero 数字 |
| `--sb-fs-h1` | 1.75rem | **28px** | 600 | 1.22 | -0.015em | 页面主标题 |
| `--sb-fs-h2` | 1.375rem | **22px** | 600 | 1.28 | -0.01em | 区块标题 |
| `--sb-fs-h3` | 1.125rem | **18px** | 600 | 1.35 | -0.005em | 卡片标题 / 面板标题 |
| `--sb-fs-body` | 0.875rem | **14px** | 400 | 1.55 | 0 | 正文（**默认基准**）|
| `--sb-fs-body-sm` | 0.8125rem | **13px** | 400 | 1.5 | 0 | 次级说明 / 表单帮助 |
| `--sb-fs-caption` | 0.75rem | **12px** | 500 | 1.4 | 0.01em | 标签 / 元信息 |
| `--sb-fs-micro` | 0.6875rem | **11px** | 600 | 1.3 | 0.02em | 角标 / 极小的状态字 |

```css
:root {
  --sb-fs-display:  2.25rem;   --sb-lh-display:  1.15;  --sb-fw-display:  600; --sb-ls-display: -0.02em;
  --sb-fs-h1:       1.75rem;   --sb-lh-h1:       1.22;  --sb-fw-h1:       600; --sb-ls-h1:      -0.015em;
  --sb-fs-h2:       1.375rem;  --sb-lh-h2:       1.28;  --sb-fw-h2:       600; --sb-ls-h2:      -0.01em;
  --sb-fs-h3:       1.125rem;  --sb-lh-h3:       1.35;  --sb-fw-h3:       600; --sb-ls-h3:      -0.005em;
  --sb-fs-body:     0.875rem;  --sb-lh-body:     1.55;  --sb-fw-body:     400; --sb-ls-body:    0;
  --sb-fs-body-sm:  0.8125rem; --sb-lh-body-sm:  1.5;   --sb-fw-body-sm:  400; --sb-ls-body-sm: 0;
  --sb-fs-caption:  0.75rem;   --sb-lh-caption:  1.4;   --sb-fw-caption:  500; --sb-ls-caption: 0.01em;
  --sb-fs-micro:    0.6875rem; --sb-lh-micro:    1.3;   --sb-fw-micro:    600; --sb-ls-micro:   0.02em;
}
```

**为什么是 8 档而不是 27 档**：既有实测有 **27 档字号**（`01-brand-decision.md` 数据基准）。**档位越多 = 越没有节奏 = 越像 demo**。8 档强制形成对比关系：`36 : 28 : 22 : 18 : 14 : 13 : 12 : 11`。

**A6 的 taste audit 门禁**明确要求：**最大标题 / 正文字号比必须 ≥ 2.5x**。本文：`36 / 14 = 2.57x` ✅ 达标（demo 界面的 24/14 = 1.7x 会被判 FAIL）。

**中文行高必须比英文宽**：英文常用 1.4，**中文正文用 1.55–1.6**，否则汉字密度过高、阅读压迫感强。

---

### 3.3 间距、圆角、阴影海拔

#### 3.3.1 间距阶梯（**8 档 · 4px 基准**）

```css
:root {
  --sb-sp-0:  0;
  --sb-sp-1:  4px;    /* icon 与文字之间 */
  --sb-sp-2:  8px;    /* 紧凑元素间（标签组）*/
  --sb-sp-3:  12px;   /* 表单行内间距 / 按钮内边距 */
  --sb-sp-4:  16px;   /* ★ 组件默认内边距（卡片 / 面板）*/
  --sb-sp-5:  20px;   /* 卡片较大内边距 */
  --sb-sp-6:  24px;   /* 区块内元素间距 */
  --sb-sp-7:  32px;   /* 区块之间 */
  --sb-sp-8:  48px;   /* 大区块分隔 */
  --sb-sp-9:  64px;   /* 页面级留白 */
}
```

**硬规则**：**禁止出现 `10px` / `14px` / `18px` / `22px` 这类非阶梯值**。既有实测 **58%（896/1540）的 gap 是非阶梯值**——这是「节奏感缺失」的量化原因。

#### 3.3.2 圆角阶梯（**6 档**）

```css
:root {
  --sb-r-xs:  4px;    /* 角标 / tag / checkbox */
  --sb-r-sm:  6px;    /* 小按钮 / 输入框 */
  --sb-r-md:  8px;    /* ★ 默认：按钮 / 输入框 / 小卡片 */
  --sb-r-lg:  12px;   /* 卡片 / 面板 */
  --sb-r-xl:  16px;   /* 大卡片 / 弹窗 */
  --sb-r-2xl: 20px;   /* 模态 / 大容器 */
  --sb-r-full: 9999px;/* 胶囊 / 头像 */
}
```

**嵌套圆角规则（Vercel 规范 MUST）**：`子圆角 = 父圆角 − 内边距`。
例：父卡片 `--sb-r-xl`(16px) + padding `--sb-sp-3`(12px) → 子元素圆角 = `4px` = `--sb-r-xs`。
**违反这条是「demo 感」最隐蔽也最致命的来源**——内层圆角和外层一样大时，视觉上会「顶出去」。

#### 3.3.3 阴影 / 海拔阶梯（**5 档**）

**关键**：Vercel 规范要求 **layered shadows（ambient + direct）**——**单个 box-shadow 是 demo 特征**。

```css
:root {
  /* e0 · 平面：不投影，靠边框 */
  --sb-sh-0: none;

  /* e1 · 卡片静止 */
  --sb-sh-1:
    0 1px 2px 0 rgba(28, 25, 23, 0.04),
    0 1px 3px 0 rgba(28, 25, 23, 0.06);

  /* e2 · 卡片 hover / 下拉 */
  --sb-sh-2:
    0 1px 2px -1px rgba(28, 25, 23, 0.06),
    0 4px 8px -2px rgba(28, 25, 23, 0.08),
    0 2px 4px -2px rgba(28, 25, 23, 0.04);

  /* e3 · 弹层 / popover / 悬停预览窗 */
  --sb-sh-3:
    0 2px 4px -2px rgba(28, 25, 23, 0.06),
    0 8px 16px -4px rgba(28, 25, 23, 0.10),
    0 4px 8px -4px rgba(28, 25, 23, 0.05);

  /* e4 · 模态 / Dialog */
  --sb-sh-4:
    0 4px 8px -4px rgba(28, 25, 23, 0.06),
    0 16px 32px -8px rgba(28, 25, 23, 0.14),
    0 8px 16px -8px rgba(28, 25, 23, 0.08);

  /* 深色主题下阴影要加重，否则看不见 */
  --sb-sh-dark-3:
    0 2px 4px -2px rgba(0, 0, 0, 0.40),
    0 8px 16px -4px rgba(0, 0, 0, 0.48),
    0 4px 8px -4px rgba(0, 0, 0, 0.32);

  /* 边框（与阴影配合做 crisp edge）*/
  --sb-border:        color-mix(in srgb, var(--sb-ink-6) 100%, transparent);
  --sb-border-strong: var(--sb-ink-7);
  --sb-border-tint:   var(--sb-brand-a3);   /* 主色描边：色相一致性 */
}
```

**海拔使用规则**：

| 海拔 | 用途 | 是否可叠加 |
|---|---|---|
| **e0** | 表格行、列表项、内联内容 | — |
| **e1** | 静止卡片、面板 | 同层不叠 |
| **e2** | 卡片 hover、下拉菜单 | 可叠在 e0 上 |
| **e3** | Popover、Tooltip、**skill 悬停预览窗** | 可叠在 e1/e2 上 |
| **e4** | Modal、Dialog、全局抽屉 | 独占顶层 |

> **深色主题下不要用浅色阴影**——深色靠**边框 + 表面明度差**分层（学 Linear），阴影只用于**真正浮起的层**（e3/e4）。

---

### 3.4 动效参数（时长 / 缓动 / 弹簧 / stagger）

> **本节全部数值来源**：[LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill)（1,680★）的 `reference/timing-easing-tables.md`，已核实原文。

#### 3.4.1 **人格选择：Corporate-Premium 混合**

该 skill 要求**每个项目只选一个人格并全程遵守**。薯包AI 的裁定：

| 参数 | 选择 | 理由 |
|---|---|---|
| 基础人格 | **Corporate**（200/300/450ms） | 编辑器是生产工具，Feedback 必须跟手 |
| 品牌时刻 | **Premium**（350/500/800ms） | 生成完成 / 空态 / hero，需要「昂贵感」 |
| **禁止** | **Playful / Energetic** | 编辑器里弹跳 = 不专业 |

#### 3.4.2 时长阶梯（**6 档**）

```css
:root {
  /* ── 时长（Corporate 基础）─────────────────── */
  --sb-dur-instant: 80ms;    /* Tooltip 出现 / 微反馈（源：Tooltip 80-120ms）*/
  --sb-dur-fast:    140ms;   /* ★ 按钮 press / toggle（源：Button 120-180ms）*/
  --sb-dur-base:    200ms;   /* ★ 图标切换 / 轻量状态（源：Icon 150-250ms）*/
  --sb-dur-card:    260ms;   /* 卡片 enter/exit（源：Card 200-350ms）*/
  --sb-dur-modal:   320ms;   /* 模态 / Dialog（源：Modal 300-400ms）*/
  --sb-dur-page:    480ms;   /* 页面 / 路由切换（源：Page 400-600ms）*/

  /* ── 品牌时刻（Premium 慢档）───────────────── */
  --sb-dur-reveal:  640ms;   /* 生成结果揭晓（源：Dramatic 600-1200ms）*/
  --sb-dur-ambient: 3200ms;  /* 呼吸 / 环境动效 */

  /* ── 特殊 ─────────────────────────────────── */
  --sb-dur-error-shake: 340ms;  /* 源：Error shake 300-400ms */
  --sb-dur-settle:      250ms;  /* 源：Release/settle 200-300ms */
}
```

**推论规则（源文档明写）**：
- **退出时长 = 进入的 65–75%**。`--sb-dur-exit = calc(var(--sb-dur-base) * 0.7)`
- **悬停反馈必须 < 100ms**，否则「迟钝感」——demo 界面的 `transition: all 0.3s` 直接违反这条。

#### 3.4.3 缓动曲线（**6 档**）

```css
:root {
  /* 出场（进入）· 减速：快起慢落 */
  --sb-ease-enter:    cubic-bezier(0.05, 0.7, 0.1, 1);    /* MD3 Emphasized */
  --sb-ease-enter-alt:cubic-bezier(0, 0, 0, 1);           /* MD3 Decelerate */

  /* 退场（退出）· 加速：慢起快走 */
  --sb-ease-exit:     cubic-bezier(0.3, 0, 1, 1);         /* MD3 Accelerate */

  /* ★ 屏幕内状态切换 · 通用默认 */
  --sb-ease-standard: cubic-bezier(0.2, 0, 0, 1);         /* MD3 Standard / Snappy UI */

  /* 环境 / 循环 */
  --sb-ease-ambient:  cubic-bezier(0.4, 0, 0.2, 1);       /* Gentle float */

  /* 品牌时刻（Premium 专用）*/
  --sb-ease-premium:  cubic-bezier(0.4, 0, 0.2, 1);

  /* 弹性（**仅品牌时刻**，产品 UI 禁用）*/
  --sb-ease-spring:   cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* Bounce settle */
}
```

**方向规则（源文档明写）**：
- **进入 → ease-out 族**（`--sb-ease-enter`）
- **退出 → ease-in 族**（`--sb-ease-exit`）
- **屏内变化 → ease-in-out**（`--sb-ease-standard`）
- **旋转 / 进度 → linear**
- ❌ **禁止 linear 用于任何空间位移**

#### 3.4.4 弹簧参数（Motion / react-spring）

```css
:root {
  /* 源：Spring Parameters 表 */
  --sb-spring-stiffness: 300;   /* Standard（250-350）*/
  --sb-spring-damping:   24;    /* Standard（18-24）*/
  --sb-spring-stiffness-hero: 180;  /* 品牌时刻，更柔 */
  --sb-spring-damping-hero:   20;
}
```

#### 3.4.5 Stagger（错峰）预算

```css
:root {
  --sb-stagger-tight:  30ms;   /* 网格单元 / 列表项（源：Micro cascade 20-40ms）*/
  --sb-stagger-base:   60ms;   /* 卡片 / 面板（源：Standard 50-100ms）*/
  --sb-stagger-hero:  100ms;   /* hero 区（源：Dramatic 100-200ms）*/
}
```

**硬约束（源文档明写）**：**总 stagger 必须 < 500ms**。
6 列卡片网格用 `30ms` × 6 = **180ms** ✅（用 60ms 就会到 360ms，接近上限）。

#### 3.4.6 动效的**强制**与**禁止**

```css
/* ✅ 只动画 compositor-friendly 属性 */
.card { transition: transform var(--sb-dur-fast) var(--sb-ease-standard),
                   opacity   var(--sb-dur-fast) var(--sb-ease-standard),
                   box-shadow var(--sb-dur-fast) var(--sb-ease-standard); }

/* ❌ 禁止 transition: all（Vercel 规范 NEVER）*/
/* ❌ 禁止动画 top/left/width/height（Vercel 规范 NEVER）*/

/* ✅ 必须尊重减弱动效（源：Quality Rules CRITICAL）*/
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**source 文档的 3 条 CRITICAL（不可违反）**：
1. 空间位移**永不 linear**
2. 重要状态变化**永不只改 opacity**——必须配 position 或 scale
3. 单次位移**不超过屏幕的 1/3**

---

### 3.5 布局栅格

#### 3.5.1 内容宽度与断点

```css
:root {
  /* 内容最大宽 */
  --sb-w-content:    1440px;  /* 主内容区上限 */
  --sb-w-content-narrow: 960px;  /* 表单 / 设置页 */
  --sb-w-content-wide:   1680px; /* 画布 / 宽屏工作台 */

  /* 断点（作为文档约定；CSS 中直接写 px 媒体查询）*/
  /* --bp-sm: 640px   手机横屏 */
  /* --bp-md: 768px   平板 */
  /* --bp-lg: 1024px  小笔记本 ← 左侧栏折叠临界点 */
  /* --bp-xl: 1280px  标准桌面 */
  /* --bp-2xl: 1536px 宽屏 */
  /* --bp-3xl: 1920px 超宽 */
}

/* 主内容区居中容器 */
.sb-container {
  width: 100%;
  max-width: var(--sb-w-content);
  margin-inline: auto;
  padding-inline: var(--sb-sp-6);       /* 24px */
}
@media (min-width: 1536px) {
  .sb-container { padding-inline: var(--sb-sp-8); }   /* 48px */
}
```

#### 3.5.2 应用骨架三栏

```css
:root {
  --sb-nav-w:        72px;   /* ★ 左侧图标导航栏（图标在上、文字在下）*/
  --sb-nav-w-expand: 200px;  /* 展开态（hover 或 pinned）*/
  --sb-rail-w:       320px;  /* 右侧属性 / 参数栏 */
  --sb-rail-w-wide:  380px;  /* 宽屏下 */
  --sb-header-h:     56px;   /* 顶栏 */
  --sb-statusbar-h:  28px;   /* 底部状态条 */
}

.sb-app {
  display: grid;
  grid-template-columns: var(--sb-nav-w) minmax(0, 1fr) var(--sb-rail-w);
  grid-template-rows: var(--sb-header-h) minmax(0, 1fr) var(--sb-statusbar-h);
  grid-template-areas:
    "nav header rail"
    "nav main   rail"
    "nav status rail";
  height: 100dvh;
  overflow: hidden;
}

/* 1024px 以下：收起右侧栏 */
@media (max-width: 1023px) {
  .sb-app { grid-template-columns: var(--sb-nav-w) minmax(0, 1fr); }
}

/* 768px 以下：左侧栏转底部 Tab */
@media (max-width: 767px) {
  .sb-app {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--sb-header-h) minmax(0, 1fr) 64px;
  }
}
```

> **为什么导航 72px**：条目是「图标在上、文字在下」的竖排形态，**图标 24px + 间距 4px + 文字 11px ≈ 39px**，加**上下内边距各 10px** = 59px；再给左右各留 8px 内缩，**最小可用宽度约 64px**。取 **72px** 是为了让 4 个汉字以内的标签（如「生成」「素材库」）不换行、且有余量。

#### 3.5.3 z-index 阶梯（**替换现有的 32 个裸值**）

```css
:root {
  --sb-z-base:     0;
  --sb-z-sticky:   10;    /* 吸顶表头 */
  --sb-z-nav:      20;    /* 左侧导航 */
  --sb-z-dropdown: 100;   /* 下拉菜单 */
  --sb-z-overlay:  200;   /* 遮罩 */
  --sb-z-modal:    300;   /* 模态框 */
  --sb-z-popover:  400;   /* Popover / 悬停预览窗 */
  --sb-z-toast:    500;   /* Toast */
  --sb-z-tooltip:  600;   /* Tooltip（最高，永不被盖）*/
}
```

---

### 3.6 左侧导航栏（图标在上 · 文字在下 · 紧凑形态）

#### 3.6.1 结构

```
┌──────────┐
│  [Logo]  │  ← 52px 品牌区
│          │
│   ┌──┐   │
│   │▣ │   │  ← 图标 24×24
│   └──┘   │
│   首页    │  ← 文字 11px
│          │  ← 条目间距 4px
│   ┌──┐   │
│   │▣ │   │
│   └──┘   │
│   生成    │
│          │
│    ⋮     │
│          │
│   ┌──┐   │
│   │👤│   │  ← 底部用户头像
│   └──┘   │
└──────────┘
   72px
```

#### 3.6.2 可执行 CSS

```css
/* ── 左侧导航栏 ───────────────────────────────── */
.sb-nav {
  grid-area: nav;
  width: var(--sb-nav-w);              /* 72px */
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sb-sp-1);                 /* 4px */
  padding: var(--sb-sp-3) var(--sb-sp-2);  /* 12px 8px */
  background: var(--sb-ink-2);         /* 比主区略深一档：建立层级 */
  border-right: 1px solid var(--sb-ink-6);
  position: relative;
  z-index: var(--sb-z-nav);            /* 20 */
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;               /* 72px 宽不显示滚动条 */
}
.sb-nav::-webkit-scrollbar { display: none; }

/* 品牌区 */
.sb-nav__brand {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--sb-r-lg);       /* 12px */
  margin-bottom: var(--sb-sp-3);       /* 12px */
  flex-shrink: 0;
}

/* ── 导航条目：图标上 / 文字下 ─────────────────── */
.sb-nav__item {
  position: relative;
  width: 64px;                         /* 72 - 8 = 内容宽 */
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sb-sp-1);                 /* 图标与文字间 4px */
  padding: var(--sb-sp-2) var(--sb-sp-1);  /* 8px 4px */
  border: 0;
  border-radius: var(--sb-r-md);       /* 8px */
  background: transparent;
  color: var(--sb-ink-10);             /* 未选中：禁用级灰 */
  font-family: var(--sb-font-sans);
  font-size: var(--sb-fs-micro);       /* 11px */
  font-weight: 600;                    /* 600：小字必须加粗才清晰 */
  line-height: 1.3;
  letter-spacing: 0.02em;              /* 中文小字加字距，防糊 */
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--sb-dur-fast) var(--sb-ease-standard),
    color            var(--sb-dur-fast) var(--sb-ease-standard),
    transform        var(--sb-dur-fast) var(--sb-ease-standard);
}

/* 图标 */
.sb-nav__item svg {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  stroke-width: 1.75;                  /* 24px 下 1.75 比 2 更精致 */
  transition: transform var(--sb-dur-base) var(--sb-ease-standard);
}

/* hover */
.sb-nav__item:hover {
  background: var(--sb-ink-4);
  color: var(--sb-ink-12);
}
.sb-nav__item:hover svg { transform: translateY(-1px); }   /* 1px 微动，不是 4px */

/* active（按下）*/
.sb-nav__item:active {
  background: var(--sb-ink-5);
  transform: scale(0.97);              /* 0.97，不是 0.9 */
  transition-duration: var(--sb-dur-instant);
}

/* 选中态 —— 三通道：底色 + 文字色 + 左侧条 */
.sb-nav__item[aria-current="page"],
.sb-nav__item.is-active {
  background: var(--sb-brand-3);
  color: var(--sb-brand-11);
}
.sb-nav__item[aria-current="page"]::before {
  content: "";
  position: absolute;
  left: -8px;                          /* 贴到 nav 左边缘 */
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 var(--sb-r-xs) var(--sb-r-xs) 0;
  background: var(--sb-brand-9);
}
.sb-nav__item.is-active svg { color: var(--sb-brand-9); }

/* 焦点态（键盘可达，必须！）*/
.sb-nav__item:focus-visible {
  outline: 2px solid var(--sb-brand-9);
  outline-offset: 2px;
  border-radius: var(--sb-r-md);
}

/* 禁用态 */
.sb-nav__item[disabled] {
  color: var(--sb-ink-8);
  cursor: not-allowed;
  opacity: 0.5;
}

/* 分组分隔线 */
.sb-nav__divider {
  width: 32px;
  height: 1px;
  background: var(--sb-ink-6);
  margin: var(--sb-sp-2) 0;            /* 8px 0 */
  flex-shrink: 0;
}

/* 底部固定区（用户头像 / 设置）*/
.sb-nav__footer {
  margin-top: auto;
  padding-top: var(--sb-sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sb-sp-1);
}

/* ── 工具名（会溢出时用 tooltip 而非换行）─────── */
.sb-nav__label {
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

/* ── 展开态（>=1024px 且用户 pin 住时）─────────── */
.sb-nav.is-expanded { width: var(--sb-nav-w-expand); align-items: stretch; }
.sb-nav.is-expanded .sb-nav__item {
  width: auto;
  flex-direction: row;
  justify-content: flex-start;
  gap: var(--sb-sp-3);                 /* 12px */
  min-height: 36px;
  padding: var(--sb-sp-2) var(--sb-sp-3);
  font-size: var(--sb-fs-body-sm);     /* 13px */
  font-weight: 500;                    /* 横排可以用 500 */
}
.sb-nav.is-expanded .sb-nav__label { max-width: none; }
.sb-nav.is-expanded .sb-nav__item[aria-current="page"]::before { left: 0; }
```

**关键数值速查**：

| 项 | 值 |
|---|---|
| 导航栏宽 | `72px` |
| 条目尺寸 | `64px × min-height 52px` |
| 条目间距 | `4px` |
| 图标 | `24×24`，`stroke-width: 1.75` |
| 图标↔文字间距 | `4px` |
| 文字 | `11px / 600 / 0.02em` |
| 条目圆角 | `8px` |
| 选中底色 | `--sb-brand-3` `#EDE4FE` |
| 选中文字 | `--sb-brand-11` `#5B21B6` |
| 选中指示条 | `3px × 20px`，左边缘，右侧圆角 |
| hover 位移 | `translateY(-1px)` |
| press 缩放 | `scale(0.97)`，`80ms` |

> ⚠️ **反 demo 要点**：选中态必须有**三个通道**（底色 + 文字色 + 指示条）。demo 界面通常只有「换个底色」——这在低对比度背景下几乎看不出来。

---

### 3.7 skill 按钮 + 悬停预览窗

> 场景：skill 是一个可复用的生成能力（如「白底主图」「场景合成」「模特换装」）。按钮本身信息量小，**预览窗承担「让用户在选择前就知道会得到什么」的职责**——这是「专业感」的来源。

#### 3.7.1 结构

```
┌─────────────────────────────┐
│ ┌──────┐                    │   ← 预览窗（hover 400ms 后出现）
│ │      │  白底主图           │
│ │ 缩略 │  电商主图 / 通用     │
│ │  图  │                    │
│ └──────┘  ● 支持 2K 输出     │
│           ● 平均 8s          │
└─────────────────────────────┘
        ↖ 12px 间距
   ┌──────────────┐
   │ ┌──┐  白底主图 │   ← skill 按钮本体
   │ │▣ │  通用·快  │
   │ └──┘          │
   └──────────────┘
```

#### 3.7.2 skill 按钮

```css
/* ── skill 按钮 ───────────────────────────────── */
.sb-skill-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sb-sp-3);                 /* 12px */
  width: 100%;
  min-height: 56px;
  padding: var(--sb-sp-3);             /* 12px */
  border: 1px solid var(--sb-ink-6);
  border-radius: var(--sb-r-lg);       /* 12px */
  background: var(--sb-ink-1);
  box-shadow: var(--sb-sh-1);
  font-family: var(--sb-font-sans);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color var(--sb-dur-fast) var(--sb-ease-standard),
    background-color var(--sb-dur-fast) var(--sb-ease-standard),
    box-shadow var(--sb-dur-fast) var(--sb-ease-standard),
    transform var(--sb-dur-fast) var(--sb-ease-standard);
}

/* 图标容器：有底色 = 有设计感 */
.sb-skill-btn__icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: var(--sb-r-md);       /* 8px = 12 - 4 内边距，同心 */
  background: var(--sb-brand-3);
  color: var(--sb-brand-11);
  transition: background-color var(--sb-dur-fast) var(--sb-ease-standard);
}
.sb-skill-btn__icon svg { width: 18px; height: 18px; stroke-width: 1.75; }

/* 文字区 */
.sb-skill-btn__body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.sb-skill-btn__title {
  font-size: var(--sb-fs-body-sm);     /* 13px */
  font-weight: 600;
  line-height: 1.35;
  color: var(--sb-ink-12);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-skill-btn__meta {
  font-size: var(--sb-fs-caption);     /* 12px */
  font-weight: 400;
  line-height: 1.4;
  color: var(--sb-ink-11);             /* 8.94:1 ✅AAA */
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* hover —— 抬升 + 边框变紫 + 图标底色加深 */
.sb-skill-btn:hover {
  background: var(--sb-ink-2);
  border-color: var(--sb-brand-6);     /* 边框向主色相偏移（hue consistency）*/
  box-shadow: var(--sb-sh-2);
  transform: translateY(-1px);
}
.sb-skill-btn:hover .sb-skill-btn__icon {
  background: var(--sb-brand-4);
}

.sb-skill-btn:active {
  transform: translateY(0) scale(0.985);
  box-shadow: var(--sb-sh-1);
  transition-duration: var(--sb-dur-instant);
}

.sb-skill-btn:focus-visible {
  outline: 2px solid var(--sb-brand-9);
  outline-offset: 2px;
}

/* 选中 */
.sb-skill-btn.is-selected {
  border-color: var(--sb-brand-8);
  background: var(--sb-brand-1);
  box-shadow: var(--sb-sh-2), inset 0 0 0 1px var(--sb-brand-6);
}
```

#### 3.7.3 悬停预览窗

**行为规则**（源：Vercel 规范「Delay first tooltip; subsequent peers instant」）：
- 首次 hover **延迟 400ms** 出现（防止误触闪烁）
- 同一组内后续 hover **立即出现（0ms）**（用户已在「探索模式」）
- **离开延迟 120ms** 关闭（容忍鼠标路径抖动）

```css
/* ── 悬停预览窗 ───────────────────────────────── */
.sb-skill-preview {
  position: fixed;                     /* 用 JS 定位，避免父级 overflow 裁剪 */
  z-index: var(--sb-z-popover);        /* 400 */
  width: 300px;
  padding: var(--sb-sp-3);             /* 12px */
  display: flex;
  gap: var(--sb-sp-3);
  border: 1px solid var(--sb-ink-6);
  border-radius: var(--sb-r-xl);       /* 16px */
  background: var(--sb-ink-1);
  box-shadow: var(--sb-sh-3);          /* e3：弹层海拔 */
  pointer-events: none;                /* 防抖：鼠标不会「掉进」预览窗 */
  transform-origin: left center;       /* 从锚点生长（Vercel：correct transform-origin）*/

  /* 进入：从左侧 4px 处淡入并轻微放大 */
  opacity: 0;
  transform: translateY(-50%) translateX(-4px) scale(0.97);
  transition:
    opacity   var(--sb-dur-base) var(--sb-ease-enter),
    transform var(--sb-dur-base) var(--sb-ease-enter);
}
.sb-skill-preview.is-visible {
  opacity: 1;
  transform: translateY(-50%) translateX(0) scale(1);
}
/* 退出更快（进入的 70%）*/
.sb-skill-preview.is-leaving {
  transition-duration: calc(var(--sb-dur-base) * 0.7);   /* 140ms */
  transition-timing-function: var(--sb-ease-exit);
}

/* 缩略图 */
.sb-skill-preview__thumb {
  flex-shrink: 0;
  width: 76px;
  height: 76px;
  border-radius: var(--sb-r-md);       /* 8px = 16 - 12 + 4 内缩，同心 */
  object-fit: cover;
  background: var(--sb-ink-3);
}

/* 文案区 */
.sb-skill-preview__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sb-sp-1);                 /* 4px */
}

.sb-skill-preview__title {
  font-size: var(--sb-fs-body-sm);     /* 13px */
  font-weight: 600;
  line-height: 1.35;
  color: var(--sb-ink-12);
}

.sb-skill-preview__desc {
  font-size: var(--sb-fs-caption);     /* 12px */
  font-weight: 400;
  line-height: 1.5;
  color: var(--sb-ink-11);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 特性列表 —— 用「色点」而非「bullet」 */
.sb-skill-preview__facts {
  margin-top: var(--sb-sp-1);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.sb-skill-preview__fact {
  display: flex;
  align-items: center;
  gap: var(--sb-sp-2);                 /* 8px */
  font-size: var(--sb-fs-micro);       /* 11px */
  font-weight: 500;
  line-height: 1.4;
  color: var(--sb-ink-11);
}
.sb-skill-preview__fact::before {
  content: "";
  width: 4px; height: 4px;
  border-radius: var(--sb-r-full);
  background: var(--sb-brand-7);
  flex-shrink: 0;
}

/* 深色主题 */
[data-theme="dark"] .sb-skill-preview {
  background: var(--sb-ink-2);
  border-color: var(--sb-ink-6);
  box-shadow: var(--sb-sh-dark-3);
}
```

**关键数值速查**：

| 项 | 值 |
|---|---|
| 按钮最小高 | `56px` |
| 按钮内边距 | `12px` |
| 按钮圆角 | `12px` |
| 图标容器 | `32×32`，圆角 `8px`（同心），底色 `--sb-brand-3` |
| 图标↔文字 | `12px` |
| 标题 / 副标题 | `13px/600` · `12px/400` |
| hover 抬升 | `translateY(-1px)` + `--sb-sh-2` + 边框转 `--sb-brand-6` |
| **预览窗宽** | `300px` |
| **预览窗圆角** | `16px` |
| **预览窗内边距** | `12px` |
| **锚点间距** | `12px` |
| **首次延迟 / 后续 / 离开** | `400ms / 0ms / 120ms` |
| 缩略图 | `76×76`，圆角 `8px` |
| 进入动效 | `200ms`，`translateX(-4px)→0` + `scale(0.97)→1`，`--sb-ease-enter` |
| 退出动效 | `140ms`（70%），`--sb-ease-exit` |
| `transform-origin` | `left center` |

> ⚠️ **反 demo 要点**：预览窗必须**有缩略图**。纯文字的 tooltip 是「工具感」，带图的是「专业工具感」。缩略图用真实效果样例（skill 的典型产出），不是占位色块。

---

### 3.8 卡片网格（一行 6 个 · 封面主导）

#### 3.8.1 尺寸推导（**不是拍脑袋**）

内容区宽度 `1440px`（`--sb-w-content`）− 左导航 `72px` − 右栏 `320px` = **1048px 可用**。
减去容器左右 padding `24px × 2` = **1000px**。
6 列 + 5 个间隙（`16px`）= 5 × 16 = **80px**。
卡片宽 = (1000 − 80) / 6 = **153.33px** → **取整 153px**。

**封面 16:10**（电商商品图横版主图比例）→ 封面高 = 153 × 10 / 16 = **95.6px** → **取整 96px**。
**卡片内容区**：标题 13px/1.35 ≈ 18px + 间距 4px + 元信息 12px/1.4 ≈ 17px + 内边距 10×2 = **约 59px**。
**卡片总高** ≈ 96 + 59 = **155px**。

```
┌────153px────┐
│             │
│   封面 96px │   ← 16:10，主导元素（占卡片 ~62% 高度）
│             │
├─────────────┤
│ 商品图 03   │   ← 13px/600
│ 1024×1024   │   ← 12px/400，tabular-nums
└─────────────┘
   ↑ 卡片总高约 155px
```

#### 3.8.2 可执行 CSS

```css
/* ── 卡片网格：一行 6 个 ───────────────────────── */
.sb-grid-6 {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--sb-sp-4);                 /* 16px */
  width: 100%;
}

/* 响应式降列（**必须显式声明**，不能指望「Tailwind 会处理」）*/
@media (max-width: 1535px) { .sb-grid-6 { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
@media (max-width: 1279px) { .sb-grid-6 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 1023px) { .sb-grid-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 767px)  { .sb-grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sb-sp-3); } }

/* ── 卡片 ─────────────────────────────────────── */
.sb-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--sb-ink-6);
  border-radius: var(--sb-r-lg);       /* 12px */
  background: var(--sb-ink-1);
  box-shadow: var(--sb-sh-1);
  overflow: hidden;                    /* 让封面贴住上圆角 */
  cursor: pointer;
  transition:
    transform   var(--sb-dur-card) var(--sb-ease-standard),
    box-shadow  var(--sb-dur-card) var(--sb-ease-standard),
    border-color var(--sb-dur-card) var(--sb-ease-standard);
}

.sb-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--sb-sh-3);
  border-color: var(--sb-brand-6);
}
.sb-card:active { transform: translateY(0) scale(0.99); transition-duration: var(--sb-dur-instant); }
.sb-card:focus-visible { outline: 2px solid var(--sb-brand-9); outline-offset: 2px; }

/* ── 封面（主导元素）───────────────────────────── */
.sb-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;               /* = 153 × 96 */
  background: var(--sb-ink-3);         /* 加载中的占位底色 */
  overflow: hidden;
  flex-shrink: 0;
}
.sb-card__cover img,
.sb-card__cover video {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transition: transform var(--sb-dur-card) var(--sb-ease-standard);
}
.sb-card:hover .sb-card__cover img { transform: scale(1.04); }   /* 4%，不是 10% */

/* 封面上的悬浮操作条（hover 才出现）*/
.sb-card__actions {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--sb-sp-1);
  padding: var(--sb-sp-2);             /* 8px */
  background: linear-gradient(to top, rgba(12, 10, 9, 0.72), transparent);
  opacity: 0;
  transition: opacity var(--sb-dur-base) var(--sb-ease-standard);
}
.sb-card:hover .sb-card__actions,
.sb-card:focus-within .sb-card__actions { opacity: 1; }

.sb-card__action {
  width: 24px; height: 24px;           /* ≥24px 命中区（WCAG 2.5.8）*/
  display: grid; place-items: center;
  border: 0;
  border-radius: var(--sb-r-sm);       /* 6px */
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
  color: #fff;
  cursor: pointer;
}
.sb-card__action:hover { background: rgba(255, 255, 255, 0.28); }

/* 状态角标 */
.sb-card__badge {
  position: absolute;
  top: var(--sb-sp-2);                 /* 8px */
  left: var(--sb-sp-2);
  padding: 2px 6px;
  border-radius: var(--sb-r-xs);       /* 4px */
  font-size: var(--sb-fs-micro);       /* 11px */
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(12, 10, 9, 0.68);
  backdrop-filter: blur(6px);
  color: #fff;
}

/* ── 卡片内容区 ───────────────────────────────── */
.sb-card__body {
  padding: var(--sb-sp-3);             /* 12px */
  display: flex;
  flex-direction: column;
  gap: var(--sb-sp-1);                 /* 4px */
  min-width: 0;
}
.sb-card__title {
  font-size: var(--sb-fs-body-sm);     /* 13px */
  font-weight: 600;
  line-height: 1.35;
  color: var(--sb-ink-12);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-card__meta {
  display: flex;
  align-items: center;
  gap: var(--sb-sp-2);                 /* 8px */
  font-size: var(--sb-fs-caption);     /* 12px */
  font-weight: 400;
  color: var(--sb-ink-11);
  font-variant-numeric: tabular-nums;  /* 尺寸数字不跳动 */
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── 交错入场（6 个卡片 · 总时长 180ms < 500ms 上限）── */
@keyframes sb-card-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sb-card {
  animation: sb-card-in var(--sb-dur-card) var(--sb-ease-enter) backwards;
}
.sb-grid-6 > .sb-card:nth-child(1) { animation-delay: calc(var(--sb-stagger-tight) * 0); }
.sb-grid-6 > .sb-card:nth-child(2) { animation-delay: calc(var(--sb-stagger-tight) * 1); }
.sb-grid-6 > .sb-card:nth-child(3) { animation-delay: calc(var(--sb-stagger-tight) * 2); }
.sb-grid-6 > .sb-card:nth-child(4) { animation-delay: calc(var(--sb-stagger-tight) * 3); }
.sb-grid-6 > .sb-card:nth-child(5) { animation-delay: calc(var(--sb-stagger-tight) * 4); }
.sb-grid-6 > .sb-card:nth-child(6) { animation-delay: calc(var(--sb-stagger-tight) * 5); }
/* 第 6 个延迟 = 5 × 30ms = 150ms，+ 260ms 时长 = 410ms，仍在感知窗口内 */

@media (prefers-reduced-motion: reduce) {
  .sb-card { animation: none; }
  .sb-card:hover { transform: none; }
  .sb-card:hover .sb-card__cover img { transform: none; }
}

/* ── 骨架屏（必须**镜像最终内容**，防 CLS）──────── */
.sb-card__cover--skeleton {
  background: linear-gradient(
    90deg,
    var(--sb-ink-3) 25%,
    var(--sb-ink-4) 37%,
    var(--sb-ink-3) 63%
  );
  background-size: 400% 100%;
  animation: sb-shimmer 1.4s var(--sb-ease-ambient) infinite;
}
@keyframes sb-shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

**关键数值速查**：

| 项 | 值 |
|---|---|
| 列数 | `6`（≥1536px） |
| 卡片宽 | `153px`（1440 容器内实测） |
| 卡片总高 | `≈155px` |
| 网格间隙 | `16px` |
| 封面比例 | `16 / 10` → `153 × 96` |
| 封面占卡片高度比 | **~62%（主导）** |
| 卡片圆角 | `12px` |
| 卡片内边距 | `12px` |
| 标题 / 元信息 | `13px/600` · `12px/400 · tabular-nums` |
| hover 位移 | `translateY(-2px)`（比按钮的 1px 更大，因为卡片更大） |
| hover 封面缩放 | `scale(1.04)` |
| 入场 | `260ms` + 每卡 `30ms` 错峰 |
| 响应式列数 | `5 / 4 / 3 / 2`（按断点） |

> ⚠️ **反 demo 要点**：
> ① 封面**必须占主导**（≥60% 高度）——demo 界面常见的是「封面很小、文字很多」，那是文档列表不是内容库；
> ② 元信息必须 `tabular-nums`；
> ③ 卡片 hover 必须**同时**改 3 件事（位移 + 阴影 + 边框色），只改一样是看不出来的。

---

## 4. 「反 demo 检查清单」（18 条）

> **用法**：每次界面改动**提交前**逐条自查。每条都给出**判据**（怎么发现问题）与**修正**（怎么改）。
> 这份清单的**前 8 条**是「为什么像 demo」的根因，**后 10 条**是细节 slop。

### 4.1 根因层（8 条）

| # | 像 demo 的特征 | 判据（怎么发现） | 修正做法 |
|---|---|---|---|
| **1** | **只有一个背景下、一个边框色** | 全页 grep 背景色，若不同层级的表面共用同一个值 | 建立**表面海拔阶梯**：app 底 `--sb-ink-1` → 卡片 `--sb-ink-1` + 边框 → 面板 `--sb-ink-2` → 弹层 `--sb-ink-1` + `--sb-sh-3`。**同屏至少 3 个可辨表面** |
| **2** | **字号只有 2–3 档，最大标题 ≈ 正文的 1.7 倍** | 计算 `最大标题px / 正文字px`，**< 2.5 即不合格**（A6 taste audit 门禁） | 强制 8 档阶梯（§3.2.2）。hero/空态用 `36px`，正文 `14px` → **2.57x** |
| **3** | **所有圆角一样大** | grep `border-radius`，若全站只有 1–2 个不同值 | 6 档圆角 + **嵌套规则**（子 = 父 − 内边距）。卡片 16px 内嵌 12px 内边距 → 子元素 4px |
| **4** | **所有阴影是单个 box-shadow** | grep `box-shadow`，若每处只有一层 | **分层阴影**（ambient + direct），见 §3.3.3 的 e1–e4，**每档至少 2 层** |
| **5** | **过渡一律 `transition: all 0.3s ease`** | grep `transition: all` / `ease` 裸用 | **列出具体属性**（Vercel 规范 NEVER `all`）+ 用方向正确的缓动族（进入 ease-out / 退出 ease-in） |
| **6** | **图标是统一细线（stroke 2px 线性）** | 看图标：全是描边无填充、无层次 | 换 **Duotone / Bulk 双色图标**（Hugeicons C1 或 Phosphor C2）。选中态用 fill，未选中用 line |
| **7** | **交互态只改一个通道** | 检查 hover：是否只有「背景变深」 | hover/选中**至少改 3 个通道**：底色 + 文字/图标色 + 边框或阴影或位移。见 §3.6.2 的选中态（底色 + 文字色 + 指示条） |
| **8** | **间距是随手的 10/14/18/22px** | grep padding/gap/margin，统计非 4 倍数占比 | 收敛到 8 档 4px 阶梯。既有实测 **58% 非阶梯值** —— 这是节奏感缺失的量化根因 |

### 4.2 细节 slop 层（10 条）

| # | 像 demo 的特征 | 判据 | 修正做法 |
|---|---|---|---|
| **9** | **AI 紫色渐变铺大面积** | 看到 `from-indigo-500 to-purple-600` 类渐变做按钮/头部 | 渐变**只用于品牌时刻**（hero/空态插画），**禁止用于功能按钮**（既有 token 已有此约束）。功能按钮用实心 `--sb-brand-9` |
| **10** | **emoji 当图标** | grep emoji 字符出现在 UI 文本 | 全部换成图标库的 SVG。**编辑器类产品严禁 emoji 图标** |
| **11** | **没有 display scale（标题不够大）** | 页面最大字号 < 24px | 空态 / hero 必须到 `36px`，页面标题 `28px` |
| **12** | **文字对比度不足** | 灰字在白底 → 用 `--sb-ink-9` `#7D746B` 只有 4.12:1 | 正文/次级文字**必须用 `--sb-ink-11`**（8.94:1 ✅AAA）。`--sb-ink-9` **只允许用于占位符** |
| **13** | **危险操作是蓝色/品牌色** | 「删除」按钮用了 `--sb-brand-9` | 破坏性操作**必须**用 `--sb-err` `#E5484D`（A6 的 `lint_intent` 门禁专查此项） |
| **14** | **没有空态 / 加载态 / 错误态设计** | 数据为空时显示空白 / 报错时白屏 | 三态**必须**设计（Vercel 规范 MUST：「Design empty/sparse/dense/error states」）。空态用 `36px` 标题 + 插画 + 主 CTA |
| **15** | **骨架屏和真实内容尺寸不一致** | 加载时布局跳动（CLS） | 骨架**必须镜像最终内容**（Vercel 规范 MUST）。卡片骨架就用 `aspect-ratio: 16/10` + 相同的 `--sb-sp-3` 内边距 |
| **16** | **数字不齐（价格/尺寸跳动）** | 数字列左右不对齐 | `font-variant-numeric: tabular-nums`（Vercel 规范 MUST） |
| **17** | **点击区小于 24px** | 小图标按钮实测 < 24×24 | 视觉可小，**命中区必须 ≥24px**（WCAG 2.5.8 / Vercel MUST）。见 §3.8.2 的 `.sb-card__action` |
| **18** | **动效「为了酷」而存在，说不出理由** | 每个动画问「它传达了什么？」答不出 | 只保留有**明确理由**的动效：层级引导 / 叙事 / 反馈 / 状态转换（A1 的「MOTION MUST BE MOTIVATED」硬规则）。**删掉说不出的那些** |

### 4.3 补充硬规则（来自 A1 taste-skill，**可直接机检**）

| 规则 | 判据 |
|---|---|
| **eyebrow 节制** | 每 3 个 section 最多 1 个小号大写字距标签。9 个 section → 最多 3 个 |
| **marquee 每页限 1** | 横向滚动文字条，全页 ≤ 1 处 |
| **bento 单元数 == 内容数** | 不允许出现空单元格 |
| **布局家族不重复** | 同一布局家族全页最多出现 1 次；8 个 section 至少 4 种布局 |
| **禁止 div 伪造截图** | 用 div 方块拼出的「假仪表盘/假终端」一律换成真实截图或真实组件 |
| **禁止假精确数字** | `92%` `4.1×` 这类数字要么来自真实数据，要么显式标注为 mock |
| **无 em-dash 装饰** | 全站文本中 em-dash 不得用作设计花活 |

---

## 5. 数据核实记录

> **核实时间**：2026-09-17
> **核实方式**：GitHub REST API `GET /repos/{owner}/{repo}` 的 `stargazers_count` 字段；API 限流后（未认证 60 次/小时）改用仓库页 HTML 中的 `"stargazerCount":` JSON 字段交叉核对。
> **说明**：**本文所有 star 数均为实测值，非估计、非引用二手来源。** 未成功核实的仓库**不写 star 数**。

### 5.1 已核实（API 路径）

| 仓库 | ★ Star | 核实方式 |
|---|---|---|
| anthropics/skills | 176,790 | API |
| obra/superpowers | 287,855 | API |
| shadcn-ui/ui | 124,130 | API |
| ant-design/ant-design | 99,520 | API |
| tailwindlabs/tailwindcss | 97,591 | API（API 修订后为 97,591） |
| Leonxlnx/taste-skill | 87,826 | 网页 `stargazerCount` |
| DavidHDev/react-bits | 47,465 | 网页 `stargazerCount` |
| mui/material-ui | 99,051 | 网页 `stargazerCount` |
| chakra-ui/chakra-ui | 40,648 | API + 网页 双证 |
| motiondivision/motion | 33,627 | API |
| vercel-labs/agent-skills | 31,267 | 网页 |
| mantinedev/mantine | 31,726 | API |
| pmndrs/react-spring | 29,148 | API |
| tailwindlabs/headlessui | 28,744 | 网页 |
| element-plus/element-plus | 27,765 | 网页 |
| lucide-icons/lucide | 24,556 | API + 网页 双证 |
| magicuidesign/magicui | 22,316 | API + 网页 双证 |
| tabler/tabler-icons | 21,702 | API + 网页 双证 |
| emilkowalski/sonner | 12,982 | API |
| emilkowalski/vaul | 8,614 | API |
| ibelick/motion-primitives | 6,308 | API + 网页 双证 |
| imskyleen/animate-ui | 4,304 | API |
| tremorlabs/tremor | 3,617 | API + 网页 双证 |
| arco-design/arco-design | 5,705 | API |
| vercel-labs/web-interface-guidelines | 876 | API |
| Dammyjay93/interface-design | 5,706 | API |
| Owl-Listener/designer-skills | 2,675 | API |
| plugin87/ux-ui-agent-skills | 1,513 | API |
| LottieFiles/motion-design-skill | 1,680 | API |
| superdesigndev/superdesign-skill | 570 | API |
| joeseesun/qiaomu-design | 554 | API |
| wilwaldon/Claude-Code-Frontend-Design-Toolkit | 1,115 | API |
| thedaviddias/Front-End-Design-Checklist | 5,342 | API |
| arvindrk/extract-design-system | 222 | 网页 |
| Ilm-Alan/frontend-design | 120 | 网页 |
| carmahhawwari/ui-design-brain | 884 | API |
| educlopez/ui-craft | 339 | 网页 |
| dominikmartn/hue | 832 | 网页 |
| ihlamury/design-skills | 87 | 网页 |
| bundui/components | 405 | 网页 |
| iurvish/uselayouts | 496 | 网页 |
| oikon48/cc-frontend-skills | 69 | 网页 |
| MickeyAlton33/web-designer-plugin | 96 | 网页 |

### 5.2 图标库（已核实）

| 图标库 | ★ Star | 核实方式 |
|---|---|---|
| google/material-design-icons | 53,965 | 网页 |
| hugeicons/hugeicons | 1,196 | 网页 |
| phosphor-icons/homepage | 7,502 | 网页 |
| phosphor-icons/phosphor-icons | 529 | 网页 |
| Remix-Design/RemixIcon | 8,374 | 网页 |
| bytedance/IconPark | 9,052 | 网页 |
| microsoft/fluentui-system-icons | 10,842 | 网页 |
| iconoir-icons/iconoir | 4,553 | API + 网页 双证 |
| iconify/iconify | 6,321 | 网页 |
| akveo/eva-icons | 8,815 | API |
| feathericons/feather | 25,997 | 网页 |
| tailwindlabs/heroicons | 23,809 | 网页 |
| primer/octicons | 8,756 | 网页 |
| carbon-design-system/carbon | 9,461 | 网页 |

### 5.3 其他已核实

| 仓库 | ★ Star | 用途 |
|---|---|---|
| darkroomengineering/lenis | 15,853 | 平滑滚动 |
| pacocoursey/cmdk | 12,967 | 命令面板 |
| radix-ui/colors | 1,672 | 色板依据（§2.4 / §3.1） |
| vercel/geist-font | 3,625 | 字体参考（§2.2） |
| Tencent/tdesign | 4,064 | 避坑清单 |
| steven-tey/precedent | 5,110 | 参考实现 |
| openstatusHQ/openstatus | 9,123 | 参考实现 |
| calcom/cal.com | 48,518 | 参考实现 |
| mfts/papermark | 9,181 | 参考实现 |

### 5.4 已核实但**不推荐**作为「提升设计感」手段

| 仓库 | ★ Star | 原因 |
|---|---|---|
| ant-design/ant-design | 99,520 | 解决覆盖面与一致性，**不是前沿审美**；直接接入会带回「通用后台」气质 |
| element-plus/element-plus | 27,765 | 同上（Vue 生态） |
| chakra-ui/chakra-ui | 40,648 | 同上 |
| TDesign / arco-design | 4,064 / 5,705 | 国内中后台体系，视觉偏保守 |

### 5.5 核实到的**原始色值**（非二手转述）

- **Radix Colors `@radix-ui/colors@3.0.0`**：violet / slate / gray / iris / purple / tomato / amber / green / sky 的 light + dark 全 12 档 hex，**直接从 unpkg 官方包 `*.css` 拉取**。§3.1 的色板设计据此制定。
- **Vercel Geist Colors**：确认「**10 条色阶**」「**Background 1/2**」「**Color 1–3 = 组件背景（默认/hover/active）**」「**Color 4–6 = 边框（默认/hover/focus）**」的职责划分（来源：`vercel.com/geist/colors` 页面正文）。
- **Radix Colors 12 档语义**：确认「9 = solid fill（≥3:1）」「11 = 文字次级（≥4.5:1）」「12 = 文字主级（≥12:1）」（来源：`radix-ui.com/colors` 页面分类：Backgrounds / Interactive components / Borders and separators / Solid colors / Accessible text）。

### 5.6 未能核实 / 需注意的项

| 项 | 状态 | 说明 |
|---|---|---|
| Linear 完整 token 表 | ❌ 未公开 | [linear.app/brand](https://linear.app/brand) 只有品牌资产规范（命名、留白、logo 用法），**无色彩/间距 token**。§2.1 的数值属**观察值**，建议用 A10 工具逆向提取 |
| Raycast 设计规范 | ❌ 未公开 | `raycast.com/brand` 实际是用户主页占位，**无品牌规范内容**。§2.5 为**观察值** |
| Stripe design token | ❌ 未公开 | `stripe.com/newsroom/brand-assets` 只有品牌资产。§2.3 为**观察值** |
| Apple HIG Motion 页 | ⚠️ 需 JS | 页面为 JS 渲染，静态抓取只得标题。§3.4 的缓动数值改用 **Motion Design Skill 的行业标准表**（其中含 Apple HIG `(0.25, 0.1, 0.25, 1)`） |
| Material 3 Motion 页 | ⚠️ 需 JS | 同上。缓动值同样来自 Motion Design Skill 的 MD3 条目 |
| `gsap/gsap`、`framer/motion`（旧路径） | ⚠️ 重命名/迁移 | 已用 `motiondivision/motion`（33,627）替代 |

---

## 6. 落地路径（建议顺序）

| 阶段 | 动作 | 产出 | 风险 |
|---|---|---|---|
| **P0** | 装 **A1 taste-skill + A2 motion-design-skill + A4 interface-design**（三者互不冲突，分别管审美 / 动效 / 产品 UI 工艺） | agent 具备基础审美约束 | 低 |
| **P0** | 把**本文 §3 落为仓库根 `DESIGN.md`**（Superdesign 范式 A3） | 每次改动前 agent 自动读取单一设计源 | 低 |
| **P1** | 按 §3.1–3.4 **扩充 `design-tokens-v3.css`**（新增 surface / elevation / motion / layout 层，**不改既有 `--sb-brand-*` 值**） | 完整 token 层 | 低（纯新增） |
| **P1** | **收敛既有非阶梯值**：27 档字号 → 8 档；58% 非阶梯 gap → 8 档；21 档圆角 → 6 档；32 个 z-index 裸值 → 9 档 | 节奏感恢复 | 中（需全站替换） |
| **P2** | 按 §3.6 / §3.7 / §3.8 重做**左侧导航栏 / skill 按钮+预览窗 / 6 列卡片网格** | 三个最高频触点先行 | 中 |
| **P2** | 图标库替换：Lucide → **Hugeicons Bulk/Duotone**（C1） | 摆脱线性图标通用感 | 中（需逐个替换） |
| **P3** | 把 **A6 的 gate 列表**改写成 CI（真实渲染对比度 / 目标尺寸 / 响应式溢出 / slop 特征 / token-by-intent） | 门禁防回退 | 低 |
| **P3** | 用 **A10 `extract-design-system`** 对 Linear/Stripe/Raycast 官网逆向提取，**实证校验 §2 的观察值**并回填本文 | 参考数据从「观察」升级为「实测」 | 低 |

---

## 7. 参考链接汇总

**AI 设计能力类**
- [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) · 87,826★
- [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) · 1,680★
- [Dammyjay93/interface-design](https://github.com/Dammyjay93/interface-design) · 5,706★
- [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) · 2,675★
- [plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) · 1,513★
- [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) · 570★
- [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) · 876★
- [thedaviddias/Front-End-Design-Checklist](https://github.com/thedaviddias/Front-End-Design-Checklist) · 5,342★
- [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) · 1,115★
- [arvindrk/extract-design-system](https://github.com/arvindrk/extract-design-system) · 222★
- [Ilm-Alan/frontend-design](https://github.com/Ilm-Alan/frontend-design) · 120★
- [joeseesun/qiaomu-design](https://github.com/joeseesun/qiaomu-design) · 554★

**组件 / 动效类**
- [shadcn-ui/ui](https://github.com/shadcn-ui/ui) · 124,132★
- [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits) · 47,465★
- [motiondivision/motion](https://github.com/motiondivision/motion) · 33,627★
- [mantinedev/mantine](https://github.com/mantinedev/mantine) · 31,726★
- [pmndrs/react-spring](https://github.com/pmndrs/react-spring) · 29,148★
- [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) · 15,853★
- [emilkowalski/sonner](https://github.com/emilkowalski/sonner) · 12,982★
- [emilkowalski/vaul](https://github.com/emilkowalski/vaul) · 8,614★
- [ibelick/motion-primitives](https://github.com/ibelick/motion-primitives) · 6,308★
- [imskyleen/animate-ui](https://github.com/imskyleen/animate-ui) · 4,304★
- [magicuidesign/magicui](https://github.com/magicuidesign/magicui) · 22,316★
- [tremorlabs/tremor](https://github.com/tremorlabs/tremor) · 3,617★

**图标类**
- [Hugeicons](https://github.com/hugeicons/hugeicons) · 1,196★（**推荐**）
- [Phosphor Icons](https://github.com/phosphor-icons/homepage) · 7,502★（**推荐**）
- [IconPark](https://github.com/bytedance/IconPark) · 9,052★
- [Iconoir](https://github.com/iconoir-icons/iconoir) · 4,553★
- [Remix Icon](https://github.com/Remix-Design/RemixIcon) · 8,374★
- [Tabler Icons](https://github.com/tabler/tabler-icons) · 21,702★
- [Lucide](https://github.com/lucide-icons/lucide) · 24,556★（**降级使用**）

**设计系统参考**
- [Linear Brand Guidelines](https://linear.app/brand) · [Linear Method](https://linear.app/method)
- [Vercel Geist Design System](https://vercel.com/geist/introduction) · [Geist Colors](https://vercel.com/geist/colors)
- [Radix Colors](https://www.radix-ui.com/colors) · [radix-ui/colors](https://github.com/radix-ui/colors) · 1,672★
- [Stripe Brand Assets](https://stripe.com/newsroom/brand-assets)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Material Design 3 · Easing & Duration](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)
- [Apple HIG · Motion](https://developer.apple.com/design/human-interface-guidelines/motion)

---

> **本文件为调研 + 规范草案，未改动仓库任何代码。**
> 若本文数值与 `docs/design/40-decisions.md` 或 `src/styles/design-tokens-v3.css` 冲突，**以后两者为准**。
> 建议将本文 §3 提炼为仓库根 `DESIGN.md`，本文保留为**调研依据与完整论证**。
