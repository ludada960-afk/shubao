# TapNow Action 3 — 节点 + 号（node-handle-plus）

> **时序实测** 2026-08-27 14:40 (Asia/Shanghai)
> **站点**: https://app.tapnow.ai/canvas/38d9f403-7dfb-49af-b83f-7b679c8fdec7
> **账户**: ludada960
> **JSON 数据**: [./A03-node-plus-handle.json](./A03-node-plus-handle.json)

## 3.1 关键发现 — 节点 "+" 实际是连接扩展点

用户问题中的"节点右下 +号" 在 TapNow 中实际是 **`node-handle-plus`** 元素，位于节点的**左右两侧**（不在右下）：

| 位置 | x | y | 尺寸 | class | opacity |
|------|---|---|------|-------|---------|
| 左侧 + | 235 | 469 | 31x31 | `node-handle-plus-left force-hidden` | 0 |
| **右侧 +** | **625** | **469** | **31x31** | `node-handle-plus-right` | 1 |

## 3.2 三态对比

| 状态 | 节点数 | 新节点 | 弹窗 |
|------|--------|--------|------|
| **before** | 2 (text+video) | - | 无 |
| **during** | 2 -> 3 过渡 | - | 无 |
| **after** | 3 (+command) | `command-351ff2bf-7d23-4d7c-8869-9046df26c2a5` | 无 |

## 3.3 事件时序（毫秒）

| t+ms | 事件 | 目标 class |
|------|------|-----------|
| 0 | `pointermove` | `will-change-transform h-20 w-20 rounded-full absolute top-1/2` |
| 1 | `pointerdown` | 同上 |
| 2 | `mousedown` | 同上 |
| 2 | `pointerup` / `mouseup` | 同上 |
| 5 | `click` | 同上 |

5ms 内完成全部 6 个事件 — **纯连接创建，不开任何菜单**。

## 3.4 CSS 过渡

```css
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
animation: none;
```

- **0.3s = 300ms 缓动**
- **`cubic-bezier(0.34, 1.56, 0.64, 1)` = spring-bounce**（轻微回弹）
- 通常用于 hover 时的 transform 缩放

## 3.5 与 V1 §9.2 的对账与修正

| V1 §9.2 假设 | V3 实测 | 差异 |
|-------------|---------|------|
| [+] 媒体/AI/视频/文本/数据/工作流/注释 7 大分类 | **不存在此菜单** | V1 严重高估 |
| 30+ 子项 | 仅 2 个 + 扩展点（左/右） | 数量级偏差 |
| 节点 + = 添加菜单 | 节点 + = 创建连接的 command 节点 | **根本不同** |

## 3.6 真实的"添加节点"入口（V3 修订）

1. **空状态中央 hero 5 chip**（仅画布为空时显示）：文字生视频 / 图片换背景 / 首帧生成视频 / 音频生视频 / 模板
2. **+ 扩展点**（选中节点后）：左右两侧 `node-handle-plus`，创建连接的 command 节点
3. **空白处双击**：创建独立 command 节点（见 Action 1）
4. **素材库抽屉 → 添加**：上传文件/新建文件夹（V2 §10.10）
5. **AI 角色库 → 拖拽角色到画布**（V2 §10.10 推测，未实测）

## 3.7 截图

- `docs/reports/canvas-shots/tapnow-v3/03-tapnow-textvideo.png` — text+video 节点注入后
- `docs/reports/canvas-shots/tapnow-v3/03-plus-00-before.png` — + handle before
- `docs/reports/canvas-shots/tapnow-v3/03-plus-01-during.png` — 点击 100ms
- `docs/reports/canvas-shots/tapnow-v3/03-plus-02-during.png` — 300ms
- `docs/reports/canvas-shots/tapnow-v3/03-plus-03-after.png` — 新 command 节点出现

## 3.8 薯包 v2 启示

1. **不要照抄 TapNow 的 "+" 概念** — TapNow 根本没有"加号菜单"。
2. **真正的"添加节点"心智** = 拖拽 / 模板注入 / 双击空白。
3. **加号作为"快速串联"** 比作为"插入菜单"更符合实际工作流心智。
4. **节点 + handle 的 0.3s spring-bounce** 是值得复用的微动效细节。
