# AI 视频 P0：可靠媒体与任务底座设计

日期：2026-08-15

状态：设计稿，等待产品书面确认后进入逐文件实施计划

关联文档：

- `docs/superpowers/specs/2026-08-15-ai-video-platform-evidence-and-options.md`
- `docs/superpowers/specs/2026-08-15-ai-video-p0-reliability-audit.md`
- `docs/superpowers/plans/2026-08-14-ai-video-platform-roadmap.md`

## 1. 决策摘要

薯包采用已确认的路线 C：以项目、资产版本和镜头为核心的导演工作台。现有
`VideoStudio` 不重写，继续作为单镜头生成器；本阶段先替换它下面的媒体、任务、
交付、账务和复核底座。

P0 采用以下固定决策：

1. 复用现有项目版本、钱包幂等、租约和 fencing token，不新造第二套通用平台。
2. 视频任务拆成 Job、Attempt、Delivery、Billing 和 Projection 五个可恢复事实。
3. 每次供应商提交只有一个稳定 `submission_key`；未知结果只核验，不自动重提。
4. 先持久化可验证交付，再结算；结算、终态和 Works/项目投影由 durable outbox 收敛。
5. 用户媒体读取必须鉴权；供应商通过短期签名 URL 或适配器直传读取，二者完全分权。
6. 上传采用 tus 1.0 语义和客户端成熟实现，服务端流式落盘；供应商结果也流式持久化。
7. 旧 `video_jobs/video_assets` 先兼容和双写，再回填、校验、切读；任何阶段均可回滚。
8. `needs_review` 不再是终态，而是有自动核验、SLA、运营动作和审计记录的等待态。
9. P0 不增加长片、分镜、时间线、Skill 市场或新的付费模型。

## 2. 目标与非目标

### 2.1 目标

- 同一用户动作在并发、超时、重启和未知提交结果下不重复付费提交。
- 供应商已经成功的结果不会因本地崩溃而永久丢失。
- 任务展示状态与真实交付、冻结、结算和释放状态一致。
- 私有输入素材和输出成片不能被匿名或跨账号读取。
- 大文件上传可暂停、续传、取消和恢复，不整文件占用 Node 进程内存。
- 每个异常都有系统恢复、人工处置或明确的争议隔离路径。
- 运营可以看到失败处在哪一步，而不是只看到一个笼统的“失败”。
- 旧任务、旧作品和旧链接在迁移期继续可读。

### 2.2 非目标

- 不承诺供应商永不失败，也不承诺所有视频都能通过内容审核。
- 不在 P0 实现资产库 UI、分镜、时间线、逐秒重拍、模型智能路由或导演 Agent。
- 不在 P0 扩大用户可见参数数量。
- 不自动执行真实付费视频测试；生产付费验收仍由用户明确触发。
- 不复制 Flova、TapNow、ComfyUI 或其他竞品的受保护代码和 UI。

## 3. 现有系统保留边界

以下模块继续作为唯一事实源或兼容入口：

- `server/projects/*`：项目、不可变版本、生成 run、资产引用和保留策略。
- `server/billing/*`：报价、预授权、结算、释放和账务流水。
- `canvas_billed_action_claims` 的租约、续期、过期回收和 fencing 思路。
- `server/videoProviders.mjs`：供应商能力与调用适配层。
- `server/videoQueue.mjs`：总并发、路由并发和用户公平队列。
- `src/pages/VideoStudio/*`：现有三种视频生成模式和单镜头工作台。
- Works：用户作品投影；它不是生成任务的唯一事实源。

现有 `video_jobs` 和 `video_assets` 在迁移期只作为兼容投影，不再承担完整恢复语义。

## 4. 领域模型

```text
ProjectVersion
  -> ProjectAsset (immutable media version)
  -> VideoJob
       -> VideoAttempt
            -> Provider submission / polling events
            -> Delivery (content-addressed output)
       -> Billing state
       -> Review case (only when evidence is uncertain)
       -> Outbox projections
            -> Works
            -> Project generation run
            -> user/admin notifications
```

### 4.1 VideoJob

