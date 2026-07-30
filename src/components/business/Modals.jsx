import React, { useReducer, useState, useEffect, useMemo } from 'react';
import { MdLogin, MdAutoAwesome, MdAutorenew, MdClose } from 'react-icons/md';
import { Modal, CharImg } from '../ui/index';
import Button from '../ui/Button';
import { IMAGES } from '../../constants/images';
import { PRICING_XHS, PRICING_EC } from '../../constants/data';
import { useApp } from '../../store/AppContext';
import { sendOTP, verifyOTP, isClosedBetaEmail } from '../../services/auth';
import InsufficientBalanceModal from '../billing/InsufficientBalanceModal.jsx';
import { resolvePendingActionCurrency } from '../../utils/generationAccess.js';
import BillingBalanceCard from '../billing/BillingBalanceCard.jsx';
import {
  buildPricingPlans,
  createPricingModalViewState,
  createOrderRequest,
  enabledPaymentProviders,
  formatCatalogGrant,
  formatCatalogPrice,
  transitionPricingModalView,
} from '../billing/pricingCatalogModel.js';
import { createBillingOrder } from '../../services/billing.js';
import { createLoginOtpState, loginOtpReducer, remainingResendSeconds } from './loginOtpState.js';

/* ═══════ Login Modal ═══════ */
export function LoginModal() {
  const { state, dispatch, fetchCredits } = useApp();
  const [otp, updateOtp] = useReducer(loginOtpReducer, undefined, createLoginOtpState);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const { email, code, step } = otp;
  const resendSeconds = remainingResendSeconds(otp.resendAt, now);

  useEffect(() => {
    if (!state.showLogin || resendSeconds <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.showLogin, resendSeconds]);

  if (!state.showLogin) return null;

  const close = () => {
    dispatch({ type: 'SHOW_LOGIN', show: false });
    updateOtp({ type: 'RESET' });
    setLoading(false);
    setErr('');
  };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) { setErr('请输入正确的邮箱地址'); return; }
    if (!isClosedBetaEmail(email)) { setErr('暂时无法使用该邮箱登录，请稍后再试'); return; }
    setLoading(true); setErr('');
    try {
      await sendOTP(email.trim());
      updateOtp({ type: 'CODE_SENT', now: Date.now(), cooldownMs: 60_000 });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!code.trim()) { setErr('请输入验证码'); return; }
    setLoading(true); setErr('');
    try {
      const user = await verifyOTP(email.trim(), code.trim());
      dispatch({ type: 'SET_LOGGED', logged: true, phone: user.email });
      setTimeout(() => { fetchCredits(user.email); }, 100);
      if (state.loginIntent?.destination) {
        dispatch({ type: 'NAVIGATE', page: state.loginIntent.destination });
        dispatch({ type: 'SET_LOGIN_INTENT', intent: null });
      }
      close();
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <Modal onClose={close}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <CharImg src={IMAGES.wave} size={64} />
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', marginTop: 10 }}>
          登录薯包AI
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', marginTop: 4 }}>
          验证邮箱后即可继续创作
        </div>
      </div>

      {err && <div style={{
        background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 'var(--radius-md)',
        padding: '8px 14px', marginBottom: 12, fontSize: 'var(--text-sm)', color: '#C53030',
      }}>{err}</div>}

      <input
        placeholder="邮箱地址"
        autoFocus
        value={email}
        onChange={e => updateOtp({ type: 'SET_EMAIL', email: e.target.value })}
        style={{
          width: '100%', padding: '12px 16px',
          border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
          fontSize: 'var(--text-base)', marginBottom: 10,
          boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
          opacity: 1,
        }}
      />

      {step === 'code' ? (
        <input
          placeholder="验证码"
          value={code}
          onChange={e => updateOtp({ type: 'SET_CODE', code: e.target.value.replace(/\D/g, '') })}
          maxLength={6}
          autoFocus
          style={{
            width: '100%', padding: '12px 16px',
            border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-base)', marginBottom: 20,
            boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
          }}
        />
      ) : (
        <div style={{ height: 10 }} />
      )}

      <Button primary full onClick={step === 'email' ? handleSendCode : handleVerify} disabled={loading}>
        {loading ? <MdAutorenew size={15} className="animate-spin" /> : <MdLogin size={15} />}
        {step === 'email' ? ' 发送验证码' : ' 登录'}
      </Button>

      {step === 'code' && (
        <button type="button" onClick={resendSeconds > 0 ? undefined : handleSendCode} disabled={loading || resendSeconds > 0}
          style={{ width: '100%', marginTop: 10, border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: resendSeconds > 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
          {resendSeconds > 0 ? `${resendSeconds} 秒后可重新发送` : '重新发送验证码'}
        </button>
      )}

      {step === 'code' && (
        <button type="button" onClick={() => updateOtp({ type: 'EDIT_EMAIL' })}
          style={{ width: '100%', marginTop: 10, border: 0, background: 'transparent', color: 'var(--command)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
          修改邮箱
        </button>
      )}

      {step === 'email' && otp.hasActiveCode && (
        <button type="button" onClick={() => updateOtp({ type: 'RETURN_TO_CODE' })}
          style={{ width: '100%', marginTop: 10, border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
          返回填写已发送的验证码
        </button>
      )}

      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 'var(--text-xs)', color: 'var(--text-invisible)' }}>
        登录后可把作品保存到个人作品集
      </div>
    </Modal>
  );
}

/* ═══════ Pricing Modal (灵图风格) ═══════ */
export function PricingModal() {
  const { state, dispatch, refreshBillingBalance, refreshBillingCatalog } = useApp();
  const [tab, setTab] = useState(state.priceTab || 'content');
  const [payModal, setPayModal] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [modalView, setModalView] = useState(() => createPricingModalViewState({
    interrupted: state.priceReason === 'INSUFFICIENT_CREDITS',
    pendingAction: state.pendingPaidAction,
    priceReason: state.priceReason,
  }));
  const metadata = tab === 'content' ? PRICING_XHS : PRICING_EC;
  const currency = tab === 'content' ? 'content_sets' : 'ec_points';
  const plans = useMemo(
    () => buildPricingPlans(state.billingCatalog, metadata, currency),
    [currency, metadata, state.billingCatalog],
  );
  const providers = useMemo(
    () => enabledPaymentProviders(state.billingCatalog),
    [state.billingCatalog],
  );

  useEffect(() => {
    if (!state.showPrice) return;
    setTab(state.priceTab || 'content');
    setModalView(createPricingModalViewState({
      interrupted: state.priceReason === 'INSUFFICIENT_CREDITS',
      pendingAction: state.pendingPaidAction,
      priceReason: state.priceReason,
    }));
    refreshBillingCatalog().catch(() => {});
  }, [
    refreshBillingCatalog,
    state.pendingPaidAction,
    state.priceReason,
    state.showPrice,
    state.priceTab,
  ]);

  if (!state.showPrice) return null;
  const close = () => dispatch({ type: 'SHOW_PRICE', show: false });
  const interrupted = state.priceReason === 'INSUFFICIENT_CREDITS';
  if (interrupted && modalView.mode === 'insufficient') {
    const pendingAction = modalView.pendingAction;
    const currency = resolvePendingActionCurrency({
      action: pendingAction?.action,
      source: pendingAction?.source,
    });
    return <InsufficientBalanceModal
      pendingAction={pendingAction}
      required={pendingAction?.billing?.required}
      available={pendingAction?.billing?.available}
      currency={currency}
      entitlement={{ ecPoints: state.ecPoints, contentSets: state.contentSets, unlimited: state.unlimited }}
      catalog={state.billingCatalog}
      onClose={close}
      onRefreshBalance={refreshBillingBalance}
      onResume={close}
      onViewPlans={() => setModalView(current => transitionPricingModalView(current, 'VIEW_PLANS'))}
    />;
  }
  const buy = (p) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    if (!p.enabled || providers.length === 0) return;
    setPaymentStatus('');
    setPayModal(p);
  };

  const createOrder = async (provider) => {
    if (!payModal) return;
    setPayLoading(true);
    setPaymentStatus('');
    try {
      await createBillingOrder(createOrderRequest({
        productSku: payModal.sku,
        provider: provider.id,
      }));
      setPaymentStatus('订单已创建，请按页面提示完成购买后刷新余额。');
    } catch (error) {
      setPaymentStatus(error?.message || '订单创建失败，请稍后重试。');
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)', maxWidth: 480,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 28px 90px rgba(0,0,0,0.2)',
        padding: 28,
        animation: 'scaleIn 0.15s ease',
      }}>
        {/* Close button */}
        <button onClick={close}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: '#f5f5f5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#999', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.color = '#333'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#999'; }}>
          <MdClose size={16} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          {interrupted && (
            <button
              type="button"
              onClick={() => setModalView(current => transitionPricingModalView(current, 'RETURN_TO_INSUFFICIENT'))}
              style={{ marginBottom: 12, padding: 0, border: 0, background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← 返回额度提示
            </button>
          )}
          <h3 style={{
            fontSize: 22, fontWeight: 900,
            color: 'var(--accent)',
            marginBottom: 4,
          }}>
            创作权益
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
            按需补充额度，关闭后当前工作仍会保留
          </p>
        </div>

        {state.logged && (
          <div style={{ marginBottom: 18 }}>
            <BillingBalanceCard
              ecommercePoints={state.ecPoints}
              contentSets={state.contentSets}
              unlimited={state.unlimited}
            />
          </div>
        )}

        {/* Tab pills */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 12, padding: 4,
          marginBottom: 20,
        }}>
          {[
            { key: 'content', label: '小红书 / Plog 创作套数' },
            { key: 'ecommerce', label: '电商图片 / 画布 AI 积分' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '10px 0',
                border: 'none', background: tab === t.key ? '#fff' : 'transparent',
                borderRadius: 10, fontFamily: 'inherit',
                fontSize: 13, fontWeight: tab === t.key ? 900 : 600,
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {providers.length === 0 && (
          <div role="status" style={{ marginBottom: 14, padding: 12, borderRadius: 12, border: '1px solid #E9C46A', background: '#FFF7D6', color: '#7A5600', fontSize: 13, lineHeight: 1.6 }}>
            <strong>支付服务接入中</strong>
            <div>在线购买暂未开放，当前可先查看套餐内容与额度。</div>
          </div>
        )}

        {/* Pricing cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.length === 0 && (
            <div role="status" style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)' }}>
              正在加载套餐信息…
            </div>
          )}
          {plans.map((p, i) => {
            const colors = [
              'linear-gradient(135deg, #f59e0b, #f97316)',
              'linear-gradient(135deg, #6366f1, #8b5cf6)',
              'linear-gradient(135deg, #ec4899, #f43f5e)',
              'linear-gradient(135deg, #0f766e, #14b8a6)',
            ];
            return (
              <div key={i}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 16,
                  padding: 18,
                  borderRadius: 20,
                  border: p.recommended ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: p.recommended ? '#FAFAF9' : '#fff',
                  cursor: p.enabled && providers.length > 0 ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onClick={p.enabled && providers.length > 0 ? () => buy(p) : undefined}
                onMouseEnter={p.enabled && providers.length > 0 ? e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; } : undefined}
                onMouseLeave={p.enabled && providers.length > 0 ? e => { e.currentTarget.style.borderColor = p.recommended ? 'var(--accent)' : 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; } : undefined}>
                {/* Small gradient icon */}
                <span style={{
                  width: 44, height: 44, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: colors[i],
                  flexShrink: 0,
                }}>
                  <MdAutoAwesome size={22} color="#fff" fill="#fff" />
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>
                    {p.name}
                    {p.recommended && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, color: '#fff',
                        background: 'var(--accent)',
                        padding: '2px 8px', borderRadius: 6, marginLeft: 8,
                        letterSpacing: 0.3,
                      }}>推荐</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                    {formatCatalogGrant(p)} · {p.validityDays ? `${p.validityDays} 天有效` : '永久有效'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 1 }}>
                    {p.description}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 26, fontWeight: 900,
                    color: 'var(--accent)',
                    lineHeight: 1,
                  }}>
                    ¥{formatCatalogPrice(p.priceFen)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.enabled ? (providers.length > 0 ? '选择套餐' : '暂不可购买') : '套餐已停用'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* Payment modal */}
      {payModal && providers.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setPayModal(null)}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 360,
            width: '100%', padding: 28, textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', marginBottom: 4 }}>
              {payModal.name}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              ¥{formatCatalogPrice(payModal.priceFen)} · {formatCatalogGrant(payModal)}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
              选择支付方式
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => createOrder(provider)}
                  disabled={payLoading}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 0, background: '#1f2937', color: '#fff', fontSize: 13, fontWeight: 800, cursor: payLoading ? 'wait' : 'pointer' }}
                >
                  {payLoading ? '正在创建安全订单…' : `使用 ${provider.id} 支付`}
                </button>
              ))}
            </div>

            <div style={{
              fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5,
            }}>
              完成购买后可刷新额度并继续刚才的创作，当前内容不会丢失。
            </div>

            {paymentStatus && <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: '#73510D', background: '#FFF8E7', borderRadius: 10, padding: 10 }}>{paymentStatus}</div>}
          </div>
        </div>
      )}
    </>
  );
}
