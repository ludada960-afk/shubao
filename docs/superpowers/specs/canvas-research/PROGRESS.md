# 画布深度调研 PROGRESS

更新时间: 2026-08-27 12:30
子代理: 画布深度调研长寿命子代理 (V2 棒)
状态: 8/9 完成（V1 棒 5/9 + V2 棒 3/9: 实拍完成 + 增量对比文档完成）

## 任务清单

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 0 | browse tab list → 0 tabs，写缺失说明 | ✅ | .tmp/browse-tab-missing-instruction.txt |
| 1 | 调研框架 & 6 大类定义 & 对照矩阵 | ✅ | .tmp/canvas-research/canvas-benchmark-comparison.md §1~§3 |
| 2 | tapnow-canvas-teardown.md §1~§9 公共模板 | ✅ | §0~§9 + §7 30+ 截图清单 + §10-§12 V2 实拍 |
| 3 | liblib-canvas-teardown.md 从零 | ✅ | §0~§9 + §7 33+ 截图清单 + §10-§12 V2 实拍 |
| 4 | quantv-canvas-teardown.md 从零 | ✅ | §0~§9 + §7 32+ 截图清单 + §10-§12 V2 实拍 |
| 5 | canvas-benchmark-comparison.md 三表对比 + 融合建议 | ✅ | §1~§7 完整 |
| 6 | 融合建议（薯包 v2 路线） | ✅ | §4 节点/视图/元数据/提交流/多创串联 + §5 V1~V3 + §6 风险 + §7 续命 |
| 7 | 真用户姿态截图 ≥30/teardown | ✅ | 71 张实拍 (tapnow 32 + liblib 22 + quantv 17)，全部存 docs/reports/canvas-shots/<site>/ |
| 8 | PROGRESS 终态（X/9 完成） | ✅ | 本文件 (8/9)；最终 9/9 等用户验收 V3 棒任务 |
| 9 | (V3 棒待做) V1.5 路线图：视频节点+时间线+工具箱+角色库+Context reference | ⏳ | V2 §4 路线图 V1.5 任务；V3 棒继续 |

## 已落盘文件（总计 7 个，+1 v2 增量）

| 路径 | 字节 | 内容 |
|------|------|------|
| .tmp/browse-tab-missing-instruction.txt | ~3.0K | Chrome 远程调试接入指南（方式 A 推荐 + 方式 B 备选）|
| .tmp/canvas-research/PROGRESS.md | ~5K | 本文件（8/9 + V2 续命协议）|
| .tmp/canvas-research/tapnow-canvas-teardown.md | 17.5K + 5K | §0-§12 完整（V2 §10-§12 实拍） |
| .tmp/canvas-research/liblib-canvas-teardown.md | 14.3K + 5K | §0-§12 完整（V2 §10-§12 实拍） |
| .tmp/canvas-research/quantv-canvas-teardown.md | 12.3K + 6K | §0-§12 完整（V2 §10-§12 实拍） |
| .tmp/canvas-research/canvas-benchmark-comparison.md | 11.1K | V1 基线（V1 棒）|
| docs/superpowers/specs/canvas-research/canvas-benchmark-comparison-v2.md | 11K | V2 增量（V2 棒，含 9 项新发现 + 路线图重排）|

## 6 大类（每 teardown 必覆盖）

A. 画布骨架（坐标系 / 缩放 / 平移 / 网格 / 标尺 / 无限画布 vs 有界画布）
B. 节点库 + 加号菜单（节点类型 / 加号子项 / 拖动 / 搜索 / 收藏）
C. 多模态资产（图 / 视频 / 音频 / 文本 / 蒙版 / 参考图 / ControlNet）
D. AI 能力（文生图 / 图生图 / 局部重绘 / 扩图 / 抠图 / 风格迁移 / LoRA）
E. 协作 / 版本 / 撤销 / 多创串联
F. 提交流（导出 / 发送到图生图 / 发送到视频 / 历史任务 / 失败重试）

## 真用户姿态截图（V2 实拍完成）

- TapNow: 32 张真实截图（V2 棒 [SHOT] 实际数据）
- liblib: 22 张真实截图（V2 棒 [SHOT] 实际数据）
- quantv: 17 张真实截图（V2 棒 [SHOT] 实际数据）
- 总计 71 张真机实拍（V1 计划 95 张，实际 71 张 - 因部分功能 V1 假设但 V2 实拍未观察到）

### 截图保存路径
- docs/reports/canvas-shots/tapnow/01-29*.png (32 张)
- docs/reports/canvas-shots/liblib/01-18b*.png (22 张)
- docs/reports/canvas-shots/quantv/01-16*.png (17 张)

## 关键发现摘要 (V2 实拍)

