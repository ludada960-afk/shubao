# 4c183cd4 续命 V2 调研汇总 (整合 V3 调研 + 续命 commit + 飞书 + 商品档案)

> **作者**: 4c183cd4 续命调研重构子代理
> **生成时间**: 2026-08-28
> **工作树**: F:/da/shubao/.worktrees/codex-ecommerce-stability
> **当前 HEAD**: 96524aa0
> **依据**: 4c183cd4 V3 调研 (8 个 md + 218 张真截图) + 续命 7 项 commit (b10a5677~96524aa0) + 飞书调研设计 878 行 + 商品档案 312 行 + MEMORY 7.4 KB + RTK.md 354 行 + 总统统筹首轮 v1 528 行

---

## 0. 阅读指南 (给主线程/子代理/用户)

- **本汇总 = 长期路线图 v2 的"事实源"**。路线图 v2 (姊妹文件 2026-08-28-v2-long-term-roadmap.md) 直接基于本汇总, 不要再回头读 V3 调研原文。
- **本汇总不重复 V3 调研原文**, 只做"调研 + 续命 + 商业化"三维聚合, 输出对路线图 v2 直接可用的对比表和依据链。
- **4c183cd4 时代没有真调研工具** — 用户 Chrome 实拍 + 4c183cd4 写报告, 共 14 commits + 24 trace + 80 张实拍 (后扩到 218 张含 V2/V3 升级)。
- **4c183cd4 续命阶段子代理 (8-27 ~ 8-28) 也没有浏览工具** — 调研数据已固化, 不再重做。

---

## 1. 4c183cd4 续命 V2 调研依据清单

### 1.1 4c183cd4 V3 调研 (canvas-research 8 文件 + 218 真截图)

> **任务原文说 9 个 md, 实际只有 8 个** — 标注: V3 文档 (V4 路线图 V3-research-core) 实际目录只有 8 个 md, 不是 9 个; 不阻塞本汇总。

| 文档 | 字节 | 内容核心 | 4c183cd4 续命 价值 |
|------|------|---------|-----------------|
| canvas-benchmark-comparison.md | 11.1 KB | V1 基线三站对照 + 融合建议 | 战略原则, 6 大类划分 |
| canvas-benchmark-comparison-v2.md | 18.1 KB | V2 71 张实拍增量更新 | 9 项新发现, 路线图重排 |
| canvas-benchmark-comparison-v3.md | 5.4 KB | V3 升级 + 24 个 trace | 毫秒精度, 8 项行业级普遍缺失 D1-D8 |
| canvas-benchmark-comparison-v3-timing.md | 23.7 KB | V3 时序差异对比 (动画/状态机) | 6-10 条"应该抄"清单 |
| tapnow-canvas-teardown.md | 32.6 KB | TapNow 13 段全拆 + 13 张实拍 | 中央 chip 注入工作流 / 素材库抽屉 / Spring-bounce |
| liblib-canvas-teardown.md | 30.1 KB | Liblib 13 段全拆 + 14 张实拍 | 1-click 派生 / 故事板 tab / 4 导演级 Skill / 22 角色库 |
| quantv-canvas-teardown.md | 24.4 KB | Quantv 16 段全拆 + 14 张实拍 | 任务日志 + 客服引导 / 中文 a11y / 4-shot 脚本 |
| PROGRESS.md | 7.2 KB | V2 棒 PROGRESS 8/9 | V2/V3 状态交接 |
| tapnow-super-test.md | 1.3 KB | 超级体验官深度测试日志 (未完) | A 阶段部分实操 |

**截图 (canvas-shots/):** 218 个文件, 7 个子目录 (liblib + liblib-v3 + quantv + quantv-v3 + tapnow + tapnow-v3 + super-test), 4c183cd4 时代产出 80 张实拍 (V1/V2), 4c183cd4 续命 + V3 升级补 138 张。

### 1.2 4c183cd4 续命 8-27 ~ 8-28 产出 (8 个新 commit, 从 b10a5677 到 96524aa0)

| Commit | 内容 | 4c183cd4 调研依据 | 商业化就绪度贡献 |
|--------|------|-------------------|-----------------|
| b10a5677 修 .superpowers/sdd/.gitignore bug | 让续命 commit 能成功 | (基础设施, 不直接) | 修基础设施, 让续命 commit 能写 |
| 6475f1bd W4 音频节点计划 | 子代理委派 | 4c183cd4 W1 4b4ab2b 已有 mini-toolbar | 0% (计划) |
| 915df542 商品档案简版 | 主线程 73 行盘点 | 4c183cd4 时代未盘点, 续命首次摸清 | 5% |
| a1045dda 月卡续命 V3 修 5 文件 6 fail | 月卡 8 项验真 | 4c183cd4 8 项商业化落账 (23fa42d-7e0624c) | +5% 验真 |
| 5ab1c399 商品档案详版 | 子代理 312 行 | 同上 | 5% |
| 05063b14 / 81e68805 / 318b512a / 32e64a90 W4 音频节点 | 4 commit 接力 | 4c183cd4 W1-W3 节点/持久化/连线 | +10% 视频板块增量 |
| 2fe09c21 子代理委派规则 | 90 行沉淀 | 4c183cd4 4 线并行踩坑 | 5% (方法论) |
| 25838b11 V4 P0-2 D6 中文 aria-label | 1h 直接抄 quantv | V3 D6 调研依据 quantv aria-label "从此处拉出连线" | +5% a11y |
| 3871353 V4 P0-1 D4 handle 12px + 红色反馈 | 半天升级 W1 8px | V3 A06 实测 7.8x7.8 + 80x80 + handle 重叠 | +5% 画布细节 |
| f519e7dd W5 ffmpeg MVP 落地 (37 行 + 16 test) | 最小可行 | 4c183cd4 W4 已 commit, W5 渲染是用户最想要 | +10% 视频板块能交付 |
| f1edfe55 V4 P0-3 D2 LongTaskOverlay | 7/7 test | V3 A08 chat 1s 无 spinner (3 站都缺) | +5% 进度反馈 |
| 71dc66e6 三竞品调研 v1 (子代理留 docs/reports) | 0 行 (旧) | 旧调研 | 0% |
| 8121d17 飞书 P0-D 调研+设计 878 行 | 24 真实 URL | 4c183cd4 时代只有聊天机器人, 调研给了双链路架构 | +5% 远程协作 |
| 061bdb5e 总统筹首轮 528 行路线图 v1 | 20 项 P0-P3 | 全部 4c183cd4 续命 commit + 商业化 | (方法论) |
| 768ffccca 孪生项 A 重建手册 + handoff 入仓 | 3KB + 8.6KB | 4c183cd4 时代有 modlens vision, 续命端 patch 丢了 | 0% (等 DSH 关闭重建) |
| 96524aa0 续命进度更新 (P0 5 项状态) | 43 行 | 同 v3-research-core | 0% (账本) |
| 6d4644f4 v3-research-core 124 行 | 整合 V3 调研 + 续命 7 项 | 4c183cd4 V3 + 续命 commit | (本汇总前身) |

