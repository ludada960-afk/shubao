# 4c183cd4 续命 + 当前 状态盘点 + 长期路线图 v1

> **作者**: 4c183cd4 总统筹子代理
> **生成时间**: 2026-08-28
> **工作树**: F:/da/shubao/.worktrees/codex-ecommerce-stability
> **分支**: codex/ecommerce-stability
> **当前 HEAD**: 3ea2241f (MEMORY.md)
> **线上 HEAD**: e673c10 (8-23 之后再没新部署)

---

## 阅读指南

- 本报告是产品级叙述, 不用技术黑话
- 每个任务都标了: 状态、负责人(子代理)、commit hash、是否假完成
- 路线图跨 3-6 个月, P0/P1/P2/P3 按商业化就绪标准排
- 委派规则严格按 commit 2fe09c21 子代理委派规则

---

## 第一部分: 4c183cd4 续命 + 当前 状态盘点

### 1.1 一句话总览 (给用户看)

| 类别 | 数字 | 用户能看懂的话 |
|------|------|----------------|
| 已完整上线 | 0 个新功能 (线上 8-23 e673c10 之后没动) | 用户拿到的是 8-23 那个版本 |
| 4c183cd4 续命已 commit | 12 个 commit | 月卡 8 项全部 + W4 音频节点 + V4 P0-2 中文 a11y + 商品档案 + W4 计划 + 子代理委派规则 + MEMORY |
| 工作树里已写但没 commit | 3 个大件 (LongTaskOverlay 全套 + App.jsx 接入 + director-monitor) | 等于半成品, commit 后才能算 |
| 待开始 P0 | 2 项 (handle 12px + W5 ffmpeg 渲染) | 用户最常点的画布操作 |
| 8-23 之后未发布 | 1 个多月 (8-23 → 8-28) | 期间代码堆积, 部署闸门空着 |

### 1.2 状态盘点表 (按用户原始 6 大任务)

| 任务 | 状态 | 负责人(子代理) | Commit Hash | 用户能感知的完成标志 | 风险:假完成? |
|------|------|----------------|-------------|------------------------|--------------|
| **A. 月卡商业化 8 项** | OK 全部 commit | 续命子代理 a1045dda | 751ab44, 0d0726aa, d6c07e31, 88aa3ff, 23fa42d9, fbe685c2, e793f773, 7e0624c5, 2e8d93c6 | admin 看板能查 8 项数据 + priceExperiment.mjs + priceDefensePlan.mjs + h3InviteCodes.mjs + xhsLegacyProtection.mjs 都有定向测试 | 测了但没真生产跑过 (未部署) |
| **B. 画布 V3 调研 + V4 P0** | OK V3 调研 + V4 P0 spec 完整, P0-2 已 commit | 续命子代理 25838b11 | cc91428, 0f21eea5, 1a575641, ff38b71f, 8a17febf, 851f6ccc, 94d83ceb, 0960ebda, 0fd490e5, 92395807 + V4 spec dbfb1ec8(回滚但内容在 worktree) + 25838b11 | 8 项行业级普遍缺失 = V4 P0 3 项 + P1 3 项 + 不做 3 项 | 数据真实, 80 张实拍 + ms-precision timing 全在 |
| **C. 视频画布 1:1 复刻 TapNow** | W1-W4 完, W5 未做 | W1 4b4ab2b, W2 685cf50, W3 3754600, W4 05063b14+318b512a+81e68805+32e64a90 | 4b4ab2b, 685cf50, 3754600, 05063b14, 318b512a, 81e68805, 32e64a90 | W4 音频节点 47/47 + 19/19 + 35/35 测试, 加入音轨按钮 + mute + 0..2 音量 | **W5 ffmpeg 实际渲染 = 没做, 用户最想要的生成视频还卡在这里** |
| **D. 飞书远程协作 (可视化)** | X 飞书已能聊天但用户不满意 | 之前已做, 未在 4c183cd4 续命重做 | - | 飞书 App ID cli_aa0727772eb8dcdb, 但只能聊天, 不能看任务/状态/截图 | **用户的核心抱怨没解决** |
| **E. 站点深度体检 + 全面优化** | 部分做了, 大量未做 | - | - | - | **P0 体检问题列表: 图片慢 / 账号体系 / 成本核算 / 商品档案 bug / 画布 4 问题 / 全站 bug** |
| **F. 视频板块抄 TapNow** | V3 调研完 + P0 路线图完, 实装只到画布骨架 | 4c183cd4 V3 调研 cc91428 | 同 B | 4c183cd4 V3 调研完, 抄出 8 项 D, 但实装 W5 渲染未做 | 调研是 4c183cd4 真做的, 80 张实拍, 但实装部分只到 W4 |
| **G. 三遍+查漏规范** | OK 已写入子代理委派规则 | 续命主线程 2fe09c21 | 2fe09c21 | 子代理 prompt 模板都按这规范写 | 规则已沉淀, 但执行要看子代理 |
| **H. modlens vision 图片批注** | 服务端完, DSH 端 patch 丢了 | 续命 4c285eca + 7771e302 | 4c285eca, 7771e302 | provider-agnostic VLM bridge + keyring rotation + VisionFeedback 页面 | **DSH 端 patch modlens:646 重建 = 用户最想要的图片批注还差最后一步** |

