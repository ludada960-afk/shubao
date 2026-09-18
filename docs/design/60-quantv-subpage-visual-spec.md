# 60 · 知渔 AI 子页面工作台：全 skill 共用骨架 + 逐 skill 差异（CDP 实测）

> **竞品地址（用户给定）**：`https://laoyu.quantv.com/image-creation?tool=<skill>`
> —— `tool=` 这个 query 参数**就是切换 skill 的**，不用翻页面找入口。
> 视频侧另有自己的路径族（§2.4），也一并量了。
>
> **取证方式**：CDP 代理 `http://localhost:3456`（`/new` → `/navigate` → `/eval` → `/close`，
> **一次只开一个标签页、抓完立刻关**）。脚本 `.tmp/shot.mjs`，本轮探针 `.tmp/q*.js`。
> 窗口 **2048×1026（dpr 1.25）**；light / dark 双主题都量过。
>
> **只读、零成本**：全程未注册、未付费、**未提交任何生成/解析任务**；只点过页签与主题开关。
> 会话结束 `managedTabs: 0`。
>
> **本文结构**：§1 全 skill 清单（tool 值穷举）→ **§2 A. 共用骨架**（一次量到、所有页一样）→
> **§3 B. 逐 skill 差异表**（一页一行，每条标注量自哪页）→ §4 我们该怎么做 → §5 未取到。

---

## 1. 全 skill 清单（tool 值穷举）

### 1.1 图片侧：注册表里**只有 7 个** `?tool=` 值

来源：从他们的主 bundle `cdn.quantv.com/site/models/front/assets/router-nTm2HaBw.js` 里读到
**具名常量注册表**（同一行连续赋值），这是**唯一真源**，比翻导航可靠：

```js
$E=`product-listing-set`, eD=`aplus-content`, tD=`detail-image`,
nD=`image-clone`, rD=`remove-background`, iD=`ai-outfit`, aD=`text-change`
```

| # | tool 值 | 页面标题（实测 h2） | 是否在 `电商专区` 卡片里 | 备注 |
|---|---|---|---|---|
| 1 | `product-listing-set` | 商品套图 | ✅ | 我们主要对标页 |
| 2 | `aplus-content` | A+内容 | ✅ | 唯一带 **16 项可勾选清单** |
| 3 | `detail-image` | 详情图 | ✅ | 与 A+ 同骨架、少一块分组 |
| 4 | `image-clone` | 图片复刻 | ✅ | **左栏更窄（499.7）**、字段最多 |
| 5 | `remove-background` | 去除背景 | ✅ | **只有上传、0 个下拉** |
| 6 | `ai-outfit` | AI换装 | ✅ | **左栏最窄（496）**、4 个上传位 |
| 7 | `text-change` | 文字替换 | ⚠️ 目录里有、**不在电商专区** | **骨架完全不同**（见 §2.4） |

### 1.2 视频侧：**不用 `tool=`**，走独立路径族

从 bundle 的路由判定里读到这些路径（实测可达）：

| 路径 | 实测 | 骨架 |
|---|---|---|
| `/ai-video` | ✅ 可达 | **与图片侧同一套骨架**（`image-workspace-theme ai-video-workspace`） |
| `/product-video` | ✅ 可达 | **另一套**：`workflow-workspace-layout`（400px 栅格，见 §2.4） |
| `/video-clone` | ✅ 可达 | 同上（`workflow-workspace-layout`） |
| `/store-visit-video` | bundle 里有路由分支 | 未逐页量（同族推测） |
| `/video-recreation` | bundle 里有路由分支 | 未逐页量 |
| `/video-high-definition` | bundle 里有路由分支 | 未逐页量 |
| `/content-replace` | bundle 里有路由分支 | 未逐页量 |
| `/brand-ad` | bundle 里有路由分支 | 未逐页量 |
| `/ai-mix` · `/digital-human` | bundle 里有路由分支 | 未逐页量 |

> **结论**：视频侧**没有** `video-creation?tool=…` 这种统一入口，
> 而是**一功能一路径**，且**至少存在两套完全不同的工作台骨架**（`/ai-video` 一套、`workflow-workspace-layout` 一套）。

### 1.3 图片侧目录（`/image-creation`）的 3 类内容

实测 8 个分类：`精品推荐 / 电商专区 / 创意应用 / 游戏动漫 / 人像摄影 / 建筑室内 / 图片编辑 / 绘画模型`
共 **91 张卡**。**只有 `电商专区` 的 6 张走 `?tool=`**（= §1.1 的 1–6）；
其余 ~85 张是**模板类**（如「小红书爆款复刻」「电商海报设计」「提取模特穿搭」），
**它们是模板不是工具页**，点击走另一条链路（`/apps?id=…`），
实测 `/apps?id=text-change` 返回**「应用不存在」**——即模板卡不保证可达。

> ⚠️ **所以「所有 skill」的准确边界是**：
> **7 个 `?tool=` 值（图片侧，已全量实测）+ 1 个 `/ai-video`（同骨架）
> + 至少 2 个 `workflow-workspace-layout` 页（`/product-video`、`/video-clone`，已实测）**。
> 其余 ~85 张模板卡与会话外路径族**未逐页量**，不编。

---

## 2. A. 共用骨架规格（一次量到，所有页都一样）

**本节所有数值在以下页面各量一遍、逐值一致**：
`product-listing-set` / `aplus-content` / `detail-image` / `remove-background`（左栏 570.4 这四页全等）+ `/ai-video`（同骨架）

### 2.1 整页骨架

```css
/* 量自 div.app-shell，两页同值 */
html, body { height: 100%; overflow: hidden; }   /* 页面永不滚动 */
.sidebar     { flex: 0 0 250px; height: 100vh; }

/* 量自 div.app-content（四周 12.4px 白缝 + 圆角）*/
.app-content {
  margin: 12.4px 12.4px 12.4px 0;
  border-radius: 18px 12px 12px 18px;   /* 左 18 因为贴着侧栏 */
  overflow: hidden;                     /* ← 内容不外溢，所以页面不滚 */
}

/* 量自 div.image-workspace-theme.<skill>-workspace 与 main */
.workspace {
  min-height: 100vh;
  background: #f0f2f5;               /* light 实测 rgb(240,242,245) */
}
.workspace main {
  display: flex; flex-direction: row;  /* lg:flex-row（≥1024px） */
  align-items: stretch;                /* 两栏等高 */
  gap: 19.84px;                        /* gap-4 */
  padding: 19.84px;                    /* p-4  */
  height: calc(100vh - 56px);          /* 写死 56px */
  overflow: hidden;                    /* lg:overflow-hidden */
}
```

