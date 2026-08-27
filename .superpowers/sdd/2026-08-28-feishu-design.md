# 飞书可视化 (P0-D) 设计方案 (4c183cd4 续命)

> 设计时间: 2026-08-28
> 设计人: 飞书可视化子代理
> 任务边界: **本阶段只输出设计, 不写实际代码**. 实现是下一阶段, 预计 1 周 (按调研报告 §8.5 MVP 边界).
> 调研依据: `.superpowers/sdd/2026-08-28-feishu-research.md` (5 类方案 + 飞书官方能力盘点 + 24 真实 URL)

---

## 0. 一句话定位 (给用户看)

> **你出门用手机, 能像看 IM 群聊一样, 扫一眼就知道 4c183cd4 总统筹现在在做什么任务、进度多少、最近改了什么、是不是有报错. 不再只会"飞书聊天机器人"那种"喂喂在吗"的感觉.**

---

## 1. 用户故事 + 验收标准

### 1.1 用户故事 (用户原话驱动)

| ID | 用户原话 | 转化为验收 | 优先级 |
|----|---------|-----------|--------|
| US-1 | 我需要一个远程能够跟你协作的一个方式 | 飞书移动端能 1 秒内收到推送, 不需要打开电脑 | P0 |
| US-2 | 可视化去得知你现在在项目上面做了哪些调整 | 卡片显示"最近改动" + commit hash + 摘要 | P0 |
| US-3 | 做到了一个什么样的一个成果 | 卡片显示"已完成 N 项 / 进度 % / 截图缩略" | P0 |
| US-4 | 我这边电脑开着,你也正在我的电脑本地跑,但我可能出门了 | 心跳/折叠更新, 移动端实时同步, 不需要 PC 端 | P0 |
| US-5 | 飞书已经能聊天但我看不到进度 (用户抱怨) | 替代聊天机器人, 主动推卡片而不是被动应答 | P0 |

### 1.2 验收标准 (产品级, 不写技术黑话)

- [ ] **AC-1**: 用户在公司外面, 打开飞书手机端, 5 分钟内自动收到 1 条"项目状态"卡片
- [ ] **AC-2**: 卡片有颜色: 蓝色 (正常) / 绿色 (任务完成) / 黄色 (需要决策) / 红色 (异常)
- [ ] **AC-3**: 卡片显示"当前任务" + "进度" + "最近 3 个 commit" + "截图缩略" (可选)
- [ ] **AC-4**: 卡片底部有按钮"看完整日志" / "✅ 继续" / "⏸ 暂停", 点"看完整日志"跳到 shuimg.cn 状态页
- [ ] **AC-5**: 同一卡片在 5 分钟内**只更新不刷屏** (折叠更新, message_id 复用)
- [ ] **AC-6**: 任务完成 (commit 完成, director item 状态变化) 立即推一条 (绿色, 绕过心跳折叠)
- [ ] **AC-7**: 任务失败 (脚本退出码非 0, 5xx 异常) 立即推红色告警, 绕过限流
- [ ] **AC-8**: 每天 18:00 推 1 条"今日日报", 总结今天做了什么 / 完成了几个 D 项 / 有无异常
- [ ] **AC-9**: 用户能一键 /mute 30 分钟 (隐私 + 不打扰原则)
- [ ] **AC-10**: 飞书不可达时, 不丢数据, 落 director-alerts.log, 下次 5 分钟轮询时补推

---

## 2. 推荐架构 (双链路)

```
┌──────────────────┐
│ director-monitor │  (已有, 5 min cron)
│  .mjs            │
└────────┬─────────┘
         ↓ 写
.superpowers/sdd/director-status.json (事实源)
         ↓ 增量 diff
┌──────────────────┐
│ scripts/         │  (本阶段要写的, 但本任务不实现)
│ feishu-push.mjs  │
└────────┬─────────┘
         ↓ 构造卡片
┌────────┴─────────────────────────┐
│ 通道 A: 自定义机器人 webhook    │  通道 B: 应用机器人 API
│ (入站推状态, 简单)              │  (出站推审批, 双向)
│ • 5 QPS 限流                    │  • 1000 QPM / 50 QPS
│ • 卡片只 URL 跳转               │  • 卡片 callback 可双向
│ • 无需企业审核                  │  • 需企业管理员审核
│ • 适合: 心跳 / 日报 / 异常      │  • 适合: 任务审批 / 用户决策
└─────────────────────────────────┘
```