### 1.3 三栏汇总 (OK 已完成 / 进行中 / 待开始)

#### OK 已完成 (用户能直接用的)

| 功能 | 何时能用 | 用户怎么用 |
|------|----------|------------|
| 月卡 8 项 (H3-2K 长档/标准档 A/B/nano 2K 修复/降价预案/月卡 30d/Fast N=2/H3 灰度/XHS 60→50) | 等下次部署 | admin 看板 bySku byVariant byChannel + 价格 A/B 自动分流 |
| W4 视频画布音频节点 | 等下次部署 | 视频画布 → asset card → 加入音轨 按钮 + 静音/音量 slider |
| 商品档案系统 | 等下次部署 | tabbed rail + current-product chip + 生成时自动归档 |
| V4 P0-2 中文 a11y | 等下次部署 | 画布 handle/edge 中文化 (4 角 + 边) |
| 跨域资产契约 + retention + canonical URL | 等下次部署 | 跨项目素材复用 + 过期素材 fail closed |

#### 进行中 (写了一半, 工作树里有但没 commit)

| 功能 | 工作树状态 | 缺什么 |
|------|------------|--------|
| **V4 P0-3 长任务全屏 overlay** | LongTaskProvider/Overlay/CSS + 测试 + App.jsx 接入 + Workbench 接线**全部写完** | **只差 git commit + 跑 npm test + 部署** (估计 1 小时) |
| **总监监控 director-monitor** | scripts/director-monitor.mjs + director-status.json 模板 + 18 D 项**全部写完** | **只差 commit + 配定时任务 (5 分钟一次)** |
| **V4 P0-1 handle 12px + 无效释放反馈** | **完全没动** | 这是 P0 第一项但还没人做 |
| **W5 ffmpeg 实际渲染** | server/video-assets/ 目录已建 + input/ 有 6 张 PNG (用户在测), 但 ffmpeg 脚本没写 | W5 计划没写, ffmpeg worker 缺 |
| **XHS 重设计 (画布重做)** | xhs-redesign-{check,desktop-bottom,mobile-check}.png 等 11 张截图在工作树 | JSX 实际改动没看到, 可能只截了图没改代码 |

#### 待开始 (用户原话点过但没做)

| 功能 | 用户原话 | 商业化价值 |
|------|----------|------------|
| **飞书可视化 (替代聊天机器人)** | 我需要一个远程能够跟你协作的一个方式, 可视化去得知你现在在项目上面做了哪些调整 | 远程协作刚需 |
| **DSH 端 modlens:646 patch 重建** | 我可以像 codex 一样, 发送图片给你, 在图片上面做各种批注 | 跨模型沟通刚需 |
| **图片加载慢 (全站 4 板块 + 案例区)** | 包括我们现在四个功能区的板块还有下面的很多这些案例区, 他们之间很多很多的图片加载都特别特别的慢 | 用户每天用, 卡顿严重 |
| **账号体系不完整** | (用户提到但没明确) | 商业化前提 |
| **成本核算不准确** | (用户提到) | 商业化前提 |
| **V4 P1-1 改稿对话图标化** | V4 路线图 P1 | 画布体验增量 |
| **V4 P1-2 spring cubic-bezier** | V4 路线图 P1 | 视觉锦上添花 |
| **V4 P1-3 公共模板库 (内容运营)** | V4 路线图 P1 | 新用户冷启动 |
| **TTS 口播 (P2)** | director audit §B P2 | 视频必备 |
| **音乐卡点 (P2)** | director audit §B P2 | 视频必备 |
| **导出渲染落地 (P1 核心)** | director audit §B P1 #4 | 视频板块成片交付 |

### 1.4 风险: 哪些完成是假完成

| 任务 | 假完成点 | 真完成需要什么 |
|------|----------|----------------|
| 月卡 8 项 | 测了但没真生产跑过 | 部署后用真实账号验转化 + admin 看板 bySku byDay 跑 7 天 |
| W4 音频节点 | 测试全过但 UI 集成只在工作树 | 部署 + 真实视频工作台流程录屏 + 验证 mute/volume 持久化 |
| 商品档案系统 | 文档说完整可用但没真用户跑过 | 部署 + 真实电商生成 10 次, 验证归档 + retention + canonical URL 全部生效 |
| V4 P0-2 中文 a11y | 已 commit 但未真测 | 部署 + 屏幕阅读器 + 浏览器 DevTools a11y 面板双验 |
| **W5 ffmpeg 渲染** | server/video-assets 目录建了, 6 张 input PNG 是用户传的测试素材, **ffmpeg worker 脚本完全没写** | 写真实 ffmpeg 合成 worker (视频+字幕+音轨), 部署后用真视频生成跑一次 |

