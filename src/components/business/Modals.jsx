import React, { useReducer, useState, useEffect, useMemo, useRef } from 'react';
import { MdLogin, MdAutoAwesome, MdAutorenew, MdClose, MdLockOutline } from 'react-icons/md';
import { FaGithub } from 'react-icons/fa';
import { Modal, CharImg } from '../ui/index';
import Button from '../ui/Button';
import { IMAGES } from '../../constants/images';
import { PRICING_PLANS } from '../../constants/data';
import { useApp } from '../../store/AppContext';
import {
  sendOTP,
  verifyOTP,
  fetchAuthProviders,
  beginOAuthLogin,
  forgotPassword,
} from '../../services/auth';
import InsufficientBalanceModal from '../billing/InsufficientBalanceModal.jsx';
import PricingModalRefactored from './PricingModal.jsx';
import '../../styles/pricing-modal.css';
import { resolvePendingActionCurrency } from '../../utils/generationAccess.js';
import BillingBalanceCard from '../billing/BillingBalanceCard.jsx';
import {
  buildPricingPlans,
  createPricingModalViewState,
  createOrderRequest,
  enabledPaymentProviders,
  formatPaymentProviderLabel,
  formatCatalogGrant,
  formatCatalogPrice,
  transitionPricingModalView,
} from '../billing/pricingCatalogModel.js';
import { createBillingOrder, fetchBillingOrder, waitForBillingOrder } from '../../services/billing.js';
import {
  clearPendingPaymentOrder,
  createPendingPaymentOrder,
  isTerminalPaymentOrderStatus,
  loadPendingPaymentOrder,
  savePendingPaymentOrder,
} from '../../utils/pendingPaymentOrder.js';
import { createLoginOtpState, loginOtpReducer, remainingResendSeconds } from './loginOtpState.js';

