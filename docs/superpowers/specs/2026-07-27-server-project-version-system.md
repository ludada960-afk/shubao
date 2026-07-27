# 服务端项目版本与创作闭环设计

## 1. 目标

建立统一的服务端项目与版本系统，使电商、小红书和 Plog 的编辑、生成、恢复、作品、画布与计费都围绕同一个明确生命周期运行。

产品必须满足以下原则：

- 新访问永远从空白项目开始。
- 历史项目只能由用户主动打开。
- 只有登录、额度不足、生成异常等未闭环任务可以恢复。
- 已完成任务进入作品后立即关闭当前创作闭环。
- 前端缓存不是业务事实源，服务端项目、版本、任务和资产才是事实源。
- 普通用户与无限测试账号看到相同的市场化界面，仅计费执行不同。

## 2. 范围

本次覆盖：

- 电商、小红书和 Plog 的项目生命周期。
- 服务端项目、版本、生成任务、画布会话、资产和恢复检查点。
- 登录态权威校验与统一失效处理。
- 电商逐图镜头规划和证据约束。
- 画布命令、派生关系、保存与恢复。
- 计费对象与项目版本、生成任务的映射。
- 资产保留、到期提示和安全清理。
- 现有本地草稿、作品和画布状态的兼容迁移。

本次不接入支付宝或微信，不实现多人协作，不提供无限历史版本，也不把浏览器缓存当作离线编辑系统。

## 3. 领域模型

### 3.1 Project

`projects` 表示一次独立创作：

```js
{
  id,
  ownerId,
  kind: 'ecommerce' | 'xiaohongshu' | 'plog',
  title,
  status: 'editing' | 'running' | 'needs_review' | 'completed' | 'abandoned' | 'deleted',
  headVersionId,
  acceptedVersionId,
  createdAt,
  updatedAt,
  completedAt,
  deletedAt
}
```

首页没有“当前永久项目”。用户开始输入时只创建浏览器内存会话；首次需要持久化的边界是开始收费生成、生成前保存、异常恢复或用户明确保存项目。

### 3.2 ProjectVersion

`project_versions` 保存不可变快照：

```js
{
  id,
  projectId,
  parentVersionId,
  reason: 'generation' | 'manual_save' | 'canvas_save' | 'accepted_result' | 'migration',
  sequence,
  inputSnapshot,
  planSnapshot,
  canvasSnapshotId,
  createdAt
}
```

版本创建后不原地修改。继续编辑会从选定版本派生新版本，避免旧任务、旧报价和旧提示词被后续输入覆盖。

### 3.3 GenerationRun

现有电商任务和内容任务迁移为统一的 `generation_runs` 业务视图，底层仍可复用当前耐久任务表：

```js
{
  id,
  projectId,
  sourceVersionId,
  resultVersionId,
  ownerId,
  kind,
  status: 'quoted' | 'held' | 'queued' | 'running' | 'needs_review' | 'completed' | 'failed' | 'cancelled',
  quoteId,
  holdId,
  progress,
  errorCode,
  createdAt,
  completedAt
}
```

任务、报价和冻结额度永远绑定同一 `sourceVersionId`。输入变化后必须创建新版本并重新报价。

### 3.4 Asset

`project_assets` 统一登记产品原图、参考图、生成图、预览图和导出文件：

```js
{
  id,
  ownerId,
  projectId,
  versionId,
  generationRunId,
  role: 'product_source' | 'reference' | 'generated' | 'preview' | 'export',
  parentAssetId,
  contentHash,
  stableUrl,
  mimeType,
  width,
  height,
  expiresAt,
  retentionClass,
  createdAt,
  deletedAt
}
```

资产删除使用引用关系和延迟回收。仍被版本、作品、任务、画布或账务事件引用的文件不得物理删除。

### 3.5 CanvasSession

`canvas_sessions` 是编辑会话，不等同于作品：

```js
{
  id,
  ownerId,
  projectId,
  baseVersionId,
  status: 'active' | 'saved' | 'discarded' | 'expired',
  revision,
  snapshot,
  expiresAt,
  createdAt,
  updatedAt
}
```

