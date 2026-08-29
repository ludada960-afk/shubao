/**
 * 商业化定价页深度重构 - 视觉契约测试
 * 4c183cd4 续命 P-Pricing 子代理 - 2026-08-28
 *
 * 验证深度 (与 api-contract.test.mjs 1199-1222 互不冲突, 强化):
 *   1. 4 档主套餐 grid (ec_trial_990 / ec_starter_29 / ec_growth_79 / ec_studio_199)
 *   2. 月卡 2 档单独 2 列 grid
 *   3. 微信/支付宝 真品牌色 + 商用文案
 *   4. 推荐角标 "最受欢迎"
 *   5. Hero 毛玻璃 + 渐变 orbs
 *   6. 暗色模式 [data-theme="dark"] 适配
 *   7. 响应式 4 档 -> 2 档 -> 1 档
 *   8. 锚定效应 (H3 2K is-anchored 陪衬)
 *   9. 完全无内测味
 *  10. Modals.jsx 不再引用 DevicesPanel
 *  11. 信任徽章条 (4 项)
 *  12. 4c183cd4 续命 api-contract 不变量
 *  13. FAQ 含 2 条商业化深度问答
 *  14. 4 个 @keyframes 动效
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const PRICING = await fs.readFile(new URL('../src/pages/Pricing/index.jsx', import.meta.url), 'utf8');
const PRICING_CSS = await fs.readFile(new URL('../src/pages/Pricing/Pricing.css', import.meta.url), 'utf8');
const MODALS = await fs.readFile(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');

/* ── 1) 4 档主套餐 (4 张 ec_trial / ec_starter / ec_growth / ec_studio) ── */
test('pricing page bundles the 4 commercial packs as a dedicated grid', () => {
  assert.ok(PRICING.includes('mainPacks = useMemo'), 'mainPacks useMemo');
  assert.ok(PRICING.includes('ec_monthpack_'), 'month-pack sku filter present');
  assert.ok(PRICING.includes('p.sku.startsWith'), 'p.sku.startsWith filter');
  assert.ok(PRICING.includes('a.priceFen - b.priceFen'), 'sort by price');
  assert.ok(PRICING.includes('pricing-pack-grid'), 'pricing-pack-grid class');
  assert.ok(PRICING.includes('PackCard'), 'PackCard render');
  for (const sku of ['ec_trial_990', 'ec_starter_29', 'ec_growth_79', 'ec_studio_199']) {
    assert.ok(PRICING.includes(sku), 'sku ' + sku + ' present');
  }
});

/* ── 2) 月卡 2 档单独 2 列 grid ── */
test('month packs (light + pro) get their own 2-column grid', () => {
  assert.ok(PRICING.includes('monthPacks'), 'monthPacks const');
  assert.ok(PRICING.includes('pricing-monthpack-grid'), 'monthpack grid class');
  assert.ok(PRICING.includes('ec_monthpack_39'), 'ec_monthpack_39 sku');
  assert.ok(PRICING.includes('ec_monthpack_59'), 'ec_monthpack_59 sku');
});

/* ── 3) 微信/支付宝 真品牌色 + 商用文案 ── */
test('wechat/alipay rendered with real brand colors and live commercial copy', () => {
  assert.ok(PRICING.includes('#07C160'), 'wechat green');
  assert.ok(PRICING.includes('#06AD56'), 'wechat deep green');
  assert.ok(PRICING.includes('#1677FF'), 'alipay blue');
  assert.ok(PRICING.includes('#0958D9'), 'alipay deep blue');
  assert.ok(PRICING.includes('FaWeixin'), 'react-icons wechat import');
  assert.ok(PRICING.includes('SiAlipay'), 'simple-icons alipay import');
  assert.ok(PRICING.includes('扫码即付'), 'live scan-pay copy');
  assert.ok(PRICING.includes('通道已配置'), 'commercial tone');
});

/* ── 4) 推荐角标 "最受欢迎" ── */
test('recommended badge is "最受欢迎" (commercial-grade, not generic "推荐")', () => {
  assert.ok(PRICING.includes('最受欢迎'), 'most-popular badge text');
  assert.ok(PRICING.includes('pricing-recommend-badge'), 'badge class');
  assert.ok(PRICING.includes('is-recommended'), 'recommended modifier');
});

/* ── 5) Hero 毛玻璃 + 渐变 orbs ── */
test('hero region uses glassmorphism and gradient orbs', () => {
  assert.ok(PRICING.includes('pricing-hero-orb'), 'hero orb class in JSX');
  assert.ok(PRICING.includes('pricing-hero-inner'), 'hero inner class in JSX');
  assert.ok(PRICING.includes('pricing-hero-accent'), 'hero accent class in JSX');
  // 3 色 hero accent gradient 在 CSS 里定义
  assert.ok(PRICING_CSS.includes('#6366f1') && PRICING_CSS.includes('#ec4899') && PRICING_CSS.includes('#f59e0b'), 'tri-color hero gradient');
  assert.ok(PRICING_CSS.includes('.pricing-hero-orb--a'), 'orb a selector');
  assert.ok(PRICING_CSS.includes('.pricing-hero-orb--b'), 'orb b selector');
  assert.ok(PRICING_CSS.includes('.pricing-hero-orb--c'), 'orb c selector');
  assert.ok(PRICING_CSS.includes('backdrop-filter: blur'), 'backdrop filter');
  assert.ok(PRICING_CSS.includes('pricingOrbDrift'), 'orb drift keyframe name');
});

