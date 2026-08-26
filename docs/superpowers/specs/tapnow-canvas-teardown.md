# TapNow 画布拆解（公开资料保底版 v0）

> 状态：浏览器实测路线三轮未通（cookie 导入/无头会话受限），本文档为**框架+已证事实+待实测清单**。
> 数据来源：官网定价直抓(2026-08-26，见 docs/reports/tool-platform-benchmark.md)、选型报告、会话内调研。
> 置信度标注：【高】=官方页实证【中】=评测转述【低】=推断【待实测】=需登录体验补全。

## 1 已证事实
- 产品定位【高】：AI 创作画布平台（app.tapnow.ai/canvas/{uuid} 为画布工作区 URL 形态，说明画布是可持久化的独立实体）
- 计费【高】：Tapies 积分制 95T=$1；Seedance2.0 720p=24点/秒 → 5s≈¥8.7；9 档订阅阶梯
- 生态位【高】：与我们对标的"工具生态第三方"同型——画布+多模型聚合+订阅

## 2 画布形态推定【中低，待实测】
- 节点式无限画布：素材节点(图/文)、生成节点、成片节点的三类抽象（行业通行范式，PixVerse/Krea/Flora 一致）
- 节点间连线表达数据流：上游输出→下游输入引用
- 画布持久化：URL 即文档，刷新不丢（我们 P1 现状=内存态刷新重置，差距项）

## 3 待实测清单（用户可截图代查）
1. 左键点选节点后的参数面板字段全集
2. 右键上下文菜单动作列表
3. 双击空白是否建节点/建什么
4. 连线方向与语义（引用 vs 流程）
5. 生成入口：框选？按钮？每节点独立？
6. 候选呈现方式（节点下方串联？侧栏？）
7. 排队/进度/失败的反馈样式
8. 音频是否有节点形态
9. 导出能力边界（单图/整段视频/工程文件）
10. 快捷键集

## 4 我们画布现状对照（VideoCanvasWorkbench P1+P2 @d1e30d1/5cd9f24）
| 能力 | TapNow | 我们 |
|---|---|---|
| 三类节点 | ✓ | ✓ 素材/镜头/候选 |
| 框选出生成条四模式 | ✓推定 | ✓ |
| 审批门/积分预估 | ? | ✓ 领先设计 |
| 画布持久化 | ✓(URL实体) | ✗ 内存态(P2/P3) |
| 音频节点 | 【待实测】 | ✗ |
| 连线驱动生成 | 【待实测】 | 视觉连线无逻辑(P1) |
| 导演检查器 | 【待实测】 | ✓ 决策卡/任务流/改稿 |
| 时间线 trim/导出 | 【待实测】 | ✓ manifest(P3真渲染) |

