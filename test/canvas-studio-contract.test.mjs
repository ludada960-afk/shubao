import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  applyCanvasMoveScale,
  createCanvasImageComposerNode,
  createCanvasSuiteComposerNode,
  createCanvasTextNode,
  createUploadedImageNodes,
  getCanvasNodePresentation,
  resizeCanvasNode,
} from '../src/pages/EcCanvas/canvasStudioModel.js';

test('node presentation makes hover, selection and relation focus explicit', () => {
  assert.deepEqual(getCanvasNodePresentation({ selected: false, hovered: false, focusActive: false }), {
    state: 'idle',
    dimmed: false,
    handlesVisible: false,
  });
  assert.deepEqual(getCanvasNodePresentation({ selected: true, hovered: false, focusActive: true, related: true }), {
    state: 'selected',
    dimmed: false,
    handlesVisible: true,
  });
  assert.deepEqual(getCanvasNodePresentation({ selected: false, hovered: false, focusActive: true, related: false }), {
    state: 'idle',
    dimmed: true,
    handlesVisible: false,
  });
});

test('image resize preserves the media ratio and clamps width', () => {
  assert.deepEqual(
    resizeCanvasNode({ x: 40, y: 60, w: 240, h: 320, ratio: '3:4' }, { width: 360 }),
    { x: 40, y: 60, w: 360, h: 480, ratio: '3:4' },
  );
  assert.deepEqual(
    resizeCanvasNode({ x: 40, y: 60, w: 240, h: 240, ratio: '1:1' }, { width: 40 }),
    { x: 40, y: 60, w: 160, h: 160, ratio: '1:1' },
  );
});

test('focused move and scale applies one deterministic geometry update', () => {
  assert.deepEqual(
    applyCanvasMoveScale(
      { id: 'image-1', x: 120, y: 80, w: 240, h: 320, ratio: '3:4' },
      { scale: 1.25, offsetX: 36, offsetY: -20 },
    ),
    { id: 'image-1', x: 156, y: 60, w: 300, h: 400, ratio: '3:4' },
  );
  assert.deepEqual(
    applyCanvasMoveScale(
      { id: 'image-2', x: 0, y: 0, w: 240, h: 240, ratio: '1:1' },
      { scale: 0.1, offsetX: Number.NaN, offsetY: Number.POSITIVE_INFINITY },
    ),
    { id: 'image-2', x: 0, y: 0, w: 160, h: 160, ratio: '1:1' },
  );
});

test('text creation produces a real editable canvas object rather than a form card', () => {
  const node = createCanvasTextNode({ x: 120, y: 160, sourceNodeId: 'source-1', now: 1234 });
  assert.deepEqual(node, {
    id: 'text_1234',
    kind: 'text',
    x: 120,
    y: 160,
    w: 420,
    h: 180,
    text: '',
    placeholder: '输入标题、卖点或生成要求',
    sourceNodeIds: ['source-1'],
    status: 'ready',
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 400,
      list: 'none',
      textAlign: 'left',
    },
  });
});

test('native uploads become clean individual image nodes without source-card chrome', () => {
  assert.deepEqual(createUploadedImageNodes({
    assets: [
      { assetId: 'one', name: 'front.png', url: 'data:image/png;base64,one', width: 1200, height: 1600 },
      { assetId: 'two', name: 'side.png', url: 'data:image/png;base64,two', width: 1600, height: 1200 },
    ],
    x: 80,
    y: 100,
    now: 123,
  }).map(node => ({ kind: node.kind, name: node.name, ratio: node.ratio, group: node.group, x: node.x, y: node.y })), [
    { kind: 'image', name: 'front.png', ratio: '3:4', group: '', x: 80, y: 100 },
    { kind: 'image', name: 'side.png', ratio: '4:3', group: '', x: 358, y: 100 },
  ]);
});

