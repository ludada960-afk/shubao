// test/canvas-node-hit-testing-1003.test.mjs
// 门禁：**画布上的东西不许挡住节点**（2026-10-03 线上实测定位到的三个真病根）。
//
// 用户原话：
//   · 「一旦我去点击其他的东西之后，这个节点它会自己死掉。
//      连右边的派生栏都不会出现了」—— 而且拖不动、Delete 删不掉。
//   · 「画布里面我只要点击任何弹窗的功能的时候，左边这个生成进度的这个按钮，
//      它就会一起弹出来」
//   · 「正常情况下是不是这个视频节点它连左边，右边的两个加号都没有呢？」
//
// 前一版我修的是 `<video controls>` + `stopPropagation`（那确实是个事件黑洞，
// 线上已确认不再复现）。但实测又查出**三处独立的遮挡**，症状与用户描述完全一致。
//
// 三条都写成了「可被线上 DOM 复核」的性质，不是靠注释。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canvasHudHidden } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const DOCK = read('src/components/task/TaskSidebar.jsx');
const SIDEBAR_CSS = read('src/styles/app-sidebar.css');
const CSS = read('src/pages/EcCanvas/EcCanvas.css');
const INDEX = read('src/pages/EcCanvas/index.jsx');

test('① 任务 dock 本体不许吃指针事件 —— 它 4e7 的层级压着左下角那一格', () => {
  /* 线上实测：dock 占 {16,642,46,46}，z-index 40000000，pointer-events:auto。
     节点一旦落到那块区域，elementFromPoint 命中的是 dock 的 path/svg，
     点下去 selected 始终是 false ⇒ 工具栏不出现、右栏不出现、拖不动、Delete 也不动
     （Delete 的前置条件就是 selected || multiSelected.size）。
     这就是「点击别的东西之后节点死掉」的真病根。 */
  const dock = DOCK.slice(DOCK.indexOf("className={inline ? 'app-sidebar-task-host' : 'task-sidebar'}"));
  const style = dock.slice(0, dock.indexOf('}}'));
  assert.match(style, /pointerEvents:\s*'none'/,
    'dock 本体必须 pointer-events:none —— 它压在画布上，不能当命中障碍');
  /* 按钮自己要把事件开回来，否则就变成"看不见也点不到" */
  assert.match(DOCK, /pointerEvents:\s*'auto'/,
    '触发按钮必须显式开回 pointer-events:auto');
});

test('② 弹窗隐藏 dock 的规则必须能压过**行内** display:flex', () => {
  /* 线上实测：规则匹配到了元素、attribute 也被设上了，计算出来仍是 display:flex ——
     因为 TaskSidebar 把 display 写在**行内 style** 上，
     而没有 !important 的作者规则永远赢不过行内样式。
     （画布 HUD 那一档早就写的是 !important，这份漏了。） */
  const rule = SIDEBAR_CSS.match(/html\[data-cvl-dialog-open\][^{]*\.task-sidebar[^{]*\{[^}]*\}/)?.[0] || '';
  assert.ok(rule, '必须有针对 .task-sidebar 的隐藏规则');
  assert.match(rule, /display:\s*none\s*!important/,
    '必须带 !important —— 行内 display:flex 赢不过没有 !important 的作者规则');
});

test('③ 快捷键 / 任务日志 两块全屏遮罩也必须算"弹窗打开"', () => {
  /* 线上实测：点「?」时 data-cvl-dialog-open 是 null，整档 HUD 照常显示 */
  assert.equal(canvasHudHidden({ shortcutHelpOpen: true }), true);
  assert.equal(canvasHudHidden({ taskLogOpen: true }), true);
  assert.equal(canvasHudHidden({}), false);
  assert.match(INDEX, /shortcutHelpOpen,\s*\n\s*taskLogOpen,/,
    'index.jsx 必须把这两个开关接进 canvasHudHidden');
});

test('④ 节点外框不许裁掉自己的派生端口（端口长在卡片外 32px）', () => {
  /* 线上实测：.is-video / .is-text / .is-direction 三个变体是 overflow:hidden，
     而 .ec-canvas-node-port 是 right/left:-32px ⇒ 端口整个被裁掉、点不到。
     用户原话：「这个视频节点它连左边，右边的两个加号都没有呢」。 */
  ['is-video', 'is-text', 'is-direction'].forEach(variant => {
    const rule = CSS.match(new RegExp(`\\.ec-canvas-generation-node\\.${variant} \\{[^}]*\\}`))?.[0] || '';
    assert.ok(rule, `必须找得到 .${variant} 的规则`);
    assert.match(rule, /overflow:\s*visible/,
      `.${variant} 必须是 overflow:visible —— 否则长在卡片外的派生端口会被裁掉`);
    assert.doesNotMatch(rule, /overflow:\s*hidden/);
  });
  /* 端口确实长在卡片外 —— 这就是为什么外层不能 clip */
  assert.match(CSS, /\.ec-canvas-node-port \{[^}]*right:\s*-32px/);
  assert.match(CSS, /\.ec-canvas-node-port\.is-input \{[^}]*left:\s*-32px/);
  /* 图片那一侧没有这个毛病（它只夹内层）—— 钉住"别把图片那侧也改坏" */
  assert.match(CSS, /\.ec-canvas-generation-node\.is-image > div:first-child \{[^}]*overflow:\s*hidden/s);
});

test('⑤ 节点里的 <video> 仍然不许吞手势（前一轮的修复不许回退）', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const at = studio.indexOf('ec-canvas-video-frame');
  const video = studio.slice(at, at + 900).match(/<video[\s\S]*?>/)?.[0] || '';
  assert.doesNotMatch(video, /\bcontrols\b/, '节点里的视频不许带原生 controls');
  assert.doesNotMatch(video, /onPointerDown=\{[^}]*stopPropagation/, '不许 stopPropagation');
});
