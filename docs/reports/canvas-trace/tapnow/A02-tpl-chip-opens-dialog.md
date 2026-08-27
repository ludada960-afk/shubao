# TapNow Action 2 — 中央"模板" chip 弹窗

> **时序实测** 2026-08-27 14:30 (Asia/Shanghai)
> **站点**: https://app.tapnow.ai/canvas/38d9f403-7dfb-49af-b83f-7b679c8fdec7 (新建的画布 1)
> **账户**: ludada960
> **JSON 数据**: [./A02-tpl-chip-opens-dialog.json](./A02-tpl-chip-opens-dialog.json)

## 2.1 动作意图

在画布中央 hero 区点 模板 chip，观察弹出内容结构。

## 2.2 关键发现 — z-index 命中问题

**react-flow__pane (z-index: 1, position: absolute) 覆盖了 hero card**。直接 `browse mouse click 1105 527` 命中的是 pane，不会触发 chip。

```
chip parent chain: 固定 (i=6) → 全屏 (i=7) position: relative
pane:           absolute, z-index: 1
```

由于 hero 父链没有 z-index，它和 pane 在同一个 stacking context 中，pane z=1 反而更高。

**解决方法**: `el.click()` 在 DOM 层直接调用 chip 的 clickable parent（`w-full h-full flex items-center justify-center cursor-pointer` DIV）。

## 2.3 三态对比

| 状态 | hero 可见 | 弹窗 | 节点数 | 备注 |
|------|-----------|------|--------|------|
| **before** | 是 | 无 | 0 | 新建画布，空状态 |
| **during** | 是 | 弹出中 | 0 | dialog 渐入（100ms / 300ms 截图采样） |
| **after** | 否 | z-50 居中 | 0 | dialog 完全显示 |

## 2.4 弹窗内容（实测）

### 弹窗框架
| 字段 | 值 |
|------|----|
| Title | 我的模板 |
| 尺寸 | 1100×700 px |
| 位置 | 居中 fixed，z-index: 50 |
| 关闭按钮 | Close @ (1546, 162) — 右上英文 Close |
| 搜索框 | placeholder "搜索 场景/平台/模型…" |
| 空态文案 | 没有更多数据 |

### 三主 tab
| tab | x | y | 状态 |
|-----|---|---|------|
| 最近使用 | 526 | 159 | 默认选中 |
| 我的模板 | 526 | 199 | 备选 |
| 公开 | 502 | 251 | 备选 |

### 九个类目 chip
| chip | y |
|------|---|
| 全部 | 291 |
| Seedance 2.0 | 331 |
| 广告 | 371 |
| 电商 | 411 |
| 影视 | 451 |
| 生活 | 491 |
| 工具 | 531 |
| 有趣 | 571 |
| ACG | 611 |

## 2.5 与 V2 §10.2 的对账与修正

| 维度 | V2 §10.2 | V3 实测 | 一致？ |
|------|----------|---------|--------|
| 3 主 tab | 最近使用 / 我的模板 / 公开 | 相同 | ✅ |
| 9 类目 chip | 全部 / Seedance 2.0 / 广告 / 电商 / 影视 / 生活 / 工具 / 有趣 / ACG | 相同 | ✅ |
| 搜索框 | placeholder "搜索 场景/平台/模型…" | 相同 | ✅ |
| 空态 | 没有更多数据 | 相同 | ✅ |
| 关闭按钮位置 | 弹窗中部 (V2 §10.2 [0-10724]) | 右上 (1546, 162) | ❌ V2 错 |
| 公开 tab 顺序 | 第 2 个一级 tab | **第 3 个**（最近使用/我的模板/公开） | ❌ V2 错 |
| 类目 chip 顺序 | Seedance 2.0 是第一个 filter | Seedance 2.0 是**第二个**（全部第一） | ⚠ 部分 |

## 2.6 截图

- `docs/reports/canvas-shots/tapnow-v3/02-tpl-00-before.png` — 空画布 + hero
- `docs/reports/canvas-shots/tapnow-v3/02-tpl-01-during-100ms.png` — dialog 100ms 渐入
- `docs/reports/canvas-shots/tapnow-v3/02-tpl-02-during-300ms.png` — 300ms
- `docs/reports/canvas-shots/tapnow-v3/02-tpl-03-after.png` — dialog 完全展开
- `docs/reports/canvas-shots/tapnow-v3/02-tpl-dialog.png` — 最终
