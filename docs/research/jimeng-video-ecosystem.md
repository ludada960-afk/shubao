# 即梦 AI 视频生态深度调研与薯包「接近它」规划

> 调研对象：即梦 AI 网页版（jimeng.jianying.com，站点版本 web_version 7.5.0 / 2026-09-10 抓取）
> 调研时间：仓库时间线 2026-09（基于 2026-09-10 抓取的站点一手证据 + 当日 B 站官方宣传片解析）
> 用户指令：「即梦现在提供的那些视频相关的生态是非常完善的，你应该去把那些生态做进来」
> 范围约束：只调研与产出，不改代码。
> 姊妹文档：
> - `.worktrees/codex-ecommerce-stability/docs/research/jimeng-web-BV11fYx6eEuc.md`（B 站官方宣传片 BV11fYx6eEuc 逐帧 OCR 解析，本报告直接引用其时间点）
> - `.worktrees/codex-ecommerce-stability/docs/research/jimeng-web-teardown.md`（站点全功能与接口拆解，本报告所有「接口级」结论的原始出处）
> - `.worktrees/codex-ecommerce-stability/docs/research/shubao-current-capabilities.md`（我方代码能力盘点，含行号证据）
> - `.worktrees/codex-ecommerce-stability/docs/research/master-plan-node-ecosystem.md`（节点化生态总方案 §543/§563）
> - `.worktrees/codex-ecommerce-stability/docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`（我方视频平台路线图 P0–P3，含本地实施状态）
> 原始证据：`.worktrees/codex-ecommerce-stability/.tmp-research/jimeng/`（30+ 接口 JSON 快照、162 个 JS chunk 路由反查、50+ 张截图；本报告对其中的 video/audio/capsules/agent 配置 JSON 做了逐项二次核验）

---

## 0. 证据来源与置信度分级

| 标记 | 含义 | 载体 |
|---|---|---|
| 【接口实】 | 即梦官网接口返回原文（游客态可取），本次调研逐项复核 | `.tmp-research/jimeng/api-*.json`（2026-09-10 抓取） |
| 【视频实】 | B 站官方宣传片（BV11fYx6eEuc，2026-09-09 发布）画面 OCR 实取 | `.tmp-research/v2/frames/` + 仓库 BV 报告 |
| 【页面实】 | 站点页面 DOM / 路由表 / bundle 反查（受控 Chrome 实测） | teardown 报告 §1–§3 |
| 【代码实】 | 薯包仓库代码行号证据 | capabilities 报告（file:line） |
| 【路线图】 | 薯包视频平台路线图本地实施状态 | 2026-08-14 roadmap §5–§8 + §14 台账 |
| 【推测】 | 由上述证据结构推断，未读到原文 | 本文标注 |
| 【未确认】 | 登录墙 / 未抓取到 / 无证据 | 本文 §6 集中列 |

**今日未做全网二次验证**：web 搜索桥不可用（firecrawl 429 限流约 1 天、DDG 人机验证、Bing 返回垃圾结果）。所有「即梦现状」结论以上述仓库内 2026-09-10 一手证据为限；若 9 月 10 日之后即梦有上新（如模型迭代），以「未确认」对待。

---

## 1. TL;DR（结论速览）

