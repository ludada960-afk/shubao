# 31 · 薯包AI 现状 UI 审计（只读盘点）

> 审计范围：`src/pages/Home/**`、`src/pages/EcCanvas/**`、`src/pages/EcStudio/**`（精修工坊/视频）、`src/pages/{Gallery,Works,Pricing,Remake,Plog,Generate}/**`、`src/App.jsx` 外壳、`src/components/**` 公共件。
> 方式：逐文件读源码 + 全量脚本统计。**本次未修改任何 src 代码**，未 commit。
> 基准：`src/styles/design-tokens.css`（“暖白轻奢 V2”，`--bg:#F5EFE4`、`--accent:#0C0A09`）。

结论先行：**项目里同时存在 5 套互相冲突的视觉体系**，这才是老板说“全是黑白极简 / 没有视觉语言 / 间距主次没调好”的根因——不是单纯“颜色少”，而是**没有统一的设计语言被真正执行**。

---

## 0. 五套并存的设计体系（根因）

| 体系 | 主色 | 圆角语言 | 代表文件 | 使用范围 |
|---|---|---|---|---|
| **A 灵图暖白系**（design-tokens.css） | `#0C0A09` 近黑 + `#F5EFE4` 暖白 | 30/40px 超大圆角、9999px 胶囊 | `design-tokens.css`、`Navbar.jsx`、`App.jsx`、`Pricing`、`Home/index.jsx`、`Gallery`、`Works`、`components/ui/*` | 外壳 + 少数页 |
| **B 紫粉渐变系** | `#7c3aed` / `#ec4899` / `#f59e0b` | 8–20px 常规圆角 | `EcMode.jsx`、`ec/*.jsx`、`DesignDirection.jsx`、`EcCanvas/index.jsx`、`Remake`、`XhsContentMode.jsx` | 电商主流程 |
| **C Indigo 靛蓝系** | `#6366F1` / `#4338CA` / `#EEF2FF` | 6–14px 小圆角 | `Home.css`（ec-form 段）、`EcStudio/index.jsx`、`NoteModal.jsx`、`components/business/Modals.jsx` | 精修工坊 + 旧版表单 + 弹窗 |
| **D 纯黑白系** | `#1a1a1a` / `#333` / `#fff` / 灰阶 | 4–25px 混乱 | `Home/index.jsx` 模式切换、`Plog/index.jsx`、`EcCanvas` 工具条 | Plog 全站、画布工具条 |
| **E 红色系** | `#e84142` / `#FF4757` / `var(--red)` | 混合 | `Home.css` hero/模式标签、`XhsContentMode`、`Works`、`components/ui/Button.jsx` | 小红书模式遗留 |

**同一个“生成”动作，在同一个产品里出现了 5 种品牌色**：近黑 `#0C0A09`、紫 `#7c3aed`、靛蓝 `#4338CA`、绿色 `#059669`、红 `#e84142`。

---

## 1. 关键界面控件表

### 1.1 首页 `src/pages/Home/index.jsx`（外壳/标题/模式切换）

| 控件名 | 文件:行 | 背景色/文字色/边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 阴影 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| 主模式切换容器 | index.jsx:55 | `rgba(0,0,0,0.04)` / — / 无 · **硬编码** | — | auto | 5 | `30` **硬编码** | `inset 0 1px 3px rgba(0,0,0,0.06)` **硬编码** | 无 | 无 | 圆角 30 与 `--radius-lg` 数值巧合相同但写法不同，改 token 不影响它 |
| 模式按钮·电商生图 | index.jsx:56-71 | `#1a1a1a` / `#fff` / none · **硬编码** | 15 / 700 | auto（padding 11px 28px ≈ 41px） | `11px 28px` | `25` 硬编码 | `inset 0 2px 6px rgba(0,0,0,0.25)` | hover（仅未选中时 inline 改色）· **无 focus/active** | 无 | 3 处硬编码色，纯黑白，与 `--accent:#0C0A09` 不是同一个黑 |
| 模式按钮·小红书图文 | index.jsx:72-87 | 同上 | 15 / 700 | 同上 | `11px 28px` | `25` | 同上 | 同上 | 无 | 与上一按钮完全重复代码，未组件化 |
| 顶部徽标 pill | index.jsx:37 | `rgba(255,255,255,0.75)` / `var(--text-secondary)` / `var(--border)` | 13 / 900 | auto | `8px 16px` | `var(--radius-full)` | `var(--shadow-sm)` | 无 | 无 | **fontWeight 900 用在 13px 正文**，与全局 `--weight-*` 体系脱节 |
| 主标题 H1 | index.jsx:42 | 透明 / `var(--accent)` | 38→62（媒体查询）/ 900 | — | — | — | — | 无 | — | 900 字重 + 硬编码渐变文字，与暖白体系冲突 |
| 渐变文字 | design-tokens.css:286 | `linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)` · **硬编码** | — | — | — | — | — | — | — | 品牌主色实际是紫粉橙，与 `--accent:#0C0A09` 无关 |
| 表面卡 surface-card | design-tokens.css:293 | `#fff` / — / 无 | — | — | 0 | `var(--radius-lg)` 30px | `0 28px 90px rgba(57,45,26,0.14)` **硬编码**（重复 `--shadow-xl`） | 无 | 有（内层 `surface-card-inner` 26px） | 外层 30px 内层 26px，**嵌套圆角不成比例**（应为 30-8=22） |

### 1.2 首页 · 电商配置弹层（EcMode 的 6 个浮层面板）

面板统一容器：`EcMode.jsx:46-54` `GLASS_PANEL` = `rgba(255,255,255,0.85)` + `blur(40px) saturate(220%)` + `radius 20` + `border rgba(255,255,255,0.7)` + 4 层阴影。

| 控件名 | 文件:行 | 背景色/文字色/边框色 | 字号/字重 | 高度 | 内边距 | 圆角 | 阴影 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| 功能按钮 ×6 | EcMode.jsx:33-43 `BTN_BASE` | `rgba(255,255,255,0.8)` / `var(--text-secondary)` / `1.5px transparent` | 13 / 600 | **40** | `0 18px` | `20` 硬编码 | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` | hover + open + overridden | 无 | 40px 与“下一步”38px 混用；胶囊 20 与 EcStudio 的 8px 冲突 |
| 下一步按钮 | EcMode.jsx:819-834 | 渐变 `#7c3aed→#ec4899→#f59e0b` / `#fff` / none | 13 / 700 | **38** | `0 22px` | **12** | `0 4px 16px rgba(124,58,237,0.3)` | hover（scale 1.02）+ disabled（`#e5e5e5`/`#aaa`）· **无 focus** | 无 | 同一按钮行 40px 与 38px 混用 |
| 步骤指示器 | EcMode.jsx:405-487 | 渐变 / 白 / `1px rgba(0,0,0,0.06)` | 13+10 / 700 | auto | `10px 16px` | 12 | 无 | active/completed 三态 | 有（数字圈+文字） | 全站唯一有层级的组件，但与 token 完全脱节 |
| 产品图上传卡 | EcMode.jsx:500-570 | `#fff` / `#1a1a1a` / **`2px solid var(--red)`** | 12 / 700 | minHeight 110 | `14px 12px` | 16 | `0 6px 32px rgba(255,71,87,0.18)` | hover 改 boxShadow | 有 | 红边框与同页紫渐变按钮形成红紫冲突 |
| 参考图上传卡 | EcMode.jsx:591-661 | `#fff` / `#1a1a1a` / `2px solid var(--blue)` | 12 / 700 | minHeight 110 | `14px 12px` | 16 | `0 6px 32px rgba(102,126,234,0.18)` | hover | 有 | 红蓝撞色；`--blue:#5275CC` 与阴影里的 `rgba(102,126,234)` **不是同一个蓝** |
| 乘号分隔圆 | EcMode.jsx:580-586 | 渐变 `#7c3aed→#ec4899` / `#fff` | 14 / 800 | 28 | — | `50%` | `0 2px 8px rgba(124,58,237,0.3)` | 无 | 无 | 纯装饰，引入第 3 种品牌色 |
| 缩略图删除键 | EcMode.jsx:533-539 | **`#FF3B5C`** / `#fff` / `2px #fff` | 11 / 700 | 18 | — | 50% | 无 | 无 | 有 | `#FF3B5C` 是全站第 6 种红 |
| 描述输入区 | EcMode.jsx:668 → Home.css:103 | `#fff` / `var(--text-primary)` / `2px solid var(--border)` | 16 / 400 | minHeight 100 | `14px 16px` | `var(--radius-lg)` 30px | 有 **`inputGlow` 持续脉冲动画** | `:focus-within` 变红边框 | 无 | 输入框一直在呼吸闪烁，廉价感主要来源 |
### 1.3 首页 · ec/ 六个面板

| 面板/控件 | 文件:行 | 背景/文字/边框 | 字号·字重 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|
| GenSettingsPanel · 分辨率卡 `cardBase` | GenSettingsPanel.jsx:17-21 | `#fff` / `var(--text-primary)` / `1.5px solid rgba(0,0,0,0.08)` · **全硬编码** | 12/700 · 10/400 | hover 仅改紫 borderColor；selected 紫边框+紫渐变底+`0 2px 8px rgba(124,58,237,0.12)`；**无 focus/active** | 有（色块+两行文字） | 13 处硬编码 hex，完全不使用 token |
| GenSettingsPanel · 负向提示词 input | GenSettingsPanel.jsx:128-137 | `rgba(0,0,0,0.03)` / `var(--text-primary)` / `1px rgba(0,0,0,0.12)` | 12 | **无任何状态**（无 focus 视觉） | 无 | 与 ParamsPanel 字号 12 vs 13 不一致 |
| ParamsPanel · 输入框 `inp` | ParamsPanel.jsx:7-11 | `rgba(0,0,0,0.03)` / `var(--text-primary)` / `1px rgba(0,0,0,0.12)` | 13 | 无 focus 态 | 有（品类下拉） | 与 GenSettingsPanel 同为 height 36 但字号 12/13 不一致 |
| ParamsPanel · 品类下拉 | ParamsPanel.jsx:64-83 | `#fff` / — / `1px rgba(0,0,0,0.08)` | 11 | 无 hover；选中 `#1a1a1a` | 有 | 阴影 `0 8px 30px rgba(0,0,0,0.1)` 与 SizingPanel 的 `0 8px 24px rgba(0,0,0,0.14)` 不一致 |
| CopyPanel · textarea | CopyPanel.jsx:7-12 | `rgba(0,0,0,0.025)` / var / **`1.5px solid rgba(0,0,0,0.10)`** | 12 | focus 改紫边框（inline JS） | 无 | 边框 1.5px vs ParamsPanel 1px；圆角 8 vs 其余 10/12 |
| SizingPanel · 平台 pill | SizingPanel.jsx:231-249 | 选中 `#1a1a1a`/`#fff`，未选 `rgba(0,0,0,0.03)` / var / `1.5px` | 12 / 600 | hover 改背景 | 无 | 纯黑白选中态，与 EcPlatformPicker.jsx:46 同功能不同语言 |
| SizingPanel · 图片类型行 | SizingPanel.jsx:262-318 | checked `rgba(0,0,0,0.03)` / — / `1.5px rgba(0,0,0,0.1)` | 12/600 · 10/400 | checked 有；**未勾选只靠 `opacity:0.35 + pointerEvents:none`** | 有（勾选框+图标+两行+数量+比例） | 用 opacity 表达禁用语义弱，且**无 hover** |
| SizingPanel · 数量 input | SizingPanel.jsx:299-310 | `#fff` / var / `1px rgba(0,0,0,0.12)` | 12 / 600 | disabled 有（灰底+not-allowed） | 无 | 高度 26 与 SkuPanel 的 32/28 不一致 |
| SizingPanel · 比例下拉面板 | SizingPanel.jsx:76-104 | `rgba(255,255,255,0.97)`+blur16 / — / `1px rgba(0,0,0,0.10)` | 11/700 · 10 · 9 | hover 行背景；selected 紫 8% | 有（3 列网格） | **三层字号 11/10/9 挤在 160px 宽格里**，“主次没调好”的典型 |
| SkuPanel · 变体卡 | SkuPanel.jsx:62-68 | `rgba(0,0,0,0.03)` / — / `1px rgba(0,0,0,0.06)` | — | **disabled 用 `opacity:0.5 + pointerEvents:none`** | 有（4 列输入+数量行） | 全站唯一卡中卡结构，圆角 12 与其它面板不一致 |
| SkuPanel · 删除 | SkuPanel.jsx:72-80 | transparent / **`#e74c3c`** / none | 11 / 600 | hover 红 10% 背景 | 无 | `#e74c3c` 是全站第 6 种红 |
| StylePanel · 风格卡 | StylePanel.jsx:114-144 | active `#1a1a1a`/`#fff`，idle `rgba(0,0,0,0.03)` | 11/600 · 9/500 | hover 改背景；active 反色 | 有（渐变色条+标签+色调行） | **9px 字号**低于可读下限 |
| StylePanel · 品牌色开关 | StylePanel.jsx:170-181 | `#7c3aed` / `rgba(0,0,0,0.12)` | — | 有开关态 | 有 | 开关 36×20 项目内无统一规范 |

### 1.4 画布 `src/pages/EcCanvas/index.jsx`

| 控件名 | 文件:行 | 背景/文字/边框 | 字号·字重 | 高度 | 内边距 | 圆角 | 阴影 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| 页面底色 | index.jsx:548 | **`#F0EEE9`** 硬编码 | — | — | — | — | — | — | — | 与 `--bg:#F5EFE4` 不同，进画布明显跳色 |
| 顶部工具栏 | index.jsx:550 | `rgba(255,255,255,0.9)` / — / `1px rgba(0,0,0,0.07)` | — | **52** | `0 16px 0 72px` | 0 | 无 | 无 | 无 | 高度 52 与 Navbar 72 / TopBar 无高，三套导航高度 |
| 返回按钮 | index.jsx:551 | `rgba(0,0,0,0.05)` / `#666` | — | 32 | — | 8 | 无 | **无 hover** | 无 | 静默按钮 |
| Tab 切换 | index.jsx:556-559 | 容器 `rgba(0,0,0,0.05)`，选中 `#fff` | 12 / 600 | auto | `5px 12px` | 10 / 8 | 选中 `0 1px 3px rgba(0,0,0,0.08)` | 有 selected；**无 hover** | 无 | 与 Pricing tab（radius 12/padding 4）数值全不一致 |
| 缩放控制组 | index.jsx:564-569 | `rgba(0,0,0,0.05)` / `#666` | 12 / 700 | 28 | 3 | 8 / 6 | 无 | **无 hover** | 无 | 3 个按钮全无交互态 |
| 批量下载 | index.jsx:571 | `rgba(124,58,237,0.08)` / `#7c3aed` | 12 / 600 | 34 | `0 14px` | 8 | 无 | **无 hover** | 无 | 高度 34 与侧栏 44 不一致 |
| 新建生图（主 CTA） | index.jsx:582 | 渐变 `#7c3aed→#a78bfa` / `#fff` | 12 / 700 | 34 | `0 14px` | 8 | `0 3px 12px rgba(124,58,237,0.30)` | **无 hover/active/focus** | 无 | 主 CTA 却无 hover |
| 节点卡 | index.jsx:105-137 | `#fff` / `#1a1a1a` | **11/700 · 9 · 9** | w200 | `8px 10px 10px` | 12 | 选中 `0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)`；默认 `0 4px 16px rgba(0,0,0,0.10)` | selected 有；**无 hover** | 有（图+两行+usage 块） | **9px 正文**；usage 用琥珀 `#b45309` 是第 5 个语义色 |
| 右键菜单（inline） | index.jsx:161-174 | `#fff` / `#333`/`#ef4444` / `1px rgba(0,0,0,0.06)` | 12/500 · 10 | minWidth 180 | 4 / `7px 10px` | 10 / 6 | `0 8px 32px rgba(0,0,0,0.16)` | hover 有 | 有 | 还写了**无效的 `:hover` 伪属性**（JSX inline 不生效） |
| 右键菜单（组件） | ContextMenu.jsx:32-43 | `#fff` / `#1a1a1a` / `1px rgba(0,0,0,0.06)` | 13 | minWidth 200 | `6px 0` / `8px 14px` | **12** | `0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)` | hover 有 | 有 | **同功能两份实现**：圆角 10 vs 12、minWidth 180 vs 200、字号 12 vs 13 |
| 空状态 | index.jsx:597-606 | 透明 / `#999`/`#bbb` | 18/700 · 13 | — | — | — | — | 无 | 无 | 灰阶空状态，无插图无品牌感 |
| Toast | index.jsx:700 | `#ef4444`/`#10b981`/`#7c3aed` / `#fff` | 13 / 600 | auto | `10px 20px` | 10 | `0 6px 20px rgba(0,0,0,0.2)` | 无 | 无 | **与 `components/ui/Toast.jsx`（radius 2/8）并存两套** |
### 1.5 精修工坊/视频 `src/pages/EcStudio/index.jsx`

| 控件名 | 文件:行 | 背景/文字/边框 | 字号·字重 | 高度 | 内边距 | 圆角 | 阴影 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| 页面底色 | index.jsx:285 | **`#F6F7F9` 冷灰** 硬编码 | — | — | — | — | — | — | — | 全站唯一冷灰底，与暖白体系直接冲突 |
| 卡片 `SX.card` | index.jsx:24 | `#fff` / — / `1px solid #E0E0E6` | — | — | **`28px 32px`** | **12** | 无 | 无 | 有 | 与 Home 的 20/30px 圆角、30px 内边距完全不同 |
| 输入框 `SX.input` | index.jsx:26-30 | `#fff` / `#2D2D3A` / `1.5px solid #D0D0D8` | 14 | — | `11px 14px` | **8** | focus 仅改 `#6366F1`（inline） | 有 focus；无 hover/error | 无 | 全站第 4 套输入框规格 |
| 步骤数字圆 | index.jsx:33-37 | **`#4338CA`** / `#fff` | 13 / 700 | 26 | — | 50% | 无 | 无 | 无 | Indigo 体系 |
| 智能一键框 | index.jsx:507-513 | 渐变 `#EEF2FF→#F5F3FF` / — / `1px #C7D2FE` | — | — | `28px 32px` | 12 | 无 | 无 | 有 | 与下方 5 张白卡唯一区分靠浅蓝底 |
| 主 CTA·预览并生成 | index.jsx:860-873 | `#4338CA` / `#fff`，disabled `#E0E0E0` | 16 / 700 | padding 16 ≈ **48** | `16px 0` | 12 | `0 4px 16px rgba(67,56,202,.3)` | disabled 有；**无 hover/active/focus** | 无 | 48px 是全站最高主按钮 |
| 确认生成 | index.jsx:954-964 | **`#059669` 绿** / `#fff` | 14 / 600 | padding 13 ≈ **43** | `13px 0` | 8 | `0 2px 8px rgba(5,150,105,.2)` | **无 hover** | 无 | 主按钮换成绿色，第 4 个品牌色 |
| 平台/品类 pill | index.jsx:637-650, 843-857 | 选中 `#EEF2FF`/`#4338CA` | 12 | auto | `6px 14px` | **20** | 无 | **无 hover** | 无 | 与 EcPlatformPicker 的 pill（`var(--accent)`, radius-full）冲突 |
| 上传区 | index.jsx:1182-1199 | `#FAFBFC` / `#bbb` / `2px dashed #DDDDE3` | 13 / 500 | padding 24 | 24 | **10** | 无 | hover 有 | 无 | 与 EcMode 的 64×64 上传按钮（radius 10）、Home.css `.ec-ref-slot`（72×72, radius 8）三套 |
| 插件安装弹窗 | index.jsx:390-396 | `rgba(0,0,0,.45)` / `#fff` | — | — | 24 | **16** | **无阴影** | 无 | 有 | **遮罩 0.45、无阴影、radius 16**，与其它弹窗全不一致 |
| Lightbox | index.jsx:1125 | `rgba(0,0,0,.92)` | — | — | — | img 12 | 无 | 无 | 无 | 0.92 遮罩 |

### 1.6 其他页面

