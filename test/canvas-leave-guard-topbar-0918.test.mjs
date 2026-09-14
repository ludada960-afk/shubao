// test/canvas-leave-guard-topbar-0918.test.mjs
// 2026-09-18 P0 交叉验证：诊断方报告「点新建画布被离开守卫在捕获阶段劫持，
// 转去弹『保存这张画布？』」，并称根因是 LEAVING_SELECTOR 含整条 .ec-canvas-topbar，
// 波及 导出/模板广场/画布页签。
//
// 实测结论：**该根因与现象在本仓当前代码上均不成立**。
//   · LEAVING_SELECTOR 常量**已不存在**（早在 82fb7410 就被移除）；
//   · 现判据 isLeavingNavigation 只认 [data-canvas-leave-guard] 或指向非 /ec-canvas 的 <a href>；
//   · 真实浏览器（画布非空 6 节点）逐个点顶栏按钮：新建画布→画布库 true、守卫弹窗 false；
//     导出/模板广场/资产库/作品集/当前画布 全部 守卫弹窗 false；
//   · 点「返回」仍正常弹保存询问（原行为未被改回去）。
//
// 本测试把这些钉成契约，防止「顶栏被当离开入口」这类误伤回潮。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvas = read('src/pages/EcCanvas/index.jsx');
const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');

function guardBlock() {
  const start = canvas.indexOf('const CANVAS_PATHNAME');
  assert.ok(start > 0, '必须能找到离开守卫判据');
  const end = canvas.indexOf("document.addEventListener('click', handleCapture, true)", start);
  assert.ok(end > start, '必须能找到事件注册');
  return canvas.slice(start, end);
}

test('守卫判据不得把整条画布顶栏当成离开入口（P0 误伤根因）', () => {
  const block = guardBlock();
  assert.doesNotMatch(block, /\.ec-canvas-topbar/,
    '判据里不得出现 .ec-canvas-topbar —— 顶栏含 新建画布/导出/模板广场/页签，全部会被误伤');
  assert.equal(canvas.includes('LEAVING_SELECTOR'), false,
    'LEAVING_SELECTOR 这种「命中即离开」的判据不得复活（已在 82fb7410 移除）');
});

test('守卫只认两类真导航目标（弹窗按钮天然不满足）', () => {
  const block = guardBlock();
  assert.match(block, /target\.closest\('\[data-canvas-leave-guard\]'\)/, '认显式标记（返回按钮）');
  assert.match(block, /target\.closest\('a\[href\]'\)/, '认链接导航');
  assert.match(block, /return path !== CANVAS_PATHNAME/, '必须比对目标路径是否真的不是画布页');
});

test('顶栏里只有「返回」带 data-canvas-leave-guard，其余按钮一个都不带', () => {
  const marks = (chrome.match(/data-canvas-leave-guard=(?:"true"|\{true\})/g) || []).length;
  assert.equal(marks, 1, '只允许「返回」一处真实属性标记，实际 ' + marks + ' 处');
  assert.match(chrome, /label="返回"[^>]*data-canvas-leave-guard="true"/,
    '标记必须落在「返回」按钮上');
  /* 被点名会误伤的按钮：必须都没有该标记。
     注意按**单个按钮标签内**判定（用 [^\n<>]* 限定在同一行/同一标签内），
     否则 [^>]* 会跨行匹配到「返回」那一行的标记，产生假失败。 */
  for (const label of ['新建画布', '导出', '模板广场']) {
    const re = new RegExp(label + '[^\n<>]*data-canvas-leave-guard');
    assert.doesNotMatch(chrome, re, label + ' 不得带离开守卫标记');
  }
});

test('守卫在空画布时提前放行（与「画布非空才拦」语义一致）', () => {
  const block = guardBlock();
  assert.match(block, /if \(!nodesRef\.current\.length\) return;/, '空画布不打扰');
});

test('「返回」仍保留保存询问（不得把当初修的问题改回去）', () => {
  assert.match(chrome, /<IconButton label="返回"[^>]*data-canvas-leave-guard="true"[^>]*onClick=\{onBack\}/,
    '返回按钮必须仍带标记 + 仍有 onClick');
  const start = canvas.indexOf("title: '保存这张画布？'");
  assert.ok(start > 0, '保存询问必须仍然存在');
  const seg = canvas.slice(start, start + 400);
  assert.match(seg, /confirmLabel: '保存'/, '主按钮仍是「保存」');
  assert.match(seg, /cancelLabel: '不保存'/, '次按钮仍是「不保存」');
});

/* 反向断言（2026-09-18 总统筹要求）：即使有人把 LEAVING_SELECTOR 加回来，
   也**不得**用 `.ec-canvas-topbar` 整条顶栏当判据 —— 包括
   `.ec-canvas-topbar [aria-label="返回"]` 这种「以顶栏为前缀」的写法：
   它对「返回」是对的，但一旦有人把前缀写宽（去掉 [aria-label]）就会重新误伤整条顶栏。
   本仓现役实现是给「返回」直接打 data-canvas-leave-guard，不依赖任何容器前缀。 */
test('反向断言：任何选择器都不得以 .ec-canvas-topbar 作为离开入口前缀', () => {
  const m = canvas.match(/LEAVING_SELECTOR\s*=\s*['"]([^'"]*)['"]/);
  if (m) {
    assert.ok(!/\.ec-canvas-topbar/.test(m[1]),
      'LEAVING_SELECTOR 不得包含 .ec-canvas-topbar（哪怕后面跟 [aria-label]）');
  }
  assert.doesNotMatch(canvas, /\.ec-canvas-topbar\s+\[aria-label/, '不得用顶栏前缀写法，请用 data-canvas-leave-guard');
});

test('功能断言：画布有节点时点新建画布 → 开画布库且不弹守卫（源码级）', () => {
  const start = canvas.indexOf('const handleNew = useCallback');
  assert.ok(start > 0, '必须能找到 handleNew');
  assert.match(canvas.slice(start, start + 500), /setCanvasLibraryOpen\(true\)/, 'handleNew 必须打开画布库');
  assert.doesNotMatch(chrome, /新建画布[^\n<>]*data-canvas-leave-guard/, '新建画布不得带离开守卫标记');
});