1. **即梦的视频生态是四层结构**：
   **模型层**（Seedance 家族 × 6 种输入模式 + 第三方模型超市）→ **资产层**（主体库 / 素材库 / 技能广场 186 技能 / 提示词资产）→ **画布层**（无限画布五类元素 文/图/视/音/**时间线** + 卡片连线 + 框选编号链式改写）→ **分发层**（作品社区公开 + 「查看创作过程」只读画布 + 一键「复制项目」+ 开放 API 控制台）。
   **「视频工作台」就是无限画布本身**——时间线是画布内置元素，站点路由表里没有独立的视频编辑器路由（【接口实】+【页面实】，见 §3）。
2. **模型层最硬的三处**（全部 Seedance 2.5 独占）：① 全能参考 50 个素材（图 30 + 视频 10 + 音频 10，视频/音频总时长各 ≤30.2s）② 超长视频 30–180s 单独计价 ③ 自然语言视频编辑 4–30s（提示词 ≤2000 字）。另有**数字人两条独立产线**：对口型（OmniHuman 1.5 基础/大师/快速，多人脸检测 + 自动静音检测）与动作模仿（DreamActor M1.5/M2.0 大师/生动/快速），以及**音频产线**：Seed TTS（语速+情绪，按百字计费）+ SeedMusic 1.0（30–360s，15 套歌词模板，多语种演唱）【接口实】。
3. **运营层最值得抄**（成本最低、回报最高）：技能市场（186 技能 / 12 分类 / 用户可发布 / 使用量·点赞·添加三个公开计数 / 作者署名 / original_skill_id 二创溯源）、只读画布 + 一键复制项目、四维 SKU 分档（模型×分辨率×时长×有无输入视频）与「元/秒」定价话术。这正是「把生态做进来」的第一落点——**先做运营层与参数面，模型层走我方 Provider 适配（已有四层底座）补齐**。
4. **我方现状一句话**：EcCanvas 数据模型已是节点图（执行引擎 P0/P0.5 本地完成未部署）+ VideoStudio 独立三界面（路线图 P0 底座已 live、P1 分镜/时间线/成本护栏与 P2 技能重放/记忆 与 P3 高级编辑**全部本地实现、feature-dark**）+ 规划的 5 个工作流模板（T1–T5）。缺的不是能力清单，是**① 真音频（TTS 现在是 mock）② P1 工作台暗开→灰度并并入画布 ③ 视频节点参数面一次留够（照抄即梦 6 输入模式 + 模态分档参考上限）④ 技能市场层 ⑤ 商品主体资产化 ⑥ 视频 SKU 四维分档**（即 §5 的 P0 六条）。
5. **不必做**：自研视频模型与影视技能资产（字节/阿里模型资产与成本结构）、剪映级重型 NLE（即梦自己也没做，其画布时间线是轻量多轨）、公开作品社区与开放 API（可选/远期）。

---

## 2. 即梦视频生态功能全景表

> 格式：功能 / 用途 / 输入→输出 / 关键参数 / 证据 / 我方对应或缺失。
> 「我方对应」列只写能力级定位，行号证据在 capabilities 报告内，此处不重复。

### 2.1 视频生成（模型 × 输入模式矩阵）

| 模型（原名） | req_key | 输入模式（input_media_type 枚举原文） | 分辨率 | 时长 | 特点 / 计费 SKU | 证据 | 我方对应或缺失 |
|---|---|---|---|---|---|---|---|
| 即梦 Seedance 2.5（默认） | `dreamina_seedance_45_pro` | `unified_edit / prompt / first_frame / end_frame / long_video / edit`（**6 种**） | 480p/720p/1080p | 96–720 帧 = 4–30s（24fps 固定）；**long_video 30000–180000ms = 30–180s** | 最强模型：50 参考 + 视频编辑 + 超长生成；SKU `seedance_25_{480,720,1080}p_output` + `_long_video_*` + `_no_input_video_output`；提示词上限 15000 字符；批量上限 4；提示词增强开关 | 【接口实】本次复核 options 原文 | 我方 Provider 有 Seedance 2.0 + MiniMax H3 配置（RTK 2026-08-14），**输入逻辑 3 套（智能成片/首尾帧/爆款重构）**；缺「全能参考」「自然语言编辑」两个维度；SKU 无分辨率/时长分档 |
| 即梦 Seedance 2.0 mini | `dreamina_seedance_40_mini` | `unified_edit / prompt / first_frame / end_frame` | 720p | 96–360 帧 = 4–15s | 极致性价比，比 Fast 更快推理；`seedance_20_mini_720p_output` | 【接口实】 | 缺「mini 快试档」对应物（我方 fast/standard 两档近似） |
| 即梦 Seedance 2.0 Fast VIP | `dreamina_seedance_40_vision` | 同上 | 720p | 4–15s | **会员专属通道**；音视文图均可参考（暂不支持真人人脸） | 【接口实】 | 我方无会员专属模型通道概念 |
| 即梦 Seedance 2.0 VIP | `dreamina_seedance_40_pro_vision` | 同上 | 720p/1080p/**4k** | 4–15s | 会员专属；全模态参考 | 【接口实】 | 无 |
| 即梦 Seedance 1.5 Pro | `…vgfm_3.5_pro` | `prompt / first_frame / end_frame` | 720p/1080p | 120–288 帧 = 5–12s | **音画同出**（视频自带音频）；1080p 加价 SKU | 【接口实】 | 我方视频链路无「音画同出」档 |
| 即梦 Seedance 1.0 / 1.0 Fast | `…vgfm_3.0_pro / _fast` | `prompt / first_frame`（Fast 多 `multi_frame` **多帧**） | 1080p（Fast 720/1080） | 120–240 帧 = 5–10s | 老档低价 | 【接口实】 | 无对应老档（无妨） |
| MiniMax H3 / HappyHorse 1.1（阿里 ATH）/ Wan 3.0（通义） | `dreamina_minimax_h3` / `dreamina_happyhorse_v1_1` / `dreamina_wan_30` | 各自 unified_edit（上限 12/9/20）+ prompt + first_frame(+end_frame) | 768P/2K；720P/1080P | 4000–15000ms | **第三方模型超市**：把别家模型接进同一表单、同一计费体系 | 【接口实】（teardown §2.2，本次未逐条复核） | 我方已接 MiniMax H3（未上架）；「模型超市」运营形态我方没有 |

**通用参数（全部视频模型共用，【接口实】）**：fps 固定 24 且 `forbidden_display: true`（UI 不给改）；比例 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16（HappyHorse 多 4:5 / 5:4 / 9:21）；界面时长滑杆显示 4–15s（`video_duration_display_range`）；分辨率显示档 720P/1080P。

### 2.2 全能参考（unified_edit）上限——本次逐项复核原文

`reference_resource_config`（agent config 顶层，【接口实】）：

| 维度 | 值 |
|---|---|
| 参考素材总数 `max_resource_count` | **50** |
| 图片 ≤30 张 | 单张 300–6000px、≤30MB、jpeg/png/webp/bmp/tiff/gif/heic/heif、长宽比 0.4–2.5 |
| 视频 ≤10 段 | 单段 1.8–30.2s、≤200MB、mp4/mov、24–60fps；**总时长 ≤30.2s** |
| 音频 ≤10 段 | 单段 1.8–30.2s、≤15MB、wav/mp3；**总时长 ≤30.2s** |

Seedance 2.0 系列同构上限收紧为 12 个素材（图 9 / 视频 3 / 音频 3）【teardown §2.2】。
**我方对应**：画布参考端口上限 9（Quantv 式），且无「按模态分档」的参考槽 → 差距（§5 P0-2/P2-10）。

### 2.3 视频编辑 / 续写（延长）/ 超长生成

| 功能 | 即梦形态 | 参数 | 证据 | 我方对应或缺失 |
|---|---|---|---|---|
| **视频编辑**（edit 模式，Seedance 2.5 独占） | 自然语言指令改已有视频：「从画面调整到内容重塑」 | 4–30s 视频、提示词 ≤2000 字、比例/时长 adaptive | 【接口实】`edit_config_val` 原文 | 无等价物 |
| **续写/延长**（extend_config） | 从上一段结尾继续生成 | 所有模型 options 里都带 extend 选项，但 `support_model_req_key` 仅 `dreamina_seedance_45_pro`（= 实际仅 2.5 可用） | 【接口实】 | **我方路线图 P3-02 续写已本地实现**（「从已批准边界帧 + 显式时长 + 成本上限」），未开放 |
| **超长生成**（long_video） | 30–180s 滑杆（min 30000 / max 180000 / step 1000 / 默认 30000） | 单独 SKU `seedance_25_long_video_*` | 【接口实】 | 无（依赖上游 Seedance 2.5） |
| 营销口径「视频编辑 四项」 | 高清重塑 ｜ 片段精修 ｜ 逐帧控制 ｜ 动态补帧 | — | 【视频实】t≈76s 烧录字幕（具体 UI 未确认） | 无对应 |

### 2.4 数字人（两条独立产线）

| 产线 | 模型（原名 + req_key） | 档位 | 参数 | 证据 | 我方对应或缺失 |
|---|---|---|---|---|---|
| **A. 对口型 / 唇形同步** | 基础模式 `dreamina_lib_sync_base`（mode: standard，「仅仅修改人物口型。适合演讲、对白」，max_audio_duration 30）；大师模式 `dreamina_lib_sync_image_master_1.5`（OmniHuman 1.5，hq，「电影级的表演效果」，VIP SKU）；快速模式 `dreamina_lib_sync_image_quick_1.5`（hq_480，「更低成本，快速生成」） | 720P/1080P；界面时长显示 4–15s；音频输入 1–30s | `audio_option: [audio_silence_detect]`（**自动静音检测**）；`face_detection_scene: multiple_face_detection`（**多人脸检测**）；SKU `lip_sync_avatar_omni_15_master_vip` / `_quick`（基础档 `lip_sync_avatar_std`，本次 mod-04 快照原文） | 【接口实】（teardown §2.3；本次快照只抓到基础模式 1 行，模块下拉未展开——「大师/快速」两行以 teardown 当日抓取为准） | **完全没有**。电商口播带货（T5 模板）的直接前置 |
| **B. 动作模仿 / 数字人驱动** | 大师 `dreamina_imitator_m15_master`（DreamActor M1.5，「效果最佳，画质超清」）；生动 `dreamina_imitator_m20`（M2.0，默认，「不限画幅，动效更真」）；快速 `dreamina_imitator_m20_quick`（M2.0，「更快生成，成本更低」） | 720P/1080P，4–15s | 存在灰度/邀请制功能位 `dreamina_actor_m1: {status:2, is_invite:false}`；SKU `basic_video_operation_video_template15_pro / _template15` | 【接口实】（teardown §2.3） | 无。B 站带货教程（BV1odbo6AEri）里「动作参考视频→模特跟跳」的产品化替代方案 |

**C. 主体资产**：`dreamina_subject` 接口族 `create / update / delete / get / **generate_voice**（给主体生成音色）`【teardown §5.1 bundle 反查，界面未确认】。侧边栏独立「主体」一级入口（人物/角色一致性资产）。
**D. 页面证据**：首页「精选」分类 tab 已出现「**数字人**」（【视频实】截图 OCR；而 2026-09-10 抓取的 explore 分类接口 6 类里还没有该分类 → 分类在快速迭代，抓包时点早于该 tab 上线或 UI/接口不同步，**两者不一致，未确认**）。

### 2.5 音频（TTS / 音乐 / 混音）——本次逐项复核原文

| 功能 | 模型 / req_key | 参数 | 计费 | 证据 | 我方对应或缺失 |
|---|---|---|---|---|---|
| **TTS 配音** | Seed TTS（`tts_model_v3`，「选择音色，输入台词生成语音」） | options：`audio_generate_mode: [tts]`、`voice_option: [speed, emotion]`（**语速 + 情绪两个维度**） | `billing_mode: per_100_chars`（**按百字计费**），SKU `audio_tts_generate` | 【接口实】 | **我方 TTS 是 mock**（`ttsBridge.mjs` 返回占位音频、不调上游、不收费，master-plan §2.3 假能力清单第 1 条）——这是音频生态的第一断点 |
| **音乐生成** | SeedMusic 1.0 Preview（`seed_music_1.0`，「细腻风格控制与多语种演唱，人声表现更自然」） | 时长滑杆 **30000–360000ms**（30–360s，默认 120s，step 1s）；15 套歌词/风格背景模板（`song_bg_prompt_v1..v15` 占位符 key） | SKU `dreamina_audio_seed_music_10_1` | 【接口实】 | 无。我方路线图 P2-06 音频连续性是**元数据**（voice anchor / music 轨 / beat 标记），明确「不是 TTS、不是音乐生成」 |
| 音视频混合 | `mix_audio_video` / `mix_audio_videos` 接口族 | — | — | 【接口实】bundle 反查（teardown §2.4），UI 未确认 | 我方导出 manifest 有 cue 字段但无混音路由 |
| 语音识别 | `speech/asr_token`、`speech/asr_hotwords` | — | — | 【接口实】bundle 反查 | 无 |

**字幕**：即梦侧**没有任何直接证据**表明画布/作品有「字幕烧录」功能（见 §6）→ 【未确认】；我方 P1-05 时间线已有 subtitle track（本地实现），这一点上我方不落后。

### 2.6 图像侧（视频生态的上游，简表）

9 档图片模型 Seedream 5.0 Pro → 3.0（`high_aes_general_v50p_large` … 3.0），分辨率 1.5K/2K/4K，单次 1–8 张，参考图上限仅 5.0 Pro 显式给到 10 张（byte_edit）；后编辑面板（重绘/消除/指令编辑）是独立 SKU（`image_inpainting_*` / `image_blend_*`）【teardown §2.1 接口实】。
**与视频生态的关系**：首帧图 / 尾帧图 / 参考图 90% 来自图片生成，所以「图→视频」链路里图片模型档位决定视频成本下限。我方对应：生态套图流水线（8 阶段 orchestrator）+ 画布生图节点，能力面不落后。

### 2.7 技能广场（「智能体层」，即梦原创度最高的一块）

| 维度 | 值 | 证据 |
|---|---|---|
| 规模 | **186 个不重复技能（本次 all-skills.json 实测 186 条）× 12 个分类**（热门推荐/影视短片/电商/商业广告/通用创作/平面设计/社媒营销/娱乐/动漫游戏/大师风格复刻/专业运镜/发现；每分类独立分页，总量 >186） | 【接口实】 |
| 技能形态 | = 一份完整 SKILL.md（`instruction` 最长 19,247 字符 + `markdown_url` 原文地址）+ 封面 + 标签 | 【接口实】 |
| 市场 API 全家桶 | `skill/market/{list,search}`、`categories`、`create/update/publish/delete/like`、`batch_get` → **用户可写技能并发布**；字段含 `usage_count / like_count / added_count / owner_uid / is_private / original_skill_id（二创溯源）` | 【接口实】 |
| 官方 7 技能（agent config skill_data，本次原文复核） | 视频反解 / 创作分镜 / 全流程广告片导演 / 影视故事短片 / 电商套图 / 海报设计 / Logo设计 | 【接口实】 |
| 内部工具词汇表（从技能 instruction 里抽出） | 图生图工具、文生图工具、**首帧生视频工具**、状态查询工具、`multi_modal2video`（全能参考分段生成）、`video_editor`（最终拼接）——**约 6 个固定工具，技能是「提示词 + 状态机 + 质检重试」驱动的 Agent 编排，不是图驱动** | 【teardown §4.4】 |
| 使用量 Top | 叙事短片导演分镜 13,264 用 / 26,940 添加；爆款电商短视频题材创意 6,613 用（电商带货线技能密集：TikTok网红带货 / 素人穿搭配方 / 穿搭上身试穿视频生成 / 商品沉浸式旋转广告 / 工业产品商业宣传视频） | 【接口实】 |
| 输入框里的斜杠技能 | 首页 6 胶囊（/电影级长镜头运镜 New、/创作分镜 New、/名导风格大师 New、/叙事短片导演分镜 Hot、/微表情导演 Hot、/电影广告全能导演）+「更多技能」 | 【页面实】+ 截图 OCR |

**画布内技能胶囊**（`web_canvas_capsule`，本次复核）：/视频反解、/创作分镜、/全流程广告片导演、/剧本开发、/剧情短片（5 个，带 new tag 与官方技能 id `web_agent_skill_*`）。
**对话页胶囊**（`web_chat_capsule`，teardown §3.1）：11 个，含「系列套图生成 / 世界观美术设定 / 角色设计 / **电商套图**」。
→ 技能是**按场景（画布 vs 对话）分发不同胶囊组**的，场景即货架。

### 2.8 无限画布（视频路径的「工作台」）

| 维度 | 值 | 证据 |
|---|---|---|
| 真路由 | `/ai-tool/ai-canvas/:projectId`；`?scene=readonly` 只读预览渲染在作品详情页 drawer 的 iframe 里；另有独立路由 `/ai-tool/assets-canvas`（资产画布） | 【页面实】 |
| 接口族 | `infinite_canvas/{list_project, conversation, edit, resume, stop_stream}` → 画布 = **基于会话/流式 Agent 的图**，有断点续跑与流中断 | 【teardown §3.1 bundle 反查】 |
| 元素五类 | **文字 ｜ 图片 ｜ 视频 ｜ 音频 ｜ 时间线**（官方宣传字） | 【视频实】t≈86s |
| 连线语义 | 素材卡片之间**曲线相连**（引用/派生关系；端口语义未展示）；卡片带「…Prompt」文本 | 【视频实】t≈70–88s |
| 框选链式改写 | 虚线选框 + 蓝色编号圆标 + 一句指令（「把雷云变成章鱼→食人花→骷髅乌鸦」A→B→C→D 派生链） | 【视频实】t≈78–86s |
| 多轨时间线 | 视频轨（缩略图串）+ **音频波形轨**，时间刻度 00:25/00:30/00:35，「全屏编辑」按钮；官方字「多轨素材自由编排 一键即可导出成片」 | 【视频实】t≈90–96s |
| 节点类型/连线交互/快捷键/导出参数 | **全部未确认**（登录墙） | 【teardown §3.2】 |

### 2.9 Agent / 对话 / 多会话

- 双入口：首页 **[生成] [画布]** 并排 + 输入框（「输入想法、剧本或上传参考，支持 / 使用技能，添加主体，和 Agent 一起创作」）+ **[Agent模式] [自动] [技能] [@]** 开关组【页面实】。
- 多会话：左侧边栏 对话/画布 两组历史；「Agent 生成进度 实时可见」「编辑画布中」过程态【视频实】t≈52–54s。
- agent config 顶层字段 `show_canvas_agent_input: true`（画布内也暴露 agent 输入框）【接口实，本次复核】。
- 作品详情署名 **Dreamina**（海外版品牌）→ 国内外双品牌分发【teardown §3.1】。

### 2.10 作品社区 / 复用 / 素材库 / 开放 API

| 功能 | 形态 | 证据 | 我方对应或缺失 |
|---|---|---|---|
| 作品详情公开 | 游客可访问 `/ai-tool/work-detail/:id`，时长/分辨率角标（如 00:50 / 1080P）+「内容由 AI 生成」水印文案 | 【页面实】 | 我方作品在画布内 Tab，无公开作品页 |
| 「查看创作过程」 | 作品卡按钮 → 只读画布抽屉 | 【页面实】 | 我方路线图 P2-05 有 process discovery + clone/remix（本地实现） |
| **一键「复制项目」** | 只读抽屉主按钮 = 把别人的画布工程复制成自己的（复用最强形态） | 【页面实】按钮存在，点击流程未确认 | 我方 P2-04 精确重放（restore 源素材/提示词/参数/模型快照）能力等价，未开放 |
| 素材库 | 分类 tab：资产/主体/图片/视频/音频/文档（两种读法未确认）；官方字「多源导入 ｜ 跨项目复用 ｜ 智能搜索 ｜ 精准定位」；API：`get_asset_list` / `workspace CRUD` / `get_history_*` / `prompt_enhancement`（**提示词是持久化可复用资产**） | 【视频实】+【teardown §5 bundle】 | 我方素材库 = project_assets + 血缘表 + 检索（能力对等）；缺「跨项目复用」的一等入口与「提示词资产化」 |
| 开放 API | `/ai-tool/jimeng-api`（console + usage 两个路由） | 【页面实】路由存在，定价/限流未确认 | 无（短期不做） |

### 2.11 计费与会员

- 单位 = **积分**（全站无「火苗」）；价格话术 = **元/秒**：banner 原文「⏰触底价，官方满血Seedance2.5 720P 低至0.4元/秒 ｜ Seedance2.0 Fast VIP 720P 低至0.2元/秒｜限时直降：会员5折」【页面实】。
- **四维分档 SKU（模型 × 分辨率 × 时长 × 有无输入视频）**：`seedance_25_{480,720,1080}p_output`、`seedance_25_long_video_*`（超长单独计价）、`seedance_25_*_no_input_video_output`（纯文生更便宜）、`lip_sync_avatar_*`、`basic_video_operation_video_template15*`（动作模仿）、音频按百字、图片按分辨率 4 档 + 图生图/重绘独立 SKU【teardown §6.2 接口实】。
- 会员专属通道直接写进模型文案（「会员专属通道」×2）；会员定价页/每日免费积分/权益矩阵 → 【未确认】（teardown §6.3，二手参考：2026-04 报道免费 60–100 积分/天、一个月三涨后 15s ≈ 120 积分，与本次「0.4 元/秒触底价」对照 = 价格战进行中）。

### 2.12 生态外延（页面运营位，新功能信号）

| 项 | 原文 | 证据 | 备注 |
|---|---|---|---|
| 即梦片场 | 「即梦片场上线——寻找AI时代最敢想象的好故事」 | 【页面实】运营位 + 截图 | 影视/短剧创作运营平台，细节未确认 |
| Blender & Maya 插件 | 「让白模即刻出片」 | 【页面实】截图运营位 | 3D 白模 → 视频（对应 BV 报告提到的「一键 3D 白模转视频」）；对我方低相关 |
| 「Seedance 2.5 视频模型 支持超长生成与极致穿控」 | 运营位文案 | 【页面实】截图 OCR（「穿控/穿模」两读，**未确认**） | 与「超长生成」一致 |

---

## 3. 即梦的视频路径：从「想生成一个视频」到「出成片」

### 3.1 路径还原（全部有证据）

```
入口（三选一）                          生成（模型层）                        工作台（画布层）                    出口（分发层）
① 对话/Agent：一句话+@素材+/技能  ┐
② 表单：模型×输入模式×参数条        ├→ Seedance 家族出「片段」(4–30s,        无限画布：                          作品详情(公开)
③ 技能：/全流程广告片导演 等       ┘    超长 30–180s)：                        · 生成物直接落画布
  （输入模式 6 选 1：                  · 首帧/尾帧图来自图片生成              · 素材卡片连线 + @引用
  全能参考/文/首帧/尾帧/               · 数字人线(对口型/动作模仿)出          · 框选编号链式改写(局部)
  超长/视频编辑)                        「会说/会动的人」                     · 时间线元素：视频轨+音频
   参考素材从：素材库/主体库/上传/     · 音频线(TTS台词/BGM)出「声音」        波形轨 → 多轨编排
   上一轮生成物（循环复用）            ─────────────────────────────→        · 一键导出成片
                                                                        ─────────────────────────────→
                                                                            作品页「查看创作过程」(只读画布)
                                                                            +「复制项目」(一键复用他人工程)
```

### 3.2 关键判断（逐条带证据）

1. **画布 = 视频工作台**。官方定位「全新画布 一站式完成」「无限画布 一站管理 文字/图片/视频/音频/时间线」「多轨素材自由编排 一键即可导出成片」【视频实】；画布接口族 `infinite_canvas/*` 带 `resume/stop_stream`【接口实】。**不存在独立的「视频编辑器」路由**——完整路由表 10 条（home/explore/asset/assets-canvas/action/generate/login/search-result/work-detail/jimeng-api）里没有 editor【页面实】。
2. **时间线是画布内置元素，不是独立应用**：多轨时间轴（视频轨+音频波形轨）出现在画布画面里（t≈94–96s）【视频实】。其重量级 = 「轻量多轨编排 + 一键导出」，**不是**剪映/CapCut 级 NLE（无特效/合成/字幕样式编辑的证据）【未确认：重编辑能力是否溢出到剪映，即梦站点证据里没有】。「不存在独立视频编辑器」的硬依据：teardown §1.3 由 162 个 JS chunk 反查出的完整路由表（home / explore / asset / assets-canvas / action / generate / login / search-result / work-detail/:id / jimeng-api(+console/usage) / ai-canvas/:projectId，共 12 条）里没有任何 editor 型路由【页面实】。
3. **「生成→成片」不是必经画布**：纯表单生成 5–30s 单镜头即完成品；画布+时间线服务的是**多素材、多镜头、音视频混合的成片**。「工作台/时间线是否必需」的答案：对单镜头不必需；对成片（视频轨 ≥2 段或需配乐/配音）是即梦的**唯一出口**——即梦没有第二条成片路径。
4. **复用是路径的一部分而非事后**：生成物可随时回进参考（unified_edit 50 素材）、作品页可「查看创作过程 + 复制项目」——「别人怎么做成片」本身就是货架（技能广场的使用量计数长在作品卡上）【接口实】。

### 3.3 即梦路径 vs 我方画布路径（对照表）

| 环节 | 即梦 | 我方（代码/路线图证据） | 判定 |
|---|---|---|---|
| 生成入口 | 对话/Agent + 表单 + 斜杠技能 三入口 | EcCanvas 节点 composer + VideoStudio 三界面 + 电商工作台（6 页面共一口 $/api/generate-ecommerce`） | 形态可互替；**我方缺对话式轻入口**（BV 报告 §6.1 P1 项） |
| 视频输入模式 | 6 种（含全能参考/自然语言编辑） | 3 套输入逻辑（智能成片/首尾帧/爆款重构，RTK 2026-08-14）+ 分镜 shot 绑定素材 | **缺 2 个维度**（多模态参考、对已有视频的 NL 编辑） |
| 多参考 | 50（模态分档） | 参考上限 9（画布）；视频参考走「爆款重构」逻辑 | 差距 |
| 续写/超长 | 2.5 独占（extend / long_video 30–180s） | P3-02 续写本地实现（边界帧+时长+成本帽），未开放 | 能力等价、状态落后（dark） |
| 数字人 | 对口型×3 档 + 动作模仿×3 档（独立产线、独立 SKU） | 无 | **差距（口播带货 T5 模板的前置）** |
| 音频 | TTS 真上游（语速+情绪/百字计费）+ 音乐 30–360s + 混音接口 | TTS **mock**（占位音频、不收费）；音频连续性=元数据 | **结构性差距（音频是视频生态的地基，我们这层是假的）** |
| 字幕 | 【未确认】（无直接证据） | P1-05 时间线 subtitle track（本地实现） | 我方不落后（若即梦也有则平手） |
| 时间线/成片 | 画布内置多轨 + 一键导出 | P1-05 basic timeline（重排/裁剪/静音/音轨/字幕/预览代理/导出 manifest）本地实现，**renderer 故意未接**（roadmap 台账：「renderer intentionally absent」） | 本地等价、差一个渲染器与开放状态 |
| 技能 | 186 市场 + 用户发布 + 三计数 + 二创溯源 | 技能系统（内置 5 风格包/2 视频模板/4 画布配方 + 用户技能表），**无市场层、无使用量数据** | **运营层差距（最值得抄）** |
| 主体/素材 | 主体库（含 generate_voice）+ 跨项目复用 + 提示词资产化 | 商品档案 + project_assets + 血缘 + 检索 | 电商域我方更硬（商品事实/合规/尺寸锁是即梦没有的） |
| 复用/分发 | 只读画布 + 一键复制项目 + 公开作品页 | P2-04 精确重放 + P2-05 clone/remix（本地实现，dark） | 能力等价、状态落后 |
| 计费 | 四维 SKU + 元/秒 + 会员通道 | quote→hold→settle + 幂等 + 失败自动 release（机制更硬）；SKU 只有 fast/standard × short/long 档 | **机制我方领先，分档维度差 3 维** |

**总判断**：即梦强在「模型矩阵 + 音频数字人产线 + 技能市场 + 复制项目」；我方强在「计费正确性 + 商品事实 + 任务可靠性（P0 底座已 live）+ 分镜/成本护栏（P1 本地）」。要「接近它」= 把它的**运营层 + 参数面 + 音频/数字人产线**做进来，**不碰**它的模型资产与影视内容资产。

---

## 4. 我方现状锚点（做规划前的事实核对）

| 锚点 | 状态 | 证据 |
|---|---|---|
| EcCanvas 节点图（数据结构） | 已是节点+端口+类型校验的图；边不传执行（P0 已做 `collectNodeInputsFromEdges`，本地完成**未部署**） | capabilities §9 + master-plan §6.1（commit 0f7fc4a0） |
| P0.5 分组运行整链 + stale 传播 | 本地实现（`canvasGraphRunController.js` + markStaleDownstream），未部署 | master-plan §6.1 |
| P1 后端图宿主（graph/run） | **未开工**（等 P0.5 部署确认） | master-plan §6.2 |
| VideoStudio 三界面 | 节点画布（默认）/ 旧瀑布流 / 导演台；asset/shot/candidate 三类节点、端口纯视觉、后端与画布不通 | capabilities §3 |
| 视频平台路线图 | **P0 底座 live（5d933c2，付费生成未跑）**；P1 分镜/时间线/成本护栏、P2 技能重放/项目记忆/音频连续性、P3 逐秒重拍/续写/追踪替换/智能路由 = **全部本地实现、feature-dark（workbenchEnabled=false）**，P2/P3 开放门 = P1 生产证据 + provider canary | roadmap §5–§8、§14 台账（2026-08-16/17 状态） |
| 「5 个工作流模板」 | 对应 master-plan §6.3 规划的 T1–T5（白底主图/模特试穿/场景详情/换装短视频/口播带货）= **规划态，未实施**；代码里现有资产 = 100 套公开提示词模板 + 2 个视频 SkillRun 模板（product-ad-v1 / reference-video-reconstruction-v1）+ 4 个画布配方 | master-plan §6.3 + capabilities §5 + roadmap §11 |
| 视频计费 | 已上架 4 SKU（fast/standard × short/long，27/46/57 分）+ 方案分析 1 分；1080p 与 MiniMax 2K 未上架；导出免费 | capabilities §3.8 / §6.2 |
| TTS | **mock**（占位音频、不收费、路由注释自认） | capabilities §2.2 + master-plan §2.3 |

---

## 5. 差距清单与优先级（要「接近即梦」该做什么）

> 排序原则：① 先补**假能力/断点**（TTS 等，否则上面全是空中楼阁——master-plan §2.3 铁律）；② 再开**已有但 dark** 的能力（P1 工作台、复制项目）；③ 然后做**运营层**（技能市场、SKU 分档、主体资产化）；④ 新产线（数字人/全能参考）走 provider canary 门，逐个开；⑤ 可选（社区/开放 API）与不做（模型/影视/NLE）分开列。
> 每条：差距 / 即梦证据 / 我方落点（master-plan 章节 + 路线图章节）/ 成本形态。

### P0——不做就没有竞争力（用户拿「即梦能做」问我们的每一项，答案都在这里）

| # | 差距 | 即梦证据 | 我方落点 | 说明 |
|---|---|---|---|---|
| **P0-1 TTS 真上游 + 计费**（配音是「口播带货/数字人/成片」三条线的公共地基） | Seed TTS：语速+情绪、按百字计费、真 SKU `audio_tts_generate` 【接口实】 | master-plan §2.3 假能力清理第 1 条 + §4.2（建议 `ec_tts_voice` 0.5 积分/次 ≤500 字，上游价目 TTS_PRICING 实表已备）；capabilities §2.2（`ttsBridge.mjs` mock） | 接 1 个真上游（火山/MiniMax 成本最低档）+ 挂 SKU + UI 显示真实消耗；在此之前所有音频节点 UI 标「内测」 | 一条链路的活，但**阻塞 T5 口播带货、P1-7 成片、P1-6 对口型三条线** |
| **P0-2 视频节点参数面一次留够**（6 输入模式 + 模态分档参考上限 + 服务端 schema 下发） | Seedance 2.5 options 原文：`input_media_type` 6 枚举、unified_edit 模态分档上限表、edit 4–30s/2000 字、long_video 30–180s、分辨率 480/720/1080、比例 6 种、fps 固定 24 【接口实，本次复核】 | master-plan §3.5.1（`nodeModels` 服务端 schema 下发，「加模型=加一行数据，前端零改动」）+ §3.6 参数面表（「一次留够，别以后再改结构」） | 参数 schema 里预留 6 种输入模式字段（未接的模式置灰）+ 参考槽按模态分上限（图 30/视频 10/音频 10 可配置，默认收紧到成本可接受档） | 结构活：只做一次，后面接模型都是数据 |
| **P0-3 P1 视频工作台 暗开 → owner 灰度 + VideoStudio 并入画布第一步** | 即梦把「分镜→逐镜生成→时间线→成片」做成了画布内建；我方 P1-01~07 全部本地实现（资产库/分镜/三模板/双审批/时间线/单镜重试/成本护栏） | roadmap §6/§14（「P1 storyboard workbench: Implemented and deployed dark; workbenchEnabled=false」）；master-plan §543「**不新增第三套画布**」+ §563（「分两步：先并列（新节点可用、旧界面仍在），稳态后再下线旧界面；老项目数据只读兼容」） | ① 按 roadmap 退出门给 owner 白名单开 P1 工作台（10 个非计费内部项目）；② 同期做 VideoStudio → EcCanvas「视频视图」映射：asset 节点→image/video/audio 节点、shot→结构化卡片节点（字段挂进现有 text 类 + shot 元数据）、candidate→多输出/组（复用 layer-group）；三类边（continuation/绑定/首尾帧）→ 三种 relation（derived/reference/input，master-plan §3.3 已定义）；时间线 UI 落画布底部「成片条」（数据模型按 master-plan §3.5.9 预留 `graph.timeline = {tracks:[{kind, items:[{nodeId,start,dur}]}]}`） | 这是「把即梦生态做进来」的**主通道**：所有视频能力挂进画布而非平行界面 |
| **P0-4 技能市场层**（把已有技能系统从「配置」升级成「货架」） | 186 技能/12 分类/用户发布/usage·like·added 三公开计数/作者署名/original_skill_id 二创溯源/按场景发胶囊（画布 5 vs 对话 11）【接口实】 | master-plan §3.5.6（「我们已有技能系统，只差市场层」4 条动作） | 技能表加 3 计数 + 作者署名 + derived_from 溯源字段；画布/对话入口加斜杠菜单（/技能）；官方内置技能标「官方」同场展示；**使用量用真实数据，不用占位**（对照 master-plan §2.3：我方 publicTemplates 注释自述 82 套占位使用量——这是诚信红线，一并处理） | 零模型成本；电商域技能（白底/场景/详情/带货）先铺 |
| **P0-5 商品主体资产化 + 跨项目复用**（对标即梦「主体」库） | 侧边栏「主体」一级入口 + `dreamina_subject` 接口族（含 generate_voice）+ 素材「跨项目复用」官方字 【接口实+视频实】 | master-plan §3.5.10（「把商品档案提升为一级主体资产：可命名、可检索、可跨项目复用」）；capabilities §4.6（project_assets + 血缘已有，缺跨项目入口） | 商品档案 = 一级「主体」资产（模特+服装+场景+音色可绑定），画布/分镜 shot 直接引用主体 id；音色挂 TTS（P0-1 做完后主体自带声音，=即梦 generate_voice 的电商版） | 与「商品事实」护城河同向 |
| **P0-6 视频 SKU 四维分档**（模型 × 分辨率 × 时长 × 有无输入视频） | 即梦 benefit_type 清单原文（`seedance_25_720p_output` / `_long_video_*` / `_no_input_video_output` / VIP 专属 / 对口型 / 动作模仿 独立 SKU）【teardown §6.2 接口实】 | master-plan §4.2（「我们现在的 SKU 只有档位，要补后三维」）+ capabilities §3.8（4 个已上架 SKU） | catalog 扩 3 维 + quote/hold/settle 机制不动（已具备）；「元/秒」用户话术可上（保留积分制），先报价后执行原则照旧 | 机制现成，纯数据活 |

### P1——竞争力放大器（P0 完成后按此序）

| # | 差距 | 即梦证据 | 我方落点 | 说明 |
|---|---|---|---|---|
| **P1-6 对口型/数字人节点**（口播带货 T5 模板直接可用） | 对口型 3 档（基础/大师/快速，OmniHuman 1.5，多人脸+静音检测，音频 1–30s）+ 动作模仿 3 档（DreamActor M1.5/M2.0）【teardown §2.3 接口实】 | master-plan §4.2（`ec_lip_sync` 先按 6 积分挂、等上游报价校准）+ §8 决策点 4（顺序：TTS → 首尾帧 → 对口型 → 拼接成片） | 新节点 kind（对口型/动作模仿**两个独立 kind**，master-plan §3.2 明令「别塞进视频里」）；上游用火山/三方报价 canary | 电商口播 = 我们区别于通用工具的差异化场景，优先级高于「电影感」 |
| **P1-7 成片导出 renderer 接通**（时间线→真实 mp4） | 即梦「多轨素材自由编排 一键即可导出成片」【视频实】 | roadmap §14（P1 导出 manifest 边界已完成，「durable renderer worker and proxy/download recovery before treating export as delivered」）；capabilities §3.6（ffmpeg 渲染代码写死 10s、worker 未接线） | 接 durable renderer worker（roadmap 原话的退出条件）：多轨时间线 → 拼接/字幕烧录/音轨混入 → 720p/1080p 导出；**拼接本地 ffmpeg 免费 = 引流**（master-plan §4.2 纪律） | P1-5 时间线能力的真正闭环 |
| **P1-8 「复制项目」公开化**（作品→可复用工程） | 只读画布 + 主按钮「复制项目」【页面实】 | roadmap §8 VID-P2-05（gallery process discovery：final output + creation-process preview + read-only project view + clone/remix，本地实现）+ master-plan §7.1 ③ | P2-05 按门开放：我方成品页挂「查看创作过程 + 复制成我的画布」（注意：复制的是工程骨架，**私人素材不过档**——roadmap §2.1 已写死） | 与 P0-4 技能市场配套 = 复用飞轮 |
| **P1-9 Agent 过程可见 + 统一参数条** | 「Agent 生成进度 实时可见」「编辑画布中」【视频实】；首屏 3 决策点（自动/图片/视频 + 比例 + 其他设置 + 模型 chip）【teardown §7.1②】 | BV 报告 §6.1 P1 项 + master-plan §3.5.8（composer 两层：默认「模型+比例+预计积分」，高级折叠） | 我方已有任务恢复/幂等（比即梦能证明的更硬，teardown §7.3），只做**显性化**：节点卡片进度/预计/实际/已退三个数（master-plan §3.5.5）+ composer 折叠 | 纯前端，低成本高感知 |

### P2——可选（视用户反馈与上游报价）

| # | 项 | 即梦证据 | 判断 |
|---|---|---|---|
| P2-10 全能参考/多模态参考（unified_edit 对标） | 50 参考（模态分档）【接口实】 | 依赖上游：Seedance 2.5 是否进我方 Provider 层 + roadmap §8 能力门（「Provider claims such as 50 references are shown only after Shubao verifies」）。**P0-2 已把参数面留好，接模型只是数据** | 等 canary，不赶 |
| P2-11 超长视频 30–180s（long_video） | 单独 SKU【接口实】 | 同上，依赖 2.5；电商带货 4–15s 为主，超长是影视/品牌片场景，非电商刚需 | 等 2.5 报价 |
| P2-12 音乐生成节点（SeedMusic 对标） | 30–360s、15 套模板【接口实】 | 电商 BGM 需求真实但优先级低于 TTS；先让用户**上传 BGM 进时间线**（P1-7 已含音轨放置），生成式音乐后置 | 可选 |
| P2-13 公开作品社区（对标 explore） | 6–7 分类 + 活动 + 关注【页面实】 | 我方作品在画布 Tab；做「公开案例 + 查看创作过程 + 复制」即 P1-8，**完整社区（关注/评论/活动）不做** | 半做 |
| P2-14 开放 API 平台（jimeng-api 对标） | 路由存在【页面实】 | 远期；我方 roadmap P3-07 已有 scoped REST API 本地实现（协作/API），按能力门后置 | 远期 |
| P2-15 第三方模型超市（MiniMax/HappyHorse/Wan 同表单） | 10 模型含 3 第三方【teardown §2.2】 | 我方 Provider 四层底座天然支持「加模型=加数据」（§3.5.1 做完后）；HappyHorse/Wan 有阿里系报价优势可试 | 顺手 |

### 不做（短期）

1. **自研/微调视频模型与「电影教科书级」技能资产**——字节 Seedance 成本结构 + 影视版权素材资产，第三方无法对齐（teardown §7.2）。
2. **剪映级重型 NLE**（特效/合成/字幕样式/绿幕）——即梦自己也没做（其时间线=轻量多轨编排），重型编辑留给专业工具；我方 ffmpeg 拼接+字幕烧录（P1-7）是正确量级。
3. **通用影视/广告创作者场景扩张**——不背商品事实约束的泛创作会稀释「商品事实校验」护城河（BV 报告 §6.2/§6.4）；影视感需求用「技能/模板」满足（运镜技能可抄词不抄模）。
4. **画布内节点级私有工作流编辑器**——即梦也没有（BV 报告 §4.6 弱证据）；我方 P2 模板 + 分组运行是正确量级。

---

## 6. 未确认 / 存疑清单（不编造）

| # | 项 | 状态 |
|---|---|---|
| 1 | 即梦**字幕烧录**功能 | 全无直接证据（画布/作品/模型配置里均未见「字幕」字样）；我方 P1 时间线有 subtitle track → 若即梦后续上线即为差距，当前**不能宣称我方领先** |
| 2 | 画布节点类型/连线交互/快捷键/导出参数（分辨率/水印/格式面板） | 登录墙，teardown §8 全列未确认 |
| 3 | 「探索」分类里「数字人」tab | 截图 OCR 有、9-10 抓包分类接口无 → 时点差，未确认 |
| 4 | 对口型「大师/快速」两行 | 本次 mod-04 快照只抓到「基础模式」1 行；以 teardown 当日抓取的 3 行为准（同一接口不同模块状态） |
| 5 | 素材库页面结构 / 批量操作 / 分享权限 | 【teardown §5.3】 |
| 6 | 会员定价页 / 每日免费积分 / 权益矩阵 | 【teardown §6.3】（二手报道 2026-04，可能过时） |
| 7 | 「1X」参数含义 / 占位符「正文 vs 主体」/ 技能原字（叙事/故事/短片分镜） | 【BV 报告 §7 未确认清单】 |
| 8 | 截图 banner「Seedance **2.2** Fast VIP」OCR 与 teardown「**2.0** Fast VIP」不一致 | 判定为 OCR 误读（2.0 有接口原文 `dreamina_seedance_40_vision` 背书），存疑记录 |
| 9 | 「极致穿控/穿模」（Seedance 2.5 运营位文案） | 截图 OCR 两读，未确认 |
| 10 | 即梦片场 / Blender&Maya 插件细节 | 运营位文案级证据，产品细节未确认 |
| 11 | 重编辑是否溢出到剪映（CapCut） | 即梦站点证据内无；仅二手常识，不采信 |
| 12 | 全部「我方未部署」项（P0.5/P1/P2/P3） | 本地实现 ≠ 线上能力，引用时须带「feature-dark」限定 |

---

## 7. 附：落地顺序建议（与既有计划对齐，不新开口子）

1. **先清假能力**（master-plan §2.3）：TTS 接真上游+计费（P0-1）、chainService 前两步标灰或换真 LLM、悬空路由清理。
2. **P0.5 部署 + P1 后端图宿主**（master-plan §6.1/§6.2，3–5 天，等用户确认）：把「分组运行整链 + 断点续跑 + 计费预扣」上线，是后面一切的执行底座。
3. **P1 视频工作台暗开 → owner 灰度**（roadmap 退出门：10 个非计费内部项目）+ **VideoStudio → 画布视频视图映射**（§5 P0-3）。
4. **运营层三件套**：技能市场层（P0-4）→ 复制项目/查看创作过程（P1-8）→ SKU 四维 + 元/秒话术（P0-6）。
5. **新产线按 canary 逐个开**：TTS（P0-1）→ 对口型（P1-6）→ 拼接成片 renderer（P1-7）→ 全能参考/超长（P2-10/11，等 Seedance 2.5 进 Provider）。
6. **每一步遵守既有不变式**（master-plan §7.1）：不确认不扣费 / 老文档只读可用 / 价格唯一真源在后端 catalog。

> 一句话总结：**即梦的视频生态 = 模型矩阵 × 音频数字人产线 × 画布时间线 × 技能市场 × 复制项目。我们「接近它」的路线 = 真音频（TTS）打底 → 参数面与 SKU 分档一次留够 → P1 工作台暗开并入画布（不新增第三套画布）→ 技能市场层 + 主体资产化 + 复制项目 → 数字人/全能参考按 provider canary 逐个放行；模型层与影视内容层不做。**