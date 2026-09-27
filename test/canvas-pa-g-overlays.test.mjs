// 4c183cd4 续命 2026-08-30 画布总统筹重审: 按 Quantv §10.2 节点串联方案
// 用户原话 8-30: "你必须把这些重复的东西都给拿掉" / "你不能够残留那些做错的东西"
// 改后画布:
//   - 拿掉 CanvasChainOverlay (1-click 视频独立入口, 重复)
//   - 拿掉 CanvasAssetQuickPanel (1-click 拖入面板, 重复, 已被 tab=assets + 底部"添加图片/视频" 替代)
//   - 拿掉 CanvasMultiModalOverlay (2026-09-01 用户反对多模态串联, 视频/音频走节点串联)
//   - **2026-09-28 批 CX（CV-0）: 也拿掉 CanvasTemplateMarketplace** —— 见 Q2 的批注
//   - 新增 application 节点 kind (Quantv §10.2 "应用" 节点, 取代原 AI 智能组)
//   - 节点串联: 图片节点 → 端口 → 应用节点 → 视频节点 → 音频节点

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(process.cwd(), 'src');

/* ⚠️ 断言用的是**剥掉注释后的源码**：本仓的规矩是"删掉的东西要在注释里留案底"，
   所以注释里**必然**会出现被删标识符的名字（例如"这里原来渲染 CanvasTemplateMarketplace"）。
   直接对原文断言"不得出现 X" 会被自己的注释判红 —— 那不是回归，是判据写法不对。 */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const readCode = rel => stripComments(readFileSync(path.join(SRC_ROOT, rel), 'utf8'));

test('Q1: CanvasMultiModalOverlay 组件已被移除 (用户反对多模态串联, 视频/音频走节点串联)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasMultiModalOverlay.jsx');
  assert.equal(existsSync(file), false, 'CanvasMultiModalOverlay.jsx 必须不存在 (多模态串联已移除)');
});

test('Q2: CanvasTemplateMarketplace 已下架，模板入口只剩「工作流模板库」这一套真的', () => {
  /* ═══ 2026-09-28 批 CX（CV-0）：**判据反转（事实变了 + 用户口径）** ════════════════════════════
     原来这条判据写的是「保留 CanvasTemplateMarketplace (模板广场, 不重复)」—— 那是 8-30 那次
     "拿重复" 时留下的**保守决定**，前提是"它就是模板广场"。事实已经不是这样了：
       · 用户真正点到的顶栏「模板广场」按钮绑的是 **`onOpenWorkflowGallery`** →
         `WorkflowTemplateGallery.jsx`（真图结构 graph.nodes/graph.connections + 一键铺开 + 服务端真实计数）；
       · `CanvasTemplateMarketplace`（100 套、缩略图按 id 生成的 SVG）的 `onPickTemplate`
         只做 `showToast('已应用模板 X')`、**不铺任何节点**；
       · 实测核实（批 CW，全仓 `grep -n onOpenTemplateMarketplace` 只有 3 处：解构 / 传参 / 定义，
         **没有任何 onClick 调它**，`hasTemplates` 也是从未被使用的死变量）
         ⇒ 它**没有任何入口**，是不可达的死代码 —— 谁把它接上一颗按钮，就等于上线一颗假按钮。
     用户口径（逐字）：「像这个**商品信息**AI规划这些按钮现在其实都是**失效的状态**。我点击了是没有反应的，
     那我觉得这些东西**可以不要了，你就直接拿掉吧**。」（同一条铁律：不许留假按钮 / 不许留残缺品）
     ⇒ 组件文件、index.jsx 的 state/prop/渲染、CanvasChrome 的 prop/死变量一起删除。
       100 套那份目录（`constants/publicTemplates.js`）仍在服务公开页 `?page=public-templates`。 */
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasTemplateMarketplace.jsx');
  assert.equal(existsSync(file), false, 'CanvasTemplateMarketplace.jsx 必须已删除（点选只弹 toast 的假广场）');
  const idx = readCode('pages/EcCanvas/index.jsx');
  assert.equal(idx.includes('CanvasTemplateMarketplace'), false, 'index.jsx 不得再引用它');
  assert.equal(idx.includes('templateMarketplaceOpen'), false, '那个 overlay 的状态必须一并删除');
  assert.equal(idx.includes('onOpenTemplateMarketplace'), false, '那个 prop 必须一并删除');
  /* 唯一入口必须是真的那套 */
  assert.ok(idx.includes('WorkflowTemplateGallery'), '模板入口必须只剩 WorkflowTemplateGallery');
  const chrome = readCode('pages/EcCanvas/components/CanvasChrome.jsx');
  assert.ok(chrome.includes('onOpenWorkflowGallery'), '顶栏「模板广场」按钮绑的必须是它');
  assert.equal(chrome.includes('PUBLIC_TEMPLATES'), false, '顶栏不该再引那份静态目录（死变量已删）');
});