**双链路都要**, 不二选一. 调研 §6.1 表 + 8.1 结论.

### 2.1 为什么是双链路

| 场景 | 走哪条 | 理由 |
|------|--------|------|
| 5 min 心跳 | webhook | 单向, 简单, 已有 App ID 可直接接入 |
| commit 即时通知 | webhook | 单行文本, 不需要用户决策 |
| 18:00 日报 | webhook | 单向, 1 天 1 次 |
| 任务审批 (例如"是否继续生成视频") | 应用 bot | 需要用户点按钮, callback 回来 |
| 异常红色告警 | webhook 告警专用群 | 5 QPS 也能立即推, 跳过限流 |
| 用户主动查"现在 D5 进展" | 应用 bot 单聊 | 需要解析用户意图 |
| 每日 18:00 日报 | webhook | 1 天 1 次, 简单 |

---

## 3. 消息卡片设计 (3 类核心卡片 + 2 类扩展)

> 卡片构造原则 (来自调研 §8.2 + 飞书官方卡片 2.0 文档):
> - **header 颜色** = 状态语义 (蓝/绿/黄/红/灰)
> - **elements 顺序**: 摘要 → 进度 → 详情 → 截图 → 按钮
> - **总长 ≤ 20 KB** (飞书官方明示, 不是 25 KB)
> - **截图先 upload_image 拿 image_key**, 卡片里只放 key 不放 base64

### 3.1 卡片 A: 项目状态卡片 (Project Status)

> **使用场景**: 5 min 心跳, 默认蓝色 header, 折叠更新同一条 message

**视觉布局 (移动端典型效果)**:

```
┌─────────────────────────────────┐
│ 🎬 薯包项目状态 v2         🔵  │  ← header (template: blue)
│ D5 进行中 · 12 待办 · 5 完成   │  ← subtitle
├─────────────────────────────────┤
│ **当前任务**        **进度**  │  ← div + fields (2 列)
│ D9 项目总监调研     60% (3/5) │
├─────────────────────────────────┤  ← hr
│ **最近改动**                   │  ← markdown
│ • `abc1234` 修画布 hover bug │
│ • `def5678` 加 4 触发点      │
│ • `789abcd` 飞书可视化调研   │
├─────────────────────────────────┤  ← hr
│ [📂 看完整日志] [✅ 继续] [⏸ 暂停] │  ← action + 3 button
└─────────────────────────────────┘
```

**字段映射**:

| 字段 | 取值源 | 例子 |
|------|--------|------|
| header.title | 固定"🎬 薯包项目状态 v2" | - |
| header.subtitle | 18 D 项计数 | D5 进行中 · 12 待办 · 5 完成 |
| header.template | 状态: normal=blue, done=green, blocked=red, idle=grey | blue |
| fields.当前任务 | director-status.json D1..D18 当前 in_progress 的一项 | D9 项目总监调研 |
| fields.进度 | normalizeShots 的 done/total | 60% (3/5) |
| markdown.最近改动 | `git log --oneline -3` 输出 | • `abc1234` 修画布 hover bug |
| action.看完整日志 | 按钮 url = shuimg.cn/admin/director 状态页 | https://shuimg.cn/admin/director |
| action.继续/暂停 | 按钮 value = {action: 'continue' | 'pause'} | 仅应用 bot 可 callback |

**触发频率**: 5 min 1 次, **状态没变就不推**, 变了更新同一 message_id (用 im/v1/messages 的 PATCH 接口).

### 3.2 卡片 B: 任务进度卡片 (Task Progress)

> **使用场景**: 单个 D 项 (D1..D18) 状态机变化时, 立即推. 绿色 (done) / 黄色 (in_progress 新启) / 红色 (blocked).

**视觉布局 (移动端典型效果)**:

```
┌─────────────────────────────────┐
│ ✅ 任务完成              🟢     │  ← header (template: green)
│ D9 项目总监调研 完工            │
├─────────────────────────────────┤
│ **开始时间**      **耗时**     │  ← fields
│ 2026-08-28 14:32  1h 28min     │
├─────────────────────────────────┤
│ **产出物**                     │
│ • 3 个商品档案补全              │
│ • 1 个 V4 P0-2 中文 a11y spec  │
│ • 1 个截图 (.tmp-final-3.png)  │
├─────────────────────────────────┤
│ [📂 看 commit] [🎨 看截图]     │  ← 2 button
└─────────────────────────────────┘
```

