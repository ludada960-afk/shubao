# 电商画布视觉语言体系 · 设计与实施记录（2026-08-25）

## 目标与范围

画布页（src/pages/EcCanvas）此前存在圆角/阴影/动效各自为政、图标风格陈旧（Material 实心）、hover 反馈缺乏统一词汇的问题。本次不是单点修补，而是建立**一套全局设计语言**，并以「空状态 hero 按钮区」作为参照实现落地。范围仅限 EcCanvas 页；不部署；不触碰视频线程未提交文件。

## 体系原则

1. **一个 token 层**：所有控件从同一组变量读取圆角、阴影、时长、曲线，禁止组件私有值。
2. **三档层级**：主操作（实心填充）/ 次操作（白面+描边）/ 工具（ghost 图标按钮），视觉差靠填充与对比控制，不靠加大加粗。
3. **统一动效词汇**：hover=上浮 1px + 边框进蓝 + 阴影升档；press=回落归位；进入=6px 上移淡入 stagger。全部走同两条缓动曲线。
4. **图标即语言**：Lucide 线性体系（24 网格、圆角端点、光学对齐），全画布统一 stroke-width 1.75，与 12px/650 文字密度匹配。

## Token 清单（EcCanvas.css :: .ec-canvas-page）

| 类别 | Token | 值 |
| --- | --- | --- |
| 圆角 | --ec-radius-sm/md/lg | 7 / 9 / 12px |
| 阴影 | --ec-shadow-1/2/3 | 双层柔和阶梯（浮层 1→2→3 对应 控件/悬浮面板/弹窗） |
| 描边环 | --ec-ring-inset | inset 0 0 0 1px rgba(37,99,235,.28)（hover 内环） |
| 时长 | --ec-motion-fast/base | 130ms（反馈）/ 200ms（进入） |
| 曲线 | --ec-ease-out/spring | cubic-bezier(.16,1,.3,1) / cubic-bezier(.34,1.56,.64,1) |
| 位移 | --ec-hover-lift / --ec-press-drop | -1px / 0 |

## 图标系统

- 依赖：`lucide-react`（新增）。EcCanvas 内 32 个 Material 实心图标已全部替换为 Lucide 线性图标（含 ACTION_ICONS 映射表），死导入清除。
- 统一笔宽：`.ec-canvas-page svg[class*='lucide'] { stroke-width: 1.75 }`——CSS 覆盖 SVG presentation attribute，单点控制全页。
- 语义映射要点：生成类 → Sparkles；套图宫格 → Grid3x3；高清放大 → Maximize2；素材库 → Images/FolderPlus。

## 已落地文件

- src/pages/EcCanvas/EcCanvas.css：token 层新增；hero 空状态重写（48px 高度、28px 图标芯片、hover 升阶、入场 stagger、prefers-reduced-motion 关停）；tabs/command/icon-button/topbar-surface/left-rail/bottom-toolbar/zoom/layers/selection-bar/text-node 全部接入 token。
- src/pages/EcCanvas/index.jsx：图标迁移至 lucide-react。
- package.json / pnpm-lock.yaml：新增 lucide-react。
- pnpm-workspace.yaml（本地未跟踪）：allowBuilds 显式 false 以复现原安装行为（pnpm 11 新提示导致的安装失败）。

## 验证记录

- esbuild parse EcCanvas/index.jsx ✅
- pnpm run check ✅
- vite build（临时 stub 配置，绕开视频线程未完成 services/projects.js）✅ 7.86s
- 视觉样张评审（modlens 桥接自检）：五按钮半径/内边距/阴影一致、图标文字对齐、主次清晰；遗留小项为图标与文字基线的 1px 光学对齐微调（低优先级）。

## 后续（backlog）

1. react-icons → lucide 的其余页面迁移（Home/ec 等），复用本映射表。
2. 微交互引入清单（依据《图标库与高级感微交互调研》docs/superpowers/research/2026-08-25-icon-library-micro-interaction-research.md 校准）：
   - **P1 空状态 cursor spotlight**：CSS 变量 --x/--y + radial-gradient 高光层，仅 hero chrome，忌常驻大面积 backdrop-blur；reduced-motion 降级为静态。
   - **P1 View Transitions 页面/画布 tab 切换**：document.startViewTransition 渐进增强，Firefox 自然降级；零依赖。
   - **P2 AI 生成中 border-beam**：conic-gradient 旋转描边，只用于「生成中」这一功能态，绝不用于普通选中（选中保持静态环，画布内容不做装饰动画是铁律）；参考 Magic UI BorderBeam 实现。
   - **P2 图标 micro-motion**：hover 时 SVG 内元素 120ms 位移/旋转，transform-origin:center。
   - **P3 左栏工具组磁吸**：±8px spring(350/28)，rAF 合并指针事件——优先级最低，需可用性验证不干扰精确点击。
   - **不采纳**：素材卡 3D tilt（卡片承载的是用户作品预览，装饰性倾斜违背"只动 chrome"）、涟漪（Material 语言与本体系不合）、常驻 backdrop-blur 类 glow（重绘成本）。
