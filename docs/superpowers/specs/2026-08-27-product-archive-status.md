# 商品档案 (project_assets) 现状盘点 · 2026-08-27

> 4c183cd4 主线 V3 续命线 4: 商品档案重构 + 孪生项 A patch 验证
> 盘点时间: 2026-08-27 / HEAD `6475f1bd` (codex/ecommerce-stability worktree)
> 盘点范围: 已 commit 入库的 44 个项目档案相关 commit + 30 个 product-profile / project 前端 commit
> 盘点人: 商品档案子代理 (主线程 4c183cd4 委派)

---

## 1. 已实现 (按层)

### 1.1 数据库层 (server/projects/schema.mjs)

`ensureProjectSchema(db)` 一次创建 13 张表, 全部含 `owner_email` + 索引 + 外键:

| 表 | 字段要点 | 关键外键 |
|---|---|---|
| `projects` | id / owner_email / kind (4 种) / status / head_version_id / accepted_version_id / legacy_work_key | 主表 |
| `project_versions` | 不可变快照, `input_snapshot` / `plan_snapshot` / `canvas_snapshot_id`, UNIQUE(project_id, sequence) | FK projects(id) |
| `project_generation_runs` | kind / status / quote_id / hold_id / progress | FK projects(id) |
| `recovery_checkpoints` | expires_at, status 状态机 | FK projects(id) |
| `canvas_sessions` | revision, expires_at, status active/expired | FK projects(id) |
| `composition_documents` | width / height / color_space / revision | FK projects(id) |
| `composition_revisions` | layers JSON / background_asset_id / rendered_asset_id | FK composition_documents |
| `project_assets` | role / content_hash / stable_url / mime_type / width/height / metadata_json / **retention_class** / **retention_pinned** / **retention_state** / **production_state** / **marked_at** / **isolated_at** | FK projects(id) |
| `project_asset_lineage` | source/target + relation + generation_run_id | FK projects(id) + FK project_assets ×2 |
| `product_profiles` | name / category / facts_json / status active/archived | 主表 |
| `product_profile_variants` | ordinal / label / color / spec / size / capacity / dim_label / count | FK product_profiles ON DELETE CASCADE |
| `product_profile_assets` | project_id / project_asset_id / role / expected_content_hash | FK product_profiles ON DELETE CASCADE |
| `product_profile_idempotency_keys` | owner+route+idempotency_key 唯一 | 主表 |
| `project_idempotency_keys` | 同上 for projects | 主表 |

**关键 schema 决策** (从字段命名 + CASCADE 模式看出):
- **product_profiles 隔离**: 完全独立表, 不复用 project_assets 主表, 但通过 product_profile_assets 弱引用 (owner + project_id + project_asset_id + role + expected_content_hash).
- **retention 三态**: `retention_class` (transient/durable/completed/permanent) + `retention_pinned` 锁定 + `retention_state` (active/marked/isolated).
- **production_state** 4 态机: draft → candidate → delivered → archived, 含 4 套状态转换矩阵 (USER_PROJECT_ASSET_PRODUCTION_TRANSITIONS).
- **CASCADE 仅在 product_profile_variants/asset → product_profiles**: 即档案被删时变体与引用级联删除, 但 project 删时 project_asset 走软删 (`deleted_at`) 不级联物理删.

### 1.2 Store 层 (server/projects/projectStore.mjs, 1829 行)

`createProjectStore(db, { randomUUID, now, checkpointTtlMs, canvasTtlMs })` 返回 api 对象, 39 个方法:

**商品档案 (8 个)** + **项目 12 个** + **画布 4 个** + **生成 6 个** + **checkpoint 5 个** + **杂项 4 个**.

**安全机制** (从代码注释与 import 看):
- `isReusableProjectAsset(asset, now)` 决定素材能否被新创作引用 (mark/expire 阻断)
- `validateProductProfileAssets(owner, assets)` 二次校验: owner + content_hash + isReusable
- `assertCanvasSnapshotAssets(owner, snapshot)` 画布快照引用校验
- 全部写入走 `db.transaction(...).immediate()`, 失败抛 coded error
- 幂等键防重 (createProject / createProductProfile / updateProductProfile), fingerprint 比对防 misuse