| 页面/控件 | 文件:行 | 背景/文字/边框 | 字号·字重 | 高度 | 内边距 | 圆角 | 阴影 | 交互态 | 嵌套层级 | 问题 |
|---|---|---|---|---|---|---|---|---|---|---|
| Gallery 页卡 | Gallery/index.jsx:63-70 | `item.grad` / `#fff` | 13/700 · 11/600 | aspect 3/4 | `3px 10px` | `var(--radius-lg)` | `var(--shadow-md)` | hover 位移 | 有 overlay | hover 用**条件渲染整体重挂载**（`{h && <div/>}`），无过渡 |
| Works 卡片 | Works/index.jsx:177 | `var(--bg-card)` / — / `var(--border)` | var | — | 16 | `var(--radius-xl)` **40** | `var(--shadow-sm)` | hover 有 | 有 | 40px 圆角配 16px 内边距，“圆到没边” |
| Works 未登录按钮 | Works/index.jsx:95-101 | **`#e84142`** / `#fff` / none | 15 / 600 | padding 12 ≈ 44 | `12px 32px` | **10** | 无 | **无 hover** | 无 | 第 7 种红；无交互态 |
| Works Tab | Works/index.jsx:126-140 | 选中 `#FFF5F5`/`#EEF2FF`，底部 3px 边 | 14 | auto | `10px 28px` | 0 | 无 | 有 selected；无 hover | 无 | 与画布 Tab（胶囊型）**完全不同的范式** |
| Pricing 套餐卡 | Pricing/index.jsx:121-132 | `#fff`/`#FAFAF9` / `var(--accent)` / `1px var(--border)` | 16/900 · 12 · 11 · 26/900 | — | 18 | **20** | hover `0 4px 16px rgba(0,0,0,0.06)` | hover 有 | 有 | 唯一较规范的卡 |
| Pricing 支付弹窗 | Pricing/index.jsx:199-207 | `rgba(0,0,0,0.5)` / `#fff` | 18/900 | — | 28 | **20** | **无 box-shadow** | 无 | 有 | 与 Modals.jsx:174 同类弹窗（radius 24 + `0 28px 90px`）**同功能两套规格** |
| Pricing 支付按钮 | Pricing/index.jsx:217-236 | `#E6F4FF`/`#1677FF` 与 `#F0FFF5`/`#07C160` | 15 / 700 | padding 14 ≈ 45 | `14px 0` | 12 | 无 | **无 hover** | 无 | 引入支付宝蓝/微信绿，第 5、6 种品牌色 |
| Plog 整页 | Plog/index.jsx:396 | **`#FAFAFA` 纯灰底** | — | — | — | — | — | — | — | 与暖白体系完全无关 |
| Plog 生成按钮 | Plog/index.jsx:522-532 | **`#333`** / `#fff`，disabled `#ddd` | 15 / 600 | padding 13 ≈ 43 | `13px 0` | 12 | **无阴影** | disabled 有；**无 hover** | 无 | 纯黑主按钮，与 `--accent` 无关 |
| Plog 选项卡 | Plog/index.jsx:433-444 | 选中 `#f5f5f5` / `#333` / `2px solid #333` | 12/600 · 9 · **8** | — | `10px 8px` | 10 | 无 | 有 selected；无 hover | 有 | **8px 标签字号** |
| Remake 状态徽章 | Remake/index.jsx:164-175 | `#f3f4f6`/`#fef9c3`/`#dbeafe`/`#dcfce7`/`#fee2e2` 硬编码 | — | — | — | var | 无 | 无 | 无 | 8 种 Tailwind 色值硬编码，未走 token |
| Remake 生成按钮 | Remake/index.jsx:383-395 | 渐变 `#7c3aed→#6366f1` / `#fff` | var(--text-base) / 700 | padding 14 ≈ 45 | `14px 0` | `var(--radius-lg)` **30** | `0 3px 12px rgba(99,102,241,.3)` | disabled 有；**无 hover** | 无 | 与 EcStudio 的 `#059669` 按钮同功能不同色 |
| SideNav 浮动条 | App.jsx:59-66 | `rgba(255,255,255,0.95)`+blur20 / `#666` / `1px rgba(0,0,0,0.08)` | — | — | 10 | **20** | `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)` | hover 有 | 有 | 与 TopBar 的 sticky 定位体系打架，无统一导航容器 |
| TopBar 套餐按钮 | App.jsx:152-165 | `var(--accent)` / `#fff` | 13 / 900 | **44** | `0 20px` | `var(--radius-full)` | `0 14px 32px rgba(28,25,23,0.18)` | hover 有 | 无 | 与 Navbar 套餐按钮（height **40**, `0 18px`）同功能两套尺寸；Navbar 版还带 `display:none` |
| 登录按钮 | App.jsx:168-194 | transparent / `var(--text-secondary)` | 15 / 700 | **44** | `0 24px` | full | 无 | hover 有 | 无 | Navbar 同类按钮 height **38**、fontSize **14**、padding **0 18/20px** |
| LoginModal | Modals.jsx:49 + ui/index.jsx:31 | `rgba(0,0,0,0.45)`+blur8 / `#fff` | var | — | `32px 28px` | `var(--radius-xl)` **40** | `var(--shadow-xl)` | 无 | 有 | 输入框 radius 用 `--radius-lg` **30px**（Modals.jsx:72）——**30px 圆角的单行输入框**是明显设计事故 |
| PricingModal | Modals.jsx:165-185 | `rgba(0,0,0,0.5)`+blur4 / `#fff` | 22/900 | — | 28 | **24** | `0 28px 90px rgba(0,0,0,0.2)` | 无 | 有 | 与 Pricing 页内同款弹窗（radius 20、无阴影）不一致 |
| 支付子弹窗 | Modals.jsx:349-357 | `rgba(0,0,0,0.5)` / `#fff` | 18/900 | — | 28 | **20** | **无阴影** | 无 | 有 | 弹窗套弹窗，遮罩叠加后 0.75，视觉发黑 |

---
## 2. 必须回答的判断题

### Q1. 哪些地方是「纯黑白极简」——只用 #000/#fff/灰阶，无任何品牌色或语义色？

| # | 位置 | 文件:行 | 证据 |
|---|---|---|---|
| 1 | 首页主模式切换（选中/未选全部） | `Home/index.jsx:55-88` | `#1a1a1a` / `#fff` / `#555` / `rgba(0,0,0,0.04~0.06)` |
| 2 | 首页标题徽标 | `Home/index.jsx:37` | 仅 `var(--border)`/`var(--text-secondary)`（`--accent:#0C0A09` 即纯黑） |
| 3 | 套图配置·平台 pill 选中态 | `SizingPanel.jsx:239-241` | `#1a1a1a` 底 / `#fff` 字 |
| 4 | 套图配置·勾选框 | `SizingPanel.jsx:274-282` | `#1a1a1a` 底 `#fff` 勾 |
| 5 | 画面风格·风格卡选中态 | `StylePanel.jsx:119-120` | `#1a1a1a` 底 / `#fff` 字 |
| 6 | 产品参数·品类下拉选中 | `ParamsPanel.jsx:76-78` | `#1a1a1a` / `#fff` |
| 7 | 设计方向·空状态重试 | `DesignDirection.jsx:535` | `#1a1a1a` / `#fff` |
| 8 | 设计方向·返回按钮 | `DesignDirection.jsx:185-188` | `#fff` / `var(--text-secondary)` |
| 9 | **Plog 全站**（底色/卡/按钮/选项） | `Plog/index.jsx:226,231,396,409,437,459,481,525,593` | `#FAFAFA` 底、`#333` 主按钮、`2px solid #333` 选中、`#f5f5f5` 选中底 |
| 10 | **画布工具条全部按钮** | `EcCanvas/index.jsx:550-584` | 全是 `rgba(0,0,0,0.05)` / `#666` / `#1a1a1a` / `#999` |
| 11 | 画布右键菜单（两套） | `EcCanvas/index.jsx:161-174`；`ContextMenu.jsx:32-60` | `#fff` / `#333` / `#1a1a1a` |
| 12 | 画布空状态 | `EcCanvas/index.jsx:600-601` | `#999` / `#bbb` |
| 13 | 画布作品集卡 | `EcCanvas/index.jsx:656-660` | `#fff` / `#1a1a1a` / `#999` |
| 14 | 设计方向视图·暗色预设 | `DesignDirectionView.jsx:35,55` | `#1a1a2e`/`#2d2d44`/`#404060`、`#0f0f1a` |
| 15 | Pricing Tab 容器 | `Pricing/index.jsx:99,104`；`Modals.jsx:229,234` | `#fff` 选中 + `rgba(0,0,0,0.04)` 底 + 黑字 |
| 16 | 工作台·刷新按钮 | `Works/index.jsx:109` | `var(--border-light)` + `var(--text-muted)` |
| 17 | 全局 `.hint-tag` | `Home.css:197-209` | 灰底灰字，hover 才变红 |
| 18 | EcPlatformPicker 智能 pill | `EcPlatformPicker.jsx:76-88` | `#fff` + `var(--border)` + `var(--text-muted)` |

**关键补充**：`--accent:#0C0A09` 本身就是“近黑”，所以走 `var(--accent)` 的地方（Navbar、TopBar 套餐按钮、Pricing 卡、Works 标题）**在视觉上也属于纯黑白极简**。这是老板观感的主要来源：**首页骨架 + 画布 + Plog + 定价页，四块用户最常看的界面全部是黑白灰。**

### Q2. 哪些地方硬编码颜色、没走设计变量？

**全量统计（脚本扫描 `src/**/*.{jsx,js,css}`）：**

- 含硬编码 hex 的源文件：**43 个**
- 硬编码 hex 出现次数（Top 20）：

| 文件 | hex 次数 | 文件 | hex 次数 |
|---|---|---|---|
| `pages/Home/Home.css` | **350** | `pages/Home/ec/DesignDirection.jsx` | 67 |
| `pages/Home/XhsContentMode.jsx` | **168** | `pages/Home/EcMode.jsx` | 58 |
| `pages/EcStudio/index.jsx` | **162** | `pages/EcAuto/index.jsx` | 55 |
| `NoteModal.jsx` | **111** | `pages/Home/EcLegacyForm.jsx` | 55 |
| `pages/Plog/index.jsx` | **100** | `pages/EcCanvas/index.jsx` | 53 |
| `components/business/Modals.jsx` | 40 | `pages/Remake/index.jsx` | 36 |
| `pages/Pricing/index.jsx` | 29 | `pages/Home/ec/StylePanel.jsx` | 25 |
| `pages/Home/ec/DesignDirectionView.jsx` | 24 | `pages/Home/ec/SizingPanel.jsx` | 19 |
| `pages/Works/index.jsx` | 17 | `pages/Home/ec/GenSettingsPanel.jsx` | 13 |
| `pages/Home/index.jsx` | 12 | `components/layout/Navbar.jsx` | 8 |

**按颜色族归类（这是“没有视觉语言”的直接证据）：**

| 语义 | 出现过的不同色值 | 出处 |
|---|---|---|
| **紫/品牌紫** | `#7c3aed`、`#a78bfa`、`#8b5cf6`、`#A855F7`、`#C4B5FD`、`#6B21A8`、`#E9D5FF`、`#F3E8FF`、`#F5F3FF`、`#FAF5FF`、`#7C3AED`、`#7C7CFF` | 8+ 文件 |
| **靛蓝/Indigo** | `#6366F1`、`#4F46E5`、`#4338CA`、`#3730A3`、`#EEF2FF`、`#E0E7FF`、`#C7D2FE`、`#818CF8`、`#DDDDE3` | Home.css / EcStudio / Modals / NoteModal |
| **红（7 种）** | `#E8544B`、`#E53E3E`、`#EF4444`、`#e84142`、`#FF4757`、`#FF3B5C`、`#e74c3c`、`#dc2626`、`#C53030`、`#E85D5D` | 全站 |
| **绿（5 种）** | `#5CA86C`、`#16a34a`、`#22c55e`、`#059669`、`#07C160`、`#166534` | 全站 |
| **黑（4+ 种）** | `#0C0A09`(token)、`#1a1a1a`、`#1e1e2e`、`#1a1a2e`、`#111`、`#000`、`#333`、`#222` | 全站 |
| **页面底色（7 种）** | `var(--bg)#F5EFE4`、`#FAF7F2`、`#F0EEE9`、`#F6F7F9`、`#FAFAFA`、`#FAFBFC`、`#F8F9FA` | 各页 |
| **内容底色** | `#F5F0EB`、`#F5F0E8`、`#FAF0E4`、`#f8f3ea`、`#FFF5F5`、`#FFF7ED` | 各面板 |
| **Tailwind 残留** | `#f3f4f6`、`#6b7280`、`#fef9c3`、`#854d0e`、`#dbeafe`、`#1e40af`、`#dcfce7`、`#fee2e2`、`#991b1b` | Remake |

**几乎完全不走 token 的文件**：`Plog/index.jsx`、`Home/ec/GenSettingsPanel.jsx`、`Home/ec/CopyPanel.jsx`、`Home/ec/SkuPanel.jsx`、`Home/ec/SizingPanel.jsx`、`Home/ec/ParamsPanel.jsx`。

### Q3. 同类控件在不同页面的尺寸/圆角/间距是否不一致？

**是。共 14 组不一致**，完整对照见 §3：主 CTA 按钮（11 处不同）、次级按钮（7 处）、Tab 切换（5 种范式）、Tab 容器（3 处）、输入框（8 套规格）、卡片圆角（6 档）、卡片内边距（6 档）、弹窗圆角（11 档）、弹窗遮罩（7 档）、弹窗阴影（15 档）、Toast（2 套）、右键菜单（2 套）、上传区（3 套）、pill 选择器（4 套）、导航高度（4 套）。

### Q4. 哪些控件完全没有交互状态（hover/选中/禁用无视觉差异）？

| 控件 | 文件:行 | 缺失的状态 |
|---|---|---|
| 画布 返回按钮 | `EcCanvas/index.jsx:551` | hover / active / focus 全无 |
| 画布 缩放三按钮 | `EcCanvas/index.jsx:565-568` | 全无 |
| 画布 批量下载 | `EcCanvas/index.jsx:571` | hover / active 全无 |
| 画布 **新建生图（主 CTA）** | `EcCanvas/index.jsx:582` | hover / active / focus 全无 |
| 画布 打开/删除小按钮 | `EcCanvas/index.jsx:663-664` | 全无 |
| 画布 空状态「去生成」 | `EcCanvas/index.jsx:602` | 全无 |
| 画布 Tab | `EcCanvas/index.jsx:558` | 未选中无 hover |
| 画布 节点卡 | `EcCanvas/index.jsx:102` | 无 hover（只有 selected） |
| 精修工坊 平台/品类 pill | `EcStudio/index.jsx:640-647`、`846-853` | 无 hover |
| 精修工坊 详情切片卡 | `EcStudio/index.jsx:762-767` | 无 hover |
| 精修工坊 主 CTA | `EcStudio/index.jsx:860-873` | 无 hover / focus |
| 精修工坊 确认生成 | `EcStudio/index.jsx:954-964` | 无 hover |
| 精修工坊 添加变体 | `EcStudio/index.jsx:689-698` | 无 hover |
| 精修工坊 重新生成 | `EcStudio/index.jsx:1098-1112` | 无 hover |
| Plog 全部选项卡 | `Plog/index.jsx:433,456,478` | 无 hover（只有 selected 反色） |
| Plog 主按钮 | `Plog/index.jsx:522` | 无 hover |
| Plog 示例标签 | `Plog/index.jsx:418` | 无 hover |
| Plog 下载/重新生成 | `Plog/index.jsx:589,593` | 无 hover |
| 设计方向 卡片 | `DesignDirection.jsx:264` | 无 hover（只有 selected 换色） |
| 设计方向 重试 | `DesignDirection.jsx:245,532` | 无 hover |
| 设计方向 重新生成方向 | `DesignDirection.jsx:455-462` | 无 hover |
| Works 未登录「立即登录」 | `Works/index.jsx:95` | 全无 |
| Works Tab | `Works/index.jsx:123` | 无 hover |
| Works 刷新 | `Works/index.jsx:108` | 无 hover |
| Pricing 支付两按钮 | `Pricing/index.jsx:217,227`；`Modals.jsx:369,380` | 无 hover |
| Pricing 免费体验按钮 | `Pricing/index.jsx:183` | 无 hover |
| 首页 模式切换按钮 | `Home/index.jsx:56,72` | **无 focus-visible**（键盘用户不可见） |
| 全站 `<div onClick>` 伪按钮 | 遍布 | 无 focus、无键盘可达、无 disabled 语义 |

### Q5. 哪些地方缺少层级（没有分组、没有卡片嵌套，一片平）？

| 位置 | 文件:行 | 问题 |
|---|---|---|
| **GenSettingsPanel 整体** | `GenSettingsPanel.jsx:39-139` | 三段（分辨率/品质/负向提示词）只用 `gap:16` 分开，无分割线无分组容器；分辨率 2×2 卡、品质 1×2 卡、负向提示词裸 input——**三种形态平铺** |
| **ParamsPanel 整体** | `ParamsPanel.jsx:53-95` | 6 个字段直接 2 列网格平铺；品类（全宽）与其它 5 项（半宽）混在同一 grid |
| **CopyPanel 整体** | `CopyPanel.jsx:53-90` | 创意思路（全宽）与其余 4 项（2 列）平铺，5 个 textarea 视觉权重完全相同 |
| **SizingPanel 图片类型列表** | `SizingPanel.jsx:261-320` | 7 行平铺，未勾选行 `background:transparent`+`border:transparent`，**勾选/未勾选几乎无法区分** |
| **画布工具栏** | `EcCanvas/index.jsx:550-586` | 标题、Tab、缩放、批量下载、删除、新建生图挤在 52px 一条里，**无分隔线无分组**，`gap:10` 一视同仁 |
| **画布空状态** | `EcCanvas/index.jsx:598-605` | 纯文字+emoji，无卡片无插图 |
| **精修工坊 CONFIG** | `EcStudio/index.jsx:333-875` | 6 张同级白卡 `gap:16` 直排，**每张卡权重一样**，用户不知道哪步重要 |
| **精修工坊 平台+生成卡** | `EcStudio/index.jsx:827-874` | 平台 pill 与主 CTA 同卡、无分隔 |
| **Plog 全部区块** | `Plog/index.jsx:409-518` | 5 张 `#fff` + `1px #eee` + `radius 16` + `padding 20` 全等卡片直排，**零层级** |
| **Pricing FAQ** | `Pricing/index.jsx:251-258` | 只有底部分割线，无卡片 |
| **Works 作品网格** | `Works/index.jsx:175` | 2 列等权卡片，无分组无时间轴 |
| **首页 surface-card** | `Home/index.jsx:100-112` | 外层白卡直包整个 EcMode，EcMode 内又有一个 `#FAF7F2` 卡（EcMode.jsx:492），**双卡嵌套但圆角 30/20，边缘关系看不清** |
| **EcMode 配置按钮行** | `EcMode.jsx:683-835` | 6 个配置按钮 + 下一步同排，`gap:6`，无分组 |
### Q6. 弹层/弹窗的圆角、阴影、遮罩透明度是否各自为政？

**遮罩（overlay）全部取值 —— 共 7 种透明度，仅 2 处带模糊：**

| 透明度 | 模糊 | z-index | 位置 |
|---|---|---|---|
| `rgba(0,0,0,0.45)` | `blur(8px)` | 999 | `components/ui/index.jsx:35`（Modal 基类） |
| `rgba(0,0,0,0.45)` | `blur(8px)` | 900 | `NoteModal.jsx:790` |
| `rgba(0,0,0,0.45)` / `rgba(0,0,0,.45)` | 无 | 1000 | `EcStudio/index.jsx:390`（两种写法同文件不一致） |
| `rgba(0,0,0,0.5)` | `blur(4px)` | 9998 | `Modals.jsx:167`（PricingModal） |
| `rgba(0,0,0,0.5)` | 无 | 99999 | `Modals.jsx:350`、`Pricing/index.jsx:200`、`XhsContentMode.jsx:1237` |
| `rgba(0,0,0,0.7)` | 无 | 99999 | `Home.css:1641`（ec-lightbox，**被下方同 class 定义覆盖**） |
| `rgba(0,0,0,0.75)` | `blur(8px)` | 10001 | `EcCanvas/index.jsx:692` |
| `rgba(0,0,0,0.85)` | 无 | 99999 | `Home.css:1691`（**同 class 二次定义，覆盖 0.7**） |
| `rgba(0,0,0,0.92)` / `.92` | 无 | 99999 / 1001 | `XhsContentMode.jsx:1206`、`Plog/index.jsx:602`、`EcStudio/index.jsx:1125` |

**弹窗圆角全部取值 —— 共 11 种：**

| 圆角 | 位置 |
|---|---|
| **2** | `DesignDirection.jsx:512`（进度条） |
| **4** | `NoteModal.jsx:323,334,823`；`EcCanvas/ContextMenu.jsx:48` |
| **6** | `NoteModal.jsx:814`；`EcCanvas/index.jsx:167` |
| **8** | `GenSettingsPanel.jsx:122`；`SizingPanel.jsx:254`；`EcMode.jsx:612`；`EcCanvas/index.jsx:551` |
| **10** | `EcCanvas/index.jsx:161`；`EcPlatformPicker.jsx:99` |
| **12** | `EcCanvas/index.jsx:692`；`EcCanvas/ContextMenu.jsx:37`；`EcStudio/index.jsx:1125`；`Pricing/index.jsx:89` |
| **14** | `NoteModal.jsx:791` |
| **16** | `EcStudio/index.jsx:396`；`XhsContentMode.jsx:1237` |
| **18** | `EcPlatformPicker.jsx:99`（下拉面板） |
| **20** | `Modals.jsx:351`；`Pricing/index.jsx:201`；`NoteModal.jsx:174`；`EcMode.jsx:47`（GLASS_PANEL） |
| **24** | `Modals.jsx:181`（PricingModal） |
| **`var(--radius-xl)`=40** | `components/ui/index.jsx:48`（Modal 基类） |

**弹窗阴影全部取值 —— 共 15 种（3 处完全无阴影）：**

