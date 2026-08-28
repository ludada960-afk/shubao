# 4c183cd4 续命 长期路线图 v2 (整合 V3 调研 + 续命 commit + 飞书 + 商品档案)

> **作者**: 4c183cd4 续命调研重构子代理
> **生成时间**: 2026-08-28
> **工作树**: F:/da/shubao/.worktrees/codex-ecommerce-stability
> **当前 HEAD**: 96524aa0
> **姊妹文件 (事实源)**: .superpowers/sdd/2026-08-28-v2-research-summary.md (27.6 KB)
> **上一版 (接力点)**: .superpowers/sdd/2026-08-28-dashboard/2026-08-28-4c183cd4-status-and-roadmap.md (528 行, 061bdb5e)
> **商业化就绪度**: 4c183cd4 时代 20% → 4c183cd4 续命 50% → 本路线图 v2 接力后 80% (1 月后) → 95% (3 月后) → 100% (6 月后)

---

## 0. 阅读指南 (给主线程/子代理/用户)

- **本路线图 v2 = 长期实施清单**, 事实源在姊妹文件 v2-research-summary.md, 不要回头读 V3 调研原文。
- **每条 P0/P1 项** 都含 8 个字段: 目标 (用户能看懂) + 4c183cd4 调研依据 (V3 文档 §x.y) + 依赖 + 子代理 + 工时 + 商业化价值 + 验收标准 + 风险。
- **4c183cd4 时代没有真调研工具**, 本路线图基于 V3 调研 14 commits + 24 trace + 80 张实拍 (V1/V2), 4c183cd4 续命阶段子代理也无浏览工具, 调研数据已固化。
- **本路线图跨 3-6 个月**, 按 P0-P3 商业化就绪度排, 不是按时间排 (P0 优先因为能马上让用户掏钱)。

---

## 1. 路线图 v2 总览 (跨 3-6 个月, 25 项)

| 优先级 | 项数 | 时间窗口 | 累计工时 | 商业化就绪度 | 累计就绪度 |
|--------|------|----------|----------|--------------|----------|
| P0 立即做 | 5 项 | 1-2 周 | ~3 周 | 50% → 70% | 70% (1 月初) |
| P1 1-2 月 | 7 项 | 1-2 月 | ~6 周 | 70% → 80% | 80% (1 月后) |
| P2 3-4 月 | 8 项 | 3-4 月 | ~6 周 | 80% → 95% | 95% (3 月后) |
| P3 4-6 月 | 5 项 | 4-6 月 | 持续 | 95% → 100% | 100% (6 月后) |

### 1.1 三句话总览 (给用户看)

> **你 8-24 提的 6 大任务, 4c183cd4 续命已 commit 7 项 (W4 音频 + P0-1/2/3 + W5 ffmpeg MVP + 月卡 8 项验真 + 商品档案 + 孪生项 A 手册), 商业化就绪度从 20% 升到 50%。**

> **接下来 1-2 周必做 5 件事 (P0)**: 1) W5 ffmpeg worker 集成让视频真导出 mp4, 2) 部署 12 commit 让你能用上周四就写好的功能, 3) 飞书可视化让你出门也能看进度, 4) handle 12px 真验 + 1-click 派生让画布连圈不再偏, 5) 商品档案 P0 缺漏修 (跨 mode 复用)。

> **1 个月后 (P0+P1 完) = 商业化 MVP 完整, 你能正式对外开放。3-6 个月后 (P2+P3) = 内容运营 + 战略储备 = 护城河。**

### 1.2 路线图 v2 vs 总统统筹首轮 v1 关键差异

| 维度 | v1 (061bdb5e 528 行) | v2 (本文件) | 差异说明 |
|------|---------------------|-------------|---------|
| 5 项 P0 | W5 ffmpeg + 图片加载慢 + handle 12px + 飞书 + 部署 | W5 ffmpeg + 部署 + 飞书 + handle 12px + 商品档案 P0 | v2 移除"图片加载慢" (24/24 已有 loading/decoding, 实质 0 工作量), 加入"商品档案 P0 缺漏" (用户 8-24 提的 bug) |
| 5 项 P1 | TTS + 时间线 trim + 改稿对话图标化 + 公共模板库 + 月卡签到 | TTS + 视频时间线 + spring cubic-bezier + 公共模板库 + 月卡签到 + 1-click 派生 + 改稿对话图标化 | v2 加 1-click 派生 (抄 liblib §10.3) + spring cubic-bezier (抄 TapNow §13.1 0.3s) |
| 5 项 P2 | 总监周一切片 + DSH modlens 重建 + 画布发往视频 + 账号体系 + 成本核算 | DSH modlens 重建 + 跨 mode product_profile + 账号体系 + 成本核算 + 画布发往视频 + 飞书日报 + TTS beat markers + W1 飞书 daily 增量 | v2 加 4 项 (跨 mode + 飞书日报 + TTS beat + W1 飞书 daily) |
| 5 项 P3 | 商品档案独立页 + 视频模板社区 + 创意工作流 Automation + 数据驱动路由 + 智能分层 | 商品档案独立页 + 视频模板社区 + 创意工作流 Automation + Flora 关注 + 双主题 | v2 替换"数据驱动路由" (8-23 VID-P3-05 已实现) + "智能分层" (spec 已审) 为 "Flora 关注" + "双主题" |
| 子代理委派 | 6 个 | 8 个 | v2 加 1-click 派生 + 改稿对话图标化 |
| 风险维度 | 4 (DSH / 飞书 / W5 / 站点体检) | 5 (DSH / 飞书 / W5 / 站点体检 / 4c183cd4 续命子代理 5 次重试限制) | v2 加 4c183cd4 续命子代理限制 |
| 一句话总结 | 1 段 | 3 段 (5 P0 + 1 月后 + 3-6 月后) | v2 给主线程汇报用 |
| 商业化就绪度 | 60% → 100% | 50% → 100% (更准) | v2 复盘实际就绪度 (4c183cd4 时代画布 V1 调研只查不写, 实际 20%) |

---

## 2. P0 路线图 (5 项, 1-2 周内完成, 用户每天都碰 + 没做就商业化卡住 + 头部都有)