Job 表示一次用户确认并预授权的业务动作。Job 保存稳定输入快照、报价快照、产品和路由，
不保存可变供应商轮询细节。

核心字段：

- `id`, `owner_email`, `idempotency_key`
- `project_id`, `source_version_id`, `generation_run_id`
- `product_id`, `provider_route`, `catalog_version`
- `input_snapshot_json`, `quote_snapshot_json`
- `job_state`, `billing_state`, `delivery_state`, `projection_state`
- `hold_id`, `selected_attempt_id`, `result_asset_id`
- `error_code`, `user_message`, `created_at`, `updated_at`, `terminal_at`

唯一约束：`(owner_email, idempotency_key)`。

### 4.2 VideoAttempt

Attempt 表示 Job 的一次供应商执行。普通网络轮询重试不创建新 Attempt；只有运营确认旧
Attempt 未被供应商受理，或用户基于新报价明确重试，才创建新 Attempt。

核心字段：

- `id`, `job_id`, `attempt_no`
- `submission_key`, `request_fingerprint`
- `provider_route`, `provider_task_id`
- `attempt_state`, `provider_state`, `progress`
- `lease_token`, `lease_expires_at`, `fencing_token`
- `submit_started_at`, `accepted_at`, `provider_completed_at`, `delivered_at`
- `last_polled_at`, `next_poll_at`, `poll_failures`
- `provider_request_json`, `provider_response_json`
- `error_code`, `error_detail`, `created_at`, `updated_at`

唯一约束：

- `(job_id, attempt_no)`
- `(provider_route, provider_task_id)`，其中 task id 非空时生效
- `(provider_route, submission_key)`

### 4.3 Event 与 Outbox

`video_job_events` 是只追加的审计事实，按 `event_key` 去重。事件至少包含：

- `job_created`, `hold_created`
- `attempt_claimed`, `submit_started`, `provider_accepted`
- `provider_progressed`, `provider_succeeded`, `provider_failed`
- `download_started`, `delivery_verified`, `delivery_failed`
- `settlement_requested`, `settled`
- `release_requested`, `released`, `compensation_failed`
- `review_opened`, `review_resolved`, `review_quarantined`
- `work_projected`, `project_run_projected`

`video_outbox` 保存必须完成的副作用。每项有独立租约、重试次数、下次执行时间和最后错误。
允许重复执行，但 handler 必须由稳定幂等键保证结果相同。

### 4.4 ProjectAsset 作为不可变媒体版本

P0 不创建独立于项目系统的第三套资产库。扩展 `project_assets`：

- `media_kind`: image/video/audio
- `bytes`, `duration_ms`, `codec`, `frame_rate`, `audio_channels`
- `storage_key`, `proxy_asset_id`, `thumbnail_asset_id`
- `generation_attempt_id`, `source_asset_id`
- `authorization_json`, `metadata_json`

每一行仍是不可变版本；替换、转码或增强产生新行，并通过 `parent_asset_id` 连接。
`content_hash` 用于去重，`retention_class/state` 继续由现有保留服务管理。

没有显式项目的旧 VideoStudio 操作，在创建第一项素材时建立一个 owner-scoped 的
`video_draft` 项目和 source version。该项目对用户透明，但保证媒体从第一天就有归属。

### 4.5 ReviewCase

`video_review_cases` 每个 Job 最多一个打开的 case：

- `reason`: submission_unknown / provider_result_unknown / billing_unknown
- `status`: open / auto_checking / operator_required / resolving / resolved / quarantined
- `evidence_json`, `provider_query_count`, `next_check_at`, `due_at`
- `resolution`, `resolution_note`, `actor_email`, `resolved_at`

ReviewCase 是可处理工作项，不是用户任务终态。

## 5. 状态机

### 5.1 Job 业务状态

```text
draft
  -> queued
  -> running
  -> reconciling
  -> completed
  -> failed
  -> cancelled
  -> disputed
```