### 1.3 路由层 (server/projects/projectRoutes.mjs, 477 行)

30 个 endpoint, mount 在 server/index.mjs:761 `mountProjectRoutes(app, { ... })`:

```
GET    /api/session
GET    /api/projects
POST   /api/projects                              (idempotent)
GET    /api/product-profiles
POST   /api/product-profiles                      (idempotent)
GET    /api/product-profiles/:profileId
PATCH  /api/product-profiles/:profileId           (idempotent)
POST   /api/product-profiles/:profileId/archive
POST   /api/product-profiles/:profileId/assets/attach

GET    /api/project-assets
GET    /api/projects/:projectId
GET    /api/projects/:projectId/assets
POST   /api/projects/:projectId/assets/register-generated
POST   /api/projects/:projectId/assets/import-media
GET    /api/projects/:projectId/assets/:assetId/lineage
PATCH  /api/projects/:projectId/assets/:assetId/retention
PATCH  /api/projects/:projectId/assets/:assetId/production-state
POST   /api/projects/:projectId/assets/:assetId/library
POST   /api/projects/:projectId/library
GET    /api/projects/:projectId/assets/:assetId

POST   /api/projects/:projectId/versions
POST   /api/projects/:projectId/checkpoints
POST   /api/projects/:projectId/complete
GET    /api/recovery-checkpoints
POST   /api/recovery-checkpoints/:checkpointId/consume
POST   /api/recovery-checkpoints/:checkpointId/dismiss

POST   /api/canvas-sessions
GET    /api/canvas-sessions/:sessionId
POST   /api/canvas-sessions/:sessionId/save
PATCH  /api/canvas-sessions/:sessionId
```

错误码完整: AUTH_SESSION_*, PROJECT_NOT_FOUND / VERSION_NOT_FOUND / DOCUMENT_NOT_FOUND, PROJECT_ASSET_NOT_FOUND / NOT_REUSABLE / PURPOSE_INVALID / RETENTION_INVALID / PRODUCTION_STATE_INVALID / TRANSITION_INVALID, VIDEO_ASSET_*, IMAGE_ASSET_*, PROJECT_MEDIA_IMPORT_UNAVAILABLE, GENERATED_ASSET_*, VERSION_CONFLICT, CANVAS_ASSET_NOT_FOUND, PRODUCT_PROFILE_*, IDEMPOTENCY_KEY_REQUIRED / CONFLICT.

### 1.4 Importer 三件套 (server/projects/*AssetImport.mjs)

- `createImageProjectAssetImporter({ projectStore, assetUploadService, readGeneratedAsset })` - 接受 IMAGE_ASSET_ID_RE = /^[a-f0-9]{64}\.(jpg|png|webp)$/
- `createVideoProjectAssetImporter({ projectStore, readVideoAsset })` - 接受 mediaKind=image/video/audio, mime 前缀校验, sha256 64hex
- `createGeneratedProjectAssetImporter({ projectStore, readGeneratedAsset })` - 接受 GENERATED_ASSET_RE 同样格式

全部 mount 进 server/index.mjs (line 327/333/340), 各自的 register-generated / import-media / attach endpoint 走它们.

### 1.5 契约层 (server/projects/productProfileContract.mjs, 189 行 + projectAssetContract.mjs, 95 行)

- `MAX_NAME_LENGTH=160`, `MAX_CATEGORY_LENGTH=80`, `MAX_FACT_LENGTH=500`, `MAX_FACT_COUNT=32`, `MAX_VARIANTS=100`, `MAX_VARIANT_TEXT_LENGTH=120`, `MAX_ASSET_REFS=128`
- `FACT_ALIASES` 把 product_name/productName/category/material/dimensions/size/base_color/baseColor/accent_color/accentColor/craft/selling_points/sellingPoints/restrictions/usage/target_audience/targetAudience 都规整为 camelCase
- `ASSET_ROLES = {product, reference, person, scene, generated}`
- `PRODUCT_PROFILE_STATUSES = ['active', 'archived']`
- `VARIANT_FIELDS = [label, color, spec, size, capacity, dimLabel]`
- `publicProjectAssetMetadata` 安全 metadata 投影 (过滤控制字符 + 长度限制 + 64 源/2k 8k metadata 容量)