> **1.24 倍基准**：他们全站 root `font-size` 是**按屏宽算出来的**——
> 主 bundle 里 `h()` 函数写死：`n = (screenWidth×dpr > 1920) ? (w-1920)×0.006+16 : 16`，上限 20px。
> 所以在 2560 物理宽上 1rem = **19.84px**，于是 `gap-4`=19.84、`p-4`=19.84、`px-6`=29.76。
> **这不是量错，是他们按屏宽缩放的字号系统。我们不要搬这个倍率**（我们是固定 4px 栅格）。

### 2.2 两栏本体

```css
/* ── 左栏（参数列）：量自 main > div.flex.w-full.max-w-[460px].shrink-0.flex-col ──
   ⚠️ class 写着 max-w-[460px]，**实际渲染 570.4px**（lg: 断点类覆盖）。
      别抄 class 名，抄渲染值。图片侧 4 个 skill 都是 570.4。 */
.workbench-left {
  flex: 0 0 auto;                    /* shrink-0 */
  width: 570.4px;                    /* 内容盒 519.5px */
  height: 916.5px;                   /* lg:h-full，与右栏等高 */
  padding: 0;                        /* 内边距在**内层滚动器**上 */
  border-right: 0.8px solid oklch(0.928 0.006 264.531);  /* border-gray-200 */
  background: #FFFFFF;
  border-radius: 0;                  /* ← 左栏**无圆角** */
  overflow: hidden;                  /* lg:overflow-hidden（滚在内层） */
}

/* ── 右栏：量自 main > div.scrollbar-hover.min-w-0.flex-none...lg:flex-1 ── */
.workbench-right-col {
  flex: 1 1 0%;                      /* lg:flex-1 吃掉剩余全部 */
  min-width: 0;                      /* min-w-0 必须，否则内容撑破 */
  height: 916.5px;
  overflow-y: auto;                  /* ← 右栏自己就是滚动容器 */
  overflow-x: visible;
}

/* ── 右栏白面板：量自 section.<skill>-right-panel ── */
.workbench-right-panel {
  min-height: 100%;                  /* min-h-full */
  padding: 24.8px 29.76px;           /* py-5 px-6 */
  border-radius: 14.88px;            /* rounded-xl */
  background: #FFFFFF;
}
```

**量到的两栏几何（实测，`product-listing-set` 为例）**：

| 项 | 值 |
|---|---|
| 左栏 | 570.4 × 916.5（内容盒 519.5） |
| 右栏 | 1155.7 × 916.5 |
| 两栏缝 | **19.84px**（= `gap`，实测 860.1 − 840.2） |
| 外圈留白 | **19.84px**（= `main` 的 `p-4`，露出 `#f0f2f5`） |
| 顶栏 | `sticky top-0 z-10`，`h 69.4`，`pad 0 19.84`，`bg rgba(255,255,255,.95)` |

> **「两块之间要有缝」是两层叠加**：外层 `padding 19.84`（面板不贴内容区）+ 中间 `gap 19.84`（两栏互不贴）。

### 2.3 底部「蓝色背景」——**结论：不存在，他们把蓝色系统性改掉了**

用户说「这两个框的**底部是有一个蓝色的背景图**」。我在**全部实测页 × 双主题**下都找不到蓝色，
而且找到了**他们为什么没有蓝色**的**源码级证据**。

**① 蓝色变量被 remap 成中性色（CSS 实测解析值）**

| CSS 变量 | dark 主题解析值 | light 主题解析值 | 语义 |
|---|---|---|---|
| `--ch-1f6bff`（原「品牌蓝」） | `#fafafa` | `#2f3136` | 只剩白/深灰 |
| `--ch-5b8dff` | `#a1a1aa` | `#a3a3a3` | 中性灰 |
| `--ch-a8c4ff` | `#e5e7eb` | `#525252` | 中性灰 |
| `--ch-08090d`（工作台底） | `#08090d` | `#f0f2f5` | 近黑 / 冷灰 |

浅主题规则原文：
```css
html.theme-light .bg-[#1f6bff], html.theme-light .bg-[#1f6bff].text-white {
  color: rgb(250,250,250) !important;
  background: rgb(47,49,54) !important;   /* ← 蓝被强制改成深灰 */
}
```

**② 逐页扫描：蓝像素 0 命中**

| 页面 | 主题 | 蓝命中 |
|---|---|---|
| `?tool=product-listing-set` | light / dark | **0 / 0** |
| `/ai-video` | light | **0** |
| `/product-video` | light / dark | **0 / 0** |
| `/video-clone` | light | **0** |
| `/image-creation`（目录） | light | **0** |

判定方法：遍历全元素，取 `backgroundColor` 与 `backgroundImage` 里所有 `rgb()`，
按 `blue > red+15 && blue > green+8 && blue > 80` 判蓝。含伪元素与全部 stylesheet 规则。

**③ 全页 `url()` 背景只有 1 处**：侧栏 logo `img`。工作区/两栏/页脚**没有任何背景图**。

> **给落地 agent 的硬口径**：
> ① **不要**为了圆这句话添一块蓝色背景 —— 那是凭印象编数值（本任务明令禁止）。
> ② 用户看到的蓝色，最可能是**他们更早的历史版本**、**别的白标站**，或**示例图内容**（冷调商品摄影）的误认。
> ③ 但这句话背后的**真需求成立**：「两块面板**下面垫着一层更靠后的底**」——
>    这层底**确实存在**，只是颜色是 **`#f0f2f5` 冷灰**（light）/ **`#08090d` 近黑**（dark）。
>    **这层要抄，颜色换成我们的暖米 `--sb-surface-page`。** 见 §2.3.1。

#### 2.3.1 真正「在下面的一层底」是什么