/* ── 6) 暗色模式 ── */
test('pricing css adapts to dark theme via [data-theme="dark"] selectors', () => {
  assert.ok(PRICING_CSS.includes('[data-theme="dark"]'), 'dark theme selector');
  assert.ok(PRICING_CSS.includes('var(--bg-card-solid)'), 'token bg-card-solid used');
  assert.ok(PRICING_CSS.includes('var(--text-primary)'), 'token text-primary used');
});

/* ── 7) 响应式 4 档 -> 2 档 -> 1 档 ── */
test('responsive grid: 4 cols desktop, 2 cols <=960px, 1 col <=640px', () => {
  assert.ok(PRICING_CSS.includes('repeat(4, minmax'), '4-col desktop grid');
  assert.ok(PRICING_CSS.includes('max-width: 960px'), '960 breakpoint declared');
  assert.ok(PRICING_CSS.includes('max-width: 640px'), '640 breakpoint declared');
  const i960 = PRICING_CSS.indexOf('max-width: 960px');
  const i640 = PRICING_CSS.indexOf('max-width: 640px');
  assert.ok(i960 > 0 && i640 > i960, 'media query order (960 before 640)');
});

/* ── 8) 锚定效应 (H3 2K 顶档陪衬) ── */
test('anchoring effect: H3 2K tiers are visually deemphasized as is-anchored', () => {
  assert.ok(PRICING.includes('isAnchored'), 'isAnchored prop name');
  assert.ok(PRICING.includes('is-anchored'), 'is-anchored CSS class');
  assert.ok(PRICING.includes('/h3/i.test(tier.sku)'), 'h3 detection regex');
  assert.ok(PRICING_CSS.includes('.pricing-tier-card.is-anchored'), 'anchored CSS rule');
});

/* ── 9) 完全无内测味 ── */
test('no internal-test or placeholder text leaks into the commercial surface', () => {
  const banned = ['公司备案', '我的设备', '历史迁移', '创作权益', '体验包', '入门包', '成长包', '暂不可购买', '在线支付开通前无法下单', '支付服务接入中', 'paid=1', 'paidSuccess'];
  for (const w of banned) {
    assert.ok(!PRICING.includes(w), 'Pricing: no "' + w + '"');
    assert.ok(!MODALS.includes(w), 'Modals: no "' + w + '"');
  }
});

/* ── 10) Modals.jsx 不再 import DevicesPanel, PriceModal 也不再渲染 ── */
test('PriceModal no longer references DevicesPanel or "我的设备"', () => {
  assert.ok(!MODALS.includes('import DevicesPanel'), 'no DevicesPanel import');
  assert.ok(!MODALS.includes('<DevicesPanel'), 'no DevicesPanel render');
  const idx = MODALS.indexOf('export function PricingModal()');
  const slice = idx >= 0 ? MODALS.slice(idx) : MODALS;
  assert.ok(!slice.includes('<DevicesPanel'), 'PricingModal slice: no DevicesPanel');
  assert.ok(!slice.includes('我的设备'), 'PricingModal slice: no 我的设备');
  assert.ok(!slice.includes('公司备案'), 'PricingModal slice: no 公司备案');
});

/* ── 11) 信任徽章条 (4 项) ── */
test('hero trust strip exposes 4 commercial-grade trust badges', () => {
  assert.ok(PRICING.includes('HERO_BADGES = ['), 'HERO_BADGES const');
  assert.ok(PRICING.includes('支付通道已就绪'), 'badge 1');
  assert.ok(PRICING.includes('商用授权清晰'), 'badge 2');
  assert.ok(PRICING.includes('成本实时核算'), 'badge 3');
  assert.ok(PRICING.includes('失败不计费'), 'badge 4');
  assert.ok(PRICING.includes('pricing-trust-strip'), 'trust strip class');
  assert.ok(PRICING.includes('TrustStrip'), 'TrustStrip component');
});

/* ── 12) 4c183cd4 续命契约 ── */
test('still satisfies the long-standing api-contract invariants on the new page', () => {
  assert.ok(PRICING.includes('所有创作功能共用一套 AI 积分'), 'shared points copy');
  assert.ok(PRICING.includes('PRICING_PLANS'), 'PRICING_PLANS import');
  assert.ok(PRICING.includes('微信支付'), 'wechat pay');
  assert.ok(PRICING.includes('支付宝'), 'alipay');
  assert.ok(PRICING.includes('扫码支付'), 'scan pay');
  assert.ok(!PRICING.includes('小红书 / Plog'), 'no plog cross-sell');
});

/* ── 13) FAQ 含 2 条商业化深度问答 ── */
test('FAQ covers the two commercial depth questions users actually ask', () => {
  assert.ok(PRICING.includes('为什么价格是 4 档而不是订阅制'), 'subscription-vs-buyout FAQ');
  assert.ok(PRICING.includes('怎么确认订单完成'), 'order-confirm FAQ');
  assert.ok(PRICING.includes('3-5 秒内入账'), '3-5s instant credit copy');
});

/* ── 14) 4 个 @keyframes 动效 ── */
test('css defines all custom keyframes for hero orbs, pay pulse, and FAQ reveal', () => {
  assert.ok(PRICING_CSS.includes('@keyframes pricingOrbDrift'), 'orb drift keyframe');
  assert.ok(PRICING_CSS.includes('@keyframes pricingPayPulse'), 'pay pulse keyframe');
  assert.ok(PRICING_CSS.includes('@keyframes pricingFaqReveal'), 'faq reveal keyframe');
  assert.ok(PRICING_CSS.includes('@keyframes pricingScaleIn'), 'modal scale-in keyframe');
});
