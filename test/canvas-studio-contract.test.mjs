import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  applyCanvasMoveScale,
  createCanvasImageComposerNode,
  createCanvasSuiteComposerNode,
  createCanvasTextComposerNode,
  createCanvasTextNode,
  createUploadedImageNodes,
  getCanvasComposerPresentation,
  getCanvasNodePresentation,
  normalizeCanvasSelection,
  resizeCanvasNode,
} from '../src/pages/EcCanvas/canvasStudioModel.js';
import {
  createCanvasAnnotation,
  findCanvasBlankPlacement,
  normalizeCanvasCropRect,
  updateCanvasAnnotation,
} from '../src/pages/EcCanvas/canvasInlineEditorModel.js';

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
    h: 84,
    text: '',
    placeholder: '输入文字',
    sourceNodeIds: ['source-1'],
    status: 'ready',
    textStyle: {
      block: 'body',
      color: '#20242a',
      fontSize: 48,
      fontStyle: 'normal',
      fontWeight: 700,
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

test('image and ecommerce generation start as content-only canvas nodes beside their source', () => {
  assert.deepEqual(createCanvasImageComposerNode({ x: 400, y: 220, sourceNodeId: 'image-1', now: 123 }), {
    id: 'image_composer_123',
    kind: 'image-composer',
    status: 'ready',
    x: 400,
    y: 220,
    w: 280,
    h: 280,
    prompt: '',
    ratio: '1:1',
    resolution: '2K',
    imageModel: 'image2',
    count: 1,
    sourceNodeIds: ['image-1'],
  });
  assert.deepEqual(createCanvasSuiteComposerNode({ x: 500, y: 260, sourceNodeId: 'image-1', platform: '天猫', now: 456 }), {
    id: 'suite_composer_456',
    kind: 'suite-composer',
    status: 'ready',
    x: 500,
    y: 260,
    w: 640,
    h: 420,
    prompt: '',
    platform: '天猫',
    commerceContext: {
      platform: 'tmall',
      contentType: 'main',
      targetLanguage: 'zh-CN',
      locale: 'zh-CN',
      policyVersion: 'global-commerce-v1',
    },
    suiteType: '完整套图',
    ratio: '1:1',
    resolution: '2K',
    imageModel: 'image2',
    language: '中文',
    count: 6,
    skuMode: '默认SKU',
    styleSkill: 'smart',
    productInfoMode: 'auto',
    copywritingMode: 'smart',
    sourceNodeIds: ['image-1'],
    configuration: {
      platform: 'tmall',
      commerceContext: {
        platform: 'tmall',
        contentType: 'main',
        targetLanguage: 'zh-CN',
        locale: 'zh-CN',
        policyVersion: 'global-commerce-v1',
      },
      sizing: { smart: true, images: [] },
      styleSkill: 'smart',
      customColors: null,
      productParams: { category: '', size: '', baseColor: '', accentColor: '', material: '', craft: '' },
      skus: [],
      copywriting: { plan: '', sellingPoints: '', qc: '', details: '', maintenance: '' },
      genSettings: { resolution: '2K', imageModel: 'image2', negativePrompt: '' },
    },
  });
});

test('text generation starts as an editable document body and keeps source references separate', () => {
  assert.deepEqual(createCanvasTextComposerNode({ x: 600, y: 320, sourceNodeId: 'image-1', now: 789 }), {
    id: 'text_composer_789',
    kind: 'text-composer',
    status: 'ready',
    x: 600,
    y: 320,
    w: 340,
    h: 170,
    text: '',
    placeholder: '双击开始编辑...',
    prompt: '',
    ratio: '1:1',
    resolution: '2K',
    imageModel: 'image2',
    count: 1,
    sourceNodeIds: ['image-1'],
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

test('only one selected generation node receives a contextual composer position', () => {
  const node = createCanvasImageComposerNode({ x: 400, y: 220, now: 123 });
  assert.deepEqual(getCanvasComposerPresentation({ node, selectedId: node.id, selectedCount: 1 }), {
    visible: true,
    position: { left: 220, top: 512, width: 640 },
  });
  assert.deepEqual(getCanvasComposerPresentation({ node, selectedId: 'another', selectedCount: 1 }), {
    visible: false,
    position: null,
  });
  assert.deepEqual(getCanvasComposerPresentation({ node, selectedId: node.id, selectedCount: 2 }), {
    visible: false,
    position: null,
  });
  assert.deepEqual(getCanvasComposerPresentation({
    node: { ...node, x: 760, y: 500 },
    selectedId: node.id,
    selectedCount: 1,
    viewportBounds: { width: 800, height: 640 },
    viewport: { x: 0, y: 0, scale: 1 },
    height: 360,
  }).position, { left: 580, top: 792, width: 640 });

  const mobile = getCanvasComposerPresentation({
    node: { ...node, x: 80, y: 460, w: 640, h: 420 },
    selectedId: node.id,
    selectedCount: 1,
    viewportBounds: { width: 390, height: 752 },
    viewport: { x: 0, y: 0, scale: 0.68 },
    height: 420,
  });
  assert.deepEqual(mobile.position, { left: 80, top: 892, width: 640 });

  const leftRail = getCanvasComposerPresentation({
    node: { id: node.id, x: -40, y: 80, w: 240, h: 120 },
    selectedId: node.id,
    selectedCount: 1,
    viewportBounds: { width: 800, height: 640 },
    viewport: { x: 0, y: 0, scale: 1 },
    height: 300,
  });
  assert.deepEqual(leftRail.position, { left: -240, top: 212, width: 640 });
});

test('contextual composer stays anchored below its node instead of dodging neighboring nodes', () => {
  const node = createCanvasImageComposerNode({ id: 'composer', x: 760, y: 500, now: 123 });
  const position = getCanvasComposerPresentation({
    node,
    selectedId: node.id,
    selectedCount: 1,
    width: 300,
    viewportBounds: { width: 1200, height: 640 },
    viewport: { x: 0, y: 0, scale: 1 },
    height: 360,
    avoidNodes: [{ id: 'asset', x: 770, y: 128, w: 240, h: 240 }],
  }).position;
  assert.deepEqual(position, { left: 750, top: 792, width: 300 });
});

test('contextual composer can extend beyond the viewport so canvas panning remains authoritative', () => {
  const node = createCanvasSuiteComposerNode({ x: 1600, y: 260, now: 456 });
  const viewportBounds = { width: 1280, height: 672 };
  const viewport = { x: 0, y: 0, scale: 0.68 };
  const position = getCanvasComposerPresentation({
    node,
    selectedId: node.id,
    selectedCount: 1,
    viewportBounds,
    viewport,
    height: 420,
    avoidNodes: Array.from({ length: 12 }, (_, index) => ({
      id: `asset-${index}`,
      x: 100 + (index % 4) * 430,
      y: 40 + Math.floor(index / 4) * 360,
      w: 400,
      h: 330,
    })),
  }).position;
  assert.deepEqual(position, { left: 1600, top: 692, width: 640 });
});

test('local edit selections are normalized before they become generation input', () => {
  assert.deepEqual(normalizeCanvasSelection({ mode: 'rectangle', rect: { x: -0.2, y: 0.1, w: 1.4, h: 0.5 } }), {
    mode: 'rectangle',
    rect: { x: 0, y: 0.1, w: 1, h: 0.5 },
  });
  assert.deepEqual(normalizeCanvasSelection({ mode: 'subject' }), { mode: 'subject' });
  assert.deepEqual(normalizeCanvasSelection(null), { mode: 'whole' });
});

test('studio surface owns distinct add, selection and derivation controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /ec-canvas-add-menu/);
  assert.match(source, /ec-canvas-object-toolbar/);
  assert.match(source, /ec-canvas-derive-menu/);
  assert.match(source, /contentEditable=\{editing\}/);
  assert.match(source, /CanvasMultiSelectionToolbar/);
  assert.match(source, /CanvasTextGenerationComposer/);
  assert.match(source, /CanvasImageComposer/);
  assert.match(source, /CanvasEcommerceComposer/);
  assert.match(source, /CanvasFocusedEditor/);
  assert.match(source, /onDoubleClick/);
  assert.match(source, /onPointerDown\?\.\(event, node\.id\)/);
  assert.doesNotMatch(source, /<header>\s*文本\s*<\/header>/);
  assert.match(source, /SizingPanel/);
  assert.match(source, /SkuPanel/);
  assert.match(source, /StylePanel/);
  assert.match(source, /ParamsPanel/);
  assert.match(source, /CopyPanel/);
  assert.match(source, /GenSettingsPanel/);
  assert.match(source, /toggleCanvasComposerSurface/);
});

test('generation bodies render in the node map while one selected composer renders after it', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const mapStart = page.indexOf('{visibleNodes.map');
  const mapEnd = page.indexOf('{!focusedEditor', mapStart);
  assert.ok(mapStart >= 0 && mapEnd > mapStart);
  const nodeMap = page.slice(mapStart, mapEnd);
  const selectedSurface = page.slice(mapEnd);
  assert.match(nodeMap, /<CanvasGenerationNode/);
  assert.match(nodeMap, /node\.kind === 'text-composer'[\s\S]*?<CanvasGenerationNode/);
  assert.doesNotMatch(nodeMap, /<CanvasImageComposer|<CanvasTextGenerationComposer|<CanvasEcommerceComposer/);
  assert.match(selectedSurface, /selectedNode\?\.kind === 'image-composer'[\s\S]*?<CanvasImageComposer/);
  assert.match(selectedSurface, /selectedNode\?\.kind === 'text-composer'[\s\S]*?<CanvasTextGenerationComposer/);
  assert.match(selectedSurface, /selectedNode\?\.kind === 'suite-composer'[\s\S]*?<CanvasEcommerceComposer/);
});

test('uploaded and edited canvas assets do not render result metadata chrome', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/pages/EcCanvas/canvasStudioModel.js', import.meta.url), 'utf8');
  assert.match(model, /showMeta: false/);
  const focused = page.slice(page.indexOf('const handleFocusedEditorConfirm'), page.indexOf('const handleMultiSelectionAction'));
  assert.doesNotMatch(focused, /showMeta:\s*true/);
  assert.match(page, /name: '',[\s\S]*?displayLabel: '',[\s\S]*?showMeta: false/);
});

test('smart-layer generation starts collapsed and replaces its composite with real children on extraction', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const interactionModel = readFileSync(new URL('../src/pages/EcCanvas/canvasInteractionModel.js', import.meta.url), 'utf8');
  const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(page, /layerChildIds/);
  assert.match(page, /expandCanvasLayerGroup\(previous, pointerMode\.sourceNodeId\)/);
  assert.match(interactionModel, /layerExpanded: true, hidden: true/);
  assert.match(interactionModel, /parentLayerGroupId === groupNodeId[\s\S]*?hidden: false/);
  assert.match(page, /node\.kind === ['"]layer-group['"]/);
  assert.match(page, /layerChildren=\{nodes\.filter\(child => child\.parentLayerGroupId === node\.id\)\}/);
  assert.match(studio, /ec-canvas-layer-composite/);
  assert.match(studio, /\[\.\.\.layerChildren\]\.sort\([\s\S]*?\)\.map/);
  assert.match(page, /const groupNodeId = result\.groupNode\.id/);
  assert.match(page, /setMultiSelected\(new Set\(\[groupNodeId\]\)\)/);
});

test('text recognition inspector stays in the canvas stacking context', () => {
  const inspector = readFileSync(new URL('../src/pages/EcCanvas/components/TextLayerInspector.jsx', import.meta.url), 'utf8');
  assert.match(inspector, /position:\s*['"]absolute['"]/);
  assert.match(inspector, /transform:\s*['"]scale\(var\(--canvas-overlay-scale\)\)['"]/);
  assert.doesNotMatch(inspector, /position:\s*['"]fixed['"]|zIndex:\s*10004/);
});

test('selected-image tools keep key command names and compact secondary actions', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export function CanvasObjectToolbar');
  const end = source.indexOf('export function CanvasDeriveMenu', start);
  const toolbar = source.slice(start, end);
  assert.match(toolbar, /isCompactCanvasToolbarAction/);
  assert.match(toolbar, /className=\{compact \? 'is-compact' : ''\}/);
  assert.match(toolbar, /\{!compact && <span>\{action\.label\}<\/span>\}/);
  assert.match(toolbar, /title={isDisabled \? \(action\.disabledHint \|\| '暂时不可用'\) : \(action\.description \|\| action\.label\)}/);
});

test('image nodes report decoded natural dimensions and move-scale supports direct manipulation', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /onNaturalSize/);
  assert.match(source, /naturalWidth/);
  assert.match(source, /naturalHeight/);
  assert.match(source, /gesture\.kind === 'move-source-draw'/);
  assert.match(source, /options\.rotation/);
  assert.match(source, /ec-canvas-move-scale-target/);
});

test('annotation editor handles undo and redo from the keyboard', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /addEventListener\('keydown'/);
  assert.match(source, /annotationHistory/);
  assert.match(source, /annotationFuture/);
});

test('left-rail creation stays idle while source-derived creation opens its linked composer', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('const addCanvasComposer = useCallback');
  const end = page.indexOf('const updateComposerNode', start);
  const creation = page.slice(start, end);
  assert.match(creation, /setSelected\(sourceNodeIds\.length \? composer\.id : null\)/);
  assert.match(creation, /setMultiSelected\(sourceNodeIds\.length \? new Set\(\[composer\.id\]\) : new Set\(\)\)/);
});

test('right-side image generation reuses the independent image composer with source context', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const start = page.indexOf("action.id === 'image-edit' && connectionPicker.mode !== 'image-editor'");
  const end = page.indexOf("else if (connectionPicker.mode === 'image-editor'", start);
  assert.ok(start >= 0 && end > start);
  const branch = page.slice(start, end);
  assert.match(branch, /addCanvasComposer\('image'/);
  assert.match(branch, /sourceNodeId: connectionPicker\.sourceNodeId/);
  assert.doesNotMatch(branch, /setConnectionPicker\(previous => \(\{ \.\.\.previous, mode:/);
});

test('contextual composers expose fixed product controls without model selectors or destructive close buttons', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /export function CanvasGenerationNode/);
  assert.match(source, /aria-label="清晰度"/);
  assert.match(source, /套图方案/);
  assert.match(source, /生成设置/);
  assert.match(source, /ImageMentionPicker/);
  assert.doesNotMatch(source, /aria-label="图片模型"/);
  assert.doesNotMatch(source, /aria-label="文案模型"/);
  assert.doesNotMatch(source, /关闭图片生成器|关闭文案生成器|关闭电商套图生成器/);
  assert.match(source, /hasProductSource/);
  assert.match(source, /hasProductSource \? 'reference' : 'product'/);
});

test('canvas composers keep text boards editable and expose shared image-generation controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /ec-canvas-generation-text-board/);
  assert.match(source, /contentEditable/);
  assert.match(source, /aria-label="图片比例"/);
  assert.match(source, /aria-label="清晰度"/);
  assert.match(source, /CANVAS_COUNT_OPTIONS/);
  assert.match(source, /aria-label="引用图片"/);
  assert.doesNotMatch(source, /描述要生成的标题、卖点、详情文案或设计要求/);
});

test('Canvas suite uses one editable overall plan and readable source naming', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const sharedPlan = readFileSync(new URL('../src/pages/Home/ec/EcommerceDesignPlanEditor.jsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/pages/EcCanvas/canvasSuitePlanModel.js', import.meta.url), 'utf8');
  assert.match(source, /CanvasSuitePlanEditor/);
  assert.match(source, /EcommerceDesignPlanEditor/);
  assert.match(source, /整体设计方案/);
  assert.match(sharedPlan, /data-suite-shot-field/);
  assert.match(sharedPlan, /ec-shared-shot-plan/);
  assert.match(sharedPlan, /ec-shared-plan-facts/);
  assert.doesNotMatch(sharedPlan, /data-suite-plan-field/);
  assert.doesNotMatch(source, /<DirectionOptionCard/);
  assert.match(source, /上传产品图/);
  assert.match(source, /上传参考图/);
  assert.match(source, /onOpenChange/);
  assert.match(model, /visualDirection/);
  assert.match(model, /shots/);
});

test('Canvas suite keeps a failed generation actionable beside its confirm control', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('export function CanvasEcommerceComposer');
  const end = source.indexOf('const FOCUSED_EDITOR_LABELS', start);
  const composer = source.slice(start, end);

  assert.match(composer, /node\.error[\s\S]*?role="alert"/);
  assert.match(composer, /重新生成/);
  assert.match(composer, /node\.error \? <div className="ec-canvas-composer-error" role="alert"/);
  assert.doesNotMatch(composer, /onSurfaceChange\?\.\(closeCanvasComposerSurface\(\)\); onGenerate\?\.\(\);/);
});

test('Canvas suite prevents concurrent charged generation submissions', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('const handleSuiteComposerGenerate');
  const end = page.indexOf('const handleSuiteDirectionSelect', start);
  const handler = page.slice(start, end);

  assert.match(handler, /suiteGenerationInFlightRef\.current\.has\(composer\.id\)/);
  assert.match(handler, /suiteGenerationInFlightRef\.current\.add\(composer\.id\)/);
  assert.match(handler, /finally \{\s*suiteGenerationInFlightRef\.current\.delete\(composer\.id\);\s*\}/);
});

test('canvas text generation creates image results while retaining its editable board', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('const handleTextGenerationGenerate');
  const end = page.indexOf('const handleAddTextNode', start);
  const handler = page.slice(start, end);
  assert.match(handler, /regenerateCanvasImage/);
  assert.match(handler, /kind: 'image'/);
  assert.doesNotMatch(handler, /regenerateCanvasText/);
  assert.doesNotMatch(handler, /kind: 'text',[\s\S]*?status: 'success'/);
});