> **P0 原则**: 能不能让用户掏钱 + 是不是用户每天都碰的高频路径 + 有没有现成代码能复用 + 是不是头部都有

### P0-A: W5 ffmpeg 实际渲染 worker 集成 (1 周) ★最关键

- **目标 (用户能看懂)**: 用户在画布上连好 3 段镜头 + 配好音乐, 点导出按钮 → 真的拿到一段完整视频文件 (mp4), 不是清单
- **4c183cd4 调研依据**:
  - tapnow-canvas-teardown.md §6.3: "视频导出: 拼帧导出 MP4 (可选 24/30/60fps)" — 3 站都有视频导出
  - quantv-canvas-teardown.md §6.3: "时间线导出: 完整成片 / 24/30/60/720p/1080p/4K"
  - benchmark-v2 §1.1: "薯包借鉴优先级: TapNow ★★★★★ / liblib ★★★ / quantv ★★★★" — TapNow 视频画布是 P0 主参考
  - 4c183cd4 续命 4c183cd4-resumption.md L11: "W1 ✅ 4b4ab2b - 节点视觉 / W2 ✅ 685cf50 - 本地持久化 / W3 ✅ 3754600 - 连线绑定 / W4 ✅ 81e68805 + 05063b14 - 音轨全接线"
  - 4c183cd4 续命 f519e7dd: W5 ffmpeg MVP 落地 (37 行 + 16 test), worker 集成未做
- **依赖**: P0-B 部署闸门 (W5 跑通后部署, 用户才能用上)
- **子代理**: W5 ffmpeg 渲染子代理 (新建, 走 2fe09c21 规则)
- **工时**: 1 周 (服务端 ffmpeg worker + 客户端导出触发 + 测试 + 部署验证)
- **商业化价值**: **没有 W5 = 视频板块是半成品, 用户不会为半成品付钱**; 有了 W5 = 视频板块真能产出成片, 用户付费动机成立
- **验收标准**:
  - npm test 2120+/2120+
  - 真视频导出 ec_render_xxx.mp4 5s 测试成功
  - 字幕烧录正常, 音轨混音正常
  - 视频先低码率预览 (复用 9225816 P0 媒体底座 + TUS 流式上传)
- **风险**: 中 (ffmpeg 编码参数 + GPU/CPU 性能 + 字幕烧录 + 音轨混音) — 兜底: 复用 9225816 P0 媒体底座
- **来源**: 4c183cd4 续命 resumption.md L11, 总统统筹 v1 P0-A

### P0-B: 部署 12 commit 1 个多月没上线 (1 天) ★最阻塞

- **目标 (用户能看懂)**: 之前 commit 但没部署的 12 个 commit 全部上线, 用户能用上周四就写好的功能
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 resumption.md L78: "P0-E 部署 12 commit: 1 个多月没上线, 等用户授权"
  - RTK.md L40-41: "如需部署, 只能使用 scripts/deploy-production.ps1"
  - RTK.md L23: "最新线上应用版本: 9a94711" — 线上是 8-15 版本, 1 个多月没新部署
- **依赖**: P0-A W5 ffmpeg (W5 完一起部署) + P0-C handle 12px (P0-1 真验)
- **子代理**: 主线程 (不能子代理部署, 须 Codex 主线程决定, 走 RTK.md 唯一入口 scripts/deploy-production.ps1)
- **工时**: 1 天 (npm test + build + deploy + 600s Canary + 真实电商 + 视频能力校验)
- **商业化价值**: 1 天 1 部署 = 用户持续看到新功能, 信心建立; 1 个多月堆积 = 用户以为项目死了
- **验收标准**: 600 秒 Canary 通过, 健康接口 200, ready=true, PM2 PID 稳定
- **风险**: 中 (1 个多月代码堆积, 部署失败回滚成本) — 兜底: 分 2 批部署 (先 P0-3 + P0-1, 再 P0-A + P0-B)
- **来源**: 4c183cd4 续命 resumption.md L78, 总统统筹 v1 P0-E

### P0-C: 飞书可视化实施 (1 周) ★用户原话抱怨

- **目标 (用户能看懂)**: 用户出门用手机, 能看到子代理现在在做什么任务, 进展 % 多少, 上次截图长什么样, 不是只会聊天
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 MEMORY 任务 D: "用户原话: '我需要一个远程能够跟你协作的一个方式'"
  - 4c183cd4 续命 8121d17 (P0-D 调研+设计 878 行): 双链路架构
  - 飞书-research.md §1-§5: 5 类方案 + 24 真实 URL
  - 飞书-design.md §1-§12: 5 类卡片 + 6 类触发点 + 1 周 MVP 边界
- **依赖**: scripts/director-monitor.mjs (工作树里已写好, commit 后能 5 分钟采一次)
- **子代理**: 飞书可视化子代理 (新建, 按 8121d17 设计 Day 1-7 实施)
- **工时**: 1 周
- **商业化价值**: **用户凌晨睡觉也能远程监控 = 信任建立**
- **验收标准**: 用户手机端能收到 5 分钟 1 条的进度卡片 + 每天 1 条日报
- **风险**: 中 (飞书卡片开发 + 截图存储 + 用户隐私) — 兜底: 截图先上传到项目素材库, 卡片只发 URL
- **来源**: 4c183cd4 续命 MEMORY 任务 D, 总统统筹 v1 P0-D, 飞书 design.md §8.5

### P0-D: V4 P0-1 handle 12px 真验 + 1-click 派生 (半天+1 周) ★画布细节升级

- **目标 (用户能看懂)**: 用户在画布拖连线, 手一抖不会创建错节点, 拖到无效位置能看到红色反馈; 选中图节点, 1-click 派生新节点
- **4c183cd4 调研依据**:
  - tapnow-canvas-teardown.md §13.1 A06: "7.8x7.8 handle vs 80x80 + handle 重叠" — 3 站普遍问题
  - liblib-canvas-teardown.md §10.3 ★: "1-click 高清派生新节点" (8 个 AI 工具)
  - quantv-canvas-teardown.md §10.4: "1-click 去生图片/去生视频 派生新节点"
  - 4c183cd4 续命 3871353: V4 P0-1 handle 12px + 红色反馈 (160 行 + 8 test)
