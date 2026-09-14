// test/canvas-leave-save-guard-0918.test.mjs
// 2026-09-18 用户批注（离开画布保存询问：逻辑 + 文案双错）
//
// 用户原话：
//   「我刚刚是点击画布上面的那个模板广场，你为什么就会提出来这个是否保存这张画布呢？
//    应该是我离开这张画布的时候，你才要问我这个问题呀。我打开模板广场它不是一个弹窗吗？
//    你为什么也要问我这个问题呢？你现在到底有没有把逻辑搞明白啊？
//    而且你这个询问其实也不对呀：你下面应该给的两个选项应该是不保存和保存吧？取消又是什么
//    意思呢？取消在你现在逻辑里面是不保存的意思吗？你很容易让用户误解为点击取消的意思是
//    取消这个选项呀。」
//
// 两条契约：
//   A) 触发时机 = **真正的导航**，不是任何弹窗。
//      旧病根：判据是「点击目标命中一个选择器」，而选择器含 .ec-canvas-topbar ——
//      模板广场/画布库/导出 这些**弹窗按钮全在顶栏里**，于是被误判成离开画布（反复复发）。
//      新判据：<a href> 指向非 /ec-canvas，或元素带 data-canvas-leave-guard。
//   B) 文案只有两个明确选项：左「不保存」/ 右「保存」；无「取消」、无右上角 X；
//      点遮罩 / 按 ESC = 留在画布继续编辑（什么都不发生）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvas = read('src/pages/EcCanvas/index.jsx');
const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');
const dialogProvider = read('src/components/ui/DialogProvider.jsx');

/* 取出离开守卫那一段（从触发判据注释到事件注册） */
function guardBlock() {
  const start = canvas.indexOf('const CANVAS_PATHNAME');
  assert.ok(start > 0, '必须能找到离开守卫的判据实现');
  const end = canvas.indexOf("document.addEventListener('click', handleCapture, true)", start);
  assert.ok(end > start, '必须能找到守卫的事件注册');
  return canvas.slice(start, end);
}

/* ── A：触发判据 ───────────────────────────────────────────────────── */

test('离开判据必须是「真导航」：不再用选择器命中当判据', () => {
  const block = guardBlock();
  assert.match(block, /const isLeavingNavigation = target =>/, '必须有显式的导航判据函数');
  assert.match(block, /if \(!isLeavingNavigation\(target\)\) return;/, '非导航一律放行（弹窗因此天然不触发）');
  /* 旧病根：这些选择器不得再作为判据出现 */
  assert.doesNotMatch(block, /LEAVING_SELECTOR/,
    '不得再用 LEAVING_SELECTOR 这种「命中即离开」的判据 —— 顶栏里的弹窗按钮会被误判');
  assert.doesNotMatch(block, /\.ec-canvas-topbar/,
    '判据里不得再出现 .ec-canvas-topbar（模板广场/画布库/导出 都在里面）');
});

test('判据只认两类目标：<a href> 指向非画布路径，或显式 data-canvas-leave-guard', () => {
  const block = guardBlock();
  assert.match(block, /target\.closest\('\[data-canvas-leave-guard\]'\)/, '必须支持显式标记');
  assert.match(block, /target\.closest\('a\[href\]'\)/, '必须识别链接导航');
  assert.match(block, /path !== CANVAS_PATHNAME/, '必须比对目标路径是否真的不是画布页');
  assert.match(block, /const CANVAS_PATHNAME = '\/ec-canvas'/, '画布路径常量');
});

test('锚点/空链接/javascript: 不算离开（同页不算导航）', () => {
  const block = guardBlock();
  assert.match(block, /href\.startsWith\('#'\)/, '锚点不算离开');
  assert.match(block, /href\.startsWith\('javascript:'\)/, 'javascript: 不算离开');
  assert.match(block, /if \(!href \|\| href\.startsWith/, '空 href 不算离开');
});

test('画布「返回」按钮显式标注 data-canvas-leave-guard（唯一被认的离开入口）', () => {
  assert.match(chrome, /data-canvas-leave-guard="true"/, '返回按钮必须带该标记');
  assert.match(chrome, /label="返回"/, '且确实是「返回」按钮');
  /* IconButton 必须透传 rest props，否则 data-* 落不到 DOM 上 */
  assert.match(chrome, /\.\.\.rest \}/, 'IconButton 必须透传 ...rest，否则 data-canvas-leave-guard 不会渲染');
});

test('「返回」按钮之外，顶栏弹窗按钮一个都不带该标记', () => {
  /* 只数**真实 JSX 属性**（= 'true' 或 ={true}），注释里提到属性名不算。
     模板广场/画布库/导出/资产库 都在顶栏里，一旦给它们加了标记，
     打开弹窗就会被当成离开画布 —— 正是本次复发的病根。 */
  const marks = (chrome.match(/data-canvas-leave-guard=(?:"true"|\{true\})/g) || []).length;
  assert.equal(marks, 1, '只允许「返回」一处**真实属性**标记，实际 ' + marks + ' 处');
});

