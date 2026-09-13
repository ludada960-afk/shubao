# 导演台 × 画布生态闭环审计（只读，2026-08-26）
> 方法：通读 2026-08-25 视频对标蓝图与 RTK.md；grep 盘点 src/pages/VideoStudio、src/pages/EcCanvas 及 server/video* 服务；PowerShell 直抓 klingai.com / jimeng.jianying.com / app.pixverse.ai 复核能力词频（web_search 余额不足，沿用蓝图同源直抓法）。未修改任何代码。

## A 业界导演台标配功能矩阵
本轮直抓词频佐证：klingai.com 首页 首尾帧3/分镜5/角色一致性1/对口型3/lip sync5/Motion Brush3/音效2/canvas9；即梦 智能画布8/canvas9/运镜2；PixVerse template541/character65/extend51/数字人5。

| 能力 | 可灵 | 即梦 | PixVerse | CreativeOS | 我们 |
|---|---|---|---|---|---|
| 运镜控制 | ✔ 运镜/动作控制 | ✔ | ✔ 动作节点 | ✔ 决策卡显式选项 | ✔ 7 种运镜 chips＋镜头级 cameraMove |
| 首尾帧锁 | ✔ | ✔ | ✔ | ✔ | ✔ first/last_frame_ref 服务端校验＋UI 绑定 |
| 分镜管理 | 弱（生成期） | ✔ 脚本→逐镜 | ✔ 画布节点规划 | ✔ 分镜决策卡 | ✔ shot 卡/意图/每镜积分/每秒指令表 |
| 多候选对比 | 列表多结果 | ✔ | ✔ 规划调整重跑 | ✔ | ✔ 候选就地并排＋回填＋provenance 标签 |
| 角色一致性 | ✔ 角色参考/数字人 | 弱 | ✔ character/一致性 | ✔ 定妆照＋元数据卡 | ✔ lockAt 四组一致性锁（领先多数竞品） |
| 批量生成/重跑 | 部分（续写延长） | ✔ 一句话批量 | ✔ | ✔ | ✔ createVideoShotBatch＋区间重拍/延长/追踪替换(P3) |
| 音乐卡点 | 音效生成 | 归剪映 | 弱 | 弱（外部剪辑） | ◐ beats 元数据已留位，无对齐渲染 |
| 字幕/口型 | ✔ 口型同步 | ✔ 剪映 | ✔ lipsync | 弱 | ◐ 字幕轨数据齐，无烧录；口型无 |
| 画布编排 | 无 | 仅图片侧智能画布 | ✔ 节点图谱 | ✔ 对话流+工件区 | ✔ P1 画布 d1e30d1：素材/镜头/候选节点+四模式生成条 |
| 先方案后付费 | 生成期参数 | — | — | ✔ 确认才付费 | ✔ 审批门 approvedPlanHash，未批准不扣费 |

业界底线＝运镜/首尾帧/一致性/分镜-候选-时间线/批量/字幕配音；加分项＝卡点、对口型、模板社区、Marketing Hub 式商品图→成片引导。

## B 我们缺口清单
已有且达标：运镜 chips、首尾帧锁、lockAt 一致性锁、分镜卡+每镜成本估算、候选并排对比+时间线原子装配（键控事务）、批量重跑+区间重拍/延长/追踪替换、音轨+字幕轨数据层（createVideoAudioTrack/subtitleCues/mute/volume）、审批门、TUS 上传、provider-neutral 底座、跨域 canonical 引用（videoProjectBridge＋importProjectAssetVersion，视频侧可拉取他项目素材）。
**P1 应补（导演台体验收尾，基本是表现层）：**
1. 改稿对话＋运镜快捷 chips 微调当前镜（蓝图 ChatTweaks）——完全缺失；
2. 右栏导演检查器：决策卡队列＋任务事件流按镜分组——能力散落各 band，未成检查器；
3. 时间线 trim 手柄——clip trimStartMs/EndMs 字段已备，交互手柄未见；
4. 导出落地——export manifest 含 subtitleCues/audioTracks，但无合成渲染，「导出」目前是清单不是成片。
**P2 应补：** TTS 口播（全站 grep 无任何语音合成）；音乐卡点对齐（beatMarkers 字段空置）；成片详情版本对比强化。
**可不做：** Motion Brush 类逐笔控制（运镜 chips＋首尾帧可替代）；对口型/数字人（依赖上游新能力与合规审查，先观察竞品）；专业剪辑器级特效。

## C 生态连边地图（以画布为中心）
现有连边：电商套图/万物上身 → EcCanvas（同项目资产强连通）；Gallery 作品 → remix/replay/clone；项目素材库 ProjectAssetPicker → 视频首末帧绑定；视频 ← 跨域契约（拉取式 sourceProjectAssetRef）；XHS/Plog 提示词持久化 → 灵感发现复用；EcCanvas 域内素材分析→视频方案（CanvasStudio 视频路由）。
**缺失连边（按 ROI 排序，附最小打通方案）：**
1. EcCanvas/电商产物 → 视频项目（推式）：服务端 importProjectAssetVersion 已备，仅缺源侧 UI。最小方案：EcCanvas 节点菜单＋Works 作品卡加「发往视频项目」（选目标项目、可绑某镜头首帧），零新 API。
2. TTS 音频 → 视频音轨：无 TTS 源。最小方案：provider-neutral TTS SKU（复用 hold/settle 账务底座），口播文案→音频资产→audioTrack；字幕 cue 由文案按时长初分供微调。
3. 画布音频节点：节点三类（素材/镜头/候选）无音频。最小方案：加音频卡节点（复用 asset 引用语义），框选音频＋镜头＝配乐/口播绑定。
4. 成片导出渲染：manifest → 真实合成。最小方案：ffmpeg worker 混音＋字幕烧录，或经既有 export webhooks 外部渲染回调。
5. 音乐卡点：最小方案：手动打点＋BPM 分析对齐提示，落到既有 beatMarkers 字段。
6. XHS/Plog 图文 → 带货视频：复用连边 1 的桥，把已持久化的 image_prompts/封面一键发往视频项目当首帧素材。
7. 全局素材库视图：素材挂项目、无跨项目聚合。最小方案：Works 加只读聚合列表＋「发往」入口。
不做：成片自动回流素材库（RTK 已裁定手动入库）；视频候选回贴 EcCanvas（P3 后再看）。

## D P2 范围裁定建议
原则：P2 ＝ 生态闭环 ＞ 新增导演能力；全部复用既有底座（账务 hold/settle、canonical 资产契约、export webhooks、SkillRun、审批指纹），不引入第二套基础设施。
1. 跨域投递三入口（连边 1+6）：一套桥、三个按钮，纯 UI＋既有 API，成本最低收益最大，最先做；
2. TTS SKU＋口播→音轨→字幕初稿（连边 2）：唯一需新供应商接入的项，单独过计费与合规评审；
3. 导演检查器补完（B-P1 第 1/2/3 项）：改稿对话＋事件流按镜分组＋trim 手柄，补齐「行业刚需」体感；
4. 导出渲染 MVP（连边 4）：验收锚点＝全程不离开画布完成「商品图→圈选→候选→连镜→配乐→字幕→导出」；
5. 卡点 MVP（连边 5）视排期顺延；模板社区/remix 发布与 Marketing Hub 引导流移 P3，待内容运营就绪。
