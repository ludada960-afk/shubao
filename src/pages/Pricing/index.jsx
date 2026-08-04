import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MdAutoAwesome } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
import Footer from '../../components/layout/Footer';
import BillingBalanceCard from '../../components/billing/BillingBalanceCard.jsx';
import {
  buildPricingPlans,
  createOrderRequest,
  enabledPaymentProviders,
  formatPaymentProviderLabel,
  formatCatalogGrant,
  formatCatalogPrice,
} from '../../components/billing/pricingCatalogModel.js';
import { createBillingOrder, fetchBillingOrder, waitForBillingOrder } from '../../services/billing.js';
import {
  clearPendingPaymentOrder,
  createPendingPaymentOrder,
  isTerminalPaymentOrderStatus,
  loadPendingPaymentOrder,
  savePendingPaymentOrder,
} from '../../utils/pendingPaymentOrder.js';

const FAQ_CONTENT = {
  content: [
    { q: '小红书 / Plog 如何计算 AI 积分？', a: '一套 9 张图按 9 张 2K 图片计费，共 9 AI 积分；实际生成前会先冻结本次预计额度，稳定交付后才结算。' },
    { q: '生成失败会扣额度吗？', a: '只有稳定交付完整结果后才结算；上游或服务异常导致失败会释放本次冻结额度。' },
    { q: '生成内容可以商用吗？', a: '可以。请在发布前检查平台规范、品牌素材授权和生成内容准确性。' },
  ],
  ecommerce: [
    { q: 'AI 积分如何使用？', a: '不同电商生图与画布能力会消耗相应积分，确认生成前会展示本次所需积分。' },
    { q: 'AI 积分会过期吗？', a: '电商 AI 积分永久有效，不按月清零。' },
    { q: '支持哪些电商场景？', a: '可用于主图、白底图、详情图、SKU 图和画布二创等场景，具体以产品内已开放功能为准。' },
  ],
};

const CARD_COLORS = [
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #0f766e, #14b8a6)',
];

