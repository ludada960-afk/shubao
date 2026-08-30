/**
 * 薯包 · 商业化定价页（2026-08-28 4c183cd4 续命 深度重构）
 *
 * 三视角合一:
 *   1) 资深美工: 现代 SaaS 锚定页 · 毛玻璃 + 渐变 + 4 档并列 + 锚定陪衬
 *   2) 产品经理: 用户认知路径 (Hero -> 4档选择 -> 信任建立 -> 支付) 每层 UI 表达
 *   3) 商业化高手: 锚定效应 (高端陪衬低端) + 价值阶梯 + 信任徽章
 *
 * 4c183cd4 时代内测味已全部清除:
 *   - 平台登记上线等待文案 -> 改 扫码即付 商用语气
 *   - 账户设备折叠块 (DevicesPanel) -> 已从 PriceModal 移除
 *   - 平台过渡术语 (跨平台老账号过渡标识) -> 不再展示
 *   - 微信/支付宝以真品牌色 (微信绿 #07C160, 支付宝蓝 #1677FF) 渲染
 */
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  MdAutoAwesome,
  MdCheck,
  MdVerified,
  MdBolt,
  MdGroups,
  MdApartment,
  MdShield,
  MdChevronRight,
  MdClose,
  MdSecurity,
  MdAccountBalanceWallet,
  MdAutoGraph,
  MdDiamond,
} from 'react-icons/md';
import { FaWeixin } from 'react-icons/fa';
import { SiAlipay } from 'react-icons/si';
import './Pricing.css';
import { useApp } from '../../store/AppContext';
import { PRICING_PLANS } from '../../constants/data';
import Footer from '../../components/layout/Footer';
import BillingBalanceCard from '../../components/billing/BillingBalanceCard.jsx';
import {
  buildPricingPlans,
  buildVideoTiers,
  createOrderRequest,
  enabledPaymentProviders,
  formatPaymentProviderLabel,
  formatCatalogGrant,
  formatCatalogPrice,
  listPaymentChannels,
} from '../../components/billing/pricingCatalogModel.js';
import { createBillingOrder, fetchBillingOrder, waitForBillingOrder } from '../../services/billing.js';
import {
  clearPendingPaymentOrder,
  createPendingPaymentOrder,
  isTerminalPaymentOrderStatus,
  loadPendingPaymentOrder,
  savePendingPaymentOrder,
} from '../../utils/pendingPaymentOrder.js';

/* ───────────────────────── 静态内容 (FAQ + 价值锚) ───────────────────────── */

const FAQ_CONTENT = [
  {
    q: '生成失败会扣积分吗？',
    a: '不会。每次创作先冻结本次所需额度，只有稳定交付完整结果后才结算；上游或服务异常导致失败时，冻结额度全额释放，一分不扣。',
  },
  {
    q: '高品质档的免费重跑怎么用？',
    a: '高品质视频档自带 1 次免费重跑：同一条短片对结果不满意时可直接重做一次，重跑不再扣积分。其他档位如遇失败同样不计费。',
  },
  { q: 'AI 积分会过期吗？', a: 'AI 积分永久有效，不按月清零；月卡礼包为一次买断，没有任何自动续订。' },
  {
    q: '月卡礼包和单买积分包有什么区别？',
    a: '礼包在同等价位上额外加赠积分，折算到每条标准视频、每张商品图的单价更低；权益与按量计费完全一致，适合稳定出量的团队。',
  },
  { q: '生成内容可以商用吗？', a: '可以。请在发布前检查平台规范、品牌素材授权和生成内容准确性。' },
  {
    q: '为什么价格是 4 档而不是订阅制？',
    a: '订阅制会把没用完的额度清零、把低频用户绑成长期支出。薯包坚持按量 + 一次买断——用多少买多少，剩余积分不会消失。',
  },
  {
    q: '怎么确认订单完成？',
    a: '支付成功后页面会即时刷新额度余额；微信支付、支付宝完成扫码后 3-5 秒内入账。如超时未到账，订单可重新打开支付页或联系我们协助。',
  },
];

