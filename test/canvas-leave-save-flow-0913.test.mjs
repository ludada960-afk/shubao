// test/canvas-leave-save-flow-0913.test.mjs
// 2026-09-13 用户批注（口述规则）：
//   ① 从画布库打开的画布 → 离开时静默保存、不询问；
//   ② 新建/临时的画布 → 离开时询问是否保存到画布库；不保存则丢弃（不占资源、不进画布库）；
//   ③ 已保存过（在画布库里）的画布，之后怎么改都持续保存。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('离开画布守卫：来自画布库则静默保存，否则询问', () => {
  assert.ok(canvas.includes('openedFromLibraryRef'), '记录是否来自画布库');
  assert.ok(/if \(openedFromLibraryRef\.current\) \{[\s\S]{0,120}handleCanvasSessionSaveRef\.current\?\.\(\)/.test(canvas), '来自画布库 → 静默保存');
  assert.ok(canvas.includes('title: \'保存这张画布？\''), '询问文案存在');
  assert.ok(canvas.includes('confirmText: \'保存到画布库\'') && canvas.includes('cancelText: \'不保存\''), '两个选项');
  assert.ok(canvas.includes('await handleCanvasSessionSaveRef.current?.();'), '选保存 → 保存会话');
  assert.ok(canvas.includes('await deleteCanvas(canvasSessionRef.current.id);'), '选不保存 → 丢弃（复用画布库删除接口）');
});

test('守卫只在真正离开画布时生效，且空画布不打扰', () => {
  assert.ok(canvas.includes('LEAVING_SELECTOR'), '限定离开入口选择器');
  assert.ok(canvas.includes('if (!nodesRef.current.length) return;'), '空画布不弹窗');
  assert.ok(canvas.includes("document.addEventListener('click', handleCapture, true)"), '捕获阶段拦截');
  assert.ok(canvas.includes('leaveGuardBypassRef.current = true;') && canvas.includes('target.click();'), '确认后继续原导航');
});

test('从画布库打开时置位（后续离开静默保存）', () => {
  assert.ok(/setCanvasSession\(\{ id: session\.id, revision: session\.revision \}\);\s*\n\s*openedFromLibraryRef\.current = true;/.test(canvas), 'openCanvasFromLibrary 置位');
});

test('画布库按日期分组', () => {
  const modal = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasLibraryModal.jsx', import.meta.url), 'utf8');
  assert.ok(modal.includes('groupedItems'), '分组计算存在');
  assert.ok(modal.includes("'今天'") && modal.includes("'昨天'"), '今天/昨天标签');
  assert.ok(modal.includes('canvas-library-date'), '组标题元素');
});