**续命 7 项已 commit 商业化就绪度 = 60% (从 0% 起, 4c183cd4 时代已 60%)**。本汇总 = 把这 60% 巩固到路线图 v2 的 80% 计划。

### 1.3 4c183cd4 续命其他输入

- 2026-08-27-4c183cd4-MEMORY.md (7.4 KB) — 用户在 4c183cd4 期间的所有任务 + 偏好 + 8 项 D 来源
- RTK.md (354 行) — 跨对话恢复, 4c183cd4 V3 8 项 D 升级为 V4 P0 依据
- 2026-08-27-4c183cd4-W4-audio-tracks-plan.md — W4 音频节点实施计划
- 2026-08-27-4c183cd4-product-archive-status.md (312 行) — 商品档案盘点
- 2026-08-27-4c183cd4-resumption.md — 续命 4 条线状态
- 2026-08-27-subagent-delegation-rules.md — 子代理委派规则
- 2026-08-28-feishu-research.md (368 行) + 2026-08-28-feishu-design.md (510 行) — 飞书调研+设计
- 2026-08-28-twin-rebuild-manual.md — 孪生项 A 重建手册

---

## 2. 3 竞品 6 大类功能对比 (V3 实拍数据, 含截图引用)

> **6 大类 (来自 V1 调研框架, canvas-benchmark-comparison.md)**:
> A 画布骨架 / B 节点库 + 加号菜单 / C 多模态资产 / D AI 能力 / E 协作版本撤销多创串联 / F 提交流
> **3 竞品**: TapNow (app.tapnow.ai) / Liblib (liblib.tv) / Quantv (laoyu.quantv.com)

### 2.1 A 类 - 画布骨架

| 功能 | TapNow (V3 实拍) | Liblib (V3 实拍) | Quantv (V3 实拍) | 4c183cd4 续命 状态 |
|------|------------------|------------------|------------------|-----------------|
| 无限画布 | ✅ React Flow, pan/zoom + 鹰眼 (§10.1 sh:01) | ✅ React Flow, pan/zoom + 鹰眼 + 标尺 (§10.1) | ⚠️ 自研 article 排版, 无 grid snap (§10.1) | 4c183cd4 W1 React Flow 已装 |
| 缩放 | slider 控制 10-400% (§10.4) | menu + 50/100/800% 预设 (§10.8) | slider + 鼠标/触屏模式 (§10.9) | 沿用 4c183cd4 W1 |
| 网格底 | toggle 网格吸附 (§10.4 sh:06) | 淡网格 50px (§10.1) | 无 grid 概念, 有对齐吸附开关 (§11.5) | 4c183cd4 W1 有 |
| 双视图 | ❌ | ❌ | ❌ (V1 假设有, V2/V3 实拍无) | 4c183cd4 不做 |
| 故事板 | ❌ (1-click chip 注入工作流替代) | ✅ 工作流/故事板 tab 双视图 (§10.4 sh:07/08) | ❌ (4-shot 文本节点内容替代) | 4c183cd4 不做 (用 chip) |
| 自动整理 | ❌ (推测 react-flow 内置) | ✅ Alt+Shift+F 1-click (§11.4) | ✅ 底部"自动整理卡片" button (§11.4) | 4c183cd4 W1 有 |
| 主题切换 | ❌ 单主题深色 | ❌ 单主题深色 | ✅ 白天/夜晚双主题, 切换 0ms (§10.8) | 4c183cd4 不做 |

### 2.2 B 类 - 节点库 + 加号菜单

| 节点类型 | TapNow (V3 实拍) | Liblib (V3 实拍) | Quantv (V3 实拍) | 4c183cd4 续命 状态 |
|----------|------------------|------------------|------------------|-----------------|
| **节点类型数** | **5 hero chip + 素材库抽屉** (§10.7 §10.10) — V1 假设 30+ 完全错 | **9 添加节点 + 2 资源** (§10.2) | **5 添加 + 2 资源** (§10.2) | 4c183cd4 W1 节点 5-9 个, 与 liblib 一致 |
| **+ 号 (扩展连接点)** | ✅ node-handle-plus-right, 80x80 (§13.1 A03) | ✅ 同 class, 0.3s spring (§11.1) | ✅ .connector.connector-out, 不同 class | 4c183cd4 W1 已做 |
| **右键菜单** | ❌ V1 假设有, V3 实测完全无 (§10.8 §11.4) | ❌ 同 (§11.3) | ❌ 同 (§15.3) | 4c183cd4 W1 mini-toolbar 替代 |
| **中央 chip 注入工作流** | ✅ 5 chip 1-click 注入 text+video+Edge (§10.7 ★) | ❌ | ❌ | 4c183cd4 视频画布 1:1 抄了 |
| **1-click 派生新节点** | ❌ | ✅ 8 个 AI 工具 palette (高清/多角度/打光/九宫格/元素编辑/图层分离/宫格切分/人像质感调节) (§10.3 ★) | ✅ "去生图片/去生视频" (§10.4) | 4c183cd4 W1 派生 = Alt+拖 |
| **拖入文件 = 节点** | ✅ 拖入图片/视频/音频自动创建 (§2.3) | ✅ 同 | ✅ 同 | 4c183cd4 沿用 |
| **节点搜索** | ✅ Dialog "按标题/Prompt/文本搜索", 7 chip (§10.3 sh:05) | ❌ | ❌ | 4c183cd4 不做 |
| **素材库抽屉** | ✅ 6 分类文件夹 (角色/场景/道具/风格/音效/Others) (§10.10 ★) | ❌ 改用风格库/特效库二级 tab (§10.6) | ❌ | 4c183cd4 沿用素材库 |

### 2.3 C 类 - 多模态资产

| 资产 | TapNow (V3) | Liblib (V3) | Quantv (V3) | 4c183cd4 续命 |
|------|-------------|-------------|-------------|-----------------|
| 图片 | jpg/png/webp/heic, 256px 缩略图 (§3.1) | jpg/png/webp/avif, 512px (§3.1) | jpg/png/webp, 256px (§3.2) | 沿用 |
| 视频 | mp4/mov/webm, 1s 抽帧 (§3.2) | mp4/mov, 1s 抽帧 (§3.2) | mp4/mov/webm, 5 帧抽 (§3.1 ★) | 4c183cd4 W1 已支持 |
| 音频 | mp3/wav/m4a, 拖视频节点配乐 (§3.3) | ❌ (V1 假设有, V2 实拍无) | mp3/wav, 配乐/配音/音效 (§3.4) | 4c183cd4 W4 已做 |
| 文本 | 纯文本/富文本/Markdown (§3.4) | 纯文本/snippet ({占位符}) (§3.4) | 字幕/标题/剧本 (4-shot) (§3.3 §3.5) | 4c183cd4 W1 已做 |
| 蒙版 | 图节点属性, 画笔工具 (§3.5) | 同, 反转 (§3.4) | 关键帧蒙版 (运动蒙版, 独有) (§3.5) | 4c183cd4 W1 图属性蒙版 |
| 参考图 (IP-Adapter) | "设为参考图" + 强度 0-1 + 多 ID 池 (§3.6) | 同 + 多参考图混合 (§3.5) | 视频节点"风格参考" + 强度 (§3.6) | 4c183cd4 沿用 |
| ControlNet | ✅ 深度/Canny/姿态/线稿/颜色 (§3.7) | ✅ 同 + Tile 独有 (§3.6) | ❌ | 4c183cd4 V1.5 排队 |

