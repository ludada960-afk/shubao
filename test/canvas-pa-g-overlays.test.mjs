// 4c183cd4 续命 2026-08-30 画布总统筹重审: 按 Quantv §10.2 节点串联方案
// 用户原话 8-30: "你必须把这些重复的东西都给拿掉" / "你不能够残留那些做错的东西"
// 改后画布:
//   - 拿掉 CanvasChainOverlay (1-click 视频独立入口, 重复)
//   - 拿掉 CanvasAssetQuickPanel (1-click 拖入面板, 重复, 已被 tab=assets + 底部"添加图片/视频" 替代)
//   - 拿掉 CanvasMultiModalOverlay (2026-09-01 用户反对多模态串联, 视频/音频走节点串联)
//   - 保留 CanvasTemplateMarketplace (模板广场, 不重复)
//   - 新增 application 节点 kind (Quantv §10.2 "应用" 节点, 取代原 AI 智能组)
//   - 节点串联: 图片节点 → 端口 → 应用节点 → 视频节点 → 音频节点

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(process.cwd(), 'src');

test('Q1: CanvasMultiModalOverlay 组件已被移除 (用户反对多模态串联, 视频/音频走节点串联)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasMultiModalOverlay.jsx');
  assert.equal(existsSync(file), false, 'CanvasMultiModalOverlay.jsx 必须不存在 (多模态串联已移除)');
});

test('Q2: CanvasTemplateMarketplace 组件存在 (保留, 模板广场)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasTemplateMarketplace.jsx');
  assert.ok(existsSync(file), 'CanvasTemplateMarketplace.jsx 必须存在');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('PUBLIC_TEMPLATES'), '必须引用 PUBLIC_TEMPLATES');
  assert.ok(src.includes('PUBLIC_TEMPLATE_CATEGORIES'), '必须引用 PUBLIC_TEMPLATE_CATEGORIES');
  assert.ok(src.includes('templatesByCategory'), '必须引用 templatesByCategory');
  assert.ok(src.includes('export default function CanvasTemplateMarketplace'), '必须 export default');
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

test('Q5: EcCanvas/index.jsx 已只剩 1 个 overlay (templateMarketplace), 多模态串联已移除', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = readFileSync(file, 'utf8');
  assert.equal(src.includes('multiModalOverlayOpen'), false, 'multiModalOverlayOpen state 必须已移除');
  assert.equal(src.includes('onOpenMultiModal'), false, 'onOpenMultiModal prop 必须已移除');
  assert.equal(src.includes('CanvasMultiModalOverlay'), false, 'CanvasMultiModalOverlay 必须已移除');
  assert.ok(src.includes('templateMarketplaceOpen'), '必须保留 templateMarketplaceOpen state');
  assert.ok(src.includes('onOpenTemplateMarketplace'), '必须传给 CanvasTopBar onOpenTemplateMarketplace');
});

test('Q6: canvasActionRegistry.js 应用节点组 4 项 (取代 AI 智能组 4 项)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/canvasActionRegistry.js');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes("'application-1click-suite'"), '必须含 application-1click-suite action');
  assert.ok(src.includes("'application-1click-video'"), '必须含 application-1click-video action');
  assert.ok(src.includes("'application-tts'"), '必须含 application-tts action');
  assert.ok(src.includes("'application-caption'"), '必须含 application-caption action');
  assert.equal(src.includes("'one-click-suite'"), false, '旧 one-click-suite action id 应被拿掉');
  assert.equal(src.includes("'one-click-video'"), false, '旧 one-click-video action id 应被拿掉');
  assert.equal(src.includes("'tts-voiceover'"), false, '旧 tts-voiceover action id 应被拿掉');
  assert.equal(src.includes("'caption-motion'"), false, '旧 caption-motion action id 应被拿掉');
});

test('Q7: EcCanvas/index.jsx 已加 handleCreateApplicationNode 函数 (Quantv 风格应用节点)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('handleCreateApplicationNode'), '必须定义 handleCreateApplicationNode (新建应用节点)');
  assert.ok(src.includes('applicationType'), 'application 节点必须含 applicationType 字段');
  assert.ok(src.includes("kind: 'application'"), 'application 节点必须 kind=application');
  assert.ok(src.includes('createChildConnection'), 'handleCreateApplicationNode 必须建连接 (节点串联)');
});

test('Q8: 空状态 Row 2 新建应用节点按钮 (取代原 Row 2 + Row 3 重复按钮)', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('handleCreateApplicationNode'), '空状态 Row 2 必须调 handleCreateApplicationNode');
  assert.ok(src.includes('应用节点'), '空状态 Row 2 按钮文案必须含应用节点');
  // 空状态段匹配 (空状态 hero 内的 onClick 不能有 addCanvasComposer(suite/video) 或旧 handleSmartChainAction 3 智能按钮)
  // 注意: handleSmartChainAction 函数本身仍存在 (给 VideoStudio 用), 但空状态段不应再调
  const emptyStateMatch = src.match(/ec-canvas-empty-actions[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  const emptyStateSrc = emptyStateMatch ? emptyStateMatch[0] : '';
  assert.equal(emptyStateSrc.includes("addCanvasComposer('suite')"), false, '空状态不应再调 addCanvasComposer(suite)');
  assert.equal(emptyStateSrc.includes("addCanvasComposer('video')"), false, '空状态不应再调 addCanvasComposer(video)');
  assert.equal(emptyStateSrc.includes('handleSmartChainAction'), false, '空状态不应再调 handleSmartChainAction (改走节点串联)');
});
