# 52 · flova.tv 左侧导航 + Skill 按钮区 + 悬停预览窗 深度拆解规格

> 竞品：https://flova.tv/zh-CN/
> 取证日期：2026-02（本次会话）
> 视口：**2048 × 970**，DPR **1.25**（Chrome，CDP 代理）
> 全页文档尺寸：2048 × 970（首页为 `h-screen` 单屏布局，无纵向滚动）

---

## 0. 取证方式

### 0.1 CDP 语义（读源码确认）

代理 `http://localhost:3456`，**targetId 走 query，POST body 才是内容**：

| 端点 | 方法 | 语义 |
|---|---|---|
| `/new` | POST，body=`about:blank` | 建新标签，返回 `{"targetId":"..."}` |
| `/navigate?target=<id>` | POST，body=URL | 导航 |
| `/eval?target=<id>` | POST，body=JS | 执行 JS，返回 `{"value":"..."}` |
| `/screenshot?target=<id>` | POST，body 空 | 返回 **PNG 二进制** |
| `/close?target=<id>` | POST | 关闭标签 |
| `/targets` | GET | 列出全部 target |
| `/health` | GET | 健康检查，含 `managedTabs` |

### 0.2 执行脚本

`.tmp/grab.mjs`（开 → 导航 → eval → 截图 → **finally 关**）。每轮改写 eval 探针文件：

- `.tmp/p50-probe.js` — 页面骨架
- `.tmp/p51-nav.js` — 导航栏 + skill 按钮区
- `.tmp/p52-hover.js` — 悬停浮窗 + 离场时序
- `.tmp/p53-panel.js` — 浮窗内部结构 + 全部 32 个按钮
- `.tmp/p54-shell.js` — aside / logo / 公告条 / 分类切换
- `.tmp/p55-hold.js` — 保持悬停后截图
- `.tmp/p56-overlay.js` — 卡片内 "试一试" 覆盖层 + 浮窗块级结构
- `.tmp/p57-leaves.js` — 浮窗全部文本叶子节点

### 0.3 标签页账目

| 序号 | targetId | 用途 | 关闭 |
|---|---|---|---|
| 1 | `C833351ED2A23D5EF87F9ACE6EA2A455` | p50 骨架 | 已关 |
| 2 | `E50D09B4DBC2FD0DF9EAA133FFE8A092` | p51 导航 | 已关 |
| 3 | `020FF325253E5770089CB61F46B1F539` | p52 悬停时序 | 已关 |
| 4 | `586BA5EF3982D5B79AD645D446A54FC7` | p53 浮窗内部 | 已关 |
| 5 | `04F534B144A0F8B217CE7146CDCF142B` | p54 shell | 已关 |
| 6 | `A3FFB676B38F8380B68B564D6987FD72` | p55 首次（错卡，重做） | 已关 |
| 7 | `518D64B46BE8FAEFC973B284517950FF` | p55 重做（悬停态截图） | 已关 |
| 8 | `132FCC037D641C9721DAB34606ED0E95` | p56 覆盖层 | 已关 |
| 9 | `CDBFF281200C5F8E920A23D05144C2B3` | p57 叶子节点 | 已关 |

**共开 9 个标签页，全部 close，全程一次只开一个。**

收尾复核：
```
GET /targets  -> 无任何 flova.tv target
GET /health   -> {"status":"ok","connected":true,"sessions":1,"managedTabs":0,"chromePort":9222}
```

（中途 `/health` 曾报 `managedTabs:1`，经 `/targets` 核验为使用者本人的 `my.65535.space` 标签，非探针泄漏。）

### 0.4 未抓到的项

| 项 | 原因 |
|---|---|
| 侧栏**折叠按钮** | 不存在。aside 固定 `w-[var(--sidebar-width)]` = **90px**，无 toggle 控件 |
| 「更多 Skill」点开后 | 它是 `<a href="/zh-CN/skill/?tab=featured">` 跳独立页，非本页内展开 |
| MV 分类下的卡片 | 该分类卡在 2048px 下横向溢出到 `x>2048`，`getBoundingClientRect` 返回 0x0；仅取到 7 张可见卡 |
| 浮窗内**案例缩略图数组** | 不存在。不是"几个案例小图"，而是**一整张 338x253 封面图 + 叠层文字**（详见 §3） |
| 图标 SVG 的 hover 变色值 | `:hover` 伪类无法从 `getComputedStyle` 直读，仅取到 class 声明 |

---

## 1. 左侧导航栏（aside）

### 1.1 像素表

| 元素 | x | y | w | h | 备注 |
|---|---|---|---|---|---|
| `aside` | 0 | **118** | **90** | 851.6 | `h-full`，y=118 是顶部 header 下沿 |
| └ `nav` | 0 | 118 | 90 | 679.6 | `min-h-0 flex-1`，撑满剩余 |
| └└ `ul` | 0 | **118** | 90 | 496.8 | `pt-[6px]`，8 项总高 |
| └ bottom 区 | 0 | 797.6 | 90 | 156 | 礼物按钮容器 |
| └ 尾部占位 | 0 | 953.6 | 90 | 16 | `h-[16px]` 空白块 |

**导航项逐个**（`<li>` 间距 **15px**，`ul` 垂直居中 `items-center`）：

| # | 文字原文 | href | li x | li y | li w | li h | 图标盒 | 图标 viewBox | 图标内缩 | 文字 w | 文字 y | 文字色 | 图标 opacity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **首页** | `/zh-CN/` | 30 | 124 | 30 | 47 | 30x30 @ (30,124) | `0 0 30 30` | 0 | 20 | 156 | `rgb(255,255,255)` | **1.0** |
| 2 | **项目** | `/zh-CN/projects/` | 30 | 186 | 30 | 47 | 30x30 @ (30,186) | `0 0 30 30` | 0 | 20 | 218 | `rgba(255,255,255,0.5)` | 0.5 |
| 3 | **快速生成** | `/zh-CN/generator/` | 25 | 248 | 40 | 47 | 30x30 @ (30,248) | `0 0 30 30` | 0 | 40 | 280 | `rgba(255,255,255,0.5)` | 0.5 |
| 4 | **资产库** | `/zh-CN/library/` | 30 | 310 | 30 | 47 | 24x24 @ (33,313) | `0 0 24 24` | 3 | 30 | 342 | `rgba(255,255,255,0.5)` | 0.5 |
| 5 | **Skill** | `/zh-CN/skill/` | 30 | 372 | 30 | 47 | 24x24 @ (33,375) | `0 0 18 18` | 3 | 20.9 | 404 | `rgba(255,255,255,0.5)` | 0.5 |
| 6 | **FlovaTV** | `/zh-CN/#explore` | 24.9 | 434 | 40.2 | 47 | 30x30 @ (30,434) | `0 0 30 30` | 0 | 40.2 | 466 | `rgba(255,255,255,0.5)` | 0.5 |
| 7 | **教程** | `/zh-CN/docs/?flovatv=1` | 30 | 511.8 | 30 | 47 | 30x30 @ (30,511.8) | `0 0 30 30` | 0 | 20 | 543.8 | `rgba(255,255,255,0.5)` | 0.5 |
| 8 | **Flova CLI** | `/zh-CN/agent-cli/` | 22.5 | 573.8 | 45 | 41 | 24x24 @ (33,573.8) | `0 0 24 24` | 3 | 45 | 599.8 | `rgba(255,255,255,0.5)` | 0.5 |