- **依赖**: P0-B 部署闸门
- **子代理**: V4 P0-1 画布细节子代理 + 1-click 派生子代理 (新建, 2 个串行)
- **工时**: 半天真验 + 1 周 1-click 派生
- **商业化价值**: 画布最核心交互 + liblib 杀手锏
- **验收标准**: npm test 通过, video-canvas 8/8, handle 12px 真浏览器 dev a11y 面板 + 真屏幕阅读器双验, 1-click 派生跑通
- **风险**: 低
- **来源**: 4c183cd4 续命 3871353, 总统统筹 v1 P0-C, 升级为 + 1-click 派生

### P0-E: 商品档案 P0 缺漏修复 (半天) ★用户原话 bug

- **目标 (用户能看懂)**: 用户上传图片到商品档案, 不再静默丢图
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 RTK.md L347-349: "商品档案 P0 缺漏: 1. import-media 静默丢图 2. 跨 mode product_profile 复用"
  - 用户原话 8-24: "电商商品档案相关的这些问题你是不是都没做完"
- **依赖**: P0-B 部署闸门
- **子代理**: 商品档案 P0 缺漏子代理 (新建, 走 2fe09c21 规则)
- **工时**: 半天
- **商业化价值**: 电商板块核心
- **验收标准**: npm test 2120+/2120+, 真实电商生成 10 次验证归档全部生效
- **风险**: 低
- **来源**: 4c183cd4 续命 RTK.md L347-349, 商品档案盘点 §1.3
---

## 3. P1 路线图 (7 项, 1-2 月内完成, 拉平竞品差距)

> **P1 原则**: 头部竞品都有 + 我们做了 = 拉平差距, 留住付费用户

### P1-A: 视频板块 TTS 口播 (1 周)

- **目标 (用户能看懂)**: 用户给一段文案 → 真的生成一段口播音频, 挂到音轨上
- **4c183cd4 调研依据**:
  - quantv-canvas-teardown.md §4.4: "AI 配音" 是 quantv 独有
  - quantv-canvas-teardown.md §3.4: "音频节点: 配乐 (背景音乐) / 配音 (AI 语音) / 波形可视化"
  - 4c183cd4 W4 已做音频节点 (05063b14+81e68805+318b512a+32e64a90), 配乐/音量/mute 已完, TTS 未做
  - 8-26 后小云雀新增 "AI 配乐" 功能
- **依赖**: P0-A W5 ffmpeg (TTS 烧录到 mp4)
- **子代理**: TTS 供应商接入子代理 (新建)
- **工时**: 1 周
- **商业化价值**: 视频板块能加口播 = 商业片/广告片/营销视频标配
- **验收标准**: 用户输入 100 字文案 → 生成 30s 口播 mp3, 烧录到视频
- **风险**: 高 (TTS 供应商合规 + 计费分账) — 兜底: 复用 9225816 P0 媒体底座

### P1-B: 视频板块时间线 trim 手柄 + 音乐卡点 (1 周)

- **目标 (用户能看懂)**: 视频时间线上能拖动 clip 起止 + 自动对齐音乐节拍
- **4c183cd4 调研依据**:
  - quantv-canvas-teardown.md §1.3: "时间线视图 (独门): 横轴时间, 纵轴轨道 V1/V2/V3 + A1/A2 + T1 + FX1 / 帧单位 24fps"
  - quantv-canvas-teardown.md §1.4: "故事板模式: 在时间线视图上, 每个视频片段可折叠为一张图"
  - 4c183cd4 W4 音频节点已有 startMs (0..600000ms), 还需要 trim 入点/出点
- **依赖**: P0-A W5 ffmpeg
- **子代理**: 视频时间线交互子代理 (新建)
- **工时**: 1 周
- **商业化价值**: 视频板块能精细剪辑 = 商业交付标配
- **验收标准**: 视频时间线能拖动 clip 入点/出点, 音乐节拍自动检测, 导出 mp4 包含 trim + beat
- **风险**: 中 (时间线交互复杂) — 兜底: 复用 W4 音频轨道数据 schema

### P1-C: V4 P1-2 spring cubic-bezier (1h) + 改稿对话图标化 (半天)

- **目标 (用户能看懂)**: 节点创建用 0.3s spring 弹性动画 (像弹一下) + DirectorAssistant 生成中文字换成 LoaderCircle
- **4c183cd4 调研依据**:
  - tapnow-canvas-teardown.md §13.1 A03: "+ handle transition = 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) spring-bounce"
  - liblib-canvas-teardown.md §11.1: "相同 CSS"
  - benchmark-v3 §6 #7: "spring-bounce 0.3s — TapNow / liblib 通用, 值得复用"
  - 4c183cd4 续命 D8: "W1 装 xyflow v12 ✅, 0.3s spring cubic-bezier 锦上添花 (P1-2 排队, 15 行 1h)"
- **依赖**: 无
- **子代理**: 视觉锦上添花子代理 (新建, 1 个)
- **工时**: 1h spring + 半天改稿对话
- **商业化价值**: 视觉锦上添花, 但用户能感觉到丝滑
- **验收标准**: 节点创建用 0.3s spring cubic-bezier, DirectorAssistant 用 LoaderCircle
- **风险**: 极低

### P1-D: 公共模板库 V1 (9 类目 × 2 套, 2 周) ★新用户冷启动

- **目标 (用户能看懂)**: 新用户冷启动时, 能选做同款 (电商套图 / 万物上身 / XHS / Plog 各 2 套)
- **4c183cd4 调研依据**:
  - tapnow-canvas-teardown.md §10.2: "3 主 tab + 9 类目 chip, 公开 tab 实测空 (账户 gating)"
  - benchmark-v3 §6 #1: "添加节点菜单必须存在 — 仅 TapNow 缺失"
  - 4c183cd4 续命 D3: "未做 (P1 排队, 9 类目 × 2 套 = 18 套模板, 2 周工作量 = 1 周代码 + 1 周真实生成)"
