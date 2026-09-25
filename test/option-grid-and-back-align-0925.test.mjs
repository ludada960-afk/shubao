/* ═══ 门禁：选项药丸等宽 + 子页面「返回」与工作台左沿对齐（2026-09-25 批 BS）════════════════
   用户两条批注（逐字）：
   ①「你总是把这些按钮给收起来……**上面搞这么多个按钮，下面却只有三个按钮，就导致下面的三个按钮
      变得很宽**，我觉得你是不是**每个按钮的宽度应该是固定的**才对呀？……**所有子页面的工作台
      都要把这个问题给解决掉**。」
   ②「你这个**返回按钮为什么做的这么左呢**？你是不是应该**跟工作台的最左边做一个对齐**呢？」

   实测（1440 视口，概念视觉方案子页面）：
     改前 ①：手法组 90/90/90/90/155/155/59（差 96px）；比例组最后一颗**独占整行 386**；
     改后 ①：三组全部 **189px，差 0px**。
     改前 ②：返回 x=90 vs 工作台 x=120（差 −30px）；改后 **120 vs 120，差 0**。

   这一组断言守的是**机制**（不是像素数值 —— 数值随视口变，机制不该变）：
     ① 选项组必须用 `grid` + `repeat(auto-fill, …)`：用 auto-fit 会让空轨道塌缩 = 白改；
     ② 子项不许再有 `flex: 1 1 auto`（那正是"每行各自吃光剩余空间"的根因）；
     ③ 子页面那一格（lead）的负 margin 补偿必须撤掉（它会把「返回」一起拖走）；
     ④ 品牌标必须**脱离文档流**钉在左导航那一列（这样"LOGO 跟左导航对齐"与"返回跟工作台对齐"
        两个诉求才能同时成立），且选择器**不许**写成已不存在的 `is-compact-mark`；
     ⑤ 自证：把 auto-fill 换成 auto-fit（或把 flex 加回去）必须被判红。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync(new URL('../src/components/media/WorkbenchShell.css', import.meta.url), 'utf8');
const appShell = readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');

test('① 选项药丸组用 grid + auto-fill（等宽、末行不被撑宽）', () => {
  const block = shell.match(/\.media-field-segmented\s*\{[^}]*\}/);
  assert.ok(block, '找不到 .media-field-segmented 容器规则');
  assert.match(block[0], /display:\s*grid/, '选项组必须用 grid（flex 会让每行各自吃光剩余空间）');
  assert.match(block[0], /repeat\(auto-fill,/, '必须用 auto-fill：auto-fit 会把空轨道塌缩、把末行的项再拉宽');
  assert.doesNotMatch(block[0], /auto-fit/, '不许用 auto-fit（等于没改）');
});

test('② 子项不许再有 flex 伸缩（那正是"行与行宽度不同"的根因）', () => {
  const btn = shell.match(/\.media-field-segmented button\s*\{[^}]*\}/);
  assert.ok(btn, '找不到 .media-field-segmented button 规则');
  assert.doesNotMatch(btn[0], /flex:\s*1\s+1\s+auto/, '还在用 flex:1 1 auto —— 会被行宽拉成不一样宽');
});

test('③ 子页面那一格的负 margin 补偿必须撤掉（否则「返回」被一起拖走）', () => {
  const lead = appShell.match(/\.topbar-subpage-lead\s*\{[^}]*\}/);
  assert.ok(lead, '找不到 .topbar-subpage-lead');
  assert.doesNotMatch(lead[0], /margin-left:\s*calc\(-1 \*/, '负补偿还在 —— 「返回」会被拖到内容列左边');
  assert.match(lead[0], /margin-left:\s*0/);
});

test('④ 品牌标脱离文档流钉在左导航那一列（两个诉求才能同时成立）', () => {
  /* ⚠️ 选择器里**不许**出现 is-compact-mark —— 那个类已经不在子页面这一格上了（实测 DOM 是纯 topbar-brand） */
  const rule = appShell.match(/\.topbar-row\.is-subpage[^{]*\.topbar-brand[^{]*\{[^}]*\}/);
  assert.ok(rule, '找不到"子页面品牌标"的定位规则');
  assert.doesNotMatch(rule[0].split('{')[0], /is-compact-mark/,
    '选择器用了已不存在的 is-compact-mark —— 实测那条规则根本不命中（本批踩过）');
  assert.match(rule[0], /position:\s*absolute/, '品牌标必须脱离文档流，否则会把「返回」顶到右边');
  assert.match(rule[0], /var\(--sb-app-sidebar-w[^)]*\)\s*\/\s*2/,
    '标的中线要按左导航那一列的宽度算（写死数值会在侧栏变宽时偏掉）');
});

test('⑤ 自证：auto-fill 改回 auto-fit 必须被判红', () => {
  /* 直接在**被测的那段规则**上做替换，而不是拿整份文件 replace（第一处匹配可能在别的规则里，
     那样替换不生效、自证就变成空转 —— 本批实测踩过一次）。 */
  const block = shell.match(/\.media-field-segmented\s*\{[^}]*\}/)[0];
  const broken = block.replace('auto-fill', 'auto-fit');
  assert.notEqual(broken, block, '替换没生效，这条自证无效');
  let caught = false;
  try { assert.doesNotMatch(broken, /auto-fit/); } catch { caught = true; }
  assert.equal(caught, true, '换成 auto-fit 没被判红 ⇒ ① 那条是空转');
});