### 1.6 前端 (src/pages/Home/ec/ + src/services/projects.js)

4 个核心 commit, 全入库:

| commit | 标题 | stat |
|---|---|---|
| 5b8d189d | feat: unified archive - canvas asset recovery + product profile + video storyboard fields | 60+ 文件, ~9k 行, 主合并 |
| 0c439730 | feat(ecommerce): product-profile system with tabbed rail, current-product chip and generation auto-archive | 11 文件, +1201 -61 |
| ed5fa7e4 | fix(home): product profile as overlay drawer per WeShop benchmark, unified chip tokens; tryon banners rebuilt with full-ratio production images | 8 文件, +189 -104 |
| 613945d5 | fix(ecommerce): single-entry product chip opens drawer, drop edge rail button, unify four mode panel widths at 1200 | 8 文件, +123 -235 |

新建文件:
- `src/pages/Home/ec/EcProfileRail.jsx` + `EcProfileRail.css` (570+ 行 css) - tabbed shelf rail
- `src/pages/Home/ec/ProductChip.jsx` - 当前商品 chip
- `src/services/projects.js` - 客户端 product-profiles API 包装

入口归一: `src/pages/Home/CreationShowcase.css` + `VideoStudio.css` 4 个 mode 统一 1200 宽度, 单 ProductChip 入口, 去除 edge rail 按钮.

### 1.7 测试覆盖

全 `test/` 共 2354 个 test, 全跑 `2342 pass / 12 fail / 0 skip` (74s, 跑时 2026-08-27). 12 个 fail 全在 billing/pricing/video-workbench, 与商品档案无关.

档案相关测试:
- product-profile-attach / contract / model / retention / routes / shelf-model / shelf-ui / store
- project-asset-contract / asset-library-model / client / lifecycle-model / retention / routes / version-store
- project-image-asset-import / project-video-asset-import / project-generated-asset-import / project-legacy-migration
- product-profile-store / routes / contract / retention / shelf-model / attach

**覆盖到位** ✅

### 1.8 4c183cd4 调研家 4 项的修复状态

| V3 调研子代理 | 现状 | 关键 commit |
|---|---|---|
| 商品档案 FK 级联保护 (bee004cf) | ✅ commit | `938e8b97` feat(server): cascade retention downgrade into work deletion (WORK_ASSET_CASCADE) - wrap softDeleteWork in one transaction, 软删作品时把失去所有 live work 引用的素材降级到 completed(30d) tier; 视频引用循环覆盖 video_storyboard_shots 首末帧; billing disputed hold 仍阻断; WORK_ASSET_CASCADE=off 保 byte-for-byte 旧行为 |
| 公开资料拆解保底 (a325bd62) | ⚠️ 部分 | 落账 `8ffcb839` docs(specs): append public-source evidence section (10 findings) to tapnow teardown + 后续 merge. 但进度.md 4 个档案后续 bugfix 仍未拆解 (见 §2) |
| 商品档案落地实施 (d7dff595) | ✅ commit | `0c439730` product-profile system with tabbed rail + current-product chip + auto-archive, 后续 `5b8d189d` unified archive 主合并, 11 个 product-profile 测试 + 8 个 project-asset 测试通过 |
| 档案入口归一与宽度修复 (b022f5f5) | ✅ commit | `ed5fa7e4` overlay drawer per WeShop benchmark + `613945d5` single-entry chip + 1200 width 归一, mode-width-parity.test.mjs 41 行新断言 |

---

## 2. 缺漏 (按 4c183cd4 原始规划 + 续命发现)

### 2.1 已知遗留 (从 .superpowers/sdd/progress.md:596 抓取)

```
3.【中】works与project_assets加关联外键+级联删除策略(当前软删作品不联动素材)  ←  FK 级联方案二 (938e8b97) 只做了 retention 降级, 未做硬级联. 当前策略 = 软删 + 引用计数, 不是外键 ON DELETE CASCADE.
4.【中】商品档案保存时新上传图未经 import-media 会静默丢图 (productProfileModel canonicalAssetRef 返回 null) —— 需自动 import-media.
6.【中】LIKE 全表扫描改 FTS / content_hash 索引; 去重下沉到 DB 层.
7.【低】幂等键碎片化统一; retention TTL 产品化 (让用户可见可调).
```