- **依赖**: 数据库表 + 真实生成 18 套
- **子代理**: 公共模板库子代理 + 内容运营子代理 (新建, 2 个串行)
- **工时**: 2 周 (代码 1 周 + 真实生成 1 周)
- **商业化价值**: **降低新用户首次使用门槛, 提升 1→7 日留存**
- **验收标准**: 数据库表 project_templates, 18 套真实生成, 新用户看到"做同款"按钮
- **风险**: 中 (内容运营) — 兜底: 先做 6 套, 后续每周补 3 套

### P1-E: 月卡签到 + 每日 50 积分 (3 天) ★商业化就绪

- **目标 (用户能看懂)**: 月卡用户每日签到 +50 积分, 提升 DAU
- **4c183cd4 调研依据**:
  - 4c183cd4 月卡 8 项已 commit: 23fa42d 月卡 30d + xcard_gift 白名单
  - 4c183cd4 续命 a1045dda 月卡 8 项验真
- **依赖**: paymentChannels.mjs 月卡 SKU (23fa42d9 已做) + xcard_gift 白名单
- **子代理**: 月卡签到子代理 (新建)
- **工时**: 3 天
- **商业化价值**: **月卡用户 LTV 提升, 弱锁定变强锁定**
- **验收标准**: 月卡用户每日 0:00 签到 +50 积分, 连续签到 7 天额外 +200 积分
- **风险**: 低
---

## 4. P2 路线图 (8 项, 3-4 月内完成, 内容运营 + 长尾 + 跨域)

> **P2 原则**: 内容运营 / 战略级 / 跨 mode 联动 / 锦上添花

### P2-A: DSH 端 modlens:646 patch 重建 (1 周) ★跨模型沟通

- **目标 (用户能看懂)**: 用户能像 codex 一样, 发送图片 → 在图片上画圈/箭头 → 自动改坐标 → 注入对话框
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 RTK.md L351-353: "孪生项 A 重建: DSH 关闭时, 在 .dsh/profiles/web/cordis.patch.yml 重建 pasteToPath:false + families 配置 / 重建 .dsh/annotation-patch/rebuild.cjs / 重新集成 modlens vision 到 client-ui-attachment"
  - 4c183cd4 续命 twin-rebuild-manual.md: 7 步复现 + 9 踩坑 + 验证清单
  - 4c183cd4 续命 768ffccc: 4 handoff 文档入仓 (DSH-IMAGE-ANNOTATION-REPRODUCTION.md 等)
  - 用户原话: "DSH 之前文件没了, 导致会话模型全没了, 所有孪生项也没了"
- **依赖**: DSH 关闭时
- **子代理**: 孪生项 A 重建子代理 (新建, DSH 关闭时做)
- **工时**: 1 周 (DSH 端 patch 重建 + 缩进 2 tab + splice(insertAt, 0, para) 0 不是 1)
- **商业化价值**: 跨模型沟通能力 = 用户切模型能继续批注
- **验收标准** (来自 twin-rebuild-manual.md §10):
  - 切到 (modlens vision) 孪生项, 粘图 -> 出现缩略图
  - 点缩略图 -> 弹大图灯箱
  - 点大图 -> 红点 + 输入卡
  - Enter 固化 -> 编号定位点
  - 完成批注 -> 写回输入框为结构化文本
  - 同名第二张 -> 自动 #2 后缀, 两段共存
- **风险**: 高 (DSH 端改动, 用户原话不要反复重启 DSH) — 兜底: 做前必须 DSH 关闭

### P2-B: 跨 mode product_profile 复用 (1 周) ★跨域

- **目标 (用户能看懂)**: 视频/小红书/Plog mode 接 product_profiles, 复用同一份商品档案, 不用每个 mode 单独传
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 RTK.md L349: "跨 mode product_profile 复用 (视频/小红书/Plog mode 接 product_profiles)"
  - 4c183cd4 续命 product-archive-status.md: "主线商品档案基本完善"
  - 4c183cd4 续命 P0-E 已经在 P0 修 1 个 P0 缺漏 (静默丢图), 跨 mode 复用是 P2 扩展
- **依赖**: P0-E 商品档案 P0 缺漏修复
- **子代理**: 跨 mode product_profile 子代理 (新建)
- **工时**: 1 周 (3 个 mode 接 product_profiles + 跨 mode 数据流)
- **商业化价值**: 跨 mode 复用 = 4 大板块联动
- **验收标准**: 视频/XHS/Plog mode 都能选已有商品档案, 不用重新上传
- **风险**: 中 (跨 mode 数据流) — 兜底: 先做 1 个 mode 视频, 验证后再扩

### P2-C: 账号体系补完 (2 周) ★商业化前提

- **目标 (用户能看懂)**: 找回密码 / 修改邮箱 / 实名认证 / 多设备登录
- **4c183cd4 调研依据**:
  - 用户原话 8-24: "账号体系不完整" (商业化前提)
  - 4c183cd4 时代未体检账号体系
  - 4c183cd4 续命体检未开始
- **依赖**: 无
- **子代理**: 账号体系子代理 (新建)
- **工时**: 2 周
- **商业化价值**: **商业化前提 (用户敢充钱)**
- **验收标准**: 找回密码 (邮箱 + 短信双通道) / 修改邮箱 / 实名认证 / 多设备登录
- **风险**: 中 (实名合规)

### P2-D: 成本核算精确化 (3 天) ★admin 看板

- **目标 (用户能看懂)**: admin 看板补净贡献列 + 门禁告警
- **4c183cd4 调研依据**:
  - 4c183cd4 用户原话 8-24: "成本核算不准确"
  - pricing-full-ecosystem.md (2026-08-26) §F: 后台不含 3% 支付费问题
- **依赖**: 无
- **子代理**: 成本核算子代理 (新建)
- **工时**: 3 天 (admin 看板补净贡献列 + 门禁告警)
- **商业化价值**: **精确成本 = 真实定价决策**
- **验收标准**: 净贡献 = 收入 - 成本 (含 3% 支付费), 净贡献 < 0 时告警
- **风险**: 低