test('Canvas generation forwards selected quality and structured references', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const imageStart = page.indexOf('const handleImageComposerGenerate');
  const imageEnd = page.indexOf('const handleSuiteComposerGenerate', imageStart);
  const imageHandler = page.slice(imageStart, imageEnd);
  assert.match(imageHandler, /referenceImages:\s*sourceNodes\.slice\(1\)/);
  assert.match(imageHandler, /resolution:\s*composer\.resolution/);
  const textStart = page.indexOf('const handleTextGenerationGenerate');
  const textEnd = page.indexOf('const handleAddTextNode', textStart);
  const textHandler = page.slice(textStart, textEnd);
  assert.match(textHandler, /regenerateCanvasImage\(\{/);
  assert.match(textHandler, /referenceImages:\s*sourceNodes\.slice\(1\)/);
  assert.match(textHandler, /resolution:\s*composer\.resolution/);
  assert.match(textHandler, /Array\.from\(\{ length: count \}/);
});

test('plain text tools never route through image text generation', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(page, /onText=\{\(\) => handleAddTextNode\(\)\}/);
  assert.match(page, /e\.key\.toLowerCase\(\) === ['"]t['"][\s\S]*?handleAddTextRef\.current/);
  assert.match(page, /node\.kind === 'text'/);
  assert.doesNotMatch(page, /textComposerNodeId|textComposerValue/);
});

test('plain text starts as a bold double-click hint and reverse prompt reuses the text composer', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../src/pages/EcCanvas/canvasStudioModel.js', import.meta.url), 'utf8');
  const reverseStart = page.indexOf("if (handler === 'reverse-prompt')");
  const reverseEnd = page.indexOf("if (handler === 'grid-split')", reverseStart);
  const reverseHandler = page.slice(reverseStart, reverseEnd);
  assert.match(model, /text: ''/);
  assert.match(model, /fontSize: 48/);
  assert.match(model, /fontWeight: 700/);
  assert.match(reverseHandler, /createCanvasTextComposerNode/);
  assert.doesNotMatch(reverseHandler, /createCanvasTextNode/);
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
  assert.match(page, /createCanvasTextComposerNode/);
  assert.match(page, /<CanvasImageComposer/);
  assert.match(page, /<CanvasEcommerceComposer/);
  assert.match(page, /<CanvasTextGenerationComposer/);
  assert.match(page, /getDesignDirections/);
  assert.doesNotMatch(page, /ReferenceComposer|composerNodes|composerAction/);
  assert.match(page, /handleComposerSourceUpload/);
  assert.doesNotMatch(chrome, /const actions = \[/);
  assert.match(chrome, /ec-canvas-rail-add/);
});

test('image composer owns reference uploads instead of reopening a legacy floating composer', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /onAddSources/);
  assert.match(source, /aria-label=\{`添加\$\{uploadLabel\}`\}/);
  assert.match(source, /ImageMentionPicker/);
  assert.doesNotMatch(source, /ReferenceComposer/);
});

test('generation composer controls stop canvas gestures and selection owns dismissal', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const composerSource = source.slice(source.indexOf('export function CanvasImageComposer'), source.indexOf('const FOCUSED_EDITOR_LABELS'));
  assert.match(composerSource, /onPointerDown=\{event => event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(composerSource, /onClose\?\.\(\)/);
});

test('image generation composer uses a complete preview and optional local edit target', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /objectFit: 'contain'/);
  assert.match(source, /局部目标/);
  assert.match(source, /selection/);
  assert.match(source, /主体/);
});

