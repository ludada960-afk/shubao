# 画布深度调研 PROGRESS

更新时间: 2026-08-27 11:10
子代理: 画布深度调研长寿命子代理
状态: 5/9 完成（文档框架 + 对比矩阵 + 融合路线；实拍部分等 Chrome 远程调试接入后由续命子代理完成）

## 任务清单

| # | 任务 | 状态 | 备注 |
|---|------|------|------|
| 0 | browse tab list → 0 tabs，写缺失说明 | ✅ | .tmp/browse-tab-missing-instruction.txt |
| 1 | 调研框架 & 6 大类定义 & 对照矩阵 | ✅ | .tmp/canvas-research/canvas-benchmark-comparison.md §1~§3 |
| 2 | tapnow-canvas-teardown.md §1~§9 公共模板 | ✅ | §0~§9 + §7 30+ 截图清单 + §10+ 占位 |
| 3 | liblib-canvas-teardown.md 从零 | ✅ | §0~§9 + §7 33+ 截图清单 + §10+ 占位 |
| 4 | quantv-canvas-teardown.md 从零 | ✅ | §0~§9 + §7 32+ 截图清单 + §10+ 占位 |
| 5 | canvas-benchmark-comparison.md 三表对比 + 融合建议 | ✅ | §1~§7 完整 |
| 6 | 融合建议（薯包 v2 路线） | ✅ | §4 节点/视图/元数据/提交流/多创串联 + §5 V1~V3 + §6 风险 + §7 续命 |
| 7 | 真用户姿态截图 ≥30/teardown | ⏳ | 等 Chrome 远程调试接入（详见 .tmp/browse-tab-missing-instruction.txt）|
| 8 | PROGRESS 终态（X/9 完成） | ⏳ | §7+ 实拍后填，调用 report 工具 |

## 已落盘文件（总计 6 个）

| 路径 | 字节 | 内容 |
|------|------|------|
| .tmp/browse-tab-missing-instruction.txt | ~3.0K | Chrome 远程调试接入指南（方式 A 推荐 + 方式 B 备选）|
| .tmp/canvas-research/PROGRESS.md | 2.7K | 本文件（5/9 + 续命协议）|
| .tmp/canvas-research/tapnow-canvas-teardown.md | 17.5K | §0 速览 + §1~§9 6 大类 + §7 30 张截图清单 + §8 启发 + §9 模板/拖动/串联 + §10+ 占位 |
| .tmp/canvas-research/liblib-canvas-teardown.md | 14.3K | 同上结构，33 张截图清单，含 liblib 特色（采样信息/参数复刻/LoRA）|
| .tmp/canvas-research/quantv-canvas-teardown.md | 12.3K | 同上结构，32 张截图清单，含 quantv 特色（双视图/运镜/故事板）|
| .tmp/canvas-research/canvas-benchmark-comparison.md | 11.1K | 3 大对照矩阵 + 薯包 v2 路线图（V1/V1.5/V2/V2.1/V3）|

## 6 大类（每 teardown 必覆盖）

A. 画布骨架（坐标系 / 缩放 / 平移 / 网格 / 标尺 / 无限画布 vs 有界画布）
B. 节点库 + 加号菜单（节点类型 / 加号子项 / 拖动 / 搜索 / 收藏）
C. 多模态资产（图 / 视频 / 音频 / 文本 / 蒙版 / 参考图 / ControlNet）
D. AI 能力（文生图 / 图生图 / 局部重绘 / 扩图 / 抠图 / 风格迁移 / LoRA）
E. 协作 / 版本 / 撤销 / 多创串联
F. 提交流（导出 / 发送到图生图 / 发送到视频 / 历史任务 / 失败重试）

## 真用户姿态截图清单（每站 ≥30 张，详见各 teardown §7）

- TapNow: 30 项（[PUB] 公共知识 + [SHOT] 真机实拍）
- liblib: 33 项
- quantv: 32 项
- 总计 95 项真机实拍

## 关键发现摘要

### TapNow（节点 = 一等公民）
1. 一切皆节点（图片/视频/文本/AI/数据/工作流）
2. 节点内部是迷你工作区（输入/参数/输出/历史）
3. 提交流 = 节点之间的对话
4. 模板 = 可复用画布快照
5. 实时 CRDT 协作

### liblib（模型/LoRA/采样器 = 一等公民）
1. 高级参数（采样器/VAE/CLIP）拆为独立节点
2. 采样信息存进图片节点（复刻社区核心）
3. JSON 导出 + 一键导入（跨用户复刻）
4. 提示词片段（snippet）参数化
5. 作品流（社区）→ 画布 → 作品流 三方闭环
6. 高清修复是常规操作
7. 多 ControlNet 叠加

### quantv（镜头语言 = 一等公民 + 双视图）
1. 节点视图 + 时间线视图 = 同一份数据两个投影
2. 运镜参数（推/拉/摇/移）显式建模
3. 故事板 = 时间线折叠
4. AI 视频模型多（可灵/通义/Vidu/Sora/豆包）
5. 关键帧蒙版（运动蒙版 = 视频版局部重绘）
6. 项目文件 .quantv 可移植
7. 多创串联偏弱，剧本分镜模板切入

## 薯包 v2 路线（已写入对比文档 §4-§6）

- 核心心智：节点 = 一等公民
- 次级心智：采样信息 = 内置元数据
- 视频专享：镜头语言 = 一等公民
- 不做：实时协作 V1 / 模型独立节点 V1 / 移动端深度 V1
- 阶段：V1 立刻 → V1.5 1月 → V2 3月 → V2.1 4月 → V3 6月

## 续命协议

下一棒子代理读本文件后：
1. `browse tab list`
2. 若仍 0 tabs：先确认 .tmp/browse-tab-missing-instruction.txt；继续等待用户
3. 若 ≥1 tabs（用户已接 Chrome）：
   a. `browse tab switch <tapnow-targetId>` → 跑 tapnow §7 清单
   b. `browse tab switch <liblib-targetId>` → 跑 liblib §7 清单
   c. `browse tab switch <quantv-targetId>` → 跑 quantv §7 清单
   d. 截图保存到 .tmp/canvas-research/shots/<site>/<NN-topic>.png
   e. 补 §10+ 写 screenshot refs
   f. 改 PROGRESS #7 → ✅，#8 → ✅
   g. 调用 report 工具汇报 9/9 完成
4. 每 5 张图更新一次 PROGRESS
5. 关键：续命时务必先读 PROGRESS.md 和各 teardown.md 的 §10+，避免重做