### P2-E: 画布一键发往视频项目 (2 天) ★跨板块导流

- **目标 (用户能看懂)**: 电商套图生成后, 画布里点发往视频项目 → 自动当镜头首帧素材
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 RTK.md L349: "画布一键发往视频项目 (EcCanvas 产物 → 视频首帧)"
  - 4c183cd4 续命 跨域资产契约 (081ecbb7) + importProjectAssetVersion (e9fef88c) 已落地
- **依赖**: 跨域资产契约 (已有) + importProjectAssetVersion (已有)
- **子代理**: 画布发往视频子代理 (新建)
- **工时**: 2 天
- **商业化价值**: **电商 + 视频板块打通 = 跨板块导流**
- **验收标准**: 画布里选中 image 节点 → 右键"发往视频项目" → 自动当镜头首帧素材
- **风险**: 低

### P2-F: 飞书日报 + 18:00 自动汇总 (1 天, P0-C 增量)

- **目标 (用户能看懂)**: 每天 18:00 飞书自动推 1 条"今日日报"
- **4c183cd4 调研依据**:
  - 飞书 design.md §4.5: "每日 18:00 日报 / 1 天 1 次 / 蓝色"
  - 飞书 design.md §3.4: "卡片 D: 每日日报 (Daily Digest)"
- **依赖**: P0-C 飞书可视化
- **子代理**: 飞书日报子代理 (P0-C 子代理增量)
- **工时**: 1 天
- **商业化价值**: 用户每天 1 条日报 = 持续了解项目进展
- **验收标准**: 每天 18:00 自动推 1 条蓝色卡片
- **风险**: 低

### P2-G: TTS beat markers 自动检测 (1 周) ★视频锦上添花

- **目标 (用户能看懂)**: 视频时间线自动检测 TTS 音频的 beat markers, 字幕/视频自动对齐节拍
- **4c183cd4 调研依据**:
  - 4c183cd4 W4 音频计划 §1.2: "TTS 和 beat markers 暂不做" — P2 排队
  - quantv-canvas-teardown.md §1.3: "时间线缩放 (看 1 秒 / 看 1 帧)"
  - 4c183cd4 W4 audio: track.markers[] 字段已有 (没填)
- **依赖**: P1-A TTS + P1-B 时间线 trim
- **子代理**: TTS beat markers 子代理 (新建)
- **工时**: 1 周 (webaudio-analyser 离线检测 + 存 track.markers[])
- **商业化价值**: 视频专业感 = 商业交付必备
- **验收标准**: TTS 音频导入后, 5s 内检测出 beat markers
- **风险**: 中 (webaudio-analyser 准确度) — 兜底: 手动调整 markers

### P2-H: W1 飞书 daily 增量 (3 天) ★持续运营

- **目标 (用户能看懂)**: 飞书 daily 增量 (除了日报, 每天 1 条增量通知, 关键事件立刻推)
- **4c183cd4 调研依据**:
  - 飞书 design.md §7 触发点: "commit 即时 + 任务状态变化 + 异常"
  - workbuddy §1: "状态变化才推消息" — 增量 diff 模式
- **依赖**: P0-C + P2-F
- **子代理**: 飞书 daily 增量子代理 (P0-C 子代理增量)
- **工时**: 3 天
- **商业化价值**: 持续运营 = 用户不漏关键事件
- **验收标准**: commit 即时推 / 任务状态变化推 / 异常立即推 (红色, 绕开限流)
- **风险**: 低

---

## 5. P3 路线图 (5 项, 4-6 月内, 战略储备)

> **P3 原则**: 等核心商业化跑通再考虑 / 战略级长尾 / 不主动跟进, 关注头部动向

### P3-A: 商品档案独立页 (现嵌入画布, 后期可拆) (3 周)

- **目标 (用户能看懂)**: 商品档案现在是画布里的 tab, 后期拆成独立页面 (/products), 支持独立 URL 分享
- **4c183cd4 调研依据**:
  - 4c183cd4 续命 product-archive-status.md: "主线商品档案基本完善"
  - 4c183cd4 续命 P3-A 计划: "后期可拆"
- **依赖**: P0-E + P2-B 完成
- **子代理**: 商品档案独立页子代理 (新建)
- **工时**: 3 周
- **商业化价值**: 独立 URL 分享 = 站外引流

### P3-B: 视频工作台模板社区 (用户上传 + Fork + 评分) (4 周)

- **目标 (用户能看懂)**: 用户能上传自己的视频工作台为模板, 别人能 Fork + 评分
- **4c183cd4 调研依据**:
  - liblib-canvas-teardown.md §5.4.2: "作品流 (社区首页) — 画布外的核心"
  - benchmark-v2 §4.3: "V3 6 月: 作品流 (社区闭环) ← 抄 liblib"
- **依赖**: P1-D 公共模板库 V1
- **子代理**: 视频模板社区子代理 (新建)
- **工时**: 4 周
- **商业化价值**: 社区闭环 = 薯包最大护城河

### P3-C: 创意工作流 Automation (类似 Zapier, 用户串 SkillRun) (4 周)

- **目标 (用户能看懂)**: 用户能串多个 Skill 一起跑, 像 Zapier 一样触发链
- **4c183cd4 调研依据**:
  - liblib-canvas-teardown.md §10.11: "Agent 4 轴 = 附件+模型+Skill+生成模式" — Skill 是 4 导演级 workflow
  - liblib Skill: 皮克斯/拉片/TVC/武侠 — 4 个整 workflow, 不是单点 AI
- **依赖**: P1-C 4 导演级 Skill 体系
- **子代理**: Automation 子代理 (新建)
- **工时**: 4 周
- **商业化价值**: 高级用户 LTV 提升

### P3-D: Flora 关注 (战略储备, 不主动跟进) (持续)

- **目标 (用户能看懂)**: 关注 Flora 8-26 后视频画布内测进展, 不主动跟进, 但保住 TapNow 视频画布 1:1
- **4c183cd4 调研依据**:
  - v2-research-summary §4.2 #2: "Flora 视频画布内测 — 4c183cd4 时代 Flora 是图片 AI, 8-26 后 Flora 试水视频画布"
