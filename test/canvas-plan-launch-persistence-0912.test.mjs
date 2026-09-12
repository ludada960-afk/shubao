// test/canvas-plan-launch-persistence-0912.test.mjs
// 2026-09-12 用户三次反馈：带设计方案进画布仍是空的。真因是发射图**被后续重建清掉**。
// 约定：发射图必须常驻（进画布后 result 还会变、重建效应会再跑），直到用户打开别的作品或主动删除。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('发射图记入 ref 并常驻', () => {
  assert.match(page, /const planLaunchGraphRef = useRef\(null\)/);
  assert.match(page, /planLaunchGraphRef\.current = \{\s*\n\s*nodes: graph\.nodes\.map\(normalizeCanvasNode\),/);
});

test('空画布分支优先还原发射图（不被清空）', () => {
  assert.match(page, /if \(!hasCurrent\) \{\s*\n\s*const launchGraph = planLaunchGraphRef\.current;\s*\n\s*if \(launchGraph\?\.nodes\?\.length\) \{/);
  assert.match(page, /setNodes\(launchGraph\.nodes\);\s*\n\s*setConnections\(launchGraph\.connections\);/);
});

test('打开别的作品 / 用户主动删除时让位（发射图不复活）', () => {
  assert.match(page, /打开的是别的作品[\s\S]{0,80}planLaunchGraphRef\.current = null;/);
  assert.match(page, /if \(handler === 'delete'\) \{\s*\n\s*\/\*[\s\S]*?\*\/\s*\n\s*planLaunchGraphRef\.current = null;/);
});