### 2.2 4c183cd4 终止时 4 条并行线状态 (.superpowers/sdd/2026-08-27-4c183cd4-resumption.md)

- **线 4 = 商品档案重构 + 孪生项 A patch**, 标注 "全站商品/素材库设计落地 (4c183cd4 启动调研没做完)".
- 8 项缺失只在电商 mode 落地, 视频/小红书/Plog mode 仍未接 product_profile.

### 2.3 接口完整性审计

**已封口的 (本盘点认为完整)** ✅:
- 商品档案 CRUD + 幂等 + 变体 + 引用
- 素材 import-media / register-generated / library 3 个入口
- 画布 session + checkpoint + recovery 闭环
- retention 3 态 + production_state 4 态机
- lineage 表 + link 接口 (server/projects/projectStore.mjs:1052)
- 跨域 contract (cross-domain-asset-contract spec 2026-08-19)

**未封口的 (按商业化就绪标准)** ⚠️:
1. **canonical 引用 fail-closed (隐式)**: `progress.md:2950` 提到伪造/跨用户/哈希或稳定 URL 不匹配的引用会在项目事务创建前 fail closed — 已是 ✅, 但缺少专门的 E2E 跨用户劫持测试.
2. **跨项目素材库搜索**: 入口已开 (`listProjectAssetLibrary` 按 query/limit 检索), 但缺全文索引, LIKE 全表扫 (`progress.md:602`) — P2 优化.
3. **视频 mode 接 product_profile**: 仅 video_workbench_assets 表, 没走 product_profile_assets. 复用路径不直.
4. **小红书 / Plog mode 接 product_profile**: product_profiles 表可承载, 但 XhsSupplementDeck / EcommerceWorkbench 之外没接 — 跨 mode 复用档案能力未做.
5. **retention TTL UI 化**: 表里有 expires_at + retention_pinned, 但用户面板不可见不可调 (`progress.md:603`) — P3.
6. **档案版本快照**: product_profiles 自身没有 history, PATCH 走"先 DELETE 后 INSERT" (projectStore.mjs:625/629), 旧版无法回看 — P2.
7. **档案批量操作**: attachProductProfileAssets 一次上限 128 (MAX_ASSET_REFS), 缺分页/批量 PATCH — P3.
8. **import-media 静默丢图 (重要 P0)**: progress.md:600 标记【中】, 4c183cd4 死后未修, 当前仍在归档时丢新上传图. 修复路径: `productProfileModel.canonicalAssetRef` 之前先 import-media, 再存引用.

### 2.4 孪生项 A 状态 (modlens:646 patch) — 关键发现

RTK.md:167 提到 "详见 docs/superpowers/specs/2026-08-24-harness-native-image-annotation-design.md". **本工作树** 关键发现:

- ❌ `docs/superpowers/specs/2026-08-24-harness-native-image-annotation-design.md` **不存在** (本 worktree 没此 spec)
- ❌ `C:\Users\SHEJI\.dsh\annotation-patch\rebuild.cjs` **不存在** (`dir C:\Users\SHEJI\.dsh\annotation-patch` 返回 "File Not Found")
- ❌ `C:\Users\SHEJI\.dsh\profiles\web\cordis.patch.yml` 内容是空数组 `[]`, 完全没有 pasteToPath:false / families:[deepseek,glm,gpt,x-preview] 配置
- ✅ `C:\Users\SHEJI\.dsh\profiles\node_modules\@deepseek-ai\` 是 JUNCTION 硬链接到全局 npm 内, 不存在 dsh-client-ui-attachment 修改痕迹

**结论**:
- 主线 (server/) 的孪生项 A = `4c285eca` (provider-agnostic VLM bridge) + `7771e302` (modlens vision bridge + annotate-and-context panel) **已 commit**, 153 行 modlens_read_image 工具 + 5 行 App.jsx 接线 + VisionFeedback 页面就位.
- DSH 原生侧的孪生项 A = `modlens:646` patch **已丢失**, 4c183cd4 终止后 DSH 多次重启把 .dsh/profiles 干净还原. 注释: **不要在本任务里改 .dsh/**, 改会被 DSH 自我更新覆盖 (见 RTK.md:123 描述的 8/25 事故).

---

## 3. 建议 (给主线程决策)

### 3.1 优先级 P0 (本周必修)

1. **import-media 静默丢图修复** (progress.md:600 遗下)
   - 修改 `src/pages/Home/ec/EcommerceWorkbench.jsx` 或 `productProfileModel`, 在 canonicalAssetRef 返回 null 时, 调 `/api/projects/:projectId/assets/import-media` (image importer) 显式落库, 再返回 canonical.
   - 补 test: `test/product-profile-import-media.test.mjs` (新建) 覆盖 (a) 新上传图存档案 (b) 已存在 hash 复用 (c) 跨用户上传拒绝.
2. **跨 mode product_profile 复用打通** (P1 升级)
   - 视频: `server/videoWorkbench/*` 在生成结果 register 时调 `projectStore.createProjectAsset` + `productStore.attachProductProfileAssets` (按当前 owner + product tag).
   - 小红书: `src/pages/XhsWorkbench/*` 与 `EcommerceWorkbench` 共享 product_profiles 列表组件.

### 3.2 P1 (本月修)

3. **档案 history 表**: `product_profile_history` (id / profile_id / payload_json / change_kind / created_at) 写入 create/update/archive, 配合 GET /api/product-profiles/:profileId/history.
4. **retention TTL UI**: `src/pages/Profile/RetentionPanel.jsx` 显示每张图 expires_at + 提供 pin/unpin 按钮 (调 `setProjectAssetRetention`).
5. **跨用户劫持 E2E 测试**: `test/product-profile-isolation-e2e.test.mjs`, 模拟 userA 引用 userB 的 projectAsset, 断言 404 PRODUCT_PROFILE_ASSET_NOT_REUSABLE.

### 3.3 P2 (下季度)

6. LIKE → FTS5 (sqlite 虚拟表 `project_assets_fts`, trigger 同步)
7. 批量 PATCH /api/product-profiles/batch (limit 100, 走 id 列表)
8. retention_class 拆分 transient (24h) / durable (7d) / completed (30d) / permanent, 各配独立 sweep 任务

### 3.4 关于孪生项 A (modlens:646)

- **不要在本任务里**重新打 .dsh/ patch — DSH 在跑, 改会被覆盖, 见 RTK.md:123 事故教训.
- **建议**: 在主线程主目录 (F:\da\shubao, 不是本 worktree) 另起一个独立 DSH 测试 session 跑 modlens_read_image, 确认 4c285eca + 7771e302 commit 后的服务端能力可被外部 / vision 端点调用; 孪生项 A 的 DSH 端 patch 由用户在它专用会话中处理, 商品档案子代理不越界.
- **本次盘点结论**: 商品档案孪生项 A = 服务端 vision 链路 (4c285eca + 7771e302) ✅ 就位; DSH 原生孪生项 A patch = ⚠️ 不可在本会话复现, 状态待主线程另启会话独立验证.

---

## 4. 验证 (本盘点跑过)

- ✅ `node --test test/*.test.mjs` 2354 tests, 2342 pass / 12 fail (与商品档案无关, 已在别处跟踪)
- ✅ `git log --all --oneline -- server/projects/` = 44 commits
- ✅ `git log --all --oneline -- src/pages/Home/ec/` = 30 commits
- ✅ `git log --all --oneline -- src/services/projects.js` = 17 commits
- ✅ 5b8d189d/0c439730/938e8b97/613945d5/ed5fa7e4/4c285eca/7771e302 全部在主线
- ✅ .dsh/profiles/web/cordis.patch.yml = [] (空), 与 RTK.md:117 描述不符 → 孪生项 A patch 已丢

---

## 5. 时间戳 + commit hash 速查

- HEAD: `6475f1bd` docs(sdd):-W4-音频节点全接线-实施计划-(4c183cd4-续命)
- 关键合并: `5b8d189d` unified archive / `0c439730` product-profile / `938e8b97` FK cascade / `0c439730` profile system
- 关键 UX: `ed5fa7e4` drawer / `613945d5` single-entry+1200
- 关键 vision: `4c285eca` VLM bridge / `7771e302` modlens bridge
- 测试: `test/product-profile-*.test.mjs` × 8, `test/project-*.test.mjs` × 11, `test/project-*-asset-import.test.mjs` × 3