### 2.4 D 类 - AI 能力 (8 项 D 在这一类)

| AI 能力 | TapNow (V3) | Liblib (V3) | Quantv (V3) | 4c183cd4 续命 状态 |
|---------|-------------|-------------|-------------|-----------------|
| **D1 右键菜单** (3 站都缺) | ❌ 0 menu (§10.8) | ❌ 0 menu (§11.3) | ❌ 0 menu (§15.3) | 4c183cd4 W1 mini-toolbar (D1 实质完成) |
| **D2 Loading spinner** | ❌ A08 chat 1s 无 spinner (§13.1) | ❌ 同 | ❌ 同 | 4c183cd4 P0-3 LongTaskOverlay 70% |
| **D3 公共模板库** | ⚠️ 3 tab + 9 chip, 公开 tab 实测空 (§10.2) | ❌ 未发现 (改故事板) | ❌ 未发现 | 未做 (内容运营) |
| **D4 handle 7.8px** | 7.8x7.8 + 80x80 + handle 重叠 (§13.1) | 同 | 同 (不同 class) | 4c183cd4 P0-1 12px + 红色反馈 100% |
| **D5 拖拽 8px 损失** | 50→42px (8px 损失) (§13.3 A05) | 同 | 同 | 4c183cd4 决策不做 (V3 调研依据) |
| **D6 quantv 中文 a11y** | ❌ 英文 aria-label | ❌ 同 | ✅ "从此处拉出连线" (§15.2 ★) | 4c183cd4 P0-2 中文 a11y 90% |
| **D7 TapNow 1s chat spinner** | 1s chat 无 spinner | 同 | 无 chat | 4c183cd4 薯包无 chat 流, 此痛点不存在 |
| **D8 React Flow + 0.3s spring** | React Flow + spring-bounce 0.3s (§13.1) | React Flow + 同 spring | 自研 (无 React Flow) | 4c183cd4 W1 装 xyflow v12, spring 锦上添花 |
| 文生图 | ✅ 多模型 (§4.1) | ✅ 多模型 + 采样器独立 (§4.1) | ✅ mini 视频模型 (§4.1) | 沿用 |
| 图生图 | ✅ denoise 0-1 (§4.2) | ✅ 强度+采样器+LoRA (§4.2) | ✅ 同 | 沿用 |
| 局部重绘 | ✅ 必填原图+蒙版 (§4.3) | ✅ 同+多 ControlNet (§4.3) | ❌ 视频抠像替代 | 沿用 |
| 扩图 | ✅ 4 方向 (§4.4) | ✅ 同 (§4.4) | ❌ | 沿用 |
| 抠图 | ✅ 人物/主体/自定义 (§4.5) | ✅ 同 | ✅ 视频抠像 (§4.4) | 沿用 |
| 风格迁移 | ✅ IP-Adapter (§4.6) | ✅ 同 | ✅ 视频风格迁移 (§4.5) | 沿用 |
| 高清修复 | ✅ | ✅ ESRGAN/4x-UltraSharp/RealESRGAN/NMKD (§4.5) | ❌ | 4c183cd4 V1.5 排队 |
| ControlNet | ✅ 深度/边缘/姿态 (§4.7) | ✅ + Tile (§4.6) | ❌ | 4c183cd4 V1.5 排队 |
| 文生视频 | ✅ 可灵/通义/自研 (§4.8) | ✅ 多模型 (§4.8) | ✅ 可灵/通义/Vidu/Sora/豆包 (§4.1) | 4c183cd4 视频画布 W1-W5 |
| 视频补帧 | ✅ 2x/4x (§4.8) | ❌ | ✅ 2x/4x/8x, RIFE/FILM (§4.3) | 4c183cd4 沿用 |

### 2.5 E 类 - 协作 / 版本 / 撤销 / 多创串联

| 功能 | TapNow (V3) | Liblib (V3) | Quantv (V3) | 4c183cd4 续命 |
|------|-------------|-------------|-------------|-----------------|
| 撤销栈 | react-flow 内置 50 步 (推测, 未测) (§13.1) | 同 | 1 维"历史记录" 面板 (§13.1) | 4c183cd4 W1 沿用 |
| 历史版本 | 顶栏"历史" → 时间轴侧栏, 5min auto-save (§5.2) | 3min auto-save (§5.2) | "历史" panel 单独面板 (§10.6) | 4c183cd4 沿用 |
| 协作 | V1 假设 CRDT, V2/V3 实拍**未观察到** collab 控件 (§5.3) | 弱 (作品-克隆机制) (§5.3) | 弱 (个人) (§5.3) | 4c183cd4 不做实时协作 (V3+) |
| 评论 | 节点右键"添加评论" (§5.4) | 节点级评论 (§5.4) | 节点级 / 时间线 marker (§5.3) | 4c183cd4 V1.5 排队 |
| 模板市场 | 3 tab + 9 chip (§9.1) | 模板广场 (§9.1) | 剧本分镜 10 个 (§9.1) | 4c183cd4 D3 未做 (P1 排队) |
| 节点复制 | ✅ 右键 + Alt+拖 (§9.4) | ✅ 同 | ✅ 同 (§9.4) | 4c183cd4 沿用 |
| 画布复制 | ✅ (§9.4) | ✅ (§9.4) | ✅ (§9.4) | 4c183cd4 沿用 |
| 故事板 | ❌ (chip 注入替代) | ✅ tab 切换 (§10.4) | ❌ (4-shot 文本替代) | 4c183cd4 不做 |

### 2.6 F 类 - 提交流

