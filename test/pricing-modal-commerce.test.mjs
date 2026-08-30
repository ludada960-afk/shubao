/**
 * 灵图风格 PricingModal 视觉 & 交互契约测试 (8-31 重构)
 *
 * 用户 8-30 反馈 + 8-31 重构指令:
 *   - 一套收费标准 (视频+图片共用 AI 积分, 不做两套分档)
 *   - 约数表达 (不写死"X 张图", 写"约 X 张")
 *   - 弹窗要大 (880px), 有空间感, 有主次
 *   - 标题面向最终用户 (不再"商业化档位")
 *   - 关闭按钮失效, 选中态残留, 积分不显示 - 全部修复
 *
 * 设计基准: 灵图 AI (月度套餐 / 永久积分包 双tab, 价格升序 4 档, 推荐档黑色 CTA)
 *
 * 验证深度:
 *   1. 玻璃拟态 + 渐变光晕 orbs
 *   2. 双 Tab: 永久积分包 / 月卡套餐
 *   3. 锚定效应: 专业包居中放大 + 黑色 CTA
 *   4. 价值阶梯: 4 档永久 + 2 档月卡, 升序
 *   5. 一套收费: 视频和图片共用 AI 积分 (约数表达)
 *   6. 可交互支付按钮 (微信绿 + 支付宝蓝 真品牌色)
 *   7. 当前积分永远显示 (未登录也显示引导)
 *   8. 关闭按钮 + Escape 键
 *   9. 切换 tab 自动重置选中 (防残留)
 *  10. 响应式 4 列 -> 2 列 -> 1 列
 *  11. 标题面向用户, 不再直白"商业化档位"
 *  12. 弹窗尺寸 880px (从 720 扩)
 *  13. 向后兼容 4c183cd4 时代 props + show 守卫
 *  14. 内测味文案零泄漏
 *  15. api-contract 不变量
 *  16. Modals.jsx 集成不变量
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

/* ═══════ 1. 玻璃拟态 + 渐变光晕 orbs ═══════ */
test('pricing modal root has glassmorphism + gradient orbs decoration', () => {
  assert.match(PRICING_CSS, /\.pricing-modal\s*[\s\S]*?backdrop-filter:\s*blur/);
  assert.match(PRICING_CSS, /saturate\(180%\)/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--a/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--b/);
  assert.ok(PRICING_CSS.includes('99, 102, 241'), 'indigo rgb in css');
  assert.ok(PRICING_CSS.includes('236, 72, 153'), 'pink rgb in css');
});

/* ═══════ 2. 双 Tab: 永久积分包 / 月卡套餐 (灵图风格) ═══════ */
test('pricing modal exposes dual tab toggle with role=tablist', () => {
  assert.match(PRICING_MODAL, /role="tablist"/);
  assert.match(PRICING_MODAL, /role="tab"/);
  assert.match(PRICING_MODAL, /aria-selected=\{activeTab === "permanent"\}/);
  assert.match(PRICING_MODAL, /aria-selected=\{activeTab === "monthly"\}/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-permanent"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-monthly"/);
  assert.match(PRICING_MODAL, /data-tab=\{activeTab\}/);
  assert.match(PRICING_CSS, /\.pricing-modal__tab--active/);
});

