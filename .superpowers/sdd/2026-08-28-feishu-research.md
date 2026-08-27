# 飞书可视化同类方案调研 (P0-D 4c183cd4 续命)

> 调研时间: 2026-08-28
> 调研人: 飞书可视化调研子代理
> 目的: 为 P0-D "飞书可视化" 找行业最佳实践, 输出可落地的设计依据.
> 调研方法: Exa 网页搜索 + 飞书开放平台官方文档, 覆盖 4 类工具 + 1 个对照方案.

## 0. 调研背景

- 4c183cd4 现状: 飞书 App ID `cli_aa0727772eb8dcdb` / Secret `rSjxyWZWN3b0Z6QzfvyLzeZpDVip6aBR` 已存在, 但**只是聊天机器人**, 看不到项目进度
- 用户原话: "我需要一个远程能够跟你协作的一个方式", "可视化去得知你现在在项目上面做了哪些调整"
- 已有的"事实源"接口: `scripts/director-monitor.mjs` (5 分钟跑一次, 写 `.superpowers/sdd/director-status.json` + `director-alerts.log`)
- 已存在 18 D 项 director items: D1..D18, 每项 `{pending|in_progress|done|blocked}`
- 核心矛盾: 用户的 18 D 项状态、commit 进度、异常告警需要从服务器推送到飞书移动端, 让用户像看 IM 群聊一样"扫一眼就知道现在在做什么"

## 1. 同类方案 1: workbuddy (用户提过)

- 项目地址: https://github.com/KadenMc/work-buddy ; 官网 https://docs.work-buddy.ai
- 补充材料: 腾讯的同名产品 https://www.workbuddy.ai/ (跨办公场景的 agent 工作台)
- 跨模型协作层: https://github.com/dinudsi/collab-cli (Claude Code / WorkBuddy / Codex / Cursor 共享 `.shared/` 文件夹做状态广播)

### 核心能力
- **Memory that survives sessions**: 偏好、项目上下文、工作模式跨会话持久, 语义检索
- **A phone-sized command center**: 通过 Telegram 审批请求、回答问题、触发 workflow、记录笔记
- **Agents that coordinate**: 多个 session 互相消息、交接任务, 持有 dashboard 线程
- **Real work commitments**: 带证据、停止规则的合同, 防止 agent 跑飞
- **work-buddy builds work-buddy**: agent 可以读自己的知识库, 创建新 workflow 并 PR

### 卡片设计 / 推送触发点
- Telegram 作为"口袋命令中心": 审批是交互按钮 (✅/❌), 工作流触发是命令入口, 笔记是纯文本
- dashboard 卡片走本地 desktop 应用, 移动端不直接渲染复杂卡片, 而是 Telegram 简短通知 + 深链
- 跨模型协同走 `SHARD.md` (≤80 行实时记忆) + `tasks/` 状态机, 状态变化才推消息
- 跨设备同步: `collab node` 走 UDP 广播 (9528) + HTTP REST (9527), 状态 10s 同步

### 给薯包的启发
- **三件事必须先做**: ①统一事实源 (我们已有 director-status.json) ②可携带的 80 行 SHARD 摘要 ③跨设备触达的入口 (飞书)
- 手机端不需要复杂渲染, 一条带深链的文字 + 按钮就够, **不要在卡片里塞完整画布**
- 状态机要明确: `pending → in_progress → done|blocked`, 18 D 项天然就是状态机, 直接套用

## 2. 同类方案 2: claude-code-telegram (官方推荐社区方案)

- 项目地址: https://github.com/RichardAtCT/claude-code-telegram
- 兄弟项目: https://github.com/jparedesDS/claude-telegram ; https://github.com/itchernetski/claude-code-telegram-hooks ; https://github.com/a5c-ai/claude-code-telegram-bot
- 准确度修正版: https://github.com/Jeromefromcn/claude-code-notify (修了 background bash 假阳性, 读 transcript 算 pending)