> 项 1→2 y 差 = 186−124 = **62** = 47 (h) + **15** (gap)。

### 1.2 排列方向 — **图标在上、文字在下**

```html
<li>
  <a class="... flex-col items-center space-y-[2px] p-0">   <!-- 纵向，居中 -->
    <div class="flex items-center justify-center text-fg size-[30px] [opacity-50]">
      <div class="flex h-full w-full items-center justify-center">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">...</svg>
      </div>
    </div>
    <span class="font-semibold text-[10px] text-fg[-secondary]">首页</span>
  </a>
</li>
```

**图标与文字间距 = 2px**（`space-y-[2px]` → 计算值 `span.margin-top: 2px`）。
图标盒 30x30，文字行高 15px → 30 + 2 + 15 = **47px**，与实测 li.h=47 吻合。

### 1.3 关键 CSS 原文

**aside 容器**
```html
<aside class="flex h-full min-h-0 flex-col w-[var(--sidebar-width)]">
  <nav class="min-h-0 flex-1">
    <ul class="flex flex-col items-center space-y-[15px] pt-[6px]">
```
计算样式（`aside`）：
```
display: flex; flex-direction: column;
width: 90px; height: 851.6px;
background-color: rgba(0,0,0,0);      /* 透明，透出页面背景图 */
border: 0px solid rgb(38,38,38);      /* 无边框 */
border-radius: 0px;                   /* 无圆角 */
box-shadow: none;
position: static;
```
**无独立背景色 / 无渐变 / 无边框 / 无圆角** —— 侧栏完全透明，靠父级 `bg-black` + 背景图衬托。

**导航项 a**
```
display: flex; flex-direction: column; align-items: center;
width: 30px; height: 47px;
transition: background-color .2s cubic-bezier(.4,0,.2,1),
            color .2s cubic-bezier(.4,0,.2,1),
            opacity .2s cubic-bezier(.4,0,.2,1);
```

**文字 span**
```
font-size: 10px; font-weight: 600; line-height: 15px;
margin-top: 2px;
color: rgb(255,255,255)               /* 选中项 #1 */
      / rgba(255,255,255,0.5)         /* 其余 7 项 */
```
class：`font-semibold text-[10px] text-fg` → token `--fg` = 白；`text-fg-secondary` = 白 50%。

**图标盒**
```
display: flex; align-items: center; justify-content: center;
width: 30px; height: 30px; color: rgb(255,255,255);
opacity: 1                               /* 当前页 */
opacity: 0.5                             /* 非当前页 —— class 追加 opacity-50 */
```

### 1.4 选中态 / 悬停态

**选中态（当前页 = 首页）**
- 图标 `opacity: 1.0`，**无** `opacity-50` class
- 文字色由 `text-fg-secondary` → `text-fg`，即 `rgba(255,255,255,0.5)` → `rgb(255,255,255)`
- **没有**背景块、**没有**描边、**没有**左侧指示条、**没有**圆角胶囊
- 判定方式：当页 `<a>` 不带 `opacity-50`，其 `<span>` 用 `text-fg` 而非 `text-fg-secondary`

> 即：选中态 = **图标不透明 + 文字全白**，仅此两处。极简反选。

**悬停态**
- class 串中无 `hover:` 前缀，唯一过渡声明是 `transition-[background-color,color,opacity]`
- 由 transition 目标反推：悬停/选中变化集合 = **背景色 / 文字色 / 不透明度** 三者
- 无位移、无缩放、无描边变化

**焦点态**
```
focus-visible:outline-none
focus-visible:ring-2 focus-visible:ring-fg-muted
```

### 1.5 有没有折叠按钮？有没有 logo？最下面是什么？

| 问题 | 答案 |
|---|---|
| 折叠按钮 | **没有**。aside 宽固定 90px，DOM 内无 toggle/chevron 控件 |
| logo | **不在侧栏内**。logo 在顶部 header：`<img alt="Flova Logo" width=136 height=26 class="header-logo w-[92px] md:w-[119px]">`，实测 **119x22.8 @ (23, 71.6)**，src=`/_next/static/media/flova-logo.20qqje9j-ht44.svg` |
| 最下面 | 礼物按钮 **邀请赢积分**，位于 `div.flex.flex-shrink-0.items-center.flex-col.justify-center.space-y-[6px]`（0,797.6,90,156） |
| 侧栏最尾 | `<div class="h-[16px]"></div>` 纯占位（0,953.6,90,16） |

**礼物按钮原文**
```html
<button data-auth="1" data-ref-code-modal-feedback="sidebar" aria-label="邀请赢积分"
        class="flex items-center justify-center rounded-full"
        style="width:28px;height:28px;background:linear-gradient(90deg,rgb(210,255,179) -3.91%,rgb(255,255,255) 101.56%)">
  <span class="inline-flex leading-none" style="font-size:15px;">🎁</span>
</button>
```
盒 **28x28 @ (31, 797.6)**，`border-radius: 9999px`，渐变底 `90deg, #D2FFB3 -3.91% -> #FFFFFF 101.56%`。

### 1.6 截图

- `.tmp/grab52/02-nav-skillbar.png` — 侧栏 + skill 按钮区全貌
- `.tmp/grab52/01-home-full.png` — 整页

---

## 2. Skill 按钮区

### 2.1 分类标签行（tablist）

**原文顺序**：`精选Skills：` | 热门玩法 | 剧情短片 | 商业广告 | 音乐/MV | `更多 Skill >`

| 元素 | 文字 | x | y | w | h | 字号 | 字重 | 颜色 |
|---|---|---|---|---|---|---|---|---|
| `div[role=tablist]` | — | 865.7 | 400.6 | **350** | **44** | — | — | — |
| tab 1 | **热门玩法** | 865.7 | 400.6 | 56 | 44 | 14px | 600 | `rgb(155,201,87)` |
| tab 2 | **剧情短片** | 921.7 | 400.6 | 97 | 44 | 14px | 600 | `rgba(255,255,255,0.3)` |
| tab 3 | **商业广告** (选中) | 1018.7 | 400.6 | 97 | 44 | 14px | 600 | class `text-[#9BC957]` |
| tab 4 | **音乐/MV** | 1115.7 | 400.6 | 100 | 44 | 14px | 600 | `rgba(255,255,255,0.3)` |
| 「更多 Skill」 | **更多 Skill** | 1256.7 | 400.6 | 83.4 | 44 | 14px | 600 | `rgb(155,201,87)` |