test('Q2b: 模板广场可以**直达**（?tab=templates，用户要的"先挑模板再干活"在链接层面成立）', () => {
  /* docs/design/89 §9.2 的结论：主入口是画布，但"先挑模板再干活"这条路径要能在**链接**上成立
     —— 可分享、可投放、可收藏，也让模板墙以后能挂到任何入口上。
     实证参照（用户登录态实拍）：知渔就是 `/canvas?tab=featured` 这个直达 URL 的做法。 */
  const idx = readCode('pages/EcCanvas/index.jsx');
  assert.match(idx, /new URLSearchParams\(globalThis\.location\?\.search/, '必须读 URL 上的查询参数');
  assert.match(idx, /\['templates', 'template', 'workflows', 'workflow'\]/, 'tab 的四个写法都要认（拼错不静默失效）');
  assert.match(idx, /setWorkflowGalleryOpen\(true\)/, '命中就把模板库打开');
});

test('Q3: CanvasChainOverlay 已被拿掉 (1-click 视频走节点串联)', () => {
  const idx = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const idxSrc = readFileSync(idx, 'utf8');
  assert.equal(idxSrc.includes('import CanvasChainOverlay'), false,
    'EcCanvas/index.jsx 不应再 import CanvasChainOverlay (改走节点串联)');
  assert.equal(idxSrc.includes('setChainOverlayOpen'), false,
    'EcCanvas/index.jsx 不应再有 chainOverlayOpen state (改走节点串联)');
  assert.equal(idxSrc.includes('<CanvasChainOverlay'), false,
    'EcCanvas/index.jsx 不应再渲染 CanvasChainOverlay (改走节点串联)');
});

test('Q4: CanvasAssetQuickPanel 已被拿掉 (1-click 拖入面板重复, 已被 tab=assets + 底部添加图片/视频 替代)', () => {
  const idx = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const idxSrc = readFileSync(idx, 'utf8');
  assert.equal(idxSrc.includes('import CanvasAssetQuickPanel'), false,
    'EcCanvas/index.jsx 不应再 import CanvasAssetQuickPanel (已被 tab=assets 替代)');
  assert.equal(idxSrc.includes('CanvasAssetQuickPanel'), false,
    'EcCanvas/index.jsx 不应再渲染 CanvasAssetQuickPanel');
});

test('Q5: EcCanvas/index.jsx 的浮层收敛：多模态串联已移除，模板广场只剩一套', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = stripComments(readFileSync(file, 'utf8'));
  assert.equal(src.includes('multiModalOverlayOpen'), false, 'multiModalOverlayOpen state 必须已移除');
  assert.equal(src.includes('onOpenMultiModal'), false, 'onOpenMultiModal prop 必须已移除');
  assert.equal(src.includes('CanvasMultiModalOverlay'), false, 'CanvasMultiModalOverlay 必须已移除');
  /* 2026-09-28 批 CX（CV-0）：这里原来断言"必须保留 templateMarketplaceOpen / onOpenTemplateMarketplace"，
     现在**反转** —— 它们是那个无入口的假模板广场的残留（依据见 Q2 的批注）。 */
  assert.equal(src.includes('templateMarketplaceOpen'), false, '假模板广场的 state 必须已移除');
  assert.equal(src.includes('onOpenTemplateMarketplace'), false, '假模板广场的 prop 必须已移除');
  assert.ok(src.includes('workflowGalleryOpen'), '真那套（工作流模板库）的状态必须还在');
});

test('Q6: canvasActionRegistry.js 应用节点组 4 项 (取代 AI 智能组 4 项)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/canvasActionRegistry.js');
  const src = stripComments(readFileSync(file, 'utf8'));
  assert.ok(src.includes("'application-1click-suite'"), '必须含 application-1click-suite action');
  assert.ok(src.includes("'application-1click-video'"), '必须含 application-1click-video action');
  assert.ok(src.includes("'application-tts'"), '必须含 application-tts action');
  assert.ok(src.includes("'application-caption'"), '必须含 application-caption action');
  assert.equal(src.includes("'one-click-suite'"), false, '旧 one-click-suite action id 应被拿掉');
  assert.equal(src.includes("'one-click-video'"), false, '旧 one-click-video action id 应被拿掉');
  assert.equal(src.includes("'tts-voiceover'"), false, '旧 tts-voiceover action id 应被拿掉');
  assert.equal(src.includes("'caption-motion'"), false, '旧 caption-motion action id 应被拿掉');
});

test('Q7: 空壳"应用节点"已下架 (用户 9-04 反馈: 纯摆设死功能, 与素材端口派生重复)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = stripComments(readFileSync(file, 'utf8'));
  assert.equal(src.includes('handleCreateApplicationNode'), false, '空壳 handler 必须删除');
  assert.equal(src.includes('新建应用节点'), false, '空状态入口必须删除');
});

test('Q8: 空状态 Row 2 已随空壳应用节点一起下架 (用户 9-04 反馈)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = stripComments(readFileSync(file, 'utf8'));
  assert.equal(src.includes('handleCreateApplicationNode'), false, '空状态 Row 2 入口必须删除');
  assert.equal(src.includes('新建应用节点'), false, '新建应用节点文案必须删除');
  // 空状态段匹配 (空状态 hero 内的 onClick 不能有 addCanvasComposer(suite/video) 或旧 handleSmartChainAction 3 智能按钮)
  // 注意: handleSmartChainAction 函数本身仍存在 (给 VideoStudio 用), 但空状态段不应再调
  const emptyStateMatch = src.match(/ec-canvas-empty-actions[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  const emptyStateSrc = emptyStateMatch ? emptyStateMatch[0] : '';
  /* 9-13 更新为新契约：空状态已经恢复「用 AI 生成」行（9-09 对齐主流画布），
     但仍不得调用已下架的 application 节点入口与智能链，并且落点不得写死坐标。 */
  assert.equal(emptyStateSrc.includes('handleCreateApplicationNode'), false, '空状态不得调用已下架的应用节点入口');
  assert.equal(emptyStateSrc.includes("addCanvasComposer('image', { x:"), false, '落点不得写死左上角坐标');
  assert.equal(emptyStateSrc.includes("addCanvasComposer('video', { x:"), false, '落点不得写死左上角坐标');
  assert.equal(emptyStateSrc.includes('handleSmartChainAction'), false, '空状态不应再调 handleSmartChainAction (改走节点串联)');
});