### 1.5 当前工作树半成品资产清单 (P0 立即可用)

| 文件 | 状态 | 立即可做什么 |
|------|------|--------------|
| src/components/ui/LongTaskProvider.jsx | 完整 | commit P0-3 |
| src/components/ui/LongTaskOverlay.jsx | 完整 | commit P0-3 |
| src/components/ui/LongTaskOverlay.css | 完整 | commit P0-3 |
| test/long-task-overlay.test.mjs | 完整 7 个测试 | commit P0-3 |
| src/App.jsx (已改接入 LongTaskProvider/Overlay) | 完整 diff | commit P0-3 |
| src/pages/VideoStudio/VideoCanvasWorkbench.jsx (已改 useLongTask) | 完整 diff | commit P0-3 |
| scripts/director-monitor.mjs | 完整 | commit 监控脚本 |
| server/video-assets/{input,output}/ 目录 | 6 张 PNG input 测试 | 需要 ffmpeg worker 处理 |

---

## 第二部分: 长期路线图 v1 (跨 3-6 个月, 20 项 P0-P3)

### 2.1 路线图原则 (用 4c183cd4 商业化就绪标准)

用户原话: **最终的目的我们是要实现商业化, 面向整个市场**。

排序维度:
1. **能不能让用户掏钱** (P0 优先)
2. **是不是用户每天都碰的高频路径** (P0 优先)
3. **有没有现成代码能复用, 改改就能上** (P0 优先)
4. **是不是头部竞品 (TapNow/liblib/可灵/PixVerse/Flora) 都做了的** (P0 优先)
5. **是不是纯内容运营 (代码做了没用, 要靠站主原创示例填充)** (P2-P3)

### 2.2 P0 路线图 (5 项, 立即做, 1-2 周内完成)

> P0 = 用户每天都碰 + 没做就商业化卡住 + 头部都有

#### **P0-A: 视频板块 W5 ffmpeg 实际渲染 (最阻塞, 没视频交付感)**

- **目标 (用户能看懂)**: 用户在画布上连好 3 段镜头 + 配好音乐, 点导出按钮 → 真的拿到一段完整视频文件 (mp4), 不是清单
- **现状**: 4c183cd4 调研完了 (cc91428 + 80 张实拍), W1-W4 画布全做完 (节点/持久化/连线/音轨), W5 渲染 = 用户最想要的视频板块还差最后一步
- **依赖**: P0-3 (LongTaskOverlay 已有但未 commit, 渲染期间需显示进度)
- **负责子代理**: 视频工作台子代理 (新建, 走 2fe09c21 规则)
- **预计工时**: 1 周 (服务端 ffmpeg worker + 客户端导出触发 + 测试 + 部署验证)
- **风险**: 中 (ffmpeg 编码参数 + GPU/CPU 性能 + 字幕烧录 + 音轨混音)
- **商业化价值**: **没有 W5 = 视频板块是半成品, 用户不会为半成品付钱**; 有了 W5 = 视频板块真的能产出成片, 用户付费动机成立

#### **P0-B: 站点图片加载慢 (用户 8/24 提的 P0 体检问题)**

- **目标 (用户能看懂)**: 打开首页 4 大板块 + 案例区, 图片秒开, 不再等 3-5 秒
- **现状**: 8bcd29e commit (8-15) 做了 56 张 WebP 缩略图 (2.07 MB vs 原图 141.09 MB, 省 98.5%), 但只做了灵感发现那 56 张, 4 大板块和案例区**没动**
- **依赖**: 无 (但要先盘点 4 大板块有多少图)
- **负责子代理**: 性能优化子代理 (新建)
- **预计工时**: 3-5 天 (盘点 + WebP 批量生成 + lazy load + srcset 切换 + LCP 优化)
- **风险**: 低 (有 8-15 那个 commit 作模板)
- **商业化价值**: **用户每天打开首页都卡 = 用户流失主因, 比任何功能都重要**

#### **P0-C: V4 P0-1 handle 12px + 无效释放反馈 + + handle 视觉分离**

- **目标 (用户能看懂)**: 用户在画布拖连线, 手一抖不会创建错节点, 拖到无效位置能看到红色反馈而不是静默失败
- **现状**: 4c183cd4 V3 调研 A06 实测 3 站都有这个问题, 薯包抢先修 = 显著差异化
- **依赖**: 无
- **负责子代理**: 画布细节子代理 (新建)
- **预计工时**: 半天 (CSS 30 + JSX 30 + 8 测试)
- **风险**: 低
- **商业化价值**: 画布最核心交互, 直接影响创作体验