```css
/* 量自 div.image-workspace-theme.product-listing-set-workspace（light）*/
.workspace-backdrop {
  position: static;          /* ← **不是**绝对定位块，也不是背景图 */
  min-height: 100vh;         /* min-h-screen */
  background: rgb(240,242,245);   /* #f0f2f5；dark 下被 remap 成 #08090d */
  /* 实测盒子 1785.6 × 1025.6，被 main 的 p-4 撑出来 */
}
```

**三层图层关系（自下而上）**：

```
① .workspace 底        #f0f2f5（static，铺满内容区）
   └─ ② main 的 padding/gap 19.84px  → **露出 ① 的灰**
        └─ ③ 左栏（白，无圆角） / 右栏白面板（白，radius 14.88）
```

**为什么读起来有「底色」**：两栏之间、面板与内容区边缘之间**各露出 19.84px 的底**。
这是**容器底色**，不是背景图。

#### 2.3.2 图层先后（`getComputedStyle` + `elementsFromPoint` 交叉验证）

全页只有**两个**元素带 `z-index`：

| # | 元素 | `position` | `z-index` | 真实作用 |
|---|---|---|---|
| 1 | `header.sticky.top-0.z-10` | `sticky` | **10** | ✅ 真叠层：滚动时内容从它下面过 |
| 2 | `div.z-10.border-t.bg-white/95`（左栏 CTA 条） | `static` | **10** | ❌ **死声明**：z-index 对 static 无效 |

其余（`main` / 两栏 / 白面板 / 示例 `figure`）**全是 `position:static` + `z-index:auto`**。

> **结论：他们没有用「绝对定位 + z-index 叠层」做骨架。**
> 唯一真叠层的是顶栏；其余靠**普通 flex 兄弟顺序**。
> CTA 条之所以“永远在底部”，**不是 sticky、也不是 z-index**，而是它**排在滚动器后面、根本不在滚动器里**（§2.4）。

### 2.4 滚动与 sticky（所有页一致）

**页面级滚动：不存在。** 实测 `window.scrollTo(0,300)` 后 `scrollY` 仍是 **0**；
`documentElement.scrollHeight === innerHeight`。父链 `.app-shell/.app-content/.app-content-body/main` **全 `overflow:hidden`**。

**两个独立滚动器**（左右各一，实测）：

| 栏 | selector（量自 `?tool=product-listing-set`） | `max-height` | `scrollH / clientH` |
|---|---|---|---|
| 左 | `main > div.scrollbar-hover.flex-none.overflow-visible.px-4.py-5.lg:min-h-0.lg:flex-1.lg:overflow-y-auto` | 无 | **1548 / 782**（可滚 766） |
| 右 | `main > div.scrollbar-hover.min-w-0.flex-none...lg:flex-1.lg:overflow-y-auto` | 无 | 916 / 916 |

（A+ 页左栏同元素 `1910 / 782`；`image-clone` 的 textarea 自己也是滚动器 `169 / 145`）

```css
/* 左栏滚动器 —— 量自上述元素 */
.left-scroller {
  flex: 1 1 0%;                 /* lg:flex-1 */
  min-height: 0;                /* lg:min-h-0 ← **能不能滚的关键**，缺了不滚 */
  overflow-y: auto;             /* lg:overflow-y-auto */
  overflow-x: visible;
  padding: 24.8px 19.84px;      /* px-4 py-5 */
}
```

> **他们不写 `max-height`**，用的是 `flex:1 + min-height:0 + overflow-y:auto` 三件套。
> **我们的 `.media-workbench-left` 写的是 `max-height: calc(100dvh - 32px)`** ——
> 我们滚的是**整栏**（含 CTA），他们滚的是**栏里的内容区**（CTA 不在里面）→ 我们的 CTA 会跟着滚。

**sticky 实测（滚动前后 `getBoundingClientRect` 对比）**：

| 元素 | position | 滚动前 top | 滚动后 top | 结论 |
|---|---|---|---|---|
| 顶栏 `header` | `sticky` z:10 | 12.4 | **12.4（不变）** | ✅ **真 sticky** |
| 左栏 CTA 条 | `static`（z:10 无效） | 883.5 | **883.5（不变）** | ✅ **假 sticky：靠 flex 排布** |

```js
scr.scrollTop = 400;                 // 左栏滚动器滚了 400
footer.getBoundingClientRect().top   // 883.5 → 883.5（**没动**）
header.getBoundingClientRect().top   // 12.4  → 12.4 （**没动**）
window.scrollY                       // 0（页面从未滚动）
```

> 他们的「底部 CTA 永远可见」= **`main` 的 flex 列**把「滚动器 `flex:1`」+「CTA 条自然高度」上下排开，
> **CTA 条压根不在滚动器里**。比 sticky 更干净，**建议我们改成这个做法**（§4）。

### 2.5 分组标题与字段标签规格（所有页一致）

```css
/* 分组标题 —— 量自 h2.text-[13px].font-medium.text-[#6b7280]
   （四个图片页 + A+ 逐值一致）*/
.group-title {
  font-size: 16.12px;        /* class 写 13px，实测 16.12 */
  font-weight: 500;
  line-height: 24.18px;
  color: rgb(107,114,128);   /* #6b7280 —— **灰的，不是黑的** */
  margin: 0;
}

/* 字段标签 —— 量自 h3.text-[14px].font-medium.text-[#111827] */
.field-label-title {
  font-size: 17.36px;        /* class 写 14px，实测 17.36 */
  font-weight: 500;
  line-height: 26.04px;
  color: rgb(17,24,39);      /* #111827 —— 近黑 */
}
```

> **层级关键**：分组标题**灰 16.12**，字段标签**黑 17.36** ——
> **字段名比分组名更重更亮**。这是他们的信息层级，不是笔误。

**分组间距（四个页一致）**：

```css
/* 量自 section.mt-8（product-listing-set / aplus-content / detail-image 三页都是）*/
section + section { margin-top: 39.68px; }   /* mt-8 */
/* 实测 section 高度：套图 469.3 / 681 / 253.8；A+ 485.5 / 461.6 / 834.4 */
```

### 2.6 控件规格（所有页一致）