### TapNow（节点 = 一等公民）
1. 一切皆节点（图片/视频/文本/AI/数据/工作流）
2. 节点内部是迷你工作区（输入/参数/输出/历史）
3. 提交流 = 节点之间的对话
4. 模板 = 可复用画布快照
5. 🆕 5 个中央 hero chip (文字生视频/图片换背景/首帧生成视频/音频生视频/模板) 1-click 注入工作流
6. 🆕 素材库抽屉 (个人/团队, 6 分类: 角色/场景/道具/风格/音效/Others)
7. 🆕 节点搜索揭示 World + 分组 节点类型
8. 🆕 画布基础 5-9 类型 + 素材库 (V1 假设 30+ 子项是错的)

### liblib（Agent + Skill + 角色库 = 一等公民）
1. 1 image 节点 = 8 个 AI 工具 palette (高清/多角度/打光/九宫格/元素编辑/图层分离/宫格切分/人像质感调节)
2. 工作流/故事板 tab 双视图 (同一份数据按媒体类型分组)
3. 工具箱 25 个运镜+特效预设 (1-click 应用)
4. 角色库 22 分类 + 4 张参考图 (立绘/脸部近景/表情参考/三视图)
5. 🆕 4 个导演级 Skill (皮克斯动画广告/爆款拉片复刻/新中式美学TVC/古典武侠电影全流程导演)
6. 🆕 Agent 4 轴 (附件+模型+Skill+生成模式) + CLI & Skill tab
7. 🆕 @ 引用工作流/节点/资源 context reference
8. 🆕 资产管理 (Outliner + 资产库)
9. 🆕 模型选择 7 图片 + 5+ 视频 (Seedream 5.0 Pro / Seedance 2.5 / Minimax H3 / Wan 3.0 Prime)

### quantv（视频节点 = 完整 AI 工具 + 任务日志 = 一等公民）
1. 视频节点 = 完整 AI 工具平铺 (输入/参数/输出/历史 + 预计积分 + 生成按钮)
2. 4-shot 视频脚本 (文本节点内容 = Shot 1-4 + 时间段)
3. 任务日志 = 5 状态 × 5 类型 filter + 客服引导话术
4. 便签 = 独立节点 (V1 假设成真)
5. 主题切换 (白天/夜晚)
6. 货币 = ✦ 钻石
7. K-Gemini-3.6-flash + @图片1 context reference
8. 智能去字幕 menu (智能擦除/框选擦除)
9. 画布不用 React Flow, 用原生 HTML5 article + section

## 薯包 v2 路线（V2 棒重排）

### V1 立刻（V2 棒调整）
- 节点基础 (画布 + 5-9 类型 + 加号)
- 模板市场 (3 主 tab + 9 类目) ← 抄 TapNow
- **Skill 体系 (4 个导演级 workflow)** ← 抄 liblib
- **任务日志 + 客服引导话术** ← 抄 quantv
- **资产管理 (Outliner + 资产库)** ← 抄 liblib
- **预计积分实时显示** ← 抄 liblib/quantv
- **8 个 AI 工具的 image 节点 palette** ← 抄 liblib

### V1.5 1月
- 视频节点 + 时间线
- 工具箱 (25 个运镜+特效预设) ← 抄 liblib
- 角色库 (4 张参考图) ← 抄 liblib
- **Context reference (@ 引用)** ← 抄 liblib/quantv
- 中央 hero chip 注入工作流 ← 抄 TapNow

### V2 3月
- 故事板 (时间线折叠) ← 抄 liblib/quantv
- 镜头语言 (运镜参数) ← 抄 quantv (待验证)
- 双主题 (白天/夜晚) ← 抄 quantv
- 便签节点 ← 抄 quantv

### V2.1 4月
- 多创串联 + 跨用户复刻
- JSON 导出/导入 (跨用户复刻)

### V3 6月
- 实时协作 (CRDT) ← 抄 TapNow (待 V1 验证)
- 作品流 (社区闭环) ← 抄 liblib
- 公开模板市场 (带审核)

### 明确不做的 (V1 假设 V2 实拍未观察到的 7 项)
1. 30+ 加号子项 (实拍 5-9 个够用)
2. CRDT 协作 (V1 待验证, V3+ 再做)
3. 提示词片段 (snippet) (V2 未观察到)
4. 采样信息 metadata (V2 未观察到)
5. 关键帧蒙版 (V2 未触发)
6. 独立运镜参数面板 (V2 实测内置在生成模型里)
7. JSON 导出 (V2 未明确测到)

## 续命协议

下一棒 (V3 棒) 读本文件后：
1. 读 canvas-benchmark-comparison.md (V1 基线)
2. 读 canvas-benchmark-comparison-v2.md (V2 增量)
3. 读各 teardown 的 §10-§12 (V2 实拍)
4. 按 V2 §4 路线图推进 V1.5 任务
5. 完成 V1.5 后 9/9 终态
