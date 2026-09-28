import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveAssetProvenance,
  selectDeliverableNodes,
} from '../src/pages/EcCanvas/canvasAssetProvenance.js';
import { deliveryStrategy, safeDeliveryName } from '../src/pages/EcCanvas/browserFileDelivery.js';

const canvasSource = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const copyModelSource = readFileSync(new URL('../src/pages/EcCanvas/exportCopyModel.js', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');

test('asset provenance distinguishes source, generated, derived, and composition nodes', () => {
  assert.equal(resolveAssetProvenance({ kind: 'image', isProductSource: true, url: '/source.png' }), 'source');
  assert.equal(resolveAssetProvenance({ kind: 'output', role: '透明PNG素材', url: '/alpha.png' }), 'generated');
  assert.equal(resolveAssetProvenance({ kind: 'image', sourceKey: 'detail_long', derivedFromIds: ['a', 'b'], url: '/long.png' }), 'derived');
  assert.equal(resolveAssetProvenance({ kind: 'text', text: '卖点' }), 'composition');
});

test('normal export includes deliverables and excludes user source assets', () => {
  const nodes = [
    { id: 'source', kind: 'image', isProductSource: true, status: 'ready', url: '/source.png' },
    { id: 'generated', kind: 'output', status: 'completed', url: '/generated.png' },
    { id: 'derived', kind: 'image', provenance: 'derived', status: 'ready', url: '/derived.png' },
    { id: 'text', kind: 'text', text: 'copy' },
  ];
  const all = selectDeliverableNodes(nodes, new Set());
  assert.deepEqual(all.deliverables.map(node => node.id), ['generated', 'derived']);
  assert.deepEqual(all.excludedSources.map(node => node.id), ['source']);

  const selected = selectDeliverableNodes(nodes, new Set(['source', 'generated']));
  assert.deepEqual(selected.deliverables.map(node => node.id), ['generated']);
  assert.deepEqual(selected.excludedSources.map(node => node.id), ['source']);
});

test('Canvas export no longer packages JSON or loops automatic anchor downloads', () => {
  assert.doesNotMatch(canvasSource, /素材清单\.json/);
  assert.doesNotMatch(canvasSource, /素材包清单/);
  assert.match(canvasSource, /selectDeliverableNodes/);
  /* ═══ 2026-09-29 批 CY-⑭：导出弹窗的文案搬进了 exportCopyModel.js 纯函数 ─══════════════════════════
     用户原话：「他明明只是对一张图片去进行操作呀，那肯定就是导出一张图片呀。」「为什么叫导出整套图片呀？」
     ⇒ 文案不再写死在 JSX 里（它以前由**入口标记** exportIntent 决定，单图入口也会说"整套"），
     现在由 exportDialogCopy 按**实际可交付张数**算。
     这里断言"那句文案还在"，但要在**新的真源**里找，并且反向断言旧文案已经删干净。 */
  assert.match(copyModelSource, /至少需要 \$\{LONG_DETAIL_MIN\} 张已生成的详情图/,
    '长图不够时的提示必须还在（它现在由 LONG_DETAIL_MIN 常量拼出来，不是写死的字面量）');
  assert.match(copyModelSource, /const LONG_DETAIL_MIN = 2/, '下限仍然是 2 张');
  assert.match(copyModelSource, /合成并导出详情长图/);
  /* ⚠️ 先剥注释再比对：CY-⑬ 已经吃过一次"把源码里的**说明**当成**代码**"的亏，
     那次是断言 <select> 消失时没剥注释。同一类坑不踩第二次。 */
  const canvasCode = canvasSource.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(canvasCode, /导出整套图片/, '「导出整套图片」必须从代码里消失（用户点名）');
  assert.doesNotMatch(canvasCode, /电商图片交付/, '「电商图片交付」必须从代码里消失（我们是通用创作平台）');
  assert.match(canvasSource, /exportDialogCopy\(\{/, '弹窗必须调那个纯函数算文案');
  assert.match(canvasSource, /disabled=\{disabled\}/);
  assert.match(canvasSource, /开始导出/);
  assert.match(canvasSource, /chooseDeliveryDestination/);
  assert.match(canvasSource, /prepareImageDeliverables/);
  assert.match(canvasSource, /writePreparedDeliverables/);
  assert.doesNotMatch(canvasSource, /saveIndividualImages|saveLongDetailImage/);
});

test('delivery strategy asks for a directory or filename and has one-download fallbacks', () => {
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 3, capabilities: { directoryPicker: true } }), 'directory');
  assert.equal(deliveryStrategy({ mode: 'long-detail', fileCount: 1, capabilities: { saveFilePicker: true } }), 'save-file');
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 3, capabilities: {} }), 'zip');
  assert.equal(deliveryStrategy({ mode: 'images', fileCount: 1, capabilities: {} }), 'single-download');
  assert.equal(safeDeliveryName('商品/主图:01', 'PNG'), '商品-主图-01.png');
});

test('long detail uses durable generated storage and right-side derived placement', () => {
  const route = serverSource.slice(serverSource.indexOf("app.post('/api/ecommerce/stitch-long'"), serverSource.indexOf('// 电商正式生成只注册持久化编排路由'));
  assert.match(route, /composeAndPersistLongDetail/);
  assert.doesNotMatch(route, /dist.*stitched|writeFileSync/);
  assert.match(canvasSource, /placeDerivedRightOfSources/);
  assert.match(canvasSource, /detailNodes\.map\(node => node\.id\)/);
});