/* ═══════ Login Modal ═══════ */
export function LoginModal() {
  const { state, dispatch, fetchCredits } = useApp();
  const [otp, updateOtp] = useReducer(loginOtpReducer, undefined, createLoginOtpState);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [oauthProviders, setOauthProviders] = useState([]);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { email, code, step } = otp;
  const resendSeconds = remainingResendSeconds(otp.resendAt, now);

  useEffect(() => {
    if (!state.showLogin || resendSeconds <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.showLogin, resendSeconds]);

  // P2：弹窗打开时拉取可用第三方登录方式（未配置凭据的服务端不返回对应按钮）。
  useEffect(() => {
    if (!state.showLogin) return undefined;
    let active = true;
    fetchAuthProviders()
      .then(list => { if (active) setOauthProviders(Array.isArray(list) ? list : []); })
      .catch(() => { if (active) setOauthProviders([]); });
    return () => { active = false; };
  }, [state.showLogin]);

  if (!state.showLogin) return null;

  // ── P2：忘记密码子流程（输邮箱 → forgot-password，响应恒定防枚举）──
  if (forgotMode) {
    return (
      <Modal onClose={close}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <CharImg src={IMAGES.wave} size={64} />
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', marginTop: 10 }}>
            找回密码
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', marginTop: 4 }}>
            输入注册邮箱，我们将发送重置链接
          </div>
        </div>

        {err && <div style={{
          background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 'var(--radius-md)',
          padding: '8px 14px', marginBottom: 12, fontSize: 'var(--text-sm)', color: '#C53030',
        }}>{err}</div>}

        <input
          placeholder="邮箱地址"
          autoFocus
          value={forgotEmail}
          onChange={e => setForgotEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleForgotSubmit(); }}
          style={{
            width: '100%', padding: '12px 16px',
            border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-base)', marginBottom: 12,
            boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit', opacity: 1,
          }}
        />

        <Button primary full onClick={handleForgotSubmit} disabled={forgotLoading}>
          {forgotLoading ? <MdAutorenew size={15} className="animate-spin" /> : <MdLockOutline size={15} />}
          {forgotLoading ? ' 发送中…' : ' 发送重置链接'}
        </Button>

        {forgotMsg && (
          <div role="status" style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: '#F0FFF4', border: '1px solid #C6F6D5', color: '#276749',
            fontSize: 'var(--text-sm)', lineHeight: 1.6,
          }}>{forgotMsg}</div>
        )}

        <button type="button"
          onClick={() => { setForgotMode(false); setForgotMsg(''); setErr(''); }}
          style={{ width: '100%', marginTop: 14, border: 0, background: 'transparent', color: 'var(--command)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
          返回登录
        </button>
      </Modal>
    );
  }

  const close = () => {
    dispatch({ type: 'SHOW_LOGIN', show: false });
    updateOtp({ type: 'RESET' });
    setLoading(false);
    setErr('');
    setForgotMode(false);
    setForgotEmail('');
    setForgotMsg('');
    setForgotLoading(false);
  };

  const handleGithubLogin = () => {
    beginOAuthLogin('github').catch(e => setErr(e?.message || 'GitHub 登录暂不可用'));
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotMsg('请输入正确的邮箱地址');
      return;
    }
    setForgotLoading(true);
    setForgotMsg('');
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotMsg('如果该邮箱已注册，重置链接已发送，请前往邮箱查收。');
    } catch (e) {
      setForgotMsg(e?.message || '提交失败，请稍后再试');
    }
    setForgotLoading(false);
  };

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) { setErr('请输入正确的邮箱地址'); return; }
    setLoading(true); setErr('');
    try {
      const result = await sendOTP(email.trim());
      updateOtp({
        type: 'CODE_SENT',
        now: Date.now(),
        cooldownMs: Math.max(0, result.retryAfterSeconds) * 1000,
      });
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleEmailChange = (nextEmail) => {
    updateOtp(step === 'code'
      ? { type: 'BEGIN_LOGIN', email: nextEmail }
      : { type: 'SET_EMAIL', email: nextEmail });
  };

  const handleVerify = async () => {
    if (!code.trim()) { setErr('请输入验证码'); return; }
    setLoading(true); setErr('');
    try {
      const user = await verifyOTP(email.trim(), code.trim());
      dispatch({ type: 'SET_LOGGED', logged: true, phone: user.email });
      setTimeout(() => { fetchCredits(user.email); }, 100);
      if (state.loginIntent?.destination) {
        if (state.loginIntent.canvasTab) dispatch({ type: 'OPEN_CANVAS', tab: state.loginIntent.canvasTab });
        else dispatch({ type: 'NAVIGATE', page: state.loginIntent.destination });
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
        onChange={e => handleEmailChange(e.target.value)}
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

      <button type="button" onClick={() => { setErr(''); setForgotMode(true); }}
        style={{ width: '100%', marginTop: 10, border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
        忘记密码？
      </button>

      {oauthProviders.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 10px', color: 'var(--text-invisible)', fontSize: 11 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            或使用以下方式继续
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {oauthProviders.map(provider => provider.id === 'github' ? (
              <button key={provider.id} type="button" onClick={handleGithubLogin}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 0', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
                  background: '#24292f', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                <FaGithub size={16} />
                使用 GitHub 继续
              </button>
            ) : null)}
          </div>
        </>
      )}

      {step === 'code' && (
        <button type="button" onClick={resendSeconds > 0 ? undefined : handleSendCode} disabled={loading || resendSeconds > 0}
          style={{ width: '100%', marginTop: 10, border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: resendSeconds > 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
          {resendSeconds > 0 ? `${resendSeconds} 秒后可重新发送` : '重新发送验证码'}
        </button>
      )}

      {step === 'code' && (
        <button type="button" onClick={() => updateOtp({ type: 'BEGIN_LOGIN', email })}
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

// 4c183cd4 续命 P-Canvas 主线程亲自救 (1f64aa42 后): App.jsx 还在 `import { LoginModal, PricingModal }` + `<PricingModal />`,
// 1f64aa42 删了老 PricingModalLegacy 函数但没补 export, 这里重命名 Modals 函数为 PricingModal 让 App.jsx 仍能 <PricingModal />
export function PricingModal() {
  const { state, dispatch } = useApp();
  if (!state.showPrice) return null;
  // 4c183cd4 续命 8-30 主线程真浏览器截图验证修复: 之前参数顺序错 (PRICING_PLANS 当 catalog, billingCatalog 当 metadata), buildPricingPlans 的 catalog 是产品列表 (priceFen/grantUnits/validityDays), metadata 是 fallback (sku/name/desc/pop), 反过来才对. 而且 currency 必须传 primaryCurrency, 否则 validCatalogProduct 拒绝所有 product. 修后 4 档套餐 (基础/专业/团队/工作室) + 2 个月卡礼包 会渲染.
  const plans = useMemo(() => buildPricingPlans(state.billingCatalog || null, PRICING_PLANS, state.billingCatalog?.billing?.primaryCurrency), [state.billingCatalog]);
  const providers = useMemo(() => enabledPaymentProviders(state.billingCatalog || []), [state.billingCatalog]);
  const [payModal, setPayModal] = useState(null);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentOrder, setPaymentOrder] = useState(null);
  // 4c183cd4 续命 P-Modals (主线程亲自补 1f64aa42 + 07741c29 + b515a6b2 漏的 4c183cd4 时代老 PricingModalLegacy 状态):
  // 4c183cd4 老函数里 useRef 4 个 + useState 1 个 + 若干事件 handler (close / closePayment / createOrder) 都漏了
  // 当前简化 07741c29 版本只用 modalView 的 setter (PricingModalRefactored.onClose 调 transitionPricingModalView)
  // paymentAbortRef / paymentKeysRef / paymentCheckoutRef / restoredPaymentKeyRef 在简化版里没有引用, 不加 (避免死代码)
  // close / closePayment / createOrder 在 JSX 里直接用, 必须声明
  const [modalView, setModalView] = useState(() => createPricingModalViewState({
    interrupted: state.priceReason === 'INSUFFICIENT_CREDITS',
    pendingAction: state.pendingPaidAction,
    priceReason: state.priceReason,
  }));
  const close = () => dispatch({ type: 'SHOW_PRICE', show: false });
  const closePayment = () => {
    setPayModal(null);
  };
  const createOrder = async (provider) => {
    if (!payModal) return;
    setPayLoading(true);
    setPaymentStatus('');
    try {
      const requestKey = `${payModal.sku}:${provider.id}`;
      const idempotencyKey = createOrderRequest({ productSku: payModal.sku, provider: provider.id }).idempotencyKey;
      const response = await createBillingOrder(createOrderRequest({
        productSku: payModal.sku,
        provider: provider.id,
        idempotencyKey,
      }));
      const order = response?.order || response;
      setPaymentOrder(order);
      if (isTerminalPaymentOrderStatus(order?.status)) {
        clearPendingPaymentOrder();
      } else if (state.phone) {
        savePendingPaymentOrder(createPendingPaymentOrder({
          ownerEmail: state.phone,
          orderId: order.id,
          productSku: payModal.sku,
          provider: provider.id,
          idempotencyKey,
          status: order.status || 'pending',
          checkout: order?.checkout,
        }));
      }
      setPaymentStatus(order?.status === 'credited'
        ? '支付已到账,当前工作已保留,关闭窗口即可继续创作。'
        : '订单已创建,请在 5 分钟内完成支付;关闭此窗口当前工作仍会保留。');
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setPaymentStatus('订单创建失败,请稍后重试或换一种支付方式。');
      }
    } finally {
      setPayLoading(false);
    }
  };
  const buy = (plan) => {
    if (!state.logged) { dispatch({ type: 'SHOW_LOGIN', show: true }); return; }
    setPaymentStatus('');
    setPaymentOrder(null);
    setPayModal(plan);
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
      {/* 4c183cd4 续命 8-30 主线程真浏览器截图验证修复: shell 480 太窄, fc13c60c 加视频按量档 FAST/STANDARD/PREMIUM 后内容撑到 720, shell 必须容纳, 否则 PREMIUM 卡片 + 支付宝按钮会被右边界裁掉 ~235px. 改 maxWidth 480 -> 760 (容纳 pricing-modal max-width 720 + shell padding 24*2 - margin) */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)', maxWidth: 760,
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        background: '#fff',
        borderRadius: 24,
        boxShadow: '0 28px 90px rgba(0,0,0,0.2)',
        padding: 24,
        animation: 'scaleIn 0.15s ease',
      }} className="pricing-modal-scroll-shell">
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

          {/* 4c183cd4 续命 PricingModal (4 视角重构 - 替代 4c183cd4 时代 inline style) */}
          {/* 4c183cd4 续命 P-Modals (主线程亲自加 4c183cd4 时代 1af0762d0 漏的 show prop 透传): 外层 L312 已守 state.showPrice, 这里再透传给 PricingModalRefactored 作为第二层保险 */}
          <PricingModalRefactored
            show={state.showPrice}
            plans={plans}
            providers={providers}
            onBuy={buy}
            onClose={() => setModalView(current => transitionPricingModalView(current, 'CANCEL'))}
            isLogged={state.logged}
            ecPoints={state.ecPoints}
            unlimited={state.unlimited}
          />
      </div>

      {/* Payment modal */}
      {payModal && (providers.length > 0 || paymentOrder) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={closePayment}>
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

            {providers.length > 0 ? <div style={{ display: 'grid', gap: 10 }}>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => createOrder(provider)}
                  disabled={payLoading || paymentOrder?.status === 'pending' || paymentOrder?.status === 'paid'}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 0, background: '#1f2937', color: '#fff', fontSize: 13, fontWeight: 800, cursor: payLoading ? 'wait' : 'pointer' }}
                >
                  {payLoading ? '正在创建安全订单…' : `使用 ${formatPaymentProviderLabel(provider.id)}`}
                </button>
              ))}
            </div> : <div role="status" style={{ padding: 10, borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>
              微信支付 / 支付宝 通道已配置；订单通过扫码完成，3-5 秒内自动入账。
            </div>}

            <div style={{
              fontSize: 11, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5,
            }}>
              完成购买后会自动刷新额度，关闭此窗口即可回到刚才的创作位置。
            </div>

            {paymentOrder?.checkout?.url && (
              <button type="button" onClick={() => window.open(paymentOrder.checkout.url, '_blank', 'noopener,noreferrer')} style={{ marginTop: 12, width: '100%', minHeight: 40, border: '1px solid #1A1614', borderRadius: 10, background: '#fff', color: '#1A1614', cursor: 'pointer', fontWeight: 700 }}>
                重新打开支付页
              </button>
            )}

            {paymentStatus && <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: '#73510D', background: '#FFF8E7', borderRadius: 10, padding: 10 }}>{paymentStatus}</div>}
          </div>
        </div>
      )}
    </>
  );
}
