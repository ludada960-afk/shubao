// test/canvas-user-report-1003.test.mjs
// 门禁：2026-10-03 第三批用户截图批注（四条，全部是"上一批改了但没改对"）。
//
//   ① 「下载视频点击之后依然是保存画布，这个功能难道不该叫导出吗」
//   ② 「智能擦除现在点击也是完全没反应啊」
//   ③ 「整个上传视频上来依然是没有在画布中心打开，依然视频有点偏下啊」
//   ④ 「这个按钮为什么还是这种暗的样式…我说的暗下去，指的是不该在前台展示啊」
//
// 这四条有个共同点：**上一批的"修"本身有缺陷**，所以必须把**修法**钉住，
// 而不是再钉一次"结果应该是什么"。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCanvasAction, stableActionsForSurface } from '../src/pages/EcCanvas/canvasActionRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INDEX = read('src/pages/EcCanvas/index.jsx');
const STUDIO = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const SIDEBAR_CSS = read('src/styles/app-sidebar.css');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/* ───────── ① 导出视频必须真的"下载"，且不许把当前页导航走 ───────── */
test('① 导出视频不许再用 <a download>：跨域会被浏览器忽略 download 而直接导航', () => {
  /* ⚠️ 先剥注释 —— 说明"原来错在哪"的那段话里就写着 `<a href download>`，
     不剥的话这条门禁会被自己的注释炸掉（这个坑今天已经踩第三次）。 */
  const code = stripComments(INDEX);
  const at = code.indexOf("if (handler === 'export-video')");
  assert.ok(at > 0, '必须找得到 export-video 的处理分支');
  const block = code.slice(at, at + 2400);
  /* 用户原话：「下载视频点击之后**依然是保存画布**」——
     那不是下载失败，是它把整页导航走了，于是触发了画布的离开守卫。 */
  assert.match(block, /await fetch\(url\)/,
    '必须先 fetch 成 blob —— object URL 是同源的，download 才生效，且不发生导航');
  assert.match(block, /URL\.createObjectURL\(blob\)/);
  assert.match(block, /link\.download = filename/);
  /* 关键判据：`link.href` 必须是 **object URL**，绝不是素材那个跨域地址。
     （新实现里 `link.href = href` 这行照样有 —— href 已经是 blob URL 了。） */
  assert.match(block, /const href = URL\.createObjectURL\(blob\)/);
  assert.doesNotMatch(block, /link\.href = url\b/,
    '绝不许把素材地址直接塞给 <a download>：跨域时浏览器忽略 download，直接导航走');
  assert.match(block, /window\.open\(url, '_blank', 'noopener'\)/,
    '拉不到时的兜底必须开**新标签**—— window.open 不卸载当前页，同样不会碰离开守卫');
  assert.doesNotMatch(block, /window\.location\s*=/, '任何情况下都不许改当前页地址');

  /* 文案对齐：图片侧叫「导出图片」，视频侧也该叫导出 */
  const action = getCanvasAction('export-video');
  assert.equal(action.label, '导出视频', '用户原话：「这个功能难道不该叫导出吗」');
  assert.equal(getCanvasAction('download').label, '导出图片', '两侧统一叫导出');
});