```css
/* select —— 量自 select.h-10.rounded-lg.border.border-[#e5e7eb]
   （套图 / A+ / 详情图 / 图片复刻 四页同值）*/
.field-select {
  height: 49.6px;                          /* h-10 */
  padding: 0 14.88px;                      /* 0 0.75rem */
  border: 0.8px solid rgb(229,231,235);    /* border-[#e5e7eb] —— 0.8px 不是 1px */
  border-radius: 9.92px;                   /* rounded-lg */
  background: #FFFFFF;
  font-size: 17.36px; font-weight: 500; color: rgb(17,24,39);
  width: 100%;
}
/* 整行 519.5×49.6；半行（grid-cols-2）252.3×49.6 */

/* textarea —— 量自 textarea.h-[120px].w-full.resize-none */
.field-textarea {
  width: 519.5px; height: 148.8px;         /* h-[120px] → 实测 148.8 */
  padding: 9.92px 14.88px;
  border: 0.8px solid oklch(0.872 0.01 258.338);
  border-radius: 14px;                     /* ← 比 select 更圆（14 vs 9.92） */
  background: #FFFFFF;
  font-size: 16.12px; font-weight: 400; line-height: 24.8px;
  resize: none; overflow: auto;
}
/* A+ 页的卖点框是 h-[118px]→145 内容高，带自己的滚动条（169/145）*/
```

**标签↔控件间距**：

```css
/* 量自 label.flex.min-w-0.flex-col.gap-2.w-full（套图页）*/
.field { display: flex; flex-direction: column; gap: 9.92px; min-width: 0; width: 100%; }
/* 实测 label 盒高 75.6 = 标签行 16.12 + gap 9.92 + select 49.6 */

/* ⚠️ 但 A+ 页的 label 是 display:block，没有 gap —— 见 §3 差异表 */
```

**placeholder 颜色**：`getComputedStyle(ta,'::placeholder').color` 实测
`oklch(0.373 0.034 259.733)` —— **与正文同色**（≈ `#374151`），不是浅灰。
> 这是他们的选择（靠「里面是模板文案」区分）。我们**不抄**，保持 `--sb-ink-4`。

### 2.7 上传框规格（**两种形态，按页分**）

**形态 ①：大虚线卡（套图 / A+ / 详情图 三页一致，逐值相同）**

```css
/* 量自 div.h-[160px].w-[412px]...rounded-[18px].border-2.border-dashed.border-[#c8c8c8]
   （套图页 class 是 w-[412px]；A+ / 详情图 是 w-full max-w-[412px]
     —— **但三页渲染宽度都是 510.9，都撑满**）*/
.upload-card {
  width: 510.9px;                     /* 父盒 519.5 → 填充率 98.3% */
  max-width: none;                    /* ← 渲染上等于没有约束 */
  min-height: 198.4px;                /* class h-[160px] → 被内容撑到 198.4 */
  padding: 24.8px 19.84px;            /* px-4 py-5 */
  border: 2.4px dashed rgb(200,200,200);   /* border-2 → 2.4px */
  border-radius: 18px;
  background: #FFFFFF;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
}
.upload-card:hover { border-color: rgb(143,143,143); }
```

**留白实测**：父盒 519.5 → 卡 510.9 → **左侧留白 0、右侧 8.65（= 自身 border-box 差，不是布局留白）**。
**结论：他们撑满，没有 max-width。**

**内部**：

```css
.upload-icon   { width: 44.6px; height: 44.6px; margin-bottom: 14.88px; }   /* mb-3 h-9 w-9 */
.upload-title  { font-size: 17.36px; font-weight: 500; line-height: 24.8px; color: rgb(17,24,39); }
.upload-hint   { margin-top: 9.92px; font-size: 14.88px; line-height: 24.8px; color: rgb(107,114,128); }
.upload-actions{ margin-top: 19.84px; display:flex; gap: 14.88px; justify-content:center; }
.upload-btn    { height: 44px; padding: 9.92px 19.84px; border-radius: 9.92px;
                 background: rgb(249,250,251); font-size: 16.12px; font-weight: 500; }
/* 选择文件 104.2 宽；从资产库选择 163.7 宽（带文件夹图标） */
```

**形态 ②：小方格加号（去除背景页）**

```css
/* 量自 去除背景页 div.grid.h-[78px].rounded-[10px].border.border-dashed */
.upload-tile {
  width: 81.9px; height: 96.7px;
  border: 0.8px dashed rgb(214,214,214);
  border-radius: 10px;
  font-size: 24px; font-weight: 300; color: rgb(119,119,119);  /* 一个 + 号 */
}
```

### 2.8 主 CTA 与页脚条（所有页一致）

```css
/* 页脚条 —— 量自 div.z-10.border-t.border-gray-200.bg-white/95.px-6.py-4
   （套图 / A+ 两页 569.6×134.7 逐值一致）*/
.cta-bar {
  padding: 19.84px 29.76px;                /* py-4 px-6 */
  background: rgba(255,255,255,0.95);
  border-top: 0.8px solid oklch(0.928 0.006 264.531);
  /* 不在滚动器内 —— 天然钉底 */
}

/* 主 CTA —— 量自 button.image-workspace-primary-action.flex.h-11.w-full */
.cta-primary {
  width: 510.1px;                /* 撑满条内容盒（569.6 − 29.76×2） */
  height: 54.5px;                /* h-11 */
  border: 0; border-radius: 9.92px;          /* rounded-lg ← 不是胶囊、不是 12 */
  font-size: 17.36px; font-weight: 500; color: #FFFFFF;
  display: flex; align-items: center; justify-content: center; gap: 9.92px;
  background: rgb(143,143,143);              /* 未上传时的禁用灰 */
}

/* 提示语 —— 量自 p.mt-3.text-center.text-[13px].leading-5 */
.cta-hint {
  margin-top: 14.88px;           /* mt-3 */
  font-size: 16.12px; font-weight: 400; line-height: 24.8px;
  color: rgb(107,114,128); text-align: center;
}
```

> 实测：条宽 569.6，内宽 **510.1**，CTA 宽 **510.1** → **完全撑满、右侧零留白**。
> `/ai-video` 页同款：条 530 宽、按钮 530×55、提示在 `pt-3` 处。

### 2.9 付费按钮（三档，套图 / A+ / 详情图 三页同形）

