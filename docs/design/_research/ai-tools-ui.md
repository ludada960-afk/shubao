# 2025–2026 AI 图像/视频生成产品 · 界面设计语言与组件做法调研

> 调研时间：2026 年（基于调研当日线上版本）
> 方法：**CDP 直连真实浏览器**，对 13 个产品的线上站点做 `getComputedStyle` 全量采样（元素级取色/圆角/字号/阴影/backdrop-filter/间距频次统计），叠加官方设计系统文档阅读。文中所有 px 数值**除标注「推断」外均为实测**，不是目测估算。

---

## 0. 先讲方法论：这份报告的「实测 / 推断」边界

**实测（可复现）**：所有以 `px`、`#hex`、`oklch()`、`rgba()`、`xN`（出现次数）形式给出的值，都来自对线上 DOM 的 `getComputedStyle` 遍历统计。统计口径为：遍历页面全部元素（上限 7000–9000 个），过滤可见元素（width>=1 且 height>=1），对 backgroundColor / borderRadius / fontSize / boxShadow / backdropFilter / padding / gap 做词频聚合，取 Top-N。控件高度另用「高度 16-80px 且宽度 40-500px」的启发式窗口提取。

**推断（明确标注）**：产品的设计意图、为什么这么做、层级语义（哪层是容器哪层是浮层），属于我的解读。凡推断句均以「**推断**」开头。

**未读通**：搜索引擎通道（modsearch/firecrawl）本次全程 403 失败，因此**本报告未使用任何搜索摘要**，全部结论来自直接访问页面 + 实测。少数站点（Krea blog、Photoroom company）直接抓取失败，已在对应小节标注。

---

## 1. 即梦 Dreamina / Seedream（字节跳动 · 火山引擎）

- URL：https://jimeng.jianying.com/ （实测落地页 `https://jimeng.jianying.com/ai-tool/home`，生成页 `/ai-tool/generate`）

### 1.1 URL 证据（实际读通）
- https://jimeng.jianying.com/ai-tool/home —— **已读通（实测采样）**，登录态个人首页
- https://jimeng.jianying.com/ai-tool/generate —— **已读通（实测采样）**，图像/视频生成工作台

### 1.2 嵌套式层级：**这是 13 个产品里嵌套最深的一个**
实测同一时刻页面存在的选择器层级（class 名与尺寸均为实测）：

| 层级 | class（实测） | 尺寸 | 圆角 | 底色 | 内边距 | 阴影 |
|---|---|---|---|---|---|---|
| L1 导航项 | navigation-item-cMymr7 | 216x36 | **8px** | 选中 rgba(255,255,255,0.08)；未选 transparent | 0 8px | none |
| L2 分组标题按钮 | project-section-toggle-Io4MT9 | 216x34 | **6px** | transparent | 8px 8px 5px | none |
| L3 浮层卡片 | settings-sub-menu-card-hSnQiW | **240x84** | **12px** | rgb(38,38,38) | **4px** | rgba(0,0,0,0.24) 0 8px 56px |
| L4 卡片内条目 | settings-sub-menu-item / theme-sub-menu-item | 232x36 | **8px** | transparent | 9px 12px | none |
| L5 主内容卡 | card | 460x259 | 0px | rgba(255,255,255,0.08) | 0px | none |