/* ───────── ② 工具栏按钮不许引用作用域外的变量 ───────── */
test('② 工具栏 onClick 里引用的变量必须在作用域内（否则每一次点击都抛 ReferenceError）', () => {
  /* 用户原话：「智能擦除现在点击也是完全没反应啊」——
     真因是 CanvasStudio 的按钮 onClick 里写了 `onAction?.(action, node, event)`，
     而那个 `event` 只存在于**相邻的 onPointerDown** 的参数里，onClick 闭包里根本没有它
     ⇒ 每次点工具栏按钮都抛 ReferenceError ⇒ 「完全没反应」。
     教训：这一条要按**语法**守（引用必须在 handler 自己的参数/闭包里），
     光断言"点了有反应"是测不出来的。 */
  const button = STUDIO.slice(STUDIO.indexOf('onClick={'), STUDIO.indexOf('onClick={') + 200);
  const param = /onClick=\{\(?\s*([A-Za-z_$][\w$]*)?\s*\)?\s*=>/.exec(button);
  assert.ok(param, 'onClick 必须显式声明自己的事件参数');
  const name = param[1];
  if (name) {
    assert.ok(button.includes(name),
      `onClick 内部引用了 ${name}，它必须来自 onClick 自己的参数`);
  }
  assert.doesNotMatch(button, /onAction\?\.\(action, node, event\)/,
    '`event` 不在 onClick 的作用域里 —— 这正是"点了完全没反应"的原因');
  /* 下拉要锚在这颗按钮上，所以事件必须真的传出去 */
  assert.match(INDEX, /setSubtitleModeAnchor\(\{ nodeId: node\.id, triggerEl: event\?\.currentTarget \|\| null \}\)/);
});

/* ───────── ③ 上传视频必须按**真实尺寸**居中 ───────── */
test('③ 上传视频的落位必须用探到的真实尺寸，不能退回 16/9（那正是"偏下"的原因）', () => {
  const code = stripComments(INDEX);
  /* 锚在**唯一**那处调用上（占位节点那条路也调 importCanvasMediaAssets，
     但角色参数不同 —— 用 'reference-video' + 后面紧跟的那次调用定位） */
  const at = code.indexOf("importCanvasMediaAssets(assets, projectContext, 'reference-video')");
  assert.ok(at > 0, '必须找得到画布上传视频那处入库调用');
  const block = code.slice(at, at + 3000);
  /* 用户原话：「依然是没有在画布中心打开，依然视频有点偏下啊」
     真因：本地探到的 videoWidth/videoHeight 经过 importCanvasMediaAssets 之后可能丢失，
     落位于是按 fallback 16/9（高 180）去算中心；视频解码后按真实 9:16 涨到 569，
     整张卡片就吊在中心线以下 —— 误差是几百像素，不是上一批修的 footer 那 46。 */
  assert.match(block, /const importedAssets = imported\.assets\.map/,
    '必须把探到的尺寸贴回入库后的素材');
  assert.match(block, /const width = Number\(asset\?\.width\) \|\| Number\(probe\?\.width\) \|\| 0/);
  assert.match(block, /const height = Number\(asset\?\.height\) \|\| Number\(probe\?\.height\) \|\| 0/);
  assert.match(block, /aspectRatio: asset\?\.aspectRatio \|\| \(width > 0 && height > 0 \? width \/ height : ''\)/,
    '落位用的比例必须来自真实尺寸');
  assert.match(block, /canvasUploadFootprintSizes\(importedAssets/,
    '排位必须用贴回尺寸后的那份素材');
  assert.match(block, /createUploadedVideoNodes\(\{ assets: importedAssets/);
  /* 兜底也不许落回经验锚点 */
  assert.match(block, /\}\) \|\| centreOfCanvasStage\(/,
    '搜索失败时的兜底必须是真居中，不是 0.35×高度那个经验位置');
  assert.doesNotMatch(code.slice(at, at + 3600), /baseY/,
    '0.35×高度那个经验锚点必须彻底移除（它就是用户看到的"偏下"）');
});

/* ───────── ④ 弹窗打开时任务按钮要**隐藏**，不是压暗 ───────── */
test('④ 画布左下角那颗任务按钮必须隐藏（用户第三次说清：不是压暗，是不在前台展示）', () => {
  const css = SIDEBAR_CSS;
  const rule = /html\[data-cvl-dialog-open\][^{]*\.task-sidebar[^{]*\{[^}]*\}/.exec(css);
  assert.ok(rule, '必须有针对 .task-sidebar 的规则');
  assert.match(rule[0], /display:\s*none/,
    '必须是 display:none —— 画布 HUD 那一档用的就是它（EcCanvas.css 的 is-dialog-open 名单）');
  assert.doesNotMatch(rule[0], /opacity/,
    '不许压暗：压暗后它仍在前台（z-index 4e7 压住遮罩）、仍可点');
  /* 与画布 HUD 保持同一判据 */
  const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
  const hud = canvasCss.match(/\.ec-canvas-page\.is-dialog-open[^{]*\{[^}]*\}/)?.[0] || '';
  assert.match(hud, /display:\s*none\s*!important/, '画布 HUD 仍然是 display:none');
  assert.match(hud, /\.ec-canvas-minimap/, '小地图在隐藏名单里（用户：「其他的…隐藏起来」）');
  assert.match(hud, /\.ec-canvas-zoom-controls/, '左下缩放条也在隐藏名单里');
});

/* ───────── ⑤ 顺序：视频工具栏按规划排 ───────── */
test('⑤ 视频工具栏顺序仍是规划出来的（新增导出改名后不许回退）', () => {
  const video = { id: 'v', kind: 'video', status: 'ready', url: '/v.mp4' };
  const ids = stableActionsForSurface({ surface: 'selection', node: video }).map(a => a.id);
  assert.equal(ids[0], 'smart-subtitle-erase', 'AI 处理档在前');
  assert.equal(ids.at(-1), 'save-to-assets', '收纳档（加入资产库）在最后 —— 不许再回到第一位');
  assert.ok(stripComments(INDEX).includes('centreOfCanvasStage'));
});