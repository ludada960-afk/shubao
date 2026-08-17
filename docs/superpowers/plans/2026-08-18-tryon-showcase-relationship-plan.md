# 万物上身双展示资源实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为万物上身分别生成“素材→箭头→四张模特卡片”的效果展示资源和“四张完整模特卡片”的顶部按钮缩略图资源。

**Architecture:** 扩展现有 Sharp 合成脚本，使用同一套服饰素材与四张生产模特图输出两个独立 1600x900 资源；生产案例目录分别以 `workflowBanner` 和 `selectorPreview` 绑定，React 展示组件无需改变业务结构。

**Tech Stack:** Node.js, Sharp, React, Node test runner, PowerShell production deploy.

## Global Constraints

- 效果展示区必须保留同套服饰素材、连续弯曲箭头和四张完整模特卡片。
- 顶部能力按钮只使用四张模特卡片资源，不包含服饰素材或箭头。
- 四张模特卡片、服饰素材和箭头的旋转边界必须落在 1600x900 画布内。
- 不触碰 AI 视频工作区和用户已有运行态修改。

### Task 1: 合成两个独立资源

**Files:**
- Modify: `scripts/build-home-showcase-composites.mjs`
- Modify: `test/home-showcase-composites.test.mjs`

- [x] 添加 `editorial-multi-angle-fan-v7` 四卡片资源定义。
- [x] 将完整关系资源命名为 `editorial-multi-angle-workflow-v7`，增加服饰素材布局和连续 SVG 弯曲箭头。
- [x] 为两个布局增加边界测试，确保内容完整且来源独立。
- [x] 运行 `node --test test/home-showcase-composites.test.mjs`。

### Task 2: 分离生产案例绑定

**Files:**
- Modify: `src/pages/Home/productionCaseCatalog.js`
- Modify: `test/production-case-catalog.test.mjs`

- [x] 将完整关系资源绑定到 `workflowBanner`。
- [x] 新增独立 `selectorPreview` 资产并绑定四卡片资源。
- [x] 更新版本化 URL 和真实提示词，避免 CDN 继续读取旧图。
- [x] 运行目录契约测试。

### Task 3: 生成、回归和线上验收

**Files:**
- Generated: `public/images/home/tryon-showcase/editorial-multi-angle-fan-v7.webp`
- Generated: `public/images/home/tryon-showcase/editorial-multi-angle-workflow-v7.png`

- [x] 运行合成脚本并用 Sharp 检查两个资源均为 1600x900。
- [x] 运行完整测试、`npm run build` 和 `npm run check`。
- [ ] 使用 `scripts/deploy-production.ps1` 部署，等待真实电商任务、117 张图库、视频契约、600 秒 canary 和健康检查全部通过。
- [ ] 通过公网 bundle 和两个资源 URL 验证新版本已生效。