| 阴影 | 位置 |
|---|---|
| **无阴影** | `EcStudio/index.jsx:396`、`Modals.jsx:357`、`Pricing/index.jsx:207` |
| `0 1px 3px rgba(0,0,0,0.08)` | `EcCanvas/index.jsx:558`、`Pricing/index.jsx:104` |
| `0 2px 8px rgba(0,0,0,0.04)` | `DesignDirection.jsx:269` |
| `0 2px 12px rgba(0,0,0,0.04)` | `DesignDirection.jsx:204,351`；`Home.css:1165,1306` |
| `0 4px 16px rgba(0,0,0,0.06)` | `Modals.jsx:264`；`Home.css:521,900`；`Pricing/index.jsx:131` |
| `0 6px 20px rgba(0,0,0,0.2)` | `components/ui/Toast.jsx:47`；`EcCanvas/index.jsx:700` |
| `0 6px 32px rgba(255,71,87,0.18)` | `EcMode.jsx:504`；`Home.css:77` |
| `0 8px 24px rgba(0,0,0,0.14)` | `SizingPanel.jsx:81` |
| `0 8px 30px rgba(0,0,0,0.1)` | `ParamsPanel.jsx:68`；`Home.css:591` |
| `0 8px 32px rgba(0,0,0,0.16)` / `…, 0 2px 8px rgba(0,0,0,0.08)` | `EcCanvas/index.jsx:161` / `ContextMenu.jsx:38` |
| `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)` | `App.jsx:65`；`XhsContentMode.jsx:538` |
| `0 12px 48px rgba(124,58,237,0.15), 0 4px 16px rgba(0,0,0,0.08), inset…` | `EcMode.jsx:52`（GLASS_PANEL） |
| `0 18px 46px rgba(57,45,26,0.16)` | `Navbar.jsx:174`；`ui/Popover.jsx:70`；`EcPlatformPicker.jsx:103` |
| `0 20px 60px rgba(0,0,0,0.25)` | `NoteModal.jsx:192,798` |
| `0 24px 80px rgba(0,0,0,0.18)` | `Home.css:1490`（ec-guide-modal） |
| `0 28px 90px rgba(0,0,0,0.2)` / `rgba(57,45,26,0.14)` | `Modals.jsx:182` / `design-tokens.css:296` |

**最严重的一点**：`--shadow-xl` 定义的是暖棕 `rgba(57,45,26,0.14)`，但**绝大多数弹窗用的是纯黑 `rgba(0,0,0,*)`**，冷黑阴影打在暖白底上会显脏。

**结论：是，完全各自为政。圆角 11 档、阴影 15 档、遮罩 7 档，没有任何一处复用同一常量。**

---
## 3. 「同类控件尺寸不一致」对照表

### 3.1 主 CTA（生成/下一步/确认类）按钮 —— 12 处全不一致

| # | 按钮 | 文件:行 | 高度 | 内边距 | 圆角 | 字号/字重 | 背景 | hover |
|---|---|---|---|---|---|---|---|---|
| 1 | 首页 hero `.gen-btn` | `Home.css:212-232` | padding 16 → **≈58** | `16px 0` | `var(--radius-lg)`=**30** | 17 / 700 | `var(--red)` | ✅ |
| 2 | `.btn-pill`（token 基准） | `design-tokens.css:148-166` | **42**（写死） | `0 24px` | **full** | 15 / 600 | — | ✅ |
| 3 | 首页 EC `.gen-btn.ec` | `Home.css:549-559` | padding 13 → **≈45** | `13px 36px` | **10** | 15 / 600 | 渐变 `#6366F1→#4F46E5` | ✅ |
| 4 | 预览 `.ec-preview-btn` | `Home.css:1104-1121` | padding 12 → **≈44** | `12px 28px` | **10** | 15 / 600 | 同上 | ✅ |
| 5 | 引导 `.ec-guide-btn` | `Home.css:1623-1634` | padding 14 → **≈47** | 14 | **12** | 15 / 700 | 同上 | ✅ |
| 6 | **EcMode 下一步** | `EcMode.jsx:819-834` | **38**（写死） | `0 22px` | **12** | 13 / 700 | 渐变 紫→粉→橙 | ✅ |
| 7 | **DesignDirection 确认方向** | `DesignDirection.jsx:470-480` | padding 14 → **≈52** | `14px 48px` | **25** | 16 / 800 | 渐变 紫→粉→橙 | ❌ |
| 8 | **EcStudio 预览并生成** | `EcStudio/index.jsx:860-873` | padding 16 → **≈48** | `16px 0` | **12** | 16 / 700 | `#4338CA` | ❌ |
| 9 | **EcStudio 确认生成** | `EcStudio/index.jsx:954-964` | padding 13 → **≈43** | `13px 0` | **8** | 14 / 600 | **`#059669` 绿** | ❌ |
| 10 | **Plog 生成** | `Plog/index.jsx:522-532` | padding 13 → **≈43** | `13px 0` | **12** | 15 / 600 | **`#333` 纯黑** | ❌ |
| 11 | **Remake 一键复刻** | `Remake/index.jsx:383-395` | padding 14 → **≈45** | `14px 0` | `var(--radius-lg)`=**30** | 15 / 700 | 渐变 `#7c3aed→#6366f1` | ❌ |
| 12 | `ui/Button` primary | `components/ui/Button.jsx:11-12,29` | padding 12 → **≈44** | `12px 24px` | `var(--radius-lg)`=**30** | var(--text-base) / 600 | `var(--red)` | ✅ |

**→ 高度 8 档：38 / 42 / 43 / 44 / 45 / 47 / 48 / 52 / 58。圆角 6 档：8 / 10 / 12 / 25 / 30 / full。品牌色 5 种：红 / 靛蓝 / 紫渐变 / 绿 / 黑。**

### 3.2 Tab 切换 —— 5 种范式

| 位置 | 文件:行 | 容器 | 选中态 | 圆角 | 高度 |
|---|---|---|---|---|---|
| 画布 当前画布/作品集 | `EcCanvas/index.jsx:556-559` | `rgba(0,0,0,0.05)`, padding 3, radius 10 | `#fff` + `0 1px 3px rgba(0,0,0,0.08)` | 8 | `5px 12px` ≈27 |
| Pricing 月度/永久 | `Pricing/index.jsx:87-109` | `rgba(0,0,0,0.04)`, padding 4, radius **12** | `#fff` + `0 1px 3px rgba(0,0,0,0.08)` | **10** | `10px 0` ≈36 |
| PricingModal Tab | `Modals.jsx:216-240` | 同 Pricing 页 | 同上 | 10 | ≈36 |
| Works 小红书/电商 | `Works/index.jsx:126-140` | **无容器**，底部 3px 色条 | `#FFF5F5`/`#EEF2FF` 底 + 3px 红/蓝边 | **0** | `10px 28px` ≈40 |
| 首页 电商生图/小红书 | `Home/index.jsx:54-88` | `rgba(0,0,0,0.04)`, padding 5, radius **30** | `#1a1a1a` + 内阴影 | **25** | `11px 28px` ≈41 |

### 3.3 次级/幽灵按钮 —— 7 处不一致

| 位置 | 文件:行 | 高度 | 内边距 | 圆角 | 字号 | 边框 |
|---|---|---|---|---|---|---|
| 画布 打开作品 | `EcCanvas/index.jsx:663` | 30 | — | 8 | — | none |
| 画布 返回 | `EcCanvas/index.jsx:551` | 32 | — | 8 | — | none |
| 精修工坊 继续生成 | `EcStudio/index.jsx:984-994` | padding 8 ≈37 | `8px 16px` | 8 | 13 | `1px #DDDDE3` |
| 精修工坊 返回修改 | `EcStudio/index.jsx:944-953` | padding 13 ≈43 | `13px 0` | 8 | 14 | `1.5px #DDDDE3` |
| 设计方向 返回 | `DesignDirection.jsx:183-189` | padding 8 ≈34 | `8px 14px` | 12 | 13 | `1px rgba(0,0,0,0.08)` |
| `.ec-back-btn` | `Home.css:1122-1137` | padding 12 ≈43 | `12px 24px` | 10 | 14 | `1.5px #ddd` |
| `.btn-ghost` | `design-tokens.css:178-187` | — | `0 24px`（未定高） | full | 15 | `1px var(--border)` |

### 3.4 输入框 —— 8 套规格

| 位置 | 文件:行 | 字号 | 内边距/高度 | 圆角 | 边框 | 背景 |
|---|---|---|---|---|---|---|
| ParamsPanel `inp` | `ParamsPanel.jsx:7-11` | **13** | `8px 12px`（height 36） | **8** | `1px rgba(0,0,0,0.12)` | `rgba(0,0,0,0.03)` |
| GenSettingsPanel input | `GenSettingsPanel.jsx:133` | **12** | `8px 12px`（height 36 同页） | **8** | `1px rgba(0,0,0,0.12)` | `rgba(0,0,0,0.03)` |
| SkuPanel `sInp` | `SkuPanel.jsx:4-8` | **12** | `6px 10px`（height 32/28） | **8** | `1px rgba(0,0,0,0.12)` | **`#fff`** |
| EcStudio `SX.input` | `EcStudio/index.jsx:26-30` | **14** | `11px 14px` | **8** | `1.5px #D0D0D8` | `#fff` |
| `.ec-input-primary` | `Home.css:409-422` | 16 | `12px 16px` | **10** | `1.5px #e0e0e0` | `#fff` |
| `.ec-input` | `Home.css:437-450` | 14 | `11px 14px` | **8** | `1.5px #e0e0e0` | `#fff` |
| `.ec-input-sm` | `Home.css:423-436` | 14 | `9px 13px` | **8** | `1.5px #e0e0e0` | `#fff` |
| LoginModal input | `Modals.jsx:70-77` | var(--text-base)=15 | `12px 16px` | **`var(--radius-lg)`=30** ⚠️ | `1.5px var(--border)` | 透明 |
| EcProductParams input | `EcProductParams.jsx:36-45` | 13 | `10px 14px` | `var(--radius-sm)`=8 | `1px var(--border)` | `rgba(0,0,0,0.02)` |
| Plog textarea | `Plog/index.jsx:413` | 14 | `10px 12px` | **10** | `1.5px #ddd` | `#fff` |

### 3.5 卡片 —— 圆角 6 档、内边距 6 档

| 位置 | 文件:行 | 圆角 | 内边距 | 边框 | 阴影 |
|---|---|---|---|---|---|
| 首页 surface-card | `design-tokens.css:293` | **30** | 0 | 无 | `0 28px 90px rgba(57,45,26,0.14)` |
| Home.css `.ec-section` | `Home.css:299-306` | **14** | **`28px 30px`** | `1px #e8e8e8` | `0 1px 4px rgba(0,0,0,0.02)` |
| EcStudio `SX.card` | `EcStudio/index.jsx:24` | **12** | **`28px 32px`** | `1px #E0E0E6` | 无 |
| DesignDirection 卡 | `DesignDirection.jsx:266,350` | **16** | `16px 18px` / `18px 20px` | `1px rgba(0,0,0,0.06)` | `0 2px 12px rgba(0,0,0,0.04)` |
| Plog 区块 | `Plog/index.jsx:409` 等 | **16** | **20** | `1px #eee` | 无 |
| SkuPanel 变体卡 | `SkuPanel.jsx:63` | **12** | 12 | `1px rgba(0,0,0,0.06)` | 无 |
| `.card-glass` | `design-tokens.css:200` | `var(--radius-lg)`=30 | 0 | `1px var(--border)` | `var(--shadow-xl)` |
| `.card-white` | `design-tokens.css:209` | `var(--radius-md)`=**16** | 0 | `1px var(--border-light)` | `var(--shadow-md)` |
| Works Card | `Works/index.jsx:177` + `ui/index.jsx:13` | `var(--radius-xl)`=**40** | 16 | `1px var(--border)` | `var(--shadow-sm)` |
| Pricing 套餐卡 | `Pricing/index.jsx:125` | **20** | 18 | `1px/2px var(--border)` | hover 才有 |
| EcCanvas 作品卡 | `EcCanvas/index.jsx:656` | **16** | `12px 14px` | `1px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.04)` |

### 3.6 导航高度 —— 4 套

| 位置 | 文件:行 | 高度 |
|---|---|---|
| Navbar 玻璃条 | `Navbar.jsx:37` | `var(--nav-height)`=**72** |
| TopBar（实际生效） | `App.jsx:123-135` | **无高度**，paddingTop 28 + 50 = ≈78 |
| SideNav 竖条 | `App.jsx:90` | 每项 **44** |
| 画布工具栏 | `EcCanvas/index.jsx:550` | **52** |

### 3.7 pill / 选择器 —— 4 套

| 位置 | 文件:行 | 内边距 | 圆角 | 选中态 |
|---|---|---|---|---|
| SizingPanel 平台 pill | `SizingPanel.jsx:236-241` | `7px 14px` | **10** | `#1a1a1a` 纯黑 |
| EcPlatformPicker 平台 pill | `EcPlatformPicker.jsx:46-57` | `8px 14px` | `var(--radius-full)` | `var(--accent)` |
| EcStudio 平台/品类 pill | `EcStudio/index.jsx:641-646` | `6px 12px` / `6px 14px` | **20** | `#EEF2FF`+`#4338CA` |
| EcStudio 详情切片卡 | `EcStudio/index.jsx:764` | `10px 12px` | **8** | `#F5F3FF`+`#C7D2FE` |
| Home.css `.ec-cat-pill` | `Home.css:467-479` | `6px 14px` | **20** | `#EEF2FF`+`#4338CA` |

---
## 4. Top 20 待改清单（按「用户可见频率 × 丑陋程度」排序）

| # | 频率×丑度 | 文件:行 | 问题一句话 | 建议改法 |
|---|---|---|---|---|
| **1** | 100% 用户 · 极丑 | `EcMode.jsx:819-834` | “下一步”是主转化按钮，却只有 **38px 高、12px 圆角**，挤在 40px 高的配置按钮后面 | 统一 44px 高 + `var(--radius-lg)`，与其余主 CTA 共用同一组件 |
| **2** | 100% 用户 · 极丑 | `Home/index.jsx:55-88` | 首页主模式切换是纯 `#1a1a1a` 黑白胶囊 + 全 inline 硬编码，全站第一眼就是“黑白极简” | 换成走 token 的品牌色，抽成 `SegmentedControl` 组件 |
| **3** | 100% 用户 · 极丑 | `Home.css:103-131` | 描述输入框跑 `inputGlow` 无限呼吸动画，边框一直在闪 | 删除动画，静态 `1.5px var(--border)`，focus 时才变化 |
| **4** | 100% 用户 · 很丑 | `EcMode.jsx:504` vs `595` | 同一行两个上传卡，一个 **红边框** 一个 **蓝边框**，辅色直接撞车 | 两者统一中性边框，仅靠标签色区分“必须/可选” |
| **5** | 100% 用户 · 很丑 | `EcMode.jsx:33-43` | 6 个配置按钮全 40px 等宽等高、无分组，用户分不清主次 | 按“内容/风格/参数”分 2 组，组间加 8px 间隔与分隔线 |
| **6** | 100% 用户 · 很丑 | `design-tokens.css:286` | `hero-gradient-text` 是紫→粉→橙，品牌主色却是 `#0C0A09` 近黑，两套语言打架 | 确定唯一品牌色，渐变只保留同一色系 |
| **7** | 100% 用户 · 很丑 | `EcCanvas/index.jsx:548` | 画布底色 `#F0EEE9` 与全局 `--bg:#F5EFE4` 不同，进画布会跳色 | 改用 `var(--bg)` |
| **8** | 100% 用户 · 很丑 | `EcCanvas/index.jsx:550-584` | 画布工具栏 52px 一条塞 6 类操作，零分组、按钮全无 hover | 按“导航/视图/动作”三段分组，所有按钮补 hover |
| **9** | 高频 · 很丑 | `EcMode.jsx:46-54` | GLASS_PANEL 用 4 层阴影 + `blur(40px) saturate(220%)`，浮夸且与全站其它面板无关联 | 收敛为 1 层 `var(--shadow-lg)` + 统一圆角 |
| **10** | 100% 用户 · 丑 | `GenSettingsPanel.jsx:39-139` | 三段配置（卡/卡/裸 input）三种形态平铺，零层级 | 统一为同规格 tab 卡，加分组标题与分隔线 |
| **11** | 100% 用户 · 丑 | `SizingPanel.jsx:261-320` | 7 行图片类型未勾选时边框/背景都是 transparent，勾选仅 3% 灰底，**几乎看不出选中** | 未选状态给可见边框，选中给品牌色边框 + 勾选图标 |
| **12** | 高频 · 丑 | `EcCanvas/index.jsx:161-174` vs `ContextMenu.jsx:32-43` | 同一“右键菜单”两份实现，圆角 10/12、字号 12/13、minWidth 180/200 全不同 | 删除 inline 版本，只保留 `ContextMenu.jsx` |
| **13** | 高频 · 丑 | `EcCanvas/index.jsx:105-137` | 画布节点卡正文 **9px**、usage 用琥珀 `#b45309`，字号低于可读下限 | 正文提到 11–12px，usage 缩为图标 + tooltip |
| **14** | 高频 · 丑 | `Plog/index.jsx:396,522` | Plog 整页 `#FAFAFA` 冷灰底 + `#333` 纯黑主按钮，与主站暖白体系完全两套皮肤 | 底色改 `var(--bg)`，主按钮改品牌色 |
| **15** | 高频 · 丑 | `EcStudio/index.jsx:285` | 精修工坊用 `#F6F7F9` 冷灰底 + `#4338CA` 靛蓝，是全站第三种皮肤 | 统一到品牌色与 `var(--bg)` |
| **16** | 高频 · 丑 | `EcStudio/index.jsx:860-873` vs `954-964` | 同页两个主按钮一个靛蓝 48px、一个绿色 43px，用户以为是两种操作 | 统一主按钮规格与颜色，仅文案区分 |
| **17** | 高频 · 丑 | `Modals.jsx:70-77` | 登录弹窗输入框圆角 **30px**（用的 `--radius-lg`），单行输入框圆到像胶囊 | 改为 `--radius-md`(16) 或 `--radius-sm`(8) |
| **18** | 高频 · 丑 | `Modals.jsx:181` vs `Pricing/index.jsx:201` | 同一个“套餐弹窗”两处实现：圆角 24 vs 20、阴影有 vs 无、遮罩 blur4 vs 无 | 只保留 `PricingModal`，路由页复用同一组件 |
| **19** | 高频 · 丑 | `App.jsx:59-66` | 浮动 SideNav 与 TopBar 两套导航并存，44px 圆角 14 的方按钮 + 右上角胶囊，无统一导航容器 | 合并为单一顶栏或侧栏 |
| **20** | 中频 · 丑 | `Remake/index.jsx:164-175` | 状态徽章硬编码 8 种 Tailwind 色（`#fef9c3`/`#dcfce7`/`#fee2e2`…），与 token 语义色无对应 | 映射到 `--green-bg`/`--red-bg`/`--blue-bg` 等语义 token |

**补充（若预算允许，紧随其后）**

| # | 文件:行 | 问题 | 建议 |
|---|---|---|---|
| 21 | `EcCanvas/index.jsx:700` vs `components/ui/Toast.jsx` | 两套 Toast（圆角 10 vs 2/8，色值不同） | 删一套 |
| 22 | `Works/index.jsx:95-101` | 未登录 CTA 用第 7 种红 `#e84142` 且无 hover | 换品牌色 + 补 hover |
| 23 | `Home.css:1641,1691` | `.ec-lightbox-overlay` 同 class 定义两次（0.7 被 0.85 覆盖） | 合并 |
| 24 | `Home.css:229,230` | `.gen-btn.xhs` 连续重复两行 | 删重复 |
| 25 | `Home.css:1140-1146` | `.ec-preview-header` 同 class 定义两次 | 合并 |
| 26 | `Pricing/index.jsx:183` / `Modals.jsx:328` | 免费体验按钮无 hover 无阴影（页内版）/ 有 hover（弹窗版） | 统一 |
| 27 | `Navbar.jsx:110` | 套餐按钮 `display:'none'` 后用媒体查询强开，且在 TopBar 里有第二份 | 删一份 |
| 28 | `DesignDirection.jsx:365-373` | 上传区 `rotate(-1.5deg)` 左右手歪，同一区域两套旋转 | 去掉手歪，或统一为品牌装饰 |

---

## 5. 给改造阶段的四条硬性建议（每条可直接落地）

1. **先补 token 缺口再改样式**。`--radius-md:16` 与 `--radius-lg:30` 之间没有 20/24 档，实际代码里硬编码了 8/10/12/14/18/20/24/25 八种圆角；`--shadow-*` 只有 5 档但实际用到 15 种取值。应补齐 `--radius-2xl:24`、`--radius-3xl:32`、`--shadow-modal`、`--overlay`、`--overlay-strong`，否则改造必然继续硬编码。
2. **把“品牌色”收敛成一个变量组**。当前同时存在 `#0C0A09`(近黑) / `#7c3aed`(紫) / `#6366F1`(靛蓝) / `#4338CA`(深靛) / `#E8544B`(红) / `#059669`(绿) / `#e84142`(红)。建议定义 `--brand` + `--brand-hover` + `--brand-soft` + `--brand-gradient` 四件套，全站只允许引用它们。
3. **先立“主 CTA”这一个组件**。§3.1 中 12 处主按钮高度 38–58、圆角 8–30、颜色 5 种。做一个 `<PrimaryButton size="lg|md|sm">` 覆盖全部后，视觉统一度会立刻提升一个量级。
4. **统一页面底色**。当前 7 种：`#F5EFE4`(token) / `#FAF7F2` / `#F0EEE9` / `#F6F7F9` / `#FAFAFA` / `#FAFBFC` / `#F8F9FA`。建议收敛为 `--bg`（页级）+ `--bg-elevated`（卡级）两级。

---

## 6. 附：审计口径

