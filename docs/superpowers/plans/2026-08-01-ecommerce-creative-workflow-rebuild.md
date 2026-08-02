# 电商创意工作流与四方向方案实施计划

**Goal:** 用结构化四方向方案连接现有 Product Truth、Campaign Bible、Asset Plan、Prompt、QA 与整套交付链路，并完成统一生产发布。

**Architecture:** 新增纯规范化模块作为模型输出和正式生成之间的防火墙。第一步配置决定数量/比例/费用，AI 只负责四套差异化商业与视觉策略。用户选择的完整方案进入 Campaign Bible，Asset Planner 按角色索引消费逐图职责。

## 全局约束

- 只修改电商生图，不影响小红书模式。
- 保留现有生产验证过的账务、任务恢复、质量门和稳定资产边界。
- 先写失败测试，再实现。
- 不提交 `.tmp/`、运行文件、密钥、生成资产或用户删除的 extension task 文件。
- 最终只使用 `scripts/deploy-production.ps1` 部署。

### Task 1: 创意方向契约

**Files:**
- Create: `server/ecommerceEngine/creativeDirectionPlan.mjs`
- Modify: `server/ecommerceEngine/index.mjs`
- Test: `test/ecommerce-creative-direction-plan.test.mjs`

- [ ] 写失败测试：恰好四套、字段完整、配置权威、逐张职责、重复方向修复、旧格式兼容、原型安全。
- [ ] 实现规范化、确定性回退和差异化策略。
- [ ] 运行聚焦测试。

### Task 2: 两阶段有界创意分析 API

**Files:**
- Modify: `server/index.mjs`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Modify: `src/services/api.js`
- Test: `test/ecommerce-design-direction-route.test.mjs`
- Test: `test/api-contract.test.mjs`

- [ ] 写失败测试，要求请求携带实际套图配置并调用规范化器。
- [x] 将用户操作拆为轻量视觉观察与纯文本四方向规划，避免多图长输出请求超时。
- [x] 明确商品图/参考图索引职责，限制各角色输入数量与细节等级，并返回结构化分析摘要。
- [x] 由确定性规范化器按第一步配置补齐完整逐图方案。
- [x] 保持刷新计费、总超时、阶段超时、取消和降级恢复兼容；付费刷新遇到降级时回滚。

### Task 3: 第二步方案界面

**Files:**
- Modify: `src/pages/Home/ec/components/DirectionOptionCard.jsx`
- Modify: `src/pages/Home/ec/components/directionUiModel.js`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Test: `test/direction-ui-model.test.mjs`
- Test: `test/ecommerce-direction-ui-contract.test.mjs`

- [ ] 写失败测试：商业目标、受众、商品策略、图片分组、逐图展开和可编辑说明必须可见。
- [ ] 实现桌面 2×2、移动单列和紧凑可扫描层级。
- [ ] 编辑执行说明时保持方案选中并进入后续请求。

### Task 4: Campaign Bible 传播

**Files:**
- Modify: `server/ecommerceEngine/campaignBible.mjs`
- Modify: `src/pages/Home/ec/ecommercePlanModel.js`
- Modify: `src/pages/Home/ec/DesignDirection.jsx`
- Test: `test/campaign-bible.test.mjs`
- Test: `test/ecommerce-billing-ui.test.mjs`

- [ ] 写失败测试，要求完整视觉系统、商品策略、风险约束和逐图清单进入防御性任务快照。
- [ ] 扩展 Pending Action 安全字段并保留旧任务兼容。
- [ ] 确认第一步配置和报价不被方向方案改写。

### Task 5: 逐图方案与依赖

**Files:**
- Modify: `server/ecommerceEngine/assetPlanner.mjs`
- Modify: `server/ecommerceEngine/shotDirector.mjs`
- Modify: `server/ecommerceEngine/promptCompiler.mjs`
- Test: `test/ecommerce-asset-planner.test.mjs`
- Test: `test/ecommerce-shot-director.test.mjs`
- Test: `test/ecommerce-prompt-compiler.test.mjs`

- [ ] 写失败测试，按 `role + roleIndex` 消费逐图方案。
- [ ] 保持类型/数量/比例由 sizing 决定。
- [ ] 将标题、目的、执行方式、变化点和依赖写入 shot intent 和 prompt。
- [ ] 确保详情逐屏不同、参考图不能替换商品、事实门继续生效。

### Task 6: 集成与回归

**Files:**
- Modify: `.superpowers/sdd/progress.md`
- Test: all related suites

- [ ] 运行方向、Campaign、Asset Plan、Shot、Prompt、Orchestrator 和 Canvas 聚焦回归。
- [ ] 运行完整 `npm test`、`npm run build`、`npm run check`、`npm run collab:check` 和 `git diff --check`。
- [ ] 修复全部本次引入的回归。
- [ ] 显式暂存并提交，不纳入 `.tmp/` 和用户文件。

### Task 7: 浏览器验收和生产发布

- [ ] 本地桌面和移动验证四方向、展开、编辑、补充素材、确认生成、任务状态和 Canvas 导入。
- [ ] 验证画布桌面/移动、单选/多选、拖动、连线、图层、保存恢复和图片解码。
- [ ] 检查控制台、失败请求、溢出和重叠。
- [ ] 使用生产脚本部署。
- [ ] 验证健康、模型网关、真实电商套图、账务、作品、稳定 URL 和 Canvas。
- [ ] 更新账本并完成目标。