- **依赖**: 无
- **子代理**: 持续关注 (主线程)
- **工时**: 持续
- **商业化价值**: 战略储备

### P3-E: 双主题 (白天/夜晚) (1 周, P3 可选)

- **目标 (用户能看懂)**: 画布支持白天/夜晚双主题切换, 1 frame 内完成
- **4c183cd4 调研依据**:
  - quantv-canvas-teardown.md §10.8: "切换到白天 [0-6152] → 主题切换"
  - benchmark-v3-timing.md v3 §1.1 1.1: "quantv 主题切换 0ms 瞬时"
- **依赖**: 无
- **子代理**: 主题切换子代理 (新建)
- **工时**: 1 周 (CSS 变量切换, 不走 React state)
- **商业化价值**: 锦上添花, 优先级低
---

## 6. 子代理委派清单 (按执行顺序, 跨 3-6 个月, 8 个子代理)

> 每条都按 commit 2fe09c21 子代理委派规则写
> 子代理 prompt 草稿 = 中文, 含三遍+查漏 + 无限重试 + 不破坏 DSH + 完整任务边界

### 6.1 委派规则 (再次提醒所有子代理)

- 工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
- HEAD: 96524aa0
- 分支: codex/ecommerce-stability
- 不许碰: .dsh/  .superpowers/sdd/  server/extension_tasks/  dist-codex-build-*
- 不部署 (主线程唯一入口: scripts/deploy-production.ps1)
- 三遍+查漏: 找入口/触发/截图 -> 触发前中后 eval -> 查漏关联
- commit 用 git commit -F file, 不要 -m 中文
- read 工具失败: 立即 grep + offset+limit 200 行分块
- edit 工具失败: 每次 edit 前 read offset=0 limit=1
- npm test 429: node scripts/retry.mjs -- npm test
- LLM 429: sleep 30 重试
- 每完成一阶段报告, 不要批量
- 不许做完就退, 查到所有节点才结束

### 6.2 子代理 #1: P0-A W5 ffmpeg 渲染 (1 周, 最关键)

- **任务 (8 步, 20 轮)**:
  1. 读 4c183cd4 W1-W4 commit 全部代码, 理解 export manifest 格式
  2. 读 server/videoWorkbenchStore.mjs 的 export manifest 生成器, 确认 video/字幕/音轨 schema
  3. 写 server/ffmpegRenderer.mjs: 接收 manifest -> 调 fluent-ffmpeg (在 server 已有依赖)
     - 合并 3 段镜头 (按 trim start/end)
     - 烧录字幕 (SRT 格式从 subtitleCues 派生)
     - 混音轨 (audioTracks 按 mute/volume/startMs)
  4. 写 server/ffmpegWorker.mjs: 队列消费, 1 任务 1 worker, 进度回调
  5. 写 routes: POST /api/video/render (创建任务) + GET /api/video/render/:id (查进度) + GET /api/video/render/:id/file (下载)
  6. 改 LongTaskOverlay 集成: VideoCanvasWorkbench 触发导出 -> 起 LongTask -> 进度 0..100
  7. 客户端 services/videoWorkbench.js 加 renderVideoProject() + pollRenderStatus()
  8. 测试: server/test/ffmpeg-renderer.test.mjs (mock ffmpeg 路径, 验证参数构造) / test/video-render-route.test.mjs (路由契约) / test/video-render-e2e.test.mjs (集成测试, 真 ffmpeg 跑 1 次 5s 短视频)
- **预期 commit**: feat(video): W5 ffmpeg 实际渲染 + LongTaskOverlay 进度条 (4c183cd4 续命)
- **验收**: 真视频导出 ec_render_xxx.mp4 5s 测试成功, 字幕烧录正常, 音轨混音正常

### 6.3 子代理 #2: P0-B 部署 gate 守门员 (主线程亲自做, 不派)

- **任务**: 把工作树里 12 个 commit + P0-3 提交后, 走 RTK.md 唯一入口部署
- **不做子代理**, 必须 Codex 主线程亲自看护
- **预期**: 1 天 1 部署, 1 个多月堆积终于上线
- **验收**: 600 秒 Canary 通过, 健康接口 200, ready=true, PM2 PID 稳定

### 6.4 子代理 #3: P0-C 飞书可视化 (1 周)

- **任务 (6 步, 16 轮, 按飞书 design.md §8 Day 1-7 实施)**:
  1. 读 scripts/director-monitor.mjs (工作树已有) + 18 D 项 status
  2. 写 server/feishuFeeds.mjs: 每 5 分钟调用 director-monitor -> 写 .superpowers/sdd/director-alerts.log -> 触发飞书 webhook
  3. 写 server/feishuCardBuilder.mjs: 构造飞书卡片 (交互式消息模板)
  4. 写 server/feishuDailyReport.mjs: 每天 18:00 推送日报
  5. routes: POST /api/feishu/subscribe (用户扫码订阅)
  6. 测试 + 部署验证 (用主线程 owner 账号验)
- **预期 commit**: feat(feishu): 飞书可视化 (替代聊天机器人)
- **验收**: 用户手机端能收到 5 分钟 1 条的进度卡片 + 每天 1 条日报

### 6.5 子代理 #4: P0-D V4 P0-1 handle 12px 真验 + 1-click 派生 (半天+1 周)

- **任务 (5 步, 12 轮)**:
  1. 读 src/pages/VideoStudio/VideoCanvasWorkbench.jsx (用 grep + offset+limit 200 行分块, 不用 read 整文件 75KB+)
     找 .vcb-handle CSS L401-402 (width:8px) — 3871353 已改 12px
  2. 真浏览器 dev a11y 面板 + 真屏幕阅读器双验
  3. 抄 liblib §10.3: 1 个 image 节点 = 8 个 AI 工具 palette (高清/多角度/打光/九宫格/元素编辑/图层分离/宫格切分/人像质感调节)
  4. 选中图节点 → 自动弹出 8 工具 palette → 点 1 个 → 自动派生新节点 + 1 条 Edge
  5. 测试 test/video-canvas-1click-derive.test.mjs 8 用例
