# liblib Actions 1-8 — 综合时序调研

> **时序实测** 2026-08-27 15:35 (Asia/Shanghai)
> **JSON 数据**: [./A01-A02-add-node-panel.json](./A01-A02-add-node-panel.json), [./A03-A08-batch.json](./A03-A08-batch.json)

## 1. 添加节点面板 (Action 1+2 等价)

点击左侧工具条第 1 个按钮 (42, 335) 弹出结构化菜单：

| 分类 | 项目 | 描述 |
|------|------|------|
| **添加节点** | 文本 | 脚本、广告词、品牌文案 |
| | 图片 | 宣传图、海报、封面 |
| | 视频 | 宣传视频、动画、电影 |
| | 音频 | 音乐、配音、音效 |
| | 3D | 生成 3D 场景与对象 |
| **辅助工具** | 时间轴 (Beta) | 时间轴串联多段素材 |
| | 3D 片场 | 布置场景、角色与镜头调度 |
| | 图片编辑器 | 编辑和处理图片 |
| **添加资源** | 上传 | 支持图片、视频、音频和 3D 资产 |

## 2. 关键发现 — liblib 实现了 V1 §9.2 的"+ 加号菜单"

**liblib 有 9 个分类项目，加 3 个 section**。这正是 V1 §9.2 假设的 "[+] 媒体/AI/视频/文本/数据/工作流/注释 7 大分类 30+ 子项"。但 liblib 的实现比 V1 假设更聚焦：
- 5 种基础节点 (文本/图片/视频/音频/3D)
- 3 种辅助工具 (时间轴/3D 片场/图片编辑器)
- 1 种资源入口 (上传)

## 3. 与 TapNow 关键对比

| 维度 | TapNow | liblib |
|------|--------|--------|
| 添加节点入口 | 中央 hero chip (5 个) | 左侧工具条 添加节点 (9 项菜单) |
| + handle | 有 (左右) | 有 (左右) — **完全相同** |
| 右键菜单 | 无 | 无 |
| 拖拽 | OK | OK (相同 React Flow 引擎) |
| 连线 | OK | OK |
| 工具条 hover | group-hover overlay 200ms | 直接 bg change (rgb 43,43,43) |
| 发送消息 | 1s 默认回复 | 1s 默认回复 |
| loading 指示 | 无 | 无 |

## 4. 共享技术栈证据

两个站点的 + handle 都有相同的 CSS:
```
transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
```

这是 React Flow + 自定义 node-handle-plus 组件的**通用样式**。两个站可能 fork 了同一个 React Flow 扩展。

## 5. 截图

- docs/reports/canvas-shots/liblib-v3/00-baseline.png — 初始画布
- docs/reports/canvas-shots/liblib-v3/01-add-node-panel.png — 添加节点菜单
- docs/reports/canvas-shots/liblib-v3/03-plus-handle.png — + handle
- docs/reports/canvas-shots/liblib-v3/04-rclick.png — 右键无菜单
- docs/reports/canvas-shots/liblib-v3/05-drag.png — 拖拽
- docs/reports/canvas-shots/liblib-v3/06-connection.png — 连线
- docs/reports/canvas-shots/liblib-v3/07-toolbar-hover.png — 工具条 hover
- docs/reports/canvas-shots/liblib-v3/08-after-enter.png — chat 响应

## 6. 薯包 v2 启示

1. **真正的"+ 加号菜单"** = liblib 的 9 项分类，TapNow 没有。
2. **React Flow 通用样式** = + handle spring-bounce 0.3s，两个站一样。
3. **右键菜单** = 都没有。薯包 v2 应该补齐。
4. **loading 状态** = 都没有 spinner。薯包 v2 必须有。
5. **菜单设计选择** = liblib 用详细描述 (文本/脚本/广告词/品牌文案)，TapNow 用 1-2 字短词 (文字生视频)。liblib 的更友好。