/* ── B：文案 ───────────────────────────────────────────────────────── */

test('询问只有两个明确选项：不保存 / 保存（没有「取消」）', () => {
  const block = guardBlock();
  const confirmStart = canvas.indexOf("title: '保存这张画布？'");
  assert.ok(confirmStart > 0, '必须有这个询问');
  const seg = canvas.slice(confirmStart, confirmStart + 420);
  assert.match(seg, /confirmLabel: '保存'/, '主按钮文案必须是「保存」');
  assert.match(seg, /cancelLabel: '不保存'/, '次按钮文案必须是「不保存」');
  assert.doesNotMatch(seg, /取消/, '不得再出现「取消」（用户会理解成取消这次操作）');
  assert.doesNotMatch(seg, /保存到画布库/, '不得再用「保存到画布库」这种内部说法当按钮文案');
});

test('说明文案一句结果导向，不含「不占用空间」这类内部话术', () => {
  const confirmStart = canvas.indexOf("title: '保存这张画布？'");
  const seg = canvas.slice(confirmStart, confirmStart + 420);
  assert.match(seg, /message: '保存后可以在「我的画布」里继续编辑。'/, '说明必须是一句结果导向的话');
  assert.doesNotMatch(seg, /不占用空间/, '不得写「不占用空间」这类解释性内部话术');
});

test('该询问不显示右上角 X（hideClose）', () => {
  const confirmStart = canvas.indexOf("title: '保存这张画布？'");
  const seg = canvas.slice(confirmStart, confirmStart + 420);
  assert.match(seg, /hideClose: true/, '必须隐藏 X（它和「不保存」语义冲突）');
});

test('点遮罩 / 按 ESC = 留在画布继续编辑（dismissBackdrop: false）', () => {
  const confirmStart = canvas.indexOf("title: '保存这张画布？'");
  const seg = canvas.slice(confirmStart, confirmStart + 420);
  assert.match(seg, /dismissBackdrop: false/, '必须关掉「点遮罩/ESC 即关闭」的默认行为');
  /* DialogProvider 侧必须真的支持这两个开关 */
  assert.match(dialogProvider, /dialog\.dismissBackdrop === false/, 'provider 必须尊重 dismissBackdrop');
  assert.match(dialogProvider, /dialog\.hideClose !== true/, 'provider 必须尊重 hideClose');
  assert.match(dialogProvider, /dialog\.cancelLabel \|\| '取消'/, 'provider 必须支持 cancelLabel（缺省仍是「取消」）');
});

test('DialogProvider 的扩展是**可选**的，默认行为不变（其它调用点零回归）', () => {
  /* 缺省值必须与改造前一致：confirmLabel 默认「确认」、cancelLabel 默认「取消」、X 默认显示 */
  assert.match(dialogProvider, /confirmLabel: options\?\.confirmLabel \|\| '确认'/, 'confirmLabel 缺省仍是「确认」');
  assert.match(dialogProvider, /cancelLabel: options\?\.cancelLabel \|\| '取消'/, 'cancelLabel 缺省仍是「取消」');
  /* 只有显式 hideClose:true 才隐藏 */
  assert.match(dialogProvider, /dialog\.hideClose !== true/, '只有显式声明才隐藏 X');
});

/* ── 既有契约不许破坏 ─────────────────────────────────────────────── */

test('保存 / 不保存的行为与既有规则一致（保存→落盘；不保存→丢弃）', () => {
  const block = guardBlock();
  assert.match(block, /if \(save\) \{[\s\S]*?handleCanvasSessionSaveRef\.current\?\.\(\)/, '选保存 → 走既有保存流程');
  assert.match(block, /deleteCanvas\(canvasSessionRef\.current\.id\)/, '选不保存 → 丢弃（复用画布库删除接口）');
});

test('来自画布库的画布离开时静默保存、不打扰（既有规则①不变）', () => {
  const block = guardBlock();
  assert.match(block, /if \(openedFromLibraryRef\.current\)/, '必须保留「来自画布库」分支');
  assert.match(block, /void handleCanvasSessionSaveRef\.current\?\.\(\)\.catch/, '且是静默保存');
});

test('空画布不打扰（既有规则不变）', () => {
  const block = guardBlock();
  assert.match(block, /if \(!nodesRef\.current\.length\) return;/, '空画布直接放行');
});

test('beforeunload（关标签页/刷新）仍然守住（既有规则不变）', () => {
  assert.match(canvas, /window\.addEventListener\('beforeunload', handleBeforeUnload\)/, '必须保留 beforeunload 守卫');
  const start = canvas.indexOf('const handleBeforeUnload = event =>');
  const seg = canvas.slice(start, start + 700);
  assert.match(seg, /event\.preventDefault\(\)/, '有内容时阻止直接关闭');
  assert.match(seg, /event\.returnValue = ''/, '并给浏览器原生确认');
});
