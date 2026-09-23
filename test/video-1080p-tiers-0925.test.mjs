import assert from 'node:assert/strict';
import test from 'node:test';

import { FEATURE_SKUS, contributionMarginOf, pointsFaceAnchorCny, MARGIN_BANDS } from '../server/billing/catalog.mjs';
import {
  VIDEO_PRODUCTS,
  buildProviderPayload,
  getVideoProduct,
  publicVideoProducts,
  publicRouteViolations,
  routeReachability,
  videoFeatureSku,
} from './helpers/video-1080p-fixture.mjs';

/* ═══ 2026-09-25 批 AN：**1080P 档**（用户口径与验收边界，逐字）══════════════════════════════════
   用户原话：
     · 价：「**1080P 我觉得是按他们那样，比 720P 高一倍的积分**」
     · 验收边界：「1080P 你先不用管真实验证的问题，你确保在**不真跑生产**的情况下，
       他的通道和逻辑都是 OK 的就好，后续我自己回去一个一个生成案例的，那时候会验证问题的」
   ⇒ 这条门禁就是那份"不真跑生产也能证明的东西"，四件事：
     ① **价格**：每一档 = 对应 720P 档的 **units × 2**（积分翻倍）且 priceFen 同步翻倍
        —— 日后谁改价，先红在这里；
     ② **毛利**：按各自的上游记账成本算，必须过该档所在毛利带的地板（成本数字都有出处）；
     ③ **通道**：resolution 真的进了下游报文（两种协议各断言一次），且路由在台账里登记过；
     ④ **不会"点了必失败"**：余额不够的那条（seedance 1080p，预扣 ¥7.67 > 余额）必须
        public: false —— 产品、SKU 一起藏，报价接口直接拒发令牌。
   ⚠️ 不跑任何生成请求：这条门禁只读目录/价目/台账与**报文构造**（纯函数）。 */

const anchor = pointsFaceAnchorCny();
const FLOOR = band => MARGIN_BANDS[band].floor;

/* 每一档的"720P 基准"与"上游成本出处"—— 数字全部来自仓库里已审计的行/文档注释 */
const TIERS = [
  {
    product: 'wan_1080p',
    base: { short: 'video_wan_standard_short', long: 'video_wan_standard_long' },
    own: { short: 'video_wan_1080p_short', long: 'video_wan_1080p_long' },
    public: true,
    route: 'xn-wan3.0',
    costSource: '文档价 per_second：xn-wan3.0 的 1080p ¥0.455/秒（同表 720p ¥0.325）',
    costs: { short: 0.455 * 5, long: 0.455 * 9 },
    note: '长档按 9 秒记（站内长档代表时长，见 longQuoteSeconds）；durations.max=9 的余额理由见产品注释',
  },
  {
    product: 'seedance_1080p',
    base: { short: 'video_seedance_standard_short', long: 'video_seedance_standard_long' },
    own: { short: 'video_seedance_1080p_short', long: 'video_seedance_1080p_long' },
    public: false,
    route: 'seedance-2.0-1080p',
    costSource: '9-16 零成本实测：预扣 ¥7.67/条（按条计费，billing_mode=per_request）',
    costs: { short: 7.67, long: 7.67 },
    note: '按条计费 ⇒ 短长档成本相同；价格仍按 2× 记',
  },
];

test('① 价格口径逐值可验：每一档 = 对应 720P 档的 units × 2（积分翻倍），priceFen 同步翻倍', () => {
  for (const tier of TIERS) {
    for (const size of ['short', 'long']) {
      const base = FEATURE_SKUS[tier.base[size]];
      const own = FEATURE_SKUS[tier.own[size]];
      assert.ok(base && own, `${tier.product}/${size} 的 SKU 必须都在目录里`);
      assert.equal(own.units, base.units * 2, `${tier.own[size]} 的 units 必须是 ${tier.base[size]} 的两倍（用户口径：比 720P 高一倍）`);
      assert.equal(own.priceFen, base.priceFen * 2, `${tier.own[size]} 的 priceFen 必须同步翻倍（面值与积分是同一件事的两面）`);
      /* 积分口径：站内 1 积分 = 1000 units —— 翻倍 = 用户看到的价格翻倍 */
      assert.equal(Math.ceil(own.units / 1000), Math.ceil(base.units / 1000) * 2, `${tier.own[size]} 的积分显示应正好翻倍`);
    }
  }
});

test('② 毛利：按各自上游成本算，必须过所在带的地板（成本出处逐条写在注释里）', () => {
  for (const tier of TIERS) {
    for (const size of ['short', 'long']) {
      const own = FEATURE_SKUS[tier.own[size]];
      const face = own.units * anchor;
      const margin = (face - face * 0.03 - tier.costs[size]) / face;
      const floor = FLOOR(own.marginBand);
      assert.ok(margin >= floor,
        `${tier.own[size]} 毛利 ${(margin * 100).toFixed(1)}% 低于 ${own.marginBand} 带地板 ${(floor * 100).toFixed(0)}%`
        + `（成本 ${tier.costs[size]} 来自：${tier.costSource}）`);
      /* 记账成本必须与算毛利用的是同一个数（否则"账上好看、实际亏"） */
      assert.equal(own.providerCostCny, tier.costs[size], `${tier.own[size]} 的 providerCostCny 必须等于 ${tier.costSource}`);
      assert.equal(contributionMarginOf(own, face), margin, `${tier.own[size]} 的毛利要用同一套公式算`);
    }
  }
});