test('image remix workflow keeps one editable generation request field', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/modular/SmartRemixNodeCard.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.equal((source.match(/<textarea\b/g) || []).length, 1);
  assert.match(source, /生成要求/);
  assert.doesNotMatch(source, /remix-instruction|补充调整/);
  assert.doesNotMatch(page, /node\.inputs\?\.instruction/);
  assert.doesNotMatch(page, /instruction:\s*''/);
});

test('canvas workflow retry resubmits an existing generation request and reruns ordinary processing nodes', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = page.indexOf('const handleWorkflowRetry = useCallback');
  const end = page.indexOf('\n\n  const handleWorkflowAddImages', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const retry = page.slice(start, end);
  assert.match(retry, /node\.actionId === ['"]smart-remix['"]/);
  assert.match(retry, /node\.inputs\?\.prompt/);
  assert.match(retry, /handleWorkflowGenerate\(\{ \.\.\.node/);
  assert.match(retry, /void workflowProcessRef\.current\?\.\(\{ \.\.\.node/);
});

test('canvas remix variants use one stable run id for retries and distinct request keys per output', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = page.indexOf('const handleWorkflowGenerate = useCallback');
  const end = page.indexOf('\n\n  const handleWorkflowRetry', start);
  assert.ok(start >= 0 && end > start);
  const generate = page.slice(start, end);
  assert.match(generate, /generationRunId/);
  assert.match(generate, /requestKey:\s*`\$\{generationRunId\}:\$\{index \+ 1\}`/);
  assert.match(generate, /generationRunId:\s*remainingIndexes\.length\s*\?\s*generationRunId\s*:\s*null/);
  assert.match(generate, /Promise\.allSettled/);
  assert.match(generate, /pendingOutputIndexes/);
  assert.match(generate, /只重试失败项/);
});

test('context create actions reuse the executable workflow-node creation path', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const start = page.indexOf('const handleContextAction = async');
  const end = page.indexOf('  const handleRecognizeCanvasText', start);
  assert.ok(start >= 0 && end > start);
  const branch = page.slice(start, end);
  assert.match(branch, /const actionSpec = getCanvasAction\(actionId\)/);
  assert.match(branch, /handleCreateDerivedNode\(source\.id, actionSpec/);
  assert.doesNotMatch(branch, /const child = createDerivedNode\(/);
});

test('focused editing exposes complete functional annotation and geometry controls', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  for (const label of ['画笔', '矩形', '箭头', '文字', '撤销', '重做', '清除标注']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /aria-label="标注颜色"/);
  assert.match(source, /aria-label="标注粗细"/);
  assert.match(source, /aria-label="在图片上输入文字"/);
  assert.match(source, /ec-canvas-move-scale-source/);
  assert.match(source, /ec-canvas-move-scale-target/);
  assert.match(page, /focusedEditor\.mode === 'move-scale'[\s\S]*?transformCanvasImage/);
  assert.match(source, /onPointerMove/);
  assert.match(source, /annotations\.map/);
  assert.doesNotMatch(source, /aria-modal="true"/);
});

test('inline annotation geometry supports pen, rectangle, arrow, and text', () => {
  const base = { color: '#ef4444', width: 4 };
  const pen = createCanvasAnnotation('pen', { x: 0.1, y: 0.2 }, base);
  assert.deepEqual(updateCanvasAnnotation(pen, { x: 0.4, y: 0.6 }).points.at(-1), { x: 0.4, y: 0.6 });
  const rectangle = updateCanvasAnnotation(createCanvasAnnotation('rectangle', { x: 0.8, y: 0.7 }, base), { x: 0.2, y: 0.3 });
  assert.deepEqual({ x: rectangle.x, y: rectangle.y, w: rectangle.w, h: rectangle.h }, { x: 0.2, y: 0.3, w: 0.6, h: 0.4 });
  const arrow = updateCanvasAnnotation(createCanvasAnnotation('arrow', { x: 0.2, y: 0.3 }, base), { x: 0.9, y: 0.8 });
  assert.deepEqual({ x1: arrow.x1, y1: arrow.y1, x2: arrow.x2, y2: arrow.y2 }, { x1: 0.2, y1: 0.3, x2: 0.9, y2: 0.8 });
  assert.equal(createCanvasAnnotation('text', { x: 0.5, y: 0.5 }, { ...base, text: '材质细节' }).text, '材质细节');
});

test('text annotation starts an inline editor at the clicked image point', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(source, /annotationTextDraft/);
  assert.match(source, /autoFocus/);
  assert.match(source, /commitAnnotationText/);
  assert.doesNotMatch(source, /aria-label="标注说明"/);
});

test('inline crop and blank placement stay normalized and avoid occupied canvas objects', () => {
  assert.deepEqual(normalizeCanvasCropRect({ x: -1, y: 0.9, w: 2, h: 0.5 }), { x: 0, y: 0.9, w: 1, h: 0.1 });
  const placement = findCanvasBlankPlacement({
    width: 260,
    height: 180,
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1200, height: 800 },
    nodes: [{ id: 'source', x: 420, y: 260, w: 260, h: 260 }],
    sourceNode: { id: 'source', x: 420, y: 260, w: 260, h: 260 },
  });
  assert.ok(placement.x >= 24 && placement.y >= 24);
  assert.equal(placement.x < 680 && placement.x + 260 > 420 && placement.y < 520 && placement.y + 180 > 260, false);
});

test('blank placement starts at the visible canvas center before scanning its edges', () => {
  const placement = findCanvasBlankPlacement({
    width: 420,
    height: 84,
    viewport: { x: -120, y: 40, scale: 0.8 },
    bounds: { width: 1200, height: 800 },
    nodes: [],
  });
  assert.deepEqual(placement, { x: 690, y: 408 });
});

test('blank placement expands beyond a crowded viewport instead of returning an overlap', () => {
  const placement = findCanvasBlankPlacement({
    width: 640,
    height: 420,
    viewport: { x: 0, y: 0, scale: 1 },
    bounds: { width: 1200, height: 800 },
    nodes: [
      { id: 'top', x: 24, y: 24, w: 1152, h: 300 },
      { id: 'bottom', x: 24, y: 340, w: 1152, h: 420 },
    ],
  });
  const overlaps = node => placement.x < node.x + node.w + 16
    && placement.x + 640 + 16 > node.x
    && placement.y < node.y + node.h + 16
    && placement.y + 420 + 16 > node.y;
  assert.equal(overlaps({ x: 24, y: 24, w: 1152, h: 300 }), false);
  assert.equal(overlaps({ x: 24, y: 340, w: 1152, h: 420 }), false);
  assert.ok(placement.x < 24 || placement.y < 24 || placement.x > 536 || placement.y > 356);
});

test('new canvas surfaces have a complete responsive visual contract', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  for (const className of [
  'ec-canvas-multi-toolbar',
    'ec-canvas-multi-selection-box',
    'ec-canvas-node-composer',
    'ec-canvas-context-composer',
    'ec-canvas-generation-node',
    'ec-canvas-focused-editor',
    'ec-canvas-focused-stage',
    'ec-canvas-focused-toolbar',
  ]) {
    assert.match(css, new RegExp(`\\.${className}\\s*\\{`), `${className} must be styled`);
  }
  assert.doesNotMatch(css, /\.ec-canvas-lane-label\s*\{/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-node-composer/);
  assert.doesNotMatch(css, /\.ec-canvas-focused-editor\s*\{[^}]*inset:\s*0/);
});

test('Canvas density uses content-sized toolbars and readable metadata', () => {
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /width:\s*680/);
  assert.doesNotMatch(source, /Math\.max\(88,/);
  assert.doesNotMatch(css, /\.ec-canvas-media-node footer\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /--ec-canvas-action-font:\s*12px/);
  assert.match(css, /--ec-canvas-meta-font:\s*10px/);
  assert.match(css, /\.ec-canvas-multi-toolbar button\s*\{[^}]*font-size:\s*var\(--ec-canvas-action-font\)/s);
  assert.match(source, /const estimatedWidth = 76 \+ actions\.reduce/);
  assert.match(source, /title={isDisabled \? \(action\.disabledHint \|\| '暂时不可用'\) : \(action\.description \|\| action\.label\)}/);
  assert.match(source, /<span>\{action\.label\}<\/span>/);
  assert.match(source, /<Icon size=\{15\} \/><span>\{action\.label\}<\/span>/);
  assert.match(css, /\.ec-canvas-multi-toolbar button\s*\{[^}]*min-width:\s*var\(--ec-canvas-control-height\);[^}]*width:\s*auto;[^}]*padding:\s*0 8px;/s);
});

test('the primary add rail has a generous Liuying-style hit target', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  const chrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
  assert.match(css, /\.ec-canvas-left-rail \{[^}]*width: 52px;[^}]*padding: 6px;/);
  assert.match(css, /\.ec-canvas-left-rail \.ec-canvas-rail-add \{[^}]*width: 40px;[^}]*height: 40px;/);
  assert.match(chrome, /className="ec-canvas-rail-add"><Plus size=\{22\}/);
});

test('canvas output port stays clear of resize handles and owns click feedback', () => {
  const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
  assert.match(css, /\.ec-canvas-node-port \{[^}]*right: -32px/);
  assert.match(source, /onPointerUp=\{event => onPointerUp\?\.\(event\)\}/);
});

test('canvas async processing cannot resurrect a deleted source node', () => {
  const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(page, /nodesRef\.current\.some\(node => node\.id === source\.id\)/);
  assert.match(page, /if \(!focusedEditor \|\| promptLoading\) return/);
  assert.match(page, /removeCanvasNode\(node\.id\)/);
});