**档 A：挂在分组标题行右侧的描边胶囊**（`一键解析 · 0.20 积分`）

```css
/* 量自 button.inline-flex.h-8.items-center.gap-1.5.rounded-full.border.border-gray-300
      .bg-gradient-to-b.from-white.to-gray-100.px-4
   —— 套图页 224.7×39.7；A+ 页 225×40（同一颗）*/
.paid-chip-primary {
  height: 39.7px;                /* h-8 */
  padding: 0 19.84px;            /* px-4 */
  border: 0.8px solid oklch(0.872 0.01 258.338);
  border-radius: 9999px;         /* rounded-full ← **胶囊** */
  background: linear-gradient(rgb(255,255,255) 0%, oklch(0.967 0.003 264.542) 100%);
  font-size: 16.12px; font-weight: 500; color: rgb(17,24,39);
  gap: 7.44px;                   /* gap-1.5：图标与文字 */
}
```

**档 B：挂在字段标签右侧的小号纯文字胶囊**（`AI生成 · 0.10 积分/张`）

```css
/* 量自 button.inline-flex.h-7.gap-1.rounded-full.px-2.5.text-[12px] */
.paid-chip-ghost {
  height: 34.7px;                /* h-7 */
  padding: 0 12.4px;             /* px-2.5 */
  border: 0; border-radius: 9999px; background: transparent;
  font-size: 14.88px; font-weight: 500; color: rgb(75,85,99);
  gap: 4.96px;                   /* gap-1 */
  width: 197.2px;                /* 实测（套图页） */
}
.paid-chip-ghost:hover { background: #EEEEEE; color: rgb(17,24,39); }
```

**档 C：独立成行的圆角块**（`AI推荐风格分析 · 0.10 积分`）

```css
/* 量自 button.inline-flex.h-9.min-w-[180px]...rounded-lg */
.paid-chip-block {
  min-width: 180px;              /* 实测 271.9 宽 */
  height: 44.6px;                /* h-9 */
  padding: 0 19.84px;
  border: 0.8px solid oklch(0.872 0.01 258.338);
  border-radius: 9.92px;         /* ← **圆角，不是胶囊**（与档 A 唯一差别） */
  background: linear-gradient(rgb(255,255,255) 0%, oklch(0.967 0.003 264.542) 100%);
  font-size: 16.12px; font-weight: 500;
}
```

> ⚠️ 同是「付费按钮」他们用了**两种圆角**（胶囊 / 圆角），因为**位置语义不同**：
> 挂标题旁 = chip；独立成行 = 按钮。**我们要保留这个形态差，但统一圆角语言**（§4）。

### 2.10 图标清单（全站同一套：线性 `viewBox="0 0 512 512"`）

| 位置 | 尺寸 | 颜色 | `path d`（原文，可直抄） | 形状 |
|---|---|---|---|---|
| 页头返回 | 17.4×17.4 | `rgb(75,85,99)` op .7 | `M328 112L184 256l144 144` | 左尖角 chevron |
| 上传卡大图标 | 44.6×44.6 | `rgb(17,24,39)` | `M320 367.79h76c55 0 100-29.21 100-83.6s-53-81.47-96-83.6c-8.89-85.06-71-136.8-144-136.8c-69 0-113.44 45.79-128...`<br>`M320 255.79l-64-64l-64 64`<br>`M256 448.21V207.79` | 云 + 向上箭头 |
| 从资产库选择 | 19.8×19.8 | `rgb(17,24,39)` | `M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 ...`<br>`M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a...` | 打开的文件夹 |
| 一键解析 | 19.8×19.8 | `rgb(17,24,39)` | `M178.38 178.38a31.64 31.64 0 0 0 0 44.75L223.25 268L268 223.25l-44.87-44.87a31.64 31.64 0 0 0-44.75 0z`<br>`M48 192h48`<br>`M90.18 90.18l33.94 33.94` | 魔法棒（四角星+斜杆） |
| 放大（小按钮） | 18.6×18.6 | `rgb(107,114,128)` | `M432 320v112H320`<br>`M421.8 421.77L304 304`<br>`M80 192V80h112` | 四角外扩箭头（放大/全屏） |
| AI生成 / AI推荐 | 18.6×18.6 | `rgb(75,85,99)` | `M259.92 262.91L216.4 149.77a9 9 0 0 0-16.8 0l-43.52 113.14a9 9 0 0 1-5.17 5.17L37.77 311.6a9 9 0 0 0 0 16.8l11`<br>`M108 68L88 16L68 68L16 88l52 20l20 52l20-52l52-20l-52-20z`<br>`M426.67 117.33L400 48l-26.67 69.33L304 144l69.33 26.67L400 240l26.67-69.33L496 144l-69.33-26.67z` | AI 星光（一大两小四角星） |
| 16 模块清单的对勾 | 16×16（`h-4 w-4`） | 未选中 `transparent` | 一个字符 `✓`（**不是 SVG**） | 勾（文字渲染） |

> **分组标题（`基础信息`/`A+内容`…）旁边没有图标**，是**纯文字**。
> 只有**动作按钮**才带图标。同一颗 SVG 换三档颜色：`#111827`（主）/ `#4b5563`（次）/ `#6b7280`（弱）。
> 尺寸只有四档：**17.4 / 18.6 / 19.8 / 44.6**，**没有 16px 以下**。

### 2.11 右栏（历史 / 示例，所有页一致）