test('③ 通道：1080p 真的进了下游报文，且路由在台账里登记过（不跑生成也能证明的那一半）', () => {
  for (const tier of TIERS) {
    const product = getVideoProduct(tier.product);
    assert.deepEqual(product.resolutions, ['1080p'], `${tier.product} 只声明 1080p（独立产品 = 独立价档，与 2K 档同一做法）`);
    assert.equal(product.routeId, tier.route);
    const entry = routeReachability(product.routeId);
    assert.notEqual(entry.state, 'unknown', `${product.routeId} 必须在台账里登记`);
    assert.match(String(entry.evidence), /20\d\d-\d\d-\d\d/, '台账证据必须有日期');
    /* 报文：两种协议都要把 resolution 带下去（seedance 协议与 minimax 协议） */
    const body = buildProviderPayload({
      product,
      job: { prompt: '通道探针', duration: product.durations.min, aspect_ratio: '9:16', resolution: '1080p', refs_json: '{}' },
    }).body;
    assert.equal(body.resolution, '1080p', `${tier.product} 的报文必须带 resolution=1080p`);
  }
  /* 上游不可达/未登记的路由不许出现在公开档（既有门禁复述一遍，防止新增产品绕过它） */
  assert.deepEqual(publicRouteViolations(), []);
});

test('④ 不会"点了必失败"：余额不够的那条必须藏着（产品 + SKU + 报价三处一起关）', () => {
  const hidden = getVideoProduct('seedance_1080p');
  /* 9-16 实测：预扣 ¥7.67 > 中转余额 ⇒ 建单必被上游拒 ⇒ 不许公开 */
  assert.equal(hidden.public, false, 'seedance 1080p 卡在余额，必须 public:false');
  assert.equal(routeReachability(hidden.routeId).state, 'blocked', '台账如实记 blocked（活着但余额不足）');
  assert.match(String(routeReachability(hidden.routeId).evidence), /7\.67/, '证据里要写清预扣价（¥7.67）');
  assert.match(String(routeReachability(hidden.routeId).evidence), /余额/, '证据里要写清"余额不足"这个原因');
  for (const sku of ['video_seedance_1080p_short', 'video_seedance_1080p_long']) {
    assert.equal(FEATURE_SKUS[sku].public, false, sku + ' 也必须 public:false —— 否则报价接口会发出令牌');
  }
  /* 公开目录里不许出现它；上行/下行两条清单都要么没有它、要么写明原因 */
  const publicIds = publicVideoProducts({ includeHidden: true }).map(product => product.id);
  assert.equal(publicVideoProducts().some(product => product.id === 'seedance_1080p'), false);
  assert.ok(publicIds.includes('seedance_1080p'), '隐藏档仍要能查到（老任务与管理端需要）');

  /* 公开的那条：产品与 SKU 都是 public:true（否则用户看不到这一档） */
  assert.equal(getVideoProduct('wan_1080p').public, true);
  assert.equal(FEATURE_SKUS.video_wan_1080p_short.public, true);
  assert.equal(FEATURE_SKUS.video_wan_1080p_long.public, true);
});

test('⑤ 秒数上限与余额自洽：wan 1080p 的 max 必须满足「预扣 ≤ 记账余额」', () => {
  /* 1080P 的上游预扣 = ¥0.455 × 秒数；记账余额 ¥4.2478（2026-09-23 台账）。
     上限一旦被改大而不充值，用户点下去就会撞 insufficient_user_quota —— 这条守着这个不自洽。 */
  const RECORDED_BALANCE_CNY = 4.2478;
  const product = getVideoProduct('wan_1080p');
  const maxPreauth = 0.455 * product.durations.max;
  assert.ok(maxPreauth <= RECORDED_BALANCE_CNY,
    `wan_1080p 的 ${product.durations.max} 秒档预扣 ¥${maxPreauth.toFixed(3)} 超过记账余额 ¥${RECORDED_BALANCE_CNY}`
    + ' ⇒ 要么把 durations.max 调回安全值，要么先充值（充值后同步改这里的常量并在注释里写明）');
  /* 长档 SKU 确实是按 9 秒派生的（不是 10 秒那条不存在的 SKU） */
  assert.equal(videoFeatureSku({ productId: 'wan_1080p', duration: product.durations.max }), 'video_wan_1080p_long');
  assert.equal(product.durations.max, 9, '当前上限 9 秒（10 秒的预扣 ¥4.55 > 余额）');
});

test('⑥ 1080P 不是"悄悄加的"：目录里 1080p 公开档只有这两条来源清楚的产品', () => {
  const with1080 = Object.values(VIDEO_PRODUCTS)
    .filter(product => (product.resolutions || []).includes('1080p'))
    .map(product => product.id)
    .sort();
  /* 本地方案（视频高清）本来就有 1080p；另有通义万相 1080P（公开）与 Seedance 1080P（藏起来等余额） */
  assert.deepEqual(with1080, ['seedance_1080p', 'upscale_local', 'wan_1080p'],
    '目录里带 1080p 的产品清单变了 —— 新增 1080P 档必须同时补这条门禁与上游证据');
  const publicWith1080 = Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public === true && product.localEngine !== true && (product.resolutions || []).includes('1080p'))
    .map(product => product.id);
  assert.deepEqual(publicWith1080, ['wan_1080p'], '非本地的公开 1080P 档当前只有通义万相这一条（Seedance 那条卡余额）');
});
