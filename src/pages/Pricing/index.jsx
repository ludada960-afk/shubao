import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MdAutoAwesome, MdCheck } from 'react-icons/md';
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
];

// 权益矩阵（数值口径与 server/billing/catalog.mjs 终案一致）：
// 标准视频 46 积分/条；礼包轻 ¥39=175 分、Pro ¥59=270 分 → 单条有效价 ≈¥10.25 / ¥10.05。
const MATRIX_ROWS = [
  { label: '单条标准视频有效价', values: ['¥11.90', '≈¥10.25', '≈¥10.05'] },
  { label: '免费重跑', values: ['高品质档含 1 次', '同按量权益', '同按量权益'] },
  { label: '快试限次', values: ['每日 3 条 · ≤5 秒', '不限，按量扣分', '不限，按量扣分'] },
  { label: '有效期', values: ['积分永久有效', '一次买断 · 永久有效', '一次买断 · 永久有效'] },
  { label: '加赠积分', values: ['—', '+25 积分', '+40 积分'] },
  { label: '自动续订', values: ['无', '无', '无'] },
];

const sectionEyebrow = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
};

function SectionHead({ eyebrow, title, hint }) {
  return (
    <div style={{ margin: '40px 0 14px' }}>
      <div style={{ ...sectionEyebrow, marginBottom: 6 }}>{eyebrow}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>{title}</h2>
        {hint && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
    </div>
  );
}

function VideoTierCard({ tier, onUse }) {
  const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: tier.available ? '1px solid var(--border)' : '1px dashed var(--border-hover)',
    background: '#fff',
    opacity: tier.available ? 1 : 0.72,
    boxSizing: 'border-box',
  };
  return (
    <article style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
        <span style={{ ...sectionEyebrow }}>{tier.eyebrow}</span>
        {tier.badge && (
          <span style={{
            fontSize: 10,
            fontWeight: 900,
            color: 'var(--accent)',
            background: 'var(--accent-bg)',
            borderRadius: 999,
            padding: '3px 9px',
          }}
          >
            {tier.badge}
          </span>
        )}
        {!tier.available && (
          <span className="pricing-soon-pill">即将上线</span>
        )}
      </div>
      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--accent)' }}>{tier.name}</div>
      <div style={{ minHeight: 34, fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted)' }}>{tier.tagline}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {tier.priceFen ? (
          <>
            <div className="pricing-price-row">
            <span className="pricing-price-symbol">¥</span>
            <span className="pricing-price-number">{formatCatalogPrice(tier.priceFen)}</span>
            <span className="pricing-price-unit">/条</span>
          </div>
          </>
        ) : (
          <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-hint)' }}>价格待公布</span>
        )}
      </div>
      {tier.points != null && (
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
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
          style={{
            marginTop: 'auto',
            minHeight: 38,
            borderRadius: 999,
            border: '1px solid var(--accent)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          充值后生成
        </button>
      ) : (
        <button
          type="button"
          disabled
          aria-disabled="true"
          style={{
            marginTop: 'auto',
            minHeight: 38,
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--bg-hover)',
            color: 'var(--text-faint)',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          即将上线
        </button>
      )}
    </article>
  );
}

function PackCard({ plan, canPurchase, onSelect }) {
  const highlighted = Boolean(plan.recommended);
  const style = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: highlighted ? '1px solid var(--accent)' : '1px solid var(--border)',
    background: '#fff',
    boxShadow: highlighted
      ? '0 0 0 1px rgba(12, 10, 9, 0.06), 0 14px 36px rgba(57, 45, 26, 0.10)'
      : 'var(--shadow-sm)',
    boxSizing: 'border-box',
    textAlign: 'left',
    fontFamily: 'inherit',
    width: '100%',
  };
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--accent-bg)',
          flexShrink: 0,
        }}
        >
          <MdAutoAwesome size={15} color="var(--accent)" fill="var(--accent)" />
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>{plan.name}</span>
        {plan.recommended && (
          <span className="pricing-recommend-badge" style={{ position: 'static', top: 'auto', right: 'auto' }}>
            推荐
          </span>
        )}
      </div>
      <div className="pricing-price-row">
        <span className="pricing-price-symbol">¥</span>
        <span className="pricing-price-number">{formatCatalogPrice(plan.priceFen)}</span>
        <span className="pricing-price-unit">一次买断</span>
      </div>
      <div className="pricing-grant-chip">{formatCatalogGrant(plan)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.55 }}>
        {plan.description}
        {' · '}
        {plan.validityDays ? `${plan.validityDays} 天有效` : '永久有效'}
      </div>
      <div style={{
        marginTop: 'auto',
        paddingTop: 4,
        fontSize: 12,
        fontWeight: 800,
        color: plan.enabled ? 'var(--accent)' : 'var(--text-faint)',
      }}
      >
        {plan.enabled ? (canPurchase ? '选择套餐 →' : '选择支付方式') : '套餐已停用'}
      </div>
    </>
  );
  if (!plan.enabled) {
    return <article aria-disabled="true" className="pricing-card is-off" style={style}>{body}</article>;
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={'pricing-card' + (highlighted ? ' is-recommended' : '')}
      style={{ ...style, cursor: 'pointer' }}
    >
      {body}
    </button>
  );
}

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
  const pointPacks = plans.filter(plan => plan.currency === currency);

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
    // 在线通道未开放也允许进入确认层：通道状态在弹层内明示，可继续查看订单说明。
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 20px 24px' }}>
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 8 }}>Shubao · 定价</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--accent)', marginBottom: 6 }}>
            为结果付费，不为失败买单
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.7 }}>
            图片能力照旧按量计费，视频按条定价；
            所有创作功能共用一套 AI 积分，失败任务冻结额度全额释放。
          </p>
        </div>

        {state.logged && (
          <div style={{ marginBottom: 18 }}>
            <BillingBalanceCard
              ecommercePoints={state.ecPoints}
              unlimited={state.unlimited}
            />
          </div>
        )}

        {providers.length === 0 && (
          <div role="status" style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 14,
            border: '1px solid #E9C46A',
            background: '#FFF7D6',
            color: '#7A5600',
            fontSize: 13,
            lineHeight: 1.6,
          }}
          >
            <strong>支付服务接入中</strong>
            <div>在线购买暂未开放，当前可先查看套餐内容与额度。</div>
          </div>
        )}

        {catalogError && (
          <div role="alert" style={{ marginBottom: 14, color: '#B42318', fontSize: 13 }}>
            {catalogError}
          </div>
        )}

        <SectionHead
          eyebrow="Video · 按量"
          title="AI 视频按条计价"
          hint="生成成功才扣对应积分，每档都标清能买到什么"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {videoTiers.map(tier => (
            <VideoTierCard key={tier.sku} tier={tier} onUse={scrollToPacks} />
          ))}
        </div>

        <SectionHead eyebrow="Compare · 对照" title="按量与月卡礼包权益对照" />
        <div style={{
          overflowX: 'auto',
          borderRadius: 16,
          border: '1px solid var(--border)',
          background: '#fff',
        }}
        >
          <table style={{ minWidth: 640, width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 900, color: 'var(--text-primary)' }}>权益</th>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 900, color: 'var(--text-primary)' }}>按量计费</th>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 900, color: 'var(--text-primary)' }}>月卡礼包 · 轻</th>
                <th scope="col" style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 900, color: 'var(--text-primary)' }}>月卡礼包 · Pro</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map(row => (
                <tr key={row.label} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <th scope="row" style={{ textAlign: 'left', padding: '11px 16px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={index} style={{ padding: '11px 16px', color: index === 0 ? 'var(--text-muted)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          有效价按礼包总积分折算标准视频（46 积分/条）计算；图片类能力按量结算，不受档位影响。
        </div>

        <div ref={packsAnchorRef} />
        <SectionHead eyebrow="Packs · 套餐" title="积分套餐与预付月卡礼包" hint="一次买断，无自动续订" />
        <div style={{
          marginBottom: 14,
          padding: '12px 16px',
          borderRadius: 14,
          background: 'rgba(12,10,9,0.04)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          lineHeight: 1.7,
        }}
        >
          头部电商 AI 工具平台的会员普遍在每月百元档，且点数当月清零；
          薯包礼包把额度一次性买断——积分永久有效、用完再充，不做月费绑架。
        </div>
        <div id="point-packs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
          {pointPacks.map(plan => (
            <PackCard
              key={plan.sku}
              plan={plan}
              canPurchase={providers.length > 0}
              onSelect={openPurchase}
            />
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.7)', color: 'var(--text-muted)', fontSize: 12 }}>
          所有创作功能共用一套 AI 积分，按实际使用量结算。
        </div>

        <SectionHead eyebrow="Pay · 支付" title="支付方式" hint="在线通道上线前，可先了解各通道状态" />
        <div style={{ display: 'grid', gap: 8 }}>
          {channels.length > 0 ? channels.map(channel => (
            channel.enabled ? (
              <button
                key={channel.id}
                type="button"
                onClick={scrollToPacks}
                className="pricing-pay-row"
              >
                <span className="pricing-pay-row-label">
                  <span className="pricing-pay-dot" />
                  {channel.label}
                </span>
                <span className="pricing-pay-row-status">{channel.description || '当前可用'}</span>
              </button>
            ) : (
              <div
                key={channel.id}
                aria-disabled="true"
                className="pricing-pay-row is-off"
              >
                <span className="pricing-pay-row-label" style={{ color: 'var(--text-muted)' }}>{channel.label}</span>
                <span className="pricing-pay-pill is-off">{channel.availabilityNote || '即将开通'}</span>
              </div>
            )
          )) : (
            <div role="status" style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 2px' }}>
              各支付通道状态加载中，当前可通过积分套餐补充额度。
            </div>
          )}
        </div>

        <div className="pricing-faq-wrap">
          <div className="pricing-faq-title">常见问题</div>
          {FAQ_CONTENT.map(faq => (
            <details key={faq.q} className="pricing-faq">
              <summary>{faq.q}</summary>
              <p className="pricing-faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>

      {selectedPlan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="购买套餐"
          className="pricing-modal-overlay"
          onClick={closePurchase}
        >
          <div className="pricing-modal-panel" onClick={event => event.stopPropagation()}>
            <h2 className="pricing-modal-title">{selectedPlan.name}</h2>
            <p className="pricing-modal-sub">
              ¥{formatCatalogPrice(selectedPlan.priceFen)} · {formatCatalogGrant(selectedPlan)}
            </p>
            {providers.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {providers.map(provider => (
                  <button
                    key={provider.id}
                    type="button"
                    className="pricing-modal-btn"
                    disabled={Boolean(orderingProvider) || paymentOrder?.status === 'pending' || paymentOrder?.status === 'paid'}
                    onClick={() => createOrder(provider)}
                  >
                    {orderingProvider === provider.id ? '正在创建安全订单…' : '使用 ' + formatPaymentProviderLabel(provider.id)}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
                {channels.map(channel => (
                  <div
                    key={channel.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--border-light)',
                      background: channel.enabled ? 'var(--green-bg)' : 'rgba(245,239,228,0.6)',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: channel.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {channel.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: channel.enabled ? 'var(--green)' : 'var(--text-faint)' }}>
                      {channel.enabled ? '可用' : (channel.availabilityNote || '即将开通')}
                    </span>
                  </div>
                ))}
                <div role="status" style={{ padding: 10, borderRadius: 10, background: '#FFF7D6', color: '#7A5600', fontSize: 12, lineHeight: 1.6 }}>
                  在线支付开通前无法下单；已有订单仍可继续查询，套餐内容随时可回看。
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