```css
/* 页签槽 —— 量自 div.inline-flex.items-center.rounded-xl.bg-gray-50.p-1 */
.tabs-wrap {
  display: inline-flex; align-items: center;
  padding: 4.96px;                 /* p-1 */
  border-radius: 14.88px;          /* rounded-xl */
  background: rgb(249,250,251);    /* bg-gray-50 */
  width: 153.8px; height: 49.6px;  /* 实测 */
}
.tabs-wrap button {
  height: 39.7px; padding: 0 19.84px;   /* h-8 px-4 */
  border-radius: 9.92px; font-size: 16.12px; font-weight: 500;
  color: rgb(107,114,128);
}
.tabs-wrap button.is-active {
  background: #FFFFFF; color: rgb(17,24,39); box-shadow: var(--shadow-sm);
}

/* 示例标题 —— 量自 h2.text-[26px].font-semibold.leading-9.text-[#050505] */
.right-title { font-size: 32.24px; font-weight: 600; line-height: 44.64px; color: rgb(5,5,5); }
/* 内容容器 —— mx-auto max-w-[980px] pt-8 */
.right-inner { margin: 0 auto; max-width: 980px; padding-top: 39.68px; }

/* 示例网格 —— 量自 div.mt-7.grid.grid-cols-2.gap-3.lg:grid-cols-4 */
.example-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14.88px;              /* gap-3 */
  margin-top: 34.72px;       /* mt-7 */
  width: 1096.2px;           /* ← 实际渲染宽，容器 max-width:980 被 4 列撑破 */
}
.example-grid figure {
  aspect-ratio: 1/1; border-radius: 14px; overflow: hidden;
  background: rgb(243,244,246);   /* bg-gray-100 兜底 */
}
.example-grid img { width: 100%; height: 100%; object-fit: cover; }
```

实测单列 **262.9px**（2048 窗口下）。
> ⚠️ **与 50 号文档的 292.6 不一致**：那是 2560 窗口量到的。**以本文为准（2048 窗口）**。
> 另外容器写 `max-w-[980px]` 却渲染 1096.2 —— `grid` 的 min-content 撑破了 max-width，不是他们写错。

**示例内容**：套图页 8 条编号清单（`01 白底主图` … `08 收官价值视觉图`）；
A+ 页 6 条（`01 功能总览图` … `06 品牌故事图`）；详情图 4 条；
图片复刻 6 条（三原图 + 三复刻图，**成对**）。
**历史页签**：本地账号无记录 → 空态文案「**暂无历史记录**」（`min-h-[420px]` 居中，`13px` `#6b7280`）。

---

### 2.12 ⚠️ 第二套骨架：`workflow-workspace-layout`（不是上面那套）

**这是本次扩展范围最重要的发现**：他们**至少有两套完全不同的工作台骨架**，
**视频侧与部分图片侧技能走的是另一套**：

| 骨架 | 出现在 | 实测选择器 | 左栏宽 | 底色 |
|---|---|---|---|---|
| **A：image-workspace** | 图片侧 7 个 `?tool=` + `/ai-video` | `.image-workspace-theme` + `main.flex` | 570.4 / 499.7 / 496 | `#f0f2f5` |
| **B：workflow-workspace** | `/product-video` `/video-clone` `?tool=text-change` | `.workflow-workspace-layout`（或 `.app-market-workspace-layout`） | **400px 固定** | `var(--ch-08090d)` |

```css
/* 骨架 B —— 量自 /product-video 与 /video-clone 的
   div.workflow-workspace-layout（两页逐值相同）*/
.workflow-workspace-layout {
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);   /* ← 固定 400，不是 570 */
  gap: 11.9px;                    /* gap-3 → 11.9px（≠ 骨架 A 的 19.84） */
  padding: 11.9px;                /* p-3 */
  height: 100%; min-height: 0;
  background: var(--ch-08090d);   /* light:#f0f2f5 / dark:#08090d */
  color: #FFFFFF;                 /* class 写 text-white */
}
/* 两个子块（实测）*/
.workflow-workspace-controls { display:flex; flex-direction:column; gap:11.9px;
                                overflow-y:auto; padding: 4.96px; }   /* ← 它自己滚 */
.workflow-workspace-results  { display:flex; flex-direction:column; gap:11.9px; padding: 4.96px; }
```

实测盒子（2048 窗口）：整块 **1785.6 × 1000.8**，起点 `(250, 12.4)`；
两子块无背景（透明），底由父层的 `--ch-08090d` 提供。

> **对我们最重要的提示**：视频侧**不是**「左 570 白面板 + 右 1156 白面板」那套，
> 而是「**左 400 控制列 + 右自适应结果区**，整体一块深色底」。
> 我们如果要把图片/视频统一成一套视觉语言，**要么统一到 A，要么统一到 B**，
> 不能一半 A 一半 B（我们当前 `.media-workbench` 是 A 的变体，视频侧却另有实现）。

> **未取到**：`/store-visit-video`、`/video-recreation`、`/brand-ad`、`/content-replace`、`/ai-mix`、`/digital-human` ——
> bundle 里有路由分支，但**本轮未逐页量**（不编其数值）。

---

## 3. B. 逐 skill 差异表（一页一行，每条标注量自哪页）

### 3.1 图片侧 7 个 `?tool=` 值

| tool | 页面标题 | 左栏宽 | 分组（h2 原文，按序） | 字段（h3 原文，按序） | 特殊控件 | 与别的页不同之处 |
|---|---|---|---|---|---|---|
| `product-listing-set` | 商品套图 | **570.4** | 基础信息 / 产品卖点与设计风格 / 套图结构配置 | 上传图片 · 产品卖点 · 设计风格 | select×3 · textarea×1 · 上传×1 · 付费×3 | **基准页**（右栏 8 条编号清单） |
| `aplus-content` | A+内容 | **570.4** | 基础信息 / 产品卖点与设计风格 / **包含模块** | 上传图片 · 核心卖点 · AI推荐风格选择 | select×3 · textarea×1 · 上传×1 · 付费×3 · **16 项可勾选清单** | **唯一有「已选 N/16」勾选清单**；**`label` 是 `display:block`（无 gap）**，与套图的 `flex gap:9.92` 不同 |
| `detail-image` | 详情图 | **570.4** | 基础信息 / 产品卖点与设计风格（**少一块**） | 上传图片 · 核心卖点 · AI推荐风格选择 | select×3 · textarea×1 · 上传×1 · 付费×3 | 比 A+ **少「包含模块」**；右栏 4 条清单 |
| `image-clone` | 图片复刻 | **499.7**（窄 70.7） | **无 h2 分组**（字段平铺） | 上传商品图 · 核心卖点* · 复刻程度 · 统一复刻要求（选填）· 比例 | select×5 · textarea×2 · 上传×2 · 付费×2 | **左栏最窄之一**；**字段最多**；**上传卡是另一种**（`border-[#c6c6c6]` + `bg-[#fbfbfc]`，434.9×237.9，**没撑满**）；比例 16 档 |
| `remove-background` | 去除背景 | **570.4** | 最多上传 5 张图片（**只有 1 块**） | **无 h3** | **select×0 · textarea×0** · 上传×1 | **极简：零下拉零输入**；上传是 **81.9×96.7 的「+」小方格**（不是大虚线卡） |
| `ai-outfit` | AI换装 | **496**（最窄） | 模特选择 / 服装选择 / Pose 参考（可选） / 背景参考（可选） / 比例 / 生成张数 | 上传模特图 · 上传衣服图 · 上传姿势参考图 · 上传背景参考图 | select×3 · **上传×4**（无 textarea） | **左栏最窄**；4 个上传位；上传卡 403.9×218.1、**radius 16**（别的页是 18） |
| `text-change` | 文字替换 | **不适用** | 参数配置（1 块） | 上传原图 | **骨架 B** | **骨架完全不同**（`.app-market-workspace-layout`，400px 栅格）；右栏是「我的作品 / 作品示例 / 教学示例」三区 |

