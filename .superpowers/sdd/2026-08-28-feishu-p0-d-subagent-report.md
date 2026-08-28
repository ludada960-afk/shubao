## P0-D 飞书可视化 子代理 完成报告 (4c183cd4 续命)

### 1. Commit Hash
- **完整**: `8121d1792ede9d54d6ffabc3cb75ff9225e67088`
- **短**: `8121d17`
- **HEAD 已推进**: 从 `3ea2241f` → `8121d17`
- **提交内容**: 2 files changed, 878 insertions(+)
  - `.superpowers/sdd/2026-08-28-feishu-research.md` (368 行 / 23.8 KB)
  - `.superpowers/sdd/2026-08-28-feishu-design.md` (510 行 / 27.1 KB)
- **commit message**: `docs(feishu): 飞书可视化协作 调研+设计 方案 (4c183cd4 续命 P0-D)` (用 -F file 写入, 39 行, 无中文转义问题)

### 2. 调研报告 + 设计方案 摘要

**调研 (子代理 57c477c0 完成, 301/368 行)**:
- 5 类同类方案: **workbuddy** (用户提过, 跨模型 + SHARD 80 行记忆) / **claude-code-telegram** (官方推荐, 5 hooks 覆盖) / **Cline Connectors** (多平台 + schedule+delivery 解耦) / **tmux 监控 + ntfy 推送** (Tactic Remote 商业对照) / **agent-notify** (隐私优先, 零遥测)
- 飞书官方能力盘点: **自定义机器人 webhook (入站, 100 QPM, 5 QPS)** vs **应用机器人 im/v1/messages (出站, 1000 QPM, 50 QPS)** + 飞书卡片 2.0 + image_key 上传 (≤10MB)
- **24 真实 URL** (17 工具/方案 + 7 飞书开放平台官方文档)
- **关键发现 1**: 飞书卡片请求体限制官方明示是 **20 KB**, 不是 25 KB (调研子代理已纠正)
- **关键发现 2**: 应用机器人 callback 3 秒响应时限, 200340/200341/200672/200673 错误码
- **关键发现 3**: 同一群 5 QPS 频控, 18 D 项状态变化可能 1s 内连推 → 需折叠更新

**设计 (510 行, 12 章节)**:
- **5 类消息卡片**:
  - A **项目状态卡** (蓝色, 5min 折叠, header + 当前任务 + 进度 + 最近 commit + 截图 + 3 按钮)
  - B **任务进度卡** (绿/黄/红, 一次一推, commit/D 项完成时)
  - C **异常告警卡** (红色, 绕过限流, 5xx/部署失败/退出码非 0)
  - D **每日日报卡** (蓝色, 18:00 推)
  - E **截图缩略卡** (蓝色, 按需, image_key 模式)
- **6 类推送触发点矩阵**: commit / 状态变化 / 异常 / 5min 心跳 / 18:00 日报 / 截图
- **移动端可达性**: 1s 推送 + message_id 折叠 + 深链跳转 shuimg.cn/admin/director + 离线兜底 (落 director-alerts.log) + 用户隐私 (/mute 30m / /silent / 撤回)
- **凭据与安全**: App Secret 不入仓, 走环境变量; 三道校验 (关键词/IP 白名单/签名); 测试用 webhook.site fake
- **数据流**: director-monitor.mjs (已有 5min cron) → feishu-push.mjs (新写, 1 周 MVP) → 通道 A webhook (单向) / 通道 B 应用 bot (双向) → 飞书移动端
- **1 周 MVP 分阶段**: Day 1-2 webhook 通路, Day 3-4 应用 bot 双向, Day 5 commit hook, Day 6 异常路径, Day 7 日报 + 折叠
- **12 类风险 + 兜底**: 20KB 限制 / 5 QPS 频控 / 隐私 / 凭据泄露 / 推送失败 / callback 3s 超时 / 多设备 / DSH 双链路挂 / 撤回 / schema 版本 / 企业审核 / 误关推送

### 3. 任何新发现