从作品进入画布时创建全新会话，只导入作品图片。只有用户明确打开已保存项目时才恢复节点、连线和视口。

### 3.6 RecoveryCheckpoint

`recovery_checkpoints` 只描述未闭环事件：

```js
{
  id,
  ownerId,
  projectId,
  versionId,
  generationRunId,
  reason: 'payment_required' | 'generation_interrupted' | 'session_interrupted',
  status: 'available' | 'consumed' | 'dismissed' | 'expired',
  expiresAt,
  createdAt
}
```

检查点不得自动填充首页。新访问显示空表单，并在独立的折叠区域展示“未完成任务”。用户点击后才恢复。

## 4. 生命周期

```text
fresh
  -> editing_in_memory
  -> version_saved
  -> quoted
  -> held
  -> running
  -> completed | needs_review | failed | cancelled
  -> accepted_work
  -> closed
  -> fresh
```

### 4.1 正常闭环

1. 用户在空白首页输入内容，状态只保存在当前组件内存。
2. 点击生成时，服务端创建项目和不可变输入版本。
3. 服务端报价、冻结额度并创建生成任务。
4. 成功资产逐张登记并推送进度。
5. 完整成功后创建结果版本和作品。
6. 前端收到稳定完成事件后清空当前表单、文件、参数和任务引用。
7. 再次访问首页时始终是新项目。

### 4.2 登录中断

- 登录弹窗不导航，不卸载当前创作组件。
- 邮箱或验证码不得持久化；重新发码必须清空旧验证码。
- 登录完成后在原位置继续，当前内存输入仍在。
- 页面刷新或关闭意味着放弃未提交输入，不创建历史草稿。

### 4.3 额度不足

- 在服务端保存项目版本和 `payment_required` 检查点。
- 关闭弹窗后仍停留原步骤。
- 新访问不自动恢复，只展示未完成任务入口。
- 余额到账后重新获取报价，用户主动点击“继续生成”。

### 4.4 生成中断

- 已创建的服务端任务继续运行，不依赖页面存活。
- 导航到作品或画布时，任务以全局折叠进度入口存在。
- 重新进入时按任务 ID 查询，不重复提交上游请求或重复冻结额度。
- 完成后进入作品；失败、部分完成和待审核均提供明确的补跑、接受或结束动作。

### 4.5 完成与清理

- `completed` 只有在稳定资产落盘、质量门通过、账务结算成功和作品创建成功后才成立。
- 完成后撤销恢复检查点并清理浏览器中的旧草稿、旧任务引用和旧画布自动恢复键。
- 旧项目只在“我的项目”或“我的作品”中打开，不回填首页。

## 5. 登录态

- 应用启动时本地 token 只能表示“待验证”，不能直接表示已登录。
- 前端调用服务端会话验证接口，成功后才进入已登录状态。
- 所有受保护接口共享同一 401 处理器。
- 服务端判定会话失效时，前端原子清理 token、用户信息、账务请求、验证码状态和当前私有恢复列表。
- 登录失效不删除服务端项目和任务；用户重新认证后可以从未完成任务入口继续。
- 登录页面不显示“内测”“已开通权限”等内部运营信息。

## 6. 电商逐图镜头导演

每个计划项必须包含结构化 `shotIntent`，而不是只写不同用途名称：

```js
{
  type: 'identity' | 'feature' | 'usage_scale' | 'alternate_angle' |
    'open_state' | 'material_macro' | 'component_relationship' |
    'exploded_view' | 'packaging',
  camera: { elevation, azimuth, distance, lensIntent },
  productOrientation,
  interactionState,
  crop,
  scaleInFrame,
  requiredVisibleFeatures,
  evidenceTier: 'safe' | 'conditional' | 'confirmed_only',
  allowedInferences,
  forbiddenMutations,
  fallbackIntent
}
```

### 6.1 证据层级

- `safe`：围绕已知几何改变相机方位、裁切、光线和使用场景。
- `conditional`：只有类别常识和上传素材共同支持时，才允许打开状态、手持方式或组件交互。
- `confirmed_only`：爆炸图、内部结构和拆解关系必须有可见组件或参考素材证据，不得虚构工程结构。