export default function PricingPage() {
  const {
    state,
    dispatch,
    refreshBillingBalance,
    refreshBillingCatalog,
  } = useApp();
  const [tab, setTab] = useState('content');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderingProvider, setOrderingProvider] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  const paymentAbortRef = useRef(null);
  const paymentKeysRef = useRef(new Map());
  const paymentCheckoutRef = useRef(null);
  const restoredPaymentKeyRef = useRef('');
  const metadata = tab === 'content' ? PRICING_XHS : PRICING_EC;
  const currency = 'ec_points';
  const plans = useMemo(
    () => buildPricingPlans(state.billingCatalog, metadata, currency),
    [currency, metadata, state.billingCatalog],
  );
  const providers = useMemo(
    () => enabledPaymentProviders(state.billingCatalog),
    [state.billingCatalog],
  );
  const faqs = FAQ_CONTENT[tab];

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
    const restoreKey = `${saved.orderId}:${saved.productSku}`;
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
          paymentKeysRef.current.delete(`${saved.productSku}:${saved.provider}`);
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

  const openPurchase = (plan) => {
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    if (!plan.enabled || providers.length === 0) return;
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
      const requestKey = `${selectedPlan.sku}:${provider.id}`;
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
      }
    } catch (error) {
      setOrderStatus(error?.message || '订单创建失败，请稍后重试。');
    } finally {
      setOrderingProvider('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
            创作权益
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
            按需补充额度，当前工作和草稿不会因查看套餐而丢失
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

        <div style={{
          display: 'flex',
          gap: 4,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 20,
        }}>
          {[
            { key: 'content', label: '小红书 / Plog · AI 积分' },
            { key: 'ecommerce', label: '电商图片 / 画布 AI 积分' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                flex: 1,
                padding: '10px 8px',
                border: 'none',
                background: tab === item.key ? '#fff' : 'transparent',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: tab === item.key ? 900 : 600,
                color: tab === item.key ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                boxShadow: tab === item.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

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
          }}>
            <strong>支付服务接入中</strong>
            <div>在线购买暂未开放，当前可先查看套餐内容与额度。</div>
          </div>
        )}

        {catalogError && (
          <div role="alert" style={{ marginBottom: 14, color: '#B42318', fontSize: 13 }}>
            {catalogError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.length === 0 && !catalogError && (
            <div role="status" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              正在加载套餐信息…
            </div>
          )}
          {plans.map((plan, index) => {
            const canPurchase = plan.enabled && providers.length > 0;
            const card = (
              <>
                <span style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: CARD_COLORS[index % CARD_COLORS.length],
                  flexShrink: 0,
                }}>
                  <MdAutoAwesome size={22} color="#fff" fill="#fff" />
                </span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>
                    {plan.name}
                    {plan.recommended && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: '#fff',
                        background: 'var(--accent)',
                        padding: '2px 8px',
                        borderRadius: 6,
                        marginLeft: 8,
                      }}>
                        推荐
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {formatCatalogGrant(plan)}
                    {plan.validityDays ? ` · ${plan.validityDays} 天有效` : ' · 永久有效'}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                    {plan.description}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: 26, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                    ¥{formatCatalogPrice(plan.priceFen)}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {plan.enabled ? (canPurchase ? '选择套餐' : '暂不可购买') : '套餐已停用'}
                  </span>
                </span>
              </>
            );
            const style = {
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 18,
              borderRadius: 20,
              border: plan.recommended ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: plan.recommended ? '#FAFAF9' : '#fff',
              position: 'relative',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            };
            return canPurchase ? (
              <button key={plan.sku} type="button" onClick={() => openPurchase(plan)} style={{ ...style, cursor: 'pointer' }}>
                {card}
              </button>
            ) : (
              <article key={plan.sku} aria-disabled="true" style={{ ...style, opacity: plan.enabled ? 1 : 0.6 }}>
                {card}
              </article>
            );
          })}
        </div>

        <div style={{ maxWidth: 520, margin: '40px auto 0', textAlign: 'left' }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, textAlign: 'center', color: 'var(--accent)' }}>
            常见问题
          </div>
          {faqs.map((faq) => (
            <details key={faq.q} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0', fontSize: 14 }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
                {faq.q}
              </summary>
              <p style={{ margin: '8px 0 0', color: 'var(--text-hint)', lineHeight: 1.7, fontSize: 13 }}>
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </div>

      {selectedPlan && (providers.length > 0 || paymentOrder) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="购买套餐"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={closePurchase}
        >
          <div style={{ background: '#fff', borderRadius: 20, maxWidth: 360, width: '100%', padding: 28, textAlign: 'center' }} onClick={event => event.stopPropagation()}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{selectedPlan.name}</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              ¥{formatCatalogPrice(selectedPlan.priceFen)} · {formatCatalogGrant(selectedPlan)}
            </p>
            {providers.length > 0 ? <div style={{ display: 'grid', gap: 10 }}>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  disabled={Boolean(orderingProvider) || paymentOrder?.status === 'pending' || paymentOrder?.status === 'paid'}
                  onClick={() => createOrder(provider)}
                  style={{ minHeight: 44, border: '1px solid #1A1614', borderRadius: 12, background: '#1A1614', color: '#fff', cursor: orderingProvider ? 'wait' : 'pointer' }}
                >
                  {orderingProvider === provider.id ? '正在创建安全订单…' : `使用 ${formatPaymentProviderLabel(provider.id)}`}
                </button>
              ))}
            </div> : <div role="status" style={{ padding: 10, borderRadius: 10, background: '#FFF7D6', color: '#7A5600', fontSize: 12 }}>
              当前支付渠道暂时不可用，但已创建的订单仍可继续查询。
            </div>}
            {paymentOrder?.checkout?.url && (
              <button type="button" onClick={() => window.open(paymentOrder.checkout.url, '_blank', 'noopener,noreferrer')} style={{ marginTop: 12, width: '100%', minHeight: 40, border: '1px solid #1A1614', borderRadius: 10, background: '#fff', color: '#1A1614', cursor: 'pointer', fontWeight: 700 }}>
                重新打开支付页
              </button>
            )}
            {orderStatus && <p role="status" style={{ color: '#73510D', background: '#FFF8E7', borderRadius: 10, padding: 10, fontSize: 12 }}>{orderStatus}</p>}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