- tablist：`<div aria-label="精选Skills：" class="flex" role="tablist">`
- **「精选Skills：」不是独立标签**，而是 tablist 的 `aria-label`
- **分隔符**：每个 tab 用伪元素做竖线 — `before:mx-[20px] before:h-[16px] before:w-px before:bg-white/10`，且 `first:before:hidden`
- **选中判定**：`aria-selected="true"`；选中 tab 的 class 由 `text-fg-tertiary hover:text-fg-secondary` 换成 `text-[#9BC957]`
- 主题色 **#9BC957**（品牌绿），副色悬停 `#b8df7e`
- 过渡：`transition: color .15s cubic-bezier(.4,0,.2,1), background-color ...`
- 每个 tab 有稳定 id：`home-skill-category-tab-cat_trending` / `_cat_drama` / `_cat_commerce` / `_cat_mv`，均指向 `aria-controls="home-skill-category-panel"`

**「更多 Skill」原文**
```html
<a aria-label="更多 Skill"
   class="flex h-[44px] shrink-0 items-center gap-[6px] text-[12px] leading-none font-[600] text-[#9BC957]
          transition-colors hover:text-[#b8df7e] md:gap-[8px] md:text-[14px]"
   href="/zh-CN/skill/?tab=featured">
  <span>更多 Skill</span>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>
</a>
```
gap 8px，**是链接跳走，不是就地展开**。

### 2.2 按钮行容器

```html
<div class="banner-mod-wrapper w-full snap-x snap-proximity overflow-x-auto overscroll-x-contain
            pt-[11px] scrollbar-hide md:snap-none md:pt-[16px]
            [&_.banner-mod-item-wrapper]:snap-start">
```
盒：**x=90, y=444.6, w=1938, h=148**；`padding: 16px 0 0`；`overflow-x: auto`（`scrollW == clientW == 1938`）。

**换行方式：不是 grid、不是 flex-wrap，而是横向滚动条**（`overflow-x-auto` + `snap-x`）。2048px 下排成 2 行：
- 第 1 行 y = **460.6**（6 张）
- 第 2 行 y = **525.4**
- 行距 = 525.4 − 460.6 = **64.8** = 54 (h) + 10.8 (间距)

### 2.3 单个 skill 按钮

**尺寸**：`md:h-[60px] md:rounded-[14px]` → 计算高 **60px**、圆角 **14px**。
**实测外框** h = **54px** — 差异来自 `border-image-width: 14px` 的九宫格边框切片（`banner-mod-fixed-surface`）。

| 属性 | 值 |
|---|---|
| display | `flex; flex-direction: row; align-items: center; justify-content: center` |
| height | 60px (`md`)，44px (mobile) |
| border-radius | **14px** (`md`)，9px (mobile) |
| padding | **8px 0** (`md:px-0 md:py-[8px]`) |
| border | `0.8px solid rgba(255,255,255,0.1)` |
| background | `rgba(255,255,255,0.04)` |
| backdrop-filter | `blur(12px)` |
| 宽度 | 内容撑开 (`w-fit`)，实测 **169.7 ~ 241.7px** |

**内部结构（常态）**
```html
<button aria-label="新品视觉TVC广告宣传" data-auth="1" data-state="closed"
        class="appearance-none cursor-pointer h-[44px] w-fit justify-center rounded-[9px] px-[8px] py-[6px]
               md:h-[60px] md:rounded-[14px] md:px-0 md:py-[8px]
               relative box-border flex shrink-0 items-center overflow-visible
               banner-mod-fixed-surface border border-transparent
               border border-white/10 bg-white/[0.04] backdrop-blur-[12px]
               group-hover:border-white/15 group-hover:bg-transparent group-hover:backdrop-blur-none">
  <div class="banner-mod-item-hot absolute top-0 end-0 translate-y-[-50%] rounded-full rounded-ee-none
              px-[14px] py-[6px]">
    <div class="banner-mod-item-hot-text leading-none font-[900] text-[9px] md:text-[10px]">热门</div>
  </div>
  <div class="md:group-hover:invisible flex min-w-0 items-center
              gap-[7px] pe-[24px] md:gap-[10px] md:ps-[11px] md:pe-[38px]">
    <div class="banner-mod-image-wrapper h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[6px]
                md:h-[44px] md:w-[44px]">
      <img width="44" height="44" loading="lazy" class="object-cover select-none w-full h-full" ...>
    </div>
    <div class="banner-mod-content-wrapper relative min-w-0 max-w-[108px] md:max-w-[164px]">
      <div class="banner-mod-title truncate text-[11px] md:text-[14px] text-start leading-none
                  font-[700] text-white">新品视觉TVC广告宣传</div>
    </div>
  </div>
  <div class="banner-mod-hover-content ...">...试一试...</div>
</button>
```

**内容要素（图标 + 文字，都有）**
| 元素 | 尺寸 | 位置 | 样式 |
|---|---|---|---|
| 图标 (`<img>` 缩略图) | **39.6 x 39.6** (`md:44px` 减内描边) | 距按钮左边 **11px** | `object-cover`，`border-radius: 6px`，wrapper 44x44 |
| 标题文字 | 宽 84~164px，高 12.6~14px | 图标右 **10px** 起 | **14px / 700 / line-height 14px / #fff**；`truncate` |
| 右侧留白 | — | `padding-right: 38px` | 为角标/箭头预留 |

即 **左图标（44x44 圆角 6）+ 右单行标题（14px/700）**，横向排布，`gap: 10px`。

**「热门」角标**（部分卡有）
```
position: absolute; top: 0; right: 0;
transform: translateY(-50%);         /* 骑在按钮上边缘 */
border-radius: 9999px; border-end-end-radius: 0;   /* rounded-ee-none */
padding: 6px 14px;
```
实测盒 **43.2 x 19.8 @ (1550.5, 451.4)**（按钮 y=460.6 → 角标中心压在顶边）。内文 **10px / 字重 900**。悬停时 `group-hover:opacity-0`（**淡出消失**）。

### 2.4 分类切换后按钮区怎么变

点击 4 个 tab，`aria-selected` 迁移，tablist **位置固定不动**（始终 x=865.7…1215.7），下方面板（`aria-controls="home-skill-category-panel"`）整体替换：

