import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildDeliveryMetadata,
  DELIVERY_METADATA_SOURCE,
  DELIVERY_SOURCE_SURFACES,
  deliveryBindingRole,
  deliveryRefKey,
  deliveryStepPlan,
  deliveryWorkbenchKind,
  deliverableRefFrom,
  deliverableRefsFromNodes,
  shotFirstFrameChoices,
  validateDeliveryPlan,
  videoTargetProjects,
} from '../src/pages/VideoStudio/videoDeliveryModel.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

const fullRef = {
  projectId: 'proj-canvas-1',
  projectAssetId: 'pa-42',
  contentHash: 'hash-a1',
  stableUrl: 'https://cdn.example.com/a.png',
  mediaKind: 'image',
  name: '白底主图',
};

test('delivery refs: canonical triple required, node shapes normalized and deduped', () => {
  const ref = deliverableRefFrom(fullRef);
  assert.ok(ref);
  assert.equal(ref.projectAssetId, 'pa-42');
  assert.equal(deliveryRefKey(ref), 'proj-canvas-1:pa-42:hash-a1');

  // EcCanvas 节点形态：assetRef 包一层
  const fromNode = deliverableRefFrom({ id: 'n1', kind: 'image', assetRef: { ...fullRef } });
  assert.equal(deliveryRefKey(fromNode), deliveryRefKey(ref));

  // snake_case 兼容
  const snake = deliverableRefFrom({ project_id: 'p', project_asset_id: 'a', content_hash: 'h' });
  assert.equal(deliveryRefKey(snake), 'p:a:h');

  // 三要素缺一不可
  assert.equal(deliverableRefFrom({ projectId: 'p', projectAssetId: 'a' }), null);
  assert.equal(deliverableRefFrom({ projectId: 'p', contentHash: 'h' }), null);
  assert.equal(deliverableRefFrom(null), null);

  // 去重
  const refs = deliverableRefsFromNodes([{ ...fullRef }, { ...fullRef }, null, { projectId: 'x' }]);
  assert.equal(refs.length, 1);
});

test('delivery plan: role/kind mapping, target filtering, validation copy', () => {
  assert.equal(deliveryWorkbenchKind('video'), 'scene');
  assert.equal(deliveryWorkbenchKind('audio'), 'music');
  assert.equal(deliveryWorkbenchKind('image'), 'product');
  assert.equal(deliveryBindingRole('image'), 'first_frame');
  assert.equal(deliveryBindingRole('video'), 'reference');

  const projects = [
    { id: 'v2', kind: 'video', updatedAt: '2026-01-02T00:00:00Z' },
    { id: 'e1', kind: 'ecommerce', updatedAt: '2026-01-03T00:00:00Z' },
    { id: 'v1', kind: 'video', updatedAt: '2026-01-01T00:00:00Z' },
  ];
  assert.deepEqual(videoTargetProjects(projects).map(project => project.id), ['v2', 'v1']);

  assert.notEqual(validateDeliveryPlan({ refs: [], targetProjectId: 'v1', surface: DELIVERY_SOURCE_SURFACES.ecCanvas }), '');
  assert.notEqual(validateDeliveryPlan({ refs: [fullRef], targetProjectId: '', surface: DELIVERY_SOURCE_SURFACES.ecCanvas }), '');
  assert.notEqual(validateDeliveryPlan({ refs: [fullRef], targetProjectId: 'v1', surface: 'bogus' }), '');
  assert.equal(validateDeliveryPlan({ refs: [fullRef], targetProjectId: 'v1', surface: DELIVERY_SOURCE_SURFACES.ecommerceWorkbench }), '');

  const choices = shotFirstFrameChoices([
    { id: 's2', position: 1, purpose: '特写' },
    { id: 's0', position: 0 },
    { purpose: '缺ID不进候选' },
  ]);
  assert.equal(choices.length, 2);
  assert.ok(/镜头 01/.test(choices[0].label));
  assert.ok(/镜头 02 · 特写/.test(choices[1].label));
});

test('delivery steps: image binds first frame only when a shot is chosen; metadata tagged for receive side', () => {
  const withBind = deliveryStepPlan(fullRef, { bindShotId: 's1' });
  assert.deepEqual(withBind.map(step => step.step), ['create-asset', 'import-version', 'approve', 'bind-shot']);
  const withoutBind = deliveryStepPlan(fullRef, {});
  assert.deepEqual(withoutBind.map(step => step.step), ['create-asset', 'import-version', 'approve']);

  const metadata = buildDeliveryMetadata(fullRef, DELIVERY_SOURCE_SURFACES.ecCanvas);
  assert.equal(metadata.source, DELIVERY_METADATA_SOURCE);
  assert.equal(metadata.sourceSurface, 'ec-canvas');
  assert.equal(metadata.displayName, '白底主图');
});

test('contract: three delivery entry points exist in authorized surfaces', async () => {
  // 入口 a：EcCanvas 对象工具条按钮 + index 接线（各一处注入点）
  const canvasStudio = await source('../src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(canvasStudio, /videoDelivery = null/);
  assert.match(canvasStudio, /data-video-delivery="true"/);
  assert.match(canvasStudio, /发往视频项目/);
  const canvasIndex = await source('../src/pages/EcCanvas/index.jsx');
  assert.match(canvasIndex, /VideoProjectDeliveryDialog/);
  assert.match(canvasIndex, /DELIVERY_SOURCE_SURFACES\.ecCanvas/);
  assert.match(canvasIndex, /handleSendSelectedToVideoProject/);
  // 工具条按钮只在选中节点带 canonical 引用时出现
  assert.match(canvasIndex, /selectedNodeVideoDelivery\.length \? \{ enabled: true, onSend: handleSendSelectedToVideoProject \} : \{ enabled: false \}/);

  // 入口 b：电商套图成图卡同款按钮
  const workbench = await source('../src/pages/Home/ec/EcommerceWorkbench.jsx');
  assert.match(workbench, /DeliverableImageCard/);
  assert.match(workbench, /ec-xhs-card-send-video/);
  assert.match(workbench, /DELIVERY_SOURCE_SURFACES\.ecommerceWorkbench/);

  // 入口 c：视频画布接收侧按投递元数据识别「从画布发来」
  const videoCanvas = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  assert.match(videoCanvas, /canvas-delivery-inbox/);
  assert.match(videoCanvas, /DELIVERY_METADATA_SOURCE/);
});
