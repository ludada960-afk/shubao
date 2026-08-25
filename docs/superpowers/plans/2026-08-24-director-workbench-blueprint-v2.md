# 薯包导演台重构蓝图 v2 —— 全局盘点 × 沉浸调研后的可落地方案

> 2026-08-24 · 视频线程 · 取代 v1。
> 新增证据：整站只读代码盘点（子代理全量报告）、MiniMax H3 官方 SKILL.cn.md 原文逐字研读、海螺短剧工作室开源实现、Seedance 2.5 导演 Skill 实战视频拆解（B站 BV1zfg36ZEXi）、Xuan酱 AI 叙事方法论视频（BV1p7gP6CErH）、TapNow 实测（项目层完成；画布内部受其反自动化风控限制）、Xuan酱飞书知识库目录。
> 本版所有设计均标注「复用什么 / 改什么 / 不许破坏什么」。

## 一、全局盘点结论（为什么不能局部修）

整站页面域：Home(含 gallery 平铺)/Pricing/Remake/Plog/EcCanvas(画布+作品+素材三合一 tab)/EcStudio/EcAuto/VideoStudio/AdminConsole。路由是 App.jsx 的 pageMap（非 react-router），全局壳挂 TaskSidebar+TopBar。

三条已被代码证实的耦合主脉：

1. **素材库是全站共享心脏**：`Works/projectAssetLibraryModel.js` 同时被 EcCanvas（筛选/批量导入/lineage/retention/production）与 VideoProjectWorkbench.jsx（canReuseProjectAsset 首末帧复用）消费；服务端 `videoWorkbenchStore.requireCanonicalProjectAsset` 以 projectAssetId+contentHash+role/purpose 校验权属。
2. **生成资产单向流入素材库**：generatedAssets(SHA-256 稳定文件) → projectGeneratedAssetImport → project_assets(visibleInLibrary=false) → 各创作域按 ref 复用。
3. **视频域双轨**：legacy(video_assets/video_jobs) 经 videoProjectBridge 桥进新域(video_workbench_* 14 张表)，flag `VIDEO_PLATFORM_P1_WORKBENCH=false`+`P1_PLANNING=true` 决定线上以 planning 模式跑工作台。

