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
