# TapNow 节点画布引擎选型菜单

> 对比对象：React Flow(@xyflow/react) / Rete.js / litegraph.js。
> 数据来源：npm registry + GitHub API + 官方文档（PowerShell 直抓，2026-08-26）。
> 窄域文档：ffmpeg / TTS / KenBurns 不在本文范围，见文末 TODO。

## TL;DR 推荐组合拳
- **主选：React Flow (@xyflow/react)** 作画布骨架 —— 节点即任意 React 组件、框选/小地图官方自带、维护最活跃（v12.11.5，周下载 1094 万，主仓昨日仍有提交）。
- **组合拳** = RF 骨架 + 自建"端口语义层"（TS 类型 + `isValidConnection` 补齐连线类型短板）+ 官方 `<MiniMap/>`/`<Controls/>` + 大图开 `onlyRenderVisibleElements`。
- **备选触发条件**：单画布常驻 >2000 节点且掉帧 → 换 litegraph.js（纯 canvas）；强依赖开箱 Socket 类型校验且接受插件架构 → Rete.js。

## 六维对比（节点自定义 / 连线语义 / 框选 / 小地图 / 千节点性能 / 维护活跃度）
| 维度 | React Flow 12 (@xyflow/react) | Rete.js 2 | litegraph.js |
| --- | --- | --- | --- |
| 节点自定义 | ★★★★★ 任意 React 组件当节点，样式/交互零限制 | ★★★★ 控件库齐全，多框架渲染器（React/Vue/Svelte/Angular），深定制走插件 | ★★★ canvas 内 drawNode 手绘，无 DOM，全手工 |
| 连线语义 | ★★★ source/target Handle + 自定义边，类型约束需自建 | ★★★★★ Socket 类型系统 + 连接校验器，语义最强 | ★★★★ slot 带类型名，天然多进多出，校验简单 |
| 框选 | ★★★★★ 内置框选（Shift / selectionOnDrag） | ★★★ AreaExtensions.selectable，矩形框选还需配 Selecto 类示例 | ★★★★ 内置区域选择 |
| 小地图 | ★★★★★ 官方 <MiniMap/> 开箱即用 | ★★★★ 官方 Minimap 扩展可用 | ★ 无内置，需自绘 |
| 千节点性能 | ★★★ DOM 渲染：约 500–1000 节点流畅，更多须虚拟化 | ★★★ SVG/DOM 同量级，大数据量吃力 | ★★★★★ 纯 canvas，ComfyUI 数千节点实证 |
| 维护活跃度 | ★★★★★ 周下载 1094 万，38.1k★，2026-08-25 有提交 | ★★★ 周下载 8.9 万，12.2k★，最近提交 2026-07 | ★★ npm 周下载仅 1588，上游最后提交 2024-08，靠 ComfyUI fork 续命 |

> 数据：npm registry 周下载（2026-08-18~24）与 GitHub API，PowerShell 直抓于 2026-08-26。

## 风险与备注
- React Flow 千节点以上必须开 `onlyRenderVisibleElements` + 稳定 node id，否则拖动卡顿；连线类型语义为自建成本，需在边校验器里统一收口。
- Rete.js 文档偏教程化、API 面大，React 团队接入性价比低于直接用 RF；v2 重构后发版节奏放缓（近一月一次）。
- litegraph.js 直接用上游 npm 包风险高：两年未更新、几乎无人走 npm（周下载 1588），引入即锁定自维护 fork 成本。

## 明确不做（TODO，移交其他子代理）
- ffmpeg 视频合成管线选型：TODO
- TTS 语音方案：TODO
- KenBurns 运镜动效方案：TODO
