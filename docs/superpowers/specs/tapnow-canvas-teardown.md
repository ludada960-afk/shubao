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