| 点击的 tab | 面板内 skill 按钮原文 |
|---|---|
| **剧情短片** | 根据剧本制作多集短剧 · 剧本生视频（需上传剧本）· 故事驱动型视频 · 多宫格生视频 · 3D国漫古装精品短剧 · 玄幻漫剧武打片段 · 古风甜宠短剧 · AI 短剧一站式生成 · 剧本杀故事视频 |
| **商业广告** | 商品宣传短片 · 新品视觉TVC广告宣传 · 电商产品视觉全案生成 · 品牌 Logo 创意应用 · 开箱测评种草广告视频 · 时装展示短片 · 字体动效广告 |
| **更多 Skill** | 跳转 `/zh-CN/skill/?tab=featured`（新页面） |

**切到「剧情短片」会换成完全不同的 9 个 skill**，不是同一批筛选。

### 2.5 商业广告分类下 7 张卡的实测盒

| skill 原文 | x | y | w | h | 有「热门」角标 |
|---|---|---|---|---|---|
| **商品宣传短片** | 517.2 | 460.6 | 170.6 | 54 | 有 |
| **新品视觉TVC广告宣传** | 698.6 | 460.6 | 220.4 | 54 | — |
| **电商产品视觉全案生成** | 929.8 | 460.6 | 220.1 | 54 | — |
| **品牌 Logo 创意应用** | 1160.8 | 460.6 | 209.1 | 54 | — |
| **开箱测评种草广告视频** | 1380.7 | 460.6 | 220.1 | 54 | — |
| **时装展示短片** | 883.8 | 525.4 | 169.7 | 54 | — |
| **字体动效广告** | 1064.4 | 525.4 | 169.7 | 54 | — |

同排水平间距恒为 **10.9px**（698.6 − 687.8 = 10.8；929.8 − 919 = 10.8）。行 2 因居中而左边界不同（883.8 vs 517.2），说明是 **`justify-content: center` 的两行居中流**。

### 2.6 截图

- `.tmp/grab52/03-skill-cards.png` — 按钮区
- `.tmp/grab52/01-home-full.png` — 分类行 + 按钮

---

## 3. 悬停预览窗（重点）

### 3.1 移到按钮上发生两件事

**事件 A：按钮本体变化**
```
group-hover:border-white/15      -> border-color: rgba(255,255,255,0.1) -> 0.15
group-hover:bg-transparent       -> background-color: rgba(255,255,255,0.04) -> rgba(0,0,0,0)
group-hover:backdrop-blur-none   -> backdrop-filter: blur(12px) -> none
md:group-hover:invisible         -> 常态内容（图标+标题）visibility: hidden
```
**实测**：悬停前后 `getBoundingClientRect` **完全一致**（x=698.6, y=460.6, w=220.4, h=54）。
→ **无位移、无缩放、无尺寸变化**。仅边框/底色/模糊/常态内容可见性变化。

**事件 B：切换为 "试一试" 覆盖层**（`.banner-mod-hover-content`）

原本"占位存在但不可见"，悬停后显示：
```
invisible -> group-hover:visible
opacity: 0 -> group-hover:opacity-100
transition: opacity .2s cubic-bezier(.4,0,.2,1)
```

覆盖层盒：**220.8 x 54.4**（`absolute -inset-px`，比按钮大 1px/边），即**正好盖住整个按钮**。
```
display: flex; flex-direction: column;
align-items: center; justify-content: center;
gap: 6px; padding: 2px 0;
border-radius: 14px; border: 0.8px solid rgba(255,255,255,0.05);
background-color: rgba(255,255,255,0.05);
backdrop-filter: blur(12px);
```

**「试一试」按钮**（`.hover-btn`）
```html
<div class="hover-btn rounded-full border border-white/10 bg-white/10
            px-[16px] py-[6px] text-[12px] font-[600] leading-none text-white">试一试</div>
```
| 属性 | 值 |
|---|---|
| 实测盒 | **62.6 x 23** @ (777.5, 468) |
| 计算盒 | 69.6 x 25.6（含 0.8px 边框） |
| padding | **6px 16px** |
| border-radius | `9999px`（胶囊） |
| background | `rgba(255,255,255,0.1)` |
| border | `0.8px solid rgba(255,255,255,0.1)` |
| font | **12px / 600 / line-height 12px / #fff** |
| 定位 | **非绝对定位**，由 flex 居中 —— 水平居中于按钮，垂直距顶 **7.4px** |

**说明文字**（`.hover-desc`）
```html
<div class="hover-desc relative text-[12px] font-[400] px-[24px] text-start text-fg
            leading-none line-clamp-1">
  高奢时尚｜运动｜汽车｜3C 大牌调性情绪 TVC 全球广告宣传片 Skill，使用模型：GPT Image 2 + Seedance 2.5（分辨率 480p）
  <img alt="arrow" class="absolute end-[12px] top-[50%] translate-y-[-50%] w-[10px] h-[10px]"
       src="/_next/static/media/icon-arrow.1o9t-eh3zpd1.svg">
</div>
```
| 属性 | 值 |
|---|---|
| 实测盒 | **219.4 x 10.8** @ (699.2, 496.4) |
| padding | `0 24px` |
| font | 12px / 400 / line-height 12px / `#fff` |
| 截断 | `line-clamp-1`（单行省略） |
| 箭头 | 右下角 **10x10** svg，`right: 12px`，垂直居中 |

→ 覆盖层纵向：`试一试`(23) + gap 6 + 说明(10.8) ≈ 39.8，居中于 54.4 高 → 顶部余 7.3px。

### 3.2 预览浮窗（Radix HoverCard）

**这是重点：浮窗不是"左介绍 + 右案例"的双栏。**

它是 **一张 340x255 的整图卡片，文字叠在图上**。

**DOM 根**（Radix Popper 包裹层）
```html
<div data-radix-popper-content-wrapper=""
     style="position: fixed; left: 0; top: 0;
            transform: translate(639.2px, 524.8px);
            min-width: max-content;
            --radix-popper-transform-origin: 50% 0px;
            z-index: 1000;
            --radix-popper-available-width: 2048px;
            --radix-popper-available-height: 444.9999694824219px;
            --radix-popper-anchor-width: 220.13999938964844px;
            --radix-popper-anchor-height: 54px;">
  <div data-side="bottom" data-align="center" data-state="open"
       class="relative z-[var(--z-tooltip)] h-[255px] w-[340px] overflow-hidden rounded-[18px]
              border border-white/10 bg-[#1d2220] drop-shadow-[0_4px_7.8px_rgba(0,0,0,0.45)]">
```

### 3.3 浮窗定位

| 项 | 值 |
|---|---|
| position | **`fixed`**（Radix Popper 输出 `transform: translate(x,y)`） |
| 锚点 | 触发按钮：锚宽 **220.14**，锚高 **54** |
| data-side | **`bottom`** |
| data-align | **`center`** |
| transform-origin | **`50% 0px`**（顶部中心展开） |
| z-index | **1000** |
| 可用空间 | `available-width: 2048`，`available-height: 445` |
| min-width | `max-content` |

