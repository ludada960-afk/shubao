# TapNow Action 4 — 各类型节点右键菜单全集

> **时序实测** 2026-08-27 14:45 (Asia/Shanghai)
> **JSON 数据**: [./A04-rclick-on-each-node-type.json](./A04-rclick-on-each-node-type.json)

## 4.1 动作意图

按节点类型分别测右键菜单：text / video / command / 空白区。

## 4.2 关键发现 — 右键完全被压制

**所有 3 种节点类型 + 空白区域，右键都触发 contextmenu 事件但无任何 UI 弹出。**

## 4.3 三类节点实测对比

| 节点类型 | 坐标 | 命中元素 | contextmenu 触发 | 菜单出现 |
|---------|------|----------|------------------|----------|
| **text** | (430, 485) | `<P>` 文本内容 | 是 (47ms 内) | ❌ |
| **video** | (1011, 485) | `<path>` SVG | 是 (2ms) | ❌ |
| **command** | (602, 493) | `w-px h-px` (1x1 占位) | 是 | ❌ |
| **空白 pane** | (800, 700) | react-flow__pane | 是 | ❌ (V3 Action 1/2 已测) |

## 4.4 时序详情

### text 节点 (text-d6f0994e-...)
```
pointermove btn:-1   t+0    (悬停准备)
pointerdown  btn:2   t+45   (45ms 后按下右键)
mousedown    btn:2   t+46
pointerup    btn:2   t+46
mouseup      btn:2   t+46
contextmenu          t+47   (浏览器默认事件)
=> 47ms 内全部完成，无菜单
```

### video 节点 (video-6684ce44-...)
```
pointermove  t+0
pointerdown btn:2  t+0
mousedown   btn:2  t+1
pointerup   btn:2  t+2
mouseup     btn:2  t+2
contextmenu         t+2
=> 2ms 内全部完成，无菜单
```

### command 节点 (command-351ff2bf-...)
```
1. 左键单击选中 (47ms)
2. 等待 2.2s 确认选中
3. 右键单击 (同样无菜单)
```

## 4.5 与 V1/V2 的对账

| 文档 | 描述 | V3 实测 |
|------|------|---------|
| V1 §10.5 节点右键 | 假设有 | **不存在** |
| V1 §11.4 右键菜单 | 假设有 | **不存在** |
| V2 §10.8 节点右键 | 描述未出现 React Flow context menu | **V3 确认**（3 节点类型 + 空白都验证） |
| V2 §10.8 替代方案 | 底部 [0-13524] 浮层 (2 按钮) | **V3 确认**（更准确的描述 = 选中节点后底部浮层） |

## 4.6 CSS / 行为根因

- contextmenu 事件**确实触发了**（不是 preventDefault 阻止）
- 但 React Flow + TapNow **没有 onContextMenu 处理器** 渲染菜单
- 这是一个**设计选择**而非 bug：TapNow 用其他 affordance 替代右键

## 4.7 真实的节点操作入口（V3 修订）

| 操作 | 入口 |
|------|------|
| 选中节点 | 左键单击 |
| 移动节点 | 拖拽 |
| 扩展连接 | 左右 `node-handle-plus` (Action 3) |
| 节点操作 | 选中后**底部浮层 2 按钮**（打开/删除，V2 §10.8） |
| 删除节点 | ???（V3 也未找到 delete 入口，键盘 Delete 不响应） |
| 复制节点 | ???（未测出） |
| 编辑节点内容 | 双击节点本体进入编辑 |

## 4.8 截图

- `docs/reports/canvas-shots/tapnow-v3/04-rclick-text.png` — text 节点右键后无菜单
- `docs/reports/canvas-shots/tapnow-v3/04-rclick-video.png` — video 节点右键后无菜单
- `docs/reports/canvas-shots/tapnow-v3/04-rclick-command.png` — command 节点右键后无菜单

## 4.9 薯包 v2 启示

1. **右键菜单是缺失的** — TapNow 没有实现，应作为基础 affordance 加上。
2. **底部浮层是替代** — 但只对选中节点可见，不在右键时出现，是次优设计。
3. **节点操作分散** — 选中+底部浮层+双击 才是完整交互流，认知成本高。
4. **薯包 v2 应该实现完整右键菜单** = 重命名 / 复制 / 删除 / 移到前面 / 移到后面 / 复制 ID / 查看属性。
