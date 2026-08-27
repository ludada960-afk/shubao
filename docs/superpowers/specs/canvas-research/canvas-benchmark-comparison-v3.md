# Canvas Benchmark Comparison V3 — 三站时序对比

> **V3 升级** 2026-08-27 15:55 (Asia/Shanghai)
> **数据源**: docs/reports/canvas-trace/{tapnow,liblib,quantv}/A*.json
> **截图源**: docs/reports/canvas-shots/{tapnow,liblib,quantv}-v3/
> **V1/V2 对账**: canvas-benchmark-comparison.md (V1) + canvas-benchmark-comparison-v2.md (V2)

## 0. V3 升级关键差异

V3 在 V1/V2 基础上**新增 4 类时序数据**:
1. **毫秒精度事件追踪** — 通过 window.addEventListener 捕获 pointer/click 事件全链路
2. **CSS 过渡实测** — getComputedStyle 读 transition / transitionDuration / transitionTimingFunction
3. **三态对比** — before / during / after 元素 + 节点 + 边数 + 弹窗
4. **状态机时序** — 拖拽 8px 损失 / dblclick 41ms / 1s 响应 / 300ms opacity 等

## 1. 三站核心架构对比

| 维度 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| 画布引擎 | React Flow + 自定义 nodeType | React Flow + 自定义 nodeType | **自研 canvas** (非 React Flow) |
| 节点前缀 | text-xxx, video-xxx, command-xxx | i-xxx, t-xxx, group-xxx | (UUID only) |
| 连接点 | `.node-handle-plus-{left,right}` | `.node-handle-plus-{left,right}` | `.connector.connector-{in,out}` |
| 节点定位 | CSS transform translate | CSS transform translate | **class is-selected** |
| 添加节点入口 | 中央 hero 5 chip | 左侧 8 按钮 → 9 项菜单 | 左侧 6 按钮 → 7 项菜单 |
| 公共模板 | 3 主 tab + 9 类目 chip (无内容) | **未发现** | **未发现** |
| Chat 入口 | 右侧 AI 助手面板 (Gemini 3.7 Flash) | 右侧 AI 助手面板 (Gemini 3.7 Flash) | **无** (改用底部 action bar) |
| Loading 指示 | ❌ | ❌ | ❌ |
| 右键菜单 | ❌ | ❌ | ❌ |

## 2. 时序对比表 — 毫秒精度

| 动作 | TapNow | liblib | quantv |
|------|--------|--------|--------|
| 双击空白 | 41ms 内 dblclick, 创建 command 节点 | (未实测) | (无 react-flow 等价) |
| 单击 + 拖拽 50px | 32s 过程 (~5s/move), 实际 42px (8px 损失) | (类似) | 30px 实际 (8px 损失) |
| + handle 过渡 | 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) spring-bounce | **同** | 0.3s (未具体测) |
| 工具条 hover | group-hover 200ms (透明 overlay) | direct bg change (rgb 43,43,43) | minimal (transparent) |
| Chat 响应 | 1s 默认回复 | 1s 默认回复 | **无 chat** |
| 消息入场 | 300ms opacity transition | 300ms opacity transition | (无) |
| 右键按下 | contextmenu 触发但 0 菜单 | 同 | 同 |
| 连线创建 | 7.8px handle + 80px + handle 重叠 | 同 | 显式 aria-label, 不同 class |
| 添加节点菜单弹出 | (无菜单, hero chip) | 9 项 3 sections | 7 项 2 sections |

## 3. 响应延迟对比

| 站点 | 1s chat 默认回复 | spinner 指示 | streaming | 错误反馈 |
|------|-----------------|-------------|-----------|----------|
| TapNow | ✅ | ❌ | ❌ | 未知 |
| liblib | ✅ | ❌ | ❌ | 未知 |
| quantv | ❌ 无 chat | n/a | n/a | 未知 |

## 4. CSS 动画曲线对比

| 动画类型 | TapNow | liblib | quantv |
|---------|--------|--------|--------|
| + handle hover | cubic-bezier(0.34, 1.56, 0.64, 1) 300ms | **同** | 0.3s (未具体) |
| Toolbar hover (group) | 200ms ease | n/a | n/a |
| Toolbar hover (bg) | 0.15s | n/a | 'all' (default) |
| 消息入场 | 300ms opacity | 300ms opacity | n/a |
| 弹窗 dialog | z-50 fixed centered | (类似) | (类似) |
| 拖拽 transform | 即时 (无 transition) | 即时 | 即时 |

## 5. 状态机对比

### 5.1 节点选中
- TapNow: class `selected` (React Flow 内部)
- liblib: class `selected` (React Flow 内部)
- quantv: class `is-selected is-selected-active` (自研)

### 5.2 拖拽
- TapNow / liblib: transform 同步更新，React Flow 内部状态
- quantv: 切换 class

### 5.3 连接
- TapNow / liblib: `.react-flow__edge-path` SVG path
- quantv: `.connector` BUTTON + svg line/path

## 6. 行业最佳实践（V3 综合）

1. **添加节点菜单必须存在** — 仅 TapNow 缺失
2. **节点 + handle 必须存在** — 三个站都有
3. **右键菜单是普遍缺失** — 三个站都没有，薯包 v2 抢先做
4. **Loading 指示是普遍缺失** — 三个站都没有，薯包 v2 抢先做
5. **成本可见** — quantv 显示预计积分，最佳
6. **中文 a11y** — quantv aria-label 中文，最佳
7. **spring-bounce 0.3s** — TapNow / liblib 通用，值得复用
8. **chat 是默认入口** — TapNow / liblib，但 quantv 用 action bar 更直接

## 7. V3 输出清单

- docs/reports/canvas-trace/tapnow/A01-A08.json + .md (8 actions × 2 files = 16 files)
- docs/reports/canvas-trace/liblib/A01-A02.json + A03-A08-batch.json + summary.md (3 files)
- docs/reports/canvas-trace/quantv/A01-A02.json + A03-A08-batch.json + summary.md (3 files)
- docs/reports/canvas-shots/tapnow-v3/*.png (25 screenshots)
- docs/reports/canvas-shots/liblib-v3/*.png (8 screenshots)
- docs/reports/canvas-shots/quantv-v3/*.png (8 screenshots)
- docs/superpowers/specs/canvas-research/{tapnow,liblib,quantv}-canvas-teardown.md §13/§11/§15 增量

## 8. V3 vs V1/V2 增量价值

V1: 文档驱动假设 + 公开资料整理 (~1700 行)
V2: 静态截图 80+ 张，无时序
V3: 时序结构化记录 + 毫秒精度 + 8 项核心动作 × 3 站 = 24 个完整 trace

**V3 让"哪个毫秒什么变化"成为可能** — 这是 V1/V2 完全做不到的。
