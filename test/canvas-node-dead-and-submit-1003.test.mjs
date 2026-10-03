// test/canvas-node-dead-and-submit-1003.test.mjs
// 门禁：画布节点**不许变成事件黑洞**；提交按钮**不许永远灰着**（2026-10-03）。
//
// 两条都是用户报的 P0，都是"看起来像功能坏了、实际是接线断了"：
//
//   ① 「我刚刚只是点击了一下其他的弹窗操作…这个节点它会自己死掉，连右边的派生栏都不会出现了」
//      而且「一开始把视频上传进来的时候功能都还算正常」。
//      —— `<video controls>` + `onPointerDown={e => e.stopPropagation()}`：
//         原生控件条把整块视频变成事件黑洞，而那句 stopPropagation 又把
//         非控件区域的手势也拦在节点外面 ⇒ 视频节点**永远选不中**。
//         「刚上传完正常」是因为那会儿还没走到这个分支。
//
//   ② 「你这里为什么提交按钮没有办法点击呢？」
//      —— 两档产品**不在同一个列表**里：框选那档在本机 products，
//         自动那档是云端产品、可能还没 public，被过滤掉 ⇒ 查不到 ⇒ 按钮永远灰，
//         而且没有任何解释。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUBTITLE_ERASE_MODES } from '../src/pages/EcCanvas/canvasActionRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INDEX = read('src/pages/EcCanvas/index.jsx');
const STUDIO = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('① 节点里的 <video> 不许吞手势：画布节点是"被选中/拖动"的对象，不是播放器', () => {
  const code = stripComments(STUDIO);
  const at = code.indexOf('ec-canvas-video-frame');
  assert.ok(at > 0, '必须找得到视频节点那一支');
  const block = code.slice(at, at + 900);
  const video = block.match(/<video[\s\S]*?>/)?.[0] || '';
  assert.ok(video, '要能截到 <video> 标签本身');

  /* ① 控件条 = 事件黑洞。播放交给那颗独立的「预览」动作（放大灯箱，自带 controls）。 */
  assert.doesNotMatch(video, /\bcontrols\b/,
    '节点里的视频不许带原生 controls —— 控件条会把整块视频变成点不动的黑洞');
  /* ② 更致命的是这句：它连非控件区域的 pointerdown 都拦在节点外面 */
  assert.doesNotMatch(video, /onPointerDown=\{[^}]*stopPropagation/,
    '节点里的视频不许 stopPropagation —— 否则事件永远到不了节点，选中/拖动/删除全部失效');
  /* ③ 键盘序列里也不该塞一段视频 */
  assert.match(video, /tabIndex=\{-1\}/, '视频不该进 Tab 序列（键盘用户会被一段视频截住）');
  assert.match(video, /muted\b/, '悬停预览必须静音 —— 不能突然出声');
  assert.match(video, /preload="metadata"/, '仍只预载元数据，不预下整段视频');
});

test('② 节点不能被"播放中"卡住：悬停预览结束要停', () => {
  const code = stripComments(STUDIO);
  const at = code.indexOf('ec-canvas-video-frame');
  const block = code.slice(at, at + 400);
  assert.match(block, /onPointerEnter=\{playOnHover\}/, '悬停预览（知渔那套 affordance）保留');
  assert.match(block, /onPointerLeave=\{pauseOnLeave\}/, '移开必须暂停');
});

test('③ 两档产品解析必须各走各的来源，不许只查一个列表', () => {
  const code = stripComments(INDEX);
  assert.match(code, /function resolveEraseProduct\(/,
    '必须有一个统一的产品解析入口');
  const fn = code.slice(code.indexOf('function resolveEraseProduct('), code.indexOf('const runVideoDesubtitle'));
  /* 自动那档走服务端 capabilities（它自带 productId / sku / available / reason） */
  assert.match(fn, /autoCapability\.quotes\?\.short\?\.sku/,
    '自动那档必须用服务端 capabilities 给的 sku —— 那个云端产品可能还没 public，'
    + '在 products 列表里会被过滤掉 ⇒ 查不到 ⇒ 提交按钮永远是灰的');
  /* 框选那档走本机产品列表 */
  assert.match(fn, /localProducts[\s\S]{0,80}products[\s\S]{0,120}item\?\.id === mode\.productId/);
  /* 拿不到时必须给人话原因，而不是一只不会亮的按钮 */
  assert.match(code, /subtitleAutoCapability\?\.reason \|\| '自动擦除暂时不可用'/);
  assert.doesNotMatch(fn, /\{ ok: false, reason: '该擦除方式暂不可用[^']*'\}[^}]*return;?\s*\}\s*,?/,
    '不许只有一句笼统的"暂不可用"');
});

test('④ 两档的产品**本来就不在同一个列表**里 —— 这条要写下来，别再改回去', () => {
  const [auto, box] = SUBTITLE_ERASE_MODES;
  assert.equal(auto.productId, 'desubtitle_volc', '自动那档是云端（火山 MediaKit）');
  assert.equal(box.productId, 'desubtitle_local', '框选那档是本机 ffmpeg');
  /* 本机那档一定在 localProducts；云端那档在不在 public 列表里由服务端决定 */
  const INDEX2 = stripComments(INDEX);
  assert.match(INDEX2, /localProducts: videoLocalProducts/);
  assert.match(INDEX2, /autoCapability: subtitleAutoCapability/);
});

test('⑤ 提交按钮禁用时必须说明原因，不许"一只不会亮的按钮"', () => {
  const code = stripComments(INDEX);
  /* ⚠️ 别用「往后数 N 个字符」来截这条操作条：2026-10-04 框选档往里加了
     放大/撤销/重做/重置/删除五颗按钮，那颗提交按钮被推到了固定窗口之外，
     于是这条门禁**误报**成"禁用条件没了"。截到下一个独立组件（SkillLibraryModal）为止 ——
     边界是代码结构，不是字符数，长短都不会漂。 */
  const bar = code.slice(code.indexOf('ec-canvas-erase-bar'), code.indexOf('<SkillLibraryModal'));
  assert.match(bar, /disabled=\{[^}]*product/, '无产品时禁用（这是对的）');
  assert.match(code, /该擦除方式暂不可用|自动擦除暂时不可用/,
    '必须有对应的提示文案 —— 用户原话：「这又是为什么呢？」');
});