- `reconciling` 表示系统仍在确认供应商、交付或账务事实，前端继续低频刷新。
- `completed` 必须同时满足 delivery=verified、billing=settled、projection=complete。
- `failed` 必须满足没有可交付结果，并且 billing=released。
- `disputed` 仅用于无法安全判断是否应结算/释放的少量案例，必须进入运营 SLA。
- `cancelled` 只有在供应商确认取消或尚未提交时成立；仅关闭浏览器不等于取消。

### 5.2 Attempt 状态

```text
created
  -> claimed
  -> submitting
  -> accepted
  -> polling
  -> provider_succeeded
  -> downloading
  -> delivered

submitting -> submission_unknown -> accepted | not_submitted | quarantined
accepted/polling -> provider_failed | provider_cancelled
downloading -> delivery_retry
```

`submission_unknown` 不创建第二次供应商请求。自动核验优先使用：

1. 供应商按 `submission_key` 查询；
2. 供应商按业务时间窗、模型和 request fingerprint 查询；
3. 已知 task id 时继续 get；
4. 无可靠查询能力时转运营复核。

只有 `not_submitted` 被可靠确认后，原 Attempt 才关闭；后续重试必须新建 Attempt 并保留
原证据。

### 5.3 账务状态

```text
none -> hold_pending -> held
held -> settlement_pending -> settled
held -> release_pending -> released
held/settlement_pending/release_pending -> disputed
```

用户文案由账务状态派生：

- `held`: “积分已冻结，成功交付后结算”
- `release_pending`: “正在退回冻结积分”
- `released`: “冻结积分已退回”
- `settlement_pending`: “成片已交付，积分正在结算”
- `settled`: “已交付并结算”
- `disputed`: “账务正在人工核对，不会重复扣费”

严禁在 `releaseItem()` 未确认成功时声称“已退回”。

## 6. 端到端执行流程

### 6.1 创建任务

1. 客户端生成稳定 Idempotency-Key，并提交资产版本 ID，不提交临时 URL。
2. 服务端验证 owner、功能权限、资产项目授权、输入契约和新鲜报价。
3. 一个 SQLite immediate transaction 内：
   - 建立/重放 Job；
   - 建立项目 generation run；
   - 建立首个 Attempt；
   - 记录 `job_created` outbox/event。
4. 钱包创建 hold 使用 `video-hold:{jobId}`。
5. hold 成功后写 `held`；失败则 Job 保持未入队并返回准确错误。
6. 入队只发送 Job ID；worker 必须重新从数据库读取事实。

钱包和 SQLite 无法做分布式事务，因此第 3、4 步之间的崩溃由 reconciliation 处理：

- Job 存在但 hold 缺失：幂等重放 createHold；
- hold 存在但 Job 不可读：通过 hold metadata 恢复或释放；
- 超过 2 分钟未收敛：告警并进入 compensation 队列。

### 6.2 供应商提交

1. worker 用 immediate transaction 获取 Attempt 租约和递增 fencing token。
2. 保存完整的 `submit_started` 事实和稳定 `submission_key` 后才调用供应商。
3. adapter 必须把 `submission_key` 映射到供应商原生 idempotency key；若供应商不支持，
   在能力注册表中声明 `submissionRecovery=manual`。
4. 返回 task id 后先保存 `provider_accepted`，再开始轮询。
5. worker 每 1/3 lease 周期续租；所有写操作携带 fencing token，旧 worker 不能覆盖新 worker。
6. 响应中断且没有 task id 时进入 `submission_unknown`，禁止自动 submit。

### 6.3 交付

1. 供应商状态成功后写 `provider_succeeded`，保存响应摘要和下载定位信息。
2. 创建 content-addressed 临时目标，使用流式下载，边写边计算 SHA-256、字节数和 MIME。
3. 强制执行产品级大小、时长和媒体类型上限；超限立即中止并删除临时文件。
4. 下载完成后执行 ffprobe/媒体解码验证；仅 HTTP 200 不算交付。
5. 原子 rename 到 hash storage key。
6. 一个 transaction 内插入/重放 ProjectAsset、写 `delivery_verified` 和 outbox。
7. 唯一键 `(attempt_id, content_hash)` 防止重复回调或重复下载建立两个结果。

下载中断只重试 delivery，不创建新供应商任务。服务重启后从已保存的 provider success
继续下载。

