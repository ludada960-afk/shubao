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
  /* 9-17 修：DialogProvider 的真实入参是 confirmLabel / cancelLabel。
     原来写的是 confirmText / cancelText —— 被组件**静默忽略**，
     用户在弹窗上看到的永远是「取消 / 确认」，与设计文案对不上。
     契约随之改为校验真实生效的键名。 */
  assert.ok(canvas.includes('confirmLabel: \'保存到画布库\'') && canvas.includes('cancelLabel: \'不保存\''), '两个选项（按 DialogProvider 真实 API）');
  assert.ok(!/confirmText:|cancelText:/.test(canvas), '不再使用被忽略的 confirmText/cancelText');
  assert.ok(canvas.includes('await handleCanvasSessionSaveRef.current?.();'), '选保存 → 保存会话');
  assert.ok(canvas.includes('await deleteCanvas(canvasSessionRef.current.id);'), '选不保存 → 丢弃（复用画布库删除接口）');
});

test('9-17：新建画布没有项目时也要能真的存进画布库', () => {
  /* 实测漏洞：刚新建的画布没有 result.projectId / versionId（项目是上传/生成时才建的），
     点「保存到画布库」原来直接报「当前作品缺少可保存的项目版本」，什么都没落库。
     现在缺项目就先按画布既有口径建一个，再存会话。 */
  assert.ok(/let projectId = result\.projectId;/.test(canvas), 'projectId 改为可变');
  assert.ok(canvas.includes("const created = await ensureCanvasMediaProject('Canvas 画布', 'ecommerce');"), '缺项目先建项目');
  assert.ok(canvas.includes('showToast(\'画布暂时无法保存，请稍后重试\', \'error\')'), '建不出来时给用户可读的提示');
});

test('9-17：离开入口覆盖画布自己的顶栏，并且关标签页/刷新也要守住', () => {
  /* 实测漏洞：原选择器只覆盖全站导航，而画布页 App.jsx 不渲染 SideNav/TopBar，
     画布自己的「返回」按钮不在其中 → 点返回直接回首页，不询问也不保存。 */
  assert.ok(canvas.includes('.ec-canvas-topbar'), '离开选择器纳入画布顶栏（返回按钮）');
  assert.ok(canvas.includes("window.addEventListener('beforeunload', handleBeforeUnload)"), '关标签页/刷新也守');
  assert.ok(canvas.includes('event.returnValue = \'\';'), '标准 beforeunload 触发方式');
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