- 硬编码统计：Node 脚本遍历 `src/**/*.{jsx,js,css}`，正则 `#[0-9a-fA-F]{3,8}\b` 全量匹配并计数。
- 圆角/高度/阴影/遮罩统计：正则匹配 `borderRadius` / `height` / `boxShadow` / `rgba(0,0,0,α)`，按取值聚合计数，取 Top N。
- 所有行号以当前工作区文件为准（`F:\\da\\shubao`），可直接用编辑器跳转定位。
- 本次审计**未修改任何 `src/` 下文件**，未执行 git commit。临时统计脚本 `.audit-*.cjs` 位于仓库根，可安全删除。

*本文件由只读审计生成。*
---

# 附录 A · 总统筹补充审计（第二轮）

> 触发：总统筹指出「全是黑白极简风」的样板 = `src/pages/Home/ec/GenSettingsPanel.jsx`，并要求把 **①只有中性灰阶无品牌色** 与 **②没有 surface 分层** 作为两个独立维度统计，另附全站 `#fff`/`#000`/`rgba(0,0,0,x)`/`rgba(255,255,255,x)` 硬编码清单。

## A.0 前置校正：总统筹引用与工作区源码不符（重要）

逐行核对后，**总统筹给出的 `GenSettingsPanel.jsx` 行号证据与工作区当前文件不一致**：

| 总统筹描述 | 工作区实际（`src/pages/Home/ec/GenSettingsPanel.jsx`，142 行） |
|---|---|
| :107-108 选中态 `border 1.5px #1F1D1A` / `background rgba(31,29,26,0.045)` | :107-108 是**品质区闭合标签** `</div></div>`，无样式 |
| :90 图标底座 `rgba(0,0,0,0.03)` + `border rgba(0,0,0,0.06)` | :90 是 `boxShadow: active ? '0 2px 8px rgba(124,58,237,0.12)' : 'none'` |
| :96 注释自述「选中态统一：中性深色描边 + 浅底」 | :96 是品质圆点 `width: 8, height: 8, borderRadius: '50%'`，**全文件无此注释** |
| 选中态为中性深色 `#1F1D1A` | 选中态是**品牌紫 `#7c3aed`**（:52-54 分辨率卡、:88-90 品质卡） |

**全仓检索 `#1F1D1A` 与 `rgba(31,29,26` → 命中 0 处**（含 9 个 worktree 分支）。该样板描述很可能来自**期望态或某个未落地分支**，而非当前工作区。

**但这不影响总统筹的判断方向**——恰恰相反，本轮发现了更硬的事实：

> ### 🔴 `src/styles/design-tokens-v3.css`（482 行 V3 设计系统）已存在，但完全没有接入任何页面。
>
> | 检查项 | 结果 |
> |---|---|
> | `main.jsx` 是否 import 它 | ❌ 只 import 了 `design-tokens.css`（main.jsx:4） |
> | 全仓检索 `sb-tokens` 字符串 | 仅 1 处命中——**它自己文件头的注释** |
> | 组件里使用 `--sb-*` 或 `.sb-*` 的次数 | **6 行**（几乎为 0） |
> | 文件自述保证（第 13 行） | 「删掉本文件后，现有全站渲染必须与今天完全一致」 |
>
> 即：**团队已写好完整 V3 设计语言（品牌色阶梯、五级 surface、语义状态四件套、控件高度 5 档、z-index 9 档、焦点环、动效、断点收敛），却锁在抽屉里一行没用。** 这解释了为什么改造看起来一直在做却没效果——**产出的是 token 文件，不是页面**。

`design-tokens-v3.css` 可直接复用的资产（改造时应直接引，不要重造）：

- §3 五级 surface：`--sb-surface-page/-panel/-panel-solid/-card/-sunken/-tint/-tint-strong/-inverse`（正是解决「没有分层」的）
- §5 语义四件套：`--sb-{danger,success,warning,info}-{soft,border,ring}`（正是解决「没有语义色」的）
---
---

---

## A.1 维度一：只有中性灰阶、没有品牌色/语义色 —— 全站命中清单

**统计口径**：扫描 `src/**/*.{jsx,js,css}` 所有 `background/border/color/boxShadow` 声明行；若该行色值**全部**属中性族（`#fff #000 #1a1a1a #333 #666 #999 #aaa #ccc #ddd #eee #f5f5f5` 等灰阶，或 `rgba(0,0,0,x)` / `rgba(255,255,255,x)`），且不含品牌色 hex 或 `--red/--blue/--green/--accent` 变量，计为「纯中性行」。

### 总览

| 指标 | 数值 |
|---|---|
| 纯中性样式声明行 | **829 行** |
| 分布文件数 | **42 个** |
| 占全部含色声明行比例 | 约 **62%** |

### 命中文件清单（按行数降序，前 15）

| 文件 | 纯中性行数 | 代表位置 |
|---|---|---|
| `src/pages/Home/Home.css` | **198** | :29 `#aaa`；:58/:70/:106 `background:#fff`；:225/:266 `#fff` |
| `src/pages/Home/XhsContentMode.jsx` | **82** | :536 `#fff`；:538 `rgba(0,0,0,0.12)`；:576 `#1a1a1a`/`rgba(0,0,0,0.05)` |
| `src/pages/Plog/index.jsx` | **68** | :9 `color:#E8E8E8, accent:#555`；:226 `#111`；:231 `#000`；:243 `rgba(0,0,0,0.75)` |
| `src/NoteModal.jsx` | **65** | :155 `#000`；:159 `rgba(255,255,255,0.15)`；:174 `rgba(0,0,0,0.6)` |
| `src/pages/EcStudio/index.jsx` | **43** | :24 `#fff`+`#E0E0E6`；:32 `#666`；:390 `rgba(0,0,0,.45)` |
| `src/pages/Home/ec/DesignDirection.jsx` | **42** | :186 `#fff`+`rgba(0,0,0,0.08)`；:192/:209 `#1a1a1a`；:224 `#9ca3af` |
| `src/pages/Home/EcMode.jsx` | **39** | :37 `rgba(255,255,255,0.8)`；:42/:48/:51；:450 `#fff`/`#999` |
| `src/pages/EcCanvas/index.jsx` | **32** | :87 `rgba(0,0,0,0.05)`；:109 `#fff`；:133 `#1a1a1a`；:134 `#aaa` |
| `src/pages/EcAuto/index.jsx` | **24** | :102 `#999`+`#f0f0f0`；:108 `#666`+`#e0e0e0`；:120 `#888` |
| **`src/pages/Home/ec/GenSettingsPanel.jsx`** | **21** | :18 `rgba(0,0,0,0.08)`；:19/:53/:62/:89 `#fff`；:61 `rgba(0,0,0,0.06)` |
| `src/pages/Home/ec/SizingPanel.jsx` | **21** | :65 `rgba(0,0,0,0.06/0.14)`；:66 `rgba(0,0,0,0.03)`/`#fff`；:69 `#1a1a1a` |
| `src/pages/Home/ec/DesignDirectionView.jsx` | **20** | :55 `#0f0f1a`+`#fff`；:59-66 全 `rgba(255,255,255,x)` |
| `src/pages/Home/EcLegacyForm.jsx` | **19** | :8 `#555`；:10 `#e8e8e8`；:21 `rgba(0,0,0,0.04)` |
| `src/pages/Home/ec/StylePanel.jsx` | **16** | :119-120 `#1a1a1a`；:123-124 `rgba(0,0,0,0.06/0.03)`；:128-129 |
| `src/components/business/Modals.jsx` | **16** | :104 `#999`+`#f5f5f5`；:168 `rgba(0,0,0,0.5)`；:180/:182 |

（其余 27 个文件各 1–15 行。）

### 单独点名：样板文件 `GenSettingsPanel.jsx` 的纯中性证据

| 行 | 内容 | 说明 |
|---|---|---|
| :18 | `border: '1.5px solid rgba(0,0,0,0.08)'`（`cardBase`） | 卡片描边走纯黑透明度，未走 token |
| :19 | `background: '#fff'`（`cardBase`） | 硬编码白 |
| :33 | `borderBottom: '1px solid rgba(0,0,0,0.06)'` | 头部分割线纯黑 |
| :52 / :57 | `#7c3aed` vs `rgba(0,0,0,0.08)` | **选中/未选中的切换 = 品牌色 ↔ 纯中性灰** |
| :61 | `background: active ? '#7c3aed' : 'rgba(0,0,0,0.06)'` | 同上，图标底座 |
| :62 | `color: active ? '#fff' : 'var(--text-muted)'` | 选中态用纯白 |
| :88 / :93 | 同 :52/:57 的品质版 | 同一模式重复 |
| :97 | `background: active ? '#7c3aed' : 'rgba(0,0,0,0.15)'` | 圆点 |
| :122 | `background: 'rgba(0,0,0,0.03)'` | tooltip 底 |
| :134 | `border: '1px solid rgba(0,0,0,0.12)'` + `background: 'rgba(0,0,0,0.03)'` | 输入框**纯中性灰底+灰边**，且**无 focus 态** |

**结论**：该面板「未选中态 100% 中性灰阶，选中态才是品牌紫」——面板 90% 的静止画面是黑白灰。真正的缺陷不是「用了 `#1F1D1A`」，而是：

1. **未选中态缺少可见 surface 区分**（`rgba(0,0,0,0.03)` 在 `#fff` 面板上几乎不可见）；
2. **所有描边写死 `rgba(0,0,0,x)` 而非 `--sb-border-*`**，纯黑描边压在暖白底上显脏；
3. **输入框无 focus 视觉**（:128-137 无 `onFocus`），键盘用户不知道焦点在哪。

---

## A.2 维度二：没有 surface 分层（一片平，无嵌套）—— 全站命中清单

**统计口径**：分层失败点满足任一条件——(a) 相邻容器背景色差值小于 3% 不透明度（人眼不可辨）；(b) 面板内子项与面板同色，仅靠 1px 淡边框区分；(c) 出现嵌套卡片但两层圆角不符合公式「内层 = 外层 − padding」。

### 分层失败点全站清单（35 处）

| # | 位置 | 文件:行 | 外层 surface | 内层 surface | 类型 | 证据 |
|---|---|---|---|---|---|---|
| 1 | 生图设置 · 分辨率卡未选中 | `GenSettingsPanel.jsx:18-19,52` | 面板 0.85 白 | `#fff` + `1.5px rgba(0,0,0,0.08)` | a+b | **同色叠同色，仅靠 8% 纯黑描边区分** |
| 2 | 生图设置 · 品质卡未选中 | `GenSettingsPanel.jsx:88` | 同上 | 同上 | a+b | 同 #1，且卡更矮（flex:1 + 10px padding），层级更弱 |
| 3 | 生图设置 · 图标底座 | `GenSettingsPanel.jsx:61` | 卡片 `#fff` | `rgba(0,0,0,0.06)` | a | 6% 纯黑在白底约等于 `#F0F0F0`，**三层同色系堆叠，零层次** |
| 4 | 生图设置 · 三段之间 | `GenSettingsPanel.jsx:39` | — | — | a | 分辨率/品质/负向提示词**仅靠 gap:16 分隔**，无分割线无分组标题 |
| 5 | 生图设置 · 输入框 | `GenSettingsPanel.jsx:134` | 面板白 | `rgba(0,0,0,0.03)` | a | 3% 纯黑几乎不可见，**输入框没有凹槽感** |
| 6 | 产品参数 · 全部输入框 | `ParamsPanel.jsx:7-11,42` | 面板白 | `rgba(0,0,0,0.03)` | a | 6 个输入框全部无凹槽 |
| 7 | 文案策划 · 5 个 textarea | `CopyPanel.jsx:7-12` | 面板白 | `rgba(0,0,0,0.025)` | a | **2.5% 纯黑**，比 #6 更淡，两个面板凹陷程度还不一致 |
| 8 | SKU 面板 · 变体卡 | `SkuPanel.jsx:62-68` | 面板白 | `rgba(0,0,0,0.03)` + `1px rgba(0,0,0,0.06)` | a+b | 唯一做了卡中卡，但 3% 灰 + 6% 边，**几乎看不出卡的存在** |
| 9 | 套图配置 · 图片类型行未勾选 | `SizingPanel.jsx:266-272` | 面板白 | `transparent` + `1.5px transparent` | b | **未勾选行完全无边框无底色**，与面板融为一体 |
| 10 | 套图配置 · 智能方案提示条 | `SizingPanel.jsx:254` | 面板白 | `rgba(0,0,0,0.025)` | a | 2.5% 灰提示条，无强调 |
| 11 | 画面风格 · 风格卡未选中 | `StylePanel.jsx:119-120` | 面板白 | `rgba(0,0,0,0.03)` + `1.5px rgba(0,0,0,0.08)` | a+b | 同 #1 模式 |
| 12 | 画面风格 · 品牌色盒 | `StylePanel.jsx:150-155` | 面板白 | `rgba(0,0,0,0.03)` | a | 3% 灰盒装开关，无层次 |
| 13 | 画布 · 节点卡图片区 | `EcCanvas/index.jsx:112,132` | 卡片 `#fff` | `#f5f5f5` | a | 差 4%，图片区与卡身几乎无界 |
| 14 | 画布 · 工具栏分组 | `EcCanvas/index.jsx:550-584` | 工具栏 0.9 白 | 各组 `rgba(0,0,0,0.05)` | a+b | 三段底色一样、gap 一样，**无分组无分隔线** |
| 15 | 画布 · Tab 容器 vs 缩放组 | `EcCanvas/index.jsx:556,564` | — | — | b | 两个灰底容器**圆角 10 vs 8**，紧邻却不同规格 |
| 16 | 精修工坊 · 6 张主卡 | `EcStudio/index.jsx:333,553,583,614,748,807,827` | 页面 `#F6F7F9` | `#fff` + `1px #E0E0E6` | — | 页面与卡有对比，但**6 张同规格卡直排，卡间零层级** |
| 17 | 精修工坊 · 智能一键框 | `EcStudio/index.jsx:507-512` | 页面灰 | 渐变 `#EEF2FF→#F5F3FF` | — | 唯一有区分的卡，但用**靛蓝系**，与紫品牌不搭 |
| 18 | 精修工坊 · SKU 行 | `EcStudio/index.jsx:702-707` | 卡 `#fff` | `#FAFBFC` + `1px #EEEEF2` | a | `#FAFBFC` vs `#fff` 差 1.6%，**几乎同色** |
| 19 | 精修工坊 · 详情切片卡未勾选 | `EcStudio/index.jsx:764-766` | 卡 `#fff` | `#FAFBFC` + `1px #EEEEF2` | a | 同 #18 |
| 20 | Plog · 5 张区块卡 | `Plog/index.jsx:409,427,450,472,494` | 页面 `#FAFAFA` | `#fff` + `1px #eee` | — | 页面与卡有对比，但 **5 张同规格 radius16+padding20，零层级** |
| 21 | Plog · 选项卡未选 | `Plog/index.jsx:436-437` | 区块卡 `#fff` | `#fff` + `2px #eee` | a+b | **白卡里再放白卡**，靠 2px 浅灰边区分 |
| 22 | Plog · 封面变体卡 | `Plog/index.jsx:459-460` | 同上 | 同上 | a+b | 同 #21，4 列更小更挤 |
| 23 | 定价页 · Tab pill | `Pricing/index.jsx:89,99` | 页面 `var(--bg)` | 容器 `rgba(0,0,0,0.04)`，选中 `#fff` | a | 4% 灰容器 + 白 pill，**在暖白页面上灰几乎不可见** |
| 24 | 定价页 · 套餐卡 | `Pricing/index.jsx:127` | 页面 `var(--bg)` | 卡 `#fff` | — | 正常 |
| 25 | 作品页 · 卡片 | `Works/index.jsx:177` + `ui/index.jsx:12` | 页面 `var(--bg)` | `--bg-card` = `rgba(255,255,255,0.88)` | a | 0.88 白叠暖白，**对比被稀释**，40px 圆角更削弱边界 |
| 26 | 首页 · surface-card | `Home/index.jsx:100` + `design-tokens.css:293` | 页面 `var(--bg)` | 卡 `#fff` + `surface-card-inner` | c | **外层 30px / 内层 26px** 但内层 padding:0，嵌套公式失效 |
| 27 | 首页 · 模式切换容器 | `Home/index.jsx:55` | surface-card `#fff` | `rgba(0,0,0,0.04)`，选中 `#1a1a1a` | a | 4% 灰在 `#fff` 上极弱，**唯一层级来自选中态的黑** |
| 28 | 首页 · EcMode 暖黄卡 | `EcMode.jsx:492` | surface-card `#fff` | `#FAF7F2` + `1px rgba(139,92,246,0.06)` | c | 外层30/内层20/padding16，按公式应 30−16=14，**实际 20，圆角关系错误** |
| 29 | 首页 · 配置按钮行 | `EcMode.jsx:683-835` | 暖黄卡 | 6 按钮 `rgba(255,255,255,0.85)` | — | 白按钮浮米白卡有对比，但**按钮间零分组** |
| 30 | 画布 · 作品集卡 | `EcCanvas/index.jsx:656` | 页面 `#F0EEE9` | 卡 `#fff` | — | 正常 |
| 31 | 画布 · 操作提示 | `EcCanvas/index.jsx:641-644` | 画布 `#F0EEE9` | 裸文字 `rgba(0,0,0,0.28)` | a | **操作提示是裸文字**，无容器无背景，辨识度极低 |
| 32 | 画布 · 分组标题 | `EcCanvas/index.jsx:617` | 画布底色 | `rgba(0,0,0,0.35)` 文字 | a | 35% 黑文字**直接压在画布上**无背板，缩小时看不清 |
| 33 | 小地图 | 全仓 | — | — | — | **未找到小地图实现**：`EcCanvas` 只有缩放百分比 + fitView 按钮，无 minimap。属功能缺失而非样式问题 |
| 34 | 登录弹窗 · 输入框 | `Modals.jsx:70-77` | Modal `#fff` | 透明 + `1.5px var(--border)` | b | **透明背景输入框**，只有一根淡边，凹陷感为零 |
| 35 | 作品页 · EC 标签 | `Works/index.jsx:229-232` | 卡 `--bg-card` | `#f5f5f5` | a | 4% 灰 chip 在白卡上极弱 |

**小计：35 个分层失败点。类型 a（同色/微差）24 处、类型 b（仅靠淡边框）8 处、类型 c（嵌套圆角公式错误）2 处。**

### 与 `design-tokens-v3.css` 的对照（说明本可不必如此）

`design-tokens-v3.css` §3 已定义**五级 surface**，正是为解决上述问题而写：

| 级别 | token | 值 | 本应替换掉的现状 |
|---|---|---|---|
| L0 页面 | `--sb-surface-page` | `#FAF7F2` | 现状 7 种页面底色 |
| L1 面板 | `--sb-surface-panel` | `rgba(255,255,255,0.85)` | GLASS_PANEL 硬编码 0.85（数值对但没引 token） |
| L2 卡片 | `--sb-surface-card` | `#FFFFFF` | 各处 `#fff` |
| L2- 凹槽 | `--sb-surface-sunken` | `#EFEAE1` | **正是失败点 #5/#6/#7/#9 的解** |
| L3 轻着色 | `--sb-surface-tint` | `rgba(12,10,9,0.03)` | 现状 `rgba(0,0,0,0.03)`（纯黑 vs 暖黑，色相就错了） |
| L3 强着色 | `--sb-surface-tint-strong` | `rgba(12,10,9,0.06)` | 现状 `rgba(0,0,0,0.06)` |

**关键差异**：`sb-tokens` 用的是**暖黑 `rgba(12,10,9,·)`**（与 `--bg:#F5EFE4` 同色相），而现状代码全用**纯黑 `rgba(0,0,0,·)`**。这正是 `rgba(0,0,0,0.03)` 叠在暖白上发灰发脏的原因——**底色暖、覆盖层冷，色相打架**。仅把全站 `rgba(0,0,0,` 换成 `rgba(12,10,9,` 就能立刻改善观感。

---

## A.3 硬证据表：全站 `#fff`/`#000`/`rgba(0,0,0,x)`/`rgba(255,255,255,x)` 硬编码清单

**统计口径**：脚本遍历 `src/**/*.{jsx,js,css}`，正则匹配所有 `#RRGGBB` / `#RGB` 与 `rgba(0,0,0,α)` / `rgba(255,255,255,α)`（含空格变体），按取值聚合计数。含色声明行共 **1413 行**。

### A.3.1 中性色值频次总表（Top 60）

