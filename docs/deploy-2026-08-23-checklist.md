# 2026-08-23 合并部署执行清单（主线程 · 待视频线程完成）

> 用途：视频线程（会话 B, 019ff647-2893-7cd3-828c-b894c01cad21）完成 VID-P1-04 计划审批门后，主线程按此清单执行合并部署，提高上线效率。
> 状态：**等待视频线程完成**（截至 2026-08-23，视频线程尚未完成 VID-P1-04 实现/测试/账本更新）

## 前置：本地验收（主线程已完成）
- [x] 全量测试 2115/2115
- [x] npm run build 成功（20 个 JS 资产）
- [x] npm run check 通过
- [x] npm run collab:check READY（0 peer 冲突）
- [x] git diff --check 通过
- [x] verify:video-acceptance 通过（providerSubmissions=0 / billingMutated=false / paidGenerationRequested=false）
- [x] Canvas 生成图归档失败恢复闭环边界审查通过（shared 3 模块 + projectStore/canvasSessionModel 接入）

## 待办：等视频线程确认后执行

### 1. 确认视频线程完成
- [ ] VID-P1-04 计划审批门已实现
- [ ] 视频聚焦回归通过
- [ ] 已在 RTK.md / progress.md 记录最终状态
- [ ] 确认共享工作树 video 文件已提交到 codex/ecommerce-stability 或清理

### 2. 按归属拆分提交（主线程部分）
- [ ] shared/canvasPendingArchive.mjs、canvasSnapshotMedia.mjs、workPersistence.mjs
- [ ] server/projects/*（projectStore 等）+ server/billing + server/db + server/index
- [ ] src/pages/EcCanvas/*、src/pages/Works/*、src/services/*、src/store/AppContext.jsx、src/App.jsx、src/components/*
- [ ] src/pages/Home/ec/*（商品档案）+ 相关 test/*.test.mjs
- [ ] 主线程文档（docs/research/2026-08-19-ai-visual-content-business-research.md、docs/superpowers/plans/2026-08-21-visual-product-workspace.md）
- [ ] .superpowers/sdd/progress.md、RTK.md、scripts/deploy-production.ps1 等主线程脚本改动

### 3. 排除文件（绝不提交）
- [ ] 12 个 server/extension_tasks 删除项（运行态）
- [ ] .tmp/、scripts/diagnose-recent-ecommerce-jobs.cjs、.tmp_patch_responsive.py
- [ ] dist-codex-build-* 全部构建产物
- [ ] 全部截图（.tmp-*、xhs-*、visual-*、canvas-qa-*、ec-canvas-*、home-*、creative-nav-* 等）
- [ ] 视频线程文件：server/video*.mjs、server/videoModelRouter.mjs、src/pages/VideoStudio/*、test/video-*、src/services/videoWorkbench.js、docs/superpowers/plans/2026-08-21-video-shot-execution-contract.md 与 2026-08-22-video-storyboard-shot-enrichment.md

### 4. 对干净 HEAD 跑 full production gate
- [ ] npm test 全量通过
- [ ] npm run build 成功
- [ ] npm run check 通过
- [ ] npm run collab:check READY
- [ ] git diff --check 通过
- [ ] npm run verify:video-acceptance 零付费

### 5. 部署
- [ ] 唯一入口 scripts/deploy-production.ps1（auto 按提交范围自动判定 full/frontend；涉及 server/project/asset 路径则 full）

### 6. 真实验证后上报「已上线」
- [ ] 真实账务验证
- [ ] 真实生图/视频验证
- [ ] 600 秒 Canary 通过
- [ ] 独立健康接口 / 审计验证通过

### 7. 部署后收尾
- [ ] 更新 RTK.md 与进度账本最终状态
- [ ] 确认运行态排除项仍未被误暂存/误删
