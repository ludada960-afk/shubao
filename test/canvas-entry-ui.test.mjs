import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('empty canvas presents image, video, works, and generation entrypoints', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(source, /从一个素材开始，继续完成整套视觉内容/);
  assert.match(source, /上传图片/);
  assert.match(source, /上传视频/);
  assert.match(source, /从我的作品导入/);
  assert.match(source, /生成电商套图/);
  assert.match(source, /生成视频/);
  assert.match(source, /onDoubleClick=\{[\s\S]*?sourceUploadRef\.current\?\.click\(\)/);
  assert.doesNotMatch(source, /CanvasSourceImportSheet|sourceImportOpen|product_original|style_reference|general_material/);
  assert.match(css, /\.ec-canvas-empty-state \{[^}]*z-index: 10;[^}]*pointer-events: none;/);
  assert.match(css, /\.ec-canvas-empty-state > div \{[^}]*pointer-events: auto;/);
  assert.match(css, /\.ec-canvas-empty-actions \{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(max-content,\s*1fr\)\)/);
  assert.doesNotMatch(css, /@media \(max-width: 900px\)\s*\{\s*\.ec-canvas-empty-actions/);
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
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-topbar \{[\s\S]*?flex-basis: 96px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-bottom-dock \{ left: auto; right: 8px;[\s\S]*?transform: none/);
});

test('Canvas exposes a dedicated asset library view without mixing it with Works', async () => {
  const [source, chrome] = await Promise.all([
    readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(chrome, /\['assets', '素材库'\]/);
  assert.match(source, /tab === 'assets'/);
  assert.match(source, /tab === 'assets' && state\.logged/);
  assert.match(source, /tab !== 'assets'/);
  assert.match(source, /tab === 'works' \|\| tab === 'trash'/);
  assert.match(source, /tab === 'assets' && !state\.logged/);
  assert.match((await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8')), /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-tabs \{[^}]*display: flex;[^}]*overflow-x: auto/);
});

test('Canvas follows a top-level tab request while the page is already mounted', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /const requestedTab = state\.canvasEntryTab/);
  assert.match(source, /requestedTab && requestedTab !== tab/);
  assert.match(source, /setTab\(requestedTab\)/);
});

test('Canvas asset library resets its account boundary before loading the next owner', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const effect = source.match(/if \(tab !== 'assets' \|\| !state\.logged \|\| result\?\.browserQa\)[\s\S]*?\}, \[[^\]]*phone[^\]]*\]\);/)?.[0] || '';
  assert.match(effect, /setProjectAssetLibrary\(\[\]\)/);
  assert.match(effect, /setSelectedProjectAssetKeys\(new Set\(\)\)/);
  assert.match(effect, /phone/);
});

test('Works actions are keyboard-accessible and named for assistive technology', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /<button type="button" aria-label=\{`打开\$\{work\.name\}`\}/);
  assert.match(source, /<button type="button" aria-label="恢复作品"/);
  assert.match(source, /<button type="button" aria-label="移入回收站"/);
  assert.doesNotMatch(source, /<div onClick=\{\(\) => openWork\(work\)\}/);
  assert.doesNotMatch(source, /<div onClick=\{\(\) => deleteWork\(work\.id\)\}/);
});

test('Works only updates local trash after the server confirms deletion', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const deleteBlock = source.match(/const deleteWork = async \(id\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.match(deleteBlock, /const deleted = work\._saveKey \? await softDeleteWork\(work\._saveKey\) : true/);
  assert.match(deleteBlock, /if \(!deleted\) return showToast\('移入回收站失败，请重试', 'error'\)/);
  assert.match(deleteBlock, /if \(!deleted\)[\s\S]*?setPastWorks/);
  assert.doesNotMatch(deleteBlock, /softDeleteWork\(work\._saveKey\)[\s\S]*?setPastWorks[\s\S]*?if \(!/);
});

test('Canvas trash stores stable media identity instead of transient playback URLs', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const deleteBlock = source.match(/const deleteWork = async \(id\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.match(source, /stripTransientWorkPlayback/);
  assert.match(deleteBlock, /const trashItem = stripTransientWorkPlayback\(\{ \.\.\.work, deletedAt: Date\.now\(\) \}\)/);
});

test('Canvas sanitizes legacy Works and trash caches before restoring them', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /localWorks = Array\.isArray\(parsed\) \? parsed\.map\(stripTransientWorkPlayback\) : \[\]/);
  assert.match(source, /localTrash = \(\(\) => \{[\s\S]*?Array\.isArray\(parsed\) \? parsed\.map\(stripTransientWorkPlayback\) : \[\]/);
  const deleteBlock = source.match(/const deleteWork = async \(id\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  const restoreBlock = source.match(/const restoreDeletedWork = async \(work\) => \{[\s\S]*?\n  \};/)?.[0] || '';
  assert.match(deleteBlock, /const durableTrash = Array\.isArray\(localTrash\) \? localTrash\.map\(stripTransientWorkPlayback\) : \[\]/);
  assert.match(restoreBlock, /const durableTrash = Array\.isArray\(localTrash\) \? localTrash\.map\(stripTransientWorkPlayback\) : \[\]/);
});

test('browser segmentation reports progress on the transient workflow node and edge', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /segmentationJobs/);
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
  assert.match(source, /createCanvasSnapshot\(\{ nodes, connections, viewport(?:, pendingProjectAssetImports)? \}\)/);
  assert.doesNotMatch(source, /createCanvasSnapshot\(\{[^}]*segmentationJobs/);
  assert.match(css, /\.ec-canvas-generation-node\.is-processing \{[^}]*border-style: dashed/);
  assert.match(css, /\.ec-canvas-edge-processing \{/);
});