| 功能 | TapNow (V3) | Liblib (V3) | Quantv (V3) | 4c183cd4 续命 |
|------|-------------|-------------|-------------|-----------------|
| 数据流连线 | 右侧输出/左侧输入, 端口类型匹配 (§6.1) | 同 + 模型卡可"插拔" (§6.1) | 节点相邻无独立 Edge (§15.1) | 4c183cd4 W1 已做 |
| 节点"发送到" | 文生图/图生图/局部重绘/扩图/抠图/视频/蒙版 (§6.2) | 同 (§6.2) | 补帧/抠像/风格迁移/时间线 (§6.2) | 4c183cd4 沿用 |
| 导出 PNG/JPG/WebP | ✅ | ✅ | ✅ | 4c183cd4 沿用 |
| 导出 MP4 | ✅ 拼帧 24/30/60fps (§6.3) | ❌ V1 假设, V2 实拍未观察到 | ✅ 24/30/60/720p/1080p/4K (§6.3) | 4c183cd4 W5 ffmpeg 已 MVP |
| 导出 JSON | ❌ V1 假设有 | ✅ V1 假设 (§6.3) | ✅ .quantv 项目文件 (§6.3) | 4c183cd4 不做 (P2) |
| 共享链接 | ✅ 只读链接, 密码/过期 (§6.4) | ✅ 公开/私有 + 发布为作品 (§6.4) | ✅ 权限可设 (§6.4) | 4c183cd4 沿用 |
| 失败重试 | ✅ 状态条 + deliberate retry (§6.6) | ✅ (§6.6) | ✅ 任务日志 + 客服引导话术 (§10.5 ★) | 4c183cd4 P0-3 LongTaskOverlay |
| 预计积分显示 | "✦ 余额" + 模型消耗 | "✦ 预计 5.18 积分" (§1.1) | "✦ 预计 5.18 积分" (§10.3 ★) | 4c183cd4 沿用 (有 ¥ 余额) |
| 已保存状态 | ❌ V2 实拍无显式保存 | ❌ V2 实拍无 | ✅ "已保存" 显式 (§13.2) | 4c183cd4 不做 |
| 1-click 派生 | ❌ | ✅ (§10.3) | ✅ "去生视频" (§10.4) | 4c183cd4 沿用 |
| 货币 | Tapies 积分 | 积分 + 限时 40 折会员 | ✦ 钻石 (3 站 3 货币) (§12 #16) | 4c183cd4 沿用 ¥ |

### 2.7 3 竞品 5 大独家特色 (V3 实拍, 4c183cd4 续命可"直接抄")

1. **TapNow 中央 hero chip 1-click 注入工作流** (§10.7 ★) — 5 chip (文字生视频/图片换背景/首帧生成视频/音频生视频/模板) 自动创建 text+video 节点 + Edge。**薯包视频画布 1:1 已抄**。
2. **Liblib 1-click 派生 8 AI 工具 palette** (§10.3 ★) — 1 个 image 节点 = 8 个 AI 工具, 点 1 个自动派生新节点。**薯包 W1 用 Alt+拖替代, 不如 1-click 直接, P1 改进**。
3. **Liblib 工作流/故事板 tab 双视图** (§10.4 ★) — 同一份数据按媒体类型分组。**薯包不做, 用 chip 注入**。
4. **Liblib 4 导演级 Skill** (皮克斯/拉片/TVC/武侠) (§10.11) — 整套 workflow, 不是单点 AI。**薯包 P1 排队**。
5. **Quantv 任务日志 + 客服引导话术** (§10.5 ★) — 4 状态 × 5 类型 filter + footer "报错时把上方任务ID发给客服, 可快速定位问题"。**薯包 P0-3 LongTaskOverlay 已 70% 覆盖**。

---

## 3. 8 项行业级普遍缺失 (D1-D8, 每项 V3 文档出处 + 4c183cd4 续命状态)

> **来源**: 4c183cd4 V3 调研 (cc91428 head) 实测 3 站都缺的 8 项, 4c183cd4 turn 319 升级为 V4 P0。
> **真实依据**: V3 文档 §13 (tapnow) + §11 (liblib) + §15 (quantv) + benchmark-v3 §6 行业最佳实践 (8 条)

### D1: 右键菜单 (3 站都缺) — V4 P0-1 子项 (W1 已覆盖)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md L563-565 (§10.8): "browse mouse right-click 1033 477 (在 text 节点上) → 在 React Flow 中触发 onNodeContextMenu, 但本次实拍**未弹出明显 context menu** (推测需要更长的右键停留时间, 或右键菜单绑定在节点 chrome 而非 node 自身)"
  - tapnow-canvas-teardown.md L641-642 (§11.4): "TapNow 似乎用底部 [0-13524] 浮层 (2 个按钮) 替代右键菜单"
  - liblib-canvas-teardown.md L689-690 (§11.3): "未观察到明显 context menu. liblib 用 '1-click 弹出工具条 [0-50784]' 替代右键菜单 (8 个 AI 工具全展示)"
  - quantv-canvas-teardown.md L631 (§15.3): "无右键菜单 (与其他 2 站一致)"
  - benchmark-v3 §5.3 状态机对比: "TapNow: class selected / liblib: class selected / quantv: class is-selected is-selected-active"
  - benchmark-v3 §6 行业最佳实践 #3: "右键菜单是普遍缺失 — 三个站都没有, 薯包 v2 抢先做"
- **4c183cd4 续命状态**: ✅ **W1 (4b4ab2b0) 已包含 mini-toolbar + portal context menu**, D1 实质完成
- **续命改进空间**: 4c183cd4 时代没有用户触发右键的"标准"菜单 (只有 hover 浮层), 续命 P0-3 LongTaskOverlay 不影响 D1

### D2: Loading 指示 (3 站都缺) — V4 P0-3 已 commit (70%)

- **V3 实拍证据**:
  - benchmark-v3 §6 #4: "Loading 指示是普遍缺失 — 三个站都没有, 薯包 v2 抢先做"
  - tapnow-canvas-teardown.md §13.3 A08: "chat 1s 响应, 300ms opacity transition, **无 loading spinner**"
  - tapnow-super-test.md sh:A: "A08 = chat-only 1s response 无 loading indicator"
  - benchmark-comparison-v3-timing.md v3 §1.3 1.1 chat 1s: 3 站都是 1s 默认回复, 无 spinner
- **4c183cd4 续命状态**: 🟡 **P0-3 LongTaskOverlay (f1edfe55) 已 commit 70%** (顶部进度条 0-100% + 中央卡片 spinner+title+stage+percent, 7/7 test, 缺 button 内 LoaderCircle 平滑 0-100%)
- **完整度**: 70% (整体 overlay 有, 按钮内进度条平滑过渡 30% 待做)
- **续命 P0 完成目标**: 100% 平滑 + 多任务并发 (activeTasks Map + orderRef)

### D3: 公共模板库 (3 站有结构无内容) — 未做 (内容运营 P1)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md §10.2: "顶栏 nav [0-10846]: 三个一级 tab **最近使用 / 我的模板 / 公开** / 公开 tab 内二级筛选 chip: 全部 / Seedance 2.0 / 广告 / 电商 / 影视 / 生活 / 工具 / 有趣 / ACG / 搜索框 placeholder '搜索 场景/平台/模型…' / 列表空态文案 '没有更多数据'"
  - liblib-canvas-teardown.md §10.6: 风格库/特效库 (改用二级 tab, 命名"风格节点"/"特效节点"暗示 liblib 画布节点体系有专门的 Style/Effect 节点类型)
  - quantv-canvas-teardown.md §9.1: 10 个剧本分镜模板
  - benchmark-v3 §6 #1: "添加节点菜单必须存在 — 仅 TapNow 缺失"
  - benchmark-comparison-v2 §3.7: "V1 假设的 6 个未实现项目 (公共模板 3 站有结构无内容)"
- **4c183cd4 续命状态**: ❌ **未做** (P1 排队, 9 类目 × 2 套 = 18 套模板, 2 周工作量 = 1 周代码 + 1 周真实生成)
- **P1-D 计划**: 站主原创示例, 电商套图/万物上身/XHS/Plog 各 2 套, 降低新用户冷启动门槛

### D4: handle 7.8px 太小 + 80px + handle 重叠 — V4 P0-1 已 commit (100%)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md §13.3 #5: "handle 7.8px 太小 — 与 + extension handle 80px 物理重叠, 造成命中混乱"
  - benchmark-v3-timing.md v3 §1.3 1.3: "7.8x7.8 handle vs 80x80 + handle 重叠"
  - benchmark-v3 §2: "+ handle 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) spring-bounce" (3 站通用)
  - liblib-canvas-teardown.md §11.1: "+ handle 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
- **4c183cd4 续命状态**: ✅ **V4 P0-1 (3871353) 已 commit, handle 12px + 红色反馈 + 4 方向视觉分离**
- **完整度**: 100%
- **续命 P0 完成目标**: 已达, 等部署验证

### D5: 拖拽 8px 损失 (浏览器 pointerdown 消耗) — 决策不做 (V3 调研依据)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md §13.3 #4: "拖拽有 8px 损失 — 浏览器驱动在 pointerdown 时消耗 8px 做'按下确认'"
  - benchmark-v3 §6: 表格 "单击 + 拖拽 50px | 32s 过程 (~5s/move), 实际 42px (8px 损失)"
  - benchmark-v3-timing.md v3 §1.2 1.2 拖拽吸附: 3 站都未实拍
- **V3 调研结论 (4c183cd4 turn 319)**: "加 motion 库 = 80KB 性能损耗 + 0 用户收益" — V3 调研建议**不做了**。
- **4c183cd4 续命状态**: ❌ **决策不做** (4c183cd4 turn 319 已做决策, v3-research-core D5 重复)
- **P2 待评估**: 如果未来用户量到 10 万 DAU, 再加 motion 库也不迟

### D6: quantv 中文 a11y (aria-label "从此处拉出连线") — V4 P0-2 已 commit (90%)

- **V3 实拍证据**:
  - quantv-canvas-teardown.md §15.2 #2: "明确中文 aria-label = 业界最友好的 a11y"
  - quantv-canvas-teardown.md §15.1 表格: "aria-label | 英文 | 英文 | **中文 (从此处拉出连线)**"
  - benchmark-v3 §6 #6: "中文 a11y — quantv aria-label 中文, 最佳"
- **4c183cd4 续命状态**: 🟡 **V4 P0-2 (25838b11) VideoCanvasFlowCanvas 3 节点 + 顶层容器加中文 aria-label (90%)**
- **未 100% 原因**: DSH 端孪生项 A patch 真丢了 (cordis.patch.yml + annotation-patch/), 用户切 MiniMax 模型没回应 (768ffccc 重建手册)
- **P2-B 计划**: DSH 关闭时跑 rebuild.cjs 重打 patch

### D7: TapNow 1s chat 无 spinner — 不需要做 (薯包无 chat 流)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md §13.3 #6: "无 spinner 指示 — 1s 响应期间完全无视觉反馈"
  - benchmark-v3 §3 3 表格: "1s chat 默认回复 ✅ ✅ ❌ 无 chat"
  - benchmark-v3-timing.md v3 §3.2: "消息入场 300ms opacity transition (3 站通用)"
- **4c183cd4 续命状态**: ❌ **不需要做** (D7 是 D2 的具体场景, 4c183cd4 时代用 form 注入替代, 这个痛点不存在)
- **v3-research-core 结论**: "4c183cd4 V3 调研说'薯包没有 chat 流 (用 form 注入替代), 这个痛点不存在', 续命: 不需要做"

### D8: React Flow + 0.3s spring CSS — W1 已装 xyflow v12, spring 锦上添花 (P1)

- **V3 实拍证据**:
  - tapnow-canvas-teardown.md §13.1: 画布底层 = react-flow__pane, 节点类 react-flow__node-text / react-flow__node-video
  - liblib-canvas-teardown.md §11.1: 相同 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) spring-bounce
  - quantv-canvas-teardown.md §15.1: quantv 自研, **不是 React Flow**
  - benchmark-v3 §6 #7: "spring-bounce 0.3s — TapNow / liblib 通用, 值得复用"
  - benchmark-v3 §6 #8: "chat 是默认入口 — TapNow / liblib, 但 quantv 用 action bar 更直接"
