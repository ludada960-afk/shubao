# 83 · 按钮交互策略（留影AI）—— 以后**所有按钮**都按这一套做

> 用户原话（2026-09-25）：
> 「你终于弄明白了，那你**把流影AI的这个按钮方法记录起来**，后面**做按钮相关的东西都用这个策略来做**」
> 「像这里的按钮你就应该使用流影AI那种按钮的UI策略去改造呀」
>
> 这份文档是**唯一依据**：写按钮（卡片按钮 / 宫格按钮 / 工具按钮 / 页签）之前先读这里，
> 不要再各自发明 hover 与选中态。实测脚本：`.qa/bj-liuying-recon2.mjs`（Playwright + 真实鼠标）。

---

## 1. 实测基线（https://liuyingai.cn/ 「技术亮点」12 宫格，2026-09-25 抓）

| 元素 | 默认 | 悬停（hover） | 备注 |
|---|---|---|---|
| 卡（按钮本体） | `background: rgb(255,255,255)`，**无渐变、无边框、无阴影**，`padding: 32px` | `background: rgb(245,247,250)`（只换底色一档） | `transition: all .5s cubic-bezier(.4,0,.2,1)` |
| 图标磁贴（56×56，圆角 16） | `#F5F7FA` 底 + `1px` 边 + **彩色图标**（`#0076F5`） | **`linear-gradient(135deg, #0076F5, #7D28CC)`** + `scale(1.05)` + 边变透明 | 全站**唯一**一处渐变 |
| 图标本身 | 品牌蓝 | **白** | 只改 `color`，不换图标 |
| 标题 | 深墨 | **品牌色**（`rgb(0,118,245)`） | 描述文字几乎不变（只加深一点） |
| 底部充能条 | `4px` 高，`width: 0`，`linear-gradient(to right, #0076F5, #7D28CC)` | `width: 100%`（**整条从左往右充满**） | 700ms；是 `width` 过渡，**不是** `scaleX/transform` |
| 网格容器 | `grid`，`gap: 1px`，父底 `rgb(228,231,236)`（**缝隙里露分隔线**），圆角 24 | — | 卡与卡之间不是留白，是 1px 缝隙 |

**关键结论（别再凭印象）**：他们的卡**默认是纯白、没有"白→蓝横向渐变"**；
渐变只出现在**图标磁贴**上；悬停时卡底只变一档浅灰。全页 12 个网格都扫过（`gradientCells: 0`）。

## 2. 策略（本站落地版）

### 2.1 三段式状态
1. **默认**：卡底近白（`--sb-surface-tint` 或纯白），图标磁贴**有底托**（`--sb-l3-option` + 1px `--sb-border-default`），图标**本身带品牌色**（不是灰的）。
2. **悬停**（四件事同时发生，缺一就不算这一套）：
   - 图标磁贴 → `linear-gradient(135deg, var(--sb-brand-400), var(--sb-brand-700))`（135°；端点取站内品牌紫的**亮/深两档**，别用相邻两档 —— 那样看不出渐变）
   - 图标 `color` → 白
   - 文字 → 品牌色（`--sb-ink-brand`）
   - 卡底 → 浅灰一档（`--sb-surface-tint-strong`）
3. **充能条**：贴底 `4px`、`linear-gradient(to right, var(--sb-brand-400), var(--sb-brand-700))`、
   `width: 0 → 100%`、`transition: width .7s cubic-bezier(.4,0,.2,1)`；**左边缘钉死**（进时右端推进、离时从右收回）。
   ⚠️ 用 `width` 过渡，**不要**用 `transform: scaleX`。
4. **选中 / 当前**：磁贴保持渐变（持久，不靠 hover），文字保持品牌色，充能条常亮。

### 2.2 颜色纪律（与站内既有裁定一致）
- **品牌色只落在小面积**：图标磁贴、充能条、选中态。**卡本体不铺品牌色**（整块染紫是被明确否过的）。
- 色相走站内品牌紫（不抄他们的 `#0076F5 / #7D28CC`，否则站里会出现两套紫）。
- **面板/分组的标题图标不再用品牌色**（2026-09-25 用户：「图标不要用紫色的……就用黑色的就好了」）
  ⇒ 标题与图标同为墨色 `--sb-ink-1`，字号 14 / 字重 800。

### 2.3 几何与动效
- 圆角：磁贴 = 外层卡 − 内边距（嵌套圆角，别让内层比外层更圆）。
- 时长/缓动统一：hover 位移 `150ms`、渐变/充能 `700ms cubic-bezier(.4,0,.2,1)`、
  其它 `var(--sb-dur-fast) var(--sb-ease-out)`。
- 只动 `transform / background / color / width(充能条)` —— **零重排**。
- `prefers-reduced-motion: reduce` 时必须全部归零。

## 3. 已落地的位置（改新按钮时照抄这些）
| 位置 | 文件 | 状态 |
|---|---|---|
| 左侧导航格子 | `src/styles/app-sidebar.css`（`.app-sidebar-cell`） | ✅ 已按实测对齐（默认近白横向渐变 / hover 浅灰 / 磁贴 135° 亮→深 / 充能条 700ms） |
| 首页技能按钮行 | `src/components/media/SkillEntryRow.css`（`.skill-entry-button`） | ✅ 磁贴 135° 渐变、充能条 to right 亮→深、hover 底深一档 |
| 首页两张模式卡 | `src/pages/Home/Home.css`（`.homepage-mode-card`） | ⚠️ **例外**：用户明确要"图标与标题固定不动，动效给下面的预览图"（见该文件批注），此处**不套**上面第 2 条 |
| 面板里的选项行 | `src/styles/design-tokens-v3.css`（`.sb-opt`） | ✅ 同一族语言（底 `--sb-l3-option` / hover 一档 / 选中底+描边+ring） |

## 4. 判据（可复查）
- `.qa/bj-liuying-recon2.mjs` 抓他们的真值；`.qa/bi-diag.mjs` / `.qa/bj-diag.mjs` 抓我们的。
- 门禁：`test/home-mode-cards.test.mjs`（模式卡的 hover 方向）、`test/media-language-unify-0916.test.mjs`（技能行）、
  `test/config-kit-parity-0925.test.mjs`（两侧配置控件同一批 token）。
