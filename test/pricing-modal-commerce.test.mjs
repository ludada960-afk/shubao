/**
 * 4c183cd4 续命 PricingModal 商业化重做 - 视觉 & 交互契约测试 (8-30 主线程反馈)
 *
 * 商业化策略验证 (8-30 用户原话):
 *   "你要去了解真正的定价业是怎么做的, 然后要有商业化策略,
 *    你要明白要展示什么东西给用户看, 让用户能够在支付的这个环节快速的做下决策"
 *
 * 验证深度:
 *   1. 玻璃拟态 + 渐变光晕 orbs
 *   2. Tab 切换 (视频按量 vs 积分套餐) + 状态
 *   3. 锚定效应 (STANDARD 居中放大 + 专业版居中放大)
 *   4. 价值阶梯 (3 档按量 + 4 档套餐 + 2 档月卡)
 *   5. 信任徽章 (4 项商业化策略)
 *   6. 可交互支付按钮 (微信绿 + 支付宝蓝)
 *   7. 决策元素 (当前额度/价格/积分/能买到什么/推荐标识)
 *   8. 对比表格 (按量 vs 月卡礼包)
 *   9. FAQ 折叠 (商业化深度问答)
 *  10. 4 个 @keyframes 动效
 *  11. 暗色模式 [data-theme="dark"]
 *  12. 响应式 4 档 -> 2 档 -> 1 档
 *  13. 向后兼容 4c183cd4 时代 props + show 守卫
 *  14. 内测味文案零泄漏
 *  15. api-contract.test.mjs 1199-1222 不变量
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const PRICING_MODAL = await fs.readFile(
  new URL('../src/components/business/PricingModal.jsx', import.meta.url),
  'utf8',
);
const PRICING_CSS = await fs.readFile(
  new URL('../src/styles/pricing-modal.css', import.meta.url),
  'utf8',
);
const MODALS = await fs.readFile(
  new URL('../src/components/business/Modals.jsx', import.meta.url),
  'utf8',
);

const WS = '\\s*';
const WSQ = '\\s*?';

/* ═══════ 1. 玻璃拟态 + 渐变光晕 orbs ═══════ */
test('pricing modal root has glassmorphism + gradient orbs decoration', () => {
  assert.match(PRICING_CSS, new RegExp('.pricing-modal' + WSQ + '\\{' + '[\\s\\S]*?backdrop-filter:' + WS + 'blur'));
  assert.match(PRICING_CSS, new RegExp('saturate\\(180%\\)'));
  assert.match(PRICING_MODAL, /pricing-modal__orb--a/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--b/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--c/);
  assert.ok(PRICING_CSS.includes('99, 102, 241'), 'indigo rgb in css');
  assert.ok(PRICING_CSS.includes('236, 72, 153'), 'pink rgb in css');
  assert.ok(PRICING_CSS.includes('245, 158, 11'), 'amber rgb in css');
});

/* ═══════ 2. Tab 切换: 视频按量 vs 积分套餐 ═══════ */
test('pricing modal exposes a tab toggle (按量 / 套餐) with role=tablist', () => {
  assert.match(PRICING_MODAL, /role="tablist"/);
  assert.match(PRICING_MODAL, /role="tab"/);
  assert.match(PRICING_MODAL, /aria-selected=\{activeTab === "usage"\}/);
  assert.match(PRICING_MODAL, /aria-selected=\{activeTab === "packs"\}/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => setActiveTab\("usage"\)\}/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => setActiveTab\("packs"\)\}/);
  assert.match(PRICING_MODAL, /data-tab=\{activeTab\}/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-usage"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-packs"/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__tab--active'));
});