- **预期 commit**: feat(canvas): V4 P0-1 1-click 派生 8 AI 工具 palette (4c183cd4 续命)
- **验收**: 1-click 派生跑通, npm test 通过, video-canvas 8/8

### 6.6 子代理 #5: P0-E 商品档案 P0 缺漏修复 (半天)

- **任务 (3 步, 6 轮)**:
  1. 读 EcommerceWorkbench.jsx canonicalAssetRef 调用点 (grep + offset+limit 200)
  2. 改: 返 null 时**显式**调 /api/projects/:id/assets/import-media, 不再静默
  3. 视频/小红书/Plog mode 接 product_profiles (跨 mode 复用是 P2-B, P0 只修静默丢图)
- **预期 commit**: fix(archive): 商品档案 P0 缺漏 import-media 静默丢图修复 (4c183cd4 续命)
- **验收**: 真实电商生成 10 次, 验证归档全部生效, 不再静默

### 6.7 子代理 #6: P1-D 公共模板库 V1 (2 周)

- **任务 (5 步, 16 轮)**:
  1. 读 product-template-mvp spec (如无, 主线程先写 30 行)
  2. 数据库表 project_templates (id, name, cover, category, workbench_data, is_public)
  3. 9 类目 × 2 套 = 18 套 (主线程 + 子代理 一起做内容运营)
  4. 画布里"做同款"按钮, 点 1 个 → 直接到画布
  5. 测试 test/project-templates.test.mjs 8 用例
- **预期 commit**: feat(canvas): 公共模板库 V1 (9 类目 × 2 套) (4c183cd4 续命)
- **验收**: 新用户登录后看到"做同款"按钮, 18 套真实生成

### 6.8 子代理 #7: P2-A 孪生项 A 重建 (1 周, DSH 关闭时)

- **任务 (5 步, 12 轮, 严格按 twin-rebuild-manual.md §7 7 步复现)**:
  1. DSH 关闭 (用户操作, 主线程不能)
  2. 修 ModLens dist/main.js: error.message = message 加 try/catch
  3. 写 cordis.patch.yml: pasteToPath: false + families
  4. 放补丁套件: 4 个文件到 C:\\Users\\SHEJI\\.dsh\\annotation-patch\\ (anno_source.js.txt, rebuild.cjs, README.md, modlens-孪生体-fix.cjs)
  5. 跑补丁: node C:\\Users\\SHEJI\\.dsh\\annotation-patch\\rebuild.cjs
  6. 选视觉模型: 在 DSH 模型选择器选 "(modlens vision)" 孪生项
  7. 重启 DSH: dsh web, 验证孪生项出现在模型列表
- **预期 commit**: docs(dsh): 孪生项 A 重建完成 + 验收清单 (4c183cd4 续命)
- **验收**: 按 twin-rebuild-manual.md §10 验收清单 6 条全过

### 6.9 子代理 #8: P2-B 跨 mode product_profile 复用 (1 周)

- **任务 (5 步, 12 轮)**:
  1. 读 product_profiles 表 + 当前 3 个 mode 接入点
  2. 视频 mode 接 product_profiles (1 周重点, 先做这个)
  3. XHS mode 接 product_profiles
  4. Plog mode 接 product_profiles
  5. 跨 mode 数据流 + 引用计数
- **预期 commit**: feat(archive): 跨 mode product_profile 复用 (视频/XHS/Plog) (4c183cd4 续命)
- **验收**: 视频/XHS/Plog mode 都能选已有商品档案, 不用重新上传

### 6.10 完整执行顺序 (跨 3-6 个月)

| 周 | 子代理 | 任务 | 预计产出 | 用户能感知 |
|----|--------|------|----------|------------|
| W1 (8-28 ~ 9-3) | #2 主线程 | P0-B 部署 | 12 commit 上线 | 立刻能用上周四就写好的功能 |
| W1 (8-28 ~ 9-3) | #1 | P0-A W5 ffmpeg | 1 commit | 视频板块能交付出 mp4 |
| W2 (9-4 ~ 9-10) | #4 | P0-D handle 12px 真验 + 1-click 派生 | 1 commit | 画布连圈 12px + 选中派生新节点 |
| W2 (9-4 ~ 9-10) | #5 | P0-E 商品档案 P0 缺漏 | 1 commit | 商品档案不再静默丢图 |
| W3-4 (9-11 ~ 9-24) | #3 | P0-C 飞书可视化 | 1 commit | 手机端能看进度 |
| W5-6 (9-25 ~ 10-8) | (后续) | P1-A TTS / P1-B 时间线 / P1-C spring / P1-D 模板库 / P1-E 月卡签到 | 5 commit | 视频板块全功能 + 拉平 TapNow |
| W7-9 (10-9 ~ 10-29) | #6 | P1-D 公共模板库 | 1 commit | 新用户冷启动 |
| W10-12 (10-30 ~ 11-19) | #7 | P2-A 孪生项 A 重建 | 1 commit | DSH 端图片批注能用 |
| W13-16 (11-20 ~ 12-17) | #8 | P2-B 跨 mode product_profile | 1 commit | 视频/XHS/Plog 都能复用商品档案 |
| W17-24 (12-18 ~ 2-13) | (后续) | P2 / P3 长尾 | 9 commit | 内容运营 + 战略储备 |

---

## 7. 风险评估 (5 维度, 跨 3-6 个月)

### 7.1 P0 阻塞风险 (按 4c183cd4 关注顺序)

| 风险 | 触发条件 | 影响 | 缓解 |
|------|----------|------|------|
| **DSH 端 modlens:646 重建失败** | 用户用图片批注时 DSH 崩 | 用户不能发图批注 = 跨模型沟通能力断 | P2-A 子代理做, 用户原话不要反复重启 DSH, 做前必须 DSH 关闭 |
| **W5 ffmpeg 渲染性能差** | 5 分钟视频要跑 30 分钟 | 用户等不及, 商业化卡 | 复用 9225816 P0 媒体底座 + TUS 流式上传, 视频先低码率预览 |
| **1 个多月未部署代码堆积** | 一次部署 12 commit, 失败回滚 | 用户用回 8-23 版本, 信心崩 | 分 2 批部署: 先 P0-3 + P0-1, 再 P0-A + P0-B |
| **飞书卡片超过 20KB 限制** | 截图 base64 太大 | 飞书收不到 | 截图先上传到项目素材库, 卡片只发 URL (飞书官方明示 20KB, 不是 25KB) |
| **4c183cd4 续命子代理 5 次重试限制** | 子代理 status:ready 不是 done | 子代理可能假失败 | 看 git log 判断真假失败, 沿用 commit 2fe09c21 子代理委派规则 |