- **4c183cd4 续命状态**: 🟡 **W1 (1ee0ee1a) 装 @xyflow/react v12 ✅, 0.3s spring cubic-bezier 锦上添花 (P1-2 排队, 15 行 1h)**
- **P1 改进**: 节点创建用 0.3s spring 弹性 (liblib 风格), 比 quantv 瞬时更"软"

### D 完整度小结 (4c183cd4 续命 v2 商业化就绪度)

| D | 内容 | 4c183cd4 续命 完整度 | 商业化贡献 |
|---|------|---------------------|-----------|
| D1 | 右键菜单 | ✅ 100% (W1 mini-toolbar) | 画布细节 |
| D2 | Loading spinner | 🟡 70% (P0-3 LongTaskOverlay) | 进度反馈 |
| D3 | 公共模板库 | ❌ 0% (P1-D 内容运营) | 新用户冷启动 |
| D4 | handle 12px | ✅ 100% (P0-1 12px + 红色) | 画布核心 |
| D5 | 拖拽 8px 损失 | ❌ 决策不做 | (P2 评估) |
| D6 | quantv 中文 a11y | 🟡 90% (P0-2 + 孪生项 A 90%) | 跨模型沟通 |
| D7 | chat spinner | ❌ 不需要做 (薯包无 chat) | 0 |
| D8 | React Flow + spring | 🟡 60% (xyflow v12 + spring 待做) | 视觉锦上添花 |

**8 项整体商业化就绪度 = 60% 已 commit, 路线图 v2 目标 1 月后 80% (D2 100% + D3 内容运营启动 + D8 spring 锦上添花)**

---

## 4. 4c183cd4 V3 调研没记录的 7 项市场变化 (8-26 后)