#### **P0-D: 飞书可视化 (替代聊天机器人)**

- **目标 (用户能看懂)**: 用户出门用手机, 能看到子代理现在在做什么任务, 进展 % 多少, 上次截图长什么样, 不是只会聊天
- **现状**: 飞书已能聊天, 但用户原话我需要可视化去得知你现在在项目上面做了哪些调整, 做到了一个什么样的一个成果, **不满足**
- **依赖**: scripts/director-monitor.mjs (工作树里已写好, commit 后能 5 分钟采一次)
- **负责子代理**: 飞书可视化子代理 (新建)
- **预计工时**: 1 周 (飞书卡片 + 截图上传 + 任务列表 + 进度条 + 每天 1 条日报)
- **风险**: 中 (飞书卡片开发 + 截图存储 + 用户隐私)
- **商业化价值**: **用户凌晨睡觉也能远程监控 = 信任建立, 等于 24 小时远程协作能力**

#### **P0-E: 部署 W4 音频节点 + P0-3 LongTaskOverlay + 月卡 8 项 上线 (把工作树里已写好的推到线上)**

- **目标 (用户能看懂)**: 之前 commit 但没部署的 12 个 commit 全部上线, 用户能用上周四就写好的功能
- **现状**: 12 个 commit 在工作树但线上还是 8-23 e673c10, **1 个多月没新部署**
- **依赖**: RTK.md 唯一入口 scripts/deploy-production.ps1
- **负责子代理**: 主线程 (不能子代理部署, 须 Codex 主线程决定)
- **预计工时**: 1 天 (npm test + build + deploy + 600s Canary + 真实电商 + 视频能力校验)
- **风险**: 中 (1 个多月代码堆积, 部署失败回滚成本)
- **商业化价值**: 1 天 1 部署 = 用户持续看到新功能, 信心建立

### 2.3 P1 路线图 (5 项, 1-2 月内完成, 加深商业化护城河)

> P1 = 头部竞品都有 + 我们做了 = 拉平差距, 留住付费用户

#### **P1-A: 视频板块 TTS 口播**

- **目标**: 用户给一段文案 → 真的生成一段口播音频, 挂到音轨上
- **依赖**: P0-A (W5 渲染做完才能用 TTS 烧录)
- **预计工时**: 1 周 (供应商接入 + hold/settle 账务 + 字幕初稿)
- **风险**: 高 (TTS 供应商合规 + 计费分账)

#### **P1-B: 视频板块时间线 trim 手柄 + 音乐卡点**

- **目标**: 视频时间线上能拖动 clip 起止 + 自动对齐音乐节拍
- **依赖**: P0-A
- **预计工时**: 1 周
- **风险**: 中 (时间线交互复杂)

#### **P1-C: V4 P1-1 改稿对话图标化 + V4 P1-2 spring cubic-bezier**

- **目标**: DirectorAssistant 生成中文字 换成 LoaderCircle + 节点创建用 0.3s spring 弹性
- **预计工时**: 半天
- **风险**: 极低

#### **P1-D: 公共模板库 V1 (9 类目 x 2 模板, 站主原创示例)**

- **目标**: 新用户冷启动时, 能选做同款 (电商套图 / 万物上身 / XHS / Plog 各 2 套)
- **依赖**: 数据库表 + 真实生成 18 套
- **预计工时**: 2 周 (代码 1 周 + 真实生成 1 周)
- **风险**: 中 (内容运营, 不是纯代码)
- **商业化价值**: 降低新用户首次使用门槛, 提升 1→7 日留存

#### **P1-E: 月卡签到 + 每日 50 积分 (3 个月实验)**

- **目标**: 月卡用户每日签到 +50 积分, 提升 DAU
- **依赖**: paymentChannels.mjs 月卡 SKU (23fa42d9 已做) + xcard_gift 白名单
- **预计工时**: 3 天
- **风险**: 低
- **商业化价值**: 月卡用户 LTV 提升, 弱锁定变强锁定

### 2.4 P2 路线图 (5 项, 3-4 月内完成, 内容运营 + 长尾)

> P2 = 内容运营 / 战略级 / 锦上添花

#### **P2-A: 总监周一切片 (持续)**

- **目标**: 每个周一 18 D 项状态更新, 用户决策 6-8 项后由 Codex 落地
- **依赖**: director-monitor.mjs + director-briefing.md (工作树里都有)
- **预计工时**: 每周 1 小时
- **商业化价值**: 让用户从提需求变成决策者, 决策密度提升

#### **P2-B: DSH 端 modlens:646 patch 重建 (跨模型沟通能力)**

