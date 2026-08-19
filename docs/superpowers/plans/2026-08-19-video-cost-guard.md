# 视频工作台预算上限闭环实施计划

> **For agent execution:** use the executing-plans skill and complete the steps in order.

**目标：** 让视频工作台的“本次预算上限”从计划报价开始，贯通严格预检、计划审批和逐镜头生成草稿；默认不设上限，保留现有零额度规划模式，不触发供应商或账务。

**范围：** 只修改视频工作台计划契约、客户端请求、工作台预算输入、相关测试和架构记录。不修改电商展示、首页案例、生产生成脚本，不部署。

**契约：**

- `budgetCapPoints` 为 `null` 或非负安全整数；空输入等同于未设置，负数、小数、非数字由服务端以 `VIDEO_PREFLIGHT_INPUT_INVALID` 拒绝。
- 预算上限进入计划 `options` 和计划指纹，因此更改上限必须重新检查并重新审批。
- `quote.points` 始终保留真实预估值；严格预检在超限时返回 `BUDGET_CAP_EXCEEDED`，不创建供应商任务、不改变账务。
- 审批和生成草稿必须使用包含同一上限的计划哈希；上限变更后旧哈希不可复用。

## 实施步骤

1. **先写失败测试**
   - `test/video-workbench-plan.test.mjs`：断言预算上限进入计划选项/指纹，非法值失败，报价不被清零。
   - `test/video-workbench-routes.test.mjs`：GET、预检、审批、生成草稿都传递上限；修改上限后旧审批哈希失效；无供应商/账务副作用。
   - `test/video-workbench-client.test.mjs`：断言 GET 查询和审批/预检请求体包含上限。
   - `test/video-project-workbench-ui.test.mjs`：断言预算输入、预估/上限状态和预检门禁文案存在。

2. **贯通服务端契约**
   - 在 `server/videoWorkbenchPlan.mjs` 统一规范化上限并加入 `options`，保留真实 quote。
   - 在 `server/videoWorkbenchRoutes.mjs` 的计划读取、预检、审批、生成草稿路径传递上限。
   - 让非法上限走现有参数错误映射，不允许静默降级成无限预算。

3. **贯通客户端与工作台**
   - 在 `src/services/videoWorkbench.js` 统一序列化上限。
   - 在 `src/pages/VideoStudio/VideoProjectWorkbench.jsx` 增加紧凑的数字输入；改变输入时清除旧计划、预检和草稿，避免展示过期状态。
   - 只展示服务端返回的估算和阻断，不添加没有后端行为的装饰性控制。
   - 在 `src/pages/VideoStudio/VideoProjectWorkbench.css` 增加响应式、可读的预算控件样式。

4. **验证与记录**
   - 运行聚焦测试，再运行 `npm test`、`npm run build`、`npm run check`、`npm run collab:check`、`git diff --check`。
   - 运行 `npm run verify:video-acceptance`，确认 `providerSubmissions=0`、`billingMutated=false`、`paidGenerationRequested=false`。
   - 仅在所有本地证据通过后更新路线图 P1-07 状态；本计划不触发生产部署。

## 实施结果（2026-08-19）

- 服务端、客户端和工作台 UI 已贯通预算输入；预算值进入计划选项与哈希，报价仍展示真实预估值。
- 计划审批和生成草稿在服务端重新计算并拒绝超限计划；草稿重放会保留 `null`（未设上限）或具体积分上限，不能把未设置误解为零预算。
- 非数字、负数、小数和布尔值均 fail closed；输入变更会清除旧计划、预检和草稿状态。
- 新建严格预检任务的 provider-neutral renderer request 会携带不可变 `budgetPolicy` 证明（币种、预估积分、最高积分、请求上限和 `withinCap`），并在请求构建/完整性校验时拒绝超限或伪造证明；旧请求仍保持兼容。该证明不等同于供应商实际用量或扣费，真实结算仍需独立的 worker/账务契约。
- 聚焦视频工作台回归：58/58；全量回归：1868/1868；构建、静态检查、协作检查和 `git diff --check` 均通过。
- `npm run verify:video-acceptance` 通过，且 provider submissions、billing mutations、paid generation requests 均为 0。该增量未部署，生产 full 门禁仍待明确发布窗口。
