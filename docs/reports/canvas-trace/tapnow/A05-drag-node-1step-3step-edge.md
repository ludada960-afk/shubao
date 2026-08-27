# TapNow Action 5 — 拖动节点 1 步 / 3 步 / 边缘

> **时序实测** 2026-08-27 14:55 (Asia/Shanghai)
> **JSON 数据**: [./A05-drag-node-1step-3step-edge.json](./A05-drag-node-1step-3step-edge.json)

## 5.1 动作意图

按用户需求测：拖动节点 1 步（50px） / 3 步（180px） / 拖到边缘，验证是否有吸附行为。

## 5.2 三段拖拽实测

| 阶段 | 起点 | 终点 | 请求位移 | 实际位移 | transform |
|------|------|------|----------|----------|-----------|
| 初始 | (268, 323) | - | 0 | 0 | translate(702.637px, 393.68px) |
| 1 步 | (430, 485) | (480, 485) | +50px | +42px | translate(735px, 390px) |
| 3 步 | (480, 485) | (660, 485) | +180px | +156px | translate(855px, 390px) |
| 拖到左边缘 | (628, 480) | (350, 480) | -278px | -254px | translate(660px, 390px) |

## 5.3 关键时序数据（1 步拖拽完整记录）

| t+ms | 事件 | x | y |
|------|------|---|---|
| 0 | pointermove + mousemove | 430 | 485 |
| 0 | pointerdown + mousedown | 430 | 485 |
| 5015 | pointermove | 435 | 485 |
| 10071 | pointermove | 440 | 485 |
| 15079 | pointermove | 445 | 485 |
| 20088 | pointermove | 450 | 485 |
| 25101 | pointermove | 455 | 485 |
| 30104 | pointermove | 460 | 485 |
| 32145 | pointermove | 465 | 485 |
| 32158 | pointermove | 470 | 485 |
| 32171 | pointermove | 475 | 485 |
| 32190 | pointermove | 480 | 485 |
| 32191 | pointerup + mouseup | 480 | 485 |

关键观察：浏览器驱动每 ~5s 发送一次 pointermove，1 步拖拽总耗时 32 秒。

## 5.4 实际位移与请求位移的偏差

| 阶段 | 请求 | 实际 | 损失 | 损失率 |
|------|------|------|------|--------|
| 1 步 | 50px | 42px | 8px | 16% |
| 3 步 | 180px | 156px | 24px | 13% |
| 拖到边缘 | -278px | -254px | 24px | 9% |

8px 损失假设 = 浏览器驱动在 pointerdown 时有 1-2 像素的初始偏移，且第一次 pointermove 之前 React Flow 内部要消耗几像素做"按下确认"。

## 5.5 边缘行为

- 拖到 x=212（视口），画布 sidebar 0-340 px 之外
- 节点直接覆盖在 sidebar 之上——没有边界约束、没有反弹、没有隐藏
- 这是 TapNow 的真·无限画布心智：节点可以放到任何位置

## 5.6 吸附行为

- 未发现任何 snap line（.react-flow__snapline 不存在）
- 未发现 implicit grid snap（位移不整除任何明显的栅格）
- V2 §10.4 提到画布底部有"网格吸附" toggle 按钮，但当前关闭
- 即使开启网格吸附，V3 未实测，无法确认是 8px / 16px / 32px 哪种栅格

## 5.7 状态存储

- 节点位置存储在 CSS transform (style.transform = 'translate(660px, 390px)')
- 不是 React state，但 React Flow 内部用 controlled state 同步
- 拖拽过程中直接修改 transform 样式，无明显 transition

## 5.8 截图

- docs/reports/canvas-shots/tapnow-v3/05-drag-step1.png — 1 步后
- docs/reports/canvas-shots/tapnow-v3/05-drag-step3.png — 3 步后
- docs/reports/canvas-shots/tapnow-v3/05-drag-edge.png — 拖到边缘 (失败)
- docs/reports/canvas-shots/tapnow-v3/05-drag-edge2.png — 拖到边缘 (成功)

## 5.9 薯包 v2 启示

1. 真无限画布 = 无边界约束 — TapNow 不限制节点位置，可以放任何地方。
2. 吸附是可选的 — 默认关闭，需要用户主动 toggle。
3. 拖拽驱动延迟 ~5s/次 — 自动化测试时需要注意节奏。
4. CSS transform 定位 — 简单可靠，但不便于复杂动画。