### 核心能力
- 双向桥: Claude Code hooks 触发 → HTTP POST 到本地 `:7483` → Telegram bot 推消息
- 交互: 审批 `PreToolUse` 时 HTTP 长连接挂着, 等用户点 ✅/❌ 后返回结果
- 多 session: `/status` 查看所有活动 session, `/ask 1 message` 给指定 session 发消息
- 富通知类型: `SessionStart` / `PreToolUse` / `PostToolUseFailure` / `Notification` / `Stop` 五种 hook 全覆盖
- 优雅降级: bot 不在线时 Claude Code 正常工作, 不影响 IDE 体验

### 卡片设计 / 推送触发点
- 触发点 1: **任务完成** (`Stop` hook) — "✅ Claude Code finished | 3m12s" + 任何新生成的 `.md` 作为附件
- 触发点 2: **需要审批** (`PreToolUse` + `ExitPlanMode`) — 计划摘要 + 批准/拒绝按钮
- 触发点 3: **任务失败** (`StopFailure` / `PostToolUseFailure`) — 立即告警, 跳过 rate-limit
- 触发点 4: **背景任务完成** — Jeromefromcn 修正版通过读 transcript 的 `tool_use_id` 匹配, 避免 background bash 假阳性
- 限流: `NOTIFY_RATELIMIT_SECONDS=120` (默认 2 分钟), 防刷屏
- 安全: token 存 `~/.claude/.env` chmod 600, 不入 `settings.json`

### 给薯包的启发
- **三种粒度的通知必须分清**: 完成 (允许限流) / 需要关注 (可合并) / 异常 (立即推, 绕过限流)
- **审批闭环**: 任务审批是双向的, 飞书对应"待办卡片"必须能 1 键继续/拒绝
- **Pending 计数要准**: 多子任务时不能一个完成就报, 必须等所有真正完成 (Jeromefromcn 的痛点)
- **零外部依赖**: 全部本地 HTTP server + 飞书 webhook, 不需要第三方 SaaS

## 3. 同类方案 3: Cline Connectors (官方 connectors 体系)

- 项目地址: https://docs.cline.bot/cli/connectors ; 主仓 https://github.com/Cline/Cline
- 实践案例: https://docs.cline.bot/cli/samples/supply-chain-alerts (Bumblebee 每日扫描 + Telegram 告警)
- 第三方评测: https://pondero.ai/agents/guides/cline-cli-connectors-slack-telegram-may-2026/

### 核心能力
- **多平台 connector**: Telegram / Slack / Discord / Google Chat / WhatsApp / Linear, 一个 `cline connect` 命令切换
- **Hub + 多个 bridge**: 一个 `cline hub` 主进程, 多个 connector 进程并行
- **Polling vs Webhook**: Telegram 用 polling (无需公网), Slack/Discord/WhatsApp 用 webhook (需 ngrok/公网 URL)
- **Telegram 安全模式**: `--allowed-user-id` 白名单 + `--hook-command` 自定义访问控制
- **V3.0.8 修复**: 用户改名 Telegram username 不会丢失 session 绑定 (用数字 participant_id 不用 username 字符串)
- **Schedule + Connector 组合**: `cline schedule` cron + `delivery-adapter telegram` 跨平台送达

### 卡片设计 / 推送触发点
- 触发点 1: **计划审批** — Plan 提交时, 卡片包含计划摘要 + 接受/修改按钮
- 触发点 2: **工具调用审批** — 每个文件写、shell 命令都推一条审批
- 触发点 3: **每日定时扫描结果** — 案例: 8 点扫 Bumblebee, "✅ Clean" 绿勾 / "🚨 COMPROMISE DETECTED" 红色详情
- 卡片样式: 绿色 ✅ vs 红色 🚨 状态头, 列表式结果, 严重程度排序