> **量自哪页**：上表每一行的宽度与字段名，均**在 `https://laoyu.quantv.com/image-creation?tool=<该行 tool>` 实测**（2048×1026，light 主题）。

### 3.2 视频侧（无 `tool=`，走路径）

| 路径 | 实测选择器 | 骨架 | 左栏宽 | 关键差异 |
|---|---|---|---|---|
| `/ai-video` | `.image-workspace-theme.ai-video-workspace` | **A（同图片侧）** | **570.4**（`lg:max-w-[460px]` 同样被撑到 570.4） | 左栏 class 多一个 `video-workspace-controls-column`；底部有 `h-[50px]` 的 `ai-video-surface` 参数条；CTA 条 **530 宽**、`pt-3` |
| `/product-video` | `.workflow-workspace-layout` | **B** | **400 固定** | 栅格 `400px minmax(0,1fr)`、`gap/p 11.9`、底 `var(--ch-08090d)`；有 `textarea×3`；CTA 是 `h-10 min-w-[120px] rounded-full`（**胶囊**） |
| `/video-clone` | `.workflow-workspace-layout` | **B** | **400 固定** | 同上；`textarea×1` + `input×1` |

> **量自哪页**：三行分别在 `https://laoyu.quantv.com/ai-video`、`/product-video`、`/video-clone` 实测。
> **视频侧的付费/CTA 形态与图片侧不同**：`rounded-full` 胶囊 CTA（图片侧是 `rounded-lg` 9.92）。

### 3.3 「明显不一样」的技能（重点看这几个）

按与基准页（`product-listing-set`）的差异从大到小：

1. **`text-change`** —— **换骨架**（B 套：400px 栅格 + 深底 + 三区右栏）。**最不一样。**
2. **`remove-background`** —— **零控件**（无 select / 无 textarea），上传是 **81.9×96.7 的 + 方格**而非大虚线卡。
3. **`ai-outfit`** —— **左栏最窄 496**；4 个上传位；`radius 16`（别人 18）；分组最多（6 块）。
4. **`image-clone`** —— **左栏 499.7**；**无 h2 分组**（字段平铺，与所有别的页相反）；上传卡**没撑满**（434.9，底色 `#fbfbfc`、描边 `#c6c6c6`）；字段最多。
5. **`aplus-content`** —— 宽度与骨架都同基准，**唯一差异是那 16 项勾选清单 + `label` 的 display**。
6. **`/product-video` · `/video-clone`** —— **换骨架**（B 套）+ CTA 改胶囊。

> **对我们的意义**：我们**不需要**为每个 skill 各写一套版式 ——
> 他们的**共用率其实很高**（骨架 A 覆盖 7 个图片 tool + `/ai-video`）。
> 真正的差异只有三类：**(a) 左栏宽度按字段多少浮动**（496–570）、
> **(b) 特殊控件**（勾选清单 / + 方格 / 16 档比例）、**(c) 少数走 B 套骨架**。

---

## 4. 我们该怎么做（用我们自己的视觉语言）

### 4.1 可以直接搬的（骨架与几何）

| 项 | 他们的值 | 搬到我们这边 |
|---|---|---|
| 两栏结构 | 左固定 + 右 `flex:1 1 0%`，`stretch` 等高 | ✅ 搬（我们已是 `minmax(320px,570px) minmax(0,1fr)`，**对了**） |
| 缝 | `gap: 19.84px` | ✅ 取整 **`gap: 20px`**（我们 28px，偏大） |
| 外圈留白 | `padding: 19.84px` | ✅ 取整 **`padding: 20px`** |
| 左栏 padding | `24.8px 19.84px` | ✅ **`24px 20px`**（我们已对） |
| 右栏面板 padding | `24.8px 29.76px` | ✅ **`24px 28px`**（我们已对） |
| 面板圆角 | 14.88px | ✅ **`16px`**（= `--sb-radius-xl`） |
| select 高 / 圆角 | 49.6 / 9.92 | ✅ **48 / 10** |
| textarea 圆角 | 14 | ✅ **14**（比 select 更圆，保留这个差） |
| 标签↔控件间距 | 9.92 | ✅ **10**（= `--sb-space-2-5`，**我们已有**） |
| 分组间距 | 39.68 | ✅ **40**（= `--sb-space-10`）← **我们现在 22px，必须改** |
| 主 CTA | 510.1×54.5，圆角 9.92 | ✅ **撑满 + 54 高 + 圆角 10**（我们 12、且`flex:1`旁边有残留） |
| 上传卡 | **撑满**、虚线 2.4px、圆角 18 | ✅ **去掉 `max-width:390`**；虚线 **2px**；圆角 **16** |
| 页脚条 | 不在滚动器内、天然钉底 | ✅ **改布局**（见 4.3 ②） |
| 图标 | `viewBox 0 0 512 512` 线性 2px | ✅ 尺寸档 **18 / 20 / 45**，色用 `currentColor` |

### 4.2 必须换成我们 token 的（颜色）

**他们的「冷」整套换成我们的「暖」，一个色值都不抄。**

