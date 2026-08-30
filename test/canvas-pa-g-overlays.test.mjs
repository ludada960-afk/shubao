// 4c183cd4 续命 P-G/P-A/P-E/P-H 画布 overlay 组件存在性 + props 契约测试
// 不实际渲染 React 组件, 只断言文件存在 + 必要 props 字段

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.join(process.cwd(), 'src');

test('P-G: CanvasChainOverlay 组件存在', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasChainOverlay.jsx');
  assert.ok(existsSync(file), 'CanvasChainOverlay.jsx 必须存在');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('ChainOrchestrator'), '必须 import ChainOrchestrator');
  assert.ok(src.includes('export default function CanvasChainOverlay'), '必须 export default CanvasChainOverlay');
  // 必备 props
  for (const prop of ['open', 'onClose', 'referenceImage', 'onComplete']) {
    assert.ok(src.includes(prop), `CanvasChainOverlay 必须接收 ${prop} prop`);
  }
});

test('P-A: CanvasMultiModalOverlay 组件存在', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasMultiModalOverlay.jsx');
  assert.ok(existsSync(file), 'CanvasMultiModalOverlay.jsx 必须存在');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('MultiModalEntry'), '必须 import MultiModalEntry');
  assert.ok(src.includes('export default function CanvasMultiModalOverlay'), '必须 export default');
  for (const prop of ['open', 'onClose', 'referenceImage', 'defaultProjectKind', 'onComplete']) {
    assert.ok(src.includes(prop), `CanvasMultiModalOverlay 必须接收 ${prop} prop`);
  }
});

test('P-E: CanvasTemplateMarketplace 组件存在 + 引用 PUBLIC_TEMPLATES', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasTemplateMarketplace.jsx');
  assert.ok(existsSync(file), 'CanvasTemplateMarketplace.jsx 必须存在');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('PUBLIC_TEMPLATES'), '必须引用 PUBLIC_TEMPLATES');
  assert.ok(src.includes('PUBLIC_TEMPLATE_CATEGORIES'), '必须引用 PUBLIC_TEMPLATE_CATEGORIES');
  assert.ok(src.includes('templatesByCategory'), '必须引用 templatesByCategory');
  assert.ok(src.includes('export default function CanvasTemplateMarketplace'), '必须 export default');
});

test('P-H: CanvasAssetQuickPanel 组件存在 + 引用 AssetQuickDrag', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/components/CanvasAssetQuickPanel.jsx');
  assert.ok(existsSync(file), 'CanvasAssetQuickPanel.jsx 必须存在');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('AssetQuickDrag'), '必须引用 AssetQuickDrag');
  assert.ok(src.includes('ASSET_DRAG_SOURCES'), '必须引用 ASSET_DRAG_SOURCES (商品档案/公共素材库)');
  assert.ok(src.includes('buildUserUploadDragPayload'), '必须引用 buildUserUploadDragPayload (本地上传)');
  assert.ok(src.includes('export default function CanvasAssetQuickPanel'), '必须 export default');
});

test('P-G/P-A/P-E/P-H: EcCanvas/index.jsx 已 import 4 个 overlay', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = readFileSync(file, 'utf8');
  for (const comp of ['CanvasChainOverlay', 'CanvasMultiModalOverlay', 'CanvasTemplateMarketplace', 'CanvasAssetQuickPanel']) {
    assert.ok(src.includes(comp), `EcCanvas 必须 import ${comp}`);
  }
});

test('P-G/P-A/P-E/P-H: EcCanvas/index.jsx 已添加 3 个 overlay state + 1 个 panel 渲染', () => {
  const file = path.join(SRC_ROOT, 'pages/EcCanvas/index.jsx');
  const src = readFileSync(file, 'utf8');
  assert.ok(src.includes('chainOverlayOpen'), '必须定义 chainOverlayOpen state');
  assert.ok(src.includes('multiModalOverlayOpen'), '必须定义 multiModalOverlayOpen state');
  assert.ok(src.includes('templateMarketplaceOpen'), '必须定义 templateMarketplaceOpen state');
  assert.ok(src.includes('onOpenChain'), '必须传给 CanvasTopBar onOpenChain');
  assert.ok(src.includes('onOpenMultiModal'), '必须传给 CanvasTopBar onOpenMultiModal');
  assert.ok(src.includes('onOpenTemplateMarketplace'), '必须传给 CanvasTopBar onOpenTemplateMarketplace');
});
