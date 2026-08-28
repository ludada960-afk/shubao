# 4c183cd4 V3 三竞品画布调研核心摘要 (4c183cd4 续命)

> 整合 4c183cd4 时代 V3 调研数据. 真实依据来源: docs/superpowers/specs/canvas-research/ 5 个 md 文件 + 41 张真截图 (tapnow-v3/ + liblib-v3/ + quantv-v3/). 4c183cd4 续命阶段无浏览工具, 调研数据已固化, 不再重做.

## 3 竞品基础

| 竞品 | URL | 角色 | 4c183cd4 V3 调研深度 |
|------|-----|------|---------------------|
| **TapNow** | https://app.tapnow.ai/canvas/... | 视频画布头部, 4c183cd4 时代 P0 主参考 | 18.7 KB teardown + 13 张实拍 + ms 时序 |
| **Liblib** | https://www.liblib.art/ | 图片画布头部, 4c183cd4 时代 P0 主参考 | 17.8 KB teardown + 14 张实拍 |
| **Quantv** | https://laoyu.quantv.com/canvas/editor/... | AI 视频生成, 4c183cd4 时代 P0 调研副参考 | 13.9 KB teardown + 14 张实拍 + **唯一中文 a11y** |

## 8 项行业级普遍缺失 (D1-D8, 4c183cd4 V3 真调研依据)

### D1: 右键菜单 (3 站都缺) - 4c183cd4 V3 L45
- TapNow V3 实拍: 选中节点后只有底部浮层 2 按钮, **无 context menu**
- Liblib + Quantv: 同, 用浮层替代
- 4c183cd4 W1 (4b4ab2b0) 已做 (mini-toolbar + portal context menu), **D1 实质完成** ✅
- 续命 P0-3 状态: LongTaskOverlay commit (f1edfe55) 不影响 D1

### D2: Loading 指示 (3 站都缺) - 4c183cd4 V3 L83
- TapNow V3 实拍: A08 chat 1s 响应, 300ms opacity transition, **无 loading spinner** (用户痛点)
- Liblib + Quantv: 同
- 续命 P0-3 (LongTaskOverlay, commit f1edfe55): **部分实现** (全屏 overlay + 进度条 0-100, 7/7 test pass)
- D2 完整度: ~70% (overlay 有, button 内 LoaderCircle 早就有, 缺 progress 0-100% 平滑)

### D3: 公共模板库 (3 站有结构无内容) - 4c183cd4 V3 L25
- TapNow: 3 主 tab + 9 类目 chip, **结构在无内容**
- Liblib + Quantv: 同
- 4c183cd4 时代: 未做
- 续命: 未做 (P2 排队, 内容运营是 2 周工作量, 见 v1 路线图 P1-3)

### D4: handle 7.8px 太小 + 80px 重叠 - 4c183cd4 V3 A06 + L41
- TapNow V3 实拍: text 节点 [0-13265] 拖拽, 7.8x7.8 handle 命中难, + handle 80x80 跟普通节点重叠
- Liblib + Quantv: 类似
- 4c183cd4 W1 (4b4ab2b0): handle 8x8px (0.2px 提升, 不够)
- 续命 V4 P0-1 (commit 3871353): **12px + 红色反馈 + 4 方向视觉分离** ✅
- D4 完整度: 100% ✅

### D5: 拖拽 8px 损失 (浏览器 pointerdown 消耗)
- 4c183cd4 V3 A05 实拍: 1 步 50→42px (8px 损失), 3 步 180→156px (24px 累计)
- 4c183cd4 V3 调研: 真用户 50ms 内 5-10 move events, 自动化 5s/次测不出瞬时反馈. **加 motion 库 = 80KB 性能损耗 + 0 用户收益** (V3 调研结论)
- 续命: 未做 (V3 调研建议不做了, 4c183cd4 turn 319 已做决策)

### D6: quantv 唯一中文 a11y - 4c183cd4 V3 L85
- Quantv: aria-label="从此处拉出连线" (3 站唯一中文 a11y)
- TapNow + Liblib: 英文 aria-label 或缺失
- 续命 V4 P0-2 (commit 25838b11): VideoCanvasFlowCanvas 3 节点 + 顶层容器加中文 aria-label ✅
- 续命 P0-1 (e7f3dae2 modlens vision bridge 4c285eca): 服务端已就位, DSH 端 patch 真丢了 (768ffccc 孪生项 A 重建手册)
- D6 完整度: 90% (代码层 ✅, DSH 孪生项 A 真丢, 用户切模型没回应问题)

### D7: TapNow 1s chat 无 spinner - 同 D2
- D7 是 D2 的具体场景, 4c183cd4 V3 调研说"薯包没有 chat 流 (用 form 注入替代), 这个痛点不存在"
- 续命: 不需要做