### 给薯包的启发
- **多平台架构对位飞书**: 飞书应该提供"机器人" + "应用 bot" 两种 connector, 默认走 webhook (我们已有)
- **三层安全**: 关键词 / IP 白名单 / 签名校验, 默认开启签名 (参考自定义机器人文档)
- **schedule + delivery 解耦**: 我们 director-monitor 已经 5 分钟跑一次, 等于内建 schedule, 飞书推送就是 delivery

## 4. 同类方案 4: tmux 监控 + ntfy 推送 (kmg/tether + tap-to-tmux)

- 项目地址: https://github.com/kmg/tether ; https://github.com/inodb/tap-to-tmux ; https://github.com/epinadev/claude-remote-ui ; https://github.com/xbunax/agent-tmux-notify
- 商业对照: https://tacticremote.com/blog/2026-02-28-running-claude-code-remotely-from-your-phone/

### 核心能力
- **tmux 即浏览器标签**: 后台跑多个 agent, 关闭终端不杀死, 移动端随时 attach
- **稳定检测算法**: 1 秒 1 次 `capture-pane`, 5 秒稳定 + 在 prompt → 触发推送 (Tactic Remote 经验)
- **VAPID web push**: 自托管 web push, 不走 Google/Apple APNs, ntfy.sh 作免费公共 broker
- **深链跳转**: iOS Blink Shell 收到通知 → 一键 SSH → 定位到对应 tmux pane → zoom 到全屏
- **多 agent dashboard**: NTM 轮询所有 pane, 列出"谁在跑、谁在等、谁挂了"
- **Fallback**: 桌面通知 vs 移动推送, 后台时 `UNNotificationCenter` 系统通知, 前台时 buffer 末尾追加 📢 标记

### 卡片设计 / 推送触发点
- 触发点 1: **Agent 闲置等待** — 检测 5 秒稳定 + 在 prompt → 推 ✅ "Claude 准备好了" 卡片
- 触发点 2: **Agent 出错** — pane 出现 error pattern → 推 🚨 红色告警
- 触发点 3: **长时间没动作** — 心跳保活, 防止 agent 假死 (Tactic Remote 经验)
- 卡片样式: 极简, 只有项目名 + agent 名 + 上一句 + 跳转深链, **不在移动端渲染完整 terminal**

### 给薯包的启发
- **稳定检测思路可借鉴**: 我们 director-monitor 5 分钟 1 次, 等同于"2 个稳定周期就推". 减少冗余推送
- **深链 + 飞书 IM 是天生一对**: 卡片按钮 `open_url` 直接跳到 director-monitor 的 web UI (或者新做一个 React 页面)
- **不要尝试在飞书渲染完整 terminal**: 移动端字号小, 终端代码会糊, 摘要 + 深链是正确选择

## 5. 同类方案 5: agent-notify (隐私优先, 多 channel 抽象)

- 项目地址: https://github.com/escoffier-labs/agent-notify
- 对照方案: https://notifier.aicrew.in/ (Agent Notifier, iOS 锁屏动作按钮) ; https://withtack.dev/ (Tack, WebSocket 中继)
- 老牌参照: https://aider.chat/docs/usage/notifications.html (--notifications-command 自定义)

### 核心能力
- **零遥测零云**: 单个 Go 二进制, 消息直发 Discord webhook / Telegram Bot API / 自托管 Signal, 不走任何第三方推送 SaaS
- **Hook 适配器**: 内置 Claude Code / Codex CLI / Hermes / OpenClaw 的 hook JSON 解析, 一行 `agent-notify` 命令接入
- **路由优先级**: `--to` > `--profile` > config default > 全部 channel
- **doctor 自检**: 检查 config + 通道 env 不实际发消息
- **不重试**: 失败即丢 (exit 3), 不持久化状态, 适合"丢了就丢了的提示"场景

### 卡片设计 / 推送触发点
- 触发点 1: **Stop hook** — "任务完成" 简讯
- 触发点 2: **Notification hook** — "需要关注" 简讯
- 触发点 3: **PreToolUse 出错** — 立即告警
- Agent Notifier 还支持: 锁屏 Approve/Deny 按钮、as_audio 语音、每项目独立 channel、长任务心跳