**实测位置推导**（按钮 x=698.6, w=220.4 → 中心 = 808.8）：
```
浮窗 x = 639.2
浮窗 w = 340   ->  中心 = 639.2 + 170 = 809.2   ~=  808.8  [OK] 水平居中于按钮
浮窗 y = 524.8
按钮 bottom = 514.6                            ->  间隙 = 524.8 - 514.6 = 10.2px
```
→ **浮窗在按钮正下方，水平居中，垂直间隙 ≈ 10px。**

### 3.4 浮窗尺寸与外框

| 属性 | 值 |
|---|---|
| width | **340px**（固定） |
| height | **255px**（固定） |
| border-radius | **18px** |
| background-color | **`rgb(29, 34, 32)`** = `#1d2220` |
| border | `0.8px solid rgba(255,255,255,0.1)` |
| box-shadow | **无 `box-shadow`**；用 `filter: drop-shadow(rgba(0,0,0,0.45) 0px 4px 7.8px)` |
| overflow | `hidden` |
| 内图实测 | **338.4 x 253.4**（340 − 1.6 边框） |

> **阴影记法**：`drop-shadow(0 4px 7.8px rgba(0,0,0,0.45))` —— 偏移 Y=4px，模糊 7.8px，黑色 45%。

### 3.5 浮窗内部布局（层叠，从上到下）

**第 1 层 · 封面图**（绝对定位铺满）
```html
<div class="f-lazyload-container f-lazyload-image-container absolute inset-0 h-full w-full">
  <img class="f-lazyload-image h-full w-full object-cover image-outview"
       alt="新品视觉TVC广告宣传"
       src="https://cdn-ap.flova.tv/skill_material_thumbnails/{hash}_compressed.webp
            ?x-oss-process=image/resize,w_680,m_lfit/format,webp">
</div>
```
338.4 x 253.4 @ (640, 525.6)，`object-fit: cover`。

**第 2 层 · 视频**（默认 `opacity: 0`，悬停后才播）
```html
<div class="pointer-events-none absolute inset-0 transition-opacity duration-200 opacity-0">
  <div class="f-lazyload-container f-lazyload-video-container h-full w-full">
    <video class="f-lazyload-video h-full w-full object-cover"
           poster="...同图..." playsinline loop preload="none" crossorigin="anonymous"
           src="https://cdn-ap.flova.tv/videos/transcoded/{hash}_2mbps.mp4"></video>
  </div>
</div>
```
同尺寸 338.4 x 253.4，`transition: opacity .2s`。

**第 3 层 · 全屏渐变遮罩**
```html
<div class="pointer-events-none absolute inset-0
            bg-gradient-to-b from-black/0 via-black/0 to-black/[0.35]"></div>
```
`linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0), rgba(0,0,0,0.35))`

**第 4 层 · 底部重遮罩**（给文字托底）
```html
<div class="pointer-events-none absolute inset-x-0 bottom-0 h-[132px]
            bg-gradient-to-t from-black/[0.85] via-black/[0.45] to-transparent"></div>
```
盒 **338.4 x 132** @ y=647；`linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45), rgba(0,0,0,0))`

**第 5 层 · 模型标签行（右上角）**
```html
<div class="absolute inset-x-[18px] top-[16px] flex items-start gap-[8px]">
  <div class="ms-auto flex min-w-0 flex-1 flex-wrap justify-end gap-[6px]">
    <span class="inline-flex h-[22px] min-w-0 max-w-[150px] items-center justify-center truncate
                 rounded-full bg-black/30 px-[12px] text-center text-[10px] font-semibold
                 leading-[12px] text-white/50 backdrop-blur-[15px]" title="Flova Image 2">Flova Image 2</span>
    <span ... title="Seedance 2.5">Seedance 2.5</span>
  </div>
</div>
```
| 属性 | 值 |
|---|---|
| 容器盒 | 302.4 x 22 @ (658, 541.6)，`top: 16px`，`left/right: 18px` |
| 对齐 | `justify-content: flex-end`（**右对齐**） |
| 标签盒 | `Flova Image 2` = **94 x 22** @ (770.6, 541.6)；`Seedance 2.5` = **89.7 x 22** @ (870.7, 541.6) |
| 标签间距 | **6px** |
| 高度 | **22px** 固定 |
| max-width | **150px** |
| padding | `0 12px` |
| border-radius | `9999px` |
| background | `rgba(0,0,0,0.3)` |
| color | `rgba(255,255,255,0.5)` |
| font | **10px / 600 / line-height 12px** |
| backdrop-filter | `blur(15px)` |

**第 6 层 · 作者 + 标题 + 眼睛按钮（下区）**
```html
<div class="absolute bottom-[84px] start-[16px] end-[12px] z-[1] flex items-end gap-[10px]">
  <div class="flex min-w-0 flex-1 flex-col items-start gap-[4px]">
    <div class="max-w-[160px] truncate text-[12px] font-[400] leading-[18px] text-white/[0.55]">@渊静</div>
    <div class="line-clamp-2 text-[16px] font-[700] leading-[21px] text-white">新品视觉TVC广告宣传</div>
  </div>
  <div class="flex shrink-0 items-center gap-[8px]">
    <button aria-label="查看完整卡片: 新品视觉TVC广告宣传" title="查看完整卡片" tabindex="-1"
            class="mt-px flex size-[20px] shrink-0 items-center justify-center rounded-full
                   border border-white/15 bg-black/25 text-white/55 backdrop-blur-[12px]
                   transition-colors hover:border-white/25 hover:text-white">
      <svg class="lucide lucide-eye size-[10px]" viewBox="0 0 24 24" ...>...</svg>
    </button>
  </div>
</div>
```
容器盒 **310.4 x 43 @ (656, 652)**，`bottom: 84px`，`left: 16px`，`right: 12px`，`align-items: flex-end`，`gap: 10px`。

| 子元素 | 原文 | 盒 | 样式 |
|---|---|---|---|
| 作者 | **`@渊静`** | 36.4 x 18 @ (656, 652) | 12px / 400 / lh 18px / `rgba(255,255,255,0.55)`；`max-width: 160px`，`truncate` |
| 标题 | **`新品视觉TVC广告宣传`** | 160.4 x 21 @ (656, 674) | **16px / 700 / lh 21px / #fff**；`line-clamp-2` |
| 眼睛按钮 | （无文字） | **20 x 20** @ (946.4, 675) | 圆形，`border: 0.8px solid rgba(255,255,255,0.15)`，`bg: rgba(0,0,0,0.25)`，`color: rgba(255,255,255,0.55)`，`backdrop-filter: blur(12px)` |
| 眼睛图标 | lucide-eye | **10 x 10** @ (951.4, 680) | `viewBox 0 0 24 24`，`stroke-width: 2` |

