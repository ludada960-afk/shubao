import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FEATURE_SKUS, billableQuantity, quoteFeature } from '../server/billing/catalog.mjs';
import { getVideoProduct, routeReachability } from '../server/videoCatalog.mjs';
import { localBillableQuantity, localJobPoints, localQuoteFor } from '../src/pages/VideoStudio/videoStudioModel.js';
import { getVideoSkill } from '../src/skills/videoSkills.js';

/* ═══ 2026-09-26 批 AZ：**数字人创作台接线**（交接待做②的收口门禁）═══════════════════════════════
   交接文档 docs/design/74 §四 写的"只剩这一件"就是本文件守的东西：VideoStudio 里原来**没有**
   `upstream-process` 引擎的分支 ⇒ 产品只能 public:false（一旦翻公开，用户进那一页会落到
   "上游生成"的默认分支：拿默认模型出一段普通视频并照常扣费）。本批把这四件事做完：
     ① 判据推广：`localEngine` 那一串判断 → **process 产品**（localEngine || upstreamProcessPlan）；
     ② 音频槽位的**时长探针**（这一档按**音频秒数**计费，原来只对源视频探时长）；
     ③ 报价数量取**音频秒数**（服务端 billableQuantity({sku, seconds}) 早就支持，页面没传）；
     ④ 接线完成后：产品 lipsync_volc 与两条 SKU 的 public 一起翻 true、
        技能 video.digital_human 的 availability 由 'blocked' 改 'ready'（摘掉「即将上线」角标）。

   ⚠️ 钱的那一条（③）是本文件最要紧的：前端报价令牌里的**秒数**与服务端建单时冻结的**份数**
      必须逐值相等，否则 quoteService.verify 会 409「费用确认不一致」；更糟的是两边各写一套
      规则时**恰好都能过**，于是"显示扣 X、实际扣 Y"。所以这里对同一批样本同时断言两边
      （含 8/9 秒的档位分界与 12.4 → 13 这种向上取整的边界）。
   ⚠️ 这一批**一次付费调用都没发**（与批 AU/AX 同一条纪律）：本文件只读目录、纯函数与页面源码，
      不联网、不建单、不扣费。 */

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

const LIPSYNC = 'lipsync_volc';
const SHORT_SKU = 'video_lipsync_volc_short';
const LONG_SKU = 'video_lipsync_volc_long';

