# quantv Actions 1-8 — 综合时序调研

> **时序实测** 2026-08-27 15:50 (Asia/Shanghai)
> **JSON 数据**: [./A01-A02-add-node-panel.json](./A01-A02-add-node-panel.json), [./A03-A08-batch.json](./A03-A08-batch.json)

## 1. 添加节点菜单 (Action 1+2)

点击左侧 第 1 个按钮 添加 (26, 346) 弹出：

| 分类 | 项目 |
|------|------|
| **添加节点** | 文本 / 图片 / 视频 / 音频 / 应用 |
| **添加资源** | 从本地上传 / 从资产库选择 |

总共 7 项。比 liblib 简单，没有 3D / 辅助工具。

## 2. 关键发现 — quantv 是**非 React Flow 自研画布**

| 维度 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| 画布引擎 | React Flow | React Flow | **自研** |
| 节点 class | `react-flow__node-text` | `react-flow__node-text` | `canvas-node is-text-node` |
| + handle | `node-handle-plus-right` | `node-handle-plus-right` | `connector connector-out` |
| 拖拽位移存储 | CSS transform | CSS transform | **class is-selected** |
| 选中态 | class `selected` | class `selected` | class `is-selected is-selected-active` |

## 3. Action 3-8 关键结果

| Action | 结果 | 备注 |
|--------|------|------|
| A03 + connector | 无新节点 | connector 只是连接端点 |
| A04 右键 | **0 个菜单** | 三个站都没有右键菜单 |
| A05 拖拽 | 30px 实际 (请求 50px) | 8px 损失，**与 TapNow 一致** |
| A06 连线 | 无新连接 | 拖到空白处失效 |
| A07 工具条 hover | 背景透明 | quantv 的 hover 几乎无变化 |
| A08 chat 发送 | **无 chat** | quantv 用底部 action bar 配模型/格式 |

## 4. quantv 独特设计

1. **无 chat** = 直接在画布上配置生成参数 (模型/格式/时长/价格)
2. **明确的中文 aria-label** = `从此处拉出连线` (从此处拉出连接) — accessibility 友好
3. **拖拽用 class 而非 transform** = `is-selected is-selected-active` 类切换
4. **底部 action bar** = 模型 + 9:16 15s 720p + 1次 + 预计 5.18 积分 — 直接显示成本

## 5. 三站综合对比

| 维度 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| 添加节点 | 5 hero chip | 9 项菜单 | 7 项菜单 |
| + handle | 有 | 有 | 有 (不同 class) |
| 右键菜单 | ❌ | ❌ | ❌ |
| 拖拽 | OK | OK (部分 miss) | OK |
| chat 入口 | 有 | 有 | ❌ (改用 action bar) |
| loading 指示 | ❌ | ❌ | ❌ |
| 工具条 hover | group-hover 200ms | direct bg change | minimal change |

## 6. 截图

- docs/reports/canvas-shots/quantv-v3/00-baseline.png — 初始画布
- docs/reports/canvas-shots/quantv-v3/01-add-panel.png — 添加节点菜单
- docs/reports/canvas-shots/quantv-v3/03-connector.png — + connector
- docs/reports/canvas-shots/quantv-v3/04-rclick.png — 右键无菜单
- docs/reports/canvas-shots/quantv-v3/05-drag.png — 拖拽 30px
- docs/reports/canvas-shots/quantv-v3/06-connection.png — 连线
- docs/reports/canvas-shots/quantv-v3/07-hover.png — 工具条 hover
- docs/reports/canvas-shots/quantv-v3/08-action-bar.png — 底部 action bar

## 7. 薯包 v2 启示

1. **三个站都没做右键菜单** = 行业普遍缺失，薯包 v2 抢先做就是差异化。
2. **三个站都没做 loading 指示** = 行业普遍缺失，薯包 v2 抢先做就是差异化。
3. **chat vs action bar** = 两种生成入口设计，薯包 v2 应该混合（chat 询问 + 画布配参数）。
4. **明确的中文 aria-label** = quantv 的 a11y 最好，值得学习。
5. **成本可见** = quantv 显示预计 5.18 积分，是最佳实践。