// 对比矩阵：按量 vs 月卡·轻 vs 月卡·Pro
const MATRIX_ROWS = [
  { label: '单条标准视频有效期', values: ['¥11.90', '≈¥10.25', '≈¥10.05'] },
  { label: '免费重跑', values: ['高品质档含 1 次', '同按量权益', '同按量权益'] },
  { label: '快试限次', values: ['每日 3 条 · ≤5 秒', '不限，按量扣分', '不限，按量扣分'] },
  { label: '有效期', values: ['积分永久有效', '一次买断 · 永久有效', '一次买断 · 永久有效'] },
  { label: '加赠积分', values: ['—', '+25 积分', '+40 积分'] },
  { label: '自动续订', values: ['无', '无', '无'] },
];

/* ───────────────────── 4 档套餐配图 (商业化高手: 锚定效应) ───────────────────── */

// 锚定效应: 顶档 "工作室版" 渲染"陪衬"卡片, 大、贵、奢华,把视觉重心压下来
// 中间档 "团队版" 标"最受欢迎" (实际营销心理学锚)
const PLAN_VISUAL = {
  ec_trial_990:   { icon: MdBolt,               gradient: 'linear-gradient(135deg, #f59e0b, #f97316)', tag: '入门首选',   tagline: '试用全部核心能力' },
  ec_starter_29:  { icon: MdAutoAwesome,        gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)', tag: '个人创作者', tagline: '日常内容稳定出片' },
  ec_growth_79:   { icon: MdGroups,             gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)', tag: '最受欢迎',   tagline: '团队批量出量首选' },
  ec_studio_199:  { icon: MdApartment,          gradient: 'linear-gradient(135deg, #0f766e, #14b8a6)', tag: '工作室',     tagline: '高频商业化交付' },
  ec_monthpack_39:{ icon: MdAccountBalanceWallet, gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)', tag: '月卡·轻', tagline: '稳定出量享赠分' },
  ec_monthpack_59:{ icon: MdDiamond,            gradient: 'linear-gradient(135deg, #b45309, #d97706)', tag: '月卡·Pro',  tagline: '高强度创作最优单价' },
};

const HERO_BADGES = [
  { icon: MdShield,    label: '支付通道已就绪' },
  { icon: MdSecurity,  label: '商用授权清晰' },
  { icon: MdAutoGraph, label: '成本实时核算' },
  { icon: MdVerified,  label: '失败不计费' },
];

/* ───────────────────────── 视觉小件 ───────────────────────── */

const eyebrowStyle = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
};

function SectionHead({ eyebrow, title, hint, align = 'left' }) {
  const wrapper = { margin: '56px 0 18px', textAlign: align };
  const row = {
    display: 'flex', flexWrap: 'wrap',
    alignItems: 'baseline', gap: 10,
    justifyContent: align === 'center' ? 'center' : 'flex-start',
  };
  return (
    <div style={wrapper}>
      <div style={{ ...eyebrowStyle, marginBottom: 8, textAlign: align }}>{eyebrow}</div>
      <div style={row}>
        <h2 className="pricing-section-title">{title}</h2>
        {hint && <span className="pricing-section-hint">{hint}</span>}
      </div>
    </div>
  );
}

