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
    '自动（火山，成本 ¥0.4/分钟）与框选（本机 ffmpeg，成本 0）不是同一个价');
  assert.ok(CANVAS_BILLING_KEYS.includes(auto.priceFeature), '自动那一档必须已登记：' + auto.priceFeature);
  assert.ok(CANVAS_BILLING_KEYS.includes(box.priceFeature), '框选那一档必须已登记：' + box.priceFeature);
  /* 2026-10-04：两档都改成**按次固定价**（用户原话「这里应该固定一个费用呀…都应该是一个固定的
     费用才对吧」）。所以判据从"每��单价"变成"固定价 + 逐值对上服务端目录" ——
     守的还是同一件事：**界面上的那个数必须与目录里那条 SKU 逐值相同**。 */
  const autoBilling = getCanvasActionBilling(auto.priceFeature);
  const boxBilling = getCanvasActionBilling(box.priceFeature);
  assert.notEqual(autoBilling.perSecond, true, '自动档已改按次：界面不该再显示"0.05 积分/秒"');
  assert.notEqual(boxBilling.perSecond, true, '框选档已改按次：界面不该再显示"0.04 积分/秒"');
  assert.equal(boxBilling.units, 1, '框选 1 积分/次（catalog video_desubtitle_local_* units 1000）');
  assert.equal(autoBilling.units, 3, '自动 3 积分/次（catalog video_desubtitle_volc_* flatUnits 3000）');
  assert.ok(autoBilling.skus.some(s => s.includes('volc')), '自动档的 sku 必须是 volc 那一族');
  assert.ok(boxBilling.skus.some(s => s.includes('local')), '框选档的 sku 必须是 local 那一族');
});

/* ⚠️ 这一条是 2026-10-04 那一改的**根因门禁**：固定价如果两边对不上，用户就会看到
   「界面写 1 积分、实际扣 3」。前端表是目录的镜像，所以这里逐值比对。 */
test('② 之二 固定价必须与 server/billing/catalog 的 SKU 逐值相同（镜像不许漂）', () => {
  const catalog = read('server/billing/catalog.mjs');
  const pointsOf = sku => Number(new RegExp(`${sku}:\\s*\\{[^}]*?units:\\s*(\\d+)`).exec(catalog)?.[1]) / 1000;
  const flatOf = sku => Number(new RegExp(`${sku}:\\s*\\{[^}]*?flatUnits:\\s*(\\d+)`).exec(catalog)?.[1]) / 1000;
  const [auto, box] = SUBTITLE_ERASE_MODES;

  /* 框选：SKU 是纯按条（perSecond 已摘掉），固定价 = units/1000 */
  assert.equal(getCanvasActionBilling(box.priceFeature).units, pointsOf('video_desubtitle_local_short'));
  assert.equal(getCanvasActionBilling(box.priceFeature).units, pointsOf('video_desubtitle_local_long'));
  assert.doesNotMatch(catalog, /video_desubtitle_local_short: \{[^}]*perSecond/,
    '框选档的成本是 ¥0，摘掉 perSecond 之后才是真正的"按次"');

  /* 自动：SKU 仍是按秒（成本真的随秒数涨），但封顶内走 flatUnits */
  assert.equal(getCanvasActionBilling(auto.priceFeature).units, flatOf('video_desubtitle_volc_short'));
  assert.equal(getCanvasActionBilling(auto.priceFeature).units, flatOf('video_desubtitle_volc_long'));
  /* 平价不是无脑平价：必须有封顶，否则 300 秒那条单要亏钱 */
  const cap = Number(/video_desubtitle_volc_short: \{[^}]*flatMaxSeconds:\s*(\d+)/.exec(catalog)?.[1]);
  assert.ok(cap > 0, '平价档必须声明 flatMaxSeconds —— 没有封顶的平价就是每卖一单亏一单');
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
  assert.match(studio, /onClick=\{clickEvent => \{ if \(!isDisabled\) onAction\?\.\(action, node, clickEvent\); \}\}/,
    '必须把事件传出去 —— 下拉要锚在**这颗按钮**上，不是凭空出现在屏幕中间');
  /* ⚠️ 而且那个事件参数必须是 onClick **自己**声明的：
     写成 `onClick={() => … onAction?.(action, node, event) }` 时，
     `event` 只存在于相邻 onPointerDown 的参数里 ⇒ 每次点击都抛 ReferenceError
     ⇒ 用户看到的是「点了完全没反应」（2026-10-03 实测）。 */
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
  assert.match(INDEX, /const boxMode = SUBTITLE_ERASE_MODES\.find\(mode => mode\.id === 'box'\)/);
  assert.match(INDEX, /maxRegions=\{boxMode\?\.maxRegions/,
    '上限只能来自 SUBTITLE_ERASE_MODES 那一处声明');
  /* 2026-10-04：控件**归画布那条操作条**了（用户要的是"在画布上框"），
     所以历史要通过 ref 交出去 —— 不许复制一份到画布里，
     否则会出现"框了一格、底下说 0 格"。 */
  assert.match(PICKER, /useImperativeHandle\(ref/, '历史必须按命令交出去，不能另抄一份');
  ['undo', 'redo', 'reset', 'removeLast'].forEach(command => {
    assert.match(PICKER, new RegExp(`${command}[,\\s]`), 'ref 上要有 ' + command);
  });
  assert.match(INDEX, /subtitlePickerRef\.current/, '画布那条操作条要拿同一个 ref');
});

/* ═══ 2026-10-04：框选必须**在画布上**做，不是弹窗 ══════════════════════════════════════════
   用户原话：「框选擦除为什么会是一个弹窗的情况呀…你没有好好看一下我给你的知鱼的那个截图吗？
   他们是在画布上面进行的操作呀」「而且你这里的按钮为什么是完成宽选呢？
   完成宽选之后呢是直接就开始处理了吗？」 */
test('⑥ 之二 框选直接叠在视频节点上，不再是全屏弹窗，也没有「完成框选」', () => {
  /* ⚠️ 判"某个东西**不**在了"必须先剥注释：这一批的注释里到处在解释
     「为什么删掉那颗『完成框选』」，不剥就会把自己的说明当成残留。 */
  const code = INDEX.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(code, /className="ec-canvas-erase-overlay"/, '覆盖层要渲染在画布上');
  assert.match(code, /left:\s*target\.x,\s*top:\s*target\.y,\s*width:\s*target\.w/,
    '位置取自**节点矩形** —— 就在这条素材上，不另开一个界面');
  assert.match(code, /data-canvas-control="true"/,
    '必须告诉画布总 handler「这块是我的」：否则按下鼠标会同时触发 marquee 框选');
  assert.doesNotMatch(code, /完成框选/, '那颗按钮删掉了：框完直接点「提交」，中间不留语义不明的按钮');
  assert.doesNotMatch(code, /video-subtitle-picker[\s\S]{0,400}?createPortal/,
    '不再有那个 createPortal 的全屏遮罩');
  /* 坐标换算不能写死放大倍数：画布 stage 自己带 scale */
  assert.match(PICKER, /rect\.width \/ box\.width/,
    '显示像素→布局像素的比例要从 DOM 量（否则内嵌进画布会整体偏一个 viewport.scale）');
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