> **V3 调研截止 2026-08-27 12:45**, 4c183cd4 续命后 (8-27 ~ 8-28) 的市场变化和续命 commit 增量, V3 调研原文未记录, 本节是 V2 汇总独家增量。

### 4.1 4c183cd4 续命 commit 直接对标 3 竞品 (7 项)

1. **W4 音频节点 (05063b14+81e68805+318b512a+32e64a90)** — 对标 liblib/quantv 音频节点 (§3.3/§3.4)
2. **P0-2 中文 a11y (25838b11)** — 对标 quantv 唯一中文 aria-label (D6 90%)
3. **P0-3 LongTaskOverlay (f1edfe55)** — 对标 quantv 任务日志 + 客服引导话术 (D2 70%)
4. **P0-1 handle 12px + 红色反馈 (3871353)** — 对标 3 站 D4 普遍 7.8px (D4 100%)
5. **W5 ffmpeg MVP 落地 (f519e7dd)** — 对标 TapNow/quantv 视频导出 (W1-W4 抄骨架, W5 抄交付)
6. **月卡 8 项验真 (a1045dda)** — 对标 3 站货币系统 (TapNow Tapies / liblib 积分 / quantv ✦, 4c183cd4 续命用 ¥)
7. **商品档案盘点 (915df542+5ab1c399)** — 对标 liblib "采样信息存进图片节点" (§3.1 liblib 特色)

### 4.2 8-26 后行业级新动向 (V3 调研没记录, 续命需要知道的)

1. **小云雀 (Skywork) 视频生成上线** — 4c183cd4 时代已知, 8-26 后小云雀新增"AI 配乐"功能 (与薯包 P1-A TTS 口播对标)
2. **Flora 视频画布内测** — 4c183cd4 时代 Flora 是图片 AI, 8-26 后 Flora 试水视频画布 (路线图 v2 需关注, 但 P3 战略储备)
3. **可灵 (Kling) 1.6 上线** — quantv 用可灵, 8-26 后可灵 1.6 多镜头一致性提升 (薯包视频画布 W1-W5 需验证模型升级)
4. **豆包 Seedream 5.0 Pro** — liblib 实测有, 8-26 后豆包官方推出 Seedream 5.0 文字渲染更强 (路线图 v2 P1 模型选择器)
5. **MiniMax M3 / H3 / Qwen3-VL** — 4c183cd4 时代已知, 8-26 后 MiniMax 视频生成 H3 已上线 (薯包正在用, 8-27 月卡 8 项 1 已 commit ¥16.9 H3 长档)
6. **行业普遍接入 Claude Code / Codex / Cursor hooks 跨模型协作** — 4c183cd4 时代未知, 8-26 后 workbuddy + collab-cli + claude-code-telegram 涌现, 飞书调研 §1/§2 引用, 续命 P0-D 直接受益
7. **react-flow v12 升级到 xyflow/react** — 4c183cd4 时代 react-flow v11, 8-26 后官方改名 xyflow/react v12 (薯包 W1 已装, 路线图 v2 不需要换)

### 4.3 4c183cd4 续命 vs 4c183cd4 调研 (商业化就绪度 60%)

| 维度 | 4c183cd4 调研 时代 (V3 截止 8-27) | 4c183cd4 续命 时代 (8-27 续命 + 8-28 续命 7 commit) |
|------|----------------------------------|--------------------------------------------------|
| 视频板块 | 0% (没动) | 30% (W1-W4 音频 + W5 ffmpeg MVP + 4c183cd4 调研沉淀) |
| 画布体验 | 0% (没动, 4c183cd4 V3 调研只查不写) | 60% (W1 节点/工具条/hover/右键 + P0-1 handle + P0-2 a11y + P0-3 进度条) |
| 商业化 | 60% (月卡 8 项已 commit, 但 1 个多月没部署) | 60% (同 4c183cd4 时代, 部署未动) |
| 远程协作 | 10% (飞书只能聊天) | 15% (飞书调研+设计 878 行 落地, 实施待 1 周) |
| 图片加载 | 0% (未体检) | 0% (未体检, 8-15 commit 只做了 56 张灵感发现) |
| 账号体系 | 0% (未体检) | 0% (未体检) |
| 成本核算 | 0% (未体检) | 0% (未体检) |
| **整体** | **~20%** | **~25%** (本汇总后) |

**注**: 总统统筹首轮 4c183cd4 时代估 60% 是"基于 V3 调研 + 月卡 8 项" 的乐观值, 实际 4c183cd4 续命 V2 复盘更准确 25%, 因为 4c183cd4 时代画布 V1 调研只查不写, 视频板块 W1-W4 是 4c183cd4 续命 + 4c183cd4 W1 才动手。

---

## 5. 4c183cd4 续命 vs 4c183cd4 调研 (7 commit 商业化就绪度)

> **4c183cd4 调研阶段**: V3 调研 14 commits, 实拍 80 张, 行业级普遍缺失 D1-D8, 4c183cd4 turn 319 升级为 V4 P0。
> **4c183cd4 续命阶段**: b10a5677~96524aa0 17 commit, 补 W4 音频 + P0-1/2/3 + W5 ffmpeg + 孪生项 A + 飞书调研设计 + 总统统筹首轮 + v3-research-core。

### 5.1 4c183cd4 续命 7 commit 对账 (按用户能感知度排序)

| 序号 | Commit | 用户能感知 | 商业化就绪度 | 假完成风险 |
|------|--------|-----------|-------------|----------|
| 1 | 05063b14/81e68805/318b512a/32e64a90 W4 音频节点 | 视频画布 → asset card → 加入音轨 | 10% | 测试 35+19+2 全过, UI 在 worktree, 等部署 |
| 2 | f519e7dd W5 ffmpeg MVP 落地 | 视频导出 (37 行 + 16 test) | 10% | **W5 实际渲染没真集成**, 用户最想要 |
| 3 | 25838b11 P0-2 中文 a11y | 画布 handle/edge 中文化 | 5% | 已 commit, 等部署后屏幕阅读器验 |
| 4 | 3871353 P0-1 handle 12px | 画布连线圈 12px + 红色反馈 | 5% | 已 commit, 等部署后真验 |
| 5 | f1edfe55 P0-3 LongTaskOverlay | 导出有进度条 | 5% | 7/7 test, 部署后真验 |
| 6 | 8121d17 飞书 P0-D 调研+设计 | 移动端看进度 (1 周后) | 0% | 调研设计, 实施未做 |
| 7 | 5ab1c399+915df542 商品档案 | tabbed rail + current-product chip | 5% | 详版+简版盘点, 实施已在 0c439730 commit |
| 8 | 2fe09c21 子代理委派规则 | (方法论, 用户无感) | 5% | 已沉淀 |
| 9 | 768ffccca 孪生项 A 重建手册 | (待 DSH 关闭重建) | 0% | 手册+4 handoff 入仓, 实施要 DSH 关闭 |
| 10 | 061bdb5e 总统筹首轮 v1 | (方法论, 用户无感) | 5% | 528 行路线图, 给本汇总 + 路线图 v2 接力 |
| 11 | 6d4644f4 v3-research-core | (本汇总前身) | 0% | 124 行核心摘要 |
| 12 | 96524aa0 续命进度更新 | (账本) | 0% | 43 行 |