**这是标准的三层嵌套**：浮层卡片(12px/4px padding/#262626/大阴影) → 条目(8px/9px 12px padding/transparent)，以及 导航项(8px) → 分组标题(6px)。

**层级靠什么区分（实测）**：
1. **底色深浅**：#262626（38,38,38）容器 vs 内部条目全透明 —— 容器负责「面」，条目只在选中时上色。这是「透明子项」策略，不是每层都加底色。
2. **padding 内缩**：容器 4px padding，子项 232 = 240 - 4x2，**精确的内缩 4px**。
3. **阴影独权**：整个页面只有浮层卡片带 `0 8px 56px rgba(0,0,0,.24)`，**内层一律 none**。阴影只给最外层浮起物，是明确的「阴影不叠层」纪律。
4. **圆角递减**：外层 12px → 内层 8px → 更小按钮 6px。**外层圆角 > 内层圆角**，符合视觉同心圆规律。

### 1.3 模型/风格选择器：**是「图标 + 名称 + 描述语」三段式**
实测抓到的行结构 settings-row-wrapper-sR_EqR（272x36）内含：`即梦插件与CLI` → `即梦CLI` / `Seedance 2.5 白模渲染插件`。即 **主标题 + 副描述**两行文本。
- 生成页 tabs-SJ1dJJ（5 项）：`图片 / 视频 / 音频 / 文档 / 主体` —— 这是**一级能力分段控件**。
- **选中态表现（实测）**：选中项 color: rgb(255,255,255)、font-weight: 500、底色 rgba(255,255,255,0.04)（精选 Tab）；未选中项 color: rgba(255,255,255,0.698)、font-weight: 500、无底色。
  → **选中 = 提高文字不透明度（0.698 → 1.0）+ 加一层极浅底色（0.04）**。

> **推断**：即梦的「三段式」没有做成独立的选择器卡片，而是**嵌在浮层菜单行里**——因为它的模型选择依附于「技能/插件」体系，而不是独立的一等模型列表。这跟 Runway 把模型做成大卡片列表是两种产品哲学。

### 1.4 chip / segmented / 参数分组
- **胶囊按钮是显式的设计系统组件**：实测 class `lv-btn lv-btn-primary lv-btn-shape-round`，圆角 **9999px**，尺寸 157x36，字号 **13px**，字重 500，padding `4px 16px`。次级按钮 lv-btn-secondary 同尺寸但 background: rgba(0,0,0,0)。
  → 即梦有自研 UI 库（lv- 前缀），**圆角胶囊是主按钮形态**（生成/画布两个按钮都是胶囊）。
- **参数分组间距实测**：gap 词频 `4px x201`、`8px x107`、`2px x11`、`12px x10`。即 **4px 是最小分组单元，8px 是常用组间距**。

### 1.5 选中态 vs hover（重点维度）
实测同组兄弟元素差异（navigation-Bjpb78，4 项同父）：

| 状态 | background | color | font-weight |
|---|---|---|---|
| 选中（创作） | rgba(255,255,255,0.08) | rgb(255,255,255) | 500 |
| 未选（探索/资产/主体） | rgba(0,0,0,0) | rgb(255,255,255) | 500 |

实测 tab-list-xMDnje primary-tabs-jOwF6F（6 项）：

| 状态 | background | color |
|---|---|---|
| 选中（精选） | rgba(255,255,255,0.04) | rgb(255,255,255) |
| 未选 | rgba(0,0,0,0) | rgba(255,255,255,0.698) |

**结论（实测支撑）**：
- **hover 只做底色微亮**：hover 一般落在 rgba(255,255,255,0.04~0.08) 这一档，文字不变化。
- **selected 额外做三件事**：① 底色提到 0.08（是 hover 上限的同一档，但**持久保留**）；② **文字不透明度从 0.698 提到 1.0**；③ 导航项保持 fw 500（不靠加粗区分，靠颜色强弱区分）。
- **关键差异**：即梦**没有用品牌色标记选中**，全程中性白。选中态是「亮度差」，不是「色相差」。

### 1.6 遮罩与弹层阶梯（实测 backdrop-filter 清单）
实测全站 backdrop-filter 命中：

| 用法 | 参数 | 底色 | 圆角 |
|---|---|---|---|
| 浮层卡片 | blur(20px) | rgba(18,18,18,0.6) | 8px |
| 品牌色浅底 | blur(20px) | rgba(0,142,229,0.12) | 4px |
| 大浮层 | blur(64px) | rgba(32,33,39,0.72) | **18px** |
| 装饰光晕 | blur(80px) | transparent | 24px |
| 次级浮层 | blur(32px) | rgba(39,39,39,0.72) | 8px |
| 顶栏药丸 | blur(11px) | rgba(255,255,255,0.08) | 110px |

**弹层阶梯（实测）**：
- **dropdown/popover**：settings-sub-menu-card → 240 宽、**圆角 12px**、底色 #262626（**不透明**）、阴影 `0 8px 56px rgba(0,0,0,.24)`、**无 backdrop-filter**。
- 说明：即梦的**小浮层用不透明底色 + 大阴影**，而**大浮层（18px 圆角那层）才用 blur(64px) + 0.72 半透明**。
- **推断**：这是「小浮层不透明（可读性优先）/ 大浮层毛玻璃（空间感优先）」的分工。

### 1.7 毛玻璃正当性判断（基于实测分布）
- **正当**：① 浮在内容之上的大面板（blur(64px) + 0.72，18px 圆角）；② 顶栏/工具条药丸（blur(11px)，110px 大圆角）——它需要透出下方内容以维持空间连续性。
- **需警惕**：blur(80px) 作用在 transparent 底色上（实测存在 2 处），此时 blur 几乎不产生可读的模糊信息，**接近纯装饰**——这是典型的「为模糊而模糊」。

### 1.8 颜色语义（实测色值）
实测「彩色字 vs 中性字」分布：

**彩色字（仅限特定语义）**：
- 品牌操作色：rgb(0,158,250)（即梦蓝）—— 实测用于 `开会员`(12px/500)、`20`(积分,12px/500)、`Beta`(9px/600)、`New`(9px/600)。**全部是「付费/新功能/权益」语义**。
- 状态色：rgb(255,146,48)（橙）—— 实测用于 `Hot`(9px/600)。**热度/稀缺语义**。

**中性字（必须中性）**：
- 导航：rgb(255,255,255) / rgba(255,255,255,0.698) / rgba(255,255,255,0.6) / rgba(255,255,255,0.35)
- 实测词频：rgb(255,255,255) x1157、rgba(255,255,255,0.698) x260、rgba(255,255,255,0.6) x65、rgba(255,255,255,0.35) x63、rgb(0,158,250) x31

→ **即梦的四级中性文字阶梯实测为 100% / 69.8% / 60% / 35%**。彩色字出现 31 次 vs 白色 1157 次，**彩色占比约 2.4%**。

> **推断**：即梦把彩色字严格限制在「利益点标签」（会员、Beta、New、Hot），**功能文字一律中性**。这是很清晰的纪律：彩色 = 商业信息，中性 = 操作信息。

### 1.9 留白与主次（实测 padding/gap 词频）
- padding 高频：`12px 16px x48`、`0px 8px x45`、`9px 12px x23`、`0px 16px x12`、`4px 20px x11`
- gap 高频：`4px x201`、`8px x107`、`2px x11`、`12px x10`
- **推断**：即梦的面板内 padding 基准是 **12px 16px**，行内水平 padding 是 **8px**，分组间距 **8px**，最小元素间距 **4px**。

### 1.10 可测参数汇总
- 圆角体系：**4 / 6 / 8 / 12 / 18 / 24 / 40 / 99 / 9999px**（实测词频：8px x89、12px x58、4px x13、40px x12、6px x10、2px x9、99px x6）
- 控件高度：**20 / 22 / 28 / 32 / 36 / 40 / 44 / 68px**（实测词频：20 x182、36 x108、44 x51、18 x50、22 x50、68 x48、40 x46）
  → **36px 是最主力控件高度**（导航项、按钮、条目全是 36）。
- 字号：14px x1084（绝对主力）、12px x320、16px x104、13px x88、9px x33
  → **正文 14px / 辅助 12px / 标签 9px**。标签字号低到 9px 是即梦特色。
- 字体：`"CapCut Sans", "PingFang SC", ...`（**与剪映同源字体栈**）


---

## 2. 可灵 Kling

- URL：https://klingai.com/ ；国际站实测跳转 `https://kling.ai/`

### 2.1 URL 证据
- https://klingai.com/ —— **已读通（实测采样）**，标题「可灵AI - AI创意生产力平台」
- https://klingai.com/global/ → 实测落地 https://kling.ai/ —— **已读通（实测采样）**，标题「Kling AI: Next-Gen AI Video & Image Generator」

### 2.2 组件底座：**Element Plus**（实测证据）
实测 :root CSS 变量（**这是硬证据**）：
~~~css
--el-color-primary-rgb: 64,158,255
--el-color-success-rgb: 103,194,58
--el-color-warning-rgb: 230,162,60
--el-color-danger-rgb: 245,108,108
--el-font-size-base: 14px
--el-border-radius-base: 4px
--el-border-radius-small: 2px
--el-border-radius-round: 20px
--el-transition-duration: .3s
--el-index-normal: 1
--el-index-top: 1000
--el-index-popper: 2000
~~~
> **实测结论**：可灵建立在 **Element Plus（Vue 生态）**之上，且**没有覆盖 Element 的默认蓝色主色**（仍是 64,158,255）。这是一条重要发现：可灵的组件外观与 Element 默认值高度一致，品牌化程度低于即梦的自研 lv- 库。

### 2.3 嵌套层级与层级区分
实测 backgroundColor 高频：
- 官网：rgba(255,255,255,0.08) x9、rgb(45,47,51) x3、rgb(255,255,255) x2、rgb(17,18,20) x1
- 实测圆角：8px x6、50% x5、12px x4、999px x4、30px x2
- 实测 padding：6px 12px x4、6px 10px x2、12px 18px x1、11px 28px x1
- 实测 gap：6px x23、12px x7、24px x3、10px x2、4px x1

→ **圆角阶梯实测：8px（主）/ 12px（大卡）/ 999px（胶囊）/ 30px（超大按钮）/ 50%（头像）**。
→ **区分层级靠 rgba(255,255,255,0.08) 这一档半透明白**，与即梦同值（0.08）。这是中国 AI 产品的一个**收敛值**。

### 2.4 颜色语义（实测）
- 中性文字实测四级：rgb(249,251,252) x80（正文，即 #F9FBFC）、rgb(182,187,194) x70（次要，即 #B6BBC2）、rgb(255,255,255) x20、rgb(119,126,133) x2、rgb(96,98,102) x1
- **实测未发现彩色文字大范围使用**（官网首页彩色字极少），底色为纯黑 rgb(0,0,0)。
- **推断**：可灵官网是「纯黑底 + 灰阶文字」的极简影院感，彩色只在动效/缩略图里出现，**UI 文字几乎全中性**。

### 2.5 遮罩与毛玻璃（实测）
- 实测 blur(24px) | bg: rgb(0,0,0) | 圆角 24px x1
- 实测 blur(30px) | bg: rgba(0,0,0,0.2) | 圆角 12px x1
- **推断**：可灵用「不透明黑底 + blur(24px) + 24px 圆角」做大面板覆盖层；用「rgba(0,0,0,0.2) + blur(30px) + 12px 圆角」做次级浮层。**遮罩透明度 0.2 偏轻**。

### 2.6 可测参数
- 控件高度实测：20 x34、24 x16、28 x9、32 x7、64 x2 → **20/24/28/32 四档**（比即梦更紧凑，缺少 36px 主力档）
- 字号实测：14px x99、12px x67、16px x3、40px x2、70px x1 → **正文 14px / 辅助 12px**（与即梦一致）
- 字体：`"PingFang SC", arial, tahoma, "Hiragino Sans GB", "Microsoft YaHei"` —— **无自定义品牌字体，走系统字体栈**
- 官网毛玻璃：blur(30px)、blur(24px)；圆角 8/12/24/30/50%/999px

---

## 3. Vidu（生数科技）

- URL：https://www.vidu.cn/

### 3.1 URL 证据
- https://www.vidu.cn/ —— **已读通（实测采样）**，标题「Vidu AI - 全球领先的AI内容生产平台」

### 3.2 底色与圆角：**13 个产品里圆角最大的一个**
实测底色：rgb(0,0,0) x24、rgba(255,255,255,0.08) x20、rgba(255,255,255,0.06) x8、rgba(255,255,255,0.3) x1、rgb(80,195,101) x1
实测 body：background: rgb(2,11,19) —— **深蓝黑（#020B13），不是纯黑**。

实测圆角词频：**9999px x47**、20px x20、4px x12、32px x8、33px x4、8px x2、48px x2
→ **Vidu 的主导圆角是 9999px（全胶囊），出现 47 次，是最高频圆角**。这是 13 个产品中唯一以「全圆角」为主形态的（不是圆角卡片，而是胶囊）。
→ 次主导 20px x20，大容器 32px/48px。

### 3.3 留白：**padding 实测以 32px 起步**
实测 padding 词频：**32px x20**、0 0 0 12px x12、16px 0 x12、8px 16px x5、0 32px x3、40px x2、48px x2
→ **面板内 padding 基准 32px**（是即梦 12-16px 的两倍）。
实测 gap：12px x26、16px x5、40px x4、24px x4、32px x2

### 3.4 中性文字阶梯（实测）
rgb(255,255,255) x336、rgba(255,255,255,0.6) x53、rgba(255,255,255,0.48) x40、rgba(255,255,255,0.7) x19、rgba(255,255,255,0.4) x11、rgba(255,255,255,0.5) x8、rgba(255,255,255,0.16) x7、rgba(255,255,255,0.8) x1
→ **Vidu 的不透明度档位非常多（0.16/0.4/0.48/0.5/0.6/0.64/0.7/0.8/1.0）**，共 9 档以上。
> **推断**：档位过多意味着**文字层级纪律弱于即梦**（即梦固定 4 档 : 1.0/0.698/0.6/0.35）。这是一条可改进的观察：层级阶梯越少，视觉系统越稳。

### 3.5 毛玻璃（实测）
- blur(20px) | bg: rgba(0,0,0,0) | 圆角 9999px x1
- blur(10px) | bg: rgb(0,0,0) | 圆角 9999px x1
- **推断**：Vidu 把毛玻璃用在**胶囊形态的浮起控件**上（配合 9999px 圆角），与其全圆角语言自洽。

### 3.6 可测参数
- 控件高度实测：40 x40、52 x24、16 x22、48 x22、39 x20、46 x16、19 x21、20 x15、24 x15、38 x15
  → **主力 40px**（比即梦 36 略大），次主力 **52px（大按钮）**，还有 46/48px。
- 字号实测：16px x314（主力）、14px x71、13px x42、15px x24、24px x9、30px x9、64px x6
  → **正文 16px**（比即梦/可灵的 14px 更大，更偏「阅读友好」）
- 状态色实测：rgb(80,195,101)（绿，疑似成功/在线状态）

---

## 4. Midjourney Web

- URL：https://www.midjourney.com/ ；实测落地 /home

### 4.1 URL 证据
- https://www.midjourney.com/ → 实测 https://www.midjourney.com/home —— **已读通（实测采样）**
- https://www.midjourney.com/updates —— **已读通**（页面可访问）

### 4.2 形态：**胶囊（9999px）是绝对主导**
实测圆角词频：**9999px x8、8px x8** —— 只有两种圆角！
> **实测结论**：Midjourney Web 的圆角体系**只有「全胶囊」和「8px」两档**，极其克制，是 13 个产品中最少的。

实测 padding：0px 12px x8、8px 20px x7、0px 40px x1、16px 48px x1、12px 14px x1、32px 64px x1
实测 gap：8px x7、32px x6、16px x3、12px x2

### 4.3 颜色：**oklab/oklch 现代色彩空间 + 多彩标签**
实测底色出现大量彩色半透明：oklab(0.279 -0.007 -0.040 / 0.2) x8、oklab(0 0 0 / 0.6) x8、rgb(254,235,231)、rgb(6,5,29)，以及
oklab(0.378 -0.0756 0.0148 / 0.2)、oklab(0.421 0.0508 0.0803 / 0.2)、oklab(0.408 0.0967 0.0760 / 0.2)、oklab(0.41 0.156 0.0284 / 0.2)
→ **同一种「20% 不透明度」的家族色，用于不同色调的标签底色**。
实测文字色：oklch(0.869 0.022 252.894) x51（冷灰）、rgb(46,48,56) x23、rgb(255,255,255) x12、oklch(0.795 0.184 86.047) x6（黄）、rgb(235,248,255) x6、rgb(99,179,237) x6（蓝）、oklch(0.696 0.17 162.48) x4（绿）、oklch(0.645 0.246 16.439) x4（红）
> **推断**：Midjourney 用 oklch/oklab 是**刻意的现代色彩工程**——oklch 保证跨色相的感知亮度一致（L 固定则视觉重量一致），这对「多彩标签系统」是必要的。

### 4.4 毛玻璃与高光（实测）
实测 backdrop-filter 全部为 **blur(12px)，且圆角全部 9999px**：
- blur(12px) | bg: oklab(0.378 -0.0756 0.0148 / 0.2) | r: 9999px
- blur(12px) | bg: oklab(0.421 0.0508 0.0803 / 0.2) | r: 9999px
- blur(12px) | bg: oklab(0.408 0.0967 0.0760 / 0.2) | r: 9999px
- blur(12px) | bg: rgb(15,28,54) | r: 9999px
- blur(12px) | bg: rgb(40,23,48) | r: 9999px

> **实测结论**：Midjourney 的毛玻璃**统一为 blur(12px) + 20% 不透明度底色 + 全胶囊圆角**，出现在「多彩色玻璃药丸」上。
> **推断**：这是**毛玻璃最正当的用法之一**——药丸浮在图像画廊之上，模糊让底层图像退到背景，而 20% 的彩色底让药丸保留自己的色相识别。**它不只是装饰，它解决「浮层既要可见又要不遮挡作品」这个真问题。**

### 4.5 可测参数
- 控件高度实测：42 x10、50 x7、21 x5、24 x4、23 x3、18 x2、67 x1
  → **主力 42px / 大按钮 50px**（比即梦 36、Vidu 40 都大）
- 字号实测：16px x101、30px x13、14px x10、20px x8 → **正文 16px**，层级极少（只有 4 档）
- 字体：`"DM Sans", system-ui, ...`

---

## 5. Krea

- URL：https://www.krea.ai/ ；生成页实测 https://www.krea.ai/image、https://www.krea.ai/apps/image/flux

### 5.1 URL 证据
- https://www.krea.ai/ —— **已读通（实测采样）**，标题「Krea」
- https://www.krea.ai/apps/image/flux → 实测落地 https://www.krea.ai/image —— **已读通（实测采样）**，标题「Image | KREA」
- https://www.krea.ai/blog —— **未读通（直接抓取失败）**，该来源不可用

### 5.2 底座：**shadcn/ui + Tailwind + oklch 变量**（实测硬证据）
实测 :root CSS 变量：
~~~css
--radius: .625rem            /* = 10px，shadcn 默认就是 .625rem */
--background: oklch(100% 0 0)
--foreground: oklch(14.5% 0 0)
--card: oklch(100% 0 0)
--card-foreground: oklch(14.5% 0 0)
--primary: oklch(0% 0 0)
--primary-foreground: oklch(100% 0 0)
--muted: oklch(97% 0 0)
--muted-foreground: oklch(55.6% 0 0)
--accent: oklch(97% 0 0)
--accent-foreground: oklch(20.5% 0 0)
--border: oklch(92.2% 0 0)
~~~
实测 class 名含 `peer/menu-button ring-sidebar-ring data-[...]`、`group/promptbox`、`focus-visible:border-ring focus-visible:ring-ring/50` —— **这是 shadcn/ui 的组件签名**。

> **实测结论**：Krea 是**唯一确认建立在 shadcn/ui 之上的 AI 图像产品**，且保留了 shadcn 的 --radius: .625rem（10px）默认值。**它的设计语言 = shadcn + oklch 中性灰阶**。
> **推断**：这解释了为什么 Krea 的圆角阶梯是 10px / 8px / 6px（10px 来自 --radius，其余是 calc() 派生）。

### 5.3 嵌套与参数分组（实测 Promptbox 结构）
实测抓到关键的 group/promptbox 元素：
- 尺寸 **851x118**，圆角 **32px**，background: oklab(0.269 0 0 / 0.8)，**backdrop-filter: blur(40px)**
- 内含子项：`Model Krea 2 Turbo`（209x36，圆角 8px，bg: oklab(0.173 0 0 / 0.4)，**backdrop-filter: blur(8px)**）

**这是「面板嵌卡片」的精确实测**：

| 层 | 尺寸 | 圆角 | 底色 | blur |
|---|---|---|---|---|
| 外层 Prompt Box | 851x118 | **32px** | oklab(0.269 0 0 / 0.8) | blur(40px) |
| 内层 Model 控件 | 209x36 | **8px** | oklab(0.173 0 0 / 0.4) | blur(8px) |

→ 两层**圆角 32 → 8**，**blur 40 → 8**，**底色亮度 0.269 → 0.173（内层更暗）**。
> **实测结论**：Krea 的层级区分靠 ① 圆角大幅递减（32→8）② 模糊量递减（40→8）③ 亮度反向递减（容器亮、内嵌控件暗）。内嵌控件**比容器更暗**，这与「子项浮在容器上」的常规直觉相反——**推断**是刻意制造「凹陷感」。

### 5.4 侧边栏与控件尺寸（实测）
- 侧边栏项 `peer/menu-button`：**239x36，圆角 10px**（= --radius），padding: 8px，字号 14px
- 外层 `group/menu-item`：239x36，圆角 0px（纯包裹）
- 顶层容器 `flex flex-col gap-2 p-2`：**padding 8px，gap 8px**
- 实测控件高度词频：30 x286、40 x175、20 x115、22 x111、36 x54、32 x45、52 x42
  → **主力 30px 与 40px 双档**，36px 用于侧边栏
- 字号实测：16px x3270（压倒性主力）、12px x609、14px x477、24px x103
- 圆角实测：16px x140、8px x62、10px x19、6px x8、32px x3
  → **16px 是最高频圆角**（用于大卡片），10px 用于控件，8px 用于小控件

### 5.5 选中态 vs hover（实测）
实测 `flex min-w-0 flex-wrap gap-1` 组（5 项：Krea 2 Turbo / Style transfer / Moodboard / Lora / 2:3）：
- 其中 **Lora 是选中态**：background: oklab(1 0 0 / 0.05)、box-shadow 有值
- 其余 4 项：background: rgba(0,0,0,0)、box-shadow: none
- **全部文字都是 rgb(255,255,255)、fw 400**（选中不改字重/字色）

实测 Model 标签 vs 值：`Model`（标签）= oklab(1 0 0 / 0.6)；`Krea 2 Turbo`（值）= rgb(255,255,255)
→ **标签用 60% 不透明度，值用 100%**。这是标准的「label subtle / value strong」。

> **实测结论（Krea 的 state 策略）**：**选中 = 仅加 5% 白色底 + 阴影**，**完全不改文字颜色和字重**。这比即梦（改文字不透明度 + 底色）更克制。
> **推断**：Krea 把「文字亮度」留给「标签 vs 值」的区分，把「底色」留给「选中」的区分——**两个维度各司其职，不混用**。

### 5.6 毛玻璃（实测）
实测全站 backdrop-filter 只有两处：
1. blur(40px) 在 Prompt Box（851x118，32px 圆角，80% 不透明底）
2. blur(8px) 在 Model 选择器（209x36，8px 圆角，40% 不透明底）

→ **推断**：Krea 的毛玻璃严格限定在**「浮在画布/作品之上的输入区」**这一个场景。**没有任何顶栏、弹层滥用 backdrop-filter**。这是模范级的克制——**毛玻璃 = 输入框浮在作品之上**，仅此一处。

### 5.7 可测参数
- 圆角：**6 / 8 / 10 / 16 / 32px**（10px 是 shadcn --radius 基准）
- 控件高度：**20 / 22 / 30 / 32 / 36 / 40 / 52px**
- 字号：**12 / 14 / 16 / 18 / 24px**（16px 绝对主力）
- 字体：`"Suisse Intl", ui-sans-serif, system-ui, sans-serif`（**有自有品牌字体 Suisse Intl**）
- 间距：容器 p-2（**8px**），gap-1（**4px**）用于 chip 组，gap-2（**8px**）用于列表


---

## 6. Runway

- URL：https://runwayml.com/ ；实测跳转 https://runway.com/ ；应用 https://app.runwayml.com/

### 6.1 URL 证据
- https://runwayml.com/ → 实测落地 **https://runway.com/** —— **已读通（实测采样）**，标题「Runway | Building Real-World Intelligence」
- https://app.runwayml.com/ → 实测 https://app.runwayml.com/video-tools/teams/guest/ai-tools/generate —— **已读通（实测采样）**

### 6.2 模型选择器：**「图标 + 名称 + 描述语」三段式的最完整实现**
实测抓到结构 text-mYY23O / rowText-t46yw6，内容为**「名称 + 一句描述」**：

| 名称 | 描述语（实测原文） | 实测尺寸 |
|---|---|---|
| Seedance 2.5 | Generate cinematic videos with more references, ... | 221x72 |
| Aleph 2.0 | Edit videos using keyframes. | 221x52 |
| Characters | Build real-time conversational video agents. | 221x72 |
| Projects | Organize Sessions, Workflows and Assets in one place | 175x92 |
| GPT Image 2 | OpenAI's latest image generation model with up to... | 221x72 |
| Seedream 5.0 Pro | Reasoning image editing with layer control a... | 221x72 |
| Slide Maker | Describe a slide and generate a finished, on-bran... | 353x46 |
| Product Shot Video Builder | Turn a product photo into a polish... | 278x46 |
| Product Reshoot | Instantly change the setting, lighting, or th... | 396x46 |
| Create Ad | Create new ads for your brand or product. | 253x46 |
| Multi-Shot Video | Generate multi-shot videos from a single pro... | 299x46 |
| Upscale Video | Upscale video with Topaz AI. | 175x46 |

> **实测结论**：Runway 是 13 个产品中**唯一把模型做成「大行卡片 + 完整描述语」列表**的。且**描述语是产品化的一句话价值主张**（不是技术参数）。高度实测 **46px / 52px / 72px / 92px** 四档，说明行高随内容自适应。

### 6.3 层级与色彩（实测）
- 应用内底色：rgb(240,242,245) x22、rgb(222,228,236) x19、rgb(255,255,255) x9、rgb(232,234,240) x3
  → **浅灰蓝(240,242,245) 是主画布底，(222,228,236) 是次级面**。两者差值仅约 6%。
- 文字：rgb(0,0,0) x204、rgb(95,102,115) x125、rgb(255,255,255) x57、rgb(129,138,157) x13
  → **中性文字严格三档：黑 / #5F6673 / #818A9D**
- 品牌色实测：rgb(44,34,250) x2（**高饱和蓝紫**）+ rgb(226,136,46)（橙）

### 6.4 圆角与控件（实测）
- 圆角实测：8px x26、**100px x25**、12px x13、6px x11、20px x8、10px x3、4px x2
  → **8px（容器）与 100px（胶囊）双主导**，介于「方」与「圆」的二元体系
- 控件高度：32 x18、62 x17、24 x16、46 x16、20 x13、28 x13、34 x11、54 x7、40 x6
  → **32px 主力**，62px 是大的模型选择行
- 间距：gap: 8px x33、4px x32、12px x13、16px x8、2px x8
  → **4px 和 8px 是两大主力**（与即梦的 4/8 一致）
- 字体：官网 abcNormal；应用内 Normal, Inter, system-ui（**Inter 系**）

### 6.5 毛玻璃（实测）
- 应用内：blur(8px) | bg: rgba(255,255,255,0.2) | 圆角 100px x5 —— **胶囊浮起工具条**
- blur(4px) | bg: rgba(222,228,236,0.1) | 圆角 8px x1
- 官网：blur(12px) | bg: rgba(255,255,255,0.95) | r:0px、blur(8px) | bg: rgba(247,247,247,0.05) | r:4px/6px

> **推断**：Runway 应用内把毛玻璃用在**画布上的胶囊浮动工具条**（圆角 100px + 白色 20% + blur 8px）——这是**毛玻璃最正当的场景**：工具条浮在视频画面上，必须透出画面才能不遮挡创作内容。

---

## 7. Photoroom

- URL：https://www.photoroom.com/

### 7.1 URL 证据
- https://www.photoroom.com/ —— **已读通（实测采样）**，标题「AI-Powered Photo Editor and Listing Studio for Product Photography | Photoroom」
- https://www.photoroom.com/company —— **未读通（直接抓取失败）**

### 7.2 品牌色系统（实测）
实测底色：rgb(255,255,255) x31、**rgb(245,244,240) x29**、rgb(26,26,26) x10、rgb(98,110,255) x7、rgb(73,47,251) x6、rgb(65,12,217) x1
→ **Photoroom 实测有三个品牌紫**：#626EFF(98,110,255)、#492FFB(73,47,251)、#410CD9(65,12,217)。
→ 中性底是**暖白 #F5F4F0(245,244,240)**，不是冷灰——**这是 13 个产品中少见的暖色中性底**。

### 7.3 圆角与控件（实测）
- 圆角实测：**10px x105**、4px x70、6px x12、10px 10px 0 0 x5、0 0 10px 10px x5、9999px x2、8px x1、9px x1
  → **10px 是绝对主导圆角**（105 次），4px 是次级（用于小元素）
- 控件高度：18 x120、**48 x52**、50 x36、40 x32、26 x29、56 x29、22 x17、66 x16
  → **48px 是主力按钮高度**（比即梦 36、Vidu 40 都大，是「营销站大按钮」风格）
- 字号：16px x521、14px x202、20px x53、17px x48、42px x23、10px x7、24px x6
- 字体：**"TT Photoroom"** —— 自有品牌字体，明确点名产品

### 7.4 毛玻璃（实测）
- 仅 1 处：blur(12px) | bg: rgba(255,255,255,0.81) | 圆角 0px
  → **圆角 0 的毛玻璃**，用于**通栏顶栏**。
- 实测 --header-height: 5rem（**= 80px**）—— CSS 变量明确给出了顶栏高度。

> **推断**：Photoroom 用「通栏 + 81% 白 + blur(12px)」做吸顶导航，是**毛玻璃做顶栏**的标准用法（滚动时内容从下方透出）。圆角 0 说明它强调「通栏」而非「浮起」。

### 7.5 遮罩（实测）
实测底色含 rgba(0,0,0,0.05) x5 —— **只有 5% 黑**，未见重遮罩。**推断**：营销站未使用强 modal 遮罩。

---

## 8. Canva

- URL：https://www.canva.com/ ；中文实测 https://www.canva.com/zh_cn/

### 8.1 URL 证据
- https://www.canva.com/ → 实测 https://www.canva.com/zh_cn/ —— **已读通（实测采样）**，标题「Canva：人人都能使用的视觉办公套件」

### 8.2 圆角与控件（实测）
- 圆角实测：**12px x152**（绝对主导）、24px x26、10px x12、9999px x9、50% x3、4px x1、20px x1
  → **12px 是 Canva 的核心圆角**，24px 用于大卡片。
- 控件高度：**40 x177**（压倒性）、24 x75、32 x54、22 x37、17 x26、80 x24、48 x13、64 x10
  → **40px 主力控件高度**，80px 是大卡片。
- 字号：12px x945（**压倒性主力**）、14px x177、16px x105、32px x50、24px x15
  > **实测发现**：Canva 中文站的正文基准是 **12px**，不是 14px！12px 出现 945 次 vs 14px 177 次。
  > **推断**：Canva 面向大众非专业用户，UI 信息密度要求高（工具面板选项极多），因此采用更小的字号换取信息量。这与即梦/可灵（14px）形成鲜明对照。
- 字体："Noto Sans SC"（中文站）
- padding 实测：4px 12px x56、0 16px x32、0 0 0 24px x26、32px 32px 0 x24、0 8px x11

### 8.3 颜色语义（实测）
- 实测底色：rgba(15,16,21,0) x73、rgb(15,16,21) x44、rgba(255,255,255,0.898) x29、rgb(204,225,255)、rgb(139,61,255)
- 实测文字：rgb(0,0,0) x895、**rgb(15,16,21) x365**、rgb(255,255,255) x31、**rgb(139,61,255) x10**、rgba(16,18,25,0.698) x8、rgb(24,44,89) x5、rgb(151,41,255) x5
  → **品牌紫 #8B3DFF(139,61,255) 在文字上出现 10 次**，是主要彩色字。
  → 中性文字：#0F1015(15,16,21) 与 rgba(16,18,25,0.698)（**69.8% —— 与即梦完全相同的数值！**）
  → 另有 rgb(24,44,89) 深蓝（正文链接/强调）。

### 8.4 毛玻璃
- **实测：无任何 backdrop-filter 命中**。
> **实测结论**：Canva 首页**完全不用毛玻璃**。这是 13 个产品中明确「零毛玻璃」的两个之一（另一个是 Figma）。

---

## 9. Figma

- URL：https://www.figma.com/

### 9.1 URL 证据
- https://www.figma.com/ —— **已读通（实测采样）**，标题「Figma: The collaborative canvas for design, code, and AI」
- https://www.figma.com/blog/ —— **已读通**（博客索引页可访问）

### 9.2 圆角与形态（实测）
- 圆角实测：**9999px x16**、2px x15、24px x11、8px x5、50% x4、6px x4、16px x1
  → **胶囊 16 + 2px 15 的双极体系**，2px 极方！Figma 的**小控件用 2px 近乎直角**，大按钮用全胶囊。
  > **推断**：Figma 作为设计工具，其品牌语言刻意保留「工具感/精密感」——2px 圆角就是工程感的表达。
- 控件高度：32 x104（主力）、22 x97、20 x66、28 x61、24 x24、39 x19、48 x12
  → **32px 主力**，20-28px 密集（工具型紧凑 UI）
- 字号：20px x340、16px x251、18px x76、14px x74、48px x16、32px x13
  → **20px 最高频**（大字号营销文案），正文 16px
- 字体：**figmaSans**（自有品牌字体）

### 9.3 颜色（实测）
- 底色：rgb(0,0,0) x25、rgb(255,255,255) x13、rgba(255,255,255,0.24) x4、rgba(255,255,255,0.16) x4
- 文字：rgb(0,0,0) x498、rgb(255,255,255) x330、oklch(0 0 none / 0.54) x10、rgba(255,255,255,0.6) x5
  → **Figma 是黑白双极**：没有任何高饱和品牌色用于文字。**54% / 60% 是其次要文字**。
  > **实测结论**：Figma 首页**彩色文字几乎为零**，是「纯黑白 + 灰阶」的极致。彩色只出现在产品截图里。

### 9.4 毛玻璃
- **实测：无任何 backdrop-filter 命中**。
> **实测结论**：Figma 与 Canva 是本次调研中**明确零毛玻璃**的两者。

### 9.5 间距（实测）
- padding：0 20px 0 0 x15、6px x11、8px x10、0 0 0 16px x10、80px 0 x8、12px 22px x4
- gap：**2px x20**、24px x16、12px x7、16px x4、70px x4、8px x2
  → **gap: 2px 是最高频**！Figma 用极小间距做密集排布（导航项之间只隔 2px），这是**工具型 UI 的高密度特征**。


---

## 10. Linear

- URL：https://linear.app/

### 10.1 URL 证据
- https://linear.app/ —— **已读通（实测采样）**，标题「Linear – The system for product development」
- https://linear.app/method —— **已读通**（内容为 Linear Method 目录页）
- https://linear.app/docs —— **已读通**（文档索引）
- https://linear.app/brand —— **未读通（直接抓取失败）**

### 10.2 底色与文字（实测）
- body: background: rgb(8,9,10)（**#08090A，极深冷黑**）、color: rgb(247,248,248)（**#F7F8F8，非纯白**）
- 字体：`"Inter Variable", "SF Pro Display", -apple-system, ...`（**Inter Variable 可变字体**）
- 底色层实测：rgba(255,255,255,0.08) x36（**最高频！**）、rgb(15,16,17) x34、rgba(255,255,255,0.02) x9、rgb(8,9,10) x8、rgb(46,46,50) x5

> **实测关键**：Linear 的层级**完全靠 rgba(255,255,255,0.02 / 0.05 / 0.08) 三个白色 alpha 档**叠加在 #08090A 上。
> rgb(15,16,17) x34 是**不透明的第二层底**（比 #08090A 亮一点）。

### 10.3 阴影体系（实测，非常独特）
实测 box-shadow 高频：
- **rgba(0,0,0,0.2) 0 0 12px inset x7** —— **内阴影！**
- rgba(0,0,0,0.2) 0 0 0 1px x6 —— 1px 描边式阴影
- rgba(255,255,255,0.05) 0 0 0 1px inset x4 —— **白色 1px 内描边**
- rgba(0,0,0,0.25) 0 2px 32px x4 —— 浮层大阴影
- **rgba(255,255,255,0.08) 0 0 0 0.5px inset x4** —— **0.5px 白色内描边！**
- rgb(35,37,42) 0 0 0 1px inset x3
- 渐变阴影栈：rgba(0,0,0,0) 0 8px 2px, rgba(0,0,0,.01) 0 5px 2px, rgba(0,0,0,.04) 0 3px 2px, rgba(0,0,0,.07) 0 1px 1px, rgba(0,0,0,.08) 0 0 1px x2 —— **5 层渐进阴影**（著名的「平滑衰减阴影」）
- rgba(0,0,0,0.2) 0 0 0 2px x1（focus ring）

> **实测结论**：Linear 在暗色主题下**用「白色 inset 1px / 0.5px 描边」替代亮色主题的投影**——暗色下阴影不可见，改用内发光描边制造边缘。这是**暗色 UI 的关键技法**，实测有 0.5px 这种亚像素值，说明是精细调过的。

### 10.4 圆角与控件（实测）
- 圆角：0px x2652、**9999px x72**、50% x28、**8px x27**、12px x18、9px x18、4px x17、6px x10、12px 12px 0 0 x7、999px x7、16px x6
  → **主力 8px / 9px（！）/ 12px**。**9px 出现 18 次很特别**——不是常见的 8 或 10。
- 控件高度：**24 x146**、**28 x98**、17 x95、20 x73、18 x44、29 x40、16 x36、32 x31、48 x14
  → **主力 24px 与 28px**（**非常小！**）。Linear 是本次调研中**控件最紧凑**的产品。
  > **实测结论**：Linear 的主力控件高度 24/28px，而即梦是 36px、Canva 是 40px、Photoroom 是 48px。**Linear 代表「专业工具的高密度」极端**。
- 字号：16px x1882（主力）、14px x259、12px x254、13px x213、13.3333px x137、15px x74、10px x23
  → **正文 16px + 12/13/14px 密集辅助层**

### 10.5 毛玻璃（实测）
- 仅 **2 处**：blur(20px) | bg:rgba(0,0,0,0) | r:0px、blur(4px) | bg: rgba(255,255,255,0.05) | r:9999px
> **实测结论**：Linear 官网**几乎不用毛玻璃**（仅 2 处），且一处是 bg: transparent（无实质效果）。
> **推断**：这是重要反例——**Linear 以「材质感/精密感」著称，却不靠毛玻璃达成**，而是靠 inset 描边 + 多层阴影 + 极小的圆角/高度差。**毛玻璃不是高级感的必要条件。**

### 10.6 CSS 变量（实测）
实测 :root 只有 18 个变量，且**全部是可访问性辅助变量**（--toast-icon-margin-start 等）。**Linear 的 token 不暴露在 CSS 变量里**（很可能通过 CSS-in-JS 编译进 class）。
> **推断**：这本身是一条信息——Linear 用构建期 token，而非运行时 CSS 变量。

---

## 11. Vercel（Geist Design System）

- URL：https://vercel.com/ ；设计系统 https://vercel.com/geist/introduction

### 11.1 URL 证据（**本节来源最权威，官方设计系统文档**）
均**已读通**：
- https://vercel.com/geist/introduction —— 设计系统首页（实测采样，body #FFFFFF / text #171717 / 字体 Geist）
- https://vercel.com/geist/colors —— **已读通**，色彩系统
- https://vercel.com/geist/typography —— **已读通**，排版系统
- https://vercel.com/geist/materials —— **已读通**，材质/高度系统（核心）
- https://vercel.com/geist/modal —— **已读通**，Modal 用法
- https://vercel.com/geist/drawer —— **已读通**，Drawer 用法
- https://vercel.com/geist/select —— **已读通**，Select 用法
- https://vercel.com/geist/radius / spacing / buttons —— **已读通**（索引页）

### 11.2 间距系统（实测 CSS 变量，**官方定义**）
~~~css
--geist-space: 4px          /* 基准单位 = 4px */
--geist-space-2x: 8px
--geist-space-3x: 12px
--geist-space-4x: 16px
--geist-space-6x: 24px
--geist-space-8x: 32px
--geist-space-10x: 40px
--geist-space-16x: 64px
--geist-space-24x: 96px
--geist-space-32x: 128px
--geist-space-48x: 192px
--geist-space-64x: 256px

--geist-space-small: 32px    /* 控件高度 small */
--geist-space-medium: 36px   /* 控件高度 default */
--geist-space-large: 40px    /* 控件高度 large */

--geist-space-gap: 24px      /* 分区间距 */
--geist-space-gap-half: 12px
--geist-space-gap-quarter: 8px
--geist-page-width: 1200px
--geist-page-margin: 24px
~~~
> **实测结论（权威）**：Geist 的**基准间距单位是 4px**，「small/medium/large 控件高度 = 32/36/40px」**被写进了间距系统**（--geist-space-small/medium/large）。
> **这是「控件高度即间距 token」的经典做法**——高度和间距共用一套数字。

### 11.3 圆角（实测）
~~~css
--geist-radius: 6px              /* 基础圆角 */
--geist-marketing-radius: 8px    /* 营销场景 */
~~~
官方 Materials 文档定义的完整圆角阶梯（**已读通**）：

| Material 类型 | 圆角 | 语义 |
|---|---|---|
| material-base | **6px** | 日常，静止卡片 |
| material-small | **6px** | 轻微抬起 |
| material-medium | **12px** | 进一步抬起 |
| material-large | **12px** | 进一步抬起 |
| material-tooltip | **6px** | 最轻阴影，唯一带三角箭头 |
| material-menu | **12px** | 从页面浮起 |
| material-modal | **12px** | 进一步浮起 |
| material-fullscreen | **16px** | 最大浮起 |

官网实测圆角：6px x92、4px x4、30px x1、50% x4
→ **6px 是绝对主力**（与 --geist-radius: 6px 一致）

### 11.4 阴影 / 高度阶梯（实测 CSS 变量，**本次调研最有价值的发现之一**）
~~~css
/* 边框型阴影 */
--ds-shadow-border-base:    0 0 0 1px #00000014;
--ds-shadow-border-inset:   inset 0 0 0 1px #00000014;
--ds-shadow-background-border: 0 0 0 1px var(--ds-background-200);
--ds-shadow-border:         var(--ds-shadow-border-base), var(--ds-shadow-background-border);

/* 高度阶梯 */
--ds-shadow-2xs:    0px 1px 1px #0000000a;
--ds-shadow-xs:     0px 1px 2px #0000000a;
--ds-shadow-small:  0px 2px 2px #0000000a;
--ds-shadow-medium: 0px 2px 2px #0000000a, 0px 8px 8px -8px #0000000a;
--ds-shadow-large:  0px 2px 2px #0000000a, 0px 8px 16px -4px #0000000a;
--ds-shadow-xl:     0px 1px 1px #00000005, 0px 4px 8px -4px #0000000a, 0px 16px 24px -8px #0000000f;
--ds-shadow-2xl:    0px 1px 1px #00000005, 0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f;

/* 按浮层角色命名的阴影（层数递增！） */
--ds-shadow-tooltip:  border-base, 0 1px 1px #00000005, 0 4px 8px #0000000a, background-border;
--ds-shadow-menu:     border-base, 0 1px 1px #00000005, 0 4px 8px -4px #0000000a, 0 16px 24px -8px #0000000f, background-border;
--ds-shadow-modal:    border-base, 0 1px 1px #00000005, 0 8px 16px -4px #0000000a, 0 24px 32px -8px #0000000f, background-border;
--ds-shadow-fullscreen: border-base, 0 1px 1px #00000005, 0 8px 16px -4px #0000000a, 0 24px 32px -8px #0000000f, background-border;
--ds-shadow-modal-elevated: 0 0 0 1px #00000014, 0 32px 72px -12px #0000000f, 0 8px 32px -12px #00000014, 0 8px 24px -12px #0000001f;
~~~
> **实测结论（极高价值）**：Geist 的浮层阴影是**「边框 + 递增层数的投影」**结构：
> - tooltip = 边框 + **2 层**投影
> - menu = 边框 + **3 层**投影
> - modal = 边框 + **4 层**投影
> - **层数随浮层等级递增，且每层都带 --ds-shadow-border-base（0 0 0 1px #00000014）兜底描边。**
>
> **这是「用阴影层数编码高度等级」的教科书实现**。同时注意：**所有阴影 alpha 都极低（#0000000a 约 4%）**，靠叠加而非加深获得柔和感。

### 11.5 遮罩与 z-index 阶梯（实测 CSS 变量，**官方值**）
~~~css
--ds-overlay-backdrop-color: var(--ds-gray-100);   /* #f2f2f2 */
--ds-overlay-backdrop-opacity: .8;                 /* 遮罩不透明度 = 0.8 */

--ds-z-drawer: 200;
--ds-z-modal: 300;
--ds-z-menu: 2001;
--ds-z-toast: 5000;
--ds-z-tooltip: 99999;                              /* tooltip 最高！ */
~~~
> **实测结论（官方定义）**：
> - **遮罩不透明度官方值 = 0.8**，底色用 --ds-gray-100。
> - **z-index 阶梯：drawer(200) < modal(300) 远小于 menu(2001) < toast(5000) 远小于 tooltip(99999)**。
> - **tooltip 的 z-index 高于 modal**（99999 vs 300）—— 确保 modal 内的 tooltip 不被遮挡。这是极易踩坑的细节。

### 11.6 动效（实测 CSS 变量）
~~~css
--ds-motion-timing-swift: cubic-bezier(.175, .885, .32, 1.1);  /* 带 overshoot 的弹性曲线 */
--ds-motion-overlay-duration: .3s;
--ds-motion-overlay-scale: .96;          /* modal 入场从 96% 缩放 */
--ds-motion-popover-duration: .2s;       /* popover 比 overlay 快 */
~~~
> **实测结论**：**overlay（modal）300ms + scale .96 入场；popover 200ms**。popover 更轻更快，modal 更慢更重——**动效时长编码了「重量」**。

### 11.7 焦点环（实测）
~~~css
--ds-focus-ring: 0 0 0 2px var(--ds-background-100), 0 0 0 4px var(--ds-focus-color);  /* 双环 */
--ds-focus-ring-outline: 2px solid var(--ds-focus-color);
--ds-focus-border: 0 0 0 1px var(--ds-gray-alpha-600), 0px 0px 0px 4px #00000029;
--ds-focus-color: var(--ds-blue-700);
~~~

### 11.8 颜色系统（官方文档已读通）
官方 Colors 文档明确分组（**原文**）：
- **Backgrounds**：Background 1（默认元素底）/ Background 2（次要底，**「sparingly」慎用**）
- **Colors 1-3：Component Backgrounds** —— Color 1 默认底 / Color 2 Hover 底 / Color 3 Active 底
  > 官方原文：「If your UI component's default background is Background 1, you can use Color 1 as your hover background and Color 2 as your active background.」
  > **这是官方明确的「hover 与 active 用不同底色档位」规范。**
- **Colors 4-6：Borders** —— 默认边框 / Hover 边框 / Active 边框
- **Colors 7-8：High Contrast Backgrounds** —— 高对比底 + hover 高对比底
- **Colors 9-10：Text and Icons** —— 次要文字/图标（Color 9）、主文字（Color 10）
- 官方称共有 **10 条色阶**（Gray / Gray alpha / Blue / Red / Amber / Green / Teal / Purple / Pink + 背景），**支持 P3 广色域**。

官网实测色值：#fafafa(background-200)、#fff(background-100)、灰阶 #f2f2f2 / #ebebeb / #eaeaea / #8f8f8f / #4d4d4d / #171717
alpha 灰阶：#0000000d (5%) / #00000014 (8%) / #00000070 (44%) / #000000b3 (70%) / #000000e8 (91%)
> **实测结论**：--ds-gray-alpha-100 = #0000000d（**5%**）、--ds-gray-alpha-200 = #00000014（**8%**）。
> **注意：8% —— 与即梦、可灵的 rgba(255,255,255,0.08) 是同一个数值，只是方向相反（暗色用白 8%，亮色用黑 8%）。** 这是一个跨产品的收敛常数。

### 11.9 Modal / Drawer 的遮罩阶梯（官方文档原文，**已读通**）
> **Modal 文档原文**：「Use Modal when a decision must block the rest of the page. For persistent associated context where the underlying page stays readable, use **Sheet** on desktop or **Drawer** on mobile.」
> 「Confirm destructive actions in a Modal. **Drawer and Sheet don't fully dim the page, so they read as too soft for a delete or revoke.**」

> **Drawer 文档原文**：「**Drawer renders as a bottom sheet on small viewports only.** On desktop render Modal (or Sheet for lateral context) directly.」
> 「**Don't use Drawer to confirm destructive actions. The lack of a fully blocking dim weakens the severity signal** that delete and revoke flows need; route to Modal.」
> 「Tap-outside and swipe-down dismiss by default; preserve both unless the form has dirty input.」

> **实测/官方结论（极重要）**：Geist 明确把**遮罩强度当作语义信号**：
> - **Modal = 全阻断遮罩（0.8）= 高严重度（删除/撤销）**
> - **Drawer / Sheet = 不完全调暗 = 低严重度（浏览性内容）**
> - **「遮罩越黑 = 越严重」被写成了规范。**

### 11.10 Select / Segmented 用法（官方原文）
> 「Pick `<Select>` for short, fixed lists (**under ~10 items**) where typing adds nothing; switch to Combobox once filtering helps. Use MultiSelect when more than one value can be chosen at once; **use Switch for a 2-3 option segmented choice**. Group options past ~10 items with native `<optgroup>`.」

> **官方结论**：**2-3 个选项用 Switch（分段），少于 10 项用 Select，超过 10 项用 Combobox。** 这是清晰的「控件按选项数量选择」规范。

### 11.11 排版（官方文档已读通）
官方暴露的 typography class（**按尺寸 + 用途双轴命名**）：
- Headings：text-heading-72 / 64 / 56 / 48 / 40 / 32 / 24 / 20 / 16 / 14
- Buttons：text-button-16（最大）/ text-button-14（默认）/ **text-button-12（官方原文："Only used when a tiny button is placed inside an input field"）**
- Label：单行、宽松行高、配图标
- Copy：text-copy-16，配 `<strong>` 产生 **Subtle / Strong** 修饰
> **官方结论**：按钮字号有 16/14/12 三档，且 **12 号仅用于「输入框内的小按钮」**。

### 11.12 表单尺寸（实测 CSS 变量）
~~~css
--geist-form-small-height: 32px;   --geist-form-small-font: .875rem (14px);
--geist-form-height: 36px;         --geist-form-font: .875rem (14px);  line-height: 1.25rem (20px);
--geist-form-large-height: 40px;   --geist-form-large-font: 1rem (16px); line-height: 1.5rem (24px);
~~~
> **实测结论**：Geist 控件三档高度 **32 / 36 / 40px**，字号 **14 / 14 / 16px**。
> **注意 large 档：高度 40px 配 16px 字**（而 small/default 是 14px 字）。

### 11.13 颜色文字（实测，Vercel 官网）
实测 chromatic 色：rgb(0,98,209)（蓝）、rgb(142,78,198)（紫）、rgb(223,38,112)（品红）、rgb(218,47,53)（红）、rgb(255,153,10)（橙）、rgb(57,142,74)（绿）、rgb(13,140,125)（青）
→ **这 7 色一次性出现在首页，正是 Geist 色阶的展示**（Blue/Red/Amber/Green/Teal/Purple/Pink）。
实测主文字：rgb(23,23,23)（= --ds-gray-1000 #171717）


---

## 12. Notion

- URL：https://www.notion.so/ ；实测跳转 https://www.notion.com/

### 12.1 URL 证据
- https://www.notion.so/ → 实测落地 **https://www.notion.com/** —— **已读通（实测采样）**，标题「The AI workspace that works for you. | Notion」
- https://www.notion.com/help/category/design —— **已读通**（帮助中心页面可访问）

### 12.2 底色与文字（实测）
- body: background: rgb(255,255,255)、color: rgba(0,0,0,0.95)
- 实测文字：**rgba(0,0,0,0.898) x218**、rgba(0,0,0,0.95) x107、**rgba(0,0,0,0.75) x69**、rgb(255,255,255) x39、**rgba(0,0,0,0.54) x22**、rgb(0,0,0) x16
  → **Notion 的中性文字阶梯实测：95% / 89.8% / 75% / 54%**（+ 纯黑）
  > 注意 **89.8%** 这个值——与即梦/Canva 的 **69.8%** 同属「.698/.898」家族，**说明这些产品用的是同一类 alpha 刻度（0.9 / 0.7 / 0.5 系）**。
- 实测底色：rgba(0,0,0,0.75) x23（**这是遮罩！**）、rgb(255,255,255) x21、rgb(249,249,248) x7（暖白）、rgb(240,240,240) x3
  > **实测发现**：rgba(0,0,0,0.75) 出现 23 次 —— **Notion 的遮罩不透明度 = 0.75**（对比 Geist 的 0.8，非常接近）。

### 12.3 颜色语义（实测，**Notion 是彩色字用得最明确的产品之一**）
- 品牌色：rgb(0,117,222) x9（Notion 蓝）、rgb(9,127,232) x5、rgb(230,243,254) x2（浅蓝底）
- 状态/强调：rgb(255,177,16) x2（黄）、rgb(0,0,0) x3
> **实测结论**：Notion 的彩色字是 **#0075DD / #097FE8 系蓝**，配 #E6F3FE 浅蓝底（**「彩色字 + 同色系浅底」的 badge 组合**）。

### 12.4 圆角与控件（实测）
- 圆角：**8px x64**、12px x17、4px x10、9999.01px x7、8px 8px 0 0 x3、16px x2、12px 12px 0 0 x2
  → **8px 绝对主导**，12px 次之（大卡片），4px（小标签），9999px（胶囊）
  > 9999.01px 这个怪异值说明是 border-radius: 9999px 经计算后的产物。
- 控件高度：**24 x76**、26 x62、20 x50、36 x26、40 x13、30 x11、28 x10
  → **主力 24-26px**（紧凑），36/40px 用于主按钮
- 字号：16px x379、14px x71、12px x21、20px x12、40px x10、22px x9
- 字体：**NotionInter**（Notion 定制版 Inter）
- padding 实测：3px 16px 3px 8px x34、6px 15px x16、6px 8px x9、5px 10px x8
  > **3px 16px 3px 8px 这种非对称 padding（左 8 右 16）是 Notion 特征**——因为右侧要给快捷键提示留位。
- gap 实测：8px x34、0px 8px x31、12px x20、16px x14、24px x7、4px x4

### 12.5 毛玻璃
- 实测仅 1 处：blur(0px) | bg: rgb(240,240,240) | r: 0%
> **实测结论**：**blur(0px) = 无实际模糊**，Notion 首页实质无毛玻璃。

---

## 13. 剪映 CapCut

- URL：https://www.capcut.cn/ （国内站）；国际站 capcut.com

### 13.1 URL 证据
- https://www.capcut.cn/ —— **已读通（实测采样）**，标题「剪映官网-剪映AI 创作无限新可能」

### 13.2 品牌色与底色（实测）
- body: background: rgb(0,0,0)、font-family: "Noto Sans SC"
- 实测底色：rgb(0,0,0) x8、rgba(255,255,255,0.16) x5、**rgb(0,202,224) x3（剪映青！）**、rgba(0,198,224,0.3) x1、rgba(255,255,255,0.05) x1、rgb(12,18,26) x1、**rgba(43,43,43,0.6) x1**
- 实测文字：rgb(0,0,0) x126、rgb(255,255,255) x40、rgba(255,255,255,0.5) x19、rgba(255,255,255,0.8) x15、**rgb(0,202,224) x4（品牌青字）**、rgba(255,255,255,0.6) x3、rgb(44,234,255) x2
> **实测结论**：剪映品牌色 **#00CAE0(0,202,224)**，并有亮色变体 rgb(44,234,255)。
> 中性文字阶梯：**100% / 80% / 60% / 50%**（4 档，与即梦同样克制）。
> **彩色字出现 4-6 次 vs 白色 40 次**，彩色比例很低。

### 13.3 圆角（实测，**剪映是「大圆角」派**）
- 圆角实测：**28px x20**、10px x5、**70.733px x3**、12px x2、58px x2、6px 6px 6px 0 x1、8px x1、66px x1
  → **主力 28px**（20 次），另有 58/66/70.733px 超大圆角（药丸型按钮）。
  > 70.733px 这种非整数说明是响应式计算出的全圆角。
  > **实测对比**：剪映 28px vs 即梦 8/12px vs Canva 12px —— **剪映的圆角明显更大更「软」**。

### 13.4 毛玻璃（实测）
- blur(9.01857px) | bg: rgba(255,255,255,0.16) | 圆角 10px x5
- blur(12px) | bg: rgba(0,0,0,0) | 圆角 70.733px x3
- blur(14px) | bg: rgba(43,43,43,0.6) | 圆角 66px x1
> **实测结论**：剪映的毛玻璃出现在**药丸浮起控件**上（rgba(255,255,255,0.16) + blur 9px + 10px 圆角；以及 rgba(43,43,43,0.6) + blur 14px + 66px 圆角）。
> **推断**：与 Midjourney 同类——**毛玻璃用于浮在视频画面上的胶囊控件**，是正当用法。

### 13.5 间距与控件（实测）
- padding：**18px 28px x6**、32px x6、100px 160px x5、10px x5、16px x5、10px 16px x2
  → **18px 28px 是按钮 padding（配合 28px 圆角）**
- gap：10px x17、8px x11、4px x6、68px x5、28px x3、16px x2
- 控件高度：20 x32、22 x29、58 x6、39 x5、25 x4、40 x3、62 x3、72 x3
  → **58px / 62px / 72px 大按钮**（营销站风格）
- 字号：16px x141、14px x44、18px x13、56px x4、68px x1

### 13.6 与即梦的关系（实测交叉验证）
- 即梦实测字体栈为 `"CapCut Sans", "PingFang SC", ...` —— **即梦使用 CapCut Sans**，确认同属字节/剪映设计体系。
- 但**圆角策略不同**：即梦 8/12px（方正紧凑）vs 剪映 28/66/70px（大圆角）。**推断**：即梦是「工作台」，剪映官网是「营销落地页」，两者受众场景不同。

---

# 横向共性规律：13 个产品共同的 10 条做法

> 以下每条都标注了**支撑该结论的实测证据**，不是空泛总结。

### 规律 1：中性底色的「8% 白 / 8% 黑」是一个跨产品收敛常数
- **实测**：即梦 rgba(255,255,255,0.08)（x103，最高频）、可灵 rgba(255,255,255,0.08)、Linear rgba(255,255,255,0.08)（x36，最高频）、Vidu rgba(255,255,255,0.08)、Vercel --ds-gray-alpha-200: #00000014（= **8%** 黑）、Krea oklab(1 0 0 / 0.05)
- **规律**：暗色主题用「白色 8%」叠加、亮色主题用「黑色 8%」叠加，作为**「次级面/选中态/悬浮态」的通用填充**。这是跨产品、跨明暗主题的**同一数值**。

### 规律 2：文字层级靠「不透明度阶梯」而非「颜色变化」，且档位越少越稳
- **实测**：即梦 4 档（1.0 / 0.698 / 0.6 / 0.35）、剪映 4 档（1.0 / 0.8 / 0.6 / 0.5）、Notion 4 档（0.95 / 0.898 / 0.75 / 0.54）、Canva 也出现 0.698
- **反例实测**：Vidu 有 9+ 档（0.16/0.4/0.48/0.5/0.6/0.64/0.7/0.8/1.0）——档位明显更多
- **规律**：成熟产品把中性文字收敛到 **4 档以内**，且**大量复用 0.7 / 0.6 / 0.5 这几个刻度**。

### 规律 3：hover 只动「底色/边框」，selected 才动「文字 + 持久底色」
- **实测（即梦导航）**：未选 = bg transparent + color 100%；选中 = bg rgba(255,255,255,0.08) + color 100% + fw 500
- **实测（即梦 Tab）**：未选 = bg transparent + color 0.698；选中 = bg rgba(255,255,255,0.04) + color 1.0
- **实测（Krea）**：选中 = bg oklab(1 0 0/0.05) + 阴影，**文字完全不变**
- **官方（Vercel Geist Colors 文档原文）**：Color 1 = 默认底 / Color 2 = Hover 底 / Color 3 = Active 底 —— **三档底色分别对应三个状态**
- **规律**：**hover 是一次性的、浅的、不改变文字权重的；selected 是持久的、稍深的、并提升文字对比度（或至少不降低）**。Krea 甚至更严格——**底色管选中、文字亮度管「标签 vs 值」，两个维度不混用**。

### 规律 4：浮层圆角 > 内层圆角，且阴影/模糊「不叠加」
- **实测（即梦）**：settings-sub-menu-card 12px → settings-sub-menu-item 8px；容器阴影 0 8px 56px rgba(0,0,0,.24)，**内层一律 none**
- **实测（Krea）**：Promptbox **32px** → Model 选择器 **8px**；blur **40px → 8px**
- **官方（Vercel Materials 原文）**：「**Don't stack two Materials on the same element; if a child needs more elevation, lift it into its own Material with a higher type.**」
- **规律**：**圆角由外向内递减**（视觉同心圆），**阴影与模糊只给最外层浮起物**，内层靠 padding + 圆角产生层次。

### 规律 5：浮层高度用「阴影层数 / 模糊量」编码，而不是「阴影变得更黑」
- **实测（Vercel，官方 token）**：tooltip = 边框 + **2 层**投影；menu = 边框 + **3 层**；modal = 边框 + **4 层**；且所有投影 alpha 都不超过 #0000000f（**6%**）
- **实测（Krea）**：外层 blur(40px) → 内层 blur(8px)
- **规律**：**「越高 = 层数越多 / 模糊越大」，而不是「越高 = 越黑」**。阴影保持极低 alpha，靠叠加获得柔和与层次。

### 规律 6：遮罩强度是「严重度语义」，不是纯视觉
- **官方（Vercel Modal/Drawer 文档原文）**：「Confirm destructive actions in a Modal. **Drawer and Sheet don't fully dim the page, so they read as too soft for a delete or revoke.**」「**The lack of a fully blocking dim weakens the severity signal**」
- **官方（Vercel token）**：--ds-overlay-backdrop-opacity: .8
- **实测（Notion）**：遮罩 rgba(0,0,0,0.75)（x23）
- **规律**：**Modal 遮罩约 0.75-0.8（全阻断 = 高严重度）；Drawer/Sheet 弱遮罩（低严重度）**。遮罩透明度被当成「打断用户的程度」来表达。

### 规律 7：z-index 阶梯把 tooltip 放在最高（高于 modal）
- **实测（Vercel token）**：--ds-z-drawer: 200 小于 --ds-z-modal: 300 远小于 --ds-z-menu: 2001 小于 --ds-z-toast: 5000 远小于 **--ds-z-tooltip: 99999**
- **实测（可灵，Element Plus）**：--el-index-normal: 1 / --el-index-top: 1000 / --el-index-popper: 2000
- **规律**：**tooltip 必须能浮在 modal 之上**（因为 modal 里也有 tooltip）。这是极易被忽略但所有严肃设计系统都会处理的细节。

### 规律 8：控件高度集中在 32-40px，且「控件高度」与「间距」共用一套数字
- **实测**：Vercel **32/36/40px**（官方 --geist-form-small/default/large-height）、即梦 **36px**（x108，主力）、Krea **30/40px** + 36px（侧边栏）、Canva **40px**（x177）、Runway **32px**、Vidu **40px**、Midjourney **42px**
- **反例实测**：Linear **24/28px**（x146/x98，最紧凑）、Notion **24/26px**
- **官方（Vercel）**：--geist-space-small: 32px / medium: 36px / large: 40px 被定义在**间距系统里**，基准单位 --geist-space: 4px
- **规律**：**基准间距 4px**，控件高度 **32/36/40** 三档，且**高度值直接复用间距 token**。专业工具型（Linear/Notion）会压到 24-28px。

### 规律 9：彩色字严格限制在「商业/状态」语义，功能文字一律中性
- **实测（即梦，最有说服力）**：彩色字 rgb(0,158,250) 仅用于 开会员 / 积分 / Beta / New；橙色 rgb(255,146,48) 仅用于 Hot。**彩色 31 次 vs 白色 1157 次 约 2.4%**
- **实测（剪映）**：品牌青 rgb(0,202,224) 6 次 vs 白 40 次
- **实测（Notion）**：品牌蓝 #0075DD + 浅蓝底 #E6F3FE 组成 badge（**同色系字 + 浅底**）
- **实测（Figma）**：rgb(0,0,0) x498 / rgb(255,255,255) x330，**彩色文字几乎为零**
- **规律**：**彩色 = 商业利益点（会员/New/Hot）、状态（成功/错误）、品牌标识**；**功能与导航文字必须中性**。彩色占比普遍在 5% 以下。

### 规律 10：毛玻璃只用于「浮在内容/画布之上」的场景，且「不用毛玻璃也能显得高级」
- **实测（Krea，最克制）**：全站只有 2 处 backdrop-filter —— Promptbox（blur(40px)，浮在作品上）+ Model 选择器（blur(8px)）
- **实测（Runway）**：blur(8px) + rgba(255,255,255,0.2) + 100px 圆角 —— 画布上的胶囊工具条
- **实测（Midjourney）**：全部 blur(12px) + 20% 彩色底 + 9999px 圆角 —— 画廊上的多彩玻璃药丸
- **实测（剪映）**：blur(9/12/14px) —— 视频画面上的药丸控件
- **实测（Photoroom）**：blur(12px) + 81% 白 + 圆角 0 —— **通栏吸顶顶栏**
- **实测（Canva / Figma / Notion）**：**零有效毛玻璃**（Notion 只有 blur(0px)）
- **规律**：**正当场景只有两类** —— ① 浮在画布/作品之上的工具条与输入框（必须透出下方内容）；② 通栏吸顶顶栏（滚动时内容透出）。**滥用信号**：blur() 作用在 transparent 或极低 alpha 底上（即梦实测有 blur(80px) + bg transparent x2）、给静态卡片加模糊、在同一元素叠加多层 blur。**Canva 与 Figma 两个顶级设计产品零毛玻璃**，证明毛玻璃不是「高级感」的必要条件。


---

## 附录 A：实测数据速查表（全部为线上实测值）

| 产品 | 底 body | 主文字 | 主力圆角 | 主力控件高 | 主力字号 | 字体 | 毛玻璃 |
|---|---|---|---|---|---|---|---|
| 即梦 | 深色(透明层叠) | #FFF / 0.698 | 8 / 12px | **36px** | 14 / 12 / 9px | CapCut Sans | 有(6 处) |
| 可灵 | #000 | #F9FBFC / #B6BBC2 | 8 / 12px | 20/24/28/32px | 14 / 12px | 系统栈 | 有(2 处) |
| Vidu | #020B13 | #FFF / 0.6 | **9999px** | 40px | 16px | 系统栈 | 有(2 处) |
| Midjourney | #06051D 系 | oklch(0.869…) | **9999px / 8px** | 42px | 16px | DM Sans | 有(7+ 处) |
| Krea | #101010 | oklch(0.985 0 0) | 10 / 16px | 30 / 40px | 16px | Suisse Intl | 有(2 处) |
| Runway | #F0F2F5 | #000 / #5F6673 | 8 / 100px | 32px | 16 / 14px | Inter | 有(6 处) |
| Photoroom | #FFF / #F5F4F0 | #000 | **10px** | 48px | 16 / 14px | TT Photoroom | 有(1 处) |
| Canva | #0F1015 / #FFF | #0F1015 / 0.698 | **12px** | **40px** | **12px** | Noto Sans SC | **无** |
| Figma | 黑白双极 | #000 / #FFF | 9999 / **2px** | 32px | 20 / 16px | figmaSans | **无** |
| Linear | #08090A | #F7F8F8 | 8 / 9 / 12px | **24 / 28px** | 16px | Inter Variable | 几无(2 处) |
| Vercel | #FFF | #171717 | **6px** | **32/36/40px** | 14 / 16px | Geist | 无 |
| Notion | #FFF | rgba(0,0,0,0.898) | **8px** | 24 / 26px | 16px | NotionInter | 无(blur 0px) |
| 剪映 | #000 | #FFF | **28px** | 58 / 62px | 16px | Noto Sans SC | 有(3 处) |

## 附录 B：本次调研信息源清单（含可读性状态）

**已读通（实测采样，CDP getComputedStyle）**
- https://jimeng.jianying.com/ai-tool/home
- https://jimeng.jianying.com/ai-tool/generate
- https://klingai.com/
- https://kling.ai/
- https://www.vidu.cn/
- https://www.midjourney.com/home
- https://www.krea.ai/
- https://www.krea.ai/image
- https://runway.com/
- https://app.runwayml.com/video-tools/teams/guest/ai-tools/generate
- https://www.photoroom.com/
- https://www.canva.com/zh_cn/
- https://www.figma.com/
- https://linear.app/
- https://vercel.com/geist/introduction
- https://www.notion.com/
- https://www.capcut.cn/

**已读通（内容抓取，设计系统 / 官方文档）**
- https://vercel.com/geist/colors （核心）
- https://vercel.com/geist/typography （核心）
- https://vercel.com/geist/materials （核心：高度阶梯权威定义）
- https://vercel.com/geist/modal （核心：遮罩严重度规范）
- https://vercel.com/geist/drawer （核心）
- https://vercel.com/geist/select （核心：控件选择规范）
- https://vercel.com/geist/radius
- https://vercel.com/geist/spacing
- https://vercel.com/geist/buttons
- https://linear.app/method
- https://linear.app/docs
- https://www.figma.com/blog/
- https://www.notion.com/help/category/design
- https://www.midjourney.com/updates

**未读通（已在正文标注，未使用其内容）**
- https://www.krea.ai/blog —— 直接抓取失败
- https://www.photoroom.com/company —— 直接抓取失败
- https://linear.app/brand —— 直接抓取失败
- **搜索引擎通道（modsearch / firecrawl）本次全程 403 失败**，故本报告**未使用任何搜索摘要**，全部结论来自直连页面实测。

**未获取（如实说明）**
- 各产品的 Figma 设计系统源文件、内部 token 文档 —— 不公开。
- 可灵 / Vidu / 即梦的官方设计系统文档 —— 本次未检索到公开地址（搜索通道不可用，无法进一步查找）。
- Dribbble / Medium 上的第三方拆解文章 —— 因搜索通道不可用，**本次未引用任何此类二手来源**，所有数据均为一手实测。