3. hero 主操作是否由「上传图片」让位给「生成电商套图」：涉及转化策略，留给产品决策。

## 调研校准（外部体系对照 · 2026-08-25）

对照 Linear/Raycast/shadcn/Radix/Geist 的公开实测与规范（来源见文末），已落地体系与其共识逐条核对：

**一致（无需改动）**
- 动效：hover 100–150ms / 进入 200–300ms、expo-out 曲线 cubic-bezier(.16,1,.3,1)、stagger 30–50ms 且同屏 ≤5 个接力——本实现 130ms/200ms/40ms 步长，完全落在共识区间。
- 「只动 chrome，不动用户内容」铁律：画布节点/作品永不参与装饰动效，本实现只涉及面板与按钮。
- 三档层级 hover 变化幅度递减（primary 最克制）：primary hover 仅加深填充，secondary 加边框+阴影，符合「克制感来自幅度差」。
- reduced-motion 关停非必要动画。

**采纳并已追加**
- 图标笔宽联动文字层级：默认 1.75，激活态工具栏/tab 升至 2.0 与 semibold 标签同步（本次已加 CSS 规则）。

**记录为浅色主题换算规则（当前画布为 #fafbfc 浅色，报告的深色数值不直接套用）**
- Radix 12 级语义刻度：1–2 页面底 / 3–5 组件底与 hover / 6–8 描边 / 9–11 实心与低对比文字 / 12 高对比文字。若未来出深色主题，surface 取 L*≈3/7/11/15、240° 冷色相、饱和度 ≤5%；描边以白 .04/.07/.10 三档为主、黑投影只留给真浮层且必叠描边。
- 深色 primary 惯例是「白底黑字」（最高亮度=最高优先级）；浅色下对应品牌实心填充，本实现正确。
- 图标三档尺寸：行内/菜单 16、工具栏 20、功能入口大卡 24；图标+文字 gap 固定 8px。当前 hero 芯片 28px 含 16px 字形属紧凑变体，后续大卡入口按 24px 执行。

### 图标库选型校准（同日调研报告，GitHub API 实测）

- Lucide 选型获实测背书：★24,145、周更、shadcn/ui（★122,024）默认内置、与 Vercel Geist 同源几何——迁移决策正确。
- 若未来需要字重梯度表达层级（thin→bold 六档），唯一主流选项是 Phosphor；图标覆盖缺口经 Iconify 取 Solar-linear 补齐并统一描边。
- 报告全文（含九种微交互实现要点与性能红线）：docs/superpowers/research/2026-08-25-icon-library-micro-interaction-research.md

## 图标体系设计与微交互落地（2026-08-25 第二阶段）

### 使用清单审计结论

全画布 31 个 Lucide 字形、约 50 处使用点逐一过审。核心问题是**语义撞车**——三个不同动作共用 Sparkles（新建/重新生成/去背景），违背"各处应有不同表达"的原则。修正映射：

| 动作 | 旧图标 | 新图标 | 理由 |
| --- | --- | --- | --- |
| 顶栏「新建」 | Sparkles | Plus | Plus=普世"新增"，让 Sparkles 专属 AI 生成语义 |
| regenerate 重新生成 | Sparkles | RefreshCw | 刷新是重生成通用语 |
| remove-background 去背景 | Sparkles | Eraser | 橡皮擦直指"抹掉背景" |
| image-info 图片信息 | Shapes | Info | Shapes 与"信息"无关 |
| layer-edit 图层编辑 | Layers | SquarePen | 面板已用 Layers3 表示图层栈，避免同页双"层"形 |

保留决策：hero「从我的作品导入」维持 LayoutGrid（与素材库空态 Images 大图区分：网格浏览 vs 图库实体）。

### 尺寸三档（对齐 Material/Octicons 规范）

行内/工具栏 16px（现网默认）· 功能入口芯片 18px 光学字形（28px 芯片内边距 6→5）· 空态大图示 42px。以 token 注释记录，不逐点改 JSX。

### 微动效词汇（transform-only，130ms spring）

按动词族定向，拒绝无意义弹跳：带入类（上传图片/视频/从作品导入）hover 上浮 -1px——素材"被请进来"；AI 类（Sparkles/Clapperboard）scale1.08 + ±12°/-6° 微旋；新建 Plus（限顶栏 command）旋转 90°；重生成 RefreshCw（限顶栏）逆转 -45°；导出类（Download/FileDown）下沉 +1px。全部走既有 reduced-motion 关停，hover 触发即止、无常驻动画。