/* ═══════ 3. 锚定效应: 专业包 (starter) 居中放大 + 黑色 CTA ═══════ */
test('永久积分包 专业包 (starter) is anchored with 推荐 flag and scale up', () => {
  assert.match(PRICING_MODAL, /id: "starter"[\s\S]*?recommended: true/);
  assert.match(PRICING_MODAL, /pricing-modal__pack--anchored/);
  assert.match(PRICING_MODAL, /pricing-modal__pack-flag/);
  assert.match(PRICING_MODAL, /<MdStar[\s\S]*?\/>\s*推荐/);
  assert.match(PRICING_CSS, /\.pricing-modal__pack--anchored\s*\{[\s\S]*?translateY\(-4px\)\s*scale\(1\.03\)/);
  assert.match(PRICING_CSS, /\.pricing-modal__pack-cta--anchored\s*\{[\s\S]*?linear-gradient\(135deg, #1f2937/);
});

/* ═══════ 4. 价值阶梯: 4 档永久 + 2 档月卡, 价格升序 ═══════ */
test('永久积分包 4 档升序 (9.9/29/79/199), 月卡 2 档', () => {
  assert.match(PRICING_MODAL, /PERMANENT_PACKS = \[/);
  assert.match(PRICING_MODAL, /price: 9\.9/);
  assert.match(PRICING_MODAL, /price: 29/);
  assert.match(PRICING_MODAL, /price: 79/);
  assert.match(PRICING_MODAL, /price: 199/);
  assert.match(PRICING_MODAL, /MONTHLY_PACKS = \[/);
  assert.match(PRICING_MODAL, /id: "month_light"[\s\S]*?price: 39/);
  assert.match(PRICING_MODAL, /id: "month_pro"[\s\S]*?price: 59/);
});

/* ═══════ 5. 一套收费: 视频+图片共用积分, 约数表达 ═══════ */
test('积分体系共用: 视频和图片共用 AI 积分, 用约数表达', () => {
  assert.match(PRICING_MODAL, /POINTS_PER_IMAGE/);
  assert.match(PRICING_MODAL, /POINTS_PER_VIDEO/);
  assert.match(PRICING_MODAL, /approxImages/);
  assert.match(PRICING_MODAL, /approxVideos/);
  assert.match(PRICING_MODAL, /约.*张图.*约.*条视频/);
  /* 不写死绝对张数 */
  assert.ok(!PRICING_MODAL.includes('30 张 2K'), 'no hardcoded 30 张 2K');
  assert.ok(!PRICING_MODAL.includes('60 张 2K'), 'no hardcoded 60 张 2K');
});

/* ═══════ 6. 可交互支付按钮 (微信绿 + 支付宝蓝) ═══════ */
test('payment buttons expose WeChat green and Alipay blue with click feedback', () => {
  assert.match(PRICING_CSS, /#07C160/);
  assert.match(PRICING_CSS, /#06AD56/);
  assert.match(PRICING_CSS, /#1677FF/);
  assert.match(PRICING_CSS, /#0E5DD9/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => handlePay\("wechat"\)\}/);
  assert.match(PRICING_MODAL, /onClick=\{\(\) => handlePay\("alipay"\)\}/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-btn--wechat/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-btn--alipay/);
  assert.match(PRICING_MODAL, /FaWeixin/);
  assert.match(PRICING_MODAL, /SiAlipay/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-pay-wechat"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-pay-alipay"/);
  assert.match(PRICING_CSS, /\.pricing-modal__pay-btn\.is-pressed/);
  assert.match(PRICING_CSS, /\.pricing-modal__pay-btn:hover/);
});

/* ═══════ 7. 当前积分永远显示 (未登录也显示引导) ═══════ */
test('当前积分永远显示: 未登录显示引导, 登录显示 ecPoints', () => {
  assert.match(PRICING_MODAL, /pricing-modal__balance/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-balance"/);
  assert.match(PRICING_MODAL, /pricing-modal__balance-login/);
  assert.match(PRICING_MODAL, /isLogged/);
  /* 无 isLogged 守卫包裹整个 balance - 未登录也渲染 */
  assert.ok(!/\{isLogged\s*&&\s*\(\s*\n?\s*<div className="pricing-modal__balance"/.test(PRICING_MODAL), 'no isLogged guard wrapping balance');
});

/* ═══════ 8. 关闭按钮 + Escape 键 ═══════ */
test('modal exposes close button and Escape key handler', () => {
  assert.match(PRICING_MODAL, /pricing-modal__close/);
  assert.match(PRICING_MODAL, /aria-label="关闭"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-close"/);
  assert.match(PRICING_MODAL, /e\.key === "Escape"/);
});

/* ═══════ 9. 切换 tab 自动重置选中 (防残留 bug) ═══════ */
test('handleTabChange resets selectedId + payProvider to avoid residue across tabs', () => {
  assert.match(PRICING_MODAL, /handleTabChange/);
  assert.match(PRICING_MODAL, /setSelectedId\(tab === "permanent" \? "starter" : "month_light"\)/);
  assert.match(PRICING_MODAL, /setPayProvider\(null\)/);
  /* pay 兜底超时, 30s 后自动清 payProvider 防 is-pressed 永久残留 */
  assert.match(PRICING_MODAL, /30000/);
});

/* ═══════ 10. 响应式: 4 列 -> 2 列 -> 1 列 ═══════ */
test('responsive grid: 4-cols -> 2-cols @ 760px -> 1-col @ 480px', () => {
  assert.match(PRICING_CSS, /@media \(max-width: 760px\)/);
  assert.match(PRICING_CSS, /@media \(max-width: 480px\)/);
  assert.match(PRICING_CSS, /@media \(max-width: 760px\)[\s\S]*?\.pricing-modal__pack-grid[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(PRICING_CSS, /@media \(max-width: 480px\)[\s\S]*?\.pricing-modal__pack-grid[\s\S]*?grid-template-columns:\s*1fr/);
});

/* ═══════ 11. 标题面向用户, 不再直白"商业化档位" ═══════ */
test('title is user-facing: 给创作充点能量, not 商业化档位', () => {
  assert.match(PRICING_MODAL, /给创作充点能量/);
  assert.ok(!PRICING_MODAL.includes('选你的商业化档位'), 'no "商业化档位"');
  assert.ok(!PRICING_MODAL.includes('SHUBAO · 商业化定价'), 'no "商业化定价" brand text');
});

/* ═══════ 12. 弹窗尺寸: 880px (从 720 扩) ═══════ */
test('modal width 880px (修"框太小"反馈)', () => {
  assert.match(PRICING_CSS, /width: min\(880px, 96vw\)/);
  assert.ok(!PRICING_CSS.includes('width: min(720px'), 'no 720px');
});

/* ═══════ 13. 向后兼容 4c183cd4 时代 props + show 守卫 ═══════ */
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

/* ═══════ 14. 内测味文案零泄漏 ═══════ */
test('no internal-test, placeholder, or service-gap copy leaks into the modal', () => {
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

/* ═══════ 15. api-contract 不变量 ═══════ */
test('keeps the long-standing api-contract invariants for the modal', () => {
  assert.ok(!PRICING_MODAL.includes('创作权益'), 'no legacy 创作权益 title');
  assert.ok(PRICING_MODAL.includes('给创作充点能量'), 'new user-facing title');
  assert.ok(PRICING_MODAL.includes('所有创作功能共用一套 AI 积分'), 'shared points copy');
  assert.ok(PRICING_MODAL.includes('微信支付'), 'wechat pay');
  assert.ok(PRICING_MODAL.includes('支付宝'), 'alipay');
  assert.ok(!PRICING_MODAL.includes('小红书 / Plog AI 积分'), 'no plog cross-sell');
  assert.ok(!PRICING_MODAL.includes('套餐 SKU'));
  assert.ok(!PRICING_MODAL.includes('支付通道'));
  assert.ok(!PRICING_MODAL.includes('服务端'));
  assert.ok(!PRICING_MODAL.includes('实时报价'));
  assert.ok(!PRICING_MODAL.includes('幂等'));
});

/* ═══════ 16. 与 Modals.jsx 集成 (5b4cd5c67 bug 不复发) ═══════ */
test('Modals.jsx still imports PricingModalRefactored with no nested bug pattern', () => {
  assert.ok(MODALS.includes("import PricingModalRefactored from './PricingModal.jsx'"), 'import preserved');
  assert.ok(MODALS.includes('<PricingModalRefactored'), 'wrapper uses PricingModalRefactored');
  const buggyPattern = /<PricingModalRefactored[\s\S]{0,400}?position: 'fixed', inset: 0, zIndex: 99999,/;
  assert.ok(!buggyPattern.test(MODALS), '5b4cd5c67 bug not regressed');
});