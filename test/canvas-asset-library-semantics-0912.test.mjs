// test/canvas-asset-library-semantics-0912.test.mjs
// 2026-09-12 用户批注：① 上传的东西不能自动进资产库（只有用户手动加入才算）；
// ② 不要再对用户谈「归档」；③ 术语统一为「资产库」；④ 已加入的按钮要高亮。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../src/pages/EcCanvas/canvasActionRegistry.js', import.meta.url), 'utf8');

test('上传素材不自动进资产库（provenance=source 不参与自动登记）', () => {
  assert.match(page, /if \(node\?\.provenance === 'source'\) return false;/);
});

test('用户可见文案不再出现「归档」', () => {
  const strings = (page.match(/'[^'\n]*'/g) || []).filter(text => /[\u4e00-\u9fa5]/.test(text));
  const leaked = strings.filter(text => /归档/.test(text));
  assert.deepEqual(leaked, [], '不该再谈归档: ' + leaked.slice(0, 3).join(' | '));
});

test('术语统一为「资产库」', () => {
  assert.match(registry, /action\('save-to-assets', '加入资产库'/);
  assert.doesNotMatch(registry, /素材库/);
});

test('已加入资产库的按钮高亮 + 文案变化', () => {
  assert.match(studio, /const alreadyAsset = action\.id === 'save-to-assets'/);
  assert.match(studio, /alreadyAsset \? 'is-active' : ''/);
  assert.match(css, /\.ec-canvas-object-toolbar button\.is-active \{/);
});