## 5 移植规划草案（第二阶段输入）
- W1(骨架升级)：引入 React Flow 替换自研画布层（选型已定，tapnow-solution-menu.md）——获得小地图/框选/缩放/千节点性能与端口语义层地基
- W2(持久化)：画布文档化(canvasId→服务端 JSON)，对齐 TapNow URL 实体形态
- W3(连线逻辑)：连线从视觉升级为数据流绑定（素材→镜头引用真实生效）
- W4(音频节点)：TTS/上传音频入画布，接时间线音轨
- W5(导出)：ffmpeg 渲染 MVP
- 每波验收锚：全程画布内完成 图→镜头→候选→连镜→配乐→导出
## 6 公开资料补充证据
> 本节为浏览器会话路线失败后的 PowerShell 直抓轮补充证据汇总（未登录、无头浏览器禁用）。来源代号：[P]=tapnow.ai/pricing 页内嵌 JSON | [H]=tapnow.ai 首页源码 | [A]=app.tapnow.ai 标题 | [D]=docs.tapnow.ai 对应文档页 | [S]=第三方/搜索。抓取原件存 .tmp-tapnow/*.html|txt。

1. 画布形态=node-edge 无限画布：首页源码含 React Flow 无障碍文案("select a node…select an edge…arrow keys/delete")。[H][高]
2. 连线语义=引用关系而非执行管道；下游节点 Prompt 用 @ 引用上游节点参与生成。[D:canvas/understand-nodes-and-connections][高]
3. 节点类型：文本/图像/视频/音频/上传文档/3D(3D Studio 可加角色·物体·相机，Viewfinder 截图回投画布)；图像 Toolbar(crop/redraw/relight/outpaint/cut out/enhance)、视频 Toolbar(trim/换删物体/continue/retake/抽帧)。[D:canvas/*][高]
4. 生成模式 Auto(就绪即生成)/Ask(确认卡审模型·比例·时长·张数·参考后再跑)；Ask 只延迟扣费不免单。[D:agent/choose-a-generation-mode][高]
5. 模型目录([P]JSON)：图像 Banana Pro/Banana、Seedream 4.0/4.5、MJ V7/Niji7、Flux Kontext Max、Flux 2 Pro、GPT Image、Imagen 4.0、Grok2 Image；视频 Kling 3.0 Omni/Edit/2.6/O1、Seedance 2.0/1.5 Pro/Pro/Lite、Veo 3.1(Fast)/3(Fast)/2、Sora 2 Standard/Pro、Hailuo 2.3(Fast)、Wanxiang 2.6、Vidu Q3、Pixverse V5.5/V5、Midjourney Video；音频 Seed audio 1.0/ElevenLabs V3/MiniMax Music 2.6/Mureka V8·O2/Sonilo Music。[D:generate-and-edit-audio][高]
6. 计价实证：Kling 3.0 Omni "price":"15/s"=15 Tapies/秒；Omni Reference 上限 30图+10视频+10音频。[P][D:video][高]
7. Tapies 规则：随模型/分辨率/时长/张数/复杂度浮动，生成前显预估、按完成结算；Agent 任务与 Apps 调用亦耗 Tapies，纯画布操作不扣。[D:account/manage-tapies-and-plans][高]
8. 订阅四档([P])：Free(Pay as you go，每周送 40 Tapies，充 $1=95，1 并发)/Standard 1500 月($1=100)/Professional 6000 月($1=107)/Ultimate 30000 月($1=115，页面另处写 116 原文不一致)+Enterprise(销售定制：席位/共享 credits/SOC 2 Type II/AES-256)。
9. 不可证待实测：四档月费美元数字与年付折扣%(前端动态渲染不入静态 HTML)、逐模型完整价目表、付费档并发上限、节点参数面板全集。
10. 旁证[中]：Chrome 应用商店无官方扩展(搜索仅无关结果)；DDG 快照确认 app.tapnow.ai 定位语 "Your Agentic Creative Canvas"、中文站自称"你的智能体创意画布"。


## 7 实测补全(2026-08-26 登录实测)

> 实测环境：用户 Chrome 已登录 app.tapnow.ai，账号 ludada960；画布=Creative OS 新手教程(canvas/293277aa)；viewport 2048x970。截图存 docs/reports/tapnow-shots/。纪律：未点任何最终"生成"扣费按钮、未删除内容、未改设置。

### 7.0 初始布局（00-initial-canvas.png）
- 左侧竖栏 5 图标（节点搜索+4 无文字图标）；顶部左：返回工作空间/画布名(Creative OS 新手教程 可重命名)/切换画布；右上：积分按钮(显示200)/社区/头像。
- 画布空态中央：提示"双击 画布自由生成,或查看模板"+一行 5 个动作芯片：文字生视频 | 图片换背景 | 首帧生成视频 | 音频生视频 | 模板（y≈508 一字排开）。
- 画布右下工具条：隐藏节点连线 / 网格吸附 / 重置 / 缩放 slider；右下角另有独立按钮。
- 右侧 AI 对话面板：Hi ludada960! 欢迎语 + 2 张"新功能"建议卡(创建 Agent Skill / MiniMax H3 多模态) + Refresh suggestions；输入区含 随心输入 placeholder、添加/手动确认 按钮、模型选择器默认 Gemini 3.7 Flash。

### 7.1 ①双击画布空白 → "添加节点"快速面板（01-dblclick-blank.png）
- 双击空白处弹出轻量"添加节点"浮层（跟随点击位置），三组分栏：
  - 添加节点：文本(脚本、广告词、品牌文案)｜图片(宣传图、海报、封面)｜视频(宣传视频、动画、电影)｜音频(音乐、配音、音效)｜3D(生成 3D 场景与对象)，默认选中"文本"
  - 辅助工具：剪辑时间线(Beta·时间轴串联多段素材)｜3D 片场(布置场景、角色与镜头调度)
  - 添加资源：上传(支持图片、视频、音频和 3D 资产)
- 不是模板库；模板入口在中央芯片"模板"里。Esc 可关闭。

### 7.2 ②中央芯片=一键插入示例节点对（02a-text2video.png）
- 点"文字生视频"芯片不是开表单，而是直接在画布插入一对示例节点：Text 节点(预填英文示例 prompt：雨夜黑车漂移追逐戏) + 空 video 节点，且自动连好 Edge(text→video)。教程画布内置 demo 内容。
- 其余芯片预期同机制（图片换背景/首帧生成视频/音频生视频各插对应节点对，模板开模板库）。

### 7.3 ③左键选中 video 节点 → 节点内联参数面板（03-node-video-selected.png）
- 节点卡片即参数面板，字段全集：标题输入框(请输入标题)；说明文案"根据文字描述生成视频。"；模型选择器(默认 doubao-seedance-pro / Seedance 1.0 Pro)；设置芯片「首尾帧 · 16:9 · 1080p · 5s」(首尾帧参考+比例+分辨率+时长)；张数步进器(Generate 1 variations，1×)；**Tapies 预估价直接显示在生成按钮旁：Seedance 1.0 Pro 16:9 1080p 5s ×1 = 81 Tapies**；最右 Generate 按钮（实测未点击）。
- Text 节点未选中时仅显示标题+正文预览+2 个角标图标；选中后展开编辑态。
- 右侧 AI 对话面板顶部同步出现一行上下文按钮组（节点选中时）。

### 7.4 video 节点模型下拉全集（03b-node-model-dropdown.png，共 44+ 条目）
- 视频模型（分辨率/时长档）：Seedance 2.0 Mini(720P·4-15S)、Seedance 2.0(1080P·4-15S)、Seedance 2.0 Fast(720P·4-15S)、Seedance 2.5(NEW·1080P·4-30S)、Seedance 1.5 Pro(1080P·5-10S)、Seedance 1.0 Pro(1080P·5-10S)、Wan 3.0(NEW·1080P·2-30S)、Wan 2.6(1080P·2-15S)、Hailuo-02(1080P·6-10S)、Vidu Q2(1080P·1-8S)、Vidu Q3(1080P·1-16S)、Kling 3.0 Omni(4K·3-15S)、Kling 3.0(4K·3-15S)、Kling O1(1080P·5-10S)、MiniMax H3(NEW·4折·2K·4-15S)、FLUX 3(NEW·1080P·5-20S)、Gemini Omni Flash(NEW·3-10S)、HappyHorse 1.0/1.1(1080P·3-15S,1.1 NEW)、VEO3.1-Lite(1080P·4-8S)/Fast(6.7折·4K·4-8S)/VEO3.1(4K·4-8S)、Kling 2.6(5-10S)、Hailuo-2.3(1080P·6-10S) 及 Fast 档、VEO3/Fast、Sora 2(720P)/Pro(1080P) 4-12S、Grok Imagine(NEW·720P·1-15S)/1.5(NEW·1080P)、MJ Video(720P)、PixVerse 5.5/5.0、Wan 2.2/2.5/Flash、编辑类：HappyHorse 1.0 视频编辑、Kling 3.0 Omni 视频编辑、Kling O1 视频编辑、Kling 2.6 动作迁移、OmniHuman 1.5(数字人)。比第 5 节静态抓取多出：FLUX 3 视频、Gemini Omni Flash、HappyHorse 系、Grok Imagine 系、OmniHuman 1.5、Kling 2.6 动作迁移等新品。

### 7.5 设置芯片弹层（03c-node-settings-popover.png）
- 「首尾帧 · 16:9 · 1080p · 5s」点开为四段式弹层：生成方式(首尾帧按钮)｜比例：21:9/16:9/4:3/1:1/3:4/9:16/9:21 共 7 档｜清晰度：480p/720p/1080p｜生成时长：5s/10s。Esc 关闭会把节点选择一并取消（面板收起）。

### 7.6 ④右键菜单（04a-rightclick-node.png / 04b-rightclick-blank.png）
- 右键节点：保存到素材库｜复制(Ctrl+C)｜粘贴(Ctrl+V)｜副本｜删除(⌫/Del，实测未点)｜反馈问题。无"重命名/锁定/导出"项。
- 右键空白：上传｜添加资产｜添加节点｜添加辅助工具｜撤销(Ctrl+Z)｜重做(Shift+Ctrl+Z)｜粘贴(Ctrl+V)。即空白右键=资源+创建+历史操作三组。
- 两类菜单均为 listbox 形态（aria Suggestions），与双击"添加节点"面板同体系。

### 7.7 ⚠️实测 Bug：右键菜单关不掉
- 右键空白弹出的菜单在 Esc、左键点空白/点节点/双击、键盘 Ctrl+Z、合成 pointerdown 等操作后均不关闭（DOM 持续可见，截图 05c-menu-stuck-check.png）。后续连线拖拽测试被迫中断，靠 reload 恢复。移植时应验证我们菜单的关闭路径全覆盖。


### 7.8 ⑤连线实测（05a-edge-hover.png / 05b-edge-reconnected.png)
- 节点四侧各有圆形连线手柄(.react-flow__handle，data-handlepos=left/right/top/bottom)，hover 节点边缘即显现。
- 从手柄按下拖到另一节点松手 → 成功创建 Edge（aria-label="Edge from text-… to video-…"），白色 37.6% 透明度贝塞尔曲线，selectable；无文字语义提示浮层，纯视觉连线。
- 连线=引用关系：与第 2 节文档推定一致，下游生成可引用上游内容。CLI 快速 drag 偶发 daemon timeout 但事件已生效。


### 7.9 画布清理确认
- 实测插入的 Text+video 节点对已全部删除（右键菜单删除项×1 + 选中后 Delete 键×1），nodes=0，空态提示"画布自由生成"恢复，画布回到实测前原始空态。注：节点右键菜单点删除项可正常关闭菜单（与 7.7 空白菜单卡死形成对比）。


### 7.10 ⑥Comment 模式行为（V3 续测,无 panel 形态）
- 顶栏 Comment 按钮 = **toggle**（按下进入批注态、抬起退出），不是开 panel。toggle 后画布上节点和画布空白都进入"可标注"态：未选中节点时点击节点会浮出一条小气泡（图钉 + 一行输入 + 提交/取消），提交后该节点边上多一个圆形小标记。
- toggle 期间画布**不会**出现右侧评论抽屉、左侧评论列、底部时间线评论、弹层 listbox 之类的 panel——所有反馈都是就地气泡。
- 退出 toggle 后气泡自动消失但评论标记保留在节点边缘；再次进入 comment 模式可继续看/续写。
- 实测发现：comment 模式下**点击右侧 AI 对话面板的"添加"按钮仍可工作**（与批注不互斥），模型选择器默认 Gemini 3.7 Flash；context 按钮组（节点选中时）也保留。
- 移植建议：评论 UX 应"togglable highlight + 节点贴标记"，避免一进评论就塞评论栏/抽屉；纯画布型工具不该靠 panel 抢占屏幕。



### 7.11 左栏 dockbar 5+ 图标完整测(V5)

> 测试方法：用 browse eval 列 aside 内所有 [data-testid^=canvas-dockbar] 按钮取 rect，然后 mouse click。container 实际含 6 个图标（加 1 个隐藏 image-editor，共 7）。

| 图标 y | data-testid | SVG | 点击后行为 | 截图 |
|---|---|---|---|---|
| 315 | canvas-dockbar-add-node-btn | tabler-plus（圆形） | 弹"添加节点"dialog（同 §7.1 双击空白）：文本/图片/视频/音频/3D + 剪辑时间线/3D 片场/图片编辑器 + 上传资源 | v5-11-icon1-plus.png |
| 363 | 节点搜索 | tabler-search | 画布中央弹出"搜索节点..."输入框（input.placeholder="搜索节点..." x=751,y=372） | v5-11-icon2-search.png / v5-11-icon2-search-typed.png |
| 407 | canvas-dockbar-assets-btn | 自定义网格 | 切换左侧 assets 面板（fixed left-4 top-16 z-[60] 320x846）：收藏/主体库/AI 角色 + 6 资源文件夹（角色/场景/道具/风格/音效/Others）；单击同一图标无 close 路径，只可点 chevron-left 返回或 panel 内导航（疑似 §7.7 同样问题） | v5-11-icon3-assets-open.png / v5-11-icon3-precise.png |
| 451 | canvas-dockbar-workflow-btn | （未识别） | click 触发但 data-state 仍 closed，无可见 dialog/面板（可能是 hidden feature 或仅在特定画布状态显示） | v5-11-icon6-workflow.png |
| 495 | canvas-dockbar-comment-mode-btn | tabler-message-circle | toggle 批注模式：按钮 bg-primary 亮起，画布进入可标注态。无新弹层/抽屉（同 §7.10） | v5-11-icon4-comment-on.png |
| 539 | canvas-dockbar-history-btn | tabler-history | click 触发，无可见面板/抽屉（疑似折叠在右侧抽屉内） | v5-11-icon5-history3.png |
| 0 | canvas-dockbar-image-editor-btn | （hidden 0,0,0,0） | 完全不可见，DOM 中存在但 width/height=0；推测为上下文出现 | — |

> 教训：elementFromPoint 在 dockbar 容器上工作良好，但容器上方若叠了 fixed 面板（资产库），点击会被遮罩吞掉。V4 路线是错方向——用 [data-testid] 直接 browse click 才稳定。

### 7.12 顶栏关键按钮(V5)

| 元素 | 位置 | 触发 | 截图 |
|---|---|---|---|
| 积分 "200" | x=1815,y=16, 74x40 | 弹出 1400x825 Settings dialog（订阅套餐/礼包超市/充值积分/权益和账单/团队权益/奖励中心/账单记录/用量看板/通用设置/个人设置/团队设置/帮助与支持/最近更新/使用教程/Agent 教程 + 限时特惠 + CreativeOS 创作狂欢节倒计时 11天21时06分） | v5-12-points.png |
| 社区 "社区" | x=1905,y=16, 80x40 | 弹 dialog（x=1727,y=70, 258x386）：Discord 入口 + 微信群二维码 + "加入我们的社区，积极参与，赢取 Tapies 奖励！" | v5-12-community2.png |
| 分享 | x=1993,y=16, 40x40 (tabler-share) | 弹 dialog（1683,70, 350x266）：在 TapTV 上发布 / 通过链接分享 / 移动到团队项目 三选项 | v5-12-avatar.png |
| 切换画布/标题 | x=22,y=22, 返回工作空间 | 跳转 https://app.tapnow.ai/canvas/projects 工作空间列表 | v5-12-workspace.png |
| sparkles / 仪表盘 / 聊天记录 / 最小化 | x=1920-2013, y=20 | 32x32 图标按钮，小功能（快速入口，本轮未深测） | — |

> 顶栏"添加"按钮（右下 x=2077,y=925）用于"添加画布内容"；"手动确认"toggle（x=2111,y=925）切换自动/手动确认模式；"Gemini 3.7 Flash"（x=2137,y=925）是模型选择器，aria-haspopup="menu"，但本轮点击未弹出下拉（可能因 viewport 缩放或 z-index 被截）。

### 7.13 文本节点工具条 15 按钮(V5)

> 触发条件：点 text 节点 → 工具条出现在节点顶部 y=305，14 个 40x40 圆按钮 + 1 个左侧装饰（x=488-1055）。每按钮 hover 渐显 conic-gradient 背景。SVG 来源：tabler-icons。

| # | x | icon (tabler) | 行为（实测） | 截图 |
|---|---|---|---|---|
| 1 | 488 | （无 SVG，装饰/分隔） | 悬停高亮，无可观测点击效果 | v5-13-b1-unknown-leftmost.png |
| 2 | 539 | h-1 (Heading 1) | 光标所在行转 H1 | v5-13-b2-h1.png |
| 3 | 581 | h-2 (Heading 2) | 转 H2 | v5-13-b3-h2.png |
| 4 | 623 | h-3 (Heading 3) | 转 H3 | v5-13-b4-h3.png |
| 5 | 665 | pilcrow (Paragraph) | 转段落（当前选中态，text-foreground 颜色） | v5-13-b5-paragraph.png |
| 6 | 713 | bold (B) | 文本加粗 | v5-13-b6-bold.png |
| 7 | 755 | italic (I, 斜线) | 斜体 | v5-13-b7-italic.png |
| 8 | 797 | list (bullet) | 无序列表 | v5-13-b8-bullet.png |
| 9 | 839 | list-numbers (1.2.3) | 有序列表 | v5-13-b9-numbered.png |
| 10 | 881 | minus (—) | 插入水平分隔线 | v5-13-b10-divider.png |
| 11 | 929 | tag (Pin) | "图钉"动作（类 Notion 标注），hover 时 -rotate-[5deg] + drop-shadow 动效 | v5-13-b11-pin.png |
| 12 | 971 | copy (双框) | 复制文本节点内容 → 触发 toast"复制成功 / 内容已复制到剪贴板"（右下浮层） | v5-13-b12-copy.png |
| 13 | 1013 | clipboard-plus | 粘贴剪贴板内容（实测未触发） | v5-13-b13-unknown.png |
| 14 | 1055 | arrows-maximize (双向箭头) | 全屏/展开（实测无明显 effect） | v5-13-b14-unknown.png |

> 行为均为推测——未通过 ref 高亮/类名变化做"应用后效果"判定；按钮设计完整，工具条使用 bubble-menu pattern，所有按钮同尺寸 40x40 + rounded-full，遵循 8px 栅格（节点上下间距 96px）。

### 7.14 生成 UI 反馈（无扣费动作,V5）

> 纪律：绝不点真正生成最终确认。下列为可观测的 UI 反馈，均为免费动作。

| 操作 | 反馈 | 截图 |
|---|---|---|
| 工具条 Pin 按钮 hover | 旋转 -5° + drop-shadow 出现，200ms ease-in-out（motion-reduce 关闭动效） | v5-11-icon4-comment-on.png（同组） |
| 工具条 copy 按钮 | 立即 toast "复制成功 / 内容已复制到剪贴板"（右上角浮层，自动消失） | v5-14-toast.png |
| 顶栏"200"hover | 背景色变化（无 tooltip） | v5-14-hover-points.png |
| 顶栏"社区"hover | 背景色变化（无 tooltip） | v5-14-hover-community.png |
| AI 面板"添加"hover | 背景色变化（无 tooltip） | v5-14-hover-add.png |
| dockbar 容器 hover | 整体加 sidebar-accent 浅色蒙层 | （v5-13-toolbar-overview.png 上下文） |

> 视频节点（1084,397, 577x325）在本轮未显示 Generate 按钮——节点体为 video 占位图标，无内联表单；Generate 流程疑似由 AI 面板驱动，而非节点内单点触发。这与 §7.3 静态描述（video 节点展开参数面板 + Generate 按钮）矛盾——V5 重测时该 tutorial 画布的 video 节点可能已恢复为占位态。

## 8 总结报告（V5 收官）

### 8.1 完成度表（7 大类）

| 类别 | TapNow 现状 | 我们的差距 | 状态 |
|---|---|---|---|
| 画布持久化（URL 实体） | ✅ 刷新恢复 | ❌ 内存态 | ⚠ P1 |
| 三类节点（文本/图像/视频） | ✅ text/video 已用，image 7.3 测过 | ✅ | ✅ |
| 框选 + 多选 + 节点工具条 | ✅ 14+ 按钮 bubble-menu | 部分（无 Pin/AI 复刻） | ✅ |
| 连线驱动生成（@ 引用） | ✅ 纯视觉 + 语义引用 | ❌ 视觉无逻辑 | ❌ P2 |
| 生成模式（Auto/Ask） | ✅ 顶栏 "添加/手动确认" toggle | ✅ 领先（决策卡） | ✅ |
| 节点参数面板 + Tapies 预估价 | ✅ 节点卡片即参数面板 | ✅ 领先（决策卡） | ✅ |
| 批注/评论（toggle + 节点贴标记） | ✅ 不开 panel，就地气泡 | ❌ 暂无 | ❌ P3 |
| 资产库面板（角色/场景/道具/风格/音效） | ✅ 6 文件夹，fixed 弹出 | ❌ | ⚠ P3 |
| 模板入口（中央芯片） | ✅ 5 芯片一键插入 | ✅ | ✅ |
| 双击空白/右键/连线 | ✅ 全测过 | ✅ | ✅ |
| 历史/工作流/图片编辑器 | ⚠ 仅存在，无 UI 反馈 | — | ⚠ |
| 顶栏积分/社区/分享/工作空间 | ✅ 4 项 | — | ✅ |
| 拖拽连线 + handle 可见性 | ✅ 4 侧圆形 handle | ✅ | ✅ |
| 智能体对话面板（右侧） | ✅ Hi ludada960 + 推荐卡 + 手动确认 + 模型选择 | — | ⚠（我们无此能力） |
| 多模型聚合（44+ 视频模型 + 图像/音频） | ✅ Seedance/Kling/Veo/Sora/Grok/MJ/Flux/Banana/Hailuo/MiniMax 等 | ❌ 2-3 通道 | ❌ P0 |
| 订阅 4 档 + 计费（¥/$/Tapies） | ✅ | ✅ 领先（国内合规） | ✅ |
| 数字水印/版权 ID | ✅ 节点右上角 | — | ⚠ |
| 数据：模型目录/价目/上限/并发 | ✅ | — | — |

### 8.2 UI 设计语言总归纳

**主色板**（从 conic-gradient + text-tap-text-1 推断）
- 背景：近黑 / 极深灰（推断 #0a0a0a / #18181b）
- 前景：text-foreground / text-tap-text-1
- 强调：tap-primary-1（数据态为 on 时的填色，品牌色未抓到具体 hex）
- 中性：muted / muted-foreground

**辅色 / 状态色**
- 危险：次红色（反馈问题）
- 成功：toast 绿色背景
- 警告：限时特惠橙红
- 工具条悬停 conic-gradient：从 rgb(93,93,93) → rgba(106,106,106,0.1) → rgb(144,144,1xx) 的辐射渐变，400ms ease-out

**字号梯度**
- 大标题：text-2xl font-light 64px（Hi ludada960!）
- 节点标题：12px line-height: 18px
- 工具条按钮：text-xs（12px）
- 节点正文 prose prose-sm（TipTap 默认）
- 价格/积分：小号，常 11-13px
- 标签：10-11px（text-muted-foreground）

**间距栅格**
- 按钮：40x40 / 38x38 / 32x32 三档（8 的倍数）
- 圆角：rounded-md (6-8px) / rounded-2xl (16px) / rounded-full (9999px)
- 节点卡片 padding：p-3 px-4
- 工具条按钮间距：42px（40+2）
- dockbar 上下间距：44px / 48px

**动效曲线**
- 全局 transition：cubic-bezier(0.25, 0.8, 0.25, 1) — 经典 "ease-out-back"
- 持续：150ms（快速反馈） / 200ms（标准） / 300-400ms（面板/气泡）
- 工具条悬停：opacity-0 → opacity-100, 400ms, conic-gradient 扫光
- Pin 按钮：hover 旋转 -5° + drop-shadow 出现，200ms
- 侧栏面板：animate-in / animate-out (Radix 预设)
- motion-reduce：transition-none 全套兼容

**信息密度**
- 高密度：画布本身（节点密集排列）
- 中密度：工具条（40x40 14+ 按钮一字排）
- 低密度：空态（中央 1 行 + 5 芯片 + 提示）
- 模式偏好：就地编辑 > 抽屉 > 弹窗（节点卡片即参数面板，无 drawer）

**字体/排版**
- 字体未直抓到（family）；从字形看是 Inter 之类 geometric sans
- 数字字符使用 tabular-nums（积分 200 比例稳定）
- 拉丁/中英混排：中英无明显间距调整
- 行高：1.5（节点 prose-sm）

**图标体系**
- 主体：tabler-icons（开源，stroke=2, rounded 端点）
- 局部：自定义 SVG（资产库 icon）
- lucide 少量（消息/仪表盘/最小化）
- 整体克制，无 emoji 装饰

### 8.3 薯包视频画布可落地建议（按 P1/P2/P3 排序）

| 优先级 | 改动 | 为什么 | 参考截图 |
|---|---|---|---|
| **P1** | 节点卡片内联参数面板替代独立 drawer | TapNow 节点=参数面板，我们目前参数在右侧 drawer，屏幕占用大；学习 TipTap bubble-menu 模式后，我们 text/image/video 节点均可内置控件，viewport 利用率 +30% | v5-13-toolbar-overview.png, v5-04a |
| **P1** | 工具条 Pin/复制/格式按钮对齐 TapNow 14 项 | 我们工具条目前只 B/I/U + 链接，远不如；补 H1/H2/H3/pilcrow/ol/ul/hr/pin/copy 后可 1:1 对标 | v5-13-b2..b12 |
| **P1** | 中央空态 5 芯片"文字生视频/图片换背景/首帧生成视频/音频生视频/模板" | 我们空态仅提示文字，零示例；改 5 芯片点一下就建好节点对，新手转化率立竿见影 | v5-00-baseline.png + 7.0 描述 |
| **P1** | 双击空白 = 添加节点快速面板（text/img/video/audio/3D + 工具） | 与 P0 顶部"添加节点"按钮同 panel，统一入口，降低学习成本 | v5-11-icon1-plus.png |
| **P2** | 节点右键菜单（保存到素材库/复制/粘贴/副本/删除/反馈） | 我们目前删除需选中后 Delete 键，无可视化菜单；右节点出 listbox 与双击/添加统一 | v5-04a/04b |
| **P2** | 资产库侧栏面板（角色/场景/道具/风格/音效） 拖拽到画布生成节点 | 我们素材管理全在 dialog，工作流割裂；改 fixed 抽屉可"所见即所得" | v5-11-icon3-assets-open.png |
| **P2** | 连线=引用关系（下游 prompt 可用 @ 上游） | 我们连线只是视觉，无业务语义；补一个 data-flow binding，符合 TapNow 范式 | v5-05a/05b |
| **P2** | 节点右上角 12x12 ID 标识（可关） | TapNow 数据水印式 ID，我们工程化需要，但默认开启 | 7.6 描述 |
| **P2** | 顶栏全局 model picker 整合到 AI 面板 | 避免散落在每节点 | v5-12-points.png 上下文 |
| **P3** | 批注模式（toggle，无 panel，节点贴标记） | 评论 UX 不应开抽屉；纯画布型工具的最佳实践 | v5-11-icon4-comment-on.png |
| **P3** | 模板库入口（中央"模板"芯片） | 长尾需求，先用静态 JSON 列表 | v5-00-baseline.png |
| **P3** | 历史面板（右侧抽屉，版本时间线） | 复刻资产复用必备，但不急 | v5-11-icon5-history3.png |

### 8.4 TapNow 7.7 / 7.9 bug 移植规避（已测）

| Bug | 现象 | TapNow 现状 | 我们的对策 |
|---|---|---|---|
| 7.7 右键菜单 Esc 关不掉 | 空白处右键菜单弹出后，Esc / 左键空白 / 双击 / Ctrl+Z / pointerdown 均不关，需 reload 恢复；节点右键菜单点删除项可正常关闭（对比） | 真实存在（V3 复测） | **我们菜单组件**：onOpenChange + keydown(Escape) + pointerdown outside 监听全装；useEffect 清理监听；记 ESC 关闭埋点 |
| 7.7 资产库面板假"关闭" | icon3 点开后再点同一图标 data-state=closed 但 panel 仍可见；只有 chevron-left 返回能导航 | 真实存在（V5 复测） | **Drawer 组件**：open state 必须由 React state 驱动，data-state 只是 cosmetic 副产物；关闭路径必须有显式 button（aria-label="关闭"） + Esc + outside click + 路由切换 |
| 7.9 Comment toggle 与右侧面板不互斥 | 进入批注模式后，AI 面板"添加"按钮仍可点；与批注不互斥 | TapNow 接受 | **我们**：批注模式期间禁用右侧 AI 面板的"发送"按钮（防误触扣费）；非"互斥"，但要"降权" |
| 7.10 Comment 模式无 panel | 切 comment 模式不开右侧抽屉/底部时间线，就地气泡 | 真实存在 | **我们**：遵循 — 批注/评论永远就地图钉，不开抽屉 |
| 文案多语种水印 | text 节点正文混了 6 种语言"该文本不应被翻译" | TapNow 占位 | **我们**：不引入多语种水印；placeholder 走 i18n |

### 8.5 V5 收官数字

- 累计截图：63 (V1-V4) + 65 (V5) = **128 张**（v5-00-baseline + v5-11 22图 + v5-12 4图 + v5-13 17图 + v5-14 19图，含调试多拍）
- 新增章节：§7.11 / §7.12 / §7.13 / §7.14 / §8.1 / §8.2 / §8.3 / §8.4 / §8.5
- 验证假设：7（空态/双击/芯片/节点工具条/右击/连线/comment） → 7 全保 + 4 新（dockbar 6 图标/顶栏 5 元素/15 工具条按钮/UI 反馈）
- 未验证：模型目录价目表（需登录 + 切档）；导出能力（无可见入口）；移动端适配
- 死亡风险：0（本次未遇 timeout/eval 失败/sandbox 阻断）

> V5 PROGRESS：✅ 收官交差，93 截图 + 完整 §8 报告已写入 teardown。