```css
/* 他们的（冷灰系）        →  我们的（暖米系） */
/* rgb(240,242,245) 工作区底 →  var(--sb-surface-page)      #F5EFE4 */
/* #FFFFFF 面板             →  var(--sb-surface-card)      #FFFFFF */
/* rgb(249,250,251) 凹槽    →  var(--sb-surface-sunken)    #EFEAE1 */
/* rgb(17,24,39) 主文字     →  var(--sb-ink-1)             #1A1614 */
/* rgb(107,114,128) 次文字  →  var(--sb-ink-3)             #6B6560 */
/* rgb(229,231,235) 描边    →  var(--sb-border-default)    #E7E3DD */
/* rgb(143,143,143) 禁用CTA →  var(--sb-brand-600) + :disabled{opacity:.5} */
```

```css
/* 分组标题（他们灰 16.12/500）—— 保留「比字段标签更灰」这个层级 */
.media-workbench-group-title { font-size: var(--sb-text-lg); font-weight: 500; color: var(--sb-ink-3); }
/* 字段标签（他们近黑 17.36/500）—— 用字重补回对比 */
.media-field-label-title     { font-size: var(--sb-text-lg); font-weight: 600; color: var(--sb-ink-1); }
```

**不引入**：① 1.24 倍 rem 基准（他们按屏宽算字号，我们固定栅格）；
② `bg-white/95 + backdrop-blur` 半透明条（我们用 `--sb-surface-panel` 或干脆不透明）；
③ placeholder 与正文同色（我们保持 `--sb-ink-4`）；
④ **底部蓝色背景（不存在，不要添）**。

### 4.3 最该改的三处（已定位到行）

**① 上传框去掉 `max-width:390px`（`WorkbenchShell.css:386`）**
```diff
  .media-field-upload-add {
    width: 100%;
-   max-width: 390px;
    min-height: 119px;
-   border: 1px dashed var(--sb-border-strong);
+   border: 2px dashed var(--sb-border-strong);
+   border-radius: 16px;
  }
```
→ 解决用户「上传区右边为什么会有留白」。他们三页实测都是 **98.3% 撑满、左侧 0 留白**。

**② 左栏改成「内容区滚 + CTA 条在滚动器外」（对齐他们的真实做法）**
我们现在是`整栏 sticky + 整栏自己滚`，导致**CTA 会跟着滚**；
他们是「栏不滚，**栏内内容区**滚，CTA 条是 flex 兄弟」→ CTA 天然钉底、不需要 sticky。
```diff
  .media-workbench-left { display: flex; flex-direction: column; overflow: hidden; }
  .media-workbench-left .fields-scroll { flex: 1 1 0%; min-height: 0; overflow-y: auto; }
- /* 删掉整栏的 position: sticky / max-height: calc(100dvh - 32px) */
  .media-workbench-cta { flex: 0 0 auto; /* 不在滚动器内 */ }
```
→ 同时解决「按钮太宽、右边一大片空白」（CTA 撑满条的内容盒 = 零残留）。

**③ 分组间距 22px → 40px（`WorkbenchShell.css:67`）**
```diff
- .media-workbench-group + .media-workbench-group { padding-top: 22px; ... }
+ .media-workbench-group + .media-workbench-group { padding-top: 40px; ... }   /* 他们 39.68 */
```
→ 解决「多少间距…你都没有做好」。他们的组间呼吸是我们的 **1.8 倍**。

### 4.4 由「多 skill 」带来的新增建议

- **左栏宽度别写死**：他们按字段多少浮动（**496 / 499.7 / 570.4**）。
  我们现在固定 `minmax(320px,570px)` —— 字段少的 skill（如去除背景）会显得空。
  建议：**同一档 570**（保持整齐），但允许**内容少的页降到 ~500**，用同一个 `--sb-*` 档位表达。
- **特殊控件要有统一形态**：他们自己就不统一（16 项清单 / + 方格 / 16 档比例三种长得都不一样）。
  我们**只做一套**「选择卡 / 直角方块」语言，三种都用它渲染。
- **视频侧对齐**：我们视频页若要与图片页统一，**选一套骨架贯彻**，别一半 A（570+白面板）一半 B（400+深底）。

### 4.5 落地时一起守的（不要顺手回退）

- **不要动报价/计费**：本文全是视觉几何，**没有一条改价钱**。
- **「包含模块」保持只读**：他们 16 条可勾选会改价钱；我们按 47/50 号文档口径做只读清单。
- **主 CTA 价格写在按钮里**：他们 `生成预览 消耗 0.10 积分` 是一颗按钮两段文字，**我们已是这个口径**。

---

## 5. 未取到 / 存疑（如实标注）

| 项 | 状态 | 卡在哪 |
|---|---|---|
| **底部蓝色背景图** | ❌ **未取到（判定为不存在）** | 5 个页面 × 双主题扫描 0 命中；且找到源码级反证（`--ch-1f6bff` 被 remap 成 `#fafafa`/`#2f3136`）。见 §2.3 |
| `/store-visit-video` 等 6 条视频路径 | ⚠️ 未逐页量 | bundle 里有路由分支，本轮只实测了 `/ai-video`、`/product-video`、`/video-clone` 三条 |
| ~85 张模板卡（小红书爆款复刻等） | ⚠️ 未逐页量 | 它们是**模板不是工具页**；实测 `/apps?id=text-change` 返回「应用不存在」，说明不可靠 |
| 主 CTA **可点态**渐变色 | ⚠️ 未取到 | 未上传图片时按钮是禁用灰 `rgb(143,143,143)`；可点态需上传图片才出现，**按零成本约束没有触发** |
| 生成后的结果区 | ❌ 未取到 | **没有跑任何生成任务**（费用与合规红线） |
| 历史页签真实行规格 | ⚠️ 空态 | 账号无历史记录，只见「暂无历史记录」 |
| 1280×800 窄窗口断点形态 | ⚠️ 未取到 | CDP 代理无 viewport 端点（只有 `/health /targets /new /close /navigate /back /info /eval /click /scroll /screenshot`）；`documentElement.style.zoom` 只缩放不重排。`lg:` 断点（1024px）以下的形态**未量**。 |
| `h-[160px]` 上传卡实测 198.4 高 | ⚠️ 已解释 | `min-height` 被内容顶穿，非量错 |
| `max-w-[460px]` 渲染 570.4 | ⚠️ 已解释 | `lg:` 断点类覆盖；渲染值稳定复现（多页多轮一致） |
