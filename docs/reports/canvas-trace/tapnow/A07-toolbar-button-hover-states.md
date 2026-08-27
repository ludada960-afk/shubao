# TapNow Action 7 — 工具条按钮 hover 状态

> **时序实测** 2026-08-27 15:15 (Asia/Shanghai)
> **JSON 数据**: [./A07-toolbar-button-hover-states.json](./A07-toolbar-button-hover-states.json)

## 7.1 动作意图

按用户需求测：工具条每个按钮的 hover 状态。

## 7.2 关键发现 — 两种 hover 实现

TapNow 用了 **2 种不同的 hover 实现**，取决于按钮位置：

### 模式 1: 工具条组（左侧 4 按钮）— `group-hover` 覆盖层
- 实现：child `<span class="absolute -inset-0.5 rounded-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-100">`
- 效果：覆盖层 opacity **0 → 1**
- 过渡：200ms (transition-opacity duration-200)
- 颜色：`oklab(0 0 0 / 0.4)` = 深灰 40% 半透明
- 适用按钮：tool-default / hide-edges / grid-snap / reset

### 模式 2: 聊天栏（右侧 3 按钮）— `hover:bg-*` 直接变化
- 实现：直接在 BUTTON 上 `hover:bg-...`
- 效果：背景色 alpha 或 RGB 改变
- 过渡：none（即时切换）
- 适用按钮：chat-add / manual-confirm / model-selector

## 7.3 每个按钮具体状态

| 按钮 | aria-label | 位置 | hover 前 | hover 后 | 过渡 |
|------|-----------|------|----------|----------|------|
| tool-default | (无) | (23, 921) 28x28 | overlay opacity=0 | overlay opacity=1 | 200ms |
| 隐藏节点连线 | 隐藏节点连线 | (59, 921) 28x28 | opacity=0 | opacity=1 | 200ms |
| 网格吸附 | 网格吸附 | (95, 921) 28x28 | opacity=1 (粘滞) | opacity=1 | 200ms |
| 重置 | 重置 | (131, 921) 28x28 | opacity=0 | opacity=1 | 200ms |
| chat-add | 添加 | (1585, 924) 26x26 | bg `oklab(.../0.1)` | bg `oklab(.../0.15)` | none |
| 手动确认 | 手动确认 | (1619, 924) 26x26 | bg `rgba(0,0,0,0)` | bg `oklab(.../0.1)` | none |
| 模型选择 | Gemini 3.7 Flash | (1810, 924) 148x26 | bg `rgba(0,0,0,0)` | bg `rgb(64,64,64)` | none |

## 7.4 设计洞察

1. **左侧工具组用 200ms 渐显** — 工具按钮频繁使用，柔和反馈。
2. **右侧聊天栏用即时切换** — 操作按钮需要明确点击反馈。
3. **无 transform: scale** — 所有 hover 都是颜色/透明度变化，没有缩放。
4. **Tailwind 框架** — 类名 `absolute -inset-0.5 rounded-[10px] opacity-0 transition-opacity duration-200 group-hover:opacity-100` 直接使用 Tailwind utility。
5. **oklab 色彩空间** — 不用 rgb/hsl，用 `oklab(0 0 0 / 0.4)` 这种现代 CSS 色彩。

## 7.5 截图

- `docs/reports/canvas-shots/tapnow-v3/07-hover-results.json` — 完整 hover 状态数据

## 7.6 薯包 v2 启示

1. **模式分组合理** — 频繁操作 vs 决策操作用不同的 hover 强度。
2. **200ms 是 sweet spot** — 快到不打断用户，慢到能感知。
3. **oklab 色彩空间** — 比 rgb 更准确的色彩感知，值得引入。
4. **避免 transform 缩放 hover** — 工具栏的 hover 用纯色彩即可，缩放会显得玩具化。