1. **现有 4c183cd4 留下的 director-monitor.mjs 是完美的事实源** — 已 5min cron 写 director-status.json + director-alerts.log, P0-D 实施时直接复用, **0 改动 director-monitor**
2. **飞书 App ID cli_aa0727772eb8dcdb 已经在 MEMORY.md 记** (MEMORY §任务 D), 但工作树没有任何飞书相关代码 (grep 0 命中), 说明之前只是凭据登记, 没真正实现 bot — 这与状态盘点 §1.2 "X 飞书已能聊天但用户不满意" 描述一致
3. **shuimg.cn 没有 /admin/director 状态页** (深链跳转目标) — 这是 P0-D 实施的前置依赖, 建议下个 sprint 先做这个页面 (1-2 天)
4. **P0-D 与 P0-E 部署依赖**: P0-D 飞书推送要跑在生产, 必须先 P0-E 部署上线才能 push — 实施时序: P0-A 视频 W5 渲染 commit → P0-D 实施 (webhook 部分无需审核, 1 周) → P0-E 部署上线 → P0-D 真正生效
5. **应用 bot 需企业管理员审核 (5-7 天)**, 建议主线程现在就提交审核申请, 等实施子代理启动时刚好下来 — webhook 部分无需审核可先开发
6. **飞书卡片 25KB 误传**: 调研子代理发现 4c183cd4 状态盘点 §4.2 提到的"飞书卡片超过 25KB 限制"其实是错的, 官方明示 20 KB. 设计 §9 已写兜底 (拆分多卡 / 图片先 upload / 摘要+深链)
7. **status 盘点 §1.5 P0-D 依赖项** 提到 "scripts/director-monitor.mjs 工作树已写好, commit 后能 5 分钟采一次" — 我没动 director-monitor (它不是我的任务), 它目前在工作树但未 commit, 跟 P0-3 LongTaskOverlay 一样属于"半成品"待主线程 P0-E 部署前 commit

### 4. 任务边界遵守 (严格)

- ✅ 工作目录: `F:\da\shubao\.worktrees\codex-ecommerce-stability`
- ✅ HEAD 从 3ea2241f 推进到 8121d17
- ✅ 分支: `codex/ecommerce-stability`
- ✅ commit 用 `-F file` (写到 .tmp-anno-verify/commit-msg-p0-d-feishu-design.txt)
- ✅ 只 add 自己的 2 份文件 (git diff --cached --stat 验证: 2 files, 878 insertions, 0 deletions)
- ✅ 未部署 (scripts/deploy-production.ps1 未触发)
- ✅ 未触碰 .dsh/ (DSH 还在跑, 0 命中)
- ✅ 未触碰 server/extension_tasks/ (4c183cd4 运行态)
- ✅ 未触碰 dist-codex-build-*
- ✅ 调研派子代理 background 跑, subagent 完成自动 report, 我用 list_agents poll
- ✅ 三遍+查漏: 阶段 1 grep + 子代理调研 + 读 24 URL; 阶段 2 写设计查漏 (5 类卡片 + 6 类触发 + 1 周 MVP + 12 风险)
- ✅ 中文工作过程, 用户能看懂
- ✅ 每完成一阶段 (1 调研完 / 2 设计完 / 3 commit 完) 报告

### 5. 建议主线程的下一步 (按状态盘点 §3.2 #6)

- [ ] 决定 P0-D 实施子代理的派发时机 (建议: P0-A 视频 W5 commit 后)
- [ ] 提交飞书应用 bot 企业审核申请 (5-7 天周期, 越早越好)
- [ ] 排期 shuimg.cn/admin/director 状态页 (P0-D 深链跳转目标, 1-2 天)
- [ ] 决定是否要把 director-monitor.mjs (P0-3 LongTaskOverlay 同类) 一起 commit 部署
- [ ] 本次 commit (8121d17) 与其他 P0 子代理 (P0-3 / P0-C) 的 commit 一起, 由 P0-E 部署子代理统一按 RTK.md §7 走唯一入口发布

### 6. 三遍+查漏 自评

- **第一遍 (入口/触发/截图)**: 找到 director-monitor.mjs (事实源) + MEMORY 凭据登记, 但**没截图** (设计阶段, 不需要 visual 验证)
- **第二遍 (触发前/中/后 eval)**: 
  - 触发前: grep 现有飞书代码 (0 命中) + 读 director-monitor.mjs (35 行, 5min cron) + 读 director-status.json (18 D 项 pending)
  - 触发中: 派调研子代理 background 跑, poll list_agents 2 次确认 status
  - 触发后: 读 368 行调研报告 + 写 510 行设计 + git add 精确 2 文件 + git commit -F + git log -1 验证
- **第三遍 (查漏关联)**: 关联 P0-A/B/C/E 状态变化触发推送 + P1-D 模板库入库触发 + 风险盘点 12 类 (20KB/5QPS/3s 超时/多设备/DSH 双链路) + 凭据走 RTK §4 不入仓 + 用户隐私 /mute /silent /撤回

### 7. 文件清单 (供主线程 review)

- 已 commit: `.superpowers/sdd/2026-08-28-feishu-research.md` (368 行)
- 已 commit: `.superpowers/sdd/2026-08-28-feishu-design.md` (510 行)
- 未 commit (工作树临时): `.tmp-anno-verify/commit-msg-p0-d-feishu-design.txt` (39 行 commit message 草稿, commit 后可清)

### 8. 给主线程的最关键 1 句话

> **P0-D 飞书可视化已完成"调研 + 设计"两阶段 (commit 8121d17, 2 文件 878 行), 实施按 1 周 MVP 边界可上线; 但飞书应用 bot 需企业审核 5-7 天, 建议主线程立即提交审核, 同时让 P0-A 视频 W5 渲染子代理先 commit, 待 W5 完成后 P0-D 实施子代理派单.**