/* ═══════ 3. 锚定效应: STANDARD 居中放大 ═══════ */
test('按量 tab STANDARD tier is visually anchored (centered + scaled up)', () => {
  assert.match(PRICING_MODAL, /anchors: true/);
  assert.match(PRICING_MODAL, /pricing-modal__video-card--anchored/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__video-card--anchored' + WSQ + '\\{' + '[\\s\\S]*?translateY\\(-4px\\)' + WS + 'scale\\(1\\.02\\)'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__video-card--anchored[\\s\\S]*?box-shadow'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__video-grid[\\s\\S]*?1fr 1\\.12fr 1fr'));
  assert.match(PRICING_MODAL, /recommendedLabel: "最受欢迎"/);
  assert.match(PRICING_MODAL, /pricing-modal__anchored-flag/);
});

/* ═══════ 4. 锚定效应: 专业版居中放大 ═══════ */
test('套餐 tab 专业版 (ec_starter_29) is visually anchored', () => {
  assert.match(PRICING_MODAL, new RegExp('PACK_RECOMMENDATION = \\{' + '[\\s\\S]*?sku: "ec_starter_29"'));
  assert.match(PRICING_MODAL, /PACK_RECOMMENDATION\.label/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__pack--anchored' + WSQ + '\\{' + '[\\s\\S]*?translateY\\(-4px\\)' + WS + 'scale\\(1\\.02\\)'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__pack-grid[\\s\\S]*?1fr 1\\.15fr 1fr 1fr'));
});

/* ═══════ 5. 价值阶梯: 3 档按量 + 4 档套餐 + 2 档月卡 ═══════ */
test('video tiers expose 3 ordered tiers (FAST / STANDARD / PREMIUM)', () => {
  assert.match(PRICING_MODAL, /VIDEO_TIERS = \[/);
  assert.match(PRICING_MODAL, /eyebrow: "FAST"/);
  assert.match(PRICING_MODAL, /eyebrow: "STANDARD"/);
  assert.match(PRICING_MODAL, /eyebrow: "PREMIUM"/);
  const priceMatches = PRICING_MODAL.match(/price: "(6\.9|11\.9|14\.9)"/g) || [];
  assert.equal(priceMatches.length, 3);
});

/* ═══════ 6. 信任徽章 (4 项商业化策略) ═══════ */
test('trust strip exposes 4 commercial-grade badges (Secure / 100% 积分返还 / 永久有效 / 失败不计费)', () => {
  assert.match(PRICING_MODAL, /TRUST_BADGES = \[/);
  assert.match(PRICING_MODAL, /Secure 支付/);
  assert.match(PRICING_MODAL, /100% 积分返还/);
  assert.match(PRICING_MODAL, /永久有效/);
  assert.match(PRICING_MODAL, /失败不计费/);
  assert.match(PRICING_MODAL, /pricing-modal__trust/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__trust[\\s\\S]*?grid-template-columns:' + WS + '1fr 1fr'));
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-trust"/);
});

/* ═══════ 7. 可交互支付按钮 (微信绿 + 支付宝蓝 真品牌色) ═══════ */
test('payment buttons expose real WeChat green and Alipay blue with click feedback', () => {
  assert.match(PRICING_CSS, /#07C160/);
  assert.match(PRICING_CSS, /#06AD56/);
  assert.match(PRICING_CSS, /#1677FF/);
  assert.match(PRICING_CSS, /#0958D9/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => handlePay\("wechat"\)\}/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => handlePay\("alipay"\)\}/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-btn--wechat/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-btn--alipay/);
  assert.match(PRICING_MODAL, /FaWeixin/);
  assert.match(PRICING_MODAL, /SiAlipay/);
  assert.match(PRICING_MODAL, /payFeedback === "coming-soon"/);
  assert.match(PRICING_MODAL, /payFeedback === "creating"/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-toast/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-pay-wechat"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-pay-alipay"/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__pay-btn:hover'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__pay-btn:active'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__pay-btn\\.is-pressed'));
  assert.match(PRICING_CSS, /@keyframes pricingPayPulse/);
});

/* ═══════ 8. 决策元素: 当前额度 + 价格/积分/能买到什么 ═══════ */
test('modal exposes 5 fast-decision fields per tier: price / units / what-you-get / recommend / current-balance', () => {
  assert.match(PRICING_MODAL, /pricing-modal__balance/);
  assert.match(PRICING_MODAL, /账户额度 · AI 积分/);
  assert.match(PRICING_MODAL, /pricing-modal__video-chip/);
  assert.match(PRICING_MODAL, /pricing-modal__pack-price/);
  assert.match(PRICING_MODAL, /pricing-modal__video-units/);
  assert.match(PRICING_MODAL, /formatCatalogGrant/);
  assert.match(PRICING_MODAL, /pricing-modal__video-equiv/);
  assert.match(PRICING_MODAL, /pricing-modal__pack-equiv/);
  assert.match(PRICING_MODAL, /anchored-flag/);
  assert.match(PRICING_MODAL, /ecPoints/);
});

/* ═══════ 9. 对比表格: 按量 vs 月卡礼包权益对照 ═══════ */
test('comparison table exposes 按量 vs 月卡·轻 vs 月卡·Pro', () => {
  assert.match(PRICING_MODAL, /COMPARE_ROWS = \[/);
  assert.match(PRICING_MODAL, /单条标准视频有效价/);
  assert.match(PRICING_MODAL, /免费重跑/);
  assert.match(PRICING_MODAL, /快试限次/);
  assert.match(PRICING_MODAL, /加赠积分/);
  assert.match(PRICING_MODAL, /自动续订/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__compare-table'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__compare-row--head'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__compare-row' + WSQ + '\\{' + '[\\s\\S]*?grid-template-columns:' + WS + '1\\.1fr 1fr 1fr 1fr'));
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-compare"/);
});

/* ═══════ 10. FAQ 折叠 (4 条商业化深度问答) ═══════ */
test('FAQ exposes 4 commercial-grade questions with collapse/expand interaction', () => {
  assert.match(PRICING_MODAL, /FAQ_ITEMS = \[/);
  assert.match(PRICING_MODAL, /为什么是积分制, 不是订阅制/);
  assert.match(PRICING_MODAL, /月卡礼包和单买积分包有什么区别/);
  assert.match(PRICING_MODAL, /生成失败会扣积分吗/);
  assert.match(PRICING_MODAL, /生成内容可以商用吗/);
  assert.match(PRICING_MODAL, /openFaq/);
  assert.match(PRICING_MODAL, /toggleFaq/);
  assert.match(PRICING_MODAL, /aria-expanded=\{open\}/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__faq-item\\.is-open'));
  assert.match(PRICING_CSS, /@keyframes pricingFaqReveal/);
  assert.match(PRICING_MODAL, /data-testid=\{"pricing-modal-faq-/);
});

/* ═══════ 11. 4 个 @keyframes 动效 ═══════ */
test('css defines all 4 required @keyframes (matching pricing-rebuild contract)', () => {
  assert.match(PRICING_CSS, /@keyframes pricingScaleIn/);
  assert.match(PRICING_CSS, /@keyframes pricingOrbDrift/);
  assert.match(PRICING_CSS, /@keyframes pricingPayPulse/);
  assert.match(PRICING_CSS, /@keyframes pricingFaqReveal/);
});

/* ═══════ 12. 暗色模式 ═══════ */
test('css adapts to [data-theme="dark"] selectors', () => {
  assert.match(PRICING_CSS, new RegExp('\\[data-theme="dark"\\] \\.pricing-modal'));
  assert.match(PRICING_CSS, new RegExp('\\[data-theme="dark"\\] \\.pricing-modal__video-card'));
  assert.match(PRICING_CSS, new RegExp('\\[data-theme="dark"\\] \\.pricing-modal__pack'));
  assert.match(PRICING_CSS, new RegExp('\\[data-theme="dark"\\] \\.pricing-modal__balance'));
  assert.match(PRICING_CSS, new RegExp('\\[data-theme="dark"\\] \\.pricing-modal__trust'));
});

/* ═══════ 13. 响应式: 4 档 -> 2 档 -> 1 档 ═══════ */
test('responsive grid: 4-cols -> 2-cols @ 720px -> 1-col @ 480px', () => {
  assert.match(PRICING_CSS, /@media \(max-width: 720px\)/);
  assert.match(PRICING_CSS, /@media \(max-width: 480px\)/);
  assert.match(PRICING_CSS, new RegExp('@media \\(max-width: 720px\\)[\\s\\S]*?.pricing-modal__video-grid' + WSQ + '\\{' + '[\\s\\S]*?grid-template-columns:' + WS + '1fr 1fr'));
  assert.match(PRICING_CSS, new RegExp('@media \\(max-width: 720px\\)[\\s\\S]*?.pricing-modal__pack-grid' + WSQ + '\\{' + '[\\s\\S]*?grid-template-columns:' + WS + '1fr 1fr'));
  assert.match(PRICING_CSS, new RegExp('@media \\(max-width: 480px\\)[\\s\\S]*?.pricing-modal__video-grid' + WSQ + '\\{' + '[\\s\\S]*?grid-template-columns:' + WS + '1fr'));
  assert.match(PRICING_CSS, new RegExp('@media \\(max-width: 480px\\)[\\s\\S]*?.pricing-modal__pack-grid' + WSQ + '\\{' + '[\\s\\S]*?grid-template-columns:' + WS + '1fr'));
});

/* ═══════ 14. 向后兼容 4c183cd4 时代 props + show 守卫 ═══════ */
test('keeps backward-compatible props (plans, providers, onBuy, onClose, isLogged, ecPoints, unlimited, show)', () => {
  for (const propName of ['plans', 'providers', 'onBuy', 'onClose', 'isLogged', 'ecPoints', 'unlimited', 'show']) {
    const re = new RegExp('function PricingModalRefactored\\(\\{[\\s\\S]*?' + propName + '[\\s\\S]*?\\}' + '\\)');
    assert.match(PRICING_MODAL, re, 'destructure must contain ' + propName);
  }
  assert.match(PRICING_MODAL, /plans = \[\]/);
  assert.match(PRICING_MODAL, /providers = \[\]/);
  assert.match(PRICING_MODAL, /ecPoints = 0/);
  assert.match(PRICING_MODAL, /unlimited = false/);
  assert.match(PRICING_MODAL, /show = true/);
  assert.match(PRICING_MODAL, /if \(show === false\) return null;/);
  assert.match(PRICING_MODAL, /export default function PricingModalRefactored/);
});

/* ═══════ 15. 内测味文案零泄漏 (8-30 商业化硬要求) ═══════ */
test('no internal-test, placeholder, or service-gap copy leaks into the modal', () => {
  // "通道备案中" (商业化文案, 描述支付通道接入状态) 不算内测味
  // 旧 4c183cd4 时代用词 "公司备案" 单独出现才算内测味
  const banned = [
    '>公司备案<',
    '我的设备',
    '历史迁移',
    '创作权益',
    '体验包',
    '入门包',
    '成长包',
    '暂不可购买',
    '在线支付开通前无法下单',
    '支付服务接入中',
    'paid=1',
    'paidSuccess',
    '开发者测试',
  ];
  for (const w of banned) {
    assert.ok(!PRICING_MODAL.includes(w), 'PricingModal: no "' + w + '"');
  }
});

/* ═══════ 16. api-contract.test.mjs 1199-1222 不变量 ═══════ */
test('keeps the long-standing api-contract invariants for the modal', () => {
  const pricingModalOnly = MODALS.slice(MODALS.indexOf('export function PricingModal()'));
  // 4c183cd4 时代旧 title "创作权益" 不再出现
  assert.ok(!pricingModalOnly.includes('>创作权益<'), 'no legacy 创作权益 title');
  // 新 modal title 在 PricingModalRefactored (商业化重做后, title 是 "选你的商业化档位")
  assert.ok(PRICING_MODAL.includes('选你的商业化档位'), 'new commercial title');
  // 商业化文案保留
  assert.ok(PRICING_MODAL.includes('所有创作功能共用一套 AI 积分'), 'shared points copy');
  assert.ok(PRICING_MODAL.includes('微信支付'), 'wechat pay');
  assert.ok(PRICING_MODAL.includes('支付宝'), 'alipay');
  // 不出现 "小红书 / Plog AI 积分" 跨域导流
  assert.ok(!PRICING_MODAL.includes('小红书 / Plog AI 积分'), 'no plog cross-sell');
  // 不出现 SKU/服务端/幂等
  assert.ok(!PRICING_MODAL.includes('套餐 SKU'));
  assert.ok(!PRICING_MODAL.includes('支付通道'));
  assert.ok(!PRICING_MODAL.includes('服务端'));
  assert.ok(!PRICING_MODAL.includes('实时报价'));
  assert.ok(!PRICING_MODAL.includes('幂等'));
  // api-contract 1181-1227 兼容 (teal token 仍出现在 CSS 里)
  assert.ok(PRICING_CSS.includes('#0f766e') || PRICING_CSS.includes('#14b8a6'), 'gradient teal token');
});

/* ═══════ 17. 与 Modals.jsx 集成 (5b4cd5c67 bug 不复发) ═══════ */
test('Modals.jsx still imports PricingModalRefactored with no nested bug pattern', () => {
  assert.ok(MODALS.includes("import PricingModalRefactored from './PricingModal.jsx'"), 'import preserved');
  assert.ok(MODALS.includes('<PricingModalRefactored'), 'wrapper uses PricingModalRefactored');
  const buggyPattern = /<PricingModalRefactored[\s\S]{0,400}?position: 'fixed', inset: 0, zIndex: 99999,/;
  assert.ok(!buggyPattern.test(MODALS), '5b4cd5c67 bug not regressed');
});

/* ═══════ 18. reduced motion ═══════ */
test('respects prefers-reduced-motion for all animations', () => {
  assert.match(PRICING_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(PRICING_CSS, new RegExp('@media \\(prefers-reduced-motion: reduce\\)[\\s\\S]*?animation:' + WS + 'none'));
  assert.match(PRICING_CSS, new RegExp('@media \\(prefers-reduced-motion: reduce\\)[\\s\\S]*?transform:' + WS + 'none'));
});

/* ═══════ 19. 关闭按钮 + Escape 键 ═══════ */
test('modal exposes close button and Escape key handler', () => {
  assert.match(PRICING_MODAL, /pricing-modal__close/);
  assert.match(PRICING_MODAL, /aria-label="关闭"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-close"/);
  assert.match(PRICING_MODAL, /e\.key === "Escape"/);
});

/* ═══════ 20. visual smoke: 4 个动效 + 玻璃 + 渐变边都齐 ═══════ */
test('visual smoke: glass + gradient border + 3 orbs + 4 keyframes all defined', () => {
  assert.match(PRICING_CSS, /-webkit-mask-composite:\s*xor/);
  assert.match(PRICING_CSS, /mask-composite:\s*exclude/);
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__orb--a[\\s\\S]*?99, 102, 241'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__orb--b[\\s\\S]*?236, 72, 153'));
  assert.match(PRICING_CSS, new RegExp('.pricing-modal__orb--c[\\s\\S]*?245, 158, 11'));
});