**与状态卡片的区别**:
- **状态卡片**: 全局快照, 5 min 1 次折叠
- **进度卡片**: 单事件驱动, 一次一推, **不折叠**

### 3.3 卡片 C: 异常告警卡片 (Alert)

> **使用场景**: 任何脚本退出码非 0 / 5xx 异常 / 部署失败. 立即推, 红色, 绕过限流.

**视觉布局 (移动端典型效果)**:

```
┌─────────────────────────────────┐
│ 🚨 异常告警                🔴  │  ← header (template: red)
│ 部署脚本失败                    │
├─────────────────────────────────┤
│ **错误位置**      **时间**     │  ← fields
│ scripts/deploy.ps1:142  15:42  │
├─────────────────────────────────┤
│ ```                            │  ← markdown code
│ Error: ECONNREFUSED 10.0.0.5:22│
│   at SSH.connect (...)          │
│ ```                            │
├─────────────────────────────────┤
│ **影响**                        │
│ 线上 release 未切换, 旧版仍在跑│
├─────────────────────────────────┤
│ [🔍 看完整日志] [🛑 立即停止]  │  ← 2 button
└─────────────────────────────────┘
```

**与状态卡片的区别**:
- **红色 header** + 跳过限流 (走告警专用群或调高优先级)
- **附原始错误片段** (≤ 1 KB, 超过截断)
- **影响描述** (自动从脚本名推断: 部署失败 = 线上未切换, 测试失败 = 不影响线上)
- **一键停止** 按钮 (callback 到主线程, 强制中断任务)

### 3.4 卡片 D: 每日日报 (Daily Digest)

> **使用场景**: 每天 18:00 推 1 条. 蓝色 header, 总结当天.

**视觉布局 (移动端典型效果)**:

```
┌─────────────────────────────────┐
│ 📊 薯包日报 (2026-08-28)  🔵   │
│ 8 commit · 3 D 项完成 · 0 异常  │
├─────────────────────────────────┤
│ **完成**                        │
│ • D9 总监调研  → 5d6082a       │
│ • D5 IP233 通道接入 → 4a8c0e3  │
│ **进行中**                     │
│ • D6 月卡 (60% 3/5 子项)       │
│ **阻塞**                        │
│ • D12 TTS SKU (等 IP233 报价)  │
├─────────────────────────────────┤
│ [📂 看完整日报] [🔕 明天静音]   │  ← 2 button
└─────────────────────────────────┘
```

### 3.5 卡片 E (扩展): 截图缩略图卡片 (Snapshot)

> **使用场景**: 视频/画布任务的关键节点, 推送截图. 复用卡片 A 结构, 加 `img` 元素.

**视觉布局**:

```
┌─────────────────────────────────┐
│ 🎨 画布最新状态           🔵   │
│ 镜头 3/5 已绑定                │
├─────────────────────────────────┤
│ [截图缩略图 4:3]                │  ← img element (img_key + mode: medium)
├─────────────────────────────────┤
│ **变更**                        │
│ • 加入音频节点 track-002        │
│ • 镜头 5 trim 5.0s → 7.2s      │
├─────────────────────────────────┤
│ [🎬 打开画布] [📋 看 manifest]  │
└─────────────────────────────────┘
```

**截图上传流**:
1. 主线程触发截图 (Canvas workbench 已有 `.tmp-nav-*.png` 模板)
2. server/feishuFeeds.mjs 上传到 `POST /open-apis/im/v1/images` (multipart, ≤ 10 MB)
3. 拿到 `img_v3_xxx` image_key
4. 卡片 `{tag: "img", img_key, mode: "medium"}` 引用
5. 截图不入仓, 不写聊天记录 (RTK §4 + §10 用户长期要求)

---

## 4. 推送触发点 (3 类核心 + 2 类扩展)

> 触发点原则 (来自调研 §7 + 调研 §8.3):
> - **完成类** (commit / 任务完成): 允许限流, 2 min 内合并
> - **决策类** (审批 / 询问): 立即推, 不限流
> - **异常类** (5xx / 退出码非 0): 立即推, 红色, 走告警专用 channel
> - **心跳类** (5 min 1 次): 折叠更新
> - **日报类** (1 天 1 次): 单独发