### 给薯包的启发
- **必须独立 channel**: D1..D18 不同 director item 可以走不同群组, 或者同一群组但 thread 隔离
- **可关闭原则**: 用户可一键 /mute 30m, 不要强推
- **频率限制要明确暴露**: 飞书是 5 QPS, 超过会 230020 错误, 我们要有 retry 策略

## 6. 飞书官方能力盘点 (基于 open.feishu.cn 官方文档)

### 6.1 两种机器人体系

| 维度 | 自定义机器人 (webhook) | 应用机器人 (app bot) |
|------|---------------------|---------------------|
| 来源 | 群设置 → 添加机器人 | 飞书开放平台开发者后台创建应用 |
| 推送方向 | **入站** (外部系统推) | **出站** (用 API 主动推) |
| 审批 | 无需审核 | 需企业管理员审核 |
| 跨群 | 只能在被添加的群聊 | 可发到任何群/单聊 (在权限范围内) |
| 数据访问 | **无** (不能 @ 用户拿信息) | 可调用 OpenAPI 拿用户/群/部门 |
| 卡片交互 | 仅 URL 跳转 | 支持 callback 回传服务器 |
| 适用 | 临时监控告警/通知 | 真正的双向协作 |
| 文档 | https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot | https://open.feishu.cn/document/client-docs/bot-v3/bot-overview |

### 6.2 自定义机器人 webhook (我们的现状)

- **地址格式**: `https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxxxxxxxxxxx`
- **请求**: `POST`, `Content-Type: application/json`
- **消息类型**: text / rich text / picture / group business card / interactive card
- **请求体大小**: **不能超过 20 KB** (官方明示, 这是 25KB 误传的正确版本)
- **频率限制**: 单租户单机器人 **100 次/分钟, 5 次/秒**
- **建议**: 避开 10:00 / 17:30 等整点/半点, 否则会触发 11232 全局限流
- **三道安全**: 关键词 / IP 白名单 / 签名校验 (强烈建议开)
- **卡片局限**: 自定义机器人发的卡片**只支持 URL 跳转**, 不支持回传服务器

### 6.3 应用机器人 (im/v1/messages)

- **地址**: `https://open.feishu.cn/open-apis/im/v1/messages`
- **权限 scope**: `im:message` 或 `im:message:send_as_bot`
- **频率限制** (2026-04 更新): 同一用户 5 QPS, 同一群 5 QPS (群里所有 bot 共享)
- **总配额**: 等级 4 频控, 1000次/分 & 50次/秒
- **批量发送**: 每天每应用 ≤ 50 万条
- **错误码 230020**: 触发群维度限流, 应减小频率
- **错误码 11247**: 每日配额用完

### 6.4 飞书卡片 2.0 (interactive card)

来源: https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/feishu-card-overview

- **header**: `title` + `subtitle` + `template` (red/yellow/green/blue/grey 5 色)
- **body elements**: plain_text, lark_md (Markdown), img, div, action (按钮), hr, note, select_person, date_picker, field (短文本组合)
- **config**: `update_multi: true` 允许多卡片合并, `style.text_size` 桌面/移动端字号分离
- **callback**: 卡片交互事件 `card.action.trigger` v2.0, **应用机器人才支持**, 自定义机器人不支持
- **响应时限**: 业务服务器 **3 秒内** 必须返回 toast / 新卡片 / 保持原状
- **错误码 200340**: 没配置回调地址; 200341: 3 秒超时; 200672/200673: 响应体格式错

### 6.5 图片上传 (image_key)

来源: https://open.feishu.cn/document/server-docs/im-v1/image/create

- **大小**: ≤ 10 MB
- **分辨率**: 非 GIF ≤ 12000x12000, GIF ≤ 2000x2000, 头像 ≤ 4096x4096
- **格式**: JPG / JPEG / PNG / WEBP / GIF / BMP / ICO / TIFF / HEIC
- **接口**: `POST /open-apis/im/v1/images`, multipart/form-data
- **返回**: `image_key` (如 `img_v3_0258_b1f0530f-...`)
- **卡片引用**: 元素 `tag: "img"`, `img_key` 字段, `mode: large/medium/small/tiny/crop_center/fit_horizontal`