### 6.2 单张产品图

用户只上传一个角度时，系统仍应规划可验证的角度变化、尺度、材质、使用状态和场景，但必须维持轮廓、Logo、开孔、按键、纹理、配色和组件数量。证据不足的高风险镜头自动降级为安全的侧前方角度、局部特写或使用尺度图。

### 6.3 逐图差异

- 主图、白底图、卖点图和详情图使用不同的构图契约。
- 每个计划项必须具有唯一的信息目标与镜头意图。
- 同一套图不得只更换背景并重复商品角度。
- 单张输出必须是单一成片，禁止拼贴、五宫格、联系表和多方案合集。
- 质量门增加套图级重复度检测；角度、裁切和信息目标过度重复时只补跑重复项。

## 7. 画布命令体系

建立唯一 `canvasActionRegistry`，右键菜单、端口拖线和其他入口只能引用该注册表，不得各自维护动作列表或执行器。

### 7.1 左键

左键负责选中和即时操作：预览、裁切、布局、下载、删除和“图片信息”。左键工具条不直接启动需要生成节点的 AI 工作流。

### 7.2 右键与端口拖线

右键展示完整上下文命令；端口拖线展示同一注册表中的派生命令。两者必须调用同一 dispatch，创建相同类型的子节点、连线、报价和任务。

标准命名：

- 商品图改造
- 商品抠图
- 局部重绘
- 智能扩图
- 高清修复
- 智能分层
- PSD 分层导出

“改图名”和“改用途”合并为“图片信息”。

### 7.3 派生规则

- 未执行的动作选择器不是图片节点，不能再次派生。
- AI 动作成功后生成新的结果节点，并与直接输入图片相连。
- 新结果节点可以继续派生，形成明确的单父版本链。
- 多参考图通过显式“补充参考”加入，不把所有祖先图片隐式发送给模型。
- 连线锚点按节点边界中心计算，缩放、平移和拖动后保持吸附。

## 8. 计费映射

- 报价绑定 `projectId + sourceVersionId + action + assetPlanFingerprint`。
- 冻结额度绑定 `generationRunId`，逐资产成功结算，失败释放。
- 项目版本变化使旧报价失效，但不影响已运行任务。
- 小红书和 Plog 继续按完整九图一文的 `content_set` 收费。
- 电商继续按逐张和功能消耗 `ec_points`。
- 方案重新分析提供明确免费次数；超过免费次数必须报价并产生版本。
- 无限账号不扣真实余额，但完整记录用户可见报价、shadow usage 和真实上游成本。

## 9. API 边界

新增或统一以下资源接口：

```text
POST   /api/projects
GET    /api/projects
GET    /api/projects/:projectId
POST   /api/projects/:projectId/versions
GET    /api/projects/:projectId/versions
POST   /api/projects/:projectId/generation-runs
GET    /api/generation-runs/:runId
POST   /api/generation-runs/:runId/actions
GET    /api/recovery-checkpoints
POST   /api/recovery-checkpoints/:id/consume
POST   /api/recovery-checkpoints/:id/dismiss
POST   /api/canvas-sessions
PATCH  /api/canvas-sessions/:id
POST   /api/canvas-sessions/:id/save
DELETE /api/canvas-sessions/:id
GET    /api/session
```

所有资源必须以签名会话解析 owner，不能信任请求体中的邮箱。写操作使用幂等键和乐观版本号；跨用户访问返回 404，避免泄露资源存在性。

## 10. 保留与清理

| 数据 | 默认期限 | 行为 |
|---|---:|---|
| 未提交临时上传 | 24 小时 | 到期延迟回收 |
| 恢复检查点 | 24 小时 | 过期后不再展示 |
| 未完成任务 | 7 天 | 到期前提示，过期后结束并释放可释放额度 |
| 未归档原始素材 | 7 天 | 无引用才删除 |
| 已完成作品 | 30 天 | 显示到期时间，套餐可延长 |
| 已保存项目 | 按套餐 | 保留版本与引用资产 |
| 活动画布会话 | 24 小时 | 未保存会话过期 |