- **目标**: 用户能像 codex 一样, 发送图片 → 在图片上画圈/箭头 → 自动改坐标 → 注入对话框
- **依赖**: 服务端已完 (4c285eca + 7771e302)
- **预计工时**: 1 周 (DSH 端 patch 重建 + 缩进 2 tab + splice(insertAt, 0, para) 0 不是 1)
- **风险**: 高 (DSH 端改动, 用户原话不要反复重启 DSH)

#### **P2-C: 画布一键发往视频项目 (EcCanvas 产物 → 视频首帧)**

- **目标**: 电商套图生成后, 画布里点发往视频项目 → 自动当镜头首帧素材
- **依赖**: 跨域资产契约 (已有) + importProjectAssetVersion (已有)
- **预计工时**: 2 天
- **风险**: 低
- **商业化价值**: 电商 + 视频板块打通, 跨板块导流

#### **P2-D: 账号体系补完 (用户原话账号体系不完整)**

- **目标**: 找回密码 / 修改邮箱 / 实名认证 / 多设备登录
- **预计工时**: 2 周
- **风险**: 中
- **商业化价值**: 商业化前提 (用户敢充钱)

#### **P2-E: 成本核算精确化 (admin 看板补净贡献列 + 门禁告警)**

- **目标**: pricing spec §F 提到的后台不含 3% 支付费问题, 补净贡献列
- **依赖**: pricing-full-ecosystem.md (2026-08-26) §F 已列
- **预计工时**: 3 天
- **风险**: 低

### 2.5 P3 路线图 (5 项, 4-6 月内, 战略储备)

> P3 = 等核心商业化跑通再考虑 / 战略级长尾

#### **P3-A: 商品档案独立页 (现嵌入画布, 后期可拆)**
#### **P3-B: 视频工作台模板社区 (用户上传 + Fork + 评分)**
#### **P3-C: 创意工作流 Automation (类似 Zapier, 用户串 SkillRun)**
#### **P3-D: 数据驱动路由 (8-23 VID-P3-05 已实现, 等上线跑数据再优化)**
#### **P3-E: 智能分层 (spec 已审, 等画布稳定后接入)**

### 2.6 路线图总览 (跨 3-6 个月, 20 项)

| 优先级 | 项数 | 时间窗口 | 累计工时 | 商业化就绪度 |
|--------|------|----------|----------|--------------|
| P0 | 5 项 | 1-2 周 | ~3 周 | 商业化 MVP 完成 |
| P1 | 5 项 | 1-2 月 | ~6 周 | 拉平竞品差距 |
| P2 | 5 项 | 3-4 月 | ~6 周 | 长尾 + 内容 |
| P3 | 5 项 | 4-6 月 | 持续 | 战略储备 |

---


## 第三部分: 子代理委派清单 (按执行顺序, 跨 3-6 个月)

> 每条都按 commit 2fe09c21 子代理委派规则写
> 子代理 prompt 草稿 = 中文, 含三遍+查漏 + 无限重试 + 不破坏 DSH + 完整任务边界

### 3.1 委派规则 (再次提醒所有子代理)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: 3ea2241f
分支: codex/ecommerce-stability
不许碰: .dsh/  .superpowers/sdd/  server/extension_tasks/  dist-codex-build-*
不部署 (主线程唯一入口: scripts/deploy-production.ps1)
三遍+查漏: 找入口/触发/截图 -> 触发前中后 eval -> 查漏关联
commit 用 git commit -F file, 不要 -m 中文
read 工具失败: 立即 grep + offset+limit 200 行分块
edit 工具失败: 每次 edit 前 read offset=0 limit=1
npm test 429: node scripts/retry.mjs -- npm test
LLM 429: sleep 30 重试
每完成一阶段报告, 不要批量
不许做完就退, 查到所有节点才结束

### 3.2 委派清单 (按执行顺序)

#### 子代理 #1: P0-E 部署 gate 守门员 (主线程亲自做, 不派)

主线程工作: 把工作树里 12 个 commit + P0-3 提交后, 走 RTK.md 唯一入口部署
不做子代理, 必须 Codex 主线程亲自看护
预计工时: 1 天
预期 commit: (无, 直接部署)
验收标准:
- npm test 2120+/2120+
- npm run check 绿
- npm run collab:check READY
- 600 秒 Canary 通过
- 真实电商生成 ec_xxx 3 个稳定资产
- 视频能力契约 2 个产品
- 健康接口 200, ready=true
- PM2 PID 稳定

#### 子代理 #2: P0-3 LongTaskOverlay 提交员 (最小, 已写好只差 commit)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: 3ea2241f
角色: P0-3 commit 守门员