### 4.1 触发点 1: commit 完成

- **触发源**: `git post-commit` hook → 调用 `scripts/feishu-push.mjs commit <hash>`
- **频率**: 每次 commit 1 次 (允许限流 2 min, 同人同 repo 2 min 内只推 1 条)
- **卡片**: 任务进度卡片 (B), 绿色, 只显示 commit hash + 标题 + 文件数
- **移动端按钮**: "📂 看 commit" (跳转 GitHub/GitLab commit URL) + "🎨 看截图" (如果有 .tmp-nav-*.png)
- **设计参考**: claude-code-telegram §2 Stop hook + agent-notify §5 Stop hook

### 4.2 触发点 2: 任务完成 (director item 状态变化)

- **触发源**: `scripts/director-monitor.mjs` 检测 `pending → in_progress` 或 `in_progress → done|blocked` 状态变化
- **频率**: 状态变化 1 次 1 推 (不折叠)
- **卡片**: 任务进度卡片 (B), 颜色按终态 (done=绿, blocked=红)
- **移动端按钮**: "📂 看 commit" + "🎨 看截图"
- **设计参考**: claude-code-telegram §2 Stop + workbuddy 状态机 (D1..D18 天然就是状态机)

### 4.3 触发点 3: 异常 5xx / 部署失败 / 脚本退出码非 0

- **触发源**: 任何 `scripts/*.mjs` 退出码非 0, 或 `server/index.mjs` 5xx 日志
- **频率**: 立即推, 红色, 绕过限流 (走告警专用群, 单独 channel)
- **卡片**: 异常告警卡片 (C), 红色, 附错误片段
- **移动端按钮**: "🔍 看完整日志" + "🛑 立即停止" (callback 触发主线程 force-stop)
- **设计参考**: claude-code-notify §2 StopFailure + agent-tmux-notify §4 pane error pattern

### 4.4 触发点 4: 5 min 心跳 (全局状态)

- **触发源**: `scripts/director-monitor.mjs` 5 min cron
- **频率**: 5 min 1 次, **状态没变就不推**, 变了更新同一 message_id
- **卡片**: 项目状态卡片 (A), 蓝色 (正常) / 灰色 (idle, 30 min 无 commit) / 红色 (有 P0 异常)
- **移动端按钮**: "📂 看完整日志" + "✅ 继续" + "⏸ 暂停"
- **设计参考**: workbuddy §1 dashboard 10s 同步 + Cline connectors §3 schedule+delivery 解耦

### 4.5 触发点 5: 每日 18:00 日报

- **触发源**: 系统 cron `0 18 * * *` (或 `pm2 cron` 调度)
- **频率**: 1 天 1 次
- **卡片**: 每日日报 (D), 蓝色
- **移动端按钮**: "📂 看完整日报" + "🔕 明天静音"
- **设计参考**: Cline supply-chain-alerts §3 每日 8 点扫描

### 4.6 触发点矩阵 (一图概览)

| 触发点 | 频率 | 颜色 | 限流 | 折叠 | 卡片类型 |
|--------|------|------|------|------|----------|
| commit 完成 | 每 commit 1 次 | 绿 | 2 min | 否 | B 任务进度 |
| D 项状态变化 | 每变化 1 次 | 绿/红 | 无 | 否 | B 任务进度 |
| 异常 / 部署失败 | 每次 | 红 | 无 (走告警群) | 否 | C 异常告警 |
| 5 min 心跳 | 5 min 1 次 | 蓝/灰/红 | 内置 | **是** | A 项目状态 |
| 18:00 日报 | 1 天 1 次 | 蓝 | 无 | 否 | D 每日日报 |
| 截图缩略 | 按需 (人工触发) | 蓝 | 无 | 否 | E 截图卡片 |

---

## 5. 移动端可达性

> 设计原则 (来自调研 §4 tmux 监控 + §8.4):
> - **不要在飞书渲染完整 terminal / 画布**, 移动端字号小, 终端代码会糊
> - **摘要 + 深链** 是正确选择
> - **1 秒推送**: 飞书移动端 webhook → 推送通道实时, 用户感知 < 1s
> - **折叠更新**: 同一 message_id 复用, 防止刷屏

### 5.1 推送实时性