### 6.4 结算与投影

outbox 按以下依赖执行：

1. `settle_billing`: 使用 `video-settle:{jobId}`，成功后 billing=settled。
2. `project_generation`: 将结果资产绑定 result version，generation run=completed。
3. `work_projection`: 幂等 upsert `_saveKey=video:{jobId}`。
4. `finalize_job`: 三项都满足时 job=completed。

任何一步崩溃都由 outbox 重放。定时 reconciliation 对 completed 任务检查 Works、项目 run
和资产引用，缺失时重新排入对应 outbox，不重新调用供应商。

### 6.5 失败、取消与释放

- 供应商明确失败且无交付：写 release outbox，billing=released 后 job=failed。
- release 失败：billing=release_pending，任务仍显示“正在退回”，指数退避重放并告警。
- 用户取消 queued：立即释放；取消 accepted：先调用 provider.cancel，确认后释放。
- 供应商不支持取消：任务继续运行，界面说明“已停止后续使用，但供应商任务无法中止”；
  若最终交付，按创建时条款进入结算，不能假装退款。
- 内容审核失败属于 provider_failed，保存安全错误分类，不保存敏感原始返回到用户界面。

## 7. 媒体访问与隐私

### 7.1 用户访问

`GET /api/video/assets/:id` 改为登录态访问，并验证：

- owner 匹配；或
- 用户有该项目的明确授权（P0 只有 owner，团队授权留给后续）。

匿名返回 401，跨账号返回 403，不用 404 混淆内部审计。响应使用 `private, no-store` 或
短期 private cache；下载文件名经过清洗。

### 7.2 供应商访问

新增 `GET /api/video/provider-assets/:id?token=...`：

- token 使用服务端密钥 HMAC-SHA256；payload 包含 asset id、attempt id、purpose、expiry、nonce。
- 默认有效期 15 分钟，最大 30 分钟，只允许 GET/HEAD 和单一 asset。
- 过期、用途不符、attempt 已终止或签名不匹配返回 403。
- 日志只记录 token fingerprint，不记录 token。
- 响应 `private, no-store`；不进入共享 CDN 公共缓存。

adapter 如果支持原生文件上传，优先使用原生上传并保存 provider file id，签名 URL 只是
兼容方案。URL 过期时可为同一 Attempt 重新签名，不产生新供应商任务。

### 7.3 密钥轮换

签名 token 带 `kid`。服务端同时接受 current 和 previous 两个 key；轮换窗口 30 分钟后
撤销 previous。密钥只来自生产 secret，不写入数据库、日志或仓库。

## 8. 断点续传与媒体处理

### 8.1 上传协议

客户端采用 MIT `tus-js-client` 的 tus 1.0 语义：

- create upload、HEAD offset、PATCH chunk、DELETE/terminate；
- 默认 chunk 5 MiB，弱网可重试；
- fingerprint 包含 owner、file size、lastModified 和本地文件 fingerprint；
- 上传 UI 展示真实已确认 offset、暂停、继续和取消；
- object URL 在本地解码后立即预览，云上传不阻塞首次可见。

服务端提供 owner-scoped upload session：

- session 保存长度、offset、metadata、hash state、临时路径、expiry 和状态；
- PATCH 必须匹配当前 offset，使用流式 pipeline 写入，不接收整文件 Buffer；
- 单 chunk 和总大小分别限流；
- 完成后校验 hash/MIME/媒体元数据，再建立 ProjectAsset；
- 同一 upload fingerprint 的已完成 session 直接重放资产结果；
- 24 小时未完成 session 自动过期，临时文件由清理任务删除。

服务端固定采用 tus 官方维护、MIT 许可的 `@tus/server` 与 `@tus/file-store`，并集成到
现有 Express 服务；浏览器固定采用官方 `tus-js-client`。实施时把通过兼容测试的精确版本
写入 `package-lock.json`，不使用已经进入仅安全维护状态的旧 `tus-node-server`。薯包自己的
SQLite `media_upload_sessions` 仍是 owner、项目归属、配额、审计和最终资产状态的事实源，
tus 组件只负责协议解析、偏移校验和分块文件写入；鉴权、元数据校验、完成回调和资产转正
由 Express 包装层与 tus hooks 接入。若官方组件在 Windows 开发环境、生产 Linux 文件存储
或现有 owner 鉴权上出现无法通过集成测试的硬冲突，本阶段停在设计变更门，记录证据并重新
评审，不在同一发布中静默回退为自研协议子集。这样避免为了赶进度引入一个表面兼容、实际
不可恢复的上传实现。