任务 (3 步, 4 轮):
1. 跑 npm test test/long-task-overlay.test.mjs (应已通过) + npm run check + git diff --check
2. 明确 git add: src/components/ui/LongTaskProvider.jsx + LongTaskOverlay.jsx + LongTaskOverlay.css + test/long-task-overlay.test.mjs + src/App.jsx + src/pages/VideoStudio/VideoCanvasWorkbench.jsx
3. commit 用 git commit -F 写到 .tmp-anno-verify/commit-msg-p0-3.txt
   内容: feat(canvas): V4 P0-3 D2 长任务全屏 overlay + 进度条 (4c183cd4 resume)
   - LongTaskProvider (activeTasks Map + orderRef 多任务并发, progress 钳位 0..100)
   - LongTaskOverlay (顶部进度条 0%->100%, 中央卡片 spinner+title+stage+percent)
   - App.jsx 接入 LongTaskProvider + 渲染 LongTaskOverlay (z-index 1500)
   - VideoCanvasWorkbench handleCreateExportManifest 3 步进度 (33/90/100) + finally 收尾
   - CSS 玻璃感 backdrop-filter + prefers-reduced-motion 兼容
   - 7 个契约测试覆盖 进度钳位/挂载/接线/a11y

预期 commit: feat(canvas): V4 P0-3 D2 长任务全屏 overlay + 进度条
验收标准: npm test 2120+/2120+, long-task-overlay 7/7, 准备交给子代理 #1 部署
不许碰: 其他任何文件, 不许改 Canvas 内部逻辑

#### 子代理 #3: P0-C V4 P0-1 handle 12px + 无效释放反馈 (半天)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: P0-3 commit 后
角色: V4 P0-1 画布交互细节子代理

任务 (4 步, 8 轮):
1. 读 src/pages/VideoStudio/VideoCanvasWorkbench.jsx (用 grep + offset+limit 200 行分块, 不用 read 整文件 75KB+)
   找 .vcb-handle CSS L401-402 (width:8px)
2. 改 CSS: width: 12px, height: 12px (定位同步调整 4 行)
3. 加 react-flow onConnectStart/onConnectEnd 监听 + 抖动 class + 红色 outline (CSS 30 + JSX 20)
4. 改 + handle 从 cover 改为右下角, 显式图标 (CSS 20 + JSX 10)
5. 加测试 test/video-canvas-handle-v4-p0-1.test.mjs 8 用例
6. 跑 npm test + npm run check + git diff --check
7. commit -F .tmp-anno-verify/commit-msg.txt (内容含 feat(canvas): V4 P0-1 D4 handle 12px + 无效释放反馈 + + handle 视觉分离)

预期 commit: feat(canvas): V4 P0-1 D4 handle 12px + 无效释放反馈 + 视觉分离
验收: npm test 通过, video-canvas 8/8, 准备部署
不许碰: 任何商业化/billing 改动, 不改 4b4ab2b W1 commit 的内容

#### 子代理 #4: P0-B 站点图片加载慢优化 (3-5 天)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: P0-1 commit 后
角色: 性能优化子代理 (图片加载专项)

任务 (5 步, 12 轮):
1. 盘点首页 4 大板块 + 案例区所有图片, 列出原图大小 / 数量 / 加载耗时
2. 复用 8bcd29e commit 的 images:thumbs 脚本生成 720px WebP 缩略图
3. 改 src/pages/Home/index.jsx 4 大板块 img 走 srcset 缩略图 + loading=lazy
4. 改 src/components/Showcase/ 案例区 (查 git log 找最近改 showcase 的 commit)
5. 改 src/pages/EcCanvas/ 万物上身区
6. 跑 LCP 测试 (Lighthouse) + 真实浏览器 network 面板截图
7. 加测试 test/image-lazy-load.test.mjs 6 用例
8. npm test + npm run check + git diff --check
9. commit -F .tmp-anno-verify/commit-msg.txt (perf(images): 4 大板块 + 案例区 WebP 缩略图 + lazy load)

预期 commit: perf(images): 4 大板块 + 案例区 WebP 缩略图 + lazy load
验收: LCP < 2.0s, FCP < 1.0s, 浏览器无横向溢出, 准备部署
不许碰: 任何 backend / billing / 画布 / 视频 / modlens 改动

#### 子代理 #5: P0-A 视频板块 W5 ffmpeg 渲染 (1 周, 最关键)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: 性能优化 commit 后
角色: W5 ffmpeg 渲染子代理 (新建)

任务 (8 步, 20 轮):
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
8. 测试: server/test/ffmpeg-renderer.test.mjs (mock ffmpeg 路径, 验证参数构造)
         test/video-render-route.test.mjs (路由契约)
         test/video-render-e2e.test.mjs (集成测试, 真 ffmpeg 跑 1 次 5s 短视频)
9. 跑 npm test 2120+/2120+ + npm run check + git diff --check
10. commit -F .tmp-anno-verify/commit-msg.txt (feat(video): W5 ffmpeg 实际渲染 + LongTaskOverlay 进度条)