| 色值 | 次数 | 代表位置 |
|---|---|---|
| `#fff` | **295** | `EcAuto/index.jsx:108`、`:128`、`:149` |
| `#999` | **65** | `EcAuto/index.jsx:102`、`:138`、`:202` |
| `#333` | **46** | `EcAuto/index.jsx:161`、`:201`、`EcCanvas/index.jsx:167` |
| `rgba(0,0,0,0.04)` | **45** | `EcAuto/index.jsx:150`、`:193`、`:227` |
| `rgba(0,0,0,0.06)` | **44** | `EcCanvas/ContextMenu.jsx:39`、`:48`、`EcCanvas/index.jsx:161` |
| `#888` | **41** | `EcAuto/index.jsx:120`、`EcStudio/index.jsx:419`、`:444` |
| `#1a1a1a` | **40** | `EcCanvas/ContextMenu.jsx:56`、`EcCanvas/index.jsx:133`、`:553` |
| `#666` | **39** | `EcAuto/index.jsx:108`、`:113`、`:252` |
| `#f5f5f5` | **34** | `EcAuto/index.jsx:252`、`:281`、`:298` |
| `#eee` | **33** | `EcAuto/index.jsx:151`、`:193`、`:227` |
| `rgba(0,0,0,0.08)` | **32** | `EcCanvas/ContextMenu.jsx:38`、`EcCanvas/index.jsx:558`、`DesignDirection.jsx:186` |
| `#f0f0f0` | **29** | `EcAuto/index.jsx:102`、`:267`、`EcCanvas/index.jsx:88` |
| `#e0e0e0` | **26** | `EcAuto/index.jsx:108`、`:113`、`:175` |
| `#ddd` | **26** | `DesignDirection.jsx:475`、`EcLegacyForm.jsx:132`、`:155` |
| `#555` | **25** | `EcStudio/index.jsx:488`、`:779`、`SizingPanel.jsx:98` |
| `#bbb` | **19** | `EcAuto/index.jsx:167`、`EcCanvas/index.jsx:601`、`EcStudio/index.jsx:587` |
| `#ccc` | **19** | `EcLegacyForm.jsx:155`、`EcMode.jsx:546`、`:557` |
| `rgba(0,0,0,0.03)` | **17** | `DesignDirection.jsx:315`、`GenSettingsPanel.jsx:122`、`:134` |
| `#aaa` | **15** | `EcCanvas/index.jsx:134`、`EcStudio/index.jsx:365`、`:741` |
| `rgba(0,0,0,0.5)` | **14** | `Gallery/index.jsx:81`、`Home.css:391`、`:602` |
| `rgba(0,0,0,0.15)` | **14** | `DesignDirection.jsx:337`、`GenSettingsPanel.jsx:97`、`SizingPanel.jsx:276` |
| `#e8e8e8` | **14** | `EcAuto/index.jsx:127`、`EcCanvas/index.jsx:88`、`:89` |
| `rgba(0,0,0,0.12)` | **12** | `GenSettingsPanel.jsx:134`、`ParamsPanel.jsx:9`、`SizingPanel.jsx:305` |
| `rgba(0,0,0,0.1)` | **11** | `DesignDirection.jsx:459`、`ParamsPanel.jsx:68`、`SizingPanel.jsx:239` |
| `#d0d0d0` | **11** | `Home.css:336`、`:399`、`:521` |
| `rgba(0,0,0,0.2)` | **9** | `EcCanvas/index.jsx:700`、`StylePanel.jsx:179`、`XhsContentMode.jsx:580` |
| `rgba(0,0,0,0.02)` | **9** | `EcCopywriting.jsx:31`、`EcMode.jsx:42`、`EcProductParams.jsx:42` |
| `#fafafa` | **9** | `DesignDirectionView.jsx:11`、`EcLegacyForm.jsx:97`、`Home.css:404` |
| `#f8f8f8` | **9** | `EcAuto/index.jsx:266`、`EcStudio/index.jsx:1061`、`Home.css:480` |
| `#444` | **8** | `EcAuto/index.jsx:135`、`Home.css:408`、`:1289` |
| `rgba(0,0,0,0.05)` | **8** | `EcCanvas/index.jsx:87`、`:551`、`:556` |
| `rgba(0,0,0,0.10)` | **8** | `EcCanvas/index.jsx:108`、`CopyPanel.jsx:9`、`:65` |
| `rgba(255,255,255,0.95)` | **8** | `Gallery/index.jsx:112`、`EcMode.jsx:52`、`:353` |
| `rgba(255,255,255,0.9)` | **7** | `EcCanvas/index.jsx:550`、`DesignDirectionView.jsx:65`、`:114` |
| `rgba(0,0,0,0.6)` | **7** | `DesignDirection.jsx:378`、`:411`、`XhsContentMode.jsx:653` |
| `rgba(255,255,255,0.06)` | **7** | `DesignDirectionView.jsx:57`、`:59`、`:61` |
| `rgba(255,255,255,0.15)` | **7** | `DesignDirectionView.jsx:98`、`:104`、`UploadBox.jsx:51` |
| `rgba(255,255,255,0.5)` | **7** | `DesignDirectionView.jsx:123`、`EcMode.jsx:52`、`Home.css:1677` |
| `rgba(0,0,0,0.3)` | **7** | `EcRefImages.jsx:82`、`GallerySection.jsx:67`、`Home.css:1703` |
| `rgba(255,255,255,0.85)` | **6** | `EcMode.jsx:48`、`:767`、`:786` |
| `#222` | **6** | `Home.css:366`、`:813`、`:912` |
| `rgba(0,0,0,0.45)` | **4** | `Gallery/index.jsx:87`、`Home.css:1483`、`ui/index.jsx:36` |
| `rgba(0,0,0,0.4)` | **4** | `Gallery/index.jsx:98`、`:107`、`Home.css:1674` |
| `rgba(255,255,255,0.4)` | **4** | `Generate/Loading.jsx:95`、`DesignDirectionView.jsx:80`、`:116` |
| `#ffffff` | **4** | `DesignDirectionView.jsx:11`、`StylePanel.jsx:202`、`XhsContentMode.jsx:605` |
| `rgba(255,255,255,0.1)` | **4** | `DesignDirectionView.jsx:60`、`Plog/index.jsx:606`、`:610` |
| `rgba(255,255,255,0.8)` | **4** | `EcMode.jsx:37`、`:465`、`:770` |
| `rgba(0,0,0,0.25)` | **4** | `Home/index.jsx:66`、`:82`、`NoteModal.jsx:192` |
| `#e5e5e5` | **3** | `DesignDirection.jsx:444`、`StylePanel.jsx:12`、`EcMode.jsx:825` |
| `#000` | **3** | `Plog/index.jsx:231`、`NoteModal.jsx:155`、`:875` |
| `rgba(255,255,255,0.35)` | **3** | `DesignDirectionView.jsx:66`、`:115`、`UploadBox.jsx:91` |
| `rgba(255,255,255,0.7)` | **3** | `DesignDirectionView.jsx:106`、`EcMode.jsx:51`、`Navbar.jsx:96` |
| `#111` | **2** | `Home.css:1608`、`Plog/index.jsx:226` |
| `rgba(255,255,255,0.75)` | **2** | `Home/index.jsx:37`、`Navbar.jsx:42` |
| `rgba(0,0,0,0.16)` | **2** | `EcCanvas/ContextMenu.jsx:38`、`EcCanvas/index.jsx:161` |
| `rgba(0,0,0,0.35)` | **2** | `EcCanvas/index.jsx:617`、`SizingPanel.jsx:42` |
| `rgba(0,0,0,0.75)` | **2** | `EcCanvas/index.jsx:692`、`Plog/index.jsx:243` |
| `rgba(255,255,255,0.2)` | **2** | `EcCanvas/index.jsx:694`、`EcMode.jsx:446` |
| `rgba(0,0,0,0.025)` | **2** | `CopyPanel.jsx:9`、`SizingPanel.jsx:254` |
| `rgba(0,0,0,0.14)` | **2** | `SizingPanel.jsx:65`、`:81` |
| `rgba(0,0,0,0.92)` | **2** | `XhsContentMode.jsx:1206`、`Plog/index.jsx:602` |
| `rgba(255,255,255,0.96)` | **2** | `Navbar.jsx:170`、`TaskSidebar.jsx:56` |

（单次出现的长尾共 40+ 项，含 `rgba(0,0,0,0.01/0.07/0.18/0.28/0.55/0.7/0.85/.45/.92)`、`rgba(255,255,255,0.02/0.03/0.08/0.25/0.45/0.6/0.97/0.98)`，以及 `#fafafb #f6f7f9 #f0eee9 #f5f0eb #f8f3ea #faf0e4` 等。）

### A.3.2 按「透明黑 / 透明白」拆分的合计

| 族 | 不同取值数 | 总出现次数 | 结论 |
|---|---|---|---|
| `#fff` / `#ffffff` | 2 | **299** | 单值最高频，**全部应替换为 `--sb-surface-card` / `--sb-ink-on-dark`** |
| `rgba(0,0,0,α)` | **23 种不同 α** | **约 320** | α 取值 0.01–0.92，**仅 0.03 一档就分 0.025/0.03/0.04 三种写法** |
| `rgba(255,255,255,α)` | **18 种不同 α** | **约 90** | 0.02–0.98 全谱系 |
| 灰阶 hex（`#000`–`#eee`） | **28 种** | **约 480** | `#999`(65) `#333`(46) `#888`(41) `#1a1a1a`(40) `#666`(39) 五档占 231 次 |

**合计中性色硬编码约 1190 处，分布在 46 个文件。**

### A.3.3 三个可直接执行的替换（收益最大、风险最低）

| 替换 | 影响处数 | 说明 |
|---|---|---|
| `rgba(0,0,0,` → `rgba(12,10,9,`（暖黑） | **约 320** | 仅改色相不改 α，**视觉立刻从「发灰」变「暖」**，零布局风险。对应 `--sb-border-subtle/default/strong` 与 `--sb-surface-tint` |
| `#fff` → `var(--sb-surface-card)` | **约 299** | 与上一条配套；后续改暗色/换肤时一处生效 |
| 灰阶文字 `#999/#666/#888/#555/#333/#aaa/#bbb/#ccc` → `--sb-ink-1..5` | **约 280** | 现状 9 档灰文字，`sb-tokens` 只保留 5 档 ink |

> **注意**：`design-tokens-v3.css` 目前**没有被 import**，上述替换生效前必须先做两件事：① 在 `main.jsx:4` 后追加 `import './styles/design-tokens-v3.css'`；② 确认 `design-tokens-v3.css` 的 `:root` 与 `design-tokens.css` **无同名变量冲突**（该文件自述「只新增 `--sb-*` 命名空间」，已核对无冲突，可安全引入）。

---

## A.4 修订后的 Top 10（合并第一轮结论 + 本轮新证据）

| 新排名 | 项 | 依据 | 变化 |
|---|---|---|---|
| **1** | **把 `design-tokens-v3.css` 接进 `main.jsx`** | 482 行 V3 设计系统零接入（A.0） | 🆕 新增，**应排在所有 UI 改动之前**，否则后续每改一处都继续硬编码 |
| **2** | `rgba(0,0,0,` 全站换暖黑 `rgba(12,10,9,` | 约 320 处（A.3.3） | ⬆️ 单条改动收益最大 |
| **3** | `GenSettingsPanel.jsx` 未选中态与输入框 | 21 行纯中性（A.1）；输入框无凹槽无 focus | ⬆️ 总统筹点名样板，升入前三 |
| 4 | `EcMode.jsx:819-834` 下一步 38px/12px | 第一轮 #1 | ⬇️ |
| 5 | `Home/index.jsx:55-88` 模式切换纯黑白 | 第一轮 #2 | ⬇️ |
| 6 | 35 处分层失败点（A.2）批量修 surface | 类型 a 24 处可批量 | 🆕 新增 |
| 7 | `Home.css:103-131` 输入框呼吸动画 | 第一轮 #3 | ⬇️ |
| 8 | `EcMode.jsx:504 vs 595` 红蓝撞色 | 第一轮 #4 | ⬇️ |
| 9 | `EcCanvas/index.jsx:548` 画布底色跳色 | 第一轮 #7 | — |
| 10 | `Plog/index.jsx:396,522` 第三套皮肤 | 第一轮 #14 | ⬆️ |

### 给落地 agent 的执行顺序（硬性）

1. **先接 token**：`main.jsx` 追加 import，跑一次构建确认零回归（`design-tokens-v3.css` 第 13 行已保证）。
2. **再做全局色相替换**：`rgba(0,0,0,` → `rgba(12,10,9,`、`#fff` → token。不改布局、不改尺寸，风险最低、收益最大。
3. **再做 surface 分层**：按 A.2 的 35 处清单，优先修类型 a（24 处，多为改一个变量）。
4. **最后做尺寸统一**：主 CTA 组件化（第一轮 §3.1，12 处 → 1 个组件）。

**切忌反序**——若先改尺寸而不先接 token，会把新硬编码再种一遍。

---

## A.5 附录审计口径补充

- 中性色统计：匹配 `background|border|borderColor|color|boxShadow|backgroundColor` 声明行，行内色值全属中性族则计入。
- 色值频次统计：全量匹配 `#RRGGBB`/`#RGB` 与 `rgba(0,0,0,α)`/`rgba(255,255,255,α)`（兼容空格变体），聚合计数，含色声明行总数 1413。
- 所有行号以当前工作区 `F:\da\shubao` 为准，可直接跳转。
- 本轮**未修改任何 `src/` 下文件**，未 commit。`design-tokens-v3.css` 为上轮审计后新出现的文件，本轮已核实其未被引用。

---

# 附录 B · 视觉语言双轨量化（第二轮补充 · 总统筹第二条证据）

> 触发：总统筹指出 **token 层第 12-16 行 `--accent: #0C0A09`「强调色（近黑极简，无彩色主色）」就是全站既定主色**，而画布侧用的是品牌紫 —— **全站存在两套打架的视觉语言**。
>
> **核对结论：总统筹判断完全正确。** `src/styles/design-tokens.css:12-16` 原文：
>
> ```css
> /* ── 强调色（近黑极简，无彩色主色）── */
> --accent: #0C0A09;          /* 主强调色(近黑) */
> --accent-hover: #2A2521;    /* 悬停 */
> --accent-muted: #444038;    /* 次要强调 */
> --accent-bg: rgba(12, 10, 9, 0.06);  /* 强调背景 */
> ```
>
> 即：**「黑白极简」是 token 层的官方身份声明，不是个别组件失误**。而画布链路完全不引用 `--accent`，自成一套紫色体系。

## B.1 量化表 1：`var(--accent*)` 使用点清单（共计 59 次 / 15 文件）

这些位置**当前渲染为近黑 `#0C0A09`**：

| 文件 | 次数 | 具体行号 |
|---|---|---|
| `src/pages/Pricing/index.jsx` | **10** | 72,102,126,131,132,142,147,161,208,247 |
| `src/components/business/Modals.jsx` | **9** | 205,232,257,264,265,277,282,299,358 |
| `src/components/layout/Navbar.jsx` | **7** | 62,78,98,112,120,185,190 |
| `src/pages/Home/EcPlatformPicker.jsx` | **6** | 52,84,119,144,167 |
| `src/pages/Home/XhsContentMode.jsx` | **5** | 548,549,617,676,809 |
| `src/styles/design-tokens.css` | 5 | 136,169,173,185（定义与 `.btn-primary`/`.btn-ghost`） |
| `src/components/task/TaskSidebar.jsx` | **4** | 79,92,145,182 |
| `src/components/task/BatchProgress.jsx` | 3 | 39,52,125 |
| `src/App.jsx` | 2 | 156,162（TopBar 套餐按钮） |
| `src/pages/Home/EcProductParams.jsx` | 2 | 63,64 |
| `src/pages/Home/GallerySection.jsx` | 2 | 22,73 |
| `src/components/task/ReadProgress.jsx` | 1 | 61 |
| `src/pages/Home/EcCopywriting.jsx` | 1 | 37 |
| `src/pages/Home/EcRefImages.jsx` | 1 | 110 |
| `src/pages/Home/index.jsx` | 1 | 42（主标题 H1） |

**关键观察**：`--accent` 的 59 次使用中，**有 46 次落在链路 A（主站/电商/定价），画布链路 0 次**。连 `Home/index.jsx` 的主标题 H1 都是近黑。

---

## B.2 量化表 2：硬编码紫色使用点清单（共计 293 次 / 28 文件）

**匹配范围**：`#7c3aed` `#8b5cf6` `#a855f7` `#c4b5fd` `#a78bfa` `#7c7cff` `#6d28d9` `#ddd6fe` `#ede9fe` `#f5f3ff` `#6366f1`，以及 `rgba(124,58,237,·)` / `rgba(167,139,250,·)` / `rgba(139,92,246,·)` / `rgba(99,102,241,·)`，与 `purple`/`violet`/`indigo` 字面量。**这就是「画布那套语言」的实际范围 —— 它早已溢出到首页电商链路。**

| 文件 | 次数 | 行号（截断显示） |
|---|---|---|
| `src/pages/Home/Home.css` | **63** | 344,406,421,435,449,464,479,491,493,509,520,540,555,556,558,694,766,769,849,850,894,895,918,967,985,998,1024,1034,1048,1077,1111,1118,1120,1183,1194,… |
| `src/pages/Home/EcMode.jsx` | **27** | 52,429,431,436,448,477,492,582,585,761,764,766,770,772,777,779,785,789,794,796,810,824,829,831,832 |
| `src/pages/EcStudio/index.jsx` | **22** | 297,310,430,473,480,510,517,529,629,644,661,672,722,766,796,821,850,1003,1190,1191,1192 |
| `src/pages/Home/ec/DesignDirection.jsx` | **21** | 208,223,261,262,361,369,382,383,384,385,386,444,475,477,493,494,500,509,515 |
| **`src/pages/EcCanvas/index.jsx`** | **19** | 108,118,168,195,196,571,582,602,635,663,700 |
| `src/styles/design-tokens-v3.css` | 18 | 28-37（品牌色阶梯定义）、41-47（品牌语义变量） |
| `src/pages/Home/ec/GenSettingsPanel.jsx` | **17** | 43,52,53,54,56,61,67,79,88,89,90,92,97,101,113 |
| `src/pages/Home/ec/DesignDirectionView.jsx` | **13** | 19,73,79,81,94,95,114,118,144,150 |
| `src/pages/Home/ec/CopyPanel.jsx` | **11** | 44,45,46,58,64,71,72,73,74,84 |
| `src/pages/Home/ec/StylePanel.jsx` | **10** | 9,30,96,97,98,151,153,162,172 |
| `src/pages/Home/EcLegacyForm.jsx` | **10** | 17,132,181,229,249,267,272,284,300,307 |
| `src/pages/Home/ec/SizingPanel.jsx` | **9** | 41,42,91,92,98,218,219,220 |
| `src/App.jsx` | **8** | 72,73,78,81,98（SideNav + TopBar） |
| `src/pages/Home/XhsContentMode.jsx` | **8** | 776,782,785,786,881,1166,1255,1285 |
| `src/components/business/Modals.jsx` | 5 | 247,318,319,325 |
| `src/pages/Pricing/index.jsx` | 5 | 117,174,175,180 |
| `src/components/task/ReadProgress.jsx` | 4 | 38,48,52,71 |
| `src/pages/Home/ec/ParamsPanel.jsx` | 4 | 44,45,46 |
| `src/pages/Remake/index.jsx` | 4 | 231,387,389 |
| `src/constants/data.js` | 3 | 10,17 |
| `src/pages/Home/ec/SkuPanel.jsx` | 3 | 126 |
| `src/components/layout/Navbar.jsx` | 2 | 55（Logo 渐变） |
| `src/pages/EcAuto/index.jsx` | 2 | 128,138 |
| 其余 6 文件各 1 次 | 6 | `TaskSidebar.jsx:19`、`ui/Toast.jsx:27`、`ui/UploadBox.jsx:61`、`EcCanvas/ContextMenu.jsx:66`、`styles/design-tokens.css:286` |

### 按链路拆分（这是本表最重要的结论）