### 8.2 输出下载

- 使用 Node stream pipeline 到同盘临时文件，不调用 `arrayBuffer()`。
- 支持下载超时、AbortSignal、最大字节数和空闲超时。
- 进程退出后临时文件带 attempt id；恢复任务可判断继续下载或安全清理。
- 若供应商支持 Range，按已写字节续传；不支持则只重下结果文件，不重生成视频。

### 8.3 代理与缩略图

原文件验证成功后再异步产生：

- 低码率预览代理；
- poster frame；
- 媒体元数据。

代理失败不阻塞原片交付，但进入 outbox 重试；用户在代理未完成前看到明确处理中状态，
不会看到空白播放器。

## 9. API 契约

### 9.1 用户接口

- `POST /api/video/uploads`：创建/重放上传 session。
- `HEAD/PATCH/DELETE /api/video/uploads/:id`：续传、查询、取消。
- `GET /api/video/assets/:id`：鉴权流式读取。
- `POST /api/video/jobs`：现有创建接口，输入改为 project asset version ids。
- `GET /api/video/jobs/:id`：返回派生展示状态和独立 billing/delivery/review。
- `POST /api/video/jobs/:id/cancel`：幂等取消。
- `POST /api/video/jobs/:id/reconcile`：用户触发低频重新核验，不触发 submit。

Job 响应必须包含：

```json
{
  "status": "running",
  "stage": "provider_processing",
  "progress": 42,
  "billing": { "status": "held", "message": "积分已冻结，成功交付后结算" },
  "delivery": { "status": "pending" },
  "review": null,
  "canCancel": true,
  "canReconcile": false,
  "retryAfterMs": 5000
}
```

前端不能根据裸数据库状态自行推测退款或可重试性。

### 9.2 运营接口

- `GET /api/admin/video/reviews`
- `POST /api/admin/video/reviews/:id/recheck`
- `POST /api/admin/video/reviews/:id/bind-provider-task`
- `POST /api/admin/video/reviews/:id/confirm-not-submitted`
- `POST /api/admin/video/reviews/:id/confirm-submitted`
- `POST /api/admin/video/reviews/:id/quarantine`
- `GET /api/admin/video/compensations`
- `POST /api/admin/video/compensations/:id/replay`

所有写操作要求 owner/admin、reason、Idempotency-Key，并写入现有 `admin_audit_log` 的
before/after/evidence。运营不能直接把任务改成 completed；只能提交证据驱动领域动作。

## 10. 前端体验

VideoStudio 保持现有三模式和参数骨架，只调整状态反馈：

- 上传选择后立即显示本地预览和独立进度；失败可从已确认 offset 继续。
- 创建按钮在请求已提交后锁定；刷新页面从 server Job 恢复，不靠组件内存。
- `reconciling` 继续低频轮询，展示“正在核对上游结果，为避免重复扣费不会再次提交”。
- `release_pending` 不显示“退款完成”。
- 成片已交付但代理处理中时显示 poster/skeleton 和下载原片入口。
- 每个失败显示稳定错误码、是否已释放、可执行动作和任务 ID。
- 重试只有两类：继续同一 Job 的核验/交付；或用户确认新报价后创建新 Job。按钮文案必须
  区分二者。
- 页面卸载不会取消任务；用户必须明确点击取消。

## 11. 运营可观测性与 SLO

### 11.1 指标

按供应商、模型、模式、输入类型和产品统计：

- submit unknown rate
- provider acceptance/success rate
- time to first provider progress
- provider completion latency
- delivery verification latency
- output download retry rate
- release pending count/age
- review open count/age/SLA breach
- outbox backlog/oldest age
- duplicate submission prevented count
- orphan/reconciled asset count
- cost per delivered second、毛利和退款释放