预期 commit: feat(video): W5 ffmpeg 实际渲染 + LongTaskOverlay 进度条
验收: 真视频导出 ec_render_xxx.mp4 5s 测试成功, 字幕烧录正常, 音轨混音正常
不许碰: W1-W4 已有 commit 不动, 不改 4c183cd4 调研文件

#### 子代理 #6: P0-D 飞书可视化 (1 周)

工作目录: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability
HEAD: W5 渲染 commit 后
角色: 飞书可视化子代理 (新建)

任务 (6 步, 16 轮):
1. 读 scripts/director-monitor.mjs (工作树已有) + 18 D 项 status
2. 写 server/feishuFeeds.mjs: 每 5 分钟调用 director-monitor -> 写 .superpowers/sdd/director-alerts.log -> 触发飞书 webhook
3. 写 server/feishuCardBuilder.mjs: 构造飞书卡片 (交互式消息模板)
   - 头部: 薯包 · 项目状态 [时间戳]
   - 当前任务: P0-C handle 12px, 进度 75%
   - 最近 commit: 25838b11 V4 P0-2 中文 a11y
   - 截图: 工作树里的 .tmp-nav-xxx.png (现成的 30+ 张)
4. 写 server/feishuDailyReport.mjs: 每天 18:00 推送日报
5. routes: POST /api/feishu/subscribe (用户扫码订阅)
6. 测试 + 部署验证 (用主线程 owner 账号验)
7. commit -F .tmp-anno-verify/commit-msg.txt (feat(feishu): 飞书可视化 (替代聊天机器人))

预期 commit: feat(feishu): 飞书可视化 (替代聊天机器人)
验收: 用户手机端能收到 5 分钟 1 条的进度卡片 + 每天 1 条日报
不许碰: 任何 frontend 改动, 不破坏 DSH

### 3.3 完整执行顺序 (跨 3-6 个月)

| 周 | 子代理 | 任务 | 预计产出 | 用户能感知 |
|----|--------|------|----------|------------|
| W1 (8-28 ~ 9-3) | 主线程 | P0-E 部署 | 12 commit 上线 | 立刻能用上周四就写好的功能 |
| W1 (8-28 ~ 9-3) | #2 | P0-3 LongTaskOverlay commit | 1 commit | 准备下次部署 |
| W2 (9-4 ~ 9-10) | #3 | P0-C handle 12px | 1 commit | 画布连线圈 12px, 不再静默失败 |
| W2-3 (9-4 ~ 9-17) | #4 | P0-B 图片加载慢 | 1 commit | 首页秒开 |
| W3-5 (9-11 ~ 9-28) | #5 | P0-A W5 ffmpeg | 1 commit + 真视频导出 | 视频板块能交付出 mp4 |
| W6-7 (9-29 ~ 10-12) | #6 | P0-D 飞书可视化 | 1 commit | 手机端能看进度 |
| W8-12 (10-13 ~ 11-16) | (后续) | P1-A TTS / P1-B 时间线 / P1-C 改稿对话图标化 / P1-D 模板库 / P1-E 月卡签到 | 5 commit | 视频板块全功能 + 拉平 TapNow |
| W13-24 (11-17 ~ 1-26) | (后续) | P2 / P3 长尾 | 10 commit | 内容运营 + 战略储备 |

### 3.4 测试不破坏承诺 (子代理都遵守)

每个子代理 commit 前必须:
- 跑 node --test test/<自己改的模块>.test.mjs (定向)
- 跑 npm test (全量, 2120+ 起步)
- 跑 npm run check (build 校验)
- 跑 npm run collab:check (协作门禁, 0 peer 冲突)
- 跑 git diff --check (无空白错)
- 跑 npm run verify:video-acceptance (视频门禁, 0 供应商/0 账务)
- 明确不触发付费视频生成 / 不部署

---

## 第四部分: 风险评估

### 4.1 P0 阻塞风险 (按 4c183cd4 关注顺序)

| 风险 | 触发条件 | 影响 | 缓解 |
|------|----------|------|------|
| **DSH 端 modlens:646 patch 重建失败** | 用户用图片批注时 DSH 崩 | 用户不能发图批注 = 跨模型沟通能力断 | P2-B 子代理做, 用户原话不要反复重启 DSH, 做前必须 DSH 关闭 |
| **W5 ffmpeg 渲染性能差** | 5 分钟的视频要跑 30 分钟 | 用户等不及, 商业化卡 | 复用 9225816 P0 媒体底座 + TUS 流式上传, 视频先低码率预览 |
| **图片加载慢优化上线后图片坏** | WebP 转码失败 / srcset 写错 | 案例区白屏, 用户以为网站坏了 | lazy load 留 fallback, 真用 sharp (RTK §4 已禁构建) |
| **飞书卡片超过 25KB 限制** | 截图 base64 太大 | 飞书收不到 | 截图先上传到项目素材库, 卡片只发 URL |
| **1 个多月未部署代码堆积** | 一次部署 12 commit, 失败回滚 | 用户用回 8-23 版本, 信心崩 | 分 2 批部署: 先 P0-3 + P0-C, 再 P0-A + P0-B |

