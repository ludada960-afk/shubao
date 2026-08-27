# TapNow Action 1 — 双击画布空白

> **时序实测** 2026-08-27 14:25 (Asia/Shanghai)
> **站点**: https://app.tapnow.ai/canvas/293277aa-5287-46c8-be5a-3ff5a66efb60
> **账户**: ludada960（v2.13.22，未触发任何生成/扣费）
> **JSON 数据**: [./A01-dblclick-empty-canvas.json](./A01-dblclick-empty-canvas.json)

## 1.1 动作意图

在画布空白区域（避开已有节点的 800,700）执行双击，观察 TapNow 是否会触发 V1 假设的"自由生成"节点创建。

## 1.2 三态对比

| 状态 | 节点数 | 边数 | 弹窗 | elementFromPoint(800,700) | 备注 |
|------|--------|------|------|---------------------------|------|
| **before** | 2 (text+video) | 1 | 0 | `react-flow__pane selection` | 由 V2 chip 注入产生的 text→video 工作流 |
| **during** | 2→3 过渡中 | 1 | 0 | `react-flow__pane selection` | 41ms 内完成 2 次单击 + dblclick |
| **after** | 3 (+command) | 1 | 0 | `react-flow__pane selection` | 0x0 大小的新 command 节点出现 |

## 1.3 事件时序（毫秒精度）

| t+ms | 事件 | 目标 | 备注 |
|------|------|------|------|
| 0 | `pointermove` | pane | 鼠标移入空白 |
| 1 | `pointerdown` | pane | 第 1 次按下 |
| 7 | `mousedown` | pane | DOM 事件 |
| 8 | `pointerup` / `mouseup` | pane | 第 1 次松开 |
| 9 | `click` | pane | 浏览器合成的第 1 次 click |
| **12** | `pointerdown` | pane | **第 2 次按下（间隔 11ms）** |
| 15 | `mousedown` / `pointerup` / `mouseup` / `click` | pane | 第 2 次合成的 click 簇 |
| **41** | `dblclick` | pane | **浏览器判定为双击（比第 2 次 click 晚 23ms）** |
| 41 | `pane:dblclick` | pane | React Flow pane 自身也收到 dblclick |

> **关键延迟**: 两次 pointerdown 间隔 12ms，dblclick 总窗口 41ms（远低于浏览器 500ms 双击阈值）。

## 1.4 新节点细节

| 字段 | 值 |
|------|----|
| type | `command` |
| id | `command-0ff16cde-caaf-421c-807e-1eb59751c862` |
| 位置 | (801, 699) — 精确命中点击点 |
| 尺寸 | 0x0（折叠占位态） |
| classes | `react-flow__node react-flow__node-command selectable` |
| transition | `all` |
| animation | `none`（无入场动画） |
| transform | `matrix(1, 0, 0, 1, 180, 1755)` — 通过 viewport 变换定位 |

## 1.5 与 V1 §11.3 的修正

V1 §11.3 假设"双击=创建自由生成节点，但需要模型空闲"。V3 实测证明：

- **总是触发**（不需要模型空闲）—— 测试时模型是 Gemini 3.7 Flash，但 dblclick 立即创建节点。
- **类型是 `command` 不是 `text`** —— 这是 TapNow 专有的指令节点类型，区别于 text/video/image 节点。
- **初始 0x0 尺寸** —— 节点创建后是折叠占位，需要进一步点击展开/输入内容。
- **无入场动画** —— 不像普通节点的 hover 缩放或 selected lift 动画。

## 1.6 与 V2 §11.3 的对账

V2 实拍描述双击"未出现新节点，推测需要模型空闲"。V3 重做确认：
- V2 当时空白区可能命中了 react-flow 的 selection 区域
- V3 在 (800, 700) 远离 V2 已创建的 text/video 节点的位置（它们在 1008,452 附近）执行
- 因此 V3 创建成功 —— **位置避开现有节点是触发条件**，不是模型状态。

## 1.7 截图

- `docs/reports/canvas-shots/tapnow-v3/01-dblclick-00-before.png` — 双击前（2 节点）
- `docs/reports/canvas-shots/tapnow-v3/01-dblclick-01-after.png` — 双击后（3 节点，含新 command）