### 11.2 P0 SLO

- 同一 submission key 重复供应商提交：0。
- 已验证交付但 10 分钟内未完成投影：0；否则告警。
- release_pending 5 分钟未收敛：告警；30 分钟转运营。
- review open 15 分钟未自动收敛：运营队列；2 小时未处理：高优先级告警。
- outbox 最老 pending 超过 5 分钟：告警。
- 匿名或跨账号资产读取成功：0。
- 本地预览在浏览器成功解码后 300ms 内出现；云上传不阻塞预览。

这些是平台可靠性目标，不把供应商本身的生成成功率伪装成 100%。

## 12. 数据迁移与灰度

### 12.1 Feature flags

- `VIDEO_RELIABLE_JOBS_WRITE`
- `VIDEO_RELIABLE_JOBS_READ`
- `VIDEO_TUS_UPLOADS`
- `VIDEO_SIGNED_PROVIDER_ASSETS`
- `VIDEO_REVIEW_OPERATIONS`

所有 flag 默认关闭；测试环境逐项打开，生产按 owner allowlist 灰度。

### 12.2 迁移阶段

1. **Schema only**：新增表/列/索引，不改现有读写。
2. **Shadow write**：旧任务继续主流程，新结构同步记录；差异只告警。
3. **Backfill**：按 owner 和时间窗回填旧 Job/Asset，生成迁移报告。
4. **Shadow reconcile**：比较旧状态、钱包事实、新派生状态和 Works。
5. **Canary read**：内部 owner 从新状态读取，仍保留旧读取降级。
6. **Canary execute**：只对明确 allowlist 的新任务使用 Attempt/outbox。
7. **General read/write**：指标稳定后扩大。
8. **Legacy freeze**：停止旧表主写但保留兼容投影；至少一个发布周期后再评估清理。

回填不得调用供应商、不得重新结算、不得改变旧作品。无法确认的历史记录标记
`legacy_unknown`，不伪造交付事实。

### 12.3 回滚

- 任一新 flag 可独立关闭。
- 新表是附加结构，关闭新读后旧接口继续读取旧投影。
- 已经由新状态机接管的 Job 不回到旧 worker，避免双 worker；只关闭新任务准入并让现有
  Attempt 收敛。
- 签名访问回滚时仍保持用户鉴权；不能为了回滚重新开放匿名资产。
- 数据迁移只追加和双写，不删除旧记录。

## 13. 故障测试矩阵

实施必须先写失败测试，再写代码。至少覆盖：

| 故障点 | 预期结果 |
| --- | --- |
| 匿名/跨账号读资产 | 401/403，文件零字节泄露 |
| 签名过期、篡改、错误 attempt/purpose | 403，不访问文件 |
| 并发创建相同 idempotency key | 一个 Job、一个 hold、一个 Attempt |
| worker 取得租约后被另一 worker 回收 | 旧 fencing token 的写入失败 |
| submit 请求已发出、响应前断线 | submission_unknown；零自动重提 |
| 供应商按 submission key 找回 task id | 绑定原 Attempt 并继续轮询 |
| provider success 后进程退出 | 重启后继续 delivery，不重生成 |
| 下载中断/超限/错误 MIME | 临时文件清理；只重试下载 |
| 重复 success webhook/轮询结果 | 一个 ProjectAsset |
| delivery 后、settle 前崩溃 | 重放 settle，一次扣费 |
| settle 后、Works 前崩溃 | 补投影，不再扣费/生成 |
| releaseItem 暂时失败 | release_pending + outbox；文案不声称退款 |
| outbox handler 执行后、ack 前崩溃 | 幂等重放，结果不重复 |
| 上传断网后恢复 | offset 继续，hash 和最终文件正确 |
| 错误 offset/超限 chunk | 409/413，session 不损坏 |
| 用户删源资产时 Job 仍运行 | 引用保护拒绝删除 |
| review 人工动作重复提交 | 一个审计结果，无重复结算/释放 |
| migration flag 回滚 | 旧读可用，新接管 Job 不被旧 worker 抢占 |

