# TapNow Action 8 — 生成按钮 loading / complete 时序

> **时序实测** 2026-08-27 15:25 (Asia/Shanghai)
> **JSON 数据**: [./A08-generate-button-loading-complete-timing.json](./A08-generate-button-loading-complete-timing.json)

## 8.1 动作意图

测生成按钮的 loading → complete 状态时序。

## 8.2 关键发现 — 没有专门的"生成"按钮

**TapNow 画布没有"生成/Run/Start"按钮。** 唯一的触发入口是：
- 聊天输入框 (按 Enter 或点击右上角 ↑ 按钮)
- 中央 hero 5 个 chip (注入节点但**不立即生成**，需后续手动触发)
- 节点 + handle (创建连接节点，**也不立即生成**)

## 8.3 发送按钮状态时序

| 阶段 | 输入 | 按钮状态 | 类名片段 |
|------|------|----------|----------|
| **empty** | "" | bg=rgba(0,0,0,0), enabled | `transition-colors text-foreground/80` |
| **typed** | "test" | bg=rgba(0,0,0,0), enabled | 同上 |
| **clicked** | "test" | bg=rgba(0,0,0,0), enabled | **点击未触发发送** (input 仍有 test) |
| **enter** | null (清空) | - | Enter 触发 |
| **+200ms** | null | - | - |
| **+400ms** | null | - | 无 spinner / thinking dots |
| **+600ms** | null | - | 无指示 |
| **+800ms** | null | - | 无指示 |
| **+1000ms** | null | - | **响应出现**：处理了 1s |

## 8.4 响应内容

- 文案: "你好！我是 TapNow 创作助手。系统已就绪，请告诉我你想要创作的视觉项目、画面构思或具体需求，我们可以随时开始！"
- 响应耗时: **1 秒** (显示为"处理了 1s")
- 消息类型: `is-assistant`
- 入场动画: `transition-opacity duration-300` (300ms 渐入)
- 操作按钮: 复制 / 好评 / 差评 / 分支对话

## 8.5 关键 CSS / 行为细节

- **响应气泡**: `flex flex-col gap-4 transition-opacity duration-300` — 300ms 淡入
- **发送按钮**: `lucide-arrow-up` SVG，size 32x32
- **loading 状态**: 整个 1s 响应期间**无 spinner / thinking dots** —— TapNow 不显示"正在思考"指示器
- **空态 → 输入态**: 按钮颜色无明显变化 (都是 rgba 透明)，只有 hover 时的 `hover:bg-white/[0.12]`
- **未禁用状态**: 输入框为空时按钮**未禁用** (disabled=false)，只是点击无效果

## 8.6 与 V1/V2 的对账

| 文档 | 描述 | V3 实测 | 差异 |
|------|------|---------|------|
| V2 §10.7 "文字生视频 chip 直接注入工作流" | 触发生成 | 注入的是空壳节点，**不触发生成** | V2 描述不准确 |
| V2 §10.9 "模型下拉无法打开" | 实测 | **未发现可点击的模型下拉** | 确认 |
| V1 §10 模型下拉 | 存在 | 不存在专门模型下拉，只在中央 hero chip 上隐含 | V1 误判 |

## 8.7 截图

- `docs/reports/canvas-shots/tapnow-v3/08-btn-states.png` — 初始状态
- `docs/reports/canvas-shots/tapnow-v3/08-btn-typed.png` — 输入 test
- `docs/reports/canvas-shots/tapnow-v3/08-after-click.png` — 点击后
- `docs/reports/canvas-shots/tapnow-v3/08-btn-200ms.png` — 200ms
- `docs/reports/canvas-shots/tapnow-v3/08-chat-typed.png` — 聊天已输入
- `docs/reports/canvas-shots/tapnow-v3/08-chat-after-enter.png` — Enter 触发后响应

## 8.8 扣费影响

- 发送 1 次 chat 请求 (text only)
- **未触发图片/视频生成**
- 默认欢迎回复是轻量 canned response，**未消耗 AI 积分**
- 但 1 次 chat 请求计入了 Gemini 3.7 Flash token 用量（极小）

## 8.9 薯包 v2 启示

1. **生成入口要明确** — TapNow 把生成藏在 chat 里，对画布心智不友好。
2. **loading 状态必须有视觉反馈** — TapNow 1s 无指示是糟糕 UX，薯包应该立即显示 typing dots / progress bar。
3. **响应延迟 1s** 是 chat 优化（canned response）后的实际值，真实生成会更长。
4. **消息入场用 300ms opacity** — 标准做法。
5. **不要在 typed 时改变按钮颜色** — 除非用 disable state，否则用户不知道是否可点击。
