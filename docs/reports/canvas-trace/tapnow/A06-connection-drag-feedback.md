# TapNow Action 6 — 节点间连线（拖出连接点）

> **时序实测** 2026-08-27 15:05 (Asia/Shanghai)
> **JSON 数据**: [./A06-connection-drag-feedback.json](./A06-connection-drag-feedback.json)

## 6.1 动作意图

从 text 节点的 source handle 拖到 (a) video 节点 target handle（已连接） / (b) 空白区域，观察反馈。

## 6.2 关键发现 — handle 极小 + + handle 干扰

- text 节点 source handle 实际尺寸 **7.8x7.8 px**
- 旁边的 + extension handle 是 **80x80 px**（`.h-20.w-20`）
- 拖拽点稍微偏一点会命中 + handle，**它会创建新 command 节点而不是连线**

## 6.3 Handle 精确位置

| 节点 | 位置 | 类型 | x | y | size |
|------|------|------|---|---|------|
| text | left | target | 208.6 | 476.3 | 7.8x7.8 |
| text | right | source | 709.1 | 476.3 | 7.8x7.8 |
| video | left | target | 719.0 | 481.1 | 7.8x7.8 |
| video | right | source | 1296.2 | 481.1 | 7.8x7.8 |

## 6.4 两次尝试结果

### 尝试 1: text source → video target
- 起 (537, 480) → 终 (723, 485)
- **第一次 pointerdown 命中 `react-flow__resize-control`** (resize handle 覆盖了 source handle 的左半边)
- 32s 内 8 次 pointermove 滑过 svg / h-20 w-20 / node-handle-plus-right
- **没有产生新连线**（已有的 edge 没重复创建）
- 无错误提示，无反弹动画，**静默 no-op**

### 尝试 2: text source → 空白 (900, 600)
- 32s 内 10 次 pointermove
- 释放到空白处
- **没有创建新节点**（与 Action 3 的 + handle 行为不同：+ handle 单独 click 创建节点，drag 到空白不创建）
- `.react-flow__connectionline` 在 drag 中出现，pointerup 后消失

## 6.5 CSS / 行为证据

- **连接线**: `.react-flow__connectionline` 是 SVG path，drag 时跟随指针，pointerup 后消失（如未命中目标）
- **真实连线**: `.react-flow__edge` 含 `.react-flow__edge-path`，bezier 曲线，命中后由 line 升级为 edge
- **无效释放**: line 直接消失，无任何 toast / 抖动 / 颜色提示

## 6.6 与 V1 §9.3 的对账

V1 §9.3 表格: "节点 → 节点 = 创建连线". V3 确认这是唯一创建连线方式，但补充了 3 个细节:
1. **handle 极小** (7.8px) 难以精确命中
2. **+ handle 干扰** (80px 覆盖在 handle 旁边)
3. **命中已连接节点不报错** = 静默 no-op

## 6.7 截图

- docs/reports/canvas-shots/tapnow-v3/06-conn-after.png — 尝试 1 后
- docs/reports/canvas-shots/tapnow-v3/06-conn-empty-end.png — 尝试 2 后（拖到空白）

## 6.8 薯包 v2 启示

1. **handle 应该更大** — TapNow 7.8px 极小，鼠标偏差 1px 就失败。薯包 v2 应该 12-16px。
2. **无效释放应该有反馈** — TapNow 静默 no-op 是糟糕的 UX。薯包 v2 应该有"红色无效提示 + 抖动"。
3. **+ handle 与 connection handle 视觉分离** — TapNow 让它们物理上重叠造成混乱。薯包 v2 应该明确分层。
4. **自动 drag 节奏** — 真用户拖动 50ms 内 5-10 个 move events，自动化测试的 5s/次根本测不出瞬时反馈。
