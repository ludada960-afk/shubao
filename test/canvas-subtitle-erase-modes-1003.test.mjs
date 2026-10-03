// test/canvas-subtitle-erase-modes-1003.test.mjs
// 门禁：智能去字幕的**两种擦除方式**与操作条（2026-10-03 用户交互稿）。
//
// 用户原话（配三张设计稿）：
//   · 「智能去字幕是这样的啊」—— 工具栏上是「智能去字幕 ▾」，下拉两项
//   · 「智能擦除是这样的」—— 选它 → 节点下方出现操作条：✕ 智能擦除 预计 X 积分 提交
//   · 「框选擦除是这些功能」+「可以在视频里面框选，用于擦除一些视频里面不止是字幕，
//     可能是比如某个元素里面的字这样」—— 框选那档底部是 撤销/重做/重置/删除 + N/上限 + 价格 + 提交
//
// ⚠️ 这**不是新造能力**：服务端 localVideoPlan 早就把两种规格分开了
//   （`spec.auto` 不参与区域非空判定 / `spec.regions` 必须有区域），
//   videoCatalog 也早就有 desubtitle_volc 与 desubtitle_local 两个产品。
//   这一批做的是把前端那个**只有一种**的入口补齐。
//
// 所以本门禁钉的是三条性质：**两档必须各自显式登记**（不许共用一条）、
// **可售状态不许前端自己判**、**框选上限来自唯一声明**。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUBTITLE_ERASE_MODES, getCanvasAction } from '../src/pages/EcCanvas/canvasActionRegistry.js';
import { CANVAS_BILLING_KEYS, getCanvasActionBilling } from '../src/pages/EcCanvas/canvasBillingModel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const INDEX = read('src/pages/EcCanvas/index.jsx');
const PICKER = read('src/components/media/VideoRegionPicker.jsx');
const REGISTRY = read('src/pages/EcCanvas/canvasActionRegistry.js');

test('① 两种擦除方式必须各自声明，且指向两个**不同**的服务端产品', () => {
  assert.deepEqual(SUBTITLE_ERASE_MODES.map(m => m.id), ['auto', 'box']);
  const [auto, box] = SUBTITLE_ERASE_MODES;
  assert.equal(auto.label, '智能擦除');
  assert.equal(box.label, '框选擦除');
  /* 自动那一档走火山 MediaKit，框选那档走本机 ffmpeg —— 两个产品、两条计费 */
  assert.equal(auto.productId, 'desubtitle_volc');
  assert.equal(box.productId, 'desubtitle_local');
  assert.notEqual(auto.productId, box.productId);
  assert.equal(auto.needsRegions, false, '智能擦除没有区域要框（服务端 spec.auto）');
  assert.equal(box.needsRegions, true, '框选擦除必须有区域（服务端 spec.regions）');
  assert.ok(box.maxRegions > 0, '框选上限来自这份声明，不许写死在组件里');
  /* ⚠️ 框选那档的说明要讲清"不止字幕" —— 用户原话：
     「用于擦除一些视频里面不止是字幕，可能是比如某个元素里面的字这样」 */
  assert.match(box.hint, /不止字幕/);
});

test('② 两档的价格必须**各自登记**，不许共用一条（共用 = 看着便宜、扣得贵）', () => {
  const [auto, box] = SUBTITLE_ERASE_MODES;
  assert.notEqual(auto.priceFeature, box.priceFeature,
    '自动（0.05/秒，火山）与框选（0.04/秒，本机）不是同一个价');
  assert.ok(CANVAS_BILLING_KEYS.includes(auto.priceFeature), '自动那一档必须已登记：' + auto.priceFeature);
  assert.ok(CANVAS_BILLING_KEYS.includes(box.priceFeature), '框选那一档必须已登记：' + box.priceFeature);
  /* 与服务端 catalog 逐值一致：units 50 / 1000 = 0.05；units 40 / 1000 = 0.04 */
  const autoBilling = getCanvasActionBilling(auto.priceFeature);
  const boxBilling = getCanvasActionBilling(box.priceFeature);
  assert.equal(autoBilling.perSecond, true);
  assert.equal(boxBilling.perSecond, true);
  assert.equal(autoBilling.unitsPerSecond, 0.05, '火山档 0.05 积分/秒（catalog units 50）');
  assert.equal(boxBilling.unitsPerSecond, 0.04, '本机档 0.04 积分/秒（catalog units 40）');
  assert.ok(autoBilling.skus.some(s => s.includes('volc')), '自动档的 sku 必须是 volc 那一族');
  assert.ok(boxBilling.skus.some(s => s.includes('local')), '框选档的 sku 必须是 local 那一族');
});