另做随机 kill-process 测试：在每个 event/outbox 边界终止 worker，重启后最终事实必须收敛。

## 14. 安全与保留

- 上传只信任服务端嗅探 MIME，不信任文件名和请求头。
- 文件路径永远使用生成的 storage key，禁止用户值进入路径。
- prompt、供应商响应和审核信息按敏感数据处理；管理日志做字段白名单和长度限制。
- ProjectAsset 被活跃 Job、Works、ProjectVersion 引用时不能清理。
- 未完成上传 24 小时过期；失败临时下载 24 小时内清理；争议 Job 的证据在结案前保护。
- 用户删除项目后按现有回收站/保留策略执行，不立即破坏账务和审计证据。
- 签名密钥、供应商凭据和 session token 不进入事件 payload。

## 15. 主要风险与改进约束

### 15.1 SQLite 写竞争

风险：事件、进度和 outbox 高频写入会放大单写者竞争。

约束：进度事件按 5% 或 10 秒节流；事务保持短小；长 IO 全部在事务外；生产指标达到
写锁阈值后再评估 PostgreSQL，不能在 P0 无证据迁库。

### 15.2 Outbox 变成新的死队列

风险：引入 outbox 但没有租约、告警和后台可见性，只是把失败藏到另一张表。

约束：每项有 next_attempt、lease、最大退避和 dead-letter；运营后台显示 backlog 和最后错误；
reconciliation 能重建缺失 outbox。

### 15.3 供应商不支持幂等查询

风险：无法判断 submission_unknown 是否已计费。

约束：能力注册表明确标注；此类路由保持人工复核，不自动重提；提交证据包含 request hash、
时间窗和上游响应摘要；长期优先采购支持幂等和 webhook 的路由。

### 15.4 断点续传增加攻击面

风险：临时文件堆积、offset 欺骗、越权续传和磁盘耗尽。

约束：owner-scoped session、严格 offset、总配额、expiry、磁盘水位拒绝、清理监控和完成 hash。

### 15.5 “统一资产”演变成大爆炸重构

风险：同时迁移图片、电商、画布和视频，破坏已上线链路。

约束：只扩展现有 `project_assets` 的兼容字段，P0 只迁视频；旧图片路径不改。P1 再基于
真实数据决定是否抽取独立媒体服务。

### 15.6 用户被复杂状态淹没

风险：把内部 attempt/outbox/billing 术语直接暴露给普通用户。

约束：前端只显示“排队、生成、交付、核对、完成、未完成”及准确账务句子；完整技术状态只在
管理员和诊断详情中出现。

## 16. P0 退出门槛

以下全部满足才进入 P1 资产库/分镜/时间线：

1. 全部故障矩阵自动化通过。
2. 资产 owner、签名和缓存安全测试通过。
3. 并发、重启和 unknown submission 下没有重复 supplier submit。
4. delivery、settlement、Works、project run 可由 reconciliation 自动收敛。
5. release_pending 与 review case 有告警、SLA、后台动作和审计。
6. 大文件上传可续传，输入/输出不整文件缓冲。
7. shadow write/backfill 差异为零或全部有书面分类。
8. 全量现有回归、生产构建、公开只读视频契约和浏览器 QA 通过。
9. 生产灰度在不触发自动付费视频的条件下验证上传、鉴权、状态和回滚；真实付费任务只由
   用户明确授权。
10. RTK 和运营手册记录当前 flag、迁移批次、监控入口和回滚方法。

## 17. 设计结论

这套 P0 设计可执行，因为它没有把竞争力押在新模型或一次性大重构上，而是组合薯包已经
验证过的项目版本、幂等钱包、租约、队列、供应商适配和 Works 投影，并用 attempt、event、
outbox、签名读取和 resumable upload 补齐已由代码证明的故障窗口。

它也明确限制了风险：先兼容双写、再灰度切读；未知提交绝不自动重提；退款只按账务事实
展示；P0 不碰分镜和时间线。书面确认本设计后，下一步是编写逐文件、逐测试、逐提交的实施
计划，再按 TDD 分批实现和部署。