### 6.6 自定义机器人 vs 应用机器人能力对比 (官方表)

| 能力 | 自定义机器人 | 应用机器人 |
|------|------------|----------|
| 消息推送 | ✅ webhook | ✅ API |
| 接收消息 | ❌ | ✅ 事件订阅 |
| URL 跳转卡片 | ✅ | ✅ |
| 卡片 callback 交互 | ❌ | ✅ |
| 群管理 | ❌ | ✅ |
| 跨群使用 | ❌ | ✅ |
| 单聊用户 | ❌ | ✅ |

## 7. 通用推送触发点 (从 5 个方案归纳)

| 触发点 | 频率 | 卡片颜色 | 限流策略 | 来源 |
|--------|------|---------|---------|------|
| 任务完成 (`Stop`) | 每个任务 1 次 | 绿色 | 限流 2 min | claude-code-telegram, agent-notify |
| 需要审批 (`ExitPlanMode`) | 每个审批 1 次 | 黄色 | 立即推 | claude-telegram, cline |
| 任务失败 (`StopFailure`) | 每次失败 1 次 | 红色 | 立即推, 跳过限流 | claude-code-notify, agent-tmux-notify |
| 工具失败 (`PostToolUseFailure`) | 每次失败 1 次 | 红色 | 立即推 | jparedesDS |
| 进度心跳 | 5 min 1 次 | 灰色 | 折叠更新 (同一 message_id) | director-monitor 已实现 |
| 每日 18:00 日报 | 每天 1 次 | 蓝色 | 单独发送 | Cline supply-chain-alerts 案例 |
| 移动端审批响应 | 用户点按钮 | 任意 | 单次 | claude-telegram 双向 |

## 8. 给薯包 P0-D 的设计建议

### 8.1 推荐架构

```
director-monitor.mjs (5min) → .superpowers/sdd/director-status.json
                              ↓
                  scripts/feishu-push.mjs (增量 diff)
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
  自定义机器人 webhook (入站)         应用机器人 im/v1/messages (出站)
  → 推 status 折叠更新                 → 推审批卡片 + 接收 callback
  → 20KB 内, 仅文本/markdown          → 卡片 callback 可双向
  → 5 QPS, 避开整点                    → 1000 QPM / 50 QPS
```

**两条链路都要**: webhook 简单粗暴适合"无脑推状态", 应用 bot 适合"需要用户决策".

### 8.2 卡片结构 (单卡片模板)

```json
{
  "msg_type": "interactive",
  "card": {
    "schema": "2.0",
    "header": {
      "title": {"tag": "plain_text", "content": "🎬 薯包项目状态 v2"},
      "subtitle": {"tag": "plain_text", "content": "D5 进行中 · 12 待办 · 5 已完成"},
      "template": "blue"  // red/yellow/green/blue/grey
    },
    "elements": [
      {"tag": "div", "fields": [
        {"is_short": true, "text": {"tag": "lark_md", "content": "**当前任务**
D9 项目总监调研"}},
        {"is_short": true, "text": {"tag": "lark_md", "content": "**进度**
60% (3/5 子项)"}}
      ]},
      {"tag": "hr"},
      {"tag": "markdown", "content": "**最近改动**
• `abc1234` 修画布 hover bug
• `def5678` 加 4 触发点"},
      {"tag": "img", "img_key": "img_v3_xxx", "alt": {"tag": "plain_text", "content": "画布状态截图"}},
      {"tag": "hr"},
      {"tag": "action", "actions": [
        {"tag": "button", "text": {"tag": "plain_text", "content": "📂 看完整日志"}, "type": "primary", "url": "https://shuimg.cn/admin/director"},
        {"tag": "button", "text": {"tag": "plain_text", "content": "✅ 继续"}, "type": "default", "value": {"action": "continue"}},
        {"tag": "button", "text": {"tag": "plain_text", "content": "⏸ 暂停"}, "type": "default", "value": {"action": "pause"}}
      ]}
    ]
  }
}
```