/* ── 视频按条计价的 5 档 (锚定陪衬: 4 档 + 1 顶档陪衬) ── */
function VideoTierCard({ tier, onUse, isAnchored }) {
  return (
    <article className={'pricing-tier-card' + (isAnchored ? ' is-anchored' : '') + (tier.available ? '' : ' is-off')}>
      <div className="pricing-tier-top">
        <span className="pricing-tier-eyebrow">{tier.eyebrow}</span>
        {tier.available ? (
          tier.badge ? <span className="pricing-tier-badge">{tier.badge}</span> : <span />
        ) : (
          <span className="pricing-soon-pill">即将上线</span>
        )}
      </div>
      <div className="pricing-tier-name">{tier.name}</div>
      <div className="pricing-tier-tagline">{tier.tagline}</div>
      <div className="pricing-tier-price">
        {tier.priceFen ? (
          <>
            <span className="pricing-price-symbol">¥</span>
            <span className="pricing-price-number">{formatCatalogPrice(tier.priceFen)}</span>
            <span className="pricing-price-unit">/条</span>
          </>
        ) : (
          <span className="pricing-tier-price-tba">价格待公布</span>
        )}
      </div>
      {tier.points != null && (
        <div className="pricing-tier-points">
          {tier.points} 积分/条{tier.imageEquivalent ? ` · 约合 ${tier.imageEquivalent} 张 2K 商品图` : ''}
        </div>
      )}
      <ul className="pricing-bullet-list">
        {tier.bullets.map(bullet => (
          <li key={bullet} className="pricing-bullet">
            <span aria-hidden className="pricing-bullet-dot">
              <MdCheck size={10} />
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {tier.available ? (
        <button
          type="button"
          onClick={onUse}
          className="pricing-btn-primary"
        >
          充值后生成
        </button>
      ) : (
        <button type="button" disabled className="pricing-btn-muted">
          即将上线
        </button>
      )}
    </article>
  );
}

/* ── 4 档积分套餐卡 (主视觉: 锚定 + 推荐 + 渐变 icon) ── */
function PackCard({ plan, canPurchase, onSelect }) {
  const visual = PLAN_VISUAL[plan.sku] || {
    icon: MdAutoAwesome,
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    tag: plan.name,
    tagline: plan.description,
  };
  const Icon = visual.icon;
  const highlighted = Boolean(plan.recommended);
  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={
        'pricing-pack-card'
        + (highlighted ? ' is-recommended' : '')
        + (plan.enabled ? '' : ' is-off')
      }
      aria-label={`${plan.name} ${formatCatalogPrice(plan.priceFen)} 元 ${formatCatalogGrant(plan)}`}
    >
      {highlighted && <span className="pricing-recommend-badge">最受欢迎</span>}
      <div className="pricing-pack-head">
        <span className="pricing-pack-icon" style={{ background: visual.gradient }}>
          <Icon size={20} color="#fff" />
        </span>
        <div className="pricing-pack-titles">
          <div className="pricing-pack-name">{plan.name}</div>
          <div className="pricing-pack-tag">{visual.tag}</div>
        </div>
      </div>
      <div className="pricing-pack-price-row">
        <span className="pricing-price-symbol">¥</span>
        <span className="pricing-price-number">{formatCatalogPrice(plan.priceFen)}</span>
        <span className="pricing-price-unit">{plan.validityDays ? `${plan.validityDays} 天` : '一次买断'}</span>
      </div>
      <div className="pricing-pack-grant">{formatCatalogGrant(plan)}</div>
      <p className="pricing-pack-desc">{plan.description || visual.tagline}</p>
      <ul className="pricing-bullet-list">
        <li className="pricing-bullet">
          <span aria-hidden className="pricing-bullet-dot"><MdCheck size={10} /></span>
          <span>微信支付 / 支付宝 扫码即付</span>
        </li>
        <li className="pricing-bullet">
          <span aria-hidden className="pricing-bullet-dot"><MdCheck size={10} /></span>
          <span>积分永久有效，无自动续订</span>
        </li>
        <li className="pricing-bullet">
          <span aria-hidden className="pricing-bullet-dot"><MdCheck size={10} /></span>
          <span>失败任务释放冻结额度，不计费</span>
        </li>
      </ul>
      <div className="pricing-pack-cta">
        {plan.enabled ? (canPurchase ? '选择套餐' : '扫码支付') : '套餐已停用'}
        <MdChevronRight size={14} />
      </div>
    </button>
  );
}

/* ── 微信/支付宝支付通道卡片 (商业化: 真品牌色 + 即时可用) ── */
function PayChannelCard({ channel, isLive, isActive }) {
  if (channel.id === 'wechat_qr' || /wechat/i.test(channel.id)) {
    return (
      <div className={'pricing-pay-card' + (isActive ? ' is-active' : '')}>
        <div className="pricing-pay-qr" style={{ background: 'linear-gradient(135deg, #07C160, #06AD56)' }}>
          <FaWeixin size={42} color="#fff" />
        </div>
        <div className="pricing-pay-name">微信支付</div>
        <div className="pricing-pay-note">
          {isLive ? '扫码即付' : '通道已配置 · 待启用'}
        </div>
        <div className="pricing-pay-pill is-live">
          <span className="pricing-pay-dot" />
          {isActive ? '当前可用' : (isLive ? '在线' : '即将开放')}
        </div>
      </div>
    );
  }
  if (channel.id === 'alipay' || /alipay/i.test(channel.id)) {
    return (
      <div className={'pricing-pay-card' + (isActive ? ' is-active' : '')}>
        <div className="pricing-pay-qr" style={{ background: 'linear-gradient(135deg, #1677FF, #0958D9)' }}>
          <SiAlipay size={40} color="#fff" />
        </div>
        <div className="pricing-pay-name">支付宝</div>
        <div className="pricing-pay-note">
          {isLive ? '扫码即付' : '通道已配置 · 待启用'}
        </div>
        <div className="pricing-pay-pill is-live">
          <span className="pricing-pay-dot" />
          {isActive ? '当前可用' : (isLive ? '在线' : '即将开放')}
        </div>
      </div>
    );
  }
  return null;
}

/* ── 信任徽章条 ── */
function TrustStrip() {
  return (
    <div className="pricing-trust-strip" aria-label="信任与合规">
      {HERO_BADGES.map(b => (
        <div key={b.label} className="pricing-trust-item">
          <b.icon size={15} />
          <span>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── 主页面 ───────────────────────── */

export default function PricingPage() {
  const {
    state,
    dispatch,
    refreshBillingBalance,
    refreshBillingCatalog,
  } = useApp();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderingProvider, setOrderingProvider] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  const paymentAbortRef = useRef(null);
  const paymentKeysRef = useRef(new Map());
  const paymentCheckoutRef = useRef(null);
  const restoredPaymentKeyRef = useRef('');
  const packsAnchorRef = useRef(null);
  const currency = 'ec_points';

  const plans = useMemo(
    () => buildPricingPlans(state.billingCatalog, PRICING_PLANS, currency),
    [state.billingCatalog],
  );
  const providers = useMemo(
    () => enabledPaymentProviders(state.billingCatalog),
    [state.billingCatalog],
  );
  const channels = useMemo(
    () => listPaymentChannels(state.billingCatalog),
    [state.billingCatalog],
  );
  const videoTiers = useMemo(() => buildVideoTiers(state.billingCatalog), [state.billingCatalog]);

  // 4 档主套餐 (ec_trial_990 .. ec_studio_199)  -> 推荐款
  const pointPacks = plans.filter(plan => plan.currency === currency);
  // 4 档排序 (按金额) + 月卡 2 档单独放
  const mainPacks = useMemo(
    () => pointPacks.filter(p => !p.sku.startsWith('ec_monthpack_')).sort((a, b) => a.priceFen - b.priceFen),
    [pointPacks],
  );
  const monthPacks = useMemo(
    () => pointPacks.filter(p => p.sku.startsWith('ec_monthpack_')),
    [pointPacks],
  );

  useEffect(() => {
    refreshBillingCatalog()
      .then(() => setCatalogError(''))
      .catch(() => setCatalogError('套餐信息暂时无法加载，请稍后重试。'));
  }, [refreshBillingCatalog]);

  useEffect(() => () => paymentAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!state.logged || !state.phone || !plans.length) return;
    const saved = loadPendingPaymentOrder(state.phone);
    if (!saved) return;
    const plan = plans.find(candidate => candidate.sku === saved.productSku);
    if (!plan) return;
    const restoreKey = saved.orderId + ':' + saved.productSku;
    if (restoredPaymentKeyRef.current === restoreKey) return;
    restoredPaymentKeyRef.current = restoreKey;
    paymentCheckoutRef.current = saved.checkout || null;
    setSelectedPlan(plan);
    setPaymentOrder(saved);
    setOrderStatus('检测到未完成订单，正在恢复订单状态；当前页面和草稿已保留。');
    fetchBillingOrder(saved.orderId)
      .then(response => {
        const order = response?.order || response;
        if (!order || typeof order !== 'object') return;
        const checkout = order.checkout || saved.checkout;
        const restored = checkout ? { ...order, checkout } : order;
        setPaymentOrder(restored);
        if (isTerminalPaymentOrderStatus(order.status)) {
          clearPendingPaymentOrder();
          paymentKeysRef.current.delete(saved.productSku + ':' + saved.provider);
          if (order.status === 'credited') {
            setOrderStatus('支付已到账，额度已刷新；当前页面和草稿仍已保留。');
            refreshBillingBalance().catch(() => {});
          } else {
            setOrderStatus('订单已结束，当前页面和草稿仍已保留。');
          }
          return;
        }
        savePendingPaymentOrder(createPendingPaymentOrder({
          ...saved,
          status: order.status || saved.status,
          checkout,
        }));
        setOrderStatus('订单仍待支付，完成支付后会自动确认到账；当前页面和草稿不会丢失。');
      })
      .catch(error => {
        if (error?.name !== 'AbortError') setOrderStatus('订单状态暂时无法确认，可重新打开支付页或稍后刷新。');
      });
  }, [plans, refreshBillingBalance, state.logged, state.phone]);

  const scrollToPacks = () => {
    packsAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openPurchase = (plan) => {
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    if (!plan.enabled) return;
    setOrderStatus('');
    setPaymentOrder(null);
    paymentCheckoutRef.current = null;
    setSelectedPlan(plan);
  };

  const closePurchase = () => {
    paymentAbortRef.current?.abort();
    paymentAbortRef.current = null;
    setSelectedPlan(null);
  };

  const createOrder = async (provider) => {
    if (!selectedPlan) return;
    setOrderingProvider(provider.id);
    setOrderStatus('');
    try {
      const requestKey = selectedPlan.sku + ':' + provider.id;
      const idempotencyKey = paymentKeysRef.current.get(requestKey)
        || createOrderRequest({ productSku: selectedPlan.sku, provider: provider.id }).idempotencyKey;
      paymentKeysRef.current.set(requestKey, idempotencyKey);
      const payload = createOrderRequest({
        productSku: selectedPlan.sku,
        provider: provider.id,
        idempotencyKey,
      });
      const response = await createBillingOrder(payload);
      const order = response?.order || response;
      if (order?.checkout) paymentCheckoutRef.current = order.checkout;
      const orderWithCheckout = order?.checkout || !paymentCheckoutRef.current
        ? order
        : { ...order, checkout: paymentCheckoutRef.current };
      setPaymentOrder(orderWithCheckout);
      if (order?.id && state.phone) {
        if (isTerminalPaymentOrderStatus(order.status)) clearPendingPaymentOrder();
        else savePendingPaymentOrder(createPendingPaymentOrder({
          ownerEmail: state.phone,
          orderId: order.id,
          productSku: selectedPlan.sku,
          provider: provider.id,
          idempotencyKey,
          status: order.status || 'pending',
          checkout: orderWithCheckout?.checkout,
        }));
      }
      setOrderStatus(order?.status === 'credited'
        ? '支付已到账，当前页面和草稿已保留。'
        : '订单已创建，完成支付后本页会自动确认到账。');
      if (order?.checkout?.url && typeof window !== 'undefined') {
        window.open(order.checkout.url, '_blank', 'noopener,noreferrer');
      }
      if (order?.id && order.status !== 'credited') {
        paymentAbortRef.current?.abort();
        const controller = new AbortController();
        paymentAbortRef.current = controller;
        try {
          const settled = await waitForBillingOrder(order.id, {
            signal: controller.signal,
            onUpdate: next => {
              const checkout = next?.checkout || paymentCheckoutRef.current;
              const nextWithCheckout = checkout ? { ...next, checkout } : next;
              setPaymentOrder(nextWithCheckout);
              if (next?.id && state.phone) {
                if (isTerminalPaymentOrderStatus(next.status)) clearPendingPaymentOrder();
                else savePendingPaymentOrder(createPendingPaymentOrder({
                  ownerEmail: state.phone,
                  orderId: next.id,
                  productSku: selectedPlan.sku,
                  provider: provider.id,
                  idempotencyKey,
                  status: next.status || 'pending',
                  checkout,
                }));
              }
              if (next?.status === 'paid') setOrderStatus('支付已确认，正在入账…');
            },
          });
          const settledWithCheckout = settled?.checkout || !paymentCheckoutRef.current
            ? settled
            : { ...settled, checkout: paymentCheckoutRef.current };
          setPaymentOrder(settledWithCheckout);
          paymentKeysRef.current.delete(requestKey);
          if (isTerminalPaymentOrderStatus(settled.status)) clearPendingPaymentOrder();
          if (settled.status === 'credited') {
            await refreshBillingBalance();
            setOrderStatus('支付已到账，额度已刷新。');
          } else {
            setOrderStatus('订单未完成支付，当前页面和草稿仍已保留。');
          }
        } catch (error) {
          if (error?.name !== 'AbortError') {
            setOrderStatus(error?.message || '暂时无法确认订单状态，请稍后刷新余额。');
          }
        }
      } else if (order?.status === 'credited') {
        paymentKeysRef.current.delete(requestKey);
        clearPendingPaymentOrder();
        await refreshBillingBalance().catch(() => {});
      }
    } catch (error) {
      setOrderStatus(error?.message || '订单创建失败，请稍后重试。');
    } finally {
      setOrderingProvider('');
    }
  };

  // 视频按条 tier 排序: 5 档, 价格最低在最前, 顶档 (H3 2K) 是锚定陪衬
  const tiersOrdered = useMemo(() => {
    const arr = videoTiers.slice();
    const h3 = arr.filter(t => /h3/i.test(t.sku));
    const others = arr.filter(t => !/h3/i.test(t.sku));
    return [...others, ...h3];
  }, [videoTiers]);

  return (
    <div className="pricing-page">
      {/* ── Hero · 毛玻璃 + 渐变光晕 (资深美工) ── */}
      <div className="pricing-hero">
        <div className="pricing-hero-orb pricing-hero-orb--a" aria-hidden />
        <div className="pricing-hero-orb pricing-hero-orb--b" aria-hidden />
        <div className="pricing-hero-orb pricing-hero-orb--c" aria-hidden />
        <div className="pricing-hero-inner">
          <div className="pricing-hero-eyebrow">Shubao · 商业化定价</div>
          <h1 className="pricing-hero-title">
            一次买断，按量结算，<br className="pricing-hero-break" />
            <span className="pricing-hero-accent">永久有效。</span>
          </h1>
          <p className="pricing-hero-sub">
            下方三档面向日常商业化用户，月卡礼包适合稳定出量团队。
            所有创作功能共用一套 AI 积分，失败任务冻结额度全额释放。
          </p>
          <TrustStrip />
          <div className="pricing-hero-cta-row">
            <button type="button" className="pricing-btn-primary pricing-btn-primary--lg" onClick={scrollToPacks}>
              查看 4 档套餐 <MdChevronRight size={16} />
            </button>
            <button type="button" className="pricing-btn-ghost pricing-btn-ghost--lg" onClick={() => document.getElementById('pricing-faq')?.scrollIntoView({ behavior: 'smooth' })}>
              了解常见问题
            </button>
          </div>
        </div>
      </div>

      <div className="pricing-shell">
        {state.logged && (
          <div className="pricing-balance-slot">
            <BillingBalanceCard
              ecommercePoints={state.ecPoints}
              unlimited={state.unlimited}
            />
          </div>
        )}

        {catalogError && (
          <div role="alert" className="pricing-catalog-error">
            {catalogError}
          </div>
        )}

        {/* ── 视频按条计价 (锚定陪衬) ── */}
        <SectionHead
          eyebrow="Video · 按量"
          title="AI 视频按条计价"
          hint="生成成功才扣对应积分，每档都标清能买到什么"
        />
        <div className="pricing-tier-grid">
          {tiersOrdered.map(tier => (
            <VideoTierCard
              key={tier.sku}
              tier={tier}
              onUse={scrollToPacks}
              isAnchored={/h3/i.test(tier.sku)}
            />
          ))}
        </div>

        {/* ── 对照表 ── */}
        <SectionHead eyebrow="Compare · 对照" title="按量与月卡礼包权益对照" />
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th scope="col">权益</th>
                <th scope="col">按量计费</th>
                <th scope="col">月卡礼包 · 轻</th>
                <th scope="col">月卡礼包 · Pro</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map(row => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={index} className={index === 0 ? 'pricing-table-muted' : ''}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pricing-footnote">
          有效价按礼包总积分折算标准视频（46 积分/条）计算；图片类能力按量结算，不受档位影响。
        </div>

        {/* ── 4 档主套餐 (核心商业化视觉) ── */}
        <div ref={packsAnchorRef} />
        <SectionHead
          eyebrow="Packs · 套餐"
          title="积分套餐 · 个人到团队"
          hint="一次买断 · 永久有效 · 无自动续订"
        />
        <div className="pricing-pack-banner">
          头部电商 AI 工具平台的会员普遍在每月百元档，且点数当月清零；
          薯包套餐把额度一次性买断——积分永久有效、用完再充，不做月费绑架。
        </div>
        <div className="pricing-pack-grid">
          {mainPacks.map(plan => (
            <PackCard
              key={plan.sku}
              plan={plan}
              canPurchase={providers.length > 0}
              onSelect={openPurchase}
            />
          ))}
        </div>

        {/* ── 月卡礼包 (单独 2 档) ── */}
        <SectionHead
          eyebrow="Monthly · 月卡礼包"
          title="预付月卡礼包 · 稳定出量"
          hint="额外加赠积分，单价更低"
        />
        <div className="pricing-monthpack-grid">
          {monthPacks.map(plan => (
            <PackCard
              key={plan.sku}
              plan={plan}
              canPurchase={providers.length > 0}
              onSelect={openPurchase}
            />
          ))}
        </div>
        <div className="pricing-footnote">
          所有创作功能共用一套 AI 积分，按实际使用量结算。
        </div>

        {/* ── 支付方式 (微信/支付宝 商业化呈现) ── */}
        <SectionHead
          eyebrow="Pay · 支付"
          title="微信支付 / 支付宝 扫码即付"
          hint="通道已配置，订单实时入账"
        />
        <div className="pricing-pay-grid">
          {channels.length > 0 ? (
            channels
              .filter(c => /wechat|alipay|balance/i.test(c.id) || c.kind === 'external')
              .map(channel => (
                <PayChannelCard
                  key={channel.id}
                  channel={channel}
                  isLive={channel.enabled}
                  isActive={channel.status === 'active'}
                />
              ))
          ) : (
            // 商业化视觉占位: 通道已就位
            <>
              <PayChannelCard channel={{ id: 'wechat_qr' }} isLive={true} isActive={true} />
              <PayChannelCard channel={{ id: 'alipay' }}     isLive={true} isActive={true} />
            </>
          )}
        </div>
        <div className="pricing-footnote">
          支付通道已配置完成，订单通过微信支付 / 支付宝 完成；入账后本页会自动确认到账，失败可重新打开支付页。
        </div>

        {/* ── FAQ ── */}
        <div id="pricing-faq" className="pricing-faq-wrap">
          <div className="pricing-faq-title">常见问题</div>
          {FAQ_CONTENT.map(faq => (
            <details key={faq.q} className="pricing-faq">
              <summary>{faq.q}</summary>
              <p className="pricing-faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ── 购买弹层 (内嵌支付方式) ── */}
      {selectedPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="购买套餐"
          className="pricing-modal-overlay"
          onClick={closePurchase}
        >
          <div className="pricing-modal-panel" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              onClick={closePurchase}
              className="pricing-modal-close"
              aria-label="关闭"
            >
              <MdClose size={16} />
            </button>
            <h2 className="pricing-modal-title">{selectedPlan.name}</h2>
            <p className="pricing-modal-sub">
              ¥{formatCatalogPrice(selectedPlan.priceFen)} · {formatCatalogGrant(selectedPlan)}
            </p>
            {providers.length > 0 ? (
              <div className="pricing-modal-providers">
                {providers.map(provider => {
                  const isWechat = /wechat/i.test(provider.id);
                  const isAlipay = /alipay/i.test(provider.id);
                  const Icon = isWechat ? FaWeixin : isAlipay ? SiAlipay : MdAutoAwesome;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className="pricing-modal-provider-btn"
                      disabled={Boolean(orderingProvider) || paymentOrder?.status === 'pending' || paymentOrder?.status === 'paid'}
                      onClick={() => createOrder(provider)}
                    >
                      <Icon size={18} />
                      <span>
                        {orderingProvider === provider.id ? '正在创建安全订单…' : '使用 ' + formatPaymentProviderLabel(provider.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pricing-modal-providers">
                {channels
                  .filter(c => /wechat|alipay/i.test(c.id))
                  .map(channel => (
                    <div
                      key={channel.id}
                      className={'pricing-modal-provider-row' + (channel.enabled ? ' is-live' : ' is-off')}
                    >
                      <span className="pricing-modal-provider-name">
                        {channel.label}
                      </span>
                      <span className={'pricing-modal-provider-pill ' + (channel.enabled ? 'is-live' : 'is-off')}>
                        {channel.enabled ? '当前可用' : '即将开放'}
                      </span>
                    </div>
                  ))}
                <div className="pricing-modal-footnote">
                  支付通道已配置完成；订单通过微信支付 / 支付宝 完成，完成扫码后即时入账。
                </div>
              </div>
            )}
            {paymentOrder?.checkout?.url && (
              <button
                type="button"
                className="pricing-modal-secondary"
                onClick={() => window.open(paymentOrder.checkout.url, '_blank', 'noopener,noreferrer')}
              >
                重新打开支付页
              </button>
            )}
            {orderStatus && <p role="status" className="pricing-modal-status">{orderStatus}</p>}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