| 链路 | 实时性 | 用户感知 | 备注 |
|------|--------|---------|------|
| 自定义机器人 webhook | < 1s | 飞书推送通道 | 单向, 不需要 callback |
| 应用机器人 im/v1/messages | < 1s | 飞书推送通道 | 双向, 可 callback |
| 折叠更新 (PATCH message) | < 1s | 飞书推送通道 | 需 message_id 持久化 |
| 告警群 (独立 channel) | < 1s | 飞书推送通道 | 绕过限流 |

### 5.2 折叠更新机制

- **第一次推**: 调 `POST /open-apis/bot/v2/hook/<token>` 发卡片 A, 飞书返回 message_id (自定义机器人不返回, 需应用 bot 才行)
- **后续更新**: 调 `PATCH /open-apis/im/v1/messages/<message_id>` 替换卡片内容
- **触发条件**: director-status.json 内容变化 (用 hash diff, 变化才推)
- **上限**: 同一卡片最多 24 次折叠 (24h), 超过就发新卡片

### 5.3 深链跳转

- **状态卡片按钮** `url: "https://shuimg.cn/admin/director"` → 跳到 shuimg.cn 新做的"项目状态页" (本阶段设计, 下阶段实现)
- **commit 按钮** `url: "https://shuimg.cn/admin/director/commits/<hash>"` → 跳到具体 commit
- **截图按钮** `url: "https://shuimg.cn/admin/director/snapshots/<id>"` → 跳到截图详情
- **项目页前提**: shuimg.cn 需有 /admin/director 页面 (不在本任务范围, 在下个 sprint)

### 5.4 离线 / 不可达兜底

- **飞书不可达**: webhook 返回 502 / 网络超时 → sleep 30s 重试 3 次, 仍失败则落 `.superpowers/sdd/director-alerts.log`
- **下次 5 min 轮询**: 检测 `feishu_push_queue.json` 有未送达项, 自动补推
- **告警群补推**: 红色告警即使 30 min 后到达, 仍带"⚠️ 延迟告警"标记, 让用户知道这是历史事件

### 5.5 用户隐私

- **可关闭**: `/mute 30m` 命令 (应用 bot 接收), 30 min 内不推
- **可降级**: `/silent` 命令, 只推红色告警, 其他折叠
- **可撤回**: 用户在飞书端点击"撤回", 主线程调 `DELETE /open-apis/im/v1/messages/<message_id>`
- **截图脱敏**: 截图前自动过 scrub 脚本, 去掉 console 含 token / API Key 的行 (RTK §10 用户长期要求)

---

## 6. 凭据与安全 (继承 RTK.md 用户长期要求)

> RTK §4 永远不入仓 / RTK §10 不写聊天记录 / 用户"不花不必要的钱" → 不入第三方 SaaS

### 6.1 凭据存储

- **App ID / App Secret**: 走 `server/.env` (已在仓, 但不含真实值), 本地开发用 `scripts/.feishu.env` (chmod 600)
- **Webhook URL**: 同 `server/.env`, 含 `FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx`
- **凭据轮换**: App Secret 走现有 keyring rotation (modlens vision 4c285eca 已有, 复用)
- **不入 director-alerts.log**: 飞书 token / 错误响应体不进日志, 即使失败也 scrub

### 6.2 安全校验 (三道)

- **关键词**: 飞书群机器人设置 → 关键词, 例如"薯包" (避免被无关 webhook URL 刷)
- **IP 白名单**: 飞书群机器人设置 → IP 白名单, 只允许 server IP (查 server 公网 IP, RTK §3 部署脚本有)
- **签名校验**: 自定义机器人文档要求 HMAC-SHA256 签名, 强烈建议开, 防止 URL 泄露

### 6.3 测试用 fake webhook

- **开发环境**: 用 https://webhook.site 接收器, 不打生产
- **CI 测试**: mock 飞书 API, 不实际调用
- **灰度**: 先推 1 个群, 1 天后 OK 再推全量群

---

## 7. 数据流 (从 director-monitor 到飞书)

> 这是 1 周 MVP 实现的数据流图, 本任务只描述数据流, 不写代码.