**不许破坏的契约**（重构红线）：/api/video/* 与 /api/video/workbench/* 端点签名；projectAssetId+projectId+contentHash+role/purpose 语义；shot/version/candidate/timeline 稳定 ID；billing holds/结算链；App.jsx 壳层与 TaskSidebar。

## 二、行业范式的最终共识（全部有原文/截图实证）

| 范式要素 | 证据源 | 对我们的启示 |
|---|---|---|
| 导演 Skill 是声明式工作流，不是表单 | H3 SKILL.cn.md：强制启动问询 Gate→产品事实摘要→锚定图→节拍分镜→生成→自检 | 我们的 SkillRun 就是这个形态的后端；缺的是把它表达成前端交互 |
| 六列标准镜头信息表 | H3 STEP5：镜头编号时长/连续性衔接/参考锚点(Hook类型)/每秒指令/音轨 | shot schema 扩展的直接模板 |
| 镜头表硬自检门 | H3 STEP5.5 六项校验+passed 戳，不过不进分镜 | 挂进现有 preflight 体系 |
| 角色卡/场景卡锁定+下游作废警告 | H3 STEP3/4 的选项卡与连锁作废 | project_assets 加 card 类型+locked 状态机 |
| 右下角 Agent 入口驱动全程 | Seedance2.5 视频：「只需找到右下角的Agent」上传导演Skill包、拆分镜、改提示词 | 右栏导演助手=SkillRun 步骤的对话化 |
| 并行分镜生成+角色一致性库 | 海螺短剧工作室 README：30镜并行、WebSocket 进度 | 已有 job/outbox/attempts 支撑，补进度流 |
| 工作区是暗色画布 dashboard | TapNow 截图：项目卡网格+视图切换+导入导出 | 视频项目列表层直接对齐 |

## 三、目标架构：一个页面讲清一件事

**信息架构收敛**：VideoStudio 从「单发表单 + 项目工作台两套拼贴」变为单一导演台工作区，旧三个入口（智能成片/首尾帧/爆款重构）降级为导演台内的快捷预设模板（不删除入口能力，删除的是独立表单页心智）。

### 三栏布局（R1 骨架）

```
┌──────────────────────────────────────────────────────────┐
│ TopBar(不动) · 项目切换 · 模式徽标(planning/live) · 导出   │
├─────────┬──────────────────────────────┬─────────────────┤
│ 左:一致  │ 中央:分镜板(创作期) ⇄ 时间线(交付期) │ 右:导演助手      │
│ 性库     │  S01 8s ✓已批  S02 6s ◐候选      │ · 启动问询Gate    │
│ ├素材    │  S03 10s ○草稿 …                │   (一次性问全)    │
│ ├角色卡🔒 │ ────────────────────────       │ · 当前步产物展示   │
│ ├场景卡🔒 │ [选中镜头: 结构化详情]            │   +选项卡确认     │
│ ├锚定图  │                                │ · 自检报告        │
│ └音乐    │                                │ · 生成进度流      │
├─────────┴──────────────────────────────┴─────────────────┤
│ 底部时间线: 已批准候选装配 · 总时长 · 预算余量              │
└──────────────────────────────────────────────────────────┘
```

### 数据映射（全部落在已有表，仅扩展不改名）

- 左栏一致性锁 = project_assets 扩展 asset_kind ∈ {material, character_card, scene_card, anchor_image, music} + video_workbench_asset_versions.locked_at 锁定态。锁定后编辑→版本 stale 标记→依赖 shots 收到 invalidation 提示（复用 lineage 表查下游）。
- 中央分镜板 = video_storyboard_shots 扩展 direction_json 内六列结构：{continuity_link, refs:{landmark,positions,exits,lighting}, hook_type, per_second:[{t,action,camera,space,audio,handoff}], audio_track}。受控词表 hook_type ∈ visual-joke/reversal/suspense/tender/chase/reveal/callback/expression-beat。
- 自检门 = server/videoShotSelfCheck.mjs 新模块：六项规则纯函数校验，输出 {passed, issues[]}；挂进现有 preflight 编排，结果存 video_generation_plan_approvals.metadata。
- 右栏导演助手 = SkillRun 步骤流的 UI 化：每步渲染产物摘要+四个标准动作（批准并继续/重新生成本步/调整参数/查看详情），复用审批门 API，不新增后端范式。
- 底部时间线 = video_timeline_clips 现状直出。

## 四、实施路线（每阶段独立可上线、全量测试绿才进下一步）

| 阶段 | 交付物 | 触及文件(基于盘点实证) | 出口证据 |
|---|---|---|---|
| R1 三栏骨架 | VideoStudio 单工作区布局，现有能力归位，删拼贴感 | VideoStudio/index.jsx, VideoProjectWorkbench.jsx/.css, videoProjectWorkbenchModel.js | UI 测试+现有 2139 测试全绿 |
| R2 一致性锁 | 卡片类型+锁定状态机+下游作废联动 | videoWorkbenchStore.mjs, projects/*, projectAssetLibraryModel.js | 迁移测试+invalidation 链路测试 |
| R3 六列镜头表 | schema 扩展+结构化编辑器 | video storyboard model/store, 新 ShotTable 组件 | schema 往返测试 |
| R4 自检门 | 六项规则引擎并入 preflight | server/videoShotSelfCheck.mjs(新), preflight 编排 | 六规则单测含失败样例 |
| R5 导演助手 | 启动问询 Gate+分步产物+选项卡 | SkillRun 步骤 UI, services/video | 问询流 E2E |
| R6 进度流 | 分镜级并行+SSE 进度 | server/index.mjs SSE 端点, attempts | 并发压测记录 |

## 五、与商业化对齐

- planning 模式（当前线上默认）天然是导演台的免费体验层：建项目/锁一致性/排分镜零积分，切 live 生成时才走预算审批——转化漏斗即工作流本身。
- 一致性资产（角色/场景/锚定图）沉淀成为跨项目可复用资产，构成留存钩子；跨项目保护契约已在素材库实现（cross-project protection），直接继承。
- 计费不变：成功交付扣费+失败退冻结的既有结算守卫全保留。

## 六、调研局限声明

- TapNow 画布内部因反自动化风控（401 code 110003）未能实测，其范式引用来自公开资料与项目层截图。
- 小红书参考帖已失效（重定向首页）。
- 其余证据均为一手原文/开源代码/实测截图。

## 七、下一步（R1 开工清单）

1. VideoStudio/index.jsx 现状读盘 → 抽出可保留的数据 hooks；
2. 新建 DirectorWorkbench 布局组件（三栏+双模式中央区），feature flag `VIDEO_PLATFORM_DIRECTOR_UI`(默认 false) 灰度；
3. 旧布局保留在 flag 关闭路径，直至新 UI 通过全部测试与人工验收后再切换默认值。