| 链路 | 文件数 | 硬编码紫 | `var(--accent*)` | 主导语言 |
|---|---|---|---|---|
| **A：首页 / 电商 / 主站** | 37 | **152 次** | **46 次** | **两套混用**（Home.css + ec/* 全紫，Pricing/Navbar/Works 走近黑） |
| **B：画布 / 工作流** | 3 | **22 次** | **0 次** | **纯紫，零 token** |

链路 A 内部的紫分布（Top）：`EcMode.jsx` 26、`ec/DesignDirection.jsx` 21、`ec/GenSettingsPanel.jsx` 17、`ec/DesignDirectionView.jsx` 13、`ec/CopyPanel.jsx` 11、`ec/StylePanel.jsx` 10、`ec/SizingPanel.jsx` 9、`EcStudio/index.jsx` 8、`App.jsx` 8。

**→ 结论比总统筹预估更严重：紫色不止在画布，首页的整个电商配置链路（ec/ 六个面板 + EcMode）也全是紫。真正「近黑」的只有：Pricing 页、Navbar、Works 页、以及各页的通用文字/描边。**

---

## B.3 量化表 3：其它零散品牌色 / 强调色使用点清单（共计 180 次 / 29 文件）

**匹配范围**：蓝（`#2563eb` `#3b82f6` `#60a5fa` `#4338ca` `#4f46e5` `#3730a3` `#1d4ed8` `#1677ff`）、橙黄（`#f59e0b` `#f97316` `#fbbf24` `#fcd34d` `#e67e22` `#d97706` `#b45309`）、粉红（`#ec4899` `#db2777` `#f43f5e` `#e879f9` `#be185d` `#c2185b`）、绿（`#10b981` `#22c55e` `#14b8a6` `#07c160`）、及对应 rgba 形式。

| 文件 | 次数 | 主要家族 | 行号 |
|---|---|---|---|
| `src/pages/Home/Home.css` | **29** | 靛蓝 `#6366F1/#4F46E5/#4338CA` 为主 | 326,350,360,479,494,509,529,533,555,785,865,913,969,1099,1111,1239,1349,1406,1440,1459,1467,1513,1559,1578,1591,1628,1727,1782,1796 |
| `src/pages/Home/XhsContentMode.jsx` | **27** | 粉 `#BE185D/#c2185b`、橙 `#f59e0b` | 776,782,785,786,845,938,949,1057,1058,1059,1062,1072,1092,1125,1128,1156,1167,1168,1183,1198,1255,1286,1299 |
| `src/pages/EcStudio/index.jsx` | **19** | 靛蓝 `#4338CA/#6366F1`、绿 `#059669` | 34,342,357,435,450,480,496,515,537,645,693,779,851,867,917,1008,1015,1090,1106 |
| `src/pages/Home/ec/DesignDirection.jsx` | **15** | 粉 `#ec4899`、绿 `#22c55e`、红 `#dc2626` | 223,244,247,394,402,415,416,417,418,419,475,500,515 |
| `src/components/business/Modals.jsx` | **12** | 橙/靛/粉/支付宝蓝/微信绿 | 246,248,322,336,340,341,372,373,383,384 |
| `src/pages/EcAuto/index.jsx` | **10** | 靛蓝 `#4338CA`、橙 `#F59E0B` | 112,127,135,175,197,209,243,285,309 |
| `src/pages/EcCanvas/index.jsx` | **10** | 红 `#ef4444`、绿 `#10b981`、琥珀 `#b45309` | 117,135,167,168,576,664,700 |
| `src/pages/Pricing/index.jsx` | **10** | 橙/靛/粉/支付宝蓝/微信绿 | 116,118,177,190,220,221,230,231 |
| `src/styles/design-tokens-v3.css` | 5 | 三色渐变定义 | 47,97,118 |
| `src/NoteModal.jsx` | 4 | 靛蓝 `#4338CA` | 207,259,363,663 |
| `src/pages/Home/ec/SkuPanel.jsx` | 4 | 橙 `#d97706`、绿、红 | 39,40,41 |
| `src/pages/Home/ec/StylePanel.jsx` | 4 | 紫粉橙渐变、蓝 `#3b82f6` | 9,24 |
| `src/pages/Home/EcMode.jsx` | 4 | 紫粉橙渐变 | 582,764,824 |
| `src/components/ui/Toast.jsx` | 3 | 绿 `#10b981`、红 `#ef4444`、橙 `#f59e0b` | 28,29,30 |
| `src/constants/data.js` | 3 | 紫、粉 | 10,11 |
| `src/pages/Works/index.jsx` | 3 | 靛蓝 `#3730A3/#4338CA` | 133,145,226 |
| 其余 13 文件各 1-2 次 | 20 | 分散 | `Navbar.jsx:55,121`（`#e879f9`/`#FCD34D`）、`GenModal.jsx:44,48`、`TaskSidebar.jsx:20,155`、`Home/index.jsx:38`、`App.jsx:163`、`BatchProgress.jsx:62`、`ContextMenu.jsx:66`、`Generate/Loading.jsx:110`、`SizingPanel.jsx:330`、`EcLegacyForm.jsx:272`、`Plog/index.jsx:536`、`Remake/index.jsx:372`、`design-tokens.css:286` |

**关键观察**：这 180 次里有 **68 次是靛蓝 `#6366F1`/`#4338CA` 家族**（Home.css + EcStudio + Modals + NoteModal），构成**第三套语言**。即：

| 语言 | 主色 | 主要占据 |
|---|---|---|
| ① 近黑 | `#0C0A09` | Pricing / Navbar / Works / 全站文字描边 |
| ② 品牌紫 | `#7c3aed` | **画布 + 首页 ec/ 六面板 + EcMode + DesignDirection** |
| ③ 靛蓝 Indigo | `#6366F1` / `#4338CA` | **精修工坊 EcStudio + Home.css 旧表单段 + 各弹窗** |
| ④ 粉/橙/绿点缀 | `#ec4899` / `#f59e0b` / `#059669` | 渐变、状态、支付按钮 |

---

## B.4 双链路视觉语言逐项对照（统一改造依据）

### B.4.1 主色

| 项 | 链路 A：首页 / 电商 / 主站 | 链路 B：画布 / 工作流 | 冲突度 |
|---|---|---|---|
| 主色变量 | `--accent: #0C0A09`（近黑） | **无变量**，硬编码 `#7c3aed` | 🔴 极冲突 |
| 主色使用 | `var(--accent*)` 46 次 + 硬编码紫 152 次（混杂） | 硬编码紫 22 次，`var(--accent)` **0 次** | 🔴 |
| 渐变 | `Home.css:286` 紫→粉→橙；`Pricing` 橙/靛/粉三色图标 | `EcCanvas:582` 紫→`#a78bfa`；`EcMode:824` 紫→粉→橙 | 🟠 |
| 实际观感 | 定价/导航/作品页 = 近黑；首页 ec/ 面板 = 紫 | 全紫 | 🔴 |

### B.4.2 圆角

| 项 | 链路 A | 链路 B | 冲突度 |
|---|---|---|---|
| 定义来源 | `design-tokens.css` `--radius-sm:8 / md:16 / lg:30 / xl:40 / full:9999` | **无**，全部硬编码 | 🔴 |
| 实测分布 | `8px`×88、`10px`×62、`50%`×51、`12px`×44、`6px`×36、`16px`×27、`4px`×22、`20px`×16、`2px`×10、`14px`×10 | `8px`×14、`10px`×8、`12px`×7、`6px`×5、`4px`×4、`14px`×3、`5px`×2、`16px`×1、`50%`×1 | 🟠 |
| 主导圆角 | **8px / 10px**（token 里根本没有这两档） | **8px**（画布工具栏/按钮） | 🟢 巧合一致 |
| 极端值 | `--radius-lg:30`、`--radius-xl:40`（Works 卡 40px、surface-card 30px） | 最大 16px | 🔴 30/40 只出现在 A |
| 画布特有 | — | 节点卡 `12`、缩略图 `8`（`EcCanvas:107,551,565`） | — |

**关键矛盾**：token 定义的主导圆角是 `16/30/40`，**但链路 A 实测最高频是 8px(88) 和 10px(62)，token 里没有这两档** → 说明 token 与实际用法脱节，团队在用「未被定义的圆角」。

### B.4.3 阴影

| 项 | 链路 A | 链路 B | 冲突度 |
|---|---|---|---|
| 暖棕系（品牌调性） | `--shadow-sm/md/lg/xl` = `rgba(57,45,26,·)`；用于 `Gallery`、`Works`、`Navbar` | — | — |
| 纯黑系 | `0 2px 12px rgba(0,0,0,0.04)`、`0 4px 16px rgba(0,0,0,0.06)`、`0 28px 90px rgba(0,0,0,0.2)` | — | — |
| **品牌紫晕** | `EcMode:52` `0 12px 48px rgba(124,58,237,0.15)`；`DesignDirection:269` `` `0 4px 20px ${primaryColor}30` `` | **`EcCanvas:108` 选中态 `0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)`**；`EcCanvas:582` `0 3px 12px rgba(124,58,237,0.30)` | 🔴 A 与 B 共用紫晕，但**近黑语言没有任何近黑影** |
| 阴影总数 | 15 种取值（见 §Q6） | 其中 `0 4px 16px rgba(0,0,0,0.10)`（节点卡默认） | 🟠 |

**结论**：链路 A 因内部混用，出现「暖棕 / 纯黑 / 紫晕」三种阴影；链路 B 只有「纯黑 + 紫晕」。**近黑主色从未产生与之匹配的近黑影**（`0 14px 32px rgba(28,25,23,0.18)` 仅在 TopBar/Navbar 出现 2 次）。

### B.4.4 控件高度

| 项 | 链路 A | 链路 B | 冲突度 |
|---|---|---|---|
| 定义来源 | 无统一 token（`--nav-height:72` 除外） | 无 | 🔴 |
| 实测 Top | `18`×11、`28`×10、`32`×10、`36`×10、`20`×8、`52`×8、`60`×8、`22`×7、`40`×7 | `28`×3、`34`×3、`30`×2、`40`×2、`52`、`72`、`32`、`10`、`8` | 🟠 |
| 主 CTA 高度 | 38 / 42 / 43 / 44 / 45 / 47 / 48 / 52 / 58（9 档） | 画布「新建生图」**34**，空状态按钮 padding `10px 24px`≈42 | 🔴 画布主 CTA 仅 34px，低于 A 的所有主按钮 |
| 工具栏高度 | TopBar ≈78、Navbar 72 | **画布工具栏 52** | 🔴 |
| `sb-tokens` 建议 | `--sb-control-h-xs/sm/md/lg/xl` = 24/28/32/36/44 | 同左 | — |

### B.4.5 选中态做法（差异最大的一项）

| 项 | 链路 A：首页 / 电商 | 链路 B：画布 / 工作流 |
|---|---|---|
| 首选手法 | **换底色 + 换边框色** | **外发光描边（box-shadow ring）** |
| 具体实现 | `GenSettingsPanel:52` `borderColor: active ? '#7c3aed' : 'rgba(0,0,0,0.08)'` + 紫渐变底 | `EcCanvas:108` `boxShadow: selected ? '0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)' : '0 4px 16px rgba(0,0,0,0.10)'` |
| 是否改 border | 是（`1.5px`） | **否**（用 shadow 模拟描边，避免布局抖动） |
| 是否改尺寸 | 否 | 否 |
| 近黑语言的选中态 | `SizingPanel:239-241` `#1a1a1a` 底 + `#fff` 字（**反色填充**） | — |
| 靛蓝语言的选中态 | `EcStudio:643-646` `#EEF2FF` 底 + `#6366F1` 边 + `#4338CA` 字 | — |
| 选中态档数 | **4 种并存**：紫描边+紫底 / 近黑反色 / 靛蓝浅底 / 灰底白 pill | 1 种：紫 ring |

**→ 全站选中态共 5 种不同做法**，这是「没有视觉语言」最直观的体现：用户点同一类东西，反馈方式每次都不一样。

### B.4.6 汇总：两条链路的身份对照

| 维度 | 链路 A（首页/电商/主站） | 链路 B（画布/工作流） |
|---|---|---|
| 主色 | 近黑 `#0C0A09`（官方）／紫 `#7c3aed`（实际混入） | 紫 `#7c3aed`（硬编码） |
| 圆角 | 8/10px 高频，30/40px 极端 | 8px 为主，最大 16px |
| 阴影 | 暖棕 token + 纯黑 + 紫晕（三系混用） | 纯黑 + 紫晕 |
| 控件高度 | 18–58px，9 档主按钮 | 28–40px，主 CTA 仅 34px |
| 选中态 | 4 种（紫描边／近黑反色／靛蓝浅底／灰底白） | 1 种（紫 ring） |
| 视觉气质 | 暖白轻奢 + 近黑，留白大 | 冷白工具感 + 紫，密度高 |

**统一改造的决策点只有两个（必须先定，否则改了也白改）**：

1. **品牌主色到底是近黑还是紫？** —— token 说近黑，但代码里紫出现 293 次、近黑 `var(--accent)` 只出现 59 次，且画布 100% 是紫。若选近黑，需替换 293 处；若选紫，需把 `--accent` 改值并替换 59 处。**建议以「紫为主色 + 近黑为中性强调」收敛**，因为改造成本最低且符合当前多数界面观感。
2. **选中态统一用哪种？** —— 建议采纳链路 B 的 **ring 手法**（`box-shadow: 0 0 0 2px var(--brand)`），优点是不改边框宽度、不引起布局抖动，且能与 `design-tokens-v3.css:232` 已定义的 `--sb-shadow-ring` 直接对齐。

---

## B.5 附录 B 审计口径

- 三张表均由 Node 脚本全量遍历 `src/**/*.{jsx,js,css}` 正则匹配后按文件聚合计数，行号为实际命中行。
- 紫家族匹配含 hex、`rgba(124,58,237,·)`/`rgba(167,139,250,·)`/`rgba(139,92,246,·)`/`rgba(99,102,241,·)` 与 `purple|violet|indigo` 字面量。
- 链路划分：A = `pages/{Home,Pricing,Works,Gallery,Plog,Remake,EcStudio}` + `components/**` + `App.jsx` + `NoteModal.jsx`；B = `pages/{EcCanvas,EcAuto}`。
- 圆角/高度分布为各链路内全部 `borderRadius` / `height` 声明的独立值计数。
- 本轮**未修改任何 `src/` 文件**，未 commit。

---

# 附录 C · 悬停位移被容器裁断（用户报告的真实 bug）

> 触发：总统筹报告「画布库的『新建』卡片悬停上移后被顶部裁断」，要求全站排查带 hover 位移/缩放的元素与其父容器/滚动容器的裁断关系。

## C.0 前置校正：报告中的组件不在当前 src 树内

检索结果：

| 检索项 | 结果 |
|---|---|
| `src/**` 内含「新建」的卡片 | 仅有 `EcCanvas/index.jsx:583` 的「新建生图」按钮（`height:34`，**无 hover 位移**） |
| `src/**` 内「作品集」相关 | `EcCanvas`、`App.jsx`、`AppContext.jsx`、`Modals.jsx`、`DesignDirection.jsx`、`NoteModal.jsx` —— **均无「新建卡片 + hover 上移」组合** |
| 全仓（排除 node_modules/.worktrees）搜「新建画布/新建项目/新建作品/创建新」 | **0 命中** |
| 全仓同时含 hover 位移 + 「新建/创建」的文件 | 19 个，**其中属当前 `src/` 的只有 6 个**，且都不是「卡片」 |
| 含 hover 位移的最近似备份 | `.tmp-anno-verify/backups/CanvasChrome.jsx`（182 行）—— 只有「新建生图」按钮，无卡片 |

**结论**：总统筹描述的「画布库新建卡片」在**当前工作区 `src/` 中不存在**，可能位于未提交分支、独立 canvas 应用、或已删除的文件。
**但该 bug 的成因模式在本仓确实普遍存在**（见 C.1），且我找到了 **4 处已确认命中** —— 审计仍按通用模式给出全站清单与修复建议。

---

## C.1 裁断成因的三种模式

| 模式 | 机制 | 为何会裁 |
|---|---|---|
| **M1 滚动容器边界裁切** | 元素在 `overflow:auto/scroll` 容器内，hover 上移后超出 `scrollTop` 顶部边界 | 滚动容器裁剪其 padding box；**首行/首列元素无余量**，位移量 > 容器 padding 时必裁 |
| **M2 元素自身 overflow:hidden** | 元素同时设 `overflow:hidden` 和 hover 位移 | `overflow:hidden` 裁掉的是**自身内容溢出**，但会连带裁掉位移产生的**阴影/外发光**；若位移值大于自身 padding，内容也会被裁 |
| **M3 父级 overflow:hidden + 无 padding 余量** | 卡片容器 `overflow:hidden`（常为圆角裁切），hover 上移量 > 父容器 padding | 首行/末行卡片位移直接越界被裁 |

**共性根因**：全站 `overflow:hidden` 出现 **89 处**、`overflow:auto/scroll` 出现 **13 处**，但**没有任何一处为 hover 位移预留空间**（无 `padding-top` 补偿、无 `margin` 反向补偿）。

---

## C.2 全站命中清单（27 处 hover 位移/缩放）

图例：❌ 已确认命中 ｜ ⚠️ 潜在风险 ｜ ✅ 安全

| # | 元素 | 文件:行 | 位移量 | 容器/祖先 | 判定 | 说明 |
|---|---|---|---|---|---|---|
| 1 | 首页 hero 生成按钮 | `Home.css:231` | `translateY(-1px)` | .input-card { overflow:hidden }(Home.css:72) | ✅ 安全 | 按钮在 .input-card 内部、非首行；1px 上移不触顶（padding 16px margin） |
| 2 | 首页 风格卡 | `Home.css:521` | `translateY(-2px)` | 无（父 .ec-style-grid） | ⚠️ 需看使用处 | 若在可滚动面板内首行则被裁 |
| 3 | 首页 EC 生成按钮 | `Home.css:558` | `translateY(-1px)` | .ec-section overflow:visible | ✅ 安全 | 父容器无裁剪 |
| 4 | dual-showcase 小卡 | `Home.css:591` | `translateY(-4px)` | **无裁剪父**（.dual-col-body padding:16） | ✅ 安全 | 有 16px padding 余量 > 4px |
| 5 | 小卡封面缩放 | `Home.css:594` | `scale(1.08)` | **.mini-cover-wrapper { overflow:hidden }(Home.css:592)** | ✅ 安全（有意为之） | 封面放大被自身 wrapper 裁切是设计意图，不溢出 |
| 6 | EC 结果卡 | `Home.css:638` | `translateY(-2px)` | **`.ec-result-card { overflow:hidden }(Home.css:637)` 自身** | ❌ **命中** | 元素自身 overflow:hidden 会裁掉自己的位移阴影与位移阴影溢出，且首行卡上移被 grid 边界裁 |
| 7 | CTA 按钮 | `Home.css:672` | `translateY(-1px)` | 无 | ✅ 安全 | — |
| 8 | 预览生成按钮 | `Home.css:1120` | `translateY(-1px)` | 无 | ✅ 安全 | — |
| 9 | 预览参考图 | `Home.css:1180` | `scale(1.02)` | 无（父 .ec-preview-card-body padding16） | ✅ 安全 | — |
| 10 | 参考图条项 | `Home.css:1257` | `scale(1.05)` | **`.ec-preview-ref-strip-imgs { overflow-x:auto }`(Home.css:1245)** | ❌ **命中** | 横向滚动容器内的项缩放 5% 会被上下左右裁切；首/末项尤其明显 |
| 11 | 引导下载按钮 | `Home.css:1518` | `translateY(-2px)` | `.ec-guide-modal { max-height:88vh; overflow-y:auto }(Home.css:1489)` | ⚠️ 潜在 | moda 可滚动，按钮上移 2px，若滚动到顶则被裁；padding 24px 缓解 |
| 12 | 引导确认按钮 | `Home.css:1633` | `translateY(-1px)` | `.ec-guide-actions` sticky（padding 14px 0 24px） | ✅ 安全 | sticky 容器有 padding |
| 13 | 入口箭头 | `Home.css:1781` | `translateX(4px)` | **`.ec-entry-card`（无 overflow 声明）** | ✅ 安全 | 箭头在 flex 内，4px 位移在 24px padding 内 |
| 14 | 小红书风格卡 | `translateY(-4px)` | `**父容器需确认**` | ⚠️ 潜在 | 4px 位移属较大值 | undefined |
| 15 | 小红书风格卡2 | `translateY(-4px)` | `同上` | ⚠️ 潜在 | 同上 | undefined |
| 16 | 小红书生成按钮 | `scale(1.06)` | `**`.hero-textarea-wrap`/按钮行**` | ❌ 高风险 | scale 1.06 双向溢出，若无 padding 必被裁 | undefined |
| 17 | SideNav 项 | `scale(1.05)（离开复位）` | ``SideNav { padding:10 }`` | ✅ 安全 | 10px padding > 1.05 缩放的溢出 | undefined |
| 18 | TopBar 套餐 | `translateY(-2px)` | ``TopBar { paddingTop:28 }`` | ✅ 安全 | 28px 远大于 2px | undefined |
| 19 | 配置按钮 | `translateY(-1px)` | `**`.ec-floating-panel` 是同级兄弟，非父**；父为按钮行` | ✅ 安全 | 按钮行 borderTop + padding 14px | undefined |
| 20 | 下一步按钮 | `scale(1.02)` | `**父 `.ec-btn-row`（padding '12px 2px 14px'）**` | ⚠️ 潜在 | 2% 缩放约 ±0.8–1px，14px padding 够用 | undefined |
| 21 | 案例卡 | `translateY(-2px)` | ``.gallery-masonry`(column-count) 无 padding` | ⚠️ 潜在 | 瀑布流首行卡片上移 2px 无余量 | undefined |
| 22 | 案例图缩放 | `scale(1.05)` | `**`.gallery-card { overflow:hidden }`(内联 style:52)**` | ✅ 安全（有意） | 图放大被卡片裁，是设计意图 | undefined |
| 23 | 支付按钮 | `translateY(-1px)` | ``.Modal { overflow:auto }(ui/index.jsx:50)`` | ⚠️ 潜在 | overflow:auto 的模态内按钮上移会被裁 | undefined |
| 24 | 导航套餐 | `translateY(-2px)` | `nav 容器 `borderRadius:full` 但无 overflow` | ✅ 安全 | — | undefined |
| 25 | Button 组件 | `translateY(-1px)` | `取决于使用处` | ⚠️ 潜在 | 通用组件，使用处的 overflow 决定 | undefined |
| 26 | Card 组件 | `translateY(-3px)` | `**`Card { overflow:hidden }(ui/index.jsx:15)` 自身**` | ❌ **命中** | Card 自身 overflow:hidden 裁掉位移产生的阴影；hover 上移 3px 后顶部阴影消失 | undefined |
| 27 | NoteModal 按钮 | `translateY(-2px)` | ``.textScroll { overflowY:auto }(NoteModal.jsx:839)`` | ❌ **命中** | 可滚动文本区内按钮上移被裁 | undefined |
| 28 | .btn-primary | `translateY(-1px)` | `取决于使用处` | ⚠️ 潜在 | — | undefined |

**统计：27 处中 —— ❌ 已确认命中 4 处、⚠️ 潜在风险 11 处、✅ 安全 12 处。**

### ❌ 已确认命中（4 处，应优先修）

| 元素 | 文件:行 | 问题 | 修法 |
|---|---|---|---|
| **`.ec-result-card`** | `Home.css:637-638` | 卡片自身 `overflow:hidden`（圆角裁切）+ hover `translateY(-2px)` → **位移后阴影被自身裁掉**，且网格首行卡片上移越界被 `grid` 容器裁 | 位移移到内层 wrapper；或把 `overflow:hidden` 改为 `border-radius` + 内层图片单独裁 |
| **`.ec-preview-ref-strip-item`** | `Home.css:1245,1257` | 横向滚动容器 `.ec-preview-ref-strip-imgs{overflow-x:auto}` 内的项 `scale(1.05)` → **上下左右全被裁**，首/末项最明显 | 给滚动容器加 `padding: 8px` 并配 `margin: -8px`；或改 hover 为 `box-shadow` 而非 transform |
| **`Card` 组件** | `components/ui/index.jsx:15,17` | 组件自身 `overflow:hidden` + hover `translateY(-3px)` → **上移 3px 后顶部阴影/圆角被裁**，全站复用该组件处均受影响 | 拆成外层（管位移/阴影）+ 内层（管 `overflow:hidden` 圆角裁切） |
| **`NoteModal` 按钮** | `NoteModal.jsx:287,839` | `.textScroll{overflowY:auto}` 内按钮 `translateY(-2px)` → 滚动到顶时被裁 | 给 `.textScroll` 加 `padding-top` 补偿，或改 hover 为颜色/阴影反馈 |

### ⚠️ 潜在风险（11 处，需按实际使用处确认）

| 元素 | 文件:行 | 触发条件 |
|---|---|---|
| 小红书生成按钮 | `XhsContentMode.jsx:785` | `scale(1.06)` 双向溢出最大，若按钮行无 padding 必裁 |
| 小红书风格卡 ×2 | `XhsContentMode.jsx:617,676` | `translateY(-4px)` 位移量大，若无 16px+ padding 会裁 |
| 风格卡 | `Home.css:521` | 在可滚动浮层面板首行时被裁 |
| 引导下载按钮 | `Home.css:1518` | 在 `overflow-y:auto` 的 modal 内，滚动到顶时被裁 |
| 下一步按钮 | `EcMode.jsx:831` | `scale(1.02)`，按钮行 padding 12/14px 勉强够 |
| 案例卡 | `GallerySection.jsx:53` | 瀑布流首行卡片上移 2px 无 padding 余量 |
| 支付按钮 | `Modals.jsx:340` | 在 `Modal{overflow:auto}` 内上移 1px |
| `Button` 组件 | `ui/Button.jsx:18` | 通用组件，由使用处决定 |
| `.btn-primary` | `design-tokens.css:175` | 同上 |
| 配置按钮 | `EcMode.jsx:778` | 浮层面板内，滚动时可能触边 |
| 入口箭头 | `Home.css:1781` | `translateX(4px)`，右侧 padding 足够则安全 |

### ✅ 安全（12 处）

`Home.css:231,558,591,672,1120,1180,1633`、`App.jsx:106,161`、`GallerySection.jsx:81`、`Home.css:594`（封面缩放被自身 wrapper 裁属设计意图）、`Navbar.jsx:119`。

---

## C.3 修复方案（三选一，按改动成本排序）

### 方案 1（推荐 · 全局）：位移容器与裁切容器分离

**原则**：`overflow:hidden` 只用于裁切**内容**（图片、圆角背景），位移/阴影交给**外层**。

```jsx
// ❌ 现在：一个元素同时管两件事
<div style={{ borderRadius: 12, overflow: 'hidden', transform: hover ? 'translateY(-2px)' : 'none' }}>
  <img src={...} />
</div>

// ✅ 改为：外层管位移与阴影，内层管裁切
<div style={{ transform: hover ? 'translateY(-2px)' : 'none', transition: 'transform .15s', boxShadow: hover ? 'var(--sb-shadow-3)' : 'var(--sb-shadow-1)' }}>
  <div style={{ borderRadius: 12, overflow: 'hidden' }}>
    <img src={...} />
  </div>
</div>
```

### 方案 2（最小改动）：为滚动容器预留位移余量

```css
/* 滚动容器：加大 padding，用负 margin 抵消视觉位移 */
.scroll-container {
  padding: 8px;      /* ≥ 最大位移量 4px + 阴影扩散 */
  margin: -8px;      /* 视觉上位置不变 */
}
```

### 方案 3（兜底）：改用不触发裁切的 hover 反馈

用 `box-shadow` / `background` / `border-color` / `outline` 替代 `transform`，**完全规避裁切问题**：

```css
.card:hover {
  box-shadow: 0 4px 16px rgba(57,45,26,0.10);  /* 替代 translateY */
  border-color: var(--sb-border-strong);
}
```

> **建议**：卡片类（M2/M3）用**方案 1**；滚动容器内的项（M1）用**方案 2**；不确定时用**方案 3**。
> 三者可与 `design-tokens-v3.css` 的 `--sb-shadow-1..5` 海拔阶梯直接配合 —— 用阴影层级差表达「浮起」，比位移更稳且不会被裁。

---

## C.4 建议连带修复的同类问题

审计中还发现 2 处**非 hover 但同样被裁**的情况：

| 位置 | 文件:行 | 问题 |
|---|---|---|
| 浮层面板连接箭头 | `EcMode.jsx:346-357` | 箭头用 `filter: drop-shadow(...)` + 绝对定位在面板外侧，`#ec-floating-panel{overflowY:auto}`（:366）会裁掉面板外的元素 |
| 画布节点选中环 | `EcCanvas/index.jsx:108` | `boxShadow: '0 0 0 2.5px #7c3aed'` 外扩 2.5px，节点贴边时环被画布容器裁 |

