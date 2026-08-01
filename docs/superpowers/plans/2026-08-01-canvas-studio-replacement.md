# 薯包无限画布替换版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 以已经验证的流影式交互模型替换现有画布表现层，保留薯包现有生成、保存、计费与作品数据链路，并修复永久卡住的图片分析任务。

**Architecture:** 继续使用现有 React DOM/SVG 世界坐标内核和服务端接口，新建独立的画布展示组件与纯交互模型。左键对象工具栏、右键快捷菜单、连接点派生菜单互斥；节点与连线共享实时几何状态，高频拖动只更新内存，结束后才持久化。

**Tech Stack:** React 18、Vite、Lucide、Node test runner、Express、现有 Canvas session/generation API。

## Global Constraints

- 不加入视频生成和工作流导入能力。
- 不复制竞品源码、品牌或素材，只实现已观察到的交互结构和视觉质量。
- 图片保持完整比例与高清源，节点直接拖动，双击打开大图。
- 画布所有可见命令必须连接真实处理链路，不保留占位按钮。
- 生产部署只能使用 `scripts/deploy-production.ps1`。

---

### Task 1: 画布交互契约

**Files:**
- Create: `src/pages/EcCanvas/canvasStudioModel.js`
- Modify: `src/pages/EcCanvas/canvasActionRegistry.js`
- Test: `test/canvas-action-registry.test.mjs`
- Test: `test/canvas-studio-contract.test.mjs`

- [ ] 写失败测试，固定互斥操作层、节点视觉状态、文本节点默认值和等比缩放。
- [ ] 运行 `node --test test/canvas-action-registry.test.mjs test/canvas-studio-contract.test.mjs`，确认因新契约缺失而失败。
- [ ] 实现纯模型和操作表面分类。
- [ ] 重跑聚焦测试并提交。

### Task 2: 新画布节点与工具表面

**Files:**
- Create: `src/pages/EcCanvas/components/CanvasStudio.jsx`
- Modify: `src/pages/EcCanvas/components/CanvasChrome.jsx`
- Modify: `src/pages/EcCanvas/ContextMenu.jsx`
- Modify: `src/pages/EcCanvas/EcCanvas.css`
- Test: `test/canvas-studio-contract.test.mjs`

- [ ] 写失败的静态 UI 契约测试，要求左侧加号菜单、对象工具栏、派生菜单和无标题文本画布。
- [ ] 实现高清等比图片节点、源素材节点、文本节点、对象工具栏与紧凑右键菜单。
- [ ] 为 hover、selected、dimmed、loading、error 和键盘焦点补齐状态。
- [ ] 重跑契约测试并提交。

### Task 3: 页面替换与真实交互

**Files:**
- Modify: `src/pages/EcCanvas/index.jsx`
- Modify: `src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNode.jsx`
- Test: `test/ec-canvas-state.test.mjs`
- Test: `test/canvas-interaction-model.test.mjs`

- [ ] 将左键选中直接连接对象工具栏，移除二次展开状态与节点内重复按钮。
- [ ] 将右键限制为复制/删除，将连接点限制为生成文案、图片生成、电商套图。
- [ ] 实现节点等比缩放、直接拖图、双击预览、加号菜单和本地编辑器定位。
- [ ] 移除全局连接说明条和无效占位交互，重跑画布测试并提交。

### Task 4: 生命周期与完整回归

**Files:**
- Modify: `server/generationJobs.mjs`
- Modify: `server/index.mjs`
- Modify: `test/generation-jobs.test.mjs`

- [ ] 验证三分钟无租约、无扣费、无资产的分析任务自动失败且不扣费。
- [ ] 运行全部 `npm test`、`npm run build`、`npm run check`、`npm run collab:check` 和 `git diff --check`。
- [ ] 修复所有本次变更引入的回归并提交，不纳入无关删除文件。

### Task 5: 浏览器验收与生产发布

**Files:**
- Modify: `.superpowers/sdd/progress.md`

- [ ] 在桌面与移动视口验证空状态、加号、拖动连线同步、左键、右键、派生、缩放和双击预览。
- [ ] 检查截图、控制台、失败请求、图片解码和画布像素非空。
- [ ] 使用唯一生产脚本部署，验证健康、历史卡住任务清理、作品、画布与图片请求。
- [ ] 更新进度账本并完成目标。