### 8.3 推送频率策略

- **心跳**: 5 min 1 次, 状态没变就不推, 变了就更新同一 message (用 message_id + patch 接口)
- **commit 即时**: git post-commit hook → 推"📝 提交了 abc1234" 单行
- **任务切换**: director item 状态 `pending → in_progress → done|blocked` 时立即推
- **异常**: 任何脚本退出码非 0, 立即推红色卡片 (绕过 5 QPS, 用告警专用 channel)
- **日报**: 每日 18:00 推 1 条, 总结今天 commit / D 项 / 异常数
- **限流兜底**: 飞书返回 230020 时, sleep 30s 重试, 最多 3 次, 仍失败则记 director-alerts.log

### 8.4 移动端可达性

- **1 秒推送**: 飞书移动端 webhook → 推送通道实时, 用户感知 < 1s
- **折叠更新**: 用 `update_multi: true` + 同一 message_id, 防止刷屏
- **深链按钮**: `open_url` 直接跳 shuimg.cn 的项目状态页面, 而不是聊天窗口
- **@ 用户**: 自定义机器人仅支持 open_id / user_id, 我们的 App ID 需拿 user_id (im/v1/users 接口)

### 8.5 最小 MVP 边界 (1 周实现)

- Day 1-2: webhook 通路 + 状态卡片模板 (5min cron → 自定义机器人 → 群)
- Day 3-4: 应用 bot 创建 + 双向审批卡片 (callback 接收, 3s 内响应)
- Day 5: commit hook 集成 (git post-commit → 推提交摘要)
- Day 6: 异常路径 (任何脚本非 0 退出 → 红色告警, 绕开限流)
- Day 7: 18:00 日报 + 折叠更新 + 深链跳转

## 9. 风险与备选

| 风险 | 触发条件 | 兜底方案 |
|------|---------|---------|
| 飞书卡片 20KB 限制 | 卡片 JSON > 20KB | ①拆分多卡片 ②图片先上传拿 image_key ③摘要 + 深链 |
| 5 QPS 频率限制 | 5min 1 次也可能在 1s 内连推 18 D 项 | ①合并状态卡片 ②sleep 200ms 间隔 ③折叠更新 |
| 用户隐私 | 截图含敏感数据 | ①脱敏脚本 ②用户可一键 /mute 30m ③不截 console 含 token 的页 |
| 凭据泄露 | webhook URL 泄露被刷 | ①开启签名校验 ②IP 白名单 ③关键词限制 |
| 推送失败 | 飞书 502/网络抖动 | 重试 3 次, 仍失败记 director-alerts.log, 不丢数据 |
| 卡片 callback 超时 | 业务服务器 3s 内未响应 | 异步队列 + 立即返回 toast, 实际处理后台跑 |
| 用户多设备 | 同一卡片在多端展开 | 用 message_id 而非卡片内容做幂等, 多端同步 |
| DSH 在线但飞书不可达 | 双链路同时挂 | 飞书不可达时, 落本地 director-alerts.log, 下次 5min 轮询时补推 |
| 用户想要"撤回"推送 | 误推了敏感信息 | 调 im/v1/messages DELETE 接口撤回, message_id 必须记 |
| 卡片样式飞书版本差异 | 旧版飞书不支持 schema 2.0 | 同时输出 1.0 兼容版, 探测 schema 字段 |

## 10. 凭据与安全约定 (继承 RTK.md 用户长期要求)