---

## C.5 附录 C 审计口径

- 位移清单：正则匹配 `translateY|translateX|scale` 且上下文含 `onMouseEnter|onMouseLeave|:hover|hover &&|hover ?` 的声明行，全量遍历 `src/**/*.{jsx,js,css}`。
- 裁剪容器：正则匹配 `overflow:hidden|overflow:auto|overflow:scroll|overflowY: 'auto'` 等变体。
- 判定依据：位移量 vs 最近裁剪祖先的 padding 余量；元素自身 `overflow:hidden` 一律视为风险。
- 本轮**未修改任何 `src/` 文件**，未 commit。

---

# 附录 D · 活跃 Worktree 校正与本轮新增审计

> 触发：总统筹指出「所有代码改动/测试/部署都在 `F:\da\shubao\.worktrees\codex-ecommerce-stability`（分支 `codex/ecommerce-stability`），主树只读」。
> 本轮**首次在活跃 worktree 上复跑全部量化**，结果与此前基于主树的结论**存在实质差异**，必须先校正。

## D.0 环境校正（重要：此前部分结论基于已过期的只读主树）

| 项 | 主树 `F:\da\shubao`（只读） | **活跃 worktree（本轮权威）** |
|---|---|---|
| 分支 | master | **`codex/ecommerce-stability` @ `392c2d2c`** |
| `src/pages` 文件数 | 30 | **115** |
| `src/styles` 文件数 | 2 | **14** |
| `src` 源文件总数 | ~50 | **315** |
| V3 token 文件 | `design-tokens-v3.css`（**未 import**） | **`design-tokens-v3.css`（已在 main.jsx import）** |
| V3 使用量 | 6 处 | **727 处 / 5 文件** |
| 设计规范文档 | 仅 31 审计 | 另有 `00-principles.md`(35KB)、`40-decisions.md`、`_research/` 39 份 |

### 🔴 必须撤回的前置结论

**附录 A.0 曾断言「`design-tokens-v3.css` 完全没被接入任何页面，是锁在抽屉里的设计系统」——该结论对主树成立，对活跃 worktree 不成立。**

事实：worktree 已把同一套 token 落为 `design-tokens-v3.css`，并且在 `main.jsx` 中 import；且已被 **5 个文件**实际引用 **727 处**：

| 文件 | `--sb-*` 引用数 |
|---|---|
| `src/styles/design-tokens-v3.css` | 378（定义体） |
| `src/pages/Home/ec/SizingPanel.jsx` | **105** |
| `src/pages/Home/ec/GenSettingsPanel.jsx` | **104** |
| `src/pages/Home/Home.css` | **91** |
| `src/pages/Home/EcMode.jsx` | **49** |

### 🔴 同时必须撤回：第一条证据的「行号不符」判断

附录 A.0 曾判定总统筹引用的 `GenSettingsPanel.jsx` 中性版「全仓 0 命中、不存在」。
**在活跃 worktree 中该文件真实存在且已被完整改造**（343 行，文件头注释第 9 行明写「2026-09-15 总统筹 V3 改造（用户点名『最丑』的面板）」）：

- 选中态：`--sb-state-selected-bg` + `--sb-state-selected-line` + `--sb-state-selected-ink`（**正是总统筹描述的「中性深色描边 + 浅底」思路**）
- 默认态：`--sb-surface-tint`，**零边框**（对应原则 3.2/3.3）
- hover 与 selected **分走不同通道**（原则 4.3）
- 分组改用「留白 + 分组标题」，不再套白卡（原则 3.2）

→ 此前我在主树读到的是**旧版紫渐变实现**，据此下的判断无效。**总统筹的第一条、第二条证据在活跃树上均成立。**

---

## D.1 活跃 Worktree 的三张量化表（复跑）

### D.1.1 硬编码紫：**296 次 / 49 文件**（主树口径为 293/28，文件数近乎翻倍）

| 文件 | 次数 |
|---|---|
| `src/pages/EcCanvas/components/canvas-library.css` | **23** |
| `src/pages/EcCanvas/EcCanvas.css` | **21** |
| `src/pages/EcCanvas/index.jsx` | **21** |
| `src/styles/design-tokens-v3.css` | 21（品牌色阶定义，合理） |
| `src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNodes.module.css` | **20** |
| `src/pages/Home/ec/EcProfileRail.css` | **17** |
| `src/pages/Home/ec/crossModeProductProfile.css` | **16** |
| `src/pages/Home/EcMode.jsx` | 16 |
| `src/pages/Home/ec/StylePanel.jsx` | 12 |
| `src/pages/Home/VisualCreationMode.css` | 11 |
| `src/pages/Home/ec/DesignDirection.jsx` | 10 |
| `src/styles/app-shell.css` | 10 |
| 其余 37 文件 | 各 1–9 |

**新结论**：改造已把 `GenSettingsPanel`、`SizingPanel`、`EcMode`、`Home.css` 四处的紫收敛到 token，但**画布链路（EcCanvas 系列 CSS/组件）与新增的 Profile/CrossMode 样式仍是紫的硬编码重灾区**。

### D.1.2 `var(--accent*)`：**74 次 / 17 文件**（主树 59/15）

| 文件 | 次数 |
|---|---|
| `src/pages/Pricing/Pricing.css` | **29** |
| `src/components/layout/Navbar.jsx` | 7 |
| `src/styles/canvas-derive-menu.css` | 7 |
| `src/pages/Home/EcPlatformPicker.jsx` | 6 |
| `src/styles/design-tokens.css` | 5 |
| `src/components/task/BatchProgress.jsx` | 3 |
| `src/pages/Home/XhsContentMode.jsx` | 3 |
| `src/styles/theme.css` | 3 |
| 其余 9 文件 | 各 1–2 |

**新结论**：近黑 `--accent` 的主战场是 **Pricing 页（29 次，占 39%）**；画布侧 `canvas-derive-menu.css` 也用了 7 次 —— 说明**画布内部已出现「近黑」渗透**，双轨在画布内部也开始混。

### D.1.3 双轨对照（更新）

| 维度 | 链路 A：首页/电商/主站 | 链路 B：画布/工作流 |
|---|---|---|
| 主色 | 近黑 `--accent` 74 次 + 紫硬编码（已部分 token 化） | 紫硬编码为主（EcCanvas 系列 ~90 次） |
| V3 落地 | ✅ 已落地（GenSettingsPanel/SizingPanel/Home.css/EcMode 共 349 处） | ❌ 基本未落地（画布 CSS 无 `--sb-`） |
| 选中态 | 已按原则 4.3 分离 hover/selected | ring 手法 |

---

## D.2 悬停位移裁断：用户报告的 bug 已修复，但修复不完整

### D.2.1 定位结论

用户报告的「画布库新建卡片悬停被顶部裁断」**确有此事，且已被修复过一轮**：

- 组件：`src/pages/EcCanvas/components/CanvasLibraryModal.jsx` → `.canvas-library-new-card`
- 根因注释：`canvas-library.css:127-174`（2026-09-16 用户批注「我鼠标放上去，为什么上面会被截断呢？」）
- 契约测试：`test/canvas-library-hover-lift-clipping-0917.test.mjs`（**6/6 通过**，本轮已复跑验证）
- 修复手法：`--cl-lift-safe-top:16px` / `--cl-lift-safe-x:8px` + 栅格 `::before` 真实占位行

### 🔴 D.2.2 修复的不完整处（本轮新发现，应优先补）

`CanvasLibraryModal.jsx:138,141` 存在**两种形态**：

```jsx
className={`canvas-library-overlay${isPage ? ' is-page' : ''}`}   // :138
className={`canvas-library${isPage ? ' is-page' : ''}`}           // :141
```

而**全部安全区都只写在 `.is-page` 作用域内**：

| 规则 | 行 | 是否含安全区 |
|---|---|---|
| `.canvas-library-grid`（基础/弹窗形态） | `:38` | ❌ **无** |
| `.canvas-library.is-page .canvas-library-grid` | `:155-166` | ✅ 有 |
| `.canvas-library.is-page .canvas-library-grid::before` | `:170-174` | ✅ 有 |

→ **当 `isPage=false`（弹窗形态）时，`.canvas-library-grid` 的 `padding` 是 `18px 22px 22px`，虽非 0，但 `::before` 占位缺失，首行卡片上探 12.7px 仍会贴到筛选栏、圆角被切。**
这解释了为何用户「感觉还没修好」—— 取决于从哪个入口打开画布库。

**建议修法**：把 `--cl-lift-safe-*` 令牌与 `::before` 占位提升到 `.canvas-library-grid` 基础规则（非 `.is-page` 限定），弹窗形态同步生效。

### D.2.3 全站滚动容器 × 悬停位移 交叉排查（13 文件）

| 文件 | 滚动容器 | 悬停位移 | 安全区 |
|---|---|---|---|
| `canvas-library.css` | `.canvas-library-grid` | 卡片/新建卡 `-8px scale1.03` | ⚠️ 仅 `.is-page` |
| `canvas-asset-picker.css` | `.canvas-asset-picker-grid` | `-2px scale1.02` | ✅ |
| `canvas-supervisor.css` | `.ec-asset-library-scroll` 等 3 个 | 资产卡 `-4px scale1.035` | ✅ |
| `EcCanvas.css` | 图层列表/加号菜单/生成方向 | 顶栏/媒体节点/端口 | ✅ |
| `Home.css` | `.ec-guide-modal` 等 3 个 | 生成按钮/方向卡/能力卡 | ✅ |
| `VideoStudio.css` | 内联菜单/计划弹窗/配置面板 | 媒体卡/素材动作 | ✅ |
| `VideoCanvasWorkbench.css` | 资产列表/镜头计划/舞台 | 节点 `-3px scale1.04` | ✅ |
| `canvas-derive-menu.css` | `.ec-canvas-derive-scroll` | 瓦片 | ✅ |
| `canvas-watermark-panel.css` | `.ec-wm-panel-body` | 按钮 `-1px` | ✅ |
| `app-shell.css` | 移动导航组 | 导航图标微动 | ✅ |
| `VisionFeedback.css` | `.vision-context` | 按钮 `-1px` | ✅ |
| **`PublicTemplates/index.css`** | `.tpl-modal` | `.popular-card:hover` `-2px`、`.grid-item:hover` `-2px` | ❌ **未见安全区** |
| **`design-tokens.css`** | `.note-modal-main` | `.btn-primary:hover` `-1px` | ❌ 未见（1px 风险低） |

**→ 除画布库弹窗形态外，另有 1 处应修：`PublicTemplates/index.css` 的 `.tpl-modal` 内 `.popular-card` / `.grid-item` 上浮 2px 无安全区。**

---

## D.3 本轮新增审计口径

- **只读主树、只写 worktree**：本轮全部读取与统计均在 `F:\da\shubao\.worktrees\codex-ecommerce-stability` 执行；产出写入该 worktree 的 `docs/design/`。
- 量化脚本：Node 全量遍历 worktree `src/**/*.{jsx,js,css}`（315 文件），正则聚合计数。
- 契约测试复跑：`node --test test/canvas-library-hover-lift-clipping-0917.test.mjs` → **6/6 pass**。
- 本轮**未修改任何 `src/` 文件**，未 commit。

---
# 附录 E · 全量勘误与机制性根因（以活跃 Worktree 为唯一口径）

> 触发：总统筹指出我此前部分结论在**只读主树** F:\da\shubao 上跑出，与活跃 worktree 不符。
> 本轮**全部检索与统计只在 F:\da\shubao\.worktrees\codex-ecommerce-stability（分支 codex/ecommerce-stability）执行**。

## E.0 勘误总表

| # | 此前结论（出处） | 判定 | 更正后事实 |
|---|---|---|---|
| 1 | 「画布库新建卡片在当前 src 树中不存在，全仓搜『新建画布』0 命中」（附录 C.0） | ❌ **完全错误** | 存在于 src/pages/EcCanvas/components/CanvasLibraryModal.jsx + canvas-library.css:202 .canvas-library-new-card |
| 2 | 「全仓未找到小地图实现，属功能缺失」（附录 A.2 #33） | ❌ **完全错误** | 存在：CanvasMinimap.jsx(165行) + canvas-minimap.css(102行) + EcCanvas/index.jsx:7475 渲染。**问题在样式冲突，不在缺失**（见 E.3） |
| 3 | 「design-tokens-v3.css 完全没接入，锁在抽屉里」（附录 A.0） | ❌ **错误** | worktree 已落为 design-tokens-v3.css 并在 main.jsx import，**已引用 727 处** |
| 4 | 「总统筹引用的 GenSettingsPanel 中性版 0 命中」（附录 A.0） | ❌ **错误** | 该文件已完整 V3 改造（343 行，:9 注释「2026-09-15 总统筹 V3 改造」） |
| 5 | 中性色 829 行 / 42 文件（附录 A.1） | ⚠️ **数字要改** | 主树为 829/42；**worktree 为 1535 行 / 101 文件** |
| 6 | 中性色硬编码 1190 处 / 46 文件（附录 A.3） | ⚠️ **数字要改** | 主树口径；worktree 源文件从 ~50 增至 315，实际量随文件数近乎翻倍 |
| 7 | var(--accent) 59 处 / 15 文件（附录 B.1） | ⚠️ **数字要改** | **worktree 为 74 处 / 17 文件** |
| 8 | 硬编码紫 293 处 / 28 文件（附录 B.2） | ⚠️ **数字要改** | **worktree 为 425 处 / 56 文件** |
| 9 | 其它品牌色 180 处 / 29 文件（附录 B.3） | ⚠️ **数字要改** | **worktree 为 338 处 / 56 文件** |
| 10 | hover 位移 27 处，4❌/11⚠️/12✅（附录 C.2） | ⚠️ **数字要改** | **worktree 为 69 处**（见 E.4） |

---

## E.1 勘误 1：用户报告的「新建卡片」确实存在

    src/pages/EcCanvas/components/CanvasLibraryModal.jsx   ← 「我的画布」弹窗
    src/pages/EcCanvas/components/canvas-library.css:202   ← .canvas-library-new-card（新建卡）
    src/pages/EcCanvas/components/canvas-library.css:208   ← .canvas-library-new-card-plus（56px 加号载体）

我此前用「新建画布 / 新建项目 / 创建新」做关键词检索 —— **卡片文案实际是「新建」两字**（canvas-library.css:221 .canvas-library-new-card-label），关键词不匹配导致 0 命中。**这是我的检索方法错误，非事实如此。**

---

## E.2 勘误 2：色值量化表（worktree 重跑，权威口径）

### E.2.1 var(--accent*) —— **74 次 / 17 文件**（原报 59/15）

| 文件 | 次数 |
|---|---|
| src/pages/Pricing/Pricing.css | **29** |
| src/components/layout/Navbar.jsx | 7 |
| src/styles/canvas-derive-menu.css | 7 |
| src/pages/Home/EcPlatformPicker.jsx | 6 |
| src/styles/design-tokens.css | 5 |
| src/components/task/BatchProgress.jsx | 3 |
| src/pages/Home/XhsContentMode.jsx | 3 |
| src/styles/theme.css | 3 |
| src/components/business/Modals.jsx | 2 |
| src/pages/Home/EcProductParams.jsx | 2 |
| 其余 7 文件 | 各 1 |

**结论变化**：近黑 --accent 的**主战场是 Pricing.css（29 次，占 39%）**；canvas-derive-menu.css 7 次说明**近黑已渗透进画布内部**，双轨不是「A 近黑 / B 紫」的干净二分。

### E.2.2 硬编码紫 —— **425 次 / 56 文件**（原报 293/28）

| 文件 | 次数 | 备注 |
|---|---|---|
| src/styles/design-tokens-v3.css | 39 | 品牌色阶定义，**合规** |
| src/pages/EcCanvas/EcCanvas.css | **31** | 画布主样式 |
| src/pages/EcCanvas/components/canvas-library.css | **28** | 画布库（含新建卡） |
| src/pages/Home/Home.css | **27** | 电商主样式 |
| src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNodes.module.css | **24** | 工作流节点 |
| src/pages/EcCanvas/index.jsx | **21** | 画布主组件 |
| src/pages/Home/ec/EcProfileRail.css | **21** | 新文件 |
| src/pages/Home/EcMode.jsx | 18 | |
| src/pages/Home/ec/crossModeProductProfile.css | **17** | 新文件 |
| src/pages/Home/ec/StylePanel.jsx | 15 | |
| src/pages/Home/ec/DesignDirectionView.jsx | 13 | |
| src/pages/Home/VisualCreationMode.css | 13 | |
| src/pages/Home/ec/ProductProfileShelf.css | 12 | |
| src/styles/app-shell.css | 12 | |
| 其余 42 文件 | 各 1–10 | |

