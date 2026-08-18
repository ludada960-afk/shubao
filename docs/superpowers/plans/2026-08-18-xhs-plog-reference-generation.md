# 小红书图文与 Plog 参考素材生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小红书图文和 Plog 改造成“动态内容规划 + 语义化参考素材路由”的生成系统，在保持自由变化的同时稳定达到薯包案例的内容与视觉质量底线。

**Architecture:** 新增纯函数参考素材路由模块，统一规范 `style/source` 角色、旧字段兼容和按页面选择 source 输入。服务端将角色化素材分别送入视觉分析和图像生成；前端新增复用电商上传语义的内容素材选择器，小红书默认风格参考，Plog 同时支持生活素材和风格参考。动态 planner 增加软性 playbook 和 Plog 镜头职责，但不恢复固定赛道页序。

**Tech Stack:** Node.js ESM, Express SSE, React 18, existing `uploadEcommerceAssets`, existing image provider adapter, Node built-in test runner, Vite.

## Global Constraints

- 不修改或暂存用户所有的 `server/extension_tasks/*.json` 删除项、`.tmp/`、诊断脚本、运行数据库和构建产物。
- `referenceAssetIds` 必须继续可用，并按 style 语义兼容旧客户端。
- style 参考图不得直接进入图生图；source 素材只能按页面职责选择性进入图生图。
- 小红书保持封面 + 8 页；Plog 保持 9 张输出，但镜头职责可以重排、替换和变化。
- 不执行真实付费生图，不部署生产；验证使用纯函数测试、构建、check 和本地 UI 检查。

### Task 1: Add reference role and routing contracts

**Files:**
- Create: `server/contentReferenceRouter.mjs`
- Modify: `server/contentReferenceAssets.mjs`
- Test: `test/content-reference-router.test.mjs`
- Test: `test/content-reference-assets.test.mjs`

**Interfaces:**
- Produces `normalizeReferenceGroups(input)`, `selectSourceInputs({ sourceImages, task })`, `referenceUsageLabel(groups)`.
- Produces `resolveContentReferenceGroups({ ownerEmail, referenceAssets, referenceAssetIds, legacyImages, ...deps })`.

- [x] **Step 1-5:** 已完成角色限制、旧字段兼容、按任务选择 source，以及 owner-scoped 分组解析测试。

### Task 2: Make dynamic XHS and Plog plans reference-aware

**Files:**
- Modify: `server/xhsCreativePlanner.mjs`
- Modify: `server/plogPromptEngine.mjs`
- Test: `test/xhs-creative-planner.test.mjs`

**Interfaces:**
- XHS page plans add `reference_use` with `none|subject|environment|comparison` fallback semantics.
- Plog lenses add `shot_role`, `reference_use`, and `variation_note` while accepting old `zh/en` lenses.

- [x] **Step 1-5:** 已完成动态 XHS/Plog 计划字段、软性质量护栏、方向变化和兼容旧镜头结构。

### Task 3: Route source images into generation and persist an understandable brief

**Files:**
- Modify: `server/index.mjs`
- Modify: `src/services/api.js`
- Test: `test/api-contract.test.mjs`
- Test: `test/content-reference-assets.test.mjs`

**Interfaces:**
- `/api/generate` and `/api/plog-generate` accept `referenceAssets: { style: string[], source: string[] }`.
- Existing `referenceAssetIds` and `images/refImage` remain valid.
- `callImageAPI(prompt, size, refImageBase64)` accepts one data URI or an array.

- [x] **Step 1-6:** 已完成分组请求、单/多图编辑输入、XHS/Plog 生成路由和可读交付元数据；未调用真实付费图片供应商。

### Task 4: Build the shared content reference picker

**Files:**
- Create: `src/components/creation/ContentReferencePicker.jsx`
- Create: `src/components/creation/ContentReferencePicker.css`
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Test: `test/content-reference-picker-ui.test.mjs`

**Interfaces:**
- Component props expose `styleImages`, `sourceImages`, `onAdd(role, files)`, `onRemove(role, index)`, `compact`, `styleMax`, `sourceMax`.
- Images remain data URI-compatible objects/strings accepted by `uploadEcommerceAssets`.

- [x] **Step 1-7:** 已完成共享双槽上传组件、首页与独立 Plog 接入、分组上传/删除状态、旧 checkpoint 兼容和 Vite 构建。

### Task 5: Add visible plan explanation and regression coverage

**Files:**
- Modify: `src/pages/Home/XhsContentMode.jsx`
- Modify: `src/pages/Plog/index.jsx`
- Modify: `src/pages/Home/Home.css`
- Test: `test/xhs-content-ui.test.mjs`
- Test: `test/plog-ui.test.mjs`

**Interfaces:**
- Results can render `creative_direction`, `creative_brief`, and `reference_usage` without assuming they exist on legacy works.

- [x] **Step 1-3:** 已完成上传区语义提示和 Plog 结果中的 `reference_usage` 展示。
- [ ] **Step 4:** 浏览器截图工具未安装，未声称完成截图级移动端验证；已通过构建和静态 UI 合约测试。

### Task 6: Full verification and handoff

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Modify: `RTK.md` only if a stable cross-session conclusion must be recorded.

- [x] **Step 1-2:** focused tests and full `npm test` passed (`1590` tests)。
- [x] **Step 3:** `npm run build`、`npm run check`、`npm run collab:check` 和相关 `git diff --check` passed。
- [x] **Step 4:** 已启动本地 Vite，未触发真实生成。
- [x] **Step 5-6:** 已保留用户既有未关联改动，未部署生产，剩余风险仅是供应商真实出图质量和浏览器截图级布局验证。