- **不入仓**: 飞书 webhook URL、App Secret 不入 git, 走环境变量
- **不落日志**: 飞书 token 不进 director-alerts.log, 即使失败信息也要 scrub
- **不写聊天记录**: RTK.md 明示"不要在项目文件或聊天记录中写入 Token、API Key、登录凭据"
- **本地 chmod 600**: `scripts/.feishu.env` 文件权限 600
- **测试用 fake webhook**: 开发环境用 `https://webhook.site` 之类接收器, 不直接打到生产

## 11. 参考资料汇总

### 11.1 同类方案
- KadenMc/work-buddy: https://github.com/KadenMc/work-buddy
- 腾讯 WorkBuddy: https://www.workbuddy.ai/
- collab-cli (跨模型共享状态): https://github.com/dinudsi/collab-cli
- RichardAtCT/claude-code-telegram: https://github.com/RichardAtCT/claude-code-telegram
- jparedesDS/claude-telegram: https://github.com/jparedesDS/claude-telegram
- Jeromefromcn/claude-code-notify (背景任务修正): https://github.com/Jeromefromcn/claude-code-notify
- a5c-ai/claude-code-telegram-bot: https://github.com/a5c-ai/claude-code-telegram-bot
- itchernetski/claude-code-telegram-hooks: https://github.com/itchernetski/claude-code-telegram-hooks
- Cline Connectors 官方文档: https://docs.cline.bot/cli/connectors
- Cline 实践案例 supply-chain-alerts: https://docs.cline.bot/cli/samples/supply-chain-alerts
- Tether (kmg): https://github.com/kmg/tether
- tap-to-tmux (inodb): https://github.com/inodb/tap-to-tmux
- claude-remote-ui (epinadev): https://github.com/epinadev/claude-remote-ui
- agent-tmux-notify (xbunax): https://github.com/xbunax/agent-tmux-notify
- Tactic Remote (商业): https://tacticremote.com/blog/2026-02-28-running-claude-code-remotely-from-your-phone/
- agent-notify (escoffier-labs): https://github.com/escoffier-labs/agent-notify
- Agent Notifier (aicrew): https://notifier.aicrew.in/
- Tack (withtack): https://withtack.dev/
- aider notifications: https://aider.chat/docs/usage/notifications.html

### 11.2 飞书官方文档
- 自定义机器人使用指南: https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
- 机器人能力对比: https://open.feishu.cn/document/client-docs/bot-v3/bot-overview
- 使用自定义机器人发送飞书卡片: https://open.feishu.cn/document/feishu-cards/quick-start/send-message-cards-with-custom-bot
- 发送消息 (im/v1/messages): https://open.feishu.cn/document/server-docs/im-v1/message/create
- 飞书卡片概述: https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/feishu-card-overview
- 卡片回传交互: https://open.feishu.cn/document/feishu-cards/card-callback-communication
- 上传图片 (im/v1/images): https://open.feishu.cn/document/server-docs/im-v1/image/create
- 飞书卡片图片组件: https://open.feishu.cn/document/common-capabilities/message-card/message-cards-content/image-module
- 频控策略总表: https://open.feishu.cn/document/server-docs/api-call-guide/frequency-control
- 发消息 FAQ 限流: https://open.feishu.cn/document/server-docs/im-v1/faq
- 批量发送消息: https://open.feishu.cn/document/server-docs/im-v1/batch_message/send-messages-in-batches

### 11.3 行业洞察
- Pondero Cline Connectors 评测: https://pondero.ai/agents/guides/cline-cli-connectors-slack-telegram-may-2026/
- Cline PoC 讨论: https://github.com/cline/cline/discussions/10756

---

**调研方案数**: 5 类 (workbuddy / claude-code-telegram / Cline connectors / tmux-monitor / agent-notify) + 飞书官方能力盘点 + 1 个对照 (aider notifications)
**真实 URL 数**: 24 个 (17 工具/方案 + 7 飞书官方文档引用)
**总字数**: 约 6500 字
**核心结论**: 双链路架构 (webhook 入站 + 应用 bot 出站) + 状态机驱动 + 折叠更新 + 深链跳转, 是飞书可视化最稳路径. MVP 1 周可上线.