作者与标题纵向间距 **4px**（674 − 670 = 4）。

**第 7 层 · 底部毛玻璃条（标签行）**
```html
<div class="absolute inset-x-0 bottom-0 h-[78px] bg-black/50 backdrop-blur-[30px]">
```
**338.4 x 78** @ y=701；`background: rgba(0,0,0,0.5)`，`backdrop-filter: blur(30px)`。

**标签（在毛玻璃条内）**
```html
<span class="inline-flex h-[18px] max-w-[86px] items-center truncate rounded-[4px]
             bg-white/10 px-[10px] text-[10px] font-[400] leading-[12px] text-white/50">全部</span>
```
| 标签原文 | 盒 | 位置 |
|---|---|---|
| **全部** | **40 x 18** | (656, 752) |
| **商业广告** | **60 x 18** | (702, 752) |

| 属性 | 值 |
|---|---|
| 高度 | **18px** |
| max-width | **86px** |
| padding | `0 10px` |
| border-radius | **4px**（区别于模型标签的胶囊） |
| background | `rgba(255,255,255,0.1)` |
| color | `rgba(255,255,255,0.5)` |
| font | **10px / 400 / line-height 12px** |

### 3.6 浮窗全部文字原文（逐条）

以悬停 **新品视觉TVC广告宣传** 为例：

| # | 位置 | 原文 | 字号/字重/颜色 |
|---|---|---|---|
| 1 | 右上 模型标签 | **Flova Image 2** | 10px / 600 / `rgba(255,255,255,0.5)` |
| 2 | 右上 模型标签 | **Seedance 2.5** | 10px / 600 / `rgba(255,255,255,0.5)` |
| 3 | 下区 作者 | **@渊静** | 12px / 400 / `rgba(255,255,255,0.55)` |
| 4 | 下区 标题 | **新品视觉TVC广告宣传** | 16px / 700 / `#fff` |
| 5 | 底部 标签 | **全部** | 10px / 400 / `rgba(255,255,255,0.5)` |
| 6 | 底部 标签 | **商业广告** | 10px / 400 / `rgba(255,255,255,0.5)` |

**该卡片按钮覆盖层上的描述原文**（非浮窗内）：
> **高奢时尚｜运动｜汽车｜3C 大牌调性情绪 TVC 全球广告宣传片 Skill，使用模型：GPT Image 2 + Seedance 2.5（分辨率 480p）**

**另一例（剧情短片分类 · 根据剧本制作多集短剧）浮窗文字**：
> 标题：**根据剧本制作多集短剧**（16px/700）
> 描述：**多集短剧制作，支持上传剧本及角色/场景图，可从任意一集或角色建立阶段开始，连续制作多集内容**（12px/400/`rgba(255,255,255,0.5)`，`line-clamp-2`）
> 标签：**短剧/微短剧**（74.3x18）、**剧情短片**（60x18）

### 3.7 浮窗命名对照（用户口径 -> 实际实现）

| 用户描述 | 实际 |
|---|---|
| "左边是介绍的" | 图上**下方**的文字区（作者 + 大标题），不是左栏 |
| "右边是几个案例" | **没有案例小图组**。右侧只有浮窗本体的**单个封面/视频**，以及一个 20x20「查看完整卡片」眼睛按钮 |
| "试一试按钮" | 存在，但在**按钮自身**上（覆盖层内），不是浮窗里。62.6 x 23，胶囊，12px/600 |
| 双栏布局 | 实际是**单栏层叠**（背景图 -> 渐变 -> 文字块） |

### 3.8 鼠标移开：立刻消失还是有延迟？

**有延迟。** 实测（p53 探针，leave 后采样）：

| 采样时刻 | 浮窗状态 |
|---|---|
| **LEAVE + 120ms** | **仍在**：`{x:464, y:524.8, w:340, h:255}`，`opacity: 1`，`visibility: visible`，`display: block` |
| **LEAVE + 1000ms** | **已移除**：查询结果为空数组 `[]` |

→ **离开后 120ms 仍完整可见，1000ms 时已消失**，且是**从 DOM 卸载**（非仅 opacity 隐藏）。
符合 Radix HoverCard 的默认关闭延迟，典型值 **300ms**（本次采样粒度 120/1000ms，未取到精确阈值）。
**结论：有 close delay，不是立刻消失。**

### 3.9 出现时序

| 采样时刻 | 新出现的浮动块 |
|---|---|
| BEFORE | 1 个（页面自身的装饰块） |
| **T+250ms** | **+3 个** -> 浮窗根 + 两层渐变遮罩 **已全部就位** |
| T+850ms | 同 250ms（稳定） |

→ **悬停 250ms 内浮窗已完整渲染**，触发灵敏。

### 3.10 截图

- `.tmp/grab52/04-hover-preview.png` — **悬停态**（浮窗可见，340x255 在按钮下方）
- `.tmp/grab52/03-skill-cards.png` — 常态按钮区

---

## 4. 整体版式

### 4.1 页面骨架

| 层 | 元素 | 盒 | 关键样式 |
|---|---|---|---|
| 根 | `div.f-homepage-bg-wrapper...bg-black` | 0,0,2048,969.6 | `display:flex; flex-direction:column; padding: 48px 0 0;` `background-color:#000` `background-image: url(background-bg...webp)` `position: relative; isolation: isolate` |
| 公告条 | `.notice-board-wrapper` | 0,0,2048,**48** | `position: fixed; top:0; z-index:100;` `display:flex; align-items:center; justify-content:center; gap:24px; padding: 4px 32px` 渐变底 `linear-gradient(89deg, #FFB595 0.93%, #D3F5FF 48.09%, #8BC9FF 99.01%)` 字 16px/700 |
| 主容器 | `div.flex.min-h-0...relative.z-[1]` | 0,**118**,2048,851.6 | `display:flex; flex-direction:row; overflow:hidden; position:relative; z-index:1` |
| 侧栏 | `aside` | 0,118,**90**,851.6 | 见 §1 |
| 主区 | `main.min-w-0.flex-1.overflow-hidden` | **90**,118,**1958**,851.6 | `overflow: hidden` |
| 中列 | `div[data-home-mobile-hero]` | 90,118,1938,474.6 | `display:flex; flex-direction:column` |

### 4.2 首屏高度与留白

| 项 | 值 |
|---|---|
| 视口 | 2048 x 970 |
| 首屏（文档）高 | **970**（`h-screen`，无纵向滚动） |
| 顶部公告条高 | **48** |
| header 下沿（主容器起点） | **y = 118** -> header 实际高 **70px**（48 → 118） |
| 侧栏宽 | **90** |
| 内容区起点 | x = **90** |
| 内容区宽 | **1938** |
| 内容区右边界 | 2028（距视口右 **20px**） |
| 底部留白 | 侧栏尾部 `h-[16px]`；`--page-padding: 15px`（`md`） |
| 主区 `main` 宽 | 1958（90 -> 2048） |

