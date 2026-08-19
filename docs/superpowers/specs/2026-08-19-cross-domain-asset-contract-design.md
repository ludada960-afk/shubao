# 跨创作域资产与项目契约设计

## 背景

薯包目前有电商套图、万物上身、小红书/Plog、自由创作、Canvas 和正在建设的视频导演工作台。图片与视频都需要长期保存素材、版本、来源、项目和恢复状态，但两者的编辑语义不同：图片 Canvas 处理空间编排、图层和导出；视频工作台处理镜头、候选、时间线、音轨和 SkillRun。

当前项目底座已经存在 `projects`、`project_versions`、`project_assets`、`project_asset_lineage`、`canvas_sessions` 和 composition revision。视频工作台另外拥有 `video_workbench_assets`、`video_workbench_asset_versions`、分镜、候选、时间线和项目记忆表。两套表可以共存，但必须明确“共享物理资产身份”和“领域编辑对象”的边界。

## 目标

建立一个跨电商、内容、自由视觉和视频可复用的资产契约，使：

1. 同一个用户和项目中的图片、视频、音频、画布渲染结果都能安全追踪来源、版本和权限。
2. 视频专属的分镜、候选和时间线继续保持独立，不被图片 Canvas 的节点模型污染。
3. 图片工作区可以读取经过授权的视频素材，视频工作台也可以读取图片侧已确认的商品、人物和场景素材。
4. 资产管理动作不改变生成或计费语义；只有生成、重生成、分层、导出等明确动作进入现有服务端计费边界。
5. 两个开发线程拥有清晰的文件边界，任何共享底座变更都有单独测试和审查。

## 非目标

- 不新增或重做电商 SKU 功能；现有 SKU 变体配置继续由电商工作台负责。
- 不把视频时间线、镜头或音轨直接移入 `EcCanvas`。
- 不立即迁移所有历史 `video_assets` 文件；先建立兼容适配和逐步回填路径。
- 不新增第三套品牌、商品或通用资产数据库。
- 不改变现有模型路由、积分价格、支付提供商或生产部署流程。

## 核心边界

### 1. 共享项目边界

`projects` 是跨域项目的权限和生命周期边界。每个领域对象必须带 `owner_email` 和 `project_id`，所有查询必须进行 owner 与 project 双重校验。`project_versions` 表达一次输入/方案/结果的不可变快照；领域表可以引用版本，但不复制另一套项目主表。

### 2. 共享物理资产身份

`project_assets` 是项目内稳定交付资产的规范身份。一个规范资产记录至少由以下信息组成：

```js
{
  projectAssetId: string,
  assetId: string,
  projectId: string,
  versionId: string | null,
  generationRunId: string | null,
  role: string,
  mediaKind: 'image' | 'video' | 'audio' | 'document',
  stableUrl: string,
  contentHash: string,
  mimeType: string,
  width: number | null,
  height: number | null,
  retentionState: 'active' | 'marked' | 'isolated' | 'deleted',
  provenance: object,
}
```

当前表没有 `media_kind` 和独立 provenance 列时，第一阶段不强行破坏现有迁移；由 `mime_type` 推导媒体类型，来源信息进入受限的资产元数据/版本快照，后续再做附加式迁移。不能把外部 URL 当作规范身份，`stableUrl` 只是交付地址。

### 3. 视频领域对象

视频工作台的以下表继续保留为领域对象：

- `video_workbench_assets`：视频项目中的逻辑媒体资产，例如一个角色、一个场景或一段声音的稳定引用。
- `video_workbench_asset_versions`：逻辑资产的版本选择和审批状态。
- `video_storyboard_shots`、`video_shot_candidates`、`video_timeline_clips`、`video_audio_tracks`：镜头和时间线语义。
- `video_skill_runs`、`video_project_memory_facts`、导出 manifest/job：视频流程与回放语义。

视频逻辑资产的版本必须通过 `source_project_asset_id` 指向真实的 `project_assets.id`。原始 `video_assets` 只作为上传/媒体摄取记录，不能直接冒充 `project_assets` 身份。若历史路径暂时只能取得 `video_assets.id`，必须先创建或查找对应的 project asset，再写入视频版本。