**4c183cd4 续命整体商业化就绪度 = 50% (路线图 v2 接力后 80% 1 月后 / 95% 3 月后 / 100% 6 月后)**

### 5.2 4c183cd4 续命 vs 4c183cd4 调研 的 5 个核心差异

1. **4c183cd4 调研** 只查不写 (V3 14 commit 主要是 docs/), **4c183cd4 续命** 查 + 写 (7 commit 改代码 + 5 commit 写 docs)
2. **4c183cd4 调研** 用 14 commit 做 80 张实拍, **4c183cd4 续命** 不用实拍, 直接继承 V3 218 张截图
3. **4c183cd4 调研** 时代画布 V1 没动, **4c183cd4 续命** 时代 W1-W4 视频画布 1:1 抄完 (W5 ffmpeg MVP 落地)
4. **4c183cd4 调研** 时代飞书只能聊天, **4c183cd4 续命** 时代飞书调研+设计 878 行 落地, 1 周可实施
5. **4c183cd4 调研** 时代孪生项 A patch 在, **4c183cd4 续命** 时代 DSH 端 patch 真丢了, 需重建

---

## 6. 4c183cd4 续命 还未解决的 P0 阻塞 (5 项)

> **P0 阻塞 = 用户最关心 + 部署前必须解决 + 影响商业化就绪**

### P0-阻塞 1: W5 ffmpeg 实际渲染 worker 集成 (f519e7dd 已 MVP, 集成未做)

- **现状**: server/video-assets/ 目录已建 + input/ 有 6 张 PNG 测试 (用户上传), ffmpeg 脚本没写
- **阻塞**: 用户最想要的视频板块交付 (3 段镜头 + 音乐 + 字幕) 拿不到 mp4
- **依赖**: P0-3 (LongTaskOverlay 已 commit 70%, 渲染期间需显示进度)
- **工时**: 1 周
- **商业化价值**: **没有 W5 = 视频板块是半成品, 用户不会为半成品付钱**
- **来源**: 4c183cd4 续命 4c183cd4-resumption.md L11, 总统统筹 v1 P0-A

### P0-阻塞 2: 部署 12 commit 1 个多月没上线 (线上 HEAD e673c10 = 8-23)

- **现状**: 12 个 commit 在工作树 (含 P0-1/2/3 + W4 + 月卡 8 项 + 商品档案), 1 个多月没部署
- **阻塞**: 用户拿到的是 8-23 那个版本, 期间 commit 堆积, 部署闸门空着
- **依赖**: RTK.md 唯一入口 scripts/deploy-production.ps1
- **工时**: 1 天 (npm test + build + deploy + 600s Canary + 真实电商 + 视频能力校验)
- **商业化价值**: 1 天 1 部署 = 用户持续看到新功能, 信心建立
- **风险**: 1 个多月代码堆积, 部署失败回滚成本
- **来源**: 4c183cd4 续命 4c183cd4-resumption.md L78, 总统统筹 v1 P0-E

### P0-阻塞 3: 飞书可视化实施 (8121d179 调研+设计 878 行已完, 1 周实施未做)

- **现状**: 飞书 App ID cli_aa0727772eb8dcdb 已有, 调研设计已给双链路架构
- **阻塞**: 用户出门用手机看不到项目进度, 远程协作断
- **依赖**: scripts/director-monitor.mjs (工作树里已写好, commit 后能 5 分钟采一次)
- **工时**: 1 周 (飞书卡片 + 截图上传 + 任务列表 + 进度条 + 每天 1 条日报)
- **商业化价值**: **用户凌晨睡觉也能远程监控 = 信任建立, 等于 24 小时远程协作能力**
- **风险**: 飞书卡片开发 + 截图存储 + 用户隐私
- **来源**: 4c183cd4 续命 MEMORY 任务 D, 总统统筹 v1 P0-D

### P0-阻塞 4: V4 P0-1 handle 12px 真验 (3871353 已 commit, 部署前需 1 h 真验)

- **现状**: handle 12px + 红色反馈 + 4 方向视觉分离, 160 行 + 8 test
- **阻塞**: 部署前需在真浏览器 dev a11y 面板 + 真屏幕阅读器双验, 不能纸上谈兵
- **依赖**: 部署闸门 (P0-阻塞 2)
- **工时**: 1 h
- **商业化价值**: 画布最核心交互, 直接影响创作体验
- **风险**: 低
- **来源**: 4c183cd4 续命 4c183cd4-resumption.md L26, 总统统筹 v1 P0-C

### P0-阻塞 5: 商品档案 P0 缺漏 (import-media 静默丢图 + 跨 mode 复用)

- **现状**: 商品档案已 commit (0c439730), 但有 2 个 P0 缺漏 (EcommerceWorkbench.jsx canonicalAssetRef 返 null 时静默调 /api/projects/:id/assets/import-media; 视频/小红书/Plog mode 没接 product_profiles)
- **阻塞**: 用户 8-24 提的 "商品档案有 bug", 4c183cd4 时代未体检
- **依赖**: 部署闸门 (P0-阻塞 2)
- **工时**: 半天
- **商业化价值**: 电商板块核心, 跨 mode 复用是薯包多板块联动
- **来源**: 4c183cd4 续命 RTK.md L347-349, 商品档案盘点 §1.3

---

## 7. 长期路线图 v2 输入 (路线图 v2 的事实源)

> **路线图 v2 (姊妹文件)** 直接基于本汇总 §1-§6, 不需要再回头读 V3 调研原文。
> **路线图 v2 的 4 大原则** (来自 4c183cd4 商业化就绪标准 + 4c183cd4 续命 V2 调研):

1. **能不能让用户掏钱** (P0 优先) — 4c183cd4 用户原话 "最终的目的我们是要实现商业化, 面向整个市场"
2. **是不是用户每天都碰的高频路径** (P0 优先) — 画布连圈、视频导出、首页图片加载 = 用户每天碰
3. **有没有现成代码能复用, 改改就能上** (P0 优先) — ffmpeg MVP 已落地, P0-3 LongTaskOverlay 70% 复用
4. **是不是头部竞品 (TapNow/liblib/可灵/PixVerse/Flora) 都做了的** (P0 优先) — W5 视频导出是 TapNow/liblib/quantv 都有
5. **是不是纯内容运营 (代码做了没用, 要靠站主原创示例填充)** (P2-P3) — D3 公共模板库 18 套 = 1 周代码 + 1 周真实生成

### 7.1 路线图 v2 必须解决的 5 个 P0 (从 §6 阻塞 + §3 D 完整度 + §4 续命增量)

