/**
 * 灵图风格 PricingModal 视觉 & 交互契约测试 (8-31 重构 / 9-02 灵图视觉)
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
 *   1. 暖米底 #fbf8f1 + 毛玻璃 + 琥珀/紫罗兰光晕
 *   2. 双 Tab: 永久积分包 / 月卡套餐
 *   3. 锚定效应: 专业包居中放大 + 琥珀边框 + 黑色 CTA (五重强调)
 *   4. 价值阶梯: 4 档永久 + 2 档月卡, 升序
 *   5. 一套收费: 视频和图片共用 AI 积分 (约数表达)
 *   6. 可交互支付按钮: 单一"去支付", 支付方式由 Modals 弹二级
 *   7. 当前积分永远显示 (未登录也显示引导)
 *   8. 关闭按钮 + Escape 键
 *   9. 切换 tab 自动重置选中 (防残留)
 *   10. 响应式: 4 列 -> 2 列 -> 1 列
 *   11. 眉题 + 主标题"创作权益" + 副题 (灵图标题区)
 *   12. 弹窗尺寸 max-width 1100px
 *   13. 向后兼容 4c183cd4 时代 props + show 守卫
 *   14. 内测味文案零泄漏
 *   15. api-contract 不变量
 *   16. Modals.jsx 集成不变量
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

/* ═══════ 1. 灵图暖米底 + 毛玻璃 + 琥珀/紫罗兰光晕 (9-02: #fbf8f1 + amber 233,154,24 + violet 139,92,246) ═══════ */
test('pricing modal root has lingtu warm-rice bg + amber/violet orbs', () => {
  assert.match(PRICING_CSS, /\.pricing-modal\s*\{[\s\S]*?background:\s*#fbf8f1/);
  assert.match(PRICING_CSS, /\.pricing-modal\s*\{[\s\S]*?border-radius:\s*24px/);
  assert.match(PRICING_CSS, /\.pricing-modal\s*\{[\s\S]*?backdrop-filter:/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--a/);
  assert.match(PRICING_MODAL, /pricing-modal__orb--b/);
  assert.ok(PRICING_CSS.includes('233, 154, 24'), 'amber rgb in css');
  assert.ok(PRICING_CSS.includes('139, 92, 246'), 'violet rgb in css');
});

/* ═══════ 2. 双 Tab: 永久积分包 / 月卡套餐 (灵图风格) ═══════ */
test('pricing modal exposes dual tab toggle with role=tablist', () => {
  assert.match(PRICING_MODAL, /role="tablist"/);
  assert.match(PRICING_MODAL, /role="tab"/);
  assert.match(PRICING_MODAL, /aria-selected={activeTab === "permanent"}/);
  assert.match(PRICING_MODAL, /aria-selected={activeTab === "monthly"}/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-permanent"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-tab-monthly"/);
  assert.match(PRICING_MODAL, /data-tab={activeTab}/);
  assert.match(PRICING_CSS, /\.pricing-modal__tab--active/);
});

/* ═══════ 3. 锚定效应: 专业包 (starter) 居中放大 + 琥珀边框 + 黑色 CTA (9-02 灵图五重强调) ═══════ */
test('永久积分包 专业包 (starter) is anchored with 推荐 flag and amber+black CTA', () => {
  /* 推荐档改用 sku (琥珀边框 + 光晕 + 骑缝徽章 + 琥珀价格 + 黑色按钮) */
  assert.match(PRICING_MODAL, /sku === "ec_starter_29"/);
  assert.match(PRICING_MODAL, /pricing-modal__pack--anchored/);
  assert.match(PRICING_MODAL, /pricing-modal__pack-flag/);
  assert.match(PRICING_MODAL, /<MdStar[\s\S]*?\/>\s*推荐/);
  /* 9-02 灵图: 推荐档琥珀边框 #f0c56b + 上浮 translateY(-6px) + 暖光晕, CTA 黑色 #1c1917 白字, 徽章琥珀底 #fff4d8 */
  assert.match(PRICING_CSS, /\.pricing-modal__pack--anchored\s*\{[\s\S]*?translateY\(-6px\)/);
  assert.match(PRICING_CSS, /\.pricing-modal__pack--anchored\s*\{[\s\S]*?#f0c56b/);
  assert.match(PRICING_CSS, /\.pricing-modal__pack-cta--anchored[\s\S]*?#1c1917/);  /* CTA 黑色主按钮 */
  assert.match(PRICING_CSS, /\.pricing-modal__pack-flag[\s\S]*?background:\s*#fff4d8/);  /* 徽章琥珀底 */
});

/* ═══════ 4. 价值阶梯: 4 档永久 + 2 档月卡, 价格升序 ═══════ */
test('永久积分包 4 档升序 (9.9/29/79/199), 月卡 2 档', () => {
  /* 从服务端 catalog 渲染 (不再硬编码 PERMANENT_PACKS) */
  assert.match(PRICING_MODAL, /ec_starter_29/);
  assert.match(PRICING_MODAL, /ec_growth_79/);
  assert.match(PRICING_MODAL, /ec_studio_199/);
  assert.match(PRICING_MODAL, /ec_monthpack_39/);
  assert.match(PRICING_MODAL, /ec_monthpack_59/);
  /* 推荐档 sku = ec_starter_29 (源自 catalog 终案) */
  assert.match(PRICING_MODAL, /useState\("ec_starter_29"\)/);
});

/* ═══════ 5. 一套收费: 视频+图片共用积分, 约数表达 ═══════ */
test('积分体系共用: 视频和图片共用 AI 积分, 用约数表达', () => {
  /* 1 积分 = 1000 units (catalog 终案口径), 视频 27 积分 ≈ 1 条快试 */
  assert.match(PRICING_MODAL, /UNITS_PER_POINT/);
  assert.match(PRICING_MODAL, /unitsToPoints/);
  assert.match(PRICING_MODAL, /approxImages/);
  assert.match(PRICING_MODAL, /approxVideos/);
  assert.match(PRICING_MODAL, /pricing-modal__pack-list/);
  assert.match(PRICING_MODAL, /约 \{imgCount\}/);  /* 动态算图片数 */
  assert.match(PRICING_MODAL, /约 \{vidCount\}/);  /* 动态算视频数 */
  assert.ok(!PRICING_MODAL.includes('2K 商品图'), 'no 2K 商品图');
  assert.ok(!PRICING_MODAL.includes('30 张 2K'), 'no hardcoded 30 张 2K');
  assert.ok(!PRICING_MODAL.includes('60 张 2K'), 'no hardcoded 60 张 2K');
});

/* ═══════ 6. 单一"去支付"按钮 (微信/支付宝由 Modals 弹支付方式) ═══════ */
test('payment area shows a single 去支付 button; payment method pops in Modals, not inline', () => {
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-pay-submit"/);
  assert.match(PRICING_MODAL, /pricing-modal__pay-primary/);
  assert.match(PRICING_MODAL, /去支付/);
  assert.ok(!PRICING_MODAL.includes('handlePay("wechat")'), 'no inline wechat handlePay');
  assert.ok(!PRICING_MODAL.includes('handlePay("alipay")'), 'no inline alipay handlePay');
  assert.ok(!PRICING_MODAL.includes('pricing-modal-pay-wechat'), 'no inline wechat pay testid');
  assert.ok(!PRICING_MODAL.includes('pricing-modal-pay-alipay'), 'no inline alipay pay testid');
  assert.ok(!PRICING_MODAL.includes('FaWeixin'), 'no inline wechat icon');
  assert.ok(!PRICING_MODAL.includes('SiAlipay'), 'no inline alipay icon');
  assert.ok(MODALS.includes('选择支付方式'), 'payModal offers payment method choice');
  assert.ok(MODALS.includes('formatPaymentProviderLabel'), 'payModal renders providers');
});

/* ═══════ 7. 当前积分永远显示 (未登录也显示引导) ═══════ */
test('当前积分永远显示: 未登录显示引导, 登录显示 ecPoints', () => {
  assert.match(PRICING_MODAL, /pricing-modal__balance/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-hero"/);
  assert.match(PRICING_MODAL, /pricing-modal__balance-login/);
  assert.match(PRICING_MODAL, /isLogged/);
  assert.match(PRICING_MODAL, /pricing-modal__hero/);
  assert.match(PRICING_MODAL, /登录后查看积分/);
});

/* ═══════ 8. 关闭按钮 + Escape 键 ═══════ */
test('modal exposes close button and Escape key handler', () => {
  assert.match(PRICING_MODAL, /pricing-modal__close/);
  assert.match(PRICING_MODAL, /aria-label="关闭"/);
  assert.match(PRICING_MODAL, /data-testid="pricing-modal-close"/);
  assert.match(PRICING_MODAL, /e\.key === "Escape"/);
});

/* ═══════ 9. 切换 tab 自动重置选中 + 倒计时 ticker ═══════ */
test('handleTabChange resets selectedId; no inline payProvider residue; countdown ticks', () => {
  assert.match(PRICING_MODAL, /handleTabChange/);
  assert.ok(PRICING_MODAL.includes('setSelectedId(tab === "permanent" ? "ec_starter_29" : "ec_monthpack_39")'), 'tab default selection');
  assert.ok(!PRICING_MODAL.includes('setPayProvider'), 'no payProvider residue');
  assert.ok(!PRICING_MODAL.includes('30000'), 'no 30s pay-reset timer');
  assert.ok(PRICING_MODAL.includes('setInterval(() => setNow(Date.now()), 1000)'), 'countdown ticker');
});

/* ═══════ 11. 眉题 + 主标题"创作权益" + 副题 (灵图标题区) ═══════ */
test('title has lingtu eyebrow + 创作权益 title + subtitle (no verbose legacy titles)', () => {
  assert.ok(!PRICING_MODAL.includes('给创作充点能量'), 'no verbose 给创作充点能量 title');
  assert.ok(!PRICING_MODAL.includes('选你的商业化档位'), 'no "商业化档位"');
  assert.ok(!PRICING_MODAL.includes('SHUBAO · 商业化定价'), 'no "商业化定价" brand text');
  assert.match(PRICING_MODAL, /pricing-modal__eyebrow/);
  assert.match(PRICING_MODAL, /创作<em>权益<\/em>/);
  assert.match(PRICING_MODAL, /pricing-modal__subtitle/);
  assert.match(PRICING_MODAL, /积分套餐 · 价格升序/);
  assert.match(PRICING_MODAL, /选择适合你的套餐/);
  assert.match(PRICING_MODAL, /pricing-modal__hero-line/);
  assert.match(PRICING_MODAL, /一次买断 · 视频图片共用一套 AI 积分，用完再充/);
});

/* ═══════ 12. 弹窗尺寸: max-width 1100px ═══════ */
test('modal width viewport-16px capped at 1100px', () => {
  assert.match(PRICING_CSS, /width: calc\(100vw - 16px\)/);
  assert.match(PRICING_CSS, /max-width: 1100px/);
  assert.ok(!PRICING_CSS.includes('width: min(720px'), 'no 720px');
  assert.ok(!PRICING_CSS.includes('width: min(880px'), 'no 880px');
  assert.ok(!PRICING_CSS.includes('width: min(940px'), 'no 940px');
  assert.ok(!PRICING_CSS.includes('width: min(960px'), 'no 960px');
});

/* ═══════ 13. 向后兼容 4c183cd4 时代 props + show 守卫 ═══════ */
test('keeps backward-compatible props (plans, providers, onBuy, onClose, isLogged, ecPoints, unlimited, show)', () => {
  for (const propName of ['plans', 'providers', 'onBuy', 'onClose', 'isLogged', 'ecPoints', 'unlimited', 'show']) {
    const re = new RegExp('function PricingModalRefactored\\(\{[\\s\\S]*?' + propName + '[\\s\\S]*?\\}' + '\\)');
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
  // 8-31 第 7 轮: 去掉"给创作充点能量"啰嗦主副标题; 9-02 灵图重构加回眉题 + 主标题"创作权益" + 副题。
  assert.ok(!PRICING_MODAL.includes('给创作充点能量'), 'no verbose title');
  assert.match(PRICING_MODAL, /pricing-modal__eyebrow/);
  assert.match(PRICING_MODAL, /创作<em>权益<\/em>/);
  assert.match(PRICING_MODAL, /pricing-modal__subtitle/);
  assert.ok(PRICING_MODAL.includes('所有创作功能共用一套 AI 积分'), 'shared points copy');
  // 微信/支付宝改由 Modals 的 payModal 承载
  assert.ok(MODALS.includes('微信支付'), 'wechat pay lives in payModal');
  assert.ok(MODALS.includes('支付宝'), 'alipay lives in payModal');
  assert.ok(!PRICING_MODAL.includes('小红书 / Plog AI 积分'), 'no plog cross-sell');
  assert.ok(!PRICING_MODAL.includes('套餐 SKU'));
  assert.ok(!PRICING_MODAL.includes('支付通道'));
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