### 4. 图片与 Canvas 领域对象

电商套图、万物上身、XHS/Plog 和自由视觉继续使用现有生成任务、作品、项目版本和 Canvas session。Canvas 节点保存 `projectAssetId` 或可验证的稳定资产引用；Canvas 不直接读取视频工作台表，也不复制视频候选状态。需要把视频素材放入 Canvas 时，走“已授权 project asset -> Canvas source node”的导入适配。

### 5. 计费与资产管理

以下动作免费且不产生 wallet mutation：查看资产、切换版本、标记/取消收藏、把已授权素材加入项目、进入 Canvas、读取 provenance。

以下动作继续走现有服务端报价和账务：图片/视频生成、候选重生成、画布重生成、智能分层、PSD/视频导出以及明确消耗上游算力的转换。

## 资产引用规则

优先级固定为：

1. 当前用户且当前项目内的 `project_assets.id`；
2. 领域版本对象中经过 owner/project 校验的 `source_project_asset_id`；
3. 仅用于迁移和读取旧任务的原始 provider/video asset id，不得进入新生成请求作为最终身份。

所有跨域引用必须携带 `{ projectId, projectAssetId, role, expectedContentHash }`。服务端重新读取并校验实际 owner、项目、hash、mime 和 retention state，不能信任浏览器传入的 stable URL 或 email。

## 版本与失效规则

- 新的商品图、人物图、场景图或视频候选生成都会产生新的 project asset 或版本，不覆盖已交付文件。
- 逻辑资产换用新版本时，依赖它的镜头/Canvas 派生对象标记为 `stale`，不会自动重新生成或扣费。
- 用户明确确认后，才允许把新的已验证版本应用到时间线或 Canvas。
- 资产被 retention service 标记时，仍被项目版本、Canvas composition、时间线、候选或作品引用的资产必须保留；删除只发生在没有有效引用且满足留存策略时。

## 线程所有权

### 主线程负责

- 本规格和跨域资产适配契约。
- `server/projects/*`、`src/services/projects.js`、共享 asset helper、作品/恢复模型、`src/pages/EcCanvas/*` 和共享 AppContext 的集成。
- 图片/电商/XHS/自由视觉工作区接入。
- 跨线程集成测试、构建、协作门禁和部署判断。

### 视频线程负责

- `server/videoWorkbenchStore.mjs`、`server/videoWorkbenchRoutes.mjs`。
- `src/pages/VideoStudio/*`、`src/services/videoWorkbench.js`。
- 视频领域表、镜头、候选、时间线、音轨、SkillRun、视频导出和视频专属测试。
- 将视频版本的 `source_project_asset_id` 收敛为真实 `project_assets.id`，不修改图片 Canvas 语义。

### 共享修改规则

共享文件必须由主线程提出 patch 边界，视频线程不得同时修改。视频线程完成视频专属适配后，主线程先审查 diff 和测试，再进行集成回归。任何涉及账务、共享状态、资产权限或生成路由的改动，按 `full` 验收策略处理，但本阶段不部署。

## 验收标准

1. 未登录用户不能读取任何私有项目资产。
2. 用户 A 不能通过 `projectAssetId`、stable URL、video asset id 或伪造 email 读取用户 B 的资产。
3. 视频工作台创建/导入版本时，`source_project_asset_id` 能解析为当前项目真实 `project_assets.id`。
4. 图片素材可以在明确授权后作为视频 shot binding 的输入；视频候选可以作为 Canvas source node 的输入，但两者不复制领域状态。
5. 替换资产版本只标记依赖对象 stale，不自动提交供应商、不扣积分。
6. 失败、重启、重复请求和旧版本引用不会生成重复 project asset 或重复扣费。
7. 所有现有图片、电商、Canvas、视频工作台和账务测试保持通过。
8. 本阶段不调用真实视频或电商生成，不部署生产。