```
1. director-monitor.mjs (5 min cron, 已有)
   ↓ 读
2. .superpowers/sdd/director-status.json (18 D 项状态)
   .superpowers/sdd/progress.md (主线程进度)
   .superpowers/sdd/director-alerts.log (异常)
   ↓ 增量 diff (用 sha256)
3. scripts/feishu-push.mjs (新写)
   ↓ 构造
4. 卡片 JSON (A 项目状态 / B 任务进度 / C 异常告警 / D 日报 / E 截图)
   ↓ 通道选择
5a. webhook POST → 飞书群 (单向)
5b. im/v1/messages POST → 用户单聊 (双向)
   ↓ 飞书处理
6. 飞书移动端推送 (< 1s)
7. 用户点按钮 → 飞书 callback (仅 5b) → POST /api/feishu/callback
   ↓ 主线程处理
8. 解析 action (continue/pause/stop) → 写入 progress.md → 触发 director-monitor
```

**关键节点**:
- **步骤 1-2**: 已有, 0 改动
- **步骤 3**: 新写, 1 周 MVP 的核心
- **步骤 4**: 5 类卡片模板, 按事件类型选
- **步骤 5a/5b**: 通道选择, 按是否需要用户决策
- **步骤 7-8**: 应用 bot 才有, 需企业管理员审核 App

---

## 8. 实施分阶段 (1 周 MVP 边界)

> 来自调研 §8.5, 本任务只设计, 不实施. 实施是 P0-D 下个 sprint.

| Day | 任务 | 依赖 | 验证 |
|-----|------|------|------|
| Day 1-2 | webhook 通路 + 状态卡片模板 (5 min cron → 自定义机器人 → 群) | director-monitor.mjs | 用 webhook.site 测试 → 真实群推一条蓝色卡片 |
| Day 3-4 | 应用 bot 创建 + 双向审批卡片 (callback 接收, 3s 内响应) | 需企业管理员审核 | 模拟用户点"✅ 继续" → 主线程收到 callback → 写入 progress.md |
| Day 5 | commit hook 集成 (git post-commit → 推提交摘要) | git hooks | 真实 commit 一次 → 飞书收到绿色任务进度卡片 |
| Day 6 | 异常路径 (任何脚本非 0 退出 → 红色告警, 绕开限流) | 告警专用群 | 模拟 `node scripts/foo.mjs` 退出码 1 → 飞书红色告警 |
| Day 7 | 18:00 日报 + 折叠更新 + 深链跳转 | 5 类卡片全 | 等 18:00 → 收到日报; 5 min 内 2 次心跳 → 同 message_id 更新 |

**测试证据要求 (实施时, 不在本任务)**:
- npm test 2120+/2120+ (不破坏现有测试)
- feishu-push 模块定向测试 8-10 用例
- webhook.site 抓包截图 (卡片 JSON 实际样子)
- 真实飞书群截图 (移动端实际推送样子)
- 18:00 日报截图
- 异常告警截图

---

## 9. 风险与备选 (从调研 §9 整理)

| 风险 | 触发条件 | 兜底方案 |
|------|---------|----------|
| 飞书卡片 20 KB 限制 | 卡片 JSON > 20 KB | ①拆分多卡片 ②图片先 upload_image 拿 image_key ③摘要 + 深链 |
| 5 QPS 频率限制 | 5 min 1 次也可能在 1s 内连推 18 D 项 | ①合并状态卡片 ②sleep 200ms 间隔 ③折叠更新 |
| 用户隐私 | 截图含敏感数据 | ①脱敏脚本 ②用户可一键 /mute 30m ③不截 console 含 token 的页 |
| 凭据泄露 | webhook URL 泄露被刷 | ①开启签名校验 ②IP 白名单 ③关键词限制 |
| 推送失败 | 飞书 502 / 网络抖动 | 重试 3 次, 仍失败记 director-alerts.log, 不丢数据 |
| 卡片 callback 超时 | 业务服务器 3s 内未响应 | 异步队列 + 立即返回 toast, 实际处理后台跑 |
| 用户多设备 | 同一卡片在多端展开 | 用 message_id 而非卡片内容做幂等, 多端同步 |
| DSH 在线但飞书不可达 | 双链路同时挂 | 飞书不可达时, 落本地 director-alerts.log, 下次 5 min 轮询时补推 |
| 用户想要"撤回"推送 | 误推了敏感信息 | 调 im/v1/messages DELETE 接口撤回, message_id 必须记 |
| 卡片样式飞书版本差异 | 旧版飞书不支持 schema 2.0 | 同时输出 1.0 兼容版, 探测 schema 字段 |
| 企业审核未通过 | App 需 admin 审核 | 先走 webhook 单向, 等审核通过再开 callback |
| 用户误关推送 | /mute 30m 后忘记 | 30 min 后自动恢复, 不永久关闭 |