清理任务先标记、后隔离、再物理删除。任何运行中任务、账务争议、作品、项目版本或保存画布的引用都会阻止物理删除。

## 11. 兼容迁移

1. 新表以可重复迁移创建，不修改现有账本语义。
2. 现有已完成电商、小红书和 Plog 作品按需懒迁移为 `completed` 项目和接受版本。
3. 现有运行中任务首次读取时挂接到迁移项目，不重新提交上游。
4. 前端升级后删除旧的账号级电商草稿和产品名级画布自动恢复键。
5. 旧 localStorage 作品只可一次性导入为历史作品，不得自动回填首页。
6. 数据库迁移、部署和回滚都不得删除运行时数据库或资产目录。

## 12. 错误处理

- 所有错误使用稳定代码：认证失效、报价过期、余额不足、版本冲突、任务运行中、资产过期、上游限流和质量失败分别处理。
- 可重试错误保留同一任务和幂等键；不可重试错误结束任务并释放未结算额度。
- 部分完成进入 `needs_review`，不冒充完整成功。
- 前端错误提示面向电商卖家和创作者描述下一步，不暴露模型名、代理端点、内部账号或部署状态。
- 任务与资产写入成功但页面响应丢失时，客户端通过幂等键和任务查询恢复，不重复收费或生成。

## 13. 验收

### 13.1 生命周期

- 完成任务、退出再登录或重新访问首页后，上传区、提示词和参数均为空。
- 登录弹窗成功后原页面输入仍在，刷新后未提交输入消失。
- 额度不足和生成中断会出现在折叠恢复入口，且不会自动覆盖空白表单。
- 已完成作品只能主动打开，不成为新项目默认输入。

### 13.2 登录

- 本地存在过期 token 时不会先渲染为已登录。
- 任一受保护接口返回会话失效后，全局状态一致退出。
- 验证码不跨发送周期、退出登录或页面重新打开保留。

### 13.3 画布

- 从作品导入时不恢复旧节点、连线或视口。
- 左键、右键和拖线不存在重复且行为不同的 AI 动作。
- 所有派生动作生成正确父子节点，未执行选择器不能继续派生。
- 连接线在移动、缩放和滚动后仍吸附端口中心。

### 13.4 生图

- 套图每张具有独立信息目标、镜头方位和商品状态。
- 单产品图能产生证据允许的不同角度、材质、尺度和使用图。
- 证据不足时不会虚构开盖、内部结构、组件数量或爆炸关系。
- 输出不存在五宫格、拼贴或仅更换背景的重复套图。
- 重复度质量门可以定向补跑单张，不重复生成整套。

### 13.5 计费与恢复

- 项目版本、报价、冻结、任务和逐图结算形成可追踪闭环。
- 请求重放、刷新、断线和服务重启不重复收费或重复调用上游。
- 部分成功只结算成功资产，失败资产释放额度。
- 无限账号看到普通用户价格，但只产生 shadow usage。

### 13.6 回归与生产

- 新增数据库、服务、前端模型和 UI 流程的单元与集成测试。
- 全量测试、构建、导出校验和协作检查通过。
- 桌面与移动端真实浏览器验证完整创建、登录、恢复、作品和画布流程。
- 生产部署仅使用 `scripts/deploy-production.ps1`。
- 部署后验证会话、健康接口、项目 API、真实生成、账务、作品稳定 URL 和 600 秒 canary。

## 14. 实施边界

实施分为可独立回滚的阶段：

1. 数据模型、迁移和项目服务。
2. 会话权威校验和恢复检查点。
3. 首页生命周期与三种创作模式接入。
4. 电商镜头导演和套图重复度质量门。
5. 画布命令注册表、会话与几何。
6. 资产保留和清理任务。
7. 全量迁移、浏览器 QA、部署与 canary。

每一阶段必须先写失败测试，再实现、回归、独立提交和更新进度账本。任何阶段失败都不得绕过验证继续部署。