### 已实现的两个 P1 微交互

1. **Hero cursor spotlight**：面板加半透白纱罩 + 指针位置经两个 CSS 变量喂给 radial-gradient 高光层，纯合成层绘制；reduced-motion 下退化为静态。
2. **Tab 切换 View Transitions**：handleTabChange 经 document.startViewTransition + flushSync 包裹，Firefox 自动降级为瞬时切换；::view-transition 时长绑定 --ec-motion-base。

视觉样张 v2 复审：面板层次自然、聚光不脏、按钮留白一致 ✅。check ✅ esbuild-parse ✅ vite build(stub) ✅

### 定制字形：Hero 五图标手绘重设计（2026-08-25 第三阶段）

用户明确要求五个入口的图标本身重新设计，而非库图标+动效。产出 `components/HeroIcons.jsx`：24 网格、stroke 1.75、全圆帽、rx≈2 圆角，与全画布 Lucide 同一几何语言，但造型专属。

**两族一共一套**（骨架成对、内记号区分）：

| 图标 | 族 | 构形 |
| --- | --- | --- |
| 上传图片 | 带入族 | 开顶相框（左右壁止于 y9.5 让箭头无碰撞穿出）+ 低置山脊线 + 上行箭头 |
| 上传视频 | 带入族 | 同框体骨架，内记号换播放楔 |
| 从我的作品导入 | 独立 | 背卡肩部露出（堆叠）+ 前卡 + 向右箭头插入卡内=导入方向 |
| 生成电商套图 | 生成族 | 实心源卡(山景) + 右侧幽灵回声卡残影 + 右上角十字星芒＝一份源繁衍更多 |
| 生成视频 | 生成族 | 同生成骨架，内记号换播放楔 |

微动效随之改挂 `.ec-glyph-bring`(上浮) / `.ec-glyph-magic`(scale1.08+10°旋转) 两类；index.jsx 相应修剪 Image/Video/Clapperboard/Sparkles/LayoutGrid 导入。

几何验证：逐路径坐标验算，修掉太阳点与山线端点穿模（圆心距 0.9 < 半径和 1.875）、播放楔与箭杆间距过近两处；视觉桥确认五形渲染完整。check/parse/build 全绿。
### Hero 图标 v3：回到调研结论 + 活体化（2026-08-25 第四阶段，推翻手搓方案）

用户指出手绘路径既不够简洁也违背"先调研、用工具库"的要求。修正：回归调研报告一的选型结论（Lucide 基底），放弃自绘路径；同时落实报告二的"图标 micro-motion"模式与成熟玻璃拟态配方。

**最终语义映射（全部经 lucide-react 实装导出验证）**：

| 按钮 | 图标 | 隐喻 |
| --- | --- | --- |
| 上传图片 | ImageUp | 图片+上行箭头，上传语义自带 |
| 上传视频 | FileVideo | 视频文件载体，配合带入族动效 |
| 从我的作品导入 | FolderInput | 文件夹+进入箭头＝导入直译 |
| 生成电商套图 | WandSparkles | 魔杖+星芒＝AI 生成 |
| 生成视频 | ImagePlay | 图片+播放＝图生视频精准隐喻 |

**活体化三层**：
1. 入场：字形在宿主按钮落位后延迟升入（stagger 变量联动），"按需绘制"而非"盖章"。
2. hover 环境循环：带入族缓慢上浮 bob(1.2s)、生成族星芒式 twinkle(0.9s 转角+缩放脉冲)、导入族横向 nudge——hover 触发即循环、移出即停，transform-only。
3. 面板升级真·磨砂玻璃：backdrop-filter blur(10px) saturate(150%) 单层小面积 + @supports 不透明回退；点阵画布透过玻璃产生真实景深。

reduced-motion 下所有循环/入场动画关停且字形强制可见。check ✅ parse ✅ build(stub) 8.10s ✅ 玻璃渲染截图确认 ✅

## 来源

- Linear 设计逆向（背景/文字/描边实测）：https://github.com/sweetkey/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- Raycast 设计逆向：https://github.com/sweetkey/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
- Radix Colors 12 级刻度：https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- shadcn/ui 主题变量：https://ui.shadcn.com/docs/theming
- Vercel Geist 色彩：https://vercel.com/geist/colors
- Material 图标尺寸：https://m1.material.io/style/icons.html ；Primer Octicons：https://primer.style/foundations
- 动效时长/缓动共识：https://animations.dev 及 https://deepwiki.com/emilkowalski/skill/2.2-easing-curves-and-duration
- Atlassian Motion：https://atlassian.design/foundations/motion ；MDN reduced-motion：https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