### 4.3 字体族（原文照录）

`document.body` 与 `document.documentElement` 计算值**完全一致**：
```css
font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
```
`<html lang="zh-CN">`

**特殊字体覆盖**
- H1 主标题用衬线斜体：`font-[family-name:Didot,'Bodoni_72','Times_New_Roman',serif]`，`text-[36px]`，`italic`，`font-light`，`tracking-[-1px]`
- 移动端说明文字用 `font-pingfang`
- 页面基准字号 16px，行高 24px，字重 400

### 4.4 首屏文字骨架（原文）

```
上新特惠：年会员享 Flova Image 2.5、Seedance 2.5 最低4折，Flova Image 2.5 1K 低至￥0.058/张，Seedance 2.5 480p 低至 ￥0.175/秒
立即订阅
FlovaSkill创作人招募中    Flova 精选作者团招募中
注册领 300 积分

首页 / 项目 / 快速生成 / 资产库 / Skill / FlovaTV / 教程 / Flova CLI
礼物按钮

[主标题]  Flova 1.0 - 你的专属AI视频创作Agent
[副标题]  把品味和习惯写进Skill，让精力回归创意

[流程 默认]  [模型 新]  [Skill]  [资产库]
[输入框]  由一个想法或故事开始...

精选Skills：  热门玩法  剧情短片  商业广告  音乐/MV  更多 Skill

[Skill 按钮行]
```

### 4.5 截图

- `.tmp/grab52/01-home-full.png` — 整页首屏

---

## 5. 照着实现的清单

### 5.1 左侧导航栏

**结构**
```
aside (w=90px, h=100%, flex column, 透明无边框)
├── nav (flex:1, min-height:0)
│   └── ul (flex column, align-items:center, gap:15px, padding-top:6px)
│       └── li × 8
│           └── a (flex column, align-items:center, gap:2px, h:47px)
│               ├── div.icon-box (30x30, flex center, color:#fff, opacity 1|0.5)
│               │   └── svg (30x30 或 24x24, stroke:currentColor, stroke-width:2)
│               └── span.label (10px/600, line-height:15px, margin-top:2px)
├── div.bottom (h=156px, flex column center, gap:6px)
│   └── button 礼物 (28x28, radius:9999px, 渐变底)
└── div.spacer (h=16px)
```

**必需数值**
| 项 | 值 |
|---|---|
| 侧栏宽 | **90px** |
| 项间距 | **15px** |
| ul 上内边距 | **6px** |
| 项高 | **47px** |
| 图标盒 | **30 x 30** |
| 图标与文字间距 | **2px** |
| 文字字号 | **10px** |
| 文字字重 | **600** |
| 文字行高 | **15px** |
| 文字色（普通） | `rgba(255,255,255,0.5)` |
| 文字色（选中） | `#FFFFFF` |
| 图标透明度（普通） | **0.5** |
| 图标透明度（选中） | **1.0** |
| 图标色 | `#FFFFFF` |
| 图标描边宽 | **2** |
| 悬停/选中过渡 | `0.2s cubic-bezier(0.4, 0, 0.2, 1)`，属性 = background-color / color / opacity |
| 选中态额外视觉 | **无**（无背景块、无描边、无指示条） |
| 底部礼物按钮 | 28x28，渐变 `90deg, #D2FFB3 -3.91% -> #FFFFFF 101.56%`，emoji 15px |
| 尾部占位 | 16px |

**8 项内容与顺序**：首页 `/` · 项目 `/projects/` · 快速生成 `/generator/` · 资产库 `/library/` · Skill `/skill/` · FlovaTV `/#explore` · 教程 `/docs/?flovatv=1` · Flova CLI `/agent-cli/`

### 5.2 Skill 按钮区

**分类行必需数值**
| 项 | 值 |
|---|---|
| 分类总数 | **4** 个 tab + 1 个「更多 Skill」链接 |
| tab 原文 | 热门玩法 / 剧情短片 / 商业广告 / 音乐/MV |
| tablist 高 | **44px** |
| tab 字号 | **14px**（`md`），12px（mobile） |
| tab 字重 | **600** |
| tab 行高 | `leading-none` = 14px |
| 未选中色 | `rgba(255,255,255,0.3)` |
| 选中色 | **#9BC957** |
| 悬停色 | `--fg-secondary`（白 50%） |
| 分隔线 | 伪元素 `w:1px; h:16px; bg: rgba(255,255,255,0.1)`，左右各 **20px** 外边距，首项隐藏 |
| 过渡 | `color 0.15s cubic-bezier(0.4,0,0.2,1)` |
| 前缀文案 | `精选Skills：`（挂在 `aria-label`） |
| 「更多 Skill」 | 链接，色 `#9BC957`，悬停 `#b8df7e`，gap 8px，带 24x24 箭头 svg |

**按钮行必需数值**
| 项 | 值 |
|---|---|
| 容器上内边距 | **16px**（`md`），11px（mobile） |
| 溢出策略 | `overflow-x: auto` + `scroll-snap-type: x proximity`（**非 grid**） |
| 按钮高 | **60px** |
| 按钮圆角 | **14px** |
| 按钮内边距 | **8px 0** |
| 按钮底色 | `rgba(255,255,255,0.04)` |
| 按钮边框 | `0.8px solid rgba(255,255,255,0.1)` |
| 按钮 backdrop-filter | `blur(12px)` |
| 图标尺寸 | **44 x 44**，`border-radius: 6px`，`object-fit: cover` |
| 图标左内边距 | **11px** |
| 图标与文字间距 | **10px** |
| 标题字号 | **14px**，字重 **700**，行高 14px，色 `#FFFFFF` |
| 标题 max-width | **164px**，单行 `truncate` |
| 右侧内边距 | **38px** |
| 同排卡片间距 | **10.9px** |
| 行间距 | **10.8px** |
| 卡片宽度 | 内容自适应（实测 169.7 ~ 241.7px） |
| 「热门」角标 | 绝对定位 top:0 right:0，`translateY(-50%)`，`radius: 9999px`（右下角为 0），padding `6px 14px`，字号 10px，字重 900，悬停淡出 |

### 5.3 悬停交互（按钮本体 + 覆盖层）

