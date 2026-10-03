// test/canvas-video-toolbar-icons-1002.test.mjs
// 门禁：**工具栏上的每个按钮都必须有自己的图标，且同屏不得重样**（2026-10-02）。
//
// 起因是用户批注（框选指着视频节点那条工具栏）：
//   「你知道你在胡说什么吗，现在线上视频功能栏是这几个啊，明显对不上好吗」
//
// 真相：视频节点的 selection 工具栏是 4 颗 —— 加入资产库 / 智能去字幕 / 预览 / 下载视频，
// 但后三个在 `CanvasStudio` 的 ACTION_ICONS 里**没有条目**，渲染走
//   `const Icon = ACTION_ICONS[action.id] || WandSparkles;`
// ⇒ **三颗全部显示成同一个魔法棒**。用户看到的是「书签 + 三颗一模一样的魔棒」，
//   根本对不上是哪三个功能。
//
// 这类"漏配就静默兜底"的写法正是本门禁要堵的：兜底可以留（免得崩），
// 但**同屏重样不行**，而且新增动作必须显式配图标。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stableActionsForSurface } from '../src/pages/EcCanvas/canvasActionRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUDIO = fs.readFileSync(path.join(ROOT, 'src/pages/EcCanvas/components/CanvasStudio.jsx'), 'utf8');

/** 从 CanvasStudio 源码里解析出 ACTION_ICONS 的 id → 图标 映射。 */
function readActionIcons() {
  const start = STUDIO.indexOf('const ACTION_ICONS = {');
  assert.ok(start > 0, '必须仍能找到 CanvasStudio 的 ACTION_ICONS');
  const body = STUDIO.slice(start, STUDIO.indexOf('\n};', start));
  const map = new Map();
  for (const line of body.split('\n')) {
    const m = /^\s*(?:'([^']+)'|([A-Za-z_$][\w$]*)):\s*([A-Za-z_$][\w$]*)\s*,?\s*$/.exec(line);
    if (m) map.set(m[1] || m[2], m[3]);
  }
  return map;
}

const VIDEO = { id: 'v1', kind: 'video', status: 'ready', url: '/v.mp4' };
const IMAGE = { id: 'i1', kind: 'output', status: 'ready', url: '/a.png' };

test('① 视频工具栏上每个动作都必须配了自己的图标', () => {
  const icons = readActionIcons();
  const actions = stableActionsForSurface({ surface: 'selection', node: VIDEO });
  assert.deepEqual(
    actions.map(a => a.id),
    ['save-to-assets', 'smart-subtitle-erase', 'preview-media', 'export-video'],
    '视频节点的 selection 工具栏应当就是这 4 项（与用户截图一致）',
  );
  actions.forEach(action => {
    assert.ok(icons.has(action.id),
      `「${action.label}」(${action.id}) 在 ACTION_ICONS 里没有条目 —— 会掉进 WandSparkles 兜底，`
      + '于是同屏出现几颗一模一样的魔法棒');
  });
});

test('② 同屏任意两颗按钮不得用同一个图标（三个魔棒就是这么来的）', () => {
  const icons = readActionIcons();
  for (const node of [VIDEO, IMAGE]) {
    const actions = stableActionsForSurface({ surface: 'selection', node });
    const seen = new Map();
    actions.forEach(action => {
      const icon = icons.get(action.id) || 'WandSparkles(兜底)';
      assert.equal(seen.has(icon), false,
        `${node.kind} 工具栏上「${seen.get(icon)}」与「${action.label}」用了同一个图标 ${icon} —— 用户分不清哪个是哪个`);
      seen.set(icon, action.label);
    });
  }
});

test('③ 兜底只允许在"确实没配"时发生，不许成为常态', () => {
  /* 兜底本身保留（免得新增动作时整页崩），但 selection / video-toolbar
     这两个用户天天看的面上，一个都不许落到兜底。 */
  const icons = readActionIcons();
  const fallback = STUDIO.includes('|| WandSparkles') ? 'WandSparkles' : null;
  assert.ok(fallback, '渲染仍应有兜底（新增动作不至于白屏）');
  ['selection', 'video-toolbar'].forEach(surface => {
    [VIDEO, IMAGE].forEach(node => {
      stableActionsForSurface({ surface, node }).forEach(action => {
        assert.notEqual(icons.get(action.id), undefined,
          `${surface}/${node.kind} 上的「${action.label}」落到了兜底图标`);
      });
    });
  });
});

test('④ 视频这一组要带文字：4 颗纯图标本来就分不清', () => {
  /* 先按标记切出这段，再剥注释 —— 顺序反了的话，用原文的下标去切"剥完注释"的串，
     会因为前面少了几千字符而切过头（踩过）。 */
  const block = STUDIO
    .slice(STUDIO.indexOf('const LABELED_TOOLBAR_ACTIONS'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const setBody = block.slice(block.indexOf('new Set(['), block.indexOf(']);'));
  const labeledIds = [...setBody.matchAll(/'([^']+)'/g)].map(m => m[1]);

  ['smart-subtitle-erase', 'preview-media', 'export-video'].forEach(id => {
    assert.ok(labeledIds.includes(id),
      `${id} 必须进 LABELED_TOOLBAR_ACTIONS（带文字），否则又是一排认不出的图标`);
  });
  /* 加入资产库保持纯图标：它两侧都有、已经能认出来，不必占宽度。 */
  assert.ok(!labeledIds.includes('save-to-assets'),
    '加入资产库刻意保持纯图标，不要跟着一起变成带文字');
});

test('⑤ 同一份动作表不许出现两份（历史上 index.jsx 与 CanvasStudio 各有一份 ACTION_ICONS）', () => {
  const INDEX = fs.readFileSync(path.join(ROOT, 'src/pages/EcCanvas/index.jsx'), 'utf8');
  assert.equal(INDEX.includes('const ACTION_ICONS = {'), false,
    'index.jsx 不许再自带一份 ACTION_ICONS —— 两份表必然有一份漏配（这次就是漏在另一份上）');
  /* 反过来也钉一下：真的要用图标时必须从那一份取，不是自己再抄一份。 */
  assert.match(INDEX, /ACTION_ICONS as CANVAS_ACTION_ICONS/);
  assert.match(STUDIO, /export const ACTION_ICONS = \{/, '唯一那一份必须导出给复用方');
});