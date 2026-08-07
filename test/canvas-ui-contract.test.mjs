import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const chrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

test('Canvas keeps distinct select and hand tools with a discoverable multi-select hint', () => {
  assert.match(chrome, /id: 'select'/);
  assert.match(chrome, /id: 'hand'/);
  assert.match(chrome, /Shift\+点击多选/);
  assert.match(chrome, /拖拽框选\s*\/\s*Shift\+点击多选/);
  assert.doesNotMatch(chrome, /ec-canvas-selection-hint/);
  assert.doesNotMatch(css, /\.ec-canvas-selection-hint/);
});

test('full-suite export remains an explicit top-level Canvas command', () => {
  assert.match(chrome, /导出整套图片/);
  assert.match(studio, /action\.label/);
  assert.match(chrome, /AccountEntitlementControl/);
  assert.match(page, /setExportSelectionIds\(new Set\(\)\)/);
});

test('transient Canvas notices can be dismissed and old timers cannot clear newer notices', () => {
  assert.match(page, /toastTimerRef/);
  assert.match(page, /clearTimeout\(toastTimerRef\.current\)/);
  assert.match(page, /aria-label="关闭提示"/);
  assert.match(css, /\.ec-canvas-toast/);
});

test('compact selection controls and mobile bottom controls have bounded geometry', () => {
  assert.match(css, /--ec-canvas-control-height:\s*32px/);
  assert.match(css, /\.ec-canvas-multi-toolbar\s*\{[^}]*max-width:\s*min\(900px, 86vw\)/s);
  const mobile = css.slice(css.indexOf('@media (max-width: 620px)'));
  assert.match(mobile, /\.ec-canvas-zoom-controls\s*\{[^}]*left:\s*8px/s);
  assert.match(mobile, /\.ec-canvas-bottom-dock\s*\{[^}]*right:\s*8px/s);
  assert.match(mobile, /\.ec-canvas-multi-toolbar button\s*\{[^}]*min-width:\s*28px/s);
  assert.match(mobile, /\.ec-canvas-multi-toolbar > strong\s*\{[^}]*padding:\s*0 4px;[^}]*font-size:\s*11px/s);
});