| 项 | 值 |
|---|---|
| 按钮位移 | **无**（悬停前后盒完全一致） |
| 悬停边框 | `rgba(255,255,255,0.1)` -> `rgba(255,255,255,0.15)` |
| 悬停底色 | `rgba(255,255,255,0.04)` -> `transparent` |
| 悬停模糊 | `blur(12px)` -> `none` |
| 常态内容 | 悬停时 `visibility: hidden` |
| 覆盖层 | `absolute; inset: -1px`；`border-radius: 14px`；`bg: rgba(255,255,255,0.05)`；`border: 0.8px solid rgba(255,255,255,0.05)`；`backdrop-filter: blur(12px)` |
| 覆盖层布局 | `flex column; align-items:center; justify-content:center; gap:6px; padding:2px 0` |
| 覆盖层动画 | `opacity 0 -> 1`，`0.2s cubic-bezier(0.4,0,0.2,1)` |
| **试一试** 尺寸 | **62.6 x 23**（padding `6px 16px`） |
| **试一试** 圆角 | `9999px` |
| **试一试** 底色 | `rgba(255,255,255,0.1)` |
| **试一试** 边框 | `0.8px solid rgba(255,255,255,0.1)` |
| **试一试** 字 | **12px / 600 / `#FFFFFF`** |
| 描述行 | 宽 = 按钮宽 − 2px，padding `0 24px`，12px / 400 / `#fff`，`line-clamp-1` |
| 描述箭头 | 10x10 svg，`right: 12px`，垂直居中 |

### 5.4 悬停预览浮窗

**定位与尺寸**
| 项 | 值 |
|---|---|
| 定位方式 | `position: fixed` + `transform: translate(x, y)`（Popper 模式） |
| 相对位置 | 触发元素 **正下方**，水平 **居中** |
| 垂直间隙 | **10.2px**（按钮 bottom 514.6 -> 浮窗 top 524.8） |
| 水平对齐 | 浮窗中心 = 按钮中心（809.2 vs 808.8） |
| 展开原点 | `transform-origin: 50% 0` |
| z-index | **1000** |
| 宽度 | **340px**（固定） |
| 高度 | **255px**（固定） |
| 圆角 | **18px** |
| 底色 | **#1d2220** |
| 边框 | `0.8px solid rgba(255,255,255,0.1)` |
| 阴影 | `filter: drop-shadow(0 4px 7.8px rgba(0,0,0,0.45))`（**非 box-shadow**） |
| 溢出 | `hidden` |
| 触发延迟 | **<= 250ms** 内完成渲染 |
| 关闭延迟 | **有延迟**：leave+120ms 仍可见，leave+1000ms 已从 DOM 卸载 |

**内部层叠（7 层，均为绝对定位叠放）**
| 层 | 内容 | 尺寸 | 关键样式 |
|---|---|---|---|
| 1 | 封面图 | 338.4 x 253.4 | `object-fit: cover`，铺满 |
| 2 | 视频（默认 opacity 0） | 338.4 x 253.4 | `object-fit: cover`，`0.2s` 淡入，`loop` `playsinline` `preload:none`，带 poster |
| 3 | 全屏渐变 | 铺满 | `linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0), rgba(0,0,0,0.35))` |
| 4 | 底部渐变 | 338.4 x **132**，`bottom:0` | `linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45), transparent)` |
| 5 | 模型标签行 | 302.4 x 22，`top:16px` `left/right:18px`，右对齐 gap 6px | 标签：h **22px**，max-w **150px**，padding **0 12px**，radius **9999px**，bg `rgba(0,0,0,0.3)`，色 `rgba(255,255,255,0.5)`，**10px/600**，`backdrop-filter: blur(15px)` |
| 6 | 作者+标题+眼睛 | 310.4 x 43，`bottom:84px` `left:16px` `right:12px`，`align-items:flex-end` gap 10px | 作者：**12px/400**，色 `rgba(255,255,255,0.55)`，max-w 160px，单行截断；标题：**16px/700** lh 21px 白色，`line-clamp-2`；二者间距 **4px** |
| 6b | 眼睛按钮 | **20 x 20** | 圆形，border `0.8px solid rgba(255,255,255,0.15)`，bg `rgba(0,0,0,0.25)`，色 `rgba(255,255,255,0.55)`，`backdrop-filter: blur(12px)`；内 svg **10x10**（lucide-eye） |
| 7 | 底部毛玻璃条 | 338.4 x **78**，`bottom:0` | `background: rgba(0,0,0,0.5)`，`backdrop-filter: blur(30px)` |
| 7b | 标签 | h **18px**，max-w **86px**，padding **0 10px** | radius **4px**，bg `rgba(255,255,255,0.1)`，色 `rgba(255,255,255,0.5)`，**10px/400**；标签间距实测 6px（702 − 696） |

**浮窗文本槽位（6 个）**
1. 模型标签 #1（右上）
2. 模型标签 #2（右上）
3. 作者 `@xxx`（下区，上）
4. 标题（下区，下，最大 2 行）
5. 标签 #1（底部条，左）
6. 标签 #2（底部条，右）

### 5.5 整体版式

| 项 | 值 |
|---|---|
| 页面背景 | `#000` + `background-bg.webp` |
| 顶部公告条高 | **48px** |
| 公告条定位 | `fixed; top:0; z-index:100` |
| 公告条底 | `linear-gradient(89deg, #FFB595 0.93%, #D3F5FF 48.09%, #8BC9FF 99.01%)` |
| 公告条字 | **16px / 700**，gap 24px，padding `4px 32px` |
| header 高 | **70px**（y 48 -> 118） |
| logo | 119 x 22.8，距左 23px，`w-[92px] md:w-[119px]` |
| 侧栏宽 | **90px** |
| 内容区起点 | x = 90 |
| 内容区宽 | **1938px** |
| 主区最大宽 | 无 `max-width`（铺满剩余 1958px） |
| 页面级内边距 | `--page-padding: 15px`（`md`），8px（mobile） |
| 首屏高 | `100vh`（**970px**，无滚动） |
| 主容器 | `padding-top: 48px`（让开公告条） |
| 字体族 | `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` |
| H1 字体 | `Didot, 'Bodoni 72', 'Times New Roman', serif`，36px，italic，font-light，letter-spacing −1px |
| 品牌主色 | **#9BC957**（悬停 #b8df7e） |
| 浮窗底色 | #1d2220 |
| 语义 token | `--fg` = #fff；`--fg-secondary` = rgba(255,255,255,0.5)；`--fg-tertiary` = rgba(255,255,255,0.3) |
| 布局根 | `display: flex; flex-direction: column`，高度 `100vh` |
| 主行 | `display: flex; flex-direction: row; overflow: hidden` |

---

## 附：截图清单

| 文件 | 内容 |
|---|---|
| `.tmp/grab52/01-home-full.png` | 整页首屏（2048x970） |
| `.tmp/grab52/02-nav-skillbar.png` | 左侧导航 + skill 按钮区 |
| `.tmp/grab52/03-skill-cards.png` | 分类行 + skill 按钮常态 |
| `.tmp/grab52/04-hover-preview.png` | **悬停态：按钮覆盖层 + 340x255 预览浮窗** |

原始数据 JSON：`.tmp/grab/p50-flova-home.json` ... `.tmp/grab/p57-leaves.json`