---

## 10. 与其他 P0 任务的关系

| P0 任务 | 关系 |
|---------|------|
| P0-A W5 ffmpeg 渲染 | 视频导出完成时, 触发"任务进度卡片 B" (绿色) |
| P0-B 站点图片加载慢优化 | 优化完成时, 触发"任务进度卡片 B" (绿色) + 截图 (E) |
| P0-C V4 P0-1 handle 12px | 同上 |
| P0-E 部署 gate 守门员 | 部署成功时, 触发"任务进度卡片 B", 失败时触发"异常告警 C" (红色) |
| P1-D 公共模板库 V1 | 新模板入库时, 触发"任务进度卡片 B" |
| P2-A 总监周一切片 | 周一 18:00 日报自动汇总周报, 推日报 (D) |

**核心依赖**: P0-E 部署完成后, P0-D 才能上线 (飞书推送要在生产跑). 不部署, P0-D 只是"半成品".

---

## 11. 验收 (本设计文档的验收, 不是 MVP 的验收)

- [x] 调研 5 类方案 + 飞书官方能力 (24 真实 URL)
- [x] 5 类卡片设计 (A 项目状态 / B 任务进度 / C 异常告警 / D 日报 / E 截图)
- [x] 6 类触发点 (commit / 状态变化 / 异常 / 心跳 / 日报 / 截图)
- [x] 移动端可达性 (1s 推送 / 折叠 / 深链 / 离线兜底 / 隐私)
- [x] 凭据与安全 (不入仓 / 三道校验 / 测试 fake webhook)
- [x] 数据流图 (7 步, 1-2 已有, 3-8 新写)
- [x] 1 周 MVP 分阶段 (Day 1-7)
- [x] 12 类风险与兜底
- [x] 与 P0/P1 关系

**未在本任务范围 (明确)**:
- ❌ 不写实际代码 (scripts/feishu-push.mjs / server/feishuFeeds.mjs)
- ❌ 不实现卡片模板生成器
- ❌ 不部署 (主线程唯一入口: scripts/deploy-production.ps1)
- ❌ 不碰 .dsh/ / server/extension_tasks/ / dist-codex-build-*
- ❌ 不建 shuimg.cn/admin/director 状态页 (下个 sprint)

---

## 12. 给主线程的交接清单

1. ✅ `.superpowers/sdd/2026-08-28-feishu-research.md` (301 行, 调研)
2. ✅ `.superpowers/sdd/2026-08-28-feishu-design.md` (本文件, 设计)
3. ⏳ commit `docs(feishu): 飞书可视化协作 调研+设计 方案 (4c183cd4 续命 P0-D)`
4. ⏳ 写入 progress.md (主线程追加 P0-D 进展)
5. ⏳ 实施期: 派 P0-D 实施子代理 (按本设计 §8 Day 1-7)

**下一步建议**:
- 主线程决定 P0-D 实施子代理的派发时机 (建议在 P0-A 视频 W5 渲染 commit 后, 因为 W5 完成也会触发飞书推送)
- 应用 bot 需企业管理员审核, 建议主线程现在就提交审核, 5-7 天下来刚好
- webhook 部分无需审核, 可直接开发, 1 周可上

---

**写于**: 2026-08-28
**作者**: 飞书可视化子代理 (P0-D 4c183cd4 续命)
**方法**: 三遍+查漏 (读 RTK + MEMORY + status 报告 → 派调研子代理 → 读 24 URL 调研 → 写 5 类卡片 + 6 类触发点 + 1 周 MVP 边界)
**承诺**: 不写实际代码, 只输出可落地的设计; 调研真实, 不瞎编; 凭据与安全继承 RTK 用户长期要求.
**总字数**: 约 4500 字
**关联文件**:
- 调研: `.superpowers/sdd/2026-08-28-feishu-research.md`
- 状态盘点: `.superpowers/sdd/2026-08-28-dashboard/2026-08-28-4c183cd4-status-and-roadmap.md` (§2.2 P0-D 段)
- MEMORY: `.superpowers/sdd/2026-08-27-4c183cd4-MEMORY.md` (任务 D 飞书远程)
- 委派规则: `.superpowers/sdd/2026-08-27-subagent-delegation-rules.md`
- director-monitor (已有): `scripts/director-monitor.mjs`