**结论变化**：改造已把 GenSettingsPanel 等四处收敛，但**画布链路（EcCanvas 系列 5 文件 = 104 次）与新增 Profile/CrossMode 样式（38 次）成为最大硬编码紫聚集地**。

### E.2.3 其它品牌色 —— **338 次 / 56 文件**（原报 180/29）

| 文件 | 次数 |
|---|---|
| src/pages/Home/Home.css | **30** |
| src/pages/Home/XhsContentMode.jsx | **24** |
| src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx | **22** |
| src/pages/EcStudio/index.jsx | **22** |
| src/pages/EcCanvas/EcCanvas.css | **20** |
| src/pages/EcCanvas/canvasQuantvExtensions.js | **18** | 小地图节点配色来源 |
| src/pages/EcCanvas/components/CanvasMinimap.jsx | **18** | 小地图节点配色表 |
| src/pages/EcCanvas/index.jsx | 17 | |
| 其余 48 文件 | 各 1–12 | |

---

## E.3 勘误 3：小地图**存在**，问题是「两套互相打架的样式定义」

### 存在性确认

| 资产 | 路径 | 规模 |
|---|---|---|
| 组件（实际渲染） | src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx:324-480 | export function CanvasMinimap |
| 组件（重复副本） | src/pages/EcCanvas/components/CanvasMinimap.jsx | 165 行 |
| 样式 A | src/styles/canvas-minimap.css | 102 行 |
| 样式 B | src/styles/canvas-supervisor.css:526-628 | 103 行 |
| 渲染入口 | src/pages/EcCanvas/index.jsx:7475 | {tab === 'canvas' && minimapOpen && <CanvasMinimap/>} |
| 开关 | src/pages/EcCanvas/index.jsx:776 | useState(true)，默认开 |

### 🔴 真正的问题：同一组 class 被定义两次，取值互相冲突

| 属性 | canvas-minimap.css:6-20 | canvas-supervisor.css:526-542 | 冲突 |
|---|---|---|---|
| position | absolute | **fixed** | 🔴 定位体系不同 |
| bottom | 140px | **calc(var(--ec-canvas-bottombar-top,56px) + var(--ec-canvas-panel-gap,14px))** | 🔴 硬编码 vs 令牌 |
| left | 14px | 16px | 🟠 |
| z-index | 50 | **5000** | 🔴 差 100 倍 |
| 背景 | **rgba(15,23,42,0.88) 暗色玻璃** | **rgba(255,255,255,0.97) 白色** | 🔴 完全相反 |
| 文字色 | rgba(255,255,255,0.9) | #1f2937 | 🔴 完全相反 |
| 边框 | 1px solid rgba(255,255,255,0.12) | 1px solid #dde1e6 | 🔴 |
| 圆角 | 12px | 10px | 🟠 |
| 阴影 | 0 8px 32px rgba(12,10,9,0.4) | 0 8px 28px -6px rgba(15,23,42,0.18) | 🟠 |
| 视口框 | rgba(99,102,241,0.25) 靛蓝 | rgba(78,205,196,0.7) 青绿 | 🔴 不同色相 |

**加载顺序决定胜负**：EcCanvas/index.jsx:128 import 了 canvas-minimap.css，而 canvas-supervisor.css 由 app-shell 层引入 —— **后加载者覆盖前者**，导致同一组件在不同入口/时序下外观可能不同。这正是「小地图黑」类反馈反复出现的原因（canvas-minimap.css:4 注释即写着「用户 9-01 反馈: minimap黑」）。

### 另：组件本身也是两份
CanvasMinimap.jsx:1-2 注释自述：「当前画布渲染的是 CanvasContextMenuPanel 里的实现，但留着一个会崩的副本是隐患」。**两份实现的默认尺寸还不一致**（minimapHeight 140 vs 180）。

### 建议修法
1. 删除 canvas-minimap.css **或** canvas-supervisor.css:526-628 其中一份，保留单一真相；
2. 保留白色版本（与画布整体浅色调一致，且用了 --ec-canvas-bottombar-top 令牌）；
3. 删除 CanvasMinimap.jsx 副本，只留 CanvasContextMenuPanel 内的实现；
4. 视口框色统一为 var(--sb-info) 或品牌色，消除靛蓝/青绿二选一。

---

## E.4 勘误 4：hover 位移全站重跑 —— **69 处**（原报 27 处）

### 位移量 Top 10

| 上移 | 位置 | 备注 |
|---|---|---|
| **-8px** | src/pages/EcCanvas/components/canvas-library.css:43 | .canvas-library-card:hover |
| **-8px** | src/pages/EcCanvas/components/canvas-library.css:205 | .canvas-library-new-card:hover ★ 用户报告的那张 |
| -5px | src/pages/Home/Home.css:3047 | .ec-tryon-showcase-card |
| -4px | src/pages/Home/GallerySection.jsx:200 | 内联样式 |
| -4px | src/pages/Home/Home.css:910 | .mini-card |
| -4px | src/pages/Home/Home.css:3446 | .ec-tryon-flow-card |
| -4px | src/styles/canvas-supervisor.css:802 | .canvas-asset-library-modal article |
| -3px | src/pages/Home/GallerySection.jsx:202 | 内联 |
| -3px | src/pages/Home/Home.css:3088 | .ec-tryon-lane-assets |
| -3px | src/pages/VideoStudio/VideoCanvasWorkbench.css:509 | .vcb-node.is-selected |

### 按文件分布（Top 12）

| 文件 | 处数 |
|---|---|
| src/pages/Home/Home.css | **23** |
| src/styles/app-shell.css | **9** |
| src/pages/VideoStudio/VideoStudio.css | 7 |
| src/pages/EcCanvas/EcCanvas.css | 4 |
| src/pages/Home/CreationShowcase.css | 4 |
| src/styles/canvas-supervisor.css | 4 |
| src/pages/EcCanvas/components/canvas-library.css | 3 |
| src/pages/Home/GallerySection.jsx | 2 |
| src/pages/PublicTemplates/index.css | 2 |
| src/styles/pricing-modal.css | 2 |
| 其余 12 文件 | 各 1 |

### 裁断风险判定（沿用附录 C 三模式）

**❌ 已确认命中 2 处**：
| 位置 | 问题 |
|---|---|
| canvas-library.css:43 / :205（-8px scale1.03） | .is-page 作用域已有安全区；**弹窗形态（isPage=false）无** → 仍会裁 |
| PublicTemplates/index.css:41,95（-2px） | .tpl-modal 滚动容器内，无安全区 |

**⚠️ 高位移风险（≥4px，需逐一核实容器）**：
Home.css:910（mini-card -4px）、Home.css:3047（tryon -5px）、Home.css:3088（-3px）、Home.css:3446（-4px）、GallerySection.jsx:200（-4px）、GallerySection.jsx:202（-3px）、canvas-supervisor.css:802（-4px scale1.035）、VideoCanvasWorkbench.css:509（-3px scale1.04）、VideoStudio.css:79,85（-3px）

**✅ 低风险（1–2px）**：其余 50 余处，位移量小于常规容器 padding，通常安全。

---

## E.5 重复选择器清单（机制性根因 D8 · 合并作业单）

**总统筹量化（已复核一致）**：Home.css 3551 行 / 930 选择器 / 89 组重复；EcCanvas.css 2008 行 / 741 选择器 / 60 组重复。

本轮全 src 复跑（含全部 CSS，非仅两文件）：**重复选择器组共 213 组，分布在 14 个文件**。

### 全站重复度总览（按重复组数降序）

| 文件 | 行数 | 选择器数 | 重复组 | 最多重复 |
|---|---|---|---|---|
| src/pages/Home/Home.css | 3552 | 974 | **89** | 5x |
| src/pages/EcCanvas/EcCanvas.css | 2009 | 773 | **52** | 5x |
| src/pages/VideoStudio/VideoStudio.css | 583 | 308 | **20** | 2x |
| src/pages/VideoStudio/VideoCanvasWorkbench.css | 695 | 271 | **16** | 2x |
| src/pages/Home/VisualCreationMode.css | 1413 | 248 | **15** | 2x |
| src/styles/canvas-supervisor.css | 862 | 189 | **9** | 2x |
| src/pages/Home/CreationShowcase.css | 394 | 158 | **2** | 2x |
| src/pages/Home/member-center.css | 110 | 51 | **2** | 2x |
| src/pages/VideoStudio/DirectorWorkbench.css | 120 | 112 | **2** | 2x |
| src/pages/VideoStudio/VideoProjectWorkbench.css | 594 | 418 | **2** | 2x |
| src/pages/Home/ec/skill-library.css | 276 | 69 | **1** | 2x |
| src/styles/app-shell.css | 619 | 145 | **1** | 2x |
| src/styles/canvas-empty-actions.css | 300 | 50 | **1** | 2x |
| src/styles/design-tokens-v3.css | 759 | 49 | **1** | 3x |
| 其余 -6 文件 | | | 各 1–2 | |

> 说明：总统筹给的 EcCanvas.css「60 组」与本轮「52 组」的差异，来自统计口径 —— 本轮**跳过了以 @ 开头的 at-rule 选择器**（media/supports 块），且对同名选择器按「完全相同字符串」归并。若把 at-rule 内的重复也计入，数量会更高。**结论方向一致：两文件都是重度重复。**

### E.5.1 Home.css 完整重复清单（89 组）

| 重复次数 | 选择器 | 各次出现行号 |
|---|---|---|
| **5x** | .ec-ability-selector-option | 2467, 2824, 2915, 3051, 3079 |
| **4x** | .ec-tryon-showcase-results.count-1 | 2420, 2509, 2992, 3069 |
| **4x** | .ec-tryon-showcase-results.count-1 .ec-tryon-result-card | 2423, 2510, 2996, 3069 |
| **4x** | .ec-ability-selector-thumb | 2468, 2830, 2920, 3051 |
| **4x** | .ec-product-suite-source | 2492, 2544, 3060, 3106 |
| **4x** | .ec-product-suite-results | 2495, 2546, 3060, 3107 |
| **4x** | .ec-product-suite-results .result-0 | 2497, 2555, 3062, 3113 |
| **4x** | .ec-product-suite-results .result-1 | 2498, 2560, 3063, 3114 |
| **3x** | .ec-tryon-showcase-card | 2390, 2978, 2981 |
| **3x** | .ec-tryon-showcase-source-card | 2400, 2989, 3117 |
| **3x** | .ec-tryon-showcase-reference-card | 2402, 2989, 3118 |
| **3x** | .ec-tryon-preview-dialog | 2425, 3003, 3219 |
| **3x** | .ec-tryon-preview-dialog > img | 2426, 3006, 3314 |
| **3x** | .ec-tryon-showcase-visual.is-angles .ec-tryon-showcase-source-card | 2512, 3070, 3119 |
| **3x** | .ec-tryon-showcase-visual | 2840, 2937, 2977 |
| **3x** | .ec-tryon-lane-assets | 2867, 2955, 3033 |
| **2x** | .gen-btn.xhs | 206, 209 |
| **2x** | .ec-workbench-tools | 276, 2148 |
| **2x** | .ec-workbench-mention-row | 516, 3323 |
| **2x** | .ec-info-fields | 694, 1044 |
| **2x** | .ec-style-grid | 799, 1110 |
| **2x** | .ec-style-card | 800, 1115 |
| **2x** | .ec-style-card.on | 806, 1125 |
| **2x** | .ec-style-card:hover:not(.on) | 810, 1132 |
| **2x** | .ec-style-body | 812, 1155 |
| **2x** | .ec-style-name | 813, 1158 |
| **2x** | .ec-style-card.on .ec-style-name | 814, 1163 |
| **2x** | .ec-style-label | 816, 989 |
| **2x** | .ec-style-sub | 817, 991 |
| **2x** | .ec-result-grid | 927, 1523 |
| **2x** | .ec-result-card | 928, 1528 |
| **2x** | .ec-result-card:hover | 932, 1536 |
| **2x** | .ec-result-label | 934, 1551 |
| **2x** | .ec-ref-grid | 973, 1011 |
| **2x** | .ec-ref-slot | 974, 1012 |
| **2x** | .ec-ref-img | 977, 1016 |
| **2x** | .ec-preview-header | 1386, 1389 |
| **2x** | .ec-lightbox-overlay | 1972, 1998 |
| **2x** | .ec-lightbox-img | 1990, 2004 |
| **2x** | .ec-tryon-showcase-card img | 2391, 2983 |
| **2x** | .ec-tryon-showcase-card > span | 2397, 2985 |
| **2x** | .ec-tryon-showcase-operator | 2404, 2990 |
| **2x** | .ec-tryon-showcase-results.count-4 | 2412, 2991 |
| **2x** | .ec-tryon-result-card | 2414, 2992 |
| **2x** | .ec-tryon-showcase-results.count-4 .ec-tryon-result-card + .ec-tryon-result-card | 2419, 2993 |
| **2x** | .ec-tryon-preserve-options | 2430, 2908 |
| **2x** | .ec-tryon-preserve-option | 2431, 2964 |
| **2x** | .ec-tryon-help-popover | 2436, 2967 |
| **2x** | .ec-product-suite-results > button | 2496, 3109 |
| **2x** | .ec-tryon-showcase-visual.is-angles .ec-tryon-showcase-results.count-1 | 2513, 3070 |
| **2x** | .ec-tryon-showcase-visual.is-angles .ec-tryon-showcase-results.count-1 .ec-tryon-result-card | 2513, 3071 |
| **2x** | .ec-product-suite-showcase-visual | 2535, 3142 |
| **2x** | .ec-product-suite-results b | 2566, 3117 |
| **2x** | .ec-ability-selector | 2818, 2914 |
| **2x** | .ec-ability-selector-option.is-selected | 2829, 3080 |
| **2x** | .ec-ability-selector-copy strong | 2832, 2922 |
| **2x** | .ec-ability-selector-copy > span | 2833, 2922 |
| **2x** | .ec-tryon-showcase | 2835, 2923 |
| **2x** | .ec-tryon-showcase-copy | 2837, 2925 |
| **2x** | .ec-showcase-kicker | 2838, 2926 |
| **2x** | .ec-tryon-showcase-copy strong | 2840, 2927 |
| **2x** | .ec-tryon-showcase-facts | 2850, 2943 |
| **2x** | .ec-tryon-input-stage | 2855, 2944 |
| **2x** | .ec-tryon-lane | 2859, 3033 |
| **2x** | .ec-tryon-lane-items | 2860, 2947 |
| **2x** | .ec-tryon-lane-scene | 2861, 2952 |
| **2x** | .ec-tryon-lane-head | 2862, 2953 |
| **2x** | .ec-tryon-lane-head small | 2865, 2954 |
| **2x** | .ec-tryon-lane-assets .ec-xhs-upload-card | 2869, 2956 |
| **2x** | .ec-tryon-person-lane | 2877, 2957 |
| **2x** | .ec-tryon-person-mode | 2878, 2957 |
| **2x** | .ec-tryon-person-mode button | 2881, 2958 |
| **2x** | .ec-tryon-smart-note | 2882, 2958 |
| **2x** | .ec-tryon-smart-note strong | 2883, 2958 |
| **2x** | .ec-tryon-smart-note span | 2884, 2959 |
| **2x** | .ec-tryon-panel-label strong | 2896, 2959 |
| **2x** | .ec-tryon-panel-label span | 2896, 2959 |
| **2x** | .ec-tryon-ratio-grid button | 2897, 2960 |
| **2x** | .ec-tryon-ratio-grid button > span | 2899, 2961 |
| **2x** | .ec-tryon-ratio-grid button small | 2900, 2962 |
| **2x** | .ec-tryon-count-row button | 2901, 2962 |
| **2x** | .ec-tryon-shot-preview span | 2905, 2963 |
| **2x** | .ec-tryon-preserve-options label | 2909, 2964 |
| **2x** | .ec-tryon-showcase-controls | 2927, 2997 |
| **2x** | .ec-tryon-preview-modal | 3002, 3213 |
| **2x** | :root | 3076, 3184 |
| **2x** | .ec-product-suite-showcase, .ec-tryon-showcase | 3100, 3192 |
| **2x** | .ec-product-suite-showcase-visual, .ec-tryon-showcase-visual | 3105, 3202 |
| **2x** | .ec-product-suite-final | 3144, 3207 |

### E.5.2 EcCanvas.css 完整重复清单（52 组）

| 重复次数 | 选择器 | 各次出现行号 |
|---|---|---|
| **5x** | .ec-canvas-composer-source | 472, 525, 543, 555, 909 |
| **5x** | .ec-canvas-composer-source > div | 475, 526, 544, 557, 914 |
| **5x** | .ec-canvas-composer-source-add | 478, 530, 547, 561, 924 |
| **4x** | .ec-canvas-composer-source > b | 475, 544, 558, 918 |
| **4x** | .ec-canvas-composer-source-add small | 479, 549, 562, 927 |
| **4x** | .ec-canvas-composer-footer | 531, 564, 938, 1403 |
| **4x** | .ec-canvas-composer-footer > span | 532, 565, 939, 1410 |
| **4x** | .ec-canvas-suite-controls | 731, 963, 1456, 1461 |
| **4x** | .ec-canvas-suite-control > button | 737, 964, 1461, 1462 |
| **3x** | .ec-canvas-page | 15, 143, 905 |
| **3x** | .ec-canvas-node-composer | 451, 552, 907 |
| **3x** | .ec-canvas-composer-sources | 523, 555, 908 |
| **3x** | .ec-canvas-composer-footer > button | 533, 565, 946 |
| **3x** | .ec-canvas-composer-footer > .ec-canvas-parameter-controls | 564, 945, 1405 |
| **3x** | .ec-canvas-composer-footer > .ec-canvas-composer-mention | 564, 941, 1404 |
| **3x** | .ec-canvas-parameter-controls | 566, 957, 1413 |
| **3x** | .ec-canvas-suite-panel-popover | 752, 968, 1529 |
| **2x** | .ec-canvas-icon-button | 101, 1268 |
| **2x** | .ec-canvas-icon-button:hover:not(:disabled) | 105, 1271 |
| **2x** | .ec-canvas-pending-imports-action:disabled | 177, 179 |
| **2x** | .ec-canvas-empty-state > div | 202, 206 |
| **2x** | .ec-canvas-derive-menu | 276, 289 |
| **2x** | .ec-canvas-copy-node [role="textbox"] | 366, 878 |
| **2x** | .ec-canvas-generation-node.is-processing | 374, 1254 |
| **2x** | .ec-canvas-generation-directions | 389, 1070 |
| **2x** | .ec-canvas-generation-directions > small | 391, 1075 |
| **2x** | .ec-canvas-text-toolbar | 421, 1124 |
| **2x** | .ec-canvas-text-toolbar button | 425, 1136 |
| **2x** | .ec-canvas-context-composer | 456, 1493 |
| **2x** | .ec-canvas-node-composer textarea | 457, 931 |
| **2x** | .ec-canvas-node-composer textarea:focus | 461, 936 |
| **2x** | .ec-canvas-composer-source > button | 527, 922 |
| **2x** | .ec-canvas-suite-source-rows | 541, 931 |
| **2x** | .ec-canvas-suite-source-rows .ec-canvas-composer-sources + .ec-canvas-composer-sources | 542, 931 |
| **2x** | .ec-canvas-composer-mention .image-mention-trigger | 551, 953 |
| **2x** | .ec-canvas-parameter-item | 567, 1415 |
| **2x** | .ec-canvas-parameter-item > button | 567, 959 |
| **2x** | .ec-canvas-parameter-popover | 570, 1526 |
| **2x** | .ec-canvas-generation-text-board | 604, 1105 |
| **2x** | .ec-canvas-generation-text-board:empty::before | 606, 1112 |
| **2x** | .ec-canvas-generation-text-board:focus | 607, 1108 |
| **2x** | .ec-canvas-generation-node.is-text | 608, 1115 |
| **2x** | .ec-canvas-generation-node.is-text.is-selected | 611, 1121 |
| **2x** | .ec-canvas-video-controls > label | 648, 651 |
| **2x** | .ec-canvas-video-controls > label.is-mention | 655, 658 |
| **2x** | .ec-canvas-video-controls > .is-toggle | 657, 661 |
| **2x** | .ec-canvas-video-controls > .is-toggle > .ec-canvas-video-toggle-control | 665, 666 |
| **2x** | .ec-canvas-suite-control | 735, 1458 |
| **2x** | .ec-canvas-parameter-item > button, .ec-canvas-suite-control > button | 957, 1416 |
| **2x** | .ec-canvas-suite-control > button > span | 967, 1461 |
| **2x** | .ec-canvas-suite-composer .ec-canvas-composer-footer > .ec-canvas-suite-skill | 1402, 1454 |
| **2x** | .ec-canvas-prompt-resize > .mention-prompt-field | 1495, 1499 |


---

## E.6 本轮审计口径

- **只读主树、只写 worktree**：全部读取与统计均在 .worktrees/codex-ecommerce-stability 执行（315 个源文件）。
- 重复选择器统计：逐 CSS 文件按花括号深度解析顶层规则，剔除注释后按选择器字符串精确归并；跳过 @ 开头的 at-rule。
- 色值统计：正则匹配 hex 与 rgba，按文件聚合计数。
- hover 位移：匹配含 :hover / :focus-visible / onMouseEnter 且含 translate/scale 的声明行。
- 本轮**未修改任何 src/ 文件**，未 commit。
