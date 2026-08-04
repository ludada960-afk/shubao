import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('empty commerce canvas guides a seller to upload product originals or import works', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(source, /双击画布导入商品素材/);
  assert.match(source, /上传图片/);
  assert.match(source, /从我的作品导入/);
  assert.match(source, /生成电商套图/);
  assert.match(source, /onDoubleClick=\{[\s\S]*?sourceUploadRef\.current\?\.click\(\)/);
  assert.doesNotMatch(source, /CanvasSourceImportSheet|sourceImportOpen|product_original|style_reference|general_material/);
  assert.match(css, /\.ec-canvas-empty-state \{[^}]*z-index: 10;[^}]*pointer-events: none;/);
  assert.match(css, /\.ec-canvas-empty-state > div \{[^}]*pointer-events: auto;/);
});

test('commerce canvas uses a quiet professional shell and contextual world panels', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(source, /CanvasTopBar/);
  assert.match(source, /CanvasLeftRail/);
  assert.match(source, /CanvasBottomToolbar/);
  assert.match(source, /CanvasZoomControls/);
  assert.match(source, /getCanvasComposerPresentation/);
  assert.match(source, /selectedComposerPosition = getCanvasComposerPresentation\([\s\S]*?\)\.position/);
  assert.doesNotMatch(source, /空白拖拽平移/);
  assert.doesNotMatch(source, /fixed[^\n]+right: 20[^\n]+bottom: 20/);
  assert.match(css, /\.ec-canvas-stage \{[^}]*overflow: clip;/);
  assert.doesNotMatch(css, /\.ec-canvas-stage \{[^}]*overflow: hidden;/);
});

test('canvas creation uses movable nodes and omits the legacy centered composer', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /createCanvasImageComposerNode/);
  assert.match(source, /createCanvasSuiteComposerNode/);
  assert.match(source, /createCanvasTextNode/);
  assert.match(source, /handleComposerSourceUpload/);
  assert.match(source, /node\.kind === 'image-composer'/);
  assert.match(source, /node\.kind === 'suite-composer'/);
  assert.doesNotMatch(source, /ReferenceComposer|composerNodes|composerAction|closeComposer/);
});

test('mobile canvas stacks the header and keeps bottom controls separate', async () => {
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-topbar \{[\s\S]*?flex-wrap: wrap/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-topbar \{[\s\S]*?flex-basis: 92px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-bottom-toolbar \{ left: auto; right: 8px;[\s\S]*?transform: none/);
});

test('browser segmentation reports progress on the transient workflow node and edge', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

  assert.match(source, /const \[segmentationJobs, setSegmentationJobs\] = useState\(\[\]\)/);
  assert.match(source, /canvasSegmentationRuntime\.prewarm/);
  assert.match(source, /createCanvasSegmentationPlan/);
  assert.match(source, /segmentationMasksToApi/);
  assert.doesNotMatch(source, /segmentationJobs\.map\(job => <CanvasSegmentationProgress/);
  assert.match(source, /workflowNodeId/);
  assert.match(source, /progressLabel: progress\.detail \|\| progress\.label/);
  assert.match(source, /currentProgress = reduceSegmentationProgress\(currentProgress, event\)/);
  assert.match(source, /ec-canvas-edge-processing/);
  assert.match(source, /segmentationAbortRef\.current\.values\(\)/);
  assert.match(source, /segmentationAbortRef\.current\.clear\(\)/);
  assert.match(source, /createCanvasSnapshot\(\{ nodes, connections, viewport \}\)/);
  assert.doesNotMatch(source, /createCanvasSnapshot\(\{[^}]*segmentationJobs/);
  assert.match(css, /\.ec-canvas-generation-node\.is-processing \{[^}]*border-style: dashed/);
  assert.match(css, /\.ec-canvas-edge-processing \{/);
});