test('① 页面：process 分支的判据是「process 产品」而不是 localEngine（本机那两条逐值不变）', async () => {
  const page = await source('../src/pages/VideoStudio/index.jsx');
  /* 判据本体：两种执行方式归成一条分支 —— 本机执行（视频高清 / 去字幕）与上游执行（数字人）。
     守的是"这一页到底走哪条路"只有一处判断：分散成两处就会出现"这页接了、那页没接"。 */
  assert.match(page, /const upstreamProcessPlan = localPlan\?\.engine === UPSTREAM_PROCESS_ENGINE;/);
  assert.match(page, /const processPlan = Boolean\(localEngine \|\| upstreamProcessPlan\);/,
    'process 分支的判据必须同时认本机与上游两种执行方式');
  /* 五处"接了才不出事故"的落点，逐条守（漏掉任何一处，数字人那一页就会用错口径）： */
  assert.match(page, /if \(processPlan\) return activeProcessProduct \? localQuoteFor\(activeProcessProduct, billingSeconds\) : null;/,
    '报价必须按 process 分支走（否则会去算上游模型的时长白名单，直接抛错）');
  assert.match(page, /const totalJobPoints = processPlan[\s\S]{0,40}\? estimatedPoints/,
    'process 方案不收"方案分析费"（数字人那一页同样没有这一步）');
  assert.match(page, /if \(processPlan\) \{\n\s+await submitProcessJob\(\);/,
    '提交必须走 process 那条（否则会带上提示词/比例去建单，服务端直接拒）');
  assert.match(page, /const canGenerate = processPlanBlocked[\s\S]{0,120}\? processReady && !submitting/,
    '生成闸门必须按 processPlan 判（并保留"服务端说不可用就拦死"那道）');
  assert.match(page, /!\(processPlan && item\.key === 'settings'\)/,
    'process 方案不给「生成设置」面板（清晰度/比例/时长/Seed 对它没有意义）');
  /* ⚠️ 本机执行才需要的两样，判据**保持** localEngine（不是偷懒，是这两件真的只属于本机）：
       ffmpeg 预检与本地方案的规格默认值。 */
  assert.match(page, /\(!localEngine \|\| autoModeSelected \|\| localEngineReady\)/,
    '本机执行才要求 ffmpeg 就绪；上游执行（火山）与它无关');
});

test('② 音频槽位：按音频秒数计费的那一档要真的对音频探时长（不是拿视频顶替）', async () => {
  const page = await source('../src/pages/VideoStudio/index.jsx');
  /* 音频槽位从**声明源**派生（哪个上传块的 accept 收音频），不在页面里写死 key ——
     与源视频槽位同一套做法（原来是写死 video 的那个查找）。 */
  assert.match(page, /const processAudioSlot = processSpec\.audio === true;/,
    '要不要驱动音频必须来自产品声明（服务端 localSpec.audio 同一判据）');
  assert.match(page, /String\(item\.accept \|\| ''\)\.includes\('audio'\)/,
    '音频槽位按块声明找（accept 收音频的那一块），不写死 key');
  /* 探针：用 HTMLAudioElement 读元数据 + 向上取整（与服务端 billableQuantity 同一口径） */
  assert.match(page, /const probe = document\.createElement\('audio'\);/,
    '数字人这一档必须对**音频**探时长（原来只对源视频探，音频永远是 0 秒）');
  assert.match(page, /setAudioSeconds\(Number\.isFinite\(value\) && value > 0 \? Math\.min\(processMaxSeconds, Math\.ceil\(value\)\) : 0\);/,
    '音频秒数向上取整、上限取产品声明（与服务端同一口径，两处都取整才不会 409）');
  /* 上限也从产品声明派生：本机那两条 300 秒、数字人 1800 秒（30 分钟），页面不写死数字 */
  assert.match(page, /const processMaxSeconds = Number\(activeProcessProduct\?\.durations\?\.max\) > 0/,
    '探针上限取产品声明的时长上限（原来写死 300）');
  /* 计费那一档的秒数由 processAudioSlot 决定 —— 这是本文件③的前半条 */
  assert.match(page, /const billingSeconds = processAudioSlot \? processAudioSeconds : processSourceSeconds;/,
    '按配音计费的那一档，账跟着配音走；其余仍按源视频');
});

test('③ 钱：报价的秒数取音频秒数，且与**服务端**的 billableQuantity 逐值相等', () => {
  const product = getVideoProduct(LIPSYNC);
  assert.equal(FEATURE_SKUS[SHORT_SKU].perSecond, true, '两条 SKU 都是按秒档');
  /* 前端报价用的那一行（形状 = capabilities.digitalHuman 给页面的那一份）
     —— 页面**不自己判断**"哪一档按秒"，它读服务端给的 billingQuantity。 */
  const row = {
    id: product.id,
    billingQuantity: FEATURE_SKUS[SHORT_SKU].perSecond === true ? 'seconds' : 'clip',
    quotes: {
      short: { sku: SHORT_SKU, units: FEATURE_SKUS[SHORT_SKU].units, points: FEATURE_SKUS[SHORT_SKU].units / 1000 },
      long: { sku: LONG_SKU, units: FEATURE_SKUS[LONG_SKU].units, points: FEATURE_SKUS[LONG_SKU].units / 1000 },
    },
  };
  assert.equal(row.billingQuantity, 'seconds', '数字人的报价按秒（capabilities.digitalHuman 也是这么报的）');
  /* 同一样本同时过两边：帧内秒数（3/7/8）、跨档（9/12）、小数（12.4 → 13）、上限（1800） */
  for (const seconds of [1, 3, 7, 8, 9, 12, 12.4, 900, 1800]) {
    const sku = Number(seconds) <= 8 ? SHORT_SKU : LONG_SKU;
    assert.equal(
      localBillableQuantity(row, seconds),
      billableQuantity({ sku, seconds }),
      `${seconds} 秒：前端报价数量必须与服务端建单数量逐值相等（不一致就是 409「费用确认不一致」）`,
    );
    const front = localQuoteFor(row, seconds);
    const server = quoteFeature(sku, billableQuantity({ sku, seconds }));
    assert.equal(front.sku, sku, `${seconds} 秒走同一档 SKU（≤8 秒 short、>8 秒 long）`);
    assert.equal(front.totalUnits, server.totalUnits, `${seconds} 秒：冻结的单位数必须逐值相等`);
    assert.equal(localJobPoints(row, seconds), Math.ceil(server.totalUnits / 1000), '按钮上那个数字 = 服务端报价向上取整');
  }
});

test('④ 页面把"音频秒数"这一事实（而不是份数/金额）发给服务端 —— 与 pricing-single-source 同一条纪律', async () => {
  const page = await source('../src/pages/VideoStudio/index.jsx');
  assert.match(page, /quoteBillingAction\(processPlan\s*\n?\s*\? \{ sku, seconds: billingSeconds \|\| 1 \}/,
    '报价只报"这段配音多少秒"这个事实，份数仍由服务端算（前端不算钱）');
  /* 建单报文：时长 = 计费那一档的秒数；模式取产品声明（local / process），不再写死 'local' */
  assert.match(page, /duration: billingSeconds,/,
    '建单的 duration 必须是计费那一档的秒数（数字人 = 配音秒数）');
  assert.match(page, /mode: activeProcessProduct\.modes\?\.\[0\] \|\| 'local',/,
    '建单模式取产品声明（本机那两条 local、数字人 process），请求里不写假话');
  /* 两个文件都要传：缺音频服务端会在**冻结积分之前** 400（用户补个文件就能过） */
  assert.match(page, /const \[audio\] = processAudioSlot \? await uploadFiles\(\[processAudioFile\], 'audio'\) : \[\];/,
    '数字人要把驱动音频一起上传（只传视频会被服务端 400）');
  assert.match(page, /audios: audio\?\.id \? \[audio\.id\] : \[\],/);
  /* 幂等键把两段素材都算进去：换了配音就是**另一次处理** */
  assert.match(page, /'video-process-job',\s*\n\s+activeProcessProduct\.id,\s*\n\s+source\.id,\s*\n\s+audio\?\.id \|\| '',/);
  /* 按钮上的价目说明也从目录派生（原来写死 0.04/0.50 两个数字 ⇒ 数字人会显示成别人的价） */
  assert.match(page, /const processPriceHint = \(\(\) => \{/);
  assert.match(page, /按\$\{processAudioSlot \? '配音' : '源视频'\}时长计费：\$\{points\} 积分\/秒/);
  assert.equal(page.includes("'按源视频时长计费：0.04 积分/秒'"), false, '价目说明不许再写死');
});

test('⑤ 三样一起翻公开：产品、两条 SKU、技能角标（价格一分未动）', () => {
  const product = getVideoProduct(LIPSYNC);
  assert.equal(product.public, true, '创作台已接线 ⇒ 产品公开');
  assert.equal(product.videoProcess, true, '仍是"处理已有视频"那一类（不走模型注册表）');
  assert.equal(product.localSpec.audio, true, '多要一段驱动音频这条声明一个字没动');
  assert.equal(routeReachability(product.routeId).state, 'callable', '台账是 callable（真机跑通那次）');
  assert.equal(FEATURE_SKUS[SHORT_SKU].public, true, '收费项同批翻公开');
  assert.equal(FEATURE_SKUS[LONG_SKU].public, true);
  assert.equal(FEATURE_SKUS[SHORT_SKU].units, 120, '0.12 积分/秒 —— 价格一分未动');
  assert.equal(FEATURE_SKUS[LONG_SKU].units, 120);
  const skill = getVideoSkill('video.digital_human');
  assert.equal(skill.availability, 'ready', '技能角标摘掉（不再显示「即将上线」）');
  assert.equal(skill.plan.engine, 'upstream-process', '方案引擎不变');
  assert.equal(skill.plan.hideModel, true, '这一页不给模型格（它不是"选一个模型"）');
  assert.equal(skill.plan.productId, LIPSYNC);
});
