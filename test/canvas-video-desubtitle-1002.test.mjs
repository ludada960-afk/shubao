// test/canvas-video-desubtitle-1002.test.mjs
// 2026-10-02：画布上的「智能去字幕」（照知渔的「智能去字幕 · 框选擦除」）。
// ─────────────────────────────────────────────────────────────────────────────
// 用户口径：「肯定不能跳走啊，你可以直接内置skill去实现，**当时一定是在画布上实现啊**」
//
// 三条会真出错的约束，各自钉一道：
//   ① **记账**：前端只报「这段片子多少秒」这个事实，**不许**自己算份数/金额
//      （VideoStudio:1034-1040 的原话："前端不得把『算出来的份数/金额』发给服务端"，
//        "两边不一致就是 409 费用确认不一致"）。
//   ② **坐标**：VideoRegionPicker 换算的是**源视频像素**（delogo 的口径），
//      它靠"未缩放的 offsetWidth + rect÷自身放大"，所以**必须 portal 出画布** ——
//      画布 stage 有 transform: scale，内嵌会让框选区域整体偏移。
//   ③ **产品来源**：去字幕是**本机产品**（localProducts），与上游模型（products）不是一份东西。
//
// ⚠️ 反向断言跑在**剥掉注释**的副本上 —— 本文件的注释里就写着这些标识符。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const raw = read('src/pages/EcCanvas/index.jsx');
const code = strip(raw);
const registry = strip(read('src/pages/EcCanvas/canvasActionRegistry.js'));

test('① 记账：只报 seconds，金额与份数一律来自服务端 quote', () => {
  /* 前端算出来的金额发过去 = 两边不一致 = 409 */
  assert.match(code, /quoteBillingAction\(\{ sku: product\.sku, seconds \}\)/,
    '必须只传 { sku, seconds } 这两个事实');
  assert.match(code, /billingQuoteId: quote\.quoteId/,
    '建单必须带服务端给的 quoteId');
  assert.doesNotMatch(code, /billingQuoteId:\s*['"`]/,
    'billingQuoteId 必须是 quote.quoteId，不能是写死的字符串');
  /* 前端不许出现"自己乘出来的总价" */
  assert.doesNotMatch(code, /desubtitle[\s\S]{0,200}?units\s*\*\s*seconds/,
    '前端不许自己算总价（那是 localQuoteFor / 服务端的活，算第二份就是扣费漂移）');
});

test('② 框选面板必须**在画布上**，且坐标换算不能写死缩放（2026-10-04 改口径）', () => {
  /* 这条门禁原来钉的是"必须 createPortal 出画布"，那是因为坐标换算读的是**未缩放**的布局尺寸，
     而画布 stage 带 `transform: scale(viewport.scale)`，内嵌会让框整体偏一个缩放比。
     ⇒ 2026-10-04 换了个更根本的解法：换算改成从 DOM **量**出视觉/布局之比
        （rect.width ÷ 布局宽），框选器自身的放大与画布的缩放一并进去。
        既然偏不了的成因被去掉了，就不必再为一个弹窗把用户从画布上带走
        （用户原话：「框选擦除为什么会是一个弹窗的情况呀…他们是在画布上面进行的操作呀」）。 */
  assert.match(code, /data-video-subtitle-picker/, '框选覆盖层要有标记');
  assert.match(code, /import VideoRegionPicker from '\.\.\/\.\.\/components\/media\/VideoRegionPicker\.jsx'/,
    '必须复用 VideoStudio 那一页**同一个**组件，不要另写一份坐标换算');
  /* 比例必须量出来，不许写死 1.8 */
  const picker = fs.readFileSync(new URL('../src/components/media/VideoRegionPicker.jsx', import.meta.url), 'utf8');
  assert.match(picker, /rect\.width \/ box\.width/,
    '显示像素 → 布局像素的比例从 DOM 量，否则内嵌进画布会整体偏一个 viewport.scale');
  /* 区域落在节点上，刷新不丢、框错能改 */
  assert.match(code, /subtitleRegions/, '框出来的区域存在节点上');
});

test('③ 产品取自产品目录（去字幕的两种方式各自一个产品，不是上游模型）', () => {
  assert.match(code, /data\?\.localProducts/, '必须加载 capabilities.localProducts');
  /* 2026-10-03：入口从"只有一种"拆成「智能擦除 / 框选擦除」，
     于是 productId **不再写死在一处** —— 它跟着那一份方式声明走
     （SUBTITLE_ERASE_MODES：auto→desubtitle_volc、box→desubtitle_local）。
     这条门禁原来钉的是"必须出现 desubtitle_local 字面量"，
     那样会把"写死"当正确做法保下来 —— 目录之外又一份真相正是它要防的。
     ⇒ 改成：方式声明里必须**两个产品都在**，且提交时必须查这份声明。 */
  assert.match(registry, /export const SUBTITLE_ERASE_MODES/);
  assert.match(registry, /productId: 'desubtitle_volc'/, '自动那一档走火山');
  assert.match(registry, /productId: 'desubtitle_local'/, '框选那一档走本机 ffmpeg');
  assert.match(code, /SUBTITLE_ERASE_MODES\.find\(item => item\.id === modeId\)/,
    '提交时必须按方式取对应产品');
  /* 2026-10-03：产品解析收敛进 `resolveEraseProduct` —— 因为两档**不在同一个列表**里
     （框选 = 本机，在 localProducts；自动 = 云端，可能还没 public，会被过滤掉）。
     所以"按 productId 找产品"现在发生在那个函数里，而不是散在提交处。 */
  assert.match(code, /function resolveEraseProduct\(/, '必须有一个统一的产品解析入口');
  assert.match(code, /item\?\.id === mode\.productId/, '框选那档仍按 productId 找产品');
  assert.match(code, /autoCapability\.quotes\?\.short\?\.sku/,
    '自动那档必须用服务端 capabilities 的 sku，否则查不到产品、提交按钮永远灰着');
  /* 本机 ffmpeg 那一档：零上游成本（catalog 里 providerCostCny: 0 / localEngine: true） */
  assert.match(code, /mode: product\.modes\?\.\[0\] \|\| 'local'/, '建单模式取产品声明，不能写死');
  assert.match(code, /localSpecs: mode\.needsRegions \? \{ regions \} : \{ auto: true \}/,
    '两种方式发出去的规格必须不同（服务端 localVideoPlan 靠这个分流）');
});

test('④ 动作注册：按秒计价项真实存在，且不许残留查不到的键', () => {
  assert.match(registry, /action\('smart-subtitle-erase', '智能去字幕', \['video-toolbar'\], 'video-desubtitle'/,
    '必须注册在 video-toolbar 面、用真实存在的 video-desubtitle 计价键');
  assert.match(registry, /handler: 'smart-subtitle-erase'/, '要有 handler');
  assert.match(code, /if \(handler === 'smart-subtitle-erase'\)/, 'index.jsx 必须真的分发它');
  assert.match(code, /runVideoDesubtitle/, '必须有 runVideoDesubtitle（否则点一下白屏）');
  assert.doesNotMatch(registry, /'video-subtitle'/, '查不到的计价键不许出现 —— 那是"显示免费真扣钱"的形状');
});