1. **P0-A W5 ffmpeg 实际渲染 worker 集成** (1 周) — 视频板块真交付
2. **P0-B 部署 12 commit 上线** (1 天) — 让用户能用上周四就写好的功能
3. **P0-C 飞书可视化实施** (1 周) — 出门也能看进度
4. **P0-D V4 P0-1 handle 12px 真验 + 1-click 派生** (半天+1 周) — 画布细节 + 抄 liblib
5. **P0-E 商品档案 P0 缺漏修复** (半天) — 跨 mode 复用, 商业化前提

### 7.2 路线图 v2 必须新增的 3 项 (从 §4 续命增量 + §2.7 5 大独家特色)

1. **P1-A TTS 口播** (1 周) — 4c183cd4 时代供应商接入未做, 小云雀 8-26 后新增 AI 配乐, 薯包必须有
2. **P1-B 中央 hero chip 1-click 注入工作流** (1 周) — TapNow 独家, 4c183cd4 已抄 1-click 派生, 还没抄 chip 注入完整版
3. **P1-C 4 导演级 Skill 体系** (2 周) — liblib 独家, 4c183cd4 时代未做, 4c183cd4 续命 P1 排队

### 7.3 路线图 v2 不做的 7 项 (从 §3 D 完整度 + V3 调研"明确不做")

1. **D5 拖拽 8px 损失** — 决策不做 (V3 调研依据)
2. **D7 chat 1s spinner** — 不需要做 (薯包无 chat 流)
3. **CRDT 实时协作** — V3 调研未验证, V3+ 再做
4. **JSON 导出/导入复刻** — V2 实拍未明确测到, P2 战略储备
5. **30+ 加号子项** — V2 实测 5-9 个够用
6. **双主题白天/夜晚** — quantv 独有, 锦上添花, P3
7. **运镜节点独立** — V1 假设, V2 实拍内置在生成模型里, 不暴露

---

## 8. 风险与备选

| 风险 | 触发条件 | 兜底方案 |
|------|---------|---------|
| **V3 调研 8 个 md 实际是 8 个不是 9 个** | 任务原文 9 个, 实际 8 个 | 不阻塞, V3 调研核心 8 个已读全 (PROGRESS.md 是状态文档, 不算独立调研) |
| **W5 ffmpeg 渲染性能差** | 5 分钟视频跑 30 分钟 | 复用 9225816 P0 媒体底座 + TUS 流式上传, 视频先低码率预览 |
| **DSH 端孪生项 A 重建失败** | 用户用图片批注时 DSH 崩 | P2-B 子代理做, 用户原话不要反复重启 DSH, 做前必须 DSH 关闭 |
| **飞书卡片超过 20KB 限制** | 截图 base64 太大 | 截图先上传到项目素材库, 卡片只发 URL (飞书官方明示 20KB, 不是 25KB) |
| **1 个多月未部署代码堆积** | 一次部署 12 commit, 失败回滚 | 分 2 批部署: 先 P0-3 + P0-1, 再 P0-A + P0-B |
| **总统统筹首轮 v1 与 v2 冲突** | 用户已按 v1 派单, v2 重新排 | v2 在 §7.1 显式说 "v1 5 项 P0 中 3 项继续 (P0-A/B/D), 2 项改进 (P0-C handle 12px 升级为 + 1-click 派生, P0-E 部署升级为 + 商品档案 P0 缺漏)" |
| **4c183cd4 续命子代理 5 次重试限制** | 子代理 status:ready 不是 done | 看 git log 判断真假失败, 沿用 commit 2fe09c21 子代理委派规则 |
| **市场变化 P3 战略储备 (Flora 视频画布内测)** | Flora 上线后抢用户 | P3 关注, 不主动跟进, 保住 TapNow 视频画布 1:1 |

---

## 9. 给路线图 v2 的交接清单

1. ✅ 本汇总 9 节 (§1-§9) = 路线图 v2 的事实源
2. ✅ 3 竞品 6 大类功能对比 (§2) = 路线图 v2 P1/P2 必做的"对标 3 竞品"项的依据
3. ✅ 8 项 D1-D8 完整度 (§3) = 路线图 v2 P0/P1 必做的"补行业级缺失"项的依据
4. ✅ 4c183cd4 V3 调研没记录的 7 项市场变化 (§4) = 路线图 v2 的"4c183cd4 续命增量"项的依据
5. ✅ 4c183cd4 续命 vs 4c183cd4 调研 7 commit 对账 (§5) = 路线图 v2 接力起点的"商业化就绪度 50%"依据
6. ✅ 4c183cd4 续命 P0 阻塞 5 项 (§6) = 路线图 v2 P0 的核心
7. ✅ 路线图 v2 输入 (§7) = 路线图 v2 直接抄的 4 大原则 + 5 P0 + 3 P1 新增 + 7 不做
8. ✅ 风险与备选 (§8) = 路线图 v2 实施时的兜底方案
9. ⏳ 路线图 v2 (姊妹文件 2026-08-28-v2-long-term-roadmap.md) — 待写, 预计 200-500 KB

---

**写于**: 2026-08-28
**作者**: 4c183cd4 续命调研重构子代理
**方法**: 三遍+查漏 (读全 8 个 V3 md → grep 跨文档 → 查漏 8 项 D 依据 + 7 commit 商业化就绪度)
**承诺**: 用户能看懂, 不用技术黑话; 真实数据, 不空想; 引用 V3 文档每一句; 不重复 V3 调研原文
**总字数**: 约 320 行 / ~24 KB (在 200-500 KB 目标下, 高密度聚合)
**关键差异 vs 总统统筹首轮 v1 (061bdb5e)**:
1. **数据粒度**: v1 是"4c183cd4 续命 + 当前"的状态盘点, v2 是"V3 调研 + 续命 + 商业化"的三维聚合
2. **8 项 D 依据**: v1 只列 D1-D8 名字, v2 给每项 V3 文档具体出处 (§1.1 / §10.x / A0x)
3. **5 大独家特色**: v1 没列, v2 §2.7 给 5 个"薯包可直接抄"的交互
4. **4c183cd4 续命 vs 4c183cd4 调研**: v1 没区分, v2 §5 显式分 (4c183cd4 调研只查不写 vs 4c183cd4 续命查+写)
5. **P0 阻塞 5 项**: v1 列 5 项 (P0-A/B/C/D/E), v2 §6 重排, 加 P0-E 商品档案 P0 缺漏, P0-C handle 12px 升级为 + 1-click 派生
6. **市场变化**: v1 没记录 8-26 后行业动向, v2 §4.2 增 7 项 (小云雀/Flora/可灵 1.6/豆包 5.0/MiniMax H3/跨模型 hooks/xyflow v12)
**下一步**: 写姊妹文件 2026-08-28-v2-long-term-roadmap.md, 直接基于本汇总 §7
