# 自由创作与首页四域架构实施计划

> **执行要求：** 按任务顺序 TDD，实现前先看到目标测试失败；QA 禁止触发真实付费生成。

**目标：** 上线可扩展的自由创作图片工作台，并把首页入口升级为可访问、响应式的四卡扇形结构。

**架构：** `VisualCreationMode` 负责工作台交互；纯模型模块负责配方、生成槽和作品快照；客户端复用耐久 Canvas 生图 API；服务端按白名单 `creation_intent` 与 `skill_id` 构建提示词并将其纳入幂等指纹；作品统一进入 Canvas。

## 全局约束

- 顶层域只增加 `visual / 自由创作`，海报是内部配方。
- 不调用旧 `/api/regenerate-image`。
- 不绕过签名会话、服务端报价、账务执行或稳定资产存储。
- 不触发真实图片/视频生成作为测试。
- 不修改或暂存用户自有的 extension task 删除、`.tmp/`、诊断脚本和无关 package 状态。
- 手工改动使用 `apply_patch`，提交时显式列出文件。

### Task 1：先固定产品模型与四卡契约

**文件：**
- 新建 `src/pages/Home/visualCreationModel.js`
- 修改 `test/home-mode-cards.test.mjs`
- 新建 `test/visual-creation-model.test.mjs`

- [x] 断言首页按 `ecommerce / video / content / visual` 顺序呈现四域，并引用新版视频与自由创作素材。
- [x] 断言四卡悬停/聚焦会扶正上移、选中态与 reduced-motion 存在、移动端完整收纳四卡。
- [x] 断言四个配方均具备预览、`preserves / outcome / bestFor`，避免角色式不透明标签。
- [x] 断言生成运行按稳定槽键建模，部分成功保留，重试只选择失败槽。
- [x] 断言作品快照使用 `workType: 'visual'`、稳定资产和正确完成状态。
- [x] 运行聚焦测试并确认因实现缺失而失败。

### Task 2：服务端通用视觉意图与幂等边界

**文件：**
- 新建 `server/visualCreationSkills.mjs`
- 修改 `server/canvasGenerationService.mjs`
- 修改 `src/services/api.js`
- 修改 `test/canvas-generation-service.test.mjs`
- 修改 `test/api-contract.test.mjs`

- [x] 为 `visual` 意图和四个白名单配方编写提示词契约测试；未知配方降级为 `free`。
- [x] 断言 `creation_intent` 与 `skill_id` 进入任务指纹、快照和账务元数据。
- [x] 断言通用视觉请求不出现 `ecommerce visual`，现有默认电商请求保持原样。
- [x] 扩展客户端 API 以转发意图、配方和 `AbortSignal`，仍使用稳定报价动作 ID。
- [x] 运行聚焦测试，保持任务重放、稳定资产和账务回归通过。

### Task 3：实现自由创作工作台

**文件：**
- 新建 `src/pages/Home/VisualCreationMode.jsx`
- 新建 `src/pages/Home/VisualCreationMode.css`
- 修改 `src/pages/Home/index.jsx`
- 修改 `src/pages/Home/Home.css`
- 修改或新建对应静态 UI 契约测试

- [x] 实现四个可视配方的响应式选择器，并把三项转换信息暴露给屏幕阅读器和视觉用户。
- [x] 实现 0-6 张参考图上传、预览、删除和耐久上传。
- [x] 实现提示词、模型、画幅、清晰度、数量及实时积分预估。
- [x] 以稳定 run/slot 请求键逐槽生成；保留部分成功并只重试失败槽。
- [x] 实现结果下载、进入 Canvas、登录/空提示/上传/余额/网络错误状态。
- [x] 在模式切换后保留当前工作台状态，不产生路由跳转。

### Task 4：首页视觉素材与作品闭环

**文件：**
- 新建 `public/images/home/reference-card-product.png`
- 新建 `public/images/home/reference-card-fashion.png`
- 新建 `public/images/home/reference-card-video.png`
- 新建 `public/images/home/reference-card-remix.png`
- 修改 `src/utils/workRecords.js`
- 修改 `src/pages/EcCanvas/index.jsx`
- 修改 `test/canvas-work-model.test.mjs`
- 修改 `test/unified-works-entry.test.mjs`

- [x] 按参考站原始叠卡语言接入透明底视频入口素材，不改变卡片层级与倾角。
- [x] 按同一叠卡语言接入自由创作入口与配方预览素材。
- [x] 增加 `visual` 作品别名和 Canvas 的 `自由创作`筛选。
- [x] 断言自由创作结果可导入 Canvas 且作品类型不会退化为 ecommerce。

### Task 5：集成与浏览器验收

- [x] 运行所有新增与受影响测试。
- [x] 运行完整 `npm test`、`npm run build`、`npm run check`、`npm run collab:check` 和 `git diff --check`。
- [x] 启动本地开发服务器，使用桌面与 390px 移动视口检查四卡、工作台、菜单、上传预览、错误状态和 Canvas 导入；不点击真实生成。
- [x] 检查控制台、网络错误、图片解码、横向溢出、文字重叠、键盘顺序与 reduced-motion。
- [x] 将提交范围、测试证据和剩余边界写入进度账本；只显式暂存本任务文件。