test('image and ecommerce generation start as movable canvas nodes beside their source', () => {
  assert.deepEqual(createCanvasImageComposerNode({ x: 400, y: 220, sourceNodeId: 'image-1', now: 123 }), {
    id: 'image_composer_123',
    kind: 'image-composer',
    status: 'ready',
    x: 400,
    y: 220,
    w: 520,
    h: 278,
    prompt: '',
    ratio: '1:1',
    count: 1,
    sourceNodeIds: ['image-1'],
  });
  assert.deepEqual(createCanvasSuiteComposerNode({ x: 500, y: 260, sourceNodeId: 'image-1', platform: '天猫', now: 456 }), {
    id: 'suite_composer_456',
    kind: 'suite-composer',
    status: 'ready',
    x: 500,
    y: 260,
    w: 560,
    h: 356,
    prompt: '',
    platform: '天猫',
    ratio: '1:1',
    count: 6,
    sourceNodeIds: ['image-1'],
  });
});

test('studio surface owns distinct add, selection and derivation controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /ec-canvas-add-menu/);
  assert.match(source, /ec-canvas-object-toolbar/);
  assert.match(source, /ec-canvas-derive-menu/);
  assert.match(source, /contentEditable/);
  assert.match(source, /CanvasMultiSelectionToolbar/);
  assert.match(source, /CanvasTextComposer/);
  assert.match(source, /CanvasImageComposer/);
  assert.match(source, /CanvasEcommerceComposer/);
  assert.match(source, /CanvasFocusedEditor/);
  assert.match(source, /className="ec-canvas-text-drag-handle"/);
  assert.match(source, /aria-label="拖动文本"/);
  assert.match(source, /onPointerDown\?\.\(event, node\.id\)/);
  assert.doesNotMatch(source, /<header>\s*文本\s*<\/header>/);
});

test('canvas page removes independent lane labels, role-gated uploads, and duplicate rail actions', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const chrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /ec-canvas-lane-label/);
  assert.doesNotMatch(page, /CanvasSourceImportSheet/);
  assert.doesNotMatch(page, /\[cropNode, setCropNode\]|\[annotationNode, setAnnotationNode\]/);
  assert.doesNotMatch(page, /handleSaveCrop|handleSaveAnnotation/);
  assert.match(page, /generateEcommerceSuite/);
  assert.match(page, /createCanvasImageComposerNode/);
  assert.match(page, /createCanvasSuiteComposerNode/);
  assert.match(page, /<CanvasImageComposer/);
  assert.match(page, /<CanvasEcommerceComposer/);
  assert.doesNotMatch(page, /ReferenceComposer|composerNodes|composerAction/);
  assert.match(page, /handleComposerSourceUpload/);
  assert.doesNotMatch(chrome, /const actions = \[/);
  assert.match(chrome, /ec-canvas-rail-add/);
});

test('image composer owns reference uploads instead of reopening a legacy floating composer', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /onAddSources/);
  assert.match(source, /aria-label="添加参考图片"/);
  assert.doesNotMatch(source, /ReferenceComposer/);
});

test('focused editing exposes complete functional annotation and geometry controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  for (const label of ['画笔', '矩形', '箭头', '文字', '撤销', '重做', '清除标注']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /aria-label="标注颜色"/);
  assert.match(source, /aria-label="标注粗细"/);
  assert.match(source, /aria-label="标注说明"/);
  assert.match(source, /aria-label="缩放比例"/);
  assert.match(source, /aria-label="水平偏移"/);
  assert.match(source, /aria-label="垂直偏移"/);
  assert.match(page, /applyCanvasMoveScale/);
  assert.match(page, /focusedEditor\.mode === 'move-scale'[\s\S]*?setNodes/);
});

test('new canvas surfaces have a complete responsive visual contract', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  for (const className of [
    'ec-canvas-multi-toolbar',
    'ec-canvas-node-composer',
    'ec-canvas-image-composer',
    'ec-canvas-suite-composer',
    'ec-canvas-focused-editor',
    'ec-canvas-focused-stage',
    'ec-canvas-focused-toolbar',
  ]) {
    assert.match(css, new RegExp(`\\.${className}\\s*\\{`), `${className} must be styled`);
  }
  assert.doesNotMatch(css, /\.ec-canvas-lane-label\s*\{/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-node-composer/);
});

test('the primary add rail has a generous Liuying-style hit target', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  const chrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
  assert.match(css, /\.ec-canvas-left-rail \{[^}]*width: 52px;[^}]*padding: 6px;/);
  assert.match(css, /\.ec-canvas-left-rail \.ec-canvas-rail-add \{[^}]*width: 40px;[^}]*height: 40px;/);
  assert.match(chrome, /className="ec-canvas-rail-add"><Plus size=\{22\}/);
});
