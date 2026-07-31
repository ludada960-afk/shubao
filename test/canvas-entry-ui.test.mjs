import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('empty commerce canvas guides a seller to upload product originals or import works', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /双击画布导入商品素材/);
  assert.match(source, /上传商品原图/);
  assert.match(source, /从我的作品导入/);
  assert.match(source, /生成电商套图/);
  assert.match(source, /id: 'product_original'/);
  assert.match(source, /CanvasSourceImportSheet/);
  assert.match(source, /style_reference/);
  assert.match(source, /general_material/);
  assert.match(source, /onDoubleClick=\{[\s\S]*?setSourceImportOpen\(true\)/);
});

test('commerce canvas uses a quiet professional shell and contextual world panels', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /CanvasTopBar/);
  assert.match(source, /CanvasLeftRail/);
  assert.match(source, /CanvasBottomToolbar/);
  assert.match(source, /CanvasZoomControls/);
  assert.match(source, /getContextPanelPosition/);
  assert.doesNotMatch(source, /空白拖拽平移/);
  assert.doesNotMatch(source, /fixed[^\n]+right: 20[^\n]+bottom: 20/);
});

test('switching canvas tools dismisses the previous node composer', async () => {
  const source = await readFile(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /function ReferenceComposer\([\s\S]*?onClose/);
  assert.match(source, /const closeComposer = useCallback/);
  assert.match(source, /const handleAddTextNode = useCallback\([\s\S]*?closeComposer\(\)/);
  assert.match(source, /<ReferenceComposer[\s\S]*?onClose=\{closeComposer\}/);
});

test('mobile canvas stacks the header and keeps bottom controls separate', async () => {
  const css = await readFile(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-topbar \{[\s\S]*?flex-wrap: wrap/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-topbar \{[\s\S]*?flex-basis: 92px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*?\.ec-canvas-bottom-toolbar \{ left: auto; right: 8px;[\s\S]*?transform: none/);
});