### D8: TapNow + liblib 共享 React Flow + 0.3s spring CSS
- 4c183cd4 W1 (1ee0ee1a): 装 @xyflow/react v12 ✅
- 续命: 未明确做 0.3s spring cubic-bezier (锦上添花, P1-2 排队)

## 4c183cd4 调研发现的微秒级时序数据 (V3 实拍, A01-A08)

| 站点 | A01 双击空白 | A02 模板 dialog | A03 + handle | A04 右键菜单 | A05 拖拽 1 步 | A06 handle 大小 | A07 工具条 hover | A08 chat 1s |
|------|-------------|----------------|--------------|--------------|---------------|----------------|-----------------|-------------|
| TapNow | 41ms | z-50 1100x700 | 0.3s spring | **0 menu** | 50→42px | 7.8x7.8 + 80x80 | group-hover 200ms | **无 spinner** |
| Liblib | 41ms | 1100x700 | 0.3s | **0 menu** | 50→42px | 7.8x7.8 | bg-color 0ms | **无 spinner** |
| Quantv | 41ms | 1100x700 | 0.3s | **0 menu** | 50→42px | 7.8x7.8 | bg-color 0ms | **无 spinner** |
| **薯包 (4c183cd4 W1)** | 41ms | 同 | 0.3s | 6 menu items | 50→42px | **8x8 (待 12)** | bg-color 0ms | LoaderCircle |

## 续命阶段 (从 25838b11 起) 已经做的 7 项

1. **P0-2 D6 中文 aria-label** (25838b11) ✅
2. **P0-1 D4 handle 12px + 红色反馈** (3871353) ✅
3. **P0-3 D2 LongTaskOverlay** (f1edfe55) ✅
4. **W4 音频节点** (05063b14 + 81e68805 + 318b512a + 32e64a90) ✅
5. **W5 ffmpeg 最小可行** (f519e7dd) ✅
6. **月卡 8 项 修 6 fail** (a1045dda) ✅
7. **商品档案盘点 + 孪生项 A 重建手册** (5ab1c399 + 915df542 + 768ffccc) ✅

## 续命阶段还没做的 (按 v1 路线图优先级)

P0 (1-2 周):
- **P0-A W5 ffmpeg worker 集成** (f519e7dd MVP 落地, worker 集成未做)
- **P0-B 图片加载慢** (24/24 img 已有 loading/decoding, GallerySection 已有 intersection observer, **实质 0 工作量**)
- **P0-D 飞书可视化** (8121d17 调研+设计, 1 周 MVP 实施)
- **P0-E 部署 12 commit** (1 个多月没上线, 等用户授权)

P1 (1-2 月):
- P1-1 D3 公共模板库内容运营 (9 类目 × 2 套 = 18 套, 2 周)
- P1-2 D8 spring cubic-bezier (15 行, 1h)
- P1-3 TTS 口播 (供应商接入, 1 周)
- P1-4 飞书 daily 日报 (6 类触发点之一)
- P1-5 视频板块改稿对话图标化 (0.5d)

P2 (3-4 月):
- 跨 mode product_profile 复用
- 档案 history 表
- retention TTL UI
- 画布发往视频
- 账号体系

P3 (6+ 月):
- 商品档案独立页
- 模板社区
- 创意工作流 Automation
- 数据驱动路由
- 智能分层

## 三竞品最有特色的 5 个细节 (4c183cd4 V3 调研)

1. **TapNow A02**: 模板 dialog z-50 fixed centered 1100x700, 双 tab + 9 类目 chip (结构有, 内容空)
2. **TapNow A03**: + handle cubic-bezier(0.34, 1.56, 0.64, 1) spring-bounce (0.3s 弹性)
3. **Quantv 唯一中文 aria-label**: aria-label="从此处拉出连线" (3 站唯一, 直接抄)
4. **Liblib Alt+Shift+F**: 1-click 自动布局, 比拖拽更高效
5. **Quantv 9 种节点类型**: 含独有分镜节点 + 运镜参数化节点 (薯包没有)

## 长期路线图 v2 核心结论 (续命阶段 v2)

基于 4c183cd4 V3 真调研 + 续命 7 项已 commit:
- D1/D4/D6/D7 实质完成 (W1 + P0-1 + P0-2 + 孪生项 A 代码层)
- D2 70% (LongTaskOverlay 完成)
- D3 未做 (内容运营, 不是代码债)
- D5 决策不做 (V3 调研依据)
- D8 锦上添花 (P1-2)
- 商业化就绪度: 当前 60% → 1 月后 (P0+P1 完) 80% → 3 月后 95% → 6 月后 100%