test('③ 「智能去字幕」是带下拉的入口，点了展开方式而不是直接开框选器', () => {
  const action = getCanvasAction('smart-subtitle-erase');
  assert.ok(action, '这个动作必须还在注册表里');
  assert.equal(action.label, '智能去字幕');
  assert.equal(action.hasModes, true, '带 ▾ 的按钮要标成 hasModes');
  assert.match(REGISTRY, /SUBTITLE_ERASE_MODES/, '两种方式的声明必须在注册表这一处');
  /* 工具栏那一颗要有 caret */
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(studio, /action\.hasModes/, '工具栏要为带下拉的按钮渲染下拉标记');
  assert.match(studio, /onAction\?\.\(action, node, event\)/,
    '必须把事件传出去 —— 下拉要锚在**这颗按钮**上，不是凭空出现在屏幕中间');
  /* handler 不得再直接开框选器（那会跳过"选哪种方式"这一步） */
  const handler = INDEX.slice(INDEX.indexOf("if (handler === 'smart-subtitle-erase')"));
  assert.match(handler.slice(0, 900), /setSubtitleModeAnchor\(/,
    '点了要先锚定下拉，而不是直接 setSubtitlePickNodeId');
  assert.doesNotMatch(handler.slice(0, 900), /setSubtitlePickNodeId\(node\.id\)\s*;\s*return/,
    '不许再"一点就开框选器"');
});

test('④ 可售状态必须读服务端的，前端不许自己判（第二份真相）', () => {
  /* server/videoGeneration.capabilities().subtitleAuto 给 available/reason：
     凭据没配、或那一档还没跑通一次真片子时就不可选，并写明原因。 */
  assert.match(INDEX, /subtitleAutoCapability/);
  assert.match(INDEX, /setSubtitleAutoCapability\(data\.subtitleAuto\)/);
  assert.match(INDEX, /subtitleAutoCapability\?\.available === false/,
    '不可选与否只能问服务端');
  /* 不可选时要把服务端给的原因说给人听 */
  assert.match(INDEX, /subtitleAutoCapability\?\.reason/);
});

test('⑤ 两条提交路径的规格不同：框选送 regions，自动送 auto', () => {
  const run = INDEX.slice(INDEX.indexOf('const runVideoDesubtitle'));
  assert.match(run.slice(0, 3000), /localSpecs:\s*mode\.needsRegions \? \{ regions \} : \{ auto: true \}/,
    '两种方式发出去的规格必须不同（服务端 localVideoPlan 靠这个分流）');
  /* 方式与产品必须一起取自那一份声明，不许在这里写死 productId */
  assert.match(run.slice(0, 3000), /SUBTITLE_ERASE_MODES\.find/);
  assert.doesNotMatch(run.slice(0, 3000), /'desubtitle_local'|'desubtitle_volc'/,
    'productId 只能来自 SUBTITLE_ERASE_MODES —— 写死就等于目录之外又一份真相');
  /* 框选那档没框区域时不能建单（服务端也会拒，但前端拦一道不收费） */
  assert.match(run.slice(0, 3000), /mode\.needsRegions && !regions\.length/);
});

test('⑥ 框选那一档要有真撤销/重做 + 上限计数（交互稿那排按钮）', () => {
  ['Undo2', 'Redo2', 'RotateCcw'].forEach(icon => {
    assert.ok(PICKER.includes(icon), '缺 ' + icon + ' —— 交互稿上有这四个按钮');
  });
  assert.match(PICKER, /const undo = /);
  assert.match(PICKER, /const redo = /);
  /* 撤销必须是**历史**，不是"删掉最后一个"那种假撤销 */
  assert.match(PICKER, /past:\s*\[\]/);
  assert.match(PICKER, /h\.past = \[\.\.\.h\.past, h\.present\]/, '每次提交都要把上一版压进 past');
  assert.match(PICKER, /h\.future = \[h\.present, \.\.\.h\.future\]/, '重做要能再前进');
  /* 上限来自调用方，不许写死 8 */
  assert.doesNotMatch(PICKER, /slice\(0, 8\)/, '框选上限来自 maxRegions prop，不许再写死');
  assert.match(PICKER, /\{regions\.length\}\/\{maxRegions\}/, '计数要显示 N/上限');
  /* 上限由画布从那一份声明传入 */
  assert.match(INDEX, /maxRegions=\{SUBTITLE_ERASE_MODES\.find\(m => m\.id === 'box'\)\?\.maxRegions/);
});

test('⑦ 操作条贴在视频节点下方，且显示价格与区域计数', () => {
  assert.match(INDEX, /ec-canvas-erase-bar/);
  assert.match(INDEX, /data-canvas-node-id="\$\{subtitleErase\.nodeId\}"/,
    '要按**这个节点**的位置定位，不是屏幕底栏');
  assert.match(INDEX, /预计 \{points\}/, '要显示预计价格（交互稿上有）');
  assert.match(INDEX, /\{mode\.maxRegions\}/, '框选那档要显示 N/上限');
  assert.match(INDEX, /formatCanvasActionPrice\(mode\.priceFeature\)/,
    '价格只能来自计价表，不能前端自己乘');
});