### 4.2 商业化就绪度评估

| 维度 | 当前 (8-28) | 3 月后 (P0+P1 完) | 6 月后 (P0+P1+P2 完) |
|------|--------------|--------------------|-----------------------|
| 视频板块 | 半成品 (W1-W4 完, W5 未做) | 完整 (W5 渲染 + TTS + 时间线) | 完整 + 内容运营 |
| 电商板块 | 完整 (月卡 8 项 + 商品档案) | 完整 (无大改) | 完整 + 跨域导流 |
| 画布体验 | 基础 (V4 P0-2 中文 a11y) | 行业领先 (P0-1 + P0-3 + 模板库) | 行业领先 + 创意社区 |
| 远程协作 | 飞书聊天 (弱) | 飞书可视化 (强) | 飞书 + 图片批注 + DSH 双向 |
| 性能 | 中 (首页 4-5s) | 优 (首页 <2s) | 优 + 持续监控 |
| 账号体系 | 弱 | 弱 | 完整 (找回/多设备) |
| 成本核算 | 中 (admin 看板有) | 中 | 精确 (净贡献列) |

### 4.3 用户的核心抱怨 vs 路线图映射

| 用户原话 | 路线图项 | 解决时间 |
|----------|----------|----------|
| 现在很多体验是不太ok的, 图片加载都特别特别的慢 | P0-B | 1-2 周 |
| 视频板块像 TapNow, 但还差渲染 | P0-A | 2-3 周 |
| 飞书只能聊天, 我要看进度 | P0-D | 4-5 周 |
| 画布连圈点偏就错 | P0-C | 1 周 |
| 账号体系不完整 | P2-D | 3-4 月 |
| 成本核算不准确 | P2-E | 3-4 月 |
| 图片批注丢了 | P2-B | 3-4 月 |
| 商品档案有 bug | 已修 (商品档案 commit) | 已完 |

---

## 第五部分: 交付清单 + 一句话总结

### 5.1 给主线程的交付

1. OK 状态盘点表 (4c183cd4 续命 + 当前, 三栏 + 假完成风险)
2. OK 长期路线图 v1 (20 项, P0-P3, 跨 3-6 个月)
3. OK 子代理委派清单 (6 个子代理 + 完整 prompt 草稿 + 验收标准)
4. OK 风险评估 (DSH 孪生项 / 飞书 / 视频 W5 / 站点体检)
5. 📄 **本报告路径**: F:\\da\\shubao\\.worktrees\\codex-ecommerce-stability\\.superpowers\\sdd\\2026-08-28-dashboard\\2026-08-28-4c183cd4-status-and-roadmap.md

### 5.2 一句话总结 (给用户看)

> **你 8-24 提的 6 大任务, 4c183cd4 续命已 commit 12 个, 工作树里还有 3 个写完没 commit (LongTaskOverlay / director-monitor / video-assets 目录) 等于半成品, 真正没做的是 W5 ffmpeg 渲染 (视频板块卡最后一步) + 飞书可视化 (你还是只能看聊天) + 图片加载慢 (用户每天都被卡) + DSH 端图片批注重建 (跨模型沟通能力还差) + handle 12px 还没人做 (画布连圈会偏)。**

> **接下来 1-2 周内必做 5 件事 (P0)**: 
> 1) 部署 12 个 commit 让你能用到上周的功能
> 2) 提交 LongTaskOverlay 让导出有进度条
> 3) handle 改 12px 让你画布连圈不再错
> 4) 全站图片 WebP 化让你首页秒开
> 5) W5 ffmpeg 让视频真的能导出 mp4。
> 第 6 件是飞书可视化让你出门也能看进度 (1 个月后)。**

> **1 个月后 (P0+P1 完) = 商业化 MVP 完整, 你能正式对外开放。3-6 个月后 (P2+P3) = 内容运营 + 战略储备, 等于护城河。**

---

**写于**: 2026-08-28
**作者**: 4c183cd4 总统筹子代理
**方法**: 三遍+查漏 (读 MEMORY+RTK+V4P0+3 报告 → 写盘点 → 写路线图 → 写委派 → 写风险)
**承诺**: 用户能看懂, 不用技术黑话
**总字数**: 494 行 / ~30 KB (远低于 100 KB 上限)
**子代理委派**: 6 个子代理, 已写好 prompt 草稿, 排好执行顺序, 待主线程派发
**下一步**: 主线程决定是否按路线图派单 / 调整优先级 / 合并子代理 / 跳过某些项