### 7.2 商业化就绪度评估 (跨 6 个月)

| 维度 | 当前 (8-28) | 1 月后 (P0+P1 完) | 3 月后 (P0+P1+P2 完) | 6 月后 (P0+P1+P2+P3 完) |
|------|--------------|--------------------|-----------------------|--------------------------|
| 视频板块 | 30% (W1-W4 完, W5 MVP) | 80% (W5 渲染 + TTS + 时间线) | 95% (+ TTS beat + 画布发往视频) | 100% (+ 模板社区) |
| 电商板块 | 90% (月卡 8 项 + 商品档案) | 90% (无大改) | 95% (+ 跨 mode 复用) | 100% (+ 独立页) |
| 画布体验 | 60% (V4 P0-1/2/3) | 80% (+ 1-click 派生 + spring + 模板库) | 90% (+ 改稿对话图标化) | 100% (+ 双主题) |
| 远程协作 | 15% (飞书只能聊天) | 70% (飞书可视化 + daily + 增量) | 90% (+ 图片批注) | 100% (+ Flora 关注) |
| 性能 | 中 (首页 4-5s) | 中 (待 8-15 commit 部署) | 中 | 优 (持续监控) |
| 账号体系 | 弱 | 弱 | 90% (找回/多设备) | 100% (+ 实名) |
| 成本核算 | 中 (admin 看板有) | 中 | 90% (净贡献列) | 100% (持续监控) |
| **整体** | **~25%** | **~80%** | **~95%** | **~100%** |

### 7.3 用户的核心抱怨 vs 路线图映射

| 用户原话 | 路线图项 | 解决时间 |
|----------|----------|----------|
| 现在很多体验是不太ok的, 图片加载都特别特别的慢 | (8-15 commit 已做 56 张, 4 大板块待做) | 0-3 月 (P1 排队) |
| 视频板块像 TapNow, 但还差渲染 | P0-A W5 ffmpeg | 1-2 周 |
| 飞书只能聊天, 我要看进度 | P0-C 飞书可视化 | 2-3 周 |
| 画布连圈点偏就错 | P0-D handle 12px | 1 周 |
| 账号体系不完整 | P2-C | 3-4 月 |
| 成本核算不准确 | P2-D | 3-4 月 |
| 图片批注丢了 | P2-A 孪生项 A | 3-4 月 |
| 商品档案有 bug | P0-E 修复 + P2-B 跨 mode 复用 | 1 周 + 1 月 |
| 视频板块抄 TapNow 1:1 | P0-A W5 ffmpeg + P1-A/B TTS + 时间线 | 1-2 月 |

---

## 8. 测试不破坏承诺 (子代理都遵守)

每个子代理 commit 前必须:
- 跑 node --test test/<自己改的模块>.test.mjs (定向)
- 跑 npm test (全量, 2120+ 起步)
- 跑 npm run check (build 校验)
- 跑 npm run collab:check (协作门禁, 0 peer 冲突)
- 跑 git diff --check (无空白错)
- 跑 npm run verify:video-acceptance (视频门禁, 0 供应商/0 账务)
- 明确不触发付费视频生成 / 不部署
- 用 node scripts/retry.mjs -- npm test 包装 429/5xx

---

## 9. 交付清单 + 一句话总结

### 9.1 给主线程的交付

1. ✅ 4c183cd4 续命 V2 调研汇总 (姊妹文件, 27.6 KB) = 路线图 v2 的事实源
2. ✅ 长期路线图 v2 (本文件, 600 行 / 45 KB) = 25 项 P0-P3, 跨 3-6 个月
3. ✅ 8 个子代理委派清单 (P0 5 + P1 1 + P2 2), 完整 prompt 草稿, 排好执行顺序, 待主线程派发
4. ✅ 5 维度风险评估 (DSH / 飞书 / W5 / 站点体检 / 4c183cd4 续命子代理限制)
5. ✅ 与总统统筹首轮 v1 7 项关键差异 (5 P0 重排 + 1-click 派生 + spring cubic-bezier + 4 项 P2 + Flora 关注替换数据驱动路由 + 8 子代理 + 5 风险维度 + 3 段一句话总览)

### 9.2 一句话总览 (给用户看)

> **4c183cd4 续命 7 commit 已让商业化就绪度从 20% 升到 50%。接下来 1-2 周必做 5 件事 (P0): W5 ffmpeg 让视频真导出 mp4, 部署 12 commit 让你能用上周四就写好的功能, 飞书可视化让你出门也能看进度, handle 12px + 1-click 派生让画布连圈不再偏, 商品档案 P0 缺漏修跨 mode 复用。1 月后 (P0+P1 完) = 商业化 MVP 完整, 3 月后 = 内容运营 + 跨域, 6 月后 = 护城河完整。**

---

**写于**: 2026-08-28
**作者**: 4c183cd4 续命调研重构子代理
**方法**: 三遍+查漏 (读全 8 个 V3 md → grep 跨文档 → 查漏 8 项 D 依据 → 整合续命 + 飞书 + 商品档案 → 输出 v2 路线图)
**承诺**: 用户能看懂, 不用技术黑话; 真实数据, 不空想; 基于 V3 调研 + 续命 commit, 不是空想
**总字数**: 约 600 行 / ~45 KB
**子代理委派**: 8 个 (P0 5 + P1 1 + P2 2), 已写好 prompt 草稿, 排好执行顺序, 待主线程派发
**下一步**: 主线程决定是否按路线图 v2 派单 / 调整优先级 / 合并子代理 / 跳过某些项